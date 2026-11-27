// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { createReducer } from '../../src/state/reducer';
import { evaluateObjective } from '../../src/state/objectives';
import type { ObjectiveInput } from '../../src/state/objectives';
import type { ActionId, DomainAction } from '../../src/domain/types';
import { fixture, q, registry, scenario, uuid } from './objectives-fixture';

function evaluate(f: ReturnType<typeof fixture>, objective: string, input: ObjectiveInput | null) {
  const game = f.store.getState().runtime.game!;
  return evaluateObjective(registry, f.resolver, game, q(objective), { actionId: 'evaluation' as ActionId, expectedVersion: game.world, input } as DomainAction<ObjectiveInput>);
}
describe('T074 objective evaluation through canonical state', () => {
  it.each(['O03', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10'])('%s accepts both independently reviewed ordinary alternatives', objective => {
    for (const second of [false, true]) {
      const f = fixture(objective, scenario(objective, second));
      expect(f.measure().status).toBe('applied');
      expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q(objective));
      expect(evaluate(f, objective, { kind: 'submit', alternativeId: scenario(objective, second).alternativeId, measurementId: uuid() }).status).toBe('correct');
      expect(f.submit().status).toBe('applied');
      expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toContain(q(objective));
      const before = f.store.getState(); expect(f.submit().status).toBe('no-op');
      expect(f.store.getState().runtime.game).toBe(before.runtime.game);
      expect(f.store.getState().runtime.persistence.dirtyGeneration).toBe(2);
    }
  });
  it.each(['revision', 'attempt', 'explicit'])('T13 rejects %s freshness independently and retains the observation', mode => {
    const f = fixture('O06'); f.measure(); const before = f.store.getState(), game = before.runtime.game!, m = game.notebook.measurements[0]!;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, notebook: { ...game.notebook, measurements: [{ ...m,
      ...(mode === 'revision' ? { configurationRevision: (m.configurationRevision - 1) as typeof m.configurationRevision } : mode === 'attempt' ? { attemptId: '00000000-0000-4000-8000-999999999999' as typeof m.attemptId } : { stale: true }) }] } } } });
    const stale = f.store.getState();
    expect(evaluate(f, 'O06', { kind: 'submit', alternativeId: scenario('O06').alternativeId, measurementId: uuid() })).toMatchObject({ status: 'incorrect', reasonCode: 'stale-evidence', acceptedEffects: [] });
    f.submit(); expect(f.store.getState().runtime.game).toBe(stale.runtime.game);
  });
  it('rejects missing evidence without silently taking a measurement', () => {
    const f = fixture('O08');
    expect(evaluate(f, 'O08', { kind: 'submit', alternativeId: scenario('O08').alternativeId, measurementId: uuid() }).reasonCode).toBe('measurement-missing');
    f.submit(); expect(f.store.getState().runtime.game!.notebook.measurements).toEqual([]);
  });
  it('T14 malformed current challenge precedes absent learner action', () => {
    const f = fixture('O06'); const malformed = structuredClone(scenario('O06'));
    if (malformed.kind !== 'fiber-proof') throw new Error();
    delete (malformed.path.loss as { unit?: string }).unit; f.change(malformed);
    expect(evaluate(f, 'O06', null)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
    const before = f.store.getState(); expect(f.measure().status).toBe('rejected'); expect(f.store.getState()).toBe(before);
  });
  it('empty action remains invalid input with valid source data', () => {
    expect(evaluate(fixture(), 'O03', null)).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
  });
  it('does not turn an actual failed physical result into completion', () => {
    const f = fixture('O08'), failing = scenario('O08'); if (failing.kind !== 'radio-proof') throw new Error();
    f.change({ ...failing, path: { ...failing.path, noise: { value: -78, unit: 'dBm' } } }); f.measure();
    expect(f.store.getState().runtime.game!.notebook.measurements[0]!.readings).toContainEqual({ name: 'Signal-to-noise ratio', value: 13, unit: 'dB' });
    expect(evaluate(f, 'O08', { kind: 'submit', alternativeId: failing.alternativeId, measurementId: uuid() }).status).toBe('incorrect');
    f.submit(); expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O08'));
  });
  it('tracks method, worked step and solution separately without changing world or readings', () => {
    const f = fixture('O06'); f.measure(); const original = f.store.getState().runtime.game!;
    for (let i = 0; i < 4; i++) f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O06') } });
    const game = f.store.getState().runtime.game!;
    expect(game.assistance.map(h => h.level)).toEqual([1, 2, 3]); expect(game.world).toEqual(original.world);
    expect(game.notebook).toEqual(original.notebook); expect(f.submit().status).toBe('applied');
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toContain(q('O06'));
  });
});

