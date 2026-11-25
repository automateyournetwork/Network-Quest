// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { EvaluationStatus } from '../../src/domain/types';

/**
 * T031 preparation only: independent fixture integrity and literal arithmetic.
 * No domain implementation, renderer, expected-result stub or score generator
 * is called here. TODOs require real T032/T033 code before behavior can pass.
 * The shared T014 pending evaluator cases remain untouched by these references.
 */
type JsonValue = null | boolean | number | string | JsonValue[] | JsonObject;
interface JsonObject { [key: string]: JsonValue }
interface Case {
  id: string;
  reviewedCaseRefs: string[];
  expected: JsonObject;
  derivation: string;
}
interface InputCase extends Case { input: JsonObject }
interface ValidationCase extends InputCase { category: 'author' | 'learner' }
interface Version { configurationRevision: number; attemptId: string }
interface TransmissionCase extends Case {
  priorTransmissionCaseId?: string;
  physicalChallenge: string | null;
  physicalAction: { kind: string } | null;
  bench: string;
  evaluatedVersion: Version | null;
  currentVersion: Version;
  stale: boolean;
  impairment: string;
}
interface ControlCase extends Case { start: JsonObject; actions: string[] }
interface Profile { id: string; parameters: JsonObject; assumptions: string[]; limits: string[] }
interface Rule { id: string; sources: string[]; profiles: string[] }
interface ReviewedCase { id: string; inputs: JsonObject; expected: { status: EvaluationStatus; observation: JsonObject } }
interface Fixture {
  fixtureVersion: number;
  preparation: JsonObject;
  reviewedContext: { profiles: Profile[]; rules: Rule[]; caseRefs: string[] };
  assumptions: {
    completeBench: JsonObject;
    lengthOnlyBench: JsonObject;
    substitution: JsonObject;
    physicalHandoff: string;
    resultFreshness: string;
    uiProjection: string;
  };
  encodingVectors: InputCase[];
  comparisonCases: InputCase[];
  validationCases: ValidationCase[];
  physicalChallenges: Record<string, { kind: string; profileId: string; lengths: JsonObject[] }>;
  transmissionCases: TransmissionCase[];
  controlCases: ControlCase[];
  handoff: JsonObject;
}
function readJson<T>(relativePath: string): T {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), 'utf8')) as T;
}
const fixture = readJson<Fixture>('../fixtures/packet-journey.json');
const source = readJson<{
  profiles: Profile[]; rules: Rule[]; referenceCases: ReviewedCase[]; reviewCases: ReviewedCase[];
}>('../../content/spec001/sources.json');
const physicalFixtures = readJson<{ referenceCases: ReviewedCase[]; reviewCases: ReviewedCase[] }>(
  '../fixtures/physical-cases.json',
);
const sourceCases = new Map([...source.referenceCases, ...source.reviewCases].map(entry => [entry.id, entry]));
const transcribedCases = new Map([...physicalFixtures.referenceCases, ...physicalFixtures.reviewCases].map(entry => [entry.id, entry]));
const cases = [...fixture.encodingVectors, ...fixture.comparisonCases, ...fixture.validationCases,
  ...fixture.transmissionCases, ...fixture.controlCases];
function byId<T extends { id: string }>(entries: T[], id: string): T {
  const entry = entries.find(candidate => candidate.id === id);
  if (!entry) throw new Error(`Missing independent expectation ${id}`);
  return entry;
}

