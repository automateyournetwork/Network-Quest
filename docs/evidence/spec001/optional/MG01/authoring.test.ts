// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated candidate, actual evaluator, and reducer boundaries; not native MG01 execution.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import { evaluateSymbolAnswer, type SymbolChallenge, type ToySymbolProfile, type ToySample } from '../../../../../src/domain/packet-journey';
import { createReducer, createReducerState, type EffectBinding, type ReducerInput, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { conditionSatisfied } from '../../../../../src/state/conditions';
import { equipmentInteractionBindings, createEquipmentScenarioResolver, resolveEquipmentScenario } from '../../../../../src/state/equipment-scenarios';
import { objectiveEffectBindings } from '../../../../../src/state/objectives';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, MeasurementId, QualifiedId } from '../../../../../src/domain/types';
import type * as S from '../../../../../src/content/schema-types.generated';
import candidate from './MG01.candidate.json' with { type: 'json' };
import projection from './MG01.current-schema.json' with { type: 'json' };

const read = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const activity = candidate.optionalActivity;
const oracle = json('tests/fixtures/optional-activities.json');
const physical = json('tests/fixtures/physical-cases.json');
const source = json('content/spec001/sources.json');
const world = json('content/spec001/world.json');
const profile = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-SYMBOLS')) as ToySymbolProfile;
const originalFiles = ['tests/fixtures/optional-activities.json', 'tests/fixtures/companions.json', 'tests/fixtures/physical-cases.json', 'content/spec001/rooms/R10.json', 'content/spec001/profiles.json', 'content/spec001/sources.json'];
const hashes = Object.fromEntries(originalFiles.map(path => [path, createHash('sha256').update(read(path)).digest('hex')]));
const receipts: Record<string, unknown> = {};
const version = { configurationRevision: 3 as ConfigurationRevision, attemptId: '00000000-0000-4000-8000-000000000113' as AttemptId };
const action = (bits: unknown): DomainAction<{bits: string}> => ({ actionId: 'mg01-evaluate' as ActionId, expectedVersion: version, input: { bits: bits as string } });
const challenge = (practice = false): SymbolChallenge => ({ profile, samples: (practice ? activity.practice.samples : activity.delivery.samples) as ToySample[] });
const evaluate = (bits: unknown, practice = false) => evaluateSymbolAnswer(challenge(practice), action(bits), version);
function input(record: unknown = projection) {
  const metadata = structuredClone(world) as S.world;
  metadata.documents = metadata.documents.filter(d => d.id !== q('MG01'));
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(metadata.documents.map(d => d.path))].map(path => [path, json(path)]));
  const path = 'content/spec001/minigames/MG01.json';
  metadata.documents.push({ kind: 'minigame', id: q('MG01'), path });
  documents[path] = structuredClone(record);
  return { world: metadata, sources: source, documents };
}
function registry() {
  const result = validateContent(input());
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok || !result.registry) throw new Error('MG01 projection must pass the actual registry');
  return result.registry;
}
const validateProposal = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/MG01/optional-activity.schema.json'));
function prepared() {
  const reg = registry();
  const runtime = startIntroduction(createIntroductionRuntime(), reg);
  const game = runtime.game!;
  const state = createReducerState({ ...runtime, game: { ...game, world: { ...game.world,
    roomId: q('R10'), position: { safePositionId: q('R10.entry') },
    completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...game.notebook, personalNotes: 'Keep my own note.' } } });
  const effects = projection.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('MG01'), effectId: e.effectId,
    mode: 'once', receipt: { kind: 'minigame', id: q('MG01') } }));
  return { reg, state, effects, bindings, reduce: createReducer({ registry: reg, bindings }) };
}
// This is a trusted reducer boundary harness, not a renderer or a production activity controller.
function apply(ctx: ReturnType<typeof prepared>, state: ReducerState, effects: readonly StateEffect[], actionId = 'completion') {
  const game = state.runtime.game!;
  return ctx.reduce(state, { actionId: actionId as ActionId, adventureId: game.adventureId,
    expectedVersion: game.world, input: { kind: 'apply', evaluation: {
      status: 'correct', reasonCode: 't101-trusted-reducer-boundary', observations: [], acceptedEffects: effects,
    } } });
}
afterAll(() => {
  for (const [path, hash] of Object.entries(hashes)) expect(createHash('sha256').update(read(path)).digest('hex')).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({
    scope: 'Actual decoder and isolated reducer/mandatory O10 results only. All eight MG01 lifecycle/native checks remain pending.',
    protectedInputs: hashes, receipts,
  }, null, 2) + '\n');
});

