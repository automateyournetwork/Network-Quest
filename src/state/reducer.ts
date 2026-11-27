// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import type { ContentRegistry } from '../content/registry';
import type * as S from '../content/schema-types.generated';
import type {
  ActionId, AdventureId, AttemptId, ConfigurationRevision, DialogueEffectId, DomainAction,
  EffectId, EvaluationResult, FlagId, IdentifiedEffect, ItemId, MinigameId, ObjectiveId, QualifiedId,
  QuestId, RoomId, SafePositionId, WorldVersion,
} from '../domain/types';
import type { ActivityState, DirtyGeneration, GameState, Measurement, RuntimeState, SafeState, WorldState } from './types';
import { conditionSupported as supportedCondition, conditionSatisfied as conditionMet } from './conditions';
import { minigameAchievement } from './conditions';
import { prepareRadioAction, createRadioScenarioResolver } from './radio-scenario';
import { prepareOptionalActivityChange, finalizeOptionalSession, rewindOptionalPreparation } from './optional-activities';
import type { OptionalActivityOperation, OptionalActivitySession } from './optional-activities';
import { prepareNotebookChange } from './notebook';
import type { NotebookOperation } from './notebook';
import { prepareObjectiveChange } from './objectives';
import type { ObjectiveOperation, ObjectiveScenarioResolver } from './objectives';
import { prepareRepairPlanChange } from './repair-plan';
import type { RepairPlanOperation, RepairScenarioResolver } from './repair-plan';
import { preparePartyChange, capturePartyPractice } from './party';
import type { PartyOperation, PartyPractice } from './party';

/** Authored effects only. Evaluators select them; the reducer never scores physics. */
export type StateEffect = S.effect & IdentifiedEffect;
export type CompletionReceipt =
  | { readonly kind: 'objective'; readonly id: ObjectiveId }
  | { readonly kind: 'quest'; readonly id: QuestId }
  | { readonly kind: 'minigame'; readonly id: MinigameId }
  | { readonly kind: 'dialogue-effect'; readonly id: DialogueEffectId }
  | { readonly kind: 'flag'; readonly id: FlagId };

/**
 * A content adapter declares one canonical receipt for each one-time effect.
 * Objective/quest receipts admit one full authored alternative batch (its
 * effects plus common effects). Other shared receipts form one indivisible group. A flag receipt
 * must itself be an authored true-valued set-flag effect in that same group.
 * Dialogue receipts use existing authored dialogue effect IDs only. No new
 * save keys, synthetic marker IDs or generic ledger in dialogueEffectIds.
 */
export type EffectBinding = {
  readonly sourceId: QualifiedId;
  readonly effectId: EffectId;
} & ({ readonly mode: 'once'; readonly receipt: CompletionReceipt } | { readonly mode: 'repeatable' });

export interface Destination {
  readonly roomId: RoomId;
  readonly safePositionId: SafePositionId;
  readonly activity: SafeState;
}
interface EffectRequest {
  readonly evaluation: EvaluationResult<unknown, StateEffect>;
  readonly destination?: Destination;
}
export type ReducerInput =
  | { readonly kind: 'optional-activity'; readonly operation: OptionalActivityOperation }
  | { readonly kind: 'party'; readonly operation: PartyOperation }
  | { readonly kind: 'repair-plan'; readonly operation: RepairPlanOperation }
  | { readonly kind: 'objective'; readonly operation: ObjectiveOperation }
  | { readonly kind: 'notebook'; readonly operation: NotebookOperation }
  | (EffectRequest & { readonly kind: 'apply' })
  | (EffectRequest & { readonly kind: 'begin'; readonly activity: 'pending-effect' | 'room-transition' | 'dialogue-transaction' })
  | { readonly kind: 'commit'; readonly transitionActionId: ActionId }
  | { readonly kind: 'cancel'; readonly transitionActionId: ActionId }
  | { readonly kind: 'cancel-logout' }
  | { readonly kind: 'recover-item'; readonly itemId: ItemId }
  /** Primitive for T084. Encounter capture/classification/confirmation is separate. */
  | { readonly kind: 'rewind-preparation'; readonly nextAttemptId: AttemptId };
export interface ReducerCommand extends DomainAction<ReducerInput> { readonly adventureId: AdventureId }

interface PendingTransition {
  readonly actionId: ActionId;
  readonly adventureId: AdventureId;
  readonly expectedVersion: WorldVersion;
  readonly request: EffectRequest;
  readonly previousActivity: ActivityState;
}
/** All bookkeeping is transient, outside RuntimeState.game and the save schema. */
export interface ReducerState {
  readonly runtime: RuntimeState;
  readonly control: {
    readonly actionIds: readonly ActionId[];
    readonly pending: PendingTransition | null;
    readonly highestRevision: number;
    readonly usedAttemptIds: readonly AttemptId[];
    /** Unfinished demonstrated learning is transient and retires on restore/retry. */
    readonly partyPractice?: PartyPractice | null;
    readonly optionalActivity?: OptionalActivitySession | null;
  };
}
export type RejectionReason =
  | 'no-adventure' | 'wrong-adventure' | 'invalid-action' | 'stale-version'
  | 'invalid-input' | 'content-error' | 'precondition' | 'insufficient-items'
  | 'invalid-state' | 'transition-pending' | 'unknown-transition' | 'unsafe-destination'
  | 'item-not-consumable' | 'unrecoverable-item' | 'recovery-unavailable'
  | 'generation-exhausted' | 'attempt-reused' | 'no-preparation';
