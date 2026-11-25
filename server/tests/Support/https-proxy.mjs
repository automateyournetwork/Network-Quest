// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Test-only loopback TLS transport. No environment file, global trust or request logging.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import https from 'node:https';

if (process.versions.node !== '26.13.1') throw new Error('Pinned Node 26.13.1 required.');
const [certificate, key, phpPort] = process.argv.slice(2);
const token = process.env.NQ_PROXY_TOKEN;
if (!/^[a-f0-9]{64}$/.test(token ?? '') || !/^[0-9]+$/.test(phpPort ?? '')) throw new Error('Invalid test transport input.');
let origin;
const sockets = new Set();
const server = https.createServer({ cert: readFileSync(certificate), key: readFileSync(key), minVersion: 'TLSv1.2' }, (req, res) => {
  if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) {
    res.writeHead(403, { 'Cache-Control': 'no-store' }).end(); return;
  }
  const headers = { ...req.headers };
  const hop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailer',
    'transfer-encoding', 'upgrade', ...(req.headers.connection ?? '').toLowerCase().split(/\s*,\s*/)]);
  for (const name of Object.keys(headers)) {
    if (hop.has(name) || name === 'forwarded' || name.startsWith('x-forwarded-') || name.startsWith('x-nq-')
      || ['x-real-ip', 'x-original-url', 'x-rewrite-url'].includes(name)) delete headers[name];
  }
  headers['x-forwarded-proto'] = 'https';
  headers['x-nq-dev-proxy'] = token;
  const upstream = http.request({ host: '127.0.0.1', port: Number(phpPort), path: req.url,
    method: req.method, headers }, (response) => {
    res.writeHead(response.statusCode, response.headers);
    response.pipe(res);
    response.on('error', () => res.destroy());
  });
  upstream.setTimeout(2000, () => upstream.destroy());
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Cache-Control': 'no-store' });
    res.end();
  });
  req.on('error', () => upstream.destroy());
  req.pipe(upstream);
});
server.requestTimeout = 5000;
server.headersTimeout = 5000;
server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
server.on('error', () => { process.stderr.write('Isolated TLS listener failed.\n'); process.exitCode = 1; });
server.listen(0, '127.0.0.1', () => {
  origin = `https://127.0.0.1:${server.address().port}`;
  process.stdout.write(`${JSON.stringify({ origin })}\n`);
});
function stop() {
  for (const socket of sockets) socket.destroy();
  server.close();
}
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
