// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { GameState } from '../state/types';

/** Disclose the original proposal's shortfall only after its new, current reading exists. */
export function measuredMarketShortfall(before: GameState, after: GameState): boolean {
  if (String(after.world.roomId) !== 'spec001:R09' || after.world.roomId !== before.world.roomId ||
      before.adventureId !== after.adventureId || before.world.attemptId !== after.world.attemptId) return false;
  const known = new Set(before.notebook.measurements.map(m => m.id));
  return after.notebook.measurements.some(m => {
    if (known.has(m.id) || m.stale || m.roomId !== after.world.roomId || m.attemptId !== after.world.attemptId ||
        m.configurationRevision !== after.world.configurationRevision || !m.subjectIds.some(id => String(id) === 'spec001:O09') ||
        m.conclusionCode !== 'O09:ACTION-O09-compatible-kit-A:incorrect') return false;
    const watts = (name: string) => m.readings.find(r => r.name === name && r.unit === 'W')?.value;
    return watts('Delivered budget') === 30 && watts('Total delivered demand') === 33 && watts('Delivered excess') === 3;
  });
}
