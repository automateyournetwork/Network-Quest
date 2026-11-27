// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { GameState } from '../state/types';

/** An incorrect optical exercise can have perfectly good levels and an incompatible module. */
export function opticalAudioEvents(oldGame: GameState, game: GameState): string[] {
  if (String(game.world.roomId) !== 'spec001:R06' || oldGame.world.roomId !== game.world.roomId ||
    oldGame.adventureId !== game.adventureId || oldGame.world.attemptId !== game.world.attemptId) return [];
  const previous = new Set(oldGame.notebook.measurements.map(m => m.id));
  const events = new Set<string>();
  for (const m of game.notebook.measurements) {
    if (previous.has(m.id) || m.roomId !== game.world.roomId || m.stale ||
      m.attemptId !== game.world.attemptId || m.configurationRevision !== game.world.configurationRevision ||
      !m.subjectIds.some(id => String(id) === 'spec001:O06') || !/^O06:ACTION-O06-passive-path-[AB]:(correct|incorrect)$/.test(m.conclusionCode)) continue;
    events.add('measurement/O06');
    if (!m.conclusionCode.endsWith(':incorrect')) continue;
    const level = (name: string, unit: 'dB' | 'dBm') => m.readings.find(r => r.name === name && r.unit === unit && Number.isFinite(r.value))?.value;
    const power = level('Receive power', 'dBm'), min = level('Sensitivity', 'dBm'), max = level('Maximum receive', 'dBm');
    const reserve = level('Sensitivity reserve', 'dB'), required = level('Required reserve', 'dB');
    if ((power !== undefined && min !== undefined && power < min) || (power !== undefined && max !== undefined && power > max) ||
      (reserve !== undefined && required !== undefined && reserve < required)) events.add('measurement/O06-outside-bounds');
  }
  return [...events];
}
