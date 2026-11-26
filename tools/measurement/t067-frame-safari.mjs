// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Derived for the contained-frame revision from t067-safari.mjs, SHA-256 b75740b3fecf0b2c5eaf7f70ec4095aa9655cc1f9079e91963da3e75565ca2df.
// Never navigates the preserved owner-review window7338. No preparation-time browser operations.
/** Real installed Safari, normal AppleScript navigation/window sizing. No security settings. */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { t067Server, calibrateT067 } from './t067-frame-server.ts';
const exec = promisify(execFile), sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const args = process.argv.slice(2);
if (args.some(a => !/^--samples=[1-3]$/.test(a))) throw new Error('Only --samples=1..3 supported');
const samples = Number(args[0]?.split('=')[1] ?? 3);
const output = `docs/evidence/spec001/presentation/t067/frame-revision/safari-${new Date().toISOString().replace(/[:.]/g, '-')}`;
await mkdir(output, { recursive: true });
const toolHashes = {};
for (const file of ['tools/measurement/t067-frame-safari.mjs', 'tools/measurement/t067-frame-server.ts', 'tools/measurement/t067-frame-probe.mjs', 'tools/measurement-browser-probe.ts']) toolHashes[file] = createHash('sha256').update(await readFile(file)).digest('hex');
await writeFile(`${output}/harness.json`, JSON.stringify({ toolHashes, browser: 'Actual installed Safari27.2; exact runtime UA in samples', control: 'Normal Safari AppleScript window/tab/URL dictionary; no JavaScript-from-AppleEvents or global setting changes', samplePairsPerViewport: samples }, null, 2) + '\n');
const rows = [], native = [];
const safari = async code => { const result = await exec('/usr/bin/osascript', ['-e', `tell application "Safari"\n${code}\nend tell`], { timeout: 15000 }); return result.stdout.trim(); };
let windowId = null, surfaceUnavailable = false;
const protectedOwnerWindow = 7338;
const ownedOrigins = new Set();
const assertOwned = async () => {
  if (!windowId || windowId === protectedOwnerWindow) throw new Error('Refusing to operate the protected owner-review window');
  const current = await safari(`return URL of current tab of window id ${windowId}`);
  if (!ownedOrigins.has(new URL(current).origin)) throw new Error('Task window no longer has a task-owned origin; stopping without navigation');
};
const nativeState = async () => ({windowId,frontmost:(await safari('return frontmost'))==='true',windowVisible:(await safari(`return visible of window id ${windowId}`))==='true',tabVisible:(await safari(`return visible of current tab of window id ${windowId}`))==='true'});
const bounds = async () => (await safari(`return bounds of window id ${windowId}`)).split(',').map(v => Number(v.trim()));
const navigate = async url => { await assertOwned(); if (!ownedOrigins.has(new URL(url).origin)) throw new Error('Destination origin not owned'); await safari(`set URL of current tab of window id ${windowId} to ${JSON.stringify(url)}`); };
const wait = async (fn, name, timeout = 120000) => { const began = Date.now(); while (!fn()) { if (Date.now() - began > timeout) throw new Error(`Timeout ${name}`); await sleep(100); } return fn(); };
let launched = false, activationAttempted = false;
for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) for (let pair = 0; pair < samples; pair++) {
  if (surfaceUnavailable) continue;
  const id = `${viewport.width}x${viewport.height}-pair${pair}`;
  const server = await t067Server({ dist: 'dist', log: `${output}/${id}.ndjson` });
  ownedOrigins.add(server.origin);
  try {
    if (pair === 0 && viewport.width === 1280) { const calibration = await calibrateT067(server); await writeFile(`${output}/calibration.json`, JSON.stringify(calibration, null, 2) + '\n'); if (!calibration.valid) throw new Error('Calibration failed'); }
    if (!launched) { await safari(`make new document with properties {URL:${JSON.stringify(`${server.url}?t067=observe`)}}`); windowId = Number(await safari('return id of front window')); await assertOwned(); launched = true; }
    else await navigate(`${server.url}?t067=observe`);
    const loaded = await wait(() => server.reports.find(r => r.type === 'loaded'), 'native Safari first load');
    await assertOwned();
    // One ordinary activation is bounded; no settings or AppleEvents-JS permission.
    if (!activationAttempted) {
      activationAttempted = true;
      await safari(`activate\nset index of window id ${windowId} to 1`);
      await sleep(650);
    }
    const observedVisibility = [...server.reports].reverse().find(row => row.type === 'loaded' || row.type === 'native-visibility');
    native.push({id,check:'native-surface-preflight',state:await nativeState(),loaded,observedVisibility});
    if (observedVisibility?.visibilityState !== 'visible' || observedVisibility?.hidden !== false) {
      surfaceUnavailable = true;
      throw new Error('Native DOM reports hidden/unusable at preflight; no timing sample started. Owner foreground action may be needed.');
    }
    for (let attempt = 0; attempt < 4; attempt++) {
      const report = [...server.reports].reverse().find(r => r.type === 'loaded' || r.type === 'viewport');
      const [width, height] = report.viewport;
      if (width === viewport.width && height === viewport.height) break;
      const rect = await bounds();
      if (rect.length !== 4 || rect.some(n => !Number.isFinite(n))) throw new Error(`Unexpected Safari window geometry ${rect}`);
      await assertOwned();
      await safari(`set bounds of window id ${windowId} to {20, 40, ${20 + rect[2] - rect[0] + viewport.width - width}, ${40 + rect[3] - rect[1] + viewport.height - height}}`);
      await sleep(300);
    }
    const actual = [...server.reports].reverse().find(r => r.type === 'loaded' || r.type === 'viewport');
    const state = await nativeState(), preflightImage = `${output}/${id}-native-preflight.png`;
    native.push({id,geometry:actual,safariWindow:await bounds(),windowId,state,preflightImage,
      surfaceReview:'Actual image must be inspected. DOM visible, native metadata and a completed sample alone do not establish a usable painted native surface.'});
    await exec('/usr/sbin/screencapture',['-x','-l',String(windowId),preflightImage]);
    if (actual.viewport[0] !== viewport.width || actual.viewport[1] !== viewport.height) throw new Error('Native Safari exact viewport could not be sized');
    if (!state.frontmost) {
      surfaceUnavailable = true;
      throw new Error('Native frontmost=false after one bounded activation. Preflight image retained; no timing sample started and no additional activation retries.');
    }
    // Observation page warmed JS; use a newly allocated origin for the measured
    // cold pair below. This server is solely the native size/calibration fixture.
  } catch (error) { rows.push({ id, status: 'setup-failed', error: String(error) }); }
  finally { await server.stop(); }
  if (rows.some(r => r.id === id && r.status === 'setup-failed')) continue;
  const measured = await t067Server({ dist: 'dist', log: `${output}/${id}-measured.ndjson` });
  ownedOrigins.add(measured.origin);
  try {
    for (const cache of ['cold', 'warm']) {
      const before = measured.reports.length;
      await navigate(`${measured.url}?t067=auto&sample=${pair}&cache=${cache}&viewport=${viewport.width}x${viewport.height}`);
      const result = await wait(() => measured.reports.slice(before).find(r => r.type === 'sample'), `Safari ${id} ${cache}`);
      rows.push({ id, cache, ...result, nativeState:await nativeState(), surfaceReviewRequired:true, nativeSurfaceAccepted:false });
      await exec('/usr/sbin/screencapture', ['-x', '-l', String(windowId), `${output}/${id}-${cache}.png`]);
      if (result.status === 'completed' && pair === 0 && viewport.width === 1440 && cache === 'warm') {
        // Actual native tab switch; no document.hidden override or injected event.
        await assertOwned();
        await safari(`tell window id ${windowId}\nset newTab to make new tab with properties {URL:${JSON.stringify(`${measured.origin}/__t067/blank`)}}\nset current tab to newTab\nend tell`); await sleep(2200);
        await safari(`close current tab of window id ${windowId}`); await sleep(2200);
        native.push({ id, check: 'native-tab-background-return', reports: measured.reports.filter(r => r.type === 'native-visibility') });
      }
    }
  } catch (error) {
    const diagnostic = measured.reports.filter(r => r.type === 'progress').slice(-12);
    rows.push({id,status:'harness-failed',error:String(error),lastProgress:diagnostic,nativeState:await nativeState().catch(error => ({error:String(error)}))});
    if (diagnostic.some(row => row.hidden === true)) surfaceUnavailable = true;
  }
  finally { await measured.stop(); }
}
if (windowId && windowId !== protectedOwnerWindow) {
  try { await assertOwned(); await safari(`close window id ${windowId}`); native.push({check:'task-window-cleanup',windowId,closed:true,protectedOwnerWindowUntouched:true}); }
  catch (error) { native.push({check:'task-window-cleanup',windowId,closed:false,error:String(error),interpretation:'No forced close after ownership/control uncertainty.'}); }
}
await writeFile(`${output}/samples.json`, JSON.stringify(rows, null, 2) + '\n');
await writeFile(`${output}/native-controls.json`, JSON.stringify(native, null, 2) + '\n');
const failed = rows.some(r => r.status !== 'completed');
console.log(JSON.stringify({ output, samples: rows.length, failed })); process.exitCode = failed ? 1 : 0;
