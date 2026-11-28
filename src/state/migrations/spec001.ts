// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { SaveContentPolicy } from '../../services/save-validator';
import { SaveReader, type SaveMigration } from '../save-migrations';
import historicalPolicy from './spec001-0.9.1.json' with { type: 'json' };

// A hypothetical pre-release catalog. Keep this snapshot independent of the
// live content registry. It grants read access only to its own version.
const measurementNotice = 'Your observations remain in the notebook. Take new measurements to verify the current setup.';
const migration: SaveMigration = {
  fromVersion: '0.9.1',
  toVersion: '1.0.0',
  renamedIds: {
    'spec001:R12-balcony': 'spec001:R12',
    'spec001:ITEM-field-case': 'spec001:ITEM-inspection-kit',
    'spec001:EFFECT-classify-bypass': 'spec001:EFFECT-repair-classify-temporary',
    'spec001:FACT-bypass-followup': 'spec001:FACT-repair-maintenance',
  },
  relocatedPositions: {
    'spec001:R12.signal-ledge': {
      roomId: 'spec001:R12', safePositionId: 'spec001:R12.entry',
      explanation: `The old signal ledge was removed. Resume at the Iron Threshold entrance. ${measurementNotice}`,
    },
    'spec001:R01.instrument-bench': {
      roomId: 'spec001:R01', safePositionId: 'spec001:R01.entry',
      explanation: `The old instrument bench was removed. Resume at the Arrival Lift entrance. ${measurementNotice}`,
    },
  },
  changesConfiguration: 'on-relocation',
  explanation: 'Your inventory, notebook and adventure history carry forward.',
};

export function createSpec001SaveReader(currentPolicy: SaveContentPolicy): SaveReader {
  return new SaveReader({
    currentContentVersion: currentPolicy.contentVersion,
    readPolicies: [historicalPolicy as SaveContentPolicy, currentPolicy],
    migrations: [migration],
  });
}
