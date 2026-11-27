// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import { createVerbController } from '../../src/ui/verbs';
import type { HotspotBinding } from '../../src/ui/verbs';
import { createInventoryController } from '../../src/ui/inventory';
import { conditionSatisfied } from '../../src/state/conditions';
import type * as S from '../../src/content/schema-types.generated';
import { q, setup } from './inventory-fixture';

const binding = (hotspot: string, action: string, verb: 'look' | 'use', extra: Partial<HotspotBinding> = {}): HotspotBinding => ({
  roomId: q('R01'), hotspotId: q(hotspot), actionId: q(action), sourceId: q('DIALOGUE-arrival-actions'), verb, itemId: null, mode: 'effects', ...extra,
} as HotspotBinding);
const bindings = [binding('HOTSPOT-power', 'ACTION-observe-power', 'look'), binding('HOTSPOT-link', 'ACTION-observe-link', 'look'), binding('HOTSPOT-satchel', 'ACTION-take-kit', 'use'),
  binding('HOTSPOT-path', 'ACTION-path-short', 'use'), binding('HOTSPOT-path', 'ACTION-path-long', 'use')];
const interact = (target: string, verb: 'walk' | 'look' | 'talk' | 'use', itemId: ReturnType<typeof q<'item'>> | null = null) => ({ kind: 'interact' as const, targetId: q(target), verb, itemId });

