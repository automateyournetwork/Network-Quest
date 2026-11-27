// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '../../../../tests/e2e', testMatch: 'companions.spec.ts',
  timeout: 900_000, workers: 1, retries: 0,
  outputDir: '../../../../.local/t104-browser-artifacts',
  reporter: [['list']], use: { trace: 'off', screenshot: 'off' },
});
