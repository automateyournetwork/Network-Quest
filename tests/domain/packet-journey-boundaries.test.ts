// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { evaluateCopper } from '../../src/domain/copper';
import type { CopperChallenge } from '../../src/domain/copper';
import {
  comparePacketPattern, decodeToySamples, encodePacketPayload, encodeToyBits, evaluatePacketJourney, evaluateSymbolAnswer,
} from '../../src/domain/packet-journey';
import type {
  JourneyObservation, JourneyPhase, PacketJourneyChallenge, PacketJourneyInput, PacketJourneyWorld,
  PacketProfile, SymbolChallenge, ToySymbolProfile,
} from '../../src/domain/packet-journey';
import type { DomainAction, WorldVersion } from '../../src/domain/types';

const fixture = JSON.parse(readFileSync(new URL('../fixtures/packet-journey.json', import.meta.url), 'utf8')) as {
  reviewedContext: { profiles: ({ id: string } & Record<string, unknown>)[] };
  assumptions: { completeBench: PacketJourneyChallenge['bench']; substitution: PacketJourneyChallenge['impairment'] };
  physicalChallenges: Record<string, { kind: string; profileId: string; lengths: unknown }>;
};
const source = JSON.parse(readFileSync(new URL('../../content/spec001/sources.json', import.meta.url), 'utf8')) as {
  profiles: ({ id: string; parameters: unknown })[];
};
const symbolProfile = fixture.reviewedContext.profiles.find(profile => profile.id === 'spec001:PROFILE-SYMBOLS') as unknown as ToySymbolProfile;
const packetProfile = fixture.reviewedContext.profiles.find(profile => profile.id === 'spec001:PROFILE-PACKET') as unknown as PacketProfile;
const version = { configurationRevision: 7, attemptId: 'attempt-a' } as WorldVersion;
function action<T>(input: T, captured = version): DomainAction<T> {
  return { actionId: 'packet-test' as DomainAction<T>['actionId'], expectedVersion: captured, input };
}
function challenge(impairment = false): PacketJourneyChallenge {
  return structuredClone({ packetProfile, symbolProfile, bench: fixture.assumptions.completeBench,
    impairment: impairment ? fixture.assumptions.substitution : null });
}
function world(name = 'passing-length', captured = version): PacketJourneyWorld {
  const prepared = fixture.physicalChallenges[name]!;
  const reviewed = source.profiles.find(profile => profile.id === prepared.profileId)!;
  const physical = { kind: prepared.kind, profile: { id: reviewed.id, parameters: reviewed.parameters }, lengths: prepared.lengths } as unknown as CopperChallenge;
  return { ...captured, physicalEvidence: { result: evaluateCopper(physical, action({ kind: 'measure-length' as const }, captured), captured), evaluatedVersion: { ...captured }, stale: false } };
}
function inspect(current: PacketJourneyWorld, phase: JourneyPhase = 'compare', authored = challenge(), captured: WorldVersion = current) {
  return evaluatePacketJourney(authored, action({ kind: 'inspect' as const, phase }, captured), current);
}
function observation(result: ReturnType<typeof inspect>): JourneyObservation {
  const observed = result.observations[0];
  if (observed?.kind !== 'packet-journey') throw new Error(`Missing trace: ${result.reasonCode}`);
  return observed;
}
function noData(result: ReturnType<typeof inspect>, status: string) {
  expect(result.status).toBe(status);
  expect(result.acceptedEffects).toEqual([]);
  expect(result.observations[0]).toMatchObject({ transmissionSucceeded: false, recoveredBits: null, knownPatternMatches: null, attemptPenalty: 0, progressAward: 0 });
}
const samples: SymbolChallenge['samples'] = [
  { position: 0, value: -3, unit: 'toy-level' }, { position: 1, value: 1, unit: 'toy-level' },
  { position: 2, value: 3, unit: 'toy-level' }, { position: 3, value: -1, unit: 'toy-level' },
];

