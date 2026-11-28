// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { execFile } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { promisify } from 'node:util';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const exec = promisify(execFile);
const revision = '1'.repeat(40);
const source = 'assets-src/characters/CH01.blend';
const payload = Buffer.from('fixture-native');
const digest = createHash('sha256').update(payload).digest('hex');
const entry = { path: source, sha256: digest, bytes: payload.length };
const repository = 'https://github.com/automateyournetwork/Network-Quest';
const cli = new URL('../../tools/fetch-sources.mjs', import.meta.url);
let work: string, output: string, index: string;

function writeIndex(files: typeof entry[], override = {}) {
  return writeFile(index, JSON.stringify({ schemaVersion: 1, repository, revision, files, ...override }));
}

function run(args: string[] = [], response = 'fixture-native') {
  return exec(process.execPath, ['--import', join(work, 'network.mjs'), join(work, 'tools/fetch-sources.mjs'),
    '--dir', output, ...args], { cwd: work, env: { TEST_RESPONSE: response }, timeout: 10_000 });
}

describe('public source retrieval command', () => {
  beforeEach(async () => {
    work = await mkdtemp(join(tmpdir(), 'nq-source-test-'));
    output = join(work, 'out');
    index = join(work, 'assets-src/source-index.json');
    await Promise.all(['assets-src', 'tools', 'out'].map(dir => mkdir(join(work, dir))));
    await Promise.all([
      writeIndex([entry]), copyFile(cli, join(work, 'tools/fetch-sources.mjs')),
      writeFile(join(work, 'network.mjs'), `
        globalThis.fetch = async (url, options) => {
          if (url !== 'https://raw.githubusercontent.com/automateyournetwork/Network-Quest/${revision}/${source}' ||
              options.credentials !== 'omit' || options.redirect !== 'error') throw Error('Unexpected request');
          const data = process.env.TEST_RESPONSE;
          if (data === 'offline') throw Error('Unexpected network access');
          if (data === 'redirect') return new Response(null, { status: 302, headers: { location: 'https://example.org' } });
          if (data === 'wait') {
            let timer;
            return new Response(new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array([1]));
                timer = setInterval(() => {}, 100);
              },
              cancel() { clearInterval(timer); }
            }));
          }
          if (data === 'interrupted') return new Response(new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array([1]));
              setTimeout(() => controller.error(Error('broken response stream')), 30);
            }
          }));
          return new Response(data);
        };
      `),
    ]);
  });
  afterEach(async () => { await rm(work, { recursive: true, force: true }); });

  it('audits the pinned endpoint and verifies or resumes existing downloads offline', async () => {
    expect(JSON.parse((await run(['--audit', '--path', source])).stdout).audited).toBe(1);
    expect(await readdir(output)).toEqual([]);
    expect(JSON.parse((await run()).stdout).downloaded).toBe(1);
    expect(await readFile(join(output, source))).toEqual(payload);
    expect(JSON.parse((await run([], 'offline')).stdout).reused).toBe(1);
    expect(JSON.parse((await run(['--verify'], 'offline')).stdout).reused).toBe(1);
  });

  it('lets concurrent fetches recover the same missing file without replacing it', async () => {
    const results = (await Promise.all([run(), run()])).map(r => JSON.parse(r.stdout));
    expect(results.map(result => result.downloaded).sort()).toEqual([0, 1]);
    expect(await readdir(join(output, 'assets-src/characters'))).toEqual(['CH01.blend']);
    expect(await readFile(join(output, source))).toEqual(payload);
  });

  it.each(['short', 'x'.repeat(payload.length), 'a very large wrong payload', 'interrupted', 'redirect'])(
    'does not publish or retain a partial file when the response is %s', async response => {
      await expect(run([], response)).rejects.toThrow();
      expect(await readdir(join(output, 'assets-src/characters'))).toEqual([]);
      expect(JSON.parse((await run()).stdout).downloaded).toBe(1);
    });

  it('cleans up an interrupted process and lets a fresh process finish the download', async () => {
    const directory = join(output, 'assets-src/characters');
    const transfer = run([], 'wait');
    const rejected = expect(transfer).rejects.toThrow(/interrupted/);
    const deadline = Date.now() + 5000;
    try {
      while (Date.now() < deadline) {
        const names = await readdir(directory).catch(() => [] as string[]);
        if (names.some(name => name.endsWith('.partial'))) break;
        await delay(10);
      }
      expect((await readdir(directory)).some(name => name.endsWith('.partial'))).toBe(true);
    } finally {
      transfer.child.kill('SIGTERM');
    }
    await rejected;
    expect(await readdir(directory)).toEqual([]);
    expect(JSON.parse((await run()).stdout).downloaded).toBe(1);
  });

  it('keeps an existing same-size corrupt file and an unindexed sentinel untouched', async () => {
    await mkdir(join(output, 'assets-src/characters'), { recursive: true });
    const corrupt = Buffer.alloc(payload.length, 7);
    await writeFile(join(output, source), corrupt);
    await writeFile(join(output, 'sentinel'), 'existing user content');
    await expect(run()).rejects.toThrow(/SHA-256 mismatch/);
    expect(await readFile(join(output, source))).toEqual(corrupt);
    expect(await readFile(join(output, 'sentinel'), 'utf8')).toBe('existing user content');
  });

  it('refuses existing directory and file symlinks, including dangling links', async () => {
    const media = join(output, 'assets-src/characters');
    await mkdir(join(output, 'assets-src'));
    await symlink(work, media);
    await expect(run()).rejects.toThrow(/Directory required/);
    await rm(media);
    await mkdir(media);
    await symlink(index, join(output, source));
    await expect(run()).rejects.toThrow();
    await rm(join(output, source));
    await symlink(join(work, 'absent'), join(output, source));
    await expect(run()).rejects.toThrow();
  });

  it.each(['assets-src/characters/../escape.blend', '/assets-src/rooms/R07.blend',
    'assets-src/characters/%2e%2e/key', 'assets-src/audio/.env', 'assets-src/audio/CON.wav',
    'assets-src/rooms/secrets/archive.json', 'server/config.local.php', 'assets-src/audio/file.key'])(
    'rejects unsafe paths before writing or connecting: %s', async path => {
      await writeIndex([entry, { ...entry, path }]);
      await expect(run([], 'offline')).rejects.toThrow(/Invalid source index entry/);
      expect(await readdir(output)).toEqual([]);
    });

  it('rejects path duplicates, case aliases, file/directory conflicts, mutable refs and unknown selections', async () => {
    for (const path of [source, 'assets-src/Characters/CH02.blend', 'assets-src/characters/CH01.blend/child.blend']) {
      await writeIndex([entry, { ...entry, path }]);
      await expect(run([], 'offline')).rejects.toThrow();
    }
    await writeIndex([entry], { revision: 'main' });
    await expect(run([], 'offline')).rejects.toThrow(/revision/);
    await writeIndex([entry], { repository: 'https://example.org' });
    await expect(run([], 'offline')).rejects.toThrow(/repository/);
    await writeIndex([entry]);
    await expect(run(['--path', 'unknown'])).rejects.toThrow(/Unknown source path/);
    expect(await readdir(output)).toEqual([]);
  });
});
