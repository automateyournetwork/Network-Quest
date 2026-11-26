// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { configuredSave } from './support/configured-save';

test.describe('T050 actual application and isolated configured native HTTPS save service', () => {
  test.describe.configure({ mode: 'default' });
  let local: Awaited<ReturnType<typeof configuredSave>>, context: BrowserContext, page: Page;
  let errors: string[], writes: { key: string; body: string }[];
  test.beforeEach(async () => {
    local = await configuredSave(); errors = []; writes = [];
    try { context = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, reducedMotion: 'reduce', hasTouch: true }); }
    catch (error) { await local.stop(); throw error; }
    const [name, value] = local.cookies[0]!.split('=');
    await context.addCookies([{ name: name!, value: value!, domain: '127.0.0.1', path: '/arcade/play/network-quest/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
    context.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
    context.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith('/save')) {
      expect(request.headers()['origin']).toBe(local.origin);
      expect(request.headers()['referer']).toBe(local.origin + '/');
      writes.push({ key: request.headers()['idempotency-key']!, body: request.postData()! });
    } });
    page = await context.newPage(); await page.goto(local.url);
    await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
  });
  test.afterEach(async () => { try { await context?.close(); } finally { await local?.stop(); } expect(errors).toEqual([]); });
  const button = (name: string, tab = page) => tab.getByRole('button', { name, exact: true });
  const dialog = (name: string, tab = page) => tab.getByRole('dialog', { name, exact: true });
  async function start(tab = page) { await button('New Adventure', tab).click(); await button('Start new adventure', tab).press('Enter'); await expect(tab.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); }
  async function notes(value: string, tab = page) { await button('Notebook', tab).click(); await dialog('Notebook', tab).getByRole('textbox', { name: 'Personal notes', exact: true }).fill(value); await button('Close notebook', tab).click(); }
  async function expectNotes(value: string, tab = page) { await button('Notebook', tab).click(); await expect(dialog('Notebook', tab).getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(value); await button('Close notebook', tab).click(); }
  async function firstSave() { await button('Save').click(); await button('Save this adventure').press('Enter'); await expect(page.getByText(/^Saved at /)).toBeVisible(); }

  test('manual empty-slot consent, Cancel, exact restore and reload Continue through actual PHP', async () => {
    await start(); await notes('Literal <b>server notes</b> W L T U');
    await button('Save').press('Enter'); await expect(dialog('Save this adventure?')).toBeVisible();
    await dialog('Save this adventure?').getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
    await expect(button('Save')).toBeFocused(); expect(await local.inspect()).toBeNull();
    await firstSave(); expect((await local.inspect())?.revision).toBe(1); await notes('Unsaved local notes');
    await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    await button('Restore Save').press('Enter'); await expect(dialog('Load the server adventure?')).toContainText('unsaved notes');
    await dialog('Load the server adventure?').getByRole('button', { name: 'Cancel', exact: true }).click(); await expectNotes('Unsaved local notes');
    await button('Restore Save').click(); await button('Discard current progress and load').press('Enter');
    await expectNotes('Literal <b>server notes</b> W L T U'); expect(writes).toHaveLength(1);
    await page.reload(); await expect(button('Continue')).toHaveAttribute('aria-disabled', 'false');
    await button('Continue').press('Enter'); await expectNotes('Literal <b>server notes</b> W L T U');
    expect((await local.inspect())?.revision).toBe(1); expect(writes).toHaveLength(1);
  });

  test('New Adventure preserves slot; reviewed replacement is deliberate, accessible and scoped to current ETag', async () => {
    await start(); await notes('old durable adventure'); await firstSave(); const original = await local.inspect();
    await button('New Adventure').click(); await button('Start new adventure').click(); await notes('new adventure');
    expect(await local.inspect()).toEqual(original); await button('Save').click();
    const choice = dialog('Review the account save'); await expect(choice).toContainText('Chapter: spec001. Room: spec001:R01.');
    await button('Replace With This Adventure').press('Enter'); await expect(dialog('Replace the server save?')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 }); await page.addStyleTag({ content: ':root { font-size: 200%; }' });
    await expect(dialog('Replace the server save?').getByRole('heading')).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.screenshot({ path: '.local/T050-replacement-390px-200text.png', fullPage: true });
    const accessibility = await new AxeBuilder({ page }).analyze(); expect(accessibility.violations).toEqual([]);
    await button('Confirm replacement').tap(); await expect(page.getByText(/^Saved at /)).toBeVisible();
    const current = await local.inspect(); expect(current?.revision).toBe(2); expect(current?.snapshot.adventureId).not.toBe(original?.snapshot.adventureId);
    expect(current?.snapshot.notebook.personalNotes).toBe('new adventure'); expect(writes[0]!.key).not.toBe(writes[1]!.key);
  });

  test('another native tab advances the slot after review: 412 requires fresh review and fresh consent', async () => {
    await start(); await notes('revision one'); await firstSave();
    const other = await context.newPage(); await other.goto(local.url); await expect(button('Continue', other)).toHaveAttribute('aria-disabled', 'false'); await button('Continue', other).click();
    await button('New Adventure').click(); await button('Start new adventure').click(); await notes('replacement candidate');
    await button('Save').click(); await button('Replace With This Adventure').click();
    await notes('other tab revision two', other); await button('Save', other).click(); await expect(other.getByText(/^Saved at /)).toBeVisible();
    expect((await local.inspect())?.revision).toBe(2);
    await button('Confirm replacement').click(); await expect(dialog('The server save changed')).toBeVisible(); expect((await local.inspect())?.revision).toBe(2);
    await button('Review Server Save').click(); await expect(dialog('Review the account save')).toContainText('Revision: 2.');
    await button('Replace With This Adventure').click(); await button('Confirm replacement').click();
    await expect(page.getByText(/^Saved at /)).toBeVisible(); expect((await local.inspect())?.revision).toBe(3);
    expect(writes).toHaveLength(4); expect(writes[2]!.key).not.toBe(writes[3]!.key);
    await page.screenshot({ path: '.local/T050-native-conflict-recovered.png', fullPage: true });
  });

  test('lost response after actual commit retains frozen retry while newer notes remain dirty', async () => {
    await start(); await notes('captured committed notes');
    await page.route('**/api/v1/save', async route => {
      if (route.request().method() !== 'PUT') { await route.continue(); return; }
      expect([200, 201]).toContain(await local.commitAndLoseResponse(route.request())); await route.abort('failed');
    });
    await button('Save').click(); await button('Save this adventure').click(); await expect(dialog('Save outcome unconfirmed')).toBeVisible();
    expect((await local.inspect())?.revision).toBe(1); await button('Keep Playing Without Saving').click(); await notes('later unsaved notes');
    await button('Save').click(); await page.unroute('**/api/v1/save'); await button('Retry pending save').click();
    await expect(dialog('Save outcome unconfirmed')).toBeHidden(); await expect(page.getByText('Unsaved changes', { exact: true })).toBeVisible();
    expect(writes).toHaveLength(2); expect(writes[1]).toEqual(writes[0]); expect((await local.inspect())?.revision).toBe(1);
    expect((await local.inspect())?.snapshot.notebook.personalNotes).toBe('captured committed notes'); await expectNotes('later unsaved notes');
  });

  test('unsupported newer snapshot is preserved and cannot load or overwrite', async () => {
    await start(); await firstSave(); await local.unsupported(); await page.reload();
    await expect(button('Continue')).toHaveAttribute('aria-disabled', 'false'); await button('Continue').click();
    await expect(dialog('Save preserved')).toBeVisible(); await expect(page.getByText(/This save needs a compatible game update/)).toBeVisible();
    await expect(button('Load Existing Save')).toBeHidden(); await expect(button('Replace With This Adventure')).toBeHidden();
    expect((await local.inspect())?.revision).toBe(1); expect(writes).toHaveLength(1);
  });
});
