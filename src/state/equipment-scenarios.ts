// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { marketExhibitBindings } from './market-exhibits';
import { decodeToySamples } from '../domain/packet-journey';
import type { ToySample, ToySymbolProfile } from '../domain/packet-journey';
import type { FlagId, QualifiedId } from '../domain/types';
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { EffectBinding } from './reducer';
import type { HotspotBinding } from '../ui/verbs';
import type { ObjectiveScenario, ObjectiveScenarioResolver } from './objectives';
import type { GameState } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const equipmentFlags = Object.freeze({
  kit: q<'flag'>('FLAG-market-kit'), capability: q<'flag'>('FLAG-equipment-capability'),
  method: q<'flag'>('FLAG-clock-method'), role: q<'flag'>('FLAG-clock-role'),
  sample: q<'flag'>('FLAG-clock-sample'),
  pairs: Object.freeze([0, 1, 2, 3].map(i => q<'flag'>(`FLAG-clock-bits-${i}`))),
});

/** T12's declared sample positions and toy labels; neither voltage nor throughput. */
export const clockworksSamples: readonly ToySample[] = Object.freeze([
  { position: 0, value: -3, unit: 'toy-level' }, { position: 1, value: 1, unit: 'toy-level' },
  { position: 2, value: 3, unit: 'toy-level' }, { position: 3, value: -1, unit: 'toy-level' },
].map(sample => Object.freeze(sample as ToySample)));
const pairValues = new Set(['00', '01', '10', '11']);
const marketKits = [
  { value: 'original-over-budget', label: 'Original allocation', demands: [12, 11, 10] },
  { value: 'compatible-kit-A', label: 'Compatible kit A', demands: [12, 11] },
  { value: 'compatible-kit-B', label: 'Compatible kit B', demands: [12, 11, 7] },
  { value: 'same-shell-mismatch', label: 'Same-shaped module', demands: [12, 11] },
  { value: 'per-port-failure', label: 'Per-port test allocation', demands: [12, 11] },
] as const;
export function selectedMarketKit(game: GameState) {
  return marketKits.find(kit => kit.value === game.world.flags[equipmentFlags.kit]);
}
const value = (game: GameState, flag: FlagId) => game.world.flags[flag];
const capability = (game: GameState) => {
  const selected = value(game, equipmentFlags.capability);
  switch (selected) {
    case '100/full': return { bothNegotiate: true as const, selected: { rate: { value: 100, unit: 'Mb/s' as const }, duplex: 'full' as const } };
    case '1000/full': return { bothNegotiate: true as const, selected: { rate: { value: 1000, unit: 'Mb/s' as const }, duplex: 'full' as const } };
    case '10/half': return { bothNegotiate: true as const, selected: { rate: { value: 10, unit: 'Mb/s' as const }, duplex: 'half' as const } };
    default: return null;
  }
};

/**
 * A trusted projection of current authored choices, never an evaluator/verdict.
 * No selected kit, capability, pair or role is silently filled with a right answer.
 * Profile quantities and every technical predicate remain owned by T074/domain.
 */
export const resolveEquipmentPreparation: ObjectiveScenarioResolver = (game, objectiveId): ObjectiveScenario | null => {
  if (objectiveId !== q('O09') && objectiveId !== q('O10')) return null;
  const common = capability(game);
  if (!common) return null;
  if (objectiveId === q('O09')) {
    const kit = selectedMarketKit(game);
    if (!kit) return null;
    // Reviewed T10/RR-O09 cards explicitly supply these checks. They are not
    // inferred from a shell, a passing sum or an animation. No port rating added.
    return {
      kind: 'equipment', alternativeId: q(`ACTION-O09-${kit.value === 'compatible-kit-B' ? 'compatible-kit-B' : 'compatible-kit-A'}`),
      allocation: { demands: kit.demands.map(watts => ({ value: watts, unit: 'W' as const })),
        budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses',
        formFactorMatch: true, phyAndMediaMatch: kit.value !== 'same-shell-mismatch', hostSupport: true,
        portPowerCompatible: true, perPortConstraintsMet: kit.value !== 'per-port-failure' },
      capability: common,
    };
  }
  const method = value(game, equipmentFlags.method), role = value(game, equipmentFlags.role);
  if (method !== 'step-and-decode' && method !== 'notebook-and-replay') return null;
  if (role !== 'physical-sampling-not-address-discovery' && role !== 'physical-repeater-resolves-IP-address') return null;
  const pairs = equipmentFlags.pairs.map(flag => value(game, flag));
  if (pairs.some(pair => typeof pair !== 'string' || !pairValues.has(pair))) return null;
  return { kind: 'calibration', alternativeId: q(`ACTION-O10-${method}`),
    samples: clockworksSamples.map(sample => ({ ...sample })), decodedBits: pairs.join(''), roleClaim: role, capability: common };
};

