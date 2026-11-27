// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import { contentError, invalidInput, isRecord } from '../domain/evaluate';
import { captureScoutPrediction, evaluateScoutComparison, scoutSelectionAction, scoutPredictionCurrent, scoutEvidence, type RadioChannelScout, type ScoutChoice, type ScoutPrediction, type ScoutComparisonInput, type ScoutAssessment } from './optional-channel-scout';
import { evaluateSymbolAnswer } from '../domain/packet-journey';
import { evaluateBenchAnswer, evaluateCompatibilityCard, type OpticalBenchAnswer, type OpticalBudgetBench } from './optional-optical-bench';
import { evaluateAuditAnswer } from './optional-power-audit';
import type { DeliveredPowerAudit, PowerAuditAnswer } from './optional-power-audit';
import { evaluateMaintenanceAnswer, maintenanceSubmission, type MaintenanceActivity, type MaintenanceAnswer } from './optional-maintenance';
import { evaluateDiaryAnswer, radioDiaryEvidence } from './optional-radio-diary';
import type { RadioDiaryActivity, RadioDiarySubmission } from './optional-radio-diary';
import type { ToySample, ToySymbolProfile } from '../domain/packet-journey';
import type { AttemptId, ConfigurationRevision, DomainAction, EvaluationResult, EvaluationStatus, HintId, MinigameId, QualifiedId, QuestId } from '../domain/types';
import type { EffectBinding, StateEffect } from './reducer';
import { conditionSatisfied, minigameAchievement } from './conditions';
import type { ActivityState, ClientGeneration, GameState, HintLevel, HintUse, SafeState, WorldState } from './types';
import { optionalActivityContentIssues } from '../content/optional-activities';
export { optionalActivityContentIssues, optionalRewardAllocationMatches } from '../content/optional-activities';

/** Closed reviewed variant. Additional activities require their own authored join. */
export interface ToyMessageActivity {
  readonly kind: 'toy-symbol-message';
  readonly speakerId: string;
  readonly instructions: readonly string[];
  readonly profileId: 'spec001:PROFILE-SYMBOLS';
  readonly practice: { readonly sourceCaseId: 'B-SYMBOL'; readonly samples: readonly ToySample[]; readonly explanation: string };
  readonly delivery: { readonly sourceCaseId: 'T12'; readonly actionId: string; readonly samples: readonly ToySample[] };
  readonly feedback: { readonly practice: ModeFeedback; readonly delivery: ModeFeedback; readonly contentError: string; readonly alreadyCompleted: string };
  readonly controls: { readonly practice: string; readonly delivery: string; readonly submit: string; readonly retry: string; readonly exit: string };
  readonly recovery: { readonly retryExplanation: string; readonly exitExplanation: string };
  readonly reward: { readonly kind: 'journal-illustration'; readonly factId: string; readonly assetId: string; readonly alternativeText: string; readonly unavailableText: string };
  readonly entryContexts: readonly OptionalEntry[];
  readonly returnPolicy: 'captured-entry';
  readonly timingDefault: 'off';
}
interface ModeFeedback { readonly correct: string; readonly incorrect: string; readonly invalidInput: string }
export interface OptionalEntry { readonly roomId: string; readonly safePositionId: string; readonly hotspotId: string }
export interface ToySymbolLoomActivity extends Omit<ToyMessageActivity, 'kind' | 'speakerId' | 'reward'> {
  readonly kind: 'toy-symbol-loom';
  readonly speakerId: 'spec001:CH21';
  readonly reward: { readonly kind: 'optional-practice-only'; readonly factId: 'spec001:FACT-MG01-completion' };
}
export type OptionalActivityDefinition = (Readonly<Omit<S.quest, 'optionalActivity'>> | Readonly<Omit<S.minigame, 'optionalActivity'>>)
  & { readonly optionalActivity: ToyMessageActivity | DeliveredPowerAudit | RadioDiaryActivity | MaintenanceActivity | ToySymbolLoomActivity | OpticalBudgetBench | RadioChannelScout };
