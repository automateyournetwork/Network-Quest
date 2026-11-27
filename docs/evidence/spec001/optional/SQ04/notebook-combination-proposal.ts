// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T099 isolated proposal; the shared runtime must promote reviewed logic explicitly.
import type { ContentRegistry } from '../../../../../src/content/registry';
import { contentError, createEvaluator, isRecord } from '../../../../../src/domain/evaluate';
import type { DomainAction, FactId, WorldVersion } from '../../../../../src/domain/types';
import type { GameState } from '../../../../../src/state/types';

export interface MaintenanceClue {
  readonly factId: string;
  readonly roomId: string;
  readonly evidenceKind: 'observation' | 'context';
  readonly dialogueId: string;
  readonly sourceActionId: string;
  readonly label: string;
  readonly description: string;
}
export interface MaintenanceAnswer { readonly selectedFactIds: readonly string[] }
export type MaintenanceMode = 'practice' | 'delivery';
export interface MaintenanceActivity {
  readonly kind: 'notebook-combination';
  readonly speakerId: 'narrator';
  readonly clues: readonly MaintenanceClue[];
  readonly practice: { readonly factIds: readonly string[]; readonly explanation: string };
  readonly delivery: { readonly actionId: 'spec001:ACTION-SQ04-combine'; readonly factIds: readonly string[] };
  readonly instructions: readonly string[];
  readonly timingDefault: 'off';
  readonly returnPolicy: 'captured-entry';
  readonly entryContexts: readonly { readonly roomId: string; readonly safePositionId: string; readonly hotspotId: string }[];
  readonly reward: { readonly kind: 'epilogue-maintenance-history'; readonly factId: 'spec001:FACT-SQ04-history'; readonly sourceRoomIds: readonly string[]; readonly epilogueText: string };
}
const bindings = [
  { factId: 'spec001:FACT-O03-defect', roomId: 'spec001:R03', evidenceKind: 'observation', dialogueId: 'spec001:DIALOGUE-copper-bench', sourceActionId: 'spec001:ACTION-copper-read-defect', subjects: ['spec001:PR023', 'spec001:PR029'] },
  { factId: 'spec001:FACT-O05-inspection', roomId: 'spec001:R05', evidenceKind: 'observation', dialogueId: 'spec001:DIALOGUE-fiber-gardens', sourceActionId: 'spec001:ACTION-fiber-inspect-before', subjects: ['spec001:PR043', 'spec001:PR044'] },
  { factId: 'spec001:FACT-market-ledger', roomId: 'spec001:R09', evidenceKind: 'context', dialogueId: 'spec001:DIALOGUE-market-equipment', sourceActionId: 'spec001:ACTION-market-read-power', subjects: ['spec001:PR084', 'spec001:PR085', 'spec001:PR089'] },
] as const;
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && keys.every(k => Object.hasOwn(value, k));
const sameIds = (a: readonly string[], b: readonly string[]) => a.length === b.length && [...a].sort().every((id, i) => id === [...b].sort()[i]);

/** Identity and source membership, never a parser for evidence prose. */
export function maintenanceClueIssues(clues: unknown, registry: ContentRegistry): readonly string[] {
  if (!Array.isArray(clues) || clues.length !== bindings.length) return ['maintenance-clue-shape'];
  const issues: string[] = [];
  for (const [index, expected] of bindings.entries()) {
    const clue = clues[index];
    if (!isRecord(clue) || !exact(clue, ['factId', 'roomId', 'evidenceKind', 'dialogueId', 'sourceActionId', 'label', 'description'])
      || !['factId', 'roomId', 'evidenceKind', 'dialogueId', 'sourceActionId'].every(k => clue[k] === expected[k as keyof typeof expected])
      || typeof clue['label'] !== 'string' || !clue['label'].trim() || typeof clue['description'] !== 'string' || !clue['description'].trim()) {
      issues.push('maintenance-clue-binding'); continue;
    }
    const room = registry.record(expected.roomId), source = registry.record(expected.dialogueId);
    const fact = room?.kind === 'room' ? room.evidence.find(e => e.id === expected.factId) : undefined;
    const choice = source?.kind === 'dialogue' ? source.nodes.flatMap(n => n.choices).find(c => c.id === expected.sourceActionId) : undefined;
    if (!fact || fact.roomId !== expected.roomId || fact.kind !== expected.evidenceKind || fact.requiresFreshMeasurement
      || !sameIds(fact.subjectIds, expected.subjects) || !choice || !choice.effects.some(e => e.kind === 'record-fact' && e.factId === expected.factId)
      || room?.kind !== 'room' || !room.hotspots.some(h => h.actionIds.includes(expected.sourceActionId))) issues.push('maintenance-authored-source');
  }
  return issues;
}

