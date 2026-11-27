// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { projectEpilogue, projectFailure } from '../content/endings';
import type { EndingsContent, EpilogueView, FailureView, RiftHazardDescriptor } from '../content/endings';
import type { ReducerState } from '../state/reducer';
import type { OutcomeFeedback } from '../state/outcomes';

export interface AcceptedNarrative {
  readonly storyKey: string;
  readonly view: EpilogueView | FailureView;
  readonly caveats: readonly string[];
}
/** Exact receipt getters are trusted composition ports, never caller verdicts. */
export function projectAcceptedNarrative(content: EndingsContent, state: ReducerState, receipts: {
  readonly outcomes: { feedback(state: ReducerState): OutcomeFeedback | null };
  readonly hazards: { failure(state: ReducerState): RiftHazardDescriptor | null };
}): AcceptedNarrative | null {
  const game = state.runtime.game, kind = state.runtime.activity?.kind;
  if (!game || state.control.pending) return null;
  const prefix = `${game.adventureId}:${game.world.attemptId}:`;
  if (kind === 'terminal-failure') {
    const receipt = receipts.hazards.failure(state);
    const view = receipt && projectFailure(content, receipt.id);
    return view ? Object.freeze({ storyKey: prefix + view.hazardId, view, caveats: Object.freeze([]) }) : null;
  }
  if (kind !== 'cutscene' && kind !== 'shutdown') return null;
  const feedback = receipts.outcomes.feedback(state), event = game.outcomeHistory.at(-1);
  if (!feedback || feedback.status !== 'correct' || !event || event.outcome !== feedback.outcome
    || (event.outcome === 'E03' ? kind !== 'shutdown' : kind !== 'cutscene')) return null;
  const view = projectEpilogue(content, game, event);
  return view ? Object.freeze({ storyKey: prefix + event.id, view, caveats: Object.freeze(feedback.caveats.map(c => c.text)) }) : null;
}

export type EpilogueIntent = 'continue' | 'retry' | 'restore' | 'sign-in-to-restore';
export interface EpilogueProjection<Command> {
  /** Adventure/attempt/event identity; a new attempt always resets the scene. */
  readonly storyKey: string;
  readonly view: EpilogueView | FailureView;
  readonly content: EndingsContent;
  /** Exact caveats from the accepted outcome controller, never inferred here. */
  readonly caveats: readonly string[];
  readonly retryAvailable: boolean;
  readonly restore: 'available' | 'sign-in' | 'unavailable';
  /** The owner captures an exact current state/action scope for every render. */
  readonly capture: (intent: EpilogueIntent) => Command;
}

/**
 * Contained text presentation only. The owner admits accepted outcome/failure
 * receipts, executes safe Continue/recovery and retires this projection after
 * any state replacement. Each new projection object retires all old captures,
 * even when its game/text are identical (for example after an auth refresh).
 * Skip/Escape/Replay only affect the narrative; results and recovery stay visible.
 */