describe('T032 current evidence and phase boundaries', () => {
  it.each(['payload', 'encode', 'transmit', 'decode', 'compare'] as const)('%s is a pure checkpoint with no rewards', phase => {
    const input = world();
    const before = structuredClone(input);
    const result = inspect(input, phase);
    const observed = observation(result);
    expect(observed.encoded !== null).toBe(phase !== 'payload');
    expect(observed.recoveredSymbolValues !== null).toBe(['transmit', 'decode', 'compare'].includes(phase));
    expect(observed.recoveredBits !== null).toBe(['decode', 'compare'].includes(phase));
    expect(observed.knownPatternMatches).toBe(phase === 'compare' ? true : null);
    expect(observed.transmissionSucceeded).toBe(phase === 'compare');
    expect(result.acceptedEffects).toEqual([]);
    expect(observed).toMatchObject({ progressAward: 0, attemptPenalty: 0, wholeRouteProven: false, higherLayerServiceProven: false });
    expect(input).toEqual(before);
  });
  it.each(['configuration', 'attempt', 'stale'] as const)('rechecks %s before decode, comparison and replay', change => {
    const prior = world();
    expect(observation(inspect(prior)).transmissionSucceeded).toBe(true);
    const current = { ...prior,
      ...(change === 'configuration' ? { configurationRevision: 8 } : change === 'attempt' ? { attemptId: 'attempt-b' } : {}),
      physicalEvidence: { ...prior.physicalEvidence!, stale: change === 'stale' },
    } as PacketJourneyWorld;
    for (const phase of ['decode', 'compare', 'payload'] as const) noData(inspect(current, phase), 'invalid-input');
    // The prior detached result is historical; the world never edits it into current proof.
    expect(prior.physicalEvidence?.evaluatedVersion).toEqual(version);
  });
  it('rejects a relabeled wrapper because the actual observed revision is still old', () => {
    const prior = world();
    const next = { configurationRevision: 8, attemptId: 'attempt-a' } as WorldVersion;
    const relabeled = { ...next, physicalEvidence: { ...prior.physicalEvidence!, evaluatedVersion: next } };
    const result = inspect(relabeled);
    noData(result, 'invalid-input');
    expect(result.reasonCode).toBe('stale-physical-observation');
  });
  it('requires a NEW actual physical evaluation after repair; replay does not repair', () => {
    const broken = world('failing-length');
    const failed = inspect(broken, 'compare', challenge(true));
    expect(observation(failed)).toMatchObject({ recoveredBits: '0100111001010000', transmissionSucceeded: false });
    const next = { configurationRevision: 8, attemptId: 'attempt-a' } as WorldVersion;
    noData(inspect({ ...next, physicalEvidence: broken.physicalEvidence }), 'invalid-input');
    expect(observation(inspect(world('passing-length', next)))).toMatchObject({ recoveredBits: '0100111001010001', transmissionSucceeded: true });
    expect(observation(failed)).toMatchObject({ version, recoveredBits: '0100111001010000', transmissionSucceeded: false });
  });
  it('rejects a relabeled attempt even when the configuration is unchanged', () => {
    const prior = world();
    const next = { configurationRevision: 7, attemptId: 'attempt-b' } as WorldVersion;
    noData(inspect({ ...next, physicalEvidence: { ...prior.physicalEvidence!, evaluatedVersion: next } }), 'invalid-input');
  });
  it.each([
    { label: 'scope', field: 'scope', value: 'whole route' },
    { label: 'unit', field: 'total', value: { value: 95, unit: 'V' } },
    { label: 'model', field: 'profileId', value: 'spec001:UNKNOWN' },
    { label: 'full-route flag', field: 'wholeRouteProven', value: true },
    { label: 'extra field', field: 'animationSucceeded', value: true },
  ])('fails closed on unsupported physical observation $label', change => {
    const current = world();
    const observed = current.physicalEvidence!.result.observations[0] as unknown as Record<string, unknown>;
    observed[change.field] = change.value;
    noData(inspect(current), 'content-error');
  });
  it('requires the supported measured-length predicate, not a correct continuity-only result', () => {
    const reviewed = source.profiles.find(profile => profile.id === 'spec001:PROFILE-COPPER-100')!;
    const copper = evaluateCopper({ kind: 'copper-continuity', profile: { id: reviewed.id, parameters: reviewed.parameters }, requiredConductors: [true] } as unknown as CopperChallenge,
      action({ kind: 'test-continuity' }), version);
    expect(copper.status).toBe('correct');
    noData(inspect({ ...version, physicalEvidence: { result: copper, evaluatedVersion: version, stale: false } }), 'content-error');
  });
  it('does not apply a declared failure substitution to a passing physical result', () => {
    expect(observation(inspect(world(), 'compare', challenge(true)))).toMatchObject({ impairmentApplied: false, recoveredBits: '0100111001010001', transmissionSucceeded: true });
  });
  it('does not fabricate data at any phase when the physical predicate fails without a trace', () => {
    for (const phase of ['payload', 'encode', 'transmit', 'decode', 'compare'] as const) {
      expect(observation(inspect(world('failing-length'), phase))).toMatchObject({ recoveredBits: null, recoveredSymbolValues: null, knownPatternMatches: null, transmissionSucceeded: false });
    }
  });
  it('does not accept a renderer success flag as evidence or an animation event as a command', () => {
    noData(inspect({ ...version, physicalEvidence: { animationSucceeded: true } } as unknown as PacketJourneyWorld), 'invalid-input');
    noData(evaluatePacketJourney(challenge(), action({ kind: 'renderer-animation-finished' } as unknown as PacketJourneyInput), world()), 'invalid-input');
  });
  it('rejects a stale learner command even with newly evaluated physical evidence', () => {
    const next = { configurationRevision: 8, attemptId: 'attempt-a' } as WorldVersion;
    noData(inspect(world('passing-length', next), 'compare', challenge(), version), 'invalid-input');
  });
  it('projects only version fields and detaches/freezes all output data without freezing inputs', () => {
    const input = world();
    const authored = challenge();
    const result = inspect({ ...input, inventory: ['private-extra-field'] } as PacketJourneyWorld, 'compare', authored);
    const observed = observation(result);
    expect(observed.version).toEqual(version);
    expect(observed.physicalObservation.version).toEqual(version);
    expect(Object.isFrozen(input.physicalEvidence?.result)).toBe(false);
    expect(Object.isFrozen(authored.packetProfile.parameters)).toBe(false);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(observed.encoded?.samples[0])).toBe(true);
    expect(Object.isFrozen(observed.physicalObservation.version)).toBe(true);
    expect(() => { (observed.recoveredSymbolValues as number[])[0] = 3; }).toThrow(TypeError);
    expect(() => { (observed.encoded!.samples as unknown[]).pop(); }).toThrow(TypeError);
    expect(inspect(input)).toEqual(result);
  });
});

