// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { createRoomAdapter, type PreparedRoom, type RoomRenderRequest, type RoomView } from '../../src/presentation/room-adapter';
import { createResourcePool } from '../../src/presentation/resource-pool';
import { createActionBus, type ActionCapture, type ActionContext } from '../../src/ui/action-bus';
import type { AdventureId, AttemptId, ConfigurationRevision, RoomId } from '../../src/domain/types';
import type { AppShellView } from '../../src/ui/app-shell';
import { MEDIA_LOAD_TIMEOUT_MS } from '../../src/presentation/recovery';

const context: ActionContext = { adventureId: 'adventure' as AdventureId, configurationRevision: 0 as ConfigurationRevision, attemptId: 'attempt' as AttemptId };
function view(title = 'Test room'): RoomView {
  return { roomId: 'spec001:R01' as RoomId, context, title, description: 'Fixture only.', controls: [{ id: 'look', label: 'Look', action: { kind: 'select-verb', verb: 'look' } }],
    objects: [], evidence: [{ id: 'reading', label: 'Reading', text: 'Still available without art.', source: 'Test fixture', freshness: 'observation' }], captions: [] };
}
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };
function fixture(reuseView = false) {
  const bus = createActionBus({ getContext: () => context });
  const handler = vi.fn(() => ({ status: 'handled' as const })); bus.register('select-verb', handler);
  const render = vi.fn<(view: AppShellView | null, capture?: ActionCapture) => void>();
  const pool = createResourcePool<string>({ maxEntries: 3, maxInFlight: 1, maxPrefetch: 1, maxLeases: 6, maxBytes: 30 });
  const preparations: ReturnType<typeof deferred<PreparedRoom>>[] = [];
  const requests: RoomRenderRequest<string>[] = [];
  const prepare = vi.fn((request: RoomRenderRequest<string>) => { requests.push(request); const pending = deferred<PreparedRoom>(); preparations.push(pending); return pending.promise; });
  const adapter = createRoomAdapter({ pool, dispatcher: bus, onView: render, renderers: { three: { prepare, reuseView } } });
  const session = () => ({ attach: vi.fn(), setPaused: vi.fn(), dispose: vi.fn() });
  return { adapter, bus, handler, pool, render, preparations, requests, prepare, session };
}

