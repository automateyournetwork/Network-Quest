// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import type * as S from './schema-types.generated';
import validateSchema from './schema.generated.js';
import reviewed from '../../content/spec001/sources.json' with { type: 'json' };

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
/** Only the reviewed MG01 variant is admitted; later minigames remain unavailable. */
export function optionalLoomContentIssues(record: unknown, registry: ContentRegistry): readonly string[] {
  if (!validateSchema(record)) return ['optional-loom-shape'];
  const definition = record as S.minigame, activity = definition.optionalActivity;
  if (definition.kind !== 'minigame' || definition.id !== 'spec001:MG01' || activity?.kind !== 'toy-symbol-loom'
    || definition.completionAchievementId !== 'spec001:ACHIEVEMENT-MG01-complete') return ['unsupported-optional-activity'];
  const errors: string[] = [];
  const profile = registry.record(activity.profileId);
  if (profile?.kind !== 'profile' || profile.id !== 'spec001:PROFILE-SYMBOLS' || profile.reviewedProfileId !== profile.id
    || !profile.ruleIds.includes('spec001:PHY10') || !same(definition.profileIds, [profile.id])
    || !same(definition.ruleIds, ['spec001:PHY10']) || !same(definition.sourceClaims, profile.sourceClaims)) errors.push('optional-profile');
  for (const [mode, expectedCase] of [['practice', 'B-SYMBOL'], ['delivery', 'T12']] as const) {
    const part = activity[mode], reference = [...reviewed.referenceCases, ...reviewed.reviewCases].find(c => c.id === expectedCase);
    const symbols = reference && 'symbols' in reference.inputs ? reference.inputs.symbols : undefined;
    if (part.sourceCaseId !== expectedCase || !same(part.samples.map(({ value, unit }) => ({ value, unit })), symbols)
      || !part.samples.every((sample, index) => sample.position === index)) errors.push(`optional-${mode}-source`);
  }
  const entry = activity.entryContexts[0], room = registry.record(entry.roomId), anchor = registry.safePosition(entry.safePositionId);
  if (registry.record(activity.speakerId)?.kind !== 'character' || room?.kind !== 'room' || room.id !== entry.roomId
    || !room.characterIds.includes(activity.speakerId) || !room.hotspots.some(h => h.id === entry.hotspotId && h.verbs.includes('look'))
    || anchor?.roomId !== room.id || !anchor.eligibleStates.includes('stable-exploration')
    || !definition.evidence.every(f => f.roomId === room.id)) errors.push('optional-entry');
  const alternative = definition.alternatives[0];
  if (definition.alternatives.length !== 1 || alternative?.id !== activity.delivery.actionId || alternative.method !== 'direct-action'
    || alternative.condition.kind !== 'always' || alternative.itemIds.length || alternative.abilityIds.length || alternative.effects.length) errors.push('optional-alternative');
  if (!same(definition.effects, [
    { kind: 'record-fact', effectId: 'spec001:EFFECT-MG01-notebook', factId: activity.reward.factId },
    { kind: 'complete-minigame', effectId: 'spec001:EFFECT-MG01-complete', minigameId: definition.id },
  ]) || !definition.evidence.some(e => e.id === activity.reward.factId && e.kind === 'observation')) errors.push('optional-reward');
  if (definition.prerequisite.kind !== 'always' || definition.requiredForMainStory !== false || definition.requiresReflexTiming !== false
    || definition.requiredScoreForMainStory !== false || definition.skippable !== true || definition.timingDefault !== 'off') errors.push('optional-safety');
  return errors;
}
