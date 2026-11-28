// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig, devices } from '@playwright/test';
import { readdirSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const origin = 'http://127.0.0.1:4173';
const staticSpecs = ['foundation.spec.ts', 'layered-room.spec.ts'];
// This guest journey owns an ephemeral built preview and its Firefox process.
const ownedStaticSpecs = ['companions.spec.ts'];
const httpsSpecs = ['foundation-tls.spec.ts', 'ui-shell.spec.ts', 'presentation.spec.ts', 'guest-introduction.spec.ts', 'verbs-inventory.spec.ts', 'dialogue.spec.ts', 'notebook.spec.ts', 'navigation.spec.ts', 'packet-controls.spec.ts', 'title.spec.ts', 'packet-introduction.spec.ts', 'physical-boundaries.spec.ts', 'introduction-graybox.spec.ts', 'finished-room.spec.ts', 'save-dialogs.spec.ts', 'account-settings.spec.ts', 'single-save.spec.ts', 'logout.spec.ts', 'account-deletion.spec.ts', 'first-repair-route.spec.ts', 'independent-repair-routes.spec.ts'];
httpsSpecs.push('repair-routes.spec.ts', 'outcomes.spec.ts', 'packet-journey.spec.ts', 'optional-activities.spec.ts');
httpsSpecs.push('migrations.spec.ts', 'accessibility.spec.ts', 'recovery.spec.ts');
httpsSpecs.push('responsive-layout.spec.ts');
const assigned = new Set([...staticSpecs, ...ownedStaticSpecs, ...httpsSpecs]);
const browserTests = fileURLToPath(new URL('./tests/e2e', import.meta.url));
// T022/T030 and later journeys must choose an appropriate project explicitly.
// An unassigned new spec is a failure, never a silently omitted green run.
const unassigned = readdirSync(browserTests, { recursive: true, encoding: 'utf8' })
  .filter((file) => !file.split(/[\\/]/).some((part) => ['node_modules', 'vendor', '.local', '.runtime', 'dist', 'build'].includes(part)))
  .filter((file) => /\.(?:spec|test)\.[cm]?[jt]sx?$/.test(file) && !assigned.has(file.replaceAll('\\', '/')));
if (unassigned.length) throw new Error(`Unassigned browser specs: ${unassigned.join(', ')}. Register them in the appropriate Playwright project; API/session journeys require trusted HTTPS.`);

const resultRoot = resolve('.local/test-results');
mkdirSync(resultRoot, { recursive: true });
const outputDir = mkdtempSync(join(resultRoot, 'playwright-'));

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '**/*.spec.ts',
  testIgnore: ['**/node_modules/**', '**/vendor/**', '**/.local/**', '**/.runtime/**', '**/dist/**', '**/build/**'],
  outputDir,
  forbidOnly: true,
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  reporter: 'list',
  use: {
    baseURL: `${origin}/arcade/play/network-quest/`,
    ignoreHTTPSErrors: false,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  // Static projects exercise the built shell; the HTTPS project uses its own
  // disposable CA and PHP server. HTTP is never API/session evidence.
  projects: [
    { name: 'chromium-static', testMatch: staticSpecs.map((file) => `**/${file}`), use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-static', testMatch: staticSpecs.map((file) => `**/${file}`), use: { ...devices['Desktop Firefox'] } },
    { name: 'firefox-owned-static', testMatch: ownedStaticSpecs.map((file) => `**/${file}`), use: { ...devices['Desktop Firefox'] } },
    { name: 'firefox-local-https', testMatch: httpsSpecs.map((file) => `**/${file}`), grepInvert: /native Chromium tab/, use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium-native-visibility', testMatch: '**/recovery.spec.ts', grep: /native Chromium tab/, use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'node node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 4173',
    url: `${origin}/arcade/play/network-quest/`,
    reuseExistingServer: false,
    timeout: 20_000,
    gracefulShutdown: { signal: 'SIGTERM', timeout: 2_000 },
    // Fix both paths so an inherited public-build override cannot misdirect QA.
    env: {
      VITE_GAME_BASE: '/arcade/play/network-quest/',
      VITE_API_BASE: '/arcade/play/network-quest/api/v1',
    },
  },
});
