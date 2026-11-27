// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Scoped proposal and actual existing state boundaries; not a browser journey.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { validateContent, type ContentRegistry } from '../../../../../src/content/registry';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { createReducer, createReducerState, type EffectBinding, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { copperEffectBindings, prepareCopperAction } from '../../../../../src/state/copper-scenario';
import { fiberEffectBindings, prepareFiberAction } from '../../../../../src/state/fiber-scenario';
import { equipmentInteractionBindings } from '../../../../../src/state/equipment-scenarios';
import { contextFromRuntime, createActionBus } from '../../../../../src/ui/action-bus';
import { createVerbController } from '../../../../../src/ui/verbs';
import type { ActionId, AttemptId, DomainAction, EvaluationResult, FactId, QualifiedId } from '../../../../../src/domain/types';
import type { GameState } from '../../../../../src/state/types';
import type * as S from '../../../../../src/content/schema-types.generated';
import { evaluateMaintenanceAnswer, maintenanceClueIssues, maintenanceHistoryUnlocked } from './notebook-combination-proposal';
import candidate from './SQ04.candidate.json' with { type: 'json' };
import originalProjection from './SQ04.current-schema.json' with { type: 'json' };
import { buildMaintenanceSchema } from './staged-schema';

// Explicit staged adapters: no canonical module bytes are changed, and no
// production support for SQ04 is inferred from these isolated registry checks.
vi.mock('../../../../../src/content/schema.generated.js', async () => {
  const { default: Ajv } = await import('ajv/dist/2020.js');
  const { default: addFormats } = await import('ajv-formats');
  const { readFileSync } = await import('node:fs');
  const { buildMaintenanceSchema } = await import('./staged-schema');
  const schema = JSON.parse(readFileSync(new URL('../../../../../content/schemas/content.schema.json', import.meta.url), 'utf8'));
  return { default: addFormats(new Ajv({ strict: true, allErrors: true })).compile(buildMaintenanceSchema(schema)) };
});
vi.mock('../../../../../src/content/optional-activities.ts', async importOriginal => {
  const actual = await importOriginal<typeof import('../../../../../src/content/optional-activities')>();
  const { maintenanceQuestIssues } = await import('./notebook-combination-proposal');
  return { ...actual, optionalActivityContentIssues(record: any, registry: ContentRegistry) {
    return record?.id === 'spec001:SQ04' ? maintenanceQuestIssues(record, registry) : actual.optionalActivityContentIssues(record, registry);
  } };
});

