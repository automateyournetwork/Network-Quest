// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Derived for the contained-frame revision from t067-freeze.mjs, SHA-256 3719858f56e43b7a15d74c9d51205078539bd777500d55fc70a4fd55ca53e033.
// Historical helper and evidence remain unchanged.
import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const files = [];
for (const directory of ['src', 'content', 'dist', 'tools/measurement']) {
  for (const entry of await readdir(directory, { recursive: true, withFileTypes: true })) if (entry.isFile()) files.push(path.join(entry.parentPath, entry.name));
}
files.push('package.json', 'package-lock.json', 'vite.config.ts', 'assets-src/rooms/R01.blend', 'assets-src/characters/CH01.blend', 'assets-src/characters/CH03.blend',
  'assets-src/audio/auditions/projects/audition-bank.aup4', 'assets-src/audio/auditions/provenance/review-packet-seal.json', 'tools/measurement-browser-probe.ts');
const records = [];
for (const file of files.sort()) { const bytes = await readFile(file); records.push({ path: file, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }); }
const room = JSON.parse(await readFile('content/spec001/rooms/R01.json', 'utf8'));
const bindings = [];
for (const binding of room.mediaBindings) {
  const bytes = await readFile(binding.exportPath), sha256 = createHash('sha256').update(bytes).digest('hex');
  const distPath = `dist/${binding.exportPath.slice('public/'.length)}`, built = records.find(r => r.path === distPath);
  bindings.push({ assetId: binding.assetId, exportPath: binding.exportPath, bytes: bytes.length, sha256, distPath, distMatches: built?.sha256 === sha256 });
}
if (bindings.length !== 21 || bindings.some(b => !b.distMatches)) throw new Error('Frozen R01 binding/build mismatch');
const output = `docs/evidence/spec001/presentation/t067/frame-revision/freeze-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, JSON.stringify({ recordedAt: new Date().toISOString(), revision: 'Root-reviewed loop077 contained-frame T066 working tree; exact file hashes are authority, not an inferred commit', records, bindings }, null, 2) + '\n');
console.log(JSON.stringify({ output, files: records.length, bindings: bindings.length, sha256: createHash('sha256').update(await readFile(output)).digest('hex') }));
