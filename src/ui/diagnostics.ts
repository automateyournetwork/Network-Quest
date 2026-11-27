// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { MeasurementId, ObjectiveId, QualifiedId } from '../domain/types';
import { evaluateObjective, objectiveHints } from '../state/objectives';
import type { ObjectiveInput, ObjectiveScenarioResolver } from '../state/objectives';
import { isMeasurementCurrent } from '../state/reducer';
import type { GameState } from '../state/types';
import { contextFromRuntime } from './action-bus';
import type { ActionBus, ActionCapture, ActionDispatcher, ActionPlan, CapturedAction } from './action-bus';
import { playable, reductionPlan, rejected, unavailable } from './controller-store';
import type { GameplayStore } from './controller-store';

export interface DiagnosticsView {
  readonly objectiveId: ObjectiveId;
  readonly explanation: string;
  readonly available: boolean;
  readonly completed: boolean;
  readonly alternative: { readonly id: QualifiedId; readonly label: string } | null;
  readonly measurements: readonly { readonly id: MeasurementId; readonly freshness: 'current' | 'stale'; readonly text: string; readonly eligible: boolean }[];
  readonly hints: readonly string[];
  readonly nextHintLabel: string;
}
const messages: Record<string, string> = {
  'objective-evidence-accepted': 'The recorded evidence supports this solution.',
  'objective-already-complete': 'This objective is already complete.',
  'stale-evidence': 'This reading is stale. Keep it for comparison and take a new measurement of the current path.',
  'measurement-missing': 'Take a measurement, then submit that recorded reading.',
  'measurement-provenance-mismatch': 'This reading does not describe the current selected path. Measure the current path before submitting.',
  'required-observation-missing': 'Inspect the supporting observations before submitting your evidence.',
  'prerequisite-unmet': 'Complete the earlier investigation steps before validating this objective.',
  'required-tool-or-ability-missing': 'Bring the required tool or an available equivalent ability.',
  'before-open-evidence-missing': 'Compare a recorded open-before measurement with the current result. You can return the bench to its original condition and inspect it.',
  'repeater-cannot-bridge-open': 'A repeater needs a connected path; it cannot bridge the severed cable.',
  'repeater-role-choice-missing': 'Choose what the repeater can do before validating the comparison.',
  'inspect-before-validating': 'Inspect the connection before validating the optical path.',
  'outside-physical-role': 'Physical sampling does not discover an IP address.',
  'objective-lifecycle-unavailable': 'This intervention or ending is not available in this diagnostic activity yet.',
  'objective-scenario-unavailable': 'This diagnostic activity is not available here yet.',
  'objective-room-unavailable': 'Return to the objective’s test bench to take or submit a measurement.',
  'selection-does-not-match-current-world': 'The selected configuration has changed. Review the current path.',
  'required-path-open': 'A required conductor is still open. Restore continuity before validating the path.',
  'length-exceeded': 'The channel is longer than the supplied profile allows.',
  'snr-below-profile': 'The measured signal-to-noise ratio is below the supplied threshold.',
  'required-reserve-not-met': 'The receive level has insufficient reserve for this profile.',
  'delivered-power-budget-exceeded': 'The allocation exceeds the delivered power budget.',
  'incompatible-profiles': 'The supplied physical profiles do not match; passing arithmetic cannot override incompatibility.',
  'inspect-before-changing': 'Inspect the connection before changing it.',
  'connection-defect-remains': 'The diagnosed connection defect still needs repair.',
  'path-prerequisite-fails': 'The supplied radio path is not viable. Restore the path before checking its signal-to-noise ratio.',
  'incompatible-radio-settings': 'The selected radio settings are incompatible.',
  'receiver-overload': 'The receive level is above the stated receiver maximum.',
  'below-receiver-sensitivity': 'The receive level is below the stated receiver sensitivity.',
  'unsupported-by-A': 'The selected rate and duplex are not advertised by the first endpoint.',
  'unsupported-by-B': 'The selected rate and duplex are not advertised by the second endpoint.',
  'unsupported-by-both': 'Neither endpoint advertises the selected rate and duplex.',
  'symbol-answer-differs': 'Compare each sampled symbol with the supplied bit map and try the decoding again.',
};
function feedback(reason: string, status: string) {
  return messages[reason] ?? (status === 'correct' ? 'The supplied physical checks pass within this exercise’s stated scope.'
    : status === 'content-error' ? 'The supplied exercise has a content error. No progress or attempt penalty was applied.'
      : status === 'invalid-input' ? 'Choose the required action using the current diagnostic view.'
        : 'The current physical checks do not pass. Inspect the recorded readings and the supplied compatibility requirements.');
}
/** Captured immutable intent enters the same reducer/CAS boundary as every other tool. */
export function createDiagnosticsController(options: { readonly registry: ContentRegistry; readonly store: GameplayStore; readonly bus: ActionBus; readonly resolveScenario: ObjectiveScenarioResolver }) {
  const { registry, store, bus, resolveScenario } = options;
  let projection: { game: GameState | null; capture: ActionCapture } | null = null;
  const handle = (action: CapturedAction): ActionPlan => {
    const before = store.getState(), game = before.runtime.game, intent = action.input;
    if (!playable(before) || !game) return unavailable('unavailable-state', 'Finish the current activity before using diagnostics.');
    if (intent.kind !== 'measure-objective' && intent.kind !== 'submit-objective' && intent.kind !== 'request-objective-hint') return rejected('invalid-input', 'Choose a diagnostic action.');
    const input: ObjectiveInput = intent.kind === 'measure-objective' ? { kind: 'measure', alternativeId: intent.alternativeId, id: crypto.randomUUID() as MeasurementId }
      : intent.kind === 'submit-objective' ? { kind: 'submit', alternativeId: intent.alternativeId, measurementId: intent.measurementId } : { kind: 'hint' };
    const evaluation = evaluateObjective(registry, resolveScenario, game, intent.objectiveId,
      { actionId: action.actionId, expectedVersion: action.context ?? game.world, input });
    if (evaluation.status === 'content-error' || evaluation.status === 'invalid-input') return rejected(evaluation.reasonCode, feedback(evaluation.reasonCode, evaluation.status));
    const hints = objectiveHints(registry, game, intent.objectiveId);
    const accepted = evaluation.observations.find(o => o && typeof o === 'object' && 'kind' in o && o.kind === 'objective');
    const acceptedExplanation = accepted && typeof accepted === 'object' && 'explanation' in accepted && typeof accepted.explanation === 'string' ? accepted.explanation : null;
    const message = input.kind === 'hint' ? (hints?.level === 3 ? 'All three hints remain available. Assistance never reduces a valid result.' : 'Hint revealed. Assistance is recorded separately from completion.')
      : input.kind === 'measure' && evaluation.observations.some(o => o && typeof o === 'object' && 'kind' in o && o.kind === 'objective-measurement')
        ? `Measurement recorded. ${feedback(evaluation.reasonCode, evaluation.status)}` : acceptedExplanation ?? feedback(evaluation.reasonCode, evaluation.status);
    return reductionPlan(store, action, before, { kind: 'objective', operation: { ...input, objectiveId: intent.objectiveId } }, message);
  };
  const off: (() => void)[] = [];
  try { for (const kind of ['measure-objective', 'submit-objective', 'request-objective-hint'] as const) off.push(bus.register(kind, handle)); }
  catch (error) { off.forEach(dispose => dispose()); throw error; }
  return {
    project(objectiveId: ObjectiveId): { readonly view: DiagnosticsView; readonly capture: ActionCapture } {
      const state = store.getState(), game = state.runtime.game, record = registry.record(objectiveId);
      if (!projection || projection.game !== game) projection = { game, capture: bus.captureScope(contextFromRuntime(state.runtime)) };
      const scenario = game ? resolveScenario(game, objectiveId) : null;
      const alternative = record?.kind === 'objective' ? record.alternatives.find(a => a.id === scenario?.alternativeId) : undefined;
      const hints = game ? objectiveHints(registry, game, objectiveId) : null;
      return { capture: projection.capture, view: structuredClone({ objectiveId, explanation: record?.kind === 'objective' ? record.observableOutcome : 'This objective is unavailable.',
        available: playable(state) && !!alternative, completed: game?.world.completedObjectiveIds.includes(objectiveId) ?? false,
        alternative: alternative ? { id: alternative.id as QualifiedId, label: alternative.label } : null,
        measurements: game?.notebook.measurements.filter(m => m.subjectIds.includes(objectiveId)).map(m => ({ id: m.id,
          freshness: isMeasurementCurrent(m, game.world) ? 'current' as const : 'stale' as const,
          text: m.readings.length ? m.readings.map(r => `${r.name}: ${r.value} ${r.unit}`).join('; ') : 'No numeric reading was produced by the failed prerequisite check.',
          eligible: isMeasurementCurrent(m, game.world) && !!alternative && m.conclusionCode.startsWith(`${objectiveId.split(':')[1]}:${alternative.id.split(':')[1]}:`),
        })) ?? [], hints: hints?.hints.map(h => h.text) ?? [],
        nextHintLabel: ['Show method hint', 'Show worked step', 'Show solution', 'Review revealed hints'][hints?.level ?? 0] ?? 'Review revealed hints' }) };
    },
    invalidate() { projection = null; },
    dispose() { off.forEach(dispose => dispose()); projection = null; },
  };
}

