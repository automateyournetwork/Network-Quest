// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createEvaluator, invalidInput, isRecord, quantityIssue } from './evaluate';
import type { ContentIssue } from './evaluate';
import type { Quantity, WorldVersion } from './types';

/** Levels are signed dBm; passive loss and required reserve are nonnegative dB. */
export interface OpticalQuantity<U extends 'dBm' | 'dB'> { readonly value: number; readonly unit: U }
export interface OpticalReading<U extends 'dBm' | 'dB'> { readonly value: Quantity<U>; readonly unit: U }
interface ReceiverRange {
  readonly sensitivity: OpticalQuantity<'dBm'>;
  readonly maximumReceive: OpticalQuantity<'dBm'>;
  readonly requiredMargin: OpticalQuantity<'dB'>;
  readonly inclusiveBounds: true;
}
/** Projection from the validated T069 profile; altered thresholds need review. */
export interface OpticalProfile {
  readonly id: 'spec001:PROFILE-OPTICAL';
  readonly parameters: ReceiverRange & { readonly transmit: OpticalQuantity<'dBm'> };
}
export interface OpticalCompatibilityChecks {
  readonly mediaMatch: boolean;
  readonly wavelengthDirectionMatch: boolean;
  readonly rateMatch: boolean;
  readonly connectorPolarityMatch: boolean;
  readonly hostSupport: boolean;
}
export type OpticalChallenge = {
  readonly kind: 'optical-compatibility';
  /** The caller has resolved supported profiles; an unknown author profile is an error. */
  readonly knownProfiles: true;
  readonly compatible: boolean;
} | {
  readonly kind: 'optical-inspection';
  /** A supplied aggregate premise; this scope cannot establish a full repair. */
  readonly everyRequiredCompatibilityCheck: boolean;
  readonly requiredInspectionComplete: boolean;
} | {
  readonly kind: 'optical-preparation';
  readonly profile: OpticalProfile;
  readonly checks: OpticalCompatibilityChecks;
  readonly inspectedBeforeChange: boolean;
  readonly connectionDefectRemoved: boolean;
} | {
  readonly kind: 'optical-passive';
  readonly profile: OpticalProfile;
  readonly compatible: boolean;
  readonly loss: OpticalQuantity<'dB'>;
  /** Optional assertion in the same passive model, never an independent observation. */
  readonly authoredReceive?: OpticalQuantity<'dBm'>;
} | ({
  readonly kind: 'optical-receive-range';
  readonly compatible: boolean;
  readonly receive: OpticalQuantity<'dBm'>;
} & ReceiverRange) | {
  readonly kind: 'optical-overload';
  readonly compatible: boolean;
  readonly receive: OpticalQuantity<'dBm'>;
  readonly maximumReceive: OpticalQuantity<'dBm'>;
};
export interface OpticalInput {
  readonly kind: 'check-compatibility' | 'check-inspection' | 'verify-preparation' | 'measure-optics';
}
interface ObservationBase {
  readonly version: WorldVersion;
  readonly ruleId: 'spec001:PHY03' | 'spec001:PHY06';
  readonly profileId?: OpticalProfile['id'];
  readonly fictionalTeachingModel: true;
  readonly wholeRouteProven: false;
  readonly serviceProven: false;
}
export type OpticalObservation = ObservationBase & ({
  readonly kind: 'optical-compatibility';
  readonly scope: 'profile compatibility only';
  readonly compatible: boolean;
  readonly powerBudgetProven: false;
  readonly reason: string;
  readonly usableLink?: false;
  readonly arithmeticCannotOverride?: true;
} | {
  readonly kind: 'optical-inspection' | 'optical-preparation';
  readonly scope: 'preparation inspection only' | 'inspected connection intervention only';
  readonly preparationComplete: boolean;
  readonly inspectionComplete: boolean;
  readonly powerBudgetProven: false;
  readonly reason: string;
} | {
  readonly kind: 'optical-power';
  readonly scope: 'passive optical receive range and reserve only' | 'observed optical receive range and reserve only';
  readonly receive: OpticalReading<'dBm'>;
  readonly sensitivity: OpticalReading<'dBm'>;
  readonly maximumReceive: OpticalReading<'dBm'>;
  readonly requiredMargin: OpticalReading<'dB'>;
  readonly margin: OpticalReading<'dB'>;
  readonly sensitivityMet: boolean;
  readonly reserveMet: boolean;
  readonly overload: boolean;
  readonly excess?: OpticalReading<'dB'>;
} | {
  readonly kind: 'optical-overload';
  readonly scope: 'observed optical overload only';
  readonly receive: OpticalReading<'dBm'>;
  readonly maximumReceive: OpticalReading<'dBm'>;
  readonly overload: boolean;
  readonly excess?: OpticalReading<'dB'>;
});

