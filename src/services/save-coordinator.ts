// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { AdventureId } from '../domain/types';
import type { ReducerState } from '../state/reducer';
import { acknowledgeCapturedGeneration, captureSafeSnapshot } from '../state/snapshot';
import type { SnapshotCapture, SnapshotCaptureResult } from '../state/snapshot';
import type { SaveReader, SaveReadResult } from '../state/save-migrations';
import type { ClientGeneration, GameState, PendingSaveRequest, PersistenceState, SaveAcknowledgement, SaveRequestId, SaveSummary } from '../state/types';
import type { ApiFailure, GameApi, PreparedSaveWrite } from './game-api';
import type { SaveValidator } from './save-validator';

/** CAS swaps state synchronously only; subscribers/renderers run after the swap. */
export interface SaveCoordinatorStore {
  getState(): ReducerState;
  compareAndSet(expected: ReducerState, next: ReducerState): boolean;
}
/** Displayable read result AND opaque consent handle. Copies are not authorizations. */
export interface SaveSlotReview {
  readonly summary: SaveSummary | null;
  readonly read: SaveReadResult | null;
}
/** An owned lifecycle token: equal numbers or a cloned object are insufficient. */
export interface SaveCoordinatorView {
  readonly clientGeneration: ClientGeneration;
  readonly apiGeneration: ClientGeneration;
}
export type SaveCoordinatorReason = 'session-required' | 'disposed' | 'stale' | 'busy' | 'pending-outcome' | 'slot-unread' | 'slot-blocked'
  | 'autosave-disabled' | 'manual-adoption-required' | 'replacement-required' | 'reconciliation-required' | 'unsafe' | 'no-pending' | 'api';
export interface SaveCoordinatorFailure {
  readonly ok: false;
  readonly reason: SaveCoordinatorReason;
  readonly error?: ApiFailure;
  readonly captureError?: Extract<SnapshotCaptureResult, { ok: false }>;
}
export type SaveWriteResult = SaveCoordinatorFailure | { readonly ok: true; readonly acknowledgement: SaveAcknowledgement; readonly current: boolean; readonly view: SaveCoordinatorView };
export type SaveSlotResult = SaveCoordinatorFailure | { readonly ok: true; readonly review: SaveSlotReview; readonly view: SaveCoordinatorView };
export type SaveCoordinatorState =
  | { readonly kind: 'unbound' | 'idle' | 'reading' | 'disposed' }
  | { readonly kind: 'slot'; readonly review: SaveSlotReview }
  | { readonly kind: 'saving'; readonly requestId: string }
  | { readonly kind: 'saved' | 'unsaved'; readonly acknowledgement: SaveAcknowledgement }
  | { readonly kind: 'failed'; readonly error: ApiFailure; readonly pending: boolean }
  | { readonly kind: 'conflict'; readonly reason: 'precondition' | 'older-receipt' | 'slot-changed'; readonly currentSummary: SaveSummary | null }
  | { readonly kind: 'blocked'; readonly review: SaveSlotReview };
interface Binding {
  readonly view: SaveCoordinatorView;
  readonly clientGeneration: ClientGeneration;
  readonly apiGeneration: ClientGeneration;
  readonly csrfToken: string;
  readonly adventureId: AdventureId | null;
}
interface Reviewed {
  readonly handle: SaveSlotReview;
  readonly binding: Binding;
  readonly game: GameState | null;
  readonly dirtyGeneration: number;
}
interface Consent { readonly reviewed: Reviewed; readonly capture: SnapshotCapture }
interface Operation {
  readonly binding: Binding;
  readonly capture: SnapshotCapture;
  readonly request: PreparedSaveWrite;
  readonly projection: PendingSaveRequest;
  readonly expectedRevision: number;
}
const rejected = (reason: SaveCoordinatorReason): SaveCoordinatorFailure => ({ ok: false, reason });
const sameAdventure = (a: string | null, b: string | null): boolean => a?.toLowerCase() === b?.toLowerCase();
const validGeneration = (value: number): boolean => Number.isSafeInteger(value) && value >= 0;
function sameSlot(a: SaveSummary | null, b: SaveSummary | null): boolean {
  return a === b || (!!a && !!b && a.etag === b.etag && a.revision === b.revision && a.savedAt === b.savedAt
    && sameAdventure(a.adventureId, b.adventureId) && a.episodeId === b.episodeId && a.roomId === b.roomId
    && a.outcome === b.outcome && a.saveSchemaVersion === b.saveSchemaVersion && a.contentVersion === b.contentVersion);
}

