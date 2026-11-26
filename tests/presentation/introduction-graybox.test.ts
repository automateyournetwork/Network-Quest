// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import layout from '../../content/spec001/presentation/introduction-graybox.json';
import r01 from '../../content/spec001/rooms/R01.json';
import r02 from '../../content/spec001/rooms/R02.json';
import { createGrayboxPointer, validateGrayboxLayouts } from '../../src/presentation/introduction-graybox';
import { createActionBus } from '../../src/ui/action-bus';

describe('introduction graybox presentation contract', () => {
  it('places each real hotspot, exit, floor and safe point exactly once without teaching or action data', () => {
    const layouts = validateGrayboxLayouts(layout);
    for (const room of [r01, r02]) {
      const drawing = layouts.rooms.find(entry => entry.roomId === room.id)!;
      const expected = [...room.hotspots.map(h => h.id), ...room.exits.map(e => `exit:${room.id}:${e.toRoomId}`),
        ...room.walkRegions.map(w => w.id), ...room.safePositions.map(p => p.id)];
      expect(drawing.objects.map(object => object.id).sort()).toEqual(expected.sort());
      expect(drawing.safePositions).toEqual(room.safePositions.map(position => ({ id: position.id, point: [position.point.x, position.point.y] })));
      expect(drawing.camera.position).not.toEqual(drawing.camera.target);
    }
    expect(Object.isFrozen(layouts.rooms[0]?.objects)).toBe(true);
  });
  it.each([
    (data: any) => { data.rooms[0].objects[0].point[0] = NaN; },
    (data: any) => { data.rooms[0].objects[0].point[0] = 11; },
    (data: any) => { data.rooms[0].objects[0].shape = 'remote-model'; },
    (data: any) => { data.rooms[0].objects.push(data.rooms[0].objects[0]); },
    (data: any) => { data.rooms[0].objects[0].action = 'award-objective'; },
    (data: any) => { data.rooms[0].camera.position = data.rooms[0].camera.target; },
    (data: any) => { data.rooms[0].safePositions[0].point = [5, 99]; },
    (data: any) => { data.rooms[0].roomId = 'spec001:R12'; },
  ])('rejects malformed or authority-bearing placement data before preparing a scene', mutate => {
    const data = structuredClone(layout); mutate(data); expect(() => validateGrayboxLayouts(data)).toThrow();
  });
  it('captures once on pointerdown, preserves exact deferred intent for duplicate click callbacks and cancels drag/cancel/dispose', () => {
    const dispatch = vi.fn(() => ({ status: 'handled' as const })), cancel = vi.fn();
    const capture = vi.fn(() => ({ dispatch, cancel }));
    const pointer = createGrayboxPointer(capture);
    pointer.click(1); pointer.click(); expect(capture).not.toHaveBeenCalled();
    pointer.down(1, 0, 0, 'original'); pointer.click(1); pointer.click(1);
    expect(capture).toHaveBeenCalledExactlyOnceWith('original'); expect(dispatch).toHaveBeenCalledTimes(2);
    pointer.down(2, 0, 0, 'next'); pointer.move(2, 20, 0); pointer.click(2);
    expect(dispatch).toHaveBeenCalledTimes(2);
    pointer.down(3, 0, 0, 'cancel'); pointer.cancel(); pointer.click(3); expect(dispatch).toHaveBeenCalledTimes(2);
    pointer.down(4, 0, 0, 'dispose'); pointer.dispose(); pointer.click(4); pointer.down(5, 0, 0, 'late');
    expect(capture).toHaveBeenCalledTimes(4); expect(cancel).toHaveBeenCalledTimes(4);
  });
  it('cannot turn an old visual press into a new adventure action or duplicate a reducer call', () => {
    const bus = createActionBus({ getContext: () => null }), handler = vi.fn(() => ({ status: 'handled' as const }));
    bus.register('select-verb', handler);
    const scope = bus.captureScope(null);
    const pointer = createGrayboxPointer(() => { const captured = scope({ kind: 'select-verb', verb: 'look' });
      return { dispatch: () => bus.dispatch(captured), cancel: () => bus.cancel(captured) }; });
    pointer.down(1, 0, 0, 'look'); pointer.click(1); pointer.click(1); expect(handler).toHaveBeenCalledTimes(1);
    pointer.down(2, 0, 0, 'look'); bus.invalidate(); expect(pointer.click(2)).toMatchObject({ status: 'rejected' });
    expect(handler).toHaveBeenCalledTimes(1); pointer.dispose(); bus.dispose();
  });
});
