// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { RiftHazardDescriptor } from '../content/endings';
import type { ActionId, AttemptId } from '../domain/types';
import { captureEncounterContext, commitEncounterChange, prepareEncounterRollback } from '../state/encounter';
import type { EncounterStore, PreparedEncounterChange } from '../state/encounter';
import type { OutcomeFeedback } from '../state/outcomes';
import type { ReducerState } from '../state/reducer';
import { riftPreparationBoundary } from '../state/rift-encounter';

export type RecoveryIntent = 'retry' | 'continue' | 'restore' | 'sign-in-to-restore';
/** Displayable intent is not authority. Only this controller's original handle works. */
export interface RecoveryCommand { readonly intent: RecoveryIntent }
export interface RecoveryConfirmation {
  readonly kind: 'failure' | 'shutdown';
  readonly title: string;
  readonly explanation: readonly string[];
  readonly confirmLabel: string;
}
export interface RecoveryAvailability { readonly retryAvailable: boolean; readonly restore: 'available' | 'sign-in' | 'unavailable' }
export type RecoveryResult = { readonly ok: true; readonly action: 'confirmation' | 'rollback' | 'cancel' | 'restore' | 'sign-in'; readonly message: string }
  | { readonly ok: false; readonly reason: string; readonly message: string };
const stale = (): RecoveryResult => ({ ok: false, reason: 'stale-context', message: 'The adventure changed. Choose recovery again from the current result.' });
const explanation = Object.freeze([
  'This discards the encounter’s world and inventory changes and returns to safe Encounter Preparation. Items and completion flags rewind together.',
  'Clues, personal notes, hint-use history and recorded outcomes stay in this tab. Earlier measurements remain visible as stale; measure again before using them as current proof.',
  'This is temporary session recovery. It sends no save request and does not replace the account save. Retained learning becomes durable only through a later eligible manual save or an opted-in safe autosave.',
  'Restore Save is different: after its own review and confirmation, it loads the saved adventure and replaces this tab’s unsaved notes, inventory and progress without merging them.',
]);

/**
 * Actual receipts authorize recovery; activity labels and renderer verdicts do
 * not. Commands capture exact immutable reducer state before any dialog opens.
 * Confirmation uses the accepted T084 rewind and one CAS. Cancel is local only.
 * Restore's trusted port must delegate to SaveDialogs.continue, which owns the
 * read/review/discard-confirm/load boundary; guest signIn opens its provider
 * choice. Neither port is called by Retry or E03 Continue.
 */
