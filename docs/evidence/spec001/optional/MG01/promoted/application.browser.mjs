// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual built guest application: no injected game state, verdict, auth or save.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { preview } from 'vite';
import { firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { clickButton, closeFrame, openFrame } from '../../../../../../tests/e2e/support/adventure-controls.ts';
const output = resolve(process.argv[2] ?? 'docs/evidence/spec001/optional/MG01/promoted/08-native.json');
const directory = dirname(output) + sep;
await mkdir(directory, { recursive: true });
const report = { task: 'T101', scope: 'Accepted-58ce1a0 current-tree reconciliation plus reviewed MG01 actual built guest journey; no account/provider, performance or OS foreground claim.', observedAt: new Date().toISOString(), results: [], errors: [], requests: [], sources: {} };
const paths = ['src/state/optional-activities.ts','src/content/optional-activities.ts','src/content/optional-symbol-loom.ts','src/state/reducer.ts','src/ui/optional-activities.ts','src/ui/optional-activities.css','src/ui/action-bus.ts','src/app/application.ts','src/app/application.css','src/app/content.ts','content/spec001/minigames/MG01.json','content/spec001/rooms/R10.json','content/spec001/world.json','content/schemas/content.schema.json','dist/.vite/manifest.json','docs/evidence/spec001/optional/MG01/promoted/application.browser.mjs'];
for (const path of paths) report.sources[path] = createHash('sha256').update(await readFile(path)).digest('hex');
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
let browser, page;
try {
  browser = await firefox.launch({ headless: true }); report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.includes('/api/') || request.method() !== 'GET') report.requests.push({ path: url.pathname, method: request.method() }); });
  const checked = name => report.results.push({ name, status: 'PASS' });
  const panel = () => page.getByRole('dialog', { name: 'Optional activity', exact: true });
  const feedback = () => panel().locator('[role="status"]:not(.nq-shell-status)');
  const click = async name => { if (['Diagnostics','Open Bit Loom'].includes(name)) await closeFrame(page); await clickButton(page, name); };
  const walk = async name => { await click('Walk'); await click(`Walk to ${name}`); await expect(page.locator('.nq-game-location')).toHaveText(name); };
  const bits = async (value, practice = false) => { await panel().getByRole('textbox', { name: practice ? 'Practice bits' : 'Full message bits', exact: true }).fill(value); await click('Check the copied bits'); };
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/arcade/play/network-quest/`);
  await click('New Adventure'); await click('Look'); await click('Look at power indication'); await click('Look at link indication'); await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue'); await click('Use'); await click('Inspect physical path');
  await walk("The Titan's Workshop"); await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue'); await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
  await click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Decode the supplied physical symbols before drawing a conclusion.'); await click('Pin hypothesis'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill('Keep my Clockworks observation through optional Retry.'); await click('Close notebook'); await click('Continue as guest');
  await walk('The Clockworks'); await click('Use');
  for (const name of ['Select 100/full','Use untimed step-by-step decoding','Explain: sample physical signals representing bits; this does not discover addresses','Read and record the physical-role and upper-layer explanation','Write 00 for sample position 0','Write 10 for sample position 1','Write 11 for sample position 2','Write 01 for sample position 3']) await click(name);
  await click('Diagnostics'); await click('Take measurement'); const diagnostics = page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  await diagnostics.locator('ol[aria-label="Recorded measurements"] > li').last().getByRole('button', { name: 'Submit this reading', exact: true }).click();
  await expect(diagnostics).toContainText('Objective complete.'); await click('Close diagnostics');
  checked('OPT-MG01-SKIP / NO-O10-SCORE: actual mandatory Clockworks calibration completes before any optional loom session');
  await closeFrame(page); await page.getByRole('button', { name: 'Open Bit Loom', exact: true }).press('Enter');
  await expect(panel().getByRole('heading', { level: 2 })).toBeFocused(); await expect(panel()).toContainText('Optional · Untimed'); await expect(panel()).toContainText('Toy map:');
  await expect(panel()).not.toContainText('undefined'); await expect(panel()).not.toContainText('O10'); await expect(panel().getByRole('timer')).toHaveCount(0); checked('OPT-MG01-START: keyboard opener, instructions, persistent map, owned focus and no timing control');
  await click('Practice one symbol'); await bits('11', true); await expect(feedback()).toContainText('two represented bits'); await expect(feedback()).not.toContainText('00101101');
  await expect(panel()).not.toContainText('Your notebook records this optional exercise.');
  const detached = await panel().getByRole('button', { name: 'Check the copied bits', exact: true }).elementHandle();
  await click('Decode the full strip'); await detached.evaluate(button => button.click()); await expect(feedback()).not.toContainText('Your notebook records this optional exercise.');
  await bits(''); await expect(feedback()).toContainText('No answer was judged');
  await bits('00011011'); await expect(feedback()).toContainText('does not match the supplied strip'); checked('OPT-MG01-PRACTICE: one symbol, detached callback, blank and wrong full answer never claim completion');
  await click('Try the loom again'); await expect(feedback()).toContainText('Choose practice or the full message'); await page.keyboard.press('Escape'); await expect(panel()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open Bit Loom', exact: true })).toBeFocused();
  await click('Notebook'); await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue('Keep my Clockworks observation through optional Retry.');
  await expect(page.getByRole('dialog', { name: 'Notebook', exact: true })).toContainText('stale'); await click('Close notebook'); checked('OPT-MG01-RETRY: real calibration reading retained stale and notes retained; Escape restores opener focus');
  for (const phase of ['instructions','practice','solving','feedback']) {
    await click('Open Bit Loom'); if (phase !== 'instructions') await click(phase === 'practice' ? 'Practice one symbol' : 'Decode the full strip');
    if (phase === 'feedback') await bits('00011011');
    await click('Leave the Bit Loom'); await expect(panel()).toBeHidden(); await expect(page.getByRole('button', { name: 'Open Bit Loom', exact: true })).toBeFocused();
    await expect(page.locator('.nq-game-location')).toHaveText('The Clockworks');
  }
  checked('OPT-MG01-EXIT: instructions, practice, solving and incorrect-feedback exit safely to the actual captured room');
  await click('Open Bit Loom'); await click('Decode the full strip');
  await page.waitForTimeout(750); await expect(panel().getByRole('timer')).toHaveCount(0); await bits('00101101');
  await expect(feedback()).toContainText('Your notebook records this optional exercise.'); await expect(panel()).not.toContainText('not available in this build'); await expect(panel()).not.toContainText('undefined');
  checked('OPT-MG01-FINISH / UNTIMED: actual full decode completes after pause with no score, timer or media reward');
  await click('Try the loom again'); await expect(feedback()).toContainText('Completion recorded in your journal.'); await click('Decode the full strip'); await bits('00101101'); await expect(feedback()).toContainText('already records this optional loom exercise');
  await page.keyboard.press('Escape'); await expect(panel()).toBeHidden(); await expect(page.getByRole('button', { name: 'Open Bit Loom', exact: true })).toBeFocused();
  await click('Open Bit Loom'); await click('Decode the full strip'); await bits('00101101'); await expect(feedback()).toContainText('already records this optional loom exercise');
  checked('OPT-MG01-REPLAY / completed EXIT: same-session retry and later replay preserve the recorded optional completion');
  await panel().getByText('Technical details and sources', { exact: true }).press('Enter');
  const sources = panel().locator('a[target="_blank"]'); assert.ok(await sources.count() > 0);
  for (const link of await sources.all()) { assert.match(await link.getAttribute('href'), /^https:\/\//); assert.match(await link.getAttribute('rel'), /noopener/); }
  await page.keyboard.press('Escape'); await expect(panel()).toBeHidden(); checked('Actual profile/source links and keyboard Escape remain available');
  await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).focus(); await page.keyboard.press('End'); await closeFrame(page);
  for (const width of [1280,390]) {
    await page.setViewportSize({ width, height: 900 }); await click('Open Bit Loom'); await expect(panel().getByRole('heading', { level: 2 })).toBeFocused(); await click('Decode the full strip');
    const metrics = await panel().getByRole('textbox', { name: 'Full message bits', exact: true }).evaluate(node => { const r = node.getBoundingClientRect(); return { font: getComputedStyle(node).fontSize, height: r.height, x: r.x, right: r.right }; });
    assert.equal(metrics.font, '32px'); assert.ok(metrics.height >= 45 && metrics.x >= 0 && metrics.right <= width, JSON.stringify(metrics));
    const size = await panel().evaluate(node => ({ font: getComputedStyle(node).fontSize, width: node.clientWidth, scroll: node.scrollWidth, x: node.getBoundingClientRect().x, right: node.getBoundingClientRect().right }));
    assert.equal(size.font, '32px'); assert.ok(size.scroll <= size.width + 1 && size.x >= 0 && size.right <= width, JSON.stringify(size));
    const summary = panel().getByText('Technical details and sources', { exact: true }); await summary.focus(); await summary.press('Enter');
    const visible = await summary.evaluate(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, focused: document.activeElement === node, unobscured: node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)) }; });
    assert.ok(visible.focused && visible.unobscured && visible.top >= 0 && visible.bottom <= 900, JSON.stringify(visible));
    report.results.push({ name: `${width}px at 200%: contained real input, inherited text and unobscured keyboard focus`, status: 'PASS', metrics, size, visible });
    await page.screenshot({ path: directory + `mg01-${width}-200.png` }); await page.keyboard.press('Escape'); await expect(panel()).toBeHidden(); await expect(page.getByRole('button', { name: 'Open Bit Loom', exact: true })).toBeFocused();
  }
  await click('Open Bit Loom'); report.axe = (await new AxeBuilder({ page }).include('.nq-game').analyze()).violations; assert.deepEqual(report.axe, []); checked('Actual contained frame accessibility scan has zero reported violations');
  assert.deepEqual(report.errors, []); assert.deepEqual(report.requests, []); report.changedSources = [];
  for (const [path, hash] of Object.entries(report.sources)) if (createHash('sha256').update(await readFile(path)).digest('hex') !== hash) report.changedSources.push(path);
  assert.deepEqual(report.changedSources, []);
} catch (error) {
  report.error = String(error); if (page) { report.lastText = (await page.locator('body').innerText()).slice(-14000); await page.screenshot({ path: output.replace('.json', '-failure.png') }); }
} finally {
  await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve)); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ output, pass: report.results.length, error: report.error })); if (report.error) process.exitCode = 1;
