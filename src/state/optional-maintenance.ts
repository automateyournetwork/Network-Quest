// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { contentError, createEvaluator, isRecord } from '../domain/evaluate';
import type { DomainAction, FactId } from '../domain/types';
import { copperEffectBindings } from './copper-scenario';
import { fiberEffectBindings } from './fiber-scenario';
import { equipmentInteractionBindings } from './equipment-scenarios';
import type { GameState } from './types';

import { sources, exact, stringsEqual, maintenanceClueIssues as authoredClueIssues, maintenanceActivityIssues as authoredActivityIssues } from '../content/maintenance-record';
import type { MaintenanceActivity, MaintenanceAnswer, MaintenanceMode, MaintenanceCard, MaintenanceObservation } from '../content/maintenance-record';
export type { MaintenanceActivity, MaintenanceAnswer, MaintenanceMode, MaintenanceCard, MaintenanceObservation, MaintenanceClue, MaintenanceFactId, MaintenanceRoomId } from '../content/maintenance-record';

/** Runtime also checks the existing acquisition modules' registered effect bindings. */
export function maintenanceClueIssues(clues: unknown, registry: ContentRegistry): readonly string[] {
  const errors = [...authoredClueIssues(clues, registry)];
  try {
    const bindings = { copper: copperEffectBindings(registry), fiber: fiberEffectBindings(registry), equipment: equipmentInteractionBindings(registry).effects };
    if (sources.some(source => !bindings[source.acquisition].some(binding => String(binding.sourceId) === source.dialogueId && String(binding.effectId) === source.effectId))) errors.push('maintenance-authored-source');
  } catch { errors.push('maintenance-authored-source'); }
  return errors;
}
export function maintenanceActivityIssues(value: unknown, registry: ContentRegistry): readonly string[] {
  const errors = [...authoredActivityIssues(value, registry)];
  if (isRecord(value)) errors.push(...maintenanceClueIssues(value['clues'], registry));
  return [...new Set(errors)];
}

/** Read-only projection: practice availability is distinct from earned facts. */
export function maintenanceCards(activity: MaintenanceActivity, registry: ContentRegistry, game: GameState, mode: MaintenanceMode): readonly MaintenanceCard[] | null {
  if (maintenanceActivityIssues(activity, registry).length || (mode !== 'practice' && mode !== 'delivery')) return null;
  const required = mode === 'practice' ? activity.clues.slice(0, 1) : activity.clues;
  return required.map(clue => {
    const source = registry.record(clue.dialogueId);
    const acquisitionLabel = source?.kind === 'dialogue' ? source.nodes.find(node => node.id === source.entryNodeId)?.choices.find(choice => choice.id === clue.sourceActionId)?.text ?? '' : '';
    return { factId: clue.factId, roomId: clue.roomId, evidenceKind: clue.evidenceKind, label: clue.label, description: clue.description, acquisitionLabel,
      recorded: game.notebook.factIds.some(factId => String(factId) === clue.factId), use: mode === 'practice' ? 'supplied-practice-only' : 'historical-notebook-learning' };
  });
}

interface Challenge { readonly mode: MaintenanceMode; readonly observedFactIds: readonly FactId[] }
const predicate = createEvaluator<Challenge, MaintenanceAnswer, MaintenanceObservation>({
  validateChallenge(value) {
    return !exact(value, ['mode','observedFactIds']) || (value['mode'] !== 'practice' && value['mode'] !== 'delivery')
      || !Array.isArray(value['observedFactIds']) || value['observedFactIds'].length > 2048 || !Array.from(value['observedFactIds']).every(id => typeof id === 'string')
      ? { code: 'maintenance-state', field: 'notebook', message: 'Supply the actual bounded notebook fact identities and authored mode.' } : null;
  },
  validateInput(value): value is MaintenanceAnswer {
    return exact(value, ['selectedFactIds']) && Array.isArray(value['selectedFactIds']) && value['selectedFactIds'].length > 0 && value['selectedFactIds'].length <= sources.length
      && Array.from(value['selectedFactIds']).every(id => sources.some(source => source.factId === id));
  },
  evaluate(challenge, input) {
    const required = challenge.mode === 'practice' ? sources.slice(0, 1) : sources;
    const selected = new Set(input.selectedFactIds), observed = new Set<string>(challenge.observedFactIds);
    const missing = required.filter(source => !selected.has(source.factId) || (challenge.mode === 'delivery' && !observed.has(source.factId)));
    const correct = missing.length === 0 && stringsEqual(input.selectedFactIds, required.map(source => source.factId));
    return { status: correct ? 'correct' : 'incorrect', reasonCode: correct ? 'maintenance-record-combined' : 'maintenance-record-incomplete', acceptedEffects: [],
      observations: [{ kind: 'maintenance-combination', mode: challenge.mode, sourceRoomsPreserved: required.filter(source => !missing.includes(source)).map(source => source.roomId),
        missingSourceRooms: missing.map(source => source.roomId), activityCompletionEligible: challenge.mode === 'delivery' && correct,
        evidenceUse: challenge.mode === 'practice' ? 'supplied-practice-only' : 'historical-notebook-learning', currentRepairProven: false, endToEndServiceProven: false,
        chronologyProven: false, requiredObjectiveAward: 0 }] };
  },
});

/** Mode, registry and game are trusted session inputs; the UI selects IDs only. */
export function evaluateMaintenanceAnswer(activity: MaintenanceActivity, registry: ContentRegistry, mode: MaintenanceMode, action: DomainAction<unknown>, game: GameState) {
  const issues = maintenanceActivityIssues(activity, registry);
  if (issues.length) return contentError({ code: issues[0]!, field: 'maintenance', message: 'The maintenance record must bind its three authored source entries.' });
  return predicate({ mode, observedFactIds: game.notebook.factIds }, action as DomainAction<MaintenanceAnswer>, game.world);
}

export { maintenanceHistoryUnlocked } from '../content/maintenance-record';

/** Transport accepts only a bounded unique selection, including an empty draft. */
export function maintenanceSubmission(value: unknown): value is MaintenanceAnswer {
  return exact(value, ['selectedFactIds']) && Array.isArray(value['selectedFactIds']) && value['selectedFactIds'].length <= sources.length
    && new Set(value['selectedFactIds']).size === value['selectedFactIds'].length
    && Array.from(value['selectedFactIds']).every(id => sources.some(source => source.factId === id));
}
