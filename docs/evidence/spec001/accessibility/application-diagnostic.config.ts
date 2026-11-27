// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'r12-browser-diagnostic.spec.ts', workers: 1,
  retries: 0, forbidOnly: true, timeout: 180000, reporter: 'list',
  outputDir: '../../../../.local/r12-browser-diagnostic', use: { screenshot: 'only-on-failure' } });
