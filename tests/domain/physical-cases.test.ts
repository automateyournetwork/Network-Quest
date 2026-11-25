// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EvaluationStatus } from '../../src/domain/types';

/**
 * T014 verifies a transcription of independently reviewed evidence, not gameplay.
 * No evaluator, reducer, score calculation or expected-value generator is imported.
 * Future domain suites must exercise actual application code against these cases;
 * the explicit TODOs below cannot be counted as passed domain acceptance checks.
 *
 * Some review vectors are scoped predicates, summaries or malformed author data,
 * not complete runtime commands. Adapters must preserve that scope and validate
 * units explicitly; do not fabricate fields just to fit an implementation API.
 */
type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
interface JsonObject { [key: string]: JsonValue }
interface ReviewedCase {
  id: string;
  ruleId: string;
  inputs: JsonObject;
  expected: { status: EvaluationStatus; observation: JsonObject };
  independentReasoning: string | JsonObject;
}
interface ReviewedRule {
  id: string;
  objectives: string[];
  sources: string[];
  profiles: string[];
  correctCases: string[];
  incorrectCases: string[];
  boundaryCases: string[];
  invalidInputCases: string[];
}
interface ReviewedProfile {
  id: string;
  sources: string[];
  parameters: JsonObject;
  assumptions: string[];
  limits: string[];
}
interface ReviewedRecord {
  referenceCases: ReviewedCase[];
  reviewCases: ReviewedCase[];
  contentErrorCases: string[];
  rules: ReviewedRule[];
  sources: { id: string }[];
  profiles: ReviewedProfile[];
  [key: string]: unknown;
}

const fixture = JSON.parse(readFileSync(
  new URL('../fixtures/physical-cases.json', import.meta.url), 'utf8',
)) as ReviewedRecord;
const source = JSON.parse(readFileSync(
  new URL('../../content/spec001/sources.json', import.meta.url), 'utf8',
)) as ReviewedRecord;
const cases = [...fixture.referenceCases, ...fixture.reviewCases];
const sourceCases = new Map([...source.referenceCases, ...source.reviewCases]
  .map((entry) => [entry.id, entry]));
const casesById = new Map(cases.map((entry) => [entry.id, entry]));
const profilesById = new Map(fixture.profiles.map((entry) => [entry.id, entry]));
const ruleIds = [
  'PHY01', 'PHY02', 'PHY03', 'PHY04', 'PHY05', 'PHY06', 'PHY07', 'PHY08',
  'PHY09', 'PHY10', 'PHY11', 'STATE01', 'STATE02', 'STATE03', 'STATE04',
];
const statuses: EvaluationStatus[] = ['correct', 'incorrect', 'invalid-input', 'content-error'];

function reviewedCase(id: string): ReviewedCase {
  const entry = casesById.get(id);
  if (!entry) throw new Error(`Missing reviewed case ${id}`);
  return entry;
}