describe('MG01 authored lesson and optional-only completion', () => {
  it('registers its canonical projection in an isolated cloned document join', () => {
    expect(registry().record(q('MG01'))?.kind).toBe('minigame');
    const { optionalActivity: _draft, ...base } = candidate;
    expect(base).toEqual(projection);
  });
  it('keeps the approved unloaded canonical record byte-equal to the projection', () => {
    expect(read('content/spec001/minigames/MG01.json')).toBe(read('docs/evidence/spec001/optional/MG01/MG01.current-schema.json'));
    expect(world.documents.some((d: any) => d.id === q('MG01'))).toBe(false);
  });
  it('matches the unchanged T092 no-prerequisite and optional-practice-only contract', () => {
    const expected = oracle.activities.find((a: any) => a.activityId === q('MG01'));
    expect(candidate.id).toBe(expected.activityId);
    expect(candidate.prerequisite).toEqual({ kind: 'always' });
    expect(candidate.ruleIds).toEqual(expected.ruleIds.map((id: string) => q(id)));
    expect(activity.reward.kind).toBe(expected.reward);
    expect(candidate.requiredForMainStory).toBe(expected.rewardRequiredForMainStory);
    expect([activity.delivery.sourceCaseId, 'C-SYMBOL-WRONG', activity.practice.sourceCaseId]).toEqual(expected.sourceCaseIds);
  });
  it('uses exact existing reviewed source claims and declares its model limits', () => {
    expect(candidate.sourceClaims).toEqual((profile as any).sourceClaims);
    expect(candidate.model.label).toBe('toy-symbol-map');
    for (const phrase of ['volts', 'UART', 'PAM4', 'useful bits per second', 'Clockworks calibration']) expect(candidate.model.limitations.join(' ')).toContain(phrase);
  });
  it('retains the original T12 and B-SYMBOL inputs with explicit ascending positions', () => {
    for (const part of [activity.delivery, activity.practice]) {
      const reference = [...physical.referenceCases, ...physical.reviewCases].find((c: any) => c.id === part.sourceCaseId);
      expect(part.samples.map(({ position: _position, ...symbol }) => symbol)).toEqual(reference.inputs.symbols);
      expect(part.samples.map(s => s.position)).toEqual(part.samples.map((_, i) => i));
    }
  });
  it('uses the actual R10 loom and safe origin without changing existing O10 actions', () => {
    const reg = registry(); const entry = activity.entryContexts[0]!;
    expect(activity.entryContexts).toEqual([{ roomId: q('R10'), safePositionId: q('R10.entry'), hotspotId: q('HOTSPOT-clockworks-loom') }]);
    expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: entry.roomId, eligibleStates: ['stable-exploration'] });
    const room = reg.record(entry.roomId) as S.room;
    expect(room.hotspots.find(h => h.id === entry.hotspotId)?.actionIds).toEqual(expect.arrayContaining([q('ACTION-O10-step-and-decode'), q('ACTION-O10-notebook-and-replay')]));
    expect(candidate.evidence.every(e => e.roomId === entry.roomId)).toBe(true);
    expect(activity.returnPolicy).toBe('captured-entry');
  });
  it('declares only one own completion achievement and fact, with no item/media/main award', () => {
    expect(candidate.completionAchievementId).toBe(q('ACHIEVEMENT-MG01-complete'));
    expect(registry().has('achievement', candidate.completionAchievementId)).toBe(true);
    expect(candidate.effects).toEqual([
      { kind: 'record-fact', effectId: q('EFFECT-MG01-notebook'), factId: q('FACT-MG01-completion') },
      { kind: 'complete-minigame', effectId: q('EFFECT-MG01-complete'), minigameId: q('MG01') },
    ]);
    expect(activity.reward).toEqual({ kind: 'optional-practice-only', factId: q('FACT-MG01-completion') });
    expect(candidate.alternatives).toHaveLength(1);
    expect(candidate.alternatives[0]).toMatchObject({ id: activity.delivery.actionId, itemIds: [], abilityIds: [], effects: [], condition: { kind: 'always' } });
  });
  it('keeps practice/full feedback separate and records help without devaluing completion', () => {
    expect(activity.feedback.practice.incorrect).toContain('+3 maps to 11');
    expect(activity.feedback.practice.incorrect).not.toContain('00101101');
    expect(activity.feedback.delivery.incorrect).toContain('00101101');
    expect(activity.feedback.delivery.incorrect).toContain('does not match the supplied strip');
    expect(JSON.stringify(candidate)).not.toContain('O10');
    expect(candidate.hints.solution.text).toContain('assisted');
    expect(candidate.requiredScoreForMainStory).toBe(false);
    expect(candidate.requiresReflexTiming).toBe(false);
    expect(candidate.skippable).toBe(true);
    expect(candidate.timingDefault).toBe('off');
    expect(activity).not.toHaveProperty('timingCapability');
  });
  it('does not repurpose the existing O10 illustration allocation as an MG01 reward', () => {
    const plan = json('assets-src/audio/production-plan.json');
    const find = (x: any): any => x && typeof x === 'object' ? x.assetId === q('ASSET-ILLUSTRATION-19') ? x : Object.values(x).map(find).find(Boolean) : undefined;
    expect(find(plan)).toMatchObject({ name: 'Toy four-symbol key', roomId: q('R10'), intendedUse: 'diagnostic' });
    expect(JSON.stringify(candidate)).not.toContain('ASSET-');
  });
  it.each(['missing-source', 'main-award', 'wrong-minigame', 'missing-completion', 'objective-achievement'])('rejects %s through the actual registry', corruption => {
    const broken: any = structuredClone(projection);
    if (corruption === 'missing-source') broken.sourceClaims = [];
    if (corruption === 'main-award') broken.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-MG01-bad'), objectiveId: q('O10') });
    if (corruption === 'wrong-minigame') broken.effects[1].minigameId = q('MG02');
    if (corruption === 'missing-completion') broken.effects.pop();
    if (corruption === 'objective-achievement') broken.completionAchievementId = q('O10');
    expect(validateContent(input(broken)).ok).toBe(false);
  });
  it('rejects a mandatory O10 dependency on MG01', () => {
    const data = input(); data.world.objectives.find(o => o.id === q('O10'))!.prerequisite = { kind: 'minigame-complete', minigameId: q('MG01') };
    expect(validateContent(data).ok).toBe(false);
  });
});