describe('room presentation boundary', () => {
  it('expires a preparation once, keeps the latest semantic view and retires a late session after explicit retry', async () => {
    vi.useFakeTimers();
    const f = fixture(true);
    try {
      f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
      const old = f.requests[0]!, captured = old.capture('look');
      const load = deferred<{ value: string; bytes: number }>(), destroy = vi.fn();
      const lease = old.resources.acquire({ key: 'late', bytes: 10, load: () => load.promise, dispose: destroy });
      const refusal = expect(lease.ready).rejects.toThrow(/released/);
      await vi.advanceTimersByTimeAsync(MEDIA_LOAD_TIMEOUT_MS / 2);
      f.adapter.show(view('New observation'));
      await vi.advanceTimersByTimeAsync(MEDIA_LOAD_TIMEOUT_MS / 2);
      await refusal;
      expect(old.signal.aborted).toBe(true);
      expect(captured.dispatch().status).toBe('rejected');
      expect(f.adapter.status().reason).toBe('timed-out');
      f.adapter.show(view('Both observations'));
      expect(f.render.mock.lastCall?.[0]).toMatchObject({ title: 'Both observations', presentationStatus: expect.stringMatching(/timed out/) });
      expect(f.prepare).toHaveBeenCalledTimes(1);
      f.adapter.retry();
      const current = { ...f.session(), updateView: vi.fn() };
      f.preparations[1]!.resolve(current); await tick();
      const late = f.session(); f.preparations[0]!.resolve(late);
      load.resolve({ value: 'retired', bytes: 10 }); await tick();
      expect(current.attach).toHaveBeenCalledTimes(1);
      expect(late.attach).not.toHaveBeenCalled(); expect(late.dispose).toHaveBeenCalledTimes(1);
      expect(destroy).toHaveBeenCalledExactlyOnceWith('retired');
      expect(f.pool.stats()).toMatchObject({ inFlight: 0, leases: 0, entries: 0 });
      await vi.advanceTimersByTimeAsync(MEDIA_LOAD_TIMEOUT_MS);
      expect(f.adapter.status().kind).toBe('ready'); expect(f.handler).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { f.adapter.dispose(); f.bus.dispose(); f.pool.dispose(); vi.useRealTimers(); }
  });
  it('keeps one decode in flight through rapid same-room changes and attaches the latest view', async () => {
    const f = fixture(true); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    const request = f.requests[0]!;
    for (const title of ['Second', 'Third', 'Latest']) f.adapter.show(view(title));
    expect(f.prepare).toHaveBeenCalledTimes(1); expect(request.signal.aborted).toBe(false);
    const session = { ...f.session(), updateView: vi.fn() }; f.preparations[0]!.resolve(session); await tick();
    expect(session.updateView.mock.lastCall?.[0].title).toBe('Latest'); expect(session.attach).toHaveBeenCalledTimes(1);
    f.adapter.dispose(); f.bus.dispose(); f.pool.dispose();
  });
  it('refreshes reusable rooms without releasing media, cancels prior input and uses the new semantic controls', async () => {
    const f = fixture(); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    const updateView = vi.fn(), session = { ...f.session(), updateView };
    f.preparations[0]!.resolve(session); await tick();
    const request = f.requests[0]!, old = request.capture('look');
    f.adapter.show({ ...view(), controls: [{ id: 'talk', label: 'Talk', action: { kind: 'select-verb', verb: 'talk' } }] });
    expect(f.prepare).toHaveBeenCalledTimes(1); expect(request.signal.aborted).toBe(false); expect(updateView).toHaveBeenCalledTimes(1);
    expect(old.dispatch().status).toBe('rejected'); expect(() => request.capture('look')).toThrow();
    expect(request.capture('talk').dispatch().status).toBe('handled'); expect(f.handler).toHaveBeenCalledTimes(1);
    f.adapter.hide(); expect(session.dispose).toHaveBeenCalledTimes(1); expect(request.signal.aborted).toBe(true); expect(() => request.capture('talk')).toThrow();
    f.adapter.dispose(); f.bus.dispose(); f.pool.dispose();
  });

  it('exposes every semantic action/evidence before art and keeps them on missing renderer/failure', async () => {
    const f = fixture(); const snapshot = view(); f.adapter.show(snapshot, { mode: 'three', detail: 'default', reducedMotion: true });
    expect(f.render.mock.lastCall?.[0]).toMatchObject({ controls: snapshot.controls, evidence: snapshot.evidence, presentationStatus: expect.stringMatching(/loading/i) });
    expect(f.requests[0]?.settings.reducedMotion).toBe(true);
    f.preparations[0]?.reject(new Error('bad decode')); await tick();
    expect(f.adapter.status().kind).toBe('unavailable');
    expect(f.render.mock.lastCall?.[0]?.evidence).toEqual(snapshot.evidence);
    f.adapter.setMode('layered');
    expect(f.adapter.status()).toMatchObject({ kind: 'unavailable', reason: 'renderer-unavailable' });
    expect(f.handler).not.toHaveBeenCalled(); f.adapter.dispose(); f.bus.dispose(); f.pool.dispose();
  });
  it('never attaches an old room; cancels the same captured action and releases its resources', async () => {
    const f = fixture(); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    const old = f.requests[0]!; const intent = old.capture('look');
    const disposed = vi.fn(); const lease = old.resources.acquire({ key: 'old', bytes: 10, load: async () => ({ value: 'old', bytes: 10 }), dispose: disposed });
    await lease.ready;
    f.adapter.show(view('Replacement'), { mode: 'three', detail: 'low', reducedMotion: true });
    expect(old.signal.aborted).toBe(true); expect(intent.dispatch()).toMatchObject({ status: 'rejected' });
    expect(disposed).toHaveBeenCalledTimes(1);
    const stale = f.session(); f.preparations[0]?.resolve(stale); await tick();
    expect(stale.attach).not.toHaveBeenCalled(); expect(stale.dispose).toHaveBeenCalledTimes(1);
    const current = f.session(); f.preparations[1]?.resolve(current); await tick();
    expect(current.attach).toHaveBeenCalledTimes(1); expect(f.adapter.status().kind).toBe('ready');
    const active = f.requests[1]!.capture('look'); active.dispatch(); active.dispatch();
    expect(f.handler).toHaveBeenCalledTimes(1);
    f.adapter.dispose(); f.adapter.dispose(); expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(f.render.mock.lastCall?.[0]).toBeNull(); f.bus.dispose(); f.pool.dispose();
  });
  it('context loss cancels pending intent; retry reads the current view, text mode keeps actions', async () => {
    const f = fixture(); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    const current = f.session(); f.preparations[0]?.resolve(current); await tick();
    const pending = f.requests[0]!.capture('look'); f.requests[0]!.contextLost();
    expect(f.adapter.status()).toMatchObject({ kind: 'unavailable', reason: 'context-lost' });
    expect(pending.dispatch().status).toBe('rejected'); expect(current.dispose).toHaveBeenCalledTimes(1);
    f.adapter.retry(); expect(f.requests[1]?.view.title).toBe('Test room');
    f.adapter.setMode('text'); const late = f.session(); f.preparations[1]?.resolve(late); await tick();
    expect(late.attach).not.toHaveBeenCalled(); expect(f.adapter.status().kind).toBe('text');
    expect(f.render.mock.lastCall?.[0]?.controls).toHaveLength(1);
    f.adapter.dispose(); f.bus.dispose(); f.pool.dispose();
  });
  it('bounds abort-ignoring preparations and pauses existing/new sessions without any action', async () => {
    const f = fixture(); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    f.adapter.retry(); f.adapter.retry();
    expect(f.prepare).toHaveBeenCalledTimes(2); expect(f.adapter.status().reason).toBe('preparation-capacity');
    const old = f.session(); f.preparations[0]?.resolve(old); await tick();
    f.adapter.setPaused(true); f.adapter.retry();
    const current = f.session(); f.preparations[2]?.resolve(current); await tick();
    expect(current.setPaused).toHaveBeenCalledWith(true);
    f.adapter.setPaused(false); expect(current.setPaused).toHaveBeenLastCalledWith(false);
    expect(f.handler).not.toHaveBeenCalled(); f.adapter.dispose();
    const stale = f.session(); f.preparations[1]?.resolve(stale); await tick();
    expect(stale.dispose).toHaveBeenCalledTimes(1); f.bus.dispose(); f.pool.dispose();
  });
  it('copies view inputs and only exposes declared available semantic controls', async () => {
    const f = fixture(); const snapshot = view(); f.adapter.show(snapshot, { mode: 'three', detail: 'default', reducedMotion: false });
    expect(() => f.requests[0]!.capture('invented')).toThrow(/control/);
    expect(Object.isFrozen(f.requests[0]?.view.controls)).toBe(true);
    f.adapter.dispose(); const current = f.session(); f.preparations[0]?.resolve(current); await tick();
    expect(() => f.requests[0]!.capture('look')).toThrow(/inactive/); f.bus.dispose(); f.pool.dispose();
  });
  it('keeps the original bus scope across delayed status/retry after a same-version restore', async () => {
    const f = fixture(); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    const originalCapture = f.render.mock.lastCall?.[1];
    f.bus.invalidate();
    expect(f.requests[0]!.capture('look').dispatch()).toMatchObject({ status: 'rejected', reason: 'invalidated' });
    const first = f.session(); f.preparations[0]?.resolve(first); await tick();
    expect(f.render.mock.lastCall?.[1]).toBe(originalCapture);
    f.adapter.retry();
    expect(f.requests[1]!.capture('look').dispatch()).toMatchObject({ status: 'rejected', reason: 'invalidated' });
    f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    expect(f.requests[2]!.capture('look').dispatch().status).toBe('handled');
    f.adapter.dispose(); f.preparations[1]?.resolve(f.session()); f.preparations[2]?.resolve(f.session()); await tick();
    f.bus.dispose(); f.pool.dispose();
  });
  it('never attaches after a synchronous pause callback loses context or replaces the view', async () => {
    const f = fixture(); f.adapter.show(view(), { mode: 'three', detail: 'default', reducedMotion: false });
    const current = f.session(); current.setPaused.mockImplementation(() => f.requests[0]!.contextLost());
    f.preparations[0]?.resolve(current); await tick();
    expect(current.attach).not.toHaveBeenCalled(); expect(current.dispose).toHaveBeenCalledTimes(1);
    expect(f.adapter.status().reason).toBe('context-lost'); f.adapter.dispose(); f.bus.dispose(); f.pool.dispose();
  });
});
