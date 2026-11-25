// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { spawn, spawnSync } from 'node:child_process';
import { randomBytes, X509Certificate } from 'node:crypto';
import { mkdtemp, readFile, realpath, rm, stat, chmod } from 'node:fs/promises';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer as createViteServer } from 'vite';

const root = fileURLToPath(new URL('..', import.meta.url));
const host = '127.0.0.1';
const gameBase = '/arcade/play/network-quest/';
const apiBase = `${gameBase}api/v1`;
const code = (error) => /^[A-Z0-9_]+$/.test(error?.code ?? '') ? error.code : 'FAILED';

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(); });
  });
}

async function freePort() {
  const reservation = net.createServer();
  await listen(reservation, 0);
  const port = reservation.address().port;
  await new Promise((resolve) => reservation.close(resolve));
  return port;
}

async function privateTlsFile(filename, key = false) {
  if (!filename || !path.isAbsolute(filename)) throw new Error('TLS inputs must be explicit absolute paths. See README.md.');
  const resolved = await realpath(filename);
  const relative = path.relative(root, resolved);
  if (!relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative)
    && !relative.startsWith(`.local${path.sep}`)) {
    throw new Error('Repository TLS files must be under ignored .local/, outside all served directories.');
  }
  const metadata = await stat(resolved);
  if (!metadata.isFile() || (key && process.platform !== 'win32' && (metadata.mode & 0o077))) {
    throw new Error('TLS key must be an owner-only regular file (chmod 600).');
  }
  return readFile(resolved);
}

function proxyHeaders(incoming, origin, token) {
  const headers = { ...incoming };
  const hop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
    'te', 'trailer', 'transfer-encoding', 'upgrade', ...(incoming.connection ?? '').toLowerCase().split(/\s*,\s*/)]);
  for (const name of Object.keys(headers)) {
    if (hop.has(name) || name === 'forwarded' || name.startsWith('x-forwarded-')
      || name.startsWith('x-nq-') || ['x-real-ip', 'x-original-url', 'x-rewrite-url'].includes(name)) delete headers[name];
  }
  const url = new URL(origin);
  return { ...headers, host: url.host, 'x-forwarded-host': url.host,
    'x-forwarded-proto': 'https', 'x-forwarded-port': url.port,
    'x-forwarded-for': host, 'x-nq-dev-proxy': token };
}

function phpReady(port, token) {
  return new Promise((resolve) => {
    const req = http.get({ host, port, path: '/__nq_dev_ready', headers: { 'x-nq-dev-proxy': token } }, (res) => {
      res.resume();
      resolve(res.statusCode === 204 && res.headers['x-nq-dev-ready'] === token);
    });
    req.setTimeout(300, () => req.destroy());
    req.on('error', () => resolve(false));
  });
}

