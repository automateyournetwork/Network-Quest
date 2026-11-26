// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import type { AttemptId } from '../../src/domain/types';
import { createNavigation } from '../../src/state/navigation';
import { createReducer } from '../../src/state/reducer';
import type { ReducerState } from '../../src/state/reducer';
import { createNavigationPlanner, createSceneObjectProjection } from '../../src/ui/scene-objects';
import { createVerbController } from '../../src/ui/verbs';
import { authoredInput, introBindings, q, setup } from './inventory-fixture';

function fixture() {
  const f = setup(), nav = createNavigation({ registry: f.registry, world: authoredInput.world,
    entries: ['R01', 'R02'].map(room => ({ roomId: q(room), safePositionId: q(`${room}.entry`), activity: 'stable-exploration' })) });
  f.store.reduce = createReducer({ registry: f.registry, bindings: introBindings, canReachRoom: nav.canReachRoom });
  const walk = createNavigationPlanner({ navigation: nav, store: f.store }), sceneObjects = createSceneObjectProjection({ registry: f.registry, navigation: nav });
  const controller = createVerbController({ ...f, bindings: [{ roomId: q('R01'), hotspotId: q('HOTSPOT-power'), actionId: q('ACTION-observe-power'), sourceId: q('DIALOGUE-arrival-actions'), verb: 'look', itemId: null, mode: 'effects' }], walk, sceneObjects });
  return { ...f, nav, walk, controller, sceneObjects };
}
const intent = (target: string) => ({ kind: 'interact' as const, targetId: q(target), verb: 'walk' as const, itemId: null });

