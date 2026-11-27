// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import { copperEffectBindings, createCopperScenarioResolver, prepareCopperAction } from '../../src/state/copper-scenario';
import { evaluateObjective, objectiveEffectBindings } from '../../src/state/objectives';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput } from '../../src/state/reducer';
import type { ActionId, MeasurementId, QualifiedId } from '../../src/domain/types';
import { authoredInput, routeDocument, setup } from '../ui/inventory-fixture';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const input = structuredClone(authoredInput);
const replaced = input.world.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || ['spec001:R03', 'spec001:R04'].includes(r.id) || r.path === 'content/spec001/dialogue/copper-actions.json');
input.world.documents = input.world.documents.filter(r => !replaced.includes(r));
for (const { path } of replaced) delete input.documents[path];
for (const path of ['content/spec001/profiles.json', 'content/spec001/objectives.json', 'content/spec001/dialogue/copper-actions.json', 'content/spec001/dialogue/copper-voices.json', 'content/spec001/rooms/R03.json', 'content/spec001/rooms/R04.json']) {
  const value = await read<S.collection | S.room>(path);
  input.documents[path] = routeDocument(value);
  input.world.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path })));
}
const validated = validateContent(input);
if (!validated.ok || !validated.registry) throw new Error(JSON.stringify(validated.issues));
const registry = validated.registry;
const resolver = createCopperScenarioResolver(registry);

