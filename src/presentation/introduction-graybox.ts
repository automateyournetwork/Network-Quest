// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import * as THREE from 'three';
import authored from '../../content/spec001/presentation/introduction-graybox.json';
import type { ActionResult } from '../ui/action-bus';
import type { SceneObjectView, SemanticControl } from '../ui/app-shell';
import type { DeferredIntent, RoomRenderer, RoomView } from './room-adapter';
import type { ResourceSpec } from './resource-pool';

type Pair = readonly [number, number];
type Triple = readonly [number, number, number];
const shapes = ['panel', 'conduit', 'character', 'satchel', 'capsule', 'board', 'door', 'floor', 'safe', 'bench'] as const;
interface Placement { readonly id: string; readonly point: Pair; readonly shape: typeof shapes[number]; readonly scale: Triple; readonly color: string }
interface Layout { readonly roomId: string; readonly camera: { readonly position: Triple; readonly target: Triple; readonly span: number };
  readonly safePositions: readonly { readonly id: string; readonly point: Pair }[]; readonly objects: readonly Placement[] }
interface Layouts { readonly version: 1; readonly rooms: readonly Layout[] }
export interface IntroductionGrayboxView extends RoomView { readonly safePositionId: string }

/** Strict presentation-only data: no URLs, teaching values, action payloads or reward authority. */
export function validateGrayboxLayouts(value: unknown, expectedRoomIds: readonly string[] = ['spec001:R01', 'spec001:R02']): Layouts {
  const fail = (): never => { throw new TypeError('Invalid introduction graybox layout'); };
  const record = (v: unknown, keys: readonly string[]): Record<string, unknown> => {
    if (!v || typeof v !== 'object' || Array.isArray(v) || Object.keys(v).sort().join() !== [...keys].sort().join()) return fail();
    return v as Record<string, unknown>;
  };
  const tuple = (v: unknown, length: number, low: number, high: number): number[] => {
    if (!Array.isArray(v) || v.length !== length || v.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < low || n > high)) return fail();
    return v;
  };
  const point = (v: unknown) => { const p = tuple(v, 2, 0, 10); if (p[1]! > 6) fail(); return Object.freeze([...p]) as unknown as Pair; };
  const triple = (v: unknown, low = -30, high = 30) => Object.freeze([...tuple(v, 3, low, high)]) as unknown as Triple;
  const id = (v: unknown) => typeof v === 'string' && /^(?:exit:)?spec001:[A-Za-z0-9:.-]+$/.test(v) ? v : fail();
  const root = record(value, ['version', 'rooms']);
  if (!Array.isArray(expectedRoomIds) || expectedRoomIds.length < 1 || expectedRoomIds.length > 12
    || new Set(expectedRoomIds).size !== expectedRoomIds.length || expectedRoomIds.some(id => !/^spec001:R(?:0[1-9]|1[0-2])$/.test(id))) return fail();
  if (root['version'] !== 1 || !Array.isArray(root['rooms']) || root['rooms'].length !== expectedRoomIds.length) return fail();
  const rooms = root['rooms'].map(v => {
    const room = record(v, ['roomId', 'camera', 'safePositions', 'objects']);
    if (!expectedRoomIds.includes(String(room['roomId']))) return fail();
    const camera = record(room['camera'], ['position', 'target', 'span']);
    const position = triple(camera['position']), target = triple(camera['target']), span = camera['span'];
    if (position.every((n, i) => n === target[i]) || typeof span !== 'number' || !Number.isFinite(span) || span < 10 || span > 20) return fail();
    if (!Array.isArray(room['objects']) || room['objects'].length < 1 || room['objects'].length > 24 || !Array.isArray(room['safePositions'])) return fail();
    const objects = room['objects'].map(v => {
      const p = record(v, ['id', 'point', 'shape', 'scale', 'color']);
      if (!shapes.includes(p['shape'] as Placement['shape']) || typeof p['color'] !== 'string' || !/^#[0-9a-f]{6}$/i.test(p['color'])) return fail();
      return Object.freeze({ id: id(p['id']), point: point(p['point']), shape: p['shape'] as Placement['shape'], scale: triple(p['scale'], 0.01, 3), color: p['color'] });
    });
    const safePositions = room['safePositions'].map(v => { const p = record(v, ['id', 'point']); return Object.freeze({ id: id(p['id']), point: point(p['point']) }); });
    if (new Set(objects.map(p => p.id)).size !== objects.length || safePositions.length !== 1 || safePositions.some(p => !objects.some(o => o.id === p.id && o.shape === 'safe' && o.point.every((n, i) => n === p.point[i])))) return fail();
    return Object.freeze({ roomId: id(room['roomId']), camera: Object.freeze({ position, target, span }), objects: Object.freeze(objects), safePositions: Object.freeze(safePositions) });
  });
  if (new Set(rooms.map(room => room.roomId)).size !== expectedRoomIds.length) return fail();
  return Object.freeze({ version: 1, rooms: Object.freeze(rooms) });
}

