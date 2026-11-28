// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Exercise an actual extracted package. The loopback-only CLI server uses the service's
// explicit local transport. Apache/LiteSpeed rewrite, TLS and host policy need their own checks.
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { mkdtemp, mkdir, rm, realpath, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';
import { validateManifest } from '../../tools/package-release.mjs';

const pkg = await realpath(process.argv[2]);
const gamePath = process.argv[3] ?? '/arcade/play/network-quest/';
assert(/^\/(?:[A-Za-z0-9_-]+\/)+$/.test(gamePath));
const publicRoot = path.join(pkg, 'public');
const game = path.join(publicRoot, gamePath);
const manifest = JSON.parse(await readFile(path.join(game, 'release.json'), 'utf8'));
validateManifest(manifest);
assert.equal(manifest.gamePath, gamePath);
const php = process.env.NQ_PHP_BIN ?? 'php';
const tmp = await realpath(await mkdtemp(path.join(os.tmpdir(), 'nq-release-smoke-')));
const rootList = JSON.stringify([publicRoot]);
const configFile = path.join(tmp, 'config.json');
const token = randomBytes(32).toString('hex');
const env = { PATH: process.env.PATH, HOME: tmp, NQ_ENVIRONMENT: 'local', NQ_GAME_BASE: gamePath, NQ_API_BASE: manifest.api.path,
  NQ_DEV_PROXY_TOKEN: token, NQ_DOCUMENT_ROOTS_JSON: rootList };
let server;
let browser;
async function stopPhp() {
  if (server && server.exitCode === null && !server.signalCode) {
    const done = once(server, 'exit');
    server.kill(); await done;
  }
  server = undefined;
}
try {
  for (const name of ['game', 'ledger']) await mkdir(path.join(tmp, name), { mode: 0o700 });
  const socket = createServer();
  socket.listen(0, '127.0.0.1'); await once(socket, 'listening');
  const port = socket.address().port; await new Promise(resolve => socket.close(resolve));
  const local = 'http://127.0.0.1:' + port;
  const origin = 'https://127.0.0.1:' + port;
  const conf = { origin, gamePath, databasePath: path.join(tmp, 'game/data.sqlite'), ledgerFile: path.join(tmp,'ledger/deletions.sqlite'),
    rateKey: randomBytes(32).toString('base64url'), googleClientId: 'synthetic-local', googleClientSecret: 'synthetic-local',
    githubClientId: 'synthetic-local', githubClientSecret: 'synthetic-local',
    googleCallback: origin + manifest.api.path + '/auth/google/callback', githubCallback: origin + manifest.api.path + '/auth/github/callback',
    rollbackRoots: [path.join(tmp, 'game')], backupSeconds: 604800, restorationSeconds: 86400, retentionEvidence: 'local-disposable-package-smoke' };
  await writeFile(configFile, JSON.stringify(conf), { mode: 0o600, flag: 'wx' });
  for (const file of [conf.ledgerFile, conf.ledgerFile + '.lock']) await writeFile(file, '', { mode: 0o600, flag: 'wx' });
  // Delegate API to the actual shipped front controller. All other paths use this PHP server's docroot.
  const router = path.join(tmp, 'router.php');
  await writeFile(router, `<?php
    $base = getenv('NQ_GAME_BASE');
    if (str_starts_with($_SERVER['REQUEST_URI'], $base . 'api/v1/')) {
      require $_SERVER['DOCUMENT_ROOT'] . $base . 'api/v1/index.php';
      return true;
    }
    // PHP's built-in server falls back to ancestor index.html for missing names.
    // A static game handoff only serves real files and directories in its docroot.
    $requested = realpath($_SERVER['DOCUMENT_ROOT'] . parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH));
    if ($requested === false || !str_starts_with($requested, $_SERVER['DOCUMENT_ROOT'] . '/')) {
      http_response_code(404); return true;
    }
    return false;
`);
  function api(suffix) {
    return fetch(local + manifest.api.path + suffix, { headers: { 'x-forwarded-proto': 'https', 'x-nq-dev-proxy': token } });
  }
  async function listen(configured) {
    server = spawn(php, ['-S', '127.0.0.1:' + port, '-t', publicRoot, router], {
      cwd: tmp, env: configured ? { ...env, NQ_CONFIG_FILE: configFile } : env, stdio: 'ignore' });
    for (let attempt = 0; attempt < 100; attempt++) {
      try { if ((await fetch(local + gamePath + 'release.json')).ok) return; } catch { /* listener is starting */ }
      if (server.exitCode !== null) throw Error('PHP package fixture exited');
      await delay(25);
    }
    throw Error('PHP package fixture unavailable');
  }
  function setup(fragment) {
    const prelude = String.raw`require $argv[1].'/private/server/src/Application.php';
      $roots = json_decode(getenv('NQ_DOCUMENT_ROOTS_JSON'), true, flags: JSON_THROW_ON_ERROR);
      $cfg = NetworkQuest\Configuration::load($argv[2], $roots);
      $db = NetworkQuest\Database::open($cfg->databasePath, $roots);`;
    return execFileSync(php, ['-r', prelude + fragment, '--', pkg, configFile], { env, encoding: 'utf8' });
  }
  await listen(false);
  const unavailable = await api('/session');
  assert.equal(unavailable.status, 503); assert.match(unavailable.headers.get('cache-control'), /no-store/);
  await stopPhp();
  await listen(true);
  assert.equal((await api('/session')).status, 503);
  setup(String.raw`
    $db->migrate([1 => file_get_contents($argv[1].'/private/server/migrations/001_game.sql')]);
    NetworkQuest\DeletionLedger::initialize($cfg->ledgerFile, $roots, $cfg->rollbackRoots,
      new NetworkQuest\DeletionRetentionPolicy($cfg->backupSeconds,$cfg->restorationSeconds,$cfg->retentionEvidence));`);
  assert.equal((await api('/session')).status, 503);
  const versions = JSON.parse(setup(String.raw`
    $db->migrate();
    foreach (['Google\\Client', 'League\\OAuth2\\Client\\Provider\\GenericProvider', 'Opis\\JsonSchema\\Validator'] as $class)
      if (!class_exists($class)) exit(2);
    echo json_encode($db->readMigrationChecksums(), JSON_THROW_ON_ERROR);`));
  assert.deepEqual(versions, manifest.hashes.migrations.map((checksum,i) => ({ version: i + 1, checksum })));
  const session = await api('/session');
  assert.equal(session.status, 200); assert.match(session.headers.get('cache-control'), /no-store/);
  assert.equal((await session.json()).state, 'guest'); assert.match(session.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(session.headers.get('set-cookie'), /;\s*Secure(?:;|$)/i);
  assert.equal((await api('/save')).status, 401);
  for (const name of ['credits/media.html','credits/notices.txt','assets/models/R01.glb','assets/audio/ambience/r01.mp3','release.json']) {
    assert.equal((await fetch(local + gamePath + name)).status, 200, name);
  }
  for (const name of ['private/server/composer.lock', 'private/server/content/save-policy.generated.json', 'SHA256SUMS','assets-src/source-index.json','config.json']) {
    for (const prefix of ['/', gamePath]) assert.equal((await fetch(local + prefix + name)).status, 404, name);
  }
  const listing = execFileSync(process.execPath, ['tools/fetch-sources.mjs', '--list'], { cwd: pkg, env, encoding: 'utf8' });
  const index = JSON.parse(await readFile(path.join(pkg, manifest.source.index), 'utf8'));
  assert.equal(listing.trim().split('\n').length, index.files.length);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(local + gamePath);
  await page.getByRole('button', { name: 'New Adventure', exact: true }).click();
  await page.getByRole('heading', { name: 'The Arrival Lift', exact: true }).waitFor();
  console.log(JSON.stringify({ release: manifest.releaseVersion, client: manifest.hashes.client, chromium: browser.version(),
    staticGame: 'New Adventure to The Arrival Lift', sourceEntries: index.files.length, gameMigrations: versions.map(v => v.version),
    unconfigured: 503, uninitialized: 503, oneMigration: 503, configuredGuest: session.status, unauthenticatedSave: 401,
    privatePathsAbsent: 10 }));
} finally {
  try { if (browser) await browser.close(); }
  finally { await stopPhp(); await rm(tmp, { recursive: true, force: true }); }
}
