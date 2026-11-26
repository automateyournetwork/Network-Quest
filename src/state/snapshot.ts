// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { SaveValidator, SaveValidationCode } from '../services/save-validator';
import type { ReducerState } from './reducer';
import type { ClientGeneration, DirtyGeneration, RuntimeState, SaveSnapshotV1 } from './types';

/** One immutable candidate for a later, separately authorized conditional write. */
export interface SnapshotCapture {
  readonly snapshot: SaveSnapshotV1;
  readonly bodyBytes: readonly number[];
  readonly capturedGeneration: DirtyGeneration;
  readonly clientGeneration: ClientGeneration;
}
export type SnapshotCaptureResult =
  | { readonly ok: true; readonly capture: SnapshotCapture }
  | { readonly ok: false; readonly code: SaveValidationCode | 'transition-pending' | 'generation'; readonly path: string };

const validGeneration = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;

/**
 * Pure counter arithmetic for producers that do not already use the reducer.
 * The existing reducer advances durable changes itself: never call this again
 * after a reduction or during capture. null means exhausted/invalid, not reset.
 */
export function advanceDirtyGeneration(current: DirtyGeneration): DirtyGeneration | null {
  return validGeneration(current) && current < Number.MAX_SAFE_INTEGER ? (current + 1) as DirtyGeneration : null;
}

/**
 * Capture one actual reducer state synchronously, after any successful store CAS.
 * A preparation checkpoint or old safe capture is never a fallback for an unsafe
 * current state. SaveValidator projects only durable fields, validates against
 * explicit authored content policy and owns/deep-freezes the parsed candidate.
 * No account request, storage, mutation, acknowledgement or dirty increment.
 */
export function captureSafeSnapshot(state: ReducerState, validator: SaveValidator): SnapshotCaptureResult {
  if (state.control.pending) return { ok: false, code: 'transition-pending', path: '/control/pending' };
  const { runtime } = state;
  const capturedGeneration = runtime.persistence.dirtyGeneration, clientGeneration = runtime.auth.clientGeneration;
  if (!validGeneration(capturedGeneration) || !validGeneration(clientGeneration)) return { ok: false, code: 'generation', path: '/persistence/dirtyGeneration' };
  const checked = validator.validateRuntime(runtime);
  if (!checked.ok) return { ok: false, code: checked.code, path: checked.path };
  return Object.freeze({ ok: true, capture: Object.freeze({ snapshot: checked.candidate,
    bodyBytes: Object.freeze(Array.from(new TextEncoder().encode(checked.json))), capturedGeneration, clientGeneration }) });
}

export type CapturedGenerationAcknowledgement =
  | { readonly ok: true; readonly lastAcknowledgedGeneration: DirtyGeneration; readonly hasUnsavedChanges: boolean }
  | { readonly ok: false; readonly reason: 'different-adventure' | 'different-account-generation' | 'generation' };

/**
 * Counter projection ONLY, after the coordinator verifies a matching committed
 * request/receipt. This does not prove a save or set status/server metadata.
 * Older receipt vs current slot reconciliation remains the coordinator's job.
 * Restore/new-run/account changes must invalidate the pending operation before
 * calling this; generation equality alone cannot identify a replaced runtime.
 */
export function acknowledgeCapturedGeneration(runtime: RuntimeState, capture: SnapshotCapture): CapturedGenerationAcknowledgement {
  if (!runtime.game || runtime.game.adventureId.toLowerCase() !== capture.snapshot.adventureId.toLowerCase()) {
    return { ok: false, reason: 'different-adventure' };
  }
  if (runtime.auth.clientGeneration !== capture.clientGeneration) return { ok: false, reason: 'different-account-generation' };
  const current = runtime.persistence.dirtyGeneration, previous = runtime.persistence.lastAcknowledgedGeneration;
  if (!validGeneration(current) || !validGeneration(capture.capturedGeneration) || !validGeneration(capture.clientGeneration)
    || capture.capturedGeneration > current || (previous !== null && (!validGeneration(previous) || previous > current))) {
    return { ok: false, reason: 'generation' };
  }
  const acknowledged = Math.max(previous ?? 0, capture.capturedGeneration) as DirtyGeneration;
  return Object.freeze({ ok: true, lastAcknowledgedGeneration: acknowledged, hasUnsavedChanges: current !== acknowledged });
}
