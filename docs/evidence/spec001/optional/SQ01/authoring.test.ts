// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated T096 authoring/evaluator/reducer-boundary checks. T100 is not implemented here.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import { evaluateSymbolAnswer, type SymbolChallenge, type ToySymbolProfile, type ToySample } from '../../../../../src/domain/packet-journey';
import { createReducer, createReducerState, type EffectBinding, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, QualifiedId } from '../../../../../src/domain/types';
import type * as S from '../../../../../src/content/schema-types.generated';
import candidate from './SQ01.candidate.json' with { type: 'json' };
import projection from './SQ01.current-schema.json' with { type: 'json' };

const read = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const activity = candidate.optionalActivity;
const oracle = json('tests/fixtures/optional-activities.json');
const physical = json('tests/fixtures/physical-cases.json');
const source = json('content/spec001/sources.json');
const world = json('content/spec001/world.json');
const profile = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-SYMBOLS')) as ToySymbolProfile;
const originalFiles = ['tests/fixtures/optional-activities.json', 'tests/fixtures/companions.json', 'tests/fixtures/physical-cases.json', 'content/spec001/rooms/R04.json', 'content/spec001/sources.json'];
const hashes = Object.fromEntries(originalFiles.map(path => [path, createHash('sha256').update(read(path)).digest('hex')]));
const receipts: Record<string, unknown> = {};
const version = { configurationRevision: 3 as ConfigurationRevision, attemptId: '00000000-0000-4000-8000-000000000096' as AttemptId };
const action = (bits: unknown): DomainAction<{bits: string}> => ({ actionId: 'sq01-evaluate' as ActionId, expectedVersion: version, input: { bits: bits as string } });
const challenge = (practice = false): SymbolChallenge => ({ profile, samples: (practice ? activity.practice.samples : activity.delivery.samples) as ToySample[] });
function evaluate(bits: unknown, practice = false) { return evaluateSymbolAnswer(challenge(practice), action(bits), version); }
function input(quest: unknown = projection) {
  const metadata = structuredClone(world) as S.world;
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(metadata.documents.map(d => d.path))].map(path => [path, json(path)]));
  const path = 'content/spec001/quests/SQ01.json';
  metadata.documents.push({ kind: 'quest', id: q('SQ01'), path });
  documents[path] = structuredClone(quest);
  return { world: metadata, sources: source, documents };
}
function registry() {
  const result = validateContent(input());
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok || !result.registry) throw new Error('Candidate projection must pass actual registry validation');
  return result.registry;
}
const validateProposal = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/SQ01/optional-activity.schema.json'));
function prepared() {
  const reg = registry();
  const runtime = startIntroduction(createIntroductionRuntime(), reg);
  const game = runtime.game!;
  const state = createReducerState({ ...runtime, game: { ...game, world: { ...game.world,
    roomId: q('R04'), position: { safePositionId: q('R04.entry') },
    completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...game.notebook, personalNotes: 'Keep my own note.' } } });
  const effects = projection.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('SQ01'), effectId: e.effectId,
    mode: 'once', receipt: { kind: 'quest', id: q('SQ01') } }));
  return { state, effects, reduce: createReducer({ registry: reg, bindings }) };
}
// A trusted proposed adapter selects the actual authored complete batch. This helper
// proves the existing reducer contract, not a player-facing T100 controller.
function apply(ctx: ReturnType<typeof prepared>, state: ReducerState, effects: readonly StateEffect[], actionId = 'delivery') {
  const game = state.runtime.game!;
  return ctx.reduce(state, { actionId: actionId as ActionId, adventureId: game.adventureId,
    expectedVersion: game.world, input: { kind: 'apply', evaluation: {
      status: 'correct', reasonCode: 't096-trusted-adapter-boundary', observations: [], acceptedEffects: effects,
    } } });
}
afterAll(() => {
  for (const [path, hash] of Object.entries(hashes)) expect(createHash('sha256').update(read(path)).digest('hex')).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({
    scope: 'Actual existing evaluator returns only. No T100 activity execution, browser acceptance or produced media.',
    protectedInputs: hashes, receipts,
  }, null, 2) + '\n');
});

