// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import endings from '../../content/spec001/endings.json';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { validateEndingsContent } from '../../src/content/endings';
import type { ContentRegistry } from '../../src/content/registry';
import type { ActionId, OutcomeEventId } from '../../src/domain/types';
import { captureEncounterContext } from '../../src/state/encounter';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { createPacketActivityController } from '../../src/state/packet-activity';
import { createReducerState } from '../../src/state/reducer';
import { createRiftHazardController } from '../../src/state/rift-hazard';
import type { ReducerState } from '../../src/state/reducer';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { playable, uiPlan } from '../../src/ui/controller-store';
import { allowRiftEncounterAction } from '../../src/ui/encounter';
import { createRecoveryController } from '../../src/ui/recovery';
import { createVerbController } from '../../src/ui/verbs';
import { fixture, q, registry, uuid } from './outcome-fixture';

function ready(route: 'copper' | 'fiber' | 'radio' = 'copper', outcome: 'permanent' | 'temporary' | 'shutdown' = 'permanent') {
  const f = fixture(route), bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
  const packet = createPacketActivityController({ registry, bus, store: f.store, resolveRepairScenario: f.resolver });
  const verbs = createVerbController({ registry, bus, store: f.store, bindings: packet.hotspotBindings, allowDuringEncounter: allowRiftEncounterAction });
  if (outcome === 'shutdown') { f.choose('plan-shutdown'); f.choose('read-plan'); f.review(); }
  else f.prepare(`${route}-${route === 'copper' ? 'section' : 'A'}`, outcome === 'temporary' ? 'temporary' : 'permanent');
  if (outcome === 'temporary') f.choose('record-maintenance');
  if (outcome === 'shutdown') f.choose('record-isolation');
  expect(f.execute().result.status).toBe('handled'); expect(f.move('R12').status).toBe('handled');
  const open = () => bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-r12-3'), choiceId: q('ACTION-packet-r12'), verb: 'look', itemId: null }));
  const choose = (kind: SemanticAction['kind']) => {
    const p = packet.project(), control = p.view.controls.find(c => c.action.kind === kind);
    if (!control) throw new Error(`Missing ${kind}`); return bus.dispatch(p.capture(control.action));
  };
  const compare = () => { for (let i = 0; i < 4; i++) expect(choose('step-packet').status).toBe('handled'); return packet.project().view.result?.observations[0]; };
  const outcomes = createOutcomeController({ registry, repairScenario: f.resolver });
  const classify = () => {
    f.choose('read-classification');
    if (outcome !== 'shutdown') { f.act({ kind: 'measure-link', id: uuid(2) }); f.act({ kind: 'test-endpoint', id: uuid(3) }); }
    const prepared = outcomes.prepareClassification(f.state(), captureOutcomeContext(f.state())!, {
      actionId: crypto.randomUUID() as ActionId, eventId: uuid(90) as unknown as OutcomeEventId,
      operation: { kind: 'classify', selection: outcome, linkId: outcome === 'shutdown' ? null : uuid(2), endpointId: outcome === 'shutdown' ? null : uuid(3) },
    });
    if (!prepared.ok) throw new Error(JSON.stringify(prepared)); expect(outcomes.commit(f.store, prepared.change).ok).toBe(true);
  };
  return { ...f, packet, verbs, packetBus: bus, open, choosePacket: choose, compare, outcomes, classify };
}