describe('MG01 actual decoder receipts against immutable T092 expectations', () => {
  it.each([
    ['OPT-MG01-DECODE', '00101101', false],
    ['OPT-MG01-WRONG-ORDER', '00011011', false],
    ['OPT-MG01-ONE-SYMBOL', '11', true],
  ] as const)('%s executes the existing decoder', (id, bits, practice) => {
    const expected = oracle.cases.find((c: any) => c.id === id).expected;
    const result = evaluate(bits, practice); receipts[id] = result;
    expect(result.status).toBe(expected.status); expect(result.acceptedEffects).toEqual([]);
    const observation = result.observations[0]!;
    if (observation.kind !== 'symbol-answer') throw new Error('Expected actual symbol answer');
    expect(observation.expectedBits).toBe(expected.bits ?? expected.expectedBits);
    if ('representedBits' in expected) expect(observation.trace.representedBits).toBe(expected.representedBits);
    if ('symbolCount' in expected) expect(observation.trace.symbols).toBe(expected.symbolCount);
    expect(observation.progressAward).toBe(0); expect(observation.attemptPenalty).toBe(0);
  });
  it.each([null, '', '0010 1101', '2', '0'.repeat(513)])('rejects malformed or missing answer %j without progress or penalty', bits => {
    const result = evaluate(bits); if (bits === null) receipts['OPT-EMPTY-ANSWER'] = result;
    expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ attemptPenalty: 0, progressAward: 0 });
  });
  it.each(['unknown-symbol', 'missing-position', 'reordered-position', 'missing-unit', 'changed-map'])('%s precedes any learner judgment', corruption => {
    const c: any = structuredClone(challenge());
    if (corruption === 'unknown-symbol') c.samples[0].value = 2;
    if (corruption === 'missing-position') delete c.samples[0].position;
    if (corruption === 'reordered-position') c.samples.reverse();
    if (corruption === 'missing-unit') delete c.samples[0].unit;
    if (corruption === 'changed-map') c.profile.parameters.levels[0].bits = '11';
    const result = evaluateSymbolAnswer(c, action(null), version); receipts[corruption === 'unknown-symbol' ? 'OPT-MALFORMED-SYMBOLS' : corruption] = result;
    expect(result.status).toBe('content-error'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ attemptPenalty: 0, progressAward: 0 });
  });
  it.each(['revision', 'attempt'])('rejects a captured answer with a stale %s', field => {
    const current = field === 'revision' ? { ...version, configurationRevision: 4 as ConfigurationRevision } : { ...version, attemptId: 'later-attempt' as AttemptId };
    const result = evaluateSymbolAnswer(challenge(), action('00101101'), current);
    expect(result.status).toBe('invalid-input'); expect(result.reasonCode).toBe('stale-action'); expect(result.acceptedEffects).toEqual([]);
  });
  it('rejects caller-supplied verdict/effects instead of accepting a UI answer extension', () => {
    const forged: any = action('00101101'); forged.input.status = 'correct'; forged.input.effects = projection.effects;
    expect(evaluateSymbolAnswer(challenge(), forged, version).status).toBe('invalid-input');
  });
});

