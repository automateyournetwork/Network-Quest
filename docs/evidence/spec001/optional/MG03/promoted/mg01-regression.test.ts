// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual current loader/controller/bus/reducer tests; safe initial locations are prepared fixtures.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { describe, expect, it, vi } from 'vitest';
import { diaryFixture, definition as diaryDefinition, mid } from '../../../../../../tests/ui/radio-diary-fixture';
import { loadIntroductionContent } from '../../../../../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../../../../../src/app/adventure';
import { introductionSavePolicy } from '../../../../../../src/app/save-policy';
import { createReducer, createReducerState, type ReducerState, type StateEffect, type ReducerInput } from '../../../../../../src/state/reducer';
import { optionalActivityDefinition, optionalEffectBindings, optionalActivityCompleted, evaluateOptionalAnswer, finalizeOptionalSession } from '../../../../../../src/state/optional-activities';
import { createOptionalActivitiesController, type OptionalActivityIntent } from '../../../../../../src/ui/optional-activities';
import { createActionBus, contextFromRuntime, copySemanticAction } from '../../../../../../src/ui/action-bus';
import { captureSafeSnapshot } from '../../../../../../src/state/snapshot';
import { SaveValidator } from '../../../../../../src/services/save-validator';
import { validateContent, type ContentRegistry } from '../../../../../../src/content/registry';
import { conditionSatisfied } from '../../../../../../src/state/conditions';
import { equipmentInteractionBindings, createEquipmentScenarioResolver, resolveEquipmentScenario } from '../../../../../../src/state/equipment-scenarios';
import { objectiveEffectBindings } from '../../../../../../src/state/objectives';
import type { ActionId, MeasurementId, QualifiedId, AchievementId } from '../../../../../../src/domain/types';
import type { ClientGeneration } from '../../../../../../src/state/types';
import type * as S from '../../../../../../src/content/schema-types.generated';
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const json = (path: string): any => JSON.parse(readFileSync(new URL(`../../../../../../${path}`, import.meta.url), 'utf8'));
const { registry, world } = loadIntroductionContent();
const definition = optionalActivityDefinition(registry, q('MG01'))!;
const definitions = ['SQ01', 'SQ02', 'SQ03', 'SQ04', 'MG01'].map(id => optionalActivityDefinition(registry, q(id))!);
const policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
const expected = (id: string) => json('tests/fixtures/optional-activities.json').cases.find((c: any) => c.id === id).expected;
function fixture() {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), original = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...original, world: { ...original.world,
    roomId: q('R10'), position: { safePositionId: q('R10.entry') }, completedObjectiveIds: [q('O01'), q('O02')],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] }, notebook: { ...original.notebook, personalNotes: 'Keep this observation' } } });
  let blocked = false, commits = 0, corrupt = false;
  const proxy: ContentRegistry = { ...registry, record: id => {
    const record = registry.record(id);
    if (!corrupt || id !== q('MG01')) return record;
    const clone = structuredClone(record) as any; clone.optionalActivity.delivery.samples[0].value = 2; return clone;
  } };
  const reduce = createReducer({ registry: proxy, bindings: [...definitions.flatMap(optionalEffectBindings), ...objectiveEffectBindings(proxy), ...equipmentInteractionBindings(proxy).effects], objectiveScenario: createEquipmentScenarioResolver(proxy) });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (blocked || before !== state) return false; state = next; commits++; return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createOptionalActivitiesController({ registry: proxy, store, bus, activityIds: [q('MG01'), q('MG02'), q('MG03')] });
  const send = (input: OptionalActivityIntent) => bus.dispatch(controller.project().capture(input));
  const start = () => send({ kind: 'start-optional', activityId: q('MG01'), hotspotId: q('HOTSPOT-clockworks-loom') });
  const sessionId = () => state.control.optionalActivity!.sessionId;
  const mode = (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: sessionId(), mode });
  const bits = (bits: string) => send({ kind: 'submit-optional', sessionId: sessionId(), bits });
  const simple = (kind: 'hint-optional' | 'explain-optional' | 'retry-optional' | 'exit-optional') => send({ kind, sessionId: sessionId() });
  const command = (input: ReducerInput) => { const game = state.runtime.game!; const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
    expect(result.status, result.reason).not.toBe('rejected'); state = result.state; return result; };
  return { store, bus, controller, send, start, sessionId, mode, bits, simple, command, state: () => state, commits: () => commits,
    block: (v: boolean) => { blocked = v; }, corrupt: () => { corrupt = true; }, replace: (v: ReducerState) => { state = v; } };
}
function calibration(f: ReturnType<typeof fixture>, method: 'step-and-decode' | 'notebook-and-replay', submit = true) {
  const controls = (json('content/spec001/dialogue/equipment-actions.json') as S.collection).records.filter((r): r is S.dialogue => r.kind === 'dialogue');
  for (const suffix of ['equipment-mode-100-full', `clock-${method}`, 'clock-role-physical', 'clock-read-scope', ...['00', '10', '11', '01'].map((pair, i) => `clock-pair-${i}-${pair}`)]) {
    const choice = controls.flatMap(d => d.nodes.flatMap(n => n.choices)).find(c => c.id === q(`ACTION-${suffix}`))!;
    f.command({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'actual-authored-calibration-choice', observations: [], acceptedEffects: choice.effects as StateEffect[] } });
  }
  const scenario = resolveEquipmentScenario(f.state().runtime.game!, q('O10'))!, id = crypto.randomUUID() as MeasurementId;
  f.command({ kind: 'objective', operation: { kind: 'measure', objectiveId: q('O10'), alternativeId: scenario.alternativeId, id } });
  if (submit) f.command({ kind: 'objective', operation: { kind: 'submit', objectiveId: q('O10'), alternativeId: scenario.alternativeId, measurementId: id } });
  return id;
}
function finish(f: ReturnType<typeof fixture>) { f.start(); f.mode('delivery'); expect(f.bits('00101101').status).toBe('handled'); }

