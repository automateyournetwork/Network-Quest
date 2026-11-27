// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { afterEach, describe, expect, it, vi } from 'vitest';
import endings from '../../content/spec001/endings.json';
import { createIntroductionRuntime, restoreIntroduction, startIntroduction } from '../../src/app/adventure';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { validateEndingsContent } from '../../src/content/endings';
import type { ActionId, OutcomeEventId } from '../../src/domain/types';
import { AccountService, type AccountWindowPort } from '../../src/services/account';
import { GameApi, type Session } from '../../src/services/game-api';
import { SaveCoordinator } from '../../src/services/save-coordinator';
import { SaveValidator } from '../../src/services/save-validator';
import { AutosaveController } from '../../src/state/autosave';
import { captureEncounterContext } from '../../src/state/encounter';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { createReducerState } from '../../src/state/reducer';
import { createRiftHazardController } from '../../src/state/rift-hazard';
import { SaveReader } from '../../src/state/save-migrations';
import type { SaveSnapshotV1, SaveSummary } from '../../src/state/types';
import { createRecoveryController } from '../../src/ui/recovery';
import { createSaveDialogsController } from '../../src/ui/save-dialogs';
import { fixture, q, registry, uuid, world } from '../state/outcome-fixture';

const checked = validateEndingsContent(endings); if (!checked.ok) throw new Error(checked.issues.join(';'));
const content = checked.value, stamp = '2026-11-26T12:00:00Z';
const response = (data: unknown, etag?: string) => new Response(JSON.stringify(data), { headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...(etag ? { ETag: etag } : {}),
} });
const summary = (snapshot: SaveSnapshotV1, revision: number) => ({ revision, etag: `"save-${revision}"`, savedAt: stamp,
  adventureId: snapshot.adventureId, episodeId: snapshot.episodeId, roomId: snapshot.world.roomId, outcome: snapshot.world.continueOutcome,
  saveSchemaVersion: 1, contentVersion: snapshot.contentVersion }) as unknown as SaveSummary;
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done; }); return { promise, resolve }; }

/** Actual client services and production policy; only remote transport/account
 * responses are controlled. Seeded training prerequisites are not full play. */