// Exported for isolated transport verification. probeRouter is only supplied by
// that test process, never an environment option or a normal startup/auth mode.
export async function startDev({ cert, key, port = 8443, php = 'php', probeRouter } = {}) {
  if (process.versions.node !== '26.13.1') throw new Error('Use pinned Node 26.13.1 (README.md).');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('NQ_DEV_PORT must be an integer from 1024 to 65535.');
  if ((process.env.VITE_GAME_BASE && process.env.VITE_GAME_BASE !== gameBase)
    || (process.env.VITE_API_BASE && process.env.VITE_API_BASE !== apiBase)) {
    throw new Error('Local HTTPS requires the documented production-shaped paths; unset VITE path overrides.');
  }
  const childEnv = { PATH: process.env.PATH ?? '', LANG: 'C', LC_ALL: 'C' };
  const version = spawnSync(php, ['-r', 'echo PHP_VERSION;'], { env: childEnv, encoding: 'utf8' });
  if (version.status !== 0 || version.stdout !== '8.4.28') throw new Error('NQ_PHP_BIN must select PHP 8.4.28.');
  const [certificate, privateKey] = await Promise.all([privateTlsFile(cert), privateTlsFile(key, true)]);
  const parsed = new X509Certificate(certificate);
  if (!parsed.checkIP(host) || Date.now() < Date.parse(parsed.validFrom) || Date.now() > Date.parse(parsed.validTo)) {
    throw new Error('TLS certificate must currently be valid for IP 127.0.0.1.');
  }
  const origin = `https://${host}:${port}`;
  let vite, phpChild, runDirectory, stopping;
  const sockets = new Set();
  const upstreams = new Set();
  const server = https.createServer({ cert: certificate, key: privateKey, minVersion: 'TLSv1.2' });
  server.on('connection', (socket) => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.requestTimeout = 30_000;
  server.headersTimeout = 15_000;
  const stop = () => stopping ??= (async () => {
    for (const req of upstreams) req.destroy();
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.listening ? server.close(resolve) : resolve());
    await vite?.close();
    if (phpChild && phpChild.exitCode === null && phpChild.signalCode === null) {
      const ended = new Promise((resolve) => phpChild.once('exit', resolve));
      phpChild.kill('SIGTERM');
      const force = setTimeout(() => phpChild.kill('SIGKILL'), 1500);
      await ended;
      clearTimeout(force);
    }
    if (runDirectory) await rm(runDirectory, { recursive: true, force: true });
  })();

  try {
    // Reserve the public port before spawning a worker; no fallback to another origin.
    server.on('request', (_req, res) => res.writeHead(503).end());
    await listen(server, port);
    runDirectory = await mkdtemp(path.join(os.tmpdir(), 'network-quest-dev-'));
    await chmod(runDirectory, 0o700);
    const phpPort = await freePort();
    const token = randomBytes(32).toString('hex');
    let workerFailed = false;
    phpChild = spawn(php, ['-d', 'display_errors=0', '-d', 'log_errors=0',
      '-d', 'auto_prepend_file=', '-d', 'auto_append_file=',
      '-d', 'expose_php=0', '-d', 'session.cookie_secure=1', '-d', 'session.cookie_httponly=1',
      '-d', 'session.cookie_samesite=Lax', '-d', `session.save_path=${runDirectory}`,
      '-S', `${host}:${phpPort}`, '-t', path.join(root, 'server/public'),
      probeRouter ?? path.join(root, 'tools/dev-router.php')], {
      cwd: runDirectory, env: { ...childEnv, TMPDIR: runDirectory, NQ_ENVIRONMENT: 'local', NQ_DEV_PROXY_TOKEN: token },
      // PHP's CLI access/error output can include raw callback URLs. Never relay it.
      stdio: 'ignore',
    });
    phpChild.once('error', () => { workerFailed = true; });
    phpChild.once('exit', () => { workerFailed = true; });
    let ready = false;
    for (let attempt = 0; attempt < 50 && !workerFailed; attempt++) {
      if (await phpReady(phpPort, token)) { ready = true; break; }
      await delay(50);
    }
    if (!ready) throw new Error('PHP worker could not start; check the binary and local port availability.');
    // Vite runs in this process, with no second public port or Vite child.
    // Disable HMR until interactive preview verification; normal reload works.
    const quietLogger = { info() {}, warn() {}, warnOnce() {}, error() {}, clearScreen() {},
      hasErrorLogged: () => false, hasWarned: false };
    vite = await createViteServer({ root, configFile: path.join(root, 'vite.config.ts'),
      customLogger: quietLogger, server: { middlewareMode: true, hmr: false, watch: null } });
    server.removeAllListeners('request');
    server.on('request', (req, res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'no-store');
      if (req.headers.host !== new URL(origin).host || (req.headers.origin && req.headers.origin !== origin)) {
        res.writeHead(403).end(); return;
      }
      const pathname = (req.url ?? '').split('?')[0];
      if (pathname === apiBase || pathname.startsWith(`${apiBase}/`)) {
        const upstream = http.request({ host, port: phpPort, path: req.url, method: req.method,
          headers: proxyHeaders(req.headers, origin, token) }, (response) => {
          res.writeHead(response.statusCode ?? 502, { ...response.headers, 'cache-control': 'no-store' });
          response.pipe(res);
          response.on('error', () => res.destroy());
        });
        upstreams.add(upstream);
        upstream.once('close', () => upstreams.delete(upstream));
        upstream.setTimeout(15_000, () => upstream.destroy());
        upstream.on('error', () => {
          if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'application/json' }).end('{"error":"local_php_unavailable"}');
          else res.destroy();
        });
        res.on('close', () => { if (!res.writableFinished) upstream.destroy(); });
        req.pipe(upstream);
      } else {
        vite.middlewares(req, res, () => res.writeHead(404).end());
      }
    });
    phpChild.on('exit', () => {
      if (!stopping) { console.error('Local PHP worker stopped; closing HTTPS.'); void stop(); }
    });
    return { origin, url: `${origin}${gameBase}`, stop, phpPid: phpChild.pid, phpPort, runDirectory };
  } catch (error) {
    await stop();
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--help')) {
    console.log('NQ_TLS_CERT=/absolute/cert.pem NQ_TLS_KEY=/absolute/key.pem [NQ_PHP_BIN=php] [NQ_DEV_PORT=8443] npm run dev');
  } else if (process.argv.length !== 2) {
    console.error('Unknown argument. See node tools/dev.mjs --help.'); process.exitCode = 1;
  } else {
    let active;
    let interrupted = false;
    const shutdown = () => { interrupted = true; void active?.stop(); };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    try {
      active = await startDev({ cert: process.env.NQ_TLS_CERT, key: process.env.NQ_TLS_KEY,
        port: Number(process.env.NQ_DEV_PORT ?? 8443), php: process.env.NQ_PHP_BIN ?? 'php' });
      if (interrupted) await active.stop();
      else console.log(`Local: ${active.url}\nHTTPS/PHP foundation only; contracted API operations return 503. Ctrl+C stops both.\nUse explicit certificate trust; README.md documents verification.`);
    } catch (error) {
      // Deliberately omit stack/URLs/environment and child output from startup logs.
      console.error(`Local development startup failed (${code(error)}). ${error instanceof Error && !error.code ? error.message : 'Check TLS inputs and that the port is free; see README.md.'}`);
      process.exitCode = 1;
    }
  }
}
