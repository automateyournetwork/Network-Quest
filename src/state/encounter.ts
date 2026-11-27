// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { ActionId, AdventureId, AttemptId, WorldVersion } from '../domain/types';
import { createReducer, createReducerState } from './reducer';
import type { ReducerState, RejectionReason } from './reducer';
import type { PreparationCheckpoint, WorldState } from './types';

/** Owned in-memory capture. Copying these displayable fields is not authority. */
export interface EncounterContext {
  readonly adventureId: AdventureId;
  readonly expectedVersion: WorldVersion;
}
/** Opaque prepared transition; contains no serializable snapshot or second slot. */
export interface PreparedEncounterChange {
  readonly kind: 'capture-preparation' | 'rollback-preparation';
}
/** Compatible with SaveCoordinatorStore: CAS swaps only, notifications follow. */
export interface EncounterStore {
  getState(): ReducerState;
  compareAndSet(expected: ReducerState, next: ReducerState): boolean;
}
/**
 * Required trusted, pure, version-specific encounter policy. Authoritative
 * commitment markers/objectives must still be absent: save eligibility alone
 * does not prove precommit preparation. No permissive default is supplied.
 * T085 must bind this from the actual encounter's reviewed authored contract.
 */
export type EncounterPreparationBoundary = (world: WorldState) => boolean;
export type EncounterReason = RejectionReason | 'stale-context';
type Failure = { readonly ok: false; readonly reason: EncounterReason };
export type EncounterPreparation = Failure | { readonly ok: true; readonly change: PreparedEncounterChange };
export type EncounterCommit = Failure | { readonly ok: true; readonly state: ReducerState };

const contexts = new WeakMap<EncounterContext, ReducerState>();
const changes = new WeakMap<PreparedEncounterChange, { before: ReducerState; next: ReducerState; context: EncounterContext }>();
const MAX_REVISION = 2_147_483_647;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reject = (reason: EncounterReason): Failure => ({ ok: false, reason });
const validRevision = (n: number) => Number.isInteger(n) && n >= 0 && n <= MAX_REVISION;
const validGeneration = (n: number) => Number.isSafeInteger(n) && n >= 0;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function captured(state: ReducerState, context: EncounterContext): Failure | null {
  if (contexts.get(context) !== state) return reject('stale-context');
  const game = state.runtime.game;
  if (!game || !state.runtime.activity) return reject('no-adventure');
  if (context.adventureId !== game.adventureId) return reject('wrong-adventure');
  if (context.expectedVersion.attemptId !== game.world.attemptId
    || context.expectedVersion.configurationRevision !== game.world.configurationRevision) return reject('stale-version');
  if (state.control.pending) return reject('transition-pending');
  return null;
}
function preparationAnchor(registry: ContentRegistry, world: WorldState, isPreparation: EncounterPreparationBoundary): boolean {
  const anchor = registry.safePosition(world.position.safePositionId);
  if (world.continueOutcome !== null || !registry.has('room', world.roomId) || !anchor
    || anchor.roomId !== world.roomId || !anchor.eligibleStates.includes('safe-preparation')) return false;
  // A faulty policy cannot mutate the live world or turn an exception/truthy
  // nonboolean into permission. The registry itself is trusted validated content.
  try { return isPreparation(freeze(structuredClone(world))) === true; } catch { return false; }
}
/** Preserve the original transient ledger and resample every retained provenance source. */
function withHistory(state: ReducerState): ReducerState | null {
  const game = state.runtime.game!;
  const revisions = [state.control.highestRevision, game.world.configurationRevision,
    ...(state.runtime.checkpoint ? [state.runtime.checkpoint.world.configurationRevision] : []),
    ...game.notebook.measurements.map(m => m.configurationRevision)];
  if (!revisions.every(validRevision) || !validGeneration(state.runtime.persistence.dirtyGeneration)) return null;
  const sampled = createReducerState(state.runtime).control;
  return { ...state, control: { ...state.control, highestRevision: Math.max(...revisions),
    usedAttemptIds: [...new Set([...state.control.usedAttemptIds, ...sampled.usedAttemptIds].map(id => id.toLowerCase() as AttemptId))] } };
}
function prepared(kind: PreparedEncounterChange['kind'], before: ReducerState, next: ReducerState, context: EncounterContext): EncounterPreparation {
  const change = Object.freeze({ kind });
  changes.set(change, { before, next, context });
  return { ok: true, change };
}

