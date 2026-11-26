// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import type { ActionId, QualifiedId } from '../../src/domain/types';
import { createNavigation } from '../../src/state/navigation';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../src/state/reducer';
import type { ReducerState } from '../../src/state/reducer';
import { createTutorialReducer } from '../../src/state/tutorial';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { createDialogueController, introductionDialogueBindings } from '../../src/ui/dialogue';
import { createInventoryController } from '../../src/ui/inventory';
import { createNotebookController } from '../../src/ui/notebook';
import { createNavigationPlanner, createSceneObjectProjection } from '../../src/ui/scene-objects';
import { createVerbController } from '../../src/ui/verbs';
import expectations from '../fixtures/guest-investigation.json' with { type: 'json' };

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const disposals: (() => void)[] = [];
afterEach(() => { for (const dispose of disposals.splice(0)) dispose(); });

/** Actual content, empty New Adventure and joined controllers; no prepared save
 * or hand-installed completion/measurement. Browser cases separately prove DOM. */
function introduction() {
  const { registry, world } = loadIntroductionContent(), bindings = introductionBindings(registry);
  const navigation = createNavigation({ registry, world, entries: [
    { roomId: q('R01'), safePositionId: q('R01.entry'), activity: 'stable-exploration' },
    { roomId: q('R02'), safePositionId: q('R02.entry'), activity: 'stable-exploration' },
  ] });
  let state = createReducerState(startIntroduction(createIntroductionRuntime(), registry));
  const store = { getState: () => state,
    reduce: createTutorialReducer({ registry, reduce: createReducer({ registry, bindings: bindings.effects, canReachRoom: navigation.canReachRoom }), nextActionId: () => crypto.randomUUID() as ActionId }),
    compareAndSet: (before: ReducerState, next: ReducerState) => { if (state !== before) return false; state = next; return true; },
  };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const notebook = createNotebookController({ registry, store, bus });
  const dialogue = createDialogueController({ registry, store, bus, bindings: introductionDialogueBindings, effectBindings: bindings.effects });
  const inventory = createInventoryController({ registry, store, bus });
  const verbs = createVerbController({ registry, store, bus, bindings: [...bindings.hotspots, ...notebook.hotspotBindings, ...dialogue.hotspotBindings], panels: notebook.panels,
    walk: createNavigationPlanner({ navigation, store }), sceneObjects: createSceneObjectProjection({ registry, navigation }) });
  disposals.push(() => { verbs.dispose(); inventory.dispose(); notebook.dispose(); dialogue.dispose(); bus.dispose(); });
  const send = (input: SemanticAction) => { const result = bus.dispatch(bus.capture(input)); expect(result.status, result.message).toBe('handled'); return result; };
  const interact = (target: string, verb: 'look' | 'talk' | 'use' | 'walk', choice?: string) => send(choice
    ? { kind: 'choose-hotspot-action', targetId: q(target), verb, itemId: null, choiceId: q(choice) }
    : { kind: 'interact', targetId: q(target), verb, itemId: null });
  const line = (label: string) => {
    const projected = dialogue.project(), control = projected.view.controls.find(c => c.label === label);
    expect(control, `Required dialogue control: ${label}`).toBeDefined();
    const result = bus.dispatch(projected.capture(control!.action)); expect(result.status, result.message).toBe('handled');
  };
  const converse = (target: string, skip = true) => {
    interact(target, 'talk');
    if (skip) { line('Skip dialogue'); return; }
    for (let index = 0; index < 32; index++) {
      if (dialogue.project().view.controls.some(c => c.label === 'Finish dialogue')) { line('Finish dialogue'); return; }
      line('Next dialogue line');
    }
    throw new Error('An introductory topic must finish within 32 authored lines.');
  };
  const inspect = () => interact('HOTSPOT-path', 'use', 'ACTION-inspect-path');
  const observe = () => { interact('HOTSPOT-power', 'look'); interact('HOTSPOT-link', 'look'); };
  const open = () => send({ kind: 'open-panel', panel: 'notebook' });
  const close = () => send({ kind: 'close-panel' });
  const walk = (room: string) => interact(room, 'walk');
  const prepareScope = () => { walk('R02'); converse('HOTSPOT-titan'); interact('HOTSPOT-endpoints', 'look'); interact('HOTSPOT-declared-path', 'look'); };
  return { get state() { return state; }, get game() { return state.runtime.game!; }, bus, notebook, dialogue, send, interact, line, converse, inspect, observe, open, close, walk, prepareScope };
}

