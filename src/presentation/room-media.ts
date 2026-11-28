// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import authored from '../../content/spec001/presentation/R01.json';
import type { ContentRegistry } from '../content/registry';
import type { mediaBinding } from '../content/schema-types.generated';

export type Triple = readonly [number, number, number];
export interface RoomComposition {
  version: 1; roomId: string; safePositionId: string;
  walkStops?: readonly string[];
  partyPositions?: readonly Triple[];
  camera: { position: Triple; target: Triple; near: number; far: number; span: number; minimumHeightSpan: number; plateSpan: readonly [number, number] };
  models: readonly { assetId: string; semanticId: string; position: Triple; objectId: string | null; character: boolean; rotation?: Triple; scale?: number; supportHeight?: number }[];
  layers: readonly { assetId: string; plane: 'background' | 'midground' | 'foreground' }[];
  anchors: readonly { objectId: string; position: Triple }[];
  audio: readonly { assetId: string; channel: 'music' | 'effects' | 'voice'; text: string; trigger: 'arrival' | 'photon' | 'title' | 'control'; loop: boolean }[];
}
export interface RoomMedia { readonly composition: RoomComposition; readonly bindings: ReadonlyMap<string, Readonly<mediaBinding>> }

/** Bind only exact registered authored use records; a manifest or roster is never a runtime URL resolver. */
export function resolveRoomMedia(registry: ContentRegistry, value: unknown = authored): RoomMedia {
  const data = structuredClone(value) as RoomComposition;
  const fail = (): never => { throw new TypeError('Invalid registered room media composition'); };
  const tuple = (v: unknown, count: number) => Array.isArray(v) && v.length === count && v.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= 100);
  if (!data || data.version !== 1 || data.roomId !== 'spec001:R01' || data.safePositionId !== 'spec001:R01.entry'
    || !data.camera || !tuple(data.camera.position, 3) || !tuple(data.camera.target, 3) || !tuple(data.camera.plateSpan, 2)
    || data.camera.near !== 0.1 || data.camera.far !== 80 || data.camera.span !== 13 || data.camera.minimumHeightSpan !== 9
    || !Array.isArray(data.models) || data.models.length !== 13 || !Array.isArray(data.layers) || data.layers.length !== 3
    || !Array.isArray(data.anchors) || data.anchors.length !== 10 || !Array.isArray(data.audio) || data.audio.length !== 5) fail();
  const room = registry.record(data.roomId);
  if (room?.kind !== 'room' || !room.mediaBindings) return fail();
  const ids = [...data.models, ...data.layers, ...data.audio].map(item => item.assetId);
  const baseIds = new Set(ids);
  const bindings = new Map(room.mediaBindings.filter(b => baseIds.has(b.assetId)).map(binding => [binding.assetId, Object.freeze({ ...binding })]));
  if (room.mediaBindings.some(b => !baseIds.has(b.assetId) && !['party-placement', 'ambience', 'music', 'effect', 'voice-line'].includes(b.use))) fail();
  if (new Set(ids).size !== ids.length || bindings.size !== ids.length || ids.some(id => !bindings.has(id))) fail();
  const binding = (id: string, use: string, suffix: string) => { const b = bindings.get(id); if (!b || b.use !== use || !b.exportPath.endsWith(suffix)) return fail(); return b; };
  for (const model of data.models) {
    if (model.scale !== undefined || !tuple(model.position, 3) || typeof model.character !== 'boolean' || (model.objectId !== null && !data.anchors.some(a => a.objectId === model.objectId))) fail();
    const b = bindings.get(model.assetId)!;
    binding(model.assetId, model.character ? 'character-placement' : model.assetId === 'spec001:ASSET-ARCH-R01' ? 'room-architecture' : 'prop-placement', '.glb');
    if (b.contentId !== data.roomId || b.exportPath.endsWith('/R01.glb')) fail(); // comparison scene would duplicate all ten props
    if (model.character && !room.characterIds.includes(model.semanticId)) fail();
    if (b.use === 'prop-placement' && !room.propInstances.some(p => p.propId === model.semanticId && p.assetId === b.assetId)) fail();
  }
  if (data.layers.map(layer => layer.plane).join() !== 'background,midground,foreground') fail();
  for (const layer of data.layers) if (binding(layer.assetId, layer.plane, `/${layer.plane}.png`).contentId !== data.roomId) fail();
  const objects = [...room.hotspots.map(h => h.id), ...room.walkRegions.map(w => w.id), ...room.safePositions.map(p => p.id), ...room.exits.map(e => `exit:${room.id}:${e.toRoomId}`)];
  if (new Set(data.anchors.map(a => a.objectId)).size !== objects.length || data.anchors.some(a => !objects.includes(a.objectId) || !tuple(a.position, 3))) fail();
  for (const cue of data.audio) {
    const b = bindings.get(cue.assetId)!;
    if (typeof cue.loop !== 'boolean' || (cue.loop && (cue.trigger !== 'title' || cue.channel !== 'music')) || !cue.text?.trim() || !['voice', 'music', 'effects'].includes(cue.channel) || !['arrival', 'photon', 'title', 'control'].includes(cue.trigger)) fail();
    binding(cue.assetId, cue.channel === 'voice' ? 'voice-line' : cue.channel === 'music' ? 'music' : 'effect', '.mp3');
    if (cue.channel === 'effects' && b.contentId !== (cue.trigger === 'control' ? 'spec001:ACTION-observe-power' : 'spec001:ACTION-talk-photon')) fail();
    if (cue.channel === 'music' && b.contentId !== 'spec001:TITLE') fail();
    if (cue.channel === 'voice') {
      const record = registry.record(cue.trigger === 'arrival' ? 'spec001:DIALOGUE-media-001' : 'spec001:DIALOGUE-media-035');
      if (record?.kind !== 'dialogue' || !record.nodes.some(n => n.id === b.contentId && n.text === cue.text)) fail();
    }
  }
  return Object.freeze({ composition: data, bindings });
}
export function publicMediaUrl(binding: Readonly<mediaBinding>, gameBase: string): string {
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(gameBase) || !/^public\/assets\/[A-Za-z0-9_./-]+$/.test(binding.exportPath) || binding.exportPath.split('/').includes('..')) throw new TypeError('Invalid public media path');
  return `${gameBase}${binding.exportPath.slice('public/'.length)}`;
}
/** Same camera-normalized 16×9 image plane at every viewport, never object-fit cover. */
export function roomFraming(width: number, height: number, camera: RoomComposition['camera']) {
  if (!(width > 0) || !(height > 0)) throw new RangeError('Invalid room viewport');
  const heightSpan = Math.max(camera.minimumHeightSpan, camera.span / (width / height)), widthSpan = heightSpan * width / height;
  const plateWidth = width * camera.plateSpan[0] / widthSpan, plateHeight = height * camera.plateSpan[1] / heightSpan;
  return { widthSpan, heightSpan, left: (width - plateWidth) / 2, top: (height - plateHeight) / 2, width: plateWidth, height: plateHeight };
}
