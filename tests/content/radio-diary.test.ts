// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import { loadIntroductionContent } from '../../src/app/content';
import { optionalActivityDefinition, optionalRewardAllocationMatches } from '../../src/state/optional-activities';
const json = (path: string): any => JSON.parse(readFileSync(path, 'utf8'));
function input() {
  const world = json('content/spec001/world.json');
  return { world, sources: json('content/spec001/sources.json'), documents: Object.fromEntries([...new Set<string>(world.documents.map((d: any) => d.path))].map(path => [path, json(path)])) };
}
describe('SQ03 current canonical schema and semantic source bindings', () => {
  it('loads the reviewed actual variant, radio shelf and existing planned illustration allocation', () => {
    const { registry } = loadIntroductionContent(), def = optionalActivityDefinition(registry, 'spec001:SQ03'); expect(def).not.toBeNull();
    expect(def?.optionalActivity.kind).toBe('radio-weather-diary'); expect(optionalRewardAllocationMatches(def!, json('assets-src/manifest.json'))).toBe(true);
    const room = registry.record('spec001:R08'); expect(room?.kind === 'room' && room.hotspots.find(h => h.id === 'spec001:HOTSPOT-radio-vane')?.description).not.toContain('later optional activity');
  });
  it.each(['source', 'profile', 'rule', 'practice-unit', 'practice-value', 'source-set', 'objective', 'entry', 'reward', 'partial-receipt', 'main-reward', 'reward-url', 'missing-exit', 'timed'])('rejects %s corruption before a learner answer', kind => {
    const data = input(), quest = data.documents['content/spec001/quests/SQ03.json'], activity = quest.optionalActivity;
    if (kind === 'source') quest.sourceClaims = [];
    if (kind === 'profile') activity.profileId = 'spec001:PROFILE-POWER';
    if (kind === 'rule') quest.ruleIds = ['spec001:PHY07'];
    if (kind === 'practice-unit') activity.practice.signal.unit = 'dB';
    if (kind === 'practice-value') activity.practice.noise.value = -84.99;
    if (kind === 'source-set') activity.delivery.sourceCaseIds = ['T08', 'T09', 'B-RADIO-20'];
    if (kind === 'objective') activity.delivery.measurementObjectiveId = 'spec001:O07';
    if (kind === 'entry') activity.entryContexts[0].hotspotId = 'spec001:HOTSPOT-radio-channels';
    if (kind === 'reward') activity.reward.factId = 'spec001:FACT-O08-survey';
    if (kind === 'partial-receipt') quest.effects.pop();
    if (kind === 'main-reward') quest.effects[1] = { kind: 'complete-objective', effectId: 'spec001:EFFECT-SQ03-complete', objectiveId: 'spec001:O08' };
    if (kind === 'reward-url') activity.reward.url = '/invented.png';
    if (kind === 'missing-exit') delete activity.controls.exit;
    if (kind === 'timed') activity.timingDefault = 'on';
    expect(validateContent(data).ok).toBe(false);
  });
  it('never requires the optional diary to complete radio or another required route', () => {
    const data = input(); data.world.objectives.find((o: any) => o.id === 'spec001:O08').prerequisite = { kind: 'quest-complete', questId: 'spec001:SQ03' };
    expect(validateContent(data).ok).toBe(false);
  });
});
