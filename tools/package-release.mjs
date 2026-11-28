// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { constants, createReadStream, readFileSync } from 'node:fs';
import { copyFile, link, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parseArgs } from 'node:util';
import Ajv2020 from 'ajv/dist/2020.js';

const project = fileURLToPath(new URL('..', import.meta.url));
const schemaFile = 'release/manifest.schema.json';
const recipeFiles = ['tools/package-release.mjs', 'tools/release-archive.py', schemaFile, 'release/INTEGRATION.md', 'release/game.htaccess'];
const checkSchema = new Ajv2020().compile(JSON.parse(readFileSync(path.join(project, schemaFile), 'utf8')));
const contracts = 'specs/001-physical-layer-underworld/contracts';
const mediaPath = /^public\/assets\/(?:audio|models|portraits|sprites|images|illustrations)\/(?:[\w.-]+\/)*[\w.-]+\.(?:glb|mp3|png|webp)$/;
const bundlePath = /^assets\/[A-Za-z0-9_-]+-[A-Za-z0-9_-]{8}\.(?:js|css)$/;
const gameRoute = /^\/(?:[A-Za-z0-9_-]+\/)+$/;
const projectPhp = [
  'AccountAccess', 'AccountDeletion', 'Application', 'Configuration', 'Database', 'DeletionLedger', 'DeletionReceipts', 'HttpRequest',
  'RecoveryAccountAccess', 'Router', 'SaveRepository', 'SaveValidator', 'Security', 'Sessions',
  'Identity/AuthTransactions', 'Identity/GitHub', 'Identity/Google', 'Identity/ProviderHttp',
  'Routes/Account', 'Routes/Auth', 'Routes/DeletionStatus', 'Routes/Preferences', 'Routes/Save',
  'Operations/Archive', 'Operations/Command', 'Operations/Jobs', 'Operations/PrivatePaths', 'Operations/RequestLog', 'Operations/Settings', 'Operations/Snapshot',
];
const migrations = ['001_game.sql', '002_delete_reauth.sql'].map(name => 'server/migrations/' + name);
const ledger = 'server/recovery/001_ledger.sql';
const serviceFiles = [
  ...projectPhp.map(name => 'server/src/' + name + '.php'), 'server/public/index.php', 'server/bin/backup.php', 'server/bin/restore.php',
  'server/config.example.json', 'server/content/save-policy.generated.json', 'server/composer.json', 'server/composer.lock',
  ...migrations, ledger, contracts + '/save.schema.json', contracts + '/game-api.openapi.yaml',
];

