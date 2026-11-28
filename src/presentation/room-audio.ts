// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { actionSoundEvents, committedSoundEvents, roomCues, type ContextualCue } from './contextual-audio';
import type { ContentRegistry } from '../content/registry';
import type { ActionResult, SemanticAction } from '../ui/action-bus';
import type { PresentationSettings, RuntimeState } from '../state/types';
import { createAudioAdapter, createHtmlAudioBackend, volumesFromSettings, type AudioState } from './audio';
import { publicMediaUrl, type RoomMedia } from './room-media';
import { observeVisibility } from './visibility';

/** Optional reviewed playback with permanent transcripts. No progress or save authority. */
export function createRoomAudioPanel(host: HTMLElement, media: RoomMedia, gameBase: string, initial: PresentationSettings, registry?: ContentRegistry) {
  const document = host.ownerDocument, events = new AbortController();
  let settings = initial, room: string | null | undefined, disposed = false;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K) => document.createElement(tag);
  const root = node('section'); root.className = 'nq-media'; root.setAttribute('aria-label', 'Sound and reading');
  const details = node('details'), summary = node('summary'); summary.textContent = 'Sound and reading'; details.append(summary);
  const status = node('p'); status.setAttribute('role', 'status');
  const caption = node('p'); caption.className = 'nq-media-caption'; caption.setAttribute('aria-live', 'off'); caption.tabIndex = -1;
  const settingsHost = node('div'); details.append(settingsHost);
  const rows = new Map<string, { element: HTMLElement; status: HTMLElement; replay: HTMLButtonElement }>();
  const cueStatuses = new Map<string, AudioState['status']>();
  const interrupted = 'Sound paused. Select Replay to hear a cue again.';
  let displayed: AudioState | undefined, transientCaption: number | undefined;
  const clearCaption = () => {
    document.defaultView?.clearTimeout(transientCaption); transientCaption = undefined;
    displayed = undefined; caption.textContent = ''; caption.tabIndex = -1;
  };
  const scheduleCaption = () => {
    document.defaultView?.clearTimeout(transientCaption); transientCaption = undefined;
    if (displayed && !document.hidden && room !== media.composition.roomId && displayed.channel !== 'voice') {
      transientCaption = document.defaultView?.setTimeout(() => {
        if (!document.hidden && document.activeElement !== caption) clearCaption();
      }, 3500);
    }
  };
  const showCaption = (state: AudioState) => {
    displayed = state; caption.textContent = state.text; caption.tabIndex = 0; caption.hidden = !settings.captions;
    scheduleCaption();
  };
  const update = (state: AudioState) => {
    const changed = state.status !== cueStatuses.get(state.id);
    cueStatuses.set(state.id, state.status);
    const row = rows.get(state.id); if (row) { row.status.textContent = state.status === 'awaiting-gesture' ? 'Select Replay to enable sound.' : state.status === 'unavailable' ? 'Audio unavailable. The transcript remains available.' : state.status; row.element.dataset['audioStatus'] = state.status; }
    if (!document.hidden && room !== media.composition.roomId && changed && displayed?.id === state.id && document.activeElement !== caption && ['stopped','disposed','ended'].includes(state.status)) clearCaption();
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
  const startCue = (id: string) => {
    const handle = handles.get(id)!;
    // Captions describe a cue even when the volume is zero or native playback fails.
    // Late media promises must not replace the caption for a newer interaction.
    if (!document.hidden) {
      if (status.textContent === interrupted) status.textContent = '';
      showCaption(handle.snapshot());
    }
    void handle.play();
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
    handles.get(id)!.stop(); startCue(id);
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
  root.append(details, caption, status); host.replaceChildren(root);
  const applySettings = (next: PresentationSettings) => {
    if (disposed) return;
    const previous = settings; settings = next; caption.hidden = !next.captions;
    if (previous.musicVolume !== next.musicVolume || previous.effectsVolume !== next.effectsVolume || previous.voiceVolume !== next.voiceVolume) {
      adapter.setVolumes(volumesFromSettings(next));
    }
  };
  observeVisibility(document, events.signal, hidden => {
    if (hidden && [...cueStatuses.values()].some(state => state === 'loading' || state === 'playing')) status.textContent = interrupted;
    adapter.setSuspended(hidden);
    scheduleCaption();
  });
  return {
    settingsHost, applySettings,
    show(nextRoom: string | null, next: PresentationSettings, runtime?: RuntimeState) {
      if (disposed) return;
      applySettings(next);
      if (nextRoom !== room || runtime?.game?.adventureId !== previous?.game?.adventureId || runtime?.game?.world.attemptId !== previous?.game?.world.attemptId) {
        clearContext(); activeCues = roomCues(nextRoom, registry);
        room = nextRoom; for (const handle of handles.values()) handle.stop(); clearCaption(); status.textContent = '';
        const arrival = new Set(['arrival']);
        if (runtime?.game?.world.completedObjectiveIds.some(id => String(id) === 'spec001:O10')) arrival.add('return-with-repair-preparation');
        reveal(arrival);
        if (room === media.composition.roomId) for (const cue of media.composition.audio.filter(c => c.trigger === 'arrival')) startCue(cue.assetId);
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