/**
 * Volatile single-slot orchestration. No storage, implicit sign-in, restore,
 * merging, debounce/timer or automatic request retry. T050/T051 compose those UI
 * decisions/triggers. Runtime and API generations are distinct opaque counters.
 * Integration MUST invalidateView before restore/new-run/account-view changes,
 * including a restore with the SAME adventure ID and unchanged dirty counter.
 */
export class SaveCoordinator {
  private readonly api: GameApi;
  private readonly store: SaveCoordinatorStore;
  private readonly validator: SaveValidator;
  private readonly reader: SaveReader;
  private readonly requestId: () => string;
  private binding: Binding | null = null;
  private reviewed: Reviewed | null = null;
  private consent: Consent | null = null;
  private pending: Operation | null = null;
  private busy: object | null = null;
  private slot: 'unread' | 'ready' | 'blocked' = 'unread';
  private reconcile = false;
  private paused = false;
  private disposed = false;
  private view: SaveCoordinatorState = { kind: 'unbound' };
  private readonly issuedKeys = new Set<string>();
  private readonly listeners = new Set<(state: SaveCoordinatorState) => void>();

  constructor(options: { api: GameApi; store: SaveCoordinatorStore; validator: SaveValidator; reader: SaveReader; requestId?: () => string }) {
    this.api = options.api; this.store = options.store; this.validator = options.validator; this.reader = options.reader;
    this.requestId = options.requestId ?? (() => crypto.randomUUID());
  }
  /** Also read on gameplay render: reducer edits do not emit service events. */
  get state(): SaveCoordinatorState {
    if (this.binding && !this.current(this.binding)) return Object.freeze({ kind: 'unbound' });
    if (this.view.kind === 'saved' && this.store.getState().runtime.persistence.status !== 'saved') return Object.freeze({ ...this.view, kind: 'unsaved' });
    return this.view;
  }
  /** Capture before await; recheck immediately before applying UI effects. */
  captureView(): SaveCoordinatorView | null { return this.binding && this.current(this.binding) ? this.binding.view : null; }
  isCurrentView(view: SaveCoordinatorView): boolean { return !!this.binding && this.binding.view === view && this.current(this.binding); }
  /** Restore UI must check this again before discarding any current adventure. */
  isCurrentReview(handle: SaveSlotReview): boolean {
    return !this.busy && !this.pending && !!this.reviewed && this.reviewed.handle === handle && this.reviewIsCurrent(this.reviewed);
  }
  subscribe(listener: (state: SaveCoordinatorState) => void): () => void {
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }

