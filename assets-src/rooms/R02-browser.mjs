// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Normal guest entry into the finished Workshop, with source-rendition and conditional-use checks.
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clickButton, closeFrame, openFrame, pressButton } from '../../tests/e2e/support/adventure-controls.ts';

const output = process.argv[2] ?? 'docs/evidence/spec001/final-rooms/T135';
await mkdir(output, { recursive: true });
const base = '/arcade/play/network-quest/';
const outDir = await mkdtemp(resolve('.local/test-results/T135-room-'));
await build({logLevel:'silent',build:{outDir}});
const server = await preview({configFile:false,base,build:{outDir},logLevel:'error',preview:{host:'127.0.0.1',port:0}});
const browser = await firefox.launch(), page = await browser.newPage({viewport:{width:1280,height:900},reducedMotion:'reduce',hasTouch:true});
page.setDefaultTimeout(7000);
const room = JSON.parse(await readFile('content/spec001/rooms/R02.json','utf8'));
const registration = JSON.parse(await readFile('assets-src/rooms/R02-registration.json','utf8'));
const report = {browser:browser.version(), widths:[], requested:[], observedCues:[], destinations:[], errors:[]};
const files = new Map(), workshop = page.locator('.nq-room[data-room-id="spec001:R02"]');
const hash = b => createHash('sha256').update(b).digest('hex');
page.on('pageerror', e => report.errors.push(e.message));
page.on('response', response => {
  const path = 'public/' + new URL(response.url()).pathname.split(base)[1];
  if (!response.ok() || !path.startsWith('public/assets/') || files.has(path)) return;
  const download = response.body().then(bytes=>({path,sha256:hash(bytes),bytes:bytes.length})).catch(()=>null);
  files.set(path, download);
});
const click = async (...names) => { for(const name of names) { if(name==='Party') await closeFrame(page); await clickButton(page,name); } };
const zone = name => page.getByRole('dialog',{name,exact:true});
async function walk(name) { await click('Walk', 'Walk to '+name); await expect(page.locator('.nq-game-location')).toHaveText(name); }
async function ready() { await expect(workshop).toHaveAttribute('data-rendered','true'); await expect(workshop).toHaveAttribute('data-presentation','three'); }
async function measure(done) {
  await closeFrame(page); await click('Diagnostics','Take measurement');
  if(done) { await zone('Diagnostics').locator('ol li').last().getByRole('button',{name:'Submit this reading'}).click(); await expect(zone('Diagnostics')).toContainText('Objective complete.'); }
  await click('Close diagnostics');
}
async function sound() {
  await openFrame(page,'Sound and reading');
  for (const row of await page.locator('.nq-media-cue:visible').all()) {
    const id = await row.getAttribute('data-asset-id');
    if (report.observedCues.includes(id)) continue;
    await row.getByRole('button',{name:/^Replay /}).click();
    await expect(row).toHaveAttribute('data-audio-status',/^(playing|ended)$/);
    await row.getByRole('button',{name:/^Skip /}).click();
    await expect(row).toHaveAttribute('data-audio-status','stopped');
    report.observedCues.push(id);
  }
  await closeFrame(page);
}
async function capture(label, width) {
  await closeFrame(page); await page.setViewportSize({width,height:width===390?844:900}); await ready();
  await expect.poll(()=>workshop.locator('canvas').evaluate(c=>Math.abs(c.width/c.height-c.clientWidth/c.clientHeight))).toBeLessThan(.01);
  const result = await workshop.evaluate(el=>({metrics:{...el.dataset},canvas:[el.querySelector('canvas').width,el.querySelector('canvas').height],stage:el.getBoundingClientRect().toJSON(),viewport:innerWidth}));
  const plate=await workshop.locator('.nq-room-background').boundingBox();
  let worstError=0;
  for(const anchor of registration.anchors) {
    const pin=await workshop.locator(`[data-graybox-object="${anchor.objectId}"]`).first().boundingBox();
    const error=Math.hypot(pin.x+pin.width/2-(plate.x+anchor.uv[0]*plate.width),pin.y+pin.height/2-(plate.y+anchor.uv[1]*plate.height));
    worstError=Math.max(worstError,error);
  }
  expect(worstError).toBeLessThan(2);
  result.nativeAnchorErrorCssPixels=worstError;
  await page.screenshot({path:`${output}/${label}-${width}.png`}); report.widths.push({label,width,...result});
}
try {
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+base);
  await click('New Adventure'); await expect(page.locator('.nq-room')).toHaveAttribute('data-rendered','true');
  await click('Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await click('Look','Orientation plaque','Look at message capsule');
  if(await page.getByRole('button',{name:'Play preview',exact:true}).isEnabled()) await click('Play preview','Pause journey');
  await click('Replay journey','Return to investigation');
  await click('Notebook','Close notebook','Walk','Clear lift landing'); await sound();
  await walk("The Titan's Workshop"); await ready();
  await expect(workshop).toHaveAttribute('data-party-cast','');
  await expect(page.locator('.nq-workshop-decoration')).toHaveCount(0);
  await expect(page.locator('[data-asset-id="spec001:ASSET-VOICE-026"]')).toHaveCount(0);
  for(const width of [1280,390]) await capture('workshop',width);
  await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Capture the two endpoints and the current conductor before testing again.');
  await click('Pin hypothesis','Close notebook','Continue as guest');
  await closeFrame(page); await click('Look','Hypothesis board','Investigation routes','Iron Golem','Workshop length exercise');
  await click('Party','Close party','Use','The Titan','Walk','Clear workshop aisle');
  const floor = registration.anchors.find(anchor => anchor.objectId === 'spec001:WALK-R02');
  const foot = [floor.position[0], 0, floor.position[2]].map(value => value.toFixed(3)).join(',');
  await expect(workshop).toHaveAttribute('data-player-foot', foot);
  report.walkedFoot = foot;
  await sound();
  for (const width of [1280, 390]) {
    await page.setViewportSize({width,height:width===390?844:900});
    for (const [i,exit] of room.exits.entries()) {
      const touch = (i % 2 === 0) === (width === 390);
      const destination=exit.label.replace('Walk to ','');
      await closeFrame(page); await click('Walk');
      if(touch) {
        const pin=workshop.locator(`[data-graybox-object="exit:spec001:R02:${exit.toRoomId}"]`).first();
        await pin.tap();
        const choice=workshop.locator(`.nq-graybox-choices [data-graybox-object="exit:spec001:R02:${exit.toRoomId}"]`);
        if(await choice.count()) await choice.tap();
      } else await pressButton(page,exit.label);
      await expect(page.locator('.nq-game-location')).toHaveText(destination); report.destinations.push({destination,width,input:touch?'touch':'keyboard'});
      const adjacent=JSON.parse(await readFile('content/spec001/rooms/'+exit.toRoomId.slice(8)+'.json','utf8'));
      await click('Walk',adjacent.exits.find(e=>e.toRoomId==='spec001:R02').label);
      await expect(page.locator('.nq-game-location')).toHaveText("The Titan's Workshop"); await ready();
    }
  }
  // The Copperhead's encounter and demonstrated physical repair earn the invitation.
  await walk('The Copper Warrens'); await click('Look','Copperhead');
  await click('Use','Read and keep the supplied compatibility card','Read and keep the diagnosed-defect card; this is not a performed measurement'); await measure(false);
  await click('Use','Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
  await walk('The Echo Cavern');
  await click('Use','Read and keep the before-record instructions; retain an actual measured open result','Read and keep the repeater role and limits','Conclude: a repeater needs the physical connection restored'); await measure(true);
  await walk('The Copper Warrens'); await click('Party','Invite Copperhead Snake','Activate Copperhead Snake','Close party');
  await walk("The Titan's Workshop"); await ready(); await expect(workshop).toHaveAttribute('data-party-cast','spec001:CH04');
  await capture('active-copperhead',1280); await capture('active-copperhead',390);
  await click('Party','Rest Copperhead Snake','Close party'); await expect(workshop).toHaveAttribute('data-party-cast','');
  await click('Low detail scene'); await expect(workshop).toHaveAttribute('data-detail','low');
  report.lowDetail=await workshop.evaluate(e=>({...e.dataset}));
  await click('Text scene'); await expect(workshop).toHaveCount(0); await click('Look','Known-good endpoints');
  await click('Retry visual scene'); await ready(); await expect(page.locator('.nq-workshop-decoration')).toHaveCount(0);
  for(const b of room.mediaBindings.filter(b=>['room-architecture','character-placement','prop-placement','background','midground','foreground'].includes(b.use))) {
    const got=await files.get(b.exportPath);
    expect(got?.sha256,b.exportPath).toBe(hash(await readFile(b.exportPath)));
  }
  expect(report.errors).toEqual([]); report.status='passed';
} catch(error) { report.error=String(error); await page.screenshot({path:output+'/attempt.png'}); throw error; }
finally {
  report.requested=(await Promise.all(files.values())).filter(Boolean);
  await writeFile(output+'/browser.json',JSON.stringify(report,null,2)+'\n');
  await browser.close(); await new Promise(resolve=>server.httpServer.close(resolve));
}
