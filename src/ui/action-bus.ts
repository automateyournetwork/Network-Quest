// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ActionId, AdventureId, FactId, InstanceId, ItemId, MeasurementId, ObjectiveId, QualifiedId, RoomId, Verb, WorldVersion } from '../domain/types';
import { validNotebookText } from '../state/notebook';
import type { ReducerCommand, ReducerInput, ReducerState, Reduction } from '../state/reducer';
import type { RuntimeState, UiState } from '../state/types';
import type { RepairClassification } from '../state/repair-plan';

/** Intent only. Renderers cannot submit evaluations, effects or arbitrary payloads. */
export type SemanticAction =
  | { readonly kind: 'commit-rift-hazard'; readonly hazardId: QualifiedId; readonly warningAcknowledged: boolean }
  | { readonly kind: 'choose-repair-plan'; readonly choiceId: QualifiedId }
  | { readonly kind: 'review-repair-plan' | 'measure-repair-link' | 'test-repair-endpoint' }
  | { readonly kind: 'execute-repair-plan'; readonly reviewId: MeasurementId; readonly warningAcknowledged: boolean }
  | { readonly kind: 'classify-repair'; readonly selection: RepairClassification; readonly linkId: MeasurementId | null; readonly endpointId: MeasurementId | null }
  | { readonly kind: 'measure-objective'; readonly objectiveId: ObjectiveId; readonly alternativeId: QualifiedId }
  | { readonly kind: 'submit-objective'; readonly objectiveId: ObjectiveId; readonly alternativeId: QualifiedId; readonly measurementId: MeasurementId }
  | { readonly kind: 'request-objective-hint'; readonly objectiveId: ObjectiveId }
  | { readonly kind: 'select-verb'; readonly verb: Verb }
  | { readonly kind: 'open-panel'; readonly panel: Exclude<UiState['panel'], 'none'> }
  | { readonly kind: 'close-panel' }
  | { readonly kind: 'interact'; readonly targetId: QualifiedId | InstanceId; readonly verb: Verb; readonly itemId: ItemId | null }
  | { readonly kind: 'choose-hotspot-action'; readonly targetId: QualifiedId; readonly verb: Verb; readonly itemId: ItemId | null; readonly choiceId: QualifiedId }
  | { readonly kind: 'select-item'; readonly itemId: ItemId | null }
  | { readonly kind: 'combine-items'; readonly itemId: ItemId; readonly targetItemId: ItemId; readonly combinationId: QualifiedId | null }
  | { readonly kind: 'recover-item'; readonly itemId: ItemId }
  | { readonly kind: 'choose-dialogue'; readonly dialogueId: QualifiedId; readonly nodeId: QualifiedId; readonly choiceId: QualifiedId; readonly sessionId: string }
  | { readonly kind: 'skip-dialogue'; readonly dialogueId: QualifiedId; readonly nodeId: QualifiedId; readonly sessionId: string }
  | { readonly kind: 'replay-dialogue' | 'close-dialogue'; readonly dialogueId: QualifiedId; readonly sessionId: string }
  | { readonly kind: 'edit-personal-notes' | 'pin-hypothesis'; readonly text: string }
  | { readonly kind: 'pin-objective'; readonly objectiveId: ObjectiveId }
  | { readonly kind: 'highlight-map-room'; readonly roomId: RoomId }
  | { readonly kind: 'step-packet' | 'pause-packet' | 'resume-packet' | 'replay-packet' | 'close-packet'; readonly sessionId: string }
  | { readonly kind: 'inspect-evidence'; readonly evidenceId: FactId | MeasurementId };

export interface ActionContext extends WorldVersion { readonly adventureId: AdventureId }
export interface CapturedAction {
  readonly actionId: ActionId;
  readonly context: ActionContext | null;
  readonly input: SemanticAction;
}
/** Mints fresh command IDs while retaining one projection's context and bus epoch. */
export type ActionCapture = (input: SemanticAction) => CapturedAction;
export interface ActionResult {
  readonly status: 'handled' | 'unavailable' | 'rejected';
  readonly reason?: string;
  readonly message?: string;
}
export type ActionPlan = ActionResult | {
  readonly status: 'ready';
  /** Synchronous commit only, after the bus rechecks ownership and context. */
  readonly commit: () => ActionResult;
};
/** Pure synchronous resolution. Domain effects belong in a trusted reducer adapter. */
export type ActionHandler = (action: CapturedAction) => ActionPlan;
export type ActionListener = (action: CapturedAction, result: ActionResult) => void;

