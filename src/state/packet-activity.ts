// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { evaluateCopper } from '../domain/copper';
import { isRecord } from '../domain/evaluate';
import { encodeToyBits, evaluatePacketJourney } from '../domain/packet-journey';
import type { PacketBench, PacketJourneyChallenge, PacketProfile, ToySubstitution, ToySymbolProfile } from '../domain/packet-journey';
import type { ActionId, QualifiedId } from '../domain/types';
import { contextFromRuntime } from '../ui/action-bus';
import type { ActionBus } from '../ui/action-bus';
import { guardedPlan, playable, rejected, unavailable } from '../ui/controller-store';
import type { GameplayStore } from '../ui/controller-store';
import { createPacketJourneyController } from '../ui/packet-journey';
import type { CurrentPacketJourneyBinding } from '../ui/packet-journey';
import type { HotspotBinding, InteractionPlanner } from '../ui/verbs';
import { conditionSatisfied } from './conditions';
import { introductionCopperChallenge } from './notebook';
import { createRepairPacketSource, inspectRepairPacketJourney } from './repair-packet';
import { createRepairScenarioResolver, repairClassification, repairFlags } from './repair-plan';
import type { RepairScenarioResolver } from './repair-plan';
import { isRiftValidationContext } from './rift-encounter';
import type { ReducerState, StateEffect } from './reducer';
import type { AuthState, GameState } from './types';
import authoredDefinition from '../../content/spec001/packet-introduction.json' with { type: 'json' };
import authoredContext from '../../content/spec001/packet-context.json' with { type: 'json' };
import authoredRepairContext from '../../content/spec001/packet-r12-context.json' with { type: 'json' };

export interface PacketIntroduction {
  readonly version: 1; readonly id: 'spec001:PACKET-R01';
  readonly symbolProfile: ToySymbolProfile; readonly bench: PacketBench; readonly impairment: ToySubstitution | null;
}
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
/** Separate lab premises and optional trace; never a replacement for physical evidence. */
export function validatePacketIntroduction(input: unknown): PacketIntroduction {
  if (!isRecord(input) || !exact(input, ['version', 'id', 'symbolProfile', 'bench', 'impairment'])
    || input['version'] !== 1 || input['id'] !== 'spec001:PACKET-R01') throw new TypeError('Invalid packet introduction.');
  const symbols = input['symbolProfile'];
  if (!isRecord(symbols) || !exact(symbols, ['id', 'parameters'])
    || encodeToyBits(symbols as unknown as ToySymbolProfile, '0100111001010001').status !== 'correct') throw new TypeError('Invalid packet symbol profile.');
  const bench = input['bench'], premises = ['knownCompatibleEndpointsMediaTerminations', 'requiredConductorsContinuous', 'endpointPowerKnownGood',
    'upperDependenciesKnownGoodForThisLab', 'otherPhysicalConditionsKnownGoodForThisLab'];
  if (!isRecord(bench) || !exact(bench, ['id', 'profileId', 'claimScope', ...premises]) || bench['id'] !== 'controlled-copper-bench'
    || bench['profileId'] !== q('PROFILE-COPPER-100') || premises.some(key => bench[key] !== true)
    || typeof bench['claimScope'] !== 'string' || !bench['claimScope'].trim() || bench['claimScope'].length > 1024
    || /[\uD800-\uDFFF\u0000-\u001F\u007F]/u.test(bench['claimScope'])) throw new TypeError('Invalid packet bench premises.');
  const trace = input['impairment'];
  if (trace !== null && (!isRecord(trace) || !exact(trace, ['id', 'position', 'from', 'to']) || trace['id'] !== 'last-toy-symbol-substitution'
    || trace['position'] !== 7 || !isRecord(trace['from']) || !exact(trace['from'], ['value', 'unit']) || trace['from']['value'] !== -1 || trace['from']['unit'] !== 'toy-level'
    || !isRecord(trace['to']) || !exact(trace['to'], ['value', 'unit']) || trace['to']['value'] !== -3 || trace['to']['unit'] !== 'toy-level')) throw new TypeError('Invalid packet toy substitution.');
  return freeze(structuredClone(input)) as unknown as PacketIntroduction;
}

