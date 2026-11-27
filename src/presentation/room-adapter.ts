// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { RoomId } from '../domain/types';
import { copySemanticAction } from '../ui/action-bus';
import type { ActionCapture, ActionDispatcher, ActionResult, CapturedAction } from '../ui/action-bus';
import type { AppShellView, SemanticControl } from '../ui/app-shell';
import { createResourceScope } from './resource-pool';
import type { ResourcePool, ResourceScope } from './resource-pool';

/** A projection of validated authoritative state, never a mutable GameState or reward channel. */
export interface RoomView extends Omit<AppShellView, 'presentationStatus'> { readonly roomId: RoomId; readonly activeAllyIds?: readonly string[] }
export type RoomMode = 'three' | 'layered' | 'sprite' | 'text';
export interface RoomSettings {
  readonly mode: RoomMode;
  readonly detail: 'default' | 'low';
  readonly reducedMotion: boolean;
}
export interface DeferredIntent { dispatch(): ActionResult; cancel(): void }
export interface PreparedRoom {
  /** Attach only here, never during prepare. The coordinator rejects stale completions first. */
  attach(): void;
  /** Presentation only: no timers may mutate gameplay. */
  setPaused(paused: boolean): void;
  /** Refresh the semantic projection without rebuilding the same room's media. */
  updateView?(view: RoomView): void;
  /** Remove owned surfaces/listeners/animation callbacks. Shared resources use leases. */
  dispose(): void;
}
export interface RoomRenderRequest<T> {
  readonly view: RoomView;
  readonly settings: RoomSettings;
  readonly resources: ResourceScope<T>;
  readonly signal: AbortSignal;
  /** Capture before deferring an input; replay the returned intent, never capture at callback time. */
  capture(controlId: string): DeferredIntent;
  /** Wire WebGL context loss/media failure here, removing that listener in dispose. */
  contextLost(): void;
}
export interface RoomRenderer<T> {
  /** Same-room changes can arrive while media is decoding; prepared sessions must implement updateView. */
  readonly reuseView?: boolean;
  prepare(request: RoomRenderRequest<T>): Promise<PreparedRoom>;
}
export interface RoomStatus {
  readonly kind: 'empty' | 'loading' | 'ready' | 'text' | 'unavailable' | 'disposed';
  readonly mode: RoomMode;
  readonly reason?: 'renderer-unavailable' | 'prepare-failed' | 'context-lost' | 'preparation-capacity';
  readonly message: string;
}
export interface RoomAdapterOptions<T> {
  readonly pool: ResourcePool<T>;
  readonly dispatcher: ActionDispatcher;
  /** Forward both arguments to AppShell.render; status updates must retain the same capture scope. */
  readonly onView: (view: AppShellView | null, capture?: ActionCapture) => void;
  readonly renderers?: Partial<Readonly<Record<Exclude<RoomMode, 'text'>, RoomRenderer<T>>>>;
  /** Includes canceled preparations that have not settled, preventing retry accumulation. */
  readonly maxPendingPreparations?: number;
  readonly onError?: (error: unknown) => void;
}

function snapshot(view: RoomView): RoomView {
  const ids = new Set<string>();
  const control = (input: SemanticControl) => {
    if (!input.id.trim() || !input.label.trim() || ids.has(input.id)) throw new Error('Invalid or duplicate semantic control');
    ids.add(input.id);
    return Object.freeze({ ...input, action: copySemanticAction(input.action) });
  };
  return Object.freeze({ ...view, ...(view.activeAllyIds ? { activeAllyIds: Object.freeze([...view.activeAllyIds]) } : {}), context: view.context && Object.freeze({ ...view.context }),
    controls: Object.freeze(view.controls.map(control)),
    objects: Object.freeze(view.objects.map(object => Object.freeze({ ...object, actions: Object.freeze(object.actions.map(control)) }))),
    evidence: Object.freeze(view.evidence.map(evidence => Object.freeze({ ...evidence, ...(evidence.action ? { action: control(evidence.action) } : {}) }))),
    captions: Object.freeze(view.captions.map(caption => Object.freeze({ ...caption }))),
  });
}

