// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import layout from '../../content/spec001/presentation/first-route-graybox.json';
import r03 from '../../content/spec001/rooms/R03.json';
import r04 from '../../content/spec001/rooms/R04.json';
import r05 from '../../content/spec001/rooms/R05.json';
import r06 from '../../content/spec001/rooms/R06.json';
import r07 from '../../content/spec001/rooms/R07.json';
import r08 from '../../content/spec001/rooms/R08.json';
import r09 from '../../content/spec001/rooms/R09.json';
import r10 from '../../content/spec001/rooms/R10.json';
import r11 from '../../content/spec001/rooms/R11.json';
import r12 from '../../content/spec001/rooms/R12.json';
import { validateGrayboxLayouts } from '../../src/presentation/introduction-graybox';

const roomIds = ['spec001:R03', 'spec001:R04', 'spec001:R05', 'spec001:R06', 'spec001:R07', 'spec001:R08', 'spec001:R09', 'spec001:R10', 'spec001:R11', 'spec001:R12'];
describe('T078 scoped temporary route presentation', () => {
  it('requires explicitly selected rooms and places every real interaction exactly once', () => {
    expect(() => validateGrayboxLayouts(layout)).toThrow();
    const valid = validateGrayboxLayouts(layout, roomIds);
    for (const room of [r03, r04, r05, r06, r07, r08, r09, r10, r11, r12]) {
      const drawing = valid.rooms.find(candidate => candidate.roomId === room.id)!;
      expect(drawing.objects.map(object => object.id).sort()).toEqual([
        ...room.hotspots.map(h => h.id), ...room.exits.map(e => `exit:${room.id}:${e.toRoomId}`),
        ...room.walkRegions.map(w => w.id), ...room.safePositions.map(p => p.id),
      ].sort());
      expect(drawing.safePositions).toEqual(room.safePositions.map(p => ({ id: p.id, point: [p.point.x, p.point.y] })));
    }
  });
  it('rejects duplicate, missing, foreign and authority-bearing layouts without mutating input', () => {
    for (const expected of [[], [...roomIds, roomIds[0]!], roomIds.slice(1), [...roomIds.slice(0, 3), 'spec002:R01']]) {
      expect(() => validateGrayboxLayouts(layout, expected)).toThrow();
    }
    const copy = structuredClone(layout);
    (copy.rooms[0]!.objects[0] as object as Record<string, unknown>)['completion'] = 'O03';
    expect(() => validateGrayboxLayouts(copy, roomIds)).toThrow();
    const validated = validateGrayboxLayouts(layout, roomIds);
    expect(Object.isFrozen(validated.rooms[0]?.objects)).toBe(true);
    expect(layout.rooms[0]!.objects[0]).not.toHaveProperty('completion');
  });
});
