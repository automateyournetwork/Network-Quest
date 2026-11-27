// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import { contentError, invalidInput } from '../domain/evaluate';
import type { OpticalCompatibilityChecks } from '../domain/optics';
import type { EffectId, EvaluationResult, QualifiedId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import type { ObjectiveScenarioResolver } from './objectives';
import type { EffectBinding, StateEffect } from './reducer';
import type { GameState } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const connections = ['original', 'inspected', 'cleaned', 'replaced', 'verified-cleaned', 'verified-replaced'] as const;
const profiles = ['matched', 'wrong-fiber', 'wrong-wavelength', 'wrong-rate', 'wrong-polarity', 'unsupported-host'] as const;
const paths = ['passive-path-A', 'passive-path-B', 'high-loss'] as const;
interface Contract {
  readonly name: string;
  readonly room: 'R05' | 'R06';
  readonly condition: S.condition;
  readonly effects: readonly S.effect[];
}
const kit: S.condition = { kind: 'item-available', itemId: q('ITEM-inspection-kit'), quantity: 1 };
const eq = (value: string): S.condition => ({ kind: 'flag-equals', flagId: q('FLAG-fiber-connection'), value });
const any = (...values: string[]): S.condition => ({ kind: 'any', conditions: values.map(eq) });
// Missing state is the authored original connection. Unknown flags are rejected
// independently; they cannot exploit this negative condition as a passing state.
const beforeChange: S.condition = { kind: 'not', condition: any('cleaned', 'replaced', 'verified-cleaned', 'verified-replaced') };
const withKit = (condition: S.condition): S.condition => ({ kind: 'all', conditions: [kit, condition] });
const flag = (name: string, field: string, value: string): S.effect => ({ kind: 'set-flag', effectId: q(`EFFECT-fiber-${name}`), flagId: q(`FLAG-fiber-${field}`), value });
const fact = (name: string, id: string): S.effect => ({ kind: 'record-fact', effectId: q(`EFFECT-fiber-${name}`), factId: q(id) });
const contracts: readonly Contract[] = [
  { name: 'read-matching', room: 'R05', condition: { kind: 'always' }, effects: [fact('read-matching', 'FACT-O05-matching')] },
  { name: 'inspect-before', room: 'R05', condition: withKit(beforeChange), effects: [flag('inspect-before', 'connection', 'inspected'), fact('inspect-before-fact', 'FACT-O05-inspection')] },
  { name: 'restore-original', room: 'R05', condition: kit, effects: [flag('restore-original', 'connection', 'original')] },
  { name: 'clean', room: 'R05', condition: withKit(eq('inspected')), effects: [flag('clean', 'connection', 'cleaned')] },
  { name: 'replace', room: 'R05', condition: withKit(eq('inspected')), effects: [flag('replace', 'connection', 'replaced')] },
  { name: 'reinspect-clean', room: 'R05', condition: withKit(any('cleaned', 'verified-cleaned')), effects: [flag('reinspect-clean', 'connection', 'verified-cleaned')] },
  { name: 'reinspect-replace', room: 'R05', condition: withKit(any('replaced', 'verified-replaced')), effects: [flag('reinspect-replace', 'connection', 'verified-replaced')] },
  ...profiles.map(value => ({ name: `profile-${value}`, room: 'R05' as const, condition: withKit(beforeChange), effects: [flag(`profile-${value}`, 'profiles', value)] })),
  { name: 'leave-gardens', room: 'R05', condition: { kind: 'always' }, effects: [] },
  { name: 'read-compatibility', room: 'R06', condition: { kind: 'always' }, effects: [fact('read-compatibility', 'FACT-O06-compatibility')] },
  ...paths.map((value, index) => ({ name: `path-${['A', 'B', 'high-loss'][index]}`, room: 'R06' as const, condition: kit,
    effects: [flag(`path-${['A', 'B', 'high-loss'][index]}`, 'path', value)] })),
  { name: 'filter-shutter', room: 'R06', condition: { kind: 'always' }, effects: [] },
  { name: 'leave-vault', room: 'R06', condition: { kind: 'always' }, effects: [] },
];
const sourceId = (room: Contract['room']) => q(`DIALOGUE-fiber-${room === 'R05' ? 'gardens' : 'vault'}`);
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
};
function authored(registry: ContentRegistry, contract: Contract) {
  const source = registry.record(sourceId(contract.room)), room = registry.record(q(contract.room));
  if (source?.kind !== 'dialogue' || room?.kind !== 'room' || source.nodes.length !== 1) return null;
  const node = source.nodes[0]!, choice = node.choices.find(c => c.id === q(`ACTION-fiber-${contract.name}`));
  const expectedChoices = contracts.filter(c => c.room === contract.room).map(c => q(`ACTION-fiber-${c.name}`)).sort();
  if (!choice || node.id !== source.entryNodeId || node.speakerId !== 'narrator' || node.effects.length || node.evidenceIds.length || source.evidence.length
    || source.skipPolicy !== 'retain-required-evidence' || source.replayPolicy !== 'no-duplicate-effects'
    || canonical(node.choices.map(c => c.id).sort()) !== canonical(expectedChoices)
    || canonical(node.condition) !== canonical({ kind: 'objective-complete', objectiveId: q('O02') })
    || choice.nextNodeId !== null || canonical(choice.condition) !== canonical(contract.condition)
    || canonical(choice.effects) !== canonical(contract.effects)
    || (contract.effects.length && !room.hotspots.some(h => h.actionIds.includes(choice.id) && h.verbs.includes('use')))) return null;
  return { source, node, choice };
}
function selections(game: GameState) {
  const connection = game.world.flags[q<'flag'>('FLAG-fiber-connection')];
  const profile = game.world.flags[q<'flag'>('FLAG-fiber-profiles')];
  const path = game.world.flags[q<'flag'>('FLAG-fiber-path')];
  if ((connection !== undefined && !connections.some(v => v === connection)) || (profile !== undefined && !profiles.some(v => v === profile))
    || (path !== undefined && !paths.some(v => v === path))) return null;
  return { connection: connection ?? 'original', profile: profile ?? 'wrong-wavelength', path: path ?? 'high-loss' };
}

