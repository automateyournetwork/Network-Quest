// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { QualifiedId, RoomId, SafePositionId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import type { Destination } from './reducer';
import type { SafeState, WorldState } from './types';

/** Application bindings, never renderer input. Entry selection is explicit. */
export interface NavigationEntry extends Destination {}
export interface NavigationOptions {
  readonly registry: ContentRegistry;
  /** The same validated world metadata from which registry was constructed. */
  readonly world: Pick<S.world, 'rooms' | 'walkEdges'>;
  readonly entries: readonly NavigationEntry[];
}
export type NavigationResolution = {
  readonly ok: true;
  readonly kind: 'arrival' | 'position';
  readonly destination: Destination;
  readonly message: string;
} | {
  readonly ok: false;
  readonly reason: 'room-unavailable' | 'anchor-unavailable' | 'unsafe-position' | 'target-not-here' | 'exit-locked';
  readonly message: string;
};
export interface Navigation {
  readonly resolve: (world: WorldState, targetId: QualifiedId, activity: SafeState) => NavigationResolution;
  /** Both currently unlocked directed paths must exist for remote recovery. */
  readonly canReachRoom: (world: WorldState, roomId: RoomId) => boolean;
}
const MAX_ROOMS = 128, MAX_EDGES = 1024;
const safeStates = new Set<SafeState>(['stable-exploration', 'safe-preparation', 'safe-continue']);
const fail = (reason: Extract<NavigationResolution, { ok: false }>['reason'], message: string): NavigationResolution => ({ ok: false, reason, message });
const finite = (point: Readonly<S.point>) => Number.isFinite(point.x) && Number.isFinite(point.y);

