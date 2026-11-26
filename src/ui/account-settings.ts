// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ReducerState } from '../state/reducer';
import type { AuthProvider, ClientGeneration } from '../state/types';
import { AccountService, type AccountState } from '../services/account';
import { GameApi, type ApiFailure, type Session } from '../services/game-api';
import { AUTOSAVE_EXPLANATION, type AutosaveController, type AutosavePreferencesReview } from '../state/autosave';

/** Opaque application lifecycle scopes are independent of API generations and dirty progress. */
export interface AccountSettingsLifecycle {
  capture(): object;
  isCurrent(view: object): boolean;
  /** Synchronous: stop queued autosave, login attempts and save dialogs. Return the resulting scope. */
  stopCompetingWork(view: object): object | null;
  /** Exact current GET-session object only; preserve adventure, then return the new runtime scope. */
  adoptDeletionSession(view: object, session: Session, generation: ClientGeneration): { readonly runtime: object; readonly generation: ClientGeneration } | null;
  /** Synchronous CAS plus ALL adventure/checkpoint/editor/notebook/scene teardown and title render. */
  clearToTitle(view: object, generation: ClientGeneration, reason: 'logout' | 'deletion'): boolean;
}
/** Only supply confirmed public policy text after actual host/manual-copy coverage is reviewed. */
export type AccountBackupPolicy = { readonly status: 'unverified' } | {
  readonly status: 'verified'; readonly backupExpiry: string; readonly deletionMarkerRetention: string;
};
export interface AccountSettingsClock { now(): number; setTimeout(fn: () => void, ms: number): number; clearTimeout(id: number): void }
export type AccountSettingsAction = 'open' | 'close' | 'logout' | 'confirm-logout' | 'check-logout' | 'cancel'
  | 'delete' | 'confirm-delete' | 'open-reauth-tab' | 'check-reauth' | 'send-delete' | 'check-deletion';
export type AccountSettingsPhase = 'idle' | 'logout-warning' | 'logging-out' | 'logout-unconfirmed' | 'checking-logout'
  | 'delete-warning' | 'reauthenticating' | 'popup-blocked' | 'reauth-unconfirmed' | 'delete-ready' | 'deleting'
  | 'delete-unconfirmed' | 'checking-deletion' | 'completed';
