// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { PresentationSettings } from '../state/types';
import { boundedPlayback } from './recovery';

export type AudioChannel = 'music' | 'effects' | 'voice';
export type AudioVolumes = Readonly<Record<AudioChannel, number>>;
export interface AudioCue {
  readonly id: string;
  readonly channel: AudioChannel;
  readonly src: string | null;
  /** Always available, even with captions hidden, no source, mute, error or autoplay denial. */
  readonly text: string;
  readonly loop?: boolean;
}
export interface AudioVoice {
  play(): Promise<void>;
  pause(): void;
  setVolume(volume: number): void;
  listen(events: { ended(): void; error(error: unknown): void }): () => void;
  dispose(): void;
}
export interface AudioBackend {
  userActivated(): boolean;
  /** Synchronous to preserve transient browser activation; create does not play. */
  create(cue: AudioCue): AudioVoice;
}
export interface AudioState {
  readonly id: string; readonly channel: AudioChannel; readonly text: string; readonly volume: number;
  readonly status: 'idle' | 'awaiting-gesture' | 'muted' | 'loading' | 'playing' | 'paused' | 'ended' | 'stopped' | 'unavailable' | 'disposed';
  readonly reason?: 'gesture' | 'missing-source' | 'playback-failed' | 'capacity' | 'suspended';
}
export interface AudioCueHandle {
  snapshot(): AudioState;
  /** Call directly from a user event initially. Rejections become honest status, never progress. */
  play(): Promise<AudioState>;
  pause(): void;
  /** Skip narration/music without removing its transcript. play() explicitly replays it. */
  stop(): void;
  dispose(): void;
}
export interface AudioOptions {
  readonly backend: AudioBackend;
  readonly volumes: AudioVolumes;
  readonly maxCues: number;
  readonly maxVoices: number;
  readonly maxPendingPlays: number;
  readonly onChange?: (state: AudioState) => void;
  readonly onError?: (error: unknown) => void;
}
function checkedVolumes(input: AudioVolumes): AudioVolumes {
  for (const channel of ['music', 'effects', 'voice'] as const) {
    if (!Number.isFinite(input[channel]) || input[channel] < 0 || input[channel] > 1) throw new RangeError(`Invalid ${channel} volume`);
  }
  return Object.freeze({ ...input });
}
export function volumesFromSettings(settings: PresentationSettings): AudioVolumes {
  return checkedVolumes({ music: settings.musicVolume, effects: settings.effectsVolume, voice: settings.voiceVolume });
}

