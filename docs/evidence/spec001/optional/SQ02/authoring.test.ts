// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated T097 checks. No shared optional controller/browser acceptance is asserted.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import { evaluatePower, type PowerChallenge, type PowerProfile } from '../../../../../src/domain/power';
import { createReducer, createReducerState, type EffectBinding, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, QualifiedId } from '../../../../../src/domain/types';
import type { GameState } from '../../../../../src/state/types';
import type * as S from '../../../../../src/content/schema-types.generated';
import { evaluateAuditAnswer, type PowerAuditCase } from './power-audit-proposal';
import candidate from './SQ02.candidate.json' with { type: 'json' };
import projection from './SQ02.current-schema.json' with { type: 'json' };

const read = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const activity = candidate.optionalActivity;
const oracle = json('tests/fixtures/optional-activities.json');
const physical = json('tests/fixtures/physical-cases.json');
const source = json('content/spec001/sources.json');
const world = json('content/spec001/world.json');
const profile = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-POWER')) as PowerProfile;
const protectedFiles = ['tests/fixtures/optional-activities.json', 'tests/fixtures/companions.json', 'tests/fixtures/physical-cases.json', 'content/spec001/rooms/R09.json', 'content/spec001/sources.json'];
const hashes = Object.fromEntries(protectedFiles.map(path => [path, createHash('sha256').update(read(path)).digest('hex')]));
const receipts: Record<string, unknown> = {};
const version = { configurationRevision: 3 as ConfigurationRevision, attemptId: '00000000-0000-4000-8000-000000000097' as AttemptId };
const action = (answer: unknown): DomainAction<unknown> => ({ actionId: 'sq02-evaluate' as ActionId, expectedVersion: version, input: answer });
const answer = (assessment: string, value: number) => ({ assessment, difference: { value, unit: 'W' } });
const part = (mode: 'practice' | 'delivery' | 'boundaryExample' = 'delivery'): PowerAuditCase => {
  const { sourceCaseId, demands, budgetBoundary, demandBoundary, otherConstraints } = activity[mode];
  return { sourceCaseId, demands, budgetBoundary, demandBoundary, otherConstraints } as PowerAuditCase;
};
const challenge = (mode: 'practice' | 'delivery' | 'boundaryExample' = 'delivery'): PowerChallenge => {
  const { sourceCaseId: _source, ...data } = part(mode); return { kind: 'delivered-power', profile, ...data };
};
const evaluate = (input: unknown, mode: 'practice' | 'delivery' | 'boundaryExample' = 'delivery') => evaluateAuditAnswer(part(mode), profile, action(input), version);
function input(quest: unknown = projection) {
  const metadata = structuredClone(world) as S.world;
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(metadata.documents.map(d => d.path))].map(path => [path, json(path)]));
  const path = 'content/spec001/quests/SQ02.json';
  metadata.documents.push({ kind: 'quest', id: q('SQ02'), path }); documents[path] = structuredClone(quest);
  return { world: metadata, sources: source, documents };
}
function registry() {
  const result = validateContent(input());
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok || !result.registry) throw new Error('SQ02 projection must pass actual registry');
  return result.registry;
}
const validateProposal = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/SQ02/optional-activity.schema.json'));
function prepared() {
  const reg = registry(), runtime = startIntroduction(createIntroductionRuntime(), reg), game = runtime.game!;
  const state = createReducerState({ ...runtime, game: { ...game, world: { ...game.world,
    roomId: q('R09'), position: { safePositionId: q('R09.entry') }, completedObjectiveIds: [q('O01'), q('O02')],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...game.notebook, personalNotes: 'Keep the ledger beside my own notes.' } } });
  const effects = projection.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('SQ02'), effectId: e.effectId, mode: 'once', receipt: { kind: 'quest', id: q('SQ02') } }));
  return { state, effects, reduce: createReducer({ registry: reg, bindings }) };
}
// Deliberately trusted reducer boundary only; T100 must select this batch from
// its matching live delivery session, never from an arbitrary correct result.
function apply(ctx: ReturnType<typeof prepared>, state: ReducerState, effects: readonly StateEffect[], actionId = 'full-audit') {
  const game = state.runtime.game!;
  return ctx.reduce(state, { actionId: actionId as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
    input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 't097-trusted-receipt-boundary', observations: [], acceptedEffects: effects } } });
}
// Proposed reward presentation predicate; actual common/UI binding stays pending.
const rewardUnlocked = (game: GameState) => game.world.completedQuestIds.includes(q('SQ02')) && game.notebook.factIds.includes(q('FACT-SQ02-audit'));
afterAll(() => {
  for (const [path, hash] of Object.entries(hashes)) expect(createHash('sha256').update(read(path)).digest('hex')).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({ scope: 'Actual evaluatePower returns plus isolated diagnosis proposal and existing reducer boundaries. No shared controller/browser/media acceptance.', protectedInputs: hashes, receipts }, null, 2) + '\n');
});