describe('T032 malformed author and bounded learner inputs', () => {
  it('rejects an unknown mapping value even if its bits field is absent', () => {
    const malformed = structuredClone(symbolProfile) as unknown as { parameters: { levels: unknown[] } };
    malformed.parameters.levels[3] = { symbol: { value: 7, unit: 'toy-level' } };
    expect(encodeToyBits(malformed as unknown as ToySymbolProfile, '11').status).toBe('content-error');
  });
  it.each([undefined, null, '', '2', '01'.repeat(257)])('bounds malformed authored bits %#', bits => {
    expect(encodeToyBits(symbolProfile, bits as string).status).toBe('content-error');
  });
  it('accepts the explicit bound and never pads a lone symbol to a byte', () => {
    expect(encodeToyBits(symbolProfile, '01'.repeat(256)).observations[0]).toMatchObject({ symbols: 256, representedBits: 512 });
    expect(decodeToySamples(symbolProfile, [{ position: 0, value: 3, unit: 'toy-level' }]).observations[0]).toMatchObject({ bits: '11', representedBits: 2, symbols: 1 });
  });
  it.each([
    { label: 'sparse', samples: new Array(2) },
    { label: 'oversized', samples: Array.from({ length: 257 }, (_, position) => ({ position, value: -3, unit: 'toy-level' })) },
    { label: 'out of order', samples: [{ position: 1, value: -3, unit: 'toy-level' }, { position: 0, value: 1, unit: 'toy-level' }] },
    { label: 'nonfinite', samples: [{ position: 0, value: Number.NaN, unit: 'toy-level' }] },
    { label: 'infinite', samples: [{ position: 0, value: Infinity, unit: 'toy-level' }] },
    { label: 'extra timing', samples: [{ position: 0, value: -3, unit: 'toy-level', seconds: 1 }] },
  ])('rejects $label sample data without coercion or reordering', row => {
    expect(decodeToySamples(symbolProfile, row.samples as SymbolChallenge['samples']).status).toBe('content-error');
  });
  it('checks author errors before missing or stale learner actions', () => {
    const bad = { profile: symbolProfile, samples: [] };
    expect(evaluateSymbolAnswer(bad, null as never, version).status).toBe('content-error');
    noData(evaluatePacketJourney(challenge(), null as never, world('malformed-length')), 'content-error');
    noData(inspect(world(), 'compare', { ...challenge(), bench: {} as never }), 'content-error');
  });
  it.each([null, {}, { bits: '' }, { bits: '01'.repeat(257) }, { bits: '101', extra: true }])('keeps malformed learner inputs invalid, without penalty', input => {
    const result = evaluateSymbolAnswer({ profile: symbolProfile, samples }, action(input as never), version);
    noData(result as ReturnType<typeof inspect>, 'invalid-input');
  });
  it('treats a bounded binary but wrong-length answer as an incorrect answer, not an author error', () => {
    expect(evaluateSymbolAnswer({ profile: symbolProfile, samples }, action({ bits: '0' }), version).status).toBe('incorrect');
  });
  it.each(['knownCompatibleEndpointsMediaTerminations', 'requiredConductorsContinuous', 'endpointPowerKnownGood', 'upperDependenciesKnownGoodForThisLab', 'otherPhysicalConditionsKnownGoodForThisLab'])('requires the declared %s premise', key => {
    const incomplete = challenge();
    delete (incomplete.bench as unknown as Record<string, unknown>)[key];
    noData(inspect(world(), 'compare', incomplete), 'content-error');
  });
  it.each([
    { position: 6 }, { to: { value: 2, unit: 'toy-level' } }, { from: { value: -1, unit: 'V' } }, { id: 'random-noise' },
  ])('rejects unreviewed impairment data %#', alteration => {
    const bad = { ...challenge(true), impairment: { ...fixture.assumptions.substitution, ...alteration } } as unknown as PacketJourneyChallenge;
    noData(inspect(world('failing-length'), 'compare', bad), 'content-error');
  });
  it('rejects changed packet bytes, bit-order, or missing profile instead of generalizing the reviewed model', () => {
    for (const alteration of [{ payloadHex: ['4E', '50'] }, { displayBitOrder: 'LSB-first' }]) {
      const changed = { ...packetProfile, parameters: { ...packetProfile.parameters, ...alteration } } as unknown as PacketProfile;
      expect(encodePacketPayload(changed, symbolProfile).status).toBe('content-error');
    }
    expect(encodePacketPayload(null as never, symbolProfile).status).toBe('content-error');
  });
  it.each([undefined, '', '0101', '010011100101000x'])('rejects incomplete/malformed recovered data %s', recoveredBits => {
    expect(comparePacketPattern({ profile: packetProfile, expectedBits: '0100111001010001', recoveredBits: recoveredBits as string }, action({ claim: 'known-pattern-matches' }), version).status).toBe('content-error');
  });
});
