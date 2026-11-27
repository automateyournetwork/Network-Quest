// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Normal guest route; page actions, decoded resources, response hashes and comparison with the reopened Blender camera.
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clickButton, closeFrame, openFrame } from '../../tests/e2e/support/adventure-controls.ts';

const out = process.argv[2] ?? '.local/T139/guest';
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
const inputs=['index.html','package.json','package-lock.json','vite.config.ts','assets-src/rooms/R09-R10-browser.mjs'];
for(const [directory,pattern] of [['src',/\.(ts|css|json)$/],['content/spec001',/\.json$/],['specs/001-physical-layer-underworld/contracts',/\.json$/]]) {
  inputs.push(...(await filesUnder(directory,pattern)).map(path=>directory+'/'+path));
}
const source=await digests('.',inputs);
const dist = await mkdtemp(resolve('.local/test-results/T139-'));
await build({ logLevel:'silent', build:{ outDir:dist } });
expect(await digests('.',inputs)).toEqual(source);
const built=await digests(dist,await filesUnder(dist,/\.(html|css|js)$/));
const sourceSnapshot=JSON.stringify({source,built},null,2)+'\n';
await writeFile(out+'/guest-inputs.json',sourceSnapshot);
const server = await preview({ configFile:false, base, build:{outDir:dist}, logLevel:'error', preview:{host:'127.0.0.1',port:0} });
const browser = await firefox.launch(), page = await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference',hasTouch:true});
page.setDefaultTimeout(8000);
const rooms = {}, comps = {}, cues = {}, surveys = {};
for (const code of ['R09','R10']) {
  rooms[code] = await read('content/spec001/rooms/'+code+'.json');
  comps[code] = await read('content/spec001/presentation/'+code+'.json');
  cues[code] = await read('content/spec001/presentation/'+code+'.audio.json');
  surveys[code] = await read('docs/evidence/spec001/final-rooms/T139/'+code+'/source-reopen.json');
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
const labels=new Map((await read('content/spec001/dialogue/equipment-actions.json')).records.flatMap(r=>r.nodes.flatMap(n=>n.choices.map(c=>[c.id.split('ACTION-')[1],c.text]))));
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
  await expect(page.locator('[data-scene-object] details')).toHaveCount(0);
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
  await expect(scene(code)).toHaveCount(0);await expect(page.locator('[data-scene-object] details')).toHaveCount(0);await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
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
  await expect(scene(id === 'CH19' ? 'R09' : 'R10')).toHaveAttribute('data-last-ability-actor','spec001:ASSET-'+id);
}
async function inspect(code, bench, w) {
  await page.setViewportSize({width:w,height:w===390?844:800});await openFrame(page,'Scene');
  const gpuBefore = await scene(code).evaluate(e=>({geometryCount:e.dataset.geometries,textureCount:e.dataset.textures}));
  const row=page.locator('[data-scene-object="spec001:HOTSPOT-'+bench+'"]');
  await row.locator('summary').press('Enter');
  const canvas=row.getByRole('img');await expect(canvas).toBeVisible();
  await row.locator('details').scrollIntoViewIfNeeded();
  const pixels=await canvas.evaluate(c=>{
    const data=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
    let count=0;for(let i=0;i<data.length;i+=4)if(Math.abs(data[i]-data[0])+Math.abs(data[i+1]-data[1])+Math.abs(data[i+2]-data[2])>30)count++;
    return count;
  });
  expect(pixels).toBeGreaterThan(3000);
  if(['market-injector','market-qsfp','market-counter','clockworks-wheel'].includes(bench)){
    await page.screenshot({path:out+'/'+code+'-'+bench+'-'+w+'.png'});
  }
  const gpuAfter = await scene(code).evaluate(e=>({geometryCount:e.dataset.geometries,textureCount:e.dataset.textures}));
  report.closeups.push({code,bench,w,distinctForegroundPixels:pixels,staticCanvasBytes:648*360*4,gpuBefore,gpuAfter});
  expect(gpuAfter).toEqual(gpuBefore);
  if(w===390){
    await row.locator('summary').press('Enter');await expect(row.locator('canvas')).toHaveCount(0);await expect(row.locator('summary')).toBeFocused();await closeFrame(page);
  } else {
    await closeFrame(page);await expect(row.locator('canvas')).toHaveCount(0);
  }
}
report.closeups=[];
const writes=[];
page.on('request',r=>{if (r.method()!=='GET' && /\/api\/v1\/save/.test(r.url()))writes.push(r.method());});
const demo=(await read('content/spec001/dialogue/equipment-voices.json')).records.find(r=>r.id.endsWith('market-bench')).nodes[0].choices;
const perform=async (key)=>{await click('Use',demo.find(x=>x.id.endsWith(key)).text);};
const wall=page.locator('.nq-game-stage img[data-illustration="spec001:ASSET-ILLUSTRATION-18"]');
const use=async (...actions)=>{await click('Use',...actions);};
const choose=async (code,id,regex)=>{
  await click('Look');await tap(code,'spec001:HOTSPOT-'+id);
  await expect(page.locator('.nq-shell-status')).toContainText(regex);
};
const visit=async (code)=>{await walk(code==='R09'?'The Shell Market':'The Clockworks');await ready(code);};
const home=async()=>{await walk("The Titan's Workshop");};

