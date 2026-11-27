// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import { validateEndingsContent } from '../content/endings';
import type { EndingsContent, RiftHazardDescriptor } from '../content/endings';
import { commitEncounterChange, prepareEncounterCheckpoint } from './encounter';
import type { EncounterContext, EncounterReason, EncounterStore } from './encounter';
import type { ReducerState } from './reducer';
import { riftPreparationBoundary } from './rift-encounter';
import type { GameState, PreparationCheckpoint } from './types';

export interface PreparedRiftHazard { readonly kind: 'commit-rift-hazard' }
type Failure = { readonly ok: false; readonly reason: EncounterReason };
const reject = (reason: EncounterReason): Failure => ({ ok: false, reason });

/** Closed fictional danger; no evaluator result, reward, account operation or IO. */
export function createRiftHazardController(options: { readonly registry: ContentRegistry; readonly content: EndingsContent }) {
  const { registry } = options, checked = validateEndingsContent(options.content);
  const content = checked.ok ? checked.value : null;
  const changes = new WeakMap<PreparedRiftHazard, { before: ReducerState; next: ReducerState }>();
  const receipts = new WeakMap<PreparationCheckpoint, GameState>();
  const offer = (state: ReducerState): RiftHazardDescriptor | null => {
    try {
      const game = state.runtime.game, hazard = content?.hazard;
      if (!game || !hazard || state.control.pending || state.runtime.activity?.kind !== 'safe-preparation'
        || !riftPreparationBoundary(game.world) || String(game.contentVersion) !== content!.contentVersion) return null;
      const room = registry.record(hazard.roomId);
      if (room?.kind !== 'room' || room.contentVersion !== game.contentVersion
        || !hazard.propIds.every(id => registry.has('prop', id) && room.propInstances.some(instance => instance.propId === id))) return null;
      return hazard;
    } catch { return null; }
  };
  return {
    offer,
    prepare(state: ReducerState, context: EncounterContext, command: { readonly hazardId: string; readonly warningAcknowledged: boolean }): Failure | { readonly ok: true; readonly change: PreparedRiftHazard } {
      if (!command || typeof command !== 'object' || Object.keys(command).length !== 2
        || Object.keys(command).some(key => !['hazardId', 'warningAcknowledged'].includes(key))
        || command.warningAcknowledged !== true) return reject('invalid-input');
      const hazard = offer(state);
      if (!hazard) return reject(content ? 'no-preparation' : 'content-error');
      if (command.hazardId !== hazard.id) return reject('invalid-input');
      const prepared = prepareEncounterCheckpoint(state, context, registry, riftPreparationBoundary);
      if (!prepared.ok) return prepared;
      let seeded = state;
      const captured = commitEncounterChange({ getState: () => seeded, compareAndSet(expected, next) {
        if (seeded !== expected) return false; seeded = next; return true;
      } }, prepared.change);
      if (!captured.ok) return captured;
      const change = Object.freeze({ kind: 'commit-rift-hazard' as const });
      changes.set(change, { before: state, next: { ...seeded, runtime: { ...seeded.runtime, activity: { kind: 'terminal-failure' } } } });
      return { ok: true, change };
    },
    commit(store: EncounterStore, change: PreparedRiftHazard): Failure | { readonly ok: true; readonly state: ReducerState } {
      const pending = changes.get(change);
      if (!pending || store.getState() !== pending.before || !offer(pending.before)) return reject('stale-context');
      if (!store.compareAndSet(pending.before, pending.next)) return reject('stale-context');
      changes.delete(change); receipts.set(pending.next.runtime.checkpoint!, pending.next.runtime.game!);
      return { ok: true, state: pending.next };
    },
    /** Survives harmless container refresh; a clone or retry cannot inherit it. */
    failure(state: ReducerState): RiftHazardDescriptor | null {
      const { game, checkpoint, activity } = state.runtime;
      return content && game && checkpoint && !state.control.pending && activity?.kind === 'terminal-failure'
        && checkpoint.adventureId === game.adventureId && receipts.get(checkpoint) === game ? content.hazard : null;
    },
  };
}
