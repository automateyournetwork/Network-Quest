// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { introductionDialogueEffectBindings } from '../../src/state/dialogue';
import { createDialogueController, introductionDialogueBindings } from '../../src/ui/dialogue';
import { createInventoryController } from '../../src/ui/inventory';
import { createVerbController } from '../../src/ui/verbs';
import { copySemanticAction } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { q, setup, choice, introBindings } from './inventory-fixture';

function fixture(options: Parameters<typeof setup>[0] = {}) {
  const f = setup({ bindings: [...introductionDialogueEffectBindings], ...options });
  const dialogue = createDialogueController({ ...f, bindings: introductionDialogueBindings, effectBindings: introductionDialogueEffectBindings });
  const verbs = createVerbController({ ...f, bindings: dialogue.hotspotBindings });
  createInventoryController(f);
  const talk = (name = 'photon') => f.bus.dispatch(f.bus.capture({ kind: 'interact', verb: 'talk', targetId: q(`HOTSPOT-${name}`), itemId: null }));
  const choose = (label: string) => { const projection = dialogue.project(); const control = projection.view.controls.find(c => c.label === label)!; return f.bus.dispatch(projection.capture(control.action)); };
  return { ...f, dialogue, verbs, talk, choose };
}

describe('T026 trusted Talk planner and transient sessions', () => {
  it('joins actual T025 Talk, immediately retains clue/kit, skips and replays without rewards', () => {
    const f = fixture(); expect(f.talk().status).toBe('handled');
    expect(f.dialogue.project().view.text).toContain('Small lamp, large opinions');
    const first = f.store.getState().runtime.game!;
    expect(first.notebook.factIds).toContain(q('FACT-photon-clue')); expect(first.world.inventory[0]?.quantity).toBe(1);
    expect(f.choose('Skip dialogue').status).toBe('handled');
    expect(f.dialogue.project().view.completed).toBe(true);
    for (let n = 0; n < 3; n++) { expect(f.choose('Replay dialogue').status).toBe('handled'); expect(f.choose('Skip dialogue').status).toBe('handled'); }
    expect(f.store.getState().runtime.game).toBe(first); expect(first.world.completedObjectiveIds).toEqual([]);
  });
  it('shares the canonical satchel receipt with Photon and preserves existing objective progress on replay', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings, ...introBindings] });
    const dialogue = createDialogueController({ ...f, bindings: introductionDialogueBindings, effectBindings: introductionDialogueEffectBindings });
    createVerbController({ ...f, bindings: [...dialogue.hotspotBindings, { roomId: q('R01'), hotspotId: q('HOTSPOT-satchel'), actionId: q('ACTION-take-kit'),
      sourceId: q('DIALOGUE-arrival-actions'), verb: 'use', itemId: null, mode: 'effects' }] });
    expect(f.bus.dispatch(f.bus.capture({ kind: 'interact', targetId: q('HOTSPOT-satchel'), verb: 'use', itemId: null })).status).toBe('handled');
    expect(f.store.getState().runtime.game!.world.inventory[0]?.quantity).toBe(1);
    // A prepared previous objective is a retention baseline, not proof of O01.
    const prepared = f.store.getState(); f.replace({ ...prepared, runtime: { ...prepared.runtime, game: { ...prepared.runtime.game!, world: { ...prepared.runtime.game!.world, completedObjectiveIds: [q('O01')] } } } });
    f.bus.dispatch(f.bus.capture({ kind: 'interact', targetId: q('HOTSPOT-photon'), verb: 'talk', itemId: null }));
    for (const label of ['Skip dialogue', 'Replay dialogue', 'Next dialogue line', 'Finish dialogue']) {
      const p = dialogue.project(); expect(f.bus.dispatch(p.capture(p.view.controls.find(c => c.label === label)!.action)).status).toBe('handled');
    }
    expect(f.store.getState().runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toEqual([q('O01')]);
    expect(f.store.getState().runtime.game!.notebook.factIds).toEqual([q('FACT-photon-clue')]);
  });
  it('holds a reducer dialogue transaction while open and restores the prior safe activity on finish/close', () => {
    const f = fixture(); const before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, activity: { kind: 'safe-preparation' } } });
    f.talk(); expect(f.store.getState().runtime.activity?.kind).toBe('dialogue-transaction');
    expect(f.store.getState().control.pending?.request.evaluation.acceptedEffects).toEqual([]);
    expect(f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'look' })).reason).toBe('unavailable-state');
    expect(f.talk().reason).toBe('unavailable-state');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'open-panel', panel: 'notebook' })).reason).toBe('unavailable-state');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: q('ITEM-inspection-kit') })).reason).toBe('unavailable-state');
    f.choose('Next dialogue line'); expect(f.store.getState().runtime.activity?.kind).toBe('dialogue-transaction');
    f.choose('Finish dialogue'); expect(f.store.getState().runtime.activity?.kind).toBe('safe-preparation'); expect(f.store.getState().control.pending).toBeNull();
    f.choose('Replay dialogue'); f.choose('Close dialogue'); expect(f.store.getState().runtime.activity?.kind).toBe('safe-preparation');
    expect(f.store.getState().control.pending).toBeNull();
  });
  it('retains same-action receipts and rejects old lines or sessions after close and reopen', () => {
    const f = fixture(); f.talk(); const p = f.dialogue.project();
    const next = p.capture(p.view.controls.find(c => c.label === 'Next dialogue line')!.action);
    const skip = p.capture(p.view.controls.find(c => c.label === 'Skip dialogue')!.action);
    const result = f.bus.dispatch(next); const after = f.store.getState();
    expect(f.bus.dispatch(next)).toBe(result); expect(f.store.getState()).toBe(after);
    expect(f.bus.dispatch(skip).reason).toBe('dialogue-stale');
    f.choose('Close dialogue'); f.talk();
    expect(f.bus.dispatch(p.capture(p.view.controls.find(c => c.label === 'Replay dialogue')!.action)).reason).toBe('dialogue-stale');
  });
  it('rejects replaced equal-version game and preserves the original scope across late redraws', () => {
    const f = fixture(); f.talk(); const p = f.dialogue.project();
    f.bus.invalidate();
    expect(f.bus.dispatch(p.capture(p.view.controls[0]!.action)).reason).toBe('invalidated');
    expect(f.dialogue.project().capture).toBe(p.capture);
    f.replace(structuredClone(f.store.getState()));
    expect(f.dialogue.project().view.open).toBe(false);
    const action = p.view.controls[0]!.action;
    expect(f.bus.dispatch(f.bus.capture(action)).reason).toBe('dialogue-stale');
  });
  it('uses exact local Talk bindings and preserves state when a transaction cannot commit', () => {
    const f = fixture(); const before = f.store.getState();
    expect(f.talk('titan').status).toBe('rejected');
    expect(f.store.getState()).toBe(before); expect(f.dialogue.project().view.open).toBe(false);
    const blocked = { ...f.store, compareAndSet: vi.fn(() => false) }; f.dialogue.dispose(); f.verbs.dispose();
    const dialogue = createDialogueController({ ...f, store: blocked, bindings: introductionDialogueBindings, effectBindings: introductionDialogueEffectBindings });
    createVerbController({ ...f, store: blocked, bindings: dialogue.hotspotBindings });
    expect(f.talk().reason).toBe('state-replaced'); expect(dialogue.project().view.open).toBe(false); expect(f.store.getState()).toBe(before);
  });
  it('keeps the existing transaction/world when Skip requires an explicit branch choice', () => {
    const f = fixture({ mutate: docs => {
      const intro = docs['content/spec001/dialogue/introduction.json'] as {records: import('../../src/content/schema-types.generated').dialogue[]};
      intro.records[0]!.nodes[0]!.choices.push({ id: q('ACTION-other-response'), text: 'Another response', condition: { kind: 'always' }, nextNodeId: null, effects: [] });
    } });
    f.talk(); const before = f.store.getState(), projection = f.dialogue.project();
    expect(f.choose('Skip dialogue').reason).toBe('dialogue-choice-required');
    expect(f.store.getState()).toBe(before); expect(f.dialogue.project().capture).toBe(projection.capture);
    expect(f.store.getState().control.pending).toBe(before.control.pending);
  });
  it('keeps completed replay available after a legitimate room-local reducer action, never after replacement', () => {
    const f = fixture({ bindings: [...introductionDialogueEffectBindings, ...introBindings] }); f.talk(); f.choose('Skip dialogue');
    const before = f.store.getState();
    f.bus.register('inspect-evidence', action => ({ status: 'ready', commit: () => {
      const current = f.store.getState(), game = current.runtime.game!;
      const out = f.store.reduce(current, { actionId: action.actionId, adventureId: game.adventureId, expectedVersion: game.world,
        input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'test-observation', observations: [], acceptedEffects: choice('ACTION-observe-power').effects as import('../../src/state/reducer').StateEffect[] } } });
      if (out.status === 'rejected') return { status: 'rejected' };
      f.store.compareAndSet(current, out.state); return { status: 'handled' };
    } }));
    f.bus.dispatch(f.bus.capture({ kind: 'inspect-evidence', evidenceId: q('FACT-photon-clue') }));
    expect(f.dialogue.project().view.controls.some(c => c.label === 'Replay dialogue')).toBe(true);
    expect(f.store.getState().runtime.game).not.toBe(before.runtime.game);
    expect(f.store.getState().runtime.game!.notebook.factIds).toContain(q('FACT-power'));
    expect(f.choose('Replay dialogue').status).toBe('handled'); f.choose('Skip dialogue');
    f.replace(structuredClone(f.store.getState())); f.bus.invalidate();
    expect(f.dialogue.project().view.completed).toBe(false);
  });
  it('lifecycle cleanup cancels only its current lock, retaining clues and never installing an old world', () => {
    const f = fixture(); f.talk(); const game = f.store.getState().runtime.game;
    f.dialogue.invalidate(); expect(f.store.getState().control.pending).toBeNull();
    expect(f.store.getState().runtime.activity?.kind).toBe('stable-exploration'); expect(f.store.getState().runtime.game).toBe(game);
    f.talk(); const before = f.store.getState();
    const replaced = { ...before, runtime: { ...before.runtime, game: structuredClone(before.runtime.game), activity: { kind: 'safe-continue' as const } }, control: { ...before.control, pending: null } };
    f.replace(replaced); f.dialogue.dispose(); expect(f.store.getState()).toBe(replaced);
  });
  it('requires once policies and rejects invalid/missing explicit Talk targets at construction', () => {
    const f = setup({ bindings: [...introductionDialogueEffectBindings] });
    expect(() => createDialogueController({ ...f, bindings: introductionDialogueBindings, effectBindings: [] })).toThrow();
    expect(() => createDialogueController({ ...f, bindings: [{ ...introductionDialogueBindings[0]!, dialogueId: q('DIALOGUE-arrival-actions') }], effectBindings: introductionDialogueEffectBindings })).toThrow();
  });
  it('does not double-advance under reentrant/deferred delivery and cleans handlers on disposal', () => {
    const f = fixture(); f.talk(); const p = f.dialogue.project();
    const next = p.capture(p.view.controls[0]!.action); let reentrant: unknown;
    const off = f.bus.subscribe(() => { reentrant = f.bus.dispatch(next); });
    expect(f.bus.dispatch(next).status).toBe('handled'); expect(reentrant).toMatchObject({ reason: 'busy' }); off();
    expect(f.bus.dispatch(next).status).toBe('handled'); expect(f.dialogue.project().view.text).toContain('power lamp is lit');
    f.dialogue.dispose(); expect(f.bus.dispatch(f.bus.capture(next.input)).reason).toBe('no-handler');
  });
});

describe('T026 intent shapes contain only exact, bounded identifiers', () => {
  const sessionId = '00000000-0000-4000-8000-000000000001';
  it('copies each supported intent and rejects injected effects, bad IDs and session identifiers', () => {
    const actions: SemanticAction[] = [
      { kind: 'choose-dialogue', dialogueId: q('DIALOGUE-photon-intro'), nodeId: q('DIALOGUE-photon-welcome'), choiceId: q('ACTION-photon-next'), sessionId },
      { kind: 'skip-dialogue', dialogueId: q('DIALOGUE-photon-intro'), nodeId: q('DIALOGUE-photon-welcome'), sessionId },
      { kind: 'replay-dialogue', dialogueId: q('DIALOGUE-photon-intro'), sessionId },
      { kind: 'close-dialogue', dialogueId: q('DIALOGUE-photon-intro'), sessionId },
    ];
    for (const action of actions) {
      expect(copySemanticAction(action)).toEqual(action);
      for (const bad of [{ ...action, effects: [] }, { ...action, sessionId: 'x'.repeat(129) }, { ...action, dialogueId: 'arbitrary' }]) expect(() => copySemanticAction(bad as SemanticAction)).toThrow();
    }
  });
});
