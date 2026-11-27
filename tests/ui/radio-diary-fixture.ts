// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Prepared initial discovery/arrival only; radio and optional actions use actual reducers.
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { createReducer, createReducerState, type ReducerInput, type ReducerState } from '../../src/state/reducer';
import { radioEffectBindings, prepareRadioAction, createRadioScenarioResolver } from '../../src/state/radio-scenario';
import { objectiveEffectBindings } from '../../src/state/objectives';
import { optionalActivityDefinition, optionalEffectBindings } from '../../src/state/optional-activities';
import { createOptionalActivitiesController, type OptionalActivityIntent } from '../../src/ui/optional-activities';
import { createActionBus, contextFromRuntime } from '../../src/ui/action-bus';
import type { ActionId, MeasurementId, QualifiedId } from '../../src/domain/types';
export const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const mid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
export const { registry, world } = loadIntroductionContent();
export const definition = optionalActivityDefinition(registry, q('SQ03'))!;
export function diaryFixture(preparePair = true) {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), original = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...original, world: { ...original.world, flags: {},
    roomId: q('R07'), position: { safePositionId: q('R07.entry') }, completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...original.notebook, personalNotes: 'Keep observed order without inventing a clock.' } } });
  let blocked = false, commits = 0;
  const resolver = createRadioScenarioResolver(registry), reduce = createReducer({ registry,
    bindings: [...radioEffectBindings(registry), ...objectiveEffectBindings(registry), ...optionalEffectBindings(definition)], objectiveScenario: resolver });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (blocked || before !== state) return false; state = next; commits++; return true;
  } };
  const game = () => state.runtime.game!;
  const raw = (input: ReducerInput) => { const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state; return result; };
  const choose = (name: string) => raw({ kind: 'apply', evaluation: prepareRadioAction(registry, game(), q(`ACTION-radio-${name}`)) });
  const objective = (name: 'O07' | 'O08', kind: 'measure' | 'submit', n: number) => {
    const scenario = resolver(game(), q(name)); if (!scenario) throw new Error('Missing actual scenario');
    return raw({ kind: 'objective', operation: kind === 'measure' ? { kind, objectiveId: q(name), alternativeId: scenario.alternativeId, id: mid(n) }
      : { kind, objectiveId: q(name), alternativeId: scenario.alternativeId, measurementId: mid(n) } });
  };
  choose('read-path'); choose('read-settings'); choose('align-existing'); choose('match-settings'); objective('O07', 'measure', 1); objective('O07', 'submit', 1);
  raw({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'test-room-arrival', observations: [], acceptedEffects: [] },
    destination: { roomId: q('R08'), safePositionId: q('R08.entry'), activity: 'stable-exploration' } }); choose('read-survey');
  if (preparePair) { choose('mitigate-emitter'); objective('O08', 'measure', 2); choose('raise-noise'); objective('O08', 'measure', 3); }
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createOptionalActivitiesController({ registry, store, bus, activityIds: [q('SQ03')] });
  const send = (input: OptionalActivityIntent) => bus.dispatch(controller.project().capture(input));
  const session = () => state.control.optionalActivity!.sessionId;
  const start = () => send({ kind: 'start-optional', activityId: q('SQ03'), hotspotId: q('HOTSPOT-radio-vane') });
  const mode = (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: session(), mode });
  const simple = (kind: 'exit-optional' | 'retry-optional' | 'hint-optional' | 'explain-optional') => send({ kind, sessionId: session() });
  return { store, bus, controller, game, state: () => state, replace: (next: ReducerState) => { state = next; }, block: (value: boolean) => { blocked = value; },
    commits: () => commits, raw, choose, objective, send, start, mode, simple, session };
}