export function createRecoveryController(options: {
  readonly registry: ContentRegistry; readonly store: EncounterStore;
  readonly outcomes: { feedback(state: ReducerState): OutcomeFeedback | null };
  readonly hazards: { failure(state: ReducerState): RiftHazardDescriptor | null };
  readonly restore: { available(): boolean; continue(): void | Promise<void>; signIn(): void };
  readonly changed: () => void;
  /** Clear transient app controllers AFTER the complete swap; never invalidate the save coordinator or emit a feedback-dismissed autosave event. */
  readonly afterRollback: (state: ReducerState) => void;
}) {
  const { store } = options;
  type Prepared = { readonly kind: 'failure' | 'shutdown'; readonly change: PreparedEncounterChange };
  type Captured = { readonly before: ReducerState; readonly epoch: object; readonly prepared: Prepared | null };
  const commands = new WeakMap<RecoveryCommand, Captured>(), preparations = new WeakMap<ReducerState, Prepared>();
  let pending: { readonly view: RecoveryConfirmation; readonly capture: Captured } | null = null, epoch = {}, disposed = false;
  const current = (capture: Captured) => !disposed && capture.epoch === epoch && store.getState() === capture.before;
  const kind = (state: ReducerState): 'failure' | 'shutdown' | null => {
    if (!state.runtime.game || state.control.pending) return null;
    if (state.runtime.activity?.kind === 'terminal-failure' && options.hazards.failure(state)) return 'failure';
    if (state.runtime.activity?.kind === 'shutdown') {
      const feedback = options.outcomes.feedback(state);
      if (feedback?.status === 'correct' && feedback.outcome === 'E03' && feedback.restoredService === false) return 'shutdown';
    }
    return null;
  };
  const prepare = (state: ReducerState): Prepared | null => {
    const source = kind(state); if (!source) return null;
    const cached = preparations.get(state); if (cached) return cached;
    const context = captureEncounterContext(state); if (!context) return null;
    const result = prepareEncounterRollback(state, context, options.registry,
      { actionId: crypto.randomUUID() as ActionId, nextAttemptId: crypto.randomUUID() as AttemptId }, riftPreparationBoundary);
    if (!result.ok) return null;
    const prepared = { kind: source, change: result.change }; preparations.set(state, prepared); return prepared;
  };
  const availability = (state = store.getState()): RecoveryAvailability => {
    if (disposed || store.getState() !== state || !kind(state)) return { retryAvailable: false, restore: 'unavailable' };
    const auth = state.runtime.auth.status;
    let portAvailable = false;
    try { portAvailable = options.restore.available() === true; } catch { /* Local retry does not depend on an account service. */ }
    return { retryAvailable: !!prepare(state), restore: !portAvailable ? 'unavailable'
      : auth === 'authenticated' ? 'available' : auth === 'guest' ? 'sign-in' : 'unavailable' };
  };
  const project = (): RecoveryConfirmation | null => {
    if (pending && !current(pending.capture)) pending = null;
    return pending?.view ?? null;
  };
  return {
    availability, project,
    capture(intent: RecoveryIntent): RecoveryCommand | null {
      const before = store.getState(), available = availability(before), prepared = prepare(before);
      if (disposed || (intent === 'retry' ? prepared?.kind !== 'failure' : intent === 'continue' ? prepared?.kind !== 'shutdown'
        : intent === 'restore' ? available.restore !== 'available' : intent === 'sign-in-to-restore' ? available.restore !== 'sign-in' : true)) return null;
      const command = Object.freeze({ intent }); commands.set(command, { before, epoch, prepared }); return command;
    },
    request(command: RecoveryCommand): RecoveryResult {
      const captured = commands.get(command);
      if (!captured || !current(captured)) return stale();
      commands.delete(command);
      if (command.intent === 'restore' || command.intent === 'sign-in-to-restore') {
        const available = availability(captured.before).restore;
        if (command.intent === 'restore' ? available !== 'available' : available !== 'sign-in') return stale();
        pending = null;
        if (command.intent === 'restore') { void options.restore.continue(); return { ok: true, action: 'restore', message: 'Review the account save before confirming its load.' }; }
        options.restore.signIn(); return { ok: true, action: 'sign-in', message: 'Choose a sign-in provider. Signing in alone neither loads nor saves an adventure.' };
      }
      if (!captured.prepared || kind(captured.before) !== captured.prepared.kind) return stale();
      const source = captured.prepared.kind;
      pending = { capture: captured, view: Object.freeze({ kind: source,
        title: source === 'failure' ? 'Retry from Encounter Preparation?' : 'Continue from Encounter Preparation?', explanation,
        confirmLabel: source === 'failure' ? 'Confirm Retry from Encounter Preparation' : 'Confirm Continue to Encounter Preparation' }) };
      options.changed(); return { ok: true, action: 'confirmation', message: 'Review what rewinds and what stays in this tab.' };
    },
    confirm(view: RecoveryConfirmation): RecoveryResult {
      const selected = pending;
      if (!selected || selected.view !== view || !current(selected.capture) || !selected.capture.prepared
        || kind(selected.capture.before) !== selected.capture.prepared.kind) return stale();
      // Consume the confirmation before committing or invoking any external
      // callback. A reentrant old control cannot deliver the same action twice.
      pending = null;
      let installed: ReducerState | null = null;
      const result = commitEncounterChange({ getState: store.getState, compareAndSet(before, next) {
        const ui = next.runtime.ui;
        const candidate = ui ? { ...next, runtime: { ...next.runtime, ui: { ...ui, panel: 'none' as const,
          selectedVerb: 'walk' as const, selectedItem: null, focusedObject: null, feedback: null } } } : next;
        if (!store.compareAndSet(before, candidate)) return false;
        installed = candidate; return true;
      } }, selected.capture.prepared.change);
      if (!result.ok || !installed) { options.changed(); return stale(); }
      epoch = {}; options.afterRollback(installed); options.changed();
      return { ok: true, action: 'rollback', message: 'Returned to Encounter Preparation. Retained clues and notes are unsaved; earlier measurements are stale.' };
    },
    cancel(view: RecoveryConfirmation): RecoveryResult {
      if (!pending || pending.view !== view || !current(pending.capture)) return stale();
      pending = null; options.changed(); return { ok: true, action: 'cancel', message: 'Recovery cancelled. Your adventure is unchanged.' };
    },
    invalidate() { epoch = {}; pending = null; },
    dispose() { disposed = true; epoch = {}; pending = null; },
  };
}

