// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { ItemId, QualifiedId, RoomId, Verb } from '../domain/types';
import { conditionSatisfied } from '../state/conditions';
import type { ReducerState, StateEffect } from '../state/reducer';
import type { UiState } from '../state/types';
import type { ActionBus, ActionPlan, CapturedAction } from './action-bus';
import type { SceneObjectView, SemanticControl } from './app-shell';
import type { GameplayStore } from './controller-store';
import { guardedPlan, playable, rejected, reductionPlan, uiPlan, unavailable } from './controller-store';
import { heldItems } from './inventory';

export interface ResolvedInteraction {
  readonly room: Readonly<S.room>; readonly hotspot: Readonly<S.hotspot>; readonly choice: Readonly<S.dialogueChoice>;
  readonly verb: Verb; readonly itemId: ItemId | null;
}
/** Trusted application code only: pure synchronous resolution, synchronous commit.
 * T026/T027/T029 must additionally validate dialogue, measurements and player input.
 * Renderers receive SemanticAction/ActionDispatcher only, never this port.
 */
export type InteractionPlanner = (interaction: ResolvedInteraction, action: CapturedAction, state: ReducerState) => ActionPlan;
export type HotspotBinding = {
  readonly roomId: RoomId; readonly hotspotId: QualifiedId; readonly verb: Verb;
  readonly actionId: QualifiedId; readonly sourceId: QualifiedId;
  /** Exact optional tool application. null is the explicit bare-hand action. */
  readonly itemId: ItemId | null;
} & ({ readonly mode: 'effects' } | { readonly mode: 'port'; readonly plan: InteractionPlanner });
export type WalkPlanner = (target: { readonly room: Readonly<S.room>; readonly targetId: QualifiedId }, action: CapturedAction, state: ReducerState) => ActionPlan;
export type PanelPlanner = (panel: Exclude<UiState['panel'], 'none' | 'inventory'>, action: CapturedAction, state: ReducerState) => ActionPlan;
export interface VerbOptions {
  readonly bus: ActionBus; readonly registry: ContentRegistry; readonly store: GameplayStore;
  readonly bindings: readonly HotspotBinding[]; readonly walk?: WalkPlanner; readonly panels?: PanelPlanner;
  /** T028 shares these canonical hotspot choices with exits/floor presentation. */
  readonly sceneObjects?: (state: ReducerState, hotspots: readonly SceneObjectView[]) => readonly SceneObjectView[];
}
interface BindingEntry { readonly binding: HotspotBinding; readonly node: Readonly<S.dialogueNode>; readonly choice: Readonly<S.dialogueChoice> }
const title = (text: string) => text[0]!.toUpperCase() + text.slice(1);

