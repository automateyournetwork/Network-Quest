// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { AppShell } from './app-shell';

/** Presentation-only window composition. Controllers retain every action and capture. */
export function createAdventureFrame(host: HTMLElement, ports: {
  menu: HTMLElement; saves: HTMLElement; settings: HTMLElement; sound: HTMLElement; adventure: HTMLElement;
}) {
  const doc = host.ownerDocument, abort = new AbortController();
  let attachment = new AbortController();
  const root = doc.createElement('div'); root.className = 'nq-game';
  const chrome = doc.createElement('header'); chrome.className = 'nq-game-chrome';
  const brand = doc.createElement('span'); brand.className = 'nq-game-brand'; brand.textContent = 'NETWORK QUEST';
  const roomName = doc.createElement('span'); roomName.className = 'nq-game-location';
  const makeButton = (label: string, action: () => void, signal = abort.signal) => {
    const b = doc.createElement('button'); b.type = 'button'; b.textContent = label;
    b.addEventListener('click', action, { signal }); return b;
  };
  const menuButton = makeButton('Game', () => open('game'));
  const soundButton = makeButton('Sound and reading', () => open('sound'));
  chrome.append(brand, roomName, soundButton, menuButton);
  const windows = doc.createElement('div'); windows.className = 'nq-game-windows';
  root.append(chrome, ports.adventure, windows); host.replaceChildren(root);
  const windowMap = new Map<string, HTMLElement>();
  const returnTargets = new WeakMap<HTMLElement, HTMLElement>();
  const suspendedWindows = new WeakMap<HTMLElement, string>();
  const movedControls = new Map<HTMLButtonElement, { parent: HTMLElement; next: ChildNode | null }>();
  let inputFocus: HTMLElement | null = null;
  root.addEventListener('pointerdown', event => { const target = event.target instanceof Element ? event.target.closest<HTMLElement>('button, input, select, textarea') : null; inputFocus = target ?? (doc.activeElement instanceof HTMLElement ? doc.activeElement : null); }, { capture:true, signal:abort.signal });
  root.addEventListener('keydown', () => { inputFocus = doc.activeElement instanceof HTMLElement ? doc.activeElement : null; }, { capture:true, signal:abort.signal });
  let manual: string | null = null, back: HTMLElement | null = null, active: HTMLElement | null = null;
  let stageHost: HTMLElement | null = null, feedback: HTMLElement | null = null, saveIndicator: HTMLElement | null = null, saveMessage: HTMLElement | null = null;
  let playing = false, shell: AppShell | null = null, lastFallback = false, dialogueWrapper: HTMLElement | null = null;
  const makeWindow = (id: string, label: string, content: HTMLElement[], signal = abort.signal) => {
    const window = doc.createElement('section'); window.className = 'nq-frame-window';
    window.hidden = true; window.setAttribute('role', 'dialog'); window.setAttribute('aria-label', label);
    const bar = doc.createElement('div'); bar.className = 'nq-window-bar';
    const heading = doc.createElement('h2'); heading.textContent = ({ 'Scene objects and exits': 'Scene', 'Evidence and captions': 'Evidence', 'Game menu': 'Game' } as Record<string,string>)[label] ?? label; heading.tabIndex = -1;
    const close = makeButton(`Close ${label}`, () => closeWindow(), signal); close.className = 'nq-window-close'; close.setAttribute('aria-label', `Close ${label}`); close.textContent = 'Close';
    bar.append(heading, close); window.append(bar, ...content); windows.append(window); windowMap.set(id, window); return window;
  };
  // A frame-owned wrapper keeps modality separate from the application's busy-save inert boundary.
  const saveWindowHost = doc.createElement('div'); saveWindowHost.append(ports.saves);
  const game = makeWindow('game', 'Game menu', [ports.menu, saveWindowHost]);
  makeWindow('sound', 'Sound and reading', [ports.sound]);
  windows.append(ports.settings);
  const visible = (element: HTMLElement) => !element.closest('[hidden]');
  function closeWindow() {
    manual = null; sync(playing);
    if (back?.isConnected && visible(back) && !back.closest('[inert]')) back.focus();
    else if (playing) menuButton.focus();
  }
  function open(id: string) {
    if (doc.activeElement instanceof HTMLElement) back = doc.activeElement;
    manual = id;
    if (id === 'sound') { const details = ports.sound.querySelector('details'); if (details) details.open = true; }
    sync(playing);
    windowMap.get(id)?.querySelector<HTMLElement>('h2')?.focus();
  }
  // Only the selected window is modal. Browser Tab and accessibility traversal
  // cannot leave it, while Escape is first offered to its owning controller.
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && !event.defaultPrevented && !event.repeat && !event.isComposing) {
      if (manual && active === windowMap.get(manual)) { event.preventDefault(); closeWindow(); }
      return;
    }
    if (event.key !== 'Tab' || !active) return;
    const focusable = [...active.querySelectorAll<HTMLElement>('button, a[href], input, select, textarea, [tabindex="0"]')]
      .filter(el => visible(el) && !el.closest('[inert]') && !(el as HTMLButtonElement).disabled && el.getClientRects().length > 0);
    const first = focusable[0], last = focusable.at(-1);
    if (!first) { event.preventDefault(); return; }
    if (event.shiftKey && (doc.activeElement === first || !focusable.includes(doc.activeElement as HTMLElement))) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && (doc.activeElement === last || !active.contains(doc.activeElement))) { event.preventDefault(); first.focus(); }
  }, { signal: abort.signal });
  function sync(hasGame: boolean, renderFocus?: Element | null) {
    saveMessage ??= ports.saves.querySelector<HTMLElement>('.nq-save > p:nth-child(2)');
    saveIndicator ??= ports.saves.querySelector<HTMLElement>('.nq-save > p');

    playing = hasGame; root.dataset['playing'] = String(playing);
    ports.adventure.hidden = !playing; menuButton.hidden = !playing;
    const titleDialog = ports.menu.querySelector<HTMLElement>('[role="dialog"]:not([hidden])');
    const saveDialog = ports.saves.querySelector<HTMLElement>('[role="dialog"]:not([hidden])');
    if (saveIndicator) {
      const target = saveDialog ?? (manual === 'game' ? game : chrome);
      saveIndicator.classList.toggle('nq-save-indicator', target === chrome);
      saveIndicator.tabIndex = saveIndicator.textContent?.trim() ? 0 : -1;
      if (saveIndicator.parentElement !== target) { if (target === chrome) chrome.insertBefore(saveIndicator, soundButton); else target.querySelector('h2')?.parentElement === target ? target.querySelector('h2')!.after(saveIndicator) : target.querySelector('.nq-window-bar')!.after(saveIndicator); }
    }
    if (saveMessage) { const target = saveDialog ?? ports.saves.querySelector<HTMLElement>('.nq-save')!; if (saveMessage.parentElement !== target) target.append(saveMessage); }
    const settingsDialog = ports.settings.querySelector<HTMLElement>('[role="dialog"]:not([hidden])');
    if (shell) {
      dialogueWrapper ??= shell.panelHost.querySelector<HTMLElement>('[aria-label="Dialogue"]')?.parentElement ?? null;
      if (dialogueWrapper) {
        const dialog = dialogueWrapper.querySelector<HTMLElement>('[role="dialog"]')!;
        const target = dialog.hidden ? windowMap.get('scene')! : shell.panelHost;
        if (dialogueWrapper.parentElement !== target) target.append(dialogueWrapper);
      }
    }
    const panel = shell ? [...shell.panelHost.querySelectorAll<HTMLElement>('[role="dialog"]')].find(visible) : undefined;
    const inputWasVisible = !!inputFocus && visible(inputFocus);
    const owner = settingsDialog ?? panel;
    if (owner && owner !== active && manual && !['sound'].includes(manual) && !(owner === panel && manual === 'game')) suspendedWindows.set(owner, manual);
    if (settingsDialog || (panel && !['game', 'sound'].includes(manual ?? ''))) manual = null;
    if (active && !visible(active) && !manual && playing) manual = suspendedWindows.get(active) ?? null;
    for (const [id, window] of windowMap) window.hidden = !(manual === id || (id === 'game' && (!playing || !!titleDialog || !!saveDialog)));
    game.classList.toggle('nq-title-window', !playing);
    game.querySelector<HTMLElement>('.nq-window-bar')!.hidden = !playing;
    game.setAttribute('role', playing ? 'dialog' : 'region');
    const next = settingsDialog ?? saveDialog ?? titleDialog ?? (manual ? windowMap.get(manual)! : panel ?? null);
    // Reset the previous modal before considering focus restoration. Controller
    // renderers may have already restored focus to their original opener.
    for (const el of root.querySelectorAll<HTMLElement>('.nq-window-active')) { el.classList.remove('nq-window-active'); el.removeAttribute('aria-modal'); }
    for (const el of root.querySelectorAll<HTMLElement>('[data-frame-inert]')) { el.inert = false; delete el.dataset['frameInert']; }
    const previous = active;
    // Returning from a child window (for example Game opened by Diagnostics)
    // must preserve the parent's original opener, not replace it with a heading
    // in the child that is about to be hidden.
    const resumingOwner = !!next && !!previous && !!returnTargets.get(previous) && next.contains(returnTargets.get(previous)!);
    if (next && next !== previous && !resumingOwner && inputFocus && inputWasVisible && !inputFocus.classList.contains('nq-window-close') && !next.contains(inputFocus)) returnTargets.set(next, inputFocus);
    active = next;
    if (!playing && !active) game.classList.add('nq-window-active');
    if (feedback && stageHost) {
      const reading = active && shell?.element.contains(active) ? active : null;
      const target = reading && active === reading ? reading : stageHost;
      if (feedback.parentElement !== target) {
        if (target === reading) target.insertBefore(feedback, target.children[1] ?? null); else target.append(feedback);
      }
    }
    if (active) {
      if (active === panel && !active.querySelector('.nq-panel-game')) { const button = makeButton('Game', () => open('game'), attachment.signal); button.className = 'nq-panel-game'; active.querySelector('h2')?.after(button); }
      if (!active.classList.contains('nq-frame-window')) {
        const close = [...active.querySelectorAll<HTMLButtonElement>('button')].find(b => !b.hidden && (b.getAttribute('aria-keyshortcuts') === 'Escape' || /^(Close |Cancel(?: sign-in)?$|Keep [Pp]laying [Ww]ithout [Ss]aving$|Continue as guest$)/.test(b.textContent ?? '')));
        close?.classList.add('nq-sticky-close');
        if (close && close.previousElementSibling !== active.querySelector('h2')) {
          if (!movedControls.has(close)) movedControls.set(close, { parent:close.parentElement!, next:close.nextSibling });
          active.querySelector('h2')?.after(close);
        }
      }
      active.classList.add('nq-window-active'); active.setAttribute('aria-modal', 'true');
      // Inert siblings on the path to the frame, not the window's ancestors.
      let branch: HTMLElement = active;
      while (branch !== root) {
        for (const sibling of branch.parentElement?.children ?? []) if (sibling !== branch && sibling instanceof HTMLElement) { sibling.inert = true; sibling.dataset['frameInert'] = ''; }
        branch = branch.parentElement!;
      }
      const returned = previous && !visible(previous) ? returnTargets.get(previous) : null;
      if (previous === active && renderFocus instanceof HTMLElement && renderFocus.isConnected && active.contains(renderFocus) && visible(renderFocus) && !renderFocus.closest('[inert]') && doc.activeElement !== renderFocus) renderFocus.focus();
      else if (returned?.isConnected && active.contains(returned)) returned.focus();
      else if (!active.contains(doc.activeElement)) active.querySelector<HTMLElement>('h1, h2, button')?.focus();
    } else if (previous && returnTargets.get(previous)?.isConnected && visible(returnTargets.get(previous)!) && !returnTargets.get(previous)!.closest('[inert]')) {
      returnTargets.get(previous)!.focus();
    } else if (playing && doc.activeElement instanceof HTMLElement && (doc.activeElement.closest('[hidden]') || doc.activeElement === doc.body)) {
      shell?.element.querySelector<HTMLElement>('.nq-shell-controls button')?.focus();
    }
    roomName.textContent = playing ? shell?.element.querySelector('h1')?.textContent ?? '' : 'THE UNDERWORLD';
    const presentationStatus = shell?.element.querySelector<HTMLElement>('.nq-shell-presentation-status');
    const unavailable = presentationStatus?.textContent ?? '';
    if (presentationStatus) presentationStatus.hidden = !/unavailable/i.test(unavailable);
    const fallback = playing && /unavailable|Text presentation/i.test(unavailable);
    root.dataset['textScene'] = String(fallback);
    const revealFallback = fallback && !lastFallback && !active; lastFallback = fallback;
    if (revealFallback) open('scene');
  }
  return {
    element: root,
    attach(next: AppShell, visualControls: HTMLElement) {
      attachment.abort(); movedControls.clear(); attachment = new AbortController(); inputFocus = null;
      shell = next; manual = null; back = null; active = null; lastFallback = false; dialogueWrapper = null;
      for (const id of ['scene', 'evidence']) { windowMap.get(id)?.remove(); windowMap.delete(id); }
      const section = next.element; section.classList.add('nq-framed-shell');
      const title = section.querySelector<HTMLElement>('h1')!; title.classList.add('nq-room-heading');
      const scene = section.querySelector<HTMLElement>('.nq-shell-scene')!;
      const evidence = section.querySelector<HTMLElement>('.nq-shell-evidence')!;
      const captions = section.querySelector<HTMLElement>('.nq-shell-captions')!;
      const status = section.querySelector<HTMLElement>('.nq-shell-status')!;
      const presentationStatus = section.querySelector<HTMLElement>('.nq-shell-presentation-status')!;
      const controls = section.querySelector<HTMLElement>('.nq-shell-controls')!;
      const stage = doc.createElement('div'); stage.className = 'nq-game-stage'; stageHost = stage; feedback = status;
      next.presentationHost.dataset['contained'] = 'true';
      const fallback = makeButton('Open scene description', () => open('scene'), attachment.signal); fallback.className = 'nq-scene-fallback';
      stage.append(next.presentationHost, fallback, status);
      const audioCaption = ports.sound.querySelector<HTMLElement>('.nq-media-caption'); if (audioCaption) stage.append(audioCaption);
      scene.prepend(presentationStatus, visualControls);
      const hotspots = makeButton('Show hotspots', () => { const shown = root.dataset['hotspots'] !== 'true'; root.dataset['hotspots'] = String(shown); hotspots.setAttribute('aria-pressed', String(shown)); }, attachment.signal);
      hotspots.setAttribute('aria-pressed', root.dataset['hotspots'] ?? 'false'); visualControls.append(hotspots);
      const sceneWindow = makeWindow('scene', 'Scene objects and exits', [scene], attachment.signal);
      const evidenceWindow = makeWindow('evidence', 'Evidence and captions', [evidence, captions], attachment.signal);
      // Window nodes stay inside the semantic shell so shortcuts keep their
      // original event route and no capture is regenerated by presentation.
      section.append(sceneWindow, evidenceWindow);
      scene.querySelector('h2')!.hidden = true;
      const tools = doc.createElement('div'); tools.className = 'nq-frame-tools';
      tools.append(makeButton('Scene', () => open('scene'), attachment.signal), makeButton('Evidence', () => open('evidence'), attachment.signal));
      const toolbar = doc.createElement('div'); toolbar.className = 'nq-game-toolbar'; toolbar.append(controls, tools);
      section.querySelector('.nq-shell-layout')?.remove();
      section.prepend(title, stage, toolbar);
      next.panelHost.classList.add('nq-frame-panels');
      // Frame windows are children of this shell; their original semantic action
      // listeners and return-focus targets remain owned by the original modules.
      const click = () => { queueMicrotask(() => sync(playing)); };
      section.addEventListener('click', click, { signal: attachment.signal });
    },
    // Restore original containers immediately before their owners reconcile.
    // In particular a closed packet panel must remove its old close control.
    preparePanels() {
      for (const [control, home] of movedControls) if (control.isConnected && home.parent.isConnected) home.parent.insertBefore(control, home.next?.parentNode === home.parent ? home.next : null);
      movedControls.clear();
    },
    sync,
    open,
    dispose() { movedControls.clear(); attachment.abort(); abort.abort(); root.remove(); },
  };
}