  /** After verified session/runtime auth adoption. Labels never prove identity. */
  bindSession(generations: { clientGeneration: ClientGeneration; apiGeneration: ClientGeneration }): boolean {
    if (this.disposed || this.busy || this.pending) return false;
    const before = this.store.getState(), auth = before.runtime.auth, session = this.api.session;
    if (!validGeneration(generations.clientGeneration) || !validGeneration(generations.apiGeneration)
      || auth.status !== 'authenticated' || session?.state !== 'authenticated' || auth.csrfToken !== session.csrfToken
      || auth.clientGeneration !== generations.clientGeneration || !this.api.isCurrent(generations.apiGeneration)) return false;
    const binding: Binding = Object.freeze({ ...generations, view: Object.freeze({ ...generations }), csrfToken: session.csrfToken, adventureId: before.runtime.game?.adventureId ?? null });
    const next = { ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence, status: 'unsaved' as const,
      knownSlot: undefined, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null,
      lastAcknowledgedGeneration: null, autosaveEnabled: session.preferences.values.autosaveEnabled } } };
    if (!this.store.compareAndSet(before, next)) return false;
    this.binding = binding; this.reviewed = null; this.consent = null; this.slot = 'unread'; this.reconcile = false; this.paused = false;
    this.set({ kind: 'idle' }); return this.current(binding);
  }

  /** Drops only this volatile view; an unknown prior write is NOT declared failed. */
  invalidateView(): void {
    if (this.disposed) return;
    this.clearView(); this.set({ kind: 'unbound' });
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.clearView(); this.set({ kind: 'disposed' }); this.listeners.clear();
  }
  private clearView(): void {
    this.api.invalidate(); this.binding = null; this.pending = null; this.busy = null; this.reviewed = null; this.consent = null;
    this.slot = 'unread'; this.reconcile = false; this.paused = false;
    const before = this.store.getState();
    this.store.compareAndSet(before, { ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence,
      status: 'unsaved', knownSlot: undefined, pendingRequest: null, replacementAuthorization: null,
      lastAcknowledgedGeneration: null, lastAcknowledgement: null, autosaveEnabled: false } } });
  }
  /** A UI dismissal pauses new automatic writes, never erases an unknown outcome. */
  keepPlaying(): void { this.paused = true; }

  async readSlot(): Promise<SaveSlotResult> {
    const refused = this.admission(); if (refused) return refused;
    const binding = this.binding!, before = this.store.getState(), readOperation = {};
    this.busy = readOperation; this.reviewed = null; this.consent = null; this.slot = 'unread';
    this.patch(binding, p => ({ ...p, replacementAuthorization: null }));
    this.set({ kind: 'reading' });
    try {
      if (!this.current(binding) || this.busy !== readOperation) return rejected('stale');
      const result = await this.api.getSave();
      if (!this.current(binding) || this.busy !== readOperation) return rejected('stale');
      let handle: SaveSlotReview;
      if (!result.ok) {
        if (result.kind !== 'http' || result.status !== 404 || result.problem?.code !== 'save-not-found') return this.readFailed(binding, result);
        handle = Object.freeze({ summary: null, read: null });
      } else {
        if (result.generation !== binding.apiGeneration || result.snapshotJson === undefined) return this.readFailed(binding, { ok: false, kind: 'invalid-response' });
        // Do not stringify the parsed unknown projection: retain exact UTF-8.
        const read = this.reader.read(new TextEncoder().encode(result.snapshotJson));
        if (read.status === 'ready' && !this.matchesReadSummary(result.data.summary, result.snapshotJson)) return this.readFailed(binding, { ok: false, kind: 'invalid-response' });
        handle = Object.freeze({ summary: result.data.summary, read });
      }
      const previousSlot = before.runtime.persistence.knownSlot;
      // A GET can discover the same concurrent change as a 412. Merely reading
      // a newer ETag must never authorize an automatic overwrite of that slot.
      if (previousSlot !== undefined && !sameSlot(previousSlot, handle.summary)) this.reconcile = true;
      if (!this.patch(binding, p => ({ ...p, knownSlot: handle.summary, replacementAuthorization: null, status: this.reconcile ? 'conflict' : p.status }))) return rejected('stale');
      this.reviewed = Object.freeze({ handle, binding, game: before.runtime.game, dirtyGeneration: before.runtime.persistence.dirtyGeneration });
      this.slot = handle.read && handle.read.status !== 'ready' ? 'blocked' : 'ready';
      this.busy = null;
      this.set(this.slot === 'blocked' ? { kind: 'blocked', review: handle } : this.reconcile
        ? { kind: 'conflict', reason: 'slot-changed', currentSummary: handle.summary } : { kind: 'slot', review: handle });
      return this.current(binding) ? { ok: true, review: handle, view: binding.view } : rejected('stale');
    } finally { if (this.busy === readOperation) this.busy = null; }
  }

  /** Explicit UI consent only, bound to both server review AND local candidate. */
  authorizeReplacement(handle: SaveSlotReview): boolean {
    const reviewed = this.reviewed, binding = this.binding;
    if (!binding || !this.current(binding) || this.busy || this.pending || this.slot !== 'ready' || !reviewed || reviewed.handle !== handle
      || reviewed.binding !== binding || !this.reviewIsCurrent(reviewed)) return false;
    const captured = captureSafeSnapshot(this.store.getState(), this.validator);
    if (!captured.ok) return false;
    const consent = Object.freeze({ reviewed, capture: captured.capture });
    if (!this.patch(binding, p => ({ ...p, replacementAuthorization: handle.summary ? Object.freeze({ adventureId: captured.capture.snapshot.adventureId,
      reviewedEtag: handle.summary.etag, clientGeneration: binding.clientGeneration }) : null }))) return false;
    this.consent = consent; return true;
  }

  async save(mode: 'manual' | 'automatic'): Promise<SaveWriteResult> {
    const refused = this.admission(); if (refused) return refused;
    const binding = this.binding!, before = this.store.getState(), p = before.runtime.persistence;
    const consent = this.consent && this.reviewIsCurrent(this.consent.reviewed) ? this.consent : null;
    if (this.reconcile && (mode !== 'manual' || !consent)) return rejected('reconciliation-required');
    if (this.slot === 'unread' || p.knownSlot === undefined) return rejected('slot-unread');
    if (this.slot === 'blocked') return rejected('slot-blocked');
    if (mode === 'automatic') {
      if (this.paused || !p.autosaveEnabled || this.api.session?.state !== 'authenticated' || !this.api.session.preferences.values.autosaveEnabled) return rejected('autosave-disabled');
      if (p.knownSlot === null || !sameAdventure(p.knownSlot.adventureId, before.runtime.game?.adventureId ?? null)) return rejected('manual-adoption-required');
    }
    const needsReplacement = !!p.knownSlot && !sameAdventure(p.knownSlot.adventureId, before.runtime.game?.adventureId ?? null);
    if (needsReplacement && !consent) return rejected('replacement-required');
    const captured = captureSafeSnapshot(before, this.validator);
    if (!captured.ok) return { ok: false, reason: 'unsafe', captureError: captured };
    const capture = consent?.capture ?? captured.capture;
    // A consent may be consumed only against the exact reviewed slot identity.
    if (consent && (consent.reviewed.handle.summary?.etag !== p.knownSlot?.etag
      || !sameAdventure(consent.reviewed.handle.summary?.adventureId ?? null, p.knownSlot?.adventureId ?? null))) return rejected('replacement-required');
    let key: string;
    try { key = this.requestId(); } catch { return { ok: false, reason: 'api', error: { ok: false, kind: 'invalid-request' } }; }
    if (this.issuedKeys.has(key.toLowerCase())) return { ok: false, reason: 'api', error: { ok: false, kind: 'invalid-request' } };
    const precondition = p.knownSlot === null ? { header: 'If-None-Match', value: '*' } as const : { header: 'If-Match', value: p.knownSlot.etag } as const;
    const prepared = this.api.prepareSaveWrite({ bodyBytes: new Uint8Array(capture.bodyBytes), requestId: key, mode, precondition,
      confirmAdventureReplacement: mode === 'manual' && !!consent });
    if (!prepared.ok) return { ok: false, reason: 'api', error: prepared };
    if (!this.current(binding) || prepared.request.clientGeneration !== binding.apiGeneration) return rejected('stale');
    const projection: PendingSaveRequest = Object.freeze({ requestId: key as SaveRequestId, bodyBytes: prepared.request.bodyBytes,
      precondition: Object.freeze(precondition), mode, confirmAdventureReplacement: prepared.request.confirmAdventureReplacement,
      capturedGeneration: capture.capturedGeneration, clientGeneration: capture.clientGeneration });
    const operation: Operation = Object.freeze({ binding, capture, request: prepared.request, projection, expectedRevision: (p.knownSlot?.revision ?? 0) + 1 });
    this.issuedKeys.add(key.toLowerCase()); this.pending = operation;
    if (!this.patch(binding, state => ({ ...state, pendingRequest: projection }))) { if (this.pending === operation) this.pending = null; return rejected('stale'); }
    return this.send(operation);
  }

  /** Replays the ORIGINAL prepared handle; current policy/state is not recaptured. */
  retryPending(): Promise<SaveWriteResult> {
    if (this.disposed) return Promise.resolve(rejected('disposed'));
    if (!this.binding || !this.current(this.binding)) return Promise.resolve(rejected('session-required'));
    if (this.busy) return Promise.resolve(rejected('busy'));
    if (!this.pending) return Promise.resolve(rejected('no-pending'));
    return this.send(this.pending);
  }

  private async send(operation: Operation): Promise<SaveWriteResult> {
    if (!this.owns(operation)) return rejected('stale');
    const attempt = {}; this.busy = attempt;
    if (!this.patch(operation.binding, p => ({ ...p, status: 'saving' }))) { this.busy = null; return rejected('stale'); }
    this.set({ kind: 'saving', requestId: operation.request.requestId });
    try {
      if (!this.owns(operation) || this.busy !== attempt) return rejected('stale');
      const result = await this.api.putSave(operation.request);
      if (!this.owns(operation) || this.busy !== attempt) return rejected('stale');
      if (!result.ok) {
        if (result.kind === 'http' && result.status === 412 && result.problem?.code === 'save-conflict' && 'currentSummary' in result.problem) {
          const currentSummary = result.problem.currentSummary;
          if (!this.patch(operation.binding, p => ({ ...p, status: 'conflict', pendingRequest: null, replacementAuthorization: null, knownSlot: currentSummary }))) return rejected('stale');
          this.pending = null; this.consent = null; this.reviewed = null; this.slot = 'unread'; this.reconcile = true; this.busy = null;
          this.set({ kind: 'conflict', reason: 'precondition', currentSummary });
          return { ok: false, reason: 'reconciliation-required', error: result };
        }
        return this.writeFailed(operation, result);
      }
      const acknowledgement = result.data;
      if (result.generation !== operation.binding.apiGeneration || !this.matchesAcknowledgement(operation, acknowledgement)) return this.writeFailed(operation, { ok: false, kind: 'invalid-response' });
      // This helper is arithmetic only; owned request/receipt/view checks above
      // establish why this captured generation may be acknowledged at all.
      const before = this.store.getState(), projected = acknowledgeCapturedGeneration(before.runtime, operation.capture);
      if (!projected.ok) return this.writeFailed(operation, { ok: false, kind: 'invalid-response' });
      const current = acknowledgement.committedRevision === acknowledgement.currentSummary.revision;
      const status = !current ? 'conflict' : projected.hasUnsavedChanges ? 'unsaved' : 'saved';
      if (!this.store.compareAndSet(before, { ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence,
        status, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: acknowledgement,
        lastAcknowledgedGeneration: projected.lastAcknowledgedGeneration, knownSlot: acknowledgement.currentSummary } } })) return rejected('stale');
      this.pending = null; this.reviewed = null; this.consent = null; this.reconcile = !current; this.slot = current ? 'ready' : 'unread'; this.busy = null;
      if (current) this.paused = false;
      this.set(current ? { kind: projected.hasUnsavedChanges ? 'unsaved' : 'saved', acknowledgement }
        : { kind: 'conflict', reason: 'older-receipt', currentSummary: acknowledgement.currentSummary });
      return this.current(operation.binding) ? { ok: true, acknowledgement, current, view: operation.binding.view } : rejected('stale');
    } finally { if (this.busy === attempt) this.busy = null; }
  }

  private admission(): SaveCoordinatorFailure | null {
    if (this.disposed) return rejected('disposed');
    if (!this.binding || !this.current(this.binding)) return rejected('session-required');
    if (this.busy) return rejected('busy');
    if (this.pending) return rejected('pending-outcome');
    return null;
  }
  private current(binding: Binding): boolean {
    const runtime = this.store.getState().runtime, session = this.api.session;
    return !this.disposed && this.binding === binding && this.api.isCurrent(binding.apiGeneration)
      && runtime.auth.status === 'authenticated' && runtime.auth.clientGeneration === binding.clientGeneration
      && runtime.auth.csrfToken === binding.csrfToken && session?.state === 'authenticated' && session.csrfToken === binding.csrfToken
      && sameAdventure(runtime.game?.adventureId ?? null, binding.adventureId);
  }
  private owns(operation: Operation): boolean {
    return this.pending === operation && this.current(operation.binding)
      && this.store.getState().runtime.persistence.pendingRequest === operation.projection;
  }
  private reviewIsCurrent(reviewed: Reviewed): boolean {
    const runtime = this.store.getState().runtime;
    return this.reviewed === reviewed && this.current(reviewed.binding) && runtime.game === reviewed.game
      && runtime.persistence.dirtyGeneration === reviewed.dirtyGeneration;
  }
  private patch(binding: Binding, update: (p: PersistenceState) => PersistenceState): boolean {
    if (!this.current(binding)) return false;
    const before = this.store.getState();
    return this.store.compareAndSet(before, { ...before, runtime: { ...before.runtime, persistence: update(before.runtime.persistence) } });
  }
  private writeFailed(operation: Operation, error: ApiFailure): SaveCoordinatorFailure {
    if (!this.owns(operation) || !this.patch(operation.binding, p => ({ ...p, status: 'failed' }))) return rejected('stale');
    // Even a later rejection cannot disprove a previous lost acknowledgement.
    // Keep exact bytes until receipt resolution or explicit whole-view invalidation.
    this.busy = null; this.set({ kind: 'failed', error, pending: true });
    return this.current(operation.binding) ? { ok: false, reason: 'api', error } : rejected('stale');
  }
  private readFailed(binding: Binding, error: ApiFailure): SaveCoordinatorFailure {
    if (!this.patch(binding, p => ({ ...p, status: this.reconcile ? 'conflict' : 'failed' }))) return rejected('stale');
    this.busy = null; this.set({ kind: 'failed', error, pending: false });
    return this.current(binding) ? { ok: false, reason: 'api', error } : rejected('stale');
  }
  private matchesAcknowledgement(operation: Operation, ack: SaveAcknowledgement): boolean {
    if (ack.requestId !== operation.request.requestId || ack.committedRevision !== operation.expectedRevision) return false;
    if (ack.currentSummary.revision > ack.committedRevision) return ack.replayed;
    const snapshot = operation.capture.snapshot, summary = ack.currentSummary;
    return ack.currentSummary.revision === ack.committedRevision && ack.committedAt === summary.savedAt
      && sameAdventure(summary.adventureId, snapshot.adventureId) && summary.episodeId === snapshot.episodeId
      && summary.roomId === snapshot.world.roomId && summary.outcome === snapshot.world.continueOutcome
      && summary.saveSchemaVersion === snapshot.saveSchemaVersion && summary.contentVersion === snapshot.contentVersion;
  }
  private matchesReadSummary(summary: SaveSummary, exactJson: string): boolean {
    // Called only AFTER the reader validated the supported original and every
    // migration. Compare the original metadata, not its migrated target fields.
    const source = JSON.parse(exactJson) as { adventureId: string; episodeId: string; contentVersion: string; saveSchemaVersion: number; world: { roomId: string; continueOutcome: string | null } };
    return sameAdventure(summary.adventureId, source.adventureId) && summary.episodeId === source.episodeId && summary.contentVersion === source.contentVersion
      && summary.saveSchemaVersion === source.saveSchemaVersion && summary.roomId === source.world.roomId && summary.outcome === source.world.continueOutcome;
  }
  private set(state: SaveCoordinatorState): void {
    this.view = Object.freeze(state);
    for (const listener of [...this.listeners]) { if (this.view !== state) break; listener(state); }
  }
}
