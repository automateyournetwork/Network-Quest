// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { test, expect, button, dialog, contract, installCookie, type Journey } from './support/t056-journey';

const statusPath = '**/api/v1/account/deletion-status';
const deletes = (j: Journey) => j.mutations.filter(m => m.method === 'DELETE');
const checks = (j: Journey) => j.mutations.filter(m => m.path.endsWith('/deletion-status'));
async function anchor(j: Journey) { contract('SAVE12'); await j.start(); await j.notes('Deletion prepared notes'); await j.firstSave(); await j.deletionReady(); }
async function privateReceipt(j: Journey) {
  const removal = deletes(j); expect(removal.length).toBe(1); const receipt = removal[0]!.headers['x-deletion-receipt']!;
  expect(/^[A-Za-z0-9_-]{43}$/.test(receipt)).toBe(true);
  for (const check of checks(j)) { expect(check.headers['x-deletion-receipt'] === receipt).toBe(true); expect(check.headers['x-csrf-token']).toBeUndefined(); expect(check.headers['origin']).toBe(j.local.origin); }
  expect(await j.page.evaluate(value => location.href.includes(value) || document.body.textContent?.includes(value), receipt)).toBe(false);
  expect(await j.page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length }))).toEqual({ local: 0, session: 0 });
}

