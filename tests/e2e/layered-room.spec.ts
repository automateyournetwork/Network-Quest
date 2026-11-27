// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test, expect } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { clickButton, closeFrame, openFrame, pressButton } from './support/adventure-controls';
import room from '../../content/spec001/rooms/R03.json' with { type: 'json' };
import composition from '../../content/spec001/presentation/R03.json' with { type: 'json' };
import layout from '../../assets-src/rooms/scene-layouts.json' with { type: 'json' };

test.use({ hasTouch: true, viewport: { width: 1280, height: 800 }, reducedMotion: 'no-preference' });

test('T133 guest enters the camera-registered Copper Warrens and retains its controls in each detail mode', async ({ page, browser }, info) => {
  test.setTimeout(150_000);
  const click = (label: string) => clickButton(page, label);
  const errors: string[] = [], reads = new Map<string, Promise<string>>();
  const hash = (b: Buffer) => createHash('sha256').update(b).digest('hex');
  const visualBindings = room.mediaBindings.filter(b => ['background', 'midground', 'foreground', 'character-placement', 'prop-placement', 'room-architecture'].includes(b.use));
  const targetPaths = new Set(visualBindings.map(b => b.exportPath));
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    const path = 'public/' + new URL(response.url()).pathname.split('/arcade/play/network-quest/')[1];
    if (targetPaths.has(path) && response.ok()) {
      const digest = response.body().then(hash);
      void digest.catch(() => {});
      reads.set(path, digest);
    }
  });
  await page.goto('./');
  await click('New Adventure');
  await expect(page.locator('.nq-room[data-room-id="spec001:R01"]')).toHaveAttribute('data-rendered', 'true');
  await click('Look'); await click('Look at power indication'); await click('Look at link indication');
  await click('Talk'); await click('Talk to Photon the Firefly'); await click('Skip dialogue');
  await click('Use'); await click('Inspect physical path');
  await click('Walk'); await click("Walk to The Titan's Workshop");
  await click('Talk'); await click('Talk to the Titan'); await click('Skip dialogue');
  await click('Look'); await click('Identify known-good endpoints'); await click('Identify physical path under test');
  await click('Notebook'); await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('Inspect the original conductor before repairing and testing the path.');
  await click('Pin hypothesis'); await click('Close notebook'); await click('Continue as guest');
  // The protagonist is also used by R01. No other R03 visual is loaded before entry.
  expect([...reads.keys()].filter(k => !k.endsWith('/CH01.glb'))).toEqual([]);
  await click('Walk'); await click('Walk to The Copper Warrens'); await closeFrame(page);
  const scene = page.locator('.nq-room[data-room-id="spec001:R03"]');
  await expect(scene).toHaveAttribute('data-rendered', 'true', { timeout: 20_000 });
  await expect(scene).toHaveAttribute('data-presentation', 'layered');
  await expect(scene).toHaveAttribute('data-model-count', String(composition.models.length));
  await expect(scene).toHaveAttribute('data-animated-actors', String(composition.models.filter(model => model.character).length));
  const firstFrame = hash(await scene.locator('canvas').screenshot());
  await page.waitForTimeout(320);
  const secondFrame = hash(await scene.locator('canvas').screenshot());
  expect(secondFrame).not.toBe(firstFrame);
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  await expect(scene).toHaveAttribute('data-paused', 'true');
  const hiddenCount = await scene.getAttribute('data-render-count');
  await page.waitForTimeout(160); expect(await scene.getAttribute('data-render-count')).toBe(hiddenCount);
  await page.evaluate(() => { Reflect.deleteProperty(document, 'hidden'); document.dispatchEvent(new Event('visibilitychange')); });
  await expect.poll(async () => Number(await scene.getAttribute('data-render-count'))).toBeGreaterThan(Number(hiddenCount));
  const received = await Promise.all(visualBindings.map(async b => {
    const bytes = await readFile(b.exportPath);
    expect(await reads.get(b.exportPath), b.exportPath).toBe(hash(bytes));
    return { ...b, sha256: hash(bytes), bytes: bytes.length };
  }));
  const semanticButtons = () => page.locator('.nq-shell-objects button').evaluateAll(elements =>
    elements.map(el => ({ label: el.textContent, disabled: el.getAttribute('aria-disabled') })));
  const source = layout.rooms.find(r => r.roomId === room.id)!;
  const anchors = [...source.exits, ...source.hotspots];
  const metrics = [];
  for (const [width, height] of [[1280, 800], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    // ResizeObserver may run after the resize event. Wait for the recomputed bitmap.
    await expect.poll(() => scene.locator('canvas').evaluate((c: HTMLCanvasElement) => Math.abs(c.width / c.height - c.clientWidth / c.clientHeight))).toBeLessThan(.01);
    const plate = (await scene.locator('.nq-room-background').boundingBox())!, stage = (await scene.boundingBox())!;
    expect(plate.x).toBeGreaterThanOrEqual(stage.x - 1); expect(plate.y).toBeGreaterThanOrEqual(stage.y - 1);
    expect(plate.x + plate.width).toBeLessThanOrEqual(stage.x + stage.width + 1);
    expect(plate.y + plate.height).toBeLessThanOrEqual(stage.y + stage.height + 1);
    for (const button of await page.locator('.nq-game-toolbar button:visible').all()) {
      expect(await button.evaluate(el => el.scrollWidth - el.clientWidth), await button.innerText()).toBeLessThanOrEqual(1);
    }
    let maxError = 0;
    for (const anchor of anchors) {
      const box = (await scene.locator(`[data-graybox-object="${anchor.id}"]`).boundingBox())!;
      const [u, v] = anchor.uvAt16by9;
      maxError = Math.max(maxError, Math.hypot(box.x + box.width/2 - (plate.x + u! * plate.width), box.y + box.height/2 - (plate.y + v! * plate.height)));
    }
    expect(maxError).toBeLessThan(2);
    metrics.push({ width, height, stage, plate, maxAnchorErrorCssPixels: maxError, runtime: await scene.evaluate(el => ({ ...(el as HTMLElement).dataset })) });
    await page.screenshot({ path: info.outputPath(`r03-${width}.png`) });
  }
  await page.keyboard.press('l');
  await expect(page.getByRole('button', { name: 'Look', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await openFrame(page, 'Scene'); await click('Show hotspots'); await closeFrame(page);
  await scene.locator('[data-graybox-object="spec001:HOTSPOT-copper-bench-cards"]').tap();
  const choice = scene.locator('.nq-graybox-choices [data-graybox-object="spec001:HOTSPOT-copper-bench-cards"]');
  if (await choice.count()) await choice.tap();
  await expect(scene).toHaveAttribute('data-reaction', 'reaction');
  await expect(page.locator('.nq-shell-status')).toContainText('compatible');
  const cutaway = scene.locator('[data-graybox-object="spec001:HOTSPOT-copper-pair-cutaway"]').first();
  const separator = scene.locator('[data-graybox-object="spec001:HOTSPOT-copper-pair-separator"]').first();
  const cut = (await cutaway.boundingBox())!, sep = (await separator.boundingBox())!;
  await page.touchscreen.tap((cut.x + sep.x + cut.width) / 2, (cut.y + sep.y + cut.height) / 2);
  await expect(scene.locator('.nq-graybox-choices')).toContainText('Choose a subject');
  await scene.locator('.nq-graybox-choices [data-graybox-object="spec001:HOTSPOT-copper-pair-cutaway"]').tap();
  await expect(page.locator('.nq-shell-status')).toContainText('transparent cutaway');
  const selectedActions = await semanticButtons();
  await click('Text scene'); await expect(scene).toHaveCount(0);
  expect(await semanticButtons()).toEqual(selectedActions);
  await pressButton(page, 'Cracked original section');
  await expect(page.locator('.nq-shell-status')).toContainText('105 m');
  await click('Low detail scene'); await expect(scene).toHaveAttribute('data-detail', 'low');
  await expect(scene).toHaveAttribute('data-model-count', String(composition.models.filter(m => m.character || m.objectId || m.position[1] === 0).length));
  expect(await semanticButtons()).toEqual(selectedActions);
  const lowDetail = await scene.evaluate(el => ({ ...(el as HTMLElement).dataset }));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(scene).toHaveAttribute('data-animated-actors', '0');
  const count = await scene.getAttribute('data-render-count');
  await page.waitForTimeout(150);
  expect(await scene.getAttribute('data-render-count')).toBe(count);
  await closeFrame(page);
  await scene.locator('canvas').evaluate((canvas: HTMLCanvasElement) => canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context')!.loseContext());
  await expect(scene).toHaveCount(0);
  await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
  expect(await semanticButtons()).toEqual(selectedActions);
  await click('Retry visual scene'); await expect(scene).toHaveAttribute('data-rendered','true');
  // Hold one real fetch while the guest selects text. A late response cannot remount a canceled scene.
  let unblock!: () => void, began!: () => void;
  const started = new Promise<void>(resolve => { began = resolve; });
  const gate = new Promise<void>(resolve => { unblock = resolve; });
  const delayed = '**/images/R03/background.webp';
  await page.route(delayed, async route => { began(); await gate; await route.continue().catch(() => {}); });
  await click('Retry visual scene'); await started;
  await click('Text scene'); unblock();
  await page.unrouteAll({ behavior: 'wait' });
  await expect(scene).toHaveCount(0);
  expect(await semanticButtons()).toEqual(selectedActions);
  await page.route(delayed, route => route.fulfill({ status: 503, body: '' }));
  await click('Retry visual scene');
  await expect(page.locator('.nq-shell-presentation-status')).toContainText('unavailable');
  expect(await semanticButtons()).toEqual(selectedActions);
  await page.unroute(delayed); await click('Retry visual scene');
  await expect(scene).toHaveAttribute('data-rendered', 'true');
  expect(errors).toEqual([]);
  await writeFile(info.outputPath('r03-runtime.json'), JSON.stringify({ browser: browser.version(), observations: metrics, lowDetail, received, animatedCanvasFrameSha256: [firstFrame, secondFrame], visibility: 'Synthetic visibilitychange paused and resumed the application loop.', errors }, null, 2) + '\n');
});
