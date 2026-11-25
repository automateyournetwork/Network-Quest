// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { validateContent } from '../../src/content/registry';
import type { ContentRegistry } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, AdventureId, AttemptId, ConfigurationRevision, QualifiedId } from '../../src/domain/types';
import type { GameState, RuntimeState, WorldState } from '../../src/state/types';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../src/state/reducer';
import type { EffectBinding, ReducerCommand, ReducerInput, ReducerState, StateEffect } from '../../src/state/reducer';

const id = <T extends string = string>(suffix: string) => `spec001:${suffix.replace(/^item-/, 'ITEM-')}` as QualifiedId<T>;
const attempt = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as AttemptId;
const effect = (value: S.effect) => value as StateEffect;
const grant = effect({ kind: 'grant-item', effectId: id('reward'), itemId: id('item-repaired'), quantity: 1 });
const consume = effect({ kind: 'consume-item', effectId: id('consume'), itemId: id('item-part'), quantity: 1 });
const consumeReagent = effect({ kind: 'consume-item', effectId: id('consume-reagent'), itemId: id('item-reagent'), quantity: 1 });
const complete = effect({ kind: 'complete-objective', effectId: id('complete'), objectiveId: id('O01') });
const repair = [consume, consumeReagent, grant, complete];
const on = effect({ kind: 'set-flag', effectId: id('power-on'), flagId: id('power'), value: true });
const off = effect({ kind: 'set-flag', effectId: id('power-off'), flagId: id('power'), value: false });
const fact = effect({ kind: 'record-fact', effectId: id('learn'), factId: id('fact-one') });
const talkGift = effect({ kind: 'grant-item', effectId: id('dialogue-gift'), itemId: id('item-gift'), quantity: 1 });

// These are deliberately small in-memory state-boundary fixtures, not authored
// episode content or a substitute for the independent physical rule cases.
function content(overrides: { item?: Partial<S.item>; recovery?: S.recovery; condition?: S.condition } = {}) {
  const recovery: S.recovery = overrides.recovery ?? {
    policy: 'transformation-recoverable', roomId: id('R01'), condition: { kind: 'always' }, explanation: 'Recover the part at this workbench.',
  };
  const item = {
    kind: 'item', id: id('item-part'), consumption: 'on-documented-transformation', essentialForRoutes: ['copper'],
    recovery, combinations: [{ id: id('combine'), withItemId: id('item-reagent'), consumesInputs: true,
      condition: { kind: 'always' }, effects: [consume, consumeReagent, grant], recovery }], ...overrides.item,
  } as S.item;
  const records = new Map<string, S.authoredRecord>([
    [id('O01'), { kind: 'objective', id: id('O01'), prerequisite: overrides.condition ?? { kind: 'always' }, effects: repair } as unknown as S.objective],
    [id('dialogue'), { kind: 'dialogue', id: id('dialogue'), nodes: [{ effects: [on, off, fact, talkGift], condition: { kind: 'always' } }] } as unknown as S.dialogue],
    [item.id, item],
    [id('item-reagent'), { ...item, id: id('item-reagent'), combinations: [] }],
    [id('item-tool'), { kind: 'item', id: id('item-tool'), consumption: 'never', essentialForRoutes: ['copper'], combinations: [] } as unknown as S.item],
    [id('item-repaired'), { kind: 'item', id: id('item-repaired'), consumption: 'never', essentialForRoutes: [], combinations: [] } as unknown as S.item],
    [id('item-gift'), { kind: 'item', id: id('item-gift'), consumption: 'never', essentialForRoutes: [], combinations: [] } as unknown as S.item],
  ]);
  const members: Record<string, Set<string>> = {
    effect: new Set([...repair, on, off, fact, talkGift].map(e => e.effectId)),
    objective: new Set([id('O01')]), flag: new Set([id('power')]), fact: new Set([id('fact-one')]),
    item: new Set([id('item-part'), id('item-reagent'), id('item-tool'), id('item-repaired'), id('item-gift')]),
    room: new Set([id('R01'), id('R02')]),
  };
  const registry: ContentRegistry = {
    has: (kind, key) => members[kind]?.has(key) ?? false,
    record: key => records.get(key),
    safePosition: key => key === id('safe-R01') || key === id('safe-R02') ? {
      id: key, roomId: key === id('safe-R01') ? id('R01') : id('R02'), label: 'Bench', description: 'Safe bench',
      eligibleStates: ['stable-exploration', 'safe-preparation'], safetyNote: 'No active encounter',
    } : undefined,
  };
  return { registry, records, members };
}
const bindings: EffectBinding[] = [
  ...repair.map(e => ({ sourceId: id('O01'), effectId: e.effectId, mode: 'once' as const,
    receipt: { kind: 'objective' as const, id: id<'objective'>('O01') } })),
  ...[on, off, fact].map(e => ({ sourceId: id('dialogue'), effectId: e.effectId, mode: 'repeatable' as const })),
  { sourceId: id('dialogue'), effectId: talkGift.effectId, mode: 'once', receipt: { kind: 'dialogue-effect', id: id('dialogue-gift') } },
];

