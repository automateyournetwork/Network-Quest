// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual diary uses existing canonical measurements; it creates no physical evidence.
import type * as S from '../content/schema-types.generated';
import type { ContentRegistry } from '../content/registry';
import { contentError, invalidInput, isRecord } from '../domain/evaluate';
import { evaluateRadio, type RadioProfile, type RadioObservation, type RadioPower } from '../domain/radio';
import type { ActionId, DomainAction, EvaluationResult, QualifiedId } from '../domain/types';
import type { GameState, Measurement } from './types';
import { createRadioScenarioResolver } from './radio-scenario';
import { isHistoricalObjectiveMeasurement } from './objective-history';
import reviewed from '../../content/spec001/sources.json' with { type: 'json' };

export type RadioDiaryActivity = Readonly<S.optionalRadioDiary>;
export type RadioDiarySubmission = { readonly [K in keyof RadioDiaryAnswer]: RadioDiaryAnswer[K] | null };
export interface RadioDiaryAnswer {
  readonly earlierMeasurementId: string;
  readonly laterMeasurementId: string;
  readonly comparison: 'increased' | 'unchanged' | 'decreased';
  readonly currentAssessment: 'meets-threshold' | 'below-threshold';
  readonly evidenceClaim: 'current-reading-only-no-cause' | 'earlier-proves-current' | 'weather-proven' | 'throughput-proven';
}
export interface RadioDiaryDelivery {
  readonly actionId: 'spec001:ACTION-SQ03-compare';
  readonly sourceCaseIds: readonly ['T08', 'T09', 'B-RADIO-20', 'B-RADIO-BELOW'];
  readonly measurementObjectiveId: 'spec001:O08';
  readonly measurementRuleId: 'spec001:PHY07';
  readonly measurementRoomId: 'spec001:R08';
  readonly historicalUse: 'comparison-only';
  readonly currentRequired: true;
  readonly order: 'strictly-increasing-configuration-revision';
}
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(k => keys.includes(k));
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// These source cases cover the actual accepted O08 resolver's supplied power
// states. They are not provenance fields invented for earned measurements.
const roomSourceIds = ['T08', 'T09', 'B-RADIO-20', 'B-RADIO-BELOW'] as const;
const sourceCases = [...reviewed.referenceCases, ...reviewed.reviewCases];
const names = ['Viable path', 'Compatible settings', 'Received signal', 'Received noise', 'Signal-to-noise ratio', 'Required signal-to-noise ratio'];
const units = ['count', 'count', 'dBm', 'dBm', 'dB', 'dB'];
const error = (field: string) => contentError({ code: 'radio-diary-content', field, message: 'The diary requires its reviewed source content and intact original observations.' });
type Measured = Extract<RadioObservation, { readonly kind: 'radio-link' }> & { readonly snrProven: true };
interface CheckedRecord { readonly record: Measurement; readonly observation: Measured; readonly physicalStatus: 'correct' | 'incorrect' }

/** Re-check a stored record at its original version. Never create, freshen or save it. */
function checkedRecord(registry: ContentRegistry, game: GameState, profile: RadioProfile, value: Measurement): CheckedRecord | null {
  const objective = registry.record(q('O08'));
  if (objective?.kind !== 'objective' || !value || !uuid.test(value.id) || !uuid.test(value.attemptId)
    || value.ruleId !== q('PHY07') || value.roomId !== q('R08') || typeof value.stale !== 'boolean' || typeof value.conclusionCode !== 'string'
    || !Number.isSafeInteger(value.configurationRevision) || value.configurationRevision < 0
    || value.configurationRevision > game.world.configurationRevision || !Array.isArray(value.subjectIds) || !Array.isArray(value.readings)
    || value.readings.length !== names.length || !value.readings.every((r, i) => isRecord(r) && exact(r, ['name', 'value', 'unit'])
      && r['name'] === names[i] && r['unit'] === units[i] && typeof r['value'] === 'number' && Number.isFinite(r['value']))) return null;
  const status = value.conclusionCode.endsWith(':correct') ? 'correct' : value.conclusionCode.endsWith(':incorrect') ? 'incorrect' : null;
  if (!status || !isHistoricalObjectiveMeasurement(registry, game, q('O08'), value, status)
    || value.readings[0]!.value !== 1 || value.readings[1]!.value !== 1) return null;
  const reference = roomSourceIds.map(id => sourceCases.find(c => c.id === id)).find(c => c && 'signal' in c.inputs && 'noise' in c.inputs
    && c.inputs.signal.value === value.readings[2]!.value && c.inputs.noise.value === value.readings[3]!.value);
  if (!reference || !('signal' in reference.inputs) || !('noise' in reference.inputs)) return null;
  // This envelope is solely an integrity recheck of original facts; returned
  // observations keep that original version and never become current evidence.
  const evaluated = evaluateRadio({ kind: 'radio-link', profile, viablePath: true, settingsCompatible: true,
    signal: reference.inputs.signal as RadioPower, noise: reference.inputs.noise as RadioPower }, {
    actionId: 'diary-historical-integrity' as ActionId, expectedVersion: value, input: { kind: 'measure-link' },
  }, value);
  const observation = evaluated.observations[0];
  if ((evaluated.status !== 'correct' && evaluated.status !== 'incorrect') || !observation || observation.kind !== 'radio-link' || !observation.snrProven
    || observation.snr.value !== value.readings[4]!.value || observation.minimum.value !== value.readings[5]!.value
    || !objective.alternatives.some(a => value.conclusionCode === `O08:${a.id.split(':')[1]}:${evaluated.status}`)) return null;
  // Channel B supplies the 20 dB boundary; surveyed channel A supplies 25 dB.
  // Raised-noise13 is independently supplied on either channel by T080.
  if (reference.id === 'T08' && !value.conclusionCode.includes('scenario-channel-A:')
    || reference.id === 'B-RADIO-20' && !value.conclusionCode.includes('scenario-channel-B:')) return null;
  return { record: value, observation, physicalStatus: evaluated.status };
}

