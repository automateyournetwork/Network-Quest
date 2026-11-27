// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { episodeNavigationEntries, loadIntroductionContent } from '../../src/app/content';
import { introductionSavePolicy } from '../../src/app/save-policy';
import type { ActionId, AttemptId, MeasurementId, QualifiedId, Route } from '../../src/domain/types';
import { SaveValidator } from '../../src/services/save-validator';
import { captureEncounterContext, commitEncounterChange, prepareEncounterCheckpoint, prepareEncounterRollback } from '../../src/state/encounter';
import { createNavigation } from '../../src/state/navigation';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../src/state/reducer';
import type { ReducerCommand, ReducerInput, ReducerState } from '../../src/state/reducer';
import { createRepairScenarioResolver, prepareRepairPlanChange, repairEffectBindings, repairFlags } from '../../src/state/repair-plan';
import type { RepairPlanId, RepairPlanOperation } from '../../src/state/repair-plan';
import { riftPreparationBoundary } from '../../src/state/rift-encounter';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import type { GameState, SafeState, WorldState } from '../../src/state/types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const measurement = (n: number) => uuid(n) as MeasurementId;
const { registry, world } = loadIntroductionContent();
const entries = episodeNavigationEntries(registry, world);
const navigation = createNavigation({ registry, world, entries });
const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
const resolver = createRepairScenarioResolver(registry);
const branches = [
  { route: 'copper', objectives: ['O03', 'O04'], plan: 'copper-section' },
  { route: 'fiber', objectives: ['O05', 'O06'], plan: 'fiber-A' },
  { route: 'radio', objectives: ['O07', 'O08'], plan: 'radio-A' },
] as const;
afterEach(() => vi.restoreAllMocks());

/**
 * Canonical registry and actual policies; no introduction projection or old
 * repair fixture. Branch/equipment completion is explicitly SUPPLIED at R10 to
 * isolate encounter behavior. It is not an end-to-end branch/learning claim.
 * Every subsequent movement uses the actual navigation resolver and reducer.
 */
function fixture(route: Route = 'copper') {
  const branch = branches.find(b => b.route === route)!;
  const runtime = startIntroduction(createIntroductionRuntime(), registry), initialGame = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...initialGame, world: { ...initialGame.world,
    roomId: q<'room'>('R10'), position: { safePositionId: q<'safe-position'>('R10.entry') },
    completedObjectiveIds: ['O01', 'O02', ...branch.objectives, 'O09', 'O10'].map(id => q<'objective'>(id)),
    inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }],
    flags: { [q('FLAG-market-kit')]: 'compatible-kit-A', [q('FLAG-equipment-capability')]: '100/full',
      [q('FLAG-clock-method')]: 'step-and-decode', [q('FLAG-clock-role')]: 'physical-sampling-not-address-discovery',
      [q('FLAG-clock-bits-0')]: '00', [q('FLAG-clock-bits-1')]: '10', [q('FLAG-clock-bits-2')]: '11', [q('FLAG-clock-bits-3')]: '01' },
  }, notebook: { ...initialGame.notebook, mapRoomIds: [q('R01'), q('R02'), q('R10')], personalNotes: 'Before the intervention.',
    hypotheses: [{ id: uuid(15) as GameState['notebook']['hypotheses'][number]['id'], text: 'Retest the physical proof after a configuration change.', subjectIds: [q('R11')], status: 'open' }] } } });
  const reduce = createReducer({ registry, bindings: repairEffectBindings(registry), repairScenario: resolver, canReachRoom: navigation.canReachRoom });
  const observations: ReducerState[] = [];
  const store = { getState: () => state, compareAndSet: (expected: ReducerState, next: ReducerState) => {
    if (state !== expected) return false; state = next; observations.push(next); return true;
  } };
  let actionNumber = 0;
  const send = (input: ReducerInput) => {
    const before = state;
    const command: ReducerCommand = { actionId: `world-${++actionNumber}` as ActionId, adventureId: state.runtime.game!.adventureId,
      expectedVersion: state.runtime.game!.world, input };
    const result = reduce(before, command);
    expect(result.status, result.reason).not.toBe('rejected');
    expect(store.compareAndSet(before, result.state)).toBe(true);
    return { result, command };
  };
  const act = (operation: RepairPlanOperation) => {
    const prepared = prepareRepairPlanChange(registry, resolver, state.runtime.game!, operation);
    expect(prepared.ok).toBe(true); if (!prepared.ok) throw new Error(prepared.reason);
    expect(prepared.evaluation.status, prepared.evaluation.reasonCode).toBe('correct');
    return send({ kind: 'repair-plan', operation });
  };
  const choose = (name: string) => act({ kind: 'choose', actionId: q(`ACTION-repair-${name}`) });
  const walk = (room: string) => {
    const activity = state.runtime.activity!.kind;
    if (!['stable-exploration', 'safe-preparation', 'safe-continue'].includes(activity)) throw new Error('Only an actual safe navigation phase may walk.');
    const resolved = navigation.resolve(state.runtime.game!.world, q(room), activity as SafeState);
    expect(resolved.ok).toBe(true); if (!resolved.ok) throw new Error(resolved.reason);
    return send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'canonical-navigation', observations: [], acceptedEffects: [] }, destination: resolved.destination });
  };
  const prepare = (plan: RepairPlanId = branch.plan, duration: 'permanent' | 'temporary' = 'permanent', id = 1) => {
    choose(`plan-${plan}`); choose(`duration-${duration}`); choose('read-plan');
    if (plan === 'shutdown') choose('record-isolation');
    if (duration === 'temporary') choose('record-maintenance');
    act({ kind: 'review', id: measurement(id) });
  };
  const capture = () => {
    const before = state, plan = prepareEncounterCheckpoint(before, captureEncounterContext(before)!, registry, riftPreparationBoundary);
    expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
    expect(state).toBe(before); expect(commitEncounterChange(store, plan.change).ok).toBe(true);
    return state.runtime.checkpoint!;
  };
  const retry = (n = 2) => {
    const before = state, plan = prepareEncounterRollback(before, captureEncounterContext(before)!, registry,
      { actionId: `rollback-${n}` as ActionId, nextAttemptId: uuid(n) as AttemptId }, riftPreparationBoundary);
    expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
    expect(state).toBe(before); expect(commitEncounterChange(store, plan.change).ok).toBe(true);
    return state;
  };
  return { store, observations, reduce, send, act, choose, walk, prepare, capture, retry,
    /** Explicit fault-state input until T086/T088 owns actual failure delivery. */
    supplyTerminalFailure: () => { state = { ...state, runtime: { ...state.runtime, activity: { kind: 'terminal-failure' } } }; } };
}
function worldBody(value: WorldState) { const { attemptId: _a, configurationRevision: _r, ...body } = value; return body; }
function retained(game: GameState) { return { notebook: { ...game.notebook, measurements: game.notebook.measurements.map(m => ({ ...m, stale: true })) },
  assistance: game.assistance, outcomeHistory: game.outcomeHistory }; }
