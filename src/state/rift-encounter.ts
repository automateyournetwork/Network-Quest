// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { QualifiedId } from '../domain/types';
import type { ReducerInput, ReducerState } from './reducer';
import { repairFlags, repairMeasurementDuration, repairPlans } from './repair-plan';
import type { WorldState } from './types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;

/** Exact authored precommit world; T084 separately checks registry and activity. */
export function riftPreparationBoundary(world: WorldState): boolean {
  return world.roomId === q('R11') && world.position.safePositionId === q('R11.preparation')
    && world.continueOutcome === null && !Object.hasOwn(world.flags, repairFlags.executed)
    && !Object.hasOwn(world.flags, repairFlags.classification) && !world.completedObjectiveIds.includes(q('O11'));
}

/**
 * Scoped permission, not save eligibility. A committed Rift intervention must
 * retain its same-adventure/attempt precommit world until outcome acceptance.
 * Trusted runtime state is validated at load; this predicate never mutates it.
 */
export function isActiveRiftEncounter(state: ReducerState): boolean {
  try {
    const { game, checkpoint, activity } = state.runtime;
    if (!game || !checkpoint || !state.runtime.ui || state.control.pending || activity?.kind !== 'active-encounter') return false;
    const world = game.world, preparation = checkpoint.world;
    const plan = repairPlans.find(p => p.id === world.flags[repairFlags.executed]);
    const duration = world.flags[repairFlags.duration];
    return checkpoint.adventureId === game.adventureId && riftPreparationBoundary(preparation)
      && preparation.attemptId === world.attemptId && preparation.configurationRevision < world.configurationRevision
      && ((world.roomId === q('R11') && world.position.safePositionId === q('R11.preparation'))
        || (world.roomId === q('R12') && world.position.safePositionId === q('R12.entry')))
      && world.continueOutcome === null && world.completedObjectiveIds.includes(q('O11'))
      && !world.completedObjectiveIds.includes(q('O12')) && !Object.hasOwn(world.flags, repairFlags.classification)
      && plan !== undefined && (plan.route === null || world.route === plan.route)
      && world.flags[repairFlags.selected] === plan.id && preparation.flags[repairFlags.selected] === plan.id
      && repairMeasurementDuration(plan.id, world) !== null
      && Object.hasOwn(preparation.flags, repairFlags.duration) === Object.hasOwn(world.flags, repairFlags.duration)
      && preparation.flags[repairFlags.duration] === duration
      && game.notebook.factIds.includes(q('FACT-O11-execution'));
  } catch { return false; }
}

/** Shared exact validation location for reducer and semantic UI admission. */
export function isRiftValidationContext(state: ReducerState): boolean {
  return isActiveRiftEncounter(state) && state.runtime.game!.world.roomId === q('R12');
}

/**
 * Closed exception for the future trusted reducer hook. It only authorizes
 * access to existing canonical reducers, never a verdict, effect or safe phase.
 * All other operations retain default denial during a committed encounter.
 */
export function allowRiftEncounterInput(state: ReducerState, input: ReducerInput): boolean {
  try {
    if (!isActiveRiftEncounter(state)) return false;
    if (input.kind === 'notebook') return input.operation.kind === 'notes';
    if (input.kind === 'objective') return input.operation.kind === 'hint' && /^spec001:O(?:0[1-9]|1[0-2])$/.test(input.operation.objectiveId);
    if (!isRiftValidationContext(state) || input.kind !== 'repair-plan') return false;
    const operation = input.operation;
    return operation.kind === 'measure-link' || operation.kind === 'test-endpoint' || operation.kind === 'classify'
      || (operation.kind === 'choose' && operation.actionId === q('ACTION-repair-read-classification'));
  } catch { return false; }
}
