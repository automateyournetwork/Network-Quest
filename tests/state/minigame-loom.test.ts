// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { vi } from 'vitest';

// This original MG01 regression exercises the unavailable SQ03 illustration.
// The all-seven browser journey also verifies the earned, published picture.
vi.mock('../../content/spec001/rooms/R08.json', async importOriginal => {
  const original = await importOriginal<{ default: typeof import('../../content/spec001/rooms/R08.json') }>();
  const room = structuredClone(original.default);
  room.illustrationBindings = room.illustrationBindings.filter(binding => binding.assetId !== 'spec001:ASSET-ILLUSTRATION-16');
  return { ...original, default: room };
});
import '../../docs/evidence/spec001/optional/MG03/promoted/mg01-regression.test';
