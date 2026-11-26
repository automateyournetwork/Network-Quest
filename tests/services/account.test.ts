// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Synthetic window/fetch ports; these do not certify a real provider or browser policy.
import { describe, expect, it, vi } from 'vitest';
import { GameApi } from '../../src/services/game-api';
import { AccountService, type AuthWindow, type AccountWindowPort } from '../../src/services/account';

const origin = 'https://game.example';
const csrf = 'c'.repeat(43);
const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const guest = { state: 'guest', csrfToken: csrf };
function setup(blocked = false) {
  const events: string[] = [];
  const popup: AuthWindow = { closed: false, location: { replace: vi.fn(() => { events.push('navigate'); }) }, close: vi.fn() };
  let onMessage: (event: { origin: string; source: unknown; data: unknown }) => void = () => {};
  let onFocus: () => void = () => {};
  const timers = new Map<number, () => void>(); let serial = 0, now = Date.parse('2026-11-26T12:00:00Z');
  const removeMessage = vi.fn(), removeFocus = vi.fn();
  const port: AccountWindowPort = {
    open: vi.fn(() => { events.push('open'); return blocked ? null : popup; }),
    onMessage: fn => { onMessage = fn; return () => { onMessage = () => {}; removeMessage(); }; },
    onFocus: fn => { onFocus = fn; return () => { onFocus = () => {}; removeFocus(); }; },
    setTimeout: fn => { timers.set(++serial, fn); return serial; },
    clearTimeout: id => { timers.delete(id); },
    now: () => now,
  };
  const fetch = vi.fn<typeof globalThis.fetch>(async url => {
    events.push('fetch');
    return String(url).endsWith('/session') ? json(guest) : json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic', expiresAt: '2026-11-26T12:10:00Z' });
  });
  const api = new GameApi({ origin, apiBase: '/api/v1', fetch });
  const service = new AccountService(api, port);
  return { api, service, port, popup, fetch, events, timers, removeMessage, removeFocus,
    tick: (ms = 1000) => { now += ms; const callbacks = [...timers.values()]; timers.clear(); callbacks.forEach(fn => fn()); },
    message: (data: unknown, source: unknown = popup, eventOrigin = origin) => onMessage({ origin: eventOrigin, source, data }), focus: () => onFocus() };
}
const hint = { type: 'network-quest-auth-complete' };
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const authenticated = () => ({ state: 'authenticated', csrfToken: 'd'.repeat(43), provider: 'google', displayName: 'Synthetic player', expiresAt: '2026-11-27T12:00:00Z', preferences: {
  revision: 1, etag: '"prefs-1"', values: { autosaveEnabled: false, musicVolume: 0.5, effectsVolume: 1, voiceVolume: 0, captions: true, reducedMotion: 'system', textScale: 1 },
}, saveSummary: null });

