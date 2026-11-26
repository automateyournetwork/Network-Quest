// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T056 independent journeys use the composed app; no page-injected runtime or auth hook.
import { expect, firefox, test as base, type BrowserContext, type Page } from '@playwright/test';
import { configuredSave } from './configured-save';
import cases from '../../fixtures/save-conformance.json' with { type: 'json' };

export type NativeMutation = { method: string; path: string; headers: Record<string, string>; body: string | null };
export type Journey = Awaited<ReturnType<typeof openJourney>>;
export const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
export const dialog = (page: Page, name: string) => page.getByRole('dialog', { name, exact: true });
export function contract(...ids: string[]) {
  for (const id of ids) expect(cases.cases.find(item => item.id === id)?.behavioralAcceptance).toBe('pending');
}
export async function installCookie(context: BrowserContext, cookie: string) {
  const [name, value] = cookie.split('=');
  await context.addCookies([{ name: name!, value: value!, domain: '127.0.0.1', path: '/arcade/play/network-quest/', secure: true, httpOnly: true, sameSite: 'Lax' }]);
}
async function openJourney() {
  const local = await configuredSave();
  const errors: string[] = [], mutations: NativeMutation[] = [];
  const connect = async () => {
    const created = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false, reducedMotion: 'reduce' });
    created.on('page', tab => tab.on('pageerror', error => errors.push(error.message)));
    created.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (path.includes('/api/') && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method())) {
        mutations.push({ method: request.method(), path, headers: request.headers(), body: request.postData() });
      }
    });
    // Actual auth-start uses synthetic private configuration. No provider/callback is visited.
    for (const url of ['https://github.com/login/oauth/authorize**', 'https://accounts.google.com/**']) {
      await created.route(url, route => route.fulfill({ status: 200, contentType: 'text/plain', body: 'T056 synthetic provider window. No real authentication.' }));
    }
    return created;
  };
  let context: BrowserContext;
  try { context = await connect(); } catch (error) { await local.stop(); throw error; }
  try {
    await installCookie(context, local.cookies[0]!);
    let page = await context.newPage(); await page.goto(local.url);
    await expect(page.getByText('Synthetic T050 player (github)', { exact: true })).toBeVisible();
  return { local, get context() { return context; }, get page() { return page; }, errors, mutations,
    async restartBrowser(provider: 'github' | 'google') {
      await context.close(); context = await connect();
      // This represents a separate synthetic sign-in after the native browser closed.
      await installCookie(context, (await local.syntheticSession(provider)).cookie);
      page = await context.newPage(); await page.goto(local.url);
      await expect(button(page, 'Continue')).toHaveAttribute('aria-disabled', 'false');
    },
    writes: () => mutations.filter(item => item.method === 'PUT' && item.path.endsWith('/save')),
    async start(tab = page) { await button(tab, 'New Adventure').click(); await button(tab, 'Start new adventure').click(); await expect(tab.getByRole('heading', { name: 'The Arrival Lift', exact: true })).toBeVisible(); },
    async notes(value: string, tab = page) { await button(tab, 'Notebook').click(); await tab.getByRole('textbox', { name: 'Personal notes', exact: true }).fill(value); await button(tab, 'Close notebook').click(); },
    async expectNotes(value: string, tab = page) { await button(tab, 'Notebook').click(); await expect(tab.getByRole('textbox', { name: 'Personal notes', exact: true })).toHaveValue(value); await button(tab, 'Close notebook').click(); },
    async firstSave(tab = page) { await button(tab, 'Save').click(); await button(tab, 'Save this adventure').click(); await expect(tab.getByText(/^Saved at /)).toBeVisible(); },
    async openProvider(provider: 'GitHub' | 'Google', tab = page) {
      const opened = context.waitForEvent('page'); await button(tab, provider).click(); const popup = await opened;
      await popup.waitForURL(provider === 'GitHub' ? 'https://github.com/login/oauth/authorize**' : 'https://accounts.google.com/**');
      return popup;
    },
    async deletionReady() {
      await button(page, 'Settings').click(); await button(page, 'Delete account').click();
      const opened = context.waitForEvent('page'); await button(page, 'Confirm choice and sign in again').click(); const popup = await opened;
      await popup.waitForURL('https://github.com/login/oauth/authorize**');
      const cookie = (await context.cookies(local.url)).find(item => item.name === '__Secure-nq_session')!;
      const issued = await local.completeDeletionReauth(`${cookie.name}=${cookie.value}`); await installCookie(context, issued.cookie);
      await popup.bringToFront(); await page.bringToFront();
      if (await button(page, 'Check deletion sign-in result').isVisible()) await button(page, 'Check deletion sign-in result').click();
      await expect(button(page, 'Delete account now')).toBeVisible();
      expect(mutations.filter(item => item.method === 'DELETE').length).toBe(0);
    },
  };
  } catch (error) { try { await context.close(); } finally { await local.stop(); } throw error; }
}
export const test = base.extend<{ journey: Journey }>({
  journey: async ({}, use, info) => {
    const journey = await openJourney();
    try { await use(journey); }
    finally {
      if (info.status !== info.expectedStatus) {
        await journey.page.screenshot({ path: info.outputPath('T056-failure.png'), fullPage: true }).catch(() => {});
      }
      try { await journey.context.close(); } finally { await journey.local.stop(); }
      expect(journey.errors).toEqual([]);
    }
  },
});
export { expect };
