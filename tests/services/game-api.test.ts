// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Synthetic fetch/streams only. Expected wire shapes come from game-api.openapi.yaml.
import { describe, expect, it, vi } from 'vitest';
import { GameApi, allowedAuthorizationUrl } from '../../src/services/game-api';

const origin = 'https://game.example';
const apiBase = '/arcade/play/network-quest/api/v1';
const csrf = 'c'.repeat(43);
const uuid = '10000000-0000-4000-8000-000000000001';
const time = '2026-11-26T12:00:00Z';
const values = { autosaveEnabled: false, musicVolume: 0.5, effectsVolume: 1, voiceVolume: 0, captions: true, reducedMotion: 'system', textScale: 1 };
const summary = { revision: 9, etag: '"save-9"', savedAt: time, adventureId: uuid, episodeId: 'spec001', roomId: 'spec001:R02', outcome: null, saveSchemaVersion: 1, contentVersion: '1.0.0' };
const account = () => ({ state: 'authenticated', csrfToken: csrf, provider: 'google', displayName: 'Synthetic player', expiresAt: time, preferences: { revision: 1, etag: '"prefs-1"', values }, saveSummary: summary });
const json = (data: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extra } });
const problem = (code = 'unavailable') => ({ code, message: 'The operation is unavailable.', requestId: uuid });
function rig(responses: Response[]) {
  const fetch = vi.fn<typeof globalThis.fetch>(async () => { const response = responses.shift(); if (!response) throw new Error('Synthetic network loss'); return response; });
  return { api: new GameApi({ origin, apiBase, fetch }), fetch };
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }

describe('GameApi contract transport (synthetic)', () => {
  it('bootstraps only GET session with credentialed no-store exact-origin transport', async () => {
    const { api, fetch } = rig([json({ state: 'guest', csrfToken: csrf })]);
    const result = await api.getSession();
    expect(result).toMatchObject({ ok: true, data: { state: 'guest', csrfToken: csrf } });
    expect(fetch).toHaveBeenCalledWith(origin + apiBase + '/session', expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store', mode: 'same-origin', redirect: 'error', referrerPolicy: 'strict-origin' }));
    expect(new Headers(fetch.mock.calls[0]![1]!.headers).has('Authorization')).toBe(false);
    expect(new Headers(fetch.mock.calls[0]![1]!.headers).has('Origin')).toBe(false);
  });

  it.each(['https://other.example/api/v1', '//other.example/api', '/api/../private', '/api?x=1', '/api#x', '/api%2fv1'])('rejects unsafe base %s', apiBase => {
    expect(() => new GameApi({ origin, apiBase })).toThrow();
  });

  it('uses current session CSRF on ordinary mutations and none for receipt-only status', async () => {
    const { api, fetch } = rig([json(account()), json({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic', expiresAt: time }), json({ state: 'pending', expiresAt: time }, 200, { 'Retry-After': '7' })]);
    await api.getSession();
    await api.startAuth('google', 'login');
    const result = await api.getDeletionStatus('A'.repeat(43));
    expect(new Headers(fetch.mock.calls[1]![1]!.headers).get('X-CSRF-Token')).toBe(csrf);
    const headers = new Headers(fetch.mock.calls[2]![1]!.headers);
    expect(headers.get('X-Deletion-Receipt')).toBe('A'.repeat(43));
    expect(headers.has('X-CSRF-Token')).toBe(false);
    expect(result).toMatchObject({ ok: true, data: { state: 'pending' }, retryAfterSeconds: 7 });
  });

  it('preserves frozen exact body/key/precondition through retries and an older acknowledgement', async () => {
    const ack = { requestId: uuid, committedRevision: 8, committedAt: time, replayed: true, currentSummary: summary };
    const { api, fetch } = rig([json(account()), json(ack, 200, { ETag: summary.etag }), json(ack, 200, { ETag: summary.etag })]);
    await api.getSession();
    const raw = '{ "contentVersion" : "old-unsupported", "note": "é" }\n';
    const bytes = new TextEncoder().encode(raw);
    const prepared = api.prepareSaveWrite({ bodyBytes: bytes, requestId: uuid, mode: 'manual', precondition: { header: 'If-Match', value: '"save-7"' }, confirmAdventureReplacement: true });
    if (!prepared.ok) throw new Error('Expected synthetic preparation');
    bytes.fill(0);
    expect(Object.isFrozen(prepared.request)).toBe(true);
    expect(Object.isFrozen(prepared.request.bodyBytes)).toBe(true);
    expect(await api.putSave(prepared.request)).toMatchObject({ ok: true, data: ack, etag: '"save-9"' });
    expect(await api.putSave(prepared.request)).toMatchObject({ ok: true, data: ack });
    for (const [, init] of fetch.mock.calls.slice(1)) {
      expect(init!.body).toBe(raw);
      expect(new Headers(init!.headers).get('If-Match')).toBe('"save-7"');
      expect(new Headers(init!.headers).get('Idempotency-Key')).toBe(uuid);
      expect(new Headers(init!.headers).get('X-Confirm-Adventure-Replacement')).toBe('true');
    }
  });

  it('discards a save response after a new account intent without exposing its body', async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(account())).mockImplementationOnce(() => pending.promise);
    const api = new GameApi({ origin, apiBase, fetch });
    await api.getSession();
    const request = api.getSave(); api.invalidate();
    pending.resolve(json({ summary, snapshot: {} }, 200, { ETag: summary.etag }));
    expect(await request).toMatchObject({ ok: false, kind: 'stale' });
  });

  it('does not confuse guest status or unknown receipt with deletion confirmation', async () => {
    const { api, fetch } = rig([json({ state: 'guest', csrfToken: csrf }), json(problem('deletion-status-unknown'), 404)]);
    await api.getSession();
    expect(await api.getDeletionStatus('A'.repeat(43))).toMatchObject({ ok: false, kind: 'http', status: 404 });
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([origin + apiBase + '/session', origin + apiBase + '/account/deletion-status']);
  });

  it.each([
    { ...account(), accountId: uuid }, { ...account(), csrfToken: 'short' }, { ...account(), csrfToken: 'c'.repeat(32) + '\r\nInjected: bad' },
    { ...account(), provider: 'unknown' }, { ...account(), displayName: 'x'.repeat(129) }, { ...account(), expiresAt: '2026-02-30T00:00:00Z' },
    { ...account(), preferences: { revision: 2, etag: '"prefs-1"', values } },
    { ...account(), preferences: { revision: 1, etag: '"prefs-1"', values: { ...values, textScale: 0.9 } } },
    { ...account(), preferences: { revision: 1, etag: '"prefs-1"', values: { ...values, musicVolume: '1' } } },
    { ...account(), saveSummary: { ...summary, revision: 8 } }, { ...account(), saveSummary: { ...summary, outcome: 'E03' } },
    { state: 'guest', csrfToken: csrf, provider: 'google' },
  ])('rejects a malformed session projection %# without accepting identity', async value => {
    const { api } = rig([json(value)]);
    expect(await api.getSession()).toMatchObject({ ok: false, kind: 'invalid-response' });
    expect(api.session).toBe(null);
  });

  it.each([
    'https://accounts.google.com.evil.example/o/oauth2/v2/auth', 'https://accounts.google.com@evil.example/o/oauth2/v2/auth',
    'https://name:secret@accounts.google.com/o/oauth2/v2/auth', 'https://accounts.google.com:443/o/oauth2/v2/auth',
    'https://accounts.google.com:8443/o/oauth2/v2/auth', 'http://accounts.google.com/o/oauth2/v2/auth',
    'https://accounts.google.com/o/oauth2/v2/auth#fragment', 'https://accounts.google.com/o/oauth2/v2/auth\\evil',
    'https://accounts.google.com/o/oauth2/v2/other', 'javascript:alert(1)', 'https://github.com/login/oauth/authorize',
  ])('rejects provider destination confusion %#', value => expect(allowedAuthorizationUrl(value, 'google')).toBe(false));

  it('accepts only each provider destination and rejects extra authorization fields', async () => {
    expect(allowedAuthorizationUrl('https://github.com/login/oauth/authorize?scope=&state=synthetic', 'github')).toBe(true);
    const { api } = rig([json({ state: 'guest', csrfToken: csrf }), json({ authorizationUrl: 'https://github.com/login/oauth/authorize', expiresAt: time, token: 'forged' })]);
    await api.getSession(); expect(await api.startAuth('github', 'login')).toMatchObject({ ok: false, kind: 'invalid-response' });
  });

  it('orders concurrent session checks and rotates CSRF without treating displayName as account identity', async () => {
    const first = deferred<Response>(), second = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(account())).mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise)
      .mockResolvedValueOnce(json({ ...account(), csrfToken: 'd'.repeat(43) })).mockResolvedValueOnce(json(problem(), 503));
    const api = new GameApi({ origin, apiBase, fetch });
    await api.getSession(); const original = api.capture();
    const slow = api.getSession(), fast = api.getSession();
    second.resolve(json({ ...account(), preferences: { revision: 2, etag: '"prefs-2"', values: { ...values, autosaveEnabled: true } } }));
    expect(await fast).toMatchObject({ ok: true }); expect(api.capture()).toBe(original);
    first.resolve(json({ state: 'guest', csrfToken: 'e'.repeat(43) }));
    expect(await slow).toMatchObject({ ok: false, kind: 'stale' }); expect(api.session?.state).toBe('authenticated');
    await api.getSession(); expect(api.capture()).toBeGreaterThan(original);
    await api.patchPreferences({ captions: false }, '"prefs-2"');
    expect(new Headers(fetch.mock.calls.at(-1)![1]!.headers).get('X-CSRF-Token')).toBe('d'.repeat(43));
  });

  it('rejects old prepared writes before sending after account/restore invalidation', async () => {
    const { api, fetch } = rig([json(account())]); await api.getSession();
    const result = api.prepareSaveWrite({ bodyBytes: new TextEncoder().encode('{}'), requestId: uuid, mode: 'manual', precondition: { header: 'If-None-Match', value: '*' }, confirmAdventureReplacement: false });
    if (!result.ok) throw new Error('Expected preparation');
    api.invalidate(); expect(await api.putSave(result.request)).toMatchObject({ ok: false, kind: 'stale' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('keeps unsupported future save JSON intact and never performs a write/read migration', async () => {
    const newer = { ...summary, saveSchemaVersion: 99 };
    const raw = `{"summary":${JSON.stringify(newer)},"snapshot":{"futureInteger":900719925474099312345,"unknown":{"field":true}}}`;
    const { api, fetch } = rig([json(account()), new Response(raw, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: summary.etag } })]);
    await api.getSession(); expect(await api.getSave()).toMatchObject({ ok: true, data: { summary: newer }, rawJson: raw });
    expect(fetch.mock.calls.at(-1)![1]!.method).toBe('GET');
  });

  it('rejects inconsistent save headers and acknowledgements including a wrong request id', async () => {
    const badAck = { requestId: '20000000-0000-4000-8000-000000000001', committedRevision: 9, committedAt: time, replayed: false, currentSummary: summary };
    const { api } = rig([json(account()), json({ summary, snapshot: {} }, 200, { ETag: '"save-8"' }), json(badAck, 200, { ETag: summary.etag })]);
    await api.getSession(); expect(await api.getSave()).toMatchObject({ ok: false, kind: 'invalid-response' });
    const input = api.prepareSaveWrite({ bodyBytes: new TextEncoder().encode('{}'), requestId: uuid, mode: 'manual', precondition: { header: 'If-None-Match', value: '*' }, confirmAdventureReplacement: false });
    if (!input.ok) throw new Error('Expected preparation');
    expect(await api.putSave(input.request)).toMatchObject({ ok: false, kind: 'invalid-response' });
  });

  it('returns reviewed conflict metadata distinctly from preferences 412 and never retries', async () => {
    const { api, fetch } = rig([json(account()), json({ ...problem('save-conflict'), currentSummary: summary }, 412), json(problem('preferences-conflict'), 412)]);
    await api.getSession();
    const input = api.prepareSaveWrite({ bodyBytes: new TextEncoder().encode('{}'), requestId: uuid, mode: 'manual', precondition: { header: 'If-None-Match', value: '*' }, confirmAdventureReplacement: false });
    if (!input.ok) throw new Error('Expected preparation');
    expect(await api.putSave(input.request)).toMatchObject({ ok: false, kind: 'http', status: 412, problem: { code: 'save-conflict', currentSummary: summary } });
    expect(await api.patchPreferences({ captions: false }, '"prefs-1"')).toMatchObject({ ok: false, kind: 'http', status: 412 });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('rejects malformed input bounds without serializing or sending it', async () => {
    const { api, fetch } = rig([json(account())]); await api.getSession();
    const input = { bodyBytes: new Uint8Array(262145), requestId: uuid, mode: 'manual' as const, precondition: { header: 'If-None-Match' as const, value: '*' }, confirmAdventureReplacement: false };
    expect(api.prepareSaveWrite(input)).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(api.prepareSaveWrite({ ...input, bodyBytes: new Uint8Array([0xc3, 0x28]) })).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(api.prepareSaveWrite({ ...input, bodyBytes: new Uint8Array(), requestId: 'bad\r\nkey' })).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(await api.patchPreferences({}, '"prefs-1"')).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(await api.patchPreferences({ textScale: 3 }, '"prefs-1"')).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(await api.patchPreferences({ captions: false }, 'W/"prefs-1"')).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(await api.getDeletionStatus('A'.repeat(42) + 'B')).toMatchObject({ ok: false, kind: 'invalid-request' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each([
    new Response('<html>not JSON</html>', { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } }),
    new Response('{', { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }),
    new Response(JSON.stringify(guestForResponse()), { headers: { 'Content-Type': 'application/json' } }),
    json(problem(), 502),
    new Response(new Uint8Array([0xff]), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }),
    new Response('{"state":"guest","csrfToken":"' + 'x'.repeat(32) + '\\ud800"}', { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }),
    new Response('['.repeat(33) + '0' + ']'.repeat(33), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }),
  ])('fails closed on malformed/unknown transport response %#', async response => {
    const { api } = rig([response]); expect(await api.getSession()).toMatchObject({ ok: false, kind: 'invalid-response' });
  });

  it('bounds actual chunked bytes without trusting Content-Length', async () => {
    const cancel = vi.fn();
    const body = new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new Uint8Array(294913)); }, cancel });
    const { api } = rig([new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Content-Length': '1' } })]);
    expect(await api.getSession()).toMatchObject({ ok: false, kind: 'invalid-response' }); expect(cancel).toHaveBeenCalled();
  });

  it('bounds hanging requests, redacts unknown thrown errors and never automatically retries', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn<typeof globalThis.fetch>().mockImplementationOnce(() => new Promise(() => {})).mockRejectedValueOnce(new Error('private credential should not escape'));
      const api = new GameApi({ origin, apiBase, fetch, timeoutMs: 10 });
      const request = api.getSession(); await vi.advanceTimersByTimeAsync(10);
      expect(await request).toMatchObject({ ok: false, kind: 'timeout' });
      expect(await api.getSession()).toEqual({ ok: false, kind: 'network' }); expect(fetch).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('does not publish late receipt results to a newer account view', async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>(() => pending.promise);
    const api = new GameApi({ origin, apiBase, fetch });
    const request = api.getDeletionStatus('A'.repeat(43)); api.invalidate();
    pending.resolve(json({ state: 'completed', expiresAt: time }));
    expect(await request).toEqual({ ok: false, kind: 'stale' }); expect(api.session).toBe(null);
  });

  it('confirmed logout makes exactly one revoke call and clears only volatile account context', async () => {
    const { api, fetch } = rig([json(account()), new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })]);
    await api.getSession(); const generation = api.capture();
    expect(await api.logout()).toMatchObject({ ok: true, status: 204, data: null });
    expect(api.session).toBe(null); expect(api.capture()).toBeGreaterThan(generation);
    expect(fetch.mock.calls.map(([url]) => String(url))).toEqual([origin + apiBase + '/session', origin + apiBase + '/logout']);
  });

  it('lost deletion response stays unknown and status works without CSRF after confirmed revocation', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(account())).mockRejectedValueOnce(new Error('Synthetic response loss'))
      .mockResolvedValueOnce(json({ state: 'pending', expiresAt: time })).mockResolvedValueOnce(new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } }))
      .mockResolvedValueOnce(json({ state: 'completed', expiresAt: time }));
    const api = new GameApi({ origin, apiBase, fetch }); await api.getSession();
    expect(await api.deleteAccount('A'.repeat(43))).toMatchObject({ ok: false, kind: 'network' });
    expect(await api.getDeletionStatus('A'.repeat(43))).toMatchObject({ ok: true, data: { state: 'pending' } });
    // A second DELETE here represents a separate explicit caller choice, never service retry.
    expect(await api.deleteAccount('A'.repeat(43))).toMatchObject({ ok: true, status: 204 }); expect(api.session).toBe(null);
    expect(await api.getDeletionStatus('A'.repeat(43))).toMatchObject({ ok: true, data: { state: 'completed' } });
    for (const [, init] of [fetch.mock.calls[2]!, fetch.mock.calls[4]!]) expect(new Headers(init!.headers).has('X-CSRF-Token')).toBe(false);
  });

  it('uses an empty body for bodyless mutations so browser HTTP/1.1 can frame them with length zero', async () => {
    const { api, fetch } = rig([json(account()), json({ state: 'pending', expiresAt: time }), json(problem(), 503), new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })]);
    await api.getSession(); await api.getDeletionStatus('A'.repeat(43)); await api.deleteAccount('A'.repeat(43)); await api.logout();
    expect(fetch.mock.calls[0]![1]!.body).toBeUndefined();
    for (const [, init] of fetch.mock.calls.slice(1)) {
      expect(init!.body).toBe('');
      expect(new Headers(init!.headers).has('Content-Length')).toBe(false);
    }
  });

  it('cancels unconsumed invalid content immediately and bounds a hanging response stream', async () => {
    const cancel = vi.fn();
    const invalid = new Response(new ReadableStream({ cancel }), { headers: { 'Content-Type': 'text/html', 'Cache-Control': 'no-store' } });
    const { api } = rig([invalid]); expect(await api.getSession()).toMatchObject({ ok: false, kind: 'invalid-response' });
    expect(cancel).toHaveBeenCalledTimes(1);
    vi.useFakeTimers();
    try {
      const stop = vi.fn();
      const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(new Response(new ReadableStream({ cancel: stop }), { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }));
      const client = new GameApi({ origin, apiBase, fetch, timeoutMs: 20 });
      const request = client.getSession(); await vi.advanceTimersByTimeAsync(20);
      expect(await request).toMatchObject({ ok: false, kind: 'timeout' }); expect(stop).toHaveBeenCalledTimes(1);
      expect(vi.getTimerCount()).toBe(0);
    } finally { vi.useRealTimers(); }
  });

  it('maps created-slot and updated-preference successes without modifying session metadata implicitly', async () => {
    const first = { ...summary, revision: 1, etag: '"save-1"' };
    const { api, fetch } = rig([json(account()), json({ requestId: uuid, committedRevision: 1, committedAt: time, replayed: false, currentSummary: first }, 201, { ETag: first.etag }), json({ revision: 2, etag: '"prefs-2"', values: { ...values, captions: false } }, 200, { ETag: '"prefs-2"' })]);
    await api.getSession();
    const input = api.prepareSaveWrite({ bodyBytes: new TextEncoder().encode('{}'), requestId: uuid, mode: 'manual', precondition: { header: 'If-None-Match', value: '*' }, confirmAdventureReplacement: false });
    if (!input.ok) throw new Error('Expected preparation');
    expect(await api.putSave(input.request)).toMatchObject({ ok: true, status: 201, etag: '"save-1"' });
    expect(new Headers(fetch.mock.calls[1]![1]!.headers).has('If-Match')).toBe(false);
    expect(new Headers(fetch.mock.calls[1]![1]!.headers).get('If-None-Match')).toBe('*');
    expect(await api.patchPreferences({ captions: false }, '"prefs-1"')).toMatchObject({ ok: true, etag: '"prefs-2"', data: { revision: 2, values: { captions: false } } });
    expect(api.session).toEqual(account());
  });

  it('disposal aborts pending work and never sends another request', async () => {
    const fetch = vi.fn<typeof globalThis.fetch>(() => new Promise(() => {}));
    const api = new GameApi({ origin, apiBase, fetch }); const request = api.getSession(); api.dispose();
    expect(await request).toMatchObject({ ok: false, kind: 'stale' });
    expect(await api.getSession()).toMatchObject({ ok: false, kind: 'disposed' });
    expect(await api.getDeletionStatus('A'.repeat(43))).toMatchObject({ ok: false, kind: 'disposed' });
    expect(fetch).toHaveBeenCalledTimes(1); expect(api.session).toBe(null);
  });

  it('forgets only the owned session locally, aborts old work and permits a later bootstrap', async () => {
    const pending = deferred<Response>();
    const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValueOnce(json(account()))
      .mockImplementationOnce(() => pending.promise).mockResolvedValueOnce(json(guestForResponse()));
    const api = new GameApi({ origin, apiBase, fetch });
    await api.getSession(); const owned = api.capture(); const read = api.getSave();
    const next = api.forgetSession(owned);
    expect(next).not.toBe(null); expect(api.isCurrent(next!)).toBe(true);
    expect(api.isCurrent(owned)).toBe(false); expect(api.session).toBe(null);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[1]![1]!.signal!.aborted).toBe(true);
    pending.resolve(json({ summary, snapshot: {} }, 200, { ETag: summary.etag }));
    expect(await read).toMatchObject({ ok: false, kind: 'stale' });
    expect(await api.getSession()).toMatchObject({ ok: true, data: { state: 'guest' } });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refuses stale or disposed local forgetting without affecting a later account or sending requests', async () => {
    const later = { ...account(), csrfToken: 'd'.repeat(43), displayName: 'Later synthetic player' };
    const { api, fetch } = rig([json(account()), json(later)]);
    await api.getSession(); const old = api.capture(); await api.getSession();
    const current = api.capture();
    expect(api.forgetSession(old)).toBe(null); expect(api.session).toEqual(later);
    expect(api.capture()).toBe(current); expect(fetch).toHaveBeenCalledTimes(2);
    api.dispose(); const disposed = api.capture();
    expect(api.forgetSession(disposed)).toBe(null); expect(api.capture()).toBe(disposed);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8].flatMap(delay => (['logout', 'delete'] as const).map(operation => ({ delay, operation }))))('does not apply $operation across an account invalidation at microtask boundary $delay', async ({ delay, operation }) => {
    const { api } = rig([json(account()), new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } })]);
    await api.getSession(); const pending = operation === 'logout' ? api.logout() : api.deleteAccount('A'.repeat(43));
    for (let n = 0; n < delay; n++) await Promise.resolve();
    const pendingWhenViewChanged = api.session !== null; api.invalidate();
    const result = await pending;
    if (pendingWhenViewChanged) { expect(result).toMatchObject({ ok: false, kind: 'stale' }); expect(api.session).toEqual(account()); }
  });

  it('exposes a lossless snapshot-only lexical slice including nested strings, whitespace and future numbers', async () => {
    const newer = { ...summary, saveSchemaVersion: 99 };
    const snapshotJson = '{ \n "futureInteger":900719925474099312345, "nested":[{"quoted":"} , \\\"quoted\\\"", "empty":{}}] }';
    const raw = `{ "summary": ${JSON.stringify(newer)}, "snap\\u0073hot": \n${snapshotJson} \n }`;
    const { api } = rig([json(account()), new Response(raw, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: newer.etag } })]);
    await api.getSession(); expect(await api.getSave()).toMatchObject({ ok: true, snapshotJson, rawJson: raw });
  });

  it.each([
    `"snapshot":{},"snapshot":{"secret":"unexpected"}`,
    `"snapshot":{},"snap\\u0073hot":{}`,
    `"snapshot":{},"summ\\u0061ry":${JSON.stringify(summary)}`,
  ])('rejects duplicate save envelope members including decoded aliases %#', async duplicate => {
    const raw = `{"summary":${JSON.stringify(summary)},${duplicate}}`;
    const { api } = rig([json(account()), new Response(raw, { headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: summary.etag } })]);
    await api.getSession(); expect(await api.getSave()).toMatchObject({ ok: false, kind: 'invalid-response' });
  });

  it.each([{}, { ETag: '"prefs-1"' }])('requires preferences HTTP ETag to agree with its revisioned body %#', async headers => {
    const { api } = rig([json(account()), json({ revision: 2, etag: '"prefs-2"', values }, 200, headers)]);
    await api.getSession(); expect(await api.patchPreferences({ captions: true }, '"prefs-1"')).toMatchObject({ ok: false, kind: 'invalid-response' });
  });
});

function guestForResponse() { return { state: 'guest', csrfToken: csrf }; }
