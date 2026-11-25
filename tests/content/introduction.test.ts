// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { EffectBinding, StateEffect, ReducerState } from '../../src/state/reducer';
import type { RuntimeState, SaveSnapshotV1 } from '../../src/state/types';
import type { ActionId } from '../../src/domain/types';

const read = async (path: string): Promise<unknown> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8'));
const world = await read('content/spec001/world.json') as S.world;
const sources = await read('content/spec001/sources.json');
const documents = Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read(path)])));
const result = validateContent({ world, sources, documents });
const q = (id: string) => `spec001:${id}`;
function record<K extends S.authoredRecord['kind']>(id: string, kind: K): Extract<S.authoredRecord, { kind: K }> {
  const found = result.ok ? result.registry?.record(q(id)) : undefined;
  expect(found?.kind, `Expected authored ${kind} ${id}; ${JSON.stringify(result.issues)}`).toBe(kind);
  return found as Extract<S.authoredRecord, { kind: K }>;
}
function met(condition: S.condition, flags: string[], completed: string[] = []): boolean {
  if (condition.kind === 'always') return true;
  if (condition.kind === 'all') return condition.conditions.every(c => met(c, flags, completed));
  if (condition.kind === 'any') return condition.conditions.some(c => met(c, flags, completed));
  if (condition.kind === 'flag-equals') return condition.value === true && flags.includes(condition.flagId);
  if (condition.kind === 'objective-complete') return completed.includes(condition.objectiveId);
  return false;
}

