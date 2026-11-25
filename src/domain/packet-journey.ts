// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { evaluateCopper, CopperObservation } from './copper';
import { isRecord } from './evaluate';
import type { DomainAction, EvaluationResult, EvaluationStatus, WorldVersion } from './types';

/** T006/T031's exact discrete teaching map; toy-level is NOT a save Reading unit. */
export type ToyLevel = -3 | -1 | 1 | 3;
export interface ToySymbol { readonly value: ToyLevel; readonly unit: 'toy-level' }
export interface ToySample extends ToySymbol { readonly position: number }
export interface ToySymbolProfile {
  readonly id: 'spec001:PROFILE-SYMBOLS';
  readonly parameters: {
    readonly bitsPerSymbol: 2;
    readonly levels: readonly { readonly symbol: ToySymbol; readonly bits: string }[];
  };
}
export interface PacketProfile {
  readonly id: 'spec001:PROFILE-PACKET';
  readonly parameters: {
    readonly payloadHex: readonly ['4E', '51'];
    readonly payloadText: 'NQ';
    readonly highlightedBits: '0100111001010001';
    readonly displayBitOrder: 'most-significant-bit first within each highlighted byte';
  };
}
export interface SymbolChallenge { readonly profile: ToySymbolProfile; readonly samples: readonly ToySample[] }
export interface PatternChallenge { readonly profile: PacketProfile; readonly expectedBits: string; readonly recoveredBits: string }
export interface PatternInput { readonly claim: 'known-pattern-matches' | 'matching-NQ-proves-every-application' }
export type JourneyPhase = 'payload' | 'encode' | 'transmit' | 'decode' | 'compare';
export interface PacketJourneyInput { readonly kind: 'inspect'; readonly phase: JourneyPhase }
/** Authored, bounded lab premises, separate from measurements and the packet profile. */
export interface PacketBench {
  readonly id: 'controlled-copper-bench';
  readonly profileId: 'spec001:PROFILE-COPPER-100';
  readonly knownCompatibleEndpointsMediaTerminations: true;
  readonly requiredConductorsContinuous: true;
  readonly endpointPowerKnownGood: true;
  readonly upperDependenciesKnownGoodForThisLab: true;
  readonly otherPhysicalConditionsKnownGoodForThisLab: true;
  readonly claimScope: string;
}
export interface ToySubstitution {
  readonly id: 'last-toy-symbol-substitution';
  readonly position: 7;
  readonly from: { readonly value: -1; readonly unit: 'toy-level' };
  readonly to: { readonly value: -3; readonly unit: 'toy-level' };
}
export interface PacketJourneyChallenge {
  readonly packetProfile: PacketProfile;
  readonly symbolProfile: ToySymbolProfile;
  readonly bench: PacketBench;
  /** Explicit null means no trace. A failed length predicate never predicts bits. */
  readonly impairment: ToySubstitution | null;
}
export interface PacketPhysicalEvidence {
  /** Supply the actual evaluator return. Renderer flags are not accepted. */
  readonly result: ReturnType<typeof evaluateCopper>;
  readonly evaluatedVersion: WorldVersion;
  readonly stale: boolean;
}
export interface PacketJourneyWorld extends WorldVersion {
  readonly physicalEvidence: PacketPhysicalEvidence | null;
}
interface NoEffects { readonly attemptPenalty: 0; readonly progressAward: 0 }
interface TeachingScope {
  readonly wholeFrameIsTwoBytes: false;
  readonly universalPHYErrorDetection: false;
  readonly ethernetFcsValidated: false;
  readonly higherLayerServiceProven: false;
  readonly wholeRouteProven: false;
  readonly frameContext: 'highlighted bytes inside an opaque upper-interface frame';
}
export interface PacketFailureObservation extends NoEffects {
  readonly kind: 'packet-error';
  readonly reason: string;
  readonly field: string;
  readonly transmissionSucceeded: false;
  readonly recoveredBits: null;
  readonly knownPatternMatches: null;
}
export interface ToyTrace extends NoEffects {
  readonly kind: 'toy-trace';
  readonly bits: string;
  readonly pairs: readonly string[];
  readonly samples: readonly ToySample[];
  readonly symbolValues: readonly ToyLevel[];
  readonly samplePositions: readonly number[];
  readonly symbolUnit: 'toy-level';
  readonly representedBits: number;
  readonly symbols: number;
  readonly roundTripSymbolValues: readonly ToyLevel[];
}
export interface PacketEncoding extends Omit<ToyTrace, 'kind'>, TeachingScope {
  readonly kind: 'packet-encoding';
  readonly payloadDecimal: readonly number[];
  readonly payloadText: string;
  readonly byteBits: readonly string[];
  readonly roundTripHex: readonly string[];
}
export interface PatternComparison extends NoEffects, TeachingScope {
  readonly kind: 'packet-comparison';
  readonly knownPatternMatches: boolean;
  readonly claimSupported: boolean;
  readonly differingBits: number;
  readonly differingBitPositions: readonly number[];
  readonly recoveredHex: readonly string[];
}
export interface SymbolAnswer extends NoEffects {
  readonly kind: 'symbol-answer';
  readonly expectedBits: string;
  readonly submittedBits: string;
  readonly trace: ToyTrace;
}
export interface JourneyObservation extends NoEffects, TeachingScope {
  readonly kind: 'packet-journey';
  readonly phase: JourneyPhase;
  readonly version: WorldVersion;
  readonly physicalStatus: 'correct' | 'incorrect';
  readonly physicalReasonCode: string;
  readonly physicalObservation: CopperObservation;
  readonly payloadHex: readonly string[];
  readonly encoded: PacketEncoding | null;
  readonly recoveredSymbolValues: readonly ToyLevel[] | null;
  readonly recoveredBits: string | null;
  readonly knownPatternMatches: boolean | null;
  readonly differingBits: number | null;
  readonly comparison: PatternComparison | null;
  readonly transmissionSucceeded: boolean;
  readonly impairmentApplied: boolean;
}
export type PacketResult<T> = EvaluationResult<T | PacketFailureObservation, never>;