function runtime(): RuntimeState {
  const world: WorldState = {
    roomId: id('R01'), position: { safePositionId: id('safe-R01') }, configurationRevision: 4 as ConfigurationRevision,
    attemptId: attempt(1), flags: {}, completedObjectiveIds: [], completedQuestIds: [], achievementIds: [], dialogueEffectIds: [],
    inventory: [{ itemId: id('item-part'), quantity: 1 }, { itemId: id('item-reagent'), quantity: 1 }, { itemId: id('item-tool'), quantity: 1 }],
    recruits: [], activeAllyIds: [], compendiumIds: [], route: null, continueOutcome: null,
  };
  const game: GameState = {
    adventureId: attempt(10) as unknown as AdventureId, contentVersion: '1.0.0' as GameState['contentVersion'], episodeId: 'spec001', world,
    notebook: { factIds: [], mapRoomIds: [id('R01')], personalNotes: 'Keep the clue.', hypotheses: [], measurements: [{
      id: attempt(20) as unknown as GameState['notebook']['measurements'][number]['id'], ruleId: id('rule-test'), subjectIds: [id('item-part')],
      roomId: id('R01'), configurationRevision: world.configurationRevision, attemptId: world.attemptId,
      stale: false, readings: [], conclusionCode: 'observed',
    }] }, assistance: [], outcomeHistory: [],
  };
  return {
    game, checkpoint: null, activity: { kind: 'stable-exploration' }, ui: null,
    auth: { status: 'guest', clientGeneration: 0 as RuntimeState['auth']['clientGeneration'], csrfToken: null },
    persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'],
      lastAcknowledgedGeneration: null, knownSlot: undefined, pendingRequest: null, replacementAuthorization: null,
      lastAcknowledgement: null, autosaveEnabled: false },
  };
}
function command(state: ReducerState, input: ReducerInput, action = 'action-1'): ReducerCommand {
  return { actionId: action as ActionId, adventureId: state.runtime.game!.adventureId,
    expectedVersion: { configurationRevision: state.runtime.game!.world.configurationRevision, attemptId: state.runtime.game!.world.attemptId }, input };
}
const accepted = (acceptedEffects: readonly StateEffect[]): Extract<ReducerInput, { kind: 'apply' }> => ({
  kind: 'apply', evaluation: { status: 'correct', reasonCode: 'fixture', observations: [], acceptedEffects },
});
const setup = (options: Parameters<typeof content>[0] = {}) => ({ state: createReducerState(runtime()), reduce: createReducer({ ...content(options), bindings }) });
const game = (state: ReducerState) => state.runtime.game!;
const quantity = (state: ReducerState, suffix: string) => game(state).world.inventory.find(i => i.itemId === id(suffix))?.quantity ?? 0;
const destination = { roomId: id<'room'>('R02'), safePositionId: id<'safe-position'>('safe-R02'), activity: 'stable-exploration' as const };
function freezeDeep<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freezeDeep); Object.freeze(value); }
  return value;
}

async function validatedRecords(records: readonly S.authoredRecord[]): Promise<ContentRegistry> {
  const world = JSON.parse(await readFile(new URL('../../content/spec001/world.json', import.meta.url), 'utf8')) as S.world;
  const sources: unknown = JSON.parse(await readFile(new URL('../../content/spec001/sources.json', import.meta.url), 'utf8'));
  const path = 'content/spec001/reducer-test.json';
  world.documents = records.map(record => ({ kind: record.kind, id: record.id, path }));
  const result = validateContent(JSON.parse(JSON.stringify({ world, sources, documents: { [path]: {
    kind: 'collection', schemaVersion: 1, episodeId: 'spec001', contentVersion: '1.0.0', records,
  } } })));
  expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  if (!result.ok || !result.registry) throw new Error('Fixture must pass real content validation');
  return result.registry;
}
async function fullObjective(): Promise<S.objective> {
  const world = JSON.parse(await readFile(new URL('../../content/spec001/world.json', import.meta.url), 'utf8')) as S.world;
  const sources = JSON.parse(await readFile(new URL('../../content/spec001/sources.json', import.meta.url), 'utf8')) as {
    sources: { id: string; section: string; supportedClaim: string; limits: string }[];
  };
  const metadata = world.objectives.find(o => o.shortId === 'O01')!;
  return {
    kind: 'objective', id: id('O01'), schemaVersion: 1, episodeId: 'spec001', contentVersion: '1.0.0', prerequisite: { kind: 'always' },
    evidence: [{ id: id('FACT-inspect'), roomId: id('R01'), subjectIds: [id('PR001')], kind: 'observation', text: 'Observe power and link separately.', ruleIds: [id('PHY01')], requiresFreshMeasurement: false }],
    alternatives: [{ id: id('ACTION-inspect'), label: 'Inspect indicators', method: 'direct-action', itemIds: [], abilityIds: [], condition: { kind: 'always' },
      ruleIds: [id('PHY01')], evidenceIds: [id('FACT-inspect')], effects: [], explanation: 'Power and link are separate observations.' }],
    ruleIds: metadata.ruleIds, profileIds: metadata.profileIds,
    sourceClaims: ['S01', 'S02', 'S08', 'S12'].map(key => { const source = sources.sources.find(s => s.id === key)!; return {
      sourceId: id(key), section: source.section, supportedClaim: source.supportedClaim, limitations: [source.limits],
    }; }),
    model: { label: 'scoped-technical-predicate', scope: 'Power versus link observation.', assumptions: ['Inspect both indicators.'], limitations: ['No service inference.'] },
    effects: [complete], hints: {
      method: { id: id('HINT-O01-method'), text: 'Inspect the indicators.' }, workedStep: { id: id('HINT-O01-step'), text: 'Read them independently.' }, solution: { id: id('HINT-O01-solution'), text: 'Power alone does not prove a link.' },
    }, observableOutcome: 'Separate observations appear.', completionExplanation: 'Inspection recorded.', requiresReflexTiming: false,
  };
}
function fullItem(suffix: string, consumable = false): S.item {
  return { kind: 'item', id: id(suffix), schemaVersion: 1, episodeId: 'spec001', contentVersion: '1.0.0', name: suffix,
    description: 'State boundary fixture part.', propId: id('PR001'), assetId: id(`ASSET-${suffix}`), verbs: ['look', 'use'], evidence: [], essentialForRoutes: ['copper'],
    acquisition: { roomId: id('R01'), condition: { kind: 'always' }, explanation: 'Collect at the bench.' },
    consumption: consumable ? 'on-documented-transformation' : 'never',
    recovery: { policy: consumable ? 'transformation-recoverable' : 'not-consumed', roomId: id('R01'), condition: { kind: 'always' }, explanation: consumable ? 'Recover one part at the bench.' : 'Tool is never consumed.' }, combinations: [],
  };
}