describe('T031 independent packet preparation — integrity, not evaluator execution', () => {
  it('names preparation, original evidence, and later real behavior owners', () => {
    expect(fixture.fixtureVersion).toBe(1);
    expect(fixture.preparation).toMatchObject({
      task: 'T031', loop: 33, status: 'independent-expectations-only',
      sourceRegister: 'content/spec001/sources.json',
      sourceReview: 'docs/evidence/spec001/rule-source-review.md',
      transcribedEvidence: 'tests/fixtures/physical-cases.json',
      requirements: ['C10', 'FR-006', 'NQ-13', 'AC21'],
    });
    expect(fixture.handoff).toMatchObject({
      encodingAndPhysicalTask: 'T032', controlsTask: 'T033', integrationTask: 'T034',
      reviewedEvaluatorTodosRemainUnchanged: true,
    });
  });

  it('retains exact reviewed symbol and packet profiles/rules, including every limit', () => {
    expect(fixture.reviewedContext.profiles).toStrictEqual(source.profiles.filter(profile =>
      ['spec001:PROFILE-SYMBOLS', 'spec001:PROFILE-PACKET'].includes(profile.id)));
    expect(fixture.reviewedContext.rules).toStrictEqual(source.rules.filter(rule =>
      ['PHY10', 'PHY11'].includes(rule.id)));
    expect(fixture.reviewedContext.profiles).toHaveLength(2);
    expect(fixture.reviewedContext.rules).toHaveLength(2);
    expect(byId(fixture.reviewedContext.profiles, 'spec001:PROFILE-SYMBOLS').parameters).toStrictEqual({
      levels: [
        { symbol: { value: -3, unit: 'toy-level' }, bits: '00' },
        { symbol: { value: -1, unit: 'toy-level' }, bits: '01' },
        { symbol: { value: 1, unit: 'toy-level' }, bits: '10' },
        { symbol: { value: 3, unit: 'toy-level' }, bits: '11' },
      ], bitsPerSymbol: 2,
    });
  });

  it('keeps source references as references, with the shared source records unaltered', () => {
    expect(fixture.reviewedContext.caseRefs).toEqual([
      'T12', 'C-SYMBOL-WRONG', 'B-SYMBOL', 'B-TIMING', 'I-PHY10',
      'C-PACKET', 'C-PACKET-DIFF', 'B-PACKET', 'I-PHY11', 'C-ERROR-SYMBOL',
      'T01', 'T02', 'T13', 'T14', 'B-RETRY', 'B-STALE-FLAG', 'B-REPLAY',
    ]);
    for (const id of fixture.reviewedContext.caseRefs) {
      expect(sourceCases.has(id)).toBe(true);
      expect(transcribedCases.get(id)).toStrictEqual(sourceCases.get(id));
    }
    expect(source.referenceCases).toHaveLength(16);
    expect(source.reviewCases).toHaveLength(67);
  });

  it('contains every independent case exactly once, without renumbering reviewed cases', () => {
    expect(cases.map(entry => entry.id)).toEqual([
      'PJ-NQ', 'PJ-T12', 'PJ-ONE', 'PJ-ORDER',
      'PJ-MATCH', 'PJ-DIFF', 'PJ-WRONG-ANSWER', 'PJ-REVERSED-ANSWER', 'PJ-OVERCLAIM',
      'PJ-UNKNOWN-SYMBOL', 'PJ-MISSING-SAMPLES', 'PJ-MISSING-POSITION', 'PJ-DUPLICATE-POSITION',
      'PJ-MISSING-UNIT', 'PJ-VOLT-UNIT', 'PJ-MISSING-MAPPING', 'PJ-ALTERED-MAPPING',
      'PJ-DUPLICATE-MAPPING', 'PJ-UNKNOWN-MODEL', 'PJ-ODD-BIT-COUNT',
      'PJ-MISSING-SYMBOL-ANSWER', 'PJ-MISSING-PACKET-ANSWER', 'PJ-MALFORMED-ANSWER',
      'PJ-TRANSMIT-PASS', 'PJ-TRANSMIT-IMPAIRED', 'PJ-TRANSMIT-AFTER-REPAIR', 'PJ-TRANSMIT-FAIL-NO-SUBSTITUTION',
      'PJ-TRANSMIT-CONTENT-ERROR', 'PJ-TRANSMIT-INVALID-ACTION', 'PJ-TRANSMIT-MISSING-RESULT',
      'PJ-TRANSMIT-STALE-CONFIG', 'PJ-TRANSMIT-STALE-ATTEMPT', 'PJ-TRANSMIT-STALE-FLAG',
      'PJ-TRANSMIT-LENGTH-ONLY', 'PJ-PAUSE', 'PJ-STEP', 'PJ-REPLAY', 'PJ-REPLAY-STALE',
      'PJ-RENDERER-FINISHED',
    ]);
    expect(new Set(cases.map(entry => entry.id)).size).toBe(39);
  });

  it.each(cases)('$id has independent reasoning, declared references and a literal expectation', entry => {
    expect(entry.id).toMatch(/^PJ-[A-Z0-9-]+$/);
    expect(sourceCases.has(entry.id)).toBe(false);
    expect(entry.derivation.trim().length).toBeGreaterThan(30);
    expect(entry.reviewedCaseRefs.length).toBeGreaterThan(0);
    expect(new Set(entry.reviewedCaseRefs).size).toBe(entry.reviewedCaseRefs.length);
    for (const id of entry.reviewedCaseRefs) expect(fixture.reviewedContext.caseRefs).toContain(id);
    expect(Object.keys(entry.expected).length).toBeGreaterThan(0);
  });

  it('agrees with the actual R01 context fact and preserves the opaque-frame boundary', () => {
    const room = readJson<{ evidence: { id: string; text: string }[] }>('../../content/spec001/rooms/R01.json');
    const fact = byId(room.evidence, 'spec001:FACT-packet-context');
    expect(fact.text).toContain('0x4E 0x51: 01001110 01010001 (NQ)');
    expect(fact.text).toContain('inside an opaque upper-interface frame');
    expect(fact.text).toContain('not the whole frame');
    expect(fact.text).toContain('not universal error detection or a simulation of higher-layer service');
    expect(byId(fixture.reviewedContext.profiles, 'spec001:PROFILE-PACKET').parameters).toStrictEqual({
      payloadHex: ['4E', '51'], payloadText: 'NQ', highlightedBits: '0100111001010001',
      displayBitOrder: 'most-significant-bit first within each highlighted byte',
    });
  });
});

