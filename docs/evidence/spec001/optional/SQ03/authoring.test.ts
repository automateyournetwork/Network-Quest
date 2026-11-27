// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Scoped authoring/proposal tests: not the common activity UI or browser acceptance.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv from 'ajv/dist/2020.js';
import { afterAll, describe, expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import type * as S from '../../../../../src/content/schema-types.generated';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { createReducer, createReducerState, type EffectBinding, type ReducerInput, type ReducerState, type StateEffect } from '../../../../../src/state/reducer';
import { radioEffectBindings, createRadioScenarioResolver, prepareRadioAction } from '../../../../../src/state/radio-scenario';
import { objectiveEffectBindings } from '../../../../../src/state/objectives';
import { evaluateRadio, type RadioProfile } from '../../../../../src/domain/radio';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, MeasurementId, QualifiedId } from '../../../../../src/domain/types';
import type { GameState } from '../../../../../src/state/types';
import { evaluateDiaryAnswer, type RadioDiaryAnswer } from './radio-diary-proposal';
import candidate from './SQ03.candidate.json' with { type: 'json' };
import projection from './SQ03.current-schema.json' with { type: 'json' };
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
function input(quest: unknown = projection) {
  const world = json('content/spec001/world.json') as S.world;
  const documents: Record<string, unknown> = Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(path => [path, json(path)]));
  const path = 'content/spec001/quests/SQ03.json';
  world.documents = world.documents.filter(d => d.id !== q('SQ03'));
  world.documents.push({ kind: 'quest', id: q('SQ03'), path }); documents[path] = quest;
  return { world, sources: json('content/spec001/sources.json'), documents };
}
function registry() {
  const result = validateContent(input());
  if (!result.ok || !result.registry) throw new Error(`SQ03 projection registry: ${JSON.stringify(result.issues)}`);
  return result.registry;
}
const proposalSchema = new Ajv({ strict: true, allErrors: true }).compile(json('docs/evidence/spec001/optional/SQ03/optional-activity.schema.json'));
function fixture() {
  const reg = registry(), initial = startIntroduction(createIntroductionRuntime(), reg), game = initial.game!;
  let state = createReducerState({ ...initial, game: { ...game, world: { ...game.world, flags: {},
    roomId: q('R07'), position: { safePositionId: q('R07.entry') }, completedObjectiveIds: [q('O01'), q('O02')],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...game.notebook, factIds: [], measurements: [], personalNotes: 'Compare observations; do not blame the weather.' } } });
  const effects = projection.effects as StateEffect[];
  const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('SQ03'), effectId: e.effectId, mode: 'once', receipt: { kind: 'quest', id: q('SQ03') } }));
  const resolver = createRadioScenarioResolver(reg);
  const reduce = createReducer({ registry: reg, bindings: [...radioEffectBindings(reg), ...objectiveEffectBindings(reg), ...bindings], objectiveScenario: resolver });
  const get = () => state.runtime.game!;
  let actions = 0;
  const send = (command: ReducerInput) => {
    const result = reduce(state, { actionId: `sq03-${++actions}` as ActionId, adventureId: get().adventureId, expectedVersion: get().world, input: command });
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
  choose('read-survey');
  return { registry: reg, game: get, state: () => state, replace: (next: ReducerState) => { state = next; }, send, choose, measure, submit, reduce, effects };
}
function pair() { const f = fixture(); f.choose('mitigate-emitter'); f.measure('O08', 2); f.choose('raise-noise'); f.measure('O08', 3); return f; }
const correct = (): RadioDiaryAnswer => ({ earlierMeasurementId: id(2), laterMeasurementId: id(3), comparison: 'decreased', currentAssessment: 'below-threshold', evidenceClaim: 'current-reading-only-no-cause' });
const action = (game: GameState, answer: unknown): DomainAction<unknown> => ({ actionId: 'diary-answer' as ActionId, expectedVersion: game.world, input: answer });
const evaluate = (f: ReturnType<typeof fixture>, answer: unknown = correct(), game = f.game()) => evaluateDiaryAnswer(activity.delivery, f.registry, action(game, answer), game);
const unlocked = (game: GameState) => game.world.completedQuestIds.includes(q('SQ03')) && game.notebook.factIds.includes(q('FACT-SQ03-comparison'));
afterAll(() => {
  for (const [path, hash] of Object.entries(baseline)) expect(createHash('sha256').update(read(path)).digest('hex'), path).toBe(hash);
  writeFileSync(new URL('./evaluator-receipts.json', import.meta.url), JSON.stringify({ scope: 'Real radio evaluator and reducer-created records through an isolated diary proposal; no shared activity/browser/media acceptance.', protectedInputs: baseline, receipts }, null, 2) + '\n');
});

