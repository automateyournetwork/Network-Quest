// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { fixture, input, q, registry, uuid } from './repair-plan-fixture';
import type { RepairScenario } from '../../src/state/repair-plan';
import { prepareRepairPlanChange, repairEffectBindings } from '../../src/state/repair-plan';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { createSaveContentPolicy, SaveValidator } from '../../src/services/save-validator';

describe('T077 executed intervention and fresh final proof', () => {
  it.each([['copper', 'copper-section'], ['copper', 'copper-alternate'], ['fiber', 'fiber-A'], ['fiber', 'fiber-B'], ['radio', 'radio-A'], ['radio', 'radio-B']] as const)('accepts the independently reviewed %s route %s', (route, plan) => {
    const f = fixture(route); f.prepare(plan);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
    expect(f.execute().evaluation?.status).toBe('correct');
    expect(f.game().world.flags[q<'flag'>('FLAG-repair-executed')]).toBe(plan);
    expect(f.game().world.route).toBe(route); expect(f.game().world.completedObjectiveIds).toContain(q('O11'));
    expect(f.game().notebook.measurements[0]?.stale).toBe(true);
    f.prove(); expect(f.classify().evaluation?.status).toBe('correct');
    expect(f.game().world.completedObjectiveIds).toContain(q('O12'));
    expect(f.game().world.flags[q<'flag'>('FLAG-repair-classification')]).toBe('permanent');
    expect(f.game().world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    expect(f.game().outcomeHistory).toEqual([]); // later personalized ending engine remains separate
  });
  it('requires an explicit plan and duration, with no passing defaults', () => {
    const f = fixture(); expect(f.review().result.status).toBe('rejected');
    f.choose('plan-copper-section'); expect(f.review().result.status).toBe('rejected');
    expect(f.game().notebook.measurements).toEqual([]);
  });
  it('does not execute without exact current review, warning acknowledgement and recorded plan', () => {
    const f = fixture(); f.choose('plan-copper-section'); f.choose('duration-permanent');
    expect(f.execute().evaluation?.status).toBe('incorrect'); f.review();
    expect(f.execute().evaluation?.status).toBe('incorrect'); f.choose('read-plan');
    expect(f.execute(1, false).evaluation?.status).toBe('incorrect');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
    expect(f.execute().evaluation?.status).toBe('correct');
  });
  it.each(['O04', 'O09', 'O10'])('does not substitute optional work or a mixed branch for missing %s', objective => {
    const f = fixture(); const s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), world: { ...f.game().world,
      completedObjectiveIds: f.game().world.completedObjectiveIds.filter(id => id !== q(objective)) } } } });
    f.prepare(); expect(f.execute().evaluation?.status).not.toBe('correct'); expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
  });
  it('requires a new explicit review when a proposal changes', () => {
    const f = fixture(); f.prepare(); f.choose('plan-copper-alternate');
    expect(f.execute().evaluation?.reasonCode).toBe('stale-evidence');
    expect(f.game().notebook.measurements).toHaveLength(1); expect(f.game().notebook.measurements[0]?.stale).toBe(true);
    f.review(4); expect(f.execute(4).evaluation?.status).toBe('correct');
  });
  it('arrival and a link test cannot replace the separate endpoint test', () => {
    const f = fixture(); f.prepare(); f.execute(); f.move('R12'); f.choose('read-classification');
    expect(f.classify().evaluation?.reasonCode).toBe('final-proof-missing');
    f.act({ kind: 'measure-link', id: uuid(2) }); expect(f.classify().evaluation?.reasonCode).toBe('final-proof-missing');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
    f.act({ kind: 'test-endpoint', id: uuid(3) }); expect(f.classify().evaluation?.status).toBe('correct');
  });
  it('keeps a failed supplied endpoint distinct from a passing physical link and pattern', () => {
    const f = fixture('copper', base => (game, plan) => { const scenario = base(game, plan); return scenario && { ...scenario, endpointResponse: 'service-unavailable' }; });
    f.prepare(); f.execute(); f.prove(); expect(f.classify().evaluation?.reasonCode).toBe('endpoint-service-unresolved');
    expect(f.game().notebook.measurements.find(m => m.id === uuid(2))?.conclusionCode).toContain(':correct');
    expect(f.game().notebook.measurements.find(m => m.id === uuid(3))?.readings).toContainEqual({ name: 'Endpoint service acknowledged', value: 0, unit: 'count' });
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('requires temporary dependency documentation and refuses permanent classification', () => {
    const f = fixture(); f.prepare('copper-section', 'temporary'); expect(f.execute().evaluation?.reasonCode).toBe('temporary-followup-missing');
    f.choose('record-maintenance'); expect(f.execute().evaluation?.status).toBe('correct'); f.prove();
    expect(f.classify().evaluation?.reasonCode).toBe('temporary-is-not-permanent');
    expect(f.classify('temporary').evaluation?.status).toBe('correct');
    expect(f.game().world.flags[q<'flag'>('FLAG-repair-classification')]).toBe('temporary');
  });
  it('deliberate isolation is unresolved, requires recovery documentation and becomes unsafe to save at classification', () => {
    const f = fixture(); f.prepare('shutdown'); expect(f.execute().evaluation?.reasonCode).toBe('isolation-record-missing');
    f.choose('record-isolation'); expect(f.execute().evaluation?.status).toBe('correct'); f.move('R12'); f.choose('read-classification');
    expect(f.classify().evaluation?.status).toBe('incorrect');
    expect(f.act({ kind: 'classify', selection: 'shutdown', linkId: null, endpointId: null }).evaluation?.status).toBe('correct');
    expect(f.state().runtime.activity?.kind).toBe('shutdown'); expect(f.game().world.flags[q<'flag'>('FLAG-repair-classification')]).toBe('shutdown');
    expect(f.game().world.continueOutcome).toBeNull(); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it('an unintentional outage cannot be relabeled deliberate isolation', () => {
    const f = fixture(); f.prepare(); f.execute(); f.prove(); expect(f.classify('shutdown').evaluation?.reasonCode).toBe('shutdown-not-deliberate');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('leaving preparation before commitment applies nothing and keeps the review stale on return', () => {
    const f = fixture(); f.prepare(); const inventory = f.game().world.inventory; f.move('R10'); f.move('R11');
    expect(f.game().world.inventory).toEqual(inventory); expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
    expect(f.execute().evaluation?.reasonCode).toBe('stale-evidence'); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it('replaying execution cannot execute another plan, consume another item or invent a reading', () => {
    const f = fixture(); f.prepare(); f.execute(); const before = f.game(); f.execute();
    expect(f.game()).toBe(before); expect(f.choose('plan-copper-alternate').result.status).toBe('rejected'); expect(f.game()).toBe(before);
  });
  it.each([
    ['FLAG-market-kit', 'original-over-budget'], ['FLAG-market-kit', 'same-shell-mismatch'], ['FLAG-market-kit', 'per-port-failure'],
    ['FLAG-equipment-capability', '1000/full'], ['FLAG-clock-bits-2', '00'], ['FLAG-clock-role', 'physical-repeater-resolves-IP-address'],
  ])('rechecks carried %s=%s despite completed training objectives', (flag, value) => {
    const f = fixture(), s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), world: { ...f.game().world,
      flags: { ...f.game().world.flags, [q(flag!)]: value! } } } } });
    f.prepare(); expect(f.execute().evaluation?.status).toBe('incorrect'); expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
  });
  it('observes a changed deployment path through the real evaluator, rather than a previous branch pass', () => {
    const f = fixture('copper', base => (game, plan) => { const scenario = base(game, plan); return scenario && { ...scenario,
      path: { kind: 'copper-path', compatible: true, lengths: [{ value: 95, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, false, true] } }; });
    f.prepare(); expect(f.game().notebook.measurements[0]?.conclusionCode).toContain(':incorrect');
    expect(f.execute().evaluation?.status).toBe('incorrect'); expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
  });
  it('an explicit wrong received pattern cannot be replaced by a service acknowledgement', () => {
    const f = fixture('copper', base => (game, plan) => { const scenario = base(game, plan); return scenario && { ...scenario, receivedBits: '0100111001010000' }; });
    f.prepare(); f.execute(); f.prove(); expect(f.classify().evaluation?.status).toBe('incorrect');
    expect(f.game().notebook.measurements.find(m => m.id === uuid(2))?.readings).toContainEqual({ name: 'Differing highlighted positions', value: 1, unit: 'count' });
  });
  it.each(['path', 'equipment'] as const)('a post-execution failed %s cannot report recovered packet bits', fault => {
    const f = fixture('copper', base => (game, plan) => {
      const scenario = base(game, plan); if (!scenario || game.world.roomId !== q('R12')) return scenario;
      return fault === 'path' ? { ...scenario, path: { kind: 'copper-path', compatible: true,
        lengths: [{ value: 85, unit: 'm' }, { value: 10, unit: 'm' }], requiredConductors: [true, true, false, true] } }
        : { ...scenario, equipment: scenario.equipment && { ...scenario.equipment, allocation: { ...scenario.equipment.allocation,
          demands: [{ value: 33, unit: 'W' }], perPortConstraintsMet: false } } };
    });
    f.prepare(); f.execute(); f.move('R12'); f.choose('read-classification');
    const observed = f.act({ kind: 'measure-link', id: uuid(2) }); expect(observed.evaluation?.status).toBe('incorrect');
    expect(observed.evaluation?.observations.some(o => o && typeof o === 'object' && 'kind' in o && o.kind === 'packet-comparison')).toBe(false);
    expect(f.game().notebook.measurements.find(m => m.id === uuid(2))?.readings.some(r => r.name === 'Recovered highlighted bits' || r.name === 'Differing highlighted positions')).toBe(false);
    f.act({ kind: 'test-endpoint', id: uuid(3) }); expect(f.classify().evaluation?.status).toBe('incorrect');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('does not record measurements during a pending transition or accept stale captured execution', () => {
    const f = fixture(); f.prepare(); const before = f.state(), context = f.game().world;
    f.send({ kind: 'begin', activity: 'pending-effect', evaluation: { status: 'correct', reasonCode: 'staged', acceptedEffects: [], observations: [] } });
    expect(f.review(5).result).toMatchObject({ status: 'rejected', reason: 'transition-pending' });
    expect(f.game()).toBe(before.runtime.game); f.replace(before); f.choose('duration-temporary');
    const result = f.reduce(f.state(), { actionId: 'old-execution' as never, adventureId: f.game().adventureId, expectedVersion: context,
      input: { kind: 'repair-plan', operation: { kind: 'execute', reviewId: uuid(1), warningAcknowledged: true } } });
    expect(result).toMatchObject({ status: 'rejected', reason: 'stale-version' }); expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
  });
  it('keeps measurements unchanged when duplicate IDs or unsupported direct effect choices are submitted', () => {
    const f = fixture(); f.prepare(); const before = f.game();
    expect(f.review().result.status).toBe('rejected'); expect(f.choose('execute-copper-section').result.status).toBe('rejected');
    expect(f.choose('classify-permanent').result.status).toBe('rejected'); expect(f.game()).toBe(before);
  });
  it('does not infer defect removal from passing physical and endpoint tests or a permanent label', () => {
    const f = fixture('copper', base => (game, plan) => { const scenario = base(game, plan); return scenario && { ...scenario,
      deployment: { ...scenario.deployment, defectRemoved: false } }; });
    f.prepare(); f.execute(); f.prove(); expect(f.classify().evaluation?.reasonCode).toBe('defect-not-removed');
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('requires a real temporary dependency even when the menu and maintenance card say temporary', () => {
    const f = fixture('copper', base => (game, plan) => { const scenario = base(game, plan); return scenario && { ...scenario,
      deployment: { ...scenario.deployment, temporaryDependency: game.world.roomId !== q('R12') } }; });
    f.prepare('copper-section', 'temporary'); f.choose('record-maintenance'); f.execute(); f.prove();
    expect(f.classify('temporary').evaluation?.reasonCode).toBe('temporary-followup-missing');
  });
  it.each(['allocation-kind', 'allocation-profile', 'missing-compatibility', 'null-capability', 'extra-capability', 'null-calibration', 'missing-deployment', 'path-override'] as const)('reports malformed %s as content-error without partial progress or penalty', fault => {
    const f = fixture('copper', base => (game, plan) => {
      const s = structuredClone(base(game, plan)) as unknown as Record<string, any>;
      if (fault === 'allocation-kind') s['equipment'].allocation.kind = 'some-other-check';
      if (fault === 'allocation-profile') s['equipment'].allocation.profile = { id: 'unreviewed' };
      if (fault === 'missing-compatibility') delete s['equipment'].allocation.hostSupport;
      if (fault === 'null-capability') s['equipment'].capability = null;
      if (fault === 'extra-capability') s['equipment'].capability.pass = true;
      if (fault === 'null-calibration') s['calibration'].capability = null;
      if (fault === 'missing-deployment') delete s['deployment'].defectRemoved;
      if (fault === 'path-override') s['path'].profile = { id: 'unreviewed' };
      return s as unknown as RepairScenario;
    });
    f.choose('plan-copper-section'); f.choose('duration-permanent'); const before = f.game();
    expect(f.review().result).toMatchObject({ status: 'rejected', reason: 'content-error' });
    expect(f.game()).toBe(before); expect(f.game().notebook.measurements).toEqual([]);
  });
  it('safe snapshot capture rejects isolation immediately after execution and after final classification', () => {
    const f = fixture(); f.prepare('shutdown'); f.choose('record-isolation');
    const policy = createSaveContentPolicy(registry, input.world, { itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 },
      measurementRules: { 'spec001:STATE04': { readings: { 'Damaged installation removed': 'count', 'Temporary dependency remains': 'count',
        'Unresolved defect identified': 'count', 'Deliberate isolation': 'count' }, conclusionCodes: ['repair:review:shutdown:permanent:correct'] } },
      unsafeFlags: { 'spec001:FLAG-repair-executed': ['shutdown'], 'spec001:FLAG-repair-classification': ['shutdown'] } });
    const validator = new SaveValidator([policy]);
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true);
    f.execute(); expect(captureSafeSnapshot(f.state(), validator)).toMatchObject({ ok: false, code: 'safe-state', path: '/world/flags' });
    f.move('R12'); f.choose('read-classification'); f.act({ kind: 'classify', selection: 'shutdown', linkId: null, endpointId: null });
    expect(captureSafeSnapshot(f.state(), validator)).toMatchObject({ ok: false, code: 'safe-state' });
  });
  it.each(['action-effect', 'weakened-prerequisite', 'alternate-condition'] as const)('rejects structurally valid but unreviewed %s content', mutation => {
    const changed = structuredClone(input), objectives = changed.documents['content/spec001/objectives.json'] as S.collection;
    const objective = objectives.records.find(r => r.id === q('O11')) as S.objective;
    if (mutation === 'weakened-prerequisite') objective.prerequisite = { kind: 'always' };
    if (mutation === 'alternate-condition') objective.alternatives[0]!.condition = { kind: 'always' };
    if (mutation === 'action-effect') { const source = changed.documents['content/spec001/dialogue/repair-plan-actions.json'] as S.collection;
      const dialogue = source.records[0] as S.dialogue; const effect = dialogue.nodes[0]!.choices.find(c => c.id === q('ACTION-repair-execute-copper-section'))!.effects[0]!;
      if (effect.kind === 'set-flag') effect.value = 'fiber-A'; }
    const checked = validateContent(changed); expect(checked.ok, JSON.stringify(checked.issues)).toBe(true);
    if (!checked.ok || !checked.registry) throw new Error('Expected structurally valid unsupported content');
    expect(repairEffectBindings(checked.registry)).toEqual([]);
    const f = fixture(); expect(prepareRepairPlanChange(checked.registry, f.resolver, f.game(), { kind: 'review', id: uuid(1) })).toEqual({ ok: false, reason: 'content-error' });
  });
  it.each(['revision', 'attempt', 'flag', 'readings', 'room', 'subjects', 'conclusion'] as const)('rejects %s corruption of final proof without mutating the observation', corruption => {
    const f = fixture(); f.prepare(); f.execute(); f.prove(); const s = f.state(), m = f.game().notebook.measurements.find(m => m.id === uuid(2))!;
    const changed = { ...m, ...(corruption === 'revision' ? { configurationRevision: 0 as typeof m.configurationRevision } : corruption === 'attempt' ? { attemptId: '00000000-0000-4000-8000-999999999999' as typeof m.attemptId } : corruption === 'flag' ? { stale: true } : corruption === 'readings' ? { readings: [] } : corruption === 'room' ? { roomId: q<'room'>('R11') } : corruption === 'subjects' ? { subjectIds: [q('PROFILE-RADIO')] } : { conclusionCode: 'O12:permanent:correct' }) };
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), notebook: { ...f.game().notebook, measurements: f.game().notebook.measurements.map(row => row.id === m.id ? changed : row) } } } });
    const before = f.game(); expect(f.classify().evaluation?.status).toBe('incorrect'); expect(f.game()).toBe(before);
  });
});