export interface AccountSettingsView {
  readonly open: boolean; readonly phase: AccountSettingsPhase; readonly identity: string; readonly authenticated: boolean;
  readonly policy: readonly string[]; readonly policyVerified: boolean; readonly message: string; readonly busy: boolean;
  readonly canCheckDeletion: boolean; readonly canCheckLogout: boolean;
}
interface Confirmation { readonly kind: 'logout' | 'deletion'; readonly runtime: object; readonly generation: ClientGeneration }
interface Operation {
  readonly kind: 'logout' | 'deletion'; runtime: object; generation: ClientGeneration; provider: AuthProvider | null;
  receipt: string | null; timer: number | null; checks: number; deadline: number; nextCheck: number; checking: boolean;
}
const uncertainSave = 'No save is performed by this action. A save already in flight may have committed; its outcome is not changed or confirmed here.';
const unknownDeletion = 'Deletion is unconfirmed. Being signed out does not prove deletion. Your current adventure stays in memory. Status checks only read this operation’s receipt; they never delete or sign in. Closing these settings stops checks and discards the receipt.';
const expiredReceipt = 'Deletion is unconfirmed. This receipt is unknown, expired or no longer available. A new destructive attempt requires a fresh explicit choice and provider sign-in.';
const backoff = [1000, 2000, 4000, 8000, 16000, 30000] as const;
function policyText(policy: AccountBackupPolicy): readonly string[] {
  const text = [
    'Your game account stores the sign-in provider and its account identifier, a display name, settings, and one saved adventure. The adventure includes your progress, inventory, observations and personal notes.',
    'Google and GitHub identities are separate; matching email addresses do not merge accounts. The game requests basic identity, not repositories or contacts. Provider access tokens are not stored in your adventure.',
    'Manual Save and optional autosave replace the same single slot. Autosave is off for new accounts and requires your choice. Operational backups are recovery copies, not additional save slots you can select.',
    'Confirmed logout ends this game session and clears this tab’s adventure without saving or deleting the account slot. It does not sign you out of Google or GitHub.',
    'Confirmed deletion removes live account data, progress and active game sessions. It does not delete your Google or GitHub account. A minimal deletion marker prevents old backups from restoring deleted accounts; confirmation receipts expire after 24 hours.',
  ];
  if (policy.status === 'verified' && policy.backupExpiry.trim() && policy.deletionMarkerRetention.trim()) {
    text.push(policy.backupExpiry, policy.deletionMarkerRetention);
  } else text.push('The actual backup expiry and deletion-marker retention policy has not been verified. No backup erasure deadline is promised in this development build; public account readiness remains pending.');
  return Object.freeze(text);
}
function randomReceipt(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let raw = ''; for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
/** Separate deletion-purpose AccountService: never share the login flow's subscribers. */
export function createAccountSettingsController(options: {
  readonly api: GameApi; readonly account: AccountService; readonly lifecycle: AccountSettingsLifecycle;
  readonly getState: () => ReducerState; readonly changed: () => void; readonly backupPolicy?: AccountBackupPolicy;
  readonly clock?: AccountSettingsClock;
}) {
  const { api, account, lifecycle } = options;
  const clock = options.clock ?? { now: () => Date.now(), setTimeout: (fn, delay) => globalThis.setTimeout(fn, delay) as unknown as number,
    clearTimeout: id => globalThis.clearTimeout(id) };
  const policy = policyText(options.backupPolicy ?? { status: 'unverified' });
  let open = false, disposed = false, phase: AccountSettingsPhase = 'idle', message = '', viewSerial = 0;
  let confirmation: Confirmation | null = null, operation: Operation | null = null;
  const owns = (op: Operation): boolean => !disposed && operation === op && lifecycle.isCurrent(op.runtime);
  const current = (op: Operation): boolean => owns(op) && api.isCurrent(op.generation);
  const notify = () => { if (!disposed) options.changed(); };
  const show = (next: AccountSettingsPhase, text: string) => { phase = next; message = text; notify(); };
  const clearTimer = (op: Operation) => { if (op.timer !== null) clock.clearTimeout(op.timer); op.timer = null; };
  const forget = () => { const op = operation; operation = null; confirmation = null; if (op) { clearTimer(op); op.receipt = null; } };
  const finish = (op: Operation, generation: ClientGeneration) => {
    if (!owns(op) || !api.isCurrent(generation)) return;
    // No renderer notification between final guard and application CAS. App owns teardown.
    if (!lifecycle.clearToTitle(op.runtime, generation, op.kind)) return;
    if (disposed || operation !== op) return; // App may synchronously invalidate this controller.
    forget(); show('completed', op.kind === 'logout' ? 'Logout confirmed. The saved account adventure is unchanged. ' + uncertainSave
      : 'Account deletion confirmed. Live account data and game sessions have been removed. See the backup policy below.');
  };
  const stop = (kind: Operation['kind']): Operation | null => {
    const consent = confirmation;
    if (!consent || consent.kind !== kind || !lifecycle.isCurrent(consent.runtime) || !api.isCurrent(consent.generation)) return null;
    confirmation = null; const serial = viewSerial;
    const runtime = lifecycle.stopCompetingWork(consent.runtime);
    if (disposed || serial !== viewSerial || !runtime || !lifecycle.isCurrent(runtime)) return null;
    account.invalidateView(); // Cancel only after explicit confirmation, never while showing/canceling warning.
    if (disposed || serial !== viewSerial || !lifecycle.isCurrent(runtime)) return null;
    const auth = options.getState().runtime.auth;
    const op: Operation = { kind, runtime, generation: api.capture(), provider: auth.status === 'authenticated' ? auth.provider : null,
      receipt: null, timer: null, checks: 0, deadline: clock.now() + 120000, nextCheck: 0, checking: false };
    operation = op; return op;
  };
  const unavailable = (op: Operation, text = expiredReceipt) => {
    if (!owns(op)) return; clearTimer(op); op.receipt = null; show('delete-unconfirmed', text);
  };
  function scheduleLogoutNotification(op: Operation): void {
    clearTimer(op);
    if (!current(op) || op.checks >= 6) return;
    const wake = () => {
      op.timer = null;
      if (!current(op) || phase !== 'logout-unconfirmed' || op.checking || op.checks >= 6) return;
      const remaining = op.nextCheck - clock.now();
      // Avoid browser timer integer overflow for a very long Retry-After. These
      // wakeups only refresh presentation; no GET, logout or sign-in is issued.
      if (remaining > 0) { op.timer = clock.setTimeout(wake, Math.min(remaining, 2147483647)); return; }
      notify();
    };
    op.timer = clock.setTimeout(wake, Math.min(Math.max(0, op.nextCheck - clock.now()), 2147483647));
  }
  function schedule(op: Operation, delay: number): boolean {
    if (!current(op) || !op.receipt || op.checking) return false;
    clearTimer(op); op.nextCheck = clock.now() + delay;
    if (op.checks >= backoff.length || op.nextCheck >= op.deadline) {
      unavailable(op, unknownDeletion + ' Bounded status checking has stopped. No completion is confirmed; a new destructive attempt requires a fresh explicit choice and provider sign-in.'); return false;
    }
    const wake = () => {
      op.timer = null;
      if (!current(op) || !op.receipt || op.checking) return;
      // A platform timer can wake just before the wall-clock deadline. Retain
      // the scheduled observation instead of losing it at checkDeletion's guard.
      const remaining = op.nextCheck - clock.now();
      if (remaining > 0) { op.timer = clock.setTimeout(wake, Math.min(remaining, 2147483647)); return; }
      void checkDeletion(op);
    };
    op.timer = clock.setTimeout(wake, delay);
    return true;
  }
  async function checkDeletion(op: Operation): Promise<void> {
    if (!current(op) || !op.receipt || op.checking || clock.now() < op.nextCheck) return;
    if (op.checks >= backoff.length || clock.now() >= op.deadline) { unavailable(op); return; }
    clearTimer(op); op.checking = true; op.checks++;
    show('checking-deletion', 'Checking this deletion receipt. This does not delete or sign in.');
    if (!current(op) || !op.receipt) return;
    const result = await api.getDeletionStatus(op.receipt);
    if (!current(op)) return;
    op.checking = false;
    let text = unknownDeletion;
    if (result.ok) {
      if (!api.isCurrent(result.generation)) return;
      if (result.data.state === 'completed') { finish(op, result.generation); return; }
      op.deadline = Math.min(op.deadline, Date.parse(result.data.expiresAt));
      text = 'Deletion is pending. It has not been confirmed complete. ' + unknownDeletion;
    } else {
      if (result.kind === 'stale' || result.kind === 'disposed') return;
      if (result.status === 404) { unavailable(op); return; }
    }
    // Install backoff before notifying subscribers, which may synchronously retry.
    if (schedule(op, Math.max(backoff[Math.min(op.checks, backoff.length - 1)]!, (result.retryAfterSeconds ?? 0) * 1000))) show('delete-unconfirmed', text);
  }
  const onAccount = (state: AccountState) => {
    const op = operation;
    if (!op || op.kind !== 'deletion' || !owns(op) || !['reauthenticating', 'popup-blocked', 'reauth-unconfirmed'].includes(phase)) return;
    if (state.kind === 'session-observed') {
      const generation = api.capture();
      // A hint is only a wake-up. Even this server session does not expose deletion freshness.
      if (state.session !== api.session || !api.isCurrent(generation) || state.session.state !== 'authenticated' || state.session.provider !== op.provider) {
        show('reauth-unconfirmed', 'Provider reauthentication is unconfirmed. No deletion was sent. Your adventure remains in memory.'); return;
      }
      const adopted = lifecycle.adoptDeletionSession(op.runtime, state.session, generation);
      if (disposed || operation !== op || !adopted || !lifecycle.isCurrent(adopted.runtime) || api.session !== state.session || !api.isCurrent(adopted.generation)) return;
      op.runtime = adopted.runtime; op.generation = adopted.generation;
      show('delete-ready', 'A signed-in session was read from the server. This does not prove fresh deletion authorization. Choose Delete account now only if you still intend to delete it; the server must authorize recent same-account sign-in.');
    } else if (state.kind === 'popup-blocked') show('popup-blocked', 'The provider window was blocked. Open a separate sign-in tab to continue the deletion authentication you requested.');
    else if (state.kind === 'unconfirmed' || state.kind === 'failed') show('reauth-unconfirmed', 'Provider reauthentication is unconfirmed. Check the sign-in result explicitly; no deletion has been sent.');
    else if (['opening', 'awaiting-provider', 'checking-session'].includes(state.kind)) show('reauthenticating', 'Complete the new provider sign-in for account deletion in the separate window, then check its result. Your adventure remains here.');
  };
  const unsubscribe = account.subscribe(onAccount);
  async function act(action: AccountSettingsAction): Promise<void> {
    if (disposed) return;
    if (action === 'open') { open = true; notify(); return; }
    if (action === 'close' || action === 'cancel') {
      viewSerial++;
      // A warning has no side effects to undo. In particular, never invalidate a pending save/login.
      if (!operation) { confirmation = null; phase = 'idle'; message = ''; if (action === 'close') open = false; notify(); return; }
      // Closing an active operation loses only local observation, not a server commit.
      forget(); account.invalidateView(); phase = 'idle'; message = 'The operation is no longer being checked here. No uncertain result is confirmed or rolled back.';
      if (action === 'close') open = false; notify(); return;
    }
    if (action === 'logout' || action === 'delete') {
      if (operation || options.getState().runtime.auth.status !== 'authenticated' || api.session?.state !== 'authenticated') return;
      open = true; confirmation = { kind: action === 'logout' ? 'logout' : 'deletion', runtime: lifecycle.capture(), generation: api.capture() };
      show(action === 'logout' ? 'logout-warning' : 'delete-warning', action === 'logout'
        ? 'Log out? Unsaved progress and notes in this tab will be lost after revocation is confirmed. Cancel keeps the session and adventure exactly as they are. ' + uncertainSave
        : 'Delete this game account and its saved adventure? This removes live progress and active game sessions. First confirm your choice and complete a new sign-in with the same provider account. Backup expiry is explained below.'); return;
    }
    if (action === 'confirm-logout' && phase === 'logout-warning') {
      const op = stop('logout'); if (!op) return;
      show('logging-out', 'Revoking this game session. ' + uncertainSave); if (!current(op)) return;
      const request = api.logout(); op.generation = api.capture(); const result = await request;
      if (!owns(op)) return;
      if (result.ok) { finish(op, result.generation); return; }
      if (!current(op) || result.kind === 'stale' || result.kind === 'disposed') return;
      show('logout-unconfirmed', 'Logout is unconfirmed. Your adventure remains in memory. Check the current session to confirm revocation; no logout or save is repeated. ' + uncertainSave); return;
    }
    if (action === 'check-logout' && phase === 'logout-unconfirmed') {
      const op = operation; if (!op || !current(op) || op.checking || clock.now() < op.nextCheck || op.checks >= 6) return;
      clearTimer(op); op.checking = true; op.checks++; show('checking-logout', 'Checking the current game session without repeating logout.'); if (!current(op)) return;
      const result = await api.getSession();
      if (!owns(op)) return; op.checking = false;
      if (result.ok && api.isCurrent(result.generation)) {
        op.generation = result.generation;
        if (result.data.state === 'guest') { finish(op, result.generation); return; }
        // A changed credential may belong to a later account. Never adopt/clear it as this logout.
        forget(); show('logout-unconfirmed', 'A signed-in session is present. Logout is not confirmed. No adventure has been cleared.'); return;
      }
      if (!current(op)) return;
      op.nextCheck = clock.now() + Math.max(2000, (result.retryAfterSeconds ?? 0) * 1000);
      scheduleLogoutNotification(op);
      show('logout-unconfirmed', op.checks >= 6 ? 'Logout remains unconfirmed. Bounded session checking has stopped. The current adventure stays in memory.'
        : 'Logout remains unconfirmed. The current adventure stays in memory.'); return;
    }
    if (action === 'confirm-delete' && phase === 'delete-warning') {
      const op = stop('deletion'); if (!op || !op.provider) return;
      show('reauthenticating', 'Opening a fresh provider sign-in for your confirmed deletion choice.'); if (!current(op)) return;
      // Called directly from the user event before any await, preserving popup activation.
      const work = account.beginSignIn(op.provider, 'delete-reauth'); op.generation = api.capture(); await work; return;
    }
    const op = operation; if (!op || !owns(op) || op.kind !== 'deletion') return;
    if (action === 'open-reauth-tab' && phase === 'popup-blocked') { const work = account.openSignInTab(); op.generation = api.capture(); await work; return; }
    if (action === 'check-reauth' && ['reauthenticating', 'reauth-unconfirmed'].includes(phase)) { await account.checkSession(); return; }
    if (action === 'check-deletion' && phase === 'delete-unconfirmed') { await checkDeletion(op); return; }
    if (action === 'send-delete' && phase === 'delete-ready' && current(op)) {
      try { op.receipt = randomReceipt(); } catch { unavailable(op, 'Deletion was not sent because a secure confirmation receipt could not be created.'); return; }
      show('deleting', 'Sending your confirmed account deletion. Completion is not yet confirmed.'); if (!current(op)) return;
      const request = api.deleteAccount(op.receipt); op.generation = api.capture(); const result = await request;
      if (!owns(op)) return;
      if (result.ok) { finish(op, result.generation); return; }
      if (!current(op) || result.kind === 'stale' || result.kind === 'disposed') return;
      const rejected = (error: ApiFailure) => error.kind === 'session-required' || error.kind === 'invalid-request'
        || (error.kind === 'http' && error.status !== undefined && error.status < 500 && error.status !== 409 && error.status !== 429);
      if (rejected(result)) { unavailable(op, 'Deletion was not authorized or accepted. No completion is confirmed; your adventure remains in memory. A new attempt needs a fresh explicit choice and provider sign-in.'); return; }
      op.deadline = clock.now() + 120000;
      if (schedule(op, Math.max(backoff[0], (result.retryAfterSeconds ?? 0) * 1000))) show('delete-unconfirmed', unknownDeletion);
    }
  }
  return { act,
    get busy() { return operation !== null; },
    project(): AccountSettingsView {
      const auth = options.getState().runtime.auth;
      const identity = auth.status === 'authenticated' ? `${auth.displayName} (${auth.provider === 'google' ? 'Google' : 'GitHub'})` : 'Guest';
      const op = operation;
      return Object.freeze({ open, phase, identity, authenticated: auth.status === 'authenticated', policy,
        policyVerified: options.backupPolicy?.status === 'verified' && !!options.backupPolicy.backupExpiry.trim() && !!options.backupPolicy.deletionMarkerRetention.trim(),
        message, busy: op !== null,
        canCheckDeletion: !!op && op.kind === 'deletion' && current(op) && !!op.receipt && !op.checking && clock.now() >= op.nextCheck && op.checks < 6,
        canCheckLogout: !!op && op.kind === 'logout' && current(op) && !op.checking && clock.now() >= op.nextCheck && op.checks < 6 });
    },
    /** Explicit new adventure/restore/account lifecycle; not a canceled logout warning. */
    invalidateView() { if (disposed) return; viewSerial++; forget(); account.invalidateView(); open = false; phase = 'idle'; message = ''; },
    dispose() { if (disposed) return; viewSerial++; forget(); disposed = true; unsubscribe(); account.dispose(); },
  };
}

/** Semantic controls retain nodes across status redraws; all server/user text uses textContent. */
export function createAccountSettingsPanel(host: HTMLElement, act: (action: AccountSettingsAction) => void) {
  const doc = host.ownerDocument, element = doc.createElement('section'), abort = new AbortController();
  element.className = 'nq-shell'; element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Settings'); element.hidden = true;
  const heading = doc.createElement('h2'); heading.textContent = 'Account settings'; heading.tabIndex = -1;
  const identity = doc.createElement('p'), status = doc.createElement('p'), policy = doc.createElement('div'), controls = doc.createElement('div');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); controls.className = 'nq-shell-controls';
  const buttons = new Map<AccountSettingsAction, HTMLButtonElement>();
  for (const [action, label] of [
    ['logout', 'Log out'], ['delete', 'Delete account'], ['confirm-logout', 'Confirm logout'], ['check-logout', 'Check logout status'],
    ['confirm-delete', 'Confirm choice and sign in again'], ['open-reauth-tab', 'Open deletion sign-in tab'], ['check-reauth', 'Check deletion sign-in result'],
    ['send-delete', 'Delete account now'], ['check-deletion', 'Check deletion status'], ['cancel', 'Cancel'], ['close', 'Close settings'],
  ] as const) {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', () => act(action), { signal: abort.signal });
    buttons.set(action, button); controls.append(button);
  }
  element.append(heading, identity, status, controls, policy); host.append(element);
  let wasOpen = false, previousPhase: AccountSettingsPhase = 'idle', focusBack: HTMLElement | null = null, lastPolicy: readonly string[] | null = null;
  element.addEventListener('keydown', event => { if (event.key === 'Escape' && !event.repeat && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) { event.preventDefault(); act('close'); } }, { signal: abort.signal });
  return { element,
    render(view: AccountSettingsView) {
      element.hidden = !view.open; identity.textContent = view.identity; status.textContent = view.message;
      if (lastPolicy !== view.policy) { lastPolicy = view.policy; policy.replaceChildren(); const title = doc.createElement('h3'); title.textContent = 'Account data and backup policy'; policy.append(title);
        for (const text of view.policy) { const p = doc.createElement('p'); p.textContent = text; policy.append(p); } }
      const visible = new Set<AccountSettingsAction>(['close']);
      if (!view.busy && !['logout-warning', 'delete-warning'].includes(view.phase) && view.authenticated) { visible.add('logout'); visible.add('delete'); }
      if (view.phase === 'logout-warning') { visible.add('confirm-logout'); visible.add('cancel'); }
      if (view.phase === 'delete-warning') { visible.add('confirm-delete'); visible.add('cancel'); }
      if (view.phase === 'logout-unconfirmed' && view.canCheckLogout) visible.add('check-logout');
      if (view.phase === 'popup-blocked') visible.add('open-reauth-tab');
      if (['reauthenticating', 'reauth-unconfirmed'].includes(view.phase)) visible.add('check-reauth');
      if (view.phase === 'delete-ready') { visible.add('send-delete'); visible.add('cancel'); }
      if (view.phase === 'delete-unconfirmed' && view.canCheckDeletion) visible.add('check-deletion');
      for (const [action, button] of buttons) button.hidden = !visible.has(action);
      if (view.open && !wasOpen) { const currentFocus = doc.activeElement; focusBack = currentFocus && currentFocus instanceof HTMLElement ? currentFocus : null; heading.focus(); }
      else if (view.open && view.phase !== previousPhase && doc.activeElement instanceof HTMLElement && doc.activeElement.hidden) heading.focus();
      else if (!view.open && wasOpen && focusBack?.isConnected) focusBack.focus();
      wasOpen = view.open; previousPhase = view.phase;
    },
    dispose() { abort.abort(); element.remove(); focusBack = null; },
  };
}