/** Boundary-inclusive test on a validated authored simple polygon, bounded to 64 vertices. */
export function pointInWalkRegion(point: Readonly<S.point>, vertices: readonly Readonly<S.point>[]): boolean {
  if (!finite(point) || vertices.length < 3 || vertices.length > 64 || !vertices.every(finite)) return false;
  let area = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!, b = vertices[(i + 1) % vertices.length]!;
    area += a.x * b.y - b.x * a.y;
  }
  if (!Number.isFinite(area) || area === 0) return false;
  let inside = false;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]!, b = vertices[(i + 1) % vertices.length]!;
    const cross = (point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
    if (cross === 0 && point.x >= Math.min(a.x, b.x) && point.x <= Math.max(a.x, b.x)
      && point.y >= Math.min(a.y, b.y) && point.y <= Math.max(a.y, b.y)) return true;
    if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Pure policy: no movement, drawing, event listeners, timers or persistence. */
export function createNavigation({ registry, world: metadata, entries }: NavigationOptions): Navigation {
  if (metadata.rooms.length > MAX_ROOMS || metadata.walkEdges.length > MAX_EDGES || entries.length > MAX_ROOMS
    || new Set(metadata.rooms.map(r => r.id)).size !== metadata.rooms.length
    || new Set(entries.map(e => e.roomId)).size !== entries.length) throw new TypeError('Navigation requires bounded unique room and entry bindings.');
  const rooms = new Map(structuredClone(metadata.rooms).map(room => [room.id, room]));
  const edges = structuredClone(metadata.walkEdges);
  const entryByRoom = new Map(entries.map(entry => [entry.roomId as string, Object.freeze({ ...entry })]));
  const roomOf = (id: string): Readonly<S.room> | null => {
    const room = registry.record(id);
    return rooms.has(id) && registry.has('room', id) && room?.kind === 'room' && room.id === id ? room : null;
  };
  const anchorOf = (room: Readonly<S.room>, id: string, activity: SafeState) => {
    const metadata = registry.safePosition(id), anchor = room.safePositions.find(p => p.id === id);
    const region = anchor && room.walkRegions.find(r => r.id === anchor.walkRegionId);
    return safeStates.has(activity) && rooms.get(room.id)?.safePositionIds.includes(id) && metadata?.roomId === room.id
      && metadata.eligibleStates.includes(activity) && anchor && region && pointInWalkRegion(anchor.point, region.vertices) ? anchor : null;
  };
  const entryOf = (room: Readonly<S.room>) => {
    const entry = entryByRoom.get(room.id);
    return entry && anchorOf(room, entry.safePositionId, entry.activity) ? entry : null;
  };
  const edgeOpen = (from: string, to: string, world: WorldState): boolean => {
    const matches = edges.filter(e => (e.from === from && e.to === to) || (e.from === to && e.to === from));
    if (matches.length !== 1) return false;
    const edge = matches[0]!;
    return edge.from === from ? conditionSatisfied(edge.forwardPrerequisite, world)
      : edge.bidirectional === true && edge.returnPolicy === 'available';
  };
  const resolve: Navigation['resolve'] = (world, targetId, activity) => {
    const room = roomOf(world.roomId);
    if (!room) return fail('room-unavailable', 'This room is not available yet.');
    const current = anchorOf(room, world.position.safePositionId, activity);
    if (!current) return fail('unsafe-position', 'Movement needs a safe position on the clear floor.');
    const exit = room.exits.find(e => e.toRoomId === targetId);
    if (exit) {
      // Separate authored regions have no connecting path until one is authored.
      if (exit.walkRegionId !== current.walkRegionId || !room.walkRegions.some(r => r.id === exit.walkRegionId)) return fail('unsafe-position', 'This exit cannot be reached from the current floor region.');
      if (!edgeOpen(room.id, exit.toRoomId, world)) return fail('exit-locked', 'The requirements for this exit are not yet complete.');
      const destinationRoom = roomOf(exit.toRoomId);
      if (!destinationRoom) return fail('room-unavailable', 'This room is not available yet.');
      const entry = entryByRoom.get(destinationRoom.id);
      if (!entry) return fail('anchor-unavailable', 'A safe arrival position is not available for this room.');
      if (!entryOf(destinationRoom)) return fail('unsafe-position', 'The arrival position is not on an eligible clear floor.');
      return { ok: true, kind: 'arrival', destination: { ...entry }, message: `Arrived in ${rooms.get(destinationRoom.id)!.name}.` };
    }
    const region = room.walkRegions.find(r => r.id === targetId);
    const anchorId = region ? entryByRoom.get(room.id)?.safePositionId : targetId;
    if (region && !anchorId) return fail('anchor-unavailable', 'A safe floor position is not available here.');
    const anchor = anchorId && room.safePositions.find(p => p.id === anchorId);
    if (!region && !anchor) return fail('target-not-here', 'That target is not an available floor position or exit in this room.');
    if (!anchor || (region && anchor.walkRegionId !== region.id) || anchor.walkRegionId !== current.walkRegionId || !anchorOf(room, anchor.id, activity)) {
      return fail('unsafe-position', 'That position is not reachable on the current clear floor.');
    }
    return { ok: true, kind: 'position', destination: { roomId: room.id as RoomId, safePositionId: anchor.id as SafePositionId, activity },
      message: anchor.id === current.id ? 'You are already at this safe position.' : 'Moved to the safe floor position.' };
  };

  // Every non-start node arrives at its explicit entry. Queue and visited set are
  // bounded by authored room count; traversal never invents missing room records.
  const directedPath = (world: WorldState, target: RoomId, activity: SafeState): boolean => {
    const queue = [{ world, activity }], visited = new Set<string>([`${world.roomId}:${world.position.safePositionId}`]);
    for (let cursor = 0; cursor < queue.length && cursor <= MAX_ROOMS; cursor++) {
      const node = queue[cursor]!, room = roomOf(node.world.roomId);
      if (!room || !anchorOf(room, node.world.position.safePositionId, node.activity)) continue;
      if (room.id === target) return true;
      for (const exit of [...room.exits].sort((a, b) => a.toRoomId < b.toRoomId ? -1 : a.toRoomId > b.toRoomId ? 1 : 0)) {
        const next = resolve(node.world, exit.toRoomId as RoomId, node.activity);
        if (!next.ok) continue;
        const { destination } = next, key = `${destination.roomId}:${destination.safePositionId}`;
        if (visited.has(key)) continue;
        if (visited.size > MAX_ROOMS) return false;
        visited.add(key); queue.push({ world: { ...world, roomId: destination.roomId, position: { safePositionId: destination.safePositionId } }, activity: destination.activity });
      }
    }
    return false;
  };
  const canReachRoom: Navigation['canReachRoom'] = (world, target) => {
    const room = roomOf(world.roomId), targetRoom = roomOf(target);
    if (!room || !targetRoom) return false;
    const entry = entryOf(room), targetEntry = entryOf(targetRoom);
    const activity = registry.safePosition(world.position.safePositionId)?.eligibleStates.find(state => anchorOf(room, world.position.safePositionId, state));
    if (!activity) return false;
    if (world.roomId === target) return true;
    const current = anchorOf(room, world.position.safePositionId, activity)!;
    if (!entry || !targetEntry || anchorOf(room, entry.safePositionId, entry.activity)!.walkRegionId !== current.walkRegionId) return false;
    return directedPath(world, target, activity) && directedPath({ ...world, roomId: target,
      position: { safePositionId: targetEntry.safePositionId } }, world.roomId, targetEntry.activity);
  };
  return Object.freeze({ resolve, canReachRoom });
}
