// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { bindDisclosedImage } from '../presentation/recovery';
import './compendium.css';
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { RoomId, FactId, MeasurementId } from '../domain/types';
import type { Navigation } from '../state/navigation';
import type { GameState, Hypothesis, SafeState } from '../state/types';
import type { ActionCapture, ActionDispatcher, SemanticAction } from './action-bus';
import type { NotebookEvidenceView } from './notebook';

/** Trusted production bindings only, added after source/export/review acceptance.
 * Planned manifest allocations are deliberately not a runtime URL resolver. */
export interface CompendiumPortraitBinding {
  readonly characterId: string; readonly compendiumId: string; readonly assetId: string; readonly exportPath: string;
  readonly caption?: string;
}
export type CompendiumPortrait = { readonly status: 'unavailable'; readonly assetId: string | null; readonly text: string }
  | { readonly status: 'available'; readonly assetId: string; readonly text: string; readonly src: string };
export function resolveCompendiumPortrait(character: Readonly<S.character>, bindings: readonly CompendiumPortraitBinding[] = [], gameBase = '/'): CompendiumPortrait {
  const assetId = character.compendium.portraitAssetId ?? null, text = character.compendium.portraitText ?? character.description;
  const unavailable: CompendiumPortrait = { status: 'unavailable', assetId, text };
  const matches = bindings.filter(binding => binding.characterId === character.id && binding.compendiumId === character.compendium.id && binding.assetId === assetId);
  if (!assetId || !character.assetIds.includes(assetId) || matches.length !== 1 || !/^\/(?:[A-Za-z0-9_-]+\/)*$/.test(gameBase)) return unavailable;
  const binding = matches[0]!;
  const path = binding.exportPath;
  if (!/^public\/assets\/[A-Za-z0-9_./-]+\.(?:png|webp|avif|jpg|jpeg)$/.test(path) || path.split('/').some(segment => segment === '..' || segment === '.' || segment === '')) return unavailable;
  return { status: 'available', assetId, text: binding.caption?.trim() || text, src: `${gameBase}${path.slice('public/'.length)}` };
}

export interface EvidenceRouteStep { readonly fromRoomId: RoomId; readonly fromRoom: string; readonly toRoomId: RoomId; readonly toRoom: string; readonly exitLabel: string }
export interface EvidenceRoute { readonly status: 'here' | 'walk' | 'unvisited' | 'unavailable'; readonly explanation: string; readonly steps: readonly EvidenceRouteStep[] }
interface RouteOptions {
  readonly registry: ContentRegistry; readonly metadata: Pick<S.world, 'rooms'>; readonly navigation: Navigation;
  readonly game: GameState; readonly activity: string; readonly sourceRoomId: RoomId;
}
const safe = (activity: string): activity is SafeState => ['stable-exploration', 'safe-preparation', 'safe-continue'].includes(activity);
/** A bounded preview of real directed exit resolutions, never movement or recovery. */
export function describeEvidenceRoute({ registry, metadata, navigation, game, activity, sourceRoomId }: RouteOptions): EvidenceRoute {
  const unavailable = (): EvidenceRoute => ({ status: 'unavailable', explanation: 'No currently accessible walk through your visited map leads to this source. Return to safe preparation and inspect the available exits.', steps: [] });
  const known = new Set(game.notebook.mapRoomIds), names = new Map(metadata.rooms.map(room => [room.id, room.name]));
  if (!known.has(sourceRoomId) || !names.has(sourceRoomId)) return { status: 'unvisited', explanation: 'This source has no visited map location to highlight yet.', steps: [] };
  if (sourceRoomId === game.world.roomId) return { status: 'here', explanation: 'You are in the source room. Use its actual inspection or measurement controls to check the condition again.', steps: [] };
  if (!safe(activity) || metadata.rooms.length > 128) return unavailable();
  const queue = [{ world: game.world, activity, steps: [] as EvidenceRouteStep[] }], visited = new Set([`${game.world.roomId}:${game.world.position.safePositionId}`]);
  for (let cursor = 0; cursor < queue.length && cursor < 128; cursor++) {
    const node = queue[cursor]!, room = registry.record(node.world.roomId);
    if (room?.kind !== 'room') continue;
    for (const exit of room.exits) {
      if (!known.has(exit.toRoomId as RoomId)) continue;
      const resolved = navigation.resolve(node.world, exit.toRoomId as RoomId, node.activity);
      if (!resolved.ok || resolved.kind !== 'arrival') continue;
      const { destination } = resolved, key = `${destination.roomId}:${destination.safePositionId}`;
      if (visited.has(key)) continue;
      const steps = [...node.steps, { fromRoomId: node.world.roomId, fromRoom: names.get(node.world.roomId) ?? node.world.roomId,
        toRoomId: destination.roomId, toRoom: names.get(destination.roomId) ?? destination.roomId, exitLabel: exit.label }];
      if (destination.roomId === sourceRoomId) return { status: 'walk', explanation: 'Follow these exits with Walk. Directions do not move you or refresh a reading; measure again at the source when needed.', steps };
      visited.add(key);
      if (visited.size > 128) return unavailable();
      queue.push({ world: { ...node.world, roomId: destination.roomId, position: { safePositionId: destination.safePositionId } }, activity: destination.activity, steps });
    }
  }
  return unavailable();
}

