// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { ActionId, QualifiedId, RoomId } from '../domain/types';
import { conditionSatisfied } from '../state/conditions';
import { reduceDialogue } from '../state/dialogue';
import type { DialogueOperation } from '../state/dialogue';
import type { EffectBinding, ReducerState } from '../state/reducer';
import type { GameState } from '../state/types';
import { contextFromRuntime } from './action-bus';
import type { ActionBus, ActionCapture, ActionContext, ActionDispatcher, ActionPlan, CapturedAction } from './action-bus';
import type { SemanticControl } from './app-shell';
import type { GameplayStore } from './controller-store';
import { guardedPlan, playable, rejected, unavailable, prepareActorEncounter } from './controller-store';
import type { HotspotBinding, InteractionPlanner } from './verbs';

export interface DialogueBinding {
  readonly roomId: RoomId; readonly hotspotId: QualifiedId; readonly actionId: QualifiedId;
  readonly sourceId: QualifiedId; readonly dialogueId: QualifiedId;
}
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
export const introductionDialogueBindings: readonly DialogueBinding[] = [
  { roomId: q('R01'), hotspotId: q('HOTSPOT-photon'), actionId: q('ACTION-talk-photon'), sourceId: q('DIALOGUE-arrival-actions'), dialogueId: q('DIALOGUE-photon-intro') },
  { roomId: q('R02'), hotspotId: q('HOTSPOT-titan'), actionId: q('ACTION-talk-titan'), sourceId: q('DIALOGUE-workshop-actions'), dialogueId: q('DIALOGUE-titan-intro') },
];
export interface DialogueView {
  readonly context: ActionContext | null; readonly open: boolean; readonly completed: boolean;
  readonly speaker: string; readonly text: string; readonly controls: readonly SemanticControl[];
}
export interface DialogueOptions {
  readonly registry: ContentRegistry; readonly store: GameplayStore; readonly bus: ActionBus;
  readonly bindings: readonly DialogueBinding[]; readonly effectBindings: readonly EffectBinding[];
}
interface Topic { readonly binding: DialogueBinding; readonly dialogue: Readonly<S.dialogue>; readonly speaker: string; readonly entry: S.dialogueNode; readonly choice: S.dialogueChoice }
interface Session { readonly id: string; readonly topic: Topic; readonly nodeId: QualifiedId | null; readonly game: GameState; readonly capture: ActionCapture; readonly lockId: ActionId | null }
const sameContext = (a: ActionContext | null, b: ActionContext | null) => !!a && !!b && a.adventureId === b.adventureId && a.attemptId === b.attemptId && a.configurationRevision === b.configurationRevision;

/**
 * Trusted composition port. Session/history is transient and never serialized.
 * compareAndSet must synchronously swap state only, without rendering inside the
 * commit. Register controllers before the application's bus render subscriber so
 * completed-topic history updates before project() observes a new game object.
 */