function assertSafeRetry(state: ReducerState, previous: ReducerState, preparation: WorldState) {
  const game = state.runtime.game!, before = previous.runtime.game!;
  expect(worldBody(game.world)).toEqual(worldBody(preparation));
  expect(game.world.attemptId).not.toBe(before.world.attemptId);
  expect(game.world.configurationRevision).toBeGreaterThan(Math.max(previous.control.highestRevision, preparation.configurationRevision,
    before.world.configurationRevision, ...before.notebook.measurements.map(m => m.configurationRevision)));
  expect({ notebook: game.notebook, assistance: game.assistance, outcomeHistory: game.outcomeHistory }).toEqual(retained(before));
  expect(game.notebook.measurements.every(m => !isMeasurementCurrent(m, game.world))).toBe(true);
  expect(state.runtime.persistence).toEqual({ ...previous.runtime.persistence, dirtyGeneration: previous.runtime.persistence.dirtyGeneration + 1 });
  expect(state.runtime.checkpoint).toBe(previous.runtime.checkpoint); expect(state.runtime.auth).toBe(previous.runtime.auth);
  const safe = captureSafeSnapshot(state, validator);
  expect(safe.ok, JSON.stringify(safe)).toBe(true); if (!safe.ok) throw new Error(safe.code);
  expect(safe.capture.snapshot.safeState).toBe('safe-preparation');
  expect(safe.capture.snapshot.world).toEqual(game.world);
  expect(safe.capture.snapshot.notebook).toEqual(game.notebook);
  expect(safe.capture.snapshot.assistance).toEqual(game.assistance);
  expect(safe.capture.snapshot).not.toHaveProperty('checkpoint'); expect(safe.capture.snapshot).not.toHaveProperty('control');
  expect(safe.capture.snapshot.world.flags).not.toHaveProperty(repairFlags.executed);
  expect(safe.capture.snapshot.world.completedObjectiveIds).not.toContain(q('O11'));
  expect(safe.capture.snapshot.world.completedObjectiveIds).not.toContain(q('O12'));
}