const checkFields = ['mediaMatch', 'wavelengthDirectionMatch', 'rateMatch', 'connectorPolarityMatch', 'hostSupport'] as const;
const rangeFields = ['sensitivity', 'maximumReceive', 'requiredMargin', 'inclusiveBounds'] as const;
function issue(code: string, field: string, message: string): ContentIssue { return { code, field, message }; }
function fieldsIssue(record: Record<string, unknown>, allowed: readonly string[], field: string): ContentIssue | null {
  return Object.keys(record).some(key => !allowed.includes(key))
    ? issue('unsupported-authored-field', field, 'This scoped optical predicate cannot ignore additional model conditions or metadata.') : null;
}
function booleanIssue(value: unknown, field: string): ContentIssue | null {
  return typeof value === 'boolean' ? null : issue('missing-or-invalid-premise', field, `${field} requires an explicit true/false supplied observation.`);
}
function levelIssue(value: unknown, field: string): ContentIssue | null {
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'value' && key !== 'unit')) {
    return issue('malformed-quantity', field, `Supply ${field} as a level with its dBm unit.`);
  }
  if (value['unit'] !== 'dBm') return issue('wrong-or-missing-unit', field, `${field} requires dBm; power levels and dB differences cannot be interchanged.`);
  if (typeof value['value'] !== 'number' || !Number.isFinite(value['value'])) {
    return issue('invalid-quantity-value', field, `${field} must be a finite signed number in dBm.`);
  }
  return null;
}
function receiverIssue(record: Record<string, unknown>, field: string, overloadOnly = false): ContentIssue | null {
  const maximumIssue = levelIssue(record['maximumReceive'], `${field}.maximumReceive`);
  if (maximumIssue) return maximumIssue;
  if (!overloadOnly) {
    const sensitivityIssue = levelIssue(record['sensitivity'], `${field}.sensitivity`);
    if (sensitivityIssue) return sensitivityIssue;
    const marginIssue = quantityIssue(record['requiredMargin'], 'dB', `${field}.requiredMargin`);
    if (marginIssue) return marginIssue;
    if ((record['sensitivity'] as OpticalQuantity<'dBm'>).value !== -14
      || (record['requiredMargin'] as OpticalQuantity<'dB'>).value !== 2 || record['inclusiveBounds'] !== true) {
      return issue('profile-review-mismatch', field, 'This reviewed receiver declares -14 dBm sensitivity, 2 dB reserve and inclusive bounds; altered values require independent review.');
    }
  }
  if ((record['maximumReceive'] as OpticalQuantity<'dBm'>).value !== -1) {
    return issue('profile-review-mismatch', `${field}.maximumReceive`, 'This reviewed receiver maximum is exactly -1 dBm inclusive; altered limits require independent review.');
  }
  return null;
}
function profileIssue(value: unknown): ContentIssue | null {
  if (!isRecord(value) || value['id'] !== 'spec001:PROFILE-OPTICAL') {
    return issue('unknown-authored-profile', 'profile.id', 'Select the reviewed optical teaching profile; no hardware or threshold defaults are inferred.');
  }
  const extra = fieldsIssue(value, ['id', 'parameters'], 'profile');
  if (extra) return extra;
  const parameters = value['parameters'];
  if (!isRecord(parameters)) return issue('malformed-profile', 'profile.parameters', 'Supply the reviewed optical profile parameters.');
  const parameterIssue = fieldsIssue(parameters, ['transmit', ...rangeFields], 'profile.parameters');
  if (parameterIssue) return parameterIssue;
  const transmitIssue = levelIssue(parameters['transmit'], 'profile.parameters.transmit');
  if (transmitIssue) return transmitIssue;
  if ((parameters['transmit'] as OpticalQuantity<'dBm'>).value !== -3) {
    return issue('profile-review-mismatch', 'profile.parameters.transmit', 'PROFILE-OPTICAL declares exactly -3 dBm transmit; altered levels need an independently reviewed profile.');
  }
  return receiverIssue(parameters, 'profile.parameters');
}

