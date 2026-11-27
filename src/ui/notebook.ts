// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type { FactId, HypothesisId, MeasurementId, ObjectiveId, QualifiedId, RoomId } from '../domain/types';
import { conditionSatisfied } from '../state/conditions';
import { isMeasurementCurrent } from '../state/reducer';
import { validNotebookText } from '../state/notebook';
import type { ReducerState } from '../state/reducer';
import type { GameState, Hypothesis } from '../state/types';
import { contextFromRuntime } from './action-bus';
import type { ActionBus, ActionCapture, ActionContext, ActionDispatcher, ActionPlan, CapturedAction, SemanticAction } from './action-bus';
import type { GameplayStore } from './controller-store';
import { guardedPlan, playable, rejected, reductionPlan, uiPlan, unavailable } from './controller-store';
import type { HotspotBinding, PanelPlanner } from './verbs';
import introductionPresentation from '../../content/spec001/notebook-introduction.json' with { type: 'json' };

const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
interface NotebookPresentation {
  readonly rooms: readonly { readonly id: RoomId; readonly label: string }[];
  readonly objectives: readonly { readonly id: ObjectiveId; readonly label: string; readonly roomId: RoomId }[];
  readonly facts: readonly { readonly id: FactId; readonly heading: string; readonly sourceId: QualifiedId; readonly kind: string;
    readonly list?: { readonly label: string; readonly ordered: boolean; readonly requiresFactIds: readonly FactId[]; readonly items: readonly string[] } }[];
  readonly measurement: { readonly factId: FactId; readonly sourceId: QualifiedId; readonly heading: string; readonly ruleId: string; readonly profileId: string };
  readonly measurementGroups?: readonly { readonly subjectId: ObjectiveId; readonly ruleId: string; readonly heading: string; readonly scope: string;
    readonly conclusions: readonly { readonly code: string; readonly explanation: string }[] }[];
}
/** Separate bounded display metadata; no effects, rules or parsed prose. */
export function validateNotebookPresentation(registry: ContentRegistry, input: unknown): NotebookPresentation {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
  const label = (value: unknown): value is string => validNotebookText(value, 160, true);
  const exact = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).every(key => keys.includes(key));
  const collection = (value: unknown, maximum: number, check: (entry: unknown) => boolean): value is Record<string, unknown>[] => Array.isArray(value) && value.length > 0 && value.length <= maximum && Array.from(value).every(check);
  const bad = () => { throw new TypeError('Notebook display metadata must reference actual authored rooms, objectives and evidence.'); };
  if (!object(input) || !exact(input, ['schemaVersion', 'episodeId', 'contentVersion', 'rooms', 'objectives', 'facts', 'measurement', 'measurementGroups'])
    || input['schemaVersion'] !== 1 || input['episodeId'] !== 'spec001' || input['contentVersion'] !== registry.record(q('R01'))?.contentVersion) return bad();
  const roomRows = input['rooms'];
  if (!collection(roomRows, 128, value => object(value) && exact(value, ['id', 'label']) && typeof value['id'] === 'string'
    && registry.record(value['id'])?.kind === 'room' && label(value['label']))) return bad();
  const knownRoom = (id: unknown) => roomRows.some(room => room['id'] === id);
  const objectiveRows = input['objectives'];
  if (!collection(objectiveRows, 64, value => object(value) && exact(value, ['id', 'label', 'roomId']) && typeof value['id'] === 'string'
    && registry.record(value['id'])?.kind === 'objective' && label(value['label']) && knownRoom(value['roomId']))) return bad();
  const factAtSource = (sourceId: unknown, factId: unknown): Readonly<S.evidence> | undefined => {
    const source = typeof sourceId === 'string' ? registry.record(sourceId) : undefined;
    return source && 'evidence' in source ? source.evidence.find(e => e.id === factId) : undefined;
  };
  const factRows = input['facts'];
  if (!collection(factRows, 1024, value => {
    if (!object(value) || !exact(value, ['id', 'heading', 'sourceId', 'kind', 'list']) || !label(value['heading'])
      || !['Observation', 'Character guidance', 'Scenario context'].includes(value['kind'] as string)) return false;
    const fact = factAtSource(value['sourceId'], value['id']);
    if (!fact || fact.kind === 'measurement' || !knownRoom(fact.roomId) || (fact.kind === 'observation') !== (value['kind'] === 'Observation')) return false;
    const list = value['list'];
    return list === undefined || (object(list) && exact(list, ['label', 'ordered', 'requiresFactIds', 'items']) && label(list['label']) && typeof list['ordered'] === 'boolean'
      && collection(list['requiresFactIds'], 16, id => typeof id === 'string' && registry.has('fact', id))
      && collection(list['items'], 16, label));
  })) return bad();
  const measurement = input['measurement'];
  if (!object(measurement) || !exact(measurement, ['factId', 'sourceId', 'heading', 'ruleId', 'profileId']) || !label(measurement['heading'])) return bad();
  const fact = factAtSource(measurement['sourceId'], measurement['factId']);
  if (fact?.kind !== 'measurement' || !knownRoom(fact.roomId) || !fact.ruleIds.includes(measurement['ruleId'] as string)
    || !registry.has('profile', measurement['profileId'] as string) || !fact.subjectIds.includes(measurement['profileId'] as string)) return bad();
  const groups = input['measurementGroups'];
  if (groups !== undefined) {
    if (!collection(groups, 64, value => {
      if (!object(value) || !exact(value, ['subjectId', 'ruleId', 'heading', 'scope', 'conclusions']) || !label(value['heading'])
        || !validNotebookText(value['scope'], 512, true) || typeof value['subjectId'] !== 'string' || typeof value['ruleId'] !== 'string'
        || !registry.has('rule', value['ruleId']) || !objectiveRows.some(o => o['id'] === value['subjectId'])) return false;
      const source = registry.record(value['subjectId']);
      if (source?.kind !== 'objective' || !source.evidence.some(e => e.ruleIds.includes(value['ruleId'] as string))) return false;
      const conclusions = value['conclusions'];
      return collection(conclusions, 64, entry => object(entry) && exact(entry, ['code', 'explanation']) && label(entry['code'])
        && validNotebookText(entry['explanation'], 512, true)) && new Set(conclusions.map(c => c['code'])).size === conclusions.length;
    }) || new Set(groups.map(g => `${String(g['subjectId'])}:${String(g['ruleId'])}`)).size !== groups.length) return bad();
  }
  for (const rows of [roomRows, objectiveRows, factRows]) if (new Set(rows.map(row => row['id'])).size !== rows.length) return bad();
  return structuredClone(input) as unknown as NotebookPresentation;
}
export interface NotebookEvidenceView {
  readonly id: string; readonly heading: string; readonly sourceRoomId: RoomId; readonly sourceRoom: string;
  readonly kind: string; readonly text: string; readonly freshness: 'observation' | 'current' | 'stale';
  readonly list?: { readonly label: string; readonly ordered: boolean; readonly items: readonly string[] };
}
export interface NotebookView {
  readonly context: ActionContext | null; readonly open: boolean; readonly personalNotes: string;
  /** Transient editor lifetime, replaced on restore/new adventure/logout. */
  readonly draftScopeId: string;
  readonly objectives: readonly { readonly id: ObjectiveId; readonly label: string; readonly completed: boolean; readonly pinned: boolean; readonly roomId: RoomId }[];
  readonly evidence: readonly NotebookEvidenceView[]; readonly hypotheses: readonly Hypothesis[];
  readonly maps: readonly { readonly id: RoomId; readonly label: string }[];
  readonly highlightedRoomId: RoomId | null; readonly canPinHypothesis: boolean;
  readonly roomLabels: readonly { readonly id: RoomId; readonly label: string }[];
}
export interface NotebookOptions { readonly bus: ActionBus; readonly registry: ContentRegistry; readonly store: GameplayStore; readonly presentation?: unknown }

