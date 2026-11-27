// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import validateSchema from '../../src/content/schema.generated.js';
import type * as S from '../../src/content/schema-types.generated';
import { evaluatePower } from '../../src/domain/power';
import type { PowerChallenge, PowerInput, PowerProfile } from '../../src/domain/power';
import { evaluateCapabilities } from '../../src/domain/capabilities';
import type { CapabilitiesChallenge, CapabilitiesInput, CapabilitiesProfile } from '../../src/domain/capabilities';
import { decodeToySamples, evaluateSymbolAnswer } from '../../src/domain/packet-journey';
import type { ToySample, ToySymbolProfile } from '../../src/domain/packet-journey';
import type { DomainAction, WorldVersion } from '../../src/domain/types';

const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const q = (id: string) => `spec001:${id}`;
const world = await read<S.world>('content/spec001/world.json');
const sources = await read<{ profiles: { id: string; parameters: unknown }[] }>('content/spec001/sources.json');
const profiles = await read<S.collection>('content/spec001/profiles.json');
const objectives = await read<S.collection>('content/spec001/objectives.json');
const controls = await read<S.collection>('content/spec001/dialogue/equipment-actions.json');
const rooms = await Promise.all(['R09', 'R10'].map(id => read<S.room>(`content/spec001/rooms/${id}.json`)));
const documents = Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read<unknown>(path)])));
interface RepairCase { id: string; inputs: Record<string, unknown>; expected: { status: string; observation: Record<string, unknown> } }
const oracle = await read<{ cases: RepairCase[] }>('tests/fixtures/repair-routes.json');
const fixture = (id: string) => { const value = oracle.cases.find(c => c.id === id); if (!value) throw new Error(id); return value; };
const objective = (id: string) => {
  const value = objectives.records.find(r => r.id === q(id));
  if (value?.kind !== 'objective') throw new Error(id);
  return value;
};
const profile = <T>(id: string): T => profiles.records.find(p => p.id === q(id)) as T;

/** Authoring projection only: runtime world loading belongs to the route join. */
function projection() {
  const candidate = structuredClone(world), loaded = structuredClone(documents);
  const replaced = candidate.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || rooms.some(room => room.id === r.id) || r.path === 'content/spec001/dialogue/equipment-actions.json');
  candidate.documents = candidate.documents.filter(r => !replaced.includes(r));
  for (const { path } of replaced) delete loaded[path];
  for (const [path, collection] of [['content/spec001/profiles.json', profiles], ['content/spec001/objectives.json', objectives], ['content/spec001/dialogue/equipment-actions.json', controls]] as const) {
    loaded[path] = structuredClone(collection);
    for (const record of collection.records) candidate.documents.push({ id: record.id, kind: record.kind, path } as S.world['documents'][number]);
  }
  for (const room of rooms) {
    const path = `content/spec001/rooms/${room.id.slice(-3)}.json`;
    loaded[path] = structuredClone(room); candidate.documents.push({ id: room.id, kind: 'room', path });
  }
  return { world: candidate, sources, documents: loaded };
}
const prose = (room: S.room) => [room.description, room.ambience.text, ...room.hotspots.flatMap(h => [h.label, h.description, h.unsupportedVerbText]), ...room.evidence.map(e => e.text)].join('\n');
const version = { configurationRevision: 9, attemptId: 'equipment-authoring-check' } as WorldVersion;
const action = <T>(input: T): DomainAction<T> => ({ actionId: 'equipment-authoring-check', expectedVersion: version, input }) as DomainAction<T>;
const power = (fields: Record<string, unknown>) => evaluatePower({ kind: 'delivered-power', profile: profile<PowerProfile>('PROFILE-POWER'), budgetBoundary: 'delivered-after-losses', demandBoundary: 'delivered-after-losses', ...fields } as PowerChallenge, action<PowerInput>({ kind: 'check-allocation' }), version);

