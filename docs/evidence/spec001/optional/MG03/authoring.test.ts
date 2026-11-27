// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Actual evaluator/reducer and isolated proposed adapter. No common session/native claim.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import type * as S from '../../../../../src/content/schema-types.generated';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { createReducer, createReducerState, isMeasurementCurrent, type EffectBinding, type ReducerInput, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { radioEffectBindings, createRadioScenarioResolver, prepareRadioAction } from '../../../../../src/state/radio-scenario';
import { objectiveEffectBindings } from '../../../../../src/state/objectives';
import { rewindOptionalPreparation, prepareOptionalActivityChange, type OptionalActivitySession } from '../../../../../src/state/optional-activities';
import { conditionSatisfied } from '../../../../../src/state/conditions';
import { evaluateRadio, type RadioProfile } from '../../../../../src/domain/radio';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, MeasurementId, QualifiedId } from '../../../../../src/domain/types';
import type { GameState } from '../../../../../src/state/types';
import { captureScoutPrediction, evaluateScoutComparison, scoutSelectionAction, scoutReplayPreparation, type ScoutPrediction, type ScoutComparisonInput } from './channel-scout-proposal';
import candidate from './MG03.candidate.json' with { type: 'json' };
import projection from './MG03.current-schema.json' with { type: 'json' };
import baseline from './input-baseline.json' with { type: 'json' };

const read = (path: string) => readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
const oracle = json('tests/fixtures/optional-activities.json');
const physical = json('tests/fixtures/physical-cases.json');
const activity = candidate.optionalActivity;
const profile = json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-RADIO')) as RadioProfile;
const receipts: Record<string, unknown> = {};
function input(record: unknown = projection) {
  const world = json('content/spec001/world.json') as S.world;
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(path => [path, json(path)]));
  const path = 'content/spec001/minigames/MG03.json';
  world.documents = world.documents.filter(d => d.id !== q('MG03'));
  world.documents.push({ kind: 'minigame', id: q('MG03'), path }); documents[path] = record;
  return { world, sources: json('content/spec001/sources.json'), documents };
}
function registry() {
  const result = validateContent(input());
  if (!result.ok || !result.registry) throw new Error(`MG03 projection registry: ${JSON.stringify(result.issues)}`);
  return result.registry;
}
const proposalSchema = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/MG03/optional-activity.schema.json'));
function fixture() {
  const reg = registry(), initial = startIntroduction(createIntroductionRuntime(), reg), game = initial.game!;
  let state = createReducerState({ ...initial, game: { ...game, world: { ...game.world, flags: {},
    roomId: q('R07'), position: { safePositionId: q('R07.entry') }, completedObjectiveIds: [q('O01'), q('O02')],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...game.notebook, factIds: [], measurements: [], personalNotes: 'Compare observations; do not blame the weather.' } } });
  const effects = projection.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('MG03'), effectId: e.effectId, mode: 'once', receipt: { kind: 'minigame', id: q('MG03') } }));
  const resolver = createRadioScenarioResolver(reg);
  const reduce = createReducer({ registry: reg, bindings: [...radioEffectBindings(reg), ...objectiveEffectBindings(reg), ...bindings], objectiveScenario: resolver });
  const get = () => state.runtime.game!;
  let actions = 0;
  const send = (command: ReducerInput) => {
    const result = reduce(state, { actionId: `mg03-${++actions}` as ActionId, adventureId: get().adventureId, expectedVersion: get().world, input: command });
    if (result.status !== 'rejected') state = result.state;
    return result;
  };
  const choose = (name: string) => { const result = send({ kind: 'apply', evaluation: prepareRadioAction(reg, get(), q(`ACTION-radio-${name}`)) }); expect(result.status).not.toBe('rejected'); return result; };
  const measure = (objective: 'O07' | 'O08', n: number) => {
    const scenario = resolver(get(), q(objective)); if (!scenario) throw new Error('Missing actual scenario');
    const result = send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q(objective), alternativeId: scenario.alternativeId, id: id(n) } });
    expect(result.status).toBe('applied'); return result;
  };
  const submit = (objective: 'O07' | 'O08', n: number) => {
    const scenario = resolver(get(), q(objective)); if (!scenario) throw new Error('Missing actual scenario');
    return send({ kind: 'objective', operation: { kind: 'submit', objectiveId: q(objective), alternativeId: scenario.alternativeId, measurementId: id(n) } });
  };
  // Only the initial discovery and room arrival are prepared test scaffolding.
  // Both path and radio measurements below are actual reducer operations.
  choose('read-path'); choose('read-settings'); choose('align-existing'); choose('match-settings');
  measure('O07', 1); expect(submit('O07', 1).status).toBe('applied');
  send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'scoped-test-room-arrival', observations: [], acceptedEffects: [] },
    destination: { roomId: q('R08'), safePositionId: q('R08.entry'), activity: 'stable-exploration' } });
  choose('read-survey'); choose('mitigate-emitter'); measure('O08', 2); expect(submit('O08', 2).status).toBe('applied');
  return { registry: reg, game: get, state: () => state, replace: (next: ReducerState) => { state = next; }, send, choose, measure, submit, reduce, effects };
}
const action = (game: GameState, answer: unknown): DomainAction<unknown> => ({ actionId: 'scout-answer' as ActionId, expectedVersion: { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId }, input: answer });
function predict(f: ReturnType<typeof fixture>, assessment: 'meets-threshold' | 'below-threshold' = 'below-threshold', baselineMeasurementId = id(2)) {
  const result = captureScoutPrediction(activity.delivery, f.registry, action(f.game(), { baselineMeasurementId, assessment }), f.game());
  expect(result.status).toBe('correct'); return result.observations[0] as ScoutPrediction;
}
function pair(prediction: 'meets-threshold' | 'below-threshold' = 'below-threshold') {
  const f = fixture(); f.choose('raise-noise'); const capture = predict(f, prediction); f.measure('O08', 3); return { ...f, capture };
}
const correct = (): ScoutComparisonInput => ({ laterMeasurementId: id(3), comparison: 'decreased', currentAssessment: 'below-threshold', predictionAssessment: 'supported', evidenceClaim: 'current-reading-only-no-cause' });
const evaluate = (f: ReturnType<typeof pair>, answer: unknown = correct(), game = f.game()) => evaluateScoutComparison(activity.delivery, f.registry, f.capture, action(game, answer), game);
afterAll(() => {
  for (const [path, hash] of Object.entries(baseline)) expect(createHash('sha256').update(read(path)).digest('hex'), path).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({
    scope: 'T103 isolated current-schema candidate, real radio evaluator/resolver/measurement/reducer and pure proposed adapter only. Actual optional controller, native lifecycle, persistence and human/media acceptance remain pending.',
    scaffolding: 'Guest discovery, initial O01/O02 completion, inspection kit and R07 arrival are prepared. R07 actions, O07 measure/submit, R08 arrival operation, O08 actions/measure/submit and subsequent readings use the actual reducer. No real browser journey claimed.',
    protectedInputs: baseline, receipts,
  }, null, 2) + '\n');
});