/** Native contained confirmation. No timer, network, mutation or save action. */
export function createRecoveryPanel(host: HTMLElement, options: {
  readonly confirm: (view: RecoveryConfirmation) => void; readonly cancel: (view: RecoveryConfirmation) => void;
  readonly isCurrent: (view: RecoveryConfirmation) => boolean;
}) {
  const doc = host.ownerDocument, element = doc.createElement('section');
  // The adventure frame owns which one of its panels is the current modal.
  element.setAttribute('role', 'dialog'); element.hidden = true;
  Object.assign(element.style, { boxSizing: 'border-box', maxHeight: '100%', maxWidth: '100%', overflowY: 'auto', overflowWrap: 'anywhere' });
  host.append(element);
  type Scope = { readonly view: RecoveryConfirmation; readonly abort: AbortController; readonly heading: HTMLHeadingElement;
    readonly confirm: HTMLButtonElement; readonly cancel: HTMLButtonElement; submitted: boolean };
  let scope: Scope | null = null, previous: HTMLElement | null = null, disposed = false;
  const active = (s: Scope) => !disposed && scope === s && !s.abort.signal.aborted && !s.submitted && options.isCurrent(s.view)
    && host.contains(element) && element.isConnected && !element.hidden && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0;
  const usable = (s: Scope, control: HTMLElement) => active(s) && element.contains(control) && control.isConnected
    && !control.closest('[hidden], [inert]') && control.getClientRects().length > 0;
  const close = () => {
    const opened = scope !== null; scope?.abort.abort(); scope = null; element.hidden = true; element.replaceChildren();
    if (opened && previous?.isConnected && !previous.closest('[hidden], [inert]')) previous.focus(); previous = null;
  };
  return { element,
    render(view: RecoveryConfirmation | null) {
      if (disposed) return;
      if (!view) { close(); return; }
      if (scope?.view === view && active(scope)) return;
      if (!scope) previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      scope?.abort.abort();
      const heading = doc.createElement('h2'), confirm = doc.createElement('button'), cancel = doc.createElement('button');
      heading.tabIndex = -1; heading.textContent = view.title; confirm.type = cancel.type = 'button'; confirm.textContent = view.confirmLabel; cancel.textContent = 'Cancel — keep this attempt';
      confirm.dataset['recoveryControl'] = 'confirm'; cancel.dataset['recoveryControl'] = 'cancel';
      for (const control of [confirm, cancel]) { control.style.whiteSpace = 'normal'; control.style.maxWidth = '100%'; }
      const next: Scope = { view, abort: new AbortController(), heading, confirm, cancel, submitted: false }; scope = next;
      const submit = (control: HTMLButtonElement, callback: (v: RecoveryConfirmation) => void) => {
        if (!usable(next, control)) return; next.submitted = true; confirm.disabled = cancel.disabled = true; callback(view);
      };
      confirm.addEventListener('click', () => submit(confirm, options.confirm), { signal: next.abort.signal });
      cancel.addEventListener('click', () => submit(cancel, options.cancel), { signal: next.abort.signal });
      element.addEventListener('keydown', event => {
        if (!active(next) || event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey
          || !(event.target instanceof Node) || !element.contains(event.target)) return;
        if (event.key === 'Escape' && !event.shiftKey) { event.preventDefault(); event.stopPropagation(); submit(cancel, options.cancel); }
        if (event.key === 'Tab') {
          // The contained frame may append its Game control. Include it rather
          // than trapping keyboard users in the two recovery controls alone.
          const controls = [...element.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
            .filter(control => !(control as HTMLButtonElement).disabled && usable(next, control));
          const first = controls[0], last = controls.at(-1);
          if (!first || !last) { event.preventDefault(); heading.focus(); return; }
          if (event.shiftKey && (doc.activeElement === first || doc.activeElement === heading)) { event.preventDefault(); last.focus(); }
          else if (!event.shiftKey && (doc.activeElement === last || doc.activeElement === heading)) { event.preventDefault(); first.focus(); }
        }
      }, { signal: next.abort.signal });
      element.setAttribute('aria-label', view.title); element.hidden = false;
      element.replaceChildren(heading, ...view.explanation.map(text => { const p = doc.createElement('p'); p.textContent = text; return p; }), confirm, cancel);
      heading.focus();
    },
    dispose() { if (disposed) return; close(); disposed = true; element.remove(); },
  };
}
