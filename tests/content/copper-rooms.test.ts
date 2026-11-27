// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import validateSchema from '../../src/content/schema.generated.js';
import type * as S from '../../src/content/schema-types.generated';

const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const world = await read<S.world>('content/spec001/world.json');
const sources = await read<unknown>('content/spec001/sources.json');
const profiles = await read<S.collection>('content/spec001/profiles.json');
const objectives = await read<S.collection>('content/spec001/objectives.json');
const actions = await read<S.collection>('content/spec001/dialogue/copper-actions.json');
const currentDocuments = Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read<unknown>(path)])));
const q = (id: string) => `spec001:${id}`;
const roomPath = (id: string) => `content/spec001/rooms/${id}.json`;
const rooms = await Promise.all(['R03', 'R04'].map(async id => read<S.room>(roomPath(id)).catch(() => null)));
function room(id: string): S.room {
  const found = rooms.find(r => r?.id === q(id));
  if (!found) throw new Error(`Missing authored copper room ${id}`);
  return found;
}
function objective(id: string): S.objective {
  const found = objectives.records.find(r => r.kind === 'objective' && r.id === q(id));
  if (found?.kind !== 'objective') throw new Error(`Missing accepted objective ${id}`);
  return found;
}

/** Authoring-only selection through the real registry. No runtime/world edit. */
function projection() {
  const candidate = structuredClone(world);
  const documents = structuredClone(currentDocuments);
  const replaced = candidate.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || ['spec001:R03', 'spec001:R04'].includes(r.id) || r.path === 'content/spec001/dialogue/copper-actions.json');
  candidate.documents = candidate.documents.filter(r => !replaced.includes(r));
  for (const { path } of replaced) delete documents[path];
  for (const [path, collection] of [['content/spec001/profiles.json', profiles], ['content/spec001/objectives.json', objectives], ['content/spec001/dialogue/copper-actions.json', actions]] as const) {
    documents[path] = structuredClone(collection);
    for (const record of collection.records) candidate.documents.push({ kind: record.kind, id: record.id, path } as S.world['documents'][number]);
  }
  for (const id of ['R03', 'R04']) {
    const value = room(id), path = roomPath(id);
    documents[path] = structuredClone(value);
    candidate.documents.push({ kind: 'room', id: value.id, path });
  }
  return { world: candidate, sources, documents };
}