export interface Reduction {
  readonly state: ReducerState;
  readonly status: 'applied' | 'pending' | 'canceled' | 'no-op' | 'rejected';
  readonly reason?: RejectionReason;
}
export interface ReducerOptions {
  readonly registry: ContentRegistry;
  readonly bindings: readonly EffectBinding[];
  readonly objectiveScenario?: ObjectiveScenarioResolver;
  readonly repairScenario?: RepairScenarioResolver;
  /** Trusted pure closed permission for canonical notebook/objective/repair operations only. */
  readonly allowDuringEncounter?: (state: ReducerState, input: ReducerInput) => boolean;
  /**
   * Trusted pure navigation adapter, using actual unlocked/reversible paths in
   * the supplied candidate world. Default proves only a zero-step path. T028
   * must supply this before enabling remote recovery transformations.
   */
  readonly canReachRoom?: (world: WorldState, roomId: RoomId) => boolean;
}
interface ResolvedBinding {
  readonly binding: EffectBinding;
  readonly effect: StateEffect;
  readonly conditions: readonly (readonly S.condition[])[];
}
interface AtomicBatch {
  readonly id: string;
  readonly effectIds: readonly string[];
  readonly conditions: readonly S.condition[];
}
type Candidate = { readonly game: GameState; readonly activity: ActivityState; readonly changed: boolean; readonly revision: number };
type CandidateResult = { readonly ok: true; readonly value: Candidate } | { readonly ok: false; readonly reason: RejectionReason };
const MAX_REVISION = 2_147_483_647;
const safeKinds = new Set(['stable-exploration', 'safe-preparation', 'safe-continue']);
const idPattern = /^spec[0-9]{3}:[A-Za-z0-9][A-Za-z0-9._-]{0,55}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const sameVersion = (a: WorldVersion, b: WorldVersion) => a.attemptId === b.attemptId && a.configurationRevision === b.configurationRevision;
const receiptKey = (r: CompletionReceipt) => `${r.kind}:${r.id}`;
const failure = (reason: RejectionReason): CandidateResult => ({ ok: false, reason });

export function isMeasurementCurrent(measurement: Measurement, world: WorldVersion): boolean {
  return !measurement.stale && sameVersion(measurement, world);
}

