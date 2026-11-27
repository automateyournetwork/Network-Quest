// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { type RoomComposition, type RoomMedia, roomFraming } from './room-media';
import { createThreeRoom, type RoomResource, type RoomDecorationFactory } from './three-room';
import type { RoomRenderRequest } from './room-adapter';

/** Fit the entire registered plate into the 286 display, including tall/narrow stages. */
export function registeredRoomFraming(width: number, height: number, camera: RoomComposition['camera']) {
  return roomFraming(width, height, { ...camera, span: camera.plateSpan[0], minimumHeightSpan: camera.plateSpan[1] });
}

/** Admit only authored local instances and real semantic targets before acquiring media. */
export function resolveLayeredRoomMedia(registry: ContentRegistry, data: RoomComposition): RoomMedia {
  const fail = (): never => { throw new Error('Invalid registered layered room composition'); };
  const triple = (v: readonly number[]) => Array.isArray(v) && v.length === 3 && v.every(n => Number.isFinite(n) && Math.abs(n) <= 100);
  const room = registry.record(data.roomId);
  if (room?.kind !== 'room' || !['hybrid','realtime-3d'].includes(room.presentationMode) || !room.mediaBindings || data.version !== 1 ||
    !room.safePositions.some(p => p.id === data.safePositionId) || data.audio.length ||
    !triple(data.camera.position) || !triple(data.camera.target) || data.camera.near <= 0 || data.camera.far <= data.camera.near ||
    !(data.camera.span > 0 && data.camera.minimumHeightSpan > 0) ||
    data.camera.plateSpan.length !== 2 || !data.camera.plateSpan.every(n => Number.isFinite(n) && n > 0 && n <= 100) ||
    Math.abs(data.camera.plateSpan[0] / data.camera.plateSpan[1] - 16 / 9) > .00001) return fail();
  const bindings = new Map(room.mediaBindings.map(b => [b.assetId, b]));
  const ids = [...data.models, ...data.layers].map(m => m.assetId);
  const visualUses = ['room-architecture', 'character-placement', 'prop-placement', 'background', 'midground', 'foreground'];
  if (new Set(ids).size !== ids.length || room.mediaBindings.filter(b => visualUses.includes(b.use)).length !== ids.length) fail();
  if (data.layers.map(layer => layer.plane).join() !== 'background,midground,foreground') fail();
  for (const layer of data.layers) {
    const b = bindings.get(layer.assetId);
    if (b?.use !== layer.plane || b.contentId !== room.id) fail();
  }
  const subjects = new Map(room.hotspots.map(h => [h.id, h.subjectId]));
  const objectIds = [...subjects.keys(), ...room.walkRegions.map(w => w.id), ...room.safePositions.map(p => p.id), ...room.exits.map(e => `exit:${room.id}:${e.toRoomId}`)];
  if (data.anchors.length !== objectIds.length || new Set(data.anchors.map(a => a.objectId)).size !== objectIds.length ||
    data.anchors.some(a => !objectIds.includes(a.objectId) || !triple(a.position))) fail();
  if (data.models.filter(m => m.character && m.semanticId === 'spec001:CH01').length !== 1) fail();
  for (const model of data.models) {
    const binding = bindings.get(model.assetId);
    if (binding?.use === 'room-architecture') {
      if (binding.contentId !== room.id || model.character || model.objectId !== null || model.scale !== undefined || model.semanticId !== room.id ||
        model.assetId !== room.id.replace(':', ':ASSET-ARCH-') || !triple(model.position)) fail();
      continue;
    }
    if (binding?.contentId !== room.id || binding.use !== (model.character ? 'character-placement' : 'prop-placement') ||
      model.assetId !== model.semanticId.replace(':', ':ASSET-') || !triple(model.position) ||
      (model.rotation && !triple(model.rotation)) ||
      (model.scale !== undefined && (model.character || !Number.isFinite(model.scale) || model.scale < .5 || model.scale > 1.5)) || (model.supportHeight !== undefined && !(model.supportHeight > 0 && model.supportHeight === model.position[1])) ||
      (model.objectId !== null && subjects.get(model.objectId) !== model.semanticId)) fail();
    if (model.character ? model.semanticId !== 'spec001:CH01' && !room.characterIds.includes(model.semanticId)
      : !room.propInstances.some(p => p.assetId === model.assetId && p.propId === model.semanticId)) fail();
  }
  return { composition: data, bindings };
}

export function createLayeredRoom(host: HTMLElement, media: RoomMedia, gameBase: string, mode: 'three' | 'layered', decorate?: RoomDecorationFactory) {
  return createThreeRoom(host, media, gameBase, { framing: registeredRoomFraming, mode, ...(decorate ? { decorate } : {}) });
}

const compositions = import.meta.glob<RoomComposition>(['../../content/spec001/presentation/R??.json', '!../../content/spec001/presentation/R01.json', '!../../content/spec001/presentation/R04.json'], { import: 'default' });
const compositionPath = (roomId: string) => `../../content/spec001/presentation/${roomId.split(':')[1]}.json`;

/** Each new hybrid room contributes one authored file and its room-local media bindings. */
export function createRegisteredLayeredRooms(host: HTMLElement, registry: ContentRegistry, gameBase: string, decorations: Readonly<Record<string, RoomDecorationFactory>> = {}) {
  let active: ReturnType<typeof createLayeredRoom> | undefined;
  const supports = (id: string) => {
    const room = registry.record(id);
    return room?.kind === 'room' && ['hybrid', 'realtime-3d'].includes(room.presentationMode) && room.mediaBindings?.some(b => b.use === 'background') &&
      Boolean(compositions[compositionPath(id)]);
  };
  return {
    supports,
    reuseView: true,
    async prepare(request: RoomRenderRequest<RoomResource>) {
      const id = request.view.roomId, load = compositions[compositionPath(id)];
      if (!supports(id) || !load) throw new Error('No registered layered composition for this room');
      const composition = await load();
      if (request.signal.aborted || composition.roomId !== id) throw new Error('Room composition canceled or mismatched');
      active?.dispose();
      const room = registry.record(id);
      active = createLayeredRoom(host, resolveLayeredRoomMedia(registry, composition), gameBase,
        room?.kind === 'room' && room.presentationMode === 'realtime-3d' ? 'three' : 'layered', decorations[id]);
      return active.prepare(request);
    },
    playAbility(assetId: string) { active?.playAbility(assetId); },
    react(kind: 'walk' | 'reaction', target?: string) { active?.react(kind, target); },
    dispose() { active?.dispose(); active = undefined; },
  };
}
