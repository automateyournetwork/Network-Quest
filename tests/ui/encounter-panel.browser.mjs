// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit isolated native DOM harness, not a full-world acceptance browser test.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';
const output = resolve(process.argv[2] ?? 'docs/evidence/spec001/encounter-preparation/panel-dom.json');
const screenshot = resolve(process.argv[3] ?? 'docs/evidence/spec001/encounter-preparation/panel-200-percent.png');
const server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
server.middlewares.use((req, res, next) => {
  if (req.url !== '/encounter-panel') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated encounter preparation</title><style>
body{font:16px system-ui;margin:12px}#frame{box-sizing:border-box;width:min(100%,760px);max-height:90vh;overflow:auto;padding:16px;background:#eee8d5;color:#202b28}button,input{font:inherit}button{display:block;max-width:100%;margin:8px 0}p,label{overflow-wrap:anywhere}h1{font-size:1.25em}</style>
<body><button id="opener">Repair plan</button><main id="frame" role="dialog" aria-label="Repair plan"><h1>Repair plan</h1><div id="controls"></div></main>
<script type="module">
import {createEncounterPreparationControls} from '/src/ui/encounter.ts';
import {createActionBus} from '/src/ui/action-bus.ts';
let controls,bus,capture,abort,closed=0,calls=[],saved=[],current=true;
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const context={adventureId:id(100),attemptId:id(101),configurationRevision:1};
window.fixture={
 reset(){controls?.dispose();abort?.abort();bus?.dispose();document.querySelector('#controls').replaceChildren();document.querySelector('#frame').hidden=false;document.querySelector('#frame').inert=false;closed=0;calls=[];saved=[];current=true;
  bus=createActionBus({getContext:()=>context});bus.register('execute-repair-plan',action=>{calls.push(action.input);return{status:'handled'}});capture=bus.captureScope();},
 render(review=1,selected='copper-section',duration='permanent',available=true){controls?.dispose();abort?.abort();abort=new AbortController();
  controls=createEncounterPreparationControls(document.querySelector('#controls'),{view:{reviewId:review?id(review):null,selected,duration,available},capture,dispatcher:bus,signal:abort.signal,isCurrent:()=>current,onReturn:()=>{closed++;document.querySelector('#opener').focus()}});},
 save(){saved=[controls.warning,controls.execute,controls.returnButton]},
 clickSaved(){for(const el of saved){if(el.tagName==='INPUT'){el.checked=true;el.dispatchEvent(new Event('change',{bubbles:true}))}else el.click()}},
 attachSaved(){document.querySelector('#controls').append(...saved)},
 unavailable(){current=false},invalidate(){bus.invalidate()},abort(){abort.abort()},dispose(){controls.dispose()},
 hide(){document.querySelector('#frame').hidden=true},inert(){document.querySelector('#frame').inert=true},detach(){document.querySelector('#controls').remove()},
 state(){return{calls,closed,checked:controls.warning.checked,disabled:controls.execute.disabled,hidden:controls.element.hidden,focus:document.activeElement?.textContent}},
};window.ready=true;
</script></body></html>`);
});
let browser;
const report = { task: 'T085', scope: 'isolated actual preparation fragment; no full application lifecycle claim', observedAt: new Date().toISOString(),
  sourceSha256: createHash('sha256').update(await readFile('src/ui/encounter.ts')).digest('hex'), results: [], pageErrors: [] };
try {
  await server.listen(); const address = server.httpServer.address(); if (!address || typeof address === 'string') throw new Error('Missing ephemeral listener');
  browser = await firefox.launch({ headless: true }); report.browserVersion = browser.version(); report.executable = firefox.executablePath();
  const page = await browser.newPage({ viewport: { width: 1000, height: 800 } }); page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/encounter-panel`); await page.waitForFunction(() => window.ready);
  const run = async (name, test) => {
    await page.evaluate(() => { window.fixture.reset(); window.fixture.render(); });
    try { await test(); report.results.push({ name, status: 'PASS' }); }
    catch (error) { report.results.push({ name, status: 'FAIL', error: String(error) }); }
  };
  const check = () => page.locator('#controls input');
  const execute = () => page.locator('#controls button').filter({ hasText: /^Execute reviewed plan$/ });
  const back = () => page.locator('#controls button').filter({ hasText: /^Return to preparation$/ });
  await run('unchecked execution is disabled and programmatic activation dispatches nothing', async () => {
    assert.equal(await execute().isDisabled(),true);await execute().evaluate(el=>el.click());assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  await run('Space acknowledges, Enter executes the captured review using native semantic controls', async () => {
    assert.equal(await check().evaluate(el=>el.closest('label')?.control===el),true);
    await check().focus();await page.keyboard.press('Space');await execute().focus();await page.keyboard.press('Enter');
    assert.deepEqual((await page.evaluate(()=>window.fixture.state())).calls,[{kind:'execute-repair-plan',reviewId:'00000000-0000-4000-8000-000000000001',warningAcknowledged:true}]);
  });
  await run('safe return dispatches no gameplay mutation and retires controls before callback', async () => {
    await check().check();const s=await page.evaluate(()=>{const f=window.fixture;f.save();document.querySelector('#controls button:last-child').click();f.clickSaved();return f.state()});
    assert.equal(s.calls.length,0);assert.equal(s.closed,1);assert.equal(s.hidden,true);assert.equal(s.focus,'Repair plan');
  });
  await run('new review resets acknowledgement and old controls remain inert even when reattached', async () => {
    await check().check();const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.render(2);f.attachSaved();f.clickSaved();return f.state()});
    assert.equal(s.checked,false);assert.equal(s.disabled,true);assert.equal(s.calls.length,0);assert.equal(s.closed,0);
  });
  for (const method of ['unavailable','abort','dispose','hide','inert']) await run(`${method} retires or blocks old execute and return controls`, async () => {
    await check().check();const s=await page.evaluate(method=>{const f=window.fixture;f.save();f[method]();f.clickSaved();return f.state()},method);
    assert.equal(s.calls.length,0);assert.equal(s.closed,0);
  });
  await run('bus invalidation prevents an acknowledged old capture from executing', async () => {
    await check().check();await page.evaluate(()=>window.fixture.invalidate());await execute().click();assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  await run('missing review cannot be bypassed with a synthetic checkbox change', async () => {
    const s=await page.evaluate(()=>{const f=window.fixture;f.render(0);f.save();f.clickSaved();return f.state()});assert.equal(s.calls.length,0);assert.equal(s.disabled,true);
  });
  await run('unavailable execution still permits safe return without acknowledgement', async () => {
    await page.evaluate(()=>window.fixture.render(1,'copper-section','permanent',false));assert.equal(await check().isDisabled(),true);await back().click();
    const s=await page.evaluate(()=>window.fixture.state());assert.equal(s.closed,1);assert.equal(s.calls.length,0);
  });
  await run('copy states untimed conventional-tool preparation with no additional dialog or timer', async () => {
    const text=await page.locator('#controls').innerText();assert.match(text,/no countdown or reflex challenge/);assert.match(text,/without a recruited ally/);
    assert.equal(await page.locator('[role="dialog"]').count(),1);assert.equal(await page.locator('[role="timer"]').count(),0);
    assert.equal((await page.evaluate(()=>window.fixture.state())).calls.length,0);
  });
  await run('temporary and isolation warnings preserve their precise limitations', async () => {
    await page.evaluate(()=>window.fixture.render(1,'copper-section','temporary'));assert.match(await page.locator('#controls').innerText(),/borrowed bypass is temporary/);
    await page.evaluate(()=>window.fixture.render(1,'shutdown'));const text=await page.locator('#controls').innerText();assert.match(text,/service unresolved/);assert.match(text,/cannot replace your recoverable save/);
  });
  await run('390-pixel viewport at 200-percent text has no horizontal overflow and safe return remains reachable', async () => {
    await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{document.querySelector('#frame').style.fontSize='200%';window.fixture.render(1,'shutdown')});
    const widths=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth,frame:document.querySelector('#frame').clientWidth,scroll:document.querySelector('#frame').scrollWidth}));
    assert.ok(widths.page<=widths.viewport);assert.ok(widths.scroll<=widths.frame);await back().scrollIntoViewIfNeeded();
    await mkdir(resolve(screenshot,'..'),{recursive:true});await page.screenshot({path:screenshot,fullPage:true});await back().click();assert.equal((await page.evaluate(()=>window.fixture.state())).closed,1);
  });
  await run('detached controls cannot execute or return', async () => {
    await check().check();const s=await page.evaluate(()=>{const f=window.fixture;f.save();f.detach();f.clickSaved();return f.state()});assert.equal(s.calls.length,0);assert.equal(s.closed,0);
  });
} finally {
  await browser?.close();await server.close();await mkdir(resolve(output,'..'),{recursive:true});await writeFile(output,JSON.stringify(report,null,2)+'\n');
}
console.log(JSON.stringify({passed:report.results.filter(r=>r.status==='PASS').length,failed:report.results.filter(r=>r.status==='FAIL').length,pageErrors:report.pageErrors}));
if(report.results.some(r=>r.status==='FAIL')||report.pageErrors.length)process.exitCode=1;