/** Use decimal spellings of finite authored numbers, with no epsilon or display rounding. */
interface Decimal { readonly coefficient: bigint; readonly exponent: number }
function decimal(value: number): Decimal {
  const [mantissa = '', rawExponent = '0'] = value.toString().split('e');
  const [integer = '', fraction = ''] = mantissa.split('.');
  return { coefficient: BigInt(integer + fraction), exponent: Number(rawExponent) - fraction.length };
}
function subtract(left: Decimal, right: Decimal): Decimal {
  const exponent = Math.min(left.exponent, right.exponent);
  return { coefficient: left.coefficient * 10n ** BigInt(left.exponent - exponent)
    - right.coefficient * 10n ** BigInt(right.exponent - exponent), exponent };
}
function number(value: Decimal): number { return Number(`${value.coefficient}e${value.exponent}`); }
function reading<U extends 'dBm' | 'dB'>(value: number, unit: U): OpticalReading<U> {
  return { value: value as Quantity<U>, unit };
}
function passiveReceive(challenge: Extract<OpticalChallenge, { kind: 'optical-passive' }>): Decimal {
  return subtract(decimal(challenge.profile.parameters.transmit.value), decimal(challenge.loss.value));
}
function validateChallenge(challenge: unknown): ContentIssue | null {
  if (!isRecord(challenge)) return issue('malformed-optical-challenge', 'challenge', 'Supply a reviewed scoped optical challenge.');
  const kind = challenge['kind'];
  const allowed: Record<string, readonly string[]> = {
    'optical-compatibility': ['knownProfiles', 'compatible'],
    'optical-inspection': ['everyRequiredCompatibilityCheck', 'requiredInspectionComplete'],
    'optical-preparation': ['profile', 'checks', 'inspectedBeforeChange', 'connectionDefectRemoved'],
    'optical-passive': ['profile', 'compatible', 'loss', 'authoredReceive'],
    'optical-receive-range': ['compatible', 'receive', ...rangeFields],
    'optical-overload': ['compatible', 'receive', 'maximumReceive'],
  };
  if (typeof kind !== 'string' || !Object.hasOwn(allowed, kind)) {
    return issue('unsupported-optical-model', 'kind', 'Only reviewed passive optics, supplied receive observations and explicit preparation predicates are supported.');
  }
  const extra = fieldsIssue(challenge, ['kind', ...allowed[kind]!], 'challenge');
  if (extra) return extra;
  if (kind === 'optical-compatibility') {
    if (challenge['knownProfiles'] !== true) return issue('unknown-authored-profile', 'knownProfiles', 'Compatibility requires known supported authored profiles.');
    return booleanIssue(challenge['compatible'], 'compatible');
  }
  if (kind === 'optical-inspection') {
    return booleanIssue(challenge['everyRequiredCompatibilityCheck'], 'everyRequiredCompatibilityCheck')
      ?? booleanIssue(challenge['requiredInspectionComplete'], 'requiredInspectionComplete');
  }
  if (kind === 'optical-preparation' || kind === 'optical-passive') {
    const invalidProfile = profileIssue(challenge['profile']);
    if (invalidProfile) return invalidProfile;
  }
  if (kind === 'optical-preparation') {
    const checks = challenge['checks'];
    if (!isRecord(checks)) return issue('missing-compatibility-checks', 'checks', 'Supply all five reviewed compatibility premises.');
    const extraCheck = fieldsIssue(checks, checkFields, 'checks');
    if (extraCheck) return extraCheck;
    for (const field of checkFields) {
      const invalid = booleanIssue(checks[field], `checks.${field}`);
      if (invalid) return invalid;
    }
    return booleanIssue(challenge['inspectedBeforeChange'], 'inspectedBeforeChange')
      ?? booleanIssue(challenge['connectionDefectRemoved'], 'connectionDefectRemoved');
  }
  const invalidCompatibility = booleanIssue(challenge['compatible'], 'compatible');
  if (invalidCompatibility) return invalidCompatibility;
  if (kind === 'optical-passive') {
    const lossIssue = quantityIssue(challenge['loss'], 'dB', 'loss');
    if (lossIssue) return lossIssue;
    const receive = passiveReceive(challenge as unknown as Extract<OpticalChallenge, { kind: 'optical-passive' }>);
    if (!Number.isFinite(number(receive))) return issue('unrepresentable-reading', 'loss', 'The supplied passive calculation exceeds the finite reading range.');
    if (Object.hasOwn(challenge, 'authoredReceive')) {
      const assertedIssue = levelIssue(challenge['authoredReceive'], 'authoredReceive');
      if (assertedIssue) return assertedIssue;
      if (subtract(receive, decimal((challenge['authoredReceive'] as OpticalQuantity<'dBm'>).value)).coefficient !== 0n) {
        return issue('inconsistent-passive-model', 'authoredReceive', 'The authored receive level contradicts transmit minus passive loss; an independent observation needs its own receive-only challenge.');
      }
    }
    return null;
  }
  return levelIssue(challenge['receive'], 'receive') ?? receiverIssue(challenge, 'receiver', kind === 'optical-overload');
}
function validateInput(input: unknown): input is OpticalInput {
  return isRecord(input) && Object.keys(input).length === 1
    && ['check-compatibility', 'check-inspection', 'verify-preparation', 'measure-optics'].includes(input['kind'] as string);
}

/**
 * T006/S06/S07, T014 and T068 are the independent authority. No DOM, objective
 * awards or persistence. Captures describe supplied current facts; submission of
 * stored measurements still requires T074's separate freshness validation.
 */
