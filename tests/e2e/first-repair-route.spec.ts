// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import { configuredSave } from './support/configured-save';
import { closeFrame, openFrame, revealControl } from './support/adventure-controls';

/**
 * T078 / PLAN W05: the composed application, from its real New Adventure action.
 * SPEC O01→O02→O03/O04+O09/O10→O11→O12, T01/T02/T10/T12/T13/T16.
 * No runtime injection, fabricated completion, imported evaluator or synthetic
 * physical result. The optional fixture cookie establishes local identity only.
 * Numeric expectations are transcribed from SPEC and reviewed authored profiles.
 */
type Input = 'pointer' | 'keyboard';
const notes = 'Keep the failed before reading. A link indication alone is not service proof.';
const objectiveLabels = {
  O01: 'Read the silent link in R01', O02: 'Open the investigation in R02',
  O03: 'Prepare copper in R03', O04: 'Prove copper in R04',
  O09: 'Equip the repair in R09', O10: 'Calibrate in R10',
  O11: 'Resolve the intervention in R11', O12: 'Validate at R12',
} as const;

for (const variant of [
  { name: 'guest replacement route', input: 'pointer', length: 95, authenticated: false },
  { name: 'keyboard alternate route with saved restoration', input: 'keyboard', length: 100, authenticated: true },
] as const) {
  test(`T078 ${variant.name} uses fresh real evidence through R12`, async ({}, info) => {
    test.setTimeout(180_000);
    const local = await configuredSave();
    let context: BrowserContext | undefined;
    const errors: string[] = [], external: string[] = [], writes: string[] = [];
    try {
      context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false,
        reducedMotion: 'reduce', viewport: { width: 1280, height: 900 } });
      if (variant.authenticated) {
        const [name, value] = local.cookies[0]!.split('=');
        await context.addCookies([{ name: name!, value: value!, domain: '127.0.0.1', path: '/arcade/play/network-quest/',
          secure: true, httpOnly: true, sameSite: 'Lax' }]);
      }
      context.on('request', request => {
        const url = new URL(request.url());
        if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) external.push(request.url());
        if (url.pathname.endsWith('/save') && request.method() === 'PUT') writes.push(request.postData() ?? '');
      });
      const page = await context.newPage(); page.setDefaultTimeout(10_000); page.on('pageerror', error => errors.push(error.message));
      const route = controls(page, variant.input);
      await page.goto(local.url);
      if (variant.authenticated) await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
      await route.click('New Adventure');
      if (variant.authenticated) await route.click('Start new adventure');
      await route.room('The Arrival Lift');
      await route.verb('Look'); await route.click('Look at power indication'); await route.click('Look at link indication');
      await route.verb('Talk'); await route.click('Talk to Photon the Firefly'); await route.click('Skip dialogue');
      await route.verb('Use'); await route.click('Inspect physical path');
      await route.objective('O01', true);
      await route.walk("The Titan's Workshop");
      await route.verb('Talk'); await route.click('Talk to the Titan'); await route.click('Skip dialogue');
      await route.verb('Look'); await route.click('Identify known-good endpoints'); await route.click('Identify physical path under test');
      await route.click('Notebook');
      await page.getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('The documented open conductor may explain the fault; measure before and after repair.');
      await route.click('Pin hypothesis');
      await page.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(notes);
      await route.click('Close notebook');
      if (!variant.authenticated) {
        await expect(page.getByRole('dialog', { name: 'Sign in to save', exact: true })).toBeVisible();
        await route.click('Continue as guest');
        await openFrame(page, 'Game');
        await expect(page.getByText('Guest — progress is only in this session.', { exact: true })).toBeVisible();
        await closeFrame(page);
      }
      await route.objective('O02', true);

      await route.walk('The Copper Warrens');
      await route.verb('Look'); await route.click('Cracked original section');
      await expect(page.getByRole('status')).toContainText('5 m beyond');
      await route.verb('Use');
      await route.click('Read and keep the supplied compatibility card');
      await route.click('Read and keep the diagnosed-defect card; this is not a performed measurement');
      await route.diagnostics();
      await route.click('Take measurement');
      await expect(route.readings().last()).toContainText('Total channel length: 105 m');
      await expect(route.readings().last()).toContainText('Open required conductors: 1 count');
      await route.windowBehavior('Diagnostics');
      await page.screenshot({ path: info.outputPath(`T078-${variant.length}m-diagnostics.png`), fullPage: true });
      await route.submitLatest();
      await expect(route.diagnostic()).not.toContainText('Objective complete.');
      await route.click('Show method hint'); await route.click('Show worked step'); await route.click('Show solution');
      await expect(route.diagnostic()).toContainText('Help is available without a score or ending penalty.');
      await route.closeDiagnostics();

      // Both passive alternatives are valid. A configuration change never turns
      // the old reading into a passing measurement of a different path.
      await route.verb('Use'); await route.click('Fit the supplied replacement section: 85 m + 10 m');
      await route.diagnostics(); await route.click('Take measurement');
      await expect(route.readings().last()).toContainText('Total channel length: 95 m');
      await route.closeDiagnostics();
      await route.verb('Use'); await route.click('Select the intact alternate path: 90 m + 10 m');
      await route.diagnostics();
      await expect(route.readings().filter({ hasText: 'Total channel length: 95 m' })).toContainText('Stale reading');
      await expect(route.readings().filter({ hasText: 'Total channel length: 95 m' }).getByRole('button', { name: 'Submit this reading', exact: true })).toBeDisabled();
      await route.closeDiagnostics();
      if (variant.length === 95) { await route.verb('Use'); await route.click('Fit the supplied replacement section: 85 m + 10 m'); }
      await route.diagnostics(); await route.click('Take measurement');
      await expect(route.readings().last()).toContainText(`Total channel length: ${variant.length} m`);
      await expect(route.readings().last()).toContainText('Open required conductors: 0 count');
      await route.submitLatest(); await expect(route.diagnostic()).toContainText('Objective complete.');
      await route.closeDiagnostics(); await route.objective('O03', true);

      await route.walk('The Echo Cavern'); await route.verb('Use');
      await route.click('Read and keep the before-record instructions; retain an actual measured open result');
      await route.click('Read and keep the repeater role and limits');
      await route.click('Propose: a powered repeater alone bridges the unchanged severed conductor');
      await route.diagnostics(); await route.click('Take measurement'); await route.submitLatest();
      await expect(route.diagnostic()).not.toContainText('Objective complete.');
      await route.closeDiagnostics(); await route.verb('Use');
      await route.click('Conclude: a repeater needs the physical connection restored');
      await route.diagnostics(); await route.click('Take measurement');
      await expect(route.readings().last()).toContainText('Historical open recorded: 1 count');
      await route.submitLatest(); await expect(route.diagnostic()).toContainText('Objective complete.');
      await route.closeDiagnostics(); await route.objective('O04', true);

      await route.walk('The Copper Warrens'); await route.walk("The Titan's Workshop"); await route.walk('The Shell Market');
      await route.verb('Use'); await route.click('Read and record all separate equipment checks');
      await route.click('Select 100/full'); await route.click('Inspect the original 12 W + 11 W + 10 W proposal');
      await route.diagnostics(); await route.click('Take measurement');
      await expect(route.readings().last()).toContainText('Total delivered demand: 33 W');
      await expect(route.readings().last()).toContainText('Delivered excess: 3 W');
      await route.submitLatest(); await expect(route.diagnostic()).not.toContainText('Objective complete.');
      await route.closeDiagnostics(); await route.verb('Use');
      await route.click(variant.length === 95 ? 'Choose complete kit A: 12 W + 11 W' : 'Choose complete kit B: 12 W + 11 W + 7 W');
      await route.diagnostics(); await route.click('Take measurement'); await route.submitLatest();
      await expect(route.diagnostic()).toContainText('Objective complete.'); await route.closeDiagnostics();
      await route.objective('O09', true);

      await route.walk("The Titan's Workshop"); await route.walk('The Clockworks'); await route.verb('Use');
      await route.click('Read and record the physical-role and upper-layer explanation');
      await route.click('Use untimed step-by-step decoding');
      await route.click('Explain: sample physical signals representing bits; this does not discover addresses');
      for (const [position, pair] of ['00', '10', '11', '01'].entries()) {
        await route.click(`Inspect sample position ${position}`); await route.click('Evidence');
        await expect(page.locator('.nq-shell-captions')).toContainText(`Sample position ${position}: ${[-3, 1, 3, -1][position]} toy-level represents ${pair}.`);
        await route.verb('Use'); await route.click(`Write ${pair} for sample position ${position}`);
      }
      await route.click('Replay from the first sample without changing my answer');
      await route.diagnostics(); await route.click('Take measurement');
      await expect(route.readings().last()).toContainText('Represented bits: 8 bit');
      await expect(route.readings().last()).toContainText('Symbols decoded: 4 symbol');
      await route.submitLatest(); await expect(route.diagnostic()).toContainText('Objective complete.');
      await route.closeDiagnostics(); await route.objective('O10', true);
      await route.walk('The Backhoe Rift', 'Walk toward The Backhoe Rift');

      // Explicit plan and duration precede the actual intervention. Arrival at
      // the next room is never a substitute for separately measured validation.
      await route.click('Repair plan');
      if (variant.authenticated) {
        await route.click('Fiber path A — 8 dB loss'); await route.click('Permanent installation'); await route.click('Review current plan');
        await expect(page.getByRole('dialog', { name: 'Repair plan', exact: true }).locator('ol[aria-label="Repair observations"] > li')).toHaveCount(0);
      }
      await route.click(variant.length === 95 ? 'Copper replacement — 95 m' : 'Copper alternate — 100 m');
      await route.click('Permanent installation');
      await route.click('Read and keep plan requirements');
      await route.click('Review current plan');
      const warning = page.getByRole('checkbox', { name: 'I understand that execution changes the route and makes earlier readings stale', exact: true });
      if (variant.input === 'keyboard') { await warning.focus(); await warning.press('Space'); } else await warning.check();
      await route.click('Execute reviewed plan');
      await route.click('Close repair controls');
      await route.objective('O11', true);
      await route.walk('The Iron Threshold', 'Walk to the validation balcony'); await route.objective('O12', false);
      await route.click('Validate repair'); await route.click('Read classification criteria');
      const validation = page.getByRole('dialog', { name: 'Validate repair', exact: true });
      await route.windowBehavior('Validate repair');
      await route.click('Classify permanent restoration');
      await expect(validation).toContainText('This objective is in progress. No restored service has been awarded.');
      await route.click('Measure repaired link');
      await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Recovered highlighted bits: 16 bit');
      await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Differing highlighted positions: 0 count');
      await route.click('Classify permanent restoration');
      await expect(validation).toContainText('This objective is in progress. No restored service has been awarded.');
      await route.click('Run endpoint test');
      await expect(validation.locator('ol[aria-label="Repair observations"] > li').last()).toContainText('Endpoint service acknowledged: 1 count');
      await route.click('Classify permanent restoration');
      const epilogue = page.getByRole('dialog', { name: 'The Steady Light', exact: true });
      await expect(epilogue).toBeVisible(); await expect(epilogue).toContainText('Permanent restoration');
      await expect(epilogue).toContainText('separate endpoint service test');
      await expect(epilogue).toContainText('well-used toolkit');
      await page.screenshot({ path: info.outputPath(`T078-${variant.length}m-validation.png`), fullPage: true });
      await route.click('Save'); await expect(page.getByText('Finish the current activity before saving.', { exact: true })).toBeVisible();
      expect(writes).toEqual([]); await closeFrame(page);
      if (variant.input === 'keyboard') {
        await epilogue.getByRole('button', { name: 'Skip scene', exact: true }).press('Enter');
        await epilogue.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
      } else await epilogue.getByRole('button', { name: 'Continue', exact: true }).click();
      await expect(epilogue).toBeHidden(); await route.objective('O12', true);
      await page.screenshot({ path: info.outputPath(`T078-${variant.length}m-complete.png`), fullPage: true });
      if (!variant.authenticated) {
        await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('2'); await closeFrame(page);
        for (const width of [768, 390]) {
          await page.setViewportSize({ width, height: 900 });
          await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-room.png`), fullPage: true });
          await route.contained();
          await route.click('Validate repair');
          await expect(validation).toHaveAttribute('aria-modal', 'true');
          await validation.getByRole('button', { name: 'Classify permanent restoration', exact: true }).scrollIntoViewIfNeeded();
          await expect(page.getByRole('button', { name: 'Close repair controls', exact: true })).toBeInViewport();
          await page.screenshot({ path: info.outputPath(`T078-${width}-200percent-validation.png`), fullPage: true });
          const closeBox = (await page.getByRole('button', { name: 'Close repair controls', exact: true }).boundingBox())!;
          const gameBox = (await validation.locator('.nq-panel-game').boundingBox())!;
          expect(closeBox.x + closeBox.width <= gameBox.x || gameBox.x + gameBox.width <= closeBox.x
            || closeBox.y + closeBox.height <= gameBox.y || gameBox.y + gameBox.height <= closeBox.y).toBe(true);
          // The full-page and active-dialog axe attempts crash this Firefox
          // renderer; first-route.md records that unresolved T152 audit. Keep
          // actual keyboard, focus, scroll and bounds assertions executable.
          await route.click('Close repair controls');
        }
        await page.setViewportSize({ width: 1280, height: 900 });
        await openFrame(page, 'Sound and reading'); await page.getByRole('slider', { name: 'Text size', exact: true }).fill('1'); await closeFrame(page);
      }
      await route.click('Notebook');
      await expect(page.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(notes);
      await route.click('Close notebook');
      expect(writes).toEqual([]);

      if (variant.authenticated) {
        await route.click('Save'); await route.click('Save this adventure');
        await expect(page.getByText(/^Saved at /)).toBeVisible();
        const saved = await local.inspectSlot(); expect(saved).not.toBeNull();
        expect(saved!.snapshot.world.completedObjectiveIds).toEqual(expect.arrayContaining(Object.keys(objectiveLabels).map(id => `spec001:${id}`)));
        for (const id of ['O05', 'O06', 'O07', 'O08']) expect(saved!.snapshot.world.completedObjectiveIds).not.toContain(`spec001:${id}`);
        expect(saved!.snapshot.notebook.personalNotes).toBe(notes);
        expect(saved!.snapshot.assistance).toEqual(expect.arrayContaining([expect.objectContaining({ objectiveId: 'spec001:O03', level: 3 })]));
        expect(saved!.snapshot.notebook.measurements.some(m => m.stale)).toBe(true);
        await page.reload(); await expect(page.getByRole('button', { name: 'Continue', exact: true })).toHaveAttribute('aria-disabled', 'false'); await route.click('Continue');
        await route.room('The Iron Threshold'); await route.objective('O12', true);
        expect(writes).toHaveLength(1); expect((await local.inspectSlot())!.raw).toBe(saved!.raw);
      } else expect(await local.inspectSlot()).toBeNull();
    } finally {
      try { await context?.close(); } finally { await local.stop(); }
      expect(errors).toEqual([]); expect(external).toEqual([]);
    }
  });
}

function controls(page: Page, input: Input) {
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const closeWithKeyboard = async () => {
    const close = page.locator('.nq-frame-window.nq-window-active .nq-window-close:visible');
    if (await close.count()) await close.press('Enter');
  };
  const revealWithKeyboard = async (name: string) => {
    const target = button(name), actionable = async () => await target.isVisible() && await target.evaluate(el => !el.closest('[inert]'));
    if (await actionable()) return target;
    const scene = await page.locator('.nq-frame-window[aria-label="Scene objects and exits"]').getByRole('button', { name, exact: true, includeHidden: true }).count() > 0;
    const game = ['New Adventure', 'Continue', 'Restore Save', 'Save', 'Settings', 'Credits'].includes(name);
    const toolbar = ['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium', 'Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name);
    if (scene || game || toolbar) {
      await closeWithKeyboard();
      if (await actionable()) return target;
      if (scene) await button('Scene').press('Enter');
      else if (game) {
        const panelGame = page.locator('.nq-window-active .nq-panel-game');
        await (await panelGame.count() ? panelGame : button('Game')).press('Enter');
      }
    }
    await expect(target).toBeVisible(); return target;
  };
  const click = async (name: string) => {
    // The application-owned panel opener is in the same compact frame toolbar.
    if (['Scene', 'Evidence', 'Diagnostics', 'Repair plan', 'Validate repair'].includes(name)) {
      if (input === 'keyboard') await closeWithKeyboard(); else await closeFrame(page);
    }
    const control = input === 'keyboard' ? await revealWithKeyboard(name) : await revealControl(page, name);
    if (input === 'keyboard') await control.press('Enter'); else await control.click();
  };
  const room = async (name: string) => {
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    await expect(page.locator('.nq-graybox')).toHaveAttribute('data-rendered', 'true');
    await expect(page.locator('.nq-graybox canvas')).toBeVisible();
    expect(await page.locator('button:visible').evaluateAll(buttons => buttons.every(button => button.closest('.nq-game') !== null))).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1)).toBe(true);
  };
  const diagnostic = () => page.getByRole('dialog', { name: 'Diagnostics', exact: true });
  const readings = () => diagnostic().locator('ol[aria-label="Recorded measurements"] > li');
  const contained = async () => {
    expect(await page.locator('.nq-game').evaluate(frame => {
      const bounds = frame.getBoundingClientRect();
      return [...frame.querySelectorAll<HTMLElement>('.nq-game-toolbar button:not([hidden])')].every(control => {
        const box = control.getBoundingClientRect();
        return box.width === 0 || (box.left >= bounds.left && box.right <= bounds.right && box.top >= bounds.top && box.bottom <= bounds.bottom);
      });
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  };
  const windowBehavior = async (name: 'Diagnostics' | 'Validate repair') => {
    const panel = page.getByRole('dialog', { name, exact: true });
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    expect(await page.locator('.nq-game-toolbar').evaluate(el => !!el.closest('[inert]'))).toBe(true);
    const game = panel.locator('.nq-panel-game'); await game.press('Enter');
    await expect(page.getByRole('dialog', { name: 'Game menu', exact: true })).toHaveAttribute('aria-modal', 'true');
    await expect(page.locator('[aria-modal="true"]')).toHaveCount(1);
    expect(await page.getByRole('dialog', { name, exact: true, includeHidden: true }).evaluate(el => !!el.closest('[inert]'))).toBe(true);
    await page.keyboard.press('Escape'); await expect(panel).toHaveAttribute('aria-modal', 'true'); await expect(game).toBeFocused();
    await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(button(name)).toBeFocused();
    await click(name); await expect(panel).toHaveAttribute('aria-modal', 'true');
    await page.keyboard.press('Shift+Tab'); expect(await panel.evaluate(el => el.contains(document.activeElement))).toBe(true);
  };
  return { click, room, diagnostic, readings, contained, windowBehavior,
    verb: async (name: 'Walk' | 'Look' | 'Talk' | 'Use') => { await click(name); await expect(button(name)).toHaveAttribute('aria-pressed', 'true'); },
    walk: async (name: string, label = `Walk to ${name}`) => { await click('Walk'); await click(label); await room(name); },
    diagnostics: async () => { await click('Diagnostics'); await expect(diagnostic()).toBeVisible(); },
    closeDiagnostics: async () => { await click('Close diagnostics'); await expect(diagnostic()).toBeHidden(); },
    submitLatest: async () => { const target = readings().last().getByRole('button', { name: 'Submit this reading', exact: true }); if (input === 'keyboard') await target.press('Enter'); else await target.click(); },
    objective: async (id: keyof typeof objectiveLabels, complete: boolean) => {
      await click('Notebook');
      const row = page.getByRole('dialog', { name: 'Notebook', exact: true }).locator('ul[aria-label="Objectives"] > li').filter({ hasText: objectiveLabels[id] });
      await expect(row).toHaveCount(1); await expect(row).toContainText(complete ? 'Completed' : 'In progress'); await click('Close notebook');
    },
  };
}
