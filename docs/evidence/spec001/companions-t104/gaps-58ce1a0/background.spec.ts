// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Native earned controls plus explicitly simulated clock/document visibility.
// No game state, clue, measurement, objective, party or reward is injected.
import { expect, firefox, test, type Page } from '@playwright/test';
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, relative } from 'node:path';
import { configuredSave } from '../../../../../tests/e2e/support/configured-save';
import { clickButton, closeFrame } from '../../../../../tests/e2e/support/adventure-controls';
const folder='docs/evidence/spec001/companions-t104/gaps-58ce1a0';
const output=resolve(process.env['NQ_T104_GAP_OUTPUT']??folder),run=process.env['NQ_T104_RUN']??'background-initial';
async function hashes(){const files:string[]=[];const scan=async(path:string)=>{for(const item of await readdir(path,{withFileTypes:true})){const p=resolve(path,item.name);if(item.isDirectory())await scan(p);else if(item.isFile())files.push(p);}};
  for(const dir of ['src','content','public/assets','server/src','server/public','server/content','server/migrations','server/tests/Support','tests/e2e/support','tools'])await scan(resolve(dir));
  files.push(resolve('package-lock.json'),resolve('server/composer.lock'),resolve('vite.config.ts'),resolve(folder,'background.spec.ts'));
  return Object.fromEntries(await Promise.all(files.sort().map(async p=>[relative(process.cwd(),p),createHash('sha256').update(await readFile(p)).digest('hex')])));}
