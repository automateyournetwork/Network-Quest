// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { MeasurementId, QualifiedId } from '../domain/types';
import { captureEncounterContext, commitEncounterChange, prepareEncounterCheckpoint } from '../state/encounter';
import type { ReducerState } from '../state/reducer';
import { repairFlags } from '../state/repair-plan';
import type { RepairPlanId } from '../state/repair-plan';
import { allowRiftEncounterInput, isActiveRiftEncounter, isRiftValidationContext, riftPreparationBoundary } from '../state/rift-encounter';
import type { ActionCapture, ActionDispatcher, ActionPlan, CapturedAction, SemanticAction } from './action-bus';
import { rejected } from './controller-store';
import type { GameplayStore } from './controller-store';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;

/** Closed exception for controller admission; canonical handlers still validate. */
export function allowRiftEncounterAction(state: ReducerState, input: SemanticAction): boolean {
  try {
    if (!isActiveRiftEncounter(state)) return false;
    const notebookOpen = state.runtime.ui?.panel === 'notebook';
    switch (input.kind) {
      case 'select-verb': return input.verb === 'walk';
      case 'open-panel': return input.panel === 'notebook';
      case 'close-panel': return notebookOpen;
      case 'interact': return state.runtime.game!.world.roomId === q('R11') && input.verb === 'walk' && input.itemId === null && input.targetId === q('R12');
      case 'edit-personal-notes': return notebookOpen && allowRiftEncounterInput(state, { kind: 'notebook', operation: { kind: 'notes', text: input.text } });
      case 'pin-objective': return notebookOpen && allowRiftEncounterInput(state, { kind: 'objective', operation: { kind: 'hint', objectiveId: input.objectiveId } });
      case 'highlight-map-room': return notebookOpen && state.runtime.game!.notebook.mapRoomIds.includes(input.roomId);
      case 'request-objective-hint': return allowRiftEncounterInput(state, { kind: 'objective', operation: { kind: 'hint', objectiveId: input.objectiveId } });
      case 'measure-repair-link': case 'test-repair-endpoint': return isRiftValidationContext(state);
      case 'choose-repair-plan': return allowRiftEncounterInput(state, { kind: 'repair-plan', operation: { kind: 'choose', actionId: input.choiceId } });
      case 'classify-repair': return allowRiftEncounterInput(state, { kind: 'repair-plan', operation: { kind: 'classify', selection: input.selection, linkId: input.linkId, endpointId: input.endpointId } });
      default: return false;
    }
  } catch { return false; }
}

/**
 * Trusted T077 execution adapter. Stage T084's opaque checkpoint in a private
 * cell, reduce the actual command there, and publish ONE complete state via the
 * application CAS. No observer can see a checkpoint-only intermediate state.
 * Bus validation/invalidation remains the caller's authority over delivery;
 * exact state identity additionally guards delayed ready plans. No timers,
 * persistence, outcomes, Retry or Restore are implemented here.
 */
export function createEncounterExecutionPlan(options: { readonly registry: ContentRegistry; readonly store: GameplayStore;
  readonly action: CapturedAction; readonly before: ReducerState; readonly message: string }): ActionPlan {
  const { registry, store, action, before, message } = options;
  if (store.getState() !== before) return rejected('state-replaced', 'The adventure has changed. Review the plan again.');
  const game = before.runtime.game, context = action.context, input = action.input;
  if (input.kind !== 'execute-repair-plan') return rejected('invalid-input', 'Choose a reviewed intervention.');
  if (!context || !game || context.adventureId !== game.adventureId || context.attemptId !== game.world.attemptId
    || context.configurationRevision !== game.world.configurationRevision) return rejected('stale-context', 'The scene has changed. Review the plan again.');
  if (!input.warningAcknowledged) return rejected('warning-not-acknowledged', 'Read the warning and explicitly acknowledge it before execution.');
  const capture = captureEncounterContext(before);
  if (!capture) return rejected('no-preparation', 'Return to safe preparation before committing an intervention.');
  const preparation = prepareEncounterCheckpoint(before, capture, registry, riftPreparationBoundary);
  if (!preparation.ok) return rejected(preparation.reason, 'This is no longer precommit preparation.');
  let candidate = before;
  const staged = commitEncounterChange({ getState: () => candidate, compareAndSet(expected, next) {
    if (candidate !== expected) return false; candidate = next; return true;
  } }, preparation.change);
  if (!staged.ok) return rejected(staged.reason, 'The preparation checkpoint could not be captured.');
  const seeded = candidate;
  return { status: 'ready', commit() {
    if (store.getState() !== before) return rejected('state-replaced', 'The adventure has changed. Review the plan again.');
    const reduction = store.reduce(seeded, { actionId: action.actionId, adventureId: context.adventureId,
      expectedVersion: { attemptId: context.attemptId, configurationRevision: context.configurationRevision },
      input: { kind: 'repair-plan', operation: { kind: 'execute', reviewId: input.reviewId, warningAcknowledged: true } } });
    if (reduction.status === 'rejected') return rejected(reduction.reason ?? 'rejected', 'The intervention could not be committed.');
    const nextGame = reduction.state.runtime.game;
    // Failed physical checks, missing records and stale reviews retain the
    // complete prior state, including any previous checkpoint. A handled bus
    // result alone never means the intervention actually committed.
    if (reduction.status !== 'applied' || !nextGame?.world.completedObjectiveIds.includes(q('O11'))
      || !Object.hasOwn(nextGame.world.flags, repairFlags.executed)) return rejected('intervention-not-committed', message);
    const ui = reduction.state.runtime.ui;
    const selectedStillHeld = ui?.selectedItem === null || nextGame.world.inventory.some(item => item.itemId === ui?.selectedItem);
    const next: ReducerState = { ...reduction.state, runtime: { ...reduction.state.runtime, activity: { kind: 'active-encounter' },
      ...(ui && !selectedStillHeld ? { ui: { ...ui, selectedItem: null } } : {}) } };
    if (!store.compareAndSet(before, next)) return rejected('state-replaced', 'The adventure has changed. Review the plan again.');
    return { status: 'handled', reason: reduction.status, message: `${message} The intervention is committed. Walk to the Iron Threshold for validation; other exits stay closed until the encounter is resolved. Your notebook remains available. Saving is paused while this encounter is active.` };
  } };
}