/** Room-scoped training interaction; deployment may inspect the same carried choices. */
export const resolveEquipmentScenario: ObjectiveScenarioResolver = (game, objectiveId) => {
  if (game.world.roomId !== q(objectiveId === q('O09') ? 'R09' : 'R10')) return null;
  return resolveEquipmentPreparation(game, objectiveId);
};

/**
 * Untimed step/replay view. Cursor controls only the visible prefix. The existing
 * decoder validates and describes those samples; its zero effects remain intact.
 * It never writes the player's four answer pairs, measurements or completion.
 * Keep this view within the adventure frame; the caller supplies the registry's
 * canonical symbol profile. Missing cursor is an unstarted activity, not success.
 */
export function inspectClockworksSamples(game: GameState, profile: ToySymbolProfile) {
  if (game.world.roomId !== q('R10')) return null;
  const cursor = value(game, equipmentFlags.sample);
  if (typeof cursor !== 'number' || !Number.isInteger(cursor) || cursor < 0 || cursor >= clockworksSamples.length) return null;
  return decodeToySamples(profile, clockworksSamples.slice(0, cursor + 1));
}

/**
 * Expose only declared preparation/context choices through the shared verb
 * controller. Measurement/submission stay on T074's diagnostic controller.
 * Calling this projection does not install a runtime or mark a room accepted.
 */
