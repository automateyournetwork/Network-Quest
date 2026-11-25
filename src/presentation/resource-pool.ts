// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

/** Immutable catalog entry. A key identifies one decoder/export/version, not just a URL. */
export interface ResourceSpec<T> {
  readonly key: string;
  /** Conservative decoded residency reservation; not compressed transfer size or GPU measurement. */
  readonly bytes: number;
  /** Rejecting loaders must dispose their own partially decoded intermediates. */
  readonly load: (signal: AbortSignal) => Promise<{ readonly value: T; readonly bytes: number }>;
  readonly dispose: (value: T) => void;
}
export interface ResourceLimits {
  readonly maxEntries: number;
  readonly maxInFlight: number;
  readonly maxPrefetch: number;
  readonly maxBytes: number;
  readonly maxLeases: number;
}
export interface LeaseOptions { readonly purpose?: 'current' | 'prefetch'; readonly signal?: AbortSignal }
export interface ResourceLease<T> {
  readonly key: string;
  /** Valid only while this lease remains owned; release invalidates access even after resolution. */
  readonly ready: Promise<T>;
  release(): void;
}
export interface ResourceStats {
  readonly entries: number; readonly inFlight: number; readonly queued: number;
  readonly leases: number; readonly prefetch: number; readonly reservedBytes: number;
  readonly residentBytes: number; readonly disposalErrors: number; readonly disposed: boolean;
}
export interface ResourcePool<T> {
  acquire(spec: ResourceSpec<T>, options?: LeaseOptions): ResourceLease<T>;
  /** Explicitly dispose unowned cache entries; owned/shared resources remain alive. */
  trim(): void;
  stats(): ResourceStats;
  dispose(): void;
}
export class ResourcePoolError extends Error {
  constructor(readonly code: 'capacity' | 'prefetch' | 'leases' | 'identity' | 'size' | 'released' | 'disposed', message: string) {
    super(message); this.name = 'ResourcePoolError';
  }
}

interface Owner<T> {
  readonly purpose: 'current' | 'prefetch';
  readonly resolve: (value: T) => void;
  readonly reject: (error: unknown) => void;
  removeAbort: () => void;
  active: boolean;
}
interface Entry<T> {
  readonly spec: ResourceSpec<T>;
  readonly abort: AbortController;
  readonly owners: Set<Owner<T>>;
  state: 'queued' | 'loading' | 'ready' | 'retired';
  resource: { readonly value: T; readonly bytes: number } | null;
  used: number;
}

