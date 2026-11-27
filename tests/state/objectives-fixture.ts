// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, MeasurementId, ObjectiveId } from '../../src/domain/types';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, ReducerState } from '../../src/state/reducer';
import { objectiveEffectBindings } from '../../src/state/objectives';
import type { ObjectiveScenario, ObjectiveScenarioResolver } from '../../src/state/objectives';
import { authoredInput, q, setup } from '../ui/inventory-fixture';
export { q };
const read = async (path: string) => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const profiles: S.collection = await read('content/spec001/profiles.json');
const objectives: S.collection = await read('content/spec001/objectives.json');
const input = structuredClone(authoredInput);
for (const reference of input.world.documents.filter(r => r.kind === 'profile' || r.kind === 'objective')) delete input.documents[reference.path];
input.world.documents = input.world.documents.filter(r => r.kind !== 'profile' && r.kind !== 'objective');
for (const [path, collection] of [['content/spec001/profiles.json', profiles], ['content/spec001/objectives.json', objectives]] as const) {
  input.documents[path] = collection;
  input.world.documents.push(...collection.records.map(r => ({ kind: r.kind, id: r.id, path })));
}
const validated = validateContent(input);
if (!validated.ok || !validated.registry) throw new Error(JSON.stringify(validated.issues));
export const registry = validated.registry;
export const uuid = (n = 1) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
export function scenario(objective: string, second = false): ObjectiveScenario {
  const alternativeId = q(`ACTION-${objective}-${({ O03: second ? 'alternate-passive-path' : 'section-replacement', O04: 'conventional-continuity-tool',
    O05: second ? 'inspected-connector-replacement' : 'inspected-connector-cleaning', O06: second ? 'passive-path-B' : 'passive-path-A',
    O07: second ? 'choose-alternate-path' : 'align-existing-path', O08: second ? 'scenario-channel-B' : 'scenario-channel-A',
    O09: second ? 'compatible-kit-B' : 'compatible-kit-A', O10: second ? 'notebook-and-replay' : 'step-and-decode' } as Record<string, string>)[objective]}`);
  const capability = { bothNegotiate: true as const, selected: { rate: { value: 100, unit: 'Mb/s' as const }, duplex: 'full' as const } };
  switch (objective) {
    case 'O03': return { kind: 'copper-preparation', alternativeId, path: { compatible: true, lengths: [{ value: second ? 90 : 85, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, true, true] } };
    case 'O04': return { kind: 'copper-proof', alternativeId, path: { compatible: true, lengths: [{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, true, true] }, beforeMeasurementId: uuid(90), repeaterClaim: 'requires-continuity' };
    case 'O05': return { kind: 'fiber-preparation', alternativeId, preparation: { checks: { mediaMatch: true, wavelengthDirectionMatch: true, rateMatch: true, connectorPolarityMatch: true, hostSupport: true }, inspectedBeforeChange: true, connectionDefectRemoved: true } };
    case 'O06': return { kind: 'fiber-proof', alternativeId, path: { compatible: true, loss: { value: second ? 9 : 8, unit: 'dB' } }, inspectionComplete: true };
    case 'O07': return { kind: 'radio-preparation', alternativeId, path: { viablePath: true, settingsCompatible: true } };
    case 'O08': return { kind: 'radio-proof', alternativeId, path: { viablePath: true, settingsCompatible: true, signal: { value: -65, unit: 'dBm' }, noise: { value: second ? -85 : -90, unit: 'dBm' } } };
    case 'O09': return { kind: 'equipment', alternativeId, allocation: { demands: second ? [{ value: 12, unit: 'W' }, { value: 11, unit: 'W' }, { value: 7, unit: 'W' }] : [{ value: 12, unit: 'W' }, { value: 11, unit: 'W' }], budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses', formFactorMatch: true, phyAndMediaMatch: true, hostSupport: true, portPowerCompatible: true, perPortConstraintsMet: true }, capability };
    case 'O10': return { kind: 'calibration', alternativeId, samples: [{ value: -3, unit: 'toy-level', position: 0 }, { value: 1, unit: 'toy-level', position: 1 }, { value: 3, unit: 'toy-level', position: 2 }, { value: -1, unit: 'toy-level', position: 3 }], decodedBits: '00101101', roleClaim: 'physical-sampling-not-address-discovery', capability };
    default: throw new Error(objective);
  }
}
export function fixture(objective = 'O03', initialScenario = scenario(objective)) {
  let currentScenario = initialScenario;
  const resolver: ObjectiveScenarioResolver = () => currentScenario;
  const old = setup().store.getState();
  const record = registry.record(q(objective)) as S.objective;
  const prereq: Record<string, string[]> = { O03: ['O01', 'O02'], O04: ['O01', 'O02', 'O03'], O05: ['O01', 'O02'], O06: ['O01', 'O02', 'O05'], O07: ['O01', 'O02'], O08: ['O01', 'O02', 'O07'], O09: ['O01', 'O02'], O10: ['O01', 'O02'] };
  let state = createReducerState({ ...old.runtime, game: { ...old.runtime.game!, world: { ...old.runtime.game!.world,
    roomId: q<'room'>(objective.replace('O', 'R')), position: { safePositionId: q<'safe-position'>(`${objective.replace('O', 'R')}.entry`) },
    completedObjectiveIds: (prereq[objective] ?? []).map(id => q<'objective'>(id)), inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] },
    notebook: { ...old.runtime.game!.notebook, factIds: record.evidence.filter(e => !e.requiresFreshMeasurement).map(e => q<'fact'>(e.id.split(':')[1]!)), measurements: [] } } });
  const reduce = createReducer({ registry, bindings: objectiveEffectBindings(registry), objectiveScenario: resolver });
  const store = { getState: () => state, reduce, compareAndSet: (before: ReducerState, next: ReducerState) => { if (state !== before) return false; state = next; return true; } };
  const send = (input: ReducerInput, id: string = crypto.randomUUID()) => {
    const before = state, game = state.runtime.game!;
    const result = reduce(before, { actionId: id as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
    if (result.status !== 'rejected') store.compareAndSet(before, result.state);
    return result;
  };
  const measure = (id = uuid()) => send({ kind: 'objective', operation: { kind: 'measure', objectiveId: q(objective) as ObjectiveId, alternativeId: currentScenario.alternativeId, id } });
  const submit = (measurementId = uuid()) => send({ kind: 'objective', operation: { kind: 'submit', objectiveId: q(objective) as ObjectiveId, alternativeId: currentScenario.alternativeId, measurementId } });
  return { store, resolver, send, measure, submit, replace: (next: ReducerState) => { state = next; }, change: (next: ObjectiveScenario) => { currentScenario = next; } };
}