describe('AccountService retained gameplay document (synthetic)', () => {
  it('reserves the provider window synchronously before bootstrap/start network awaits', async () => {
    const r = setup();
    const pending = r.service.beginSignIn('google');
    expect(r.events[0]).toBe('open');
    await pending;
    expect(r.popup.location.replace).toHaveBeenCalledWith('https://accounts.google.com/o/oauth2/v2/auth?state=synthetic');
    expect(r.service.state.kind).toBe('awaiting-provider');
    r.service.dispose(); expect(r.timers.size).toBe(0);
  });

  it('offers an explicit separate-tab fallback on blocking without issuing auth start', async () => {
    const r = setup(true);
    await r.service.beginSignIn('google');
    expect(r.service.state.kind).toBe('popup-blocked');
    expect(r.fetch).not.toHaveBeenCalled();
    await r.service.openSignInTab();
    expect(r.port.open).toHaveBeenLastCalledWith('tab');
    expect(r.fetch).not.toHaveBeenCalled();
    r.service.dispose();
  });

  it('checks exact origin/source and treats even a valid hint only as GET session wake-up', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    const calls = r.fetch.mock.calls.length;
    r.message(hint, {}, origin); r.message(hint, r.popup, 'https://other.example');
    r.message({ ...hint, account: 'forged' }); r.message({ state: 'authenticated' });
    await flush(); expect(r.fetch).toHaveBeenCalledTimes(calls);
    r.message(hint); await flush();
    expect(r.fetch.mock.calls.at(-1)![0]).toBe(origin + '/api/v1/session');
    expect(r.service.state).toMatchObject({ kind: 'session-observed', session: { state: 'guest' }, source: 'hint' });
    expect(r.api.session?.state).toBe('guest');
    r.service.dispose();
  });

  it('completes blocked fallback using a newly user-opened tab while preserving the original document', async () => {
    const r = setup(true); await r.service.beginSignIn('google');
    vi.mocked(r.port.open).mockReturnValue(r.popup);
    await r.service.openSignInTab();
    expect(r.port.open).toHaveBeenLastCalledWith('tab');
    expect(r.service.state.kind).toBe('awaiting-provider');
    expect(r.fetch.mock.calls.map(([url]) => String(url))).toEqual([origin + '/api/v1/session', origin + '/api/v1/auth/google/start']);
    r.service.dispose();
  });

  it('accepts identity only after the current GET session response', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    const response = deferred<Response>(); r.fetch.mockImplementationOnce(() => response.promise);
    r.message(hint); expect(r.service.state.kind).toBe('checking-session'); expect(r.api.session?.state).toBe('guest');
    response.resolve(json(authenticated())); await flush();
    expect(r.service.state).toMatchObject({ kind: 'session-observed', source: 'hint', session: { state: 'authenticated', provider: 'google' } });
    expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('does not report a preexisting signed-in session on focus as a new provider completion', async () => {
    const r = setup(); r.fetch.mockResolvedValueOnce(json(authenticated()));
    await r.service.beginSignIn('google', 'delete-reauth');
    r.fetch.mockResolvedValueOnce(json(authenticated())); r.focus(); await flush();
    expect(r.service.state.kind).toBe('awaiting-provider');
    expect(r.fetch.mock.calls.some(([, init]) => init?.method === 'DELETE')).toBe(false);
    r.service.dispose();
  });

  it('keeps a valid hint that arrives during an older focus check, then rechecks with bounded delay', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    const response = deferred<Response>(); r.fetch.mockImplementationOnce(() => response.promise).mockResolvedValueOnce(json(authenticated()));
    r.focus(); r.message(hint); response.resolve(json(guest)); await flush();
    expect(r.service.state.kind).toBe('awaiting-provider');
    r.tick(2000); await flush();
    expect(r.service.state).toMatchObject({ kind: 'session-observed', source: 'hint', session: { state: 'authenticated' } });
    expect(r.fetch).toHaveBeenCalledTimes(4); expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('marks an observed closed provider handle unconfirmed without writes or guest replacement', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    Object.defineProperty(r.popup, 'closed', { value: true }); r.tick();
    expect(r.service.state.kind).toBe('unconfirmed'); expect(r.api.session).toEqual(guest);
    expect(r.timers.size).toBe(0); expect(r.fetch).toHaveBeenCalledTimes(2); r.service.dispose();
  });

  it('does not navigate a popup after cancellation during bootstrap', async () => {
    const r = setup(), response = deferred<Response>(); r.fetch.mockImplementationOnce(() => response.promise);
    const begin = r.service.beginSignIn('google'); r.service.cancel(); response.resolve(json(authenticated())); await begin;
    expect(r.service.state.kind).toBe('cancelled'); expect(r.popup.location.replace).not.toHaveBeenCalled();
    expect(r.popup.close).toHaveBeenCalledTimes(1); expect(r.api.session).toBe(null); expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('discards a pending auth start after a newer view or account invalidation', async () => {
    const r = setup(), response = deferred<Response>();
    r.fetch.mockResolvedValueOnce(json(guest)).mockImplementationOnce(() => response.promise);
    const begin = r.service.beginSignIn('google'); await flush();
    r.service.invalidateView();
    response.resolve(json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=old', expiresAt: '2026-11-26T12:10:00Z' })); await begin;
    expect(r.service.state.kind).toBe('idle'); expect(r.popup.location.replace).not.toHaveBeenCalled(); expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('ignores an old window hint after another sign-in intent', async () => {
    const r = setup(); await r.service.beginSignIn('google'); const old = r.popup;
    const next: AuthWindow = { closed: false, close: vi.fn(), location: { replace: vi.fn() } };
    vi.mocked(r.port.open).mockReturnValueOnce(next);
    await r.service.beginSignIn('google'); const before = r.fetch.mock.calls.length;
    r.message(hint, old); await flush(); expect(r.fetch).toHaveBeenCalledTimes(before);
    r.message(hint, next); await flush(); expect(r.fetch).toHaveBeenCalledTimes(before + 1); r.service.dispose();
  });

  it('retains guest session on unavailable auth and closes the unused blank window', async () => {
    const r = setup(); r.fetch.mockResolvedValueOnce(json(guest)).mockRejectedValueOnce(new Error('Synthetic provider failure'));
    await r.service.beginSignIn('google');
    expect(r.service.state).toEqual({ kind: 'failed', error: { ok: false, kind: 'network' } });
    expect(r.api.session).toEqual(guest); expect(r.popup.close).toHaveBeenCalled(); expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('refuses an expired URL or a location that the browser no longer permits navigating', async () => {
    const expired = setup(); expired.fetch.mockResolvedValueOnce(json(guest)).mockResolvedValueOnce(json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth', expiresAt: '2026-11-26T11:59:59Z' }));
    await expired.service.beginSignIn('google'); expect(expired.service.state).toMatchObject({ kind: 'failed', error: { kind: 'invalid-response' } });
    expect(expired.popup.location.replace).not.toHaveBeenCalled(); expired.service.dispose();
    const severed = setup(); vi.mocked(severed.popup.location.replace).mockImplementationOnce(() => { throw new Error('Synthetic COOP separation'); });
    await severed.service.beginSignIn('google'); expect(severed.service.state.kind).toBe('failed'); expect(severed.timers.size).toBe(0); severed.service.dispose();
  });

  it('bounds focus/session checks, never polls identity on each timer, and expires an idle flow', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    for (let i = 0; i < 12; i++) { r.tick(2000); r.focus(); await flush(); }
    expect(r.fetch).toHaveBeenCalledTimes(14);
    r.tick(2000); r.focus(); await flush(); expect(r.service.state.kind).toBe('unconfirmed'); expect(r.fetch).toHaveBeenCalledTimes(14);
    expect(r.timers.size).toBe(0); r.service.dispose();
    const idle = setup(); await idle.service.beginSignIn('google'); idle.tick(600000);
    expect(idle.service.state.kind).toBe('unconfirmed'); expect(idle.fetch).toHaveBeenCalledTimes(2); expect(idle.timers.size).toBe(0); idle.service.dispose();
  });

  it('honors Retry-After on session errors and only performs an explicit read retry', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    r.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: 'unavailable', message: 'Try later.', requestId: '10000000-0000-4000-8000-000000000001' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Retry-After': '9' } }));
    r.message(hint); await flush(); expect(r.service.state.kind).toBe('failed');
    await r.service.checkSession(); expect(r.fetch).toHaveBeenCalledTimes(3);
    r.tick(9000); await r.service.checkSession(); expect(r.fetch).toHaveBeenCalledTimes(4);
    expect(r.fetch.mock.calls.at(-1)![0]).toBe(origin + '/api/v1/session'); r.service.dispose();
  });

  it('disposes listeners/timers and ignores late session responses without touching a later view', async () => {
    const r = setup(); await r.service.beginSignIn('google');
    const response = deferred<Response>(); r.fetch.mockImplementationOnce(() => response.promise); r.message(hint);
    r.service.dispose(); r.service.dispose(); response.resolve(json(authenticated())); await flush();
    r.message(hint); r.focus();
    expect(r.service.state.kind).toBe('disposed'); expect(r.removeMessage).toHaveBeenCalledTimes(1); expect(r.removeFocus).toHaveBeenCalledTimes(1);
    expect(r.timers.size).toBe(0); expect(r.api.session).toEqual(guest);
  });

  it('honors synchronous view cancellation by a state subscriber before issuing subsequent work', async () => {
    const opening = setup(); opening.service.subscribe(state => { if (state.kind === 'opening') opening.service.cancel(); });
    await opening.service.beginSignIn('google'); expect(opening.fetch).not.toHaveBeenCalled(); expect(opening.service.state.kind).toBe('cancelled'); opening.service.dispose();
    const checking = setup(); await checking.service.beginSignIn('google');
    checking.service.subscribe(state => { if (state.kind === 'checking-session') checking.service.cancel(); });
    checking.message(hint); await flush(); expect(checking.fetch).toHaveBeenCalledTimes(2); expect(checking.timers.size).toBe(0); checking.service.dispose();
  });

  it.each(['closed', 'unreadable'])('retains explicit GET session recovery after a %s handle without restarting auth', async mode => {
    const r = setup(); await r.service.beginSignIn('google');
    Object.defineProperty(r.popup, 'closed', { get: () => { if (mode === 'unreadable') throw new Error('Synthetic COOP separation'); return true; } });
    r.tick(); expect(r.service.state.kind).toBe('unconfirmed'); expect(r.timers.size).toBe(0);
    r.focus(); r.message(hint); await flush(); expect(r.fetch).toHaveBeenCalledTimes(2);
    r.fetch.mockResolvedValueOnce(json(authenticated())); await r.service.checkSession();
    expect(r.service.state).toMatchObject({ kind: 'session-observed', source: 'manual', session: { state: 'authenticated' } });
    expect(r.fetch.mock.calls.map(([url]) => String(url))).toEqual([origin + '/api/v1/session', origin + '/api/v1/auth/google/start', origin + '/api/v1/session']);
    expect(r.popup.location.replace).toHaveBeenCalledTimes(1); expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('bounds closed-handle recovery by original expiry and discards a late result after account view change', async () => {
    const expired = setup(); await expired.service.beginSignIn('google');
    Object.defineProperty(expired.popup, 'closed', { value: true }); expired.tick(); expired.tick(600000);
    await expired.service.checkSession(); expect(expired.fetch).toHaveBeenCalledTimes(2); expect(expired.service.state.kind).toBe('unconfirmed'); expired.service.dispose();
    const r = setup(); await r.service.beginSignIn('google');
    Object.defineProperty(r.popup, 'closed', { value: true }); r.tick();
    const response = deferred<Response>(); r.fetch.mockImplementationOnce(() => response.promise);
    const recovery = r.service.checkSession(); r.service.invalidateView(); response.resolve(json(authenticated())); await recovery;
    expect(r.service.state.kind).toBe('idle'); expect(r.api.session).toEqual(guest); expect(r.timers.size).toBe(0); r.service.dispose();
  });

  it('limits unsuccessful manual recovery after a lost handle to the same twelve session checks', async () => {
    const r = setup(); await r.service.beginSignIn('google'); Object.defineProperty(r.popup, 'closed', { value: true }); r.tick();
    r.fetch.mockImplementation(async () => new Response(JSON.stringify({ code: 'unavailable', message: 'Try later.', requestId: '10000000-0000-4000-8000-000000000001' }), { status: 503, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }));
    for (let i = 0; i < 12; i++) { r.tick(2000); await r.service.checkSession(); }
    expect(r.fetch).toHaveBeenCalledTimes(14); r.tick(2000); await r.service.checkSession(); await r.service.checkSession();
    expect(r.fetch).toHaveBeenCalledTimes(14); expect(r.service.state.kind).toBe('unconfirmed'); expect(r.timers.size).toBe(0); r.service.dispose();
  });
});
