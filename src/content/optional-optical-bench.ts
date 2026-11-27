// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import type * as S from './schema-types.generated';
import validateSchema from './schema.generated.js';
import reviewed from '../../content/spec001/sources.json' with { type: 'json' };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/** Exact authored cards, objective prerequisite and own optional receipt. */
export function optionalOpticalBenchContentIssues(record: unknown, registry: ContentRegistry): readonly string[] {
  if (!validateSchema(record)) return ['optional-optical-shape'];
  const definition = record as S.minigame, activity = definition.optionalActivity;
  if (definition.kind !== 'minigame' || definition.id !== 'spec001:MG02' || activity?.kind !== 'optical-budget-bench'
    || definition.completionAchievementId !== 'spec001:ACHIEVEMENT-MG02-complete') return ['unsupported-optional-activity'];
  const errors: string[] = [], profile = registry.record(activity.profileId);
  if (profile?.kind !== 'profile' || profile.id !== 'spec001:PROFILE-OPTICAL' || profile.reviewedProfileId !== profile.id
    || !same(definition.profileIds, [profile.id]) || !same(definition.ruleIds, ['spec001:PHY03', 'spec001:PHY06'])
    || !same(definition.sourceClaims.map(s => s.sourceId).sort(), ['spec001:S03', 'spec001:S06', 'spec001:S07', 'spec001:S08', 'spec001:S10'])) errors.push('optional-optical-profile');
  for (const [mode, id] of [['practice', 'T04'], ['delivery', 'T05'], ['boundaryExample', 'T15']] as const) {
    const part = activity[mode], ref = [...reviewed.referenceCases, ...reviewed.reviewCases].find(c => c.id === id);
    if (!ref || !('loss' in ref.inputs) || part.sourceCaseId !== id || part.compatible !== true || !same(part.loss, ref.inputs.loss)) errors.push('optional-optical-source');
  }
  const ids = ['C-COMPAT', 'T07', 'B-COMPAT'];
  if (activity.compatibilityCards.length !== 3 || !activity.compatibilityCards.every((card, i) => {
    const ref = [...reviewed.referenceCases, ...reviewed.reviewCases].find(c => c.id === ids[i]);
    return card.sourceCaseId === ids[i] && !!ref && same(card.premises, ref.inputs);
  })) errors.push('optional-optical-compatibility');
  const room = registry.record('spec001:R06'), anchor = registry.safePosition('spec001:R06.entry');
  if (registry.record(activity.speakerId)?.kind !== 'character' || room?.kind !== 'room' || !room.characterIds.includes(activity.speakerId)
    || !room.hotspots.some(h => h.id === 'spec001:HOTSPOT-fiber-r06-pr059' && h.verbs.includes('look'))
    || anchor?.roomId !== room.id || !anchor.eligibleStates.includes('stable-exploration') || !definition.evidence.every(e => e.roomId === room.id)) errors.push('optional-optical-entry');
  const condition = { kind: 'objective-complete', objectiveId: 'spec001:O06' }, alternative = definition.alternatives[0];
  if (!same(definition.prerequisite, condition) || definition.alternatives.length !== 1 || alternative?.id !== activity.delivery.actionId
    || !same(alternative.condition, condition) || alternative.method !== 'direct-action' || alternative.itemIds.length || alternative.abilityIds.length || alternative.effects.length) errors.push('optional-optical-prerequisite');
  if (!same(definition.effects, [
    { kind: 'record-fact', effectId: 'spec001:EFFECT-MG02-notebook', factId: activity.reward.factId },
    { kind: 'complete-minigame', effectId: 'spec001:EFFECT-MG02-complete', minigameId: definition.id },
  ]) || !definition.evidence.some(e => e.id === activity.reward.factId && e.kind === 'observation')) errors.push('optional-optical-reward');
  if (definition.requiredForMainStory !== false || definition.requiresReflexTiming !== false || definition.requiredScoreForMainStory !== false
    || definition.skippable !== true || definition.timingDefault !== 'off') errors.push('optional-optical-safety');
  return errors;
}
