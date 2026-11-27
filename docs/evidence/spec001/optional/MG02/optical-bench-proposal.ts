// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Proposed closed adapter only; this file is outside production discovery.
import { contentError, invalidInput, isRecord } from '../../../../../src/domain/evaluate';
import { evaluateOptics, type OpticalChallenge, type OpticalInput, type OpticalProfile, type OpticalQuantity } from '../../../../../src/domain/optics';
import type { DomainAction, WorldVersion } from '../../../../../src/domain/types';
import reviewed from '../../../../../content/spec001/sources.json' with { type: 'json' };

export interface OpticalBenchCase {
  readonly sourceCaseId: 'T04' | 'T05' | 'T15';
  readonly compatible: true;
  readonly loss: OpticalQuantity<'dB'>;
}
/** Predictions, not an authority to choose verdict, effects, profile or context. */
export interface OpticalBenchAnswer {
  readonly receive: OpticalQuantity<'dBm'>;
  readonly margin: OpticalQuantity<'dB'>;
  readonly reserve: 'met' | 'shortfall';
  readonly overload: 'not-overloaded' | 'overloaded';
}
export interface CompatibilityCard {
  readonly sourceCaseId: 'C-COMPAT' | 'T07' | 'B-COMPAT';
  readonly premises: Readonly<Record<string, boolean>>;
  readonly explanation: string;
}
interface ModeFeedback { readonly correct: string; readonly incorrect: string; readonly invalidInput: string }
export interface OpticalBudgetBench {
  readonly kind: 'optical-budget-bench';
  readonly speakerId: 'spec001:CH16';
  readonly instructions: readonly string[];
  readonly profileId: 'spec001:PROFILE-OPTICAL';
  readonly practice: OpticalBenchCase & { readonly sourceCaseId: 'T04'; readonly explanation: string };
  readonly delivery: OpticalBenchCase & { readonly sourceCaseId: 'T05'; readonly actionId: 'spec001:ACTION-MG02-diagnose' };
  readonly boundaryExample: OpticalBenchCase & { readonly sourceCaseId: 'T15'; readonly explanation: string };
  readonly compatibilityCards: readonly CompatibilityCard[];
  readonly answerControls: {
    readonly receiveLabel: string; readonly marginLabel: string; readonly reserveLabel: string;
    readonly reserveMet: string; readonly reserveShortfall: string; readonly overloadLabel: string;
    readonly overloaded: string; readonly notOverloaded: string;
  };
  readonly feedback: { readonly practice: ModeFeedback; readonly delivery: ModeFeedback; readonly contentError: string; readonly alreadyCompleted: string };
  readonly controls: { readonly practice: string; readonly delivery: string; readonly submit: string; readonly retry: string; readonly exit: string };
  readonly recovery: { readonly retryExplanation: string; readonly exitExplanation: string };
  readonly reward: { readonly kind: 'optional-optical-depth'; readonly factId: 'spec001:FACT-MG02-completion' };
  readonly entryContexts: readonly [{ readonly roomId: 'spec001:R06'; readonly safePositionId: 'spec001:R06.entry'; readonly hotspotId: 'spec001:HOTSPOT-fiber-r06-pr059' }];
  readonly returnPolicy: 'captured-entry';
  readonly timingDefault: 'off';
}
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
const sourceCases = [...reviewed.referenceCases, ...reviewed.reviewCases];
const error = (field: string) => contentError({ code: 'optical-bench-source-mismatch', field, message: 'Keep this supplied case exactly as reviewed; absent or changed authored premises are not a learner mistake.' });
function quantityAnswer(value: unknown, unit: 'dBm' | 'dB'): boolean {
  return isRecord(value) && exact(value, ['value', 'unit']) && value['unit'] === unit
    && typeof value['value'] === 'number' && Number.isFinite(value['value'])
    && value['value'] >= -128 && value['value'] <= 128;
}