/** Mount only in the application's contextual overlay host inside the adventure frame. */
export function createDiagnosticsPanel(host: HTMLElement, dispatcher: Pick<ActionDispatcher, 'dispatch'>, onClose: () => void) {
  const doc = host.ownerDocument, element = doc.createElement('section'), heading = doc.createElement('h2'), body = doc.createElement('div');
  element.setAttribute('role', 'dialog'); element.setAttribute('aria-label', 'Diagnostics'); element.hidden = true;
  element.style.overflowWrap = 'anywhere'; element.style.maxHeight = '100%'; element.style.overflowY = 'auto';
  heading.textContent = 'Diagnostics'; heading.tabIndex = -1; element.append(heading, body); host.append(element);
  type Projection = { readonly view: DiagnosticsView; readonly capture: ActionCapture };
  interface RenderScope { readonly projection: Projection; readonly abort: AbortController; readonly buttons: Map<string, HTMLButtonElement> }
  let active: RenderScope | null = null, previous: HTMLElement | null = null, disposed = false;
  const lifetime = new AbortController();
  const isActive = (scope: RenderScope) => !disposed && active === scope && !element.hidden && element.isConnected
    && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0;
  const retire = () => {
    const wasOpen = active !== null && !element.hidden;
    active?.abort.abort(); active = null; element.hidden = true; body.replaceChildren();
    if (wasOpen && previous?.isConnected) previous.focus();
    previous = null;
  };
  const close = (scope: RenderScope) => {
    if (!isActive(scope)) return;
    // Retire synchronously: onClose may immediately open a different projection.
    retire(); onClose();
  };
  element.addEventListener('keydown', event => {
    const scope = active;
    if (scope && isActive(scope) && event.target instanceof Node && element.contains(event.target)
      && event.key === 'Escape' && !event.defaultPrevented && !event.isComposing && !event.repeat
      && !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); close(scope);
    }
  }, { signal: lifetime.signal });
  const paragraph = (text: string) => { const p = doc.createElement('p'); p.textContent = text; return p; };
  function button(scope: RenderScope, key: string, label: string, act: () => void, disabled = false) {
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = disabled;
    scope.buttons.set(key, b);
    b.addEventListener('click', () => {
      // The adventure frame may move Close into this dialog's header.
      if (isActive(scope) && !b.disabled && b.isConnected && element.contains(b)) act();
    }, { signal: scope.abort.signal });
    return b;
  }
  return { element,
    render(projection: Projection | null) {
      if (disposed) return;
      if (projection === null) { retire(); return; }
      const wasOpen = active !== null && !element.hidden;
      const unchanged = active?.projection.capture === projection.capture && JSON.stringify(active.projection.view) === JSON.stringify(projection.view);
      if (unchanged && wasOpen) return; // Retain this render's controls and scope together.
      const focusKey = wasOpen ? [...active!.buttons].find(([, button]) => button === doc.activeElement)?.[0] : undefined;
      active?.abort.abort();
      const scope: RenderScope = { projection, abort: new AbortController(), buttons: new Map() };
      active = scope; element.hidden = false;
      const { view, capture } = projection;
      const children: HTMLElement[] = [paragraph(view.explanation), paragraph(view.completed ? 'Objective complete.' : 'Completion requires recorded evidence from the current configuration.')];
      if (view.alternative) {
        const alternativeId = view.alternative.id;
        children.push(paragraph(`Proposed solution: ${view.alternative.label}. Measurement observes the current configuration.`),
          button(scope, 'measure', 'Take measurement', () => dispatcher.dispatch(capture({ kind: 'measure-objective', objectiveId: view.objectiveId, alternativeId })), !view.available));
        const list = doc.createElement('ol'); list.setAttribute('aria-label', 'Recorded measurements');
        for (const m of view.measurements) { const item = doc.createElement('li'); item.append(paragraph(`${m.freshness === 'current' ? 'Current reading' : 'Stale reading — retained for comparison'}: ${m.text}`),
          button(scope, `measurement:${m.id}`, 'Submit this reading', () => dispatcher.dispatch(capture({ kind: 'submit-objective', objectiveId: view.objectiveId, alternativeId, measurementId: m.id })), !view.available || !m.eligible || view.completed)); list.append(item); }
        children.push(list);
      }
      const hints = doc.createElement('section'); hints.setAttribute('aria-label', 'Hints');
      hints.append(paragraph('Help is available without a score or ending penalty.'), ...view.hints.map(paragraph),
        button(scope, 'hint', view.nextHintLabel, () => dispatcher.dispatch(capture({ kind: 'request-objective-hint', objectiveId: view.objectiveId })))); children.push(hints);
      children.push(button(scope, 'close', 'Close diagnostics', () => close(scope)));
      body.replaceChildren(...children);
      if (!wasOpen) { previous = doc.activeElement as HTMLElement | null; heading.focus(); }
      else if (focusKey !== undefined) {
        const replacement = scope.buttons.get(focusKey);
        if (replacement && !replacement.disabled) replacement.focus(); else heading.focus();
      }
    },
    dispose() { if (disposed) return; retire(); disposed = true; lifetime.abort(); element.remove(); },
  };
}
