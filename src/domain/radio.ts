// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createEvaluator, invalidInput, isRecord, quantityIssue } from './evaluate';
import type { AuthoredQuantity, ContentIssue, EvaluatedQuantity } from './evaluate';
import type { DecibelMilliwatts, Decibels, WorldVersion } from './types';

/** Comparable received power levels; dBm may be negative, zero or positive. */
export interface RadioPower {
  readonly value: number;
  readonly unit: 'dBm';
}
interface RadioPowerReading {
  readonly value: DecibelMilliwatts;
  readonly unit: 'dBm';
}

/** Projection of T006/T069's fictional profile, not a universal wireless limit. */
export interface RadioProfile {
  readonly id: 'spec001:PROFILE-RADIO';
  readonly parameters: {
    readonly requiredSNR: AuthoredQuantity<'dB'>;
    readonly inclusiveMinimum: true;
  };
}

/**
 * Each discriminant preserves the scope of its supplied evidence. The narrow
 * settings case cannot invent a viable path; preparation cannot invent SNR.
 * A channel is an authored scenario choice whose facts the caller supplies,
 * never a number from which this evaluator infers quality or compatibility.
 */
export type RadioChallenge = {
  readonly kind: 'radio-settings';
  readonly profile: RadioProfile;
  readonly settingsCompatible: boolean;
} | {
  readonly kind: 'radio-path';
  readonly profile: RadioProfile;
  readonly viablePath: boolean;
  readonly settingsCompatible: boolean;
} | {
  readonly kind: 'radio-snr';
  readonly profile: RadioProfile;
  readonly signal: RadioPower;
  readonly noise: RadioPower;
  /** T08/T09 explicitly supply the combined, independently satisfied checks. */
  readonly otherPathChecks: boolean;
} | {
  readonly kind: 'radio-link';
  readonly profile: RadioProfile;
  readonly signal: RadioPower;
  readonly noise: RadioPower;
  readonly viablePath: boolean;
  readonly settingsCompatible: boolean;
};
export interface RadioInput {
  readonly kind: 'check-settings' | 'check-path' | 'measure-snr' | 'measure-link';
}
interface ObservationBase {
  readonly profileId: RadioProfile['id'];
  readonly version: WorldVersion;
  readonly throughputProven: false;
  readonly wholeRouteProven: false;
}
interface RejectedPrerequisite {
  readonly snrProven: false;
  readonly usableLink: false;
  readonly reason: 'incompatible-radio-settings' | 'path-prerequisite-fails';
}
interface MeasuredSNR {
  readonly signal: RadioPowerReading;
  readonly noise: RadioPowerReading;
  readonly snr: EvaluatedQuantity<'dB'>;
  readonly minimum: EvaluatedQuantity<'dB'>;
  readonly snrProven: true;
  readonly thresholdMet: boolean;
  readonly usableLink: boolean;
}
export type RadioObservation = ObservationBase & ({
  readonly kind: 'radio-settings';
  readonly scope: 'settings compatibility only';
  readonly settingsCompatible: boolean;
  readonly snrProven: false;
} & ({ readonly settingsCompatible: true } | RejectedPrerequisite) | {
  readonly kind: 'radio-path';
  readonly scope: 'path preparation only';
  readonly viablePath: boolean;
  readonly settingsCompatible: boolean;
  readonly pathPrepared: boolean;
  readonly snrProven: false;
} & ({ readonly pathPrepared: true } | RejectedPrerequisite) | {
  readonly kind: 'radio-snr';
  readonly scope: 'SNR with supplied path prerequisites';
  readonly otherPathChecks: boolean;
} & (MeasuredSNR | RejectedPrerequisite) | {
  readonly kind: 'radio-link';
  readonly scope: 'supplied radio path and SNR only';
  readonly viablePath: boolean;
  readonly settingsCompatible: boolean;
} & (MeasuredSNR | RejectedPrerequisite));