/** Native pointer click is the only commit. Delays cannot recapture against a newer projection. */
export function createGrayboxPointer(capture: (id: string) => DeferredIntent) {
  let pending: { id: number; x: number; y: number; intent: DeferredIntent } | null = null, disposed = false;
  const cancel = () => { pending?.intent.cancel(); pending = null; };
  return {
    down(id: number, x: number, y: number, controlId: string) { cancel(); if (!disposed) pending = { id, x, y, intent: capture(controlId) }; },
    move(id: number, x: number, y: number) { if (pending?.id === id && Math.hypot(x - pending.x, y - pending.y) > 8) cancel(); },
    click(id?: number): ActionResult | undefined { return !disposed && pending && (id === undefined || pending.id === id) ? pending.intent.dispatch() : undefined; },
    cancel, dispose() { disposed = true; cancel(); },
  };
}

export interface GrayboxGeometry { readonly box: THREE.BoxGeometry; readonly cylinder: THREE.CylinderGeometry }

/** Original DEV geometry only. Zero finished Blender/media assets; no external loads or animation. */
export function createIntroductionGraybox(host: HTMLElement, source?: { readonly data: unknown; readonly roomIds: readonly string[] }): RoomRenderer<GrayboxGeometry> & { dispose(): void } {
  const layouts = validateGrayboxLayouts(source?.data ?? authored, source?.roomIds), document = host.ownerDocument, window = document.defaultView!;
  let webgl: THREE.WebGLRenderer | null = null, disposed = false, selectedId: string | null = null;
  let latestFeedback: HTMLElement | null = null, feedbackMessage = '';
  const geometry: ResourceSpec<GrayboxGeometry> = { key: 'introduction-graybox-primitives-v1', bytes: 16_384,
    load: async () => { const box = new THREE.BoxGeometry(), cylinder = new THREE.CylinderGeometry(0.5, 0.5, 1, 12);
      const bytes = [box, cylinder].reduce((sum, g) => sum + Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0) + (g.index?.array.byteLength ?? 0), 0);
      return { value: { box, cylinder }, bytes }; }, dispose: value => { value.box.dispose(); value.cylinder.dispose(); } };
  const destroyRenderer = () => { const old = webgl; webgl = null; if (old) { old.dispose(); old.forceContextLoss(); old.domElement.remove(); } };
  return {
    async prepare(request) {
      if (disposed) throw new Error('Graybox disposed');
      feedbackMessage = '';
      const layout = layouts.rooms.find(room => room.roomId === request.view.roomId);
      const positionId = (request.view as IntroductionGrayboxView).safePositionId;
      const safe = layout?.safePositions.find(p => p.id === positionId);
      const objectMap = new Map(request.view.objects.map(object => [object.id, object]));
      if (!layout || !safe || layout.objects.length !== objectMap.size || layout.objects.some(object => !objectMap.has(object.id))) throw new Error('Graybox projection and current room disagree');
      const primitives = await request.resources.acquire(geometry).ready;
      if (request.signal.aborted || disposed) throw new Error('Graybox preparation canceled');
      if (!webgl) {
        webgl = new THREE.WebGLRenderer({ antialias: true, alpha: false });
        webgl.setClearColor('#172332'); webgl.outputColorSpace = THREE.SRGBColorSpace;
      }
      const renderer = webgl, canvas = renderer.domElement;
      const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera();
      camera.position.set(...layout.camera.position); camera.lookAt(...layout.camera.target); camera.near = 0.1; camera.far = 80;
      scene.add(new THREE.HemisphereLight(0xd8edf2, 0x424953, 2));
      const light = new THREE.DirectionalLight(0xffe8c3, 2.4); light.position.set(2, 10, 6); scene.add(light);
      const materials: THREE.MeshStandardMaterial[] = [], pickable: THREE.Mesh[] = [];
      const material = (color: string) => { const value = new THREE.MeshStandardMaterial({ color, roughness: 1 }); materials.push(value); return value; };
      const block = (position: Triple, scale: Triple, surface: THREE.Material, cylinder = false, objectId?: string) => {
        const mesh = new THREE.Mesh(cylinder ? primitives.cylinder : primitives.box, surface);
        mesh.position.set(...position); mesh.scale.set(...scale); scene.add(mesh);
        if (objectId) { mesh.userData['objectId'] = objectId; pickable.push(mesh); } return mesh;
      };
      block([5, -0.18, 3], [10.4, 0.3, 6.4], material('#505f68'));
      const structure = material('#6d7981');
      block([5, 0.7, -0.25], [10.4, 1.7, 0.25], structure);
      if (layout.roomId === 'spec001:R01') {
        for (const x of [0, 10]) block([x, 1.65, 0], [0.3, 3.5, 0.3], structure);
        block([5, 3.25, 0], [10, 0.3, 0.3], structure);
        for (const x of [0.3, 9.7]) block([x, 0.15, 3], [0.15, 0.2, 5.8], structure);
      } else {
        block([0.2, 1, 0.3], [0.7, 2, 0.8], structure);
        block([0.2, 2.4, 0.3], [0.4, 1, 0.4], structure);
      }
      const anchors = new Map<string, THREE.Vector3>();
      for (const placement of layout.objects) {
        const [x, z] = placement.point, [w, h, d] = placement.scale, surface = material(placement.color), id = placement.id;
        if (placement.shape === 'character') {
          block([x, h * 0.45, z], [w, h * 0.65, d], surface, false, id);
          block([x, h * 0.9, z], [w * 0.65, h * 0.23, d * 0.8], surface, true, id);
          for (const side of [-1, 1]) block([x + side * w * 0.25, h * 0.08, z], [w * 0.3, h * 0.16, d], surface, false, id);
        } else if (placement.shape === 'door') {
          for (const side of [-1, 1]) block([x + side * w * 0.4, h * 0.5, z], [w * 0.2, h, d], surface, false, id);
          block([x, h, z], [w, 0.18, d], surface, false, id);
        } else if (placement.shape === 'bench') {
          block([x, h, z], [w, 0.15, d], surface, false, id);
          for (const side of [-1, 1]) block([x + side * w * 0.35, h * 0.5, z], [w * 0.12, h, d * 0.8], surface, false, id);
          block([x, h + 0.18, z], [w * 0.55, 0.25, d * 0.5], surface, false, id);
        } else {
          block([x, h * 0.5, z], [w, h, d], surface, ['capsule', 'safe'].includes(placement.shape), id);
          if (placement.shape === 'panel') block([x, h * 0.65, z + d * 0.55], [w * 0.5, h * 0.25, 0.08], structure, false, id);
        }
        anchors.set(id, new THREE.Vector3(x, h + 0.2, z));
      }
      const marker = material('#f5d78c');
      block([safe.point[0], 0.38, safe.point[1]], [0.28, 0.7, 0.28], marker, true);
      block([safe.point[0], 0.86, safe.point[1]], [0.32, 0.3, 0.32], marker, true);
      const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => { const element = document.createElement(tag); if (className) element.className = className; return element; };
      const root = node('div', 'nq-graybox'), stage = node('div', 'nq-graybox-stage'), pins = node('div', 'nq-graybox-pins');
      root.dataset['roomId'] = layout.roomId; root.dataset['detail'] = request.settings.detail;
      root.dataset['reducedMotion'] = String(request.settings.reducedMotion);
      const caption = node('p'); caption.textContent = 'Graybox scene · numbered objects match the list below. Choose a verb, then an object. Gold marker: your safe position.';
      const markerLabel = node('span', 'nq-graybox-position'); markerLabel.dataset['safePosition'] = positionId; markerLabel.textContent = 'You';
      pins.append(markerLabel); stage.append(canvas, pins);
      const legend = node('div', 'nq-graybox-legend'), choices = node('div', 'nq-graybox-choices'), choiceTitle = node('p');
      const feedback = node('p', 'nq-graybox-feedback'); feedback.textContent = feedbackMessage;
      const pinNodes = new Map<string, HTMLElement>();
      const selectable = (text: string, object: SceneObjectView, pin: boolean) => {
        const element = node('span', pin ? 'nq-graybox-pin' : 'nq-graybox-label'); element.textContent = text;
        element.dataset['grayboxObject'] = object.id; element.title = object.label;
        if (object.actions[0]?.unavailableReason) { element.dataset['unavailable'] = 'true'; element.title += `: ${object.actions[0].unavailableReason}`; }
        return element;
      };
      request.view.objects.forEach((object, index) => {
        const pin = selectable(String(index + 1), object, true); pins.append(pin); pinNodes.set(object.id, pin);
        legend.append(selectable(`${index + 1}. ${object.label}`, object, false));
      });
      const updateChoices = (id: string | null) => {
        const object = id && objectMap.get(id); if (!object) { choices.replaceChildren(); choiceTitle.textContent = 'Choose an object to see its actions.'; return; }
        selectedId = object.id;
        choiceTitle.textContent = `${object.label} · ${request.view.controls.find(c => c.pressed && c.action.kind === 'select-verb')?.label ?? 'Walk'} actions`;
        choices.replaceChildren(...object.actions.map(control => {
          const element = node('span', 'nq-graybox-choice'); element.dataset['grayboxControl'] = control.id;
          element.textContent = control.label; if (control.unavailableReason) { element.dataset['unavailable'] = 'true'; element.textContent += ` — ${control.unavailableReason}`; } return element;
        }));
      };
      updateChoices(selectedId); root.append(stage, choices);
      if (host.dataset['contained'] !== 'true') root.append(caption, legend, choiceTitle, feedback);
      const ray = new THREE.Raycaster(), coordinates = new THREE.Vector2();
      const controls = new Map(request.view.objects.flatMap(object => object.actions).map(control => [control.id, control]));
      const target = (event: PointerEvent): { object?: SceneObjectView; control?: SemanticControl } => {
        const element = event.target instanceof window.Element ? event.target as Element : null;
        const controlId = element?.closest<HTMLElement>('[data-graybox-control]')?.dataset['grayboxControl'];
        if (controlId) return { control: controls.get(controlId) } as { control?: SemanticControl };
        let id = element?.closest<HTMLElement>('[data-graybox-object]')?.dataset['grayboxObject'];
        if (!id && element === canvas) {
          const bounds = canvas.getBoundingClientRect(); coordinates.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1);
          ray.setFromCamera(coordinates, camera); id = ray.intersectObjects(pickable, false)[0]?.object.userData['objectId'] as string | undefined;
        }
        const object = id && objectMap.get(id); return object ? { object, ...(object.actions[0] ? { control: object.actions[0] } : {}) } : {};
      };
      let alive = true, attached = false, paused = false, frame = 0, renders = 0;
      const pointer = createGrayboxPointer(request.capture);
      const abort = new AbortController();
      root.addEventListener('pointerdown', event => {
        if (!alive || event.button !== 0) return;
        const found = target(event); if (found.object) updateChoices(found.object.id);
        if (found.control && !found.control.unavailableReason) pointer.down(event.pointerId, event.clientX, event.clientY, found.control.id);
        else { pointer.cancel(); feedback.textContent = found.control?.unavailableReason ?? ''; }
      }, { signal: abort.signal });
      window.addEventListener('pointermove', event => pointer.move(event.pointerId, event.clientX, event.clientY), { signal: abort.signal });
      window.addEventListener('pointercancel', () => pointer.cancel(), { signal: abort.signal });
      window.addEventListener('pointerup', event => { if (!(event.target instanceof window.Node) || !root.contains(event.target)) pointer.cancel(); }, { signal: abort.signal });
      window.addEventListener('blur', () => pointer.cancel(), { signal: abort.signal });
      root.addEventListener('click', event => { const result = pointer.click((event as PointerEvent).pointerId);
        if (result?.message) { feedbackMessage = result.message; if (latestFeedback) latestFeedback.textContent = feedbackMessage; } }, { signal: abort.signal });
      const lose = (event: Event) => { event.preventDefault(); if (alive) { request.contextLost(); destroyRenderer(); } };
      canvas.addEventListener('webglcontextlost', lose, { signal: abort.signal });
      function draw() {
        frame = 0; if (!alive || !attached || paused || request.signal.aborted) return;
        const contained = host.dataset['contained'] === 'true';
        const width = Math.max(1, Math.round(stage.getBoundingClientRect().width)), height = contained ? Math.max(1, Math.round(host.clientHeight)) : Math.round(Math.max(230, Math.min(480, width / 1.65)));
        renderer.setPixelRatio(request.settings.detail === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)); renderer.setSize(width, height, false);
        if (!contained) stage.style.height = `${height}px`; const aspect = width / height;
        const heightSpan = Math.max(9, layout!.camera.span / aspect);
        camera.left = -heightSpan * aspect / 2; camera.right = -camera.left; camera.top = heightSpan / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
        renderer.render(scene, camera);
        const project = (element: HTMLElement, point: THREE.Vector3) => { const p = point.clone().project(camera); element.style.left = `${(p.x + 1) * 50}%`; element.style.top = `${(1 - p.y) * 50}%`; };
        for (const [id, element] of pinNodes) project(element, anchors.get(id)!);
        project(markerLabel, new THREE.Vector3(safe!.point[0], 1.3, safe!.point[1]));
        root.dataset['rendered'] = 'true'; root.dataset['renderCount'] = String(++renders);
        root.dataset['triangles'] = String(renderer.info.render.triangles); root.dataset['drawCalls'] = String(renderer.info.render.calls);
        root.dataset['geometries'] = String(renderer.info.memory.geometries); root.dataset['textures'] = String(renderer.info.memory.textures);
      }
      const schedule = () => { if (alive && attached && !paused && !frame) frame = window.requestAnimationFrame(draw); };
      const observer = new window.ResizeObserver(schedule);
      return {
        attach() { if (!alive || request.signal.aborted) return; attached = true; latestFeedback = feedback; host.replaceChildren(root); observer.observe(stage); draw(); },
        setPaused(value) { paused = value; root.dataset['paused'] = String(value); if (value) { pointer.cancel(); window.cancelAnimationFrame(frame); frame = 0; } else schedule(); },
        dispose() { if (!alive) return; alive = false; pointer.dispose(); abort.abort(); observer.disconnect(); window.cancelAnimationFrame(frame);
          materials.forEach(value => value.dispose()); renderer.renderLists.dispose(); root.remove(); if (latestFeedback === feedback) latestFeedback = null; },
      };
    },
    dispose() { if (disposed) return; disposed = true; destroyRenderer(); },
  };
}
