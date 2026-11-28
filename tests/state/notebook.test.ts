// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { Ajv2020 } from 'ajv/dist/2020';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import { introductionNotebookEffectBindings } from '../../src/state/notebook';
import type { NotebookOperation } from '../../src/state/notebook';
import { createReducer, createReducerState, isMeasurementCurrent } from '../../src/state/reducer';
import type { ReducerCommand, ReducerInput, StateEffect } from '../../src/state/reducer';
import type { ActionId, HypothesisId, MeasurementId } from '../../src/domain/types';
import { introBindings, q, setup, choice } from '../ui/inventory-fixture';

const id = '00000000-0000-4000-8000-000000000027';
const secondId = '00000000-0000-4000-8000-000000000028';
function fixture() {
  const f = setup({ bindings: [...introBindings, ...introductionNotebookEffectBindings], inventory: [{ itemId: q<'item'>('ITEM-inspection-kit'), quantity: 1 }] });
  const send = (input: ReducerInput, actionId: string = crypto.randomUUID()): ReturnType<typeof f.store.reduce> => {
    const before = f.store.getState(), game = before.runtime.game!;
    const result = f.store.reduce(before, { adventureId: game.adventureId, expectedVersion: game.world, actionId: actionId as ActionId, input });
    if (result.status !== 'rejected') f.store.compareAndSet(before, result.state);
    return result;
  };
  const notebook = (operation: NotebookOperation, actionId?: string) => send({ kind: 'notebook', operation }, actionId);
  const inspect = (measurementId = id) => notebook({ kind: 'inspect-path', id: measurementId as MeasurementId });
  const workshop = () => {
    const before = f.store.getState(), game = before.runtime.game!;
    f.replace(createReducerState({ ...before.runtime, game: { ...game, world: { ...game.world, roomId: q<'room'>('R02'), position: { safePositionId: q<'safe-position'>('R02.entry') },
      flags: { ...game.world.flags, [q('FLAG-endpoints-identified')]: true, [q('FLAG-path-declared')]: true } },
    notebook: { ...game.notebook, factIds: [q<'fact'>('FACT-endpoints'), q<'fact'>('FACT-endpoint-a'), q<'fact'>('FACT-endpoint-b'), q<'fact'>('FACT-path')] } } }));
  };
  return { ...f, send, notebook, inspect, workshop };
}

