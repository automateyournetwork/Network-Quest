// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { copperCaseIds } from './copper-case-ids';

/**
 * Reviewed execution locations, not another test result or an expected-answer
 * generator. Each listed suite calls its production evaluator on the source
 * case's scoped operands and asserts the independent result. Composite route,
 * ending and recovery cases remain pending in their own integration suites.
 * Keep this data separate from .test.ts imports to avoid executing a suite twice.
 */
export const physicalCaseExecution = {
  'tests/domain/copper.test.ts': copperCaseIds,
  'tests/domain/optics.test.ts': [
    'T04', 'T05', 'T06', 'T07', 'T15', 'B-OPT-MAX', 'B-OPT-OVER',
    'B-OPT-RESERVE', 'I-PHY06', 'C-ERROR-INCONSISTENT',
  ],
  'tests/domain/radio.test.ts': [
    'T08', 'T09', 'B-RADIO-20', 'B-RADIO-BELOW', 'B-RADIO-PATH', 'I-PHY07',
  ],
  'tests/domain/power.test.ts': [
    'T10', 'C-POWER', 'B-POWER-30', 'B-POWER-OVER', 'B-POWER-COMPAT', 'I-PHY08',
  ],
  'tests/domain/capabilities.test.ts': ['T11', 'C-NEG-WRONG', 'B-NEG-NONE', 'I-PHY09'],
} as const;

export const evaluatedPhysicalCaseIds: readonly string[] = Object.values(physicalCaseExecution).flat();