interface OwnedActivity {
  readonly binding: CurrentPacketJourneyBinding; readonly game: GameState; readonly auth: AuthState;
  readonly pending: NonNullable<ReducerState['control']['pending']>;
}
export interface PacketActivityOptions {
  readonly bus: ActionBus; readonly registry: ContentRegistry; readonly store: GameplayStore;
  /** Trusted authored data override, never exposed to the DOM action boundary. */
  readonly definition?: unknown;
  /** Same trusted raw scenario resolver as apprentice validation; never a DOM verdict. */
  readonly resolveRepairScenario?: RepairScenarioResolver;
}

/** Trusted R01/R12 inspection adapters. No saved activity fields, rewards or repair channel. */
export function createPacketActivityController(options: PacketActivityOptions) {
  const { bus, registry, store } = options;
  const resolveRepairScenario = options.resolveRepairScenario ?? createRepairScenarioResolver(registry);
  const definition = validatePacketIntroduction(Object.hasOwn(options, 'definition') ? options.definition : authoredDefinition);
  let owned: OwnedActivity | null = null, disposed = false;
  const owns = (activity: OwnedActivity, state: ReducerState) => state.runtime.game === activity.game && state.runtime.auth === activity.auth
    && state.control.pending === activity.pending && state.runtime.activity?.kind === 'pending-effect'
    && contextFromRuntime(state.runtime)?.configurationRevision === activity.binding.context.configurationRevision
    && contextFromRuntime(state.runtime)?.attemptId === activity.binding.context.attemptId;
  const release = (identity: object) => {
    const previous = owned;
    if (!previous || previous.binding.identity !== identity) return;
    owned = null;
    const before = store.getState();
    // Reference ownership is additional to revision/adventure IDs. A restored
    // same-ID save or a later account cannot inherit this activity's callback.
    if (!owns(previous, before)) return;
    const out = store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: previous.game.adventureId,
      expectedVersion: previous.binding.context, input: { kind: 'cancel', transitionActionId: previous.pending.actionId } });
    if (out.status === 'canceled') store.compareAndSet(before, out.state);
  };
  const journey = createPacketJourneyController({ bus, context: authoredContext, repairContext: authoredRepairContext,
    read: () => owned && !disposed && owns(owned, store.getState()) ? owned.binding : null,
    onClose: (_reason, identity) => release(identity),
  });
  const contentError = () => unavailable('packet-content-error', 'The demonstration content needs correction. No learner result or progress was awarded.');
  const plan: InteractionPlanner = (interaction, action, before) => {
    if (disposed || !playable(before) || before.runtime.game!.world.roomId !== q('R01')) return unavailable('packet-unavailable', 'Return to the Arrival Lift investigation to open this journey.');
    const room = registry.record(q('R01')), source = registry.record(q('DIALOGUE-arrival-actions'));
    const node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
    const choice = node?.choices.find(c => c.id === q('ACTION-packet-context'));
    const hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === q('HOTSPOT-capsule')) : undefined;
    const effect = choice?.effects[0];
    if (!room || !node || !choice || !hotspot || interaction.room !== room || interaction.hotspot !== hotspot || interaction.choice !== choice
      || interaction.verb !== 'look' || interaction.itemId !== null || !hotspot.verbs.includes('look') || !hotspot.actionIds.includes(choice.id)
      || !conditionSatisfied(node.condition, before.runtime.game!.world) || !conditionSatisfied(choice.condition, before.runtime.game!.world)
      || choice.effects.length !== 1 || effect?.kind !== 'record-fact' || effect.effectId !== q('EFFECT-packet-context') || effect.factId !== q('FACT-packet-context')) return contentError();
    return guardedPlan(store, before, { status: 'ready', commit: () => {
      if (disposed || owned) return unavailable('packet-unavailable', 'This journey is no longer available. Open its current control.');
      // Record the original authored Look fact, then acquire the reducer lock in
      // one CAS. Neither candidate becomes visible if validation or opening fails.
      const looked = store.reduce(before, { actionId: action.actionId, adventureId: before.runtime.game!.adventureId,
        expectedVersion: before.runtime.game!.world, input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'packet-context', observations: [], acceptedEffects: choice.effects as StateEffect[] } } });
      if (looked.status === 'rejected') return contentError();
      const game = looked.state.runtime.game!, context = contextFromRuntime(looked.state.runtime)!;
      const physical = introductionCopperChallenge(registry, game), packet = registry.record(q('PROFILE-PACKET'));
      if (!physical || packet?.kind !== 'profile' || packet.reviewedProfileId !== packet.id || !packet.ruleIds.includes(q('PHY11'))) return contentError();
      const challenge: PacketJourneyChallenge = freeze({ packetProfile: { id: packet.id, parameters: structuredClone(packet.parameters) } as PacketProfile,
        symbolProfile: definition.symbolProfile, bench: definition.bench, impairment: definition.impairment });
      // This is a fresh real measurement of the selected path at its original
      // current version. It is transient and never relabels notebook evidence.
      const evaluatedVersion = { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId };
      const result = evaluateCopper(physical, { actionId: crypto.randomUUID() as ActionId, expectedVersion: evaluatedVersion, input: { kind: 'measure-length' } }, game.world);
      const world = freeze({ ...evaluatedVersion, physicalEvidence: { result, evaluatedVersion: { ...evaluatedVersion }, stale: false } });
      const checked = evaluatePacketJourney(challenge, { actionId: crypto.randomUUID() as ActionId, expectedVersion: evaluatedVersion, input: { kind: 'inspect', phase: 'payload' } }, world);
      if (checked.status !== 'correct' && checked.status !== 'incorrect') return contentError();
      const locked = store.reduce(looked.state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: evaluatedVersion,
        input: { kind: 'begin', activity: 'pending-effect', evaluation: { status: 'correct', reasonCode: 'packet-activity', observations: [], acceptedEffects: [] } } });
      if (locked.status !== 'pending' || !locked.state.control.pending) return contentError();
      if (!store.compareAndSet(before, locked.state)) return rejected('state-replaced', 'The adventure changed. Open the journey again.');
      owned = { game, auth: locked.state.runtime.auth, pending: locked.state.control.pending, binding: freeze({ identity: {}, context: { ...context }, challenge, world }) };
      const opened = journey.open();
      if (opened.status !== 'handled') {
        // A compliant CAS does not notify/render midcommit. Roll back only the
        // exact candidate if the controller cannot accept the owned lock.
        owned = null; store.compareAndSet(locked.state, before);
      }
      return opened;
    } });
  };
  const repairAvailable = (state: ReducerState): boolean => {
    const game = state.runtime.game;
    if (!game || !state.runtime.ui || state.control.pending || game.world.roomId !== q('R12')
      || game.world.position.safePositionId !== q('R12.entry')) return false;
    if (isRiftValidationContext(state)) return true;
    const classification = repairClassification(game);
    return playable(state) && (state.runtime.activity?.kind === 'stable-exploration' || state.runtime.activity?.kind === 'safe-continue')
      && (classification === 'permanent' || classification === 'temporary') && game.world.flags[repairFlags.executed] !== 'shutdown'
      && game.outcomeHistory.some(event => event.attemptId === game.world.attemptId && event.route === game.world.route
        && event.outcome === (classification === 'permanent' ? 'E01' : 'E02'));
  };
  const repairPlan: InteractionPlanner = (interaction, _action, before) => {
    if (disposed || !repairAvailable(before)) return unavailable('packet-unavailable', 'Inspect the current executed route at the Iron Threshold, or finish the current outcome first.');
    const room = registry.record(q('R12')), source = registry.record(q('DIALOGUE-packet-r12'));
    const node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
    const choice = node?.choices.find(c => c.id === q('ACTION-packet-r12'));
    const hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === q('HOTSPOT-r12-3')) : undefined;
    const game = before.runtime.game!, context = contextFromRuntime(before.runtime)!;
    if (!room || room.kind !== 'room' || room.contentVersion !== game.contentVersion || source?.kind !== 'dialogue'
      || source.contentVersion !== game.contentVersion || source.nodes.length !== 1 || source.entryNodeId !== q('DIALOGUE-packet-r12-entry')
      || !node || node.effects.length !== 0 || node.choices.length !== 1 || !choice || !hotspot
      || node.condition.kind !== 'objective-complete' || node.condition.objectiveId !== q('O11') || choice.condition.kind !== 'always'
      || choice.effects.length !== 0 || choice.nextNodeId !== null || interaction.room !== room || interaction.hotspot !== hotspot
      || interaction.choice !== choice || interaction.verb !== 'look' || interaction.itemId !== null
      || !hotspot.verbs.includes('look') || !hotspot.actionIds.includes(choice.id)
      || !conditionSatisfied(node.condition, game.world) || !conditionSatisfied(choice.condition, game.world)) return contentError();
    return guardedPlan(store, before, { status: 'ready', commit: () => {
      if (disposed || owned || !repairAvailable(before)) return unavailable('packet-unavailable', 'This journey has changed. Open its current control.');
      const world = { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId };
      const source = createRepairPacketSource({ registry, resolveScenario: resolveRepairScenario, game });
      const checked = inspectRepairPacketJourney(source, { actionId: crypto.randomUUID() as ActionId, expectedVersion: world,
        input: { kind: 'inspect', phase: 'payload' } }, world);
      if (checked.status !== 'correct' && checked.status !== 'incorrect') return contentError();
      const locked = store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId,
        expectedVersion: world, input: { kind: 'begin', activity: 'pending-effect', evaluation: {
          status: 'correct', reasonCode: 'packet-repair-inspection', observations: [], acceptedEffects: [],
        } } });
      if (locked.status !== 'pending' || !locked.state.control.pending) return contentError();
      // An earlier notebook/inventory window must not remain the frame owner.
      // Only transient panel selection changes, in the same lock acquisition.
      const next = { ...locked.state, runtime: { ...locked.state.runtime,
        ui: { ...locked.state.runtime.ui!, panel: 'none' as const } } };
      if (!store.compareAndSet(before, next)) return rejected('state-replaced', 'The adventure changed. Open the journey again.');
      owned = { game, auth: locked.state.runtime.auth, pending: locked.state.control.pending,
        binding: freeze({ kind: 'repair', identity: {}, context: { ...context }, source, world }) };
      const opened = journey.open();
      if (opened.status !== 'handled') { owned = null; store.compareAndSet(next, before); }
      return opened;
    } });
  };
  const hotspotBindings: readonly HotspotBinding[] = [{ roomId: q('R01'), hotspotId: q('HOTSPOT-capsule'), verb: 'look', itemId: null,
    actionId: q('ACTION-packet-context'), sourceId: q('DIALOGUE-arrival-actions'), mode: 'port', plan },
    { roomId: q('R12'), hotspotId: q('HOTSPOT-r12-3'), verb: 'look', itemId: null, actionId: q('ACTION-packet-r12'),
      sourceId: q('DIALOGUE-packet-r12'), mode: 'port', plan: repairPlan }];
  return { hotspotBindings,
    project: () => journey.project(),
    invalidate() { journey.invalidate(); },
    dispose() { if (disposed) return; disposed = true; journey.dispose(); },
  };
}