function fixture() {
  const old = setup().store.getState();
  let state = createReducerState({ ...old.runtime, game: { ...old.runtime.game!, world: { ...old.runtime.game!.world,
    roomId: q<'room'>('R03'), position: { safePositionId: q<'safe-position'>('R03.entry') }, flags: {},
    completedObjectiveIds: ['O01', 'O02'].map(id => q<'objective'>(id)), inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...old.runtime.game!.notebook, factIds: [], measurements: [] } } });
  const reduce = createReducer({ registry, bindings: [...copperEffectBindings(registry), ...objectiveEffectBindings(registry)], objectiveScenario: resolver });
  const game = () => state.runtime.game!;
  const send = (input: ReducerInput) => {
    const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state;
    return result;
  };
  const choose = (id: string) => send({ kind: 'apply', evaluation: prepareCopperAction(registry, game(), q(id)) });
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
const readPreparation = (f: ReturnType<typeof fixture>) => { f.choose('ACTION-copper-read-compatibility'); f.choose('ACTION-copper-read-defect'); };
const readProof = (f: ReturnType<typeof fixture>) => { f.choose('ACTION-copper-read-before'); f.choose('ACTION-copper-read-repeater'); };

describe('T075 actual copper room scenario adapter', () => {
  it('measures the authored initial broken path before any repair choice, without inventing a before reading', () => {
    const f = fixture();
    expect(f.game().notebook.measurements).toEqual([]);
    expect(resolver(f.game(), q('O03'))).toMatchObject({ kind: 'copper-preparation', alternativeId: q('ACTION-O03-section-replacement'),
      path: { compatible: true, lengths: [{ value: 95, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, false, true] } });
    f.measure('O03', 1);
    expect(f.game().notebook.measurements[0]).toMatchObject({ id: uuid(1), conclusionCode: 'O03:ACTION-O03-section-replacement:incorrect',
      readings: expect.arrayContaining([{ name: 'Total channel length', value: 105, unit: 'm' }, { name: 'Open required conductors', value: 1, unit: 'count' }]) });
    expect(f.submit('O03', 1)).toMatchObject({ status: 'incorrect', acceptedEffects: [] });
    expect(f.game().world.completedObjectiveIds).toEqual([q('O01'), q('O02')]);
  });
  it.each([['ACTION-copper-replace-section', 95], ['ACTION-copper-alternate-path', 100]] as const)('completes both scoped objectives with %s and %i m through real measurement and once effects', (choice, total) => {
    const f = fixture(); readPreparation(f); f.measure('O03', 1);
    f.choose(choice);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O03'));
    expect(f.game().notebook.measurements[0]?.stale).toBe(true);
    f.measure('O03', 2);
    expect(f.game().notebook.measurements[1]?.readings).toContainEqual({ name: 'Total channel length', value: total, unit: 'm' });
    expect(f.submit('O03', 2).status).toBe('correct');
    expect(f.game().world.completedObjectiveIds).toContain(q('O03'));
    f.move('R04'); readProof(f); f.choose('ACTION-copper-repeater-requires-continuity');
    expect(resolver(f.game(), q('O04'))).toMatchObject({ beforeMeasurementId: uuid(1), repeaterClaim: 'requires-continuity' });
    f.measure('O04', 3);
    expect(f.submit('O04', 3).status).toBe('correct');
    const completed = f.game(); f.submit('O04', 3);
    expect(f.game()).toBe(completed);
    expect(f.game().world.completedObjectiveIds).toEqual([q('O01'), q('O02'), q('O03'), q('O04')]);
    expect(f.game().world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    expect(f.game().world.recruits).toEqual([]);
  });
  it('a repair chosen too early recovers through an actual restored-open test, then a new repair and proof', () => {
    const f = fixture(); readPreparation(f); f.choose('ACTION-copper-replace-section'); f.measure('O03', 1); f.submit('O03', 1);
    f.move('R04'); readProof(f); f.choose('ACTION-copper-repeater-requires-continuity');
    expect(resolver(f.game(), q('O04'))).toMatchObject({ beforeMeasurementId: null });
    f.measure('O04', 2);
    expect(f.submit('O04', 2)).toMatchObject({ status: 'incorrect', reasonCode: 'before-open-evidence-missing', acceptedEffects: [] });
    f.move('R03'); f.choose('ACTION-copper-restore-original'); f.measure('O03', 3);
    expect(f.game().notebook.measurements.find(m => m.id === uuid(3))?.readings).toContainEqual({ name: 'Open required conductors', value: 1, unit: 'count' });
    f.choose('ACTION-copper-alternate-path'); f.move('R04'); f.measure('O04', 4);
    expect(f.submit('O04', 4).status).toBe('correct');
    expect(f.game().world.completedObjectiveIds).toContain(q('O04'));
    expect(f.game().notebook.measurements.find(m => m.id === uuid(3))?.stale).toBe(true);
  });
  it('keeps a role choice missing until selected and rejects the explicit repeater-only claim', () => {
    const f = fixture(); readPreparation(f); f.measure('O03', 1); f.choose('ACTION-copper-replace-section'); f.measure('O03', 2); f.submit('O03', 2); f.move('R04'); readProof(f);
    expect(resolver(f.game(), q('O04'))).toMatchObject({ repeaterClaim: null });
    expect(f.measure('O04', 3).status).toBe('rejected');
    expect(f.game().notebook.measurements).toHaveLength(2);
    f.choose('ACTION-copper-repeater-bridges-open'); f.measure('O04', 3);
    expect(f.submit('O04', 3)).toMatchObject({ status: 'incorrect', reasonCode: 'repeater-cannot-bridge-open', acceptedEffects: [] });
    f.choose('ACTION-copper-repeater-requires-continuity');
    expect(f.submit('O04', 3).reasonCode).toBe('stale-evidence');
    f.measure('O04', 4); expect(f.submit('O04', 4).status).toBe('correct');
  });
  it('preserves old readings and requires a new explicit measurement after a path change', () => {
    const f = fixture(); readPreparation(f); f.choose('ACTION-copper-replace-section'); f.measure('O03', 1);
    f.choose('ACTION-copper-alternate-path'); const before = f.game();
    expect(f.submit('O03', 1)).toMatchObject({ status: 'incorrect', reasonCode: 'stale-evidence', acceptedEffects: [] });
    expect(f.game()).toBe(before); expect(f.game().notebook.measurements).toHaveLength(1);
    f.measure('O03', 2); expect(f.submit('O03', 2).status).toBe('correct');
  });
  it('reading context is not a performed test and cannot by itself complete an objective', () => {
    const f = fixture(); readPreparation(f); f.choose('ACTION-copper-replace-section');
    expect(f.game().notebook.factIds).toEqual([q('FACT-O03-compatibility'), q('FACT-O03-defect')]);
    expect(f.game().notebook.measurements).toEqual([]);
    expect(f.submit('O03', 1).reasonCode).toBe('measurement-missing');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O03'));
  });
  it('enforces room, briefing and ordinary-tool conditions before bench mutations', () => {
    const f = fixture(); const before = f.game();
    expect(prepareCopperAction(registry, before, q('ACTION-copper-repeater-requires-continuity')).status).toBe('invalid-input');
    for (const changed of [{ ...before, world: { ...before.world, inventory: [] } }, { ...before, world: { ...before.world, completedObjectiveIds: [] } }])
      expect(prepareCopperAction(registry, changed, q('ACTION-copper-replace-section'))).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
    expect(prepareCopperAction(registry, before, q('ACTION-unreviewed-copper'))).toMatchObject({ status: 'invalid-input', acceptedEffects: [] });
    expect(f.game()).toBe(before);
  });
  it('rejects unknown configuration values rather than silently returning a passing default', () => {
    const f = fixture();
    for (const value of ['invented-path', true, 95]) expect(resolver({ ...f.game(), world: { ...f.game().world, flags: { [q('FLAG-copper-path')]: value } } }, q('O03'))).toBeNull();
    expect(resolver({ ...f.game(), world: { ...f.game().world, flags: { [q('FLAG-copper-repeater-claim')]: 'guaranteed-service' } } }, q('O04'))).toBeNull();
    expect(resolver(f.game(), q('O06'))).toBeNull();
  });
  it('selects only a real matching open record and keeps returned scenarios detached from game state', () => {
    const f = fixture(); f.measure('O03', 1); const game = f.game();
    const scenario = resolver(game, q('O04'));
    expect(scenario).toMatchObject({ beforeMeasurementId: uuid(1) });
    for (const changed of [{ ...game.notebook.measurements[0]!, roomId: q<'room'>('R01') }, { ...game.notebook.measurements[0]!, subjectIds: [q('PROFILE-OPTICAL')] },
      { ...game.notebook.measurements[0]!, conclusionCode: 'O03:ACTION-O03-section-replacement:correct' }, { ...game.notebook.measurements[0]!, readings: [] }]) {
      expect(resolver({ ...game, notebook: { ...game.notebook, measurements: [changed] } }, q('O04'))).toMatchObject({ beforeMeasurementId: null });
    }
    const copy = structuredClone(game); if (scenario?.kind === 'copper-proof') (scenario.path.lengths as { value: number; unit: 'm' }[])[0]!.value = 999;
    expect(game).toEqual(copy); expect(resolver(game, q('O03'))).toMatchObject({ path: { lengths: [{ value: 95, unit: 'm' }, { value: 10, unit: 'm' }] } });
  });
  it('uses the most recent valid historical baseline when an older loose match is malformed', () => {
    const f = fixture(); readPreparation(f); f.measure('O03', 1);
    const previous = f.state(), initial = f.game().notebook.measurements[0]!;
    f.replace({ ...previous, runtime: { ...previous.runtime, game: { ...f.game(), notebook: { ...f.game().notebook,
      measurements: [{ ...initial, readings: initial.readings.map(r => r.name === 'Inclusive maximum' && r.unit === 'm' ? { ...r, value: 99 as typeof r.value } : r) }] } } } });
    // These later baselines are generated by actual measure operations, not copied
    // from an expected output. Both remain usable historical records after repair.
    f.measure('O03', 2); f.measure('O03', 3); f.choose('ACTION-copper-replace-section');
    f.measure('O03', 4); expect(f.submit('O03', 4).status).toBe('correct');
    f.move('R04'); readProof(f); f.choose('ACTION-copper-repeater-requires-continuity');
    expect(resolver(f.game(), q('O04'))).toMatchObject({ beforeMeasurementId: uuid(3) });
    expect(f.game().notebook.measurements.filter(m => [uuid(2), uuid(3)].includes(m.id)).every(m => m.stale)).toBe(true);
    expect(f.game().notebook.measurements[0]?.readings).toContainEqual({ name: 'Inclusive maximum', value: 99, unit: 'm' });
    f.measure('O04', 5); expect(f.submit('O04', 5).status).toBe('correct');
  });
  it('hints remain separate from configuration and accept a valid assisted repair without penalty', () => {
    const f = fixture(); readPreparation(f); f.choose('ACTION-copper-replace-section'); f.measure('O03', 1); const before = f.game();
    for (let n = 0; n < 3; n++) f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O03') } });
    expect(f.game().world).toEqual(before.world); expect(f.game().notebook).toEqual(before.notebook);
    expect(f.game().assistance.map(h => h.level)).toEqual([1, 2, 3]); expect(f.submit('O03', 1).status).toBe('correct');
  });
  it('replaying context and the already selected path adds no facts, readings, consumption or revision', () => {
    const f = fixture(); readPreparation(f); f.choose('ACTION-copper-replace-section'); f.measure('O03', 1);
    const before = f.game(); readPreparation(f); f.choose('ACTION-copper-replace-section');
    expect(f.game()).toBe(before);
    expect(f.game().notebook.measurements[0]?.stale).toBe(false);
    expect(copperEffectBindings(registry).every(binding => binding.mode === 'repeatable')).toBe(true);
    expect(objectiveEffectBindings(registry, [q('O03'), q('O04')])).toEqual([
      { sourceId: q('O03'), effectId: q('EFFECT-O03'), mode: 'once', receipt: { kind: 'objective', id: q('O03') } },
      { sourceId: q('O04'), effectId: q('EFFECT-O04'), mode: 'once', receipt: { kind: 'objective', id: q('O04') } },
    ]);
  });
  it.each(['unreviewed-path', 'direct-completion', 'manufactured-reading'] as const)('rejects %s in authored action data without binding it', corruption => {
    const candidate = structuredClone(input);
    const collection = candidate.documents['content/spec001/dialogue/copper-actions.json'] as S.collection;
    const bench = collection.records.find(r => r.id === q('DIALOGUE-copper-bench')) as S.dialogue;
    const choice = bench.nodes[0]!.choices.find(c => c.id === q('ACTION-copper-replace-section'))!;
    const effectId = q('EFFECT-copper-replace-section');
    if (corruption === 'unreviewed-path') choice.effects = [{ kind: 'set-flag', effectId, flagId: q('FLAG-copper-path'), value: 'unreviewed-active-180m' }];
    if (corruption === 'direct-completion') choice.effects = [{ kind: 'complete-objective', effectId, objectiveId: q('O03') }];
    if (corruption === 'manufactured-reading') choice.effects = [{ kind: 'record-fact', effectId, factId: q('FACT-O03-path') }];
    const result = validateContent(candidate);
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok || !result.registry) throw new Error('Expected structurally valid but unsupported interaction');
    expect(copperEffectBindings(result.registry)).toEqual([]);
    expect(createCopperScenarioResolver(result.registry)(fixture().game(), q('O03'))).toBeNull();
    expect(prepareCopperAction(result.registry, fixture().game(), choice.id as QualifiedId)).toMatchObject({ status: 'content-error', acceptedEffects: [] });
  });
});
