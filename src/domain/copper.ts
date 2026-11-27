// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import {
  createEvaluator, invalidInput, isRecord, quantityIssue,
} from './evaluate';
import type { AuthoredQuantity, ContentIssue, EvaluatedQuantity } from './evaluate';
import type { Metres, WorldVersion } from './types';

/**
 * Projection of the reviewed/validated content profile, not a new content schema.
 * T006 PROFILE-COPPER-100 is a fictional single passive channel. This identity's
 * 100 m inclusive limit is not a universal Ethernet rule; new limits/topologies
 * need source/model/case review before they become supported profiles.
 */
export interface CopperProfile {
  readonly id: 'spec001:PROFILE-COPPER-100';
  readonly parameters: {
    readonly maximumChannelLength: AuthoredQuantity<'m'>;
    readonly inclusiveMaximum: true;
  };
}
export type CopperChallenge = {
  readonly kind: 'copper-length';
  readonly profile: CopperProfile;
  readonly lengths: readonly AuthoredQuantity<'m'>[];
} | {
  readonly kind: 'copper-continuity';
  readonly profile: CopperProfile;
  /** Current supplied path facts, after any repair; true means intact. */
  readonly requiredConductors: readonly boolean[];
} | {
  readonly kind: 'copper-path';
  readonly profile: CopperProfile;
  /** Supplied match of all required endpoint, medium and termination profiles. */
  readonly compatible: boolean;
  readonly lengths: readonly AuthoredQuantity<'m'>[];
  readonly requiredConductors: readonly boolean[];
} | {
  readonly kind: 'copper-termination';
  readonly profile: CopperProfile;
  /** This narrow check supplies no facts about other equipment or the path. */
  readonly chosenTerminationCompatible: boolean;
};
export interface CopperInput {
  readonly kind: 'measure-length' | 'test-continuity' | 'add-repeater' | 'test-path' | 'check-termination';
}
interface CopperObservationBase {
  readonly profileId: CopperProfile['id'];
  readonly version: WorldVersion;
  readonly wholeRouteProven: false;
}
type CopperLengthReading = {
  readonly total: EvaluatedQuantity<'m'>;
  readonly maximum: EvaluatedQuantity<'m'>;
} & ({ readonly headroom: EvaluatedQuantity<'m'> } | { readonly excess: EvaluatedQuantity<'m'> });
interface CopperContinuityReading {
  readonly continuous: boolean;
  readonly openConductorIndexes: readonly number[];
}
export type CopperObservation = CopperObservationBase & ({
  readonly kind: 'copper-length';
  readonly scope: 'length only';
} & CopperLengthReading | {
  readonly kind: 'copper-continuity';
  readonly scope: 'continuity only';
} & CopperContinuityReading | {
  readonly kind: 'copper-path';
  readonly scope: 'passive copper path only';
} & ({ readonly compatible: false; readonly pathPasses: false } | {
  readonly compatible: true;
  readonly pathPasses: boolean;
} & CopperLengthReading & CopperContinuityReading) | {
  readonly kind: 'copper-termination';
  readonly scope: 'termination compatibility only';
  readonly compatible: boolean;
});

function issue(code: string, field: string, message: string): ContentIssue {
  return { code, field, message };
}

function profileIssue(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['id'] !== 'spec001:PROFILE-COPPER-100') {
    return issue('unknown-authored-profile', 'profile.id', 'Select a reviewed supported copper profile; no default length limit is assumed.');
  }
  // Accept the projection and the reviewed source/content records that contain
  // it, but never silently discard new topology or scoring fields. Metadata is
  // validated by the content boundary; only the declared parameters score here.
  const profileFields = ['id', 'parameters', 'kind', 'sources', 'assumptions', 'limits',
    'schemaVersion', 'episodeId', 'contentVersion', 'reviewedProfileId', 'ruleIds',
    'sourceClaims', 'model', 'reviewedCaseIds', 'alternatives'];
  if (Object.keys(value).some(key => !profileFields.includes(key))) {
    return issue('unsupported-profile-field', 'profile', 'This profile cannot add unreviewed path or topology conditions.');
  }
  if ('reviewedProfileId' in value && value['reviewedProfileId'] !== value['id']) {
    return issue('profile-review-mismatch', 'profile.reviewedProfileId', 'The authored copper profile must retain its reviewed identity.');
  }
  const parameters = value['parameters'];
  if (!isRecord(parameters) || Object.keys(parameters).some(key => key !== 'maximumChannelLength' && key !== 'inclusiveMaximum')) {
    return issue('malformed-profile', 'profile.parameters', 'This reviewed profile requires its declared single-channel parameters.');
  }
  const invalidMaximum = quantityIssue(parameters['maximumChannelLength'], 'm', 'profile.parameters.maximumChannelLength');
  if (invalidMaximum) return invalidMaximum;
  if ((parameters['maximumChannelLength'] as AuthoredQuantity<'m'>).value !== 100 || parameters['inclusiveMaximum'] !== true) {
    return issue('profile-review-mismatch', 'profile.parameters', 'PROFILE-COPPER-100 declares exactly 100 m inclusive; altered limits need a separately reviewed profile.');
  }
  return null;
}