describe('SQ02 source, schema, entry and cosmetic allocation', () => {
  it('validates the current-schema projection in an isolated real registry join', () => {
    expect(registry().record(q('SQ02'))?.kind).toBe('quest');
    const { optionalActivity: _payload, ...projected } = candidate; expect(projected).toEqual(projection);
  });
  it('keeps the root-approved canonical quest byte-equal to the reviewed projection', () => {
    expect(read('content/spec001/quests/SQ02.json')).toBe(read('docs/evidence/spec001/optional/SQ02/SQ02.current-schema.json'));
  });
  it('preserves the frozen optional oracle and every exact reviewed demand card', () => {
    const expected = oracle.activities.find((a: any) => a.activityId === q('SQ02'));
    expect(candidate.prerequisite).toEqual({ kind: 'always' });
    expect(candidate.ruleIds).toEqual(expected.ruleIds.map((id: string) => q(id)));
    expect(candidate.requiredForMainStory).toBe(expected.rewardRequiredForMainStory);
    expect([activity.practice.sourceCaseId, activity.delivery.sourceCaseId, activity.boundaryExample.sourceCaseId]).toEqual(expected.sourceCaseIds);
    for (const mode of ['practice', 'delivery', 'boundaryExample'] as const) {
      const authored = activity[mode], reference = [...physical.referenceCases, ...physical.reviewCases].find((c: any) => c.id === authored.sourceCaseId);
      expect(authored.demands).toEqual(reference.inputs.demands); expect(authored.otherConstraints).toBe(true);
      expect(authored.budgetBoundary).toBe('delivered-after-losses'); expect(authored.demandBoundary).toBe('delivered-after-losses');
    }
  });
  it('uses the existing source-backed fictional allowance and states aggregate/port/data limits', () => {
    const declared = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-POWER'));
    expect(candidate.sourceClaims).toEqual(declared.sourceClaims); expect(candidate.sourceClaims[0]?.sourceId).toBe(q('S10'));
    expect(candidate.model.label).toBe('fictional-teaching-profile');
    expect(candidate.model.limitations.join(' ')).toMatch(/not a universal PoE/);
    expect(candidate.model.limitations.join(' ')).toMatch(/aggregate total cannot override/);
    expect(candidate.model.limitations.join(' ')).toMatch(/does not prove a data link/);
  });
  it('binds the actual Eel and safe R09 entry without a party or main-route prerequisite', () => {
    const reg = registry(), entry = activity.entryContexts[0]!;
    expect(entry).toEqual({ roomId: q('R09'), safePositionId: q('R09.entry'), hotspotId: q('HOTSPOT-market-eel') });
    expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: q('R09'), eligibleStates: ['stable-exploration'] });
    expect(reg.has('hotspot', entry.hotspotId)).toBe(true); expect(activity.speakerId).toBe(q('CH19'));
    expect(candidate.alternatives[0]).toMatchObject({ method: 'direct-action', itemIds: [], abilityIds: [], condition: { kind: 'always' }, effects: [] });
    expect(activity.returnPolicy).toBe('captured-entry'); expect(activity.timingDefault).toBe('off'); expect(candidate.skippable).toBe(true);
  });
  it('reuses the planned delivered-power ledger once as a cosmetic R02 print without a URL or item', () => {
    const asset = json('assets-src/manifest.json').assets.find((a: any) => a.assetId === activity.reward.assetId);
    const allocation = json('assets-src/audio/production-plan.json').illustrations.find((a: any) => a.assetId === activity.reward.assetId);
    expect(asset).toMatchObject({ assetId: q('ASSET-ILLUSTRATION-18'), kind: 'illustration', status: 'planned', countsTowardQuota: false, exports: [] });
    expect(allocation).toMatchObject({ name: 'Delivered-power ledger', roomId: q('R09'), intendedUse: 'journal', learningIntent: 'T10 / SQ02; 33 W demands exceed fictional delivered 30 W by 3 W' });
    expect(activity.reward).toMatchObject({ kind: 'workshop-decoration', roomId: q('R02'), factId: q('FACT-SQ02-audit') });
    expect(activity.reward).not.toHaveProperty('url'); expect(activity.reward).not.toHaveProperty('itemId');
    expect(candidate.effects.map(e => e.kind)).toEqual(['record-fact', 'complete-quest']);
    expect(candidate.effects[0]).toMatchObject({ factId: activity.reward.factId });
  });
  it('keeps diagnosis, unrepaired plan, assistance and no data proof explicit in player feedback', () => {
    expect(activity.feedback.delivery.correct).toContain('proposal remains over budget');
    expect(activity.feedback.delivery.correct).toContain('data connectivity is unproven');
    expect(activity.feedback.delivery.incorrect).toContain('3 W too much');
    expect(activity.feedback.practice.correct).toContain('7 W headroom');
    expect(activity.boundaryExample.explanation).toContain('0 W headroom');
    expect(candidate.hints.solution.text).toContain('assisted completion');
  });
  it('rejects an undocumented source and main-objective reward in the actual registry', () => {
    const missing = structuredClone(projection); missing.sourceClaims = []; expect(validateContent(input(missing)).ok).toBe(false);
    const wrong: any = structuredClone(projection); wrong.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-SQ02-wrong'), objectiveId: q('O09') });
    expect(validateContent(input(wrong)).ok).toBe(false);
    const data = input(); data.world.objectives.find(o => o.id === q('O09'))!.prerequisite = { kind: 'quest-complete', questId: q('SQ02') };
    expect(validateContent(data).ok).toBe(false);
  });
  it('accepts the closed proposed payload while the canonical schema does not yet support it', () => {
    expect(validateProposal(activity), JSON.stringify(validateProposal.errors)).toBe(true); expect(validateContent(input(candidate)).ok).toBe(false);
  });
  it.each(['timed', 'missing-exit', 'extra-effect', 'wrong-unit', 'changed-demand', 'source-swap', 'different-reward', 'missing-boundary', 'main-reward'])('rejects %s in the proposal schema', corruption => {
    const draft: any = structuredClone(activity);
    if (corruption === 'timed') draft.timingDefault = 'on';
    if (corruption === 'missing-exit') delete draft.controls.exit;
    if (corruption === 'extra-effect') draft.reward.effects = candidate.effects;
    if (corruption === 'wrong-unit') draft.delivery.demands[0].unit = 'dBm';
    if (corruption === 'changed-demand') draft.delivery.demands[2].value = 9;
    if (corruption === 'source-swap') draft.delivery.sourceCaseId = 'C-POWER';
    if (corruption === 'different-reward') draft.reward.assetId = q('ASSET-PR140');
    if (corruption === 'missing-boundary') delete draft.boundaryExample;
    if (corruption === 'main-reward') draft.reward.kind = 'repair-kit';
    expect(validateProposal(draft)).toBe(false);
  });
});

