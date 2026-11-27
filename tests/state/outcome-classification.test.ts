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
import { projectEpilogue, validateEndingsContent } from '../../src/content/endings';
import endings from '../../content/spec001/endings.json';
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
  replace?: (base: RepairScenarioResolver) => RepairScenarioResolver, acquireProof = true) {
  const f = fixture(route, replace);
  f.prepare(selection === 'shutdown' ? 'shutdown' : `${route}-${route === 'copper' ? 'section' : 'A'}`, selection === 'shutdown' ? null : selection);
  if (selection === 'temporary') f.choose('record-maintenance');
  if (selection === 'shutdown') f.choose('record-isolation');
  expect(f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'enter-authored-preparation', observations: [], acceptedEffects: [] },
    destination: { roomId: q<'room'>('R11'), safePositionId: q<'safe-position'>('R11.preparation'), activity: 'safe-preparation' } }).status).not.toBe('rejected');
  expect(f.execute().evaluation?.status).toBe('correct');
  expect(f.state().runtime.activity?.kind).toBe('active-encounter');
  expect(f.state().runtime.checkpoint).not.toBeNull();
  if (selection === 'shutdown' || !acquireProof) { f.move('R12'); f.choose('read-classification'); } else f.prove();
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
      const row = expected(`OUT-${code}-${route.toUpperCase()}`);
      expect(result.feedback.restoredService).toBe(row['awardedRestoredService']);
      if (code !== 'E03') expect(result.feedback.observations).toContainEqual(expect.objectContaining({
        kind: 'service-classification', permanentRepair: row['permanentRepair'], assistanceDowngradesEnding: row['assistanceChangesClassification'],
      }));
      else expect(result.feedback.observations).toContainEqual(expect.objectContaining({ classification: 'E03', restoredService: false }));
      const clauseLabels: Record<string, string> = { dependency: 'Temporary dependency:', limitation: 'Limitation:', followup: 'Follow-up:',
        unresolvedDefect: 'Named unresolved fault:', recoveryPlan: 'Recovery plan:' };
      const caveats = result.feedback.caveats.map(caveat => caveat.text).join(' ');
      for (const clause of row['requiredCaveats'] as string[]) expect(caveats).toContain(clauseLabels[clause]);
      if (!(row['requiredCaveats'] as string[]).length) expect(result.feedback.caveats).toEqual([]);
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
      const row = expected(`OUT-${code}-HINT-${count}`);
      if (!p.ok) throw new Error(p.reason);
      expect(p.feedback).toMatchObject({ status: row['status'], restoredService: row['awardedRestoredService'] });
      if (code !== 'E03') expect(p.feedback.observations).toContainEqual(expect.objectContaining({
        permanentRepair: row['permanentRepair'], assistanceDowngradesEnding: row['assistanceChangesClassification'],
      }));
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
  it.each(['permanent', 'temporary'] as const)('arrival after a working %s repair still requires both final observations', selection => {
    const f = ready('copper', selection, undefined, false), h = harness(f), before = f.state();
    const row = expected(`OUT-${selection.toUpperCase()}-ARRIVAL-LINK-ONLY`);
    expect(f.game().world.roomId).toBe(q('R12'));
    expect(f.game().world.completedObjectiveIds).toContain(q('O11'));
    expect(f.game().notebook.measurements.some(m => m.roomId === q('R12'))).toBe(false);
    const cmd = command(selection);
    expect(h.prepare({ ...cmd, operation: { ...cmd.operation, linkId: null, endpointId: null } })).toMatchObject({
      ok: false, feedback: { status: row['status'], outcome: row['outcome'], restoredService: row['awardedRestoredService'], reasonCode: row['reason'] },
    });
    expect(f.state()).toBe(before);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
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
  it.each(['permanent', 'temporary'] as const)('rejects failed observations for %s without awarding progress', selection => {
    for (const fault of ['endpoint', 'pattern', 'conductor'] as const) {
      const f = ready('copper', selection, base => (g, p) => { const s = base(g, p); if (!s || g.world.roomId !== q('R12')) return s;
        return fault === 'endpoint' ? { ...s, endpointResponse: 'service-unavailable' } : fault === 'pattern' ? { ...s, receivedBits: '0100111001010000' }
          : { ...s, path: { kind: 'copper-path', compatible: true, lengths: [{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, false, true] } }; });
      const h = harness(f); const before = f.state();
      const codes = { endpoint: 'endpoint-service-unresolved', pattern: 'known-pattern-differs', conductor: 'required-path-open' };
      expect(h.prepare(command(selection))).toMatchObject({ ok: false, feedback: { status: 'incorrect', outcome: null,
        restoredService: false, reasonCode: codes[fault] } });
      expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
      expect(f.state()).toBe(before);
    }
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
    const missing = fixture(), before = missing.state();
    expect(missing.move('R12').status).toBe('unavailable');
    expect(harness(missing).prepare()).toMatchObject({ ok: false, reason: 'invalid-state' });
    expect(missing.state()).toBe(before); expect(missing.game().outcomeHistory).toEqual([]);
  });
  it('cannot claim restored service for an executed deliberate isolation', () => {
    const f = ready('copper', 'shutdown'), h = harness(f), before = f.state();
    expect(h.prepare(command('permanent'))).toMatchObject({ ok: false, feedback: { status: 'incorrect',
      restoredService: false, outcome: null, reasonCode: 'service-deliberately-isolated' } });
    expect(f.state()).toBe(before);
  });
  it.each(['dependency', 'maintenance'] as const)('requires actual temporary %s at classification', absent => {
    const f = ready('copper', 'temporary', absent === 'dependency' ? base => (g, p) => {
      const s = base(g, p); return s && { ...s, deployment: { ...s.deployment, temporaryDependency: g.world.roomId !== q('R12') } };
    } : undefined);
    if (absent === 'maintenance') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(),
      notebook: { ...f.game().notebook, factIds: f.game().notebook.factIds.filter(id => id !== q('FACT-repair-maintenance')) } } } }); }
    const h = harness(f), before = f.state();
    const rejected = h.prepare(command('temporary'));
    expect(rejected).toMatchObject({ ok: false, feedback: { status: 'incorrect', outcome: null, restoredService: false, reasonCode: 'temporary-followup-missing' } });
    if (rejected.ok) throw new Error('Accepted incomplete temporary claim');
    expect(rejected.feedback?.diagnosticCode).toBe(absent === 'dependency' ? 'temporary-dependency-absent' : undefined);
    expect(f.state()).toBe(before);
  });
  it.each(['fault', 'deliberate', 'record'] as const)('requires a named unresolved fault, deliberate isolation and recovery record: %s', absent => {
    const f = ready('copper', 'shutdown', base => (g, p) => {
      const s = base(g, p); if (!s || g.world.roomId !== q('R12')) return s;
      return { ...s, deployment: { ...s.deployment, ...(absent === 'fault' ? { unresolvedDefectIdentified: false } : absent === 'deliberate' ? { deliberateIsolation: false } : {}) } };
    });
    if (absent === 'record') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(),
      notebook: { ...f.game().notebook, factIds: f.game().notebook.factIds.filter(id => id !== q('FACT-repair-isolation')) } } } }); }
    const h = harness(f), before = f.state();
    const rejected = h.prepare(command('shutdown'));
    expect(rejected).toMatchObject({ ok: false, feedback: { status: 'incorrect', outcome: null,
      restoredService: false, reasonCode: 'shutdown-not-deliberate' } });
    if (rejected.ok) throw new Error('Accepted incomplete shutdown claim');
    expect(rejected.feedback?.diagnosticCode).toBe(absent === 'fault' ? 'unresolved-defect-not-identified' : undefined);
    expect(f.state()).toBe(before);
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
    const event = f.game().outcomeHistory;
    for (const room of ['R11', 'R10', 'R02', 'R05', 'R02', 'R07']) {
      expect(f.move(room).status).toBe('handled');
      expect(f.game().world.roomId).toBe(q(room));
      expect(f.game().outcomeHistory).toEqual(event);
      expect(f.game().world.completedObjectiveIds).toContain(q('O12'));
    }
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
    for (const selection of ['permanent', 'temporary'] as const) {
      const f = ready('copper', selection), h = harness(f, content);
      h.commit(h.prepare(command(selection)));
      const before = f.state();
      expect(f.game().outcomeHistory).toHaveLength(1);
      expect(h.controller.prepareDismissal(before, captureOutcomeContext(before)!)).toMatchObject({ ok: false, reason: 'unsafe-destination' });
      expect(f.state()).toBe(before);
      expect(f.state().runtime.activity?.kind).toBe('cutscene');
      expect(f.game().world.continueOutcome).toBeNull();
    }
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

