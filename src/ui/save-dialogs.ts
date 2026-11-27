// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { AccountService, AccountState } from '../services/account';
import type { ApiFailure, GameApi, Session } from '../services/game-api';
import type { SaveCoordinator, SaveCoordinatorFailure, SaveCoordinatorStore, SaveCoordinatorView, SaveSlotReview, SaveWriteResult } from '../services/save-coordinator';
import type { AuthProvider, ClientGeneration, CsrfToken, RuntimeState, SaveSummary, ServerTimestamp } from '../state/types';

export type SaveDialogAction = 'cancel' | 'confirm-adopt' | 'load' | 'confirm-load' | 'replace' | 'confirm-replace' | 'review' | 'retry' | 'open-tab' | 'check-session' | 'google' | 'github' | 'reauth';
type Panel = 'none' | 'signin' | 'adopt' | 'choice' | 'confirm-load' | 'confirm-replace' | 'blocked' | 'conflict' | 'recovery';
export interface SaveDialogsView {
  readonly panel: Panel; readonly status: string; readonly message: string; readonly summary: SaveSummary | null;
  readonly identity: string; readonly account: AccountState | null; readonly busy: boolean; readonly available: boolean;
}
const failureMessage = (error?: ApiFailure): string => error?.status === 401 || error?.kind === 'session-required'
  ? 'Sign-in expired. Your adventure remains in this tab. Sign in again before saving.'
  : error?.status === 503 ? 'Account service is unavailable. Keep playing in this tab; progress is not confirmed saved.'
  : error?.status === 429 ? 'The service needs a pause. Try again later; the saved slot is unchanged by this response.'
  : 'The save could not be confirmed. Keep this tab open. Retry the same operation to check its outcome.';

/** All decisions are volatile. The application owns scene/controller installation.
 * A review is never reconstructed from its public summary or from a display label. */