describe('SQ03 candidate source, schema and allocation', () => {
  it('passes actual registry with its current-schema projection and preserves the full projection', () => {
    expect(registry().record(q('SQ03'))?.kind).toBe('quest');
    const { optionalActivity: _payload, ...base } = candidate; expect(base).toEqual(projection);
    expect(proposalSchema(activity), JSON.stringify(proposalSchema.errors)).toBe(true);
  });
  it('reuses reviewed radio source claims and immutable optional expectations', () => {
    expect(candidate.sourceClaims).toEqual(json('content/spec001/profiles.json').records.find((r: any) => r.id === q('PROFILE-RADIO')).sourceClaims);
    expect(candidate.ruleIds).toEqual([q('PHY07'), q('STATE01')]);
    const spec = oracle.activities.find((r: any) => r.activityId === q('SQ03'));
    expect(spec.sourceCaseIds).toEqual(['T08', 'T09', 'B-RADIO-20', 'T13', 'C-FRESH', 'B-STALE-FLAG']);
    expect(spec.prerequisiteObjectives).toEqual([]); expect(candidate.prerequisite).toEqual({ kind: 'always' });
    expect(candidate.model.limitations.join(' ')).toContain('not a universal');
    expect(candidate.model.limitations.join(' ')).toContain('wall-clock timestamp');
    expect(candidate.model.limitations.join(' ')).toContain('does not guarantee throughput');
  });
  it('uses the actual safe R08 diary shelf and present Phoenix without party or tool entry gates', () => {
    const reg = registry(), entry = activity.entryContexts[0]!;
    expect(reg.safePosition(entry.safePositionId)).toMatchObject({ roomId: q('R08'), eligibleStates: ['stable-exploration'] });
    expect(reg.has('hotspot', entry.hotspotId)).toBe(true); expect(entry.hotspotId).toBe(q('HOTSPOT-radio-vane'));
    const room = reg.record(q('R08')); expect(room?.kind === 'room' && room.characterIds.includes(activity.speakerId)).toBe(true);
    expect(candidate.alternatives[0]).toMatchObject({ condition: { kind: 'always' }, itemIds: [], abilityIds: [], effects: [] });
    expect(activity.timingDefault).toBe('off'); expect(activity.returnPolicy).toBe('captured-entry');
    expect(activity.feedback.missingEvidence).toContain('Close the diary');
  });
  it('binds existing planned illustration16 without inventing production, an item or a URL', () => {
    const asset = json('assets-src/manifest.json').assets.find((a: any) => a.assetId === activity.reward.assetId);
    const allocation = json('assets-src/audio/production-plan.json').illustrations.find((a: any) => a.assetId === activity.reward.assetId);
    expect(asset).toMatchObject({ kind: 'illustration', status: 'planned', countsTowardQuota: false, exports: [] });
    expect(allocation).toMatchObject({ name: 'Weather diary comparison', roomId: q('R08'), intendedUse: 'journal', learningIntent: 'SQ03 / MG03; weather illustration does not supply an uncited scoring rule' });
    expect(activity.reward.kind).toBe('optional-radio-depth'); expect(activity.reward.paragraphs).toHaveLength(4);
    expect(activity.reward).not.toHaveProperty('url'); expect(activity.reward).not.toHaveProperty('itemId');
    expect(candidate.effects.map(e => e.kind)).toEqual(['record-fact', 'complete-quest']);
  });
  it('rejects a main dependency or undocumented rule in the actual registry', () => {
    const noClaims = structuredClone(projection); noClaims.sourceClaims = []; expect(validateContent(input(noClaims)).ok).toBe(false);
    const data = input(); data.world.objectives.find(o => o.id === q('O08'))!.prerequisite = { kind: 'quest-complete', questId: q('SQ03') };
    expect(validateContent(data).ok).toBe(false);
  });
  it.each(['timed', 'exit', 'hidden-effect', 'source', 'profile', 'forged-measurement', 'boundary', 'reward', 'return'])('rejects malformed proposal %s', mutation => {
    const changed: any = structuredClone(activity);
    if (mutation === 'timed') changed.timingDefault = 'on';
    if (mutation === 'exit') delete changed.controls.exit;
    if (mutation === 'hidden-effect') changed.reward.effects = candidate.effects;
    if (mutation === 'source') changed.delivery.sourceCaseIds = ['unreviewed'];
    if (mutation === 'profile') changed.profileId = q('PROFILE-POWER');
    if (mutation === 'forged-measurement') changed.delivery.measurements = [];
    if (mutation === 'boundary') changed.practice.noise.value = -84.99;
    if (mutation === 'reward') changed.reward.assetId = q('ASSET-ILLUSTRATION-15');
    if (mutation === 'return') changed.returnPolicy = 'choose-room';
    expect(proposalSchema(changed)).toBe(false);
  });
});

