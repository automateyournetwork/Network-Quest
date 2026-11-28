// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { Vector3 } from 'three';
import type { Triple } from './room-media';

/** Visual floor movement between registered stops. The navigation controller owns the logical safe position. */
export function createRoomWalk(start: Triple, stops: ReadonlyMap<string, Triple>) {
  const position = new Vector3(...start), from = position.clone(), to = position.clone();
  let time = 1;
  return {
    position,
    get moving() { return time < 1; },
    begin(target: string | undefined, snap: boolean) {
      const point = target && stops.get(target);
      if (!point) return;
      from.copy(position); to.set(point[0], 0, point[2]);
      time = snap || from.equals(to) ? 1 : 0;
      if (snap) position.copy(to);
    },
    advance(seconds: number) {
      time = Math.min(1, time + seconds / .8);
      position.lerpVectors(from, to, time * time * (3 - 2 * time));
    },
  };
}
