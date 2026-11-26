// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ApiFailure, GameApi, Preferences } from '../services/game-api';
import type { SaveCoordinator, SaveCoordinatorStore, SaveCoordinatorView } from '../services/save-coordinator';
import type { ReducerState } from './reducer';

export const AUTOSAVE_EXPLANATION = 'Autosave replaces the same account save slot and applies across devices. It is off for new accounts. Save this adventure manually first; later saves happen only at safe boundaries.';
export interface AutosavePreferencesReview {
  readonly etag: string;
  readonly enabled: boolean;
  readonly explanation: string;
}
export interface AutosaveState {
  readonly kind: 'unavailable' | 'ready' | 'updating' | 'unconfirmed' | 'conflict' | 'disposed';
  /** Effective permission in this tab, not proof that another device is paused. */
  readonly enabled: boolean;
  /** Last confirmed session value; an unconfirmed PATCH may have changed it. */
  readonly serverEnabled: boolean | null;
  readonly queued: boolean;
  readonly message: string;
}
export type AutosavePreferenceResult =
  | { readonly ok: true; readonly enabled: boolean; readonly preferences: Preferences }
  | { readonly ok: false; readonly reason: 'stale' | 'unavailable' | 'api' | 'conflict'; readonly error?: ApiFailure };
interface Context { readonly epoch: object; readonly view: SaveCoordinatorView }
interface Reviewed extends Context { readonly preferences: Preferences }
interface Queued extends Context { readonly attemptId: string; readonly timer: ReturnType<typeof setTimeout> }
const refused = (reason: 'stale' | 'unavailable'): AutosavePreferenceResult => ({ ok: false, reason });
const sameAdventure = (a: string | undefined, b: string | undefined): boolean => a?.toLowerCase() === b?.toLowerCase();
const terminal = (state: ReducerState): boolean => ['terminal-failure', 'shutdown'].includes(state.runtime.activity?.kind ?? '')
  || (state.runtime.game?.world.continueOutcome as string | null) === 'E03';
function safe(state: ReducerState): boolean {
  const { game, activity } = state.runtime;
  return !!game && !state.control.pending && !!activity && ['stable-exploration', 'safe-preparation', 'safe-continue'].includes(activity.kind)
    && !terminal(state) && (!game.world.continueOutcome || activity.kind === 'safe-continue');
}

/**
 * Volatile scheduling and explicit account preference choices only. The actual
 * coordinator owns snapshot capture, policy, serialization and receipt recovery.
 * Call observe AFTER each committed gameplay transition and controller updates;
 * call objectiveFeedbackDismissed ONLY on the actual user dismissal. A render or
 * null feedback is not that event. Before New/Restore/account/logout replacement
 * call invalidateView, even when IDs/counters repeat. No storage or auto-retry.
 */
export class AutosaveController {
  private readonly api: GameApi;
  private readonly coordinator: SaveCoordinator;
  private readonly store: SaveCoordinatorStore;
  private readonly debounceMs: number;
  private readonly unsubscribe: () => void;
  private readonly reviews = new WeakMap<AutosavePreferencesReview, Reviewed>();
  private readonly listeners = new Set<(state: AutosaveState) => void>();
  private epoch: object = {};
  private view: SaveCoordinatorView | null;
  private previous: ReducerState;
  private queue: Queued | null = null;
  private readonly objectives = new Set<string>();
  private lastAttemptedGeneration = -1;
  private operation: object | null = null;
  private latestChoice: object | null = null;
  private localPause = false;
  private preferenceKind: 'ready' | 'updating' | 'unconfirmed' | 'conflict' = 'ready';
  private disposed = false;
  private notification = 0;

  constructor(options: { api: GameApi; coordinator: SaveCoordinator; store: SaveCoordinatorStore; debounceMs?: number }) {
    this.api = options.api; this.coordinator = options.coordinator; this.store = options.store;
    this.debounceMs = options.debounceMs ?? 750;
    if (!Number.isSafeInteger(this.debounceMs) || this.debounceMs < 1 || this.debounceMs > 5000) throw new TypeError('Autosave debounce must be 1–5000 ms');
    this.previous = this.store.getState(); this.view = this.coordinator.captureView();
    // Manual I/O, conflict, invalidation and unsupported reads cancel queued work.
    // An acknowledgement does not manufacture another eligible gameplay event.
    this.unsubscribe = this.coordinator.subscribe(() => this.observe());
  }

