// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import type { AdventureId, AttemptId, ConfigurationRevision, ItemId, QualifiedId } from '../../src/domain/types';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ContentRegistry } from '../../src/content/registry';
import type { RuntimeState } from '../../src/state/types';
import { createActionBus, reducerActionHandler, contextFromRuntime } from '../../src/ui/action-bus';
import type { ActionContext, ActionHandler, SemanticAction } from '../../src/ui/action-bus';

const context = (): ActionContext => ({
  adventureId: '00000000-0000-4000-8000-000000000001' as AdventureId,
  configurationRevision: 2 as ConfigurationRevision,
  attemptId: '00000000-0000-4000-8000-000000000002' as AttemptId,
});
const look: SemanticAction = { kind: 'select-verb', verb: 'look' };
const handled = { status: 'handled', message: 'Look selected.' } as const;

describe('semantic action ownership and lifecycle', () => {
  it('captures immutable intent and versions, with one stable receipt per command', () => {
    const current = context();
    const bus = createActionBus({ getContext: () => current });
    const commit = vi.fn(() => handled);
    bus.register('select-verb', () => ({ status: 'ready', commit }));
    const command = bus.capture(look);
    expect(command.context).toEqual(current);
    expect(command.context).not.toBe(current);
    expect(Object.isFrozen(command)).toBe(true);
    expect(Object.isFrozen(command.input)).toBe(true);
    expect(Object.isFrozen(command.context)).toBe(true);
    expect(bus.capture(look).actionId).not.toBe(command.actionId);
    expect(bus.dispatch(command)).toEqual(handled);
    expect(bus.dispatch(command)).toEqual(handled);
    expect(commit).toHaveBeenCalledTimes(1);
  });

  it('uses the supplied view context instead of silently retargeting an old affordance', () => {
    const current = { ...context(), configurationRevision: 3 as ConfigurationRevision };
    const bus = createActionBus({ getContext: () => current });
    const handler = vi.fn(() => handled);
    bus.register('select-verb', handler);
    expect(bus.dispatch(bus.capture(look, context()))).toMatchObject({ reason: 'stale-context' });
    expect(handler).not.toHaveBeenCalled();
  });

  it('binds repeated projection activations to their original epoch, including captures after invalidation', () => {
    const bus = createActionBus({ getContext: context });
    const handler = vi.fn(() => handled);
    bus.register('select-verb', handler);
    const capture = bus.captureScope(context());
    const first = capture(look), second = capture(look);
    expect(first.actionId).not.toBe(second.actionId);
    expect(bus.dispatch(first)).toEqual(handled);
    expect(bus.dispatch(second)).toEqual(handled);
    bus.invalidate();
    expect(bus.dispatch(capture(look))).toMatchObject({ reason: 'invalidated' });
    expect(handler).toHaveBeenCalledTimes(2);
    expect(bus.dispatch(bus.captureScope(context())(look))).toEqual(handled);
    bus.dispose();
    expect(() => capture(look)).toThrow();
  });

  it.each(['adventureId', 'configurationRevision', 'attemptId'] as const)('rejects delayed input after %s changes', (field) => {
    let current = context();
    const bus = createActionBus({ getContext: () => current });
    const resolve = vi.fn(() => handled);
    bus.register('select-verb', resolve);
    const command = bus.capture(look);
    current = { ...current, [field]: field === 'configurationRevision' ? 3 : 'changed' };
    expect(bus.dispatch(command)).toMatchObject({ status: 'rejected', reason: 'stale-context' });
    expect(resolve).not.toHaveBeenCalled();
  });

  it('rejects forged commands and inputs containing renderer-provided effects', () => {
    const bus = createActionBus({ getContext: context });
    expect(bus.dispatch({ ...bus.capture(look) })).toMatchObject({ reason: 'unknown-action' });
    expect(() => bus.capture({ ...look, acceptedEffects: [{ kind: 'complete-objective' }] } as SemanticAction)).toThrow();
    expect(() => bus.capture({ kind: 'select-verb', verb: 'grant' } as unknown as SemanticAction)).toThrow();
  });

  it('accepts only exact typed inventory and hotspot-choice intent shapes', () => {
    const bus = createActionBus({ getContext: context });
    const actions: SemanticAction[] = [
      { kind: 'select-item', itemId: 'spec001:ITEM-kit' as Extract<SemanticAction, { kind: 'select-item' }>['itemId'] },
      { kind: 'select-item', itemId: null },
      { kind: 'combine-items', itemId: 'spec001:ITEM-a' as ItemId, targetItemId: 'spec001:ITEM-b' as ItemId, combinationId: null },
      { kind: 'recover-item', itemId: 'spec001:ITEM-kit' as ItemId },
      { kind: 'choose-hotspot-action', targetId: 'spec001:HOTSPOT-path' as QualifiedId, verb: 'use', itemId: null, choiceId: 'spec001:ACTION-inspect' as QualifiedId },
    ];
    for (const action of actions) {
      expect(bus.capture(action).input).toEqual(action);
      expect(() => bus.capture({ ...action, effects: [] } as unknown as SemanticAction)).toThrow();
    }
    for (const action of [
      { kind: 'select-item', itemId: 2 }, { kind: 'recover-item', itemId: null },
      { kind: 'combine-items', itemId: 'a', targetItemId: '', combinationId: null },
      { kind: 'combine-items', itemId: 'a', targetItemId: 'b', combinationId: [] },
      { kind: 'choose-hotspot-action', targetId: 'a', verb: 'grant', itemId: null, choiceId: 'b' },
    ]) expect(() => bus.capture(action as unknown as SemanticAction)).toThrow();
  });

  it('reports missing handlers, enforces single ownership and disposes registrations safely', () => {
    const bus = createActionBus({ getContext: context });
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ status: 'unavailable', reason: 'no-handler' });
    const off = bus.register('select-verb', () => handled);
    expect(() => bus.register('select-verb', () => handled)).toThrow();
    off(); off();
    const replacement = vi.fn(() => handled);
    bus.register('select-verb', replacement);
    off();
    bus.dispatch(bus.capture(look));
    expect(replacement).toHaveBeenCalledTimes(1);
  });

  it('cancels a captured callback; invalidation also rejects equal-version restored state', () => {
    const bus = createActionBus({ getContext: context });
    const resolve = vi.fn(() => handled);
    bus.register('select-verb', resolve);
    const canceled = bus.capture(look);
    expect(bus.cancel(canceled)).toBe(true);
    expect(bus.dispatch(canceled)).toMatchObject({ reason: 'canceled' });
    const restored = bus.capture(look);
    bus.invalidate();
    expect(bus.dispatch(restored)).toMatchObject({ reason: 'invalidated' });
    expect(resolve).not.toHaveBeenCalled();
    const fresh = bus.capture(look);
    expect(bus.dispatch(fresh)).toEqual(handled);
    expect(bus.cancel(fresh)).toBe(false);
  });

  it.each(['cancel', 'invalidate', 'dispose', 'unregister', 'change-context'] as const)('rechecks %s after resolution and before committing', (operation) => {
    let current = context();
    const bus = createActionBus({ getContext: () => current });
    const commit = vi.fn(() => handled);
    const command = bus.capture(look);
    const off = bus.register('select-verb', () => {
      if (operation === 'cancel') bus.cancel(command);
      if (operation === 'invalidate') bus.invalidate();
      if (operation === 'dispose') bus.dispose();
      if (operation === 'unregister') off();
      if (operation === 'change-context') current = { ...current, configurationRevision: 3 as ConfigurationRevision };
      return { status: 'ready', commit };
    });
    expect(bus.dispatch(command).status).not.toBe('handled');
    expect(commit).not.toHaveBeenCalled();
  });

  it('rejects reentrant dispatch without losing the outer result or a later explicit retry', () => {
    const bus = createActionBus({ getContext: context });
    const nested = bus.capture({ kind: 'open-panel', panel: 'notebook' });
    const inner = vi.fn(() => handled);
    bus.register('open-panel', inner);
    bus.register('select-verb', () => {
      expect(bus.dispatch(nested)).toMatchObject({ reason: 'busy' });
      return handled;
    });
    expect(bus.dispatch(bus.capture(look))).toEqual(handled);
    expect(inner).not.toHaveBeenCalled();
    bus.dispatch(nested);
    expect(inner).toHaveBeenCalledTimes(1);
  });

  it('treats re-registration of the same function as a new owner', () => {
    const bus = createActionBus({ getContext: context });
    const commit = vi.fn(() => handled);
    const handler: ActionHandler = () => { off(); bus.register('select-verb', handler); return { status: 'ready', commit }; };
    const off = bus.register('select-verb', handler);
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ reason: 'handler-removed' });
    expect(commit).not.toHaveBeenCalled();
  });

  it('turns synchronous commit failure into feedback and permits other later actions', () => {
    const bus = createActionBus({ getContext: context });
    bus.register('select-verb', () => ({ status: 'ready', commit: () => { throw new Error('commit'); } }));
    bus.register('close-panel', () => handled);
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ reason: 'handler-error' });
    expect(bus.dispatch(bus.capture({ kind: 'close-panel' }))).toEqual(handled);
  });

  it('isolates handler/observer/error-reporter exceptions and does not replay notifications', () => {
    const reporter = vi.fn(() => { throw new Error('reporter'); });
    const bus = createActionBus({ getContext: context, onError: reporter });
    bus.register('select-verb', () => { throw new Error('resolver'); });
    bus.subscribe(() => { throw new Error('observer'); });
    const observer = vi.fn();
    const off = bus.subscribe(observer);
    const command = bus.capture(look);
    expect(bus.dispatch(command)).toMatchObject({ status: 'rejected', reason: 'handler-error' });
    bus.dispatch(command);
    expect(observer).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledTimes(2);
    off(); off();
    bus.dispatch(bus.capture(look));
    expect(observer).toHaveBeenCalledTimes(1);
  });

  it('does not call removed subscribers and blocks nested observer dispatch', () => {
    const bus = createActionBus({ getContext: context });
    bus.register('select-verb', () => handled);
    const second = vi.fn();
    bus.subscribe(() => { off(); expect(bus.dispatch(bus.capture(look))).toMatchObject({ reason: 'busy' }); });
    const off = bus.subscribe(second);
    bus.dispatch(bus.capture(look));
    expect(second).not.toHaveBeenCalled();
  });

  it('fails closed for accidental asynchronous resolvers and clears ownership on disposal', () => {
    const bus = createActionBus({ getContext: context });
    bus.register('select-verb', (async () => handled) as unknown as ActionHandler);
    const old = bus.capture(look);
    expect(bus.dispatch(old)).toMatchObject({ reason: 'handler-error' });
    bus.dispose(); bus.dispose();
    expect(bus.dispatch(old)).toMatchObject({ reason: 'disposed' });
    expect(() => bus.capture(look)).toThrow();
    expect(() => bus.register('select-verb', () => handled)).toThrow();
    expect(() => bus.subscribe(() => {})).toThrow();
  });

  it('observes accidental rejected Promises without committing or leaking an unhandled rejection', async () => {
    const onError = vi.fn();
    const bus = createActionBus({ getContext: context, onError });
    bus.register('select-verb', (async () => { throw new Error('async resolver'); }) as unknown as ActionHandler);
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ reason: 'handler-error' });
    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(2);
  });
});

