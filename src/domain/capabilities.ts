// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createEvaluator, isRecord } from './evaluate';
import type { ContentIssue } from './evaluate';
import type { MegabitsPerSecond, WorldVersion } from './types';

/** Mb/s is the exact reviewed source spelling of runtime Mbps, not a conversion factor. */
export interface AdvertisedCapability {
  readonly rate: { readonly value: number; readonly unit: 'Mb/s' | 'Mbps' };
  readonly duplex: 'full' | 'half';
}
export interface CapabilityReading {
  readonly rate: { readonly value: MegabitsPerSecond; readonly unit: 'Mbps' };
  readonly duplex: 'full' | 'half';
}
export interface CapabilitiesProfile {
  readonly id: 'spec001:PROFILE-CAPABILITIES';
  readonly parameters: { readonly endpointA: readonly AdvertisedCapability[]; readonly endpointB: readonly AdvertisedCapability[] };
}
export type CapabilitiesChallenge = {
  readonly kind: 'common-capabilities';
  readonly profile: CapabilitiesProfile;
  readonly bothNegotiate: true;
} & ({ readonly endpointA?: never; readonly endpointB?: never }
  | { readonly endpointA: readonly AdvertisedCapability[]; readonly endpointB: readonly AdvertisedCapability[] });
export type CapabilitiesInput = { readonly kind: 'inspect-common' }
  | { readonly kind: 'select-capability'; readonly selected: AdvertisedCapability };
export type CapabilitiesObservation = {
  readonly kind: 'common-capabilities';
  readonly profileId: CapabilitiesProfile['id'];
  readonly scope: 'common advertised capabilities only';
  readonly common: readonly CapabilityReading[];
  readonly version: WorldVersion;
  readonly wholeRouteProven: false;
} & ({ readonly selected?: never; readonly supportedByA?: never; readonly supportedByB?: never }
  | { readonly selected: CapabilityReading; readonly supportedByA: boolean; readonly supportedByB: boolean });

const profileFields = ['id', 'parameters', 'kind', 'sources', 'assumptions', 'limits', 'schemaVersion', 'episodeId', 'contentVersion', 'reviewedProfileId', 'ruleIds', 'sourceClaims', 'model', 'reviewedCaseIds', 'alternatives'];
const reviewedA = ['1000/full', '100/full'];
const reviewedB = ['100/full', '10/half'];
function issue(code: string, field: string, message: string): ContentIssue { return { code, field, message }; }
function capabilityValid(value: unknown): value is AdvertisedCapability {
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'rate' && key !== 'duplex') || !isRecord(value['rate'])) return false;
  const rate = value['rate'];
  return Object.keys(rate).every(key => key === 'value' || key === 'unit')
    && (rate['unit'] === 'Mb/s' || rate['unit'] === 'Mbps')
    && typeof rate['value'] === 'number' && Number.isFinite(rate['value']) && rate['value'] > 0
    && (value['duplex'] === 'full' || value['duplex'] === 'half');
}
function key(value: AdvertisedCapability) { return `${value.rate.value}/${value.duplex}`; }
function advertisementIssue(value: unknown, field: string, permitted: readonly string[], exact: boolean): ContentIssue | null {
  if (!Array.isArray(value) || !value.length) return issue('missing-advertised-capabilities', field, 'Supply the nonempty reviewed advertised set.');
  const seen = new Set<string>();
  for (const [index, capability] of value.entries()) {
    if (!capabilityValid(capability)) return issue('malformed-advertised-capability', `${field}[${index}]`, 'Supply finite positive rate in Mb/s or Mbps with explicit full/half duplex.');
    const identity = key(capability);
    if (seen.has(identity)) return issue('duplicate-advertised-capability', field, 'Each advertised mode must appear once, including across equivalent unit labels.');
    if (!permitted.includes(identity)) return issue('unreviewed-advertised-capability', field, 'This endpoint cannot acquire support outside its reviewed advertisements.');
    seen.add(identity);
  }
  if (exact && seen.size !== permitted.length) return issue('profile-review-mismatch', field, 'The profile must preserve its complete reviewed endpoint advertisements.');
  return null;
}
function modelValid(value: unknown): boolean {
  if (!isRecord(value) || value['label'] !== 'toy-negotiation'
    || Object.keys(value).some(field => !['label', 'scope', 'assumptions', 'limitations'].includes(field))
    || typeof value['scope'] !== 'string' || !value['scope'].trim()) return false;
  for (const field of ['assumptions', 'limitations']) {
    if (!Array.isArray(value[field])) return false;
    for (const text of value[field]) if (typeof text !== 'string' || !text.trim()) return false;
  }
  return true;
}
function profileIssue(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['id'] !== 'spec001:PROFILE-CAPABILITIES') return issue('unknown-authored-profile', 'profile.id', 'Supply the reviewed toy negotiation profile.');
  if (Object.keys(value).some(field => !profileFields.includes(field))) return issue('unsupported-profile-field', 'profile', 'Unreviewed negotiation, ranking or fallback rules cannot be added.');
  if (('reviewedProfileId' in value && value['reviewedProfileId'] !== value['id'])
    || ('kind' in value && value['kind'] !== 'profile' && value['kind'] !== 'toy-negotiation')) return issue('profile-review-mismatch', 'profile', 'Retain the reviewed toy negotiation identity.');
  if ('model' in value && !modelValid(value['model'])) return issue('malformed-profile-model', 'profile.model', 'Retain the toy label and declared prose model; extra negotiation rules are unsupported.');
  const parameters = value['parameters'];
  if (!isRecord(parameters) || Object.keys(parameters).some(field => field !== 'endpointA' && field !== 'endpointB')) return issue('malformed-profile', 'profile.parameters', 'The toy model supplies only the two reviewed endpoint sets.');
  return advertisementIssue(parameters['endpointA'], 'profile.parameters.endpointA', reviewedA, true)
    ?? advertisementIssue(parameters['endpointB'], 'profile.parameters.endpointB', reviewedB, true);
}
function validateChallenge(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['kind'] !== 'common-capabilities') return issue('unsupported-capability-model', 'kind', 'Supply a reviewed common advertised capability challenge.');
  if (Object.keys(value).some(field => !['kind', 'profile', 'bothNegotiate', 'endpointA', 'endpointB'].includes(field))) return issue('unsupported-challenge-field', 'challenge', 'This model does not supply forced modes, ranking or fallback behavior.');
  const invalidProfile = profileIssue(value['profile']); if (invalidProfile) return invalidProfile;
  if (value['bothNegotiate'] !== true) return issue('unsupported-negotiation-model', 'bothNegotiate', 'Both endpoints must explicitly negotiate; forced or unspecified modes are not supported.');
  if (('endpointA' in value) !== ('endpointB' in value)) return issue('incomplete-advertised-sets', 'endpoints', 'Supply both current endpoint sets, or use the complete reviewed profile.');
  if ('endpointA' in value) return advertisementIssue(value['endpointA'], 'endpointA', reviewedA, false)
    ?? advertisementIssue(value['endpointB'], 'endpointB', reviewedB, false);
  return null;
}
function reading(value: AdvertisedCapability): CapabilityReading { return { rate: { value: value.rate.value as MegabitsPerSecond, unit: 'Mbps' }, duplex: value.duplex }; }

