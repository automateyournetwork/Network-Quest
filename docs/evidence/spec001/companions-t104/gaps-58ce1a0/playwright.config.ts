// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'.',testMatch:'background.spec.ts',fullyParallel:false,workers:1,retries:0,reporter:[['line']],outputDir:'../../../../../.local/t104-background-results',use:{trace:'off',screenshot:'only-on-failure'}});
