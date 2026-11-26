// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';
import policyFile from '../../server/content/save-policy.generated.json' with { type: 'json' };
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerState } from '../../src/state/reducer';
import type { ActionId, AdventureId, AttemptId, ConfigurationRevision } from '../../src/domain/types';
import type { ActivityState, ClientGeneration, DirtyGeneration, RuntimeState } from '../../src/state/types';
import { acknowledgeCapturedGeneration, advanceDirtyGeneration, captureSafeSnapshot } from '../../src/state/snapshot';

const validator = new SaveValidator(policyFile.policies as SaveContentPolicy[]);
const generation = (n: number) => n as DirtyGeneration;
function setup() {
  const { registry } = loadIntroductionContent();
  return { registry, state: createReducerState(startIntroduction(createIntroductionRuntime(), registry)),
    reduce: createReducer({ registry, bindings: introductionBindings(registry).effects }) };
}
function capture(state: ReducerState) {
  const result = captureSafeSnapshot(state, validator);
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error('Expected safe capture');
  return result.capture;
}
const withRuntime = (state: ReducerState, runtime: RuntimeState): ReducerState => ({ ...state, runtime });

describe('T048 immutable safe snapshot captures and generation accounting', () => {
  it('captures the real introduction anchor and generation without serializing runtime or incrementing it', () => {
    const { state } = setup(), before = structuredClone(state), result = capture(state);
    expect(result.snapshot.world.position.safePositionId).toBe('spec001:R01.entry');
    expect(result.snapshot.safeState).toBe('stable-exploration');
    expect(result.capturedGeneration).toBe(state.runtime.persistence.dirtyGeneration);
    expect(result.clientGeneration).toBe(state.runtime.auth.clientGeneration);
    expect(Object.keys(result.snapshot).sort()).toEqual(['adventureId', 'assistance', 'contentVersion', 'episodeId', 'notebook', 'outcomeHistory', 'safeState', 'saveSchemaVersion', 'world']);
    expect(JSON.parse(new TextDecoder().decode(new Uint8Array(result.bodyBytes)))).toEqual(result.snapshot);
    expect(state).toEqual(before);
    expect(Object.isFrozen(result)).toBe(true);
    expect(Object.isFrozen(result.bodyBytes)).toBe(true);
    expect(Object.isFrozen(result.snapshot.world.inventory)).toBe(true);
    expect(result.snapshot.world).not.toBe(state.runtime.game!.world);
  });

  it('freezes old bytes while a real reducer edit advances dirty generation once', () => {
    const { state, reduce } = setup(), initial = capture(state);
    const edited = reduce(state, { adventureId: state.runtime.game!.adventureId, expectedVersion: state.runtime.game!.world,
      actionId: 'notes-1' as ActionId, input: { kind: 'notebook', operation: { kind: 'notes', text: 'Café 🧭 — a later observation' } } });
    expect(edited.status).toBe('applied');
    expect(edited.state.runtime.persistence.dirtyGeneration).toBe(initial.capturedGeneration + 1);
    const second = capture(edited.state);
    expect(second.snapshot.notebook.personalNotes).toBe('Café 🧭 — a later observation');
    expect(initial.snapshot.notebook.personalNotes).toBe('');
    expect(new TextDecoder().decode(new Uint8Array(initial.bodyBytes))).not.toContain('later observation');
    const ack = acknowledgeCapturedGeneration(edited.state.runtime, initial);
    expect(ack).toEqual({ ok: true, lastAcknowledgedGeneration: initial.capturedGeneration, hasUnsavedChanges: true });
    expect(acknowledgeCapturedGeneration(edited.state.runtime, second)).toEqual({ ok: true, lastAcknowledgedGeneration: second.capturedGeneration, hasUnsavedChanges: false });
    expect(edited.state.runtime.persistence.lastAcknowledgedGeneration).toBeNull();
  });

  it('owns nested snapshot data even if the source is later mutated outside the reducer', () => {
    const { state } = setup(), result = capture(state), originalBytes = [...result.bodyBytes];
    Reflect.set(state.runtime.game!.notebook, 'personalNotes', 'Unexpected caller mutation');
    expect(result.snapshot.notebook.personalNotes).toBe('');
    expect(result.bodyBytes).toEqual(originalBytes);
    expect(() => Reflect.set(result.snapshot.notebook, 'personalNotes', 'Overwrite')).not.toThrow();
    expect(result.snapshot.notebook.personalNotes).toBe('');
  });

  it.each(['E01', 'E02'] as const)('%s requires a declared safe Continue anchor', outcome => {
    const { state } = setup(), game = state.runtime.game!;
    const runtime = { ...state.runtime, game: { ...game, world: { ...game.world, continueOutcome: outcome } } };
    expect(captureSafeSnapshot(withRuntime(state, runtime), validator).ok).toBe(false);
    const safe = { ...runtime, activity: { kind: 'safe-continue' as const } };
    expect(captureSafeSnapshot(withRuntime(state, safe), validator).ok).toBe(false);
    const policies = structuredClone(policyFile.policies) as SaveContentPolicy[];
    policies[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['safe-continue'];
    const result = captureSafeSnapshot(withRuntime(state, safe), new SaveValidator(policies));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.capture.snapshot.world.continueOutcome).toBe(outcome);
  });

  it.each(['dialogue-transaction', 'pending-effect', 'room-transition', 'cutscene', 'active-encounter', 'terminal-failure', 'shutdown', null] as const)('rejects %s without falling back to preparation or a prior safe snapshot', kind => {
    const { state } = setup();
    const runtime = { ...state.runtime, checkpoint: { adventureId: state.runtime.game!.adventureId, world: state.runtime.game!.world },
      activity: kind ? { kind } as ActivityState : null };
    expect(captureSafeSnapshot(withRuntime(state, runtime), validator)).toMatchObject({ ok: false, code: 'safe-state' });
  });

  it('rejects a pending reducer transition even if a caller incorrectly labels the activity safe', () => {
    const { state, reduce } = setup();
    const pending = reduce(state, { adventureId: state.runtime.game!.adventureId, expectedVersion: state.runtime.game!.world,
      actionId: 'transition-1' as ActionId, input: { kind: 'begin', activity: 'room-transition', evaluation: {
        status: 'correct', reasonCode: 'fixture', observations: [], acceptedEffects: [],
      } } });
    expect(pending.status).toBe('pending');
    expect(captureSafeSnapshot({ ...pending.state, runtime: { ...pending.state.runtime, activity: { kind: 'stable-exploration' } } }, validator))
      .toEqual({ ok: false, code: 'transition-pending', path: '/control/pending' });
  });

  it('rejects title state, metadata-only rooms, incompatible anchors and a current E03 marker', () => {
    const { state } = setup(), game = state.runtime.game!;
    expect(captureSafeSnapshot(createReducerState(createIntroductionRuntime()), validator)).toMatchObject({ ok: false, code: 'safe-state' });
    for (const world of [
      { ...game.world, roomId: 'spec001:R03', position: { safePositionId: 'spec001:R03.entry' } },
      { ...game.world, position: { safePositionId: 'spec001:R02.entry' } },
      { ...game.world, continueOutcome: 'E03' },
    ]) expect(captureSafeSnapshot(withRuntime(state, { ...state.runtime, game: { ...game, world } } as RuntimeState), validator).ok).toBe(false);
  });

  it('does not silently coerce malformed runtime numbers or drop undefined data', () => {
    const { state } = setup(), game = state.runtime.game!;
    for (const value of [NaN, Infinity, undefined]) {
      const runtime = { ...state.runtime, game: { ...game, world: { ...game.world, configurationRevision: value } } } as unknown as RuntimeState;
      expect(captureSafeSnapshot(withRuntime(state, runtime), validator)).toMatchObject({ ok: false, code: 'json' });
    }
  });

  it('keeps a stale observation stale even when its recorded revision and attempt match', () => {
    const { state } = setup(), game = state.runtime.game!;
    const notebook = { ...game.notebook, personalNotes: 'Retained clue', factIds: ['spec001:FACT-power'], measurements: [{
      id: '40000000-0000-4000-8000-000000000001', ruleId: 'spec001:PHY04', subjectIds: ['spec001:PR003'], roomId: 'spec001:R01',
      configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId, stale: true,
      readings: [{ name: 'Channel length', value: 105, unit: 'm' }], conclusionCode: 'length-exceeded',
    }] };
    const result = capture(withRuntime(state, { ...state.runtime, game: { ...game, notebook } } as unknown as RuntimeState));
    expect(result.snapshot.notebook.measurements[0]?.stale).toBe(true);
    expect(result.snapshot.notebook.personalNotes).toBe('Retained clue');
  });

  it.each([-1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('rejects invalid dirty generation %s', value => {
    const { state } = setup();
    expect(advanceDirtyGeneration(generation(value))).toBeNull();
    expect(captureSafeSnapshot(withRuntime(state, { ...state.runtime, persistence: { ...state.runtime.persistence, dirtyGeneration: generation(value) } }), validator))
      .toMatchObject({ ok: false, code: 'generation' });
  });

  it('bounds generation advancement without wrapping; captures do not require another increment', () => {
    expect(advanceDirtyGeneration(generation(0))).toBe(1);
    expect(advanceDirtyGeneration(generation(Number.MAX_SAFE_INTEGER - 1))).toBe(Number.MAX_SAFE_INTEGER);
    expect(advanceDirtyGeneration(generation(Number.MAX_SAFE_INTEGER))).toBeNull();
    const { state } = setup();
    expect(capture(withRuntime(state, { ...state.runtime, persistence: { ...state.runtime.persistence, dirtyGeneration: generation(Number.MAX_SAFE_INTEGER) } })).capturedGeneration).toBe(Number.MAX_SAFE_INTEGER);
  });

  it('rejects malformed account generation before creating a capture', () => {
    const { state } = setup();
    const runtime = { ...state.runtime, auth: { ...state.runtime.auth, clientGeneration: -1 as ClientGeneration } };
    expect(captureSafeSnapshot(withRuntime(state, runtime), validator)).toMatchObject({ ok: false, code: 'generation' });
  });

  it('rejects another account, new adventure, regressed generation or inconsistent acknowledgement', () => {
    const { state } = setup(), runtime = state.runtime;
    const at4 = { ...runtime, persistence: { ...runtime.persistence, dirtyGeneration: generation(4) } };
    const saved = capture(withRuntime(state, at4));
    const alternatives: RuntimeState[] = [
      { ...at4, auth: { ...runtime.auth, clientGeneration: 1 as ClientGeneration } },
      { ...at4, game: { ...runtime.game!, adventureId: crypto.randomUUID() as AdventureId } },
      { ...at4, game: null },
      { ...at4, persistence: { ...at4.persistence, dirtyGeneration: generation(3) } },
      { ...at4, persistence: { ...at4.persistence, lastAcknowledgedGeneration: generation(5) } },
    ];
    for (const value of alternatives) expect(acknowledgeCapturedGeneration(value, saved).ok).toBe(false);
  });

  it('acknowledges UUID case parity and never regresses a later acknowledged generation', () => {
    const { state } = setup(), runtime = state.runtime;
    const game = { ...runtime.game!, adventureId: 'ABCDEFAB-1234-4000-8000-1234567890AB' as AdventureId };
    const saved = capture(withRuntime(state, { ...runtime, game, persistence: { ...runtime.persistence, dirtyGeneration: generation(4) } }));
    const current = { ...runtime, game: { ...game, adventureId: game.adventureId.toLowerCase() as AdventureId },
      persistence: { ...runtime.persistence, dirtyGeneration: generation(6), lastAcknowledgedGeneration: generation(5) } };
    expect(acknowledgeCapturedGeneration(current, saved)).toEqual({ ok: true, lastAcknowledgedGeneration: 5, hasUnsavedChanges: true });
  });

  it('captures the actual post-retry generation and retains journal/history only after the reducer returns to preparation', () => {
    const { state, registry, reduce } = setup(), original = state.runtime.game!;
    // Existing intro anchor is exploration-only. Explicit fixture registry/policy
    // enables preparation for this state-boundary test, not production content.
    const policies = structuredClone(policyFile.policies) as SaveContentPolicy[];
    policies[0]!.safePositions['spec001:R01.entry']!.eligibleStates = ['safe-preparation'];
    const preparationRegistry = { ...registry, safePosition: (id: string) => {
      const anchor = registry.safePosition(id);
      return anchor ? { ...anchor, eligibleStates: ['safe-preparation' as const] } : undefined;
    } };
    const retry = createReducer({ registry: preparationRegistry, bindings: introductionBindings(registry).effects });
    const noted = reduce(state, { adventureId: original.adventureId, expectedVersion: original.world, actionId: 'notes-retry' as ActionId,
      input: { kind: 'notebook', operation: { kind: 'notes', text: 'Retain new notes after E03.' } } }).state;
    const game = { ...noted.runtime.game!, assistance: [{ objectiveId: 'spec001:O01', hintId: 'spec001:HINT-O01-method', level: 1, attemptId: original.world.attemptId }],
      outcomeHistory: [{ id: '50000000-0000-4000-8000-000000000001', outcome: 'E03', attemptId: original.world.attemptId, route: null, caveatIds: [] }],
      notebook: { ...noted.runtime.game!.notebook, factIds: ['spec001:FACT-power'], measurements: [{
        id: '40000000-0000-4000-8000-000000000001', ruleId: 'spec001:PHY04', subjectIds: ['spec001:PR003'], roomId: original.world.roomId,
        configurationRevision: original.world.configurationRevision, attemptId: original.world.attemptId, stale: false,
        readings: [{ name: 'Channel length', value: 105, unit: 'm' }], conclusionCode: 'length-exceeded',
      }] }, world: { ...original.world, configurationRevision: 2 as ConfigurationRevision, inventory: [{ itemId: 'spec001:ITEM-inspection-kit', quantity: 1 }] } };
    const failed = createReducerState({ ...noted.runtime, game, activity: { kind: 'shutdown' }, checkpoint: { adventureId: original.adventureId, world: original.world } } as unknown as RuntimeState);
    expect(captureSafeSnapshot(failed, new SaveValidator(policies)).ok).toBe(false);
    const restored = retry(failed, { adventureId: original.adventureId, expectedVersion: failed.runtime.game!.world, actionId: 'retry' as ActionId,
      input: { kind: 'rewind-preparation', nextAttemptId: '20000000-0000-4000-8000-000000000003' as AttemptId } });
    expect(restored.status).toBe('applied');
    const result = captureSafeSnapshot(restored.state, new SaveValidator(policies));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected safe retry');
    expect(result.capture.capturedGeneration).toBe(noted.runtime.persistence.dirtyGeneration + 1);
    expect(result.capture.snapshot.world.inventory).toEqual(original.world.inventory);
    expect(result.capture.snapshot.world.configurationRevision).toBe(3);
    expect(result.capture.snapshot.notebook).toEqual({ ...game.notebook, measurements: game.notebook.measurements.map(m => ({ ...m, stale: true })) });
    expect(result.capture.snapshot.assistance).toEqual(game.assistance);
    expect(result.capture.snapshot.outcomeHistory).toEqual(game.outcomeHistory);
  });
});
