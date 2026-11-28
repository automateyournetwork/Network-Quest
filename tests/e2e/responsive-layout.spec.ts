// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { type Locator, type Page, type TestInfo } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { closeFrame, openFrame, tabTo } from './support/adventure-controls';
import { dialog, expect, notesBefore, test, type RouteInput } from './support/outcome-journey';

const tablet = { width: 768, height: 900 };
const phone = { width: 390, height: 844 };
const desktop = [{ width: 1280, height: 720 }, { width: 1440, height: 900 }];
const tap = (control: Locator) => control.tap();

async function setTextSize(page: Page, value: 1 | 2) {
  await openFrame(page, 'Sound and reading', tap);
  const slider = page.getByRole('slider', { name: 'Text size', exact: true });
  await slider.press(value === 2 ? 'End' : 'Home');
  await expect(slider).toHaveValue(String(value));
  await expect(page.locator('.nq-game')).toHaveCSS('font-size', value === 2 ? '32px' : '16px');
  await closeFrame(page, tap);
}

async function inspectToolbar(page: Page, room: string, info: TestInfo) {
  const layout = await page.locator('.nq-game-toolbar').evaluate(bar => {
    const area = (el: Element) => {
      const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
      return { left, right, top, bottom, width, height };
    };
    const frame = area(document.querySelector('.nq-game')!);
    const stage = area(document.querySelector('.nq-game-stage')!);
    const controls = Array.from(bar.querySelectorAll('button')).filter(b => b.getClientRects().length).map(button => {
      const label = button.querySelector('span');
      const range = document.createRange(); range.selectNodeContents(label ?? button);
      const key = button.querySelector('kbd'), keyBox = key?.getBoundingClientRect();
      const textBox = range.getBoundingClientRect(), buttonBox = button.getBoundingClientRect();
      return {
        text: button.getAttribute('aria-label') ?? label?.textContent ?? button.textContent,
        lines: new Set(Array.from(range.getClientRects(), r => r.top)).size,
        box: area(button), overflow: button.scrollWidth - button.clientWidth,
        shortcut: button.getAttribute('aria-keyshortcuts'),
        keyBesideLabel: !keyBox?.width || (keyBox.top < textBox.bottom && keyBox.bottom > textBox.top),
        receivesTouch: button.contains(document.elementFromPoint(buttonBox.x + buttonBox.width / 2, buttonBox.y + buttonBox.height / 2)),
      };
    });
    return { width: innerWidth, height: innerHeight, font: getComputedStyle(bar).fontSize, frame, stage, controls,
      overflow: [document.documentElement.scrollWidth - innerWidth, document.documentElement.scrollHeight - innerHeight] };
  });
  const capture = room + '-' + layout.width + '-' + layout.font;
  await writeFile(info.outputPath(capture + '.json'), JSON.stringify(layout, null, 2));
  await page.screenshot({ path: info.outputPath(capture + '.png') });
  expect(layout.overflow).toEqual([0, 0]);
  // Preserve a useful view of the rendered room even with the densest contextual toolbars.
  expect(layout.stage.height).toBeGreaterThan(layout.height / 4);
  const compendium = layout.controls.find(c => c.text === 'Compendium');
  expect(compendium).toMatchObject({ lines: 1, shortcut: 'C' });
  for (const control of layout.controls) {
    expect(control.box.width, control.text).toBeGreaterThanOrEqual(44);
    expect(control.box.height, control.text).toBeGreaterThanOrEqual(44);
    expect(control.box.left, control.text).toBeGreaterThanOrEqual(layout.frame.left);
    expect(control.box.right, control.text).toBeLessThanOrEqual(layout.frame.right);
    expect(control.box.top, control.text).toBeGreaterThanOrEqual(layout.frame.top);
    expect(control.box.bottom, control.text).toBeLessThanOrEqual(layout.frame.bottom);
    expect(control.overflow, control.text).toBeLessThanOrEqual(1);
    expect(control.keyBesideLabel, control.text).toBe(true);
    expect(control.receivesTouch, control.text).toBe(true);
  }
}

async function expectPanelWidth(panel: Locator) {
  expect(await panel.evaluate(el => el.scrollWidth - el.clientWidth), await panel.getAttribute('aria-label') ?? 'Reading window').toBeLessThanOrEqual(1);
}

