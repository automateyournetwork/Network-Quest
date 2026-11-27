// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual current loader/controller/bus/reducer. Initial locations are prepared fixtures.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { loadIntroductionContent } from '../../../../../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../../../../../src/app/adventure';
import { introductionSavePolicy } from '../../../../../../src/app/save-policy';
import { createReducer, createReducerState, type ReducerState, type ReducerInput } from '../../../../../../src/state/reducer';
import { optionalActivityDefinition, optionalEffectBindings, optionalActivityCompleted, evaluateOptionalAnswer } from '../../../../../../src/state/optional-activities';
import { createOptionalActivitiesController, type OptionalActivityIntent } from '../../../../../../src/ui/optional-activities';
import { createActionBus, contextFromRuntime, copySemanticAction } from '../../../../../../src/ui/action-bus';
import { captureSafeSnapshot } from '../../../../../../src/state/snapshot';
import { SaveValidator } from '../../../../../../src/services/save-validator';
import { validateContent, type ContentRegistry } from '../../../../../../src/content/registry';
import { fiberEffectBindings, createFiberScenarioResolver, prepareFiberAction } from '../../../../../../src/state/fiber-scenario';
import { objectiveEffectBindings } from '../../../../../../src/state/objectives';
import { evaluateBenchAnswer } from '../../../../../../src/state/optional-optical-bench';
import type { ActionId, MeasurementId, QualifiedId } from '../../../../../../src/domain/types';
import type { ClientGeneration } from '../../../../../../src/state/types';
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const json = (path: string): any => JSON.parse(readFileSync(new URL(`../../../../../../${path}`, import.meta.url), 'utf8'));
const { registry, world } = loadIntroductionContent();
const definition = optionalActivityDefinition(registry, q('MG02'))!;
const definitions = ['SQ01', 'SQ02', 'MG01', 'MG02'].map(id => optionalActivityDefinition(registry, q(id))!);
const policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
const expected = (id: string) => json('tests/fixtures/optional-activities.json').cases.find((c: any) => c.id === id).expected;
const answer = (receive = -13, margin = 1, reserve: 'met' | 'shortfall' = 'shortfall', overload: 'overloaded' | 'not-overloaded' = 'not-overloaded') => ({ receive: { value: receive, unit: 'dBm' as const }, margin: { value: margin, unit: 'dB' as const }, reserve, overload });
function fixture(completeO06 = true) {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), original = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...original, world: { ...original.world,
    roomId: q('R06'), position: { safePositionId: q('R06.entry') }, completedObjectiveIds: [q('O01'), q('O02'), ...(completeO06 ? [q<'objective'>('O05'), q<'objective'>('O06')] : [])],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] }, notebook: { ...original.notebook, personalNotes: 'Keep this observation' } } });
  let blocked = false, commits = 0, corrupt = false;
  const proxy: ContentRegistry = { ...registry, record: id => {
    const record = registry.record(id); if (!corrupt || id !== q('MG02')) return record;
    const clone: any = structuredClone(record); clone.optionalActivity.delivery.loss.value = 9; return clone;
  } };
  const resolver = createFiberScenarioResolver(proxy);
  const reduce = createReducer({ registry: proxy, bindings: [...definitions.flatMap(optionalEffectBindings), ...objectiveEffectBindings(proxy), ...fiberEffectBindings(proxy)], objectiveScenario: resolver });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) { if (blocked || before !== state) return false; state = next; commits++; return true; } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createOptionalActivitiesController({ registry: proxy, store, bus, activityIds: [q('MG01'), q('MG02'), q('MG03')] });
  const send = (input: OptionalActivityIntent) => bus.dispatch(controller.project().capture(input));
  const start = () => send({ kind: 'start-optional', activityId: q('MG02'), hotspotId: q('HOTSPOT-fiber-r06-pr059') });
  const sessionId = () => state.control.optionalActivity!.sessionId;
  const mode = (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: sessionId(), mode });
  const diagnose = (value = answer()) => send({ kind: 'submit-optional-optics', sessionId: sessionId(), answer: value });
  const simple = (kind: 'hint-optional' | 'explain-optional' | 'boundary-optional' | 'compatibility-optional' | 'retry-optional' | 'exit-optional') => send({ kind, sessionId: sessionId() });
  const command = (input: ReducerInput) => { const game = state.runtime.game!; const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input }); expect(result.status, result.reason).not.toBe('rejected'); state = result.state; return result; };
  return { store, bus, controller, send, start, sessionId, mode, diagnose, simple, command, resolver, state: () => state, commits: () => commits,
    block: (v: boolean) => { blocked = v; }, corrupt: () => { corrupt = true; }, replace: (v: ReducerState) => { state = v; } };
}
function finish(f: ReturnType<typeof fixture>) { f.start(); f.mode('delivery'); expect(f.diagnose().status).toBe('handled'); }
function proveFiber(f: ReturnType<typeof fixture>, path: 'A' | 'B', submitO06 = true) {
  const move = (room: 'R05' | 'R06') => f.command({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'prepared-walk', observations: [], acceptedEffects: [] }, destination: { roomId: q(room), safePositionId: q(`${room}.entry`), activity: 'stable-exploration' } });
  const choose = (id: string) => f.command({ kind: 'apply', evaluation: prepareFiberAction(registry, f.state().runtime.game!, q(`ACTION-fiber-${id}`)) });
  const measure = (id: 'O05' | 'O06', submit = true) => { const scenario = f.resolver(f.state().runtime.game!, q(id))!; const measurement = crypto.randomUUID() as MeasurementId;
    f.command({ kind: 'objective', operation: { kind: 'measure', objectiveId: q(id), alternativeId: scenario.alternativeId, id: measurement } });
    if (submit) f.command({ kind: 'objective', operation: { kind: 'submit', objectiveId: q(id), alternativeId: scenario.alternativeId, measurementId: measurement } }); };
  move('R05'); for (const id of ['read-matching', 'profile-matched', 'inspect-before', 'clean', 'reinspect-clean']) choose(id);
  measure('O05'); move('R06'); choose('read-compatibility'); choose(`path-${path}`); measure('O06', submitO06);
}

