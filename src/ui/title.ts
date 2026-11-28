// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { appendCredits } from './credits';
import type { AdventureId, ObjectiveId } from '../domain/types';
import type { ReducerState } from '../state/reducer';
import type { SaveSummary } from '../state/types';

export type TitleAction = 'new' | 'confirm-new' | 'cancel' | 'continue' | 'settings' | 'credits' | 'save' | 'decline' | 'google' | 'github';
type TitlePanel = 'none' | 'confirm-new' | 'settings' | 'credits' | 'invitation';
export interface TitleView {
  readonly hasAdventure: boolean; readonly guest: boolean; readonly identity: string; readonly panel: TitlePanel;
  readonly slot: SaveSummary | null | undefined; readonly continueAvailable: boolean; readonly providersAvailable: boolean; readonly message: string;
}
/** Lifecycle operations are closed application intents, never renderer state patches. */
export function createTitleController(options: {
  readonly getState: () => ReducerState; readonly start: (expected: ReducerState) => boolean; readonly changed: () => void;
  readonly services?: { readonly available: boolean; save(): void; continue(): void; signIn(provider: 'google' | 'github'): void };
}) {
  let panel: TitlePanel = 'none', confirmation: ReducerState | null = null, declined: AdventureId | null = null, message = '';
  const project = (): TitleView => {
    const { runtime } = options.getState(), guest = runtime.auth.status === 'guest', game = runtime.game;
    const offer = guest && !!game && game.adventureId !== declined && game.world.completedObjectiveIds.includes('spec001:O02' as ObjectiveId)
      && runtime.ui?.panel === 'none' && runtime.activity?.kind === 'stable-exploration';
    return { hasAdventure: !!game, guest, identity: runtime.auth.status === 'authenticated' ? `${runtime.auth.displayName} (${runtime.auth.provider})` : 'Guest',
      panel: panel === 'none' && offer ? 'invitation' : panel, slot: runtime.persistence.knownSlot,
      continueAvailable: !!options.services?.available && runtime.auth.status === 'authenticated', providersAvailable: !!options.services?.available, message };
  };
  return { project,
    act(action: TitleAction) {
      const before = options.getState(), runtime = before.runtime;
      const start = () => {
        if (options.start(before)) { panel = 'none'; confirmation = null; declined = null; message = ''; }
        else { panel = 'none'; confirmation = null; message = 'The adventure changed. Choose New Adventure again.'; }
      };
      switch (action) {
        case 'new':
          if (runtime.persistence.pendingRequest || runtime.persistence.status === 'saving' || !['guest', 'authenticated'].includes(runtime.auth.status)) {
            message = 'Resolve the current account operation before starting another adventure.'; break;
          }
          if (runtime.game || runtime.persistence.knownSlot || runtime.auth.status === 'authenticated') { panel = 'confirm-new'; confirmation = before; message = ''; }
          else start();
          break;
        case 'confirm-new':
          if (panel !== 'confirm-new' || confirmation !== before) { panel = 'none'; confirmation = null; message = 'The adventure changed. Choose New Adventure again.'; }
          else start();
          break;
        case 'cancel': panel = 'none'; confirmation = null; message = ''; break;
        case 'continue':
          if (options.services?.available) { panel = 'none'; options.services.continue(); }
          else message = 'No confirmed account save is available to continue. Choose New Adventure to play as a guest.';
          break;
        case 'settings': case 'credits': panel = action; message = ''; break;
        case 'save':
          if (!runtime.game) { message = 'Start an adventure first.'; break; }
          if (before.control.pending || !['stable-exploration', 'safe-preparation', 'safe-continue'].includes(runtime.activity?.kind ?? '')) { message = 'Finish the current activity before saving.'; break; }
          if (runtime.auth.status === 'guest') { panel = 'invitation'; message = ''; }
          else if (options.services?.available) { panel = 'none'; options.services.save(); }
          else message = 'Account saving is unavailable on this connection. This adventure remains in memory.';
          break;
        case 'decline': declined = runtime.game?.adventureId ?? null; panel = 'none'; message = ''; break;
        case 'google': case 'github':
          if (options.services?.available) { declined = runtime.game?.adventureId ?? null; panel = 'none'; options.services.signIn(action); }
          else message = 'Provider sign-in is unavailable on this connection. Continue as guest to keep playing in this session.';
          break;
      }
      options.changed();
    },
    /** Call after a restore/logout/new lifecycle installation, alongside bus invalidation. */
    invalidate() { panel = 'none'; confirmation = null; declined = null; message = ''; },
  };
}