describe('T076 Shell Market and Clockworks authored contracts', () => {
  it.each(rooms)('$id passes the actual generated content schema', room => {
    expect(validateSchema(room), JSON.stringify(validateSchema.errors)).toBe(true);
  });
  it('joins both rooms and the accepted definitions through the real registry without changing the production world', () => {
    const before = structuredClone({ world, documents, sources });
    const result = validateContent(projection());
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) return;
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    for (const room of rooms) expect(result.registry?.record(room.id)).toEqual(room);
    expect({ world, documents, sources }).toEqual(before);
  });
  it('preserves registered characters, all twenty allocated prop identities, safe anchors and only the specified exits', () => {
    for (const room of rooms) {
      const meta = world.rooms.find(r => r.id === room.id)!;
      expect(room.characterIds).toEqual(meta.characterIds);
      expect(room.propInstances.filter(p => meta.propIds.includes(p.propId)).map(p => p.propId)).toEqual(meta.propIds);
      const shared = room.id.endsWith('R09') ? ['PR140', 'PR141', 'PR142', 'PR145'] : ['PR138'];
      expect(room.propInstances.filter(p => !meta.propIds.includes(p.propId)).map(p => p.propId)).toEqual(shared.map(q));
      expect(room.safePositions.map(p => p.id)).toEqual(meta.safePositionIds);
      expect(room.exits.map(e => e.toRoomId)).toEqual(world.walkEdges.flatMap(e => e.from === room.id ? [e.to] : e.to === room.id ? [e.from] : []));
      expect(room.hotspots.length).toBeGreaterThanOrEqual(12);
      for (const hotspot of room.hotspots) {
        expect(hotspot.description.length).toBeGreaterThan(80);
        expect(hotspot.unsupportedVerbText.length).toBeGreaterThan(40);
      }
      expect(room.mediaBindings?.filter(b => b.use === 'prop-placement').map(b => b.assetId))
        .toEqual(room.propInstances.map(p => p.assetId));
      expect(room.ambience.assetIds).toEqual([room.id.replace(':', ':ASSET-AMBIENCE-')]);
    }
  });
  it('exposes every accepted equipment/calibration alternative and preserves its canonical evidence exactly', () => {
    for (const [index, id] of ['O09', 'O10'].entries()) {
      const room = rooms[index]!, definition = objective(id);
      const exposed = room.hotspots.flatMap(h => h.actionIds);
      for (const alternative of definition.alternatives) {
        expect(exposed).toContain(alternative.id);
        expect(alternative.effects).toEqual([]);
        expect(alternative.abilityIds).toEqual([]);
        expect(alternative.condition).toEqual({ kind: 'objective-complete', objectiveId: q('O02') });
        for (const id of alternative.evidenceIds) {
          expect(room.evidence.find(e => e.id === id)).toEqual(definition.evidence.find(e => e.id === id));
          expect(room.hotspots.flatMap(h => h.evidenceIds)).toContain(id);
        }
      }
      expect(definition.requiresReflexTiming).toBe(false);
      expect(Object.keys(definition.hints)).toEqual(['method', 'workedStep', 'solution']);
      for (const hint of Object.values(definition.hints)) expect(hint.text.length).toBeGreaterThan(40);
    }
  });
  it('keeps profile reading and companion advice separate from proof and completion effects', () => {
    const reads = rooms.flatMap(r => r.hotspots.flatMap(h => h.actionIds)).filter(id => id.includes('-read-'));
    expect(reads.length).toBeGreaterThan(4);
    for (const id of reads) {
      const definition = controls.records.flatMap(r => r.kind === 'dialogue' ? r.nodes.flatMap(n => n.choices) : []).find(a => a.id === id)!;
      expect(definition.effects.every(effect => effect.kind === 'record-fact')).toBe(true);
      expect(definition.effects.some(effect => effect.kind === 'complete-objective')).toBe(false);
    }
    expect(prose(rooms[0]!)).toContain('button press');
    expect(prose(rooms[1]!)).toContain('pressed button alone');
  });
  it('authors every reversible control under the existing dialogue schema without any completion, item or recruitment award', () => {
    expect(validateSchema(controls), JSON.stringify(validateSchema.errors)).toBe(true);
    const exposed = rooms.flatMap(r => r.hotspots.flatMap(h => h.actionIds));
    for (const record of controls.records) {
      if (record.kind !== 'dialogue') throw new Error('Expected control dialogue');
      expect(record.skipPolicy).toBe('retain-required-evidence');
      expect(record.replayPolicy).toBe('no-duplicate-effects');
      for (const choice of record.nodes[0]!.choices) {
        expect(exposed).toContain(choice.id);
        expect(choice.effects.every(e => e.kind === 'set-flag' || e.kind === 'record-fact')).toBe(true);
      }
    }
    const answers = controls.records.find(r => r.id === q('DIALOGUE-clockwork-answers'));
    if (answers?.kind !== 'dialogue') throw new Error('Missing answer desk');
    expect(answers.nodes[0]!.choices).toHaveLength(16);
    const pairs = answers.nodes[0]!.choices.flatMap(c => c.effects).filter(e => e.kind === 'set-flag');
    for (const position of [0, 1, 2, 3]) expect(pairs.filter(e => e.flagId === q(`FLAG-clock-bits-${position}`)).map(e => e.value)).toEqual(['00', '01', '10', '11']);
    expect(pairs.some(e => e.value === '00101101')).toBe(false);
  });
  it('keeps the required ordinary kit available without a recruit, payment, side quest or consumable', () => {
    const items = documents['content/spec001/items-introduction.json'] as S.collection;
    const kit = items.records.find(r => r.id === q('ITEM-inspection-kit'));
    if (kit?.kind !== 'item') throw new Error('Missing ordinary kit');
    expect(kit.consumption).toBe('never');
    expect(kit.acquisition).toMatchObject({ roomId: q('R01'), condition: { kind: 'always' } });
    expect(kit.recovery.policy).toBe('not-consumed');
    expect(objective('O09').alternatives.every(a => a.itemIds.length === 1 && a.itemIds[0] === kit.id && a.abilityIds.length === 0)).toBe(true);
    expect(objective('O10').alternatives.every(a => a.itemIds.length === 0 && a.abilityIds.length === 0)).toBe(true);
    for (const room of rooms) expect(prose(room)).toMatch(/help is recorded separately/i);
  });
  it('makes technical boundaries, before/after comparison, fresh evidence and upper-layer limits readable in the room', () => {
    const market = prose(rooms[0]!), clock = prose(rooms[1]!);
    for (const text of ['form factor', 'PHY', 'medium', 'supported rate', 'host support', 'power method', 'per-port', 'after losses', '33 W', '23 W', '30 W', '7 W', '3 W', 'stale', 'captured']) expect(market).toContain(text);
    for (const text of ['0 is −3', '1 is +1', '2 is +3', '3 is −1', '00101101', 'not voltages', 'PAM4', 'NTP', 'IP or MAC address discovery', 'application login', 'opaque upper-interface frame', 'no countdown', 'stale', 'captured']) expect(clock).toContain(text);
    expect(clock).toContain('does not silently refresh');
    for (const room of rooms) expect(prose(room)).not.toMatch(/spec001:|\bR(?:09|10)\b|\bO(?:09|10)\b|configurationRevision|config revision|T076/);
  });
  it('does not introduce new source/profile quantities or invent numeric individual-port ratings', () => {
    const expected = {
      'PROFILE-POWER': { deliveredBudget: { value: 30, unit: 'W' }, inclusiveMaximum: true },
      'PROFILE-CAPABILITIES': { endpointA: [{ rate: { value: 1000, unit: 'Mb/s' }, duplex: 'full' }, { rate: { value: 100, unit: 'Mb/s' }, duplex: 'full' }], endpointB: [{ rate: { value: 100, unit: 'Mb/s' }, duplex: 'full' }, { rate: { value: 10, unit: 'Mb/s' }, duplex: 'half' }] },
      'PROFILE-SYMBOLS': { levels: [{ symbol: { value: -3, unit: 'toy-level' }, bits: '00' }, { symbol: { value: -1, unit: 'toy-level' }, bits: '01' }, { symbol: { value: 1, unit: 'toy-level' }, bits: '10' }, { symbol: { value: 3, unit: 'toy-level' }, bits: '11' }], bitsPerSymbol: 2 },
    };
    for (const [id, parameters] of Object.entries(expected)) {
      expect(profile<S.profile>(id).parameters).toEqual(parameters);
      expect(sources.profiles.find(p => p.id === q(id))?.parameters).toEqual(parameters);
    }
    expect(prose(rooms[0]!)).toContain('does not invent numeric port ratings');
  });
  it.each([
    ['unknown action', 'unknown-reference', (r: S.room) => { r.hotspots[0]!.actionIds = [q('ACTION-invented')]; }],
    ['missing exit', 'room-exit', (r: S.room) => { r.exits = []; }],
    ['unsafe anchor', 'safe-geometry', (r: S.room) => { r.safePositions[0]!.point.x = 200; }],
    ['contradictory canonical evidence', 'duplicate-id', (r: S.room) => { r.evidence[0]!.text = 'Shell shape proves every equipment constraint.'; }],
  ] as const)('rejects %s in the actual content validator', (_name, code, change) => {
    const input = projection(), room = input.documents['content/spec001/rooms/R09.json'] as S.room;
    change(room);
    // Empty exits first fail schema; semantic mutations retain their own diagnostics.
    const result = validateContent(input);
    expect(result.ok).toBe(false);
    expect(result.issues.some(issue => issue.code === code || (_name === 'missing exit' && issue.code === 'schema'))).toBe(true);
  });
});

