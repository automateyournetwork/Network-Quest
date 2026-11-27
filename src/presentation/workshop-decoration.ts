// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { Vector2, Vector3, type OrthographicCamera, type Scene } from 'three';
import type { RoomView } from './room-adapter';

/** The two hanging rods are editable meshes in R02-architecture.glb.
 * Only the delivered ledger is projected, from the same reward as its accessible caption. */
export function createWorkshopDecoration(_scene: Scene, stage: HTMLElement, gameBase: string) {
  let image: HTMLImageElement | null = null;
  return {
    updateView(view: RoomView) {
      const earned = view.captions.find(c => c.id === 'decoration:spec001:SQ02')?.illustration;
      if (earned?.assetId !== 'spec001:ASSET-ILLUSTRATION-18') {
        image?.remove(); image = null; return;
      }
      if (image) return;
      image = stage.ownerDocument.createElement('img');
      image.className = 'nq-workshop-decoration';
      image.dataset['illustration'] = earned.assetId;
      image.alt = 'Earned Workshop decoration. ' + earned.alt;
      image.draggable = false;
      image.style.zIndex = '2';
      const mounted = image;
      mounted.addEventListener('error', () => { mounted.hidden = true; }, { once: true });
      image.src = gameBase + earned.exportPath.slice('public/'.length);
      stage.append(image);
    },
    layout(camera: OrthographicCamera, width: number, height: number) {
      if (!image) return;
      const project = (x: number, y: number) => {
        const p = new Vector3(x, y, -.98).project(camera);
        return new Vector2((1 + p.x) * width / 2, (1 - p.y) * height / 2);
      };
      const origin = project(6.55, 3.72), across = project(8.35, 3.72).sub(origin), down = project(6.55, 2.52).sub(origin);
      image.style.transform = `matrix(${across.x / 180},${across.y / 180},${down.x / 120},${down.y / 120},${origin.x},${origin.y})`;
    },
    dispose() { image?.remove(); image = null; },
  };
}
