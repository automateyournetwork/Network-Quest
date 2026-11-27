// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { copySemanticAction } from './action-bus';
import type { ActionBus, ActionCapture, ActionContext, SemanticAction } from './action-bus';

export interface SemanticControl {
  /** Stable identity across renders, globally unique within this shell. */
  readonly id: string;
  readonly label: string;
  readonly action: SemanticAction;
  readonly unavailableReason?: string;
  readonly pressed?: boolean;
}
export interface SceneObjectView {
  readonly id: string;
  readonly label: string;
  readonly description: string;
  readonly actions: readonly SemanticControl[];
}
export interface EvidenceView {
  readonly id: string;
  readonly label: string;
  readonly text: string;
  readonly source: string;
  readonly freshness: 'observation' | 'current' | 'stale';
  readonly action?: SemanticControl;
}
export interface CaptionView { readonly id: string; readonly text: string; readonly speaker?: string }
export interface AppShellView {
  /** Supplied with the view; stale displayed affordances cannot target a newer world. */
  readonly context: ActionContext | null;
  readonly title: string;
  readonly description: string;
  readonly controls: readonly SemanticControl[];
  readonly objects: readonly SceneObjectView[];
  readonly evidence: readonly EvidenceView[];
  readonly captions: readonly CaptionView[];
  /** Honest adapter status, including text fallback when media is unavailable. */
  readonly presentationStatus: string;
}
export interface AppShell {
  readonly element: HTMLElement;
  /** Visual-only surface. Put interactive equivalents in the semantic view. */
  readonly presentationHost: HTMLDivElement;
  /** Owned by later inventory/notebook/dialogue modules; render never replaces it. */
  readonly panelHost: HTMLDivElement;
  /** Forward the original capture scope for presentation/status-only updates. */
  render(view: AppShellView, capture?: ActionCapture): void;
  /** Announce a completed lifecycle action without another scene preparation. */
  announce(message: string): void;
  dispose(): void;
}

const iconPaths: Readonly<Record<string, string>> = {
  walk: 'M14 3a2 2 0 1 0 0 .1M12 7l-3 5 4 3-2 6m1-14 4 5 4 1m-7 2 4 6M9 12l-5 3',
  look: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7m13 0a3 3 0 1 0-6 0 3 3 0 0 0 6 0',
  talk: 'M3 4h18v12H10l-6 5v-5H3V4m4 5h10m-10 3h7',
  use: 'm8 11 1-8h3v8l2-5h3l-1 6 3-2 2 2-4 8H8l-5-7 2-2 3 3',
  inventory: 'M4 8h16v13H4V8m4 0V4h8v4M4 12h16m-10 0v4h4v-4',
  notebook: 'M5 3h15v18H5V3m-3 4h6m-6 5h6m-6 5h6m3-10h6m-6 5h6',
  compendium: 'M2 4c4-1 7 0 10 2 3-2 6-3 10-2v16c-4-1-7 0-10 2-3-2-6-3-10-2V4m10 2v16',
};
const shortcuts: Readonly<Record<string, string>> = { walk: 'w', look: 'l', talk: 't', use: 'u', inventory: 'i', notebook: 'n', compendium: 'c' };
function shortcut(action: SemanticAction): string | undefined {
  if (action.kind === 'select-verb') return shortcuts[action.verb];
  if (action.kind === 'open-panel') return shortcuts[action.panel];
  return action.kind === 'close-panel' ? 'Escape' : undefined;
}
function editing(target: Element): boolean {
  return !!target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"], [role="searchbox"], [role="spinbutton"], [role="slider"]');
}

/**
 * Passive view and input routing, with no authored story, game mutation, save or
 * account claims. Native click unifies Enter/Space, mouse, pen and touch: no
 * pointerup/touchend duplicate action. Shortcuts are scoped to the focused shell.
 */
