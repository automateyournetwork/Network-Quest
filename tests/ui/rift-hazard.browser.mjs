// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated real repair panel DOM, separate from domain and full-app acceptance.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';
const folder = resolve('docs/evidence/spec001/encounter-preparation');
const server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
server.middlewares.use((req, res, next) => {
  if (req.url !== '/rift-hazard') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated repair panel danger controls</title><style>
body{font:16px system-ui;margin:12px}#frame{box-sizing:border-box;width:min(100%,760px);height:90vh;padding:16px;background:#eee8d5;color:#202b28}#controls{height:100%}button,input{font:inherit}button{display:block;max-width:100%;margin:8px 0}p,label{overflow-wrap:anywhere}h2{font-size:1.25em}</style>
<body><button id="opener">Repair plan</button><main id="frame"><div id="controls"></div></main><div id="outside"></div><script type="module">
import {createRepairPlanPanel} from '/src/ui/repair-plan.ts';
import {createActionBus} from '/src/ui/action-bus.ts';
import {validateEndingsContent} from '/src/content/endings.ts';
import documentContent from '/content/spec001/endings.json';
const checked=validateEndingsContent(documentContent);if(!checked.ok)throw new Error('Invalid test content');const content=checked.value;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');const context={adventureId:id(100),attemptId:id(101),configurationRevision:1};
let panel,bus,closed=0,calls=[],saved=[],view;
const viewBase=()=>({stage:'preparation',available:true,completed:false,encounterActive:false,hazard:content.hazard,selected:'copper-section',duration:'permanent',classification:null,reviewId:id(1),linkId:null,endpointId:null,measurements:[],explanation:'Inspect the conduit from the safe platform.'});
window.fixture={reset(){panel?.dispose();bus?.dispose();document.querySelector('#controls').replaceChildren();document.querySelector('#outside').replaceChildren();document.querySelector('#frame').hidden=false;document.querySelector('#frame').inert=false;document.querySelector('#frame').style.fontSize='';calls=[];closed=0;saved=[];
bus=createActionBus({getContext:()=>context});for(const kind of ['commit-rift-hazard','execute-repair-plan'])bus.register(kind,a=>{calls.push(a.input);return{status:'handled'}});
panel=createRepairPlanPanel(document.querySelector('#controls'),bus,()=>{closed++});document.querySelector('#opener').focus();view=viewBase();this.render();},
render(overrides={}){view={...view,...overrides};panel.render({view,capture:bus.captureScope()});},
save(){saved=[...panel.element.querySelectorAll('input,button')]},old(){for(const e of saved){if(e.tagName==='INPUT'){e.checked=true;e.dispatchEvent(new Event('change',{bubbles:true}))}else e.click()}},
attach(){document.querySelector('#controls').append(...saved)},invalidate(){bus.invalidate()},dispose(){panel.dispose()},hide(){document.querySelector('#frame').hidden=true},inert(){document.querySelector('#frame').inert=true},detach(){panel.element.remove()},
state(){return{calls,closed,focus:document.activeElement?.textContent}}};window.ready=true;
</script></body></html>`);
});
const report = { task: 'T085', scope: 'isolated real repair panel and optional hazard DOM; no full application acceptance claim', observedAt: new Date().toISOString(), sources: {}, results: [], pageErrors: [] };
for (const path of ['src/ui/repair-plan.ts','src/ui/rift-hazard.ts','src/ui/encounter.ts','src/ui/action-bus.ts','src/state/rift-hazard.ts']) report.sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
let browser;
try {
  await server.listen(); const address = server.httpServer.address(); if (!address || typeof address === 'string') throw new Error('Missing ephemeral listener');
  browser = await firefox.launch({ headless: true }); report.browserVersion = browser.version(); report.executable = firefox.executablePath();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } }); page.on('pageerror', e => report.pageErrors.push(e.message));
  await page.goto(`http://127.0.0.1:${address.port}/rift-hazard`); await page.waitForFunction(() => window.ready);
  const run = async (name, test) => { await page.evaluate(() => window.fixture.reset()); try { await test(); report.results.push({ name, status: 'PASS' }); } catch (error) { report.results.push({ name, status: 'FAIL', error: String(error) }); } };
  const warning = () => page.getByLabel('I understand that crossing the unstable ledge can kill the apprentice', { exact: true });
  const commit = () => page.getByRole('button', { name: 'Cross the marked unstable inspection ledge', exact: true });
  const back = () => page.getByRole('button', { name: 'Stay on the safe inspection platform', exact: true });
  await run('one existing dialog presents exact danger and safe alternative with unchecked commitment', async () => {
    assert.equal(await page.getByRole('dialog').count(),1); assert.equal(await warning().isChecked(),false); assert.equal(await commit().isDisabled(),true);
    assert.match(await page.getByRole('dialog').innerText(),/collapse into the excavation trench and kill the apprentice/);assert.match(await page.getByRole('dialog').innerText(),/Crossing is optional and never required for a repair/);
    await commit().evaluate(el=>el.click()); assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  await run('Space and Enter send only explicitly acknowledged closed danger intent', async () => {
    await warning().focus();await page.keyboard.press('Space');await commit().focus();await page.keyboard.press('Enter');
    assert.deepEqual((await page.evaluate(()=>window.fixture.state())).calls,[{kind:'commit-rift-hazard',hazardId:'spec001:HAZARD-rift-unstable-ledge',warningAcknowledged:true}]);
  });
  await run('ordinary execution acknowledgement never acknowledges optional danger', async () => {
    await page.getByLabel('I understand that execution changes the route and makes earlier readings stale',{exact:true}).check();assert.equal(await commit().isDisabled(),true);assert.equal(await warning().isChecked(),false);
  });
  await run('safe platform choice is inert to gameplay, restores focus, and retires all controls', async () => {
    await warning().check();await page.evaluate(()=>window.fixture.save());await back().click();await page.evaluate(()=>{window.fixture.attach();window.fixture.old()});
    const state=await page.evaluate(()=>window.fixture.state());assert.equal(state.calls.length,0);assert.equal(state.closed,1);assert.equal(state.focus,'Repair plan');
  });
  await run('Escape cancels without any acknowledgement or gameplay action', async () => {
    await warning().focus();await page.keyboard.press('Escape');const state=await page.evaluate(()=>window.fixture.state());assert.equal(state.calls.length,0);assert.equal(state.closed,1);
  });
  await run('new projection resets acknowledgement and reattached old controls stay inert', async () => {
    await warning().check();await page.evaluate(()=>{window.fixture.save();window.fixture.render();window.fixture.attach();window.fixture.old()});
    assert.equal(await warning().first().isChecked(),false);assert.equal(await commit().first().isDisabled(),true);assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  for (const method of ['hide','inert','detach','dispose']) await run(`${method} blocks delayed old controls`,async()=>{
    await warning().check();const state=await page.evaluate(method=>{const f=window.fixture;f.save();f[method]();f.old();return f.state()},method);assert.equal(state.calls.length,0);assert.equal(state.closed,0);
  });
  await run('bus invalidation rejects the old projection even while its checkbox remains visible',async()=>{
    await warning().check();await page.evaluate(()=>window.fixture.invalidate());await commit().click();assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  for (const [kind, label, button] of [
    ['hazard','I understand that crossing the unstable ledge can kill the apprentice','Cross the marked unstable inspection ledge'],
    ['preparation','I understand that execution changes the route and makes earlier readings stale','Execute reviewed plan'],
  ]) for (const moved of ['fragment','holder','child']) await run(`moved ${kind} ${moved} outside its original containment is inert`,async()=>{
    await page.getByLabel(label,{exact:true}).check();
    await page.getByRole('button',{name:button,exact:true}).evaluate((el,moved)=>{
      const fragment=el.parentElement, holder=fragment.parentElement;
      document.querySelector('#outside').append(moved==='fragment'?fragment:moved==='holder'?holder:el);el.click();
    },moved);
    assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  await run('postcommit projection has no danger choice and narrates temporary encounter restrictions',async()=>{
    await page.evaluate(()=>window.fixture.render({completed:true,encounterActive:true,available:false,hazard:null}));assert.equal(await commit().count(),0);assert.match(await page.getByRole('dialog').innerText(),/saving is paused/);
  });
  await run('resolved return to Rift does not falsely claim an active encounter or blocked saving',async()=>{
    await page.evaluate(()=>window.fixture.render({completed:true,encounterActive:false,hazard:null,classification:'permanent'}));assert.equal(await commit().count(),0);assert.doesNotMatch(await page.getByRole('dialog').innerText(),/saving is paused|Other exits remain closed/);
  });
  await run('390-pixel viewport and 200-percent text retain readable warning and reachable safe return',async()=>{
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>document.querySelector('#frame').style.fontSize='200%');
    const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,dialog:document.querySelector('[role=dialog]').clientWidth,scroll:document.querySelector('[role=dialog]').scrollWidth}));assert.ok(widths.page<=widths.viewport);assert.ok(widths.scroll<=widths.dialog);
    await back().scrollIntoViewIfNeeded();await mkdir(folder,{recursive:true});await page.screenshot({path:resolve(folder,'hazard-200-percent.png'),fullPage:true});await back().click();assert.equal((await page.evaluate(()=>window.fixture.state())).closed,1);
  });
} finally { await browser?.close(); await server.close(); await mkdir(folder,{recursive:true}); await writeFile(resolve(folder,'hazard-dom.json'),JSON.stringify(report,null,2)+'\n'); }
console.log(JSON.stringify({passes:report.results.filter(r=>r.status==='PASS').length,failures:report.results.filter(r=>r.status==='FAIL'),pageErrors:report.pageErrors}));
assert.equal(report.results.filter(r=>r.status==='FAIL').length,0);assert.equal(report.pageErrors.length,0);
