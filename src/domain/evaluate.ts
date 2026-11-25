// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { DomainAction, EvaluationResult, Evaluator, Quantity, WorldVersion } from './types';

/** Only nonnegative dimensions needed by this slice; dBm is not a loss unit. */
export type NonnegativeUnit = 'm' | 'dB';
export interface AuthoredQuantity<U extends NonnegativeUnit> {
  readonly value: number;
  readonly unit: U;
}
export interface EvaluatedQuantity<U extends NonnegativeUnit> {
  readonly value: Quantity<U>;
  readonly unit: U;
}
export interface ContentIssue {
  readonly code: string;
  readonly field: string;
  readonly message: string;
}
export interface ContentErrorObservation {
  readonly kind: 'content-error';
  readonly reason: 'malformed-authored-challenge';
  readonly issue: ContentIssue;
  readonly attemptPenalty: 0;
  readonly progressAward: 0;
}
export type BoundaryObservation = ContentErrorObservation | {
  readonly kind: 'invalid-input';
  readonly reason: string;
  readonly attemptPenalty: 0;
  readonly progressAward: 0;
} | {
  readonly kind: 'authored-quantity';
  readonly field: string;
  readonly quantity: EvaluatedQuantity<NonnegativeUnit>;
  readonly scope: 'authored quantity only';
};

export function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function contentError(issue: ContentIssue): EvaluationResult<ContentErrorObservation, never> {
  return {
    status: 'content-error', reasonCode: 'malformed-authored-challenge', acceptedEffects: [],
    observations: [{ kind: 'content-error', reason: 'malformed-authored-challenge', issue: { ...issue }, attemptPenalty: 0, progressAward: 0 }],
  };
}

export function invalidInput(reason: string): EvaluationResult<BoundaryObservation, never> {
  return {
    status: 'invalid-input', reasonCode: reason, acceptedEffects: [],
    observations: [{ kind: 'invalid-input', reason, attemptPenalty: 0, progressAward: 0 }],
  };
}

/** Validate author data, never coerce strings, infer units, or clamp invalid values. */
export function quantityIssue(value: unknown, unit: NonnegativeUnit, field: string): ContentIssue | null {
  if (!isRecord(value) || Object.keys(value).some(key => key !== 'value' && key !== 'unit')) {
    return { code: 'malformed-quantity', field, message: `Supply ${field} as a value with its ${unit} unit.` };
  }
  if (value['unit'] !== unit) {
    return { code: 'wrong-or-missing-unit', field, message: `${field} requires ${unit}; units cannot be inferred or interchanged.` };
  }
  if (typeof value['value'] !== 'number' || !Number.isFinite(value['value']) || value['value'] < 0) {
    return { code: 'invalid-quantity-value', field, message: `${field} must be a finite, nonnegative number in ${unit}.` };
  }
  return null;
}

/**
 * STATE02 primitive, including T14's passive-loss case. A well-formed quantity
 * permits subsequent grading; this function performs no optical/link scoring.
 */
export function evaluateAuthoredQuantity(
  value: unknown, unit: NonnegativeUnit, field: string,
): EvaluationResult<BoundaryObservation, never> {
  const issue = quantityIssue(value, unit, field);
  if (issue) return contentError(issue);
  const valid = value as AuthoredQuantity<typeof unit>;
  return {
    status: 'correct', reasonCode: 'authored-quantity-valid', acceptedEffects: [],
    observations: [{ kind: 'authored-quantity', field, quantity: { value: valid.value as Quantity<typeof unit>, unit }, scope: 'authored quantity only' }],
  };
}

function versionValid(value: unknown): value is WorldVersion {
  return isRecord(value)
    && Number.isSafeInteger(value['configurationRevision']) && (value['configurationRevision'] as number) >= 0
    && typeof value['attemptId'] === 'string' && value['attemptId'].trim().length > 0;
}

/**
 * Shared four-status boundary for pure predicates. Broken authored content wins
 * over malformed/stale commands so it can never become a learner failure.
 * Invalid command captures are not T13 stale measurement submissions: the latter
 * are evaluated by the later evidence rule. Reducers still recheck both versions.
 * No predicate in this slice grants effects; later objective integration owns them.
 */
export function createEvaluator<Challenge, Input, Observation>(definition: {
  readonly validateChallenge: (challenge: unknown) => ContentIssue | null;
  readonly validateInput: (input: unknown) => input is Input;
  readonly evaluate: (challenge: Challenge, input: Input, world: WorldVersion) => EvaluationResult<Observation | BoundaryObservation, never>;
}): Evaluator<Challenge, Input, WorldVersion, Observation | BoundaryObservation, never> {
  return (challenge, action: DomainAction<Input>, relevantWorld) => {
    const issue = definition.validateChallenge(challenge);
    if (issue) return contentError(issue);
    if (!isRecord(action) || typeof action.actionId !== 'string' || !action.actionId.trim()
      || !versionValid(action.expectedVersion) || !versionValid(relevantWorld)) {
      return invalidInput('malformed-action-envelope');
    }
    if (action.expectedVersion.configurationRevision !== relevantWorld.configurationRevision
      || action.expectedVersion.attemptId !== relevantWorld.attemptId) return invalidInput('stale-action');
    if (action.input === null || action.input === undefined) return invalidInput('required-action-missing');
    if (!definition.validateInput(action.input)) return invalidInput('malformed-action-input');
    // Return independent JSON-compatible data, including copied freshness fields.
    return structuredClone(definition.evaluate(challenge, action.input, relevantWorld));
  };
}