describe('T074 content and observation provenance', () => {
  it.each([
    ['O03', 'path', 'kind'], ['O03', 'path', 'profile'], ['O05', 'preparation', 'kind'], ['O05', 'preparation', 'profile'],
    ['O06', 'path', 'kind'], ['O06', 'path', 'profile'], ['O07', 'path', 'kind'], ['O07', 'path', 'profile'],
    ['O08', 'path', 'kind'], ['O08', 'path', 'profile'], ['O09', 'allocation', 'kind'], ['O09', 'allocation', 'profile'],
  ])('rejects %s nested %s.%s overrides before missing input', (objective, field, key) => {
    const f = fixture(objective), changed = structuredClone(scenario(objective)) as unknown as Record<string, unknown>;
    (changed[field!] as Record<string, unknown>)[key!] = key === 'kind' ? 'unreviewed-topology' : { id: 'unknown' };
    f.change(changed as unknown as ReturnType<typeof scenario>);
    expect(evaluate(f, objective, null)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
  it.each(['rule', 'room', 'subject', 'reading', 'conclusion', 'value'])('rejects changed %s provenance on a current measurement', field => {
    const f = fixture('O06'); f.measure(); const before = f.store.getState(), game = before.runtime.game!, original = game.notebook.measurements[0]!;
    const m = structuredClone(original);
    if (field === 'rule') (m as { ruleId: string }).ruleId = q('PHY07');
    if (field === 'room') (m as { roomId: string }).roomId = q('R05');
    if (field === 'subject') (m as { subjectIds: readonly string[] }).subjectIds = [q('O06')];
    if (field === 'reading') (m as { readings: readonly unknown[] }).readings = [];
    if (field === 'conclusion') (m as { conclusionCode: string }).conclusionCode = 'passing';
    if (field === 'value') (m.readings[0] as { value: number }).value = 0;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, notebook: { ...game.notebook, measurements: [m] } } } });
    expect(evaluate(f, 'O06', { kind: 'submit', alternativeId: scenario('O06').alternativeId, measurementId: uuid() }).reasonCode).toBe('measurement-provenance-mismatch');
  });
  it('does not let a mitigation refresh the prior radio reading even if the model now passes', () => {
    const f = fixture('O08'), bad = scenario('O08'); if (bad.kind !== 'radio-proof') throw new Error();
    f.change({ ...bad, path: { ...bad.path, noise: { value: -78, unit: 'dBm' } } }); f.measure();
    const before = f.store.getState(), game = before.runtime.game!;
    f.change(scenario('O08')); f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, world: { ...game.world, configurationRevision: (game.world.configurationRevision + 1) as typeof game.world.configurationRevision } } } });
    expect(evaluate(f, 'O08', { kind: 'submit', alternativeId: bad.alternativeId, measurementId: uuid() }).reasonCode).toBe('stale-evidence');
    expect(f.store.getState().runtime.game!.notebook.measurements[0]!.readings).toContainEqual({ name: 'Signal-to-noise ratio', value: 13, unit: 'dB' });
    f.measure(uuid(2)); expect(f.submit(uuid(2)).status).toBe('applied');
  });
  it('distinguishes an old captured command from current submission of old evidence', () => {
    const f = fixture('O06'); f.measure(); const game = f.store.getState().runtime.game!;
    const result = evaluateObjective(registry, f.resolver, game, q('O06'), { actionId: 'old-action' as ActionId,
      expectedVersion: { ...game.world, configurationRevision: (game.world.configurationRevision + 1) as typeof game.world.configurationRevision },
      input: { kind: 'submit', alternativeId: scenario('O06').alternativeId, measurementId: uuid() } });
    expect(result).toMatchObject({ status: 'invalid-input', reasonCode: 'stale-action', acceptedEffects: [] });
  });
  it('requires prerequisite, actual tool and observed facts independently', () => {
    for (const missing of ['prerequisite', 'tool', 'fact']) {
      const f = fixture('O03'); f.measure(); const before = f.store.getState(), game = before.runtime.game!;
      f.replace({ ...before, runtime: { ...before.runtime, game: { ...game,
        world: { ...game.world, ...(missing === 'prerequisite' ? { completedObjectiveIds: [] } : missing === 'tool' ? { inventory: [] } : {}) },
        notebook: { ...game.notebook, ...(missing === 'fact' ? { factIds: [] } : {}) } } } });
      expect(evaluate(f, 'O03', { kind: 'submit', alternativeId: scenario('O03').alternativeId, measurementId: uuid() }).status).toBe('incorrect');
      f.submit(); expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q('O03'));
    }
  });
  it('refuses to award later lifecycle objectives from a scenario or arrival alone', () => {
    const f = fixture();
    for (const objective of ['O11', 'O12']) expect(evaluate(f, objective, { kind: 'submit', alternativeId: q(`ACTION-${objective}-copper`), measurementId: uuid() })).toMatchObject({ status: 'invalid-input', reasonCode: 'objective-lifecycle-unavailable', acceptedEffects: [] });
  });
});

