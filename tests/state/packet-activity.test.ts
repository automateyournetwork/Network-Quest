// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { introductionBindings } from '../../src/app/introduction';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import type { ContentRegistry } from '../../src/content/registry';
import type { ActionId, AttemptId, ConfigurationRevision, MeasurementId, QualifiedId } from '../../src/domain/types';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState, StateEffect } from '../../src/state/reducer';
import { createPacketActivityController, validatePacketIntroduction } from '../../src/state/packet-activity';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { playable } from '../../src/ui/controller-store';
import { createTitleController } from '../../src/ui/title';
import { createVerbController } from '../../src/ui/verbs';
import definition from '../../content/spec001/packet-introduction.json' with { type: 'json' };

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
function fixture(options: { definition?: unknown; registry?: (original: ContentRegistry) => ContentRegistry; cas?: boolean } = {}) {
  const source = loadIntroductionContent().registry, registry = options.registry?.(source) ?? source, bindings = introductionBindings(source);
  let state = createReducerState(startIntroduction(createIntroductionRuntime(), source));
  const store = { getState: () => state, reduce: createReducer({ registry, bindings: bindings.effects }),
    compareAndSet: (before: ReducerState, next: ReducerState) => { if (state !== before || options.cas === false) return false; state = next; return true; } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const packet = createPacketActivityController({ registry, bus, store, ...(Object.hasOwn(options, 'definition') ? { definition: options.definition } : {}) });
  const verbs = createVerbController({ registry: source, store, bus, bindings: [...bindings.hotspots.filter(b => b.actionId !== q('ACTION-packet-context')), ...packet.hotspotBindings] });
  const open = () => bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-capsule'), choiceId: q('ACTION-packet-context'), verb: 'look', itemId: null }));
  const choose = (kind: SemanticAction['kind']) => { const p = packet.project(), control = p.view.controls.find(c => c.action.kind === kind); if (!control) throw new Error(`Missing ${kind}`); return bus.dispatch(p.capture(control.action)); };
  const compare = () => { for (let phase = 0; phase < 4; phase++) expect(choose('step-packet').status).toBe('handled'); return packet.project().view.result?.observations[0]; };
  const send = (input: ReducerInput) => { const before = state, game = before.runtime.game!;
    const result = store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
    if (result.status !== 'rejected') store.compareAndSet(before, result.state); return result; };
  const action = (id: string) => { const source = registry.record(q('DIALOGUE-arrival-actions')); if (source?.kind !== 'dialogue') throw new Error('Missing actions');
    const choice = source.nodes[0]!.choices.find(c => c.id === q(id))!;
    return send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-action', observations: [], acceptedEffects: choice.effects as StateEffect[] } }); };
  return { registry, store, bus, packet, verbs, open, choose, compare, send, action, replace: (next: ReducerState) => { state = next; } };
}

describe('T034 actual R01 packet activity', () => {
  it('opens from the real capsule, records its authored context, and holds a reducer unsafe lock before controls exist', () => {
    const f = fixture(), before = f.store.getState();
    expect(f.open().status).toBe('handled'); const active = f.store.getState();
    expect(active.runtime.activity?.kind).toBe('pending-effect'); expect(active.control.pending).not.toBeNull(); expect(playable(active)).toBe(false);
    expect(active.control.pending?.request.evaluation.acceptedEffects).toEqual([]);
    expect(active.runtime.game!.notebook.factIds).toEqual([q('FACT-packet-context')]);
    expect(active.runtime.game!.world).toEqual(before.runtime.game!.world);
    expect(f.packet.project().view).toMatchObject({ open: true, phase: 'payload', paused: true });
    const title = createTitleController({ getState: f.store.getState, start: () => false, changed: () => {} }); title.act('save');
    expect(title.project()).toMatchObject({ panel: 'none', message: 'Finish the current activity before saving.' });
    expect(active.runtime.persistence.pendingRequest).toBeNull();
  });
  it('evaluates the actual default 105 m path and uses only the separately declared toy trace', () => {
    const f = fixture(); f.open(); const observed = f.compare();
    expect(observed).toMatchObject({ kind: 'packet-journey', physicalStatus: 'incorrect', physicalReasonCode: 'length-exceeded',
      physicalObservation: { total: { value: 105, unit: 'm' }, excess: { value: 5, unit: 'm' }, version: { attemptId: f.store.getState().runtime.game!.world.attemptId, configurationRevision: f.store.getState().runtime.game!.world.configurationRevision } },
      recoveredBits: '0100111001010000', comparison: { recoveredHex: ['4E', '50'], differingBitPositions: [15] }, impairmentApplied: true,
      transmissionSucceeded: false, wholeRouteProven: false, higherLayerServiceProven: false, progressAward: 0, attemptPenalty: 0 });
  });
  it('replay and every control leave the opened adventure, inventory, measurements, progress and persistence unchanged', () => {
    const f = fixture(); f.open(); const opened = f.store.getState();
    f.choose('resume-packet'); f.choose('pause-packet'); f.compare(); f.choose('replay-packet'); f.compare();
    expect(f.store.getState()).toBe(opened); expect(f.packet.project().view.result?.acceptedEffects).toEqual([]);
    f.choose('close-packet'); const closed = f.store.getState();
    expect(closed.runtime.game).toBe(opened.runtime.game); expect(closed.runtime.persistence).toBe(opened.runtime.persistence);
    expect(closed.runtime.activity?.kind).toBe('stable-exploration'); expect(closed.control.pending).toBeNull();
    expect(closed.runtime.game!.world.completedObjectiveIds).toEqual([]); expect(closed.runtime.game!.notebook.measurements).toEqual([]);
  });
  it('reopens after the real direct-path selection with a new 95 m evaluation; the old displayed evidence keeps its original version', () => {
    const f = fixture(); f.open(); const failed = f.compare(); const before = structuredClone(failed);
    f.choose('close-packet'); expect(f.action('ACTION-path-short').status).toBe('applied'); f.open(); const passed = f.compare();
    expect(passed).toMatchObject({ physicalStatus: 'correct', physicalObservation: { total: { value: 95, unit: 'm' }, headroom: { value: 5, unit: 'm' } },
      recoveredBits: '0100111001010001', comparison: { recoveredHex: ['4E', '51'], differingBitPositions: [] }, transmissionSucceeded: true, impairmentApplied: false });
    expect(failed).toEqual(before);
    if (failed?.kind !== 'packet-journey' || passed?.kind !== 'packet-journey') throw new Error('Missing physical observations');
    expect(passed.version.configurationRevision).toBeGreaterThan(failed.version.configurationRevision);
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toEqual([]);
  });
  it.each(['ACTION-path-long', 'ACTION-path-short'])('agrees with the actual notebook evaluator for %s without relabeling or adding its readings', selected => {
    const f = fixture(); expect(f.action('ACTION-take-kit').status).toBe('applied');
    if (selected === 'ACTION-path-long') expect(f.action('ACTION-path-short').status).toBe('applied');
    expect(f.action(selected).status).toBe('applied');
    expect(f.send({ kind: 'notebook', operation: { kind: 'inspect-path', id: crypto.randomUUID() as MeasurementId } }).status).toBe('applied');
    const game = f.store.getState().runtime.game!, measurement = game.notebook.measurements[0]!; f.open(); const result = f.compare();
    expect(result).toMatchObject({ physicalReasonCode: measurement.conclusionCode, physicalObservation: { total: { value: measurement.readings[0]!.value }, version: { attemptId: measurement.attemptId, configurationRevision: measurement.configurationRevision } } });
    expect(f.store.getState().runtime.game!.notebook.measurements).toEqual(game.notebook.measurements);
  });
  it('shows failed length with no recovered trace when the authored optional substitution is null', () => {
    const f = fixture({ definition: { ...definition, impairment: null } }); f.open();
    expect(f.compare()).toMatchObject({ physicalStatus: 'incorrect', recoveredBits: null, comparison: null, transmissionSucceeded: false, impairmentApplied: false });
  });
  it('refuses concurrent scene actions and notebook writes while its lock is held', () => {
    const f = fixture(); f.open(); const held = f.store.getState();
    expect(f.open().status).toBe('unavailable');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-path'), choiceId: q('ACTION-path-short'), verb: 'use', itemId: null })).status).toBe('unavailable');
    expect(f.send({ kind: 'notebook', operation: { kind: 'notes', text: 'late' } }).reason).toBe('transition-pending'); expect(f.store.getState()).toBe(held);
  });
  it('releases only its own lock on close, invalidate and dispose and never advances dirty state for returning', () => {
    for (const close of ['close', 'invalidate', 'dispose'] as const) {
      const f = fixture(); f.open(); const opened = f.store.getState();
      if (close === 'close') f.choose('close-packet'); else f.packet[close]();
      expect(f.store.getState().control.pending).toBeNull(); expect(playable(f.store.getState())).toBe(true);
      expect(f.store.getState().runtime.game).toBe(opened.runtime.game); expect(f.store.getState().runtime.persistence).toBe(opened.runtime.persistence);
    }
  });
  it.each(['same-save', 'new-adventure', 'logout', 'new-account', 'revision', 'attempt', 'other-lock'] as const)('invalidates %s replacement; old callbacks cannot release replacement state', change => {
    const f = fixture(); f.open(); f.compare(); const original = f.store.getState(), p = f.packet.project();
    const close = p.capture(p.view.controls.find(c => c.action.kind === 'close-packet')!.action);
    let next = createReducerState(structuredClone(original.runtime));
    if (change === 'same-save') next = createReducerState({ ...next.runtime, activity: { kind: 'stable-exploration' } });
    if (change === 'new-adventure') next = createReducerState(startIntroduction(original.runtime, f.registry));
    if (change === 'logout') next = createReducerState(createIntroductionRuntime());
    if (change === 'new-account') next = { ...original, runtime: { ...original.runtime, auth: { ...original.runtime.auth, clientGeneration: 1 as typeof original.runtime.auth.clientGeneration } } };
    if (change === 'revision' || change === 'attempt') next = { ...original, runtime: { ...original.runtime, game: { ...original.runtime.game!, world: { ...original.runtime.game!.world,
      ...(change === 'revision' ? { configurationRevision: (original.runtime.game!.world.configurationRevision + 1) as ConfigurationRevision } : { attemptId: crypto.randomUUID() as AttemptId }) } } } };
    if (change === 'other-lock') next = { ...original, control: { ...original.control, pending: { ...original.control.pending!, actionId: crypto.randomUUID() as ActionId } } };
    f.replace(next); expect(f.packet.project().view.open).toBe(false); expect(f.bus.dispatch(close).status).toBe('rejected'); f.packet.invalidate(); f.packet.dispose();
    expect(f.store.getState()).toBe(next);
  });
  it('a captured return from the prior activity cannot close a later activity in the same restored adventure', () => {
    const f = fixture(); f.open(); const p = f.packet.project(), late = p.capture(p.view.controls.find(c => c.action.kind === 'close-packet')!.action);
    const saved = structuredClone(f.store.getState().runtime); f.replace(createReducerState({ ...saved, activity: { kind: 'stable-exploration' } }));
    f.packet.invalidate(); f.open(); const newer = f.store.getState();
    expect(f.bus.dispatch(late).reason).toBe('packet-stale'); expect(f.store.getState()).toBe(newer); expect(f.packet.project().view.open).toBe(true);
  });
  it('does not commit context or a lock if the store changed before commit', () => {
    const f = fixture({ cas: false }), before = f.store.getState(); expect(f.open().status).toBe('rejected'); expect(f.store.getState()).toBe(before); expect(f.packet.project().view.open).toBe(false);
  });
  it.each(['missing', 'invalid'] as const)('fails truthfully and atomically on %s actual physical profile', problem => {
    const f = fixture({ registry: original => ({ ...original, record: id => id !== q('PROFILE-COPPER-100') ? original.record(id) : problem === 'missing' ? undefined
      : { ...original.record(id)!, parameters: { maximumChannelLength: { value: 100, unit: 'W' }, inclusiveMaximum: true } } as ReturnType<ContentRegistry['record']> }) });
    const before = f.store.getState(); expect(f.open()).toMatchObject({ status: 'unavailable', reason: 'packet-content-error' });
    expect(f.store.getState()).toBe(before); expect(f.packet.project().view.open).toBe(false);
  });
  it('rejects unsupported actual path modes rather than defaulting them to a passing path', () => {
    const f = fixture(), before = f.store.getState(); f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, flags: { [q('FLAG-path-mode')]: 'invented' } } } } });
    const invalid = f.store.getState(); expect(f.open()).toMatchObject({ status: 'unavailable', reason: 'packet-content-error' }); expect(f.store.getState()).toBe(invalid);
  });
});

describe('T034 separately authored bench boundary', () => {
  it('accepts and detaches the bounded original definition including absent optional impairment', () => {
    const data = structuredClone(definition), validated = validatePacketIntroduction(data);
    expect(validated).toEqual(data); expect(validated).not.toBe(data); expect(Object.isFrozen(validated.bench)).toBe(true);
    expect(validatePacketIntroduction({ ...data, impairment: null }).impairment).toBeNull();
  });
  it.each([null, {}, { ...definition, effects: [] }, { ...definition, bench: { ...definition.bench, requiredConductorsContinuous: false } },
    { ...definition, impairment: { ...definition.impairment, position: 0 } }, { ...definition, symbolProfile: { ...definition.symbolProfile, parameters: { bitsPerSymbol: 8, levels: [] } } }])('rejects unsupported/malformed authored activity (%#)', input => {
    expect(() => validatePacketIntroduction(input)).toThrow();
  });
});