const read = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const oracle = json('tests/fixtures/optional-activities.json');
const activity = candidate.optionalActivity;
const all = activity.delivery.factIds;
const protectedPaths = ['tests/fixtures/optional-activities.json', 'tests/fixtures/companions.json', 'tests/fixtures/physical-cases.json', 'content/spec001/sources.json', ...['R03','R05','R09'].map(r => `content/spec001/rooms/${r}.json`)];
const hashes = Object.fromEntries(protectedPaths.map(p => [p, createHash('sha256').update(read(p)).digest('hex')]));
const receipts: Record<string, unknown> = {};
function input(quest: unknown = candidate) {
  const world = json('content/spec001/world.json') as S.world;
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(p => [p, json(p)]));
  const path = 'content/spec001/quests/SQ04.json';
  if (!world.documents.some(d => d.id === q('SQ04'))) world.documents.push({ kind: 'quest', id: q('SQ04'), path });
  documents[path] = structuredClone(quest);
  return { world, sources: json('content/spec001/sources.json'), documents };
}
let cachedRegistry: ContentRegistry | undefined;
function registry() {
  if (cachedRegistry) return cachedRegistry;
  const result = validateContent(input());
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok || !result.registry) throw new Error('SQ04 projection must pass the real registry');
  cachedRegistry = result.registry; return result.registry;
}
function game(reg: ContentRegistry = registry()): GameState {
  const original = startIntroduction(createIntroductionRuntime(), reg).game!;
  return { ...original, world: { ...original.world, roomId: q('R03'), position: { safePositionId: q('R03.entry') },
    completedObjectiveIds: [q('O01'), q('O02')], inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...original.notebook, personalNotes: 'I think the fiber was repaired.' } };
}
function collected(ids: readonly string[] = all): GameState { const g = game(); return { ...g, notebook: { ...g.notebook, factIds: ids as FactId[] } }; }
const command = (g: GameState, answer: unknown): DomainAction<unknown> => ({ actionId: 'sq04-combine' as ActionId, expectedVersion: g.world, input: answer });
const answer = (selectedFactIds: readonly string[] = all) => ({ selectedFactIds });
function evaluate(g: GameState = collected(), value: unknown = answer(), mode: 'practice' | 'delivery' = 'delivery') {
  return evaluateMaintenanceAnswer(activity.clues, registry(), mode, command(g, value), g);
}
const validateProposal = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/SQ04/optional-activity.schema.json'));
function prepared(g = game()) {
  const reg = registry(), runtime = startIntroduction(createIntroductionRuntime(), reg);
  const effects = candidate.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('SQ04'), effectId: e.effectId, mode: 'once', receipt: { kind: 'quest', id: q('SQ04') } }));
  return { reg, effects, state: createReducerState({ ...runtime, game: g }),
    reduce: createReducer({ registry: reg, bindings: [...bindings, ...copperEffectBindings(reg), ...fiberEffectBindings(reg), ...equipmentInteractionBindings(reg).effects] }) };
}
function apply(ctx: ReturnType<typeof prepared>, state: ReducerState, evaluation: EvaluationResult<unknown, StateEffect>, id = 'sq04-actual-boundary') {
  const g = state.runtime.game!;
  return ctx.reduce(state, { actionId: id as ActionId, adventureId: g.adventureId, expectedVersion: g.world, input: { kind: 'apply', evaluation } });
}
const accepted = (effects: readonly StateEffect[]) => ({ status: 'correct' as const, reasonCode: 't099-trusted-receipt-boundary', observations: [], acceptedEffects: effects });
afterAll(() => {
  for (const [path, hash] of Object.entries(hashes)) expect(createHash('sha256').update(read(path)).digest('hex')).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({ scope: 'Isolated notebook-combination proposal, real room action preparations and existing reducer boundaries. No shared activity/controller/browser/human acceptance.', protectedInputs: hashes, receipts }, null, 2) + '\n');
});

