// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../src/state/reducer';
import type { ActionId, AdventureId, ObjectiveId, RoomId, SafePositionId } from '../../src/domain/types';
import type { ActivityState, DirtyGeneration, RuntimeState, SaveSummary } from '../../src/state/types';
import { SaveReader } from '../../src/state/save-migrations';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';
import { GameApi } from '../../src/services/game-api';
import { SaveCoordinator } from '../../src/services/save-coordinator';
import { AutosaveController, AUTOSAVE_EXPLANATION } from '../../src/state/autosave';
import policyFile from '../../server/content/save-policy.generated.json' with { type: 'json' };

const adventureId = '10000000-0000-4000-8000-000000000001' as AdventureId;
const otherAdventure = '10000000-0000-4000-8000-000000000002' as AdventureId;
const stamp = '2026-11-26T12:00:00Z';
const policies = policyFile.policies as SaveContentPolicy[];
const response = (data: unknown, status = 200, etag?: string) => new Response(JSON.stringify(data), { status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(etag ? { ETag: etag } : {}) } });
const problem = (status: number, code: string) => response({ code, message: 'Synthetic response', requestId: '70000000-0000-4000-8000-000000000001' }, status);
function summary(revision: number, game: NonNullable<RuntimeState['game']>): SaveSummary {
  return { revision, etag: `"save-${revision}"`, savedAt: stamp, adventureId: game.adventureId, episodeId: game.episodeId,
    roomId: game.world.roomId, outcome: game.world.continueOutcome, saveSchemaVersion: 1, contentVersion: game.contentVersion } as unknown as SaveSummary;
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function setup(options: { enabled?: boolean; empty?: boolean; otherAdventure?: boolean; policies?: SaveContentPolicy[]; unread?: boolean } = {}) {
  const { registry } = loadIntroductionContent(), initial = startIntroduction(createIntroductionRuntime(), registry);
  let state = createReducerState({ ...initial, game: { ...initial.game!, adventureId },
    auth: { status: 'authenticated', provider: 'google', displayName: 'Test player', csrfToken: 'c'.repeat(43), expiresAt: '2026-11-27T12:00:00Z', clientGeneration: 4 },
    persistence: { ...initial.persistence, dirtyGeneration: 4 } } as RuntimeState);
  const reduce = createReducer({ registry, bindings: introductionBindings(registry).effects });
  const serverGame = { ...state.runtime.game!, adventureId: options.otherAdventure ? otherAdventure : adventureId };
  let slot = options.empty ? null : summary(8, serverGame);
  let snapshot: unknown = { ...serverGame, saveSchemaVersion: 1, safeState: 'stable-exploration' };
  const session = { state: 'authenticated', csrfToken: 'c'.repeat(43), provider: 'google', displayName: 'Test player', expiresAt: '2026-11-27T12:00:00Z',
    preferences: { revision: 1, etag: '"prefs-1"', values: { ...initial.ui!.presentation, autosaveEnabled: options.enabled ?? false } }, saveSummary: slot };
  const writes: RequestInit[] = [], patches: RequestInit[] = [];
  let sessionReads = 0, key = 0, action = 0;
  const acknowledge = (init: RequestInit) => {
    const game = JSON.parse(init.body as string) as NonNullable<RuntimeState['game']>;
    slot = summary((slot?.revision ?? 0) + 1, game); snapshot = game;
    return response({ requestId: new Headers(init.headers).get('Idempotency-Key'), committedRevision: slot.revision,
      committedAt: stamp, replayed: false, currentSummary: slot }, 200, slot.etag);
  };
  let write = async (init: RequestInit): Promise<Response> => acknowledge(init);
  let patch = async (init: RequestInit): Promise<Response> => {
    if (new Headers(init.headers).get('If-Match') !== session.preferences.etag) return problem(412, 'preferences-conflict');
    session.preferences = { revision: session.preferences.revision + 1, etag: `"prefs-${session.preferences.revision + 1}"`,
      values: { ...session.preferences.values, ...JSON.parse(init.body as string) } };
    return response(session.preferences, 200, session.preferences.etag);
  };
  let sessionRead = async (): Promise<Response> => response(session);
  const api = new GameApi({ origin: 'https://game.example', apiBase: '/api/v1', fetch: vi.fn(async (url, init) => {
    if (String(url).endsWith('/session')) { sessionReads++; return sessionRead(); }
    if (String(url).endsWith('/preferences')) { patches.push(init!); return patch(init!); }
    if (init?.method === 'GET') return slot ? response({ summary: slot, snapshot }, 200, slot.etag) : problem(404, 'save-not-found');
    writes.push(init!); return write(init!);
  }) as typeof fetch });
  expect((await api.getSession()).ok).toBe(true);
  const store = { getState: () => state, compareAndSet: (expected: ReducerState, next: ReducerState) => { if (state !== expected) return false; state = next; return true; } };
  const coordinator = new SaveCoordinator({ api, store, validator: new SaveValidator(options.policies ?? policies),
    reader: new SaveReader({ currentContentVersion: '1.0.0', readPolicies: options.policies ?? policies, migrations: [] }),
    requestId: () => `70000000-0000-4000-8000-${String(++key).padStart(12, '0')}` });
  const bind = () => coordinator.bindSession({ clientGeneration: state.runtime.auth.clientGeneration, apiGeneration: api.capture() });
  expect(bind()).toBe(true);
  if (!options.unread) expect((await coordinator.readSlot()).ok).toBe(true);
  const autosave = new AutosaveController({ api, store, coordinator, debounceMs: 750 });
  const command = (input: ReducerInput) => {
    const out = reduce(state, { adventureId, expectedVersion: state.runtime.game!.world, actionId: `action-${++action}` as ActionId, input });
    expect(out.status).not.toBe('rejected'); state = out.state; autosave.observe(); return out;
  };
  return { api, store, coordinator, autosave, session, writes, patches, bind, acknowledge,
    get state() { return state; }, get sessionReads() { return sessionReads; },
    setWrite(next: typeof write) { write = next; }, setPatch(next: typeof patch) { patch = next; }, setSessionRead(next: typeof sessionRead) { sessionRead = next; },
    setSnapshot(next: unknown) { snapshot = next; }, setSlot(next: SaveSummary) { slot = next; },
    replace(next: ReducerState, observe = true) { state = next; if (observe) autosave.observe(); },
    move(room = String(state.runtime.game!.world.roomId) === 'spec001:R01' ? 'R02' : 'R01') {
      command({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'fixture-navigation', observations: [], acceptedEffects: [] },
        destination: { roomId: `spec001:${room}` as RoomId, safePositionId: `spec001:${room}.entry` as SafePositionId, activity: 'stable-exploration' } });
    },
    notes(text: string) { return command({ kind: 'notebook', operation: { kind: 'notes', text } }); },
    activity(kind: ActivityState['kind']) { state = { ...state, runtime: { ...state.runtime, activity: { kind } } }; autosave.observe(); },
    complete(id = 'spec001:O01') {
      // Boundary fixture only. Scoring and authored objective validation are owned by the reducer suites.
      const runtime = state.runtime, game = runtime.game!;
      state = { ...state, runtime: { ...runtime, game: { ...game, world: { ...game.world,
        completedObjectiveIds: [...game.world.completedObjectiveIds, id as ObjectiveId] } },
        persistence: { ...runtime.persistence, dirtyGeneration: (runtime.persistence.dirtyGeneration + 1) as DirtyGeneration } } }; autosave.observe();
    },
    command,
  };
}
type Harness = Awaited<ReturnType<typeof setup>>;
function preferenceReview(h: Harness) {
  const reviewed = h.autosave.capturePreferencesReview(); expect(reviewed).not.toBeNull();
  if (!reviewed) throw new Error('Expected preference review'); return reviewed;
}
beforeEach(() => vi.useFakeTimers());
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); });

