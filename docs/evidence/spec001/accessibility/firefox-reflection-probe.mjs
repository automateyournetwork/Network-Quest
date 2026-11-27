// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent minimal diagnostic; no game, identity, server or owner browser.
import { firefox } from 'playwright';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const output = process.argv[2];
if (!output) throw new Error('Supply a report path.');
const executablePath = process.argv[3];
const cases = [];
for (const mode of ['utility-only', 'main-only-twice', 'main-then-utility', 'utility-then-main']) {
  const browser = await firefox.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
  let crashed = false;
  const page = await browser.newPage(); page.setDefaultTimeout(5000);
  page.on('crash', () => { crashed = true; });
  const row = { mode, version: browser.version() };
  try {
    await page.setContent('<main><span id="caption">Keep note</span><button id="action" aria-labelledby="caption"></button></main>');
    const mainRead = () => page.evaluate(() => document.querySelector('#action').ariaLabelledByElements?.length);
    const utilityRead = () => page.getByRole('button', { name: 'Keep note', exact: true }).count();
    if (mode === 'utility-only') row.counts = [await utilityRead(), await utilityRead()];
    if (mode === 'main-only-twice') row.counts = [await mainRead(), await mainRead()];
    if (mode === 'main-then-utility') row.counts = [await mainRead(), await utilityRead()];
    if (mode === 'utility-then-main') row.counts = [await utilityRead(), await mainRead()];
    row.result = row.counts.every(n => n === 1) ? 'PASS' : 'UNEXPECTED_COUNT';
  } catch (error) {
    row.result = crashed ? 'BROWSER_CRASH' : 'ERROR'; row.error = String(error.message).split('\n')[0];
  } finally { row.crashed = crashed; cases.push(row); await browser.close().catch(() => {}); }
}
const manifest = JSON.parse(await readFile(new URL('../../../../node_modules/playwright-core/browsers.json', import.meta.url), 'utf8'));
const report = { recordedAt: new Date().toISOString(), platform: process.platform, architecture: process.arch, node: process.version,
  driverVersion: JSON.parse(await readFile(new URL('../../../../node_modules/playwright/package.json', import.meta.url), 'utf8')).version,
  selectedBrowser: executablePath ? 'Explicit isolated candidate executable; see adjacent provenance' : manifest.browsers.find(b => b.name === 'firefox'),
  probeSha256: createHash('sha256').update(await readFile(new URL(import.meta.url))).digest('hex'), cases,
  scope: 'Minimal cross-world ARIA reflection diagnosis, no application accessibility acceptance' };
await writeFile(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output, cases: cases.map(({ mode, result }) => ({ mode, result })) }));
