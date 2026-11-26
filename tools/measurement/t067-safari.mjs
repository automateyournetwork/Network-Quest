// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
/** Real installed Safari, normal AppleScript navigation/window sizing. No security settings. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { t067Server, calibrateT067 } from './t067-server.ts';
const exec = promisify(execFile), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
if (args.some(a => !/^--samples=[1-3]$/.test(a))) throw new Error('Only --samples=1..3 supported');
const samples = Number(args[0]?.split('=')[1] ?? 3);
const output = `docs/evidence/spec001/presentation/t067/safari-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const toolHashes = {};
for (const file of ['tools/measurement/t067-safari.mjs', 'tools/measurement/t067-server.ts', 'tools/measurement/t067-probe.mjs', 'tools/measurement-browser-probe.ts']) toolHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile(`${output}/harness.json`, JSON.stringify({ toolHashes, browser: 'Actual installed Safari27.2; exact runtime UA in samples', control: 'Normal Safari AppleScript window/tab/URL dictionary; no JavaScript-from-AppleEvents or global setting changes', samplePairsPerViewport: samples }, null, 2) + '\n');
const rows = [], native = [];
const safari = async code => { const result = await exec('/usr/bin/osascript', ['-e', `tell application "Safari"\n${code}\nend tell`], { timeout: 15000 }); return result.stdout.trim(); };
let windowId = null;
const bounds = async () => (await safari(`return bounds of window id ${windowId}`)).split(',').map(v => Number(v.trim()));
const navigate = async url => { await safari(`set URL of current tab of window id ${windowId} to ${JSON.stringify(url)}`); };
const wait = async (fn, name, timeout = 120000) => { const began = Date.now(); while (!fn()) { if (Date.now() - began > timeout) throw new Error(`Timeout ${name}`); await sleep(100); } return fn(); };
let launched = false;
for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) for (let pair = 0; pair < samples; pair++) {
  const id = `${viewport.width}x${viewport.height}-pair${pair}`;
  const server = await t067Server({ dist: 'dist', log: `${output}/${id}.ndjson` });
  try {
    if (pair === 0 && viewport.width === 1280) { const calibration = await calibrateT067(server); await writeFile(`${output}/calibration.json`, JSON.stringify(calibration, null, 2) + '\n'); if (!calibration.valid) throw new Error('Calibration failed'); }
    if (!launched) { await safari(`make new document with properties {URL:${JSON.stringify(`${server.url}?t067=observe`)}}`); windowId = Number(await safari('return id of front window')); launched = true; }
    else await navigate(`${server.url}?t067=observe`);
    await wait(() => server.reports.find(r => r.type === 'loaded'), 'native Safari first load');
    for (let attempt = 0; attempt < 4; attempt++) {
      const report = [...server.reports].reverse().find(r => r.type === 'loaded' || r.type === 'viewport');
      const [width, height] = report.viewport;
      if (width === viewport.width && height === viewport.height) break;
      const rect = await bounds();
      if (rect.length !== 4 || rect.some(n => !Number.isFinite(n))) throw new Error(`Unexpected Safari window geometry ${rect}`);
      await safari(`set bounds of window id ${windowId} to {20, 40, ${20 + rect[2] - rect[0] + viewport.width - width}, ${40 + rect[3] - rect[1] + viewport.height - height}}`);
      await sleep(300);
    }
    const actual = [...server.reports].reverse().find(r => r.type === 'loaded' || r.type === 'viewport');
    native.push({ id, geometry: actual, safariWindow: await bounds(), windowId });
    if (actual.viewport[0] !== viewport.width || actual.viewport[1] !== viewport.height) throw new Error('Native Safari exact viewport could not be sized');
    // Observation page warmed JS; use a newly allocated origin for the measured
    // cold pair below. This server is solely the native size/calibration fixture.
  } catch (error) { rows.push({ id, status: 'setup-failed', error: String(error) }); }
  finally { await server.stop(); }
  if (rows.some(r => r.id === id && r.status === 'setup-failed')) continue;
  const measured = await t067Server({ dist: 'dist', log: `${output}/${id}-measured.ndjson` });
  try {
    for (const cache of ['cold', 'warm']) {
      const before = measured.reports.length;
      await navigate(`${measured.url}?t067=auto&sample=${pair}&cache=${cache}&viewport=${viewport.width}x${viewport.height}`);
      const result = await wait(() => measured.reports.slice(before).find(r => r.type === 'sample'), `Safari ${id} ${cache}`);
      rows.push({ id, ...result });
      await exec('/usr/sbin/screencapture', ['-x', '-l', String(windowId), `${output}/${id}-${cache}.png`]);
      if (result.status === 'completed' && pair === 0 && viewport.width === 1440 && cache === 'warm') {
        // Actual native tab switch; no document.hidden override or injected event.
        await safari(`tell window id ${windowId}\nset newTab to make new tab with properties {URL:${JSON.stringify(`${measured.origin}/__t067/blank`)}}\nset current tab to newTab\nend tell`); await sleep(2200);
        await safari(`close current tab of window id ${windowId}`); await sleep(2200);
        native.push({ id, check: 'native-tab-background-return', reports: measured.reports.filter(r => r.type === 'native-visibility') });
      }
    }
  } catch (error) { rows.push({ id, status: 'harness-failed', error: String(error) }); }
  finally { await measured.stop(); }
}
await writeFile(`${output}/samples.json`, JSON.stringify(rows, null, 2) + '\n');
await writeFile(`${output}/native-controls.json`, JSON.stringify(native, null, 2) + '\n');
const failed = rows.some(r => r.status !== 'completed');
console.log(JSON.stringify({ output, samples: rows.length, failed })); process.exitCode = failed ? 1 : 0;
