// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createDiagnosticsController } from '../../src/ui/diagnostics';
import { contextFromRuntime, copySemanticAction, createActionBus } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { fixture as stateFixture, q, registry, scenario, uuid } from '../state/objectives-fixture';

function fixture(objective = 'O06') {
  const f = stateFixture(objective), bus = createActionBus({ getContext: () => contextFromRuntime(f.store.getState().runtime) });
  const diagnostics = createDiagnosticsController({ registry, store: f.store, bus, resolveScenario: f.resolver });
  const send = (input: SemanticAction) => bus.dispatch(bus.capture(input));
  const measure = () => send({ kind: 'measure-objective', objectiveId: q(objective), alternativeId: scenario(objective).alternativeId });
  return { ...f, bus, diagnostics, send, measure };
}
describe('T074 captured diagnostic controller', () => {
  it('records then submits the selected existing measurement through one canonical completion', () => {
    const f = fixture(); expect(f.diagnostics.project(q('O06')).view.measurements).toEqual([]);
    expect(f.measure()).toMatchObject({ status: 'handled', message: expect.stringContaining('Measurement recorded') });
    const projection = f.diagnostics.project(q('O06')), measured = projection.view.measurements[0]!;
    expect(measured.text).toContain('Receive power: -11 dBm'); expect(measured.text).toContain('Sensitivity reserve: 3 dB');
    const action = projection.capture({ kind: 'submit-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId, measurementId: measured.id });
    expect(f.bus.dispatch(action).status).toBe('handled');
    const accepted = f.store.getState(); expect(accepted.runtime.game!.world.completedObjectiveIds).toContain(q('O06'));
    f.bus.dispatch(action); expect(f.store.getState()).toBe(accepted); expect(accepted.runtime.game!.notebook.measurements).toHaveLength(1);
  });
  it('submitting a nonexistent reading never evaluates a fresh measurement into the notebook', () => {
    const f = fixture(); const before = f.store.getState().runtime.game;
    expect(f.send({ kind: 'submit-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId, measurementId: uuid(44) })).toMatchObject({ message: expect.stringContaining('Take a measurement') });
    expect(f.store.getState().runtime.game).toBe(before);
  });
  it('shows stale measurements without removing notes, clues or assistance', () => {
    const f = fixture(); f.measure(); f.send({ kind: 'request-objective-hint', objectiveId: q('O06') });
    const prior = f.store.getState(), game = prior.runtime.game!;
    f.replace({ ...prior, runtime: { ...prior.runtime, game: { ...game, world: { ...game.world, configurationRevision: (game.world.configurationRevision + 1) as typeof game.world.configurationRevision } } } });
    const view = f.diagnostics.project(q('O06')).view;
    expect(view.measurements[0]).toMatchObject({ freshness: 'stale', eligible: false }); expect(view.hints).toHaveLength(1);
    expect(f.store.getState().runtime.game!.notebook).toBe(game.notebook);
  });
  it('keeps a captured measurement ID when another reading is taken at the same world version', () => {
    const f = fixture(); f.measure(); const projection = f.diagnostics.project(q('O06')), first = projection.view.measurements[0]!;
    const captured = projection.capture({ kind: 'submit-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId, measurementId: first.id });
    f.measure(); expect(f.store.getState().runtime.game!.notebook.measurements).toHaveLength(2);
    expect(captured.input).toHaveProperty('measurementId', first.id); expect(f.bus.dispatch(captured).status).toBe('handled');
  });
  it('canceled and invalidated captures cannot complete or create measurements', () => {
    const f = fixture(); const projection = f.diagnostics.project(q('O06'));
    const canceled = projection.capture({ kind: 'measure-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId });
    expect(f.bus.cancel(canceled)).toBe(true); expect(f.bus.dispatch(canceled).reason).toBe('canceled');
    f.bus.invalidate(); expect(f.bus.dispatch(projection.capture({ kind: 'request-objective-hint', objectiveId: q('O06') })).reason).toBe('invalidated');
    expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([]); expect(f.store.getState().runtime.game!.assistance).toEqual([]);
  });
  it('a replaced store during final commit prevents all observation and objective effects', () => {
    const f = stateFixture('O06'), bus = createActionBus({ getContext: () => contextFromRuntime(f.store.getState().runtime) });
    const store = { ...f.store, compareAndSet: () => false };
    createDiagnosticsController({ registry, store, bus, resolveScenario: f.resolver });
    const before = f.store.getState();
    expect(bus.dispatch(bus.capture({ kind: 'measure-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId }))).toMatchObject({ status: 'rejected', reason: 'state-replaced' });
    expect(f.store.getState()).toBe(before);
  });
  it('a stale projection cannot silently recapture after a real configuration change', () => {
    const f = fixture(), projection = f.diagnostics.project(q('O06')), before = f.store.getState(), game = before.runtime.game!;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, world: { ...game.world, configurationRevision: (game.world.configurationRevision + 1) as typeof game.world.configurationRevision } } } });
    expect(f.bus.dispatch(projection.capture({ kind: 'measure-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId })).reason).toBe('stale-context');
    expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([]);
  });
  it('hints remain available after travel and advance method, worked step, solution without completion', () => {
    const f = fixture(); f.send({ kind: 'request-objective-hint', objectiveId: q('O06') });
    const before = f.store.getState(), game = before.runtime.game!;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, world: { ...game.world, roomId: q('R02') } } } });
    f.send({ kind: 'request-objective-hint', objectiveId: q('O06') }); f.send({ kind: 'request-objective-hint', objectiveId: q('O06') });
    const view = f.diagnostics.project(q('O06')).view;
    expect(view.hints).toHaveLength(3); expect(view.completed).toBe(false); expect(f.store.getState().runtime.game!.assistance.map(h => h.level)).toEqual([1, 2, 3]);
    expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([]);
  });
  it('does not claim an inspection was recorded when prerequisites were missing', () => {
    const f = fixture(), before = f.store.getState(), game = before.runtime.game!;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, world: { ...game.world, completedObjectiveIds: [] } } } });
    expect(f.measure().message).not.toContain('Measurement recorded'); expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([]);
  });
  it('rejects renderer-provided verdict/effect fields and malformed measurement identities', () => {
    for (const extra of [{ acceptedEffects: [] }, { status: 'correct' }, { measurement: {} }]) expect(() => copySemanticAction({ kind: 'measure-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId, ...extra } as SemanticAction)).toThrow();
    expect(() => copySemanticAction({ kind: 'submit-objective', objectiveId: q('O06'), alternativeId: scenario('O06').alternativeId, measurementId: 'pretend' as ReturnType<typeof uuid> })).toThrow();
  });
  it('removes its handlers on disposal and preserves scope on status-only redraws', () => {
    const f = fixture(), initial = f.diagnostics.project(q('O06')), before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence, status: 'saving' } } });
    expect(f.diagnostics.project(q('O06')).capture).toBe(initial.capture);
    f.diagnostics.dispose(); expect(f.measure().reason).toBe('no-handler');
  });
});

it('uses the actual radio evaluator reason to explain a below-profile SNR', () => {
  const f = fixture('O08'), current = scenario('O08');
  if (current.kind !== 'radio-proof') throw new Error('Expected radio proof');
  f.change({ ...current, path: { ...current.path, noise: { value: -78, unit: 'dBm' } } });
  expect(f.measure()).toMatchObject({ status: 'handled', message: 'Measurement recorded. The measured signal-to-noise ratio is below the supplied threshold.' });
  expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O08'));
});
