// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { createRepairPlanController } from '../../src/ui/repair-plan';
import { contextFromRuntime, copySemanticAction, createActionBus } from '../../src/ui/action-bus';
import type { SemanticAction } from '../../src/ui/action-bus';
import { fixture as stateFixture, q, registry, uuid } from '../state/repair-plan-fixture';
function fixture() {
  const f = stateFixture(), store = { getState: f.state, reduce: f.reduce, compareAndSet: (before: ReturnType<typeof f.state>, next: ReturnType<typeof f.state>) => {
    if (f.state() !== before) return false; f.replace(next); return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
  const controller = createRepairPlanController({ registry, store, bus, resolveScenario: f.resolver });
  const send = (input: SemanticAction) => bus.dispatch(bus.capture(input));
  return { ...f, store, bus, controller, send };
}
describe('T077 captured repair controller', () => {
  it('uses captured intent, observes an explicit review, then executes exactly once', () => {
    const f = fixture(); f.choose('plan-copper-section'); f.choose('duration-permanent'); f.choose('read-plan');
    expect(f.send({ kind: 'review-repair-plan' }).status).toBe('handled');
    const projection = f.controller.project(); expect(projection.view.reviewId).not.toBeNull();
    const action = projection.capture({ kind: 'execute-repair-plan', reviewId: projection.view.reviewId!, warningAcknowledged: true });
    expect(f.bus.dispatch(action).status).toBe('handled'); const before = f.game(); f.bus.dispatch(action);
    expect(f.game()).toBe(before); expect(f.game().world.completedObjectiveIds).toContain(q('O11'));
  });
  it('does not create any measurement merely by opening/projecting either panel', () => {
    const f = fixture(); f.controller.project(); f.prepare(); f.execute(); f.move('R12'); const before = f.game();
    expect(f.controller.project().view.stage).toBe('validation'); expect(f.controller.project().view.linkId).toBeNull();
    expect(f.game()).toBe(before); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('explains missing final proof without turning a handled action into success feedback', () => {
    const f = fixture(); f.prepare(); f.execute(); f.move('R12'); f.choose('read-classification');
    expect(f.send({ kind: 'classify-repair', selection: 'permanent', linkId: null, endpointId: null })).toMatchObject({ status: 'handled', message: expect.stringContaining('fresh link') });
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('retains a captured review ID and rejects it after a configuration change', () => {
    const f = fixture(); f.prepare(); const projection = f.controller.project(); f.choose('plan-copper-alternate');
    expect(f.bus.dispatch(projection.capture({ kind: 'execute-repair-plan', reviewId: uuid(1), warningAcknowledged: true }))).toMatchObject({ status: 'rejected', reason: 'stale-context' });
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
  });
  it('canceled, invalidated and disposed controller captures cannot execute', () => {
    const f = fixture(); f.prepare(); const old = f.controller.project(); const action = old.capture({ kind: 'execute-repair-plan', reviewId: uuid(1), warningAcknowledged: true });
    f.bus.cancel(action); expect(f.bus.dispatch(action).reason).toBe('canceled');
    f.bus.invalidate(); expect(f.bus.dispatch(old.capture({ kind: 'review-repair-plan' })).reason).toBe('invalidated');
    f.controller.dispose(); expect(f.send({ kind: 'review-repair-plan' }).status).toBe('unavailable');
  });
  it('final compare-and-set loss prevents both execution and its notebook record', () => {
    const f = stateFixture(); f.prepare(); const before = f.game();
    const bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
    createRepairPlanController({ registry, bus, resolveScenario: f.resolver, store: { getState: f.state, reduce: f.reduce, compareAndSet: () => false } });
    expect(bus.dispatch(bus.capture({ kind: 'execute-repair-plan', reviewId: uuid(1), warningAcknowledged: true }))).toMatchObject({ status: 'rejected', reason: 'state-replaced' });
    expect(f.game()).toBe(before);
  });
  it.each([
    { kind: 'review-repair-plan', effects: [] }, { kind: 'execute-repair-plan', reviewId: uuid(1), warningAcknowledged: 'yes' },
    { kind: 'classify-repair', selection: 'permanent', linkId: uuid(1), endpointId: uuid(2), endpointPass: true },
  ])('does not accept injected verdict fields or a malformed warning', input => {
    expect(() => copySemanticAction(input as SemanticAction)).toThrow();
  });
});