describe('T028 equivalent scene object/navigation projection', () => {
  it('projects every actual hotspot, exit, region and safe position with the T025 actions intact', () => {
    const f = fixture(), room = f.registry.record(q('R01')); if (room?.kind !== 'room') throw new Error('R01');
    const objects = f.controller.objects();
    expect(objects.map(o => o.id)).toEqual([...room.hotspots.map(h => h.id), 'exit:spec001:R01:spec001:R02', q('WALK-R01'), q('R01.entry')]);
    expect(objects.find(o => o.id === q('R01.entry'))!.description).toBe('A safe place to stand on the clear floor. Choose Walk to move here.');
    expect(new Set(objects.flatMap(o => o.actions.map(a => a.id))).size).toBe(objects.flatMap(o => o.actions).length);
    f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'look' }));
    const hotspot = f.controller.objects().find(o => o.id === q('HOTSPOT-power'))!;
    expect(hotspot.description).toBe(room.hotspots[0]!.description);
    expect(hotspot.actions.map(a => a.label)).toContain('Power indication');
    expect(f.bus.dispatch(f.bus.capture(hotspot.actions[0]!.action)).status).toBe('handled');
    expect(f.store.getState().runtime.game!.notebook.factIds).toEqual([q('FACT-power')]);
  });
  it('moves through the one captured interaction path and preserves observations on a return visit', () => {
    const f = fixture(); f.bus.dispatch(f.bus.capture({ kind: 'interact', targetId: q('HOTSPOT-power'), verb: 'look', itemId: null }));
    const action = f.bus.capture(intent('R02')); expect(f.bus.dispatch(action).status).toBe('handled');
    const arrived = f.store.getState(); expect(arrived.runtime.game!.world.roomId).toBe(q('R02'));
    expect(arrived.runtime.game!.notebook.factIds).toEqual([q('FACT-power')]); expect(arrived.runtime.game!.notebook.mapRoomIds).toEqual([q('R01'), q('R02')]);
    expect(f.bus.dispatch(action).status).toBe('handled'); expect(f.store.getState()).toBe(arrived);
    expect(f.bus.dispatch(f.bus.capture(intent('R01'))).status).toBe('handled');
    expect(f.store.getState().runtime.game!.notebook.mapRoomIds).toEqual([q('R01'), q('R02')]);
    expect(f.store.getState().runtime.game!.notebook.factIds).toEqual([q('FACT-power')]);
  });
  it('projects all six workshop exits honestly and does not move through a locked or unavailable one', () => {
    const f = fixture(); f.bus.dispatch(f.bus.capture(intent('R02')));
    const objects = f.controller.objects(), exits = objects.filter(o => o.id.startsWith('exit:'));
    expect(exits).toHaveLength(6); expect(exits[0]!.actions[0]!.unavailableReason).toBeUndefined();
    for (const exit of exits.slice(1)) {
      expect(exit.actions[0]!.unavailableReason).toContain('requirements');
      const before = f.store.getState(); expect(f.bus.dispatch(f.bus.capture(exit.actions[0]!.action)).status).toBe('unavailable'); expect(f.store.getState()).toBe(before);
    }
    const before = f.store.getState(); f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, completedObjectiveIds: [q('O02')] } } } });
    const unlocked = f.controller.objects().find(o => o.id === 'exit:spec001:R02:spec001:R03')!;
    expect(unlocked.actions[0]!.unavailableReason).toContain('not available');
    expect(f.bus.dispatch(f.bus.capture(unlocked.actions[0]!.action)).reason).toBe('room-unavailable');
    expect(f.store.getState().runtime.game!.world.roomId).toBe(q('R02'));
  });
  it('rejects canceled, stale attempt and restored projection actions without world changes', () => {
    const f = fixture(), canceled = f.bus.capture(intent('R02')); f.bus.cancel(canceled);
    const before = f.store.getState(); expect(f.bus.dispatch(canceled).reason).toBe('canceled'); expect(f.store.getState()).toBe(before);
    const stale = f.bus.capture(intent('R02'));
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, attemptId: '11111111-1111-4111-8111-111111111111' as AttemptId } } } });
    const replaced = f.store.getState(); expect(f.bus.dispatch(stale).reason).toBe('stale-context'); expect(f.store.getState()).toBe(replaced);
    const scope = f.bus.captureScope(); f.bus.invalidate(); f.replace(before);
    expect(f.bus.dispatch(scope(intent('R02'))).reason).toBe('invalidated'); expect(f.store.getState()).toBe(before);
  });
  it('does not cancel or bypass another owner pending dialogue/transition transaction', () => {
    const f = fixture(), before = f.store.getState();
    for (const activity of ['dialogue-transaction', 'room-transition'] as const) {
      const pending = f.store.reduce(before, { actionId: 'other-owner' as import('../../src/domain/types').ActionId, adventureId: before.runtime.game!.adventureId,
        expectedVersion: before.runtime.game!.world, input: { kind: 'begin', activity, evaluation: { status: 'correct', reasonCode: 'lock', observations: [], acceptedEffects: [] } } });
      expect(pending.status).toBe('pending'); f.replace(pending.state);
      expect(f.bus.dispatch(f.bus.capture(intent('R02'))).reason).toBe('unavailable-state'); expect(f.store.getState()).toBe(pending.state);
      const room = f.registry.record(q('R01')); if (room?.kind !== 'room') throw new Error('R01');
      expect(f.walk({ room, targetId: q('R02') }, f.bus.capture(intent('R02')), pending.state).status).toBe('unavailable');
    }
  });
  it('rejects unsafe activity, forged room/intent and a same-version replaced state before commit', () => {
    const f = fixture(), before = f.store.getState(), room = f.registry.record(q('R01')); if (room?.kind !== 'room') throw new Error('R01');
    const action = f.bus.capture(intent('R02'));
    expect(f.walk({ room, targetId: q('R01.entry') }, action, before).status).toBe('rejected');
    const remote = f.registry.record(q('R02')); if (remote?.kind !== 'room') throw new Error('R02');
    expect(f.walk({ room: remote, targetId: q('R02') }, action, before).status).toBe('rejected');
    const plan = f.walk({ room, targetId: q('R02') }, action, before); expect(plan.status).toBe('ready');
    f.replace({ ...before }); if (plan.status !== 'ready') throw new Error('ready');
    expect(plan.commit().reason).toBe('state-replaced'); expect(f.store.getState().runtime.game).toBe(before.runtime.game);
    for (const kind of ['cutscene', 'active-encounter', 'terminal-failure', 'shutdown'] as const) {
      const unsafe: ReducerState = { ...before, runtime: { ...before.runtime, activity: { kind } } }; f.replace(unsafe);
      expect(f.bus.dispatch(f.bus.capture(intent('R02'))).status).toBe('unavailable'); expect(f.store.getState()).toBe(unsafe);
    }
  });
  it('does not mutate or dirty on repeated floor/anchor/self-position actions', () => {
    const f = fixture(), before = f.store.getState();
    for (const target of ['WALK-R01', 'R01.entry']) expect(f.bus.dispatch(f.bus.capture(intent(target))).status).toBe('handled');
    expect(f.store.getState().runtime.game).toBe(before.runtime.game); expect(f.store.getState().runtime.persistence).toBe(before.runtime.persistence);
    expect(f.bus.dispatch(f.bus.capture({ ...intent('R02'), verb: 'look' })).reason).toBe('unsupported-verb');
    expect(f.store.getState().runtime.game).toBe(before.runtime.game);
  });
  it('refuses incomplete/unrelated supplied hotspot controls instead of hiding scene actions', () => {
    const f = fixture(); expect(() => f.sceneObjects(f.store.getState(), [])).toThrow();
    const hotspots = f.controller.objects().filter(o => o.id.startsWith('spec001:HOTSPOT-'));
    expect(() => f.sceneObjects(f.store.getState(), [...hotspots, { ...hotspots[0]!, id: q('HOTSPOT-fake') }])).toThrow();
  });
});