/**
 * Capture at the actual UI action boundary, never recapture a delayed callback.
 * Input is trusted immutable reducer state (validated on initial load/Restore),
 * not unvalidated network JSON. Exact identity also invalidates equal-version
 * Restore/new-run/account replacement; versions alone are insufficient.
 */
export function captureEncounterContext(state: ReducerState): EncounterContext | null {
  const game = state.runtime.game;
  if (!game || !state.runtime.activity) return null;
  const context = Object.freeze({ adventureId: game.adventureId,
    expectedVersion: Object.freeze({ attemptId: game.world.attemptId, configurationRevision: game.world.configurationRevision }) });
  contexts.set(context, state);
  return context;
}

/**
 * Prepare a detached world-only checkpoint at an authored safe-preparation
 * boundary. No dirty increment, activity change, consumption, durable request,
 * outcome classification or encounter commitment. T085 owns deliberate entry.
 */
export function prepareEncounterCheckpoint(state: ReducerState, context: EncounterContext, registry: ContentRegistry,
  isPreparation: EncounterPreparationBoundary): EncounterPreparation {
  const invalid = captured(state, context); if (invalid) return invalid;
  const game = state.runtime.game!;
  if (state.runtime.activity?.kind !== 'safe-preparation' || !preparationAnchor(registry, game.world, isPreparation)) return reject('no-preparation');
  const seeded = withHistory(state); if (!seeded) return reject('generation-exhausted');
  const checkpoint: PreparationCheckpoint = freeze({ adventureId: game.adventureId, world: structuredClone(game.world) });
  return prepared('capture-preparation', state, { ...seeded, runtime: { ...state.runtime, checkpoint } }, context);
}

/**
 * Prepare Retry/failure or Continue/shutdown, using the accepted reducer's
 * coherent rewind primitive. Caller supplies a fresh UUID; it is reserved only
 * in the candidate installed by successful CAS. No expected oracle, content ID,
 * save service, browser storage, auth operation or asynchronous work is used.
 * This does not implement Restore Save, confirmation or ordinary safe saving.
 */
export function prepareEncounterRollback(state: ReducerState, context: EncounterContext, registry: ContentRegistry,
  command: { readonly actionId: ActionId; readonly nextAttemptId: AttemptId }, isPreparation: EncounterPreparationBoundary): EncounterPreparation {
  const invalid = captured(state, context); if (invalid) return invalid;
  const checkpoint = state.runtime.checkpoint, game = state.runtime.game!;
  if (!['terminal-failure', 'shutdown'].includes(state.runtime.activity!.kind) || !checkpoint
    || checkpoint.adventureId !== game.adventureId || !preparationAnchor(registry, checkpoint.world, isPreparation)) return reject('no-preparation');
  if (!uuid.test(command.nextAttemptId)) return reject('invalid-action');
  const seeded = withHistory(state); if (!seeded) return reject('generation-exhausted');
  if (seeded.control.usedAttemptIds.includes(command.nextAttemptId.toLowerCase() as AttemptId)) return reject('attempt-reused');
  const result = createReducer({ registry, bindings: [] })(seeded, { actionId: command.actionId, adventureId: context.adventureId,
    expectedVersion: context.expectedVersion, input: { kind: 'rewind-preparation', nextAttemptId: command.nextAttemptId.toLowerCase() as AttemptId } });
  if (result.status !== 'applied') return reject(result.reason ?? 'invalid-action');
  return prepared('rollback-preparation', state, result.state, context);
}

/**
 * The only installation step: one synchronous exact-state swap. Discarding a
 * plan cancels it without touching world, journal, checkpoint, ledger or save.
 * CAS failure leaves it uninstalled. Keep store states immutable; subscribers
 * must observe only after CAS. Notification/save-policy dispatch is external.
 */
export function commitEncounterChange(store: EncounterStore, change: PreparedEncounterChange): EncounterCommit {
  const pending = changes.get(change);
  if (!pending || store.getState() !== pending.before) return reject('stale-context');
  const invalid = captured(pending.before, pending.context); if (invalid) return invalid;
  if (!store.compareAndSet(pending.before, pending.next)) return reject('stale-context');
  changes.delete(change);
  return { ok: true, state: pending.next };
}
