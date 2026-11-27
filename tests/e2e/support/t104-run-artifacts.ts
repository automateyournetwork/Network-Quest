// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, readdir } from 'node:fs/promises';
import { resolve, relative, join } from 'node:path';

/** Reports always get a fresh ignored directory, including ordinary test runs. */
export async function createT104RunDirectory(journey: 'companions' | 'optional-activities'): Promise<string> {
  const directory = resolve('.local/test-results');
  await mkdir(directory, { recursive: true });
  const output = await mkdtemp(join(directory, `t104-${journey}-`));
  console.log(`T104 ${journey} artifacts: ${output}`);
  return output;
}

/** Describe the actual working tree; never infer a commit from a private path. */
export async function captureT104SourceHashes(spec: 'companions' | 'optional-activities', includeBuiltOutput: boolean): Promise<Record<string, string>> {
  const files: string[] = [];
  async function scan(path: string): Promise<void> {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const child = resolve(path, entry.name);
      if (entry.isDirectory()) await scan(child);
      else if (entry.isFile()) files.push(child);
    }
  }
  for (const directory of ['src', 'content', 'public/assets', 'server/src', 'server/public', 'server/content', 'server/migrations', 'server/tests/Support', 'tests/e2e/support', 'tools']) await scan(resolve(directory));
  if (includeBuiltOutput) {
    try { await readFile(resolve('dist/index.html')); }
    catch { throw new Error('Build the current application with npm run build before the companion static journey.'); }
    await scan(resolve('dist'));
  }
  files.push(resolve('package-lock.json'), resolve('server/composer.lock'), resolve('vite.config.ts'), resolve('playwright.config.ts'),
    resolve('specs/001-physical-layer-underworld/contracts/save.schema.json'), resolve(`tests/e2e/${spec}.spec.ts`));
  return Object.fromEntries(await Promise.all([...new Set(files)].sort().map(async path =>
    [relative(process.cwd(), path), createHash('sha256').update(await readFile(path)).digest('hex')])));
}