  get state(): AutosaveState {
    const session = this.api.session, current = !this.disposed && !!this.view && this.coordinator.isCurrentView(this.view);
    const serverEnabled = current && session?.state === 'authenticated' ? session.preferences.values.autosaveEnabled : null;
    const enabled = current && !this.localPause && !this.operation && serverEnabled === true && this.store.getState().runtime.persistence.autosaveEnabled;
    const kind = this.disposed ? 'disposed' : !current ? 'unavailable' : this.preferenceKind;
    const message = kind === 'disposed' ? 'Autosave controls are closed.' : kind === 'unavailable' ? 'Sign in to choose account autosave.'
      : kind === 'updating' ? 'Autosave is paused in this tab while the account setting is confirmed. An already sent save may still complete.'
        : kind === 'unconfirmed' ? 'Autosave is paused in this tab. The account setting is unconfirmed. An already sent save may still complete.'
          : kind === 'conflict' ? 'Autosave is paused in this tab. Review the current account setting before choosing again.'
            : enabled ? 'Autosave is enabled for later safe boundaries.' : 'Autosave is off in this tab. An already sent save may still complete.';
    return Object.freeze({ kind, enabled, serverEnabled, queued: current && this.queue !== null, message });
  }
  subscribe(listener: (state: AutosaveState) => void): () => void {
    if (this.disposed) return () => {};
    this.listeners.add(listener); return () => { this.listeners.delete(listener); };
  }

  observe(): void {
    if (this.disposed) return;
    if (this.syncContext()) { this.emit(); return; }
    const before = this.previous, next = this.store.getState(); this.previous = next;
    const oldGame = before.runtime.game, game = next.runtime.game;
    if (!this.view || !oldGame || !game || !sameAdventure(oldGame.adventureId, game.adventureId)
      || oldGame.world.attemptId !== game.world.attemptId || terminal(before) || terminal(next)
      || game.outcomeHistory.some(event => event.outcome === 'E03' && !oldGame.outcomeHistory.some(previous => previous.id === event.id))) {
      this.objectives.clear(); if (this.cancelQueue()) this.emit(); return;
    }
    if (!this.eligible(next) && this.cancelQueue()) {
      const epoch = this.epoch; this.emit();
      // A cancellation observer may install a different run with identical
      // counters. Never attach the old transition's objectives to that view.
      if (this.disposed || this.epoch !== epoch || this.store.getState() !== next) return;
    }
    const dirty = next.runtime.persistence.dirtyGeneration;
    const changed = game !== oldGame && Number.isSafeInteger(dirty) && dirty > before.runtime.persistence.dirtyGeneration;
    if (changed) for (const id of game.world.completedObjectiveIds) if (!oldGame.world.completedObjectiveIds.includes(id)) this.objectives.add(id);
    // Preparation entry is itself a real safe boundary. Earlier notes may have
    // made the run dirty; entering preparation need not mutate/increment it
    // again. schedule() still rejects already acknowledged/attempted generations.
    const preparationEntry = next.runtime.activity?.kind === 'safe-preparation' && before.runtime.activity?.kind !== 'safe-preparation';
    if ((changed && oldGame.world.roomId !== game.world.roomId) || preparationEntry) this.schedule();
  }

  /** Actual completion-feedback dismissal, never inferred from render/UI null. */
  objectiveFeedbackDismissed(): boolean {
    this.observe();
    const state = this.store.getState();
    if (!this.objectives.size || state.runtime.ui?.feedback !== null || !safe(state) || !this.eligible(state)) return false;
    const completed: readonly string[] = state.runtime.game!.world.completedObjectiveIds;
    if (![...this.objectives].some(id => completed.includes(id))) return false;
    this.objectives.clear(); return this.schedule();
  }

  /** Cancels callbacks/consent, not an already sent or committed save. */
  invalidateView(): void {
    if (this.disposed) return;
    this.reset(null); this.emit();
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true; this.reset(null); this.unsubscribe(); this.emit(); this.listeners.clear();
  }