export function createVerbController({ bus, registry, store, bindings, walk, panels, sceneObjects }: VerbOptions) {
  // All mappings are explicit and detached before registering handlers. The
  // registry supplies the exact exposed entry choice, not a sibling/node jump.
  const entries: BindingEntry[] = bindings.map(raw => {
    const binding = Object.freeze({ ...raw }), room = registry.record(binding.roomId), source = registry.record(binding.sourceId);
    const hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === binding.hotspotId) : undefined;
    const node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
    const choice = node?.choices.find(c => c.id === binding.actionId);
    const item = binding.itemId === null ? null : registry.record(binding.itemId);
    if (!hotspot || !hotspot.verbs.includes(binding.verb) || !hotspot.actionIds.includes(binding.actionId) || !node || !choice
      || (binding.itemId !== null && (item?.kind !== 'item' || !item.verbs.includes('use') || binding.verb !== 'use'))) throw new TypeError('Bindings must name an exposed current-room entry choice, supported verb and known tool.');
    return { binding, node, choice };
  });
  const keys = entries.map(({ binding: b }) => JSON.stringify([b.roomId, b.hotspotId, b.verb, b.itemId, b.actionId]));
  if (new Set(keys).size !== keys.length) throw new TypeError('Hotspot bindings must be unique.');
  const roomOf = (state: ReducerState): Readonly<S.room> | null => {
    const room = state.runtime.game && registry.record(state.runtime.game.world.roomId);
    return room?.kind === 'room' ? room : null;
  };
  const eligible = (state: ReducerState, hotspot: Readonly<S.hotspot>, verb: Verb, itemId: ItemId | null) => entries.filter(({ binding, node, choice }) =>
    binding.roomId === state.runtime.game?.world.roomId && binding.hotspotId === hotspot.id && binding.verb === verb && binding.itemId === itemId
    && conditionSatisfied(node.condition, state.runtime.game.world) && conditionSatisfied(choice.condition, state.runtime.game.world));
  const registrations: (() => void)[] = [];
  const register: ActionBus['register'] = (kind, handler) => { const off = bus.register(kind, handler); registrations.push(off); return off; };

  const interact = (action: CapturedAction): ActionPlan => {
    const input = action.input;
    if (input.kind !== 'interact' && input.kind !== 'choose-hotspot-action') return rejected('invalid-input', 'Choose a scene target.');
    const before = store.getState(), room = roomOf(before), items = heldItems(registry, before);
    if (!playable(before) || !room) return unavailable('unavailable-state', 'Scene interactions are unavailable during this activity.');
    if (!items || (input.itemId !== null && !items.some(r => r.item.id === input.itemId))) return rejected('item-not-held', 'The selected item is no longer in your inventory.');
    if (input.itemId !== null && input.verb !== 'use') return rejected('wrong-verb', 'Select Use to apply an inventory item.');
    const hotspot = room.hotspots.find(h => h.id === input.targetId);
    const localWalkTarget = room.exits.some(exit => exit.toRoomId === input.targetId) || room.walkRegions.some(region => region.id === input.targetId)
      || room.safePositions.some(position => position.id === input.targetId);
    if (!hotspot) {
      if (!localWalkTarget) return rejected('target-not-here', 'That target is not an available object or exit in this room.');
      if (input.verb !== 'walk' || input.kind !== 'interact') return unavailable('unsupported-verb', 'Choose Walk to use this exit or clear floor location.');
      return walk ? guardedPlan(store, before, walk({ room, targetId: input.targetId as QualifiedId }, action, before))
        : unavailable('navigation-unavailable', 'Movement is unavailable until the navigation controller is connected.');
    }
    if (!hotspot.verbs.includes(input.verb)) return unavailable('unsupported-verb', hotspot.unsupportedVerbText);
    const candidates = eligible(before, hotspot, input.verb, input.itemId);
    const choices = input.kind === 'choose-hotspot-action' ? candidates.filter(e => e.choice.id === input.choiceId) : candidates;
    if (input.kind === 'choose-hotspot-action' && !choices.length) return rejected('choice-unavailable', 'That action is not currently offered for this object, verb and item.');
    if (choices.length > 1) return unavailable('choose-action', `Choose an action for ${hotspot.label}: ${choices.map(e => e.choice.text).join('; ')}.`);
    const selected = choices[0];
    if (!selected) {
      if (input.verb === 'look') return { status: 'handled', message: hotspot.description };
      return unavailable('interaction-unavailable', `${hotspot.unsupportedVerbText} No eligible ${input.verb} action is connected for this selection.`);
    }
    const interaction: ResolvedInteraction = { room, hotspot, choice: selected.choice, verb: input.verb, itemId: input.itemId };
    if (selected.binding.mode === 'port') return guardedPlan(store, before, selected.binding.plan(interaction, action, before));
    // Only the application's explicitly selected authored entry-choice batch.
    // Measurement and hypothesis actions require ports; a flag is not evidence.
    const message = input.verb === 'look' ? [hotspot.description, ...room.evidence.filter(e => hotspot.evidenceIds.includes(e.id)
      && selected.choice.effects.some(effect => effect.kind === 'record-fact' && effect.factId === e.id)).map(e => e.text)].join('\n\n') : selected.choice.text;
    return reductionPlan(store, action, before, { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-hotspot-action', observations: [],
      acceptedEffects: selected.choice.effects as StateEffect[] } }, message);
  };
  try {
    register('select-verb', action => {
      if (action.input.kind !== 'select-verb') return rejected('invalid-input', 'Choose Walk, Look, Talk or Use.');
      const before = store.getState();
      if (!playable(before)) return unavailable('unavailable-state', 'Choose a verb after the current activity finishes.');
      return uiPlan(store, before, { selectedVerb: action.input.verb }, `${title(action.input.verb)} selected.`);
    });
    register('interact', interact); register('choose-hotspot-action', interact);
    register('open-panel', action => {
      if (action.input.kind !== 'open-panel') return rejected('invalid-input', 'Choose a panel.');
      const before = store.getState(), panel = action.input.panel;
      if (!playable(before)) return unavailable('unavailable-state', 'This panel is unavailable during the current activity.');
      if (panel === 'inventory') return uiPlan(store, before, { panel }, 'Inventory opened.');
      return panels ? guardedPlan(store, before, panels(panel, action, before)) : unavailable('panel-unavailable', `${title(panel)} is unavailable until its controller is connected.`);
    });
    register('close-panel', () => {
      const before = store.getState();
      return uiPlan(store, before, { panel: 'none' }, before.runtime.ui?.panel === 'none' ? 'No panel is open.' : 'Panel closed.');
    });
  } catch (error) { registrations.forEach(off => off()); throw error; }
  return {
    controls(): readonly SemanticControl[] {
      const state = store.getState();
      return [
        ...(['walk', 'look', 'talk', 'use'] as const).map(verb => ({ id: `verb:${verb}`, label: title(verb), pressed: state.runtime.ui?.selectedVerb === verb, action: { kind: 'select-verb' as const, verb } })),
        ...(['inventory', 'notebook', 'compendium'] as const).map(panel => ({ id: `panel:${panel}`, label: title(panel), action: { kind: 'open-panel' as const, panel } })),
      ];
    },
    objects(): readonly SceneObjectView[] {
      const state = store.getState(), room = roomOf(state), ui = state.runtime.ui;
      if (!room || !ui) return [];
      const rows = heldItems(registry, state);
      const itemId = ui.selectedVerb === 'use' && rows?.some(r => r.item.id === ui.selectedItem) ? ui.selectedItem : null;
      const hotspots = room.hotspots.map(hotspot => {
          const options = eligible(state, hotspot, ui.selectedVerb, itemId);
          const actions: SemanticControl[] = [{ id: `hotspot:${hotspot.id}`, label: hotspot.label,
            action: { kind: 'interact', targetId: hotspot.id as QualifiedId, verb: ui.selectedVerb, itemId } }];
          // Explicit authored labels keep alternatives visible, including kit
          // inspection versus the reversible physical path selector.
          for (const { choice } of options) if (options.length > 1 || choice.text !== hotspot.label) actions.push({
            id: `hotspot-choice:${hotspot.id}:${choice.id}`, label: choice.text,
            action: { kind: 'choose-hotspot-action', targetId: hotspot.id as QualifiedId, verb: ui.selectedVerb, itemId, choiceId: choice.id as QualifiedId },
          });
          return { id: hotspot.id, label: hotspot.label, description: hotspot.description, actions };
        });
      if (sceneObjects) return sceneObjects(state, hotspots);
      return [
        ...hotspots,
        ...room.exits.map(exit => ({ id: `exit:${room.id}:${exit.toRoomId}`, label: exit.label, description: 'Choose Walk to travel through this exit.', actions: [{
          id: `walk:${room.id}:${exit.toRoomId}`, label: exit.label, action: { kind: 'interact' as const, targetId: exit.toRoomId as QualifiedId, verb: ui.selectedVerb, itemId },
        }] })),
      ];
    },
    dispose() { registrations.forEach(off => off()); },
  };
}
