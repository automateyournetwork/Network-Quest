// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { Box3, DirectionalLight, HemisphereLight, OrthographicCamera, Scene, Vector3, WebGLRenderer } from 'three';
import type { RoomRenderRequest } from './room-adapter';
import type { RoomMedia, Triple } from './room-media';
import { createRoomParty } from './room-party';
import type { RoomResource } from './three-room';

/** Retain the sprite camera. Draw the static stonework once, then interleave optional allies with native sprite cells. */
export function createSpriteStageModels(doc: Document, element: HTMLElement, request: RoomRenderRequest<RoomResource>,
  media: { bindings: RoomMedia['bindings']; composition: { partyPositions: readonly Triple[]; models: { character: boolean; semanticId: string }[] } },
  settings: { position: Triple; target: Triple; near: number; far: number; plateSpan: readonly [number, number] },
  architecture: Extract<RoomResource, { kind: 'model' }>, gameBase: string, redraw: () => void) {
  const camera = new OrthographicCamera(-settings.plateSpan[0] / 2, settings.plateSpan[0] / 2,
    settings.plateSpan[1] / 2, -settings.plateSpan[1] / 2, settings.near, settings.far);
  camera.position.set(...settings.position);
  camera.lookAt(...settings.target);
  camera.updateMatrixWorld();
  const forward = camera.getWorldDirection(new Vector3());
  const depthAt = (point: Vector3) => point.clone().sub(camera.position).dot(forward);
  const scene = new Scene();
  scene.add(new HemisphereLight(0xbbdbed, 0x504a41, 1.35));
  for (const [position, color, intensity] of [
    [[13, 8, 9], 0xffc596, 2.0], [[-4, 7, 6], 0x9dcaff, 1.1], [[3, 7, -4], 0x7fb8ed, 1.3],
  ] as const) {
    const light = new DirectionalLight(color, intensity);
    light.position.set(position[0], position[1], position[2]);
    light.target.position.set(5, .7, 3);
    scene.add(light, light.target);
  }
  const fixed = new Set(scene.children);
  const renderer = new WebGLRenderer({ canvas: doc.createElement('canvas'), alpha: true, antialias: true });
  renderer.setSize(1024, 576, false);
  renderer.setClearColor(0, 0);
  const lost = (event: Event) => { event.preventDefault(); request.contextLost(); };
  renderer.domElement.addEventListener('webglcontextlost', lost);
  const plate = doc.createElement('canvas');
  plate.width = 1024; plate.height = 576;
  const architectureRoot = architecture.gltf.scene.clone(true);
  scene.add(architectureRoot);
  renderer.render(scene, camera);
  plate.getContext('2d')!.drawImage(renderer.domElement, 0, 0);
  scene.remove(architectureRoot);
  const party = createRoomParty(scene, media, gameBase, doc, request, element, redraw);
  return {
    plate, party,
    project(point: Vector3) {
      const uv = point.clone().project(camera);
      return { x: (uv.x + 1) * 512, y: (1 - uv.y) * 288, depth: depthAt(point) };
    },
    /** Return the current sorted drawable actors. Each ally gets a local contact fitted to its bounds. */
    layers(ctx: CanvasRenderingContext2D) {
      const actors = scene.children.filter(o => !fixed.has(o));
      return actors.map(actor => ({
        depth: depthAt(actor.position),
        draw() {
          for (const other of actors) other.visible = actor === other;
          const bounds = new Box3().setFromObject(actor);
          const size = bounds.getSize(new Vector3());
          const anchor = actor.position.clone().project(camera);
          const x = (1 + anchor.x) * 512, y = (1 - anchor.y) * 288;
          ctx.save();
          ctx.translate(x, y); ctx.scale(Math.max(10, size.x * 30), Math.max(4, size.z * 14));
          const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
          gradient.addColorStop(0, 'rgba(16,21,26,.43)'); gradient.addColorStop(1, 'rgba(16,21,26,0)');
          ctx.fillStyle = gradient; ctx.fillRect(-1, -1, 2, 2); ctx.restore();
          renderer.render(scene, camera);
          ctx.drawImage(renderer.domElement, 0, 0);
          for (const other of actors) other.visible = true;
        },
      })).sort((a, b) => b.depth - a.depth);
    },
    dispose() {
      party.dispose(); scene.clear();
      renderer.domElement.removeEventListener('webglcontextlost', lost);
      renderer.dispose(); renderer.forceContextLoss();
    },
  };
}