  capturePreferencesReview(): AutosavePreferencesReview | null {
    if (this.disposed) return null;
    this.syncContext();
    const session = this.api.session;
    if (!this.view || session?.state !== 'authenticated' || !this.coordinator.isCurrentView(this.view)) return null;
    const handle = Object.freeze({ etag: session.preferences.etag, enabled: session.preferences.values.autosaveEnabled, explanation: AUTOSAVE_EXPLANATION });
    this.reviews.set(handle, { epoch: this.epoch, view: this.view, preferences: session.preferences }); return handle;
  }

  /** Explicit user choice only. A stale/failed opt-out remains locally paused. */
  async setEnabled(handle: AutosavePreferencesReview, enabled: boolean): Promise<AutosavePreferenceResult> {
    if (this.disposed) return refused('stale');
    this.syncContext();
    const reviewed = this.reviews.get(handle), session = this.api.session;
    if (typeof enabled !== 'boolean' || !reviewed || !this.current(reviewed) || session?.state !== 'authenticated') return refused('stale');
    if (reviewed.preferences.etag !== session.preferences.etag) {
      // An old account revision cannot authorize a PATCH. A still-current
      // user's opt-out nevertheless stops this tab immediately and supersedes
      // an earlier enable, without touching a different view/account.
      if (!enabled) {
        this.latestChoice = {}; this.operation = null; this.localPause = true; this.preferenceKind = 'conflict'; this.cancelQueue();
        this.projectPreference(reviewed, false); this.emit();
      }
      return refused('stale');
    }
    const operation = {}; this.operation = operation; this.latestChoice = operation;
    this.localPause = true; this.preferenceKind = 'updating'; this.cancelQueue();
    if (!this.projectPreference(reviewed, false)) return refused('stale');
    this.emit();
    if (!this.owns(reviewed, operation)) return refused('stale');
    const patched = await this.api.patchPreferences({ autosaveEnabled: enabled }, reviewed.preferences.etag);
    if (!this.owns(reviewed, operation)) return refused('stale');
    if (!patched.ok) return this.preferenceFailed(patched, reviewed, operation);
    if (patched.data.revision !== reviewed.preferences.revision + 1 || patched.data.values.autosaveEnabled !== enabled) {
      return this.preferenceFailed({ ok: false, kind: 'invalid-response' }, reviewed, operation);
    }
    // GameApi PATCH deliberately does not update api.session. Reconcile both
    // sides before enabling; rebinding the coordinator would erase slot/receipt
    // knowledge and is expressly NOT a preference refresh.
    const refreshed = await this.api.getSession();
    if (!this.owns(reviewed, operation)) return refused('stale');
    if (!refreshed.ok) return this.preferenceFailed(refreshed, reviewed, operation);
    if (refreshed.data.state !== 'authenticated' || refreshed.data.preferences.revision < patched.data.revision
      || refreshed.data.preferences.values.autosaveEnabled !== enabled) return this.preferenceConflict(reviewed, operation);
    if (!this.projectPreference(reviewed, enabled)) return refused('stale');
    this.operation = null; this.localPause = !enabled; this.preferenceKind = 'ready';
    this.emit();
    return this.current(reviewed) && this.latestChoice === operation ? { ok: true, enabled, preferences: refreshed.data.preferences } : refused('stale');
  }

  /** Explicit read-only refresh for a conflict/unknown setting. Never retries a PATCH or enables a locally paused run. */
  async refreshPreferences(): Promise<AutosavePreferenceResult> {
    if (this.disposed) return refused('stale');
    this.syncContext();
    if (!this.view) return refused('unavailable');
    const context = { epoch: this.epoch, view: this.view }, operation = {};
    this.operation = operation; this.latestChoice = operation; this.preferenceKind = 'updating'; this.cancelQueue(); this.emit();
    if (!this.owns(context, operation)) return refused('stale');
    const refreshed = await this.api.getSession();
    if (!this.owns(context, operation)) return refused('stale');
    if (!refreshed.ok) return this.preferenceFailed(refreshed, context, operation);
    if (refreshed.data.state !== 'authenticated') return refused('stale');
    const enabled = !this.localPause && this.store.getState().runtime.persistence.autosaveEnabled && refreshed.data.preferences.values.autosaveEnabled;
    if (!this.projectPreference(context, enabled)) return refused('stale');
    this.operation = null; this.preferenceKind = this.localPause && refreshed.data.preferences.values.autosaveEnabled ? 'conflict' : 'ready'; this.emit();
    return this.current(context) && this.latestChoice === operation ? { ok: true, enabled, preferences: refreshed.data.preferences } : refused('stale');
  }

