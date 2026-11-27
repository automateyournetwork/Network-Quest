// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateRadio } from '../../src/domain/radio';
import type { RadioChallenge, RadioInput, RadioProfile } from '../../src/domain/radio';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, EvaluationStatus, WorldVersion } from '../../src/domain/types';

type ObjectValue = Record<string, unknown>;
interface Case { id: string; inputs: ObjectValue; expected: { status: EvaluationStatus; observation: ObjectValue } }
const fixture = JSON.parse(readFileSync(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as {
  referenceCases: Case[]; reviewCases: Case[]; profiles: RadioProfile[];
};
const sourceProfile = fixture.profiles.find(profile => profile.id === 'spec001:PROFILE-RADIO')!;
const authored = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as { records: RadioProfile[] };
const profile = authored.records.find(profile => profile.id === 'spec001:PROFILE-RADIO')!;
const cases = new Map([...fixture.referenceCases, ...fixture.reviewCases].map(entry => [entry.id, entry]));
const world: WorldVersion = { configurationRevision: 8 as ConfigurationRevision, attemptId: 'attempt-a' as AttemptId };
const action = (input: unknown = { kind: 'measure-snr' }): DomainAction<RadioInput> => ({
  actionId: 'measure-radio' as ActionId, expectedVersion: { ...world }, input: input as RadioInput,
});
function snr(): RadioChallenge {
  return { kind: 'radio-snr', profile: structuredClone(profile), signal: { value: -65, unit: 'dBm' }, noise: { value: -90, unit: 'dBm' }, otherPathChecks: true };
}
function evaluate(challenge: unknown = snr(), input: unknown = { kind: 'measure-snr' }) {
  return evaluateRadio(challenge as RadioChallenge, action(input), world);
}
function object(value: unknown): ObjectValue { return value as ObjectValue; }
function assertContentError(challenge: unknown, code?: string) {
  // Even an absent learner action cannot hide an authoring error.
  const result = evaluate(challenge, null);
  expect(result).toMatchObject({ status: 'content-error', reasonCode: 'malformed-authored-challenge', acceptedEffects: [], observations: [
    { kind: 'content-error', attemptPenalty: 0, progressAward: 0, ...(code ? { issue: { code } } : {}) },
  ] });
  expect(JSON.parse(JSON.stringify(result))).toEqual(result);
}

describe('T072 reviewed radio predicates — independent T006/T014 literal outcomes', () => {
  it.each(['T08', 'T09', 'B-RADIO-20', 'B-RADIO-BELOW'])('%s executes signed dBm subtraction and the declared inclusive threshold', id => {
    const entry = cases.get(id)!;
    const result = evaluate({ kind: 'radio-snr', profile: sourceProfile,
      signal: entry.inputs['signal'], noise: entry.inputs['noise'], otherPathChecks: entry.inputs['otherPathChecks'] });
    expect(result.status).toBe(entry.expected.status);
    expect(result.observations[0]).toMatchObject(entry.expected.observation);
    expect(result.observations[0]).toMatchObject({ kind: 'radio-snr', version: world,
      throughputProven: false, wholeRouteProven: false, minimum: { value: 20, unit: 'dB' } });
    expect(result.acceptedEffects).toEqual([]);
  });

  it('B-RADIO-PATH cannot override incompatible settings with a nominal 25 dB budget', () => {
    const entry = cases.get('B-RADIO-PATH')!;
    // This case supplies only the settings predicate; no path fact is fabricated.
    const result = evaluate({ kind: 'radio-settings', profile: sourceProfile,
      settingsCompatible: entry.inputs['selectedRadioSettingsCompatible'] }, { kind: 'check-settings' });
    expect(result.status).toBe(entry.expected.status);
    expect(result.observations[0]).toMatchObject(entry.expected.observation);
    expect(result.observations[0]).not.toHaveProperty('snr');
    expect(result.observations[0]).not.toHaveProperty('viablePath');
    expect(result.acceptedEffects).toEqual([]);
  });

  it('I-PHY07 reports an absent action separately from learner failure', () => {
    const entry = cases.get('I-PHY07')!;
    const result = evaluate(snr(), entry.inputs['learnerAction']);
    expect(result.status).toBe(entry.expected.status);
    expect(result.observations[0]).toMatchObject(entry.expected.observation);
    expect(result.acceptedEffects).toEqual([]);
  });

  it('uses both the T006 source projection and T069 authored profile without changing the rule', () => {
    expect(evaluate({ ...snr(), profile: sourceProfile })).toEqual(evaluate());
  });
});

describe('T072 signed quantity and exact-comparison boundaries', () => {
  it.each([
    [-65.01, -85.01, 20, 'correct'],
    [-65, -84.99999999999999, 19.99999999999999, 'incorrect'],
    [-65, -85.00000000000001, 20.00000000000001, 'correct'],
    [-90, -65, -25, 'incorrect'],
    [0, 0, 0, 'incorrect'],
    [5, -15, 20, 'correct'],
    [1e-7, -19.9999999, 20, 'correct'],
  ] as const)('%s dBm minus %s dBm is %s dB (%s)', (signal, noise, expected, status) => {
    const result = evaluate({ ...snr(), signal: { value: signal, unit: 'dBm' }, noise: { value: noise, unit: 'dBm' } });
    expect(result.status).toBe(status);
    expect(result.observations[0]).toMatchObject({ snr: { value: expected, unit: 'dB' }, thresholdMet: status === 'correct', throughputProven: false });
  });

  it('keeps path prerequisite failure separate from a passing SNR', () => {
    const result = evaluate({ ...snr(), otherPathChecks: false });
    expect(result).toMatchObject({ status: 'incorrect', reasonCode: 'path-prerequisite-fails', acceptedEffects: [] });
    expect(result.observations[0]).toMatchObject({ usableLink: false, reason: 'path-prerequisite-fails' });
    expect(result.observations[0]).not.toHaveProperty('thresholdMet');
  });

  it.each(['signal', 'noise'])('rejects absent %s rather than guessing a signal/noise value', field => {
    const challenge = object(snr()); delete challenge[field]; assertContentError(challenge);
  });

  it.each([NaN, Infinity, -Infinity, '20', null, undefined])('rejects nonfinite/coerced dBm value %s', value => {
    assertContentError({ ...snr(), signal: { value, unit: 'dBm' } }, 'invalid-quantity-value');
  });

  it.each([{ value: -65 }, { value: -65, unit: 'dB' }, { value: -65, unit: 'W' }, { value: -65, unit: 'dBm', extra: true }, null])('rejects malformed or dimensionally wrong power %j', signal => {
    assertContentError({ ...snr(), signal });
  });

  it('rejects overflow in otherwise finite power subtraction', () => {
    assertContentError({ ...snr(), signal: { value: Number.MAX_VALUE, unit: 'dBm' }, noise: { value: -Number.MAX_VALUE, unit: 'dBm' } }, 'unrepresentable-snr');
  });
});

describe('T072 authored-content precedence and unsupported model checks', () => {
  it.each([
    null,
    { id: 'spec001:PROFILE-UNKNOWN', parameters: { requiredSNR: { value: 20, unit: 'dB' }, inclusiveMinimum: true } },
    { ...profile, reviewedProfileId: 'spec001:PROFILE-UNKNOWN' },
    { ...profile, parameters: { requiredSNR: { value: -20, unit: 'dB' }, inclusiveMinimum: true } },
    { ...profile, parameters: { requiredSNR: { value: 20, unit: 'dBm' }, inclusiveMinimum: true } },
    { ...profile, parameters: { requiredSNR: { value: Infinity, unit: 'dB' }, inclusiveMinimum: true } },
    { ...profile, parameters: { requiredSNR: { value: 19, unit: 'dB' }, inclusiveMinimum: true } },
    { ...profile, parameters: { requiredSNR: { value: 20, unit: 'dB' }, inclusiveMinimum: false } },
    { ...profile, parameters: { requiredSNR: { value: 20, unit: 'dB' }, inclusiveMaximum: true } },
    { ...profile, parameters: { ...profile.parameters, maximumSNR: { value: 10, unit: 'dB' } } },
    { ...profile, rankedChannels: [1, 6, 11] },
  ])('rejects unknown, altered or reversed authored profile %j', invalidProfile => {
    assertContentError({ ...snr(), profile: invalidProfile });
  });

  it.each([undefined, null, 0, 'true'])('requires explicit boolean path facts (%s)', otherPathChecks => {
    assertContentError({ ...snr(), otherPathChecks });
  });

  it.each([
    { ...snr(), kind: 'radio-throughput' },
    { ...snr(), throughputMbps: 300 },
    { ...snr(), bestChannel: 6 },
    { ...snr(), viablePath: true },
    null,
  ])('rejects unsupported model fields without ignoring them %j', challenge => assertContentError(challenge));

  it('validates malformed authored power even when settings are incompatible and the action is stale', () => {
    const capture = action({ kind: 'measure-link' });
    const result = evaluateRadio({ kind: 'radio-link', profile, viablePath: true, settingsCompatible: false,
      signal: { value: NaN, unit: 'dBm' }, noise: { value: -90, unit: 'dBm' } }, capture,
    { ...world, configurationRevision: 9 as ConfigurationRevision });
    expect(result.status).toBe('content-error');
    expect(result.acceptedEffects).toEqual([]);
  });
});

describe('T072 action capture and pure detached output', () => {
  it.each([{}, '', [], { kind: 'change-channel' }, { kind: 'measure-snr', channel: 6 }])('does not treat malformed/change-only input %j as a new measurement', input => {
    expect(evaluate(snr(), input)).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
  });

  it.each(['check-settings', 'check-path', 'measure-link'])('rejects %s for the SNR-only predicate', kind => {
    expect(evaluate(snr(), { kind })).toMatchObject({ status: 'invalid-input', reasonCode: 'action-does-not-match-predicate', acceptedEffects: [] });
  });

  it.each([
    { ...world, configurationRevision: 9 as ConfigurationRevision },
    { ...world, attemptId: 'attempt-b' as AttemptId },
  ])('does not recapture an old action against a newer world %j', current => {
    expect(evaluateRadio(snr(), action(), current)).toMatchObject({ status: 'invalid-input', reasonCode: 'stale-action', acceptedEffects: [] });
  });

  it.each([null, {}, { ...action(), actionId: '' }, { ...action(), expectedVersion: { ...world, configurationRevision: -1 } }])('rejects malformed capture %j', capture => {
    expect(evaluateRadio(snr(), capture as DomainAction<RadioInput>, world)).toMatchObject({ status: 'invalid-input', reasonCode: 'malformed-action-envelope', acceptedEffects: [] });
  });

  it('repeated evaluation is deterministic, detached and does not mutate its inputs or award effects', () => {
    const challenge = snr(); const capture = action(); const current = { ...world };
    const before = structuredClone({ challenge, capture, current });
    const first = evaluateRadio(challenge, capture, current);
    const repeated = evaluateRadio(challenge, capture, current);
    expect(first).toEqual(repeated);
    expect(first.acceptedEffects).toEqual([]);
    expect({ challenge, capture, current }).toEqual(before);
    object(first.observations[0])['version'] = { configurationRevision: 99, attemptId: 'tampered' };
    object(object(first.observations[0])['signal'])['value'] = 99;
    expect(evaluateRadio(challenge, capture, current)).toEqual(repeated);
    object(challenge)['signal'] = { value: -10, unit: 'dBm' };
    expect(repeated.observations[0]).toMatchObject({ signal: { value: -65, unit: 'dBm' }, version: world });
    expect(JSON.parse(JSON.stringify(repeated))).toEqual(repeated);
  });
});
