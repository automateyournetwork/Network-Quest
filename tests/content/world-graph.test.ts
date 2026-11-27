// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { episodeNavigationEntries, loadIntroductionContent } from '../../src/app/content';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { MeasurementId, QualifiedId } from '../../src/domain/types';
import { conditionSatisfied } from '../../src/state/conditions';
import { createNavigation } from '../../src/state/navigation';
import { createReducer, createReducerState, type ReducerState } from '../../src/state/reducer';
import { prepareRepairPlanChange, repairFlags } from '../../src/state/repair-plan';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import { createNavigationPlanner, createSceneObjectProjection } from '../../src/ui/scene-objects';
import { createVerbController } from '../../src/ui/verbs';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const canonicalWorld = await read<S.world>('content/spec001/world.json');
const sources = await read<unknown>('content/spec001/sources.json');
const documents = Object.fromEntries(await Promise.all([...new Set(canonicalWorld.documents.map(d => d.path))].map(async path => [path, await read(path)])));
const { registry, world } = loadIntroductionContent();

// Independent SPEC.md “Walk graph and unlocks” transcription. These expected
// pairs and routes must never be obtained from the production graph under test.
const roomIds = ['R01', 'R02', 'R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12'] as const;
const pairs = [
  ['R01', 'R02'], ['R02', 'R03'], ['R02', 'R05'], ['R02', 'R07'], ['R02', 'R09'], ['R02', 'R10'],
  ['R03', 'R04'], ['R05', 'R06'], ['R07', 'R08'], ['R04', 'R11'], ['R06', 'R11'], ['R08', 'R11'], ['R10', 'R11'], ['R11', 'R12'],
] as const;
const branches = [
  { name: 'copper', rooms: ['R03', 'R04'], objectives: ['O03', 'O04'], otherObjectives: ['O05', 'O06', 'O07', 'O08'] },
  { name: 'fiber', rooms: ['R05', 'R06'], objectives: ['O05', 'O06'], otherObjectives: ['O03', 'O04', 'O07', 'O08'] },
  { name: 'radio', rooms: ['R07', 'R08'], objectives: ['O07', 'O08'], otherObjectives: ['O03', 'O04', 'O05', 'O06'] },
] as const;
const entries = episodeNavigationEntries(registry, world);

function at(roomId = 'R01', completed: readonly string[] = []): ReducerState {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), game = runtime.game!;
  return createReducerState({ ...runtime, activity: { kind: roomId === 'R11' ? 'safe-preparation' : 'stable-exploration' },
    game: { ...game, world: { ...game.world, roomId: q(roomId), position: { safePositionId: q(roomId === 'R11' ? 'R11.preparation' : `${roomId}.entry`) },
      completedObjectiveIds: completed.map(id => q<'objective'>(id)) }, notebook: { ...game.notebook, mapRoomIds: [q(roomId)], personalNotes: 'Preserve this observation during travel.' } } });
}

/** Actual immutable action bus → Walk controller → planner → reducer pipeline.
 * Prepared objective receipts isolate navigation; they do not certify learning. */
function walkFixture(roomId = 'R01', completed: readonly string[] = []) {
  const navigation = createNavigation({ registry, world, entries });
  let state = at(roomId, completed);
  const store = { getState: () => state, reduce: createReducer({ registry, bindings: [], canReachRoom: navigation.canReachRoom }),
    compareAndSet: (expected: ReducerState, next: ReducerState) => { if (state !== expected) return false; state = next; return true; } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createVerbController({ registry, store, bus, bindings: [], walk: createNavigationPlanner({ navigation, store }),
    sceneObjects: createSceneObjectProjection({ registry, navigation }) });
  return { navigation, store, bus, controller,
    walk: (target: string) => bus.dispatch(bus.capture({ kind: 'interact', targetId: q(target), verb: 'walk', itemId: null })),
    close: () => controller.dispose() };
}
function room(id: string): Readonly<S.room> {
  const value = registry.record(q(id));
  if (value?.kind !== 'room') throw new Error(`The actual application is missing authored ${id}`);
  return value;
}

describe('T081 canonical twelve-room selection and exact SPEC graph', () => {
  it('selects all twelve actual authored room records in the canonical world and application', () => {
    const expected = roomIds.map(q);
    expect(canonicalWorld.documents.filter(d => d.kind === 'room').map(d => d.id).sort()).toEqual(expected);
    expect(world.documents).toEqual(canonicalWorld.documents);
    expect(roomIds.filter(id => registry.record(q(id))?.kind === 'room').map(q)).toEqual(expected);
    expect(world.rooms.map(r => r.id).sort()).toEqual(expected);
    expect(entries).toEqual(roomIds.map(id => ({ roomId: q(id), safePositionId: q(id === 'R11' ? 'R11.preparation' : `${id}.entry`),
      activity: id === 'R11' ? 'safe-preparation' : 'stable-exploration' })));
  });
  it('validates the canonical document selection without a replacement projection', () => {
    const result = validateContent({ world: canonicalWorld, sources, documents });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) throw new Error('Canonical world validation failed');
    const canonicalRegistry = result.registry;
    if (!canonicalRegistry) throw new Error('Canonical world registry missing');
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    expect(roomIds.filter(id => canonicalRegistry.record(q(id))?.kind === 'room').map(q)).toEqual(roomIds.map(q));
  });
  it('has exactly the fourteen bidirectional pairs with reversible ordinary returns', () => {
    expect(world.walkEdges.map(e => [e.from, e.to])).toEqual(pairs.map(pair => pair.map(q)));
    for (const edge of world.walkEdges) expect(edge).toMatchObject({ bidirectional: true, returnPolicy: 'available', temporaryBlockPolicy: 'narrated-reversible-encounter-only' });
  });
  it.each(roomIds)('%s exposes exactly its SPEC exits, actual clear-floor anchor and allocated identities', id => {
    const value = room(id), expected = pairs.flatMap(([a, b]) => a === id ? [q(b)] : b === id ? [q(a)] : []).sort();
    expect(value.exits.map(e => e.toRoomId).sort()).toEqual(expected);
    const allocation = world.rooms.find(r => r.id === q(id))!;
    expect(value.safePositions.map(p => p.id)).toEqual([q(id === 'R11' ? 'R11.preparation' : `${id}.entry`)]);
    expect(value.safePositions.map(p => p.id)).toEqual(allocation.safePositionIds);
    expect(value.characterIds).toEqual(allocation.characterIds);
    expect(value.propInstances.map(p => p.propId)).toEqual(allocation.propIds);
    const f = walkFixture(id, ['O01', 'O02', 'O03', 'O04', 'O09', 'O10', 'O11']);
    expect(f.walk(id === 'R11' ? 'R11.preparation' : `${id}.entry`).status).toBe('handled');
    f.close();
  });
});

