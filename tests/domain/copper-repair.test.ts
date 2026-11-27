// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateCopper } from '../../src/domain/copper';
import type { CopperChallenge, CopperInput, CopperProfile } from '../../src/domain/copper';
import type { DomainAction, WorldVersion } from '../../src/domain/types';

interface ReviewedCase {
  id: string;
  inputs: Record<string, unknown>;
  expected: { status: string; observation: Record<string, unknown> };
}
const repair = JSON.parse(readFileSync(new URL('../fixtures/repair-routes.json', import.meta.url), 'utf8')) as { cases: ReviewedCase[] };
const profiles = JSON.parse(readFileSync(new URL('../../content/spec001/profiles.json', import.meta.url), 'utf8')) as { records: CopperProfile[] };
const profile = profiles.records.find(p => p.id === 'spec001:PROFILE-COPPER-100')!;
const world = { configurationRevision: 9, attemptId: 'copper-repair-attempt' } as WorldVersion;
function entry(id: string): ReviewedCase {
  const result = repair.cases.find(c => c.id === id);
  if (!result) throw new Error(`Missing independent repair oracle ${id}`);
  return result;
}
function action(kind = 'test-path'): DomainAction<CopperInput> {
  return { actionId: 'test-current-copper', expectedVersion: { ...world }, input: { kind } } as DomainAction<CopperInput>;
}
function evaluate(challenge: unknown, command: unknown = action()) {
  return evaluateCopper(challenge as CopperChallenge, command as DomainAction<CopperInput>, world);
}
function path(overrides: Record<string, unknown> = {}) {
  return {
    kind: 'copper-path', profile, compatible: true,
    lengths: [{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }],
    requiredConductors: [true], ...overrides,
  };
}
function noAward(result: ReturnType<typeof evaluate>) {
  expect(result.acceptedEffects).toEqual([]);
  for (const observation of result.observations) {
    expect(observation).not.toHaveProperty('preparationComplete');
    expect(observation).not.toHaveProperty('objectiveComplete');
    expect(observation).not.toHaveProperty('serviceProven', true);
  }
}
function authorError(challenge: unknown) {
  // A broken challenge takes precedence over both a missing action and a stale one.
  for (const command of [null, { ...action(), expectedVersion: { ...world, configurationRevision: 8 } }]) {
    const result = evaluate(challenge, command);
    expect(result.status).toBe('content-error');
    expect(result.observations).toMatchObject([{ kind: 'content-error', attemptPenalty: 0, progressAward: 0 }]);
    noAward(result);
  }
}