async function setup({ guest = false, enabled = false } = {}) {
  const f = fixture(), policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
  const reader = new SaveReader({ currentContentVersion: policy.contentVersion, readPolicies: [policy], migrations: [] });
  const initial = startIntroduction(createIntroductionRuntime(), registry), checked = validator.validateRuntime(initial);
  if (!checked.ok) throw new Error(checked.code);
  let saved: SaveSnapshotV1 = { ...checked.candidate, adventureId: f.game().adventureId,
    notebook: { ...checked.candidate.notebook, personalNotes: 'Only the confirmed saved notes' } };
  let slot = summary(saved, 4);
  const authenticated = (): Session => ({ state: 'authenticated', csrfToken: 's'.repeat(43), provider: 'github', displayName: 'Isolated player',
    expiresAt: '2099-01-01T00:00:00Z', preferences: { revision: 1, etag: '"prefs-1"', values: { ...initial.ui!.presentation, autosaveEnabled: enabled } }, saveSummary: slot });
  let session: Session = guest ? { state: 'guest', csrfToken: 'g'.repeat(43) } : authenticated();
  const writes: RequestInit[] = [], requests: { method: string; path: string }[] = [];
  const acknowledge = (init: RequestInit) => {
    saved = JSON.parse(init.body as string) as SaveSnapshotV1; slot = summary(saved, slot.revision + 1);
    return response({ requestId: new Headers(init.headers).get('Idempotency-Key'), committedRevision: slot.revision, committedAt: stamp,
      replayed: false, currentSummary: slot }, slot.etag);
  };
  let write = async (init: RequestInit) => acknowledge(init);
  let read = async () => response({ summary: slot, snapshot: saved }, slot.etag);
  const fetcher = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url); requests.push({ method: init?.method ?? 'GET', path });
    if (path.endsWith('/session')) return response(session);
    if (path.endsWith('/start')) return response({ authorizationUrl: 'https://github.com/login/oauth/authorize?state=synthetic', expiresAt: '2099-01-01T00:00:00Z' });
    if (init?.method === 'GET') return read();
    writes.push(init!); return write(init!);
  });
  const api = new GameApi({ origin: 'https://game.example', apiBase: '/api/v1', fetch: fetcher as typeof fetch });
  const coordinator = new SaveCoordinator({ api, store: f.store, validator, reader });
  const popup = { closed: false, location: { replace: vi.fn() }, close: vi.fn() };
  const port: AccountWindowPort = { open: vi.fn(() => popup), onMessage: () => () => {}, onFocus: () => () => {}, setTimeout: () => 1,
    clearTimeout: () => {}, now: () => Date.parse(stamp) };
  const account = new AccountService(api, port), changed = vi.fn(), restored = vi.fn();
  const dialogs = createSaveDialogsController({ api, account, coordinator, store: f.store, changed, invalidateGameplay: () => f.bus.invalidate(),
    restore(review, view) {
      if (!coordinator.isCurrentView(view) || !coordinator.isCurrentReview(review) || review.read?.status !== 'ready' || !review.summary) return false;
      const next = createReducerState(restoreIntroduction(f.state().runtime, review.read.snapshot));
      dialogs.invalidateView(); f.replace(next); f.bus.invalidate(); dialogs.bindCurrentSession({ knownSlot: review.summary }); restored(); return true;
    },
  });
  await dialogs.bootstrap();
  if (!guest) expect((await coordinator.readSlot()).ok).toBe(true);
  const autosave = new AutosaveController({ api, coordinator, store: f.store, debounceMs: 10 });
  const outcomes = createOutcomeController({ registry, repairScenario: f.resolver }), hazards = createRiftHazardController({ registry, content });
  const recovery = createRecoveryController({ registry, store: f.store, outcomes, hazards, restore: { available: () => true,
    continue: () => dialogs.continue(), signIn: () => { void dialogs.continue(); } }, changed,
    afterRollback: () => { dialogs.retireAdventureReview(); f.bus.invalidate(); autosave.observe(); } });
  const terminal = (kind: 'failure' | 'shutdown') => {
    if (kind === 'failure') {
      const result = hazards.prepare(f.state(), captureEncounterContext(f.state())!, { hazardId: content.hazard.id, warningAcknowledged: true });
      if (!result.ok) throw new Error(result.reason); expect(hazards.commit(f.store, result.change).ok).toBe(true);
    } else {
      f.prepare('shutdown'); f.choose('record-isolation');
      f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'preparation', observations: [], acceptedEffects: [] },
        destination: { roomId: q('R11'), safePositionId: q('R11.preparation'), activity: 'safe-preparation' } });
      expect(f.execute().result.status).toBe('handled'); f.send({ kind: 'notebook', operation: { kind: 'notes', text: 'New clue during this attempt' } });
      f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O12') } }); f.move('R12'); f.choose('read-classification');
      const result = outcomes.prepareClassification(f.state(), captureOutcomeContext(f.state())!, { actionId: 'actual-shutdown' as ActionId,
        eventId: uuid(90) as unknown as OutcomeEventId, operation: { kind: 'classify', selection: 'shutdown', linkId: null, endpointId: null } });
      if (!result.ok) throw new Error(result.reason); expect(outcomes.commit(f.store, result.change).ok).toBe(true);
    }
    autosave.observe();
  };
  const retry = (kind: 'failure' | 'shutdown') => {
    expect(recovery.request(recovery.capture(kind === 'failure' ? 'retry' : 'continue')!).ok).toBe(true);
    expect(recovery.confirm(recovery.project()!).ok).toBe(true);
  };
  return { ...f, api, account, coordinator, autosave, recovery, dialogs, writes, requests, port, restored, terminal, retry, acknowledge,
    authenticated, get saved() { return saved; }, get slot() { return slot; }, setSession(next: Session) { session = next; },
    setWrite(next: typeof write) { write = next; }, setRead(next: typeof read) { read = next; }, dispose() { recovery.dispose(); autosave.dispose(); dialogs.dispose(); f.bus.dispose(); } };
}
afterEach(() => vi.useRealTimers());

