// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, ConfigurationRevision, HypothesisId, MeasurementId, Metres, RoomId } from '../../src/domain/types';
import { createNavigation, pointInWalkRegion } from '../../src/state/navigation';
import type { NavigationEntry } from '../../src/state/navigation';
import { createReducer } from '../../src/state/reducer';
import type { ReducerCommand, ReducerInput, ReducerState } from '../../src/state/reducer';
import type { WorldState } from '../../src/state/types';
import { authoredInput, content, q, recipe, registry, setup } from '../ui/inventory-fixture';

const entries: NavigationEntry[] = ['R01', 'R02'].map(room => ({ roomId: q(room), safePositionId: q(`${room}.entry`), activity: 'stable-exploration' }));
const navigation = (source: ContentRegistry = registry, world = authoredInput.world, anchors = entries) => createNavigation({ registry: source, world, entries: anchors });
const worldAt = (room = 'R01'): WorldState => ({ ...setup().store.getState().runtime.game!.world, roomId: q(room), position: { safePositionId: q(`${room}.entry`) } });
const changedRoom = (change: (room: S.room) => void): ContentRegistry => ({ ...registry, record(id) {
  const record = registry.record(id); if (record?.kind !== 'room') return record;
  const copy = structuredClone(record); change(copy); return copy;
} });
const command = (state: ReducerState, id: string, input: ReducerInput): ReducerCommand => ({ actionId: id as ActionId,
  adventureId: state.runtime.game!.adventureId, expectedVersion: state.runtime.game!.world, input });
const evaluation = { status: 'correct' as const, reasonCode: 'authored-navigation', observations: [], acceptedEffects: [] };