describe('MG01 closed proposed payload, not an active shared variant', () => {
  it('validates the proposal separately and leaves current shared runtime unavailable', () => {
    expect(validateProposal(activity), JSON.stringify(validateProposal.errors)).toBe(true);
    expect(validateContent(input(candidate)).ok).toBe(false);
  });
  it.each(['empty-instructions', 'timing', 'effects', 'missing-exit', 'missing-return', 'volts', 'profile', 'source', 'reward', 'changed-samples', 'practice-is-full', 'speaker', 'entry'])('rejects %s', corruption => {
    const draft: any = structuredClone(activity);
    if (corruption === 'empty-instructions') draft.instructions = [];
    if (corruption === 'timing') draft.timingDefault = 'on';
    if (corruption === 'effects') draft.effects = candidate.effects;
    if (corruption === 'missing-exit') delete draft.controls.exit;
    if (corruption === 'missing-return') delete draft.returnPolicy;
    if (corruption === 'volts') draft.delivery.samples[0].unit = 'V';
    if (corruption === 'profile') draft.profileId = q('PROFILE-POWER');
    if (corruption === 'source') draft.delivery.sourceCaseId = 'B-SYMBOL';
    if (corruption === 'reward') draft.reward.kind = 'journal-illustration';
    if (corruption === 'changed-samples') draft.delivery.samples[0].value = 3;
    if (corruption === 'practice-is-full') draft.practice.samples = draft.delivery.samples;
    if (corruption === 'speaker') draft.speakerId = q('CH13');
    if (corruption === 'entry') draft.entryContexts[0].roomId = q('R04');
    expect(validateProposal(draft)).toBe(false);
  });
});

