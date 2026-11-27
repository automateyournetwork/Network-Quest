// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import validateSchema from '../../src/content/schema.generated.js';
import type * as S from '../../src/content/schema-types.generated';
import { fiberEffectBindings, createFiberScenarioResolver, prepareFiberAction } from '../../src/state/fiber-scenario';
import { evaluateObjective, objectiveEffectBindings } from '../../src/state/objectives';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput } from '../../src/state/reducer';
import type { ActionId, AttemptId, MeasurementId, QualifiedId } from '../../src/domain/types';
import { authoredInput, setup } from '../ui/inventory-fixture';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const input = structuredClone(authoredInput);
const replaced = input.world.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || ['spec001:R05', 'spec001:R06'].includes(r.id) || r.path === 'content/spec001/dialogue/fiber-actions.json');
input.world.documents = input.world.documents.filter(r => !replaced.includes(r));
for (const { path } of replaced) delete input.documents[path];
for (const path of ['content/spec001/profiles.json', 'content/spec001/objectives.json', 'content/spec001/dialogue/fiber-actions.json', 'content/spec001/rooms/R05.json', 'content/spec001/rooms/R06.json']) {
  const value = await read<S.collection | S.room>(path);
  input.documents[path] = value;
  input.world.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path })));
}
const validated = validateContent(input);
if (!validated.ok || !validated.registry) throw new Error(JSON.stringify(validated.issues));
const registry = validated.registry;
const resolver = createFiberScenarioResolver(registry);

function fixture() {
  const old = setup().store.getState();
  let state = createReducerState({ ...old.runtime, game: { ...old.runtime.game!, world: { ...old.runtime.game!.world,
    roomId: q<'room'>('R05'), position: { safePositionId: q<'safe-position'>('R05.entry') }, flags: {},
    completedObjectiveIds: ['O01', 'O02'].map(id => q<'objective'>(id)), inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...old.runtime.game!.notebook, factIds: [], measurements: [] } } });
  const reduce = createReducer({ registry, bindings: [...fiberEffectBindings(registry), ...objectiveEffectBindings(registry)], objectiveScenario: resolver });
  const game = () => state.runtime.game!;
  const send = (input: ReducerInput) => {
    const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state;
    return result;
  };
  const choose = (id: string) => send({ kind: 'apply', evaluation: prepareFiberAction(registry, game(), q(id)) });
  const move = (id: string) => send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'test-walk', observations: [], acceptedEffects: [] },
    destination: { roomId: q<'room'>(id), safePositionId: q<'safe-position'>(`${id}.entry`), activity: 'stable-exploration' } });
  const measure = (objective: string, id: number) => {
    const current = resolver(game(), q<'objective'>(objective)); if (!current) throw new Error('Missing scenario');
    return send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q<'objective'>(objective), alternativeId: current.alternativeId, id: uuid(id) } });
  };
  const submit = (objective: string, id: number) => {
    const current = resolver(game(), q<'objective'>(objective)); if (!current) throw new Error('Missing scenario');
    const operation = { kind: 'submit' as const, objectiveId: q<'objective'>(objective), alternativeId: current.alternativeId, measurementId: uuid(id) };
    const verdict = evaluateObjective(registry, resolver, game(), operation.objectiveId, { actionId: 'inspect-verdict' as ActionId, expectedVersion: game().world,
      input: { kind: operation.kind, alternativeId: operation.alternativeId, measurementId: operation.measurementId } });
    send({ kind: 'objective', operation });
    return verdict;
  };
  return { game, state: () => state, replace: (next: typeof state) => { state = next; }, choose, send, move, measure, submit };
}
const prepare = (f: ReturnType<typeof fixture>, intervention: 'clean' | 'replace' = 'clean', profile = 'matched') => {
  f.choose('ACTION-fiber-read-matching'); f.choose(`ACTION-fiber-profile-${profile}`);
  f.choose('ACTION-fiber-inspect-before'); f.choose(`ACTION-fiber-${intervention}`); f.choose(`ACTION-fiber-reinspect-${intervention}`);
};
const proveSetup = (f: ReturnType<typeof fixture>, path = 'A') => {
  prepare(f); f.measure('O05', 1); expect(f.submit('O05', 1).status).toBe('correct'); f.move('R06');
  f.choose('ACTION-fiber-read-compatibility'); f.choose(`ACTION-fiber-path-${path}`);
};

