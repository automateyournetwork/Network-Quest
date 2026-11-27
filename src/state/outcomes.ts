// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type { ActionId, AdventureId, CaveatId, Outcome, OutcomeEventId, QualifiedId, WorldVersion } from '../domain/types';
import { isRecord } from '../domain/evaluate';
import { createReducer } from './reducer';
import type { ReducerState, RejectionReason } from './reducer';
import { prepareRepairPlanChange, repairClassification, repairEffectBindings, repairPlans, validRepairOperation, validateRepairClassificationContent } from './repair-plan';
import type { RepairEvaluation, RepairPlanOperation, RepairScenario, RepairScenarioResolver } from './repair-plan';
import { advanceDirtyGeneration } from './snapshot';
import { allowRiftEncounterInput, isActiveRiftEncounter } from './rift-encounter';
import type { GameState, OutcomeEvent } from './types';

/** Displayable capture fields are not authority: only the original object works. */
export interface OutcomeContext { readonly adventureId: AdventureId; readonly expectedVersion: WorldVersion }
/** Inputs express the player's claim and selected evidence, never a verdict. */
export interface OutcomeCommand {
  readonly actionId: ActionId;
  readonly eventId: OutcomeEventId;
  readonly operation: Extract<RepairPlanOperation, { kind: 'classify' }>;
}
export interface OutcomeCaveat { readonly id: CaveatId; readonly text: string }
export interface OutcomeFeedback {
  readonly status: RepairEvaluation['status'];
  readonly reasonCode: string;
  readonly diagnosticCode?: string;
  readonly observations: readonly unknown[];
  readonly outcome: Outcome | null;
  readonly restoredService: boolean;
  readonly caveats: readonly OutcomeCaveat[];
}
export interface PreparedOutcomeChange { readonly kind: 'classify-outcome' | 'dismiss-outcome-feedback' }
export type OutcomeReason = RejectionReason | 'stale-context' | 'incorrect' | 'already-classified' | 'history-full';
type Failure = { readonly ok: false; readonly reason: OutcomeReason; readonly feedback?: OutcomeFeedback };
export type OutcomePreparation = Failure | { readonly ok: true; readonly change: PreparedOutcomeChange; readonly feedback: OutcomeFeedback };
export interface OutcomeStore {
  getState(): ReducerState;
  /** Synchronous installation only; notify subscribers after the complete swap. */
  compareAndSet(expected: ReducerState, next: ReducerState): boolean;
}
export type OutcomeCommit = Failure | { readonly ok: true; readonly state: ReducerState; readonly feedback: OutcomeFeedback };
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const contexts = new WeakMap<OutcomeContext, ReducerState>();
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const reject = (reason: OutcomeReason): Failure => ({ ok: false, reason });
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
// Exact, already authored T077 content: one fact contains all required caveat
// roles. Changed teaching text requires review, not a permissive substring test.
const reviewedCaveats = {
  E02: { id: q<'caveat'>('FACT-repair-maintenance'), text: 'Temporary dependency: the tested bypass uses a borrowed installation in the protected work corridor. Limitation: this arrangement cannot be left as the permanent route. Follow-up: install and validate the permanent protected route before removing or returning the borrowed installation. Temporary service must pass the same fresh physical and endpoint checks.' },
  E03: { id: q<'caveat'>('FACT-repair-isolation'), text: 'Named unresolved fault: the severed conduit remains disconnected. Deliberate isolation keeps that path out of service. Recovery plan: return to safe preparation, repair or replace the damaged path, then measure again and repeat the endpoint test. This is honest unresolved service, never a restoration.' },
} as const;

/**
 * Reviewed references for history and presentation. The policy bridge must map
 * these exact authored facts into caveat membership before E02/E03-history saves
 * can pass. This function does not alter the registry, policy or save schema.
 */
export function outcomeCaveats(registry: ContentRegistry): Readonly<Record<Outcome, readonly OutcomeCaveat[]>> | null {
  const room = registry.record(q('R11'));
  if (room?.kind !== 'room') return null;
  for (const expected of Object.values(reviewedCaveats)) {
    const fact = room.evidence.find(f => f.id === expected.id);
    if (!registry.has('fact', expected.id) || !fact || fact.roomId !== room.id || fact.kind !== 'context'
      || fact.requiresFreshMeasurement || fact.text !== expected.text
      || fact.ruleIds.length !== 1 || fact.ruleIds[0] !== q('STATE04')
      || JSON.stringify(fact.subjectIds) !== JSON.stringify(expected.id === q('FACT-repair-maintenance') ? [q('PR110')] : [q('PR102'), q('PR107')])) return null;
  }
  return freeze({ E01: [], E02: [structuredClone(reviewedCaveats.E02)], E03: [structuredClone(reviewedCaveats.E03)] });
}

