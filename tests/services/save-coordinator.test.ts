// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerState } from '../../src/state/reducer';
import type { ActionId, AdventureId } from '../../src/domain/types';
import type { ClientGeneration, RuntimeState, SaveSummary } from '../../src/state/types';
import { SaveReader } from '../../src/state/save-migrations';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';
import { GameApi } from '../../src/services/game-api';
import { SaveCoordinator } from '../../src/services/save-coordinator';
import policyFile from '../../server/content/save-policy.generated.json' with { type: 'json' };
import serviceCases from '../../server/tests/Fixtures/save-cases.json' with { type: 'json' };
import conformance from '../fixtures/save-conformance.json' with { type: 'json' };

const adventureId = '10000000-0000-4000-8000-000000000001' as AdventureId;
const otherAdventure = '10000000-0000-4000-8000-000000000002' as AdventureId;
const requestId = '70000000-0000-4000-8000-000000000001';
const serverTime = '2026-11-26T12:00:00Z';
const policies = policyFile.policies as SaveContentPolicy[];
const response = (data: unknown, status = 200, etag?: string) => new Response(JSON.stringify(data), { status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(etag ? { ETag: etag } : {}) } });
const problem = (status: number, code: string) => response({ code, message: 'Synthetic service response', requestId }, status);
function summary(revision: number, id = adventureId): SaveSummary {
  return { revision, etag: `"save-${revision}"`, savedAt: serverTime, adventureId: id, episodeId: 'spec001', roomId: 'spec001:R01',
    outcome: null, saveSchemaVersion: 1, contentVersion: '1.0.0' } as SaveSummary;
}
function ack(revision: number, current = summary(revision), replayed = false, key = requestId) {
  return response({ requestId: key, committedRevision: revision, committedAt: serverTime, replayed, currentSummary: current }, 200, current.etag);
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function setup(options: { slot?: number; slotAdventure?: AdventureId; autosave?: boolean; bind?: boolean; policies?: SaveContentPolicy[] } = {}) {
  const { registry } = loadIntroductionContent();
  const initial = startIntroduction(createIntroductionRuntime(), registry);
  let state = createReducerState({ ...initial, game: { ...initial.game!, adventureId },
    auth: { status: 'authenticated', provider: 'google', displayName: 'Same Label', csrfToken: 'c'.repeat(43), expiresAt: '2026-11-27T12:00:00Z', clientGeneration: 4 },
    persistence: { ...initial.persistence, dirtyGeneration: 4 } } as RuntimeState);
  const reduce = createReducer({ registry, bindings: introductionBindings(registry).effects });
  const validator = new SaveValidator(options.policies ?? policies);
  const reader = new SaveReader({ currentContentVersion: '1.0.0', readPolicies: policies, migrations: [] });
  let currentSummary = options.slot ? summary(options.slot, options.slotAdventure) : null;
  let snapshotJson = JSON.stringify({ ...state.runtime.game, adventureId: options.slotAdventure ?? adventureId, saveSchemaVersion: 1, safeState: 'stable-exploration' });
  const session = { state: 'authenticated', csrfToken: 'c'.repeat(43), provider: 'google', displayName: 'Same Label', expiresAt: '2026-11-27T12:00:00Z',
    preferences: { revision: 1, etag: '"prefs-1"', values: { ...initial.ui!.presentation, autosaveEnabled: options.autosave ?? false } }, saveSummary: currentSummary };
  const writes: RequestInit[] = [];
  let reads = 0, sessions = 0, nextKey = 0;
  let write = async (init: RequestInit): Promise<Response> => ack((currentSummary?.revision ?? 0) + 1, undefined, false, new Headers(init.headers).get('Idempotency-Key')!);
  let read = async (): Promise<Response> => currentSummary === null ? problem(404, 'save-not-found')
    : new Response(`{"summary":${JSON.stringify(currentSummary)},"snapshot":${snapshotJson}}`, { headers: {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', ETag: currentSummary.etag } });
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    if (String(url).endsWith('/session')) { sessions++; return response(session); }
    if (init?.method === 'GET') { reads++; return read(); }
    writes.push(init!); return write(init!);
  });
  const api = new GameApi({ origin: 'https://game.example', apiBase: '/api/v1', fetch: fetcher as typeof fetch });
  const observed = await api.getSession();
  if (!observed.ok) throw new Error('Session setup failed');
  const coordinator = new SaveCoordinator({ api, validator, reader, requestId: () => `70000000-0000-4000-8000-${String(++nextKey).padStart(12, '0')}`,
    store: { getState: () => state, compareAndSet: (expected: ReducerState, next: ReducerState) => { if (state !== expected) return false; state = next; return true; } } });
  const bind = () => coordinator.bindSession({ clientGeneration: state.runtime.auth.clientGeneration, apiGeneration: api.capture() });
  if (options.bind !== false) expect(bind()).toBe(true);
  return { api, coordinator, validator, reader, writes, session, bind, get state() { return state; }, get reads() { return reads; }, get sessions() { return sessions; },
    replace(next: ReducerState) { state = next; }, setWrite(next: typeof write) { write = next; }, setRead(next: typeof read) { read = next; },
    setSlot(next: SaveSummary | null, raw = snapshotJson) { currentSummary = next; snapshotJson = raw; },
    edit(text: string) { const out = reduce(state, { adventureId, expectedVersion: state.runtime.game!.world,
      actionId: `notes-${text}` as ActionId, input: { kind: 'notebook', operation: { kind: 'notes', text } } });
      expect(out.status).toBe('applied'); state = out.state; },
  };
}
async function review(h: Awaited<ReturnType<typeof setup>>) {
  const result = await h.coordinator.readSlot();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected reviewed slot');
  return result.review;
}

describe('T049 coordinator, actual API/reader/capture with synthetic transport only', () => {
  it('requires explicit current runtime/API binding and a full slot read before a new write', async () => {
    const h = await setup({ slot: 8, bind: false });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'session-required' });
    expect(h.coordinator.bindSession({ clientGeneration: 3 as ClientGeneration, apiGeneration: h.api.capture() })).toBe(false);
    expect(h.bind()).toBe(true);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'slot-unread' });
    expect(h.writes).toHaveLength(0);
  });

  it('manually adopts one confirmed-empty slot, with default autosave OFF and no dirty increment', async () => {
    const h = await setup(), game = h.state.runtime.game;
    await review(h);
    expect(h.state.runtime.persistence.knownSlot).toBeNull();
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'autosave-disabled' });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: true });
    expect(h.writes).toHaveLength(1);
    expect(new Headers(h.writes[0]!.headers).get('If-None-Match')).toBe('*');
    expect(new Headers(h.writes[0]!.headers).get('If-Match')).toBeNull();
    expect(h.state.runtime.game).toBe(game);
    expect(h.state.runtime.persistence).toMatchObject({ status: 'saved', dirtyGeneration: 4, lastAcknowledgedGeneration: 4,
      autosaveEnabled: false, pendingRequest: null, knownSlot: { revision: 1 } });
  });

  it('requires manual first adoption even when the account has opted into autosave', async () => {
    const h = await setup({ autosave: true }); await review(h);
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'manual-adoption-required' });
    expect(h.writes).toHaveLength(0);
  });

  it('uses one conditional slot for eligible automatic writes', async () => {
    const h = await setup({ slot: 8, autosave: true }); await review(h);
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: true });
    const headers = new Headers(h.writes[0]!.headers);
    expect(headers.get('If-Match')).toBe('"save-8"'); expect(headers.get('X-Save-Mode')).toBe('automatic');
    expect(headers.get('X-Confirm-Adventure-Replacement')).toBeNull();
  });

  it('serializes concurrent save/retry/read calls without queueing a recapture', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    const held = deferred<Response>(); h.setWrite(() => held.promise);
    const pending = h.coordinator.save('manual');
    expect(h.state.runtime.persistence.status).toBe('saving');
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'busy' });
    expect(await h.coordinator.retryPending()).toMatchObject({ ok: false, reason: 'busy' });
    expect(await h.coordinator.readSlot()).toMatchObject({ ok: false, reason: 'busy' });
    held.resolve(ack(9)); await pending; expect(h.writes).toHaveLength(1);
  });

  it('UI-LATE-ACK acknowledges captured generation 4 while real reducer edits leave generation 5 dirty', async () => {
    expect(conformance.clientOnly.find(c => c.id === 'UI-LATE-ACK')!.expected).toContain('acknowledge4 only');
    const h = await setup({ slot: 8 }); await review(h);
    const held = deferred<Response>(); h.setWrite(() => held.promise);
    const pending = h.coordinator.save('manual'); h.edit('Café 🧭 after capture');
    held.resolve(ack(9)); await pending;
    expect(h.state.runtime.persistence).toMatchObject({ status: 'unsaved', dirtyGeneration: 5, lastAcknowledgedGeneration: 4 });
    expect(h.state.runtime.game!.notebook.personalNotes).toBe('Café 🧭 after capture');
    expect(h.writes[0]!.body).not.toContain('after capture');
  });

  it('SV-OLD-POLICY retries exact bytes/key/mode/precondition/confirmation without validating or capturing again', async () => {
    expect(serviceCases.cases.find(c => c.id === 'SV-OLD-POLICY')!.expected.status).toBe(200);
    const h = await setup({ slot: 8, slotAdventure: otherAdventure });
    const reviewed = await review(h); expect(h.coordinator.authorizeReplacement(reviewed)).toBe(true);
    h.setWrite(async () => { throw new Error('response lost after commit'); });
    await h.coordinator.save('manual');
    const frozen = h.state.runtime.persistence.pendingRequest!;
    expect(Object.isFrozen(frozen.bodyBytes)).toBe(true);
    h.edit('Newer notes must not enter retry');
    const validation = vi.spyOn(h.validator, 'validateRuntime').mockImplementation(() => { throw new Error('new-write policy must not run'); });
    h.setWrite(async () => ack(9, summary(9), true));
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'pending-outcome' });
    expect(await h.coordinator.retryPending()).toMatchObject({ ok: true });
    expect(validation).not.toHaveBeenCalled();
    expect(h.writes[1]!.body).toBe(h.writes[0]!.body);
    expect(h.writes[1]!.headers).toEqual(h.writes[0]!.headers);
    expect(new Headers(h.writes[1]!.headers).get('X-Confirm-Adventure-Replacement')).toBe('true');
    expect(h.state.runtime.persistence).toMatchObject({ status: 'unsaved', lastAcknowledgedGeneration: 4, dirtyGeneration: 5 });
  });

  it('keep playing retains an unknown outcome and forbids a new overwrite', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    h.setWrite(async () => { throw new Error('connection lost'); }); await h.coordinator.save('manual');
    const before = h.state.runtime.persistence.pendingRequest;
    h.coordinator.keepPlaying(); h.edit('Continue in memory');
    expect(h.state.runtime.persistence.pendingRequest).toBe(before);
    expect(await h.coordinator.readSlot()).toMatchObject({ ok: false, reason: 'pending-outcome' });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'pending-outcome' });
    expect(h.writes).toHaveLength(1);
  });

  it('SV-REPLAY-OLDER records receipt 8, current slot 9 and requires a fresh read plus consent before overwrite', async () => {
    expect(serviceCases.cases.find(c => c.id === 'SV-REPLAY-OLDER')!.expected.assertions[1]).toContain('old ack is not latest slot');
    const h = await setup({ slot: 7, autosave: true }); const oldReview = await review(h);
    h.setWrite(async () => ack(8, summary(9, otherAdventure), true));
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: true, current: false });
    expect(h.state.runtime.persistence).toMatchObject({ status: 'conflict', lastAcknowledgedGeneration: 4, knownSlot: { revision: 9, adventureId: otherAdventure } });
    expect(h.coordinator.state.kind).toBe('conflict');
    expect(h.coordinator.authorizeReplacement(oldReview)).toBe(false);
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
    h.setSlot(summary(9), JSON.stringify({ ...h.state.runtime.game, saveSchemaVersion: 1, safeState: 'stable-exploration' }));
    const fresh = await review(h);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
    expect(h.coordinator.authorizeReplacement(fresh)).toBe(true);
    h.setWrite(async () => ack(10, summary(10), false, '70000000-0000-4000-8000-000000000002'));
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: true, current: true });
    expect(new Headers(h.writes[1]!.headers).get('If-Match')).toBe('"save-9"');
  });

  it('SV-STALE exposes 412 without replacing memory, then requires reviewed conditional explicit replacement', async () => {
    const h = await setup({ slot: 8, autosave: true }); const old = await review(h), game = h.state.runtime.game;
    h.setWrite(async () => response({ code: 'save-conflict', message: 'Current slot changed', requestId, currentSummary: summary(9) }, 412));
    await h.coordinator.save('manual');
    expect(h.state.runtime.game).toBe(game); expect(h.state.runtime.persistence.status).toBe('conflict');
    expect(h.state.runtime.persistence.pendingRequest).toBeNull(); expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
    expect(h.coordinator.authorizeReplacement(old)).toBe(false);
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
  });

  it('binds replacement consent to owned review, slot adventure, ETag and unchanged local capture', async () => {
    const h = await setup({ slot: 8, slotAdventure: otherAdventure }); const reviewed = await review(h);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'replacement-required' });
    expect(h.coordinator.authorizeReplacement({ ...reviewed })).toBe(false);
    expect(h.coordinator.authorizeReplacement(reviewed)).toBe(true);
    h.edit('Different local candidate');
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'replacement-required' });
    expect(h.writes).toHaveLength(0);
    expect(h.coordinator.authorizeReplacement(reviewed)).toBe(false);
    const fresh = await review(h); expect(h.coordinator.authorizeReplacement(fresh)).toBe(true);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: true });
  });

  it.each(['dialogue-transaction', 'pending-effect', 'room-transition', 'cutscene', 'active-encounter', 'terminal-failure', 'shutdown'] as const)
    ('rejects actual %s state even when it has a safe preparation checkpoint', async kind => {
      const h = await setup({ slot: 8 }); await review(h);
      h.replace({ ...h.state, runtime: { ...h.state.runtime, activity: { kind }, checkpoint: { adventureId, world: h.state.runtime.game!.world } } });
      expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'unsafe' }); expect(h.writes).toHaveLength(0);
    });

  it('rejects pending reducer work even with a superficially safe runtime activity', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    h.replace({ ...h.state, control: { ...h.state.control, pending: {} as NonNullable<ReducerState['control']['pending']> } });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'unsafe' }); expect(h.writes).toHaveLength(0);
  });

  it.each([401, 403, 422, 429, 503])('preserves game/confirmed metadata on HTTP %s without false acknowledgement or automatic sign-in', async status => {
    const h = await setup({ slot: 8 }); await review(h); const game = h.state.runtime.game;
    h.setWrite(async () => problem(status, 'synthetic-rejection')); await h.coordinator.save('manual');
    expect(h.state.runtime.game).toBe(game); expect(h.state.runtime.persistence.status).toBe('failed');
    expect(h.state.runtime.persistence.knownSlot?.revision).toBe(8); expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
    expect(h.writes).toHaveLength(1); expect(h.sessions).toBe(1);
  });

  it.each(['request', 'adventure', 'revision'] as const)('never acknowledges a mismatching %s receipt', async mismatch => {
    const h = await setup({ slot: 8 }); await review(h);
    h.setWrite(async () => ack(mismatch === 'revision' ? 8 : 9, summary(mismatch === 'revision' ? 8 : 9, mismatch === 'adventure' ? otherAdventure : adventureId), false,
      mismatch === 'request' ? '70000000-0000-4000-8000-000000000099' : requestId));
    await h.coordinator.save('manual');
    expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
    expect(h.state.runtime.persistence.status).toBe('failed'); expect(h.state.runtime.persistence.pendingRequest).not.toBeNull();
  });

  it('passes exact unknown lexical snapshot bytes to SaveReader and blocks replacement/autosave', async () => {
    const h = await setup({ slot: 8, autosave: true });
    const raw = '{ "saveSchemaVersion": 99, "future": 90071992547409931234567890, "text": "\\u0061" }';
    h.setSlot({ ...summary(8), saveSchemaVersion: 99 }, raw);
    const reader = vi.spyOn(h.reader, 'read'); const checked = await review(h);
    expect(reader.mock.calls[0]![0]).toEqual(new TextEncoder().encode(raw));
    expect(checked.read).toMatchObject({ status: 'unsupported', canReplace: false, canAutosave: false, originalBytes: Array.from(new TextEncoder().encode(raw)) });
    expect(h.coordinator.authorizeReplacement(checked)).toBe(false);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'slot-blocked' });
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'slot-blocked' });
    expect(h.writes).toHaveLength(0);
  });

  it('invalid supported saves also remain untouched; a session summary never grants replacement', async () => {
    const h = await setup({ slot: 8 }); h.setSlot(summary(8), '{"saveSchemaVersion":1,"contentVersion":"1.0.0"}');
    const checked = await review(h); expect(checked.read?.status).toBe('invalid');
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'slot-blocked' });
    expect(h.writes).toHaveLength(0);
  });

  it.each(['runtime', 'api', 'view'] as const)('UI-LATE-ACCOUNT ignores a late receipt after %s generation invalidation, preserving later memory', async change => {
    const h = await setup({ slot: 8 }); await review(h); const held = deferred<Response>(); h.setWrite(() => held.promise);
    const writing = h.coordinator.save('manual');
    if (change === 'api') h.api.invalidate();
    else if (change === 'runtime') h.replace({ ...h.state, runtime: { ...h.state.runtime, auth: { ...h.state.runtime.auth, clientGeneration: 5 as ClientGeneration } } });
    else h.coordinator.invalidateView();
    const later = h.state; held.resolve(ack(9)); await writing;
    expect(h.state).toBe(later); expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
    expect(await h.coordinator.retryPending()).toMatchObject({ ok: false });
  });

  it('rejects stale session binding even when provider/display name are identical', async () => {
    const h = await setup({ slot: 8 }); await review(h); h.session.csrfToken = 'd'.repeat(43); await h.api.getSession();
    expect(h.session.displayName).toBe('Same Label');
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'session-required' }); expect(h.writes).toHaveLength(0);
    expect(h.bind()).toBe(false);
  });

  it('new run/restore invalidation discards the old view without applying its late read to a replacement runtime', async () => {
    const h = await setup({ slot: 8 }); const held = deferred<Response>(); h.setRead(() => held.promise);
    const reading = h.coordinator.readSlot(); h.coordinator.invalidateView();
    h.replace(createReducerState(startIntroduction(h.state.runtime, loadIntroductionContent().registry)));
    const next = h.state; held.resolve(problem(404, 'save-not-found')); await reading;
    expect(h.state).toBe(next); expect(h.state.runtime.persistence.knownSlot).toBeUndefined();
  });

  it('reentrant saving subscribers cannot send an invalidated write or release a later operation', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    const off = h.coordinator.subscribe(state => { if (state.kind === 'saving') h.coordinator.invalidateView(); });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'stale' }); off();
    expect(h.writes).toHaveLength(0); expect(h.state.runtime.persistence.pendingRequest).toBeNull();
    expect(h.bind()).toBe(true); await review(h); expect(await h.coordinator.save('manual')).toMatchObject({ ok: true });
  });

  it('reentrant read subscribers cannot send an invalidated GET', async () => {
    const h = await setup({ slot: 8 }); h.coordinator.subscribe(state => { if (state.kind === 'reading') h.coordinator.invalidateView(); });
    expect(await h.coordinator.readSlot()).toMatchObject({ ok: false, reason: 'stale' }); expect(h.reads).toBe(0);
  });

  it('disposal and repeated invalidation preserve gameplay and never perform network mutations', async () => {
    const h = await setup({ slot: 8 }); const game = h.state.runtime.game;
    h.coordinator.invalidateView(); h.coordinator.dispose(); h.coordinator.dispose();
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false }); expect(h.state.runtime.game).toBe(game); expect(h.writes).toHaveLength(0);
  });

  it('a failed-notification retry keeps its own in-flight lock after the older send returns', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    const held = deferred<Response>(); let retry: ReturnType<SaveCoordinator['retryPending']> | undefined;
    h.setWrite(async () => { throw new Error('lost initial response'); });
    const off = h.coordinator.subscribe(state => {
      if (state.kind === 'failed') { h.setWrite(() => held.promise); retry = h.coordinator.retryPending(); }
    });
    await h.coordinator.save('manual'); off();
    expect(h.writes).toHaveLength(2);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'busy' });
    expect(await h.coordinator.retryPending()).toMatchObject({ ok: false, reason: 'busy' });
    held.resolve(ack(9, summary(9), true)); expect(await retry!).toMatchObject({ ok: true });
  });

  it('disposal cannot be reentered through an unbound notification to send new requests', async () => {
    const h = await setup({ slot: 8 }); const notifications: string[] = [];
    h.coordinator.subscribe(state => { notifications.push(state.kind); if (state.kind === 'unbound' && h.bind()) void h.coordinator.readSlot(); });
    h.coordinator.dispose(); await Promise.resolve();
    expect(h.reads).toBe(0); expect(notifications).toEqual(['disposed']);
  });

  it('terminal disposal notifications cannot recurse or restart the coordinator', async () => {
    const h = await setup(); let calls = 0;
    h.coordinator.subscribe(() => { calls++; h.coordinator.dispose(); expect(h.bind()).toBe(false); });
    h.coordinator.dispose(); expect(calls).toBe(1); expect(h.coordinator.state.kind).toBe('disposed');
  });

  it('UI lifecycle and read-review tokens reject clones, edits and same-adventure rebinding', async () => {
    const h = await setup({ slot: 8 }), token = h.coordinator.captureView()!, checked = await review(h);
    expect(Object.keys(token).sort()).toEqual(['apiGeneration', 'clientGeneration']);
    expect(h.coordinator.isCurrentView(token)).toBe(true); expect(h.coordinator.isCurrentView({ ...token })).toBe(false);
    expect(h.coordinator.isCurrentReview(checked)).toBe(true); expect(h.coordinator.isCurrentReview({ ...checked })).toBe(false);
    h.edit('Unsaved edits invalidate old load consent'); expect(h.coordinator.isCurrentReview(checked)).toBe(false);
    expect(h.coordinator.isCurrentView(token)).toBe(true);
    h.coordinator.invalidateView(); expect(h.bind()).toBe(true);
    expect(h.coordinator.isCurrentView(token)).toBe(false); expect(h.coordinator.isCurrentReview(checked)).toBe(false);
  });

  it('a receipt invalidated in the API-result microtask cannot acknowledge the replacement runtime', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    const original = h.api.putSave.bind(h.api);
    vi.spyOn(h.api, 'putSave').mockImplementation(async request => {
      const result = await original(request);
      queueMicrotask(() => h.coordinator.invalidateView()); return result;
    });
    const result = await h.coordinator.save('manual');
    expect(result.ok).toBe(false); expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
    expect(h.state.runtime.persistence.knownSlot).toBeUndefined();
  });

  it('same-adventure restore invalidation rejects the old frozen pending handle', async () => {
    const h = await setup({ slot: 8 }); await review(h); const held = deferred<Response>(); h.setWrite(() => held.promise);
    const writing = h.coordinator.save('manual'), sameGame = structuredClone(h.state.runtime.game);
    h.coordinator.invalidateView(); h.replace({ ...h.state, runtime: { ...h.state.runtime, game: sameGame } });
    const later = h.state; held.resolve(ack(9)); await writing;
    expect(h.state).toBe(later); expect(await h.coordinator.retryPending()).toMatchObject({ ok: false });
  });

  it('a timeout preserves frozen pending bytes and the in-memory adventure for explicit retry', async () => {
    const h = await setup({ slot: 8 }); await review(h); const game = h.state.runtime.game;
    vi.useFakeTimers();
    try {
      const held = deferred<Response>(); h.setWrite(() => held.promise);
      const writing = h.coordinator.save('manual'); await vi.advanceTimersByTimeAsync(15000);
      expect(await writing).toMatchObject({ ok: false, error: { kind: 'timeout' } });
      expect(h.state.runtime.game).toBe(game); expect(h.state.runtime.persistence.pendingRequest).not.toBeNull();
      expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
      held.resolve(ack(9)); await Promise.resolve();
      h.setWrite(async () => ack(9, summary(9), true)); expect(await h.coordinator.retryPending()).toMatchObject({ ok: true });
    } finally { vi.useRealTimers(); }
  });

  it.each(['E01', 'E02'] as const)('%s only writes at a declared safe Continue point (isolated fixture policy)', async outcome => {
    const fixturePolicies = structuredClone(policies);
    fixturePolicies[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['stable-exploration', 'safe-continue'];
    const h = await setup({ slot: 8, policies: fixturePolicies }); await review(h);
    const runtime = { ...h.state.runtime, game: { ...h.state.runtime.game!, world: { ...h.state.runtime.game!.world, continueOutcome: outcome } } };
    h.replace({ ...h.state, runtime }); expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'unsafe' });
    h.replace({ ...h.state, runtime: { ...runtime, activity: { kind: 'safe-continue' } } });
    h.setWrite(async () => ack(9, { ...summary(9), outcome }));
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: true });
    expect(JSON.parse(h.writes[0]!.body as string)).toMatchObject({ safeState: 'safe-continue', world: { continueOutcome: outcome } });
  });

  it('never accepts E03 as a current Continue outcome even with safe-continue activity', async () => {
    const h = await setup({ slot: 8 }); await review(h);
    const runtime = { ...h.state.runtime, activity: { kind: 'safe-continue' }, game: { ...h.state.runtime.game!, world: { ...h.state.runtime.game!.world, continueOutcome: 'E03' } } };
    h.replace({ ...h.state, runtime: runtime as unknown as RuntimeState });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'unsafe' }); expect(h.writes).toHaveLength(0);
  });

  it('read failure or mismatched summary cannot establish empty-slot or replacement authority', async () => {
    const h = await setup({ slot: 8 }); h.setRead(async () => problem(503, 'unavailable'));
    expect(await h.coordinator.readSlot()).toMatchObject({ ok: false });
    expect(h.state.runtime.persistence.knownSlot).toBeUndefined();
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'slot-unread' });
    const other = await setup({ slot: 8 }); other.setSlot(summary(8, otherAdventure));
    expect(await other.coordinator.readSlot()).toMatchObject({ ok: false, error: { kind: 'invalid-response' } });
    expect(await other.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'slot-unread' });
  });

  it('a later read that discovers another device write cannot silently authorize autosave over it', async () => {
    const h = await setup({ slot: 8, autosave: true }); await review(h);
    const saved = await h.coordinator.save('manual'); expect(saved.ok).toBe(true);
    expect(h.state.runtime.persistence.status).toBe('saved'); h.setSlot(summary(10));
    const checked = await review(h);
    expect(h.state.runtime.persistence).toMatchObject({ status: 'conflict', knownSlot: { revision: 10 }, lastAcknowledgedGeneration: 4 });
    expect(h.coordinator.state).toMatchObject({ kind: 'conflict', reason: 'slot-changed' });
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
    expect(h.coordinator.authorizeReplacement(checked)).toBe(true);
    expect(h.writes).toHaveLength(1);
  });

  it('the current status projection reflects dirty edits after a successful acknowledgement', async () => {
    const h = await setup({ slot: 8 }); await review(h); await h.coordinator.save('manual');
    expect(h.coordinator.state.kind).toBe('saved'); h.edit('Later unsaved changes');
    expect(h.state.runtime.persistence.status).toBe('unsaved'); expect(h.coordinator.state.kind).toBe('unsaved');
    expect(h.state.runtime.persistence.lastAcknowledgedGeneration).toBe(4);
  });

  it.each(['interrupted', 'migration-failed'] as const)('blocks %s reader results and retains their original bytes', async status => {
    const h = await setup({ slot: 8 });
    const bytes = [123, 125];
    vi.spyOn(h.reader, 'read').mockReturnValue(status === 'interrupted'
      ? { status, originalBytes: bytes, canReplace: false, canAutosave: false }
      : { status, originalBytes: bytes, canReplace: false, canAutosave: false, code: 'mapping-collision', path: '/world' });
    const read = await review(h); expect(read.read?.originalBytes).toEqual(bytes);
    expect(h.coordinator.authorizeReplacement(read)).toBe(false);
    expect(await h.coordinator.save('manual')).toMatchObject({ ok: false, reason: 'slot-blocked' });
  });
});