export function isToySymbolActivity(activity: OptionalActivityDefinition['optionalActivity']): activity is ToyMessageActivity | ToySymbolLoomActivity {
  return activity.kind === 'toy-symbol-message' || activity.kind === 'toy-symbol-loom';
}
export type OptionalMode = 'practice' | 'delivery';
export interface OptionalActivitySession {
  readonly sessionId: string;
  readonly activityId: QualifiedId;
  readonly adventureId: GameState['adventureId'];
  readonly clientGeneration: ClientGeneration;
  readonly entry: OptionalEntry;
  readonly preparation: WorldState;
  readonly previousActivity: SafeState;
  readonly phase: 'instructions' | 'practice' | 'solving' | 'feedback';
  readonly mode: OptionalMode | null;
  readonly timingEnabled: false;
  readonly feedback: string | null;
  readonly result: EvaluationStatus | null;
  readonly hintText: string | null;
  readonly scout?: { readonly prediction: ScoutPrediction | null; readonly measurementId: string | null };
}
export type OptionalActivityOperation =
  | { readonly kind: 'scout-select'; readonly sessionId: string; readonly choice: ScoutChoice }
  | { readonly kind: 'scout-predict'; readonly sessionId: string; readonly baselineMeasurementId: string; readonly assessment: ScoutAssessment }
  | { readonly kind: 'scout-measure'; readonly sessionId: string; readonly id: import('../domain/types').MeasurementId }
  | ({ readonly kind: 'scout-compare'; readonly sessionId: string } & ScoutComparisonInput)
  | { readonly kind: 'start'; readonly activityId: QualifiedId; readonly hotspotId: QualifiedId; readonly sessionId: string }
  | { readonly kind: 'choose-mode'; readonly sessionId: string; readonly mode: OptionalMode }
  | { readonly kind: 'submit'; readonly sessionId: string; readonly bits: string }
  | { readonly kind: 'submit-power'; readonly sessionId: string; readonly answer: PowerAuditAnswer | { readonly assessment: null; readonly difference: null } }
  | { readonly kind: 'submit-maintenance'; readonly sessionId: string; readonly answer: MaintenanceAnswer }
  | { readonly kind: 'submit-diary'; readonly sessionId: string; readonly answer: RadioDiarySubmission }
  | { readonly kind: 'submit-optics'; readonly sessionId: string; readonly answer: OpticalBenchAnswer | null }
  | { readonly kind: 'compatibility-cards'; readonly sessionId: string }
  | { readonly kind: 'hint' | 'explanation' | 'boundary-example' | 'exit'; readonly sessionId: string }
  | { readonly kind: 'retry'; readonly sessionId: string; readonly nextAttemptId: AttemptId };
