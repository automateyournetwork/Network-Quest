// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Reconstruct the T132 production checkpoint from its task-owned inputs.
// Print to stdout for inspection. Never overwrite a later integration manifest.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { assetAllocations } from './asset-allocations.ts';
import { AssetFileReader } from './asset-files.ts';
import type { Asset, AssetManifest } from './asset-types.ts';
import { isAssetManifest } from './validate-assets.ts';

const allocationPath = 'assets-src/production-allocation.json';
const benchmarkPath = 'assets-src/integration/R01-T066.json';
const auditionsPath = 'assets-src/audio/auditions/metadata-followup/manifest-candidates.json';
const inspectionPath = 'assets-src/characters/photon-inspection/manifest.json';
const titleId = 'spec001:ASSET-MUSIC-title';
const photonId = 'spec001:ASSET-CH03';
const architectureId = 'spec001:ASSET-ARCH-R01';
const digest = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex');
const serialize = (value: unknown) => JSON.stringify(value, null, 2) + '\n';

export async function reconcileProduction(root: string) {
  const reader = await AssetFileReader.create(root);
  const inputs = new Map<string, string>();
  async function readInput(path: string) {
    const value = await reader.json(path);
    inputs.set(path, digest(await reader.read(path)));
    return value;
  }
  async function records(path: string) {
    const manifest = await readInput(path);
    assert(isAssetManifest(manifest), `Invalid fragment: ${path}`);
    assert.equal(manifest.additionalRenditions, undefined, path);
    const rows = new Map(manifest.assets.map(a => [a.assetId, a]));
    assert.equal(rows.size, manifest.assets.length, `Duplicate identity in ${path}`);
    return rows;
  }
  const freeze = await readInput(allocationPath) as {
    requiredQuotaIdentityCount: number;
    batches: { task: string; kind: string; assetIds: string[]; plannedFragmentPath: string }[];
  };
  const allocations = new Map(assetAllocations.map(a => [a.assetId, a]));
  assert.equal(freeze.requiredQuotaIdentityCount, 380);
  assert.equal(allocations.size, freeze.requiredQuotaIdentityCount);
  assert.deepEqual(freeze.batches.map(b => b.task).sort(), [
    'T063-retained', ...Array.from({ length: 25 }, (_, i) => `T${107 + i}`),
  ]);
  const benchmark = await records(benchmarkPath);
  const auditions = await records(auditionsPath);
  const inspection = await records(inspectionPath);
  assert.equal(benchmark.size, 21);
  assert.equal(auditions.size, 12);
  assert.deepEqual([...inspection.keys()], [photonId]);
  const primary = new Map<string, Asset>();
  const extras = [inspection.get(photonId)!];
  for (const batch of freeze.batches) {
    let rows: Map<string, Asset>;
    if (batch.task === 'T063-retained') {
      const { characters } = await readInput(batch.plannedFragmentPath) as {
        characters: { assetId: string; exportPath: string }[];
      };
      rows = new Map(characters.map(({ assetId, exportPath }) => {
        const a = benchmark.get(assetId);
        assert(a && a.exports.some(e => e.file.path === exportPath), assetId);
        return [assetId, a];
      }));
    } else {
      rows = await records(batch.plannedFragmentPath);
    }
    assert.deepEqual([...rows.keys()].sort(), [...batch.assetIds].sort(), batch.task);
    for (const [id, a] of rows) {
      const identity = allocations.get(id);
      assert(identity && !primary.has(id), `Invalid allocation: ${id}`);
      assert.equal(identity.semanticIdentity, a.semanticIdentity, id);
      assert.equal(identity.kind, a.kind, id);
      assert.equal(batch.kind, a.kind, id);
      if (id === titleId) {
        extras.push(a); // Full T124 cue. The active T065 audition has independent evidence.
        primary.set(id, auditions.get(id)!);
      } else {
        primary.set(id, a);
      }
    }
  }
  assert.equal(primary.size, allocations.size);
  primary.set(architectureId, benchmark.get(architectureId)!);
  // Every legacy source, export and live use must carry forward. The audio
  // metadata follow-up added source/review lineage to its original binding.
  for (const [id, previous] of benchmark) {
    const current = primary.get(id)!;
    assert.deepEqual(current.exports, previous.exports, id);
    assert.deepEqual(current.usedBy, previous.usedBy, id);
    assert.equal(current.status, previous.status, id);
    if (!auditions.has(id)) assert.deepEqual(current, previous, id);
  }
  for (const [id, previous] of auditions) assert.deepEqual(primary.get(id), previous, id);
  assert(extras.every(a => a.status === 'exported' && !a.countsTowardQuota && !a.usedBy.length));
  assert(extras.find(a => a.assetId === titleId)?.verification.some(v => v.check === 'listening' && v.status === 'pending'));
  const manifest: AssetManifest = {
    schemaVersion: 1, episodeId: 'spec001',
    assets: [...allocations.keys(), architectureId].map(id => primary.get(id)!),
    additionalRenditions: extras,
  };
  assert(isAssetManifest(manifest));
  return { manifest, inputSha256: Object.fromEntries(inputs) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const [command, ...extra] = process.argv.slice(2);
  assert(!extra.length && ['--print-manifest', '--check'].includes(command ?? ''), 'Use --print-manifest or --check');
  const { manifest, inputSha256 } = await reconcileProduction(root);
  const output = serialize(manifest);
  if (command === '--print-manifest') process.stdout.write(output);
  else {
    const reader = await AssetFileReader.create(root);
    const actual = digest(await reader.read('assets-src/manifest.json'));
    assert.equal(actual, digest(output), 'The canonical manifest differs from the T132 production checkpoint');
    process.stdout.write(serialize({ manifestSha256: actual, inputSha256 }));
  }
}
