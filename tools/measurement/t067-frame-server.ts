// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Derived for the contained-frame revision from t067-server.ts, SHA-256 ccdc457473bb868f71f88268dac12bcff153de64823183b15a19576b37347ceb.
// Historical helper and evidence remain unchanged.
/** Frozen, loopback-only guest fixture. No provider/account storage or global shaping. */
import http, { type ServerResponse } from 'node:http';
import https from 'node:https';
import { readFile, readdir, realpath, appendFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { createHash, randomBytes } from 'node:crypto';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { installMeasurementProbe } from '../measurement-browser-probe.ts';
import { installT067FrameProbe } from './t067-frame-probe.mjs';

export const gameBase = '/arcade/play/network-quest/';
export const sha256 = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
const mime: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.mp3': 'audio/mpeg', '.glb': 'model/gltf-binary' };

/** One shared FIFO paced writer. No per-request multiplication of bandwidth. */
class Downstream {
  private cursor = 0;
  private timers = new Map<ReturnType<typeof setTimeout>, () => void>();
  private closed = false;
  async send(res: ServerResponse, bytes: Buffer) {
    // Queue each 8 KiB slice by its byte cost. Cursor bounds aggregate throughput.
    this.cursor = Math.max(this.cursor, performance.now());
    for (let offset = 0; offset < bytes.length; offset += 8192) {
      if (res.destroyed || this.closed) return;
      const chunk = bytes.subarray(offset, Math.min(offset + 8192, bytes.length));
      this.cursor += chunk.length / 2500;
      await new Promise<void>(resolve => {
        const timer = setTimeout(() => { this.timers.delete(timer); resolve(); }, Math.max(0, this.cursor - performance.now()));
        this.timers.set(timer, resolve);
      });
      if (!res.destroyed && !this.closed) res.write(chunk);
    }
    if (!res.destroyed && !this.closed) res.end();
  }
  close() { this.closed = true; for (const [timer, resolve] of this.timers) { clearTimeout(timer); resolve(); } this.timers.clear(); }
}

export async function t067Server(options: { dist?: string; log: string; tls?: { cert: Buffer; key: Buffer; ca: Buffer }; calibrationOnly?: boolean }) {
  const frozen = new Map<string, { raw: Buffer; compressed: Buffer; sha256: string }>();
  if (!options.calibrationOnly) {
    if (!options.dist) throw new Error('Explicit frozen dist required');
    const directory = await realpath(options.dist);
    for (const f of await readdir(directory, { recursive: true, withFileTypes: true })) {
      if (!f.isFile()) continue;
      const filename = path.join(f.parentPath, f.name), actual = await realpath(filename);
      if (!actual.startsWith(directory + path.sep)) throw new Error('Dist escapes fixture root');
      const relative = path.relative(directory, filename).split(path.sep).join('/');
      const raw = await readFile(actual); frozen.set(relative, { raw, compressed: gzipSync(raw), sha256: sha256(raw) });
    }
    if (!frozen.has('index.html')) throw new Error('Frozen index missing');
  }
  const probe = Buffer.from(`(${installMeasurementProbe.toString()})();\n(${installT067FrameProbe.toString()})();\n`);
  const downstream = new Downstream(), reports: Record<string, unknown>[] = [], requestRows: Record<string, unknown>[] = [], pending = new Set<Promise<void>>();
  const server = options.tls ? https.createServer({ ...options.tls, minVersion: 'TLSv1.2' }) : http.createServer();
  let origin = '', stopping = false;
  const emit = async (row: object) => appendFile(options.log, JSON.stringify(row) + '\n');
  const serve = async (req: http.IncomingMessage, res: ServerResponse) => {
    const started = performance.now();
    if (req.headers.host !== new URL(origin).host) { res.writeHead(403).end(); return; }
    const url = new URL(req.url ?? '/', origin);
    if (url.pathname === '/__t067/report' && req.method === 'POST') {
      if (req.headers.origin !== origin || req.headers['content-type'] !== 'application/json') { res.writeHead(403).end(); return; }
      const chunks: Buffer[] = []; let length = 0;
      for await (const chunk of req) { length += chunk.length; if (length > 8_388_608) { res.writeHead(413).end(); return; } chunks.push(chunk); }
      try { const value = JSON.parse(Buffer.concat(chunks).toString()); reports.push(value); await emit({ type: 'browser-report', receivedAt: new Date().toISOString(), value }); res.writeHead(204).end(); }
      catch { res.writeHead(400).end(); }
      return;
    }
    if (req.method !== 'GET') { res.writeHead(405).end(); return; }
    let body: Buffer, status = 200, headers: Record<string, string> = { 'Cache-Control': 'no-store' }, sourceHash: string | undefined, instrumentedHtml = false;
    const calibration = /^\/__t067\/calibration\/(1|2097152|8388608)$/.exec(url.pathname);
    if (calibration) { body = randomBytes(Number(calibration[1])); headers['Content-Type'] = 'application/octet-stream'; }
    else if (url.pathname === '/__t067/blank' && !options.calibrationOnly) { body = Buffer.from('<!doctype html><title>Native tab visibility control</title><p>Task-owned visibility control.</p>'); headers['Content-Type'] = 'text/html'; }
    else if (url.pathname === '/__t067/probe.js' && !options.calibrationOnly) { body = probe; headers['Content-Type'] = 'text/javascript'; }
    else if (!options.calibrationOnly && url.pathname.startsWith(gameBase + 'api/')) {
      status = 503; body = Buffer.from('{"code":"unavailable","message":"Static representative-room fixture has no account service."}'); headers['Content-Type'] = 'application/json';
    } else if (!options.calibrationOnly && url.pathname.startsWith(gameBase)) {
      const relative = url.pathname.slice(gameBase.length) || 'index.html', file = frozen.get(relative);
      if (!file) { status = 404; body = Buffer.alloc(0); }
      else {
        sourceHash = file.sha256; body = file.compressed;
        headers = { 'Content-Type': mime[path.extname(relative)] ?? 'application/octet-stream', 'Content-Encoding': 'gzip',
          'Cache-Control': relative.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache', 'Vary': 'Accept-Encoding' };
        // Native media elements can request a bounded byte range for metadata.
        // Serve MP3's original encoded bytes with honest Content-Range, not a
        // slice of a gzip stream. This fixture never rewrites the audio export.
        if (relative.endsWith('.mp3')) {
          body = file.raw; delete headers['Content-Encoding']; headers['Accept-Ranges'] = 'bytes';
          if (req.headers.range) {
            const range = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range), start = range ? Number(range[1]) : -1;
            const end = range?.[2] ? Math.min(Number(range[2]), body.length - 1) : body.length - 1;
            if (!range || start < 0 || start > end || start >= body.length) { status = 416; headers['Content-Range'] = `bytes */${body.length}`; body = Buffer.alloc(0); }
            else { status = 206; headers['Content-Range'] = `bytes ${start}-${end}/${body.length}`; body = body.subarray(start, end + 1); }
          }
        }
        if (relative === 'index.html' && url.searchParams.get('t067') !== 'review') {
          instrumentedHtml = true;
          body = gzipSync(Buffer.from(file.raw.toString().replace('<head>', '<head><script src="/__t067/probe.js"></script>')));
        }
      }
    } else { status = 404; body = Buffer.alloc(0); }
    const row = { type: 'response', path: url.pathname, status, bodyBytes: body.length, sourceSha256: sourceHash,
      servedEncodedBodySha256: sha256(body), instrumentedHtml, requestedAt: new Date().toISOString(),
      firstByteMs: 0, completedMs: 0, aborted: false };
    requestRows.push(row);
    await new Promise(resolve => setTimeout(resolve, 50));
    if (res.destroyed || stopping) { row.aborted = true; await emit(row); return; }
    headers['Content-Length'] = String(body.length); res.writeHead(status, headers); res.flushHeaders(); row.firstByteMs = performance.now() - started;
    await downstream.send(res, body); row.completedMs = performance.now() - started; row.aborted = (res.destroyed || stopping) && !res.writableFinished; await emit(row);
  };
  server.on('request', (req, res) => { const work = serve(req, res).catch(async error => { await emit({ type: 'server-error', message: String(error) }); if (!res.headersSent) res.writeHead(500); res.end(); }); pending.add(work); void work.finally(() => pending.delete(work)); });
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address(); if (!address || typeof address === 'string') throw new Error('Fixture listener missing');
  origin = `${options.tls ? 'https' : 'http'}://127.0.0.1:${address.port}`;
  const manifest = [...frozen].map(([filename, f]) => ({ path: filename, bytes: f.raw.length, gzipBytes: f.compressed.length, sha256: f.sha256 }));
  await emit({ type: 'fixture', origin, probeSha256: sha256(probe), probeBytes: probe.length, transport: options.tls ? 'Verified local TLS/HTTP1.1' : 'Native Safari guest-only loopback HTTP; no HTTPS/provider/service acceptance',
    shaping: { aggregateDownstreamBytesPerSecond: 2500000, responseLatencyMs: 50, chunkBytes: 8192, method: 'Application response scheduling, not physical-link/OS shaping. Upload, DNS and TCP/TLS handshake latency are not emulated.' }, manifest });
  return { origin, url: origin + gameBase, reports, requestRows, manifest, probeSha256: sha256(probe), ca: options.tls?.ca,
    stop: async () => { stopping = true; server.closeAllConnections(); downstream.close(); await Promise.allSettled([...pending]); await new Promise<void>(resolve => server.close(() => resolve())); await emit({ type: 'cleanup', serverStopped: true, pendingRequests: pending.size }); } };
}

export async function calibrateT067(server: Awaited<ReturnType<typeof t067Server>>) {
  const measure = async (size: number) => {
    const begin = performance.now();
    return new Promise<{ requestedBytes: number; receivedBytes: number; status: number; headersMs: number; totalMs: number; payloadMbps: number }>((resolve, reject) => {
      const handle = (response: http.IncomingMessage) => {
        const headersMs = performance.now() - begin; let receivedBytes = 0;
        response.on('data', chunk => { receivedBytes += chunk.length; }); response.on('error', reject);
        response.on('end', () => { const totalMs = performance.now() - begin; resolve({ requestedBytes: size, receivedBytes, status: response.statusCode ?? 0, headersMs, totalMs, payloadMbps: size * 8 / (totalMs - headersMs) / 1000 }); });
      };
      const url = `${server.origin}/__t067/calibration/${size}`;
      const request = server.ca ? https.get(url, { ca: server.ca, rejectUnauthorized: true }, handle) : http.get(url, handle);
      request.on('error', reject);
    });
  };
  const latency = await measure(1), single = await measure(8388608);
  const begin = performance.now(), concurrent = await Promise.all(Array.from({ length: 4 }, () => measure(2097152))), elapsedMs = performance.now() - begin;
  const aggregateMbps = 8388608 * 8 / (elapsedMs - Math.min(...concurrent.map(r => r.headersMs))) / 1000;
  const valid = [latency, single, ...concurrent].every(r => r.status === 200 && r.requestedBytes === r.receivedBytes && r.headersMs >= 48)
    && single.payloadMbps >= 18 && single.payloadMbps <= 20.6 && aggregateMbps >= 18 && aggregateMbps <= 20.6;
  return { latency, single, concurrent, elapsedMs, aggregateMbps, valid,
    interpretation: 'Observed local HTTP response timing/aggregate body throughput; not physical WAN RTT or TCP throughput.' };
}