describe('MG03 fixed authored candidate and current schema', () => {
  it('passes actual registry with cloned current-schema projection and isolated closed schema', () => {
    expect(registry().record(q('MG03'))?.kind).toBe('minigame');
    expect(validateContent(input(candidate)).ok).toBe(false); // Full payload is unsupported until the shared join.
    const { optionalActivity: _payload, ...base } = candidate; expect(base).toEqual(projection);
    expect(proposalSchema(activity), JSON.stringify(proposalSchema.errors)).toBe(true);
  });
  it('preserves immutable T092 prerequisite, reward, rule and source-case identities', () => {
    const expected = oracle.activities.find((a: any) => a.activityId === q('MG03'));
    expect(candidate.prerequisite).toEqual({ kind: 'objective-complete', objectiveId: expected.prerequisiteObjectives[0] });
    expect(candidate.ruleIds).toEqual(expected.ruleIds.map(q)); expect(activity.delivery.sourceCaseIds).toEqual(expected.sourceCaseIds);
    expect(activity.reward.kind).toBe(expected.reward); expect(candidate.requiredForMainStory).toBe(false);
    expect(candidate.sourceClaims).toEqual((profile as any).sourceClaims);
  });
  it('uses the actual channel desk, Phoenix and safe origin with explicit physical changes', () => {
    const reg = registry(), entry = activity.entryContexts[0]!; expect(reg.has('hotspot', entry.hotspotId)).toBe(true);
    expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: q('R08'), eligibleStates: ['stable-exploration'] });
    const room = reg.record(q('R08')); expect(room?.kind === 'room' && room.characterIds.includes(activity.speakerId)).toBe(true);
    expect(activity.speakerId).toBe(q('CH10')); expect(candidate.instructions).toContain("change this adventure's actual radio configuration");
    expect(candidate.exitExplanation).toContain('Keep the actual radio configuration');
    expect(activity.feedback.missingEvidence).toContain('Close Channel Scout');
    expect(candidate.requiredScoreForMainStory).toBe(false); expect(candidate.requiresReflexTiming).toBe(false); expect(candidate.skippable).toBe(true);
    expect(activity.timingDefault).toBe('off'); expect(candidate.timingDefault).toBe('off');
  });
  it('uses exactly existing closed controls and rejects arbitrary actions', () => {
    for (const [choice, actionId] of Object.entries(activity.selectionActions)) expect(scoutSelectionAction(choice)).toBe(actionId);
    for (const invalid of ['boundary-exercise', '__proto__', 'ACTION-radio-channel-A', {}, null, true, 'weather', 'channel-C']) expect(scoutSelectionAction(invalid)).toBeNull();
  });
  it('validates the exact proposed closed intents with bounded identifiers and scalar enums', () => {
    const validate = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/MG03/closed-intents.schema.json'));
    const intents = [
      { kind: 'scout-select', sessionId: id(10), choice: 'channel-B' },
      { kind: 'scout-predict', sessionId: id(10), baselineMeasurementId: id(2), assessment: 'below-threshold' },
      { kind: 'scout-measure', sessionId: id(10) },
      { kind: 'scout-compare', sessionId: id(10), ...correct() },
    ];
    for (const intent of intents) {
      expect(validate(intent)).toBe(true); expect(validate({ ...intent, verdict: 'correct' })).toBe(false);
      expect(validate({ ...intent, sessionId: 'arbitrary' })).toBe(false);
    }
    expect(validate({ ...intents[0], choice: ['channel-B'] })).toBe(false);
    expect(validate({ ...intents[2], measurementId: id(4) })).toBe(false);
  });
  it('keeps the practice card visibly distinct from earned measurements', () => {
    const source = physical.reviewCases.find((c: any) => c.id === 'B-RADIO-20');
    expect(activity.practice.signal).toEqual(source.inputs.signal); expect(activity.practice.noise).toEqual(source.inputs.noise);
    expect(activity.practice.explanation).toContain('not a notebook observation'); expect(activity.practice.explanation).toContain('worked assistance');
    expect(candidate.hints.solution.text).toContain('assisted'); expect(activity.reward).toEqual({ kind: 'optional-radio-practice', factId: q('FACT-MG03-completion') });
  });
  it.each(['profile', 'boundary', 'timing', 'action', 'evidence', 'reward', 'exit', 'return', 'prerequisite'])('rejects malformed %s candidate semantics', kind => {
    const mutated: any = structuredClone(activity);
    if (kind === 'profile') mutated.profileId = q('PROFILE-POWER');
    if (kind === 'boundary') mutated.practice.noise.value = -84.99;
    if (kind === 'timing') mutated.timingDefault = 'on';
    if (kind === 'action') mutated.selectionActions['boundary-exercise'] = q('ACTION-radio-boundary-exercise');
    if (kind === 'evidence') mutated.delivery.measurements = [];
    if (kind === 'reward') mutated.reward.itemId = q('ITEM-inspection-kit');
    if (kind === 'exit') delete mutated.controls.exit;
    if (kind === 'return') mutated.returnPolicy = 'choose-destination';
    if (kind === 'prerequisite') mutated.delivery.predictionRequired = false;
    expect(proposalSchema(mutated)).toBe(false);
  });
  it('leaves actual O08 completable before any minigame receipt and explains locked state', () => {
    const f = fixture(); expect(f.game().world.completedObjectiveIds).toContain(q('O08'));
    expect(f.game().world.achievementIds).not.toContain(q('ACHIEVEMENT-MG03-complete'));
    expect(f.game().notebook.factIds).not.toContain(q('FACT-MG03-completion'));
    expect(conditionSatisfied(projection.prerequisite as S.condition, f.game().world, f.registry)).toBe(true);
    const locked: any = structuredClone(f.game()); locked.world.completedObjectiveIds = locked.world.completedObjectiveIds.filter((id: string) => id !== q('O08'));
    expect(conditionSatisfied(projection.prerequisite as S.condition, locked.world, f.registry)).toBe(false);
    const result = captureScoutPrediction(activity.delivery, f.registry, action(locked, { baselineMeasurementId: id(2), assessment: 'below-threshold' }), locked);
    receipts['OPT-MG03-LOCKED-BEFORE-OBJECTIVE'] = result; expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-unavailable-before-radio-proof' });
  });
});

