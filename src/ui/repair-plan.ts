// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { RiftHazardDescriptor } from '../content/endings';
import type { MeasurementId, QualifiedId } from '../domain/types';
import { prepareRepairPlanChange, repairClassification, repairFlags, repairMeasurementCurrent, repairMeasurementDuration, repairPlans } from '../state/repair-plan';
import type { RepairClassification, RepairPlanId, RepairPlanOperation, RepairScenarioResolver } from '../state/repair-plan';
import type { GameState } from '../state/types';
import { createEncounterPreparationControls } from './encounter';
import { repairFeedback } from './repair-feedback';
import { createRiftHazardControls } from './rift-hazard';
import { contextFromRuntime } from './action-bus';
import type { ActionBus, ActionCapture, ActionDispatcher, ActionPlan, CapturedAction } from './action-bus';
import { actionAvailable, playable, reductionPlan, rejected, unavailable } from './controller-store';
import type { ActiveActionAdmission, GameplayStore } from './controller-store';
import type { ReducerState } from '../state/reducer';
const q = (id: string) => `spec001:${id}` as QualifiedId;
export interface RepairPlanView {
  readonly stage: 'preparation' | 'validation' | 'unavailable';
  readonly available: boolean;
  readonly completed: boolean;
  readonly encounterActive?: boolean;
  readonly hazard?: RiftHazardDescriptor | null;
  readonly selected: RepairPlanId | null;
  readonly duration: 'permanent' | 'temporary' | null;
  readonly classification: RepairClassification | null;
  readonly reviewId: MeasurementId | null;
  readonly linkId: MeasurementId | null;
  readonly endpointId: MeasurementId | null;
  readonly measurements: readonly { readonly id: MeasurementId; readonly text: string; readonly current: boolean }[];
  readonly explanation: string;
}
export function createRepairPlanController(options: { readonly registry: ContentRegistry; readonly store: GameplayStore; readonly bus: ActionBus; readonly resolveScenario: RepairScenarioResolver;
  readonly allowDuringEncounter?: ActiveActionAdmission;
  readonly executePlan?: (action: CapturedAction, before: ReducerState, message: string) => ActionPlan;
  readonly classifyPlan?: (action: CapturedAction, before: ReducerState, message: string) => ActionPlan;
  readonly hazard?: (state: ReducerState) => RiftHazardDescriptor | null;
}) {
  const { registry, store, bus, resolveScenario, allowDuringEncounter } = options;
  let projection: { readonly game: GameState | null; readonly capture: ActionCapture } | null = null;
  const handle = (action: CapturedAction): ActionPlan => {
    const before = store.getState(), game = before.runtime.game, input = action.input;
    if (!game || !actionAvailable(before, input, allowDuringEncounter)) return unavailable('unavailable-state', 'Finish the current activity before using the repair controls.');
    if (input.kind === 'classify-repair' && options.classifyPlan) return options.classifyPlan(action, before, 'The current evidence has been classified. Review its outcome and caveats before continuing.');
    if (input.kind === 'classify-repair' && before.runtime.activity?.kind === 'active-encounter') return unavailable('outcome-unavailable', 'Outcome review is not available yet. Your intervention and observations remain in memory.');
    let operation: RepairPlanOperation;
    switch (input.kind) {
      case 'choose-repair-plan': operation = { kind: 'choose', actionId: input.choiceId }; break;
      case 'review-repair-plan': operation = { kind: 'review', id: crypto.randomUUID() as MeasurementId }; break;
      case 'execute-repair-plan': operation = { kind: 'execute', reviewId: input.reviewId, warningAcknowledged: input.warningAcknowledged }; break;
      case 'measure-repair-link': operation = { kind: 'measure-link', id: crypto.randomUUID() as MeasurementId }; break;
      case 'test-repair-endpoint': operation = { kind: 'test-endpoint', id: crypto.randomUUID() as MeasurementId }; break;
      case 'classify-repair': operation = { kind: 'classify', selection: input.selection, linkId: input.linkId, endpointId: input.endpointId }; break;
      default: return rejected('invalid-input', 'Choose a repair-plan action.');
    }
    const prepared = prepareRepairPlanChange(registry, resolveScenario, game, operation);
    if (!prepared.ok) return rejected(prepared.reason, repairFeedback(prepared.reason, prepared.reason));
    const evaluation = prepared.evaluation;
    const message = `${['review', 'measure-link', 'test-endpoint'].includes(operation.kind) && evaluation.observations.some(o => o && typeof o === 'object' && 'kind' in o && o.kind === 'repair-measurement') ? 'Observation recorded. ' : ''}${repairFeedback(evaluation.reasonCode, evaluation.status)}`;
    if (operation.kind === 'execute' && options.executePlan) return options.executePlan(action, before, message);
    return reductionPlan(store, action, before, { kind: 'repair-plan', operation }, message);
  };
  const off: (() => void)[] = [];
  try { for (const kind of ['choose-repair-plan', 'review-repair-plan', 'execute-repair-plan', 'measure-repair-link', 'test-repair-endpoint', 'classify-repair'] as const) off.push(bus.register(kind, handle)); }
  catch (error) { off.forEach(dispose => dispose()); throw error; }
  return {
    project(): { readonly view: RepairPlanView; readonly capture: ActionCapture } {
      const state = store.getState(), game = state.runtime.game;
      if (!projection || projection.game !== game) projection = { game, capture: bus.captureScope(contextFromRuntime(state.runtime)) };
      const stage = game?.world.roomId === q('R11') ? 'preparation' : game?.world.roomId === q('R12') ? 'validation' : 'unavailable';
      const selected = game ? repairPlans.find(p => p.id === game.world.flags[stage === 'preparation' ? repairFlags.selected : repairFlags.executed])?.id ?? null : null;
      const duration = game?.world.flags[repairFlags.duration];
      const measurementDuration = game && selected ? repairMeasurementDuration(selected, game.world) : null;
      const measurementLabels: Record<string, string> = { review: 'Plan review', link: 'Link measurement', endpoint: 'Endpoint test' };
      const measurements = game?.notebook.measurements.filter(m => m.conclusionCode.startsWith('repair:')).map(m => ({ id: m.id,
        text: `${measurementLabels[m.conclusionCode.split(':')[1]!] ?? 'Repair observation'} — ${m.readings.map(r => `${r.name}: ${r.value} ${r.unit}`).join('; ')}`, current: repairMeasurementCurrent(m, game) })) ?? [];
      const latest = (kind: string) => game && selected && measurementDuration ? [...game.notebook.measurements].reverse().find(m => repairMeasurementCurrent(m, game)
        && m.conclusionCode.startsWith(`repair:${kind}:${selected}:${measurementDuration}:`))?.id ?? null : null;
      return { capture: projection.capture, view: { stage, available: stage !== 'unavailable' && (playable(state)
        || (stage === 'validation' && actionAvailable(state, { kind: 'measure-repair-link' }, allowDuringEncounter))), selected,
        duration: duration === 'permanent' || duration === 'temporary' ? duration : null, classification: game ? repairClassification(game) : null,
        completed: game?.world.completedObjectiveIds.includes(q(stage === 'preparation' ? 'O11' : 'O12') as never) ?? false,
        encounterActive: state.runtime.activity?.kind === 'active-encounter', hazard: options.hazard?.(state) ?? null,
        reviewId: latest('review'), linkId: latest('link'), endpointId: latest('endpoint'), measurements,
        explanation: stage === 'preparation' ? 'Review the selected deployment at the Rift. These new installation candidates are distinct from the training benches. Current carried equipment and calibration are checked again. Permanent execution removes the damaged installation and fits the protected route. Temporary execution installs the borrowed bypass while the damaged installation remains isolated.'
          : 'Arrival does not prove restored service. Repeat the physical link checks and independently run the supplied endpoint test. The NQ highlight is inside an opaque upper-interface frame; it is not a whole frame, Ethernet FCS or universal error check. Accepted classification records the evidence that was current at submission; later changes make those observations historical.' } };
    },
    invalidate() { projection = null; },
    dispose() { off.forEach(dispose => dispose()); projection = null; },
  };
}