/** Staged registry semantic join; shared production promotion remains separate. */
export function maintenanceQuestIssues(record: unknown, registry: ContentRegistry): readonly string[] {
  if (!isRecord(record) || record['id'] !== 'spec001:SQ04' || record['kind'] !== 'quest' || !isRecord(record['optionalActivity'])) return ['unsupported-maintenance-record'];
  const activity = record['optionalActivity'];
  const issues = [...maintenanceClueIssues(activity['clues'], registry)];
  const expectedEffects = [
    { kind: 'record-fact', effectId: 'spec001:EFFECT-SQ04-history', factId: 'spec001:FACT-SQ04-history' },
    { kind: 'complete-quest', effectId: 'spec001:EFFECT-SQ04-complete', questId: 'spec001:SQ04' },
  ];
  const effects = record['effects'], alternatives = record['alternatives'];
  if (JSON.stringify(effects) !== JSON.stringify(expectedEffects) || !Array.isArray(alternatives) || alternatives.length !== 1
    || !isRecord(alternatives[0]) || alternatives[0]['id'] !== 'spec001:ACTION-SQ04-combine'
    || JSON.stringify(alternatives[0]['effects']) !== '[]' || JSON.stringify(alternatives[0]['ruleIds']) !== '[]'
    || JSON.stringify(record['ruleIds']) !== '[]' || record['requiredForMainStory'] !== false
    || record['requiresReflexTiming'] !== false || record['skippable'] !== true) issues.push('maintenance-reward-scope');
  const entries = activity['entryContexts'];
  if (!Array.isArray(entries) || entries.length !== 3) return [...issues, 'maintenance-entry'];
  for (const entry of entries) {
    if (!isRecord(entry)) { issues.push('maintenance-entry'); continue; }
    const room = registry.record(String(entry['roomId'])), safe = registry.safePosition(String(entry['safePositionId']));
    if (room?.kind !== 'room' || safe?.roomId !== room.id || !safe.eligibleStates.includes('stable-exploration')
      || !room.hotspots.some(h => h.id === entry['hotspotId'] && h.verbs.includes('look'))) issues.push('maintenance-entry');
  }
  return issues;
}

interface Challenge { readonly mode: MaintenanceMode; readonly observedFactIds: readonly FactId[] }
interface CombinationObservation {
  readonly kind: 'maintenance-combination';
  readonly mode: MaintenanceMode;
  readonly sourceRoomsPreserved: readonly string[];
  readonly missingSourceRooms: readonly string[];
  readonly activityCompletionEligible: boolean;
  readonly evidenceUse: 'supplied-practice-only' | 'historical-notebook-learning';
  readonly currentRepairProven: false;
  readonly endToEndServiceProven: false;
  readonly chronologyProven: false;
  readonly requiredObjectiveAward: 0;
}
const predicate = createEvaluator<Challenge, MaintenanceAnswer, CombinationObservation>({
  validateChallenge(value) {
    return !isRecord(value) || !exact(value, ['mode', 'observedFactIds']) || !['practice', 'delivery'].includes(String(value['mode']))
      || !Array.isArray(value['observedFactIds']) || value['observedFactIds'].length > 2048
      || !Array.from(value['observedFactIds']).every(id => typeof id === 'string')
      ? { code: 'maintenance-state', field: 'notebook', message: 'Supply the actual bounded notebook fact identities and authored mode.' } : null;
  },
  validateInput(value): value is MaintenanceAnswer {
    return isRecord(value) && exact(value, ['selectedFactIds']) && Array.isArray(value['selectedFactIds'])
      && value['selectedFactIds'].length > 0 && value['selectedFactIds'].length <= 3
      && Array.from(value['selectedFactIds']).every(id => typeof id === 'string' && bindings.some(b => b.factId === id));
  },
  evaluate(challenge, input) {
    const required = challenge.mode === 'practice' ? bindings.slice(0, 1) : bindings;
    const selected = new Set(input.selectedFactIds);
    const observed = new Set(challenge.observedFactIds);
    const missing = required.filter(b => !selected.has(b.factId) || (challenge.mode === 'delivery' && !observed.has(b.factId as FactId)));
    const correct = missing.length === 0 && sameIds(input.selectedFactIds, required.map(b => b.factId));
    return { status: correct ? 'correct' : 'incorrect', reasonCode: correct ? 'maintenance-record-combined' : 'maintenance-record-incomplete', acceptedEffects: [],
      observations: [{ kind: 'maintenance-combination', mode: challenge.mode,
        sourceRoomsPreserved: required.filter(b => !missing.includes(b)).map(b => b.roomId), missingSourceRooms: missing.map(b => b.roomId),
        activityCompletionEligible: challenge.mode === 'delivery' && correct,
        evidenceUse: challenge.mode === 'practice' ? 'supplied-practice-only' : 'historical-notebook-learning',
        currentRepairProven: false, endToEndServiceProven: false, chronologyProven: false, requiredObjectiveAward: 0 }] };
  },
});

/** Trusted mode/registry/game inputs; the UI supplies only selectedFactIds. */
export function evaluateMaintenanceAnswer(clues: unknown, registry: ContentRegistry, mode: MaintenanceMode,
  action: DomainAction<unknown>, game: GameState, world: WorldVersion = game.world) {
  const issues = maintenanceClueIssues(clues, registry);
  if (issues.length) return contentError({ code: issues[0]!, field: 'clues', message: 'The maintenance record must bind the three authored source entries.' });
  return predicate({ mode, observedFactIds: game.notebook.factIds }, action as DomainAction<MaintenanceAnswer>, world);
}

/** Both durable signals are required; retained learning alone cannot unlock history. */
export function maintenanceHistoryUnlocked(game: GameState): boolean {
  return game.world.completedQuestIds.some(id => String(id) === 'spec001:SQ04') && game.notebook.factIds.some(id => String(id) === 'spec001:FACT-SQ04-history');
}