const MAX_SYMBOLS = 256;
const LEVELS: readonly ToyLevel[] = [-3, -1, 1, 3];
const PAIRS = ['00', '01', '10', '11'] as const;
const PHASES: readonly JourneyPhase[] = ['payload', 'encode', 'transmit', 'decode', 'compare'];
const zero = { attemptPenalty: 0, progressAward: 0 } as const;
const scope: TeachingScope = {
  wholeFrameIsTwoBytes: false, universalPHYErrorDetection: false,
  ethernetFcsValidated: false, higherLayerServiceProven: false, wholeRouteProven: false,
  frameContext: 'highlighted bytes inside an opaque upper-interface frame',
};
interface Issue { readonly reason: string; readonly field: string }
function issue(reason: string, field: string): Issue { return { reason, field }; }
function freeze<T>(value: T): T {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) freeze(child);
    Object.freeze(value);
  }
  return value;
}
function result<T>(status: EvaluationStatus, reasonCode: string, observation: T): PacketResult<T> {
  return freeze({ status, reasonCode, observations: [observation], acceptedEffects: [] }) as PacketResult<T>;
}
function failure(problem: Issue, status: 'content-error' | 'invalid-input' = 'content-error'): PacketResult<never> {
  return result<PacketFailureObservation>(status, problem.reason, {
    kind: 'packet-error', ...problem, ...zero,
    transmissionSucceeded: false, recoveredBits: null, knownPatternMatches: null,
  });
}
function onlyKeys(record: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(record).every(key => keys.includes(key));
}
function symbolProfileIssue(profile: unknown): Issue | null {
  if (!isRecord(profile) || profile['id'] !== 'spec001:PROFILE-SYMBOLS') return issue('unknown-authored-profile', 'profile.id');
  const p = profile['parameters'];
  if (!isRecord(p) || !Array.isArray(p['levels']) || p['levels'].length === 0) return issue('missing-reviewed-mapping', 'profile.parameters.levels');
  const rows = p['levels'];
  if (rows.length !== 4 || p['bitsPerSymbol'] !== 2 || !onlyKeys(p, ['levels', 'bitsPerSymbol'])) return issue('reviewed-mapping-mismatch', 'profile.parameters');
  const values = new Set<unknown>();
  const pairs = new Set<unknown>();
  for (const row of rows) {
    if (!isRecord(row) || !isRecord(row['symbol']) || !onlyKeys(row, ['symbol', 'bits'])
      || !onlyKeys(row['symbol'], ['value', 'unit']) || row['symbol']['unit'] !== 'toy-level'
      || !LEVELS.includes(row['symbol']['value'] as ToyLevel) || typeof row['bits'] !== 'string' || !/^[01]{2}$/.test(row['bits'])) return issue('reviewed-mapping-mismatch', 'profile.parameters.levels');
    if (values.has(row['symbol']['value']) || pairs.has(row['bits'])) return issue('ambiguous-mapping', 'profile.parameters.levels');
    values.add(row['symbol']['value']); pairs.add(row['bits']);
  }
  for (const row of rows) {
    const r = row as { symbol: ToySymbol; bits: string };
    if (PAIRS[LEVELS.indexOf(r.symbol.value)] !== r.bits) return issue('reviewed-mapping-mismatch', 'profile.parameters.levels');
  }
  return null;
}
function bitsIssue(bits: unknown): Issue | null {
  if (typeof bits !== 'string' || bits.length === 0 || bits.length > MAX_SYMBOLS * 2 || !/^[01]+$/.test(bits)) return issue('malformed-authored-bits', 'bits');
  if (bits.length % 2 !== 0) return issue('incomplete-symbol-pair', 'bits');
  return null;
}
function samplesIssue(samples: unknown): Issue | null {
  if (!Array.isArray(samples) || samples.length === 0) return issue('missing-authored-samples', 'samples');
  if (samples.length > MAX_SYMBOLS) return issue('too-many-authored-samples', 'samples');
  const positions = new Set<number>();
  for (const [index, sample] of samples.entries()) {
    const field = `samples[${index}]`;
    if (!isRecord(sample) || !Number.isSafeInteger(sample['position']) || (sample['position'] as number) < 0) return issue('missing-sample-position', field);
    const position = sample['position'] as number;
    if (positions.has(position)) return issue('ambiguous-sample-position', field);
    positions.add(position);
    if (position !== index) return issue('ambiguous-sample-position', field);
    if (sample['unit'] === undefined) return issue('missing-symbol-unit', field);
    if (sample['unit'] !== 'toy-level') return issue('wrong-symbol-unit', field);
    if (!LEVELS.includes(sample['value'] as ToyLevel)) return issue('unsupported-authored-symbol', field);
    if (!onlyKeys(sample, ['position', 'value', 'unit'])) return issue('unsupported-sample-field', field);
  }
  return null;
}
function packetProfileIssue(profile: unknown): Issue | null {
  if (!isRecord(profile) || profile['id'] !== 'spec001:PROFILE-PACKET') return issue('unknown-authored-profile', 'packetProfile.id');
  const p = profile['parameters'];
  if (!isRecord(p) || !onlyKeys(p, ['payloadHex', 'payloadText', 'highlightedBits', 'displayBitOrder'])
    || !Array.isArray(p['payloadHex']) || p['payloadHex'].length !== 2 || p['payloadHex'][0] !== '4E' || p['payloadHex'][1] !== '51'
    || p['payloadText'] !== 'NQ' || p['highlightedBits'] !== '0100111001010001'
    || p['displayBitOrder'] !== 'most-significant-bit first within each highlighted byte') return issue('reviewed-packet-mismatch', 'packetProfile.parameters');
  return null;
}
function traceFromBits(bits: string): ToyTrace {
  const pairs: string[] = [];
  const samples: ToySample[] = [];
  for (let index = 0; index < bits.length; index += 2) {
    const pair = bits.slice(index, index + 2);
    pairs.push(pair);
    samples.push({ position: index / 2, value: LEVELS[parseInt(pair, 2)]!, unit: 'toy-level' });
  }
  const values = samples.map(sample => sample.value);
  return { kind: 'toy-trace', ...zero, bits, pairs, samples, symbolValues: values,
    samplePositions: samples.map(sample => sample.position), symbolUnit: 'toy-level',
    representedBits: bits.length, symbols: samples.length, roundTripSymbolValues: [...values] };
}
function bitsFromSamples(samples: readonly ToySample[]): string { return samples.map(sample => PAIRS[LEVELS.indexOf(sample.value)]).join(''); }
function hexFromBits(bits: string): string[] {
  const bytes: string[] = [];
  for (let index = 0; index < bits.length; index += 8) bytes.push(parseInt(bits.slice(index, index + 8), 2).toString(16).toUpperCase().padStart(2, '0'));
  return bytes;
}
/** Pure encoding validity is not a physical path result or learner completion. */
export function encodeToyBits(profile: ToySymbolProfile, bits: string): PacketResult<ToyTrace> {
  const invalid = symbolProfileIssue(profile) ?? bitsIssue(bits);
  return invalid ? failure(invalid) : result('correct', 'toy-bits-encoded', traceFromBits(bits));
}
export function decodeToySamples(profile: ToySymbolProfile, samples: readonly ToySample[]): PacketResult<ToyTrace> {
  const invalid = symbolProfileIssue(profile) ?? samplesIssue(samples);
  return invalid ? failure(invalid) : result('correct', 'toy-samples-decoded', traceFromBits(bitsFromSamples(samples)));
}
function packetEncoding(profile: PacketProfile): PacketEncoding {
  const payloadDecimal = profile.parameters.payloadHex.map(byte => parseInt(byte, 16));
  const byteBits = payloadDecimal.map(byte => byte.toString(2).padStart(8, '0'));
  const trace = traceFromBits(byteBits.join(''));
  return { ...trace, kind: 'packet-encoding', ...scope, payloadDecimal,
    payloadText: String.fromCharCode(...payloadDecimal), byteBits, roundTripHex: hexFromBits(bitsFromSamples(trace.samples)) };
}
export function encodePacketPayload(profile: PacketProfile, symbols: ToySymbolProfile): PacketResult<PacketEncoding> {
  const invalid = packetProfileIssue(profile) ?? symbolProfileIssue(symbols);
  return invalid ? failure(invalid) : result('correct', 'highlighted-payload-encoded', packetEncoding(profile));
}
function validVersion(value: unknown): value is WorldVersion {
  return isRecord(value) && Number.isSafeInteger(value['configurationRevision']) && (value['configurationRevision'] as number) >= 0
    && typeof value['attemptId'] === 'string' && value['attemptId'].trim().length > 0 && value['attemptId'].length <= 160;
}
function sameVersion(a: WorldVersion, b: WorldVersion): boolean { return a.configurationRevision === b.configurationRevision && a.attemptId === b.attemptId; }
function versionCopy(world: WorldVersion): WorldVersion { return { configurationRevision: world.configurationRevision, attemptId: world.attemptId }; }
function actionIssue(action: unknown, world: unknown): Issue | null {
  if (!isRecord(action) || typeof action['actionId'] !== 'string' || action['actionId'].trim().length === 0 || action['actionId'].length > 160
    || !validVersion(action['expectedVersion']) || !validVersion(world)) return issue('malformed-action-envelope', 'action');
  if (!sameVersion(action['expectedVersion'], world)) return issue('stale-action', 'action.expectedVersion');
  return action['input'] === null || action['input'] === undefined ? issue('required-action-missing', 'action.input') : null;
}
export function evaluateSymbolAnswer(challenge: SymbolChallenge, action: DomainAction<{ readonly bits: string }>, world: WorldVersion): PacketResult<SymbolAnswer> {
  const invalid = !isRecord(challenge) ? issue('malformed-symbol-challenge', 'challenge')
    : symbolProfileIssue(challenge.profile) ?? samplesIssue(challenge.samples)
      ?? (!onlyKeys(challenge, ['profile', 'samples']) ? issue('unsupported-challenge-field', 'challenge') : null);
  if (invalid) return failure(invalid);
  const badAction = actionIssue(action, world);
  if (badAction) return failure(badAction, 'invalid-input');
  if (!isRecord(action.input) || !onlyKeys(action.input, ['bits']) || typeof action.input.bits !== 'string'
    || action.input.bits.length === 0 || action.input.bits.length > MAX_SYMBOLS * 2 || !/^[01]+$/.test(action.input.bits)) return failure(issue('malformed-learner-bits', 'action.input.bits'), 'invalid-input');
  const expectedBits = bitsFromSamples(challenge.samples);
  return result(expectedBits === action.input.bits ? 'correct' : 'incorrect', expectedBits === action.input.bits ? 'symbol-answer-matches' : 'symbol-answer-differs', {
    kind: 'symbol-answer', ...zero, expectedBits, submittedBits: action.input.bits, trace: traceFromBits(expectedBits),
  });
}
function comparison(expectedBits: string, recoveredBits: string, claim: PatternInput['claim']): PatternComparison {
  const differingBitPositions = [...expectedBits].flatMap((bit, index) => bit === recoveredBits[index] ? [] : [index]);
  return { kind: 'packet-comparison', ...zero, ...scope, knownPatternMatches: differingBitPositions.length === 0,
    claimSupported: claim === 'known-pattern-matches', differingBits: differingBitPositions.length, differingBitPositions,
    recoveredHex: hexFromBits(recoveredBits) };
}
export function comparePacketPattern(challenge: PatternChallenge, action: DomainAction<PatternInput>, world: WorldVersion): PacketResult<PatternComparison> {
  const invalid = !isRecord(challenge) ? issue('malformed-pattern-challenge', 'challenge') : packetProfileIssue(challenge.profile)
    ?? (challenge.expectedBits !== challenge.profile.parameters.highlightedBits ? issue('reviewed-packet-mismatch', 'expectedBits') : null)
    ?? (bitsIssue(challenge.recoveredBits) || challenge.recoveredBits.length !== 16 ? issue('malformed-recovered-pattern', 'recoveredBits') : null)
    ?? (!onlyKeys(challenge, ['profile', 'expectedBits', 'recoveredBits']) ? issue('unsupported-challenge-field', 'challenge') : null);
  if (invalid) return failure(invalid);
  const badAction = actionIssue(action, world);
  if (badAction) return failure(badAction, 'invalid-input');
  if (!isRecord(action.input) || !onlyKeys(action.input, ['claim']) || !['known-pattern-matches', 'matching-NQ-proves-every-application'].includes(action.input.claim)) return failure(issue('malformed-comparison-action', 'action.input'), 'invalid-input');
  const observed = comparison(challenge.expectedBits, challenge.recoveredBits, action.input.claim);
  return result(observed.knownPatternMatches && observed.claimSupported ? 'correct' : 'incorrect',
    !observed.claimSupported ? 'unsupported-service-claim' : observed.knownPatternMatches ? 'known-pattern-matches' : 'known-pattern-differs', observed);
}
function journeyIssue(challenge: unknown): Issue | null {
  if (!isRecord(challenge) || !onlyKeys(challenge, ['packetProfile', 'symbolProfile', 'bench', 'impairment'])) return issue('malformed-journey-challenge', 'challenge');
  const invalid = packetProfileIssue(challenge['packetProfile']) ?? symbolProfileIssue(challenge['symbolProfile']);
  if (invalid) return invalid;
  const bench = challenge['bench'];
  const premises = ['knownCompatibleEndpointsMediaTerminations', 'requiredConductorsContinuous', 'endpointPowerKnownGood',
    'upperDependenciesKnownGoodForThisLab', 'otherPhysicalConditionsKnownGoodForThisLab'];
  if (!isRecord(bench) || bench['id'] !== 'controlled-copper-bench' || bench['profileId'] !== 'spec001:PROFILE-COPPER-100'
    || premises.some(key => bench[key] !== true) || typeof bench['claimScope'] !== 'string' || !bench['claimScope'].trim() || bench['claimScope'].length > 1024
    || !onlyKeys(bench, ['id', 'profileId', 'claimScope', ...premises])) return issue('incomplete-laboratory-premises', 'bench');
  const trace = challenge['impairment'];
  if (trace === null) return null;
  if (!isRecord(trace) || trace['id'] !== 'last-toy-symbol-substitution' || trace['position'] !== 7
    || !isRecord(trace['from']) || !isRecord(trace['to']) || trace['from']['value'] !== -1 || trace['to']['value'] !== -3
    || trace['from']['unit'] !== 'toy-level' || trace['to']['unit'] !== 'toy-level'
    || !onlyKeys(trace['from'], ['value', 'unit']) || !onlyKeys(trace['to'], ['value', 'unit'])
    || !onlyKeys(trace, ['id', 'position', 'from', 'to', 'when', 'explanation'])) return issue('unsupported-toy-impairment', 'impairment');
  return null;
}
function metreReading(value: unknown): boolean {
  return isRecord(value) && onlyKeys(value, ['value', 'unit']) && value['unit'] === 'm'
    && typeof value['value'] === 'number' && Number.isFinite(value['value']) && value['value'] >= 0;
}
type LengthObservation = Extract<CopperObservation, { kind: 'copper-length' }>;
/** Validate the supported evaluator boundary, without promoting its scoped result. */
function lengthObservation(value: unknown, status: EvaluationStatus): value is LengthObservation {
  return isRecord(value) && value['kind'] === 'copper-length' && value['profileId'] === 'spec001:PROFILE-COPPER-100'
    && value['scope'] === 'length only' && value['wholeRouteProven'] === false && validVersion(value['version'])
    && metreReading(value['total']) && metreReading(value['maximum'])
    && (value['maximum'] as { value: number }).value === 100
    && metreReading(value[status === 'correct' ? 'headroom' : 'excess'])
    && onlyKeys(value, ['kind', 'profileId', 'scope', 'wholeRouteProven', 'version', 'total', 'maximum', status === 'correct' ? 'headroom' : 'excess']);
}
/**
 * Inspect a checkpoint using current evidence on EVERY call (including replay).
 * T033 owns pause/position, T034 binds real world inputs; neither caches a prior
 * comparison as fresh proof. No phase, animation, or result grants any effects.
 * Only this reviewed copper bench is supported; other path models need review.
 */