export function createDialogueController({ registry, store, bus, bindings, effectBindings }: DialogueOptions) {
  const topics: Topic[] = bindings.map(raw => {
    const binding = Object.freeze({ ...raw }), room = registry.record(binding.roomId), source = registry.record(binding.sourceId), dialogue = registry.record(binding.dialogueId);
    const hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === binding.hotspotId) : undefined;
    const entry = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
    const choice = entry?.choices.find(c => c.id === binding.actionId);
    if (!hotspot?.verbs.includes('talk') || !hotspot.actionIds.includes(binding.actionId) || !entry || !choice || dialogue?.kind !== 'dialogue'
      || dialogue.skipPolicy !== 'retain-required-evidence' || dialogue.replayPolicy !== 'no-duplicate-effects') throw new TypeError('Dialogue requires an explicit exposed Talk action and authored target.');
    const effects = [...entry.effects, ...choice.effects, ...dialogue.nodes.flatMap(n => [...n.effects, ...n.choices.flatMap(c => c.effects)])];
    if (effects.some(effect => !effectBindings.some(b => b.effectId === effect.effectId && b.mode === 'once'))) throw new TypeError('Dialogue effects require the canonical one-time reducer policies.');
    return { binding, dialogue, speaker: hotspot.label, entry, choice };
  });
  if (new Set(topics.map(t => JSON.stringify(t.binding))).size !== topics.length) throw new TypeError('Dialogue bindings must be unique.');
  let session: Session | null = null, disposed = false;
  const emptyCapture = bus.captureScope(null);
  const ownsActivity = (current: Session, state: ReducerState) => current.nodeId === null ? playable(state)
    : state.runtime.activity?.kind === 'dialogue-transaction' && current.lockId !== null && state.control.pending?.actionId === current.lockId;
  const valid = () => {
    if (session && (store.getState().runtime.game !== session.game || !ownsActivity(session, store.getState()))) session = null;
    return session;
  };
  const unlock = (before: ReducerState, current: Session, cancel = false) => {
    if (!current.lockId) return { status: 'no-op' as const, state: before };
    return store.reduce(before, { actionId: crypto.randomUUID() as ActionId, adventureId: current.game.adventureId, expectedVersion: { configurationRevision: current.game.world.configurationRevision, attemptId: current.game.world.attemptId },
      input: { kind: cancel ? 'cancel' : 'commit', transitionActionId: current.lockId } });
  };
  const transact = (topic: Topic, operation: DialogueOperation, action: CapturedAction, before: ReducerState, expected: Session | null, opening: boolean): ActionPlan => {
    if (!(expected && !opening ? ownsActivity(expected, before) : playable(before)) || !before.runtime.game || before.runtime.game.world.roomId !== topic.binding.roomId) return unavailable('dialogue-unavailable', 'This conversation is unavailable here.');
    return guardedPlan(store, before, { status: 'ready', commit: () => {
      if (disposed || session !== expected) return rejected('dialogue-stale', 'This conversation has changed. Open it again.');
      let candidate = before;
      if (expected?.lockId) {
        const out = unlock(before, expected);
        if (out.status === 'rejected') return rejected(out.reason ?? 'dialogue-lock', 'This conversation is no longer active.');
        candidate = out.state;
      }
      if (opening) {
        const encounter = prepareActorEncounter(registry, store, candidate, topic.binding.hotspotId, 'talk');
        if (encounter.status === 'rejected') return rejected(encounter.reason ?? 'dialogue-encounter', 'This actor is no longer available.');
        candidate = encounter.state;
      }
      // Opening Talk is also an authored narrator entry/choice. Both it and the
      // target entry are prepared before a single compare-and-set installation.
      if (opening && (topic.entry.effects.length || topic.choice.effects.length)) {
        const game = candidate.runtime.game!;
        const out = store.reduce(candidate, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId },
          input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-talk', observations: [], acceptedEffects: [...topic.entry.effects, ...topic.choice.effects] as import('../state/reducer').StateEffect[] } } });
        if (out.status === 'rejected') return rejected(out.reason ?? 'dialogue-effect', 'The conversation could not apply its authored effects.');
        candidate = out.state;
      }
      const out = reduceDialogue({ registry, reduce: store.reduce, state: candidate, dialogueId: topic.binding.dialogueId, operation,
        actionId: action.actionId, nextActionId: () => crypto.randomUUID() as ActionId });
      if (!out.ok) return rejected(out.reason, out.reason === 'dialogue-choice-required' ? 'Choose a conversation response before skipping the remaining lines.' : 'This conversation cannot continue in the current state.');
      candidate = out.state;
      let lockId: ActionId | null = null;
      if (out.nodeId !== null) {
        lockId = crypto.randomUUID() as ActionId;
        const game = candidate.runtime.game!;
        const lock = store.reduce(candidate, { actionId: lockId, adventureId: game.adventureId, expectedVersion: { configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId },
          input: { kind: 'begin', activity: 'dialogue-transaction', evaluation: { status: 'correct', reasonCode: 'dialogue-open', observations: [], acceptedEffects: [] } } });
        if (lock.status === 'rejected') return rejected(lock.reason ?? 'dialogue-lock', 'The conversation could not be opened.');
        candidate = lock.state;
      }
      if (!store.compareAndSet(before, candidate)) return rejected('state-replaced', 'The adventure has changed. Open the conversation again.');
      session = { id: crypto.randomUUID(), topic, nodeId: out.nodeId, game: candidate.runtime.game!, lockId, capture: bus.captureScope(contextFromRuntime(candidate.runtime)) };
      return { status: 'handled', message: out.nodeId === null ? 'Dialogue finished. Required clues remain in your notebook.' : 'Dialogue ready.' };
    } });
  };
  const hotspotBindings: HotspotBinding[] = topics.map(topic => {
    const plan: InteractionPlanner = (interaction, action, before) => {
      const current = valid();
      if (disposed || interaction.room.id !== topic.binding.roomId || interaction.hotspot.id !== topic.binding.hotspotId || interaction.choice.id !== topic.binding.actionId
        || interaction.verb !== 'talk' || interaction.itemId !== null || !conditionSatisfied(topic.entry.condition, before.runtime.game!.world)
        || !conditionSatisfied(topic.choice.condition, before.runtime.game!.world)) return rejected('dialogue-binding', 'That conversation is not offered here.');
      return transact(topic, { kind: 'open' }, action, before, current, true);
    };
    return { ...topic.binding, verb: 'talk', itemId: null, mode: 'port', plan };
  });
  const registrations: (() => void)[] = [];
  const handler = (action: CapturedAction): ActionPlan => {
    const input = action.input, current = valid(), before = store.getState();
    if (input.kind !== 'choose-dialogue' && input.kind !== 'skip-dialogue' && input.kind !== 'replay-dialogue' && input.kind !== 'close-dialogue') return rejected('dialogue-input', 'Choose a conversation action.');
    if (!current || current.id !== input.sessionId || current.topic.binding.dialogueId !== input.dialogueId
      || ('nodeId' in input && current.nodeId !== input.nodeId)) return rejected('dialogue-stale', 'This conversation has changed. Open it again.');
    if (input.kind === 'close-dialogue') return guardedPlan(store, before, { status: 'ready', commit: () => {
      if (session !== current) return rejected('dialogue-stale', 'This conversation has changed.');
      const out = unlock(before, current, true);
      if (out.status === 'rejected') return rejected(out.reason ?? 'dialogue-lock', 'This conversation is no longer active.');
      if (!store.compareAndSet(before, out.state)) return rejected('state-replaced', 'The adventure has changed.');
      session = null; return { status: 'handled', message: 'Dialogue closed. Recorded clues remain in your notebook.' };
    } });
    const operation: DialogueOperation = input.kind === 'replay-dialogue' ? { kind: 'open' }
      : input.kind === 'choose-dialogue' ? { kind: 'choose', nodeId: input.nodeId, choiceId: input.choiceId }
      : { kind: 'skip', nodeId: (input as Extract<typeof input, {kind: 'skip-dialogue'}>).nodeId };
    return transact(current.topic, operation, action, before, current, false);
  };
  try {
    for (const kind of ['choose-dialogue', 'skip-dialogue', 'replay-dialogue', 'close-dialogue'] as const) registrations.push(bus.register(kind, handler));
    registrations.push(bus.subscribe((action, result) => {
      // Completed topics remain replayable after legitimate room-local reducer
      // actions. A restore/replacement has no matching command receipt. Old DOM
      // keeps its old capture and token; only the new projection gets this scope.
      if (!session || session.nodeId !== null || result.status !== 'handled') return;
      const state = store.getState(), game = state.runtime.game;
      if (!game || game === session.game) return;
      const previous = { adventureId: session.game.adventureId, ...session.game.world };
      if (playable(state) && game.world.roomId === session.topic.binding.roomId && game.adventureId === session.game.adventureId
        && sameContext(action.context, previous) && state.control.actionIds.includes(action.actionId)) session = {
          ...session, id: crypto.randomUUID(), game, capture: bus.captureScope(contextFromRuntime(state.runtime)),
        };
      else session = null;
    }));
  } catch (error) { registrations.forEach(off => off()); throw error; }
  const invalidate = () => {
    const current = valid(), before = store.getState();
    if (current?.lockId) {
      const out = unlock(before, current, true);
      if (out.status !== 'rejected') store.compareAndSet(before, out.state);
    }
    session = null;
  };
  return { hotspotBindings,
    project(): { readonly view: DialogueView; readonly capture: ActionCapture } {
      const current = valid(), context = contextFromRuntime(store.getState().runtime);
      if (!current) return { view: { context, open: false, completed: false, speaker: '', text: '', controls: [] }, capture: emptyCapture };
      const node = current.topic.dialogue.nodes.find(n => n.id === current.nodeId), dialogueId = current.topic.binding.dialogueId, sessionId = current.id;
      const controls: SemanticControl[] = node ? node.choices.filter(c => conditionSatisfied(c.condition, current.game.world)).map(choice => ({
        id: `dialogue-choice:${choice.id}`, label: choice.text, action: { kind: 'choose-dialogue', dialogueId, sessionId, nodeId: node.id as QualifiedId, choiceId: choice.id as QualifiedId },
      })) : [];
      if (node) controls.push({ id: 'dialogue-skip', label: 'Skip dialogue', action: { kind: 'skip-dialogue', dialogueId, sessionId, nodeId: node.id as QualifiedId } });
      controls.push({ id: 'dialogue-replay', label: 'Replay dialogue', action: { kind: 'replay-dialogue', dialogueId, sessionId } });
      if (node) controls.push({ id: 'dialogue-close', label: 'Close dialogue', action: { kind: 'close-dialogue', dialogueId, sessionId } });
      return { view: { context, open: !!node, completed: !node, speaker: current.topic.speaker, text: node?.text ?? '', controls }, capture: current.capture };
    },
    /** Call with bus.invalidate when installing a restore, logout or new run. */
    invalidate,
    dispose() { if (disposed) return; invalidate(); disposed = true; registrations.forEach(off => off()); },
  };
}

