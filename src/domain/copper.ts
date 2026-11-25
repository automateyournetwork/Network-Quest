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
};
export interface CopperInput {
  readonly kind: 'measure-length' | 'test-continuity' | 'add-repeater';
}
interface CopperObservationBase {
  readonly profileId: CopperProfile['id'];
  readonly version: WorldVersion;
  readonly wholeRouteProven: false;
}
export type CopperObservation = CopperObservationBase & ({
  readonly kind: 'copper-length';
  readonly scope: 'length only';
  readonly total: EvaluatedQuantity<'m'>;
  readonly maximum: EvaluatedQuantity<'m'>;
} & ({ readonly headroom: EvaluatedQuantity<'m'> } | { readonly excess: EvaluatedQuantity<'m'> }) | {
  readonly kind: 'copper-continuity';
  readonly scope: 'continuity only';
  readonly continuous: boolean;
  readonly openConductorIndexes: readonly number[];
});

function issue(code: string, field: string, message: string): ContentIssue {
  return { code, field, message };
}

function profileIssue(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['id'] !== 'spec001:PROFILE-COPPER-100') {
    return issue('unknown-authored-profile', 'profile.id', 'Select a reviewed supported copper profile; no default length limit is assumed.');
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

function validateChallenge(challenge: unknown): ContentIssue | null {
  if (!isRecord(challenge) || !['copper-length', 'copper-continuity'].includes(challenge['kind'] as string)) {
    return issue('unsupported-copper-model', 'kind', 'Only reviewed single-channel length and continuity predicates are supported; regeneration needs its own reviewed model.');
  }
  const allowed = challenge['kind'] === 'copper-length' ? 'lengths' : 'requiredConductors';
  if (Object.keys(challenge).some(key => key !== 'kind' && key !== 'profile' && key !== allowed)) {
    return issue('unsupported-challenge-field', 'challenge', 'This scoped predicate cannot silently ignore additional path or topology conditions.');
  }
  const invalidProfile = profileIssue(challenge['profile']);
  if (invalidProfile) return invalidProfile;
  const values = challenge[allowed];
  if (!Array.isArray(values) || values.length === 0) {
    return issue('missing-required-path', allowed, 'Supply the nonempty declared path facts before evaluating it.');
  }
  // for...of visits sparse holes; Array.every would silently skip malformed data.
  for (const [index, value] of values.entries()) {
    if (allowed === 'lengths') {
      const invalidLength = quantityIssue(value, 'm', `lengths[${index}]`);
      if (invalidLength) return invalidLength;
    } else if (typeof value !== 'boolean') {
      return issue('invalid-conductor-state', `requiredConductors[${index}]`, 'Each required conductor needs an explicit true/false continuity observation.');
    }
  }
  if (challenge['kind'] === 'copper-length') {
    const profile = challenge['profile'] as unknown as CopperProfile;
    if (!Number.isFinite(lengthCalculation(values as AuthoredQuantity<'m'>[], profile.parameters.maximumChannelLength).total)) {
      return issue('unrepresentable-total', 'lengths', 'The supplied path exceeds the finite numeric reading range.');
    }
  }
  return null;
}

function validateInput(input: unknown): input is CopperInput {
  return isRecord(input) && Object.keys(input).length === 1
    && ['measure-length', 'test-continuity', 'add-repeater'].includes(input['kind'] as string);
}
function metres(value: number): EvaluatedQuantity<'m'> {
  return { value: value as Metres, unit: 'm' };
}

/**
 * Source/model/cases: T006 rule-source-review.md, PHY04/PHY05. These observations
 * do not establish compatibility, safe power, service restoration or an objective.
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
    if (input.kind === 'measure-length') return invalidInput('action-does-not-match-predicate');
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