export function createResourcePool<T>(input: ResourceLimits): ResourcePool<T> {
  const limits = Object.freeze({ ...input });
  for (const [name, value] of Object.entries(limits)) {
    if (!Number.isSafeInteger(value) || value < (name === 'maxPrefetch' ? 0 : 1)) throw new RangeError(`Invalid resource limit: ${name}`);
  }
  if (limits.maxInFlight > limits.maxEntries || limits.maxPrefetch > limits.maxLeases) throw new RangeError('Inconsistent resource limits');
  const catalog = new Map<string, Entry<T>>(), entries = new Set<Entry<T>>();
  let disposed = false, inFlight = 0, leases = 0, prefetch = 0, sequence = 0, disposalErrors = 0;
  const reserved = () => [...entries].reduce((sum, entry) => sum + entry.spec.bytes, 0);
  function destroy(entry: Entry<T>) {
    const resource = entry.resource;
    entry.resource = null; // mark before invoking foreign code; never dispose twice
    if (resource) try { entry.spec.dispose(resource.value); } catch { disposalErrors++; }
  }
  function remove(entry: Entry<T>) {
    if (catalog.get(entry.spec.key) === entry) catalog.delete(entry.spec.key);
    entries.delete(entry); destroy(entry);
  }
  function retire(entry: Entry<T>) {
    if (entry.state === 'retired') return;
    if (catalog.get(entry.spec.key) === entry) catalog.delete(entry.spec.key);
    const loading = entry.state === 'loading';
    entry.state = 'retired'; entry.abort.abort();
    // Ignoring abort does not free a concurrency/memory reservation prematurely.
    if (!loading) remove(entry);
  }
  function detach(entry: Entry<T>, owner: Owner<T>, error: unknown) {
    if (!owner.active) return;
    owner.active = false; owner.removeAbort(); entry.owners.delete(owner);
    leases--; if (owner.purpose === 'prefetch') prefetch--;
    owner.reject(error);
  }
  function fail(entry: Entry<T>, error: unknown) {
    for (const owner of [...entry.owners]) detach(entry, owner, error);
    remove(entry);
  }
  function start(entry: Entry<T>) {
    entry.state = 'loading'; inFlight++;
    let loading: Promise<{ readonly value: T; readonly bytes: number }>;
    try { loading = entry.spec.load(entry.abort.signal); } catch (error) { loading = Promise.reject(error); }
    void Promise.resolve(loading).then(resource => {
      entry.resource = resource;
      if (entry.state === 'retired' || disposed) { remove(entry); return; }
      if (!Number.isSafeInteger(resource.bytes) || resource.bytes < 0 || resource.bytes > entry.spec.bytes) {
        fail(entry, new ResourcePoolError('size', `Decoded resource exceeds residency reservation: ${entry.spec.key}`)); return;
      }
      entry.state = 'ready';
      for (const owner of entry.owners) owner.resolve(resource.value);
    }, error => fail(entry, error)).finally(() => { inFlight--; pump(); });
  }
  function pump() {
    if (disposed) return;
    while (inFlight < limits.maxInFlight) {
      const queue = [...entries].filter(entry => entry.state === 'queued');
      const next = queue.find(entry => [...entry.owners].some(owner => owner.purpose === 'current')) ?? queue[0];
      if (!next) return;
      start(next);
    }
  }
  function evictFor(bytes: number) {
    const unused = [...entries].filter(entry => entry.state === 'ready' && entry.owners.size === 0).sort((a, b) => a.used - b.used);
    while ((entries.size >= limits.maxEntries || reserved() + bytes > limits.maxBytes) && unused.length) {
      const entry = unused.shift(); if (entry) remove(entry);
    }
    if (entries.size >= limits.maxEntries || reserved() + bytes > limits.maxBytes) {
      throw new ResourcePoolError('capacity', 'Resource capacity reached; release ownership or retry after pending work settles');
    }
  }
  return {
    acquire(spec, options = {}) {
      if (disposed) throw new ResourcePoolError('disposed', 'Resource pool is disposed');
      if (options.signal?.aborted) throw new ResourcePoolError('released', 'Resource owner already aborted');
      if (!spec.key.trim() || !Number.isSafeInteger(spec.bytes) || spec.bytes < 0) throw new RangeError('Invalid resource key/residency reservation');
      const purpose = options.purpose ?? 'current';
      if (leases >= limits.maxLeases) throw new ResourcePoolError('leases', 'Resource lease limit reached');
      if (purpose === 'prefetch' && prefetch >= limits.maxPrefetch) throw new ResourcePoolError('prefetch', 'Resource prefetch limit reached');
      let entry = catalog.get(spec.key);
      if (entry && (entry.spec.load !== spec.load || entry.spec.dispose !== spec.dispose || entry.spec.bytes !== spec.bytes)) {
        throw new ResourcePoolError('identity', `Conflicting resource identity: ${spec.key}`);
      }
      if (!entry) {
        evictFor(spec.bytes);
        entry = { spec: Object.freeze({ ...spec }), abort: new AbortController(), owners: new Set(), state: 'queued', resource: null, used: ++sequence };
        catalog.set(spec.key, entry); entries.add(entry);
      }
      const target = entry;
      let resolve!: (value: T) => void, reject!: (error: unknown) => void;
      const ready = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
      // Releasing an unused speculative lease must not cause an unhandled rejection.
      void ready.catch(() => {});
      const owner: Owner<T> = { purpose, resolve, reject, removeAbort: () => {}, active: true };
      target.owners.add(owner); target.used = ++sequence; leases++; if (purpose === 'prefetch') prefetch++;
      function release() {
        detach(target, owner, new ResourcePoolError('released', 'Resource lease released'));
        if (target.owners.size === 0 && (target.state === 'queued' || target.state === 'loading')) retire(target);
        pump();
      }
      if (options.signal) {
        const signal = options.signal;
        signal.addEventListener('abort', release, { once: true });
        owner.removeAbort = () => signal.removeEventListener('abort', release);
      }
      if (target.resource) resolve(target.resource.value);
      pump();
      return Object.freeze({ key: spec.key, ready, release });
    },
    trim() { for (const entry of entries) if (entry.state === 'ready' && entry.owners.size === 0) remove(entry); },
    stats() {
      return Object.freeze({ entries: entries.size, inFlight, queued: [...entries].filter(entry => entry.state === 'queued').length,
        leases, prefetch, reservedBytes: reserved(), residentBytes: [...entries].reduce((sum, entry) => sum + (entry.resource?.bytes ?? 0), 0), disposalErrors, disposed });
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const entry of [...entries]) {
        for (const owner of [...entry.owners]) detach(entry, owner, new ResourcePoolError('disposed', 'Resource pool disposed'));
        retire(entry);
      }
    },
  };
}

/** Room/audio owner. Disposing an owner never disposes a still-shared resource. */
export function createResourceScope<T>(pool: ResourcePool<T>) {
  const abort = new AbortController();
  return Object.freeze({
    signal: abort.signal,
    acquire(spec: ResourceSpec<T>, purpose: 'current' | 'prefetch' = 'current') {
      return pool.acquire(spec, { purpose, signal: abort.signal });
    },
    dispose() { abort.abort(); pool.trim(); },
  });
}
export type ResourceScope<T> = ReturnType<typeof createResourceScope<T>>;
