// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual GameApi/AccountService with synthetic transport/windows; not real provider/browser evidence.
import { describe, expect, it, vi } from 'vitest';
import { createAccountSettingsController, type AccountSettingsLifecycle } from '../../src/ui/account-settings';
import { GameApi, type Session } from '../../src/services/game-api';
import { AccountService, type AccountWindowPort, type AuthWindow, type AccountMessage } from '../../src/services/account';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { createReducerState } from '../../src/state/reducer';
import type { RuntimeState } from '../../src/state/types';

const origin = 'https://game.example', nowStart = Date.parse('2026-11-26T12:00:00Z');
const json = (data: unknown, status = 200, retry?: number) => new Response(JSON.stringify(data), { status, headers: {
  'Cache-Control': 'no-store', 'Content-Type': 'application/json', ...(retry ? { 'Retry-After': String(retry) } : {}),
} });
const noContent = () => new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
const problem = (status: number, retry?: number) => json({ code: 'synthetic-response', message: 'Synthetic error', requestId: '10000000-0000-4000-8000-000000000001' }, status, retry);
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
async function flush() { for (let i = 0; i < 30; i++) await Promise.resolve(); }
async function fixture() {
  const { registry } = loadIntroductionContent(), initial = startIntroduction(createIntroductionRuntime(), registry);
  let state = createReducerState({ ...initial, auth: { status: 'authenticated', provider: 'google', displayName: '<Test player>',
    csrfToken: 'c'.repeat(43), clientGeneration: 7, expiresAt: '2026-11-27T12:00:00Z' } } as RuntimeState);
  let serverSession: Session = { state: 'authenticated', provider: 'google', displayName: '<Test player>', csrfToken: 'c'.repeat(43), expiresAt: '2026-11-27T12:00:00Z',
    saveSummary: null, preferences: { revision: 1, etag: '"prefs-1"', values: { ...initial.ui!.presentation, autosaveEnabled: false } } };
  let logout = async () => noContent(), deletion = async () => noContent(), status = async () => json({ state: 'pending', expiresAt: '2026-11-27T12:00:00Z' });
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = String(url); if (path.endsWith('/session')) return json(serverSession);
    if (path.endsWith('/logout')) return logout();
    if (path.endsWith('/account/deletion-status')) return status();
    if (path.endsWith('/account') && init?.method === 'DELETE') return deletion();
    if (path.endsWith('/auth/google/start')) return json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic', expiresAt: '2026-11-26T12:10:00Z' });
    throw new Error('Unexpected request');
  });
  const api = new GameApi({ origin, apiBase: '/api/v1', fetch: fetcher as typeof fetch }); await api.getSession(); fetcher.mockClear();
  let time = nowStart, serial = 0, message: (event: AccountMessage) => void = () => {}, focus: () => void = () => {};
  const timers = new Map<number, { at: number; fn: () => void }>();
  const popup: AuthWindow = { closed: false, location: { replace: vi.fn() }, close: vi.fn() };
  const port: AccountWindowPort = { now: () => time, setTimeout: (fn, delay) => { timers.set(++serial, { at: time + delay, fn }); return serial; },
    clearTimeout: id => { timers.delete(id); }, open: vi.fn(() => popup), onMessage: fn => { message = fn; return () => { message = () => {}; }; },
    onFocus: fn => { focus = fn; return () => { focus = () => {}; }; } };
  const account = new AccountService(api, port); let epoch = {}, changed = () => {};
  const lifecycle: AccountSettingsLifecycle = {
    capture: () => epoch, isCurrent: view => view === epoch,
    stopCompetingWork: vi.fn(view => { if (view !== epoch) return null; epoch = {}; return epoch; }),
    adoptDeletionSession: vi.fn((view, session, generation) => {
      if (view !== epoch || api.session !== session || !api.isCurrent(generation) || session.state !== 'authenticated') return null;
      state = createReducerState({ ...state.runtime, auth: { ...state.runtime.auth, status: 'authenticated', provider: session.provider,
        displayName: session.displayName, csrfToken: session.csrfToken, expiresAt: session.expiresAt, clientGeneration: Number(state.runtime.auth.clientGeneration) + 1 } } as RuntimeState);
      epoch = {}; return { runtime: epoch, generation: api.capture() };
    }),
    clearToTitle: vi.fn((view, generation) => {
      if (view !== epoch || !api.isCurrent(generation) || api.forgetSession(generation) === null) return false;
      state = createReducerState(createIntroductionRuntime()); epoch = {}; return true;
    }),
  };
  const controller = createAccountSettingsController({ api, account, lifecycle, getState: () => state, changed: () => changed(), clock: port });
  const advance = async (ms: number) => { time += ms; const due = [...timers].filter(([, timer]) => timer.at <= time); for (const [id, timer] of due) { timers.delete(id); timer.fn(); } await flush(); };
  const reauth = async (rotate = true) => {
    await controller.act('open'); await controller.act('delete'); await controller.act('confirm-delete');
    if (rotate && serverSession.state === 'authenticated') serverSession = { ...serverSession, csrfToken: 'd'.repeat(43) };
    message({ origin, source: popup, data: { type: 'network-quest-auth-complete' } }); await flush();
  };
  return { api, account, controller, lifecycle, fetcher, port, popup, timers, advance, reauth,
    get state() { return state; }, get session() { return serverSession; }, set session(value: Session) { serverSession = value; },
    set logout(value: () => Promise<Response>) { logout = value; }, set deletion(value: () => Promise<Response>) { deletion = value; }, set status(value: () => Promise<Response>) { status = value; },
    onChanged(fn: () => void) { changed = fn; }, replaceView() { epoch = {}; api.invalidate(); controller.invalidateView(); }, focus: () => focus(),
    hint: () => message({ origin, source: popup, data: { type: 'network-quest-auth-complete' } }),
    dispose() { controller.dispose(); account.dispose(); api.dispose(); },
  };
}

