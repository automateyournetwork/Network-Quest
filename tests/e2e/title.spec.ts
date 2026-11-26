// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { localTls } from './support/local-tls';

test.describe('T029 real title and memory-only introduction bootstrap', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof localTls>>, context: BrowserContext, page: Page;
  let requests: string[], errors: string[];
  test.beforeEach(async () => {
    local = await localTls();
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, hasTouch: true, reducedMotion: 'reduce' }); }
    catch (error) { await local.stop(); throw error; }
    page = await context.newPage(); requests = []; errors = [];
    page.on('pageerror', error => errors.push(error.message));
    context.on('request', request => {
      const url = new URL(request.url());
      if ((/^https?:$/.test(url.protocol) && url.origin !== new URL(local.url).origin) || (url.pathname.includes('/api/') && request.method() !== 'GET')) requests.push(`${request.method()} ${url.pathname}`);
    });
    expect((await page.goto(local.url))?.status()).toBe(200);
  });
  test.afterEach(async () => { try { await context?.close(); } finally { await local?.stop(); } expect(errors).toEqual([]); expect(requests).toEqual([]); });
  const button = (name: string) => page.getByRole('button', { name, exact: true });
  const notebook = () => page.getByRole('dialog', { name: 'Notebook', exact: true });
  async function start() { await button('New Adventure').press('Enter'); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); }
  async function look(name: string) { await button('Look').click(); await button(name).click(); }
  async function walk(name: string) { await button('Walk').click(); await button(name).click(); }
  async function finishIntroduction() {
    await look('Look at power indication'); await button('Look at link indication').click();
    await button('Talk').click(); await button('Talk to Photon the Firefly').click(); await button('Skip dialogue').click();
    await button('Use').click(); await button('Inspect physical path').click(); await expect(page.getByRole('status')).toHaveText('Valid inspection recorded.');
    await walk("Walk to The Titan's Workshop");
    await button('Talk').click(); await button('Talk to the Titan').click(); await button('Skip dialogue').click();
    await look('Identify known-good endpoints'); await button('Identify physical path under test').click();
    await button('Notebook').click(); await notebook().getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('An alternative idea: inspect the path and compare the readings.');
    await notebook().getByRole('button', { name: 'Pin hypothesis', exact: true }).click();
    await expect(notebook().getByRole('region', { name: 'Objectives', exact: true }).getByRole('listitem').filter({ hasText: 'Completed' })).toHaveCount(2);
    await button('Close notebook').click();
  }

  test('native title choices, readable unavailable Continue and genuine R01 controls at narrow width', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of ['New Adventure', 'Continue', 'Settings', 'Credits']) await expect(button(name)).toBeVisible();
    await button('Continue').press('Enter'); await expect(page.getByText('No confirmed account save is available to continue. Choose New Adventure to play as a guest.', { exact: true })).toBeVisible();
    await button('Settings').click(); await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toContainText('Autosave: off'); await button('Close settings').press('Enter');
    await button('Credits').click(); await expect(page.getByRole('dialog', { name: 'Credits', exact: true })).toContainText('John Capobianco'); await button('Close credits').click();
    await start(); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeFocused();
    for (const name of ['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium']) await expect(button(name)).toBeVisible();
    await expect(page.getByText('Guest — progress is only in this session.', { exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: /API key|email|password/i })).toHaveCount(0);
    const accessibility = await new AxeBuilder({ page }).analyze(); expect(accessibility.violations).toEqual([]);
    await page.screenshot({ path: '.local/T029-title-arrival-390px.png', fullPage: true });
  });

  test('real tutorial invites sign-in once, decline retains play and literal notes without a write or provider navigation', async () => {
    await start(); await finishIntroduction();
    const invitation = page.getByRole('dialog', { name: 'Sign in to save', exact: true });
    await expect(invitation).toBeVisible(); await expect(invitation).toContainText('Sign in to save your adventure.');
    await expect(invitation.getByRole('button', { name: 'Google', exact: true })).toHaveAttribute('aria-disabled', 'true');
    await button('Continue as guest').press('Enter'); await expect(invitation).toBeHidden();
    await button('Notebook').click(); await notebook().getByRole('textbox', { name: 'Personal notes', exact: true }).fill('Keep <b>my notes</b> W L T U'); await button('Close notebook').click();
    await walk('Walk to The Arrival Lift'); await walk("Walk to The Titan's Workshop"); await button('Notebook').click();
    await expect(notebook().getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue('Keep <b>my notes</b> W L T U'); await expect(notebook().locator('b')).toHaveCount(0);
    await button('Close notebook').click(); await expect(invitation).toBeHidden();
    await button('Save').click(); await expect(invitation).toBeVisible(); await button('Continue as guest').click();
    await expect(page.getByText(/^(Saved|Saving|Saved at\b|Adventure saved|Progress saved)/i)).toHaveCount(0);
    expect(context.pages().filter(tab => tab.url() !== 'about:blank')).toEqual([page]);
  });

  test('New Adventure cancellation retains active notes and confirmed start creates an empty run; reload is honest', async () => {
    await start(); await button('Notebook').click(); const notes = notebook().getByRole('textbox', { name: 'Personal notes', exact: true });
    await notes.fill('Do not discard this note accidentally.'); await button('Close notebook').click();
    await button('New Adventure').click(); const warning = page.getByRole('dialog', { name: 'Start a new adventure?', exact: true });
    await expect(warning).toContainText('unsaved notes'); await warning.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
    await button('Notebook').click(); await expect(notes).toHaveValue('Do not discard this note accidentally.'); await button('Close notebook').click();
    await button('New Adventure').click(); await warning.getByRole('button', { name: 'Start new adventure', exact: true }).tap();
    await expect(page.getByRole('status')).toHaveText('');
    await button('Notebook').click(); await expect(notes).toHaveValue(''); await expect(notebook().getByRole('region', { name: 'Objectives', exact: true })).not.toContainText('Completed');
    await page.reload(); await expect(page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible(); await expect(button('Continue')).toHaveAttribute('aria-disabled', 'true');
  });
});
