// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import authored from '../../content/spec001/presentation/R04.json';
import type { ContentRegistry } from '../content/registry';
import type { RoomRenderer, RoomView } from './room-adapter';
import type { RoomResource } from './three-room';
import { createRoomResource } from './three-room';
import { createGrayboxPointer } from './introduction-graybox';
import './sprite-room.css';

interface SpriteFrame { at: number; offset: number[] }
interface Clip { end: number; frames: SpriteFrame[] }
interface Subject {
  id: string; assetId: string; objectId: string | null; atlasId: string;
  footpoint: number[]; pivot: number[]; size: number[]; depth: number; clips: Record<string, Clip>;
}
interface Stage {
  version: number; roomId: string; stageSize: number[]; fps: number;
  layers: { assetId: string; plane: string }[];
  atlases: {assetId: string; width: number; height: number}[];
  subjects: Subject[]; anchors: {objectId: string; point: number[]}[];
}
const stageData: Stage = authored as Stage;

function verifyStage(room: Exclude<ReturnType<ContentRegistry['record']>, undefined>, view: RoomView) {
  const { fps, layers, subjects, anchors, atlases, stageSize } = stageData;
  if (room.kind !== 'room' || room.id !== stageData.roomId || stageData.version !== 1 || fps !== 24 ||
      stageSize.join() !== '1024,576' || layers.map(l => l.plane).join() !== 'background,midground,foreground') {
    throw new Error('Sprite room camera or time base mismatch');
  }
  const expected = new Set(['spec001:ASSET-CH01', ...room.characterIds.map(id => id.replace(':', ':ASSET-')), ...room.propInstances.map(p => p.assetId)]);
  if (subjects.length !== expected.size || subjects.some(s => !expected.delete(s.assetId)) ||
      anchors.length !== view.objects.length || new Set(anchors.map(a => a.objectId)).size !== anchors.length ||
      anchors.some(a => !view.objects.some(o => o.id === a.objectId))) throw new Error('Unregistered sprite subject or anchor');
  for (const [i, subject] of subjects.entries()) {
    const sheet = atlases.find(a => a.assetId === subject.atlasId);
    if (!sheet || !subject.clips[subject.id.startsWith('CH') ? 'idle' : 'rest'] ||
        (i && subject.depth > subjects[i-1]!.depth) || (subject.objectId && !anchors.some(a => a.objectId === subject.objectId))) throw new Error('Invalid sprite placement');
    for (const clip of Object.values(subject.clips)) {
      if (!Number.isSafeInteger(clip.end) || clip.frames[0]?.at !== 0 ||
          clip.frames.some((frame, n) => !Number.isSafeInteger(frame.at) || frame.at >= clip.end || (n > 0 && frame.at <= clip.frames[n-1]!.at) ||
          frame.offset.some((offset,k) => !Number.isSafeInteger(offset) || offset < 0 || offset + subject.size[k]! > [sheet.width,sheet.height][k]!))) {
        throw new Error('Invalid sprite frame or timing');
      }
    }
  }
}

