// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateOptics } from '../../src/domain/optics';
import type { OpticalChallenge, OpticalInput, OpticalProfile } from '../../src/domain/optics';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, WorldVersion } from '../../src/domain/types';

interface Case {
  id: string;
  inputs: Record<string, unknown>;
  expected: { status: string; observation: Record<string, unknown> };
}
const physical = JSON.parse(readFileSync(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as {
  referenceCases: Case[]; reviewCases: Case[];
};
const authored = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as {
  records: OpticalProfile[];
};
const reviewed = authored.records.find(profile => profile.id === 'spec001:PROFILE-OPTICAL')!;
const profile: OpticalProfile = { id: reviewed.id, parameters: structuredClone(reviewed.parameters) };
const world: WorldVersion = { configurationRevision: 8 as ConfigurationRevision, attemptId: 'optical-attempt' as AttemptId };
const command = (kind: OpticalInput['kind'] = 'measure-optics'): DomainAction<OpticalInput> => ({
  actionId: 'optical-action' as ActionId, expectedVersion: { ...world }, input: { kind },
});
const passive = (loss = 8): OpticalChallenge => ({ kind: 'optical-passive', profile: structuredClone(profile), compatible: true, loss: { value: loss, unit: 'dB' } });
const range = (receive = -1): OpticalChallenge => ({
  kind: 'optical-receive-range', compatible: true, receive: { value: receive, unit: 'dBm' },
  sensitivity: { value: -14, unit: 'dBm' }, maximumReceive: { value: -1, unit: 'dBm' },
  requiredMargin: { value: 2, unit: 'dB' }, inclusiveBounds: true,
});
const run = (challenge: unknown, action: unknown = command(), current: unknown = world) => evaluateOptics(
  challenge as OpticalChallenge, action as DomainAction<OpticalInput>, current as WorldVersion,
);
function reference(id: string): Case {
  const entry = [...physical.referenceCases, ...physical.reviewCases].find(value => value.id === id);
  if (!entry) throw new Error(`Missing independent case ${id}`);
  return entry;
}
function assertCase(id: string, challenge: unknown, action?: unknown) {
  const expected = reference(id).expected;
  const result = run(challenge, action ?? command());
  expect(result.status).toBe(expected.status);
  expect(result.observations[0]).toMatchObject(expected.observation);
  expect(result.acceptedEffects).toEqual([]);
  return result;
}

/** These IDs execute the unchanged T006/T014 literals against the real evaluator. */
export const opticalCaseIds = [
  'T04', 'T05', 'T06', 'T07', 'T15', 'B-OPT-MAX', 'B-OPT-OVER', 'B-OPT-RESERVE',
  'I-PHY06', 'C-ERROR-INCONSISTENT',
] as const;

describe('independently reviewed optical cases', () => {
  it.each(['T04', 'T05', 'T15', 'B-OPT-RESERVE'])('%s computes the reviewed passive level and reserve', id => {
    const input = reference(id).inputs;
    assertCase(id, { kind: 'optical-passive', profile, compatible: input['compatible'], loss: input['loss'] });
  });
  it.each(['T06', 'B-OPT-OVER'])('%s tests a separately supplied overload observation without inheriting transmit', id => {
    const input = reference(id).inputs;
    assertCase(id, { kind: 'optical-overload', compatible: input['compatible'],
      receive: input['receivedObservation'] ?? input['receive'], maximumReceive: input['maximumReceive'] });
  });
  it('B-OPT-MAX includes the exact receive maximum', () => {
    assertCase('B-OPT-MAX', { kind: 'optical-receive-range', ...reference('B-OPT-MAX').inputs, inclusiveBounds: true });
  });
  it('T07 rejects scoped known incompatible profiles without pretending to inspect absent fields', () => {
    const input = reference('T07').inputs;
    const result = assertCase('T07', { kind: 'optical-compatibility', knownProfiles: input['knownProfiles'], compatible: input['compatible'] }, command('check-compatibility'));
    expect(result.observations[0]).toMatchObject({ scope: 'profile compatibility only', powerBudgetProven: false });
    expect(result.observations[0]).not.toHaveProperty('receive');
  });
  it('I-PHY06 has no learner input to grade', () => {
    assertCase('I-PHY06', passive(), { ...command(), input: reference('I-PHY06').inputs['learnerAction'] });
  });
  it('C-ERROR-INCONSISTENT rejects a claimed receive level inconsistent with the passive model', () => {
    const input = reference('C-ERROR-INCONSISTENT').inputs;
    const result = assertCase('C-ERROR-INCONSISTENT', { ...passive(), loss: input['passiveLoss'], authoredReceive: input['receive'] });
    expect(result.observations[0]).toMatchObject({ issue: { code: 'inconsistent-passive-model' } });
  });
});

describe('optical scope and exact decimal boundaries', () => {
  it.each([
    [0, -3, 11, true, true, 'correct'],
    [9, -12, 2, true, true, 'correct'],
    [9.000000000000002, -12.000000000000002, 1.999999999999998, true, false, 'incorrect'],
    [11, -14, 0, true, false, 'incorrect'],
    [11.01, -14.01, -0.01, false, false, 'incorrect'],
  ] as const)('loss %s preserves sensitivity and reserve independently', (loss, receive, margin, sensitivityMet, reserveMet, status) => {
    expect(run(passive(loss))).toMatchObject({ status, acceptedEffects: [], observations: [{
      receive: { value: receive, unit: 'dBm' }, margin: { value: margin, unit: 'dB' },
      sensitivityMet, reserveMet, overload: false, wholeRouteProven: false, serviceProven: false,
      scope: 'passive optical receive range and reserve only', version: world,
    }] });
  });
  it.each([
    [-1, false, 'correct'], [-0.9999999999999999, true, 'incorrect'],
    [-1.0000000000000002, false, 'correct'], [-14, false, 'incorrect'],
    [-14.000000000000002, false, 'incorrect'],
  ] as const)('supplied receive %s uses inclusive exact comparisons', (receive, overload, status) => {
    expect(run(range(receive))).toMatchObject({ status, observations: [{ overload, scope: 'observed optical receive range and reserve only' }] });
  });
  it('retains an exactly consistent passive receive assertion', () => {
    expect(run({ ...passive(9.01), authoredReceive: { value: -12.01, unit: 'dBm' } })).toMatchObject({ status: 'incorrect', observations: [{ margin: { value: 1.99, unit: 'dB' } }] });
  });
  it('rejects incompatibility before emitting successful numerical evidence', () => {
    const result = run({ ...passive(), compatible: false });
    expect(result).toMatchObject({ status: 'incorrect', reasonCode: 'incompatible-profiles', observations: [{ arithmeticCannotOverride: true, usableLink: false, powerBudgetProven: false }] });
    expect(result.observations[0]).not.toHaveProperty('receive');
    expect(result.observations[0]).not.toHaveProperty('margin');
  });
  it('returns detached JSON data and never changes the input or capture', () => {
    const challenge = passive();
    const action = command();
    const snapshot = structuredClone({ challenge, action, world });
    const first = run(challenge, action);
    expect({ challenge, action, world }).toEqual(snapshot);
    const record = first.observations[0] as unknown as { version: { configurationRevision: number }; receive: { value: number } };
    record.version.configurationRevision = 99;
    record.receive.value = 0;
    const second = run(challenge, action);
    expect(second).toMatchObject({ observations: [{ version: world, receive: { value: -11, unit: 'dBm' } }] });
    expect(JSON.parse(JSON.stringify(second))).toEqual(second);
  });
  it('captures only the two freshness fields and retains the reviewed model identity', () => {
    const result = run(passive(), command(), { ...world, unrelatedSecret: 'not-evidence' });
    expect(result.observations[0]).toMatchObject({ profileId: profile.id, ruleId: 'spec001:PHY06' });
    expect((result.observations[0] as unknown as { version: unknown }).version).toEqual(world);
  });
});

describe('authored validation always precedes command or compatibility grading', () => {
  const malformed: [string, () => unknown][] = [
    ['missing challenge', () => null],
    ['unsupported kind', () => ({ ...passive(), kind: 'optical-amplifier' })],
    ['unsupported field', () => ({ ...passive(), gain: { value: 2, unit: 'dB' } })],
    ['missing profile', () => ({ ...passive(), profile: undefined })],
    ['unknown profile', () => ({ ...passive(), profile: { ...profile, id: 'spec001:PROFILE-UNKNOWN' } })],
    ['unknown metadata', () => ({ ...passive(), profile: { ...profile, inventedStandard: true } })],
    ['altered transmit', () => ({ ...passive(), profile: { ...profile, parameters: { ...profile.parameters, transmit: { value: 0, unit: 'dBm' } } } })],
    ['altered inclusive policy', () => ({ ...passive(), profile: { ...profile, parameters: { ...profile.parameters, inclusiveBounds: false } } })],
    ['missing compatibility', () => ({ ...passive(), compatible: undefined })],
    ['string compatibility', () => ({ ...passive(), compatible: 'true' })],
    ['negative passive loss', () => passive(-0.01)],
    ['wrong loss unit', () => ({ ...passive(), loss: { value: 8, unit: 'dBm' } })],
    ['missing loss unit', () => ({ ...passive(), loss: { value: 8 } })],
    ['coerced numeric loss', () => ({ ...passive(), loss: { value: '8', unit: 'dB' } })],
    ['extra quantity metadata', () => ({ ...passive(), loss: { value: 8, unit: 'dB', approximate: true } })],
    ['NaN loss', () => passive(Number.NaN)],
    ['infinite loss', () => passive(Infinity)],
    ['infinite receive', () => range(Infinity)],
    ['wrong receive unit', () => ({ ...range(), receive: { value: -1, unit: 'dB' } })],
    ['inverted receiver bounds', () => ({ ...range(), sensitivity: { value: 0, unit: 'dBm' } })],
    ['unreviewed reserve', () => ({ ...range(), requiredMargin: { value: 0, unit: 'dB' } })],
    ['negative reserve', () => ({ ...range(), requiredMargin: { value: -2, unit: 'dB' } })],
    ['mixed observed/passive scopes', () => ({ ...range(), transmit: { value: -3, unit: 'dBm' }, loss: { value: 0, unit: 'dB' } })],
    ['contradictory passive reading', () => ({ ...passive(0), authoredReceive: { value: 0, unit: 'dBm' } })],
    ['wrong asserted receive unit', () => ({ ...passive(), authoredReceive: { value: -11, unit: 'dB' } })],
    ['explicit undefined assertion', () => ({ ...passive(), authoredReceive: undefined })],
  ];
  it.each(malformed)('%s is nonpunitive content-error even with a stale or absent command', (_label, make) => {
    for (const action of [command(), null, { ...command(), expectedVersion: { ...world, configurationRevision: 7 } }]) {
      const result = run(make(), action);
      expect(result).toMatchObject({ status: 'content-error', acceptedEffects: [], observations: [{ attemptPenalty: 0, progressAward: 0 }] });
    }
  });
  it('validates malformed loss before known incompatibility', () => {
    expect(run({ ...passive(-1), compatible: false }).status).toBe('content-error');
  });
  it('validates contradictory author receive before known incompatibility', () => {
    expect(run({ ...passive(0), compatible: false, authoredReceive: { value: 0, unit: 'dBm' } }).status).toBe('content-error');
  });
  it.each(['transmit', 'sensitivity', 'maximumReceive'] as const)('checks %s level dimensions and finiteness independently', field => {
    for (const quantity of [{ value: -3, unit: 'dB' }, { value: NaN, unit: 'dBm' }, { value: Infinity, unit: 'dBm' }]) {
      expect(run({ ...passive(), profile: { ...profile, parameters: { ...profile.parameters, [field]: quantity } } }).status).toBe('content-error');
    }
  });
  it.each([
    { ...command(), expectedVersion: { ...world, configurationRevision: 7 } },
    { ...command(), expectedVersion: { ...world, attemptId: 'previous-attempt' } },
  ])('rejects stale captured command %# without measurements', action => {
    expect(run(passive(), action)).toMatchObject({ status: 'invalid-input', reasonCode: 'stale-action', acceptedEffects: [] });
  });
  it.each([null, {}, { kind: 'measure-optics', answer: 42 }, { kind: 'unknown' }])('rejects malformed or missing action input %#', input => {
    expect(run(passive(), { ...command(), input }).status).toBe('invalid-input');
  });
  it('rejects an action for the wrong predicate', () => {
    expect(run(passive(), command('check-compatibility'))).toMatchObject({ status: 'invalid-input', reasonCode: 'action-does-not-match-predicate' });
  });
});