/** Trusted orchestration; this controller never accepts game state from a renderer. */
export function createNotebookController({ bus, registry, store, presentation: suppliedPresentation = introductionPresentation }: NotebookOptions) {
  const presentation = validateNotebookPresentation(registry, suppliedPresentation);
  const { rooms, objectives } = presentation;
  const measurementSource = registry.record(presentation.measurement.sourceId);
  const introductoryMeasurementRoom = measurementSource && 'evidence' in measurementSource
    ? measurementSource.evidence.find(e => e.id === presentation.measurement.factId)?.roomId : undefined;
  const roomName = (id: string) => rooms.find(room => room.id === id)?.label ?? id;
  const facts = new Map<FactId, Readonly<S.evidence>>();
  for (const mapping of presentation.facts) {
    const record = registry.record(mapping.sourceId);
    if (record && 'evidence' in record) facts.set(mapping.id, record.evidence.find(fact => fact.id === mapping.id)!);
  }
  const pins = new Set<ObjectiveId>(); let highlightedRoomId: RoomId | null = null, draftScopeId = crypto.randomUUID();
  let projection: { game: GameState | null; capture: ActionCapture } | null = null;
  const registrations: (() => void)[] = [];
  let disposed = false;
  const panelReady = (state: ReducerState) => playable(state) && state.runtime.ui?.panel === 'notebook';
  const panels: PanelPlanner = (panel, _action, before) => disposed || !playable(before) ? unavailable('unavailable-state', 'Use the notebook after the current activity finishes.') : panel === 'notebook'
    ? uiPlan(store, before, { panel: 'notebook' }, 'Notebook opened.') : unavailable('panel-unavailable', 'This panel is not available here.');
  const hotspotBindings: readonly HotspotBinding[] = [null, q<'item'>('ITEM-inspection-kit')].map(itemId => ({
    roomId: q<'room'>('R01'), hotspotId: q('HOTSPOT-path'), verb: 'use' as const, itemId,
    actionId: q('ACTION-inspect-path'), sourceId: q('DIALOGUE-arrival-actions'), mode: 'port' as const,
    plan: (interaction, action, before) => {
      const room = registry.record(q('R01')), source = registry.record(q('DIALOGUE-arrival-actions'));
      const hotspot = room?.kind === 'room' ? room.hotspots.find(h => h.id === q('HOTSPOT-path')) : undefined;
      const node = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
      const choice = node?.choices.find(c => c.id === q('ACTION-inspect-path'));
      const input = action.input;
      if (disposed || !playable(before) || before.runtime.game!.world.roomId !== q('R01') || !hotspot || !node || !choice
        || interaction.room !== room || interaction.hotspot !== hotspot || interaction.choice !== choice || interaction.verb !== 'use' || interaction.itemId !== itemId
        || !['interact', 'choose-hotspot-action'].includes(input.kind) || !('targetId' in input) || input.targetId !== hotspot.id
        || input.verb !== 'use' || input.itemId !== itemId || ('choiceId' in input && input.choiceId !== choice.id)
        || !conditionSatisfied(node.condition, before.runtime.game!.world) || !conditionSatisfied(choice.condition, before.runtime.game!.world)) return rejected('notebook-binding', 'That inspection is not offered here.');
      return reductionPlan(store, action, before, { kind: 'notebook', operation: { kind: 'inspect-path', id: crypto.randomUUID() as MeasurementId } }, 'Valid inspection recorded.');
    },
  }));
  // The hypothesis board opens the real editor. Only a separate nonempty text
  // submission can commit its authored flag and stored hypothesis together.
  const source = registry.record(q('DIALOGUE-workshop-actions')), room = registry.record(q('R02'));
  const board = room?.kind === 'room' ? room.hotspots.find(h => h.id === q('HOTSPOT-hypothesis')) : undefined;
  const entry = source?.kind === 'dialogue' ? source.nodes.find(n => n.id === source.entryNodeId) : undefined;
  const pinChoice = entry?.choices.find(c => c.id === q('ACTION-pin-hypothesis'));
  const boardBinding: HotspotBinding = { roomId: q<'room'>('R02'), hotspotId: q('HOTSPOT-hypothesis'), verb: 'use', itemId: null,
    actionId: q('ACTION-pin-hypothesis'), sourceId: q('DIALOGUE-workshop-actions'), mode: 'port', plan: (interaction, action, before) => {
      const input = action.input;
      if (disposed || !playable(before) || before.runtime.game!.world.roomId !== q('R02') || !board || !pinChoice || !entry
        || interaction.room !== room || interaction.hotspot !== board || interaction.choice !== pinChoice || interaction.verb !== 'use' || interaction.itemId !== null
        || !['interact', 'choose-hotspot-action'].includes(input.kind) || !('targetId' in input) || input.targetId !== board.id
        || input.verb !== 'use' || input.itemId !== null || ('choiceId' in input && input.choiceId !== pinChoice.id)
        || !conditionSatisfied(entry.condition, before.runtime.game!.world) || !conditionSatisfied(pinChoice.condition, before.runtime.game!.world)) return rejected('notebook-binding', 'The hypothesis board is not available here.');
      return panels('notebook', action, before);
    } };
  const handler = (action: CapturedAction): ActionPlan => {
    const before = store.getState(), input = action.input;
    if (!playable(before)) return unavailable('unavailable-state', 'Use the notebook after the current activity finishes.');
    if (!panelReady(before)) return rejected('notebook-closed', 'Open the notebook first.');
    if (input.kind === 'edit-personal-notes') return reductionPlan(store, action, before, { kind: 'notebook', operation: { kind: 'notes', text: input.text } }, 'Notes updated in this adventure.');
    if (input.kind === 'pin-hypothesis') return reductionPlan(store, action, before, { kind: 'notebook', operation: { kind: 'pin-hypothesis', id: crypto.randomUUID() as HypothesisId, text: input.text } }, 'Hypothesis pinned as player speculation.');
    if (input.kind === 'pin-objective') {
      if (!objectives.some(o => o.id === input.objectiveId) || registry.record(input.objectiveId)?.kind !== 'objective') return rejected('unknown-objective', 'That objective is not in this notebook.');
      return guardedPlan(store, before, { status: 'ready', commit: () => {
        if (pins.has(input.objectiveId)) pins.delete(input.objectiveId); else pins.add(input.objectiveId);
        return { status: 'handled', message: pins.has(input.objectiveId) ? 'Objective pinned across rooms.' : 'Objective unpinned.' };
      } });
    }
    if (input.kind === 'highlight-map-room') {
      if (!before.runtime.game!.notebook.mapRoomIds.includes(input.roomId) || !rooms.some(room => room.id === input.roomId)) return rejected('unvisited-room', 'Only visited locations can be highlighted.');
      return guardedPlan(store, before, { status: 'ready', commit: () => { highlightedRoomId = input.roomId; return { status: 'handled', message: `Map highlighted: ${roomName(input.roomId)}.` }; } });
    }
    return rejected('invalid-input', 'Choose a notebook action.');
  };
  try { for (const kind of ['edit-personal-notes', 'pin-hypothesis', 'pin-objective', 'highlight-map-room'] as const) registrations.push(bus.register(kind, handler)); }
  catch (error) { registrations.forEach(off => off()); throw error; }
  return {
    panels, hotspotBindings: [...hotspotBindings, boardBinding],
    project(): { readonly view: NotebookView; readonly capture: ActionCapture } {
      const state = store.getState(), game = state.runtime.game, context = contextFromRuntime(state.runtime);
      if (!projection || projection.game !== game) projection = { game, capture: bus.captureScope(context) };
      const evidence: NotebookEvidenceView[] = [];
      if (game) for (const id of game.notebook.factIds) {
        const fact = facts.get(id), mapping = presentation.facts.find(mapping => mapping.id === id);
        if (!fact || !mapping) continue;
        const list = mapping.list?.requiresFactIds.every(id => game.notebook.factIds.includes(id)) ? mapping.list : undefined;
        evidence.push({ id, heading: mapping.heading, sourceRoomId: fact.roomId as RoomId, sourceRoom: roomName(fact.roomId),
          kind: mapping.kind, text: fact.text, freshness: 'observation', ...(list ? { list } : {}) });
      }
      if (game) for (const measurement of game.notebook.measurements) {
        const group = presentation.measurementGroups?.find(g => g.ruleId === measurement.ruleId && measurement.subjectIds.includes(g.subjectId));
        if (group) {
          const conclusion = group.conclusions.find(c => c.code === measurement.conclusionCode);
          const source = registry.record(group.subjectId);
          if (!conclusion || !rooms.some(room => room.id === measurement.roomId) || source?.kind !== 'objective'
            || !source.evidence.some(e => e.roomId === measurement.roomId && e.ruleIds.includes(measurement.ruleId))) continue;
          const readings = measurement.readings.map(r => `${r.name}: ${r.value} ${r.unit}`).join('; ');
          evidence.push({ id: measurement.id, heading: group.heading, sourceRoomId: measurement.roomId, sourceRoom: roomName(measurement.roomId), kind: 'Measurement',
            text: `${readings ? `Observed result: ${readings}.` : 'No numeric result was produced for this reading.'} ${conclusion.explanation} ${group.scope}`,
            freshness: isMeasurementCurrent(measurement, game.world) ? 'current' : 'stale' });
          continue;
        }
        // Supported actual observations retain original provenance; unsupported
        // restored records are not recast as this introductory length test.
        if (measurement.ruleId !== presentation.measurement.ruleId || !measurement.subjectIds.includes(presentation.measurement.profileId as QualifiedId)
          || measurement.roomId !== introductoryMeasurementRoom
          || !['length-within-profile', 'length-exceeded'].includes(measurement.conclusionCode)) continue;
        const readings = measurement.readings.map(r => `${r.name}: ${r.value} ${r.unit}`).join('; ');
        evidence.push({ id: measurement.id, heading: presentation.measurement.heading, sourceRoomId: measurement.roomId, sourceRoom: roomName(measurement.roomId), kind: 'Measurement',
          text: `Observed result: ${readings}. ${measurement.conclusionCode === 'length-within-profile' ? 'Length is within the declared profile.' : measurement.conclusionCode === 'length-exceeded' ? 'Length exceeds the declared profile.' : measurement.conclusionCode} Fictional PROFILE-COPPER-100; length only. End-to-end service is not proven. Configuration ${measurement.configurationRevision}; attempt ${measurement.attemptId}.`,
          freshness: isMeasurementCurrent(measurement, game.world) ? 'current' : 'stale' });
      }
      const canPinHypothesis = !!game && panelReady(state) && game.world.roomId === q('R02') && !!entry && !!pinChoice
        && conditionSatisfied(entry.condition, game.world) && conditionSatisfied(pinChoice.condition, game.world)
        && ['FACT-endpoints', 'FACT-endpoint-a', 'FACT-endpoint-b', 'FACT-path'].every(id => game.notebook.factIds.includes(q<'fact'>(id)));
      return { capture: projection.capture, view: structuredClone({ context, draftScopeId, open: state.runtime.ui?.panel === 'notebook', personalNotes: game?.notebook.personalNotes ?? '',
        objectives: objectives.map(o => ({ ...o, completed: game?.world.completedObjectiveIds.includes(o.id) ?? false, pinned: pins.has(o.id) })),
        evidence, hypotheses: game?.notebook.hypotheses ?? [], maps: rooms.filter(room => game?.notebook.mapRoomIds.includes(room.id)), highlightedRoomId, canPinHypothesis, roomLabels: rooms }) };
    },
    /** Pair with bus.invalidate on Restore Save, new adventure, logout or title. */
    invalidate() { projection = null; pins.clear(); highlightedRoomId = null; draftScopeId = crypto.randomUUID(); },
    dispose() { if (disposed) return; disposed = true; registrations.forEach(off => off()); projection = null; pins.clear(); },
  };
}