describe('T023 authored introduction and retained independent requirements', () => {
  it('loads all authored files through the real registry and retains three independent routes', () => {
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (result.ok) expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    expect(world.rooms).toHaveLength(12); expect(world.characters).toHaveLength(25); expect(world.props).toHaveLength(150);
    expect(world.constraints.guestContinuesInMemory).toBe(true);
  });
  it('authors real safe geometry, both return exits and helpful keyboard/text semantics', () => {
    for (const id of ['R01', 'R02']) {
      const room = record(id, 'room');
      expect(room.safePositions[0]?.id).toBe(q(`${id}.entry`));
      expect(room.walkRegions[0]?.vertices.length).toBeGreaterThanOrEqual(3);
      expect(room.exits.some(e => e.toRoomId === q(id === 'R01' ? 'R02' : 'R01'))).toBe(true);
      expect(room.hotspots.every(h => h.unsupportedVerbText.trim().length > 20)).toBe(true);
      expect(room.ambience.assetIds).toEqual([]);
      expect(room.propInstances.every(p => p.assetId.startsWith(q('DEV-')))).toBe(true);
    }
  });
  it('keeps prepared lit power and unlit link distinct, with no service inference', () => {
    const evidence = record('R01', 'room').evidence;
    const power = evidence.find(e => e.id === q('FACT-power'))!;
    const link = evidence.find(e => e.id === q('FACT-link'))!;
    expect(power.text).toContain('Power indication: lit.');
    expect(power.text).toContain('Power indication does not prove a data link.');
    expect(link.text).toContain('Link indication: unlit.');
    expect(link.text).toContain('End-to-end service is not proven.');
    expect(power.subjectIds).not.toEqual(link.subjectIds);
  });
  it('requires each O01 observation and a valid inspection independently', () => {
    const o = record('O01', 'objective');
    const required = ['power-observed', 'link-observed', 'path-inspected'].map(id => q(`FLAG-${id}`));
    expect(o.alternatives).not.toHaveLength(0);
    for (const a of o.alternatives) {
      expect(met(a.condition, required)).toBe(true);
      for (const missing of required) expect(met(a.condition, required.filter(id => id !== missing))).toBe(false);
      expect(a.evidenceIds).toEqual(expect.arrayContaining(['FACT-power', 'FACT-link', 'FACT-inspection'].map(q)));
      expect(a.abilityIds).toEqual([]);
    }
  });
  it('requires O01, known endpoints, a declared path and a pin for O02', () => {
    const o = record('O02', 'objective');
    expect(met(o.prerequisite, [])).toBe(false);
    expect(met(o.prerequisite, [], [q('O01')])).toBe(true);
    const required = ['endpoints-identified', 'path-declared', 'hypothesis-pinned'].map(id => q(`FLAG-${id}`));
    for (const a of o.alternatives) {
      expect(met(a.condition, required)).toBe(true);
      for (const missing of required) expect(met(a.condition, required.filter(id => id !== missing))).toBe(false);
    }
    expect(o.completionExplanation).toContain('hypothesis');
    expect(o.model.limitations.join(' ')).toContain('wording');
  });
  it('declares both named known-good endpoints and their ordered physical path', () => {
    const evidence = record('R02', 'room').evidence;
    const endpoints = evidence.find(e => e.id === q('FACT-endpoints'))!.text;
    const path = evidence.find(e => e.id === q('FACT-path'))!.text;
    expect(endpoints).toContain('Lift Sender A — known good');
    expect(endpoints).toContain('Workshop Receiver B — known good');
    expect(path.indexOf('Lift Sender A')).toBeLessThan(path.indexOf('Workshop Receiver B'));
    expect(path).toContain('patch lead');
  });
  it('keeps clue-bearing dialogue skippable/replayable with real nonempty reward', () => {
    for (const id of ['DIALOGUE-photon-intro', 'DIALOGUE-titan-intro']) {
      const topic = record(id, 'dialogue');
      expect(topic.skipPolicy).toBe('retain-required-evidence');
      expect(topic.replayPolicy).toBe('no-duplicate-effects');
      expect(topic.nodes[0]?.effects.some(e => e.kind === 'record-fact')).toBe(true);
      expect(topic.nodes.every(n => !('voiceAssetId' in n))).toBe(true);
    }
    const item = record('ITEM-inspection-kit', 'item');
    expect(item.consumption).toBe('never'); expect(item.recovery.policy).toBe('not-consumed');
    const grants = record('DIALOGUE-photon-intro', 'dialogue').nodes.flatMap(n => n.effects).filter(e => e.kind === 'grant-item');
    expect(grants).toEqual([{ kind: 'grant-item', effectId: q('EFFECT-kit'), itemId: item.id, quantity: 1 }]);
  });
  it('authors physical change and inspection as different actions with explicit stale-readout reset', () => {
    const actions = record('DIALOGUE-arrival-actions', 'dialogue').nodes.flatMap(n => n.choices);
    const inspect = actions.find(a => a.id === q('ACTION-inspect-path'))!;
    expect(inspect.effects).toContainEqual({ kind: 'set-flag', effectId: q('EFFECT-inspect'), flagId: q('FLAG-path-inspected'), value: true });
    for (const id of ['ACTION-path-short', 'ACTION-path-long']) {
      const change = actions.find(a => a.id === q(id))!;
      expect(change.effects.some(e => e.kind === 'set-flag' && e.flagId === q('FLAG-path-inspected') && e.value === false)).toBe(true);
      expect(change.effects.every(e => e.kind !== 'complete-objective')).toBe(true);
    }
    const reading = record('R01', 'room').evidence.find(e => e.id === q('FACT-inspection'))!;
    expect(reading.requiresFreshMeasurement).toBe(true);
    expect(reading.readings).toEqual([{ name: 'Channel length', unit: 'm' }]);
  });
  it('preserves reviewed copper and packet parameter projections exactly', () => {
    const reviewed = sources as { profiles: { id: string; parameters: unknown }[] };
    for (const id of ['PROFILE-COPPER-100', 'PROFILE-PACKET']) {
      expect(record(id, 'profile').parameters).toEqual(reviewed.profiles.find(p => p.id === q(id))?.parameters);
    }
  });
  it('uses persisted effect IDs within save v1 bounds and grants no hidden objective on conversation replay', () => {
    for (const path of Object.values(documents)) {
      const visit = (value: unknown): void => {
        if (Array.isArray(value)) { value.forEach(visit); return; }
        if (!value || typeof value !== 'object') return;
        const node = value as Record<string, unknown>;
        if (typeof node['effectId'] === 'string') expect(node['effectId']).toMatch(/^spec[0-9]{3}:[A-Za-z0-9][A-Za-z0-9._-]{0,55}$/);
        Object.values(node).forEach(visit);
      };
      visit(path);
    }
    for (const id of ['DIALOGUE-photon-intro', 'DIALOGUE-titan-intro']) expect(record(id, 'dialogue').nodes.flatMap(n => n.effects).some(e => e.kind === 'complete-objective')).toBe(false);
  });
  it('applies the real kit/clue receipt groups once across satchel, skipped dialogue and replay', async () => {
    if (!result.ok || !result.registry) throw new Error('Authoring must validate first');
    const snapshot = await read('specs/001-physical-layer-underworld/contracts/examples/save-v1.json') as SaveSnapshotV1;
    const { saveSchemaVersion: _version, safeState: _safe, ...game } = snapshot;
    const runtime: RuntimeState = {
      game, checkpoint: null, activity: { kind: 'stable-exploration' }, ui: null,
      auth: { status: 'guest', clientGeneration: 0 as RuntimeState['auth']['clientGeneration'], csrfToken: null },
      persistence: { status: 'unsaved', dirtyGeneration: 0 as RuntimeState['persistence']['dirtyGeneration'],
        lastAcknowledgedGeneration: null, knownSlot: undefined, pendingRequest: null, replacementAuthorization: null,
        lastAcknowledgement: null, autosaveEnabled: false },
    };
    const photon = record('DIALOGUE-photon-intro', 'dialogue');
    const actions = record('DIALOGUE-arrival-actions', 'dialogue').nodes.flatMap(n => n.choices);
    const gift = photon.nodes[0]!.effects;
    const bindings = gift.map(effect => ({ sourceId: photon.id, effectId: effect.effectId, mode: 'once',
      receipt: effect.kind === 'record-fact' ? { kind: 'dialogue-effect', id: effect.effectId } : { kind: 'flag', id: q('FLAG-kit-issued') },
    })) as EffectBinding[];
    for (const id of ['ACTION-observe-power', 'ACTION-observe-link', 'ACTION-inspect-path', 'ACTION-path-short', 'ACTION-path-long']) {
      for (const effect of actions.find(a => a.id === q(id))!.effects) bindings.push({ sourceId: q('DIALOGUE-arrival-actions'), effectId: effect.effectId, mode: 'repeatable' } as EffectBinding);
    }
    const o = record('O01', 'objective');
    for (const effect of o.effects) bindings.push({ sourceId: o.id, effectId: effect.effectId, mode: 'once', receipt: { kind: 'objective', id: o.id } } as EffectBinding);
    const reduce = createReducer({ registry: result.registry, bindings });
    let state = createReducerState(runtime);
    let sequence = 0;
    const apply = (effects: S.effect[], expected: 'applied' | 'no-op' | 'rejected' = 'applied') => {
      const current = state.runtime.game!;
      const next = reduce(state, { actionId: `intro-${++sequence}` as ActionId, adventureId: current.adventureId,
        expectedVersion: current.world, input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-content-binding-check', observations: [], acceptedEffects: effects as StateEffect[] } } });
      expect(next.status, next.reason).toBe(expected);
      state = next.state;
      return next;
    };
    // Satchel and Photon share precisely the kit+marker receipt, with the clue
    // in its own genuine dialogue-effect group. No synthetic ledger is needed.
    apply(gift.filter(e => e.kind === 'grant-item'), 'rejected');
    expect(state.runtime.game!.world.inventory).toEqual([]);
    apply(actions.find(a => a.id === q('ACTION-take-kit'))!.effects);
    apply(gift);
    apply(gift, 'no-op');
    expect(state.runtime.game!.world.inventory).toEqual([{ itemId: q('ITEM-inspection-kit'), quantity: 1 }]);
    expect(state.runtime.game!.notebook.factIds).toEqual([q('FACT-photon-clue')]);
    expect(state.runtime.game!.world.dialogueEffectIds).toEqual([q('EFFECT-photon-clue')]);
    apply(o.effects, 'rejected');
    apply(actions.find(a => a.id === q('ACTION-observe-power'))!.effects);
    apply(o.effects, 'rejected');
    apply(actions.find(a => a.id === q('ACTION-observe-link'))!.effects);
    apply(o.effects, 'rejected');
    apply(actions.find(a => a.id === q('ACTION-inspect-path'))!.effects);
    apply(actions.find(a => a.id === q('ACTION-path-short'))!.effects);
    apply(o.effects, 'rejected');
    apply(actions.find(a => a.id === q('ACTION-inspect-path'))!.effects);
    apply(o.effects);
    apply(o.effects, 'no-op');
    expect(state.runtime.game!.world.completedObjectiveIds).toEqual([q('O01')]);
    expect(state.runtime.game!.world.inventory[0]?.quantity).toBe(1);
    // This proves static receipt compatibility, not inspection generation or a
    // playable objective. T027/T029 must bind actual current measurements too.
    const final: ReducerState = state;
    expect(final.runtime.persistence.status).toBe('unsaved');
  });
});
