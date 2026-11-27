// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createEvaluator, isRecord } from './evaluate';
import type { ContentIssue } from './evaluate';
import type { Watts, WorldVersion } from './types';

export interface PowerQuantity { readonly value: number; readonly unit: 'W' }
interface PowerReading { readonly value: Watts; readonly unit: 'W' }
/** Exact reviewed fictional aggregate capacity, at the delivered endpoint boundary. */
export interface PowerProfile {
  readonly id: 'spec001:PROFILE-POWER';
  readonly parameters: { readonly deliveredBudget: PowerQuantity; readonly inclusiveMaximum: true };
}
export interface PowerConstraints {
  readonly otherConstraints?: boolean;
  readonly formFactorMatch?: boolean;
  readonly phyAndMediaMatch?: boolean;
  readonly hostSupport?: boolean;
  readonly portPowerCompatible?: boolean;
  readonly perPortConstraintsMet?: boolean;
}
export type PowerChallenge = PowerConstraints & {
  readonly kind: 'delivered-power';
  readonly profile: PowerProfile;
  readonly budgetBoundary: 'delivered-after-losses';
  readonly demandBoundary: 'delivered-after-losses';
} & ({ readonly demands: readonly PowerQuantity[]; readonly totalDemand?: never }
  | { readonly totalDemand: PowerQuantity; readonly demands?: never });
export interface PowerInput { readonly kind: 'check-allocation' }
export type PowerObservation = {
  readonly kind: 'delivered-power';
  readonly profileId: PowerProfile['id'];
  readonly scope: 'delivered power allocation only';
  readonly accountingBoundary: 'delivered-after-losses';
  /** Only supplied checks are reported. Missing checks are never inferred true. */
  readonly constraints: PowerConstraints;
  readonly version: WorldVersion;
  readonly wholeRouteProven: false;
} & ({ readonly equipmentReady: false; readonly budgetCannotOverride: true }
  | { readonly total: PowerReading; readonly budget: PowerReading; readonly budgetFits: boolean }
    & ({ readonly headroom: PowerReading } | { readonly excess: PowerReading }));

const constraintKeys = ['otherConstraints', 'formFactorMatch', 'phyAndMediaMatch', 'hostSupport', 'portPowerCompatible', 'perPortConstraintsMet'] as const;
const profileFields = ['id', 'parameters', 'kind', 'sources', 'assumptions', 'limits', 'schemaVersion', 'episodeId', 'contentVersion', 'reviewedProfileId', 'ruleIds', 'sourceClaims', 'model', 'reviewedCaseIds', 'alternatives'];
function issue(code: string, field: string, message: string): ContentIssue { return { code, field, message }; }
function wattsIssue(value: unknown, field: string): ContentIssue | null {
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'value' && key !== 'unit')) return issue('malformed-quantity', field, 'Supply a value and an explicit W unit.');
  if (value['unit'] !== 'W') return issue('wrong-or-missing-unit', field, 'Delivered power and demand require W; no unit conversion is inferred.');
  if (typeof value['value'] !== 'number' || !Number.isFinite(value['value']) || value['value'] < 0) return issue('invalid-quantity-value', field, 'Power must be a finite nonnegative number of watts.');
  return null;
}
function modelValid(value: unknown): boolean {
  if (!isRecord(value) || value['label'] !== 'fictional-teaching-profile'
    || Object.keys(value).some(field => !['label', 'scope', 'assumptions', 'limitations'].includes(field))
    || typeof value['scope'] !== 'string' || !value['scope'].trim()) return false;
  for (const field of ['assumptions', 'limitations']) {
    if (!Array.isArray(value[field])) return false;
    for (const text of value[field]) if (typeof text !== 'string' || !text.trim()) return false;
  }
  return true;
}
function profileIssue(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['id'] !== 'spec001:PROFILE-POWER') return issue('unknown-authored-profile', 'profile.id', 'Supply the reviewed delivered-power profile.');
  if (Object.keys(value).some(key => !profileFields.includes(key))) return issue('unsupported-profile-field', 'profile', 'Unreviewed power rules cannot be added to this profile.');
  if (('reviewedProfileId' in value && value['reviewedProfileId'] !== value['id'])
    || ('kind' in value && value['kind'] !== 'profile' && value['kind'] !== 'fictional-teaching-profile')) return issue('profile-review-mismatch', 'profile', 'Retain the reviewed fictional power identity.');
  if ('model' in value && !modelValid(value['model'])) return issue('malformed-profile-model', 'profile.model', 'Retain the fictional teaching label and declared prose model; extra scoring rules are unsupported.');
  const parameters = value['parameters'];
  if (!isRecord(parameters) || Object.keys(parameters).some(key => key !== 'deliveredBudget' && key !== 'inclusiveMaximum')) return issue('malformed-profile', 'profile.parameters', 'Only the reviewed delivered capacity and inclusive boundary are supported.');
  const invalid = wattsIssue(parameters['deliveredBudget'], 'profile.parameters.deliveredBudget');
  if (invalid) return invalid;
  if ((parameters['deliveredBudget'] as PowerQuantity).value !== 30 || parameters['inclusiveMaximum'] !== true) return issue('profile-review-mismatch', 'profile.parameters', 'The reviewed fictional limit is exactly 30 W inclusive, after losses.');
  return null;
}

