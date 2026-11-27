// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'backhoe.spec.ts', timeout: 120_000,
  workers: 1, retries: 0, reporter: 'list', outputDir: '../../../../../.local/t094-backhoe-native',
  use: { trace: 'off', screenshot: 'only-on-failure' } });
