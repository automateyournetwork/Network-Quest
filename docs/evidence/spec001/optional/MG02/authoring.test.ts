// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated actual optics/proposal/receipt checks. No MG02 browser lifecycle claim.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import { evaluateOptics, type OpticalChallenge, type OpticalInput, type OpticalProfile } from '../../../../../src/domain/optics';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { conditionSatisfied } from '../../../../../src/state/conditions';
import { createReducer, createReducerState, type EffectBinding, type ReducerInput, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { createFiberScenarioResolver, fiberEffectBindings, prepareFiberAction } from '../../../../../src/state/fiber-scenario';
import { objectiveEffectBindings } from '../../../../../src/state/objectives';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, MeasurementId, QualifiedId } from '../../../../../src/domain/types';
import type * as S from '../../../../../src/content/schema-types.generated';
import { evaluateBenchAnswer, evaluateCompatibilityCard } from './optical-bench-proposal';
import candidate from './MG02.candidate.json' with { type: 'json' };
import projection from './MG02.current-schema.json' with { type: 'json' };

const read = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const oracle = json('tests/fixtures/optional-activities.json');
const physical = json('tests/fixtures/physical-cases.json');
const source = json('content/spec001/sources.json');
const world = json('content/spec001/world.json');
const fullProfile = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-OPTICAL'));
const profile: OpticalProfile = { id: fullProfile.id, parameters: structuredClone(fullProfile.parameters) };
const activity = candidate.optionalActivity;
const receipts: Record<string, unknown> = {};
const originals = ['tests/fixtures/optional-activities.json', 'tests/fixtures/companions.json', 'tests/fixtures/physical-cases.json', 'content/spec001/sources.json', 'content/spec001/profiles.json', 'content/spec001/rooms/R06.json'];
const hashes = Object.fromEntries(originals.map(p => [p, createHash('sha256').update(read(p)).digest('hex')]));
const version = { configurationRevision: 3 as ConfigurationRevision, attemptId: 'mg02-attempt' as AttemptId };
const action = (input: unknown): DomainAction<unknown> => ({ actionId: 'mg02-answer' as ActionId, expectedVersion: version, input });
const answer = (receive = -13, margin = 1, reserve = 'shortfall', overload = 'not-overloaded') => ({ receive: { value: receive, unit: 'dBm' }, margin: { value: margin, unit: 'dB' }, reserve, overload });
const part = (id: 'T04' | 'T05' | 'T15') => {
  const found = [activity.practice, activity.delivery, activity.boundaryExample].find(p => p.sourceCaseId === id)!;
  return { sourceCaseId: found.sourceCaseId, compatible: found.compatible, loss: found.loss };
};
function input(record: unknown = projection) {
  const metadata = structuredClone(world) as S.world;
  metadata.documents = metadata.documents.filter(d => d.id !== q('MG02'));
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(metadata.documents.map(d => d.path))].map(p => [p, json(p)]));
  const path = 'content/spec001/minigames/MG02.json';
  metadata.documents.push({ kind: 'minigame', id: q('MG02'), path }); documents[path] = structuredClone(record);
  return { world: metadata, sources: source, documents };
}
function registry() {
  const result = validateContent(input()); expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok || !result.registry) throw new Error('MG02 projection must register');
  return result.registry;
}
const validateProposal = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/MG02/optional-activity.schema.json'));
function prepared() {
  const reg = registry(); const runtime = startIntroduction(createIntroductionRuntime(), reg); const game = runtime.game!;
  const state = createReducerState({ ...runtime, game: { ...game, world: { ...game.world,
    roomId: q('R06'), position: { safePositionId: q('R06.entry') }, completedObjectiveIds: [q('O01'), q('O02'), q('O05'), q('O06')],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...game.notebook, personalNotes: 'Keep the prism note.' } } });
  const effects = projection.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('MG02'), effectId: e.effectId, mode: 'once', receipt: { kind: 'minigame', id: q('MG02') } }));
  return { reg, state, effects, bindings, reduce: createReducer({ registry: reg, bindings }) };
}
// Explicit trusted reducer harness; it does not authorize player completion.
function apply(ctx: ReturnType<typeof prepared>, state: ReducerState, effects: readonly StateEffect[], id = 'completion') {
  const game = state.runtime.game!;
  return ctx.reduce(state, { actionId: id as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
    input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 't102-trusted-receipt-boundary', observations: [], acceptedEffects: effects } } });
}
afterAll(() => {
  for (const [p, hash] of Object.entries(hashes)) expect(createHash('sha256').update(read(p)).digest('hex')).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({ scope: 'Actual optics and isolated proposal/reducer results. No actual MG02 lifecycle or browser execution.', protectedInputs: hashes, receipts }, null, 2) + '\n');
});

