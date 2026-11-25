// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateCopper } from '../../src/domain/copper';
import type { CopperChallenge, CopperInput, CopperObservation, CopperProfile } from '../../src/domain/copper';
import { evaluateAuthoredQuantity } from '../../src/domain/evaluate';
import type { BoundaryObservation } from '../../src/domain/evaluate';
import type { DomainAction, EvaluationResult, WorldVersion } from '../../src/domain/types';
import { copperCaseIds } from './copper-case-ids';

interface ReviewedCase {
  id: string;
  inputs: Record<string, unknown>;
  expected: { status: string; observation: Record<string, unknown> };
}
const review = JSON.parse(readFileSync(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as {
  referenceCases: ReviewedCase[]; reviewCases: ReviewedCase[];
  profiles: { id: string; parameters: CopperProfile['parameters'] }[];
};
const cases = [...review.referenceCases, ...review.reviewCases];
const profile = review.profiles.find(p => p.id === 'spec001:PROFILE-COPPER-100')! as CopperProfile;
const world = { configurationRevision: 4, attemptId: '6a75116f-801c-4f77-984b-43f7f9fac35e' } as WorldVersion;
function action(kind: CopperInput['kind'] = 'measure-length'): DomainAction<CopperInput> {
  return { actionId: 'measure-copper', expectedVersion: { ...world }, input: { kind } } as DomainAction<CopperInput>;
}
function lengthChallenge(lengths: unknown = [{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }]): CopperChallenge {
  return { kind: 'copper-length', profile, lengths } as CopperChallenge;
}
function continuityChallenge(requiredConductors: unknown): CopperChallenge {
  return { kind: 'copper-continuity', profile, requiredConductors } as CopperChallenge;
}
type Result = EvaluationResult<CopperObservation | BoundaryObservation, never>;
function checkedObservation(result: Result, kind: CopperObservation['kind'] | BoundaryObservation['kind']) {
  const observation = result.observations.find(o => o.kind === kind);
  expect(observation, `Missing ${kind} observation`).toBeDefined();
  return observation!;
}
function authoredError(result: Result, entry: ReviewedCase): void {
  expect(result.status).toBe(entry.expected.status);
  expect(result.reasonCode).toBe('malformed-authored-challenge');
  expect(result.acceptedEffects).toEqual([]);
  const observation = checkedObservation(result, 'content-error');
  expect(observation).toMatchObject(entry.expected.observation);
  expect(observation).toMatchObject({ progressAward: 0, attemptPenalty: 0 });
}

describe('T024 executes reviewed cases against real domain evaluation', () => {
  it.each(copperCaseIds)('%s: independent reviewed result', id => {
    const entry = cases.find(c => c.id === id)!;
    expect(entry, `Reviewed ${id} is required`).toBeDefined();
    const input = entry.inputs;
    if (['T01', 'T02', 'B-COPPER-100', 'B-COPPER-OVER'].includes(id)) {
      // PHY04 is length only. T02 supplies no continuity/compatibility facts;
      // T01's additional true flags cannot turn this into whole-route proof.
      if ('profile' in input) expect(input['profile']).toBe(profile.id);
      if ('maximum' in input) expect(input['maximum']).toEqual(profile.parameters.maximumChannelLength);
      const result = evaluateCopper(lengthChallenge(input['lengths']), action(), world);
      expect(result.status).toBe(entry.expected.status);
      expect(result.acceptedEffects).toEqual([]);
      const observation = checkedObservation(result, 'copper-length');
      expect(observation).toMatchObject({ scope: 'length only', wholeRouteProven: false });
      for (const key of ['total', 'headroom', 'excess'] as const) {
        if (!(key in entry.expected.observation)) continue;
        const expected = entry.expected.observation[key] as { value: number; unit: string };
        expect(observation).toHaveProperty(key, expected);
      }
      if ('reason' in entry.expected.observation) expect(result.reasonCode).toBe(entry.expected.observation['reason']);
    } else if (id === 'T03') {
      expect(input['alternatePath']).toBe(false);
      expect(input['continuityRestored']).toBe(false);
      // A single declared required path is open; no invented conductor count.
      const result = evaluateCopper(continuityChallenge([!input['requiredPathOpen']]), action('add-repeater'), world);
      expect(result.status).toBe(entry.expected.status);
      expect(result.reasonCode).toBe(entry.expected.observation['reason']);
      const observation = checkedObservation(result, 'copper-continuity');
      expect(observation).toMatchObject({ continuous: entry.expected.observation['connectedPath'], wholeRouteProven: false });
      expect(result.acceptedEffects).toEqual([]);
    } else if (id === 'C-CONTINUITY' || id === 'B-CONTINUITY') {
      // C is the supplied post-replacement state and a new test, not a promise
      // that merely choosing a replacement makes the path continuous.
      if (id === 'C-CONTINUITY') expect(input['freshContinuityTest']).toBe(true);
      const conductors = input['requiredConductors'] ?? [input['allRequiredConductorsIntact']];
      const result = evaluateCopper(continuityChallenge(conductors), action('test-continuity'), world);
      expect(result.status).toBe(entry.expected.status);
      const observation = checkedObservation(result, 'copper-continuity');
      expect(observation).toMatchObject({
        continuous: entry.expected.observation['continuityEstablished'] ?? entry.expected.observation['connectedRequiredPath'],
        wholeRouteProven: false,
      });
      if (id === 'B-CONTINUITY') expect(observation).toMatchObject({ openConductorIndexes: [2] });
    } else if (id === 'B-REGEN-UNREVIEWED') {
      expect(input['segmentProfilesAndLimitsProvided']).toBe(false);
      const unsupported = { kind: input['authoredChallenge'], profile } as unknown as CopperChallenge;
      authoredError(evaluateCopper(unsupported, action(), world), entry);
    } else if (id === 'C-ERROR-PROFILE') {
      const challenge = { ...lengthChallenge(), profile: { ...profile, id: input['authoredProfile'] } } as CopperChallenge;
      authoredError(evaluateCopper(challenge, action(), world), entry);
    } else if (id === 'T14') {
      expect(input['variants']).toEqual(['missing-required-unit', 'negative-passive-loss', 'unknown-authored-profile']);
      // Each named variant independently traverses the real content guard.
      authoredError(evaluateCopper(lengthChallenge([{ value: 85 }]), action(), world), entry);
      authoredError(evaluateAuthoredQuantity({ value: -0.01, unit: 'dB' }, 'dB', 'passiveLoss'), entry);
      const challenge = { ...lengthChallenge(), profile: { ...profile, id: 'spec001:UNKNOWN' } } as unknown as CopperChallenge;
      authoredError(evaluateCopper(challenge, action(), world), entry);
    } else if (id.startsWith('C-ERROR-')) {
      authoredError(evaluateAuthoredQuantity(input['loss'] ?? input['passiveLoss'], 'dB', 'passiveLoss'), entry);
    } else {
      expect(input['authoredChallengeValid']).toBe(true);
      // These vectors explicitly require a valid challenge and missing action.
      const challenge = id === 'I-PHY04' ? lengthChallenge() : continuityChallenge([true]);
      const result = evaluateCopper(challenge, { ...action(), input: input['learnerAction'] } as DomainAction<CopperInput>, world);
      expect(result.status).toBe(entry.expected.status);
      expect(result.reasonCode).toBe(entry.expected.observation['reason']);
      expect(checkedObservation(result, 'invalid-input')).toMatchObject(entry.expected.observation);
      expect(result.acceptedEffects).toEqual([]);
    }
  });
});

describe('Copper boundary and freshness regressions', () => {
  it.each([null, {}, { kind: 'unknown' }, { kind: 'measure-length', answer: 95 }])('rejects malformed learner input %j without effects', input => {
    const result = evaluateCopper(lengthChallenge(), { ...action(), input } as DomainAction<CopperInput>, world);
    expect(result.status).toBe('invalid-input');
    expect(result.acceptedEffects).toEqual([]);
  });
  it.each([NaN, Infinity, -Infinity, -1, '85', null])('rejects invalid authored length %j before grading missing input', value => {
    const result = evaluateCopper(lengthChallenge([{ value, unit: 'm' }]), { ...action(), input: null } as unknown as DomainAction<CopperInput>, world);
    expect(result.status).toBe('content-error');
    expect(result.acceptedEffects).toEqual([]);
  });
  it.each([[], [true, null], [true, 'false'], [true, 0], new Array(2)].map(conductors => ({ conductors })))('rejects missing/malformed conductor facts $conductors', ({ conductors }) => {
    expect(evaluateCopper(continuityChallenge(conductors), action('test-continuity'), world).status).toBe('content-error');
  });
  it.each([null, {}, { id: 'spec001:UNKNOWN' },
    { ...profile, parameters: { maximumChannelLength: { value: 100, unit: 's' }, inclusiveMaximum: true } },
    { ...profile, parameters: { maximumChannelLength: { value: 100 }, inclusiveMaximum: true } },
    { ...profile, parameters: { maximumChannelLength: { value: 101, unit: 'm' }, inclusiveMaximum: true } },
    { ...profile, parameters: { ...profile.parameters, inclusiveMaximum: false } },
  ])('fails closed on a malformed/unsupported profile %j', invalidProfile => {
    const challenge = { ...lengthChallenge(), profile: invalidProfile } as CopperChallenge;
    expect(evaluateCopper(challenge, action(), world).status).toBe('content-error');
  });
  it('does not guess a maximum or accept a regenerated topology from extra fields', () => {
    for (const challenge of [
      { kind: 'copper-length', lengths: [{ value: 1, unit: 'm' }] },
      { ...lengthChallenge(), segments: [{ value: 85, unit: 'm' }] },
    ]) expect(evaluateCopper(challenge as CopperChallenge, action(), world).status).toBe('content-error');
  });
  it.each([
    { ...world, configurationRevision: 3 },
    { ...world, attemptId: 'bda5d8a8-8eb3-480c-9f5a-7e955ed5f22a' },
  ])('rejects stale configuration or attempt capture %j', expectedVersion => {
    const result = evaluateCopper(lengthChallenge(), { ...action(), expectedVersion } as DomainAction<CopperInput>, world);
    expect(result.status).toBe('invalid-input');
    expect(result.reasonCode).toBe('stale-action');
    expect(result.acceptedEffects).toEqual([]);
  });
  it.each([null, {}, { ...action(), actionId: '' }, { ...action(), expectedVersion: { ...world, configurationRevision: NaN } }])('rejects malformed envelopes %j', invalidAction => {
    expect(evaluateCopper(lengthChallenge(), invalidAction as DomainAction<CopperInput>, world).status).toBe('invalid-input');
  });
  it('does not round an over-limit result into success', () => {
    const result = evaluateCopper(lengthChallenge([{ value: 100.000000000001, unit: 'm' }]), action(), world);
    expect(result.status).toBe('incorrect');
    expect(result.reasonCode).toBe('length-exceeded');
  });
  it('sums declared decimal lengths exactly at the inclusive maximum', () => {
    const result = evaluateCopper(lengthChallenge(Array.from({ length: 1000 }, () => ({ value: 0.1, unit: 'm' }))), action(), world);
    expect(result.status).toBe('correct');
    expect(checkedObservation(result, 'copper-length')).toMatchObject({ total: { value: 100, unit: 'm' }, headroom: { value: 0, unit: 'm' } });
  });
  it('rejects a total that cannot be represented as a finite reading', () => {
    const result = evaluateCopper(lengthChallenge([{ value: Number.MAX_VALUE, unit: 'm' }, { value: Number.MAX_VALUE, unit: 'm' }]), action(), world);
    expect(result.status).toBe('content-error');
  });
  it('accepts zero length as a numeric boundary without asserting a real link', () => {
    const result = evaluateCopper(lengthChallenge([{ value: 0, unit: 'm' }]), action(), world);
    expect(result.status).toBe('correct');
    expect(checkedObservation(result, 'copper-length')).toMatchObject({ total: { value: 0, unit: 'm' }, headroom: { value: 100, unit: 'm' }, wholeRouteProven: false });
  });
  it('accepts equivalent segment compositions without action identity or presentation deciding correctness', () => {
    const a = evaluateCopper(lengthChallenge([{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }]), action(), world);
    const b = evaluateCopper(lengthChallenge([{ value: 80, unit: 'm' }, { value: 15, unit: 'm' }]), { ...action(), actionId: 'another-choice' } as DomainAction<CopperInput>, world);
    expect(a.status).toBe('correct');
    expect(b).toEqual(a);
  });
  it('never treats an added repeater as a reviewed complete regeneration design', () => {
    const result = evaluateCopper(continuityChallenge([true]), action('add-repeater'), world);
    expect(result.status).toBe('invalid-input');
    expect(result.reasonCode).toBe('regeneration-not-evaluated');
    expect(result.acceptedEffects).toEqual([]);
  });
  it('returns detached deterministic observations without mutating its inputs', () => {
    const challenge = structuredClone(lengthChallenge());
    const command = action();
    const before = structuredClone({ challenge, command, world });
    const first = evaluateCopper(challenge, command, world);
    const second = evaluateCopper(challenge, command, world);
    expect(first).toEqual(second);
    expect(first.observations).not.toBe(second.observations);
    expect({ challenge, command, world }).toEqual(before);
    const mutable = first.observations as unknown as { total: { value: number } }[];
    mutable[0]!.total.value = 999;
    expect(evaluateCopper(challenge, command, world)).toEqual(second);
  });
  it('copies only freshness identifiers from a structurally wider world', () => {
    const widerWorld = { ...world, unrelatedInventory: ['item'] };
    const result = evaluateCopper(lengthChallenge(), action(), widerWorld);
    const observation = checkedObservation(result, 'copper-length');
    expect(observation).toHaveProperty('version', world);
    if ('version' in observation) expect(observation.version).not.toBe(world);
  });
  it('validates passive-loss units as content only, without performing optical scoring', () => {
    const result = evaluateAuthoredQuantity({ value: 0, unit: 'dB' }, 'dB', 'passiveLoss');
    expect(result.status).toBe('correct');
    expect(result.acceptedEffects).toEqual([]);
    expect(result.observations).toEqual([{ kind: 'authored-quantity', field: 'passiveLoss', quantity: { value: 0, unit: 'dB' }, scope: 'authored quantity only' }]);
  });
});
