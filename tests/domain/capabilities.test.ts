// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateCapabilities } from '../../src/domain/capabilities';
import type { CapabilitiesChallenge, CapabilitiesInput, CapabilitiesProfile } from '../../src/domain/capabilities';
import type { DomainAction, WorldVersion } from '../../src/domain/types';

interface Case { id: string; inputs: Record<string, unknown>; expected: { status: string; observation: Record<string, unknown> } }
const source = JSON.parse(readFileSync(new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8')) as { referenceCases: Case[]; reviewCases: Case[] };
const profiles = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as { records: CapabilitiesProfile[] };
const profile = profiles.records.find(p => p.id === 'spec001:PROFILE-CAPABILITIES')!;
const world = { configurationRevision: 4, attemptId: 'capability-attempt' } as WorldVersion;
function mode(value = 100, duplex = 'full', unit = 'Mbps') { return { rate: { value, unit }, duplex }; }
function action(input: unknown = { kind: 'inspect-common' }) { return { actionId: 'inspect-capabilities', expectedVersion: { ...world }, input }; }
function challenge(overrides: Record<string, unknown> = {}) { return { kind: 'common-capabilities', profile, bothNegotiate: true, ...overrides }; }
function evaluate(value: unknown, command: unknown = action(), current: unknown = world) { return evaluateCapabilities(value as CapabilitiesChallenge, command as DomainAction<CapabilitiesInput>, current as WorldVersion); }
function noAward(result: ReturnType<typeof evaluate>) {
  expect(result.acceptedEffects).toEqual([]);
  for (const observation of result.observations) {
    expect(observation).not.toHaveProperty('equipmentReady', true);
    expect(observation).not.toHaveProperty('objectiveComplete');
    expect(observation).not.toHaveProperty('serviceProven', true);
    expect(observation).not.toHaveProperty('throughputProven', true);
  }
}
function authorError(value: unknown) {
  for (const command of [null, action(null), { ...action(), expectedVersion: { ...world, attemptId: 'old' } }]) {
    const result = evaluate(value, command); expect(result.status).toBe('content-error');
    expect(result.observations).toMatchObject([{ kind: 'content-error', attemptPenalty: 0, progressAward: 0 }]); noAward(result);
  }
}

describe('T073 common capabilities from the unchanged T006/T014 oracle', () => {
  it('T11: returns only the common 100/full and maps reviewed Mb/s to runtime Mbps', () => {
    const fixture = source.referenceCases.find(c => c.id === 'T11')!;
    const common = (fixture.expected.observation['common'] as { rate: { value: number; unit: string }; duplex: string }[]).map(value => ({ ...value, rate: { ...value.rate, unit: 'Mbps' } }));
    const result = evaluate(challenge({ bothNegotiate: fixture.inputs['bothNegotiate'] }));
    expect(result.status).toBe(fixture.expected.status);
    expect(result.observations).toMatchObject([{ common, scope: 'common advertised capabilities only', version: world, wholeRouteProven: false }]);
    expect(result.observations[0]).not.toHaveProperty('selected'); noAward(result);
  });
  it('C-NEG-WRONG: selecting 1000/full does not grant B unsupported capability', () => {
    const fixture = source.reviewCases.find(c => c.id === 'C-NEG-WRONG')!;
    const result = evaluate(challenge(), action({ kind: 'select-capability', selected: fixture.inputs['selected'] }));
    expect(result.status).toBe(fixture.expected.status); expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ common: [mode()], selected: mode(1000), supportedByA: true, supportedByB: false }]); noAward(result);
  });
  it('B-NEG-NONE: reviewed disjoint subsets have no common mode or invented fallback', () => {
    const fixture = source.reviewCases.find(c => c.id === 'B-NEG-NONE')!;
    const result = evaluate(challenge({ endpointA: fixture.inputs['A'], endpointB: fixture.inputs['B'], bothNegotiate: fixture.inputs['bothNegotiate'] }));
    expect(result.status).toBe(fixture.expected.status); expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ common: [] }]); expect(result.observations[0]).not.toHaveProperty('selected'); noAward(result);
  });
  it('I-PHY09: absence of learner input has no physical verdict', () => {
    const result = evaluate(challenge(), action(null)); expect(result.status).toBe('invalid-input');
    expect(result.reasonCode).toBe('required-action-missing'); noAward(result);
  });
});

