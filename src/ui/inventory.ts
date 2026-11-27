// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { illustrationBinding } from '../content/schema-types.generated';
import { illustrationFor } from '../content/illustrations';
import { illustrationDetails } from './illustration';
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { ItemId, QualifiedId } from '../domain/types';
import { conditionSatisfied } from '../state/conditions';
import type { ReducerState, StateEffect } from '../state/reducer';
import type { ActionBus, ActionCapture, ActionDispatcher } from './action-bus';
import { contextFromRuntime } from './action-bus';
import type { SemanticControl } from './app-shell';
import type { GameplayStore } from './controller-store';
import { playable, rejected, reductionPlan, uiPlan, unavailable } from './controller-store';

export interface HeldItem { readonly item: Readonly<S.item>; readonly quantity: number }
/** Corrupt snapshots cannot become selectable rows or fund a transformation. */
export function heldItems(registry: ContentRegistry, state: ReducerState): readonly HeldItem[] | null {
  const inventory = state.runtime.game?.world.inventory;
  if (!inventory || inventory.length > 256 || new Set(inventory.map(i => i.itemId)).size !== inventory.length) return null;
  const rows: HeldItem[] = [];
  for (const entry of inventory) {
    const item = registry.record(entry.itemId);
    if (item?.kind !== 'item' || !Number.isInteger(entry.quantity) || entry.quantity < 1 || entry.quantity > 99) return null;
    rows.push({ item, quantity: entry.quantity });
  }
  return rows;
}
function recipes(rows: readonly HeldItem[], a: ItemId, b: ItemId): readonly S.combination[] {
  if (![a, b].every(id => rows.some(r => r.item.id === id && r.item.verbs.includes('use')))) return [];
  // Declaration may belong to either input. Self-pairs are visited once.
  return rows.filter(r => r.item.id === a || r.item.id === b).flatMap(({ item }) => item.combinations
    .filter(c => c.withItemId === (item.id === a ? b : a)));
}
export interface InventoryOptions { readonly bus: ActionBus; readonly registry: ContentRegistry; readonly store: GameplayStore }
export function createInventoryController({ bus, registry, store }: InventoryOptions): { dispose(): void } {
  const registrations: (() => void)[] = [];
  const register: ActionBus['register'] = (kind, handler) => { const off = bus.register(kind, handler); registrations.push(off); return off; };
  try {
    register('select-item', action => {
      if (action.input.kind !== 'select-item') return rejected('invalid-input', 'Choose an inventory item.');
      const before = store.getState(), rows = heldItems(registry, before), input = action.input;
      if (!playable(before)) return unavailable('unavailable-state', 'Inventory selection is unavailable during this activity.');
      if (!rows || (input.itemId !== null && !rows.some(r => r.item.id === input.itemId))) return rejected('item-not-held', 'Choose an item currently in your inventory.');
      const itemId = before.runtime.ui!.selectedItem === input.itemId ? null : input.itemId;
      return uiPlan(store, before, { selectedItem: itemId, ...(itemId ? { selectedVerb: 'use' as const } : {}) }, itemId
        ? `${rows.find(r => r.item.id === itemId)!.item.name} selected. Choose a scene target or another inventory item.` : 'Inventory item deselected.');
    });
    register('combine-items', action => {
      if (action.input.kind !== 'combine-items') return rejected('invalid-input', 'Choose two inventory items.');
      const before = store.getState(), rows = heldItems(registry, before), input = action.input;
      if (!playable(before)) return unavailable('unavailable-state', 'Combine items after the current activity finishes.');
      if (!rows || ![input.itemId, input.targetItemId].every(id => rows.some(r => r.item.id === id))) return rejected('item-not-held', 'Both inputs must be in your inventory.');
      const candidates = recipes(rows, input.itemId, input.targetItemId).filter(c => conditionSatisfied(c.condition, before.runtime.game!.world));
      if (new Set(candidates.map(c => c.id)).size !== candidates.length) return rejected('content-error', 'The combination is ambiguous in the authored content.');
      const eligible = input.combinationId === null ? candidates : candidates.filter(c => c.id === input.combinationId);
      if (!eligible.length) return unavailable('no-combination', 'These items have no available combination. Look at their descriptions or try a different target.');
      if (eligible.length !== 1) return unavailable('choose-combination', 'Choose one of the described combinations.');
      const recipe = eligible[0]!;
      return reductionPlan(store, action, before, { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-inventory-transformation', observations: [], acceptedEffects: recipe.effects as StateEffect[] } }, recipe.explanation);
    });
    register('recover-item', action => {
      if (action.input.kind !== 'recover-item') return rejected('invalid-input', 'Choose a recoverable item.');
      const before = store.getState(), rows = heldItems(registry, before), item = registry.record(action.input.itemId);
      if (!playable(before)) return unavailable('unavailable-state', 'Recover items from a safe preparation location.');
      if (!rows || item?.kind !== 'item' || item.consumption === 'never' || rows.some(r => r.item.id === item.id)) return rejected('recovery-unavailable', 'This item does not need recovery.');
      return reductionPlan(store, action, before, { kind: 'recover-item', itemId: action.input.itemId }, item.recovery.explanation);
    });
  } catch (error) { registrations.forEach(off => off()); throw error; }
  return { dispose: () => registrations.forEach(off => off()) };
}

export interface InventoryRow {
  readonly id: ItemId; readonly name: string; readonly description: string; readonly quantity: number;
  readonly illustration?: illustrationBinding | undefined; readonly selected: boolean; readonly controls: readonly SemanticControl[];
}
export interface InventoryView {
  readonly context: ReturnType<typeof contextFromRuntime>; readonly open: boolean; readonly items: readonly InventoryRow[];
  readonly message: string; readonly recovery: readonly SemanticControl[];
}
/** Catalog is explicit so restored adventures can offer known recovery sources. */
export function inventoryView(registry: ContentRegistry, state: ReducerState, itemIds: readonly ItemId[] = []): InventoryView {
  const rows = heldItems(registry, state), selected = rows?.find(r => r.item.id === state.runtime.ui?.selectedItem);
  const world = state.runtime.game?.world;
  return { context: contextFromRuntime(state.runtime), open: state.runtime.ui?.panel === 'inventory',
    message: rows === null ? 'Inventory is unavailable because its contents are invalid.' : rows.length ? 'Select an item, then choose a scene target or a described combination.' : 'Your inventory is empty.',
    items: (rows ?? []).map(({ item, quantity }) => {
      const id = item.id as ItemId;
      const controls: SemanticControl[] = [{ id: `inventory-select:${id}`, label: `${selected?.item.id === id ? 'Deselect' : 'Select'} ${item.name}`,
        pressed: selected?.item.id === id, action: { kind: 'select-item', itemId: id } }];
      if (selected && world) for (const recipe of recipes(rows!, selected.item.id as ItemId, id).filter(c => conditionSatisfied(c.condition, world))) controls.push({
        id: `inventory-combine:${id}:${recipe.id}`, label: recipe.explanation,
        action: { kind: 'combine-items', itemId: selected.item.id as ItemId, targetItemId: id, combinationId: recipe.id as QualifiedId },
      });
      const illustration = world && selected?.item.id === id ? illustrationFor(registry, world.roomId, 'inventory', id) : undefined;
      return { id, ...(illustration ? { illustration } : {}), name: item.name, description: item.description, quantity, selected: selected?.item.id === id, controls };
    }),
    recovery: !rows || !world ? [] : [...new Set(itemIds)].flatMap(id => {
      const item = registry.record(id);
      return item?.kind === 'item' && item.consumption === 'on-documented-transformation' && !rows.some(r => r.item.id === id)
        && item.recovery.roomId === world.roomId && conditionSatisfied(item.recovery.condition, world)
        ? [{ id: `inventory-recover:${id}`, label: `Recover ${item.name}: ${item.recovery.explanation}`, action: { kind: 'recover-item' as const, itemId: id } }] : [];
    }),
  };
}

/** Passive keyed DOM. Native click unifies pointer, touch, Enter and Space. */
export function createInventoryPanel(host: HTMLElement, bus: Pick<ActionDispatcher, 'captureScope' | 'dispatch'>) {
  const doc = host.ownerDocument, abort = new AbortController(), prefix = `inventory-${crypto.randomUUID()}`;
  const element = doc.createElement('section'); element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Inventory'); element.hidden = true;
  const title = doc.createElement('h2'); title.textContent = 'Inventory'; title.tabIndex = -1;
  const message = doc.createElement('p'), list = doc.createElement('ul'), recovery = doc.createElement('div'), close = doc.createElement('button');
  list.setAttribute('aria-label', 'Inventory items'); close.type = 'button'; close.textContent = 'Close Inventory'; close.setAttribute('aria-keyshortcuts', 'Escape');
  element.append(title, message, list, recovery, close); host.append(element);
  let capture: ActionCapture = bus.captureScope(null), disposed = false, returnFocus: HTMLElement | null = null;
  const rows = new Map<string, { element: HTMLLIElement; name: HTMLElement; description: HTMLElement; quantity: HTMLElement; guide: HTMLElement; actions: HTMLElement }>();
  const controls = new Map<string, { button: HTMLButtonElement; model: SemanticControl }>();
  const buttonModels = new WeakMap<HTMLButtonElement, { button: HTMLButtonElement; model: SemanticControl }>();
  const dispatch = (control: SemanticControl) => { if (!disposed) bus.dispatch(capture(control.action)); };
  const reconcile = (parent: HTMLElement, children: readonly HTMLElement[]) => {
    children.forEach((child, index) => { if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] ?? null); });
    while (parent.children.length > children.length) parent.lastElementChild!.remove();
  };
  const renderControl = (model: SemanticControl) => {
    let entry = controls.get(model.id);
    if (!entry) {
      const button = doc.createElement('button'); button.type = 'button';
      entry = { button, model }; controls.set(model.id, entry);
      buttonModels.set(button, entry);
    }
    entry.model = model; entry.button.textContent = model.label;
    if (model.pressed === undefined) entry.button.removeAttribute('aria-pressed'); else entry.button.setAttribute('aria-pressed', String(model.pressed));
    return entry.button;
  };
  const closePanel = () => { if (!disposed) bus.dispatch(capture({ kind: 'close-panel' })); };
  element.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    const entry = target instanceof HTMLButtonElement ? buttonModels.get(target) : undefined;
    if (entry && controls.get(entry.model.id) === entry) dispatch(entry.model);
  }, { signal: abort.signal });
  close.addEventListener('click', closePanel, { signal: abort.signal });
  element.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault(); closePanel();
    }
  }, { signal: abort.signal });
  return { element, render(view: InventoryView, scope?: ActionCapture) {
    if (disposed) throw new Error('Inventory panel is disposed.');
    const model = structuredClone(view), allControls = [...model.items.flatMap(row => row.controls), ...model.recovery];
    if (new Set(model.items.map(row => row.id)).size !== model.items.length || new Set(allControls.map(c => c.id)).size !== allControls.length) throw new TypeError('Inventory identities must be unique.');
    const wasOpen = !element.hidden, focus = doc.activeElement;
    capture = scope ?? bus.captureScope(model.context); message.textContent = model.message;
    reconcile(list, model.items.map((row, index) => {
      let entry = rows.get(row.id);
      if (!entry) {
        const item = doc.createElement('li'), name = doc.createElement('h3'), description = doc.createElement('p'), quantity = doc.createElement('p'), actions = doc.createElement('div');
        name.id = `${prefix}-${index}-${crypto.randomUUID()}`; actions.setAttribute('role', 'group'); actions.setAttribute('aria-labelledby', name.id);
        const guide = doc.createElement('div');
        item.append(name, description, quantity, actions, guide); entry = { element: item, name, description, quantity, actions, guide }; rows.set(row.id, entry);
      }
      entry.name.textContent = row.name; entry.description.textContent = row.description; entry.quantity.textContent = `Quantity: ${row.quantity}`;
      const binding = model.open ? row.illustration : undefined;
      if (entry.guide.dataset['asset'] !== binding?.assetId) {
        entry.guide.replaceChildren(...(binding ? [illustrationDetails(doc, binding)] : []));
        if (binding) entry.guide.dataset['asset'] = binding.assetId; else delete entry.guide.dataset['asset'];
      }
      reconcile(entry.actions, row.controls.map(renderControl)); return entry.element;
    }));
    reconcile(recovery, model.recovery.map(renderControl));
    for (const id of rows.keys()) if (!model.items.some(row => row.id === id)) rows.delete(id);
    for (const id of controls.keys()) if (!allControls.some(c => c.id === id)) controls.delete(id);
    element.hidden = !model.open;
    if (model.open && !wasOpen) { returnFocus = focus instanceof HTMLElement ? focus : null; title.focus(); }
    else if (!model.open && wasOpen && focus instanceof Node && element.contains(focus)) { if (returnFocus?.isConnected) returnFocus.focus(); }
    else if (model.open && focus instanceof HTMLElement && !focus.isConnected) title.focus();
  }, dispose() { if (disposed) return; disposed = true; abort.abort(); rows.clear(); controls.clear(); element.remove(); } };
}
