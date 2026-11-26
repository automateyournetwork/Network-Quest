// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localTls } from './support/local-tls';

/** Actual title → R01 application. No fixture mounting, state injection or fake evaluator. */
test.describe('T034 actual R01 packet introduction', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page;
  let writes: string[], errors: string[], external: string[];
  test.beforeEach(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, hasTouch: true, reducedMotion: 'reduce' }); }
    catch (error) { await local.stop(); throw error; }
    page = await context.newPage(); writes = []; errors = []; external = [];
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => {
      const url = new URL(request.url());
      if (/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) external.push(url.origin);
      if (url.pathname.includes('/api/') && request.method() !== 'GET') writes.push(`${request.method()} ${url.pathname}`);
    });
    expect((await page.goto(local.url))?.status()).toBe(200);
  });
  test.afterEach(async () => { try { await context?.close(); } finally { await local?.stop(); } expect(errors).toEqual([]); expect(writes).toEqual([]); expect(external).toEqual([]); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const journey = () => page.getByRole('dialog', { name: 'Packet journey', exact: true });
  const notebook = () => page.getByRole('dialog', { name: 'Notebook', exact: true });
  async function activate(control: Locator, keyboard = false) { if (keyboard) { await control.focus(); await control.press('Enter'); } else await control.click(); }
  async function start(keyboard = false) { await activate(button('New Adventure'), keyboard); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); }
  async function open(keyboard = false) {
    await activate(button('Look'), keyboard); await activate(button('Look at message capsule'), keyboard);
    await expect(journey()).toBeVisible(); await expect(journey().getByRole('heading')).toHaveText('Inside the test message — payload (1 of 5)');
  }
  async function compare(keyboard = false) {
    for (const phase of ['encode (2 of 5)', 'transmit (3 of 5)', 'decode (4 of 5)', 'compare (5 of 5)']) {
      await activate(journey().getByRole('button', { name: 'Step journey', exact: true }), keyboard);
      await expect(journey().getByRole('heading')).toHaveText(`Inside the test message — ${phase}`);
    }
  }

  test('opens the real capsule and exposes current failing physical evidence without completing an objective', async () => {
    await start(); await open();
    await expect(journey()).toContainText('Current physical result: incorrect. Length only: 105 m; declared fictional maximum 100 m. Excess 5 m.');
    await expect(journey()).toContainText('0x4E 0x51'); await expect(journey()).toContainText('opaque upper-interface frame');
    await expect(journey().getByRole('button', { name: 'Play preview', exact: true })).toBeDisabled();
    await compare();
    await expect(journey()).toContainText('Recovered bits: 01001110 01010000.');
    await expect(journey()).toContainText('Zero-based mismatch positions: 15.');
    await expect(journey()).toContainText('Declared toy substitution applied at position 7: −1 → −3. This trace is supplied separately; length does not predict it.');
    await expect(journey()).toContainText('Known highlighted pattern does not establish transmission success. Return to the investigation.');
    await expect(journey()).toContainText('not universal Layer 1 error detection or Ethernet FCS validation');
    await expect(journey().getByRole('table', { name: 'Seven-realm context' }).getByRole('cell', { name: 'Future content — context only', exact: true })).toHaveCount(6);
    await button('Return to investigation').click(); await button('Notebook').click();
    await expect(notebook().getByRole('region', { name: 'Objectives', exact: true })).not.toContainText('Completed');
    await expect(notebook().getByRole('region', { name: 'Evidence', exact: true })).toContainText('The capsule window highlights payload bytes');
  });

  test('actual path change changes the journey result and keeps notebook readings honest', async () => {
    await start(); await button('Use').click(); await button('Take inspection kit').click(); await button('Inspect physical path').click();
    await open(); await compare(); await button('Return to investigation').click();
    await button('Use').click(); await button('Change physical path').click();
    await open(); await compare();
    await expect(journey()).toContainText('Current physical result: correct. Length only: 95 m; declared fictional maximum 100 m. Headroom 5 m.');
    await expect(journey()).toContainText('Recovered bits: 01001110 01010001.');
    await expect(journey()).toContainText('Known highlighted pattern matches on this current controlled path.');
    await expect(journey()).toContainText('Zero-based mismatch positions: none.');
    await expect(journey()).not.toContainText('Declared toy substitution applied');
    await button('Return to investigation').click(); await button('Notebook').click();
    const measurements = notebook().getByRole('region', { name: 'Evidence', exact: true }).getByRole('listitem').filter({ hasText: 'Channel length:' });
    await expect(measurements).toHaveCount(1); await expect(measurements).toContainText('105 m'); await expect(measurements).toContainText('Freshness: stale');
    await button('Close notebook').click(); await button('Use').click(); await button('Inspect physical path').click(); await button('Notebook').click();
    await expect(measurements).toHaveCount(2); await expect(measurements.filter({ hasText: '95 m' })).toContainText('Freshness: current');
    await expect(notebook().getByRole('region', { name: 'Objectives', exact: true })).not.toContainText('Completed');
  });

  test('keyboard replay, unsafe Save, return focus and narrow touch controls use the actual activity', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await start(true); await open(true);
    await button('Save').press('Enter'); await expect(page.getByText('Finish the current activity before saving.', { exact: true })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Sign in to save', exact: true })).toBeHidden();
    await compare(true); await journey().getByRole('button', { name: 'Replay journey', exact: true }).tap();
    await expect(journey().getByRole('heading')).toHaveText('Inside the test message — payload (1 of 5)');
    await journey().getByRole('button', { name: 'Step journey', exact: true }).tap();
    await expect(journey().getByRole('heading')).toHaveText('Inside the test message — encode (2 of 5)');
    await journey().getByRole('button', { name: 'Return to investigation', exact: true }).press('Escape');
    await expect(journey()).toBeHidden();
    await button('Look').press('Enter'); await button('Look at message capsule').press('Enter');
    await journey().getByRole('button', { name: 'Return to investigation', exact: true }).press('Escape');
    await expect(button('Look at message capsule')).toBeFocused();
    await button('Save').click(); await expect(page.getByRole('dialog', { name: 'Sign in to save', exact: true })).toBeVisible();
  });

  test('real panel stays readable at narrow width and passes automated accessibility', async () => {
    await page.setViewportSize({ width: 390, height: 844 }); await start(); await open(); await compare();
    const samples = journey().getByRole('region', { name: 'Declared toy encoding in supplied order — scrollable table', exact: true });
    await samples.focus(); await samples.press('ArrowRight');
    await expect.poll(() => samples.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
    const accessibility = await new AxeBuilder({ page }).analyze(); expect(accessibility.violations).toEqual([]);
    const bounds = await journey().getByRole('button', { name: 'Return to investigation', exact: true }).boundingBox();
    expect(bounds?.width).toBeGreaterThanOrEqual(44); expect(bounds?.height).toBeGreaterThanOrEqual(44);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: 'test-results/T034-packet-introduction-390px.png', fullPage: true });
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: 'test-results/T034-packet-introduction-desktop.png', fullPage: true });
  });

  test('confirmed New Adventure clears an open journey and starts a fresh paused default path', async () => {
    await start(); await button('Use').click(); await button('Change physical path').click(); await open(); await compare();
    await button('New Adventure').click(); const warning = page.getByRole('dialog', { name: 'Start a new adventure?', exact: true });
    await warning.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(journey()).toBeVisible();
    await expect(journey()).toContainText('Length only: 95 m');
    await button('New Adventure').click(); await warning.getByRole('button', { name: 'Start new adventure', exact: true }).click();
    await expect(journey()).toBeHidden(); await open();
    await expect(journey()).toContainText('Current physical result: incorrect. Length only: 105 m');
    await expect(journey()).toContainText('Recovered bits: not available at this checkpoint.');
    await expect(journey()).not.toContainText('Known highlighted pattern matches on this current controlled path.');
  });
});
