// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, restoreIntroduction, startIntroduction } from '../../src/app/adventure';
import { createSaveDialogsController } from '../../src/ui/save-dialogs';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { GameApi, type Session } from '../../src/services/game-api';
import { AccountService, type AccountWindowPort } from '../../src/services/account';
import { SaveCoordinator } from '../../src/services/save-coordinator';
import { SaveValidator } from '../../src/services/save-validator';
import { SaveReader } from '../../src/state/save-migrations';
import { createReducerState, type ReducerState } from '../../src/state/reducer';
import type { DirtyGeneration, SaveSnapshotV1, SaveSummary } from '../../src/state/types';

const time = '2026-11-26T12:00:00Z';
const response = (data: unknown, status = 200, etag?: string) => new Response(JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(etag ? { ETag: etag } : {}),
} });
const problem = (status: number, code: string) => response({ code, message: 'Controlled response', requestId: crypto.randomUUID() }, status);
function summary(snapshot: SaveSnapshotV1, revision = 1): SaveSummary {
  return { revision, etag: `"save-${revision}"`, savedAt: time, adventureId: snapshot.adventureId, episodeId: snapshot.episodeId,
    roomId: snapshot.world.roomId, outcome: snapshot.world.continueOutcome, saveSchemaVersion: snapshot.saveSchemaVersion, contentVersion: snapshot.contentVersion } as unknown as SaveSummary;
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }
function fixture(options: { title?: boolean; slot?: boolean; same?: boolean; guest?: boolean; autosave?: boolean } = {}) {
  const { registry, world } = loadIntroductionContent(), policy = introductionSavePolicy(registry, world);
  const initial = startIntroduction(createIntroductionRuntime(), registry);
  let state = createReducerState(options.title ? createIntroductionRuntime() : initial);
  const validator = new SaveValidator([policy]), reader = new SaveReader({ currentContentVersion: policy.contentVersion, readPolicies: [policy], migrations: [] });
  const candidate = validator.validateRuntime(initial); if (!candidate.ok) throw new Error(candidate.code);
  let saved = options.slot ? { ...candidate.candidate, adventureId: options.same ? candidate.candidate.adventureId : crypto.randomUUID(),
    notebook: { ...candidate.candidate.notebook, personalNotes: 'SERVER notes only' } } as SaveSnapshotV1 : null;
  let slot = saved ? summary(saved) : null, raw: string | null = null;
  let session: Session = options.guest ? { state: 'guest', csrfToken: 'g'.repeat(43) } : { state: 'authenticated', csrfToken: 'a'.repeat(43), provider: 'google',
    displayName: '<b>Same label</b>', expiresAt: '2026-11-27T12:00:00Z', preferences: { revision: 1, etag: '"prefs-1"', values: { ...initial.ui!.presentation, autosaveEnabled: options.autosave ?? false } }, saveSummary: slot };
  const writes: RequestInit[] = [];
  let read = async () => slot ? response({ summary: slot, snapshot: raw ? JSON.parse(raw) : saved }, 200, slot.etag) : problem(404, 'save-not-found');
  let write = async (init: RequestInit) => {
    saved = JSON.parse(init.body as string) as SaveSnapshotV1; slot = summary(saved, (slot?.revision ?? 0) + 1);
    return response({ requestId: new Headers(init.headers).get('Idempotency-Key'), committedRevision: slot.revision, committedAt: time, replayed: false, currentSummary: slot }, 200, slot.etag);
  };
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    if (String(url).endsWith('/session')) return response(session);
    if (String(url).endsWith('/start')) return response({ authorizationUrl: 'https://accounts.google.com/o/oauth2/v2/auth?state=synthetic', expiresAt: '2099-01-01T00:00:00Z' });
    if (init?.method === 'GET') return read();
    writes.push(init!); return write(init!);
  });
  const api = new GameApi({ origin: 'https://game.example', apiBase: '/api/v1', fetch: fetcher as typeof fetch });
  const store = { getState: () => state, compareAndSet(expected: ReducerState, next: ReducerState) { if (expected !== state) return false; state = next; return true; } };
  const coordinator = new SaveCoordinator({ api, store, validator, reader });
  const popup = { closed: false, location: { replace: vi.fn() }, close: vi.fn() };
  const port: AccountWindowPort = { open: vi.fn(() => popup), onMessage: () => () => {}, onFocus: () => () => {}, setTimeout: () => 1, clearTimeout: () => {}, now: () => Date.parse(time) };
  const account = new AccountService(api, port), invalidateGameplay = vi.fn(), restored = vi.fn();
  const changed = vi.fn();
  const dialogs = createSaveDialogsController({ api, account, coordinator, store, changed, invalidateGameplay,
    restore(review, view) {
      if (!coordinator.isCurrentView(view) || !coordinator.isCurrentReview(review) || review.read?.status !== 'ready' || !review.summary) return false;
      const next = restoreIntroduction(state.runtime, review.read.snapshot);
      dialogs.invalidateView(); invalidateGameplay(); state = createReducerState(next); restored();
      dialogs.bindCurrentSession({ knownSlot: review.summary }); return true;
    },
  });
  return { dialogs, api, account, coordinator, port, popup, fetcher, writes, changed, restored, invalidateGameplay,
    get state() { return state; }, get slot() { return slot; }, get session() { return session; },
    setSession(next: Session) { session = next; }, read(next: typeof read) { read = next; }, write(next: typeof write) { write = next; },
    raw(value: string) { raw = value; }, setSlot(next: SaveSnapshotV1, revision: number) { saved = next; slot = summary(next, revision); },
    clearSlot() { saved = null; slot = null; },
    edit(notes: string) { state = { ...state, runtime: { ...state.runtime, game: { ...state.runtime.game!, notebook: { ...state.runtime.game!.notebook, personalNotes: notes } },
      persistence: { ...state.runtime.persistence, status: 'unsaved', dirtyGeneration: (state.runtime.persistence.dirtyGeneration + 1) as DirtyGeneration } } }; },
    replace(next: ReducerState) { state = next; },
  };
}