describe('SQ04 source contract and isolated authoring', () => {
  it('validates full candidate through the actual registry with explicitly staged schema/variant adapters', () => {
    expect(registry().record(q('SQ04'))?.kind).toBe('quest');
    expect(candidate.ruleIds).toEqual([]); expect(originalProjection.ruleIds.length).toBeGreaterThan(0);
  });
  it('preserves the independent oracle empty scored rules/cases and notebook semantics', () => {
    const expected = oracle.activities.find((a: any) => a.activityId === q('SQ04'));
    expect(expected.ruleIds).toEqual([]); expect(expected.sourceCaseIds).toEqual([]); expect(expected.teaching).toBe('notebook-clues');
    expect(candidate.alternatives[0]!.ruleIds).toEqual([]); expect(candidate.profileIds).toEqual([]);
    expect(candidate.model.scope).toContain('technical context only'); expect(candidate.model.scope).toContain('no scored physical rule');
    expect(activity.entryContexts.map(c => c.roomId)).toEqual(expected.roomIds);
    expect(candidate.requiredForMainStory).toBe(expected.rewardRequiredForMainStory);
    expect(oracle.cases.filter((c: any) => c.subject === q('SQ04'))).toHaveLength(11);
  });
  it('retains exact reviewed source claims only for the clues’ existing physical context', () => {
    expect(new Set(candidate.sourceClaims.map(c => c.sourceId))).toEqual(new Set([q('S04'), q('S10')]));
    const existing = json('content/spec001/objectives.json').records.flatMap((r: any) => r.sourceClaims);
    for (const claim of candidate.sourceClaims) expect(existing).toContainEqual(claim);
  });
  it('binds three real room facts, safe entries and ordinary acquisition actions', () => {
    const reg = registry(); expect(maintenanceClueIssues(activity.clues, reg)).toEqual([]);
    for (const entry of activity.entryContexts) {
      expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: entry.roomId, eligibleStates: ['stable-exploration'] });
      const room = reg.record(entry.roomId); expect(room?.kind).toBe('room');
      if (room?.kind === 'room') expect(room.hotspots.find(h => h.id === entry.hotspotId)?.verbs).toContain('look');
    }
    expect(candidate.prerequisite).toEqual({ kind: 'always' }); expect(activity.speakerId).toBe('narrator');
    expect(candidate.alternatives[0]).toMatchObject({ itemIds: [], abilityIds: [], effects: [], condition: { kind: 'always' } });
  });
  it('validates the closed payload and retains the genuine legacy schema failure', () => {
    expect(validateProposal(activity), JSON.stringify(validateProposal.errors)).toBe(true);
    const legacy = addFormats(new Ajv({ strict: true, allErrors: true })).compile(json('content/schemas/content.schema.json'));
    expect(legacy(originalProjection)).toBe(false); expect(legacy(candidate)).toBe(false);
    const staged = addFormats(new Ajv({ strict: true, allErrors: true })).compile(buildMaintenanceSchema(json('content/schemas/content.schema.json')));
    expect(staged(candidate)).toBe(true);
    const unrelated = structuredClone(candidate); unrelated.id = 'spec001:SQ01'; expect(staged(unrelated)).toBe(false);
    const missing = structuredClone(candidate) as any; delete missing.optionalActivity; expect(staged(missing)).toBe(false);
  });
  it.each(['timed','missing-exit','swapped-room','repeated-room','forged-fact','wrong-kind','hidden-effect','main-reward'])('rejects %s proposal corruption', kind => {
    const bad: any = structuredClone(activity);
    if (kind === 'timed') bad.timingDefault = 'on';
    if (kind === 'missing-exit') delete bad.controls.exit;
    if (kind === 'swapped-room') bad.clues[0].roomId = q('R05');
    if (kind === 'repeated-room') bad.clues[1] = bad.clues[0];
    if (kind === 'forged-fact') bad.delivery.factIds[1] = q('FACT-SQ04-history');
    if (kind === 'wrong-kind') bad.clues[2].evidenceKind = 'measurement';
    if (kind === 'hidden-effect') bad.reward.effects = candidate.effects;
    if (kind === 'main-reward') bad.reward.kind = 'required-repair-tool';
    expect(validateProposal(bad)).toBe(false);
  });
  it('rejects main progress effects and optional main-route prerequisites in the real registry', () => {
    const bad: any = structuredClone(candidate); bad.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-SQ04-main'), objectiveId: q('O09') });
    expect(validateContent(input(bad)).ok).toBe(false);
    const data = input(); data.world.objectives.find(o => o.id === q('O09'))!.prerequisite = { kind: 'quest-complete', questId: q('SQ04') };
    expect(validateContent(data).ok).toBe(false);
  });
});

