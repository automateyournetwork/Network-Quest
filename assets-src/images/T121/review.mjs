// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Discover the paired character through the normal guest application and check all display files.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { expect, firefox } from '@playwright/test';
import { build, preview } from 'vite';
import { clickButton, closeFrame } from '../../../tests/e2e/support/adventure-controls.ts';

const root = process.cwd();
const base = '/arcade/play/network-quest/';
const output = 'docs/evidence/spec001/image-production/T121';
const outDir = resolve('.local/t121-reviewed-build');
const readJson = async path => JSON.parse(await readFile(path, 'utf8'));
const hash = data => createHash('sha256').update(data).digest('hex');
const exports = (await readJson(output + '/exports.json')).images;
const config = {root, configFile: resolve('vite.config.ts'), logLevel: 'error', build: {outDir, emptyOutDir: true}};
await build(config);
const report = {scope: 'Normal Vite guest build at the published nested base, ephemeral loopback preview, public controls only.',
  version: 1, started: new Date().toISOString(), browser: '', nestedBase: base, inputs: {}, bundles: {}, discoveries: [], errors: []};
for (const path of ['src/app/application.ts','src/ui/compendium.ts','content/spec001/characters.json',
  'content/spec001/world.json','assets-src/images/T121/review.mjs','tests/e2e/support/adventure-controls.ts']) {
  report.inputs[path] = hash(await readFile(path));
}
for (const name of (await readdir(outDir + '/assets')).filter(path => /\.(js|css)$/.test(path))) {
  report.bundles['assets/' + name] = hash(await readFile(outDir + '/assets/' + name));
}
const server = await preview({...config, preview: {host: '127.0.0.1', port: 0, strictPort: true}});
const url = 'http://127.0.0.1:' + server.httpServer.address().port + base;
const browser = await firefox.launch({headless: true});
report.browser = 'Firefox ' + browser.version();

