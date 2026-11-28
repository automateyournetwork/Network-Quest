// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const { validateManifest, makeManifest, planClient, copyRegular } = await import(new URL('../../tools/package-release.mjs', import.meta.url).href);
const revision = 'a'.repeat(40);
const sha = 'b'.repeat(64);
const hashes = { client: sha, policy: sha, index: sha, schema: sha, npm: sha, composer: sha, recipe: sha, migrations: [sha, sha], ledger: sha };
const example = () => makeManifest(revision, '/nested/game/', 'c'.repeat(40), structuredClone(hashes));

describe('versioned game package', () => {
  it('declares the nested API and separate readable and writable snapshots', () => {
    const m = example();
    validateManifest(m);
    expect(m.api.path).toBe('/nested/game/api/v1');
    expect(m.save.readContent).toEqual(['0.9.1', '1.0.0']);
    expect(m.save.writeContent).toEqual(['1.0.0']);
    expect(m.database.current).toBe(2);
  });
  it.each([
    (m: ReturnType<typeof example>) => { m.api.path = '/different/api/v1'; },
    (m: ReturnType<typeof example>) => { m.api.version = 2; },
    (m: ReturnType<typeof example>) => { m.save.writeContent = ['0.9.1']; },
    (m: ReturnType<typeof example>) => { m.save.schema = 2; },
    (m: ReturnType<typeof example>) => { m.database.current = 1; },
    (m: ReturnType<typeof example>) => { m.codeRevision = 'HEAD'; },
    (m: ReturnType<typeof example>) => { m.releaseVersion = 'spec001-other'; },
    (m: ReturnType<typeof example>) => { m.gamePath = '/../../private/'; },
    (m: ReturnType<typeof example>) => { m.hashes.policy = 'missing'; },
  ])('rejects inconsistent contracts or source provenance', change => {
    const manifest = example(); change(manifest);
    expect(() => validateManifest(manifest)).toThrow();
  });
  const file = { path: 'public/assets/audio/music/title.mp3', sha256: sha, bytes: 256 };
  const media = { assets: [{ exports: [{ file }] }], additionalRenditions: [] };
  const reference = { bytes: 100, sha256: sha };
  const vite = { 'index.html': { isEntry: true, file: 'assets/index-AbC12345.js', css: ['assets/index-X2233445.css'] } };
  it('ships only registered media, production entries and the two credit registers', () => {
    const paths = [...planClient(media, reference, vite).keys()].sort();
    expect(paths).toEqual(['assets/audio/music/title.mp3', 'assets/index-AbC12345.js', 'assets/index-X2233445.css', 'assets/models/R01.glb', 'credits/media.html', 'credits/notices.txt', 'index.html']);
  });
  it.each(['../.env', 'assets/../../private.sqlite', 'server/config.php', 'assets/auth.json', 'assets/.local/log.js', 'assets/website.html', 'assets/session.db-wal'])('rejects an untrusted production entry %s', file => {
    expect(() => planClient(media, reference, { 'index.html': { isEntry: true, file } })).toThrow();
  });
  it('rejects private lookalikes even when placed in the source manifest', () => {
    for (const path of ['public/assets/audio/backups/players.mp3', 'public/assets/.env', 'public/assets/models/game.sqlite', 'public/assets/images/../session.png']) {
      expect(() => planClient({ ...media, assets: [{ exports: [{ file: { ...file, path } }] }] }, reference, vite)).toThrow();
    }
  });
  it('rejects symlinked source files and parent directories', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nq-package-test-'));
    try {
      await mkdir(join(root, 'input')); await mkdir(join(root, 'outside'));
      await writeFile(join(root, 'outside', 'label'), 'synthetic marker');
      await symlink('../outside', join(root, 'input', 'via'));
      await symlink('../outside/label', join(root, 'input', 'label'));
      for (const file of ['via/label', 'label']) await expect(copyRegular(join(root, 'input'), file, join(root, 'out'))).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
  it('recreates identical checksummed archives and detects extra or altered extracted files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nq-archive-test-'));
    const run = (...args: string[]) => execFileSync('python3', ['tools/release-archive.py', ...args], { stdio: 'pipe' });
    try {
      const stage = join(root, 'candidate');
      await mkdir(stage); await writeFile(join(stage, 'file'), 'hello');
      run('create', stage, join(root, 'first.tar.gz'));
      run('verify', stage);
      run('create', stage, join(root, 'second.tar.gz'));
      expect(execFileSync('cmp', [join(root, 'first.tar.gz'), join(root, 'second.tar.gz')])).toHaveLength(0);
      await writeFile(join(stage, 'unexpected'), 'new');
      expect(() => run('verify', stage)).toThrow();
      await rm(join(stage, 'unexpected'));
      await writeFile(join(stage, 'file'), 'changed');
      expect(() => run('verify', stage)).toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