describe('T014 fixture transcription and source correspondence (not evaluator execution)', () => {
  it('retains exactly the original 16 reference and 67 supplementary cases', () => {
    expect(fixture.referenceCases.map(({ id }) => id)).toEqual([
      'T01', 'T02', 'T03', 'T04', 'T05', 'T06', 'T07', 'T08',
      'T09', 'T10', 'T11', 'T12', 'T13', 'T14', 'T15', 'T16',
    ]);
    expect(fixture.reviewCases).toHaveLength(67);
    expect(cases).toHaveLength(83);
    expect(casesById.size).toBe(83);
    expect([...casesById.keys()]).toEqual([...sourceCases.keys()]);
  });

  it('preserves the complete reviewed record, including sources, profiles and limitations', () => {
    const { fixtureVersion, transcription, ...transcribedRecord } = fixture;
    expect(fixtureVersion).toBe(1);
    expect(transcription).toMatchObject({
      task: 'T014',
      sourceRegister: 'content/spec001/sources.json',
      sourceReview: 'docs/evidence/spec001/rule-source-review.md',
      runtimeEvaluation: 'Pending for every case: implement and test real domain behavior against these reviewed literals.',
    });
    expect(transcribedRecord).toStrictEqual(source);
    expect(fixture.sources).toHaveLength(13);
    expect(new Set(fixture.sources.map(({ id }) => id)).size).toBe(13);
    expect(fixture.profiles).toHaveLength(7);
    expect(profilesById.size).toBe(7);
  });

  it.each(cases)('$id preserves the reviewed inputs, literal outcome and reasoning', (entry) => {
    expect(entry).toStrictEqual(sourceCases.get(entry.id));
    expect(ruleIds).toContain(entry.ruleId);
    expect(statuses).toContain(entry.expected.status);
    expect(entry.independentReasoning).toBeTruthy();
  });

  it('covers all 15 rule groups and all 12 objectives beyond the general invariants', () => {
    expect(fixture.rules.map(({ id }) => id)).toEqual(ruleIds);
    const objectiveIds = new Set(fixture.rules
      .filter(({ id }) => id !== 'STATE02' && id !== 'STATE03')
      .flatMap(({ objectives }) => objectives));
    expect([...objectiveIds].sort()).toEqual([
      'O01', 'O02', 'O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10', 'O11', 'O12',
    ]);
    const categorized = new Set(fixture.rules.flatMap((rule) => [
      ...rule.correctCases, ...rule.incorrectCases, ...rule.boundaryCases, ...rule.invalidInputCases,
    ]));
    // Authoring errors are supplemental coverage, not learner-incorrect categories.
    for (const id of fixture.contentErrorCases) categorized.add(id);
    expect([...categorized].sort()).toEqual([...casesById.keys()].sort());
  });

  it.each(fixture.rules)('$id retains reviewed examples in every required category', (rule) => {
    const categorizedStatuses = [
      ['correctCases', 'correct'], ['incorrectCases', 'incorrect'],
      ['invalidInputCases', 'invalid-input'],
    ] as const;
    for (const [category, status] of categorizedStatuses) {
      expect(rule[category].length).toBeGreaterThan(0);
      for (const id of rule[category]) expect(reviewedCase(id).expected.status).toBe(status);
    }
    expect(rule.boundaryCases.length).toBeGreaterThan(0);
    for (const id of rule.boundaryCases) expect(casesById.has(id)).toBe(true);
    for (const id of rule.sources) expect(fixture.sources.map((entry) => entry.id)).toContain(id);
    for (const id of rule.profiles) expect(profilesById.has(id)).toBe(true);
  });
});