describe('T027 notebook writes through the canonical reducer', () => {
  it('retires one measured Workshop hypothesis only on the player’s decision, retaining its text and all readings', () => {
    const f = fixture();
    const hypothesisId = secondId as HypothesisId;
    f.inspect(); f.workshop();
    const pin = { kind: 'pin-hypothesis' as const, id: hypothesisId, text: 'Only the cable length is at fault.' };
    expect(f.notebook(pin).status).not.toBe('rejected');
    const before = f.store.getState().runtime.game!;
    expect(f.notebook({ kind: 'retire-hypothesis', id: id as HypothesisId }).status).toBe('rejected');
    expect(f.notebook({ kind: 'retire-hypothesis', id: hypothesisId }).status).not.toBe('rejected');
    const after = f.store.getState().runtime.game!;
    expect(after.notebook.hypotheses).toEqual([{ ...before.notebook.hypotheses[0], status: 'rejected' }]);
    expect(after.notebook.measurements).toEqual(before.notebook.measurements);
    expect(after.world).toEqual(before.world);
    expect(f.notebook({ kind: 'retire-hypothesis', id: hypothesisId }).status).toBe('rejected');
  });
  it('records a valid 105 m inspection as over-limit, atomically with its flag and actual resulting evaluation version', () => {
    const f = fixture(), before = f.store.getState();
    expect(f.inspect().status).toBe('applied');
    const after = f.store.getState(), game = after.runtime.game!, measurement = game.notebook.measurements[0]!;
    expect(game.world.configurationRevision).toBe(before.runtime.game!.world.configurationRevision + 1);
    expect(measurement).toMatchObject({ id, ruleId: q('PHY04'), roomId: q('R01'), conclusionCode: 'length-exceeded', stale: false,
      configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId,
      readings: [{ name: 'Channel length', value: 105, unit: 'm' }, { name: 'Inclusive maximum', value: 100, unit: 'm' }, { name: 'Excess', value: 5, unit: 'm' }] });
    expect(isMeasurementCurrent(measurement, game.world)).toBe(true);
    expect(game.world.flags[q<'flag'>('FLAG-path-inspected')]).toBe(true);
    expect(game.world.completedObjectiveIds).toEqual([]); expect(game.world.inventory).toEqual(before.runtime.game!.world.inventory);
    expect(after.runtime.persistence.dirtyGeneration).toBe(1);
  });
  it('retains the old result with its original attempt/revision after a real path change, then adds a fresh 95 m result', () => {
    const f = fixture(); f.inspect(); const original = f.store.getState().runtime.game!.notebook.measurements[0]!;
    f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-path', observations: [], acceptedEffects: choice('ACTION-path-short').effects as StateEffect[] } });
    const changed = f.store.getState().runtime.game!;
    expect(changed.notebook.measurements[0]).toEqual({ ...original, stale: true });
    expect(isMeasurementCurrent(changed.notebook.measurements[0]!, changed.world)).toBe(false);
    expect(f.inspect(secondId).status).toBe('applied');
    const game = f.store.getState().runtime.game!, newest = game.notebook.measurements[1]!;
    expect(game.notebook.measurements[0]).toEqual({ ...original, stale: true });
    expect(newest.conclusionCode).toBe('length-within-profile'); expect(newest.readings[0]?.value).toBe(95);
    expect(isMeasurementCurrent(newest, game.world)).toBe(true); expect(game.world.completedObjectiveIds).toEqual([]);
  });
  it('never fabricates an inspection from the authored flag or records without the kit/current room', () => {
    const f = fixture(); let before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, inventory: [], flags: { [q('FLAG-path-inspected')]: true } } } } });
    before = f.store.getState(); expect(f.inspect().status).toBe('rejected'); expect(f.store.getState()).toBe(before);
    const other = fixture(); other.workshop(); before = other.store.getState(); expect(other.inspect().status).toBe('rejected'); expect(other.store.getState()).toBe(before);
  });
  it('rejects unsupported path values before awarding any flag or journal change', () => {
    for (const mode of [null, false, 'unknown']) {
      const f = fixture(), before = f.store.getState();
      f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world, flags: { [q('FLAG-path-mode')]: mode } } } } } as typeof before);
      const invalid = f.store.getState(); expect(f.inspect().status).toBe('rejected'); expect(f.store.getState()).toBe(invalid);
    }
  });
  it('rejects a corrupted profile evaluated after effect preparation without applying its provisional flag or dirty increment', () => {
    const f = fixture(), before = f.store.getState(), profile = f.registry.record(q('PROFILE-COPPER-100'))!;
    const registry = { ...f.registry, record: (id: string) => id === profile.id ? { ...profile, parameters: { maximumChannelLength: { value: 100, unit: 'W' }, inclusiveMaximum: true } } : f.registry.record(id) };
    const reduce = createReducer({ registry, bindings: [...introBindings, ...introductionNotebookEffectBindings] });
    const result = reduce(before, { actionId: 'invalid-profile' as ActionId, adventureId: before.runtime.game!.adventureId, expectedVersion: before.runtime.game!.world,
      input: { kind: 'notebook', operation: { kind: 'inspect-path', id: id as MeasurementId } } });
    expect(result).toMatchObject({ status: 'rejected', reason: 'content-error' }); expect(result.state).toBe(before);
    expect(result.state.runtime.game!.world.flags[q<'flag'>('FLAG-path-inspected')]).toBeUndefined();
  });
  it('writes 4096 Unicode characters literally, increments dirty once, leaves world and pending save receipt intact', () => {
    const f = fixture(), original = f.store.getState(), text = '🧵'.repeat(4090) + '<b>x</';
    const pendingRequest: import('../../src/state/types').PendingSaveRequest = {
      requestId: '00000000-0000-4000-8000-000000000050' as import('../../src/state/types').SaveRequestId, bodyBytes: [123, 125],
      precondition: { header: 'If-None-Match', value: '*' }, mode: 'manual', confirmAdventureReplacement: false,
      capturedGeneration: original.runtime.persistence.dirtyGeneration, clientGeneration: original.runtime.auth.clientGeneration,
    };
    f.replace({ ...original, runtime: { ...original.runtime, persistence: { ...original.runtime.persistence, status: 'saving', pendingRequest,
      lastAcknowledgedGeneration: original.runtime.persistence.dirtyGeneration } } }); const before = f.store.getState();
    expect([...text]).toHaveLength(4096);
    expect(f.notebook({ kind: 'notes', text }).status).toBe('applied');
    const after = f.store.getState(); expect(after.runtime.game!.notebook.personalNotes).toBe(text);
    expect(after.runtime.game!.world).toEqual(before.runtime.game!.world); expect(after.runtime.persistence.dirtyGeneration).toBe(1);
    expect(after.runtime.persistence.pendingRequest).toBe(before.runtime.persistence.pendingRequest);
    expect(after.runtime.persistence.status).toBe('saving'); expect(after.runtime.persistence.lastAcknowledgedGeneration).toBe(0);
    expect(after.runtime.persistence.pendingRequest!.capturedGeneration).toBe(0);
    expect(f.notebook({ kind: 'notes', text }).status).toBe('no-op'); expect(f.store.getState().runtime.persistence.dirtyGeneration).toBe(1);
  });
  it('accepts the 512-character Unicode hypothesis boundary and enforces collection capacity before markers', () => {
    const f = fixture(); f.workshop(); expect(f.notebook({ kind: 'pin-hypothesis', id: id as HypothesisId, text: '🧵'.repeat(512) }).status).toBe('applied');
    const original = f.store.getState();
    f.replace({ ...original, runtime: { ...original.runtime, game: { ...original.runtime.game!, notebook: { ...original.runtime.game!.notebook,
      hypotheses: Array.from({ length: 64 }, (_, index) => ({ ...original.runtime.game!.notebook.hypotheses[0]!, id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}` as HypothesisId })) } } } });
    const full = f.store.getState(); expect(f.notebook({ kind: 'pin-hypothesis', id: '00000000-0000-4000-8000-999999999999' as HypothesisId, text: 'another' }).reason).toBe('invalid-state'); expect(f.store.getState()).toBe(full);
    const measured = fixture(); measured.inspect(); const state = measured.store.getState();
    measured.replace({ ...state, runtime: { ...state.runtime, game: { ...state.runtime.game!, notebook: { ...state.runtime.game!.notebook,
      measurements: Array.from({ length: 512 }, (_, index) => ({ ...state.runtime.game!.notebook.measurements[0]!, id: `00000000-0000-4000-8000-${index.toString().padStart(12, '0')}` as MeasurementId })) } } } });
    const limit = measured.store.getState(); expect(measured.inspect('00000000-0000-4000-8000-999999999999').reason).toBe('invalid-state'); expect(measured.store.getState()).toBe(limit);
  });
  it.each(['x'.repeat(4097), '🧵'.repeat(4097), '\uD800', '\uDC00'])('rejects oversized or malformed Unicode notes atomically (%#)', text => {
    const f = fixture(), before = f.store.getState(); expect(f.notebook({ kind: 'notes', text }).status).toBe('rejected'); expect(f.store.getState()).toBe(before);
  });
  it('pins non-secret player wording with its authored flag atomically, without turning it into a fact', () => {
    const f = fixture(); f.workshop(); const before = f.store.getState(), text = '<b>Maybe?</b> 🧵';
    expect(f.notebook({ kind: 'pin-hypothesis', id: id as HypothesisId, text }).status).toBe('applied');
    const after = f.store.getState(); expect(after.runtime.game!.notebook.hypotheses).toEqual([{ id, text, status: 'open', subjectIds: [q('R02'), q('PR012')] }]);
    expect(after.runtime.game!.notebook.factIds).toEqual(before.runtime.game!.notebook.factIds);
    expect(after.runtime.game!.world.flags[q<'flag'>('FLAG-hypothesis-pinned')]).toBe(true); expect(after.runtime.persistence.dirtyGeneration).toBe(1);
    expect(after.runtime.game!.world.completedObjectiveIds).toEqual([]);
    expect(f.notebook({ kind: 'pin-hypothesis', id: id as HypothesisId, text }).status).toBe('no-op');
    const duplicate = f.store.getState(); expect(f.notebook({ kind: 'pin-hypothesis', id: id as HypothesisId, text: 'Different' }).status).toBe('rejected'); expect(f.store.getState()).toBe(duplicate);
  });
  it.each(['', ' \n\t ', '🧵'.repeat(513), '\uD800'])('rejects empty/oversized/malformed hypotheses without flag (%#)', text => {
    const f = fixture(); f.workshop(); const before = f.store.getState();
    expect(f.notebook({ kind: 'pin-hypothesis', id: id as HypothesisId, text }).status).toBe('rejected'); expect(f.store.getState()).toBe(before);
  });
  it('requires actual recorded scope facts as well as flags before pinning', () => {
    const f = fixture(); f.workshop(); const before = f.store.getState();
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, notebook: { ...before.runtime.game!.notebook, factIds: [] } } } });
    const missing = f.store.getState(); expect(f.notebook({ kind: 'pin-hypothesis', id: id as HypothesisId, text: 'Any testable possibility' }).status).toBe('rejected'); expect(f.store.getState()).toBe(missing);
  });
  it('rejects stale commands and repeated measurement UUIDs after restore; action receipt remains a no-op without duplicate dirty writes', () => {
    const f = fixture(), state = f.store.getState(), game = state.runtime.game!;
    const command: ReducerCommand = { actionId: 'notes-command' as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input: { kind: 'notebook', operation: { kind: 'notes', text: 'receipt' } } };
    const first = f.store.reduce(state, command), repeat = f.store.reduce(first.state, command);
    expect(repeat.status).toBe('no-op'); expect(repeat.state).toBe(first.state);
    f.inspect(); const measured = f.store.getState();
    expect(f.store.reduce(measured, { ...command, actionId: 'old' as ActionId }).reason).toBe('stale-version');
    f.replace(createReducerState(structuredClone(measured.runtime))); const restored = f.store.getState();
    expect(f.inspect().status).toBe('rejected'); expect(f.store.getState()).toBe(restored); expect(restored.runtime.game!.notebook.measurements).toHaveLength(1);
  });
  it.each(['dialogue-transaction', 'room-transition', 'active-encounter', 'terminal-failure', 'shutdown'] as const)('does not write in unsafe activity %s', kind => {
    const f = fixture(), before = f.store.getState(); f.replace({ ...before, runtime: { ...before.runtime, activity: { kind } } });
    const unsafe = f.store.getState(); expect(f.notebook({ kind: 'notes', text: 'no' }).status).toBe('rejected'); expect(f.store.getState()).toBe(unsafe);
  });
  it('retains notes/hypotheses and original measurement versions on retry, and validates unchanged save v1', async () => {
    const f = fixture(); f.inspect(); const measured = f.store.getState();
    f.workshop(); expect(f.notebook({ kind: 'pin-hypothesis', id: secondId as HypothesisId, text: 'Compare the selected conduit with the limit.' }).status).toBe('applied');
    const pinned = f.store.getState().runtime.game!.notebook.hypotheses;
    f.notebook({ kind: 'notes', text: 'Retained clue 🧵' }); const current = f.store.getState();
    f.replace({ ...current, runtime: { ...current.runtime, checkpoint: { adventureId: current.runtime.game!.adventureId, world: { ...measured.runtime.game!.world,
      roomId: q<'room'>('R02'), position: { safePositionId: q<'safe-position'>('R02.entry') } } }, activity: { kind: 'terminal-failure' } } });
    expect(f.send({ kind: 'rewind-preparation', nextAttemptId: '00000000-0000-4000-8000-000000000099' as import('../../src/domain/types').AttemptId }).status).toBe('applied');
    const game = f.store.getState().runtime.game!; expect(game.notebook.personalNotes).toBe('Retained clue 🧵'); expect(game.notebook.hypotheses).toEqual(pinned);
    expect(game.notebook.measurements[0]).toEqual({ ...measured.runtime.game!.notebook.measurements[0], stale: true });
    const schema = JSON.parse(await readFile(new URL('../../specs/001-physical-layer-underworld/contracts/save.schema.json', import.meta.url), 'utf8')) as object;
    const ajv = new Ajv2020({ strict: true, allowUnionTypes: true }); addFormats(ajv); const validate = ajv.compile(schema);
    expect(validate({ ...game, saveSchemaVersion: 1, safeState: 'safe-preparation' }), JSON.stringify(validate.errors)).toBe(true);
  });
});
