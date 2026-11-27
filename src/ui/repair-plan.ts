// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { MeasurementId, QualifiedId } from '../domain/types';
import { prepareRepairPlanChange, repairClassification, repairFlags, repairMeasurementCurrent, repairPlans } from '../state/repair-plan';
import type { RepairClassification, RepairPlanId, RepairPlanOperation, RepairScenarioResolver } from '../state/repair-plan';
import type { GameState } from '../state/types';
import { contextFromRuntime } from './action-bus';
import type { ActionBus, ActionCapture, ActionDispatcher, ActionPlan, CapturedAction } from './action-bus';
import { playable, reductionPlan, rejected, unavailable } from './controller-store';
import type { GameplayStore } from './controller-store';
const q = (id: string) => `spec001:${id}` as QualifiedId;
export interface RepairPlanView {
  readonly stage: 'preparation' | 'validation' | 'unavailable';
  readonly available: boolean;
  readonly completed: boolean;
  readonly selected: RepairPlanId | null;
  readonly duration: 'permanent' | 'temporary' | null;
  readonly classification: RepairClassification | null;
  readonly reviewId: MeasurementId | null;
  readonly linkId: MeasurementId | null;
  readonly endpointId: MeasurementId | null;
  readonly measurements: readonly { readonly id: MeasurementId; readonly text: string; readonly current: boolean }[];
  readonly explanation: string;
}
const messages: Record<string, string> = {
  'repair-choice-recorded': 'Your proposal or supporting record is recorded. It has not executed an intervention or taken a measurement.',
  'current-physical-checks-pass': 'The current physical checks pass within this fictional exercise. The separate endpoint test still determines service evidence.',
  'intervention-executed': 'The reviewed intervention was executed. Earlier readings are now stale. At the balcony, take fresh link measurements and run the separate endpoint test.',
  'restoration-validated': 'Fresh physical and endpoint evidence support the recorded restoration classification.',
  'unresolved-isolation-recorded': 'The defect remains deliberately isolated. Service is unresolved, and this shutdown cannot replace your recoverable save.',
  'repair-already-complete': 'This intervention or validation has already been recorded.',
  'final-proof-missing': 'Record a fresh link measurement and the separate endpoint test before classifying restored service.',
  'stale-evidence': 'That record is stale. Keep it for comparison and repeat the current check.',
  'measurement-provenance-mismatch': 'That record does not match the current selected deployment. Repeat the current check.',
  'prerequisite-unmet': 'Complete the selected branch, equipment check and Clockworks preparation before reviewing this intervention.',
  'plan-record-missing': 'Read and keep the plan requirements before execution.',
  'warning-not-acknowledged': 'Read the warning and explicitly acknowledge it before executing the reviewed intervention.',
  'temporary-followup-missing': 'Temporary restoration needs a real temporary dependency and a recorded limitation and follow-up.',
  'temporary-is-not-permanent': 'A temporary dependency remains. Passing service checks cannot make it a permanent repair.',
  'defect-not-removed': 'The defect has not been removed. A passing alternate path alone cannot establish permanent repair.',
  'isolation-record-missing': 'Record the named unresolved defect and recovery plan before deliberately isolating it.',
  'shutdown-not-deliberate': 'An outage is not a deliberate shutdown. Use a reviewed isolation plan with its named fault and recovery record.',
  'service-deliberately-isolated': 'The path is deliberately isolated. Record unresolved service instead of claiming restoration.',
  'classification-context-missing': 'Read the classification criteria before recording the result.',
  'endpoint-service-unresolved': 'The separate endpoint service test failed. A healthy link or matching pattern cannot replace that evidence.',
  'endpoint-service-acknowledged': 'The supplied endpoint service test acknowledged the request. This is separate cross-layer evidence, not a result inferred from link-up.',
};
function feedback(reason: string, status: string) {
  return messages[reason] ?? (status === 'content-error' ? 'This exercise has a content error. No progress or penalty was applied.'
    : status === 'invalid-input' ? 'Select the plan and installation type, then use the current repair controls.'
      : status === 'incorrect' ? 'The current checks do not support this claim. Inspect the recorded observations and return to preparation if needed.' : 'Current observations recorded. No service success is inferred from arrival.');
}
export function createRepairPlanController(options: { readonly registry: ContentRegistry; readonly store: GameplayStore; readonly bus: ActionBus; readonly resolveScenario: RepairScenarioResolver }) {
  const { registry, store, bus, resolveScenario } = options;
  let projection: { readonly game: GameState | null; readonly capture: ActionCapture } | null = null;
  const handle = (action: CapturedAction): ActionPlan => {
    const before = store.getState(), game = before.runtime.game, input = action.input;
    if (!game || !playable(before)) return unavailable('unavailable-state', 'Finish the current activity before using the repair controls.');
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
    if (!prepared.ok) return rejected(prepared.reason, feedback(prepared.reason, prepared.reason));
    const evaluation = prepared.evaluation;
    const message = `${['review', 'measure-link', 'test-endpoint'].includes(operation.kind) && evaluation.observations.some(o => o && typeof o === 'object' && 'kind' in o && o.kind === 'repair-measurement') ? 'Observation recorded. ' : ''}${feedback(evaluation.reasonCode, evaluation.status)}`;
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
      const measurementLabels: Record<string, string> = { review: 'Plan review', link: 'Link measurement', endpoint: 'Endpoint test' };
      const measurements = game?.notebook.measurements.filter(m => m.conclusionCode.startsWith('repair:')).map(m => ({ id: m.id,
        text: `${measurementLabels[m.conclusionCode.split(':')[1]!] ?? 'Repair observation'} — ${m.readings.map(r => `${r.name}: ${r.value} ${r.unit}`).join('; ')}`, current: repairMeasurementCurrent(m, game) })) ?? [];
      const latest = (kind: string) => game && selected && duration ? [...game.notebook.measurements].reverse().find(m => repairMeasurementCurrent(m, game)
        && m.conclusionCode.startsWith(`repair:${kind}:${selected}:${String(duration)}:`))?.id ?? null : null;
      return { capture: projection.capture, view: { stage, available: playable(state) && stage !== 'unavailable', selected,
        duration: duration === 'permanent' || duration === 'temporary' ? duration : null, classification: game ? repairClassification(game) : null,
        completed: game?.world.completedObjectiveIds.includes(q(stage === 'preparation' ? 'O11' : 'O12') as never) ?? false,
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
    b.addEventListener('click', () => { if (isActive(scope) && !b.disabled && b.isConnected && body.contains(b)) action(); }, { signal: scope.abort.signal }); return b;
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
        children.push(paragraph(`Selected deployment: ${repairPlans.find(p => p.id === view.selected)?.label ?? 'none'}. Installation type: ${view.duration ?? 'not selected'}.`));
        for (const plan of repairPlans) children.push(button(scope, plan.id, plan.label, () => choose(`plan-${plan.id}`), disabled));
        children.push(button(scope, 'permanent', 'Permanent installation', () => choose('duration-permanent'), disabled),
          button(scope, 'temporary', 'Temporary installation', () => choose('duration-temporary'), disabled),
          button(scope, 'read-plan', 'Read and keep plan requirements', () => choose('read-plan'), disabled),
          paragraph('Temporary dependency: the borrowed bypass occupies the protected work corridor. Limitation: it cannot remain the permanent installation. Follow-up: install and test the permanent protected route before returning the borrowed installation.'),
          button(scope, 'maintenance', 'Record temporary dependency and follow-up', () => choose('record-maintenance'), disabled),
          paragraph('Isolation names the severed conduit as unresolved and keeps it disconnected. Recovery: return to safe preparation, repair the damaged path, measure again and repeat the endpoint test.'),
          button(scope, 'isolation', 'Record unresolved fault and recovery plan', () => choose('record-isolation'), disabled),
          button(scope, 'review', 'Review current plan', () => dispatcher.dispatch(capture({ kind: 'review-repair-plan' })), disabled),
          paragraph('WARNING: execution changes the route and makes earlier readings stale. A temporary installation remains a dependency. Deliberate isolation leaves service unresolved and cannot be saved. Before commitment, close this panel and return to preparation freely.'));
        const label = doc.createElement('label'), checkbox = doc.createElement('input'); checkbox.type = 'checkbox'; checkbox.disabled = disabled || view.reviewId === null;
        label.append(checkbox, doc.createTextNode('I understand that execution changes the route and makes earlier readings stale')); scope.controls.set('warning', checkbox); children.push(label);
        const execute = button(scope, 'execute', 'Execute reviewed plan', () => {
          if (checkbox.checked && view.reviewId) dispatcher.dispatch(capture({ kind: 'execute-repair-plan', reviewId: view.reviewId, warningAcknowledged: true }));
        }, true);
        checkbox.addEventListener('change', () => { if (isActive(scope) && checkbox.isConnected) execute.disabled = disabled || !view.reviewId || !checkbox.checked; }, { signal: scope.abort.signal }); children.push(execute);
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