describe('T073 supported capability selection and authored boundary', () => {
  it.each(['Mbps', 'Mb/s'])('accepts the common mode with the exact %s alias', unit => {
    const result = evaluate(challenge(), action({ kind: 'select-capability', selected: mode(100, 'full', unit) }));
    expect(result.status).toBe('correct'); expect(result.observations).toMatchObject([{ selected: mode(), common: [mode()], supportedByA: true, supportedByB: true }]); noAward(result);
  });
  it.each([
    { selected: mode(10, 'half'), reason: 'unsupported-by-A' },
    { selected: mode(100, 'half'), reason: 'unsupported-by-both' },
    { selected: mode(2500), reason: 'unsupported-by-both' },
  ])('does not invent support: $reason $selected', ({ selected, reason }) => {
    const result = evaluate(challenge(), action({ kind: 'select-capability', selected }));
    expect(result.status).toBe('incorrect'); expect(result.reasonCode).toBe(reason); noAward(result);
  });
  it.each([
    { bothNegotiate: false }, { bothNegotiate: undefined }, { bothNegotiate: 'true' },
    { forcedMode: mode() }, { rankingRule: 'fastest' }, { endpointA: [mode()] },
    { endpointA: [], endpointB: [mode()] }, { endpointA: new Array(1), endpointB: [mode()] },
    { endpointA: [mode(), undefined], endpointB: [mode()] },
    { endpointA: [mode(), mode(100, 'full', 'Mb/s')], endpointB: [mode()] },
    { endpointA: [mode()], endpointB: [mode(1000)] },
    { endpointA: [mode(100, 'half')], endpointB: [mode(100, 'half')] },
    { endpointA: [mode(NaN)], endpointB: [mode()] }, { endpointA: [mode(Infinity)], endpointB: [mode()] },
    { endpointA: [mode(-1)], endpointB: [mode()] }, { endpointA: [mode(0)], endpointB: [mode()] },
    { endpointA: [mode(100, 'full', 'Gbps')], endpointB: [mode()] },
    { endpointA: [{ ...mode(), lanes: 4 }], endpointB: [mode()] },
  ])('rejects malformed or unreviewed authored facts before a command: %j', overrides => authorError(challenge(overrides)));
  it.each([
    { id: 'spec001:UNKNOWN' }, { reviewedProfileId: 'spec001:UNKNOWN' }, { magicFallback: mode() },
    { parameters: { ...profile.parameters, extra: true } },
    { parameters: { ...profile.parameters, endpointB: [mode(1000), mode()] } },
    { parameters: { ...profile.parameters, endpointA: [mode()] } },
    { parameters: { ...profile.parameters, endpointB: [mode(), mode()] } },
    { model: null },
    { model: { label: 'real-standard', scope: 'Universal Ethernet rule', assumptions: [], limitations: [] } },
    { model: { label: 'toy-negotiation', scope: 'Supplied teaching model', assumptions: [], limitations: [], rankingRule: 'fastest' } },
    { model: { label: 'toy-negotiation', scope: 'Supplied teaching model', assumptions: new Array(1), limitations: [] } },
  ])('rejects unknown, changed or duplicate profile advertisements: %j', override => authorError(challenge({ profile: { ...profile, ...override } })));
  it.each([null, {}, { kind: 'inspect-common', selected: mode() }, { kind: 'select-capability' },
    { kind: 'select-capability', selected: mode(NaN) }, { kind: 'select-capability', selected: mode(-1) },
    { kind: 'select-capability', selected: mode(100, 'auto') }, { kind: 'select-capability', selected: mode(100, 'full', 'Gbps') },
    { kind: 'select-capability', selected: { rate: { value: '100', unit: 'Mbps' }, duplex: 'full' } },
    { kind: 'force-mode', selected: mode() },
  ])('rejects malformed learner input %j', input => { const result = evaluate(challenge(), action(input)); expect(result.status).toBe('invalid-input'); noAward(result); });
  it('accepts reordered sets and exact runtime alias without changing support', () => {
    const reordered = { ...profile, parameters: { endpointA: [mode(), mode(1000)], endpointB: [mode(10, 'half'), mode()] } };
    const result = evaluate(challenge({ profile: reordered })); expect(result.status).toBe('correct');
    expect(result.observations).toMatchObject([{ common: [mode()] }]);
  });
  it('rejects both stale captures without awarding progress', () => {
    for (const expectedVersion of [{ ...world, configurationRevision: 3 }, { ...world, attemptId: 'old' }]) {
      const result = evaluate(challenge(), { ...action(), expectedVersion }); expect(result.status).toBe('invalid-input'); expect(result.reasonCode).toBe('stale-action'); noAward(result);
    }
  });
  it('returns detached sets and selected mode without mutating author or learner data', () => {
    const value = challenge(); const command = action({ kind: 'select-capability', selected: mode() });
    const before = structuredClone({ value, command, world }); const first = evaluate(value, command); const second = evaluate(value, command);
    expect(first).toEqual(second); expect({ value, command, world }).toEqual(before);
    const observation = first.observations[0] as unknown as { common: { rate: { value: number } }[]; selected: { rate: { value: number } }; version: { configurationRevision: number } };
    observation.common[0]!.rate.value = 999; observation.selected.rate.value = 10; observation.version.configurationRevision = 9;
    expect(evaluate(value, command)).toEqual(second); noAward(second);
  });
  it('captures only configuration revision and attempt, without copying unrelated world fields', () => {
    const result = evaluate(challenge(), action(), { ...world, privateOperatorNote: 'not measurement data', extraState: { inventory: ['unrelated-item'] } });
    expect(result.observations).toMatchObject([{ version: world }]);
    expect((result.observations[0] as { version: unknown }).version).toEqual(world);
  });
});