describe('T031 literal independent byte/bit/symbol anchors — no encode/decode implementation', () => {
  it('anchors NQ in hexadecimal arithmetic and binary place values independently', () => {
    expect(4 * 16 + 14).toBe(78);
    expect(0 * 128 + 1 * 64 + 0 * 32 + 0 * 16 + 1 * 8 + 1 * 4 + 1 * 2 + 0).toBe(78);
    expect(5 * 16 + 1).toBe(81);
    expect(0 * 128 + 1 * 64 + 0 * 32 + 1 * 16 + 0 * 8 + 0 * 4 + 0 * 2 + 1).toBe(81);
    expect(byId(fixture.encodingVectors, 'PJ-NQ')).toMatchObject({
      input: { payloadHex: ['4E', '51'] },
      expected: {
        payloadDecimal: [78, 81], payloadText: 'NQ', byteBits: ['01001110', '01010001'],
        bits: '0100111001010001', pairs: ['01', '00', '11', '10', '01', '01', '00', '01'],
        symbolValues: [-1, -3, 3, 1, -1, -1, -3, -1], samplePositions: [0, 1, 2, 3, 4, 5, 6, 7],
        symbolUnit: 'toy-level', representedBits: 16, symbols: 8, roundTripHex: ['4E', '51'],
      },
    });
    expect('01' + '00' + '11' + '10' + '01' + '01' + '00' + '01').toBe('0100111001010001');
    expect(8 * 2).toBe(16);
  });

  it('anchors the exact T12 input and round-trip order without substituting Gray coding', () => {
    expect(byId(fixture.encodingVectors, 'PJ-T12')).toMatchObject({
      input: { symbolValues: [-3, 1, 3, -1], samplePositions: [0, 1, 2, 3], symbolUnit: 'toy-level' },
      expected: { pairs: ['00', '10', '11', '01'], bits: '00101101', representedBits: 8, symbols: 4,
        roundTripSymbolValues: [-3, 1, 3, -1] },
    });
    expect('00' + '10' + '11' + '01').toBe('00101101');
    expect(4 * 2).toBe(8);
    expect(sourceCases.get('T12')?.expected.observation).toEqual({ bits: '00101101', representedBits: 8, symbols: 4 });
  });

  it('retains the single-symbol and sample-order boundaries without byte padding', () => {
    expect(byId(fixture.encodingVectors, 'PJ-ONE').expected).toStrictEqual({
      pairs: ['11'], bits: '11', representedBits: 2, symbols: 1, roundTripSymbolValues: [3],
    });
    expect(byId(fixture.encodingVectors, 'PJ-ORDER').expected).toStrictEqual({
      pairs: ['00', '10'], bits: '0010', representedBits: 4, symbols: 2, roundTripSymbolValues: [-3, 1],
    });
    expect(byId(fixture.comparisonCases, 'PJ-REVERSED-ANSWER').expected).toStrictEqual({
      status: 'incorrect', expectedBits: '0010', submittedBits: '1000',
    });
    expect(byId(fixture.comparisonCases, 'PJ-WRONG-ANSWER')).toMatchObject({
      input: { learnerBits: '00011011' }, expected: { status: 'incorrect', expectedBits: '00101101' },
    });
  });

  it('anchors equality and the reviewed final-bit mismatch independently', () => {
    expect(byId(fixture.comparisonCases, 'PJ-MATCH')).toMatchObject({
      input: { expectedBits: '0100111001010001', recoveredBits: '0100111001010001' },
      expected: { status: 'correct', knownPatternMatches: true, differingBits: 0,
        differingBitPositions: [], recoveredHex: ['4E', '51'] },
    });
    expect(byId(fixture.comparisonCases, 'PJ-DIFF')).toMatchObject({
      input: { expectedBits: '0100111001010001', recoveredBits: '0100111001010000' },
      expected: { status: 'incorrect', knownPatternMatches: false, differingBits: 1,
        differingBitPositions: [15], recoveredHex: ['4E', '50'] },
    });
    expect('0100111001010001'.slice(0, 15)).toBe('0100111001010000'.slice(0, 15));
    expect('0100111001010001'[15]).toBe('1');
    expect('0100111001010000'[15]).toBe('0');
    expect(64 + 16).toBe(5 * 16 + 0);
  });

  it('keeps rate, voltage, frame, FCS and service claims outside the toy comparison', () => {
    for (const vector of fixture.encodingVectors) {
      for (const key of ['seconds', 'baud', 'volts', 'bitrate', 'usefulThroughput']) {
        expect(vector.input).not.toHaveProperty(key);
        expect(vector.expected).not.toHaveProperty(key);
      }
    }
    expect(byId(fixture.comparisonCases, 'PJ-MATCH').expected).toMatchObject({
      wholeFrameIsTwoBytes: false, universalPHYErrorDetection: false,
      ethernetFcsValidated: false, higherLayerServiceProven: false,
    });
    expect(byId(fixture.comparisonCases, 'PJ-OVERCLAIM').expected).toStrictEqual({
      status: 'incorrect', knownPatternMatches: true, claimSupported: false,
    });
    expect(byId(fixture.reviewedContext.profiles, 'spec001:PROFILE-SYMBOLS').limits).toContain(
      'No analog voltage claim, complete PAM4 PHY, clock-rate/throughput inference or timing score.',
    );
  });
});