export function createEpiloguePanel<Command>(host: HTMLElement, options: {
  readonly dispatch: (command: Command) => void;
  readonly isCurrent: (projection: EpilogueProjection<Command>) => boolean;
}) {
  const doc = host.ownerDocument, element = doc.createElement('section'), heading = doc.createElement('h2');
  let ownerHost = host;
  // The adventure frame assigns aria-modal to its single selected window.
  element.setAttribute('role', 'dialog'); element.hidden = true;
  Object.assign(element.style, { boxSizing: 'border-box', maxHeight: '100%', maxWidth: '100%', overflowY: 'auto', overflowWrap: 'anywhere' });
  heading.tabIndex = -1; host.append(element);
  interface Scope {
    readonly projection: EpilogueProjection<Command>; readonly abort: AbortController;
    readonly buttons: Map<string, HTMLButtonElement>; readonly scene: HTMLDivElement;
    submitted: boolean;
  }
  let active: Scope | null = null, previous: HTMLElement | null = null, disposed = false;
  let remountPresentation: { scrollTop: number; focusInside: boolean; focusKey: string | undefined } | null = null;
  const lifetime = new AbortController();
  const current = (scope: Scope) => !disposed && active === scope && !scope.abort.signal.aborted && options.isCurrent(scope.projection)
    && ownerHost.contains(element) && element.isConnected && !element.hidden && !element.closest('[hidden], [inert]') && element.getClientRects().length > 0;
  const usable = (scope: Scope, control: HTMLElement) => current(scope) && element.contains(control) && control.isConnected
    && !control.closest('[hidden], [inert]') && control.getClientRects().length > 0;
  const paragraph = (text: string) => { const p = doc.createElement('p'); p.textContent = text; return p; };
  const retire = () => {
    const open = active !== null && !element.hidden; active?.abort.abort(); active = null; element.hidden = true; element.replaceChildren();
    if (open && previous?.isConnected && !previous.closest('[hidden], [inert]')) previous.focus(); previous = null; remountPresentation = null;
  };
  const toggleScene = (scope: Scope, hidden: boolean) => {
    if (!current(scope)) return;
    scope.scene.hidden = hidden;
    const skip = scope.buttons.get('skip')!, replay = scope.buttons.get('replay')!;
    skip.hidden = hidden; replay.hidden = !hidden;
    (hidden ? replay : skip).focus();
  };
  const button = (scope: Scope, key: string, label: string, action: () => void, disabled = false) => {
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.disabled = disabled;
    b.dataset['epilogueControl'] = key; b.style.whiteSpace = 'normal'; b.style.maxWidth = '100%';
    scope.buttons.set(key, b);
    b.addEventListener('click', () => { if (usable(scope, b) && !b.disabled) action(); }, { signal: scope.abort.signal });
    return b;
  };
  element.addEventListener('keydown', event => {
    const scope = active;
    if (!scope || !current(scope) || event.defaultPrevented || event.isComposing || event.repeat || event.ctrlKey || event.metaKey || event.altKey
      || !(event.target instanceof Node) || !element.contains(event.target)) return;
    if (event.key === 'Escape' && !event.shiftKey) {
      event.preventDefault(); event.stopPropagation(); if (!scope.scene.hidden) toggleScene(scope, true);
    } else if (event.key === 'Tab') {
      // Include frame-owned controls such as Game when this fragment is mounted
      // in the real contained adventure; they must remain keyboard reachable.
      const focusable = [...element.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
        .filter(control => !(control as HTMLButtonElement).disabled && usable(scope, control));
      const first = focusable[0], last = focusable.at(-1);
      if (!first || !last) { event.preventDefault(); heading.focus(); return; }
      if (event.shiftKey && (doc.activeElement === first || doc.activeElement === heading)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && (doc.activeElement === last || doc.activeElement === heading)) { event.preventDefault(); first.focus(); }
    }
  }, { signal: lifetime.signal });
  return { element,
    /** Trusted shell replacement preserves presentation while retiring commands. */
    mount(nextHost: HTMLElement) {
      if (disposed || nextHost.ownerDocument !== doc) return;
      if (active && !remountPresentation) remountPresentation = { scrollTop: element.scrollTop,
        focusInside: element.contains(doc.activeElement), focusKey: [...active.buttons].find(([, b]) => b === doc.activeElement)?.[0] };
      active?.abort.abort(); ownerHost = nextHost; nextHost.append(element);
    },
    render(projection: EpilogueProjection<Command> | null) {
      if (disposed) return;
      if (!projection) { retire(); return; }
      // Same object = same capture lifetime. Identical text with a NEW object
      // must still replace old commands after auth/UI/persistence state changes.
      if (active?.projection === projection && current(active)) return;
      const open = active !== null && !element.hidden;
      const sameStory = open && active!.projection.storyKey === projection.storyKey
        && JSON.stringify(active!.projection.view) === JSON.stringify(projection.view)
        && JSON.stringify(active!.projection.caveats) === JSON.stringify(projection.caveats);
      const sceneHidden = sameStory && active!.scene.hidden;
      const scrollTop = sameStory ? remountPresentation?.scrollTop ?? element.scrollTop : 0;
      const focusInside = remountPresentation?.focusInside ?? element.contains(doc.activeElement);
      const focusKey = sameStory ? remountPresentation?.focusKey ?? [...active!.buttons].find(([, b]) => b === doc.activeElement)?.[0] : undefined;
      remountPresentation = null;
      if (!open) previous = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
      active?.abort.abort();
      const scene = doc.createElement('div'); scene.dataset['epilogueScene'] = '';
      const scope: Scope = { projection, abort: new AbortController(), buttons: new Map(), scene, submitted: false }; active = scope;
      const { view, content } = projection;
      heading.textContent = view.title; element.setAttribute('aria-label', view.title); element.hidden = false;
      for (const line of view.scene) scene.append(paragraph(line));
      const narrativeControls = doc.createElement('div');
      const skip = button(scope, 'skip', content.controls.skip, () => toggleScene(scope, true));
      const replay = button(scope, 'replay', content.controls.replay, () => toggleScene(scope, false));
      scene.hidden = sceneHidden; skip.hidden = sceneHidden; replay.hidden = !sceneHidden;
      narrativeControls.append(skip, replay);
      const result = doc.createElement('div'); result.dataset['epilogueResult'] = '';
      if (view.kind === 'ending') {
        result.append(paragraph(view.summary));
        for (const caveat of projection.caveats) result.append(paragraph(caveat));
        for (const line of view.paragraphs) result.append(paragraph(line));
        result.append(paragraph(view.continuation));
      } else result.append(paragraph(view.cause));
      const recovery = view.kind === 'failure' || view.outcome === 'E03';
      if (recovery) {
        result.append(paragraph(content.recovery.retry), paragraph(content.recovery.restore), paragraph(content.recovery.save));
        if (projection.restore === 'sign-in') result.append(paragraph(content.recovery.guest));
        if (!projection.retryAvailable) result.append(paragraph('No in-memory encounter preparation is available in this session.'));
        if (projection.restore === 'unavailable') result.append(paragraph('Account save access is unavailable right now.'));
      }
      const actions = doc.createElement('div'); actions.setAttribute('aria-label', 'Next action');
      const command = (intent: EpilogueIntent, label: string, disabled = false) => {
        const captured = projection.capture(intent);
        return button(scope, intent, label, () => {
          if (scope.submitted) return;
          // Synchronous latch prevents duplicate UI delivery. A rejected action
          // is reprojected by its owner with fresh state/context to retry.
          scope.submitted = true;
          for (const [key, b] of scope.buttons) if (key !== 'skip' && key !== 'replay') b.disabled = true;
          options.dispatch(captured);
        }, disabled);
      };
      if (view.kind === 'ending') actions.append(command('continue', content.controls.continue, view.outcome === 'E03' && !projection.retryAvailable));
      else actions.append(command('retry', content.controls.retry, !projection.retryAvailable));
      if (recovery) actions.append(projection.restore === 'sign-in'
        ? command('sign-in-to-restore', content.controls.signIn)
        : command('restore', content.controls.restore, projection.restore !== 'available'));
      element.replaceChildren(heading, scene, narrativeControls, result, actions);
      element.scrollTop = scrollTop;
      if (sameStory) {
        const replacement = focusKey && scope.buttons.get(focusKey);
        if (replacement && !replacement.disabled && !replacement.hidden) replacement.focus({ preventScroll: true });
        else if (focusInside) heading.focus({ preventScroll: true });
      } else heading.focus();
    },
    dispose() { if (disposed) return; retire(); disposed = true; lifetime.abort(); element.remove(); },
  };
}
