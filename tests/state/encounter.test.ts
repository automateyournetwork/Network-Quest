// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import type { ActionId, AttemptId, ConfigurationRevision, QualifiedId } from '../../src/domain/types';
import { captureEncounterContext, commitEncounterChange, prepareEncounterCheckpoint, prepareEncounterRollback } from '../../src/state/encounter';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../src/state/reducer';
import type { EffectBinding, ReducerState, StateEffect } from '../../src/state/reducer';
import type { ActivityState, GameState, LearningJournal, RuntimeState, SaveEtag, ServerTimestamp, SlotRevision, WorldState } from '../../src/state/types';
import { registry as authoredRegistry, setup } from '../ui/inventory-fixture';
import { repairFlags } from '../../src/state/repair-plan';
import { fixture as repairFixture, registry as repairRegistry } from './repair-plan-fixture';

// Literal T083 expectations stay unchanged. This binding is confined to this
// isolated suite: semantic fixture labels are NOT authored production IDs.
const oracle = JSON.parse(readFileSync(new URL('../fixtures/retry-transitions.json', import.meta.url), 'utf8')) as {
  worlds: Record<string, Omit<WorldState, 'attemptId' | 'configurationRevision'>>;
  journals: Record<string, LearningJournal>;
  contexts: Record<string, { adventureId: string; worldRef: string; journalRef: string; activity: ActivityState['kind'];
    version: { attemptId: string; configurationRevision: number }; checkpoint: null | { adventureId: string; worldRef: string; version: { attemptId: string; configurationRevision: number } };
    highestPriorRevision?: number; usedAttemptIds?: string[]; dirtyGeneration?: number; autosaveEnabled?: boolean }>;
  cases: { id: string; inputs: Record<string, unknown>; expected: Record<string, unknown> }[];
};
const q = <T extends string = string>(label: string) => `spec001:${label}` as QualifiedId<T>;
const uid = (label: string) => `00000000-0000-4000-8000-${createHash('sha256').update(label).digest('hex').slice(0, 12)}`;
const attempt = (label: string) => uid(label) as AttemptId;
const action = (label = 'retry') => label as ActionId;
const fixturePreparation = (world: WorldState) => world.flags[q<'flag'>('repair-applied')] !== true && !world.completedObjectiveIds.includes(q('O11'));
const riftPreparation = (world: WorldState) => world.flags[repairFlags.executed] === undefined && world.flags[repairFlags.classification] === undefined
  && !world.completedObjectiveIds.includes(q('O11'));
const revision = (n: number) => n as ConfigurationRevision;
const c = (id: string) => { const value = oracle.cases.find(value => value.id === id); if (!value) throw new Error(id); return value; };
function world(name: string, version = { attemptId: 'attempt-a', configurationRevision: 4 }): WorldState {
  const raw = structuredClone(oracle.worlds[name]!);
  return { ...raw, roomId: q(raw.roomId), position: { safePositionId: q(raw.position.safePositionId) },
    flags: Object.fromEntries(Object.entries(raw.flags).map(([key, value]) => [q(key), value])),
    completedObjectiveIds: raw.completedObjectiveIds.map(id => q(id)), completedQuestIds: raw.completedQuestIds.map(id => q(id)),
    achievementIds: raw.achievementIds.map(id => q(id)), dialogueEffectIds: raw.dialogueEffectIds.map(id => q(id)),
    inventory: raw.inventory.map(i => ({ ...i, itemId: q(i.itemId) })), recruits: raw.recruits.map(r => ({ ...r,
      characterId: q(r.characterId), abilityIds: r.abilityIds.map(id => q(id)), progressFlags: r.progressFlags.map(id => q(id)) })),
    activeAllyIds: raw.activeAllyIds.length === 0 ? [] : raw.activeAllyIds.length === 1 ? [q(raw.activeAllyIds[0]!)] : [q(raw.activeAllyIds[0]!), q(raw.activeAllyIds[1]!)],
    compendiumIds: raw.compendiumIds.map(id => q(id)),
    attemptId: attempt(version.attemptId), configurationRevision: revision(version.configurationRevision) };
}
function journal(name: string): LearningJournal {
  const raw = structuredClone(oracle.journals[name]!);
  return { notebook: { ...raw.notebook, factIds: raw.notebook.factIds.map(id => q(id)), mapRoomIds: raw.notebook.mapRoomIds.map(id => q(id)),
    hypotheses: raw.notebook.hypotheses.map(h => ({ ...h, id: uid(h.id) as typeof h.id, subjectIds: h.subjectIds.map(id => q(id)) })),
    measurements: raw.notebook.measurements.map(m => ({ ...m, id: uid(m.id) as typeof m.id, ruleId: q(m.ruleId), subjectIds: m.subjectIds.map(id => q(id)),
      roomId: q(m.roomId), attemptId: attempt(m.attemptId) })) },
    assistance: raw.assistance.map(h => ({ ...h, objectiveId: q(h.objectiveId), hintId: q(h.hintId), attemptId: attempt(h.attemptId) })),
    outcomeHistory: raw.outcomeHistory.map(o => ({ ...o, id: uid(o.id) as typeof o.id, attemptId: attempt(o.attemptId), caveatIds: o.caveatIds.map(id => q(id)) })) };
}
const anchors = Object.values(oracle.worlds).map(w => ({ id: q(w.position.safePositionId), roomId: q(w.roomId), label: 'Isolated fixture anchor',
  description: 'Not an episode location.', eligibleStates: ['safe-preparation'] as S.safePosition['eligibleStates'], safetyNote: 'Isolated preparation.' }));