describe('T028 authored safe navigation policy', () => {
  it('resolves actual R01/R02 exits and explicitly bound entry anchors', () => {
    const nav = navigation();
    for (const [from, to] of [['R01', 'R02'], ['R02', 'R01']]) {
      expect(nav.resolve(worldAt(from), q(to!), 'stable-exploration')).toMatchObject({ ok: true, kind: 'arrival',
        destination: { roomId: q(to!), safePositionId: q(`${to}.entry`), activity: 'stable-exploration' } });
      expect(nav.canReachRoom(worldAt(from), q(to!))).toBe(true);
    }
  });
  it.each(['R03', 'R05', 'R07', 'R09', 'R10'])('enforces the actual O02 gate before unavailable %s content', room => {
    const nav = navigation(), before = worldAt('R02');
    expect(nav.resolve(before, q(room), 'stable-exploration')).toMatchObject({ ok: false, reason: 'exit-locked' });
    const after = { ...before, completedObjectiveIds: [q<'objective'>('O02')] };
    expect(nav.resolve(after, q(room), 'stable-exploration')).toMatchObject({ ok: false, reason: 'room-unavailable' });
    expect(nav.canReachRoom(after, q(room))).toBe(false);
  });
  it('rejects global actions, remote anchors, nonlocal rooms and metadata-only starting worlds', () => {
    const nav = navigation();
    for (const target of ['ACTION-take-kit', 'HOTSPOT-endpoints', 'R02.entry', 'R03', 'R01', 'missing']) {
      expect(nav.resolve(worldAt(), q(target), 'stable-exploration').ok).toBe(false);
    }
    expect(nav.resolve(worldAt('R03'), q('R02'), 'stable-exploration')).toMatchObject({ ok: false, reason: 'room-unavailable' });
    expect(nav.canReachRoom(worldAt('R03'), q('R03'))).toBe(false);
  });
  it('maps floor only to the explicit entry; self-position remains a genuine no-op target', () => {
    const nav = navigation();
    for (const target of ['WALK-R01', 'R01.entry']) expect(nav.resolve(worldAt(), q(target), 'stable-exploration')).toMatchObject({ ok: true, kind: 'position', destination: { safePositionId: q('R01.entry') } });
    const missing = navigation(registry, authoredInput.world, []);
    expect(missing.resolve(worldAt(), q('WALK-R01'), 'stable-exploration')).toMatchObject({ ok: false, reason: 'anchor-unavailable' });
    expect(missing.resolve(worldAt(), q('R02'), 'stable-exploration')).toMatchObject({ ok: false, reason: 'anchor-unavailable' });
  });
  it('does not use a safe anchor registered only in metadata or eligible for a different activity', () => {
    const bad = navigation(registry, authoredInput.world, [{ roomId: q('R02'), safePositionId: q('R01.entry'), activity: 'stable-exploration' }]);
    expect(bad.resolve(worldAt(), q('R02'), 'stable-exploration').ok).toBe(false);
    const ineligible = navigation(registry, authoredInput.world, [{ roomId: q('R01'), safePositionId: q('R01.entry'), activity: 'safe-preparation' }]);
    expect(ineligible.resolve(worldAt('R02'), q('R01'), 'stable-exploration')).toMatchObject({ ok: false, reason: 'unsafe-position' });
    expect(navigation().resolve(worldAt(), q('R02'), 'safe-preparation')).toMatchObject({ ok: false, reason: 'unsafe-position' });
  });
  it.each(['outside', 'no-region', 'wrong-exit-region', 'no-anchor'] as const)('fails closed on %s geometry without changing a world', fault => {
    const source = changedRoom(room => {
      if (fault === 'wrong-exit-region' && room.id === q('R01')) room.exits[0]!.walkRegionId = q('missing');
      if (room.id !== q('R02')) return;
      if (fault === 'outside') room.safePositions[0]!.point = { x: 11, y: 3 };
      if (fault === 'no-region') room.safePositions[0]!.walkRegionId = q('missing');
      if (fault === 'no-anchor') room.safePositions = [];
    });
    const nav = navigation(source), before = worldAt();
    expect(nav.resolve(before, q('R02'), 'stable-exploration').ok).toBe(false);
    expect(nav.canReachRoom(before, q('R02'))).toBe(false);
    expect(before).toEqual(worldAt());
  });
  it('accepts polygon boundaries and concave interiors, rejecting outside/nonfinite/degenerate points', () => {
    const polygon = [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 4, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 4 }, { x: 0, y: 4 }];
    for (const point of [{ x: 0, y: 0 }, { x: 4, y: 0.5 }, { x: 0.5, y: 3 }, { x: 1, y: 1 }]) expect(pointInWalkRegion(point, polygon)).toBe(true);
    for (const point of [{ x: 2, y: 2 }, { x: -0.1, y: 0 }, { x: NaN, y: 0 }, { x: 0, y: Infinity }]) expect(pointInWalkRegion(point, polygon)).toBe(false);
    expect(pointInWalkRegion({ x: 0, y: 0 }, [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }])).toBe(false);
  });
  it('requires both directed paths for recovery, even when the return-policy direction itself is available', () => {
    // Policy fixture changes only the real two-room edge to prove directionality.
    const graph = structuredClone(authoredInput.world); graph.walkEdges[0]!.forwardPrerequisite = { kind: 'objective-complete', objectiveId: q('O02') };
    const nav = navigation(registry, graph), before = worldAt('R02');
    expect(nav.resolve(before, q('R01'), 'stable-exploration').ok).toBe(true);
    expect(nav.canReachRoom(before, q('R01'))).toBe(false);
    expect(nav.canReachRoom({ ...before, completedObjectiveIds: [q<'objective'>('O02')] }, q('R01'))).toBe(true);
    expect(nav.canReachRoom(worldAt(), q('R01'))).toBe(true);
  });
  it('requires physical authored exits in both directions for reversible recovery', () => {
    const source = changedRoom(room => { if (room.id === q('R02')) room.exits = room.exits.filter(e => e.toRoomId !== q('R01')); });
    const nav = navigation(source);
    expect(nav.resolve(worldAt(), q('R02'), 'stable-exploration').ok).toBe(true);
    expect(nav.canReachRoom(worldAt(), q('R02'))).toBe(false);
  });
  it('detaches explicit entries and metadata and bounds traversal input', () => {
    const graph = structuredClone(authoredInput.world), copy = structuredClone(entries), nav = navigation(registry, graph, copy);
    graph.walkEdges.length = 0; copy.length = 0;
    expect(nav.canReachRoom(worldAt(), q('R02'))).toBe(true);
    expect(() => navigation(registry, { ...authoredInput.world, rooms: Array.from({ length: 129 }, () => authoredInput.world.rooms[0]!) })).toThrow();
    expect(() => navigation(registry, authoredInput.world, [...entries, entries[0]!])).toThrow();
  });
  it('never authorizes consumed-tool transformation when actual recovery is unavailable or one-way', () => {
    const fixture = recipe({ recoveryRoom: 'R02' }), source = content(fixture.records), before = setup({ records: fixture.records, bindings: fixture.bindings,
      inventory: [{ itemId: q('ITEM-part-a'), quantity: 1 }, { itemId: q('ITEM-part-b'), quantity: 1 }] }).store.getState();
    const effects = fixture.records[0]!.combinations[0]!.effects;
    const input = { kind: 'apply' as const, evaluation: { ...evaluation, acceptedEffects: effects as import('../../src/state/reducer').StateEffect[] } };
    const accept = createReducer({ registry: source, bindings: fixture.bindings, canReachRoom: navigation(source).canReachRoom });
    expect(accept(before, command(before, 'joined', input)).status).toBe('applied');
    const graph = structuredClone(authoredInput.world); graph.walkEdges[0]!.forwardPrerequisite = { kind: 'objective-complete', objectiveId: q('O02') };
    const reject = createReducer({ registry: source, bindings: fixture.bindings, canReachRoom: navigation(source, graph).canReachRoom });
    expect(reject(before, command(before, 'locked-join', input))).toMatchObject({ status: 'rejected', reason: 'unrecoverable-item', state: before });
    graph.walkEdges[0]!.forwardPrerequisite = { kind: 'not', condition: { kind: 'flag-equals', flagId: q('FLAG-joined'), value: true } };
    const candidatePolicy = navigation(source, graph);
    expect(candidatePolicy.canReachRoom(before.runtime.game!.world, q('R02'))).toBe(true);
    const closesRoute = createReducer({ registry: source, bindings: fixture.bindings, canReachRoom: candidatePolicy.canReachRoom });
    expect(closesRoute(before, command(before, 'closes-recovery-route', input))).toMatchObject({ status: 'rejected', reason: 'unrecoverable-item', state: before });
  });
});

