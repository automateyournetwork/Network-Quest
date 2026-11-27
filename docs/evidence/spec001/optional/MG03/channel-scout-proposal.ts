// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated T103 proposal. No runtime controller or UI is authorized by these pure adapters.
import type { ContentRegistry } from '../../../../../src/content/registry';
import { contentError, invalidInput, isRecord } from '../../../../../src/domain/evaluate';
import { evaluateRadio, type RadioProfile } from '../../../../../src/domain/radio';
import type { DomainAction, EvaluationResult, QualifiedId, WorldVersion } from '../../../../../src/domain/types';
import { isHistoricalObjectiveMeasurement } from '../../../../../src/state/objective-history';
import { isMeasurementCurrent } from '../../../../../src/state/reducer';
import { createRadioScenarioResolver } from '../../../../../src/state/radio-scenario';
import type { GameState, Measurement, WorldState } from '../../../../../src/state/types';
import candidate from './MG03.candidate.json' with { type: 'json' };

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const exact = (x: Record<string, unknown>, keys: readonly string[]) => Object.keys(x).length === keys.length && Object.keys(x).every(k => keys.includes(k));
const canonical = (x: unknown): string => Array.isArray(x) ? `[${x.map(canonical).join(',')}]` : isRecord(x)
  ? `{${Object.entries(x).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}` : JSON.stringify(x);