describe('MG01 actual promoted lifecycle against unchanged T092 expectations', () => {
  it('OPT-MG01-START opens its only real minigame entry with instructions, practice, exit and timing off', () => {
    const f = fixture(); expect(definition.kind).toBe('minigame'); expect(f.controller.project().entries.map(e => e.activityId)).toEqual([q('MG01')]);
    expect(f.start().status).toBe('handled'); const view = f.controller.project().view!;
    expect(view.instructions.length).toBeGreaterThan(0); expect(view.controls.practice).toBeTruthy(); expect(view.controls.exit).toBeTruthy();
    expect(view).toMatchObject({ phase: 'instructions', mode: null, completed: false, rewardText: null, answerKind: 'bits' });
    expect(view.map).toHaveLength(4); expect(f.state().control.optionalActivity?.timingEnabled).toBe(expected('OPT-MG01-START').timerRunning);
    expect(f.state().runtime.game!.world.achievementIds).toHaveLength(expected('OPT-MG01-START').completionAward);
  });
  it('OPT-MG01-PRACTICE is read-only to world, explains one symbol, and records real MG01 assistance', () => {
    const f = fixture(); f.start(); const before = f.state().runtime.game!.world; f.mode('practice'); f.bits('11');
    expect(f.state().runtime.game!.world).toEqual(before); expect(f.controller.project().view?.feedback).toContain('two represented bits');
    expect(f.controller.project().view?.feedback).not.toContain('00101101'); expect(f.controller.project().view?.completed).toBe(false);
    expect(f.state().runtime.game!.assistance).toMatchObject([{ objectiveId: q('MG01'), hintId: q('HINT-MG01-step'), level: 2 }]);
    expect(expected('OPT-MG01-PRACTICE')).toMatchObject({ assistanceRecorded: true, unassistedClaim: false });
  });
  it('OPT-MG01-FINISH records exactly its achievement and fact through full decoder/captured CAS', () => {
    const f = fixture(), before = f.state().runtime.game!.world; finish(f); const game = f.state().runtime.game!;
    expect(game.world.achievementIds).toEqual([q('ACHIEVEMENT-MG01-complete')]); expect(game.notebook.factIds).toContain(q('FACT-MG01-completion'));
    expect(game.world.completedObjectiveIds).toEqual(before.completedObjectiveIds); expect(game.world.completedQuestIds).toEqual([]);
    expect(game.world.inventory).toEqual(before.inventory); expect(f.controller.project().view?.rewardText).toBeNull();
    expect(f.controller.project().view?.feedback).not.toMatch(/undefined|not available|ASSET-/);
    expect(optionalActivityCompleted(registry, definition, game)).toBe(true);
    expect(expected('OPT-MG01-FINISH')).toMatchObject({ optionalBenefit: 'optional-practice-only', benefitGrantCount: 1, mainObjectiveAward: 0 });
    expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it('OPT-MG01-RETRY retains clues/notes/help, stales actual calibration measurements and preserves entry tools', () => {
    const f = fixture(); calibration(f, 'step-and-decode', false); f.start(); const entry = f.state().control.optionalActivity!.preparation;
    f.mode('delivery'); f.bits('00011011'); const before = f.state().runtime.game!; expect(f.simple('retry-optional').status).toBe('handled');
    const after = f.state().runtime.game!;
    expect(after.world.attemptId).not.toBe(before.world.attemptId); expect(after.world.configurationRevision).toBeGreaterThan(before.world.configurationRevision);
    expect(after.world.flags).toEqual(entry.flags); expect(after.world.inventory).toEqual(entry.inventory);
    expect(after.notebook.factIds).toEqual(before.notebook.factIds); expect(after.notebook.personalNotes).toBe(expected('OPT-MG01-RETRY').personalNotes);
    expect(after.assistance).toEqual(before.assistance); expect(after.notebook.measurements).toHaveLength(1); expect(after.notebook.measurements.every(m => m.stale)).toBe(true);
    expect(after.world.achievementIds).toEqual([]); expect(f.state().runtime.persistence.pendingRequest).toBeNull(); expect(f.controller.project().view?.phase).toBe('instructions');
  });
  it.each(['instructions', 'practice', 'solving', 'feedback', 'completed'] as const)('OPT-MG01-EXIT closes safely during %s without saving or navigating', phase => {
    const f = fixture(); f.start();
    if (phase !== 'instructions') f.mode(phase === 'practice' ? 'practice' : 'delivery');
    if (phase === 'feedback') f.bits('00011011'); if (phase === 'completed') f.bits('00101101');
    const game = f.state().runtime.game; expect(f.simple('exit-optional').status).toBe('handled');
    expect(f.state().runtime.game).toBe(game); expect(f.state().control.optionalActivity).toBeNull(); expect(f.controller.project().view).toBeNull();
    expect(f.state().runtime.activity?.kind).toBe('stable-exploration'); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it.each(['step-and-decode', 'notebook-and-replay'] as const)('OPT-MG01-SKIP / NO-O10-SCORE: actual %s calibration completes without optional progress', method => {
    const f = fixture(); calibration(f, method); const game = f.state().runtime.game!;
    expect(game.world.completedObjectiveIds).toContain(q('O10')); expect(game.world.achievementIds).toEqual([]);
    expect(game.notebook.factIds).not.toContain(q('FACT-MG01-completion')); expect(f.state().control.optionalActivity).toBeNull();
    expect(expected('OPT-MG01-NO-O10-SCORE')).toEqual({ O10CompletionEligible: true, MG01CompletionRequired: false, scoreRequired: false });
  });
  it('OPT-MG01-REPLAY keeps a single receipt on exact-action/new-action, retry and new session', () => {
    const f = fixture(); f.start(); f.mode('delivery'); const action = f.controller.project().capture({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' });
    f.bus.dispatch(action); const state = f.state(), commits = f.commits(); expect(f.bus.dispatch(action).status).toBe('handled'); expect(f.state()).toBe(state); expect(f.commits()).toBe(commits);
    f.bits('00101101'); f.simple('retry-optional'); expect(f.state().runtime.game!.world.achievementIds).toEqual([q('ACHIEVEMENT-MG01-complete')]);
    f.mode('delivery'); f.bits('00101101'); f.simple('exit-optional'); f.start(); f.mode('delivery'); f.bits('00101101');
    expect(f.state().runtime.game!.world.achievementIds).toHaveLength(expected('OPT-MG01-REPLAY').benefitGrantCountAfter);
    expect(f.state().runtime.game!.notebook.factIds.filter(id => id === q('FACT-MG01-completion'))).toHaveLength(1);
    expect(f.controller.project().view?.feedback).toBe(definition.optionalActivity.feedback.alreadyCompleted);
  });
  it('OPT-MG01-UNTIMED offers no timed capability and still completes after a long logical delay', () => {
    vi.useFakeTimers(); try { const f = fixture(); f.start(); f.mode('delivery'); vi.advanceTimersByTime(24 * 60 * 60 * 1000);
      expect(f.state().control.optionalActivity?.timingEnabled).toBe(false); expect(f.state().runtime.game!.world.achievementIds).toEqual([]);
      expect(f.bits('00101101').status).toBe('handled'); expect(f.controller.project().view?.completed).toBe(true);
      expect(expected('OPT-MG01-UNTIMED')).toMatchObject({ failureFromDelay: false, mainScoreRequirement: null });
    } finally { vi.useRealTimers(); }
  });
});

describe('MG01 failures, captured intents and safe persistence', () => {
  it.each(['', '2', '0010 1101'])('invalid answer %j requests input without an award or penalty', bits => {
    const f = fixture(); f.start(); f.mode('delivery'); const world = f.state().runtime.game!.world; f.bits(bits);
    expect(f.state().control.optionalActivity?.result).toBe('invalid-input'); expect(f.state().runtime.game!.world).toEqual(world);
    expect(f.simple('retry-optional').status).toBe('handled'); expect(f.simple('exit-optional').status).toBe('handled');
  });
  it('wrong order shows honest corrective feedback and own solution assistance, then accepts assisted completion', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.bits('00011011');
    expect(f.state().control.optionalActivity?.result).toBe('incorrect'); expect(f.controller.project().view?.feedback).toContain('does not match the supplied strip');
    expect(f.state().runtime.game!.assistance.at(-1)).toMatchObject({ objectiveId: q('MG01'), hintId: q('HINT-MG01-solution'), level: 3 });
    expect(f.state().runtime.game!.world.achievementIds).toEqual([]); f.bits('00101101'); expect(f.controller.project().view?.completed).toBe(true);
  });
  it('malformed authored content precedes input judgment and keeps the matching exit usable', () => {
    const f = fixture(); f.start(); f.mode('delivery'); const broken: any = structuredClone(definition); broken.optionalActivity.delivery.samples[0].value = 2;
    const evaluated = evaluateOptionalAnswer(registry, broken, 'delivery', { actionId: 'corrupt' as ActionId, expectedVersion: f.state().runtime.game!.world, input: { bits: null } }, f.state().runtime.game!);
    expect(evaluated.evaluation.status).toBe('content-error'); expect(evaluated.evaluation.acceptedEffects).toEqual([]);
    f.corrupt(); const before = f.state(); expect(f.bits('00101101').status).toBe('rejected'); expect(f.state()).toBe(before);
    expect(f.controller.project().view?.feedback).toContain('You can leave safely'); expect(f.simple('exit-optional').status).toBe('handled');
  });
  it.each(['start', 'answer', 'hint', 'retry', 'exit'])('failed %s CAS installs no partial progress, hint, session or save', step => {
    const f = fixture(); if (step !== 'start') { f.start(); f.mode('delivery'); } const before = f.state(); f.block(true);
    const result = step === 'start' ? f.start() : step === 'answer' ? f.bits('00101101') : f.simple(step === 'hint' ? 'hint-optional' : step === 'retry' ? 'retry-optional' : 'exit-optional');
    expect(result.status).toBe('rejected'); expect(f.state()).toBe(before);
  });
  it.each(['mode', 'retry', 'exit', 'account', 'restore'])('rejects a previously captured answer after %s', change => {
    const f = fixture(); f.start(); f.mode('delivery'); const old = f.controller.project().capture({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' });
    if (change === 'mode') f.mode('practice');
    if (change === 'retry') f.simple('retry-optional');
    if (change === 'exit') f.simple('exit-optional');
    if (change === 'account') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, auth: { ...s.runtime.auth, clientGeneration: (s.runtime.auth.clientGeneration + 1) as ClientGeneration } } }); }
    if (change === 'restore') f.replace(createReducerState(structuredClone(f.state().runtime)));
    const current = f.state(); expect(f.bus.dispatch(old).status).toBe('rejected'); expect(f.state()).toBe(current);
  });
  it('rejects forged verdict/effect/version/score fields and other minigames', () => {
    const f = fixture(); f.start(); f.mode('delivery');
    for (const extra of [{ verdict: 'correct' }, { acceptedEffects: definition.effects }, { expectedVersion: f.state().runtime.game!.world }, { score: 100 }])
      expect(() => copySemanticAction({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101', ...extra } as never)).toThrow();
    expect(f.send({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: { assessment: 'over-budget', difference: { value: 3, unit: 'W' } } }).status).toBe('rejected');
    f.simple('exit-optional'); expect(f.send({ kind: 'start-optional', activityId: q('MG03'), hotspotId: q('HOTSPOT-clockworks-loom') }).status).not.toBe('handled');
  });
  it('requires the full group and refuses generic effect application during active play', () => {
    const f = fixture(); const game = f.state().runtime.game!;
    const apply = (effects: readonly StateEffect[]) => f.store.reduce(f.state(), { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: f.state().runtime.game!.world,
      input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'trusted-group-boundary', observations: [], acceptedEffects: effects } } });
    for (const effect of definition.effects) expect(apply([effect as StateEffect]).status).toBe('rejected');
    f.start(); expect(apply(definition.effects as StateEffect[]).status).toBe('rejected'); expect(f.state().runtime.game!.world.achievementIds).toEqual([]);
  });
  it('records method/worked/solution hints under MG01 and reserves earned narrative for completion', () => {
    const f = fixture(); f.start(); for (let i = 0; i < 3; i++) f.simple('hint-optional');
    expect(f.state().runtime.game!.assistance.map(h => [h.objectiveId, h.level])).toEqual([[q('MG01'), 1], [q('MG01'), 2], [q('MG01'), 3]]);
    expect(f.controller.project().view?.hintText).toBe(definition.hints.solution.text); expect(f.controller.project().view?.completed).toBe(false);
    f.mode('practice'); f.simple('explain-optional'); expect(f.controller.project().view?.hintText).toBe(definition.optionalActivity.practice.explanation);
    f.mode('delivery'); f.bits('00101101'); f.simple('explain-optional');
    expect(f.controller.project().view?.hintText).toBe(definition.completionExplanation);
  });
  it('only captures safe save-v1 snapshots after exit and restores receipt replay without a transient session', () => {
    const f = fixture(); f.start(); f.mode('practice'); f.bits('11'); f.mode('delivery'); f.bits('00101101');
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(false); f.simple('exit-optional'); const capture = captureSafeSnapshot(f.state(), validator);
    expect(capture.ok, JSON.stringify(capture)).toBe(true); if (!capture.ok) return;
    const snapshot = JSON.parse(new TextDecoder().decode(new Uint8Array(capture.capture.bodyBytes)));
    expect(snapshot.world.achievementIds).toEqual([q('ACHIEVEMENT-MG01-complete')]); expect(snapshot.assistance[0].objectiveId).toBe(q('MG01'));
    expect(snapshot).not.toHaveProperty('optionalActivity'); expect(snapshot.world).not.toHaveProperty('minigameScores');
    const restored = createReducerState({ ...f.state().runtime, game: structuredClone(f.state().runtime.game!) }); f.replace(restored);
    expect(f.state().control.optionalActivity).toBeNull(); f.start(); f.mode('delivery'); f.bits('00101101'); expect(f.state().runtime.game!.world.achievementIds).toHaveLength(1);
  });
  it('validates actual achievement/fact/help snapshots identically in JavaScript and PHP without objective/quest aliases', () => {
    const f = fixture(); finish(f); f.simple('hint-optional'); f.simple('exit-optional'); const capture = captureSafeSnapshot(f.state(), validator); expect(capture.ok).toBe(true); if (!capture.ok) return;
    const base = capture.capture.snapshot, inputs = [base,
      { ...base, world: { ...base.world, completedObjectiveIds: [q('MG01')] } },
      { ...base, world: { ...base.world, completedQuestIds: [q('MG01')] } },
      { ...base, world: { ...base.world, achievementIds: [q('ACHIEVEMENT-unregistered')] } },
      { ...base, assistance: [{ ...base.assistance[0], objectiveId: q('O10') }] },
      { ...base, assistance: [{ ...base.assistance[0], hintId: q('HINT-SQ01-method') }] },
      { ...base, world: { ...base.world, achievementIds: [] } },
    ];
    const results = inputs.map(input => { const r = validator.validateNewWrite(new TextEncoder().encode(JSON.stringify(input))); return { ok: r.ok, code: r.ok ? null : r.code }; });
    const code = "require 'server/vendor/autoload.php';require 'server/src/SaveValidator.php';$i=json_decode(stream_get_contents(STDIN));$v=new NetworkQuest\\SaveValidator([$i->policy]);$o=[];foreach($i->inputs as $c){$r=$v->validateNewWrite(json_encode($c));$o[]=['ok'=>$r->ok,'code'=>$r->code];}echo json_encode($o);";
    const php = spawnSync(process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php', ['-d','auto_prepend_file=','-d','auto_append_file=','-r',code], { encoding: 'utf8', input: JSON.stringify({ policy, inputs }), env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' }, timeout: 10000 });
    expect(php.status, php.stderr).toBe(0); expect(JSON.parse(php.stdout)).toEqual(results); expect(results.map(r => r.ok)).toEqual([true,false,false,false,false,false,true]);
    expect(policy.members.objective).toHaveLength(12); expect(policy.members.quest).not.toContain(q('MG01')); expect(policy.lessonSources).toContain(q('MG01'));
    expect(json('server/content/save-policy.generated.json').policies).toEqual([JSON.parse(JSON.stringify(policy))]);
  });
});

describe('Exact own-completion replay preparation for quests and minigames', () => {
  it.each(['MG01', 'SQ01', 'SQ02', 'SQ03', 'SQ04'])('%s advances only its accepted receipt while preserving entry physical state and prior progress', id => {
    const target = optionalActivityDefinition(registry, q(id))!; const f = fixture(); f.start();
    const original = f.state().control.optionalActivity!, entry = { ...original.preparation, completedQuestIds: [q<'quest'>('SQ02')], achievementIds: [q('ACHIEVEMENT-prior') as AchievementId] };
    const session = { ...original, activityId: q(id), mode: 'delivery' as const, result: 'correct' as const, preparation: entry };
    const ownAchievement = target.kind === 'minigame' ? target.completionAchievementId as AchievementId : null;
    const game = { ...f.state().runtime.game!, world: { ...entry, flags: { ...entry.flags, 'spec001:FLAG-caller': true }, inventory: [], route: 'radio' as const,
      completedObjectiveIds: [q<'objective'>('O10')], completedQuestIds: [q<'quest'>('SQ01'), q<'quest'>('SQ02'), q<'quest'>('SQ03'), q<'quest'>('SQ04')], achievementIds: [...entry.achievementIds, ...(ownAchievement ? [ownAchievement] : []), q('ACHIEVEMENT-unrelated') as AchievementId] },
      notebook: { ...f.state().runtime.game!.notebook, factIds: [target.optionalActivity.reward.factId as QualifiedId<'fact'>] } };
    const finalized = finalizeOptionalSession(session, game, registry)!;
    expect(finalized.preparation).toEqual({ ...entry, ...(target.kind === 'quest'
      ? { completedQuestIds: [...new Set([...entry.completedQuestIds, target.id])] }
      : { achievementIds: [...entry.achievementIds, ownAchievement] }) });
    expect(finalized.preparation.flags).toEqual(entry.flags); expect(finalized.preparation.inventory).toEqual(entry.inventory);
    expect(entry).toEqual(session.preparation); expect(game.world.inventory).toEqual([]);
  });
  it.each(['no-fact', 'fact-only', 'practice', 'incorrect', 'wrong-adventure'])('does not advance preparation from %s', omission => {
    const f = fixture(); f.start(); f.mode('delivery'); f.bits('00101101'); const game = f.state().runtime.game!, actual = f.state().control.optionalActivity!;
    const entry = { ...actual.preparation, achievementIds: [] }, session = { ...actual, preparation: entry };
    const modified = { ...game, notebook: omission === 'no-fact' ? { ...game.notebook, factIds: [] } : game.notebook,
      world: omission === 'fact-only' ? { ...game.world, achievementIds: [] } : game.world };
    const s = omission === 'practice' ? { ...session, mode: 'practice' as const } : omission === 'incorrect' ? { ...session, result: 'incorrect' as const }
      : omission === 'wrong-adventure' ? { ...session, adventureId: crypto.randomUUID() as typeof game.adventureId } : session;
    expect(finalizeOptionalSession(s, modified, registry)).toBe(s);
  });
  it('fails closed without the actual registered minigame mapping, even with receipt and fact present', () => {
    const f = fixture(); finish(f); const game = f.state().runtime.game!, session = { ...f.state().control.optionalActivity!, preparation: { ...f.state().control.optionalActivity!.preparation, achievementIds: [] } };
    const broken: ContentRegistry = { ...registry, record: id => id === q('MG01') ? registry.record(q('SQ01')) : registry.record(id) };
    expect(finalizeOptionalSession(session, game, broken)).toBe(session); expect(conditionSatisfied({ kind: 'minigame-complete', minigameId: q('MG01') }, game.world, broken)).toBe(false);
  });
});

describe('MG01 production registry semantic boundary', () => {
  it.each(['source', 'profile', 'speaker', 'entry', 'samples', 'completion', 'main-award', 'fact', 'prerequisite', 'media'])('rejects corrupt %s', change => {
    const metadata = structuredClone(world), documents = Object.fromEntries([...new Set(metadata.documents.map(d => d.path))].map(path => [path, json(path)]));
    const c = documents['content/spec001/minigames/MG01.json'];
    if (change === 'source') c.sourceClaims = [];
    if (change === 'profile') c.profileIds = [q('PROFILE-POWER')];
    if (change === 'speaker') c.optionalActivity.speakerId = q('CH13');
    if (change === 'entry') c.optionalActivity.entryContexts[0].roomId = q('R04');
    if (change === 'samples') c.optionalActivity.delivery.samples[0].value = 3;
    if (change === 'completion') c.completionAchievementId = q('ACHIEVEMENT-forged');
    if (change === 'main-award') c.effects[1] = { kind: 'complete-objective', effectId: q('EFFECT-MG01-complete'), objectiveId: q('O10') };
    if (change === 'fact') c.effects[0].factId = q('FACT-clockworks-role');
    if (change === 'prerequisite') c.prerequisite = { kind: 'objective-complete', objectiveId: q('O10') };
    if (change === 'media') c.optionalActivity.reward.assetId = q('ASSET-ILLUSTRATION-19');
    expect(validateContent({ world: metadata, sources: json('content/spec001/sources.json'), documents }).ok).toBe(false);
  });
});


describe('Accepted media-bearing reward preservation during the MG01 join', () => {
  it('SQ03 retains its picture description and depth only with both earned receipt and fact; MG01 remains media-free', () => {
    const f = diaryFixture(); f.start(); f.mode('delivery');
    const entry = f.state(), game = f.game(), reward = diaryDefinition.optionalActivity.reward;
    if (reward.kind !== 'optional-radio-depth') throw new Error('Expected the actual accepted diary reward');
    for (const partial of ['neither', 'receipt-only', 'fact-only'] as const) {
      // Deliberately partial projection states prove that either half alone exposes no reward.
      f.replace({ ...entry, runtime: { ...entry.runtime, game: { ...game,
        world: { ...game.world, completedQuestIds: partial === 'receipt-only' ? [q('SQ03')] : [] },
        notebook: { ...game.notebook, factIds: partial === 'fact-only' ? [...game.notebook.factIds, reward.factId as QualifiedId<'fact'>] : game.notebook.factIds },
      } } });
      expect(f.controller.project().view?.rewardText, partial).toBeNull();
      expect(f.controller.project().view?.diary?.depth, partial).toBeNull();
    }
    f.replace(entry);
    expect(f.send({ kind: 'submit-optional-diary', sessionId: f.session(), answer: {
      earlierMeasurementId: mid(2), laterMeasurementId: mid(3), comparison: 'decreased',
      currentAssessment: 'below-threshold', evidenceClaim: 'current-reading-only-no-cause',
    } }).status).toBe('handled');
    expect(f.game().world.completedQuestIds).toContain(q('SQ03'));
    expect(f.game().notebook.factIds).toContain(reward.factId);
    expect(f.controller.project().view?.diary?.depth).toEqual({ title: reward.title, paragraphs: reward.paragraphs });
    expect(f.controller.project().view?.rewardText).toBe(`${reward.alternativeText} ${reward.unavailableText}`);
    const loom = fixture(); finish(loom); expect(loom.controller.project().view?.rewardText).toBeNull();
  });
});
