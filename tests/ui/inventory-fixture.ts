// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { EffectId, QualifiedId } from '../../src/domain/types';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { EffectBinding, ReducerState } from '../../src/state/reducer';
import type { InventoryEntry, RuntimeState, SaveSnapshotV1 } from '../../src/state/types';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';

export const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const world = await read('content/spec001/world.json') as S.world;
const sources = await read('content/spec001/sources.json');
const documents = Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read(path)])));
export const authoredInput = { world, sources, documents };
export function content(records: S.authoredRecord[] = [], mutate?: (documents: Record<string, unknown>) => void) {
  const copy = structuredClone({ world, sources, documents });
  if (records.length) {
    const path = 'content/spec001/inventory-test.json';
    copy.world.documents.push(...records.map(r => ({ kind: r.kind, id: r.id, path })));
    copy.documents[path] = { kind: 'collection', schemaVersion: 1, episodeId: 'spec001', contentVersion: '1.0.0', records };
  }
  mutate?.(copy.documents);
  const result = validateContent(JSON.parse(JSON.stringify(copy)));
  if (!result.ok || !result.registry) throw new Error(`Fixture must validate: ${JSON.stringify(result.issues)}`);
  return result.registry;
}
export const registry = content();
export function choice(id: string) {
  const source = registry.record(q('DIALOGUE-arrival-actions')) as S.dialogue;
  return source.nodes[0]!.choices.find(c => c.id === q(id))!;
}
export const introBindings: EffectBinding[] = [
  ...['ACTION-observe-power', 'ACTION-observe-link', 'ACTION-path-short', 'ACTION-path-long'].flatMap(id => choice(id).effects.map(e => ({
    sourceId: q('DIALOGUE-arrival-actions'), effectId: e.effectId as EffectId, mode: 'repeatable' as const,
  }))),
  ...choice('ACTION-take-kit').effects.map(e => ({ sourceId: q('DIALOGUE-photon-intro'), effectId: e.effectId as EffectId, mode: 'once' as const,
    receipt: { kind: 'flag' as const, id: q<'flag'>('FLAG-kit-issued') } })),
];
export function recipe(options: { sameItem?: boolean; never?: boolean; condition?: S.condition; quantity?: number; recoveryRoom?: string } = {}) {
  const kit = registry.record(q('ITEM-inspection-kit')) as S.item;
  const recovery: S.recovery = { policy: 'transformation-recoverable', roomId: q(options.recoveryRoom ?? 'R01'), condition: { kind: 'always' }, explanation: 'Recover the fixture input at its safe source.' };
  const item = (id: string): S.item => ({ ...structuredClone(kit), id: q(id), name: id, description: 'Validated inventory fixture, not episode content.', essentialForRoutes: [],
    consumption: 'on-documented-transformation', recovery, combinations: [] });
  const a = item('ITEM-part-a'), b = item('ITEM-part-b'), reward = item('ITEM-joined');
  if (options.never) a.consumption = 'never';
  const effects: S.effect[] = [
    { kind: 'consume-item', effectId: q('EFFECT-debit-a'), itemId: a.id, quantity: options.quantity ?? 1 },
    { kind: 'consume-item', effectId: q('EFFECT-debit-b'), itemId: options.sameItem ? a.id : b.id, quantity: 1 },
    { kind: 'grant-item', effectId: q('EFFECT-joined'), itemId: reward.id, quantity: 1 },
    { kind: 'set-flag', effectId: q('EFFECT-joined-once'), flagId: q('FLAG-joined'), value: true },
  ];
  a.combinations = [{ id: q('COMBINE-parts'), withItemId: options.sameItem ? a.id : b.id, condition: options.condition ?? { kind: 'always' },
    consumesInputs: true, effects, explanation: 'Join the fixture parts.', recovery }];
  const bindings = effects.map(e => ({ sourceId: q('ITEM-part-a'), effectId: e.effectId, mode: 'once', receipt: { kind: 'flag', id: q('FLAG-joined') } })) as EffectBinding[];
  return { records: [a, b, reward], bindings };
}
export const snapshot = await read('specs/001-physical-layer-underworld/contracts/examples/save-v1.json') as SaveSnapshotV1;
export function setup(options: { records?: S.authoredRecord[]; bindings?: EffectBinding[]; inventory?: InventoryEntry[]; mutate?: Parameters<typeof content>[1] } = {}) {
  const registry = content(options.records, options.mutate);
  const { saveSchemaVersion: _schema, safeState: _safe, ...game } = structuredClone(snapshot);
  const runtime: RuntimeState = {
    game: { ...game, world: { ...game.world, inventory: options.inventory ?? [], flags: {}, completedObjectiveIds: [] } }, checkpoint: null, activity: { kind: 'stable-exploration' },
    ui: { panel: 'none', focusedObject: null, selectedVerb: 'walk', selectedItem: null, feedback: null,
      presentation: { musicVolume: 1, effectsVolume: 1, voiceVolume: 1, captions: true, reducedMotion: 'system', textScale: 1 } },
    auth: { status: 'guest', clientGeneration: 0 as RuntimeState['auth']['clientGeneration'], csrfToken: null },
    persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'], lastAcknowledgedGeneration: null,
      knownSlot: undefined, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null, autosaveEnabled: false },
  };
  let state = createReducerState(runtime);
  const store = { getState: () => state, reduce: createReducer({ registry, bindings: options.bindings ?? introBindings }),
    compareAndSet: (expected: ReducerState, next: ReducerState) => { if (state !== expected) return false; state = next; return true; } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  return { registry, store, bus, replace: (next: ReducerState) => { state = next; } };
}
