// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, MeasurementId } from '../../src/domain/types';
import type { ToySymbolProfile } from '../../src/domain/packet-journey';
import { equipmentFlags, clockworksSamples, inspectClockworksSamples, resolveEquipmentScenario, equipmentInteractionBindings, createEquipmentScenarioResolver } from '../../src/state/equipment-scenarios';
import { evaluateObjective, objectiveEffectBindings } from '../../src/state/objectives';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState, StateEffect } from '../../src/state/reducer';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import { createVerbController } from '../../src/ui/verbs';
import { createDiagnosticsController } from '../../src/ui/diagnostics';
import { q, setup } from '../ui/inventory-fixture';

const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const world = await read<S.world>('content/spec001/world.json');
const sources = await read<unknown>('content/spec001/sources.json');
const documents = Object.fromEntries(await Promise.all([...new Set(world.documents.map(r => r.path))].map(async path => [path, await read<unknown>(path)])));
for (const ref of world.documents.filter(r => r.kind === 'objective' || r.kind === 'profile')) delete documents[ref.path];
world.documents = world.documents.filter(r => r.kind !== 'objective' && r.kind !== 'profile');
for (const path of ['content/spec001/profiles.json', 'content/spec001/objectives.json', 'content/spec001/dialogue/equipment-actions.json']) {
  const collection = await read<S.collection>(path); documents[path] = collection;
  world.documents.push(...collection.records.map(r => ({ id: r.id, kind: r.kind, path })) as S.world['documents']);
}
for (const id of ['R09', 'R10']) {
  const path = `content/spec001/rooms/${id}.json`; documents[path] = await read(path);
  world.documents.push({ id: q<'room'>(id), kind: 'room', path });
}
const content = validateContent({ world, sources, documents });
if (!content.ok || !content.registry) throw new Error(JSON.stringify(content.issues));
const registry = content.registry;
const controls = (documents['content/spec001/dialogue/equipment-actions.json'] as S.collection).records.filter((r): r is S.dialogue => r.kind === 'dialogue');
const bindings = equipmentInteractionBindings(registry);
const resolver = createEquipmentScenarioResolver(registry);
const symbolRecord = registry.record(q('PROFILE-SYMBOLS'));
if (symbolRecord?.kind !== 'profile') throw new Error('Missing symbols');
const symbols = { id: symbolRecord.id, parameters: symbolRecord.parameters } as unknown as ToySymbolProfile;
const uuid = (number: number) => `00000000-0000-4000-8000-${String(number).padStart(12, '0')}` as MeasurementId;
function fixture(objective: 'O09' | 'O10') {
  const initial = setup().store.getState();
  let state = createReducerState({ ...initial.runtime, game: { ...initial.runtime.game!, world: { ...initial.runtime.game!.world,
    roomId: q<'room'>(objective === 'O09' ? 'R09' : 'R10'), position: { safePositionId: q<'safe-position'>(`${objective === 'O09' ? 'R09' : 'R10'}.entry`) },
    flags: {}, completedObjectiveIds: ['O01', 'O02'].map(id => q<'objective'>(id)), inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...initial.runtime.game!.notebook, factIds: [], measurements: [] } } });
  const reduce = createReducer({ registry, bindings: [...objectiveEffectBindings(registry), ...bindings.effects], objectiveScenario: resolver });
  const store = { getState: () => state, reduce, compareAndSet: (before: ReducerState, next: ReducerState) => { if (state !== before) return false; state = next; return true; } };
  const send = (input: ReducerInput) => {
    const game = state.runtime.game!;
    const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
    if (result.status !== 'rejected') state = result.state;
    return result;
  };
  const select = (suffix: string) => {
    const choice = controls.flatMap(d => d.nodes.flatMap(n => n.choices)).find(c => c.id === q(`ACTION-${suffix}`));
    if (!choice) throw new Error(suffix);
    return send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-preparation-choice', observations: [], acceptedEffects: choice.effects as StateEffect[] } });
  };
  const game = () => state.runtime.game!;
  const scenario = () => resolveEquipmentScenario(game(), q<'objective'>(objective));
  const measure = (id: number) => {
    const selected = scenario(); if (!selected) throw new Error('Incomplete choices');
    return send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q<'objective'>(objective), alternativeId: selected.alternativeId, id: uuid(id) } });
  };
  const submit = (id: number) => {
    const selected = scenario(); if (!selected) throw new Error('Incomplete choices');
    return send({ kind: 'objective', operation: { kind: 'submit', objectiveId: q<'objective'>(objective), alternativeId: selected.alternativeId, measurementId: uuid(id) } });
  };
  return { game, select, scenario, measure, submit, send, store };
}
function calibration(f: ReturnType<typeof fixture>, method = 'step-and-decode') {
  for (const choice of ['equipment-mode-100-full', `clock-${method}`, 'clock-role-physical', 'clock-read-scope']) expect(f.select(choice).status).not.toBe('rejected');
  for (const [i, pair] of ['00', '10', '11', '01'].entries()) expect(f.select(`clock-pair-${i}-${pair}`).status).not.toBe('rejected');
}