/** Current evidence is checked against the actual current resolver, not merely a fresh flag. */
function currentRecordMatches(registry: ContentRegistry, game: GameState, checked: CheckedRecord): boolean {
  const m = checked.record;
  if (m.stale || m.configurationRevision !== game.world.configurationRevision || m.attemptId !== game.world.attemptId) return false;
  const current = createRadioScenarioResolver(registry)(game, q('O08'));
  return current?.kind === 'radio-proof' && current.path.viablePath && current.path.settingsCompatible
    && current.path.signal.value === checked.observation.signal.value && current.path.signal.unit === 'dBm'
    && current.path.noise.value === checked.observation.noise.value && current.path.noise.unit === 'dBm'
    && m.conclusionCode === `O08:${current.alternativeId.split(':')[1]}:${checked.physicalStatus}`;
}

/** Read-only selection view. Missing actual evidence never becomes a sample. */
export function radioDiaryEvidence(registry: ContentRegistry, game: GameState) {
  const profileRecord = registry.record(q('PROFILE-RADIO'));
  const profile = (profileRecord?.kind === 'profile' ? { id: profileRecord.id, parameters: profileRecord.parameters } : null) as RadioProfile;
  const records = game.notebook.measurements.flatMap(record => {
    const checked = checkedRecord(registry, game, profile, record);
    return checked ? [{ ...checked, current: currentRecordMatches(registry, game, checked) }] : [];
  });
  const latest = records.filter(row => row.current).at(-1);
  const earlier = latest ? records.filter(row => row.record.configurationRevision < latest.record.configurationRevision
    && game.notebook.measurements.indexOf(row.record) < game.notebook.measurements.indexOf(latest.record)) : [];
  return { records, earlier, latest: earlier.length ? latest ?? null : null, available: earlier.length > 0 };
}