/** Passive semantic UI. User writing goes only through bounded semantic intents. */
export function createNotebookPanel(host: HTMLElement, bus: Pick<ActionDispatcher, 'dispatch'>) {
  const doc = host.ownerDocument, abort = new AbortController(), prefix = `notebook-${crypto.randomUUID()}`;
  const element = doc.createElement('section'); element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Notebook'); element.hidden = true;
  element.style.overflowWrap = 'anywhere';
  const heading = doc.createElement('h2'); heading.textContent = 'Notebook'; heading.tabIndex = -1; element.append(heading);
  const sections = new Map<string, HTMLElement>();
  for (const name of ['Objectives', 'Evidence', 'Hypotheses', 'Maps', 'Personal Notes']) {
    const section = doc.createElement('section'), title = doc.createElement('h3'); title.textContent = name; title.id = `${prefix}-${sections.size}`;
    section.setAttribute('aria-labelledby', title.id); section.append(title); sections.set(name, section); element.append(section);
  }
  const listFor = (name: string) => { const list = doc.createElement('ul'); list.setAttribute('aria-label', name); sections.get(name)!.append(list); return list; };
  const objectiveList = listFor('Objectives'), evidenceList = listFor('Evidence'), hypothesisList = listFor('Hypotheses'), mapList = listFor('Maps');
  const textInput = (section: string, labelText: string) => {
    const label = doc.createElement('label'), input = doc.createElement('textarea'), error = doc.createElement('p');
    input.id = `${prefix}-${section.toLowerCase().replaceAll(' ', '-')}-input`; input.rows = section === 'Personal Notes' ? 6 : 3; input.style.width = '100%'; input.style.boxSizing = 'border-box';
    label.htmlFor = input.id; label.textContent = labelText; error.id = `${input.id}-feedback`; error.setAttribute('aria-live', 'polite'); input.setAttribute('aria-describedby', error.id);
    sections.get(section)!.append(label, input, error); return { input, error };
  };
  const hypothesis = textInput('Hypotheses', 'Hypothesis'), notes = textInput('Personal Notes', 'Personal notes');
  const prompt = doc.createElement('p'); prompt.textContent = 'Write a possibility and an observation that could support or challenge it, using up to 512 Unicode characters. Player hypotheses remain separate from observations.';
  sections.get('Hypotheses')!.insertBefore(prompt, hypothesisList);
  const pin = doc.createElement('button'); pin.type = 'button'; pin.textContent = 'Pin hypothesis'; sections.get('Hypotheses')!.append(pin);
  const eligibility = doc.createElement('p'); sections.get('Hypotheses')!.append(eligibility);
  const notesHelp = doc.createElement('p'); notesHelp.textContent = 'Plain text, up to 4096 Unicode characters. Notes join your adventure’s next safe save.'; sections.get('Personal Notes')!.append(notesHelp);
  const close = doc.createElement('button'); close.type = 'button'; close.textContent = 'Close notebook'; close.setAttribute('aria-keyshortcuts', 'Escape'); element.append(close); host.append(element);
  let current: { view: NotebookView; capture: ActionCapture } | null = null, disposed = false, composing = false;
  let composition: { capture: ActionCapture; draftScopeId: string } | null = null;
  let returnFocus: HTMLElement | null = null, previousNotes: string | null = null;
  const actions = new WeakMap<HTMLButtonElement, { input: SemanticAction; capture: ActionCapture }>();
  const send = (input: SemanticAction) => current ? bus.dispatch(current.capture(input)) : null;
  const reportText = (field: typeof notes, limit: number, nonempty: boolean) => {
    const valid = validNotebookText(field.input.value, limit, nonempty);
    field.input.setAttribute('aria-invalid', String(!valid));
    field.error.textContent = valid ? `${[...field.input.value].length} / ${limit} characters`
      : `Use ${nonempty ? '1–' : 'at most '}${limit} valid Unicode characters. Your text has been kept for editing.`;
    return valid;
  };
  const writeNotes = (captured?: ActionCapture) => {
    if (!current || composing || !reportText(notes, 4096, false)) return;
    const result = bus.dispatch((captured ?? current.capture)({ kind: 'edit-personal-notes', text: notes.input.value }));
    if (result && result.status !== 'handled') notes.error.textContent = result.message ?? 'Notes could not be updated. Your text has been kept for editing.';
  };
  notes.input.addEventListener('input', () => writeNotes(), { signal: abort.signal });
  notes.input.addEventListener('compositionstart', () => { composing = true; composition = current ? { capture: current.capture, draftScopeId: current.view.draftScopeId } : null; }, { signal: abort.signal });
  notes.input.addEventListener('compositionend', () => {
    composing = false; const original = composition; composition = null;
    if (original && original.draftScopeId === current?.view.draftScopeId) writeNotes(original.capture);
  }, { signal: abort.signal });
  element.addEventListener('click', event => {
    if (disposed || !current) return;
    const target = event.target instanceof Element ? event.target.closest('button') : null;
    if (target === pin) {
      if (!reportText(hypothesis, 512, true)) return;
      const result = send({ kind: 'pin-hypothesis', text: hypothesis.input.value });
      if (result?.status === 'handled') { hypothesis.input.value = ''; hypothesis.error.textContent = 'Pinned as player speculation.'; hypothesis.input.setAttribute('aria-invalid', 'false'); }
      else hypothesis.error.textContent = result?.message ?? 'The hypothesis could not be pinned.';
    } else if (target === close) send({ kind: 'close-panel' });
    else if (target instanceof HTMLButtonElement) { const action = actions.get(target); if (action) bus.dispatch(action.capture(action.input)); }
  }, { signal: abort.signal });
  element.addEventListener('keydown', event => {
    if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || event.isComposing || composing || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || !current?.view.open) return;
    event.preventDefault(); event.stopPropagation(); send({ kind: 'close-panel' });
  }, { signal: abort.signal });
  const paragraph = (text: string) => { const p = doc.createElement('p'); p.textContent = text; p.style.whiteSpace = 'pre-wrap'; return p; };
  const button = (label: string, input: SemanticAction, capture: ActionCapture) => {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = label; actions.set(button, { input, capture }); return button;
  };
  // Reuse rows while their content is unchanged so native focus survives notes
  // typing/status redraws; new row scopes bind only to authoritative projections.
  const rows = new Map<string, { element: HTMLLIElement; signature: string }>();
  const row = (id: string, model: unknown, build: (element: HTMLLIElement) => void) => {
    const signature = JSON.stringify(model); let entry = rows.get(id);
    if (!entry) { entry = { element: doc.createElement('li'), signature: '' }; rows.set(id, entry); }
    if (entry.signature !== signature) { entry.element.replaceChildren(); build(entry.element); entry.signature = signature; }
    return entry.element;
  };
  const reconcile = (parent: HTMLElement, children: HTMLElement[]) => {
    children.forEach((child, index) => { if (parent.children[index] !== child) parent.insertBefore(child, parent.children[index] ?? null); });
    while (parent.children.length > children.length) parent.lastElementChild!.remove();
  };
  return { element, render(view: NotebookView, capture: ActionCapture) {
    if (disposed) throw new Error('Notebook panel is disposed.');
    const model = structuredClone(view), wasOpen = !element.hidden, focus = doc.activeElement;
    const roomName = (id: string) => model.roomLabels.find(room => room.id === id)?.label ?? id;
    const newScope = current?.capture !== capture, newDraft = current?.view.draftScopeId !== model.draftScopeId;
    if (newScope) for (const entry of rows.values()) entry.signature = '';
    current = { view: model, capture };
    reconcile(objectiveList, model.objectives.map(o => row(`objective:${o.id}`, o, li => {
      li.append(paragraph(`${o.label} — ${o.completed ? 'Completed' : 'In progress'}${o.pinned ? ' — Pinned' : ''}`),
        paragraph(`Source: ${roomName(o.roomId)}`), button(`${o.pinned ? 'Unpin' : 'Pin'} objective: ${o.label}`, { kind: 'pin-objective', objectiveId: o.id }, capture));
    })));
    reconcile(evidenceList, model.evidence.map(e => row(`evidence:${e.id}`, e, li => {
      const title = doc.createElement('h4'); title.textContent = e.heading;
      li.append(title, paragraph(`${e.kind}. Source: ${e.sourceRoom}`), paragraph(e.text), paragraph(`Freshness: ${e.freshness}`));
      if (e.list) { const list = doc.createElement(e.list.ordered ? 'ol' : 'ul'); list.setAttribute('aria-label', e.list.label); for (const text of e.list.items) { const item = doc.createElement('li'); item.textContent = text; list.append(item); } li.append(list); }
      if (model.maps.some(room => room.id === e.sourceRoomId)) li.append(button(`Highlight source: ${e.heading}`, { kind: 'highlight-map-room', roomId: e.sourceRoomId }, capture));
    })));
    reconcile(hypothesisList, model.hypotheses.map(h => row(`hypothesis:${h.id}`, h, li => {
      li.append(paragraph(h.text), paragraph(`Pinned — Player hypothesis; ${h.status}. Source: your writing${h.subjectIds.includes(q('R02')) ? ` in ${roomName(q('R02'))}` : ''}. Freshness: speculation, not a measurement.`));
    })));
    reconcile(mapList, model.maps.map(room => row(`map:${room.id}`, [room, model.highlightedRoomId], li => {
      li.append(paragraph(`${room.label} — visited${model.highlightedRoomId === room.id ? ' — Highlighted' : ''}`), button(`Highlight ${room.label}`, { kind: 'highlight-map-room', roomId: room.id }, capture));
    })));
    pin.disabled = !model.canPinHypothesis;
    eligibility.textContent = model.canPinHypothesis ? '' : `Identify the known-good endpoints and the physical path in ${roomName(q('R02'))} before pinning a hypothesis.`;
    if (newDraft) { composing = false; hypothesis.input.value = ''; hypothesis.error.textContent = ''; hypothesis.input.setAttribute('aria-invalid', 'false'); }
    if (newDraft || previousNotes === null || previousNotes !== model.personalNotes) { notes.input.value = model.personalNotes; reportText(notes, 4096, false); }
    previousNotes = model.personalNotes; element.hidden = !model.open;
    if (model.open && !wasOpen) { returnFocus = focus instanceof HTMLElement ? focus : null; heading.focus(); }
    else if (!model.open && wasOpen && focus instanceof Node && element.contains(focus)) { if (returnFocus?.isConnected) returnFocus.focus(); }
    else if (model.open && focus instanceof HTMLElement && !focus.isConnected) heading.focus();
  }, dispose() { if (disposed) return; disposed = true; abort.abort(); rows.clear(); current = null; element.remove(); } };
}
