// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Real guest journey against the independently built static client. No injected state.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { preview } from 'vite';
import { firefox, expect } from '@playwright/test';
import { clickButton, closeFrame } from '../../../../../tests/e2e/support/adventure-controls.ts';

const output = 'docs/evidence/spec001/party/root-checks/';
const report = { scope: 'Actual built copper guest route, R11 rendering and safe Backhoe discovery', checks: [], errors: [], requests: [] };
const server = await preview({ preview: { port: 0, host: '127.0.0.1' }, logLevel: 'error' });
let browser, page;
try {
  browser = await firefox.launch({ headless: true });
  report.browser = browser.version();
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page = await context.newPage(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(error.message));
  page.on('request', request => { const url = new URL(request.url()); if (url.pathname.includes('/api/') || request.method() !== 'GET') report.requests.push({ method: request.method(), path: url.pathname }); });
  const click = async name => { if (['Diagnostics', 'Compendium'].includes(name)) await closeFrame(page); await clickButton(page, name); };
  const walk = async (name, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await expect(page.locator('.nq-game-location')).toHaveText(name); await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true'); };
  const measure = async complete => {
    await click('Diagnostics'); await click('Take measurement');
    const panel = page.getByRole('dialog', { name: 'Diagnostics', exact: true });
    await panel.locator('ol[aria-label="Recorded measurements"] > li').last().getByRole('button', { name: 'Submit this reading', exact: true }).click();
    if (complete) await expect(panel).toContainText('Objective complete.');
    await click('Close diagnostics');
  };
  await page.goto(`http://127.0.0.1:${server.httpServer.address().port}/arcade/play/network-quest/`);
  await click('New Adventure'); await click('Look'); await click('Look at power indication'); await click('Look at link indication');
  await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue'); await click('Use'); await click('Inspect physical path');
  await walk("The Titan's Workshop"); await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue');
  await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
  await click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Compare observations before and after intervention, then test endpoint service.');
  await click('Pin hypothesis'); await click('Close notebook'); await click('Continue as guest');
  await walk('The Copper Warrens'); await click('Use'); await click('Read and keep the supplied compatibility card');
  await click('Read and keep the diagnosed-defect card; this is not a performed measurement'); await measure(false);
  await click('Use'); await click('Fit the supplied replacement section: 85 m + 10 m'); await measure(true);
  await walk('The Echo Cavern'); await click('Use'); await click('Read and keep the before-record instructions; retain an actual measured open result');
  await click('Read and keep the repeater role and limits'); await click('Conclude: a repeater needs the physical connection restored'); await measure(true);
  await walk('The Copper Warrens'); await walk("The Titan's Workshop");
  await walk('The Shell Market'); await click('Use'); await click('Read and record all separate equipment checks');
  await click('Select 100/full'); await click('Choose complete kit B: 12 W + 11 W + 7 W'); await measure(true);
  await walk("The Titan's Workshop"); await walk('The Clockworks'); await click('Use');
  await click('Read and record the physical-role and upper-layer explanation'); await click('Use untimed step-by-step decoding');
  await click('Explain: sample physical signals representing bits; this does not discover addresses');
  for (const [position, pair] of ['00', '10', '11', '01'].entries()) { await click(`Inspect sample position ${position}`); await click(`Write ${pair} for sample position ${position}`); }
  await measure(true); await walk('The Backhoe Rift', 'Walk toward The Backhoe Rift');
  report.checks.push('Actual copper, market and Clockworks guest route reaches a rendered Rift');
  await click('Look'); await click('Backhoe of Doom'); await click('Compendium');
  await expect(page.getByRole('dialog', { name: 'Compendium', exact: true })).toContainText('Backhoe of Doom');
  report.checks.push('Actual Backhoe Look discovers its canonical compendium entry');
  await click('Close compendium'); await closeFrame(page);
  await expect(page.getByRole('dialog', { name: 'A Shortcut Too Short', exact: true })).toBeHidden();
  await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
  await page.screenshot({ path: output + 'backhoe-actual.png' });
  assert.deepEqual(report.errors, []); assert.deepEqual(report.requests, []);
  report.checks.push('Look leaves the rendered safe scene intact without hazard, API request or save');
} catch (error) {
  report.error = String(error);
  if (page) { report.lastText = (await page.locator('body').innerText()).slice(-10000); await page.screenshot({ path: output + 'backhoe-built-failure.png' }); }
} finally {
  await browser?.close(); await new Promise(resolve => server.httpServer.close(resolve));
  await writeFile(output + 'backhoe-built-result.json', JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ pass: report.checks.length, error: report.error }));
if (report.error) process.exitCode = 1;