describe('T052 account settings operation ownership', () => {
  it('discloses actual identity, one-slot data and unverified backup policy without invented expiry', async () => {
    const f = await fixture(); await f.controller.act('open'); const view = f.controller.project();
    expect(view.identity).toBe('<Test player> (Google)'); expect(view.policy.join(' ')).toMatch(/one.*save/i);
    expect(view.policy.join(' ')).toMatch(/not.*verified/i); expect(view.policy.join(' ')).not.toMatch(/seven|30 days|7 days/);
    expect(f.fetcher).not.toHaveBeenCalled(); f.dispose();
  });
  it('canceling the logout warning changes no runtime, API generation, outstanding work or requests', async () => {
    const f = await fixture(), before = f.state, gen = f.api.capture(), session = f.api.session;
    await f.controller.act('open'); await f.controller.act('logout'); await f.controller.act('cancel');
    expect(f.state).toBe(before); expect(f.api.capture()).toBe(gen); expect(f.api.session).toBe(session);
    expect(f.lifecycle.stopCompetingWork).not.toHaveBeenCalled(); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); expect(f.fetcher).not.toHaveBeenCalled(); f.dispose();
  });
  it('confirmed logout stops competing work and clears only after current 204, without save/delete', async () => {
    const f = await fixture(), before = f.state, reply = deferred<Response>(); f.logout = () => reply.promise;
    await f.controller.act('open'); await f.controller.act('logout'); const work = f.controller.act('confirm-logout');
    expect(f.lifecycle.stopCompetingWork).toHaveBeenCalledTimes(1); expect(f.state).toBe(before); reply.resolve(noContent()); await work;
    expect(f.state.runtime.game).toBeNull(); expect(f.state.runtime.checkpoint).toBeNull(); expect(f.state.runtime.ui).toBeNull();
    expect(f.lifecycle.clearToTitle).toHaveBeenCalledTimes(1); expect(f.fetcher.mock.calls.map(([url]) => String(url))).toEqual([origin + '/api/v1/logout']); f.dispose();
  });
  it('lost logout stays unconfirmed and preserves adventure; an explicit current guest GET can confirm revocation', async () => {
    const f = await fixture(), before = f.state; f.logout = async () => { throw new Error('lost'); };
    await f.controller.act('open'); await f.controller.act('logout'); await f.controller.act('confirm-logout');
    expect(f.controller.project().phase).toBe('logout-unconfirmed'); expect(f.state).toBe(before); expect(f.fetcher).toHaveBeenCalledTimes(1);
    f.session = { state: 'guest', csrfToken: 'e'.repeat(43) }; await f.controller.act('check-logout');
    expect(f.state.runtime.game).toBeNull(); expect(f.fetcher).toHaveBeenCalledTimes(2); f.dispose();
  });
  it('ignores stale logout completion after a later account/view', async () => {
    const f = await fixture(), reply = deferred<Response>(); f.logout = () => reply.promise;
    await f.controller.act('logout'); const work = f.controller.act('confirm-logout'); f.replaceView(); const before = f.state;
    reply.resolve(noContent()); await work; expect(f.state).toBe(before); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('opens delete-purpose auth only on confirmation; a hint only reads session and requires a second explicit deletion choice', async () => {
    const f = await fixture(), before = f.state; await f.controller.act('delete'); expect(f.fetcher).not.toHaveBeenCalled(); await f.controller.act('cancel'); expect(f.state).toBe(before);
    await f.reauth(); expect(f.controller.project().phase).toBe('delete-ready'); expect(f.lifecycle.adoptDeletionSession).toHaveBeenCalledTimes(1);
    expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
    const start = f.fetcher.mock.calls.find(([url]) => String(url).endsWith('/start'))!; expect(start[1]?.body).toBe('{"purpose":"delete-reauth"}');
    await f.controller.act('send-delete'); expect(f.state.runtime.game).toBeNull(); expect(f.lifecycle.clearToTitle).toHaveBeenCalledTimes(1); f.dispose();
  });
  it('does not claim a session observation proves fresh authentication; server rejection preserves adventure', async () => {
    const f = await fixture(); await f.reauth(false); const before = f.state; f.deletion = async () => problem(403);
    await f.controller.act('send-delete'); expect(f.controller.project().message).not.toMatch(/deleted successfully|deletion complete/i);
    expect(f.state).toBe(before); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('uses one private canonical random 256-bit receipt on deletion/status and never auto-repeats DELETE/auth', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); };
    await f.controller.act('send-delete'); const before = f.state;
    expect(f.controller.project().phase).toBe('delete-unconfirmed'); await f.advance(1000);
    const del = f.fetcher.mock.calls.find(([, init]) => init?.method === 'DELETE')!, token = new Headers(del[1]?.headers).get('X-Deletion-Receipt')!;
    expect(token).toMatch(/^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/); expect(atob(token.replace(/-/g, '+').replace(/_/g, '/'))).toHaveLength(32);
    expect(JSON.stringify(f.controller.project())).not.toContain(token);
    const checks = f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/deletion-status')); expect(checks).toHaveLength(1);
    expect(new Headers(checks[0]![1]?.headers).get('X-Deletion-Receipt')).toBe(token); expect(new Headers(checks[0]![1]?.headers).has('X-CSRF-Token')).toBe(false);
    expect(f.state).toBe(before); f.status = async () => json({ state: 'completed', expiresAt: '2026-11-27T12:00:00Z' }); await f.advance(2000);
    expect(f.state.runtime.game).toBeNull(); expect(f.api.session).toBeNull(); expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1); f.dispose();
  });
  it.each([404, 503])('keeps status %i unconfirmed, never uses guest state as deletion proof', async statusCode => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); }; f.status = async () => problem(statusCode);
    await f.controller.act('send-delete'); const before = f.state; f.session = { state: 'guest', csrfToken: 'e'.repeat(43) };
    await f.advance(1000); expect(f.controller.project().phase).toBe('delete-unconfirmed'); expect(f.state).toBe(before);
    expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/session'))).toHaveLength(2); f.dispose();
  });
  it('bounds status backoff and obeys Retry-After including explicit checks', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); }; f.status = async () => problem(429, 20);
    await f.controller.act('send-delete'); await f.advance(1000); await f.controller.act('check-deletion'); await f.advance(19000);
    const count = () => f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/deletion-status')).length;
    expect(count()).toBe(1); await f.advance(1000); expect(count()).toBe(2);
    for (let i = 0; i < 10; i++) await f.advance(30000);
    expect(count()).toBeLessThanOrEqual(6); expect(f.timers.size).toBe(0); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('drops receipt polling and stale completion after disposal or an explicit later view', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); }; const response = deferred<Response>(); f.status = () => response.promise;
    await f.controller.act('send-delete'); await f.advance(1000); f.replaceView(); const before = f.state;
    response.resolve(json({ state: 'completed', expiresAt: '2026-11-27T12:00:00Z' })); await flush(); await f.advance(30000);
    expect(f.state).toBe(before); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); expect(f.timers.size).toBe(0); f.dispose();
  });
  it('rechecks ownership after synchronous rendering callbacks before sending a confirmed action', async () => {
    const f = await fixture(); await f.controller.act('logout'); f.onChanged(() => { if (f.controller.project().phase === 'logging-out') f.controller.invalidateView(); });
    await f.controller.act('confirm-logout'); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
});

