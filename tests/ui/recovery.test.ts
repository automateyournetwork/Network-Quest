// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it, vi } from 'vitest';
import endings from '../../content/spec001/endings.json';
import { validateEndingsContent } from '../../src/content/endings';
import type { ActionId, OutcomeEventId } from '../../src/domain/types';
import { captureEncounterContext } from '../../src/state/encounter';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { createRiftHazardController } from '../../src/state/rift-hazard';
import type { ReducerState } from '../../src/state/reducer';
import { createRecoveryController } from '../../src/ui/recovery';
import type { RecoveryCommand } from '../../src/ui/recovery';
import { fixture, q, registry, uuid } from '../state/outcome-fixture';

const checked = validateEndingsContent(endings); if (!checked.ok) throw new Error(checked.issues.join(';'));
const content = checked.value;
// Only training prerequisites are seeded by outcome-fixture. Actual canonical
// registry, execution/checkpoint/action bus, classification and hazard are used.
function setup(kind: 'failure' | 'shutdown' | 'permanent' | 'temporary' = 'failure') {
  const f = fixture(), outcomes = createOutcomeController({ registry, repairScenario: f.resolver });
  const hazards = createRiftHazardController({ registry, content });
  if (kind !== 'failure') {
    f.prepare(kind === 'shutdown' ? 'shutdown' : 'copper-section', kind === 'temporary' ? 'temporary' : 'permanent');
    if (kind === 'shutdown') f.choose('record-isolation');
    if (kind === 'temporary') f.choose('record-maintenance');
    f.send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'enter-preparation', observations: [], acceptedEffects: [] },
      destination: { roomId: q('R11'), safePositionId: q('R11.preparation'), activity: 'safe-preparation' } });
    expect(f.execute().result.status).toBe('handled');
    f.send({ kind: 'notebook', operation: { kind: 'notes', text: 'Inspect the damaged conduit again 🧭' } });
    f.send({ kind: 'objective', operation: { kind: 'hint', objectiveId: q('O12') } });
    if (kind === 'shutdown') { f.move('R12'); f.choose('read-classification'); } else f.prove();
    const result = outcomes.prepareClassification(f.state(), captureOutcomeContext(f.state())!, {
      actionId: 'test-classification' as ActionId, eventId: uuid(90) as unknown as OutcomeEventId,
      operation: { kind: 'classify', selection: kind, linkId: kind === 'shutdown' ? null : uuid(2), endpointId: kind === 'shutdown' ? null : uuid(3) },
    });
    if (!result.ok) throw new Error(JSON.stringify(result)); expect(outcomes.commit(f.store, result.change).ok).toBe(true);
  } else {
    const result = hazards.prepare(f.state(), captureEncounterContext(f.state())!, { hazardId: content.hazard.id, warningAcknowledged: true });
    if (!result.ok) throw new Error(result.reason); expect(hazards.commit(f.store, result.change).ok).toBe(true);
  }
  const changed = vi.fn(), afterRollback = vi.fn(), restore = { available: vi.fn(() => true), continue: vi.fn(), signIn: vi.fn() };
  const observed: ReducerState[] = [];
  const store = { getState: f.state, compareAndSet: vi.fn((before: ReducerState, next: ReducerState) => {
    if (!f.store.compareAndSet(before, next)) return false; observed.push(next); return true;
  }) };
  const recovery = createRecoveryController({ registry, store, outcomes, hazards, restore, changed, afterRollback });
  return { ...f, recovery, recoveryStore: store, outcomes, hazards, changed, afterRollback, restore, observed };
}