describe('MG02 bounded authored candidate', () => {
  it('registers the current-schema projection and leaves the full variant inactive', () => {
    expect(registry().record(q('MG02'))?.kind).toBe('minigame');
    const { optionalActivity: _draft, ...base } = candidate; expect(base).toEqual(projection);
    expect(validateProposal(activity), JSON.stringify(validateProposal.errors)).toBe(true);
    expect(validateContent(input(candidate)).ok).toBe(false);
    expect(world.documents.some((d: any) => d.id === q('MG02'))).toBe(false);
  });
  it('keeps the reviewed canonical projection byte-equal and unloaded', () => {
    expect(read('content/spec001/minigames/MG02.json')).toBe(read('docs/evidence/spec001/optional/MG02/MG02.current-schema.json'));
    expect(world.documents.some((d: any) => d.id === q('MG02'))).toBe(false);
  });
  it('preserves T092 prerequisites, all six cases and optional-only optical depth', () => {
    const expected = oracle.activities.find((a: any) => a.activityId === q('MG02'));
    expect(candidate.prerequisite).toEqual({ kind: 'objective-complete', objectiveId: q('O06') });
    expect(candidate.ruleIds).toEqual(expected.ruleIds.map((id: string) => q(id)));
    expect(activity.reward.kind).toBe(expected.reward);
    expect([...activity.compatibilityCards.map(c => c.sourceCaseId), activity.practice.sourceCaseId, activity.delivery.sourceCaseId, activity.boundaryExample.sourceCaseId]).toEqual(expected.sourceCaseIds);
    expect(candidate.requiredForMainStory).toBe(false); expect(candidate.requiredScoreForMainStory).toBe(false);
    expect(candidate.requiresReflexTiming).toBe(false); expect(candidate.skippable).toBe(true);
    expect(candidate.timingDefault).toBe('off'); expect(activity.timingDefault).toBe('off'); expect(activity).not.toHaveProperty('timingCapability');
  });
  it('uses exact existing profile claims and discloses model limits', () => {
    expect(candidate.sourceClaims).toEqual(expect.arrayContaining(fullProfile.sourceClaims));
    expect(candidate.sourceClaims.map(c => c.sourceId).sort()).toEqual(['S03', 'S06', 'S07', 'S08', 'S10'].map(q).sort());
    expect(candidate.model.limitations.join(' ')).toContain('general background and supply no optical values');
    expect(JSON.stringify(candidate)).not.toContain('source-coverage contract');
    for (const text of ['component losses', 'overload', 'connector shape', 'independent understanding', 'repair']) expect(candidate.model.limitations.join(' ')).toContain(text);
    expect(candidate.profileIds).toEqual([q('PROFILE-OPTICAL')]);
  });
  it('binds the actual R06 abacus and captured safe entry without new scene assets', () => {
    const reg = registry(); const entry = activity.entryContexts[0]!;
    expect(entry).toEqual({ roomId: q('R06'), safePositionId: q('R06.entry'), hotspotId: q('HOTSPOT-fiber-r06-pr059') });
    expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: q('R06'), eligibleStates: ['stable-exploration'] });
    expect((reg.record(q('R06')) as S.room).hotspots.some(h => h.id === entry.hotspotId)).toBe(true);
    expect(activity.returnPolicy).toBe('captured-entry'); expect(JSON.stringify(candidate)).not.toContain('ASSET-');
  });
  it('records only one own fact and one explicit minigame completion', () => {
    expect(candidate.completionAchievementId).toBe(q('ACHIEVEMENT-MG02-complete'));
    expect(candidate.effects).toEqual([
      { kind: 'record-fact', effectId: q('EFFECT-MG02-notebook'), factId: q('FACT-MG02-completion') },
      { kind: 'complete-minigame', effectId: q('EFFECT-MG02-complete'), minigameId: q('MG02') },
    ]);
    expect(activity.reward).toEqual({ kind: 'optional-optical-depth', factId: q('FACT-MG02-completion') });
    expect(candidate.alternatives[0]).toMatchObject({ itemIds: [], abilityIds: [], effects: [] });
  });
  it('uses real O06 prerequisite and does not reverse the arrow', () => {
    const ctx = prepared(); const before = ctx.state.runtime.game!.world;
    expect(conditionSatisfied(projection.prerequisite as S.condition, { ...before, completedObjectiveIds: [] }, ctx.reg)).toBe(false);
    expect(conditionSatisfied(projection.prerequisite as S.condition, before, ctx.reg)).toBe(true);
    const broken = input(); broken.world.objectives.find(o => o.id === q('O06'))!.prerequisite = { kind: 'minigame-complete', minigameId: q('MG02') };
    expect(validateContent(broken).ok).toBe(false);
    receipts['OPT-MG02-LOCKED-BEFORE-OBJECTIVE:condition-only'] = { absentO06: false, completedO06: true, activityStarted: false };
  });
  it.each(['main-award', 'wrong-completion', 'missing-completion', 'objective-achievement'])('registry rejects %s', corruption => {
    const broken: any = structuredClone(projection);
    if (corruption === 'main-award') broken.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-MG02-bad'), objectiveId: q('O06') });
    if (corruption === 'wrong-completion') broken.effects[1].minigameId = q('MG01');
    if (corruption === 'missing-completion') broken.effects.pop();
    if (corruption === 'objective-achievement') broken.completionAchievementId = q('O06');
    expect(validateContent(input(broken)).ok).toBe(false);
  });
  it.each(['timing', 'profile', 'reward', 'source', 'loss', 'compatible', 'extra', 'entry', 'empty-instructions', 'missing-exit'])('proposal rejects %s', corruption => {
    const broken: any = structuredClone(activity);
    if (corruption === 'timing') broken.timingDefault = 'on';
    if (corruption === 'profile') broken.profileId = q('PROFILE-POWER');
    if (corruption === 'reward') broken.reward.kind = 'required-tool';
    if (corruption === 'source') broken.delivery.sourceCaseId = 'T04';
    if (corruption === 'loss') broken.delivery.loss.value = 9;
    if (corruption === 'compatible') broken.delivery.compatible = false;
    if (corruption === 'extra') broken.effects = candidate.effects;
    if (corruption === 'entry') broken.entryContexts[0].roomId = q('R05');
    if (corruption === 'empty-instructions') broken.instructions = [];
    if (corruption === 'missing-exit') delete broken.controls.exit;
    expect(validateProposal(broken)).toBe(false);
  });
});

