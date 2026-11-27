// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Independent T094 preparation: execute EXISTING boundaries and pin the facts
// the future controller must accommodate. Passing these tests does not execute
// recruitment, an ability, progression, a party swap, a panel, or T094 acceptance.
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent, episodeNavigationEntries } from '../../../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../../../src/app/adventure';
import type { ActionId, FactId, MeasurementId, QualifiedId } from '../../../../src/domain/types';
import { createCopperScenarioResolver, copperEffectBindings } from '../../../../src/state/copper-scenario';
import { createFiberScenarioResolver, fiberEffectBindings } from '../../../../src/state/fiber-scenario';
import { createRadioScenarioResolver, radioEffectBindings } from '../../../../src/state/radio-scenario';
import { createEquipmentScenarioResolver, equipmentInteractionBindings } from '../../../../src/state/equipment-scenarios';
import { evaluateObjective, objectiveEffectBindings } from '../../../../src/state/objectives';
import type { ObjectiveScenarioResolver } from '../../../../src/state/objectives';
import { createNavigation } from '../../../../src/state/navigation';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../../../src/state/reducer';
import type { ReducerInput } from '../../../../src/state/reducer';
import type { FlagValue } from '../../../../src/state/types';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
const { registry, world } = loadIntroductionContent();
const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });
const resolvers = [createCopperScenarioResolver(registry), createFiberScenarioResolver(registry), createRadioScenarioResolver(registry), createEquipmentScenarioResolver(registry)];
const scenario: ObjectiveScenarioResolver = (game, objectiveId) => resolvers.map(resolve => resolve(game, objectiveId)).find(value => value !== null) ?? null;
const bindings = [...objectiveEffectBindings(registry), ...copperEffectBindings(registry), ...fiberEffectBindings(registry), ...radioEffectBindings(registry), ...equipmentInteractionBindings(registry).effects];
const suppliedFactIds = [...new Set(world.documents.flatMap(reference => {
  const record = registry.record(reference.id);
  return record && 'evidence' in record ? record.evidence.map(evidence => evidence.id as FactId) : [];
}))];
const oracle = JSON.parse(await readFile(new URL('../../../../tests/fixtures/companions.json', import.meta.url), 'utf8')) as {
  cases: { id: string; kind: string }[];
  recruits: { characterId: string; vectorGroup: string }[];
  partyContract: { requiredRecruitIds: string[]; maximumActive: number; freeSwapAtSafePreparation: boolean };
};

// These are supplied preparation inputs, not claimed player-earned completions.
// The objective measure/submit/walk operations below are real canonical calls.
const baseFlags: Record<string, FlagValue> = {
  'FLAG-copper-path': 'section-replacement', 'FLAG-copper-repeater-claim': 'requires-continuity',
  'FLAG-fiber-connection': 'verified-cleaned', 'FLAG-fiber-profiles': 'matched', 'FLAG-fiber-path': 'passive-path-A',
  'FLAG-radio-path': 'aligned-existing', 'FLAG-radio-settings': 'matched', 'FLAG-radio-channel': 'A', 'FLAG-radio-conditions': 'surveyed',
  'FLAG-market-kit': 'compatible-kit-A', 'FLAG-equipment-capability': '100/full',
};
const contracts = [
  { character: 'CH03', objective: 'O05', room: 'R05', savedRule: 'PHY06', abilityRules: ['PHY03'] },
  { character: 'CH04', objective: 'O04', room: 'R04', savedRule: 'PHY04', abilityRules: ['PHY04', 'PHY05'] },
  { character: 'CH05', objective: 'O06', room: 'R06', savedRule: 'PHY06', abilityRules: ['PHY03', 'PHY06'] },
  { character: 'CH06', objective: 'O06', room: 'R06', savedRule: 'PHY06', abilityRules: ['PHY03', 'PHY06'] },
  { character: 'CH07', objective: 'O08', room: 'R08', savedRule: 'PHY07', abilityRules: ['PHY07'] },
  { character: 'CH16', objective: 'O05', room: 'R05', savedRule: 'PHY06', abilityRules: ['PHY03'] },
  { character: 'CH19', objective: 'O09', room: 'R09', savedRule: 'PHY08', abilityRules: ['PHY08'] },
  { character: 'CH20', objective: 'O04', room: 'R04', savedRule: 'PHY04', abilityRules: ['PHY05'] },
  { character: 'CH22', objective: 'O09', room: 'R09', savedRule: 'PHY08', abilityRules: ['PHY09'] },
] as const;