const registry: ContentRegistry = {
  has: (kind, id) => kind === 'room' && anchors.some(a => a.roomId === id), record: () => undefined,
  safePosition: id => anchors.find(a => a.id === id),
};
function state(name = 'failed'): ReducerState {
  const input = oracle.contexts[name]!;
  const game: GameState = { episodeId: 'spec001', contentVersion: '1.0.0' as GameState['contentVersion'], adventureId: uid(input.adventureId) as GameState['adventureId'],
    world: world(input.worldRef, input.version), ...journal(input.journalRef) };
  const runtime: RuntimeState = { game, checkpoint: input.checkpoint ? { adventureId: uid(input.checkpoint.adventureId) as GameState['adventureId'],
    world: world(input.checkpoint.worldRef, input.checkpoint.version) } : null, activity: { kind: input.activity }, ui: null,
    auth: { status: 'guest', csrfToken: null, clientGeneration: 0 as RuntimeState['auth']['clientGeneration'] },
    persistence: { status: 'saved', dirtyGeneration: (input.dirtyGeneration ?? 0) as RuntimeState['persistence']['dirtyGeneration'],
      lastAcknowledgedGeneration: 19 as RuntimeState['persistence']['dirtyGeneration'], pendingRequest: null, replacementAuthorization: null,
      lastAcknowledgement: null, autosaveEnabled: input.autosaveEnabled ?? false, knownSlot: { revision: 12 as SlotRevision, etag: '"save-12"' as SaveEtag, savedAt: '2026-11-26T00:00:00Z' as ServerTimestamp,
        adventureId: game.adventureId, episodeId: 'spec001', roomId: game.world.roomId, outcome: null, saveSchemaVersion: 1, contentVersion: '1.0.0' } } };
  const result = createReducerState(runtime);
  return { ...result, control: { ...result.control, highestRevision: input.highestPriorRevision ?? result.control.highestRevision,
    usedAttemptIds: input.usedAttemptIds?.map(attempt) ?? result.control.usedAttemptIds } };
}
function store(initial = state()) {
  let current = initial;
  const observed: ReducerState[] = [current];
  return { getState: () => current, observed,
    compareAndSet: (expected: ReducerState, next: ReducerState) => { if (current !== expected) return false; current = next; observed.push(next); return true; },
    replace: (next: ReducerState) => { current = next; } };
}
function prepare(before: ReducerState, next = 'attempt-b', id = `retry-${next}`) {
  return prepareEncounterRollback(before, captureEncounterContext(before)!, registry, { actionId: action(id), nextAttemptId: attempt(next) }, fixturePreparation);
}
function rollback(before = state(), next = 'attempt-b') {
  const target = store(before), plan = prepare(before, next);
  expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
  expect(commitEncounterChange(target, plan.change).ok).toBe(true);
  return target.getState();
}
function retained(game: GameState): LearningJournal { return { notebook: game.notebook, assistance: game.assistance, outcomeHistory: game.outcomeHistory }; }
function body(w: WorldState) { const { attemptId: _a, configurationRevision: _r, ...rest } = w; return rest; }
function unchangedReject(before: ReducerState, reason: string, next = 'attempt-b') {
  const untouched = structuredClone(before);
  expect(prepare(before, next)).toMatchObject({ ok: false, reason }); expect(before).toEqual(untouched);
}