describe('T088 recovery with real save services and controlled remote transport', () => {
  it.each(['failure', 'shutdown'] as const)('%s retry preserves non-null pending save identity; late acknowledgement cannot save the new attempt', async kind => {
    const h = await setup({ enabled: true }), held = deferred<Response>(); h.setWrite(() => held.promise);
    h.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Safe preparation before the attempt' } });
    const capturedGeneration = h.state().runtime.persistence.dirtyGeneration, oldAttempt = h.game().world.attemptId;
    const saving = h.coordinator.save('manual'); expect(h.writes).toHaveLength(1);
    const pending = h.state().runtime.persistence.pendingRequest!, known = h.state().runtime.persistence.knownSlot!;
    expect(pending).not.toBeNull(); expect(known).not.toBeNull(); const beforeSlot = h.slot;
    h.terminal(kind); const count = h.requests.length; h.retry(kind);
    expect(h.requests).toHaveLength(count); expect(h.state().runtime.persistence.pendingRequest).toBe(pending);
    expect(h.state().runtime.persistence.knownSlot).toBe(known); expect(h.slot).toBe(beforeSlot);
    expect(h.game().world.attemptId).not.toBe(oldAttempt); expect(h.autosave.state.queued).toBe(false);
    const retried = h.game(), dirty = h.state().runtime.persistence.dirtyGeneration;
    held.resolve(h.acknowledge(h.writes[0]!)); expect((await saving).ok).toBe(true);
    expect(h.game()).toBe(retried); expect(h.state().runtime.persistence).toMatchObject({ status: 'unsaved', dirtyGeneration: dirty,
      lastAcknowledgedGeneration: capturedGeneration, pendingRequest: null });
    expect(h.saved.world.attemptId).toBe(oldAttempt); expect(h.saved.notebook.personalNotes).toBe('Safe preparation before the attempt');
    expect(h.writes).toHaveLength(1); expect(h.autosave.state.queued).toBe(false);
    h.setWrite(async init => h.acknowledge(init));
    expect((await h.coordinator.save('manual')).ok).toBe(true); expect(h.writes).toHaveLength(2);
    expect(h.saved.world.attemptId).toBe(retried.world.attemptId); expect(h.saved.notebook).toEqual(retried.notebook); h.dispose();
  });
  it('an unknown earlier write remains an exact explicit retry after encounter recovery', async () => {
    const h = await setup(); h.setWrite(async () => { throw new Error('Controlled lost response'); });
    expect((await h.coordinator.save('manual')).ok).toBe(false); const pending = h.state().runtime.persistence.pendingRequest!, first = h.writes[0]!;
    h.terminal('failure'); h.retry('failure'); const game = h.game(); expect(h.state().runtime.persistence.pendingRequest).toBe(pending);
    h.setWrite(async init => h.acknowledge(init)); expect((await h.coordinator.retryPending()).ok).toBe(true);
    expect(h.writes).toHaveLength(2); expect(h.writes[1]!.body).toBe(first.body);
    expect(new Headers(h.writes[1]!.headers).get('Idempotency-Key')).toBe(new Headers(first.headers).get('Idempotency-Key'));
    expect(h.game()).toBe(game); expect(h.state().runtime.persistence.status).toBe('unsaved'); expect(h.saved.world.attemptId).not.toBe(game.world.attemptId); h.dispose();
  });
  it.each(['failure', 'shutdown'] as const)('%s cancels a genuine queued safe-arrival autosave; retry and render observations never reschedule it', async kind => {
    vi.useFakeTimers(); const h = await setup({ enabled: true });
    expect(h.move('R10').status).toBe('handled'); h.autosave.observe(); expect(h.move('R11').status).toBe('handled'); h.autosave.observe();
    expect(h.autosave.state.queued).toBe(true); h.terminal(kind); expect(h.autosave.state.queued).toBe(false);
    const saved = h.saved, count = h.requests.length; h.retry(kind); for (let i = 0; i < 4; i++) h.autosave.observe();
    await vi.advanceTimersByTimeAsync(1000); expect(h.writes).toHaveLength(0); expect(h.requests).toHaveLength(count); expect(h.saved).toBe(saved);
    expect(h.autosave.state.queued).toBe(false);
    // A later actual independent walk is an ordinary safe boundary, not Retry.
    expect(h.move('R10').status).toBe('handled'); h.autosave.observe(); await vi.advanceTimersByTimeAsync(1000);
    expect(h.writes).toHaveLength(1); expect(h.saved.notebook).toEqual(h.game().notebook); h.dispose();
  });
  it.each(['failure', 'shutdown'] as const)('%s Restore reads/reviews and confirms exact saved data without a learning merge', async kind => {
    const h = await setup(); h.terminal(kind); const current = h.game(), count = h.requests.length, saved = h.saved;
    expect(h.recovery.request(h.recovery.capture('restore')!).ok).toBe(true);
    await vi.waitFor(() => expect(h.dialogs.project().panel).toBe('confirm-load'));
    expect(h.requests).toHaveLength(count + 1); expect(h.requests.at(-1)?.method).toBe('GET'); expect(h.game()).toBe(current);
    h.dialogs.cancel(); expect(h.game()).toBe(current); expect(h.writes).toHaveLength(0);
    expect(h.recovery.request(h.recovery.capture('restore')!).ok).toBe(true);
    await vi.waitFor(() => expect(h.dialogs.project().panel).toBe('confirm-load')); await h.dialogs.act('confirm-load');
    expect(h.restored).toHaveBeenCalledOnce(); expect(h.game().notebook).toEqual(saved.notebook); expect(h.game().world).toEqual(saved.world);
    expect(h.game().outcomeHistory).toEqual(saved.outcomeHistory); expect(h.state().runtime.checkpoint).toBeNull();
    expect(h.writes).toHaveLength(0); expect(h.saved).toBe(saved); expect(h.recovery.capture('retry')).toBeNull(); h.dispose();
  });
  it('guest Restore opens provider choice with no HTTP; actual synthetic sign-in alone neither loads nor saves', async () => {
    const h = await setup({ guest: true }); h.terminal('failure'); const current = h.game(), count = h.requests.length;
    expect(h.recovery.request(h.recovery.capture('sign-in-to-restore')!).ok).toBe(true);
    expect(h.dialogs.project().panel).toBe('signin'); expect(h.requests).toHaveLength(count); expect(h.port.open).not.toHaveBeenCalled();
    await h.dialogs.signIn('github'); expect(h.port.open).toHaveBeenCalledOnce(); h.setSession(h.authenticated()); await h.dialogs.act('check-session');
    await vi.waitFor(() => expect(h.dialogs.project().panel).toBe('choice'));
    expect(h.game()).toBe(current); expect(h.restored).not.toHaveBeenCalled(); expect(h.writes).toHaveLength(0);
    expect(h.recovery.availability().restore).toBe('available'); h.dispose();
  });
  it('a deferred Restore read cannot open its old confirmation after Retry; later ordinary autosave still works', async () => {
    const h = await setup({ enabled: true }), held = deferred<Response>(); h.terminal('failure'); h.setRead(() => held.promise);
    const originalSlot = h.slot, originalSaved = h.saved, coordinatorView = h.coordinator.captureView();
    expect(h.recovery.request(h.recovery.capture('restore')!).ok).toBe(true);
    expect(h.coordinator.state.kind).toBe('reading'); expect(h.dialogs.project().panel).toBe('none');
    h.retry('failure'); const game = h.game(); held.resolve(response({ summary: originalSlot, snapshot: originalSaved }, originalSlot.etag));
    await vi.waitFor(() => expect(h.coordinator.state.kind).toBe('slot'));
    expect(h.dialogs.project().panel).toBe('none'); expect(h.dialogs.project().message).toBe(''); expect(h.coordinator.captureView()).toBe(coordinatorView);
    expect(h.state().runtime.persistence.knownSlot).toEqual(originalSlot); expect(h.state().runtime.persistence.autosaveEnabled).toBe(true);
    await h.dialogs.act('confirm-load'); expect(h.game()).toBe(game); expect(h.restored).not.toHaveBeenCalled(); expect(h.writes).toHaveLength(0);
    expect(h.move('R10').status).toBe('handled'); h.autosave.observe(); await vi.waitFor(() => expect(h.writes).toHaveLength(1)); h.dispose();
  });
  it('an already displayed Restore confirmation is retired by Retry without pausing future autosave', async () => {
    const h = await setup({ enabled: true }); h.terminal('failure'); h.recovery.request(h.recovery.capture('restore')!);
    await vi.waitFor(() => expect(h.dialogs.project().panel).toBe('confirm-load'));
    h.retry('failure'); const game = h.game(); expect(h.dialogs.project().panel).toBe('none');
    await h.dialogs.act('confirm-load'); expect(h.game()).toBe(game); expect(h.restored).not.toHaveBeenCalled();
    expect(h.move('R10').status).toBe('handled'); h.autosave.observe(); await vi.waitFor(() => expect(h.writes).toHaveLength(1)); h.dispose();
  });
  it('retiring a review preserves an explicitly active provider flow without claiming its success', async () => {
    const h = await setup({ guest: true }); h.terminal('failure'); h.recovery.request(h.recovery.capture('sign-in-to-restore')!);
    await h.dialogs.signIn('github'); const signing = h.state().runtime.auth, calls = h.requests.length;
    h.retry('failure'); expect(h.state().runtime.auth).toBe(signing); expect(h.state().runtime.auth.status).toBe('authenticating');
    expect(h.dialogs.project().panel).toBe('signin'); expect(h.requests).toHaveLength(calls);
    h.setSession(h.authenticated()); await h.dialogs.act('check-session'); await vi.waitFor(() => expect(h.dialogs.project().panel).toBe('choice'));
    expect(h.state().runtime.auth.status).toBe('authenticated'); expect(h.restored).not.toHaveBeenCalled(); expect(h.writes).toHaveLength(0); h.dispose();
  });
});