/** Give this restricted port to renderers; registration belongs to application code. */
export interface ActionDispatcher {
  /** Capture before scheduling any animation/callback; reuse this object for replay. */
  capture(input: SemanticAction, expectedContext?: ActionContext | null): CapturedAction;
  /** Bind once per authoritative projection; retain through status/media-only updates. */
  captureScope(expectedContext?: ActionContext | null): ActionCapture;
  dispatch(action: CapturedAction): ActionResult;
  /** Cancels undelivered intent. Canceling an already committed action cannot undo it. */
  cancel(action: CapturedAction): boolean;
}
export interface ActionBus extends ActionDispatcher {
  register(kind: SemanticAction['kind'], handler: ActionHandler): () => void;
  subscribe(listener: ActionListener): () => void;
  /** Call on restore, logout, title/reset or other same-version runtime replacement. */
  invalidate(): void;
  /** Does not dispose a reducer/store, renderer or network operation owned elsewhere. */
  dispose(): void;
}
export interface ActionBusOptions {
  readonly getContext: () => ActionContext | null;
  readonly onError?: (error: unknown) => void;
}

export function contextFromRuntime(runtime: RuntimeState): ActionContext | null {
  const game = runtime.game;
  return game ? { adventureId: game.adventureId, configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId } : null;
}

function sameContext(a: ActionContext | null, b: ActionContext | null): boolean {
  return a === null || b === null ? a === b : a.adventureId === b.adventureId
    && a.configurationRevision === b.configurationRevision && a.attemptId === b.attemptId;
}

const verbs = new Set<string>(['walk', 'look', 'talk', 'use']);
const panels = new Set<string>(['inventory', 'notebook', 'compendium', 'settings', 'save']);
const fields: Record<SemanticAction['kind'], readonly string[]> = {
  'commit-rift-hazard': ['kind', 'hazardId', 'warningAcknowledged'],
  'choose-repair-plan': ['kind', 'choiceId'], 'review-repair-plan': ['kind'], 'measure-repair-link': ['kind'], 'test-repair-endpoint': ['kind'],
  'execute-repair-plan': ['kind', 'reviewId', 'warningAcknowledged'], 'classify-repair': ['kind', 'selection', 'linkId', 'endpointId'],
  'measure-objective': ['kind', 'objectiveId', 'alternativeId'],
  'submit-objective': ['kind', 'objectiveId', 'alternativeId', 'measurementId'],
  'request-objective-hint': ['kind', 'objectiveId'],
  'edit-personal-notes': ['kind', 'text'], 'pin-hypothesis': ['kind', 'text'],
  'pin-objective': ['kind', 'objectiveId'], 'highlight-map-room': ['kind', 'roomId'],
  'step-packet': ['kind', 'sessionId'], 'pause-packet': ['kind', 'sessionId'], 'resume-packet': ['kind', 'sessionId'],
  'replay-packet': ['kind', 'sessionId'], 'close-packet': ['kind', 'sessionId'],
  'choose-dialogue': ['kind', 'dialogueId', 'nodeId', 'choiceId', 'sessionId'],
  'skip-dialogue': ['kind', 'dialogueId', 'nodeId', 'sessionId'],
  'replay-dialogue': ['kind', 'dialogueId', 'sessionId'], 'close-dialogue': ['kind', 'dialogueId', 'sessionId'],
  'select-verb': ['kind', 'verb'], 'open-panel': ['kind', 'panel'], 'close-panel': ['kind'],
  interact: ['kind', 'targetId', 'verb', 'itemId'], 'inspect-evidence': ['kind', 'evidenceId'],
  'choose-hotspot-action': ['kind', 'targetId', 'verb', 'itemId', 'choiceId'],
  'select-item': ['kind', 'itemId'], 'combine-items': ['kind', 'itemId', 'targetItemId', 'combinationId'], 'recover-item': ['kind', 'itemId'],
};
const qualifiedIdentity = (value: unknown) => typeof value === 'string' && /^spec[0-9]{3}:[A-Za-z0-9][A-Za-z0-9._-]{0,55}$/.test(value);
const dialogueSession = (value: unknown) => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const identity = (value: unknown) => typeof value === 'string' && value.trim().length > 0 && value.length <= 128;

