// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateOptics } from '../../src/domain/optics';
import type { OpticalChallenge, OpticalInput, OpticalProfile } from '../../src/domain/optics';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, WorldVersion } from '../../src/domain/types';

interface Case { id: string; inputs: Record<string, unknown>; expected: { status: string; observation: Record<string, unknown> } }
const fixture = JSON.parse(readFileSync(new URL('../fixtures/repair-routes.json', import.meta.url), 'utf8')) as { cases: Case[] };
const physical = JSON.parse(readFileSync(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as { profiles: OpticalProfile[] };
const original = physical.profiles.find(entry => entry.id === 'spec001:PROFILE-OPTICAL')!;
const profile: OpticalProfile = { id: original.id, parameters: structuredClone(original.parameters) };
const world: WorldVersion = { configurationRevision: 8 as ConfigurationRevision, attemptId: 'repair-optical' as AttemptId };
const command = (kind: OpticalInput['kind']): DomainAction<OpticalInput> => ({
  actionId: 'repair-optical' as ActionId, expectedVersion: { ...world }, input: { kind },
});
const run = (challenge: unknown, kind: OpticalInput['kind'] = 'measure-optics') => evaluateOptics(challenge as OpticalChallenge, command(kind), world);
const entry = (id: string) => {
  const result = fixture.cases.find(value => value.id === id);
  if (!result) throw new Error(`Missing independent repair case ${id}`);
  return result;
};
const checks = { mediaMatch: true, wavelengthDirectionMatch: true, rateMatch: true, connectorPolarityMatch: true, hostSupport: true };
const preparation = () => ({ kind: 'optical-preparation', profile: structuredClone(profile), checks: { ...checks }, inspectedBeforeChange: true, connectionDefectRemoved: true });

/** Numerical/physical portions execute here; T074 still owns objective integration. */
export const opticalRepairCaseIds = [
  'RR-O05-ALTERNATIVES', 'RR-O05-NO-INSPECTION', 'RR-O05-WAVELENGTH',
  'RR-O06-ALTERNATIVES', 'RR-O06-RESERVE-NEIGHBOR', 'RR-O06-SENSITIVITY',
  'RR-O06-OBSERVED-MAX', 'RR-OPTICAL-IMPOSSIBLE',
] as const;

describe('independent optical repair predicates', () => {
  it('RR-O05-ALTERNATIVES accepts both supplied inspected interventions without awarding the objective', () => {
    const test = entry('RR-O05-ALTERNATIVES');
    const candidates = test.inputs['candidates'] as Record<string, unknown>[];
    const accepted: string[] = [];
    for (const candidate of candidates) {
      const { id, inspectedBeforeChange, connectionDefectRemoved, ...suppliedChecks } = candidate;
      const result = run({ kind: 'optical-preparation', profile, checks: suppliedChecks, inspectedBeforeChange, connectionDefectRemoved }, 'verify-preparation');
      expect(result).toMatchObject({ status: test.expected.status, acceptedEffects: [], observations: [{
        preparationComplete: true, powerBudgetProven: test.expected.observation['powerBudgetProven'], serviceProven: false,
      }] });
      if (result.status === 'correct') accepted.push(id as string);
    }
    expect(accepted).toEqual(test.expected.observation['accepted']);
  });
  it('RR-O05-NO-INSPECTION preserves the summary scope and rejects the missing inspection', () => {
    const test = entry('RR-O05-NO-INSPECTION');
    const result = run({ kind: 'optical-inspection',
      everyRequiredCompatibilityCheck: test.inputs['everyRequiredCompatibilityCheck'],
      requiredInspectionComplete: test.inputs['requiredInspectionComplete'],
    }, 'check-inspection');
    expect(result.status).toBe(test.expected.status);
    expect(result.observations[0]).toMatchObject(test.expected.observation);
  });
  it('RR-O05-WAVELENGTH rejects the supplied failed necessary predicate without inventing unsupplied polarity', () => {
    const test = entry('RR-O05-WAVELENGTH');
    expect(test.inputs['requiredWavelengthDirectionMatches']).toBe(false);
    // A false necessary predicate proves incompatibility. No positive full match,
    // inspection or power budget is inferred from this intentionally partial case.
    const result = run({ kind: 'optical-compatibility', knownProfiles: true,
      compatible: test.inputs['requiredWavelengthDirectionMatches'],
    }, 'check-compatibility');
    expect(result.status).toBe(test.expected.status);
    expect(result.observations[0]).toMatchObject(test.expected.observation);
    expect(result.observations[0]).not.toHaveProperty('receive');
  });
  it('RR-O06-ALTERNATIVES accepts both independent current loss cases without service proof', () => {
    const test = entry('RR-O06-ALTERNATIVES');
    const candidates = test.inputs['candidates'] as Record<string, unknown>[];
    const accepted: string[] = []; const receives: unknown[] = []; const margins: unknown[] = [];
    for (const candidate of candidates) {
      expect(candidate['fresh']).toBe(true);
      expect(candidate['inspectionComplete']).toBe(true);
      const result = run({ kind: 'optical-passive', profile, compatible: candidate['compatible'], loss: candidate['loss'] });
      expect(result.status).toBe(test.expected.status);
      expect(result.acceptedEffects).toEqual([]);
      expect(result.observations[0]).toMatchObject({ serviceProven: false, version: world });
      if (result.status === 'correct') accepted.push(candidate['id'] as string);
      const observation = result.observations[0] as unknown as { receive: unknown; margin: unknown };
      receives.push(observation.receive); margins.push(observation.margin);
    }
    expect(accepted).toEqual(test.expected.observation['accepted']);
    expect(receives).toEqual(test.expected.observation['receive']);
    expect(margins).toEqual(test.expected.observation['margin']);
  });
  it.each(['RR-O06-RESERVE-NEIGHBOR', 'RR-O06-SENSITIVITY'])('%s does not round failure into reserve equality', id => {
    const test = entry(id);
    const result = run({ kind: 'optical-passive', profile, compatible: test.inputs['compatible'], loss: test.inputs['loss'] });
    expect(result.status).toBe(test.expected.status);
    expect(result.observations[0]).toMatchObject(test.expected.observation);
  });
  it('RR-O06-OBSERVED-MAX does not inherit the passive transmitter', () => {
    const test = entry('RR-O06-OBSERVED-MAX');
    const { observationOnly, ...inputs } = test.inputs;
    expect(observationOnly).toBe(true);
    const result = run({ kind: 'optical-receive-range', ...inputs, inclusiveBounds: true });
    expect(result.status).toBe(test.expected.status);
    expect(result.observations[0]).toMatchObject(test.expected.observation);
  });
  it('RR-OPTICAL-IMPOSSIBLE is content-error before learner grading', () => {
    const test = entry('RR-OPTICAL-IMPOSSIBLE');
    expect(test.inputs['transmit']).toEqual(profile.parameters.transmit);
    const result = run({ kind: 'optical-passive', profile, compatible: true,
      loss: test.inputs['passiveLoss'], authoredReceive: test.inputs['authoredReceive'],
    });
    expect(result.status).toBe(test.expected.status);
    expect(result.observations[0]).toMatchObject({ attemptPenalty: test.expected.observation['attemptPenalty'],
      progressAward: test.expected.observation['progressAward'], issue: { code: test.expected.observation['reason'] } });
  });
});

describe('all explicit preparation premises are independently necessary', () => {
  it('a passing inspection summary cannot establish the connection intervention', () => {
    expect(run({ kind: 'optical-inspection', everyRequiredCompatibilityCheck: true, requiredInspectionComplete: true }, 'check-inspection')).toMatchObject({
      status: 'correct', observations: [{ inspectionComplete: true, preparationComplete: false, scope: 'preparation inspection only', powerBudgetProven: false }],
    });
  });
  it.each(Object.keys(checks))('rejects the failed %s before any optical calculation', field => {
    const challenge = preparation();
    const result = run({ ...challenge, checks: { ...challenge.checks, [field]: false } }, 'verify-preparation');
    expect(result).toMatchObject({ status: 'incorrect', reasonCode: 'incompatible-profiles', observations: [{ preparationComplete: false, powerBudgetProven: false }] });
    expect(result.observations[0]).not.toHaveProperty('receive');
  });
  it('requires inspection before change', () => {
    expect(run({ ...preparation(), inspectedBeforeChange: false }, 'verify-preparation')).toMatchObject({
      status: 'incorrect', observations: [{ reason: 'inspect-before-changing', preparationComplete: false }],
    });
  });
  it('requires the diagnosed connection defect to be removed', () => {
    expect(run({ ...preparation(), connectionDefectRemoved: false }, 'verify-preparation')).toMatchObject({
      status: 'incorrect', observations: [{ reason: 'connection-defect-remains', preparationComplete: false }],
    });
  });
  it.each(Object.keys(checks))('rejects an omitted %s as author error', field => {
    const challenge = preparation();
    const incomplete: Record<string, unknown> = { ...challenge.checks };
    delete incomplete[field];
    expect(run({ ...challenge, checks: incomplete }, 'verify-preparation').status).toBe('content-error');
  });
  it.each([
    { ...preparation(), checks: { ...checks, sameConnectorShape: true } },
    { ...preparation(), checks: { ...checks, rateMatch: 'true' } },
    { ...preparation(), inspectedBeforeChange: undefined },
    { ...preparation(), connectionDefectRemoved: undefined },
    { kind: 'optical-compatibility', knownProfiles: false, compatible: false },
    { kind: 'optical-compatibility', knownProfiles: true, compatible: undefined },
    { kind: 'optical-inspection', everyRequiredCompatibilityCheck: true },
  ])('rejects malformed preparation or summary %# without grading', challenge => {
    expect(run(challenge, 'verify-preparation')).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
});