describe('T030 joined introduction state acceptance', () => {
  it.each(['satchel first', 'Photon first'])('%s: real objectives, both dialogue topics and nonempty inventory survive skip/replay and return travel', order => {
    const f = introduction();
    expect(f.game.world.inventory).toEqual([]); expect(f.game.world.completedObjectiveIds).toEqual([]);
    if (order === 'satchel first') f.interact('HOTSPOT-satchel', 'use');
    f.converse('HOTSPOT-photon', false);
    f.interact('HOTSPOT-satchel', 'use');
    expect(f.game.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    f.observe(); f.inspect(); expect(f.game.world.completedObjectiveIds).toEqual([q('O01')]);
    f.prepareScope(); f.open(); f.send({ kind: 'pin-hypothesis', text: expectations.playerInput.hypothesis });
    f.send({ kind: 'edit-personal-notes', text: expectations.playerInput.note }); f.close();
    expect(f.game.world.completedObjectiveIds).toEqual([q('O01'), q('O02')]);
    expect(f.game.notebook.factIds).toEqual(expect.arrayContaining([q('FACT-photon-clue'), q('FACT-titan-clue'), q('FACT-power'), q('FACT-link'), q('FACT-endpoint-a'), q('FACT-endpoint-b'), q('FACT-path')]));
    const before = structuredClone(f.game), dirty = f.state.runtime.persistence.dirtyGeneration;
    f.line('Replay dialogue'); f.line('Skip dialogue');
    expect(f.game).toEqual(before); expect(f.state.runtime.persistence.dirtyGeneration).toBe(dirty);
    for (let repetition = 0; repetition < 2; repetition++) {
      f.walk('R01'); f.converse('HOTSPOT-photon', repetition === 0);
      f.line('Replay dialogue'); f.line('Skip dialogue'); f.interact('HOTSPOT-satchel', 'use');
      f.walk('R02'); f.converse('HOTSPOT-titan', repetition !== 0);
    }
    expect(f.game.world.inventory).toEqual(before.world.inventory);
    expect(f.game.world.completedObjectiveIds).toEqual(before.world.completedObjectiveIds);
    expect(f.game.world.dialogueEffectIds).toEqual(before.world.dialogueEffectIds);
    expect(f.game.notebook.factIds).toEqual(before.notebook.factIds);
    expect(f.game.notebook.hypotheses).toEqual(before.notebook.hypotheses);
    expect(f.game.notebook.personalNotes).toBe(expectations.playerInput.note);
    expect(f.game.notebook.measurements.map(m => m.readings)).toEqual(before.notebook.measurements.map(m => m.readings));
    expect(f.state.runtime.auth.status).toBe('guest');
    expect(f.state.runtime.persistence).toMatchObject({ status: 'unsaved', autosaveEnabled: false, pendingRequest: null, knownSlot: undefined, lastAcknowledgement: null });
  });

  it('invalidates a captured inspection across real path changes and preserves every old result until a new current measurement', () => {
    const f = introduction(); f.converse('HOTSPOT-photon'); f.observe(); f.inspect();
    const original = structuredClone(f.game.notebook.measurements[0]!);
    expect(original.readings[0]).toMatchObject({ value: 105, unit: 'm' });
    expect(original.conclusionCode).toBe('length-exceeded'); expect(isMeasurementCurrent(original, f.game.world)).toBe(true);
    const captured = f.bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-path'), verb: 'use', itemId: null, choiceId: q('ACTION-inspect-path') });
    f.interact('HOTSPOT-path', 'use', 'ACTION-path-short'); const changed = f.state;
    expect(f.game.notebook.measurements).toEqual([{ ...original, stale: true }]);
    expect(f.bus.dispatch(captured).status).not.toBe('handled'); expect(f.state).toBe(changed);
    expect(f.game.notebook.measurements.some(m => isMeasurementCurrent(m, f.game.world))).toBe(false);
    f.inspect(); const repaired = structuredClone(f.game.notebook.measurements[1]!);
    expect(repaired.readings[0]).toMatchObject({ value: 95, unit: 'm' }); expect(repaired.conclusionCode).toBe('length-within-profile');
    expect(isMeasurementCurrent(repaired, f.game.world)).toBe(true);
    f.interact('HOTSPOT-path', 'use', 'ACTION-path-long'); f.inspect();
    expect(f.game.notebook.measurements).toHaveLength(3);
    expect(f.game.notebook.measurements.slice(0, 2)).toEqual([{ ...original, stale: true }, { ...repaired, stale: true }]);
    expect(f.game.notebook.measurements.map(m => isMeasurementCurrent(m, f.game.world))).toEqual([false, false, true]);
    expect(f.game.notebook.measurements[2]).toMatchObject({ conclusionCode: 'length-exceeded', roomId: q('R01') });
    expect(new Set(f.game.notebook.measurements.map(m => m.id)).size).toBe(3);
    expect(f.game.world.completedObjectiveIds).toEqual([q('O01')]);
    expect(f.game.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
  });

  it('cannot bypass a live clue conversation with inspection or travel; skipping unlocks the same real investigation', () => {
    const f = introduction(); f.observe(); f.interact('HOTSPOT-photon', 'talk'); const speaking = f.state;
    for (const input of [
      { kind: 'choose-hotspot-action', targetId: q('HOTSPOT-path'), verb: 'use', itemId: null, choiceId: q('ACTION-inspect-path') },
      { kind: 'interact', targetId: q('R02'), verb: 'walk', itemId: null },
      { kind: 'open-panel', panel: 'notebook' },
    ] satisfies SemanticAction[]) {
      expect(f.bus.dispatch(f.bus.capture(input)).status).not.toBe('handled'); expect(f.state).toBe(speaking);
    }
    expect(f.game.notebook.measurements).toEqual([]); expect(f.game.world.completedObjectiveIds).toEqual([]);
    f.line('Skip dialogue'); f.inspect(); f.prepareScope(); f.open();
    expect(f.game.world.completedObjectiveIds).toEqual([q('O01')]);
    const before = f.state;
    expect(() => f.bus.capture({ kind: 'pin-hypothesis', text: '  ' })).toThrow(); expect(f.state).toBe(before);
    f.send({ kind: 'pin-hypothesis', text: expectations.playerInput.hypothesis });
    expect(f.game.world.completedObjectiveIds).toEqual([q('O01'), q('O02')]);
    expect(f.notebook.project().view.evidence.every(e => !e.text.includes(expectations.playerInput.hypothesis))).toBe(true);
    expect(f.game.notebook.hypotheses[0]?.text).toBe(expectations.playerInput.hypothesis);
  });
});