/** Call only with trusted initial state or a validated/migrated saved snapshot. */
export function createReducerState(runtime: RuntimeState): ReducerState {
  const worlds = [runtime.game?.world, runtime.checkpoint?.world].filter((w): w is WorldState => !!w);
  const measurements = runtime.game?.notebook.measurements ?? [];
  return { runtime, control: {
    actionIds: [], pending: null,
    highestRevision: Math.max(0, ...worlds.map(w => w.configurationRevision), ...measurements.map(m => m.configurationRevision)),
    usedAttemptIds: [...new Set([...worlds.map(w => w.attemptId), ...measurements.map(m => m.attemptId),
      ...(runtime.game?.assistance.map(h => h.attemptId) ?? []), ...(runtime.game?.outcomeHistory.map(o => o.attemptId) ?? [])].map(id => id.toLowerCase() as AttemptId))],
    partyPractice: null,
    optionalActivity: null,
  } };
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function receiptApplied(world: WorldState, receipt: CompletionReceipt, registry: ContentRegistry): boolean {
  switch (receipt.kind) {
    case 'objective': return world.completedObjectiveIds.includes(receipt.id);
    case 'quest': return world.completedQuestIds.includes(receipt.id);
    case 'minigame': { const id = minigameAchievement(registry, receipt.id); return id !== null && world.achievementIds.includes(id); }
    case 'dialogue-effect': return world.dialogueEffectIds.includes(receipt.id);
    case 'flag': return world.flags[receipt.id] === true;
  }
}
/** Resolve actual authored definitions and their ancestor conditions, not caller-supplied payloads. */
function findEffects(record: Readonly<S.authoredRecord>, effectId: EffectId): { effect: StateEffect; conditions: S.condition[] }[] {
  const found: { effect: StateEffect; conditions: S.condition[] }[] = [];
  const visit = (value: unknown, conditions: S.condition[]) => {
    if (Array.isArray(value)) { value.forEach(v => visit(v, conditions)); return; }
    if (!value || typeof value !== 'object') return;
    const object = value as Record<string, unknown>;
    const next = [...conditions];
    for (const key of ['condition', 'prerequisite']) if (object[key]) next.push(object[key] as S.condition);
    if (object['effectId'] === effectId) found.push({ effect: object as unknown as StateEffect, conditions: next });
    Object.entries(object).filter(([key]) => key !== 'condition' && key !== 'prerequisite').forEach(([, child]) => visit(child, next));
  };
  visit(record, []);
  return found;
}
function resolveBindings(options: ReducerOptions): Map<EffectId, ResolvedBinding> | null {
  const resolved = new Map<EffectId, ResolvedBinding>();
  for (const raw of options.bindings) {
    const binding = structuredClone(raw);
    const source = options.registry.record(binding.sourceId);
    if (!source || !idPattern.test(binding.effectId) || !options.registry.has('effect', binding.effectId)) return null;
    const matches = findEffects(source, binding.effectId);
    const first = matches[0];
    if (!first || matches.some(m => canonical(m.effect) !== canonical(first.effect) || !m.conditions.every(condition => supportedCondition(condition, options.registry)))) return null;
    // Content's broad ID allowance is larger than save v1's. Reject a binding
    // that would insert a non-serializable ID before it can award anything.
    if (Object.entries(first.effect).some(([key, value]) => key.endsWith('Id') && (typeof value !== 'string' || !idPattern.test(value)))) return null;
    const existing = resolved.get(binding.effectId);
    // Shared authored definitions may have one canonical binding, never two
    // different receipt anchors or a repeatable alias for a one-time reward.
    if (existing && canonical(existing.binding) !== canonical(binding)) return null;
    if (binding.mode === 'repeatable' && ['grant-item', 'consume-item', 'complete-objective', 'complete-quest', 'complete-minigame'].includes(first.effect.kind)) return null;
    if (binding.mode === 'once') {
      const r = binding.receipt;
      if (!idPattern.test(r.id)) return null;
      if (r.kind === 'dialogue-effect') {
        if (source.kind !== 'dialogue' || !findEffects(source, r.id as unknown as EffectId).length) return null;
      } else if (!options.registry.has(r.kind, r.id)) return null;
      if (r.kind === 'minigame' && !minigameAchievement(options.registry, r.id)) return null;
    }
    resolved.set(binding.effectId, { binding, effect: structuredClone(first.effect), conditions: structuredClone(matches.map(m => m.conditions)) });
  }
  for (const entry of resolved.values()) {
    const b = entry.binding;
    if (b.mode !== 'once') continue;
    const receipt = b.receipt;
    const group = [...resolved.values()].filter(e => e.binding.mode === 'once' && receiptKey(e.binding.receipt) === receiptKey(receipt));
    if (!group.some(({ effect: e }) => (receipt.kind === 'objective' && e.kind === 'complete-objective' && e.objectiveId === receipt.id)
      || (receipt.kind === 'quest' && e.kind === 'complete-quest' && e.questId === receipt.id)
      || (receipt.kind === 'minigame' && e.kind === 'complete-minigame' && e.minigameId === receipt.id)
      || (receipt.kind === 'flag' && e.kind === 'set-flag' && e.flagId === receipt.id && e.value === true)
      || (receipt.kind === 'dialogue-effect' && e.effectId === (receipt.id as unknown as EffectId)))) return null;
  }
  // Durable flag receipts must be monotonic until a whole-world retry/restore.
  const flags = new Set([...resolved.values()].flatMap(e => e.binding.mode === 'once' && e.binding.receipt.kind === 'flag' ? [e.binding.receipt.id] : []));
  if ([...resolved.values()].some(e => e.effect.kind === 'set-flag' && flags.has(e.effect.flagId as FlagId)
    && (e.effect.value !== true || e.binding.mode !== 'once'))) return null;
  return resolved;
}

function nextRevision(state: ReducerState): ConfigurationRevision | null {
  const highest = Math.max(state.control.highestRevision, state.runtime.game?.world.configurationRevision ?? 0,
    ...state.runtime.game?.notebook.measurements.map(m => m.configurationRevision) ?? []);
  return Number.isInteger(highest) && highest >= 0 && highest < MAX_REVISION ? (highest + 1) as ConfigurationRevision : null;
}
function staleMeasurements(game: GameState): GameState['notebook'] {
  return { ...game.notebook, measurements: game.notebook.measurements.map(m => m.stale ? m : { ...m, stale: true }) };
}
function safeDestination(registry: ContentRegistry, destination: Destination): boolean {
  const anchor = registry.safePosition(destination.safePositionId);
  return registry.has('room', destination.roomId) && !!anchor && anchor.roomId === destination.roomId
    && safeKinds.has(destination.activity) && anchor.eligibleStates.includes(destination.activity);
}
function legalWorld(world: WorldState): boolean {
  return Number.isInteger(world.configurationRevision) && world.configurationRevision >= 0 && world.configurationRevision <= MAX_REVISION
    && world.inventory.length <= 256 && new Set(world.inventory.map(i => i.itemId)).size === world.inventory.length
    && world.inventory.every(i => Number.isInteger(i.quantity) && i.quantity > 0 && i.quantity <= 99)
    && world.recruits.length <= 25 && new Set(world.recruits.map(r => r.characterId)).size === world.recruits.length
    && world.recruits.every(r => r.level >= 1 && r.level <= 100 && Number.isInteger(r.level) && r.abilityIds.length <= 32 && new Set(r.abilityIds).size === r.abilityIds.length)
    && world.activeAllyIds.length <= 2 && new Set(world.activeAllyIds).size === world.activeAllyIds.length
    && world.activeAllyIds.every(id => world.recruits.some(r => r.characterId === id))
    && world.completedObjectiveIds.length <= 64 && world.completedQuestIds.length <= 64 && world.achievementIds.length <= 128 && world.dialogueEffectIds.length <= 1024
    && Object.keys(world.flags).length <= 512;
}

export function createReducer(options: ReducerOptions): (state: ReducerState, command: ReducerCommand) => Reduction {
  const resolved = resolveBindings(options);
  const { registry } = options;
  const canReach = options.canReachRoom ?? ((world: WorldState, roomId: RoomId) => world.roomId === roomId);
  const recoveryAvailable = (recovery: S.recovery, world: WorldState, atSource: boolean) => recovery.policy !== 'not-consumed' && supportedCondition(recovery.condition, registry)
    && registry.has('room', recovery.roomId) && conditionMet(recovery.condition, world, registry)
    && (atSource ? world.roomId === recovery.roomId : canReach(world, recovery.roomId as RoomId));
  const items = [...new Set([...(resolved?.values() ?? [])].flatMap(e => e.effect.kind === 'consume-item' || e.effect.kind === 'grant-item' ? [e.effect.itemId] : []))]
    .map(id => registry.record(id)).filter((record): record is S.item => record?.kind === 'item');
  // A combination belongs to its declaring item, and may consume another item
  // that has no reciprocal combination record of its own.
  const combinations = items.flatMap(owner => owner.combinations.map(combination => ({ owner, combination })));

  function batches(receipt: CompletionReceipt): readonly AtomicBatch[] {
    if (receipt.kind === 'objective' || receipt.kind === 'quest' || receipt.kind === 'minigame') {
      const source = registry.record(receipt.id);
      if (source?.kind !== receipt.kind) return [];
      if (source.alternatives?.length) return source.alternatives.map(alternative => ({
        id: alternative.id, effectIds: [...source.effects, ...alternative.effects].map(e => e.effectId),
        conditions: [source.prerequisite, alternative.condition],
      }));
      return [{ id: source.id, effectIds: source.effects.map(e => e.effectId), conditions: [source.prerequisite] }];
    }
    return [{ id: receipt.id, effectIds: [...(resolved?.values() ?? [])].filter(e => e.binding.mode === 'once'
      && receiptKey(e.binding.receipt) === receiptKey(receipt)).map(e => e.effect.effectId), conditions: [] }];
  }

  function transformation(item: S.item, effects: readonly StateEffect[], before: WorldState, after: WorldState): S.combination | undefined {
    return combinations.find(({ owner, combination: c }) => [owner.id, c.withItemId].includes(item.id)
      && c.consumesInputs && supportedCondition(c.condition, registry) && conditionMet(c.condition, before, registry)
      && [owner.id, c.withItemId].every(itemId => effects.some(e => e.kind === 'consume-item' && e.itemId === itemId))
      && c.effects.some(e => e.kind === 'grant-item')
      && c.effects.every(e => effects.some(actual => canonical(actual) === canonical(e)))
      && recoveryAvailable(c.recovery, after, false) && recoveryAvailable(item.recovery, after, false))?.combination;
  }
  function consumedRecovery(item: S.item, world: WorldState, atSource: boolean): boolean {
    return recoveryAvailable(item.recovery, world, atSource) && [...(resolved?.values() ?? [])].some(e => e.effect.kind === 'consume-item' && e.effect.itemId === item.id
      && e.binding.mode === 'once' && receiptApplied(world, e.binding.receipt, registry)
      && combinations.some(({ owner, combination: c }) => [owner.id, c.withItemId].includes(item.id) && c.consumesInputs
        && c.effects.some(effect => canonical(effect) === canonical(e.effect)) && recoveryAvailable(c.recovery, world, atSource)));
  }

  function prepare(state: ReducerState, request: EffectRequest): CandidateResult {
    const game = state.runtime.game!;
    const evaluation = request.evaluation;
    if (evaluation.status === 'invalid-input' || evaluation.status === 'content-error') return failure(evaluation.status);
    if (!resolved || !['correct', 'incorrect'].includes(evaluation.status) || !Array.isArray(evaluation.acceptedEffects)) return failure('content-error');
    const supplied = evaluation.acceptedEffects;
    if (supplied.length > 1024 || new Set(supplied.map(e => e.effectId)).size !== supplied.length) return failure('content-error');
    const selected: ResolvedBinding[] = [];
    for (const effect of supplied) {
      const entry = resolved.get(effect.effectId);
      if (!entry || canonical(effect) !== canonical(entry.effect)) return failure('content-error');
      if (entry.binding.mode === 'once' && receiptApplied(game.world, entry.binding.receipt, registry)) continue;
      if (!entry.conditions.some(conditions => conditions.every(c => conditionMet(c, game.world, registry)))) return failure('precondition');
      selected.push(entry);
    }
    for (const { binding } of selected) if (binding.mode === 'once') {
      const group = selected.filter(e => e.binding.mode === 'once' && receiptKey(e.binding.receipt) === receiptKey(binding.receipt));
      const completeBatch = batches(binding.receipt).some(batch => batch.conditions.every(c => supportedCondition(c, registry) && conditionMet(c, game.world, registry))
        && batch.effectIds.every(id => supplied.some(e => e.effectId === id)) && group.every(e => batch.effectIds.includes(e.effect.effectId)));
      if (!completeBatch) return failure('content-error');
    }
    if (request.destination && !safeDestination(registry, request.destination)) return failure('unsafe-destination');
    if (!legalWorld(game.world)) return failure('invalid-state');
    const effects = selected.map(e => e.effect);
    const inventory = new Map(game.world.inventory.map(i => [i.itemId, i.quantity]));
    // Affordability is checked over the entire debit before any credit. Caller
    // ordering cannot fund an otherwise impossible consumption from its reward.
    const debits = new Map<ItemId, number>();
    for (const e of effects) if (e.kind === 'consume-item' || e.kind === 'grant-item') {
      if (!registry.has('item', e.itemId) || !Number.isInteger(e.quantity) || e.quantity < 1 || e.quantity > 99) return failure('content-error');
      if (e.kind === 'consume-item') debits.set(e.itemId as ItemId, (debits.get(e.itemId as ItemId) ?? 0) + e.quantity);
    }
    for (const [itemId, debit] of debits) {
      if ((inventory.get(itemId) ?? 0) < debit) return failure('insufficient-items');
      inventory.set(itemId, inventory.get(itemId)! - debit);
    }
    let world: WorldState = game.world;
    let notebook = game.notebook;
    for (const e of effects) {
      switch (e.kind) {
        case 'grant-item': inventory.set(e.itemId as ItemId, (inventory.get(e.itemId as ItemId) ?? 0) + e.quantity); break;
        case 'consume-item': break;
        case 'set-flag':
          if (!registry.has('flag', e.flagId) || (typeof e.value === 'number' && (!Number.isInteger(e.value) || e.value < -2_147_483_648 || e.value > MAX_REVISION))
            || (typeof e.value === 'string' && [...e.value].length > 128)) return failure('content-error');
          world = { ...world, flags: { ...world.flags, [e.flagId]: e.value } }; break;
        case 'complete-objective':
          if (!registry.has('objective', e.objectiveId)) return failure('content-error');
          world = { ...world, completedObjectiveIds: [...new Set([...world.completedObjectiveIds, e.objectiveId as ObjectiveId])] }; break;
        case 'complete-quest':
          if (!registry.has('quest', e.questId)) return failure('content-error');
          world = { ...world, completedQuestIds: [...new Set([...world.completedQuestIds, e.questId as QuestId])] }; break;
        case 'complete-minigame': {
          const id = minigameAchievement(registry, e.minigameId); if (!id) return failure('content-error');
          world = { ...world, achievementIds: [...new Set([...world.achievementIds, id])] }; break;
        }
        case 'record-fact':
          if (!registry.has('fact', e.factId)) return failure('content-error');
          notebook = { ...notebook, factIds: [...new Set([...notebook.factIds, e.factId as GameState['notebook']['factIds'][number]])] }; break;
        case 'set-route': world = { ...world, route: e.route }; break;
        case 'recruit-character': {
          const character = registry.record(e.characterId);
          if (character?.kind !== 'character' || !character.recruitable) return failure('content-error');
          if (!world.recruits.some(r => r.characterId === e.characterId)) world = { ...world, recruits: [...world.recruits, {
            characterId: e.characterId as WorldState['recruits'][number]['characterId'], level: 1, abilityIds: [], progressFlags: [],
          }] };
          break;
        }
        case 'unlock-ability': {
          const character = registry.record(e.characterId);
          if (character?.kind !== 'character' || !character.abilities.some(a => a.id === e.abilityId)) return failure('content-error');
          if (!world.recruits.some(r => r.characterId === e.characterId)) return failure('precondition');
          world = { ...world, recruits: world.recruits.map(r => r.characterId === e.characterId
            ? { ...r, abilityIds: [...new Set([...r.abilityIds, e.abilityId as typeof r.abilityIds[number]])] } : r) };
          break;
        }
      }
    }
    world = { ...world, inventory: [...inventory].filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ itemId, quantity })) };
    for (const { binding } of selected) if (binding.mode === 'once' && binding.receipt.kind === 'dialogue-effect') {
      world = { ...world, dialogueEffectIds: [...new Set([...world.dialogueEffectIds, binding.receipt.id])] };
    }
    if (request.destination) {
      world = { ...world, roomId: request.destination.roomId, position: { safePositionId: request.destination.safePositionId },
        continueOutcome: request.destination.activity === 'safe-continue' ? world.continueOutcome : null };
      notebook = { ...notebook, mapRoomIds: [...new Set([...notebook.mapRoomIds, game.world.roomId, request.destination.roomId])] };
      if (notebook.mapRoomIds.length > 128) return failure('invalid-state');
    }
    if (!legalWorld(world) || notebook.factIds.length > 1024) return failure('invalid-state');
    for (const itemId of debits.keys()) {
      const item = registry.record(itemId);
      if (item?.kind !== 'item') return failure('content-error');
      if (item.consumption === 'never') return failure('item-not-consumable');
      if (!transformation(item, effects, game.world, world)) return failure('unrecoverable-item');
    }
    for (const item of items) if (item.essentialForRoutes.length && !world.inventory.some(i => i.itemId === item.id)) {
      const consumed = [...resolved.values()].some(e => e.effect.kind === 'consume-item' && e.effect.itemId === item.id
        && e.binding.mode === 'once' && receiptApplied(world, e.binding.receipt, registry));
      if (consumed && !consumedRecovery(item, world, false)) return failure('unrecoverable-item');
    }
    const physical = (w: WorldState) => [w.flags, w.inventory, w.recruits, w.activeAllyIds, w.route, w.roomId, w.position];
    if (canonical(physical(world)) !== canonical(physical(game.world))) {
      const revision = nextRevision(state);
      if (revision === null) return failure('generation-exhausted');
      world = { ...world, configurationRevision: revision };
      notebook = { ...notebook, measurements: staleMeasurements(game).measurements };
    }
    const candidate = { ...game, world, notebook };
    const activity: ActivityState = request.destination ? { kind: request.destination.activity } : state.runtime.activity!;
    return { ok: true, value: { game: candidate, activity, changed: canonical(candidate) !== canonical(game), revision: world.configurationRevision } };
  }

  function recordAction(state: ReducerState, actionId: ActionId): ReducerState {
    return state.control.actionIds.includes(actionId) ? state : { ...state, control: { ...state.control, actionIds: [...state.control.actionIds, actionId] } };
  }
  function accept(state: ReducerState, actionId: ActionId, candidate: Candidate, clearPending = false): Reduction {
    const activityChanged = candidate.activity.kind !== state.runtime.activity?.kind;
    if (!candidate.changed && !activityChanged && !clearPending) return { state: recordAction(state, actionId), status: 'no-op' };
    const dirty = state.runtime.persistence.dirtyGeneration;
    if (candidate.changed && (!Number.isSafeInteger(dirty) || dirty >= Number.MAX_SAFE_INTEGER)) return { state, status: 'rejected', reason: 'generation-exhausted' };
    const next = recordAction(state, actionId);
    return { status: candidate.changed || activityChanged ? 'applied' : 'no-op', state: {
      runtime: { ...state.runtime, game: candidate.changed ? candidate.game : state.runtime.game, activity: candidate.activity,
        persistence: candidate.changed ? { ...state.runtime.persistence, dirtyGeneration: (dirty + 1) as DirtyGeneration,
          status: state.runtime.persistence.status === 'saved' ? 'unsaved' : state.runtime.persistence.status } : state.runtime.persistence },
      control: { ...next.control, highestRevision: Math.max(next.control.highestRevision, candidate.revision), pending: clearPending ? null : next.control.pending },
    } };
  }

  return function reduce(state, command) {
    const reject = (reason: RejectionReason): Reduction => ({ state, status: 'rejected', reason });
    const game = state.runtime.game;
    // Canceling the logout choice has no gameplay, identity or bookkeeping effect.
    if (command.input.kind === 'cancel-logout') return { state, status: 'no-op' };
    if (!game || !state.runtime.activity) return reject('no-adventure');
    if (command.adventureId !== game.adventureId) return reject('wrong-adventure');
    if (typeof command.actionId !== 'string' || !command.actionId.trim() || command.actionId.length > 128) return reject('invalid-action');
    if (!sameVersion(command.expectedVersion, game.world)) return reject('stale-version');
    if (!resolved) return reject('content-error');
    if (state.control.actionIds.includes(command.actionId)) return { state, status: 'no-op' };
    const input = command.input;
    const pending = state.control.pending;
    if (input.kind === 'commit' || input.kind === 'cancel') {
      if (!pending || pending.actionId !== input.transitionActionId) return reject('unknown-transition');
      if (pending.adventureId !== game.adventureId || !sameVersion(pending.expectedVersion, game.world)) return reject('stale-version');
      if (input.kind === 'cancel') {
        const next = recordAction(state, command.actionId);
        return { status: 'canceled', state: { runtime: { ...state.runtime, activity: pending.previousActivity }, control: { ...next.control, pending: null } } };
      }
      const result = prepare(state, pending.request);
      if (!result.ok) return reject(result.reason);
      return accept(state, command.actionId, { ...result.value, activity: pending.request.destination ? result.value.activity : pending.previousActivity }, true);
    }
    if (pending) return reject('transition-pending');
    if (input.kind === 'optional-activity') {
      const result = prepareOptionalActivityChange(registry, game, state.runtime.activity, state.control.optionalActivity ?? null,
        input.operation, command, state.runtime.auth.clientGeneration);
      if (!result.ok) return reject(result.reason);
      let candidateGame = result.game, control = state.control;
      if (result.retry) {
        const session = state.control.optionalActivity;
        if (!session) return reject('invalid-state');
        const retried = rewindOptionalPreparation(candidateGame, session, result.retry.nextAttemptId, control);
        if (!retried.ok) return reject(retried.reason);
        candidateGame = retried.game; control = { ...control, highestRevision: retried.highestRevision, usedAttemptIds: retried.usedAttemptIds, partyPractice: null };
      }
      // Trusted closed radio directives compose existing operations inside this
      // optional transaction. Activity admission stays active-optional throughout.
      if (result.radio) {
        const radio = result.radio;
        if (radio.kind === 'select') {
          const prepared = prepare({ ...state, runtime: { ...state.runtime, game: candidateGame } }, { evaluation: prepareRadioAction(registry, candidateGame, radio.actionId) });
          if (!prepared.ok) return reject(prepared.reason);
          candidateGame = prepared.value.game;
        } else {
          const resolver = createRadioScenarioResolver(registry), scenario = resolver(candidateGame, 'spec001:O08' as ObjectiveId);
          if (scenario?.kind !== 'radio-proof') return reject('content-error');
          const measured = prepareObjectiveChange(registry, resolver, candidateGame, { kind: 'measure', objectiveId: 'spec001:O08' as ObjectiveId, alternativeId: scenario.alternativeId, id: radio.id });
          if (!measured.ok) return reject(measured.reason);
          const prepared = prepare({ ...state, runtime: { ...state.runtime, game: candidateGame } }, { evaluation: measured.evaluation });
          if (!prepared.ok) return reject(prepared.reason);
          const final = measured.finalize(prepared.value.game); if (!final.ok) return reject(final.reason);
          candidateGame = final.game;
        }
      }
      // Invalid learner input/content reports feedback with no effects. Only a
      // valid full-delivery selection reaches the canonical atomic batch check.
      if (result.evaluation.acceptedEffects.length) {
        const prepared = prepare({ ...state, runtime: { ...state.runtime, game: candidateGame } }, { evaluation: result.evaluation });
        if (!prepared.ok) return reject(prepared.reason);
        candidateGame = prepared.value.game;
      }
      if (!legalWorld(candidateGame.world) || candidateGame.assistance.length > 2048) return reject('invalid-state');
      const session = finalizeOptionalSession(result.session, candidateGame, registry);
      const reduced = accept(state, command.actionId, { game: candidateGame, activity: result.activity,
        changed: canonical(candidateGame) !== canonical(game), revision: candidateGame.world.configurationRevision });
      if (reduced.status === 'rejected') return reduced;
      return { status: reduced.status === 'no-op' && session !== state.control.optionalActivity ? 'applied' : reduced.status,
        state: { ...reduced.state, runtime: input.operation.kind === 'start' && reduced.state.runtime.ui ? { ...reduced.state.runtime, ui: { ...reduced.state.runtime.ui, panel: 'none' } } : reduced.state.runtime,
          control: { ...reduced.state.control, highestRevision: Math.max(control.highestRevision, reduced.state.control.highestRevision),
          usedAttemptIds: control.usedAttemptIds, partyPractice: control.partyPractice ?? null, optionalActivity: session } } };
    }
    if (input.kind === 'party') {
      // Party work never broadens the committed-encounter action admission.
      const anchor = registry.safePosition(game.world.position.safePositionId);
      if (!safeKinds.has(state.runtime.activity.kind) || !anchor || anchor.roomId !== game.world.roomId
        || !anchor.eligibleStates.includes(state.runtime.activity.kind as SafeState)) return reject('invalid-state');
      const result = preparePartyChange(registry, options.objectiveScenario, game, input.operation, state.control.partyPractice);
      if (!result.ok) return reject(result.reason);
      // The authorized ally delegates the SAME canonical operation; it does not
      // return a renderer verdict or install a second effect/receipt path.
      if ('delegate' in result) return reduce(state, { ...command, input: result.delegate });
      let candidate = result.game;
      if (result.configurationChanged) {
        const revision = nextRevision(state);
        if (revision === null) return reject('generation-exhausted');
        candidate = { ...candidate, world: { ...candidate.world, configurationRevision: revision }, notebook: staleMeasurements(candidate) };
      }
      if (!legalWorld(candidate.world) || candidate.world.compendiumIds.length > 256) return reject('invalid-state');
      const reduction = accept(state, command.actionId, { game: candidate, activity: state.runtime.activity,
        changed: canonical(candidate) !== canonical(game), revision: candidate.world.configurationRevision });
      if (reduction.status === 'rejected' || result.practice === (state.control.partyPractice ?? null)) return reduction;
      return { status: reduction.status === 'no-op' ? 'applied' : reduction.status, state: {
        ...reduction.state, control: { ...reduction.state.control, partyPractice: result.practice },
      } };
    }
    if (input.kind === 'notebook' || input.kind === 'objective' || input.kind === 'repair-plan') {
      if (!safeKinds.has(state.runtime.activity.kind)) {
        let admitted = false;
        if (state.runtime.activity.kind === 'active-encounter') {
          try { admitted = options.allowDuringEncounter?.(state, input) === true; } catch { /* Closed on policy failure. */ }
        }
        if (!admitted) return reject('invalid-state');
      }
      const notebook = input.kind === 'notebook' ? prepareNotebookChange(registry, game, input.operation)
        : input.kind === 'objective' ? prepareObjectiveChange(registry, options.objectiveScenario, game, input.operation)
          : prepareRepairPlanChange(registry, options.repairScenario, game, input.operation);
      if (!notebook.ok) return reject(notebook.reason);
      const prepared = prepare(state, { evaluation: notebook.evaluation });
      if (!prepared.ok) return reject(prepared.reason);
      const final = notebook.finalize(prepared.value.game);
      if (!final.ok) return reject(final.reason);
      const accepted = accept(state, command.actionId, { ...prepared.value, game: final.game,
        activity: input.kind === 'repair-plan' && 'activity' in final ? (final.activity as ActivityState | undefined) ?? prepared.value.activity : prepared.value.activity,
        changed: canonical(final.game) !== canonical(game) });
      if (accepted.status === 'rejected' || input.kind !== 'objective' || input.operation.kind !== 'measure') return accepted;
      const practice = capturePartyPractice(options.objectiveScenario, game, final.game, input.operation, state.control.partyPractice);
      return practice === (state.control.partyPractice ?? null) ? accepted : { ...accepted, state: { ...accepted.state,
        control: { ...accepted.state.control, partyPractice: practice } } };
    }
    if (input.kind === 'rewind-preparation') {
      const checkpoint = state.runtime.checkpoint;
      if (!['terminal-failure', 'shutdown'].includes(state.runtime.activity.kind) || !checkpoint || checkpoint.adventureId !== game.adventureId
        || !legalWorld(checkpoint.world) || !safeDestination(registry, { roomId: checkpoint.world.roomId, safePositionId: checkpoint.world.position.safePositionId, activity: 'safe-preparation' })) return reject('no-preparation');
      if (!uuidPattern.test(input.nextAttemptId)) return reject('invalid-action');
      const nextAttemptId = input.nextAttemptId.toLowerCase() as AttemptId;
      if (state.control.usedAttemptIds.includes(nextAttemptId)) return reject('attempt-reused');
      const revision = nextRevision(state);
      if (revision === null) return reject('generation-exhausted');
      const world: WorldState = { ...structuredClone(checkpoint.world), attemptId: nextAttemptId, configurationRevision: revision };
      const result = accept(state, command.actionId, { game: { ...game, world, notebook: staleMeasurements(game) }, activity: { kind: 'safe-preparation' }, changed: true, revision });
      return result.status === 'rejected' ? result : { ...result, state: { ...result.state, control: { ...result.state.control, usedAttemptIds: [...state.control.usedAttemptIds, nextAttemptId], partyPractice: null, optionalActivity: null } } };
    }
    if (!safeKinds.has(state.runtime.activity.kind) && state.runtime.activity.kind !== 'active-encounter') return reject('invalid-state');
    if (input.kind === 'recover-item') {
      if (!safeKinds.has(state.runtime.activity.kind)) return reject('recovery-unavailable');
      if (game.world.inventory.some(i => i.itemId === input.itemId)) return { state: recordAction(state, command.actionId), status: 'no-op' };
      const item = registry.record(input.itemId);
      if (item?.kind !== 'item' || item.consumption !== 'on-documented-transformation') return reject('recovery-unavailable');
      if (!consumedRecovery(item, game.world, true)) return reject('recovery-unavailable');
      const revision = nextRevision(state);
      if (revision === null) return reject('generation-exhausted');
      const world = { ...game.world, inventory: [...game.world.inventory, { itemId: input.itemId, quantity: 1 }], configurationRevision: revision };
      if (!legalWorld(world)) return reject('invalid-state');
      return accept(state, command.actionId, { game: { ...game, world, notebook: staleMeasurements(game) }, activity: state.runtime.activity, changed: true, revision });
    }
    const result = prepare(state, input);
    if (!result.ok) return reject(result.reason);
    if (input.kind === 'apply') return accept(state, command.actionId, result.value);
    const next = recordAction(state, command.actionId);
    return { status: 'pending', state: { runtime: { ...state.runtime, activity: { kind: input.activity } }, control: { ...next.control,
      pending: { actionId: command.actionId, adventureId: command.adventureId, expectedVersion: { ...command.expectedVersion }, request: structuredClone(input), previousActivity: state.runtime.activity },
    } } };
  };
}
