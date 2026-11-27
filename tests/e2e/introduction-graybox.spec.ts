// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { clickButton, pressButton, openFrame, closeFrame, revealControl } from './support/adventure-controls';
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { localTls } from './support/local-tls';

/** Actual app acceptance: no replacement main, injected gameplay or mocked evaluator. */
test.describe('T035/T066/T135 actual playable Arrival Lift and Workshop', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page;
  let errors: string[], writes: string[], external: string[];
  test.beforeEach(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, reducedMotion: 'reduce', hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
    page = await context.newPage(); errors = []; writes = []; external = [];
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) external.push(url.origin);
      if (url.pathname.includes('/api/') && request.method() !== 'GET') writes.push(request.method());
    });
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(local.url);
    await clickButton(page, 'New Adventure'); await ready('spec001:R01'); await openFrame(page,'Scene'); await clickButton(page,'Show hotspots'); await closeFrame(page);
  });
  test.afterEach(async () => { try { await context?.close(); } finally { await local?.stop(); }
    expect(errors).toEqual([]); expect(writes).toEqual([]); expect(external).toEqual([]); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const visual = () => page.locator('.nq-graybox');
  const target = (id: string) => visual().locator(`[data-graybox-object="${id}"]`).first();
  async function ready(room: string) {
    await expect(visual()).toHaveAttribute('data-room-id', room);
    await expect(visual()).toHaveAttribute('data-rendered', 'true');
    await expect(page.locator('.nq-shell-presentation-status')).toContainText('ready');
  }
  async function act(verb: string, id: string, choice?: string) {
    await clickButton(page, verb); await ready(id.includes('titan') || id.includes('endpoints') || id.includes('declared-path') ? 'spec001:R02' : 'spec001:R01');
    await target(id).click();
    if (choice) await visual().locator('[data-graybox-control]').filter({ hasText: choice }).click();
  }
  test('visual pointer and semantic keyboard share evidence, O01/O02, movement and actual packet state', async () => {
    const budgets: unknown[] = [];
    async function budget() {
      const sample = await visual().evaluate(element => { const data = (element as HTMLElement).dataset, canvas = element.querySelector('canvas')!;
        return { room: data['roomId'], triangles: Number(data['triangles']), drawCalls: Number(data['drawCalls']), geometries: Number(data['geometries']), textures: Number(data['textures']),
          canvasPixels: [canvas.width, canvas.height], viewport: [innerWidth, innerHeight], devicePixelRatio, userAgent: navigator.userAgent }; });
      expect(sample.triangles).toBeGreaterThan(0);
      if (sample.room === 'spec001:R01') {
        expect(sample.triangles).toBe(70_716); expect(sample.drawCalls).toBeLessThan(600); expect(sample.geometries).toBeGreaterThan(100); expect(sample.geometries).toBeLessThan(600);
        expect(await visual().locator('img')).toHaveCount(3);
      } else {
        await expect(visual()).toHaveAttribute('data-presentation','three');
        await expect(visual()).toHaveAttribute('data-model-count','21');
        await expect(visual().locator('.nq-room-layer')).toHaveCount(3);
        await expect(visual().locator('.nq-workshop-decoration')).toHaveCount(0);
        await expect(visual()).toHaveAttribute('data-party-cast','');
        expect(sample.triangles).toBeGreaterThan(10_000);
        expect(sample.triangles).toBeLessThan(250_000);
        expect(sample.drawCalls).toBeLessThan(800);
      }
      // R01's three image planes live in DOM memory (measured separately).
      // Three's RectAreaLight lookup textures and internal texture are counted here.
      expect(sample.textures).toBeLessThanOrEqual(3); budgets.push(sample);
    }
    await budget();
    await act('Look', 'spec001:HOTSPOT-power');
    await revealControl(page,'Link indication'); await button('Link indication').focus(); await pressButton(page, 'Link indication', 'Enter');
    await act('Talk', 'spec001:HOTSPOT-photon'); await clickButton(page, 'Skip dialogue');
    await act('Use', 'spec001:HOTSPOT-path', 'Inspect physical path');
    await expect(page.locator('.nq-shell-captions')).toContainText('End-to-end service is not proven');
    await act('Look', 'spec001:HOTSPOT-capsule');
    const journey = page.getByRole('dialog', { name: 'Packet journey', exact: true });
    await expect(journey).toContainText('Length only: 105 m');
    await clickButton(page, 'Return to investigation');
    await act('Use', 'spec001:HOTSPOT-path', 'Change physical path');
    await act('Look', 'spec001:HOTSPOT-capsule'); await expect(journey).toContainText('Length only: 95 m');
    for (let index = 0; index < 4; index++) await pressButton(page, 'Step journey', 'Enter');
    await expect(journey).toContainText('Recovered bits: 01001110 01010001'); await clickButton(page, 'Return to investigation');
    await clickButton(page, 'Walk'); await target('exit:spec001:R01:spec001:R02').click(); await ready('spec001:R02');
    await act('Talk', 'spec001:HOTSPOT-titan'); await pressButton(page, 'Skip dialogue', 'Enter');
    await act('Look', 'spec001:HOTSPOT-endpoints'); await act('Look', 'spec001:HOTSPOT-declared-path');
    await pressButton(page, 'Notebook', 'Enter'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('The service loop may exceed the declared length; compare its segments.');
    await pressButton(page, 'Pin hypothesis', 'Enter');
    const objectives = page.locator('[role="dialog"][aria-label="Notebook"] > section').filter({ has: page.locator('h3').filter({ hasText: /^Objectives$/ }) });
    await expect(objectives.locator('li').filter({ hasText: 'Completed' })).toHaveCount(2);
    await pressButton(page, 'Close notebook', 'Enter'); await clickButton(page, 'Continue as guest');
    await expect(visual().locator('[data-safe-position]')).toHaveAttribute('data-safe-position', 'spec001:R02.entry');
    await budget(); await writeFile('test-results/T035-graybox-budget.json', JSON.stringify(budgets, null, 2));
    await page.screenshot({ path: 'test-results/T035-graybox-workshop-desktop.png', fullPage: true });
    await visual().screenshot({ path: 'test-results/T035-graybox-workshop-detail.png' });
    await pressButton(page, 'Walk', 'Enter'); await pressButton(page, 'Walk to The Arrival Lift', 'Enter'); await ready('spec001:R01');
    await page.screenshot({ path: 'test-results/T035-graybox-arrival-desktop.png', fullPage: true });
    await visual().screenshot({ path: 'test-results/T035-graybox-arrival-detail.png' });
  });
  test('canceled and stale visual presses cannot affect a new adventure; repeated room swaps keep one canvas', async () => {
    await clickButton(page, 'Look'); const old = await target('spec001:HOTSPOT-power').elementHandle();
    const oldCanvas = await visual().locator('canvas').elementHandle();
    await old!.dispatchEvent('pointerdown', { pointerId: 9, clientX: 1, clientY: 1, button: 0 });
    await old!.dispatchEvent('pointercancel', { pointerId: 9 }); await old!.dispatchEvent('click', { pointerId: 9 });
    await expect(page.locator('.nq-shell-evidence li')).toHaveCount(0);
    await old!.dispatchEvent('pointerdown', { pointerId: 10, clientX: 1, clientY: 1, button: 0 });
    await clickButton(page, 'New Adventure'); await clickButton(page, 'Start new adventure'); await ready('spec001:R01');
    await expect.poll(() => oldCanvas!.evaluate(canvas => (canvas as HTMLCanvasElement).getContext('webgl2')!.isContextLost())).toBe(true);
    await old!.dispatchEvent('click', { pointerId: 10 });
    await expect(page.locator('.nq-shell-evidence li')).toHaveCount(0);
    await clickButton(page, 'Walk');
    const canvas = await visual().locator('canvas').elementHandle();
    for (let index = 0; index < 3; index++) {
      await target('exit:spec001:R01:spec001:R02').click(); await ready('spec001:R02');
      await target('exit:spec001:R02:spec001:R01').click(); await ready('spec001:R01');
    }
    await expect(page.locator('.nq-shell-presentation canvas')).toHaveCount(1);
    expect(await canvas!.evaluate(element => element === document.querySelector('.nq-graybox canvas'))).toBe(true);
  });
  test('real WebGL loss preserves text actions and retry restores the same state', async () => {
    await act('Look', 'spec001:HOTSPOT-power');
    await visual().locator('canvas').evaluate(canvas => {
      const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
      const extension = gl?.getExtension('WEBGL_lose_context'); if (!extension) throw new Error('Real context-loss extension unavailable'); extension.loseContext();
    });
    await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
    await pressButton(page, 'Link indication', 'Enter');
    await expect(page.locator('.nq-shell-evidence')).toContainText('Power indication');
    await expect(page.locator('.nq-shell-evidence')).toContainText('Link indication');
    await pressButton(page, 'Retry visual scene', 'Enter'); await ready('spec001:R01');
    await pressButton(page, 'Text scene', 'Enter'); await expect(visual()).toHaveCount(0);
    await expect(page.locator('.nq-shell-evidence')).toContainText('Power indication');
    await pressButton(page, 'Low detail scene', 'Enter'); await ready('spec001:R01');
    await expect(visual()).toHaveAttribute('data-detail', 'low');
  });
  test('390 px, touch, 200% text and reduced motion retain readable controls without a render loop', async ({}, info) => {
    await page.setViewportSize({ width: 390, height: 844 }); await button('Look').tap(); await target('spec001:HOTSPOT-power').tap();
    await expect(page.locator('.nq-shell-evidence')).toContainText('Power indication');
    expect(await visual().locator('button, a, input, [tabindex]').count()).toBe(0);
    await page.screenshot({ path: 'test-results/T035-graybox-390px.png', fullPage: true });
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%'; });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await pressButton(page, 'Link indication', 'Enter'); await expect(page.locator('.nq-shell-evidence')).toContainText('Link indication');
    await page.screenshot({ path: 'test-results/T035-graybox-200percent.png', fullPage: true });
    await visual().locator('.nq-graybox-stage').screenshot({ path: 'test-results/T035-graybox-200percent-stage.png' });
    const count = await visual().getAttribute('data-render-count'); await page.waitForTimeout(150); expect(await visual().getAttribute('data-render-count')).toBe(count);
    // Native Firefox SIGSEGV is reproducible only inside the test runner's
    // process. A separate owned Firefox repeats this exact journey and audits
    // the entire real page + expanded media controls with all default axe rules.
    // No scene/action/state is injected. The original failure is preserved in T066.
    const audit = await promisify(execFile)(process.execPath, ['tools/verify-room-accessibility.ts', info.outputPath('t066-accessibility')], { env: { PATH: process.env['PATH'] ?? '', NQ_PHP_BIN: process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php', LANG: 'C', LC_ALL: 'C' }, timeout: 20_000 });
    expect(JSON.parse(audit.stdout)).toMatchObject({ valid: true, violations: 0 });
  });
  test('visual pointer observations equal a fresh keyboard investigation', async () => {
    const observations: string[][] = [];
    for (const input of ['visual', 'keyboard']) {
      if (input === 'keyboard') {
        await clickButton(page, 'New Adventure'); await clickButton(page, 'Start new adventure'); await ready('spec001:R01');
        await expect(page.locator('.nq-shell-evidence li')).toHaveCount(0);
      }
      await pressButton(page, 'Look', 'Enter');
      for (const [id, label] of [['power', 'Power indication'], ['link', 'Link indication']] as const) {
        if (input === 'visual' && id === 'power') {
          // Hit the actual Three.js mesh below its projected number, exercising
          // raycasting rather than an HTML label or a semantic button.
          const pin = (await target('spec001:HOTSPOT-power').boundingBox())!, canvas = (await visual().locator('canvas').boundingBox())!;
          await visual().locator('canvas').click({ position: { x: pin.x + pin.width / 2 - canvas.x, y: pin.y + pin.height / 2 - canvas.y + 28 } });
        } else if (input === 'visual') await target(`spec001:HOTSPOT-${id}`).click(); else await pressButton(page, label, 'Enter');
      }
      await pressButton(page, 'Use', 'Enter');
      if (input === 'visual') {
        await target('spec001:HOTSPOT-satchel').click(); await target('spec001:HOTSPOT-path').click();
        await visual().locator('[data-graybox-control]').filter({ hasText: 'Inspect physical path' }).click();
      } else { await pressButton(page, 'Take inspection kit', 'Enter'); await pressButton(page, 'Inspect physical path', 'Enter'); }
      const rows = await page.locator('.nq-shell-evidence li').allTextContents();
      observations.push(rows);
      await expect(page.locator('.nq-shell-captions')).toContainText('End-to-end service is not proven');
    }
    // Notebook presentation gives the current-attempt relationship in readable text.
    expect(observations[0]!.length).toBeGreaterThanOrEqual(3);
    expect(observations[0]!.join()).toContain('this attempt');
    expect(observations[0]).toEqual(observations[1]);
  });
  test('simulated visibility input pauses the actual renderer and resumes without changing evidence', async () => {
    await act('Look', 'spec001:HOTSPOT-power'); const evidence = await page.locator('.nq-shell-evidence').innerText();
    // Firefox automation kept both pages visible even in the headed probe.
    // This checks application wiring, not native browser visibility support.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(visual()).toHaveAttribute('data-paused', 'true');
    const count = await visual().getAttribute('data-render-count'); await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForTimeout(150); expect(await visual().getAttribute('data-render-count')).toBe(count);
    await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(visual()).toHaveAttribute('data-paused', 'false');
    expect(await page.locator('.nq-shell-evidence').innerText()).toBe(evidence);
  });
});