test.describe('Reflow and reading windows', () => {
  test.use({ outcomeBrowser: { viewport: tablet, hasTouch: true } });
  test('T149 touch journey keeps enlarged evidence, the Bit Loom and final controls in the frame', async ({ outcome: j }, info) => {
    test.setTimeout(240_000);
    const page = j.page;
    const input: RouteInput = {
      activate: tap,
      async write(field, value) { await field.tap(); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.insertText(value); },
      async arrived(room) {
        if (room !== 'The Clockworks' && room !== 'The Iron Threshold') return;
        await closeFrame(page, tap);
        const roomId = room === 'The Clockworks' ? 'R10' : 'R12';
        for (const viewport of [...desktop, tablet, phone]) {
          await page.setViewportSize(viewport);
          await inspectToolbar(page, roomId, info);
        }
        await setTextSize(page, 2);
        for (const viewport of [tablet, phone]) {
          await page.setViewportSize(viewport);
          await inspectToolbar(page, roomId, info);
        }
        if (roomId === 'R10') {
          await j.click('Open Bit Loom'); await j.click('Practice one symbol');
          const panel = dialog(page, 'Optional activity');
          const bits = panel.getByRole('textbox', { name: 'Practice bits' });
          await bits.tap(); await page.keyboard.insertText('00'); await expect(bits).toHaveValue('00');
          await expectPanelWidth(panel);
          await j.click('Leave the Bit Loom');
          await j.click('Compendium');
          const book = dialog(page, 'Compendium');
          const resident = book.locator('summary').filter({ hasText: /The Apprentice/i }).first();
          await resident.tap();
          const portrait = resident.locator('..').locator('figure img');
          await portrait.scrollIntoViewIfNeeded();
          await expect.poll(() => portrait.evaluate(img => (img as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
          await expectPanelWidth(book);
          await page.screenshot({ path: info.outputPath('R10-portrait-390.png') });
          await j.click('Close compendium');
        } else {
          await openFrame(page, 'Game', tap);
          await expectPanelWidth(dialog(page, 'Game menu'));
          await closeFrame(page, tap);
          const long = 'Follow the physical evidence. '.repeat(62) + 'End of shift.';
          await j.notes(long); await j.expectNotes(long);
          await j.notes(notesBefore);
          await openFrame(page, 'Evidence', tap);
          await expectPanelWidth(dialog(page, 'Evidence and captions'));
          await closeFrame(page, tap);
          await openFrame(page, 'Sound and reading', tap);
          await expectPanelWidth(dialog(page, 'Sound and reading'));
          for (const name of ['Music volume', 'Effects volume', 'Voice volume', 'Text size']) {
            const slider = page.getByRole('slider', { name, exact: true });
            await slider.scrollIntoViewIfNeeded();
            await expect(slider).toBeInViewport({ ratio: 1 });
          }
          await page.screenshot({ path: info.outputPath('R12-settings-390.png') });
          await closeFrame(page, tap);
        }
        await setTextSize(page, 1);
        await page.setViewportSize(tablet);
      },
    };
    await j.prepare('copper', false, input);
    await j.choosePlan('copper', 'permanent'); await j.execute(); await j.validate('permanent');
    await j.click('Continue'); await j.expectNotes(notesBefore);
    expect(j.writes).toEqual([]); expect(await j.local.inspectSlot()).toBeNull();
  });
});

test.describe('Desktop keyboard layout', () => {
  test.use({ outcomeBrowser: { viewport: { width: 1440, height: 900 } } });
  test('T149 unzoomed 1440 desktop from title through optical repair and Continue', async ({ outcome: j }, info) => {
    test.setTimeout(300_000);
    const page = j.page;
    const readings: string[] = [];
    const keys: RouteInput = {
      async activate(control) {
        await tabTo(page, control);
        await page.keyboard.press(await control.evaluate(el => el.matches('input[type=checkbox]')) ? 'Space' : 'Enter');
      },
      async write(field, value) {
        await tabTo(page, field); await page.keyboard.press('ControlOrMeta+a'); await page.keyboard.insertText(value);
      },
      async measured(reading) { readings.push(await reading.innerText()); },
      async arrived() {
        expect(await page.evaluate(() => [innerWidth, innerHeight, document.documentElement.scrollWidth, document.documentElement.scrollHeight]))
          .toEqual([1440, 900, 1440, 900]);
      },
    };
    await j.prepare('fiber', false, keys);
    expect(readings.join('\n')).toContain('Sensitivity reserve: 2 dB');
    await j.choosePlan('fiber', 'permanent'); await j.execute(); await j.validate('permanent');
    await page.screenshot({ path: info.outputPath('E01-1440-keyboard.png') });
    await j.click('Continue'); await j.expectNotes(notesBefore);
    expect(j.writes).toEqual([]); expect(await j.local.inspectSlot()).toBeNull();
  });
});