describe('Fixed reviewed numeric expectations (literal assertions, no scoring algorithms)', () => {
  // Independently checked against SPEC T01–T16 and T006 before transcription.
  // These literals intentionally remain independent of runtime implementations.
  const numericExpectations: [string, EvaluationStatus, JsonObject][] = [
    ['T01', 'correct', { total: { value: 95, unit: 'm' }, headroom: { value: 5, unit: 'm' }, scope: 'length only' }],
    ['T02', 'incorrect', { total: { value: 105, unit: 'm' }, excess: { value: 5, unit: 'm' }, reason: 'length-exceeded' }],
    ['T04', 'correct', { receive: { value: -11, unit: 'dBm' }, margin: { value: 3, unit: 'dB' }, overload: false, reserveMet: true }],
    ['T05', 'incorrect', { receive: { value: -13, unit: 'dBm' }, margin: { value: 1, unit: 'dB' }, overload: false, reserveMet: false }],
    ['T06', 'incorrect', { overload: true, excess: { value: 1, unit: 'dB' } }],
    ['T08', 'correct', { snr: { value: 25, unit: 'dB' }, thresholdMet: true, throughputProven: false }],
    ['T09', 'incorrect', { snr: { value: 13, unit: 'dB' }, thresholdMet: false, throughputProven: false }],
    ['T10', 'incorrect', { total: { value: 33, unit: 'W' }, excess: { value: 3, unit: 'W' } }],
    ['T15', 'correct', { receive: { value: -12, unit: 'dBm' }, margin: { value: 2, unit: 'dB' }, overload: false, reserveMet: true }],
    ['B-COPPER-100', 'correct', { total: { value: 100, unit: 'm' }, headroom: { value: 0, unit: 'm' } }],
    ['B-COPPER-OVER', 'incorrect', { total: { value: 100.01, unit: 'm' }, excess: { value: 0.01, unit: 'm' } }],
    ['B-OPT-MAX', 'correct', { margin: { value: 13, unit: 'dB' }, overload: false }],
    ['B-OPT-OVER', 'incorrect', { overload: true, excess: { value: 0.01, unit: 'dB' } }],
    ['B-OPT-RESERVE', 'incorrect', { receive: { value: -12.01, unit: 'dBm' }, margin: { value: 1.99, unit: 'dB' } }],
    ['B-RADIO-20', 'correct', { snr: { value: 20, unit: 'dB' } }],
    ['B-RADIO-BELOW', 'incorrect', { snr: { value: 19.99, unit: 'dB' } }],
    ['C-POWER', 'correct', { total: { value: 23, unit: 'W' }, headroom: { value: 7, unit: 'W' } }],
    ['B-POWER-30', 'correct', { total: { value: 30, unit: 'W' }, headroom: { value: 0, unit: 'W' } }],
    ['B-POWER-OVER', 'incorrect', { total: { value: 30.01, unit: 'W' }, excess: { value: 0.01, unit: 'W' } }],
    ['B-LOSS-ZERO', 'correct', { contentWellFormed: true, receive: { value: -3, unit: 'dBm' }, margin: { value: 11, unit: 'dB' } }],
  ];
  it.each(numericExpectations)('%s retains the fixed reviewed result and units', (id, status, observation) => {
    expect(reviewedCase(id).expected).toStrictEqual({ status, observation });
  });

  it('keeps T02 a length-only input without invented compatibility or continuity facts', () => {
    expect(reviewedCase('T02').inputs).toStrictEqual({
      profile: 'spec001:PROFILE-COPPER-100',
      lengths: [{ value: 95, unit: 'm' }, { value: 10, unit: 'm' }],
    });
  });

  it('keeps T06 independent of the T04 transmitter and passive-loss model', () => {
    expect(reviewedCase('T06').inputs).toStrictEqual({
      receivedObservation: { value: 0, unit: 'dBm' },
      maximumReceive: { value: -1, unit: 'dBm' }, compatible: true,
    });
    expect(profilesById.get('spec001:PROFILE-OPTICAL')?.parameters).toStrictEqual({
      transmit: { value: -3, unit: 'dBm' }, sensitivity: { value: -14, unit: 'dBm' },
      maximumReceive: { value: -1, unit: 'dBm' }, requiredMargin: { value: 2, unit: 'dB' },
      inclusiveBounds: true,
    });
    expect(reviewedCase('C-ERROR-INCONSISTENT').inputs).toStrictEqual({
      transmit: { value: -3, unit: 'dBm' }, passiveLoss: { value: 0, unit: 'dB' },
      receive: { value: 0, unit: 'dBm' },
    });
    expect(reviewedCase('C-ERROR-INCONSISTENT').expected.status).toBe('content-error');
  });

  it('preserves reviewed capability and toy-level unit labels without silently converting to save units', () => {
    expect(reviewedCase('T11').expected.observation).toStrictEqual({
      common: [{ rate: { value: 100, unit: 'Mb/s' }, duplex: 'full' }],
    });
    expect(profilesById.get('spec001:PROFILE-CAPABILITIES')?.parameters).toStrictEqual({
      endpointA: [{ rate: { value: 1000, unit: 'Mb/s' }, duplex: 'full' }, { rate: { value: 100, unit: 'Mb/s' }, duplex: 'full' }],
      endpointB: [{ rate: { value: 100, unit: 'Mb/s' }, duplex: 'full' }, { rate: { value: 10, unit: 'Mb/s' }, duplex: 'half' }],
    });
    expect(profilesById.get('spec001:PROFILE-SYMBOLS')?.parameters).toStrictEqual({
      levels: [
        { symbol: { value: -3, unit: 'toy-level' }, bits: '00' },
        { symbol: { value: -1, unit: 'toy-level' }, bits: '01' },
        { symbol: { value: 1, unit: 'toy-level' }, bits: '10' },
        { symbol: { value: 3, unit: 'toy-level' }, bits: '11' },
      ], bitsPerSymbol: 2,
    });
    expect(reviewedCase('T12').expected.observation).toStrictEqual({
      bits: '00101101', representedBits: 8, symbols: 4,
    });
    expect(reviewedCase('B-TIMING').expected.observation).toStrictEqual({
      expectedBits: '0010', submittedBits: '1000',
    });
  });
});