/** Exact finite decimal inputs: compare before converting readings for display. */
function decimal(value: number): { coefficient: bigint; exponent: number } {
  const [mantissa = '', rawExponent = '0'] = value.toString().split('e');
  const [integer = '', fraction = ''] = mantissa.split('.');
  return { coefficient: BigInt(integer + fraction), exponent: Number(rawExponent) - fraction.length };
}
function lengthCalculation(lengths: readonly AuthoredQuantity<'m'>[], maximum: AuthoredQuantity<'m'>) {
  const parts = lengths.map(length => decimal(length.value));
  const limit = decimal(maximum.value);
  const exponent = parts.reduce((minimum, part) => Math.min(minimum, part.exponent), limit.exponent);
  const atScale = (part: ReturnType<typeof decimal>) => part.coefficient * 10n ** BigInt(part.exponent - exponent);
  const total = parts.reduce((sum, part) => sum + atScale(part), 0n);
  const difference = atScale(limit) - total;
  return {
    total: Number(`${total}e${exponent}`),
    difference: Number(`${difference < 0n ? -difference : difference}e${exponent}`),
    withinMaximum: difference >= 0n,
  };
}

function pathValuesIssue(values: unknown, field: 'lengths' | 'requiredConductors'): ContentIssue | null {
  if (!Array.isArray(values) || values.length === 0) {
    return issue('missing-required-path', field, 'Supply the nonempty declared path facts before evaluating it.');
  }
  // for...of visits sparse holes; Array.every would silently skip malformed data.
  for (const [index, value] of values.entries()) {
    if (field === 'lengths') {
      const invalidLength = quantityIssue(value, 'm', `lengths[${index}]`);
      if (invalidLength) return invalidLength;
    } else if (typeof value !== 'boolean') {
      return issue('invalid-conductor-state', `requiredConductors[${index}]`, 'Each required conductor needs an explicit true/false continuity observation.');
    }
  }
  return null;
}

function validateChallenge(challenge: unknown): ContentIssue | null {
  if (!isRecord(challenge)) return issue('unsupported-copper-model', 'kind', 'Supply a reviewed copper predicate.');
  if (['topology', 'segments', 'segmentLengths', 'reviewedSegmentProfiles'].some(field => field in challenge)) {
    return issue('unsupported-regeneration-model', 'challenge', 'The single passive-channel profile supplies no reviewed regenerative segment limits.');
  }
  const fieldsByKind: Record<string, readonly string[]> = {
    'copper-length': ['lengths'],
    'copper-continuity': ['requiredConductors'],
    'copper-path': ['compatible', 'lengths', 'requiredConductors'],
    'copper-termination': ['chosenTerminationCompatible'],
  };
  const kind = challenge['kind'];
  if (typeof kind !== 'string' || !Object.hasOwn(fieldsByKind, kind)) {
    return issue('unsupported-copper-model', 'kind', 'Only reviewed passive-channel predicates are supported; regeneration needs its own reviewed model.');
  }
  const fields = fieldsByKind[kind]!;
  if (Object.keys(challenge).some(key => key !== 'kind' && key !== 'profile' && !fields.includes(key))) {
    return issue('unsupported-challenge-field', 'challenge', 'This scoped predicate cannot silently ignore additional path or topology conditions.');
  }
  const invalidProfile = profileIssue(challenge['profile']);
  if (invalidProfile) return invalidProfile;
  for (const field of fields) {
    if (field === 'lengths' || field === 'requiredConductors') {
      const invalidValues = pathValuesIssue(challenge[field], field);
      if (invalidValues) return invalidValues;
    } else if (typeof challenge[field] !== 'boolean') {
      return issue('missing-or-invalid-compatibility', field, 'Supply the explicit true/false compatibility fact; no compatible default is assumed.');
    }
  }
  if (fields.includes('lengths')) {
    const profile = challenge['profile'] as unknown as CopperProfile;
    if (!Number.isFinite(lengthCalculation(challenge['lengths'] as AuthoredQuantity<'m'>[], profile.parameters.maximumChannelLength).total)) {
      return issue('unrepresentable-total', 'lengths', 'The supplied path exceeds the finite numeric reading range.');
    }
  }
  return null;
}