function digest(data) { return createHash('sha256').update(data).digest('hex'); }
async function hashFile(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function json(file) { return JSON.parse(await readFile(file, 'utf8')); }

function releaseVersion(revision, gamePath, hashes) {
  const build = digest(JSON.stringify([gamePath, Object.keys(hashes).sort().map(key => [key, hashes[key]])]));
  return 'spec001-1.0.0-' + revision.slice(0, 12) + '-' + build.slice(0, 12);
}
export function makeManifest(revision, gamePath, mediaRevision, hashes) {
  return {
    manifestVersion: 1, episode: 'spec001', releaseVersion: releaseVersion(revision, gamePath, hashes), codeRevision: revision, gamePath,
    contentVersion: '1.0.0', api: { path: gamePath + 'api/v1', version: 1, contractVersion: '1.0.0' },
    save: { schema: 1, readContent: ['0.9.1', '1.0.0'], writeContent: ['1.0.0'] },
    database: { current: 2, migrateFrom: [0, 1], ledger: 1 },
    source: { repository: 'https://github.com/automateyournetwork/Network-Quest', mediaRevision, index: 'assets-src/source-index.json' }, hashes,
  };
}
export function validateManifest(manifest) {
  assert(checkSchema(manifest), 'Invalid release manifest: ' + JSON.stringify(checkSchema.errors));
  assert.equal(manifest.api.path, manifest.gamePath + 'api/v1', 'API must be nested under the game');
  assert.equal(manifest.releaseVersion, releaseVersion(manifest.codeRevision, manifest.gamePath, manifest.hashes), 'Release identity mismatch');
}

function safeRelative(name) {
  assert(typeof name === 'string' && name && !/[\\\x00-\x1f]/.test(name)
    && name.split('/').every(segment => segment && !segment.startsWith('.')), 'Invalid relative package input');
}
export async function copyRegular(root, name, destination) {
  safeRelative(name);
  const file = path.join(root, name);
  assert.equal(await realpath(file), path.join(await realpath(root), name), 'Linked package input');
  assert((await lstat(file)).isFile(), 'Package input must be a regular file');
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(file, destination, constants.COPYFILE_EXCL);
}
export function planClient(manifest, reference, vite) {
  const files = new Map();
  function allowMedia(file) {
    safeRelative(file.path);
    assert(mediaPath.test(file.path) && !file.path.split('/').some(s => /^(backups?|sessions?|logs?|private-data|player-data|secrets)$/i.test(s)), 'Unapproved media path');
    assert(/^[0-9a-f]{64}$/.test(file.sha256) && Number.isSafeInteger(file.bytes) && file.bytes > 0, 'Missing media identity');
    const name = file.path.slice('public/'.length);
    if (files.has(name)) assert.deepEqual(files.get(name), { sha256: file.sha256, bytes: file.bytes }, 'Conflicting media bytes');
    files.set(name, { sha256: file.sha256, bytes: file.bytes });
  }
  for (const asset of [...manifest.assets, ...manifest.additionalRenditions]) for (const output of asset.exports) allowMedia(output.file);
  allowMedia({ ...reference, path: 'public/assets/models/R01.glb' });
  for (const name of ['credits/media.html', 'credits/notices.txt', 'index.html']) files.set(name, null);
  assert(vite['index.html']?.isEntry, 'Missing production game shell');
  for (const chunk of Object.values(vite)) {
    for (const name of [chunk.file, ...(chunk.css ?? []), ...(chunk.assets ?? [])]) {
      assert(bundlePath.test(name), 'Unapproved generated browser file');
      files.set(name, null);
    }
  }
  return files;
}
async function tree(root, prefix = '') {
  const files = [];
  const entries = await readdir(path.join(root, prefix), { withFileTypes: true });
  for (const entry of entries.sort((a,b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)) {
    const name = prefix ? prefix + '/' + entry.name : entry.name;
    if (entry.isDirectory()) files.push(...await tree(root, name));
    else { assert(entry.isFile(), 'Unexpected non-regular file in build'); files.push(name); }
  }
  return files;
}
async function client(source, game, stage) {
  const dist = path.join(source, 'dist');
  const vite = await json(path.join(dist, '.vite/manifest.json'));
  const parity = await json(path.join(source, 'assets-src/rooms/R01-animation-parity.json'));
  const files = planClient(await json(path.join(source, 'assets-src/manifest.json')), parity.exportStructure['R01.glb'], vite);
  const actual = await tree(dist);
  assert.deepEqual(new Set(actual), new Set([...files.keys(), '.vite/manifest.json']), 'Unexpected or absent client distribution file');
  const distribution = [];
  for (const name of actual) {
    const file = path.join(dist, name);
    const hash = await hashFile(file);
    distribution.push([name, hash]);
    if (name === '.vite/manifest.json') {
      await mkdir(path.join(stage, 'metadata'), { recursive: true });
      await copyFile(file, path.join(stage, 'metadata/vite-manifest.json'));
      continue;
    }
    const expected = files.get(name);
    if (expected) { assert.equal(hash, expected.sha256, name); assert.equal((await lstat(file)).size, expected.bytes, name); }
    if (name.startsWith('credits/')) assert.equal(hash, await hashFile(path.join(source, 'public', name)), name);
    await copyRegular(dist, name, path.join(game, name));
  }
  return digest(JSON.stringify(distribution));
}
function run(program, args, cwd, env, capture = false) {
  return execFileSync(program, args, { cwd, env, encoding: 'utf8', stdio: ['ignore', capture ? 'pipe' : 'inherit', 'inherit'] })?.trim();
}
async function installService(source, stage, env, php, composer) {
  for (const file of serviceFiles) await copyRegular(source, file, path.join(stage, 'private', file));
  const server = path.join(stage, 'private/server');
  const args = composer ? [php, [composer]] : ['composer', []];
  const invoke = (params, capture) => run(args[0], [...args[1], '--no-plugins', '--no-scripts', '--no-interaction', ...params], server, env, capture);
  assert.match(invoke(['--version'], true), /Composer version 2\.11\.3\b/, 'Use the documented Composer version');
  invoke(['install', '--prefer-dist', '--no-dev', '--no-progress']);
  invoke(['check-platform-reqs', '--no-dev']);
  const installed = await json(path.join(server, 'vendor/composer/installed.json'));
  const lock = await json(path.join(server, 'composer.lock'));
  const identities = list => list.map(p => [p.name,p.version,p.dist.reference]).sort(([a],[b]) => a < b ? -1 : a > b ? 1 : 0);
  assert.equal(installed.dev, false);
  assert.deepEqual(identities(installed.packages), identities(lock.packages), 'Production dependency inventory mismatch');
}
async function publishFile(file, target) {
  try { await link(file, target); } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    assert.equal(await hashFile(file), await hashFile(target), 'Refusing to replace a different existing artifact');
  }
}
async function main() {
  const { values } = parseArgs({ options: { ref: { type: 'string', default: 'HEAD' }, out: { type: 'string', default: '.local/releases' },
    'game-base': { type: 'string', default: '/arcade/play/network-quest/' }, help: { type: 'boolean' } } });
  if (values.help) { console.log('npm run package:release -- [--ref COMMIT] [--out DIRECTORY] [--game-base /nested/game/]'); return; }
  const gamePath = values['game-base'];
  assert(gameRoute.test(gamePath) && gamePath.length <= 512, 'Invalid nested game path');
  const out = path.resolve(values.out);
  const tmp = await mkdtemp(path.join(os.tmpdir(), 'nq-package-'));
  let publishing;
  try {
    const source = path.join(tmp, 'checkout');
    const stage = path.join(tmp, 'package');
    const game = path.join(stage, 'public', gamePath.slice(1));
    const env = { PATH: process.env.PATH, HOME: tmp, LC_ALL: 'C', TZ: 'UTC',
      npm_config_cache: process.env.npm_config_cache ?? path.join(os.homedir(), '.npm'),
      COMPOSER_HOME: path.join(tmp, 'composer-home'), COMPOSER_ALLOW_SUPERUSER: '1',
      VITE_GAME_BASE: gamePath, VITE_API_BASE: gamePath + 'api/v1' };
    for (const key of ['npm_config_offline', 'COMPOSER_CACHE_DIR', 'COMPOSER_DISABLE_NETWORK', 'SYSTEMROOT', 'TMPDIR']) {
      if (process.env[key]) env[key] = process.env[key];
    }
    const revision = run('git', ['rev-parse', '--verify', '--end-of-options', values.ref + '^{commit}'], project, env, true);
    assert(/^[0-9a-f]{40}$/.test(revision));
    run('git', ['clone', '--quiet', '--no-checkout', '--shared', project, source], tmp, env);
    run('git', ['checkout', '--quiet', '--detach', revision], source, env);
    const checkedPackage = await json(path.join(source, 'package.json'));
    assert.equal(process.versions.node, checkedPackage.engines.node);
    assert.equal(run('npm', ['--version'], source, env, true), checkedPackage.engines.npm);
    run('npm', ['ci', '--ignore-scripts', '--no-fund', '--no-audit', '--prefer-offline'], source, env);
    run('npm', ['run', 'build'], source, env);
    const clientHash = await client(source, game, stage);
    await installService(source, stage, env, process.env.NQ_PHP_BIN ?? 'php', process.env.NQ_COMPOSER_PHAR);
    for (const name of ['LICENSE', 'LICENSE-ASSETS', 'NOTICE', 'assets-src/source-index.json', 'tools/fetch-sources.mjs',
      'docs/source-retrieval.md', 'docs/operations.md']) await copyRegular(source, name, path.join(stage, name));
    for (const name of [schemaFile, 'tools/release-archive.py', 'release/INTEGRATION.md']) await copyRegular(project, name, path.join(stage, name));
    await copyRegular(project, 'release/game.htaccess', path.join(game, '.htaccess'));
    const depth = gamePath.split('/').filter(Boolean).length + 3;
    const front = `<?php\n// SPDX-License-Identifier: Apache-2.0\n// Fixed service entry. NQ_PACKAGE_ROOT is supplied only by the operator's SAPI configuration.\n$root = getenv('NQ_PACKAGE_ROOT') ?: dirname(__DIR__, ${depth});\nrequire $root . '/private/server/public/index.php';\n`;
    await mkdir(path.join(game, 'api/v1'), { recursive: true });
    await writeFile(path.join(game, 'api/v1/index.php'), front);
    const inputHash = name => hashFile(path.join(source, name));
    const saveSchema = contracts + '/save.schema.json';
    const policy = await json(path.join(source, 'server/content/save-policy.generated.json'));
    assert.deepEqual(policy.policies.map(p => p.contentVersion), ['1.0.0']);
    assert.equal((await json(path.join(source, 'content/spec001/world.json'))).contentVersion, '1.0.0');
    assert.equal((await json(path.join(source, 'src/state/migrations/spec001-0.9.1.json'))).contentVersion, '0.9.1');
    assert.equal((await json(path.join(source, saveSchema))).properties.saveSchemaVersion.const, 1);
    assert.match(await readFile(path.join(source, contracts, 'game-api.openapi.yaml'), 'utf8'), /^  version: 1\.0\.0$/m);
    const index = await json(path.join(source, 'assets-src/source-index.json'));
    const recipe = digest(JSON.stringify(await Promise.all(recipeFiles.map(async file => [file, await hashFile(path.join(project, file))]))));
    const hashes = { client: clientHash, policy: await inputHash('server/content/save-policy.generated.json'), schema: await inputHash(saveSchema),
      index: await inputHash('assets-src/source-index.json'), npm: await inputHash('package-lock.json'), composer: await inputHash('server/composer.lock'),
      recipe, migrations: await Promise.all(migrations.map(inputHash)), ledger: await inputHash(ledger) };
    const manifest = makeManifest(revision, gamePath, index.revision, hashes);
    assert.equal(index.repository, manifest.source.repository);
    validateManifest(manifest);
    await writeFile(path.join(game, 'release.json'), JSON.stringify(manifest, null, 2) + '\n');
    await mkdir(out, { recursive: true });
    publishing = await mkdtemp(path.join(out, '.nq-build-'));
    const basename = 'network-quest-' + manifest.releaseVersion + '.tar.gz';
    const archive = path.join(publishing, basename);
    run('python3', ['tools/release-archive.py', 'create', stage, archive], project, env);
    const sha256 = await hashFile(archive);
    await writeFile(archive + '.sha256', sha256 + '  ' + basename + '\n');
    await publishFile(archive, path.join(out, basename));
    await publishFile(archive + '.sha256', path.join(out, basename + '.sha256'));
    console.log(JSON.stringify({ artifact: path.join(out, basename), bytes: (await lstat(archive)).size, sha256, clientHash, revision }));
  } finally {
    if (publishing) await rm(publishing, { recursive: true, force: true });
    await rm(tmp, { recursive: true, force: true });
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
