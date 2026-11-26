// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { introductionNotebookEffectBindings } from '../../src/state/notebook';
import { createNotebookController, validateNotebookPresentation } from '../../src/ui/notebook';
import presentation from '../../content/spec001/notebook-introduction.json' with { type: 'json' };
import { createVerbController } from '../../src/ui/verbs';
import { copySemanticAction } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { createReducerState } from '../../src/state/reducer';
import { introBindings, q, setup } from './inventory-fixture';

function fixture() {
  const f = setup({ bindings: [...introBindings, ...introductionNotebookEffectBindings], inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] });
  const notebook = createNotebookController(f);
  const verbs = createVerbController({ ...f, bindings: notebook.hotspotBindings, panels: notebook.panels });
  const send = (input: SemanticAction) => f.bus.dispatch(f.bus.capture(input));
  return { ...f, notebook, verbs, send };
}

describe('T027 trusted notebook controller and projections', () => {
  it('uses actual T025 room/hotspot/tool bindings and records real copper inspection', () => {
    const f = fixture();
    const captured = f.bus.capture({ kind: 'interact', targetId: q('HOTSPOT-path'), verb: 'use', itemId: null });
    const result = f.bus.dispatch(captured); expect(result.status).toBe('handled');
    const measured = f.store.getState(); expect(f.bus.dispatch(captured)).toBe(result); expect(f.store.getState()).toBe(measured);
    const view = f.notebook.project().view;
    expect(view.evidence).toHaveLength(1); expect(view.evidence[0]).toMatchObject({ heading: 'Physical inspection', freshness: 'current', sourceRoom: 'The Arrival Lift' });
    expect(view.evidence[0]?.text).toContain('105 m'); expect(view.evidence[0]?.text).toContain('length only');
    expect(f.send({ kind: 'interact', targetId: q('HOTSPOT-path'), verb: 'use', itemId: q<'item'>('unknown') }).status).not.toBe('handled');
    expect(f.store.getState().runtime.game!.notebook.measurements).toHaveLength(1);
  });
  it('validates authored presentation references, labels and ordered endpoint components separately from game rules', () => {
    const f = fixture(); expect(validateNotebookPresentation(f.registry, presentation).facts).toHaveLength(9);
    const endpoints = presentation.facts.find(fact => fact.id === 'spec001:FACT-endpoints')!;
    expect(endpoints.list?.requiresFactIds).toEqual(['spec001:FACT-endpoint-a', 'spec001:FACT-endpoint-b']);
    expect(endpoints.list?.items).toEqual(['Lift Sender A — known good', 'Workshop Receiver B — known good']);
    const path = presentation.facts.find(fact => fact.id === 'spec001:FACT-path')!;
    expect(path.list?.ordered).toBe(true); expect(path.list?.items).toEqual(['Lift Sender A', 'selected training conduit', 'workshop patch lead', 'Workshop Receiver B']);
    for (const mutate of [
      (copy: typeof presentation) => { copy.facts[0]!.sourceId = 'spec001:R02'; },
      (copy: typeof presentation) => { copy.facts[0]!.heading = ''; },
      (copy: typeof presentation) => { copy.facts[0]!.kind = 'Character guidance'; },
      (copy: typeof presentation) => { copy.rooms[0]!.id = 'spec001:R12'; },
      (copy: typeof presentation) => { copy.facts.find(f => f.list)!.list!.requiresFactIds = ['spec001:unknown']; },
      (copy: typeof presentation) => { copy.facts.find(f => f.list)!.list!.items = ['']; },
    ]) { const copy = structuredClone(presentation); mutate(copy); expect(() => validateNotebookPresentation(f.registry, copy)).toThrow(); }
  });
  it('opens through PanelPlanner and projects only recorded facts and actual measurements, never a static inspected flag', () => {
    const f = fixture(), before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, flags: { [q('FLAG-path-inspected')]: true } },
      notebook: { ...before.runtime.game!.notebook, factIds: [q<'fact'>('FACT-power'), q<'fact'>('FACT-inspection')] } } } });
    expect(f.send({ kind: 'open-panel', panel: 'notebook' }).status).toBe('handled');
    const view = f.notebook.project().view; expect(view.open).toBe(true);
    expect(view.evidence.map(e => e.heading)).toEqual(['Power indication']); expect(view.evidence[0]?.text).toContain('Power indication does not prove');
  });
  it('preserves projection captures through status redraw, rejects old scope after equal-version invalidation, and replaces snapshot on restore', () => {
    const f = fixture(); f.send({ kind: 'open-panel', panel: 'notebook' });
    const projection = f.notebook.project(); f.bus.invalidate();
    expect(f.notebook.project().capture).toBe(projection.capture);
    expect(f.bus.dispatch(projection.capture({ kind: 'edit-personal-notes', text: 'late' })).reason).toBe('invalidated');
    const old = f.store.getState(); f.replace(createReducerState({ ...old.runtime, game: { ...old.runtime.game!, notebook: { ...old.runtime.game!.notebook, personalNotes: 'Restored notes' } } }));
    f.notebook.invalidate(); expect(f.notebook.project().view.personalNotes).toBe('Restored notes');
    expect(f.bus.dispatch(projection.capture({ kind: 'edit-personal-notes', text: 'late again' })).reason).toBe('invalidated');
  });
  it('retains transient objective pins across safe room changes, resets them on restore, and map references never navigate', () => {
    const f = fixture(); f.send({ kind: 'open-panel', panel: 'notebook' });
    expect(f.send({ kind: 'pin-objective', objectiveId: q<'objective'>('O01') }).status).toBe('handled');
    const before = f.store.getState(), dirty = before.runtime.persistence.dirtyGeneration;
    expect(f.notebook.project().view.objectives[0]?.pinned).toBe(true);
    expect(f.send({ kind: 'highlight-map-room', roomId: q<'room'>('R02') }).status).toBe('rejected');
    expect(f.send({ kind: 'highlight-map-room', roomId: q<'room'>('R01') }).status).toBe('handled');
    expect(f.store.getState()).toBe(before); expect(f.store.getState().runtime.persistence.dirtyGeneration).toBe(dirty);
    expect(f.notebook.project().view.highlightedRoomId).toBe(q('R01'));
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, roomId: q<'room'>('R02') } } } });
    expect(f.notebook.project().view.objectives[0]?.pinned).toBe(true); f.notebook.invalidate(); expect(f.notebook.project().view.objectives[0]?.pinned).toBe(false);
  });
  it('requires an open safe notebook for notes/pins and leaves progress unchanged after bad input', () => {
    const f = fixture(); expect(f.send({ kind: 'edit-personal-notes', text: 'closed' }).status).toBe('rejected');
    f.send({ kind: 'open-panel', panel: 'notebook' }); const before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, activity: { kind: 'dialogue-transaction' } } });
    const unsafe = f.store.getState(); expect(f.send({ kind: 'edit-personal-notes', text: 'unsafe' }).status).toBe('unavailable'); expect(f.store.getState()).toBe(unsafe);
  });
  it('detaches renderer projection collections from the adventure and presentation metadata', () => {
    const f = fixture(), before = f.store.getState(), view = f.notebook.project().view;
    (view.hypotheses as unknown[]).push({ id: 'forged', text: 'not an input', status: 'supported' });
    (view.roomLabels as unknown as { label: string }[])[0]!.label = 'changed';
    expect(f.store.getState()).toBe(before); expect(f.store.getState().runtime.game!.notebook.hypotheses).toEqual([]);
    expect(f.notebook.project().view.roomLabels[0]?.label).toBe('The Arrival Lift');
  });
  it('disables retained planner ports when the notebook controller is disposed', () => {
    const f = fixture(), before = f.store.getState(); f.notebook.dispose();
    expect(f.send({ kind: 'interact', targetId: q('HOTSPOT-path'), verb: 'use', itemId: null }).status).not.toBe('handled');
    expect(f.send({ kind: 'open-panel', panel: 'notebook' }).status).not.toBe('handled'); expect(f.store.getState()).toBe(before);
  });
  it('cannot use a direct forged InteractionPlanner call to bypass room/hotspot/choice/tool identity', () => {
    const f = fixture(), binding = f.notebook.hotspotBindings[0]!;
    if (binding.mode !== 'port') throw new Error('Inspection must be a trusted port');
    const room = f.registry.record(q('R01')) as import('../../src/content/schema-types.generated').room;
    const source = f.registry.record(q('DIALOGUE-arrival-actions')) as import('../../src/content/schema-types.generated').dialogue;
    const action = f.bus.capture({ kind: 'interact', targetId: q('HOTSPOT-path'), verb: 'use', itemId: null });
    const plan = binding.plan({ room, hotspot: room.hotspots.find(h => h.id === q('HOTSPOT-power'))!, choice: source.nodes[0]!.choices.find(c => c.id === q('ACTION-inspect-path'))!, verb: 'use', itemId: null }, action, f.store.getState());
    expect(plan.status).toBe('rejected'); expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([]);
  });
});

describe('T027 bounded intent shapes', () => {
  it('accepts Unicode notes/hypotheses and rejects arbitrary effects, invalid text and IDs', () => {
    for (const action of [{ kind: 'edit-personal-notes', text: '🧵'.repeat(4096) }, { kind: 'pin-hypothesis', text: '🧵'.repeat(512) },
      { kind: 'pin-objective', objectiveId: q<'objective'>('O01') }, { kind: 'highlight-map-room', roomId: q<'room'>('R01') }] satisfies SemanticAction[]) {
      expect(copySemanticAction(action)).toEqual(action); expect(() => copySemanticAction({ ...action, effects: [] } as unknown as SemanticAction)).toThrow();
    }
    for (const action of [{ kind: 'edit-personal-notes', text: '🧵'.repeat(4097) }, { kind: 'edit-personal-notes', text: '\uD800' },
      { kind: 'pin-hypothesis', text: '  ' }, { kind: 'pin-hypothesis', text: 'x'.repeat(513) }, { kind: 'pin-objective', objectiveId: 'bad' }]) {
      expect(() => copySemanticAction(action as SemanticAction)).toThrow();
    }
  });
});