/** An adapter over actual notebook records and evaluateRadio. No effects or measurements are returned. */
export function evaluateDiaryAnswer(delivery: unknown, registry: ContentRegistry, action: DomainAction<unknown>, game: GameState): EvaluationResult<unknown, never> {
  const expected: RadioDiaryDelivery = { actionId: 'spec001:ACTION-SQ03-compare', sourceCaseIds: ['T08', 'T09', 'B-RADIO-20', 'B-RADIO-BELOW'],
    measurementObjectiveId: 'spec001:O08', measurementRuleId: 'spec001:PHY07', measurementRoomId: 'spec001:R08',
    historicalUse: 'comparison-only', currentRequired: true, order: 'strictly-increasing-configuration-revision' };
  if (!isRecord(delivery) || !exact(delivery, Object.keys(expected)) || Object.entries(expected).some(([key, value]) => JSON.stringify(delivery[key]) !== JSON.stringify(value))) return error('delivery');
  const record = registry.record(q('PROFILE-RADIO'));
  const profile = (record?.kind === 'profile' && record.reviewedProfileId === record.id ? { id: record.id, parameters: record.parameters } : null) as RadioProfile;
  const boundary = sourceCases.find(c => c.id === 'B-RADIO-20');
  if (!boundary || !('signal' in boundary.inputs) || !('noise' in boundary.inputs)) return error('sourceCaseIds');
  // Run the existing content/envelope checks before learner input. This is a
  // worked source-card calculation, never an earned notebook measurement.
  const envelope = evaluateRadio({ kind: 'radio-snr', profile, signal: boundary.inputs.signal as RadioPower, noise: boundary.inputs.noise as RadioPower, otherPathChecks: true },
    (isRecord(action) ? { ...action, input: { kind: 'measure-snr' } } : action) as DomainAction<{ kind: 'measure-snr' }>, game.world);
  if (envelope.status === 'content-error' || envelope.status === 'invalid-input') return envelope;
  const answer = action.input;
  if (!isRecord(answer) || !exact(answer, ['earlierMeasurementId', 'laterMeasurementId', 'comparison', 'currentAssessment', 'evidenceClaim'])
    || typeof answer['earlierMeasurementId'] !== 'string' || !uuid.test(answer['earlierMeasurementId'])
    || typeof answer['laterMeasurementId'] !== 'string' || !uuid.test(answer['laterMeasurementId'])
    || typeof answer['comparison'] !== 'string' || !['increased', 'unchanged', 'decreased'].includes(answer['comparison'])
    || typeof answer['currentAssessment'] !== 'string' || !['meets-threshold', 'below-threshold'].includes(answer['currentAssessment'])
    || typeof answer['evidenceClaim'] !== 'string' || !['current-reading-only-no-cause', 'earlier-proves-current', 'weather-proven', 'throughput-proven'].includes(answer['evidenceClaim'])) return invalidInput('malformed-diary-answer');
  const before = game.notebook.measurements.filter(m => m.id === answer['earlierMeasurementId']);
  const after = game.notebook.measurements.filter(m => m.id === answer['laterMeasurementId']);
  if (before.length === 0 || after.length === 0) return invalidInput('diary-missing-evidence');
  if (before.length !== 1 || after.length !== 1) return error('duplicate-measurement-id');
  const earlier = checkedRecord(registry, game, profile, before[0]!);
  const later = checkedRecord(registry, game, profile, after[0]!);
  if (!earlier || !later) return error('measurement-provenance');
  if (earlier.record.id === later.record.id || earlier.record.configurationRevision >= later.record.configurationRevision
    || game.notebook.measurements.indexOf(earlier.record) >= game.notebook.measurements.indexOf(later.record)) return invalidInput('diary-record-order');
  if (!currentRecordMatches(registry, game, later)) return invalidInput('diary-current-measurement-required');
  const latestCurrent = game.notebook.measurements.filter(m => m.ruleId === q('PHY07') && m.subjectIds.includes(q('O08')) && m.roomId === q('R08')
    && !m.stale && m.configurationRevision === game.world.configurationRevision && m.attemptId === game.world.attemptId).at(-1);
  if (latestCurrent?.id !== later.record.id) return invalidInput('diary-latest-measurement-required');
  // All accepted O08 source values have at most two decimal places. Subtract
  // integer hundredths for an exact display delta (20→19.99 is -0.01). This
  // neither rounds nor replaces the actual evaluator's SNR/threshold decision.
  const change = (Math.round(later.observation.snr.value * 100) - Math.round(earlier.observation.snr.value * 100)) / 100;
  const expectedComparison = change < 0 ? 'decreased' : change > 0 ? 'increased' : 'unchanged';
  const expectedAssessment = later.observation.thresholdMet ? 'meets-threshold' : 'below-threshold';
  const correct = answer['comparison'] === expectedComparison && answer['currentAssessment'] === expectedAssessment && answer['evidenceClaim'] === 'current-reading-only-no-cause';
  return { status: correct ? 'correct' : 'incorrect', reasonCode: correct ? 'radio-diary-comparison-correct' : 'radio-diary-comparison-incorrect', acceptedEffects: [],
    observations: [{ kind: 'radio-diary-comparison', earlier: { ...earlier, use: 'historical-only', usableAsCurrent: false }, later,
      snrChange: { value: change, unit: 'dB' }, expectedComparison, expectedAssessment,
      currentLinkPass: later.observation.usableLink, learnerStatus: correct ? 'correct' : 'incorrect',
      weatherCausationProven: false, throughputProven: false, wholeRouteProven: false, repaired: false, progressAward: 0, attemptPenalty: 0 }] };
}
