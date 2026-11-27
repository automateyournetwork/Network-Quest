// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/addons/loaders/GLTFLoader.js';
import { clone } from 'three/addons/utils/SkeletonUtils.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import type { mediaBinding } from '../content/schema-types.generated';
import type { RoomRenderer, RoomView } from './room-adapter';
import type { ResourceSpec } from './resource-pool';
import { createRoomWalk } from './room-walk';
import { createRoomParty } from './room-party';
import { createGrayboxPointer } from './introduction-graybox';
import { publicMediaUrl, roomFraming, type RoomMedia } from './room-media';

let areaLightsInitialized = false;
export type RoomResource = { kind: 'model'; gltf: GLTF } | { kind: 'image'; url: string; width: number; height: number };
export function modelResidency(gltf: GLTF): number {
  const arrays = new Set<ArrayBufferLike>();
  gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { for (const attribute of Object.values((object.geometry as THREE.BufferGeometry).attributes)) arrays.add(attribute.array.buffer); if (object.geometry.index) arrays.add(object.geometry.index.array.buffer); } });
  return [...arrays].reduce((sum, value) => sum + value.byteLength, 0);
}
function disposeModel(gltf: GLTF) {
  const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>();
  gltf.scene.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const material of Array.isArray(object.material) ? object.material : [object.material]) { materials.add(material); for (const value of Object.values(material)) if (value instanceof THREE.Texture) textures.add(value); } } });
  geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
}
export function createRoomResource(binding: Readonly<mediaBinding>, gameBase: string, document: Document,
  options: { width?: number; height?: number; bytes?: number } = {}): ResourceSpec<RoomResource> {
  const url = publicMediaUrl(binding, gameBase), webp = url.endsWith('.webp'), image = webp || url.endsWith('.png');
  const width = options.width ?? (webp ? 1600 : 1672), height = options.height ?? (webp ? 900 : 941);
  if (image && (![width, height].every(n => Number.isSafeInteger(n) && n > 0) || width * height > 16_777_216)) throw new Error('Invalid room image bounds');
  return { key: `room-media:${url}:${image ? width + 'x' + height : 'glb'}`, bytes: options.bytes ?? (image ? width * height * 4 : 16_777_216),
    async load(signal) {
      const response = await fetch(url, { signal, credentials: 'same-origin' });
      if (!response.ok) throw new Error(`Room asset unavailable: ${binding.assetId}`);
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength > 4_194_304 || signal.aborted) throw new Error('Room asset canceled or oversized');
      if (!image) {
        const gltf = await new GLTFLoader().parseAsync(bytes, '');
        if (signal.aborted) { disposeModel(gltf); throw new Error('Room model canceled'); }
        return { value: { kind: 'model', gltf }, bytes: modelResidency(gltf) };
      }
      const objectUrl = URL.createObjectURL(new Blob([bytes], { type: webp ? 'image/webp' : 'image/png' })), element = document.createElement('img');
      try {
        element.src = objectUrl; await element.decode();
        if (signal.aborted || element.naturalWidth !== width || element.naturalHeight !== height) throw new Error('Room layer canceled or invalid dimensions');
        return { value: { kind: 'image', url: objectUrl, width: element.naturalWidth, height: element.naturalHeight }, bytes: element.naturalWidth * element.naturalHeight * 4 };
      } catch (error) { URL.revokeObjectURL(objectUrl); throw error; }
    },
    dispose(value) { if (value.kind === 'model') disposeModel(value.gltf); else URL.revokeObjectURL(value.url); },
  };
}

export interface RoomDecoration {
  updateView(view: RoomView): void;
  layout(camera: THREE.OrthographicCamera, width: number, height: number): void;
  dispose(): void;
}
export type RoomDecorationFactory = (scene: THREE.Scene, stage: HTMLElement, gameBase: string) => RoomDecoration;