export type OptionalActivityPreparation = { readonly ok: false; readonly reason: 'content-error' | 'invalid-input' | 'invalid-state' | 'precondition' }
  | { readonly ok: true; readonly game: GameState; readonly session: OptionalActivitySession | null;
      readonly activity: ActivityState | { readonly kind: 'active-optional' };
      readonly evaluation: EvaluationResult<unknown, StateEffect>;
      readonly radio?: { readonly kind: 'select'; readonly actionId: QualifiedId } | { readonly kind: 'measure'; readonly id: import('../domain/types').MeasurementId };
      readonly retry?: { readonly preparation: WorldState; readonly nextAttemptId: AttemptId } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const qualified = /^spec001:[A-Za-z0-9][A-Za-z0-9._-]{0,55}$/;
const safe = new Set<string>(['stable-exploration', 'safe-preparation', 'safe-continue']);
const empty = (): EvaluationResult<unknown, StateEffect> => ({ status: 'correct', reasonCode: 'optional-activity-transition', observations: [], acceptedEffects: [] });
function freeze<T>(value: T): T { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const exact = (value: Record<string, unknown>, keys: readonly string[]) => Object.keys(value).length === keys.length && Object.keys(value).every(key => keys.includes(key));
const text = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 4096;

export function optionalActivityDefinition(registry: ContentRegistry, id: string): OptionalActivityDefinition | null {
  const record = registry.record(id);
  return record?.id !== id || optionalActivityContentIssues(record, registry).length ? null : record as OptionalActivityDefinition;
}
export function optionalEffectBindings(definition: OptionalActivityDefinition): readonly EffectBinding[] {
  return [...definition.effects, ...definition.alternatives.flatMap(a => a.effects)].map(effect => ({ sourceId: definition.id as QualifiedId,
    effectId: effect.effectId as StateEffect['effectId'], mode: 'once', receipt: definition.kind === 'quest' ? { kind: 'quest', id: definition.id as QuestId } : { kind: 'minigame', id: definition.id as MinigameId } }));
}
export function optionalActivityCompleted(registry: ContentRegistry, definition: OptionalActivityDefinition, game: GameState): boolean {
  const record = registry.record(definition.id);
  if (record?.id !== definition.id || record.kind !== definition.kind) return false;
  if (definition.kind === 'quest') return registry.has('quest', definition.id) && game.world.completedQuestIds.includes(definition.id as QuestId);
  const achievement = minigameAchievement(registry, definition.id);
  return achievement !== null && achievement === definition.completionAchievementId && game.world.achievementIds.includes(achievement);
}
export function evaluateOptionalAnswer(registry: ContentRegistry, definition: OptionalActivityDefinition, mode: OptionalMode,
  action: DomainAction<unknown>, game: GameState): {
    readonly evaluation: EvaluationResult<unknown, StateEffect>; readonly feedback: string; readonly assistanceLevel: HintLevel | null;
  } {
  const activity = definition.optionalActivity;
  if (optionalActivityContentIssues(definition, registry).length) return { evaluation: contentError({ code: 'optional-content', field: definition.id, message: 'The optional exhibit needs correction.' }),
    feedback: text(activity?.feedback?.contentError) ? activity.feedback.contentError : 'This exhibit needs correction. You can leave safely.', assistanceLevel: null };
  const profile = ('profileId' in activity ? registry.record(activity.profileId) : null) as S.profile;
  const result = isToySymbolActivity(activity) ? evaluateSymbolAnswer({ profile: { id: profile.id, parameters: profile.parameters } as ToySymbolProfile,
    samples: activity[mode].samples }, action as DomainAction<{ readonly bits: string }>, game.world)
    : activity.kind === 'delivered-power-audit' ? evaluateAuditAnswer({ sourceCaseId: activity[mode].sourceCaseId, demands: activity[mode].demands, budgetBoundary: activity[mode].budgetBoundary,
      demandBoundary: activity[mode].demandBoundary, otherConstraints: true }, { id: profile.id, parameters: profile.parameters }, action, game.world)
    : activity.kind === 'optical-budget-bench' ? evaluateBenchAnswer({ sourceCaseId: activity[mode].sourceCaseId, compatible: activity[mode].compatible, loss: activity[mode].loss },
      { id: profile.id, parameters: profile.parameters }, action, game.world)
    : activity.kind === 'notebook-combination' ? evaluateMaintenanceAnswer(activity, registry, mode, action, game)
    : activity.kind === 'radio-weather-diary' ? mode === 'delivery' ? evaluateDiaryAnswer(activity.delivery, registry, action, game) : invalidInput('diary-practice-is-read-only')
    : contentError({ code: 'optional-content', field: definition.id, message: 'Unsupported optional activity.' });
  if (activity.kind === 'radio-channel-scout') return { evaluation: contentError({ code: 'radio-requires-session', field: definition.id, message: 'Use the captured radio session.' }), feedback: activity.feedback.contentError, assistanceLevel: null };
  const feedback = result.status === 'content-error' ? activity.feedback.contentError : activity.feedback[mode][result.status === 'invalid-input' ? 'invalidInput' : result.status];
  const completed = optionalActivityCompleted(registry, definition, game);
  const alternative = definition.alternatives.find(a => a.id === activity.delivery.actionId)!;
  const effects = mode === 'delivery' && result.status === 'correct' && !completed && conditionSatisfied(definition.prerequisite, game.world, registry)
    && conditionSatisfied(alternative.condition, game.world, registry) ? [...definition.effects, ...alternative.effects] as StateEffect[] : [];
  return { evaluation: result.status === 'correct' ? { ...result, acceptedEffects: effects } : result, feedback: mode === 'delivery' && result.status === 'correct' && completed ? activity.feedback.alreadyCompleted : feedback,
    assistanceLevel: mode === 'practice' && (result.status === 'correct' || result.status === 'incorrect') ? 2 : mode === 'delivery' && result.status === 'incorrect' ? 3 : null };
}

function assistance(game: GameState, definition: OptionalActivityDefinition, level: HintLevel): GameState | null {
  const hint = [definition.hints.method, definition.hints.workedStep, definition.hints.solution][level - 1]!;
  if (game.assistance.some(h => h.objectiveId === definition.id && h.hintId === hint.id && h.attemptId === game.world.attemptId)) return game;
  if (game.assistance.length >= 2048) return null;
  // The v1 legacy wire key remains objectiveId; the approved policy join treats
  // it explicitly as a lesson source, never as completed-objective membership.
  const used: HintUse = { objectiveId: definition.id as HintUse['objectiveId'], hintId: hint.id as HintId, level, attemptId: game.world.attemptId };
  return { ...game, assistance: [...game.assistance, used] };
}
/** Call only after the reducer accepts the complete batch; preserve entry equipment. */
export function finalizeOptionalSession(session: OptionalActivitySession | null, game: GameState, registry: ContentRegistry): OptionalActivitySession | null {
  if (!session || session.adventureId !== game.adventureId || session.mode !== 'delivery' || session.result !== 'correct') return session;
  const definition = optionalActivityDefinition(registry, session.activityId);
  if (!definition || !optionalActivityCompleted(registry, definition, game)
    || !game.notebook.factIds.some(id => id === definition.optionalActivity.reward.factId)) return session;
  // Advance only this activity's actual receipt. Entry flags, tools, route and
  // unrelated progress stay captured; facts/notes/help live outside this world.
  const preparation = session.preparation;
  if (definition.kind === 'quest') {
    const id = definition.id as QuestId;
    if (preparation.completedQuestIds.includes(id)) return session;
    return freeze({ ...session, preparation: { ...structuredClone(preparation), completedQuestIds: [...preparation.completedQuestIds, id] } });
  }
  const id = minigameAchievement(registry, definition.id);
  if (!id || preparation.achievementIds.includes(id)) return session;
  return freeze({ ...session, preparation: { ...structuredClone(preparation), achievementIds: [...preparation.achievementIds, id] } });
}
/** Shared recovery primitive; callers install the result in the same reducer CAS. */
export function rewindOptionalPreparation(game: GameState, session: OptionalActivitySession, nextAttemptId: AttemptId,
  history: { readonly highestRevision: number; readonly usedAttemptIds: readonly AttemptId[] }):
  { readonly ok: false; readonly reason: 'invalid-input' | 'generation-exhausted' | 'attempt-reused' }
  | { readonly ok: true; readonly game: GameState; readonly highestRevision: number; readonly usedAttemptIds: readonly AttemptId[] } {
  if (session.adventureId !== game.adventureId || session.entry.roomId !== game.world.roomId || session.entry.safePositionId !== game.world.position.safePositionId
    || !uuid.test(nextAttemptId)) return { ok: false, reason: 'invalid-input' };
  const normalized = nextAttemptId.toLowerCase() as AttemptId;
  const previous = [...history.usedAttemptIds, game.world.attemptId, session.preparation.attemptId, ...game.notebook.measurements.map(m => m.attemptId), ...game.assistance.map(h => h.attemptId), ...game.outcomeHistory.map(o => o.attemptId)];
  if (previous.some(id => id.toLowerCase() === normalized)) return { ok: false, reason: 'attempt-reused' };
  const revisions = [history.highestRevision, game.world.configurationRevision, session.preparation.configurationRevision, ...game.notebook.measurements.map(m => m.configurationRevision)];
  if (revisions.some(n => !Number.isSafeInteger(n) || n < 0 || n >= 2_147_483_647)) return { ok: false, reason: 'generation-exhausted' };
  const revision = Math.max(...revisions) + 1;
  return { ok: true, highestRevision: revision, usedAttemptIds: [...new Set([...previous.map(id => id.toLowerCase() as AttemptId), normalized])],
    game: { ...game, world: { ...structuredClone(session.preparation), attemptId: normalized, configurationRevision: revision as ConfigurationRevision },
      notebook: { ...game.notebook, measurements: game.notebook.measurements.map(measurement => ({ ...measurement, stale: true })) } } };
}
export function prepareOptionalActivityChange(registry: ContentRegistry, game: GameState,
  activity: ActivityState | { readonly kind: 'active-optional' }, session: OptionalActivitySession | null,
  operation: OptionalActivityOperation, action: DomainAction<unknown> | undefined, clientGeneration: ClientGeneration): OptionalActivityPreparation {
  const fail = (reason: 'content-error' | 'invalid-input' | 'invalid-state' | 'precondition'): OptionalActivityPreparation => ({ ok: false, reason });
  if (!isRecord(operation) || !Number.isSafeInteger(clientGeneration) || clientGeneration < 0) return fail('invalid-input');
  const fields: Record<OptionalActivityOperation['kind'], readonly string[]> = { 'scout-select': ['kind','sessionId','choice'], 'scout-predict': ['kind','sessionId','baselineMeasurementId','assessment'], 'scout-measure': ['kind','sessionId','id'], 'scout-compare': ['kind','sessionId','laterMeasurementId','comparison','currentAssessment','predictionAssessment','evidenceClaim'], start: ['kind', 'activityId', 'hotspotId', 'sessionId'],
    'choose-mode': ['kind', 'sessionId', 'mode'], submit: ['kind', 'sessionId', 'bits'], 'submit-power': ['kind', 'sessionId', 'answer'], 'submit-diary': ['kind', 'sessionId', 'answer'], 'submit-maintenance': ['kind', 'sessionId', 'answer'], 'submit-optics': ['kind', 'sessionId', 'answer'], 'compatibility-cards': ['kind', 'sessionId'], hint: ['kind', 'sessionId'], explanation: ['kind', 'sessionId'], 'boundary-example': ['kind', 'sessionId'], exit: ['kind', 'sessionId'], retry: ['kind', 'sessionId', 'nextAttemptId'] };
  if (!Object.hasOwn(fields, operation.kind) || !exact(operation, fields[operation.kind]) || !uuid.test(operation.sessionId)) return fail('invalid-input');
  if (operation.kind === 'start') {
    if (session || !safe.has(activity.kind) || !qualified.test(operation.activityId) || !qualified.test(operation.hotspotId)) return fail('invalid-state');
    const definition = optionalActivityDefinition(registry, operation.activityId);
    if (!definition) return fail('content-error');
    const entry = definition.optionalActivity.entryContexts.find(e => e.roomId === game.world.roomId && e.safePositionId === game.world.position.safePositionId && e.hotspotId === operation.hotspotId);
    const anchor = entry && registry.safePosition(entry.safePositionId);
    if (!entry || !anchor?.eligibleStates.includes(activity.kind as SafeState) || !conditionSatisfied(definition.prerequisite, game.world, registry)) return fail('precondition');
    return { ok: true, game, activity: { kind: 'active-optional' }, evaluation: empty(), session: freeze({ sessionId: operation.sessionId, activityId: operation.activityId,
      adventureId: game.adventureId, clientGeneration, entry: structuredClone(entry), preparation: structuredClone(game.world), previousActivity: activity.kind as SafeState,
      phase: 'instructions', mode: null, timingEnabled: false, feedback: null, result: null, hintText: null, ...(definition.optionalActivity.kind === 'radio-channel-scout' ? { scout: { prediction: null, measurementId: null } } : {}) }) };
  }
  if (!session || session.sessionId !== operation.sessionId || session.adventureId !== game.adventureId || session.clientGeneration !== clientGeneration || activity.kind !== 'active-optional'
    || game.world.roomId !== session.entry.roomId || game.world.position.safePositionId !== session.entry.safePositionId) return fail('invalid-state');
  // Exit always remains available for a matching owned session, even if its
  // content is no longer usable. It changes no world, measurement or checkpoint.
  if (operation.kind === 'exit') return { ok: true, game, session: null, activity: { kind: session.previousActivity }, evaluation: empty() };
  const definition = optionalActivityDefinition(registry, session.activityId);
  if (!definition) return fail('content-error');
  const success = (next: OptionalActivitySession, nextGame = game, evaluation = empty()): Extract<OptionalActivityPreparation, { ok: true }> => ({ ok: true, game: nextGame, session: freeze(next), activity, evaluation });
  if (operation.kind === 'choose-mode') {
    if (!['practice', 'delivery'].includes(operation.mode)) return fail('invalid-input');
    if (definition.optionalActivity.kind === 'notebook-combination' && operation.mode === 'practice') {
      const nextGame = assistance(game, definition, 2);
      return nextGame ? success({ ...session, mode: 'practice', phase: 'practice', feedback: definition.optionalActivity.practice.explanation, result: null, hintText: null }, nextGame) : fail('invalid-state');
    }
    if (definition.optionalActivity.kind === 'radio-weather-diary') {
      if (operation.mode === 'practice') {
        const nextGame = assistance(game, definition, 2);
        return nextGame ? success({ ...session, mode: 'practice', phase: 'practice', feedback: definition.optionalActivity.practice.explanation,
          result: null, hintText: null }, nextGame) : fail('invalid-state');
      }
      if (!radioDiaryEvidence(registry, game).available) return success({ ...session, mode: null, phase: 'instructions',
        feedback: definition.optionalActivity.feedback.missingEvidence, result: null, hintText: null });
    }
    if (definition.optionalActivity.kind === 'radio-channel-scout') {
      const a = definition.optionalActivity, next = operation.mode === 'practice' ? assistance(game, definition, 2) : game;
      if (!next) return fail('invalid-state');
      return success({ ...session, mode: operation.mode, phase: operation.mode === 'practice' ? 'practice' : 'solving', result: null, hintText: null, scout: { prediction: null, measurementId: null },
        feedback: operation.mode === 'practice' ? a.practice.explanation : scoutEvidence(registry, game).length ? null : a.feedback.missingEvidence }, next);
    }
    return success({ ...session, mode: operation.mode, phase: operation.mode === 'practice' ? 'practice' : 'solving', feedback: null, result: null, hintText: null });
  }
  if (operation.kind === 'retry') {
    if (!uuid.test(operation.nextAttemptId) || operation.nextAttemptId.toLowerCase() === game.world.attemptId.toLowerCase()) return fail('invalid-input');
    return { ...success({ ...session, phase: 'instructions', mode: null, feedback: null, result: null, hintText: null, ...(session.scout ? { scout: { prediction: null, measurementId: null } } : {}) }),
      retry: { preparation: session.preparation, nextAttemptId: operation.nextAttemptId } } as OptionalActivityPreparation;
  }
  if (operation.kind === 'boundary-example') {
    if (definition.optionalActivity.kind !== 'delivered-power-audit' && definition.optionalActivity.kind !== 'optical-budget-bench') return fail('invalid-input');
    const nextGame = assistance(game, definition, 2);
    return nextGame ? success({ ...session, hintText: definition.optionalActivity.boundaryExample.explanation }, nextGame) : fail('invalid-state');
  }
  if (operation.kind === 'compatibility-cards') {
    const exhibit = definition.optionalActivity;
    if (exhibit.kind !== 'optical-budget-bench' || !action) return fail('invalid-input');
    for (const card of exhibit.compatibilityCards) {
      const result = evaluateCompatibilityCard({ sourceCaseId: card.sourceCaseId, premises: card.premises }, { ...action, input: { kind: 'inspect-card' } }, game.world);
      if (result.status === 'content-error' || result.status === 'invalid-input') return fail(result.status);
    }
    const nextGame = assistance(game, definition, 2);
    return nextGame ? success({ ...session, hintText: exhibit.compatibilityCards.map(card => card.explanation).join('\n\n') }, nextGame) : fail('invalid-state');
  }
  if (operation.kind === 'hint' || operation.kind === 'explanation') {
    const used = game.assistance.filter(h => h.objectiveId === definition.id).reduce<number>((max, hint) => Math.max(max, hint.level), 0);
    const level = (operation.kind === 'explanation' ? session.mode === 'practice' ? 2 : 3 : Math.min(3, used + 1)) as HintLevel;
    const hintText = operation.kind === 'explanation' ? session.mode === 'practice' ? definition.optionalActivity.practice.explanation
      : optionalActivityCompleted(registry, definition, game) ? definition.completionExplanation : definition.hints.solution.text
      : [definition.hints.method.text, definition.hints.workedStep.text, definition.hints.solution.text][level - 1]!;
    const nextGame = assistance(game, definition, level);
    return nextGame ? success({ ...session, hintText }, nextGame) : fail('invalid-state');
  }
  if (operation.kind.startsWith('scout-')) {
    const a = definition.optionalActivity;
    if (a.kind !== 'radio-channel-scout' || session.mode !== 'delivery' || !session.scout || !action) return fail('invalid-input');
    if (operation.kind === 'scout-select') {
      const actionId = scoutSelectionAction(operation.choice); if (!actionId) return fail('invalid-input');
      return { ...success({ ...session, phase: 'solving', result: null, feedback: 'Configuration selected. Record a prediction, then take a new measurement.', scout: { prediction: null, measurementId: null } }), radio: { kind: 'select', actionId } };
    }
    if (operation.kind === 'scout-predict') {
      const result = captureScoutPrediction(a.delivery, registry, { ...action, input: { baselineMeasurementId: operation.baselineMeasurementId, assessment: operation.assessment } }, game);
      return success({ ...session, phase: 'solving', result: result.status === 'correct' ? null : result.status,
        feedback: result.status === 'correct' ? a.feedback.predictionRecorded : a.feedback.freshMeasurementRequired,
        scout: { prediction: result.status === 'correct' ? result.observations[0] as ScoutPrediction : null, measurementId: null } });
    }
    if (operation.kind === 'scout-measure') {
      if (!uuid.test(operation.id) || !scoutPredictionCurrent(registry, session.scout.prediction, game)) return fail('invalid-input');
      return { ...success({ ...session, phase: 'solving', result: null, feedback: 'New observation recorded. Compare its SNR with the earlier reading and your prediction.', scout: { ...session.scout, measurementId: operation.id } }), radio: { kind: 'measure', id: operation.id } };
    }
    if (operation.kind === 'scout-compare') {
      const { kind: _kind, sessionId: _sessionId, ...answer } = operation;
      const result = evaluateScoutComparison(a.delivery, registry, session.scout.prediction, { ...action, input: answer }, game);
      const complete = optionalActivityCompleted(registry, definition, game);
      const next = result.status === 'incorrect' ? assistance(game, definition, 3) : game;
      if (!next) return fail('invalid-state');
      const feedback = result.status === 'content-error' ? a.feedback.contentError : result.status === 'invalid-input' ? a.feedback.freshMeasurementRequired
        : result.status === 'incorrect' ? a.feedback.incorrect : complete ? a.feedback.alreadyCompleted : `${a.feedback.correct} Your prediction was ${operation.predictionAssessment === 'supported' ? 'supported' : 'not supported'} by the new observation.`;
      const evaluation: EvaluationResult<unknown, StateEffect> = result.status === 'correct' ? { ...result, acceptedEffects: !complete ? definition.effects as StateEffect[] : [] } : result;
      return success({ ...session, phase: 'feedback', result: result.status, feedback }, next, evaluation);
    }
    return fail('invalid-input');
  }
  if (!session.mode || !action || (operation.kind !== 'submit' && operation.kind !== 'submit-power' && operation.kind !== 'submit-diary' && operation.kind !== 'submit-maintenance' && operation.kind !== 'submit-optics')) return fail('invalid-input');
  if (operation.kind === 'submit' && (!isToySymbolActivity(definition.optionalActivity) || typeof operation.bits !== 'string' || operation.bits.length > 512)
    || operation.kind === 'submit-power' && definition.optionalActivity.kind !== 'delivered-power-audit'
    || operation.kind === 'submit-optics' && definition.optionalActivity.kind !== 'optical-budget-bench'
    || operation.kind === 'submit-maintenance' && (definition.optionalActivity.kind !== 'notebook-combination' || !maintenanceSubmission(operation.answer))
    || operation.kind === 'submit-diary' && (definition.optionalActivity.kind !== 'radio-weather-diary' || session.mode !== 'delivery')) return fail('invalid-input');
  const result = evaluateOptionalAnswer(registry, definition, session.mode, { ...action, input: operation.kind === 'submit' ? { bits: operation.bits } : operation.answer }, game);
  const nextGame = result.assistanceLevel ? assistance(game, definition, result.assistanceLevel) : game;
  return nextGame ? success({ ...session, phase: 'feedback', feedback: result.feedback, result: result.evaluation.status }, nextGame, result.evaluation) : fail('invalid-state');
}
