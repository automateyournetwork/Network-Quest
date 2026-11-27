// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { episodeNavigationEntries, loadIntroductionContent } from '../../src/app/content';
import { introductionBindings } from '../../src/app/introduction';
import type { ActionId, MeasurementId, QualifiedId } from '../../src/domain/types';
import { createNavigation } from '../../src/state/navigation';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../src/state/reducer';
import { createRepairScenarioResolver, prepareRepairPlanChange, repairEffectBindings } from '../../src/state/repair-plan';
import type { RepairPlanOperation, RepairScenarioResolver } from '../../src/state/repair-plan';
import { allowRiftEncounterInput, isActiveRiftEncounter } from '../../src/state/rift-encounter';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import { createEncounterExecutionPlan, createRiftEncounterNavigation } from '../../src/ui/encounter';
import { createNavigationPlanner } from '../../src/ui/scene-objects';

export const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
export const { registry, world } = loadIntroductionContent();
const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });

/**
 * Seed accepted training prerequisites only; no claimed whole-episode play.
 * Preparation/actions, atomic T085 execution+T084 checkpoint, actual authored
 * navigation, measurements and all later classification are real runtime calls.
 */
export function fixture(route: 'copper' | 'fiber' | 'radio' = 'copper', replaceResolver?: (base: RepairScenarioResolver) => RepairScenarioResolver) {
  const initial = startIntroduction(createIntroductionRuntime(), registry), original = initial.game!;
  let state = createReducerState({ ...initial, activity: { kind: 'safe-preparation' }, game: { ...original,
    world: { ...original.world, roomId: q('R11'), position: { safePositionId: q('R11.preparation') },
      flags: { [q('FLAG-market-kit')]: 'compatible-kit-A', [q('FLAG-equipment-capability')]: '100/full',
        [q('FLAG-clock-method')]: 'step-and-decode', [q('FLAG-clock-role')]: 'physical-sampling-not-address-discovery',
        [q('FLAG-clock-bits-0')]: '00', [q('FLAG-clock-bits-1')]: '10', [q('FLAG-clock-bits-2')]: '11', [q('FLAG-clock-bits-3')]: '01' },
      completedObjectiveIds: ['O01', 'O02', ...(route === 'copper' ? ['O03', 'O04'] : route === 'fiber' ? ['O05', 'O06'] : ['O07', 'O08']), 'O09', 'O10'].map(id => q<'objective'>(id)),
      inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...original.notebook, mapRoomIds: [q('R01'), q('R02'), q('R10'), q('R11')], factIds: [], measurements: [] } } });
  const base = createRepairScenarioResolver(registry), resolver = replaceResolver?.(base) ?? base;
  const reduce = createReducer({ registry, bindings: [...introductionBindings(registry).effects, ...repairEffectBindings(registry)],
    repairScenario: resolver, canReachRoom: navigation.canReachRoom, allowDuringEncounter: allowRiftEncounterInput });
  const store = { getState: () => state, reduce, compareAndSet: (before: ReducerState, next: ReducerState) => {
    if (state !== before) return false; state = next; return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  bus.register('execute-repair-plan', action => createEncounterExecutionPlan({ registry, store, action, before: state, message: 'Reviewed intervention.' }));
  const normalWalk = createNavigationPlanner({ navigation, store }), activeWalk = createRiftEncounterNavigation({ navigation, store });
  bus.register('interact', action => {
    if (action.input.kind !== 'interact') return { status: 'rejected' };
    const room = registry.record(state.runtime.game!.world.roomId);
    if (room?.kind !== 'room') return { status: 'rejected' };
    return (isActiveRiftEncounter(state) ? activeWalk.plan : normalWalk)({ room, targetId: action.input.targetId as QualifiedId }, action, state);
  });
  const game = () => state.runtime.game!;
  const send = (input: ReducerInput, actionId = crypto.randomUUID() as ActionId) => {
    const result = reduce(state, { actionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state; return result;
  };
  const act = (operation: RepairPlanOperation) => {
    const prepared = prepareRepairPlanChange(registry, resolver, game(), operation);
    const result = send({ kind: 'repair-plan', operation }); return { result, evaluation: prepared.ok ? prepared.evaluation : null };
  };
  const choose = (name: string) => act({ kind: 'choose', actionId: q(`ACTION-repair-${name}`) });
  const move = (room: string) => bus.dispatch(bus.capture({ kind: 'interact', verb: 'walk', targetId: q(room), itemId: null }));
  const review = (id = 1) => act({ kind: 'review', id: uuid(id) });
  const execute = (id = 1, warningAcknowledged = true) => {
    const operation = { kind: 'execute', reviewId: uuid(id), warningAcknowledged } as const;
    const prepared = prepareRepairPlanChange(registry, resolver, game(), operation);
    return { result: bus.dispatch(bus.capture({ kind: 'execute-repair-plan', reviewId: uuid(id), warningAcknowledged })), evaluation: prepared.ok ? prepared.evaluation : null };
  };
  const prepare = (plan = `${route}-${route === 'copper' ? 'section' : 'A'}`, duration: string | null = plan === 'shutdown' ? null : 'permanent') => {
    choose(`plan-${plan}`); if (duration !== null) choose(`duration-${duration}`); choose('read-plan'); review();
  };
  const prove = () => { move('R12'); choose('read-classification'); act({ kind: 'measure-link', id: uuid(2) }); act({ kind: 'test-endpoint', id: uuid(3) }); };
  const classify = (selection: 'permanent' | 'temporary' | 'shutdown' = 'permanent') => act({ kind: 'classify', selection, linkId: uuid(2), endpointId: uuid(3) });
  return { game, state: store.getState, store, bus, replace: (next: ReducerState) => { state = next; }, resolver, reduce, send, act, choose, move, review, execute, prepare, prove, classify };
}