describe('MG01 actual reducer receipt boundary, with no activity lifecycle claim', () => {
  it('records exactly one fact and achievement, then deduplicates a new action ID', () => {
    const ctx = prepared(); const before = ctx.state.runtime.game!;
    const first = apply(ctx, ctx.state, ctx.effects); expect(first.status).toBe('applied');
    const second = apply(ctx, first.state, ctx.effects, 'new-action'); expect(second.status).toBe('no-op');
    const game = second.state.runtime.game!;
    expect(game.world.achievementIds).toEqual([q('ACHIEVEMENT-MG01-complete')]);
    expect(game.notebook.factIds).toEqual([q('FACT-MG01-completion')]);
    for (const key of ['completedObjectiveIds', 'completedQuestIds', 'inventory', 'recruits', 'route', 'roomId', 'position'] as const) expect(game.world[key]).toEqual(before.world[key]);
    expect(game.notebook.personalNotes).toBe(before.notebook.personalNotes);
    expect(second.state.runtime.persistence.pendingRequest).toBeNull();
    receipts['isolated-minigame-receipt'] = { first: first.status, replay: second.status, achievementIds: game.world.achievementIds, factIds: game.notebook.factIds };
  });
  it.each([['11', true], ['00011011', false], [null, false], ['00101101', false]] as const)('raw decoder result %j cannot award completion', (bits, practice) => {
    const ctx = prepared(); const game = ctx.state.runtime.game!;
    const result = ctx.reduce(ctx.state, { actionId: 'raw-decoder' as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input: { kind: 'apply', evaluation: evaluate(bits, practice) } });
    expect(result.state.runtime.game!.world.achievementIds).toEqual([]);
    expect(result.state.runtime.game!.notebook.factIds).toEqual([]);
  });
  it.each([0, 1])('rejects partial effect %s atomically', index => {
    const ctx = prepared(); const result = apply(ctx, ctx.state, [ctx.effects[index]!]);
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error');
    expect(result.state.runtime.game).toEqual(ctx.state.runtime.game);
  });
  it('checks the registry-bound completion condition and rejects fact-only completion', () => {
    const ctx = prepared(); const condition: S.condition = { kind: 'minigame-complete', minigameId: q('MG01') };
    expect(conditionSatisfied(condition, ctx.state.runtime.game!.world, ctx.reg)).toBe(false);
    const complete = apply(ctx, ctx.state, ctx.effects).state.runtime.game!;
    expect(conditionSatisfied(condition, complete.world, ctx.reg)).toBe(true);
    expect(conditionSatisfied(condition, complete.world)).toBe(false);
    const factOnly = createReducerState({ ...ctx.state.runtime, game: { ...ctx.state.runtime.game!, notebook: complete.notebook } });
    expect(conditionSatisfied(condition, factOnly.runtime.game!.world, ctx.reg)).toBe(false);
    expect(apply(ctx, factOnly, ctx.effects).status).toBe('applied');
  });
  it('deduplicates completion after fresh reducer reconstruction from the existing achievement field', () => {
    const ctx = prepared(); const first = apply(ctx, ctx.state, ctx.effects);
    const reconstructed = createReducerState(first.state.runtime);
    expect(apply({ ...ctx, reduce: createReducer({ registry: ctx.reg, bindings: ctx.bindings }) }, reconstructed, ctx.effects, 'after-reconstruction').status).toBe('no-op');
  });
});

describe('O10 uses its actual mandatory calibration without starting or completing MG01', () => {
  it.each(['step-and-decode', 'notebook-and-replay'])('completes through %s with no minigame score', method => {
    const ctx = prepared(); let state = ctx.state;
    const reduce = createReducer({ registry: ctx.reg, bindings: [...objectiveEffectBindings(ctx.reg), ...equipmentInteractionBindings(ctx.reg).effects], objectiveScenario: createEquipmentScenarioResolver(ctx.reg) });
    const controls = (json('content/spec001/dialogue/equipment-actions.json') as S.collection).records.filter((r): r is S.dialogue => r.kind === 'dialogue');
    const send = (input: ReducerInput) => {
      const game = state.runtime.game!;
      const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
      expect(result.status, result.reason).not.toBe('rejected'); state = result.state;
    };
    for (const suffix of ['equipment-mode-100-full', `clock-${method}`, 'clock-role-physical', 'clock-read-scope', ...['00', '10', '11', '01'].map((pair, i) => `clock-pair-${i}-${pair}`)]) {
      const choice = controls.flatMap(d => d.nodes.flatMap(n => n.choices)).find(c => c.id === q(`ACTION-${suffix}`))!;
      send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-preparation-choice', observations: [], acceptedEffects: choice.effects as StateEffect[] } });
    }
    const scenario = resolveEquipmentScenario(state.runtime.game!, q('O10'))!;
    const id = '00000000-0000-4000-8000-000000000113' as MeasurementId;
    send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q('O10'), alternativeId: scenario.alternativeId, id } });
    send({ kind: 'objective', operation: { kind: 'submit', objectiveId: q('O10'), alternativeId: scenario.alternativeId, measurementId: id } });
    expect(state.runtime.game!.world.completedObjectiveIds).toContain(q('O10'));
    expect(state.runtime.game!.world.achievementIds).toEqual([]);
    expect(state.runtime.game!.notebook.factIds).not.toContain(q('FACT-MG01-completion'));
    receipts[`OPT-MG01-NO-O10-SCORE:${method}`] = { objectiveIds: state.runtime.game!.world.completedObjectiveIds, achievementIds: state.runtime.game!.world.achievementIds, pendingSave: state.runtime.persistence.pendingRequest };
  });
});
