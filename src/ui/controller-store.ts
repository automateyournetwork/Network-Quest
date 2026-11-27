import type { ContentRegistry } from '../content/registry';
import type { ActionId, QualifiedId } from '../domain/types';
import { encounterCharacter } from '../state/party';
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ReducerInput, ReducerState, Reduction } from '../state/reducer';
import type { UiState } from '../state/types';
import { reducerActionHandler } from './action-bus';
import type { ActionPlan, ActionResult, CapturedAction, ReducerActionAdapter, SemanticAction } from './action-bus';

export type GameplayStore = Pick<ReducerActionAdapter, 'getState' | 'reduce' | 'compareAndSet'>;
export const unavailable = (reason: string, message: string): ActionResult => ({ status: 'unavailable', reason, message });
export const rejected = (reason: string, message: string): ActionResult => ({ status: 'rejected', reason, message });
export function playable(state: ReducerState): boolean {
  return !!state.runtime.game && !!state.runtime.ui && !state.control.pending
    && ['stable-exploration', 'safe-preparation', 'safe-continue'].includes(state.runtime.activity?.kind ?? '');
}
export type ActiveActionAdmission = (state: ReducerState, input: SemanticAction) => boolean;
/** Optional trusted, closed action policy; never broadens generic playable(). */
export function actionAvailable(state: ReducerState, input: SemanticAction, allow?: ActiveActionAdmission): boolean {
  if (playable(state)) return true;
  if (!state.runtime.game || !state.runtime.ui || state.control.pending || state.runtime.activity?.kind !== 'active-encounter') return false;
  try { return allow?.(state, input) === true; } catch { return false; }
}
/** Protect transient selections and synchronous injected controller commits too. */
export function guardedPlan(store: GameplayStore, before: ReducerState, plan: ActionPlan): ActionPlan {
  if (store.getState() !== before) return rejected('state-replaced', 'The adventure has changed. Choose the action again.');
  return plan.status !== 'ready' ? plan : { status: 'ready', commit: () => store.getState() !== before
    ? rejected('state-replaced', 'The adventure has changed. Choose the action again.') : plan.commit() };
}
/** Only explicit transient UiState keys; never receives an arbitrary game patch. */
export function uiPlan(store: GameplayStore, before: ReducerState, patch: Partial<Pick<UiState, 'selectedVerb' | 'selectedItem' | 'panel'>>, message: string): ActionPlan {
  if (!before.runtime.ui) return rejected('no-adventure', 'Start an adventure first.');
  const next: ReducerState = { ...before, runtime: { ...before.runtime, ui: { ...before.runtime.ui, ...patch } } };
  return guardedPlan(store, before, { status: 'ready', commit: () => store.compareAndSet(before, next)
    ? { status: 'handled', message } : rejected('state-replaced', 'The adventure has changed. Choose the action again.') });
}
/** Stage an actual authored actor encounter inside the caller's single CAS. */
export function prepareActorEncounter(registry: ContentRegistry, store: GameplayStore, before: ReducerState, hotspotId: QualifiedId, verb: 'look' | 'talk'): Reduction {
  const game = before.runtime.game;
  if (!game || !encounterCharacter(registry, game, hotspotId, verb)) return { status: 'no-op', state: before };
  return store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
    input: { kind: 'party', operation: { kind: 'encounter', hotspotId, verb } } });
}
/** Effects still pass through the canonical reducer's atomic/receipt checks. */
export function reductionPlan(store: GameplayStore, action: CapturedAction, before: ReducerState, input: ReducerInput, message: string, encounter?: { registry: ContentRegistry; hotspotId: QualifiedId; verb: 'look' | 'talk' }): ActionPlan {
  const plan = reducerActionHandler({ ...store,
    reduce: (state, command) => {
      const first = encounter ? prepareActorEncounter(encounter.registry, store, state, encounter.hotspotId, encounter.verb) : { status: 'no-op' as const, state };
      if (first.status === 'rejected') return { ...first, state };
      const result = store.reduce(first.state, command);
      return result.status === 'rejected' ? { ...result, state } : result;
    },
    compareAndSet: (expected, next) => {
      const ui = next.runtime.ui;
      // Removal is determined by the completed reducer candidate. Clear only
      // the transient cursor selection in that SAME atomic store replacement.
      const selectedStillHeld = ui?.selectedItem === null || next.runtime.game?.world.inventory.some(item => item.itemId === ui?.selectedItem);
      const candidate = ui && !selectedStillHeld ? { ...next, runtime: { ...next.runtime, ui: { ...ui, selectedItem: null } } } : next;
      return store.compareAndSet(expected, candidate);
    },
    resolve: (_action, state) => state === before ? input : null })(action);
  return plan.status !== 'ready' ? plan : { status: 'ready', commit: () => {
    const result = plan.commit(); return result.status === 'handled' ? { ...result, message } : result;
  } };
}