describe('T031 invalid content and learner-input preparation', () => {
  it.each(fixture.validationCases)('$id separates author errors from absent/malformed learner actions', entry => {
    expect(entry.expected['status']).toBe(entry.category === 'author' ? 'content-error' : 'invalid-input');
    expect(entry.expected).toMatchObject({ attemptPenalty: 0, progressAward: 0 });
    expect(entry.expected['reason']).toEqual(expect.any(String));
  });

  it('retains actual malformed symbol, position, mapping, model and unit inputs', () => {
    const expectedInputs: [string, JsonObject][] = [
      ['PJ-UNKNOWN-SYMBOL', { authoredSamples: [{ position: 0, value: 2, unit: 'toy-level' }] }],
      ['PJ-MISSING-SAMPLES', { authoredSamples: [] }],
      ['PJ-MISSING-POSITION', { authoredSamples: [{ value: -3, unit: 'toy-level' }] }],
      ['PJ-DUPLICATE-POSITION', { authoredSamples: [{ position: 0, value: -3, unit: 'toy-level' }, { position: 0, value: 1, unit: 'toy-level' }] }],
      ['PJ-MISSING-UNIT', { authoredSamples: [{ position: 0, value: -3 }] }],
      ['PJ-VOLT-UNIT', { authoredSamples: [{ position: 0, value: -3, unit: 'V' }] }],
      ['PJ-MISSING-MAPPING', { mapping: null }],
      ['PJ-UNKNOWN-MODEL', { profileId: 'spec001:UNKNOWN' }],
      ['PJ-ODD-BIT-COUNT', { authoredBits: '010011100101000' }],
      ['PJ-MISSING-SYMBOL-ANSWER', { authoredChallengeValid: true, learnerAction: null }],
      ['PJ-MISSING-PACKET-ANSWER', { authoredChallengeValid: true, learnerAction: null }],
      ['PJ-MALFORMED-ANSWER', { vectorId: 'PJ-T12', learnerBits: '00102' }],
    ];
    for (const [id, input] of expectedInputs) expect(byId(fixture.validationCases, id).input).toStrictEqual(input);
    expect(byId(fixture.validationCases, 'PJ-ALTERED-MAPPING').input['mapping']).toEqual([
      { value: -3, unit: 'toy-level', bits: '00' }, { value: -1, unit: 'toy-level', bits: '01' },
      { value: 1, unit: 'toy-level', bits: '11' }, { value: 3, unit: 'toy-level', bits: '10' },
    ]);
    expect(byId(fixture.validationCases, 'PJ-DUPLICATE-MAPPING').input['mapping']).toEqual([
      { value: -3, unit: 'toy-level', bits: '00' }, { value: -1, unit: 'toy-level', bits: '01' },
      { value: 1, unit: 'toy-level', bits: '10' }, { value: 3, unit: 'toy-level', bits: '10' },
    ]);
  });
});

