// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ActionId, ObjectiveId, QualifiedId } from '../domain/types';
import type { ToySymbolProfile } from '../domain/packet-journey';
import { createNavigation } from '../state/navigation';
import { createReducer, createReducerState } from '../state/reducer';
import type { ReducerState } from '../state/reducer';
import type { PresentationSettings } from '../state/types';
import { createTutorialReducer } from '../state/tutorial';
import { createPacketActivityController } from '../state/packet-activity';
import { contextFromRuntime, createActionBus } from '../ui/action-bus';
import { createAppShell } from '../ui/app-shell';
import { createAdventureFrame } from '../ui/adventure-frame';
import { createDialogueController, createDialoguePanel, introductionDialogueBindings } from '../ui/dialogue';
import { createInventoryController, createInventoryPanel, inventoryView } from '../ui/inventory';
import { createNotebookController, createNotebookPanel } from '../ui/notebook';
import { createCompendiumController, createCompendiumPanel } from '../ui/compendium';
import { createPacketJourneyPanel } from '../ui/packet-journey';
import { createNavigationPlanner, createSceneObjectProjection } from '../ui/scene-objects';
import { createTitleController, createTitlePanel } from '../ui/title';
import { createSaveDialogsController, createSaveDialogsPanel } from '../ui/save-dialogs';
import { createAccountSettingsController, createAccountSettingsPanel, createAutosaveSettingsPanel } from '../ui/account-settings';
import { AccountService, browserAccountWindowPort } from '../services/account';
import { GameApi } from '../services/game-api';
import { SaveCoordinator } from '../services/save-coordinator';
import { SaveValidator } from '../services/save-validator';
import { SaveReader } from '../state/save-migrations';
import { AutosaveController } from '../state/autosave';
import { publicPaths } from '../config';
import { createVerbController } from '../ui/verbs';
import type { HotspotBinding } from '../ui/verbs';
import { guardedPlan, reductionPlan, unavailable } from '../ui/controller-store';
import { createDiagnosticsController, createDiagnosticsPanel } from '../ui/diagnostics';
import { createRepairPlanController, createRepairPlanPanel } from '../ui/repair-plan';
import { createEpiloguePanel, projectAcceptedNarrative } from '../ui/epilogue';
import type { EpilogueProjection } from '../ui/epilogue';
import { createRecoveryController, createRecoveryPanel } from '../ui/recovery';
import { copperEffectBindings, createCopperScenarioResolver } from '../state/copper-scenario';
import { fiberEffectBindings, createFiberScenarioResolver, prepareFiberAction } from '../state/fiber-scenario';
import { radioEffectBindings, createRadioScenarioResolver, prepareRadioAction } from '../state/radio-scenario';
import { createEquipmentScenarioResolver, equipmentInteractionBindings, inspectClockworksSamples } from '../state/equipment-scenarios';
import { objectiveEffectBindings } from '../state/objectives';
import type { ObjectiveScenarioResolver } from '../state/objectives';
import { createRepairScenarioResolver, repairEffectBindings } from '../state/repair-plan';
import { allowRiftEncounterInput, isActiveRiftEncounter } from '../state/rift-encounter';
import { captureOutcomeContext, createOutcomeController } from '../state/outcomes';
import { createRiftHazardController } from '../state/rift-hazard';
import { validateEndingsContent } from '../content/endings';
import { createRiftHazardPlan } from '../ui/rift-hazard';
import { allowRiftEncounterAction, createEncounterClassificationPlan, createEncounterExecutionPlan, createRiftEncounterNavigation } from '../ui/encounter';
import routeNotebook from '../../content/spec001/notebook-first-route.json';
import technicalSources from '../../content/spec001/sources.json';
import endingsDocument from '../../content/spec001/endings.json';
import introLayouts from '../../content/spec001/presentation/introduction-graybox.json';
import routeLayouts from '../../content/spec001/presentation/first-route-graybox.json';
import { createIntroductionGraybox, type GrayboxGeometry, type IntroductionGrayboxView } from '../presentation/introduction-graybox';
import { createRoomAdapter, type RoomSettings } from '../presentation/room-adapter';
import { createResourcePool } from '../presentation/resource-pool';
import { createThreeRoom, type RoomResource } from '../presentation/three-room';
import { resolveRoomMedia } from '../presentation/room-media';
import { createRoomAudioPanel } from '../presentation/room-audio';
import { createIntroductionRuntime, restoreIntroduction, startIntroduction } from './adventure';
import { episodeNavigationEntries, loadIntroductionContent } from './content';
import { introductionBindings } from './introduction';
import { introductionSavePolicy } from './save-policy';

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
/** Actual browser composition. No public state hook, browser storage or provider simulation. */
export function createIntroductionApplication(host: HTMLElement) {
  const { registry, world } = loadIntroductionContent(), bindings = introductionBindings(registry), media = resolveRoomMedia(registry);
  const equipmentBindings = equipmentInteractionBindings(registry), copperEffects = copperEffectBindings(registry);
  const fiberEffects = fiberEffectBindings(registry), radioEffects = radioEffectBindings(registry);
  if (!copperEffects.length) throw new Error('The copper preparation actions could not be validated.');
  if (!fiberEffects.length || !radioEffects.length) throw new Error('The branch preparation actions could not be validated.');
  const copperBindings: HotspotBinding[] = [
    ['R03', 'copper-bench-cards', 'read-compatibility'], ['R03', 'copper-original-section', 'read-defect'],
    ['R03', 'copper-original-section', 'restore-original'], ['R03', 'copper-replacement', 'replace-section'],
    ['R03', 'copper-alternate-path', 'alternate-path'], ['R04', 'echo-before-case', 'read-before'],
    ['R04', 'echo-repeater-core', 'read-repeater'], ['R04', 'echo-repeater-core', 'repeater-requires-continuity'],
    ['R04', 'echo-repeater-core', 'repeater-bridges-open'],
  ].map(([room, hotspot, choice]) => ({ roomId: q<'room'>(room!), hotspotId: q(`HOTSPOT-${hotspot}`), verb: 'use', itemId: null,
    actionId: q(`ACTION-copper-${choice}`), sourceId: q(`DIALOGUE-copper-${room === 'R03' ? 'bench' : 'exhibit'}`), mode: 'effects' }));
  const copperScenario = createCopperScenarioResolver(registry), equipmentScenario = createEquipmentScenarioResolver(registry);
  const fiberScenario = createFiberScenarioResolver(registry), radioScenario = createRadioScenarioResolver(registry);
  const objectiveScenario: ObjectiveScenarioResolver = (game, id) => copperScenario(game, id) ?? fiberScenario(game, id) ?? radioScenario(game, id) ?? equipmentScenario(game, id);
  const repairScenario = createRepairScenarioResolver(registry);
  const effectBindings = [...bindings.effects, ...copperEffects, ...fiberEffects, ...radioEffects, ...equipmentBindings.effects,
    ...objectiveEffectBindings(registry, ['O03', 'O04', 'O05', 'O06', 'O07', 'O08', 'O09', 'O10'].map(id => q<'objective'>(id))), ...repairEffectBindings(registry)];
  const routeObjective = (room: string | undefined): ObjectiveId | null => {
    const id = ({ 'spec001:R03': 'O03', 'spec001:R04': 'O04', 'spec001:R05': 'O05', 'spec001:R06': 'O06', 'spec001:R07': 'O07', 'spec001:R08': 'O08', 'spec001:R09': 'O09', 'spec001:R10': 'O10', 'spec001:R11': 'O11', 'spec001:R12': 'O12' } as Record<string, string>)[room ?? ''];
    return id ? q<'objective'>(id) : null;
  };
  let activityPanel: 'diagnostics' | 'repair' | null = null, activityRoom: string | null = null;
  const defaultPresentation: PresentationSettings = { musicVolume: 1, effectsVolume: 1, voiceVolume: 1, captions: true, reducedMotion: 'system', textScale: 1 };
  let loadedApiGeneration: ReturnType<GameApi['capture']> | null = null, loadedAuthGeneration: number | null = null, preferenceReviewRequired = false;
  let presentation = defaultPresentation, preferenceMessage = 'Guest preferences last for this tab.', preferenceRevision = '', preferenceOperation: object | null = null;
  const navigation = createNavigation({ registry, world, entries: episodeNavigationEntries(registry, world) });
  let state = createReducerState(createIntroductionRuntime());
  const store = { getState: () => state,
    reduce: createTutorialReducer({ registry, reduce: createReducer({ registry, bindings: effectBindings, objectiveScenario, repairScenario, canReachRoom: navigation.canReachRoom,
      allowDuringEncounter: allowRiftEncounterInput }), nextActionId: () => crypto.randomUUID() as ActionId }),
    // Controllers finish their own transient session updates after this returns.
    compareAndSet: (expected: ReducerState, next: ReducerState) => { if (state !== expected) return false; state = next; return true; },
  };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  // These exact authored sources are already accepted by the closed adapters.
  // Every exposed choice still runs its adapter against the captured game before
  // the shared reducer commits; UI metadata never supplies effects or verdicts.
  const branchBindings: HotspotBinding[] = ([
    ['R05', 'DIALOGUE-fiber-gardens', prepareFiberAction], ['R06', 'DIALOGUE-fiber-vault', prepareFiberAction],
    ['R07', 'DIALOGUE-radio-skywell', prepareRadioAction], ['R08', 'DIALOGUE-radio-observatory', prepareRadioAction],
  ] as const).flatMap(([roomId, sourceId, prepare]) => {
    const room = registry.record(q(roomId)), source = registry.record(q(sourceId));
    if (room?.kind !== 'room' || source?.kind !== 'dialogue' || source.nodes.length !== 1) throw new Error('An authored branch interaction is missing.');
    return room.hotspots.flatMap(hotspot => source.nodes[0]!.choices.filter(choice => choice.effects.length && hotspot.actionIds.includes(choice.id)).map(choice => ({
      roomId: q<'room'>(roomId), hotspotId: hotspot.id as QualifiedId, verb: 'use' as const, itemId: null,
      actionId: choice.id as QualifiedId, sourceId: q(sourceId), mode: 'port' as const,
      plan: (_interaction, action, before) => {
        const game = before.runtime.game;
        if (!game) return unavailable('unavailable-state', 'Start an adventure before preparing a route.');
        const evaluation = prepare(registry, game, choice.id as QualifiedId);
        if (evaluation.status !== 'correct') return unavailable(evaluation.reasonCode, 'This preparation is unavailable. Check the current room evidence and controls.');
        return guardedPlan(store, before, reductionPlan(store, action, before, { kind: 'apply', evaluation }, choice.text));
      },
    })));
  });
  const notebook = createNotebookController({ registry, store, bus, presentation: routeNotebook, allowDuringEncounter: allowRiftEncounterAction });
  const compendium = createCompendiumController({ registry, store, bus, metadata: world, navigation, notebook, sourceCatalog: technicalSources.sources,
    gameBase: import.meta.env.BASE_URL, allowDuringEncounter: allowRiftEncounterAction });
  const dialogue = createDialogueController({ registry, store, bus, bindings: introductionDialogueBindings, effectBindings });
  const diagnostics = createDiagnosticsController({ registry, store, bus, resolveScenario: objectiveScenario, allowDuringEncounter: allowRiftEncounterAction });
  const outcomes = createOutcomeController({ registry, repairScenario });
  const checkedEndings = validateEndingsContent(endingsDocument);
  if (!checkedEndings.ok) throw new Error('The ending and fictional danger descriptions could not be validated.');
  const endings = checkedEndings.value, hazards = createRiftHazardController({ registry, content: endings });
  const unsubscribeHazard = bus.register('commit-rift-hazard', action => createRiftHazardPlan({ controller: hazards, store, action, before: store.getState() }));
  const repair = createRepairPlanController({ registry, store, bus, resolveScenario: repairScenario, allowDuringEncounter: allowRiftEncounterAction,
    hazard: hazards.offer,
    executePlan: (action, before, message) => createEncounterExecutionPlan({ registry, store, action, before, message }),
    classifyPlan: (action, before, message) => createEncounterClassificationPlan({ controller: outcomes, store, action, before, message }) });
  const inventory = createInventoryController({ registry, store, bus });
  const packet = createPacketActivityController({ registry, store, bus, resolveRepairScenario: repairScenario });
  const sceneBindings = bindings.hotspots.filter(binding => !(binding.roomId === q('R01') && binding.hotspotId === q('HOTSPOT-capsule') && binding.actionId === q('ACTION-packet-context')));
  const normalWalk = createNavigationPlanner({ navigation, store }), encounterNavigation = createRiftEncounterNavigation({ navigation, store });
  const verbs = createVerbController({ registry, store, bus, allowDuringEncounter: allowRiftEncounterAction,
    bindings: [...sceneBindings, ...copperBindings, ...branchBindings, ...equipmentBindings.hotspots, ...notebook.hotspotBindings, ...dialogue.hotspotBindings, ...packet.hotspotBindings],
    walk: (...args) => isActiveRiftEncounter(args[2]) ? encounterNavigation.plan(...args) : normalWalk(...args),
    sceneObjects: createSceneObjectProjection({ registry, navigation, resolveDuringEncounter: encounterNavigation.resolve }), panels: (panel, action, before) => panel === 'compendium'
      ? compendium.panels(panel, action, before) : notebook.panels(panel, action, before) });
  const mediaHost = host.ownerDocument.createElement('div');
  const menuHost = host.ownerDocument.createElement('div'), saveHost = host.ownerDocument.createElement('div'), settingsHost = host.ownerDocument.createElement('div'), adventureHost = host.ownerDocument.createElement('div'); host.replaceChildren(menuHost, mediaHost, saveHost, settingsHost, adventureHost);
  adventureHost.className = 'nq-adventure-host';
  const frame = createAdventureFrame(host, { menu: menuHost, saves: saveHost, settings: settingsHost, sound: mediaHost, adventure: adventureHost });
  const dismissedCompletions = new Set<string>();
  let recovery: ReturnType<typeof createRecoveryController> | null = null;
  let narrativeProjection: EpilogueProjection<() => void> | null = null, narrativeState: ReducerState | null = null;
  const createPanels = (retainedEpilogue?: ReturnType<typeof createEpiloguePanel<() => void>>) => {
    const shell = createAppShell(adventureHost, bus);
    const pool = createResourcePool<GrayboxGeometry>({ maxEntries: 2, maxInFlight: 1, maxPrefetch: 0, maxLeases: 2, maxBytes: 32_768 });
    const layouts = { version: 1, rooms: [...introLayouts.rooms, ...routeLayouts.rooms] };
    const graybox = createIntroductionGraybox(shell.presentationHost, { data: layouts, roomIds: layouts.rooms.map(room => room.roomId) });
    const mediaPool = createResourcePool<RoomResource>({ maxEntries: 16, maxInFlight: 4, maxPrefetch: 0, maxLeases: 32, maxBytes: 244_000_000 });
    const finished = createThreeRoom(shell.presentationHost, media, publicPaths.gameBase);
    const sound = createRoomAudioPanel(mediaHost, media, publicPaths.gameBase, next => { void changePresentation(next); }, () => { void refreshPresentation(); });
    let mode: RoomSettings['mode'] = 'three', detail: RoomSettings['detail'] = 'default';
    const reducedMotion = () => {
      const preference = presentation.reducedMotion;
      return preference === 'on' || (preference === 'system' && host.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches === true);
    };
    const onView = (view: Parameters<typeof shell.render>[0] | null, originalCapture?: Parameters<typeof shell.render>[1]) => {
      if (view) { shell.render(view, originalCapture); frame.sync(!!state.runtime.game); }
      if (view?.presentationStatus.startsWith('Visual presentation unavailable')) mode = 'text';
    };
    const grayAdapter = createRoomAdapter({ pool, dispatcher: bus, renderers: { three: graybox }, onView });
    const finishedAdapter = createRoomAdapter({ pool: mediaPool, dispatcher: bus, renderers: { three: finished }, onView });
    let roomId: string | null = null;
    const activeAdapter = () => roomId === 'spec001:R01' ? finishedAdapter : grayAdapter;
    const visualControls = host.ownerDocument.createElement('div'); visualControls.className = 'nq-graybox-controls';
    visualControls.setAttribute('role', 'group'); visualControls.setAttribute('aria-label', 'Scene presentation');
    const events = new AbortController();
    for (const [label, nextMode, nextDetail] of [['Retry visual scene', 'three', 'default'], ['Text scene', 'text', 'default'], ['Low detail scene', 'three', 'low']] as const) {
      const button = host.ownerDocument.createElement('button'); button.type = 'button'; button.textContent = label;
      button.addEventListener('click', () => { mode = nextMode; detail = nextDetail; activeAdapter().setMode(mode, detail); }, { signal: events.signal }); visualControls.append(button);
    }
    frame.attach(shell, visualControls);
    const diagnosticButton = host.ownerDocument.createElement('button'), repairButton = host.ownerDocument.createElement('button');
    diagnosticButton.type = repairButton.type = 'button'; diagnosticButton.textContent = 'Diagnostics';
    diagnosticButton.hidden = repairButton.hidden = true;
    const contextControls = shell.element.querySelector('.nq-frame-tools')!;
    contextControls.append(diagnosticButton, repairButton);
    diagnosticButton.addEventListener('click', () => { activityPanel = 'diagnostics'; render(); }, { signal: events.signal });
    repairButton.addEventListener('click', () => { activityPanel = 'repair'; render(); }, { signal: events.signal });
    const closeActivity = () => { activityPanel = null; render(); };
    const dismissProgress = host.ownerDocument.createElement('button'); dismissProgress.type = 'button'; dismissProgress.textContent = 'Dismiss investigation progress'; dismissProgress.hidden = true;
    shell.element.querySelector('.nq-shell-captions')!.append(dismissProgress);
    let progressGame = state.runtime.game;
    dismissProgress.addEventListener('click', () => {
      if (!progressGame || state.runtime.game !== progressGame) return;
      progressGame.world.completedObjectiveIds.forEach(id => dismissedCompletions.add(id));
      autosave?.objectiveFeedbackDismissed(); render();
    }, { signal: events.signal });
    const pause = () => { grayAdapter.setPaused(host.ownerDocument.hidden); finishedAdapter.setPaused(host.ownerDocument.hidden); };
    host.ownerDocument.addEventListener('visibilitychange', pause, { signal: events.signal }); pause();
    // First visible gameplay dialog owns the frame. A recovery confirmation
    // therefore precedes the epilogue that opened it, while both keep their own
    // captured commands and local presentation state.
    const recoveryPanel = createRecoveryPanel(shell.panelHost, {
      confirm: confirmation => { const result = recovery?.confirm(confirmation); if (result?.ok && result.action === 'rollback') panels.shell.announce(result.message); },
      cancel: confirmation => { recovery?.cancel(confirmation); },
      isCurrent: confirmation => recovery?.project() === confirmation,
    });
    const epilogue = retainedEpilogue ?? createEpiloguePanel<() => void>(shell.panelHost, {
      dispatch: command => command(), isCurrent: projection => projection === narrativeProjection && state === narrativeState,
    });
    if (retainedEpilogue) epilogue.mount(shell.panelHost);
    return { shell, sound, react: finished.react, show: (view: IntroductionGrayboxView) => {
      if (roomId !== view.roomId) { activeAdapter().hide(); roomId = view.roomId; }
      activeAdapter().show(view, { mode, detail, reducedMotion: reducedMotion() });
    },
      progress: (visible: boolean) => { progressGame = state.runtime.game; dismissProgress.hidden = !visible; },
      contextual: (currentRoom: string | undefined) => {
        diagnosticButton.hidden = !routeObjective(currentRoom);
        repairButton.hidden = currentRoom !== q('R11') && currentRoom !== q('R12');
        repairButton.textContent = currentRoom === q('R12') ? 'Validate repair' : 'Repair plan';
      },
      disposeScene: () => { events.abort(); grayAdapter.dispose(); finishedAdapter.dispose(); graybox.dispose(); finished.dispose(); pool.dispose(); mediaPool.dispose(); sound.dispose(); visualControls.remove(); },
      epilogue, recovery: recoveryPanel,
      notebook: createNotebookPanel(shell.panelHost, bus), compendium: createCompendiumPanel(shell.panelHost, bus), dialogue: createDialoguePanel(shell.panelHost, bus), inventory: createInventoryPanel(shell.panelHost, bus),
      diagnostics: createDiagnosticsPanel(shell.panelHost, bus, closeActivity), repair: createRepairPlanPanel(shell.panelHost, bus, closeActivity),
      packet: createPacketJourneyPanel(shell.panelHost, bus, { reducedMotion: () => {
        const preference = presentation.reducedMotion;
        return preference === 'on' || (preference === 'system' && host.ownerDocument.defaultView?.matchMedia('(prefers-reduced-motion: reduce)').matches === true);
      } }) };
  };
  const disposePanels = (retainEpilogue = false) => { panels.disposeScene(); panels.packet.dispose(); panels.inventory.dispose(); panels.dialogue.dispose(); panels.notebook.dispose(); panels.compendium.dispose(); panels.diagnostics.dispose(); panels.repair.dispose(); panels.recovery.dispose(); if (!retainEpilogue) panels.epilogue.dispose(); panels.shell.dispose(); };
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
  let accountScope: object = {}, settingsInstallation = false;
  let accountSettings: ReturnType<typeof createAccountSettingsController> | null = null;
  const invalidateGameplay = () => {
    accountScope = {}; if (preferenceOperation) preferenceMessage = 'Preferences apply in this tab. Account confirmation was interrupted.'; preferenceOperation = null;
    if (!settingsInstallation) accountSettings?.invalidateView();
    autosave?.invalidateView(); dismissedCompletions.clear();
    activityPanel = null; activityRoom = null; diagnostics.invalidate(); repair.invalidate(); packet.invalidate(); dialogue.invalidate(); notebook.invalidate(); compendium.invalidate(); bus.invalidate();
    recovery?.invalidate(); narrativeProjection = null; narrativeState = null;
    const retainedEpilogue = panels.epilogue;
    // Capture presentation before removing the old shell; moving a focused DOM
    // node can otherwise send focus to body even when its story is unchanged.
    retainedEpilogue.mount(adventureHost);
    disposePanels(true); panels = createPanels(retainedEpilogue); projectedGame = null; capture = bus.captureScope(contextFromRuntime(state.runtime));
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
    if (state !== before || accountSettings?.busy) return false;
    const next = createReducerState(startIntroduction(before.runtime, registry));
    installing = true; saves.invalidateView(); invalidateGameplay(); state = next; focusRoom = true;
    saves.bindCurrentSession({ knownSlot: before.runtime.persistence.knownSlot, autosaveOff: true });
    installing = false;
    return true;
  }, services: { available: !!api, save: () => { void saves.save(); }, continue: () => { void saves.continue(); }, signIn: provider => { void saves.signIn(provider); } } });
  recovery = createRecoveryController({ registry, store, outcomes, hazards,
    restore: { available: () => !!api && !!coordinator && !accountSettings?.busy,
      continue: () => saves.continue(), signIn: () => { void saves.continue(); } },
    changed: () => render(), afterRollback: () => {
      // Keep the ordinary save coordinator and any prior pending write intact.
      // Recovery installed its complete new attempt before this callback.
      // These controllers notify synchronously. Reconcile the complete UI once
      // through recovery.changed, after all old scopes have been retired; three
      // intermediate renders would exhaust the bounded room preparation pool.
      installing = true;
      try {
        activityPanel = null; activityRoom = null; diagnostics.invalidate(); repair.invalidate(); packet.invalidate(); dialogue.invalidate(); notebook.invalidate(); compendium.invalidate(); bus.invalidate();
        saves.retireAdventureReview();
        narrativeProjection = null; narrativeState = null; projectedGame = null;
        // Preserve this adventure's already-declined guest sign-in invitation.
        title.act('cancel');
      } finally { installing = false; }
    },
  });
  const deletionAccount = api ? new AccountService(api, browserAccountWindowPort(window)) : null;
  accountSettings = api && deletionAccount ? createAccountSettingsController({ api, account: deletionAccount, getState: store.getState, changed: () => render(),
    lifecycle: {
      capture: () => accountScope, isCurrent: view => !disposed && accountScope === view,
      stopCompetingWork: view => {
        if (disposed || accountScope !== view) return null;
        installing = true; settingsInstallation = true;
        try { saves.invalidateView(); autosave?.invalidateView(); accountScope = {}; return accountScope; }
        finally { settingsInstallation = false; installing = false; }
      },
      adoptDeletionSession: (view, session, generation) => {
        if (disposed || accountScope !== view || !api.isCurrent(generation) || api.session !== session) return null;
        installing = true; settingsInstallation = true;
        try { return saves.adoptVerifiedSession(session, generation) ? { runtime: accountScope, generation: api.capture() } : null; }
        finally { settingsInstallation = false; installing = false; }
      },
      clearToTitle: (view, generation) => {
        if (disposed || accountScope !== view || !api.isCurrent(generation)) return false;
        installing = true; settingsInstallation = true;
        try {
          if (api.forgetSession(generation) === null) return false;
          saves.invalidateView(); deletionAccount?.invalidateView(); autosave?.invalidateView(); state = createReducerState(createIntroductionRuntime()); presentation = defaultPresentation; preferenceRevision = ''; loadedApiGeneration = null; loadedAuthGeneration = null; preferenceReviewRequired = false; preferenceMessage = 'Guest preferences last for this tab.';
          invalidateGameplay(); title.invalidate(); focusRoom = false; return true;
        } finally { settingsInstallation = false; installing = false; }
      },
    },
  }) : null;
  const settingsPanel = accountSettings ? createAccountSettingsPanel(settingsHost, action => { void accountSettings?.act(action); }) : null;
  const autosavePanel = settingsPanel && autosave ? createAutosaveSettingsPanel(settingsPanel.element, autosave) : null;
  const menu = createTitlePanel(menuHost, action => {
    if (action === 'settings' && accountSettings) { title.act('cancel'); void accountSettings.act('open'); return; }
    if (accountSettings?.busy) return;
    if (accountSettings?.project().open) void accountSettings.act('close');
    title.act(action);
  });
  const saveDialogs = createSaveDialogsPanel(saveHost, action => { if (!accountSettings?.busy) void saves.act(action); });
  const matchingPreferenceSession = () => {
    const session = api?.session, auth = state.runtime.auth;
    return !!api && session?.state === 'authenticated' && auth.status === 'authenticated' && session.csrfToken === auth.csrfToken;
  };
  const installPresentation = (next: PresentationSettings) => {
    presentation = Object.freeze({ ...next });
    if (state.runtime.ui) state = { ...state, runtime: { ...state.runtime, ui: { ...state.runtime.ui, presentation } } };
  };
  async function refreshPresentation() {
    if (disposed || !api || !matchingPreferenceSession() || accountSettings?.busy || preferenceOperation) return;
    const operation = {}, scope = accountScope, generation = api.capture(), authGeneration = state.runtime.auth.clientGeneration;
    preferenceOperation = operation; preferenceMessage = 'Reading account presentation preferences…'; render();
    const result = await api.getSession();
    if (disposed || preferenceOperation !== operation || accountScope !== scope || state.runtime.auth.clientGeneration !== authGeneration) return;
    preferenceOperation = null;
    if (!api.isCurrent(generation) || !matchingPreferenceSession()) {
      preferenceReviewRequired = true; preferenceMessage = 'The account session changed. Sign in again before updating account preferences.'; render(); return;
    }
    if (!result.ok || result.data.state !== 'authenticated') {
      preferenceReviewRequired = true; preferenceMessage = 'Account preferences could not be read. Your current tab settings remain; use Reload to try again.'; render(); return;
    }
    const { autosaveEnabled: _autosave, ...values } = result.data.preferences.values;
    installPresentation(values); preferenceRevision = result.data.preferences.etag; loadedApiGeneration = generation; loadedAuthGeneration = authGeneration;
    preferenceReviewRequired = false; preferenceMessage = 'Current account preferences loaded for review. Choose a setting to change it.'; render();
  }
  async function changePresentation(next: PresentationSettings) {
    if (disposed || accountSettings?.busy || preferenceOperation || preferenceReviewRequired) return;
    const session = api?.session;
    if (session?.state === 'authenticated' && !matchingPreferenceSession()) { preferenceReviewRequired = true; preferenceMessage = 'Sign in again before updating account preferences.'; render(); return; }
    installPresentation(next);
    const operation = {}, scope = accountScope, generation = api?.capture(), authGeneration = state.runtime.auth.clientGeneration;
    preferenceOperation = operation;
    if (!api || session?.state !== 'authenticated' || generation === undefined) {
      preferenceOperation = null; preferenceMessage = 'Guest preferences last for this tab.'; render(); return;
    }
    preferenceMessage = 'Saving account presentation preferences…'; render();
    const ownsScope = () => !disposed && preferenceOperation === operation && accountScope === scope && state.runtime.auth.clientGeneration === authGeneration;
    const result = await api.patchPreferences(next, session.preferences.etag);
    if (!ownsScope()) return;
    if (!api.isCurrent(generation) || !matchingPreferenceSession()) {
      preferenceOperation = null; preferenceReviewRequired = true; preferenceMessage = 'The account session changed. Sign in again before updating account preferences.'; render(); return;
    }
    if (!result.ok) {
      preferenceOperation = null; preferenceReviewRequired = true;
      preferenceMessage = result.status === 412 ? 'Account preferences changed in another tab. Reload account presentation preferences to review them before changing a setting.'
        : 'Preferences apply in this tab. Account update was not confirmed; reload account presentation preferences before retrying.';
      render(); return;
    }
    const refreshed = await api.getSession();
    if (!ownsScope()) return;
    preferenceOperation = null;
    if (api.isCurrent(generation) && matchingPreferenceSession() && refreshed.ok && refreshed.data.state === 'authenticated'
      && refreshed.data.preferences.revision >= result.data.revision
      && Object.entries(next).every(([key, value]) => refreshed.data.state === 'authenticated' && refreshed.data.preferences.values[key as keyof PresentationSettings] === value)) {
      preferenceRevision = refreshed.data.preferences.etag; loadedApiGeneration = generation; loadedAuthGeneration = authGeneration;
      preferenceReviewRequired = false; preferenceMessage = 'Presentation preferences saved to your account.';
    } else { preferenceReviewRequired = true; preferenceMessage = 'Preferences apply in this tab. Reload account presentation preferences to confirm the account setting.'; }
    render();
  }
  function render() {
    if (disposed || installing) return;
    const renderFocus = host.ownerDocument.activeElement;
    const session = api?.session;
    const identityChanged = loadedApiGeneration !== api?.capture() || loadedAuthGeneration !== state.runtime.auth.clientGeneration;
    if (!preferenceOperation && matchingPreferenceSession() && session?.state === 'authenticated'
      && (identityChanged || (!preferenceReviewRequired && session.preferences.etag !== preferenceRevision))) {
      const { autosaveEnabled: _autosave, ...values } = session.preferences.values;
      installPresentation(values); preferenceRevision = session.preferences.etag; loadedApiGeneration = api!.capture(); loadedAuthGeneration = state.runtime.auth.clientGeneration;
      preferenceReviewRequired = false; preferenceMessage = 'Account presentation preferences loaded.';
    }
    const game = state.runtime.game;
    const narrative = projectAcceptedNarrative(endings, state, { outcomes, hazards });
    if (narrative) activityPanel = null;
    if ((game?.world.roomId ?? null) !== activityRoom) { activityRoom = game?.world.roomId ?? null; activityPanel = null; }
    panels.contextual(game?.world.roomId);
    panels.sound.show(game?.world.roomId ?? null, presentation, preferenceMessage, { authenticated: matchingPreferenceSession(), busy: !!preferenceOperation || accountSettings?.busy === true, reviewRequired: preferenceReviewRequired });
    frame.element.style.fontSize = `${presentation.textScale}rem`;
    adventureHost.hidden = game === null;
    if (game !== projectedGame) { projectedGame = game; capture = bus.captureScope(contextFromRuntime(state.runtime)); }
    const notebookView = notebook.project();
    if (game) {
      const room = registry.record(game.world.roomId), name = world.rooms.find(room => room.id === game.world.roomId)?.name;
      if (room?.kind !== 'room' || !name) throw new Error('The current room is unavailable.');
      const completions = game.world.completedObjectiveIds.filter(id => !dismissedCompletions.has(id)).flatMap(id => { const objective = registry.record(id); return objective?.kind === 'objective'
        ? [{ id: `completion:${id}`, speaker: 'Investigation progress', text: objective.completionExplanation }] : []; });
      const symbolProfile = registry.record(q('PROFILE-SYMBOLS'));
      const samples = symbolProfile?.kind === 'profile' ? inspectClockworksSamples(game, { id: symbolProfile.id, parameters: symbolProfile.parameters } as ToySymbolProfile) : null;
      const trace = samples?.observations.find(observation => observation.kind === 'toy-trace');
      const sampling = trace?.kind === 'toy-trace' ? [{ id: 'clockworks-samples', speaker: 'Sampling gate',
        text: trace.samples.map((sample, index) => `Sample position ${sample.position}: ${sample.value} toy-level represents ${trace.pairs[index]}.`).join(' ') + ' This is the declared teaching map, not a complete PAM4 PHY.' }] : [];
      panels.progress(completions.length > 0);
      panels.show({ roomId: game.world.roomId, safePositionId: game.world.position.safePositionId,
        context: contextFromRuntime(state.runtime), title: name, description: room.description, controls: verbs.controls(), objects: verbs.objects(),
        evidence: notebookView.view.evidence.map(entry => ({ id: entry.id, label: entry.heading, text: entry.text, source: `${entry.sourceRoom} · ${entry.kind}`, freshness: entry.freshness })),
        captions: [{ id: `ambience:${room.id}`, text: room.ambience.text }, ...sampling, ...completions] });
    }
    frame.preparePanels();
    panels.inventory.render(inventoryView(registry, state, [q('ITEM-inspection-kit')]), capture);
    panels.notebook.render(notebookView.view, notebookView.capture);
    const compendiumView = compendium.project(); panels.compendium.render(compendiumView.view, compendiumView.open, compendiumView.capture);
    const dialogueView = dialogue.project(); panels.dialogue.render(dialogueView.view, dialogueView.capture);
    const packetView = packet.project(); panels.packet.render(packetView.view, packetView.capture);
    if (packetView.view.open && game?.world.roomId === q('R12')) activityPanel = null;
    const objectiveId = routeObjective(game?.world.roomId);
    panels.diagnostics.render(activityPanel === 'diagnostics' && objectiveId ? diagnostics.project(objectiveId) : null);
    panels.repair.render(activityPanel === 'repair' ? repair.project() : null);
    narrativeState = state;
    narrativeProjection = narrative && recovery ? { ...narrative, content: endings, ...recovery.availability(state), capture: intent => {
      const before = state;
      if (intent === 'continue' && narrative.view.kind === 'ending' && narrative.view.outcome !== 'E03') {
        const context = captureOutcomeContext(before);
        return () => {
          if (disposed || state !== before || accountSettings?.busy || !context) { render(); return; }
          const prepared = outcomes.prepareDismissal(before, context);
          if (!prepared.ok || !outcomes.commit(store, prepared.change).ok) { render(); return; }
          activityPanel = null; render();
          // Only the actual successful Continue dismisses completion feedback.
          autosave?.objectiveFeedbackDismissed();
        };
      }
      const command = recovery!.capture(intent);
      return () => { if (!disposed && state === before && !accountSettings?.busy && command) recovery!.request(command); else render(); };
    } } : null;
    panels.epilogue.render(narrativeProjection);
    panels.recovery.render(recovery?.project() ?? null);
    // Focus the invitation only after the panel that just closed restores focus.
    menu.render(title.project());
    // Coordinator events and ordinary reducer edits both update save status.
    saveDialogs.render(saves.project());
    if (accountSettings && settingsPanel) {
      const settings = accountSettings.project(); settingsPanel.render(settings); autosavePanel?.render(settings.open, settings.busy);
      // Busy account operations cannot race another title/save choice. Gameplay
      // memory remains intact until the confirmed lifecycle CAS above.
      for (const control of menu.element.querySelectorAll('button')) control.disabled = settings.busy && control.textContent !== 'Settings';
      saveHost.inert = settings.busy;
    }
    frame.sync(!!game, renderFocus);
    if (focusRoom) { panels.shell.element.querySelector('h1')?.focus(); focusRoom = false; }
    autosave?.observe();
  }
  // Every controller subscriber was registered before this final render observer.
  const unsubscribe = bus.subscribe((action, result) => {
    render();
    if (result.status !== 'handled' || state.runtime.game?.world.roomId !== q('R01')) return;
    const input = action.input;
    if (input.kind === 'interact' || input.kind === 'choose-hotspot-action') {
      panels.react(input.verb === 'walk' ? 'walk' : 'reaction');
      if (input.verb === 'look' && input.targetId === 'spec001:HOTSPOT-power') panels.sound.trigger('control');
      if (input.verb === 'talk' && input.targetId === 'spec001:HOTSPOT-photon') panels.sound.trigger('photon');
    }
    if (input.kind === 'skip-dialogue' || input.kind === 'close-dialogue') panels.sound.stopVoice();
    if (input.kind === 'replay-dialogue' && input.dialogueId === q('DIALOGUE-photon-intro')) panels.sound.trigger('photon');
  }), unsubscribeAutosave = autosave?.subscribe(() => render()); render(); void saves.bootstrap();
  return { dispose() {
    if (disposed) return; disposed = true; unsubscribe(); unsubscribeHazard(); diagnostics.dispose(); repair.dispose(); packet.dispose(); dialogue.dispose(); notebook.dispose(); compendium.dispose(); inventory.dispose(); verbs.dispose();
    unsubscribeAutosave?.(); recovery?.dispose(); accountSettings?.dispose(); autosavePanel?.dispose(); settingsPanel?.dispose(); autosave?.dispose(); saves.dispose(); saveDialogs.dispose(); menu.dispose(); disposePanels(); frame.dispose(); bus.dispose();
  } };
}
