// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, test, type Page } from '@playwright/test';
import { clickButton, closeFrame, openFrame } from './support/adventure-controls';
import { withNativeChromiumTabs } from './support/native-chromium-tabs';

test.describe('T151 native Chromium tab', () => {
  test.describe.configure({ timeout: 120_000 });

  async function withGame(run: (page: Page, other: Page, url: string) => Promise<void>) {
    await withNativeChromiumTabs(async ({ page, context, url }) => {
      page.setDefaultTimeout(10_000);
      const writes: string[] = [], errors: string[] = [];
      page.on('request', request => { if (request.method() !== 'GET') writes.push(request.method()); });
      page.on('pageerror', error => errors.push(error.message));
      const other = await context.newPage();
      try {
        await run(page, other, url);
        expect(writes).toEqual([]); expect(errors).toEqual([]);
      } finally { await other.close(); }
    });
  }

  async function switchTo(front: Page, back: Page) {
    await front.bringToFront();
    await expect.poll(() => back.evaluate(() => document.hidden)).toBe(true);
    await expect.poll(() => front.evaluate(() => document.hidden)).toBe(false);
  }

  // Wall time in the foreground tab. A frozen or throttled game clock cannot shorten this observation.
  async function elapse(front: Page, ms: number) {
    await front.evaluate(ms => new Promise<void>(done => setTimeout(done, ms)), ms);
  }

  test('background startup, pending voice and explicit replay preserve channel choices', async () => {
    await withGame(async (page, other, url) => {
      await switchTo(other, page);
      const audioReads: string[] = [];
      page.on('request', req => { if (req.url().includes('/assets/audio/')) audioReads.push(req.url()); });
      // The backend owns detached media elements. Keep references for observation while
      // leaving the browser responsible for fetching, decoding, playback and pausing.
      await page.addInitScript(() => {
        const media = new Set<HTMLMediaElement>(), original = HTMLMediaElement.prototype.play;
        Object.assign(window, { visibilityMedia: media });
        HTMLMediaElement.prototype.play = function () { media.add(this); return original.call(this); };
      });
      const playing = () => page.evaluate(() => [...(window as unknown as { visibilityMedia: Set<HTMLMediaElement> }).visibilityMedia]
        .filter(media => !media.paused).map(media => new URL(media.src).pathname));
      await page.goto(url);
      await expect(page.getByRole('button', { name: 'New Adventure', exact: true })).toHaveCount(1);
      expect(await page.evaluate(() => document.hidden)).toBe(true); expect(audioReads).toEqual([]);
      await switchTo(page, other);
      await clickButton(page, 'New Adventure');
      await openFrame(page, 'Sound and reading');
      const cue = (id: string) => page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-' + id + '"]');
      const title = cue('MUSIC-title'), ambience = cue('AMBIENCE-R01'), photon = cue('VOICE-035');
      await clickButton(page, 'Replay Title theme');
      await ambience.getByRole('button', { name: /Replay/ }).click();
      await expect(title).toHaveAttribute('data-audio-status', 'playing');
      await expect(ambience).toHaveAttribute('data-audio-status', 'playing');
      expect(await playing()).toEqual(expect.arrayContaining([expect.stringMatching(/\/music\/title\.mp3$/), expect.stringMatching(/\/ambience\/r01\.mp3$/)]));
      const path = '**/assets/audio/auditions/photon-035.mp3';
      let release!: () => void;
      const parked = new Promise<void>(done => { release = done; });
      await page.route(path, async route => { await parked; await route.continue().catch(() => {}); });
      try {
        const requested = page.waitForRequest(path);
        await clickButton(page, 'Replay Photon');
        await requested;
        await expect(photon).toHaveAttribute('data-audio-status', 'loading');
        await switchTo(other, page);
        for (const row of [title, ambience, photon]) await expect(row).toHaveAttribute('data-audio-status', 'paused');
        expect(await playing()).toEqual([]);
        release(); await page.unrouteAll({ behavior: 'wait' });
        await switchTo(page, other);
        for (const row of [title, ambience, photon]) await expect(row).toHaveAttribute('data-audio-status', 'paused');
        expect(await playing()).toEqual([]);
        const transcript = await photon.locator('p').innerText();
        await clickButton(page, 'Replay Photon');
        await expect(photon).toHaveAttribute('data-audio-status', 'playing');
        expect(await playing()).toEqual([expect.stringMatching(/\/auditions\/photon-035\.mp3$/)]);
        await expect(photon.locator('p')).toHaveText(transcript);
        await expect(page.locator('.nq-media > [role=status]')).not.toContainText(/tab is hidden|when you return/i);
        await clickButton(page, 'Skip Photon');
        await page.getByRole('slider', { name: 'Music volume' }).fill('0');
        await clickButton(page, 'Replay Title theme');
        await expect(title).toHaveAttribute('data-audio-status', 'muted');
        await switchTo(other, page); await switchTo(page, other);
        await expect(title).toHaveAttribute('data-audio-status', 'muted');
        await expect(ambience).toHaveAttribute('data-audio-status', 'paused');
        await expect(photon).toHaveAttribute('data-audio-status', 'stopped');
      } finally { release(); }
    });
  });

  test('an interrupted packet preview stays at the same phase until the player steps', async () => {
    await withGame(async (page, other, url) => {
      await switchTo(page, other);
      await page.goto(url); await clickButton(page, 'New Adventure');
      await clickButton(page, 'Look'); await clickButton(page, 'Look at message capsule');
      const panel = page.getByRole('dialog', { name: 'Packet journey', exact: true });
      const heading = panel.getByRole('heading'), play = panel.getByRole('button', { name: 'Play preview', exact: true });
      await play.click();
      await switchTo(other, page);
      await expect(play).toBeDisabled();
      const phase = await heading.innerText();
      await elapse(other, 1750);
      expect(await heading.innerText()).toBe(phase);
      await switchTo(page, other);
      await expect(play).toBeEnabled();
      await elapse(page, 1600);
      expect(await heading.innerText()).toBe(phase);
      expect(phase).toMatch(/payload \(1 of 5\)/);
      await panel.getByRole('button', { name: 'Step journey', exact: true }).click();
      await expect(heading).toContainText('encode (2 of 5)');
      await clickButton(page, 'Return to investigation'); await clickButton(page, 'Notebook');
      const notebook = page.getByRole('dialog', { name: 'Notebook' });
      await expect(notebook.getByRole('region', { name: 'Objectives', exact: true })).not.toContainText('Completed');
      await expect(notebook.getByRole('region', { name: 'Evidence', exact: true })).toContainText('The capsule window highlights payload bytes');
    });
  });

  async function workshop(page: Page, url: string) {
    const click = (label: string) => clickButton(page, label);
    await page.goto(url); await click('New Adventure');
    await click('Look'); await click('Look at power indication'); await click('Look at link indication');
    await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue');
    await click('Use'); await click('Inspect physical path');
    await click('Walk'); await click("Walk to The Titan's Workshop");
  }

  test('the Workshop caption remains readable after a background interval longer than its display time', async () => {
    await withGame(async (page, other, url) => {
      await switchTo(page, other); await workshop(page, url);
      await openFrame(page, 'Sound and reading');
      await clickButton(page, 'Replay Tools Before Thunder');
      const caption = page.locator('.nq-media-caption'), text = 'A patient workshop melody with soft mechanical percussion.';
      await expect(caption).toHaveText(text);
      await switchTo(other, page); await elapse(other, 4500);
      await expect(caption).toHaveText(text, { timeout: 500 });
      await switchTo(page, other);
      await expect(caption).toHaveText(text);
      await expect(caption).toBeEmpty({ timeout: 5000 });
    });
  });

  test('the Echo Cavern finishes loading its sprites in the background and draws its first frame on return', async () => {
    await withGame(async (page, other, url) => {
      await switchTo(page, other); await workshop(page, url);
      const click = (label: string) => clickButton(page, label);
      await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue');
      await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
      await click('Notebook');
      await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Measure the conductor before and after the repair.');
      await click('Pin hypothesis'); await click('Close notebook'); await click('Continue as guest');
      await click('Walk'); await click('Walk to The Copper Warrens'); await click('Use');
      await click('Read and keep the supplied compatibility card');
      await click('Read and keep the diagnosed-defect card; this is not a performed measurement');
      const measure = async () => {
        await closeFrame(page);
        await click('Diagnostics'); await click('Take measurement');
        await page.getByRole('dialog', { name: 'Diagnostics' }).getByRole('button', { name: 'Submit this reading' }).last().click();
        await click('Close diagnostics');
      };
      await measure(); await click('Use'); await click('Fit the supplied replacement section: 85 m + 10 m'); await measure();
      const path = '**/assets/models/R04-architecture.glb';
      let release!: () => void;
      const parked = new Promise<void>(done => { release = done; });
      await page.route(path, async route => { await parked; await route.continue(); });
      try {
        const requested = page.waitForRequest(path);
        await click('Walk'); await click('Walk to The Echo Cavern'); await requested;
        await switchTo(other, page); release();
        const scene = page.locator('.nq-sprite-room');
        await expect(scene).toHaveAttribute('data-paused', 'true');
        expect(await scene.getAttribute('data-render-count')).toBeNull();
        await switchTo(page, other); await closeFrame(page);
        await expect(scene).toHaveAttribute('data-rendered', 'true');
        await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(1);
        await switchTo(other, page);
        await expect(scene).toHaveAttribute('data-paused', 'true');
        const count = await scene.getAttribute('data-render-count');
        const heroFrame = () => scene.evaluate(element => (element as HTMLElement).dataset['frameCH01']);
        const frame = await heroFrame(); expect(frame).toMatch(/^(idle|walk|reaction)@\d+$/);
        await elapse(other, 600);
        expect(await scene.getAttribute('data-render-count')).toBe(count);
        expect(await heroFrame()).toBe(frame);
        await switchTo(page, other);
        await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(Number(count));
        await click('Use'); await click('Read and keep the repeater role and limits');
        await click('Notebook');
        await expect(page.getByRole('dialog', { name: 'Notebook' })).toContainText('Total channel length: 95 m');
      } finally { release(); }
    });
  });
});
