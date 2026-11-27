// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../../src/content/registry';
import type { ActionId, OutcomeEventId } from '../../src/domain/types';
import { captureOutcomeContext, createOutcomeController, outcomeCaveats } from '../../src/state/outcomes';
import type { OutcomeCommand, OutcomePreparation } from '../../src/state/outcomes';
import type { RepairScenarioResolver } from '../../src/state/repair-plan';
import { SaveValidator } from '../../src/services/save-validator';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { fixture, q, registry, uuid } from './outcome-fixture';

// Read literal independent expectations. No result below supplies scenario data
// or computes an expected verdict from the implementation under test.
const oracle = JSON.parse(readFileSync(new URL('../fixtures/outcomes.json', import.meta.url), 'utf8')) as {
  cases: { id: string; expected: Record<string, unknown> }[];
};
const expected = (id: string) => {
  const row = oracle.cases.find(c => c.id === id); if (!row) throw new Error(`Missing oracle ${id}`); return row.expected;
};
const eventId = uuid(90) as unknown as OutcomeEventId;
const command = (selection: 'permanent' | 'temporary' | 'shutdown' = 'permanent'): OutcomeCommand => ({
  actionId: 'classify-outcome' as ActionId, eventId,
  operation: { kind: 'classify', selection, linkId: selection === 'shutdown' ? null : uuid(2), endpointId: selection === 'shutdown' ? null : uuid(3) },
});
function ready(route: 'copper' | 'fiber' | 'radio' = 'copper', selection: 'permanent' | 'temporary' | 'shutdown' = 'permanent',
  replace?: (base: RepairScenarioResolver) => RepairScenarioResolver) {
  const f = fixture(route, replace);
  f.prepare(selection === 'shutdown' ? 'shutdown' : `${route}-${route === 'copper' ? 'section' : 'A'}`, selection === 'shutdown' ? null : selection);
  if (selection === 'temporary') f.choose('record-maintenance');
  if (selection === 'shutdown') f.choose('record-isolation');
  expect(f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'enter-authored-preparation', observations: [], acceptedEffects: [] },
    destination: { roomId: q<'room'>('R11'), safePositionId: q<'safe-position'>('R11.preparation'), activity: 'safe-preparation' } }).status).not.toBe('rejected');
  expect(f.execute().evaluation?.status).toBe('correct');
  expect(f.state().runtime.activity?.kind).toBe('active-encounter');
  expect(f.state().runtime.checkpoint).not.toBeNull();
  if (selection === 'shutdown') { f.move('R12'); f.choose('read-classification'); } else f.prove();
  return f;
}
function harness(f: ReturnType<typeof fixture>, content: ContentRegistry = registry) {
  const controller = createOutcomeController({ registry: content, repairScenario: f.resolver });
  const store = { getState: f.state, compareAndSet: (before: ReturnType<typeof f.state>, next: ReturnType<typeof f.state>) => {
    if (f.state() !== before) return false; f.replace(next); return true;
  } };
  const prepare = (input = command()) => controller.prepareClassification(f.state(), captureOutcomeContext(f.state())!, input);
  const commit = (p: OutcomePreparation) => { if (!p.ok) throw new Error(JSON.stringify(p)); return controller.commit(store, p.change); };
  return { controller, store, prepare, commit };
}