describe('real radio measurements and proposed diary scoring', () => {
  it('executes the frozen25→13 comparison with independently expected values and preserved originals', () => {
    const expected = oracle.cases.find((c: any) => c.id === 'OPT-SQ03-COMPARE').expected;
    const f = pair(), before = structuredClone(f.game()), result = evaluate(f); receipts['OPT-SQ03-COMPARE'] = result;
    expect(result.status).toBe(expected.learnerStatus); expect(result.acceptedEffects).toEqual([]);
    expect(result.observations[0]).toMatchObject({ learnerStatus: 'correct', earlier: { record: { stale: true }, observation: { snr: { value: expected.historicalSnrDb } }, usableAsCurrent: expected.oldSampleUsableAsCurrent },
      later: { record: { stale: false }, observation: { snr: { value: expected.currentSnrDb } }, physicalStatus: 'incorrect' },
      snrChange: { value: expected.snrChangeDb, unit: 'dB' }, currentLinkPass: expected.currentLinkPass, weatherCausationProven: false, throughputProven: false, repaired: false });
    expect(f.game()).toEqual(before); expect(f.game().world.completedObjectiveIds).not.toContain(q('O08'));
    expect(f.game().world.activeAllyIds).toEqual([]); expect(f.game().world.completedQuestIds).toEqual([]);
  });
  it('executes the frozen boundary20 through actual evaluateRadio and actual reducer records', () => {
    const expected = oracle.cases.find((c: any) => c.id === 'OPT-SQ03-BOUNDARY').expected;
    const reference = physical.reviewCases.find((c: any) => c.id === 'B-RADIO-20');
    const f = fixture(); f.measure('O08', 2); f.choose('mitigate-emitter'); f.choose('channel-B'); f.measure('O08', 3);
    const physicalResult = evaluateRadio({ kind: 'radio-snr', profile, signal: reference.inputs.signal, noise: reference.inputs.noise, otherPathChecks: true },
      { ...action(f.game(), null), input: { kind: 'measure-snr' } }, f.game().world);
    receipts['OPT-SQ03-BOUNDARY'] = physicalResult;
    expect(physicalResult.status).toBe('correct'); expect(physicalResult.observations[0]).toMatchObject({ snr: { value: expected.snrDb, unit: 'dB' }, thresholdMet: expected.scenarioThresholdMet, throughputProven: expected.throughputGuaranteed });
    expect(evaluate(f, { ...correct(), comparison: 'increased', currentAssessment: 'meets-threshold' }).status).toBe('correct');
  });
  it('accepts the reverse reviewed13→25 and same13→13 comparisons without an author-preferred direction', () => {
    const f = fixture(); f.measure('O08', 2); f.choose('mitigate-emitter'); f.measure('O08', 3);
    expect(evaluate(f, { ...correct(), comparison: 'increased', currentAssessment: 'meets-threshold' }).status).toBe('correct');
    const same = fixture(); same.measure('O08', 2); same.choose('channel-B'); same.measure('O08', 3);
    expect(evaluate(same, { ...correct(), comparison: 'unchanged' }).status).toBe('correct');
  });
  it('executes the frozen stale-prediction boundary after mitigation without making a measurement', () => {
    const f = pair(); f.choose('mitigate-emitter'); const before = structuredClone(f.game());
    const result = evaluate(f); receipts['OPT-SQ03-STALE-PREDICTION'] = result;
    expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'diary-current-measurement-required', acceptedEffects: [] });
    expect(f.game()).toEqual(before); expect(f.game().notebook.measurements.at(-1)?.stale).toBe(true);
    expect(f.game().world.completedQuestIds).toEqual([]);
  });
  it.each(['comparison', 'threshold', 'history', 'weather', 'throughput'])('rejects the well-formed wrong %s conclusion without modifying the link', wrong => {
    const f = pair(), answer = { ...correct() };
    if (wrong === 'comparison') answer.comparison = 'increased';
    if (wrong === 'threshold') answer.currentAssessment = 'meets-threshold';
    if (wrong === 'history') answer.evidenceClaim = 'earlier-proves-current';
    if (wrong === 'weather') answer.evidenceClaim = 'weather-proven';
    if (wrong === 'throughput') answer.evidenceClaim = 'throughput-proven';
    const before = structuredClone(f.game()), result = evaluate(f, answer);
    expect(result.status).toBe('incorrect'); expect(result.acceptedEffects).toEqual([]); expect(f.game()).toEqual(before);
  });
  it.each([null, {}, '', { ...correct(), earlierMeasurementId: '' }, { ...correct(), currentAssessment: '' }, { ...correct(), comparison: 1 },
    { ...correct(), effects: candidate.effects }, { ...correct(), correct: true }, { ...correct(), freshVersion: 999 }, { ...correct(), signal: { value: -65, unit: 'dBm' } }])('rejects empty/malformed/forged input %j', answer => {
    const result = evaluate(pair(), answer); expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['missing-earlier', 'same-id', 'reverse', 'same-revision', 'wrong-attempt', 'explicit-stale', 'stale-capture', 'not-latest'])('rejects %s evidence without learner failure', kind => {
    const f = pair(), game = structuredClone(f.game()), answer = { ...correct() };
    if (kind === 'missing-earlier') answer.earlierMeasurementId = id(99);
    if (kind === 'same-id') answer.earlierMeasurementId = answer.laterMeasurementId;
    if (kind === 'reverse') { answer.earlierMeasurementId = id(3); answer.laterMeasurementId = id(2); }
    if (kind === 'same-revision') (game.notebook.measurements[1] as any).configurationRevision = game.world.configurationRevision;
    if (kind === 'wrong-attempt') (game.notebook.measurements[2] as any).attemptId = id(98);
    if (kind === 'explicit-stale') (game.notebook.measurements[2] as any).stale = true;
    if (kind === 'not-latest') (game.notebook.measurements as any[]).push({ ...game.notebook.measurements[2], id: id(4) });
    const captured = action(game, answer);
    const result = kind === 'stale-capture' ? evaluateDiaryAnswer(activity.delivery, f.registry, { ...captured, expectedVersion: { ...game.world, configurationRevision: (game.world.configurationRevision - 1) as ConfigurationRevision } }, game)
      : evaluateDiaryAnswer(activity.delivery, f.registry, captured, game);
    expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
  });
  it.each(['room', 'rule', 'subject', 'quantity', 'unit', 'path', 'conclusion', 'future-revision', 'channel', 'duplicate-id'])('rejects corrupt original %s provenance as a content error', kind => {
    const f = pair(), game: any = structuredClone(f.game()), old = game.notebook.measurements[1];
    if (kind === 'room') old.roomId = q('R07');
    if (kind === 'rule') old.ruleId = q('PHY08');
    if (kind === 'subject') old.subjectIds = [q('PROFILE-RADIO')];
    if (kind === 'quantity') old.readings[4].value = 26;
    if (kind === 'unit') old.readings[2].unit = 'dB';
    if (kind === 'path') old.readings[0].value = 0;
    if (kind === 'conclusion') old.conclusionCode = 'I-made-this-up';
    if (kind === 'future-revision') old.configurationRevision = game.world.configurationRevision + 1;
    if (kind === 'channel') old.conclusionCode = 'O08:ACTION-O08-scenario-channel-B:correct';
    if (kind === 'duplicate-id') game.notebook.measurements.push(structuredClone(old));
    expect(evaluate(f, correct(), game).status).toBe('content-error');
  });
  it('requires current record to match the actual scenario, not just a caller-preserved revision', () => {
    const f = pair(), game: any = structuredClone(f.game()); game.world.flags[q('FLAG-radio-conditions')] = 'surveyed';
    expect(evaluate(f, correct(), game)).toMatchObject({ status: 'invalid-input', reasonCode: 'diary-current-measurement-required' });
  });
  it('rejects unsupported delivery content before empty input', () => {
    const f = pair();
    for (const changed of [{ ...activity.delivery, currentRequired: false }, { ...activity.delivery, sourceCaseIds: ['T08'] }, { ...activity.delivery, effects: candidate.effects }]) {
      expect(evaluateDiaryAnswer(changed, f.registry, action(f.game(), null), f.game()).status).toBe('content-error');
    }
  });
  it('never promotes a missing or boundary-card record into notebook evidence', () => {
    const f = fixture(), before = structuredClone(f.game()); const result = evaluate(f); receipts['missing-evidence'] = result;
    expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'diary-missing-evidence' }); expect(f.game()).toEqual(before);
  });
  it('accepts an actual20→19.99 comparison using the independently reviewed near-boundary case without rounded threshold or invented provenance', () => {
    const f = fixture(); f.choose('mitigate-emitter'); f.choose('channel-B'); f.measure('O08', 2); f.choose('boundary-exercise'); f.measure('O08', 4);
    const result = evaluate(f, { ...correct(), laterMeasurementId: id(4) }); receipts['reviewed-near-boundary-comparison'] = result;
    expect(result).toMatchObject({ status: 'correct', acceptedEffects: [] });
    expect(result.observations[0]).toMatchObject({ snrChange: { value: -0.01, unit: 'dB' }, currentLinkPass: false,
      earlier: { record: f.game().notebook.measurements[1] }, later: { record: f.game().notebook.measurements[2], physicalStatus: 'incorrect' } });
    expect((result.observations[0] as any).earlier).not.toHaveProperty('sourceCaseId');
    expect((result.observations[0] as any).later).not.toHaveProperty('sourceCaseId');
    const fixed = physical.reviewCases.find((c: any) => c.id === 'B-RADIO-BELOW');
    expect(fixed.expected.status).toBe('incorrect'); expect(fixed.inputs.noise).toEqual({ value: -84.99, unit: 'dBm' });
    expect(f.game().notebook.measurements.at(-1)?.readings).toContainEqual({ name: 'Signal-to-noise ratio', value: 19.99, unit: 'dB' });
  });
});

