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
async function setup({ guest = false, enabled = false, initialRevision = 4, otherSavedAdventure = false } = {}) {
  const f = fixture(), policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
  const reader = new SaveReader({ currentContentVersion: policy.contentVersion, readPolicies: [policy], migrations: [] });
  const initial = startIntroduction(createIntroductionRuntime(), registry), checked = validator.validateRuntime(initial);
  if (!checked.ok) throw new Error(checked.code);
  let saved: SaveSnapshotV1 = { ...checked.candidate, adventureId: f.game().adventureId,
    notebook: { ...checked.candidate.notebook, personalNotes: 'Only the confirmed saved notes' } };
  if (otherSavedAdventure) saved = { ...saved, adventureId: uuid(803) as unknown as typeof saved.adventureId,
    world: { ...saved.world, attemptId: uuid(802) as unknown as typeof saved.world.attemptId, configurationRevision: 2 as typeof saved.world.configurationRevision } };
  let slot = summary(saved, initialRevision);
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
  return { ...f, api, account, coordinator, validator, autosave, recovery, dialogs, writes, requests, port, restored, terminal, retry, acknowledge,
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
  it('a replayed older receipt after E03 Continue requires reconciliation and leaves current learning unsaved', async () => {
    const h = await setup();
    try {
      h.setWrite(async () => { throw new Error('controlled lost response'); });
      expect((await h.coordinator.save('manual')).ok).toBe(false);
      const prior = h.writes[0]!, generation = h.state().runtime.persistence.dirtyGeneration;
      h.terminal('shutdown');
      h.retry('shutdown');
      const game = h.game(), dirty = h.state().runtime.persistence.dirtyGeneration;
      expect(game.outcomeHistory.at(-1)?.outcome).toBe('E03');
      expect(game.notebook.personalNotes).toBe('New clue during this attempt');
      expect(dirty).toBeGreaterThan(generation);
      const newer = summary(h.saved, h.slot.revision + 2);
      h.setWrite(async init => response({
        requestId: new Headers(init.headers).get('Idempotency-Key'), committedRevision: newer.revision - 1,
        committedAt: stamp, replayed: true, currentSummary: newer,
      }, newer.etag));
      expect(await h.coordinator.retryPending()).toMatchObject({ ok: true, current: false });
      expect(h.writes[1]!.body).toBe(prior.body);
      expect(new Headers(h.writes[1]!.headers).get('Idempotency-Key')).toBe(new Headers(prior.headers).get('Idempotency-Key'));
      expect(h.state().runtime.persistence).toMatchObject({ status: 'conflict', dirtyGeneration: dirty,
        lastAcknowledgedGeneration: generation, knownSlot: newer, pendingRequest: null });
      expect(h.game()).toBe(game);
      expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
      expect(h.writes).toHaveLength(2);
    } finally { h.dispose(); }
  });
  it('a rejected conditional save after Retry keeps retained learning in memory', async () => {
    const h = await setup({ initialRevision: 12 });
    try {
      h.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Learned before failure' } });
      h.terminal('failure');
      h.retry('failure');
      const game = h.game(), previous = h.saved, newer = summary(previous, h.slot.revision + 1);
      expect(game.notebook.personalNotes).toBe('Learned before failure');
      expect(newer.revision).toBe(13);
      h.setWrite(async init => new Response(JSON.stringify({ code: 'save-conflict', message: 'Current slot changed',
        requestId: new Headers(init.headers).get('Idempotency-Key'), currentSummary: newer }), { status: 412,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } }));
      expect((await h.coordinator.save('manual')).ok).toBe(false);
      expect(h.coordinator.state).toMatchObject({ kind: 'conflict', currentSummary: newer });
      expect(h.game()).toBe(game);
      expect(h.saved).toBe(previous);
      expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
      expect(h.writes).toHaveLength(1);
      expect(new Headers(h.writes[0]!.headers).get('If-Match')).toBe('"save-12"');
    } finally { h.dispose(); }
  });
  it.each(['network', 'invalid'] as const)('failed %s Restore preserves shutdown learning and the confirmed save', async fault => {
    const h = await setup({ initialRevision: 12 });
    try {
      h.terminal('shutdown');
      h.retry('shutdown');
      h.terminal('failure');
      h.retry('failure');
      expect(h.state().runtime.activity?.kind).toBe('safe-preparation');
      const before = h.game(), checkpoint = h.state().runtime.checkpoint, slot = h.slot, auth = h.state().runtime.auth;
      expect(before.assistance.length).toBeGreaterThan(0);
      expect(before.outcomeHistory.at(-1)?.outcome).toBe('E03');
      expect(before.notebook.personalNotes).toBe('New clue during this attempt');
      h.setRead(async () => {
        if (fault === 'network') throw new Error('controlled network loss');
        return response({ summary: slot, snapshot: { ...h.saved, notebook: null } }, slot.etag);
      });
      await h.dialogs.continue();
      expect(h.dialogs.project().message).toMatch(/could not|not ready/i);
      expect(h.dialogs.project().panel).not.toBe('confirm-load');
      expect(h.game()).toBe(before);
      expect(h.state().runtime.checkpoint).toBe(checkpoint);
      expect(h.state().runtime.auth).toBe(auth);
      expect(h.restored).not.toHaveBeenCalled();
      expect(h.writes).toHaveLength(0);
      expect(h.slot).toBe(slot);
    } finally { h.dispose(); }
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

describe('T082 safe save restrictions with a confirmed revision-12 slot', () => {
  it.each(['terminal-failure', 'shutdown', 'room-transition', 'active-encounter', 'dialogue-transaction', 'cutscene'] as const)(
    '%s rejects manual save and cancels the outstanding automatic arrival', async activity => {
      vi.useFakeTimers();
      const h = await setup({ enabled: true, initialRevision: 12 });
      try {
        expect(h.move('R10').status).toBe('handled'); h.autosave.observe();
        expect(h.move('R11').status).toBe('handled'); h.autosave.observe();
        expect(h.autosave.state.queued).toBe(true);
        const slot = h.slot, saved = h.saved;
        if (activity === 'terminal-failure' || activity === 'shutdown') {
          h.terminal(activity === 'shutdown' ? 'shutdown' : 'failure');
        } else if (activity === 'room-transition' || activity === 'dialogue-transaction') {
          const started = h.send({ kind: 'begin', activity, evaluation: { status: 'correct',
            reasonCode: 'begin-transaction', observations: [], acceptedEffects: [] } });
          expect(started.status).not.toBe('rejected');
          expect(h.state().control.pending).not.toBeNull();
        } else {
          h.prepare();
          h.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'reviewed-preparation', observations: [], acceptedEffects: [] },
            destination: { roomId: q('R11'), safePositionId: q('R11.preparation'), activity: 'safe-preparation' } });
          expect(h.execute().result.status).toBe('handled');
          if (activity === 'cutscene') {
            h.prove();
            const controller = createOutcomeController({ registry, repairScenario: h.resolver });
            const result = controller.prepareClassification(h.state(), captureOutcomeContext(h.state())!, { actionId: 'cutscene-save' as ActionId,
              eventId: uuid(96) as unknown as OutcomeEventId, operation: { kind: 'classify', selection: 'permanent', linkId: uuid(2), endpointId: uuid(3) } });
            if (!result.ok) throw new Error(result.reason);
            expect(controller.commit(h.store, result.change).ok).toBe(true);
          }
        }
        expect(h.state().runtime.activity?.kind).toBe(activity);
        h.autosave.observe();
        const game = h.game();
        await h.dialogs.save();
        expect(h.dialogs.project().message).toContain('Finish the current activity before saving');
        await vi.advanceTimersByTimeAsync(1000);
        expect(h.autosave.state.queued).toBe(false);
        expect(h.writes).toHaveLength(0);
        expect(h.slot).toBe(slot);
        expect(h.slot.revision).toBe(12);
        expect(h.saved).toBe(saved);
        expect(h.game()).toBe(game);
      } finally { h.dispose(); }
    });
  it('an earlier in-flight PUT excludes a second manual or queued automatic write', async () => {
    vi.useFakeTimers();
    const h = await setup({ enabled: true, initialRevision: 12 }), held = deferred<Response>();
    try {
      expect(h.move('R10').status).toBe('handled'); h.autosave.observe();
      expect(h.move('R11').status).toBe('handled'); h.autosave.observe();
      expect(h.autosave.state.queued).toBe(true);
      const saved = h.saved;
      h.setWrite(() => held.promise);
      const validate = vi.spyOn(h.validator, 'validateRuntime');
      const earlier = h.coordinator.save('manual');
      expect(h.writes).toHaveLength(1); expect(validate).toHaveBeenCalledTimes(1);
      await h.dialogs.save();
      expect(h.dialogs.project().message).toContain('previous save outcome');
      await vi.advanceTimersByTimeAsync(1000);
      expect(h.writes).toHaveLength(1);
      expect(h.slot.revision).toBe(12);
      expect(h.saved).toBe(saved); expect(validate).toHaveBeenCalledTimes(1);
      held.resolve(h.acknowledge(h.writes[0]!));
      expect((await earlier).ok).toBe(true);
      expect(h.writes).toHaveLength(1);
    } finally { h.dispose(); }
  });
});

