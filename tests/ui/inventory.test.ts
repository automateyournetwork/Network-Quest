// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createInventoryController, inventoryView } from '../../src/ui/inventory';
import { content, q, recipe, setup } from './inventory-fixture';
import type { EffectBinding } from '../../src/state/reducer';

describe('T025 inventory intent and actual reducer boundary', () => {
  it('selects/deselects only known held items without progress or persistence changes', () => {
    const f = setup({ inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] });
    createInventoryController(f);
    const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: q('ITEM-missing') })).status).toBe('rejected');
    f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: q('ITEM-inspection-kit') }));
    expect(f.store.getState().runtime.ui?.selectedItem).toBe(q('ITEM-inspection-kit'));
    expect(f.store.getState().runtime.game).toBe(before.runtime.game);
    expect(f.store.getState().runtime.persistence).toBe(before.runtime.persistence);
    expect(inventoryView(f.registry, f.store.getState()).items[0]).toMatchObject({ name: 'Reusable inspection kit', quantity: 1, selected: true });
    f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: q('ITEM-inspection-kit') }));
    expect(f.store.getState().runtime.ui?.selectedItem).toBeNull();
    expect(inventoryView(f.registry, f.store.getState()).items[0]?.description).toContain('Use it on the labeled physical path');
  });
  it('refuses duplicate inventory rows and unknown records instead of making ambiguous quantities usable', () => {
    for (const inventory of [[{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }, { itemId: q<'item'>('ITEM-inspection-kit'), quantity: 2 }], [{ itemId: q<'item'>('ITEM-unknown'), quantity: 1 }]]) {
      const f = setup({ inventory }); createInventoryController(f);
      const before = f.store.getState();
      expect(f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: inventory[0]!.itemId })).status).toBe('rejected');
      expect(inventoryView(f.registry, before).items).toEqual([]);
      expect(f.store.getState()).toBe(before);
    }
  });
  it('commits one validated recipe atomically, recognizes reverse selection, rejects stale/replayed input and recovers consumed inputs', () => {
    const r = recipe(), f = setup({ ...r, inventory: [{ itemId: q('ITEM-part-a'), quantity: 1 }, { itemId: q('ITEM-part-b'), quantity: 1 }] }); createInventoryController(f);
    const oldScope = f.bus.captureScope();
    const command = f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-b'), targetItemId: q('ITEM-part-a'), combinationId: q('COMBINE-parts') });
    const result = f.bus.dispatch(command); expect(result.status).toBe('handled');
    const after = f.store.getState();
    expect(after.runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-joined'), quantity: 1 }]);
    expect(after.runtime.game!.world.flags[q<'flag'>('FLAG-joined')]).toBe(true);
    expect(after.runtime.game!.world.dialogueEffectIds).toEqual([]);
    expect(f.bus.dispatch(command)).toBe(result); expect(f.store.getState()).toBe(after);
    expect(f.bus.dispatch(oldScope({ kind: 'select-item', itemId: q('ITEM-part-a') })).reason).toBe('stale-context');
    for (const item of ['ITEM-part-a', 'ITEM-part-b']) expect(f.bus.dispatch(f.bus.capture({ kind: 'recover-item', itemId: q(item) })).status).toBe('handled');
    const recovered = f.store.getState();
    expect(recovered.runtime.game!.world.inventory).toHaveLength(3);
    expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-a'), targetItemId: q('ITEM-part-b'), combinationId: q('COMBINE-parts') })).status).toBe('handled');
    expect(f.store.getState().runtime.game).toBe(recovered.runtime.game);
  });
  it('sums same-item debits before rewards and rejects insufficient quantities atomically', () => {
    for (const quantity of [1, 2]) {
      const r = recipe({ sameItem: true }), f = setup({ ...r, inventory: [{ itemId: q('ITEM-part-a'), quantity }] }); createInventoryController(f);
      const before = f.store.getState();
      const result = f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-a'), targetItemId: q('ITEM-part-a'), combinationId: q('COMBINE-parts') }));
      expect(result.status).toBe(quantity === 1 ? 'rejected' : 'handled');
      if (quantity === 1) { expect(result.reason).toBe('insufficient-items'); expect(f.store.getState()).toBe(before); }
      else expect(f.store.getState().runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-joined'), quantity: 1 }]);
    }
  });
  it('keeps unheld, unrelated, ineligible and unrecoverable transformations unchanged', () => {
    const configurations = [{ condition: { kind: 'flag-equals' as const, flagId: q('FLAG-joined'), value: true } }, { recoveryRoom: 'R02' }];
    for (const config of configurations) {
      const r = recipe(config), f = setup({ ...r, inventory: [{ itemId: q('ITEM-part-a'), quantity: 1 }, { itemId: q('ITEM-part-b'), quantity: 1 }] }); createInventoryController(f);
      const before = f.store.getState();
      expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-a'), targetItemId: q('ITEM-part-b'), combinationId: q('COMBINE-parts') })).status).not.toBe('handled');
      expect(f.store.getState()).toBe(before);
    }
    const f = setup({ inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] }); createInventoryController(f);
    const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-inspection-kit'), targetItemId: q('ITEM-inspection-kit'), combinationId: null })).status).toBe('unavailable');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-inspection-kit'), targetItemId: q('ITEM-unknown'), combinationId: null })).status).toBe('rejected');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'recover-item', itemId: q('ITEM-inspection-kit') })).status).not.toBe('handled');
    expect(f.store.getState()).toBe(before);
  });
  it('honors cancellation and same-version invalidation, then releases owned handlers', () => {
    const f = setup({ inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] }); const controller = createInventoryController(f);
    const scope = f.bus.captureScope(); const canceled = scope({ kind: 'select-item', itemId: q('ITEM-inspection-kit') }); f.bus.cancel(canceled);
    expect(f.bus.dispatch(canceled).reason).toBe('canceled'); f.bus.invalidate();
    expect(f.bus.dispatch(scope({ kind: 'select-item', itemId: q('ITEM-inspection-kit') })).reason).toBe('invalidated');
    expect(f.store.getState().runtime.ui?.selectedItem).toBeNull(); controller.dispose(); controller.dispose();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: null })).reason).toBe('no-handler');
  });
  it('clears a consumed transient selection in the same reducer store commitment', () => {
    const r = recipe(), f = setup({ ...r, inventory: [{ itemId: q('ITEM-part-a'), quantity: 1 }, { itemId: q('ITEM-part-b'), quantity: 1 }] }); createInventoryController(f);
    f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: q('ITEM-part-a') }));
    expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-a'), targetItemId: q('ITEM-part-b'), combinationId: q('COMBINE-parts') })).status).toBe('handled');
    expect(f.store.getState().runtime.ui!.selectedItem).toBeNull();
    expect(f.store.getState().runtime.persistence.dirtyGeneration).toBe(1);
  });
  it('requires supported Use on both recipe inputs', () => {
    const r = recipe(); r.records[1]!.verbs = ['look'];
    const f = setup({ ...r, inventory: [{ itemId: q('ITEM-part-a'), quantity: 1 }, { itemId: q('ITEM-part-b'), quantity: 1 }] }); createInventoryController(f);
    const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-a'), targetItemId: q('ITEM-part-b'), combinationId: q('COMBINE-parts') })).status).toBe('unavailable');
    expect(f.store.getState()).toBe(before);
  });
  it('exposes named authored alternatives and never picks a recipe by order', () => {
    const r = recipe(), other = structuredClone(r.records[0]!.combinations[0]!);
    other.id = q('COMBINE-other'); other.explanation = 'Join the fixture parts another way.';
    other.effects = other.effects.map(e => ({ ...e, effectId: `${e.effectId}-other`, ...(e.kind === 'set-flag' ? { flagId: q('FLAG-joined-other') } : {}) }));
    r.records[0]!.combinations.push(other);
    r.bindings.push(...other.effects.map(e => ({ sourceId: q('ITEM-part-a'), effectId: e.effectId, mode: 'once', receipt: { kind: 'flag', id: q('FLAG-joined-other') } })) as EffectBinding[]);
    const f = setup({ ...r, inventory: [{ itemId: q('ITEM-part-a'), quantity: 1 }, { itemId: q('ITEM-part-b'), quantity: 1 }] }); createInventoryController(f);
    const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'combine-items', itemId: q('ITEM-part-a'), targetItemId: q('ITEM-part-b'), combinationId: null })).reason).toBe('choose-combination');
    expect(f.store.getState()).toBe(before);
    f.bus.dispatch(f.bus.capture({ kind: 'select-item', itemId: q('ITEM-part-a') }));
    const alternatives = inventoryView(f.registry, f.store.getState()).items.find(i => i.id === q('ITEM-part-b'))!.controls;
    expect(alternatives.map(c => c.label)).toEqual(expect.arrayContaining(['Join the fixture parts.', 'Join the fixture parts another way.']));
    const action = alternatives.find(c => c.label === other.explanation)!.action;
    expect(f.bus.dispatch(f.bus.capture(action)).status).toBe('handled');
    expect(f.store.getState().runtime.game!.world.flags).toEqual({ [q('FLAG-joined-other')]: true });
  });
  it('rejects authored duplicate effect identities and nonconsumable transformations at the real content boundary', () => {
    const r = recipe(); r.records[0]!.combinations[0]!.effects[1]!.effectId = r.records[0]!.combinations[0]!.effects[0]!.effectId;
    expect(() => content(r.records)).toThrow();
    expect(() => content(recipe({ never: true }).records)).toThrow();
  });
});
