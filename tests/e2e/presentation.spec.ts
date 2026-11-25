// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import { localTls } from './support/local-tls';
import type { AudioAdapter, AudioCueHandle } from '../../src/presentation/audio';
import type { RoomAdapter, RoomView } from '../../src/presentation/room-adapter';
import type { ActionBus, ActionContext } from '../../src/ui/action-bus';

declare global {
  interface Window {
    presentationFixture: { adapter: RoomAdapter<string>; view: RoomView; bus: ActionBus; handled: number; cleanup(): void };
    audioFixture: { audio: AudioAdapter; cue: AudioCueHandle };
    audioNonGestureReady(): Promise<void>;
  }
}

test.describe('presentation adapters in a trusted local browser', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page;
  test.beforeAll(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false }); }
    catch (error) { await local.stop(); throw error; }
  });
  test.afterAll(async () => { try { await context?.close(); } finally { await local?.stop(); } });
  test.beforeEach(async () => {
    page = await context.newPage();
    expect([200, 304]).toContain((await page.goto(local.url))?.status());
  });
  test.afterEach(async () => { await page?.close(); });

  test('missing visuals and retry/text updates retain semantic controls and the original action scope', async () => {
    await page.evaluate(async base => {
      const { createRoomAdapter } = await import(`${base}src/presentation/room-adapter.ts`) as typeof import('../../src/presentation/room-adapter');
      const { createResourcePool } = await import(`${base}src/presentation/resource-pool.ts`) as typeof import('../../src/presentation/resource-pool');
      const { createActionBus } = await import(`${base}src/ui/action-bus.ts`) as typeof import('../../src/ui/action-bus');
      const { createAppShell } = await import(`${base}src/ui/app-shell.ts`) as typeof import('../../src/ui/app-shell');
      const current: ActionContext = { adventureId: 'fixture-adventure' as ActionContext['adventureId'], attemptId: 'fixture-attempt' as ActionContext['attemptId'], configurationRevision: 1 as ActionContext['configurationRevision'] };
      const bus = createActionBus({ getContext: () => current });
      const host = document.querySelector('main')!; host.replaceChildren();
      const shell = createAppShell(host, bus);
      const pool = createResourcePool<string>({ maxEntries: 2, maxInFlight: 1, maxPrefetch: 1, maxLeases: 3, maxBytes: 100 });
      const view: RoomView = { roomId: 'spec001:R01' as RoomView['roomId'], context: current,
        title: 'Presentation adapter fixture', description: 'Synthetic lifecycle test; no authored room or scored gameplay.',
        controls: [{ id: 'look', label: 'Look', action: { kind: 'select-verb', verb: 'look' } }], objects: [],
        evidence: [{ id: 'text', label: 'Visible evidence', text: 'This evidence survives missing art.', source: 'Test fixture', freshness: 'observation' }], captions: [] };
      const adapter = createRoomAdapter({ pool, dispatcher: bus, onView: (model, capture) => { if (model) shell.render(model, capture); else shell.dispose(); } });
      window.presentationFixture = { adapter, view, bus, handled: 0, cleanup() { adapter.dispose(); bus.dispose(); pool.dispose(); } };
      bus.register('select-verb', () => { window.presentationFixture.handled++; return { status: 'handled' }; });
      adapter.show(view, { mode: 'three', detail: 'default', reducedMotion: true });
    }, new URL(local.url).pathname);
    await expect(page.getByText('This evidence survives missing art.')).toBeVisible();
    await expect(page.getByText(/Visual presentation unavailable/)).toBeVisible();
    await page.getByRole('button', { name: 'Look', exact: true }).focus();
    await page.keyboard.press('Enter');
    expect(await page.evaluate(() => window.presentationFixture.handled)).toBe(1);
    await page.evaluate(() => { const f = window.presentationFixture; f.bus.invalidate(); f.adapter.retry(); f.adapter.setMode('text'); });
    await page.getByRole('button', { name: 'Look', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText('The adventure has changed. Choose the action again.');
    expect(await page.evaluate(() => window.presentationFixture.handled)).toBe(1);
    await page.evaluate(() => { const f = window.presentationFixture; f.adapter.show(f.view); });
    await page.getByRole('button', { name: 'Look', exact: true }).click();
    expect(await page.evaluate(() => window.presentationFixture.handled)).toBe(2);
    await page.evaluate(() => window.presentationFixture.cleanup());
    await expect(page.getByRole('button', { name: 'Look', exact: true })).toHaveCount(0);
  });

  test('native audio makes no request before activation and retains text after corrupt media fails', async () => {
    let requests = 0;
    let ready!: () => void;
    const nonGestureReady = new Promise<void>(resolve => { ready = resolve; });
    await page.exposeFunction('audioNonGestureReady', ready);
    page.on('request', request => { if (request.url().endsWith('/fixture-corrupt.ogg')) requests++; });
    await page.route('**/fixture-corrupt.ogg', route => route.fulfill({ status: 200, contentType: 'audio/ogg', body: 'Deliberately invalid test media; not a production audio asset.' }));
    await page.evaluate(async base => {
      const { createAudioAdapter, createHtmlAudioBackend } = await import(`${base}src/presentation/audio.ts`) as typeof import('../../src/presentation/audio');
      const host = document.querySelector('main')!; host.replaceChildren();
      const transcript = document.createElement('p'), status = document.createElement('output'), play = document.createElement('button');
      transcript.textContent = 'This spoken instruction remains available as text.'; play.textContent = 'Play fixture voice';
      status.setAttribute('aria-label', 'Audio state'); host.append(transcript, status, play);
      const audio = createAudioAdapter({ backend: createHtmlAudioBackend(document), volumes: { music: 0.3, effects: 0.5, voice: 0.8 }, maxCues: 1, maxVoices: 1, maxPendingPlays: 1,
        onChange(state) { status.textContent = state.status; } });
      const cue = audio.present({ id: 'voice', channel: 'voice', text: transcript.textContent, src: `${base}fixture-corrupt.ogg` });
      play.addEventListener('click', () => { void cue.play(); });
      window.audioFixture = { audio, cue };
      // Playwright evaluation grants transient activation. Exercise the real
      // non-gesture path only after that activation expires, from a browser task.
      const beforeGesture = () => {
        if (navigator.userActivation.isActive) { window.setTimeout(beforeGesture, 50); return; }
        void cue.play().then(() => window.audioNonGestureReady());
      };
      window.setTimeout(beforeGesture, 0);
    }, new URL(local.url).pathname);
    // Locator polling also evaluates in the page and renews automation activation.
    // Wait for the browser's own callback without injecting another evaluation.
    await nonGestureReady;
    await expect(page.getByLabel('Audio state')).toHaveText('awaiting-gesture', { timeout: 10_000 });
    expect(requests).toBe(0);
    expect(await page.evaluate(() => window.audioFixture.audio.stats().voices)).toBe(0);
    await page.getByRole('button', { name: 'Play fixture voice' }).click();
    await expect(page.getByLabel('Audio state')).toHaveText('unavailable');
    expect(requests).toBeGreaterThan(0);
    await expect(page.getByText('This spoken instruction remains available as text.')).toBeVisible();
    expect(await page.evaluate(() => window.audioFixture.cue.snapshot().reason)).toBe('playback-failed');
    await page.evaluate(() => window.audioFixture.audio.dispose());
    expect(await page.evaluate(() => window.audioFixture.audio.stats())).toMatchObject({ cues: 0, voices: 0, pendingPlays: 0, disposed: true });
  });
});
