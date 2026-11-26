// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { ActionId, QualifiedId } from '../domain/types';
import { conditionSatisfied } from './conditions';
import { validNotebookText } from './notebook';
import { isMeasurementCurrent } from './reducer';
import type { ReducerCommand, ReducerState, Reduction, StateEffect } from './reducer';
import type { GameState } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
/** Trusted evidence eligibility supplements, and never replaces, authored conditions. */
export function tutorialBatch(registry: ContentRegistry, game: GameState, objective: 'O01' | 'O02'): readonly StateEffect[] | null {
  const record = registry.record(q(objective));
  if (record?.kind !== 'objective' || game.world.completedObjectiveIds.includes(q(objective)) || !conditionSatisfied(record.prerequisite, game.world)) return null;
  const has = (id: string) => game.notebook.factIds.includes(q<'fact'>(id));
  if (objective === 'O01') {
    if (!has('FACT-power') || !has('FACT-link') || !game.notebook.measurements.some(m => isMeasurementCurrent(m, game.world)
      && m.ruleId === q('PHY04') && m.roomId === q('R01') && m.subjectIds.includes(q('PR003')) && m.subjectIds.includes(q('PROFILE-COPPER-100'))
      && ['length-within-profile', 'length-exceeded'].includes(m.conclusionCode))) return null;
  } else if (!game.world.completedObjectiveIds.includes(q('O01')) || !['FACT-endpoints', 'FACT-endpoint-a', 'FACT-endpoint-b', 'FACT-path'].every(has)
    || !game.notebook.hypotheses.some(h => validNotebookText(h.text, 512, true) && h.subjectIds.includes(q('R02')) && h.subjectIds.includes(q('PR012')))) return null;
  const alternative = record.alternatives.find(a => a.id === q(`ACTION-complete-${objective}`) && conditionSatisfied(a.condition, game.world));
  return alternative ? [...record.effects, ...alternative.effects] as StateEffect[] : null;
}

/**
 * Compose canonical candidates before the controller's single CAS. No bus
 * listener dispatch, UI reward patch, intermediate render or persistence call.
 * Any failed objective candidate rolls the initiating operation back too.
 */
export function createTutorialReducer(options: {
  readonly registry: ContentRegistry; readonly reduce: (state: ReducerState, command: ReducerCommand) => Reduction; readonly nextActionId: () => ActionId;
}): (state: ReducerState, command: ReducerCommand) => Reduction {
  return (before, command) => {
    const original = options.reduce(before, command);
    if (original.status === 'rejected' || original.state.runtime.game === before.runtime.game || original.state.control.pending
      || !['stable-exploration', 'safe-preparation', 'safe-continue'].includes(original.state.runtime.activity?.kind ?? '')) return original;
    let candidate = original.state;
    for (const objective of ['O01', 'O02'] as const) {
      const game = candidate.runtime.game!;
      const batch = tutorialBatch(options.registry, game, objective);
      if (!batch) continue;
      const applied = options.reduce(candidate, { actionId: options.nextActionId(), adventureId: game.adventureId, expectedVersion: game.world,
        input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-tutorial-evidence', observations: [], acceptedEffects: batch } } });
      if (applied.status === 'rejected') return { state: before, status: 'rejected', ...(applied.reason ? { reason: applied.reason } : {}) };
      // Reject receipt collisions or a broken adapter instead of partial success.
      if (!applied.state.runtime.game?.world.completedObjectiveIds.includes(q(objective))) return { state: before, status: 'rejected', reason: 'content-error' };
      candidate = applied.state;
    }
    return { ...original, state: candidate };
  };
}