describe('T075 Copper Warrens and Echo Cavern authored room contract', () => {
  it.each(['R03', 'R04'])('%s conforms to the actual room schema', id => {
    expect(validateSchema(room(id)), JSON.stringify(validateSchema.errors)).toBe(true);
  });
  it('joins both rooms with the accepted complete definitions through the semantic registry', () => {
    const input = projection(), before = structuredClone(input);
    const result = validateContent(input);
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) return;
    expect(result.registry?.record(q('R03'))).toEqual(room('R03'));
    expect(result.registry?.record(q('R04'))).toEqual(room('R04'));
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    expect(input).toEqual(before);
  });
  it.each([['R03', 'O03'], ['R04', 'O04']])('%s retains the exact accepted %s evidence and exposes every required fact', (roomId, objectiveId) => {
    const value = room(roomId!), accepted = objective(objectiveId!);
    expect(value.evidence).toEqual(accepted.evidence);
    const exposed = new Set(value.hotspots.flatMap(h => h.evidenceIds));
    for (const fact of accepted.evidence) expect(exposed.has(fact.id), fact.id).toBe(true);
    expect(value.hotspots.filter(h => h.evidenceIds.length).every(h => h.verbs.includes('look'))).toBe(true);
  });
  it('exposes both conventional alternatives equally and only the accepted proof action', () => {
    expect([...new Set(room('R03').hotspots.flatMap(h => h.actionIds))].filter(id => id.startsWith('spec001:ACTION-O03-')).sort()).toEqual([
      q('ACTION-O03-alternate-passive-path'), q('ACTION-O03-section-replacement'),
    ]);
    expect([...new Set(room('R04').hotspots.flatMap(h => h.actionIds))].filter(id => id.startsWith('spec001:ACTION-O04-'))).toEqual([q('ACTION-O04-conventional-continuity-tool')]);
    for (const id of ['R03', 'R04']) for (const hotspot of room(id).hotspots.filter(h => h.actionIds.length)) expect(hotspot.verbs).toContain('use');
    for (const id of ['O03', 'O04']) for (const alternative of objective(id).alternatives) {
      expect(alternative.itemIds).toEqual([q('ITEM-inspection-kit')]);
      expect(alternative.abilityIds).toEqual([]);
      expect(alternative.effects).toEqual([]);
    }
  });
  it('authors only reversible bench/proposal choices and context observations in the separate action collection', () => {
    expect(validateSchema(actions), JSON.stringify(validateSchema.errors)).toBe(true);
    const exposed = new Set(rooms.flatMap(r => r!.hotspots.flatMap(h => h.actionIds)));
    const flags = new Map<string, Set<string>>();
    for (const record of actions.records) {
      if (record.kind !== 'dialogue') throw new Error('Expected copper dialogue');
      expect(record.nodes).toHaveLength(1);
      expect(record.nodes[0]!.effects).toEqual([]);
      for (const choice of record.nodes[0]!.choices) {
        if (choice.effects.length) expect(exposed.has(choice.id), choice.id).toBe(true);
        expect(choice.nextNodeId).toBeNull();
        for (const effect of choice.effects) {
          expect(['set-flag', 'record-fact']).toContain(effect.kind);
          if (effect.kind === 'set-flag') {
            const values = flags.get(effect.flagId) ?? new Set<string>(); values.add(String(effect.value)); flags.set(effect.flagId, values);
          } else if (effect.kind === 'record-fact') expect(['FACT-O03-compatibility', 'FACT-O03-defect', 'FACT-O04-before', 'FACT-O04-repeater-limit'].map(q)).toContain(effect.factId);
        }
      }
    }
    expect([...flags.get(q('FLAG-copper-path'))!].sort()).toEqual(['alternate-passive-path', 'original-broken', 'section-replacement']);
    expect([...flags.get(q('FLAG-copper-repeater-claim'))!].sort()).toEqual(['bridges-open', 'requires-continuity']);
  });
  it('retains an always obtainable, never consumed ordinary inspection kit', () => {
    const collection = currentDocuments['content/spec001/items-introduction.json'] as S.collection;
    const kit = collection.records.find(r => r.id === q('ITEM-inspection-kit'));
    expect(kit?.kind).toBe('item');
    if (kit?.kind !== 'item') return;
    expect(kit.acquisition.condition).toEqual({ kind: 'always' });
    expect(kit.acquisition.roomId).toBe(q('R01'));
    expect(kit.consumption).toBe('never');
    expect(kit.recovery.policy).toBe('not-consumed');
    expect(kit.description).toContain('cannot certify cabling, repair a broken conductor');
  });
  it('retains the original break, 95 m repair, inclusive 100 m alternative and scoped proof in visible prose', () => {
    const warrens = room('R03').hotspots.map(h => `${h.description} ${h.unsupportedVerbText}`).join(' ');
    const cavern = room('R04').hotspots.map(h => `${h.description} ${h.unsupportedVerbText}`).join(' ');
    for (const phrase of ['95 m + 10 m', '105 m', '85 m + 10 m', '90 m + 10 m', '100 m', 'required conductor', 'fictional']) expect(warrens).toContain(phrase);
    for (const phrase of ['before', 'after', 'repeater', 'severed', 'service', 'measure again']) expect(cavern).toContain(phrase);
    expect(room('R04').evidence.find(e => e.id === q('FACT-O04-before'))?.requiresFreshMeasurement).toBe(false);
    expect(room('R04').evidence.find(e => e.id === q('FACT-O04-after'))?.requiresFreshMeasurement).toBe(true);
  });
  it('keeps ordinary return exits and the registered character/prop allocations', () => {
    expect(room('R03').exits.map(e => e.toRoomId)).toEqual([q('R02'), q('R04')]);
    expect(room('R04').exits.map(e => e.toRoomId)).toEqual([q('R03'), q('R11')]);
    for (const id of ['R03', 'R04']) {
      const value = room(id), metadata = world.rooms.find(r => r.id === value.id)!;
      expect(value.characterIds).toEqual(metadata.characterIds);
      expect(value.propInstances.map(p => p.propId)).toEqual(metadata.propIds);
      expect(value.safePositions.map(p => p.id)).toEqual(metadata.safePositionIds);
      expect(value.futureDoorIds).toEqual([]);
    }
  });
  it('provides text and useful fallback for every hotspot without exposing internal identifiers', () => {
    for (const id of ['R03', 'R04']) {
      const value = room(id);
      const prose = [value.description, value.ambience.text, ...value.exits.map(e => e.label), ...value.hotspots.flatMap(h => [h.label, h.description, h.unsupportedVerbText]), ...value.evidence.map(e => e.text)].join('\n');
      expect(prose).not.toMatch(/spec001:|\b(?:O0[34]|R0[34]|PR0\d\d|CH\d\d|configurationRevision|attemptId|DEV-|controller|schema)\b/);
      for (const h of value.hotspots) {
        expect(h.label.trim().length).toBeGreaterThan(0);
        expect(h.description.trim().length).toBeGreaterThan(40);
        expect(h.unsupportedVerbText.trim().length).toBeGreaterThan(40);
        // Dialogue bindings are not authored here: no inert Talk affordance.
        expect(h.verbs).not.toContain('talk');
      }
    }
  });
  it('makes no finished media, audio, recruitment or direct completion claim', () => {
    for (const id of ['R03', 'R04']) {
      const value = room(id);
      expect(value.mediaBindings).toBeUndefined();
      expect(value.ambience.assetIds).toEqual([]);
      expect(value.propInstances.every(p => p.assetId.startsWith('spec001:DEV-'))).toBe(true);
      expect(JSON.stringify(value)).not.toMatch(/"(?:effects|acceptedEffects|recruitment)"|"complete-objective"|"grant-item"/);
    }
    expect(room('R04').presentationMode).toBe('rendered-room');
  });
  it.each(['missing-action', 'contradictory-fact', 'wrong-exit', 'outside-anchor'] as const)('rejects %s authoring through the real registry', mutation => {
    const input = projection();
    const candidate = input.documents[roomPath('R03')] as S.room;
    let expected = '';
    if (mutation === 'missing-action') { candidate.hotspots[0]!.actionIds = [q('ACTION-unreviewed-repair')]; expected = 'unknown-reference'; }
    if (mutation === 'contradictory-fact') { candidate.evidence[0]!.text = 'Every connector that fits guarantees service.'; expected = 'duplicate-id'; }
    if (mutation === 'wrong-exit') { candidate.exits.pop(); expected = 'room-exit'; }
    if (mutation === 'outside-anchor') { candidate.safePositions[0]!.point = { x: 1000, y: 1000 }; expected = 'safe-geometry'; }
    const result = validateContent(input);
    expect(result.ok).toBe(false);
    expect(result.issues.some(issue => issue.code === expected), JSON.stringify(result.issues)).toBe(true);
  });
});