// Scope accounting is not an execution adapter. Original T083 runtime TODOs
// remain in retry.test.ts until the real full-world/UI/persistence join exists.
const coverage = {
  isolated: [
    'RETRY-FAILURE-WHOLE-WORLD', 'RETRY-E03-WHOLE-WORLD', 'RETRY-CHECKPOINT-DETACHED', 'RETRY-ALL-READINGS-STALE',
    'RETRY-HISTORICAL-REVISION-FLOOR', 'RETRY-MEASUREMENT-REVISION-FLOOR', 'RETRY-FACT-NOT-COMPLETION', 'RETRY-THREE-CYCLES-NO-FREE-ITEMS',
    'RETRY-REUSED-CURRENT-ATTEMPT', 'RETRY-REUSED-HISTORICAL-ATTEMPT', 'RETRY-REUSED-HINT-ATTEMPT', 'RETRY-REUSED-OUTCOME-ATTEMPT',
    'RETRY-NO-CHECKPOINT', 'RETRY-CROSS-ADVENTURE-CHECKPOINT', 'RETRY-UNSAFE-CHECKPOINT', 'RETRY-PENDING-TRANSITION',
    'RETRY-INTERRUPTED-BEFORE-COMMIT', 'RETRY-ATOMIC-OBSERVER', 'RETRY-REVISION-EXHAUSTED', 'RETRY-DIRTY-GENERATION-EXHAUSTED',
    'RETRY-LAST-LEGAL-REVISION', 'RETRY-GUEST-IN-MEMORY',
  ],
  partial: [
    'RETRY-SAME-REVISION-WRONG-ATTEMPT', 'RETRY-EXPLICIT-STALE-MATCHING-VERSION', 'RETRY-FRESH-MEASUREMENT',
    'RETRY-OLD-ACTION-RECEIPT', 'RETRY-OLD-COMMAND-NEW-ID', 'RETRY-DELAYED-MEASUREMENT',
    'RESTORE-OLD-CALLBACK-SAME-VERSION', 'RESTORE-REBUILD-PREPARATION-ON-ENTRY',
  ],
  deferred: [
    'RESTORE-REPLACES-WORLD-AND-JOURNAL', 'RESTORE-CANCEL-UNCHANGED', 'RESTORE-FETCH-FAILURE', 'RESTORE-INVALID-SNAPSHOT', 'RESTORE-DEFERRED-RESPONSE',
    'RESTORE-GUEST-REQUIRES-SIGNIN', 'RETRY-LATER-MANUAL-SAVE', 'RETRY-LATER-OPTIN-AUTOSAVE', 'RETRY-AUTOSAVE-OFF', 'RETRY-UNSAFE-AUTOSAVE-RACE',
    'RETRY-SAFE-SAVE-CONFLICT', 'RETRY-EARLIER-SAVE-ACK', 'RETRY-LOGOUT-CANCEL', 'RETRY-LOGOUT-CONFIRMED', 'RETRY-CHOICE-CANCEL',
  ],
};
it('accounts for all 45 unchanged T083 cases without claiming deferred interface execution', () => {
  expect(coverage.isolated).toHaveLength(22); expect(coverage.partial).toHaveLength(8); expect(coverage.deferred).toHaveLength(15);
  expect(Object.values(coverage).flat().sort()).toEqual(oracle.cases.map(v => v.id).sort());
  expect(new Set(Object.values(coverage).flat()).size).toBe(45);
  expect(createHash('sha256').update(readFileSync(new URL('../fixtures/retry-transitions.json', import.meta.url))).digest('hex'))
    .toBe('8be2657298b75106b6a55e51e74364e5446c376a85939297e43d91fdd47a6bee');
});