function issue(code: string, field: string, message: string): ContentIssue {
  return { code, field, message };
}
function profileIssue(profile: unknown): ContentIssue | null {
  if (!isRecord(profile) || profile['id'] !== 'spec001:PROFILE-RADIO') {
    return issue('unknown-authored-profile', 'profile.id', 'Select the reviewed radio profile; no universal SNR threshold is assumed.');
  }
  // Accept source/content metadata already validated at the content boundary,
  // while rejecting unreviewed extra scoring fields in the profile projection.
  const fields = ['id', 'parameters', 'kind', 'sources', 'assumptions', 'limits',
    'schemaVersion', 'episodeId', 'contentVersion', 'reviewedProfileId', 'ruleIds',
    'sourceClaims', 'model', 'reviewedCaseIds', 'alternatives'];
  if (Object.keys(profile).some(key => !fields.includes(key))) {
    return issue('unsupported-profile-field', 'profile', 'This profile cannot add unreviewed channel rankings, propagation or performance rules.');
  }
  if ('reviewedProfileId' in profile && profile['reviewedProfileId'] !== profile['id']) {
    return issue('profile-review-mismatch', 'profile.reviewedProfileId', 'Retain the reviewed radio profile identity.');
  }
  const parameters = profile['parameters'];
  if (!isRecord(parameters) || Object.keys(parameters).some(key => key !== 'requiredSNR' && key !== 'inclusiveMinimum')) {
    return issue('malformed-profile', 'profile.parameters', 'Supply only the reviewed required SNR and inclusive minimum.');
  }
  const invalidMinimum = quantityIssue(parameters['requiredSNR'], 'dB', 'profile.parameters.requiredSNR');
  if (invalidMinimum) return invalidMinimum;
  if ((parameters['requiredSNR'] as AuthoredQuantity<'dB'>).value !== 20 || parameters['inclusiveMinimum'] !== true) {
    return issue('profile-review-mismatch', 'profile.parameters', 'PROFILE-RADIO requires exactly 20 dB inclusive; changed thresholds or reversed comparisons need their own review.');
  }
  return null;
}

/** Signed power levels are distinct from nonnegative loss/reserve quantities. */
function powerIssue(value: unknown, field: string): ContentIssue | null {
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'value' && key !== 'unit')) {
    return issue('malformed-quantity', field, `Supply ${field} as a power value with its dBm unit.`);
  }
  if (value['unit'] !== 'dBm') {
    return issue('wrong-or-missing-unit', field, `${field} requires dBm; a dB ratio cannot stand in for a power level.`);
  }
  if (typeof value['value'] !== 'number' || !Number.isFinite(value['value'])) {
    return issue('invalid-quantity-value', field, `${field} must be a finite signed power level in dBm.`);
  }
  return null;
}

/** Decimal arithmetic honors authored numbers before any display rounding. */
function decimal(value: number) {
  const [mantissa = '', rawExponent = '0'] = value.toString().split('e');
  const [integer = '', fraction = ''] = mantissa.split('.');
  return { coefficient: BigInt(integer + fraction), exponent: Number(rawExponent) - fraction.length };
}
function snrCalculation(signal: number, noise: number, minimum: number) {
  const parts = [decimal(signal), decimal(noise), decimal(minimum)] as const;
  const exponent = Math.min(...parts.map(part => part.exponent));
  const scaled = (part: ReturnType<typeof decimal>) => part.coefficient * 10n ** BigInt(part.exponent - exponent);
  const difference = scaled(parts[0]) - scaled(parts[1]);
  return { value: Number(`${difference}e${exponent}`), thresholdMet: difference >= scaled(parts[2]) };
}

function validateChallenge(challenge: unknown): ContentIssue | null {
  if (!isRecord(challenge)) return issue('unsupported-radio-model', 'kind', 'Supply a reviewed radio predicate.');
  const fieldsByKind: Record<string, readonly string[]> = {
    'radio-settings': ['settingsCompatible'],
    'radio-path': ['viablePath', 'settingsCompatible'],
    'radio-snr': ['signal', 'noise', 'otherPathChecks'],
    'radio-link': ['viablePath', 'settingsCompatible', 'signal', 'noise'],
  };
  const kind = challenge['kind'];
  if (typeof kind !== 'string' || !Object.hasOwn(fieldsByKind, kind)) {
    return issue('unsupported-radio-model', 'kind', 'Only scoped settings, path and SNR predicates are supported.');
  }
  const fields = fieldsByKind[kind]!;
  if (Object.keys(challenge).some(key => key !== 'kind' && key !== 'profile' && !fields.includes(key))) {
    return issue('unsupported-challenge-field', 'challenge', 'Supply only this predicate’s explicit facts; channel selection does not imply propagation, SNR or throughput.');
  }
  const invalidProfile = profileIssue(challenge['profile']);
  if (invalidProfile) return invalidProfile;
  for (const field of fields) {
    if (field === 'signal' || field === 'noise') {
      const invalidPower = powerIssue(challenge[field], field);
      if (invalidPower) return invalidPower;
    } else if (typeof challenge[field] !== 'boolean') {
      return issue(field === 'settingsCompatible' ? 'missing-authored-settings-fact' : 'missing-authored-path-fact', field,
        'Supply an explicit true/false scenario fact; omitted or malformed facts cannot be inferred from signal strength.');
    }
  }
  if (fields.includes('signal')) {
    const signal = challenge['signal'] as RadioPower;
    const noise = challenge['noise'] as RadioPower;
    const profile = challenge['profile'] as unknown as RadioProfile;
    if (!Number.isFinite(snrCalculation(signal.value, noise.value, profile.parameters.requiredSNR.value).value)) {
      return issue('unrepresentable-snr', 'signal/noise', 'The supplied power difference exceeds the finite numeric reading range.');
    }
  }
  return null;
}
function validateInput(input: unknown): input is RadioInput {
  return isRecord(input) && Object.keys(input).length === 1
    && ['check-settings', 'check-path', 'measure-snr', 'measure-link'].includes(input['kind'] as string);
}
function power(value: number): RadioPowerReading { return { value: value as DecibelMilliwatts, unit: 'dBm' }; }
function ratio(value: number): EvaluatedQuantity<'dB'> { return { value: value as Decibels, unit: 'dB' }; }