describe('outcome feedback for an incomplete restoration claim', () => {
  for (const selection of ['permanent', 'temporary'] as const) {
    for (const missing of ['physical', 'endpoint'] as const) {
      it(`${selection} names the missing ${missing} observation when the other proof is current and passing`, () => {
        const f = ready('copper', selection), h = harness(f), cmd = command(selection);
        const before = f.state(), absentId = uuid(missing === 'physical' ? 2 : 3);
        f.replace({ ...before, runtime: { ...before.runtime, game: { ...f.game(), notebook: { ...f.game().notebook,
          measurements: f.game().notebook.measurements.filter(m => m.id !== absentId) } } } });
        const current = f.state(), row = expected(`OUT-${selection.toUpperCase()}-${missing.toUpperCase()}-MISSING`);
        const result = h.prepare({ ...cmd, operation: { ...cmd.operation, [missing === 'physical' ? 'linkId' : 'endpointId']: null } });
        expect(result).toMatchObject({ ok: false, feedback: { reasonCode: 'final-proof-missing', diagnosticCode: row['reason'],
          status: row['status'], outcome: row['outcome'], restoredService: row['awardedRestoredService'] } });
        expect(f.state()).toBe(current);
      });
    }
  }
  it.each(['stale', 'foreign', 'failed', 'both-missing', 'unknown-id'] as const)('retains accurate guidance for %s evidence', condition => {
    const f = ready('copper', 'permanent', base => (game, plan) => {
      const scenario = base(game, plan);
      return scenario && condition === 'failed' ? { ...scenario, endpointResponse: 'service-unavailable' } : scenario;
    });
    if (condition === 'stale' || condition === 'foreign') {
      const state = f.state();
      f.replace({ ...state, runtime: { ...state.runtime, game: { ...f.game(), notebook: { ...f.game().notebook,
        measurements: f.game().notebook.measurements.map(m => m.id !== uuid(3) ? m :
          condition === 'stale' ? { ...m, stale: true } : { ...m, conclusionCode: 'foreign-deployment' }) } } } });
    }
    const h = harness(f), cmd = command(), before = f.state();
    const endpointId = condition === 'both-missing' ? null : condition === 'unknown-id' ? uuid(99) : uuid(3);
    const result = h.prepare({ ...cmd, operation: { ...cmd.operation, linkId: null, endpointId } });
    if (result.ok || !result.feedback) throw new Error('Incomplete proof accepted or missing feedback');
    expect(result.feedback.reasonCode).toBe('final-proof-missing');
    const expectedGuidance = { stale: 'stale-evidence', foreign: 'measurement-provenance-mismatch',
      failed: 'endpoint-service-unresolved', 'both-missing': 'final-proof-missing', 'unknown-id': 'final-proof-missing' };
    expect(result.feedback.diagnosticCode ?? result.feedback.reasonCode).toBe(expectedGuidance[condition]);
    expect(f.state()).toBe(before);
  });
});

