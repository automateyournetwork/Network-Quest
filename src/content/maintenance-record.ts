// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry';
import { isRecord } from '../domain/evaluate.ts';
/** One closed identity table shared by validation, projection and evaluation. */
export const sources = [
  { factId: 'spec001:FACT-O03-defect', roomId: 'spec001:R03', evidenceKind: 'observation', dialogueId: 'spec001:DIALOGUE-copper-bench',
    sourceActionId: 'spec001:ACTION-copper-read-defect', effectId: 'spec001:EFFECT-copper-read-defect',
    subjectIds: ['spec001:PR023', 'spec001:PR029'], hotspotId: 'spec001:HOTSPOT-copper-original-section', safePositionId: 'spec001:R03.entry', acquisition: 'copper' },
  { factId: 'spec001:FACT-O05-inspection', roomId: 'spec001:R05', evidenceKind: 'observation', dialogueId: 'spec001:DIALOGUE-fiber-gardens',
    sourceActionId: 'spec001:ACTION-fiber-inspect-before', effectId: 'spec001:EFFECT-fiber-inspect-before-fact',
    subjectIds: ['spec001:PR043', 'spec001:PR044'], hotspotId: 'spec001:HOTSPOT-fiber-r05-pr043', safePositionId: 'spec001:R05.entry', acquisition: 'fiber' },
  { factId: 'spec001:FACT-market-ledger', roomId: 'spec001:R09', evidenceKind: 'context', dialogueId: 'spec001:DIALOGUE-market-equipment',
    sourceActionId: 'spec001:ACTION-market-read-power', effectId: 'spec001:EFFECT-market-read-power',
    subjectIds: ['spec001:PR084', 'spec001:PR085', 'spec001:PR089'], hotspotId: 'spec001:HOTSPOT-market-ledger', safePositionId: 'spec001:R09.entry', acquisition: 'equipment' },
] as const;
type Source = typeof sources[number];
export type MaintenanceFactId = Source['factId'];
export type MaintenanceRoomId = Source['roomId'];
export type MaintenanceMode = 'practice' | 'delivery';
export interface MaintenanceClue {
  readonly factId: MaintenanceFactId;
  readonly roomId: MaintenanceRoomId;
  readonly evidenceKind: Source['evidenceKind'];
  readonly dialogueId: Source['dialogueId'];
  readonly sourceActionId: Source['sourceActionId'];
  readonly label: string;
  readonly description: string;
}
export interface MaintenanceAnswer { readonly selectedFactIds: readonly MaintenanceFactId[] }
interface ModeFeedback { readonly correct: string; readonly incorrect: string; readonly invalidInput: string }
export interface MaintenanceActivity {
  readonly kind: 'notebook-combination';
  readonly speakerId: 'narrator';
  readonly instructions: readonly string[];
  readonly clues: readonly MaintenanceClue[];
  readonly practice: { readonly factIds: readonly MaintenanceFactId[]; readonly explanation: string };
  readonly delivery: { readonly actionId: 'spec001:ACTION-SQ04-combine'; readonly factIds: readonly MaintenanceFactId[] };
  readonly answerControls: { readonly legend: string; readonly missingText: string; readonly historicalText: string };
  readonly feedback: { readonly practice: ModeFeedback; readonly delivery: ModeFeedback; readonly contentError: string; readonly alreadyCompleted: string };
  readonly controls: { readonly practice: string; readonly delivery: string; readonly submit: string; readonly retry: string; readonly exit: string };
  readonly recovery: { readonly retryExplanation: string; readonly exitExplanation: string };
  readonly reward: { readonly kind: 'epilogue-maintenance-history'; readonly factId: 'spec001:FACT-SQ04-history'; readonly sourceRoomIds: readonly MaintenanceRoomId[]; readonly epilogueText: string };
  readonly entryContexts: readonly { readonly roomId: MaintenanceRoomId; readonly safePositionId: Source['safePositionId']; readonly hotspotId: Source['hotspotId'] }[];
  readonly returnPolicy: 'captured-entry';
  readonly timingDefault: 'off';
}
export interface MaintenanceCard {
  readonly acquisitionLabel: string;
  readonly factId: MaintenanceFactId;
  readonly roomId: MaintenanceRoomId;
  readonly evidenceKind: Source['evidenceKind'];
  readonly label: string;
  readonly description: string;
  /** A supplied practice card never changes this actual notebook membership. */
  readonly recorded: boolean;
  readonly use: 'supplied-practice-only' | 'historical-notebook-learning';
}
export interface MaintenanceObservation {
  readonly kind: 'maintenance-combination';
  readonly mode: MaintenanceMode;
  readonly sourceRoomsPreserved: readonly MaintenanceRoomId[];
  readonly missingSourceRooms: readonly MaintenanceRoomId[];
  readonly activityCompletionEligible: boolean;
  readonly evidenceUse: MaintenanceCard['use'];
  readonly currentRepairProven: false;
  readonly endToEndServiceProven: false;
  readonly chronologyProven: false;
  readonly requiredObjectiveAward: 0;
}
export const exact = (value: unknown, keys: readonly string[]): value is Record<string, unknown> => isRecord(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const text = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;
export function stringsEqual(actual: unknown, expected: readonly string[]): boolean {
  return Array.isArray(actual) && actual.length === expected.length
    && Array.from(actual).every(value => typeof value === 'string')
    && [...actual].sort().every((value, index) => value === [...expected].sort()[index]);
}
function textFields(value: unknown, keys: readonly string[]): boolean {
  return exact(value, keys) && keys.every(key => text(value[key]));
}
const clueKeys = ['factId', 'roomId', 'evidenceKind', 'dialogueId', 'sourceActionId', 'label', 'description'] as const;

/**
 * Bind the actual authored records and their existing acquisition contracts.
 * The ordinary modules own action prerequisites. Validate those definitions;
 * do not execute them against today's world to disqualify historical learning.
 */
export function maintenanceClueIssues(clues: unknown, registry: ContentRegistry): readonly string[] {
  if (!Array.isArray(clues) || clues.length !== sources.length) return ['maintenance-clue-shape'];
  const issues: string[] = [];
  try {
    for (const [index, expected] of sources.entries()) {
      const clue: unknown = clues[index];
      if (!exact(clue, clueKeys) || !['factId', 'roomId', 'evidenceKind', 'dialogueId', 'sourceActionId'].every(key => clue[key] === expected[key as keyof Source])
        || !text(clue['label']) || !text(clue['description'])) { issues.push('maintenance-clue-binding'); continue; }
      const room = registry.record(expected.roomId), dialogue = registry.record(expected.dialogueId);
      const fact = room?.kind === 'room' ? room.evidence.find(entry => entry.id === expected.factId) : undefined;
      const node = dialogue?.kind === 'dialogue' ? dialogue.nodes.find(entry => entry.id === dialogue.entryNodeId) : undefined;
      const choice = node?.choices.find(entry => entry.id === expected.sourceActionId);
      if (!fact || fact.roomId !== expected.roomId || fact.kind !== expected.evidenceKind || fact.requiresFreshMeasurement
        || !stringsEqual(fact.subjectIds, expected.subjectIds) || !choice
        || !choice.effects.some(effect => effect.kind === 'record-fact' && effect.effectId === expected.effectId && effect.factId === expected.factId)
        || room?.kind !== 'room' || !room.hotspots.some(hotspot => hotspot.actionIds.includes(expected.sourceActionId))) issues.push('maintenance-authored-source');
    }
  } catch { issues.push('maintenance-authored-source'); }
  return issues;
}

/** Closed payload checks reusable by the later common registry join. No effects. */
export function maintenanceActivityIssues(value: unknown, registry: ContentRegistry): readonly string[] {
  if (!exact(value, ['kind','speakerId','instructions','clues','practice','delivery','answerControls','feedback','controls','recovery','reward','entryContexts','returnPolicy','timingDefault'])) return ['maintenance-activity-shape'];
  const issues = [...maintenanceClueIssues(value['clues'], registry)];
  if (value['kind'] !== 'notebook-combination' || value['speakerId'] !== 'narrator' || value['returnPolicy'] !== 'captured-entry' || value['timingDefault'] !== 'off'
    || !Array.isArray(value['instructions']) || !value['instructions'].length || value['instructions'].length > 8 || !Array.from(value['instructions']).every(text)) issues.push('maintenance-activity-shape');
  const practice = value['practice'], delivery = value['delivery'];
  if (!exact(practice, ['factIds','explanation']) || !stringsEqual(practice['factIds'], [sources[0].factId]) || !text(practice['explanation'])
    || !exact(delivery, ['actionId','factIds']) || delivery['actionId'] !== 'spec001:ACTION-SQ04-combine' || !stringsEqual(delivery['factIds'], sources.map(source => source.factId))) issues.push('maintenance-mode-sources');
  const feedback = value['feedback'];
  if (!textFields(value['answerControls'], ['legend','missingText','historicalText']) || !textFields(value['controls'], ['practice','delivery','submit','retry','exit'])
    || !textFields(value['recovery'], ['retryExplanation','exitExplanation']) || !exact(feedback, ['practice','delivery','contentError','alreadyCompleted'])
    || !text(feedback['contentError']) || !text(feedback['alreadyCompleted']) || !textFields(feedback['practice'], ['correct','incorrect','invalidInput'])
    || !textFields(feedback['delivery'], ['correct','incorrect','invalidInput'])) issues.push('maintenance-controls');
  const reward = value['reward'];
  if (!exact(reward, ['kind','factId','sourceRoomIds','epilogueText']) || reward['kind'] !== 'epilogue-maintenance-history' || reward['factId'] !== 'spec001:FACT-SQ04-history'
    || !stringsEqual(reward['sourceRoomIds'], sources.map(source => source.roomId)) || !text(reward['epilogueText'])) issues.push('maintenance-history');
  const entries = value['entryContexts'];
  if (!Array.isArray(entries) || entries.length !== sources.length) return [...issues, 'maintenance-entry'];
  for (const [index, source] of sources.entries()) {
    const entry: unknown = entries[index];
    if (!exact(entry, ['roomId','safePositionId','hotspotId']) || entry['roomId'] !== source.roomId || entry['safePositionId'] !== source.safePositionId || entry['hotspotId'] !== source.hotspotId) { issues.push('maintenance-entry'); continue; }
    const room = registry.record(source.roomId), position = registry.safePosition(source.safePositionId);
    if (room?.kind !== 'room' || position?.roomId !== source.roomId || !position.eligibleStates.includes('stable-exploration')
      || !room.hotspots.some(hotspot => hotspot.id === source.hotspotId && hotspot.verbs.includes('look'))) issues.push('maintenance-entry');
  }
  return issues;
}


/** Both durable signals are needed. This reads no physical or outcome verdict. */
export function maintenanceHistoryUnlocked(game: { readonly world: { readonly completedQuestIds: readonly string[] }; readonly notebook: { readonly factIds: readonly string[] } }): boolean {
  return game.world.completedQuestIds.some(id => String(id) === 'spec001:SQ04') && game.notebook.factIds.some(id => String(id) === 'spec001:FACT-SQ04-history');
}
