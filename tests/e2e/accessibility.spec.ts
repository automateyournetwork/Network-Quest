// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import AxeBuilder from '@axe-core/playwright';
import { firefox, type Page } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { closeFrame, openFrame, tabTo } from './support/adventure-controls';
import { dialog, expect, notesBefore, test, type RouteInput } from './support/outcome-journey';

function routeInput(page: Page, touch: boolean): RouteInput {
  return {
    async activate(control) {
      if (touch) { await control.tap(); return; }
      await tabTo(page, control);
      const checkbox = await control.evaluate(el => el.matches('input[type=checkbox]'));
      await page.keyboard.press(checkbox ? 'Space' : 'Enter');
    },
    async write(field, value) {
      if (touch) await field.tap(); else await tabTo(page, field);
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.insertText(value);
      await expect(field).toHaveValue(value);
    },
  };
}

/** Firefox stores its own Settings > Default zoom in the disposable profile.
 * Bootstrap the schema with this Firefox, set the same native full-zoom value,
 * then verify real CSS viewport reflow after navigation with the physical
 * viewport unchanged. No page CSS, DPR, pinch or device emulation sets zoom. */
async function firefoxDoubleZoom(profile: string, url: string) {
  const bootstrap = await firefox.launchPersistentContext(profile, { viewport: { width: 1440, height: 900 } });
  try {
    const page = await bootstrap.newPage();
    await page.goto(url);
    expect(await page.evaluate(() => innerWidth)).toBe(1440);
  } finally { await bootstrap.close(); }
  const db = new DatabaseSync(join(profile, 'content-prefs.sqlite'));
  try {
    db.exec("INSERT INTO settings(name) SELECT 'browser.content.full-zoom' WHERE NOT EXISTS(SELECT 1 FROM settings WHERE name='browser.content.full-zoom')");
    const setting = db.prepare("SELECT id FROM settings WHERE name='browser.content.full-zoom'").get()!;
    db.prepare('DELETE FROM prefs WHERE groupID IS NULL AND settingID=?').run(Number(setting['id']));
    db.prepare('INSERT INTO prefs(groupID,settingID,value,timestamp) VALUES(NULL,?,?,?)').run(Number(setting['id']), 2, Date.now());
  } finally { db.close(); }
}

async function expectReflow(page: Page) {
  const overflow = await page.evaluate(() => ({ horizontal: document.documentElement.scrollWidth - innerWidth, vertical: document.documentElement.scrollHeight - innerHeight }));
  expect(overflow).toEqual({ horizontal: 0, vertical: 0 });
}

const variants = [
  { route: 'copper', result: 'permanent', title: 'The Steady Light', width: 1280, height: 720, touch: false, zoom: false,
    proof: ['Total channel length: 105 m', 'Total channel length: 95 m', 'Historical open recorded: 1 count'] },
  { route: 'radio', result: 'temporary', title: 'The Borrowed Dawn', width: 390, height: 844, touch: true, zoom: false,
    proof: ['Viable path: 1 count', 'Signal-to-noise ratio: 20 dB'] },
  { route: 'fiber', result: 'shutdown', title: 'The Honest Shutdown', width: 1440, height: 900, touch: false, zoom: true,
    proof: ['Receive power: -12 dBm', 'Sensitivity reserve: 2 dB'] },
] as const;