describe('T076 authored examples against existing independent domain mechanisms', () => {
  it('retains the 33 W failure beside both equally valid 23 W and inclusive 30 W alternatives', () => {
    const entry = fixture('RR-O09-ALTERNATIVES');
    const before = structuredClone(entry);
    const initial = power({ demands: [12, 11, 10].map(value => ({ value, unit: 'W' })), otherConstraints: true });
    expect(initial.status).toBe('incorrect');
    expect(initial.observations).toMatchObject([{ total: { value: 33, unit: 'W' }, excess: { value: 3, unit: 'W' }, wholeRouteProven: false }]);
    for (const [i, candidate] of (entry.inputs['candidates'] as Record<string, unknown>[]).entries()) {
      const { id, ...fields } = candidate;
      expect(objective('O09').alternatives.map(a => a.id)).toContain(q(`ACTION-O09-${String(id)}`));
      const after = power(fields);
      expect(after.status).toBe(entry.expected.status);
      expect(after.observations).toMatchObject([{ total: (entry.expected.observation['totalDemand'] as unknown[])[i], headroom: (entry.expected.observation['headroom'] as unknown[])[i], wholeRouteProven: false }]);
      expect(after.acceptedEffects).toEqual([]);
    }
    expect(entry).toEqual(before);
  });
  it.each(['RR-O09-FORM-FACTOR-ONLY', 'RR-O09-PER-PORT'])('%s stays failed despite aggregate headroom', id => {
    const entry = fixture(id), fields = structuredClone(entry.inputs);
    if ('sameFormFactor' in fields) { fields['formFactorMatch'] = fields['sameFormFactor']; delete fields['sameFormFactor']; }
    const result = power(fields);
    expect(result.status).toBe(entry.expected.status);
    expect(result.reasonCode).toBe(entry.expected.observation['reason']);
    expect(result.acceptedEffects).toEqual([]);
  });
  it('selects only actual common 100/full support from the unchanged reviewed lists', () => {
    const challenge: CapabilitiesChallenge = { kind: 'common-capabilities', profile: profile<CapabilitiesProfile>('PROFILE-CAPABILITIES'), bothNegotiate: true };
    for (const [rate, duplex, status] of [[100, 'full', 'correct'], [1000, 'full', 'incorrect'], [10, 'half', 'incorrect']] as const) {
      const result = evaluateCapabilities(challenge, action<CapabilitiesInput>({ kind: 'select-capability', selected: { rate: { value: rate, unit: 'Mb/s' }, duplex } }), version);
      expect(result.status).toBe(status);
      expect(result.observations).toMatchObject([{ common: [{ rate: { value: 100, unit: 'Mbps' }, duplex: 'full' }], wholeRouteProven: false }]);
      expect(result.acceptedEffects).toEqual([]);
    }
  });
  it('reuses the existing decoder for both untimed methods rather than inferring progress from replay', () => {
    const entry = fixture('RR-O10-ALTERNATIVES'), before = structuredClone(entry);
    const samples = (entry.inputs['symbols'] as Omit<ToySample, 'position'>[]).map((symbol, i) => ({ ...symbol, position: (entry.inputs['samplePositions'] as number[])[i]! }));
    const symbols = profile<ToySymbolProfile>('PROFILE-SYMBOLS');
    const trace = decodeToySamples(symbols, samples);
    expect(trace.status).toBe('correct');
    expect(trace.observations).toMatchObject([{ bits: '00101101', representedBits: 8, symbols: 4, progressAward: 0 }]);
    for (const candidate of entry.inputs['candidates'] as { id: string; bits: string }[]) {
      expect(objective('O10').alternatives.map(a => a.id)).toContain(q(`ACTION-O10-${candidate.id}`));
      const result = evaluateSymbolAnswer({ profile: symbols, samples }, action({ bits: candidate.bits }), version);
      expect(result.status).toBe(entry.expected.status);
      expect(result.acceptedEffects).toEqual([]);
    }
    expect(evaluateSymbolAnswer({ profile: symbols, samples }, action({ bits: '0100111001010001' }), version).status).toBe('incorrect');
    expect(evaluateSymbolAnswer({ profile: symbols, samples: [{ value: -3, unit: 'toy-level', position: 1 }] }, action({ bits: '00' }), version).status).toBe('content-error');
    expect(entry).toEqual(before);
  });
});