describe('T088 owned encounter recovery commands', () => {
  it.each(['failure', 'shutdown'] as const)('%s requires explicit confirmation; cancel keeps exact memory', kind => {
    const h = setup(kind), before = h.state(), command = h.recovery.capture(kind === 'failure' ? 'retry' : 'continue')!;
    expect(h.recovery.availability()).toEqual({ retryAvailable: true, restore: 'sign-in' });
    expect(h.recovery.request(command).ok).toBe(true); const confirmation = h.recovery.project()!;
    expect(confirmation.kind).toBe(kind); expect(h.state()).toBe(before); expect(h.observed).toEqual([]);
    expect(h.recovery.cancel(confirmation).ok).toBe(true); expect(h.state()).toBe(before);
    expect(h.recovery.project()).toBeNull(); expect(h.recovery.confirm(confirmation).ok).toBe(false);
    expect(h.restore.continue).not.toHaveBeenCalled(); expect(h.restore.signIn).not.toHaveBeenCalled(); expect(h.afterRollback).not.toHaveBeenCalled();
  });
  it.each(['failure', 'shutdown'] as const)('%s installs one preparation rewind and clears obsolete UI in that CAS', kind => {
    const h = setup(kind), ended = h.state();
    h.replace({ ...ended, runtime: { ...ended.runtime, ui: { ...ended.runtime.ui!, panel: 'notebook', selectedVerb: 'use', selectedItem: q('ITEM-inspection-kit'), focusedObject: q('PR110'), feedback: 'Old result' } } });
    const before = h.state(), checkpoint = before.runtime.checkpoint!, learning = before.runtime.game!;
    h.recovery.request(h.recovery.capture(kind === 'failure' ? 'retry' : 'continue')!);
    expect(h.recovery.confirm(h.recovery.project()!).ok).toBe(true); const next = h.state(), game = next.runtime.game!;
    expect(h.observed).toEqual([next]); expect(next.runtime.activity).toEqual({ kind: 'safe-preparation' });
    expect(game.world).toEqual({ ...checkpoint.world, attemptId: game.world.attemptId, configurationRevision: game.world.configurationRevision });
    expect(game.world.attemptId).not.toBe(learning.world.attemptId); expect(game.world.configurationRevision).toBeGreaterThan(learning.world.configurationRevision);
    expect(game.notebook.factIds).toEqual(learning.notebook.factIds); expect(game.notebook.personalNotes).toEqual(learning.notebook.personalNotes);
    expect(game.assistance).toEqual(learning.assistance); expect(game.outcomeHistory).toEqual(learning.outcomeHistory);
    expect(game.notebook.measurements).toEqual(learning.notebook.measurements.map(measurement => ({ ...measurement, stale: true })));
    expect(next.runtime.ui).toEqual({ ...before.runtime.ui, panel: 'none', selectedVerb: 'walk', selectedItem: null, focusedObject: null, feedback: null });
    expect(next.runtime.persistence.dirtyGeneration).toBe(before.runtime.persistence.dirtyGeneration + 1);
    expect(next.runtime.persistence.knownSlot).toBe(before.runtime.persistence.knownSlot);
    expect(next.runtime.persistence.pendingRequest).toBe(before.runtime.persistence.pendingRequest);
    expect(h.afterRollback).toHaveBeenCalledExactlyOnceWith(next); expect(h.restore.continue).not.toHaveBeenCalled();
    expect(h.recovery.project()).toBeNull(); expect(h.recovery.availability().retryAvailable).toBe(false);
  });
  it.each(['permanent', 'temporary'] as const)('does not rewind successful %s ending', kind => {
    const h = setup(kind), before = h.state(); expect(h.recovery.availability().retryAvailable).toBe(false);
    expect(h.recovery.capture('retry')).toBeNull(); expect(h.recovery.capture('continue')).toBeNull(); expect(h.state()).toBe(before);
  });
  it('does not trust activity, copied receipts or a renderer verdict', () => {
    const h = setup('shutdown'), ended = h.state(); h.replace(structuredClone(ended));
    expect(h.recovery.availability().retryAvailable).toBe(false); expect(h.recovery.capture('continue')).toBeNull();
    expect(h.recovery.request({ intent: 'continue' } as RecoveryCommand).ok).toBe(false); expect(h.observed).toEqual([]);
  });
  it.each(['retry', 'continue'] as const)('refuses a %s control from the wrong accepted story', intent => {
    const h = setup(intent === 'retry' ? 'shutdown' : 'failure'); expect(h.recovery.capture(intent)).toBeNull();
  });
  it('rechecks checkpoint availability instead of promising an impossible retry', () => {
    const h = setup('shutdown'), ended = h.state();
    h.replace({ ...ended, runtime: { ...ended.runtime, checkpoint: null } });
    expect(h.outcomes.feedback(h.state())?.outcome).toBe('E03'); expect(h.recovery.availability().retryAvailable).toBe(false);
    expect(h.recovery.capture('continue')).toBeNull();
  });
  it.each(['command', 'confirmation'] as const)('exact-state replacement retires %s even with the same world version', phase => {
    const h = setup(), command = h.recovery.capture('retry')!, before = h.state();
    if (phase === 'confirmation') h.recovery.request(command); const confirmation = h.recovery.project();
    h.replace({ ...before, runtime: { ...before.runtime, auth: { ...before.runtime.auth } } });
    expect(phase === 'command' ? h.recovery.request(command).ok : h.recovery.confirm(confirmation!).ok).toBe(false);
    expect(h.recovery.project()).toBeNull(); expect(h.observed).toEqual([]); expect(h.hazards.failure(h.state())).not.toBeNull();
    expect(h.recovery.capture('retry')).not.toBeNull();
  });
  it.each(['invalidate', 'dispose'] as const)('%s retires old commands and confirmations without changing memory', method => {
    const h = setup(), before = h.state(), command = h.recovery.capture('retry')!; h.recovery.request(command); const confirmation = h.recovery.project()!;
    h.recovery[method](); expect(h.recovery.request(command).ok).toBe(false); expect(h.recovery.confirm(confirmation).ok).toBe(false); expect(h.state()).toBe(before);
  });
  it('consumes a command once and never lets an old cancel close a new confirmation', () => {
    const h = setup(), command = h.recovery.capture('retry')!; h.recovery.request(command); const old = h.recovery.project()!;
    expect(h.recovery.request(command).ok).toBe(false); h.recovery.cancel(old); h.recovery.request(h.recovery.capture('retry')!); const current = h.recovery.project()!;
    expect(h.recovery.cancel(old).ok).toBe(false); expect(h.recovery.project()).toBe(current);
  });
  it('delegates guest Restore to provider choice only and authenticated Restore to existing save review', () => {
    const h = setup(), guest = h.state(); expect(h.recovery.capture('restore')).toBeNull();
    expect(h.recovery.request(h.recovery.capture('sign-in-to-restore')!).ok).toBe(true);
    expect(h.restore.signIn).toHaveBeenCalledOnce(); expect(h.restore.continue).not.toHaveBeenCalled(); expect(h.state()).toBe(guest);
    h.replace({ ...guest, runtime: { ...guest.runtime, auth: { status: 'authenticated', clientGeneration: 1, csrfToken: 'isolated', provider: 'github', displayName: 'Local test', expiresAt: '2099-01-01T00:00:00Z' } as never } });
    const authenticated = h.state(); expect(h.recovery.availability().restore).toBe('available'); expect(h.recovery.capture('sign-in-to-restore')).toBeNull();
    expect(h.recovery.request(h.recovery.capture('restore')!).ok).toBe(true); expect(h.restore.continue).toHaveBeenCalledOnce();
    expect(h.state()).toBe(authenticated); expect(h.observed).toEqual([]); expect(h.recovery.project()).toBeNull();
  });
  it('does not offer or invoke an unavailable restore port', () => {
    const h = setup(); h.restore.available.mockReturnValue(false); expect(h.recovery.availability().restore).toBe('unavailable');
    expect(h.recovery.capture('restore')).toBeNull(); expect(h.recovery.capture('sign-in-to-restore')).toBeNull();
    expect(h.recovery.capture('retry')).not.toBeNull();
  });
  it.each([1, 'true', null, undefined])('restore availability requires exact true, never %s', value => {
    const h = setup(); h.restore.available.mockReturnValue(value as unknown as boolean);
    expect(h.recovery.availability().restore).toBe('unavailable'); expect(h.recovery.capture('sign-in-to-restore')).toBeNull();
  });
  it('throwing restore availability fails closed without losing local Retry', () => {
    const h = setup(); h.restore.available.mockImplementation(() => { throw new Error('Port unavailable'); });
    expect(h.recovery.availability()).toEqual({ retryAvailable: true, restore: 'unavailable' });
    expect(h.recovery.capture('retry')).not.toBeNull();
  });
  it('lost final CAS leaves exact memory and no cleanup, and retires the confirmation', () => {
    const h = setup(), before = h.state(); h.recovery.request(h.recovery.capture('retry')!); const confirm = h.recovery.project()!;
    h.recoveryStore.compareAndSet.mockReturnValueOnce(false);
    expect(h.recovery.confirm(confirm).ok).toBe(false); expect(h.state()).toBe(before); expect(h.afterRollback).not.toHaveBeenCalled();
    expect(h.recovery.project()).toBeNull(); expect(h.recovery.confirm(confirm).ok).toBe(false); expect(h.observed).toEqual([]);
    h.recovery.request(h.recovery.capture('retry')!); expect(h.recovery.confirm(h.recovery.project()!).ok).toBe(true);
  });
});