  private current(context: Context): boolean {
    return !this.disposed && context.epoch === this.epoch && context.view === this.view && this.coordinator.isCurrentView(context.view);
  }
  private owns(context: Context, operation: object): boolean { return this.operation === operation && this.current(context); }
  private syncContext(): boolean {
    const view = this.coordinator.captureView();
    if (view === this.view) return false;
    this.reset(view); return true;
  }
  private reset(view: SaveCoordinatorView | null): void {
    this.cancelQueue(); this.epoch = {}; this.view = view; this.previous = this.store.getState(); this.objectives.clear();
    this.lastAttemptedGeneration = -1; this.operation = null; this.latestChoice = null; this.localPause = false; this.preferenceKind = 'ready';
  }
  private eligible(state: ReducerState): boolean {
    const p = state.runtime.persistence, session = this.api.session;
    return !this.disposed && !!this.view && this.coordinator.isCurrentView(this.view) && !this.operation && !this.localPause
      && safe(state) && p.autosaveEnabled && session?.state === 'authenticated' && session.preferences.values.autosaveEnabled
      && !!p.knownSlot && sameAdventure(p.knownSlot.adventureId, state.runtime.game?.adventureId)
      && !p.pendingRequest && !['saving', 'conflict', 'failed'].includes(p.status)
      && ['slot', 'saved', 'unsaved'].includes(this.coordinator.state.kind)
      && Number.isSafeInteger(p.dirtyGeneration) && p.dirtyGeneration >= 0
      && p.dirtyGeneration !== p.lastAcknowledgedGeneration && p.dirtyGeneration > this.lastAttemptedGeneration;
  }
  private schedule(): boolean {
    const state = this.store.getState();
    if (!this.eligible(state)) return false;
    this.cancelQueue();
    const queued: Queued = { epoch: this.epoch, view: this.view!, attemptId: state.runtime.game!.world.attemptId,
      timer: setTimeout(() => { void this.deliver(queued); }, this.debounceMs) };
    this.queue = queued; this.emit(); return this.queue === queued;
  }
  private async deliver(queued: Queued): Promise<void> {
    if (this.queue !== queued || !this.current(queued)) return;
    this.queue = null;
    const state = this.store.getState();
    if (!this.eligible(state) || state.runtime.game!.world.attemptId !== queued.attemptId) { this.emit(); return; }
    this.lastAttemptedGeneration = state.runtime.persistence.dirtyGeneration;
    // No early bytes/counter mutation: save() captures the CURRENT safe state.
    // Its service events notify UI; never retry or schedule from its result.
    await this.coordinator.save('automatic');
    if (this.current(queued)) this.emit();
  }
  private cancelQueue(): boolean {
    if (!this.queue) return false;
    clearTimeout(this.queue.timer); this.queue = null; return true;
  }
  private projectPreference(context: Context, enabled: boolean): boolean {
    if (!this.current(context)) return false;
    const before = this.store.getState();
    return this.store.compareAndSet(before, { ...before, runtime: { ...before.runtime,
      persistence: { ...before.runtime.persistence, autosaveEnabled: enabled } } });
  }
  private preferenceFailed(error: ApiFailure, context: Context, operation: object): AutosavePreferenceResult {
    if (error.kind === 'http' && error.status === 412) return this.preferenceConflict(context, operation, error);
    this.operation = null; this.localPause = true; this.preferenceKind = 'unconfirmed'; this.emit();
    return this.current(context) && this.latestChoice === operation ? { ok: false, reason: 'api', error } : refused('stale');
  }
  private preferenceConflict(context: Context, operation: object, error?: ApiFailure): AutosavePreferenceResult {
    this.operation = null; this.localPause = true; this.preferenceKind = 'conflict'; this.emit();
    return this.current(context) && this.latestChoice === operation ? { ok: false, reason: 'conflict', ...(error ? { error } : {}) } : refused('stale');
  }
  private emit(): void {
    const serial = ++this.notification, state = this.state;
    for (const listener of [...this.listeners]) {
      if (serial !== this.notification) break;
      if (this.listeners.has(listener)) listener(state);
    }
  }
}
