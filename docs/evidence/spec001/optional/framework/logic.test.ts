// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateContent, type ContentRegistry } from '../../../../../src/content/registry';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { createReducer, createReducerState, type StateEffect, type EffectBinding } from '../../../../../src/state/reducer';
import { evaluateOptionalAnswer, finalizeOptionalSession, optionalActivityContentIssues, optionalEffectBindings, optionalRewardAllocationMatches, prepareOptionalActivityChange as prepareWithOwner, rewindOptionalPreparation,
  type OptionalActivityDefinition, type OptionalActivitySession } from '../../../../../src/state/optional-activities';
import type { ActionId, AttemptId, QualifiedId } from '../../../../../src/domain/types';
import { copperEffectBindings, prepareCopperAction } from '../../../../../src/state/copper-scenario';
import { projectOptionalActivity } from '../../../../../src/ui/optional-activities';
import type * as S from '../../../../../src/content/schema-types.generated';
import type { ClientGeneration } from '../../../../../src/state/types';
import candidate from '../SQ01/SQ01.candidate.json' with { type: 'json' };
import projection from '../SQ01/SQ01.current-schema.json' with { type: 'json' };

const json = (path: string): any => JSON.parse(readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8'));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const definition = candidate as unknown as OptionalActivityDefinition;
const sessionId = '00000000-0000-4000-8000-000000000100';
// Actual initial guest runtime generation; dedicated negative below varies it.
const prepareOptionalActivityChange = (...args: [Parameters<typeof prepareWithOwner>[0], Parameters<typeof prepareWithOwner>[1], Parameters<typeof prepareWithOwner>[2],
  Parameters<typeof prepareWithOwner>[3], Parameters<typeof prepareWithOwner>[4], Parameters<typeof prepareWithOwner>[5]?]) => prepareWithOwner(args[0], args[1], args[2], args[3], args[4], args[5], 0 as ClientGeneration);
let cachedRegistry: ContentRegistry | undefined;
function registry() {
  if (cachedRegistry) return cachedRegistry;
  const world = json('content/spec001/world.json') as S.world;
  const documents = Object.fromEntries(world.documents.map(d => [d.path, json(d.path)]));
  const path = 'content/spec001/quests/SQ01.json';
  if (!world.documents.some(d => d.id === q('SQ01'))) world.documents.push({ kind: 'quest', id: q('SQ01'), path }); documents[path] = projection;
  const loaded = validateContent({ world, sources: json('content/spec001/sources.json'), documents });
  expect(loaded.ok, JSON.stringify(loaded.issues)).toBe(true);
  if (!loaded.ok || !loaded.registry) throw Error('Existing projection must validate');
  const base = loaded.registry;
  // Explicit proposal join while the shared schema window belongs to T094. No
  // caller answer/effect is admitted: all non-SQ01 records are actual registry data.
  cachedRegistry = { ...base, record: id => id === definition.id ? definition as unknown as S.authoredRecord : base.record(id) };
  return cachedRegistry;
}
function fixture() {
  const reg = registry();
  const runtime = startIntroduction(createIntroductionRuntime(), reg), initial = runtime.game!;
  const game = { ...initial, world: { ...initial.world, roomId: q<'room'>('R04'), position: { safePositionId: q<'safe-position'>('R04.entry') },
    completedObjectiveIds: [q<'objective'>('O01'), q<'objective'>('O02')], inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...initial.notebook, personalNotes: 'Keep this observation.' } };
  const state = createReducerState({ ...runtime, game });
  return { registry: reg, game, state };
}
function start() {
  const ctx = fixture();
  const out = prepareOptionalActivityChange(ctx.registry, ctx.game, { kind: 'stable-exploration' }, null,
    { kind: 'start', activityId: q('SQ01'), hotspotId: q('HOTSPOT-echo-serial-post'), sessionId });
  expect(out.ok, JSON.stringify(optionalActivityContentIssues(definition, ctx.registry))).toBe(true); if (!out.ok || !out.session) throw Error('Expected session');
  return { ...ctx, session: out.session };
}
function check(bits: unknown, mode: 'practice' | 'delivery') {
  const ctx = fixture();
  return evaluateOptionalAnswer(ctx.registry, definition, mode, { actionId: 'answer' as ActionId, expectedVersion: ctx.game.world, input: { bits: bits as string } }, ctx.game);
}

describe('T100 real SQ01 shared logic before shared-schema join', () => {
  it('starts at the exact authored origin with instructions, practice and untimed exit', () => {
    const ctx = start(); expect(ctx.session.phase).toBe('instructions'); expect(ctx.session.mode).toBeNull();
    expect(ctx.session.entry).toEqual(candidate.optionalActivity.entryContexts[0]);
    expect(ctx.session.preparation).toEqual(ctx.game.world); expect(ctx.session.preparation).not.toBe(ctx.game.world);
    expect(ctx.session.timingEnabled).toBe(false);
  });
  it.each(['11', '00101101'])('practice cannot select delivery rewards for answer %s', bits => {
    const out = check(bits, 'practice'); expect(out.evaluation.acceptedEffects).toEqual([]);
    expect(out.feedback).not.toContain('00101101'); expect(out.assistanceLevel).toBe(2);
  });
  it.each([null, '', '2', '0010 1101'])('invalid answer %j cannot award progress', bits => {
    const out = check(bits, 'delivery'); expect(out.evaluation.status).toBe('invalid-input'); expect(out.evaluation.acceptedEffects).toEqual([]);
    expect(out.assistanceLevel).toBeNull();
  });
  it('selects the actual full quest/fact batch only after correct delivery', () => {
    expect(check('00011011', 'delivery')).toMatchObject({ evaluation: { status: 'incorrect', acceptedEffects: [] }, assistanceLevel: 3 });
    expect(check('11', 'delivery').evaluation.acceptedEffects).toEqual([]);
    const out = check('00101101', 'delivery'); expect(out.evaluation.status).toBe('correct');
    expect(out.evaluation.acceptedEffects).toEqual(candidate.effects);
  });
  it('binds the original reward once and rejects a partial batch', () => {
    const ctx = fixture(), bindings = optionalEffectBindings(definition);
    expect(bindings).toEqual(candidate.effects.map(e => ({ sourceId: candidate.id, effectId: e.effectId, mode: 'once', receipt: { kind: 'quest', id: candidate.id } })));
    const reduce = createReducer({ registry: ctx.registry, bindings: bindings as EffectBinding[] });
    const apply = (state: typeof ctx.state, effects: readonly StateEffect[], actionId: string) => reduce(state, { actionId: actionId as ActionId,
      adventureId: ctx.game.adventureId, expectedVersion: state.runtime.game!.world, input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'checked-full-message', observations: [], acceptedEffects: effects } } });
    const effects = check('00101101', 'delivery').evaluation.acceptedEffects;
    expect(apply(ctx.state, effects.slice(0, 1), 'partial').status).toBe('rejected');
    const first = apply(ctx.state, effects, 'first'), replay = apply(first.state, effects, 'replay');
    expect(first.status).toBe('applied'); expect(replay.status).toBe('no-op');
    expect(replay.state.runtime.game!.world.completedQuestIds).toEqual([q('SQ01')]);
    expect(replay.state.runtime.game!.world.inventory).toEqual(ctx.game.world.inventory);
  });
  it('never treats a retained journal fact as completed delivery', () => {
    const ctx = fixture(), game = { ...ctx.game, notebook: { ...ctx.game.notebook, factIds: [q<'fact'>('FACT-SQ01-delivery')] } };
    const out = evaluateOptionalAnswer(ctx.registry, definition, 'delivery', { actionId: 'redo' as ActionId, expectedVersion: game.world, input: { bits: '00101101' } }, game);
    expect(out.evaluation.acceptedEffects).toEqual(candidate.effects);
  });
  it('retains accepted completion across same-session retry and a later replay session', () => {
    const ctx = start(), answer = { actionId: 'delivery' as ActionId, expectedVersion: ctx.game.world, input: {} };
    const selected = prepareOptionalActivityChange(ctx.registry, ctx.game, { kind: 'active-optional' }, { ...ctx.session, mode: 'delivery', phase: 'solving' },
      { kind: 'submit', sessionId, bits: '00101101' }, answer);
    expect(selected.ok).toBe(true); if (!selected.ok) return;
    const reduce = createReducer({ registry: ctx.registry, bindings: optionalEffectBindings(definition) });
    const accepted = reduce(ctx.state, { ...answer, adventureId: ctx.game.adventureId, input: { kind: 'apply', evaluation: selected.evaluation } });
    expect(accepted.status).toBe('applied'); const completed = accepted.state.runtime.game!;
    const session = finalizeOptionalSession(selected.session, completed, ctx.registry)!;
    const retry = prepareOptionalActivityChange(ctx.registry, completed, { kind: 'active-optional' }, session,
      { kind: 'retry', sessionId, nextAttemptId: '00000000-0000-4000-8000-000000000102' as AttemptId });
    expect(retry.ok).toBe(true); if (!retry.ok) return;
    expect(retry.retry?.preparation.completedQuestIds).toEqual([q('SQ01')]);
    expect(evaluateOptionalAnswer(ctx.registry, definition, 'delivery', { ...answer, input: { bits: '00101101' } }, completed).evaluation.acceptedEffects).toEqual([]);
    const later = prepareOptionalActivityChange(ctx.registry, completed, { kind: 'stable-exploration' }, null,
      { kind: 'start', activityId: q('SQ01'), hotspotId: q('HOTSPOT-echo-serial-post'), sessionId: '00000000-0000-4000-8000-000000000103' });
    expect(later.ok && later.session?.preparation.completedQuestIds).toEqual([q('SQ01')]);
  });
  it('refuses new assistance at the save limit without changing world or showing unrecorded help', () => {
    const ctx = start(), game = { ...ctx.game, assistance: Array.from({ length: 2048 }, (_, index) => ({ objectiveId: q<'objective'>('O10'), hintId: q<'hint'>('HINT-clock-method'),
      level: 1 as const, attemptId: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}` as AttemptId })) };
    const before = structuredClone(game);
    const result = prepareOptionalActivityChange(ctx.registry, game, { kind: 'active-optional' }, ctx.session, { kind: 'hint', sessionId });
    expect(result).toEqual({ ok: false, reason: 'invalid-state' }); expect(game).toEqual(before);
    const wrong = prepareOptionalActivityChange(ctx.registry, game, { kind: 'active-optional' }, { ...ctx.session, mode: 'delivery' }, { kind: 'submit', sessionId, bits: '11' },
      { actionId: 'wrong-at-limit' as ActionId, expectedVersion: game.world, input: {} });
    expect(wrong).toEqual({ ok: false, reason: 'invalid-state' });
  });
  it.each([null, {}, { position: 0 }, { position: 0, value: -3 }])('malformed authored sample %j returns a content fault before learner scoring', sample => {
    const ctx = fixture(), malformed: any = structuredClone(candidate); malformed.optionalActivity.delivery.samples[0] = sample;
    expect(optionalActivityContentIssues(malformed, ctx.registry).length).toBeGreaterThan(0);
    expect(evaluateOptionalAnswer(ctx.registry, malformed, 'delivery', { actionId: 'malformed' as ActionId, expectedVersion: ctx.game.world, input: { bits: '' } }, ctx.game).evaluation.status).toBe('content-error');
  });
  it('exits all phases without replacing the current world or returning to another room', () => {
    for (const phase of ['instructions', 'practice', 'solving', 'feedback'] as const) {
      const ctx = start(); const session: OptionalActivitySession = { ...ctx.session, phase };
      const out = prepareOptionalActivityChange(ctx.registry, ctx.game, { kind: 'active-optional' }, session, { kind: 'exit', sessionId });
      expect(out.ok).toBe(true); if (!out.ok) continue;
      expect(out.game).toBe(ctx.game); expect(out.session).toBeNull(); expect(out.activity).toEqual({ kind: 'stable-exploration' });
    }
  });
  it('requests a new retry attempt and preserved preparation without granting anything', () => {
    const ctx = start(), nextAttemptId = '00000000-0000-4000-8000-000000000101' as AttemptId;
    const out = prepareOptionalActivityChange(ctx.registry, ctx.game, { kind: 'active-optional' }, ctx.session, { kind: 'retry', sessionId, nextAttemptId });
    expect(out.ok).toBe(true); if (!out.ok) return;
    expect(out.retry).toEqual({ preparation: ctx.game.world, nextAttemptId }); expect(out.evaluation.acceptedEffects).toEqual([]);
    expect(out.game.notebook.personalNotes).toBe(ctx.game.notebook.personalNotes);
  });
  it('shared recovery restores an actual authored configuration change without inventing a SQ01 intervention', () => {
    const ctx = start(), actionId = 'actual-copper-exhibit-choice' as ActionId;
    // The existing copper adapter really changes the R04 repeater interpretation.
    // This exercises the common recovery primitive, not a nonexistent SQ01 action.
    const evaluated = prepareCopperAction(ctx.registry, ctx.game, q('ACTION-copper-repeater-bridges-open'));
    const reduce = createReducer({ registry: ctx.registry, bindings: copperEffectBindings(ctx.registry) });
    const changed = reduce(ctx.state, { actionId, adventureId: ctx.game.adventureId, expectedVersion: ctx.game.world, input: { kind: 'apply', evaluation: evaluated } });
    expect(changed.status).toBe('applied'); const current = changed.state.runtime.game!;
    expect(current.world.flags[q<'flag'>('FLAG-copper-repeater-claim')]).toBe('bridges-open');
    expect(current.world.configurationRevision).toBeGreaterThan(ctx.game.world.configurationRevision);
    const result = rewindOptionalPreparation(current, ctx.session, '00000000-0000-4000-8000-000000000104' as AttemptId, changed.state.control);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.game.world.flags).toEqual(ctx.session.preparation.flags);
    expect(result.game.world.inventory).toEqual(ctx.game.world.inventory);
    expect(result.game.world.configurationRevision).toBeGreaterThan(current.world.configurationRevision);
    expect(result.game.notebook.personalNotes).toBe(current.notebook.personalNotes);
    expect(result.game.assistance).toEqual(current.assistance);
    expect(result.game.world.completedQuestIds).toEqual([]);
    expect(changed.state.runtime.persistence.pendingRequest).toBeNull();
  });
  it('projects the exact toy map, separate practice strip, and receipt-gated unavailable reward', () => {
    const ctx = start(), practice = projectOptionalActivity(ctx.registry, ctx.game, { ...ctx.session, mode: 'practice', phase: 'practice' });
    expect(practice?.map).toEqual(['−3 → 00', '−1 → 01', '+1 → 10', '+3 → 11']);
    expect(practice?.samples).toEqual(['Position 0: +3 toy-level']); expect(practice?.rewardText).toBeNull();
    const retained = { ...ctx.game, notebook: { ...ctx.game.notebook, factIds: [q<'fact'>('FACT-SQ01-delivery')] } };
    expect(projectOptionalActivity(ctx.registry, retained, ctx.session)?.rewardText).toBeNull();
    const completed = { ...retained, world: { ...retained.world, completedQuestIds: [q<'quest'>('SQ01')] } };
    expect(projectOptionalActivity(ctx.registry, completed, ctx.session)?.rewardText).toBe(`${candidate.optionalActivity.reward.alternativeText} ${candidate.optionalActivity.reward.unavailableText}`);
  });
  it('resolves the real planned manifest identity and rejects missing, duplicated or mismatched allocation', () => {
    const manifest = json('assets-src/manifest.json'); expect(optionalRewardAllocationMatches(definition, manifest)).toBe(true);
    const selected = manifest.assets.find((row: any) => row.assetId === candidate.optionalActivity.reward.assetId);
    expect(selected.status).toBe('planned'); expect(selected.exports).toEqual([]);
    expect(optionalRewardAllocationMatches(definition, { assets: [] })).toBe(false);
    expect(optionalRewardAllocationMatches(definition, { assets: [selected, selected] })).toBe(false);
    expect(optionalRewardAllocationMatches(definition, { assets: [{ ...selected, semanticIdentity: q('ILLUSTRATION-09') }] })).toBe(false);
    expect(optionalRewardAllocationMatches(definition, { assets: [{ ...selected, kind: 'prop' }] })).toBe(false);
  });
  it('rejects wrong entry or wrong activity session', () => {
    const ctx = start();
    expect(prepareOptionalActivityChange(ctx.registry, ctx.game, { kind: 'active-optional' }, ctx.session, { kind: 'exit', sessionId: '00000000-0000-4000-8000-000000000999' })).toMatchObject({ ok: false });
    expect(prepareOptionalActivityChange(ctx.registry, { ...ctx.game, world: { ...ctx.game.world, roomId: q<'room'>('R05') } }, { kind: 'stable-exploration' }, null,
      { kind: 'start', activityId: q('SQ01'), hotspotId: q('HOTSPOT-echo-serial-post'), sessionId })).toMatchObject({ ok: false });
  });
  it('rejects equal-world activity callbacks after account generation replacement', () => {
    const ctx = start(); expect(ctx.state.runtime.auth.clientGeneration).toBe(0);
    const result = prepareWithOwner(ctx.registry, ctx.game, { kind: 'active-optional' }, ctx.session,
      { kind: 'exit', sessionId }, undefined, 1 as ClientGeneration);
    expect(result).toEqual({ ok: false, reason: 'invalid-state' });
  });
  it.each(['profile', 'source-case', 'sample-order', 'reward', 'hotspot', 'anchor', 'main-award', 'duplicate-effect'])('rejects %s semantic corruption', kind => {
    const ctx = fixture(), broken: any = structuredClone(candidate);
    if (kind === 'profile') broken.optionalActivity.profileId = q('PROFILE-RADIO');
    if (kind === 'source-case') broken.optionalActivity.delivery.sourceCaseId = 'B-SYMBOL';
    if (kind === 'sample-order') broken.optionalActivity.delivery.samples.reverse();
    if (kind === 'reward') broken.optionalActivity.reward.factId = q('FACT-SQ01-instructions');
    if (kind === 'hotspot') broken.optionalActivity.entryContexts[0].hotspotId = q('HOTSPOT-absent');
    if (kind === 'anchor') broken.optionalActivity.entryContexts[0].safePositionId = q('R05.entry');
    if (kind === 'main-award') broken.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-SQ01-main'), objectiveId: q('O10') });
    if (kind === 'duplicate-effect') broken.effects.push(broken.effects[0]);
    expect(optionalActivityContentIssues(broken, ctx.registry).length).toBeGreaterThan(0);
  });
});
