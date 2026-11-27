// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import type * as S from './schema-types.generated';
import validateSchema from './schema.generated.js';
import reviewed from '../../content/spec001/sources.json' with { type: 'json' };
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export function optionalRadioScoutContentIssues(value: unknown, registry: ContentRegistry): readonly string[] {
  if (!validateSchema(value)) return ['optional-radio-shape'];
  const definition = value as S.minigame, activity = definition.optionalActivity;
  if (definition.kind !== 'minigame' || definition.id !== 'spec001:MG03' || activity?.kind !== 'radio-channel-scout'
    || definition.completionAchievementId !== 'spec001:ACHIEVEMENT-MG03-complete') return ['unsupported-optional-activity'];
  const issues: string[] = [], profile = registry.record(activity.profileId);
  if (profile?.kind !== 'profile' || profile.reviewedProfileId !== profile.id || profile.id !== 'spec001:PROFILE-RADIO'
    || !same(definition.ruleIds, ['spec001:PHY07','spec001:STATE01']) || !same(definition.profileIds,[profile.id])
    || !same(definition.sourceClaims,profile.sourceClaims)) issues.push('optional-radio-profile');
  const boundary = reviewed.reviewCases.find(c => c.id === 'B-RADIO-20');
  if (!boundary || !('signal' in boundary.inputs) || !('noise' in boundary.inputs)
    || !same(activity.practice.signal,boundary.inputs.signal) || !same(activity.practice.noise,boundary.inputs.noise)) issues.push('optional-radio-source');
  const room = registry.record('spec001:R08'), anchor = registry.safePosition('spec001:R08.entry');
  if (room?.kind !== 'room' || !room.characterIds.includes(activity.speakerId) || anchor?.roomId !== room.id
    || !anchor.eligibleStates.includes('stable-exploration') || !room.hotspots.some(h=>h.id==='spec001:HOTSPOT-radio-channels'&&h.verbs.includes('look'))
    || !definition.evidence.every(e=>e.roomId===room.id)) issues.push('optional-radio-entry');
  const alternative = definition.alternatives[0];
  if (!same(definition.prerequisite,{kind:'objective-complete',objectiveId:'spec001:O08'}) || definition.alternatives.length!==1
    || alternative?.id!==activity.delivery.actionId || !same(alternative.condition,{kind:'always'}) || alternative.method!=='direct-action'
    || alternative.effects.length || alternative.itemIds.length || alternative.abilityIds.length) issues.push('optional-radio-prerequisite');
  if (!same(definition.effects,[{kind:'record-fact',effectId:'spec001:EFFECT-MG03-notebook',factId:activity.reward.factId},
    {kind:'complete-minigame',effectId:'spec001:EFFECT-MG03-complete',minigameId:definition.id}])
    || !definition.evidence.some(e=>e.id===activity.reward.factId&&e.kind==='observation')) issues.push('optional-radio-receipt');
  if (definition.requiredForMainStory!==false || definition.requiresReflexTiming!==false || definition.requiredScoreForMainStory!==false
    || definition.skippable!==true || definition.timingDefault!=='off') issues.push('optional-radio-safety');
  return issues;
}
