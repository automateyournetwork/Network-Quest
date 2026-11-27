// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import type * as S from './schema-types.generated';
import reviewed from '../../content/spec001/sources.json' with { type: 'json' };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Structural schema is closed; these checks bind its actual teaching sources. */
export function radioDiaryContentIssues(record: S.quest, registry: ContentRegistry): readonly string[] {
  const errors: string[] = [], activity = record.optionalActivity as S.optionalRadioDiary;
  const profile = registry.record('spec001:PROFILE-RADIO');
  if (record.id !== 'spec001:SQ03' || activity?.kind !== 'radio-weather-diary'
    || profile?.kind !== 'profile' || profile.reviewedProfileId !== profile.id
    || activity.profileId !== profile.id || !same(record.sourceClaims, profile.sourceClaims)
    || !same(record.ruleIds, ['spec001:PHY07', 'spec001:STATE01']) || !same(record.profileIds, [profile.id])) errors.push('optional-radio-profile');
  const boundary = reviewed.reviewCases.find(c => c.id === 'B-RADIO-20');
  if (!boundary || !('signal' in boundary.inputs) || !('noise' in boundary.inputs)
    || activity.practice.sourceCaseId !== boundary.id || !same(activity.practice.signal, boundary.inputs.signal)
    || !same(activity.practice.noise, boundary.inputs.noise) || activity.practice.otherPathChecks !== true) errors.push('optional-radio-practice');
  if (!same(activity.delivery, { actionId: 'spec001:ACTION-SQ03-compare', sourceCaseIds: ['T08', 'T09', 'B-RADIO-20', 'B-RADIO-BELOW'],
    measurementObjectiveId: 'spec001:O08', measurementRuleId: 'spec001:PHY07', measurementRoomId: 'spec001:R08', historicalUse: 'comparison-only',
    currentRequired: true, order: 'strictly-increasing-configuration-revision' })) errors.push('optional-radio-delivery');
  const objective = registry.record(activity.delivery.measurementObjectiveId), room = registry.record('spec001:R08');
  if (objective?.kind !== 'objective' || !objective.ruleIds.includes('spec001:PHY07') || !objective.profileIds.includes(activity.profileId)
    || objective.evidence[0]?.roomId !== 'spec001:R08') errors.push('optional-radio-objective');
  if (activity.speakerId !== 'spec001:CH10' || registry.record(activity.speakerId)?.kind !== 'character'
    || room?.kind !== 'room' || !room.characterIds.includes(activity.speakerId)
    || !same(activity.entryContexts, [{ roomId: 'spec001:R08', safePositionId: 'spec001:R08.entry', hotspotId: 'spec001:HOTSPOT-radio-vane' }])
    || !registry.safePosition('spec001:R08.entry')?.eligibleStates.includes('stable-exploration')
    || !room.hotspots.some(h => h.id === 'spec001:HOTSPOT-radio-vane' && h.verbs.includes('look'))
    || !record.evidence.every(e => e.roomId === 'spec001:R08')) errors.push('optional-radio-entry');
  if (record.alternatives.length !== 1 || record.alternatives[0]?.id !== activity.delivery.actionId
    || record.alternatives[0].method !== 'direct-action' || record.alternatives[0].itemIds.length || record.alternatives[0].abilityIds.length
    || record.alternatives[0].effects.length || !same(record.alternatives[0].condition, { kind: 'always' })) errors.push('optional-radio-alternative');
  if (!same(record.effects, [{ kind: 'record-fact', effectId: 'spec001:EFFECT-SQ03-comparison', factId: 'spec001:FACT-SQ03-comparison' },
    { kind: 'complete-quest', effectId: 'spec001:EFFECT-SQ03-complete', questId: 'spec001:SQ03' }])
    || activity.reward.kind !== 'optional-radio-depth' || activity.reward.factId !== 'spec001:FACT-SQ03-comparison'
    || activity.reward.assetId !== 'spec001:ASSET-ILLUSTRATION-16' || !record.evidence.some(e => e.id === activity.reward.factId)
    || !activity.reward.paragraphs.length) errors.push('optional-radio-reward');
  if (record.requiredForMainStory !== false || record.requiresReflexTiming !== false || record.skippable !== true
    || !same(record.prerequisite, { kind: 'always' }) || activity.returnPolicy !== 'captured-entry' || activity.timingDefault !== 'off') errors.push('optional-radio-safety');
  return errors;
}
