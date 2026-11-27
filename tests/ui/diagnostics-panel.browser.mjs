// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit native Firefox DOM regression, outside default Vitest/e2e discovery.
// Run with pinned Node from repository root; uses only an ephemeral loopback server.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';

const output = resolve(process.argv[2] ?? 'docs/evidence/spec001/objectives/panel-final.json');
const server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', logLevel: 'error', server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false } });
server.middlewares.use((req, res, next) => {
  if (req.url !== '/diagnostics-panel') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><title>Isolated diagnostics DOM test</title><body>
<button id="opener">Open diagnostics</button><main id="frame" style="width:800px;height:600px;overflow:auto"></main>
<script type="module">
import {createDiagnosticsPanel} from '/src/ui/diagnostics.ts';
import {createActionBus} from '/src/ui/action-bus.ts';
let panel, bus, closed = 0, calls = [], saved = [];
const context = {adventureId:'00000000-0000-4000-8000-000000000001',attemptId:'00000000-0000-4000-8000-000000000002',configurationRevision:1};
const measurement = (n) => ({id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),freshness:'current',text:'Reading '+n,eligible:true});
const view = (numbers=[]) => ({objectiveId:'spec001:O06',explanation:'Inspect the current optical path.',available:true,completed:false,alternative:{id:'spec001:ACTION-O06-passive-path-A',label:'Validate passive optical path A'},measurements:numbers.map(measurement),hints:[],nextHintLabel:'Show method hint'});
let capture;
window.fixture = {
 reset() {
   panel?.dispose(); bus?.dispose(); document.querySelector('#frame').replaceChildren();
   closed=0; calls=[]; saved=[]; document.querySelector('#opener').focus();
   bus=createActionBus({getContext:()=>context});
   for (const kind of ['measure-objective','submit-objective','request-objective-hint']) bus.register(kind, action => { calls.push(action.input); return {status:'handled'}; });
   capture=bus.captureScope(); panel=createDiagnosticsPanel(document.querySelector('#frame'),bus,()=>{closed++});
 },
 render(numbers=[]) { panel.render({view:view(numbers),capture}); },
 hide() { panel.render(null); },
 save() { saved=[...panel.element.querySelectorAll('button')]; },
 clickSaved(index) { saved[index]?.click(); },
 focus(label) { [...panel.element.querySelectorAll('button')].find(b=>b.textContent===label)?.focus(); },
 focusReading(number) { [...panel.element.querySelectorAll('li')].find(li=>li.textContent.includes('Reading '+number+':') || li.textContent.includes('Reading '+number+'Submit'))?.querySelector('button')?.focus(); },
 click(label) { [...panel.element.querySelectorAll('button')].find(b=>b.textContent===label)?.click(); },
 detach() { document.querySelector('#frame').remove(); },
 dispose() { panel.dispose(); },
 state() {return {calls,closed,hidden:panel.element.hidden,focus:document.activeElement?.textContent,reading:document.activeElement?.closest('li')?.textContent,buttons:[...panel.element.querySelectorAll('button')].map(b=>b.textContent)};},
};
window.ready = true;
</script></body></html>`);
});
let browser;
const report = { task: 'T074', surface: 'actual Playwright Firefox DOM', observedAt: new Date().toISOString(), source: 'src/ui/diagnostics.ts', sourceSha256: createHash('sha256').update(await readFile('src/ui/diagnostics.ts')).digest('hex'), results: [], pageErrors: [] };
try {
  await server.listen();
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Missing ephemeral server address');
  browser = await firefox.launch({ headless: true }); report.browserVersion = browser.version();
  const page = await browser.newPage({ viewport: { width: 1100, height: 800 } });
  page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/diagnostics-panel`); await page.waitForFunction(() => window.ready);
  const run = async (name, test) => {
    await page.evaluate(() => { window.fixture.reset(); window.fixture.render(); });
    try { await test(); report.results.push({ name, status: 'PASS' }); }
    catch (error) { report.results.push({ name, status: 'FAIL', error: String(error) }); }
  };
  await run('detached buttons from a prior render cannot measure, hint or close a newer view', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.save(); f.render([1]); f.clickSaved(0); f.clickSaved(1); f.clickSaved(2); return f.state(); });
    assert.equal(result.calls.length,0); assert.equal(result.closed,0); assert.equal(result.hidden,false);
  });
  await run('render(null) retires hidden same-version controls and restores opener focus', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.save(); f.hide(); f.clickSaved(0); f.clickSaved(1); f.clickSaved(2); return f.state(); });
    assert.equal(result.calls.length,0); assert.equal(result.closed,0); assert.equal(result.hidden,true); assert.equal(result.focus,'Open diagnostics');
  });
  await run('close retires immediately even when the owner callback does not rerender', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.save(); f.click('Close diagnostics'); f.clickSaved(0); f.clickSaved(1); f.clickSaved(2); return f.state(); });
    assert.equal(result.closed,1); assert.equal(result.calls.length,0); assert.equal(result.hidden,true);
  });
  await run('old close control cannot close a newly reopened same-version panel', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.save(); f.hide(); f.render([1]); f.clickSaved(2); return f.state(); });
    assert.equal(result.closed,0); assert.equal(result.hidden,false);
  });
  await run('hint focus remains on the hint when a measurement inserts another button', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.focus('Show method hint'); f.render([1]); return f.state(); });
    assert.equal(result.focus,'Show method hint');
  });
  await run('close focus remains on close when the measurement list grows', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.focus('Close diagnostics'); f.render([1,2]); return f.state(); });
    assert.equal(result.focus,'Close diagnostics');
  });
  await run('measurement focus follows the recorded ID when list order changes', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.render([1,2]); f.focusReading(2); f.render([3,1,2]); return f.state(); });
    assert.ok(result.reading?.includes('Reading 2'),JSON.stringify(result));
  });
  await run('unchanged render retains controls and one valid dispatch', async () => {
    const result = await page.evaluate(() => { const f=window.fixture; f.save(); f.focus('Show method hint'); f.render(); f.clickSaved(1); return f.state(); });
    assert.equal(result.focus,'Show method hint'); assert.equal(result.calls.length,1); assert.equal(result.calls[0].kind,'request-objective-hint');
  });
  await run('actual keyboard Enter activates a hint and Escape closes once with focus return', async () => {
    await page.getByRole('button',{name:'Show method hint',exact:true}).focus(); await page.keyboard.press('Enter'); await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const result=await page.evaluate(()=>window.fixture.state()); assert.equal(result.calls.length,1); assert.equal(result.closed,1); assert.equal(result.focus,'Open diagnostics');
  });
  await run('disabled/stale measurement cannot dispatch even via synthetic event', async () => {
    const result=await page.evaluate(()=>{const f=window.fixture; f.render([1]); const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Submit this reading'); b.disabled=true; b.dispatchEvent(new MouseEvent('click',{bubbles:true}));return f.state();});
    assert.equal(result.calls.length,0);
  });
  await run('dispose retires controls and cannot be reversed by render', async () => {
    const result=await page.evaluate(()=>{const f=window.fixture;f.save();f.dispose();f.clickSaved(0);f.clickSaved(2);f.render([1]);return f.state();});
    assert.equal(result.calls.length,0);assert.equal(result.closed,0);assert.equal(result.hidden,true);
  });
  // Last test removes the host; it must not disturb subsequent isolated fixtures.
  await run('detached overlay host cannot dispatch or close', async () => {
    const result=await page.evaluate(()=>{const f=window.fixture;f.save();f.detach();f.clickSaved(0);f.clickSaved(2);return f.state();});
    assert.equal(result.calls.length,0);assert.equal(result.closed,0);
  });
  assert.deepEqual(report.pageErrors,[]);
} finally {
  await browser?.close(); await server.close();
  report.passed = report.results.filter(r=>r.status==='PASS').length;
  report.failed = report.results.filter(r=>r.status==='FAIL').length;
  await mkdir(resolve(output,'..'),{recursive:true}); await writeFile(output,JSON.stringify(report,null,2)+'\n');
  process.stdout.write(JSON.stringify({output,passed:report.passed,failed:report.failed,pageErrors:report.pageErrors,results:report.results})+'\n');
}
if (report.failed || report.pageErrors.length) process.exitCode=1;