describe('T086 active outcome classification — actual repair predicates and reducer', () => {
  it.each(['copper', 'fiber', 'radio'] as const)('%s reaches each outcome with only its required branch', route => {
    for (const [selection, code] of [['permanent', 'E01'], ['temporary', 'E02'], ['shutdown', 'E03']] as const) {
      const f = ready(route, selection), h = harness(f), before = f.state();
      const result = h.prepare(command(selection));
      expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result));
      expect(result.feedback.status).toBe(expected(`OUT-${code}-${route.toUpperCase()}`)['status']);
      expect(result.feedback.outcome).toBe(expected(`OUT-${code}-${route.toUpperCase()}`)['outcome']);
      expect(result.feedback.restoredService).toBe(expected(`OUT-${code}-${route.toUpperCase()}`)['awardedRestoredService']);
      expect(f.state()).toBe(before); // preparation cannot partly award O12/history
      expect(h.commit(result).ok).toBe(true);
      expect(f.game().outcomeHistory).toEqual([{ id: eventId, outcome: code, attemptId: before.runtime.game!.world.attemptId,
        route: selection === 'shutdown' ? before.runtime.game!.world.route : route,
        caveatIds: selection === 'temporary' ? [q('FACT-repair-maintenance')] : selection === 'shutdown' ? [q('FACT-repair-isolation')] : [] }]);
      expect(f.game().world.completedObjectiveIds).toContain(q('O12'));
      expect(f.game().world.continueOutcome).toBeNull();
      expect(f.state().runtime.activity?.kind).toBe(code === 'E03' ? 'shutdown' : 'cutscene');
      expect(f.game().world.inventory).toEqual(before.runtime.game!.world.inventory);
      expect(f.state().runtime.persistence.pendingRequest).toBe(before.runtime.persistence.pendingRequest);
      expect(f.state().runtime.persistence.knownSlot).toBe(before.runtime.persistence.knownSlot);
      expect(f.state().runtime.persistence.dirtyGeneration).toBe(before.runtime.persistence.dirtyGeneration + 1);
      expect(f.state().runtime.checkpoint).toBe(before.runtime.checkpoint);
      expect(f.state().runtime.checkpoint!.world.completedObjectiveIds).not.toContain(q('O11'));
      expect(f.state().runtime.checkpoint!.world.configurationRevision).toBeLessThan(f.game().world.configurationRevision);
    }
  });
  it.each([1, 2, 3] as const)('retains %i levels of assistance without changing any outcome', count => {
    for (const [selection, code] of [['permanent', 'E01'], ['temporary', 'E02'], ['shutdown', 'E03']] as const) {
      const f = ready('copper', selection);
      for (let n = 0; n < count; n++) expect(f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O12') } }).status).toBe('applied');
      const assistance = f.game().assistance;
      expect(assistance.map(hint => hint.level)).toEqual(expected(`OUT-${code}-HINT-${count}`)['retainedHintLevels']);
      const h = harness(f), p = h.prepare(command(selection)); expect(p.ok && p.feedback.outcome).toBe(expected(`OUT-${code}-HINT-${count}`)['outcome']);
      h.commit(p); expect(f.game().assistance).toEqual(assistance);
    }
  });
  it.each(['defect', 'temporary'] as const)('does not infer permanence from passing checks with %s still present', fault => {
    const f = ready('copper', 'permanent', base => (g, p) => { const s = base(g, p); return s && { ...s, deployment: { ...s.deployment,
      ...(fault === 'defect' ? { defectRemoved: false } : { temporaryDependency: true }) } }; });
    const h = harness(f), before = f.state(), result = h.prepare();
    expect(result).toMatchObject({ ok: false, reason: 'incorrect', feedback: { outcome: null,
      reasonCode: expected(fault === 'defect' ? 'OUT-PERMANENT-DEFECT-REMAINS' : 'OUT-TEMP-AS-PERMANENT')['reason'] } });
    expect(f.state()).toBe(before); expect(f.game().outcomeHistory).toEqual([]);
  });
  it('does not silently downgrade an incorrect permanent claim to temporary success', () => {
    const f = ready('copper', 'temporary'), h = harness(f); expect(h.prepare()).toMatchObject({ ok: false, feedback: { outcome: null, reasonCode: 'temporary-is-not-permanent' } });
    expect(f.game().outcomeHistory).toEqual([]); expect(h.prepare(command('temporary')).ok).toBe(true);
  });
  it.each(['physical', 'endpoint'] as const)('requires the separate fresh %s proof', missing => {
    for (const selection of ['permanent', 'temporary'] as const) {
      const f = ready('copper', selection), h = harness(f), cmd = command(selection);
      const p = h.prepare({ ...cmd, operation: { ...cmd.operation, [missing === 'physical' ? 'linkId' : 'endpointId']: null } });
      expect(p).toMatchObject({ ok: false, feedback: { status: expected(`OUT-${selection.toUpperCase()}-${missing.toUpperCase()}-MISSING`)['status'], outcome: null } });
    }
  });
  it.each(['physical', 'endpoint'] as const)('rejects each independent freshness corruption of %s evidence', kind => {
    for (const selection of ['permanent', 'temporary'] as const) for (const dimension of ['revision', 'attempt', 'flag'] as const) {
      const f = ready('copper', selection), s = f.state();
      f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), notebook: { ...f.game().notebook,
        measurements: f.game().notebook.measurements.map(m => m.id !== uuid(kind === 'physical' ? 2 : 3) ? m : { ...m,
          ...(dimension === 'revision' ? { configurationRevision: 0 as typeof m.configurationRevision } : dimension === 'attempt' ? { attemptId: uuid(99) as never } : { stale: true }) }) } } } });
      const h = harness(f), before = f.state();
      expect(h.prepare(command(selection))).toMatchObject({ ok: false, feedback: { outcome: null,
        reasonCode: expected(`OUT-${selection.toUpperCase()}-${kind.toUpperCase()}-STALE-${dimension.toUpperCase()}`)['reason'] } });
      expect(f.state()).toBe(before);
    }
  });
  it.each(['endpoint', 'pattern', 'conductor'] as const)('rechecks actual failed %s observations', fault => {
    const f = ready('copper', 'permanent', base => (g, p) => { const s = base(g, p); if (!s || g.world.roomId !== q('R12')) return s;
      return fault === 'endpoint' ? { ...s, endpointResponse: 'service-unavailable' } : fault === 'pattern' ? { ...s, receivedBits: '0100111001010000' }
        : { ...s, path: { kind: 'copper-path', compatible: true, lengths: [{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, false, true] } }; });
    const h = harness(f); expect(h.prepare()).toMatchObject({ ok: false, feedback: { status: 'incorrect', outcome: null, restoredService: false } });
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('keeps classification proof as historical evidence after the outcome advances the world revision', () => {
    const f = ready(), h = harness(f), readings = structuredClone(f.game().notebook.measurements);
    h.commit(h.prepare());
    expect(f.game().notebook.measurements).toEqual(readings.map(m => ({ ...m, stale: true })));
    expect(f.game().world.configurationRevision).toBeGreaterThan(readings[2]!.configurationRevision);
    expect(f.game().outcomeHistory[0]?.outcome).toBe('E01');
  });
  it('cannot classify shutdown from an accidental outage or missing execution', () => {
    const f = ready(), h = harness(f); expect(h.prepare(command('shutdown'))).toMatchObject({ ok: false, feedback: { outcome: null } });
    const missing = fixture(); missing.move('R12'); const hm = harness(missing);
    expect(hm.prepare()).toMatchObject({ ok: false }); expect(missing.game().outcomeHistory).toEqual([]);
  });
  it.each(['dependency', 'maintenance'] as const)('requires actual temporary %s at classification', absent => {
    const f = ready('copper', 'temporary', absent === 'dependency' ? base => (g, p) => {
      const s = base(g, p); return s && { ...s, deployment: { ...s.deployment, temporaryDependency: g.world.roomId !== q('R12') } };
    } : undefined);
    if (absent === 'maintenance') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(),
      notebook: { ...f.game().notebook, factIds: f.game().notebook.factIds.filter(id => id !== q('FACT-repair-maintenance')) } } } }); }
    const h = harness(f), before = f.state();
    expect(h.prepare(command('temporary'))).toMatchObject({ ok: false, feedback: { outcome: null, reasonCode: 'temporary-followup-missing' } });
    expect(f.state()).toBe(before);
  });
  it.each(['fault', 'deliberate', 'record'] as const)('requires a named unresolved fault, deliberate isolation and recovery record: %s', absent => {
    const f = ready('copper', 'shutdown', base => (g, p) => {
      const s = base(g, p); if (!s || g.world.roomId !== q('R12')) return s;
      return { ...s, deployment: { ...s.deployment, ...(absent === 'fault' ? { unresolvedDefectIdentified: false } : absent === 'deliberate' ? { deliberateIsolation: false } : {}) } };
    });
    if (absent === 'record') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(),
      notebook: { ...f.game().notebook, factIds: f.game().notebook.factIds.filter(id => id !== q('FACT-repair-isolation')) } } } }); }
    const h = harness(f); expect(h.prepare(command('shutdown'))).toMatchObject({ ok: false, feedback: { outcome: null, reasonCode: 'shutdown-not-deliberate' } });
  });
  it.each(['readings', 'conclusion', 'subjects', 'room'] as const)('requires exact canonical %s provenance instead of a passing-looking record', field => {
    const f = ready(), s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), notebook: { ...f.game().notebook,
      measurements: f.game().notebook.measurements.map(m => m.id !== uuid(2) ? m : { ...m,
        ...(field === 'readings' ? { readings: [] } : field === 'conclusion' ? { conclusionCode: 'correct' } : field === 'subjects' ? { subjectIds: [] } : { roomId: q<'room'>('R11') }) }) } } } });
    expect(harness(f).prepare()).toMatchObject({ ok: false, feedback: { outcome: null, reasonCode: 'measurement-provenance-mismatch' } });
  });
  it('rejects malformed authored scenario data without a learner failure event or mutation', () => {
    const f = ready(), h = harness(f), before = f.state();
    const bad = createOutcomeController({ registry, repairScenario: (g, p) => {
      const s = f.resolver(g, p); return s && { ...s, path: { kind: 'copper-path', compatible: true,
        lengths: [{ value: 95, unit: 'missing-unit' }], requiredConductors: [true, true, true, true] } as never };
    } });
    expect(bad.prepareClassification(before, captureOutcomeContext(before)!, command())).toMatchObject({ ok: false, reason: 'content-error' });
    expect(f.state()).toBe(before); expect(h.prepare().ok).toBe(true);
  });
});

