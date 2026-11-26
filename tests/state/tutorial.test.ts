// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { createTutorialReducer, tutorialBatch } from '../../src/state/tutorial';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../src/state/reducer';
import type { ReducerInput, ReducerState, StateEffect } from '../../src/state/reducer';
import type { ActionId, MeasurementId, HypothesisId } from '../../src/domain/types';
import { registry, q, authoredInput } from '../ui/inventory-fixture';
import { createActionBus, contextFromRuntime } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { createDialogueController, introductionDialogueBindings } from '../../src/ui/dialogue';
import { createNotebookController } from '../../src/ui/notebook';
import { createInventoryController } from '../../src/ui/inventory';
import { createVerbController } from '../../src/ui/verbs';
import { createNavigation } from '../../src/state/navigation';
import { createNavigationPlanner, createSceneObjectProjection } from '../../src/ui/scene-objects';

function fixture() {
  const bindings = introductionBindings(registry).effects;
  const base = createReducer({ registry, bindings });
  const reduce = createTutorialReducer({ registry, reduce: base, nextActionId: () => crypto.randomUUID() as ActionId });
  let state = createReducerState(startIntroduction(createIntroductionRuntime(), registry));
  const send = (input: ReducerInput) => {
    const game = state.runtime.game!;
    const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
    state = result.state; return result;
  };
  const act = (id: string, source = 'DIALOGUE-arrival-actions') => {
    const record = registry.record(q(source)); if (record?.kind !== 'dialogue') throw new Error('Expected authored dialogue');
    const choice = record.nodes[0]!.choices.find(c => c.id === q(id))!;
    return send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-test-action', observations: [], acceptedEffects: choice.effects as StateEffect[] } });
  };
  const inspect = () => send({ kind: 'notebook', operation: { kind: 'inspect-path', id: crypto.randomUUID() as MeasurementId } });
  const prepare = () => { act('ACTION-observe-power'); act('ACTION-observe-link'); act('ACTION-take-kit'); };
  const workshop = () => send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'safe-travel', observations: [], acceptedEffects: [] }, destination: { roomId: q('R02'), safePositionId: q('R02.entry'), activity: 'stable-exploration' } });
  return { get state() { return state; }, set state(value: ReducerState) { state = value; }, base, reduce, send, act, inspect, prepare, workshop };
}