interface ActionContract {
  readonly name: string; readonly source: string; readonly effect: S.effect;
  readonly targets: readonly { readonly room: 'R09' | 'R10'; readonly hotspot: string; readonly verb: 'use' | 'talk' }[];
}
const target = (room: 'R09' | 'R10', hotspot: string, verb: 'use' | 'talk' = 'use') => ({ room, hotspot, verb });
const selected = (name: string, source: string, flagId: FlagId, value: string | number, ...targets: ActionContract['targets']): ActionContract => ({
  name, source, targets, effect: { kind: 'set-flag', effectId: q(`EFFECT-${name}`), flagId, value },
});
const context = (name: string, source: string, fact: string, ...targets: ActionContract['targets']): ActionContract => ({
  name, source, targets, effect: { kind: 'record-fact', effectId: q(`EFFECT-${name}`), factId: q(fact) },
});
const caseTarget = target('R09', 'market-case'), loomTarget = target('R10', 'clockworks-loom');
/** Closed effect/target contracts, independent of editable dialogue labels. */
const contracts: readonly ActionContract[] = [
  ...marketKits.map(kit => selected(`market-${kit.value}`, 'market-equipment', equipmentFlags.kit, kit.value, caseTarget)),
  context('market-read-checklist', 'market-equipment', 'FACT-O09-module', caseTarget,
    ...['market-hermit', 'market-chimera', 'market-mole', 'market-badger'].map(id => target('R09', id, 'talk'))),
  context('market-read-power', 'market-equipment', 'FACT-market-ledger', caseTarget, target('R09', 'market-eel', 'talk')),
  ...['100/full', '1000/full', '10/half'].map(mode => selected(`equipment-mode-${mode.replace('/', '-')}`, 'equipment-capabilities', equipmentFlags.capability, mode,
    target('R09', 'market-chart'), target('R10', 'clockworks-console'))),
  context('equipment-read-capabilities', 'equipment-capabilities', 'FACT-market-checklist', target('R09', 'market-chart')),
  context('clock-read-capabilities', 'equipment-capabilities', 'FACT-clockworks-capabilities', target('R10', 'clockworks-console'), target('R10', 'clockworks-chameleon', 'talk')),
  ...['step-and-decode', 'notebook-and-replay'].map(method => selected(`clock-${method}`, 'clockwork-calibration', equipmentFlags.method, method, loomTarget)),
  selected('clock-role-physical', 'clockwork-calibration', equipmentFlags.role, 'physical-sampling-not-address-discovery', loomTarget),
  selected('clock-role-address', 'clockwork-calibration', equipmentFlags.role, 'physical-repeater-resolves-IP-address', loomTarget),
  context('clock-read-scope', 'clockwork-calibration', 'FACT-O10-scope', loomTarget, target('R10', 'clockworks-scorpion', 'talk')),
  context('clock-read-samples', 'clockwork-calibration', 'FACT-clockworks-sampling', loomTarget, target('R10', 'clockworks-golem', 'talk')),
  ...[0, 1, 2, 3].map(position => selected(`clock-sample-${position}`, 'clockwork-samples', equipmentFlags.sample, position, target('R10', 'clockworks-samples'))),
  selected('clock-replay', 'clockwork-samples', equipmentFlags.sample, 0, target('R10', 'clockworks-samples')),
  ...equipmentFlags.pairs.flatMap((flag, position) => [...pairValues].map(pair => selected(`clock-pair-${position}-${pair}`, 'clockwork-answers', flag, pair, target('R10', 'clockworks-dial')))),
];
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${canonical(child)}`).join(',')}}`;
  return JSON.stringify(value);
};
export function equipmentInteractionBindings(registry: ContentRegistry): { hotspots: HotspotBinding[]; effects: EffectBinding[] } {
  const hotspots: HotspotBinding[] = [], effects: EffectBinding[] = [];
  const condition = { kind: 'objective-complete', objectiveId: q('O02') };
  for (const contract of contracts) {
    const source = registry.record(q(`DIALOGUE-${contract.source}`));
    if (source?.kind !== 'dialogue' || source.nodes.length !== 1) throw new TypeError('Equipment choices require their declared single-node dialogue.');
    const entry = source.nodes[0]!, choice = entry.choices.find(c => c.id === q(`ACTION-${contract.name}`));
    const expectedChoices = contracts.filter(c => c.source === contract.source).map(c => q(`ACTION-${c.name}`)).sort();
    if (source.entryNodeId !== q(`DIALOGUE-${contract.source}-entry`) || entry.id !== source.entryNodeId || entry.effects.length || !choice
      || choice.nextNodeId !== null || canonical(entry.condition) !== canonical(condition) || canonical(choice.condition) !== canonical(condition)
      || canonical(choice.effects) !== canonical([contract.effect]) || canonical(entry.choices.map(c => c.id).sort()) !== canonical(expectedChoices)) {
      throw new TypeError('Equipment choices must preserve the exact reviewed preparation effects and conditions.');
    }
    effects.push({ sourceId: source.id as QualifiedId, effectId: contract.effect.effectId as EffectBinding['effectId'], mode: 'repeatable' });
    for (const expected of contract.targets) {
      const room = registry.record(q(expected.room));
      const hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === q(`HOTSPOT-${expected.hotspot}`)) : null;
      if (!hotspot || !hotspot.actionIds.includes(choice.id) || !hotspot.verbs.includes(expected.verb)) throw new TypeError('Equipment choices require their declared room, target and verb.');
      hotspots.push({ roomId: q<'room'>(expected.room), hotspotId: q(`HOTSPOT-${expected.hotspot}`), actionId: choice.id as QualifiedId,
        sourceId: source.id as QualifiedId, verb: expected.verb, itemId: null, mode: 'effects' });
    }
  }
  return { hotspots: [...hotspots, ...marketExhibitBindings(registry)], effects };
}

/** Application join: malformed authored controls cannot silently enable scoring. */
export function createEquipmentScenarioResolver(registry: ContentRegistry): ObjectiveScenarioResolver {
  try { equipmentInteractionBindings(registry); }
  catch { return () => null; }
  return resolveEquipmentScenario;
}