export function createSaveDialogsController(options: {
  readonly api: GameApi | null; readonly account: AccountService | null; readonly coordinator: SaveCoordinator | null;
  readonly store: SaveCoordinatorStore; readonly changed: () => void; readonly invalidateGameplay: () => void;
  readonly restore: (review: SaveSlotReview, view: SaveCoordinatorView) => boolean;
}) {
  const { api, account, coordinator, store } = options;
  let panel: Panel = 'none', message = '', epoch = 0, disposed = false, loading = false, loginActive = false;
  let previousAuth: Extract<RuntimeState['auth'], { status: 'guest' | 'authenticated' }> | null = null;
  let reviewed: { review: SaveSlotReview; view: SaveCoordinatorView } | null = null;
  const changed = () => { if (!disposed) options.changed(); };
  const current = (operation: number) => !disposed && operation === epoch;
  const validReview = () => !!reviewed && !!coordinator?.isCurrentView(reviewed.view) && coordinator.isCurrentReview(reviewed.review);
  const staleReview = () => { reviewed = null; panel = 'none'; message = 'The adventure or account changed. Review the current save again.'; changed(); };
  const bindCurrentSession = (settings: { knownSlot?: SaveSummary | null | undefined; autosaveOff?: boolean } = {}): boolean => {
    if (!api || !coordinator || disposed || api.session?.state !== 'authenticated') return false;
    const auth = store.getState().runtime.auth;
    if (auth.status !== 'authenticated' || auth.csrfToken !== api.session.csrfToken) return false;
    if (!coordinator.bindSession({ clientGeneration: auth.clientGeneration, apiGeneration: api.capture() })) return false;
    const before = store.getState();
    return store.compareAndSet(before, { ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence,
      knownSlot: settings.knownSlot === undefined ? api.session.saveSummary : settings.knownSlot,
      autosaveEnabled: settings.autosaveOff ? false : before.runtime.persistence.autosaveEnabled } } });
  };
  const invalidateView = () => {
    epoch++; loginActive = false; previousAuth = null; reviewed = null; loading = false; panel = 'none'; message = '';
    account?.invalidateView(); coordinator?.invalidateView();
  };
  /**
   * After an in-session encounter rewind, retire only the obsolete adventure
   * review and its outstanding UI callbacks. Keep account identity, coordinator
   * binding, pending write receipts and ordinary autosave permission intact.
   * An explicitly active provider flow remains visible and unconfirmed; this
   * operation neither cancels it nor treats it as authentication success.
   */
  const retireAdventureReview = () => {
    if (disposed) return;
    epoch++; reviewed = null; loading = false;
    panel = loginActive ? 'signin' : 'none';
    message = loginActive ? 'Sign-in is still pending. Returning to preparation has neither loaded nor saved an adventure.' : '';
    changed();
  };
  const adoptVerifiedSession = (session: Session, generation: ClientGeneration): boolean => {
    if (disposed || !api || !api.isCurrent(generation) || api.session !== session) return false;
    const before = store.getState();
    if (before.runtime.auth.clientGeneration >= Number.MAX_SAFE_INTEGER) return false;
    // Before every account view change, including identical provider/name labels.
    invalidateView(); options.invalidateGameplay();
    const currentState = store.getState(), nextGeneration = (before.runtime.auth.clientGeneration + 1) as ClientGeneration;
    const auth: RuntimeState['auth'] = session.state === 'guest' ? { status: 'guest', csrfToken: session.csrfToken as CsrfToken, clientGeneration: nextGeneration }
      : { status: 'authenticated', provider: session.provider, displayName: session.displayName, expiresAt: session.expiresAt as ServerTimestamp,
        csrfToken: session.csrfToken as CsrfToken, clientGeneration: nextGeneration };
    if (!store.compareAndSet(currentState, { ...currentState, runtime: { ...currentState.runtime, auth } })) return false;
    if (session.state === 'authenticated' && !bindCurrentSession({ autosaveOff: !!currentState.runtime.game
      && currentState.runtime.game.adventureId.toLowerCase() !== session.saveSummary?.adventureId.toLowerCase() })) return false;
    message = session.state === 'authenticated' ? `Signed in as ${session.displayName} (${session.provider}). Choose Save or Continue to review this account's slot.`
      : 'Guest — progress is only in this session.';
    changed(); return true;
  };
  const bootstrap = async () => {
    if (!api || disposed) { message = 'Account saving requires HTTPS. You can play as a guest in this tab.'; changed(); return; }
    if (store.getState().runtime.persistence.pendingRequest) { panel = 'recovery'; message = 'Resolve the pending save first. A session check cannot discard its unknown outcome.'; changed(); return; }
    const operation = ++epoch; loading = true; changed();
    const result = await api.getSession();
    if (!current(operation)) return;
    loading = false;
    if (!result.ok) { message = failureMessage(result); changed(); return; }
    if (!api.isCurrent(result.generation) || api.session !== result.data) return;
    adoptVerifiedSession(result.data, result.generation);
  };
  const handleFailure = (result: SaveCoordinatorFailure) => {
    if (result.reason === 'stale' || result.reason === 'disposed') return;
    if (coordinator?.state.kind === 'conflict' || result.reason === 'reconciliation-required') {
      reviewed = null; panel = 'conflict'; message = 'The server save changed. Review it before choosing whether to load or replace it.';
    } else if (store.getState().runtime.persistence.pendingRequest) { panel = 'recovery'; message = failureMessage(result.error); }
    else if (result.reason === 'unsafe') { panel = 'none'; message = 'Finish the current activity before saving. The previous account save remains available.'; }
    else if (result.error?.status === 403) { panel = 'signin'; message = 'Check your current session before reviewing the account save again. Your progress stays in this tab.'; }
    else if (result.reason === 'session-required' || result.error?.status === 401) { panel = 'signin'; message = 'Sign in to review and save this adventure. Your current progress stays in this tab.'; }
    else { panel = 'none'; message = result.error ? failureMessage(result.error) : 'The save is not ready. Review the account slot again.'; }
    changed();
  };
  const finishWrite = (result: SaveWriteResult, operation: number, view: SaveCoordinatorView) => {
    if (!current(operation) || !coordinator?.isCurrentView(view)) return;
    if (!result.ok) { handleFailure(result); return; }
    if (result.view !== view || !coordinator.isCurrentView(result.view)) return;
    reviewed = null; panel = result.current ? 'none' : 'conflict';
    message = result.current ? '' : 'That operation committed, but the server now has a later save. Review the current server save.'; changed();
  };
  const write = async (replacement: boolean) => {
    if (!validReview() || !reviewed || !coordinator) { staleReview(); return; }
    const { review, view } = reviewed, operation = epoch;
    if (review.read && review.read.status !== 'ready') return;
    // No await or UI callback may separate the final consent check and effect.
    if (replacement && !coordinator.authorizeReplacement(review)) { staleReview(); return; }
    if (!coordinator.isCurrentView(view) || !coordinator.isCurrentReview(review)) { staleReview(); return; }
    finishWrite(await coordinator.save('manual'), operation, view);
  };
  const load = () => {
    if (!validReview() || !reviewed || reviewed.review.read?.status !== 'ready' || !reviewed.review.summary) { staleReview(); return; }
    const candidate = reviewed;
    if (!coordinator!.isCurrentView(candidate.view) || !coordinator!.isCurrentReview(candidate.review)) { staleReview(); return; }
    if (!options.restore(candidate.review, candidate.view)) { staleReview(); return; }
    panel = 'none'; message = `Loaded the confirmed server adventure from ${candidate.review.summary!.savedAt}. ${candidate.review.read?.status === 'ready' ? candidate.review.read.explanations.join(' ') : ''}`.trim(); changed();
  };
  const chooseLoad = () => {
    if (!validReview() || reviewed?.review.read?.status !== 'ready') { staleReview(); return; }
    if (store.getState().runtime.game) { panel = 'confirm-load'; message = ''; changed(); } else load();
  };
  const reviewSlot = async (intent: 'save' | 'continue' | 'review') => {
    if (disposed) return;
    if (!coordinator || !coordinator.captureView()) { panel = 'signin'; message = 'Sign in to review your account save. Current guest progress remains in this tab.'; changed(); return; }
    if (store.getState().runtime.persistence.pendingRequest) { panel = 'recovery'; message = 'A previous save outcome is still unknown. Retry that operation before reading or writing another save.'; changed(); return; }
    const operation = epoch, view = coordinator.captureView()!;
    const result = await coordinator.readSlot();
    if (!current(operation) || !coordinator.isCurrentView(view)) return;
    if (!result.ok) { handleFailure(result); return; }
    if (result.view !== view || !coordinator.isCurrentReview(result.review)) { staleReview(); return; }
    reviewed = { review: result.review, view };
    if (result.review.read && result.review.read.status !== 'ready') {
      panel = 'blocked'; message = result.review.read.status === 'unsupported' ? 'This save needs a compatible game update. Its original data is preserved; loading and overwriting are blocked.'
        : 'This save could not be safely loaded. Its original data is preserved; loading and overwriting are blocked.'; changed(); return;
    }
    if (!result.review.summary) {
      if (intent === 'continue' || !store.getState().runtime.game) { panel = 'none'; message = 'This account has no saved adventure. Choose New Adventure to begin.'; }
      else { panel = 'adopt'; message = ''; }
      changed(); return;
    }
    if (intent === 'continue') { chooseLoad(); return; }
    if (intent === 'review' || coordinator.state.kind === 'conflict' || result.review.summary.adventureId.toLowerCase() !== store.getState().runtime.game?.adventureId.toLowerCase()) {
      panel = 'choice'; message = ''; changed(); return;
    }
    await write(false);
  };
  const signIn = async (provider: AuthProvider) => {
    if (disposed || !account || !api) { message = 'Account sign-in is unavailable on this connection. Keep playing as a guest.'; changed(); return; }
    if (store.getState().runtime.persistence.pendingRequest && panel !== 'signin') { panel = 'recovery'; message = 'A previous save outcome is unknown. Retry it, or explicitly choose Sign in again and review the server slot.'; changed(); return; }
    const currentAuth = store.getState().runtime.auth;
    const auth = loginActive && currentAuth.status === 'authenticating' && previousAuth ? previousAuth : currentAuth;
    if (auth.status !== 'guest' && auth.status !== 'authenticated') return;
    // Explicit provider action abandons only this old view, never asserts that a
    // pending write failed. A later account must review the actual server slot.
    invalidateView(); options.invalidateGameplay(); previousAuth = auth; loginActive = true; panel = 'signin';
    const before = store.getState();
    store.compareAndSet(before, { ...before, runtime: { ...before.runtime, auth: { status: 'authenticating', provider, purpose: 'login', previous: auth, clientGeneration: auth.clientGeneration } } });
    changed(); await account.beginSignIn(provider);
  };
  const cancel = () => {
    if (disposed) return;
    epoch++; loading = false;
    if (loginActive) {
      const previous = previousAuth; loginActive = false; previousAuth = null; account?.cancel();
      const before = store.getState();
      if (previous && before.runtime.auth.status === 'authenticating') store.compareAndSet(before, { ...before, runtime: { ...before.runtime, auth: previous } });
      // A cancelled provider roundtrip does not prove same-account continuity.
      // A future explicit session check/flow must rebind before any save.
    }
    coordinator?.keepPlaying(); panel = 'none'; reviewed = null; message = ''; changed();
  };
  const unsubscribeAccount = account?.subscribe(state => {
    if (!loginActive || disposed) return;
    if (state.kind === 'session-observed') {
      const generation = api!.capture();
      if (api!.session !== state.session || !api!.isCurrent(generation)) return;
      const hasGame = !!store.getState().runtime.game;
      if (adoptVerifiedSession(state.session, generation) && state.session.state === 'authenticated' && hasGame) void reviewSlot('review');
    } else if (state.kind === 'cancelled') cancel();
    else changed();
  });
  const unsubscribeSave = coordinator?.subscribe(() => changed());
  return {
    bootstrap, adoptVerifiedSession, bindCurrentSession, invalidateView, retireAdventureReview, signIn, cancel,
    save: () => reviewSlot('save'), continue: () => reviewSlot('continue'),
    async act(action: SaveDialogAction) {
      if (disposed) return;
      switch (action) {
        case 'cancel': cancel(); break;
        case 'google': case 'github': await signIn(action); break;
        case 'open-tab': if (loginActive) await account?.openSignInTab(); break;
        case 'check-session': if (loginActive) await account?.checkSession(); else await bootstrap(); break;
        case 'confirm-adopt': if (panel === 'adopt' && reviewed?.review.summary === null) await write(coordinator?.state.kind === 'conflict'); break;
        case 'load': if (panel === 'choice') chooseLoad(); break;
        case 'confirm-load': if (panel === 'confirm-load') load(); break;
        case 'replace': if (panel === 'choice' && validReview()) { panel = 'confirm-replace'; changed(); } break;
        case 'confirm-replace': if (panel === 'confirm-replace') await write(true); break;
        case 'review': await reviewSlot('review'); break;
        case 'retry': {
          const view = coordinator?.captureView(), operation = epoch;
          if (view) finishWrite(await coordinator!.retryPending(), operation, view);
          break;
        }
        case 'reauth': panel = 'signin'; message = 'The earlier save may already have committed. Starting a new sign-in leaves its unresolved operation behind; after signing in, review the server save before making another decision.'; changed(); break;
      }
    },
    project(): SaveDialogsView {
      const runtime = store.getState().runtime, service = coordinator?.state;
      const status = service?.kind === 'saving' ? 'Saving…' : service?.kind === 'saved' ? `Saved at ${service.acknowledgement.committedAt}`
        : service?.kind === 'conflict' ? 'Save conflict — review the server save.' : service?.kind === 'failed' ? failureMessage(service.error)
        : service?.kind === 'blocked' ? 'Saved data needs attention; writes are blocked.' : runtime.game ? 'Unsaved changes' : '';
      const auth = runtime.auth.status === 'authenticating' ? runtime.auth.previous : runtime.auth;
      return { panel, status, message, summary: reviewed?.review.summary ?? (service?.kind === 'conflict' ? service.currentSummary : null),
        identity: auth.status === 'authenticated' ? `${auth.displayName} (${auth.provider})` : 'Guest', account: account?.state ?? null,
        busy: loading || service?.kind === 'reading' || service?.kind === 'saving', available: !!api };
    },
    dispose() { if (disposed) return; disposed = true; epoch++; unsubscribeAccount?.(); unsubscribeSave?.(); account?.dispose(); coordinator?.dispose(); api?.dispose(); },
  };
}

