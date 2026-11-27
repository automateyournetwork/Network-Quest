// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { QualifiedId } from '../domain/types';
import type { Navigation, NavigationResolution } from '../state/navigation';
import type { ReducerState } from '../state/reducer';
import type { SafeState } from '../state/types';
import type { SceneObjectView, SemanticControl } from './app-shell';
import type { GameplayStore } from './controller-store';
import { guardedPlan, playable, rejected, reductionPlan, unavailable } from './controller-store';
import type { WalkPlanner } from './verbs';

/** One T025 Walk port. The action bus owns capture, cancellation and replay. */
export function createNavigationPlanner({ navigation, store }: { readonly navigation: Navigation; readonly store: GameplayStore }): WalkPlanner {
  return ({ room, targetId }, action, before) => {
    if (!playable(before)) return unavailable('unavailable-state', 'Movement is unavailable during this activity.');
    const game = before.runtime.game!, input = action.input;
    if (room.id !== game.world.roomId || input.kind !== 'interact' || input.verb !== 'walk' || input.itemId !== null || input.targetId !== targetId) {
      return rejected('invalid-navigation', 'Choose a current-room floor position or exit with Walk.');
    }
    const found = navigation.resolve(game.world, targetId, before.runtime.activity!.kind as SafeState);
    if (!found.ok) return unavailable(found.reason, found.message);
    // Arrival is one synchronous reducer commit. Any animation follows the
    // committed world; a missing renderer cannot hold the adventure halfway.
    return guardedPlan(store, before, reductionPlan(store, action, before, { kind: 'apply', destination: found.destination,
      evaluation: { status: 'correct', reasonCode: 'authored-navigation', observations: [], acceptedEffects: [] } }, found.message));
  };
}

/** Shared projection for the native shell and visual adapters. Reuses T025's
 * hotspot alternatives; this module creates no listeners or second input path.
 */
export function createSceneObjectProjection({ registry, navigation, resolveDuringEncounter }: { readonly registry: ContentRegistry; readonly navigation: Navigation;
  readonly resolveDuringEncounter?: (state: ReducerState, targetId: QualifiedId) => NavigationResolution }) {
  return (state: ReducerState, hotspots: readonly SceneObjectView[]): readonly SceneObjectView[] => {
    const game = state.runtime.game, ui = state.runtime.ui, room = game && registry.record(game.world.roomId);
    if (!game || !ui || room?.kind !== 'room') return [];
    if (hotspots.length !== room.hotspots.length || new Set(hotspots.map(h => h.id)).size !== hotspots.length
      || hotspots.some(h => !room.hotspots.some(actual => actual.id === h.id))) throw new TypeError('Scene projection must include every actual current-room hotspot exactly once.');
    const action = (id: string, label: string, targetId: string): SemanticControl => {
      let result: NavigationResolution | null = null;
      if (playable(state)) result = navigation.resolve(game.world, targetId as QualifiedId, state.runtime.activity!.kind as SafeState);
      else if (state.runtime.activity?.kind === 'active-encounter') {
        try { result = resolveDuringEncounter?.(state, targetId as QualifiedId) ?? null; } catch { /* Presentation fails closed. */ }
      }
      const unavailableReason = result?.ok ? undefined : result?.message ?? 'Movement is unavailable during this activity.';
      return { id, label, action: { kind: 'interact', targetId: targetId as QualifiedId, verb: ui.selectedVerb, itemId: null },
        ...(unavailableReason === undefined ? {} : { unavailableReason }) };
    };
    return [
      ...room.hotspots.map(hotspot => ({ ...hotspots.find(h => h.id === hotspot.id)!, label: hotspot.label, description: hotspot.description })),
      ...room.exits.map(exit => ({ id: `exit:${room.id}:${exit.toRoomId}`, label: exit.label, description: 'Choose Walk to travel through this exit.',
        actions: [action(`walk:${room.id}:${exit.toRoomId}`, exit.label, exit.toRoomId)] })),
      ...room.walkRegions.map(region => ({ id: region.id, label: region.label, description: 'Choose Walk to move to the safe position on this clear floor.',
        actions: [action(`walk-region:${region.id}`, region.label, region.id)] })),
      ...room.safePositions.map(position => {
        const anchor = registry.safePosition(position.id), label = anchor?.label ?? 'Safe floor position';
        return { id: position.id, label, description: 'A safe place to stand on the clear floor. Choose Walk to move here.',
          actions: [action(`walk-position:${position.id}`, label, position.id)] };
      }),
    ];
  };
}