/** No reducer, action bus, clock, persistence or AI is exposed to audio completion. */
export function createAudioAdapter(options: AudioOptions) {
  for (const limit of [options.maxCues, options.maxVoices, options.maxPendingPlays]) {
    if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid audio capacity');
  }
  let volumes = checkedVolumes(options.volumes), disposed = false, suspended = false, unlocked = false, voices = 0, pendingPlays = 0;
  const cues = new Map<string, { handle: AudioCueHandle; updateVolume(): void }>();
  const report = (error: unknown) => { try { options.onError?.(error); } catch { /* cleanup must continue */ } };
  const safely = (work: () => void) => { try { work(); } catch (error) { report(error); } };
  return Object.freeze({
    present(input: AudioCue, ownership: { readonly signal?: AbortSignal } = {}): AudioCueHandle {
      if (disposed) throw new Error('Audio adapter disposed');
      if (ownership.signal?.aborted) throw new Error('Audio owner already aborted');
      if (!input.id.trim() || !input.text.trim() || !(['music', 'effects', 'voice'] as const).includes(input.channel)) throw new Error('Invalid audio cue or missing text');
      if (cues.has(input.id)) throw new Error('Audio cue already owned');
      if (cues.size >= options.maxCues) throw new Error('Audio cue capacity reached');
      const cue = Object.freeze({ ...input });
      let state: AudioState = Object.freeze({ id: cue.id, channel: cue.channel, text: cue.text, volume: volumes[cue.channel], status: 'idle' });
      let voice: AudioVoice | null = null, removeEvents: (() => void) | null = null, generation = 0;
      let pending: Promise<AudioState> | null = null, closed = false;
      const emit = (status: AudioState['status'], reason?: AudioState['reason']) => {
        state = Object.freeze({ id: cue.id, channel: cue.channel, text: cue.text, volume: volumes[cue.channel], status, ...(reason ? { reason } : {}) });
        safely(() => options.onChange?.(state)); return state;
      };
      function releaseVoice() {
        generation++; pending = null;
        const old = voice; voice = null;
        const remove = removeEvents; removeEvents = null;
        if (remove) safely(remove);
        if (old) { voices--; safely(() => old.pause()); safely(() => old.dispose()); }
      }
      function playbackFailed(error: unknown) {
        releaseVoice(); report(error);
        if (closed) return state;
        const denied = typeof error === 'object' && error !== null && 'name' in error && error.name === 'NotAllowedError';
        if (denied) unlocked = false;
        return emit(denied ? 'awaiting-gesture' : 'unavailable', denied ? 'gesture' : 'playback-failed');
      }
      const handle: AudioCueHandle = Object.freeze({
        snapshot: () => state,
        play() {
          if (closed) return Promise.resolve(state);
          if (suspended) return Promise.resolve(emit('paused', 'suspended'));
          if (!cue.src) return Promise.resolve(emit('unavailable', 'missing-source'));
          if (volumes[cue.channel] === 0) return Promise.resolve(emit('muted'));
          if (pending) return pending;
          if (state.status === 'playing') return Promise.resolve(state);
          if (!unlocked && !options.backend.userActivated()) return Promise.resolve(emit('awaiting-gesture', 'gesture'));
          if (pendingPlays >= options.maxPendingPlays || (!voice && voices >= options.maxVoices)) return Promise.resolve(emit('unavailable', 'capacity'));
          try {
            if (!voice) {
              voice = options.backend.create(cue); voices++;
              const created = voice;
              removeEvents = voice.listen({
                ended() { if (!closed && voice === created) { releaseVoice(); emit('ended'); } },
                error(error) { if (!closed && voice === created) playbackFailed(error); },
              });
            }
            voice.setVolume(volumes[cue.channel]);
            const playingVoice = voice, token = ++generation;
            emit('loading');
            // Feedback may synchronously revoke ownership, pause, mute or hide the page.
            if (closed || generation !== token || voice !== playingVoice || suspended || state.status !== 'loading' || volumes[cue.channel] === 0) return Promise.resolve(state);
            pendingPlays++;
            let started: Promise<void>;
            // This call deliberately occurs before any await/microtask boundary.
            try { started = playingVoice.play(); } catch (error) { started = Promise.reject(error); }
            const completion = boundedPlayback(started).then(() => {
              if (!closed && generation === token && voice === playingVoice) { unlocked = true; return emit('playing'); }
              return state;
            }, error => {
              if (!closed && generation === token && voice === playingVoice) return playbackFailed(error);
              return state;
            }).finally(() => { pendingPlays--; if (pending === completion) pending = null; });
            pending = completion;
            return completion;
          } catch (error) { return Promise.resolve(playbackFailed(error)); }
        },
        pause() {
          if (closed) return;
          if (pending) releaseVoice(); // canceled start cannot resume later behind the user's back
          else if (voice) safely(() => voice?.pause());
          emit('paused');
        },
        stop() { if (!closed) { releaseVoice(); emit('stopped'); } },
        dispose() {
          if (closed) return;
          closed = true; ownership.signal?.removeEventListener('abort', handle.dispose);
          releaseVoice(); cues.delete(cue.id); emit('disposed');
        },
      });
      cues.set(cue.id, { handle, updateVolume() {
        if (voice) {
          try { voice.setVolume(volumes[cue.channel]); } catch (error) { playbackFailed(error); return; }
        }
        if (volumes[cue.channel] === 0 && voice) { releaseVoice(); emit('muted'); }
        else emit(state.status, state.reason);
      } });
      ownership.signal?.addEventListener('abort', handle.dispose, { once: true });
      emit('idle');
      return handle;
    },
    setVolumes(next: AudioVolumes) { if (disposed) return; volumes = checkedVolumes(next); for (const cue of cues.values()) cue.updateVolume(); },
    /** Hook visibility at application level. Becoming visible leaves explicit Resume available. */
    setSuspended(value: boolean) {
      if (disposed) return;
      suspended = value;
      if (value) for (const cue of cues.values()) if (['playing', 'loading'].includes(cue.handle.snapshot().status)) cue.handle.pause();
    },
    stats() { return Object.freeze({ cues: cues.size, voices, pendingPlays, suspended, disposed }); },
    dispose() { if (!disposed) { disposed = true; for (const cue of [...cues.values()]) cue.handle.dispose(); } },
  });
}
export type AudioAdapter = ReturnType<typeof createAudioAdapter>;

/** Native optional playback. Browser policy still decides play(); denied/failed promises are handled above. */
export function createHtmlAudioBackend(document: Document): AudioBackend {
  return Object.freeze({
    userActivated: () => document.defaultView?.navigator.userActivation?.isActive === true,
    create(cue: AudioCue): AudioVoice {
      if (!cue.src) throw new Error('Audio source unavailable');
      const media = document.createElement('audio');
      media.preload = 'none'; media.src = cue.src; media.loop = cue.loop ?? false;
      let disposed = false;
      const removals = new Set<() => void>();
      return Object.freeze({
        play() { return disposed ? Promise.reject(new Error('Audio voice disposed')) : media.play(); },
        pause() { media.pause(); },
        setVolume(volume: number) { media.volume = volume; },
        listen(events: { ended(): void; error(error: unknown): void }) {
          if (disposed) throw new Error('Audio voice disposed');
          const ended = () => events.ended(), error = () => events.error(media.error ?? new Error('Audio media unavailable'));
          let active = true;
          media.addEventListener('ended', ended); media.addEventListener('error', error);
          const remove = () => {
            if (!active) return;
            active = false; media.removeEventListener('ended', ended); media.removeEventListener('error', error); removals.delete(remove);
          };
          removals.add(remove); return remove;
        },
        dispose() {
          if (disposed) return;
          disposed = true; for (const remove of [...removals]) remove();
          media.pause(); media.removeAttribute('src'); media.load();
        },
      });
    },
  });
}