/**
 * T006/T014 PHY07, T08/T09 and T068 RR-O07/O08. Caller supplies facts for the
 * captured configuration and attempt. A changed channel/path needs a new actual
 * observation; this evaluator cannot refresh an old one or complete an objective.
 * T074 owns persisted evidence freshness. No DOM, network, randomness or effects.
 */
export const evaluateRadio = createEvaluator<RadioChallenge, RadioInput, RadioObservation>({
  validateChallenge,
  validateInput,
  evaluate(challenge, input, world) {
    const inputKinds = { 'radio-settings': 'check-settings', 'radio-path': 'check-path', 'radio-snr': 'measure-snr', 'radio-link': 'measure-link' };
    if (input.kind !== inputKinds[challenge.kind]) return invalidInput('action-does-not-match-predicate');
    const base = {
      profileId: challenge.profile.id,
      version: { configurationRevision: world.configurationRevision, attemptId: world.attemptId },
      throughputProven: false as const,
      wholeRouteProven: false as const,
    };
    if (challenge.kind === 'radio-settings') {
      const observation = { ...base, kind: challenge.kind, scope: 'settings compatibility only' as const, snrProven: false as const };
      return challenge.settingsCompatible ? {
        status: 'correct', reasonCode: 'compatible-radio-settings', acceptedEffects: [],
        observations: [{ ...observation, settingsCompatible: true }],
      } : {
        status: 'incorrect', reasonCode: 'incompatible-radio-settings', acceptedEffects: [],
        observations: [{ ...observation, settingsCompatible: false, usableLink: false, reason: 'incompatible-radio-settings' }],
      };
    }
    if (challenge.kind === 'radio-path') {
      const observation = { ...base, kind: challenge.kind, scope: 'path preparation only' as const,
        viablePath: challenge.viablePath, settingsCompatible: challenge.settingsCompatible, snrProven: false as const };
      if (challenge.settingsCompatible && challenge.viablePath) return {
        status: 'correct', reasonCode: 'radio-path-prepared', acceptedEffects: [], observations: [{ ...observation, pathPrepared: true }],
      };
      const reason = !challenge.settingsCompatible ? 'incompatible-radio-settings' as const : 'path-prerequisite-fails' as const;
      return { status: 'incorrect', reasonCode: reason, acceptedEffects: [],
        observations: [{ ...observation, pathPrepared: false, usableLink: false, reason }] };
    }
    const observation = challenge.kind === 'radio-snr'
      ? { ...base, kind: challenge.kind, scope: 'SNR with supplied path prerequisites' as const, otherPathChecks: challenge.otherPathChecks }
      : { ...base, kind: challenge.kind, scope: 'supplied radio path and SNR only' as const,
        viablePath: challenge.viablePath, settingsCompatible: challenge.settingsCompatible };
    const reason = challenge.kind === 'radio-link' && !challenge.settingsCompatible ? 'incompatible-radio-settings'
      : (challenge.kind === 'radio-snr' ? !challenge.otherPathChecks : !challenge.viablePath) ? 'path-prerequisite-fails' : null;
    // All authored quantities are already valid, but a known incompatible or
    // blocked path cannot be rescued by a passing numerical budget.
    if (reason) return { status: 'incorrect', reasonCode: reason, acceptedEffects: [],
      observations: [{ ...observation, snrProven: false, usableLink: false, reason }] };
    const minimum = challenge.profile.parameters.requiredSNR.value;
    const calculation = snrCalculation(challenge.signal.value, challenge.noise.value, minimum);
    return {
      status: calculation.thresholdMet ? 'correct' : 'incorrect',
      reasonCode: calculation.thresholdMet ? 'snr-meets-profile' : 'snr-below-profile', acceptedEffects: [],
      observations: [{ ...observation, signal: power(challenge.signal.value), noise: power(challenge.noise.value),
        snr: ratio(calculation.value), minimum: ratio(minimum), snrProven: true,
        thresholdMet: calculation.thresholdMet, usableLink: calculation.thresholdMet }],
    };
  },
});