/** Shape guard only. Registry membership and action eligibility remain domain checks. */
export function copySemanticAction(input: SemanticAction): SemanticAction {
  if (!input || typeof input !== 'object' || !Object.hasOwn(fields, input.kind)) throw new TypeError('Unknown semantic action.');
  const keys = fields[input.kind];
  if (Object.keys(input).length !== keys.length || Object.keys(input).some(key => !keys.includes(key))) throw new TypeError('Semantic actions contain intent only.');
  switch (input.kind) {
    case 'commit-rift-hazard': if (!qualifiedIdentity(input.hazardId) || typeof input.warningAcknowledged !== 'boolean') throw new TypeError('Invalid fictional danger acknowledgement.'); break;
    case 'choose-repair-plan': if (!qualifiedIdentity(input.choiceId)) throw new TypeError('Invalid repair choice.'); break;
    case 'review-repair-plan': case 'measure-repair-link': case 'test-repair-endpoint': break;
    case 'execute-repair-plan': if (!dialogueSession(input.reviewId) || typeof input.warningAcknowledged !== 'boolean') throw new TypeError('Invalid repair acknowledgement.'); break;
    case 'classify-repair': if (!['permanent', 'temporary', 'shutdown'].includes(input.selection)
      || (input.linkId !== null && !dialogueSession(input.linkId)) || (input.endpointId !== null && !dialogueSession(input.endpointId))) throw new TypeError('Invalid final evidence selection.'); break;
    case 'measure-objective': case 'submit-objective':
      if (!qualifiedIdentity(input.objectiveId) || !qualifiedIdentity(input.alternativeId)
        || (input.kind === 'submit-objective' && !dialogueSession(input.measurementId))) throw new TypeError('Invalid objective evidence selection.'); break;
    case 'request-objective-hint': if (!qualifiedIdentity(input.objectiveId)) throw new TypeError('Invalid objective identity.'); break;
    case 'edit-personal-notes': if (!validNotebookText(input.text, 4096)) throw new TypeError('Notes require valid Unicode text of at most 4096 characters.'); break;
    case 'pin-hypothesis': if (!validNotebookText(input.text, 512, true)) throw new TypeError('A hypothesis requires 1–512 Unicode characters.'); break;
    case 'pin-objective': if (!qualifiedIdentity(input.objectiveId)) throw new TypeError('Invalid objective identity.'); break;
    case 'highlight-map-room': if (!qualifiedIdentity(input.roomId)) throw new TypeError('Invalid map room identity.'); break;
    case 'step-packet': case 'pause-packet': case 'resume-packet': case 'replay-packet': case 'close-packet':
      if (!dialogueSession(input.sessionId)) throw new TypeError('Invalid packet session.'); break;
    case 'select-verb': if (!verbs.has(input.verb)) throw new TypeError('Unknown verb.'); break;
    case 'open-panel': if (!panels.has(input.panel)) throw new TypeError('Unknown panel.'); break;
    case 'interact': if (!verbs.has(input.verb) || !identity(input.targetId) || (input.itemId !== null && !identity(input.itemId))) throw new TypeError('Invalid interaction intent.'); break;
    case 'choose-hotspot-action': if (!verbs.has(input.verb) || !identity(input.targetId) || !identity(input.choiceId) || (input.itemId !== null && !identity(input.itemId))) throw new TypeError('Invalid hotspot choice.'); break;
    case 'select-item': if (input.itemId !== null && !identity(input.itemId)) throw new TypeError('Invalid item selection.'); break;
    case 'combine-items': if (!identity(input.itemId) || !identity(input.targetItemId) || (input.combinationId !== null && !identity(input.combinationId))) throw new TypeError('Invalid combination intent.'); break;
    case 'recover-item': if (!identity(input.itemId)) throw new TypeError('Invalid recovery intent.'); break;
    case 'inspect-evidence': if (!identity(input.evidenceId)) throw new TypeError('Invalid evidence identity.'); break;
    case 'choose-dialogue': case 'skip-dialogue': case 'replay-dialogue': case 'close-dialogue':
      if (!qualifiedIdentity(input.dialogueId) || !dialogueSession(input.sessionId)
        || ('nodeId' in input && !qualifiedIdentity(input.nodeId)) || ('choiceId' in input && !qualifiedIdentity(input.choiceId))) throw new TypeError('Invalid dialogue intent.');
      break;
    case 'close-panel': break;
  }
  return Object.freeze({ ...input });
}