describe('T083 Restore after retaining an entire changed journal', () => {
  it('cancel keeps the retried journal; confirm discards each unsaved collection and never writes the slot', async () => {
    const h = await setup({ initialRevision: 12, otherSavedAdventure: true });
    try {
      h.terminal('shutdown'); h.retry('shutdown');
      const current = h.state(), game = h.game();
      h.replace({ ...current, runtime: { ...current.runtime, game: { ...game, notebook: { ...game.notebook,
        hypotheses: [{ id: uuid(801) as never, text: 'Compare the recovered connector.', subjectIds: [q('R02'), q('PR012')], status: 'open' }] } } } });
      h.terminal('failure'); h.retry('failure');
      const kept = h.game(), checkpoint = h.state().runtime.checkpoint, saved = h.saved, auth = h.state().runtime.auth;
      expect(kept.adventureId).not.toBe(saved.adventureId);
      expect(kept.world.attemptId).not.toBe(saved.world.attemptId);
      expect(saved.world.configurationRevision).toBe(2);
      for (const field of ['factIds', 'mapRoomIds', 'personalNotes', 'hypotheses', 'measurements'] as const) {
        expect(kept.notebook[field].length).toBeGreaterThan(0);
        expect(kept.notebook[field]).not.toEqual(saved.notebook[field]);
      }
      expect(kept.assistance.length).toBeGreaterThan(0);
      expect(kept.outcomeHistory.length).toBeGreaterThan(0);
      expect(kept.assistance).not.toEqual(saved.assistance);
      expect(kept.outcomeHistory).not.toEqual(saved.outcomeHistory);
      await h.dialogs.continue();
      expect(h.dialogs.project().panel).toBe('confirm-load');
      h.dialogs.cancel();
      expect(h.game()).toBe(kept);
      expect(h.state().runtime.auth).toBe(auth);
      expect(h.state().runtime.checkpoint).toBe(checkpoint);
      await h.dialogs.continue(); await h.dialogs.act('confirm-load');
      expect(h.game().world).toEqual(saved.world);
      expect(h.game().notebook).toEqual(saved.notebook);
      expect(h.game().assistance).toEqual(saved.assistance);
      expect(h.game().outcomeHistory).toEqual(saved.outcomeHistory);
      expect(h.game().adventureId).toBe(saved.adventureId);
      expect(h.state().runtime.checkpoint).toBeNull();
      expect(h.saved).toBe(saved); expect(h.slot.revision).toBe(12); expect(h.writes).toHaveLength(0);
    } finally { h.dispose(); }
  });
});

