// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from './registry.ts';
import type { illustrationBinding } from './schema-types.generated.ts';
import type { GameState } from '../state/types.ts';

// Fixed Spec001 allocations. Paths and prose come only from the validated room record.
const kit = 'ITEM-inspection-kit';
const subjects = [
  'FACT-link', 'FACT-packet-context', kit, 'FACT-endpoints', kit, 'O03',
  'O04', 'FACT-SQ01-delivery', kit, 'O05', 'O06', 'FACT-O06-budget',
  kit, 'O07', kit, 'FACT-SQ03-comparison', 'O09', 'FACT-SQ02-audit',
  'O10', 'FACT-clockworks-capabilities', kit, 'FACT-O11-plan', 'O12', 'FACT-O12-classification',
];
export function validIllustrationBinding(roomId: string, binding: illustrationBinding): boolean {
  const suffix = /^spec001:ASSET-ILLUSTRATION-(\d{2})$/.exec(binding.assetId)?.[1];
  if (!suffix) return false;
  const index = Number(suffix), subject = subjects[index - 1];
  const surface = subject === kit ? 'inventory' : subject?.startsWith('O') || index === 2 ? 'diagnostic' : 'journal';
  return !!subject && roomId === 'spec001:R' + String(Math.ceil(index / 2)).padStart(2, '0')
    && binding.surface === surface && binding.contentId === 'spec001:' + subject
    && binding.use === (surface === 'inventory' ? 'inventory-illustration' : 'diagnostic-illustration')
    && binding.exportPath === 'public/assets/illustrations/' + suffix + '.webp';
}

const questFacts: Readonly<Record<string, string>> = {
  'spec001:FACT-SQ01-delivery': 'spec001:SQ01',
  'spec001:FACT-SQ02-audit': 'spec001:SQ02',
  'spec001:FACT-SQ03-comparison': 'spec001:SQ03',
};
export function journalFactEarned(game: GameState, fact: string): boolean {
  const quest = questFacts[fact];
  return !quest || (game.world.completedQuestIds.some(id => id === quest) && game.notebook.factIds.some(id => id === fact));
}
export function illustrationFor(registry: ContentRegistry, roomId: string, surface: illustrationBinding['surface'], contentId: string) {
  const room = registry.record(roomId);
  if (room?.kind !== 'room') return undefined;
  const matches = room.illustrationBindings?.filter(b => b.surface === surface && b.contentId === contentId && validIllustrationBinding(roomId, b));
  return matches?.length === 1 ? matches[0] : undefined;
}