const rejected = (reason: string, message: string): ActionResult => Object.freeze({ status: 'rejected', reason, message });
const unavailable = (reason: string, message: string): ActionResult => Object.freeze({ status: 'unavailable', reason, message });

function result(value: ActionResult): ActionResult {
  if (!value || !['handled', 'unavailable', 'rejected'].includes(value.status)
    || (value.message !== undefined && typeof value.message !== 'string')
    || (value.reason !== undefined && typeof value.reason !== 'string')) throw new TypeError('Handlers must return a synchronous action result.');
  return Object.freeze({ status: value.status, ...(value.reason === undefined ? {} : { reason: value.reason }),
    ...(value.message === undefined ? {} : { message: value.message }) });
}

/**
 * No queue, timers, DOM, persistence or game mutation. Reentrant dispatch returns
 * busy without consuming its command; retry explicitly after the outer dispatch.
 * Receipts are tied to captured object identity and collected with that object.
 * Observers run after commitment, cannot change its result, and may unsubscribe.
 */
export function createActionBus(options: ActionBusOptions): ActionBus {
  const handlers = new Map<SemanticAction['kind'], { handler: ActionHandler }>();
  const listeners = new Set<ActionListener>();
  const captured = new WeakMap<CapturedAction, { epoch: object; canceled: boolean; result?: ActionResult }>();
  let epoch = {};
  let disposed = false;
  let busy = false;
  const report = (error: unknown) => { try { options.onError?.(error); } catch { /* Error reporting cannot break dispatch. */ } };
  const synchronous = <T>(value: T): T => {
    if (value && typeof value === 'object' && 'then' in value && typeof value.then === 'function') {
      // An accidental rejected Promise must not become an unhandled rejection.
      // This observes failure only; a Promise is never awaited or committed.
      void Promise.resolve(value).catch(report);
      throw new TypeError('Action handlers and commits must be synchronous.');
    }
    return value;
  };
  const assertAlive = () => { if (disposed) throw new Error('Action bus is disposed.'); };
  const blocked = (action: CapturedAction): ActionResult | null => {
    if (disposed) return rejected('disposed', 'This action is no longer available.');
    const entry = captured.get(action);
    if (!entry) return rejected('unknown-action', 'This action was not captured by this interface.');
    if (entry.epoch !== epoch) return rejected('invalidated', 'The adventure has changed. Choose the action again.');
    if (entry.canceled) return rejected('canceled', 'This action was canceled.');
    if (!sameContext(action.context, options.getContext())) return rejected('stale-context', 'The scene has changed. Choose the action again.');
    return null;
  };
  const captureScope = (expectedContext?: ActionContext | null): ActionCapture => {
    assertAlive();
    const context = expectedContext === undefined ? options.getContext() : expectedContext;
    const copied = context === null ? null : Object.freeze({ adventureId: context.adventureId,
      configurationRevision: context.configurationRevision, attemptId: context.attemptId });
    const projectionEpoch = epoch;
    return input => {
      assertAlive();
      const action = Object.freeze({ actionId: crypto.randomUUID() as ActionId, context: copied, input: copySemanticAction(input) });
      captured.set(action, { epoch: projectionEpoch, canceled: false });
      return action;
    };
  };
  return {
    capture(input, expectedContext) {
      return captureScope(expectedContext)(input);
    },
    captureScope,
    dispatch(action) {
      if (disposed) return rejected('disposed', 'This action is no longer available.');
      if (busy) return unavailable('busy', 'Another action is being handled. Try again.');
      const entry = captured.get(action);
      if (!entry) return rejected('unknown-action', 'This action was not captured by this interface.');
      // A prior result is a receipt, never a claim about the current world.
      if (entry.epoch === epoch && entry.result) return entry.result;
      busy = true;
      let resolution: ActionResult;
      try {
        const obstruction = blocked(action);
        const registration = handlers.get(action.input.kind);
        if (obstruction) resolution = obstruction;
        else if (!registration) resolution = unavailable('no-handler', 'This action is not available yet.');
        else {
          const plan = synchronous(registration.handler(action));
          const lateObstruction = blocked(action);
          if (lateObstruction) resolution = lateObstruction;
          else if (handlers.get(action.input.kind) !== registration) resolution = unavailable('handler-removed', 'This action is no longer available.');
          else resolution = result(plan.status === 'ready' ? synchronous(plan.commit()) : plan);
        }
      } catch (error) {
        report(error);
        resolution = rejected('handler-error', 'The action could not be completed.');
      }
      entry.result = resolution;
      // Snapshot membership so removals take effect now; additions wait for next dispatch.
      try {
        for (const listener of [...listeners]) if (listeners.has(listener)) {
          try { listener(action, resolution); } catch (error) { report(error); }
        }
      } finally { busy = false; }
      return resolution;
    },
    cancel(action) {
      const entry = captured.get(action);
      if (disposed || !entry || entry.epoch !== epoch || entry.result || entry.canceled) return false;
      entry.canceled = true;
      return true;
    },
    register(kind, handler) {
      assertAlive();
      if (handlers.has(kind)) throw new Error(`A handler already owns ${kind}.`);
      const registration = { handler };
      handlers.set(kind, registration);
      let registered = true;
      return () => { if (registered) { registered = false; if (handlers.get(kind) === registration) handlers.delete(kind); } };
    },
    subscribe(listener) {
      assertAlive();
      // Independent subscriptions retain independent disposal, even for one callback.
      const subscription: ActionListener = (action, resolution) => listener(action, resolution);
      listeners.add(subscription);
      return () => { listeners.delete(subscription); };
    },
    invalidate() { if (!disposed) epoch = {}; },
    dispose() { disposed = true; epoch = {}; handlers.clear(); listeners.clear(); },
  };
}