describe('existing reducer receipt and encounter Retry boundaries, not common activity acceptance', () => {
  function award(f: ReturnType<typeof fixture>, effects = f.effects) {
    // Trusted effect-boundary probe only. Common T100 must select this batch
    // solely after a matching full-diary session validates the actual answer.
    return f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'scoped-sq03-receipt', observations: [], acceptedEffects: effects } });
  }
  it('awards the full quest+fact batch once, preserves the current failed link and required progress', () => {
    const f = pair(), before = structuredClone(f.game()); expect(evaluate(f).status).toBe('correct');
    expect(award(f).status).toBe('applied'); expect(award(f).status).toBe('no-op'); expect(unlocked(f.game())).toBe(true);
    expect(f.game().notebook.factIds.filter(x => x === q('FACT-SQ03-comparison'))).toHaveLength(1);
    expect(f.game().world.completedQuestIds).toEqual([q('SQ03')]);
    for (const key of ['inventory', 'completedObjectiveIds', 'activeAllyIds', 'recruits', 'flags', 'route'] as const) expect(f.game().world[key]).toEqual(before.world[key]);
    expect(f.game().notebook.measurements).toEqual(before.notebook.measurements);
    expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it.each(['fact', 'quest'])('rejects a partial %s receipt batch', part => {
    const f = pair(); const result = award(f, f.effects.filter(e => e.kind === (part === 'fact' ? 'record-fact' : 'complete-quest')));
    expect(result).toMatchObject({ status: 'rejected', reason: 'content-error' }); expect(unlocked(f.game())).toBe(false);
  });
  it('raw correct proposal output cannot award a quest or change measurements', () => {
    const f = pair(), before = structuredClone(f.game());
    f.send({ kind: 'apply', evaluation: evaluate(f) }); expect(f.game()).toEqual(before); expect(unlocked(f.game())).toBe(false);
  });
  it('actual encounter Retry retains comparison learning but rewinds completion and stales both measurements', () => {
    const f = pair(), original = structuredClone(f.game()); award(f);
    const failed = f.state(); f.replace({ ...failed, runtime: { ...failed.runtime, activity: { kind: 'terminal-failure' }, checkpoint: {
      adventureId: original.adventureId, world: { ...original.world, roomId: q('R11'), position: { safePositionId: q('R11.preparation') } },
    } } });
    const result = f.send({ kind: 'rewind-preparation', nextAttemptId: id(111) as unknown as AttemptId });
    receipts['existing-encounter-retry'] = { status: result.status, reason: result.reason, game: f.game() };
    expect(result.status).toBe('applied'); expect(f.game().world.completedQuestIds).toEqual([]);
    expect(f.game().notebook.factIds).toContain(q('FACT-SQ03-comparison')); expect(unlocked(f.game())).toBe(false);
    expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true);
    expect(f.game().world.configurationRevision).toBeGreaterThan(original.world.configurationRevision);
    expect(f.game().notebook.personalNotes).toBe(original.notebook.personalNotes);
    expect(f.game().world.inventory).toEqual(original.world.inventory); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
});
