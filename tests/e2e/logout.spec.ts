// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test, expect, button, dialog, contract, installCookie } from './support/t056-journey';

test.describe('T056 independent native logout contract', () => {
  test('SAVE13 Cancel changes no request or adventure; confirmed revocation clears editors and restores only durable data later', async ({ journey: j }, _info) => {
    contract('SAVE13'); await j.start(); await j.notes('Durable before logout'); await j.firstSave(); const saved = await j.local.inspectSlot();
    await j.notes('Unsaved sensitive notebook'); await button(j.page, 'Settings').click(); await button(j.page, 'Log out').click();
    await expect(dialog(j.page, 'Settings')).toContainText('Unsaved progress and notes'); const count = j.mutations.length;
    await button(j.page, 'Cancel').press('Enter'); expect(j.mutations.length).toBe(count); await button(j.page, 'Close settings').click(); await j.expectNotes('Unsaved sensitive notebook');
    await button(j.page, 'Settings').click(); await button(j.page, 'Log out').click(); await button(j.page, 'Confirm logout').press('Enter');
    await expect(dialog(j.page, 'Settings')).toContainText('Logout confirmed'); await expect(j.page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
    expect(await j.local.inspectSlot()).toEqual(saved); expect(j.writes().length).toBe(1); expect(j.mutations.filter(m => m.path.endsWith('/logout')).length).toBe(1);
    await expect(j.page.getByRole('textbox', { name: 'Personal notes', includeHidden: true })).toHaveValue('');
    expect(await j.page.evaluate(() => document.body.textContent?.includes('Unsaved sensitive notebook'))).toBe(false);
    await j.page.screenshot({ path: _info.outputPath('T056-logout-cleared.png'), fullPage: true });
    await installCookie(j.context, (await j.local.syntheticSession('github')).cookie); await j.page.reload(); await button(j.page, 'Continue').click(); await j.expectNotes('Durable before logout');
    expect(await j.local.inspectSlot()).toEqual(saved); expect(j.writes().length).toBe(1);
  });

  for (const commitFirst of [false, true]) test(`SAVE13 delayed save ${commitFirst ? 'commits before' : 'arrives after'} logout; late result cannot resurrect adventure`, async ({ journey: j }, _info) => {
    contract('SAVE13', 'SAVE09'); await j.start(); await j.notes('Original slot'); await j.firstSave(); await j.notes('Pending save capture');
    let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; }); let reached!: () => void; const intercepted = new Promise<void>(resolve => { reached = resolve; });
    let lateStatus: number | undefined;
    await j.page.route('**/api/v1/save', async route => {
      if (route.request().method() !== 'PUT') return route.continue();
      const response = commitFirst ? await j.local.forwardNative(route.request()) : null; reached(); await held;
      const result = response ?? await j.local.forwardNative(route.request()); lateStatus = result.status;
      await route.fulfill(result).catch(() => {});
    });
    try {
      await button(j.page, 'Save').click(); await intercepted;
      await button(j.page, 'Settings').click(); await button(j.page, 'Log out').click(); await button(j.page, 'Confirm logout').click();
      await expect(dialog(j.page, 'Settings')).toContainText('Logout confirmed'); release();
      await expect.poll(() => lateStatus).toBe(commitFirst ? 200 : 401);
      await expect(j.page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
      const current = await j.local.inspectSlot(); expect(current?.revision).toBe(commitFirst ? 2 : 1);
      expect(current?.snapshot.notebook.personalNotes).toBe(commitFirst ? 'Pending save capture' : 'Original slot');
      expect(j.writes().length).toBe(2); expect(j.mutations.filter(m => m.path.endsWith('/logout')).length).toBe(1);
      await expect(j.page.getByRole('textbox', { name: 'Personal notes', includeHidden: true })).toHaveValue('');
    } finally { release(); }
  });
});
