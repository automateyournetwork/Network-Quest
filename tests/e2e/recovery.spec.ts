// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test as nativeTest, type Page } from '@playwright/test';
import { clickButton, closeFrame, openFrame } from './support/adventure-controls';
import { test as guestTest } from './support/outcome-journey';
import { withNativeChromiumTabs } from './support/native-chromium-tabs';
import { button, dialog, expect, test } from './support/t056-journey';

const presentation = (page: Page) => page.locator('.nq-graybox');
const evidence = (page: Page) => page.locator('.nq-shell-evidence');

async function readIndicators(page: Page) {
  await clickButton(page, 'Look');
  await clickButton(page, 'Look at power indication');
  await clickButton(page, 'Look at link indication');
  await openFrame(page, 'Evidence');
  for (const label of ['Power indication', 'Link indication'])
    await expect(evidence(page).locator('li').filter({ hasText: label })).toHaveCount(1);
  const facts = await evidence(page).innerText();
  await closeFrame(page);
  return facts;
}

for (const fault of [
  { name: 'image returns 503', path: '**/assets/images/R01/midground.png', status: 503, type: 'text/plain' },
  { name: 'model bytes fail decoding', path: '**/assets/models/R01-architecture.glb', status: 200, type: 'model/gltf-binary' },
]) test(`T146 ${fault.name}: play in text and retry the same unsaved room`, async ({ journey: j }) => {
  let intercepted = 0;
  const page = j.page;
  await page.route(fault.path, route => { intercepted++; return route.fulfill({ status: fault.status, contentType: fault.type, body: 'unavailable model or image' }); });
  await j.start(page, { textFallback: true });
  expect(intercepted).toBeGreaterThan(0);
  await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
  await expect(page.locator('.nq-shell-description')).toContainText('POWER lit, LINK unlit');
  const facts = await readIndicators(page);
  await j.notes('The power and link observations still disagree.');
  await page.unroute(fault.path);
  await clickButton(page, 'Retry visual scene');
  await expect(presentation(page)).toHaveAttribute('data-rendered', 'true');
  await expect(presentation(page).locator('[data-safe-position]')).toHaveAttribute('data-safe-position', 'spec001:R01.entry');
  await openFrame(page, 'Evidence');
  await expect(evidence(page)).toHaveText(facts, { useInnerText: true });
  await closeFrame(page);
  await j.expectNotes('The power and link observations still disagree.');
  expect(j.writes()).toEqual([]);
  expect(await j.local.inspectSlot()).toBeNull();
});

test('T146 unresolved room request offers a bounded fallback and keeps native actions usable', async ({ journey: j }) => {
  test.setTimeout(45_000);
  const page = j.page;
  const path = '**/assets/models/R01-architecture.glb';
  let release!: () => void;
  const parked = new Promise<void>(resolve => { release = resolve; });
  await page.route(path, async route => { await parked; await route.abort().catch(() => {}); });
  try {
    const requested = page.waitForRequest(path);
    await clickButton(page, 'New Adventure');
    await clickButton(page, 'Start new adventure');
    await requested;
    // A 15 s test ceiling is an explicit verification budget for loopback. It
    // includes the room owner's timeout and publishing the recovery controls.
    await expect(page.locator('.nq-shell-presentation-status')).toContainText(/unavailable|timed out/i, { timeout: 15_000 });
    await readIndicators(page);
  } finally { release(); await page.unrouteAll({ behavior: 'wait' }); }
  await clickButton(page, 'Retry visual scene');
  await expect(presentation(page)).toHaveAttribute('data-room-id', 'spec001:R01');
  await expect(presentation(page)).toHaveAttribute('data-rendered', 'true');
  expect(j.writes()).toEqual([]);
});

test('T146 native WebGL context loss and text/low-detail recovery keep the existing observation and focus', async ({ journey: j }) => {
  await j.start();
  const page = j.page, scene = presentation(page);
  await expect(scene).toHaveAttribute('data-rendered', 'true');
  await clickButton(page, 'Look');
  await clickButton(page, 'Look at power indication');
  await openFrame(page, 'Scene');
  const link = button(page, 'Look at link indication');
  await link.focus();
  await scene.locator('canvas').evaluate(canvas => {
    const context = (canvas as HTMLCanvasElement).getContext('webgl2');
    const ext = context?.getExtension('WEBGL_lose_context');
    if (!ext) throw new Error('Browser does not provide the real context-loss extension');
    ext.loseContext();
  });
  await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
  await expect(link).toBeFocused();
  await page.keyboard.press('Enter');
  await openFrame(page, 'Evidence');
  await expect(evidence(page)).toContainText('Link indication');
  const facts = await evidence(page).innerText();
  await closeFrame(page);
  await clickButton(page, 'Text scene');
  await expect(scene).toHaveCount(0);
  await clickButton(page, 'Low detail scene');
  await expect(scene).toHaveAttribute('data-rendered', 'true');
  await expect(scene).toHaveAttribute('data-detail', 'low');
  await expect(scene.locator('[data-safe-position]')).toHaveAttribute('data-safe-position', 'spec001:R01.entry');
  await openFrame(page, 'Evidence');
  await expect(evidence(page)).toHaveText(facts, { useInnerText: true });
  expect(j.writes()).toEqual([]);
});

