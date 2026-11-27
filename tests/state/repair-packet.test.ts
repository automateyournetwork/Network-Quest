// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../../src/content/registry';
import type { ActionId, AttemptId, ConfigurationRevision, DomainAction, WorldVersion } from '../../src/domain/types';
import type { JourneyPhase, PacketJourneyInput } from '../../src/domain/packet-journey';
import { createRepairPacketSource, inspectRepairPacketJourney } from '../../src/state/repair-packet';
import type { RepairScenario, RepairScenarioResolver } from '../../src/state/repair-plan';
import type { GameState } from '../../src/state/types';
import { fixture, q, registry } from './outcome-fixture';

const oracle = JSON.parse(readFileSync(new URL('../fixtures/packet-journey.json', import.meta.url), 'utf8')) as {
  comparisonCases: { id: string; expected: { knownPatternMatches: boolean; differingBits: number; differingBitPositions: number[]; recoveredHex: string[] } }[];
};
const expected = (id: string) => oracle.comparisonCases.find(c => c.id === id)!.expected;
const action = (world: WorldVersion, phase: JourneyPhase = 'compare'): DomainAction<PacketJourneyInput> => ({
  actionId: crypto.randomUUID() as ActionId, expectedVersion: world, input: { kind: 'inspect', phase },
});
function ready(route: 'copper' | 'fiber' | 'radio' = 'copper', plan = `${route}-${route === 'copper' ? 'section' : 'A'}`,
  replace?: (base: RepairScenarioResolver) => RepairScenarioResolver) {
  const f = fixture(route, replace);
  if (plan === 'shutdown') { f.choose('plan-shutdown'); f.choose('read-plan'); f.review(); } else f.prepare(plan);
  if (plan === 'shutdown') f.choose('record-isolation');
  expect(f.execute().result.status).toBe('handled'); expect(f.move('R12').status).toBe('handled');
  const source = createRepairPacketSource({ registry, resolveScenario: f.resolver, game: f.game() });
  return { ...f, source, inspect: (phase: JourneyPhase = 'compare') => inspectRepairPacketJourney(source, action(f.game().world, phase), f.game().world) };
}