/** Registered 3D cast and imagery. Only the action dispatcher owns gameplay changes. */
export function createThreeRoom(host: HTMLElement, media: RoomMedia, gameBase: string, layered?: { framing: typeof roomFraming; mode?: 'layered' | 'three'; decorate?: RoomDecorationFactory }): RoomRenderer<RoomResource> & { dispose(): void; react(kind: 'walk' | 'reaction', target?: string): void; playAbility(assetId: string): void } {
  const document = host.ownerDocument, window = document.defaultView!, composition = media.composition;
  const specs = new Map([...media.bindings.values()].filter(b => b.exportPath.endsWith('.glb') || /\.(?:png|webp)$/.test(b.exportPath)).map(b => [b.assetId, createRoomResource(b, gameBase, document, layered && b.exportPath.endsWith('.glb') ? { bytes: 4_194_304 } : {})]));
  let renderer: THREE.WebGLRenderer | null = null, disposed = false, reaction: ((kind: 'walk' | 'reaction', target?: string) => void) | null = null;
  let residentAbility: ((assetId: string) => void) | undefined;
  const destroy = () => { const old = renderer; renderer = null; if (old) { old.dispose(); old.forceContextLoss(); old.domElement.remove(); } };
  return {
    reuseView: true,
    react(kind, target) { reaction?.(kind, target); },
    playAbility(assetId) { residentAbility?.(assetId); },
    async prepare(request) {
      if (disposed || request.view.roomId !== composition.roomId || (request.view as RoomView & { safePositionId?: string }).safePositionId !== composition.safePositionId) throw new Error('Room projection and media disagree');
      const models = composition.models.filter(m => !(layered && request.settings.detail === 'low' && !m.character && !m.objectId && m.position[1] > 0));
      const visibleIds = new Set([...models, ...composition.layers].map(a => a.assetId));
      const resources = new Map(await Promise.all([...specs].filter(([id]) => visibleIds.has(id)).map(async ([id, spec]) => [id, await request.resources.acquire(spec).ready] as const)));
      if (disposed || request.signal.aborted) throw new Error('Room preparation canceled');
      const decodedModelBytes = [...resources.values()].reduce((sum, resource) => sum + (resource.kind === 'model' ? modelResidency(resource.gltf) : 0), 0);
      if (!areaLightsInitialized) { RectAreaLightUniformsLib.init(); areaLightsInitialized = true; }
      if (!renderer) { renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true }); renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.setClearColor(0x182532, 0); }
      const webgl = renderer, canvas = webgl.domElement, scene = new THREE.Scene(), camera = new THREE.OrthographicCamera();
      camera.position.set(...composition.camera.position); camera.lookAt(...composition.camera.target); camera.near = composition.camera.near; camera.far = composition.camera.far;
      scene.add(new THREE.HemisphereLight(0xb6d5e3, 0x182532, 1));
      for (const [position, target, color, intensity, size] of [
        [[1, 9, 3], [4, 0, 3], 0xffc78a, 10, 7], [[10, 8, 1], [5, 1, 3], 0x80c2ff, 8, 6], [[5, 7, -4], [5, 1, 3], 0xccffe6, 14, 5],
      ] as const) { const light = new THREE.RectAreaLight(color, intensity, size, size); light.position.set(position[0], position[1], position[2]); light.lookAt(target[0], target[1], target[2]); scene.add(light); }
      const pickable: THREE.Object3D[] = [], actors: { mixer: THREE.AnimationMixer; root: THREE.Object3D; clips: THREE.AnimationClip[]; id: string; current: THREE.AnimationAction | null; remaining: number }[] = [];
      const contactGeometry = layered ? new THREE.PlaneGeometry(1, 1) : null;
      const contactMaterial = layered ? new THREE.ShaderMaterial({
        transparent: true, depthWrite: false,
        vertexShader: 'varying vec2 point; void main(){point=uv*2.-1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
        fragmentShader: 'varying vec2 point; void main(){float alpha=0.48*(1.-smoothstep(0.12,1.,dot(point,point)));gl_FragColor=vec4(0.055,0.033,0.025,alpha);}',
      }) : null;
      function contactShadow(size: THREE.Vector3, center: THREE.Vector3) {
        if (!contactGeometry || !contactMaterial) return undefined;
        const shadow = new THREE.Mesh(contactGeometry, contactMaterial);
        shadow.rotation.x = -Math.PI / 2;
        shadow.scale.set(Math.max(.45, size.x * 1.25), Math.max(.44, size.z * 1.32), 1);
        shadow.position.set(center.x, .008, center.z);
        return shadow;
      }
      const supports: THREE.Mesh<THREE.CylinderGeometry, THREE.MeshStandardMaterial>[] = [];
      let heroShadow: THREE.Mesh | undefined;
      for (const model of models) {
        const resource = resources.get(model.assetId)!; if (resource.kind !== 'model') throw new Error('Room model binding mismatch');
        const root = clone(resource.gltf.scene); root.position.set(...model.position);
        if (model.rotation) root.rotation.set(...model.rotation);
        if (layered && model.scale !== undefined) root.scale.setScalar(model.scale);
        scene.add(root);
        if (layered && media.bindings.get(model.assetId)?.use !== 'room-architecture' && (model.position[1] === 0 || model.supportHeight)) {
          const bounds = new THREE.Box3().setFromObject(root);
          const size = bounds.getSize(new THREE.Vector3()), center = bounds.getCenter(new THREE.Vector3());
          // A waist-high brass display for a loose plug. Shared tools use their actual GLB fixture mounts.
          if (model.supportHeight) {
            const stand = new THREE.Mesh(new THREE.CylinderGeometry(.27, .21, model.supportHeight, 12), new THREE.MeshStandardMaterial({ color: 0x74583b, roughness: .78 }));
            stand.position.set(center.x, model.supportHeight / 2, center.z);
            scene.add(stand); supports.push(stand);
          }
          const shadow = contactShadow(size, center)!;
          scene.add(shadow);
          if (model.semanticId === 'spec001:CH01') heroShadow = shadow;
        }
        root.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const exit = media.bindings.get(model.assetId)?.use === 'room-architecture' && composition.anchors.find(a =>
            a.objectId.startsWith('exit:') && a.objectId === object.userData['objectId']);
          const target = model.objectId ?? (exit ? exit.objectId : null);
          if (target) { object.userData['objectId'] = target; pickable.push(object); }
        });
        if (model.character) actors.push({ mixer: new THREE.AnimationMixer(root), root, clips: resource.gltf.animations, id: model.assetId, current: null, remaining: 0 });
      }
      const play = (actor: typeof actors[number], clipName: string, transient = false) => {
        const clip = actor.clips.find(c => c.name === clipName); if (!clip) throw new Error(`Missing authored clip: ${clipName}`);
        actor.current?.stop(); const action = actor.mixer.clipAction(clip); action.reset().play(); actor.current = action; actor.remaining = transient ? clip.duration : 0;
        if (request.settings.reducedMotion) { actor.mixer.setTime(0); action.paused = true; }
      };
      for (const actor of actors) play(actor, 'idle');
      const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string) => { const element = document.createElement(tag); if (className) element.className = className; return element; };
      const root = node('div', 'nq-room nq-graybox'), stage = node('div', 'nq-room-stage nq-graybox-stage'), pins = node('div', 'nq-room-pins nq-graybox-pins');
      root.dataset['roomId'] = composition.roomId; root.dataset['presentation'] = layered ? layered.mode ?? 'layered' : 'three'; root.dataset['detail'] = request.settings.detail; root.dataset['reducedMotion'] = String(request.settings.reducedMotion);
      const layers: HTMLImageElement[] = [];
      for (const layer of composition.layers) { const resource = resources.get(layer.assetId)!; if (resource.kind !== 'image') throw new Error('Room layer binding mismatch');
        const image = node('img', `nq-room-layer nq-room-${layer.plane}`); image.alt = ''; image.src = resource.url; image.draggable = false;
        image.dataset['assetId'] = layer.assetId; image.dataset['exportPath'] = media.bindings.get(layer.assetId)!.exportPath; layers.push(image); stage.append(image); }
      canvas.className = 'nq-room-focal'; canvas.setAttribute('aria-hidden', 'true'); stage.append(canvas, pins);
      const instructions = node('p', 'nq-room-instructions'); instructions.textContent = 'Choose Walk, Look, Talk or Use, then a scene marker. W / L / T / U select a verb. Every action is also in the scene description below.';
      const choiceTitle = node('p'), choices = node('div', 'nq-graybox-choices'), feedback = node('p', 'nq-graybox-feedback');
      const decoration = layered?.decorate?.(scene, stage, gameBase);
      const markerLabel = node('span', 'nq-graybox-position'); markerLabel.dataset['safePosition'] = composition.safePositionId; markerLabel.textContent = 'You'; pins.append(markerLabel);
      const pinNodes = new Map<string, HTMLElement>();
      let currentView = request.view, selected: string | null = null, alive = true, attached = false, paused = false, frame = 0, last = 0, renders = 0;
      const pointer = createGrayboxPointer(request.capture), events = new AbortController(), ray = new THREE.Raycaster(), point = new THREE.Vector2();
      let touchChoices: RoomView['objects'] = [];
      const updateChoices = () => {
        if (touchChoices.length) {
          const label = node('strong'); label.textContent = 'Choose a subject';
          choices.replaceChildren(label, ...touchChoices.map(object => {
            const option = node('span', 'nq-graybox-choice'); option.dataset['grayboxObject'] = object.id;
            option.textContent = object.label; return option;
          }));
          return;
        }
        const object = currentView.objects.find(o => o.id === selected); choiceTitle.textContent = object ? `${object.label} · ${currentView.controls.find(c => c.pressed && c.action.kind === 'select-verb')?.label ?? 'Walk'}` : (layered ? 'Choose a subject to inspect.' : 'Explore the lift. The two indicators tell different stories.');
        choices.replaceChildren(...(object?.actions ?? []).map(control => { const span = node('span', 'nq-graybox-choice'); span.dataset['grayboxControl'] = control.id; span.textContent = control.label; if (control.unavailableReason) { span.dataset['unavailable'] = 'true'; span.textContent += ` — ${control.unavailableReason}`; } return span; }));
      };
      for (const [index, anchor] of composition.anchors.entries()) {
        const object = currentView.objects.find(o => o.id === anchor.objectId); if (!object) throw new Error('Authored scene anchor has no semantic control');
        const pin = node('span', 'nq-graybox-pin'); pin.textContent = String(index + 1); pin.title = object.label; pin.dataset['grayboxObject'] = anchor.objectId; pins.append(pin); pinNodes.set(anchor.objectId, pin);
      }
      root.append(stage, choices);
      if (host.dataset['contained'] !== 'true') root.append(instructions, choiceTitle, feedback);
      updateChoices();
      const find = (event: PointerEvent) => {
        const element = event.target instanceof window.Element ? event.target as Element : null;
        if (layered && event.pointerType === 'touch' && element && stage.contains(element)) {
          const candidates = currentView.objects.filter(object => {
            const box = pinNodes.get(object.id)?.getBoundingClientRect();
            return box && Math.abs(event.clientX - box.left - box.width / 2) < 22 && Math.abs(event.clientY - box.top - box.height / 2) < 22;
          });
          if (candidates.length > 1) { touchChoices = candidates; updateChoices(); return {}; }
          if (candidates.length === 1) return { object: candidates[0], control: candidates[0]!.actions[0] };
        }
        const controlId = element?.closest<HTMLElement>('[data-graybox-control]')?.dataset['grayboxControl'];
        if (controlId) return { object: undefined, control: currentView.objects.flatMap(o => o.actions).find(c => c.id === controlId) };
        let id = element?.closest<HTMLElement>('[data-graybox-object]')?.dataset['grayboxObject'];
        if (!id && element === canvas) { const bounds = canvas.getBoundingClientRect(); point.set((event.clientX - bounds.left) / bounds.width * 2 - 1, -(event.clientY - bounds.top) / bounds.height * 2 + 1); ray.setFromCamera(point, camera); id = ray.intersectObjects(pickable, false)[0]?.object.userData['objectId'] as string | undefined; }
        const object = currentView.objects.find(o => o.id === id); return { object, control: object?.actions[0] };
      };
      root.addEventListener('pointerdown', event => { if (!alive || event.button !== 0) return; const hit = find(event); if (hit.object) { selected = hit.object.id; touchChoices = []; updateChoices(); }
        if (hit.control && !hit.control.unavailableReason) pointer.down(event.pointerId, event.clientX, event.clientY, hit.control.id); else { pointer.cancel(); feedback.textContent = hit.control?.unavailableReason ?? ''; } }, { signal: events.signal });
      window.addEventListener('pointermove', event => pointer.move(event.pointerId, event.clientX, event.clientY), { signal: events.signal });
      window.addEventListener('pointercancel', () => pointer.cancel(), { signal: events.signal }); window.addEventListener('blur', () => pointer.cancel(), { signal: events.signal });
      window.addEventListener('pointerup', event => { if (!(event.target instanceof window.Node) || !root.contains(event.target)) pointer.cancel(); }, { signal: events.signal });
      root.addEventListener('click', event => { const result = pointer.click((event as PointerEvent).pointerId); if (result?.message) feedback.textContent = result.message; }, { signal: events.signal });
      canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); if (alive) { request.contextLost(); destroy(); } }, { signal: events.signal });
      const player = composition.models.find(m => m.semanticId === 'spec001:CH01')!;
      const hero = actors.find(actor => actor.id === player.assetId)!;
      const stops = composition.anchors.filter(a => composition.walkStops?.includes(a.objectId));
      const walk = createRoomWalk(player.position, new Map(stops.map(a => [a.objectId, a.position])));
      const shadowOffset = heroShadow?.position.clone().sub(hero.root.position);
      const decodedLayerBytes = [...resources.values()].reduce((sum, r) => sum + (r.kind === 'image' ? r.width * r.height * 4 : 0), 0);
      const samples: number[] = [];
      function draw(now = 0) {
        frame = 0; if (!alive || !attached || paused || request.signal.aborted) return;
        const elapsed = last ? Math.min((now - last) / 1000, 0.05) : 0; if (last && now > last) { samples.push(now - last); if (samples.length > 300) samples.shift(); } last = now;
        if (!request.settings.reducedMotion) for (const actor of actors) { actor.mixer.update(elapsed); if (actor.remaining > 0 && (actor.remaining -= elapsed) <= 0) play(actor, 'idle'); }
        if (!request.settings.reducedMotion) party?.animate(elapsed);
        walk.advance(elapsed);
        hero.root.position.copy(walk.position);
        if (heroShadow && shadowOffset) heroShadow.position.copy(walk.position).add(shadowOffset);
        const contained = host.dataset['contained'] === 'true';
        const width = Math.max(1, Math.round(stage.getBoundingClientRect().width)), height = contained ? Math.max(1, Math.round(host.clientHeight)) : Math.round(Math.max(230, Math.min(640, width * 9 / 16)));
        const framing = (layered?.framing ?? roomFraming)(width, height, composition.camera); if (!contained) stage.style.height = `${height}px`;
        const ratio = request.settings.detail === 'low' ? 1 : Math.min(window.devicePixelRatio || 1, 1.5);
        if (webgl.getPixelRatio() !== ratio) webgl.setPixelRatio(ratio);
        if (canvas.clientWidth !== width || canvas.clientHeight !== height || canvas.width !== Math.round(width * webgl.getPixelRatio()) || canvas.height !== Math.round(height * webgl.getPixelRatio())) webgl.setSize(width, height, false);
        camera.left = -framing.widthSpan / 2; camera.right = -camera.left; camera.top = framing.heightSpan / 2; camera.bottom = -camera.top; camera.updateProjectionMatrix();
        for (const layer of layers) { layer.style.left = `${framing.left}px`; layer.style.top = `${framing.top}px`; layer.style.width = `${framing.width}px`; layer.style.height = `${framing.height}px`; }
        webgl.render(scene, camera);
        decoration?.layout(camera, width, height);
        const project = (element: HTMLElement, position: readonly [number, number, number]) => { const p = new THREE.Vector3(...position).project(camera); element.style.left = `${(p.x + 1) * 50}%`; element.style.top = `${(1 - p.y) * 50}%`; };
        for (const anchor of composition.anchors) project(pinNodes.get(anchor.objectId)!, anchor.position);
        project(markerLabel, [walk.position.x, walk.position.y + 2.2, walk.position.z]);
        if (stops.length) root.dataset['playerFoot'] = walk.position.toArray().map(v => v.toFixed(3)).join(',');
        root.dataset['rendered'] = 'true'; root.dataset['renderCount'] = String(++renders); root.dataset['triangles'] = String(webgl.info.render.triangles); root.dataset['drawCalls'] = String(webgl.info.render.calls);
        root.dataset['geometries'] = String(webgl.info.memory.geometries); root.dataset['textures'] = String(webgl.info.memory.textures);
        root.dataset['layerDecodedBytes'] = String(decodedLayerBytes); root.dataset['modelDecodedBytes'] = String(decodedModelBytes); root.dataset['modelCount'] = String(models.length); root.dataset['assetIds'] = [...resources.keys()].join(' ');
        root.dataset['frameMsP95'] = samples.length ? String([...samples].sort((a, b) => a - b)[Math.floor(samples.length * .95)]) : '0';
        root.dataset['animatedActors'] = request.settings.reducedMotion ? '0' : String(actors.length);
        if (!request.settings.reducedMotion) frame = window.requestAnimationFrame(draw);
      }
      const schedule = () => { if (alive && attached && !paused && !frame) frame = window.requestAnimationFrame(draw); };
      const react = (kind: 'walk' | 'reaction', target?: string) => {
        if (!alive || paused) return;
        if (kind === 'walk') walk.begin(target, request.settings.reducedMotion);
        if (request.settings.reducedMotion) { schedule(); return; }
        for (const actor of actors) {
        const clip = kind === 'walk' && actor.id.endsWith('CH03') ? 'fly' : kind;
        if (actor.clips.some(c => c.name === clip)) play(actor, clip, true);
      }
      root.dataset['reaction'] = kind; schedule(); };
      const playAbility = (assetId: string) => {
        if (!alive || request.signal.aborted || request.settings.reducedMotion) return;
        const actor = actors.find(a => a.id === assetId && a.clips.some(c => c.name === 'ability'));
        if (!actor) return;
        play(actor, 'ability', true);
        root.dataset['lastAbilityActor'] = assetId;
        schedule();
      };
      const observer = new window.ResizeObserver(schedule);
      const party = composition.partyPositions?.length ? createRoomParty(scene, media, gameBase, document, request, root, schedule, contactShadow) : undefined;
      return {
        attach() { if (!alive || request.signal.aborted) return; attached = true; reaction = react; residentAbility = playAbility; host.replaceChildren(root); party?.updateView(currentView); observer.observe(stage); draw(); },
        updateView(view) { pointer.cancel(); currentView = view; decoration?.updateView(view); party?.updateView(view); updateChoices(); schedule(); },
        setPaused(value) { paused = value; last = 0; root.dataset['paused'] = String(value); if (value) { pointer.cancel(); window.cancelAnimationFrame(frame); frame = 0; } else schedule(); },
        dispose() { if (!alive) return; alive = false; if (reaction === react) { reaction = null; residentAbility = undefined; } pointer.dispose(); events.abort(); observer.disconnect(); window.cancelAnimationFrame(frame); for (const actor of actors) { actor.mixer.stopAllAction(); actor.mixer.uncacheRoot(actor.root); } party?.dispose(); decoration?.dispose(); scene.clear(); contactGeometry?.dispose(); contactMaterial?.dispose(); for (const stand of supports) { stand.geometry.dispose(); stand.material.dispose(); } webgl.renderLists.dispose(); root.remove(); if (layered) destroy(); },
      };
    },
    dispose() { if (disposed) return; disposed = true; reaction = null; destroy(); },
  };
}