describe('T084 canonical twelve-room module join, distinct from supplied prerequisites and future UI integration', () => {
  it('uses all twelve canonical room records and the exact application navigation/save selections', () => {
    const expected = Array.from({ length: 12 }, (_, i) => q(`R${String(i + 1).padStart(2, '0')}`));
    expect(world.documents.filter(d => d.kind === 'room').map(d => d.id).sort()).toEqual(expected);
    expect(expected.every(id => registry.record(id)?.kind === 'room')).toBe(true);
    expect(entries.map(e => e.roomId)).toEqual(expected);
    expect(registry.safePosition(q('R11.preparation'))).toMatchObject({ roomId: q('R11'), eligibleStates: ['stable-exploration', 'safe-preparation'] });
    const f = fixture(); expect(validator.validateRuntime(f.store.getState().runtime).ok).toBe(true);
    f.walk('R11'); expect(f.store.getState().runtime.activity?.kind).toBe('safe-preparation');
    expect(riftPreparationBoundary(f.store.getState().runtime.game!.world)).toBe(true);
  });

  it.each(branches)('$route: actual navigation, repair, retained learning, supplied failure, retry and real safe-snapshot validation', branch => {
    const writes = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('This module join has no HTTP operation.'));
    const f = fixture(branch.route); f.walk('R11'); f.prepare();
    const beforeCapture = f.store.getState(), capturedWorld = structuredClone(beforeCapture.runtime.game!.world), checkpoint = f.capture();
    expect(checkpoint.world).toEqual(capturedWorld); expect(checkpoint.world).not.toBe(beforeCapture.runtime.game!.world);
    expect(f.store.getState().runtime.persistence).toBe(beforeCapture.runtime.persistence);
    expect(f.store.getState().runtime.game).toBe(beforeCapture.runtime.game);
    expect(captureSafeSnapshot(f.store.getState(), validator).ok).toBe(true);
    const execution = f.act({ kind: 'execute', reviewId: measurement(1), warningAcknowledged: true });
    const committed = f.store.getState();
    expect(committed.runtime.game!.world.flags[repairFlags.executed]).toBe(branch.plan);
    expect(committed.runtime.game!.world.completedObjectiveIds).toContain(q('O11'));
    expect(prepareEncounterCheckpoint(committed, captureEncounterContext(committed)!, registry, riftPreparationBoundary)).toMatchObject({ ok: false, reason: 'no-preparation' });
    expect(f.store.getState().runtime.checkpoint).toBe(checkpoint);
    f.walk('R12'); f.choose('read-classification');
    f.act({ kind: 'measure-link', id: measurement(11) }); f.act({ kind: 'test-endpoint', id: measurement(12) });
    f.send({ kind: 'notebook', operation: { kind: 'notes', text: `Keep the ${branch.route} observations; retry requires fresh proof. λ` } });
    f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O11') } });
    f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O12') } });
    f.supplyTerminalFailure(); const failed = f.store.getState(), priorObservations = f.observations.length;
    expect(captureSafeSnapshot(failed, validator)).toMatchObject({ ok: false, code: 'safe-state' });
    const after = f.retry(); assertSafeRetry(after, failed, capturedWorld);
    expect(f.observations).toHaveLength(priorObservations + 1);
    expect(after.runtime.game!.world.activeAllyIds).toEqual([]); // no invented companion content
    expect(after.runtime.game!.notebook.factIds).toContain(q('FACT-O11-execution'));
    expect(after.runtime.game!.notebook.factIds).toContain(q('FACT-O12-classification'));
    expect(after.runtime.game!.notebook.mapRoomIds).toContain(q('R12'));
    expect(after.runtime.game!.notebook.measurements).toHaveLength(3);
    expect(after.runtime.game!.assistance).toHaveLength(2);
    const staleDelivery = f.reduce(after, execution.command);
    expect(staleDelivery).toMatchObject({ status: 'rejected', reason: 'stale-version' }); expect(staleDelivery.state).toBe(after);
    expect(writes).not.toHaveBeenCalled();
  });

  it.each(branches)('$route temporary execution cannot recapture a safely located postcommit world', branch => {
    const f = fixture(branch.route); f.walk('R11'); f.prepare(branch.plan, 'temporary'); const checkpoint = f.capture();
    f.act({ kind: 'execute', reviewId: measurement(1), warningAcknowledged: true }); const before = f.store.getState();
    expect(before.runtime.activity?.kind).toBe('safe-preparation');
    expect(riftPreparationBoundary(before.runtime.game!.world)).toBe(false);
    expect(prepareEncounterCheckpoint(before, captureEncounterContext(before)!, registry, riftPreparationBoundary)).toMatchObject({ ok: false, reason: 'no-preparation' });
    expect(f.store.getState()).toBe(before); expect(before.runtime.checkpoint).toBe(checkpoint);
  });

  it('actual shutdown execution and classification stay unsaveable, then Continue validates the restored preparation and retained journal', () => {
    const writes = vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('No implicit write.'));
    const f = fixture(); f.walk('R11'); f.prepare('shutdown'); const checkpoint = f.capture();
    f.act({ kind: 'execute', reviewId: measurement(1), warningAcknowledged: true }); const immediate = f.store.getState();
    expect(captureSafeSnapshot(immediate, validator)).toMatchObject({ ok: false, code: 'safe-state', path: '/world/flags' });
    expect(prepareEncounterCheckpoint(immediate, captureEncounterContext(immediate)!, registry, riftPreparationBoundary)).toMatchObject({ ok: false, reason: 'no-preparation' });
    f.walk('R12'); f.choose('read-classification');
    f.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Service remains unresolved; retain the isolation observation.' } });
    f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O12') } });
    f.act({ kind: 'classify', selection: 'shutdown', linkId: null, endpointId: null }); const ended = f.store.getState();
    expect(ended.runtime.activity?.kind).toBe('shutdown');
    expect(ended.runtime.game!.world.completedObjectiveIds).toContain(q('O12'));
    expect(captureSafeSnapshot(ended, validator)).toMatchObject({ ok: false, code: 'safe-state', path: '/activity' });
    expect(prepareEncounterCheckpoint(ended, captureEncounterContext(ended)!, registry, riftPreparationBoundary)).toMatchObject({ ok: false, reason: 'no-preparation' });
    const after = f.retry(); assertSafeRetry(after, ended, checkpoint.world);
    expect(after.runtime.game!.notebook.factIds).toContain(q('FACT-repair-isolation'));
    expect(after.runtime.game!.world.flags).not.toHaveProperty(repairFlags.classification);
    expect(after.runtime.game!.outcomeHistory).toEqual([]); // T086 records the later ending event; this test does not fabricate one.
    expect(writes).not.toHaveBeenCalled();
  });

  it('after actual rollback, stale review cannot execute, while a genuinely new review can execute exactly once', () => {
    const f = fixture('fiber'); f.walk('R11'); f.prepare(); const checkpoint = f.capture();
    f.act({ kind: 'execute', reviewId: measurement(1), warningAcknowledged: true }); f.supplyTerminalFailure();
    const first = f.retry();
    const stale = prepareRepairPlanChange(registry, resolver, first.runtime.game!, { kind: 'execute', reviewId: measurement(1), warningAcknowledged: true });
    expect(stale).toMatchObject({ ok: true, evaluation: { status: 'incorrect', reasonCode: 'stale-evidence', acceptedEffects: [] } });
    f.act({ kind: 'review', id: measurement(21) });
    expect(isMeasurementCurrent(f.store.getState().runtime.game!.notebook.measurements.at(-1)!, f.store.getState().runtime.game!.world)).toBe(true);
    const execution = f.act({ kind: 'execute', reviewId: measurement(21), warningAcknowledged: true }), installed = f.store.getState();
    const replay = f.reduce(installed, execution.command);
    expect(replay).toMatchObject({ status: 'rejected', reason: 'stale-version' }); expect(replay.state).toBe(installed);
    f.supplyTerminalFailure(); const failedAgain = f.store.getState(), second = f.retry(3);
    assertSafeRetry(second, failedAgain, checkpoint.world);
    expect(second.runtime.game!.world.configurationRevision).toBeGreaterThan(first.runtime.game!.world.configurationRevision);
    expect(second.runtime.game!.world.inventory).toEqual(checkpoint.world.inventory);
    expect(second.runtime.game!.world.dialogueEffectIds).toEqual(checkpoint.world.dialogueEffectIds);
    expect(new Set(second.runtime.game!.notebook.factIds).size).toBe(second.runtime.game!.notebook.factIds.length);
  });

  it('the actual Rift policy rejects a different authored safe anchor and a postcommit checkpoint on rollback', () => {
    const f = fixture(); const r10 = f.store.getState();
    const wronglyLabeled = { ...r10, runtime: { ...r10.runtime, activity: { kind: 'safe-preparation' as const } } };
    expect(prepareEncounterCheckpoint(wronglyLabeled, captureEncounterContext(wronglyLabeled)!, registry, riftPreparationBoundary)).toMatchObject({ ok: false, reason: 'no-preparation' });
    f.walk('R11'); f.prepare(); f.capture(); f.act({ kind: 'execute', reviewId: measurement(1), warningAcknowledged: true });
    const executed = f.store.getState();
    const invalid = { ...executed, runtime: { ...executed.runtime, activity: { kind: 'terminal-failure' as const }, checkpoint: {
      adventureId: executed.runtime.game!.adventureId, world: structuredClone(executed.runtime.game!.world) } } };
    expect(prepareEncounterRollback(invalid, captureEncounterContext(invalid)!, registry,
      { actionId: 'invalid-checkpoint' as ActionId, nextAttemptId: uuid(9) as AttemptId }, riftPreparationBoundary)).toMatchObject({ ok: false, reason: 'no-preparation' });
  });
});