describe('actual predict, measure and compare adapters', () => {
  it('executes frozen T08→T09 with correct diagnosis of an actually failed current link', () => {
    const f = pair(), before = structuredClone(f.game()), expected = oracle.cases.find((c: any) => c.id === 'OPT-MG03-COMPARE').expected;
    const result = evaluate(f); receipts['OPT-MG03-COMPARE'] = result;
    expect(result.status).toBe(expected.learnerStatus); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ earlier: { record: { stale: true }, observation: { snr: { value: expected.historicalSnrDb } }, usableAsCurrent: expected.oldSampleUsableAsCurrent },
      later: { record: { stale: false }, observation: { snr: { value: expected.currentSnrDb } }, physicalStatus: 'incorrect' },
      snrChange: { value: expected.snrChangeDb, unit: 'dB' }, currentLinkPass: expected.currentLinkPass, activityCompletionEligible: expected.activityCompletionEligible,
      weatherCausationProven: false, throughputProven: false, wholeRouteProven: false, repaired: false, independentMasteryProven: false });
    expect(f.game()).toEqual(before); expect(f.game().world.completedObjectiveIds).toContain(q('O08'));
    expect(f.game().notebook.measurements.at(-1)?.conclusionCode).toContain(':incorrect');
  });
  it('accepts honest revision of a wrong prediction without calling the prediction correct', () => {
    const f = pair('meets-threshold'), result = evaluate(f, { ...correct(), predictionAssessment: 'not-supported' });
    receipts['wrong-prediction-honest-comparison'] = result;
    expect(result.status).toBe('correct'); expect(result.observations[0]).toMatchObject({ prediction: { supported: false }, independentMasteryProven: false });
    expect(evaluate(f).status).toBe('incorrect');
  });
  it('executes inclusive boundary20 with real measurement and real reviewed evaluator', () => {
    const f = fixture(); f.choose('channel-B'); const capture = predict(f, 'meets-threshold'); f.measure('O08', 3);
    const result = evaluateScoutComparison(activity.delivery, f.registry, capture, action(f.game(), { ...correct(), currentAssessment: 'meets-threshold' }), f.game());
    const expected = oracle.cases.find((c: any) => c.id === 'OPT-MG03-BOUNDARY').expected;
    receipts['OPT-MG03-BOUNDARY'] = result; expect(result.status).toBe('correct');
    expect(result.observations[0]).toMatchObject({ later: { observation: { snr: { value: expected.snrDb }, thresholdMet: expected.scenarioThresholdMet } }, throughputProven: expected.throughputGuaranteed });
  });
  it('practice uses evaluateRadio without adding any measurement or completion', () => {
    const f = fixture(), before = structuredClone(f.game()); const p = activity.practice;
    const result = evaluateRadio({ kind: 'radio-link', profile, viablePath: p.viablePath, settingsCompatible: p.settingsCompatible,
      signal: { value: p.signal.value, unit: 'dBm' }, noise: { value: p.noise.value, unit: 'dBm' } }, { ...action(f.game(), null), input: { kind: 'measure-link' } }, f.game().world);
    receipts['worked-practice-card-only'] = result; expect(result.status).toBe('correct'); expect(result.acceptedEffects).toEqual([]); expect(f.game()).toEqual(before);
  });
  it('select and predict alone preserve historical readings and require explicit measure', () => {
    const f = fixture(), count = f.game().notebook.measurements.length; f.choose('raise-noise');
    expect(f.game().notebook.measurements).toHaveLength(count); expect(f.game().notebook.measurements.at(-1)?.stale).toBe(true);
    const capture = predict(f, 'meets-threshold'), before = structuredClone(f.game());
    const result = evaluateScoutComparison(activity.delivery, f.registry, capture, action(f.game(), correct()), f.game());
    receipts['OPT-MG03-STALE-PREDICTION'] = result;
    expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-new-measurement-required', acceptedEffects: [] });
    expect(f.game()).toEqual(before); expect(f.game().notebook.measurements).toHaveLength(count);
    expect(evaluateScoutComparison(activity.delivery, f.registry, capture, action(f.game(), { ...correct(), laterMeasurementId: id(2) }), f.game()).status).toBe('invalid-input');
  });
  it('does not allow a retrospective prediction for an already taken current reading', () => {
    const f = pair(); const retrospective = predict(f);
    expect(evaluateScoutComparison(activity.delivery, f.registry, retrospective, action(f.game(), correct()), f.game())).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-measure-after-prediction' });
  });
  it('requires an earlier actual baseline and preserves safe missing-evidence operation', () => {
    const f = fixture(), empty: any = structuredClone(f.game()); empty.notebook.measurements = [];
    const before = structuredClone(empty), result = captureScoutPrediction(activity.delivery, f.registry, action(empty, { baselineMeasurementId: id(2), assessment: 'below-threshold' }), empty);
    receipts['missing-evidence-no-mutation'] = result; expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-missing-baseline' }); expect(empty).toEqual(before);
    expect(captureScoutPrediction(activity.delivery, f.registry, action(f.game(), { baselineMeasurementId: id(2), assessment: 'meets-threshold' }), f.game())).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-earlier-baseline-required' });
    expect(candidate.exitExplanation).toBe(activity.recovery.exitExplanation); // Authored exit availability only; no lifecycle claim.
  });
  it('requires prediction even for a correct existing comparison', () => {
    const f = pair(); expect(evaluateScoutComparison(activity.delivery, f.registry, null, action(f.game(), correct()), f.game())).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-prediction-required' });
  });
  it.each(['comparison', 'threshold', 'prediction', 'weather', 'throughput', 'history'])('rejects incorrect %s without state changes', kind => {
    const f = pair(), a = { ...correct() }, before = structuredClone(f.game());
    if (kind === 'comparison') a.comparison = 'increased'; if (kind === 'threshold') a.currentAssessment = 'meets-threshold';
    if (kind === 'prediction') a.predictionAssessment = 'not-supported'; if (kind === 'weather') a.evidenceClaim = 'weather-proven';
    if (kind === 'throughput') a.evidenceClaim = 'throughput-proven'; if (kind === 'history') a.evidenceClaim = 'earlier-proves-current';
    expect(evaluate(f, a)).toMatchObject({ status: 'incorrect', acceptedEffects: [] }); expect(f.game()).toEqual(before);
  });
  it.each([null, {}, '', { ...correct(), laterMeasurementId: 'unknown' }, { ...correct(), currentAssessment: true },
    { ...correct(), effects: candidate.effects }, { ...correct(), profile }, { ...correct(), correct: true }, { ...correct(), currentVersion: 100 }, { ...correct(), comparison: ['decreased'] }, { ...correct(), predictionAssessment: ['supported'] }, { ...correct(), evidenceClaim: ['current-reading-only-no-cause'] }])('rejects malformed/forged comparison %j', answer => {
    expect(evaluate(pair(), answer)).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
  });
  it.each([null, {}, { baselineMeasurementId: id(2), assessment: 'good' }, { baselineMeasurementId: id(2), assessment: 'meets-threshold', measurements: [] }])('rejects malformed prediction %j', answer => {
    const f = fixture(); f.choose('raise-noise'); expect(captureScoutPrediction(activity.delivery, f.registry, action(f.game(), answer), f.game())).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
  });
  it.each(['explicit-stale', 'wrong-attempt', 'old-revision-false-flag', 'not-latest', 'scenario-mismatch', 'stale-command', 'stale-prediction', 'new-adventure'])('rejects %s instead of refreshing evidence', kind => {
    const f = pair(), game: any = structuredClone(f.game());
    if (kind === 'explicit-stale') game.notebook.measurements[2].stale = true;
    if (kind === 'wrong-attempt') game.notebook.measurements[2].attemptId = id(88);
    if (kind === 'old-revision-false-flag') { game.notebook.measurements[2].configurationRevision -= 1; game.notebook.measurements[2].stale = false; }
    if (kind === 'not-latest') game.notebook.measurements.push({ ...game.notebook.measurements[2], id: id(4) });
    if (kind === 'scenario-mismatch') game.world.flags[q('FLAG-radio-conditions')] = 'surveyed';
    if (kind === 'stale-prediction') game.world.configurationRevision += 1;
    if (kind === 'new-adventure') game.adventureId = id(90);
    const captured = action(game, correct());
    const result = kind === 'stale-command' ? evaluateScoutComparison(activity.delivery, f.registry, f.capture, { ...captured, expectedVersion: { ...game.world, configurationRevision: (game.world.configurationRevision - 1) as ConfigurationRevision } }, game) : evaluate(f, correct(), game);
    expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
    if (kind === 'old-revision-false-flag') receipts['old-revision-false-stale-flag'] = result;
    if (kind === 'explicit-stale') receipts['B-STALE-FLAG-adapter'] = result;
  });
  it.each(['C-FRESH', 'B-STALE-FLAG', 'T13'])('executes the immutable %s freshness fields with the actual primitive', caseId => {
    const source = [...physical.referenceCases, ...physical.reviewCases].find((c: any) => c.id === caseId);
    const f = pair(), actual = f.game().notebook.measurements.at(-1)!;
    // Explicit independent oracle projection of freshness fields onto an actual
    // record. These projected versions are primitive probes, not earned records.
    const attemptIds: Record<string, AttemptId> = { a: id(70) as unknown as AttemptId, b: id(71) as unknown as AttemptId };
    const record = { ...actual, configurationRevision: source.inputs.measurementRevision as ConfigurationRevision,
      attemptId: attemptIds[source.inputs.measurementAttempt]!, stale: source.inputs.explicitlyStale ?? false };
    const version = { configurationRevision: source.inputs.currentRevision as ConfigurationRevision, attemptId: attemptIds[source.inputs.currentAttempt]! };
    const fresh = isMeasurementCurrent(record, version);
    expect(fresh).toBe(source.expected.observation.fresh);
    receipts[caseId] = { scope: 'actual freshness primitive, projected immutable case fields; not a new notebook measurement', fresh, recordVersion: { configurationRevision: record.configurationRevision, attemptId: record.attemptId, stale: record.stale }, version };
  });
  it('invalidates a prediction after actual configuration changes even when values are restored', () => {
    const f = pair(); f.choose('mitigate-emitter'); f.choose('raise-noise'); f.measure('O08', 4);
    expect(evaluate(f, { ...correct(), laterMeasurementId: id(4) })).toMatchObject({ status: 'invalid-input', reasonCode: 'scout-prediction-stale' });
  });
  it.each(['room', 'subject', 'unit', 'snr', 'channel', 'duplicate', 'baseline'])('rejects corrupt %s provenance as an authoring error', kind => {
    const f = pair(), game: any = structuredClone(f.game()), later = game.notebook.measurements[2];
    if (kind === 'room') later.roomId = q('R07'); if (kind === 'subject') later.subjectIds = [q('PROFILE-RADIO')];
    if (kind === 'unit') later.readings[2].unit = 'dB'; if (kind === 'snr') later.readings[4].value = 25;
    if (kind === 'channel') { later.readings[3].value = -90; later.readings[4].value = 25; later.conclusionCode = 'O08:ACTION-O08-scenario-channel-B:correct'; }
    if (kind === 'duplicate') game.notebook.measurements.push(structuredClone(later));
    if (kind === 'baseline') game.notebook.measurements[1].readings[4].value = 26;
    expect(evaluate(f, correct(), game)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
  it('checks authored delivery before malformed input and uses actual profile validation', () => {
    const f = pair();
    expect(evaluateScoutComparison({ ...activity.delivery, currentRequired: false }, f.registry, f.capture, action(f.game(), null), f.game())).toMatchObject({ status: 'content-error', acceptedEffects: [] });
    const badProfile: any = structuredClone(profile); badProfile.parameters.requiredSNR.value = 19;
    expect(evaluateRadio({ kind: 'radio-snr', profile: badProfile, signal: { value: -65, unit: 'dBm' }, noise: { value: -85, unit: 'dBm' }, otherPathChecks: true }, { ...action(f.game(), null), input: null as any }, f.game().world).status).toBe('content-error');
  });
  it('compares reverse and unchanged observations without privileging a direction', () => {
    const f = pair(); f.choose('mitigate-emitter'); const capture = predict(f, 'meets-threshold', id(3)); f.measure('O08', 4);
    expect(evaluateScoutComparison(activity.delivery, f.registry, capture, action(f.game(), { ...correct(), laterMeasurementId: id(4), comparison: 'increased', currentAssessment: 'meets-threshold' }), f.game()).status).toBe('correct');
    const g = pair(); g.choose('channel-B'); const same = predict(g, 'below-threshold', id(3)); g.measure('O08', 4);
    expect(evaluateScoutComparison(activity.delivery, g.registry, same, action(g.game(), { ...correct(), laterMeasurementId: id(4), comparison: 'unchanged' }), g.game()).status).toBe('correct');
  });
  it('preserves an existing19.99 boundary observation without adding a new activity control', () => {
    const f = fixture(); f.choose('channel-B'); f.measure('O08', 3); f.choose('boundary-exercise'); // Existing ordinary radio action: regression only, never scoutSelections.
    const capture = predict(f, 'below-threshold', id(3)); f.measure('O08', 4);
    const result = evaluateScoutComparison(activity.delivery, f.registry, capture, action(f.game(), { ...correct(), laterMeasurementId: id(4) }), f.game());
    receipts['existing-near-boundary-regression'] = result; expect(result.status).toBe('correct');
    expect(result.observations[0]).toMatchObject({ snrChange: { value: -0.01 }, currentLinkPass: false });
  });
});

describe('actual receipt and encounter-recovery boundaries, not optional lifecycle', () => {
  function award(f: ReturnType<typeof fixture>, effects = f.effects) {
    // Explicit trusted effect-boundary probe. A later controller must authorize the full result.
    return f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'scoped-mg03-receipt', observations: [], acceptedEffects: effects } });
  }
  it('applies the complete own fact+achievement batch once in existing fields', () => {
    const f = pair(), before = structuredClone(f.game()); expect(evaluate(f).status).toBe('correct');
    expect(award(f).status).toBe('applied'); expect(award(f).status).toBe('no-op');
    expect(f.game().world.achievementIds.filter(x => x === q('ACHIEVEMENT-MG03-complete'))).toHaveLength(1);
    expect(f.game().notebook.factIds.filter(x => x === q('FACT-MG03-completion'))).toHaveLength(1);
    for (const key of ['inventory','completedObjectiveIds','completedQuestIds','activeAllyIds','recruits','flags','route'] as const) expect(f.game().world[key]).toEqual(before.world[key]);
    expect(f.game().notebook.measurements).toEqual(before.notebook.measurements); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
    expect(conditionSatisfied({ kind: 'minigame-complete', minigameId: q('MG03') }, f.game().world, f.registry)).toBe(true);
  });
  it.each(['record-fact','complete-minigame'])('rejects partial receipt %s', kind => {
    const f = pair(); expect(award(f, f.effects.filter(e => e.kind === kind))).toMatchObject({ status: 'rejected', reason: 'content-error' });
    expect(f.game().world.achievementIds).not.toContain(q('ACHIEVEMENT-MG03-complete'));
  });
  it('proposed replay baseline retains only the accepted MG03 receipt and restores entry physical preparation even after completion', () => {
    const f = fixture(), entry = structuredClone(f.game().world); f.choose('raise-noise'); const capture = predict(f); f.measure('O08', 3);
    expect(evaluateScoutComparison(activity.delivery, f.registry, capture, action(f.game(), correct()), f.game()).status).toBe('correct');
    award(f); const replay = scoutReplayPreparation(entry, f.game());
    expect(replay).toEqual({ ...entry, achievementIds: [...entry.achievementIds, q('ACHIEVEMENT-MG03-complete')] });
    expect(replay.flags).not.toEqual(f.game().world.flags);
    const session: OptionalActivitySession = { sessionId: id(200), activityId: q('MG03'), adventureId: f.game().adventureId,
      clientGeneration: 0 as OptionalActivitySession['clientGeneration'], entry: activity.entryContexts[0]!, preparation: replay,
      previousActivity: 'stable-exploration', phase: 'feedback', mode: 'delivery', timingEnabled: false, feedback: null, result: 'correct', hintText: null };
    const result = rewindOptionalPreparation(f.game(), session, id(201) as unknown as AttemptId, { highestRevision: f.game().world.configurationRevision, usedAttemptIds: [] });
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Expected actual shared rewind primitive to accept prepared session');
    expect(result.game.world.flags).toEqual(entry.flags); expect(result.game.world.inventory).toEqual(entry.inventory);
    expect(result.game.world.achievementIds).toContain(q('ACHIEVEMENT-MG03-complete'));
    expect(result.game.notebook.factIds).toContain(q('FACT-MG03-completion')); expect(result.game.notebook.measurements.every(m => m.stale)).toBe(true);
    expect(result.game.notebook.personalNotes).toBe(f.game().notebook.personalNotes); expect(result.game.world.configurationRevision).toBeGreaterThan(f.game().world.configurationRevision);
    expect(result.game.world.attemptId).not.toBe(f.game().world.attemptId);
    receipts['proposed-replay-baseline-with-actual-rewind-primitive'] = { scope: 'Prepared session and proposed baseline merge; not production MG03 lifecycle', status: 'correct', restoredEntryFlags: result.game.world.flags, completion: result.game.world.achievementIds, allMeasurementsStale: result.game.notebook.measurements.every(m => m.stale) };
  });
  it('existing matching-session exit preserves current failed configuration even when evidence is missing', () => {
    const f = pair(), game: GameState = { ...f.game(), notebook: { ...f.game().notebook, measurements: [] } };
    // Prepared session probes only. MG03 start/production dispatch is not implemented.
    const session: OptionalActivitySession = { sessionId: id(200), activityId: q('MG03'), adventureId: game.adventureId,
      clientGeneration: 0 as OptionalActivitySession['clientGeneration'], entry: activity.entryContexts[0]!, preparation: structuredClone(game.world),
      previousActivity: 'stable-exploration', phase: 'instructions', mode: null, timingEnabled: false, feedback: null, result: null, hintText: null };
    const result = prepareOptionalActivityChange(f.registry, game, { kind: 'active-optional' }, session, { kind: 'exit', sessionId: session.sessionId }, undefined, session.clientGeneration);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error('Expected matching-session exit');
    expect(result.game).toEqual(game); expect(result.session).toBeNull(); expect(result.activity).toEqual({ kind: 'stable-exploration' });
    expect(result.evaluation.acceptedEffects).toEqual([]); expect(result.game.world.flags[q<'flag'>('FLAG-radio-conditions')]).toBe('raised-noise');
    expect(prepareOptionalActivityChange(f.registry, game, { kind: 'active-optional' }, session, { kind: 'exit', sessionId: id(201) }, undefined, session.clientGeneration).ok).toBe(false);
    receipts['prepared-session-missing-evidence-exit'] = { scope: 'Existing common exit with prepared candidate session; no native/start acceptance', closesMatching: result.session === null, leavesGameUnchanged: result.game === game };
  });
  it('retained fact alone and unrelated later achievements never advance the original replay baseline', () => {
    const f = fixture(), entry = structuredClone(f.game().world), game: any = structuredClone(f.game());
    game.notebook.factIds.push(q('FACT-MG03-completion')); game.world.achievementIds.push(q('ACHIEVEMENT-unrelated'));
    game.world.flags[q('FLAG-radio-conditions')] = 'raised-noise'; game.world.inventory = [];
    expect(scoutReplayPreparation(entry, game)).toEqual(entry);
    game.world.achievementIds.push(q('ACHIEVEMENT-MG03-complete'));
    expect(scoutReplayPreparation(entry, game)).toEqual({ ...entry, achievementIds: [...entry.achievementIds, q('ACHIEVEMENT-MG03-complete')] });
  });
  it('raw proposal result has no award authority and retained fact alone is not completion', () => {
    const f = pair(), before = structuredClone(f.game()); f.send({ kind: 'apply', evaluation: evaluate(f) }); expect(f.game()).toEqual(before);
    expect(conditionSatisfied({ kind: 'minigame-complete', minigameId: q('MG03') }, { ...f.game().world, achievementIds: [] }, f.registry)).toBe(false);
  });
  it('actual encounter Retry retains learning, rewinds completion and stales readings', () => {
    const f = fixture(), original = structuredClone(f.game()); f.choose('raise-noise'); const capture = predict(f); f.measure('O08', 3); award(f);
    const changed = f.state(); f.replace({ ...changed, runtime: { ...changed.runtime, activity: { kind: 'terminal-failure' }, checkpoint: {
      adventureId: original.adventureId, world: { ...original.world, roomId: q('R11'), position: { safePositionId: q('R11.preparation') } },
    } } });
    const result = f.send({ kind: 'rewind-preparation', nextAttemptId: id(111) as unknown as AttemptId });
    receipts['actual-encounter-retry-boundary'] = { status: result.status, reason: result.reason, staleCount: f.game().notebook.measurements.filter(m => m.stale).length };
    expect(result.status).toBe('applied'); expect(f.game().world.achievementIds).not.toContain(q('ACHIEVEMENT-MG03-complete'));
    expect(f.game().notebook.factIds).toContain(q('FACT-MG03-completion')); expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true);
    expect(f.game().world.flags).toEqual(original.world.flags); expect(f.game().world.inventory).toEqual(original.world.inventory);
    expect(f.game().notebook.personalNotes).toBe(original.notebook.personalNotes); expect(f.game().world.configurationRevision).toBeGreaterThan(capture.version.configurationRevision);
    expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
});