describe('actual delivered-power evaluator and independent T092 diagnosis expectations', () => {
  it.each([['practice', 'C-POWER'], ['delivery', 'T10'], ['boundaryExample', 'B-POWER-30']] as const)('%s executes %s through the existing evaluator', (mode, id) => {
    const expected = [...physical.referenceCases, ...physical.reviewCases].find((c: any) => c.id === id).expected;
    const result = evaluatePower(challenge(mode), { ...action(null), input: { kind: 'check-allocation' } }, version);
    receipts[id] = result; expect(result.status).toBe(expected.status); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ ...expected.observation, wholeRouteProven: false, accountingBoundary: 'delivered-after-losses' });
  });
  it('correctly diagnoses T10 without relabeling the failed physical plan', () => {
    const expected = oracle.cases.find((c: any) => c.id === 'OPT-SQ02-DIAGNOSE').expected;
    const result = evaluate(answer('over-budget', 3)); receipts['OPT-SQ02-DIAGNOSE'] = result;
    expect(result.status).toBe(expected.learnerStatus); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ kind: 'power-audit-answer', planStatus: expected.planStatus, learnerStatus: expected.learnerStatus,
      plan: { total: expected.total, excess: expected.excess }, repaired: false, dataLinkProven: expected.dataLinkProven, progressAward: 0 });
  });
  it.each([['practice', 7, 23], ['boundaryExample', 0, 30]] as const)('compares the %s answer with the actual inclusive observation', (mode, headroom, total) => {
    const result = evaluate(answer('within-budget', headroom), mode); receipts[`OPT-SQ02-POWER-BOUNDARIES-${mode}`] = result;
    expect(result.status).toBe('correct'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ planStatus: 'correct', plan: { total: { value: total, unit: 'W' }, headroom: { value: headroom, unit: 'W' } }, dataLinkProven: false });
  });
  it.each([answer('within-budget', 3), answer('over-budget', 2), answer('over-budget', 30), answer('over-budget', 3.000001)])('does not accept an incorrect diagnosis %j', wrong => {
    const result = evaluate(wrong); expect(result.status).toBe('incorrect'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ expectedAssessment: 'over-budget', expectedDifference: { value: 3, unit: 'W' }, repaired: false });
  });
  it('executes the frozen wrong-link-lamp answer as its physical claim, with zero completion', () => {
    const fixed = oracle.cases.find((c: any) => c.id === 'OPT-SQ02-WRONG-DIAGNOSIS');
    expect(fixed.inputs.answer).toBe('33-W-is-within-30-W-because-link-light-on');
    // The UI's closed assessment expresses the false within-budget claim. No lamp input can alter the physical challenge.
    const result = evaluate(answer('within-budget', 0)); receipts[fixed.id] = result;
    expect(result.status).toBe(fixed.expected.learnerStatus); expect(result.acceptedEffects).toHaveLength(fixed.expected.completionAward);
  });
  it.each([null, {}, '', answer('', 3), answer('over-budget', -1), answer('over-budget', Infinity),
    { assessment: 'over-budget', difference: { value: '3', unit: 'W' } }, { assessment: 'over-budget', difference: { value: 3 } },
    { assessment: 'over-budget', difference: { value: 3, unit: 'mW' } }, { ...answer('over-budget', 3), acceptedEffects: candidate.effects }])('rejects malformed input %j without grading it wrong', invalid => {
    const result = evaluate(invalid); expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['demand', 'unit', 'source', 'boundary', 'assumption', 'hidden-loss'])('rejects malformed %s content before missing learner input', corruption => {
    const broken: any = structuredClone(part());
    if (corruption === 'demand') broken.demands[2].value = 9;
    if (corruption === 'unit') delete broken.demands[0].unit;
    if (corruption === 'source') broken.sourceCaseId = 'new-ledger';
    if (corruption === 'boundary') broken.budgetBoundary = 'source-output';
    if (corruption === 'assumption') broken.otherConstraints = false;
    if (corruption === 'hidden-loss') broken.lineLoss = { value: 3, unit: 'W' };
    const result = evaluateAuditAnswer(broken, profile, action(null), version); receipts[`content-${corruption}`] = result;
    expect(result.status).toBe('content-error'); expect(result.acceptedEffects).toEqual([]);
  });
  it('rejects changed profile numbers rather than silently expanding the reviewed ceiling', () => {
    const changed = structuredClone(profile) as any; changed.parameters.deliveredBudget.value = 40;
    const result = evaluateAuditAnswer(part(), changed, action(null), version); receipts['changed-budget'] = result;
    expect(result.status).toBe('content-error');
  });
  it('executes the existing per-port incompatibility boundary without a new numeric port limit', () => {
    const { otherConstraints: _allChecks, ...c } = challenge('practice');
    const result = evaluatePower({ ...c, perPortConstraintsMet: false }, { ...action(null), input: { kind: 'check-allocation' } }, version);
    receipts['existing-per-port-boundary'] = result; expect(result.status).toBe('incorrect');
    expect(result.reasonCode).toBe('per-port-constraint-fails');
    expect(result.observations[0]).toMatchObject({ equipmentReady: false, budgetCannotOverride: true, wholeRouteProven: false });
    expect(result.acceptedEffects).toEqual([]);
  });
  it('executes B-POWER-COMPAT with its actual required-port incompatibility', () => {
    const fixed = physical.reviewCases.find((c: any) => c.id === 'B-POWER-COMPAT');
    const result = evaluatePower({ kind: 'delivered-power', profile, budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses',
      totalDemand: fixed.inputs.totalDemand, portPowerCompatible: fixed.inputs.oneRequiredPortCompatible }, { ...action(null), input: { kind: 'check-allocation' } }, version);
    receipts['B-POWER-COMPAT'] = result; expect(result.status).toBe(fixed.expected.status); expect(result.reasonCode).toBe(fixed.expected.observation.reason);
    expect(result.observations[0]).toMatchObject({ equipmentReady: false, budgetCannotOverride: fixed.expected.observation.budgetCannotOverride, wholeRouteProven: false });
  });
  it('accepts semantic quantity property order but rejects a sparse demand array', () => {
    const reordered = { ...part(), demands: part().demands.map(d => ({ unit: d.unit, value: d.value })) };
    expect(evaluateAuditAnswer(reordered, profile, action(answer('over-budget', 3)), version).status).toBe('correct');
    const missing = structuredClone(part()); delete (missing.demands as any[])[1];
    expect(evaluateAuditAnswer(missing, profile, action(null), version).status).toBe('content-error');
  });
  it('keeps a stale diagnosis capture invalid rather than refreshing it', () => {
    const result = evaluateAuditAnswer(part(), profile, action(answer('over-budget', 3)), { ...version, configurationRevision: 4 as ConfigurationRevision });
    receipts['stale-answer'] = result; expect(result.status).toBe('invalid-input'); expect(result.reasonCode).toBe('stale-action');
  });
});

