// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { allowRiftEncounterAction, createEncounterExecutionPlan } from '../../src/ui/encounter';
import { allowRiftEncounterInput, isActiveRiftEncounter, riftPreparationBoundary } from '../../src/state/rift-encounter';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import type { CapturedAction, SemanticAction } from '../../src/ui/action-bus';
import type { ReducerInput, ReducerState } from '../../src/state/reducer';
import { repairFlags } from '../../src/state/repair-plan';
import { prepareObjectiveChange } from '../../src/state/objectives';
import type { ActivityState, WorldState } from '../../src/state/types';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { SaveValidator } from '../../src/services/save-validator';
import { fixture as repairFixture, input as authoredInput, q, registry, uuid } from '../state/repair-plan-fixture';

// Expected boundaries are specified by C9/C12, FR-009/010, T077 and T083.
// These tests use the actual reducer/content, not an expected-answer adapter.
function fixture(route: 'copper' | 'fiber' | 'radio' = 'copper') {
  const f = repairFixture(route);
  f.replace({ ...f.state(), runtime: { ...f.state().runtime, activity: { kind: 'safe-preparation' } } });
  const observed: ReducerState[] = [];
  let casAllowed = true;
  const store = { getState: f.state, reduce: f.reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (!casAllowed || f.state() !== before) return false;
    observed.push(next); f.replace(next); return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
  bus.register('execute-repair-plan', action => createEncounterExecutionPlan({ registry, store, action, before: f.state(), message: 'Reviewed intervention.' }));
  const action = (ack = true, reviewId = uuid(1)) => bus.capture({ kind: 'execute-repair-plan', reviewId, warningAcknowledged: ack });
  return { ...f, store, observed, bus, action, denyCas: () => { casAllowed = false; } };
}

describe('T085 exact authored precommit preparation boundary', () => {
  it('accepts R11.preparation with no execution, classification or O11', () => {
    const f = fixture(); expect(riftPreparationBoundary(f.game().world)).toBe(true);
  });
  const invalidWorlds: readonly [string, (world: WorldState) => WorldState][] = [
    ['another room', w => ({ ...w, roomId: q('R02') })],
    ['another anchor', w => ({ ...w, position: { safePositionId: q('R11.entry') } })],
    ['executed marker', w => ({ ...w, flags: { ...w.flags, [repairFlags.executed]: 'copper-section' } })],
    ['false execution marker', w => ({ ...w, flags: { ...w.flags, [repairFlags.executed]: false } })],
    ['classification marker', w => ({ ...w, flags: { ...w.flags, [repairFlags.classification]: 'E01' } })],
    ['O11 completion', w => ({ ...w, completedObjectiveIds: [...w.completedObjectiveIds, q('O11')] })],
    ['Continue outcome', w => ({ ...w, continueOutcome: 'E01' })],
  ];
  it.each(invalidWorlds)('rejects %s despite a preparation activity', (_label, change) => {
    const f = fixture(); expect(riftPreparationBoundary(change(f.game().world))).toBe(false);
  });
});

describe('T085 shared committed encounter policy, closed until outcome acceptance', () => {
  function committed(atThreshold = false) {
    const f = fixture(); f.prepare(); f.bus.dispatch(f.action());
    const state = f.state();
    return atThreshold ? { ...state, runtime: { ...state.runtime, game: { ...state.runtime.game!, world: { ...state.runtime.game!.world,
      roomId: q<'room'>('R12'), position: { safePositionId: q<'safe-position'>('R12.entry') } } } } } : state;
  }
  it.each([false, true])('accepts only current committed Rift/Threshold with its matching precommit checkpoint (%s)', threshold => {
    expect(isActiveRiftEncounter(committed(threshold))).toBe(true);
  });
  const changes: readonly [string, (s: ReducerState) => ReducerState][] = [
    ['wrong room', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, roomId: q('R02') } } } })],
    ['wrong anchor', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, position: { safePositionId: q('R11.entry') } } } } })],
    ['missing checkpoint', s => ({ ...s, runtime: { ...s.runtime, checkpoint: null } })],
    ['pending transition', s => ({ ...s, control: { ...s.control, pending: {} as NonNullable<ReducerState['control']['pending']> } })],
    ['no adventure', s => ({ ...s, runtime: { ...s.runtime, game: null } })],
    ['cross-adventure checkpoint', s => ({ ...s, runtime: { ...s.runtime, checkpoint: { ...s.runtime.checkpoint!, adventureId: uuid(20) as unknown as NonNullable<ReducerState['runtime']['game']>['adventureId'] } } })],
    ['checkpoint after execution', s => ({ ...s, runtime: { ...s.runtime, checkpoint: { ...s.runtime.checkpoint!, world: s.runtime.game!.world } } })],
    ['cross-attempt checkpoint', s => ({ ...s, runtime: { ...s.runtime, checkpoint: { ...s.runtime.checkpoint!, world: { ...s.runtime.checkpoint!.world, attemptId: uuid(21) as unknown as WorldState['attemptId'] } } } })],
    ['missing O11', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, completedObjectiveIds: [] } } } })],
    ['completed O12', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, completedObjectiveIds: [...s.runtime.game!.world.completedObjectiveIds, q('O12')] } } } })],
    ['outcome classification', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, flags: { ...s.runtime.game!.world.flags, [repairFlags.classification]: 'permanent' } } } } })],
    ['Continue outcome', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, continueOutcome: 'E01' } } } })],
    ['cutscene phase', s => ({ ...s, runtime: { ...s.runtime, activity: { kind: 'cutscene' } } })],
    ['unknown executed plan', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, flags: { ...s.runtime.game!.world.flags, [repairFlags.executed]: 'unknown' } } } } })],
    ['changed selected plan', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, flags: { ...s.runtime.game!.world.flags, [repairFlags.selected]: 'copper-alternate' } } } } })],
    ['changed duration', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, flags: { ...s.runtime.game!.world.flags, [repairFlags.duration]: 'temporary' } } } } })],
    ['execution record missing', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, notebook: { ...s.runtime.game!.notebook, factIds: [] } } } })],
    ['wrong route', s => ({ ...s, runtime: { ...s.runtime, game: { ...s.runtime.game!, world: { ...s.runtime.game!.world, route: 'fiber' } } } })],
  ];
  it.each(changes)('denies %s and all notebook/repair admission', (_name, change) => {
    const state = change(committed()); expect(isActiveRiftEncounter(state)).toBe(false);
    expect(allowRiftEncounterInput(state, { kind: 'notebook', operation: { kind: 'notes', text: 'Retained learning' } })).toBe(false);
  });
  it('permits actual notes at both anchors and only the four R12 validation operations', () => {
    const rift = committed(), threshold = committed(true);
    const notes: ReducerInput = { kind: 'notebook', operation: { kind: 'notes', text: 'A current observation' } };
    expect(allowRiftEncounterInput(rift, notes)).toBe(true); expect(allowRiftEncounterInput(threshold, notes)).toBe(true);
    const inputs: ReducerInput[] = [
      { kind: 'repair-plan', operation: { kind: 'measure-link', id: uuid(5) } },
      { kind: 'repair-plan', operation: { kind: 'test-endpoint', id: uuid(6) } },
      { kind: 'repair-plan', operation: { kind: 'choose', actionId: q('ACTION-repair-read-classification') } },
      { kind: 'repair-plan', operation: { kind: 'classify', selection: 'permanent', linkId: uuid(5), endpointId: uuid(6) } },
    ];
    for (const input of inputs) { expect(allowRiftEncounterInput(rift, input)).toBe(false); expect(allowRiftEncounterInput(threshold, input)).toBe(true); }
  });
  it('denies generic objectives, plan edits, review, reexecution, recovery, unrelated notebook and arbitrary effects', () => {
    const state = committed(true);
    const denied: ReducerInput[] = [
      { kind: 'repair-plan', operation: { kind: 'choose', actionId: q('ACTION-repair-plan-copper-alternate') } },
      { kind: 'repair-plan', operation: { kind: 'review', id: uuid(7) } },
      { kind: 'repair-plan', operation: { kind: 'execute', reviewId: uuid(1), warningAcknowledged: true } },
      { kind: 'notebook', operation: { kind: 'inspect-path', id: uuid(7) } },
      { kind: 'notebook', operation: { kind: 'pin-hypothesis', id: uuid(8) as never, text: 'Speculation' } },
      { kind: 'recover-item', itemId: q('ITEM-inspection-kit') },
      { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'not-an-encounter-command', acceptedEffects: [], observations: [] } },
      { kind: 'objective', operation: { kind: 'measure', objectiveId: q('O11'), alternativeId: q('ACTION-O11-copper'), id: uuid(9) } },
      { kind: 'objective', operation: { kind: 'submit', objectiveId: q('O11'), alternativeId: q('ACTION-O11-copper'), measurementId: uuid(9) } },
      { kind: 'objective', operation: { kind: 'hint', objectiveId: q('O13') } },
    ];
    for (const input of denied) expect(allowRiftEncounterInput(state, input)).toBe(false);
  });
  it('fails closed on malformed or throwing trusted-policy inputs', () => {
    expect(isActiveRiftEncounter(null as unknown as ReducerState)).toBe(false);
    const state = committed(true);
    expect(allowRiftEncounterInput(state, null as unknown as ReducerInput)).toBe(false);
    const throwing = { ...state, get runtime(): ReducerState['runtime'] { throw new Error('policy input'); } };
    expect(isActiveRiftEncounter(throwing)).toBe(false);
    expect(allowRiftEncounterInput(throwing, { kind: 'notebook', operation: { kind: 'notes', text: 'No admission' } })).toBe(false);
  });
  it('permits only authored episode hint requests and real hint finalization adds history without any award', () => {
    const state = committed(true);
    for (const id of ['O01', 'O02', 'O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10', 'O11', 'O12']) {
      const operation = { kind: 'hint' as const, objectiveId: q<'objective'>(id) };
      expect(allowRiftEncounterInput(state, { kind: 'objective', operation })).toBe(true);
      let game = state.runtime.game!;
      for (let level = 1; level <= 4; level++) {
        const prepared = prepareObjectiveChange(registry, undefined, game, operation);
        if (!prepared.ok) throw new Error(`Actual ${id} hint unavailable: ${prepared.reason}`);
        expect(prepared.evaluation.acceptedEffects).toEqual([]);
        const final = prepared.finalize(game); if (!final.ok) throw new Error('Hint finalize rejected');
        expect(final.game.world).toBe(state.runtime.game!.world);
        expect(final.game.notebook).toBe(state.runtime.game!.notebook);
        expect(final.game.outcomeHistory).toBe(state.runtime.game!.outcomeHistory);
        expect(final.game.assistance.filter(hint => hint.objectiveId === operation.objectiveId).map(hint => hint.level)).toEqual([1, 2, 3].slice(0, level));
        expect(final.game.assistance.every(hint => hint.attemptId === game.world.attemptId)).toBe(true);
        game = final.game;
      }
    }
    expect(allowRiftEncounterInput(state, { kind: 'objective', operation: { kind: 'hint', objectiveId: 'spec002:O01' as never } })).toBe(false);
  });
  it('admits only exact active UI intents and requires the actual notebook to be open for its controls', () => {
    const state = committed(), opened = { ...state, runtime: { ...state.runtime, ui: { ...state.runtime.ui!, panel: 'notebook' as const } } };
    const allowed: SemanticAction[] = [{ kind: 'select-verb', verb: 'walk' }, { kind: 'open-panel', panel: 'notebook' },
      { kind: 'interact', targetId: q('R12'), verb: 'walk', itemId: null }, { kind: 'request-objective-hint', objectiveId: q('O11') }];
    for (const input of allowed) expect(allowRiftEncounterAction(state, input)).toBe(true);
    const notebook: SemanticAction[] = [{ kind: 'close-panel' }, { kind: 'edit-personal-notes', text: 'Retain this observation.' },
      { kind: 'pin-objective', objectiveId: q('O12') }, { kind: 'highlight-map-room', roomId: state.runtime.game!.notebook.mapRoomIds[0]! }];
    for (const input of notebook) { expect(allowRiftEncounterAction(state, input)).toBe(false); expect(allowRiftEncounterAction(opened, input)).toBe(true); }
    const denied: SemanticAction[] = [{ kind: 'select-verb', verb: 'use' }, { kind: 'open-panel', panel: 'inventory' },
      { kind: 'interact', targetId: q('R04'), verb: 'walk', itemId: null }, { kind: 'interact', targetId: q('R12'), verb: 'walk', itemId: q('ITEM-inspection-kit') },
      { kind: 'interact', targetId: q('R12'), verb: 'look', itemId: null }, { kind: 'pin-hypothesis', text: 'An unbound hypothesis' },
      { kind: 'pin-objective', objectiveId: q('O13') }, { kind: 'highlight-map-room', roomId: q('R12') },
      { kind: 'inspect-evidence', evidenceId: q('FACT-O11-execution') }, { kind: 'request-objective-hint', objectiveId: q('O13') }];
    for (const input of denied) expect(allowRiftEncounterAction(opened, input)).toBe(false);
    expect(allowRiftEncounterAction(committed(true), { kind: 'interact', targetId: q('R11'), verb: 'walk', itemId: null })).toBe(false);
  });
  it('active repair UI admission shares exactly the domain policy and dies with its owning phase', () => {
    const state = committed(true);
    const allowed: SemanticAction[] = [{ kind: 'measure-repair-link' }, { kind: 'test-repair-endpoint' },
      { kind: 'choose-repair-plan', choiceId: q('ACTION-repair-read-classification') },
      { kind: 'classify-repair', selection: 'permanent', linkId: uuid(5), endpointId: uuid(6) }];
    for (const input of allowed) { expect(allowRiftEncounterAction(state, input)).toBe(true); expect(allowRiftEncounterAction(committed(), input)).toBe(false); }
    for (const input of [{ kind: 'review-repair-plan' }, { kind: 'choose-repair-plan', choiceId: q('ACTION-repair-plan-copper-section') },
      { kind: 'execute-repair-plan', reviewId: uuid(1), warningAcknowledged: true }] as SemanticAction[]) expect(allowRiftEncounterAction(state, input)).toBe(false);
    const ended = { ...state, runtime: { ...state.runtime, activity: { kind: 'cutscene' as const } } };
    expect(allowRiftEncounterAction(ended, { kind: 'open-panel', panel: 'notebook' })).toBe(false);
    expect(allowRiftEncounterAction(state, null as unknown as SemanticAction)).toBe(false);
  });
});