describe('Fixed reviewed semantic boundaries (not application behavior)', () => {
  const semanticExpectations: [string, EvaluationStatus, JsonObject][] = [
    ['T03', 'incorrect', { connectedPath: false, reason: 'open-remains' }],
    ['T07', 'incorrect', { reason: 'incompatible-profiles', usableLink: false, arithmeticCannotOverride: true }],
    ['T13', 'incorrect', { reason: 'stale-evidence', fresh: false, currentValidationAward: false }],
    ['T14', 'content-error', { attemptPenalty: 0, progressAward: 0, reason: 'malformed-authored-challenge' }],
    ['T16', 'correct', { accepted: ['repair-A', 'repair-B'], positionOrPresentationRelevant: false }],
    ['B-PWR-ONLY', 'correct', { powerObservationRecorded: true, linkKnown: false, objectiveComplete: false }],
    ['B-SCOPE', 'correct', { investigationPrepared: true, hypothesisIsFact: false }],
    ['B-COMPAT', 'incorrect', { reason: 'one-required-compatibility-predicate-fails' }],
    ['B-INSPECTION', 'incorrect', { reason: 'inspect-before-changing', preparationComplete: false }],
    ['B-CONTINUITY', 'incorrect', { connectedRequiredPath: false }],
    ['B-RADIO-PATH', 'incorrect', { reason: 'incompatible-radio-settings', usableLink: false }],
    ['B-POWER-COMPAT', 'incorrect', { reason: 'incompatible-port', budgetCannotOverride: true }],
    ['B-NEG-NONE', 'incorrect', { common: [], reason: 'no-common-mode' }],
    ['B-SYMBOL', 'correct', { bits: '11', representedBits: 2, symbols: 1 }],
    ['C-PACKET', 'correct', { knownPatternMatches: true, payloadBytes: 2, representedBits: 16, wholeFrameIsTwoBytes: false }],
    ['C-PACKET-DIFF', 'incorrect', { knownPatternMatches: false, differingBits: 1, universalPHYErrorDetection: false }],
    ['B-PACKET', 'incorrect', { knownPatternMatches: true, claimSupported: false }],
    ['B-RETRY', 'incorrect', { fresh: false, notesCluesHintsRetained: true, inventoryRestoredToPreparation: true }],
    ['B-STALE-FLAG', 'incorrect', { fresh: false }],
    ['B-REPLAY', 'correct', { additionalProgressAwards: 0, additionalItemConsumption: 0 }],
    ['B-INTERRUPT', 'invalid-input', { partialRewards: 0, partialConsumption: 0 }],
    ['C-E01', 'correct', { classification: 'E01' }],
    ['C-E02', 'correct', { classification: 'E02' }],
    ['C-E03', 'correct', { classification: 'E03', restoredService: false }],
    ['B-ENDPOINT', 'incorrect', { reason: 'final-proof-missing', endingAward: false }],
  ];
  it.each(semanticExpectations)('%s retains its scoped conclusion', (id, status, observation) => {
    expect(reviewedCase(id).expected).toStrictEqual({ status, observation });
  });

  it('retains every reviewed authoring-error case with no learner penalty or progress', () => {
    expect([...fixture.contentErrorCases].sort()).toEqual([
      'B-REGEN-UNREVIEWED', 'C-ERROR-INCONSISTENT', 'C-ERROR-LOSS', 'C-ERROR-PROFILE',
      'C-ERROR-SYMBOL', 'C-ERROR-UNIT', 'C-ERROR-UNIT-KIND', 'T14',
    ]);
    expect(cases.filter(({ expected }) => expected.status === 'content-error')
      .map(({ id }) => id).sort()).toEqual([...fixture.contentErrorCases].sort());
    for (const id of fixture.contentErrorCases) {
      expect(reviewedCase(id).expected).toMatchObject({
        status: 'content-error', observation: { attemptPenalty: 0, progressAward: 0 },
      });
    }
    expect(reviewedCase('T14').inputs).toStrictEqual({
      variants: ['missing-required-unit', 'negative-passive-loss', 'unknown-authored-profile'],
    });
    expect(reviewedCase('C-ERROR-UNIT').inputs).toStrictEqual({ loss: { value: 8 } });
    expect(reviewedCase('C-ERROR-LOSS').inputs).toStrictEqual({ loss: { value: -0.01, unit: 'dB' } });
    expect(reviewedCase('C-ERROR-PROFILE').inputs).toStrictEqual({ authoredProfile: 'spec001:UNKNOWN' });
    expect(reviewedCase('C-ERROR-UNIT-KIND').inputs).toStrictEqual({ passiveLoss: { value: 8, unit: 'dBm' } });
    expect(reviewedCase('C-ERROR-SYMBOL').inputs).toStrictEqual({
      authoredSamples: [{ value: 2, unit: 'toy-level' }], profile: 'spec001:PROFILE-SYMBOLS',
    });
  });

  it.each(ruleIds)('%s retains missing learner input as invalid-input', (id) => {
    expect(reviewedCase(`I-${id}`).inputs).toStrictEqual({ authoredChallengeValid: true, learnerAction: null });
    expect(reviewedCase(`I-${id}`).expected).toStrictEqual({
      status: 'invalid-input', observation: { progressAward: 0, reason: 'required-action-missing' },
    });
  });
});

describe('Application evaluator/reducer execution — pending implementation', () => {
  // Replace each TODO with real domain execution, or move it to the relevant
  // implemented domain suite with an explicit case-ID assertion. Never replace
  // these with a second fixture-equality assertion or an expected-result stub.
  for (const entry of cases) {
    it.todo(`${entry.id} (${entry.ruleId}): exercise real domain behavior against the reviewed expectation`);
  }
});
