// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Prepared location/data only; every activity operation uses the real capture/bus/controller/reducer/CAS.
import { readFileSync, writeFileSync } from 'node:fs';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import type { ContentRegistry } from '../../../../../../src/content/registry';
import { loadIntroductionContent, episodeNavigationEntries } from '../../../../../../src/app/content';
import { createIntroductionRuntime, restoreIntroduction, startIntroduction } from '../../../../../../src/app/adventure';
import { introductionSavePolicy } from '../../../../../../src/app/save-policy';
import { SaveValidator } from '../../../../../../src/services/save-validator';
import { captureSafeSnapshot } from '../../../../../../src/state/snapshot';
import { createNavigation } from '../../../../../../src/state/navigation';
import { createReducer, createReducerState, type ReducerState } from '../../../../../../src/state/reducer';
import { evaluateOptionalAnswer, optionalActivityDefinition, optionalEffectBindings } from '../../../../../../src/state/optional-activities';
import { createOptionalActivitiesController, type OptionalActivityIntent } from '../../../../../../src/ui/optional-activities';
import { createActionBus, contextFromRuntime } from '../../../../../../src/ui/action-bus';
import type { ActionId, ConfigurationRevision, QualifiedId, Quantity } from '../../../../../../src/domain/types';
import type { ClientGeneration, GameState, Measurement } from '../../../../../../src/state/types';
import canonical from '../../../../../../content/spec001/quests/SQ01.json' with { type: 'json' };

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const { registry, world } = loadIntroductionContent();
const definition = optionalActivityDefinition(registry, q('SQ01'))!;
const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });
const oracle = JSON.parse(readFileSync(new URL('../../../../../../tests/fixtures/optional-activities.json', import.meta.url), 'utf8')) as { cases: { id: string; inputs: any; expected: any }[] };
const expected = (suffix: string) => oracle.cases.find(c => c.id === `OPT-SQ01-${suffix}`)!.expected;
const cleanups: (() => void)[] = [];
const observations: Record<string, unknown> = {};
function fixture(options: { measurement?: boolean; retainedFact?: boolean; registry?: ContentRegistry } = {}) {
  const activeRegistry = options.registry ?? registry;
  const runtime = startIntroduction(createIntroductionRuntime(), activeRegistry), initial = runtime.game!;
  const sampleRevision = (options.measurement ? 8 : initial.world.configurationRevision) as ConfigurationRevision;
  const game: GameState = { ...initial, world: { ...initial.world, configurationRevision: sampleRevision, roomId: q('R04'), position: { safePositionId: q('R04.entry') },
    completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...initial.notebook, personalNotes: 'Keep this observation',
      factIds: options.retainedFact ? [q('FACT-SQ01-delivery')] : [],
      measurements: options.measurement ? [{ id: '00000000-0000-4000-8000-000000000108' as Measurement['id'], ruleId: q('PHY04'), subjectIds: [q('PR031')], roomId: q('R04'),
        configurationRevision: sampleRevision, attemptId: initial.world.attemptId, stale: false,
        readings: [{ name: 'Channel length', value: 95 as Quantity<'m'>, unit: 'm' }, { name: 'Inclusive maximum', value: 100 as Quantity<'m'>, unit: 'm' }, { name: 'Headroom', value: 5 as Quantity<'m'>, unit: 'm' }],
        conclusionCode: 'length-within-profile' }] : [] } };
  let state = createReducerState({ ...runtime, game }), commits = 0, denied = false;
  const reduce = createReducer({ registry: activeRegistry, bindings: optionalEffectBindings(definition) });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (denied || before !== state) return false; state = next; commits++; return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createOptionalActivitiesController({ registry: activeRegistry, store, bus, activityIds: [q('SQ01')] });
  cleanups.push(() => { controller.dispose(); bus.dispose(); });
  const send = (input: OptionalActivityIntent) => bus.dispatch(controller.project().capture(input));
  const sessionId = () => state.control.optionalActivity!.sessionId;
  return { bus, controller, store, send, state: () => state, game: () => state.runtime.game!, view: () => controller.project().view,
    commits: () => commits, replace: (next: ReducerState) => { state = next; }, deny: (value: boolean) => { denied = value; },
    start: () => send({ kind: 'start-optional', activityId: q('SQ01'), hotspotId: q('HOTSPOT-echo-serial-post') }),
    mode: (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: sessionId(), mode }),
    bits: (bits: string) => send({ kind: 'submit-optional', sessionId: sessionId(), bits }),
    simple: (kind: 'hint-optional' | 'explain-optional' | 'retry-optional' | 'exit-optional') => send({ kind, sessionId: sessionId() }), sessionId,
  };
}
function unchangedMain(game: GameState, before: GameState) {
  expect(game.world.inventory).toEqual(before.world.inventory);
  expect(game.world.completedObjectiveIds).toEqual(before.world.completedObjectiveIds);
  expect(game.world.route).toBe(before.world.route);
  expect(game.world.recruits).toEqual(before.world.recruits);
  expect(game.world.flags).toEqual(before.world.flags);
  expect(game.world.roomId).toBe(before.world.roomId);
  expect(game.world.position).toEqual(before.world.position);
}
function noPendingWrite(f: ReturnType<typeof fixture>) {
  expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  expect(f.state().runtime.persistence.lastAcknowledgement).toBeNull();
  expect(f.state().runtime.persistence.status).toBe('unsaved');
  expect(f.state().runtime.persistence.autosaveEnabled).toBe(false);
}
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); vi.useRealTimers(); });
afterAll(() => writeFileSync(new URL('./runtime-observations.json', import.meta.url), JSON.stringify({
  scope: 'Actual production module/controller/reducer operations on independently prepared guest states. No browser, network save, live provider, media or human acceptance.',
  observations,
}, null, 2) + '\n'));

