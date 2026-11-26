// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { PresentationSettings } from '../state/types';
import { createAudioAdapter, createHtmlAudioBackend, volumesFromSettings, type AudioState } from './audio';
import { publicMediaUrl, type RoomMedia } from './room-media';

/** Optional reviewed playback with permanent transcripts. No progress or save authority. */
export function createRoomAudioPanel(host: HTMLElement, media: RoomMedia, gameBase: string, change: (settings: PresentationSettings) => void, refresh: () => void) {
  const document = host.ownerDocument, events = new AbortController();
  let settings: PresentationSettings = { musicVolume: 1, effectsVolume: 1, voiceVolume: 1, captions: true, reducedMotion: 'system', textScale: 1 }, room: string | null | undefined, disposed = false;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K) => document.createElement(tag);
  const root = node('section'); root.className = 'nq-media'; root.setAttribute('aria-label', 'Sound and reading');
  const details = node('details'), summary = node('summary'); summary.textContent = 'Sound and reading'; details.append(summary);
  const status = node('p'); status.setAttribute('role', 'status');
  const caption = node('p'); caption.className = 'nq-media-caption'; caption.setAttribute('aria-live', 'off');
  const refreshButton = node('button'); refreshButton.type = 'button'; refreshButton.textContent = 'Reload account presentation preferences';
  refreshButton.addEventListener('click', refresh, { signal: events.signal });
  const preferencesStatus = node('p'); preferencesStatus.className = 'nq-media-preferences-status';
  const rows = new Map<string, { element: HTMLElement; status: HTMLElement; replay: HTMLButtonElement }>();
  const update = (state: AudioState) => {
    const row = rows.get(state.id); if (row) { row.status.textContent = state.status === 'awaiting-gesture' ? 'Select Replay to enable sound.' : state.status === 'unavailable' ? 'Audio unavailable. The transcript remains available.' : state.status; row.element.dataset['audioStatus'] = state.status; }
    if (['playing', 'loading', 'awaiting-gesture'].includes(state.status)) { caption.textContent = state.text; caption.hidden = !settings.captions; }
    if (state.status === 'unavailable' || state.status === 'awaiting-gesture') status.textContent = state.status === 'unavailable' ? 'Audio unavailable. Read the transcript or retry playback.' : 'Sound waits for your choice. Select a Replay button.';
  };
  const adapter = createAudioAdapter({ backend: createHtmlAudioBackend(document), volumes: volumesFromSettings(settings), maxCues: 6, maxVoices: 3, maxPendingPlays: 3, onChange: update });
  const handles = new Map(media.composition.audio.map(cue => [cue.assetId, adapter.present({ id: cue.assetId, channel: cue.channel, src: publicMediaUrl(media.bindings.get(cue.assetId)!, gameBase), text: cue.text, loop: false })]));
  const stopVoice = () => { for (const cue of media.composition.audio) if (cue.channel === 'voice') handles.get(cue.assetId)!.stop(); };
  const play = (id: string) => { const cue = media.composition.audio.find(c => c.assetId === id)!; if (cue.channel === 'voice') stopVoice(); const handle = handles.get(id)!; handle.stop(); void handle.play(); };
  for (const cue of media.composition.audio) {
    const section = node('div'); section.className = 'nq-media-cue'; section.dataset['assetId'] = cue.assetId; section.dataset['exportPath'] = media.bindings.get(cue.assetId)!.exportPath;
    const label = cue.channel === 'music' ? 'Title theme · 20-second excerpt' : cue.assetId.endsWith('VOICE-001') ? 'Narrator' : cue.assetId.endsWith('VOICE-035') ? 'Photon' : cue.trigger === 'arrival' ? 'Lift latch' : cue.trigger === 'photon' ? 'Photon glimmer' : 'Control click';
    const heading = node('strong'); heading.textContent = label;
    const transcript = node('p'); transcript.textContent = cue.text;
    const replay = node('button'); replay.type = 'button'; replay.textContent = `Replay ${label.split(' ·')[0]}`;
    replay.addEventListener('click', () => play(cue.assetId), { signal: events.signal });
    const skip = node('button'); skip.type = 'button'; skip.textContent = `Skip ${label.split(' ·')[0]}`;
    skip.addEventListener('click', () => handles.get(cue.assetId)!.stop(), { signal: events.signal });
    const cueStatus = node('span'); cueStatus.textContent = 'idle'; section.append(heading, transcript, replay, skip, cueStatus); details.append(section); rows.set(cue.assetId, { element: section, status: cueStatus, replay });
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
    show(nextRoom: string | null, next: PresentationSettings, preferenceMessage: string, account: { authenticated: boolean; busy: boolean; reviewRequired: boolean }) {
      if (disposed) return; settings = next; root.style.fontSize = `${next.textScale}rem`; adapter.setVolumes(volumesFromSettings(next)); caption.hidden = !next.captions; preferencesStatus.textContent = preferenceMessage; refreshButton.hidden = !account.authenticated; refreshButton.disabled = account.busy;
      for (const [key, control] of inputs) { control.disabled = account.busy || account.reviewRequired; if (key === 'captions') (control as HTMLInputElement).checked = next.captions; else control.value = String(next[key as keyof PresentationSettings]); const output = control.parentElement?.querySelector('output'); if (output) output.textContent = `${Math.round(Number(control.value) * 100)}%`; }
      if (nextRoom !== room) {
        room = nextRoom; for (const handle of handles.values()) handle.stop(); caption.textContent = ''; status.textContent = '';
        if (room === media.composition.roomId) for (const cue of media.composition.audio.filter(c => c.trigger === 'arrival')) void handles.get(cue.assetId)!.play();
      }
      for (const cue of media.composition.audio) rows.get(cue.assetId)!.element.hidden = cue.trigger !== 'title' && room !== media.composition.roomId;
    },
    trigger(trigger: 'photon' | 'control') { if (disposed || room !== media.composition.roomId) return; for (const cue of media.composition.audio.filter(c => c.trigger === trigger)) play(cue.assetId); },
    stopVoice,
    dispose() { if (disposed) return; disposed = true; events.abort(); adapter.dispose(); root.remove(); },
  };
}
