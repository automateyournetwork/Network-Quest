// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Never read credential .env files, including when run outside npm scripts.
  envDir: false,
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/vendor/**', '**/.local/**', '**/.runtime/**', '**/dist/**', '**/build/**'],
    passWithNoTests: false,
    allowOnly: false,
    // A TODO remains visibly pending in the summary, never a passed evaluator.
    reporters: ['default'],
    clearMocks: true,
    restoreMocks: true,
  },
});
