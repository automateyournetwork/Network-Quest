// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { episodeNavigationEntries, loadIntroductionContent } from '../../src/app/content';
import { introductionBindings } from '../../src/app/introduction';
import { introductionSavePolicy } from '../../src/app/save-policy';
import type { QualifiedId, Route } from '../../src/domain/types';
import { SaveValidator } from '../../src/services/save-validator';
import { createNavigation } from '../../src/state/navigation';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../src/state/reducer';
import { createRepairScenarioResolver, repairEffectBindings, repairFlags } from '../../src/state/repair-plan';
import type { RepairScenario, RepairScenarioResolver } from '../../src/state/repair-plan';
import { allowRiftEncounterInput, isActiveRiftEncounter } from '../../src/state/rift-encounter';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import type { ActionPlan, CapturedAction, SemanticAction } from '../../src/ui/action-bus';
import { createDiagnosticsController } from '../../src/ui/diagnostics';
import { allowRiftEncounterAction, createEncounterClassificationPlan, createEncounterExecutionPlan, createRiftEncounterNavigation } from '../../src/ui/encounter';
import { createNotebookController } from '../../src/ui/notebook';
import { createRepairPlanController } from '../../src/ui/repair-plan';
import { createNavigationPlanner, createSceneObjectProjection } from '../../src/ui/scene-objects';
import { createVerbController } from '../../src/ui/verbs';
import notebookPresentation from '../../content/spec001/notebook-first-route.json';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const { registry, world } = loadIntroductionContent();
const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });
const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
const resolver = createRepairScenarioResolver(registry);
const branches = [
  { route: 'copper', objectives: ['O03', 'O04'], plan: 'copper-section' },
  { route: 'fiber', objectives: ['O05', 'O06'], plan: 'fiber-A' },
  { route: 'radio', objectives: ['O07', 'O08'], plan: 'radio-A' },
] as const;

/** Real canonical registry/controllers; branch/equipment completion is supplied
 * at R10. Every later action is actual captured intent. No browser/HTTP claim. */
