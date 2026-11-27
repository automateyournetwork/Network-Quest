// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import { contentError, invalidInput } from '../domain/evaluate';
import type { EffectId, EvaluationResult, QualifiedId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import { isHistoricalCopperBaseline } from './objectives';
import type { ObjectiveScenarioResolver } from './objectives';
import type { EffectBinding, StateEffect } from './reducer';
import type { GameState } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
interface ActionContract {
  readonly name: string;
  readonly room: 'R03' | 'R04';
  readonly source: 'bench' | 'exhibit';
  readonly needsKit: boolean;
  readonly effect: S.effect | null;
}
const fact = (name: string, room: ActionContract['room'], factId: string): ActionContract => ({
  name, room, source: room === 'R03' ? 'bench' : 'exhibit', needsKit: false,
  effect: { kind: 'record-fact', effectId: q(`EFFECT-copper-${name}`), factId: q(factId) },
});
const selection = (name: string, room: ActionContract['room'], flag: string, value: string): ActionContract => ({
  name, room, source: room === 'R03' ? 'bench' : 'exhibit', needsKit: room === 'R03',
  effect: { kind: 'set-flag', effectId: q(`EFFECT-copper-${name}`), flagId: q(flag), value },
});
/** Closed mappings bind authored choices; no caller supplies flags or effects. */
const contracts: readonly ActionContract[] = [
  fact('read-compatibility', 'R03', 'FACT-O03-compatibility'),
  fact('read-defect', 'R03', 'FACT-O03-defect'),
  selection('restore-original', 'R03', 'FLAG-copper-path', 'original-broken'),
  selection('replace-section', 'R03', 'FLAG-copper-path', 'section-replacement'),
  selection('alternate-path', 'R03', 'FLAG-copper-path', 'alternate-passive-path'),
  { name: 'leave-bench', room: 'R03', source: 'bench', needsKit: false, effect: null },
  fact('read-before', 'R04', 'FACT-O04-before'),
  fact('read-repeater', 'R04', 'FACT-O04-repeater-limit'),
  selection('repeater-requires-continuity', 'R04', 'FLAG-copper-repeater-claim', 'requires-continuity'),
  selection('repeater-bridges-open', 'R04', 'FLAG-copper-repeater-claim', 'bridges-open'),
  { name: 'leave-exhibit', room: 'R04', source: 'exhibit', needsKit: false, effect: null },
];
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
};
function authored(registry: ContentRegistry, contract: ActionContract) {
  const source = registry.record(q(`DIALOGUE-copper-${contract.source}`));
  const room = registry.record(q(contract.room));
  if (source?.kind !== 'dialogue' || room?.kind !== 'room' || source.nodes.length !== 1) return null;
  const node = source.nodes[0]!, choice = node.choices.find(c => c.id === q(`ACTION-copper-${contract.name}`));
  const condition: S.condition = contract.needsKit
    ? { kind: 'item-available', itemId: q('ITEM-inspection-kit'), quantity: 1 } : { kind: 'always' };
  if (!choice || node.id !== source.entryNodeId || node.effects.length || choice.nextNodeId !== null
    || canonical(node.condition) !== canonical({ kind: 'objective-complete', objectiveId: q('O02') })
    || canonical(choice.condition) !== canonical(condition)
    || canonical(choice.effects) !== canonical(contract.effect ? [contract.effect] : [])
    || (contract.effect && !room.hotspots.some(h => h.actionIds.includes(choice.id) && h.verbs.includes('use')))) return null;
  return { source, node, choice };
}

/** Reversible configuration and set-like context facts; objective receipts are T074's. */
export function copperEffectBindings(registry: ContentRegistry): EffectBinding[] {
  if (contracts.some(contract => !authored(registry, contract))) return [];
  return contracts.flatMap(contract => contract.effect ? [{ sourceId: q(`DIALOGUE-copper-${contract.source}`),
    effectId: contract.effect.effectId as EffectId, mode: 'repeatable' as const }] : []);
}

/**
 * Room action preparation for the existing captured action bus and reducer.
 * No measurement, completion, consumption, reward or service verdict is emitted.
 */
export function prepareCopperAction(registry: ContentRegistry, game: GameState, actionId: QualifiedId): EvaluationResult<unknown, StateEffect> {
  const contract = contracts.find(c => q(`ACTION-copper-${c.name}`) === actionId);
  if (!contract) return invalidInput('unknown-copper-action');
  const record = authored(registry, contract);
  if (!record) return contentError({ code: 'copper-action-content', field: 'action', message: 'This copper interaction does not match its reviewed room definition.' });
  if (game.world.roomId !== q(contract.room)) return invalidInput('copper-action-room-unavailable');
  if (!conditionSatisfied(record.node.condition, game.world) || !conditionSatisfied(record.choice.condition, game.world)) return invalidInput('copper-action-precondition');
  return { status: 'correct', reasonCode: 'copper-choice-recorded', observations: [], acceptedEffects: structuredClone(record.choice.effects) as StateEffect[] };
}

/**
 * T069/RR-O03 supplies the two passive alternatives; T02 and the reviewed
 * required-conductor break supply the original bench state. Four entries denote
 * the exercise's required conductors, not a universal Ethernet pin requirement.
 * Absent FLAG-copper-path means the explicitly authored original-broken arrival
 * state. Its proposed section replacement has not happened: measuring still
 * evaluates 105 m with an open. A new reading is only created by T074 measure.
 */
export function createCopperScenarioResolver(registry: ContentRegistry): ObjectiveScenarioResolver {
  const configured = contracts.every(contract => authored(registry, contract));
  return (game, objectiveId) => {
    if (!configured || ![q('O03'), q('O04')].includes(objectiveId)) return null;
    const selected = game.world.flags[q<'flag'>('FLAG-copper-path')];
    if (selected !== undefined && selected !== 'original-broken' && selected !== 'section-replacement' && selected !== 'alternate-passive-path') return null;
    const mode = selected ?? 'original-broken';
    const path = { compatible: true,
      lengths: [{ value: mode === 'original-broken' ? 95 : mode === 'section-replacement' ? 85 : 90, unit: 'm' as const }, { value: 10, unit: 'm' as const }],
      requiredConductors: [true, true, mode !== 'original-broken', true] };
    if (objectiveId === q('O03')) return { kind: 'copper-preparation', path,
      alternativeId: q(`ACTION-O03-${mode === 'alternate-passive-path' ? mode : 'section-replacement'}`) };
    const claim = game.world.flags[q<'flag'>('FLAG-copper-repeater-claim')];
    if (claim !== undefined && claim !== 'requires-continuity' && claim !== 'bridges-open') return null;
    // Retained historical failures may be stale. A prose fact, remembered pass,
    // foreign path/profile or missing reading cannot invent the before evidence.
    // The scorer and selector use one canonical predicate. Appended newer valid
    // history wins; a malformed older row cannot hide a genuine later inspection.
    const before = [...game.notebook.measurements].reverse().find(m => isHistoricalCopperBaseline(registry, game, m));
    return { kind: 'copper-proof', alternativeId: q('ACTION-O04-conventional-continuity-tool'), path,
      beforeMeasurementId: before?.id ?? null, repeaterClaim: claim ?? null };
  };
}
