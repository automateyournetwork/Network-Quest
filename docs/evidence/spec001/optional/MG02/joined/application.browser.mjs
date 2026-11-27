// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual built guest journey; no game-state, account, save, verdict or receipt injection.
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { preview } from 'vite';
import { firefox, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { clickButton, closeFrame, openFrame } from '../../../../../../tests/e2e/support/adventure-controls.ts';
const directory = '/Users/john.capobianco/Network-Quest/docs/evidence/spec001/optional/MG02/joined/';
const output = process.argv[2] ?? directory + '12-native-initial.json';
const report = { task: 'T102', scope: 'Isolated reviewed MG01 plus actual MG02 built guest journey. No current-tree acceptance, performance, OS foreground, provider or account transport claims.', observedAt: new Date().toISOString(), results: [], errors: [], requests: [], sources: {} };
const paths = ['src/state/optional-activities.ts','src/state/optional-optical-bench.ts','src/content/optional-activities.ts','src/content/optional-optical-bench.ts','src/state/reducer.ts','src/ui/optional-activities.ts','src/ui/optional-activities.css','src/ui/action-bus.ts','src/app/application.ts','src/app/application.css','src/app/content.ts','content/spec001/minigames/MG02.json','content/spec001/rooms/R05.json','content/spec001/rooms/R06.json','content/spec001/world.json','content/schemas/content.schema.json','dist/.vite/manifest.json','docs/evidence/spec001/optional/MG02/joined/application.browser.mjs'];
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
  const click = async name => { if (['Diagnostics','Open Prism Budget Bench'].includes(name)) await closeFrame(page); await clickButton(page, name); };
  const walk = async name => { await click('Walk'); await click(`Walk to ${name}`); await expect(page.locator('.nq-game-location')).toHaveText(name); };
  const diagnose = async (receive, margin, reserve = 'shortfall', overload = 'not-overloaded') => {
    await panel().getByRole('spinbutton', { name: 'Predicted receive power (dBm)', exact: true }).fill(receive);
    await panel().getByRole('spinbutton', { name: 'Predicted margin above sensitivity (dB)', exact: true }).fill(margin);
    await panel().getByLabel('Does it meet the required 2 dB reserve?', { exact: true }).selectOption(reserve);
    await panel().getByLabel('Does receive exceed the −1 dBm maximum?', { exact: true }).selectOption(overload);
    await click('Check my diagnosis');
  };
  const verifyObjective = async () => { await click('Diagnostics'); await click('Take measurement'); const d = page.getByRole('dialog', { name: 'Diagnostics', exact: true });
    await d.locator('ol[aria-label="Recorded measurements"] > li').last().getByRole('button', { name: 'Submit this reading', exact: true }).click(); await expect(d).toContainText('Objective complete.'); await click('Close diagnostics'); };
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/arcade/play/network-quest/`);
  await click('New Adventure'); await click('Look'); await click('Look at power indication'); await click('Look at link indication'); await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue'); await click('Use'); await click('Inspect physical path');
  await walk("The Titan's Workshop"); await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue'); await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
  await click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Check compatibility, receive reserve and overload separately.'); await click('Pin hypothesis'); await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill('Keep the optical observation through optional Retry.'); await click('Close notebook'); await click('Continue as guest');
  await walk('The Photon Gardens'); await walk('The Prism Vault'); await closeFrame(page);
  await expect(page.getByRole('button', { name: 'Complete the Prism Vault fiber verification to unlock this optional bench.', exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Complete the Prism Vault fiber verification to unlock this optional bench.', exact: true })).toContainText('complete fiber verification first');
  await expect(panel()).toBeHidden(); checked('OPT-MG02-LOCKED: actual room exposes a clear disabled unlock explanation before fiber verification');
  await walk('The Photon Gardens'); await click('Use');
  for (const text of ['Read and keep all five supplied compatibility checks','Select the supplied fully matching optic/fiber pair: all five fields match','Inspect the original connection at the dock before any intervention','Have the dock clean the inspected connection with the supplied suitable cleaning station','Reinspect the cleaned connection to confirm the diagnosed defect was removed']) await click(text);
  await verifyObjective(); await walk('The Prism Vault'); await click('Use');
  await click('Read and keep the current compatibility and inspection reminder'); await click('Select passive path B: total loss 9 dB'); await verifyObjective();
  checked('OPT-MG02-SKIP: actual O05 preparation and O06 inclusive-boundary path finish before opening the optional bench');
  await closeFrame(page); await page.getByRole('button', { name: 'Open Prism Budget Bench', exact: true }).press('Enter');
  await expect(panel().getByRole('heading', { level: 2 })).toBeFocused(); await expect(panel()).toContainText('Optional · Untimed'); await expect(panel().getByRole('timer')).toHaveCount(0);
  await expect(panel()).not.toContainText('undefined'); await expect(panel()).not.toContainText('PHY03'); checked('OPT-MG02-START: actual keyboard opener, focus, instructions, practice/full controls and no timer');
  await click('Practice the 8 dB card'); await diagnose('-11','3','met'); await expect(feedback()).toContainText('3 dB margin'); await expect(feedback()).toContainText('grants no completion');
  const detached = await panel().getByRole('button', { name: 'Check my diagnosis', exact: true }).elementHandle();
  await click('Diagnose the 10 dB card'); await detached.evaluate(button => button.click()); await expect(feedback()).not.toContainText('Your notebook records');
  await diagnose('',''); await expect(feedback()).toContainText('No answer was judged'); await diagnose('-13','-1'); await expect(feedback()).toContainText('does not match');
  await diagnose('-13','1','met'); await expect(feedback()).toContainText('reserve shortfall and no overload');
  checked('OPT-MG02-PRACTICE: worked practice, detached callback, blank, signed wrong margin and wrong reserve never claim completion');
  await click('See the exact-reserve boundary'); await expect(panel()).toContainText('exactly 2 dB'); await click('Read compatibility comparisons');
  await expect(panel()).toContainText('wavelength direction does not match'); await expect(panel()).toContainText('inspection status'); await expect(panel()).not.toContainText('Your notebook records the optional diagnosis');
  checked('Actual T15 and compatibility explanations keep reserve, overload, connector and inspection scope distinct without granting completion');
  await click('Try the bench again'); await expect(feedback()).toContainText('Choose practice or diagnose the full card'); await page.keyboard.press('Escape'); await expect(panel()).toBeHidden();
  await expect(page.getByRole('button', { name: 'Open Prism Budget Bench', exact: true })).toBeFocused();
  await click('Notebook'); await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue('Keep the optical observation through optional Retry.'); await expect(page.getByRole('dialog', { name: 'Notebook', exact: true })).toContainText('stale'); await click('Close notebook');
  checked('OPT-MG02-RETRY: actual fiber measurements become stale, notes persist and Escape returns opener focus');
  for (const phase of ['instructions','practice','solving','feedback']) {
    await click('Open Prism Budget Bench'); if (phase !== 'instructions') await click(phase === 'practice' ? 'Practice the 8 dB card' : 'Diagnose the 10 dB card');
    if (phase === 'feedback') await diagnose('-13','1','met'); await click('Leave the Prism Bench'); await expect(panel()).toBeHidden();
    await expect(page.getByRole('button', { name: 'Open Prism Budget Bench', exact: true })).toBeFocused(); await expect(page.locator('.nq-game-location')).toHaveText('The Prism Vault');
  }
  checked('OPT-MG02-EXIT: all unfinished phases close at the captured Prism Vault entry without navigation');
  await click('Open Prism Budget Bench'); await click('Diagnose the 10 dB card'); await page.waitForTimeout(750); await diagnose('-13','1');
  await expect(feedback()).toContainText('reserve fails, overload is absent'); await expect(feedback()).toContainText('equipment has not changed'); await expect(panel()).not.toContainText('not available in this build');
  checked('OPT-MG02-FINISH / UNTIMED: correct diagnosis of failed physical plan completes after pause without timer, score or media award');
  await click('Try the bench again'); await expect(feedback()).toContainText('Completion recorded in your journal.'); await click('Diagnose the 10 dB card'); await diagnose('-13','1'); await expect(feedback()).toContainText('already records');
  await page.keyboard.press('Escape'); await click('Open Prism Budget Bench'); await click('Diagnose the 10 dB card'); await diagnose('-13','1'); await expect(feedback()).toContainText('already records');
  checked('OPT-MG02-REPLAY / completed EXIT: same-session Retry and later session retain the earned completion');
  await panel().getByText('Technical details and sources', { exact: true }).press('Enter'); const sources = panel().locator('a[target="_blank"]'); assert.ok(await sources.count() > 0);
  for (const link of await sources.all()) { assert.match(await link.getAttribute('href'), /^https:\/\//); assert.match(await link.getAttribute('rel'), /noopener/); } await page.keyboard.press('Escape');
  await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).focus(); await page.keyboard.press('End'); await closeFrame(page);
  for (const width of [1280,390]) {
    await page.setViewportSize({ width, height: 900 }); await click('Open Prism Budget Bench'); await click('Diagnose the 10 dB card');
    const controls = panel().locator('.nq-optical-answer input, .nq-optical-answer select'); const metrics = [];
    for (const node of await controls.all()) { const m = await node.evaluate(n => { const r = n.getBoundingClientRect(); return { font: getComputedStyle(n).fontSize, height: r.height, x: r.x, right: r.right }; }); assert.equal(m.font,'32px'); assert.ok(m.height >=45 && m.x >=0 && m.right <=width,JSON.stringify(m)); metrics.push(m); }
    const size = await panel().evaluate(node => ({ width:node.clientWidth,scroll:node.scrollWidth,x:node.getBoundingClientRect().x,right:node.getBoundingClientRect().right })); assert.ok(size.scroll<=size.width+1 && size.x>=0 && size.right<=width,JSON.stringify(size));
    const input = panel().getByRole('spinbutton',{name:'Predicted receive power (dBm)',exact:true}); await input.focus();
    const focused = await input.evaluate(node => { const r=node.getBoundingClientRect();return { focused:document.activeElement===node,top:r.top,bottom:r.bottom,unobscured:node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)) }; }); assert.ok(focused.focused && focused.unobscured && focused.top>=0 && focused.bottom<=900,JSON.stringify(focused));
    await page.screenshot({path:directory+`mg02-${width}-200.png`}); report.results.push({name:`${width}px at200%: all four answer controls inherit text and fit the contained frame; keyboard focus is visible`,status:'PASS',metrics,size,focused});
    await page.keyboard.press('Escape'); await expect(panel()).toBeHidden(); await expect(page.getByRole('button',{name:'Open Prism Budget Bench',exact:true})).toBeFocused();
  }
  await click('Open Prism Budget Bench'); await click('Diagnose the 10 dB card'); report.axe=(await new AxeBuilder({page}).include('.nq-game').analyze()).violations; assert.deepEqual(report.axe,[]); checked('Actual contained frame accessibility scan has zero reported violations');
  assert.deepEqual(report.errors,[]);assert.deepEqual(report.requests,[]);report.changedSources=[];
  for(const [path,hash] of Object.entries(report.sources)) if(createHash('sha256').update(await readFile(path)).digest('hex')!==hash)report.changedSources.push(path);assert.deepEqual(report.changedSources,[]);
} catch(error) {report.error=String(error);if(page){report.lastText=(await page.locator('body').innerText()).slice(-14000);await page.screenshot({path:output.replace('.json','-failure.png')});}}
finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));await writeFile(output,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({output,pass:report.results.length,error:report.error}));if(report.error)process.exitCode=1;
