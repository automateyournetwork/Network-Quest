// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Reviewed-variant proposal only; not imported by the application.
import { contentError, invalidInput, isRecord } from '../../../../../src/domain/evaluate';
import { evaluatePower, type PowerChallenge, type PowerProfile, type PowerQuantity } from '../../../../../src/domain/power';
import type { DomainAction, WorldVersion } from '../../../../../src/domain/types';
import reviewed from '../../../../../content/spec001/sources.json' with { type: 'json' };

export interface PowerAuditCase {
  readonly sourceCaseId: 'C-POWER' | 'T10' | 'B-POWER-30';
  readonly demands: readonly PowerQuantity[];
  readonly budgetBoundary: 'delivered-after-losses';
  readonly demandBoundary: 'delivered-after-losses';
  readonly otherConstraints: true;
}
export interface PowerAuditAnswer {
  readonly assessment: 'within-budget' | 'over-budget';
  readonly difference: PowerQuantity;
}
interface ModeFeedback { readonly correct: string; readonly incorrect: string; readonly invalidInput: string }
export interface DeliveredPowerAudit {
  readonly kind: 'delivered-power-audit';
  readonly speakerId: 'spec001:CH19';
  readonly instructions: readonly string[];
  readonly profileId: 'spec001:PROFILE-POWER';
  readonly practice: PowerAuditCase & { readonly sourceCaseId: 'C-POWER'; readonly explanation: string };
  readonly delivery: PowerAuditCase & { readonly sourceCaseId: 'T10'; readonly actionId: 'spec001:ACTION-SQ02-audit' };
  readonly boundaryExample: PowerAuditCase & { readonly sourceCaseId: 'B-POWER-30'; readonly explanation: string };
  readonly answerControls: { readonly assessmentLabel: string; readonly withinBudget: string; readonly overBudget: string; readonly differenceLabel: string };
  readonly feedback: { readonly practice: ModeFeedback; readonly delivery: ModeFeedback; readonly contentError: string; readonly alreadyCompleted: string };
  readonly controls: { readonly practice: string; readonly delivery: string; readonly submit: string; readonly retry: string; readonly exit: string };
  readonly recovery: { readonly retryExplanation: string; readonly exitExplanation: string };
  readonly reward: { readonly kind: 'workshop-decoration'; readonly factId: 'spec001:FACT-SQ02-audit'; readonly assetId: 'spec001:ASSET-ILLUSTRATION-18'; readonly roomId: 'spec001:R02'; readonly alternativeText: string; readonly unavailableText: string };
  readonly entryContexts: readonly { readonly roomId: 'spec001:R09'; readonly safePositionId: 'spec001:R09.entry'; readonly hotspotId: 'spec001:HOTSPOT-market-eel' }[];
  readonly returnPolicy: 'captured-entry';
  readonly timingDefault: 'off';
}
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
const sourceCases = [...reviewed.referenceCases, ...reviewed.reviewCases];

/** Compare a supplied diagnosis with the actual evaluator observation, without a second power calculation. */
export function evaluateAuditAnswer(part: unknown, profile: unknown, action: DomainAction<unknown>, world: WorldVersion) {
  if (!isRecord(part) || !exact(part, ['sourceCaseId', 'demands', 'budgetBoundary', 'demandBoundary', 'otherConstraints'])
    || !['C-POWER', 'T10', 'B-POWER-30'].includes(String(part['sourceCaseId']))) {
    return contentError({ code: 'unsupported-audit-case', field: 'sourceCaseId', message: 'Supply one of the three reviewed ledger cases.' });
  }
  const source = sourceCases.find(c => c.id === part['sourceCaseId']);
  const demands = part['demands'];
  const expectedDemands = source && 'demands' in source.inputs ? source.inputs.demands : undefined;
  if (!expectedDemands || !Array.isArray(demands) || demands.length !== expectedDemands.length
    || !Array.from(demands).every((d, index) => isRecord(d) && exact(d, ['value', 'unit'])
      && d['value'] === expectedDemands[index]?.value && d['unit'] === expectedDemands[index]?.unit)
    || part['otherConstraints'] !== true) {
    return contentError({ code: 'audit-source-mismatch', field: 'demands', message: 'Retain the reviewed demand cards and independent compatibility/per-port assumptions.' });
  }
  const challenge: PowerChallenge = {
    kind: 'delivered-power', profile: profile as PowerProfile,
    demands: part['demands'] as PowerQuantity[], otherConstraints: true,
    budgetBoundary: part['budgetBoundary'] as PowerChallenge['budgetBoundary'],
    demandBoundary: part['demandBoundary'] as PowerChallenge['demandBoundary'],
  };
  // Preserve the caller's capture. The real power evaluator validates authored
  // content before envelopes; it may never recapture a stale action as current.
  const physicalAction = isRecord(action) ? { ...action, input: { kind: 'check-allocation' as const } } : action;
  const plan = evaluatePower(challenge, physicalAction as DomainAction<{ kind: 'check-allocation' }>, world);
  if (plan.status === 'content-error' || plan.status === 'invalid-input') return plan;
  const observation = plan.observations[0];
  if (!observation || observation.kind !== 'delivered-power' || !('total' in observation)) {
    return contentError({ code: 'unsupported-audit-observation', field: 'plan', message: 'This audit requires the reviewed aggregate ledger observation.' });
  }
  const answer = action.input;
  if (!isRecord(answer) || !exact(answer, ['assessment', 'difference'])
    || (answer['assessment'] !== 'within-budget' && answer['assessment'] !== 'over-budget')
    || !isRecord(answer['difference']) || !exact(answer['difference'], ['value', 'unit'])
    || answer['difference']['unit'] !== 'W' || typeof answer['difference']['value'] !== 'number'
    || !Number.isFinite(answer['difference']['value']) || answer['difference']['value'] < 0) {
    return invalidInput('malformed-audit-answer');
  }
  const expectedAssessment = observation.budgetFits ? 'within-budget' : 'over-budget';
  const difference = 'headroom' in observation ? observation.headroom : observation.excess;
  const correct = answer['assessment'] === expectedAssessment && answer['difference']['value'] === difference.value;
  return {
    status: correct ? 'correct' as const : 'incorrect' as const,
    reasonCode: correct ? 'delivered-power-diagnosis-correct' : 'delivered-power-diagnosis-incorrect',
    acceptedEffects: [],
    observations: [{ kind: 'power-audit-answer' as const, sourceCaseId: part['sourceCaseId'],
      planStatus: plan.status, plan: observation, expectedAssessment, expectedDifference: difference,
      learnerStatus: correct ? 'correct' as const : 'incorrect' as const,
      dataLinkProven: false as const, repaired: false as const, attemptPenalty: 0 as const, progressAward: 0 as const }],
  };
}