describe('T081 actual Walk execution and independently expected unlocks', () => {
  it('permits both introduction directions before O01 and preserves guest memory', () => {
    const f = walkFixture(), before = f.store.getState().runtime;
    expect(f.walk('R02').status).toBe('handled');
    expect(f.walk('R01').status).toBe('handled');
    const after = f.store.getState().runtime;
    expect(after.game!.world.completedObjectiveIds).toEqual([]);
    expect(after.game!.notebook.personalNotes).toBe(before.game!.notebook.personalNotes);
    expect(after.game!.notebook.mapRoomIds).toEqual(['R01', 'R02'].map(q));
    expect(after.auth.status).toBe('guest'); expect(after.persistence.knownSlot).toBeUndefined();
    f.close();
  });
  it.each(['R03', 'R05', 'R07', 'R09', 'R10'])('gates R02 → %s only on briefing, with a real reversible walk after O02', target => {
    const blocked = walkFixture('R02', ['O01']), original = blocked.store.getState().runtime.game;
    expect(blocked.walk(target).status).toBe('unavailable');
    expect(blocked.store.getState().runtime.game).toBe(original); blocked.close();
    const ready = walkFixture('R02', ['O01', 'O02']);
    expect(ready.walk(target).status).toBe('handled');
    expect(ready.store.getState().runtime.game!.world.roomId).toBe(q(target));
    expect(ready.walk('R02').status).toBe('handled'); ready.close();
  });
  it.each(branches)('$name foundational/applied rooms can be explored before either branch objective is awarded', branch => {
    const f = walkFixture('R02', ['O01', 'O02']);
    for (const target of [...branch.rooms, branch.rooms[0], 'R02']) expect(f.walk(target).status, target).toBe('handled');
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toEqual(['O01', 'O02'].map(q));
    f.close();
  });
  it.each(['R04', 'R06', 'R08', 'R10'])('%s → Rift obeys branch OR plus Clockworks, independently of equipment, across all 32 receipt combinations', from => {
    const flags = ['O04', 'O06', 'O08', 'O09', 'O10'];
    for (let mask = 0; mask < 32; mask++) {
      const completed = ['O01', 'O02', ...flags.filter((_, index) => (mask & (1 << index)) !== 0)];
      const expected = (mask & 7) !== 0 && (mask & 16) !== 0;
      const f = walkFixture(from, completed), before = f.store.getState().runtime.game;
      expect(f.walk('R11').status, `${from} mask ${mask}`).toBe(expected ? 'handled' : 'unavailable');
      if (expected) expect(f.store.getState().runtime.game!.world).toMatchObject({ roomId: q('R11'), position: { safePositionId: q('R11.preparation') } });
      else expect(f.store.getState().runtime.game).toBe(before);
      f.close();
    }
  });
  it.each(branches)('$name reaches Rift inspection without mastering or visiting another branch', branch => {
    const completed = ['O01', 'O02', ...branch.objectives, 'O10'], f = walkFixture('R01', completed);
    for (const target of ['R02', 'R10', 'R02', ...branch.rooms, 'R11']) expect(f.walk(target).status, target).toBe('handled');
    expect(f.store.getState().runtime.activity?.kind).toBe('safe-preparation');
    const game = f.store.getState().runtime.game!;
    for (const id of [...branch.otherObjectives, 'O09', 'O11', 'O12']) expect(game.world.completedObjectiveIds).not.toContain(q(id));
    for (const other of branches.filter(b => b.name !== branch.name)) for (const id of other.rooms) expect(game.notebook.mapRoomIds).not.toContain(q(id));
    expect(game.world.completedQuestIds).toEqual([]); expect(game.world.recruits).toEqual([]);
    f.close();
  });
  it.each(branches)('$name inspection leaves actual intervention blocked until O09 equipment is also complete', branch => {
    const f = walkFixture('R11', ['O01', 'O02', ...branch.objectives, 'O10']);
    const game = f.store.getState().runtime.game!, plan = branch.name === 'copper' ? 'copper-section' : `${branch.name}-A`;
    const proposed = { ...game, world: { ...game.world, flags: { ...game.world.flags, [repairFlags.selected]: plan, [repairFlags.duration]: 'permanent' } } };
    const blocked = prepareRepairPlanChange(registry, undefined, proposed, { kind: 'review', id: '00000000-0000-4000-8000-000000000081' as MeasurementId });
    expect(blocked).toMatchObject({ ok: true, evaluation: { status: 'incorrect', reasonCode: 'prerequisite-unmet', acceptedEffects: [] } });
    const objective = registry.record(q('O11')) as S.objective;
    expect(conditionSatisfied(objective.prerequisite, proposed.world)).toBe(false);
    expect(conditionSatisfied(objective.prerequisite, { ...proposed.world, completedObjectiveIds: [...proposed.world.completedObjectiveIds, q('O09')] })).toBe(true);
    f.close();
  });
  it.each(branches)('$name can leave the Rift, reach the ordinary kit and market, and return without a side reward', branch => {
    const completed = ['O01', 'O02', ...branch.objectives, 'O10'], f = walkFixture('R11', completed);
    expect(f.navigation.canReachRoom(f.store.getState().runtime.game!.world, q('R01'))).toBe(true);
    for (const target of [branch.rooms[1], branch.rooms[0], 'R02', 'R01', 'R02', 'R09', 'R02', 'R10', 'R11']) expect(f.walk(target).status, target).toBe('handled');
    expect(f.store.getState().runtime.game!.world.completedQuestIds).toEqual([]);
    f.close();
  });
  it('opens the validation balcony only after O11, without awarding O12 or restored service by arrival', () => {
    const blocked = walkFixture('R11', ['O01', 'O02', 'O03', 'O04', 'O09', 'O10']);
    expect(blocked.walk('R12').status).toBe('unavailable'); blocked.close();
    const ready = walkFixture('R11', ['O01', 'O02', 'O03', 'O04', 'O09', 'O10', 'O11']);
    expect(ready.walk('R12').status).toBe('handled');
    expect(ready.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O12'));
    expect(ready.store.getState().runtime.game!.outcomeHistory).toEqual([]);
    expect(ready.walk('R11').status).toBe('handled'); ready.close();
  });
  it('keeps every earlier room reachable after a completed copper route while optional routes stay unfinished', () => {
    const f = walkFixture('R12', ['O01', 'O02', 'O03', 'O04', 'O09', 'O10', 'O11', 'O12']);
    for (const target of ['R11', 'R06', 'R05', 'R02', 'R07', 'R08', 'R07', 'R02', 'R09', 'R02', 'R03', 'R04', 'R11', 'R12']) expect(f.walk(target).status, target).toBe('handled');
    for (const id of ['O05', 'O06', 'O07', 'O08']) expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q(id));
    expect(f.store.getState().runtime.game!.world.completedQuestIds).toEqual([]); f.close();
  });
  it('keeps Iron City visibly future, absent from exits and impossible to traverse or require', () => {
    const f = walkFixture('R12', roomIds.map(id => id.replace('R', 'O'))), before = f.store.getState().runtime.game;
    expect(world.futureDoors).toMatchObject([{ id: q('FD-IRON-CITY'), roomId: q('R12'), targetEpisodeId: 'spec002', traversable: false, requiredForMainStory: false }]);
    expect(JSON.stringify(room('R12').hotspots)).toMatch(/future|unavailable|not yet released/i);
    expect(room('R12').exits.map(e => e.toRoomId)).toEqual([q('R11')]);
    expect(f.walk('FD-IRON-CITY').status).not.toBe('handled');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'interact', targetId: 'spec002:R01' as QualifiedId, verb: 'walk', itemId: null })).status).not.toBe('handled');
    expect(f.store.getState().runtime.game).toBe(before);
    expect(conditionSatisfied({ kind: 'future-door-open', futureDoorId: q('FD-IRON-CITY') }, before!.world)).toBe(false);
    expect(world.constraints.futureContentRequiredForMainStory).toBe(false); f.close();
  });
});
