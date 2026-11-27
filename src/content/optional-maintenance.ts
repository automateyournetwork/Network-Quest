// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import type * as S from './schema-types.generated';
import { maintenanceActivityIssues } from './maintenance-record.ts';
import type { MaintenanceActivity } from './maintenance-record.ts';
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Identity-bound notebook task; contextual sources do not become scored physics. */
export function maintenanceContentIssues(record: S.quest, registry: ContentRegistry): readonly string[] {
  const errors = [...maintenanceActivityIssues(record.optionalActivity, registry)];
  if (errors.length) return errors;
  const activity = record.optionalActivity as MaintenanceActivity;
  const expectedClaims = ['spec001:S04', 'spec001:S10'].map(sourceId => {
    const room = registry.record(sourceId === 'spec001:S04' ? 'spec001:PROFILE-COPPER-100' : 'spec001:PROFILE-POWER');
    return room?.kind === 'profile' ? room.sourceClaims.find(claim => claim.sourceId === sourceId) : undefined;
  });
  if (record.id !== 'spec001:SQ04' || record.ruleIds.length || record.profileIds.length || expectedClaims.some(c => !c)
    || !same(record.sourceClaims, expectedClaims)) errors.push('maintenance-context-only');
  const alternative = record.alternatives[0];
  if (record.alternatives.length !== 1 || alternative?.id !== activity.delivery.actionId || alternative.ruleIds.length
    || alternative.method !== 'direct-action' || alternative.itemIds.length || alternative.abilityIds.length || alternative.effects.length
    || !same(alternative.condition, { kind: 'always' }) || !same(alternative.evidenceIds, activity.delivery.factIds)) errors.push('maintenance-alternative');
  if (!same(record.effects, [{ kind: 'record-fact', effectId: 'spec001:EFFECT-SQ04-history', factId: 'spec001:FACT-SQ04-history' },
    { kind: 'complete-quest', effectId: 'spec001:EFFECT-SQ04-complete', questId: 'spec001:SQ04' }])
    || !same(record.evidence.map(e => e.id), ['spec001:FACT-SQ04-instructions', 'spec001:FACT-SQ04-history'])
    || record.evidence.some(e => e.roomId !== 'spec001:R03' || e.requiresFreshMeasurement || e.ruleIds.length
      || !same(e.subjectIds, activity.reward.sourceRoomIds))
    || record.evidence[1]?.text !== activity.reward.epilogueText) errors.push('maintenance-history-receipt');
  if (!same(record.prerequisite, { kind: 'always' }) || record.requiresReflexTiming || record.requiredForMainStory || !record.skippable) errors.push('maintenance-safety');
  return errors;
}
