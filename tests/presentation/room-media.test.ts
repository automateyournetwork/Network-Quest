// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import layeredRoom from '../../content/spec001/presentation/R03.json';
import { resolveLayeredRoomMedia } from '../../src/presentation/layered-room';
import type { RoomComposition } from '../../src/presentation/room-media';
import authored from '../../content/spec001/presentation/R01.json';
import sourceCamera from '../../assets-src/rooms/R01-camera.json';
import sourcePlacements from '../../assets-src/rooms/R01-placements.json';
import registration from '../../assets-src/rooms/R01-registration.json';
import { validateContent } from '../../src/content/registry';
import sources from '../../content/spec001/sources.json';
import { loadIntroductionContent } from '../../src/app/content';
import { publicMediaUrl, resolveRoomMedia, roomFraming } from '../../src/presentation/room-media';
import { extractAuthoredAssetContent } from '../../tools/asset-files';
import arrival from '../../content/spec001/rooms/R01.json';
import dialogue from '../../content/spec001/dialogue/introduction.json';
import world from '../../content/spec001/world.json';

const { registry } = loadIntroductionContent();
describe('actual R01 media admission', () => {
  it('resolves every exported asset through registered authored uses, with exact approved voice text and no baked full scene', () => {
    const { composition, bindings } = resolveRoomMedia(registry), observed = extractAuthoredAssetContent(world, [arrival, dialogue]);
    const studies = observed.uses.filter(use => use.use === 'diagnostic-illustration');
    expect(studies.map(use => use.assetId).sort()).toEqual(['spec001:ASSET-ILLUSTRATION-01', 'spec001:ASSET-ILLUSTRATION-02']);
    expect(bindings.size).toBe(21);
    expect(observed.uses.filter(use => bindings.has(use.assetId))).toHaveLength(21);
    expect(observed.uses).toHaveLength(arrival.mediaBindings.length + studies.length);
    for (const binding of bindings.values()) { expect(observed.uses).toContainEqual(binding); expect(readFileSync(binding.exportPath).length).toBeGreaterThan(0); expect(publicMediaUrl(binding, '/arcade/play/network-quest/')).toBe('/arcade/play/network-quest/' + binding.exportPath.slice(7)); }
    expect(composition.models).toHaveLength(13); expect([...bindings.values()].some(b => b.exportPath === 'public/assets/models/R01.glb')).toBe(false);
    expect(composition.audio.filter(cue => cue.channel === 'voice').map(c => c.text)).toEqual([
      'The lift stops with the dignity of a machine hoping nobody heard that. Welcome to the Underworld.',
      'I am Photon. I carry light and an unreasonable amount of optimism. Shall we inspect that dark link lamp?',
    ]);
    const titleId = 'spec001:ASSET-MUSIC-title';
    expect(composition.audio.filter(cue => cue.loop).map(cue => cue.assetId)).toEqual([titleId]);
    expect(bindings.get(titleId)?.exportPath).toBe('public/assets/audio/music/title.mp3');
    expect([...bindings.values()].filter(b => b.interactiveOrEvidence).map(b => b.assetId).sort()).toEqual(['spec001:ASSET-PR002','spec001:ASSET-PR003','spec001:ASSET-PR004','spec001:ASSET-PR005','spec001:ASSET-PR006','spec001:ASSET-PR009']);
  });
  it('preserves source camera, outer translations and all ten logical anchors without double scale', () => {
    const { composition } = resolveRoomMedia(registry);
    expect(composition.camera.position).toEqual(sourceCamera.runtimePosition); expect(composition.camera.target).toEqual(sourceCamera.runtimeTarget);
    for (const placement of [...sourcePlacements.props, ...sourcePlacements.characters]) {
      expect(composition.models.find(m => m.assetId === placement.assetId)?.position).toEqual(placement.runtimePosition);
      expect(composition.models.find(m => m.assetId === placement.assetId)).not.toHaveProperty('scale');
    }
    expect(composition.anchors).toEqual(registration.anchors.filter(a => !a.semanticId.startsWith('floor-')).map(a => ({ objectId: a.semanticId, position: a.runtimeWorld })));
    expect(roomFraming(1280,720,composition.camera)).toEqual({ widthSpan:16,heightSpan:9,left:0,top:0,width:1280,height:720 });
    const narrow = roomFraming(390,230,composition.camera); expect(narrow.width/narrow.height).toBeCloseTo(16/9); expect(narrow.left + narrow.width/2).toBe(195);
  });
  it('rejects wrong authored use targets and export formats before starting an adventure', () => {
    const documents = Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(path => [path, JSON.parse(readFileSync(path, 'utf8'))]));
    for (const change of [
      (r: typeof arrival) => { r.mediaBindings[1]!.contentId = 'spec001:PR001'; },
      (r: typeof arrival) => { r.mediaBindings.find(b => b.use === 'effect')!.contentId = 'spec001:ACTION-missing'; },
      (r: typeof arrival) => { r.mediaBindings.find(b => b.use === 'voice-line')!.contentId = 'spec001:DIALOGUE-missing'; },
      (r: typeof arrival) => { r.mediaBindings[1]!.exportPath = 'public/assets/images/R01/background.png'; },
      (r: typeof arrival) => { r.mediaBindings.push(r.mediaBindings[1]!); },
    ]) {
      const changed = structuredClone(arrival); change(changed);
      expect(validateContent({ world, sources, documents: { ...documents, 'content/spec001/rooms/R01.json': changed } }).ok).toBe(false);
    }
  });
  it('rejects unbound replacements, missing anchors, duplicate geometry and fictional audio metadata', () => {
    const bad = structuredClone(authored); bad.models[1]!.assetId = 'spec001:unregistered'; expect(() => resolveRoomMedia(registry,bad)).toThrow();
    const anchor = structuredClone(authored); anchor.anchors[0]!.objectId = 'spec001:invented'; expect(() => resolveRoomMedia(registry,anchor)).toThrow();
    const audio = structuredClone(authored); audio.audio[0]!.text = 'A changed line'; expect(() => resolveRoomMedia(registry,audio)).toThrow();
    const loop = structuredClone(authored); loop.audio.find(cue => cue.channel === 'voice')!.loop = true; expect(() => resolveRoomMedia(registry,loop)).toThrow();
    expect(() => publicMediaUrl({ ...resolveRoomMedia(registry).bindings.values().next().value!, exportPath: 'public/assets/../../private.json' }, '/')).toThrow();
  });
});

it('allows explicit bounded uniform prop scale on registered compositions and preserves native character and R01 scale', () => {
  const mark = (value: number, character: boolean) => {
    const data = structuredClone(layeredRoom) as unknown as RoomComposition;
    data.models.find(model => character ? model.character : model.assetId.startsWith('spec001:ASSET-PR'))!.scale = value;
    return data;
  };
  expect(() => resolveLayeredRoomMedia(registry, mark(.72, false))).not.toThrow();
  for (const scale of [NaN, Infinity, 0, .49, 1.51]) expect(() => resolveLayeredRoomMedia(registry, mark(scale, false))).toThrow();
  expect(() => resolveLayeredRoomMedia(registry, mark(.72, true))).toThrow();
  const benchmark = structuredClone(authored) as unknown as RoomComposition;
  benchmark.models[1]!.scale = .72; expect(() => resolveRoomMedia(registry, benchmark)).toThrow();
});
