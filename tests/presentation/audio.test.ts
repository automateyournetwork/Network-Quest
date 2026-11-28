// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { MEDIA_LOAD_TIMEOUT_MS } from '../../src/presentation/recovery';
import { createAudioAdapter, createHtmlAudioBackend, type AudioBackend, type AudioCue, type AudioVoice } from '../../src/presentation/audio';

function deferred() {
  let resolve!: () => void, reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
function fixture() {
  let activated = false;
  const created: { voice: AudioVoice; pending: ReturnType<typeof deferred>; events: { ended(): void; error(error: unknown): void }; remove: ReturnType<typeof vi.fn> }[] = [];
  const backend: AudioBackend = { userActivated: () => activated, create: vi.fn(() => {
    const pending = deferred(), remove = vi.fn();
    const instance = { pending, remove, events: { ended() {}, error(_error: unknown) {} }, voice: undefined as unknown as AudioVoice };
    instance.voice = { play: vi.fn(() => pending.promise), pause: vi.fn(), setVolume: vi.fn(), listen(events) { instance.events = events; return remove; }, dispose: vi.fn() };
    created.push(instance); return instance.voice;
  }) };
  const audio = createAudioAdapter({ backend, maxCues: 3, maxVoices: 2, maxPendingPlays: 2,
    volumes: { music: 0.2, effects: 0.5, voice: 0.8 } });
  const cue = (id: string, channel: AudioCue['channel'] = 'voice', src: string | null = '/fixture.ogg'): AudioCue => ({ id, channel, src, text: `Transcript ${id}` });
  return { audio, created, backend, cue, activate: () => { activated = true; } };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('audio is optional presentation', () => {
  it('releases a stalled voice at the deadline and ignores its late success after explicit replay', async () => {
    vi.useFakeTimers();
    const f = fixture();
    try {
      f.activate(); const cue = f.audio.present(f.cue('reading'));
      const first = cue.play();
      await vi.advanceTimersByTimeAsync(MEDIA_LOAD_TIMEOUT_MS);
      expect(await first).toMatchObject({ status: 'unavailable', text: 'Transcript reading' });
      expect(f.created[0]!.voice.dispose).toHaveBeenCalledTimes(1);
      expect(f.audio.stats()).toMatchObject({ voices: 0, pendingPlays: 0 });
      const retry = cue.play(); f.created[1]!.pending.resolve();
      expect((await retry).status).toBe('playing');
      f.created[0]!.pending.resolve(); f.created[0]!.events.ended(); await tick();
      expect(cue.snapshot().status).toBe('playing');
      expect(vi.getTimerCount()).toBe(0);
    } finally { f.audio.dispose(); vi.useRealTimers(); }
  });
  it('retains text without creating/loading audio before a user gesture or when missing/muted', async () => {
    const f = fixture(); const voice = f.audio.present(f.cue('voice'));
    expect(voice.snapshot().text).toBe('Transcript voice');
    expect((await voice.play()).status).toBe('awaiting-gesture'); expect(f.backend.create).not.toHaveBeenCalled();
    f.activate(); f.audio.setVolumes({ music: 0.2, effects: 0.5, voice: 0 });
    expect((await voice.play()).status).toBe('muted'); expect(voice.snapshot().text).toBe('Transcript voice');
    const absent = f.audio.present(f.cue('absent', 'effects', null));
    expect((await absent.play()).status).toBe('unavailable'); expect(absent.snapshot().text).toBe('Transcript absent');
    expect(f.backend.create).not.toHaveBeenCalled(); f.audio.dispose();
  });
  it('invokes playback synchronously within activation and independently applies all channel levels', async () => {
    const f = fixture(); f.activate();
    const music = f.audio.present(f.cue('music', 'music')), voice = f.audio.present(f.cue('voice'));
    const a = music.play(); expect(f.created[0]?.voice.play).toHaveBeenCalledTimes(1);
    const b = voice.play(); expect(f.created[0]?.voice.setVolume).toHaveBeenCalledWith(0.2); expect(f.created[1]?.voice.setVolume).toHaveBeenCalledWith(0.8);
    f.created[0]?.pending.resolve(); f.created[1]?.pending.resolve(); await Promise.all([a, b]);
    f.audio.setVolumes({ music: 0.1, effects: 0.6, voice: 0.7 });
    expect(f.created[0]?.voice.setVolume).toHaveBeenLastCalledWith(0.1); expect(f.created[1]?.voice.setVolume).toHaveBeenLastCalledWith(0.7);
    expect(() => f.audio.setVolumes({ music: 2, effects: 0, voice: 0 })).toThrow(/volume/);
    expect(voice.snapshot().volume).toBe(0.7); f.audio.dispose();
  });
  it('reports autoplay denial and permits explicit retry without hiding text', async () => {
    const f = fixture(); f.activate(); const cue = f.audio.present(f.cue('voice')); const first = cue.play();
    f.created[0]?.pending.reject(new DOMException('Blocked', 'NotAllowedError'));
    expect((await first).status).toBe('awaiting-gesture'); expect(f.created[0]?.voice.dispose).toHaveBeenCalledTimes(1);
    const retry = cue.play(); f.created[1]?.pending.resolve(); expect((await retry).status).toBe('playing');
    f.created[1]?.events.ended(); expect(cue.snapshot()).toMatchObject({ status: 'ended', text: 'Transcript voice' });
    f.audio.dispose(); expect(f.created[1]?.voice.dispose).toHaveBeenCalledTimes(1);
  });
  it('aborts pending playback, ignores late successes and removes every listener once', async () => {
    const f = fixture(); f.activate(); const abort = new AbortController();
    const cue = f.audio.present(f.cue('voice'), { signal: abort.signal }); const pending = cue.play();
    abort.abort(); expect(cue.snapshot().status).toBe('disposed'); expect(f.created[0]?.voice.pause).toHaveBeenCalled();
    f.created[0]?.pending.resolve(); await pending;
    expect(cue.snapshot().status).toBe('disposed'); expect(f.created[0]?.voice.dispose).toHaveBeenCalledTimes(1);
    expect(f.created[0]?.remove).toHaveBeenCalledTimes(1); expect(f.audio.stats()).toMatchObject({ cues: 0, voices: 0, pendingPlays: 0 });
    f.audio.dispose();
  });
  it('bounds active cues/voices and pending plays even after ignored cancellation', async () => {
    const f = fixture(); f.activate();
    const a = f.audio.present(f.cue('a')), b = f.audio.present(f.cue('b')), c = f.audio.present(f.cue('c'));
    expect(() => f.audio.present(f.cue('d'))).toThrow(/capacity/);
    const pa = a.play(), pb = b.play(); expect((await c.play()).reason).toBe('capacity');
    a.stop(); b.stop(); expect((await c.play()).reason).toBe('capacity');
    f.created[0]?.pending.resolve(); f.created[1]?.pending.resolve(); await Promise.all([pa, pb]);
    const pc = c.play(); f.created[2]?.pending.resolve(); expect((await pc).status).toBe('playing'); f.audio.dispose();
  });
  it('pauses hidden playback without automatically restarting on visibility or ending a lesson', async () => {
    const f = fixture(); f.activate(); const cue = f.audio.present(f.cue('voice')); const playing = cue.play();
    f.created[0]?.pending.resolve(); await playing;
    f.audio.setSuspended(true); expect(cue.snapshot().status).toBe('paused');
    expect((await cue.play()).reason).toBe('suspended');
    f.audio.setSuspended(false); expect(cue.snapshot().status).toBe('paused');
    expect(f.created[0]?.voice.play).toHaveBeenCalledTimes(1);
    await cue.play(); expect(f.created[0]?.voice.play).toHaveBeenCalledTimes(2);
    cue.stop(); expect(cue.snapshot().status).toBe('stopped'); expect(cue.snapshot().text).toBe('Transcript voice'); f.audio.dispose();
  });
  it('handles later decode errors and stale events without reviving stopped cues', async () => {
    const f = fixture(); f.activate(); const cue = f.audio.present(f.cue('voice')); const pending = cue.play();
    f.created[0]?.pending.resolve(); await pending;
    f.created[0]?.events.error(new Error('stream failed')); expect(cue.snapshot().status).toBe('unavailable');
    const retry = cue.play(); f.created[0]?.events.ended(); expect(cue.snapshot().status).toBe('loading');
    f.created[1]?.pending.resolve(); await retry; cue.dispose(); cue.dispose();
    expect(f.created[1]?.remove).toHaveBeenCalledTimes(1); f.audio.dispose();
  });
  it('native port uses browser media events and releases source/listeners without autoplay', async () => {
    const listeners = new Map<string, EventListener>();
    const element = { preload: '', src: '', loop: false, volume: 1, play: vi.fn(async () => {}), pause: vi.fn(), load: vi.fn(), removeAttribute: vi.fn(),
      addEventListener: vi.fn((name: string, callback: EventListener) => listeners.set(name, callback)),
      removeEventListener: vi.fn((name: string) => listeners.delete(name)), error: null };
    const document = { createElement: vi.fn(() => element), defaultView: { navigator: { userActivation: { isActive: false } } } } as unknown as Document;
    const backend = createHtmlAudioBackend(document); expect(backend.userActivated()).toBe(false);
    const voice = backend.create({ id: 'native', channel: 'effects', text: 'Text cue', src: '/fixture.ogg', loop: true });
    expect(element.preload).toBe('none'); expect(element.play).not.toHaveBeenCalled();
    const ended = vi.fn(), error = vi.fn(); const remove = voice.listen({ ended, error });
    listeners.get('ended')?.(new Event('ended')); expect(ended).toHaveBeenCalledTimes(1);
    await voice.play(); voice.setVolume(0.3); expect(element.volume).toBe(0.3);
    remove(); voice.dispose(); voice.dispose();
    expect(listeners.size).toBe(0); expect(element.removeAttribute).toHaveBeenCalledExactlyOnceWith('src'); expect(element.load).toHaveBeenCalledTimes(1);
    await tick();
  });
  it.each(['dispose', 'stop', 'pause', 'suspend', 'mute'] as const)('does not invoke play after synchronous loading feedback chooses %s', async choice => {
    const f = fixture(); f.activate();
    let handle: ReturnType<typeof f.audio.present>;
    const audio = createAudioAdapter({ backend: f.backend, maxCues: 1, maxVoices: 1, maxPendingPlays: 1, volumes: { music: 1, effects: 1, voice: 1 },
      onChange(state) {
        if (state.status !== 'loading') return;
        if (choice === 'dispose') handle.dispose();
        if (choice === 'stop') handle.stop();
        if (choice === 'pause') handle.pause();
        if (choice === 'suspend') audio.setSuspended(true);
        if (choice === 'mute') audio.setVolumes({ music: 1, effects: 1, voice: 0 });
      } });
    handle = audio.present(f.cue('cancel-from-feedback'));
    const playing = handle.play();
    expect(f.created[0]?.voice.play).not.toHaveBeenCalled();
    expect(audio.stats().pendingPlays).toBe(0); await playing; audio.dispose(); f.audio.dispose();
  });
});