describe('T031 physical evidence handoff — declared inputs, not fabricated evaluator results', () => {
  it('uses original T01/T02 operands and makes the complete-bench premises explicit', () => {
    for (const [name, sourceId] of [['passing-length', 'T01'], ['failing-length', 'T02']] as const) {
      const challenge = fixture.physicalChallenges[name];
      expect(challenge).toBeDefined();
      expect(challenge?.kind).toBe('copper-length');
      expect(challenge?.profileId).toBe('spec001:PROFILE-COPPER-100');
      expect(challenge?.lengths).toStrictEqual(sourceCases.get(sourceId)?.inputs['lengths']);
    }
    expect(fixture.assumptions.completeBench).toMatchObject({
      id: 'controlled-copper-bench', knownCompatibleEndpointsMediaTerminations: true,
      requiredConductorsContinuous: true, endpointPowerKnownGood: true,
      upperDependenciesKnownGoodForThisLab: true, otherPhysicalConditionsKnownGoodForThisLab: true,
    });
    expect(fixture.assumptions.lengthOnlyBench).not.toHaveProperty('requiredConductorsContinuous');
    expect(fixture.assumptions.physicalHandoff).toContain('actual result plus that version');
    expect(fixture.assumptions.physicalHandoff).toContain('never fabricated inputs or fake return values');
  });

  it.each(fixture.transmissionCases)('$id contains a resolvable physical input and cannot award progress', entry => {
    if (entry.physicalChallenge !== null) {
      expect(fixture.physicalChallenges).toHaveProperty(entry.physicalChallenge);
      expect(entry.evaluatedVersion).not.toBeNull();
    }
    expect(['controlled-copper-bench', 'length-only']).toContain(entry.bench);
    expect(['none', 'last-toy-symbol-substitution']).toContain(entry.impairment);
    expect(entry.expected['progressAward']).toBe(0);
    expect(entry).not.toHaveProperty('physicalResult');
    expect(entry).not.toHaveProperty('animationSucceeded');
    if (!['PJ-TRANSMIT-PASS', 'PJ-TRANSMIT-AFTER-REPAIR'].includes(entry.id)) {
      expect(entry.expected['transmissionSucceeded']).toBe(false);
    }
  });

  it('anchors scoped pass and the separately declared substitution on a current failing path', () => {
    expect(85 + 10).toBe(95);
    expect(100 - 95).toBe(5);
    expect(95 + 10).toBe(105);
    expect(105 - 100).toBe(5);
    expect(byId(fixture.transmissionCases, 'PJ-TRANSMIT-PASS').expected).toStrictEqual({
      physicalStatus: 'correct', physicalScope: 'length only', totalMetres: 95, headroomMetres: 5,
      journeyStatus: 'correct', transmissionSucceeded: true,
      recoveredSymbolValues: [-1, -3, 3, 1, -1, -1, -3, -1], recoveredBits: '0100111001010001',
      knownPatternMatches: true, progressAward: 0, wholeRouteProven: false, higherLayerServiceProven: false,
    });
    expect(fixture.assumptions.substitution).toMatchObject({
      id: 'last-toy-symbol-substitution', position: 7,
      from: { value: -1, unit: 'toy-level' }, to: { value: -3, unit: 'toy-level' },
    });
    expect(byId(fixture.transmissionCases, 'PJ-TRANSMIT-IMPAIRED').expected).toStrictEqual({
      physicalStatus: 'incorrect', physicalScope: 'length only', totalMetres: 105, excessMetres: 5,
      journeyStatus: 'incorrect', transmissionSucceeded: false,
      recoveredSymbolValues: [-1, -3, 3, 1, -1, -1, -3, -3], recoveredBits: '0100111001010000',
      knownPatternMatches: false, differingBits: 1, progressAward: 0,
      wholeRouteProven: false, higherLayerServiceProven: false,
    });
    expect(fixture.assumptions.substitution['when']).toContain('Never infer this substitution from a cable length');
  });

  it('records each non-success status explicitly and never manufactures recovered bits', () => {
    const boundaries: [string, EvaluationStatus | null, EvaluationStatus][] = [
      ['PJ-TRANSMIT-FAIL-NO-SUBSTITUTION', 'incorrect', 'incorrect'],
      ['PJ-TRANSMIT-CONTENT-ERROR', 'content-error', 'content-error'],
      ['PJ-TRANSMIT-INVALID-ACTION', 'invalid-input', 'invalid-input'],
      ['PJ-TRANSMIT-MISSING-RESULT', null, 'invalid-input'],
      ['PJ-TRANSMIT-STALE-CONFIG', 'correct', 'invalid-input'],
      ['PJ-TRANSMIT-STALE-ATTEMPT', 'correct', 'invalid-input'],
      ['PJ-TRANSMIT-STALE-FLAG', 'correct', 'invalid-input'],
      ['PJ-TRANSMIT-LENGTH-ONLY', 'correct', 'content-error'],
    ];
    for (const [id, physicalStatus, journeyStatus] of boundaries) {
      expect(byId(fixture.transmissionCases, id).expected).toMatchObject({
        physicalStatus, journeyStatus, transmissionSucceeded: false,
        recoveredBits: null, knownPatternMatches: null, progressAward: 0,
      });
    }
  });

  it('requires a new current evaluation after repair instead of relabeling earlier evidence', () => {
    const before = byId(fixture.transmissionCases, 'PJ-TRANSMIT-IMPAIRED');
    const after = byId(fixture.transmissionCases, 'PJ-TRANSMIT-AFTER-REPAIR');
    expect(after).toMatchObject({
      priorTransmissionCaseId: 'PJ-TRANSMIT-IMPAIRED', physicalChallenge: 'passing-length',
      physicalAction: { kind: 'measure-length' }, impairment: 'none', stale: false,
      evaluatedVersion: { configurationRevision: 8, attemptId: 'attempt-a' },
      currentVersion: { configurationRevision: 8, attemptId: 'attempt-a' },
    });
    expect(before).toMatchObject({
      physicalChallenge: 'failing-length', impairment: 'last-toy-symbol-substitution',
      evaluatedVersion: { configurationRevision: 7, attemptId: 'attempt-a' },
      expected: { transmissionSucceeded: false, recoveredBits: '0100111001010000' },
    });
    expect(after.expected).toStrictEqual({
      physicalStatus: 'correct', physicalScope: 'length only', totalMetres: 95, headroomMetres: 5,
      journeyStatus: 'correct', transmissionSucceeded: true,
      recoveredSymbolValues: [-1, -3, 3, 1, -1, -1, -3, -1], recoveredBits: '0100111001010001',
      knownPatternMatches: true, progressAward: 0, wholeRouteProven: false, higherLayerServiceProven: false,
    });
  });

  it('separately captures configuration, attempt and explicit-stale invalidation', () => {
    expect(byId(fixture.transmissionCases, 'PJ-TRANSMIT-STALE-CONFIG')).toMatchObject({
      evaluatedVersion: { configurationRevision: 7, attemptId: 'attempt-a' },
      currentVersion: { configurationRevision: 8, attemptId: 'attempt-a' }, stale: false,
    });
    expect(byId(fixture.transmissionCases, 'PJ-TRANSMIT-STALE-ATTEMPT')).toMatchObject({
      evaluatedVersion: { configurationRevision: 7, attemptId: 'attempt-a' },
      currentVersion: { configurationRevision: 7, attemptId: 'attempt-b' }, stale: false,
    });
    expect(byId(fixture.transmissionCases, 'PJ-TRANSMIT-STALE-FLAG')).toMatchObject({
      evaluatedVersion: { configurationRevision: 7, attemptId: 'attempt-a' },
      currentVersion: { configurationRevision: 7, attemptId: 'attempt-a' }, stale: true,
    });
    expect(fixture.assumptions.resultFreshness).toContain('beginning, stepping to a result and replaying');
  });
});