describe('T096 actual SQ01 lifecycle against unchanged T092 cases', () => {
  it('OPT-SQ01-START shows instructions/practice/exit with no prerequisites, ally, reward or timer', () => {
    const f = fixture(), before = f.game(), e = expected('START');
    expect(f.start().status).toBe('handled');
    expect(f.view()!.instructions.length > 0).toBe(e.instructionsVisible);
    expect(Boolean(f.view()!.controls.practice)).toBe(e.practiceAvailable);
    expect(Boolean(f.view()!.controls.exit)).toBe(e.exitAvailable);
    expect(f.state().control.optionalActivity!.timingEnabled).toBe(e.timerRunning);
    expect(f.game().world.completedQuestIds.length).toBe(e.completionAward);
    unchangedMain(f.game(), before); expect(f.game().world.recruits).toEqual([]); noPendingWrite(f);
  });
  it('OPT-SQ01-PRACTICE records worked assistance and does not grant full delivery', () => {
    const f = fixture(), before = f.game(), e = expected('PRACTICE'); f.start(); f.mode('practice');
    expect(f.simple('explain-optional').status).toBe('handled'); expect(f.view()!.hintText).toBe(canonical.optionalActivity.practice.explanation);
    expect(f.bits('11').status).toBe('handled'); expect(f.view()!.feedback).toBe(canonical.optionalActivity.feedback.practice.correct);
    expect(f.game().assistance.some(h => h.objectiveId === q('SQ01') && h.level === 2)).toBe(e.assistanceRecorded);
    expect(f.game().world.completedQuestIds).toEqual([]); expect(f.view()!.completed).toBe(false);
    expect(Boolean(f.view()!.controls.retry)).toBe(e.retryAvailable); expect(Boolean(f.view()!.controls.exit)).toBe(e.exitAvailable);
    expect(f.state().control.optionalActivity!.timingEnabled).toBe(e.timerRunning); unchangedMain(f.game(), before);
  });
  it('OPT-SQ01-FINISH commits only the full delivery once and exposes an honest planned-image fallback', () => {
    const f = fixture(), before = f.game(), e = expected('FINISH'); f.start(); f.mode('delivery');
    const commits = f.commits(); expect(f.bits('00101101').status).toBe('handled'); expect(f.commits()).toBe(commits + 1);
    expect(f.view()!.completed).toBe(e.activityCompleted);
    expect(f.game().world.completedQuestIds.filter(id => id === q('SQ01')).length).toBe(e.benefitGrantCount);
    expect(f.game().notebook.factIds.filter(id => id === q('FACT-SQ01-delivery')).length).toBe(e.benefitGrantCount);
    expect(f.view()!.feedback).toBe(canonical.completionExplanation); expect(Boolean(f.view()!.controls.exit)).toBe(e.safeExitAvailable);
    expect(f.view()!.rewardText).toContain(canonical.optionalActivity.reward.unavailableText);
    expect(f.view()!.rewardText).not.toContain('http'); unchangedMain(f.game(), before); noPendingWrite(f);
    observations['OPT-SQ01-FINISH'] = { questCount: f.game().world.completedQuestIds.length, journalFactCount: f.game().notebook.factIds.length, rewardText: f.view()!.rewardText, mainProgressUnchanged: true };
  });
  it('OPT-SQ01-RETRY resets the actual attempt, keeps clues/notes/hints and stales its prepared measurement', () => {
    const f = fixture({ measurement: true, retainedFact: true }), before = f.game(), e = expected('RETRY');
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true); f.start(); f.simple('hint-optional'); f.mode('delivery'); f.bits('00011011');
    const attempted = f.game(), hints = structuredClone(attempted.assistance);
    expect(f.simple('retry-optional').status).toBe('handled');
    expect(f.view()).toMatchObject({ phase: 'instructions', mode: null, feedback: null, hintText: null });
    expect(f.game().notebook.personalNotes).toBe(e.personalNotes);
    expect(f.game().notebook.factIds).toEqual(before.notebook.factIds); expect(f.game().assistance).toEqual(hints);
    expect(f.game().world.attemptId).not.toBe(attempted.world.attemptId);
    expect(f.game().world.configurationRevision).toBeGreaterThan(attempted.world.configurationRevision);
    expect(f.game().world.configurationRevision).toBeGreaterThan(e.configurationRevisionGreaterThan);
    expect(f.game().notebook.measurements[0]).toEqual({ ...attempted.notebook.measurements[0], stale: true });
    expect(f.game().world.completedQuestIds).toEqual([]); expect(f.view()!.rewardText).toBeNull();
    expect(f.state().control.optionalActivity!.timingEnabled).toBe(e.timerRunning); unchangedMain(f.game(), before); noPendingWrite(f);
    observations['OPT-SQ01-RETRY'] = { currentAttemptChanged: true, revisionAdvanced: true, noteRetained: true, hintsRetained: hints.map(h => h.level), retainedFactGrantsReward: false, measurementStale: true,
      limitation: 'SQ01 does not change physical configuration. The changed-physical-attempt branch is verified separately by T100 shared recovery; this case uses a prepared current measurement.' };
  });
  it.each(['instructions', 'practice', 'solving', 'feedback'] as const)('OPT-SQ01-EXIT from actual %s returns at the same safe place and keeps the route reachable', phase => {
    const f = fixture({ measurement: true }), e = expected('EXIT'); f.start();
    if (phase === 'practice') f.mode('practice');
    if (phase === 'solving' || phase === 'feedback') f.mode('delivery');
    if (phase === 'feedback') f.bits('00011011');
    expect(f.view()!.phase).toBe(phase); const before = f.game();
    expect(f.simple('exit-optional').status).toBe('handled');
    expect(f.game()).toBe(before); expect(f.view()).toBeNull(); expect(f.state().control.optionalActivity).toBeNull();
    expect(f.state().runtime.activity?.kind).toBe('stable-exploration');
    expect(navigation.resolve(f.game().world, q('R03'), 'stable-exploration').ok).toBe(e.requiredRouteReachable);
    expect(navigation.canReachRoom(f.game().world, q('R02'))).toBe(true); expect(f.game().notebook.measurements[0]!.stale).toBe(false);
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true); noPendingWrite(f);
  });
  it('OPT-SQ01-SKIP leaves all required progress and the ordinary return route available', () => {
    const f = fixture(), before = f.state(), e = expected('SKIP'); f.controller.project();
    expect(f.state()).toBe(before); expect(f.view()).toBeNull();
    expect(navigation.resolve(f.game().world, q('R03'), 'stable-exploration').ok).toBe(e.requiredRouteReachable);
    expect(navigation.canReachRoom(f.game().world, q('R02'))).toBe(true); expect(canonical.requiredForMainStory).toBe(e.optionalBenefitRequired);
    noPendingWrite(f);
  });
  it('OPT-SQ01-REPLAY preserves one reward across duplicate callbacks, new action IDs and a later session', () => {
    const f = fixture(), e = expected('REPLAY'); f.start(); f.mode('delivery');
    const action = f.controller.project().capture({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' });
    expect(f.bus.dispatch(action).status).toBe('handled'); const completed = f.state(), commits = f.commits();
    expect(f.bus.dispatch(action).status).toBe('handled'); expect(f.state()).toBe(completed); expect(f.commits()).toBe(commits);
    f.bits('00101101'); f.simple('exit-optional'); f.start(); f.mode('delivery'); f.bits('00101101');
    expect(f.game().world.completedQuestIds.filter(id => id === q('SQ01')).length).toBe(e.benefitGrantCountAfter);
    expect(f.game().notebook.factIds.filter(id => id === q('FACT-SQ01-delivery')).length).toBe(e.benefitGrantCountAfter);
    expect(f.view()!.feedback).toBe(canonical.optionalActivity.feedback.alreadyCompleted);
    f.simple('explain-optional'); expect(f.view()!.hintText).toBe(canonical.completionExplanation);
  });
  it('OPT-SQ01-UNTIMED keeps thinking unlimited under an advanced test clock', () => {
    vi.useFakeTimers(); const f = fixture(), e = expected('UNTIMED'); f.start(); f.mode('delivery');
    expect(vi.getTimerCount()).toBe(0); vi.advanceTimersByTime(3_600_000);
    expect(f.state().control.optionalActivity!.timingEnabled).toBe(e.timerRunning);
    expect(f.view()!.phase).toBe('solving'); expect(f.bits('00101101').status).toBe('handled'); expect(f.view()!.completed).toBe(e.completionStillAvailable);
    observations['OPT-SQ01-UNTIMED'] = { timersScheduled: vi.getTimerCount(), fakeClockAdvancedSeconds: 3600, completionStillAvailable: true, limitation: 'Module fake clock only; an actual hidden-tab/browser wait remains T104.' };
  });
  it.each([
    ['DECODE', 'delivery', '00101101'], ['WRONG-ORDER', 'delivery', '00011011'], ['ONE-SYMBOL', 'practice', '11'],
  ] as const)('OPT-SQ01-%s agrees in actual evaluator result and actual controller state', (caseId, mode, bits) => {
    const f = fixture(), e = expected(caseId); f.start(); f.mode(mode);
    const result = evaluateOptionalAnswer(registry, definition, mode, { actionId: `sq01-${caseId}` as ActionId, expectedVersion: f.game().world, input: { bits } }, f.game());
    expect(result.evaluation.status).toBe(e.status);
    const observation: any = result.evaluation.observations[0]; expect(observation.expectedBits).toBe(e.bits ?? e.expectedBits);
    if (e.representedBits !== undefined) expect(observation.trace.representedBits).toBe(e.representedBits);
    if (e.symbolCount !== undefined) expect(observation.trace.symbols).toBe(e.symbolCount);
    expect(f.bits(bits).status).toBe('handled'); expect(f.state().control.optionalActivity!.result).toBe(e.status);
    expect(f.view()!.completed).toBe(caseId === 'DECODE');
    if (caseId !== 'DECODE') expect(f.game().notebook.factIds).toEqual([]);
    observations[`OPT-SQ01-${caseId}`] = { evaluation: result.evaluation, completed: f.view()!.completed, assistanceLevels: f.game().assistance.map(h => h.level) };
  });
});

