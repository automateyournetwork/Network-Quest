// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, MeasurementId, QualifiedId } from '../../src/domain/types';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput } from '../../src/state/reducer';
import { createRepairScenarioResolver, prepareRepairPlanChange, repairEffectBindings } from '../../src/state/repair-plan';
import type { RepairPlanOperation, RepairScenarioResolver } from '../../src/state/repair-plan';
import { authoredInput, setup } from '../ui/inventory-fixture';
export const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}` as MeasurementId;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
export const input = structuredClone(authoredInput);
const paths = ['content/spec001/profiles.json', 'content/spec001/objectives.json', 'content/spec001/dialogue/repair-plan-actions.json', 'content/spec001/dialogue/equipment-actions.json', 'content/spec001/rooms/R09.json', 'content/spec001/rooms/R10.json', 'content/spec001/rooms/R11.json', 'content/spec001/rooms/R12.json'];
const removed = input.world.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || paths.includes(r.path));
input.world.documents = input.world.documents.filter(r => !removed.includes(r));
for (const { path } of removed) delete input.documents[path];
for (const path of paths) { const value = await read<S.collection | S.room>(path); input.documents[path] = value;
  input.world.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path }))); }
const validated = validateContent(input);
if (!validated.ok || !validated.registry) throw new Error(JSON.stringify(validated.issues));
export const registry = validated.registry;
export function fixture(route: 'copper' | 'fiber' | 'radio' = 'copper', replaceResolver?: (base: RepairScenarioResolver) => RepairScenarioResolver) {
  const old = setup().store.getState();
  let state = createReducerState({ ...old.runtime, game: { ...old.runtime.game!, world: { ...old.runtime.game!.world,
    roomId: q<'room'>('R11'), position: { safePositionId: q<'safe-position'>('R11.preparation') }, flags: {
      [q('FLAG-market-kit')]: 'compatible-kit-A', [q('FLAG-equipment-capability')]: '100/full',
      [q('FLAG-clock-method')]: 'step-and-decode', [q('FLAG-clock-role')]: 'physical-sampling-not-address-discovery',
      [q('FLAG-clock-bits-0')]: '00', [q('FLAG-clock-bits-1')]: '10', [q('FLAG-clock-bits-2')]: '11', [q('FLAG-clock-bits-3')]: '01',
    }, completedObjectiveIds: ['O01', 'O02', ...(route === 'copper' ? ['O03', 'O04'] : route === 'fiber' ? ['O05', 'O06'] : ['O07', 'O08']), 'O09', 'O10'].map(id => q<'objective'>(id)),
    inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] }, notebook: { ...old.runtime.game!.notebook, factIds: [], measurements: [] } } });
  const base = createRepairScenarioResolver(registry), resolver = replaceResolver?.(base) ?? base;
  const reduce = createReducer({ registry, bindings: repairEffectBindings(registry), repairScenario: resolver });
  const game = () => state.runtime.game!;
  const send = (input: ReducerInput, actionId = crypto.randomUUID() as ActionId) => {
    const result = reduce(state, { actionId, adventureId: game().adventureId, expectedVersion: game().world, input });
    if (result.status !== 'rejected') state = result.state;
    return result;
  };
  const act = (operation: RepairPlanOperation) => {
    const prepared = prepareRepairPlanChange(registry, resolver, game(), operation);
    const result = send({ kind: 'repair-plan', operation });
    return { result, evaluation: prepared.ok ? prepared.evaluation : null };
  };
  const choose = (name: string) => act({ kind: 'choose', actionId: q(`ACTION-repair-${name}`) });
  const move = (room: string) => send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'test-walk', observations: [], acceptedEffects: [] },
    destination: { roomId: q<'room'>(room), safePositionId: q<'safe-position'>(room === 'R11' ? 'R11.preparation' : `${room}.entry`), activity: 'stable-exploration' } });
  const review = (id = 1) => act({ kind: 'review', id: uuid(id) });
  const execute = (id = 1, warningAcknowledged = true) => act({ kind: 'execute', reviewId: uuid(id), warningAcknowledged });
  const prepare = (plan = `${route}-${route === 'copper' ? 'section' : 'A'}`, duration: string | null = plan === 'shutdown' ? null : 'permanent') => {
    choose(`plan-${plan}`); if (duration !== null) choose(`duration-${duration}`); choose('read-plan'); review();
  };
  const prove = () => { move('R12'); choose('read-classification'); act({ kind: 'measure-link', id: uuid(2) }); act({ kind: 'test-endpoint', id: uuid(3) }); };
  const classify = (selection: 'permanent' | 'temporary' | 'shutdown' = 'permanent') => act({ kind: 'classify', selection, linkId: uuid(2), endpointId: uuid(3) });
  return { game, state: () => state, replace: (next: typeof state) => { state = next; }, resolver, reduce, send, act, choose, move, review, execute, prepare, prove, classify };
}