export function createSpriteRoom(host: HTMLElement, registry: ContentRegistry, gameBase: string): RoomRenderer<RoomResource> & {
  dispose(): void; react(kind: 'walk' | 'reaction'): void;
} {
  const doc = host.ownerDocument, win = doc.defaultView!;
  let active: { react(kind: 'walk'|'reaction'): void; dispose(): void } | null = null;
  let disposed = false;
  return {
    reuseView: true,
    dispose() { disposed = true; active?.dispose(); },
    react(kind) { active?.react(kind); },
    async prepare(request) {
      const room = registry.record(request.view.roomId);
      if (disposed || room?.kind !== 'room' || !room.mediaBindings) throw new Error('Sprite room is unavailable');
      verifyStage(room,request.view);
      const bindings = room.mediaBindings;
      const entries = [
        ...stageData.layers.map(layer => ({ ...layer, use: layer.plane, width: 1600, height: 900 })),
        ...stageData.atlases.map(atlas => ({ ...atlas, use: 'sprite-animation' })),
      ];
      const images = new Map<string, HTMLImageElement>();
      await Promise.all(entries.map(async entry => {
        const binding = bindings.find(b => b.assetId === entry.assetId && b.use === entry.use && b.contentId === room.id);
        if (!binding) throw new Error('Unregistered room image');
        const resource = await request.resources.acquire(createRoomResource(binding, gameBase, doc, entry)).ready;
        if (resource.kind !== 'image' || request.signal.aborted) throw new Error('Sprite preparation canceled');
        const image = doc.createElement('img');
        image.alt = ''; image.draggable = false; image.src = resource.url;
        await image.decode();
        if (disposed || request.signal.aborted) throw new Error('Sprite preparation canceled');
        image.dataset['assetId'] = entry.assetId; image.dataset['exportPath'] = binding.exportPath;
        images.set(entry.assetId, image);
      }));

      const el = <K extends keyof HTMLElementTagNameMap>(tag: K, className: string) => {
        const element = doc.createElement(tag); element.className = className; return element;
      };
      const root = el('div','nq-room nq-graybox nq-sprite-room');
      const stage = el('div','nq-sprite-stage'), pins = el('div','nq-room-pins nq-graybox-pins');
      const choices = el('div','nq-graybox-choices'), canvas = el('canvas','nq-room-focal');
      canvas.width = stageData.stageSize[0]!; canvas.height = stageData.stageSize[1]!;
      const ctx = canvas.getContext('2d');
      const tester = doc.createElement('canvas'); tester.width = tester.height = 1;
      const hit = tester.getContext('2d', {willReadFrequently: true});
      if (!ctx || !hit) throw new Error('Sprite canvas is unavailable');
      ctx.imageSmoothingEnabled = hit.imageSmoothingEnabled = false;
      for (const layer of stageData.layers) {
        const image = images.get(layer.assetId)!;
        image.className = 'nq-room-layer nq-room-'+layer.plane; stage.append(image);
      }
      stage.setAttribute('aria-hidden','true');
      stage.append(canvas,pins); root.append(stage, choices);
      root.dataset['roomId'] = room.id; root.dataset['mode'] = 'sprite';
      root.dataset['detail'] = request.settings.detail; root.dataset['reducedMotion'] = String(request.settings.reducedMotion);
      root.dataset['assetIds'] = entries.map(e => e.assetId).join(' ');
      root.dataset['layerDecodedBytes'] = String(entries.reduce((sum,e) => sum+e.width*e.height*4,0));
      let view = request.view, selected: string | undefined;
      for (const [index, anchor] of stageData.anchors.entries()) {
        const pin = el('span','nq-graybox-pin'); pin.textContent = String(index+1);
        pin.dataset['grayboxObject'] = anchor.objectId;
        pin.title = view.objects.find(o => o.id === anchor.objectId)!.label;
        pin.style.left = 100*anchor.point[0]!/canvas.width+'%'; pin.style.top = 100*anchor.point[1]!/canvas.height+'%';
        pins.append(pin);
      }
      function updateChoices() {
        const object = view.objects.find(o => o.id === selected);
        choices.replaceChildren();
        if (!object) return;
        const label = doc.createElement('strong');
        label.textContent = object.label;
        choices.append(label, ...object.actions.map(control => {
          const choice = el('span','nq-graybox-choice');
          choice.dataset['grayboxControl'] = control.id; choice.textContent = control.label;
          if (control.unavailableReason) { choice.dataset['unavailable'] = 'true'; choice.textContent += ' — '+control.unavailableReason; }
          return choice;
        }));
      }

      // All visual coordinates are integer stage pixels; the captured pivot is continuous.
      const sprites = stageData.subjects.map(subject => ({
        subject, image: images.get(subject.atlasId)!, sx:0, sy:0, w:subject.size[0]!, h:subject.size[1]!,
        x:Math.round(subject.footpoint[0]!-subject.pivot[0]!), y:Math.round(subject.footpoint[1]!-subject.pivot[1]!),
        clip: subject.clips['idle'] ? 'idle' : 'rest', started:0,
      }));
      let attached = false, alive = true, paused = false, timer: number | undefined;
      let clock = 0, last: number | null = null, draws = 0;
      const motion = !request.settings.reducedMotion && request.settings.detail !== 'low';
      function stopTimer() { if (timer !== undefined) win.clearTimeout(timer); timer = undefined; }
      function draw() {
        stopTimer();
        if (!alive || !attached || request.signal.aborted) return;
        const now = win.performance.now();
        if (last !== null && !paused) clock += now-last;
        last = paused ? null : now;
        let next = Infinity;
        ctx!.clearRect(0,0,canvas.width,canvas.height);
        for (const sprite of sprites) {
          let clip = sprite.subject.clips[sprite.clip]!;
          let elapsed = (clock-sprite.started)*stageData.fps/1000;
          if (sprite.clip !== 'rest' && sprite.clip !== 'idle' && elapsed >= clip.end) {
            sprite.clip = 'idle'; sprite.started = clock; clip = sprite.subject.clips['idle']!; elapsed = 0;
          }
          const time = motion ? elapsed % clip.end : 0;
          const following = clip.frames.findIndex(f => f.at > time);
          const frame = clip.frames[(following < 0 ? clip.frames.length : following) - 1]!;
          [sprite.sx,sprite.sy] = [frame.offset[0]!, frame.offset[1]!];
          ctx!.drawImage(sprite.image,sprite.sx,sprite.sy,sprite.w,sprite.h,sprite.x,sprite.y,sprite.w,sprite.h);
          if (sprite.clip !== 'rest') {
            root.dataset['frame'+sprite.subject.id] = sprite.clip+'@'+frame.at;
            next = Math.min(next,((following < 0 ? clip.end : clip.frames[following]!.at)-time)*1000/stageData.fps);
          }
        }
        root.dataset['rendered'] = 'true'; root.dataset['renderCount'] = String(++draws);
        root.dataset['animatedActors'] = motion && !paused ? String(sprites.filter(s => s.clip !== 'rest').length) : '0';
        if (motion && !paused && Number.isFinite(next)) timer = win.setTimeout(draw,Math.max(1,Math.ceil(next)));
      }
      function react(kind: 'walk'|'reaction') {
        if (!alive || !motion || paused) return;
        if (last !== null) { const now = win.performance.now(); clock += now-last; last = now; }
        for (const sprite of sprites) if (sprite.subject.clips[kind]) { sprite.clip = kind; sprite.started=clock; }
        root.dataset['reaction'] = kind; draw();
      }
      function pick(event: PointerEvent) {
        const box = canvas.getBoundingClientRect();
        const px = Math.floor((event.clientX-box.left)*canvas.width/box.width), py = Math.floor((event.clientY-box.top)*canvas.height/box.height);
        // Test the top visible cell first. Shadows and transparent cell gutters cannot capture input.
        for (let i=sprites.length-1; i>=0; i--) {
          const sprite = sprites[i]!, x = px-sprite.x, y = py-sprite.y;
          if (x<0 || y<0 || x>=sprite.w || y>=sprite.h) continue;
          hit!.clearRect(0,0,1,1); hit!.drawImage(sprite.image,sprite.sx+x,sprite.sy+y,1,1,0,0,1,1);
          if (hit!.getImageData(0,0,1,1).data[3]!>=128) return sprite.subject.objectId;
        }
        return null;
      }
      const pointer = createGrayboxPointer(request.capture), events = new AbortController(), listener = {signal: events.signal};
      root.addEventListener('pointerdown', e => {
        if (e.button !== 0 || !alive || paused || !(e.target instanceof win.Element)) return;
        const choice = e.target.closest<HTMLElement>('[data-graybox-control]')?.dataset['grayboxControl'];
        const objectId = e.target.closest<HTMLElement>('[data-graybox-object]')?.dataset['grayboxObject'] ?? (e.target === canvas ? pick(e) : null);
        const object = view.objects.find(o => o.id === objectId);
        // Keep contextual choices mounted through pointerup/click so the original target remains valid.
        if (!choice) { selected = object?.id; updateChoices(); }
        const control = choice ? view.objects.flatMap(o => o.actions).find(c => c.id === choice) : object?.actions[0];
        if (control && !control.unavailableReason) pointer.down(e.pointerId,e.clientX,e.clientY,control.id);
        else pointer.cancel();
      },listener);
      win.addEventListener('pointermove', e => pointer.move(e.pointerId,e.clientX,e.clientY),listener);
      win.addEventListener('pointerup', e => { if (!(e.target instanceof win.Node) || !root.contains(e.target)) pointer.cancel(); },listener);
      win.addEventListener('pointercancel', pointer.cancel,listener); win.addEventListener('blur',pointer.cancel,listener);
      root.addEventListener('click', e => { pointer.click((e as PointerEvent).pointerId); pointer.cancel(); },listener);
      canvas.addEventListener('contextlost', e => { e.preventDefault(); request.contextLost(); },listener);
      function disposeSession() {
        if (!alive) return;
        alive = false; if (active?.dispose === disposeSession) active = null;
        events.abort(); pointer.dispose(); stopTimer(); root.remove();
      }
      return {
        attach() {
          if (!alive || request.signal.aborted) return;
          active = {react,dispose: disposeSession}; attached = true; host.replaceChildren(root); draw();
        },
        updateView(next) { pointer.cancel(); view = next; updateChoices(); },
        setPaused(value) {
          paused = value; last = null; root.dataset['paused'] = String(paused);
          if (paused) { pointer.cancel(); stopTimer(); root.dataset['animatedActors'] = '0'; }
          else if (attached) draw();
        },
        dispose: disposeSession,
      };
    },
  };
}