describe('T085 atomic preparation checkpoint and deliberate execution', () => {
  it.each(['copper', 'fiber', 'radio'] as const)('captures actual %s preparation before conventional-tool execution without an ally', route => {
    const f = fixture(route); f.prepare(); const before = f.state(), world = structuredClone(f.game().world);
    expect(world.activeAllyIds).toEqual([]);
    expect(f.bus.dispatch(f.action())).toMatchObject({ status: 'handled', message: expect.stringContaining('other exits stay closed') });
    expect(f.observed).toHaveLength(1);
    const next = f.state(); expect(next.runtime.checkpoint?.world).toEqual(world);
    expect(next.runtime.checkpoint?.world).not.toBe(before.runtime.game!.world);
    expect(next.runtime.checkpoint?.world.completedObjectiveIds).not.toContain(q('O11'));
    expect(next.runtime.game!.world.completedObjectiveIds).toContain(q('O11'));
    expect(next.runtime.game!.world.flags[repairFlags.executed]).toBe(route === 'copper' ? 'copper-section' : `${route}-A`);
    expect(next.runtime.activity?.kind).toBe('active-encounter');
    expect(next.runtime.persistence.dirtyGeneration).toBe(before.runtime.persistence.dirtyGeneration + 1);
    expect(next.runtime.persistence.knownSlot).toBe(before.runtime.persistence.knownSlot);
    expect(next.runtime.persistence.pendingRequest).toBe(before.runtime.persistence.pendingRequest);
  });
  it('preparing a plan performs no real CAS, saving or game mutation until commit', () => {
    const f = fixture(); f.prepare(); const before = f.state();
    const plan = createEncounterExecutionPlan({ registry, store: f.store, action: f.action(), before, message: 'Reviewed intervention.' });
    expect(plan.status).toBe('ready'); expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('the real save validator accepts preparation then refuses the atomic active result', () => {
    const f = fixture(); f.prepare();
    const validator = new SaveValidator([introductionSavePolicy(registry, authoredInput.world)]);
    expect(validator.validateRuntime(f.state().runtime).ok).toBe(true);
    f.bus.dispatch(f.action());
    expect(validator.validateRuntime(f.state().runtime)).toMatchObject({ ok: false, code: 'safe-state', path: '/activity' });
  });
  it('canceled bus action leaves world, journal, checkpoint, activity and persistence unchanged', () => {
    const f = fixture(); f.prepare(); const before = f.state(), action = f.action();
    expect(f.bus.cancel(action)).toBe(true); expect(f.bus.dispatch(action).reason).toBe('canceled');
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('duplicate delivery executes only once and cannot replace checkpoint with postexecution world', () => {
    const f = fixture(); f.prepare(); const action = f.action(); f.bus.dispatch(action); const next = f.state();
    f.bus.dispatch(action); expect(f.state()).toBe(next); expect(f.observed).toHaveLength(1);
    expect(f.bus.dispatch(f.action())).toMatchObject({ status: 'rejected', reason: 'no-preparation' });
    expect(f.state()).toBe(next);
  });
  it.each(['permanent', 'temporary', 'shutdown'] as const)('never recaptures %s execution after commitment', mode => {
    const f = fixture();
    f.prepare(mode === 'shutdown' ? 'shutdown' : 'copper-section', mode === 'temporary' ? 'temporary' : 'permanent');
    if (mode !== 'permanent') { f.choose(mode === 'shutdown' ? 'record-isolation' : 'record-maintenance'); f.review(); }
    expect(f.bus.dispatch(f.action()).status).toBe('handled'); const committed = f.state();
    expect(committed.runtime.activity?.kind).toBe('active-encounter');
    expect(f.bus.dispatch(f.action())).toMatchObject({ status: 'rejected', reason: 'no-preparation' });
    expect(f.state()).toBe(committed); expect(f.observed).toHaveLength(1);
  });
  it('rejects raw T077 postexecution state even when its activity is still safe-preparation', () => {
    const f = fixture(); f.prepare(); f.execute(); const before = f.state();
    expect(before.runtime.activity?.kind).toBe('safe-preparation');
    expect(f.bus.dispatch(f.action())).toMatchObject({ status: 'rejected', reason: 'no-preparation' });
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it.each(['stable-exploration', 'safe-continue', 'active-encounter', 'shutdown', 'terminal-failure', 'room-transition'] as const)('does not capture or execute during %s', kind => {
    const f = fixture(); f.prepare(); f.replace({ ...f.state(), runtime: { ...f.state().runtime, activity: { kind } as ActivityState } });
    const before = f.state(); expect(f.bus.dispatch(f.action()).status).toBe('rejected');
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('requires explicit acknowledgement and retains any earlier checkpoint on rejection', () => {
    const f = fixture(); f.prepare(); const before = f.state();
    expect(f.bus.dispatch(f.action(false)).status).toBe('rejected');
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('a stale review does not capture or execute a changed installation', () => {
    const f = fixture(); f.prepare(); f.choose('plan-copper-alternate'); const before = f.state();
    expect(f.bus.dispatch(f.action()).status).toBe('rejected');
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('failed final real CAS installs neither the checkpoint nor the intervention', () => {
    const f = fixture(); f.prepare(); const before = f.state(); f.denyCas();
    expect(f.bus.dispatch(f.action())).toMatchObject({ status: 'rejected', reason: 'state-replaced' });
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('rejects a prepared action after an equal-version runtime replacement', () => {
    const f = fixture(); f.prepare(); const before = f.state();
    const plan = createEncounterExecutionPlan({ registry, store: f.store, action: f.action(), before, message: 'Reviewed intervention.' });
    if (plan.status !== 'ready') throw new Error('Expected ready candidate');
    const replacement = structuredClone(before); f.replace(replacement);
    expect(plan.commit()).toMatchObject({ status: 'rejected', reason: 'state-replaced' });
    expect(f.state()).toBe(replacement); expect(f.observed).toEqual([]);
  });
  it('old projection is inert after bus invalidation at restore/account/new-run boundary', () => {
    const f = fixture(); f.prepare(); const capture = f.bus.captureScope(); f.bus.invalidate(); const before = f.state();
    expect(f.bus.dispatch(capture({ kind: 'execute-repair-plan', reviewId: uuid(1), warningAcknowledged: true })).reason).toBe('invalidated');
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('the adapter itself rejects mismatching action context and non-execution intent', () => {
    const f = fixture(); f.prepare(); const before = f.state(), action = f.action();
    for (const changed of [{ ...action, context: null }, { ...action, context: { ...action.context!, configurationRevision: action.context!.configurationRevision + 1 } },
      f.bus.capture({ kind: 'review-repair-plan' })] as CapturedAction[]) {
      expect(createEncounterExecutionPlan({ registry, store: f.store, action: changed, before, message: 'Reviewed intervention.' }).status).toBe('rejected');
    }
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
});
