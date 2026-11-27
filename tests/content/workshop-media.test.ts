// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { missingRegisteredAssetUses } from '../../tools/asset-files';
import type { AssetManifest, AssetUse, ConditionalBinding } from '../../tools/asset-types';
import { validateContent } from '../../src/content/registry';
import sources from '../../content/spec001/sources.json';
import world from '../../content/spec001/world.json';

describe('Workshop conditional media records', () => {
  it('refuses a different character file or a local resident registered as an optional recruit', () => {
    const documents = Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(p => [p, JSON.parse(readFileSync(p, 'utf8'))]));
    const binding = documents['content/spec001/rooms/R02.json'].mediaBindings.find((b: AssetUse) => b.use === 'party-placement');
    binding.exportPath = 'public/assets/models/CH02.glb';
    expect(validateContent({ world, sources, documents }).ok).toBe(false);
    binding.assetId = 'spec001:ASSET-CH02';
    expect(validateContent({ world, sources, documents }).ok).toBe(false);
  });
  it('requires the exact authored eligibility and export, and demands the actual use at release', () => {
    const canonical = JSON.parse(readFileSync('assets-src/manifest.json','utf8')) as AssetManifest;
    const character = structuredClone(canonical.assets.find(a => a.assetId === 'spec001:ASSET-CH04')!);
    character.usedBy = [];
    const binding: ConditionalBinding = { assetId: character.assetId, roomId: 'spec001:R02', contentId: 'spec001:R02', use: 'party-placement',
      exportPath: character.exports[0]!.file.path, trigger: 'active-party/spec001:CH04' };
    const manifest: AssetManifest = { schemaVersion: 1, episodeId: 'spec001', assets: [character], conditionalBindings: [binding] };
    const use = { ...binding, interactiveOrEvidence: false };
    expect(missingRegisteredAssetUses(manifest, [use], [binding])).toEqual([]);
    expect(missingRegisteredAssetUses(manifest, [use], [binding], 'release').map(f => f.code)).toEqual(['CONDITIONAL_USE_UNOBSERVED']);
    expect(missingRegisteredAssetUses(manifest, [use], [{...binding,trigger:'active-party/spec001:CH03'}]).map(f => f.code)).toContain('CONDITIONAL_BINDING_MISMATCH');
    const fake = {...binding, use:'character-placement'};
    expect(missingRegisteredAssetUses({...manifest, conditionalBindings:[fake]}, [{...use,use:fake.use}], [fake]).map(f => f.code)).toContain('REGISTERED_USE_MISSING');
  });
});
