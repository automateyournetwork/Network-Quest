// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import { contentError, invalidInput } from '../domain/evaluate';
import type { EffectId, EvaluationResult, QualifiedId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import type { ObjectiveScenarioResolver } from './objectives';
import type { EffectBinding, StateEffect } from './reducer';
import type { GameState } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
interface ActionContract {
  readonly name: string;
  readonly room: 'R07' | 'R08';
  readonly needsKit: boolean;
  readonly effect: S.effect | null;
}
const fact = (name: string, room: ActionContract['room'], factId: string): ActionContract => ({ name, room, needsKit: false,
  effect: { kind: 'record-fact', effectId: q(`EFFECT-radio-${name}`), factId: q(factId) } });
const selection = (name: string, room: ActionContract['room'], flag: string, value: string): ActionContract => ({ name, room, needsKit: true,
  effect: { kind: 'set-flag', effectId: q(`EFFECT-radio-${name}`), flagId: q(`FLAG-radio-${flag}`), value } });
/** Closed reviewed configuration choices; callers cannot supply arbitrary effects. */
const contracts: readonly ActionContract[] = [
  fact('read-path', 'R07', 'FACT-O07-path'), fact('read-settings', 'R07', 'FACT-O07-settings'),
  selection('align-existing', 'R07', 'path', 'aligned-existing'), selection('alternate-path', 'R07', 'path', 'alternate-path'),
  selection('unalign-path', 'R07', 'path', 'unaligned'), selection('match-settings', 'R07', 'settings', 'matched'),
  selection('mismatch-settings', 'R07', 'settings', 'mismatched'),
  { name: 'leave-skywell', room: 'R07', needsKit: false, effect: null },
  fact('read-survey', 'R08', 'FACT-O08-survey'),
  selection('channel-A', 'R08', 'channel', 'A'), selection('channel-B', 'R08', 'channel', 'B'),
  selection('mitigate-emitter', 'R08', 'conditions', 'surveyed'), selection('raise-noise', 'R08', 'conditions', 'raised-noise'),
  selection('boundary-exercise', 'R08', 'conditions', 'near-boundary'),
  { name: 'leave-observatory', room: 'R08', needsKit: false, effect: null },
];
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
};
function authored(registry: ContentRegistry, contract: ActionContract) {
  const source = registry.record(q(`DIALOGUE-radio-${contract.room === 'R07' ? 'skywell' : 'observatory'}`)), room = registry.record(q(contract.room));
  if (source?.kind !== 'dialogue' || room?.kind !== 'room' || source.nodes.length !== 1) return null;
  const node = source.nodes[0]!, choice = node.choices.find(c => c.id === q(`ACTION-radio-${contract.name}`));
  const condition: S.condition = contract.needsKit ? { kind: 'item-available', itemId: q('ITEM-inspection-kit'), quantity: 1 } : { kind: 'always' };
  if (!choice || node.id !== source.entryNodeId || node.effects.length || choice.nextNodeId !== null
    || canonical(node.condition) !== canonical({ kind: 'objective-complete', objectiveId: q('O02') })
    || canonical(choice.condition) !== canonical(condition)
    || canonical(choice.effects) !== canonical(contract.effect ? [contract.effect] : [])
    || (contract.effect && !room.hotspots.some(h => h.actionIds.includes(choice.id) && h.verbs.includes('use')))) return null;
  return { source, node, choice };
}
const configured = (registry: ContentRegistry) => contracts.every(contract => authored(registry, contract));

/** Context facts and reversible controls only; T074 owns measurement and completion. */
export function radioEffectBindings(registry: ContentRegistry): EffectBinding[] {
  if (!configured(registry)) return [];
  return contracts.flatMap(contract => contract.effect ? [{ sourceId: q(`DIALOGUE-radio-${contract.room === 'R07' ? 'skywell' : 'observatory'}`),
    effectId: contract.effect.effectId as EffectId, mode: 'repeatable' as const }] : []);
}
export function prepareRadioAction(registry: ContentRegistry, game: GameState, actionId: QualifiedId): EvaluationResult<unknown, StateEffect> {
  const contract = contracts.find(c => q(`ACTION-radio-${c.name}`) === actionId);
  if (!contract) return invalidInput('unknown-radio-action');
  const record = authored(registry, contract);
  if (!record || !configured(registry)) return contentError({ code: 'radio-action-content', field: 'action', message: 'This radio interaction does not match its reviewed room definition.' });
  if (game.world.roomId !== q(contract.room)) return invalidInput('radio-action-room-unavailable');
  if (!conditionSatisfied(record.node.condition, game.world) || !conditionSatisfied(record.choice.condition, game.world)) return invalidInput('radio-action-precondition');
  return { status: 'correct', reasonCode: 'radio-choice-recorded', observations: [], acceptedEffects: structuredClone(record.choice.effects) as StateEffect[] };
}

/**
 * RR-O07 supplies both viable path outcomes, independent of matching settings.
 * Arrival explicitly selects an unaligned path and mismatched settings; no
 * unobserved success is assumed. T08/T09/B-RADIO-20/B-RADIO-BELOW supply the
 * comparable power readings for this fictional exercise, not propagation rules.
 *
 * The reversible local emitter raises noise on BOTH scenario channel labels.
 * Merely selecting another channel does not disable it. Isolating the emitter
 * restores the supplied survey conditions: A -90 dBm, B -85 dBm. A separately
 * labeled boundary exercise supplies -84.99 dBm on either selected label. These
 * are scenario inputs, never a saved measurement. Only T074's explicit measure
 * operation creates a current record; every configuration change leaves previous
 * records stale even when later returning to the same controls.
 */
export function createRadioScenarioResolver(registry: ContentRegistry): ObjectiveScenarioResolver {
  const ready = configured(registry);
  return (game, objectiveId) => {
    if (!ready || ![q('O07'), q('O08')].includes(objectiveId)) return null;
    const selected = (flag: string, initial: string) => {
      const value = game.world.flags[q<'flag'>(`FLAG-radio-${flag}`)];
      // Only absence selects the authored arrival value. Explicit null or other
      // malformed values must reach the closed guard, never a passing default.
      return value === undefined ? initial : value;
    };
    const path = selected('path', 'unaligned');
    const settings = selected('settings', 'mismatched');
    const channel = selected('channel', 'A');
    const conditions = selected('conditions', 'raised-noise');
    if (!['unaligned', 'aligned-existing', 'alternate-path'].includes(String(path)) || typeof path !== 'string'
      || !['matched', 'mismatched'].includes(String(settings)) || typeof settings !== 'string'
      || !['A', 'B'].includes(String(channel)) || typeof channel !== 'string'
      || !['raised-noise', 'surveyed', 'near-boundary'].includes(String(conditions)) || typeof conditions !== 'string') return null;
    const prerequisite = { viablePath: path !== 'unaligned', settingsCompatible: settings === 'matched' };
    if (objectiveId === q('O07')) return { kind: 'radio-preparation', path: prerequisite,
      alternativeId: q(`ACTION-O07-${path === 'alternate-path' ? 'choose-alternate-path' : 'align-existing-path'}`) };
    return { kind: 'radio-proof', alternativeId: q(`ACTION-O08-scenario-channel-${channel}`), path: { ...prerequisite,
      signal: { value: -65, unit: 'dBm' }, noise: { value: conditions === 'raised-noise' ? -78 : conditions === 'near-boundary' ? -84.99 : channel === 'A' ? -90 : -85, unit: 'dBm' } } };
  };
}