/** Native, persistent controls; status updates never replace the focused node. */
export function createSaveDialogsPanel(host: HTMLElement, act: (action: SaveDialogAction) => void) {
  const doc = host.ownerDocument, events = new AbortController(), element = doc.createElement('section');
  element.className = 'nq-shell nq-save'; element.setAttribute('aria-label', 'Account save');
  const status = doc.createElement('p'), message = doc.createElement('p'); status.setAttribute('aria-live', 'polite'); message.setAttribute('aria-live', 'polite');
  const dialog = doc.createElement('section'), heading = doc.createElement('h2'), identity = doc.createElement('p'), explanation = doc.createElement('p'), summary = doc.createElement('p'), providerStatus = doc.createElement('p'), controls = doc.createElement('div');
  heading.tabIndex = -1; dialog.setAttribute('role', 'dialog'); dialog.setAttribute('aria-label', 'Account save decision'); dialog.hidden = true;
  controls.className = 'nq-shell-controls'; dialog.append(heading, identity, explanation, summary, providerStatus, controls); element.append(status, message, dialog); host.append(element);
  const labels: Record<SaveDialogAction, string> = { cancel: 'Keep playing without saving', 'confirm-adopt': 'Save this adventure', load: 'Load Existing Save',
    'confirm-load': 'Discard current progress and load', replace: 'Replace With This Adventure', 'confirm-replace': 'Confirm replacement', review: 'Review Server Save',
    retry: 'Retry pending save', 'open-tab': 'Open Sign-in Tab', 'check-session': 'Check Session', google: 'Google', github: 'GitHub', reauth: 'Sign in again' };
  const buttons = new Map<SaveDialogAction, HTMLButtonElement>();
  for (const [action, label] of Object.entries(labels) as [SaveDialogAction, string][]) {
    const button = doc.createElement('button'); button.type = 'button'; button.textContent = label; button.addEventListener('click', () => act(action), { signal: events.signal }); controls.append(button); buttons.set(action, button);
  }
  const contents: Record<Exclude<Panel, 'none'>, [string, string, SaveDialogAction[]]> = {
    signin: ['Sign in to save', 'Your adventure stays in this tab. Google and GitHub are separate accounts. Sign-in alone does not save or replace progress.', ['google', 'github', 'check-session', 'cancel']],
    adopt: ['Save this adventure?', 'This account has no save. Confirm the first manual save of this adventure. It will use your one account slot.', ['confirm-adopt', 'cancel']],
    choice: ['Review the account save', 'Choose which adventure to keep playing. Loading replaces this tab’s adventure. Replacing overwrites the one server slot after another confirmation. Inventories and notes are never merged.', ['load', 'replace', 'cancel']],
    'confirm-load': ['Load the server adventure?', 'This discards the current adventure and any unsaved notes in this tab. The exact saved notes, inventory and progress will be restored. Cancel keeps your current adventure.', ['confirm-load', 'cancel']],
    'confirm-replace': ['Replace the server save?', 'This replaces the reviewed account save with this adventure and its current notes. The previous adventure will no longer be selectable. A further server change requires another review.', ['confirm-replace', 'cancel']],
    blocked: ['Save preserved', 'The original server save is preserved. This build cannot safely load or replace it. You may keep playing in memory.', ['cancel']],
    conflict: ['The server save changed', 'Another save is newer than the reviewed state or acknowledgement. Read its current summary before choosing to load or replace it.', ['review', 'cancel']],
    recovery: ['Save outcome unconfirmed', 'The exact pending operation is retained in memory. Retry checks that same operation; newer notes are not included in that retry. Keep this tab open to preserve unsaved progress.', ['retry', 'reauth', 'cancel']],
  };
  let shown: Panel = 'none', returnFocus: HTMLElement | null = null;
  element.addEventListener('keydown', event => { if (event.key === 'Escape' && shown !== 'none' && !event.repeat && !event.isComposing) { event.preventDefault(); act('cancel'); } }, { signal: events.signal });
  return { element, render(view: SaveDialogsView) {
    status.textContent = view.status; message.textContent = view.message; dialog.hidden = view.panel === 'none';
    const previous = shown; shown = view.panel;
    if (shown !== 'none') {
      const [title, text, actions] = contents[shown]; heading.textContent = title; dialog.setAttribute('aria-label', title); explanation.textContent = text; identity.textContent = `Account: ${view.identity}`;
      summary.textContent = view.summary ? `Chapter: ${view.summary.episodeId}. Room: ${view.summary.roomId}. Saved: ${view.summary.savedAt}. Outcome: ${view.summary.outcome ?? 'in progress'}. Revision: ${view.summary.revision}.` : '';
      let active = actions;
      providerStatus.textContent = '';
      if (shown === 'signin') {
        const kind = view.account?.kind;
        if (kind === 'popup-blocked') { active = ['open-tab', 'cancel']; providerStatus.textContent = 'The sign-in popup was blocked. Open a separate sign-in tab to keep this adventure here.'; }
        else if (kind === 'opening' || kind === 'awaiting-provider' || kind === 'checking-session' || kind === 'unconfirmed') {
          active = ['check-session', 'cancel']; providerStatus.textContent = kind === 'unconfirmed' ? 'Sign-in is unconfirmed. Check Session after completing sign-in in the other tab.' : 'Complete sign-in in the separate window, then Check Session. You can cancel and keep playing.';
        } else if (view.account?.kind === 'failed') providerStatus.textContent = failureMessage(view.account.error);
      }
      for (const [action, button] of buttons) {
        button.hidden = !active.includes(action); button.disabled = view.busy && action !== 'cancel';
        if (action === 'cancel') button.textContent = shown === 'confirm-load' || shown === 'confirm-replace' || shown === 'adopt' || shown === 'choice' ? 'Cancel' : shown === 'signin' ? 'Cancel sign-in' : 'Keep Playing Without Saving';
      }
    }
    if (shown !== 'none' && previous !== shown) { if (doc.activeElement instanceof HTMLElement && !element.contains(doc.activeElement)) returnFocus = doc.activeElement; heading.focus(); }
    else if (shown === 'none' && previous !== 'none' && returnFocus?.isConnected) returnFocus.focus();
  }, dispose() { events.abort(); element.remove(); } };
}