describe('T028 reducer arrival boundary', () => {
  it('commits location, map discovery and stale marking once while carrying the whole learning journal/inventory', () => {
    const f = setup({ inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] }), original = f.store.getState(), game = original.runtime.game!;
    const before: ReducerState = { ...original, runtime: { ...original.runtime, game: { ...game,
      assistance: [{ objectiveId: q('O01'), hintId: q('HINT-O01-method'), level: 1, attemptId: game.world.attemptId }], notebook: { ...game.notebook,
      factIds: [q('FACT-photon-clue')], personalNotes: 'Test the path before declaring service.', hypotheses: [{ id: '00000000-0000-4000-8000-000000000028' as HypothesisId, text: 'A long path may explain the symptom.', status: 'open', subjectIds: [q('PR003')] }],
      measurements: [{ id: '00000000-0000-4000-8000-000000000029' as MeasurementId, ruleId: q('PHY04'), subjectIds: [q('PR003')], roomId: q('R01'), attemptId: game.world.attemptId,
        configurationRevision: 0 as ConfigurationRevision, stale: false, readings: [{ name: 'Channel length', value: 105 as Metres, unit: 'm' }], conclusionCode: 'channel-too-long' }] } } } };
    const found = navigation().resolve(before.runtime.game!.world, q('R02'), 'stable-exploration'); if (!found.ok) throw new Error(found.reason);
    const input: ReducerInput = { kind: 'apply', evaluation, destination: found.destination };
    const result = f.store.reduce(before, command(before, 'arrival', input));
    expect(result.status).toBe('applied'); expect(result.state.runtime.game!.world.roomId).toBe(q('R02'));
    expect(result.state.runtime.game!.world.position.safePositionId).toBe(q('R02.entry'));
    expect(result.state.runtime.game!.notebook).toEqual({ ...before.runtime.game!.notebook, mapRoomIds: [q('R01'), q('R02')], measurements: before.runtime.game!.notebook.measurements.map(m => ({ ...m, stale: true })) });
    expect(result.state.runtime.game!.world.inventory).toEqual(before.runtime.game!.world.inventory);
    expect(result.state.runtime.game!.assistance).toEqual(before.runtime.game!.assistance);
    expect(result.state.runtime.persistence.dirtyGeneration).toBe(1); expect(result.state.runtime.persistence.status).toBe('unsaved');
    expect(f.store.reduce(result.state, command(result.state, 'arrival', input)).status).toBe('no-op');
    expect(f.store.reduce(result.state, command(result.state, 'same-anchor', input)).state.runtime.game).toBe(result.state.runtime.game);
  });
  it('keeps world and map unchanged on pending/cancel/failed commit, and commits only a valid owned transition', () => {
    const f = setup(), before = f.store.getState(), found = navigation().resolve(before.runtime.game!.world, q('R02'), 'stable-exploration'); if (!found.ok) throw new Error(found.reason);
    const begin = f.store.reduce(before, command(before, 'begin', { kind: 'begin', activity: 'room-transition', evaluation, destination: found.destination }));
    expect(begin.status).toBe('pending'); expect(begin.state.runtime.game).toBe(before.runtime.game);
    const canceled = f.store.reduce(begin.state, command(begin.state, 'cancel', { kind: 'cancel', transitionActionId: 'begin' as ActionId }));
    expect(canceled.status).toBe('canceled'); expect(canceled.state.runtime.game).toBe(before.runtime.game);
    const wrong = f.store.reduce(begin.state, command(begin.state, 'wrong-owner', { kind: 'commit', transitionActionId: 'other' as ActionId }));
    expect(wrong.state).toBe(begin.state); expect(wrong.status).toBe('rejected');
    const exhausted = { ...begin.state, runtime: { ...begin.state.runtime, persistence: { ...begin.state.runtime.persistence, dirtyGeneration: Number.MAX_SAFE_INTEGER as typeof before.runtime.persistence.dirtyGeneration } } };
    expect(f.store.reduce(exhausted, command(exhausted, 'commit-exhausted', { kind: 'commit', transitionActionId: 'begin' as ActionId }))).toMatchObject({ status: 'rejected', state: exhausted });
    const committed = f.store.reduce(begin.state, command(begin.state, 'commit', { kind: 'commit', transitionActionId: 'begin' as ActionId }));
    expect(committed.state.runtime.game!.notebook.mapRoomIds).toEqual([q('R01'), q('R02')]); expect(committed.state.control.pending).toBeNull();
  });
  it('fails without partial movement if the atomic map result exceeds its bound', () => {
    const f = setup(), before = f.store.getState();
    const full = { ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, notebook: { ...before.runtime.game!.notebook,
      mapRoomIds: Array.from({ length: 128 }, (_, i) => q(`visited-${i}`) as RoomId) } } } };
    const found = navigation().resolve(full.runtime.game.world, q('R02'), 'stable-exploration'); if (!found.ok) throw new Error(found.reason);
    expect(f.store.reduce(full, command(full, 'overflow', { kind: 'apply', evaluation, destination: found.destination }))).toMatchObject({ status: 'rejected', state: full });
  });
});