describe('T070 real copper predicates against the frozen T068 repair oracle', () => {
  it('RR-O03-ALTERNATIVES: accepts both supplied passive paths, including exactly 100 m', () => {
    const fixture = entry('RR-O03-ALTERNATIVES');
    const candidates = fixture.inputs['candidates'] as { id: string; lengths: unknown; compatible: boolean; allRequiredConductorsIntact: boolean }[];
    const accepted: string[] = [];
    for (const [index, candidate] of candidates.entries()) {
      const result = evaluate(path({ lengths: candidate.lengths, compatible: candidate.compatible, requiredConductors: [candidate.allRequiredConductorsIntact] }));
      expect(result.status).toBe(fixture.expected.status);
      expect(result.observations).toMatchObject([{
        kind: 'copper-path', scope: 'passive copper path only', compatible: true,
        continuous: true, pathPasses: true, wholeRouteProven: fixture.expected.observation['wholeRouteProven'],
        total: (fixture.expected.observation['totalLengths'] as unknown[])[index],
        headroom: (fixture.expected.observation['headrooms'] as unknown[])[index],
      }]);
      noAward(result);
      if (result.status === 'correct') accepted.push(candidate.id);
    }
    expect(accepted).toEqual(fixture.expected.observation['accepted']);
  });

  it('RR-O03-LAST-CONDUCTOR: passing compatibility and length cannot override one open conductor', () => {
    const fixture = entry('RR-O03-LAST-CONDUCTOR');
    const result = evaluate(path(fixture.inputs));
    expect(result.status).toBe(fixture.expected.status);
    expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ compatible: true, total: { value: 95, unit: 'm' }, continuous: false, openConductorIndexes: [2], pathPasses: false, wholeRouteProven: false }]);
    noAward(result);
  });

  it('RR-O03-COMPATIBILITY: the explicit termination mismatch fails without inventing other compatibility facts', () => {
    const fixture = entry('RR-O03-COMPATIBILITY');
    const result = evaluate({ kind: 'copper-termination', profile, chosenTerminationCompatible: fixture.inputs['chosenTerminationCompatible'] }, action('check-termination'));
    expect(result.status).toBe(fixture.expected.status);
    expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toEqual([{ kind: 'copper-termination', scope: 'termination compatibility only', profileId: profile.id, version: world, compatible: false, wholeRouteProven: false }]);
    noAward(result);
  });

  it('RR-O04-ALTERNATIVES: both observation methods see the same open-before/intact-after result', () => {
    const fixture = entry('RR-O04-ALTERNATIVES');
    const before = fixture.inputs['before'] as { requiredPathOpen: boolean };
    const after = fixture.inputs['after'] as { allRequiredConductorsIntact: boolean; length: unknown; compatible: boolean };
    const methods = fixture.inputs['comparisonMethods'] as string[];
    const accepted: string[] = [];
    for (const method of methods) {
      const command = { ...action('test-continuity'), actionId: method };
      const earlier = evaluate({ kind: 'copper-continuity', profile, requiredConductors: [!before.requiredPathOpen] }, command);
      const current = evaluate({ kind: 'copper-continuity', profile, requiredConductors: [after.allRequiredConductorsIntact] }, command);
      expect(earlier.status).toBe('incorrect');
      expect(earlier.observations).toMatchObject([{ continuous: false }]);
      expect(current.status).toBe(fixture.expected.status);
      expect(current.observations).toMatchObject([{ continuous: fixture.expected.observation['continuityEstablished'], wholeRouteProven: false }]);
      noAward(earlier); noAward(current);
      if (current.status === 'correct') accepted.push(method);
    }
    expect(accepted).toEqual(fixture.expected.observation['accepted']);
    // This is current path evaluation only. Historical-comparison/freshness awards belong to T074.
    const currentPath = evaluate(path({ lengths: [after.length], compatible: after.compatible, requiredConductors: [after.allRequiredConductorsIntact] }));
    expect(currentPath.status).toBe(fixture.expected.status);
    noAward(currentPath);
  });

  it('RR-O04-REPEATER: adding a powered repeater leaves the supplied physical break open', () => {
    const fixture = entry('RR-O04-REPEATER');
    const after = fixture.inputs['after'] as { requiredPathOpen: boolean; alternatePath: boolean };
    expect(after.alternatePath).toBe(false);
    const result = evaluate({ kind: 'copper-continuity', profile, requiredConductors: [!after.requiredPathOpen] }, action('add-repeater'));
    expect(result.status).toBe(fixture.expected.status);
    expect(result.reasonCode).toBe(fixture.expected.observation['reason']);
    expect(result.observations).toMatchObject([{ continuous: fixture.expected.observation['connectedPath'] }]);
    noAward(result);
  });

  it('RR-O04-UNREVIEWED-REGEN: the reviewed passive profile cannot grade a 180 m regenerative design', () => {
    const fixture = entry('RR-O04-UNREVIEWED-REGEN');
    const result = evaluate({ kind: 'copper-path', profile, ...fixture.inputs }, null);
    expect(result.status).toBe(fixture.expected.status);
    expect(result.observations).toMatchObject([{ attemptPenalty: 0, progressAward: 0, issue: { code: fixture.expected.observation['reason'] } }]);
    noAward(result);
  });
});

