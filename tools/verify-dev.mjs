// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T011/T020 transport verification; shared T019 router but no real account or save.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, writeFile, chmod, rm, symlink, access } from 'node:fs/promises';
import https from 'node:https';
import http from 'node:http';
import net from 'node:net';
import { checkServerIdentity } from 'node:tls';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { startDev } from './dev.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const base = '/arcade/play/network-quest/';
const php = process.env.NQ_PHP_BIN ?? 'php';
const work = await mkdtemp(path.join(os.tmpdir(), 'network-quest-t011-'));
await chmod(work, 0o700);
const cert = path.join(work, 'cert.pem');
const key = path.join(work, 'key.pem');
const marker = `t011-${path.basename(work)}`;
const fixture = path.join(root, 'public', marker);
const authoredFixture = path.join(root, 'content/spec001', marker);
const outside = path.join(work, 'private.txt');
let active, child;
let publicCreated = false;
const results = [];
function passed(name) { results.push(name); console.log(`PASS ${name}`); }

function request(url, { ca, pathname, headers, method = 'GET', body, plain = false } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = (plain ? http : https).request({ hostname: '127.0.0.1', port: target.port,
      path: pathname ?? target.pathname, ca, method, headers, agent: false,
      // Validate the actual destination IP even when testing a forged HTTP Host.
      checkServerIdentity: (_name, certificate) => checkServerIdentity('127.0.0.1', certificate) }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: data }));
    });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('request timeout')));
    req.end(body);
  });
}

async function unusedPort() {
  const s = net.createServer();
  await new Promise((resolve, reject) => { s.once('error', reject); s.listen(0, '127.0.0.1', resolve); });
  const port = s.address().port;
  await new Promise((resolve) => s.close(resolve));
  return port;
}

function upgrade(url, ca, { pathname, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = https.request({ hostname: '127.0.0.1', port: target.port, path: pathname ?? target.pathname,
      ca, agent: false, checkServerIdentity: (_name, certificate) => checkServerIdentity('127.0.0.1', certificate),
      headers: { connection: 'Upgrade', upgrade: 'websocket', 'sec-websocket-version': '13',
        'sec-websocket-key': 'MDEyMzQ1Njc4OWFiY2RlZg==', 'sec-websocket-protocol': 'vite-hmr', origin: target.origin, ...headers } });
    req.on('upgrade', (response, socket) => { socket.destroy(); resolve(response.statusCode); });
    req.on('response', response => { response.resume(); resolve(response.statusCode); });
    req.on('error', reject);
    req.setTimeout(3000, () => req.destroy(new Error('upgrade timeout')));
    req.end();
  });
}

async function assertStopped(handle) {
  assert.throws(() => process.kill(handle.phpPid, 0), { code: 'ESRCH' });
  await assert.rejects(access(handle.runDirectory), { code: 'ENOENT' });
  await assert.rejects(request(handle.url), { code: 'ECONNREFUSED' });
}

