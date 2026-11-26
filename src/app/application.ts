// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ActionId, QualifiedId } from '../domain/types';
import { createNavigation } from '../state/navigation';
import { createReducer, createReducerState } from '../state/reducer';
import type { ReducerState } from '../state/reducer';
import { createTutorialReducer } from '../state/tutorial';
import { createPacketActivityController } from '../state/packet-activity';
import { contextFromRuntime, createActionBus } from '../ui/action-bus';
import { createAppShell } from '../ui/app-shell';
import { createDialogueController, createDialoguePanel, introductionDialogueBindings } from '../ui/dialogue';
import { createInventoryController, createInventoryPanel, inventoryView } from '../ui/inventory';
import { createNotebookController, createNotebookPanel } from '../ui/notebook';
import { createPacketJourneyPanel } from '../ui/packet-journey';
import { createNavigationPlanner, createSceneObjectProjection } from '../ui/scene-objects';
import { createTitleController, createTitlePanel } from '../ui/title';
import { createSaveDialogsController, createSaveDialogsPanel } from '../ui/save-dialogs';
import { AccountService, browserAccountWindowPort } from '../services/account';
import { GameApi } from '../services/game-api';
import { SaveCoordinator } from '../services/save-coordinator';
import { SaveValidator } from '../services/save-validator';
import { SaveReader } from '../state/save-migrations';
import { AutosaveController } from '../state/autosave';
import { publicPaths } from '../config';
import { createVerbController } from '../ui/verbs';
import { createIntroductionGraybox, type GrayboxGeometry, type IntroductionGrayboxView } from '../presentation/introduction-graybox';
import { createRoomAdapter, type RoomSettings } from '../presentation/room-adapter';
import { createResourcePool } from '../presentation/resource-pool';
import { createIntroductionRuntime, restoreIntroduction, startIntroduction } from './adventure';
import { loadIntroductionContent } from './content';
import { introductionBindings } from './introduction';
import { introductionSavePolicy } from './save-policy';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
/** Actual browser composition. No public state hook, browser storage or provider simulation. */
export function createIntroductionApplication(host: HTMLElement) {
  const { registry, world } = loadIntroductionContent(), bindings = introductionBindings(registry);
  const navigation = createNavigation({ registry, world, entries: [
    { roomId: q('R01'), safePositionId: q('R01.entry'), activity: 'stable-exploration' },
    { roomId: q('R02'), safePositionId: q('R02.entry'), activity: 'stable-exploration' },
  ] });
  let state = createReducerState(createIntroductionRuntime());
  const store = { getState: () => state,
    reduce: createTutorialReducer({ registry, reduce: createReducer({ registry, bindings: bindings.effects, canReachRoom: navigation.canReachRoom }), nextActionId: () => crypto.randomUUID() as ActionId }),
    // Controllers finish their own transient session updates after this returns.
    compareAndSet: (expected: ReducerState, next: ReducerState) => { if (state !== expected) return false; state = next; return true; },
  };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const notebook = createNotebookController({ registry, store, bus });
  const dialogue = createDialogueController({ registry, store, bus, bindings: introductionDialogueBindings, effectBindings: bindings.effects });
  const inventory = createInventoryController({ registry, store, bus });
  const packet = createPacketActivityController({ registry, store, bus });
  const sceneBindings = bindings.hotspots.filter(binding => !(binding.roomId === q('R01') && binding.hotspotId === q('HOTSPOT-capsule') && binding.actionId === q('ACTION-packet-context')));
  const verbs = createVerbController({ registry, store, bus, bindings: [...sceneBindings, ...notebook.hotspotBindings, ...dialogue.hotspotBindings, ...packet.hotspotBindings],
    walk: createNavigationPlanner({ navigation, store }), sceneObjects: createSceneObjectProjection({ registry, navigation }), panels: notebook.panels });
  const menuHost = host.ownerDocument.createElement('div'), saveHost = host.ownerDocument.createElement('div'), adventureHost = host.ownerDocument.createElement('div'); host.replaceChildren(menuHost, saveHost, adventureHost);
  const dismissedCompletions = new Set<string>();
  const createPanels = () => {
    const shell = createAppShell(adventureHost, bus);
    const pool = createResourcePool<GrayboxGeometry>({ maxEntries: 2, maxInFlight: 1, maxPrefetch: 0, maxLeases: 2, maxBytes: 32_768 });
    const graybox = createIntroductionGraybox(shell.presentationHost);
    let mode: RoomSettings['mode'] = 'three', detail: RoomSettings['detail'] = 'default';
    const reducedMotion = () => {
      const preference = state.runtime.ui?.presentation.reducedMotion ?? 'system';
      return preference === 'on' || (preference === 'system' && host.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches === true);
    };
    const adapter = createRoomAdapter({ pool, dispatcher: bus, renderers: { three: graybox }, onView: (view, originalCapture) => {
      if (view) shell.render(view, originalCapture);
      // Recovery is explicit. Subsequent semantic actions remain in text mode
      // after failure rather than repeatedly rebuilding an unavailable context.
      if (adapter.status().kind === 'unavailable') mode = 'text';
    } });
    const visualControls = host.ownerDocument.createElement('div'); visualControls.className = 'nq-graybox-controls';
    visualControls.setAttribute('role', 'group'); visualControls.setAttribute('aria-label', 'Scene presentation');
    const events = new AbortController();
    for (const [label, nextMode, nextDetail] of [['Retry visual scene', 'three', 'default'], ['Text scene', 'text', 'default'], ['Low detail scene', 'three', 'low']] as const) {
      const button = host.ownerDocument.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => { mode = nextMode; detail = nextDetail; adapter.setMode(mode, detail); }, { signal: events.signal }); visualControls.append(button);
    }
    shell.presentationHost.before(visualControls);
    const dismissProgress = host.ownerDocument.createElement('button'); dismissProgress.type = 'button'; dismissProgress.textContent = 'Dismiss investigation progress'; dismissProgress.hidden = true;
    shell.element.append(dismissProgress);
    let progressGame = state.runtime.game;
    dismissProgress.addEventListener('click', () => {
      if (!progressGame || state.runtime.game !== progressGame) return;
      progressGame.world.completedObjectiveIds.forEach(id => dismissedCompletions.add(id));
      autosave?.objectiveFeedbackDismissed(); render();
    }, { signal: events.signal });
    const pause = () => adapter.setPaused(host.ownerDocument.hidden);
    host.ownerDocument.addEventListener('visibilitychange', pause, { signal: events.signal }); pause();
    return { shell, show: (view: IntroductionGrayboxView) => adapter.show(view, { mode, detail, reducedMotion: reducedMotion() }),
      progress: (visible: boolean) => { progressGame = state.runtime.game; dismissProgress.hidden = !visible; },
      disposeScene: () => { events.abort(); adapter.dispose(); graybox.dispose(); pool.dispose(); visualControls.remove(); },
      notebook: createNotebookPanel(shell.panelHost, bus), dialogue: createDialoguePanel(shell.panelHost, bus), inventory: createInventoryPanel(shell.panelHost, bus),
      packet: createPacketJourneyPanel(shell.panelHost, bus, { reducedMotion: () => {
        const preference = state.runtime.ui?.presentation.reducedMotion ?? 'system';
        return preference === 'on' || (preference === 'system' && host.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches === true);
      } }) };
  };
  const disposePanels = () => { panels.disposeScene(); panels.packet.dispose(); panels.inventory.dispose(); panels.dialogue.dispose(); panels.notebook.dispose(); panels.shell.dispose(); };
  let panels = createPanels();
  let projectedGame = state.runtime.game, capture = bus.captureScope(contextFromRuntime(state.runtime)), disposed = false, focusRoom = false, installing = false;
  const window = host.ownerDocument.defaultView!;
  // Static HTTP remains playable. The API itself refuses non-HTTPS origins.
  const api = window.location.protocol === 'https:' ? new GameApi({ origin: window.location.origin, apiBase: publicPaths.apiBase }) : null;
  const policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
  const reader = new SaveReader({ currentContentVersion: policy.contentVersion, readPolicies: [policy], migrations: [] });
  const account = api ? new AccountService(api, browserAccountWindowPort(window)) : null;
  const coordinator = api ? new SaveCoordinator({ api, store, validator, reader }) : null;
  const autosave = api && coordinator ? new AutosaveController({ api, coordinator, store }) : null;
  const invalidateGameplay = () => {
    autosave?.invalidateView(); dismissedCompletions.clear();
    packet.invalidate(); dialogue.invalidate(); notebook.invalidate(); bus.invalidate();
    disposePanels(); panels = createPanels(); projectedGame = null; capture = bus.captureScope(contextFromRuntime(state.runtime));
  };
  const saves = createSaveDialogsController({ api, account, coordinator, store, changed: () => render(), invalidateGameplay,
    restore: (review, view) => {
      if (!coordinator?.isCurrentView(view) || !coordinator.isCurrentReview(review) || review.read?.status !== 'ready' || !review.summary) return false;
      const next = createReducerState(restoreIntroduction(state.runtime, review.read.snapshot));
      installing = true;
      saves.invalidateView(); invalidateGameplay(); state = next; title.invalidate(); focusRoom = true;
      saves.bindCurrentSession({ knownSlot: review.summary });
      installing = false; return true;
    },
  });
  const title = createTitleController({ getState: store.getState, changed: () => render(), start: before => {
    if (state !== before) return false;
    const next = createReducerState(startIntroduction(before.runtime, registry));
    installing = true; saves.invalidateView(); invalidateGameplay(); state = next; focusRoom = true;
    saves.bindCurrentSession({ knownSlot: before.runtime.persistence.knownSlot, autosaveOff: true });
    installing = false;
    return true;
  }, services: { available: !!api, save: () => { void saves.save(); }, continue: () => { void saves.continue(); }, signIn: provider => { void saves.signIn(provider); } } });
  const menu = createTitlePanel(menuHost, action => title.act(action));
  const saveDialogs = createSaveDialogsPanel(saveHost, action => { void saves.act(action); });
  function render() {
    if (disposed || installing) return;
    const game = state.runtime.game;
    adventureHost.hidden = game === null;
    if (game !== projectedGame) { projectedGame = game; capture = bus.captureScope(contextFromRuntime(state.runtime)); }
    const notebookView = notebook.project();
    if (game) {
      const room = registry.record(game.world.roomId), name = world.rooms.find(room => room.id === game.world.roomId)?.name;
      if (room?.kind !== 'room' || !name) throw new Error('The current room is unavailable.');
      const completions = game.world.completedObjectiveIds.filter(id => !dismissedCompletions.has(id)).flatMap(id => { const objective = registry.record(id); return objective?.kind === 'objective'
        ? [{ id: `completion:${id}`, speaker: 'Investigation progress', text: objective.completionExplanation }] : []; });
      panels.progress(completions.length > 0);
      panels.show({ roomId: game.world.roomId, safePositionId: game.world.position.safePositionId,
        context: contextFromRuntime(state.runtime), title: name, description: room.description, controls: verbs.controls(), objects: verbs.objects(),
        evidence: notebookView.view.evidence.map(entry => ({ id: entry.id, label: entry.heading, text: entry.text, source: `${entry.sourceRoom} · ${entry.kind}`, freshness: entry.freshness })),
        captions: [{ id: `ambience:${room.id}`, text: room.ambience.text }, ...completions] });
    }
    panels.inventory.render(inventoryView(registry, state, [q('ITEM-inspection-kit')]), capture);
    panels.notebook.render(notebookView.view, notebookView.capture);
    const dialogueView = dialogue.project(); panels.dialogue.render(dialogueView.view, dialogueView.capture);
    const packetView = packet.project(); panels.packet.render(packetView.view, packetView.capture);
    // Focus the invitation only after the panel that just closed restores focus.
    menu.render(title.project());
    // Coordinator events and ordinary reducer edits both update save status.
    saveDialogs.render(saves.project());
    if (focusRoom) { panels.shell.element.querySelector('h1')?.focus(); focusRoom = false; }
    autosave?.observe();
  }
  // Every controller subscriber was registered before this final render observer.
  const unsubscribe = bus.subscribe(() => render()), unsubscribeAutosave = autosave?.subscribe(() => render()); render(); void saves.bootstrap();
  return { dispose() {
    if (disposed) return; disposed = true; unsubscribe(); packet.dispose(); dialogue.dispose(); notebook.dispose(); inventory.dispose(); verbs.dispose();
    unsubscribeAutosave?.(); autosave?.dispose(); saves.dispose(); saveDialogs.dispose(); menu.dispose(); disposePanels(); bus.dispose();
  } };
}