describe('T052 reentrant, credential and bounded recovery edges', () => {
  it.each(['confirm-logout', 'confirm-delete'] as const)('rejects %s when stopping competitors synchronously invalidates the settings view', async action => {
    const f = await fixture(); await f.controller.act(action === 'confirm-logout' ? 'logout' : 'delete');
    const stop = f.lifecycle.stopCompetingWork;
    vi.mocked(f.lifecycle.stopCompetingWork).mockImplementationOnce(view => { const next = vi.mocked(stop).getMockImplementation()!(view); f.controller.invalidateView(); return next; });
    await f.controller.act(action); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.port.open).not.toHaveBeenCalled(); f.dispose();
  });
  it.each(['logout', 'deletion'] as const)('rejects %s success invalidated in the API/controller microtask gap', async action => {
    const f = await fixture();
    if (action === 'deletion') await f.reauth(); else await f.controller.act('logout');
    const before = f.state;
    if (action === 'logout') {
      const run = f.api.logout.bind(f.api); vi.spyOn(f.api, 'logout').mockImplementation(async () => { const result = await run(); f.replaceView(); return result; });
    } else {
      const run = f.api.deleteAccount.bind(f.api); vi.spyOn(f.api, 'deleteAccount').mockImplementation(async token => { const result = await run(token); f.replaceView(); return result; });
    }
    await f.controller.act(action === 'logout' ? 'confirm-logout' : 'send-delete');
    expect(f.state).toBe(before); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('requires still-current explicit logout confirmation and never treats equal provider labels as account continuity', async () => {
    const f = await fixture(); await f.controller.act('logout');
    f.session = { ...f.session, csrfToken: 'z'.repeat(43) }; await f.api.getSession(); f.fetcher.mockClear(); const before = f.state;
    await f.controller.act('confirm-logout'); expect(f.fetcher).not.toHaveBeenCalled(); expect(f.state).toBe(before); expect(f.lifecycle.stopCompetingWork).not.toHaveBeenCalled(); f.dispose();
  });
  it('keeps a later signed-in session and in-memory adventure when checking lost logout', async () => {
    const f = await fixture(); f.logout = async () => { throw new Error('lost'); };
    await f.controller.act('logout'); await f.controller.act('confirm-logout'); const before = f.state;
    f.session = { ...f.session, csrfToken: 'z'.repeat(43) }; await f.controller.act('check-logout');
    expect(f.state).toBe(before); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); expect(f.controller.project().message).toContain('not confirmed');
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/logout'))).toHaveLength(1); f.dispose();
  });
  it('reserves a deletion popup synchronously and permits only explicit blocked-tab fallback', async () => {
    const f = await fixture(); vi.mocked(f.port.open).mockReturnValueOnce(null);
    await f.controller.act('delete'); const work = f.controller.act('confirm-delete'); expect(f.port.open).toHaveBeenCalledTimes(1); await work;
    expect(f.controller.project().phase).toBe('popup-blocked'); expect(f.fetcher).not.toHaveBeenCalled();
    await f.controller.act('open-reauth-tab'); expect(f.port.open).toHaveBeenLastCalledWith('tab');
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/start'))).toHaveLength(1); f.dispose();
  });
  it('never turns a guest deletion-reauth observation into deletion success or a fresh auth loop', async () => {
    const f = await fixture(); await f.controller.act('delete'); await f.controller.act('confirm-delete');
    f.session = { state: 'guest', csrfToken: 'x'.repeat(43) }; f.hint(); await flush();
    expect(f.controller.project().phase).toBe('reauth-unconfirmed'); expect(f.lifecycle.adoptDeletionSession).not.toHaveBeenCalled();
    await f.controller.act('send-delete'); await f.controller.act('check-reauth');
    expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('rejects an observed different provider and preserves the original adventure', async () => {
    const f = await fixture(); await f.controller.act('delete'); await f.controller.act('confirm-delete'); const before = f.state;
    if (f.session.state !== 'authenticated') throw new Error('fixture'); f.session = { ...f.session, provider: 'github', csrfToken: 'x'.repeat(43) };
    f.hint(); await flush(); expect(f.state).toBe(before); expect(f.lifecycle.adoptDeletionSession).not.toHaveBeenCalled(); expect(f.controller.project().phase).toBe('reauth-unconfirmed'); f.dispose();
  });
  it('does not adopt an observed reauth session after the application rejects or invalidates its lifecycle CAS', async () => {
    const f = await fixture(); vi.mocked(f.lifecycle.adoptDeletionSession).mockImplementation(() => { f.controller.invalidateView(); return null; });
    await f.reauth(); expect(f.controller.project().phase).toBe('idle'); await f.controller.act('send-delete');
    expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0); f.dispose();
  });
  it('accepts the exact observed session when the authorized adoption rotates the API lifecycle generation', async () => {
    const f = await fixture(), adopt = vi.mocked(f.lifecycle.adoptDeletionSession).getMockImplementation()!;
    vi.mocked(f.lifecycle.adoptDeletionSession).mockImplementation((view, session, generation) => {
      const next = adopt(view, session, generation); return next ? { runtime: next.runtime, generation: f.api.invalidate() } : null;
    });
    await f.reauth(); expect(f.controller.project().phase).toBe('delete-ready'); await f.controller.act('send-delete');
    expect(f.state.runtime.game).toBeNull(); expect(f.api.session).toBeNull(); f.dispose();
  });
  it('rejects an unrelated API-only rotation after the adoption callback captured its owned generation', async () => {
    const f = await fixture(), adopt = vi.mocked(f.lifecycle.adoptDeletionSession).getMockImplementation()!;
    vi.mocked(f.lifecycle.adoptDeletionSession).mockImplementation((view, session, generation) => {
      const next = adopt(view, session, generation); f.api.invalidate(); return next;
    });
    await f.reauth(); expect(f.controller.project().phase).not.toBe('delete-ready'); await f.controller.act('send-delete');
    expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0); f.dispose();
  });
  it('does not send DELETE after a reentrant cancellation during its pending projection', async () => {
    const f = await fixture(); await f.reauth(); f.onChanged(() => { if (f.controller.project().phase === 'deleting') void f.controller.act('cancel'); });
    await f.controller.act('send-delete'); expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('does not clear after a completed receipt invalidated between the API result and UI continuation', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); };
    f.status = async () => json({ state: 'completed', expiresAt: '2026-11-27T12:00:00Z' });
    const run = f.api.getDeletionStatus.bind(f.api); vi.spyOn(f.api, 'getDeletionStatus').mockImplementation(async token => { const result = await run(token); f.replaceView(); return result; });
    await f.controller.act('send-delete'); const before = f.state; await f.advance(1000);
    expect(f.state).toBe(before); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('stops after exactly six pending status reads without repeating deletion or signin', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); }; await f.controller.act('send-delete');
    for (const ms of [1000, 2000, 4000, 8000, 16000, 30000]) await f.advance(ms);
    await f.controller.act('check-deletion'); await f.advance(30000);
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/deletion-status'))).toHaveLength(6);
    expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(1);
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/start'))).toHaveLength(1);
    expect(f.controller.project().message).toContain('Bounded status checking has stopped'); expect(f.timers.size).toBe(0); f.dispose();
  });
  it('honors a Retry-After longer than its checking window by stopping, never polling early', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => problem(503, 600); await f.controller.act('send-delete');
    await f.controller.act('check-deletion'); await f.advance(600000);
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/deletion-status'))).toHaveLength(0); expect(f.timers.size).toBe(0); f.dispose();
  });
  it('stops an expired pending receipt and treats unknown response data as unconfirmed', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); };
    f.status = async () => json({ state: 'pending', expiresAt: '2026-11-26T11:59:59Z' }); await f.controller.act('send-delete'); await f.advance(1000);
    expect(f.controller.project().phase).toBe('delete-unconfirmed'); expect(f.timers.size).toBe(0); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('forgets volatile receipt and stops pending status on close without reporting rollback', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); }; await f.controller.act('send-delete'); const before = f.state;
    await f.controller.act('close'); await f.advance(60000); await f.controller.act('open'); await f.controller.act('check-deletion');
    expect(f.state).toBe(before); expect(f.controller.project().message).toContain('No uncertain result is confirmed or rolled back');
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/deletion-status'))).toHaveLength(0); f.dispose();
  });
  it('disposal during a pending logout keeps memory and cannot render or clear later', async () => {
    const f = await fixture(), response = deferred<Response>(); f.logout = () => response.promise;
    await f.controller.act('logout'); const work = f.controller.act('confirm-logout'); const before = f.state, changed = vi.fn(); f.onChanged(changed); f.controller.dispose();
    response.resolve(noContent()); await work; await f.controller.act('open');
    expect(f.state).toBe(before); expect(changed).not.toHaveBeenCalled(); expect(f.lifecycle.clearToTitle).not.toHaveBeenCalled(); f.dispose();
  });
  it('refuses deletion when secure entropy is unavailable and never substitutes weak randomness', async () => {
    const f = await fixture(); await f.reauth(); vi.spyOn(crypto, 'getRandomValues').mockImplementationOnce(() => { throw new Error('entropy unavailable'); });
    await f.controller.act('send-delete'); expect(f.fetcher.mock.calls.filter(([, init]) => init?.method === 'DELETE')).toHaveLength(0);
    expect(f.controller.project().message).toContain('secure confirmation receipt'); f.dispose();
  });
});