describe('MG02 actual lifecycle and immutable T092 boundaries', () => {
  it('OPT-MG02-START / LOCKED: renders the unlock explanation and enforces the real O06 admission', () => {
    const f = fixture(false); expect(f.controller.project().entries[0]).toMatchObject({ available: false, unavailableReason: 'Complete the Prism Vault fiber verification to unlock this optional bench.' });
    const before = f.state(); expect(f.start().status).toBe('rejected'); expect(f.state()).toBe(before);
    const ready = fixture(); expect(ready.start().status).toBe('handled'); expect(ready.controller.project().view).toMatchObject({ title: 'Prism Budget Bench', phase: 'instructions', answerKind: 'optics', completed: false });
    expect(ready.state().control.optionalActivity?.timingEnabled).toBe(expected('OPT-MG02-START').timerRunning);
    expect(ready.controller.project().view?.controls.practice).toBeTruthy(); expect(ready.controller.project().view?.controls.exit).toBeTruthy();
  });
  it('OPT-MG02-PRACTICE uses T04, records worked help and cannot complete the full card', () => {
    const f = fixture(); f.start(); const before = f.state().runtime.game!.world; f.mode('practice'); f.diagnose(answer(-11, 3, 'met'));
    expect(f.state().runtime.game!.world).toEqual(before); expect(f.controller.project().view?.feedback).toContain('3 dB margin');
    expect(f.controller.project().view?.completed).toBe(false); expect(f.state().runtime.game!.assistance).toMatchObject([{ objectiveId: q('MG02'), hintId: q('HINT-MG02-step'), level: 2 }]);
  });
  it('OPT-MG02-FINISH preserves the failing physical verdict and awards only its exact depth receipt', () => {
    const f = fixture(), before = f.state().runtime.game!.world; finish(f); const game = f.state().runtime.game!;
    expect(game.world).toEqual({ ...before, achievementIds: [q('ACHIEVEMENT-MG02-complete')] });
    expect(game.notebook.factIds).toEqual([q('FACT-MG02-completion')]); expect(f.controller.project().view?.feedback).toContain('reserve fails, overload is absent');
    expect(f.controller.project().view?.rewardText).toBeNull(); expect(optionalActivityCompleted(registry, definition, game)).toBe(true);
    const evaluated = evaluateOptionalAnswer(registry, definition, 'delivery', { actionId: 'verify-physical' as ActionId, expectedVersion: game.world, input: answer() }, game);
    expect(evaluated.evaluation).toMatchObject({ status: 'correct', acceptedEffects: [], observations: [{ physicalStatus: 'incorrect', repaired: false }] });
    expect(expected('OPT-MG02-FINISH')).toMatchObject({ optionalBenefit: 'optional-optical-depth', mainObjectiveAward: 0 });
  });
  it('OPT-MG02-RETRY keeps notes/help/clues, restores entry equipment and stales actual O06 measurements', () => {
    const f = fixture(false); proveFiber(f, 'A'); f.start(); const entry = f.state().control.optionalActivity!.preparation;
    f.mode('delivery'); f.diagnose(answer(-13, 1, 'met')); const before = f.state().runtime.game!;
    // Exercise the T092 changed-configuration recovery boundary in a prepared
    // state; the production optical diagnosis itself never mutates equipment.
    const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...before, world: { ...before.world, inventory: [], flags: { ...before.world.flags, [q<'flag'>('FLAG-fiber-path')]: 'high-loss' } } } } });
    expect(f.simple('retry-optional').status).toBe('handled'); const after = f.state().runtime.game!;
    expect(after.world.flags).toEqual(entry.flags); expect(after.world.inventory).toEqual(entry.inventory); expect(after.world.attemptId).not.toBe(before.world.attemptId);
    expect(after.world.configurationRevision).toBeGreaterThan(before.world.configurationRevision); expect(after.notebook.measurements.length).toBeGreaterThan(0); expect(after.notebook.measurements.every(m => m.stale)).toBe(true);
    expect(after.notebook.factIds).toEqual(before.notebook.factIds); expect(after.notebook.personalNotes).toBe(expected('OPT-MG02-RETRY').personalNotes); expect(after.assistance).toEqual(before.assistance);
    expect(after.world.achievementIds).toEqual([]); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it.each(['instructions', 'practice', 'solving', 'feedback', 'completed'] as const)('OPT-MG02-EXIT safely closes %s', phase => {
    const f = fixture(); f.start(); if (phase !== 'instructions') f.mode(phase === 'practice' ? 'practice' : 'delivery');
    if (phase === 'feedback') f.diagnose(answer(-11, 3, 'met')); if (phase === 'completed') f.diagnose();
    const game = f.state().runtime.game; expect(f.simple('exit-optional').status).toBe('handled'); expect(f.state().runtime.game).toBe(game);
    expect(f.controller.project().view).toBeNull(); expect(f.state().runtime.activity?.kind).toBe('stable-exploration'); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it.each(['A', 'B'] as const)('OPT-MG02-SKIP: actual fiber path %s completes with no bench/ally/reward', path => {
    const f = fixture(false); proveFiber(f, path); expect(f.state().runtime.game!.world.completedObjectiveIds).toContain(q('O06'));
    expect(f.state().runtime.game!.world.achievementIds).toEqual([]); expect(f.state().runtime.game!.world.recruits).toEqual([]); expect(f.state().control.optionalActivity).toBeNull();
    expect(f.controller.project().entries[0]?.available).toBe(true);
  });
  it('OPT-MG02-REPLAY deduplicates captured/new answers, Retry and reconstructed sessions', () => {
    const f = fixture(); f.start(); f.mode('delivery'); const captured = f.controller.project().capture({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: answer() });
    f.bus.dispatch(captured); const state = f.state(), commits = f.commits(); expect(f.bus.dispatch(captured).status).toBe('handled'); expect(f.state()).toBe(state); expect(f.commits()).toBe(commits);
    f.diagnose(); f.simple('retry-optional'); f.mode('delivery'); f.diagnose(); f.simple('exit-optional');
    f.replace(createReducerState(structuredClone(f.state().runtime))); f.start(); f.mode('delivery'); f.diagnose();
    expect(f.state().runtime.game!.world.achievementIds).toEqual([q('ACHIEVEMENT-MG02-complete')]); expect(f.state().runtime.game!.notebook.factIds.filter(id => id === q('FACT-MG02-completion'))).toHaveLength(1);
    expect(f.controller.project().view?.feedback).toBe(definition.optionalActivity.feedback.alreadyCompleted);
  });
  it('OPT-MG02-UNTIMED never fails from elapsed time', () => {
    vi.useFakeTimers(); try { const f = fixture(); f.start(); vi.advanceTimersByTime(3600000); f.mode('delivery'); f.diagnose(); expect(f.controller.project().view?.completed).toBe(true); expect(f.state().control.optionalActivity?.timingEnabled).toBe(false); } finally { vi.useRealTimers(); }
  });
});