const error = (field: string) => contentError({ code: 'channel-scout-content', field, message: 'Channel Scout requires its reviewed scenario and intact original observations.' });
export type ScoutAssessment = 'meets-threshold' | 'below-threshold';
export interface ScoutPredictionInput { readonly baselineMeasurementId: string; readonly assessment: ScoutAssessment }
export interface ScoutComparisonInput {
  readonly laterMeasurementId: string;
  readonly comparison: 'increased' | 'unchanged' | 'decreased';
  readonly currentAssessment: ScoutAssessment;
  readonly predictionAssessment: 'supported' | 'not-supported';
  readonly evidenceClaim: 'current-reading-only-no-cause' | 'earlier-proves-current' | 'weather-proven' | 'throughput-proven';
}
/** Controller-owned transient capture, never accepted from UI or a persisted save. */
export interface ScoutPrediction {
  readonly kind: 'scout-prediction';
  readonly adventureId: string;
  readonly version: WorldVersion;
  readonly baseline: Measurement;
  readonly observedMeasurementIds: readonly string[];
  readonly scenarioSignature: string;
  readonly assessment: ScoutAssessment;
}
/** Exact trusted mapping; callers cannot submit an action ID or a flag/value. */
export const scoutSelections = Object.freeze({
  'channel-A': q('ACTION-radio-channel-A'), 'channel-B': q('ACTION-radio-channel-B'),
  'mitigate-emitter': q('ACTION-radio-mitigate-emitter'), 'raise-noise': q('ACTION-radio-raise-noise'),
});
export function scoutSelectionAction(choice: unknown): QualifiedId | null {
  return typeof choice === 'string' && Object.hasOwn(scoutSelections, choice) ? scoutSelections[choice as keyof typeof scoutSelections] : null;
}
const assessment = (value: unknown): value is ScoutAssessment => value === 'meets-threshold' || value === 'below-threshold';
function profile(registry: ContentRegistry): RadioProfile {
  const record = registry.record(q('PROFILE-RADIO'));
  return (record?.kind === 'profile' && record.reviewedProfileId === record.id ? { id: record.id, parameters: record.parameters } : null) as RadioProfile;
}
/** Evaluate the actual fixed resolver. This result is NOT installed as a reading. */
function envelope(delivery: unknown, registry: ContentRegistry, action: DomainAction<unknown>, game: GameState) {
  if (canonical(delivery) !== canonical(candidate.optionalActivity.delivery)) return { failure: error('delivery') } as const;
  const scenario = createRadioScenarioResolver(registry)(game, q('O08'));
  if (scenario?.kind !== 'radio-proof') return { failure: error('scenario') } as const;
  const checked = evaluateRadio({ kind: 'radio-link', profile: profile(registry), ...scenario.path },
    (isRecord(action) ? { ...action, input: { kind: 'measure-link' } } : action) as DomainAction<{ kind: 'measure-link' }>, game.world);
  if (checked.status === 'content-error' || checked.status === 'invalid-input') return { failure: checked } as const;
  if (game.world.roomId !== q('R08') || !game.world.completedObjectiveIds.includes(q('O08'))) return { failure: invalidInput('scout-unavailable-before-radio-proof') } as const;
  if (!scenario.path.viablePath || !scenario.path.settingsCompatible) return { failure: invalidInput('scout-path-preparation-required') } as const;
  return { scenario, checked } as const;
}
/** Integrity and scope only. It preserves the measurement's original version. */
function checkedRecord(registry: ContentRegistry, game: GameState, record: Measurement) {
  if (!record || typeof record.stale !== 'boolean' || !record.readings.every(r => isRecord(r) && exact(r, ['name', 'value', 'unit']))) return null;
  const status = record.conclusionCode.endsWith(':correct') ? 'correct' : record.conclusionCode.endsWith(':incorrect') ? 'incorrect' : null;
  if (!status || !isHistoricalObjectiveMeasurement(registry, game, q('O08'), record, status)
    || record.readings[0]?.value !== 1 || record.readings[1]?.value !== 1) return null;
  const signal = record.readings[2]!, noise = record.readings[3]!;
  // Exactly the supplied O08 states, including existing near-boundary evidence.
  // This whitelist is provenance scope, not another radio or SNR formula.
  if (signal.value !== -65 || ![-90, -78, -85, -84.99].includes(noise.value)
    || (noise.value === -90 && !record.conclusionCode.includes('scenario-channel-A:'))
    || (noise.value === -85 && !record.conclusionCode.includes('scenario-channel-B:'))) return null;
  const result = evaluateRadio({ kind: 'radio-link', profile: profile(registry), viablePath: true, settingsCompatible: true,
    signal: { value: signal.value, unit: 'dBm' }, noise: { value: noise.value, unit: 'dBm' } },
  { actionId: 'scout-historical-integrity' as DomainAction<unknown>['actionId'], expectedVersion: record, input: { kind: 'measure-link' } }, record);
  const observed = result.observations[0];
  if (!observed || observed.kind !== 'radio-link' || !observed.snrProven || result.status !== status) return null;
  return { record, observation: observed, physicalStatus: status };
}
export function captureScoutPrediction(delivery: unknown, registry: ContentRegistry, action: DomainAction<unknown>, game: GameState): EvaluationResult<ScoutPrediction | unknown, never> {
  const checked = envelope(delivery, registry, action, game); if ('failure' in checked) return checked.failure!;
  const answer = action.input;
  if (!isRecord(answer) || !exact(answer, ['baselineMeasurementId', 'assessment']) || typeof answer['baselineMeasurementId'] !== 'string'
    || !uuid.test(answer['baselineMeasurementId']) || !assessment(answer['assessment'])) return invalidInput('malformed-scout-prediction');
  const matches = game.notebook.measurements.filter(m => m.id === answer['baselineMeasurementId']);
  if (!matches.length) return invalidInput('scout-missing-baseline');
  if (matches.length !== 1) return error('duplicate-measurement-id');
  const baseline = checkedRecord(registry, game, matches[0]!);
  if (!baseline) return error('baseline-provenance');
  if (baseline.record.configurationRevision >= game.world.configurationRevision) return invalidInput('scout-earlier-baseline-required');
  const capture: ScoutPrediction = { kind: 'scout-prediction', adventureId: game.adventureId,
    version: { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId },
    baseline: structuredClone(baseline.record), observedMeasurementIds: game.notebook.measurements.map(m => m.id),
    scenarioSignature: canonical(checked.scenario), assessment: answer['assessment'] };
  return { status: 'correct', reasonCode: 'scout-prediction-recorded-not-measured', acceptedEffects: [], observations: [capture] };
}
export function evaluateScoutComparison(delivery: unknown, registry: ContentRegistry, prediction: ScoutPrediction | null,
  action: DomainAction<unknown>, game: GameState): EvaluationResult<unknown, never> {
  const current = envelope(delivery, registry, action, game); if ('failure' in current) return current.failure!;
  if (!prediction) return invalidInput('scout-prediction-required');
  if (prediction.adventureId !== game.adventureId || prediction.version.attemptId !== game.world.attemptId
    || prediction.version.configurationRevision !== game.world.configurationRevision || prediction.scenarioSignature !== canonical(current.scenario)) return invalidInput('scout-prediction-stale');
  const answer = action.input;
  if (!isRecord(answer) || !exact(answer, ['laterMeasurementId', 'comparison', 'currentAssessment', 'predictionAssessment', 'evidenceClaim'])
    || typeof answer['laterMeasurementId'] !== 'string' || !uuid.test(answer['laterMeasurementId'])
    || (typeof answer['comparison'] !== 'string' || !['increased', 'unchanged', 'decreased'].includes(answer['comparison'])) || !assessment(answer['currentAssessment'])
    || (typeof answer['predictionAssessment'] !== 'string' || !['supported', 'not-supported'].includes(answer['predictionAssessment']))
    || (typeof answer['evidenceClaim'] !== 'string' || !['current-reading-only-no-cause', 'earlier-proves-current', 'weather-proven', 'throughput-proven'].includes(answer['evidenceClaim']))) return invalidInput('malformed-scout-comparison');
  const find = (id: string) => game.notebook.measurements.filter(m => m.id === id);
  const before = find(prediction.baseline.id), after = find(answer['laterMeasurementId']);
  if (!before.length || !after.length) return invalidInput('scout-new-measurement-required');
  if (before.length !== 1 || after.length !== 1) return error('duplicate-measurement-id');
  if (canonical(before[0]) !== canonical(prediction.baseline)) return error('baseline-capture-changed');
  const earlier = checkedRecord(registry, game, before[0]!), later = checkedRecord(registry, game, after[0]!);
  if (!earlier || !later) return error('measurement-provenance');
  if (prediction.observedMeasurementIds.includes(later.record.id) || game.notebook.measurements.indexOf(later.record) < prediction.observedMeasurementIds.length
    || earlier.record.configurationRevision >= later.record.configurationRevision) return invalidInput('scout-measure-after-prediction');
  if (!isMeasurementCurrent(later.record, game.world)) return invalidInput('scout-current-measurement-required');
  const latest = game.notebook.measurements.filter(m => m.ruleId === q('PHY07') && m.subjectIds.includes(q('O08')) && isMeasurementCurrent(m, game.world)).at(-1);
  if (latest?.id !== later.record.id) return invalidInput('scout-latest-measurement-required');
  if (later.observation.signal.value !== current.scenario.path.signal.value || later.observation.noise.value !== current.scenario.path.noise.value
    || later.record.conclusionCode !== `O08:${current.scenario.alternativeId.slice(8)}:${later.physicalStatus}`) return invalidInput('scout-current-scenario-mismatch');
  // Exact bounded display delta only; actual threshold/SNR are evaluateRadio's.
  const delta = (Math.round(later.observation.snr.value * 100) - Math.round(earlier.observation.snr.value * 100)) / 100;
  const expectedComparison = delta > 0 ? 'increased' : delta < 0 ? 'decreased' : 'unchanged';
  const expectedAssessment: ScoutAssessment = later.observation.thresholdMet ? 'meets-threshold' : 'below-threshold';
  const expectedPredictionAssessment = prediction.assessment === expectedAssessment ? 'supported' : 'not-supported';
  const correct = answer['comparison'] === expectedComparison && answer['currentAssessment'] === expectedAssessment
    && answer['predictionAssessment'] === expectedPredictionAssessment && answer['evidenceClaim'] === 'current-reading-only-no-cause';
  return { status: correct ? 'correct' : 'incorrect', reasonCode: correct ? 'scout-comparison-correct' : 'scout-comparison-incorrect', acceptedEffects: [], observations: [{
    kind: 'scout-comparison', earlier: { ...earlier, use: 'historical-only', usableAsCurrent: false }, later,
    prediction: { assessment: prediction.assessment, supported: expectedPredictionAssessment === 'supported' },
    snrChange: { value: delta, unit: 'dB' }, expectedComparison, expectedAssessment, expectedPredictionAssessment,
    learnerStatus: correct ? 'correct' : 'incorrect', activityCompletionEligible: correct,
    currentLinkPass: later.observation.usableLink, weatherCausationProven: false, throughputProven: false,
    wholeRouteProven: false, independentMasteryProven: false, repaired: false, progressAward: 0, attemptPenalty: 0,
  }] };
}

/**
 * Proposed post-acceptance replay baseline, NOT an award operation. Call only
 * after the actual reducer accepts MG03's complete two-effect batch. Preserve
 * entry configuration/inventory; do not adopt the entire changed current world.
 */
export function scoutReplayPreparation(entry: WorldState, game: GameState): WorldState {
  const completion = q<'achievement'>('ACHIEVEMENT-MG03-complete');
  const earned = game.world.achievementIds.includes(completion) && game.notebook.factIds.includes(q('FACT-MG03-completion'));
  return structuredClone({ ...entry, achievementIds: earned && !entry.achievementIds.includes(completion)
    ? [...entry.achievementIds, completion] : entry.achievementIds });
}
