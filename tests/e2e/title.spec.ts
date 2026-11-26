// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { clickButton, pressButton, openFrame, closeFrame } from './support/adventure-controls';
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
  async function start() { await pressButton(page, 'New Adventure', 'Enter'); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); }
  async function look(name: string) { await clickButton(page, 'Look'); await clickButton(page, name); }
  async function walk(name: string) { await clickButton(page, 'Walk'); await clickButton(page, name); }
  async function finishIntroduction() {
    await look('Look at power indication'); await clickButton(page, 'Look at link indication');
    await clickButton(page, 'Talk'); await clickButton(page, 'Talk to Photon the Firefly'); await clickButton(page, 'Skip dialogue');
    await clickButton(page, 'Use'); await clickButton(page, 'Inspect physical path'); await expect(page.getByRole('status')).toHaveText('Valid inspection recorded.');
    await walk("Walk to The Titan's Workshop");
    await clickButton(page, 'Talk'); await clickButton(page, 'Talk to the Titan'); await clickButton(page, 'Skip dialogue');
    await look('Identify known-good endpoints'); await clickButton(page, 'Identify physical path under test');
    await clickButton(page, 'Notebook'); await notebook().getByRole('textbox', { name: 'Hypothesis', exact: true }).fill('An alternative idea: inspect the path and compare the readings.');
    await notebook().getByRole('button', { name: 'Pin hypothesis', exact: true }).click();
    await expect(notebook().getByRole('region', { name: 'Objectives', exact: true }).getByRole('listitem').filter({ hasText: 'Completed' })).toHaveCount(2);
    await clickButton(page, 'Close notebook');
  }

  test('native title choices, readable sign-in Continue and genuine R01 controls at narrow width', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    for (const name of ['New Adventure', 'Continue', 'Settings', 'Credits']) await expect(button(name)).toBeVisible();
    await pressButton(page, 'Continue', 'Enter'); await expect(page.getByRole('dialog', { name: 'Sign in to save', exact: true })).toBeVisible(); await pressButton(page, 'Cancel sign-in', 'Enter');
    await clickButton(page, 'Settings'); await expect(page.getByRole('dialog', { name: 'Settings', exact: true })).toContainText('Autosave is off'); await pressButton(page, 'Close settings', 'Enter');
    await clickButton(page, 'Credits'); await expect(page.getByRole('dialog', { name: 'Credits', exact: true })).toContainText('John Capobianco'); await clickButton(page, 'Close credits');
    await start(); await expect(page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeFocused();
    for (const name of ['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium']) await expect(button(name)).toBeVisible();
    await openFrame(page,'Game'); await expect(page.getByText('Guest — progress is only in this session.', { exact: true })).toBeVisible(); await closeFrame(page);
    await expect(page.getByRole('textbox', { name: /API key|email|password/i })).toHaveCount(0);
    await page.screenshot({ path: '.local/T029-title-arrival-390px.png', fullPage: true });
    const accessibility = await new AxeBuilder({ page }).analyze(); expect(accessibility.violations).toEqual([]);
  });

  test('real tutorial invites sign-in once, decline retains play and literal notes without a write or provider navigation', async () => {
    await start(); await finishIntroduction();
    const invitation = page.getByRole('dialog', { name: 'Sign in to save', exact: true });
    await expect(invitation).toBeVisible(); await expect(invitation).toContainText('Sign in to save your adventure.');
    await expect(invitation.getByRole('button', { name: 'Google', exact: true })).toHaveAttribute('aria-disabled', 'false');
    await pressButton(page, 'Continue as guest', 'Enter'); await expect(invitation).toBeHidden();
    await clickButton(page, 'Notebook'); await notebook().getByRole('textbox', { name: 'Personal notes', exact: true }).fill('Keep <b>my notes</b> W L T U'); await clickButton(page, 'Close notebook');
    await walk('Walk to The Arrival Lift'); await walk("Walk to The Titan's Workshop"); await clickButton(page, 'Notebook');
    await expect(notebook().getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue('Keep <b>my notes</b> W L T U'); await expect(notebook().locator('b')).toHaveCount(0);
    await clickButton(page, 'Close notebook'); await expect(invitation).toBeHidden();
    await clickButton(page, 'Save'); await expect(invitation).toBeVisible(); await clickButton(page, 'Continue as guest');
    await expect(page.getByText(/^(Saved|Saving|Saved at\b|Adventure saved|Progress saved)/i)).toHaveCount(0);
    expect(context.pages().filter(tab => tab.url() !== 'about:blank')).toEqual([page]);
  });

  test('New Adventure cancellation retains active notes and confirmed start creates an empty run; reload is honest', async () => {
    await start(); await clickButton(page, 'Notebook'); const notes = notebook().getByRole('textbox', { name: 'Personal notes', exact: true });
    await notes.fill('Do not discard this note accidentally.'); await clickButton(page, 'Close notebook');
    await clickButton(page, 'New Adventure'); const warning = page.getByRole('dialog', { name: 'Start a new adventure?', exact: true });
    await expect(warning).toContainText('unsaved notes'); await warning.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
    await clickButton(page, 'Notebook'); await expect(notes).toHaveValue('Do not discard this note accidentally.'); await clickButton(page, 'Close notebook');
    await clickButton(page, 'New Adventure'); await warning.getByRole('button', { name: 'Start new adventure', exact: true }).tap();
    await expect(page.locator('.nq-shell-status')).toBeEmpty(); await expect(page.locator('.nq-shell-status')).toBeHidden();
    await clickButton(page, 'Notebook'); await expect(notes).toHaveValue(''); await expect(notebook().getByRole('region', { name: 'Objectives', exact: true })).not.toContainText('Completed');
    await page.reload(); await expect(page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible(); await expect(button('Continue')).toHaveAttribute('aria-disabled', 'true');
  });
});