/** Mount in the existing in-frame contextual overlay host; no renderer verdicts. */
export function createRepairPlanPanel(host: HTMLElement, dispatcher: Pick<ActionDispatcher, 'dispatch'>, onClose: () => void) {
  const doc = host.ownerDocument, element = doc.createElement('section'), heading = doc.createElement('h2'), body = doc.createElement('div');
  element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Repair plan'); element.hidden = true;
  element.style.overflowWrap = 'anywhere'; element.style.maxHeight = '100%'; element.style.overflowY = 'auto';
  heading.tabIndex = -1; element.append(heading, body); host.append(element);
  type Projection = { readonly view: RepairPlanView; readonly capture: ActionCapture };
  interface Scope { readonly projection: Projection; readonly abort: AbortController; readonly controls: Map<string, HTMLElement> }
  let active: Scope | null = null, previous: HTMLElement | null = null, disposed = false;
  const lifetime = new AbortController();
  const isActive = (scope: Scope) => !disposed && active === scope && !element.hidden && element.isConnected
    && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0;
  const retire = () => { const wasOpen = active !== null && !element.hidden; active?.abort.abort(); active = null; element.hidden = true; body.replaceChildren();
    if (wasOpen && previous?.isConnected) previous.focus(); previous = null; };
  const close = (scope: Scope) => { if (isActive(scope)) { retire(); onClose(); } };
  element.addEventListener('keydown', event => { const scope = active;
    if (scope && isActive(scope) && event.target instanceof Node && element.contains(event.target) && event.key === 'Escape' && !event.defaultPrevented
      && !event.isComposing && !event.repeat && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); close(scope);
    }
  }, { signal: lifetime.signal });
  const paragraph = (text: string) => { const p = doc.createElement('p'); p.textContent = text; return p; };
  const button = (scope: Scope, key: string, label: string, action: () => void, disabled = false) => {
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = disabled; scope.controls.set(key, b);
    // The adventure frame may move Close into this dialog's header.
    b.addEventListener('click', () => { if (isActive(scope) && !b.disabled && b.isConnected && element.contains(b)) action(); }, { signal: scope.abort.signal }); return b;
  };
  return { element,
    render(projection: Projection | null) {
      if (disposed) return; if (projection === null) { retire(); return; }
      const wasOpen = active !== null && !element.hidden;
      if (wasOpen && active?.projection.capture === projection.capture && JSON.stringify(active.projection.view) === JSON.stringify(projection.view)) return;
      const focusKey = wasOpen ? [...active!.controls].find(([, control]) => control === doc.activeElement)?.[0] : undefined;
      active?.abort.abort(); const scope: Scope = { projection, abort: new AbortController(), controls: new Map() }; active = scope; element.hidden = false;
      const { view, capture } = projection;
      heading.textContent = view.stage === 'preparation' ? 'Repair plan' : 'Validate repair'; element.setAttribute('aria-label', heading.textContent);
      const children: HTMLElement[] = [paragraph(view.explanation), paragraph(view.completed ? `Recorded result: ${view.classification ?? 'intervention executed'}.` : 'This objective is in progress. No restored service has been awarded.')];
      const choose = (name: string) => dispatcher.dispatch(capture({ kind: 'choose-repair-plan', choiceId: q(`ACTION-repair-${name}`) }));
      const disabled = !view.available || view.completed;
      if (view.stage === 'preparation') {
        children.push(paragraph(`Selected deployment: ${repairPlans.find(p => p.id === view.selected)?.label ?? 'none'}. Installation type: ${view.selected === 'shutdown' ? 'not applicable to deliberate isolation' : view.duration ?? 'not selected'}.`));
        for (const plan of repairPlans) children.push(button(scope, plan.id, plan.label, () => choose(`plan-${plan.id}`), disabled));
        children.push(button(scope, 'permanent', 'Permanent installation', () => choose('duration-permanent'), disabled),
          button(scope, 'temporary', 'Temporary installation', () => choose('duration-temporary'), disabled),
          button(scope, 'read-plan', 'Read and keep plan requirements', () => choose('read-plan'), disabled),
          paragraph('Temporary dependency: the borrowed bypass occupies the protected work corridor. Limitation: it cannot remain the permanent installation. Follow-up: install and test the permanent protected route before returning the borrowed installation.'),
          button(scope, 'maintenance', 'Record temporary dependency and follow-up', () => choose('record-maintenance'), disabled),
          paragraph('Isolation names the severed conduit as unresolved and keeps it disconnected. Recovery: return to safe preparation, repair the damaged path, measure again and repeat the endpoint test.'),
          button(scope, 'isolation', 'Record unresolved fault and recovery plan', () => choose('record-isolation'), disabled),
          button(scope, 'review', 'Review current plan', () => dispatcher.dispatch(capture({ kind: 'review-repair-plan' })), disabled));
        if (!view.completed) {
          const holder = doc.createElement('div');
          const preparation = createEncounterPreparationControls(holder, { view: { ...view, available: !disabled }, capture, dispatcher,
            signal: scope.abort.signal, isCurrent: () => isActive(scope) && body.contains(holder), onReturn: () => close(scope) });
          scope.controls.set('warning', preparation.warning); scope.controls.set('execute', preparation.execute); scope.controls.set('return', preparation.returnButton);
          if (view.hazard) {
            const hazard = createRiftHazardControls(holder, { hazard: view.hazard, capture, dispatcher,
              signal: scope.abort.signal, isCurrent: () => isActive(scope) && body.contains(holder), onReturn: () => close(scope) });
            scope.controls.set('hazard-warning', hazard.warning); scope.controls.set('hazard-commit', hazard.commit); scope.controls.set('hazard-return', hazard.returnButton);
          }
          children.push(holder);
        } else if (view.encounterActive) children.push(paragraph('The intervention is committed. Walk to the Iron Threshold to validate it. Other exits remain closed and saving is paused until the encounter is resolved.'));
      } else if (view.stage === 'validation') {
        children.push(button(scope, 'classification-context', 'Read classification criteria', () => choose('read-classification'), disabled),
          button(scope, 'link', 'Measure repaired link', () => dispatcher.dispatch(capture({ kind: 'measure-repair-link' })), disabled || view.selected === 'shutdown'),
          button(scope, 'endpoint', 'Run endpoint test', () => dispatcher.dispatch(capture({ kind: 'test-repair-endpoint' })), disabled || view.selected === 'shutdown'));
        for (const [selection, label] of [['permanent', 'Classify permanent restoration'], ['temporary', 'Classify temporary restoration'], ['shutdown', 'Record unresolved isolation']] as const)
          children.push(button(scope, `classify-${selection}`, label, () => dispatcher.dispatch(capture({ kind: 'classify-repair', selection, linkId: view.linkId, endpointId: view.endpointId })), disabled));
      }
      const list = doc.createElement('ol'); list.setAttribute('aria-label', 'Repair observations');
      for (const measurement of view.measurements) { const item = doc.createElement('li'); item.textContent = `${measurement.current ? 'Current observation' : 'Stale observation — retained for comparison'}: ${measurement.text}`; list.append(item); }
      children.push(list, button(scope, 'close', 'Close repair controls', () => close(scope))); body.replaceChildren(...children);
      if (!wasOpen) { previous = doc.activeElement as HTMLElement | null; heading.focus(); }
      else if (focusKey !== undefined) { const replacement = scope.controls.get(focusKey); if (replacement && !('disabled' in replacement && replacement.disabled)) replacement.focus(); else heading.focus(); }
    },
    dispose() { if (disposed) return; retire(); disposed = true; lifetime.abort(); element.remove(); },
  };
}
