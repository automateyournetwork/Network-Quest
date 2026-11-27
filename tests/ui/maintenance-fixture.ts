// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Prepared starting arrival/O02/kit only; source actions use the actual modules/reducer.
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { createReducer, createReducerState, type ReducerInput, type ReducerState } from '../../src/state/reducer';
import { copperEffectBindings, prepareCopperAction, createCopperScenarioResolver } from '../../src/state/copper-scenario';
import { fiberEffectBindings, prepareFiberAction } from '../../src/state/fiber-scenario';
import { equipmentInteractionBindings } from '../../src/state/equipment-scenarios';
import { objectiveEffectBindings } from '../../src/state/objectives';
import { optionalActivityDefinition, optionalEffectBindings } from '../../src/state/optional-activities';
import { createOptionalActivitiesController, type OptionalActivityIntent } from '../../src/ui/optional-activities';
import { createVerbController } from '../../src/ui/verbs';
import { createActionBus, contextFromRuntime } from '../../src/ui/action-bus';
import type { ActionId, MeasurementId, QualifiedId } from '../../src/domain/types';
export const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const mid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
export const { registry, world } = loadIntroductionContent();
export const definition = optionalActivityDefinition(registry, q('SQ04'))!;
if (definition.optionalActivity.kind !== 'notebook-combination') throw new Error('Missing actual SQ04');
export const activity = definition.optionalActivity;
export function maintenanceFixture(collect = false, room: 'R03' | 'R05' | 'R09' = 'R03') {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), original = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...original, world: { ...original.world, flags: {},
    roomId: q(room), position: { safePositionId: q(`${room}.entry`) }, completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...original.notebook, personalNotes: 'I think the fiber was repaired.' } } });
  let blocked = false;
  const resolver = createCopperScenarioResolver(registry), equipment = equipmentInteractionBindings(registry);
  const reduce = createReducer({ registry, bindings: [...copperEffectBindings(registry), ...fiberEffectBindings(registry), ...equipment.effects, ...objectiveEffectBindings(registry), ...optionalEffectBindings(definition)], objectiveScenario: resolver });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) { if (blocked || before !== state) return false; state = next; return true; } };
  const game = () => state.runtime.game!;
  const raw = (input: ReducerInput) => { const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state; return result; };
  const arrive = (next: 'R03' | 'R05' | 'R09') => { const old = game(); state = { ...state, runtime: { ...state.runtime, game: { ...old, world: { ...old.world, roomId: q(next), position: { safePositionId: q(`${next}.entry`) } } } } }; };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const verbs = createVerbController({ registry, store, bus, bindings: equipment.hotspots });
  const acquire = (name: 'copper' | 'fiber' | 'market') => name === 'market' ? bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-market-case'), choiceId: q('ACTION-market-read-power'), verb: 'use', itemId: null }))
    : raw({ kind: 'apply', evaluation: name === 'copper' ? prepareCopperAction(registry, game(), q('ACTION-copper-read-defect')) : prepareFiberAction(registry, game(), q('ACTION-fiber-inspect-before')) });
  if (collect) { arrive('R03'); acquire('copper'); arrive('R05'); acquire('fiber'); arrive('R09'); acquire('market'); arrive(room); }
  const controller = createOptionalActivitiesController({ registry, store, bus, activityIds: [q('SQ04')] });
  const send = (input: OptionalActivityIntent) => bus.dispatch(controller.project().capture(input));
  const session = () => state.control.optionalActivity!.sessionId;
  const start = () => send({ kind: 'start-optional', activityId: q('SQ04'), hotspotId: activity.entryContexts.find(entry => entry.roomId === String(game().world.roomId))!.hotspotId as QualifiedId });
  const mode = (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: session(), mode });
  const simple = (kind: 'exit-optional' | 'retry-optional' | 'hint-optional' | 'explain-optional') => send({ kind, sessionId: session() });
  const measure = () => { const scenario = resolver(game(), q('O03')); if (!scenario) throw new Error('No copper scenario'); return raw({ kind: 'objective', operation: { kind: 'measure', objectiveId: q('O03'), alternativeId: scenario.alternativeId, id: mid(1) } }); };
  return { store, bus, controller, verbs, game, state: () => state, replace: (next: ReducerState) => { state = next; }, block: (value: boolean) => { blocked = value; },
    raw, arrive, acquire, measure, send, start, mode, simple, session };
}