describe('T031 pause/step/replay contract preparation — controls remain T033/T034', () => {
  it('defines explicit checkpoints without an elapsed-time or completion-reward channel', () => {
    expect(fixture.handoff['phases']).toEqual(['payload', 'encode', 'transmit', 'decode', 'compare']);
    for (const entry of fixture.controlCases) expect(entry.expected).toMatchObject({ progressAward: 0, itemConsumption: 0 });
    expect(byId(fixture.controlCases, 'PJ-PAUSE')).toMatchObject({
      start: { phase: 'encode', paused: false }, actions: ['pause', 'idle'],
      expected: { phase: 'encode', paused: true, sampleOrderChanged: false },
    });
    expect(byId(fixture.controlCases, 'PJ-STEP')).toMatchObject({
      start: { phase: 'encode', paused: true }, actions: ['step'],
      expected: { phase: 'transmit', paused: true, sampleOrderChanged: false },
    });
    expect(byId(fixture.controlCases, 'PJ-REPLAY').expected).toMatchObject({
      phaseSequence: ['payload', 'encode', 'transmit', 'decode', 'compare'],
      recoveredBits: '0100111001010001', physicalVersionChanged: false,
    });
    expect(byId(fixture.controlCases, 'PJ-REPLAY-STALE').expected).toMatchObject({
      freshPhysicalEvaluationRequired: true, transmissionSucceeded: false,
    });
    expect(byId(fixture.controlCases, 'PJ-RENDERER-FINISHED')).toMatchObject({
      actions: ['renderer-animation-finished'], expected: { phase: 'transmit', paused: true, transmissionSucceeded: false },
    });
  });
});

describe('T032 real encoding/comparison/validation/current-physical-result execution — pending', () => {
  for (const entry of [...fixture.encodingVectors, ...fixture.comparisonCases, ...fixture.validationCases, ...fixture.transmissionCases]) {
    it.todo(`${entry.id}: execute actual domain code against this independently authored expectation`);
  }
});

describe('T033/T034 real pause/step/replay and renderer authority checks — pending', () => {
  for (const entry of fixture.controlCases) {
    it.todo(`${entry.id}: exercise actual controls/domain state; keyboard/pointer integration remains required`);
  }
});