export interface ReducerActionAdapter {
  readonly getState: () => ReducerState;
  readonly reduce: (state: ReducerState, command: ReducerCommand) => Reduction;
  /** Atomic store boundary. Never commit when the captured state was replaced. */
  readonly compareAndSet: (expected: ReducerState, next: ReducerState) => boolean;
  /** Trusted pure content/evaluator/navigation adapter; null means unsupported. */
  readonly resolve: (action: CapturedAction, state: ReducerState) => ReducerInput | null;
}

/** Renderer intent is resolved here, never cast to ReducerInput or acceptedEffects. */
export function reducerActionHandler(adapter: ReducerActionAdapter): ActionHandler {
  return action => {
    const before = adapter.getState();
    const context = action.context;
    if (!context) return rejected('no-adventure', 'Start an adventure before using this action.');
    if (!sameContext(context, contextFromRuntime(before.runtime))) return rejected('stale-context', 'The scene has changed. Choose the action again.');
    const input = adapter.resolve(action, before);
    if (input === null) return unavailable('unsupported-action', 'This action is not available here.');
    // Detach the resolved definition from later caller mutations; the reducer
    // still checks it against the actual immutable authored content registry.
    const command: ReducerCommand = { actionId: action.actionId, adventureId: context.adventureId,
      expectedVersion: { configurationRevision: context.configurationRevision, attemptId: context.attemptId }, input: structuredClone(input) };
    return { status: 'ready', commit: () => {
      if (adapter.getState() !== before) return rejected('state-replaced', 'The adventure has changed. Choose the action again.');
      const reduction = adapter.reduce(before, command);
      if (reduction.status === 'rejected') return rejected(reduction.reason ?? 'rejected', 'This action cannot be completed in the current state.');
      if (reduction.state !== before && !adapter.compareAndSet(before, reduction.state)) return rejected('state-replaced', 'The adventure has changed. Choose the action again.');
      return { status: 'handled', reason: reduction.status };
    } };
  };
}