function fixture(options: { route?: Route; admission?: (state: ReducerState, input: SemanticAction) => boolean;
  domainAdmission?: (state: ReducerState, input: ReducerInput) => boolean; outcomeScenario?: RepairScenarioResolver } = {}) {
  const branch = branches.find(b => b.route === (options.route ?? 'copper'))!;
  const runtime = startIntroduction(createIntroductionRuntime(), registry), initialGame = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...initialGame, world: { ...initialGame.world,
    roomId: q('R10'), position: { safePositionId: q('R10.entry') },
    completedObjectiveIds: ['O01', 'O02', ...branch.objectives, 'O09', 'O10'].map(id => q<'objective'>(id)),
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
    flags: { [q('FLAG-market-kit')]: 'compatible-kit-A', [q('FLAG-equipment-capability')]: '100/full',
      [q('FLAG-clock-method')]: 'step-and-decode', [q('FLAG-clock-role')]: 'physical-sampling-not-address-discovery',
      [q('FLAG-clock-bits-0')]: '00', [q('FLAG-clock-bits-1')]: '10', [q('FLAG-clock-bits-2')]: '11', [q('FLAG-clock-bits-3')]: '01' },
  }, notebook: { ...initialGame.notebook, mapRoomIds: [q('R01'), q('R02'), q('R10')], personalNotes: 'Before commitment.' } } });
  const admitted = options.admission ?? allowRiftEncounterAction;
  const reducerOptions = { registry, bindings: [...introductionBindings(registry).effects, ...repairEffectBindings(registry)], repairScenario: resolver,
    canReachRoom: navigation.canReachRoom, allowDuringEncounter: options.domainAdmission ?? allowRiftEncounterInput };
  const observed: ReducerState[] = [];
  let casAllowed = true;
  const store = { getState: () => state, reduce: createReducer(reducerOptions), compareAndSet(expected: ReducerState, next: ReducerState) {
    if (!casAllowed || state !== expected) return false; state = next; observed.push(next); return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const shared = { registry, store, bus, allowDuringEncounter: admitted };
  const notebook = createNotebookController({ ...shared, presentation: notebookPresentation });
  const diagnostics = createDiagnosticsController({ ...shared, resolveScenario: () => null });
  const outcomes = createOutcomeController({ registry, repairScenario: options.outcomeScenario ?? resolver });
  const repair = createRepairPlanController({ ...shared, resolveScenario: resolver,
    executePlan: (action: CapturedAction, before: ReducerState, message: string): ActionPlan => createEncounterExecutionPlan({ registry, store, action, before, message }),
    classifyPlan: (action, before, message) => createEncounterClassificationPlan({ controller: outcomes, store, action, before, message }) });
  const normalWalk = createNavigationPlanner({ navigation, store });
  const encounterNavigation = createRiftEncounterNavigation({ navigation, store });
  const verbs = createVerbController({ ...shared, bindings: introductionBindings(registry).hotspots,
    walk: (...args) => isActiveRiftEncounter(args[2]) ? encounterNavigation.plan(...args) : normalWalk(...args),
    panels: notebook.panels, sceneObjects: createSceneObjectProjection({ registry, navigation, resolveDuringEncounter: encounterNavigation.resolve }) });
  const send = (input: SemanticAction) => bus.dispatch(bus.capture(input));
  const walk = (room: string) => send({ kind: 'interact', verb: 'walk', targetId: q(room), itemId: null });
  const choose = (name: string) => send({ kind: 'choose-repair-plan', choiceId: q(`ACTION-repair-${name}`) });
  const prepare = (duration: 'permanent' | 'temporary' = 'permanent') => { expect(walk('R11').status).toBe('handled');
    for (const name of [`plan-${branch.plan}`, `duration-${duration}`, 'read-plan', ...(duration === 'temporary' ? ['record-maintenance'] : [])]) expect(choose(name).status).toBe('handled');
    expect(send({ kind: 'review-repair-plan' }).status).toBe('handled');
  };
  const execute = () => { const projection = repair.project(); expect(projection.view.reviewId).not.toBeNull();
    return bus.dispatch(projection.capture({ kind: 'execute-repair-plan', reviewId: projection.view.reviewId!, warningAcknowledged: true }));
  };
  return { store, observed, bus, notebook, diagnostics, repair, outcomes, verbs, send, walk, choose, prepare, execute,
    denyCas: () => { casAllowed = false; }, replace: (next: ReducerState) => { state = next; },
    dispose: () => { verbs.dispose(); repair.dispose(); diagnostics.dispose(); notebook.dispose(); bus.dispose(); } };
}

describe('T085 actual action-bus/controller/reducer encounter join', () => {
  it.each(branches)('$route commits once with the precommit checkpoint and no observable safe committed state', branch => {
    const f = fixture({ route: branch.route }); f.prepare(); const before = f.store.getState(), oldCount = f.observed.length;
    expect(captureSafeSnapshot(before, validator).ok).toBe(true);
    expect(f.execute().status).toBe('handled'); const next = f.store.getState();
    expect(f.observed).toHaveLength(oldCount + 1);
    expect(next.runtime.activity?.kind).toBe('active-encounter');
    expect(next.runtime.checkpoint?.world).toEqual(before.runtime.game!.world);
    expect(next.runtime.checkpoint?.world.completedObjectiveIds).not.toContain(q('O11'));
    expect(next.runtime.game!.world.flags[repairFlags.executed]).toBe(branch.plan);
    expect(captureSafeSnapshot(next, validator)).toMatchObject({ ok: false, code: 'safe-state' });
    expect(validator.validateRuntime(next.runtime)).toMatchObject({ ok: false, code: 'safe-state', path: '/activity' });
    f.dispose();
  });
  it('notes, prior/current hints, objective pins and evidence-map controls stay available without completing O12 or changing the checkpoint', () => {
    const f = fixture(); f.prepare(); f.execute(); const checkpoint = f.store.getState().runtime.checkpoint;
    expect(f.send({ kind: 'open-panel', panel: 'notebook' }).status).toBe('handled');
    expect(f.send({ kind: 'edit-personal-notes', text: 'Keep the new observation; the earlier reading is stale.' }).status).toBe('handled');
    expect(f.send({ kind: 'pin-objective', objectiveId: q('O12') }).status).toBe('handled');
    expect(f.send({ kind: 'highlight-map-room', roomId: q('R10') }).status).toBe('handled');
    for (const id of ['O03', 'O11', 'O12']) expect(f.send({ kind: 'request-objective-hint', objectiveId: q(id) }).status).toBe('handled');
    const state = f.store.getState(), view = f.notebook.project().view;
    expect(view.personalNotes).toContain('new observation'); expect(view.highlightedRoomId).toBe(q('R10'));
    expect(view.objectives.find(o => o.id === q('O12'))?.pinned).toBe(true);
    expect(state.runtime.activity?.kind).toBe('active-encounter'); expect(state.runtime.checkpoint).toBe(checkpoint);
    expect(state.runtime.game!.world.completedObjectiveIds).not.toContain(q('O12')); expect(state.runtime.game!.assistance).toHaveLength(3);
    expect(f.diagnostics.project(q('O12')).view.hints).toHaveLength(1);
    expect(f.send({ kind: 'close-panel' }).status).toBe('handled'); f.dispose();
  });
  it('the real controller rejects other exits, plan edits, unsupported verbs and generic objective rewards after commitment', () => {
    const f = fixture(); f.prepare(); f.execute(); const before = f.store.getState();
    for (const input of [
      { kind: 'interact', verb: 'walk', targetId: q('R04'), itemId: null },
      { kind: 'choose-repair-plan', choiceId: q('ACTION-repair-plan-copper-alternate') },
      { kind: 'review-repair-plan' }, { kind: 'select-verb', verb: 'use' }, { kind: 'open-panel', panel: 'inventory' },
      { kind: 'submit-objective', objectiveId: q('O11'), alternativeId: q('ACTION-O11-copper'), measurementId: before.runtime.game!.notebook.measurements[0]!.id },
    ] as SemanticAction[]) expect(f.send(input).status).not.toBe('handled');
    expect(f.store.getState()).toBe(before); f.dispose();
  });
  it('canceled captured execution and failed real CAS leave the entire preparation state intact', () => {
    const f = fixture(); f.prepare(); const before = f.store.getState(), view = f.repair.project();
    const action = view.capture({ kind: 'execute-repair-plan', reviewId: view.view.reviewId!, warningAcknowledged: true });
    f.bus.cancel(action); expect(f.bus.dispatch(action).reason).toBe('canceled'); expect(f.store.getState()).toBe(before);
    f.denyCas(); expect(f.execute().status).toBe('rejected'); expect(f.store.getState()).toBe(before); f.dispose();
  });
  it('actual R11→R12 navigation and fresh link/endpoint proofs never expose a safe committed state', () => {
    const f = fixture(); f.prepare(); const start = f.observed.length; f.execute();
    const checkpoint = f.store.getState().runtime.checkpoint;
    const exit = f.verbs.objects().find(object => object.id === 'exit:spec001:R11:spec001:R12');
    expect(exit?.actions[0]?.unavailableReason).toBeUndefined();
    expect(f.send({ kind: 'select-verb', verb: 'walk' }).status).toBe('handled');
    const beforeWalk = f.observed.length; expect(f.walk('R12').status).toBe('handled');
    expect(f.observed).toHaveLength(beforeWalk + 1);
    expect(f.store.getState().runtime.game!.world.position.safePositionId).toBe(q('R12.entry'));
    expect(f.choose('read-classification').status).toBe('handled');
    expect(f.send({ kind: 'measure-repair-link' }).status).toBe('handled');
    expect(f.send({ kind: 'test-repair-endpoint' }).status).toBe('handled');
    const view = f.repair.project().view;
    expect(view.available).toBe(true); expect(view.linkId).not.toBeNull(); expect(view.endpointId).not.toBeNull();
    expect(f.store.getState().runtime.game!.notebook.mapRoomIds).toContain(q('R12'));
    expect(f.observed.slice(start).every(state => state.runtime.activity?.kind === 'active-encounter')).toBe(true);
    expect(f.observed.slice(start).every(state => !captureSafeSnapshot(state, validator).ok && !validator.validateRuntime(state.runtime).ok)).toBe(true);
    expect(f.store.getState().runtime.checkpoint).toBe(checkpoint);
    const beforeReturn = f.store.getState(); expect(f.walk('R11').status).not.toBe('handled'); expect(f.store.getState()).toBe(beforeReturn);
    f.dispose();
  });
  it.each(['deny', 'throw', 'truthy'] as const)('active controller admission fails closed on %s without altering generic playable behavior', mode => {
    const admission = mode === 'deny' ? () => false : mode === 'throw' ? () => { throw new Error('Closed callback'); } : () => 1 as unknown as boolean;
    const f = fixture({ admission }); f.prepare(); f.execute(); const before = f.store.getState();
    expect(f.send({ kind: 'open-panel', panel: 'notebook' }).status).not.toBe('handled');
    expect(f.send({ kind: 'request-objective-hint', objectiveId: q('O12') }).status).not.toBe('handled');
    expect(f.store.getState()).toBe(before); f.dispose();
  });
  it.each(['deny', 'throw', 'truthy'] as const)('active reducer admission fails closed on %s after real UI admission', mode => {
    const domainAdmission = mode === 'deny' ? () => false : mode === 'throw' ? () => { throw new Error('Closed callback'); } : () => 1 as unknown as boolean;
    const f = fixture({ domainAdmission }); f.prepare(); f.execute();
    expect(f.send({ kind: 'open-panel', panel: 'notebook' }).status).toBe('handled'); const before = f.store.getState();
    expect(f.send({ kind: 'edit-personal-notes', text: 'Must not commit.' }).status).toBe('rejected');
    expect(f.send({ kind: 'request-objective-hint', objectiveId: q('O12') }).status).toBe('rejected');
    expect(f.store.getState()).toBe(before); f.dispose();
  });
  it.each(['permanent', 'temporary'] as const)('%s outcome Continue then ordinary walk remains saveable and preserves history', selection => {
    const f = fixture(); f.prepare(selection); f.execute(); expect(f.walk('R12').status).toBe('handled');
    f.choose('read-classification'); f.send({ kind: 'measure-repair-link' }); f.send({ kind: 'test-repair-endpoint' });
    const view = f.repair.project().view;
    expect(f.send({ kind: 'classify-repair', selection, linkId: view.linkId, endpointId: view.endpointId }).status).toBe('handled');
    const classified = f.store.getState(); expect(classified.runtime.activity?.kind).toBe('cutscene');
    expect(captureSafeSnapshot(classified, validator).ok).toBe(false);
    const dismissal = f.outcomes.prepareDismissal(classified, captureOutcomeContext(classified)!);
    if (!dismissal.ok) throw new Error(`Owned dismissal failed: ${dismissal.reason}`);
    expect(f.outcomes.commit(f.store, dismissal.change).ok).toBe(true);
    const continued = f.store.getState(); expect(continued.runtime.game!.world.continueOutcome).toBe(selection === 'permanent' ? 'E01' : 'E02');
    expect(captureSafeSnapshot(continued, validator).ok).toBe(true);
    expect(f.walk('R11').status).toBe('handled'); const returned = f.store.getState();
    expect(returned.runtime.activity?.kind).toBe('safe-preparation'); expect(returned.runtime.game!.world.continueOutcome).toBeNull();
    expect(returned.runtime.game!.outcomeHistory).toEqual(continued.runtime.game!.outcomeHistory);
    expect(returned.runtime.game!.world.flags[repairFlags.classification]).toBe(selection);
    expect(returned.runtime.game!.world.completedObjectiveIds).toContain(q('O12'));
    expect(captureSafeSnapshot(returned, validator).ok).toBe(true); f.dispose();
  });
  it('a link-only classification identifies the missing separate endpoint proof and preserves current memory', () => {
    const f = fixture(); f.prepare(); f.execute(); f.walk('R12'); f.choose('read-classification'); f.send({ kind: 'measure-repair-link' });
    const before = f.store.getState(), view = f.repair.project().view;
    const result = f.send({ kind: 'classify-repair', selection: 'permanent', linkId: view.linkId, endpointId: null });
    expect(result).toMatchObject({ status: 'rejected', message: expect.stringContaining('separate endpoint test') });
    expect(f.store.getState()).toBe(before); f.dispose();
  });
  it('temporary-as-permanent classification explains the remaining temporary dependency', () => {
    const f = fixture(); f.prepare('temporary'); f.execute(); f.walk('R12'); f.choose('read-classification');
    f.send({ kind: 'measure-repair-link' }); f.send({ kind: 'test-repair-endpoint' });
    const before = f.store.getState(), view = f.repair.project().view;
    expect(f.send({ kind: 'classify-repair', selection: 'permanent', linkId: view.linkId, endpointId: view.endpointId }))
      .toMatchObject({ status: 'rejected', message: expect.stringContaining('temporary dependency remains') });
    expect(f.store.getState()).toBe(before); f.dispose();
  });
  it('malformed authored scenario is explained as content error with no learner penalty and sampled once', () => {
    let samples = 0;
    const f = fixture({ outcomeScenario: (game, plan) => { samples++; return { ...resolver(game, plan)!, endpointResponse: 'unsupported-content' } as unknown as RepairScenario; } });
    f.prepare(); f.execute(); f.walk('R12'); f.choose('read-classification');
    f.send({ kind: 'measure-repair-link' }); f.send({ kind: 'test-repair-endpoint' });
    const before = f.store.getState(), view = f.repair.project().view;
    expect(f.send({ kind: 'classify-repair', selection: 'permanent', linkId: view.linkId, endpointId: view.endpointId }))
      .toMatchObject({ status: 'rejected', reason: 'content-error', message: expect.stringContaining('content error. No progress or penalty') });
    expect(samples).toBe(1); expect(f.store.getState()).toBe(before); f.dispose();
  });
});
