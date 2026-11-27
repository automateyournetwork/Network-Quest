// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Normal guest route; page actions, decoded resources, response hashes and comparison with the reopened Blender camera.
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clickButton, closeFrame, openFrame } from '../../tests/e2e/support/adventure-controls.ts';

const out = process.argv[2] ?? '.local/T137/guest';
await mkdir(out, { recursive: true });
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const base = '/arcade/play/network-quest/';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
async function filesUnder(directory, pattern) {
  return (await readdir(directory,{recursive:true})).filter(path=>pattern.test(path)).sort();
}
async function digests(root,paths) {
  return Object.fromEntries(await Promise.all(paths.map(async path=>[path,digest(await readFile(resolve(root,path)))])));
}
const inputs=['index.html','package.json','package-lock.json','vite.config.ts','assets-src/rooms/R05-R06-browser.mjs'];
for(const [directory,pattern] of [['src',/\.(ts|css|json)$/],['content/spec001',/\.json$/],['specs/001-physical-layer-underworld/contracts',/\.json$/]]) {
  inputs.push(...(await filesUnder(directory,pattern)).map(path=>directory+'/'+path));
}
const source=await digests('.',inputs);
const dist = await mkdtemp(resolve('.local/test-results/T137-'));
await build({ logLevel:'silent', build:{ outDir:dist } });
expect(await digests('.',inputs)).toEqual(source);
const built=await digests(dist,await filesUnder(dist,/\.(html|css|js)$/));
const sourceSnapshot=JSON.stringify({source,built},null,2)+'\n';
await writeFile(out+'/guest-inputs.json',sourceSnapshot);
const server = await preview({ configFile:false, base, build:{outDir:dist}, logLevel:'error', preview:{host:'127.0.0.1',port:0} });
const browser = await firefox.launch(), page = await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference',hasTouch:true});
page.setDefaultTimeout(8000);
const rooms = {}, comps = {}, cues = {}, surveys = {};
for (const code of ['R05','R06']) {
  rooms[code] = await read('content/spec001/rooms/'+code+'.json');
  comps[code] = await read('content/spec001/presentation/'+code+'.json');
  cues[code] = await read('content/spec001/presentation/'+code+'.audio.json');
  surveys[code] = await read('docs/evidence/spec001/final-rooms/T137/'+code+'/source-reopen.json');
}
const report = {browser:browser.version(), guest:true, sourceSnapshot:{path:'guest-inputs.json',sha256:digest(sourceSnapshot)}, captures:[], cues:[], audioReceipts:[], readings:[], party:[], partyResources:[], touch:[], conditions:[], received:[], errors:[]};
const files=new Map(), hash=b=>createHash('sha256').update(b).digest('hex');
page.on('pageerror',e=>report.errors.push(e.message));
page.on('response',r=>{
  const path='public/'+new URL(r.url()).pathname.split(base)[1];
  if (!r.ok() || !path.startsWith('public/assets/')) return;
  if (!files.has(path)) files.set(path,[]);
  files.get(path).push(r.body().then(b=>({path,bytes:b.length,sha256:hash(b)})).catch(()=>null));
});
const scene = code => page.locator('.nq-room[data-room-id="spec001:'+code+'"]');
const click = async (...names) => {
  for (const name of names) {
    if (['Party','Diagnostics','Compendium'].includes(name)) await closeFrame(page);
    await clickButton(page,name);
  }
};
const labels=new Map((await read('content/spec001/dialogue/fiber-actions.json')).records.flatMap(r=>r.nodes.flatMap(n=>n.choices.map(c=>[c.id.split('ACTION-fiber-')[1],c.text]))));
const act = async key => { await click('Use',labels.get(key)); };
const walk=async name=>{await click('Walk','Walk to '+name);await expect(page.locator('.nq-game-location')).toHaveText(name);};
const ready = async code => {
  await closeFrame(page);
  await expect(scene(code)).toHaveAttribute('data-rendered','true',{timeout:20000});
  await expect(scene(code)).toHaveAttribute('data-presentation','layered');
};
async function capture(code,label,width) {
  await closeFrame(page);await page.setViewportSize({width,height:width===390?844:800});await ready(code);
  const s=scene(code);
  await expect.poll(()=>s.locator('canvas').evaluate(c=>Math.abs(c.width/c.height-c.clientWidth/c.clientHeight))).toBeLessThan(.01);
  const plate=await s.locator('.nq-room-background').boundingBox();let error=0;
  for (const a of surveys[code].anchors) {
    const box=await s.locator('.nq-room-pins [data-graybox-object="'+a.objectId+'"]').boundingBox();
    error=Math.max(error,Math.hypot(box.x+box.width/2-plate.x-a.uv[0]*plate.width,box.y+box.height/2-plate.y-a.uv[1]*plate.height));
  }
  expect(error).toBeLessThan(1.3);
  const el=await s.evaluate(e=>({...e.dataset}));const stage=await s.boundingBox();
  if (label==='arrival') {
    expect(el.modelCount).toBe(String(comps[code].models.length));
    expect(el.animatedActors).toBe(String(comps[code].models.filter(m=>m.character).length));
    for (const {assetId} of [...comps[code].models,...comps[code].layers]) {
      const binding=rooms[code].mediaBindings.find(b=>b.assetId===assetId);
      const b=await readFile(binding.exportPath), matches=await Promise.all(files.get(binding.exportPath)??[]);
      expect(matches.some(r=>r?.sha256===hash(b)),binding.exportPath).toBe(true);
      if (!report.received.some(r=>r.room===code && r.assetId===assetId)) report.received.push({room:code,...binding,bytes:b.length,sha256:hash(b)});
    }
  }
  for(const id of (el.partyCast || '').split(' ').filter(Boolean)) {
    const b=rooms[code].mediaBindings.find(b=>b.use==='party-placement' && b.assetId===id.replace(':',':ASSET-'));
    const bytes=await readFile(b.exportPath), matches=await Promise.all(files.get(b.exportPath)??[]);
    expect(matches.some(r=>r?.sha256===hash(bytes)),b.exportPath).toBe(true);
    if(!report.partyResources.some(r=>r.room===code && r.assetId===b.assetId))report.partyResources.push({room:code,...b,bytes:bytes.length,sha256:hash(bytes),capture:label});
  }
  await page.screenshot({path:out+'/'+code+'-'+label+'-'+width+'.png'});
  report.captures.push({code,label,width,stage,plate,maximumAnchorError:error,runtime:el});
}
async function sound(code) {
  await openFrame(page,'Sound and reading');
  for (const cue of cues[code]) {
    if (report.cues.includes(cue.assetId)) continue;
    const row=page.locator('.nq-media-cue[data-asset-id="'+cue.assetId+'"]:visible');
    if (!(await row.isVisible())) continue;
    await expect(row).toContainText(cue.text);
    await row.getByRole('button',{name:/^Replay /}).click();
    await expect(row).toHaveAttribute('data-audio-status',/^(playing|ended)$/);
    await row.getByRole('button',{name:/^Skip /}).click();await expect(row).toHaveAttribute('data-audio-status','stopped');
    report.cues.push(cue.assetId);
    const bytes=await readFile(cue.exportPath),matches=await Promise.all(files.get(cue.exportPath)??[]);
    report.audioReceipts.push({room:code,assetId:cue.assetId,path:cue.exportPath,bytes:bytes.length,sha256:hash(bytes),
      matchedFullResponse:matches.some(r=>r?.sha256===hash(bytes)),caption:cue.text,trigger:cue.trigger,replay:'playing or ended',skip:'stopped'});
  }
  await closeFrame(page);
}
async function measure(submit,expected) {
  await click('Diagnostics','Take measurement');
  const diag=page.getByRole('dialog',{name:'Diagnostics',exact:true}),latest=diag.locator('ol[aria-label="Recorded measurements"] > li').last();
  for(const text of expected) await expect(latest).toContainText(text);
  report.readings.push(await latest.locator(':scope > p').innerText());
  if(submit){await latest.getByRole('button',{name:'Submit this reading',exact:true}).click();await expect(diag).toContainText('Objective complete.');}
  await click('Close diagnostics');
}
async function verifyControls(code) {
  const items=()=>page.locator('.nq-shell-objects button').evaluateAll(els=>els.map(e=>[e.textContent,e.getAttribute('aria-disabled')]));
  const before=await items();await click('Text scene');expect(await items()).toEqual(before);
  await click('Low detail scene');await expect(scene(code)).toHaveAttribute('data-detail','low');expect(await items()).toEqual(before);
  report.conditions.push({code,textAndLowControls:before.length,low:await scene(code).evaluate(e=>({...e.dataset}))});
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(scene(code)).toHaveAttribute('data-animated-actors','0');
  await expect.poll(async () => {
    const start=await scene(code).getAttribute('data-render-count');
    await page.waitForTimeout(220);
    return start===await scene(code).getAttribute('data-render-count');
  }).toBe(true);
  await closeFrame(page);
  await scene(code).locator('canvas').evaluate(c=>c.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect(scene(code)).toHaveCount(0);await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
  expect(await items()).toEqual(before);
  report.conditions.at(-1).reducedMotionAndContextLoss='Static art settled, WebGL context was lost, full semantic actions remained.';
  await click('Retry visual scene');await ready(code);
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(scene(code)).toHaveAttribute('data-reduced-motion','false');
}
async function tap(code,id) {
  await closeFrame(page);const s=scene(code),pin=s.locator('.nq-room-pins [data-graybox-object="'+id+'"]');
  await pin.tap(); const choice=s.locator('.nq-graybox-choices [data-graybox-object="'+id+'"]');
  if(await choice.count())await choice.tap();
  report.touch.push({code,id,width:page.viewportSize().width});
}
const names=Object.fromEntries((await read('content/spec001/world.json')).characters.map(c=>[c.shortId,c.name]));
async function ally(id,command){await click('Party',command+' '+names[id],'Close party');}
async function ability(id,name,key) {
  await click('Party');
  const control=page.getByRole('dialog',{name:'Party',exact:true}).getByRole('button',{name:name+': '+labels.get(key),exact:true});
  await expect(control).toBeEnabled();await control.press('Enter');
  await expect(page.locator('.nq-shell-status')).toContainText('Ally action applied');await click('Close party');
}
try {
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+base);
  await click('New Adventure','Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await walk("The Titan's Workshop");await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare the selected optical pair and inspect the connection before changing it.');
  await click('Pin hypothesis','Close notebook','Continue as guest');await walk('The Photon Gardens');await ready('R05');
  await expect(page.locator('[data-asset-id="spec001:ASSET-EFFECT-017"]')).toHaveCount(0);
  for (const w of [1280,390])await capture('R05','arrival',w);
  await click('Look','Multimode Hydra','Single-Mode Unicorn','Photon the Firefly','Connector inspection dock','Optical patch shelf and profile cards');
  await click('Walk',rooms.R05.walkRegions[0].label);await closeFrame(page);await expect(scene('R05')).toHaveAttribute('data-player-foot','4.000,0.000,5.500');
  await act('read-matching');await act('profile-matched');await act('inspect-before');await act('clean');await act('reinspect-clean');
  await measure(true,['Preparation complete: 1 count']);
  await ally('CH03','Invite');await ally('CH03','Activate');await act('restore-original');
  await ability('CH03','Optical inspection and compatible connection checklist','inspect-before');
  await expect(scene('R05')).toHaveAttribute('data-last-ability-actor','spec001:ASSET-CH03');
  await expect(scene('R05')).toHaveAttribute('data-party-cast','');
  report.party.push('Active resident Photon played inspection without an additional rig in R05.');
  await act('clean');await act('reinspect-clean');await sound('R05');
  await walk('The Prism Vault');await ready('R06');await expect(scene('R06')).toHaveAttribute('data-party-cast','spec001:CH03');
  for(const w of [1280,390]) {
    await capture('R06','arrival',w);
    await click('Look');await tap('R06','spec001:HOTSPOT-fiber-r06-pr058');
    await expect(page.locator('.nq-shell-status')).toContainText(/filter|transparent|walking entrance/i);
    await click('Walk');await tap('R06','exit:spec001:R06:spec001:R11');await expect(page.locator('.nq-game-location')).toHaveText('The Prism Vault');
    await expect(scene('R06').locator('.nq-graybox-choices')).toContainText('The requirements for this exit are not yet complete.');
  }
  await click('Look','SFP Hermit Crab','Link budget abacus','Receiver threshold gauge');await act('filter-shutter');await act('read-compatibility');
  await expect(page.locator('[data-asset-id="spec001:ASSET-EFFECT-034"]')).toHaveCount(0);
  await act('path-high-loss');await measure(false,['Receive power: -13 dBm','Sensitivity reserve: 1 dB']);await sound('R06');
  await act('path-A');await measure(true,['Receive power: -11 dBm','Sensitivity reserve: 3 dB']);
  await ally('CH16','Invite');await ally('CH16','Activate');await verifyControls('R06');
  await walk('The Photon Gardens');await ready('R05');await expect(scene('R05')).toHaveAttribute('data-party-cast','spec001:CH16');
  await ally('CH05','Invite');await ally('CH06','Invite');await ally('CH03','Rest');await ally('CH05','Activate');
  await act('restore-original');await ability('CH05','Inspection of a declared compatible single-mode profile','profile-matched');
  await act('inspect-before');await act('clean');await act('reinspect-clean');await sound('R05');
  await ally('CH16','Rest');await ally('CH06','Activate');await ally('CH06','Begin practice with');
  await walk('The Prism Vault');await act('path-B');await measure(false,['Receive power: -12 dBm','Sensitivity reserve: 2 dB']);
  await ally('CH06','Review lesson with');await ready('R06');
  await expect(scene('R06')).toHaveAttribute('data-party-cast','spec001:CH05 spec001:CH06');
  for(const w of [1280,390])await capture('R06','two-allies',w);
  await walk('The Photon Gardens');await ready('R05');await expect(scene('R05')).toHaveAttribute('data-party-cast','');
  await ability('CH06','Modes, not payload lanes','read-matching');await sound('R05');await verifyControls('R05');
  report.party.push('Both resident models collapse in R05 and both earned external rigs instantiate in R06.');
  await click('Walk','Walk to The Titan’s Workshop');await walk('The Shell Market');
  await click('Look','Electric Eel');await click('Use','Read and record all separate equipment checks','Select 100/full','Choose complete kit B: 12 W + 11 W + 7 W');await measure(true,[]);
  await click('Party','Invite Electric Eel','Rest Multimode Hydra','Activate SFP Hermit Crab','Rest Single-Mode Unicorn','Activate Electric Eel','Close party');
  await walk("The Titan's Workshop");await walk('The Clockworks');
  await click('Use','Read and record the physical-role and upper-layer explanation','Use untimed step-by-step decoding','Explain: sample physical signals representing bits; this does not discover addresses');
  for(const [i,pair] of ['00','10','11','01'].entries())await click('Inspect sample position '+i,'Write '+pair+' for sample position '+i);
  await measure(true,[]);await walk("The Titan's Workshop");await walk('The Photon Gardens');await ready('R05');
  await expect(scene('R05')).toHaveAttribute('data-party-cast','spec001:CH16 spec001:CH19');
  for(const w of [1280,390]) await capture('R05','two-allies',w);
  await walk('The Prism Vault');
  for(const width of [1280,390]) {
    await page.setViewportSize({width,height:width===390?844:800});await ready('R06');await click('Walk');
    await tap('R06','exit:spec001:R06:spec001:R11');await expect(page.locator('.nq-game-location')).toHaveText('The Backhoe Rift');
    await click('Walk',(await read('content/spec001/rooms/R11.json')).exits.find(e=>e.toRoomId==='spec001:R06').label);
  }
  await capture('R06','market-party',1280);
  const workshopFromGarden=()=>click('Walk','Walk to The Titan’s Workshop');
  const pairVisit=async (label, ids)=>{
    await walk('The Photon Gardens');
    for (const [code, target] of [['R05',null], ['R06','The Prism Vault']]) {
      if(target) await walk(target);
      await ready(code);
      await expect(scene(code)).toHaveAttribute('data-party-cast',ids.map(id=>'spec001:'+id).sort().join(' '));
      await capture(code,label,1280);
    }
    await walk('The Photon Gardens');await workshopFromGarden();
  };
  await walk('The Photon Gardens');await workshopFromGarden();
  await walk('The Copper Warrens');await click('Look','Copperhead');
  await click('Use','Read and keep the supplied compatibility card','Read and keep the diagnosed-defect card; this is not a performed measurement');await measure(false,[]);
  await click('Use','Fit the supplied replacement section: 85 m + 10 m');await measure(true,[]);
  await walk('The Echo Cavern');await click('Look','Echo Bat');
  await click('Use','Read and keep the before-record instructions; retain an actual measured open result','Read and keep the repeater role and limits','Conclude: a repeater needs the physical connection restored');await measure(true,[]);
  await ally('CH20','Invite');await walk('The Copper Warrens');await ally('CH04','Invite');
  await ally('CH16','Rest');await ally('CH19','Rest');await ally('CH04','Activate');await ally('CH20','Activate');
  await walk("The Titan's Workshop");await pairVisit('copper-party',['CH04','CH20']);
  await walk('The Skywell');await click('Look','Thunderbird');
  await click('Use','Keep the path survey in the notebook','Keep the endpoint settings card','Select the alternate surveyed path','Match both endpoint band, channel and PHY settings');await measure(true,[]);
  await walk('The Storm Observatory');
  await click('Use','Keep the survey and freshness instructions','Isolate the local emitter and return to surveyed conditions','Select fictional scenario channel B at both endpoints');await measure(true,[]);
  await walk('The Skywell');await ally('CH07','Invite');await walk("The Titan's Workshop");
  await walk('The Clockworks');await click('Look','Chameleon');await ally('CH22','Invite');
  await ally('CH04','Rest');await ally('CH20','Rest');await ally('CH07','Activate');await ally('CH22','Activate');
  await walk("The Titan's Workshop");await pairVisit('radio-clockwork-party',['CH07','CH22']);
  for (const code of ['R05','R06']) {
    const actual=report.partyResources.filter(b=>b.room===code).map(b=>b.assetId).sort();
    expect(actual).toEqual(rooms[code].mediaBindings.filter(b=>b.use==='party-placement').map(b=>b.assetId).sort());
  }
  expect(report.cues.sort()).toEqual([...cues.R05,...cues.R06].map(c=>c.assetId).sort());expect(report.errors).toEqual([]);
  report.status='passed';
} catch(error) {
  report.status='failed';report.error=String(error);report.currentText=(await page.locator('body').innerText()).slice(-4000);await page.screenshot({path:out+'/attempt.png'});throw error;
} finally {
  await writeFile(out+'/guest.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.httpServer.close(r));
}