describe('real validated content interoperability', () => {
  it('accepts either complete conventional alternative independently and blocks reward replay across alternatives', async () => {
    const objective = await fullObjective();
    const other = effect({ kind: 'grant-item', effectId: id('other-grant'), itemId: id('item-gift'), quantity: 1 });
    objective.alternatives[0]!.effects = [grant];
    objective.alternatives.push({ ...objective.alternatives[0]!, id: id('ACTION-second'), effects: [other] });
    const registry = await validatedRecords([objective, fullItem('item-repaired'), fullItem('item-gift')]);
    const reduce = createReducer({ registry, bindings: [grant, other, complete].map(e => ({
      sourceId: id('O01'), effectId: e.effectId, mode: 'once', receipt: { kind: 'objective', id: id('O01') },
    })) });
    for (const [chosen, otherChoice, reward] of [[grant, other, 'item-repaired'], [other, grant, 'item-gift']] as const) {
      const rt = runtime(); const state = createReducerState({ ...rt, game: { ...rt.game!, world: { ...rt.game!.world, inventory: [], position: { safePositionId: id('R01.entry') } } } });
      const result = reduce(state, command(state, accepted([chosen, complete])));
      expect(result.status).toBe('applied'); expect(quantity(result.state, reward)).toBe(1);
      expect(game(result.state).world.completedObjectiveIds).toEqual([id('O01')]);
      const replay = reduce(result.state, command(result.state, accepted([otherChoice, complete]), 'other-solution'));
      expect(replay.status).toBe('no-op'); expect(replay.state.runtime).toBe(result.state.runtime);
      const mixed = reduce(state, command(state, accepted([grant, other, complete]), 'mixed-solutions'));
      expect(mixed.status).toBe('rejected'); expect(mixed.state).toBe(state);
      const partial = reduce(state, command(state, accepted([complete]), 'missing-alternative'));
      expect(partial.status).toBe('rejected'); expect(partial.state).toBe(state);
    }
  });

  it('accepts a single A combination consuming A+B without a reciprocal declaration on B', async () => {
    const objective = await fullObjective(); objective.effects = repair;
    const part = fullItem('item-part', true), reagent = fullItem('item-reagent', true);
    part.combinations = [{ id: id('combine'), withItemId: reagent.id, condition: { kind: 'always' }, consumesInputs: true,
      effects: [consume, consumeReagent, grant], explanation: 'Join the parts.', recovery: part.recovery }];
    const registry = await validatedRecords([objective, part, reagent, fullItem('item-repaired'), fullItem('item-tool')]);
    const reduce = createReducer({ registry, bindings: bindings.filter(b => b.sourceId === id('O01')) });
    const state = createReducerState(runtime());
    const result = reduce(state, command(state, accepted(repair)));
    expect(result.status).toBe('applied'); expect(quantity(result.state, 'item-part')).toBe(0); expect(quantity(result.state, 'item-reagent')).toBe(0);
    const recovered = reduce(result.state, command(result.state, { kind: 'recover-item', itemId: id('item-reagent') }, 'recover-second-input'));
    expect(recovered.status).toBe('applied'); expect(quantity(recovered.state, 'item-reagent')).toBe(1);
  });
});