describe('T084 isolated checkpoint and actual reducer rollback against accepted T083 literals', () => {
  it.each(['RETRY-FAILURE-WHOLE-WORLD', 'RETRY-E03-WHOLE-WORLD'])('%s restores every world field and retains the current journal', id => {
    const vector = c(id), before = state(String(vector.inputs['contextRef'])), after = rollback(before), game = after.runtime.game!;
    expect(body(game.world)).toEqual(body(world(String(vector.expected['worldRef']))));
    expect(retained(game)).toEqual(journal(String(vector.expected['journalRef'])));
    expect(game.world.attemptId).toBe(attempt(String(vector.expected['attemptId'])));
    expect(game.world.configurationRevision).toBeGreaterThan(Number(vector.expected['configurationRevisionGreaterThan']));
    expect(after.runtime.activity?.kind).toBe(vector.expected['activity']);
    expect(after.runtime.persistence.dirtyGeneration).toBe(vector.expected['dirtyGeneration']);
    expect(after.runtime.persistence.status).toBe('unsaved');
    expect(after.runtime.persistence.knownSlot).toBe(before.runtime.persistence.knownSlot);
    expect(after.runtime.persistence.pendingRequest).toBe(before.runtime.persistence.pendingRequest);
    expect(after.runtime.persistence.lastAcknowledgement).toBe(before.runtime.persistence.lastAcknowledgement);
    expect(after.runtime.auth).toBe(before.runtime.auth); expect(after.runtime.checkpoint).toBe(before.runtime.checkpoint);
  });

  it('RETRY-CHECKPOINT-DETACHED: capture and rollback have no mutable world children in common', () => {
    const before = state('retried'), target = store(before);
    const plan = prepareEncounterCheckpoint(before, captureEncounterContext(before)!, registry, fixturePreparation);
    expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
    expect(target.getState()).toBe(before); expect(commitEncounterChange(target, plan.change).ok).toBe(true);
    const captured = target.getState(), checkpoint = captured.runtime.checkpoint!;
    expect(checkpoint.world).toEqual(before.runtime.game!.world);
    const noSharedObjects = (left: unknown, right: unknown): void => {
      if (!left || typeof left !== 'object') return;
      expect(left).not.toBe(right);
      for (const key of Object.keys(left)) noSharedObjects((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]);
    };
    noSharedObjects(checkpoint.world, before.runtime.game!.world);
    expect(captured.runtime.game).toBe(before.runtime.game); expect(captured.runtime.persistence).toBe(before.runtime.persistence);
    const retried = rollback(state()); noSharedObjects(retried.runtime.game!.world, retried.runtime.checkpoint!.world);
    const mutable = retried.runtime.game!.world as unknown as { inventory: { quantity: number }[]; flags: Record<string, boolean> };
    mutable.inventory[1]!.quantity = 1; mutable.flags[q('repair-applied')] = true;
    expect(retried.runtime.checkpoint!.world).toEqual(world('preparation'));
  });

  it('RETRY-ALL-READINGS-STALE: preserves each reading, provenance, text and all learning', () => {
    const after = rollback(), game = after.runtime.game!;
    expect(retained(game)).toEqual(journal(String(c('RETRY-ALL-READINGS-STALE').expected['journalRef'])));
    expect(game.notebook.measurements.map(m => m.id)).toEqual((c('RETRY-ALL-READINGS-STALE').expected['visibleMeasurementIds'] as string[]).map(uid));
    expect(game.notebook.measurements.filter(m => isMeasurementCurrent(m, game.world))).toEqual([]);
  });

  it.each(['RETRY-HISTORICAL-REVISION-FLOOR', 'RETRY-MEASUREMENT-REVISION-FLOOR'])('%s includes every recorded revision source', id => {
    const vector = c(id), bounds = vector.inputs['revisionBounds'] as Record<string, number>, before = state();
    const altered = { ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, notebook: { ...before.runtime.game!.notebook,
      measurements: before.runtime.game!.notebook.measurements.map((m, index) => index === 3 ? { ...m, configurationRevision: revision(bounds['largestMeasurement']!) } : m) } } },
      control: { ...before.control, highestRevision: bounds['previouslyIssued']! } };
    expect(rollback(altered).runtime.game!.world.configurationRevision).toBeGreaterThan(Number(vector.expected['configurationRevisionGreaterThan']));
  });

  it('RETRY-FACT-NOT-COMPLETION: retains knowledge without re-awarding undone objectives', () => {
    const after = rollback().runtime.game!, vector = c('RETRY-FACT-NOT-COMPLETION');
    expect(after.notebook.factIds).toEqual((vector.expected['retainedFactIds'] as string[]).map(id => q(id)));
    expect(after.world.completedObjectiveIds).toEqual((vector.expected['completedObjectiveIds'] as string[]).map(id => q(id)));
    for (const id of vector.expected['uncompletedObjectiveIds'] as string[]) expect(after.world.completedObjectiveIds).not.toContain(q(id));
  });

  it.each(['RETRY-REUSED-CURRENT-ATTEMPT', 'RETRY-REUSED-HISTORICAL-ATTEMPT', 'RETRY-REUSED-HINT-ATTEMPT', 'RETRY-REUSED-OUTCOME-ATTEMPT'])('%s resamples provenance even if the transient ledger omitted it', id => {
    const vector = c(id), next = String(vector.inputs['nextAttemptId']), before = state(), game = before.runtime.game!;
    let updated = game;
    if (id === 'RETRY-REUSED-HISTORICAL-ATTEMPT') updated = { ...game, notebook: { ...game.notebook, measurements: [{ ...game.notebook.measurements[0]!, attemptId: attempt(next) }] } };
    if (id === 'RETRY-REUSED-HINT-ATTEMPT') updated = { ...game, assistance: [{ ...game.assistance[0]!, attemptId: attempt(next) }] };
    if (id === 'RETRY-REUSED-OUTCOME-ATTEMPT') updated = { ...game, outcomeHistory: [{ ...game.outcomeHistory[0]!, attemptId: attempt(next) }] };
    unchangedReject({ ...before, runtime: { ...before.runtime, game: updated }, control: { ...before.control, usedAttemptIds: [] } }, String(vector.expected['reason']), next);
  });

  it.each(['RETRY-NO-CHECKPOINT', 'RETRY-CROSS-ADVENTURE-CHECKPOINT', 'RETRY-UNSAFE-CHECKPOINT'])('%s cannot manufacture preparation', id => {
    const before = state(), checkpoint = before.runtime.checkpoint!;
    const changed = id === 'RETRY-NO-CHECKPOINT' ? null : id === 'RETRY-CROSS-ADVENTURE-CHECKPOINT'
      ? { ...checkpoint, adventureId: uid('another-adventure') as GameState['adventureId'] }
      : { ...checkpoint, world: { ...checkpoint.world, position: { safePositionId: q<'safe-position'>('not-in-authored-safe-position-allowlist') } } };
    unchangedReject({ ...before, runtime: { ...before.runtime, checkpoint: changed } }, String(c(id).expected['reason']));
  });

  it('RETRY-PENDING-TRANSITION rejects both capture and rollback without mutating pending work', () => {
    const before = state(), pending = { actionId: action('in-flight'), adventureId: before.runtime.game!.adventureId,
      expectedVersion: before.runtime.game!.world, previousActivity: { kind: 'safe-preparation' }, request: { evaluation: { status: 'correct', reasonCode: 'test', observations: [], acceptedEffects: [] } } } as NonNullable<ReducerState['control']['pending']>;
    const changed = { ...before, control: { ...before.control, pending } };
    unchangedReject(changed, 'transition-pending');
    expect(prepareEncounterCheckpoint(changed, captureEncounterContext(changed)!, registry, fixturePreparation)).toMatchObject({ ok: false, reason: 'transition-pending' });
  });

  it('RETRY-INTERRUPTED-BEFORE-COMMIT keeps the exact original state and does not reserve attempts', () => {
    const before = state(), untouched = structuredClone(before), target = store(before), plan = prepare(before);
    expect(plan.ok).toBe(true); expect(target.getState()).toBe(before); expect(before).toEqual(untouched);
    expect(before.control.usedAttemptIds).not.toContain(attempt('attempt-b'));
    expect(prepare(before).ok).toBe(true); expect(target.observed).toEqual([before]);
  });

  it('RETRY-ATOMIC-OBSERVER exposes one coherent swap; failed CAS cannot reserve the attempt', () => {
    const before = state(), target = store(before), plan = prepare(before); if (!plan.ok) throw new Error(plan.reason);
    expect(commitEncounterChange({ getState: () => before, compareAndSet: () => false }, plan.change)).toMatchObject({ ok: false, reason: 'stale-context' });
    expect(before.control.usedAttemptIds).not.toContain(attempt('attempt-b'));
    expect(commitEncounterChange(target, plan.change).ok).toBe(true);
    expect(target.observed).toHaveLength(2);
    expect(body(target.observed[0]!.runtime.game!.world)).toEqual(body(world('attempt-end')));
    expect(retained(target.observed[0]!.runtime.game!)).toEqual(journal('attempt-end'));
    expect(body(target.observed[1]!.runtime.game!.world)).toEqual(body(world('preparation')));
    expect(retained(target.observed[1]!.runtime.game!)).toEqual(journal('retained-stale'));
    expect(commitEncounterChange(target, plan.change)).toMatchObject({ ok: false, reason: 'stale-context' });
    expect(target.observed).toHaveLength(2);
  });

  it.each(['RETRY-REVISION-EXHAUSTED', 'RETRY-DIRTY-GENERATION-EXHAUSTED'])('%s rejects without wrap, mutation or reservation', id => {
    const before = state(), vector = c(id);
    const changed = id === 'RETRY-REVISION-EXHAUSTED' ? { ...before, control: { ...before.control, highestRevision: Number(vector.inputs['highestPriorRevision']) } }
      : { ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence, dirtyGeneration: vector.inputs['dirtyGeneration'] as RuntimeState['persistence']['dirtyGeneration'] } } };
    unchangedReject(changed, String(vector.expected['reason'])); expect(changed.control.usedAttemptIds).not.toContain(attempt('attempt-b'));
  });

  it('RETRY-LAST-LEGAL-REVISION accepts the bound and rejects the next required increment', () => {
    const before = state(), vector = c('RETRY-LAST-LEGAL-REVISION');
    const after = rollback({ ...before, control: { ...before.control, highestRevision: Number(vector.inputs['highestPriorRevision']) } });
    expect(after.runtime.game!.world.configurationRevision).toBe(vector.expected['configurationRevision']);
    unchangedReject({ ...after, runtime: { ...after.runtime, activity: { kind: 'terminal-failure' } } }, 'generation-exhausted', 'attempt-c');
  });

  it('RETRY-GUEST-IN-MEMORY needs no identity or persistence port', () => {
    const before = state(), after = rollback(before);
    expect(after.runtime.auth).toBe(before.runtime.auth); expect(after.runtime.auth.status).toBe('guest');
    expect(after.runtime.persistence.knownSlot).toBe(before.runtime.persistence.knownSlot);
    expect(Object.keys(after.runtime.game!)).not.toContain('checkpoint');
    expect(Object.keys(after.runtime.game!)).not.toContain('control');
  });

  it('RETRY-THREE-CYCLES-NO-FREE-ITEMS runs actual debit/reward/receipt reductions between three rollbacks', () => {
    // Test-only authored transformation. Runtime output is never used to create
    // its answer key; the six-step expected quantities come directly from T083.
    const effects: StateEffect[] = ([
      { kind: 'consume-item', effectId: q('debit-two'), itemId: q('repair-input'), quantity: 2 },
      { kind: 'grant-item', effectId: q('make-product'), itemId: q('repair-product'), quantity: 1 },
      { kind: 'grant-item', effectId: q('attempt-gift-receipt'), itemId: q('attempt-reward'), quantity: 1 },
    ] satisfies S.effect[]).map((e: S.effect) => e as StateEffect);
    const recovery: S.recovery = { policy: 'transformation-recoverable', roomId: q('rift-preparation'), condition: { kind: 'always' }, explanation: 'Isolated fixture input source.' };
    const records = new Map<string, S.authoredRecord>([
      [q('test-recipe'), { kind: 'dialogue', id: q('test-recipe'), nodes: [{ condition: { kind: 'always' }, effects }] } as unknown as S.dialogue],
      ...['repair-input', 'repair-product', 'attempt-reward'].map(id => [q(id), { kind: 'item', id: q(id), essentialForRoutes: [],
        consumption: id === 'repair-input' ? 'on-documented-transformation' : 'never', recovery,
        combinations: id === 'repair-input' ? [{ id: q('combine-two'), withItemId: q('repair-input'), consumesInputs: true,
          condition: { kind: 'always' }, effects, recovery }] : [] } as unknown as S.item] as [string, S.authoredRecord]),
    ]);
    const recipeRegistry: ContentRegistry = { ...registry, record: id => records.get(id),
      has: (kind, id) => registry.has(kind, id) || records.get(id)?.kind === kind || (kind === 'effect' && effects.some(e => e.effectId === id)) };
    const bindings: EffectBinding[] = effects.map(e => ({ sourceId: q('test-recipe'), effectId: e.effectId,
      mode: 'once', receipt: { kind: 'dialogue-effect', id: q('attempt-gift-receipt') } }));
    const reduce = createReducer({ registry: recipeRegistry, bindings }), vector = c('RETRY-THREE-CYCLES-NO-FREE-ITEMS');
    const steps = vector.inputs['steps'] as { action: string; nextAttemptId?: string; actionId?: string }[];
    const expected = vector.expected['steps'] as Record<string, unknown>[];
    let current = state(), previousRecipe: Parameters<typeof reduce>[1] | null = null, maximum = 15;
    steps.forEach((step, index) => {
      const prior = current, checks = expected[index]!;
      if (step.nextAttemptId) {
        const failed = { ...current, runtime: { ...current.runtime, activity: { kind: 'terminal-failure' } as ActivityState } };
        const plan = prepareEncounterRollback(failed, captureEncounterContext(failed)!, recipeRegistry,
          { actionId: action(`retry-step-${index}`), nextAttemptId: attempt(step.nextAttemptId) }, fixturePreparation);
        if (!plan.ok) throw new Error(plan.reason);
        const target = store(failed); expect(commitEncounterChange(target, plan.change).ok).toBe(true); current = target.getState();
        expect(current.runtime.game!.world.configurationRevision).toBeGreaterThan(maximum);
        expect(body(current.runtime.game!.world)).toEqual(body(world('preparation')));
      } else if (step.action === 'replay-same-action') {
        const replay = reduce(current, previousRecipe!); expect(replay.state).toBe(current);
      } else {
        previousRecipe = { actionId: action(step.actionId!), adventureId: current.runtime.game!.adventureId, expectedVersion: current.runtime.game!.world,
          input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'isolated-transformation', observations: [], acceptedEffects: effects } } };
        const reduced = reduce(current, previousRecipe); expect(reduced.status, reduced.reason).toBe('applied'); current = reduced.state;
        expect(current.runtime.game!.world.configurationRevision).toBeGreaterThan(prior.runtime.game!.world.configurationRevision);
      }
      const currentWorld = current.runtime.game!.world;
      const count = (id: string) => currentWorld.inventory.find(i => i.itemId === q(id))?.quantity ?? 0;
      expect(count('repair-input')).toBe(checks['repairInput']); expect(count('repair-product')).toBe(checks['repairProduct']); expect(count('attempt-reward')).toBe(checks['attemptReward']);
      expect(currentWorld.dialogueEffectIds.includes(q('attempt-gift-receipt'))).toBe(checks['attemptReceipt']);
      if (checks['attemptId']) expect(currentWorld.attemptId).toBe(attempt(String(checks['attemptId'])));
      expect(retained(current.runtime.game!)).toEqual(journal(String(vector.expected['journalRef'])));
      maximum = Math.max(maximum, currentWorld.configurationRevision);
    });
    expect(current.control.usedAttemptIds).toEqual(expect.arrayContaining(['attempt-b', 'attempt-c', 'attempt-d'].map(attempt)));
    expect(current.runtime.persistence.knownSlot?.revision).toBe(12);
  });
});