describe('T052 status subscriber timing', () => {
  it('notifies the panel when an explicit logout check becomes available again without issuing a request', async () => {
    const f = await fixture(); f.logout = async () => { throw new Error('lost'); };
    await f.controller.act('logout'); await f.controller.act('confirm-logout');
    const projected: boolean[] = []; f.onChanged(() => { projected.push(f.controller.project().canCheckLogout); });
    f.fetcher.mockResolvedValueOnce(problem(503, 20)); await f.controller.act('check-logout');
    expect(projected.at(-1)).toBe(false); const requests = f.fetcher.mock.calls.length;
    await f.advance(19999); expect(projected.at(-1)).toBe(false);
    await f.advance(1); expect(projected.at(-1)).toBe(true);
    expect(f.fetcher).toHaveBeenCalledTimes(requests); expect(f.timers.size).toBe(0); f.dispose();
  });

  it.each(['close', 'invalidate', 'dispose', 'api-generation'] as const)('does not notify an old logout recovery view after %s', async boundary => {
    const f = await fixture(); f.logout = async () => { throw new Error('lost'); };
    await f.controller.act('logout'); await f.controller.act('confirm-logout');
    f.fetcher.mockResolvedValueOnce(problem(503)); await f.controller.act('check-logout');
    expect(f.timers.size).toBe(1);
    if (boundary === 'close') await f.controller.act('close');
    else if (boundary === 'invalidate') f.replaceView();
    else if (boundary === 'dispose') f.controller.dispose();
    else f.api.invalidate();
    const changed = vi.fn(); f.onChanged(changed); const requests = f.fetcher.mock.calls.length;
    await f.advance(2000); expect(changed).not.toHaveBeenCalled(); expect(f.fetcher).toHaveBeenCalledTimes(requests); expect(f.timers.size).toBe(0); f.dispose();
  });

  it('limits logout checks to six and does not re-enable or schedule another notification after exhaustion', async () => {
    const f = await fixture(); f.logout = async () => { throw new Error('lost'); };
    await f.controller.act('logout'); await f.controller.act('confirm-logout');
    for (let i = 0; i < 6; i++) {
      f.fetcher.mockResolvedValueOnce(problem(503)); await f.controller.act('check-logout'); await f.advance(2000);
    }
    const changed = vi.fn(); f.onChanged(changed); const requests = f.fetcher.mock.calls.length;
    expect(f.controller.project().canCheckLogout).toBe(false); expect(f.timers.size).toBe(0);
    await f.controller.act('check-logout'); await f.advance(60000);
    expect(f.fetcher).toHaveBeenCalledTimes(requests); expect(changed).not.toHaveBeenCalled();
    expect(f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/session'))).toHaveLength(6); f.dispose();
  });

  it('does not overflow a long Retry-After timer or re-enable the logout control early', async () => {
    const f = await fixture(); f.logout = async () => { throw new Error('lost'); };
    await f.controller.act('logout'); await f.controller.act('confirm-logout');
    const projected: boolean[] = []; f.onChanged(() => { projected.push(f.controller.project().canCheckLogout); });
    f.fetcher.mockResolvedValueOnce(problem(503, 2147484)); await f.controller.act('check-logout');
    const requests = f.fetcher.mock.calls.length;
    await f.advance(2147483647); expect(projected.at(-1)).toBe(false); expect(f.timers.size).toBe(1);
    await f.advance(353); expect(projected.at(-1)).toBe(true); expect(f.fetcher).toHaveBeenCalledTimes(requests); f.dispose();
  });

  it('enforces backoff before notifying a subscriber that tries an immediate status check', async () => {
    const f = await fixture(); await f.reauth(); f.deletion = async () => { throw new Error('lost'); };
    f.onChanged(() => { if (f.controller.project().phase === 'delete-unconfirmed') void f.controller.act('check-deletion'); });
    await f.controller.act('send-delete'); await flush();
    const reads = () => f.fetcher.mock.calls.filter(([url]) => String(url).endsWith('/deletion-status')).length;
    expect(reads()).toBe(0); await f.advance(1000); expect(reads()).toBe(1); await f.advance(1999); expect(reads()).toBe(1);
    await f.advance(1); expect(reads()).toBe(2); f.dispose();
  });
});