export interface CompendiumEntryView {
  readonly id: string; readonly characterId: string; readonly name: string; readonly role: string; readonly description: string;
  readonly technology: string; readonly abilitySummary: string; readonly limitations: readonly string[]; readonly realmNote: string;
  readonly recruitment: string; readonly progression: string; readonly status: string; readonly portrait: CompendiumPortrait;
  readonly sources: readonly (Readonly<S.sourceClaim> & { readonly title?: string; readonly url?: string })[]; readonly contextSources: NonNullable<S.character['compendium']['contextSources']>;
  readonly abilities: readonly { readonly id: string; readonly name: string; readonly description: string; readonly limitations: readonly string[]; readonly unlocked: boolean }[];
}
export interface CompendiumView {
  readonly entries: readonly CompendiumEntryView[]; readonly undiscoveredCount: number;
  readonly evidence: readonly { readonly evidence: NotebookEvidenceView; readonly route: EvidenceRoute }[];
  readonly personalNotes: string; readonly hypotheses: readonly Hypothesis[];
}
export interface CompendiumProjectionOptions {
  readonly registry: ContentRegistry; readonly metadata: Pick<S.world, 'characters' | 'rooms'>;
  readonly game: GameState | null; readonly evidence: readonly NotebookEvidenceView[]; readonly navigation: Navigation; readonly activity: string;
  readonly portraits?: readonly CompendiumPortraitBinding[]; readonly gameBase?: string;
  readonly sourceCatalog?: readonly { readonly id: string; readonly title: string; readonly url: string }[];
}
/** Reads canonical discovery/recruit state only; it never evaluates or awards either. */
export function projectCompendium(options: CompendiumProjectionOptions): CompendiumView {
  const { registry, metadata, game } = options, discovered = new Set<string>(game?.world.compendiumIds ?? []);
  const entries: CompendiumEntryView[] = [];
  for (const allocation of metadata.characters) {
    const character = registry.record(allocation.id);
    if (character?.kind !== 'character' || !discovered.has(character.compendium.id)) continue;
    const entry = character.compendium, recruit = game?.world.recruits.find(recruit => recruit.characterId === character.id);
    entries.push({ id: entry.id, characterId: character.id, name: allocation.name, role: allocation.role, description: character.description,
      technology: entry.technology, abilitySummary: entry.abilitySummary, limitations: entry.limitations, realmNote: entry.realmNote,
      recruitment: entry.recruitmentSummary ?? 'Recruitment details are not available for this entry.', progression: entry.progressionSummary ?? 'Progression details are not available for this entry.',
      status: !character.recruitable ? 'Discovered · not recruitable' : !recruit ? 'Discovered; not recruited'
        : `Recruited · level ${recruit.level} · ${game?.world.activeAllyIds.some(id => id === character.id) ? 'active ally' : 'not active'}`,
      portrait: resolveCompendiumPortrait(character, options.portraits, options.gameBase), sources: entry.sourceClaims.map(claim => {
        const source = options.sourceCatalog?.find(source => `spec001:${source.id}` === claim.sourceId);
        return source ? { ...claim, title: source.title, ...(/^https:\/\//.test(source.url) ? { url: source.url } : {}) } : claim;
      }), contextSources: entry.contextSources ?? [],
      abilities: character.abilities.map(ability => ({ id: ability.id, name: ability.name, description: ability.description, limitations: ability.limitations,
        unlocked: recruit?.abilityIds.some(id => id === ability.id) ?? false })) });
  }
  return structuredClone({ entries, undiscoveredCount: metadata.characters.length - entries.length,
    evidence: game ? options.evidence.map(evidence => ({ evidence, route: describeEvidenceRoute({ ...options, game, sourceRoomId: evidence.sourceRoomId }) })) : [],
    personalNotes: game?.notebook.personalNotes ?? '', hypotheses: game?.notebook.hypotheses ?? [] });
}

/** Passive, plain-text-first view. All progress belongs to the trusted controllers. */
export function createCompendiumPanel(host: HTMLElement, bus: Pick<ActionDispatcher, 'dispatch'>) {
  const doc = host.ownerDocument, abort = new AbortController(), element = doc.createElement('section');
  element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Compendium'); element.className = 'nq-compendium'; element.hidden = true;
  element.style.overflowWrap = 'anywhere'; element.style.minWidth = '0';
  const heading = doc.createElement('h2'); heading.textContent = 'Compendium'; heading.tabIndex = -1;
  const count = doc.createElement('p'), entries = doc.createElement('div'), evidenceTitle = doc.createElement('h3'), evidenceList = doc.createElement('ul');
  evidenceTitle.textContent = 'Evidence across rooms'; evidenceList.setAttribute('aria-label', 'Evidence across rooms');
  const notes = doc.createElement('details'), notesTitle = doc.createElement('summary'), notesBody = doc.createElement('div');
  notesTitle.textContent = 'Your notes and hypotheses'; notesTitle.tabIndex = 0; notes.append(notesTitle, notesBody);
  const close = doc.createElement('button'); close.type = 'button'; close.textContent = 'Close compendium'; close.setAttribute('aria-keyshortcuts', 'Escape');
  element.append(heading, count, entries, evidenceTitle, evidenceList, notes, close); host.append(element);
  const paragraph = (text: string) => { const node = doc.createElement('p'); node.textContent = text; node.style.whiteSpace = 'pre-wrap'; return node; };
  const list = (label: string, texts: readonly string[]) => { const node = doc.createElement('ul'); node.setAttribute('aria-label', label); for (const text of texts) { const item = doc.createElement('li'); item.textContent = text; node.append(item); } return node; };
  const rows = new Map<string, { node: HTMLElement; signature: string; dispose?: (() => void) | void }>();
  const actions = new WeakMap<HTMLButtonElement, { input: SemanticAction; capture: ActionCapture }>();
  let activeControls = new Set<HTMLButtonElement>();
  let current: { capture: ActionCapture; open: boolean } | null = null, returnFocus: HTMLElement | null = null, disposed = false;
  const button = (text: string, input: SemanticAction, capture: ActionCapture) => { const button = doc.createElement('button'); button.type = 'button'; button.textContent = text; actions.set(button, { input, capture }); return button; };
  const reconcile = (parent: HTMLElement, children: HTMLElement[]) => { children.forEach((child, i) => { if (parent.children[i] !== child) parent.insertBefore(child, parent.children[i] ?? null); }); while (parent.children.length > children.length) parent.lastElementChild!.remove(); };
  const row = (id: string, signature: unknown, tag: 'details' | 'li', build: (node: HTMLElement) => void | (() => void)) => {
    const text = JSON.stringify(signature); let entry = rows.get(id);
    if (!entry) { entry = { node: doc.createElement(tag), signature: '' }; rows.set(id, entry); }
    if (entry.signature !== text) { entry.dispose?.(); entry.node.replaceChildren(); entry.dispose = build(entry.node); entry.signature = text; }
    return entry.node;
  };
  const active = () => current?.open && !disposed && element.isConnected && host.contains(element) && !element.closest('[hidden], [inert]');
  element.addEventListener('click', event => {
    if (!active()) return;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (target === close) bus.dispatch(current!.capture({ kind: 'close-panel' }));
    else if (target instanceof HTMLButtonElement && activeControls.has(target)) { const action = actions.get(target); if (action?.capture === current!.capture) bus.dispatch(action.capture(action.input)); }
  }, { signal: abort.signal });
  element.addEventListener('keydown', event => {
    if (!active() || event.key !== 'Escape' || event.defaultPrevented || event.repeat || event.isComposing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    event.preventDefault(); event.stopPropagation(); bus.dispatch(current!.capture({ kind: 'close-panel' }));
  }, { signal: abort.signal });
  return { element, render(view: CompendiumView, open: boolean, capture: ActionCapture) {
    if (disposed) throw new Error('Compendium panel is disposed.');
    const model = structuredClone(view), wasOpen = !element.hidden, focus = doc.activeElement, scroll = element.scrollTop;
    const focusedIntent = focus instanceof HTMLButtonElement ? actions.get(focus)?.input : undefined;
    if (current?.capture !== capture) for (const [id, entry] of rows) if (id.startsWith('evidence:')) entry.signature = '';
    current = { capture, open };
    count.textContent = `${model.entries.length} discovered · ${model.undiscoveredCount} undiscovered. Meet the Underworld’s inhabitants to fill these pages.`;
    reconcile(entries, model.entries.map(entry => row(`character:${entry.id}`, entry, 'details', node => {
      const summary = doc.createElement('summary'); summary.tabIndex = 0; summary.textContent = `${entry.name} · ${entry.status}`; node.append(summary);
      const figure = doc.createElement('figure'), caption = doc.createElement('figcaption'); caption.textContent = entry.portrait.text;
      figure.style.margin = '0';
      let releasePortrait: (() => void) | undefined;
      if (entry.portrait.status === 'available') {
        const image = doc.createElement('img'); image.alt = entry.portrait.text; image.style.maxWidth = '100%'; image.style.height = 'auto';
        releasePortrait = bindDisclosedImage(node as HTMLDetailsElement, figure, image, entry.portrait.src, 'Portrait unavailable.');
      } else caption.textContent = `Portrait not yet available. ${entry.portrait.text}`;
      figure.append(caption); node.append(figure, paragraph(entry.role), paragraph(entry.description), paragraph(`Technology: ${entry.technology}`), paragraph(`Ability: ${entry.abilitySummary}`), list('Limitations', entry.limitations),
        paragraph(`Realm and dependencies: ${entry.realmNote}`), paragraph(`Recruitment: ${entry.recruitment}`), paragraph(`Progression: ${entry.progression}`), paragraph('RPG attributes are fictional balancing values.'));
      for (const ability of entry.abilities) node.append(paragraph(`${ability.name} · ${ability.unlocked ? 'Unlocked' : 'Not unlocked'}. ${ability.description}`), list(`${ability.name} limitations`, ability.limitations));
      const sourceLink = (title: string, url: string) => { const link = doc.createElement('a'); link.textContent = title; link.href = url; link.target = '_blank'; link.rel = 'noopener noreferrer'; return link; };
      const sources = doc.createElement('details'), sourceTitle = doc.createElement('summary'); sourceTitle.tabIndex = 0; sourceTitle.textContent = 'Technical sources and scope'; sources.append(sourceTitle);
      for (const source of entry.sources) {
        sources.append(paragraph(`${source.title ?? source.sourceId} · ${source.section}`), paragraph(source.supportedClaim), list('Source limitations', source.limitations));
        if (source.url && /^https:\/\//.test(source.url)) sources.append(sourceLink(source.title ?? source.sourceId, source.url));
      }
      for (const source of entry.contextSources) {
        sources.append(paragraph(`Descriptive context only: ${source.title} · ${source.section}`), paragraph(source.supportedClaim), list('Context limitations', source.limitations));
        if (/^https:\/\//.test(source.url)) sources.append(sourceLink(source.title, source.url));
      }
      node.append(sources);
      return releasePortrait;
    })));
    reconcile(evidenceList, model.evidence.map(({ evidence, route }) => row(`evidence:${evidence.id}`, [evidence, route], 'li', node => {
      const title = doc.createElement('h4'); title.textContent = evidence.heading;
      node.append(title, paragraph(`${evidence.kind} · Source: ${evidence.sourceRoom} · Freshness: ${evidence.freshness}`), paragraph(evidence.text));
      if (evidence.list) node.append(list(evidence.list.label, evidence.list.items));
      node.append(paragraph(route.explanation));
      if (route.steps.length) { const steps = doc.createElement('ol'); steps.setAttribute('aria-label', `Walk to ${evidence.sourceRoom}`); for (const step of route.steps) { const item = doc.createElement('li'); item.textContent = `In ${step.fromRoom}, Walk: ${step.exitLabel} → ${step.toRoom}.`; steps.append(item); } node.append(steps); }
      if (route.status !== 'unvisited') node.append(button(`Open notebook source: ${evidence.heading}`, { kind: 'inspect-evidence', evidenceId: evidence.id as FactId | MeasurementId }, capture));
    })));
    activeControls = new Set(evidenceList.querySelectorAll('button'));
    const noteContent = [paragraph('Personal notes and hypotheses are your writing, not established observations or measurements.'), paragraph(model.personalNotes || 'No personal notes yet.'),
      ...model.hypotheses.map(hypothesis => paragraph(`Player hypothesis · ${hypothesis.status}: ${hypothesis.text}`))];
    // No editable controls here: the notebook owns bounded writing and its lifecycle.
    if (notesBody.textContent !== noteContent.map(node => node.textContent).join('')) notesBody.replaceChildren(...noteContent);
    element.hidden = !open;
    if (open && !wasOpen) { returnFocus = focus instanceof HTMLElement ? focus : null; heading.focus(); }
    else if (!open && wasOpen && focus instanceof Node && element.contains(focus) && returnFocus?.isConnected) returnFocus.focus();
    else if (open && focus instanceof HTMLElement && !focus.isConnected) {
      const replacement = focusedIntent && [...activeControls].find(button => JSON.stringify(actions.get(button)?.input) === JSON.stringify(focusedIntent));
      (replacement ?? heading).focus({ preventScroll: !!replacement });
      if (replacement) element.scrollTop = scroll;
    }
  }, dispose() { if (disposed) return; disposed = true; abort.abort(); for (const entry of rows.values()) entry.dispose?.(); rows.clear(); current = null; element.remove(); } };
}

import { contextFromRuntime } from './action-bus';
import type { ActionBus } from './action-bus';
import type { GameplayStore, ActiveActionAdmission } from './controller-store';
import { actionAvailable, uiPlan, unavailable } from './controller-store';
import type { PanelPlanner } from './verbs';

export interface CompendiumControllerOptions extends Omit<CompendiumProjectionOptions, 'game' | 'evidence' | 'activity'> {
  readonly bus: ActionBus; readonly store: GameplayStore; readonly allowDuringEncounter?: ActiveActionAdmission;
  /** Existing authoritative notebook projection, never renderer-supplied rows. */
  readonly notebook: { project(): { readonly view: { readonly evidence: readonly NotebookEvidenceView[] } } };
}
export function createCompendiumController(options: CompendiumControllerOptions) {
  const { bus, store } = options;
  const metadata = structuredClone(options.metadata), sourceCatalog = structuredClone(options.sourceCatalog ?? []);
  const portraits = structuredClone(options.portraits ?? metadata.characters.flatMap(({ id }) => {
    const character = options.registry.record(id);
    if (character?.kind !== 'character' || !character.compendium.portraitBinding) return [];
    const { assetId, exportPath, caption, contentId } = character.compendium.portraitBinding;
    return [{ characterId: contentId, compendiumId: character.compendium.id, assetId, exportPath, caption }];
  }));
  let disposed = false, projection: { readonly game: GameState | null; readonly capture: ActionCapture } | null = null;
  const panels: PanelPlanner = (panel, action, before) => {
    if (disposed || panel !== 'compendium') return unavailable('panel-unavailable', 'This panel is not available here.');
    if (!actionAvailable(before, action.input, options.allowDuringEncounter)) return unavailable('unavailable-state', 'Use the compendium after the current activity finishes.');
    return uiPlan(store, before, { panel: 'compendium' }, 'Compendium opened.');
  };
  return { panels, project() {
    if (disposed) throw new Error('Compendium controller is disposed.');
    const state = store.getState(), game = state.runtime.game;
    if (!projection || projection.game !== game) projection = { game, capture: bus.captureScope(contextFromRuntime(state.runtime)) };
    return { capture: projection.capture, open: !!game && state.runtime.ui?.panel === 'compendium', view: projectCompendium({ ...options, metadata, portraits, sourceCatalog,
      game, evidence: options.notebook.project().view.evidence, activity: state.runtime.activity?.kind ?? 'unavailable' }) };
  }, invalidate() { projection = null; }, dispose() { disposed = true; projection = null; } };
}