export function captureOutcomeContext(state: ReducerState): OutcomeContext | null {
  const game = state.runtime.game;
  if (!game || !state.runtime.activity) return null;
  const context = freeze({ adventureId: game.adventureId,
    expectedVersion: { attemptId: game.world.attemptId, configurationRevision: game.world.configurationRevision } });
  contexts.set(context, state); return context;
}
function captured(state: ReducerState, context: OutcomeContext): Failure | null {
  if (contexts.get(context) !== state) return reject('stale-context');
  const game = state.runtime.game;
  if (!game || !state.runtime.activity) return reject('no-adventure');
  if (context.adventureId !== game.adventureId) return reject('wrong-adventure');
  if (context.expectedVersion.attemptId !== game.world.attemptId
    || context.expectedVersion.configurationRevision !== game.world.configurationRevision) return reject('stale-version');
  if (state.control.pending) return reject('transition-pending');
  return null;
}
function validCommand(value: unknown): value is OutcomeCommand {
  if (!isRecord(value) || Object.keys(value).length !== 3 || Object.keys(value).some(k => !['actionId', 'eventId', 'operation'].includes(k))) return false;
  return typeof value['actionId'] === 'string' && !!value['actionId'].trim() && value['actionId'].length <= 128
    && typeof value['eventId'] === 'string' && uuid.test(value['eventId'])
    && validRepairOperation(value['operation']) && value['operation'].kind === 'classify';
}
function feedback(evaluation: RepairEvaluation, outcome: Outcome | null, caveats: readonly OutcomeCaveat[] = []): OutcomeFeedback {
  return freeze({ status: evaluation.status, reasonCode: evaluation.reasonCode,
    ...(evaluation.diagnosticCode ? { diagnosticCode: evaluation.diagnosticCode } : {}),
    observations: structuredClone(evaluation.observations), outcome, restoredService: outcome === 'E01' || outcome === 'E02', caveats });
}

/**
 * Pure state preparation with trusted immutable reducer input and a trusted,
 * deterministic, version-specific raw-scenario adapter. No renderer verdict,
 * network object, oracle fixture, save port or clock enters this interface.
 * The existing repair engine owns all physics, actual deployment requirements,
 * prerequisites and exact current link/endpoint provenance checks.
 *
 * Only the exact committed Rift lifecycle is admitted. The reducer independently
 * receives the same closed, reviewed permission policy; generic safe activities
 * cannot bypass the checkpoint and active-phase requirement.
 */