/** Owns only presentation. Application owns the pool, shell, authoritative state and action bus. */
export function createRoomAdapter<T>(options: RoomAdapterOptions<T>) {
  const maxPending = options.maxPendingPreparations ?? 2;
  if (!Number.isSafeInteger(maxPending) || maxPending < 1) throw new RangeError('Invalid preparation capacity');
  let view: RoomView | null = null, disposed = false, paused = false, pending = 0;
  let captureView: ActionCapture | undefined;
  let settings: RoomSettings = Object.freeze({ mode: 'text', detail: 'default', reducedMotion: true });
  let state: RoomStatus = Object.freeze({ kind: 'empty', mode: 'text', message: 'No room presentation.' });
  let active: { scope: ResourceScope<T>; actions: Set<CapturedAction>; session: PreparedRoom | null } | null = null;
  const report = (error: unknown) => { try { options.onError?.(error); } catch { /* Error reporting cannot interrupt disposal. */ } };
  const safely = (work: () => void) => { try { work(); } catch (error) { report(error); } };
  function announce(kind: RoomStatus['kind'], message: string, reason?: RoomStatus['reason']) {
    state = Object.freeze({ kind, mode: settings.mode, message, ...(reason ? { reason } : {}) });
    if (view) options.onView(Object.freeze({ ...view, presentationStatus: message }), captureView);
  }
  function stop() {
    const previous = active; active = null;
    if (!previous) return;
    for (const captured of previous.actions) options.dispatcher.cancel(captured);
    previous.actions.clear();
    if (previous.session) safely(() => previous.session?.dispose());
    previous.scope.dispose();
  }
  function unavailable(reason: NonNullable<RoomStatus['reason']>) {
    stop();
    announce('unavailable', 'Visual presentation unavailable. Scene descriptions, evidence and actions remain available. Retry or select text/low detail.', reason);
  }
  function start() {
    stop();
    if (disposed || !view) return;
    if (settings.mode === 'text') { announce('text', 'Text presentation. All scene actions and evidence remain available.'); return; }
    const renderer = options.renderers?.[settings.mode];
    if (!renderer) { unavailable('renderer-unavailable'); return; }
    if (pending >= maxPending) { unavailable('preparation-capacity'); return; }
    const current = { scope: createResourceScope(options.pool), actions: new Set<CapturedAction>(), session: null as PreparedRoom | null };
    active = current;
    const currentView = view;
    const isCurrent = () => !disposed && active === current && !current.scope.signal.aborted;
    const request: RoomRenderRequest<T> = Object.freeze({ view: currentView, settings, resources: current.scope, signal: current.scope.signal,
      capture(controlId: string) {
        if (!isCurrent()) throw new Error('Room presentation is inactive');
        const controls = new Map([...view!.controls, ...view!.objects.flatMap(object => object.actions),
          ...view!.evidence.flatMap(evidence => evidence.action ? [evidence.action] : [])].map(control => [control.id, control]));
        const control = controls.get(controlId);
        if (!control || control.unavailableReason !== undefined) throw new Error('Semantic control is unknown or unavailable');
        const captured = captureView!(control.action);
        current.actions.add(captured);
        return Object.freeze({
          dispatch() {
            if (!isCurrent()) return { status: 'rejected' as const, reason: 'inactive-presentation' };
            // Preserve the same bus-owned object for duplicate callbacks/receipts.
            current.actions.delete(captured);
            return options.dispatcher.dispatch(captured);
          },
          cancel() { current.actions.delete(captured); options.dispatcher.cancel(captured); },
        });
      },
      contextLost() { if (isCurrent()) unavailable('context-lost'); },
    });
    announce('loading', 'Visual presentation loading. Scene descriptions, evidence and actions are available.');
    if (!isCurrent()) return;
    pending++;
    let preparing: Promise<PreparedRoom>;
    try { preparing = renderer.prepare(request); } catch (error) { preparing = Promise.reject(error); }
    void Promise.resolve(preparing).then(session => {
      if (!isCurrent()) { safely(() => session.dispose()); return; }
      current.session = session;
      try {
        if (renderer.reuseView && view) {
          if (!session.updateView) throw new Error('Reusable renderer must refresh its semantic projection');
          session.updateView(view);
        }
        // Set pause before attach so a hidden-tab render never starts its animation loop.
        session.setPaused(paused);
        if (!isCurrent()) return;
        session.attach();
        if (isCurrent()) announce('ready', 'Visual presentation ready. Equivalent text and actions remain available.');
      } catch (error) { report(error); if (isCurrent()) unavailable('prepare-failed'); }
    }, error => { report(error); if (isCurrent()) unavailable('prepare-failed'); }).finally(() => { pending--; });
  }
  return Object.freeze({
    show(next: RoomView, nextSettings: RoomSettings = settings) {
      if (disposed) throw new Error('Room adapter disposed');
      const copied = snapshot(next); // reject malformed projection without tearing down the current view
      const reusable = view?.roomId === copied.roomId && settings.mode === nextSettings.mode && settings.detail === nextSettings.detail
        && settings.reducedMotion === nextSettings.reducedMotion && active && (active.session?.updateView
          || (settings.mode !== 'text' && options.renderers?.[settings.mode]?.reuseView));
      view = copied; captureView = options.dispatcher.captureScope(copied.context);
      if (reusable && active) {
        for (const action of active.actions) options.dispatcher.cancel(action);
        active.actions.clear();
        try {
          if (active.session) { active.session.updateView!(copied); announce('ready', 'Visual presentation ready. Equivalent text and actions remain available.'); }
          else announce('loading', 'Visual presentation loading. Scene descriptions, evidence and actions are available.');
        }
        catch (error) { report(error); unavailable('prepare-failed'); }
        return;
      }
      settings = Object.freeze({ ...nextSettings }); start();
    },
    setMode(mode: RoomMode, detail: RoomSettings['detail'] = settings.detail) {
      if (disposed) return;
      settings = Object.freeze({ ...settings, mode, detail }); start();
    },
    retry() { start(); },
    hide() { if (disposed) return; stop(); view = null; state = Object.freeze({ kind: 'empty', mode: settings.mode, message: 'No room presentation.' }); },
    setPaused(value: boolean) {
      if (disposed) return;
      paused = value;
      try { active?.session?.setPaused(value); } catch (error) { report(error); unavailable('prepare-failed'); }
    },
    status() { return state; },
    dispose() {
      if (disposed) return;
      disposed = true; stop(); view = null;
      state = Object.freeze({ kind: 'disposed', mode: settings.mode, message: 'Room presentation disposed.' });
      options.onView(null);
    },
  });
}
export type RoomAdapter<T> = ReturnType<typeof createRoomAdapter<T>>;
