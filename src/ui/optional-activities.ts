// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import './optional-activities.css';
import type { ContentRegistry } from '../content/registry';
import type { QualifiedId, QuestId } from '../domain/types';
import { optionalActivityDefinition } from '../state/optional-activities';
import type { OptionalActivitySession, OptionalMode } from '../state/optional-activities';
import type { GameState } from '../state/types';
import type { PowerAuditAnswer } from '../state/optional-power-audit';
import type { RadioDiarySubmission } from '../state/optional-radio-diary';
import { projectRadioDiary, renderRadioDiaryForm, type RadioDiaryView } from './optional-radio-diary';
import type { ActionId, AttemptId } from '../domain/types';
import type { OptionalActivityOperation } from '../state/optional-activities';
import { contextFromRuntime } from './action-bus';
import type { ActionBus, ActionCapture, CapturedAction, SemanticAction } from './action-bus';
import type { GameplayStore } from './controller-store';
import { guardedPlan, playable, rejected, reductionPlan, unavailable } from './controller-store';

/** Intent only. The application adapter captures it through the standard bus. */
export type OptionalActivityIntent =
  | { readonly kind: 'start-optional'; readonly activityId: QualifiedId; readonly hotspotId: QualifiedId }
  | { readonly kind: 'choose-optional-mode'; readonly sessionId: string; readonly mode: OptionalMode }
  | { readonly kind: 'submit-optional'; readonly sessionId: string; readonly bits: string }
  | { readonly kind: 'submit-optional-power'; readonly sessionId: string; readonly answer: PowerAuditAnswer | { readonly assessment: null; readonly difference: null } }
  | { readonly kind: 'submit-optional-diary'; readonly sessionId: string; readonly answer: RadioDiarySubmission }
  | { readonly kind: 'hint-optional' | 'retry-optional' | 'explain-optional' | 'boundary-optional' | 'exit-optional'; readonly sessionId: string };