describe('T083 ordinary save boundaries following encounter recovery', () => {
  it.each(['manual', 'automatic', 'disabled'] as const)('%s after E03 Continue preserves one-slot consent and retained learning', async mode => {
    vi.useFakeTimers();
    const h = await setup({ enabled: mode === 'automatic', initialRevision: 12 });
    try {
      const old = h.saved;
      h.terminal('shutdown');
      const ended = h.state();
      h.replace({ ...ended, control: { ...ended.control, highestRevision: 15 } });
      // Bind semantic attempt-b to a known unique ID; the real controller still checks it against all provenance.
      const nextAttempt = '00000000-0000-4000-8000-000000001602';
      const allocation = vi.spyOn(crypto, 'randomUUID')
        .mockReturnValueOnce('00000000-0000-4000-8000-000000001601').mockReturnValueOnce(nextAttempt);
      try { h.retry('shutdown'); } finally { allocation.mockRestore(); }
      const retried = h.game();
      expect(retried.world.attemptId).toBe(nextAttempt);
      expect(retried.world.configurationRevision).toBe(16);
      expect(retried.outcomeHistory.at(-1)?.outcome).toBe('E03');
      expect(retried.notebook.personalNotes).toBe('New clue during this attempt');
      expect(retried.notebook.measurements.length).toBeGreaterThan(0);
      expect(retried.notebook.measurements.every(m => m.stale)).toBe(true);
      expect(h.writes).toHaveLength(0);
      if (mode === 'manual') {
        expect((await h.coordinator.save('manual')).ok).toBe(true);
      } else {
        expect(h.move('R10').status).toBe('handled'); h.autosave.observe();
        expect(h.move('R11').status).toBe('handled'); h.autosave.observe();
        await vi.advanceTimersByTimeAsync(1000);
      }
      if (mode === 'disabled') {
        expect(h.saved).toBe(old); expect(h.slot.revision).toBe(12);
        expect(h.writes).toHaveLength(0); expect(h.dialogs.project().status).toBe('Unsaved changes');
        return;
      }
      expect(h.writes).toHaveLength(1);
      expect(new Headers(h.writes[0]!.headers).get('If-Match')).toBe('"save-12"');
      expect(h.slot.revision).toBe(13);
      expect(h.saved.safeState).toBe('safe-preparation');
      expect(h.saved.world).toEqual(h.game().world);
      expect(h.saved.world.attemptId).toBe(retried.world.attemptId);
      expect(h.saved.notebook).toEqual(h.game().notebook);
      expect(h.saved.assistance).toEqual(retried.assistance);
      expect(h.saved.outcomeHistory).toEqual(retried.outcomeHistory);
      expect(h.saved).not.toHaveProperty('checkpoint');
    } finally { h.dispose(); }
  });
  it('Restore with equal adventure, attempt and revision invalidates an old captured gameplay action', async () => {
    const h = await setup({ initialRevision: 12 });
    try {
      h.terminal('failure'); h.retry('failure');
      expect((await h.coordinator.save('manual')).ok).toBe(true);
      const frozen = h.saved;
      h.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Unsaved in the original runtime' } });
      expect(h.game().adventureId).toBe(frozen.adventureId);
      expect(h.game().world.attemptId).toBe(frozen.world.attemptId);
      expect(h.game().world.configurationRevision).toBe(frozen.world.configurationRevision);
      const old = h.bus.capture({ kind: 'interact', verb: 'walk', targetId: q('R10'), itemId: null });
      await h.dialogs.continue(); await h.dialogs.act('confirm-load');
      const loaded = h.game();
      expect(loaded.world).toEqual(frozen.world);
      expect(loaded.notebook).toEqual(frozen.notebook);
      expect(h.bus.dispatch(old).status).toBe('rejected');
      expect(h.game()).toBe(loaded); expect(h.saved).toBe(frozen);
      expect(h.writes).toHaveLength(1);
    } finally { h.dispose(); }
  });
});

