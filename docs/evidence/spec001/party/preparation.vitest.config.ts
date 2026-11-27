// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit T094 preparation-only discovery. This file is outside the application
// and the normal tests/** include; it does not change the shared test run.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  envDir: false,
  test: {
    environment: 'node',
    include: ['docs/evidence/spec001/party/preparation-contract.test.ts'],
    passWithNoTests: false,
    allowOnly: false,
  },
});