describe('MG02 preserves the independent physical oracle', () => {
  it.each(['T04', 'T05', 'T15'] as const)('%s retains receive, reserve and physical status from the real evaluator', id => {
    const expected = oracle.cases.find((c: any) => c.id === 'OPT-MG02-BUDGETS').expected.cases.find((c: any) => c.caseId === id);
    const result = evaluateBenchAnswer(part(id), profile, action(answer(expected.receiveDbm, expected.marginDb, expected.marginDb >= 2 ? 'met' : 'shortfall')), version);
    expect(result.status).toBe('correct'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ physicalStatus: expected.status, physical: { receive: { value: expected.receiveDbm, unit: 'dBm' }, margin: { value: expected.marginDb, unit: 'dB' }, overload: false }, repaired: false, progressAward: 0, attemptPenalty: 0 });
    receipts[id] = result;
  });
  it.each(['C-COMPAT', 'T07', 'B-COMPAT'] as const)('%s invokes the actual scoped compatibility evaluator', id => {
    const card = activity.compatibilityCards.find(c => c.sourceCaseId === id)!;
    const result = evaluateCompatibilityCard({ sourceCaseId: card.sourceCaseId, premises: card.premises }, action({ kind: 'inspect-card' }), version);
    const expected = [...physical.referenceCases, ...physical.reviewCases].find((c: any) => c.id === id).expected;
    expect(result.status).toBe(expected.status); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ wholeRouteProven: false, serviceProven: false, powerBudgetProven: false });
    expect(result.observations[0]).not.toHaveProperty('receive'); receipts[id] = result;
    if (id === 'T07') expect(result.observations[0]).toMatchObject(oracle.cases.find((c: any) => c.id === 'OPT-MG02-INCOMPATIBLE').expected.status === 'incorrect' ? { usableLink: false, arithmeticCannotOverride: true } : {});
  });
  it('keeps an independently supplied overload observation separate from passive loss', () => {
    const ref = physical.referenceCases.find((c: any) => c.id === 'T06');
    const challenge: OpticalChallenge = { kind: 'optical-overload', compatible: ref.inputs.compatible, receive: ref.inputs.receivedObservation, maximumReceive: ref.inputs.maximumReceive };
    const result = evaluateOptics(challenge, action({ kind: 'measure-optics' }) as DomainAction<OpticalInput>, version);
    expect(result.status).toBe(ref.expected.status); expect(result.observations[0]).toMatchObject(ref.expected.observation);
    expect(result.observations[0]).not.toHaveProperty('margin'); receipts['T06:existing-unscored-context'] = result;
  });
  it('a learner diagnosis leaves the failing T05 plan failing and awards no effects', () => {
    const result = evaluateBenchAnswer(part('T05'), profile, action(answer()), version);
    expect(result).toMatchObject({ status: 'correct', acceptedEffects: [], observations: [{ physicalStatus: 'incorrect', physical: { sensitivityMet: true, reserveMet: false, overload: false }, repaired: false, wholeRouteProven: false, serviceProven: false }] });
  });
  it.each([answer(-11), answer(-13, 3), answer(-13, 1, 'met'), answer(-13, 1, 'shortfall', 'overloaded'), answer(-13.000000000000002)])('judges incorrect diagnosis without rounding or a penalty', supplied => {
    const result = evaluateBenchAnswer(part('T05'), profile, action(supplied), version);
    expect(result.status).toBe('incorrect'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ physicalStatus: 'incorrect', repaired: false, progressAward: 0, attemptPenalty: 0 });
  });
  it.each([null, {}, { ...answer(), status: 'correct' }, { ...answer(), effects: projection.effects }, { ...answer(), profile }, { ...answer(), context: version }, { ...answer(), receive: { value: '-13', unit: 'dBm' } }, { ...answer(), receive: { value: -13, unit: 'dB' } }, { ...answer(), receive: { value: Infinity, unit: 'dBm' } }, { ...answer(), margin: { value: NaN, unit: 'dB' } }, { ...answer(), margin: { value: 129, unit: 'dB' } }, { ...answer(), reserve: true }])('rejects malformed/unbounded input %j', supplied => {
    const result = evaluateBenchAnswer(part('T05'), profile, action(supplied), version);
    expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['revision', 'attempt'])('rejects stale %s without recapturing the action', field => {
    const now = field === 'revision' ? { ...version, configurationRevision: 4 as ConfigurationRevision } : { ...version, attemptId: 'later' as AttemptId };
    const result = evaluateBenchAnswer(part('T05'), profile, action(answer()), now);
    expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'stale-action', acceptedEffects: [] });
  });
  it.each([-128, -1, 0, 128])('finite signed margin %s is answer data, not invalid input', value => {
    expect(evaluateBenchAnswer(part('T05'), profile, action(answer(-13, value)), version).status).toBe('incorrect');
  });
  it.each([null, {}, { actionId: '', expectedVersion: version, input: answer() }])('rejects malformed envelope %j', envelope => {
    expect(evaluateBenchAnswer(part('T05'), profile, envelope as DomainAction<unknown>, version).status).toBe('invalid-input');
  });
  it('accepts decimals as predictions without coercion or silent rounding', () => {
    expect(evaluateBenchAnswer(part('T05'), profile, action(answer(-13.5, -0.5)), version).status).toBe('incorrect');
  });
  it.each(['loss', 'unit', 'source', 'compatible', 'extra', 'profile'])('authored %s corruption precedes absent learner input', corruption => {
    const broken: any = structuredClone(part('T05')); const p: any = structuredClone(profile);
    if (corruption === 'loss') broken.loss.value = 9;
    if (corruption === 'unit') broken.loss.unit = 'dBm';
    if (corruption === 'source') broken.sourceCaseId = 'T99';
    if (corruption === 'compatible') broken.compatible = false;
    if (corruption === 'extra') broken.gain = 1;
    if (corruption === 'profile') p.parameters.requiredMargin.value = 1;
    expect(evaluateBenchAnswer(broken, p, action(null), version).status).toBe('content-error');
  });
  it('rejects malformed compatibility content rather than inventing absent predicates', () => {
    const broken: any = structuredClone(activity.compatibilityCards[2]); delete broken.premises.requiredWavelengthDirectionMatches;
    expect(evaluateCompatibilityCard({ sourceCaseId: broken.sourceCaseId, premises: broken.premises }, action(null), version).status).toBe('content-error');
  });
});

