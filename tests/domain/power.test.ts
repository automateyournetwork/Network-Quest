// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluatePower } from '../../src/domain/power';
import type { PowerChallenge, PowerInput, PowerProfile } from '../../src/domain/power';
import type { DomainAction, WorldVersion } from '../../src/domain/types';

interface Case { id: string; inputs: Record<string, unknown>; expected: { status: string; observation: Record<string, unknown> } }
const source = JSON.parse(readFileSync(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as { referenceCases: Case[]; reviewCases: Case[] };
const profiles = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as { records: PowerProfile[] };
const profile = profiles.records.find(p => p.id === 'spec001:PROFILE-POWER')!;
const world = { configurationRevision: 4, attemptId: 'power-attempt' } as WorldVersion;
const watts = (value: number) => ({ value, unit: 'W' });
function action(input: unknown = { kind: 'check-allocation' }) { return { actionId: 'measure-power', expectedVersion: { ...world }, input }; }
function challenge(overrides: Record<string, unknown> = {}) {
  return { kind: 'delivered-power', profile, budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses', demands: [watts(12), watts(11)], ...overrides };
}
function evaluate(value: unknown, command: unknown = action(), current: unknown = world) {
  return evaluatePower(value as PowerChallenge, command as DomainAction<PowerInput>, current as WorldVersion);
}
function noAward(result: ReturnType<typeof evaluate>) {
  expect(result.acceptedEffects).toEqual([]);
  for (const observation of result.observations) {
    expect(observation).not.toHaveProperty('equipmentReady', true);
    expect(observation).not.toHaveProperty('objectiveComplete');
    expect(observation).not.toHaveProperty('serviceProven', true);
  }
}
function authorError(value: unknown) {
  for (const command of [null, action(null), { ...action(), expectedVersion: { ...world, configurationRevision: 3 } }]) {
    const result = evaluate(value, command);
    expect(result.status).toBe('content-error');
    expect(result.observations).toMatchObject([{ kind: 'content-error', attemptPenalty: 0, progressAward: 0 }]);
    noAward(result);
  }
}

describe('T073 delivered power from the unchanged T006/T014 oracle', () => {
  for (const id of ['T10', 'C-POWER', 'B-POWER-30', 'B-POWER-OVER']) {
    it(id, () => {
      const fixture = [...source.referenceCases, ...source.reviewCases].find(c => c.id === id)!;
      const result = evaluate(challenge({ demands: fixture.inputs['demands'], otherConstraints: fixture.inputs['otherConstraints'] }));
      expect(result.status).toBe(fixture.expected.status);
      expect(result.observations).toMatchObject([{ ...fixture.expected.observation, scope: 'delivered power allocation only', wholeRouteProven: false, version: world }]);
      noAward(result);
    });
  }
  it('B-POWER-COMPAT: supplied aggregate watts cannot override a failed required port', () => {
    const fixture = source.reviewCases.find(c => c.id === 'B-POWER-COMPAT')!;
    const value = challenge({ totalDemand: fixture.inputs['totalDemand'], portPowerCompatible: fixture.inputs['oneRequiredPortCompatible'] });
    delete (value as Record<string, unknown>)['demands'];
    const result = evaluate(value);
    expect(result.status).toBe(fixture.expected.status);
    expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ budgetCannotOverride: true, equipmentReady: false, constraints: { portPowerCompatible: false } }]);
    expect(result.observations[0]).not.toHaveProperty('total');
    expect(result.observations[0]).not.toHaveProperty('constraints.otherConstraints');
    noAward(result);
  });
  it('I-PHY08: missing learner input remains invalid input', () => {
    const result = evaluate(challenge(), action(null));
    expect(result.status).toBe('invalid-input');
    expect(result.reasonCode).toBe('required-action-missing'); noAward(result);
  });
});