for (const variant of variants) test.describe(`T146 ${variant.route} ${variant.result}`, () => {
  test.use({ outcomeBrowser: { viewport: { width: variant.width, height: variant.height }, hasTouch: variant.touch,
    ...(variant.zoom ? { configureProfile: firefoxDoubleZoom } : {}) } });
  test('guest from title through evidence, commitment, ending and Continue', async ({ outcome: j }, info) => {
    test.setTimeout(300_000);
    const { page } = j, input = routeInput(page, variant.touch), readings: string[] = [];
    input.measured = async reading => { readings.push(await reading.innerText()); };
    input.arrived = async room => {
      expect(await j.local.inspectSlot(), `guest slot on arrival at ${room}`).toBeNull();
      await expectReflow(page);
      if (room === 'The Arrival Lift') {
        expect(await page.evaluate(() => innerWidth)).toBe(variant.zoom ? 720 : variant.width);
        expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
        await expect(page.locator('.nq-graybox')).toHaveAttribute('data-animated-actors', '0');
        await openFrame(page, 'Sound and reading', input.activate);
        for (const name of ['Music volume', 'Effects volume', 'Voice volume']) {
          const slider = page.getByRole('slider', { name, exact: true });
          if (variant.touch) {
            const bounds = (await slider.boundingBox())!;
            await slider.tap({ position: { x: 1, y: bounds.height / 2 } });
          } else {
            await tabTo(page, slider);
            await page.keyboard.press('Home');
          }
          await expect(slider).toHaveValue('0');
        }
        await expect(page.getByRole('checkbox', { name: 'Show sound captions' })).toBeChecked();
        await input.activate(page.getByRole('button', { name: 'Replay Narrator', exact: true }));
        const narration = page.locator('.nq-media-cue[data-asset-id="spec001:ASSET-VOICE-001"]');
        await expect(narration).toHaveAttribute('data-audio-status', 'muted');
        await expect(narration.locator('p')).toContainText("Welcome to the Underworld.");
        await closeFrame(page, input.activate);
        if (variant.route === 'copper') {
          await openFrame(page, 'Scene', input.activate);
          await input.activate(page.getByRole('button', { name: 'Text scene', exact: true }));
          await expect(page.locator('.nq-graybox')).toHaveCount(0);
          input.textScene = true;
        }
      }
      if (room === 'The Iron Threshold') {
        await closeFrame(page, input.activate);
        const label = page.getByRole('button', { name: 'Compendium', exact: true }).locator('span').first();
        const lines = await label.evaluate(el => {
          const range = document.createRange(); range.selectNodeContents(el);
          return new Set(Array.from(range.getClientRects(), rect => rect.top)).size;
        });
        expect.soft(lines, 'The full R12 toolbar must keep the single word Compendium readable').toBe(1);
      }
      if (room === 'The Shell Market' && !input.textScene) {
        await openFrame(page, 'Scene', input.activate);
        const summary = page.locator('summary').filter({ hasText: /Inspect .*injector.* up close/i });
        await input.activate(summary);
        await expect(summary.locator('..').locator('canvas')).toBeVisible();
        await input.activate(summary);
        await expect(summary.locator('..').locator('canvas')).toHaveCount(0);
        if (!variant.touch) await expect(summary).toBeFocused();
        await closeFrame(page, input.activate);
      }
    };
    await j.prepare(variant.route, false, input);
    for (const expected of [...variant.proof, 'Total delivered demand: 30 W', 'Represented bits: 8 bit'])
      expect(readings.join('\n')).toContain(expected);
    await j.choosePlan(variant.route, variant.result);
    await j.execute();
    await j.validate(variant.result);
    const ending = dialog(page, variant.title);
    if (variant.result === 'shutdown') {
      await input.activate(ending.getByRole('button', { name: 'Read the encounter handover' }));
      await expect(ending).toContainText('Isolation is not restoration');
    } else {
      await expect(ending).toContainText('separate endpoint service test');
      if (variant.result === 'temporary') for (const text of ['Temporary dependency:', 'Limitation:', 'Follow-up:']) await expect(ending).toContainText(text);
    }
    await input.activate(ending.getByRole('button', { name: 'Skip scene' }));
    await input.activate(ending.getByRole('button', { name: 'Replay scene' }));
    await page.screenshot({ path: info.outputPath(`${variant.route}-ending.png`) });
    await input.activate(ending.getByRole('button', { name: 'Continue', exact: true }));
    if (variant.result === 'shutdown') {
      const confirm = dialog(page, 'Continue from Encounter Preparation?');
      await expect(confirm).toContainText('Items and completion flags rewind together.');
      await input.activate(confirm.getByRole('button', { name: 'Confirm Continue to Encounter Preparation' }));
      await j.room('The Backhoe Rift');
      await j.objective('Resolve the intervention in R11', false);
    } else await j.room('The Iron Threshold');
    await j.objective('Validate at R12', variant.result !== 'shutdown');
    await j.expectNotes(notesBefore);
    expect(j.writes).toEqual([]);
    expect(await j.local.inspectSlot()).toBeNull();
  });
});