export const evaluateOptics = createEvaluator<OpticalChallenge, OpticalInput, OpticalObservation>({
  validateChallenge,
  validateInput,
  evaluate(challenge, input, world) {
    const expectedAction = challenge.kind === 'optical-compatibility' ? 'check-compatibility'
      : challenge.kind === 'optical-inspection' ? 'check-inspection'
        : challenge.kind === 'optical-preparation' ? 'verify-preparation' : 'measure-optics';
    if (input.kind !== expectedAction) return invalidInput('action-does-not-match-predicate');
    const base: ObservationBase = {
      version: { configurationRevision: world.configurationRevision, attemptId: world.attemptId },
      ruleId: challenge.kind === 'optical-compatibility' || challenge.kind === 'optical-inspection' || challenge.kind === 'optical-preparation'
        ? 'spec001:PHY03' : 'spec001:PHY06',
      ...('profile' in challenge ? { profileId: challenge.profile.id } : {}),
      fictionalTeachingModel: true, wholeRouteProven: false, serviceProven: false,
    };
    if (challenge.kind === 'optical-preparation' || challenge.kind === 'optical-inspection') {
      const detailed = challenge.kind === 'optical-preparation';
      const compatible = detailed ? checkFields.every(field => challenge.checks[field]) : challenge.everyRequiredCompatibilityCheck;
      const inspected = detailed ? challenge.inspectedBeforeChange : challenge.requiredInspectionComplete;
      const defectRemoved = !detailed || challenge.connectionDefectRemoved;
      const reason = !compatible ? 'incompatible-profiles' : !inspected ? 'inspect-before-changing'
        : !defectRemoved ? 'connection-defect-remains' : detailed ? 'inspected-connection-prepared' : 'required-inspection-complete';
      const complete = compatible && inspected && defectRemoved;
      return { status: complete ? 'correct' : 'incorrect', reasonCode: reason, acceptedEffects: [], observations: [{
        ...base, kind: challenge.kind, scope: detailed ? 'inspected connection intervention only' : 'preparation inspection only',
        // The summary checks inspection only. It cannot establish intervention.
        preparationComplete: detailed && complete, inspectionComplete: inspected, powerBudgetProven: false, reason,
      }] };
    }
    if (!challenge.compatible || challenge.kind === 'optical-compatibility') {
      const compatible = challenge.compatible;
      const reason = compatible ? 'profiles-compatible' : 'incompatible-profiles';
      return { status: compatible ? 'correct' : 'incorrect', reasonCode: reason, acceptedEffects: [], observations: [{
        ...base, kind: 'optical-compatibility', scope: 'profile compatibility only', compatible, reason, powerBudgetProven: false,
        ...(!compatible ? { usableLink: false as const, arithmeticCannotOverride: true as const } : {}),
      }] };
    }
    const receiver = challenge.kind === 'optical-passive' ? challenge.profile.parameters : challenge;
    const receive = challenge.kind === 'optical-passive' ? passiveReceive(challenge) : decimal(challenge.receive.value);
    const excess = subtract(receive, decimal(receiver.maximumReceive.value));
    const overload = excess.coefficient > 0n;
    const upperBound = { receive: reading(number(receive), 'dBm'), maximumReceive: reading(receiver.maximumReceive.value, 'dBm'),
      overload, ...(overload ? { excess: reading(number(excess), 'dB') } : {}) };
    if (challenge.kind === 'optical-overload') {
      return { status: overload ? 'incorrect' : 'correct', reasonCode: overload ? 'receiver-overload' : 'receive-at-or-below-maximum', acceptedEffects: [],
        observations: [{ ...base, kind: 'optical-overload', scope: 'observed optical overload only', ...upperBound }] };
    }
    const range: ReceiverRange = challenge.kind === 'optical-passive' ? challenge.profile.parameters : challenge;
    const margin = subtract(receive, decimal(range.sensitivity.value));
    const sensitivityMet = margin.coefficient >= 0n;
    const reserveMet = subtract(margin, decimal(range.requiredMargin.value)).coefficient >= 0n;
    const passed = sensitivityMet && reserveMet && !overload;
    return { status: passed ? 'correct' : 'incorrect', reasonCode: overload ? 'receiver-overload'
      : !sensitivityMet ? 'below-receiver-sensitivity' : !reserveMet ? 'required-reserve-not-met' : 'optical-power-checks-pass', acceptedEffects: [],
    observations: [{ ...base, kind: 'optical-power',
      scope: challenge.kind === 'optical-passive' ? 'passive optical receive range and reserve only' : 'observed optical receive range and reserve only',
      ...upperBound, sensitivity: reading(range.sensitivity.value, 'dBm'), requiredMargin: reading(range.requiredMargin.value, 'dB'),
      margin: reading(number(margin), 'dB'), sensitivityMet, reserveMet,
    }] };
  },
});