describe('deterministic atomic command boundary', () => {
  it('commits consumption, reward, completion, safe arrival and freshness together without mutating input', () => {
    const { state } = setup(); freezeDeep(state);
    const reduce = createReducer({ ...content(), bindings, canReachRoom: (_world, roomId) => roomId === id('R01') });
    const input = { ...accepted(repair), destination };
    const action = command(state, input);
    const result = reduce(state, action);
    expect(result.status).toBe('applied');
    expect(quantity(result.state, 'item-part')).toBe(0);
    expect(quantity(result.state, 'item-repaired')).toBe(1);
    expect(quantity(result.state, 'item-tool')).toBe(1);
    expect(game(result.state).world.completedObjectiveIds).toEqual([id('O01')]);
    expect(game(result.state).world.roomId).toBe(id('R02'));
    expect(game(result.state).world.position.safePositionId).toBe(id('safe-R02'));
    expect(game(result.state).world.configurationRevision).toBe(5);
    expect(game(result.state).notebook.measurements[0]!.stale).toBe(true);
    expect(result.state.runtime.persistence.dirtyGeneration).toBe(1);
    expect(result.state.runtime.persistence.autosaveEnabled).toBe(false);
    expect(result.state.runtime.persistence.pendingRequest).toBeNull();
    expect(result.state.runtime.auth).toBe(state.runtime.auth);
    expect(game(state).world.completedObjectiveIds).toEqual([]);
    expect(reduce(state, action)).toEqual(result);
  });

  it('rechecks stale action versions before considering replay and cannot duplicate any reward', () => {
    const { state, reduce } = setup(); const action = command(state, accepted(repair));
    const first = reduce(state, action).state;
    expect(reduce(first, action)).toMatchObject({ status: 'rejected', reason: 'stale-version', state: first });
    const replay = reduce(first, command(first, accepted(repair), 'new-action'));
    expect(replay.status).toBe('no-op'); expect(replay.state.runtime).toBe(first.runtime);
    expect(quantity(first, 'item-repaired')).toBe(1);
  });

  it('retains one-time receipts in existing save world fields across a fresh reducer instance', () => {
    const { state, reduce } = setup();
    const first = reduce(state, command(state, accepted([talkGift]))).state;
    expect(game(first).world.dialogueEffectIds).toEqual([talkGift.effectId]);
    const reloaded = createReducerState({ ...runtime(), game: JSON.parse(JSON.stringify(game(first))) });
    const result = createReducer({ ...content(), bindings })(reloaded, command(reloaded, accepted([talkGift]), 'new-after-load'));
    expect(result.status).toBe('no-op'); expect(quantity(result.state, 'item-gift')).toBe(1);
    expect(Object.keys(game(first).world)).toEqual(Object.keys(game(state).world));
    expect(Object.keys(game(first))).toEqual(Object.keys(game(state)));
  });

  it('rejects a stable effect registered under two different completion anchors', () => {
    const { state } = setup(); const ctx = content();
    const reduce = createReducer({ ...ctx, bindings: [...bindings, {
      sourceId: id('dialogue'), effectId: talkGift.effectId, mode: 'once', receipt: { kind: 'objective', id: id('O01') },
    }] });
    const result = reduce(state, command(state, accepted([talkGift])));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error'); expect(result.state).toBe(state);
  });

  it('rejects partial receipt groups so a reward cannot bypass consumption or pre-complete its objective', () => {
    const { state, reduce } = setup();
    for (const effects of [[grant], [complete], [grant, complete]]) {
      const result = reduce(state, command(state, accepted(effects)));
      expect(result.status).toBe('rejected'); expect(result.state).toBe(state);
    }
  });

  it.each(['invalid-input', 'content-error'] as const)('does not penalize or reward %s, even if a malformed result includes effects', status => {
    const { state, reduce } = setup();
    const input = { kind: 'apply', evaluation: { status, reasonCode: 'bad', observations: [], acceptedEffects: repair } } as unknown as ReducerInput;
    const result = reduce(state, command(state, input));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe(status); expect(result.state).toBe(state);
  });

  it('permits explained incorrect effects but does not score any networking model', () => {
    const { state, reduce } = setup();
    const result = reduce(state, command(state, { kind: 'apply', evaluation: {
      status: 'incorrect', reasonCode: 'explained-fictional-consequence', observations: [], acceptedEffects: [off],
    } }));
    expect(result.status).toBe('applied'); expect(game(result.state).world.flags[id<'flag'>('power')]).toBe(false);
  });

  it('rejects changed effect payloads, unknown IDs and duplicate effect entries atomically', () => {
    const { state, reduce } = setup();
    const bad = [effect({ ...grant, quantity: 7 } as S.effect), effect({ ...grant, effectId: id('invented') } as S.effect)];
    for (const effects of [[consume, ...bad, complete], [...repair, grant]]) {
      const result = reduce(state, command(state, accepted(effects)));
      expect(result.status).toBe('rejected'); expect(result.state).toBe(state);
    }
  });

  it('validates affordability before any grant, and a failed batch changes no location or generation', () => {
    const { reduce } = setup(); const rt = runtime();
    const state = createReducerState({ ...rt, game: { ...rt.game!, world: { ...rt.game!.world, inventory: [] } } });
    const result = reduce(state, command(state, { ...accepted([grant, consume, consumeReagent, complete]), destination }));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('insufficient-items'); expect(result.state).toBe(state);
  });

  it('checks authored preconditions and destination membership without granting partial progress', () => {
    const { state, reduce } = setup({ condition: { kind: 'flag-equals', flagId: id('power'), value: true } });
    expect(reduce(state, command(state, accepted(repair))).reason).toBe('precondition');
    const ordinary = setup();
    for (const target of [{ ...destination, safePositionId: id<'safe-position'>('missing') }, { ...destination, roomId: id<'room'>('R01') }]) {
      const result = ordinary.reduce(ordinary.state, command(ordinary.state, { ...accepted(repair), destination: target }));
      expect(result.status).toBe('rejected'); expect(result.state).toBe(ordinary.state);
    }
  });
});