describe('T084 preparation boundaries and captured installation', () => {
  it.each(['shutdown', 'permanent', 'temporary'] as const)('actual T077 %s execution cannot replace precommit preparation', kind => {
    const f = repairFixture(); f.replace({ ...f.state(), runtime: { ...f.state().runtime, activity: { kind: 'safe-preparation' } } });
    f.prepare(kind === 'shutdown' ? 'shutdown' : 'copper-section', kind === 'temporary' ? 'temporary' : 'permanent');
    if (kind === 'shutdown') f.choose('record-isolation');
    if (kind === 'temporary') f.choose('record-maintenance');
    const isPreparation = riftPreparation;
    const before = f.state(), target = store(before);
    const checkpoint = prepareEncounterCheckpoint(before, captureEncounterContext(before)!, repairRegistry, isPreparation);
    expect(checkpoint.ok).toBe(true); if (!checkpoint.ok) throw new Error(checkpoint.reason);
    expect(commitEncounterChange(target, checkpoint.change).ok).toBe(true); f.replace(target.getState());
    const captured = f.state().runtime.checkpoint;
    expect(f.execute().evaluation?.status).toBe('correct');
    expect(f.state().runtime.activity?.kind).toBe('safe-preparation');
    const committed = f.state();
    expect(prepareEncounterCheckpoint(committed, captureEncounterContext(committed)!, repairRegistry, isPreparation)).toMatchObject({ ok: false, reason: 'no-preparation' });
    expect(f.state().runtime.checkpoint).toBe(captured);
    if (kind === 'shutdown') {
      f.move('R12'); f.choose('read-classification');
      expect(f.act({ kind: 'classify', selection: 'shutdown', linkId: null, endpointId: null }).evaluation?.status).toBe('correct');
      expect(f.state().runtime.activity?.kind).toBe('shutdown');
      const ended = f.state();
      expect(prepareEncounterCheckpoint(ended, captureEncounterContext(ended)!, repairRegistry, isPreparation)).toMatchObject({ ok: false, reason: 'no-preparation' });
      const rollbackPlan = prepareEncounterRollback(ended, captureEncounterContext(ended)!, repairRegistry,
        { actionId: action('actual-shutdown-continue'), nextAttemptId: attempt('actual-next') }, isPreparation);
      expect(rollbackPlan.ok).toBe(true); if (!rollbackPlan.ok) throw new Error(rollbackPlan.reason);
      const endingStore = store(ended); expect(commitEncounterChange(endingStore, rollbackPlan.change).ok).toBe(true);
      expect(body(endingStore.getState().runtime.game!.world)).toEqual(body(captured!.world));
      expect(endingStore.getState().runtime.game!.notebook.personalNotes).toBe(ended.runtime.game!.notebook.personalNotes);
      expect(endingStore.getState().runtime.game!.notebook.measurements.every(m => m.stale)).toBe(true);
    }
  });

  it('accepts the actual authored R11 preparation only at the safe-preparation activity', () => {
    const base = setup().store.getState();
    const before = { ...base, runtime: { ...base.runtime, activity: { kind: 'safe-preparation' } as ActivityState,
      game: { ...base.runtime.game!, world: { ...base.runtime.game!.world, roomId: q<'room'>('R11'), position: { safePositionId: q<'safe-position'>('R11.preparation') } } } } };
    const plan = prepareEncounterCheckpoint(before, captureEncounterContext(before)!, authoredRegistry, riftPreparation);
    expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
    const target = store(before); expect(commitEncounterChange(target, plan.change).ok).toBe(true);
    expect(target.getState().runtime.checkpoint!.world).toEqual(before.runtime.game!.world);
    expect(target.getState().runtime.persistence).toBe(before.runtime.persistence);
  });

  it('requires the boundary policy again for rollback and fails closed without mutation', () => {
    const failed = state(), before = state('retried');
    const policies: ((world: WorldState) => boolean)[] = [() => false, () => { throw new Error('Unavailable policy'); },
      (() => 'unsupported') as unknown as (world: WorldState) => boolean,
      undefined as unknown as (world: WorldState) => boolean,
      world => { (world.flags as Record<string, unknown>)[q('repair-applied')] = true; return true; }];
    for (const policy of policies) {
      const originalFailed = structuredClone(failed), originalBefore = structuredClone(before);
      expect(prepareEncounterCheckpoint(before, captureEncounterContext(before)!, registry, policy)).toMatchObject({ ok: false, reason: 'no-preparation' });
      expect(prepareEncounterRollback(failed, captureEncounterContext(failed)!, registry,
        { actionId: action(), nextAttemptId: attempt('attempt-b') }, policy)).toMatchObject({ ok: false, reason: 'no-preparation' });
      expect(before).toEqual(originalBefore); expect(failed).toEqual(originalFailed);
    }
    const checkpoint = failed.runtime.checkpoint!;
    const committedCheckpoint = { ...failed, runtime: { ...failed.runtime, checkpoint: { ...checkpoint, world: { ...checkpoint.world,
      flags: { ...checkpoint.world.flags, [q('repair-applied')]: true } } } } };
    unchangedReject(committedCheckpoint, 'no-preparation');
  });

  it.each(['stable-exploration', 'safe-continue', 'active-encounter', 'terminal-failure', 'shutdown', 'pending-effect', 'room-transition', 'dialogue-transaction', 'cutscene'] as const)('does not capture %s merely because its anchor allows preparation', kind => {
    const base = state('retried'), before = { ...base, runtime: { ...base.runtime, activity: { kind } } };
    expect(prepareEncounterCheckpoint(before, captureEncounterContext(before)!, registry, fixturePreparation)).toMatchObject({ ok: false, reason: 'no-preparation' });
  });

  it('rejects a stable-only anchor, mismatched room, absent room and ended Continue state', () => {
    const before = state('retried');
    for (const alternate of [
      { ...registry, safePosition: (id: string) => { const a = registry.safePosition(id); return a ? { ...a, eligibleStates: ['stable-exploration'] as S.safePosition['eligibleStates'] } : undefined; } },
      { ...registry, safePosition: (id: string) => { const a = registry.safePosition(id); return a ? { ...a, roomId: q('other-room') } : undefined; } },
      { ...registry, has: () => false },
    ]) expect(prepareEncounterCheckpoint(before, captureEncounterContext(before)!, alternate, fixturePreparation)).toMatchObject({ ok: false, reason: 'no-preparation' });
    const ended = { ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, continueOutcome: 'E01' as const } } } };
    expect(prepareEncounterCheckpoint(ended, captureEncounterContext(ended)!, registry, fixturePreparation)).toMatchObject({ ok: false, reason: 'no-preparation' });
  });

  it('RESTORE-REBUILD-PREPARATION-ON-ENTRY: captures the supplied restored world on a later actual preparation entry', () => {
    const restored = state('saved'), before = { ...restored, runtime: { ...restored.runtime, activity: { kind: 'safe-preparation' } as ActivityState } };
    const target = store(before), plan = prepareEncounterCheckpoint(before, captureEncounterContext(before)!, registry, fixturePreparation);
    expect(plan.ok).toBe(true); if (!plan.ok) throw new Error(plan.reason);
    expect(commitEncounterChange(target, plan.change).ok).toBe(true);
    expect(target.getState().runtime.checkpoint).toEqual({ adventureId: before.runtime.game!.adventureId, world: before.runtime.game!.world });
    expect(retained(target.getState().runtime.game!)).toEqual(journal('saved'));
    expect(target.getState().runtime.persistence).toBe(before.runtime.persistence);
    // This test supplies the already-restored state; it does not execute Restore.
  });

  it('binds preparation and commit to exact captured state, including equal-version replacement', () => {
    const before = state(), context = captureEncounterContext(before)!, replacement = structuredClone(before);
    expect(prepareEncounterRollback(replacement, context, registry, { actionId: action(), nextAttemptId: attempt('attempt-b') }, fixturePreparation)).toMatchObject({ ok: false, reason: 'stale-context' });
    expect(prepareEncounterRollback(before, { ...context }, registry, { actionId: action(), nextAttemptId: attempt('attempt-b') }, fixturePreparation)).toMatchObject({ ok: false, reason: 'stale-context' });
    const plan = prepare(before); if (!plan.ok) throw new Error(plan.reason);
    const target = store(before); target.replace(replacement);
    expect(commitEncounterChange(target, plan.change)).toMatchObject({ ok: false, reason: 'stale-context' });
    expect(target.getState()).toBe(replacement); expect(before.control.usedAttemptIds).not.toContain(attempt('attempt-b'));
    expect(commitEncounterChange(store(before), { ...plan.change })).toMatchObject({ ok: false, reason: 'stale-context' });
  });

  it('rejects a captured version changed before preparation even with an in-place caller defect', () => {
    const before = state(), context = captureEncounterContext(before)!;
    (before.runtime.game!.world as { configurationRevision: number }).configurationRevision++;
    expect(prepareEncounterRollback(before, context, registry, { actionId: action(), nextAttemptId: attempt('attempt-b') }, fixturePreparation)).toMatchObject({ ok: false, reason: 'stale-version' });
  });

  it('cannot capture title or apply a rollback from an ordinary safe activity', () => {
    const before = state();
    expect(captureEncounterContext({ ...before, runtime: { ...before.runtime, game: null, activity: null } })).toBeNull();
    unchangedReject(state('retried'), 'no-preparation');
  });

  it('checks checkpoint revision floor even when the transient high-water mark is incomplete', () => {
    const before = state(), checkpoint = before.runtime.checkpoint!;
    const changed = { ...before, runtime: { ...before.runtime, checkpoint: { ...checkpoint, world: { ...checkpoint.world, configurationRevision: revision(80) } } } };
    expect(rollback(changed).runtime.game!.world.configurationRevision).toBeGreaterThan(80);
  });

  it.each([-1, NaN, Infinity, 1.5, 2147483648])('rejects invalid historical revision %s', n => {
    const before = state(); unchangedReject({ ...before, control: { ...before.control, highestRevision: n } }, 'generation-exhausted');
  });

  it.each([-1, NaN, Infinity, 1.5])('rejects invalid dirty generation %s', n => {
    const before = state(); unchangedReject({ ...before, runtime: { ...before.runtime, persistence: { ...before.runtime.persistence,
      dirtyGeneration: n as RuntimeState['persistence']['dirtyGeneration'] } } }, 'generation-exhausted');
  });

  it('rejects malformed and case-variant reused UUIDs before installing anything', () => {
    const before = state(), context = captureEncounterContext(before)!;
    expect(prepareEncounterRollback(before, context, registry, { actionId: action(), nextAttemptId: 'not-a-uuid' as AttemptId }, fixturePreparation)).toMatchObject({ ok: false, reason: 'invalid-action' });
    expect(prepareEncounterRollback(before, context, registry, { actionId: action(), nextAttemptId: before.runtime.game!.world.attemptId.toUpperCase() as AttemptId }, fixturePreparation)).toMatchObject({ ok: false, reason: 'attempt-reused' });
  });

  it.each(['RETRY-OLD-ACTION-RECEIPT', 'RETRY-OLD-COMMAND-NEW-ID', 'RETRY-DELAYED-MEASUREMENT'])('%s still fails at the real reducer after isolated rollback', id => {
    const vector = c(id), before = state(), after = rollback(before), version = (vector.inputs['expectedVersion'] ?? vector.inputs['capturedVersion']) as { attemptId: string; configurationRevision: number };
    const capturedAction = action(String(vector.inputs['actionId'] ?? 'delayed-reading'));
    const withReceipt = vector.inputs['alreadyRecordedActionId'] ? { ...after, control: { ...after.control, actionIds: [...after.control.actionIds, capturedAction] } } : after;
    const result = createReducer({ registry, bindings: [] })(withReceipt, { actionId: capturedAction, adventureId: before.runtime.game!.adventureId,
      expectedVersion: { attemptId: attempt(version.attemptId), configurationRevision: revision(version.configurationRevision) },
      input: { kind: 'notebook', operation: { kind: 'notes', text: 'Old callback must not replace retained notes.' } } });
    expect(result).toMatchObject({ status: 'rejected', reason: 'stale-version' }); expect(result.state).toBe(withReceipt);
  });

  it.each(['RETRY-SAME-REVISION-WRONG-ATTEMPT', 'RETRY-EXPLICIT-STALE-MATCHING-VERSION', 'RETRY-FRESH-MEASUREMENT'])('%s satisfies the actual current-reading predicate (no new readout dispatch claimed)', id => {
    const vector = c(id), after = rollback(), game = after.runtime.game!, raw = vector.inputs['measurement'] as { attemptId: string; configurationRevision: number; stale: boolean };
    const measurement = { ...game.notebook.measurements[0]!, attemptId: attempt(raw.attemptId), configurationRevision: revision(raw.configurationRevision), stale: raw.stale };
    expect(isMeasurementCurrent(measurement, game.world)).toBe(vector.expected['usableNewMeasurement'] ?? vector.expected['usable']);
    expect(game.notebook.measurements.every(m => m.stale)).toBe(true); expect(retained(game)).toEqual(journal('retained-stale'));
  });
});