export function evaluatePacketJourney(challenge: PacketJourneyChallenge, action: DomainAction<PacketJourneyInput>, world: PacketJourneyWorld): PacketResult<JourneyObservation> {
  const invalid = journeyIssue(challenge);
  if (invalid) return failure(invalid);
  const evidence = isRecord(world) ? world.physicalEvidence : null;
  // The physical evaluator's authored-content failure takes precedence over a bad learner action.
  if (isRecord(evidence) && isRecord(evidence.result) && evidence.result.status === 'content-error') return failure(issue('physical-content-error', 'physicalEvidence.result'));
  const badAction = actionIssue(action, world);
  if (badAction) return failure(badAction, 'invalid-input');
  if (!isRecord(action.input) || !onlyKeys(action.input, ['kind', 'phase']) || action.input.kind !== 'inspect' || !PHASES.includes(action.input.phase)) return failure(issue('malformed-journey-action', 'action.input'), 'invalid-input');
  if (!isRecord(evidence) || !validVersion(evidence.evaluatedVersion) || typeof evidence.stale !== 'boolean'
    || !isRecord(evidence.result)) return failure(issue('missing-physical-evidence', 'physicalEvidence'), 'invalid-input');
  if (evidence.stale || !sameVersion(evidence.evaluatedVersion, world)) return failure(issue('stale-physical-evidence', 'physicalEvidence.evaluatedVersion'), 'invalid-input');
  const physical = evidence.result;
  if (physical.status === 'invalid-input') return failure(issue('invalid-physical-input', 'physicalEvidence.result'), 'invalid-input');
  if ((physical.status !== 'correct' && physical.status !== 'incorrect') || !Array.isArray(physical.observations) || physical.observations.length !== 1
    || !Array.isArray(physical.acceptedEffects) || physical.acceptedEffects.length !== 0
    || physical.reasonCode !== (physical.status === 'correct' ? 'length-within-profile' : 'length-exceeded')
    || !lengthObservation(physical.observations[0], physical.status)) return failure(issue('unsupported-physical-result', 'physicalEvidence.result'));
  const observed = physical.observations[0];
  if (!sameVersion(observed.version, evidence.evaluatedVersion) || !sameVersion(observed.version, world)) return failure(issue('stale-physical-observation', 'physicalEvidence.result.observations.version'), 'invalid-input');
  // Copy only supported observation fields; never freeze or retain the caller's result.
  const physicalObservation: LengthObservation = {
    kind: 'copper-length', profileId: observed.profileId, scope: 'length only', wholeRouteProven: false,
    version: versionCopy(observed.version), total: { ...observed.total }, maximum: { ...observed.maximum },
    ...('headroom' in observed ? { headroom: { ...observed.headroom } } : { excess: { ...observed.excess } }),
  };
  const encoded = packetEncoding(challenge.packetProfile);
  const received = physical.status === 'correct' ? encoded.samples.map(sample => ({ ...sample }))
    : challenge.impairment === null ? null : encoded.samples.map(sample => sample.position === challenge.impairment?.position
      ? { ...sample, ...challenge.impairment.to } : { ...sample });
  const recoveredBits = received === null ? null : bitsFromSamples(received);
  const compared = recoveredBits === null ? null : comparison(encoded.bits, recoveredBits, 'known-pattern-matches');
  const phase = action.input.phase;
  const checkpoint = PHASES.indexOf(phase);
  return result<JourneyObservation>(physical.status, physical.status === 'correct' ? 'laboratory-transmission-valid' : 'physical-path-failed', {
    kind: 'packet-journey', ...zero, ...scope, phase, version: versionCopy(world),
    physicalStatus: physical.status, physicalReasonCode: physical.reasonCode, physicalObservation,
    payloadHex: [...challenge.packetProfile.parameters.payloadHex], encoded: checkpoint >= 1 ? encoded : null,
    recoveredSymbolValues: checkpoint >= 2 && received !== null ? received.map(sample => sample.value) : null,
    recoveredBits: checkpoint >= 3 ? recoveredBits : null,
    knownPatternMatches: checkpoint >= 4 ? compared?.knownPatternMatches ?? null : null,
    differingBits: checkpoint >= 4 ? compared?.differingBits ?? null : null,
    comparison: checkpoint >= 4 ? compared : null,
    transmissionSucceeded: phase === 'compare' && physical.status === 'correct' && compared?.knownPatternMatches === true,
    impairmentApplied: checkpoint >= 2 && physical.status === 'incorrect' && challenge.impairment !== null,
  });
}
