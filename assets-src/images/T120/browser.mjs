// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Run with the pinned Node runtime from the checkout root. Only a built public guest client is served.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { expect, firefox } from '@playwright/test';
import { build, preview } from 'vite';
import { clickButton, pressButton } from '../../../tests/e2e/support/adventure-controls.ts';

const root = process.cwd();
const base = '/arcade/play/network-quest/';
const evidence = 'docs/evidence/spec001/image-production/T120';
const sha = data => createHash('sha256').update(data).digest('hex');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const characters = (await json('content/spec001/characters.json')).records.slice(0, 13);
const exports = (await json(evidence + '/exports.json')).images;
const ids = characters.map(row => row.id.slice(-4));
assert.equal(new Set(ids).size, 13);
const src = Object.fromEntries(await Promise.all([
  'assets-src/images/T120/browser.mjs', 'content/spec001/characters.json', 'src/ui/compendium.ts', 'src/app/application.ts',
  'vite.config.ts', 'package-lock.json',
].map(async path => [path, sha(await readFile(path))])));
await mkdir('.local/test-results', {recursive: true});
const outDir = await mkdtemp(resolve('.local/test-results/T120-guest-'));
await build({logLevel:'silent', build:{outDir}});
const server = await preview({configFile:false, root, base, build:{outDir}, logLevel:'error',
  preview:{host:'127.0.0.1', port:0, strictPort:true}});
const address = server.httpServer.address();
assert.ok(address && typeof address !== 'string');
const origin = `http://127.0.0.1:${address.port}`;
const browser = await firefox.launch();
const report = {browser: 'Firefox '+browser.version(), startedUtc: new Date().toISOString(), scope:
  'Current built guest client, ordinary production entry point, nested game base, first room. No injected game state or authentication. Only the fallback check intercepts a request.',
  inputHashes: src, base, standaloneDecodes: [], guests: []};
try {
  for (const failure of [false, true]) {
    const viewport = failure ? {width:390,height:844} : {width:1280,height:900};
    const page = await browser.newPage({viewport, reducedMotion:'reduce'});
    const portraitRequests = [], errors = [], unexpectedRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.includes('/assets/portraits/')) portraitRequests.push(url.pathname);
      if (/^https?:$/.test(url.protocol) && (url.origin !== origin || url.pathname.includes('/api/'))) unexpectedRequests.push(url.pathname);
    });
    if (failure) await page.route('**/assets/portraits/CH01.webp', route =>
      route.fulfill({status:404, contentType:'text/plain', body:'Unavailable for portrait fallback verification'}));
    await page.goto(origin + base);
    await clickButton(page, 'New Adventure');
    await pressButton(page, 'Compendium');
    const panel = page.getByRole('dialog', {name:'Compendium',exact:true});
    await expect(panel).toContainText('1 discovered · 24 undiscovered.');
    await expect(panel.locator('summary').filter({hasText:'Photon the Firefly ·'})).toHaveCount(0);
    const bindings = [];
    for (const id of failure ? ['CH01'] : ['CH01','CH03']) {
      if (id === 'CH03') {
        await clickButton(page,'Close compendium');
        await clickButton(page,'Look');
        await clickButton(page,'Photon the Firefly');
        await pressButton(page,'Compendium');
        await expect(panel).toContainText('2 discovered · 23 undiscovered.');
      }
      const character = characters[ids.indexOf(id)], binding = character.compendium.portraitBinding;
      const name = id === 'CH01' ? 'The Apprentice' : 'Photon the Firefly';
      const summary = panel.locator('summary').filter({hasText:name+' ·'}).first();
      await summary.press('Enter');
      const entry = summary.locator('..'), image = entry.locator('figure > img'), caption = entry.locator('figcaption');
      const path = base + binding.exportPath.slice('public/'.length);
      await caption.scrollIntoViewIfNeeded();
      if (failure) {
        await expect(caption).toHaveText('Portrait unavailable. '+binding.caption);
        await expect(image).toHaveCount(0);
      } else {
        await expect(image).toHaveAttribute('alt',binding.caption);
        await expect(caption).toHaveText(binding.caption);
        await image.scrollIntoViewIfNeeded();
        await image.evaluate(el => el.decode());
        const observed = await image.evaluate(el => ({width:el.naturalWidth,height:el.naturalHeight,src:new URL(el.currentSrc).pathname}));
        assert.deepEqual(observed,{width:512,height:512,src:path});
      }
      await expect(entry.getByRole('list',{name:'Limitations',exact:true})).not.toBeEmpty();
      const screenshot = evidence + '/' + id + (failure ? '-fallback' : '-discovered') + '.png';
      if (failure) await caption.scrollIntoViewIfNeeded();
      await page.screenshot({path:screenshot});
      assert.ok(portraitRequests.includes(path));
      bindings.push({character:character.id, path, caption:await caption.textContent(), keyboardOpened:true, imageDecoded:!failure, screenshot});
    }
    const allowed = (failure ? ['CH01'] : ['CH01','CH03']).map(id=>base+'assets/portraits/'+id+'.webp');
    assert.ok(portraitRequests.every(path => allowed.includes(path)));
    assert.deepEqual(errors,[]); assert.deepEqual(unexpectedRequests,[]);
    report.guests.push({viewport, failure, bindings, portraitRequests, errors, unexpectedRequests});
    await page.close();
  }
  const page = await browser.newPage();
  for (const [index, row] of exports.entries()) {
    const binding = characters[index].compendium.portraitBinding;
    assert.equal(binding.contentId, 'spec001:'+row.character);
    assert.equal(binding.assetId, 'spec001:ASSET-PORTRAIT-'+row.character);
    assert.equal(binding.exportPath, row.exports['512'].path);
    assert.equal(characters[index].compendium.id, 'spec001:COMPENDIUM-'+row.character);
    for (const [size, image] of Object.entries(row.exports)) {
      const path = base + image.path.slice('public/'.length);
      const response = await page.goto(origin + path);
      assert.equal(response.status(), 200);
      const responseHash = sha(await response.body());
      assert.equal(responseHash, sha(await readFile(image.path)));
      const dimensions = await page.locator('img').evaluate(async el => {await el.decode(); return [el.naturalWidth,el.naturalHeight];});
      assert.deepEqual(dimensions, [Number(size),Number(size)]);
      report.standaloneDecodes.push({id:row.character, path, dimensions, sha256:responseHash, bytes:image.bytes});
    }
  }
  await page.close();
  report.completedUtc = new Date().toISOString();
  report.bundle = {indexSha256:sha(await readFile(outDir+'/index.html')), manifestSha256:sha(await readFile(outDir+'/.vite/manifest.json'))};
  await writeFile(evidence+'/browser.json', JSON.stringify(report,null,2)+'\n');
  console.log('PASS 3 discovery/fallback checks and 26 independent Firefox export decodes');
} finally {
  await browser.close();
  await new Promise(done => server.httpServer.close(done));
}
