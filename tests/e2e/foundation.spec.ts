// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test('built shell loads its nested assets and reports the actual development state', async ({ page, baseURL }) => {
  const errors: string[] = [];
  const resources: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('requestfailed', (request) => errors.push(request.url()));
  page.on('response', (response) => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
    if (['script', 'stylesheet'].includes(response.request().resourceType())) resources.push(response.url());
  });
  const response = await page.goto('./');
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle('Network Quest — In development');
  await expect(page.getByRole('heading', { level: 1, name: 'Network Quest', exact: true })).toBeVisible();
  await expect(page.locator('#development-status')).toHaveText('This build contains setup only. Play is not available yet.');
  expect(resources.some((url) => /\/assets\/.*\.js$/.test(url))).toBe(true);
  expect(resources.some((url) => /\/assets\/.*\.css$/.test(url))).toBe(true);
  expect(resources.every((url) => url.startsWith(`${baseURL}assets/`))).toBe(true);
  expect(errors).toEqual([]);
});

test('static preview denies private paths and has no working API or session', async ({ page }) => {
  await page.goto('./');
  const results = await page.evaluate(async () => {
    const routes = ['.env', '.git/config', '.local/canary', '.runtime/canary',
      'server/config.example.php', '@fs/etc/passwd', 'api/v1/session'];
    return Promise.all(routes.map(async (route) => {
      const response = await fetch(route);
      return { route, status: response.status, cache: response.headers.get('cache-control') };
    }));
  });
  for (const result of results) {
    expect(result.status, result.route).toBe(404);
    expect(result.cache, result.route).toBe('no-store');
  }
  expect(await page.context().cookies()).toEqual([]);
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length })))
    .toEqual({ local: 0, session: 0 });
});

test('current text shell has semantic landmarks and remains readable at a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('./');
  await expect(page.getByRole('main')).toBeVisible();
  await expect(page.locator('#development-status')).toBeVisible();
  const result = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(result.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  // This shell has no game controls. Keyboard journeys, zoom/assistive review,
  // actual Safari, gameplay and provider/save recovery belong to later suites.
});
