// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import AxeBuilder from '@axe-core/playwright';
import { firefox, type Locator, type Page, type TestInfo } from '@playwright/test';
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { closeFrame, openFrame, tabTo } from './support/adventure-controls';
import { paintedContrast } from './support/painted-contrast';
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

const playthroughs = [
  ...variants.map(variant => ({ ...variant, group: 'T146' })),
  { ...variants[0], group: 'T152 combined native zoom and text scene', width: 1440, height: 900, zoom: true },
];

for (const variant of playthroughs) test.describe(`${variant.group} ${variant.route} ${variant.result}`, () => {
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
      if (variant.touch && room === 'The Clockworks') {
        await closeFrame(page, input.activate);
        await openFrame(page, 'Sound and reading', input.activate);
        const size = page.getByRole('slider', { name: 'Text size' });
        await size.press('End');
        await expect(page.locator('.nq-game')).toHaveCSS('font-size', '32px');
        await closeFrame(page, input.activate);
        const status = page.locator('.nq-game-stage .nq-shell-status');
        const message = await status.innerText();
        expect(message).toMatch(/Clockworks/i);
        await tabTo(page, status);
        await page.keyboard.press('End');
        await expect.poll(() => status.evaluate(el => el.scrollHeight - el.clientHeight - el.scrollTop)).toBeLessThanOrEqual(1);
        await openFrame(page, 'Scene', input.activate);
        await expect(dialog(page, 'Scene objects and exits').getByRole('status').filter({ hasText: message })).toBeVisible();
        await closeFrame(page, input.activate);
        await openFrame(page, 'Sound and reading', input.activate);
        const cue = page.locator('.nq-media-cue').filter({ hasText: 'A gentle clockwork melody plays without a countdown.' });
        await expect(cue.locator('p')).toBeVisible();
        const transcript = await cue.locator('p').innerText();
        await input.activate(cue.getByRole('button', { name: /^Replay/ }));
        await expect(cue).toHaveAttribute('data-audio-status', 'muted');
        await closeFrame(page, input.activate);
        await expect(page.locator('.nq-media-caption')).toHaveText(transcript);
        await info.attach('390px double text overlays', { body: JSON.stringify({ message, transcript }), contentType: 'application/json' });
        await openFrame(page, 'Sound and reading', input.activate);
        await size.press('Home');
        await closeFrame(page, input.activate);
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

async function measureValidationContrast(panel: Locator, info: TestInfo) {
  const explanation = panel.locator(':scope > div > p').first();
  await expect(explanation).toContainText(/endpoint/i);
  await explanation.screenshot({ path: info.outputPath('R12-validation-explanation.png') });
  const selector = '[role="dialog"][aria-label="Validate repair"] > div > p';
  const sample = await paintedContrast(explanation, selector);
  await info.attach('validation-contrast', { body: JSON.stringify(sample), contentType: 'application/json' });
}

async function auditPage(page: Page, name: string, info: TestInfo) {
  const audit = await new AxeBuilder({ page }).analyze();
  const findings = (rules: typeof audit.violations) => rules.map(rule => ({
    id: rule.id, impact: rule.impact, nodes: rule.nodes.map(node => ({ target: node.target, reason: node.failureSummary })),
  }));
  await info.attach('axe ' + name, {
    body: JSON.stringify({ name, engine: audit.testEngine, viewport: page.viewportSize(),
      userAgent: audit.testEnvironment.userAgent, passed: audit.passes.map(rule => rule.id),
      inapplicable: audit.inapplicable.map(rule => rule.id),
      violations: findings(audit.violations), incomplete: findings(audit.incomplete) }),
    contentType: 'application/json',
  });
  expect.soft(findings(audit.violations), name).toEqual([]);
  expect.soft(findings(audit.incomplete.filter(rule => rule.id !== 'color-contrast')), name + ' findings needing review').toEqual([]);
  for (const finding of audit.incomplete.filter(rule => rule.id === 'color-contrast')) {
    for (const node of finding.nodes) {
      const [selector] = node.target;
      if (node.target.length !== 1 || typeof selector !== 'string') throw new Error('Unexpected nested contrast target');
      const targets = await page.locator(selector).filter({ visible: true }).all();
      expect(targets.length, 'Resolve the reported axe target ' + selector).toBeGreaterThan(0);
      for (const target of targets) {
        const sample = await paintedContrast(target, selector);
        await info.attach('painted contrast ' + name, { body: JSON.stringify({ selector, ...sample }), contentType: 'application/json' });
      }
    }
  }
}

for (const variant of variants) test(`T152 full-page axe through the ${variant.route} route and ${variant.result} ending`, async ({ outcome: j }, info) => {
  test.setTimeout(300_000);
  const { page } = j;
  expect(j.context.browser()?.browserType().name()).toBe('chromium');
  await page.setViewportSize({ width: variant.zoom ? 768 : variant.width, height: variant.height });
  await page.goto(j.local.url);
  await expect(page.getByRole('button', { name: 'New Adventure' })).toBeVisible();
  await auditPage(page, 'Title', info);
  const sound = '.nq-game-chrome button:first-of-type';
  await expect(page.locator(sound)).toHaveAccessibleName('Sound and reading');
  const titleControl = await paintedContrast(page.locator(sound), sound);
  await info.attach('painted contrast Title', { body: JSON.stringify({ selector: sound, ...titleControl }), contentType: 'application/json' });
  const rooms = new Set<string>();
  let currentRoom = '';
  const input: RouteInput = {
    activate: control => control.click(),
    write: (field, value) => field.fill(value),
    async arrived(name) {
      currentRoom = name;
      if (rooms.has(name)) return;
      rooms.add(name);
      await closeFrame(page);
      await expect(page.locator('[aria-modal=true]')).toHaveCount(0);
      await auditPage(page, 'Stage — ' + name, info);
      await openFrame(page, 'Scene');
      await expect(dialog(page, 'Scene objects and exits')).toHaveAttribute('aria-modal', 'true');
      await auditPage(page, 'Scene objects and exits — ' + name, info);
      await closeFrame(page);
    },
    async measured() { await auditPage(page, 'Diagnostics — ' + currentRoom, info); },
  };
  await j.prepare(variant.route, false, input);
  await j.choosePlan(variant.route, variant.result);
  await auditPage(page, 'Reviewed commitment', info);
  await j.execute();
  if (variant.result === 'permanent') await page.setViewportSize({ width: 390, height: 844 });
  await j.validate(variant.result, false, async panel => {
    await auditPage(page, 'Validate repair', info);
    if (variant.result === 'permanent') await measureValidationContrast(panel, info);
  });
  await expect(dialog(page, variant.title)).toBeVisible();
  await page.screenshot({ path: info.outputPath('R12-ending-before-axe.png') });
  await auditPage(page, variant.title, info);
  expect(rooms.size).toBe(8);
  expect(j.writes).toEqual([]);
  expect(await j.local.inspectSlot()).toBeNull();
});
