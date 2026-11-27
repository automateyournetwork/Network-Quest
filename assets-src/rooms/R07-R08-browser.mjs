// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Normal guest route; page actions, decoded resources, response hashes and comparison with the reopened Blender camera.
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clickButton, closeFrame, openFrame, pressButton } from '../../tests/e2e/support/adventure-controls.ts';

const out = process.argv[2] ?? '.local/T138/guest';
await mkdir(out, { recursive: true });
const read = async p => JSON.parse(await readFile(p, 'utf8'));
const base = '/arcade/play/network-quest/';
const dist = await mkdtemp(resolve('.local/test-results/T138-'));
await build({ logLevel:'silent', build:{ outDir:dist } });
const server = await preview({ configFile:false, base, build:{outDir:dist}, logLevel:'error', preview:{host:'127.0.0.1',port:0} });
const browser = await firefox.launch(), page = await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference',hasTouch:true});
page.setDefaultTimeout(8000);
const rooms = {}, comps = {}, cues = {}, surveys = {};
for (const code of ['R07','R08']) {
  rooms[code] = await read('content/spec001/rooms/'+code+'.json');
  comps[code] = await read('content/spec001/presentation/'+code+'.json');
  cues[code] = await read('content/spec001/presentation/'+code+'.audio.json');
  surveys[code] = await read('docs/evidence/spec001/final-rooms/T138/'+code+'/source-reopen.json');
}
const report = {browser:browser.version(), guest:true, captures:[], cues:[], audioReceipts:[], readings:[], party:[], partyResources:[], touch:[], conditions:[], received:[], errors:[]};
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
const labels=new Map((await read('content/spec001/dialogue/radio-actions.json')).records.flatMap(r=>r.nodes.flatMap(n=>n.choices.map(c=>[c.id.split('ACTION-radio-')[1],c.text]))));
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
  const last=await scene(code).getAttribute('data-render-count');
  await page.waitForTimeout(150);expect(await scene(code).getAttribute('data-render-count')).toBe(last);
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
const population=(await read('content/spec001/world.json')).characters;
const names=Object.fromEntries(population.map(ch=>[ch.shortId,ch.name]));
async function ally(id,command){await click('Party',command+' '+names[id],'Close party');}
try {
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+base);
  await click('New Adventure','Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await walk("The Titan's Workshop");await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Compare the observed signal and measured noise before and after changing the surveyed conditions.');
  await click('Pin hypothesis','Close notebook','Continue as guest');await walk('The Skywell');await ready('R07');
  const absent=async id=>await expect(page.locator('[data-asset-id="spec001:ASSET-'+id+'"]')).toHaveCount(0);
  const condition=async (code,key,value)=>await expect(scene(code).locator('.nq-room-stage')).toHaveAttribute(key,value);
  async function touchSubject(code,short) {
    const target=rooms[code].hotspots.find(h=>h.subjectId==='spec001:'+short);
    await click('Look');await tap(code,target.id);
    await expect(page.locator('.nq-shell-status')).toContainText(target.description.slice(0,24));
  }
  await absent('EFFECT-019');await absent('EFFECT-027');await condition('R07','data-antenna-yaw','0.00');
  for(const w of [1280,390]){
    await capture('R07','arrival',w);
    for(const id of ['CH07','PR061'])await touchSubject('R07',id);
  }
  await act('read-path');await act('read-settings');await act('align-existing');
  await condition('R07','data-antenna-yaw','-0.42');await sound('R07');
  await act('unalign-path');await condition('R07','data-antenna-yaw','0.00');
  await act('alternate-path');await condition('R07','data-antenna-yaw','0.53');await act('match-settings');await measure(true,[]);
  await click('Walk');await pressButton(page,rooms.R07.walkRegions[0].label);
  await expect(scene('R07')).toHaveAttribute('data-player-foot','4.000,0.000,5.500');
  // Observe the actual geometry projection during the first entry, before the sound panel opens.
  await page.evaluate(() => {
    window.shutterTravel = [];
    new MutationObserver(changes => {
      for (const change of changes) {
        const opening = change.target.getAttribute('data-shutter-separation');
        if (opening && !window.shutterTravel.includes(opening)) window.shutterTravel.push(opening);
      }
    }).observe(document.body,{subtree:true,attributes:true,attributeFilter:['data-shutter-separation']});
  });
  await walk('The Storm Observatory');await ready('R08');
  await absent('VOICE-010');await condition('R08','data-channel-pointer','A');await condition('R08','data-isolation-pointer-angle','0.00');
  await condition('R08','data-shutter-separation','1.10');
  report.shutterWidths = await page.evaluate(() => [...window.shutterTravel].map(Number));
  expect(Math.min(...report.shutterWidths)).toBeLessThan(.95);
  expect(report.shutterWidths).toContain(1.10);
  for(const w of [1280,390]){
    await capture('R08','arrival',w);
    for(const id of ['CH10','PR075','CH23','PR080'])await touchSubject('R08',id);
  }
  await act('read-survey');await measure(false,['Received noise: -78 dBm','Signal-to-noise ratio: 13 dB']);
  await act('mitigate-emitter');await condition('R08','data-isolation-pointer-angle','-1.10');
  await measure(true,['Received noise: -90 dBm','Signal-to-noise ratio: 25 dB']);
  await act('channel-B');await condition('R08','data-channel-pointer','B');
  await measure(false,['Received noise: -85 dBm','Signal-to-noise ratio: 20 dB']);
  await act('raise-noise');await condition('R08','data-isolation-pointer-angle','0.00');await sound('R08');
  await click('Walk');await pressButton(page,rooms.R08.walkRegions[0].label);
  await expect(scene('R08')).toHaveAttribute('data-player-foot','4.000,0.000,5.500');
  await verifyControls('R08');
  await walk('The Skywell');await ready('R07');await condition('R07','data-antenna-yaw','0.53');
  await ally('CH07','Invite');await ally('CH07','Activate');
  await click('Party');
  const survey=page.getByRole('dialog',{name:'Party',exact:true}).getByRole('button',{name:'Fresh radio observation after path/settings inspection: '+labels.get('read-path'),exact:true});
  await survey.press('Enter');await expect(page.locator('.nq-shell-status')).toContainText('Ally action applied');await click('Close party');
  await expect(scene('R07')).toHaveAttribute('data-last-ability-actor','spec001:ASSET-CH07');
  await expect(scene('R07')).toHaveAttribute('data-party-cast','');await sound('R07');await verifyControls('R07');
  report.conditions.push('Three committed path settings project three physical bearings. The Observatory channel and isolation pointers follow real controls. Resident Thunderbird plays its own survey animation.');
  await ally('CH07','Rest');await walk("The Titan's Workshop");
  const actions=new Map();
  for (const kind of ['fiber','copper','equipment']) for (const d of (await read('content/spec001/dialogue/'+kind+'-actions.json')).records)
    for(const n of d.nodes)for(const c of n.choices)actions.set(c.id.split('ACTION-')[1],c.text);
  const use=async id=>await click('Use',actions.get(id));
  const discover=async code=>{await click('Look');for(const h of (await read('content/spec001/rooms/'+code+'.json')).hotspots.filter(h=>h.subjectId.startsWith('spec001:CH')))await click(h.label);};
  await walk('The Copper Warrens');await discover('R03');await use('copper-read-compatibility');await use('copper-read-defect');await measure(false,[]);
  await use('copper-replace-section');await measure(true,[]);await walk('The Echo Cavern');await discover('R04');
  await use('copper-read-before');await use('copper-read-repeater');await use('copper-repeater-requires-continuity');await measure(true,[]);
  await ally('CH20','Invite');await walk('The Copper Warrens');await ally('CH04','Invite');await walk("The Titan's Workshop");
  await walk('The Photon Gardens');await discover('R05');
  for(const id of ['read-matching','restore-original','profile-matched','inspect-before','clean','reinspect-clean'])await use('fiber-'+id);
  await measure(true,[]);await ally('CH03','Invite');await walk('The Prism Vault');await discover('R06');await ally('CH16','Invite');
  await use('fiber-read-compatibility');await use('fiber-path-A');await measure(true,[]);await walk('The Photon Gardens');
  await ally('CH05','Invite');await ally('CH06','Invite');await click('Walk','Walk to The Titan’s Workshop');
  await walk('The Shell Market');await discover('R09');
  await use('market-read-checklist');await use('equipment-mode-100-full');await use('market-compatible-kit-B');await measure(true,[]);await ally('CH19','Invite');
  await walk("The Titan's Workshop");await walk('The Clockworks');await discover('R10');await ally('CH22','Invite');
  await click('Use','Read and record the physical-role and upper-layer explanation','Use untimed step-by-step decoding','Explain: sample physical signals representing bits; this does not discover addresses');
  for(const [i,pair] of ['00','10','11','01'].entries())await click('Inspect sample position '+i,'Write '+pair+' for sample position '+i);
  await measure(true,[]);await walk("The Titan's Workshop");await walk('The Skywell');
  let active=[];
  for(const code of ['R07','R08']){
    if(code==='R08')await walk('The Storm Observatory');
    for(const pair of [['CH03','CH04'],['CH05','CH06'],['CH07','CH16'],['CH19','CH20'],['CH22']]){
      for(const id of active)await ally(id,'Rest');for(const id of pair)await ally(id,'Activate');active=pair;
      await ready(code);const wanted=pair.map(id=>'spec001:'+id).filter(id=>!rooms[code].characterIds.includes(id)).sort();
      await expect(scene(code)).toHaveAttribute('data-party-cast',wanted.join(' '));
      const label=pair.join('-');await capture(code,label,1280);
      if(pair.includes('CH06')){
        await capture(code,'two-allies',390);await capture(code,'two-allies',1280);
        for (const target of (code==='R07'?['CH07','PR061']:['CH10','PR075','CH23','PR080']))await touchSubject(code,target);
      }
      report.party.push({code,active:pair,drawn:wanted});
    }
  }
  for(const width of [390,1280]){
    await page.setViewportSize({width,height:width===390?844:800});
    await ready('R08');await click('Walk');await tap('R08','exit:spec001:R08:spec001:R11');
    await expect(page.locator('.nq-game-location')).toHaveText('The Backhoe Rift');
    await click('Walk',(await read('content/spec001/rooms/R11.json')).exits.find(e=>e.toRoomId==='spec001:R08').label);
    await ready('R08');await click('Walk');await tap('R08','exit:spec001:R08:spec001:R07');
    await expect(page.locator('.nq-game-location')).toHaveText('The Skywell');
    await ready('R07');await click('Walk');await tap('R07','exit:spec001:R07:spec001:R02');
    await expect(page.locator('.nq-game-location')).toHaveText("The Titan's Workshop");
    await walk('The Skywell');await ready('R07');await click('Walk');await tap('R07','exit:spec001:R07:spec001:R08');
    await expect(page.locator('.nq-game-location')).toHaveText('The Storm Observatory');
  }
  for(const code of ['R07','R08'])expect(report.partyResources.filter(b=>b.room===code).map(b=>b.assetId).sort()).toEqual(rooms[code].mediaBindings.filter(b=>b.use==='party-placement').map(b=>b.assetId).sort());
  expect(report.cues.sort()).toEqual([...cues.R07,...cues.R08].map(c=>c.assetId).sort());expect(report.errors).toEqual([]);
  report.status='passed';
} catch(error) {
  report.status='failed';report.error=String(error);report.currentText=(await page.locator('body').innerText()).slice(-4000);await page.screenshot({path:out+'/attempt.png'});throw error;
} finally {
  await writeFile(out+'/guest.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.httpServer.close(r));
}
