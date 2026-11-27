// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { AnimationMixer, type Object3D, type Scene } from 'three';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import type { RoomRenderRequest, RoomView } from './room-adapter';
import type { RoomMedia, Triple } from './room-media';
import { createRoomResource, type RoomResource } from './three-room';
import type { ResourceLease, ResourceSpec } from './resource-pool';

/** Nonresident allies lease the same reviewed rigs as resident placements. Party data never changes here. */
export function createRoomParty(scene: Scene, media: {
  bindings: RoomMedia['bindings']; composition: { partyPositions?: readonly Triple[]; models: readonly { character: boolean; semanticId: string }[] };
}, gameBase: string, document: Document,
  request: RoomRenderRequest<RoomResource>, element: HTMLElement, redraw: () => void) {
  const placements = media.composition.partyPositions ?? [];
  const recruits = new Map([...media.bindings.values()].filter(b => b.use === 'party-placement').map(b => [b.assetId.replace(':ASSET-', ':'), b]));
  const residents = new Set(media.composition.models.filter(m => m.character).map(m => m.semanticId));
  type Member = { slot: number; lease: ResourceLease<RoomResource>; root?: Object3D; mixer?: AnimationMixer; bytes: number };
  const members = new Map<string, Member>(), specs = new Map<string, ResourceSpec<RoomResource>>();
  const report = () => {
    element.dataset['partyCast'] = [...members].filter(([, m]) => m.root).map(([id]) => id).join(' ');
    element.dataset['partyModelBytes'] = String([...members.values()].reduce((sum, m) => sum + m.bytes, 0));
  };
  function remove(id: string, m: Member) {
    members.delete(id);
    if (m.root) { m.mixer?.stopAllAction(); m.mixer?.uncacheRoot(m.root); scene.remove(m.root); }
    m.lease.release();
  }
  return {
    updateView(view: RoomView) {
      const selected = (view.activeAllyIds ?? []).slice(0, placements.length);
      for (const [id, member] of members) if (!selected.includes(id)) remove(id, member);
      for (const [slot, id] of selected.entries()) {
        const asset = recruits.get(id);
        if (residents.has(id) || !asset) continue;
        const old = members.get(id);
        if (old) { old.slot = slot; old.root?.position.set(...placements[slot]!); continue; }
        let spec = specs.get(id);
        if (!spec) {
          spec = createRoomResource(asset, gameBase, document, { bytes: 4_194_304 });
          specs.set(id, spec);
        }
        const member: Member = { slot, lease: request.resources.acquire(spec), bytes: 0 };
        members.set(id, member);
        void member.lease.ready.then(resource => {
          if (members.get(id) !== member || request.signal.aborted || resource.kind !== 'model') return;
          const root = clone(resource.gltf.scene);
          member.root = root;
          root.position.set(...placements[member.slot]!);
          scene.add(root);
          member.mixer = new AnimationMixer(root);
          const idle = resource.gltf.animations.find(clip => clip.name === 'idle');
          if (idle) member.mixer.clipAction(idle).play();
          const arrays = new Set<ArrayBufferLike>();
          root.traverse(o => { if ('geometry' in o) {
            const g = (o as import('three').Mesh).geometry;
            for (const a of Object.values(g.attributes)) arrays.add(a.array.buffer);
            if (g.index) arrays.add(g.index.array.buffer);
          } });
          member.bytes = [...arrays].reduce((sum, a) => sum + a.byteLength, 0);
          report(); redraw();
        }).catch(() => {
          if (members.get(id) !== member || request.signal.aborted) return;
          request.contextLost(); // retain complete text scene and party controls on media failure
        });
      }
      report();
    },
    animate(seconds: number) { for (const member of members.values()) member.mixer?.update(seconds); },
    dispose() { for (const [id, member] of members) remove(id, member); report(); },
  };
}
