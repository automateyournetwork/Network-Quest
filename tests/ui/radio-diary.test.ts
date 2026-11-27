// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { copySemanticAction } from '../../src/ui/action-bus';
import { evaluateDiaryAnswer } from '../../src/state/optional-radio-diary';
import type { RadioDiarySubmission } from '../../src/state/optional-radio-diary';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { SaveValidator } from '../../src/services/save-validator';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { createReducerState } from '../../src/state/reducer';
import type { ClientGeneration } from '../../src/state/types';
import type { ActionId } from '../../src/domain/types';
import { diaryFixture, definition, mid, q, registry, world } from './radio-diary-fixture';
const answer = (): RadioDiarySubmission => ({ earlierMeasurementId: mid(2), laterMeasurementId: mid(3), comparison: 'decreased', currentAssessment: 'below-threshold', evidenceClaim: 'current-reading-only-no-cause' });
const submit = (f: ReturnType<typeof diaryFixture>, value = answer()) => f.send({ kind: 'submit-optional-diary', sessionId: f.session(), answer: value });
const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
const oracle = JSON.parse(readFileSync('tests/fixtures/optional-activities.json', 'utf8'));
const delivery = () => { if (definition.optionalActivity.kind !== 'radio-weather-diary') throw new Error('Wrong actual variant'); return definition.optionalActivity.delivery; };
describe('SQ03 actual loaded controller, captured diary answers and persistence boundary', () => {
  it('preserves the frozen optional oracle and promotes the exact reviewed candidate', () => {
    expect(readFileSync('content/spec001/quests/SQ03.json', 'utf8')).toBe(readFileSync('docs/evidence/spec001/optional/SQ03/SQ03.candidate.json', 'utf8'));
    const baseline = JSON.parse(readFileSync('docs/evidence/spec001/optional/SQ03/input-baseline.json', 'utf8'));
    expect(createHash('sha256').update(readFileSync('tests/fixtures/optional-activities.json')).digest('hex')).toBe(baseline['tests/fixtures/optional-activities.json']);
  });
  it('opens without a radio completion or suitable pair and keeps delivery unavailable while practice records help only', () => {
    const f = diaryFixture(false), before = f.game(); expect(f.start().status).toBe('handled');
    expect(f.controller.project().view).toMatchObject({ answerKind: 'diary', diary: { available: false, records: [] }, completed: false });
    f.mode('delivery'); expect(f.state().control.optionalActivity?.mode).toBeNull(); expect(f.controller.project().view?.feedback).toContain('needs an earlier actual');
    f.mode('practice'); expect(f.controller.project().view?.feedback).toContain('exactly 20 dB');
    expect(f.game().assistance).toMatchObject([{ objectiveId: q('SQ03'), level: 2 }]);
    expect(submit(f).status).toBe('rejected'); expect(f.game().world).toEqual(before.world); expect(f.game().notebook.measurements).toEqual(before.notebook.measurements);
    expect(f.simple('exit-optional').status).toBe('handled'); expect(f.game().world.inventory).toEqual(before.world.inventory);
  });
  it('correctly diagnoses the actual25→13 failure, records exact once-only completion and exposes gated depth', () => {
    const f = diaryFixture(), before = structuredClone(f.game()), fixed = oracle.cases.find((c: any) => c.id === 'OPT-SQ03-COMPARE');
    const physical = evaluateDiaryAnswer(delivery(), registry, { actionId: 'check' as ActionId, expectedVersion: f.game().world, input: answer() }, f.game());
    expect(physical.status).toBe(fixed.expected.learnerStatus); expect(physical.observations[0]).toMatchObject({ currentLinkPass: fixed.expected.currentLinkPass, snrChange: { value: -12, unit: 'dB' }, repaired: false, weatherCausationProven: false });
    f.start(); f.mode('delivery'); expect(submit(f).status).toBe('handled');
    expect(f.game().world.completedQuestIds).toEqual([q('SQ03')]); expect(f.game().world.completedObjectiveIds).not.toContain(q('O08'));
    expect(f.controller.project().view?.diary?.depth?.title).toBe('Radio depth: a diary is not a forecast');
    const completed = f.game(); submit(f); expect(f.game().world).toEqual(completed.world); expect(f.game().notebook.factIds.filter(x => x === q('FACT-SQ03-comparison'))).toHaveLength(1);
    for (const key of ['inventory', 'activeAllyIds', 'completedObjectiveIds', 'flags'] as const) expect(f.game().world[key]).toEqual(before.world[key]);
    expect(f.game().notebook.measurements).toEqual(before.notebook.measurements);
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(false); f.simple('exit-optional'); expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true);
  });
  it.each(['wrong-comparison', 'old-proof', 'weather', 'throughput', 'blank'])('does not award %s and distinguishes assistance from invalid input', kind => {
    const f = diaryFixture(); f.start(); f.mode('delivery'); const value = answer();
    const changed = kind === 'wrong-comparison' ? { ...value, comparison: 'increased' as const } : kind === 'blank' ? { ...value, currentAssessment: null }
      : { ...value, evidenceClaim: kind === 'old-proof' ? 'earlier-proves-current' as const : kind === 'weather' ? 'weather-proven' as const : 'throughput-proven' as const };
    expect(submit(f, changed).status).toBe('handled'); expect(f.game().world.completedQuestIds).toEqual([]);
    expect(f.state().control.optionalActivity?.result).toBe(kind === 'blank' ? 'invalid-input' : 'incorrect');
    expect(f.game().assistance.length).toBe(kind === 'blank' ? 0 : 1); expect(f.controller.project().view?.diary?.depth).toBeNull();
  });
  it('accepts actual20→19.99 without rounding failure, and accepts the restored inclusive20 boundary', () => {
    const f = diaryFixture(false); f.choose('mitigate-emitter'); f.choose('channel-B'); f.objective('O08', 'measure', 2); f.choose('boundary-exercise'); f.objective('O08', 'measure', 3);
    f.start(); f.mode('delivery'); expect(submit(f).status).toBe('handled'); expect(f.game().world.completedQuestIds).toContain(q('SQ03'));
    f.simple('exit-optional'); f.choose('mitigate-emitter'); f.objective('O08', 'measure', 4);
    const fixed = oracle.cases.find((c: any) => c.id === 'OPT-SQ03-BOUNDARY');
    const result = evaluateDiaryAnswer(delivery(), registry, { actionId: 'boundary' as ActionId, expectedVersion: f.game().world,
      input: { ...answer(), earlierMeasurementId: mid(3), laterMeasurementId: mid(4), comparison: 'increased', currentAssessment: 'meets-threshold' } }, f.game());
    expect(result.status).toBe('correct'); expect(result.observations[0]).toMatchObject({ later: { observation: { snr: { value: fixed.expected.snrDb }, thresholdMet: true } }, throughputProven: false });
  });
  it('executes the frozen stale-prediction case after actual mitigation without taking another measurement', () => {
    const f = diaryFixture(); f.choose('mitigate-emitter'); const before = structuredClone(f.game());
    expect(oracle.cases.find((c: any) => c.id === 'OPT-SQ03-STALE-PREDICTION').expected.comparisonCompletionEligible).toBe(false);
    const result = evaluateDiaryAnswer(delivery(), registry, { actionId: 'stale' as ActionId, expectedVersion: f.game().world, input: answer() }, f.game());
    expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'diary-current-measurement-required', acceptedEffects: [] });
    f.start(); expect(f.controller.project().view?.diary?.available).toBe(false); f.mode('delivery'); expect(f.state().control.optionalActivity?.mode).toBeNull();
    expect(f.game()).toEqual(before); expect(f.game().notebook.measurements.at(-1)?.stale).toBe(true);
  });
  it('stales retained real readings on Retry, preserves earned depth, and requires leaving to remeasure', () => {
    const f = diaryFixture(); f.start(); f.mode('delivery'); submit(f); const before = f.game(); f.simple('retry-optional');
    expect(f.game().world.attemptId).not.toBe(before.world.attemptId); expect(f.game().world.configurationRevision).toBeGreaterThan(before.world.configurationRevision);
    expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true); expect(f.controller.project().view?.diary).toMatchObject({ available: false });
    expect(f.controller.project().view?.diary?.depth).not.toBeNull(); expect(f.game().notebook.personalNotes).toBe(before.notebook.personalNotes);
    expect(f.game().world.inventory).toEqual(before.world.inventory); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
    f.simple('exit-optional'); f.objective('O08', 'measure', 4); f.start(); f.mode('delivery');
    expect(submit(f, { ...answer(), laterMeasurementId: mid(4) }).status).toBe('handled'); expect(f.game().world.completedQuestIds).toEqual([q('SQ03')]);
  });
  it('does not unlock optional depth from a fact retained without quest completion', () => {
    const f = diaryFixture(), state = f.state(), game = f.game(); f.replace({ ...state, runtime: { ...state.runtime, game: { ...game, notebook: { ...game.notebook, factIds: [...game.notebook.factIds, q('FACT-SQ03-comparison')] } } } });
    f.start(); expect(f.controller.project().view?.diary?.depth).toBeNull(); expect(f.controller.project().view?.rewardText).toBeNull();
  });
  it.each(['mode', 'account', 'restore'])('rejects original captured callbacks after %s changes', boundary => {
    const f = diaryFixture(); f.start(); f.mode('delivery'); const captured = f.controller.project().capture({ kind: 'submit-optional-diary', sessionId: f.session(), answer: answer() });
    if (boundary === 'mode') f.mode('practice');
    else if (boundary === 'account') { const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, auth: { ...s.runtime.auth, clientGeneration: (s.runtime.auth.clientGeneration + 1) as ClientGeneration } } }); }
    else { const s = f.state(); f.replace(createReducerState({ ...s.runtime, game: structuredClone(s.runtime.game), activity: { kind: 'stable-exploration' } })); }
    const before = f.state(); expect(f.bus.dispatch(captured).status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.game().world.completedQuestIds).toEqual([]);
  });
  it.each(['start', 'practice', 'submit', 'retry', 'exit'])('failed %s CAS installs no partial state', step => {
    const f = diaryFixture(); if (step !== 'start') { f.start(); f.mode('delivery'); } const before = f.state(); f.block(true);
    const result = step === 'start' ? f.start() : step === 'practice' ? f.mode('practice') : step === 'submit' ? submit(f) : f.simple(step === 'retry' ? 'retry-optional' : 'exit-optional');
    expect(result.status).toBe('rejected'); expect(f.state()).toBe(before);
  });
  it('copies closed selections and rejects caller status/effects/provenance before dispatch', () => {
    const mutable = { ...answer() }, command = copySemanticAction({ kind: 'submit-optional-diary', sessionId: mid(111), answer: mutable }); mutable.comparison = 'increased';
    expect(command).toMatchObject({ answer: { comparison: 'decreased' } });
    for (const key of ['correct', 'effects', 'freshVersion', 'signal']) expect(() => copySemanticAction({ kind: 'submit-optional-diary', sessionId: mid(111), answer: { ...answer(), [key]: true } } as never)).toThrow();
  });
  it('treats string-coercible objects as malformed adapter input, never an incorrect learner answer', () => {
    const f = diaryFixture();
    for (const key of ['comparison', 'currentAssessment', 'evidenceClaim'] as const) {
      const value = answer(), malformed = { ...value, [key]: { toString: () => value[key] } };
      const result = evaluateDiaryAnswer(delivery(), registry, { actionId: 'malformed' as ActionId, expectedVersion: f.game().world, input: malformed }, f.game());
      expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'malformed-diary-answer', acceptedEffects: [] });
    }
  });
  it('presents useful provenance without UUIDs, raw IDs or internal conclusion codes', () => {
    const f = diaryFixture(); f.start(); const rows = f.controller.project().view!.diary!.records;
    expect(rows.map(row => row.text).join(' ')).toContain('Storm Observatory');
    expect(rows[0]?.text).toContain('Historical observation; not current proof'); expect(rows[0]?.text).toContain('earlier configuration');
    expect(rows.at(-1)?.text).toContain('Current observation and configuration'); expect(rows.at(-1)?.text).toContain('Below the supplied minimum');
    for (const row of rows) expect(`${row.label} ${row.text}`).not.toMatch(/spec001:|[0-9a-f]{8}-[0-9a-f]{4}-|configurationRevision|conclusionCode|scenario-channel/);
  });
  it('refuses to display worked practice when assistance cannot be recorded at its bound', () => {
    const f = diaryFixture(); f.start(); const s = f.state(), game = f.game();
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...game, assistance: Array.from({ length: 2048 }, (_, n) => ({ objectiveId: q('O08'), hintId: q('HINT-O08-method'), level: 1, attemptId: mid(n) as never })) } } });
    const before = f.state(); expect(f.mode('practice').status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.controller.project().view?.feedback).toBeNull();
  });
});