test.describe('T056 operation-specific native deletion status', () => {
  test('lost committed DELETE confirms through the actual completed receipt even after all account sessions disappear', async ({ journey: j }, _info) => {
    await anchor(j);
    await j.page.route('**/api/v1/account', async route => { expect(await j.local.commitAndLoseResponse(route.request())).toBe(204); await route.abort('failed'); });
    await button(j.page, 'Delete account now').click(); await expect(dialog(j.page, 'Settings')).toContainText('Account deletion confirmed');
    expect(await j.local.inspectAccount()).toMatchObject({ accounts: 0, identities: 0, sessions: 0, saves: 0, preferences: 0 });
    expect(checks(j).length).toBe(1); await privateReceipt(j);
    await j.page.screenshot({ path: _info.outputPath('T056-receipt-state.png'), fullPage: true });
    await expect(j.page.getByRole('heading', { name: 'Network Quest', exact: true })).toBeVisible();
  });

  test('prepared durable pending receipt stays unconfirmed and status reads do not reconcile or delete live rows', async ({ journey: j }, _info) => {
    await anchor(j); const original = await j.local.inspectSlot();
    await j.page.route('**/api/v1/account', async route => { await j.local.prepareDeletion((await route.request().allHeaders())['x-deletion-receipt']!); await route.abort('failed'); });
    await button(j.page, 'Delete account now').click(); await expect(dialog(j.page, 'Settings')).toContainText('Deletion is pending. It has not been confirmed complete.');
    expect(checks(j).length).toBe(1); expect(await j.local.inspectSlot()).toEqual(original); expect((await j.local.inspectAccount()).accounts).toBe(1);
    await expect(j.page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); await privateReceipt(j);
    await j.page.screenshot({ path: _info.outputPath('T056-pending-receipt.png'), fullPage: true });
    await button(j.page, 'Close settings').click(); await j.expectNotes('Deletion prepared notes'); expect(deletes(j).length).toBe(1);
  });

  for (const state of ['unknown', 'expired'] as const) test(`${state} receipt never proves deletion or triggers a second DELETE/sign-in`, async ({ journey: j }, _info) => {
    await anchor(j);
    await j.page.route('**/api/v1/account', async route => {
      if (state === 'expired') await j.local.prepareDeletion((await route.request().allHeaders())['x-deletion-receipt']!, true);
      else await j.local.expireSession((await route.request().allHeaders())['cookie']!);
      await route.abort('failed');
    });
    await button(j.page, 'Delete account now').click(); await expect(dialog(j.page, 'Settings')).toContainText('This receipt is unknown, expired or no longer available.');
    await expect(dialog(j.page, 'Settings')).not.toContainText('Account deletion confirmed'); await expect(button(j.page, 'Check deletion status')).toBeHidden();
    await expect(j.page.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); expect(checks(j).length).toBe(1); await privateReceipt(j);
    expect(j.mutations.filter(m => m.path.endsWith('/auth/github/start')).length).toBe(1);
    expect((await j.local.inspectAccount()).accounts).toBe(state === 'expired' ? 0 : 1);
    // A fresh unauthenticated session is observation only, never evidence of deletion.
    const session = await j.page.evaluate(async () => (await fetch('/arcade/play/network-quest/api/v1/session', { credentials: 'same-origin' })).json() as Promise<{ state: string }>);
    expect(session.state).toBe('guest'); await expect(dialog(j.page, 'Settings')).not.toContainText('Account deletion confirmed');
    await j.page.screenshot({ path: _info.outputPath(`T056-${state}-receipt.png`), fullPage: true });
  });

  test('status network loss followed by reload loses the memory-only receipt without repeating deletion', async ({ journey: j }, _info) => {
    await anchor(j); const original = await j.local.inspectSlot();
    await j.page.route('**/api/v1/account', route => route.abort('failed'));
    await j.page.route(statusPath, route => route.abort('failed'));
    await button(j.page, 'Delete account now').click(); await expect.poll(() => checks(j).length).toBe(1);
    await expect(dialog(j.page, 'Settings')).toContainText('Deletion is unconfirmed'); expect(await j.local.inspectSlot()).toEqual(original); await privateReceipt(j);
    await j.page.reload(); await expect(j.page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible(); await button(j.page, 'Settings').click();
    await expect(button(j.page, 'Check deletion status')).toBeHidden(); await expect(dialog(j.page, 'Settings')).not.toContainText('Account deletion confirmed');
    expect(checks(j).length).toBe(1); expect(deletes(j).length).toBe(1); expect(await j.local.inspectSlot()).toEqual(original);
  });

  test('late completed receipt from deleted account cannot clear a later synthetic Google account or its adventure', async ({ journey: j }, _info) => {
    await anchor(j); let release!: () => void; const held = new Promise<void>(resolve => { release = resolve; });
    let reached!: () => void; const captured = new Promise<void>(resolve => { reached = resolve; }); let delivered = false;
    await j.page.route('**/api/v1/account', async route => { expect(await j.local.commitAndLoseResponse(route.request())).toBe(204); await route.abort('failed'); });
    await j.page.route(statusPath, async route => { const result = await j.local.forwardNative(route.request()); expect(result.status).toBe(200); expect(JSON.parse(result.body).state).toBe('completed'); reached(); await held; await route.fulfill(result).catch(() => {}); delivered = true; });
    try {
      await button(j.page, 'Delete account now').click(); await captured; await button(j.page, 'Close settings').click();
      await button(j.page, 'Save').click(); await expect(dialog(j.page, 'Sign in to save')).toBeVisible();
      const popup = await j.openProvider('Google'); const next = await j.local.syntheticSession('google'); await installCookie(j.context, next.cookie);
      await popup.bringToFront(); await j.page.bringToFront(); if (await button(j.page, 'Check Session').isVisible()) await button(j.page, 'Check Session').click();
      await expect(dialog(j.page, 'Save this adventure?')).toBeVisible(); await button(j.page, 'Cancel').click();
      await j.start(); await j.notes('Later Google account survives'); await j.firstSave(); const current = await j.local.inspectSlot('google');
      release(); await expect.poll(() => delivered).toBe(true);
      await expect(j.page.getByText('Synthetic T056 Google player (google)', { exact: true })).toBeVisible(); await j.expectNotes('Later Google account survives');
      expect(await j.local.inspectSlot('google')).toEqual(current); expect((await j.local.inspectAccount()).accounts).toBe(1); expect(deletes(j).length).toBe(1);
      await button(j.page, 'Settings').click(); await expect(dialog(j.page, 'Settings')).not.toContainText('Account deletion confirmed');
      await j.page.screenshot({ path: _info.outputPath('T056-later-account-survives.png'), fullPage: true });
    } finally { release(); }
  });
});