test('T146 focus restoration and typing-safe shortcuts at 1440 desktop and 768 reflow', async ({ outcome: j }) => {
  test.setTimeout(90_000);
  const page = j.page, input = routeInput(page, false);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(j.local.url);
  await input.activate(page.getByRole('button', { name: 'New Adventure' }));
  await j.room('The Arrival Lift');
  for (const width of [1440, 768]) {
    await page.setViewportSize({ width, height: 900 });
    await expectReflow(page);
    const opener = page.getByRole('button', { name: 'Notebook', exact: true });
    await input.activate(opener);
    const notes = page.getByRole('textbox', { name: 'Personal notes' });
    await tabTo(page, notes);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.type('wltuinc');
    await expect(notes).toBeFocused();
    await expect(notes).toHaveValue('wltuinc');
    await page.keyboard.press('Escape');
    await expect(opener).toBeFocused();
    await expect(page.getByRole('button', { name: 'Walk', exact: true })).toHaveAttribute('aria-pressed', 'true');
  }
});

test('T146 full-page axe audit in the actual R12 ending', async ({ outcome: j }, info) => {
  test.setTimeout(180_000);
  await j.prepare('copper', false);
  await j.choosePlan('copper', 'permanent'); await j.execute();
  await j.page.setViewportSize({ width: 390, height: 844 });
  await j.validate('permanent', false, async panel => {
    // Prior axe results called this explanation partially obscured. Sample the
    // painted paragraph itself, including real antialiased glyphs and backdrop.
    const explanation = panel.locator(':scope > div > p').first();
    await expect(explanation).toContainText(/endpoint/i);
    const pixels = await explanation.screenshot({ path: info.outputPath('R12-validation-explanation.png') });
    const sample = await explanation.evaluate(async (el, png) => {
      const bitmap = await createImageBitmap(new Blob([Uint8Array.from(atob(png), c => c.charCodeAt(0))], { type: 'image/png' }));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), ctx = canvas.getContext('2d')!;
      ctx.drawImage(bitmap, 0, 0); bitmap.close();
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const counts = new Map<string, number>();
      for (let i = 0; i < data.length; i += 4) {
        const rgb = [data[i], data[i + 1], data[i + 2]].join(',');
        counts.set(rgb, (counts.get(rgb) ?? 0) + 1);
      }
      const text = el.firstChild!;
      const obscured: string[] = [];
      for (const match of text.textContent!.matchAll(/\S+/g)) {
        const range = document.createRange();
        range.setStart(text, match.index); range.setEnd(text, match.index + match[0].length);
        if (Array.from(range.getClientRects()).some(r => !el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)))) obscured.push(match[0]);
      }
      const foreground = getComputedStyle(el).color.match(/\d+(?:\.\d+)?/g)!.slice(0, 3).join(',');
      const background = Array.from(counts).sort((a, b) => b[1] - a[1])[0]![0];
      const luminance = (rgb: string) => rgb.split(',').reduce((total, value, i) => {
        const c = Number(value) / 255;
        return total + [0.2126, 0.7152, 0.0722][i]! * (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      }, 0);
      const light = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
      return { foreground, background, obscured, solidGlyphPixels: counts.get(foreground) ?? 0, contrast: (light[1]! + 0.05) / (light[0]! + 0.05) };
    }, pixels.toString('base64'));
    await info.attach('validation-contrast', { body: JSON.stringify(sample), contentType: 'application/json' });
    expect(sample.obscured).toEqual([]);
    expect(sample.solidGlyphPixels).toBeGreaterThan(0);
    expect(sample.contrast).toBeGreaterThanOrEqual(4.5);
  });
  await expect(dialog(j.page, 'The Steady Light')).toBeVisible();
  await j.page.screenshot({ path: info.outputPath('R12-ending-before-axe.png') });
  // Record the actual engine and incomplete findings, including color contrast
  // the scanner cannot resolve. Only the full-page audit may certify its rules.
  await info.attach('browser', { body: JSON.stringify({ version: j.context.browser()?.version(), ua: await j.page.evaluate(() => navigator.userAgent) }), contentType: 'application/json' });
  const audit = await new AxeBuilder({ page: j.page }).analyze();
  await info.attach('axe', { body: JSON.stringify({ url: audit.url, violations: audit.violations, incomplete: audit.incomplete }), contentType: 'application/json' });
  expect(audit.violations.map(v => ({ rule: v.id, targets: v.nodes.map(n => n.target) }))).toEqual([]);
});