function validateInput(input: unknown): input is CopperInput {
  return isRecord(input) && Object.keys(input).length === 1
    && ['measure-length', 'test-continuity', 'add-repeater', 'test-path', 'check-termination'].includes(input['kind'] as string);
}
function metres(value: number): EvaluatedQuantity<'m'> {
  return { value: value as Metres, unit: 'm' };
}

/**
 * Source/model/cases: T006 rule-source-review.md, PHY03/PHY04/PHY05 and T068
 * RR-O03/O04. Length/continuity retain their original narrow scope. A passive
 * path requires explicit compatibility as well; no observation establishes
 * safe power, service restoration or an objective. Termination alone is narrower.
 * The caller binds supplied current path facts to the same captured world version.
 */
export const evaluateCopper = createEvaluator<CopperChallenge, CopperInput, CopperObservation>({
  validateChallenge,
  validateInput,
  evaluate(challenge, input, world) {
    const base = {
      profileId: challenge.profile.id,
      version: { configurationRevision: world.configurationRevision, attemptId: world.attemptId },
      wholeRouteProven: false as const,
    };
    if (challenge.kind === 'copper-termination') {
      if (input.kind !== 'check-termination') return invalidInput('action-does-not-match-predicate');
      return {
        status: challenge.chosenTerminationCompatible ? 'correct' : 'incorrect',
        reasonCode: challenge.chosenTerminationCompatible ? 'compatible-termination' : 'incompatible-termination', acceptedEffects: [],
        observations: [{ ...base, kind: 'copper-termination', scope: 'termination compatibility only', compatible: challenge.chosenTerminationCompatible }],
      };
    }
    if (challenge.kind === 'copper-path') {
      if (input.kind !== 'test-path') return invalidInput('action-does-not-match-predicate');
      const observation = { ...base, kind: 'copper-path' as const, scope: 'passive copper path only' as const };
      // All authored values already passed validation. A known mismatch remains
      // an incorrect choice, and a length budget cannot override it.
      if (!challenge.compatible) return {
        status: 'incorrect', reasonCode: 'incompatible-profiles', acceptedEffects: [],
        observations: [{ ...observation, compatible: false, pathPasses: false }],
      };
      const maximum = challenge.profile.parameters.maximumChannelLength;
      const calculation = lengthCalculation(challenge.lengths, maximum);
      const openConductorIndexes = challenge.requiredConductors.flatMap((intact, index) => intact ? [] : [index]);
      const continuous = openConductorIndexes.length === 0;
      const pathPasses = calculation.withinMaximum && continuous;
      const distance = calculation.withinMaximum
        ? { headroom: metres(calculation.difference) } : { excess: metres(calculation.difference) };
      return {
        status: pathPasses ? 'correct' : 'incorrect',
        reasonCode: !continuous ? 'required-path-open' : calculation.withinMaximum ? 'passive-path-within-profile' : 'length-exceeded',
        acceptedEffects: [],
        observations: [{ ...observation, compatible: true, pathPasses, continuous, openConductorIndexes,
          total: metres(calculation.total), maximum: metres(maximum.value), ...distance }],
      };
    }
    if (challenge.kind === 'copper-length') {
      if (input.kind !== 'measure-length') return invalidInput('action-does-not-match-predicate');
      const maximum = challenge.profile.parameters.maximumChannelLength;
      const calculation = lengthCalculation(challenge.lengths, maximum);
      const observation = { ...base, kind: 'copper-length' as const, scope: 'length only' as const, total: metres(calculation.total), maximum: metres(maximum.value) };
      return calculation.withinMaximum ? {
        status: 'correct', reasonCode: 'length-within-profile', acceptedEffects: [],
        observations: [{ ...observation, headroom: metres(calculation.difference) }],
      } : {
        status: 'incorrect', reasonCode: 'length-exceeded', acceptedEffects: [],
        observations: [{ ...observation, excess: metres(calculation.difference) }],
      };
    }
    if (input.kind !== 'test-continuity' && input.kind !== 'add-repeater') return invalidInput('action-does-not-match-predicate');
    const openConductorIndexes = challenge.requiredConductors.flatMap((intact, index) => intact ? [] : [index]);
    const continuous = openConductorIndexes.length === 0;
    // A powered repeater cannot close an existing open. An intact path alone
    // supplies no reviewed regeneration design and cannot earn a success for it.
    if (input.kind === 'add-repeater' && continuous) return invalidInput('regeneration-not-evaluated');
    return {
      status: continuous ? 'correct' : 'incorrect', reasonCode: continuous ? 'continuity-established' : 'open-remains', acceptedEffects: [],
      observations: [{ ...base, kind: 'copper-continuity', scope: 'continuity only', continuous, openConductorIndexes }],
    };
  },
});