describe('transient transitions and legitimate repeated adjustments', () => {
  it('begins without consumption or arrival and commits exactly once using the original safe world', () => {
    const { state } = setup();
    const reduce = createReducer({ ...content(), bindings, canReachRoom: (_world, roomId) => roomId === id('R01') });
    const begin = command(state, { ...accepted(repair), kind: 'begin', activity: 'room-transition', destination }, 'begin-1');
    const pending = reduce(state, begin).state;
    expect(pending.runtime.game).toBe(state.runtime.game);
    expect(pending.runtime.persistence).toBe(state.runtime.persistence);
    expect(pending.runtime.activity?.kind).toBe('room-transition');
    expect(reduce(pending, begin).state).toBe(pending);
    expect(reduce(pending, command(pending, accepted([on]), 'unrelated')).reason).toBe('transition-pending');
    const done = reduce(pending, command(pending, { kind: 'commit', transitionActionId: begin.actionId }, 'finish-1')).state;
    expect(quantity(done, 'item-repaired')).toBe(1);
    expect(done.runtime.activity?.kind).toBe('stable-exploration');
    expect(reduce(done, command(done, { kind: 'commit', transitionActionId: begin.actionId }, 'finish-late')).state).toBe(done);
  });

  it('cancels/interruption returns the exact committed world and late callbacks cannot restart or apply it', () => {
    const { state, reduce } = setup();
    const begin = command(state, { ...accepted(repair), kind: 'begin', activity: 'pending-effect' }, 'begin-1');
    const pending = reduce(state, begin).state;
    const canceled = reduce(pending, command(pending, { kind: 'cancel', transitionActionId: begin.actionId }, 'cancel-1')).state;
    expect(canceled.runtime).toEqual(state.runtime);
    expect(canceled.runtime.game).toBe(state.runtime.game);
    expect(reduce(canceled, begin).state).toBe(canceled);
    expect(reduce(canceled, command(canceled, { kind: 'commit', transitionActionId: begin.actionId }, 'late')).state).toBe(canceled);
  });

  it('checks the transition identity independently from current configuration and attempt', () => {
    const { state, reduce } = setup();
    const pending = reduce(state, command(state, { ...accepted([on]), kind: 'begin', activity: 'pending-effect' }, 'one')).state;
    const wrong = reduce(pending, command(pending, { kind: 'commit', transitionActionId: 'other' as ActionId }, 'two'));
    expect(wrong.reason).toBe('unknown-transition'); expect(wrong.state).toBe(pending);
    const stale = command(pending, { kind: 'commit', transitionActionId: 'one' as ActionId }, 'three');
    expect(reduce(pending, { ...stale, expectedVersion: { ...stale.expectedVersion, attemptId: attempt(2) } }).reason).toBe('stale-version');
  });

  it('can toggle a real configuration repeatedly, but never reapplies an action ID or revives old measurements', () => {
    const { state, reduce } = setup();
    let current = state;
    for (const [index, e] of [on, off, on, off].entries()) {
      current = reduce(current, command(current, accepted([e]), `toggle-${index}`)).state;
      expect(game(current).world.configurationRevision).toBe(5 + index);
      expect(isMeasurementCurrent(game(current).notebook.measurements[0]!, game(current).world)).toBe(false);
    }
    const replay = reduce(current, command(current, accepted([on]), 'toggle-0'));
    expect(replay.status).toBe('no-op'); expect(replay.state).toBe(current);
    expect(game(current).world.flags[id<'flag'>('power')]).toBe(false);
  });

  it('does not advance physical freshness for a new fact and treats duplicate facts as a no-op', () => {
    const { state, reduce } = setup();
    const first = reduce(state, command(state, accepted([fact]))).state;
    expect(game(first).world.configurationRevision).toBe(4);
    expect(game(first).notebook.factIds).toEqual([id('fact-one')]);
    expect(isMeasurementCurrent(game(first).notebook.measurements[0]!, game(first).world)).toBe(true);
    expect(reduce(first, command(first, accepted([fact]), 'again')).state.runtime).toBe(first.runtime);
  });

  it('preserves the entire state and identity when logout is canceled, including a pending transition', () => {
    const { state, reduce } = setup();
    const pending = reduce(state, command(state, { ...accepted([on]), kind: 'begin', activity: 'pending-effect' })).state;
    expect(reduce(pending, command(pending, { kind: 'cancel-logout' }, 'cancel-logout')).state).toBe(pending);
  });
});