export interface OptionalActivityView {
  readonly sessionId: string; readonly title: string; readonly phase: OptionalActivitySession['phase']; readonly mode: OptionalMode | null;
  readonly instructions: readonly string[]; readonly map: readonly string[]; readonly samples: readonly string[];
  readonly feedback: string | null; readonly hintText: string | null; readonly completed: boolean;
  readonly rewardText: string | null;
  readonly controls: { readonly practice: string; readonly delivery: string; readonly submit: string; readonly retry: string; readonly exit: string };
  readonly limitations: readonly string[];
  readonly sources: readonly { readonly title: string; readonly section: string; readonly claim: string; readonly url: string | null }[];
  readonly answerKind: 'bits' | 'power' | 'diary';
  readonly diary?: RadioDiaryView;
  readonly answerControls: { readonly assessmentLabel: string; readonly withinBudget: string; readonly overBudget: string; readonly differenceLabel: string } | null;
}
export interface OptionalSource { readonly id: string; readonly title: string; readonly url: string }
const optionalKinds: readonly OptionalActivityIntent['kind'][] = ['start-optional', 'choose-optional-mode', 'submit-optional', 'submit-optional-power', 'submit-optional-diary', 'hint-optional', 'retry-optional', 'explain-optional', 'boundary-optional', 'exit-optional'];
export function createOptionalActivitiesController(options: { readonly registry: ContentRegistry; readonly store: GameplayStore; readonly bus: ActionBus;
  readonly activityIds: readonly QualifiedId[]; readonly sources?: readonly OptionalSource[] }) {
  const { registry, store, bus } = options;
  const captures = new WeakMap<CapturedAction, { readonly game: GameState | null; readonly session: OptionalActivitySession | null; readonly auth: object }>();
  let projection: { readonly state: ReturnType<GameplayStore['getState']>; readonly capture: ActionCapture } | null = null;
  let owned: OptionalActivitySession | null = null, disposed = false;
  const registrations = optionalKinds.map(kind => bus.register(kind, action => {
    const before = store.getState(), captured = captures.get(action), session = before.control.optionalActivity ?? null;
    if (disposed || !captured || captured.game !== before.runtime.game || captured.session !== session || captured.auth !== before.runtime.auth)
      return rejected('optional-stale-view', 'The activity changed. Use its current controls.');
    const input = action.input as OptionalActivityIntent;
    let operation: OptionalActivityOperation;
    switch (input.kind) {
      case 'start-optional': operation = { kind: 'start', activityId: input.activityId, hotspotId: input.hotspotId, sessionId: crypto.randomUUID() }; break;
      case 'choose-optional-mode': operation = { kind: 'choose-mode', sessionId: input.sessionId, mode: input.mode }; break;
      case 'submit-optional': operation = { kind: 'submit', sessionId: input.sessionId, bits: input.bits }; break;
      case 'submit-optional-power': operation = { kind: 'submit-power', sessionId: input.sessionId, answer: input.answer }; break;
      case 'submit-optional-diary': operation = { kind: 'submit-diary', sessionId: input.sessionId, answer: input.answer }; break;
      case 'hint-optional': operation = { kind: 'hint', sessionId: input.sessionId }; break;
      case 'retry-optional': operation = { kind: 'retry', sessionId: input.sessionId, nextAttemptId: crypto.randomUUID() as AttemptId }; break;
      case 'explain-optional': operation = { kind: 'explanation', sessionId: input.sessionId }; break;
      case 'boundary-optional': operation = { kind: 'boundary-example', sessionId: input.sessionId }; break;
      case 'exit-optional': operation = { kind: 'exit', sessionId: input.sessionId }; break;
    }
    if (input.kind === 'start-optional' && !options.activityIds.includes(input.activityId)) return unavailable('optional-unavailable', 'This optional activity is not available.');
    const plan = reductionPlan(store, action, before, { kind: 'optional-activity', operation }, input.kind === 'exit-optional' ? 'Activity closed.' : 'Activity updated.');
    return guardedPlan(store, before, plan.status !== 'ready' ? plan : { status: 'ready', commit: () => {
      const result = plan.commit(); if (result.status === 'handled') owned = store.getState().control.optionalActivity ?? null; return result;
    } });
  }));
  const invalidate = () => {
    projection = null; const previous = owned; owned = null;
    const state = store.getState(), game = state.runtime.game;
    // Lifecycle calls this before changing account identity. Exact session
    // ownership prevents retiring a newer account or restored activity.
    if (!previous || state.control.optionalActivity !== previous || !game || game.adventureId !== previous.adventureId || state.runtime.auth.clientGeneration !== previous.clientGeneration) return;
    const result = store.reduce(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
      input: { kind: 'optional-activity', operation: { kind: 'exit', sessionId: previous.sessionId } } });
    if (result.status !== 'rejected') store.compareAndSet(state, result.state);
  };
  return { project() {
    if (disposed) throw new Error('Optional activity controller is disposed.');
    const state = store.getState(), game = state.runtime.game, session = state.control.optionalActivity ?? null;
    if (!projection || projection.state !== state) {
      const capture = bus.captureScope(contextFromRuntime(state.runtime)), auth = state.runtime.auth;
      projection = { state, capture: (input: SemanticAction) => { const action = capture(input); captures.set(action, { game, session, auth }); return action; } };
    }
    // Keep the owning entry mounted behind the modal so exit can restore focus.
    const entries = (playable(state) || state.runtime.activity?.kind === 'active-optional') && game ? options.activityIds.flatMap(activityId => {
      const definition = optionalActivityDefinition(registry, activityId); if (!definition) return [];
      return definition.optionalActivity.entryContexts.filter(entry => entry.roomId === game.world.roomId && entry.safePositionId === game.world.position.safePositionId).map(entry => {
        const room = registry.record(entry.roomId); return { activityId, hotspotId: entry.hotspotId as QualifiedId,
          label: room?.kind === 'room' ? room.hotspots.find(h => h.id === entry.hotspotId)?.label ?? 'Optional activity' : 'Optional activity' };
      });
    }) : [];
    return { entries, capture: projection.capture, view: state.runtime.activity?.kind === 'active-optional' && session?.clientGeneration === state.runtime.auth.clientGeneration
      ? projectOptionalActivity(registry, game, session, options.sources) : null };
  }, invalidate, dispose() { if (disposed) return; invalidate(); disposed = true; registrations.forEach(remove => remove()); } };
}
/** Projection cannot grant progress or infer a produced asset from an allocation. */
export function projectOptionalActivity(registry: ContentRegistry, game: GameState | null, session: OptionalActivitySession | null,
  sources: readonly OptionalSource[] = []): OptionalActivityView | null {
  if (!game || !session || session.adventureId !== game.adventureId) return null;
  const definition = optionalActivityDefinition(registry, session.activityId);
  if (!definition) return { sessionId: session.sessionId, title: 'Optional activity', phase: 'feedback', mode: null,
    instructions: [], map: [], samples: [], feedback: 'This exhibit needs correction. You can leave safely.', hintText: null, completed: false, rewardText: null,
    controls: { practice: 'Practice', delivery: 'Try the full activity', submit: 'Check answer', retry: 'Retry', exit: 'Leave activity' }, limitations: [], sources: [], answerKind: 'bits', answerControls: null };
  const activity = definition.optionalActivity, profile = registry.record(activity.profileId), room = registry.record(session.entry.roomId);
  const title = room?.kind === 'room' ? room.hotspots.find(h => h.id === session.entry.hotspotId)?.label ?? 'Optional activity' : 'Optional activity';
  const completed = game.world.completedQuestIds.includes(definition.id as QuestId);
  const level = (value: number) => value > 0 ? `+${value}` : String(value).replace('-', '−');
  const parameters = profile?.kind === 'profile' ? profile.parameters as { levels?: readonly { symbol: { value: number }; bits: string }[]; deliveredBudget?: { value: number; unit: string } } : null;
  return { sessionId: session.sessionId, title, phase: session.phase, mode: session.mode, instructions: activity.instructions,
    map: activity.kind === 'toy-symbol-message' ? parameters?.levels?.map(row => `${level(row.symbol.value)} → ${row.bits}`) ?? [] : [],
    samples: session.mode ? activity.kind === 'toy-symbol-message' ? activity[session.mode].samples.map(sample => `Position ${sample.position}: ${level(sample.value)} toy-level`)
      : activity.kind === 'delivered-power-audit' ? [`Delivered allowance: ${parameters?.deliveredBudget?.value} ${parameters?.deliveredBudget?.unit} after losses.`, ...activity[session.mode].demands.map((demand, index) => `Demand card ${index + 1}: ${demand.value} ${demand.unit} delivered after losses.`), 'The supplied port and compatibility checks are satisfied. Power does not prove data connectivity.'] : [] : [],
    feedback: session.feedback, hintText: session.hintText, completed,
    rewardText: completed && game.notebook.factIds.some(id => id === activity.reward.factId) ? `${activity.reward.alternativeText} ${activity.reward.unavailableText}` : null,
    controls: activity.controls, limitations: definition.model.limitations, answerKind: activity.kind === 'toy-symbol-message' ? 'bits' : activity.kind === 'delivered-power-audit' ? 'power' : 'diary',
    ...(activity.kind === 'radio-weather-diary' ? { diary: projectRadioDiary(registry, game, activity, completed && game.notebook.factIds.some(id => String(id) === activity.reward.factId)) } : {}),
    answerControls: activity.kind === 'delivered-power-audit' ? activity.answerControls : null,
    sources: definition.sourceClaims.map(claim => {
      const source = sources.find(s => s.id === claim.sourceId || `spec001:${s.id}` === claim.sourceId);
      return { title: source?.title ?? claim.sourceId, section: claim.section, claim: claim.supportedClaim, url: source && /^https:\/\//.test(source.url) ? source.url : null };
    }) };
}

/** The frame supplies modality; the panel retains captured callbacks and focus. */
export function createOptionalActivityPanel<Command>(host: HTMLElement, dispatcher: { dispatch(command: Command): unknown }) {
  const doc = host.ownerDocument, element = doc.createElement('section'), heading = doc.createElement('h2'), body = doc.createElement('div');
  element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Optional activity'); element.className = 'nq-optional'; element.hidden = true;
  element.style.overflowWrap = 'anywhere'; element.style.minWidth = '0';
  heading.tabIndex = -1; element.append(heading, body); host.append(element);
  type Capture = (intent: OptionalActivityIntent) => Command;
  interface Scope { readonly view: OptionalActivityView; readonly capture: Capture; readonly abort: AbortController; readonly controls: Map<string, HTMLElement> }
  let current: Scope | null = null, disposed = false, returnFocus: HTMLElement | null = null;
  const lifetime = new AbortController();
  const active = (scope: Scope) => !disposed && current === scope && !element.hidden && element.isConnected && !element.closest('[hidden], [inert]');
  const paragraph = (text: string) => { const node = doc.createElement('p'); node.textContent = text; return node; };
  const retire = () => { const wasOpen = !element.hidden, ownedFocus = element.contains(doc.activeElement); current?.abort.abort(); current = null; element.hidden = true; body.replaceChildren();
    if (wasOpen && ownedFocus && returnFocus?.isConnected) queueMicrotask(() => { if (!current && !returnFocus?.closest('[hidden], [inert]')) returnFocus?.focus(); }); };
  const send = (scope: Scope, intent: OptionalActivityIntent) => { if (active(scope)) dispatcher.dispatch(scope.capture(intent)); };
  element.addEventListener('keydown', event => {
    if (current && active(current) && event.key === 'Escape' && !event.defaultPrevented && !event.repeat && !event.isComposing
      && !event.ctrlKey && !event.altKey && !event.metaKey && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); send(current, { kind: 'exit-optional', sessionId: current.view.sessionId });
    }
  }, { signal: lifetime.signal });
  function button(scope: Scope, key: string, label: string, intent: OptionalActivityIntent) {
    const node = doc.createElement('button'); node.type = 'button'; node.textContent = label; scope.controls.set(key, node);
    if (key === 'exit') node.setAttribute('aria-keyshortcuts', 'Escape');
    node.addEventListener('click', () => { if (node.isConnected && element.contains(node)) send(scope, intent); }, { signal: scope.abort.signal }); return node;
  }
  return { element, render(view: OptionalActivityView | null, capture: Capture) {
    if (disposed) return;
    if (!view) { retire(); return; }
    if (current?.capture === capture && JSON.stringify(current.view) === JSON.stringify(view)) return;
    const wasOpen = !element.hidden, focus = doc.activeElement, previous = current;
    const focusKey = previous && [...previous.controls].find(([, node]) => node === focus)?.[0];
    const input = previous?.controls.get('answer') as HTMLInputElement | undefined;
    const draft = previous?.view.sessionId === view.sessionId && previous.view.mode === view.mode ? input?.value ?? '' : '';
    previous?.abort.abort();
    const scope: Scope = { view: structuredClone(view), capture, abort: new AbortController(), controls: new Map() };
    current = scope; heading.textContent = view.title; element.hidden = false;
    const children: HTMLElement[] = [paragraph('Optional · Untimed'), ...view.instructions.map(paragraph)];
    const actions = doc.createElement('div'); actions.setAttribute('aria-label', 'Activity choices');
    const delivery = button(scope, 'delivery', view.controls.delivery, { kind: 'choose-optional-mode', sessionId: view.sessionId, mode: 'delivery' });
    if (view.diary && !view.diary.available) delivery.disabled = true;
    actions.append(button(scope, 'practice', view.controls.practice, { kind: 'choose-optional-mode', sessionId: view.sessionId, mode: 'practice' }), delivery); children.push(actions);
    if (view.map.length) children.push(paragraph(`Toy map: ${view.map.join('; ')}. These are labels, not measured volts.`));
    if (view.diary) {
      if (!view.diary.available) children.push(paragraph(view.diary.missingEvidence));
      if (view.diary.records.length) {
        const records = doc.createElement('ol'); records.setAttribute('aria-label', 'Actual radio observations');
        for (const row of view.diary.records) { const item = doc.createElement('li'); item.textContent = row.text; records.append(item); } children.push(records);
      }
      if (view.mode === 'delivery' && view.diary.available) children.push(renderRadioDiaryForm(doc, view.diary,
        previous?.view.sessionId === view.sessionId && previous.view.mode === view.mode ? previous.controls : new Map(),
        scope.controls, view.controls.submit, scope.abort.signal, answer => send(scope, { kind: 'submit-optional-diary', sessionId: view.sessionId, answer })));
      if (view.diary.depth) { const title = doc.createElement('h3'); title.textContent = view.diary.depth.title; children.push(title, ...view.diary.depth.paragraphs.map(paragraph)); }
    }
    if (view.mode && !view.diary) {
      const samples = doc.createElement('ol'); samples.setAttribute('aria-label', view.answerKind === 'power' ? 'Power audit cards' : view.mode === 'practice' ? 'Practice samples' : 'Message samples');
      for (const sample of view.samples) { const item = doc.createElement('li'); item.textContent = sample; samples.append(item); } children.push(samples);
      const form = doc.createElement('form'), label = doc.createElement('label'), answer = doc.createElement('input'), submit = doc.createElement('button');
      answer.id = 'nq-optional-answer'; answer.type = view.answerKind === 'bits' ? 'text' : 'number'; answer.inputMode = view.answerKind === 'bits' ? 'numeric' : 'decimal'; answer.maxLength = 512; answer.autocomplete = 'off'; answer.spellcheck = false; answer.value = draft;
      if (view.answerKind === 'power') { answer.min = '0'; answer.step = 'any'; }
      answer.style.maxWidth = '100%'; answer.style.boxSizing = 'border-box'; label.htmlFor = answer.id; label.textContent = view.answerControls?.differenceLabel ?? (view.mode === 'practice' ? 'Practice bits' : 'Full message bits');
      const assessment = doc.createElement('select');
      if (view.answerControls) {
        assessment.id = 'nq-optional-assessment'; const choiceLabel = doc.createElement('label'); choiceLabel.htmlFor = assessment.id; choiceLabel.textContent = view.answerControls.assessmentLabel;
        for (const [value, text] of [['', 'Choose an assessment'], ['within-budget', view.answerControls.withinBudget], ['over-budget', view.answerControls.overBudget]]) {
          const option = doc.createElement('option'); option.value = value!; option.textContent = text!; assessment.append(option);
        }
        if (previous?.view.sessionId === view.sessionId && previous.view.mode === view.mode) assessment.value = (previous.controls.get('assessment') as HTMLSelectElement | undefined)?.value ?? '';
        scope.controls.set('assessment', assessment); form.append(choiceLabel, assessment);
      }
      submit.type = 'submit'; submit.textContent = view.controls.submit; scope.controls.set('answer', answer); scope.controls.set('submit', submit);
      form.append(label, answer, submit); form.addEventListener('submit', event => { event.preventDefault();
        if (view.answerKind === 'bits') send(scope, { kind: 'submit-optional', sessionId: view.sessionId, bits: answer.value });
        else { const value = answer.value.trim() === '' ? null : Number(answer.value), selected = assessment.value;
          send(scope, { kind: 'submit-optional-power', sessionId: view.sessionId, answer: value !== null && Number.isFinite(value) && value >= 0 && (selected === 'within-budget' || selected === 'over-budget')
            ? { assessment: selected, difference: { value, unit: 'W' } } : { assessment: null, difference: null } }); }
      }, { signal: scope.abort.signal }); children.push(form);
    }
    const feedback = paragraph(view.feedback ?? (view.completed ? 'Completion recorded in your journal.' : view.answerKind === 'diary' ? 'Read the worked card or compare your actual observations when ready.' : view.answerKind === 'power' ? 'Choose practice or audit the full plan when ready.' : 'Choose practice or the full message when ready.'));
    feedback.setAttribute('role', 'status'); feedback.setAttribute('aria-live', 'polite'); children.push(feedback);
    if (view.hintText) children.push(paragraph(view.hintText));
    if (view.rewardText) children.push(paragraph(view.rewardText));
    const controls = doc.createElement('div'); controls.append(
      button(scope, 'hint', 'Next hint', { kind: 'hint-optional', sessionId: view.sessionId }),
      button(scope, 'explain', 'Read explanation', { kind: 'explain-optional', sessionId: view.sessionId }),
      button(scope, 'retry', view.controls.retry, { kind: 'retry-optional', sessionId: view.sessionId })); children.push(controls);
    if (view.answerKind === 'power') controls.append(button(scope, 'boundary', 'See the exact-budget example', { kind: 'boundary-optional', sessionId: view.sessionId }));
    const details = doc.createElement('details'), summary = doc.createElement('summary'); summary.tabIndex = 0; summary.textContent = 'Technical details and sources'; details.append(summary);
    for (const limitation of view.limitations) details.append(paragraph(limitation));
    for (const source of view.sources) {
      details.append(paragraph(`${source.title} · ${source.section}`), paragraph(source.claim));
      if (source.url) { const link = doc.createElement('a'); link.textContent = source.title; link.href = source.url; link.target = '_blank'; link.rel = 'noopener noreferrer'; details.append(link); }
    }
    children.push(details, button(scope, 'exit', view.controls.exit, { kind: 'exit-optional', sessionId: view.sessionId })); body.replaceChildren(...children);
    if (!wasOpen) { returnFocus = focus instanceof HTMLElement ? focus : null; queueMicrotask(() => { if (active(scope)) heading.focus(); }); }
    else if (focusKey) (scope.controls.get(focusKey) ?? heading).focus({ preventScroll: true });
  }, dispose() { if (disposed) return; retire(); disposed = true; lifetime.abort(); element.remove(); } };
}