const partyVisit=async(ids,label)=>{
 for(const code of ['R09','R10']){
   await visit(code); const extra=ids.filter(id=>!rooms[code].characterIds.includes('spec001:'+id)).map(id=>'spec001:'+id).sort().join(' ');
   await expect(scene(code)).toHaveAttribute('data-party-cast',extra);
   await capture(code,label,1280);
   await home();
 }
};
try {
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+base);
  await click('New Adventure','Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await home();await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare the stated module profile and delivered budget, then examine the sampling positions.');
  await click('Pin hypothesis','Close notebook','Continue as guest');await expect(wall).toHaveCount(0);
  await visit('R09');
  for(const w of [1280,390]) {
    await capture('R09','arrival',w);await choose('R09','market-qsfp',/module and host profiles/);await choose('R09','market-endpoints',/12 W, 11 W and 10 W/);
    await choose('R09','market-counter',/Borrow either complete kit/);
    await click('Walk');await tap('R09','exit:spec001:R09:spec001:R02');await expect(page.locator('.nq-game-location')).toHaveText("The Titan's Workshop");await visit('R09');
  }
  await expect(page.locator('[data-asset-id="spec001:ASSET-VOICE-054"]')).toHaveCount(0);
  await expect(page.locator('[data-asset-id="spec001:ASSET-VOICE-060"]')).toHaveCount(0);
  await click('Look','SFP test cage','QSFP test cage','Loan counter','Delivered-power injector','Electric Eel');await click('Talk','SFP Hermit Crab');
  for(const bench of ['market-sfp','market-qsfp','market-injector','market-endpoints','market-telephone','market-counter']) await inspect('R09',bench,390);
  await inspect('R09','market-counter',1280);
  await perform('market-seat-sample');
  await use('Read and record all separate equipment checks','Read the fictional delivered-power profile and compare the original proposal with both kits.','Select 100/full','Inspect the original 12 W + 11 W + 10 W proposal');
  await measure(false,['Total delivered demand: 33 W','Delivered budget: 30 W','Delivered excess: 3 W']);
  await use('Choose complete kit A: 12 W + 11 W');await perform('market-assemble-A');await measure(false,['Total delivered demand: 23 W']);
  await use('Choose complete kit B: 12 W + 11 W + 7 W');await click('Loan counter');await measure(true,['Total delivered demand: 30 W','Delivered headroom: 0 W']);await sound('R09');
  await ally('CH19','Invite');await ally('CH19','Activate');
  await ability('CH19','Delivered-power budget inspection','market-read-power');
  await ally('CH19','Begin practice with');await use('Inspect the original 12 W + 11 W + 10 W proposal');await measure(false,['Delivered excess: 3 W']);await use('Choose complete kit B: 12 W + 11 W + 7 W');await measure(false,['Delivered headroom: 0 W']);await ally('CH19','Review lesson with');
  await click('Open Energy audit','Audit the three-card ledger');
  const activity=page.getByRole('dialog',{name:'Optional activity',exact:true});
  await activity.getByRole('combobox').selectOption('over-budget');await activity.getByRole('spinbutton').fill('3');
  await click('Check the audit');await expect(activity).toContainText('proposal remains over budget');await click('Close the ledger');
  await sound('R09');await verifyControls('R09');await home();await expect(wall).toBeVisible();await page.screenshot({path:out+'/R02-earned-ledger.png'});
  await ally('CH19','Rest');await visit('R10');
  await expect(scene('R10')).toHaveAttribute('data-party-cast','');
  for(const w of [1280,390]) {
    await capture('R10','arrival',w);await choose('R10','clockworks-wheel',/no timing score/i);await choose('R10','clockworks-console',/1000\/full/);
    await choose('R10','clockworks-gate',/preparation/);await click('Walk');await tap('R10','exit:spec001:R10:spec001:R11');
    await expect(scene('R10').locator('.nq-graybox-choices')).toContainText('The requirements for this exit are not yet complete.');
  }
  await expect(page.locator('[data-asset-id="spec001:ASSET-VOICE-012"]')).toHaveCount(0);
  for(const bench of ['clockworks-wheel','clockworks-console','clockworks-samples'])await inspect('R10',bench,390);
  await inspect('R10','clockworks-wheel',1280);
  await click('Look','Master timing wheel','Chameleon');await use('Read and record the physical-role and upper-layer explanation','Use untimed step-by-step decoding','Explain: sample physical signals representing bits; this does not discover addresses');
  for(const [i,pair] of ['00','10','11','01'].entries())await click('Inspect sample position '+i,'Write '+pair+' for sample position '+i);
  await measure(true,['Represented bits: 8 bit','Symbols decoded: 4 symbol']);await ally('CH22','Invite');await ally('CH22','Activate');await ally('CH19','Activate');await ability('CH22','Common advertised capability inspection','equipment-mode-100-full');await sound('R10');
  await verifyControls('R10');await home();
  await partyVisit(['CH19','CH22'],'clock-eel-party');
  await walk('The Photon Gardens');await click('Look','Photon the Firefly','Single-Mode Unicorn','Multimode Hydra');
  await use('Read and keep all five supplied compatibility checks','Select the supplied fully matching optic/fiber pair: all five fields match','Inspect the original connection at the dock before any intervention','Have the dock fit the supplied compatible replacement to the inspected connection','Reinspect the replaced connection to confirm the diagnosed defect was removed');await measure(true,[]);
  await ally('CH03','Invite');await walk('The Prism Vault');await click('Look','SFP Hermit Crab');
  await use('Read and keep the current compatibility and inspection reminder','Select passive path A: total loss 8 dB');await measure(true,[]);await ally('CH16','Invite');await walk('The Photon Gardens');await ally('CH05','Invite');await ally('CH06','Invite');
  await ally('CH19','Rest');await ally('CH22','Rest');await ally('CH05','Activate');await ally('CH06','Activate');await click('Walk','Walk to The Titan’s Workshop');
  for(const code of ['R09','R10']) {
    await visit(code);
    await expect(scene(code)).toHaveAttribute('data-party-cast','spec001:CH05 spec001:CH06');
    for(const w of [1280,390]) {
      await capture(code,'two-allies',w);
      for(const h of rooms[code].hotspots.filter(h=>h.subjectId.includes(':CH'))) {
        await choose(code,h.id.split('HOTSPOT-')[1],h.description.slice(0,25));
      }
      await click('Walk',rooms[code].walkRegions[0].label);await closeFrame(page);
      await expect(scene(code)).toHaveAttribute('data-player-foot',code==='R09'?'6.300,0.000,5.400':'5.600,0.000,4.100');
      if(code==='R10') {
        await click('Walk');await tap(code,'exit:spec001:R10:spec001:R11');await expect(page.locator('.nq-game-location')).toHaveText('The Backhoe Rift');
        await click('Walk',(await read('content/spec001/rooms/R11.json')).exits.find(e=>e.toRoomId==='spec001:R10').label);
      }
    }
    await home();
  }
  await ally('CH05','Rest');await ally('CH06','Rest');await ally('CH03','Activate');await ally('CH16','Activate');await partyVisit(['CH03','CH16'],'photon-hermit-party');
  await walk('The Copper Warrens');await click('Look','Copperhead');await use('Read and keep the supplied compatibility card','Read and keep the diagnosed-defect card; this is not a performed measurement');await measure(false,[]);await use('Fit the supplied replacement section: 85 m + 10 m');await measure(true,[]);
  await walk('The Echo Cavern');await click('Look','Echo Bat');await use('Read and keep the before-record instructions; retain an actual measured open result','Read and keep the repeater role and limits','Conclude: a repeater needs the physical connection restored');await measure(true,[]);await ally('CH20','Invite');await walk('The Copper Warrens');await ally('CH04','Invite');
  await ally('CH03','Rest');await ally('CH16','Rest');await ally('CH04','Activate');await ally('CH20','Activate');await home();await partyVisit(['CH04','CH20'],'copper-party');
  await walk('The Skywell');await click('Look','Thunderbird');await use('Keep the path survey in the notebook','Keep the endpoint settings card','Select the alternate surveyed path','Match both endpoint band, channel and PHY settings');await measure(true,[]);await walk('The Storm Observatory');await use('Keep the survey and freshness instructions','Isolate the local emitter and return to surveyed conditions','Select fictional scenario channel B at both endpoints');await measure(true,[]);await walk('The Skywell');await ally('CH07','Invite');await ally('CH04','Rest');await ally('CH20','Rest');await ally('CH07','Activate');await home();await partyVisit(['CH07'],'skywell-party');
  for(const code of ['R09','R10']){
   expect(report.partyResources.filter(r=>r.room===code).map(r=>r.assetId).sort()).toEqual(rooms[code].mediaBindings.filter(b=>b.use==='party-placement').map(b=>b.assetId).sort());
  }
  expect(report.cues.sort()).toEqual([...cues.R09,...cues.R10].map(c=>c.assetId).sort());expect(report.errors).toEqual([]);expect(writes).toEqual([]);
  report.quest='Full SQ02 submitted after actual level-2 Electric Eel lesson; the returned Workshop displayed the earned wall ledger.';report.saveWrites=writes;
  report.status='passed';
} catch(error) {
  report.status='failed';report.error=String(error);report.currentText=(await page.locator('body').innerText()).slice(-4600);await page.screenshot({path:out+'/attempt.png'});throw error;
} finally {
  await writeFile(out+'/guest.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.httpServer.close(r));
}