describe('T050 save dialogs composed with accepted API/account/coordinator/reader', () => {
  it('requires explicit first adoption after authenticated GET and empty read; cancellation keeps memory and sends no write', async () => {
    const f = fixture(), game = f.state.runtime.game; await f.dialogs.bootstrap();
    expect(f.state.runtime.game).toBe(game); expect(f.writes).toHaveLength(0);
    await f.dialogs.save(); expect(f.dialogs.project().panel).toBe('adopt');
    f.dialogs.cancel(); expect(f.state.runtime.game).toBe(game); expect(f.writes).toHaveLength(0);
    await f.dialogs.save(); await f.dialogs.act('confirm-adopt');
    expect(f.writes).toHaveLength(1); expect(new Headers(f.writes[0]!.headers).get('If-None-Match')).toBe('*');
    expect(f.dialogs.project().status).toBe(`Saved at ${time}`);
    f.edit('new unsaved notes'); expect(f.dialogs.project().status).toBe('Unsaved changes');
  });
  it('shows summary and explicit different-adventure load/replace/cancel; restore replaces exact notes and clears transient state', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); f.edit('LOCAL only');
    await f.dialogs.save(); expect(f.dialogs.project()).toMatchObject({ panel: 'choice', summary: { revision: 1 } });
    await f.dialogs.act('load'); expect(f.dialogs.project().panel).toBe('confirm-load'); expect(f.restored).not.toHaveBeenCalled();
    await f.dialogs.act('confirm-load'); expect(f.restored).toHaveBeenCalledOnce();
    expect(f.state.runtime.game!.notebook.personalNotes).toBe('SERVER notes only'); expect(f.state.runtime.checkpoint).toBeNull();
    expect(f.state.runtime.ui!.panel).toBe('none'); expect(f.writes).toHaveLength(0);
  });
  it('rejects a stale local-edit load or replacement confirmation', async () => {
    for (const operation of ['load', 'replace'] as const) {
      const f = fixture({ slot: true }); await f.dialogs.bootstrap(); await f.dialogs.save(); await f.dialogs.act(operation);
      f.edit('changed during review'); const game = f.state.runtime.game;
      await f.dialogs.act(operation === 'load' ? 'confirm-load' : 'confirm-replace');
      expect(f.state.runtime.game).toBe(game); expect(f.restored).not.toHaveBeenCalled(); expect(f.writes).toHaveLength(0);
      expect(f.dialogs.project().message).toContain('changed');
    }
  });
  it('binds replacement to reviewed ETag, server adventure and a new request key', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); await f.dialogs.save(); await f.dialogs.act('replace');
    expect(f.writes).toHaveLength(0); await f.dialogs.act('confirm-replace');
    const headers = new Headers(f.writes[0]!.headers); expect(headers.get('If-Match')).toBe('"save-1"');
    expect(headers.get('X-Confirm-Adventure-Replacement')).toBe('true'); expect(headers.get('Idempotency-Key')).toMatch(/^[\da-f-]{36}$/i);
  });
  it('Continue reads and validates without starting a new run and warns before discarding unsaved progress', async () => {
    const f = fixture({ title: true, slot: true }); await f.dialogs.bootstrap(); await f.dialogs.continue();
    expect(f.restored).toHaveBeenCalledOnce(); expect(f.state.runtime.game!.notebook.personalNotes).toBe('SERVER notes only');
    f.edit('local changes'); await f.dialogs.continue(); expect(f.dialogs.project().panel).toBe('confirm-load');
    f.dialogs.cancel(); expect(f.state.runtime.game!.notebook.personalNotes).toBe('local changes');
  });
  it('newer or invalid snapshots retain the read and offer neither load nor replacement', async () => {
    for (const raw of ['{"saveSchemaVersion":99,"opaque":9007199254740993}', '{"saveSchemaVersion":1,"contentVersion":"1.0.0"}']) {
      const f = fixture({ slot: true }); f.raw(raw); await f.dialogs.bootstrap(); const game = f.state.runtime.game;
      await f.dialogs.save(); expect(f.dialogs.project().panel).toBe('blocked');
      await f.dialogs.act('load'); await f.dialogs.act('replace'); await f.dialogs.act('confirm-replace');
      expect(f.writes).toHaveLength(0); expect(f.state.runtime.game).toBe(game);
    }
  });
  it('ignores late slot reads after whole-view invalidation, even with the same adventure and counters', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); const held = deferred<Response>(); f.read(() => held.promise);
    const pending = f.dialogs.continue(); f.dialogs.invalidateView(); const current = f.state;
    held.resolve(response({ summary: f.slot, snapshot: {} }, 200, f.slot!.etag)); await pending;
    expect(f.state).toBe(current); expect(f.restored).not.toHaveBeenCalled(); expect(f.dialogs.project().panel).toBe('none');
  });
  it('keeps an unknown write frozen after Keep Playing and retry sends identical bytes/key despite newer edits', async () => {
    const f = fixture(); await f.dialogs.bootstrap(); await f.dialogs.save();
    f.write(async () => { throw new Error('Connection lost'); }); await f.dialogs.act('confirm-adopt');
    expect(f.dialogs.project().panel).toBe('recovery'); const first = f.writes[0]!;
    f.dialogs.cancel(); f.edit('later notes'); await f.dialogs.save(); expect(f.writes).toHaveLength(1);
    await f.dialogs.act('retry'); expect(f.writes).toHaveLength(2); expect(f.writes[1]!.body).toBe(first.body);
    expect(new Headers(f.writes[1]!.headers).get('Idempotency-Key')).toBe(new Headers(first.headers).get('Idempotency-Key'));
    expect(f.state.runtime.persistence.pendingRequest).not.toBeNull();
  });
  it('412 never reuses consent: a fresh review and second explicit replacement decision are required', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); await f.dialogs.save(); await f.dialogs.act('replace');
    f.write(async () => response({ code: 'save-conflict', message: 'Changed', requestId: crypto.randomUUID(), currentSummary: f.slot }, 412));
    await f.dialogs.act('confirm-replace'); expect(f.dialogs.project().panel).toBe('conflict');
    await f.dialogs.act('confirm-replace'); expect(f.writes).toHaveLength(1);
    await f.dialogs.act('review'); expect(f.dialogs.project().panel).toBe('choice');
    await f.dialogs.act('replace'); await f.dialogs.act('confirm-replace'); expect(f.writes).toHaveLength(2);
    expect(new Headers(f.writes[0]!.headers).get('Idempotency-Key')).not.toBe(new Headers(f.writes[1]!.headers).get('Idempotency-Key'));
  });
  it('unconfigured service leaves guest gameplay intact and performs no save or provider navigation', async () => {
    const f = fixture({ guest: true }); f.fetcher.mockImplementation(async () => problem(503, 'service-unavailable'));
    const game = f.state.runtime.game; await f.dialogs.bootstrap(); expect(f.state.runtime.game).toBe(game);
    expect(f.dialogs.project().message).toContain('unavailable'); expect(f.writes).toHaveLength(0); expect(f.port.open).not.toHaveBeenCalled();
  });
  it('popup reservation is synchronous; blocked recovery is explicit, and cancellation retains notes', async () => {
    const f = fixture({ guest: true }); await f.dialogs.bootstrap(); f.edit('retained guest note');
    vi.mocked(f.port.open).mockReturnValueOnce(null);
    const pending = f.dialogs.signIn('google'); expect(f.port.open).toHaveBeenCalledOnce(); await pending;
    expect(f.dialogs.project().panel).toBe('signin'); expect(f.dialogs.project().account?.kind).toBe('popup-blocked');
    await f.dialogs.act('open-tab'); expect(f.port.open).toHaveBeenLastCalledWith('tab'); expect(f.popup.location.replace).toHaveBeenCalledOnce();
    f.dialogs.cancel(); expect(f.state.runtime.game!.notebook.personalNotes).toBe('retained guest note'); expect(f.writes).toHaveLength(0);
  });
  it('GET session alone establishes identity; identical provider/display labels never preserve an old owned view', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); await f.dialogs.save();
    const old = f.coordinator.captureView()!, game = f.state.runtime.game;
    const observed = f.session;
    expect(f.dialogs.adoptVerifiedSession(structuredClone(observed), f.api.capture())).toBe(false);
    f.setSession({ ...observed, csrfToken: 'b'.repeat(43) });
    await f.dialogs.bootstrap(); expect(f.coordinator.isCurrentView(old)).toBe(false);
    expect(f.state.runtime.game).toBe(game); expect(f.state.runtime.auth).toMatchObject({ status: 'authenticated', csrfToken: 'b'.repeat(43) });
    await f.dialogs.act('confirm-replace'); expect(f.writes).toHaveLength(0);
  });
  it('ignores AccountService observations from a separate non-login flow', async () => {
    const f = fixture(); await f.dialogs.bootstrap(); const old = f.coordinator.captureView(), game = f.state.runtime.game;
    await f.account.beginSignIn('google', 'delete-reauth');
    // No owned T050 login flow: even a valid current session observation cannot
    // install the deletion flow's account or trigger adoption.
    await f.account.checkSession(); expect(f.state.runtime.game).toBe(game);
    expect(f.dialogs.project().panel).toBe('none'); expect(f.writes).toHaveLength(0); expect(f.coordinator.captureView()).not.toBe(old);
  });
  it('manual session recovery after a retained login adopts guest progress without writing', async () => {
    const f = fixture({ guest: true }); await f.dialogs.bootstrap(); f.edit('guest note before login');
    await f.dialogs.signIn('google'); const initial = startIntroduction(createIntroductionRuntime(), loadIntroductionContent().registry);
    f.setSession({ state: 'authenticated', csrfToken: 'z'.repeat(43), provider: 'google', displayName: 'Verified GET identity', expiresAt: '2026-11-27T12:00:00Z',
      preferences: { revision: 1, etag: '"prefs-1"', values: { ...initial.ui!.presentation, autosaveEnabled: false } }, saveSummary: null });
    await f.dialogs.act('check-session');
    await vi.waitFor(() => expect(f.dialogs.project().panel).toBe('adopt'));
    expect(f.state.runtime.game!.notebook.personalNotes).toBe('guest note before login'); expect(f.writes).toHaveLength(0);
    expect(f.dialogs.project().identity).toBe('Verified GET identity (google)');
  });
  it('New Adventure suppression survives binding an opted-in account and does not replace the slot', async () => {
    const f = fixture({ slot: true, autosave: true }); await f.dialogs.bootstrap(); const old = f.slot, previousView = f.coordinator.captureView()!;
    const next = startIntroduction(f.state.runtime, loadIntroductionContent().registry);
    f.dialogs.invalidateView(); f.replace(createReducerState(next));
    expect(f.dialogs.bindCurrentSession({ knownSlot: old, autosaveOff: true })).toBe(true);
    expect(f.state.runtime.persistence.autosaveEnabled).toBe(false); expect(f.coordinator.isCurrentView(previousView)).toBe(false);
    expect(await f.coordinator.save('automatic')).toMatchObject({ ok: false }); expect(f.writes).toHaveLength(0);
    await f.dialogs.save(); expect(f.dialogs.project().panel).toBe('choice'); expect(f.writes).toHaveLength(0);
  });
  it('read drift after a same-ID restore stays a conflict and cannot authorize an automatic overwrite', async () => {
    const f = fixture({ slot: true, same: true, autosave: true }); await f.dialogs.bootstrap();
    await f.dialogs.continue(); await f.dialogs.act('confirm-load');
    const restored = f.state.runtime.game!, next = { ...restored, saveSchemaVersion: 1, safeState: 'stable-exploration' } as SaveSnapshotV1;
    f.setSlot(next, 2); await f.dialogs.save(); expect(f.dialogs.project().panel).toBe('choice');
    expect(await f.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' }); expect(f.writes).toHaveLength(0);
  });
  it('safe-state capture rejects dialogue transactions without writing', async () => {
    const f = fixture(); await f.dialogs.bootstrap(); await f.dialogs.save();
    f.replace({ ...f.state, runtime: { ...f.state.runtime, activity: { kind: 'dialogue-transaction' } } });
    await f.dialogs.act('confirm-adopt'); expect(f.writes).toHaveLength(0); expect(f.dialogs.project().message).toContain('Finish the current activity');
  });
  it('a late acknowledgement cannot paint Saved after explicit same-adventure view replacement', async () => {
    const f = fixture(); await f.dialogs.bootstrap(); await f.dialogs.save(); const held = deferred<Response>(); f.write(() => held.promise);
    const saving = f.dialogs.act('confirm-adopt'); const captured = f.writes[0]!;
    f.dialogs.invalidateView(); const replacement = createReducerState(structuredClone(f.state.runtime)); f.replace(replacement);
    held.resolve(response({ requestId: new Headers(captured.headers).get('Idempotency-Key'), committedRevision: 1, committedAt: time, replayed: false,
      currentSummary: summary(JSON.parse(captured.body as string) as SaveSnapshotV1) }, 200, '"save-1"')); await saving;
    expect(f.state).toBe(replacement); expect(f.dialogs.project().status).toBe('Unsaved changes');
  });
  it('Cancel while a reviewed read is in flight prevents its late dialog or restore effect', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); const held = deferred<Response>(); f.read(() => held.promise);
    const reading = f.dialogs.continue(); f.dialogs.cancel();
    const initial = startIntroduction(createIntroductionRuntime(), loadIntroductionContent().registry);
    const snapshot = { ...initial.game!, adventureId: f.slot!.adventureId, saveSchemaVersion: 1, safeState: 'stable-exploration' } as SaveSnapshotV1;
    held.resolve(response({ summary: f.slot, snapshot }, 200, f.slot!.etag)); await reading;
    expect(f.dialogs.project().panel).toBe('none'); expect(f.restored).not.toHaveBeenCalled();
  });
  it('a read-only session check cannot discard an unresolved frozen write', async () => {
    const f = fixture(); await f.dialogs.bootstrap(); await f.dialogs.save();
    f.write(async () => { throw new Error('Connection lost'); }); await f.dialogs.act('confirm-adopt');
    const pending = f.state.runtime.persistence.pendingRequest; await f.dialogs.act('reauth'); await f.dialogs.act('check-session');
    expect(f.state.runtime.persistence.pendingRequest).toBe(pending); expect(f.dialogs.project().panel).toBe('recovery');
  });
  it('an expired read offers sign-in while retaining the adventure', async () => {
    const f = fixture(); await f.dialogs.bootstrap(); const game = f.state.runtime.game;
    f.read(async () => problem(401, 'unauthorized')); await f.dialogs.save();
    expect(f.dialogs.project().panel).toBe('signin'); expect(f.state.runtime.game).toBe(game); expect(f.writes).toHaveLength(0);
  });
  it('a failed provider start can be retried explicitly without an intervening game reset', async () => {
    const f = fixture({ guest: true }); await f.dialogs.bootstrap(); const game = f.state.runtime.game;
    f.fetcher.mockImplementationOnce(async () => problem(503, 'service-unavailable'));
    await f.dialogs.signIn('google'); expect(f.account.state.kind).toBe('failed');
    await f.dialogs.signIn('google'); expect(f.port.open).toHaveBeenCalledTimes(2); expect(f.account.state.kind).toBe('awaiting-provider');
    expect(f.state.runtime.game).toBe(game); expect(f.writes).toHaveLength(0);
  });
  it('an older retained receipt displays conflict rather than Saved and requires current review', async () => {
    const f = fixture({ slot: true, same: true }); await f.dialogs.bootstrap();
    f.write(async init => response({ requestId: new Headers(init.headers).get('Idempotency-Key'), committedRevision: 2, committedAt: time,
      replayed: true, currentSummary: { ...f.slot!, revision: 3, etag: '"save-3"' } }, 200, '"save-3"'));
    await f.dialogs.save(); expect(f.dialogs.project().panel).toBe('conflict'); expect(f.dialogs.project().status).not.toContain('Saved at');
    expect(f.writes).toHaveLength(1); await f.dialogs.act('confirm-replace'); expect(f.writes).toHaveLength(1);
  });
  it('a freshly reviewed empty slot after drift still needs explicit consent and uses create precondition', async () => {
    const f = fixture({ slot: true }); await f.dialogs.bootstrap(); f.clearSlot();
    await f.dialogs.save(); expect(f.dialogs.project().panel).toBe('adopt'); expect(f.writes).toHaveLength(0);
    await f.dialogs.act('confirm-adopt'); expect(f.writes).toHaveLength(1);
    expect(new Headers(f.writes[0]!.headers).get('If-None-Match')).toBe('*'); expect(f.dialogs.project().status).toContain('Saved at');
  });
});