/** Decimal values use their exact finite JSON number representation, not a tolerance. */
function decimal(value: number) {
  const [mantissa = '', rawExponent = '0'] = value.toString().split('e');
  const [integer = '', fraction = ''] = mantissa.split('.');
  return { coefficient: BigInt(integer + fraction), exponent: Number(rawExponent) - fraction.length };
}
function allocation(challenge: PowerChallenge) {
  const demands = 'totalDemand' in challenge ? [challenge.totalDemand!] : challenge.demands;
  const parts = demands.map(demand => decimal(demand.value));
  const budget = decimal(challenge.profile.parameters.deliveredBudget.value);
  const exponent = parts.reduce((minimum, part) => Math.min(minimum, part.exponent), budget.exponent);
  const atScale = (part: ReturnType<typeof decimal>) => part.coefficient * 10n ** BigInt(part.exponent - exponent);
  const total = parts.reduce((sum, part) => sum + atScale(part), 0n);
  const difference = atScale(budget) - total;
  return {
    total: Number(`${total}e${exponent}`),
    difference: Number(`${difference < 0n ? -difference : difference}e${exponent}`),
    fits: difference >= 0n,
  };
}
function validateChallenge(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['kind'] !== 'delivered-power') return issue('unsupported-power-model', 'kind', 'Supply a reviewed delivered-power allocation.');
  const fields: readonly string[] = ['kind', 'profile', 'budgetBoundary', 'demandBoundary', 'demands', 'totalDemand', ...constraintKeys];
  if (Object.keys(value).some(key => !fields.includes(key))) return issue('unsupported-challenge-field', 'challenge', 'No source-output conversion, hidden losses, or additional power model is supported.');
  const invalidProfile = profileIssue(value['profile']);
  if (invalidProfile) return invalidProfile;
  if (value['budgetBoundary'] !== 'delivered-after-losses' || value['demandBoundary'] !== 'delivered-after-losses') return issue('incomparable-power-boundaries', 'accountingBoundary', 'Budget and every demand must explicitly use delivered power after losses.');
  if (('demands' in value) === ('totalDemand' in value)) return issue('ambiguous-power-demand', 'demands', 'Supply either individual demands or an explicit total demand, never both.');
  if ('demands' in value) {
    if (!Array.isArray(value['demands']) || !value['demands'].length) return issue('missing-power-demands', 'demands', 'Supply nonempty explicit endpoint demands.');
    // entries visits sparse holes; every/map alone would ignore missing elements.
    for (const [index, demand] of value['demands'].entries()) {
      const invalid = wattsIssue(demand, `demands[${index}]`); if (invalid) return invalid;
    }
  } else {
    const invalid = wattsIssue(value['totalDemand'], 'totalDemand'); if (invalid) return invalid;
  }
  for (const key of constraintKeys) if (key in value && typeof value[key] !== 'boolean') return issue('malformed-power-constraint', key, 'A supplied compatibility or per-port fact must be explicitly true or false.');
  if (value['otherConstraints'] === true && constraintKeys.some(key => key !== 'otherConstraints' && value[key] === false)) return issue('contradictory-power-constraints', 'otherConstraints', 'All other constraints cannot be satisfied while an explicit required constraint fails.');
  const calculated = allocation(value as unknown as PowerChallenge);
  if (!Number.isFinite(calculated.total) || !Number.isFinite(calculated.difference)) return issue('unrepresentable-power-total', 'demands', 'Authored totals and differences must remain representable finite watt readings.');
  return null;
}
const failedReasons: Record<keyof PowerConstraints, string> = {
  otherConstraints: 'other-power-constraint-fails', formFactorMatch: 'form-factor-mismatch',
  phyAndMediaMatch: 'physical-profile-mismatch', hostSupport: 'unsupported-host',
  portPowerCompatible: 'incompatible-port', perPortConstraintsMet: 'per-port-constraint-fails',
};
const reading = (value: number): PowerReading => ({ value: value as Watts, unit: 'W' });

/** Pure scoped predicate; objective, equipment completeness and service proof belong elsewhere. */
export const evaluatePower = createEvaluator<PowerChallenge, PowerInput, PowerObservation>({
  validateChallenge,
  validateInput: (input): input is PowerInput => isRecord(input) && input['kind'] === 'check-allocation' && Object.keys(input).length === 1,
  evaluate: (challenge, _input, world) => {
    const constraints: PowerConstraints = Object.fromEntries(constraintKeys.filter(key => key in challenge).map(key => [key, challenge[key]]));
    const base = { kind: 'delivered-power' as const, profileId: challenge.profile.id, scope: 'delivered power allocation only' as const, accountingBoundary: 'delivered-after-losses' as const, constraints,
      version: { configurationRevision: world.configurationRevision, attemptId: world.attemptId }, wholeRouteProven: false as const };
    const failed = constraintKeys.find(key => constraints[key] === false);
    if (failed) return { status: 'incorrect', reasonCode: failedReasons[failed], acceptedEffects: [], observations: [{ ...base, equipmentReady: false, budgetCannotOverride: true }] };
    const result = allocation(challenge);
    return {
      status: result.fits ? 'correct' : 'incorrect', reasonCode: result.fits ? 'delivered-power-within-budget' : 'delivered-power-budget-exceeded', acceptedEffects: [],
      observations: [{ ...base, total: reading(result.total), budget: reading(challenge.profile.parameters.deliveredBudget.value), budgetFits: result.fits,
        ...(result.fits ? { headroom: reading(result.difference) } : { excess: reading(result.difference) }) }],
    };
  },
});