/** No ranking, speed negotiation simulation, device effects or objective awards. */
export const evaluateCapabilities = createEvaluator<CapabilitiesChallenge, CapabilitiesInput, CapabilitiesObservation>({
  validateChallenge,
  validateInput: (input): input is CapabilitiesInput => isRecord(input)
    && (input['kind'] === 'inspect-common' ? Object.keys(input).length === 1
      : input['kind'] === 'select-capability' && Object.keys(input).every(field => field === 'kind' || field === 'selected') && capabilityValid(input['selected'])),
  evaluate: (challenge, input, world) => {
    const endpointA = challenge.endpointA ?? challenge.profile.parameters.endpointA;
    const endpointB = challenge.endpointB ?? challenge.profile.parameters.endpointB;
    const common = endpointA.filter(mode => endpointB.some(other => key(mode) === key(other))).map(reading);
    const base = { kind: 'common-capabilities' as const, profileId: challenge.profile.id, scope: 'common advertised capabilities only' as const, common,
      version: { configurationRevision: world.configurationRevision, attemptId: world.attemptId }, wholeRouteProven: false as const };
    if (input.kind === 'inspect-common') return { status: common.length ? 'correct' : 'incorrect', reasonCode: common.length ? 'common-mode-available' : 'no-common-mode', acceptedEffects: [], observations: [base] };
    const supportedByA = endpointA.some(mode => key(mode) === key(input.selected));
    const supportedByB = endpointB.some(mode => key(mode) === key(input.selected));
    const supported = supportedByA && supportedByB;
    const reasonCode = supported ? 'common-mode-selected' : !common.length ? 'no-common-mode'
      : !supportedByA && !supportedByB ? 'unsupported-by-both' : !supportedByA ? 'unsupported-by-A' : 'unsupported-by-B';
    return { status: supported ? 'correct' : 'incorrect', reasonCode, acceptedEffects: [], observations: [{ ...base, selected: reading(input.selected), supportedByA, supportedByB }] };
  },
});
