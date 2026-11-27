// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import validateSchema from '../../src/content/schema.generated.js';
import { validateContent } from '../../src/content/registry';
import type * as S from '../../src/content/schema-types.generated';
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const q = (id: string) => `spec001:${id}`;
const world = await read<S.world>('content/spec001/world.json');
const objectives = await read<S.collection>('content/spec001/objectives.json');
const rooms = await Promise.all(['R11', 'R12'].map(id => read<S.room>(`content/spec001/rooms/${id}.json`).catch(() => null)));
const actions = await read<S.collection>('content/spec001/dialogue/repair-plan-actions.json').catch(() => null);
const room = (id: string) => { const value = rooms.find(r => r?.id === q(id)); if (!value) throw new Error(`Missing ${id}`); return value; };
const objective = (id: string) => objectives.records.find(r => r.kind === 'objective' && r.id === q(id)) as S.objective;

describe('T077 authored Rift and Threshold contract', () => {
  it.each(['R11', 'R12'])('%s conforms and preserves reviewed objective evidence', id => {
    const value = room(id); expect(validateSchema(value), JSON.stringify(validateSchema.errors)).toBe(true);
    expect(value.evidence.slice(0, objective(id.replace('R', 'O')).evidence.length)).toEqual(objective(id.replace('R', 'O')).evidence);
    const exposed = new Set(value.hotspots.flatMap(h => h.evidenceIds));
    for (const evidence of value.evidence) expect(exposed.has(evidence.id), evidence.id).toBe(true);
  });
  it('joins actual schema and semantic registry without changing the runtime world', async () => {
    const candidate = structuredClone(world), documents: Record<string, unknown> = {};
    const paths = ['content/spec001/profiles.json', 'content/spec001/objectives.json', 'content/spec001/dialogue/repair-plan-actions.json', 'content/spec001/rooms/R11.json', 'content/spec001/rooms/R12.json'];
    candidate.documents = candidate.documents.filter(r => r.kind !== 'profile' && r.kind !== 'objective' && !paths.includes(r.path));
    for (const path of new Set(candidate.documents.map(d => d.path))) documents[path] = await read(path);
    for (const path of paths) { const value = await read<S.collection | S.room>(path); documents[path] = value;
      candidate.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path }))); }
    const result = validateContent({ world: candidate, documents, sources: await read('content/spec001/sources.json') });
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
  });
  it('keeps all branch choices, safe return exits and ordinary tools', () => {
    for (const id of ['R11', 'R12']) {
      const value = room(id), metadata = world.rooms.find(r => r.id === value.id)!;
      expect(value.characterIds).toEqual(metadata.characterIds); expect(value.propInstances.map(p => p.propId)).toEqual(metadata.propIds);
      expect(value.safePositions.map(p => p.id)).toEqual(metadata.safePositionIds);
      for (const alternative of objective(id.replace('R', 'O')).alternatives)
        expect(value.hotspots.some(h => h.actionIds.includes(alternative.id) && h.verbs.includes('use'))).toBe(true);
    }
    expect(room('R11').exits.map(e => e.toRoomId)).toEqual(['R04', 'R06', 'R08', 'R10', 'R12'].map(q));
    expect(room('R12').exits.map(e => e.toRoomId)).toEqual([q('R11')]);
    expect(actions).not.toBeNull(); expect(validateSchema(actions), JSON.stringify(validateSchema.errors)).toBe(true);
  });
  it('states fresh separate endpoint evidence, temporary limitations and unresolved isolation in text', () => {
    const text = JSON.stringify(rooms);
    for (const term of ['endpoint', 'temporary', 'follow-up', 'isolation', 'warning', 'measure again', 'opaque', '105 m', '100 m']) expect(text).toContain(term);
    for (const value of rooms) {
      expect(value?.mediaBindings).toBeUndefined(); expect(value?.ambience.assetIds).toEqual([]);
      expect(value?.hotspots.every(h => h.label && h.description.length > 40 && h.unsupportedVerbText.length > 40)).toBe(true);
    }
  });
});