async function run(failure = false) {
  const context = await browser.newContext({viewport: {width:1280, height:900}, reducedMotion:'reduce'});
  const page = await context.newPage();
  page.setDefaultTimeout(9000);
  page.on('pageerror', error => report.errors.push(error.message));
  let failuresInjected = 0;
  if (failure) await page.route('**/assets/portraits/CH24.webp', async route => {
    failuresInjected++;
    await route.fulfill({status:404, body:'Image deliberately unavailable in isolated Firefox review'});
  });
  const click = async label => {
    if (['Compendium','Diagnostics'].includes(label)) await closeFrame(page);
    await clickButton(page,label);
  };
  const sequence = async (...labels) => { for (const label of labels) await click(label); };
  const walk = async (room, exit = 'Walk to ' + room) => {
    await sequence('Walk', exit);
    await expect(page.locator('.nq-game-location')).toHaveText(room);
  };
  const discover = async (roomId, ...numbers) => {
    const room = await readJson('content/spec001/rooms/' + roomId + '.json');
    for (const number of numbers) {
      const id = 'CH' + number;
      const row = exports.find(item => item.id === id);
      const actor = room.hotspots.find(item => item.subjectId === 'spec001:' + id);
      assert.ok(actor, roomId + '/' + id);
      const panel = page.getByRole('dialog', {name:'Compendium', exact:true});
      const summaries = panel.locator('summary').filter({hasText:row.name + ' ·'});
      await click('Compendium');
      await expect(summaries).toHaveCount(0);
      await sequence('Close compendium','Look', actor.label, 'Compendium');
      await expect(summaries).toHaveCount(1);
      await summaries.press('Enter');
      const entry = summaries.locator('..');
      const caption = entry.locator('figcaption');
      if (failure) {
        await expect(caption).toContainText('Portrait unavailable. ');
        await expect(entry.locator('img')).toHaveCount(0);
        assert.ok(failuresInjected > 0);
        await caption.scrollIntoViewIfNeeded();
        await page.screenshot({path: output + '/CH24-fallback.png'});
        report.fallback = {id, interceptedStatus:404, requests:failuresInjected, caption:await caption.innerText(),
          keyboardOpened:true, capture: output + '/CH24-fallback.png'};
      } else {
        const picture = entry.getByRole('img');
        await picture.scrollIntoViewIfNeeded();
        const observed = await picture.evaluate(async image => {
          await image.decode();
          return {src:new URL(image.currentSrc).pathname, alt:image.alt, width:image.naturalWidth, height:image.naturalHeight};
        });
        assert.equal(observed.src, base + row.exports[0].path.replace(/^public\//,''));
        assert.equal(observed.alt, await caption.innerText());
        assert.deepEqual([observed.width, observed.height], [512, 512]);
        const thumb = await page.evaluate(async path => {
          const image = new Image();
          image.src = path;
          await image.decode();
          return [image.naturalWidth, image.naturalHeight];
        }, base + row.exports[1].path.replace(/^public\//,''));
        assert.deepEqual(thumb, [256, 256]);
        const capture = output + '/' + id + '-compendium.png';
        await page.screenshot({path:capture});
        report.discoveries.push({id, roomId, actor:actor.label, hiddenBeforeLook:true, keyboardOpened:true,
          ...observed, servedFileSha256:hash(await readFile(outDir + '/' + observed.src.slice(base.length))),
          thumbnailDecoded:thumb, capture});
      }
      await sequence('Close compendium');
    }
  };
  try {
    await page.goto(url);
    await sequence('New Adventure', 'Look', 'Look at power indication', 'Look at link indication',
      'Talk', 'Talk to Photon the Firefly', 'Skip dialogue', 'Use', 'Inspect physical path');
    await walk("The Titan's Workshop");
    await sequence('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints',
      'Identify physical path under test','Notebook');
    await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare the physical path before and after intervention.');
    await sequence('Pin hypothesis','Close notebook','Continue as guest');
    await walk('The Copper Warrens');
    await discover('R03',24);
  } finally { await context.close(); }
}
try {
  await run();
  await run(true);
  // The picture gallery exercises export decoding separately from character discovery.
  const gallery = await browser.newPage({viewport:{width:1080, height:900}});
  try {
    await gallery.goto(url);
    report.gallery = await gallery.evaluate(async ({rows, base}) => {
      const container = document.createElement('main');
      container.style.cssText = 'background:#192a30;color:#f8e7cb;display:grid;grid-template-columns:repeat(4,1fr);padding:12px;';
      document.body.replaceChildren(container);
      const measurements = [];
      for (const row of rows) {
        const cell = document.createElement('section');
        const text = document.createElement('div');
        text.textContent = row.id + ' · ' + row.name;
        container.append(cell);
        cell.append(text);
        const sizes = [];
        for (const entry of row.exports) {
          const image = document.createElement('img');
          image.src = base + entry.path.replace(/^public\//,'');
          image.alt = row.name;
          image.width = entry.dimensions[0] === 512 ? 148 : 80;
          cell.append(image);
          await image.decode();
          const response = await fetch(image.currentSrc);
          if (!response.ok) throw Error('Image fetch failed: ' + response.status);
          const body = await response.arrayBuffer();
          const digest = await crypto.subtle.digest('SHA-256', body);
          const sha256 = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2,'0')).join('');
          if (sha256 !== entry.sha256) throw Error('Browser received different bytes for ' + entry.path);
          sizes.push({path: new URL(image.currentSrc).pathname, size:[image.naturalWidth,image.naturalHeight], bytes:body.byteLength, sha256});
        }
        measurements.push({id:row.id, sizes});
      }
      return measurements;
    }, {rows:exports,base});
    assert.deepEqual(report.gallery.map(row => row.sizes.map(s => s.size)), exports.map(row => row.exports.map(e => e.dimensions)));
    await gallery.locator('main').screenshot({path:output + '/browser-gallery.png'});
  } finally { await gallery.close(); }
  assert.equal(report.errors.length, 0);
  assert.deepEqual(report.discoveries.map(entry => entry.id), ['CH24']);
  for (const row of report.discoveries) {
    assert.equal(row.servedFileSha256, exports.find(e => e.id===row.id).exports[0].sha256);
  }
  assert.equal(report.fallback.caption, 'Portrait unavailable. ' + report.discoveries.find(row => row.id === 'CH24').alt);
  report.completed = new Date().toISOString();
  await writeFile(output + '/browser.json',JSON.stringify(report,null,2)+'\n');
} finally {
  await browser.close();
  await server.close();
}
