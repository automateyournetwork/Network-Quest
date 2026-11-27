// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Normal guest route; page actions, decoded resources, response hashes and comparison with the reopened Blender camera.
import { firefox, expect } from '@playwright/test';
import { build, preview } from 'vite';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { clickButton, closeFrame, openFrame } from '../../tests/e2e/support/adventure-controls.ts';

const branch = process.argv[3] ?? 'copper';
const out = process.argv[2] ?? '.local/T140/guest';
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
const inputs=['tests/e2e/support/adventure-controls.ts','index.html','package.json','package-lock.json','vite.config.ts','assets-src/rooms/R11-R12-browser.mjs'];
for(const [directory,pattern] of [['src',/\.(ts|js|css|json)$/],['content/spec001',/\.json$/],['specs/001-physical-layer-underworld/contracts',/\.json$/]]) {
  inputs.push(...(await filesUnder(directory,pattern)).map(path=>directory+'/'+path));
}
const source=await digests('.',inputs);
const dist = await mkdtemp(resolve('.local/test-results/T140-'));
await build({ logLevel:'silent', build:{ outDir:dist } });
expect(await digests('.',inputs)).toEqual(source);
const built=await digests(dist,await filesUnder(dist,/\.(html|css|js)$/));
const sourceSnapshot=JSON.stringify({source,built},null,2)+'\n';
await writeFile(out+'/guest-inputs.json',sourceSnapshot);
const server = await preview({ configFile:false, base, build:{outDir:dist}, logLevel:'error', preview:{host:'127.0.0.1',port:0} });
const browser = await firefox.launch(), page = await browser.newPage({viewport:{width:1280,height:800},reducedMotion:'no-preference',hasTouch:true});
page.setDefaultTimeout(8000);
const rooms = {}, comps = {}, cues = {}, surveys = {};
for (const code of ['R11','R12']) {
  rooms[code] = await read('content/spec001/rooms/'+code+'.json');
  comps[code] = await read('content/spec001/presentation/'+code+'.json');
  cues[code] = await read('content/spec001/presentation/'+code+'.audio.json');
  surveys[code] = await read('docs/evidence/spec001/final-rooms/T140/'+code+'/source-reopen.json');
}
const report = {browser:browser.version(), guest:true, sourceSnapshot:{path:'guest-inputs.json',sha256:digest(sourceSnapshot)}, captures:[], cues:[], audioReceipts:[], readings:[], party:[], partyResources:[], touch:[], conditions:[], endings:[], routes:[], branch, received:[], errors:[]};
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
    if (['Party','Diagnostics','Compendium','Repair plan','Validate repair'].includes(name)) await closeFrame(page);
    await clickButton(page,name);
  }
};
const walk=async (name,label='Walk to '+name)=>{await click('Walk',label);await expect(page.locator('.nq-game-location')).toHaveText(name);};
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
async function sound(code, terminal) {
  const embedded = terminal?.locator('.nq-ending-sound');
  if(embedded) await embedded.press('Enter');
  else await openFrame(page,'Sound and reading');
  const nested=page.locator('.nq-frame-window[aria-label="Sound and reading"]');
  await expect(nested).toHaveAttribute('aria-modal','true');
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
  if(embedded) {
    await page.keyboard.press('Escape');
    await expect(terminal).toHaveAttribute('aria-modal','true');await expect(embedded).toBeFocused();
    await page.keyboard.press('Tab');expect(await terminal.evaluate(e=>e.contains(document.activeElement))).toBe(true);
  } else await closeFrame(page);
}
async function measure(submit,expected=[]) {
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
const dlg=name=>page.getByRole('dialog',{name,exact:true});
const roomNames=Object.fromEntries((await read('content/spec001/world.json')).rooms.map(r=>[r.shortId,r.name]));
const pathButton=(code,destination)=>rooms[code].exits.find(e=>e.toRoomId==='spec001:'+destination).label;
const outcomeCodes={permanent:'E01',temporary:'E02',shutdown:'E03'};
const outcomeTitles={permanent:'The Steady Light',temporary:'The Borrowed Dawn',shutdown:'The Honest Shutdown'};
const absent=async ids=>{
  for(const id of ids)await expect(page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-'+id+'"]')).toHaveCount(0);
};
const allEndings=['VOICE-015','VOICE-016','VOICE-017','VOICE-018','VOICE-032','VOICE-033','VOICE-034','VOICE-046','VOICE-047','VOICE-048','MUSIC-epilogue'];
const check=async label=>page.getByRole('checkbox',{name:label,exact:true}).check();
async function prepare(){
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+base);
  await click('New Adventure','Look','Look at power indication','Look at link indication','Talk','Talk to Photon the Firefly','Skip dialogue','Use','Inspect physical path');
  await walk("The Titan's Workshop");await click('Talk','Talk to the Titan','Skip dialogue','Look','Identify known-good endpoints','Identify physical path under test','Notebook');
  await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Test the physical route and repeat the endpoint service test.');
  await click('Pin hypothesis');await page.getByRole('textbox',{name:'Personal notes',exact:true}).fill('Keep the work slip during preparation.');
  await click('Close notebook','Continue as guest');
    if (branch === 'copper' || branch === 'fiber') {
      await walk('The Copper Warrens'); await click('Look','Copperhead','Use'); await click('Read and keep the supplied compatibility card');
      await click('Read and keep the diagnosed-defect card; this is not a performed measurement'); await measure(false);
      await click('Use'); await click('Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
      await walk('The Echo Cavern'); await click('Look','Echo Bat','Use'); await click('Read and keep the before-record instructions; retain an actual measured open result');
      await click('Read and keep the repeater role and limits'); await click('Conclude: a repeater needs the physical connection restored'); await measure(true);
      if(branch==='fiber') await ally('CH20','Invite');
      await walk('The Copper Warrens');if(branch==='fiber')await ally('CH04','Invite'); await walk("The Titan's Workshop");
    }
    if (branch === 'fiber') {
      await walk('The Photon Gardens'); await click('Look','Single-Mode Unicorn','Multimode Hydra','Photon the Firefly','Use'); await click('Read and keep all five supplied compatibility checks');
      await click('Select the supplied fully matching optic/fiber pair: all five fields match'); await click('Inspect the original connection at the dock before any intervention');
      await click('Have the dock fit the supplied compatible replacement to the inspected connection');
      await click('Reinspect the replaced connection to confirm the diagnosed defect was removed'); await measure(true);
      await ally('CH03','Invite');await walk('The Prism Vault'); await click('Look','SFP Hermit Crab','Use'); await click('Read and keep the current compatibility and inspection reminder');
      await click('Select passive path B: total loss 9 dB'); await measure(true);await ally('CH16','Invite');await walk('The Photon Gardens');await ally('CH05','Invite');await ally('CH06','Invite');
      await walk("The Titan's Workshop", 'Walk to The Titan’s Workshop');
    }
    if (branch === 'radio' || branch === 'fiber') {
      await walk('The Skywell');await click('Look','Thunderbird','Use'); await click('Keep the path survey in the notebook'); await click('Keep the endpoint settings card');
      await click('Select the alternate surveyed path'); await click('Match both endpoint band, channel and PHY settings'); await measure(true);
      await walk('The Storm Observatory'); await click('Use'); await click('Keep the survey and freshness instructions');
      await click('Isolate the local emitter and return to surveyed conditions'); await click('Select fictional scenario channel B at both endpoints'); await measure(true);
      await walk('The Skywell');if(branch==='fiber')await ally('CH07','Invite'); await walk("The Titan's Workshop");
    }
    await walk('The Shell Market');await click('Look','Electric Eel','Use'); await click('Read and record all separate equipment checks');
    await click('Select 100/full'); await click('Choose complete kit B: 12 W + 11 W + 7 W'); await measure(true);
    if(branch==='fiber')await ally('CH19','Invite');
    await walk("The Titan's Workshop"); await walk('The Clockworks'); await click('Look','Chameleon','Use');
    await click('Read and record the physical-role and upper-layer explanation'); await click('Use untimed step-by-step decoding');
    await click('Explain: sample physical signals representing bits; this does not discover addresses');
    for (const [position, pair] of ['00', '10', '11', '01'].entries()) { await click(`Inspect sample position ${position}`); await click(`Write ${pair} for sample position ${position}`); }
    await measure(true);if(branch==='fiber'){await ally('CH22','Invite');await ally('CH05','Activate');await ally('CH06','Activate');} await walk('The Backhoe Rift', 'Walk toward The Backhoe Rift');
}
async function actionAtPin(code,id,verb) {
  await click(verb);await tap(code,id);
}
async function travelPin(code,dest,width) {
  await page.setViewportSize({width,height:width===390?844:800});await ready(code);
  await actionAtPin(code,'exit:spec001:'+code+':spec001:'+dest,'Walk');await expect(page.locator('.nq-game-location')).toHaveText(roomNames[dest]);report.routes.push({code,dest,width});
}
async function recordPacket(isolated){
  await click('Look','Follow the test message through the current route');
  const packet=dlg('Packet journey');
  for(let step=0;step<4;step++)await packet.getByRole('button',{name:'Step journey',exact:true}).press('Enter');
  const message=isolated?'Current path: deliberately isolated. No transmission is attempted.':'Known highlighted pattern matches on this current controlled path.';
  await expect(packet).toContainText(message);report.conditions.push({packet:message,branch});
  await packet.getByRole('button',{name:'Return to investigation',exact:true}).press('Enter');
}
async function folio(expected,label) {
  const stage=scene('R12').locator('.nq-room-stage');
  await expect(stage).toHaveAttribute('data-mural-folio',expected);
  const bounds=(await read('docs/evidence/spec001/final-rooms/T140/R12/selection-measurements.json')).models.PR115.bounds;
  // Read the actual rendered transparent WebGL layer inside the modal's lifetime.
  // The separate unmodified page screenshot retains the visible result and controls.
  const encoded=await stage.evaluate((el,b)=>new Promise(resolve=>requestAnimationFrame(()=>{
    const canvas=el.querySelector('canvas'), r=canvas.getBoundingClientRect(), plate=el.querySelector('.nq-room-background').getBoundingClientRect();
    const x=(plate.left-r.left+plate.width*(b[0]-1)/1024)*canvas.width/r.width;
    const y=(plate.top-r.top+plate.height*(b[1]-1)/576)*canvas.height/r.height;
    const w=plate.width*(b[2]-b[0]+3)/1024*canvas.width/r.width,h=plate.height*(b[3]-b[1]+3)/576*canvas.height/r.height;
    const crop=document.createElement('canvas');crop.width=100;crop.height=130;
    crop.getContext('2d').drawImage(canvas,x,y,w,h,0,0,100,130);resolve(crop.toDataURL());
  })),bounds);
  const bytes=Buffer.from(encoded.split(',')[1],'base64');
  await writeFile(out+'/folio-'+label+'-'+branch+'.png',bytes);
  report.conditions.push({folio:expected,label,pixelsSha256:hash(bytes)});
}
async function runPlan(duration){
  await click('Repair plan',duration==='shutdown'?'Deliberate isolation — service unresolved':{copper:'Copper replacement — 95 m',fiber:'Fiber path B — 9 dB loss',radio:'Radio path B — 20 dB SNR'}[branch]);
  if(duration!=='shutdown')await click(duration==='temporary'?'Temporary installation':'Permanent installation');
  await click('Read and keep plan requirements');
  if(duration==='temporary')await click('Record temporary dependency and follow-up');
  if(duration==='shutdown')await click('Record unresolved fault and recovery plan');
  await click('Review current plan');await expect(dlg('Repair plan').getByRole('button',{name:'Execute reviewed plan'})).toBeDisabled();
  await check('I understand that execution changes the route and makes earlier readings stale');await click('Execute reviewed plan','Close repair controls');
  await sound('R11');await absent(allEndings);
  await travelPin('R11','R12',duration==='temporary'?390:1280);
  for(const w of [1280,390])await capture('R12','arrival',w);
  await folio('blank','blank-'+duration);await absent(allEndings);if(duration==='shutdown')await absent(['VOICE-031','VOICE-045','EFFECT-033']);
  await sound('R12');await recordPacket(duration==='shutdown');
  await click('Validate repair','Read classification criteria');
  if(duration==='shutdown')await click('Record unresolved isolation');
  else{
    const classify=duration==='permanent'?'Classify permanent restoration':'Classify temporary restoration';
    await click(classify);await expect(dlg('Validate repair')).toContainText('No restored service has been awarded.');await absent(allEndings);
    await click('Measure repaired link',classify);await expect(dlg('Validate repair')).toContainText('No restored service has been awarded.');await absent(allEndings);
    await click('Run endpoint test');const obs=dlg('Validate repair').locator('ol[aria-label="Repair observations"] > li');
    await expect(obs.filter({hasText:'Current observation'})).toHaveCount(2);await expect(obs.last()).toContainText('Endpoint service acknowledged: 1 count');report.readings.push(await obs.allInnerTexts());
    await click(classify);
  }
  const terminal=dlg(outcomeTitles[duration]),end=outcomeCodes[duration];await expect(terminal).toBeVisible();
  const unrelated=cues.R12.filter(c=>c.trigger.startsWith('ending/E') && c.trigger!=='ending/'+end).map(c=>c.assetId.split('ASSET-')[1]);await absent(unrelated);
  await folio(end,end);await sound('R12',terminal);await page.screenshot({path:out+'/'+end+'-'+branch+'.png'});
  report.endings.push({outcome:end,title:outcomeTitles[duration],excludes:unrelated,text:await terminal.innerText()});
  await terminal.getByRole('button',{name:'Skip scene',exact:true}).press('Enter');await terminal.getByRole('button',{name:'Replay scene',exact:true}).press('Enter');
  await terminal.getByRole('button',{name:'Continue',exact:true}).press('Enter');
  if(duration==='shutdown'){
    const confirm=dlg('Continue from Encounter Preparation?');await confirm.getByRole('button',{name:'Cancel — keep this attempt',exact:true}).press('Enter');await expect(terminal).toBeVisible();
    await terminal.getByRole('button',{name:'Continue',exact:true}).press('Enter');await confirm.getByRole('button',{name:'Confirm Continue to Encounter Preparation',exact:true}).press('Enter');
    await ready('R11');await absent(allEndings);await sound('R11');
    await click('Notebook');await expect(page.getByRole('textbox',{name:'Personal notes',exact:true})).toHaveValue('Keep the work slip during preparation.');await click('Close notebook');
  }
}
try {
  await prepare();await ready('R11');await absent(['VOICE-013','VOICE-014','EFFECT-036','EFFECT-037','EFFECT-038','EFFECT-040',...allEndings]);
  for(const width of [1280,390])await capture('R11','arrival',width);
  await click('Look','Severed conduit','Excavation trench','Backhoe of Doom');
  await click('Walk',rooms.R11.walkRegions[0].label);await closeFrame(page);await expect(scene('R11')).toHaveAttribute('data-player-foot','4.750,0.000,3.770');await sound('R11');
  if(branch==='fiber'){
    for(const width of [1280,390])for(const dest of ['R04','R06','R08','R10']){
      await travelPin('R11',dest,width);const row=await read('content/spec001/rooms/'+dest+'.json');
      await walk(roomNames.R11,row.exits.find(e=>e.toRoomId==='spec001:R11').label);
    }
    await verifyControls('R11');
  }
  if(branch==='copper'){
    await click('Repair plan');await check('I understand that crossing the unstable ledge can kill the apprentice');
    await click('Cross the marked unstable inspection ledge');const failure=dlg('A Shortcut Too Short');await expect(failure).toBeVisible();
    await sound('R11',failure);await click('Retry from Encounter Preparation','Confirm Retry from Encounter Preparation');await ready('R11');await absent(['VOICE-013',...allEndings]);await sound('R11');
    await runPlan('shutdown');
  }
  await runPlan(branch==='radio'?'temporary':'permanent');await ready('R12');
  await click('Look','Iron City boundary gate');await expect(page.locator('.nq-shell-status')).toContainText('future-content boundary');
  await click('Walk',rooms.R12.walkRegions[0].label);await closeFrame(page);await expect(scene('R12')).toHaveAttribute('data-player-foot','4.750,0.000,3.770');
  if(branch==='fiber'){
    await verifyControls('R12');
    for(const width of [1280,390])await capture('R12','two-allies',width);
    let active=['CH05','CH06'];
    for(const [name,next] of [['garden-party',['CH05','CH06']],['copper-party',['CH04','CH20']],['optics-market-party',['CH16','CH19']],['clock-radio-party',['CH22','CH07']],['photon-party',['CH03']]]){
      if(name!=='garden-party'){for(const id of active)await ally(id,'Rest');for(const id of next)await ally(id,'Activate');}
      active=next;await capture('R12',name,1280);await travelPin('R12','R11',390);await capture('R11',name,1280);
      if(name==='garden-party')await capture('R11','two-allies',390);
      await travelPin('R11','R12',1280);
    }
    for(const code of ['R11','R12'])expect(report.partyResources.filter(r=>r.room===code).map(r=>r.assetId).sort()).toEqual(rooms[code].mediaBindings.filter(b=>b.use==='party-placement').map(b=>b.assetId).sort());
  }else await travelPin('R12','R11',390);
  expect(report.errors).toEqual([]);report.status='passed';
}catch(error){report.status='failed';report.error=String(error);report.currentText=(await page.locator('body').innerText()).slice(-5000);await page.screenshot({path:out+'/attempt.png'});throw error;}
finally{await writeFile(out+'/guest.json',JSON.stringify(report,null,2)+'\n');await browser.close();await new Promise(r=>server.httpServer.close(r));}
