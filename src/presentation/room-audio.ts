// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { actionSoundEvents, committedSoundEvents, roomCues, type ContextualCue } from './contextual-audio';
import type { ContentRegistry } from '../content/registry';
import type { ActionResult, SemanticAction } from '../ui/action-bus';
import type { PresentationSettings, RuntimeState } from '../state/types';
import { createAudioAdapter, createHtmlAudioBackend, volumesFromSettings, type AudioState } from './audio';
import { publicMediaUrl, type RoomMedia } from './room-media';

/** Optional reviewed playback with permanent transcripts. No progress or save authority. */
export function createRoomAudioPanel(host: HTMLElement, media: RoomMedia, gameBase: string, change: (settings: PresentationSettings) => void, refresh: () => void, registry?: ContentRegistry) {
  const document = host.ownerDocument, events = new AbortController();
  let settings: PresentationSettings = { musicVolume: 1, effectsVolume: 1, voiceVolume: 1, captions: true, reducedMotion: 'system', textScale: 1 }, room: string | null | undefined, disposed = false;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K) => document.createElement(tag);
  const root = node('section'); root.className = 'nq-media'; root.setAttribute('aria-label', 'Sound and reading');
  const details = node('details'), summary = node('summary'); summary.textContent = 'Sound and reading'; details.append(summary);
  const status = node('p'); status.setAttribute('role', 'status');
  const caption = node('p'); caption.className = 'nq-media-caption'; caption.setAttribute('aria-live', 'off'); caption.tabIndex = -1;
  const refreshButton = node('button'); refreshButton.type = 'button'; refreshButton.textContent = 'Reload account presentation preferences';
  refreshButton.addEventListener('click', refresh, { signal: events.signal });
  const preferencesStatus = node('p'); preferencesStatus.className = 'nq-media-preferences-status';
  const rows = new Map<string, { element: HTMLElement; status: HTMLElement; replay: HTMLButtonElement }>();
  const cueStatuses = new Map<string, AudioState['status']>();
  let captionId: string | undefined, transientCaption: number | undefined;
  const clearCaption = () => {
    document.defaultView?.clearTimeout(transientCaption); transientCaption = undefined;
    captionId = undefined; caption.textContent = ''; caption.tabIndex = -1;
  };
  const update = (state: AudioState) => {
    const changed = state.status !== cueStatuses.get(state.id);
    cueStatuses.set(state.id, state.status);
    const row = rows.get(state.id); if (row) { row.status.textContent = state.status === 'awaiting-gesture' ? 'Select Replay to enable sound.' : state.status === 'unavailable' ? 'Audio unavailable. The transcript remains available.' : state.status; row.element.dataset['audioStatus'] = state.status; }
    if (changed && ['playing', 'loading', 'awaiting-gesture'].includes(state.status)) {
      clearCaption(); captionId = state.id; caption.textContent = state.text; caption.tabIndex = 0; caption.hidden = !settings.captions;
      if (room !== media.composition.roomId && state.channel !== 'voice') {
        transientCaption = document.defaultView?.setTimeout(() => { if (document.activeElement !== caption) clearCaption(); }, 3500);
      }
    } else if (room !== media.composition.roomId && changed && captionId === state.id && document.activeElement !== caption && ['stopped','disposed','ended'].includes(state.status)) clearCaption();
    if (state.status === 'unavailable' || state.status === 'awaiting-gesture') status.textContent = state.status === 'unavailable' ? 'Audio unavailable. Read the transcript or retry playback.' : 'Sound waits for your choice. Select a Replay button.';
  };
  const adapter = createAudioAdapter({ backend: createHtmlAudioBackend(document), volumes: volumesFromSettings(settings), maxCues: 64, maxVoices: 5, maxPendingPlays: 5, onChange: update });
  const handles = new Map(media.composition.audio.map(cue => [cue.assetId, adapter.present({ id: cue.assetId, channel: cue.channel, src: publicMediaUrl(media.bindings.get(cue.assetId)!, gameBase), text: cue.text, loop: cue.loop })]));
  const contextual = new Map<string, ContextualCue>();
  let activeCues: readonly ContextualCue[] = [], previous: RuntimeState | undefined;
  const benchmark = new Map(media.composition.audio.map(cue => [cue.assetId, cue]));
  const scopedId = (cue: ContextualCue) => cue.roomId + '/' + cue.assetId;
  const stopVoice = () => {
    for (const [key, cue] of [...benchmark, ...contextual]) if (cue.channel === 'voice') handles.get(key)?.stop();
  };
  const play = (id: string) => {
    const cue = contextual.get(id) ?? benchmark.get(id);
    if (!cue) return;
    if (cue.channel === 'voice') stopVoice();
    if (cue.channel === 'effects' && !cue.loop) {
      for (const [key, other] of [...benchmark, ...contextual]) {
        if (other.channel === 'effects' && !other.loop && key !== id) handles.get(key)?.stop();
      }
    }
    const handle = handles.get(id)!; handle.stop(); void handle.play();
  };
  const addRow = (cue: { assetId: string; text: string }, label: string, exportPath: string, key = cue.assetId) => {
    const section = node('div'); section.className = 'nq-media-cue'; section.dataset['assetId'] = cue.assetId; section.dataset['exportPath'] = exportPath;
    const heading = node('strong'); heading.textContent = label;
    const transcript = node('p'); transcript.textContent = cue.text;
    const replay = node('button'); replay.type = 'button'; replay.textContent = `Replay ${label.split(' ·')[0]}`;
    replay.onclick = () => { if (root.contains(replay)) play(key); };
    const skip = node('button'); skip.type = 'button'; skip.textContent = `Skip ${label.split(' ·')[0]}`;
    skip.onclick = () => { if (root.contains(skip)) handles.get(key)?.stop(); };
    const cueStatus = node('span'); cueStatus.textContent = 'idle'; section.append(heading, transcript, replay, skip, cueStatus); details.append(section); rows.set(key, { element: section, status: cueStatus, replay });
  }
  for (const cue of media.composition.audio) {
    const label = cue.channel === 'music' ? 'Title theme' : cue.assetId.endsWith('VOICE-001') ? 'Narrator' : cue.assetId.endsWith('VOICE-035') ? 'Photon' : cue.trigger === 'photon' ? 'Photon glimmer' : 'Control click';
    addRow(cue, label, media.bindings.get(cue.assetId)!.exportPath);
  }
  function reveal(triggers: ReadonlySet<string>) {
    if (!triggers.size) return;
    const selected = activeCues.filter(cue => triggers.has(cue.trigger));
    for (const cue of selected) {
      const key = scopedId(cue);
      if (!contextual.has(key)) {
        contextual.set(key, cue);
        const handle = adapter.present({ id: key, src: gameBase + cue.exportPath.slice('public/'.length), channel: cue.channel, text: cue.text, loop: cue.loop });
        handles.set(key, handle); addRow(cue, cue.label, cue.exportPath, key);
      }
    }
    // When two contextual readings become available together, keep both transcripts
    // and replay buttons; speak one complete line instead of cutting it off immediately.
    const channels = new Set<string>();
    for (const cue of [...selected].reverse()) {
      const channel = cue.loop ? cue.assetId : cue.channel;
      if (!channels.has(channel)) { channels.add(channel); play(scopedId(cue)); }
    }
  }
  function clearContext() {
    for (const id of contextual.keys()) {
      handles.get(id)?.dispose(); handles.delete(id);
      rows.get(id)?.element.remove(); rows.delete(id);
    }
    contextual.clear();
  }
  const controls = node('fieldset'), legend = node('legend'); legend.textContent = 'Audio levels and reading preferences'; controls.append(legend);
  const inputs = new Map<string, HTMLInputElement | HTMLSelectElement>();
  for (const [key, title] of [['musicVolume', 'Music volume'], ['effectsVolume', 'Effects volume'], ['voiceVolume', 'Voice volume'], ['textScale', 'Text size']] as const) {
    const label = node('label'), input = node('input'), output = node('output'); input.type = 'range'; input.min = key === 'textScale' ? '1' : '0'; input.max = key === 'textScale' ? '2' : '1'; input.step = key === 'textScale' ? '.25' : '.1';
    input.value = String(settings[key]); input.setAttribute('aria-label', title); output.textContent = `${Math.round(settings[key] * 100)}%`;
    input.addEventListener('input', () => { output.textContent = `${Math.round(Number(input.value) * 100)}%`; }, { signal: events.signal });
    input.addEventListener('change', () => change({ ...settings, [key]: Number(input.value) }), { signal: events.signal }); label.append(title, input, output); controls.append(label); inputs.set(key, input);
  }
  const captionLabel = node('label'), captions = node('input'); captions.type = 'checkbox'; captions.checked = true; captionLabel.append(captions, 'Show sound captions'); controls.append(captionLabel); inputs.set('captions', captions);
  captions.addEventListener('change', () => change({ ...settings, captions: captions.checked }), { signal: events.signal });
  const motionLabel = node('label'), motion = node('select'); motion.setAttribute('aria-label', 'Reduced motion');
  for (const [value, label] of [['system', 'Follow system'], ['on', 'On'], ['off', 'Off']]) { const option = node('option'); option.value = value!; option.textContent = label!; motion.append(option); }
  motionLabel.append('Reduced motion', motion); controls.append(motionLabel); inputs.set('reducedMotion', motion);
  motion.addEventListener('change', () => change({ ...settings, reducedMotion: motion.value as PresentationSettings['reducedMotion'] }), { signal: events.signal });
  details.prepend(controls); details.prepend(summary); details.append(preferencesStatus, refreshButton); root.append(details, caption, status); host.replaceChildren(root);
  const pause = () => { adapter.setSuspended(document.hidden); if (document.hidden) status.textContent = 'Sound paused while this tab is hidden. Use Replay when you return.'; };
  document.addEventListener('visibilitychange', pause, { signal: events.signal }); pause();
  return {
    show(nextRoom: string | null, next: PresentationSettings, preferenceMessage: string, account: { authenticated: boolean; busy: boolean; reviewRequired: boolean }, runtime?: RuntimeState) {
      if (disposed) return; settings = next; root.style.fontSize = `${next.textScale}rem`; adapter.setVolumes(volumesFromSettings(next)); caption.hidden = !next.captions; preferencesStatus.textContent = preferenceMessage; refreshButton.hidden = !account.authenticated; refreshButton.disabled = account.busy;
      for (const [key, control] of inputs) { control.disabled = account.busy || account.reviewRequired; if (key === 'captions') (control as HTMLInputElement).checked = next.captions; else control.value = String(next[key as keyof PresentationSettings]); const output = control.parentElement?.querySelector('output'); if (output) output.textContent = `${Math.round(Number(control.value) * 100)}%`; }
      if (nextRoom !== room || runtime?.game?.adventureId !== previous?.game?.adventureId || runtime?.game?.world.attemptId !== previous?.game?.world.attemptId) {
        clearContext(); activeCues = roomCues(nextRoom, registry);
        room = nextRoom; for (const handle of handles.values()) handle.stop(); caption.textContent = ''; caption.tabIndex = -1; status.textContent = '';
        const arrival = new Set(['arrival']);
        if (runtime?.game?.world.completedObjectiveIds.some(id => String(id) === 'spec001:O10')) arrival.add('return-with-repair-preparation');
        reveal(arrival);
        if (room === media.composition.roomId) for (const cue of media.composition.audio.filter(c => c.trigger === 'arrival')) void handles.get(cue.assetId)!.play();
      }
      if (runtime && runtime !== previous) { reveal(committedSoundEvents(previous, runtime)); previous = runtime; }
      for (const cue of media.composition.audio) rows.get(cue.assetId)!.element.hidden = cue.trigger !== 'title' && room !== media.composition.roomId;
    },
    action(input: SemanticAction, result: ActionResult, state: RuntimeState) {
      if (disposed || !state.game || state.game.world.roomId !== room) return;
      if ((input.kind === 'skip-dialogue' || input.kind === 'close-dialogue') && result.status === 'handled') stopVoice();
      reveal(actionSoundEvents(input, result, state));
    },
    trigger(trigger: 'photon' | 'control') { if (disposed || room !== media.composition.roomId) return; for (const cue of media.composition.audio.filter(c => c.trigger === trigger)) play(cue.assetId); },
    stopVoice,
    dispose() { if (disposed) return; disposed = true; clearCaption(); events.abort(); adapter.dispose(); root.remove(); },
  };
}