describe('T090 R12 exact activity integration', () => {
  it.each(['copper', 'fiber', 'radio'] as const)('%s opens from the current terminal without a second success flag, then restores its active encounter', route => {
    const f = ready(route), before = f.state(); expect(f.open().status).toBe('handled');
    const opened = f.state(); expect(opened.runtime.activity?.kind).toBe('pending-effect'); expect(playable(opened)).toBe(false);
    expect(opened.control.pending?.previousActivity.kind).toBe('active-encounter');
    expect(opened.runtime.game).toBe(before.runtime.game); expect(opened.runtime.persistence).toBe(before.runtime.persistence);
    expect(f.compare()).toMatchObject({ kind: 'repair-packet-journey', route, recoveredBits: '0100111001010001', transmissionSucceeded: true });
    f.choosePacket('close-packet'); expect(f.state().runtime.activity?.kind).toBe('active-encounter');
    expect(f.state().runtime.game).toBe(before.runtime.game); expect(f.state().runtime.checkpoint).toBe(before.runtime.checkpoint);
    expect(f.state().runtime.persistence).toBe(before.runtime.persistence); expect(f.state().control.pending).toBeNull();
  });
  it('pause, step, replay, close and reopened preview do not perform final validation or refresh old proof', () => {
    const f = ready(), before = f.state(); f.open(); const locked = f.state();
    f.choosePacket('resume-packet'); f.choosePacket('pause-packet'); f.compare(); f.choosePacket('replay-packet'); f.compare();
    expect(f.state()).toBe(locked); expect(f.packet.project().view.result?.acceptedEffects).toEqual([]);
    f.choosePacket('close-packet'); f.open(); f.compare();
    expect(f.game()).toBe(before.runtime.game); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
    expect(f.game().notebook.measurements).toEqual(before.runtime.game!.notebook.measurements);
    expect(f.state().runtime.persistence).toBe(before.runtime.persistence);
  });
  it('clears a prior transient notebook window in the same lock acquisition without changing any saved data', () => {
    const f = ready(), selected = uiPlan(f.store, f.state(), { panel: 'notebook' }, 'Notebook selected.');
    if (selected.status !== 'ready') throw new Error('Expected current UI selection'); expect(selected.commit().status).toBe('handled');
    const before = f.state(); expect(f.open().status).toBe('handled');
    expect(f.state().runtime.ui?.panel).toBe('none'); expect(f.state().runtime.game).toBe(before.runtime.game);
    expect(f.state().runtime.persistence).toBe(before.runtime.persistence); expect(f.state().control.pending?.previousActivity.kind).toBe('active-encounter');
    f.choosePacket('close-packet'); expect(f.state().runtime.activity?.kind).toBe('active-encounter');
  });
  it.each(['permanent', 'temporary'] as const)('after %s classification blocks the cutscene and reopens only after actual Continue', outcome => {
    const f = ready('fiber', outcome); f.classify(); const accepted = f.state();
    expect(f.open().status).toBe('unavailable'); expect(f.state()).toBe(accepted);
    const dismissal = f.outcomes.prepareDismissal(f.state(), captureOutcomeContext(f.state())!);
    if (!dismissal.ok) throw new Error(dismissal.reason); expect(f.outcomes.commit(f.store, dismissal.change).ok).toBe(true);
    const safe = f.state(); expect(safe.runtime.activity?.kind).toBe('safe-continue'); expect(f.open().status).toBe('handled');
    expect(f.compare()).toMatchObject({ transmissionSucceeded: true, higherLayerServiceProven: false });
    f.choosePacket('close-packet'); expect(f.state().runtime.activity?.kind).toBe('safe-continue');
    expect(f.state().runtime.game).toBe(safe.runtime.game); expect(f.game().outcomeHistory).toHaveLength(1);
    expect(f.move('R11').status).toBe('handled'); expect(f.move('R12').status).toBe('handled');
    expect(f.open().status).toBe('handled'); expect(f.compare()).toMatchObject({ transmissionSucceeded: true });
  });
  it('shutdown preview reports no delivery; actual E03 Continue rewinds and removes R12 availability until new execution', () => {
    const f = ready('copper', 'shutdown'); f.open(); const p = f.packet.project();
    const late = p.capture(p.view.controls.find(c => c.action.kind === 'step-packet')!.action);
    expect(f.compare()).toMatchObject({ planId: 'shutdown', recoveredBits: null, comparison: null, transmissionSucceeded: false });
    f.choosePacket('close-packet'); f.classify(); const ended = f.state();
    expect(f.open().status).toBe('unavailable'); expect(f.state()).toBe(ended);
    const recovery = createRecoveryController({ registry, store: f.store, outcomes: f.outcomes,
      hazards: { failure: () => null }, restore: { available: () => false, continue: () => {}, signIn: () => {} }, changed: () => {}, afterRollback: () => f.packet.invalidate() });
    expect(recovery.request(recovery.capture('continue')!).ok).toBe(true); expect(recovery.confirm(recovery.project()!).ok).toBe(true);
    const rewound = f.state(); expect(f.game().world.roomId).toBe(q('R11')); expect(f.game().world.attemptId).not.toBe(ended.runtime.game!.world.attemptId);
    expect(f.game().world.flags[q<'flag'>('FLAG-repair-executed')]).toBeUndefined(); expect(f.packet.project().view.open).toBe(false);
    expect(f.open().status).not.toBe('handled'); expect(f.packetBus.dispatch(late).status).toBe('rejected'); expect(f.state()).toBe(rewound);
    f.choose('plan-copper-section'); f.choose('duration-permanent'); f.review(10); expect(f.execute(10).result.status).toBe('handled'); f.move('R12');
    expect(f.open().status).toBe('handled'); expect(f.compare()).toMatchObject({ planId: 'copper-section', transmissionSucceeded: true,
      version: { attemptId: f.game().world.attemptId, configurationRevision: f.game().world.configurationRevision } });
    expect(f.game().notebook.measurements.filter(m => m.attemptId === ended.runtime.game!.world.attemptId).every(m => m.stale)).toBe(true);
  });
  it.each(['same-save', 'new-adventure', 'logout', 'new-account', 'other-lock'] as const)('%s replacement retires old callbacks without releasing another state', change => {
    const f = ready(); f.open(); const original = f.state(), p = f.packet.project();
    const late = p.capture(p.view.controls.find(c => c.action.kind === 'close-packet')!.action);
    let next: ReducerState = createReducerState(structuredClone(original.runtime));
    if (change === 'new-adventure') next = createReducerState(startIntroduction(original.runtime, registry));
    if (change === 'logout') next = createReducerState(createIntroductionRuntime());
    if (change === 'new-account') next = { ...original, runtime: { ...original.runtime, auth: { ...original.runtime.auth, clientGeneration: 7 as never } } };
    if (change === 'other-lock') next = { ...original, control: { ...original.control, pending: { ...original.control.pending!, actionId: crypto.randomUUID() as ActionId } } };
    f.replace(next); expect(f.packet.project().view.open).toBe(false); expect(f.packetBus.dispatch(late).status).toBe('rejected');
    f.packet.invalidate(); f.packet.dispose(); expect(f.state()).toBe(next);
  });
  it('active permission stays exact to the terminal Look action, with no generic scene or safe-state expansion', () => {
    const f = ready(), state = f.state();
    expect(allowRiftEncounterAction(state, { kind: 'select-verb', verb: 'look' })).toBe(true);
    expect(allowRiftEncounterAction(state, { kind: 'interact', targetId: q('HOTSPOT-r12-3'), verb: 'look', itemId: null })).toBe(true);
    for (const input of [
      { kind: 'interact', targetId: q('HOTSPOT-r12-2'), verb: 'look', itemId: null },
      { kind: 'interact', targetId: q('HOTSPOT-r12-3'), verb: 'use', itemId: null },
      { kind: 'choose-hotspot-action', targetId: q('HOTSPOT-r12-3'), choiceId: q('ACTION-O12-permanent'), verb: 'look', itemId: null },
      { kind: 'interact', targetId: q('R11'), verb: 'walk', itemId: null },
    ] as SemanticAction[]) expect(allowRiftEncounterAction(state, input)).toBe(false);
    expect(playable(state)).toBe(false); f.open(); expect(f.open().status).toBe('unavailable');
    expect(f.send({ kind: 'repair-plan', operation: { kind: 'measure-link', id: uuid(88) } })).toMatchObject({ status: 'rejected', reason: 'transition-pending' });
  });
  it('actual fatal Retry creates a new attempt and requires new execution before the packet journey is available', () => {
    const f = fixture('radio'), checked = validateEndingsContent(endings); if (!checked.ok) throw new Error('Expected authored ending content');
    f.prepare('radio-A'); const before = f.state();
    const hazards = createRiftHazardController({ registry, content: checked.value });
    const failure = hazards.prepare(before, captureEncounterContext(before)!, { hazardId: checked.value.hazard.id, warningAcknowledged: true });
    if (!failure.ok) throw new Error(failure.reason); expect(hazards.commit(f.store, failure.change).ok).toBe(true);
    const outcomes = createOutcomeController({ registry, repairScenario: f.resolver });
    const bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
    const packet = createPacketActivityController({ registry, bus, store: f.store, resolveRepairScenario: f.resolver });
    createVerbController({ registry, bus, store: f.store, bindings: packet.hotspotBindings, allowDuringEncounter: allowRiftEncounterAction });
    const open = () => bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-r12-3'), choiceId: q('ACTION-packet-r12'), verb: 'look', itemId: null }));
    expect(open().status).not.toBe('handled');
    const recovery = createRecoveryController({ registry, store: f.store, outcomes, hazards,
      restore: { available: () => false, continue: () => {}, signIn: () => {} }, changed: () => {}, afterRollback: () => packet.invalidate() });
    expect(recovery.request(recovery.capture('retry')!).ok).toBe(true); expect(recovery.confirm(recovery.project()!).ok).toBe(true);
    expect(f.game().world.attemptId).not.toBe(before.runtime.game!.world.attemptId); expect(open().status).not.toBe('handled');
    expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true); f.review(21); expect(f.execute(21).result.status).toBe('handled');
    expect(f.move('R12').status).toBe('handled'); expect(open().status).toBe('handled');
    for (let i = 0; i < 4; i++) { const p = packet.project(); bus.dispatch(p.capture(p.view.controls.find(c => c.action.kind === 'step-packet')!.action)); }
    expect(packet.project().view.result?.observations[0]).toMatchObject({ kind: 'repair-packet-journey', route: 'radio',
      transmissionSucceeded: true, version: { attemptId: f.game().world.attemptId, configurationRevision: f.game().world.configurationRevision } });
    expect(f.state().runtime.persistence.pendingRequest).toBeNull(); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it.each(['condition', 'effects'] as const)('changed custom authored %s cannot open a packet lock or award progress', fault => {
    const f = ready(), before = f.state();
    const content: ContentRegistry = { ...registry, record: id => {
      const original = registry.record(id); if (id !== q('DIALOGUE-packet-r12') || original?.kind !== 'dialogue') return original;
      return { ...original, nodes: original.nodes.map(node => ({ ...node,
        condition: fault === 'condition' ? { kind: 'always' as const } : node.condition,
        choices: node.choices.map(choice => ({ ...choice, effects: fault === 'effects'
          ? [{ kind: 'record-fact' as const, effectId: q('EFFECT-packet-context'), factId: q('FACT-packet-context') }] : choice.effects })) })) };
    } };
    // Stable authored identity is part of the registry contract, including a
    // custom trusted registry. Cache this altered record just as the real loader.
    const altered = content.record(q('DIALOGUE-packet-r12'));
    const stable: ContentRegistry = { ...content, record: id => id === q('DIALOGUE-packet-r12') ? altered : registry.record(id) };
    const bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
    const packet = createPacketActivityController({ registry: stable, bus, store: f.store, resolveRepairScenario: f.resolver });
    createVerbController({ registry: stable, bus, store: f.store, bindings: packet.hotspotBindings, allowDuringEncounter: allowRiftEncounterAction });
    expect(bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-r12-3'), choiceId: q('ACTION-packet-r12'), verb: 'look', itemId: null }))).toMatchObject({ status: 'unavailable', reason: 'packet-content-error' });
    expect(f.state()).toBe(before); expect(packet.project().view.open).toBe(false);
  });
  it('losing the single compare-and-set cannot partially open a journey or alter current memory', () => {
    const f = ready(), before = f.state(), bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
    const packet = createPacketActivityController({ registry, bus, store: { ...f.store, compareAndSet: () => false }, resolveRepairScenario: f.resolver });
    createVerbController({ registry, bus, store: f.store, bindings: packet.hotspotBindings, allowDuringEncounter: allowRiftEncounterAction });
    expect(bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-r12-3'), choiceId: q('ACTION-packet-r12'), verb: 'look', itemId: null })).status).toBe('rejected');
    expect(f.state()).toBe(before); expect(packet.project().view.open).toBe(false);
  });
});