describe('T070 explicit authored boundaries and scoped results', () => {
  it('grades a recognized incompatible choice as incorrect before numerical path scoring', () => {
    for (const lengths of [[{ value: 95, unit: 'm' }], [{ value: 105, unit: 'm' }]]) {
      const result = evaluate(path({ compatible: false, lengths, requiredConductors: [false] }));
      expect(result.status).toBe('incorrect');
      expect(result.reasonCode).toBe('incompatible-profiles');
      expect(result.observations).toEqual([{ kind: 'copper-path', scope: 'passive copper path only', profileId: profile.id, version: world, compatible: false, pathPasses: false, wholeRouteProven: false }]);
      noAward(result);
    }
  });

  it('a termination pass cannot certify the omitted path or service', () => {
    const result = evaluate({ kind: 'copper-termination', profile, chosenTerminationCompatible: true }, action('check-termination'));
    expect(result.status).toBe('correct');
    expect(result.observations).toMatchObject([{ scope: 'termination compatibility only', compatible: true, wholeRouteProven: false }]);
    expect(result.observations[0]).not.toHaveProperty('pathPasses');
    noAward(result);
  });

  it.each([undefined, null, 'true', 1])('missing or malformed aggregate compatibility %j is author error', compatible => authorError(path({ compatible })));
  it.each([undefined, null, 'false', 0])('missing or malformed termination fact %j is author error', chosenTerminationCompatible => authorError({ kind: 'copper-termination', profile, chosenTerminationCompatible }));
  it.each([
    { lengths: [] }, { lengths: [{ value: 95 }] }, { lengths: [{ value: 95, unit: 's' }] },
    { lengths: [{ value: -1, unit: 'm' }] }, { lengths: [{ value: NaN, unit: 'm' }] },
    { lengths: [{ value: Infinity, unit: 'm' }] }, { lengths: new Array(1) },
    { requiredConductors: [] }, { requiredConductors: [true, undefined] }, { requiredConductors: new Array(1) },
    { profile: { ...profile, id: 'spec001:UNKNOWN' } },
    { profile: { ...profile, parameters: { ...profile.parameters, maximumChannelLength: { value: 200, unit: 'm' } } } },
    { segments: [{ value: 90, unit: 'm' }, { value: 90, unit: 'm' }] },
    { optionalUnreviewedCheck: true },
    { lengths: [{ value: Number.MAX_VALUE, unit: 'm' }, { value: Number.MAX_VALUE, unit: 'm' }] },
  ])('validates all authored facts before even an incompatible choice: %j', overrides => authorError(path({ compatible: false, ...overrides })));

  it('rejects topology hidden in an otherwise valid profile', () => authorError(path({ profile: { ...profile, segmentLimits: [{ value: 100, unit: 'm' }] } })));
  it('does not let the parameter projection silently change its reviewed profile identity', () => authorError(path({ profile: { ...profile, reviewedProfileId: 'spec001:UNREVIEWED' } })));

  it.each([
    { lengths: [{ value: 95, unit: 'm' }, { value: 10, unit: 'm' }], status: 'incorrect', total: 105, difference: 5 },
    { lengths: [{ value: 90, unit: 'm' }, { value: 10, unit: 'm' }], status: 'correct', total: 100, difference: 0 },
    { lengths: [{ value: 100.01, unit: 'm' }], status: 'incorrect', total: 100.01, difference: 0.01 },
  ])('retains the independent inclusive length rule for a full passive path: $total m', ({ lengths, status, total, difference }) => {
    const result = evaluate(path({ lengths }));
    expect(result.status).toBe(status);
    expect(result.observations).toMatchObject([{ total: { value: total, unit: 'm' }, [status === 'correct' ? 'headroom' : 'excess']: { value: difference, unit: 'm' }, wholeRouteProven: false }]);
    noAward(result);
  });

  it('compares exact decimal sums before display, including the smallest positive excess', () => {
    const exact = evaluate(path({ lengths: Array.from({ length: 1000 }, () => ({ value: 0.1, unit: 'm' })) }));
    expect(exact.status).toBe('correct');
    expect(exact.observations).toMatchObject([{ total: { value: 100, unit: 'm' }, headroom: { value: 0, unit: 'm' } }]);
    const over = evaluate(path({ lengths: [{ value: 100, unit: 'm' }, { value: Number.MIN_VALUE, unit: 'm' }] }));
    expect(over.status).toBe('incorrect');
    expect(over.observations).toMatchObject([{ excess: { value: Number.MIN_VALUE, unit: 'm' } }]);
  });

  it.each(['measure-length', 'test-continuity', 'add-repeater', 'check-termination', 'invented-action'])('does not apply unrelated action %s to path proof', kind => {
    const result = evaluate(path(), action(kind));
    expect(result.status).toBe('invalid-input'); noAward(result);
  });
  it.each(['test-path', 'check-termination'])('new action %s cannot silently become an old continuity test', kind => {
    const result = evaluate({ kind: 'copper-continuity', profile, requiredConductors: [true] }, action(kind));
    expect(result.status).toBe('invalid-input');
    expect(result.reasonCode).toBe('action-does-not-match-predicate'); noAward(result);
  });
  it('rejects additional path facts or a different action on the narrow termination predicate', () => {
    const challenge = { kind: 'copper-termination', profile, chosenTerminationCompatible: true };
    authorError({ ...challenge, lengths: [{ value: 95, unit: 'm' }] });
    const result = evaluate(challenge, action('test-path'));
    expect(result.status).toBe('invalid-input'); noAward(result);
  });
  it('rejects missing actions and both kinds of stale capture without effects', () => {
    for (const command of [null, { ...action(), input: null },
      { ...action(), expectedVersion: { ...world, configurationRevision: 8 } },
      { ...action(), expectedVersion: { ...world, attemptId: 'earlier-attempt' } }]) {
      const result = evaluate(path(), command);
      expect(result.status).toBe('invalid-input'); noAward(result);
    }
  });
  it('returns detached deterministic facts without mutating input, world or command', () => {
    const challenge = path(); const command = action();
    const original = structuredClone({ challenge, command, world });
    const result = evaluate(challenge, command); const repeat = evaluate(challenge, command);
    expect(result).toEqual(repeat);
    expect({ challenge, command, world }).toEqual(original);
    const mutable = result.observations[0] as unknown as { total: { value: number }; openConductorIndexes: number[]; version: { configurationRevision: number } };
    mutable.total.value = 200; mutable.openConductorIndexes.push(1); mutable.version.configurationRevision = 10;
    expect(evaluate(challenge, command)).toEqual(repeat);
  });
});
