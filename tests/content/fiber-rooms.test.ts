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
const actions = await read<S.collection>('content/spec001/dialogue/fiber-actions.json');
const currentDocuments = Object.fromEntries(await Promise.all([...new Set(world.documents.map(d => d.path))].map(async path => [path, await read<unknown>(path)])));
const q = (id: string) => `spec001:${id}`;
const roomPath = (id: string) => `content/spec001/rooms/${id}.json`;
const rooms = await Promise.all(['R05', 'R06'].map(async id => read<S.room>(roomPath(id)).catch(() => null)));
function room(id: string): S.room {
  const found = rooms.find(r => r?.id === q(id));
  if (!found) throw new Error(`Missing authored fiber room ${id}`);
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
  const replaced = candidate.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || ['spec001:R05', 'spec001:R06'].includes(r.id) || r.path === 'content/spec001/dialogue/fiber-actions.json');
  candidate.documents = candidate.documents.filter(r => !replaced.includes(r));
  for (const { path } of replaced) delete documents[path];
  for (const [path, collection] of [['content/spec001/profiles.json', profiles], ['content/spec001/objectives.json', objectives], ['content/spec001/dialogue/fiber-actions.json', actions]] as const) {
    documents[path] = structuredClone(collection);
    for (const record of collection.records) candidate.documents.push({ kind: record.kind, id: record.id, path } as S.world['documents'][number]);
  }
  for (const id of ['R05', 'R06']) {
    const value = room(id), path = roomPath(id);
    documents[path] = structuredClone(value);
    candidate.documents.push({ kind: 'room', id: value.id, path });
  }
  return { world: candidate, sources, documents };
}

