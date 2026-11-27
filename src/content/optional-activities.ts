// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import type { OptionalActivityDefinition } from '../state/optional-activities';
import reviewed from '../../content/spec001/sources.json' with { type: 'json' };
import { maintenanceContentIssues } from './optional-maintenance.ts';
import { radioDiaryContentIssues } from './optional-radio-diary.ts';
import type * as S from './schema-types.generated';
const isRecord = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
const same = (left: unknown, right: unknown): boolean => JSON.stringify(left) === JSON.stringify(right);
const safe = new Set<string>(['stable-exploration', 'safe-preparation', 'safe-continue']);
/** Structural validation belongs to the shared schema; these checks bind meaning. */
export function optionalActivityContentIssues(record: unknown, registry: ContentRegistry): readonly string[] {
  try { return checkOptionalContent(record, registry); } catch { return ['optional-malformed']; }
}
function checkOptionalContent(record: unknown, registry: ContentRegistry): readonly string[] {
  const errors: string[] = [];
  if (isRecord(record) && record['kind'] === 'quest' && record['id'] === 'spec001:SQ04') return maintenanceContentIssues(record as unknown as S.quest, registry);
  if (isRecord(record) && record['kind'] === 'quest' && record['id'] === 'spec001:SQ03') return radioDiaryContentIssues(record as unknown as S.quest, registry);
  if (!isRecord(record) || record['kind'] !== 'quest' || !['spec001:SQ01', 'spec001:SQ02'].includes(String(record['id'])) || !isRecord(record['optionalActivity'])) return ['unsupported-optional-activity'];
  const activity = record['optionalActivity'];
  const toy = record['id'] === 'spec001:SQ01', expectedRule = toy ? 'spec001:PHY10' : 'spec001:PHY08';
  const keys = ['kind', 'speakerId', 'instructions', 'profileId', 'practice', 'delivery', 'feedback', 'controls', 'recovery', 'reward', 'entryContexts', 'returnPolicy', 'timingDefault', ...(toy ? [] : ['boundaryExample', 'answerControls'])];
  if (!exact(activity, keys) || activity['kind'] !== (toy ? 'toy-symbol-message' : 'delivered-power-audit') || activity['profileId'] !== (toy ? 'spec001:PROFILE-SYMBOLS' : 'spec001:PROFILE-POWER')
    || activity['timingDefault'] !== 'off' || activity['returnPolicy'] !== 'captured-entry' || !Array.isArray(activity['instructions'])
    || !activity['instructions'].length || !activity['instructions'].every(text)) errors.push('optional-shape');
  const def = record as unknown as OptionalActivityDefinition, authored = def.optionalActivity;
  if (authored.kind === 'radio-weather-diary' || authored.kind === 'notebook-combination') return ['optional-variant-mismatch'];
  if (!isRecord(activity['practice']) || !isRecord(activity['delivery']) || !isRecord(activity['feedback']) || !isRecord(activity['reward'])
    || !isRecord(activity['controls']) || !isRecord(activity['recovery']) || !Array.isArray(activity['entryContexts'])
    || !Array.isArray(record['effects']) || !Array.isArray(record['alternatives']) || !Array.isArray(record['evidence'])
    || !Array.isArray(record['ruleIds']) || !Array.isArray(record['profileIds']) || !Array.isArray(record['sourceClaims'])) return [...errors, 'optional-shape'];
  if (!exact(activity['controls'], ['practice', 'delivery', 'submit', 'retry', 'exit']) || !Object.values(activity['controls']).every(text)
    || !exact(activity['recovery'], ['retryExplanation', 'exitExplanation']) || !Object.values(activity['recovery']).every(text)
    || !exact(activity['feedback'], ['practice', 'delivery', 'contentError', 'alreadyCompleted'])
    || !text(authored.feedback.contentError) || !text(authored.feedback.alreadyCompleted)
    || !['practice', 'delivery'].every(mode => {
      const row = activity['feedback'] as Record<string, unknown>, feedback = row[mode];
      return isRecord(feedback) && exact(feedback, ['correct', 'incorrect', 'invalidInput']) && Object.values(feedback).every(text);
    })) errors.push('optional-controls');
  const profile = registry.record(authored.profileId);
  if (profile?.kind !== 'profile' || profile.reviewedProfileId !== authored.profileId || !profile.ruleIds.includes(expectedRule)
    || !def.profileIds.includes(authored.profileId) || !def.ruleIds.includes(expectedRule)
    || !same(def.sourceClaims, profile.sourceClaims)) errors.push('optional-profile');
  if (authored.kind === 'toy-symbol-message') for (const [mode, expectedCase] of [['practice', 'B-SYMBOL'], ['delivery', 'T12']] as const) {
    const part = authored[mode], reference = [...reviewed.referenceCases, ...reviewed.reviewCases].find(c => c.id === expectedCase);
    const symbols = reference && 'symbols' in reference.inputs ? reference.inputs.symbols : undefined;
    if (part.sourceCaseId !== expectedCase || !Array.isArray(part.samples) || !part.samples.every(s => isRecord(s) && exact(s, ['position', 'value', 'unit']))
      || !same(part.samples.map((s, index) => ({ position: index, value: s.value, unit: s.unit })), part.samples)
      || !same(part.samples.map(({ value, unit }) => ({ value, unit })), symbols)) errors.push(`optional-${mode}-source`);
  }
  if (authored.kind === 'delivered-power-audit') {
    if (!isRecord(authored.boundaryExample) || !isRecord(authored.answerControls) || !exact(authored.answerControls, ['assessmentLabel', 'withinBudget', 'overBudget', 'differenceLabel'])
      || !Object.values(authored.answerControls).every(text)) errors.push('optional-power-controls');
    for (const [mode, id] of [['practice', 'C-POWER'], ['delivery', 'T10'], ['boundaryExample', 'B-POWER-30']] as const) {
      const part = authored[mode], source = [...reviewed.referenceCases, ...reviewed.reviewCases].find(c => c.id === id);
      if (!part || part.sourceCaseId !== id || !source || !('demands' in source.inputs) || !same(part.demands, source.inputs.demands)
        || part.otherConstraints !== true || part.budgetBoundary !== 'delivered-after-losses' || part.demandBoundary !== 'delivered-after-losses') errors.push(`optional-${mode}-source`);
    }
  }
  if (registry.record(authored.speakerId)?.kind !== 'character' || authored.speakerId !== (toy ? 'spec001:CH13' : 'spec001:CH19') || authored.entryContexts.length === 0) errors.push('optional-speaker');
  for (const entry of authored.entryContexts) {
    if (!isRecord(entry) || !exact(entry, ['roomId', 'safePositionId', 'hotspotId'])) { errors.push('optional-entry'); continue; }
    const room = registry.record(entry.roomId), anchor = registry.safePosition(entry.safePositionId);
    const hotspot = room?.kind === 'room' && room.hotspots.find(h => h.id === entry.hotspotId);
    if (room?.kind !== 'room' || room.id !== (toy ? 'spec001:R04' : 'spec001:R09') || !anchor || anchor.roomId !== room.id || !anchor.eligibleStates.some(k => safe.has(k))
      || !hotspot || !hotspot.verbs.includes('look') || !room.characterIds.includes(authored.speakerId)
      || !def.evidence.every(f => f.roomId === entry.roomId)) errors.push('optional-entry');
  }
  if (!def.alternatives.every(a => isRecord(a) && Array.isArray(a['effects']) && Array.isArray(a['itemIds']) && Array.isArray(a['abilityIds']))
    || !def.effects.every(e => isRecord(e)) || !def.evidence.every(e => isRecord(e))) return [...errors, 'optional-record-shape'];
  const alternative = def.alternatives.find(a => a.id === authored.delivery.actionId);
  if (!alternative || def.alternatives.length !== 1 || alternative.method !== 'direct-action' || alternative.itemIds.length || alternative.abilityIds.length || alternative.effects.length) errors.push('optional-alternative');
  const allEffects = [...def.effects, ...def.alternatives.flatMap(a => a.effects)];
  if (allEffects.length !== 2 || new Set(allEffects.map(e => e.effectId)).size !== 2
    || !allEffects.some(e => e.kind === 'record-fact' && e.factId === authored.reward.factId && e.effectId === (toy ? 'spec001:EFFECT-SQ01-journal' : 'spec001:EFFECT-SQ02-audit'))
    || !allEffects.some(e => e.kind === 'complete-quest' && e.questId === def.id && e.effectId === `${def.id.replace(':SQ', ':EFFECT-SQ')}-complete`)
    || authored.reward.kind !== (toy ? 'journal-illustration' : 'workshop-decoration') || authored.reward.factId !== (toy ? 'spec001:FACT-SQ01-delivery' : 'spec001:FACT-SQ02-audit')
    || !def.evidence.some(e => e.id === authored.reward.factId)
    || authored.reward.assetId !== (toy ? 'spec001:ASSET-ILLUSTRATION-08' : 'spec001:ASSET-ILLUSTRATION-18')
    || (!toy && (!('roomId' in authored.reward) || authored.reward.roomId !== 'spec001:R02'))
    || !text(authored.reward.alternativeText) || !text(authored.reward.unavailableText)
    || !exact(activity['reward'], ['kind', 'factId', 'assetId', 'alternativeText', 'unavailableText', ...(toy ? [] : ['roomId'])])) errors.push('optional-reward');
  if (def.requiredForMainStory !== false || def.requiresReflexTiming !== false || def.skippable !== true || !isRecord(def.prerequisite) || def.prerequisite.kind !== 'always') errors.push('optional-safety');
  return errors;
}

/** Build-time allocation check. Planned rows never become image URLs or awards. */
export function optionalRewardAllocationMatches(definition: OptionalActivityDefinition, manifest: unknown): boolean {
  if (!isRecord(manifest) || !Array.isArray(manifest['assets'])) return false;
  const reward = definition.optionalActivity.reward;
  if (reward.kind === 'epilogue-maintenance-history') return definition.id === 'spec001:SQ04' && reward.factId === 'spec001:FACT-SQ04-history';
  const matches = manifest['assets'].filter(row => isRecord(row) && row['assetId'] === reward.assetId);
  const expected = definition.id === 'spec001:SQ01' ? '08' : definition.id === 'spec001:SQ02' ? '18' : definition.id === 'spec001:SQ03' ? '16' : null;
  return expected !== null && reward.assetId === `spec001:ASSET-ILLUSTRATION-${expected}` && matches.length === 1 && isRecord(matches[0])
    && matches[0]['kind'] === 'illustration' && matches[0]['semanticIdentity'] === `spec001:ILLUSTRATION-${expected}`
    && matches[0]['variantOf'] === null;
}
