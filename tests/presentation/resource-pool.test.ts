// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { createResourcePool, type ResourceSpec } from '../../src/presentation/resource-pool';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const limits = { maxEntries: 3, maxInFlight: 1, maxPrefetch: 1, maxBytes: 30, maxLeases: 6 };
function resource(key: string, bytes = 10) {
  const pending = deferred<{ value: string; bytes: number }>();
  const load = vi.fn((_signal: AbortSignal) => pending.promise);
  const dispose = vi.fn();
  const spec: ResourceSpec<string> = { key, bytes, load, dispose };
  return { spec, pending, load, dispose };
}
const tick = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('bounded resource ownership', () => {
  it('deduplicates shared loads and disposes only after the last lease releases', async () => {
    const pool = createResourcePool<string>(limits);
    const r = resource('shared');
    const a = pool.acquire(r.spec), b = pool.acquire(r.spec);
    expect(r.load).toHaveBeenCalledTimes(1);
    r.pending.resolve({ value: 'texture', bytes: 10 });
    expect(await a.ready).toBe('texture'); expect(await b.ready).toBe('texture');
    a.release(); pool.trim(); expect(r.dispose).not.toHaveBeenCalled();
    b.release(); pool.trim(); pool.dispose();
    expect(r.dispose).toHaveBeenCalledExactlyOnceWith('texture');
    expect(pool.stats()).toMatchObject({ entries: 0, leases: 0, residentBytes: 0 });
  });
  it('bounds queued work, in-flight loads, prefetch, leases and reserved bytes', async () => {
    const pool = createResourcePool<string>(limits);
    const a = resource('a'), b = resource('b'), c = resource('c');
    const la = pool.acquire(a.spec), lb = pool.acquire(b.spec, { purpose: 'prefetch' });
    expect(() => pool.acquire(c.spec, { purpose: 'prefetch' })).toThrow(/prefetch/);
    const lc = pool.acquire(c.spec);
    expect(b.load).not.toHaveBeenCalled(); expect(c.load).not.toHaveBeenCalled();
    expect(pool.stats()).toMatchObject({ inFlight: 1, queued: 2, reservedBytes: 30 });
    expect(() => pool.acquire(resource('d').spec)).toThrow(/capacity/);
    a.pending.resolve({ value: 'a', bytes: 10 }); await la.ready; await tick();
    expect(c.load).toHaveBeenCalledTimes(1); // foreground precedes speculative work
    lc.release(); c.pending.resolve({ value: 'c', bytes: 10 }); await tick();
    expect(b.load).toHaveBeenCalledTimes(1);
    lb.release(); b.pending.reject(new Error('aborted')); la.release(); pool.dispose(); await tick();
    expect(pool.stats()).toMatchObject({ entries: 0, inFlight: 0, leases: 0 });
  });
  it('keeps canceled in-flight reservations until an ignoring loader settles', async () => {
    const pool = createResourcePool<string>({ ...limits, maxEntries: 1 });
    const r = resource('old'); const lease = pool.acquire(r.spec);
    const rejected = expect(lease.ready).rejects.toMatchObject({ code: 'released' });
    lease.release(); await rejected;
    expect(r.load.mock.calls[0]?.[0].aborted).toBe(true);
    expect(() => pool.acquire(resource('new').spec)).toThrow(/capacity/);
    pool.dispose(); expect(pool.stats()).toMatchObject({ entries: 1, inFlight: 1, reservedBytes: 10 });
    r.pending.resolve({ value: 'late', bytes: 10 }); await tick();
    expect(r.dispose).toHaveBeenCalledExactlyOnceWith('late');
    expect(pool.stats()).toMatchObject({ entries: 0, inFlight: 0, disposed: true });
  });
  it('aborts one owner without canceling a shared load and removes abort listeners', async () => {
    const pool = createResourcePool<string>(limits); const r = resource('shared');
    const abort = new AbortController(); const remove = vi.spyOn(abort.signal, 'removeEventListener');
    const a = pool.acquire(r.spec, { signal: abort.signal }), b = pool.acquire(r.spec);
    const rejected = expect(a.ready).rejects.toMatchObject({ code: 'released' });
    abort.abort(); await rejected;
    expect(r.load.mock.calls[0]?.[0].aborted).toBe(false); expect(remove).toHaveBeenCalledTimes(1);
    r.pending.resolve({ value: 'shared', bytes: 10 }); await b.ready;
    b.release(); pool.dispose();
  });
  it('recovers after rejection and rejects decoded resources above their reservation', async () => {
    const pool = createResourcePool<string>(limits); const r = resource('bad');
    const first = pool.acquire(r.spec); const failed = expect(first.ready).rejects.toThrow('decode failed');
    r.pending.reject(new Error('decode failed')); await failed; await tick();
    expect(pool.stats().leases).toBe(0);
    const retry = resource('bad'); const second = pool.acquire(retry.spec);
    const oversized = expect(second.ready).rejects.toMatchObject({ code: 'size' });
    retry.pending.resolve({ value: 'oversized', bytes: 11 }); await oversized; await tick();
    expect(retry.dispose).toHaveBeenCalledExactlyOnceWith('oversized');
    expect(pool.stats().reservedBytes).toBe(0); pool.dispose();
  });
  it('evicts unused LRU entries but never owned entries or mismatched resource identities', async () => {
    const pool = createResourcePool<string>({ ...limits, maxEntries: 1 }); const a = resource('a');
    const lease = pool.acquire(a.spec); a.pending.resolve({ value: 'a', bytes: 10 }); await lease.ready;
    expect(() => pool.acquire(resource('a').spec)).toThrow(/identity/);
    expect(() => pool.acquire(resource('b').spec)).toThrow(/capacity/);
    lease.release(); const b = resource('b'); const next = pool.acquire(b.spec);
    expect(a.dispose).toHaveBeenCalledTimes(1);
    next.release(); b.pending.resolve({ value: 'b', bytes: 10 }); await tick(); pool.dispose();
  });
  it('bounds duplicate leases and reports disposal failures while continuing cleanup', async () => {
    const pool = createResourcePool<string>({ ...limits, maxLeases: 1 }); const a = resource('a');
    a.dispose.mockImplementation(() => { throw new Error('GPU disposal failed'); });
    const lease = pool.acquire(a.spec);
    expect(() => pool.acquire(a.spec)).toThrow(/lease/);
    a.pending.resolve({ value: 'a', bytes: 10 }); await lease.ready; pool.dispose(); pool.dispose();
    expect(a.dispose).toHaveBeenCalledTimes(1); expect(pool.stats().disposalErrors).toBe(1);
    expect(() => pool.acquire(a.spec)).toThrow(/disposed/);
  });
});