describe('MG02 actual existing receipt boundary, separate from runtime authorization', () => {
  it('applies a whole once-only batch, preserving main progress, equipment and inventory', () => {
    const ctx = prepared(); const before = ctx.state.runtime.game!;
    const first = apply(ctx, ctx.state, ctx.effects); expect(first.status).toBe('applied');
    const replay = apply(ctx, first.state, ctx.effects, 'new-action'); expect(replay.status).toBe('no-op');
    const game = replay.state.runtime.game!;
    expect(game.world.achievementIds).toEqual([q('ACHIEVEMENT-MG02-complete')]); expect(game.notebook.factIds).toEqual([q('FACT-MG02-completion')]);
    expect({ ...game.world, achievementIds: [] }).toEqual(before.world);
    expect(game.notebook.personalNotes).toBe(before.notebook.personalNotes); expect(replay.state.runtime.persistence.pendingRequest).toBeNull();
    receipts['isolated-whole-batch-receipt'] = { first: first.status, replay: replay.status, achievementIds: game.world.achievementIds, factIds: game.notebook.factIds, pendingSave: replay.state.runtime.persistence.pendingRequest };
  });
  it.each([0, 1])('rejects partial batch index %s atomically', index => {
    const ctx = prepared(); const result = apply(ctx, ctx.state, [ctx.effects[index]!]);
    expect(result.status).toBe('rejected'); expect(result.state.runtime.game).toEqual(ctx.state.runtime.game);
  });
  it.each(['T04', 'T05', 'T15'] as const)('raw %s diagnosis grants no achievement or fact', id => {
    const ctx = prepared(); const game = ctx.state.runtime.game!;
    const result = ctx.reduce(ctx.state, { actionId: 'raw-diagnosis' as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input: { kind: 'apply', evaluation: evaluateBenchAnswer(part(id), profile, action(answer()), version) } });
    expect(result.state.runtime.game!.world.achievementIds).toEqual([]); expect(result.state.runtime.game!.notebook.factIds).toEqual([]);
  });
  it('registry-bound completion requires the actual achievement, not a retained fact', () => {
    const ctx = prepared(); const complete = apply(ctx, ctx.state, ctx.effects).state;
    const condition: S.condition = { kind: 'minigame-complete', minigameId: q('MG02') };
    expect(conditionSatisfied(condition, ctx.state.runtime.game!.world, ctx.reg)).toBe(false);
    expect(conditionSatisfied(condition, complete.runtime.game!.world, ctx.reg)).toBe(true);
    expect(conditionSatisfied(condition, complete.runtime.game!.world)).toBe(false);
    const factOnly = createReducerState({ ...ctx.state.runtime, game: { ...ctx.state.runtime.game!, notebook: complete.runtime.game!.notebook } });
    expect(conditionSatisfied(condition, factOnly.runtime.game!.world, ctx.reg)).toBe(false);
    expect(apply(ctx, factOnly, ctx.effects).status).toBe('applied');
    expect(apply({ ...ctx, reduce: createReducer({ registry: ctx.reg, bindings: ctx.bindings }) }, createReducerState(complete.runtime), ctx.effects, 'reconstructed').status).toBe('no-op');
  });
});