function copperProof() {
  const broken = fixture(), s = scenario('O03'); if (s.kind !== 'copper-preparation') throw new Error();
  broken.change({ ...s, path: { ...s.path, requiredConductors: [true, false, true, true] } }); broken.measure(uuid(90));
  const historical = broken.store.getState().runtime.game!.notebook.measurements[0]!;
  const f = fixture('O04'), before = f.store.getState(), game = before.runtime.game!;
  f.replace({ ...before, runtime: { ...before.runtime, game: { ...game,
    world: { ...game.world, configurationRevision: (game.world.configurationRevision + 1) as typeof game.world.configurationRevision },
    notebook: { ...game.notebook, measurements: [{ ...historical, stale: true }] } } } });
  return f;
}
describe('T074 actual copper before/after comparison', () => {
  it('accepts a real historical stale open and a fresh current intact result', () => {
    const f = copperProof(); expect(f.measure().status).toBe('applied');
    expect(evaluate(f, 'O04', { kind: 'submit', alternativeId: scenario('O04').alternativeId, measurementId: uuid() }).status).toBe('correct');
    expect(f.submit().status).toBe('applied'); expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toContain(q('O04'));
  });
  it.each(['room', 'profile', 'objective', 'reading', 'conclusion', 'future'])('rejects historical baseline with invalid %s', field => {
    const f = copperProof(), before = f.store.getState(), game = before.runtime.game!, m = structuredClone(game.notebook.measurements[0]!);
    if (field === 'room') (m as { roomId: string }).roomId = q('R01');
    if (field === 'profile') (m as { subjectIds: readonly string[] }).subjectIds = m.subjectIds.filter(id => id !== q('PROFILE-COPPER-100'));
    if (field === 'objective') (m as { subjectIds: readonly string[] }).subjectIds = m.subjectIds.filter(id => id !== q('O03'));
    if (field === 'reading') (m as { readings: readonly unknown[] }).readings = [];
    if (field === 'conclusion') (m as { conclusionCode: string }).conclusionCode = 'invented-open-before';
    if (field === 'future') (m as { configurationRevision: number }).configurationRevision = game.world.configurationRevision + 1;
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, notebook: { ...game.notebook, measurements: [m] } } } });
    f.measure(); expect(evaluate(f, 'O04', { kind: 'submit', alternativeId: scenario('O04').alternativeId, measurementId: uuid() })).toMatchObject({ status: 'incorrect', reasonCode: 'before-open-evidence-missing' });
  });
  it('missing baseline or unchosen repeater role never fabricates a measured history', () => {
    const f = fixture('O04'), s = scenario('O04'); if (s.kind !== 'copper-proof') throw new Error();
    f.change({ ...s, beforeMeasurementId: null }); expect(evaluate(f, 'O04', { kind: 'measure', alternativeId: s.alternativeId, id: uuid() }).reasonCode).toBe('before-open-evidence-missing');
    f.change({ ...s, beforeMeasurementId: null, repeaterClaim: null }); expect(evaluate(f, 'O04', { kind: 'measure', alternativeId: s.alternativeId, id: uuid() }).reasonCode).toBe('repeater-role-choice-missing');
  });
  it('rejects the claim that a repeater can bridge an open despite passing after arithmetic', () => {
    const f = copperProof(), s = scenario('O04'); if (s.kind !== 'copper-proof') throw new Error();
    f.change({ ...s, repeaterClaim: 'bridges-open' }); f.measure();
    expect(evaluate(f, 'O04', { kind: 'submit', alternativeId: s.alternativeId, measurementId: uuid() })).toMatchObject({ status: 'incorrect', reasonCode: 'repeater-cannot-bridge-open' });
  });
});

