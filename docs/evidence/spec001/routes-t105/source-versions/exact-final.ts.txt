// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T105 supplements. These are scoped predicates/prepared-state tests, not native journeys.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeToySamples, evaluateSymbolAnswer, comparePacketPattern, encodePacketPayload } from '../../src/domain/packet-journey';
import { evaluateOptics } from '../../src/domain/optics';
import { evaluateBenchAnswer, evaluateCompatibilityCard } from '../../src/state/optional-optical-bench';
import { evaluateObjective } from '../../src/state/objectives';
import { isMeasurementCurrent } from '../../src/state/reducer';
import { createActionBus, contextFromRuntime } from '../../src/ui/action-bus';
import { prepareRepairPlanChange } from '../../src/state/repair-plan';
import type { AttemptId } from '../../src/domain/types';
import { fixture as objectiveFixture, scenario, registry, q, uuid } from './objectives-fixture';
import { fixture as repairFixture, uuid as repairUuid, registry as repairRegistry } from './repair-plan-fixture';

type Row = { id: string; inputs: Record<string, any>; expected: { status: string; observation: Record<string, any> } };
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/${name}.json`, import.meta.url), 'utf8'));
const physical = read('physical-cases');
const route = read('repair-routes');
const rows = new Map<string, Row>([...physical.referenceCases, ...physical.reviewCases, ...route.cases].map((r: Row) => [r.id, r]));
const row = (id: string) => { const r = rows.get(id); if (!r) throw new Error(id); return r; };
const profile = (id: string) => { const p = physical.profiles.find((p: any) => p.id === `spec001:PROFILE-${id}`); return structuredClone({ id: p.id, parameters: p.parameters }); };
const world = { configurationRevision: 8, attemptId: 'attempt-b' } as any;
const action = (input: unknown) => ({ actionId: 't105-scoped', expectedVersion: world, input }) as any;
const symbols = profile('SYMBOLS'), optical = profile('OPTICAL'), packet = profile('PACKET');
// Original ordered arrays imply ordered samples. Production requires explicit positions;
// the adapter adds 0..n-1, not a verdict, and documents that representational adaptation.
const samples = (values: any[]) => values.map((value, position) => ({ ...value, position }));

describe('T105 original physical cases: actual symbol and pattern interfaces', () => {
  it.each(['T12', 'B-SYMBOL'])('%s decodes the original ordered samples', id => {
    const r = row(id), result = decodeToySamples(symbols, samples(r.inputs['symbols']));
    expect(result.status).toBe(r.expected.status);
    expect(result.observations[0]).toMatchObject(r.expected.observation);
    expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['C-SYMBOL-WRONG', 'B-TIMING'])('%s grades the original wrong bit order', id => {
    const r = row(id), result = evaluateSymbolAnswer({ profile: symbols, samples: samples(r.inputs['symbols'] ?? r.inputs['suppliedSamples']) },
      action({ bits: r.inputs['learnerBits'] ?? '1000' }), world);
    expect(result.status).toBe(r.expected.status);
    expect(result.observations[0]).toMatchObject(r.expected.observation);
    expect(result.acceptedEffects).toEqual([]);
  });
  it('C-ERROR-SYMBOL rejects an unsupported authored level before grading', () => {
    const r = row('C-ERROR-SYMBOL'), result = decodeToySamples(symbols, samples(r.inputs['authoredSamples']));
    expect(result.status).toBe(r.expected.status); expect(result.observations[0]).toMatchObject(r.expected.observation);
    expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['C-PACKET', 'C-PACKET-DIFF', 'B-PACKET'])('%s compares only the original highlighted laboratory pattern', id => {
    const r = row(id), result = comparePacketPattern({ profile: packet, expectedBits: r.inputs['expectedBits'] ?? '0100111001010001', recoveredBits: r.inputs['recoveredBits'] },
      action({ claim: id === 'B-PACKET' ? r.inputs['claim'] : 'known-pattern-matches' }), world);
    expect(result.status).toBe(r.expected.status);
    if (id === 'C-PACKET') {
      expect(result.observations[0]).toMatchObject({ knownPatternMatches: true, wholeFrameIsTwoBytes: false });
      const encoded = encodePacketPayload(packet, symbols);
      expect(encoded.status).toBe('correct');
      const encoding = encoded.observations[0]; if (encoding?.kind !== 'packet-encoding') throw new Error('Expected actual packet encoding');
      expect(encoding.payloadDecimal).toHaveLength(r.expected.observation['payloadBytes']);
      expect(encoding.representedBits).toBe(r.expected.observation['representedBits']);
    } else expect(result.observations[0]).toMatchObject(r.expected.observation);
    expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['I-PHY10', 'I-PHY11'])('%s keeps missing learner input effect-free', id => {
    const r = row(id), result = id === 'I-PHY10'
      ? evaluateSymbolAnswer({ profile: symbols, samples: samples(row('T12').inputs['symbols']) }, action(r.inputs['learnerAction']), world)
      : comparePacketPattern({ profile: packet, expectedBits: '0100111001010001', recoveredBits: '0100111001010001' }, action(r.inputs['learnerAction']), world);
    expect(result.status).toBe(r.expected.status); expect(result.reasonCode).toBe('required-action-missing');
    expect(result.observations[0]).toMatchObject({ progressAward: 0 }); expect(result.acceptedEffects).toEqual([]);
  });
});

describe('T105 original physical cases: scoped compatibility and valid-content grading', () => {
  it.each(['C-COMPAT', 'B-COMPAT'])('%s uses the actual reviewed compatibility-card adapter', id => {
    const r = row(id), result = evaluateCompatibilityCard({ sourceCaseId: id, premises: r.inputs }, action({ kind: 'inspect-card' }), world);
    expect(result.status).toBe(r.expected.status); expect(result.acceptedEffects).toEqual([]);
    if (id === 'C-COMPAT') expect(result.observations[0]).toMatchObject({ inspectionComplete: true, preparationComplete: false, powerBudgetProven: false, serviceProven: false });
    else expect(result.observations[0]).toMatchObject({ compatible: false, usableLink: false, arithmeticCannotOverride: true });
  });
  it('B-INSPECTION does not let matching equipment replace inspection', () => {
    const r = row('B-INSPECTION'), result = evaluateOptics({ kind: 'optical-inspection', ...r.inputs } as any, action({ kind: 'check-inspection' }), world);
    expect(result.status).toBe(r.expected.status); expect(result.reasonCode).toBe(r.expected.observation['reason']);
    expect(result.observations[0]).toMatchObject({ preparationComplete: false }); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['C-VALID', 'C-VALID-WRONG'])('%s grades an actual 8 dB bench answer after validating author data', id => {
    const r = row(id), result = evaluateBenchAnswer({ sourceCaseId: 'T04', compatible: true, loss: r.inputs['loss'] }, optical,
      action({ receive: r.inputs['learnerClaimsReceive'] ?? { value: -11, unit: 'dBm' }, margin: { value: 3, unit: 'dB' }, reserve: 'met', overload: 'not-overloaded' }), world);
    expect(result.status).toBe(r.expected.status);
    expect(result.observations[0]).toMatchObject({ learnerStatus: r.expected.status, physicalStatus: 'correct', physical: { receive: { value: -11, unit: 'dBm' } }, progressAward: 0 });
    expect(result.acceptedEffects).toEqual([]);
  });
  it('B-LOSS-ZERO evaluates the exact idealized zero-loss boundary', () => {
    const r = row('B-LOSS-ZERO'), result = evaluateOptics({ kind: 'optical-passive', profile: optical, compatible: true, loss: r.inputs['loss'] }, action({ kind: 'measure-optics' }), world);
    expect(result.status).toBe(r.expected.status);
    expect(result.observations[0]).toMatchObject({ receive: r.expected.observation['receive'], margin: r.expected.observation['margin'] });
    expect(result.acceptedEffects).toEqual([]);
  });
  it('I-PHY03 retains the valid scoped authored premise and absent learner action', () => {
    const r = row('I-PHY03'), result = evaluateOptics({ kind: 'optical-inspection', everyRequiredCompatibilityCheck: true, requiredInspectionComplete: true }, action(r.inputs['learnerAction']), world);
    expect(result.status).toBe(r.expected.status); expect(result.reasonCode).toBe(r.expected.observation['reason']);
    expect(result.observations[0]).toMatchObject({ progressAward: 0 }); expect(result.acceptedEffects).toEqual([]);
  });
});

describe('T105 exact freshness and objective admission', () => {
  it.each(['T13', 'C-FRESH', 'B-STALE-FLAG', 'RR-FRESH-REVISION', 'RR-FRESH-ATTEMPT', 'RR-FRESH-FLAG', 'RR-FRESH-CURRENT'])('%s preserves the original independent freshness operands', id => {
    const r = row(id), f = objectiveFixture('O06'); f.measure(); const before = f.store.getState(), game = before.runtime.game!, original = game.notebook.measurements[0]!;
    const revision = r.inputs['measurementRevision'] ?? r.inputs['measurement'].revision;
    const currentRevision = r.inputs['currentRevision'] ?? r.inputs['current'].revision;
    const attempt = r.inputs['measurementAttempt'] ?? r.inputs['measurement'].attempt;
    const currentAttempt = r.inputs['currentAttempt'] ?? r.inputs['current'].attempt;
    // Runtime UUID syntax is required. Preserve the oracle equality relation by
    // assigning deterministic UUIDs to distinct oracle labels, never merging them.
    const labels = [...new Set([attempt, currentAttempt])]; const attemptId = (label: string) => String(uuid(100 + labels.indexOf(label))) as AttemptId;
    const m = { ...original, configurationRevision: revision, attemptId: attemptId(attempt), stale: r.inputs['explicitlyStale'] ?? false } as typeof original;
    const current = { ...game.world, configurationRevision: currentRevision, attemptId: attemptId(currentAttempt) } as typeof game.world;
    expect(isMeasurementCurrent(m, current)).toBe(r.expected.observation['fresh']);
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, world: current, notebook: { ...game.notebook, measurements: [m] } } } });
    const submitted = evaluateObjective(registry, f.resolver, f.store.getState().runtime.game!, q('O06'), { actionId: 't105-current-submit', expectedVersion: current, input: { kind: 'submit', alternativeId: scenario('O06').alternativeId, measurementId: original.id } } as any);
    if (!r.expected.observation['fresh']) { expect(submitted).toMatchObject({ status: 'incorrect', reasonCode: 'stale-evidence', acceptedEffects: [] }); f.submit(); }
    // A fresh timestamp never awards an objective by itself; actual submission is
    // deliberately not committed in the fresh-only cases.
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O06'));
    expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([m]);
  });
  it.each(['RR-O11-MISSING-SHARED', 'RR-O11-MIXED-BRANCH'])('%s rejects the exact original incomplete objective set', id => {
    const r = row(id), f = repairFixture(r.inputs['selectedRoute']); const s = f.state();
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), world: { ...f.game().world, completedObjectiveIds: r.inputs['completedObjectives'].map((id: string) => q(id)) } } } });
    f.prepare(); const result = f.execute(); expect(result.evaluation?.status).toBe(r.expected.status);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
    for (const missing of r.expected.observation['missingObjectives']) expect(f.game().world.completedObjectiveIds).not.toContain(q(missing));
    expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it('RR-O10-ROLE preserves correct bits but rejects address discovery as a physical role', () => {
    const r = row('RR-O10-ROLE'), s = scenario('O10'); if (s.kind !== 'calibration') throw new Error();
    const f = objectiveFixture('O10', { ...s, decodedBits: r.inputs['bits'], roleClaim: r.inputs['roleClaim'] });
    const game = f.store.getState().runtime.game!, result = evaluateObjective(registry, f.resolver, game, q('O10'), { actionId: 't105-role', expectedVersion: game.world, input: { kind: 'measure', alternativeId: s.alternativeId, id: uuid(99) } } as any);
    expect(result.status).toBe(r.expected.status); expect(result.reasonCode).toBe(r.expected.observation['reason']);
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O10')); expect(result.acceptedEffects).toEqual([]);
  });
  it('RR-O10-MISSING-SAMPLES rejects absent authored positions without a penalty or partial effects', () => {
    const r = row('RR-O10-MISSING-SAMPLES'), s = scenario('O10'); if (s.kind !== 'calibration') throw new Error();
    const f = objectiveFixture('O10', { ...s, samples: r.inputs['symbols'] }), game = f.store.getState().runtime.game!;
    const result = evaluateObjective(registry, f.resolver, game, q('O10'), action(null));
    expect(result.status).toBe(r.expected.status); expect(result.observations[0]).toMatchObject({ attemptPenalty: 0, progressAward: 0 }); expect(result.acceptedEffects).toEqual([]);
  });
  it('RR-O12-MISSING-FOLLOWUP rejects omitted documentation even after actual final proof', () => {
    const f = repairFixture(); f.prepare('copper-section', 'temporary'); f.choose('record-maintenance'); f.execute(); f.prove();
    const s = f.state(), g = f.game();
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...g, notebook: { ...g.notebook, factIds: g.notebook.factIds.filter(id => id !== q('FACT-repair-maintenance')) } } } });
    const result = f.classify('temporary'); expect(result.evaluation?.status).toBe(row('RR-O12-MISSING-FOLLOWUP').expected.status);
    expect(result.evaluation?.reasonCode).toBe('temporary-followup-missing'); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
    expect(f.game().notebook.measurements.some(m => m.id === repairUuid(3))).toBe(true);
  });
  it('shared absent-action admission preserves actual state; generic I rows are adaptations, not independent physical executions', () => {
    // I-PHY01/I-PHY02/I-STATE03 use semantic actions, not a four-status evaluator.
    // One shared missing-action admission check supports those three generic rows.
    const f = objectiveFixture(), before = f.store.getState();
    const bus = createActionBus({ getContext: () => contextFromRuntime(before.runtime) });
    try { expect(() => bus.capture(null as never)).toThrow(); expect(f.store.getState()).toBe(before); }
    finally { bus.dispose(); }
    // I-STATE01/I-STATE02: actual valid objective content, missing current action.
    const g = f.store.getState().runtime.game!;
    const result = evaluateObjective(registry, f.resolver, g, q('O03'), { actionId: 't105-absent', expectedVersion: g.world, input: null } as any);
    expect(result).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
    expect(result.reasonCode).toBe('required-action-missing'); expect(f.store.getState()).toBe(before);
    // I-STATE04: the actual repair lifecycle rejects null before any operation.
    const r = repairFixture(), snapshot = r.state();
    expect(prepareRepairPlanChange(repairRegistry, r.resolver, r.game(), null as never)).toEqual({ ok: false, reason: 'invalid-input' });
    expect(r.state()).toBe(snapshot); expect(r.game().outcomeHistory).toEqual([]);
  });
});
