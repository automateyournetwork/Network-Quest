// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Mapping semantics only. This does not author, load or score MG01.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../../../../../src/content/registry';
import type * as S from '../../../../../src/content/schema-types.generated';
import type { WorldState } from '../../../../../src/state/types';
import type { AchievementId } from '../../../../../src/domain/types';
import { conditionSatisfied, minigameAchievement } from '../../../../../src/state/conditions';
import projection from '../SQ01/SQ01.current-schema.json' with { type: 'json' };
const world: WorldState = JSON.parse(readFileSync(new URL('../../../../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json', import.meta.url), 'utf8')).world;
const achievement = 'spec001:ACHIEVEMENT-loom-practice' as AchievementId;
const record = { ...projection, kind: 'minigame', id: 'spec001:MG01', completionAchievementId: achievement } as unknown as S.minigame & { completionAchievementId: string };
const registry: ContentRegistry = { record: id => id === record.id ? record : undefined,
  has: (kind, id) => kind === 'minigame' && id === record.id || kind === 'achievement' && id === achievement, safePosition: () => undefined };
const condition: S.condition = { kind: 'minigame-complete', minigameId: 'spec001:MG01' };
describe('T100 staged explicit durable minigame condition binding', () => {
  it('reads exactly the registered authored achievement from existing saved state', () => {
    expect(minigameAchievement(registry, 'spec001:MG01')).toBe(achievement);
    expect(conditionSatisfied(condition, { ...world, achievementIds: [] }, registry)).toBe(false);
    expect(conditionSatisfied(condition, { ...world, achievementIds: [achievement] }, registry)).toBe(true);
    expect(conditionSatisfied(condition, { ...world, achievementIds: ['spec001:ACHIEVEMENT-other' as AchievementId] }, registry)).toBe(false);
  });
  it('fails closed with no registry, missing content or a mismatched registered achievement', () => {
    const completed = { ...world, achievementIds: [achievement] };
    expect(conditionSatisfied(condition, completed)).toBe(false);
    expect(conditionSatisfied(condition, completed, { ...registry, record: () => undefined })).toBe(false);
    expect(conditionSatisfied(condition, completed, { ...registry, has: (kind, id) => kind === 'minigame' && id === record.id })).toBe(false);
    expect(conditionSatisfied(condition, completed, { ...registry, record: () => ({ ...record, completionAchievementId: 'spec001:ACHIEVEMENT-other' }) })).toBe(false);
    expect(conditionSatisfied(condition, completed, { ...registry, record: () => ({ ...record, id: 'spec001:MG02' }) })).toBe(false);
  });
  it('passes the registry through compound conditions and never turns unsupported negation into permission', () => {
    const complete = { ...world, achievementIds: [achievement] };
    const nested: S.condition = { kind: 'all', conditions: [{ kind: 'always' }, { kind: 'any', conditions: [condition] }] };
    expect(conditionSatisfied(nested, complete, registry)).toBe(true);
    expect(conditionSatisfied({ kind: 'not', condition }, world)).toBe(false);
    expect(conditionSatisfied({ kind: 'any', conditions: [{ kind: 'always' }, condition] }, world)).toBe(false);
    expect(conditionSatisfied({ kind: 'not', condition }, { ...world, achievementIds: [] }, registry)).toBe(true);
  });
});