describe('T086 opaque atomic state and authored Continue boundary', () => {
  it('rejects forged/equal-copy contexts and prepared tokens', () => {
    const f = ready(), h = harness(f), context = captureOutcomeContext(f.state())!;
    expect(h.controller.prepareClassification(f.state(), { ...context }, command())).toMatchObject({ ok: false, reason: 'stale-context' });
    const prepared = h.prepare(); if (!prepared.ok) throw new Error('prepare');
    expect(h.controller.commit(h.store, { ...prepared.change })).toMatchObject({ ok: false, reason: 'stale-context' });
    expect(f.game().outcomeHistory).toEqual([]);
  });
  it('rejects a replacement adventure with equal version and a CAS race without partial events', () => {
    const f = ready(), h = harness(f), before = f.state(), p = h.prepare(); if (!p.ok) throw new Error('prepare');
    f.replace(structuredClone(before)); expect(h.controller.commit(h.store, p.change).ok).toBe(false);
    f.replace(before); expect(h.controller.commit({ ...h.store, compareAndSet: () => false }, p.change).ok).toBe(false);
    expect(f.game().outcomeHistory).toEqual([]); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('discards interrupted preparation with no effect and accepts one entire result in one swap', () => {
    const f = ready(), h = harness(f), before = f.state(), p = h.prepare(); if (!p.ok) throw new Error('prepare');
    expect(f.state()).toBe(before); let swaps = 0;
    expect(h.controller.commit({ getState: f.state, compareAndSet: (old, next) => {
      expect(old).toBe(before); expect(next.runtime.game!.world.completedObjectiveIds).toContain(q('O12'));
      expect(next.runtime.game!.outcomeHistory).toHaveLength(1); expect(next.runtime.activity?.kind).toBe('cutscene');
      swaps++; f.replace(next); return true;
    } }, p.change).ok).toBe(true); expect(swaps).toBe(1);
  });
  it('cannot replay the event, attempt, or consumed prepared token', () => {
    const f = ready(), h = harness(f), p = h.prepare(); h.commit(p); const accepted = f.state();
    if (!p.ok) throw new Error('prepare'); expect(h.controller.commit(h.store, p.change).ok).toBe(false);
    expect(h.prepare().ok).toBe(false); expect(h.prepare({ ...command(), eventId: uuid(91) as unknown as OutcomeEventId }).ok).toBe(false);
    expect(f.state()).toBe(accepted); expect(f.game().outcomeHistory).toHaveLength(1);
  });
  it.each(['E01', 'E02'] as const)('%s becomes safe only when feedback closes at its authored anchor', code => {
    const f = ready('copper', code === 'E01' ? 'permanent' : 'temporary'), h = harness(f);
    h.commit(h.prepare(command(code === 'E01' ? 'permanent' : 'temporary'))); const after = f.state();
    const dismiss = h.controller.prepareDismissal(after, captureOutcomeContext(after)!);
    expect(dismiss.ok).toBe(true); expect(f.state()).toBe(after); h.commit(dismiss);
    expect(f.game().world.continueOutcome).toBe(code); expect(f.state().runtime.activity?.kind).toBe('safe-continue');
    expect(f.game().world.position.safePositionId).toBe(q('R12.entry')); expect(f.game().world.completedObjectiveIds).toEqual(after.runtime.game!.world.completedObjectiveIds);
    expect(f.game().outcomeHistory).toEqual(after.runtime.game!.outcomeHistory);
    expect(f.game().notebook).toEqual(after.runtime.game!.notebook); expect(f.game().world.inventory).toEqual(after.runtime.game!.world.inventory);
    expect(f.state().runtime.persistence.pendingRequest).toBe(after.runtime.persistence.pendingRequest);
    expect(expected(`OUT-${code}-CONTINUE`)['rewindPreparation']).toBe(false);
  });
  it('never dismisses E03 into a safe shutdown world', () => {
    const f = ready('copper', 'shutdown'), h = harness(f); h.commit(h.prepare(command('shutdown'))); const before = f.state();
    expect(h.controller.prepareDismissal(before, captureOutcomeContext(before)!)).toMatchObject({ ok: false });
    expect(f.state()).toBe(before); expect(f.game().world.continueOutcome).toBeNull();
  });
  it('cannot use a safe panel or fabricated history as successful dismissal provenance', () => {
    const f = ready(); f.classify(); const s = f.state();
    f.replace({ ...s, runtime: { ...s.runtime, activity: { kind: 'cutscene' }, game: { ...f.game(), outcomeHistory: [{ id: eventId, outcome: 'E01', attemptId: f.game().world.attemptId, route: 'copper', caveatIds: [] }] } } });
    const h = harness(f); expect(h.controller.prepareDismissal(f.state(), captureOutcomeContext(f.state())!).ok).toBe(false);
  });
  it.each(['missing', 'wrong-room', 'wrong-state'] as const)('withholds safe Continue when the anchor is %s', fault => {
    const content: ContentRegistry = { ...registry, safePosition: id => id !== q('R12.entry') ? registry.safePosition(id) : fault === 'missing' ? undefined
      : { ...registry.safePosition(id)!, ...(fault === 'wrong-room' ? { roomId: q('R11') } : { eligibleStates: ['stable-exploration'] }) } };
    const f = ready(), h = harness(f, content); h.commit(h.prepare());
    expect(h.controller.prepareDismissal(f.state(), captureOutcomeContext(f.state())!)).toMatchObject({ ok: false, reason: 'unsafe-destination' });
    expect(f.state().runtime.activity?.kind).toBe('cutscene'); expect(f.game().world.continueOutcome).toBeNull();
  });
  it('rejects pending transitions, exhausted generation and full event histories before effects', () => {
    for (const fault of ['pending', 'dirty', 'history'] as const) {
      const f = ready(), s = f.state();
      if (fault === 'pending') f.send({ kind: 'begin', activity: 'pending-effect', evaluation: { status: 'correct', reasonCode: 'test', observations: [], acceptedEffects: [] } });
      if (fault === 'dirty') f.replace({ ...s, runtime: { ...s.runtime, persistence: { ...s.runtime.persistence, dirtyGeneration: Number.MAX_SAFE_INTEGER as never } } });
      if (fault === 'history') f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), outcomeHistory: Array.from({ length: 256 }, (_, n) => ({ id: uuid(1000 + n) as unknown as OutcomeEventId, outcome: 'E01' as const, attemptId: uuid(2000 + n) as never, route: 'copper' as const, caveatIds: [] })) } } });
      const h = harness(f), before = f.state(); expect(h.prepare().ok).toBe(false); expect(f.state()).toBe(before);
    }
  });
  it.each(['missing', 'wrong-adventure', 'wrong-attempt', 'committed-preparation', 'wrong-room'] as const)('rejects invalid active encounter provenance: %s', fault => {
    const f = ready(), s = f.state(), checkpoint = s.runtime.checkpoint!;
    const changed = fault === 'missing' ? null : fault === 'wrong-adventure' ? { ...checkpoint, adventureId: uuid(500) as never }
      : fault === 'wrong-attempt' ? { ...checkpoint, world: { ...checkpoint.world, attemptId: uuid(501) as never } }
        : fault === 'committed-preparation' ? { ...checkpoint, world: { ...checkpoint.world, completedObjectiveIds: [...checkpoint.world.completedObjectiveIds, q<'objective'>('O11')] } } : checkpoint;
    f.replace({ ...s, runtime: { ...s.runtime, checkpoint: changed, game: fault === 'wrong-room' ? { ...f.game(),
      world: { ...f.game().world, roomId: q('R10'), position: { safePositionId: q('R10.entry') } } } : f.game() } });
    const before = f.state(); expect(harness(f).prepare()).toMatchObject({ ok: false, reason: 'invalid-state' }); expect(f.state()).toBe(before);
  });
  it.each(['cutscene', 'terminal-failure', 'shutdown', 'safe-preparation', 'dialogue-transaction'] as const)('rejects unsupported %s classification and snapshot capture', activity => {
    const f = ready(), s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, activity: { kind: activity } } });
    const h = harness(f), before = f.state(); expect(h.prepare()).toMatchObject({ ok: false, reason: 'invalid-state' });
    // No policy is needed to prove runtime activity rejection; this deliberately
    // does not certify positive eligibility or production caveat membership.
    if (activity !== 'safe-preparation') expect(captureSafeSnapshot(before, new SaveValidator([]))).toMatchObject({ ok: false, code: 'safe-state', path: '/activity' });
    expect(f.state()).toBe(before);
  });
  it.each(['permanent', 'temporary', 'shutdown'] as const)('keeps accepted %s feedback unsaveable before any dismissal', selection => {
    const f = ready('copper', selection), h = harness(f); h.commit(h.prepare(command(selection)));
    expect(captureSafeSnapshot(f.state(), new SaveValidator([]))).toMatchObject({ ok: false, code: 'safe-state', path: '/activity' });
  });
  it('admits the last legal classification revision and rejects exhaustion without wrapping', () => {
    for (const revision of [2147483646, 2147483647]) {
      const f = ready(), s = f.state(), game = f.game();
      f.replace({ ...s, control: { ...s.control, highestRevision: revision }, runtime: { ...s.runtime, game: { ...game,
        world: { ...game.world, configurationRevision: revision as never }, notebook: { ...game.notebook,
          measurements: game.notebook.measurements.map(m => m.stale ? m : { ...m, configurationRevision: revision as never }) } } } });
      const h = harness(f), before = f.state(), p = h.prepare();
      if (revision === 2147483646) { h.commit(p); expect(f.game().world.configurationRevision).toBe(2147483647); }
      else { expect(p).toMatchObject({ ok: false, reason: 'generation-exhausted' }); expect(f.state()).toBe(before); }
    }
  });
  it('rejects an old event UUID even when delivered with different case in a new attempt', () => {
    const f = ready(), s = f.state(), id = 'ABCDEFAB-0000-4000-8000-000000000001' as OutcomeEventId;
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), outcomeHistory: [{ id, outcome: 'E01', attemptId: uuid(89) as never, route: 'copper', caveatIds: [] }] } } });
    expect(harness(f).prepare({ ...command(), eventId: id.toLowerCase() as OutcomeEventId })).toMatchObject({ ok: false, reason: 'invalid-input' });
  });
  it('rejects untrusted command fields and malformed IDs without calling them verdicts', () => {
    const f = ready(), h = harness(f);
    for (const bad of [{ ...command(), verdict: 'E01' }, { ...command(), eventId: 'invented' }, { ...command(), operation: { kind: 'fatal' } }, { ...command(), operation: { ...command().operation, scenario: { result: 'correct' } } }]) {
      expect(h.prepare(bad as OutcomeCommand)).toMatchObject({ ok: false, reason: 'invalid-input' });
    }
    expect(f.game().outcomeHistory).toEqual([]);
  });
  it('samples the trusted scenario once and protects live state from a faulty adapter', () => {
    const f = ready(); let calls = 0;
    const controller = createOutcomeController({ registry, repairScenario: (g, p) => { calls++; return f.resolver(g, p); } });
    const p = controller.prepareClassification(f.state(), captureOutcomeContext(f.state())!, command()); expect(p.ok).toBe(true); expect(calls).toBe(1);
    const bad = createOutcomeController({ registry, repairScenario: g => { (g.world.flags as Record<string, unknown>)['bad'] = true; return null; } });
    const before = structuredClone(f.state()); expect(bad.prepareClassification(f.state(), captureOutcomeContext(f.state())!, command())).toMatchObject({ ok: false, reason: 'content-error' });
    expect(f.state()).toEqual(before);
  });
  it.each(['ui', 'auth', 'persistence'] as const)('keeps accepted feedback across a harmless %s refresh while rejecting stale dismissal captures', part => {
    const f = ready(), h = harness(f); h.commit(h.prepare()); const accepted = f.state(), oldContext = captureOutcomeContext(accepted)!;
    const oldDismissal = h.controller.prepareDismissal(accepted, oldContext); expect(oldDismissal.ok).toBe(true);
    const runtime = part === 'ui' ? { ...accepted.runtime, ui: { ...accepted.runtime.ui!, feedback: 'Status refreshed.' } }
      : part === 'auth' ? { ...accepted.runtime, auth: { ...accepted.runtime.auth, clientGeneration: 9 as never } }
        : { ...accepted.runtime, persistence: { ...accepted.runtime.persistence, autosaveEnabled: true } };
    f.replace({ ...accepted, runtime }); const refreshed = f.state(); expect(refreshed.runtime.game).toBe(accepted.runtime.game);
    expect(h.controller.feedback(refreshed)?.outcome).toBe('E01');
    expect(h.controller.prepareDismissal(refreshed, oldContext)).toMatchObject({ ok: false, reason: 'stale-context' });
    if (!oldDismissal.ok) throw new Error('dismissal'); expect(h.controller.commit(h.store, oldDismissal.change).ok).toBe(false);
    const fresh = h.controller.prepareDismissal(refreshed, captureOutcomeContext(refreshed)!); expect(fresh.ok).toBe(true); h.commit(fresh);
    expect(f.state().runtime.activity?.kind).toBe('safe-continue'); expect(f.game().world.continueOutcome).toBe('E01');
    expect(f.state().runtime.auth).toBe(refreshed.runtime.auth);
  });
  it('a same-version Restore/new-run cloned game never inherits a feedback receipt', () => {
    const f = ready(), h = harness(f); h.commit(h.prepare()); const accepted = f.state();
    f.replace({ ...accepted, runtime: { ...accepted.runtime, game: structuredClone(accepted.runtime.game) } });
    expect(h.controller.feedback(f.state())).toBeNull();
    expect(h.controller.prepareDismissal(f.state(), captureOutcomeContext(f.state())!).ok).toBe(false);
  });
  it.each(['missing-unit', 'negative-loss', 'unknown-profile'] as const)('reports authored %s before a missing classification selection', fault => {
    const f = ready('fiber'), before = f.state();
    const bad = createOutcomeController({ registry, repairScenario: (g, p) => { const s = f.resolver(g, p); if (!s) return s;
      return { ...s, path: fault === 'missing-unit' ? { kind: 'optical-passive', compatible: true, loss: { value: 8 } } as never
        : fault === 'negative-loss' ? { kind: 'optical-passive', compatible: true, loss: { value: -1, unit: 'dB' } }
          : { ...s.path, profile: { id: 'unreviewed-profile' } } as never };
    } });
    const missing = { ...command(), operation: { ...command().operation, selection: null } } as unknown as OutcomeCommand;
    expect(bad.prepareClassification(before, captureOutcomeContext(before)!, missing)).toMatchObject({ ok: false, reason: 'content-error' });
    expect(f.state()).toBe(before); expect(f.game().outcomeHistory).toEqual([]);
  });
  it('a missing selection on valid authored content stays invalid-input without partial effects', () => {
    const f = ready(), before = f.state(), h = harness(f);
    expect(h.prepare({ ...command(), operation: { ...command().operation, selection: null } } as unknown as OutcomeCommand)).toMatchObject({ ok: false, reason: 'invalid-input' });
    expect(f.state()).toBe(before);
  });
  it('binds caveats to exact reviewed authored evidence and rejects missing clauses as author errors', () => {
    expect(outcomeCaveats(registry)).toMatchObject({ E01: [], E02: [{ id: q('FACT-repair-maintenance') }], E03: [{ id: q('FACT-repair-isolation') }] });
    const content: ContentRegistry = { ...registry, record: id => {
      const record = registry.record(id); return id !== q('R11') || record?.kind !== 'room' ? record : { ...record,
        evidence: record.evidence.map(f => f.id !== q('FACT-repair-maintenance') ? f : { ...f, text: 'Temporary service passes.' }) };
    } };
    const f = ready('copper', 'temporary'), h = harness(f, content);
    expect(h.prepare(command('temporary'))).toMatchObject({ ok: false, reason: 'content-error' }); expect(f.game().outcomeHistory).toEqual([]);
  });
});
