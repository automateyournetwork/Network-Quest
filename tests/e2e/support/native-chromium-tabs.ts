// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { chromium, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { build, preview } from 'vite';

type NativeTabs = { browser: Browser; context: BrowserContext; page: Page; url: string };

/** Playwright's normal focus overrides keep every tab visible. Attaching to the
 * default context of the owned Chrome process with noDefaults allows a genuine
 * native tab transition. The profile and HTTP guest build are both disposable. */
export async function withNativeChromiumTabs(run: (tabs: NativeTabs) => Promise<void>) {
  const directory = await mkdtemp(join(tmpdir(), 'network-quest-visible-'));
  const base = '/arcade/play/network-quest/';
  let server: Awaited<ReturnType<typeof preview>> | undefined;
  let chrome: ChildProcess | undefined, closed: Promise<void> | undefined, browser: Browser | undefined;
  try {
    await build({ build: { outDir: join(directory, 'dist') }, logLevel: 'error' });
    server = await preview({ configFile: false, root: directory, base, logLevel: 'error',
      preview: { host: '127.0.0.1', port: 0, strictPort: true } });
    const socket = server.httpServer.address();
    if (!socket || typeof socket === 'string') throw new Error('Expected owned loopback guest server');
    const profile = join(directory, 'chromium');
    chrome = spawn(chromium.executablePath(), ['--headless', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
      '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank'], { stdio: 'ignore' });
    const child = chrome;
    closed = new Promise(resolve => child.once('close', () => resolve()));
    await once(child, 'spawn');
    let port = '';
    for (let attempt = 0; attempt < 100 && child.exitCode === null && !port; attempt++) {
      try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0] ?? ''; }
      catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error; await delay(100); }
    }
    if (!/^[1-9]\d{0,4}$/.test(port)) throw new Error('Owned Chrome for Testing did not publish its loopback CDP port');
    browser = await chromium.connectOverCDP('http://127.0.0.1:' + port, { noDefaults: true });
    const context = browser.contexts()[0]!;
    await run({ browser, context, page: context.pages()[0]!, url: `http://127.0.0.1:${socket.port}${base}` });
  } finally {
    try { await browser?.close(); } finally {
      chrome?.kill(); await closed;
      try { await server?.close(); } finally { await rm(directory, { recursive: true, force: true }); }
    }
  }
}