describe('O06 actual route remains independent of the optional bench', () => {
  it.each(['A', 'B'])('proves passive path %s before MG02 is eligible, without its reward', path => {
    const ctx = prepared(); const initial = ctx.state.runtime.game!;
    let state = createReducerState({ ...ctx.state.runtime, game: { ...initial, world: { ...initial.world,
      roomId: q('R05'), position: { safePositionId: q('R05.entry') }, completedObjectiveIds: [q('O01'), q('O02')], flags: {},
    } } });
    const resolver = createFiberScenarioResolver(ctx.reg);
    const reduce = createReducer({ registry: ctx.reg, bindings: [...fiberEffectBindings(ctx.reg), ...objectiveEffectBindings(ctx.reg)], objectiveScenario: resolver });
    const send = (input: ReducerInput) => {
      const game = state.runtime.game!;
      const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
      expect(result.status, result.reason).not.toBe('rejected'); state = result.state;
    };
    const choose = (suffix: string) => send({ kind: 'apply', evaluation: prepareFiberAction(ctx.reg, state.runtime.game!, q(`ACTION-fiber-${suffix}`)) });
    const prove = (objective: 'O05' | 'O06', n: string) => {
      const scenario = resolver(state.runtime.game!, q(objective)); if (!scenario) throw new Error('Missing actual fiber scenario');
      const id = `00000000-0000-4000-8000-0000000000${n}` as MeasurementId;
      send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q(objective), alternativeId: scenario.alternativeId, id } });
      send({ kind: 'objective', operation: { kind: 'submit', objectiveId: q(objective), alternativeId: scenario.alternativeId, measurementId: id } });
      expect(state.runtime.game!.world.completedObjectiveIds).toContain(q(objective));
    };
    expect(conditionSatisfied(projection.prerequisite as S.condition, state.runtime.game!.world, ctx.reg)).toBe(false);
    for (const suffix of ['read-matching', 'profile-matched', 'inspect-before', 'clean', 'reinspect-clean']) choose(suffix);
    prove('O05', '51');
    send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'isolated-walk', observations: [], acceptedEffects: [] }, destination: { roomId: q('R06'), safePositionId: q('R06.entry'), activity: 'stable-exploration' } });
    choose('read-compatibility'); choose(`path-${path}`); prove('O06', '61');
    const game = state.runtime.game!;
    expect(conditionSatisfied(projection.prerequisite as S.condition, game.world, ctx.reg)).toBe(true);
    expect(game.world.achievementIds).toEqual([]); expect(game.world.completedQuestIds).toEqual([]);
    expect(game.notebook.factIds).not.toContain(q('FACT-MG02-completion'));
    expect(game.world.inventory).toEqual(initial.world.inventory); expect(game.world.recruits).toEqual([]);
    receipts[`O06-before-MG02:${path}`] = { objectiveIds: game.world.completedObjectiveIds, achievementIds: game.world.achievementIds, benchNowEligible: true, pendingSave: state.runtime.persistence.pendingRequest };
  });
});
