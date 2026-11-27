// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createRiftHazardController } from '../../src/state/rift-hazard';
import { captureEncounterContext } from '../../src/state/encounter';
import type { ReducerState } from '../../src/state/reducer';
import type { ContentRegistry } from '../../src/content/registry';
import { validateEndingsContent } from '../../src/content/endings';
import endings from '../../content/spec001/endings.json';
import { fixture as repairFixture, q, registry } from './repair-plan-fixture';
const validated = validateEndingsContent(endings); if (!validated.ok) throw new Error(validated.issues.join(';'));
const content = validated.value;
function fixture(source: ContentRegistry = registry) {
  const f = repairFixture(); f.replace({ ...f.state(), runtime: { ...f.state().runtime, activity: { kind: 'safe-preparation' } } });
  const observed: ReducerState[] = [];
  const store = { getState: f.state, compareAndSet(before: ReducerState, next: ReducerState) { if (f.state() !== before) return false; f.replace(next); observed.push(next); return true; } };
  const hazards = createRiftHazardController({ registry: source, content });
  const prepare = (warningAcknowledged: unknown = true, hazardId = content.hazard.id) => hazards.prepare(f.state(), captureEncounterContext(f.state())!, { hazardId, warningAcknowledged } as { hazardId: string; warningAcknowledged: boolean });
  return { ...f, hazards, store, observed, prepare };
}
describe('T085 reviewed fictional ledge hazard, not a networking verdict', () => {
  it('prepares privately then installs terminal activity and exact preparation in one CAS with no game/persistence award', () => {
    const f = fixture(), before = f.state(), prepared = f.prepare(); if (!prepared.ok) throw new Error(prepared.reason);
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
    expect(f.hazards.commit(f.store, prepared.change).ok).toBe(true); const next = f.state();
    expect(f.observed).toEqual([next]); expect(next.runtime.activity?.kind).toBe('terminal-failure');
    expect(next.runtime.game).toBe(before.runtime.game); expect(next.runtime.persistence).toBe(before.runtime.persistence);
    expect(next.runtime.checkpoint?.world).toEqual(before.runtime.game!.world); expect(next.runtime.checkpoint?.world).not.toBe(before.runtime.game!.world);
    expect(next.runtime.game!.world.completedObjectiveIds).not.toContain(q('O11')); expect(next.runtime.game!.world.completedObjectiveIds).not.toContain(q('O12'));
    expect(next.runtime.game!.outcomeHistory).toEqual([]); expect(f.hazards.failure(next)?.id).toBe(content.hazard.id);
    expect(f.hazards.commit(f.store, prepared.change).ok).toBe(false); expect(f.prepare().ok).toBe(false);
  });
  it.each([false, 1, 'true', null, undefined])('refuses non-explicit acknowledgement %s without mutation', value => {
    const f = fixture(), before = f.state();
    expect(f.hazards.prepare(before, captureEncounterContext(before)!, { hazardId: content.hazard.id, warningAcknowledged: value } as never).ok).toBe(false);
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('requires exact reviewed content, version and real local prop placements', () => {
    for (const source of [
      { ...registry, has: (kind: string, id: string) => id !== q('PR107') && registry.has(kind, id) },
      { ...registry, record: (id: string) => { const record = registry.record(id); return id === q('R11') && record?.kind === 'room' ? { ...record, propInstances: record.propInstances.filter(p => p.propId !== q('PR101')) } : record; } },
      { ...registry, record: (id: string) => { const record = registry.record(id); return id === q('R11') && record ? { ...record, contentVersion: '2.0.0' } : record; } },
    ] as ContentRegistry[]) { const f = fixture(source); expect(f.hazards.offer(f.state())).toBeNull(); expect(f.prepare().ok).toBe(false); }
    const f = fixture(), wrong = createRiftHazardController({ registry, content: { ...content, hazard: { ...content.hazard, warning: 'No actual warning' } } as unknown as typeof content });
    expect(wrong.offer(f.state())).toBeNull();
    expect(wrong.prepare(f.state(), captureEncounterContext(f.state())!, { hazardId: content.hazard.id, warningAcknowledged: true }).ok).toBe(false);
  });
  it('refuses wrong hazard, wrong room, nonpreparation and already executed worlds', () => {
    const f = fixture(); expect(f.prepare(true, 'spec001:HAZARD-other' as typeof content.hazard.id).ok).toBe(false);
    f.prepare(); f.prepare(); expect(f.observed).toEqual([]);
    const before = f.state();
    for (const state of [{ ...before, runtime: { ...before.runtime, activity: { kind: 'stable-exploration' as const } } },
      { ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, roomId: q<'room'>('R10') } } } }]) {
      f.replace(state); expect(f.prepare().ok).toBe(false);
    }
    f.replace(before); f.prepare(); f.choose('plan-copper-section'); f.choose('duration-permanent'); f.choose('read-plan'); f.review(); f.execute(); expect(f.prepare().ok).toBe(false);
  });
  it('stale context and final lost CAS install neither failure nor checkpoint', () => {
    const f = fixture(), before = f.state(), context = captureEncounterContext(before)!;
    f.replace(structuredClone(before)); expect(f.hazards.prepare(f.state(), context, { hazardId: content.hazard.id, warningAcknowledged: true }).ok).toBe(false);
    f.replace(before); const prepared = f.prepare(); if (!prepared.ok) throw new Error(prepared.reason);
    expect(f.hazards.commit({ getState: f.state, compareAndSet: () => false }, prepared.change).ok).toBe(false);
    expect(f.state()).toBe(before); expect(f.observed).toEqual([]);
  });
  it('receipt survives harmless container updates but never restored clones, another checkpoint or another phase', () => {
    const f = fixture(), prepared = f.prepare(); if (!prepared.ok) throw new Error(prepared.reason);
    f.hazards.commit(f.store, prepared.change); const ended = f.state();
    const harmless = { ...ended, runtime: { ...ended.runtime, auth: { ...ended.runtime.auth }, ui: { ...ended.runtime.ui! }, persistence: { ...ended.runtime.persistence } } };
    expect(f.hazards.failure(harmless)?.id).toBe(content.hazard.id);
    expect(f.hazards.failure(structuredClone(ended))).toBeNull();
    expect(f.hazards.failure({ ...ended, runtime: { ...ended.runtime, activity: { kind: 'safe-preparation' } } })).toBeNull();
    expect(f.hazards.failure({ ...ended, runtime: { ...ended.runtime, checkpoint: structuredClone(ended.runtime.checkpoint) } })).toBeNull();
  });
});