function fixture(objective: string, room: string) {
  const initial = startIntroduction(createIntroductionRuntime(), registry), game = initial.game!;
  let state = createReducerState({ ...initial, game: { ...game,
    world: { ...game.world, roomId: q<'room'>(room), position: { safePositionId: q<'safe-position'>(`${room}.entry`) },
      flags: Object.fromEntries(Object.entries(baseFlags).map(([id, value]) => [q<'flag'>(id), value])),
      completedObjectiveIds: ['O01', 'O02', 'O03', 'O05', 'O07'].filter(id => id !== objective).map(id => q<'objective'>(id)),
      inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...game.notebook, factIds: suppliedFactIds, measurements: [] },
  } });
  const reduce = createReducer({ registry, bindings, objectiveScenario: scenario });
  const send = (input: ReducerInput) => {
    const result = reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: state.runtime.game!.adventureId, expectedVersion: state.runtime.game!.world, input });
    expect(result.status, result.reason).not.toBe('rejected'); state = result.state; return result;
  };
  const measure = (n: number) => {
    const resolved = scenario(state.runtime.game!, q<'objective'>(objective));
    expect(resolved).not.toBeNull();
    send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q<'objective'>(objective), alternativeId: resolved!.alternativeId, id: uuid(n) } });
    return state.runtime.game!.notebook.measurements.find(m => m.id === uuid(n))!;
  };
  const submit = (n: number) => {
    const resolved = scenario(state.runtime.game!, q<'objective'>(objective));
    send({ kind: 'objective', operation: { kind: 'submit', objectiveId: q<'objective'>(objective), alternativeId: resolved!.alternativeId, measurementId: uuid(n) } });
  };
  if (objective === 'O04') {
    // Supply a canonical historical open record by measuring the REAL O03
    // evaluator in its own room, then hand that actual output to this scenario.
    const originalWorld = state.runtime.game!.world;
    state = { ...state, runtime: { ...state.runtime, game: { ...state.runtime.game!, world: { ...originalWorld, roomId: q<'room'>('R03'), position: { safePositionId: q<'safe-position'>('R03.entry') }, flags: { ...originalWorld.flags, [q('FLAG-copper-path')]: 'original-broken' } } } } };
    const before = scenario(state.runtime.game!, q<'objective'>('O03'))!;
    send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q<'objective'>('O03'), alternativeId: before.alternativeId, id: uuid(900) } });
    state = { ...state, runtime: { ...state.runtime, game: { ...state.runtime.game!, world: originalWorld } } };
  }
  return { state: () => state, game: () => state.runtime.game!, send, measure, submit };
}

describe('T094 preparation: canonical boundaries that recruitment must preserve', () => {
  it('pins the independently specified nine allies and pending behavior cases without changing their status', () => {
    expect(oracle.partyContract.requiredRecruitIds).toEqual(contracts.map(c => q(c.character)));
    expect(oracle.partyContract.maximumActive).toBe(2);
    expect(oracle.partyContract.freeSwapAtSafePreparation).toBe(true);
    expect(new Set(oracle.cases.map(c => c.id)).size).toBe(oracle.cases.length);
    expect(oracle.cases.filter(c => c.kind === 'main-route-independence')).toHaveLength(3);
    expect(oracle.recruits.map(r => r.characterId)).toEqual(contracts.map(c => q(c.character)));
  });

  it.each(contracts)('$character: records the actual $objective result with its canonical provenance', c => {
    const f = fixture(c.objective, c.room), measured = f.measure(1);
    expect(measured).toBeDefined();
    expect(measured.ruleId).toBe(q(c.savedRule));
    expect(measured.subjectIds).toContain(q(c.objective));
    expect(measured.roomId).toBe(q(c.room));
    expect(measured.conclusionCode).toMatch(/:correct$/);
    expect(isMeasurementCurrent(measured, f.game().world)).toBe(true);
    expect(f.game().world.recruits).toEqual([]);
    expect(f.game().world.activeAllyIds).toEqual([]);
  });

  it.each(contracts)('$character: submit remains repeatable with fresh measurement after completion; submit status alone cannot prove demonstration', c => {
    const f = fixture(c.objective, c.room); f.measure(1); f.submit(1);
    expect(f.game().world.completedObjectiveIds).toContain(q(c.objective));
    const current = f.measure(2);
    expect(isMeasurementCurrent(current, f.game().world)).toBe(true);
    const selected = scenario(f.game(), q<'objective'>(c.objective))!;
    const acknowledgement = evaluateObjective(registry, scenario, f.game(), q<'objective'>(c.objective), {
      actionId: 'not-demonstration-proof' as ActionId, expectedVersion: f.game().world,
      input: { kind: 'submit', alternativeId: selected.alternativeId, measurementId: uuid(777) },
    });
    expect(acknowledgement).toMatchObject({ status: 'correct', reasonCode: 'objective-already-complete', acceptedEffects: [] });
    expect(f.game().notebook.measurements.some(m => m.id === uuid(777))).toBe(false);
  });

  it.each(contracts.filter(c => !c.abilityRules.some(rule => rule === c.savedRule as string)))('$character: ability rule labels cannot be substituted for the $objective measurement rule', c => {
    expect(c.abilityRules.map(rule => q(rule))).not.toContain(fixture(c.objective, c.room).measure(1).ruleId);
  });

  it('a real R06 to R05 walk preserves optical learning history while making its result stale for a current repair', () => {
    const f = fixture('O06', 'R06'), measured = f.measure(1);
    const destination = navigation.resolve(f.game().world, q('R05'), 'stable-exploration');
    expect(destination.ok).toBe(true); if (!destination.ok) throw new Error(destination.reason);
    f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'actual-navigation', observations: [], acceptedEffects: [] }, destination: destination.destination });
    expect(f.game().world.roomId).toBe(q('R05'));
    const retained = f.game().notebook.measurements.find(m => m.id === measured.id)!;
    expect(retained.readings).toEqual(measured.readings);
    expect(retained.stale).toBe(true);
    expect(isMeasurementCurrent(retained, f.game().world)).toBe(false);
  });
});