export interface EncounterPreparationView {
  readonly available: boolean;
  readonly reviewId: MeasurementId | null;
  readonly selected: RepairPlanId | null;
  readonly duration: 'permanent' | 'temporary' | null;
}

/** One contained fragment for the existing repair dialog, never another menu. */
export function createEncounterPreparationControls(host: HTMLElement, options: {
  readonly view: EncounterPreparationView; readonly capture: ActionCapture; readonly dispatcher: Pick<ActionDispatcher, 'dispatch'>;
  readonly signal: AbortSignal; readonly isCurrent: () => boolean; readonly onReturn: () => void;
}) {
  const doc = host.ownerDocument, element = doc.createElement('div');
  const { view, capture, dispatcher, signal } = options;
  const paragraph = (text: string) => { const p = doc.createElement('p'); p.textContent = text; return p; };
  const warningText = view.selected === 'shutdown'
    ? 'WARNING: deliberate isolation leaves the named defect and service unresolved. It cannot replace your recoverable save. Your recovery plan is to return to preparation, repair the path and repeat the link and endpoint tests.'
    : view.duration === 'temporary'
      ? 'WARNING: the borrowed bypass is temporary and occupies the protected work corridor. The damaged installation remains isolated. Install and test the permanent route before returning the borrowed installation. Execution alone does not prove restored service.'
      : 'WARNING: execution removes the damaged installation and fits the protected route. Execution alone does not prove restored service: repeat the link measurements and the separate endpoint test at the balcony.';
  element.append(paragraph('Preparation is paused. Take as long as you need; there is no countdown or reflex challenge. A compatible conventional tool kit can complete this intervention without a recruited ally.'),
    paragraph(warningText), paragraph('Execution changes the route and makes earlier readings stale. Before committing, return to preparation to inspect evidence, adjust equipment or leave safely.'));
  const label = doc.createElement('label'), warning = doc.createElement('input');
  warning.type = 'checkbox'; warning.disabled = !view.available || view.reviewId === null;
  label.append(warning, doc.createTextNode('I understand that execution changes the route and makes earlier readings stale'));
  const execute = doc.createElement('button'), returnButton = doc.createElement('button');
  execute.type = returnButton.type = 'button'; execute.textContent = 'Execute reviewed plan'; execute.disabled = true;
  returnButton.textContent = 'Return to preparation';
  element.append(label, execute, returnButton); host.append(element);
  let retired = false;
  const active = (control: HTMLElement) => !retired && !signal.aborted && options.isCurrent() && element.isConnected
    && element.contains(control) && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0
    && control.getClientRects().length > 0;
  warning.addEventListener('change', () => {
    if (active(warning) && !warning.disabled) execute.disabled = !view.available || view.reviewId === null || !warning.checked;
  }, { signal });
  execute.addEventListener('click', () => {
    if (!active(execute) || execute.disabled || warning.disabled || !active(warning) || !warning.checked || !view.reviewId) return;
    dispatcher.dispatch(capture({ kind: 'execute-repair-plan', reviewId: view.reviewId, warningAcknowledged: true }));
  }, { signal });
  returnButton.addEventListener('click', () => {
    if (!active(returnButton)) return;
    // Retire synchronously even if the owner callback does not immediately render.
    retired = true; element.hidden = true; options.onReturn();
  }, { signal });
  return { element, warning, execute, returnButton, dispose() { retired = true; element.remove(); } };
}
