// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { RiftHazardDescriptor } from '../content/endings';
import type { QualifiedId } from '../domain/types';
import { captureEncounterContext } from '../state/encounter';
import type { createRiftHazardController } from '../state/rift-hazard';
import type { ReducerState } from '../state/reducer';
import type { ActionCapture, ActionDispatcher, ActionPlan, CapturedAction } from './action-bus';
import { rejected } from './controller-store';
import type { GameplayStore } from './controller-store';

/** Trusted adapter; renderers provide only choice identity and acknowledgement. */
export function createRiftHazardPlan(options: { readonly controller: ReturnType<typeof createRiftHazardController>; readonly store: GameplayStore;
  readonly action: CapturedAction; readonly before: ReducerState }): ActionPlan {
  const { controller, store, action, before } = options;
  const game = before.runtime.game, context = action.context, input = action.input;
  if (store.getState() !== before || !game || !context || context.adventureId !== game.adventureId
    || context.attemptId !== game.world.attemptId || context.configurationRevision !== game.world.configurationRevision)
    return rejected('stale-context', 'The adventure has changed. Review the current scene again.');
  if (input.kind !== 'commit-rift-hazard' || input.warningAcknowledged !== true)
    return rejected('warning-not-acknowledged', 'Read and explicitly acknowledge the danger before choosing the unstable ledge.');
  const capture = captureEncounterContext(before);
  if (!capture) return rejected('no-preparation', 'This choice is available only at the safe preparation platform.');
  const prepared = controller.prepare(before, capture, { hazardId: input.hazardId, warningAcknowledged: true });
  if (!prepared.ok) return rejected(prepared.reason, 'This danger choice is no longer available at the preparation platform.');
  return { status: 'ready', commit() {
    const accepted = controller.commit(store, prepared.change);
    return accepted.ok ? { status: 'handled', reason: 'fictional-hazard-committed', message: 'You chose to cross the marked unstable ledge. Your account save is unchanged.' }
      : rejected(accepted.reason, 'The adventure changed before this choice could be committed.');
  } };
}

/** Optional warning fragment inside the existing repair dialog. No new menu. */
export function createRiftHazardControls(host: HTMLElement, options: {
  readonly hazard: RiftHazardDescriptor; readonly capture: ActionCapture; readonly dispatcher: Pick<ActionDispatcher, 'dispatch'>;
  readonly signal: AbortSignal; readonly isCurrent: () => boolean; readonly onReturn: () => void;
}) {
  const doc = host.ownerDocument, element = doc.createElement('div');
  const warningText = doc.createElement('p'); warningText.textContent = options.hazard.warning;
  const label = doc.createElement('label'), warning = doc.createElement('input'); warning.type = 'checkbox';
  label.append(warning, doc.createTextNode(options.hazard.acknowledgement));
  const commit = doc.createElement('button'), returnButton = doc.createElement('button'); commit.type = returnButton.type = 'button';
  commit.textContent = options.hazard.choice; commit.disabled = true; returnButton.textContent = options.hazard.safeAlternative;
  element.append(warningText, label, commit, returnButton); host.append(element);
  let retired = false;
  const active = (control: HTMLElement) => !retired && !options.signal.aborted && options.isCurrent() && element.isConnected
    && host.contains(element) && element.contains(control) && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0 && control.getClientRects().length > 0;
  warning.addEventListener('change', () => { if (active(warning)) commit.disabled = !warning.checked; }, { signal: options.signal });
  commit.addEventListener('click', () => {
    if (!active(commit) || commit.disabled || !active(warning) || !warning.checked) return;
    options.dispatcher.dispatch(options.capture({ kind: 'commit-rift-hazard', hazardId: options.hazard.id as QualifiedId, warningAcknowledged: true }));
  }, { signal: options.signal });
  returnButton.addEventListener('click', () => {
    if (!active(returnButton)) return; retired = true; element.hidden = true; options.onReturn();
  }, { signal: options.signal });
  return { element, warning, commit, returnButton, dispose() { retired = true; element.remove(); } };
}
