// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { AuthProvider, ClientGeneration } from '../state/types';
import { GameApi, type ApiFailure, type Session } from './game-api';

export interface AuthWindow {
  readonly closed: boolean;
  readonly location: { replace(url: string): void };
  close(): void;
}
export interface AccountMessage { readonly origin: string; readonly source: unknown; readonly data: unknown }
/** Injectable browser boundary. No account/provider data is persisted by this port. */
export interface AccountWindowPort {
  open(kind: 'popup' | 'tab'): AuthWindow | null;
  onMessage(listener: (event: AccountMessage) => void): () => void;
  onFocus(listener: () => void): () => void;
  setTimeout(callback: () => void, delayMs: number): number;
  clearTimeout(id: number): void;
  now(): number;
}
export type AccountState =
  | { readonly kind: 'idle' | 'cancelled' | 'unconfirmed' | 'disposed' }
  | { readonly kind: 'opening' | 'awaiting-provider' | 'checking-session' | 'popup-blocked'; readonly provider: AuthProvider; readonly purpose: 'login' | 'delete-reauth' }
  | { readonly kind: 'failed'; readonly error: ApiFailure }
  | { readonly kind: 'session-observed'; readonly session: Session; readonly source: 'hint' | 'focus' | 'manual' };
interface Attempt {
  readonly provider: AuthProvider;
  readonly purpose: 'login' | 'delete-reauth';
  readonly window: AuthWindow;
  generation: ClientGeneration;
  expiresAt: number;
  timer: number | null;
  checking: boolean;
  checks: number;
  nextCheckAt: number;
  ready: boolean;
  initialCsrf: string | null;
  hintPending: boolean;
  ticks: number;
  recoveryOnly: boolean;
}
const authHint = (data: unknown): boolean => !!data && typeof data === 'object' && !Array.isArray(data)
  && Object.keys(data).length === 1 && Object.hasOwn(data, 'type') && (data as { type: unknown }).type === 'network-quest-auth-complete';

/** Retains the gameplay document. It never changes adventure memory, saves or deletes. */
export class AccountService {
  private view: AccountState = { kind: 'idle' };
  private attempt: Attempt | null = null;
  private blocked: { provider: AuthProvider; purpose: 'login' | 'delete-reauth' } | null = null;
  private disposed = false;
  private readonly unlisten: readonly (() => void)[];
  private readonly listeners = new Set<(state: AccountState) => void>();
  constructor(private readonly api: GameApi, private readonly port: AccountWindowPort) {
    this.unlisten = [port.onMessage(event => {
      const attempt = this.attempt;
      if (attempt && this.current(attempt) && event.origin === api.origin && event.source === attempt.window && authHint(event.data)) void this.check(attempt, 'hint');
    }), port.onFocus(() => { if (this.attempt) void this.check(this.attempt, 'focus'); })];
  }
  get state(): AccountState { return this.view; }
  subscribe(listener: (state: AccountState) => void): () => void { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }

  /** Invoke directly in the click/keyboard handler, before any await. */
  beginSignIn(provider: AuthProvider, purpose: 'login' | 'delete-reauth' = 'login'): Promise<void> {
    return this.begin(provider, purpose, 'popup');
  }
  /** Explicit Open Sign-in Tab action. A second synchronous blank-tab reservation; never _self. */
  openSignInTab(): Promise<void> {
    if (!this.blocked || this.disposed) return Promise.resolve();
    return this.begin(this.blocked.provider, this.blocked.purpose, 'tab');
  }
  /** Explicit read-only retry; bounded and never repeats auth start or deletion. */
  checkSession(): Promise<void> { return this.attempt ? this.check(this.attempt, 'manual') : Promise.resolve(); }
  cancel(): void {
    if (this.disposed) return;
    this.cleanup(true); this.blocked = null; this.api.invalidate(); this.set({ kind: 'cancelled' });
  }
  /** Integration calls this when leaving account UI, restoring or starting another adventure. */
  invalidateView(): void {
    if (this.disposed) return;
    this.cleanup(true); this.blocked = null; this.api.invalidate(); this.set({ kind: 'idle' });
  }
  dispose(): void {
    if (this.disposed) return;
    this.cleanup(true); this.blocked = null; this.api.invalidate(); this.disposed = true;
    this.unlisten.forEach(off => off()); this.set({ kind: 'disposed' }); this.listeners.clear();
  }
  private async begin(provider: AuthProvider, purpose: 'login' | 'delete-reauth', kind: 'popup' | 'tab'): Promise<void> {
    if (this.disposed) return;
    if (!['google', 'github'].includes(provider) || !['login', 'delete-reauth'].includes(purpose)) { this.set({ kind: 'failed', error: { ok: false, kind: 'invalid-request' } }); return; }
    this.cleanup(true); this.blocked = null;
    const generation = this.api.invalidate();
    // This call must remain before the first await, including session bootstrap.
    let popup: AuthWindow | null;
    try { popup = this.port.open(kind); } catch { popup = null; }
    if (!popup) { this.blocked = { provider, purpose }; this.set({ kind: 'popup-blocked', provider, purpose }); return; }
    const attempt: Attempt = { provider, purpose, window: popup, generation, expiresAt: this.port.now() + 600000,
      timer: null, checking: false, checks: 0, nextCheckAt: 0, ready: false, initialCsrf: null, hintPending: false, ticks: 0, recoveryOnly: false };
    this.attempt = attempt; this.set({ kind: 'opening', provider, purpose });
    if (!this.current(attempt)) return;
    const bootstrap = await this.api.getSession();
    if (this.attempt !== attempt || this.disposed) return;
    if (!bootstrap.ok) { this.fail(attempt, bootstrap); return; }
    // This GET may legitimately establish/rotate the local session generation.
    if (!this.api.isCurrent(bootstrap.generation)) { this.finishStale(attempt); return; }
    attempt.generation = bootstrap.generation; attempt.initialCsrf = bootstrap.data.csrfToken;
    if (this.closed(attempt)) { this.cancel(); return; }
    const started = await this.api.startAuth(provider, purpose);
    if (!this.current(attempt)) { this.finishStale(attempt); return; }
    if (!started.ok) { this.fail(attempt, started); return; }
    const expiresAt = Date.parse(started.data.expiresAt);
    if (expiresAt <= this.port.now()) { this.fail(attempt, { ok: false, kind: 'invalid-response' }); return; }
    attempt.expiresAt = Math.min(attempt.expiresAt, expiresAt);
    if (this.closed(attempt)) { this.cancel(); return; }
    try { popup.location.replace(started.data.authorizationUrl); }
    catch { this.fail(attempt, { ok: false, kind: 'network' }); return; }
    attempt.ready = true; this.set({ kind: 'awaiting-provider', provider, purpose });
    if (this.current(attempt)) this.schedule(attempt);
  }
  private async check(attempt: Attempt, source: 'hint' | 'focus' | 'manual'): Promise<void> {
    if (!this.current(attempt) || !attempt.ready) return;
    if (attempt.recoveryOnly && source !== 'manual') return;
    if (attempt.checking || this.port.now() < attempt.nextCheckAt) {
      if (source === 'hint') attempt.hintPending = true;
      return;
    }
    if (attempt.checks >= 12 || this.port.now() >= attempt.expiresAt) { this.cleanup(false); this.set({ kind: 'unconfirmed' }); return; }
    attempt.checking = true; attempt.checks++; attempt.nextCheckAt = this.port.now() + 2000;
    if (source === 'hint') attempt.hintPending = false;
    this.set({ kind: 'checking-session', provider: attempt.provider, purpose: attempt.purpose });
    if (!this.current(attempt)) return;
    const result = await this.api.getSession();
    if (this.attempt !== attempt || this.disposed) return;
    attempt.checking = false;
    if (!result.ok) {
      if (result.kind === 'stale' || !this.api.isCurrent(attempt.generation)) { this.finishStale(attempt); return; }
      if (result.retryAfterSeconds) attempt.nextCheckAt = this.port.now() + result.retryAfterSeconds * 1000;
      // Keep the existing attempt for an explicit bounded session recheck. No auth restart.
      this.set({ kind: 'failed', error: result }); return;
    }
    if (!this.api.isCurrent(result.generation)) { this.finishStale(attempt); return; }
    attempt.generation = result.generation;
    // A focus return with the initiating cookie still present is no completion proof.
    if (source === 'focus' && result.data.csrfToken === attempt.initialCsrf) {
      this.set({ kind: 'awaiting-provider', provider: attempt.provider, purpose: attempt.purpose }); return;
    }
    this.cleanup(false);
    this.set({ kind: 'session-observed', session: result.data, source });
  }
  private schedule(attempt: Attempt): void {
    attempt.timer = this.port.setTimeout(() => {
      attempt.timer = null;
      if (!this.current(attempt)) { this.finishStale(attempt); return; }
      if (++attempt.ticks >= 600 || this.port.now() >= attempt.expiresAt) { this.cleanup(false); this.set({ kind: 'unconfirmed' }); return; }
      // A valid hint can race an older focus read. Coalesce it into one later GET;
      // retain Retry-After and the same twelve-check/ten-minute limits.
      if (attempt.hintPending && !attempt.checking && this.port.now() >= attempt.nextCheckAt) void this.check(attempt, 'hint');
      if (!this.current(attempt)) return;
      // COOP can sever the reference while OAuth continues. Stop closure polling,
      // retain only explicit GET recovery with the original expiry/check budget,
      // and never infer success or cancellation from this browser observation.
      if (!attempt.checking && !attempt.hintPending && this.closed(attempt)) {
        attempt.recoveryOnly = true; this.set({ kind: 'unconfirmed' }); return;
      }
      if (this.current(attempt)) this.schedule(attempt);
    }, 1000);
  }
  private current(attempt: Attempt): boolean { return !this.disposed && this.attempt === attempt && this.api.isCurrent(attempt.generation); }
  private closed(attempt: Attempt): boolean { try { return attempt.window.closed; } catch { return true; } }
  private fail(attempt: Attempt, error: ApiFailure): void {
    if (this.attempt !== attempt) return;
    this.cleanup(true); this.set(error.kind === 'stale' ? { kind: 'idle' } : { kind: 'failed', error });
  }
  private finishStale(attempt: Attempt): void { if (this.attempt === attempt) { this.cleanup(true); this.set({ kind: 'idle' }); } }
  private cleanup(close: boolean): void {
    const attempt = this.attempt; this.attempt = null;
    if (!attempt) return;
    if (attempt.timer !== null) this.port.clearTimeout(attempt.timer);
    if (close) { try { attempt.window.close(); } catch { /* Severed browser handle: no success claim. */ } }
  }
  private set(state: AccountState): void { this.view = Object.freeze(state); this.listeners.forEach(listener => listener(this.view)); }
}

/** Actual browser adapter. Security headers are not relaxed; severed handles remain unconfirmed. */
export function browserAccountWindowPort(window: Window): AccountWindowPort {
  return {
    open: kind => window.open('about:blank', '_blank', kind === 'popup' ? 'popup,width=520,height=720' : undefined),
    onMessage: listener => {
      const receive = (event: MessageEvent<unknown>) => listener(event);
      window.addEventListener('message', receive); return () => window.removeEventListener('message', receive);
    },
    onFocus: listener => { window.addEventListener('focus', listener); return () => window.removeEventListener('focus', listener); },
    setTimeout: (callback, delay) => window.setTimeout(callback, delay), clearTimeout: id => window.clearTimeout(id), now: () => Date.now(),
  };
}