describe('T029 evidence-driven tutorial candidate composition', () => {
  it('joins actual controllers and commits O01 with its inspection in one CAS; completed dialogue remains replayable', () => {
    const f = fixture(), bindings = introductionBindings(registry);
    let commits = 0;
    const store = { getState: () => f.state, reduce: f.reduce, compareAndSet: (before: ReducerState, next: ReducerState) => { if (f.state !== before) return false; commits++; f.state = next; return true; } };
    const bus = createActionBus({ getContext: () => contextFromRuntime(f.state.runtime) });
    const notebook = createNotebookController({ bus, registry, store });
    const dialogue = createDialogueController({ bus, registry, store, bindings: introductionDialogueBindings, effectBindings: bindings.effects });
    const inventory = createInventoryController({ bus, registry, store });
    const navigation = createNavigation({ registry, world: authoredInput.world, entries: [{ roomId: q('R01'), safePositionId: q('R01.entry'), activity: 'stable-exploration' }, { roomId: q('R02'), safePositionId: q('R02.entry'), activity: 'stable-exploration' }] });
    const verbs = createVerbController({ bus, registry, store, bindings: [...bindings.hotspots, ...notebook.hotspotBindings, ...dialogue.hotspotBindings], panels: notebook.panels,
      walk: createNavigationPlanner({ navigation, store }), sceneObjects: createSceneObjectProjection({ registry, navigation }) });
    const send = (input: SemanticAction) => { const result = bus.dispatch(bus.capture(input)); expect(result.status, result.message).toBe('handled'); };
    const use = (target: string, verb: 'look'|'talk'|'use'|'walk', choice?: string) => send(choice
      ? { kind: 'choose-hotspot-action', targetId: q(target), verb, itemId: null, choiceId: q(choice) }
      : { kind: 'interact', targetId: q(target), verb, itemId: null });
    use('HOTSPOT-power', 'look'); use('HOTSPOT-link', 'look'); use('HOTSPOT-photon', 'talk');
    const skip = dialogue.project(); send(skip.view.controls.find(c => c.action.kind === 'skip-dialogue')!.action);
    const before = commits; use('HOTSPOT-path', 'use', 'ACTION-inspect-path'); expect(commits).toBe(before + 1);
    expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01')]);
    expect(dialogue.project().view.completed).toBe(true);
    use('R02', 'walk'); use('HOTSPOT-titan', 'talk'); send(dialogue.project().view.controls.find(c => c.action.kind === 'skip-dialogue')!.action);
    use('HOTSPOT-endpoints', 'look'); use('HOTSPOT-declared-path', 'look'); send({ kind: 'open-panel', panel: 'notebook' });
    send({ kind: 'pin-hypothesis', text: 'Any defensible possibility: I will test it.' });
    expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01'), q('O02')]);
    expect(dialogue.project().view.completed).toBe(true); const original = f.state.runtime.game!;
    send(dialogue.project().view.controls.find(c => c.action.kind === 'replay-dialogue')!.action); send(dialogue.project().view.controls.find(c => c.action.kind === 'skip-dialogue')!.action);
    expect(f.state.runtime.game).toBe(original); expect(f.state.runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    verbs.dispose(); inventory.dispose(); notebook.dispose(); dialogue.dispose(); bus.dispose();
  });
  it('starts an empty memory-only R01 run, never from the example save', () => {
    const runtime = startIntroduction(createIntroductionRuntime(), registry);
    expect(runtime.game!.world.roomId).toBe(q('R01'));
    expect(runtime.game!.world.completedObjectiveIds).toEqual([]);
    expect(runtime.game!.world.inventory).toEqual([]); expect(runtime.game!.notebook.factIds).toEqual([]);
    expect(runtime.game!.notebook.mapRoomIds).toEqual([q('R01')]);
    expect(runtime.persistence).toMatchObject({ status: 'unsaved', autosaveEnabled: false, knownSlot: undefined, pendingRequest: null });
    expect(runtime.auth.status).toBe('guest');
  });
  it('requires separate real observations and a current inspection; the actual incorrect 105 m result completes O01 without repair', () => {
    const f = fixture(); f.act('ACTION-observe-power'); expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([]);
    f.act('ACTION-observe-link'); f.act('ACTION-take-kit'); expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([]);
    const before = f.state; expect(f.inspect().status).toBe('applied'); const game = f.state.runtime.game!;
    expect(before.runtime.game!.notebook.measurements).toEqual([]);
    expect(game.world.completedObjectiveIds).toEqual([q('O01')]);
    expect(game.notebook.measurements[0]).toMatchObject({ conclusionCode: 'length-exceeded', readings: [{ name: 'Channel length', value: 105, unit: 'm' }, { name: 'Inclusive maximum', value: 100, unit: 'm' }, { name: 'Excess', value: 5, unit: 'm' }] });
    expect(isMeasurementCurrent(game.notebook.measurements[0]!, game.world)).toBe(true);
    expect(game.world.continueOutcome).toBeNull(); expect(game.world.completedObjectiveIds).not.toContain(q('O12'));
    const dirty = f.state.runtime.persistence.dirtyGeneration; f.act('ACTION-observe-power');
    expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01')]); expect(f.state.runtime.persistence.dirtyGeneration).toBe(dirty);
  });
  it('rejects markers alone, missing facts, stale version, wrong rule and wrong observation scope', () => {
    const f = fixture(); f.prepare(); f.inspect(); const complete = f.state.runtime.game!;
    const game = { ...complete, world: { ...complete.world, completedObjectiveIds: [] } };
    expect(tutorialBatch(registry, game, 'O01')).not.toBeNull();
    for (const changed of [
      { ...game, notebook: { ...game.notebook, factIds: [] } },
      { ...game, notebook: { ...game.notebook, factIds: [q<'fact'>('FACT-power')] } },
      { ...game, notebook: { ...game.notebook, measurements: [] } },
      ...[ { stale: true }, { configurationRevision: 0 }, { ruleId: q('PHY01') }, { roomId: q('R02') }, { subjectIds: [] } ].map(patch => ({ ...game, notebook: { ...game.notebook, measurements: [{ ...game.notebook.measurements[0]!, ...patch }] } })),
    ]) expect(tutorialBatch(registry, changed as typeof game, 'O01')).toBeNull();
    expect(tutorialBatch(registry, { ...game, world: { ...game.world, flags: {} } }, 'O01')).toBeNull();
  });
  it('requires O01, actual endpoint/path facts and real nonempty player speculation; wording is not graded', () => {
    const f = fixture(); f.prepare(); f.inspect(); f.workshop();
    f.act('ACTION-endpoints', 'DIALOGUE-workshop-actions'); f.act('ACTION-declare-path', 'DIALOGUE-workshop-actions');
    expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01')]);
    const before = f.state; expect(f.send({ kind: 'notebook', operation: { kind: 'pin-hypothesis', id: crypto.randomUUID() as HypothesisId, text: '  ' } }).status).toBe('rejected'); expect(f.state).toBe(before);
    const text = '<b>My alternative idea 🧵</b>: compare the endpoints.';
    f.send({ kind: 'notebook', operation: { kind: 'pin-hypothesis', id: crypto.randomUUID() as HypothesisId, text } });
    const game = f.state.runtime.game!; expect(game.world.completedObjectiveIds).toEqual([q('O01'), q('O02')]); expect(game.notebook.hypotheses[0]!.text).toBe(text);
    const incomplete = { ...game, world: { ...game.world, completedObjectiveIds: [q<'objective'>('O01')] } };
    for (const changed of [
      { ...incomplete, world: { ...incomplete.world, completedObjectiveIds: [] } },
      { ...incomplete, notebook: { ...incomplete.notebook, hypotheses: [] } },
      { ...incomplete, notebook: { ...incomplete.notebook, hypotheses: [{ ...game.notebook.hypotheses[0]!, text: ' ' }] } },
      { ...incomplete, notebook: { ...incomplete.notebook, factIds: game.notebook.factIds.filter(id => id !== q('FACT-endpoint-b')) } },
    ]) expect(tutorialBatch(registry, changed, 'O02')).toBeNull();
  });
  it('rolls back the initiating inspection if the canonical objective batch fails; no intermediate state is installed', () => {
    const f = fixture(); f.prepare(); const before = f.state, game = before.runtime.game!;
    const reduce = createTutorialReducer({ registry, nextActionId: () => 'tutorial-test' as ActionId,
      reduce: (state, command) => command.actionId === 'tutorial-test' ? { status: 'rejected', reason: 'generation-exhausted', state } : f.base(state, command) });
    const result = reduce(before, { actionId: 'inspection-test' as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
      input: { kind: 'notebook', operation: { kind: 'inspect-path', id: crypto.randomUUID() as MeasurementId } } });
    expect(result).toMatchObject({ status: 'rejected', reason: 'generation-exhausted' }); expect(result.state).toBe(before);
  });
  it('keeps old observations stale after a real change and never manufactures a current reading', () => {
    const f = fixture(); f.prepare(); f.inspect(); const reading = f.state.runtime.game!.notebook.measurements[0]!;
    f.act('ACTION-path-short'); expect(f.state.runtime.game!.notebook.measurements).toEqual([{ ...reading, stale: true }]);
    expect(f.state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01')]); f.inspect();
    expect(f.state.runtime.game!.notebook.measurements).toHaveLength(2);
    expect(f.state.runtime.game!.notebook.measurements[1]!.readings[0]!.value).toBe(95);
  });
});