function runtime(): RuntimeState {
  const captured = context();
  return {
    game: { episodeId: 'spec001', contentVersion: '1.0.0' as NonNullable<RuntimeState['game']>['contentVersion'],
      adventureId: captured.adventureId, world: { configurationRevision: captured.configurationRevision, attemptId: captured.attemptId,
        roomId: 'spec001:R01' as QualifiedId<'room'>, position: { safePositionId: 'spec001:POS-one' as QualifiedId<'safe-position'> },
        flags: {}, completedObjectiveIds: [], completedQuestIds: [], achievementIds: [], dialogueEffectIds: [], inventory: [], recruits: [],
        activeAllyIds: [], compendiumIds: [], route: null, continueOutcome: null },
      notebook: { factIds: [], mapRoomIds: [], personalNotes: '', hypotheses: [], measurements: [] }, assistance: [], outcomeHistory: [] },
    checkpoint: null, ui: null, activity: { kind: 'stable-exploration' },
    auth: { status: 'guest', clientGeneration: 0 as RuntimeState['auth']['clientGeneration'], csrfToken: null },
    persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'], lastAcknowledgedGeneration: null,
      knownSlot: undefined, pendingRequest: null, replacementAuthorization: null, lastAcknowledgement: null, autosaveEnabled: false },
  };
}