describe('T025 current-room verb resolution', () => {
  it('projects visible controls and changes transient verb selection without progress', () => {
    const f = setup(), controller = createVerbController({ ...f, bindings }); const before = f.store.getState();
    expect(controller.controls().map(c => c.label)).toEqual(['Walk', 'Look', 'Talk', 'Use', 'Inventory', 'Notebook', 'Compendium', 'Party']);
    for (const verb of ['walk', 'look', 'talk', 'use'] as const) {
      expect(f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb })).status).toBe('handled');
      expect(controller.controls().find(c => c.label.toLowerCase() === verb)?.pressed).toBe(true);
    }
    expect(f.store.getState().runtime.game).toBe(before.runtime.game); expect(f.store.getState().runtime.persistence).toBe(before.runtime.persistence);
    f.bus.dispatch(f.bus.capture({ kind: 'open-panel', panel: 'inventory' })); expect(f.store.getState().runtime.ui?.panel).toBe('inventory');
    f.bus.dispatch(f.bus.capture({ kind: 'close-panel' })); expect(f.store.getState().runtime.ui?.panel).toBe('none');
    expect(f.bus.dispatch(f.bus.capture({ kind: 'open-panel', panel: 'notebook' })).status).toBe('unavailable');
  });
  it('records real Look evidence and gives authored unsupported feedback without effects', () => {
    const f = setup(); createVerbController({ ...f, bindings });
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-power', 'look'))).status).toBe('handled');
    expect(f.store.getState().runtime.game!.notebook.factIds).toEqual([q('FACT-power')]);
    const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-power', 'talk'))).message).toContain('not a switch');
    expect(f.store.getState()).toBe(before);
    const description = f.bus.dispatch(f.bus.capture(interact('HOTSPOT-photon', 'look')));
    expect(description.message).toContain('Photon hovers'); expect(f.store.getState().runtime.game!.notebook.factIds).not.toContain(q('FACT-photon-clue'));
  });
  it('rejects remote targets, action IDs as targets, unheld tools and wrong-verb explicit choices', () => {
    const f = setup(); createVerbController({ ...f, bindings }); const before = f.store.getState();
    for (const input of [interact('HOTSPOT-endpoints', 'look'), interact('ACTION-take-kit', 'use'), interact('HOTSPOT-path', 'use', q('ITEM-inspection-kit')),
      { kind: 'choose-hotspot-action' as const, targetId: q('HOTSPOT-power'), verb: 'use' as const, itemId: null, choiceId: q('ACTION-observe-power') }]) expect(f.bus.dispatch(f.bus.capture(input)).status).not.toBe('handled');
    expect(f.store.getState()).toBe(before);
  });
  it('uses exact authored conditions to alternate a selector without choosing presentation order', () => {
    const f = setup(), controller = createVerbController({ ...f, bindings });
    for (const expected of ['direct', 'service-loop', 'direct']) {
      expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-path', 'use'))).status).toBe('handled');
      expect(f.store.getState().runtime.game!.world.flags[q<'flag'>('FLAG-path-mode')]).toBe(expected);
      expect(f.store.getState().runtime.game!.world.flags[q<'flag'>('FLAG-path-inspected')]).toBe(false);
    }
    expect(controller.objects().some(o => o.id === q('HOTSPOT-path'))).toBe(true);
  });
  it('uses the actual one-time kit group and preserves it across repeated Use', () => {
    const f = setup(); createVerbController({ ...f, bindings }); createInventoryController(f);
    for (let count = 0; count < 3; count++) expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-satchel', 'use'))).status).toBe('handled');
    expect(f.store.getState().runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    expect(f.store.getState().runtime.game!.world.dialogueEffectIds).toEqual([]);
    expect(f.store.getState().runtime.game!.world.completedObjectiveIds).toEqual([]);
  });
  it('requires an explicit authored alternative when multiple Use actions are eligible', () => {
    const f = setup({ inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] });
    const plan = vi.fn(() => ({ status: 'unavailable' as const, message: 'Measurement controller not connected.' }));
    const controller = createVerbController({ ...f, bindings: [...bindings, binding('HOTSPOT-path', 'ACTION-inspect-path', 'use', { mode: 'port', plan })] });
    f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'use' })); const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-path', 'use'))).reason).toBe('choose-action'); expect(f.store.getState()).toBe(before); expect(plan).not.toHaveBeenCalled();
    const actions = controller.objects().find(o => o.id === q('HOTSPOT-path'))!.actions;
    expect(actions.map(a => a.label)).toEqual(expect.arrayContaining(['Inspect physical path', 'Change physical path']));
    const inspect = actions.find(a => a.label === 'Inspect physical path')!;
    expect(f.bus.dispatch(f.bus.capture(inspect.action)).status).toBe('unavailable'); expect(plan).toHaveBeenCalledTimes(1);
    expect(f.store.getState()).toBe(before);
  });
  it('validates bindings to current-room exposed entry choices and rejects unrelated sibling mappings', () => {
    const f = setup();
    for (const bad of [binding('HOTSPOT-power', 'ACTION-take-kit', 'look'), binding('HOTSPOT-power', 'ACTION-observe-power', 'look', { sourceId: q('DIALOGUE-photon-intro') }), binding('HOTSPOT-power', 'ACTION-observe-power', 'talk' as 'look')]) {
      expect(() => createVerbController({ ...f, bindings: [bad] })).toThrow();
    }
    expect(() => createVerbController({ ...f, bindings: [bindings[0]!, bindings[0]!] })).toThrow();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'select-verb', verb: 'look' })).reason).toBe('no-handler');
  });
  it('routes Talk and Walk only through explicit ports and rejects a stale port commit', () => {
    const f = setup(); const commit = vi.fn(() => ({ status: 'handled' as const }));
    const plan = vi.fn(() => ({ status: 'ready' as const, commit }));
    const controller = createVerbController({ ...f, bindings: [binding('HOTSPOT-photon', 'ACTION-talk-photon', 'talk' as 'look', { mode: 'port', plan })], walk: plan });
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-photon', 'talk'))).status).toBe('handled');
    expect(f.bus.dispatch(f.bus.capture(interact('R02', 'walk'))).status).toBe('handled');
    expect(f.bus.dispatch(f.bus.capture(interact('R03', 'walk'))).status).toBe('rejected'); expect(commit).toHaveBeenCalledTimes(2);
    controller.dispose();
    createVerbController({ ...f, bindings });
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-photon', 'talk'))).status).toBe('unavailable');
    expect(f.bus.dispatch(f.bus.capture(interact('R02', 'walk'))).status).toBe('unavailable');
  });
  it('rejects a same-version store replacement during trusted resolution before committing', () => {
    const f = setup(), commit = vi.fn(() => ({ status: 'handled' as const }));
    createVerbController({ ...f, bindings: [binding('HOTSPOT-photon', 'ACTION-talk-photon', 'talk' as 'look', { mode: 'port', plan: () => {
      f.replace({ ...f.store.getState() }); return { status: 'ready', commit };
    } })] });
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-photon', 'talk'))).reason).toBe('state-replaced');
    expect(commit).not.toHaveBeenCalled();
  });
  it('keeps unsupported minigame predicates closed under negation and disjunction', () => {
    const f = setup(), world = f.store.getState().runtime.game!.world;
    const unsupported: S.condition = { kind: 'minigame-complete', minigameId: q('M01') };
    for (const condition of [unsupported, { kind: 'not', condition: unsupported }, { kind: 'any', conditions: [{ kind: 'always' }, unsupported] }] as S.condition[]) {
      expect(conditionSatisfied(condition, world)).toBe(false);
    }
  });
  it('checks exact item-to-hotspot ownership without consuming the reusable kit or awarding an unwired measurement', () => {
    const f = setup({ inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] });
    const plan = vi.fn(() => ({ status: 'unavailable' as const, message: 'Measurement controller not connected.' }));
    createVerbController({ ...f, bindings: [binding('HOTSPOT-path', 'ACTION-inspect-path', 'use', { itemId: q('ITEM-inspection-kit'), mode: 'port', plan })] });
    const before = f.store.getState();
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-path', 'use'))).status).toBe('unavailable'); expect(plan).not.toHaveBeenCalled();
    expect(f.bus.dispatch(f.bus.capture(interact('HOTSPOT-path', 'use', q('ITEM-inspection-kit')))).status).toBe('unavailable'); expect(plan).toHaveBeenCalledTimes(1);
    expect(f.store.getState()).toBe(before); expect(before.runtime.game!.notebook.measurements).toEqual([]);
  });
});
