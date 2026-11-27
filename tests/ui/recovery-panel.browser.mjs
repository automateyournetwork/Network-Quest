// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated production panel. No provider, owner preview or full playthrough.
import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { createServer } from 'vite';
import { firefox } from '@playwright/test';
const output = resolve(process.argv[2] ?? 'docs/evidence/spec001/recovery/t088/panel-dom.json');
const server = await createServer({ configFile: false, root: process.cwd(), appType: 'custom', envDir: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0, hmr: false } });
server.middlewares.use((req, res, next) => {
  if (req.url !== '/recovery-panel') return next();
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Isolated T088 confirmation</title><style>body{margin:0;background:#171519;color:#faf7ee;font:18px system-ui}#frame{box-sizing:border-box;width:min(820px,100vw);height:660px;padding:12px;overflow:hidden;border:8px solid #626054}button{font:inherit;margin:.3em;padding:.35em}h2{margin:.25em 0}p{line-height:1.45}</style><body><button id="open">Recovery</button><main id="frame"></main><div id="elsewhere"></div>
<script type="module">
import {createRecoveryPanel} from '/src/ui/recovery.ts';
let panel,view,serial=0,calls=[],saved=[];
function render(){view=Object.freeze({serial:++serial,kind:'failure',title:'Retry from Encounter Preparation?',confirmLabel:'Confirm Retry from Encounter Preparation',explanation:[
 'This discards the encounter’s world and inventory changes and returns to safe Encounter Preparation. Items and completion flags rewind together.',
 'Clues, personal notes, hint-use history and recorded outcomes stay in this tab. Earlier measurements remain visible as stale; measure again before using them as current proof.',
 'This is temporary session recovery. It sends no save request and does not replace the account save. Retained learning becomes durable only through a later eligible manual save or an opted-in safe autosave.',
 'Restore Save is different: after its own review and confirmation, it loads the saved adventure and replaces this tab’s unsaved notes, inventory and progress without merging them.'
]});panel.render(view)}
window.fixture={reset(){panel?.dispose();document.querySelector('#frame').replaceChildren();document.querySelector('#elsewhere').replaceChildren();document.querySelector('#frame').hidden=false;document.querySelector('#frame').inert=false;document.querySelector('#open').focus();calls=[];saved=[];
panel=createRecoveryPanel(document.querySelector('#frame'),{confirm(v){calls.push(['confirm',v.serial])},cancel(v){calls.push(['cancel',v.serial])},isCurrent:v=>v===view});render()},
render,same(){panel.render(view)},save(){saved=[...panel.element.querySelectorAll('button')]},old(){for(const b of saved)b.click()},reinsert(){panel.element.append(...saved)},
invalidate(){view=null},hide(){panel.render(null)},dispose(){panel.dispose()},detach(){panel.element.remove()},move(){document.querySelector('#elsewhere').append(panel.element)},
hidden(){document.querySelector('#frame').hidden=true},inert(){document.querySelector('#frame').inert=true},
inject(){const b=document.createElement('button');b.textContent='Game';b.className='nq-panel-game';panel.element.append(b)},
state(){return{calls,serial,focus:document.activeElement?.textContent,hidden:panel.element.hidden}},
malicious(){view={...view,title:'<img src=x onerror="window.injected=true">',explanation:['<scr'+'ipt>window.injected=true</scr'+'ipt>']};panel.render(view)}};
window.fixture.reset();window.ready=true;
</script></body></html>`);
});
let browser;
const report = { task: 'T088', scope: 'isolated production recovery confirmation DOM; full application outcome/race matrix belongs T089', observedAt: new Date().toISOString(), sources: {}, results: [], pageErrors: [] };
try {
  for (const path of ['src/ui/recovery.ts', 'tests/ui/recovery-panel.browser.mjs']) report.sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
  await server.listen(); const address = server.httpServer.address(); if (!address || typeof address === 'string') throw Error('No ephemeral port');
  browser = await firefox.launch({ headless: true }); report.browserVersion = browser.version(); report.executable = firefox.executablePath();
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } }); page.on('pageerror', error => report.pageErrors.push(error.message));
  await page.goto(`http://127.0.0.1:${address.port}/recovery-panel`); await page.waitForFunction(() => window.ready);
  const control = key => page.locator('[data-recovery-control="' + key + '"]');
  const state = () => page.evaluate(() => window.fixture.state());
  const run = async (name, test) => { await page.evaluate(() => window.fixture.reset()); try { await test(); report.results.push({ name, status: 'PASS' }); } catch (error) { report.results.push({ name, status: 'FAIL', error: String(error) }); } };
  await run('labeled confirmation explains rewind, retained learning, stale proof, unsaved durability and separate Restore', async () => {
    const text = await page.getByRole('dialog').innerText(); for (const phrase of ['world and inventory', 'hint-use history', 'stale', 'no save request', 'Restore Save is different', 'without merging']) assert.ok(text.includes(phrase));
    assert.equal((await state()).focus, 'Retry from Encounter Preparation?'); assert.equal(await page.locator('[aria-modal]').count(), 0);
  });
  await run('native Enter confirms exact handle once', async () => { await control('confirm').focus(); await page.keyboard.press('Enter'); await control('confirm').evaluate(el => el.click()); assert.deepEqual((await state()).calls, [['confirm', (await state()).serial]]); });
  await run('native Escape cancels once without confirming', async () => { await control('confirm').focus(); await page.keyboard.press('Escape'); await page.keyboard.press('Escape'); assert.deepEqual((await state()).calls, [['cancel', (await state()).serial]]); });
  await run('native Space cancels exact handle', async () => { await control('cancel').focus(); await page.keyboard.press('Space'); assert.deepEqual((await state()).calls, [['cancel', (await state()).serial]]); });
  await run('modified and composing Escape never cancels', async () => { await control('confirm').focus(); await page.keyboard.press('Shift+Escape'); await page.getByRole('dialog').evaluate(el => el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, isComposing: true }))); assert.deepEqual((await state()).calls, []); });
  for (const mutation of ['invalidate', 'hide', 'dispose', 'detach', 'move', 'hidden', 'inert']) await run(mutation + ' retires delayed controls', async () => {
    const result = await page.evaluate(method => { const f = window.fixture; f.save(); f[method](); f.old(); return f.state(); }, mutation); assert.deepEqual(result.calls, []);
  });
  await run('replacement retires old buttons even when reinserted', async () => { const result = await page.evaluate(() => { const f = window.fixture; f.save(); f.render(); f.reinsert(); f.old(); return f.state(); }); assert.deepEqual(result.calls, []); });
  await run('moved control outside owning dialog is inert', async () => { const result = await control('confirm').evaluate(el => { document.querySelector('#elsewhere').append(el); el.click(); return window.fixture.state(); }); assert.deepEqual(result.calls, []); });
  await run('same projection preserves focus; closing restores opener', async () => { await control('cancel').focus(); await page.evaluate(() => window.fixture.same()); assert.equal((await state()).focus, 'Cancel — keep this attempt'); await page.evaluate(() => window.fixture.hide()); assert.equal((await state()).focus, 'Recovery'); });
  await run('Tab cycle includes frame-owned Game control', async () => { await page.evaluate(() => window.fixture.inject()); await control('cancel').focus(); await page.keyboard.press('Tab'); assert.equal((await state()).focus, 'Game'); await page.keyboard.press('Tab'); assert.equal((await state()).focus, 'Confirm Retry from Encounter Preparation'); await page.keyboard.press('Shift+Tab'); assert.equal((await state()).focus, 'Game'); });
  await run('authored copy is rendered as text', async () => { await page.evaluate(() => window.fixture.malicious()); assert.equal(await page.locator('[role="dialog"] img, [role="dialog"] script').count(), 0); assert.equal(await page.evaluate(() => window.injected), undefined); });
  await run('narrow 200 percent text remains within frame and both controls reachable', async () => {
    await page.setViewportSize({ width: 390, height: 800 }); await page.locator('body').evaluate(el => el.style.fontSize = '36px');
    await control('cancel').focus(); await control('cancel').scrollIntoViewIfNeeded(); assert.equal(await control('cancel').isVisible(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: resolve(dirname(output), 'panel-200-percent.png'), fullPage: true });
  });
} finally {
  await browser?.close(); await server.close(); await mkdir(dirname(output), { recursive: true });
  report.passed = report.results.filter(row => row.status === 'PASS').length; report.failed = report.results.filter(row => row.status === 'FAIL').length;
  await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ report: output, passed: report.passed, failed: report.failed, pageErrors: report.pageErrors }));
if (report.failed || report.pageErrors.length) process.exitCode = 1;
