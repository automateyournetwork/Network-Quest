// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { expect, firefox, test, type BrowserContext } from '@playwright/test';
import { access } from 'node:fs/promises';
import { localTls } from './support/local-tls';

test('isolated Firefox CA trust verifies HTTPS shell and actual unavailable API', async () => {
  const local = await localTls();
  let untrusted: BrowserContext | undefined;
  let trusted: BrowserContext | undefined;
  try {
    untrusted = await firefox.launchPersistentContext(local.untrustedProfile, { headless: true, ignoreHTTPSErrors: false });
    const rejected = await untrusted.newPage();
    // A successful navigation here is a test failure, not an accepted fallback.
    await expect(rejected.goto(local.url)).rejects.toThrow(/SSL_ERROR|SEC_ERROR|certificate/i);
    await untrusted.close();
    untrusted = undefined;
    trusted = await firefox.launchPersistentContext(local.profile, { headless: true, ignoreHTTPSErrors: false });
    const page = await trusted.newPage();
    expect((await page.goto(local.url))?.status()).toBe(200);
    await expect(page.locator('#development-status')).toHaveText('This build contains setup only. Play is not available yet.');
    const result = await page.evaluate(async () => {
      const session = await fetch('api/v1/session');
      const callback = await fetch('api/v1/auth/google/callback?code=synthetic-browser-code');
      const wrongMethod = await fetch('api/v1/session', { method: 'POST' });
      const unknown = await fetch('api/v1/unknown');
      return { session: { status: session.status, body: await session.json(), cache: session.headers.get('cache-control'),
        csp: session.headers.get('content-security-policy') },
      callback: { status: callback.status, body: await callback.text() }, wrongMethod: wrongMethod.status, unknown: unknown.status };
    });
    expect(result.session.status).toBe(503);
    expect(result.session.body.code).toBe('service_not_implemented');
    expect(result.session.cache).toBe('no-store');
    expect(result.session.csp).toContain("default-src 'none'");
    expect(result.callback.status).toBe(503);
    expect(result.callback.body).toContain('No sign-in was completed');
    expect(result.callback.body).not.toContain('synthetic-browser-code');
    expect(result.wrongMethod).toBe(405);
    expect(result.unknown).toBe(404);
    expect(await trusted.cookies()).toEqual([]);
  } finally {
    try { await untrusted?.close(); } finally {
      try { await trusted?.close(); } finally { await local.stop(); }
    }
  }
  await expect(access(local.directory)).rejects.toMatchObject({ code: 'ENOENT' });
});
