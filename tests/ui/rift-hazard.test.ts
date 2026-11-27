// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createRiftHazardController } from '../../src/state/rift-hazard';
import { contextFromRuntime, copySemanticAction, createActionBus } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import type { QualifiedId } from '../../src/domain/types';
import { createRiftHazardPlan } from '../../src/ui/rift-hazard';
import { validateEndingsContent } from '../../src/content/endings';
import { createRepairPlanController } from '../../src/ui/repair-plan';
import endings from '../../content/spec001/endings.json';
import { fixture as repairFixture, registry } from '../state/repair-plan-fixture';
import type { ReducerState } from '../../src/state/reducer';
const validated = validateEndingsContent(endings); if (!validated.ok) throw new Error(validated.issues.join(';'));
const content = validated.value;
const intent: SemanticAction = { kind: 'commit-rift-hazard', hazardId: content.hazard.id as QualifiedId, warningAcknowledged: true };
function fixture() {
  const f = repairFixture(); f.replace({ ...f.state(), runtime: { ...f.state().runtime, activity: { kind: 'safe-preparation' } } });
  let casAllowed = true; const observed: ReducerState[] = [];
  const store = { getState: f.state, reduce: f.reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (!casAllowed || before !== f.state()) return false; f.replace(next); observed.push(next); return true;
  } };
  const hazards = createRiftHazardController({ registry, content });
  const bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
  bus.register('commit-rift-hazard', action => createRiftHazardPlan({ controller: hazards, store, action, before: f.state() }));
  const repair = createRepairPlanController({ registry, store, bus, resolveScenario: f.resolver, hazard: hazards.offer });
  return { ...f, hazards, store, observed, bus, repair, denyCas: () => { casAllowed = false; }, dispose() { repair.dispose(); bus.dispose(); } };
}
describe('T085 actual captured fictional hazard intent', () => {
  it('copies only the closed typed intent and rejects injected verdict/effects or nonboolean acknowledgement', () => {
    expect(copySemanticAction(intent)).toEqual(intent);
    for (const value of [{ ...intent, warningAcknowledged: 1 }, { ...intent, warningAcknowledged: 'true' }, { ...intent, terminalActivity: 'terminal-failure' }, { ...intent, effects: [] }])
      expect(() => copySemanticAction(value as SemanticAction)).toThrow();
  });
  it('the real bus commits terminal failure and checkpoint once, with no game, outcome, inventory or persistence change', () => {
    const f = fixture(), before = f.state(), action = f.bus.capture(intent);
    expect(f.repair.project().view.hazard?.id).toBe(content.hazard.id);
    const result = f.bus.dispatch(action); expect(result.status).toBe('handled');
    expect(f.bus.dispatch(action)).toEqual(result); expect(f.observed).toHaveLength(1);
    expect(f.state().runtime.activity?.kind).toBe('terminal-failure'); expect(f.state().runtime.game).toBe(before.runtime.game);
    expect(f.state().runtime.persistence).toBe(before.runtime.persistence); expect(f.state().runtime.checkpoint?.world).toEqual(before.runtime.game!.world);
    expect(f.hazards.failure(f.state())?.id).toBe(content.hazard.id); expect(f.repair.project().view.hazard).toBeNull();
    expect(f.bus.dispatch(f.bus.capture(intent)).status).toBe('rejected'); expect(f.observed).toHaveLength(1); f.dispose();
  });
  it('canceled, unchecked, old-adventure, invalidated and lost-CAS intent preserve the exact preparation', () => {
    for (const mode of ['cancel', 'unchecked', 'old-adventure', 'invalidate', 'lost-cas'] as const) {
      const f = fixture(); const action = f.bus.capture(mode === 'unchecked' ? { ...intent, warningAcknowledged: false } as SemanticAction : intent);
      if (mode === 'cancel') f.bus.cancel(action);
      if (mode === 'old-adventure') f.replace({ ...f.state(), runtime: { ...f.state().runtime, game: { ...f.game(), adventureId: crypto.randomUUID() as never } } });
      if (mode === 'invalidate') f.bus.invalidate(); if (mode === 'lost-cas') f.denyCas();
      const before = f.state(); expect(f.bus.dispatch(action).status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.observed).toEqual([]); f.dispose();
    }
  });
  it('an already prepared plan cannot commit after a same-version replacement', () => {
    const f = fixture(), before = f.state(), action = f.bus.capture(intent);
    const plan = createRiftHazardPlan({ controller: f.hazards, store: f.store, action, before }); expect(plan.status).toBe('ready');
    const replacement = structuredClone(before); f.replace(replacement);
    if (plan.status === 'ready') expect(plan.commit().status).toBe('rejected');
    expect(f.state()).toBe(replacement); expect(f.observed).toEqual([]); f.dispose();
  });
});