/** Only the exact reviewed, repeatable authored effects may enter the reducer. */
export function fiberEffectBindings(registry: ContentRegistry): EffectBinding[] {
  if (contracts.some(contract => !authored(registry, contract))) return [];
  return contracts.flatMap(contract => contract.effects.map(effect => ({ sourceId: sourceId(contract.room), effectId: effect.effectId as EffectId, mode: 'repeatable' as const })));
}

/** No caller supplies a flag/value, measurement, completion or consuming effect. */
export function prepareFiberAction(registry: ContentRegistry, game: GameState, actionId: QualifiedId): EvaluationResult<unknown, StateEffect> {
  const contract = contracts.find(c => q(`ACTION-fiber-${c.name}`) === actionId);
  if (!contract) return invalidInput('unknown-fiber-action');
  const record = authored(registry, contract);
  if (!record || contracts.some(c => !authored(registry, c))) return contentError({ code: 'fiber-action-content', field: 'action', message: 'This optical interaction does not match its reviewed room definition.' });
  if (!selections(game)) return invalidInput('fiber-configuration-unavailable');
  if (game.world.roomId !== q(contract.room)) return invalidInput('fiber-action-room-unavailable');
  if (!conditionSatisfied(record.node.condition, game.world) || !conditionSatisfied(record.choice.condition, game.world)) return invalidInput('fiber-action-precondition');
  return { status: 'correct', reasonCode: 'fiber-choice-recorded', observations: [], acceptedEffects: structuredClone(record.choice.effects) as StateEffect[] };
}

/**
 * Source-backed T069/RR-O05/RR-O06 only. Profiles are explicit supplied candidates,
 * not inferred from shell shape, light, a creature, or a remembered award. The
 * original dock is uninspected; initial wavelength mismatch and 10 dB loss fail.
 * Cleaning/replacement confirm removal only after a distinct reinspection.
 * Required facts and current measurement provenance are checked by T074 itself.
 */
export function createFiberScenarioResolver(registry: ContentRegistry): ObjectiveScenarioResolver {
  const configured = contracts.every(contract => authored(registry, contract));
  return (game, objectiveId) => {
    if (!configured || ![q('O05'), q('O06')].includes(objectiveId)) return null;
    const selected = selections(game); if (!selected) return null;
    const checks: OpticalCompatibilityChecks = {
      mediaMatch: selected.profile !== 'wrong-fiber', wavelengthDirectionMatch: selected.profile !== 'wrong-wavelength',
      rateMatch: selected.profile !== 'wrong-rate', connectorPolarityMatch: selected.profile !== 'wrong-polarity', hostSupport: selected.profile !== 'unsupported-host',
    };
    const verified = selected.connection === 'verified-cleaned' || selected.connection === 'verified-replaced';
    if (objectiveId === q('O05')) return { kind: 'fiber-preparation',
      alternativeId: q(`ACTION-O05-inspected-connector-${selected.connection === 'replaced' || selected.connection === 'verified-replaced' ? 'replacement' : 'cleaning'}`),
      preparation: { checks, inspectedBeforeChange: selected.connection !== 'original', connectionDefectRemoved: verified } };
    return { kind: 'fiber-proof', alternativeId: q(`ACTION-O06-passive-path-${selected.path === 'passive-path-B' ? 'B' : 'A'}`),
      path: { compatible: Object.values(checks).every(Boolean), loss: { value: selected.path === 'passive-path-A' ? 8 : selected.path === 'passive-path-B' ? 9 : 10, unit: 'dB' } },
      inspectionComplete: verified };
  };
}