test('T104 earned SQ01–04 controls survive logical one-hour hidden/visible events and still complete',async()=>{
  test.setTimeout(600_000);
  const report:any={task:'T104',baseCommit:'58ce1a0ce71c2c5f6ce6a52f7913cdbf5c75129a',sourceVariant:'isolated trusted-capability proposal; exact source hashes retained',
    scope:'Native earned route; Playwright simulated clock and document hidden/visibilityState events, NOT a real background hour or performance test. Existing synthetic local identity only.',
    startedAt:new Date().toISOString(),sources:await hashes(),checks:[],errors:[],external:[],saveRequests:[]};
  const local=await configuredSave(),context=await firefox.launchPersistentContext(local.profile,{headless:true,ignoreHTTPSErrors:false,reducedMotion:'reduce',viewport:{width:1280,height:900}});
  report.browser=context.browser()?.version();const [name,value]=local.cookies[0]!.split('=');await context.addCookies([{name:name!,value:value!,domain:'127.0.0.1',path:'/arcade/play/network-quest/',secure:true,httpOnly:true,sameSite:'Lax'}]);
  const page=await context.newPage();page.setDefaultTimeout(12_000);await page.clock.install();
  context.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin!==local.origin)report.external.push({origin:url.origin,path:url.pathname});
    if(url.pathname.endsWith('/save')&&request.method()==='PUT')report.saveRequests.push({mode:request.headers()['x-save-mode']});});
  page.on('pageerror',error=>report.errors.push(error.message));
  const ui=controls(page),panel=()=>page.getByRole('dialog',{name:'Optional activity',exact:true}),feedback=()=>panel().locator('[role="status"]:not(.nq-shell-status)');
  const form=()=>panel().evaluate(node=>({text:node.textContent,values:[...node.querySelectorAll('input,select')].map(element=>{const input=element as HTMLInputElement;return {tag:input.tagName,type:input.type,value:input.value,checked:input.checked??null,disabled:input.disabled};})}));
  const delay=async(id:string)=>{
    const before=await form(),beforeLocation=await page.locator('.nq-game-location').innerText(),time=await page.evaluate(()=>Date.now());
    const requestCount=report.saveRequests.length;expect(before.values.length).toBeGreaterThan(0);
    const other=await context.newPage();await other.goto('about:blank');await other.bringToFront();
    const naturalHidden=await page.evaluate(()=>document.hidden);
    // If headless Firefox keeps both tabs visible, explicitly simulate the
    // document event. Assert the REAL renderer consumer's paused projection.
    if(!naturalHidden)await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});Object.defineProperty(document,'visibilityState',{configurable:true,value:'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
    expect(await page.evaluate(()=>({hidden:document.hidden,state:document.visibilityState}))).toEqual({hidden:true,state:'hidden'});
    await expect(page.locator('.nq-graybox')).toHaveAttribute('data-paused','true');
    await page.clock.fastForward(3_600_000);
    const elapsed=await page.evaluate(()=>Date.now())-time;expect(elapsed).toBeGreaterThanOrEqual(3_600_000);expect(await form()).toEqual(before);
    await other.close();await page.bringToFront();
    if(!naturalHidden)await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:false});Object.defineProperty(document,'visibilityState',{configurable:true,value:'visible'});document.dispatchEvent(new Event('visibilitychange'));});
    await expect(page.locator('.nq-graybox')).toHaveAttribute('data-paused','false');
    expect(await form()).toEqual(before);expect(await page.locator('.nq-game-location').innerText()).toBe(beforeLocation);expect(report.saveRequests).toHaveLength(requestCount);
    await expect(panel()).toContainText('Optional · Untimed');await page.screenshot({path:resolve(output,`${run}-${id}-after-logical-hour.png`)});
    report.checks.push({id:`OPT-${id}-UNTIMED`,logicalElapsedMilliseconds:elapsed,clock:'Playwright fastForward',visibility:naturalHidden?'owned second tab naturally hid the game':'explicit document properties plus dispatched actual visibilitychange event',actualRendererPausedThenResumed:true,formAndSessionRetained:true,locationRetained:true,saveRequestsDuringWait:0,completionAfterWait:false});
    if(!naturalHidden)await page.evaluate(()=>{Reflect.deleteProperty(document,'hidden');Reflect.deleteProperty(document,'visibilityState');document.dispatchEvent(new Event('visibilitychange'));});
  };
  let first=true;const expectedQuests:string[]=[];
  const saveCompleted=async(id:string,fact:string)=>{
    await ui.click('Save');if(first){await ui.click('Save this adventure');first=false;}await expect(page.getByText(/^Saved at /)).toBeVisible();const saved=(await local.inspectSlot())!,account=await local.inspectAccount();expect(saved).not.toBeNull();
    expectedQuests.push(`spec001:${id}`);expect(saved.snapshot.world.completedQuestIds.slice().sort()).toEqual(expectedQuests.slice().sort());expect(saved.snapshot.notebook.factIds.filter(x=>String(x)===`spec001:${fact}`)).toHaveLength(1);
    expect(saved.snapshot.world.recruits).toEqual([]);expect(saved.snapshot.world.activeAllyIds).toEqual([]);expect(account.saves).toBe(1);expect(account.preference?.autosave_enabled).toBe(0);expect(report.saveRequests.every((r:any)=>r.mode==='manual')).toBe(true);
    const item=report.checks.find((r:any)=>r.id===`OPT-${id}-UNTIMED`);item.completionAfterWait=true;item.persistedQuestAndFactOnce=true;item.manualRevision=saved.revision;console.log(`PASS ${id}: simulated hidden logical hour retains controls, completes and saves once`);
  };
  try{
    await page.goto(local.url);await expect(page.getByText('Synthetic T050 player (github)',{exact:true})).toBeVisible();await ui.click('New Adventure');await ui.click('Start new adventure');
    await ui.click('Look');await ui.click('Look at power indication');await ui.click('Look at link indication');await ui.click('Talk');await ui.click('Talk to Photon the Firefly');await ui.click('Skip dialogue');await ui.use('Inspect physical path');
    await ui.walk("The Titan's Workshop");await ui.click('Talk');await ui.click('Talk to the Titan');await ui.click('Skip dialogue');await ui.click('Look');await ui.click('Identify known-good endpoints');await ui.click('Identify physical path under test');
    await ui.click('Notebook');await page.getByRole('textbox',{name:'Hypothesis',exact:true}).fill('Optional thinking time does not repair the physical path.');await ui.click('Pin hypothesis');await page.getByRole('textbox',{name:'Personal notes',exact:true}).fill('Preserve this earned notebook across simulated visibility events.');await ui.click('Close notebook');
    await ui.walk('The Copper Warrens');await ui.use('Read and keep the supplied compatibility card');await ui.use('Read and keep the diagnosed-defect card; this is not a performed measurement');await ui.measure(false,['Open required conductors: 1 count']);await ui.use('Fit the supplied replacement section: 85 m + 10 m');await ui.measure(true);
    await ui.walk('The Echo Cavern');await ui.use('Read and keep the before-record instructions; retain an actual measured open result');await ui.use('Read and keep the repeater role and limits');await ui.use('Conclude: a repeater needs the physical connection restored');await ui.measure(true);
    await ui.click('Open Serial Post');await ui.click('Copy the full message');await panel().getByRole('textbox',{name:'Full message bits',exact:true}).fill('00101101');await delay('SQ01');await ui.click('Check the copied bits');await expect(feedback()).toContainText('Your journal records the delivery.');await ui.click('Leave the post');await saveCompleted('SQ01','FACT-SQ01-delivery');
    await ui.walk('The Copper Warrens');await ui.walk("The Titan's Workshop");await ui.walk('The Photon Gardens');await ui.use('Inspect the original connection at the dock before any intervention');await ui.walk("The Titan's Workshop",'Walk to The Titan’s Workshop');await ui.walk('The Shell Market');
    await ui.use('Read the fictional delivered-power profile and compare the original proposal with both kits.');await ui.use('Read and record all separate equipment checks');await ui.use('Select 100/full');await ui.use('Choose complete kit B: 12 W + 11 W + 7 W');await ui.measure(true,['Total delivered demand: 30 W']);
    await ui.click('Open Energy audit');await ui.click('Audit the three-card ledger');await panel().getByRole('combobox').selectOption('over-budget');await panel().getByRole('spinbutton').fill('3');await delay('SQ02');await ui.click('Check the audit');await expect(feedback()).toContainText('proposal remains over budget');await ui.click('Close the ledger');await saveCompleted('SQ02','FACT-SQ02-audit');
    await ui.click('Open Maintenance record');await ui.click('Combine my collected records');await expect(panel().getByRole('checkbox')).toHaveCount(3);for(const checkbox of await panel().getByRole('checkbox').all()){await expect(checkbox).toBeEnabled();await checkbox.check();}
    await delay('SQ04');await ui.click('Combine selected records');await expect(feedback()).toContainText('Your epilogue can now include this recovered history');await page.keyboard.press('Escape');await expect(panel()).toBeHidden();await saveCompleted('SQ04','FACT-SQ04-history');
    await ui.walk("The Titan's Workshop");await ui.walk('The Skywell');await ui.use('Keep the path survey in the notebook');await ui.use('Keep the endpoint settings card');await ui.use('Align the existing surveyed path');await ui.use('Match both endpoint band, channel and PHY settings');await ui.measure(true);await ui.walk('The Storm Observatory');await ui.use('Keep the survey and freshness instructions');await ui.use('Isolate the local emitter and return to surveyed conditions');await ui.measure(true,['Signal-to-noise ratio: 25 dB']);await ui.use('Reconnect the local emitter for the raised-noise scenario');await ui.measure(false,['Signal-to-noise ratio: 13 dB']);
    await ui.click('Open Weather Diary');await ui.click('Compare my actual observations');const earlier=panel().getByRole('combobox',{name:'Earlier actual radio reading',exact:true});const labels=await earlier.locator('option').allTextContents();const index=labels.findIndex(label=>label.includes(': 25 dB'));expect(index).toBeGreaterThan(0);await earlier.selectOption({index});
    await panel().getByRole('combobox',{name:'Later current radio reading',exact:true}).selectOption({index:1});await panel().getByRole('combobox',{name:'How did the SNR change?',exact:true}).selectOption('decreased');await panel().getByRole('combobox',{name:'Does the later reading meet the supplied threshold?',exact:true}).selectOption('below-threshold');await panel().getByRole('radio',{name:'Use the current reading; cause and throughput remain unproven',exact:true}).check();
    await delay('SQ03');await ui.click('Check the comparison');await expect(feedback()).toContainText('diary has repaired nothing');await ui.click('Close the diary');await saveCompleted('SQ03','FACT-SQ03-comparison');
    const final=(await local.inspectSlot())!.snapshot;expect(final.notebook.personalNotes).toBe('Preserve this earned notebook across simulated visibility events.');expect(final.world.completedObjectiveIds).toEqual(expect.arrayContaining(['O01','O02','O03','O04','O07','O08','O09'].map(id=>`spec001:${id}`)));expect(final.world.inventory.find(i=>String(i.itemId)==='spec001:ITEM-inspection-kit')?.quantity).toBe(1);
    expect(report.checks).toHaveLength(4);expect(report.checks.every((c:any)=>c.completionAfterWait)).toBe(true);expect(report.errors).toEqual([]);expect(report.external).toEqual([]);expect(await hashes()).toEqual(report.sources);report.status='PASS';
  }catch(error){report.status='FAIL';report.error=String(error);report.lastText=(await page.locator('body').innerText()).slice(-16000);await page.screenshot({path:resolve(output,`${run}-failure.png`)});throw error;}
  finally{await writeFile(resolve(output,`${run}.json`),JSON.stringify(report,null,2)+'\n');try{await context.close();}finally{await local.stop();}}
});
function controls(page:Page){const diagnostic=()=>page.getByRole('dialog',{name:'Diagnostics',exact:true});
  const click=async(name:string)=>{if(['Diagnostics','Open Serial Post','Open Energy audit','Open Weather Diary','Open Maintenance record'].includes(name))await closeFrame(page);await clickButton(page,name);};
  return {click,use:async(name:string)=>{await click('Use');await click(name);},walk:async(name:string,label=`Walk to ${name}`)=>{await click('Walk');await click(label);await expect(page.locator('.nq-game-location')).toHaveText(name);},
    measure:async(submit:boolean,readings:string[]=[])=>{await click('Diagnostics');await click('Take measurement');const last=diagnostic().locator('ol[aria-label="Recorded measurements"] > li').last();for(const value of readings)await expect(last).toContainText(value);if(submit){await last.getByRole('button',{name:'Submit this reading',exact:true}).click();await expect(diagnostic()).toContainText('Objective complete.');}await click('Close diagnostics');}};
}