it('an independently acquired preparation measurement after Continue leaves retained readings stale and awards no outcome', async () => {
  const h = await setup({ guest: true });
  try {
    h.terminal('shutdown'); h.retry('shutdown');
    const old = h.game().notebook.measurements, events = h.game().outcomeHistory;
    expect(old.length).toBeGreaterThan(0);
    expect(old.every(m => m.stale)).toBe(true);
    h.choose('plan-copper-section'); h.choose('duration-permanent'); h.choose('read-plan');
    const version = h.game().world;
    expect(h.review(102).evaluation?.status).toBe('correct');
    const readings = h.game().notebook.measurements;
    expect(readings.filter(m => old.some(p => p.id === m.id))).toEqual(old);
    expect(readings.find(m => m.id === uuid(102))).toMatchObject({ stale: false, attemptId: version.attemptId,
      configurationRevision: version.configurationRevision });
    expect(h.game().outcomeHistory).toEqual(events);
    expect(h.writes).toHaveLength(0);
  } finally { h.dispose(); }
});

it('the exact earlier committed revision 12 cannot acknowledge Retry generation 21 when the slot is already 13', async () => {
  const h = await setup({ initialRevision: 11 });
  try {
    const state = h.state(), persistence = state.runtime.persistence;
    h.replace({ ...state, runtime: { ...state.runtime, persistence: { ...persistence,
      dirtyGeneration: 19 as typeof persistence.dirtyGeneration } } });
    h.setWrite(async () => { throw new Error('controlled lost receipt'); });
    expect((await h.coordinator.save('manual')).ok).toBe(false);
    const earlier = h.writes[0]!;
    h.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Learning after the earlier capture' } });
    h.terminal('failure'); h.retry('failure');
    const current = h.game(), slot = summary(h.saved, 13);
    expect(h.state().runtime.persistence.dirtyGeneration).toBe(21);
    expect(current.notebook.personalNotes).toBe('Learning after the earlier capture');
    h.setWrite(async init => response({ requestId: new Headers(init.headers).get('Idempotency-Key'),
      committedRevision: 12, committedAt: stamp, replayed: true, currentSummary: slot }, slot.etag));
    expect(await h.coordinator.retryPending()).toMatchObject({ ok: true, current: false });
    expect(h.writes[1]!.body).toBe(earlier.body);
    expect(new Headers(h.writes[1]!.headers).get('Idempotency-Key')).toBe(new Headers(earlier.headers).get('Idempotency-Key'));
    expect(h.state().runtime.persistence).toMatchObject({ dirtyGeneration: 21, lastAcknowledgedGeneration: 19,
      status: 'conflict', pendingRequest: null, knownSlot: { revision: 13 } });
    expect(h.game()).toBe(current);
    expect(await h.coordinator.save('automatic')).toMatchObject({ ok: false, reason: 'reconciliation-required' });
    expect(h.writes).toHaveLength(2);
  } finally { h.dispose(); }
});

