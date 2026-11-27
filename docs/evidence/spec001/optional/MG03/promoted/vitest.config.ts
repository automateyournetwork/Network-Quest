// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { defineConfig } from 'vitest/config';
export default defineConfig({ envDir: false, test: { environment: 'node',
  include: ["docs/evidence/spec001/optional/MG03/promoted/runtime.test.ts", "docs/evidence/spec001/optional/MG03/promoted/mg02-regression.test.ts", "docs/evidence/spec001/optional/MG03/promoted/mg01-regression.test.ts", "docs/evidence/spec001/optional/framework/*.test.ts", "tests/content/radio-diary.test.ts", "tests/content/maintenance-record.test.ts", "tests/content/characters.test.ts", "tests/state/maintenance-record.test.ts", "tests/state/maintenance-lifecycle.test.ts", "tests/ui/radio-diary.test.ts", "tests/ui/maintenance-record.test.ts", "tests/ui/maintenance-epilogue.test.ts", "tests/services/radio-diary-policy.test.ts", "tests/services/maintenance-policy.test.ts"],
  passWithNoTests: false, allowOnly: false,
} });