test('T146 failed voice decode preserves the spoken line and explicit Replay works after recovery', async ({ journey: j }) => {
  const page = j.page, path = '**/assets/audio/auditions/photon-035.mp3';
  await j.start();
  await page.route(path, route => route.fulfill({ contentType: 'audio/mpeg', body: 'invalid audio bytes' }));
  await openFrame(page, 'Sound and reading');
  const cue = page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-VOICE-035"]');
  await clickButton(page, 'Replay Photon');
  await expect(cue).toHaveAttribute('data-audio-status', 'unavailable');
  await expect(cue).toContainText('Audio unavailable');
  await expect(cue.locator('p')).toContainText('I am Photon. I carry light');
  const transcript = await cue.locator('p').innerText();
  await page.unroute(path);
  await clickButton(page, 'Replay Photon');
  await expect(cue).toHaveAttribute('data-audio-status', 'playing');
  await expect(cue.locator('p')).toHaveText(transcript);
  await closeFrame(page);
  await readIndicators(page);
  expect(j.writes()).toEqual([]);
});

test('T146 network loss retains the acknowledged slot, reports unsaved notes and resumes with a deliberate save', async ({ journey: j }) => {
  const page = j.page;
  await j.start(); await j.notes('Acknowledged in the only slot.'); await j.firstSave();
  const anchor = (await j.local.inspectSlot())!;
  await j.notes('New evidence gathered before losing the network.');
  try {
    await j.context.setOffline(true);
    await clickButton(page, 'Save');
    await expect(page.getByText(/could not be confirmed/).first()).toBeVisible();
    expect(await j.local.inspectSlot()).toEqual(anchor);
  } finally { await j.context.setOffline(false); }
  await j.expectNotes('New evidence gathered before losing the network.');
  await expect(page.locator('.nq-save-indicator')).toContainText(/could not be confirmed|unsaved/i);
  await clickButton(page, 'Save');
  await expect(page.getByText(/^Saved at /)).toBeVisible();
  const updated = (await j.local.inspectSlot())!;
  expect(updated.revision).toBe(anchor.revision + 1);
  expect(updated.snapshot.notebook.personalNotes).toBe('New evidence gathered before losing the network.');
  expect((await j.local.inspectAccount()).saves).toBe(1);
});

nativeTest('T146 native Chromium tab pauses moving scene and audio, then resumes without changing the investigation', async ({}, info) => {
  nativeTest.setTimeout(60_000);
  await withNativeChromiumTabs(async native => {
    const { page, context } = native;
    const errors: string[] = [], writes: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
    await page.goto(native.url); await button(page, 'New Adventure').click();
    await expect(presentation(page)).toHaveAttribute('data-rendered', 'true');
    await expect(presentation(page)).toHaveAttribute('data-reduced-motion', 'false');
    const scene = presentation(page);
    const facts = await readIndicators(page);
    await openFrame(page, 'Sound and reading');
    await clickButton(page, 'Replay Title theme');
    const music = page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-MUSIC-title"]');
    await expect(music).toHaveAttribute('data-audio-status', 'playing');
    const front = await context.newPage();
    try {
      await front.bringToFront();
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('hidden');
      await expect(scene).toHaveAttribute('data-paused', 'true');
      await expect(music).toHaveAttribute('data-audio-status', 'paused');
      const frames = await scene.getAttribute('data-render-count');
      // Let real compositor frames elapse on the *visible* tab.
      await front.evaluate(() => new Promise<void>(done => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
      expect(await scene.getAttribute('data-render-count')).toBe(frames);
      await page.bringToFront();
      await expect.poll(() => page.evaluate(() => document.visibilityState)).toBe('visible');
      await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(Number(frames));
      await expect(music).toHaveAttribute('data-audio-status', 'paused');
    } finally { await front.close(); }
    await closeFrame(page);
    await openFrame(page, 'Evidence');
    await expect(evidence(page)).toHaveText(facts, { useInnerText: true });
    await closeFrame(page);
    await clickButton(page, 'Notebook');
    await expect(dialog(page, 'Notebook').locator('li').filter({ hasText: 'Read the silent link in R01' })).toContainText('In progress');
    expect(writes).toEqual([]); expect(errors).toEqual([]);
    await info.attach('visibility', { contentType: 'application/json', body: JSON.stringify({ browser: native.browser.version(), tabStates: ['visible', 'hidden', 'visible'], mode: 'actual tab selection, default context, no focus emulation' }) });
  });
});

guestTest.describe('T146 WebGL2 unavailable at startup', () => {
  guestTest.use({ outcomeBrowser: { viewport: { width: 1280, height: 720 }, disableWebGL: true } });
  guestTest('the native guest can continue the semantic investigation', async ({ outcome: j }) => {
    const page = j.page;
    await page.goto(j.local.url);
    expect(await page.evaluate(() => document.createElement('canvas').getContext('webgl2') === null)).toBe(true);
    await button(page, 'New Adventure').click();
    await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
    await readIndicators(page);
    await clickButton(page, 'Talk'); await clickButton(page, 'Talk to Photon the Firefly'); await clickButton(page, 'Skip dialogue');
    await clickButton(page, 'Use'); await clickButton(page, 'Inspect physical path');
    await clickButton(page, 'Walk'); await clickButton(page, "Walk to The Titan's Workshop");
    await expect(page.getByRole('heading', { name: "The Titan's Workshop", exact: true })).toBeVisible();
    await expect(page.locator('.nq-shell-presentation-status')).toContainText(/unavailable|text presentation/i);
    await openFrame(page, 'Evidence');
    await expect(evidence(page)).toContainText('Power indication');
    await expect(evidence(page)).toContainText('Link indication');
    expect(j.writes).toEqual([]);
  });
});
