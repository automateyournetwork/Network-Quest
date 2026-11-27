// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit isolated Firefox DOM regression; no production server or preview used.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';
const server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
server.middlewares.use((req, res, next) => {
  if (req.url !== '/repair-panel') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated repair controls</title><body><button id="opener">Repair plan</button><main id="frame" style="width:800px;height:600px;overflow:auto"></main>
<script type="module">
import {createRepairPlanPanel} from '/src/ui/repair-plan.ts';
import {createActionBus} from '/src/ui/action-bus.ts';
let panel,bus,capture,closed=0,calls=[],saved=[];
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const context={adventureId:id(100),attemptId:id(101),configurationRevision:1};
function view(n=1,stage='preparation') {return {stage,available:true,completed:false,selected:'copper-section',duration:'permanent',classification:null,
  reviewId:n?id(n):null,linkId:stage==='validation'?id(5):null,endpointId:stage==='validation'?id(6):null,
  measurements:n?[{id:id(n),text:'Plan review — Total channel length: 95 m',current:true}]:[],explanation:'Inspect the current deployment and its consequences.'};}
window.fixture={
 reset() {panel?.dispose();bus?.dispose();document.querySelector('#frame').replaceChildren();document.querySelector('#opener').focus();closed=0;calls=[];saved=[];
  bus=createActionBus({getContext:()=>context});for(const kind of ['choose-repair-plan','review-repair-plan','execute-repair-plan','measure-repair-link','test-repair-endpoint','classify-repair'])bus.register(kind,action=>{calls.push(action.input);return{status:'handled'}});
  capture=bus.captureScope();panel=createRepairPlanPanel(document.querySelector('#frame'),bus,()=>{closed++});},
 render(n=1,stage='preparation'){panel.render({view:view(n,stage),capture})},hide(){panel.render(null)},
 save(){saved=[...panel.element.querySelectorAll('input,button')]},
 clickSaved(label){saved.find(b=>b.textContent===label)?.click()},
 checkSaved(){const c=saved.find(b=>b.tagName==='INPUT');if(c){c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}))}},
 click(label){[...panel.element.querySelectorAll('button')].find(b=>b.textContent===label)?.click()},
 focus(label){[...panel.element.querySelectorAll('button')].find(b=>b.textContent===label)?.focus()},
 detach(){document.querySelector('#frame').remove()},dispose(){panel.dispose()},
 state(){const c=panel.element.querySelector('input');const b=[...panel.element.querySelectorAll('button')].find(b=>b.textContent==='Execute reviewed plan');return{calls,closed,hidden:panel.element.hidden,checked:c?.checked,executeDisabled:b?.disabled,focus:document.activeElement?.textContent}},
};window.ready=true;
</script></body></html>`);
});
let browser;
const report = { task: 'T077', surface: 'isolated production panel in actual Firefox DOM', observedAt: new Date().toISOString(),
  sourceSha256: createHash('sha256').update(await readFile('src/ui/repair-plan.ts')).digest('hex'), results: [], pageErrors: [] };
try {
  await server.listen(); const address = server.httpServer.address(); if (!address || typeof address === 'string') throw new Error('No loopback port');
  browser = await firefox.launch({ headless: true }); report.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } }); page.on('pageerror', e => report.pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}/repair-panel`); await page.waitForFunction(() => window.ready);
  const run = async (name, test) => {
    await page.evaluate(() => { window.fixture.reset(); window.fixture.render(); });
    try { await test(); report.results.push({ name, status: 'PASS' }); } catch (error) { report.results.push({ name, status: 'FAIL', error: String(error) }); }
  };
  const check = () => page.getByRole('checkbox', { name: 'I understand that execution changes the route and makes earlier readings stale', exact: true });
  await run('execution is disabled until an actual explicit checkbox acknowledgement', async () => {
    assert.equal((await page.evaluate(() => window.fixture.state())).executeDisabled, true);
    await check().check(); await page.getByRole('button', { name: 'Execute reviewed plan', exact: true }).click();
    const s = await page.evaluate(() => window.fixture.state()); assert.equal(s.calls.length, 1); assert.equal(s.calls[0].warningAcknowledged, true); assert.equal(s.calls[0].reviewId, '00000000-0000-4000-8000-000000000001');
  });
  await run('keyboard Space acknowledges then Enter executes the captured review', async () => {
    await check().focus(); await page.keyboard.press('Space'); await page.getByRole('button', { name: 'Execute reviewed plan', exact: true }).focus(); await page.keyboard.press('Enter');
    assert.equal((await page.evaluate(() => window.fixture.state())).calls.length, 1);
  });
  await run('a new review resets acknowledgement and invalidates old checked controls', async () => {
    await check().check(); const s = await page.evaluate(() => { const f=window.fixture;f.save();f.render(2);f.checkSaved();f.clickSaved('Execute reviewed plan');return f.state(); });
    assert.equal(s.checked,false); assert.equal(s.executeDisabled,true); assert.equal(s.calls.length,0);
  });
  await run('closing retires checked controls synchronously even if owner does not render', async () => {
    await check().check(); const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.click('Close repair controls');f.checkSaved();f.clickSaved('Execute reviewed plan');return f.state()});
    assert.equal(s.closed,1);assert.equal(s.calls.length,0);assert.equal(s.hidden,true);assert.equal(s.focus,'Repair plan');
  });
  await run('hidden old checkbox cannot acknowledge a reopened same-version review', async () => {
    await check().check(); const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.hide();f.render();f.checkSaved();f.clickSaved('Execute reviewed plan');f.clickSaved('Close repair controls');return f.state()});
    assert.equal(s.checked,false);assert.equal(s.executeDisabled,true);assert.equal(s.calls.length,0);assert.equal(s.closed,0);assert.equal(s.hidden,false);
  });
  await run('unchanged projection retains explicit acknowledgement and focus', async () => {
    await check().check();await check().focus();const s=await page.evaluate(()=>{window.fixture.render();return window.fixture.state()});assert.equal(s.checked,true);assert.equal(s.executeDisabled,false);
    assert.equal(await check().evaluate(e=>e===document.activeElement),true);
  });
  await run('a missing review cannot be bypassed by checkbox change', async () => {
    const s=await page.evaluate(()=>{const f=window.fixture;f.render(0);const c=document.querySelector('input');c.checked=true;c.dispatchEvent(new Event('change',{bubbles:true}));f.click('Execute reviewed plan');return f.state()});
    assert.equal(s.executeDisabled,true);assert.equal(s.calls.length,0);
  });
  await run('Escape closes once and returns focus to the opener', async () => {
    await check().focus();await page.keyboard.press('Escape');await page.keyboard.press('Escape');const s=await page.evaluate(()=>window.fixture.state());assert.equal(s.closed,1);assert.equal(s.focus,'Repair plan');
  });
  await run('validation exposes distinct link and endpoint intents with existing evidence IDs', async () => {
    const s=await page.evaluate(()=>{const f=window.fixture;f.render(1,'validation');f.click('Measure repaired link');f.click('Run endpoint test');f.click('Classify permanent restoration');return f.state()});
    assert.deepEqual(s.calls.map(c=>c.kind),['measure-repair-link','test-repair-endpoint','classify-repair']);assert.equal(s.calls[2].linkId,'00000000-0000-4000-8000-000000000005');assert.equal(s.calls[2].endpointId,'00000000-0000-4000-8000-000000000006');
  });
  await run('retired preparation controls cannot execute after switching to validation', async () => {
    await check().check();const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.render(1,'validation');f.clickSaved('Execute reviewed plan');return f.state()});assert.equal(s.calls.length,0);
  });
  await run('disposal retires checked controls permanently', async () => {
    await check().check();const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.dispose();f.clickSaved('Execute reviewed plan');f.render();return f.state()});assert.equal(s.calls.length,0);assert.equal(s.hidden,true);
  });
  await page.evaluate(()=>{window.fixture.reset();window.fixture.render();document.querySelector('#frame').style.fontSize='200%'});
  await page.screenshot({ path:'docs/evidence/spec001/repair-plan/panel-200-percent.png',fullPage:true });
  await run('detached overlay cannot execute or close', async () => {
    await check().check();const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.detach();f.clickSaved('Execute reviewed plan');f.clickSaved('Close repair controls');return f.state()});assert.equal(s.calls.length,0);assert.equal(s.closed,0);
  });
} finally {
  await browser?.close();await server.close();
  await writeFile('docs/evidence/spec001/repair-plan/panel-dom.json',JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({ passed:report.results.filter(r=>r.status==='PASS').length,failed:report.results.filter(r=>r.status==='FAIL').length,pageErrors:report.pageErrors }));
if(report.results.some(r=>r.status==='FAIL')||report.pageErrors.length)process.exitCode=1;
