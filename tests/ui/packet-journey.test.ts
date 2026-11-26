// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { evaluateCopper, type CopperChallenge } from '../../src/domain/copper';
import type { PacketJourneyChallenge, PacketJourneyWorld } from '../../src/domain/packet-journey';
import type { ActionId, WorldVersion } from '../../src/domain/types';
import { copySemanticAction, createActionBus, type ActionContext, type SemanticAction } from '../../src/ui/action-bus';
import { createPacketJourneyController, validatePacketContext, type PacketJourneyBinding } from '../../src/ui/packet-journey';
const read = (path: string) => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const authored = read('../fixtures/packet-journey.json'), source = read('../../content/spec001/sources.json');
const contextData = () => read('../../content/spec001/packet-context.json') as unknown;
function fixture(failing = false, substitution = false) {
  const version = { configurationRevision: 7, attemptId: 'attempt-a' } as WorldVersion;
  const context = { adventureId: 'packet-adventure', ...version } as ActionContext;
  const copper = authored.physicalChallenges[failing ? 'failing-length' : 'passing-length'];
  const profile = source.profiles.find((p: {id: string}) => p.id === copper.profileId);
  const result = evaluateCopper({ kind: copper.kind, profile: { id: profile.id, parameters: profile.parameters }, lengths: copper.lengths } as CopperChallenge,
    { actionId: 'physical' as ActionId, expectedVersion: version, input: { kind: 'measure-length' } }, version);
  const challenge = { packetProfile: authored.reviewedContext.profiles.find((p: {id: string}) => p.id === 'spec001:PROFILE-PACKET'),
    symbolProfile: authored.reviewedContext.profiles.find((p: {id: string}) => p.id === 'spec001:PROFILE-SYMBOLS'),
    bench: authored.assumptions.completeBench, impairment: substitution ? authored.assumptions.substitution : null } as PacketJourneyChallenge;
  let binding: PacketJourneyBinding | null = { identity: {}, context, challenge,
    world: { ...version, physicalEvidence: { result, evaluatedVersion: version, stale: false } } };
  const bus = createActionBus({ getContext: () => binding?.context ?? null });
  const closed = vi.fn();
  const controller = createPacketJourneyController({ bus, read: () => binding, context: contextData(), onClose: closed });
  const choose = (kind: SemanticAction['kind']) => { const p = controller.project(); const control = p.view.controls.find(c => c.action.kind === kind); if (!control) throw new Error(`Missing ${kind}`); return bus.dispatch(p.capture(control.action)); };
  const view = () => controller.project().view;
  const compare = () => { for (let n = 0; n < 4; n++) expect(choose('step-packet').status).toBe('handled'); return view(); };
  return { bus, controller, choose, view, compare, closed, get: () => binding!, replace: (value: PacketJourneyBinding | null) => { binding = value; } };
}
describe('T033 real packet controller and physical evidence', () => {
  it('starts paused and runs ordered phases with literal NQ results and no effects', () => {
    const f = fixture(); expect(f.controller.open().status).toBe('handled'); expect(f.view()).toMatchObject({ phase: 'payload', paused: true, open: true });
    const phases = ['encode', 'transmit', 'decode', 'compare'];
    for (const phase of phases) { f.choose('step-packet'); expect(f.view().phase).toBe(phase); }
    expect(f.view().result?.observations[0]).toMatchObject({ transmissionSucceeded: true, recoveredBits: '0100111001010001', progressAward: 0 });
    expect(f.view().result?.acceptedEffects).toEqual([]); expect(f.view().controls.some(c => c.action.kind === 'step-packet')).toBe(false);
  });
  it('pause keeps the exact phase and sample order; explicit step stays paused', () => {
    const f = fixture(); f.controller.open(); f.choose('step-packet'); f.choose('resume-packet'); const before = f.view();
    f.choose('pause-packet'); expect(f.view()).toMatchObject({ phase: 'encode', paused: true });
    expect(f.view().result).toEqual(before.result); f.choose('step-packet'); expect(f.view()).toMatchObject({ phase: 'transmit', paused: true });
  });
  it('replay rechecks current evidence, resets paused payload and never changes physical inputs', () => {
    const f = fixture(); const before = structuredClone(f.get().world); f.controller.open(); const first = f.compare();
    f.choose('replay-packet'); expect(f.view()).toMatchObject({ phase: 'payload', paused: true }); expect(f.compare().result).toEqual(first.result); expect(f.get().world).toEqual(before);
  });
  it.each([false, true])('failed physical result with declared substitution %s never succeeds', substitution => {
    const f = fixture(true, substitution); f.controller.open(); const observation = f.compare().result!.observations[0];
    expect(observation).toMatchObject({ transmissionSucceeded: false, recoveredBits: substitution ? '0100111001010000' : null });
    if (substitution) expect(observation).toMatchObject({ comparison: { differingBitPositions: [15], recoveredHex: ['4E', '50'] } });
  });
  it('checks stale evidence on projection, step and replay without relabeling its version', () => {
    const f = fixture(); f.controller.open(); f.compare();
    const world: PacketJourneyWorld = { ...f.get().world, physicalEvidence: { ...f.get().world.physicalEvidence!, stale: true } };
    f.replace({ ...f.get(), world }); expect(f.view().result?.status).toBe('invalid-input');
    expect(f.view().result?.observations[0]).toMatchObject({ transmissionSucceeded: false, recoveredBits: null });
    expect(f.choose('replay-packet').status).toBe('handled'); expect(f.view().result?.status).toBe('invalid-input');
  });
  it('stale evidence pauses playback and later freshness cannot restart it', () => {
    const f = fixture(); f.controller.open(); f.choose('resume-packet'); const original = f.get();
    f.replace({ ...original, world: { ...original.world, physicalEvidence: { ...original.world.physicalEvidence!, stale: true } } });
    expect(f.view().paused).toBe(true); f.replace(original); expect(f.view().paused).toBe(true);
    expect(f.view().controls.some(c => c.action.kind === 'resume-packet')).toBe(true);
  });
  it.each(['identity', 'revision', 'attempt', 'missing'] as const)('invalidates %s replacement and notifies only the owned lifetime', change => {
    const f = fixture(); f.controller.open(); const p = f.controller.project(), original = f.get();
    f.replace(change === 'missing' ? null : { ...original, identity: change === 'identity' ? {} : original.identity,
      context: { ...original.context, ...(change === 'revision' ? { configurationRevision: 8 } : change === 'attempt' ? { attemptId: 'attempt-b' } : {}) } as ActionContext });
    expect(f.view().open).toBe(false); expect(f.closed).toHaveBeenCalledExactlyOnceWith('invalidated', original.identity);
    expect(f.bus.dispatch(p.capture(p.view.controls[0]!.action)).status).toBe('rejected'); expect(f.closed).toHaveBeenCalledTimes(1);
  });
  it('retains original capture epoch on late redraw and rejects old-phase tokens', () => {
    const f = fixture(); f.controller.open(); const p = f.controller.project(); const action = p.capture(p.view.controls[0]!.action);
    f.choose('step-packet'); expect(f.bus.dispatch(action).reason).toBe('packet-stale');
    const current = f.controller.project(); f.bus.invalidate(); expect(f.controller.project().capture).toBe(current.capture);
    expect(f.bus.dispatch(current.capture(current.view.controls[0]!.action)).reason).toBe('invalidated');
  });
  it('same captured action receipts do not advance twice; renderer completion has no channel', () => {
    const f = fixture(); f.controller.open(); const p = f.controller.project(), action = p.capture(p.view.controls[0]!.action);
    const result = f.bus.dispatch(action); expect(f.bus.dispatch(action)).toBe(result); expect(f.view().phase).toBe('encode');
    expect(() => f.bus.capture({ kind: 'renderer-animation-finished' } as never)).toThrow(); expect(f.view().phase).toBe('encode');
  });
  it('close, invalidate and dispose notify once and cannot reopen disposed handlers', () => {
    const f = fixture(); f.controller.open(); f.choose('close-packet'); expect(f.view().open).toBe(false); expect(f.closed).toHaveBeenCalledTimes(1);
    f.controller.open(); f.controller.invalidate(); f.controller.invalidate(); expect(f.closed).toHaveBeenCalledTimes(2);
    f.controller.open(); const action = f.controller.project().view.controls[0]!.action; f.controller.dispose(); f.controller.dispose(); expect(f.closed).toHaveBeenCalledTimes(3);
    expect(f.controller.open().status).toBe('rejected'); expect(f.bus.dispatch(f.bus.capture(action)).reason).toBe('no-handler');
  });
});
describe('T033 authored context boundary and intent shape', () => {
  it('validates original truthful context and returns a frozen detached copy', () => {
    const data = contextData(), output = validatePacketContext(data); expect(output).toEqual(data); expect(output).not.toBe(data); expect(Object.isFrozen(output.realms)).toBe(true);
    expect(output.payload).toContain('0x4E 0x51'); expect(output.payload).toContain('opaque');
    expect(output.realms).toHaveLength(7); expect(output.realms.filter(r => r.available)).toHaveLength(1);
  });
  it.each([null, {}, { extra: true }])('rejects malformed context %j', value => { expect(() => validatePacketContext(value)).toThrow(); });
  it('rejects unknown keys, wrong realm status, duplicate sources, control characters and overlong text', () => {
    for (const mutate of [(d: any) => { d.effects = []; }, (d: any) => { d.realms[0].available = true; }, (d: any) => { d.sources[1].id = d.sources[0].id; }, (d: any) => { d.payload = '\u0000'; }, (d: any) => { d.payload = 'x'.repeat(2001); }]) {
      const data = contextData(); mutate(data); expect(() => validatePacketContext(data)).toThrow();
    }
  });
  it('accepts only session identifiers in all five controls', () => {
    for (const kind of ['step-packet', 'pause-packet', 'resume-packet', 'replay-packet', 'close-packet'] as const) {
      const action = { kind, sessionId: '00000000-0000-4000-8000-000000000001' }; expect(copySemanticAction(action)).toEqual(action);
      for (const bad of [{ ...action, success: true }, { ...action, phase: 'compare' }, { ...action, sessionId: 'old' }]) expect(() => copySemanticAction(bad as SemanticAction)).toThrow();
    }
  });
});