describe('existing reducer exact receipt boundaries; shared activity integration remains pending', () => {
  it('awards only the exact audit/completion batch once and preserves required progress', () => {
    const ctx = prepared(), before = structuredClone(ctx.state.runtime.game!);
    const first = apply(ctx, ctx.state, ctx.effects); expect(first.status).toBe('applied');
    const second = apply(ctx, first.state, ctx.effects, 'new-action-same-audit'); expect(second.status).toBe('no-op');
    const game = second.state.runtime.game!; expect(game.world.completedQuestIds).toEqual([q('SQ02')]); expect(game.notebook.factIds).toEqual([q('FACT-SQ02-audit')]);
    expect(rewardUnlocked(game)).toBe(true);
    for (const field of ['inventory', 'completedObjectiveIds', 'activeAllyIds', 'recruits', 'route', 'flags'] as const) expect(game.world[field]).toEqual(before.world[field]);
    expect(game.notebook.personalNotes).toBe(before.notebook.personalNotes); expect(second.state.runtime.persistence.pendingRequest).toBeNull();
  });
  it.each(['fact-only', 'completion-only'])('rejects %s as an incomplete receipt batch', part => {
    const ctx = prepared(), effects = ctx.effects.filter(e => part === 'fact-only' ? e.kind === 'record-fact' : e.kind === 'complete-quest');
    const result = apply(ctx, ctx.state, effects); expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error');
    expect(result.state.runtime.game).toEqual(ctx.state.runtime.game);
  });
  it.each(['practice', 'wrong', 'missing', 'correct-diagnosis'])('raw %s proposal result cannot award anything by itself', kind => {
    const ctx = prepared(), game = ctx.state.runtime.game!;
    const evaluation = kind === 'practice' ? evaluate(answer('within-budget', 7), 'practice')
      : kind === 'wrong' ? evaluate(answer('within-budget', 0)) : kind === 'missing' ? evaluate(null) : evaluate(answer('over-budget', 3));
    const result = ctx.reduce(ctx.state, { actionId: kind as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input: { kind: 'apply', evaluation } });
    expect(result.state.runtime.game!.world.completedQuestIds).toEqual([]); expect(result.state.runtime.game!.notebook.factIds).toEqual([]);
  });
  it('rewinds actual quest receipt at the existing rollback boundary while retaining the audit fact, which cannot unlock the reward alone', () => {
    const ctx = prepared(), initial = ctx.state.runtime.game!, completed = apply(ctx, ctx.state, ctx.effects).state;
    const checkpoint = { adventureId: initial.adventureId, world: { ...initial.world, roomId: q<'room'>('R11'), position: { safePositionId: q<'safe-position'>('R11.preparation') } } };
    const failed: ReducerState = { ...completed, runtime: { ...completed.runtime, checkpoint, activity: { kind: 'terminal-failure' } } };
    const result = ctx.reduce(failed, { actionId: 'rewind-audit' as ActionId, adventureId: initial.adventureId, expectedVersion: failed.runtime.game!.world,
      input: { kind: 'rewind-preparation', nextAttemptId: '00000000-0000-4000-8000-000000000197' as AttemptId } });
    receipts['existing-rollback-boundary'] = { status: result.status, reason: result.reason };
    expect(result.status).toBe('applied'); const game = result.state.runtime.game!;
    expect(game.world.completedQuestIds).toEqual([]); expect(game.notebook.factIds).toEqual([q('FACT-SQ02-audit')]); expect(rewardUnlocked(game)).toBe(false);
    expect(game.world.inventory).toEqual(initial.world.inventory); expect(game.world.completedObjectiveIds).toEqual(initial.world.completedObjectiveIds);
    expect(game.notebook.personalNotes).toBe(initial.notebook.personalNotes); expect(result.state.runtime.persistence.pendingRequest).toBeNull();
    expect(game.world.configurationRevision).toBeGreaterThan(failed.runtime.game!.world.configurationRevision);
    const earnedAgain = apply(ctx, result.state, ctx.effects, 'fresh-valid-audit').state.runtime.game!;
    expect(rewardUnlocked(earnedAgain)).toBe(true); expect(earnedAgain.notebook.factIds).toEqual([q('FACT-SQ02-audit')]);
  });
});
