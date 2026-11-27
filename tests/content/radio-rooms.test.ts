// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { validateContent } from '../../src/content/registry';
import validateSchema from '../../src/content/schema.generated.js';
import type * as S from '../../src/content/schema-types.generated';
import { authoredInput, routeDocument } from '../ui/inventory-fixture';
const q = (id: string) => `spec001:${id}`;
const read = async <T>(path: string): Promise<T> => JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as T;
const profiles = await read<S.collection>('content/spec001/profiles.json');
const objectives = await read<S.collection>('content/spec001/objectives.json');
const actions = await read<S.collection>('content/spec001/dialogue/radio-actions.json').catch(() => null);
const voices = await read<S.collection>('content/spec001/dialogue/radio-voices.json');
const rooms = await Promise.all(['R07', 'R08'].map(id => read<S.room>(`content/spec001/rooms/${id}.json`).catch(() => null)));
function room(id: string): S.room { const r = rooms.find(r => r?.id === q(id)); if (!r) throw new Error(`Missing radio room ${id}`); return r; }
function objective(id: string): S.objective { const o = objectives.records.find(r => r.id === q(id)); if (o?.kind !== 'objective') throw new Error(id); return o; }
function projection() {
  const input = structuredClone(authoredInput);
  const replaced = input.world.documents.filter(r => r.kind === 'profile' || r.kind === 'objective' || ['spec001:R07', 'spec001:R08'].includes(r.id) || r.path === 'content/spec001/dialogue/radio-actions.json');
  input.world.documents = input.world.documents.filter(r => !replaced.includes(r));
  for (const { path } of replaced) delete input.documents[path];
  if (!actions) throw new Error('Missing radio actions');
  for (const [path, value] of [['content/spec001/profiles.json', profiles], ['content/spec001/objectives.json', objectives], ['content/spec001/dialogue/radio-actions.json', actions], ['content/spec001/dialogue/radio-voices.json', voices],
    ['content/spec001/rooms/R07.json', room('R07')], ['content/spec001/rooms/R08.json', room('R08')]] as const) {
    input.documents[path] = structuredClone(routeDocument(value));
    input.world.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path })));
  }
  return input;
}
describe('T080 radio room content contracts', () => {
  it.each(['R07', 'R08'])('%s validates the real schema', id => expect(validateSchema(room(id)), JSON.stringify(validateSchema.errors)).toBe(true));
  it('joins the semantic registry and leaves all three route proofs intact', () => {
    const input = projection(), copy = structuredClone(input), result = validateContent(input);
    expect(result.ok, JSON.stringify(result.issues)).toBe(true); if (!result.ok) throw new Error('Invalid registry'); expect(result.routes).toEqual(['copper', 'fiber', 'radio']); expect(input).toEqual(copy);
  });
  it.each([['R07', 'O07'], ['R08', 'O08']])('%s exposes the exact reviewed %s evidence and alternatives', (rid, oid) => {
    const r = room(rid!), o = objective(oid!);
    expect(r.evidence).toEqual(o.evidence);
    for (const f of o.evidence) expect(r.hotspots.some(h => h.verbs.includes('look') && h.evidenceIds.includes(f.id))).toBe(true);
    const exposed = r.hotspots.flatMap(h => h.actionIds);
    for (const a of o.alternatives) {
      expect(exposed).toContain(a.id); expect(a.itemIds).toEqual([q('ITEM-inspection-kit')]); expect(a.abilityIds).toEqual([]); expect(a.effects).toEqual([]);
    }
  });
  it.each(['R07', 'R08'])('%s makes every allocated prop and character inspectable, with registered visual media and the mounted shared prop', id => {
    const r = room(id), meta = authoredInput.world.rooms.find(r => r.id === q(id))!;
    expect(r.characterIds).toEqual(meta.characterIds); expect(r.propInstances.map(p => p.propId)).toEqual([...meta.propIds, q(id === 'R07' ? 'PR137' : 'PR124')]);
    for (const subject of [...meta.characterIds, ...meta.propIds]) expect(r.hotspots.some(h => h.subjectId === subject && h.verbs.includes('look')), subject).toBe(true);
    expect(r.safePositions.map(p => p.id)).toEqual(meta.safePositionIds); expect(r.ambience.assetIds).toEqual([q('ASSET-AMBIENCE-'+id)]);
    expect(r.mediaBindings?.filter(b => b.use === 'ambience').map(b => b.assetId)).toEqual(r.ambience.assetIds);
    for (const p of r.propInstances) {
      expect(p.assetId).toBe(p.propId.replace(':', ':ASSET-'));
      expect(r.mediaBindings?.some(b => b.assetId === p.assetId && b.use === 'prop-placement' && b.contentId === r.id)).toBe(true);
    }
    expect(r.futureDoorIds).toEqual([]);
  });
  it('retains exact bidirectional branch exits and no invented market shortcut', () => {
    expect(room('R07').exits.map(e => e.toRoomId)).toEqual(['R02', 'R08'].map(q));
    expect(room('R08').exits.map(e => e.toRoomId)).toEqual(['R07', 'R11'].map(q));
  });
  it('exposes only factual context and reversible choices; no fake Talk, recruitment or optional activity handlers', () => {
    expect(actions).not.toBeNull(); expect(validateSchema(actions), JSON.stringify(validateSchema.errors)).toBe(true);
    const exposed = rooms.flatMap(r => r!.hotspots.flatMap(h => h.actionIds));
    for (const record of actions!.records) {
      if (record.kind !== 'dialogue') throw new Error('Expected dialogue');
      expect(record.nodes).toHaveLength(1); expect(record.nodes[0]!.effects).toEqual([]);
      for (const c of record.nodes[0]!.choices) {
        if (c.effects.length) expect(exposed).toContain(c.id);
        expect(c.nextNodeId).toBeNull();
        for (const e of c.effects) { expect(['set-flag', 'record-fact']).toContain(e.kind);
          if (e.kind === 'record-fact') expect(['FACT-O07-path', 'FACT-O07-settings', 'FACT-O08-survey'].map(q)).toContain(e.factId);
        }
      }
    }
    for (const r of rooms) for (const h of r!.hotspots) {
      expect(h.verbs).not.toContain('talk'); if (h.actionIds.length) expect(h.verbs).toContain('use');
      expect(h.description.length).toBeGreaterThan(40); expect(h.unsupportedVerbText.length).toBeGreaterThan(40);
      expect(h.actionIds.join(' ')).not.toMatch(/SQ03|MG03|recruit/);
    }
  });
  it('explains scoped thresholds, changing observations, ordinary tools and measurement boundaries in visible text', () => {
    const all = rooms.map(r => JSON.stringify(r)).join(' ');
    for (const phrase of ['fictional', '20 dB', '25 dB', '13 dB', '19.99 dB', '−65 dBm', '−90 dBm', '−85 dBm', '−78 dBm', '−84.99 dBm', 'measure again', 'throughput', 'service', 'Arrival Lift', 'never consumed']) expect(all).toContain(phrase);
    expect(all).toContain('supplied boundary exercise');
    for (const r of rooms) for (const h of r!.hotspots) expect(h.description).not.toMatch(/spec001:|configurationRevision|attemptId|\bcontroller\b/);
  });
  it('keeps the ordinary kit always obtainable without consuming it', () => {
    const items = authoredInput.documents['content/spec001/items-introduction.json'] as S.collection;
    const kit = items.records.find(i => i.id === q('ITEM-inspection-kit')) as S.item;
    expect(kit.acquisition.condition).toEqual({ kind: 'always' }); expect(kit.acquisition.roomId).toBe(q('R01')); expect(kit.consumption).toBe('never');
  });
  it.each(['unknown-action', 'contradictory-evidence', 'bad-exit', 'bad-anchor'] as const)('rejects %s through actual semantic validation', mode => {
    const input = projection(), r = input.documents['content/spec001/rooms/R07.json'] as S.room;
    if (mode === 'unknown-action') r.hotspots[0]!.actionIds = [q('ACTION-unsupported')];
    if (mode === 'contradictory-evidence') r.evidence[0]!.text = 'Signal guarantees throughput.';
    if (mode === 'bad-exit') r.exits.pop();
    if (mode === 'bad-anchor') r.safePositions[0]!.point = { x: 1000, y: 1000 };
    expect(validateContent(input).ok).toBe(false);
  });
});