export function createAppShell(host: HTMLElement, bus: Pick<ActionBus, 'captureScope' | 'dispatch' | 'subscribe'>): AppShell {
  const document = host.ownerDocument;
  const prefix = `nq-${crypto.randomUUID()}`;
  const abort = new AbortController();
  let disposed = false;
  let composing = false;
  let capture = bus.captureScope(null);
  let index = 0;
  const node = <K extends keyof HTMLElementTagNameMap>(tag: K, className?: string): HTMLElementTagNameMap[K] => {
    const element = document.createElement(tag);
    if (className) element.className = className;
    return element;
  };
  const text = (element: HTMLElement, value: string) => { if (element.textContent !== value) element.textContent = value; };
  const shell = node('section', 'nq-shell');
  const title = node('h1');
  title.id = `${prefix}-title`;
  title.tabIndex = -1;
  shell.setAttribute('aria-labelledby', title.id);
  const description = node('p', 'nq-shell-description');
  const controls = node('div', 'nq-shell-controls');
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Adventure controls');
  controls.dataset['nqGroup'] = '';
  const help = node('p', 'nq-shell-help');
  help.textContent = 'Tab moves between controls. Enter or Space activates a button. Arrow keys move within a group. Letter shortcuts work while focused here, outside text fields.';
  const layout = node('div', 'nq-shell-layout');
  const scene = node('section', 'nq-shell-scene');
  const sceneTitle = node('h2');
  sceneTitle.id = `${prefix}-scene`;
  sceneTitle.textContent = 'Scene objects and exits';
  scene.setAttribute('aria-labelledby', sceneTitle.id);
  const presentationHost = node('div', 'nq-shell-presentation');
  presentationHost.setAttribute('aria-hidden', 'true');
  const presentationStatus = node('p', 'nq-shell-presentation-status');
  const objects = node('ul', 'nq-shell-objects');
  const noObjects = node('p');
  noObjects.textContent = 'No scene objects are available.';
  // The artwork and primary verbs lead the live room; the complete reading view
  // follows in the same visual/DOM order, including every text action and help.
  scene.append(presentationHost, presentationStatus, sceneTitle, description, help, noObjects, objects);
  const evidenceSection = node('section', 'nq-shell-evidence');
  const evidenceTitle = node('h2');
  evidenceTitle.id = `${prefix}-evidence`;
  evidenceTitle.textContent = 'Evidence';
  evidenceSection.setAttribute('aria-labelledby', evidenceTitle.id);
  const evidence = node('ul');
  const noEvidence = node('p');
  noEvidence.textContent = 'No evidence is supplied for this view.';
  evidenceSection.append(evidenceTitle, noEvidence, evidence);
  layout.append(scene, evidenceSection);
  const panelHost = node('div', 'nq-shell-panels');
  const captionSection = node('section', 'nq-shell-captions');
  const captionTitle = node('h2');
  captionTitle.id = `${prefix}-captions`;
  captionTitle.textContent = 'Captions';
  captionSection.setAttribute('aria-labelledby', captionTitle.id);
  const captions = node('ol');
  // Persistent readable captions, not a live region that repeats every line.
  captionSection.append(captionTitle, captions);
  const status = node('p', 'nq-shell-status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  shell.append(title, controls, layout, panelHost, captionSection, status);
  host.append(shell);

  interface ControlNodes { wrapper: HTMLDivElement; button: HTMLButtonElement; label: HTMLSpanElement; key: HTMLElement; reason: HTMLSpanElement; model: SemanticControl }
  interface ObjectNodes { element: HTMLLIElement; title: HTMLElement; description: HTMLParagraphElement; actions: HTMLDivElement }
  interface EvidenceNodes { element: HTMLLIElement; title: HTMLElement; text: HTMLParagraphElement; source: HTMLParagraphElement; freshness: HTMLParagraphElement; actions: HTMLDivElement }
  const controlNodes = new Map<string, ControlNodes>();
  const objectNodes = new Map<string, ObjectNodes>();
  const evidenceNodes = new Map<string, EvidenceNodes>();
  const captionNodes = new Map<string, HTMLLIElement>();
  const buttons = new WeakMap<HTMLButtonElement, ControlNodes>();
  const shortcutButtons = new Map<string, HTMLButtonElement>();
  const announce = (message: string) => {
    if (disposed) return;
    const changed = status.textContent !== message; text(status, message); status.tabIndex = message ? 0 : -1;
    const window = status.closest<HTMLElement>('.nq-window-active');
    // Action feedback sits below the fixed window heading. Reveal it by scrolling
    // only that window; notes/sliders keep their editing position and focus.
    if (changed && message && window && !(document.activeElement instanceof Element && editing(document.activeElement))) window.scrollTop = 0;
  };
  const unsubscribe = bus.subscribe((_action, result) => { if (result.message) announce(result.message); });

  function activate(button: HTMLButtonElement) {
    const item = buttons.get(button);
    if (!item || disposed) return;
    if (item.model.unavailableReason) { announce(item.model.unavailableReason); return; }
    try {
      const result = bus.dispatch(capture(item.model.action));
      if (result.message) announce(result.message);
    } catch { announce('This action is no longer available.'); }
  }
  shell.addEventListener('click', event => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest('button');
    if (button instanceof HTMLButtonElement && buttons.has(button)) activate(button);
  }, { signal: abort.signal });
  shell.addEventListener('compositionstart', () => { composing = true; }, { signal: abort.signal });
  shell.addEventListener('compositionend', () => { composing = false; }, { signal: abort.signal });
  shell.addEventListener('keydown', event => {
    const target = event.target;
    if (!(target instanceof Element) || event.defaultPrevented || event.isComposing || composing || event.keyCode === 229
      || event.repeat || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || editing(target)) return;
    const key = event.key === 'Escape' ? 'Escape' : event.key.toLowerCase();
    const shortcutButton = shortcutButtons.get(key);
    if (shortcutButton) { event.preventDefault(); activate(shortcutButton); return; }
    if (!(target instanceof HTMLButtonElement) || !buttons.has(target)) return;
    const group = target.closest('[data-nq-group]');
    if (!group) return;
    const choices = [...group.querySelectorAll('button')].filter(button => buttons.has(button));
    const current = choices.indexOf(target);
    let next = current;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (current + 1) % choices.length;
    else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (current - 1 + choices.length) % choices.length;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = choices.length - 1;
    else return;
    event.preventDefault();
    choices[next]?.focus();
  }, { signal: abort.signal });

  // Reuse nodes by semantic ID and avoid moving unchanged focused elements.
  function children(parent: HTMLElement, wanted: readonly HTMLElement[]) {
    let previous: ChildNode | null = null;
    for (const child of wanted) {
      const next: ChildNode | null = previous ? previous.nextSibling : parent.firstChild;
      if (next !== child) parent.insertBefore(child, next);
      previous = child;
    }
    let spare = previous ? previous.nextSibling : parent.firstChild;
    while (spare) { const next = spare.nextSibling; spare.remove(); spare = next; }
  }

  function renderControl(model: SemanticControl, allowShortcut: boolean): HTMLElement {
    let entry = controlNodes.get(model.id);
    if (!entry) {
      const wrapper = node('div', 'nq-shell-control');
      const button = node('button');
      button.type = 'button';
      const label = node('span');
      const key = node('kbd');
      key.setAttribute('aria-hidden', 'true');
      const reason = node('span', 'nq-shell-unavailable');
      reason.id = `${prefix}-reason-${++index}`;
      button.append(label, key);
      wrapper.append(button, reason);
      entry = { wrapper, button, label, key, reason, model };
      controlNodes.set(model.id, entry);
      buttons.set(button, entry);
    }
    entry.model = model;
    const iconId = model.action.kind === 'select-verb' ? model.action.verb : model.action.kind === 'open-panel' ? model.action.panel : '';
    if (shell.classList.contains('nq-framed-shell') && iconPaths[iconId] && !entry.button.querySelector('svg')) {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path'); path.setAttribute('d', iconPaths[iconId]!); svg.append(path); entry.button.prepend(svg);
    }
    text(entry.label, model.label);
    const key = allowShortcut ? shortcut(model.action) : undefined;
    entry.key.hidden = !key;
    text(entry.key, key === 'Escape' ? 'Esc' : key?.toUpperCase() ?? '');
    if (key) { shortcutButtons.set(key, entry.button); entry.button.setAttribute('aria-keyshortcuts', key === 'Escape' ? key : key.toUpperCase()); }
    else entry.button.removeAttribute('aria-keyshortcuts');
    if (model.pressed === undefined) entry.button.removeAttribute('aria-pressed');
    else entry.button.setAttribute('aria-pressed', String(model.pressed));
    entry.button.setAttribute('aria-disabled', String(!!model.unavailableReason));
    entry.reason.hidden = !model.unavailableReason;
    text(entry.reason, model.unavailableReason ?? '');
    if (model.unavailableReason) entry.button.setAttribute('aria-describedby', entry.reason.id);
    else entry.button.removeAttribute('aria-describedby');
    return entry.wrapper;
  }

  function group(parent: HTMLElement, label: string, models: readonly SemanticControl[]) {
    parent.setAttribute('role', 'group');
    parent.setAttribute('aria-label', label);
    parent.dataset['nqGroup'] = '';
    children(parent, models.map(model => renderControl(model, false)));
  }

  return {
    element: shell, presentationHost, panelHost,
    render(view, projectionCapture) {
      if (disposed) throw new Error('App shell is disposed.');
      // Validate and detach all supplied models before touching live DOM.
      const snapshot: AppShellView = structuredClone(view);
      const allControls = [...snapshot.controls, ...snapshot.objects.flatMap(object => object.actions), ...snapshot.evidence.flatMap(item => item.action ? [item.action] : [])];
      const unique = (values: readonly { id: string }[]) => values.every(value => !!value.id.trim()) && new Set(values.map(value => value.id)).size === values.length;
      if (![allControls, snapshot.objects, snapshot.evidence, snapshot.captions].every(unique)) throw new TypeError('Shell identities must be nonempty and unique.');
      const keyList = snapshot.controls.flatMap(control => { const key = shortcut(control.action); return key ? [key] : []; });
      if (new Set(keyList).size !== keyList.length) throw new TypeError('Shell shortcuts must be unambiguous.');
      for (const control of allControls) {
        if (!control.label.trim() || control.unavailableReason === '') throw new TypeError('Controls need visible labels and meaningful unavailability reasons.');
        copySemanticAction(control.action);
      }
      const focused = document.activeElement;
      const ownedFocus = focused instanceof HTMLElement && shell.contains(focused);
      capture = projectionCapture ?? bus.captureScope(snapshot.context);
      shortcutButtons.clear();
      text(title, snapshot.title);
      text(description, snapshot.description);
      text(presentationStatus, snapshot.presentationStatus);
      children(controls, snapshot.controls.map(control => renderControl(control, true)));
      noObjects.hidden = snapshot.objects.length > 0;
      children(objects, snapshot.objects.map(object => {
        let entry = objectNodes.get(object.id);
        if (!entry) {
          const element = node('li');
          const heading = node('h3');
          const description = node('p');
          const actions = node('div', 'nq-shell-object-actions');
          element.append(heading, description, actions);
          entry = { element, title: heading, description, actions };
          objectNodes.set(object.id, entry);
        }
        text(entry.title, object.label);
        text(entry.description, object.description);
        group(entry.actions, `${object.label} actions`, object.actions);
        return entry.element;
      }));
      noEvidence.hidden = snapshot.evidence.length > 0;
      children(evidence, snapshot.evidence.map(item => {
        let entry = evidenceNodes.get(item.id);
        if (!entry) {
          const element = node('li');
          const heading = node('h3');
          const detail = node('p');
          const source = node('p', 'nq-shell-source');
          const freshness = node('p', 'nq-shell-freshness');
          const actions = node('div');
          element.append(heading, detail, source, freshness, actions);
          entry = { element, title: heading, text: detail, source, freshness, actions };
          evidenceNodes.set(item.id, entry);
        }
        text(entry.title, item.label); text(entry.text, item.text); text(entry.source, `Source: ${item.source}`);
        text(entry.freshness, item.freshness === 'stale' ? 'Stale measurement — measure again before using this evidence.' : item.freshness === 'current' ? 'Current measurement' : 'Observation');
        entry.freshness.dataset['freshness'] = item.freshness;
        children(entry.actions, item.action ? [renderControl(item.action, false)] : []);
        return entry.element;
      }));
      children(captions, snapshot.captions.map(caption => {
        let element = captionNodes.get(caption.id);
        if (!element) { element = node('li'); captionNodes.set(caption.id, element); }
        text(element, caption.speaker ? `${caption.speaker}: ${caption.text}` : caption.text);
        return element;
      }));
      captionSection.hidden = snapshot.captions.length === 0;
      const prune = <T>(map: Map<string, T>, models: readonly { id: string }[]) => {
        const retained = new Set(models.map(model => model.id));
        for (const id of map.keys()) if (!retained.has(id)) map.delete(id);
      };
      prune(controlNodes, allControls); prune(objectNodes, snapshot.objects); prune(evidenceNodes, snapshot.evidence); prune(captionNodes, snapshot.captions);
      if (ownedFocus) {
        if (focused.isConnected && shell.contains(focused)) { if (document.activeElement !== focused) focused.focus(); }
        else title.focus();
      }
    },
    announce(message) { if (!disposed) announce(message); },
    dispose() {
      if (disposed) return;
      disposed = true;
      abort.abort(); unsubscribe();
      controlNodes.clear(); objectNodes.clear(); evidenceNodes.clear(); captionNodes.clear(); shortcutButtons.clear();
      shell.remove();
    },
  };
}