describe('independent SQ04 notebook selection expectations', () => {
  it('executes OPT-SQ04-COMBINE with actual identity-bound notebook membership', () => {
    const fixed = oracle.cases.find((c: any) => c.id === 'OPT-SQ04-COMBINE');
    const result = evaluate(); receipts[fixed.id] = result; expect(result.status).toBe('correct'); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ activityCompletionEligible: fixed.expected.activityCompletionEligible,
      sourceRoomsPreserved: fixed.expected.sourceRoomsPreserved.map(q), requiredObjectiveAward: fixed.expected.requiredObjectiveAward,
      currentRepairProven: false, endToEndServiceProven: false, chronologyProven: false });
  });
  it('executes OPT-SQ04-NOTE-NOT-CLUE without turning a hypothesis/note into the missing observation', () => {
    const fixed = oracle.cases.find((c: any) => c.id === 'OPT-SQ04-NOTE-NOT-CLUE');
    const g = collected([all[0]!,all[2]!]);
    const withNotes = { ...g, notebook: { ...g.notebook, personalNotes: fixed.inputs.personalNote, hypotheses: [{ id: '00000000-0000-4000-8000-000000000112' as any, text: fixed.inputs.personalNote, subjectIds: [q('R05')], status: 'supported' as const }] } };
    const before = structuredClone(withNotes), result = evaluate(withNotes); receipts[fixed.id] = result;
    expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ activityCompletionEligible: false, missingSourceRooms: [q(fixed.expected.missingObservedSourceRoom)] });
    expect(withNotes).toEqual(before); expect(withNotes.notebook.personalNotes).toBe(fixed.inputs.personalNote);
  });
  it('executes OPT-SQ04-DUPLICATE-ROOM without filling R05', () => {
    const fixed = oracle.cases.find((c: any) => c.id === 'OPT-SQ04-DUPLICATE-ROOM');
    const result = evaluate(collected([all[0]!,all[2]!]),answer([all[0]!,all[0]!,all[2]!])); receipts[fixed.id] = result;
    expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ activityCompletionEligible: false, missingSourceRooms: [q('R05')] });
  });
  it.each([0,1,2])('requires the actual %i record, not merely its selection', missing => {
    const result = evaluate(collected(all.filter((_,i) => i !== missing)));
    expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ missingSourceRooms: [activity.clues[missing]!.roomId] });
  });
  it('accepts all selection orders while preserving canonical room attribution', () => {
    const result = evaluate(collected(),answer([...all].reverse())); expect(result.status).toBe('correct');
    expect(result.observations[0]).toMatchObject({ sourceRoomsPreserved: ['spec001:R03','spec001:R05','spec001:R09'] });
  });
  it('room visits and current inspection flags alone never constitute a clue', () => {
    const g = game(); const changed = { ...g, world: { ...g.world, flags: { [q<'flag'>('FLAG-fiber-connection')]: 'inspected' } }, notebook: { ...g.notebook, mapRoomIds: [q<'room'>('R03'),q<'room'>('R05'),q<'room'>('R09')] } };
    expect(evaluate(changed).status).toBe('incorrect');
  });
  it('uses retained facts as history without requiring current configuration flags or measurements', () => {
    const g = collected(); expect(g.notebook.measurements).toEqual([]); expect(g.world.flags).toEqual({});
    const result = evaluate(g); expect(result.status).toBe('correct'); expect(result.observations[0]).toMatchObject({ evidenceUse: 'historical-notebook-learning', currentRepairProven: false });
  });
  it('practice uses a clearly supplied card without collecting it or earning completion', () => {
    const g = game(), before = structuredClone(g), result = evaluate(g,answer([all[0]!]),'practice'); receipts['practice-only'] = result;
    expect(result.status).toBe('correct'); expect(result.observations[0]).toMatchObject({ activityCompletionEligible: false, evidenceUse: 'supplied-practice-only' });
    expect(result.acceptedEffects).toEqual([]); expect(g).toEqual(before); expect(g.notebook.factIds).toEqual([]);
  });
  it.each([null, {}, '', { selectedFactIds: [] }, { selectedFactIds: [q('FACT-SQ04-history')] }, { selectedFactIds: [null] },
    { ...answer(), sourceRooms: ['R03','R05','R09'] }, { ...answer(), status: 'correct' }, { ...answer(), acceptedEffects: candidate.effects }])('rejects malformed/forged answer %j', value => {
    const result = evaluate(collected(),value); expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['fact','room','kind','source','action','subject','freshness'])('reports broken %s authoring before absent learner input', kind => {
    const clues: any = structuredClone(activity.clues), reg = registry();
    if (kind === 'fact') clues[0].factId = all[1];
    if (kind === 'room') clues[1].roomId = q('R03');
    if (kind === 'kind') clues[2].evidenceKind = 'measurement';
    if (kind === 'source') clues[2].dialogueId = q('DIALOGUE-copper-bench');
    if (kind === 'action') clues[1].sourceActionId = q('ACTION-fiber-clean');
    const patched: ContentRegistry = { ...reg, record(id) {
      const r: any = reg.record(id);
      if (id !== q('R03') || !['subject','freshness'].includes(kind)) return r;
      const copy = structuredClone(r), fact = copy.evidence.find((e: any) => e.id === all[0]);
      if (kind === 'subject') fact.subjectIds = [q('PR045')]; else fact.requiresFreshMeasurement = true;
      return copy;
    } };
    const g = collected(); const result = evaluateMaintenanceAnswer(clues,patched,'delivery',command(g,null),g);
    receipts[`content-${kind}`] = result; expect(result.status).toBe('content-error'); expect(result.acceptedEffects).toEqual([]);
  });
  it('retains the original action capture and rejects a changed current version', () => {
    const g = collected(); const result = evaluateMaintenanceAnswer(activity.clues,registry(),'delivery',command(g,answer()),g,
      { ...g.world, configurationRevision: g.world.configurationRevision + 1 as any });
    receipts['stale-action'] = result; expect(result.status).toBe('invalid-input'); expect(result.reasonCode).toBe('stale-action');
  });
});