export function createOutcomeController(options: { readonly registry: ContentRegistry; readonly repairScenario: RepairScenarioResolver }) {
  const { registry, repairScenario } = options;
  const changes = new WeakMap<PreparedOutcomeChange, { before: ReducerState; next: ReducerState; context: OutcomeContext; feedback: OutcomeFeedback; event: OutcomeEvent }>();
  // UI/auth/bootstrap/preferences may replace the containing ReducerState while
  // preserving the accepted immutable game. Restore/new-run clones cannot inherit
  // this receipt. Each subsequent command still captures exact current state/CAS.
  const feedbackGames = new WeakMap<GameState, { event: OutcomeEvent; feedback: OutcomeFeedback }>();
  const bindings = repairEffectBindings(registry);
  function prepared(kind: PreparedOutcomeChange['kind'], before: ReducerState, next: ReducerState, context: OutcomeContext,
    result: OutcomeFeedback, event: OutcomeEvent): OutcomePreparation {
    const change = Object.freeze({ kind }); changes.set(change, { before, next, context, feedback: result, event });
    return { ok: true, change, feedback: result };
  }
  return {
    prepareClassification(state: ReducerState, context: OutcomeContext, command: OutcomeCommand): OutcomePreparation {
      const invalid = captured(state, context); if (invalid) return invalid;
      const caveats = outcomeCaveats(registry); if (!caveats || !bindings.length) return reject('content-error');
      const game = state.runtime.game!;
      if (game.world.completedObjectiveIds.includes(q('O12')) || game.outcomeHistory.some(e => e.attemptId.toLowerCase() === game.world.attemptId.toLowerCase())) return reject('already-classified');
      if (!isActiveRiftEncounter(state)) return reject('invalid-state');
      if (game.outcomeHistory.length >= 256) return reject('history-full');
      if (advanceDirtyGeneration(state.runtime.persistence.dirtyGeneration) === null) return reject('generation-exhausted');
      // Sample exactly once. Both calls to the accepted repair implementation
      // below use this same detached observation, never two environment reads.
      let scenario: RepairScenario | null;
      try {
        const plan = game.world.flags[q<'flag'>('FLAG-repair-executed')];
        const selected = repairPlans.find(p => p.id === plan)?.id;
        if (!selected) return reject('precondition');
        scenario = freeze(structuredClone(repairScenario(freeze(structuredClone(game)), selected)));
      } catch { return reject('content-error'); }
      const authoring = validateRepairClassificationContent(registry, game, scenario); if (authoring) return reject(authoring);
      if (!validCommand(command)) return reject('invalid-input');
      if (game.outcomeHistory.some(e => e.id.toLowerCase() === command.eventId.toLowerCase()) || state.control.actionIds.includes(command.actionId)) return reject('invalid-input');
      const resolver: RepairScenarioResolver = () => scenario;
      const checked = prepareRepairPlanChange(registry, resolver, game, command.operation);
      if (!checked.ok) return reject(checked.reason);
      if (checked.evaluation.status !== 'correct') return { ok: false,
        reason: checked.evaluation.status === 'incorrect' ? 'incorrect' : checked.evaluation.status,
        feedback: feedback(checked.evaluation, null) };
      const reduce = createReducer({ registry, bindings, repairScenario: resolver, allowDuringEncounter: allowRiftEncounterInput });
      const reduced = reduce(state, { actionId: command.actionId, adventureId: context.adventureId,
        expectedVersion: context.expectedVersion, input: { kind: 'repair-plan', operation: command.operation } });
      if (reduced.status !== 'applied') return reject(reduced.reason ?? 'invalid-state');
      const candidate = reduced.state.runtime.game!, classification = repairClassification(candidate);
      if (classification !== command.operation.selection) return reject('invalid-state');
      const outcome = classification === 'permanent' ? 'E01' : classification === 'temporary' ? 'E02' : 'E03';
      const event: OutcomeEvent = freeze({ id: command.eventId.toLowerCase() as OutcomeEventId, outcome,
        attemptId: game.world.attemptId, route: candidate.world.route, caveatIds: caveats[outcome].map(c => c.id) });
      const result = feedback(checked.evaluation, outcome, caveats[outcome]);
      // The reducer already advances dirty/revision and stales old proof after
      // applying classification effects. Append history in that SAME candidate;
      // do not measure again or increment dirty twice for this single action.
      const next: ReducerState = { ...reduced.state, runtime: { ...reduced.state.runtime,
        activity: { kind: outcome === 'E03' ? 'shutdown' : 'cutscene' },
        game: { ...candidate, world: { ...candidate.world, continueOutcome: null }, outcomeHistory: [...candidate.outcomeHistory, event] } } };
      return prepared('classify-outcome', state, next, context, result, event);
    },

    /** Close successful feedback only. Retry, E03 Continue and Restore are T088. */
    prepareDismissal(state: ReducerState, context: OutcomeContext): OutcomePreparation {
      const invalid = captured(state, context); if (invalid) return invalid;
      const game = state.runtime.game!, receipt = feedbackGames.get(game);
      if (!receipt || state.runtime.activity?.kind !== 'cutscene' || receipt.event.outcome === 'E03'
        || receipt.event.attemptId !== game.world.attemptId || !game.outcomeHistory.includes(receipt.event)) return reject('invalid-state');
      const anchor = registry.safePosition(q('R12.entry')), room = registry.record(q('R12'));
      if (room?.kind !== 'room' || room.contentVersion !== game.contentVersion || !anchor || anchor.roomId !== room.id
        || !anchor.eligibleStates.includes('safe-continue') || !room.safePositions.some(p => p.id === anchor.id)
        || game.world.roomId !== room.id || game.world.position.safePositionId !== anchor.id) return reject('unsafe-destination');
      const dirty = advanceDirtyGeneration(state.runtime.persistence.dirtyGeneration); if (dirty === null) return reject('generation-exhausted');
      const next: ReducerState = { ...state, runtime: { ...state.runtime, activity: { kind: 'safe-continue' },
        game: { ...game, world: { ...game.world, continueOutcome: receipt.event.outcome } },
        ui: state.runtime.ui ? { ...state.runtime.ui, feedback: null } : null,
        persistence: { ...state.runtime.persistence, dirtyGeneration: dirty,
          status: state.runtime.persistence.status === 'saved' ? 'unsaved' : state.runtime.persistence.status } } };
      return prepared('dismiss-outcome-feedback', state, next, context, receipt.feedback, receipt.event);
    },

    /** Only installation point; no notification, save, reward callback or IO. */
    commit(store: OutcomeStore, change: PreparedOutcomeChange): OutcomeCommit {
      const pending = changes.get(change);
      if (!pending || store.getState() !== pending.before) return reject('stale-context');
      const invalid = captured(pending.before, pending.context); if (invalid) return invalid;
      if (!store.compareAndSet(pending.before, pending.next)) return reject('stale-context');
      changes.delete(change);
      if (change.kind === 'classify-outcome') feedbackGames.set(pending.next.runtime.game!, { event: pending.event, feedback: pending.feedback });
      else feedbackGames.delete(pending.before.runtime.game!);
      return { ok: true, state: pending.next, feedback: pending.feedback };
    },

    /** Accepted transient feedback for presentation; never synthesized from flags. */
    feedback(state: ReducerState): OutcomeFeedback | null {
      const game = state.runtime.game, receipt = game && feedbackGames.get(game);
      return game && receipt && !state.control.pending && receipt.event.attemptId === game.world.attemptId
        && game.outcomeHistory.includes(receipt.event) && (receipt.event.outcome === 'E03'
          ? state.runtime.activity?.kind === 'shutdown' : state.runtime.activity?.kind === 'cutscene') ? receipt.feedback : null;
    },
  };
}