/** Passive native controls. Capture belongs to the original authoritative view. */
export function createDialoguePanel(host: HTMLElement, bus: Pick<ActionDispatcher, 'dispatch'>) {
  const doc = host.ownerDocument, abort = new AbortController();
  const element = doc.createElement('div'), dialog = doc.createElement('section'), replayHost = doc.createElement('div');
  dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', 'Dialogue'); dialog.hidden = true;
  const heading = doc.createElement('h2'), text = doc.createElement('p'), actions = doc.createElement('div');
  text.id = `dialogue-line-${crypto.randomUUID()}`;
  dialog.setAttribute('aria-describedby', text.id);
  text.setAttribute('aria-live', 'polite');
  text.setAttribute('aria-atomic', 'true');
  heading.tabIndex = -1; text.style.whiteSpace = 'pre-wrap'; text.style.overflowWrap = 'anywhere';
  actions.style.display = 'flex'; actions.style.flexWrap = 'wrap'; actions.style.gap = '0.5rem';
  dialog.append(heading, text, actions); element.append(dialog, replayHost); host.append(element);
  let disposed = false, returnFocus: HTMLElement | null = null, fallbackFocus: HTMLElement | null = null;
  let current: { view: DialogueView; capture: ActionCapture } | null = null;
  const controls = new Map<string, { button: HTMLButtonElement; model: SemanticControl; capture: ActionCapture }>();
  const models = new WeakMap<HTMLButtonElement, { button: HTMLButtonElement; model: SemanticControl; capture: ActionCapture }>();
  const reconcile = (parent: HTMLElement, children: HTMLElement[]) => {
    children.forEach((child, index) => { if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] ?? null); });
    while (parent.children.length > children.length) parent.lastElementChild!.remove();
  };
  const control = (model: SemanticControl, capture: ActionCapture) => {
    let entry = controls.get(model.id);
    if (!entry) { const button = doc.createElement('button'); button.type = 'button'; entry = { button, model, capture }; controls.set(model.id, entry); models.set(button, entry); }
    entry.model = model; entry.capture = capture; entry.button.textContent = model.label;
    if (model.action.kind === 'close-dialogue') entry.button.setAttribute('aria-keyshortcuts', 'Escape');
    return entry.button;
  };
  element.addEventListener('click', event => {
    const button = event.target instanceof Element ? event.target.closest('button') : null;
    const entry = button instanceof HTMLButtonElement ? models.get(button) : undefined;
    if (!disposed && entry && controls.get(entry.model.id) === entry) bus.dispatch(entry.capture(entry.model.action));
  }, { signal: abort.signal });
  dialog.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !current?.view.open) return;
    const close = current.view.controls.find(c => c.action.kind === 'close-dialogue');
    if (close) { event.preventDefault(); event.stopPropagation(); bus.dispatch(current.capture(close.action)); }
  }, { signal: abort.signal });
  return { element, render(view: DialogueView, capture: ActionCapture) {
    if (disposed) throw new Error('Dialogue panel is disposed.');
    const model = structuredClone(view);
    if (new Set(model.controls.map(c => c.id)).size !== model.controls.length) throw new TypeError('Dialogue controls must have unique identities.');
    const wasOpen = !dialog.hidden, focus = doc.activeElement;
    current = { view: model, capture };
    if (heading.textContent !== model.speaker) heading.textContent = model.speaker;
    if (text.textContent !== model.text) text.textContent = model.text;
    const buttons = model.controls.map(c => control(c, capture));
    reconcile(actions, model.open ? buttons : []); reconcile(replayHost, model.open ? [] : buttons);
    for (const key of controls.keys()) if (!model.controls.some(c => c.id === key)) controls.delete(key);
    dialog.hidden = !model.open; replayHost.hidden = model.open || !buttons.length;
    if (model.open && !wasOpen) {
      if (focus instanceof HTMLElement && !element.contains(focus)) fallbackFocus = focus;
      returnFocus = focus instanceof HTMLElement ? focus : fallbackFocus; heading.focus();
    } else if (!model.open && wasOpen && focus instanceof Node && (dialog.contains(focus) || !focus.isConnected)) {
      const target = returnFocus?.isConnected && !element.contains(returnFocus) ? returnFocus : fallbackFocus;
      if (target?.isConnected) target.focus();
    } else if (model.open && focus instanceof HTMLElement && !focus.isConnected) heading.focus();
  }, dispose() { if (disposed) return; disposed = true; abort.abort(); controls.clear(); current = null; element.remove(); } };
}