it('a pending Restore after Retry exposes only the live world and retained journal until explicit discard', async () => {
  const h = await setup({ initialRevision: 12 }), held = deferred<Response>();
  try {
    h.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Keep during the delayed read' } });
    h.terminal('failure'); h.retry('failure');
    const game = h.game(), slot = h.slot, saved = h.saved, checkpoint = h.state().runtime.checkpoint;
    h.setRead(() => held.promise);
    const read = h.dialogs.continue();
    expect(h.coordinator.state.kind).toBe('reading');
    expect(h.game()).toBe(game); expect(h.state().runtime.checkpoint).toBe(checkpoint);
    expect(h.slot).toBe(slot); expect(h.slot.revision).toBe(12);
    expect(h.dialogs.project().panel).not.toBe('confirm-load'); expect(h.restored).not.toHaveBeenCalled();
    held.resolve(response({ summary: slot, snapshot: saved }, slot.etag)); await read;
    expect(h.dialogs.project().panel).toBe('confirm-load'); expect(h.game()).toBe(game);
    h.dialogs.cancel(); expect(h.game()).toBe(game); expect(h.saved).toBe(saved); expect(h.writes).toHaveLength(0);
  } finally { h.dispose(); }
});

it.each(['failure', 'shutdown'] as const)('rejected and canceled %s recovery dispatches cannot write the confirmed slot', async kind => {
  vi.useFakeTimers();
  const h = await setup({ enabled: true, initialRevision: 12 });
  try {
    h.move('R10'); h.autosave.observe(); h.move('R11'); h.autosave.observe();
    expect(h.autosave.state.queued).toBe(true);
    h.terminal(kind);
    const slot = h.slot, stored = h.saved, intent = kind === 'failure' ? 'retry' : 'continue';
    const captured = h.recovery.capture(intent)!;
    h.replace({ ...h.state() });
    expect(h.recovery.request(captured).ok).toBe(false);
    const before = h.state();
    expect(h.recovery.request(h.recovery.capture(intent)!).ok).toBe(true);
    const confirmation = h.recovery.project()!;
    expect(h.recovery.cancel(confirmation).ok).toBe(true);
    expect(h.recovery.confirm(confirmation).ok).toBe(false);
    expect(h.state()).toBe(before);
    await vi.advanceTimersByTimeAsync(1000);
    expect(h.writes).toHaveLength(0); expect(h.slot).toBe(slot); expect(h.saved).toBe(stored);
    h.retry(kind); await vi.advanceTimersByTimeAsync(1000);
    expect(h.writes).toHaveLength(0);
    expect((await h.coordinator.save('manual')).ok).toBe(true);
    expect(h.writes).toHaveLength(1); expect(h.slot.revision).toBe(13);
  } finally { h.dispose(); }
});