describe('personalized classification and accepted narrative on the fiber branch', () => {
  const loaded = validateEndingsContent(endings);
  if (!loaded.ok) throw new Error(loaded.issues.join(', '));
  const content = loaded.value;
  it.each([['permanent', 'E01'], ['temporary', 'E02'], ['shutdown', 'E03']] as const)(
    '%s preserves party, completed quest and maintenance history independently of three hint levels', (selection, outcome) => {
      const f = ready('fiber', selection), current = f.state(), game = f.game();
      // Seed the three previously earned facts. Acquisition is tested by the independent companion/quest suites.
      const ally = q<'character'>('CH03'), quest = q<'quest'>('SQ01'), fact = q<'fact'>('FACT-repair-maintenance');
      const room = registry.record(q('R11'));
      if (room?.kind !== 'room') throw new Error('Missing Rift evidence');
      const record = room.evidence.find(r => String(r.id) === String(fact));
      expect(record?.text).toBe('Temporary dependency: the tested bypass uses a borrowed installation in the protected work corridor. Limitation: this arrangement cannot be left as the permanent route. Follow-up: install and validate the permanent protected route before removing or returning the borrowed installation. Temporary service must pass the same fresh physical and endpoint checks.');
      expect(outcomeCaveats(registry)?.E02).toEqual([{ id: fact, text: record!.text }]);
      f.replace({ ...current, runtime: { ...current.runtime, game: { ...game,
        world: { ...game.world, activeAllyIds: [ally], recruits: [{ characterId: ally, level: 1, abilityIds: [], progressFlags: [] }], completedQuestIds: [quest] },
        notebook: { ...game.notebook, factIds: [...new Set([...game.notebook.factIds, fact])] } } } });
      for (let n = 0; n < 3; n++) expect(f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O12') } }).status).toBe('applied');
      const h = harness(f), result = h.prepare(command(selection)), before = f.game();
      if (!result.ok) throw new Error(result.reason);
      const row = expected(`OUT-${outcome}-PERSONALIZED`);
      expect(result.feedback).toMatchObject({ status: row['status'], outcome: row['outcome'], restoredService: row['awardedRestoredService'] });
      if (outcome !== 'E03') expect(result.feedback.observations).toContainEqual(expect.objectContaining({ permanentRepair: row['permanentRepair'] }));
      h.commit(result);
      const after = f.game(), event = after.outcomeHistory.at(-1)!;
      expect(after.world.recruits).toEqual(before.world.recruits);
      expect(after.world.completedQuestIds).toEqual(before.world.completedQuestIds);
      expect(after.notebook.factIds).toContain(fact);
      expect(after.assistance.map(h => h.level)).toEqual([1, 2, 3]);
      const narrative = projectEpilogue(content, after, event);
      expect(narrative?.paragraphs).toEqual(expect.arrayContaining([
        content.recruits.find(r => r.id === String(ally))!.active, content.sideQuests.find(sq => sq.id === quest)!.text, content.maintenance.recorded,
      ]));
      expect(projectEpilogue(content, { ...after, assistance: [] }, event)).toEqual(narrative);
    });
});

describe('closed authored records distinguish lesson content errors from learner actions', () => {
  it.each([
    ['temporary', 'FACT-repair-maintenance', 'Limitation: this arrangement cannot be left as the permanent route.'],
    ['temporary', 'FACT-repair-maintenance', 'Follow-up: install and validate the permanent protected route before removing or returning the borrowed installation.'],
    ['shutdown', 'FACT-repair-isolation', 'Recovery plan: return to safe preparation, repair or replace the damaged path, then measure again and repeat the endpoint test.'],
  ] as const)('%s rejects an authored record missing %s clause %s before grading', (selection, factId, clause) => {
    const f = ready('copper', selection), before = f.state();
    const source = registry.record(q('R11'));
    if (source?.kind !== 'room') throw new Error('Rift room missing');
    const fact = source.evidence.find(record => record.id === q(factId));
    expect(fact?.text).toContain(clause);
    const content: ContentRegistry = { ...registry, record: id => id !== source.id ? registry.record(id) : {
      ...source, evidence: source.evidence.map(record => record !== fact ? record : { ...record, text: record.text.replace(clause, '') }),
    } };
    expect(harness(f, content).prepare(command(selection))).toMatchObject({ ok: false, reason: 'content-error' });
    expect(f.state()).toBe(before); expect(f.game().outcomeHistory).toEqual([]);
  });
});