describe('T051 safe-boundary debounce using the actual coordinator/API/reducer', () => {
  it('defaults off and explains the shared account slot without writing on room/objective changes', async () => {
    const h = await setup(); h.move(); h.complete(); h.autosave.objectiveFeedbackDismissed();
    await vi.advanceTimersByTimeAsync(5000);
    expect(h.writes).toHaveLength(0); expect(h.patches).toHaveLength(0);
    expect(h.autosave.state.enabled).toBe(false);
    expect(AUTOSAVE_EXPLANATION).toMatch(/same.*slot/); expect(AUTOSAVE_EXPLANATION).toMatch(/across devices/);
  });
  it('waits the real debounce bound, then captures current bytes once without incrementing dirty twice', async () => {
    const h = await setup({ enabled: true }); h.move();
    expect(h.autosave.state.queued).toBe(true); await vi.advanceTimersByTimeAsync(749); expect(h.writes).toHaveLength(0);
    h.notes('Written after the eligible arrival'); const dirty = h.state.runtime.persistence.dirtyGeneration;
    await vi.advanceTimersByTimeAsync(1);
    expect(h.writes).toHaveLength(1); expect(JSON.parse(h.writes[0]!.body as string).notebook.personalNotes).toContain('after the eligible arrival');
    expect(h.state.runtime.persistence).toMatchObject({ dirtyGeneration: dirty, lastAcknowledgedGeneration: dirty, status: 'saved' });
    const headers = new Headers(h.writes[0]!.headers);
    expect(headers.get('X-Save-Mode')).toBe('automatic'); expect(headers.get('If-Match')).toBe('"save-8"');
    expect(headers.get('X-Confirm-Adventure-Replacement')).toBeNull();
  });
  it('debounces repeated real arrivals and ignores no-op renders and notes-only dirtiness', async () => {
    const h = await setup({ enabled: true }); h.notes('Notes wait for a boundary'); h.autosave.observe();
    await vi.advanceTimersByTimeAsync(2000); expect(h.writes).toHaveLength(0);
    h.move(); await vi.advanceTimersByTimeAsync(500); h.move();
    await vi.advanceTimersByTimeAsync(749); expect(h.writes).toHaveLength(0);
    h.autosave.observe(); await vi.advanceTimersByTimeAsync(1); expect(h.writes).toHaveLength(1);
    h.autosave.observe(); h.move('R01'); await vi.advanceTimersByTimeAsync(2000); expect(h.writes).toHaveLength(1);
  });
  it.each([{ empty: true }, { otherAdventure: true }, { unread: true }])('never adopts/replaces an unread or different slot automatically: %j', async options => {
    const h = await setup({ enabled: true, ...options }); h.move(); await vi.advanceTimersByTimeAsync(1000);
    expect(h.writes).toHaveLength(0);
  });
  it('manual first adoption permits only a later eligible automatic write', async () => {
    const h = await setup({ enabled: true, empty: true }); h.move(); await vi.advanceTimersByTimeAsync(1000);
    expect((await h.coordinator.save('manual')).ok).toBe(true); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
    h.move(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(2);
  });
  it.each(['dialogue-transaction', 'pending-effect', 'room-transition', 'cutscene', 'active-encounter', 'terminal-failure', 'shutdown'] as const)('cancels queued saves on %s, never resurrects them just by becoming stable', async activity => {
    const h = await setup({ enabled: true }); h.move(); h.activity(activity); h.activity('stable-exploration');
    await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
  });
  it('blocks a pending reducer transition even if its activity is incorrectly projected safe', async () => {
    const h = await setup({ enabled: true }); h.move();
    h.command({ kind: 'begin', activity: 'room-transition', evaluation: { status: 'correct', reasonCode: 'fixture', observations: [], acceptedEffects: [] } });
    h.activity('stable-exploration'); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
  });
  it('does not treat feedback rendering or a bare dismissal as completion; requires the actual dismissal hook', async () => {
    const h = await setup({ enabled: true }); expect(h.autosave.objectiveFeedbackDismissed()).toBe(false);
    h.complete(); h.autosave.observe(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
    expect(h.autosave.objectiveFeedbackDismissed()).toBe(true); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(1);
    expect(h.autosave.objectiveFeedbackDismissed()).toBe(false); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
  });
  it('does not save an unchanged acknowledged preparation, and delegates its authored anchor to current policy', async () => {
    const extended = structuredClone(policies); extended[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['stable-exploration', 'safe-preparation'];
    const h = await setup({ enabled: true, policies: extended }); expect((await h.coordinator.save('manual')).ok).toBe(true);
    h.activity('safe-preparation'); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
    h.activity('stable-exploration');
    // Isolated preparation fixture: current production content has no encounter.
    h.replace({ ...h.state, runtime: { ...h.state.runtime,
      game: { ...h.state.runtime.game!, notebook: { ...h.state.runtime.game!.notebook, personalNotes: 'New preparation' } },
      activity: { kind: 'safe-preparation' }, persistence: { ...h.state.runtime.persistence, dirtyGeneration: 5 as DirtyGeneration } } });
    await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(2);
  });
  it('includes earlier unsaved notes on a later real preparation entry without another game change', async () => {
    const extended = structuredClone(policies); extended[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['stable-exploration', 'safe-preparation'];
    const h = await setup({ enabled: true, policies: extended }); expect((await h.coordinator.save('manual')).ok).toBe(true);
    h.notes('Keep this observation for the next safe snapshot');
    const game = h.state.runtime.game, dirty = h.state.runtime.persistence.dirtyGeneration;
    await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
    h.activity('safe-preparation');
    expect(h.state.runtime.game).toBe(game); expect(h.state.runtime.persistence.dirtyGeneration).toBe(dirty);
    expect(h.autosave.state.queued).toBe(true); await vi.advanceTimersByTimeAsync(749); expect(h.writes).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1); expect(h.writes).toHaveLength(2);
    expect(JSON.parse(h.writes[1]!.body as string)).toMatchObject({ safeState: 'safe-preparation',
      notebook: { personalNotes: 'Keep this observation for the next safe snapshot' } });
    expect(h.state.runtime.persistence).toMatchObject({ dirtyGeneration: dirty, lastAcknowledgedGeneration: dirty, status: 'saved' });
    h.autosave.observe(); h.activity('stable-exploration'); h.activity('safe-preparation');
    await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(2);
  });
  it.each(['terminal-failure', 'shutdown', 'changed-attempt'] as const)('does not mistake a %s recovery for an eligible preparation entry', async origin => {
    const extended = structuredClone(policies); extended[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['stable-exploration', 'safe-preparation'];
    const h = await setup({ enabled: true, policies: extended }); expect((await h.coordinator.save('manual')).ok).toBe(true);
    h.notes('Retained learning must wait for an independent safe action');
    if (origin !== 'changed-attempt') h.activity(origin);
    const runtime = h.state.runtime, game = runtime.game!;
    h.replace({ ...h.state, runtime: { ...runtime, activity: { kind: 'safe-preparation' }, game: origin === 'changed-attempt'
      ? { ...game, world: { ...game.world, attemptId: '20000000-0000-4000-8000-000000000002' as typeof game.world.attemptId } } : game } });
    h.autosave.observe(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
  });
  it('rechecks current authored policy for preparation and Continue anchors', async () => {
    for (const kind of ['safe-preparation', 'safe-continue'] as const) {
      const h = await setup({ enabled: true }); h.complete(); h.activity(kind);
      h.autosave.objectiveFeedbackDismissed(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(0);
    }
  });
  it('does not invent opt-in from server preference when a new run is locally held off', async () => {
    const h = await setup({ enabled: true }); h.replace({ ...h.state, runtime: { ...h.state.runtime,
      persistence: { ...h.state.runtime.persistence, autosaveEnabled: false } } });
    h.move(); await h.autosave.refreshPreferences(); await vi.advanceTimersByTimeAsync(1000);
    expect(h.writes).toHaveLength(0); expect(h.state.runtime.persistence.autosaveEnabled).toBe(false);
  });
  it('rejects a collapsed E03 transition even if an adapter labels the final room safe', async () => {
    const h = await setup({ enabled: true }); const before = h.state, game = before.runtime.game!;
    const state = { ...before, runtime: { ...before.runtime, game: { ...game,
      world: { ...game.world, roomId: 'spec001:R02', position: { safePositionId: 'spec001:R02.entry' } },
      outcomeHistory: [{ id: '90000000-0000-4000-8000-000000000001', outcome: 'E03', attemptId: game.world.attemptId, route: null, caveatIds: [] }] },
      persistence: { ...before.runtime.persistence, dirtyGeneration: 5 } } } as unknown as ReducerState;
    h.replace(state); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(0);
    h.move(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(1);
  });
  it.each(['terminal-failure', 'shutdown'] as const)('does not autosave the %s rewind; a later independent arrival can save retained information', async failed => {
    const h = await setup({ enabled: true }); h.move(); h.activity(failed);
    const runtime = h.state.runtime, game = runtime.game!;
    h.replace({ ...h.state, runtime: { ...runtime, activity: { kind: 'stable-exploration' }, game: { ...game,
      world: { ...game.world, roomId: 'spec001:R01' as RoomId, position: { safePositionId: 'spec001:R01.entry' as SafePositionId },
        attemptId: '20000000-0000-4000-8000-000000000002' as typeof game.world.attemptId },
      notebook: { ...game.notebook, personalNotes: 'Retained clue' } }, persistence: { ...runtime.persistence, dirtyGeneration: 6 as DirtyGeneration } } });
    h.autosave.objectiveFeedbackDismissed(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
    h.move(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(1);
  });
  it.each(['E01', 'E02'] as const)('%s needs a declared safe Continue, without manufacturing ending content', async outcome => {
    const extended = structuredClone(policies); extended[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['stable-exploration', 'safe-continue'];
    const h = await setup({ enabled: true, policies: extended }); h.complete();
    const runtime = h.state.runtime;
    h.replace({ ...h.state, runtime: { ...runtime, game: { ...runtime.game!, world: { ...runtime.game!.world, continueOutcome: outcome } } } });
    expect(h.autosave.objectiveFeedbackDismissed()).toBe(false); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
    h.activity('safe-continue'); expect(h.autosave.objectiveFeedbackDismissed()).toBe(true);
    await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(1);
  });
  it('refuses current E03 even if a caller forges safe-continue and a completed objective', async () => {
    const h = await setup({ enabled: true }); h.complete();
    const runtime = { ...h.state.runtime, activity: { kind: 'safe-continue' }, game: { ...h.state.runtime.game!,
      world: { ...h.state.runtime.game!.world, continueOutcome: 'E03' } } } as unknown as RuntimeState;
    h.replace({ ...h.state, runtime }); h.autosave.objectiveFeedbackDismissed(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
  });
  it.each(['new-run', 'restore', 'account', 'logout', 'dispose'] as const)('invalidates same-adventure/counter queued callbacks on %s', async lifecycle => {
    const h = await setup({ enabled: true }); h.move();
    if (lifecycle === 'dispose') h.autosave.dispose(); else h.autosave.invalidateView();
    const copy = structuredClone(h.state); h.replace(copy); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
  });
  it('rechecks safety at delivery even when no observer ran for the last change', async () => {
    const h = await setup({ enabled: true }); h.move();
    h.replace({ ...h.state, runtime: { ...h.state.runtime, activity: { kind: 'cutscene' } } }, false);
    await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(0);
  });
  it('cannot carry an old completion through reentrant invalidation while canceling a queue', async () => {
    const h = await setup({ enabled: true }); h.move(); let replaced = false;
    h.autosave.subscribe(state => {
      if (!state.queued && !replaced) {
        replaced = true; h.autosave.invalidateView();
        h.replace({ ...h.state, runtime: { ...h.state.runtime, activity: { kind: 'stable-exploration' } } });
      }
    });
    const runtime = h.state.runtime, game = runtime.game!;
    h.replace({ ...h.state, runtime: { ...runtime, activity: { kind: 'cutscene' }, game: { ...game, world: { ...game.world,
      completedObjectiveIds: ['spec001:O01' as ObjectiveId] } },
      persistence: { ...runtime.persistence, dirtyGeneration: 6 as DirtyGeneration } } });
    expect(h.autosave.objectiveFeedbackDismissed()).toBe(false); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(0);
  });
  it('manual saves cancel redundant queued saves and pending writes never gain an automatic follow-up', async () => {
    const h = await setup({ enabled: true }); h.move(); const held = deferred<Response>(); h.setWrite(() => held.promise);
    const manual = h.coordinator.save('manual'); h.move(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
    held.resolve(h.acknowledge(h.writes[0]!)); await manual; await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1);
    expect(h.state.runtime.persistence.status).toBe('unsaved');
  });
  it('unknown outcomes retain exact pending bytes and never automatically retry or issue a fresh write', async () => {
    const h = await setup({ enabled: true }); h.setWrite(async () => { throw new Error('response lost'); }); h.move();
    await vi.advanceTimersByTimeAsync(750); const pending = h.state.runtime.persistence.pendingRequest;
    expect(pending).not.toBeNull(); h.move(); h.complete(); h.autosave.objectiveFeedbackDismissed(); await vi.advanceTimersByTimeAsync(30000);
    expect(h.writes).toHaveLength(1); expect(h.state.runtime.persistence.pendingRequest).toBe(pending);
  });
  it('respects coordinator Keep Playing, conflict and unsupported-slot blocking', async () => {
    const h = await setup({ enabled: true }); h.coordinator.keepPlaying(); h.move(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(0);
    const c = await setup({ enabled: true }); c.setWrite(async () => response({ code: 'save-conflict', message: 'Newer slot',
      requestId: '70000000-0000-4000-8000-000000000001', currentSummary: summary(9, c.state.runtime.game!) }, 412));
    c.move(); await vi.advanceTimersByTimeAsync(750); c.move(); await vi.advanceTimersByTimeAsync(750); expect(c.writes).toHaveLength(1);
    const u = await setup({ enabled: true }); u.setSnapshot({ saveSchemaVersion: 99 }); await u.coordinator.readSlot();
    u.move(); await vi.advanceTimersByTimeAsync(750); expect(u.writes).toHaveLength(0);
  });
});

describe('T051 conditional account preference choice and stale response guards', () => {
  it('uses a reviewed ETag, refreshes the API session before enable, and preserves known slot/acknowledgement', async () => {
    const h = await setup(); await h.coordinator.save('manual'); const before = h.state.runtime.persistence;
    const reviewed = preferenceReview(h), held = deferred<Response>(); h.setSessionRead(() => held.promise);
    const choosing = h.autosave.setEnabled(reviewed, true); await vi.advanceTimersByTimeAsync(0);
    expect(h.state.runtime.persistence.autosaveEnabled).toBe(false); expect(h.api.session).toMatchObject({ preferences: { values: { autosaveEnabled: false } } });
    expect(new Headers(h.patches[0]!.headers).get('If-Match')).toBe('"prefs-1"'); expect(JSON.parse(h.patches[0]!.body as string)).toEqual({ autosaveEnabled: true });
    held.resolve(response(h.session)); expect(await choosing).toMatchObject({ ok: true, enabled: true });
    expect(h.api.session).toMatchObject({ preferences: { values: { autosaveEnabled: true } } });
    expect(h.state.runtime.persistence.knownSlot).toBe(before.knownSlot); expect(h.state.runtime.persistence.lastAcknowledgement).toBe(before.lastAcknowledgement);
    await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(1); h.move(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(2);
  });
  it('immediately suppresses queued writes on opt-out even when its network result is unknown', async () => {
    const h = await setup({ enabled: true }); h.move(); h.setPatch(async () => { throw new Error('lost preference response'); });
    const choosing = h.autosave.setEnabled(preferenceReview(h), false);
    expect(h.autosave.state.enabled).toBe(false); expect(h.autosave.state.queued).toBe(false);
    expect(await choosing).toMatchObject({ ok: false, reason: 'api' }); h.move(); await vi.advanceTimersByTimeAsync(1000);
    expect(h.writes).toHaveLength(0); expect(h.autosave.state.kind).toBe('unconfirmed'); expect(h.autosave.state.message).toMatch(/unconfirmed/);
  });
  it('does not claim an already sent save was undone by opt-out', async () => {
    const h = await setup({ enabled: true }); const held = deferred<Response>(); h.setWrite(() => held.promise); h.move(); await vi.advanceTimersByTimeAsync(750);
    expect(await h.autosave.setEnabled(preferenceReview(h), false)).toMatchObject({ ok: true, enabled: false });
    held.resolve(h.acknowledge(h.writes[0]!)); await vi.advanceTimersByTimeAsync(0);
    expect(h.state.runtime.persistence.status).toBe('saved'); expect(h.state.runtime.persistence.autosaveEnabled).toBe(false);
    h.move(); await vi.advanceTimersByTimeAsync(750); expect(h.writes).toHaveLength(1);
  });
  it('never lets an older enable acknowledgement re-enable a later opt-out', async () => {
    const h = await setup(), held = deferred<Response>(), reviewed = preferenceReview(h);
    h.setPatch(() => held.promise); const enabling = h.autosave.setEnabled(reviewed, true);
    h.setPatch(async () => problem(412, 'preferences-conflict'));
    expect(await h.autosave.setEnabled(reviewed, false)).toMatchObject({ ok: false });
    held.resolve(response({ ...h.session.preferences, revision: 2, etag: '"prefs-2"', values: { ...h.session.preferences.values, autosaveEnabled: true } }, 200, '"prefs-2"'));
    expect(await enabling).toMatchObject({ ok: false, reason: 'stale' });
    expect(h.autosave.state.enabled).toBe(false); h.move(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
  });
  it.each(['invalidate', 'api-generation', 'account', 'dispose'] as const)('ignores late preference responses after %s', async lifecycle => {
    const h = await setup(), held = deferred<Response>(); h.setPatch(() => held.promise);
    const choosing = h.autosave.setEnabled(preferenceReview(h), true);
    if (lifecycle === 'dispose') h.autosave.dispose();
    else if (lifecycle === 'api-generation') h.api.invalidate();
    else if (lifecycle === 'account') h.replace({ ...h.state, runtime: { ...h.state.runtime, auth: { ...h.state.runtime.auth, csrfToken: 'd'.repeat(43) } } } as ReducerState);
    else h.autosave.invalidateView();
    held.resolve(response({ ...h.session.preferences, revision: 2, etag: '"prefs-2"', values: { ...h.session.preferences.values, autosaveEnabled: true } }, 200, '"prefs-2"'));
    expect(await choosing).toMatchObject({ ok: false, reason: 'stale' }); expect(h.state.runtime.persistence.autosaveEnabled).toBe(false);
  });
  it('rejects cloned reviews and stale reviewed ETags without writing preferences', async () => {
    const h = await setup(), reviewed = preferenceReview(h);
    expect(await h.autosave.setEnabled({ ...reviewed }, true)).toMatchObject({ ok: false, reason: 'stale' });
    h.session.preferences = { ...h.session.preferences, revision: 2, etag: '"prefs-2"' }; await h.api.getSession();
    expect(await h.autosave.setEnabled(reviewed, true)).toMatchObject({ ok: false, reason: 'stale' }); expect(h.patches).toHaveLength(0);
  });
  it('a current owned opt-out with a stale ETag still stops this tab immediately', async () => {
    const h = await setup({ enabled: true }), reviewed = preferenceReview(h); h.move();
    h.session.preferences = { ...h.session.preferences, revision: 2, etag: '"prefs-2"' }; await h.api.getSession();
    expect(await h.autosave.setEnabled(reviewed, false)).toMatchObject({ ok: false });
    expect(h.autosave.state.enabled).toBe(false); expect(h.state.runtime.persistence.autosaveEnabled).toBe(false);
    await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0); expect(h.patches).toHaveLength(0);
  });
  it('a reentrant later preference choice makes the earlier success result stale too', async () => {
    const h = await setup(); let later: Promise<unknown> | undefined;
    h.autosave.subscribe(state => {
      if (state.kind === 'ready' && state.enabled) later = h.autosave.setEnabled(preferenceReview(h), false);
    });
    expect(await h.autosave.setEnabled(preferenceReview(h), true)).toMatchObject({ ok: false, reason: 'stale' });
    await later; expect(h.autosave.state.enabled).toBe(false);
  });
  it('stays paused when PATCH succeeded but reconciliation failed or reveals a different choice', async () => {
    const h = await setup(); h.setSessionRead(async () => { throw new Error('offline'); });
    expect(await h.autosave.setEnabled(preferenceReview(h), true)).toMatchObject({ ok: false });
    expect(h.autosave.state.enabled).toBe(false);
    const c = await setup(); c.setSessionRead(async () => response({ ...c.session, preferences: { ...c.session.preferences,
      revision: 3, etag: '"prefs-3"', values: { ...c.session.preferences.values, autosaveEnabled: false } } }));
    expect(await c.autosave.setEnabled(preferenceReview(c), true)).toMatchObject({ ok: false, reason: 'conflict' }); expect(c.autosave.state.enabled).toBe(false);
  });
  it('does not enable from an older GET revision or a changed session despite matching labels', async () => {
    const h = await setup(), old = structuredClone(h.session); h.setSessionRead(async () => response(old));
    expect(await h.autosave.setEnabled(preferenceReview(h), true)).toMatchObject({ ok: false }); expect(h.autosave.state.enabled).toBe(false);
    const c = await setup(); c.setSessionRead(async () => response({ ...c.session, csrfToken: 'd'.repeat(43) }));
    expect(await c.autosave.setEnabled(preferenceReview(c), true)).toMatchObject({ ok: false, reason: 'stale' }); expect(c.state.runtime.persistence.autosaveEnabled).toBe(false);
  });
  it('allows an explicit read-only preference refresh after a conflict, without implicitly enabling local opt-out', async () => {
    const h = await setup({ enabled: true }); h.setPatch(async () => problem(412, 'preferences-conflict'));
    await h.autosave.setEnabled(preferenceReview(h), false);
    h.session.preferences = { ...h.session.preferences, revision: 2, etag: '"prefs-2"' };
    expect(await h.autosave.refreshPreferences()).toMatchObject({ ok: true, enabled: false });
    expect(preferenceReview(h).etag).toBe('"prefs-2"'); h.move(); await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0);
  });
  it('guards reentrant subscribers before network and dispose remains terminal', async () => {
    const h = await setup(); h.autosave.subscribe(state => { if (state.kind === 'updating') h.autosave.dispose(); });
    expect(await h.autosave.setEnabled(preferenceReview(h), true)).toMatchObject({ ok: false, reason: 'stale' }); expect(h.patches).toHaveLength(0);
    expect(h.autosave.state.kind).toBe('disposed'); expect(h.autosave.capturePreferencesReview()).toBeNull();
  });
});
