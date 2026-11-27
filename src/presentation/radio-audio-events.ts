// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { FlagId } from '../domain/types';
import type { GameState } from '../state/types';

const path = 'spec001:FLAG-radio-path' as FlagId;

/** The cradle ratchet accompanies a committed change of bearing, including returning it to its original position. */
export function radioAudioEvents(previous: GameState, current: GameState): string[] {
  if (String(current.world.roomId) !== 'spec001:R07' || current.world.roomId !== previous.world.roomId ||
      current.adventureId !== previous.adventureId || current.world.attemptId !== previous.world.attemptId) return [];
  const before = previous.world.flags[path] ?? 'unaligned', after = current.world.flags[path] ?? 'unaligned';
  return before !== after && ['unaligned', 'aligned-existing', 'alternate-path'].includes(String(after)) ? ['radio/antenna-moved'] : [];
}