/** Reuses actual optical arithmetic. A diagnosis never repairs the supplied plan. */
export function evaluateBenchAnswer(part: unknown, profile: unknown, action: DomainAction<unknown>, world: WorldVersion) {
  if (!isRecord(part) || !exact(part, ['sourceCaseId', 'compatible', 'loss']) || typeof part['sourceCaseId'] !== 'string' || !['T04', 'T05', 'T15'].includes(part['sourceCaseId'])) return error('case');
  const ref = sourceCases.find(c => c.id === part['sourceCaseId']);
  const loss = part['loss'];
  if (!ref || !('loss' in ref.inputs) || !isRecord(loss) || !exact(loss, ['value', 'unit'])
    || loss['value'] !== ref.inputs.loss.value || loss['unit'] !== ref.inputs.loss.unit
    || part['compatible'] !== true || !('compatible' in ref.inputs) || ref.inputs.compatible !== true) return error('loss-or-compatibility');
  const challenge: OpticalChallenge = { kind: 'optical-passive', profile: profile as OpticalProfile, compatible: true, loss: loss as unknown as OpticalQuantity<'dB'> };
  // Preserve action capture. Authored validation precedes malformed/stale input.
  const physicalAction = isRecord(action) ? { ...action, input: { kind: 'measure-optics' as const } } : action;
  const physical = evaluateOptics(challenge, physicalAction as DomainAction<OpticalInput>, world);
  if (physical.status === 'content-error' || physical.status === 'invalid-input') return physical;
  const observation = physical.observations[0];
  if (!observation || observation.kind !== 'optical-power') return error('observation');
  const supplied = action.input;
  if (!isRecord(supplied) || !exact(supplied, ['receive', 'margin', 'reserve', 'overload'])
    || !quantityAnswer(supplied['receive'], 'dBm') || !quantityAnswer(supplied['margin'], 'dB')
    || (supplied['reserve'] !== 'met' && supplied['reserve'] !== 'shortfall')
    || (supplied['overload'] !== 'not-overloaded' && supplied['overload'] !== 'overloaded')) return invalidInput('malformed-optical-bench-answer');
  const answer = supplied as unknown as OpticalBenchAnswer;
  const correct = answer.receive.value === observation.receive.value && answer.margin.value === observation.margin.value
    && answer.reserve === (observation.reserveMet ? 'met' : 'shortfall')
    && answer.overload === (observation.overload ? 'overloaded' : 'not-overloaded');
  return {
    status: correct ? 'correct' as const : 'incorrect' as const,
    reasonCode: correct ? 'optical-bench-diagnosis-correct' : 'optical-bench-diagnosis-incorrect', acceptedEffects: [],
    observations: [{ kind: 'optical-bench-answer' as const, sourceCaseId: part['sourceCaseId'],
      physicalStatus: physical.status, physical: observation, learnerStatus: correct ? 'correct' as const : 'incorrect' as const,
      repaired: false as const, wholeRouteProven: false as const, serviceProven: false as const,
      attemptPenalty: 0 as const, progressAward: 0 as const }],
  };
}

/** Read-only compatibility cards. Do not infer unspecified physical parameters. */
export function evaluateCompatibilityCard(card: unknown, action: DomainAction<unknown>, world: WorldVersion) {
  if (!isRecord(card) || !exact(card, ['sourceCaseId', 'premises']) || typeof card['sourceCaseId'] !== 'string' || !['C-COMPAT', 'T07', 'B-COMPAT'].includes(card['sourceCaseId'])) return error('compatibility-card');
  const ref = sourceCases.find(c => c.id === card['sourceCaseId']); const premises = card['premises'];
  if (!ref || !isRecord(premises) || !exact(premises, Object.keys(ref.inputs))
    || !Object.entries(ref.inputs).every(([key, value]) => premises[key] === value)) return error('compatibility-premises');
  let challenge: OpticalChallenge;
  if (card['sourceCaseId'] === 'C-COMPAT') {
    challenge = { kind: 'optical-inspection', everyRequiredCompatibilityCheck: premises['everyRequiredCompatibilityCheck'] as boolean, requiredInspectionComplete: premises['requiredInspectionComplete'] as boolean };
  } else {
    // T07 explicitly fails compatibility. B-COMPAT explicitly fails its required
    // wavelength direction; matching shell shape cannot erase that failed check.
    challenge = { kind: 'optical-compatibility', knownProfiles: true, compatible: card['sourceCaseId'] === 'T07' ? premises['compatible'] as boolean : premises['requiredWavelengthDirectionMatches'] as boolean };
  }
  const kind = challenge.kind === 'optical-inspection' ? 'check-inspection' as const : 'check-compatibility' as const;
  const physicalAction = isRecord(action) ? { ...action, input: { kind } } : action;
  const result = evaluateOptics(challenge, physicalAction as DomainAction<OpticalInput>, world);
  if (result.status === 'content-error' || result.status === 'invalid-input') return result;
  if (!isRecord(action.input) || !exact(action.input, ['kind']) || action.input['kind'] !== 'inspect-card') return invalidInput('malformed-compatibility-card-input');
  return result;
}