describe('T079 Photon Gardens and Prism Vault authored contracts', () => {
  it.each(['R05', 'R06'])('%s follows the actual room schema', id => {
    expect(validateSchema(room(id)), JSON.stringify(validateSchema.errors)).toBe(true);
  });
  it('joins independent fiber rooms through the semantic registry without changing shared content', () => {
    const input = projection(), before = structuredClone(input), result = validateContent(input);
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) throw new Error('Invalid content projection');
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    expect(input).toEqual(before);
  });
  it.each([['R05', 'O05'], ['R06', 'O06']])('%s copies exact reviewed %s evidence and exposes it', (roomId, objectiveId) => {
    const value = room(roomId!), accepted = objective(objectiveId!);
    expect(value.evidence).toEqual(accepted.evidence);
    for (const fact of accepted.evidence) expect(value.hotspots.some(h => h.evidenceIds.includes(fact.id) && h.verbs.includes('look'))).toBe(true);
    expect([...new Set(value.hotspots.flatMap(h => h.actionIds))].filter(id => id.startsWith(q(`ACTION-${objectiveId}-`))).sort())
      .toEqual(accepted.alternatives.map(a => a.id).sort());
    for (const alternative of accepted.alternatives) {
      expect(alternative.itemIds).toEqual([q('ITEM-inspection-kit')]);
      expect(alternative.abilityIds).toEqual([]); expect(alternative.effects).toEqual([]);
    }
  });
  it('has only closed reversible configuration and context/inspection effects, never awards or fake measurements', () => {
    expect(validateSchema(actions), JSON.stringify(validateSchema.errors)).toBe(true);
    const exposed = new Set(rooms.flatMap(r => r!.hotspots.flatMap(h => h.actionIds)));
    const flags = new Map<string, Set<string>>();
    for (const record of actions.records) {
      if (record.kind !== 'dialogue') throw new Error('Expected fiber action collection');
      expect(record.nodes).toHaveLength(1);
      expect(record.nodes[0]!.effects).toEqual([]);
      for (const choice of record.nodes[0]!.choices) {
        expect(choice.nextNodeId).toBeNull();
        if (choice.effects.length) expect(exposed.has(choice.id), choice.id).toBe(true);
        for (const effect of choice.effects) {
          expect(['set-flag', 'record-fact']).toContain(effect.kind);
          if (effect.kind === 'set-flag') {
            const values = flags.get(effect.flagId) ?? new Set<string>(); values.add(String(effect.value)); flags.set(effect.flagId, values);
          } else if (effect.kind === 'record-fact') expect(['FACT-O05-matching', 'FACT-O05-inspection', 'FACT-O06-compatibility'].map(q)).toContain(effect.factId);
        }
      }
    }
    expect([...flags.get(q('FLAG-fiber-connection'))!].sort()).toEqual(['original', 'inspected', 'cleaned', 'replaced', 'verified-cleaned', 'verified-replaced'].sort());
    expect([...flags.get(q('FLAG-fiber-profiles'))!].sort()).toEqual(['matched', 'wrong-fiber', 'wrong-wavelength', 'wrong-rate', 'wrong-polarity', 'unsupported-host'].sort());
    expect([...flags.get(q('FLAG-fiber-path'))!].sort()).toEqual(['passive-path-A', 'passive-path-B', 'high-loss'].sort());
  });
  it('states the numeric model, inspection order and independent overload exhibit honestly', () => {
    const garden = JSON.stringify(room('R05')), vault = JSON.stringify(room('R06'));
    for (const phrase of ['inspect', 'before', 'reinspect', 'wavelength', 'polarity', 'host', 'propagation', 'tool']) expect(garden).toContain(phrase);
    for (const phrase of ['−3 dBm', '−14 dBm', '−1 dBm', '8 dB', '9 dB', '10 dB', '−11 dBm', '−12 dBm', '−13 dBm', '2 dB', '0 dBm', 'independent', 'fictional', 'measure again', 'service']) expect(vault).toContain(phrase);
    expect(vault).toContain('not produced by the passive');
  });
  it('keeps every allocated prop and character inspectable and all registered edges/anchors intact', () => {
    expect(room('R05').exits.map(e => e.toRoomId)).toEqual([q('R02'), q('R06')]);
    expect(room('R06').exits.map(e => e.toRoomId)).toEqual([q('R05'), q('R11')]);
    for (const id of ['R05', 'R06']) {
      const value = room(id), metadata = world.rooms.find(r => r.id === value.id)!;
      expect(value.characterIds).toEqual(metadata.characterIds);
      const mountedTools = id === 'R05' ? ['PR126', 'PR127', 'PR149'] : ['PR123'];
      expect(value.propInstances.map(p => p.propId)).toEqual([...metadata.propIds, ...mountedTools.map(q)]);
      expect(value.safePositions.map(p => p.id)).toEqual(metadata.safePositionIds);
      for (const subject of [...metadata.propIds, ...metadata.characterIds]) expect(value.hotspots.some(h => h.subjectId === subject && h.verbs.includes('look')), subject).toBe(true);
      expect(value.futureDoorIds).toEqual([]);
    }
  });
  it('retains the ordinary always obtainable never consumed inspection kit', () => {
    const collection = currentDocuments['content/spec001/items-introduction.json'] as S.collection;
    const kit = collection.records.find(r => r.id === q('ITEM-inspection-kit'));
    expect(kit?.kind).toBe('item'); if (kit?.kind !== 'item') return;
    expect(kit.acquisition.condition).toEqual({ kind: 'always' }); expect(kit.acquisition.roomId).toBe(q('R01'));
    expect(kit.consumption).toBe('never'); expect(kit.recovery.policy).toBe('not-consumed');
  });
  it('keeps readable optical evidence and registers exact native props, scenery and ambience', () => {
    for (const id of ['R05', 'R06']) {
      const value = room(id);
      const code = value.id.slice(8);
      expect(value.ambience.assetIds).toEqual([q('ASSET-AMBIENCE-' + code)]);
      for (const p of value.propInstances) expect(value.mediaBindings).toContainEqual(expect.objectContaining({
        assetId: p.assetId, contentId: value.id, use: 'prop-placement',
      }));
      for (const plane of ['background', 'midground', 'foreground']) expect(value.mediaBindings).toContainEqual(expect.objectContaining({
        contentId: value.id, use: plane, exportPath: 'public/assets/images/' + code + '/' + plane + '.webp',
      }));
      const prose = [value.description, value.ambience.text, ...value.exits.map(e => e.label), ...value.hotspots.flatMap(h => [h.label, h.description, h.unsupportedVerbText])].join('\n');
      expect(prose).not.toMatch(/spec001:|\b(?:O0[56]|R0[56]|PR0\d\d|CH\d\d|configurationRevision|attemptId|controller|schema)\b/);
      for (const h of value.hotspots) {
        expect(h.description.trim().length).toBeGreaterThan(40); expect(h.unsupportedVerbText.trim().length).toBeGreaterThan(40);
        expect(h.verbs).not.toContain('talk'); if (h.actionIds.length) expect(h.verbs).toContain('use');
      }
    }
    expect(room('R05').presentationMode).toBe('hybrid');
  });
  it.each(['unknown-action', 'contradictory-fact', 'wrong-exit', 'outside-anchor'] as const)('rejects %s rather than silently accepting corrupt authored content', mutation => {
    const input = projection(), value = input.documents[roomPath('R05')] as S.room;
    let code = '';
    if (mutation === 'unknown-action') { value.hotspots[0]!.actionIds = [q('ACTION-unreviewed-optic')]; code = 'unknown-reference'; }
    if (mutation === 'contradictory-fact') { value.evidence[0]!.text = 'A fitting shell guarantees compatibility.'; code = 'duplicate-id'; }
    if (mutation === 'wrong-exit') { value.exits.pop(); code = 'room-exit'; }
    if (mutation === 'outside-anchor') { value.safePositions[0]!.point = { x: 1000, y: 1000 }; code = 'safe-geometry'; }
    const result = validateContent(input); expect(result.ok).toBe(false);
    expect(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues)).toBe(true);
  });
});
