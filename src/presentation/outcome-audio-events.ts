// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { GameState, RuntimeState } from '../state/types';
import { repairClassification, repairFlags, repairMeasurementCurrent, repairPlans } from '../state/repair-plan';

/** A historical ending alone cannot select the folio in a subsequent attempt. */
export function currentThresholdEnding(game: GameState | null) {
  if (!game || String(game.world.roomId) !== 'spec001:R12') return null;
  const result = game.outcomeHistory.at(-1), classification = repairClassification(game);
  return classification && result && result.attemptId === game.world.attemptId && result.route === game.world.route &&
    result.outcome === ({ permanent: 'E01', temporary: 'E02', shutdown: 'E03' } as const)[classification] ? result.outcome : null;
}

/** Only committed encounter observations can reveal a route, an ending or a fresh retry. */
export function outcomeAudioEvents(before: RuntimeState | undefined, after: RuntimeState): string[] {
  const old = before?.game, game = after.game;
  if (!old || !game || !before || old.adventureId !== game.adventureId ||
    before.auth.clientGeneration !== after.auth.clientGeneration) return [];
  const room = String(game.world.roomId);
  if (room !== 'spec001:R11' && room !== 'spec001:R12') return [];
  if (old.world.attemptId !== game.world.attemptId) {
    const priorFailure = before.activity?.kind === 'terminal-failure' || before.activity?.kind === 'shutdown';
    return priorFailure && before.checkpoint?.adventureId === game.adventureId && room === 'spec001:R11' &&
      after.activity?.kind === 'safe-preparation' && game.world.configurationRevision > old.world.configurationRevision &&
      game.notebook.measurements.every(m => m.stale) ? ['rift/rewound'] : [];
  }
  const o11 = game.world.completedObjectiveIds.find(id => String(id) === 'spec001:O11');
  if (old.world.roomId !== game.world.roomId) {
    const plan = repairPlans.find(p => p.id === game.world.flags[repairFlags.executed]);
    return room === 'spec001:R12' && o11 && plan?.route && after.activity?.kind === 'active-encounter' ? ['repair/validation-arrival'] : [];
  }
  if (room === 'spec001:R11') {
    if (after.activity?.kind === 'terminal-failure' && before.activity?.kind !== 'terminal-failure') return ['rift/failure'];
    if (!o11 || old.world.completedObjectiveIds.includes(o11)) return [];
    const installed = repairPlans.find(p => p.id === game.world.flags[repairFlags.executed]);
    if (!installed) return [];
    const events: string[] = [];
    if (installed.id === 'shutdown') events.push('repair/shutdown');
    else if (installed.route === 'radio') {
      // This particular recorded effect explicitly describes a temporary deployment.
      if (game.world.flags[repairFlags.duration] === 'temporary') events.push('repair/radio-temporary');
    } else if (installed.route) events.push('repair/' + installed.route);
    const wasFresh = new Set(old.notebook.measurements.filter(m => repairMeasurementCurrent(m, old)).map(m => m.id));
    if (game.notebook.measurements.some(m => m.stale && wasFresh.has(m.id))) events.push('repair/stale');
    return events;
  }
  const result = game.outcomeHistory.at(-1);
  const ending = currentThresholdEnding(game);
  if (result && ending && after.activity?.kind === (ending === 'E03' ? 'shutdown' : 'cutscene') &&
    !old.outcomeHistory.some(oldResult => oldResult.id === result.id)) {
    return ['ending/recorded', 'ending/' + result.outcome];
  }
  const installed = game.world.flags[repairFlags.executed], duration = game.world.flags[repairFlags.duration];
  if (!o11 || typeof installed !== 'string' || installed === 'shutdown' || (duration !== 'temporary' && duration !== 'permanent')) return [];
  // Match the recorded physical reading at the current configuration. The endpoint test and classification remain independent.
  const measured = game.notebook.measurements.some(m => m.roomId === game.world.roomId && repairMeasurementCurrent(m, game) &&
    m.conclusionCode === `repair:link:${installed}:${duration}:correct` && !old.notebook.measurements.some(prior => prior.id === m.id));
  return measured ? ['repair/measured-link', 'repair/packet-advice'] : [];
}