describe('essential recovery and fresh-attempt primitive', () => {
  it('never consumes a never-consumed essential tool, even in a documented transformation', () => {
    const { state, reduce } = setup({ item: { consumption: 'never' } });
    const result = reduce(state, command(state, accepted(repair)));
    expect(result.reason).toBe('item-not-consumable'); expect(result.state).toBe(state);
  });

  it('requires an actual documented transformation and currently reachable recovery, without refilling inventory', () => {
    const noTransform = setup({ item: { combinations: [] } });
    expect(noTransform.reduce(noTransform.state, command(noTransform.state, accepted(repair))).reason).toBe('unrecoverable-item');
    const remote = setup({ recovery: { policy: 'transformation-recoverable', roomId: id('R02'), condition: { kind: 'always' }, explanation: 'Remote bench' } });
    expect(remote.reduce(remote.state, command(remote.state, accepted(repair))).reason).toBe('unrecoverable-item');
    const { state, reduce } = setup(); const result = reduce(state, command(state, accepted(repair)));
    expect(result.status).toBe('applied'); expect(quantity(result.state, 'item-part')).toBe(0);
    expect(quantity(result.state, 'item-tool')).toBe(1);
  });

  it('checks recovery against the final world, including configuration effects and arrival', () => {
    const recovery: S.recovery = { policy: 'transformation-recoverable', roomId: id('R01'), condition: { kind: 'flag-equals', flagId: id('power'), value: true }, explanation: 'Powered workbench' };
    const { state, reduce } = setup({ recovery });
    const good = reduce(state, command(state, accepted([...repair, on])));
    expect(good.status).toBe('applied');
    const blocked = reduce(state, command(state, accepted([...repair, off])));
    expect(blocked.reason).toBe('unrecoverable-item'); expect(blocked.state).toBe(state);
    const moved = reduce(state, command(state, { ...accepted([...repair, on]), destination }));
    expect(moved.reason).toBe('unrecoverable-item'); expect(moved.state).toBe(state);
  });

  it('explicit recovery returns a consumed tool only at its available source and never grants extra copies', () => {
    const { state, reduce } = setup();
    const input: ReducerInput = { kind: 'recover-item', itemId: id('item-part') };
    expect(reduce(state, command(state, input)).state.runtime).toBe(state.runtime);
    const absent = createReducerState({ ...state.runtime, game: { ...game(state), world: { ...game(state).world, inventory: [] } } });
    expect(reduce(absent, command(absent, input)).status).toBe('rejected');
    const consumed = reduce(state, command(state, accepted(repair))).state;
    const recovered = reduce(consumed, command(consumed, input, 'recover-1'));
    expect(recovered.status).toBe('applied'); expect(quantity(recovered.state, 'item-part')).toBe(1);
    expect(quantity(recovered.state, 'item-repaired')).toBe(1);
    expect(reduce(recovered.state, command(recovered.state, input, 'recover-2')).state.runtime).toBe(recovered.state.runtime);
    expect(reduce(recovered.state, command(recovered.state, accepted(repair), 'replay-craft')).state.runtime).toBe(recovered.state.runtime);
    const relocated = { ...consumed, runtime: { ...consumed.runtime, game: { ...game(consumed), world: { ...game(consumed).world, roomId: id<'room'>('R02'), position: { safePositionId: id<'safe-position'>('safe-R02') } } } } };
    expect(reduce(relocated, command(relocated, input, 'remote-recover')).reason).toBe('recovery-unavailable');
  });

  it.each(['terminal-failure', 'shutdown'] as const)('rewinds %s preparation and rewards together while retaining learning and advancing beyond all old readings', kind => {
    const { state, reduce } = setup();
    const prepared = game(state).world;
    const applied = reduce(state, command(state, accepted(repair))).state;
    const learned = { ...game(applied), notebook: { ...game(applied).notebook, personalNotes: 'New lesson', factIds: [id<'fact'>('fact-one')],
      measurements: [{ ...game(applied).notebook.measurements[0]!, configurationRevision: 17 as ConfigurationRevision }] },
      assistance: [{ objectiveId: id<'objective'>('O01'), hintId: id<'hint'>('hint-one'), level: 3 as const, attemptId: attempt(1) }] };
    const failed = createReducerState({ ...applied.runtime, game: learned, activity: { kind }, checkpoint: { adventureId: learned.adventureId, world: prepared } });
    const result = reduce(failed, command(failed, { kind: 'rewind-preparation', nextAttemptId: attempt(2) }, 'retry-1'));
    expect(result.status).toBe('applied');
    expect(quantity(result.state, 'item-part')).toBe(1); expect(quantity(result.state, 'item-repaired')).toBe(0);
    expect(game(result.state).world.completedObjectiveIds).toEqual([]);
    expect(game(result.state).world.configurationRevision).toBe(18);
    expect(game(result.state).world.attemptId).toBe(attempt(2));
    expect(game(result.state).notebook.personalNotes).toBe('New lesson');
    expect(game(result.state).notebook.factIds).toEqual([id('fact-one')]);
    expect(game(result.state).assistance).toEqual(learned.assistance);
    expect(game(result.state).notebook.measurements[0]!.stale).toBe(true);
    expect(result.state.runtime.activity?.kind).toBe('safe-preparation');
    expect(result.state.runtime.persistence.pendingRequest).toBeNull();
    const rewarded = reduce(result.state, command(result.state, accepted(repair), 'repair-again')).state;
    expect(quantity(rewarded, 'item-repaired')).toBe(1);
    const failedAgain = { ...rewarded, runtime: { ...rewarded.runtime, activity: { kind: 'terminal-failure' as const } } };
    expect(reduce(failedAgain, command(failedAgain, { kind: 'rewind-preparation', nextAttemptId: attempt(1) }, 'reuse')).reason).toBe('attempt-reused');
    const second = reduce(failedAgain, command(failedAgain, { kind: 'rewind-preparation', nextAttemptId: attempt(3) }, 'retry-2')).state;
    expect(game(second).world.configurationRevision).toBe(20);
    expect(quantity(second, 'item-repaired')).toBe(0);
    expect(isMeasurementCurrent(game(second).notebook.measurements[0]!, game(second).world)).toBe(false);
  });

  it('rejects a retry without matching safe preparation, and never wraps exhausted freshness', () => {
    const { state, reduce } = setup();
    expect(reduce(state, command(state, { kind: 'rewind-preparation', nextAttemptId: attempt(2) })).status).toBe('rejected');
    const rt = runtime();
    const exhausted = createReducerState({ ...rt, game: { ...rt.game!, world: { ...rt.game!.world, configurationRevision: 2147483647 as ConfigurationRevision } } });
    const result = reduce(exhausted, command(exhausted, accepted([on])));
    expect(result.reason).toBe('generation-exhausted'); expect(result.state).toBe(exhausted);
  });

  it('requires both measurement generations and explicit freshness to agree', () => {
    const { state } = setup(); const world = game(state).world; const measurement = game(state).notebook.measurements[0]!;
    expect(isMeasurementCurrent(measurement, world)).toBe(true);
    expect(isMeasurementCurrent({ ...measurement, stale: true }, world)).toBe(false);
    expect(isMeasurementCurrent({ ...measurement, attemptId: attempt(2) }, world)).toBe(false);
    expect(isMeasurementCurrent({ ...measurement, configurationRevision: 3 as ConfigurationRevision }, world)).toBe(false);
  });

  it('allows a later distinct documented consumption and recovery without producing duplicate outputs', () => {
    const ctx = content();
    const consumeAgain = effect({ ...consume, effectId: id('consume-again') } as S.effect);
    const reagentAgain = effect({ ...consumeReagent, effectId: id('reagent-again') } as S.effect);
    const grantAgain = effect({ ...grant, effectId: id('grant-again'), itemId: id('item-gift') } as S.effect);
    const doneAgain = effect({ kind: 'complete-objective', effectId: id('done-again'), objectiveId: id('O02') });
    const second = [consumeAgain, reagentAgain, grantAgain, doneAgain];
    ctx.records.set(id('O02'), { kind: 'objective', id: id('O02'), prerequisite: { kind: 'objective-complete', objectiveId: id('O01') }, effects: second } as unknown as S.objective);
    ctx.members['objective']!.add(id('O02'));
    for (const e of second) ctx.members['effect']!.add(e.effectId);
    const item = ctx.records.get(id('item-part')) as S.item;
    item.combinations.push({ ...item.combinations[0]!, id: id('combine-again'), effects: second.slice(0, 3) });
    const reduce = createReducer({ ...ctx, bindings: [...bindings, ...second.map(e => ({
      sourceId: id('O02'), effectId: e.effectId, mode: 'once' as const, receipt: { kind: 'objective' as const, id: id<'objective'>('O02') },
    }))] });
    let state = createReducerState(runtime());
    state = reduce(state, command(state, accepted(repair), 'craft-one')).state;
    for (const key of ['item-part', 'item-reagent']) state = reduce(state, command(state, { kind: 'recover-item', itemId: id(key) }, `recover-${key}`)).state;
    const again = reduce(state, command(state, accepted(second), 'craft-two'));
    expect(again.status).toBe('applied'); state = again.state;
    expect(quantity(state, 'item-part')).toBe(0); expect(quantity(state, 'item-gift')).toBe(1);
    state = reduce(state, command(state, { kind: 'recover-item', itemId: id('item-part') }, 'recover-after-two')).state;
    expect(quantity(state, 'item-part')).toBe(1);
    const duplicated = reduce(state, command(state, accepted(second), 'replay-two'));
    expect(duplicated.status).toBe('no-op'); expect(quantity(duplicated.state, 'item-gift')).toBe(1);
  });

  it('does not strand an already-consumed essential tool by changing its recovery conditions', () => {
    const ctx = content();
    const item = ctx.records.get(id('item-part')) as S.item;
    item.combinations[0]!.recovery = { ...item.recovery, condition: { kind: 'flag-equals', flagId: id('power'), value: true } };
    const reduce = createReducer({ ...ctx, bindings }); let state = createReducerState(runtime());
    state = reduce(state, command(state, accepted([...repair, on]), 'craft')).state;
    expect(quantity(state, 'item-part')).toBe(0);
    const disabled = reduce(state, command(state, accepted([off]), 'disable'));
    expect(disabled.status).toBe('rejected'); expect(disabled.reason).toBe('unrecoverable-item'); expect(disabled.state).toBe(state);
    const malformed = { ...state, runtime: { ...state.runtime, game: { ...game(state), world: { ...game(state).world, flags: { [id<'flag'>('power')]: false } } } } };
    const result = reduce(malformed, command(malformed, { kind: 'recover-item', itemId: id('item-part') }, 'recover'));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('recovery-unavailable'); expect(result.state).toBe(malformed);
  });

  it('rejects unsupported minigame state predicates, including negation, instead of inventing save flags', () => {
    const { state, reduce } = setup({ condition: { kind: 'not', condition: { kind: 'minigame-complete', minigameId: id('MG01') } } });
    const result = reduce(state, command(state, accepted(repair)));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error'); expect(result.state).toBe(state);
  });

  it('prevents identity, empty action and active-party invariants from being bypassed', () => {
    const { state, reduce } = setup(); const original = command(state, accepted([on]));
    expect(reduce(state, { ...original, adventureId: attempt(99) as unknown as AdventureId }).reason).toBe('wrong-adventure');
    expect(reduce(state, { ...original, actionId: '' as ActionId }).reason).toBe('invalid-action');
    const broken = createReducerState({ ...state.runtime, game: { ...game(state), world: { ...game(state).world, activeAllyIds: [id('CH03')] } } });
    expect(reduce(broken, command(broken, accepted([on]))).reason).toBe('invalid-state');
  });

  it('a successful no-op action ID cannot later carry a different mutation', () => {
    const { state, reduce } = setup();
    const first = reduce(state, command(state, accepted([fact]), 'one')).state;
    const noop = reduce(first, command(first, accepted([fact]), 'two')).state;
    const reused = reduce(noop, command(noop, accepted([on]), 'two'));
    expect(reused.status).toBe('no-op'); expect(reused.state).toBe(noop);
    expect(game(noop).world.flags).toEqual({});
  });

  it('keeps one-time flag receipts authored, monotonic, and compatible with the unchanged save wire schema', async () => {
    const ctx = content();
    const marker = effect({ kind: 'set-flag', effectId: id('gift-marker'), flagId: id('FLAG-gift-received'), value: true });
    const dialogue = ctx.records.get(id('dialogue')) as S.dialogue;
    dialogue.nodes[0]!.effects.push(marker);
    ctx.members['effect']!.add(marker.effectId); ctx.members['flag']!.add(id('FLAG-gift-received'));
    const receipt = { kind: 'flag' as const, id: id<'flag'>('FLAG-gift-received') };
    const once = [talkGift, marker].map(e => ({ sourceId: id('dialogue'), effectId: e.effectId, mode: 'once' as const, receipt }));
    const reduce = createReducer({ ...ctx, bindings: once }); const state = createReducerState(runtime());
    const applied = reduce(state, command(state, accepted([talkGift, marker])));
    expect(applied.status).toBe('applied');
    expect(game(applied.state).world.flags[receipt.id]).toBe(true);
    expect(quantity(applied.state, 'item-gift')).toBe(1);
    expect(game(applied.state).world.dialogueEffectIds).toEqual([]);
    const payload = { ...game(applied.state), saveSchemaVersion: 1, safeState: 'stable-exploration' };
    const ajv = new Ajv2020({ strict: true, allowUnionTypes: true }); addFormats(ajv);
    const schema: object = JSON.parse(await readFile(new URL('../../specs/001-physical-layer-underworld/contracts/save.schema.json', import.meta.url), 'utf8'));
    const validate = ajv.compile(schema);
    expect(validate(payload), JSON.stringify(validate.errors)).toBe(true);
    const restored = createReducerState({ ...state.runtime, game: JSON.parse(JSON.stringify(game(applied.state))) });
    const replay = reduce(restored, command(restored, accepted([talkGift, marker]), 'loaded-replay'));
    expect(replay.status).toBe('no-op'); expect(quantity(replay.state, 'item-gift')).toBe(1);
    const reset = effect({ ...marker, effectId: id('reset-marker'), value: false } as S.effect);
    dialogue.nodes[0]!.effects.push(reset); ctx.members['effect']!.add(reset.effectId);
    const unsafe = createReducer({ ...ctx, bindings: [...once, { sourceId: id('dialogue'), effectId: reset.effectId, mode: 'repeatable' }] });
    expect(unsafe(state, command(state, accepted([talkGift, marker]))).reason).toBe('content-error');
  });

  it('cannot mark a different dialogue effect completed without including it in the atomic group', () => {
    const { state } = setup();
    const reduce = createReducer({ ...content(), bindings: [{ sourceId: id('dialogue'), effectId: talkGift.effectId,
      mode: 'once', receipt: { kind: 'dialogue-effect', id: fact.effectId as unknown as import('../../src/domain/types').DialogueEffectId } }] });
    const result = reduce(state, command(state, accepted([talkGift])));
    expect(result.status).toBe('rejected'); expect(result.reason).toBe('content-error'); expect(result.state).toBe(state);
  });

  it('rejects inventory overflow without awarding the receipt or consuming any input', () => {
    const { state, reduce } = setup();
    const full = createReducerState({ ...state.runtime, game: { ...game(state), world: { ...game(state).world,
      inventory: [...game(state).world.inventory, { itemId: id('item-gift'), quantity: 99 }],
    } } });
    const result = reduce(full, command(full, accepted([talkGift])));
    expect(result.reason).toBe('invalid-state'); expect(result.state).toBe(full);
    expect(game(full).world.dialogueEffectIds).toEqual([]);
  });

  it('rejects authored identifiers that cannot fit the save-v1 wire boundary', () => {
    const ctx = content(); const longId = id(`item-${'x'.repeat(70)}`);
    const gift = effect({ ...talkGift, itemId: longId } as S.effect);
    const dialogue = ctx.records.get(id('dialogue')) as S.dialogue;
    dialogue.nodes[0]!.effects = [gift]; ctx.members['item']!.add(longId);
    const reduce = createReducer({ ...ctx, bindings: [{ sourceId: id('dialogue'), effectId: gift.effectId, mode: 'once', receipt: { kind: 'dialogue-effect', id: id('dialogue-gift') } }] });
    const state = createReducerState(runtime()); const result = reduce(state, command(state, accepted([gift])));
    expect(result.reason).toBe('content-error'); expect(result.state).toBe(state);
  });

  it('owns a pending request snapshot and rejects callbacks after fresh state installation', () => {
    const { state, reduce } = setup();
    const request = structuredClone({ ...accepted([on]), kind: 'begin' as const, activity: 'pending-effect' as const });
    const begin = command(state, request, 'begin'); const pending = reduce(state, begin).state;
    (request.evaluation.acceptedEffects[0] as Extract<S.effect, { kind: 'set-flag' }>).value = false;
    const committed = reduce(pending, command(pending, { kind: 'commit', transitionActionId: begin.actionId }, 'finish'));
    expect(committed.status).toBe('applied'); expect(game(committed.state).world.flags[id<'flag'>('power')]).toBe(true);
    const reinstalled = createReducerState({ ...state.runtime, game: { ...game(state), world: { ...game(state).world, attemptId: attempt(2) } } });
    const callback = command(pending, { kind: 'commit', transitionActionId: begin.actionId }, 'late');
    expect(reduce(reinstalled, callback).reason).toBe('stale-version');
    expect(reduce(reinstalled, command(reinstalled, callback.input, 'fresh-late')).reason).toBe('unknown-transition');
  });

  it('can change to another eligible safe activity at the same position without fabricating a game change', () => {
    const { state, reduce } = setup();
    const result = reduce(state, command(state, { ...accepted([]), destination: {
      roomId: id('R01'), safePositionId: id('safe-R01'), activity: 'safe-preparation',
    } }));
    expect(result.status).toBe('applied'); expect(result.state.runtime.activity?.kind).toBe('safe-preparation');
    expect(result.state.runtime.game).toBe(state.runtime.game); expect(result.state.runtime.persistence).toBe(state.runtime.persistence);
  });
});