/** Explicit conditional preference choices; rendering never writes or rebinds the save coordinator. */
export function createAutosaveSettingsPanel(host: HTMLElement, autosave: AutosaveController) {
  const doc = host.ownerDocument, element = doc.createElement('section'), abort = new AbortController();
  const heading = doc.createElement('h3'), explanation = doc.createElement('p'), status = doc.createElement('p'), controls = doc.createElement('div');
  heading.textContent = 'Account autosave'; explanation.textContent = AUTOSAVE_EXPLANATION; status.setAttribute('role', 'status'); controls.className = 'nq-shell-controls';
  let review: AutosavePreferencesReview | null = null, blocked = true;
  const button = (label: string, run: () => void) => { const control = doc.createElement('button'); control.type = 'button'; control.textContent = label;
    control.addEventListener('click', run, { signal: abort.signal }); controls.append(control); return control; };
  const enable = button('Enable account autosave', () => { if (!blocked && review) void autosave.setEnabled(review, true); });
  const disable = button('Turn off account autosave', () => { if (!blocked && review) void autosave.setEnabled(review, false); });
  const refresh = button('Check account autosave setting', () => { if (!blocked) void autosave.refreshPreferences(); });
  element.append(heading, explanation, status, controls); host.append(element);
  return { render(visible: boolean, operationBusy: boolean) {
    element.hidden = !visible; blocked = operationBusy; review = visible && !blocked ? autosave.capturePreferencesReview() : null;
    const state = autosave.state;
    status.textContent = `${state.message} Last confirmed account setting: ${state.serverEnabled === null ? 'unavailable' : state.serverEnabled ? 'on' : 'off'}.`;
    enable.disabled = blocked || !review || state.kind === 'updating' || state.enabled;
    disable.disabled = blocked || !review || (!state.enabled && state.serverEnabled !== true && state.kind !== 'updating');
    refresh.hidden = !['unconfirmed', 'conflict'].includes(state.kind); refresh.disabled = blocked || state.kind === 'updating';
  }, dispose() { review = null; abort.abort(); element.remove(); } };
}