describe('SQ01 authored teaching and planned reward', () => {
  it('validates the current-schema projection against the real registry with a cloned document join', () => {
    expect(registry().record(q('SQ01'))?.kind).toBe('quest');
    const { optionalActivity: _draft, ...projected } = candidate;
    expect(projected).toEqual(projection);
  });
  it('keeps the canonical SQ01 record exactly equal to the current-schema projection', () => {
    expect(json('content/spec001/quests/SQ01.json')).toEqual(projection);
  });
  it('matches unchanged T092 identity, no prerequisite and reviewed source cases', () => {
    const expected = oracle.activities.find((a: any) => a.activityId === q('SQ01'));
    expect(candidate.id).toBe(expected.activityId);
    expect(candidate.prerequisite).toEqual({ kind: 'always' });
    expect(candidate.ruleIds).toEqual(expected.ruleIds.map((id: string) => q(id)));
    expect(candidate.requiredForMainStory).toBe(expected.rewardRequiredForMainStory);
    expect([activity.delivery.sourceCaseId, 'C-SYMBOL-WRONG', activity.practice.sourceCaseId]).toEqual(expected.sourceCaseIds);
  });
  it('copies source claims from the actual reviewed profile without inventing a serial standard', () => {
    const authored = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-SYMBOLS'));
    expect(candidate.sourceClaims).toEqual(authored.sourceClaims);
    expect(candidate.model.limitations.join(' ')).toMatch(/UART, RS-232/);
    expect(candidate.model.limitations.join(' ')).toMatch(/no elapsed transmission time/);
  });
  it('retains the independent full and one-symbol source inputs exactly', () => {
    for (const part of [activity.delivery, activity.practice]) {
      const reference = [...physical.referenceCases, ...physical.reviewCases].find((c: any) => c.id === part.sourceCaseId);
      expect(part.samples.map(({ position: _position, ...symbol }) => symbol)).toEqual(reference.inputs.symbols);
      expect(part.samples.map(s => s.position)).toEqual(part.samples.map((_, index) => index));
    }
  });
  it('uses the actual R04 post and safe origin; the shared return policy captures entry instead of moving the player', () => {
    const reg = registry();
    expect(activity.returnPolicy).toBe('captured-entry');
    expect(activity.entryContexts).toEqual([{ roomId: q('R04'), safePositionId: q('R04.entry'), hotspotId: q('HOTSPOT-echo-serial-post') }]);
    const entry = activity.entryContexts[0]!;
    expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: entry.roomId, eligibleStates: ['stable-exploration'] });
    expect(reg.has('hotspot', entry.hotspotId)).toBe(true);
    expect(candidate.evidence.every(e => e.roomId === entry.roomId)).toBe(true);
    expect(activity.recovery.exitExplanation).toContain('does not move you, refresh a measurement or save');
  });
  it('references the exact existing planned illustration allocation without asserting production', () => {
    const manifest = json('assets-src/manifest.json').assets.find((a: any) => a.assetId === activity.reward.assetId);
    expect(manifest).toMatchObject({ assetId: q('ASSET-ILLUSTRATION-08'), semanticIdentity: q('ILLUSTRATION-08'), kind: 'illustration' });
    const plan = json('assets-src/audio/production-plan.json');
    const find = (x: any): any => x && typeof x === 'object' ? x.assetId === activity.reward.assetId ? x : Object.values(x).map(find).find(Boolean) : undefined;
    expect(find(plan)).toMatchObject({ name: 'Antique serial message strip', roomId: q('R04'), intendedUse: 'journal', learningIntent: 'SQ01; serial context, no universal electrical profile' });
    expect(activity.reward).not.toHaveProperty('status');
    expect(activity.reward).not.toHaveProperty('url');
    expect(activity.reward.unavailableText).toContain('not available');
  });
  it('keeps correct, incorrect and missing-input feedback separate for practice and delivery', () => {
    const feedback: any = activity.feedback;
    expect(feedback.practice?.correct).toContain('two represented bits');
    expect(feedback.practice?.incorrect).toContain('+3 maps to 11');
    expect(feedback.practice?.incorrect).not.toContain('00101101');
    expect(feedback.practice?.invalidInput).toContain('practice');
    expect(feedback.delivery?.correct).toContain('00101101');
    expect(feedback.delivery?.incorrect).toContain('00101101');
    expect(feedback.delivery?.invalidInput).toContain('message');
  });
  it('declares one journal/completion batch with no main, inventory, party or repair effects', () => {
    expect(candidate.effects.map(e => e.kind)).toEqual(['record-fact', 'complete-quest']);
    expect(candidate.effects[0]).toMatchObject({ factId: activity.reward.factId });
    expect(candidate.alternatives).toHaveLength(1);
    expect(candidate.alternatives[0]).toMatchObject({ id: activity.delivery.actionId, method: 'direct-action', itemIds: [], abilityIds: [], effects: [] });
    expect(candidate.requiresReflexTiming).toBe(false);
    expect(candidate.skippable).toBe(true);
    expect(activity.timingDefault).toBe('off');
    expect(activity).not.toHaveProperty('timingCapability');
    expect(candidate.hints.solution.text).toContain('assisted completion');
  });
  it('rejects missing source coverage and mandatory progress awards through existing registry checks', () => {
    const broken: any = structuredClone(projection); broken.sourceClaims = [];
    expect(validateContent(input(broken)).ok).toBe(false);
    const wrong: any = structuredClone(projection); wrong.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-SQ01-bad'), objectiveId: q('O04') });
    const result = validateContent(input(wrong));
    expect(result.ok).toBe(false); expect(result.issues.some(i => i.code === 'objective-effect')).toBe(true);
  });
  it('rejects main prerequisite changes that make SQ01 mandatory', () => {
    const data = input(); data.world.objectives.find(o => o.id === q('O04'))!.prerequisite = { kind: 'quest-complete', questId: q('SQ01') };
    expect(validateContent(data).ok).toBe(false);
  });
});