describe('T076 actual world-choice resolver joined to T074 and the real reducer', () => {
  it('does not fill missing choices with a correct kit, mode, decoded answer or role', () => {
    for (const objective of ['O09', 'O10'] as const) {
      const f = fixture(objective), before = structuredClone(f.game());
      expect(f.scenario()).toBeNull();
      expect(resolveEquipmentScenario(f.game(), q<'objective'>('O03'))).toBeNull();
      expect(f.game()).toEqual(before);
      const result = evaluateObjective(registry, resolveEquipmentScenario, f.game(), q<'objective'>(objective), {
        actionId: 'missing-choices' as ActionId, expectedVersion: f.game().world,
        input: { kind: 'measure', alternativeId: q(`ACTION-${objective}-${objective === 'O09' ? 'compatible-kit-A' : 'step-and-decode'}`), id: uuid(1) },
      });
      expect(result.status).toBe('invalid-input'); expect(result.acceptedEffects).toEqual([]);
    }
  });
  it.each(['compatible-kit-A', 'compatible-kit-B'])('compares a failing 33 W baseline to %s and requires a fresh captured reading', kit => {
    const f = fixture('O09');
    for (const choice of ['market-original-over-budget', 'equipment-mode-100-full', 'market-read-checklist']) expect(f.select(choice).status).not.toBe('rejected');
    expect(f.measure(1).status).not.toBe('rejected');
    expect(f.game().notebook.measurements[0]!.readings).toEqual(expect.arrayContaining([{ name: 'Total delivered demand', value: 33, unit: 'W' }, { name: 'Delivered excess', value: 3, unit: 'W' }]));
    f.submit(1); expect(f.game().world.completedObjectiveIds).not.toContain(q('O09'));
    f.select(`market-${kit}`);
    expect(f.game().notebook.measurements[0]!.stale).toBe(true);
    const afterChoice = structuredClone(f.game().notebook.measurements);
    f.submit(1);
    expect(f.game().notebook.measurements).toEqual(afterChoice);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O09'));
    f.measure(2);
    expect(f.game().notebook.measurements[1]!.readings).toEqual(expect.arrayContaining([{ name: 'Total delivered demand', value: kit.endsWith('A') ? 23 : 30, unit: 'W' }, { name: 'Delivered headroom', value: kit.endsWith('A') ? 7 : 0, unit: 'W' }]));
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O09'));
    f.submit(2);
    expect(f.game().world.completedObjectiveIds).toContain(q('O09'));
    expect(f.game().world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
  });
  it.each(['same-shell-mismatch', 'per-port-failure'])('preserves the explicit failed %s choice and rejects equipment readiness', kit => {
    const f = fixture('O09');
    for (const choice of [`market-${kit}`, 'equipment-mode-100-full', 'market-read-checklist']) f.select(choice);
    const current = f.scenario();
    expect(current?.kind).toBe('equipment');
    if (current?.kind !== 'equipment') return;
    expect(current.allocation[kit === 'same-shell-mismatch' ? 'phyAndMediaMatch' : 'perPortConstraintsMet']).toBe(false);
    f.measure(1); f.submit(1);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O09'));
  });
  it.each(['1000-full', '10-half'])('does not turn unsupported selected %s into a common capability', mode => {
    const f = fixture('O09');
    for (const choice of ['market-compatible-kit-A', `equipment-mode-${mode}`, 'market-read-checklist']) f.select(choice);
    f.measure(1); f.submit(1);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O09'));
    expect(f.game().notebook.measurements[0]!.readings).toContainEqual({ name: 'Common mode supported', value: 0, unit: 'count' });
  });
  it.each(['step-and-decode', 'notebook-and-replay'])('accepts %s from four separately entered pairs only after measure and explicit submit', method => {
    const f = fixture('O10'); calibration(f, method);
    const before = structuredClone(f.game());
    expect(f.scenario()).toMatchObject({ kind: 'calibration', alternativeId: q(`ACTION-O10-${method}`), decodedBits: '00101101', samples: clockworksSamples });
    expect(f.game()).toEqual(before);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    f.measure(1); expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    f.submit(1); expect(f.game().world.completedObjectiveIds).toContain(q('O10'));
  });
  it('records a wrong pair, then preserves its stale reading until a corrected answer is measured', () => {
    const f = fixture('O10'); calibration(f); f.select('clock-pair-2-00');
    expect(f.scenario()).toMatchObject({ decodedBits: '00100001' });
    f.measure(1); f.submit(1); expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    f.select('clock-pair-2-11');
    const readings = structuredClone(f.game().notebook.measurements);
    expect(readings[0]!.stale).toBe(true);
    f.submit(1); expect(f.game().notebook.measurements).toEqual(readings);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    f.measure(2); f.submit(2); expect(f.game().world.completedObjectiveIds).toContain(q('O10'));
  });
  it('rejects correct bits with a claim that physical repeaters discover IP addresses', () => {
    const f = fixture('O10'); calibration(f); f.select('clock-role-address');
    f.measure(1); f.submit(1);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    expect(f.game().notebook.measurements[0]!.readings).toContainEqual({ name: 'Physical role distinguished', value: 0, unit: 'count' });
  });
  it('uses the real decoder for untimed sample prefixes/replay while preserving independent answers and no progress', () => {
    const f = fixture('O10');
    expect(inspectClockworksSamples(f.game(), symbols)).toBeNull();
    f.select('clock-pair-0-11'); // A deliberately wrong answer survives a helpful demonstration.
    for (const [position, bits] of ['00', '0010', '001011', '00101101'].entries()) {
      f.select(`clock-sample-${position}`);
      const before = structuredClone(f.game());
      const result = inspectClockworksSamples(f.game(), symbols)!;
      expect(result.status).toBe('correct');
      expect(result.observations).toMatchObject([{ bits, symbols: position + 1, representedBits: (position + 1) * 2, progressAward: 0 }]);
      expect(result.acceptedEffects).toEqual([]); expect(f.game()).toEqual(before);
    }
    f.select('clock-replay');
    expect(inspectClockworksSamples(f.game(), symbols)?.observations).toMatchObject([{ bits: '00', symbols: 1 }]);
    expect(f.game().world.flags[equipmentFlags.pairs[0]!]).toBe('11');
    expect(f.game().notebook.measurements).toEqual([]);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    expect(f.scenario()).toBeNull();
  });
  it('keeps hints nonpunitive and requires the readable scope fact even when all technical answers pass', () => {
    const f = fixture('O10');
    for (const choice of ['equipment-mode-100-full', 'clock-step-and-decode', 'clock-role-physical']) f.select(choice);
    for (const [i, pair] of ['00', '10', '11', '01'].entries()) f.select(`clock-pair-${i}-${pair}`);
    for (let i = 0; i < 3; i++) f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q<'objective'>('O10') } });
    expect(f.game().assistance.map(h => h.level)).toEqual([1, 2, 3]);
    f.measure(1); f.submit(1); expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
    f.select('clock-read-scope');
    // Recording a fact changes no physical setting and does not auto-measure.
    expect(f.game().notebook.measurements).toHaveLength(1);
    f.submit(1); expect(f.game().world.completedObjectiveIds).toContain(q('O10'));
    expect(f.game().assistance.map(h => h.level)).toEqual([1, 2, 3]);
  });
  it('refuses malformed selections and uses copied scenario data without mutating world state', () => {
    const f = fixture('O10'); calibration(f);
    const current = f.game(), before = structuredClone(current);
    for (const [flag, invalid] of [[equipmentFlags.capability, '10000/full'], [equipmentFlags.method, 'timed-speedrun'], [equipmentFlags.role, 'login-proven'], [equipmentFlags.pairs[2]!, '1111']] as const) {
      expect(resolveEquipmentScenario({ ...current, world: { ...current.world, flags: { ...current.world.flags, [flag]: invalid } } }, q<'objective'>('O10'))).toBeNull();
    }
    expect(inspectClockworksSamples({ ...current, world: { ...current.world, flags: { ...current.world.flags, [equipmentFlags.sample]: 4 } } }, symbols)).toBeNull();
    expect(resolveEquipmentScenario({ ...current, world: { ...current.world, roomId: q<'room'>('R02') } }, q<'objective'>('O10'))).toBeNull();
    const scene = f.scenario();
    if (scene?.kind !== 'calibration') throw new Error('Missing calibration');
    (scene.samples as unknown as { value: number }[])[0]!.value = 3;
    expect(f.scenario()).toMatchObject({ samples: clockworksSamples });
    expect(current).toEqual(before);
  });
  it('joins authored choices through the shared verb bus and submits the exact measurement selected in diagnostics', () => {
    const f = fixture('O09'), bus = createActionBus({ getContext: () => contextFromRuntime(f.store.getState().runtime) });
    const verbs = createVerbController({ bus, registry, store: f.store, bindings: bindings.hotspots });
    const diagnostics = createDiagnosticsController({ bus, registry, store: f.store, resolveScenario: resolver });
    const select = (target: string, choice: string) => bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q(`HOTSPOT-${target}`), choiceId: q(`ACTION-${choice}`), verb: 'use', itemId: null }));
    try {
      expect(select('market-case', 'market-compatible-kit-A').status).toBe('handled');
      expect(select('market-chart', 'equipment-mode-100-full').status).toBe('handled');
      expect(select('market-case', 'market-read-checklist').status).toBe('handled');
      const first = diagnostics.project(q<'objective'>('O09'));
      expect(first.view.available).toBe(true);
      expect(bus.dispatch(first.capture({ kind: 'measure-objective', objectiveId: q<'objective'>('O09'), alternativeId: first.view.alternative!.id })).status).toBe('handled');
      const captured = diagnostics.project(q<'objective'>('O09'));
      const oldId = captured.view.measurements[0]!.id;
      const oldSubmission = captured.capture({ kind: 'submit-objective', objectiveId: q<'objective'>('O09'), alternativeId: captured.view.alternative!.id, measurementId: oldId });
      expect(f.game().world.completedObjectiveIds).not.toContain(q('O09'));
      select('market-case', 'market-compatible-kit-B');
      expect(bus.dispatch(oldSubmission).status).toBe('rejected');
      expect(f.game().notebook.measurements).toHaveLength(1);
      const changed = diagnostics.project(q<'objective'>('O09'));
      expect(changed.view.measurements[0]).toMatchObject({ id: oldId, freshness: 'stale', eligible: false });
      expect(bus.dispatch(changed.capture({ kind: 'measure-objective', objectiveId: q<'objective'>('O09'), alternativeId: changed.view.alternative!.id })).status).toBe('handled');
      const current = diagnostics.project(q<'objective'>('O09')), newId = current.view.measurements[1]!.id;
      expect(newId).not.toBe(oldId);
      expect(bus.dispatch(current.capture({ kind: 'submit-objective', objectiveId: q<'objective'>('O09'), alternativeId: current.view.alternative!.id, measurementId: newId })).status).toBe('handled');
      expect(f.game().world.completedObjectiveIds).toContain(q('O09'));
      expect(f.game().notebook.measurements.map(m => m.id)).toEqual([oldId, newId]);
    } finally { diagnostics.dispose(); verbs.dispose(); bus.dispose(); }
  });
  it('uses the shared verb bus for untimed sample controls while the decoder leaves answers and progress untouched', () => {
    const f = fixture('O10'), bus = createActionBus({ getContext: () => contextFromRuntime(f.store.getState().runtime) });
    const verbs = createVerbController({ bus, registry, store: f.store, bindings: bindings.hotspots });
    try {
      for (const [choice, bits] of [['clock-sample-3', '00101101'], ['clock-replay', '00']]) {
        expect(bus.dispatch(bus.capture({ kind: 'choose-hotspot-action', targetId: q('HOTSPOT-clockworks-samples'), choiceId: q(`ACTION-${choice}`), verb: 'use', itemId: null })).status).toBe('handled');
        expect(inspectClockworksSamples(f.game(), symbols)?.observations).toMatchObject([{ bits, progressAward: 0 }]);
        expect(equipmentFlags.pairs.every(flag => f.game().world.flags[flag] === undefined)).toBe(true);
        expect(f.game().world.completedObjectiveIds).not.toContain(q('O10'));
        expect(f.game().notebook.measurements).toEqual([]);
      }
    } finally { verbs.dispose(); bus.dispose(); }
  });
  it.each(['unrelated flag', 'completion effect', 'changed value', 'wrong condition', 'another node', 'missing target'])(
    'rejects %s in an otherwise editable authored action before exposing effects or a resolver', mutation => {
      const source = structuredClone(registry.record(q('DIALOGUE-market-equipment'))) as S.dialogue;
      const room = structuredClone(registry.record(q('R09'))) as S.room;
      const selected = source.nodes[0]!.choices.find(c => c.id === q('ACTION-market-compatible-kit-A'))!;
      if (mutation === 'unrelated flag') (selected.effects[0] as Extract<S.effect, { kind: 'set-flag' }>).flagId = q('FLAG-unrelated');
      if (mutation === 'completion effect') selected.effects = [{ kind: 'complete-objective', effectId: q('EFFECT-market-compatible-kit-A'), objectiveId: q('O09') }];
      if (mutation === 'changed value') (selected.effects[0] as Extract<S.effect, { kind: 'set-flag' }>).value = 'compatible-kit-B';
      if (mutation === 'wrong condition') selected.condition = { kind: 'always' };
      if (mutation === 'another node') source.entryNodeId = q('DIALOGUE-clockwork-answers-entry');
      if (mutation === 'missing target') room.hotspots.find(h => h.id === q('HOTSPOT-market-case'))!.actionIds = [];
      const changed = { ...registry, record: (id: string) => id === source.id ? source : id === room.id ? room : registry.record(id) };
      expect(() => equipmentInteractionBindings(changed)).toThrow(TypeError);
      expect(createEquipmentScenarioResolver(changed)(fixture('O09').game(), q<'objective'>('O09'))).toBeNull();
    },
  );
});