describe('MG02 actual controller validation, assistance, captures and save-v1', () => {
  it.each([answer(-11), answer(-13, 3), answer(-13, 1, 'met'), answer(-13, 1, 'shortfall', 'overloaded'), answer(-13, -1)])('wrong diagnosis %j records corrective full-answer help without repair/completion', value => {
    const f = fixture(); f.start(); f.mode('delivery'); const before = f.state().runtime.game!.world; f.diagnose(value);
    expect(f.state().control.optionalActivity?.result).toBe('incorrect'); expect(f.state().runtime.game!.world).toEqual(before);
    expect(f.state().runtime.game!.assistance.at(-1)).toMatchObject({ objectiveId: q('MG02'), hintId: q('HINT-MG02-solution'), level: 3 }); f.diagnose(); expect(f.controller.project().view?.completed).toBe(true);
  });
  it('empty input is nonpunitive and wrong-variant submit is rejected', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.send({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: null });
    expect(f.state().control.optionalActivity?.result).toBe('invalid-input'); expect(f.state().runtime.game!.assistance).toEqual([]);
    expect(f.send({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' }).status).toBe('rejected'); expect(f.state().runtime.game!.world.achievementIds).toEqual([]);
  });
  it('actual T15 boundary and exact compatibility cards disclose assistance without a reward', () => {
    const f = fixture(); f.start(); f.simple('boundary-optional'); expect(f.controller.project().view?.hintText).toContain('exactly 2 dB');
    f.simple('compatibility-optional'); expect(f.controller.project().view?.hintText).toContain('wavelength direction does not match');
    expect(f.controller.project().view?.hintText).toContain('inspection status'); expect(f.state().runtime.game!.world.achievementIds).toEqual([]);
    expect(f.state().runtime.game!.assistance).toMatchObject([{ objectiveId: q('MG02'), level: 2 }]);
    f.simple('explain-optional'); expect(f.controller.project().view?.hintText).toBe(definition.hints.solution.text); expect(f.controller.project().view?.completed).toBe(false);
  });
  it('assistance capacity blocks showing a new worked answer atomically', () => {
    const f = fixture(); f.start(); const s = f.state(), g = s.runtime.game!;
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...g, assistance: Array.from({ length: 2048 }, () => ({ objectiveId: q('O06'), hintId: q('HINT-O06-method'), level: 1 as const, attemptId: g.world.attemptId })) } } });
    const before = f.state(); expect(f.simple('boundary-optional').status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.controller.project().view?.hintText).toBeNull();
  });
  it('invalid author data precedes missing answers and still permits matching exit', () => {
    const f = fixture(); f.start(); f.mode('delivery'); const broken: any = structuredClone(definition); broken.optionalActivity.delivery.loss.value = 9;
    expect(evaluateOptionalAnswer(registry, broken, 'delivery', { actionId: 'bad' as ActionId, expectedVersion: f.state().runtime.game!.world, input: null }, f.state().runtime.game!).evaluation.status).toBe('content-error');
    f.corrupt(); const before = f.state(); expect(f.diagnose().status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.simple('exit-optional').status).toBe('handled');
  });
  it.each(['start', 'answer', 'hint', 'boundary', 'compatibility', 'retry', 'exit'])('failed %s CAS installs no partial state', step => {
    const f = fixture(); if (step !== 'start') { f.start(); f.mode('delivery'); } const before = f.state(); f.block(true);
    const result = step === 'start' ? f.start() : step === 'answer' ? f.diagnose() : f.simple(`${step}-optional` as 'hint-optional'); expect(result.status).toBe('rejected'); expect(f.state()).toBe(before);
  });
  it.each(['mode', 'retry', 'exit', 'account', 'restore', 'adventure'])('rejects old captured answers after %s', change => {
    const f = fixture(); f.start(); f.mode('delivery'); const old = f.controller.project().capture({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: answer() });
    if (change === 'mode') f.mode('practice'); if (change === 'retry') f.simple('retry-optional'); if (change === 'exit') f.simple('exit-optional');
    if (change === 'account') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, auth: { ...s.runtime.auth, clientGeneration: (s.runtime.auth.clientGeneration + 1) as ClientGeneration } } }); }
    if (change === 'restore') f.replace(createReducerState(structuredClone(f.state().runtime)));
    if (change === 'adventure') f.replace(createReducerState(startIntroduction(createIntroductionRuntime(), registry)));
    const current = f.state(); expect(f.bus.dispatch(old).status).toBe('rejected'); expect(f.state()).toBe(current);
  });
  it.each([{ status: 'correct' }, { effects: [] }, { context: {} }, { score: 1 }, { profile: {} }])('rejects caller authority %j at the captured bus boundary', extra => {
    const f = fixture(); f.start(); expect(() => copySemanticAction({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: { ...answer(), ...extra } } as never)).toThrow();
  });
  it.each([NaN, Infinity, -129, 129, '-13'])('rejects malformed/unbounded numeric %j', value => {
    const f = fixture(); f.start(); expect(() => copySemanticAction({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: { ...answer(), receive: { value, unit: 'dBm' } } } as never)).toThrow();
  });
  it('deep-copies closed numeric answers and rejects enum coercion', () => {
    const f = fixture(); f.start(); const value = answer(); const copied = copySemanticAction({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: value }); value.receive.value = 0;
    expect(copied).toMatchObject({ answer: { receive: { value: -13 } } });
    expect(() => copySemanticAction({ kind: 'submit-optional-optics', sessionId: f.sessionId(), answer: { ...answer(), reserve: { toString: () => 'shortfall' } } } as never)).toThrow();
  });
  it('controller invalidation closes only its own session and retires old callbacks', () => {
    const f = fixture(); f.start(); const old = f.controller.project().capture({ kind: 'exit-optional', sessionId: f.sessionId() }); f.controller.invalidate();
    expect(f.state().control.optionalActivity).toBeNull(); expect(f.bus.dispatch(old).status).toBe('rejected');
  });
  it('accepted completion preserves only its receipt in Retry preparation, not later equipment/progress', () => {
    const f = fixture(); f.start(); const entry = f.state().control.optionalActivity!.preparation; f.mode('delivery');
    const s = f.state(), g = s.runtime.game!; f.replace({ ...s, runtime: { ...s.runtime, game: { ...g, world: { ...g.world, inventory: [], flags: { [q<'flag'>('FLAG-fiber-path')]: 'high-loss' }, completedObjectiveIds: [...g.world.completedObjectiveIds, q('O10')] } } } });
    f.diagnose(); f.simple('retry-optional'); const after = f.state().runtime.game!.world;
    expect(after.inventory).toEqual(entry.inventory); expect(after.flags).toEqual(entry.flags); expect(after.completedObjectiveIds).toEqual(entry.completedObjectiveIds); expect(after.achievementIds).toEqual([q('ACHIEVEMENT-MG02-complete')]);
  });
  it('safe save-v1 after exit retains only actual receipt/fact/help and JS/PHP policies agree', () => {
    const f = fixture(); finish(f); f.simple('hint-optional'); expect(captureSafeSnapshot(f.state(), validator).ok).toBe(false); f.simple('exit-optional');
    const capture = captureSafeSnapshot(f.state(), validator); expect(capture.ok).toBe(true); if (!capture.ok) return;
    const base = capture.capture.snapshot; expect(base).not.toHaveProperty('optionalActivity'); expect(base.world).not.toHaveProperty('minigameScores');
    const inputs = [base, { ...base, world: { ...base.world, completedObjectiveIds: [q('MG02')] } }, { ...base, world: { ...base.world, completedQuestIds: [q('MG02')] } },
      { ...base, world: { ...base.world, achievementIds: [q('ACHIEVEMENT-unregistered')] } }, { ...base, assistance: [{ ...base.assistance[0], objectiveId: q('O06') }] },
      { ...base, assistance: [{ ...base.assistance[0], hintId: q('HINT-MG01-method') }] }, { ...base, world: { ...base.world, achievementIds: [] } }];
    const results = inputs.map(input => { const r = validator.validateNewWrite(new TextEncoder().encode(JSON.stringify(input))); return { ok: r.ok, code: r.ok ? null : r.code }; });
    const code = "require 'server/vendor/autoload.php';require 'server/src/SaveValidator.php';$i=json_decode(stream_get_contents(STDIN));$v=new NetworkQuest\\SaveValidator([$i->policy]);$o=[];foreach($i->inputs as $c){$r=$v->validateNewWrite(json_encode($c));$o[]=['ok'=>$r->ok,'code'=>$r->code];}echo json_encode($o);";
    const php = spawnSync((process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php'), ['-d','auto_prepend_file=','-d','auto_append_file=','-r',code], { encoding: 'utf8', input: JSON.stringify({ policy, inputs }), env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' }, timeout: 10000 });
    expect(php.status, php.stderr).toBe(0); expect(JSON.parse(php.stdout)).toEqual(results); expect(results.map(r => r.ok)).toEqual([true,false,false,false,false,false,true]);
    expect(policy.members.objective).toHaveLength(12); expect(policy.members.quest).not.toContain(q('MG02')); expect(policy.lessonSources).toContain(q('MG02')); expect(json('server/content/save-policy.generated.json').policies).toEqual([JSON.parse(JSON.stringify(policy))]);
  });
});

