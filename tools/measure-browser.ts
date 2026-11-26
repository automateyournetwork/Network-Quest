// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { firefox, type BrowserContext, type Page } from '@playwright/test';
import { createServer } from 'node:https';
import { cp, mkdir, readFile, realpath, writeFile, appendFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { randomBytes, createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { localTls } from '../tests/e2e/support/local-tls.ts';
import { installMeasurementProbe } from './measurement-browser-probe.ts';

const root = fileURLToPath(new URL('../', import.meta.url));
const base = '/arcade/play/network-quest/';
export function distribution(values: number[]) {
  if (values.some(n => !Number.isFinite(n) || n < 0)) throw new TypeError('Invalid measurement');
  const sorted = [...values].sort((a, b) => a - b), n = sorted.length;
  return { count: n, min: sorted[0] ?? null, median: sorted[Math.ceil(n * .5) - 1] ?? null,
    p95: sorted[Math.ceil(n * .95) - 1] ?? null, max: sorted[n - 1] ?? null };
}
interface ResponseRow { status: number; path: string; encodedBodySize: number; decodedBodySize: number; transferSize: number }
export function summarizeResponses(rows: ResponseRow[]) {
  return { encodedBodyBytes: rows.reduce((n, r) => n + r.encodedBodySize, 0), decodedBodyBytes: rows.reduce((n, r) => n + r.decodedBodySize, 0),
    transferBytes: rows.reduce((n, r) => n + r.transferSize, 0), failed: rows.filter(r => r.status === 0 || r.status >= 400) };
}
export function browserOptions(args: string[]) {
  const options = { samples: 3, frameMs: 3000, cycles: 5 };
  for (const arg of args) {
    const match = /^--(samples|frame-ms|cycles)=(\d+)$/.exec(arg);
    if (!match) throw new Error('Only --samples=1..10 --frame-ms=100..30000 --cycles=1..20 are accepted. No remote URL, storage or claimed shaping.');
    const value = Number(match[2]), key = match[1] === 'frame-ms' ? 'frameMs' : match[1] as 'samples' | 'cycles';
    if (!Number.isSafeInteger(value) || value < (key === 'frameMs' ? 100 : 1) || value > (key === 'frameMs' ? 30000 : key === 'samples' ? 10 : 20)) throw new Error('Profile outside bounds');
    options[key] = value;
  }
  return options;
}

/** Dist-only local gzip server with explicitly recorded test cache policy. */
async function staticServer(directory: string) {
  const dist = await realpath(path.join(root, 'dist'));
  const server = createServer({ cert: await readFile(path.join(directory, 'leaf.pem')), key: await readFile(path.join(directory, 'leaf.key')), minVersion: 'TLSv1.2' });
  let origin = '';
  server.on('request', (req, res) => { void (async () => {
    if (req.headers.host !== new URL(origin).host || req.method !== 'GET') { res.writeHead(403).end(); return; }
    const url = new URL(req.url ?? '/', origin);
    if (!url.pathname.startsWith(base)) { res.writeHead(404).end(); return; }
    if (url.pathname.startsWith(`${base}api/`)) { res.writeHead(503, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }).end('{"code":"unavailable","message":"Static measurement fixture has no account service."}'); return; }
    let relative: string;
    try { relative = decodeURIComponent(url.pathname.slice(base.length)) || 'index.html'; } catch { res.writeHead(400).end(); return; }
    if (relative.split('/').some(p => p.startsWith('.') || p.includes('\\'))) { res.writeHead(404).end(); return; }
    try {
      const filename = await realpath(path.join(dist, relative));
      if (!filename.startsWith(`${dist}${path.sep}`)) { res.writeHead(404).end(); return; }
      const raw = await readFile(filename), gz = gzipSync(raw);
      const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' };
      res.writeHead(200, { 'Content-Type': mime[path.extname(filename)] ?? 'application/octet-stream', 'Content-Encoding': 'gzip', 'Content-Length': gz.length,
        'Cache-Control': relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'Vary': 'Accept-Encoding' }); res.end(gz);
    } catch { res.writeHead(404, { 'Cache-Control': 'no-store' }).end(); }
  })().catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); }); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Local listener missing');
  origin = `https://127.0.0.1:${address.port}`;
  return { url: `${origin}${base}`, stop: async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}

async function room(page: Page, id: string) {
  await page.locator(`.nq-graybox[data-room-id="${id}"][data-rendered="true"]`).waitFor({ timeout: 10000 });
}
async function resources(page: Page) {
  return page.evaluate(() => [...performance.getEntriesByType('navigation'), ...performance.getEntriesByType('resource')].map(value => {
    const r = value as PerformanceResourceTiming;
    return { path: new URL(r.name).pathname, status: r.responseStatus, initiator: r.initiatorType, startMs: r.startTime, durationMs: r.duration,
      encodedBodySize: r.encodedBodySize, decodedBodySize: r.decodedBodySize, transferSize: r.transferSize, protocol: r.nextHopProtocol };
  }));
}
async function scene(page: Page) {
  return page.locator('.nq-graybox').evaluate(node => {
    const d = (node as HTMLElement).dataset, canvas = node.querySelector('canvas')!;
    return { room: d['roomId'], triangles: Number(d['triangles']), drawCalls: Number(d['drawCalls']), geometries: Number(d['geometries']), textures: Number(d['textures']),
      canvasPixels: [canvas.width, canvas.height], viewport: [innerWidth, innerHeight], dpr: devicePixelRatio, gl: window.__nqMeasurement.snapshot(),
      estimatedTextureBytes: null, gpuMemoryBytes: null, textureBytesReason: 'No byte instrumentation in current renderer; handle counts do not establish bytes.' };
  });
}

export async function runBrowserMeasurement(options: ReturnType<typeof browserOptions>) {
  if (process.versions.node !== '26.13.1') throw new Error('Pinned Node 26.13.1 is required');
  const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomBytes(4).toString('hex');
  const output = path.join(root, '.local', 'measurements', `browser-${id}`); await mkdir(output, { recursive: true, mode: 0o700 });
  const log = path.join(output, 'samples.ndjson'); await writeFile(log, '', { flag: 'wx', mode: 0o600 });
  const emit = async (value: object) => appendFile(log, JSON.stringify(value) + '\n');
  const errors: object[] = [];
  const completed: { viewport: { width: number; height: number }; iteration: number; cache: string; failedCount: number; shellReadyMs: number; firstRoomReadyMs: number }[] = [];
  let interrupted = false, activeContext: BrowserContext | undefined;
  const interrupt = () => { interrupted = true; void activeContext?.close().catch(() => {}); };
  process.on('SIGINT', interrupt); process.on('SIGTERM', interrupt);
  let local: Awaited<ReturnType<typeof localTls>> | undefined, server: Awaited<ReturnType<typeof staticServer>> | undefined;
  try {
    local = await localTls(); server = await staticServer(local.directory);
    const mac = process.platform === 'darwin' ? { hardware: execFileSync('/usr/sbin/sysctl', ['-n', 'hw.model'], { encoding: 'utf8' }).trim(),
      macOS: execFileSync('/usr/bin/sw_vers', ['-productVersion'], { encoding: 'utf8' }).trim() } : {};
    await emit({ type: 'profile', schema: 1, scope: 'development-graybox-only', utc: new Date().toISOString(), node: process.version,
      host: { platform: os.platform(), release: os.release(), architecture: os.arch(), memoryBytes: os.totalmem(), logicalCpus: os.cpus().length, cpu: os.cpus()[0]?.model, ...mac },
      browser: 'Playwright Firefox, headless, disposable trusted NSS profile per cold sample; exact version in sample',
      network: 'loopback HTTPS/HTTP1.1, no bandwidth/latency shaping, gzip generated by measurement server, no production cache/host claim',
      cache: 'fresh profile/browser for cold; ordinary navigation in same profile for warm. Hashed assets immutable one year; HTML no-cache; API no-store.',
      workload: `shell -> click New Adventure -> R01 frame window -> R02 frame window -> ${options.cycles} R01/R02 cycles -> text mode -> low detail -> new adventure disposal`,
      viewports: [[1280, 720], [1440, 900]], deviceScaleFactor: 1, reducedMotion: 'no-preference', options,
      frameMetric: 'rAF display cadence and intervals containing GL submissions, not game FPS or GPU time; current graybox is event-driven',
      sourceHash: createHash('sha256').update(await readFile(path.join(root, 'src/presentation/introduction-graybox.ts'))).digest('hex'),
      toolHashes: Object.fromEntries(await Promise.all(['tools/measure-browser.ts', 'tools/measurement-browser-probe.ts'].map(async name => [name, createHash('sha256').update(await readFile(path.join(root, name))).digest('hex')]))),
      distIndexHash: createHash('sha256').update(await readFile(path.join(root, 'dist/index.html'))).digest('hex') });
    const distFiles = await readdir(path.join(root, 'dist'), { recursive: true, withFileTypes: true });
    await emit({ type: 'dist-manifest', files: await Promise.all(distFiles.filter(f => f.isFile()).map(async f => {
      const filename = path.join(f.parentPath, f.name), bytes = await readFile(filename);
      return { path: path.relative(path.join(root, 'dist'), filename), bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
    })) });
    for (const viewport of [{ width: 1280, height: 720 }, { width: 1440, height: 900 }]) {
      for (let iteration = 0; iteration < options.samples; iteration++) {
        if (interrupted) throw new Error('Measurement interrupted');
        const profile = path.join(local.directory, `profile-${viewport.width}-${iteration}`); await cp(local.profile, profile, { recursive: true });
        let context: BrowserContext | undefined;
        try {
          context = await firefox.launchPersistentContext(profile, { headless: true, ignoreHTTPSErrors: false, viewport, deviceScaleFactor: 1, reducedMotion: 'no-preference',
            env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' } });
          activeContext = context;
          await context.addInitScript(() => performance.setResourceTimingBufferSize(10000));
          await context.addInitScript(installMeasurementProbe);
          const page = await context.newPage(); page.setDefaultTimeout(10000);
          for (const cache of ['cold', 'warm'] as const) {
            if (interrupted) throw new Error('Measurement interrupted');
            const failed: object[] = []; const responseRows: object[] = [];
            const onError = (error: Error) => failed.push({ kind: 'pageerror', message: error.message });
            const onRequest = (request: import('@playwright/test').Request) => failed.push({ kind: 'requestfailed', path: new URL(request.url()).pathname, message: request.failure()?.errorText });
            const onResponse = (response: import('@playwright/test').Response) => { const row = { kind: 'http', status: response.status(), path: new URL(response.url()).pathname }; responseRows.push(row); if (response.status() >= 400) failed.push(row); };
            page.on('pageerror', onError); page.on('requestfailed', onRequest); page.on('response', onResponse);
            const sample = { type: 'sample', viewport, iteration, cache }; const began = Date.now();
            try {
              await page.goto(server.url, { waitUntil: 'load' });
              const button = (name: string) => page.getByRole('button', { name, exact: true });
              await button('New Adventure').waitFor();
              const shellReadyMs = await page.evaluate(() => performance.now()); const shell = await resources(page);
              await button('New Adventure').click(); await room(page, 'spec001:R01');
              const firstRoomReadyMs = await page.evaluate(() => performance.now()), firstRoomResources = await resources(page);
              const phases: object[] = [];
              for (const current of ['spec001:R01', 'spec001:R02']) {
                if (current.endsWith('R02')) { await button('Walk').click(); await button("Walk to The Titan's Workshop").click(); await room(page, current); }
                const before = await scene(page); await page.evaluate(() => window.__nqMeasurement.begin());
                await page.waitForTimeout(options.frameMs);
                const frames = await page.evaluate(() => window.__nqMeasurement.end());
                phases.push({ phase: current, scene: before, frameIntervalsMs: distribution(frames.frameIntervals), rawFrameIntervalsMs: frames.frameIntervals,
                  intervalsWithGlSubmissions: frames.renderedIntervals, visibilityChanges: frames.visibilityChanges, visibilityState: frames.visibilityState, droppedFrames: frames.droppedFrames });
              }
              const disposal: object[] = [];
              for (let cycle = 0; cycle < options.cycles; cycle++) {
                await button('Walk').click(); await button('Walk to The Arrival Lift').click(); await room(page, 'spec001:R01');
                await button("Walk to The Titan's Workshop").click(); await room(page, 'spec001:R02'); disposal.push({ cycle, ...(await scene(page)) });
              }
              await button('Text scene').click(); await page.locator('.nq-graybox').waitFor({ state: 'detached' });
              const textDisposal = await page.evaluate(() => window.__nqMeasurement.snapshot());
              await button('Low detail scene').click(); await room(page, 'spec001:R02'); const low = await scene(page);
              await button('New Adventure').click(); await button('Start new adventure').click(); await room(page, 'spec001:R01');
              const reset = await scene(page);
              const allResources = await resources(page);
              // Firefox's favicon requests can appear in Resource Timing without
              // a Playwright response event. Preserve both observation channels.
              for (const row of allResources.filter(row => row.status >= 400)) {
                if (!failed.some(value => (value as { path?: string; status?: number }).path === row.path && (value as { status?: number }).status === row.status)) failed.push({ kind: 'resource-http', status: row.status, path: row.path });
              }
              completed.push({ viewport, iteration, cache, failedCount: failed.length, shellReadyMs, firstRoomReadyMs });
              await emit({ ...sample, status: failed.length ? 'completed-with-failures' : 'completed', elapsedMs: Date.now() - began,
                browserVersion: context.browser()?.version(), userAgent: await page.evaluate(() => navigator.userAgent), shellReadyMs, firstRoomReadyMs,
                shellResources: shell, shellTotals: summarizeResponses(shell), firstRoomResources, firstRoomTotals: summarizeResponses(firstRoomResources),
                phases, disposal, textDisposal, low, reset, allResources, responses: responseRows, failed,
                budgetAcceptance: false, limits: 'Static graybox, unshaped local network, event-driven renderer, unavailable account API; no G3 or whole-episode claim.' });
            } catch (error) {
              const failure = { ...sample, status: 'failed', elapsedMs: Date.now() - began, error: error instanceof Error ? error.message : String(error), failed, responses: responseRows };
              errors.push(failure); await emit(failure);
            } finally { page.off('pageerror', onError); page.off('requestfailed', onRequest); page.off('response', onResponse); }
          }
        } catch (error) { const failure = { type: 'startup-failure', viewport, iteration, error: error instanceof Error ? error.message : String(error) }; errors.push(failure); await emit(failure); }
        finally { await context?.close(); activeContext = undefined; }
      }
    }
  } catch (error) { const failure = { type: 'harness-error', error: error instanceof Error ? error.message : String(error) }; errors.push(failure); await emit(failure); }
  finally { process.off('SIGINT', interrupt); process.off('SIGTERM', interrupt); await server?.stop(); await local?.stop(); await emit({ type: 'cleanup', disposableServersAndProfilesStopped: true }); }
  await emit({ type: 'summary', completed, harnessFailures: errors, budgetAcceptance: false });
  return { output, harnessFailures: errors.length, completedSamples: completed.length, samplesWithRecordedFailures: completed.filter(s => s.failedCount > 0).length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) console.log('node tools/measure-browser.ts [--samples=3] [--frame-ms=3000] [--cycles=5]\nRequires an existing dist build and serialized browser slot. Saves every sample under .local/measurements. No install, deployment or network shaping.');
  else { try { const result = await runBrowserMeasurement(browserOptions(process.argv.slice(2))); console.log(JSON.stringify(result)); process.exitCode = result.harnessFailures ? 1 : 0; }
    catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 2; } }
}