describe('SQ01 actual decoder receipts against immutable T092 expectations', () => {
  it.each([
    ['OPT-SQ01-DECODE', '00101101', false],
    ['OPT-SQ01-WRONG-ORDER', '00011011', false],
    ['OPT-SQ01-ONE-SYMBOL', '11', true],
  ] as const)('%s executes the existing declared evaluator', (id, bits, practice) => {
    const expected = oracle.cases.find((c: any) => c.id === id).expected;
    const result = evaluate(bits, practice); receipts[id] = result;
    expect(result.status).toBe(expected.status);
    expect(result.acceptedEffects).toEqual([]);
    const observation = result.observations[0]!;
    expect(observation.kind).toBe('symbol-answer');
    if (observation.kind !== 'symbol-answer') throw new Error('Expected actual symbol answer');
    expect(observation.expectedBits).toBe(expected.bits ?? expected.expectedBits);
    if ('representedBits' in expected) expect(observation.trace.representedBits).toBe(expected.representedBits);
    if ('symbolCount' in expected) expect(observation.trace.symbols).toBe(expected.symbolCount);
    expect(observation.progressAward).toBe(0); expect(observation.attemptPenalty).toBe(0);
  });
  it.each([null, '', '0010 1101', '2', '0'.repeat(513)])('rejects malformed/missing answer %j without rewarding or penalizing', bits => {
    const result = evaluate(bits); expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ attemptPenalty: 0, progressAward: 0 });
  });
  it.each(['unknown-symbol', 'missing-position', 'reordered-position', 'missing-unit', 'changed-map'])('%s is a content fault before any learner judgment', corruption => {
    const c: any = structuredClone(challenge());
    if (corruption === 'unknown-symbol') c.samples[0].value = 2;
    if (corruption === 'missing-position') delete c.samples[0].position;
    if (corruption === 'reordered-position') c.samples.reverse();
    if (corruption === 'missing-unit') delete c.samples[0].unit;
    if (corruption === 'changed-map') c.profile.parameters.levels[0].bits = '11';
    const result = evaluateSymbolAnswer(c, action(null), version);
    receipts[corruption] = result;
    expect(result.status).toBe('content-error'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ attemptPenalty: 0, progressAward: 0 });
  });
  it('rejects an answer captured before the current attempt without refreshing its envelope', () => {
    const result = evaluateSymbolAnswer(challenge(), action('00101101'), { ...version, configurationRevision: 4 as ConfigurationRevision });
    receipts['stale-action'] = result;
    expect(result.status).toBe('invalid-input'); expect(result.reasonCode).toBe('stale-action'); expect(result.acceptedEffects).toEqual([]);
  });
});