/** Native controls preserve their nodes and focus through status-only redraws. */
export function createTitlePanel(host: HTMLElement, act: (action: TitleAction) => void) {
  const doc = host.ownerDocument, abort = new AbortController(), element = doc.createElement('section');
  element.className = 'nq-shell nq-menu'; element.setAttribute('aria-label', 'Adventure menu');
  const heading = doc.createElement('h1'); heading.textContent = 'Network Quest';
  const subtitle = doc.createElement('p'); subtitle.textContent = 'The Underworld — begin a physical investigation.';
  const identity = doc.createElement('p'), controls = doc.createElement('div'), message = doc.createElement('p'); controls.className = 'nq-shell-controls';
  message.setAttribute('aria-live', 'polite');
  const button = (label: string, action: TitleAction) => { const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', () => act(action), { signal: abort.signal }); return b; };
  const newAdventure = button('New Adventure', 'new'), continueButton = button('Continue', 'continue'), save = button('Save', 'save');
  continueButton.setAttribute('aria-disabled', 'true'); continueButton.setAttribute('aria-describedby', 'continue-unavailable');
  const continueReason = doc.createElement('p'); continueReason.id = 'continue-unavailable';
  controls.append(newAdventure, continueButton, button('Settings', 'settings'), button('Credits', 'credits'), save);
  // The asynchronously resolved identity may wrap onto several lines.
  element.append(heading, subtitle, controls, identity, continueReason, message);
  const panels = new Map<Exclude<TitlePanel, 'none'>, { element: HTMLElement; heading: HTMLHeadingElement }>();
  const makePanel = (key: Exclude<TitlePanel, 'none'>, name: string, paragraphs: readonly string[]) => {
    const section = doc.createElement('section'), title = doc.createElement('h2'); section.setAttribute('role', 'dialog'); section.setAttribute('aria-label', name); section.hidden = true;
    title.textContent = name; title.tabIndex = -1; section.append(title);
    for (const text of paragraphs) { const p = doc.createElement('p'); p.textContent = text; section.append(p); }
    panels.set(key, { element: section, heading: title }); element.append(section); return section;
  };
  const warning = makePanel('confirm-new', 'Start a new adventure?', [
    'Starting again clears this adventure and its unsaved notes from this tab. Cancel keeps everything as it is.',
    'A new adventure starts in memory. It does not replace an account save. A future replacement requires a separate review and confirmation. Autosave stays off.',
  ]);
  const summary = doc.createElement('p'); warning.append(summary, button('Start new adventure', 'confirm-new'), button('Cancel', 'cancel'));
  const invitation = makePanel('invitation', 'Sign in to save', [
    'Sign in to save your adventure.', 'Google and GitHub are separate accounts. Your adventure stays in this tab while you sign in. Closing or reloading this tab loses unsaved guest progress.',
  ]);
  const providers: HTMLButtonElement[] = [];
  for (const [label, action] of [['Google', 'google'], ['GitHub', 'github']] as const) { const control = button(label, action); providers.push(control); invitation.append(control); }
  invitation.append(button('Continue as guest', 'decline'));
  const settings = makePanel('settings', 'Settings', ['Autosave is off until explicitly enabled for your account. Manual saves use one account slot.',
    'All dialogue is readable as text. Open Sound and reading for audio levels, replay, captions, text size and reduced motion. Native keyboard controls and browser zoom remain available.']);
  const presentationHost = doc.createElement('div');
  settings.append(button('Close settings', 'cancel'), presentationHost);
  const credits = makePanel('credits', 'Credits', []);
  credits.append(button('Close credits', 'cancel'));
  appendCredits(credits);
  host.append(element); let shown: TitlePanel = 'none', returnFocus: HTMLElement | null = null;
  element.addEventListener('keydown', event => {
    if (event.key === 'Escape' && shown !== 'none' && !event.repeat && !event.isComposing && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); act(shown === 'invitation' ? 'decline' : 'cancel');
    }
  }, { signal: abort.signal });
  return { element, presentationHost, render(view: TitleView) {
    element.dataset['adventure'] = String(view.hasAdventure);
    heading.hidden = view.hasAdventure; subtitle.hidden = view.hasAdventure; save.hidden = !view.hasAdventure;
    continueButton.textContent = view.hasAdventure ? 'Restore Save' : 'Continue';
    continueButton.setAttribute('aria-disabled', String(!view.continueAvailable));
    continueReason.textContent = view.continueAvailable ? 'Continue reads your one account save. Loading warns before discarding the current adventure.' : 'Sign in to review your account save. Guest progress exists only in this tab.';
    for (const control of providers) control.setAttribute('aria-disabled', String(!view.providersAvailable));
    identity.textContent = view.guest ? 'Guest — progress is only in this session.' : view.identity;
    message.textContent = view.message;
    summary.textContent = view.slot ? `Confirmed account save: ${view.slot.episodeId}; ${view.slot.roomId}; ${view.slot.savedAt}; outcome: ${view.slot.outcome ?? 'in progress'}.` : 'No account save has been loaded or replaced.';
    const previous = shown; shown = view.panel;
    for (const [key, panel] of panels) panel.element.hidden = key !== shown;
    if (shown !== 'none' && previous !== shown) { if (doc.activeElement instanceof HTMLElement) returnFocus = doc.activeElement; panels.get(shown)!.heading.focus(); }
    else if (shown === 'none' && previous !== 'none' && returnFocus?.isConnected) returnFocus.focus();
  }, dispose() { abort.abort(); element.remove(); } };
}