describe('trusted pure reducer adapter', () => {
  const registry: ContentRegistry = { has: () => false, record: () => undefined, safePosition: () => undefined };
  it('routes actual reducer input with the captured identity, without inventing progress', () => {
    let state = createReducerState(runtime());
    const before = state;
    const reduce = vi.fn(createReducer({ registry, bindings: [] }));
    const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
    bus.register('interact', reducerActionHandler({ getState: () => state, reduce,
      compareAndSet: (expected, next) => { if (state !== expected) return false; state = next; return true; },
      resolve: () => ({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'fixture-no-award', observations: [], acceptedEffects: [] } }),
    }));
    const action = bus.capture({ kind: 'interact', verb: 'look', targetId: 'spec001:PR001' as QualifiedId, itemId: null });
    expect(bus.dispatch(action)).toMatchObject({ status: 'handled', reason: 'no-op' });
    expect(reduce).toHaveBeenCalledWith(before, { actionId: action.actionId, adventureId: action.context!.adventureId,
      expectedVersion: { attemptId: action.context!.attemptId, configurationRevision: action.context!.configurationRevision },
      input: expect.objectContaining({ kind: 'apply' }) });
    expect(state.runtime).toBe(before.runtime);
    expect(state.control.actionIds).toEqual([action.actionId]);
    expect(bus.dispatch(action)).toMatchObject({ reason: 'no-op' });
    expect(reduce).toHaveBeenCalledTimes(1);
  });

  it('returns reducer rejection and never writes state for unsupported recovery', () => {
    const state = createReducerState(runtime());
    const write = vi.fn(() => true);
    const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
    bus.register('interact', reducerActionHandler({ getState: () => state, reduce: createReducer({ registry, bindings: [] }), compareAndSet: write,
      resolve: () => ({ kind: 'recover-item', itemId: 'spec001:ITEM-missing' as QualifiedId<'item'> }),
    }));
    expect(bus.dispatch(bus.capture({ kind: 'interact', verb: 'use', targetId: 'spec001:PR001' as QualifiedId, itemId: null })))
      .toMatchObject({ status: 'rejected', reason: 'recovery-unavailable' });
    expect(write).not.toHaveBeenCalled();
  });

  it('refuses absent adventures, missing routes, and state replacement during resolution', () => {
    let state = createReducerState(runtime());
    const write = vi.fn(() => true);
    const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
    let mode = 'missing';
    bus.register('select-verb', reducerActionHandler({ getState: () => state, reduce: createReducer({ registry, bindings: [] }), compareAndSet: write,
      resolve: () => { if (mode === 'missing') return null; state = createReducerState(state.runtime); return { kind: 'cancel-logout' }; },
    }));
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ status: 'unavailable' });
    mode = 'replace';
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ reason: 'state-replaced' });
    state = createReducerState({ ...state.runtime, game: null });
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ reason: 'no-adventure' });
    expect(write).not.toHaveBeenCalled();
  });

  it('does not report commitment when compare-and-set rejects a replaced store', () => {
    const state = createReducerState(runtime());
    const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
    const compareAndSet = vi.fn(() => false);
    bus.register('select-verb', reducerActionHandler({ getState: () => state, reduce: createReducer({ registry, bindings: [] }), compareAndSet,
      resolve: () => ({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'fixture-no-award', observations: [], acceptedEffects: [] } }),
    }));
    expect(bus.dispatch(bus.capture(look))).toMatchObject({ status: 'rejected', reason: 'state-replaced' });
    expect(compareAndSet).toHaveBeenCalledTimes(1);
    expect(state.control.actionIds).toEqual([]);
  });
});
