// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { firefox } from '@playwright/test';
import { mkdir, writeFile, readFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { localTls } from '../../tests/e2e/support/local-tls.ts';
import { t067Server, calibrateT067 } from './t067-server.ts';

if (process.versions.node !== '26.13.1') throw new Error('Pinned Node 26.13.1 required');
const args = process.argv.slice(2);
if (args.some(a => !/^--samples=[1-3]$/.test(a))) throw new Error('Only --samples=1..3 supported');
const samples = Number(args[0]?.split('=')[1] ?? 3);
const output = `docs/evidence/spec001/presentation/t067/firefox-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const tls = await localTls(), records: object[] = [];
let failed = false;
try {
  const material = { cert: await readFile(path.join(tls.directory, 'leaf.pem')), key: await readFile(path.join(tls.directory, 'leaf.key')), ca: await readFile(path.join(tls.directory, 'ca.pem')) };
  for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) for (let pair = 0; pair < samples; pair++) {
    const id = `${viewport.width}x${viewport.height}-pair${pair}`;
    const server = await t067Server({ dist: 'dist', log: `${output}/${id}.ndjson`, tls: material });
    const profile = path.join(tls.directory, `t067-${id}`); await cp(tls.profile, profile, { recursive: true });
    const context = await firefox.launchPersistentContext(profile, { headless: true, ignoreHTTPSErrors: false, viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference', env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' } });
    try {
      if (pair === 0 && viewport.width === 1280) {
        const calibration = await calibrateT067(server); await writeFile(`${output}/calibration.json`, JSON.stringify(calibration, null, 2) + '\n');
        if (!calibration.valid) throw new Error('Shaping calibration failed; no room acceptance measurement');
      }
      const page = await context.newPage();
      for (const cache of ['cold', 'warm']) {
        const browserErrors: object[] = [];
        page.on('pageerror', error => browserErrors.push({ kind: 'pageerror', message: error.message }));
        await page.goto(`${server.url}?t067=auto&sample=${pair}&cache=${cache}&viewport=${viewport.width}x${viewport.height}`, { waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => (window as unknown as { __nqT067?: { result: unknown } }).__nqT067?.result, undefined, { timeout: 120000 });
        const result = await page.evaluate(() => (window as unknown as { __nqT067: { result: Record<string, unknown> } }).__nqT067.result);
        records.push({ id, cache, browserVersion: context.browser()?.version(), browserErrors, ...result });
        if (result['status'] !== 'completed' || browserErrors.length) failed = true;
        await page.screenshot({ path: `${output}/${id}-${cache}.png`, fullPage: true });
        if (result['status'] === 'completed') await page.locator('.nq-room').screenshot({ path: `${output}/${id}-${cache}-room.png` });
        page.removeAllListeners('pageerror');
      }
    } catch (error) { records.push({ id, status: 'harness-failed', message: String(error) }); failed = true; }
    finally { await context.close(); await server.stop(); }
  }
} finally { await tls.stop(); await writeFile(`${output}/samples.json`, JSON.stringify(records, null, 2) + '\n'); }
console.log(JSON.stringify({ output, samples: records.length, failed })); process.exitCode = failed ? 1 : 0;
