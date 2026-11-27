// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// These are new join assertions. Original T096 candidate/projection/tests/seals stay historical.
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../../../../../src/app/content';
import { validateContent } from '../../../../../../src/content/registry';
import { optionalActivityDefinition, optionalActivityContentIssues, optionalRewardAllocationMatches } from '../../../../../../src/state/optional-activities';
import candidate from '../SQ01.candidate.json' with { type: 'json' };
import projection from '../SQ01.current-schema.json' with { type: 'json' };
import canonical from '../../../../../../content/spec001/quests/SQ01.json' with { type: 'json' };
const read = (path: string) => readFileSync(new URL(`../../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const original = json('docs/evidence/spec001/optional/SQ01/source-seal.json');
const { registry, world } = loadIntroductionContent();
const definition = optionalActivityDefinition(registry, 'spec001:SQ01')!;
const documentSet = () => Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(path => [path, json(path)]));
function corrupted(mutator: (record: any) => void) {
  const documents = documentSet(); mutator(documents['content/spec001/quests/SQ01.json']);
  return validateContent({ world, sources: json('content/spec001/sources.json'), documents });
}
describe('T096 promoted SQ01 authoring evolution', () => {
  it('preserves every original draft, proposal, test, receipt and raw result byte', () => {
    for (const artifact of original.owned.filter((x: any) => x.path.startsWith('docs/evidence/spec001/optional/SQ01/'))) {
      expect(createHash('sha256').update(read(artifact.path)).digest('hex'), artifact.path).toBe(artifact.sha256);
    }
  });
  it('preserves the original schema-stage distinction against the actual pre-T100 schema snapshot', () => {
    const ajv = new Ajv({ strict: true, allErrors: true }); formats(ajv);
    const validate = ajv.compile(json('docs/evidence/spec001/optional/framework/content-schema-before-T100.json'));
    expect(validate(projection), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(candidate)).toBe(false);
    expect(candidate).toEqual({ ...projection, optionalActivity: candidate.optionalActivity });
  });
  it('promotes the exact reviewed full candidate, not the deliberately smaller historical projection', () => {
    expect(canonical).toEqual(candidate);
    expect(canonical).not.toEqual(projection);
    const { optionalActivity, ...underlying } = canonical;
    expect(underlying).toEqual(projection);
    expect(optionalActivity.entryContexts).toEqual(candidate.optionalActivity.entryContexts);
  });
  it('loads SQ01 through the actual current registry and loader exactly once', () => {
    expect(world.documents.filter(d => d.id === 'spec001:SQ01')).toEqual([{ kind: 'quest', id: 'spec001:SQ01', path: 'content/spec001/quests/SQ01.json' }]);
    expect(registry.record('spec001:SQ01')).toEqual(canonical);
    expect(definition).not.toBeNull(); expect(optionalActivityContentIssues(canonical, registry)).toEqual([]);
  });
  it('preserves the immutable physical and T092 oracle files while promoting source', () => {
    for (const path of ['tests/fixtures/optional-activities.json', 'tests/fixtures/companions.json', 'tests/fixtures/physical-cases.json', 'content/spec001/sources.json']) {
      const artifact = original.dependencies.find((x: any) => x.path === path);
      expect(createHash('sha256').update(read(path)).digest('hex')).toBe(artifact.sha256);
    }
  });
  it('binds the real planned illustration identity with no produced export claim', () => {
    const manifest = json('assets-src/manifest.json'); expect(optionalRewardAllocationMatches(definition, manifest)).toBe(true);
    expect(manifest.assets.find((x: any) => x.assetId === canonical.optionalActivity.reward.assetId)).toMatchObject({
      assetId: 'spec001:ASSET-ILLUSTRATION-08', semanticIdentity: 'spec001:ILLUSTRATION-08', status: 'planned', exports: [], countsTowardQuota: false,
    });
  });
  it.each(['profile', 'source-case', 'sample-order', 'safe-anchor', 'other-room', 'reward-fact', 'reward-image', 'main-effect', 'duplicate-effect', 'timing'])('actual integrated registry rejects %s corruption', kind => {
    const result = corrupted(record => {
      if (kind === 'profile') record.optionalActivity.profileId = 'spec001:PROFILE-RADIO';
      if (kind === 'source-case') record.optionalActivity.delivery.sourceCaseId = 'B-SYMBOL';
      if (kind === 'sample-order') record.optionalActivity.delivery.samples.reverse();
      if (kind === 'safe-anchor') record.optionalActivity.entryContexts[0].safePositionId = 'spec001:R05.entry';
      if (kind === 'other-room') record.optionalActivity.entryContexts[0].roomId = 'spec001:R03';
      if (kind === 'reward-fact') record.optionalActivity.reward.factId = 'spec001:FACT-SQ01-instructions';
      if (kind === 'reward-image') record.optionalActivity.reward.assetId = 'spec001:ASSET-ILLUSTRATION-09';
      if (kind === 'main-effect') record.effects.push({ kind: 'complete-objective', effectId: 'spec001:EFFECT-SQ01-bad', objectiveId: 'spec001:O10' });
      if (kind === 'duplicate-effect') record.effects.push(record.effects[0]);
      if (kind === 'timing') record.optionalActivity.timingDefault = 'on';
    });
    expect(result.ok).toBe(false); expect(result.issues.length).toBeGreaterThan(0);
  });
});