describe('SQ01 proposed bounded authoring contract', () => {
  it('accepts the draft payload and keeps it intentionally outside the active schema', () => {
    expect(validateProposal(activity), JSON.stringify(validateProposal.errors)).toBe(true);
    expect(validateContent(input(candidate)).ok).toBe(false);
  });
  it.each(['empty-instructions', 'timed-default', 'extra-effects', 'missing-return', 'wrong-unit'])('rejects %s structurally', corruption => {
    const draft: any = structuredClone(activity);
    if (corruption === 'empty-instructions') draft.instructions = [];
    if (corruption === 'timed-default') draft.timingDefault = 'on';
    if (corruption === 'extra-effects') draft.reward.effects = candidate.effects;
    if (corruption === 'missing-return') delete draft.returnPolicy;
    if (corruption === 'wrong-unit') draft.delivery.samples[0].unit = 'V';
    expect(validateProposal(draft)).toBe(false);
  });
});

describe('SQ01 existing reducer receipt boundary, not activity-controller execution', () => {
  it('atomically records the optional fact and quest once, including replay with a new action ID', () => {
    const ctx = prepared(); const before = structuredClone(ctx.state.runtime.game!);
    const first = apply(ctx, ctx.state, ctx.effects); expect(first.status).toBe('applied');
    const second = apply(ctx, first.state, ctx.effects, 'new-action-same-delivery');
    expect(second.status).toBe('no-op');
    const game = second.state.runtime.game!;
    expect(game.world.completedQuestIds).toEqual([q('SQ01')]);
    expect(game.notebook.factIds).toEqual([q('FACT-SQ01-delivery')]);
    expect(game.world.completedObjectiveIds).toEqual(before.world.completedObjectiveIds);
    expect(game.world.inventory).toEqual(before.world.inventory);
    expect(game.world.recruits).toEqual(before.world.recruits);
    expect(game.world.route).toBe(before.world.route);
    expect(game.notebook.personalNotes).toBe(before.notebook.personalNotes);
    expect(second.state.runtime.persistence.pendingRequest).toBeNull();
  });
  it('does not award delivery from the raw correct practice evaluator receipt', () => {
    const ctx = prepared(); const game = ctx.state.runtime.game!;
    const result = ctx.reduce(ctx.state, { actionId: 'practice-only' as ActionId, adventureId: game.adventureId,
      expectedVersion: game.world, input: { kind: 'apply', evaluation: evaluate('11', true) } });
    expect(result.state.runtime.game!.world.completedQuestIds).toEqual([]);
    expect(result.state.runtime.game!.notebook.factIds).toEqual([]);
  });
  it('rejects an incomplete reward batch atomically', () => {
    const ctx = prepared(); const result = apply(ctx, ctx.state, ctx.effects.slice(0, 1));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error');
    expect(result.state.runtime.game).toEqual(ctx.state.runtime.game);
  });
});