describe('T074 atomicity, limits and nonpunitive state retention', () => {
  it.each(['terminal-failure', 'shutdown'] as const)('retains actual newly revealed hints and observations through %s rewind', kind => {
    const f = fixture('O06'); f.measure(); f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O06') } });
    const before = f.store.getState(), game = before.runtime.game!;
    const checkpoint = { ...game.world, roomId: q<'room'>('R02'), position: { safePositionId: q<'safe-position'>('R02.entry') } };
    f.replace({ ...before, runtime: { ...before.runtime, activity: { kind }, checkpoint: { adventureId: game.adventureId, world: checkpoint } } });
    expect(f.send({ kind: 'rewind-preparation', nextAttemptId: uuid(999) as unknown as typeof game.world.attemptId }).status).toBe('applied');
    const after = f.store.getState().runtime.game!;
    expect(after.assistance).toEqual(game.assistance); expect(after.notebook.factIds).toEqual(game.notebook.factIds); expect(after.notebook.personalNotes).toBe(game.notebook.personalNotes);
    expect(after.notebook.measurements).toEqual(game.notebook.measurements.map(m => ({ ...m, stale: true })));
    expect(after.world.attemptId).not.toBe(game.world.attemptId); expect(after.world.configurationRevision).toBeGreaterThan(game.world.configurationRevision);
    expect(f.store.getState().runtime.persistence.pendingRequest).toBeNull();
  });
  it('records neither hints nor measurements while another transition is pending', () => {
    const f = fixture(), before = f.store.getState();
    expect(f.send({ kind: 'begin', activity: 'pending-effect', evaluation: { status: 'correct', reasonCode: 'fixture', observations: [], acceptedEffects: [] } }).status).toBe('pending');
    const pending = f.store.getState(); expect(f.measure().reason).toBe('transition-pending');
    expect(f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O03') } }).reason).toBe('transition-pending');
    expect(f.store.getState()).toBe(pending); expect(pending.runtime.game).toBe(before.runtime.game);
  });
  it('a missing canonical effect binding rolls back the entire completion', () => {
    const f = fixture(); f.measure(); const before = f.store.getState(), game = before.runtime.game!;
    const reduce = createReducer({ registry, bindings: [], objectiveScenario: f.resolver });
    const result = reduce(before, { actionId: 'unbound' as ActionId, expectedVersion: game.world, adventureId: game.adventureId,
      input: { kind: 'objective', operation: { kind: 'submit', objectiveId: q('O03'), alternativeId: scenario('O03').alternativeId, measurementId: uuid() } } });
    expect(result).toMatchObject({ status: 'rejected', reason: 'content-error' }); expect(result.state).toBe(before);
  });
  it('dirty generation exhaustion cannot leave a partial observation or hint', () => {
    const f = fixture(), before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence, dirtyGeneration: Number.MAX_SAFE_INTEGER as typeof before.runtime.persistence.dirtyGeneration } } });
    const exhausted = f.store.getState(); expect(f.measure().reason).toBe('generation-exhausted');
    expect(f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O03') } }).reason).toBe('generation-exhausted');
    expect(f.store.getState()).toBe(exhausted);
  });
  it.each(['O05', 'O06', 'O07', 'O09', 'O10'])('%s preserves explicit failed nonnumeric prerequisites', objective => {
    const f = fixture(objective), changed = scenario(objective);
    if (changed.kind === 'fiber-preparation') (changed.preparation.checks as { hostSupport: boolean }).hostSupport = false;
    else if (changed.kind === 'fiber-proof') (changed as { inspectionComplete: boolean }).inspectionComplete = false;
    else if (changed.kind === 'radio-preparation') (changed.path as { viablePath: boolean }).viablePath = false;
    else if (changed.kind === 'equipment') (changed.allocation as { perPortConstraintsMet: boolean }).perPortConstraintsMet = false;
    else if (changed.kind === 'calibration') (changed as { roleClaim: string }).roleClaim = 'physical-repeater-resolves-IP-address';
    f.change(changed); f.measure();
    expect(evaluate(f, objective, { kind: 'submit', alternativeId: changed.alternativeId, measurementId: uuid() }).status).toBe('incorrect');
    f.submit(); expect(f.store.getState().runtime.game!.world.completedObjectiveIds).not.toContain(q(objective));
  });
  it('malformed second predicate precedes an incorrect first predicate', () => {
    const f = fixture('O09'), changed = scenario('O09'); if (changed.kind !== 'equipment') throw new Error();
    (changed.allocation as { perPortConstraintsMet: boolean }).perPortConstraintsMet = false;
    (changed.capability as { bothNegotiate: boolean }).bothNegotiate = false; f.change(changed);
    expect(evaluate(f, 'O09', null)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
  it('never completes another selected alternative from the current proposal', () => {
    const f = fixture(); f.measure();
    expect(evaluate(f, 'O03', { kind: 'submit', alternativeId: scenario('O03', true).alternativeId, measurementId: uuid() })).toMatchObject({ status: 'invalid-input', reasonCode: 'selection-does-not-match-current-world' });
  });
});


it('T074 persisted measurements and assistance fit the unchanged save-v1 contract', async () => {
  const ajv = new Ajv2020({ strict: true, allErrors: true, allowUnionTypes: true }); addFormats(ajv);
  const validate = ajv.compile(JSON.parse(await readFile(new URL('../../specs/001-physical-layer-underworld/contracts/save.schema.json', import.meta.url), 'utf8')));
  for (const objective of ['O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10']) {
    const f = objective === 'O04' ? copperProof() : fixture(objective);
    f.measure(); f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q(objective) } }); f.submit();
    const snapshot = { ...f.store.getState().runtime.game!, saveSchemaVersion: 1, safeState: 'stable-exploration' };
    expect(validate(JSON.parse(JSON.stringify(snapshot))), JSON.stringify(validate.errors)).toBe(true);
  }
});
