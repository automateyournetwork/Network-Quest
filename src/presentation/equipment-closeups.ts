// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import * as THREE from 'three';

const benches: Record<string, Record<string, readonly string[]>> = {
  'spec001:R09': {
    'market-sfp': ['PR082'], 'market-qsfp': ['PR083'],
    'market-injector': ['PR084', 'PR140', 'PR142'], 'market-endpoints': ['PR085'],
    'market-telephone': ['PR087'], 'market-counter': ['PR090', 'PR141', 'PR145'],
  },
  'spec001:R10': {
    'clockworks-wheel': ['PR091'], 'clockworks-samples': ['PR096'], 'clockworks-console': ['PR094'],
  },
};

/** Read an isolated view from the already-resident meshes without moving the room camera.
 * Each fixture and the tools mounted on it retain the exact room transforms. */
function drawInspection(renderer: THREE.WebGLRenderer, members: readonly THREE.Object3D[], canvas: HTMLCanvasElement) {
  const scene = new THREE.Scene();
  const fixtures = new THREE.Group();
  for (const model of members) fixtures.add(model.clone(true));
  scene.add(fixtures);
  const box = new THREE.Box3().setFromObject(fixtures);
  const center = box.getCenter(new THREE.Vector3());
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .01, 100);
  camera.position.copy(center).add(new THREE.Vector3(.33, .50, 1).normalize().multiplyScalar(8));
  camera.lookAt(center);
  camera.updateMatrixWorld();
  const corners = new THREE.Box3();
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    corners.expandByPoint(new THREE.Vector3(x, y, z).applyMatrix4(camera.matrixWorldInverse));
  }
  const aspect = canvas.width / canvas.height;
  const radius = Math.max(corners.max.y, -corners.min.y, corners.max.x / aspect, -corners.min.x / aspect) * 1.05;
  camera.top = radius; camera.bottom = -radius; camera.left = -radius * aspect; camera.right = radius * aspect;
  camera.updateProjectionMatrix();
  scene.background = new THREE.Color(0x20313a);
  scene.add(new THREE.HemisphereLight(0xfff3dc, 0xa4afb9, 2));
  const key = new THREE.DirectionalLight(0xffedc9, 2.4);
  key.position.set(2, 5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xbcdfff, 1.3);
  fill.position.set(-3, 2, 1); scene.add(fill);
  const target = new THREE.WebGLRenderTarget(canvas.width, canvas.height, { colorSpace: THREE.SRGBColorSpace });
  const previous = renderer.getRenderTarget();
  try {
    renderer.setRenderTarget(target); renderer.clear(); renderer.render(scene, camera);
    const rgba = new Uint8Array(canvas.width * canvas.height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, canvas.width, canvas.height, rgba);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Inspection canvas unavailable');
    const image = context.createImageData(canvas.width, canvas.height);
    const stride = canvas.width * 4;
    for (let row = 0; row < canvas.height; row++) {
      const offset = (canvas.height - row - 1) * stride;
      image.data.set(rgba.subarray(offset, offset + stride), row * stride);
    }
    context.putImageData(image, 0, 0);
  } finally {
    renderer.setRenderTarget(previous); target.dispose(); scene.clear();
  }
}

export function mountEquipmentInspections(roomId: string, host: HTMLElement, renderer: THREE.WebGLRenderer,
  getModel: (id: string) => THREE.Object3D | undefined) {
  const frame = host.closest('.nq-game'), mounted: HTMLDetailsElement[] = [];
  let panel: HTMLElement | null = null;
  for (const [bench, ids] of Object.entries(benches[roomId] ?? {})) {
    const row = frame?.querySelector<HTMLElement>('[data-scene-object="spec001:HOTSPOT-' + bench + '"]');
    const models = ids.map(id => getModel('spec001:' + id));
    if (!row || models.some(m => !m)) continue;
    const title = row.querySelector('h3')!.textContent;
    const details = host.ownerDocument.createElement('details');
    const summary = host.ownerDocument.createElement('summary');
    summary.textContent = 'Inspect ' + title + ' up close';
    details.append(summary);
    details.addEventListener('toggle', () => {
      if (!details.open) { details.querySelector('canvas, p')?.remove(); return; }
      if (details.childElementCount > 1 || !details.isConnected) return;
      const canvas = host.ownerDocument.createElement('canvas');
      canvas.width = 648; canvas.height = 360;
      canvas.style.maxWidth = '100%'; canvas.style.height = 'auto'; canvas.style.display = 'block';
      canvas.setAttribute('role','img'); canvas.setAttribute('aria-label', title + ' viewed with its mounted equipment.');
      try {
        drawInspection(renderer, models as THREE.Object3D[], canvas);
        details.append(canvas);
      } catch {
        const fallback = host.ownerDocument.createElement('p');
        fallback.textContent = 'The close-up is unavailable. The equipment description above contains the inspection details.';
        details.append(fallback);
      }
    });
    row.append(details); mounted.push(details); panel = row.closest('.nq-frame-window');
  }
  const panelChanges = panel && new MutationObserver(() => {
    if (panel?.hidden) for (const detail of mounted) detail.open = false;
  });
  if (panel) panelChanges?.observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  return () => { panelChanges?.disconnect(); for (const detail of mounted) detail.remove(); };
}