try {
  const openssl = spawnSync(process.env.NQ_OPENSSL_BIN ?? 'openssl', ['req', '-x509', '-newkey', 'rsa:2048',
    '-sha256', '-nodes', '-days', '1', '-subj', '/CN=Network Quest disposable transport check',
    '-addext', 'subjectAltName=IP:127.0.0.1', '-keyout', key, '-out', cert], { stdio: 'ignore' });
  assert.equal(openssl.status, 0, 'OpenSSL must support req -addext.');
  await chmod(key, 0o600);
  const ca = await readFile(cert);
  try { await access(path.join(root, 'public')); } catch { publicCreated = true; }
  await mkdir(fixture, { recursive: true });
  await mkdir(authoredFixture);
  await writeFile(outside, marker);
  await writeFile(path.join(authoredFixture, 'safe.json'), JSON.stringify({ label: 'synthetic authored content' }));
  await writeFile(path.join(authoredFixture, 'notes.txt'), marker);
  await writeFile(path.join(authoredFixture, 'config.local.json'), marker);
  await symlink(outside, path.join(authoredFixture, 'alias.json'));
  await symlink(path.join(root, 'server/config.example.php'), path.join(authoredFixture, 'server-alias.json'));
  for (const name of ['.env', 'secret.key', 'record.sqlite', 'record.db-wal', 'config.local.json']) {
    await writeFile(path.join(fixture, name), marker);
  }
  await writeFile(path.join(fixture, 'safe.txt'), 'synthetic public asset');
  await symlink(outside, path.join(fixture, 'alias.txt'));
  await symlink(path.join(fixture, 'secret.key'), path.join(fixture, 'alias-key.txt'));
  const options = { cert, key, php, port: await unusedPort() };
  active = await startDev(options);
  const shell = await request(active.url, { ca });
  assert.equal(shell.status, 200);
  assert.match(shell.body, /Network Quest/);
  assert.match(shell.body, /\/arcade\/play\/network-quest\/src\/main.ts/);
  assert.equal((await request(active.url, { ca, pathname: `${base}src/main.ts` })).status, 200);
  assert.equal((await request(active.url, { ca, pathname: `${base}src/styles.css` })).status, 200);
  passed('trusted TLS and nested HTML/TypeScript/CSS routing');

  await assert.rejects(request(active.url), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' });
  await assert.rejects(request(active.url, { plain: true }));
  const badHost = await request(active.url, { ca, headers: { host: 'untrusted.invalid' } });
  assert.equal(badHost.status, 403);
  assert.equal((await request(active.url, { ca, headers: { origin: 'https://untrusted.invalid' } })).status, 403);
  passed('untrusted certificate, plaintext, foreign Host and Origin rejected');

  const client = await request(active.url, { ca, pathname: `${base}@vite/client` });
  assert.equal(client.status, 200);
  const socketToken = /const wsToken = "([^"]+)"/.exec(client.body)?.[1];
  assert.ok(socketToken, 'Vite client must supply its generated connection token');
  const socketPath = `${base}?token=${encodeURIComponent(socketToken)}`;
  assert.equal(await upgrade(active.url, ca, { pathname: socketPath }), 101, 'development client connects on the same verified TLS port');
  assert.equal(await upgrade(active.url, ca, { pathname: socketPath, headers: { origin: 'https://untrusted.invalid' } }), 403);
  assert.equal(await upgrade(active.url, ca, { pathname: socketPath, headers: { host: 'untrusted.invalid' } }), 403);
  assert.equal(await upgrade(active.url, ca, { pathname: `${base}api/v1/session?token=${encodeURIComponent(socketToken)}` }), 404);
  assert.equal(await upgrade(active.url, ca, { pathname: `${base}?token=invalid-synthetic-token` }), 400);
  passed('development WebSocket uses the same TLS port; foreign Host/Origin, API path and invalid token rejected');

  for (const route of ['session', 'auth/google/callback?code=synthetic-code&state=synthetic-state',
    'auth/github/callback?code=synthetic-code', 'save']) {
    const response = await request(active.url, { ca, pathname: `${base}api/v1/${route}` });
    assert.equal(response.status, 503);
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.equal(response.headers['set-cookie'], undefined);
    assert.equal(response.headers['referrer-policy'], 'no-referrer');
    assert.equal(response.headers['x-content-type-options'], 'nosniff');
    assert.equal(response.headers['content-security-policy'], "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'");
    if (route.startsWith('auth/')) {
      assert.match(response.headers['content-type'], /^text\/html/);
      assert.match(response.body, /No sign-in was completed/);
      assert.ok(!response.body.includes('synthetic-'));
    } else {
      const problem = JSON.parse(response.body);
      assert.equal(problem.code, 'service_not_implemented');
      assert.equal(problem.message, 'This game service has not been implemented.');
      assert.match(problem.requestId, /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/);
      assert.equal(response.headers['x-request-id'], problem.requestId);
    }
  }
  assert.equal((await request(active.url, { ca, pathname: `${base}api/v1/not-a-route` })).status, 404);
  const wrongMethod = await request(active.url, { ca, pathname: `${base}api/v1/session`, method: 'POST' });
  assert.equal(wrongMethod.status, 405);
  assert.equal(wrongMethod.headers.allow, 'GET');
  assert.equal((await request(`http://127.0.0.1:${active.phpPort}`, { plain: true })).status, 404);
  passed('shared API router: honest 503, inert callbacks, unknown404/method405; no cookie or direct PHP bypass');

  assert.equal((await request(active.url, { ca, pathname: `${base}${marker}/safe.txt` })).body, 'synthetic public asset');
  const authoredBase = `${base}content/spec001/${marker}`;
  const authored = await request(active.url, { ca, pathname: `${authoredBase}/safe.json?import` });
  assert.equal(authored.status, 200, 'authored JSON module must be available to the actual development client');
  assert.match(authored.body, /export default/);
  assert.match(authored.body, /synthetic authored content/);
  assert.equal((await request(active.url, { ca, pathname: `${authoredBase}/safe.json` })).status, 200);
  for (const name of ['notes.txt', 'config.local.json', 'alias.json', 'server-alias.json']) {
    const deniedContent = await request(active.url, { ca, pathname: `${authoredBase}/${name}?import` });
    assert.equal(deniedContent.status, 404, name);
    assert.ok(!deniedContent.body.includes(marker), name);
  }
  passed('authored JSON imports work; non-JSON, private-name and escaping symlink content remain denied');
  const denied = ['server/config.example.php', '.local/provider-discovery.json', '.runtime/composer-2.11.3.phar',
    '.cache/canary', '.git/config', '.env', '.env.local', 'package.json', 'README.md',
    '@fs/etc/passwd', `@fs/${root}/.env`, '%2eenv', '%252eenv', '.%2e/server/config.example.php',
    '%2e%2e/.env', 'server%2fconfig.example.php', 'server%5cconfig.example.php',
    `${marker}/.env`, `${marker}/secret.key`, `${marker}/record.sqlite`, `${marker}/record.db-wal`,
    `${marker}/config.local.json`, `${marker}/alias.txt`, `${marker}/alias-key.txt`,
    `${marker}/secret.key?raw`, `${marker}/secret.key%3Fraw`, 'api/v10/session'];
  for (const route of denied) {
    const response = await request(active.url, { ca, pathname: `${base}${route}` });
    assert.equal(response.status, 404, route);
    assert.ok(!response.body.includes(marker), route);
  }
  assert.equal((await request(active.url, { ca, pathname: '/server/config.example.php' })).status, 404);
  assert.equal((await request(active.url, { ca, pathname: `${base}%ZZ` })).status, 400);
  passed(`${denied.length + 2} private/encoded/symlink/path-boundary denials; public asset still available`);

  await assert.rejects(startDev(options), { code: 'EADDRINUSE' });
  await assert.rejects(startDev({ ...options, port: await unusedPort(), cert: undefined }), /explicit absolute paths/);
  passed('occupied port and missing TLS inputs fail closed');
  await active.stop();
  await assertStopped(active);
  active = undefined;
  passed('normal shutdown removes worker, listener and temporary data');

  // This generated private router never ships in server/public or answers login.
  const router = path.join(work, 'probe.php');
  await writeFile(router, `<?php
$token = getenv('NQ_DEV_PROXY_TOKEN');
if (!hash_equals($token, $_SERVER['HTTP_X_NQ_DEV_PROXY'] ?? '')) { http_response_code(404); return; }
if ($_SERVER['REQUEST_URI'] === '/__nq_dev_ready') { header('X-NQ-Dev-Ready: ' . $token); http_response_code(204); return; }
if ($_SERVER['REQUEST_URI'] !== '${base}api/v1/__bootstrap_probe') { http_response_code(404); return; }
setcookie('__Secure-nq_bootstrap_probe', 'synthetic-only', ['secure' => true, 'httponly' => true, 'samesite' => 'Lax', 'path' => '${base}']);
header('Content-Type: application/json');
echo json_encode(['host' => $_SERVER['HTTP_HOST'], 'proto' => $_SERVER['HTTP_X_FORWARDED_PROTO'],
'forwardedHost' => $_SERVER['HTTP_X_FORWARDED_HOST'], 'forwardedFor' => $_SERVER['HTTP_X_FORWARDED_FOR'],
'forwarded' => $_SERVER['HTTP_FORWARDED'] ?? null, 'realIp' => $_SERVER['HTTP_X_REAL_IP'] ?? null,
'original' => $_SERVER['HTTP_X_ORIGINAL_URL'] ?? null, 'extraForwarded' => $_SERVER['HTTP_X_FORWARDED_EVIL'] ?? null,
'body' => file_get_contents('php://input'), 'cookie' => $_COOKIE['__Secure-nq_bootstrap_probe'] ?? null,
'secretPresent' => getenv('NQ_GOOGLE_CLIENT_SECRET') !== false, 'extensions' => get_loaded_extensions(),
'secureSetting' => ini_get('session.cookie_secure')]);
`);
  process.env.NQ_GOOGLE_CLIENT_SECRET = 'synthetic-environment-canary';
  active = await startDev({ ...options, probeRouter: router });
  delete process.env.NQ_GOOGLE_CLIENT_SECRET;
  const probe = await request(active.url, { ca, pathname: `${base}api/v1/__bootstrap_probe`, method: 'POST',
    body: 'synthetic-body', headers: { 'content-type': 'text/plain', 'content-length': '14',
      forwarded: 'for=untrusted;proto=http', 'x-forwarded-proto': 'http', 'x-forwarded-host': 'untrusted.invalid',
      'x-forwarded-for': 'untrusted', 'x-real-ip': 'untrusted', 'x-original-url': '/private',
      'x-forwarded-evil': 'untrusted', 'x-nq-dev-proxy': 'forged', cookie: '__Secure-nq_bootstrap_probe=synthetic-only' } });
  assert.equal(probe.status, 200);
  const data = JSON.parse(probe.body);
  assert.equal(data.host, new URL(active.origin).host);
  assert.equal(data.forwardedHost, data.host);
  assert.equal(data.proto, 'https');
  assert.equal(data.forwardedFor, '127.0.0.1');
  for (const field of ['forwarded', 'realIp', 'original', 'extraForwarded']) assert.equal(data[field], null);
  assert.equal(data.body, 'synthetic-body');
  assert.equal(data.cookie, 'synthetic-only');
  assert.equal(data.secretPresent, false);
  assert.equal(data.secureSetting, '1');
  for (const extension of ['curl', 'mbstring', 'openssl', 'PDO', 'pdo_sqlite', 'session']) assert.ok(data.extensions.includes(extension), extension);
  const cookie = probe.headers['set-cookie'][0];
  assert.match(cookie, /; secure/i);
  assert.match(cookie, /; httponly/i);
  assert.match(cookie, /; SameSite=Lax/i);
  assert.ok(cookie.includes(`path=${base}`));
  assert.ok(!/domain=/i.test(cookie));
  passed('isolated PHP body/cookie/header probe, Secure policy, module configuration and secret-free child environment');
  process.kill(active.phpPid, 'SIGTERM');
  await delay(200);
  await active.stop();
  await assertStopped(active);
  active = undefined;
  passed('unexpected PHP exit closes HTTPS and removes temporary data');

  for (const signal of ['SIGINT', 'SIGTERM']) {
    let output = '';
    child = spawn(process.execPath, [path.join(root, 'tools/dev.mjs')], { cwd: root,
      env: { PATH: process.env.PATH, NQ_TLS_CERT: cert, NQ_TLS_KEY: key, NQ_PHP_BIN: php, NQ_DEV_PORT: String(options.port) },
      stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    for (let i = 0; i < 100 && !output.includes('Local:'); i++) await delay(50);
    assert.match(output, /Local:/);
    await request(`https://127.0.0.1:${options.port}${base}api/v1/auth/google/callback?code=synthetic-secret-code&state=synthetic-secret-state`, { ca });
    const ended = new Promise((resolve) => child.once('exit', resolve));
    child.kill(signal);
    assert.equal(await ended, 0);
    child = undefined;
    assert.ok(!output.includes('synthetic-secret'));
    await assert.rejects(request(`https://127.0.0.1:${options.port}${base}`), { code: 'ECONNREFUSED' });
    passed(`${signal} CLI shutdown; synthetic OAuth query absent from output`);
  }
  console.log(`${results.length} transport verification groups passed. No browser or authentication acceptance claimed.`);
} finally {
  child?.kill('SIGTERM');
  await active?.stop();
  await rm(fixture, { recursive: true, force: true });
  await rm(authoredFixture, { recursive: true, force: true });
  if (publicCreated) {
    // Only remove the directory this check created if it is still empty.
    const { rmdir } = await import('node:fs/promises');
    await rmdir(path.join(root, 'public')).catch(() => {});
  }
  await rm(work, { recursive: true, force: true });
}