describe('SQ01 actual captured-control and receipt boundaries', () => {
  it('keeps wrong/missing practice feedback in practice and invalid answers reward-free', () => {
    const f = fixture(); f.start(); f.mode('practice'); f.bits('00');
    expect(f.view()!.feedback).toBe(canonical.optionalActivity.feedback.practice.incorrect); expect(f.view()!.feedback).not.toContain('00101101');
    f.bits(''); expect(f.view()!.feedback).toBe(canonical.optionalActivity.feedback.practice.invalidInput);
    f.mode('delivery'); f.bits(''); expect(f.view()!.feedback).toBe(canonical.optionalActivity.feedback.delivery.invalidInput);
    expect(f.game().world.completedQuestIds).toEqual([]); expect(f.game().notebook.factIds).toEqual([]);
  });
  it('records method, worked and solution hints separately, deduplicates a repeated hint and keeps help after retry', () => {
    const f = fixture(); f.start();
    for (const hint of [canonical.hints.method, canonical.hints.workedStep, canonical.hints.solution]) {
      expect(f.simple('hint-optional').status).toBe('handled'); expect(f.view()!.hintText).toBe(hint.text);
    }
    expect(f.game().assistance.map(h => h.level)).toEqual([1, 2, 3]); const prior = f.game().assistance;
    f.simple('hint-optional'); expect(f.game().assistance).toEqual(prior); f.simple('retry-optional'); expect(f.game().assistance).toEqual(prior);
    f.mode('delivery'); f.bits('00101101'); expect(f.view()!.completed).toBe(true); expect(f.game().assistance).toEqual(prior);
  });
  it('records full-solution exposure after a wrong delivery and never labels practice as full completion', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.bits('00011011');
    expect(f.game().assistance).toMatchObject([{ objectiveId: q('SQ01'), hintId: q('HINT-SQ01-solution'), level: 3 }]);
    f.mode('practice'); f.bits('00101101'); expect(f.view()!.completed).toBe(false); expect(f.game().world.completedQuestIds).toEqual([]);
  });
  it('does not expose a reward for a retained learning fact without its quest receipt', () => {
    const f = fixture({ retainedFact: true }); f.start(); expect(f.view()!.rewardText).toBeNull();
    f.mode('delivery'); f.bits('00101101'); expect(f.view()!.completed).toBe(true);
    expect(f.game().notebook.factIds.filter(id => id === q('FACT-SQ01-delivery'))).toHaveLength(1);
  });
  it('retains reward once after post-success retry and a validated snapshot restore', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.bits('00101101'); f.simple('retry-optional');
    expect(f.view()!.completed).toBe(true); expect(f.view()!.rewardText).toBeTruthy(); f.simple('exit-optional');
    const captured = captureSafeSnapshot(f.state(), validator); expect(captured.ok, JSON.stringify(captured)).toBe(true); if (!captured.ok) return;
    const snapshot = JSON.parse(JSON.stringify(captured.capture.snapshot));
    f.controller.invalidate(); f.bus.invalidate(); f.replace(createReducerState(restoreIntroduction(f.state().runtime, snapshot)));
    f.start(); f.mode('delivery'); f.bits('00101101');
    expect(f.game().world.completedQuestIds).toEqual([q('SQ01')]); expect(f.game().notebook.factIds).toEqual([q('FACT-SQ01-delivery')]);
    expect(f.view()!.feedback).toBe(canonical.optionalActivity.feedback.alreadyCompleted);
    observations['snapshot-restore'] = { currentPolicyAccepted: true, restoredQuestReceiptCount: 1, restoredJournalFactCount: 1, limitation: 'In-memory validated snapshot reader only, not HTTP/storage/provider evidence.' };
  });
  it('rejects stale same-version mode captures and old exits after another session starts', () => {
    const f = fixture(); f.start();
    const staleMode = f.controller.project().capture({ kind: 'choose-optional-mode', sessionId: f.sessionId(), mode: 'delivery' });
    f.mode('practice'); const current = f.state(); expect(f.bus.dispatch(staleMode).status).toBe('rejected'); expect(f.state()).toBe(current);
    const oldExit = f.controller.project().capture({ kind: 'exit-optional', sessionId: f.sessionId() });
    f.simple('exit-optional'); f.start(); const later = f.state(); expect(f.bus.dispatch(oldExit).status).toBe('rejected'); expect(f.state()).toBe(later);
  });
  it('rejects equal-world account-generation replacement and cannot retire the replacement session', () => {
    const f = fixture(); f.start(); const old = f.controller.project().capture({ kind: 'exit-optional', sessionId: f.sessionId() });
    const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, auth: { ...s.runtime.auth, clientGeneration: 1 as ClientGeneration } } });
    const replaced = f.state(); expect(f.bus.dispatch(old).status).toBe('rejected'); f.controller.invalidate(); expect(f.state()).toBe(replaced);
    expect(f.view()).toBeNull();
  });
  it('keeps an owned safe exit after injected content loss without judging the learner or awarding anything', () => {
    let unavailable = false;
    const faulted: ContentRegistry = { ...registry, record: id => unavailable && id === q('SQ01') ? undefined : registry.record(id) };
    const f = fixture({ registry: faulted }); f.start(); f.mode('delivery'); const before = f.game(); unavailable = true;
    expect(f.bits('00101101').status).toBe('rejected'); expect(f.game()).toBe(before);
    expect(f.view()!.feedback).toContain('needs correction'); expect(f.view()!.controls.exit).toBeTruthy();
    expect(f.simple('exit-optional').status).toBe('handled'); expect(f.state().runtime.activity?.kind).toBe('stable-exploration');
    expect(f.game()).toBe(before); expect(f.game().world.completedQuestIds).toEqual([]); noPendingWrite(f);
  });
  it('refuses a delivery submitted before mode selection and a naked generic-bus capture', () => {
    const f = fixture(); f.start(); const initial = f.state();
    expect(f.bits('00101101').status).toBe('rejected'); expect(f.state()).toBe(initial);
    f.mode('delivery'); const ready = f.state();
    const bypass = f.bus.capture({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' });
    expect(f.bus.dispatch(bypass).status).toBe('rejected'); expect(f.state()).toBe(ready); expect(f.game().world.completedQuestIds).toEqual([]);
  });
  it('retains the live session when a reused retry attempt identity is rejected', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.bits('00011011'); const before = f.state(), game = f.game();
    const result = f.store.reduce(before, { actionId: 'reused-attempt' as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
      input: { kind: 'optional-activity', operation: { kind: 'retry', sessionId: f.sessionId(), nextAttemptId: game.world.attemptId } } });
    expect(result.status).toBe('rejected'); expect(result.state).toBe(before); expect(f.state()).toBe(before);
  });
  it.each(['start', 'answer', 'hint', 'retry', 'exit'])('failed %s compare-and-set preserves the complete prior state', step => {
    const f = fixture(); if (step !== 'start') { f.start(); f.mode('delivery'); }
    const before = f.state(); f.deny(true);
    const result = step === 'start' ? f.start() : step === 'answer' ? f.bits('00101101') : f.simple(step === 'hint' ? 'hint-optional' : step === 'retry' ? 'retry-optional' : 'exit-optional');
    expect(result.status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.game().world.completedQuestIds).toEqual([]); noPendingWrite(f);
  });
});