describe('T073 power validation and exact numeric boundaries', () => {
  it.each([
    { demands: [] }, { demands: new Array(2) }, { demands: [watts(12), undefined] },
    { demands: [watts(-1)] }, { demands: [watts(NaN)] }, { demands: [watts(Infinity)] },
    { demands: [{ value: '12', unit: 'W' }] }, { demands: [{ value: 12 }] },
    { demands: [{ value: 12, unit: 'dBm' }] }, { demands: [{ ...watts(12), loss: 1 }] },
    { demands: null }, { demands: undefined }, { demands: [watts(Number.MAX_VALUE), watts(Number.MAX_VALUE)] },
    { totalDemand: watts(23) }, { budgetBoundary: undefined }, { demandBoundary: undefined },
    { budgetBoundary: 'PSE-output' }, { demandBoundary: 'PSE-output' },
    { conversionLossModel: null }, { lineLoss: watts(1) }, { futurePowerRule: true },
  ])('rejects malformed authored facts before a missing/stale command: %j', overrides => authorError(challenge(overrides)));
  it.each(['otherConstraints', 'formFactorMatch', 'phyAndMediaMatch', 'hostSupport', 'portPowerCompatible', 'perPortConstraintsMet'])('validates optional explicit boolean %s', key => {
    for (const value of [undefined, null, 'true', 1, NaN, Infinity]) authorError(challenge({ [key]: value }));
  });
  it.each([
    { id: 'spec001:UNKNOWN' }, { reviewedProfileId: 'spec001:UNKNOWN' }, { forcedPowerClass: 3 },
    { parameters: { ...profile.parameters, deliveredBudget: watts(31) } },
    { parameters: { ...profile.parameters, deliveredBudget: { value: 30, unit: 'dB' } } },
    { parameters: { ...profile.parameters, inclusiveMaximum: false } },
    { parameters: { ...profile.parameters, losses: watts(1) } },
    { model: null },
    { model: { label: 'real-standard', scope: 'Universal PoE rule', assumptions: [], limitations: [] } },
    { model: { label: 'fictional-teaching-profile', scope: 'Supplied teaching model', assumptions: [], limitations: [], priorityRule: 'highest-port-first' } },
    { model: { label: 'fictional-teaching-profile', scope: 'Supplied teaching model', assumptions: new Array(1), limitations: [] } },
  ])('rejects changed or unsupported authored profiles: %j', override => authorError(challenge({ profile: { ...profile, ...override } })));
  it('rejects contradictory blanket compatibility and explicit failed compatibility', () => authorError(challenge({ otherConstraints: true, perPortConstraintsMet: false })));
  it('validates bad numeric input even when known incompatible', () => authorError(challenge({ demands: [watts(NaN)], portPowerCompatible: false })));
  it('requires exactly one aggregate or component representation', () => {
    const noDemands = challenge(); delete (noDemands as Record<string, unknown>)['demands'];
    authorError(noDemands); authorError({ ...noDemands, totalDemand: watts(-1) });
    expect(evaluate({ ...noDemands, totalDemand: watts(23) }).status).toBe('correct');
  });
  it('compares exact decimals before display and preserves the smallest positive excess', () => {
    const exact = evaluate(challenge({ demands: Array.from({ length: 300 }, () => watts(0.1)) }));
    expect(exact.status).toBe('correct');
    expect(exact.observations).toMatchObject([{ total: watts(30), headroom: watts(0) }]);
    const over = evaluate(challenge({ demands: [watts(30), watts(Number.MIN_VALUE)] }));
    expect(over.status).toBe('incorrect');
    expect(over.observations).toMatchObject([{ excess: watts(Number.MIN_VALUE) }]);
    const below = evaluate(challenge({ demands: [watts(29.99)] }));
    expect(below.observations).toMatchObject([{ headroom: watts(0.01) }]);
  });
  it('accepts explicit zero demand without inventing connected endpoints', () => {
    const result = evaluate(challenge({ demands: [watts(0)] }));
    expect(result.status).toBe('correct');
    expect(result.observations).toMatchObject([{ total: watts(0), headroom: watts(30), constraints: {}, wholeRouteProven: false }]); noAward(result);
  });
  it.each([null, {}, action({}), action({ kind: 'check-allocation', implicitSave: true }), action({ kind: 'force-power' }),
    { ...action(), expectedVersion: { ...world, configurationRevision: 3 } },
    { ...action(), expectedVersion: { ...world, attemptId: 'earlier-attempt' } },
  ])('rejects malformed or stale learner command %j', command => {
    const result = evaluate(challenge(), command); expect(result.status).toBe('invalid-input'); noAward(result);
  });
  it('is deterministic, detached and side effect free', () => {
    const value = challenge({ portPowerCompatible: true }); const command = action();
    const before = structuredClone({ value, command, world });
    const first = evaluate(value, command); const second = evaluate(value, command);
    expect(first).toEqual(second); expect({ value, command, world }).toEqual(before);
    const observation = first.observations[0] as unknown as { total: { value: number }; constraints: { portPowerCompatible: boolean }; version: { configurationRevision: number } };
    observation.total.value = 99; observation.constraints.portPowerCompatible = false; observation.version.configurationRevision = 100;
    expect(evaluate(value, command)).toEqual(second); noAward(second);
  });
  it('captures only configuration revision and attempt, without copying unrelated world fields', () => {
    const result = evaluate(challenge(), action(), { ...world, privateOperatorNote: 'not measurement data', extraState: { inventory: ['unrelated-item'] } });
    expect(result.observations).toMatchObject([{ version: world }]);
    expect((result.observations[0] as { version: unknown }).version).toEqual(world);
  });
});