describe('T090 actual executed repair packet source, before UI integration', () => {
  it.each([
    ['copper', 'copper-section', 'Total channel length', 95, 'm'],
    ['copper', 'copper-alternate', 'Total channel length', 100, 'm'],
    ['fiber', 'fiber-A', 'Receive power', -11, 'dBm'],
    ['fiber', 'fiber-B', 'Receive power', -12, 'dBm'],
    ['radio', 'radio-A', 'Signal-to-noise ratio', 25, 'dB'],
    ['radio', 'radio-B', 'Signal-to-noise ratio', 20, 'dB'],
  ] as const)('%s %s uses actual physical/common preparation and independent NQ expectation', (route, plan, name, value, unit) => {
    const f = ready(route, plan), before = f.state(), actual = f.inspect(), wanted = expected('PJ-MATCH');
    expect(actual.status).toBe('correct'); expect(actual.acceptedEffects).toEqual([]);
    expect(actual.observations[0]).toMatchObject({ kind: 'repair-packet-journey', route, planId: plan,
      version: { attemptId: f.game().world.attemptId, configurationRevision: f.game().world.configurationRevision },
      physicalStatus: 'correct', recoveredBits: '0100111001010001', recoveredSymbolValues: [-1, -3, 3, 1, -1, -1, -3, -1],
      comparison: { knownPatternMatches: wanted.knownPatternMatches, differingBits: wanted.differingBits,
        differingBitPositions: wanted.differingBitPositions, recoveredHex: wanted.recoveredHex },
      transmissionSucceeded: true, wholeFrameIsTwoBytes: false, universalPHYErrorDetection: false,
      ethernetFcsValidated: false, higherLayerServiceProven: false, wholeRouteProven: false, progressAward: 0, attemptPenalty: 0 });
    const observation = actual.observations[0];
    if (observation?.kind !== 'repair-packet-journey') throw new Error('Missing actual route result');
    expect(observation.physicalReadings).toContainEqual({ name, value, unit });
    expect(f.state()).toBe(before); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it.each(['copper', 'fiber', 'radio'] as const)('%s suppresses all received trace after a physical impairment, even with supplied matching bits', route => {
    const f = ready(route, undefined, base => (game, plan) => {
      const s = base(game, plan); if (!s || game.world.roomId !== q('R12')) return s;
      const path: RepairScenario['path'] = route === 'copper' ? { kind: 'copper-path', compatible: true,
        lengths: [{ value: 105, unit: 'm' }], requiredConductors: [true, true, true, true] }
        : route === 'fiber' ? { kind: 'optical-passive', compatible: true, loss: { value: 10, unit: 'dB' } }
          : { kind: 'radio-link', viablePath: true, settingsCompatible: true, signal: { value: -65, unit: 'dBm' }, noise: { value: -84, unit: 'dBm' } };
      return { ...s, path };
    });
    for (const phase of ['payload', 'encode', 'transmit', 'decode', 'compare'] as const) {
      const actual = f.inspect(phase); expect(actual.status).toBe('incorrect');
      expect(actual.observations[0]).toMatchObject({ physicalStatus: 'incorrect', recoveredBits: null,
        recoveredSymbolValues: null, knownPatternMatches: null, comparison: null, transmissionSucceeded: false });
    }
  });
  it.each(['power', 'capability', 'symbols', 'role'] as const)('a failed current %s requirement suppresses recovery despite the completed training objective', fault => {
    const f = ready('copper', undefined, base => (game, plan) => {
      const s = base(game, plan); if (!s || game.world.roomId !== q('R12')) return s;
      if (fault === 'power') return { ...s, equipment: s.equipment && { ...s.equipment, allocation: { ...s.equipment.allocation, perPortConstraintsMet: false } } };
      if (fault === 'capability') return { ...s, equipment: s.equipment && { ...s.equipment, capability: { ...s.equipment.capability, selected: { rate: { value: 1000, unit: 'Mbps' }, duplex: 'full' } } } };
      if (fault === 'symbols') return { ...s, calibration: s.calibration && { ...s.calibration, decodedBits: '00001101' } };
      return { ...s, calibration: s.calibration && { ...s.calibration, roleClaim: 'physical-repeater-resolves-IP-address' } };
    });
    expect(f.inspect()).toMatchObject({ status: 'incorrect', acceptedEffects: [], observations: [{ recoveredBits: null, transmissionSucceeded: false }] });
  });
  it('uses the actual supplied mismatch rather than deriving one from a failed metric', () => {
    const f = ready('fiber', undefined, base => (g, p) => { const s = base(g, p); return s && { ...s, receivedBits: '0100111001010000' }; });
    const result = f.inspect(), wanted = expected('PJ-DIFF');
    expect(result.status).toBe('incorrect'); expect(result.observations[0]).toMatchObject({ physicalStatus: 'correct',
      recoveredBits: '0100111001010000', recoveredSymbolValues: [-1, -3, 3, 1, -1, -1, -3, -3], transmissionSucceeded: false,
      comparison: { knownPatternMatches: wanted.knownPatternMatches, differingBits: wanted.differingBits,
        differingBitPositions: wanted.differingBitPositions, recoveredHex: wanted.recoveredHex } });
  });
  it('keeps a passing pattern separate from an unavailable endpoint service', () => {
    const f = ready('radio', undefined, base => (g, p) => { const s = base(g, p); return s && { ...s, endpointResponse: 'service-unavailable' }; });
    expect(f.inspect().observations[0]).toMatchObject({ transmissionSucceeded: true, higherLayerServiceProven: false,
      endpointResponse: 'service-unavailable' });
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
  });
  it('shows deliberate isolation without any received bits or apparent transmission success', () => {
    const f = ready('copper', 'shutdown'), before = f.state();
    expect(f.inspect()).toMatchObject({ status: 'incorrect', reasonCode: 'service-deliberately-isolated', acceptedEffects: [],
      observations: [{ planId: 'shutdown', physicalStatus: 'incorrect', recoveredBits: null, recoveredSymbolValues: null,
        comparison: null, transmissionSucceeded: false, endpointResponse: null }] });
    expect(f.state()).toBe(before); expect(before.runtime.activity?.kind).toBe('active-encounter');
  });
  it('resamples trusted raw scenario data once at every phase instead of caching prior success', () => {
    let mismatch = false, calls = 0;
    const f = ready('copper', undefined, base => (g, p) => { calls++; const s = base(g, p); return s && { ...s, receivedBits: mismatch ? '0100111001010000' : '0100111001010001' }; });
    calls = 0; expect(f.inspect().observations[0]).toMatchObject({ transmissionSucceeded: true }); expect(calls).toBe(1);
    mismatch = true; expect(f.inspect().observations[0]).toMatchObject({ transmissionSucceeded: false, differingBits: 1 }); expect(calls).toBe(2);
  });
  it.each(['revision', 'attempt'] as const)('rejects %s relabeling of an original source and a stale action', field => {
    const f = ready(), world: WorldVersion = { ...f.game().world, ...(field === 'revision'
      ? { configurationRevision: (f.game().world.configurationRevision + 1) as ConfigurationRevision } : { attemptId: crypto.randomUUID() as AttemptId }) };
    expect(inspectRepairPacketJourney(f.source, action(world), world)).toMatchObject({ status: 'invalid-input', reasonCode: 'stale-repair-source' });
    expect(inspectRepairPacketJourney(f.source, action(world), f.game().world)).toMatchObject({ status: 'invalid-input', reasonCode: 'stale-action' });
  });
  it('rejects a structurally copied source and never accepts a caller verdict', () => {
    const f = ready();
    expect(inspectRepairPacketJourney({ ...f.source }, action(f.game().world), f.game().world)).toMatchObject({ status: 'invalid-input' });
    expect(inspectRepairPacketJourney(f.source, { ...action(f.game().world), input: { kind: 'inspect', phase: 'compare', success: true } } as never, f.game().world)).toMatchObject({ status: 'invalid-input' });
  });
  it.each(['missing-plan', 'missing-execution', 'unexecuted', 'wrong-route'] as const)('refuses %s world as an executed repair', fault => {
    const f = ready(), original = f.game(), flags = { ...original.world.flags };
    if (fault === 'missing-plan') delete flags[q<'flag'>('FLAG-repair-executed')];
    const game: GameState = { ...original, world: { ...original.world, flags,
      completedObjectiveIds: fault === 'unexecuted' ? original.world.completedObjectiveIds.filter(id => id !== q('O11')) : original.world.completedObjectiveIds,
      route: fault === 'wrong-route' ? 'radio' : original.world.route }, notebook: { ...original.notebook,
      factIds: fault === 'missing-execution' ? original.notebook.factIds.filter(id => id !== q('FACT-O11-execution')) : original.notebook.factIds } };
    const source = createRepairPacketSource({ registry, resolveScenario: f.resolver, game });
    expect(inspectRepairPacketJourney(source, action(game.world), game.world)).toMatchObject({ status: 'invalid-input' });
  });
  it.each(['profile', 'receiver', 'extra-scenario', 'throwing-resolver'] as const)('fails closed on malformed %s without affecting live state', fault => {
    const f = ready(), before = f.state();
    const content: ContentRegistry = fault === 'profile' ? { ...registry, record: id => id === q('PROFILE-PACKET') ? undefined : registry.record(id) } : registry;
    const resolver: RepairScenarioResolver = (g, p) => {
      if (fault === 'throwing-resolver') throw new Error('unavailable trusted environment');
      const s = f.resolver(g, p); return !s ? s : fault === 'receiver' ? { ...s, receivedBits: 'not bits' }
        : fault === 'extra-scenario' ? { ...s, success: true } as RepairScenario : s;
    };
    const source = createRepairPacketSource({ registry: content, resolveScenario: resolver, game: f.game() });
    const result = inspectRepairPacketJourney(source, action(f.game().world), f.game().world);
    expect(result).toMatchObject({ status: 'content-error', acceptedEffects: [], observations: [{ transmissionSucceeded: false, progressAward: 0, attemptPenalty: 0 }] });
    expect(f.state()).toBe(before);
  });
  it('does not add, refresh, delete, or relabel notebook proof during inspection', () => {
    const f = ready(); f.choose('read-classification'); f.act({ kind: 'measure-link', id: '00000000-0000-4000-8000-000000000042' as never });
    const state = f.state(), source = createRepairPacketSource({ registry, resolveScenario: f.resolver, game: f.game() });
    for (const phase of ['payload', 'encode', 'transmit', 'decode', 'compare'] as const) inspectRepairPacketJourney(source, action(f.game().world, phase), f.game().world);
    expect(f.state()).toBe(state); expect(state.runtime.persistence.pendingRequest).toBeNull();
  });
  it('passes a detached frozen game to the environment and rejects its attempted mutation', () => {
    const f = ready(), before = f.state(); let sampled: GameState | null = null;
    const source = createRepairPacketSource({ registry, game: f.game(), resolveScenario: (game, plan) => {
      sampled = game; (game.world.flags as Record<string, unknown>)['spec001:FLAG-repair-executed'] = 'shutdown';
      return f.resolver(game, plan);
    } });
    expect(inspectRepairPacketJourney(source, action(f.game().world), f.game().world).status).toBe('content-error');
    expect(sampled).not.toBe(f.game()); expect(Object.isFrozen(sampled)).toBe(true); expect(f.state()).toBe(before);
  });
  it('keeps malformed source data an authoring error even when the inspection action is absent', () => {
    const f = ready('copper', undefined, base => (g, p) => { const s = base(g, p); return s && { ...s, receivedBits: 'not bits' }; });
    expect(inspectRepairPacketJourney(f.source, null as never, f.game().world)).toMatchObject({ status: 'content-error',
      acceptedEffects: [], observations: [{ transmissionSucceeded: false, progressAward: 0, attemptPenalty: 0 }] });
  });
  it('keeps an earlier immutable observation at its original version when a later source is inspected', () => {
    const f = ready(), first = f.inspect(), original = structuredClone(first);
    f.choose('read-classification');
    const source = createRepairPacketSource({ registry, game: f.game(), resolveScenario: f.resolver });
    const next = inspectRepairPacketJourney(source, action(f.game().world), f.game().world);
    expect(next.status).toBe('correct'); expect(first).toEqual(original); expect(Object.isFrozen(first.observations[0])).toBe(true);
  });
});