// Expected values below were authored before implementation from SPEC T04/T05/T07/T15
// and frozen T068 RR-O05/RR-O06 literals. No evaluator generates an answer key.
describe('T079 actual fiber actions and T074 controller join', () => {
  it('starts with an uninspected defect, mismatched wavelength and 10 dB test path; creates no proof', () => {
    const f = fixture();
    expect(resolver(f.game(), q('O05'))).toMatchObject({ kind: 'fiber-preparation', preparation: { inspectedBeforeChange: false, connectionDefectRemoved: false,
      checks: { mediaMatch: true, wavelengthDirectionMatch: false, rateMatch: true, connectorPolarityMatch: true, hostSupport: true } } });
    expect(resolver(f.game(), q('O06'))).toMatchObject({ kind: 'fiber-proof', path: { compatible: false, loss: { value: 10, unit: 'dB' } }, inspectionComplete: false });
    expect(f.game().notebook.measurements).toEqual([]);
    f.measure('O05', 1); expect(f.submit('O05', 1)).toMatchObject({ status: 'incorrect', reasonCode: 'incompatible-profiles', acceptedEffects: [] });
    expect(f.game().world.completedObjectiveIds).toEqual([q('O01'), q('O02')]);
  });
  it.each(['clean', 'replace'] as const)('requires an actual inspection before %s and actual reinspection afterward', intervention => {
    const f = fixture(); f.choose('ACTION-fiber-read-matching'); f.choose('ACTION-fiber-profile-matched');
    const before = f.game(); expect(f.choose(`ACTION-fiber-${intervention}`).status).toBe('rejected'); expect(f.game()).toBe(before);
    f.measure('O05', 1); expect(f.submit('O05', 1).reasonCode).toBe('inspect-before-changing');
    f.choose('ACTION-fiber-inspect-before'); f.measure('O05', 2); expect(f.submit('O05', 2).reasonCode).toBe('connection-defect-remains');
    f.choose(`ACTION-fiber-${intervention}`); f.measure('O05', 3); expect(f.submit('O05', 3).status).toBe('incorrect');
    f.choose(`ACTION-fiber-reinspect-${intervention}`); f.measure('O05', 4);
    expect(f.submit('O05', 4).status).toBe('correct'); expect(f.game().world.completedObjectiveIds).toContain(q('O05'));
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O06')); expect(f.game().notebook.measurements).toHaveLength(4);
  });
  it.each([['clean', 'A', 8, -11, 3], ['clean', 'B', 9, -12, 2], ['replace', 'A', 8, -11, 3], ['replace', 'B', 9, -12, 2]] as const)
   ('accepts %s with path %s, preserving independent receive/reserve arithmetic', (intervention, path, loss, receive, margin) => {
      const f = fixture(); prepare(f, intervention); f.measure('O05', 1); expect(f.submit('O05', 1).status).toBe('correct');
      f.move('R06'); f.choose('ACTION-fiber-read-compatibility'); f.choose(`ACTION-fiber-path-${path}`);
      f.measure('O06', 2);
      expect(f.game().notebook.measurements.at(-1)).toMatchObject({ roomId: q('R06'), ruleId: q('PHY06'), stale: false,
        subjectIds: [q('O06'), q('PROFILE-OPTICAL'), q('PR054')], conclusionCode: `O06:ACTION-O06-passive-path-${path}:correct`,
        readings: [{ name: 'Receive power', value: receive, unit: 'dBm' }, { name: 'Sensitivity reserve', value: margin, unit: 'dB' },
          { name: 'Sensitivity', value: -14, unit: 'dBm' }, { name: 'Maximum receive', value: -1, unit: 'dBm' },
          { name: 'Required reserve', value: 2, unit: 'dB' }, { name: 'Inspection complete', value: 1, unit: 'count' },
          { name: 'Transmit power', value: -3, unit: 'dBm' }, { name: 'Total passive loss', value: loss, unit: 'dB' }] });
      expect(f.submit('O06', 2).status).toBe('correct'); const completed = f.game(); f.submit('O06', 2); expect(f.game()).toBe(completed);
      expect(f.game().world.completedObjectiveIds).toEqual([q('O01'), q('O02'), q('O05'), q('O06')]);
      expect(f.game().world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]); expect(f.game().world.recruits).toEqual([]);
  });
  it.each(['wrong-fiber', 'wrong-wavelength', 'wrong-rate', 'wrong-polarity', 'unsupported-host'])('rejects %s independently before favorable power arithmetic', profile => {
    const f = fixture(); prepare(f, 'clean', profile); f.measure('O05', 1);
    expect(f.submit('O05', 1)).toMatchObject({ status: 'incorrect', reasonCode: 'incompatible-profiles', acceptedEffects: [] });
    // Recover by returning the reversible dock to its original supplied condition.
    f.choose('ACTION-fiber-restore-original'); prepare(f); f.measure('O05', 2); expect(f.submit('O05', 2).status).toBe('correct');
    f.choose('ACTION-fiber-restore-original'); prepare(f, 'replace', profile); f.move('R06'); f.choose('ACTION-fiber-read-compatibility'); f.choose('ACTION-fiber-path-A');
    f.measure('O06', 3); expect(f.submit('O06', 3)).toMatchObject({ status: 'incorrect', reasonCode: 'incompatible-profiles', acceptedEffects: [] });
    expect(f.game().notebook.measurements.at(-1)?.readings.some(r => r.name === 'Receive power')).toBe(false);
  });
  it('rejects 10 dB loss although receive is above sensitivity; both reviewed paths remain recoverable', () => {
    const f = fixture(); proveSetup(f); f.choose('ACTION-fiber-path-high-loss'); f.measure('O06', 2);
    expect(f.game().notebook.measurements.at(-1)?.readings).toEqual(expect.arrayContaining([
      { name: 'Receive power', value: -13, unit: 'dBm' }, { name: 'Sensitivity reserve', value: 1, unit: 'dB' }]));
    expect(f.submit('O06', 2)).toMatchObject({ status: 'incorrect', reasonCode: 'required-reserve-not-met', acceptedEffects: [] });
    f.choose('ACTION-fiber-path-B'); expect(f.submit('O06', 2).reasonCode).toBe('stale-evidence'); f.measure('O06', 3); expect(f.submit('O06', 3).status).toBe('correct');
  });
  it('retains old readings without refreshing them after changing path or attempt', () => {
    const f = fixture(); proveSetup(f); f.measure('O06', 2); f.choose('ACTION-fiber-path-B');
    const before = f.game(); expect(f.submit('O06', 2).reasonCode).toBe('stale-evidence'); expect(f.game()).toBe(before);
    expect(f.game().notebook.measurements.at(-1)?.stale).toBe(true);
    f.measure('O06', 3); const state = f.state(); f.replace({ ...state, runtime: { ...state.runtime, game: { ...f.game(), world: { ...f.game().world, attemptId: String(uuid(99)) as AttemptId } } } });
    expect(f.submit('O06', 3).reasonCode).toBe('stale-evidence'); f.measure('O06', 4); expect(f.submit('O06', 4).status).toBe('correct');
  });
  it('does not mistake a retained inspection fact or old O05 award for a currently prepared connection', () => {
    const f = fixture(); proveSetup(f); f.move('R05'); f.choose('ACTION-fiber-restore-original');
    expect(f.game().notebook.factIds).toContain(q('FACT-O05-inspection')); expect(f.game().world.completedObjectiveIds).toContain(q('O05'));
    f.move('R06'); f.measure('O06', 2); expect(f.submit('O06', 2)).toMatchObject({ status: 'incorrect', reasonCode: 'inspect-before-validating', acceptedEffects: [] });
    f.move('R05'); f.choose('ACTION-fiber-inspect-before'); f.choose('ACTION-fiber-clean'); f.choose('ACTION-fiber-reinspect-clean');
    f.move('R06'); f.measure('O06', 3); expect(f.submit('O06', 3).status).toBe('correct');
  });
  it('enforces briefing, room, kit and chronology guards; no early choice manufactures progress', () => {
    const f = fixture(), game = f.game();
    for (const id of ['ACTION-fiber-clean', 'ACTION-fiber-reinspect-clean', 'ACTION-fiber-reinspect-replace', 'ACTION-fiber-path-A', 'ACTION-fiber-unknown'])
      expect(prepareFiberAction(registry, game, q(id))).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
    for (const changed of [{ ...game, world: { ...game.world, inventory: [] } }, { ...game, world: { ...game.world, completedObjectiveIds: [] } }])
      expect(prepareFiberAction(registry, changed, q('ACTION-fiber-inspect-before'))).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
    prepare(f); const prepared = f.game(); expect(f.choose('ACTION-fiber-profile-wrong-fiber').status).toBe('rejected'); expect(f.game()).toBe(prepared);
    expect(f.game().notebook.measurements).toEqual([]); expect(f.game().world.completedObjectiveIds).toEqual([q('O01'), q('O02')]);
  });
  it('validates exact measurement provenance rather than accepting a nominal passing level', () => {
    const f = fixture(); proveSetup(f); f.measure('O06', 2); const original = f.state(), game = f.game(), reading = game.notebook.measurements.at(-1)!;
    for (const changed of [{ ...reading, roomId: q<'room'>('R05') }, { ...reading, subjectIds: [q('PROFILE-OPTICAL')] }, { ...reading, ruleId: q<'rule'>('PHY03') },
      { ...reading, readings: reading.readings.filter(r => r.name !== 'Maximum receive') }]) {
      f.replace({ ...original, runtime: { ...original.runtime, game: { ...game, notebook: { ...game.notebook, measurements: [changed] } } } });
      expect(f.submit('O06', 2).reasonCode).toBe('measurement-provenance-mismatch');
    }
    f.replace(original); expect(f.submit('O06', 2).status).toBe('correct');
  });
  it('rejects unknown saved flags without a passing default and returns detached scenarios', () => {
    const f = fixture();
    for (const flag of ['FLAG-fiber-connection', 'FLAG-fiber-profiles', 'FLAG-fiber-path']) for (const value of ['unsupported', true, 8]) {
      const game = { ...f.game(), world: { ...f.game().world, flags: { [q(flag)]: value } } };
      expect(resolver(game, q('O05'))).toBeNull(); expect(resolver(game, q('O06'))).toBeNull();
      expect(prepareFiberAction(registry, game, q('ACTION-fiber-inspect-before')).status).toBe('invalid-input');
    }
    expect(resolver(f.game(), q('O03'))).toBeNull(); const scenario = resolver(f.game(), q('O06'));
    if (scenario?.kind === 'fiber-proof') (scenario.path.loss as { value: number }).value = 999;
    expect(resolver(f.game(), q('O06'))).toMatchObject({ path: { loss: { value: 10, unit: 'dB' } } });
  });
  it('keeps hints nonpunitive and repeated inspection/reinspection set-like', () => {
    const f = fixture(); prepare(f); const before = f.game();
    f.choose('ACTION-fiber-read-matching'); f.choose('ACTION-fiber-reinspect-clean'); expect(f.game()).toBe(before);
    f.measure('O05', 1); const measured = f.game();
    for (let n = 0; n < 3; n++) f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O05') } });
    expect(f.game().world).toEqual(measured.world); expect(f.game().notebook).toEqual(measured.notebook); expect(f.game().assistance.map(h => h.level)).toEqual([1, 2, 3]);
    expect(f.submit('O05', 1).status).toBe('correct'); expect(fiberEffectBindings(registry).every(b => b.mode === 'repeatable')).toBe(true);
  });
  it.each(['direct-award', 'unconditional-award', 'manufactured-reading', 'unreviewed-profile', 'weakened-inspection'] as const)('rejects schema-valid %s authored actions', corruption => {
    const candidate = structuredClone(input), collection = candidate.documents['content/spec001/dialogue/fiber-actions.json'] as S.collection;
    const dock = collection.records.find(r => r.id === q('DIALOGUE-fiber-gardens')) as S.dialogue;
    const choice = dock.nodes[0]!.choices.find(c => c.id === q(corruption === 'unconditional-award' ? 'ACTION-fiber-read-matching' : 'ACTION-fiber-clean'))!;
    const effectId = q(corruption === 'unconditional-award' ? 'EFFECT-fiber-read-matching' : 'EFFECT-fiber-clean');
    if (corruption === 'direct-award' || corruption === 'unconditional-award') choice.effects = [{ kind: 'complete-objective', effectId, objectiveId: q('O05') }];
    if (corruption === 'manufactured-reading') choice.effects = [{ kind: 'record-fact', effectId, factId: q('FACT-O06-budget') }];
    if (corruption === 'unreviewed-profile') choice.effects = [{ kind: 'set-flag', effectId, flagId: q('FLAG-fiber-profiles'), value: 'magic-gain' }];
    if (corruption === 'weakened-inspection') choice.condition = { kind: 'always' };
    expect(validateSchema(collection), JSON.stringify(validateSchema.errors)).toBe(true);
    const result = validateContent(candidate);
    if (corruption === 'direct-award') {
      // A guarded structural award makes its inspection-state dependencies part
      // of route reachability. Conservative graph-bounds is rejection, not proof.
      expect(result.ok).toBe(false);
      expect(result.issues.some(issue => issue.code === 'graph-bounds')).toBe(true); return;
    }
    expect(result.ok, JSON.stringify(result.issues)).toBe(true); if (!result.ok || !result.registry) throw new Error('Invalid fixture');
    expect(fiberEffectBindings(result.registry)).toEqual([]); expect(createFiberScenarioResolver(result.registry)(fixture().game(), q('O05'))).toBeNull();
    expect(prepareFiberAction(result.registry, fixture().game(), choice.id as QualifiedId)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
});