describe('MG02 actual registry rejects changed teaching/content contracts', () => {
  it.each(['T04', 'T05', 'T15'])('%s actual production adapter preserves immutable receive, margin and physical status', id => {
    const fixture = json('tests/fixtures/optional-activities.json').cases.find((c: any) => c.id === 'OPT-MG02-BUDGETS').expected.cases.find((c: any) => c.caseId === id);
    const activity = definition.optionalActivity;
    if (activity.kind !== 'optical-budget-bench') throw new Error('Wrong MG02 variant');
    const part = [activity.practice, activity.delivery, activity.boundaryExample].find(p => p.sourceCaseId === id)!;
    const profile = registry.record(activity.profileId); if (profile?.kind !== 'profile') throw new Error('Missing profile');
    const game = startIntroduction(createIntroductionRuntime(), registry).game!;
    const result = evaluateBenchAnswer({ sourceCaseId: id, loss: part.loss, compatible: true }, { id: profile.id, parameters: profile.parameters },
      { actionId: 'independent-budget' as ActionId, expectedVersion: game.world, input: answer(fixture.receiveDbm, fixture.marginDb, fixture.marginDb >= 2 ? 'met' : 'shortfall') }, game.world);
    expect(result).toMatchObject({ status: 'correct', acceptedEffects: [], observations: [{ physicalStatus: fixture.status, physical: { receive: { value: fixture.receiveDbm, unit: 'dBm' }, margin: { value: fixture.marginDb, unit: 'dB' }, overload: false } }] });
  });
  it.each(['loss', 'unit', 'source', 'compatibility', 'prerequisite', 'achievement', 'effect', 'profile', 'speaker', 'entry'])('rejects %s corruption', change => {
    const metadata = structuredClone(world), documents = Object.fromEntries([...new Set(metadata.documents.map(d => d.path))].map(path => [path, json(path)])); const c = documents['content/spec001/minigames/MG02.json'];
    if (change === 'loss') c.optionalActivity.delivery.loss.value = 9; if (change === 'unit') c.optionalActivity.delivery.loss.unit = 'dBm';
    if (change === 'source') c.sourceClaims = []; if (change === 'compatibility') c.optionalActivity.compatibilityCards[2].premises.requiredWavelengthDirectionMatches = true;
    if (change === 'prerequisite') c.prerequisite = { kind: 'always' }; if (change === 'achievement') c.completionAchievementId = q('ACHIEVEMENT-forged');
    if (change === 'effect') c.effects[1] = { kind: 'complete-objective', effectId: q('EFFECT-MG02-complete'), objectiveId: q('O06') };
    if (change === 'profile') c.profileIds = [q('PROFILE-POWER')]; if (change === 'speaker') c.optionalActivity.speakerId = q('CH21'); if (change === 'entry') c.optionalActivity.entryContexts[0].roomId = q('R05');
    expect(validateContent({ world: metadata, sources: json('content/spec001/sources.json'), documents }).ok).toBe(false);
  });
});
