// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluatePower } from '../../src/domain/power';
import type { PowerChallenge, PowerInput, PowerProfile } from '../../src/domain/power';
import { evaluateCapabilities } from '../../src/domain/capabilities';
import type { CapabilitiesChallenge, CapabilitiesInput, CapabilitiesProfile } from '../../src/domain/capabilities';
import type { DomainAction, WorldVersion } from '../../src/domain/types';

interface Case { id: string; inputs: Record<string, unknown>; expected: { status: string; observation: Record<string, unknown> } }
const repair = JSON.parse(readFileSync(new URL('../fixtures/repair-routes.json', import.meta.url), 'utf8')) as { cases: Case[] };
const profiles = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as { records: (PowerProfile | CapabilitiesProfile)[] };
const powerProfile = profiles.records.find(p => p.id === 'spec001:PROFILE-POWER')!;
const capabilityProfile = profiles.records.find(p => p.id === 'spec001:PROFILE-CAPABILITIES')!;
const world = { configurationRevision: 9, attemptId: 'power-repair-attempt' } as WorldVersion;
function entry(id: string) { const fixture = repair.cases.find(c => c.id === id); if (!fixture) throw new Error(`Missing independent oracle ${id}`); return fixture; }
function power(fields: Record<string, unknown>) {
  const value = { kind: 'delivered-power', profile: powerProfile, budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses', ...fields };
  return evaluatePower(value as PowerChallenge, { actionId: 'power', expectedVersion: world, input: { kind: 'check-allocation' } } as DomainAction<PowerInput>, world);
}

describe('T073 scoped predicates against the independent T068 repair oracle', () => {
  it('RR-O09-ALTERNATIVES: both supplied equipment kits fit delivered watts and select the advertised common capability', () => {
    const fixture = entry('RR-O09-ALTERNATIVES');
    const accepted: string[] = [];
    for (const [index, candidate] of (fixture.inputs['candidates'] as Record<string, unknown>[]).entries()) {
      const { id, ...facts } = candidate;
      const result = power(facts);
      expect(result.status).toBe(fixture.expected.status);
      expect(result.observations).toMatchObject([{ total: (fixture.expected.observation['totalDemand'] as unknown[])[index], headroom: (fixture.expected.observation['headroom'] as unknown[])[index], wholeRouteProven: false }]);
      expect(result.acceptedEffects).toEqual([]); expect(result.observations[0]).not.toHaveProperty('equipmentReady', true);
      if (result.status === 'correct') accepted.push(id as string);
    }
    expect(accepted).toEqual(fixture.expected.observation['accepted']);
    const capabilities = evaluateCapabilities({ kind: 'common-capabilities', profile: capabilityProfile, bothNegotiate: fixture.inputs['bothNegotiate'] } as CapabilitiesChallenge,
      { actionId: 'capability', expectedVersion: world, input: { kind: 'select-capability', selected: fixture.inputs['selectedCapability'] } } as DomainAction<CapabilitiesInput>, world);
    expect(capabilities.status).toBe(fixture.expected.status);
    expect(capabilities.observations).toMatchObject([{ selected: { rate: { value: 100, unit: 'Mbps' }, duplex: 'full' }, wholeRouteProven: false }]);
    expect(capabilities.acceptedEffects).toEqual([]);
  });
  it('RR-O09-FORM-FACTOR-ONLY: shell fit and power do not override a declared physical mismatch', () => {
    const fixture = entry('RR-O09-FORM-FACTOR-ONLY');
    const { sameFormFactor, ...facts } = fixture.inputs;
    const result = power({ ...facts, formFactorMatch: sameFormFactor });
    expect(result.status).toBe(fixture.expected.status); expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ equipmentReady: false, budgetCannotOverride: true }]);
    expect(result.observations[0]).not.toHaveProperty('constraints.perPortConstraintsMet');
    expect(result.acceptedEffects).toEqual([]);
  });
  it('RR-O09-PER-PORT: partial supplied facts fail per-port limits without fabricating other equipment facts', () => {
    const fixture = entry('RR-O09-PER-PORT'); const result = power(fixture.inputs);
    expect(result.status).toBe(fixture.expected.status); expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ equipmentReady: false, constraints: { portPowerCompatible: true, perPortConstraintsMet: false } }]);
    for (const absent of ['formFactorMatch', 'phyAndMediaMatch', 'hostSupport', 'otherConstraints']) expect(result.observations[0]).not.toHaveProperty(`constraints.${absent}`);
    expect(result.acceptedEffects).toEqual([]);
  });
  it('RR-O09-POWER-BOUNDARY: PSE output cannot become delivered watts without a reviewed conversion model', () => {
    const fixture = entry('RR-O09-POWER-BOUNDARY');
    const result = power({ budgetBoundary: fixture.inputs['budgetBoundary'], demandBoundary: fixture.inputs['demandBoundary'], demands: fixture.inputs['demands'] });
    expect(result.status).toBe(fixture.expected.status);
    expect(result.observations).toMatchObject([{ attemptPenalty: 0, progressAward: 0, issue: { code: fixture.expected.observation['reason'] } }]);
    expect(result.acceptedEffects).toEqual([]);
  });
});
