// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../../../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { introductionSavePolicy } from '../../../../../src/app/save-policy';
import { createReducer, createReducerState, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { optionalActivityDefinition, optionalEffectBindings } from '../../../../../src/state/optional-activities';
import { createOptionalActivitiesController, type OptionalActivityIntent } from '../../../../../src/ui/optional-activities';
import { createActionBus, contextFromRuntime, copySemanticAction } from '../../../../../src/ui/action-bus';
import { captureSafeSnapshot } from '../../../../../src/state/snapshot';
import { SaveValidator } from '../../../../../src/services/save-validator';
import type { ActionId, QualifiedId } from '../../../../../src/domain/types';
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const { registry, world } = loadIntroductionContent();
const definitions = ['SQ01', 'SQ02'].map(id => optionalActivityDefinition(registry, q(id))!);
const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
// Explicit safe-location/prerequisite fixture; answers, optional lifecycle and
// durable effects below all travel through the production capture/bus/CAS path.
function fixture(id = 'SQ01') {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), original = runtime.game!;
  const room = id === 'SQ01' ? 'R04' : 'R09';
  let state = createReducerState({ ...runtime, game: { ...original, world: { ...original.world, roomId: q(room), position: { safePositionId: q(`${room}.entry`) },
    completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] } } });
  let blocked = false, commits = 0;
  const reduce = createReducer({ registry, bindings: definitions.flatMap(optionalEffectBindings) });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (blocked || before !== state) return false; state = next; commits++; return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createOptionalActivitiesController({ registry, store, bus, activityIds: [...definitions.map(d => d.id as QualifiedId), q('SQ03'), q('SQ04'), q('MG01')] });
  const send = (input: OptionalActivityIntent) => bus.dispatch(controller.project().capture(input));
  const start = () => send({ kind: 'start-optional', activityId: q(id), hotspotId: q(id === 'SQ01' ? 'HOTSPOT-echo-serial-post' : 'HOTSPOT-market-eel') });
  const sessionId = () => state.control.optionalActivity!.sessionId;
  const mode = (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: sessionId(), mode });
  const bits = (bits: string) => send({ kind: 'submit-optional', sessionId: sessionId(), bits });
  const simple = (kind: 'hint-optional' | 'explain-optional' | 'retry-optional' | 'boundary-optional' | 'exit-optional') => send({ kind, sessionId: sessionId() });
  return { store, bus, controller, send, start, sessionId, mode, bits, simple, state: () => state, commits: () => commits,
    block: (value: boolean) => { blocked = value; }, replace: (value: ReducerState) => { state = value; } };
}
describe('T100 actual authored optional controller and canonical reducer', () => {
  it('opens only available authored entries and never creates unsupported activity controls', () => {
    const f = fixture(); expect(f.controller.project().entries.map(e => e.activityId)).toEqual([q('SQ01')]);
    expect(f.start().status).toBe('handled'); expect(f.state().runtime.activity?.kind).toBe('active-optional');
    expect(f.controller.project().view).toMatchObject({ phase: 'instructions', mode: null, completed: false });
    expect(f.state().control.optionalActivity?.timingEnabled).toBe(false);
    expect(f.send({ kind: 'start-optional', activityId: q('SQ03'), hotspotId: q('HOTSPOT-echo-serial-post') }).status).toBe('rejected');
  });
  it('uses the same captured action path for practice, wrong answer and exact once-only full delivery', () => {
    const f = fixture(), original = f.state().runtime.game!; f.start(); f.mode('practice');
    expect(f.bits('11').status).toBe('handled'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([]);
    expect(f.state().runtime.game!.assistance).toMatchObject([{ objectiveId: q('SQ01'), level: 2 }]);
    f.mode('delivery'); expect(f.bits('00011011').status).toBe('handled'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([]);
    const captured = f.controller.project().capture({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' });
    const before = f.commits(); expect(f.bus.dispatch(captured).status).toBe('handled'); expect(f.commits()).toBe(before + 1);
    const completed = f.state(); expect(completed.runtime.game!.world.completedQuestIds).toEqual([q('SQ01')]);
    expect(completed.runtime.game!.notebook.factIds).toContain(q('FACT-SQ01-delivery'));
    // Bus receipts replay the original acknowledgement without another CAS.
    expect(f.bus.dispatch(captured).status).toBe('handled'); expect(f.state()).toBe(completed); expect(f.commits()).toBe(before + 1);
    expect(f.bits('00101101').status).toBe('handled'); expect(f.state().runtime.game!.world).toEqual(completed.runtime.game!.world);
    expect(f.state().runtime.game!.world.inventory).toEqual(original.world.inventory);
  });
  it('retains completion and reward through same-session retry and next-session replay', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.bits('00101101'); const completed = f.state().runtime.game!;
    expect(f.simple('retry-optional').status).toBe('handled'); const replay = f.state().runtime.game!;
    expect(replay.world.attemptId).not.toBe(completed.world.attemptId); expect(replay.world.configurationRevision).toBeGreaterThan(completed.world.configurationRevision);
    expect(replay.world.completedQuestIds).toEqual([q('SQ01')]); expect(f.controller.project().view?.rewardText).toBeTruthy();
    f.mode('delivery'); f.bits('00101101'); f.simple('exit-optional'); expect(f.start().status).toBe('handled');
    f.mode('delivery'); f.bits('00101101'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([q('SQ01')]);
    expect(f.state().runtime.game!.notebook.factIds.filter(id => id === q('FACT-SQ01-delivery'))).toHaveLength(1);
  });
  it('records solution assistance before displaying help and reserves earned narrative for actual completion', () => {
    const f = fixture(); f.start(); expect(f.simple('explain-optional').status).toBe('handled');
    expect(f.state().runtime.game!.assistance).toMatchObject([{ objectiveId: q('SQ01'), level: 3 }]);
    expect(f.controller.project().view?.hintText).toBe(definitions[0]!.hints.solution.text);
    expect(f.controller.project().view?.hintText).not.toBe(definitions[0]!.completionExplanation);
    f.mode('practice'); f.simple('explain-optional'); expect(f.state().runtime.game!.assistance.at(-1)?.level).toBe(2);
    expect(f.controller.project().view?.hintText).toBe(definitions[0]!.optionalActivity.practice.explanation);
    expect(f.controller.project().view?.rewardText).toBeNull();
  });
  it('rejects stale controls even when a mode transition keeps the same world version', () => {
    const f = fixture(); f.start(); const view = f.controller.project(), original = f.state().runtime.game!.world;
    const stale = view.capture({ kind: 'choose-optional-mode', sessionId: f.sessionId(), mode: 'delivery' });
    f.mode('practice'); expect(f.state().runtime.game!.world).toBe(original); const current = f.state();
    expect(f.bus.dispatch(stale).status).toBe('rejected'); expect(f.state()).toBe(current);
    expect(f.bus.dispatch(f.bus.capture({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '00101101' })).status).toBe('rejected');
  });
  it.each(['start', 'answer', 'hint', 'retry', 'exit'])('a failed %s CAS installs no partial game or activity state', step => {
    const f = fixture(); if (step !== 'start') { f.start(); f.mode('delivery'); }
    const before = f.state(); f.block(true);
    const result = step === 'start' ? f.start() : step === 'answer' ? f.bits('00101101') : f.simple(step === 'hint' ? 'hint-optional' : step === 'retry' ? 'retry-optional' : 'exit-optional');
    expect(result.status).toBe('rejected'); expect(f.state()).toBe(before);
    expect(f.controller.project().view?.rewardText ?? null).toBeNull();
  });
  it('admits a safe snapshot after exit with honest optional assistance and no save during active play', () => {
    const f = fixture(); expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true); f.start(); f.mode('practice'); f.bits('11');
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(false); const game = f.state().runtime.game;
    expect(f.simple('exit-optional').status).toBe('handled'); expect(f.state().runtime.game).toBe(game);
    const capture = captureSafeSnapshot(f.state(), validator); expect(capture.ok, JSON.stringify(capture)).toBe(true);
    if (capture.ok) { expect(capture.capture.snapshot.assistance.at(-1)?.objectiveId).toBe(q('SQ01')); expect(capture.capture.snapshot.world.completedObjectiveIds).not.toContain(q('SQ01')); }
  });
  it('refuses unrecorded assistance at the bound and refuses raw apply while the optional session owns play', () => {
    const f = fixture(); f.start(); f.mode('delivery'); const current = f.state(), game = current.runtime.game!;
    f.replace({ ...current, runtime: { ...current.runtime, game: { ...game, assistance: Array.from({ length: 2048 }, (_, i) => ({ objectiveId: q('SQ01'), hintId: q('HINT-SQ01-step'), level: 2, attemptId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}` as typeof game.world.attemptId })) } } });
    const before = f.state(); expect(f.simple('explain-optional').status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.controller.project().view?.hintText).toBeNull();
    const result = f.store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
      input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'caller-claim', observations: [], acceptedEffects: definitions[0]!.effects as StateEffect[] } } });
    expect(result.status).toBe('rejected'); expect(result.state).toBe(before);
  });
  it('invalidates its own transient session without affecting a replaced equal-version runtime', () => {
    const f = fixture(); f.start(); const captured = f.controller.project().capture({ kind: 'choose-optional-mode', sessionId: f.sessionId(), mode: 'delivery' });
    f.controller.invalidate(); expect(f.state().control.optionalActivity).toBeNull(); expect(f.state().runtime.activity?.kind).toBe('stable-exploration');
    expect(f.bus.dispatch(captured).status).toBe('rejected'); f.start(); const replacement = structuredClone(f.state()); f.replace(replacement);
    f.controller.invalidate(); expect(f.state()).toBe(replacement);
    expect(f.bus.dispatch(captured).status).toBe('rejected');
  });
  it('evaluates the real SQ02 power plan while accepting its correct over-budget diagnosis', () => {
    const f = fixture('SQ02'); expect(f.start().status).toBe('handled'); f.mode('practice');
    const power = (assessment: 'within-budget' | 'over-budget', value: number) => f.send({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: { assessment, difference: { value, unit: 'W' } } });
    expect(power('within-budget', 7).status).toBe('handled'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([]);
    f.simple('boundary-optional'); expect(f.state().runtime.game!.assistance.at(-1)?.objectiveId).toBe(q('SQ02'));
    f.mode('delivery'); expect(power('within-budget', 3).status).toBe('handled'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([]);
    expect(power('over-budget', 3).status).toBe('handled'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([q('SQ02')]);
    expect(f.state().runtime.game!.notebook.factIds).toContain(q('FACT-SQ02-audit')); expect(f.controller.project().view?.rewardText).toBeTruthy();
    f.simple('exit-optional'); expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true);
  });
  it('copies the typed power answer and rejects caller verdict/effect fields', () => {
    const answer = { assessment: 'over-budget' as const, difference: { value: 3, unit: 'W' as const } };
    const copy = copySemanticAction({ kind: 'submit-optional-power', sessionId: '00000000-0000-4000-8000-000000000100', answer }); answer.difference.value = 99;
    expect(copy).toMatchObject({ answer: { difference: { value: 3 } } });
    expect(() => copySemanticAction({ kind: 'submit-optional', sessionId: 'session', bits: '00101101', correct: true } as never)).toThrow();
  });
});
