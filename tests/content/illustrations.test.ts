// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, it, expect } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import type { FactId, QuestId } from '../../src/domain/types';
import { illustrationFor, validIllustrationBinding, journalFactEarned } from '../../src/content/illustrations';

describe('registered illustrated field guides', () => {
  const { registry } = loadIntroductionContent();
  const post = 'spec001:FACT-SQ01-delivery';
  it('admits one exact room, subject, surface, and export for the message strip', () => {
    const binding = illustrationFor(registry, 'spec001:R04', 'journal', post)!;
    expect(binding.assetId).toBe('spec001:ASSET-ILLUSTRATION-08');
    expect(illustrationFor(registry, 'spec001:R04', 'diagnostic', post)).toBeUndefined();
    expect(illustrationFor(registry, 'spec001:R03', 'journal', post)).toBeUndefined();
    for (const substitute of [{ assetId: 'spec001:ASSET-ILLUSTRATION-07' }, { contentId: 'spec001:FACT-SQ02-audit' },
      { exportPath: 'public/assets/illustrations/18.webp' }, { exportPath: 'https://example.invalid/picture' }]) {
      expect(validIllustrationBinding('spec001:R04', { ...binding, ...substitute })).toBe(false);
    }
  });
  it.each([['SQ01', 'FACT-SQ01-delivery'], ['SQ02', 'FACT-SQ02-audit'], ['SQ03', 'FACT-SQ03-comparison']])('requires both parts of the earned %s receipt', (quest, fact) => {
    const game = startIntroduction(createIntroductionRuntime(), registry).game!;
    const questId = ('spec001:' + quest) as QuestId, factId = ('spec001:' + fact) as FactId;
    const world = { ...game.world, completedQuestIds: [questId] };
    const notebook = { ...game.notebook, factIds: [factId] };
    expect(journalFactEarned(game, factId)).toBe(false);
    expect(journalFactEarned({ ...game, world }, factId)).toBe(false);
    expect(journalFactEarned({ ...game, notebook }, factId)).toBe(false);
    expect(journalFactEarned({ ...game, world, notebook }, factId)).toBe(true);
  });
});