describe('real source actions and existing atomic receipt boundaries', () => {
  it('collects each clue using its actual ordinary room preparation and reducer', () => {
    const ctx = prepared(); let state = ctx.state;
    for (const clue of activity.clues) {
      const g = state.runtime.game!;
      state = { ...state, runtime: { ...state.runtime, game: { ...g, world: { ...g.world, roomId: clue.roomId as any, position: { safePositionId: `${clue.roomId}.entry` as any } } } } };
      const current = state.runtime.game!;
      if (clue.roomId === q('R09')) {
        const store = { getState: () => state, reduce: ctx.reduce, compareAndSet(before: ReducerState, next: ReducerState) { if (state !== before) return false; state = next; return true; } };
        const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
        const verbs = createVerbController({ bus, store, registry: ctx.reg, bindings: equipmentInteractionBindings(ctx.reg).hotspots });
        try {
          const result = bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-market-case'), choiceId: clue.sourceActionId as QualifiedId, verb: 'use', itemId: null }));
          receipts[clue.sourceActionId] = result; expect(result.status).toBe('handled');
        } finally { verbs.dispose(); bus.dispose(); }
      } else {
        const result = clue.roomId === q('R03') ? prepareCopperAction(ctx.reg,current,clue.sourceActionId as QualifiedId) : prepareFiberAction(ctx.reg,current,clue.sourceActionId as QualifiedId);
        receipts[clue.sourceActionId] = result; expect(result.status).toBe('correct');
        const applied = apply(ctx,state,result,clue.sourceActionId); expect(applied.status).toBe('applied'); state = applied.state;
      }
      expect(state.runtime.game!.notebook.factIds).toContain(clue.factId);
    }
    const result = evaluate(state.runtime.game!); expect(result.status).toBe('correct');
    expect(state.runtime.game!.world.completedQuestIds).toEqual([]); expect(state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01'),q('O02')]);
    expect(state.runtime.game!.notebook.measurements).toEqual([]);
  });
  it('the existing fiber inspection requires its actual room, before-change state and ordinary kit', () => {
    const reg = registry(), g = game(reg);
    const here = { ...g, world: { ...g.world, roomId: q<'room'>('R05'), position: { safePositionId: q<'safe-position'>('R05.entry') } } };
    expect(prepareFiberAction(reg,g,q('ACTION-fiber-inspect-before')).status).toBe('invalid-input');
    expect(prepareFiberAction(reg,{ ...here, world: { ...here.world, inventory: [] } },q('ACTION-fiber-inspect-before')).status).toBe('invalid-input');
    expect(prepareFiberAction(reg,{ ...here, world: { ...here.world, flags: { [q<'flag'>('FLAG-fiber-connection')]: 'cleaned' } } },q('ACTION-fiber-inspect-before')).status).toBe('invalid-input');
    expect(prepareFiberAction(reg,here,q('ACTION-fiber-inspect-before')).status).toBe('correct');
  });
  it('the trusted exact quest/fact batch applies once and changes no main-route state', () => {
    const ctx = prepared(collected()), before = structuredClone(ctx.state.runtime.game!);
    const first = apply(ctx,ctx.state,accepted(ctx.effects)); expect(first.status).toBe('applied');
    const second = apply(ctx,first.state,accepted(ctx.effects),'replay-new-id'); expect(second.status).toBe('no-op');
    const g = second.state.runtime.game!; expect(g.world.completedQuestIds).toEqual([q('SQ04')]);
    expect(g.notebook.factIds.filter(id => id === q('FACT-SQ04-history'))).toHaveLength(1); expect(maintenanceHistoryUnlocked(g)).toBe(true);
    for (const field of ['inventory','completedObjectiveIds','activeAllyIds','recruits','route','flags'] as const) expect(g.world[field]).toEqual(before.world[field]);
    expect(g.notebook.measurements).toEqual(before.notebook.measurements); expect(g.notebook.personalNotes).toBe(before.notebook.personalNotes);
    expect(second.state.runtime.persistence.pendingRequest).toBeNull();
  });
  it.each(['record-fact','complete-quest'])('rejects an incomplete %s-only reward batch', kind => {
    const ctx = prepared(); const result = apply(ctx,ctx.state,accepted(ctx.effects.filter(e => e.kind === kind)));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error'); expect(result.state.runtime.game).toEqual(ctx.state.runtime.game);
  });
  it.each(['correct','practice','missing'])('a raw %s selection predicate carries no completion effects', kind => {
    const ctx = prepared(collected()); const result = kind === 'practice' ? evaluate(game(),answer([all[0]!]),'practice') : kind === 'missing' ? evaluate(game()) : evaluate();
    const applied = apply(ctx,ctx.state,result); expect(applied.state.runtime.game!.world.completedQuestIds).toEqual([]);
    expect(maintenanceHistoryUnlocked(applied.state.runtime.game!)).toBe(false);
  });
  it('real encounter rollback retains the history fact but removes its quest reward; no implicit save', () => {
    const ctx = prepared(collected()), original = ctx.state.runtime.game!, completed = apply(ctx,ctx.state,accepted(ctx.effects)).state;
    const checkpoint = { adventureId: original.adventureId, world: { ...original.world, roomId: q<'room'>('R11'), position: { safePositionId: q<'safe-position'>('R11.preparation') } } };
    const failed: ReducerState = { ...completed, runtime: { ...completed.runtime, checkpoint, activity: { kind: 'terminal-failure' } } };
    const result = ctx.reduce(failed,{ actionId: 'sq04-rewind' as ActionId, adventureId: original.adventureId, expectedVersion: failed.runtime.game!.world,
      input: { kind: 'rewind-preparation', nextAttemptId: '00000000-0000-4000-8000-000000000212' as AttemptId } });
    receipts['existing-rollback-boundary'] = { status: result.status, reason: result.reason };
    expect(result.status).toBe('applied'); const g = result.state.runtime.game!;
    expect(g.world.completedQuestIds).toEqual([]); expect(g.notebook.factIds).toContain(q('FACT-SQ04-history')); expect(maintenanceHistoryUnlocked(g)).toBe(false);
    expect(g.notebook.factIds).toEqual(completed.runtime.game!.notebook.factIds); expect(g.notebook.personalNotes).toBe(original.notebook.personalNotes);
    expect(g.world.configurationRevision).toBeGreaterThan(failed.runtime.game!.world.configurationRevision); expect(result.state.runtime.persistence.pendingRequest).toBeNull();
    expect(evaluate(g).status).toBe('correct');
  });
  it('quest receipt without its history fact cannot personalize maintenance either', () => {
    const g = collected(); expect(maintenanceHistoryUnlocked({ ...g, world: { ...g.world, completedQuestIds: [q('SQ04')] } })).toBe(false);
  });
});
