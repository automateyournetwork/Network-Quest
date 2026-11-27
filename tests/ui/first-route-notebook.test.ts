// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type * as S from '../../src/content/schema-types.generated';
import { validateContent } from '../../src/content/registry';
import { createNotebookController, validateNotebookPresentation } from '../../src/ui/notebook';
import type { Measurement } from '../../src/state/types';
import type { Metres } from '../../src/domain/types';
import metadata from '../../content/spec001/notebook-first-route.json';
import { authoredInput, routeDocument, q, setup } from './inventory-fixture';

const input = structuredClone(authoredInput);
const replaced = input.world.documents.filter(r => r.kind === 'objective' || r.kind === 'profile');
input.world.documents = input.world.documents.filter(r => !replaced.includes(r));
for (const { path } of replaced) delete input.documents[path];
// A room's caption binding resolves to a real line even in this route-only projection.
const episode = JSON.parse(await readFile(new URL('../../content/spec001/world.json', import.meta.url), 'utf8')) as S.world;
const captionFiles = new Set(episode.documents.filter(d => d.id.startsWith('spec001:DIALOGUE-media-') && !input.documents[d.path]).map(d => d.path));
for (const path of [...captionFiles, 'content/spec001/objectives.json', 'content/spec001/profiles.json', 'content/spec001/dialogue/copper-actions.json', 'content/spec001/dialogue/fiber-actions.json', 'content/spec001/dialogue/radio-actions.json', 'content/spec001/dialogue/equipment-actions.json', 'content/spec001/dialogue/repair-plan-actions.json', 'content/spec001/dialogue/packet-r12.json', ...['R03', 'R04', 'R05', 'R06', 'R07', 'R08', 'R09', 'R10', 'R11', 'R12'].map(id => `content/spec001/rooms/${id}.json`)]) {
  const value = JSON.parse(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')) as S.collection | S.room;
  input.documents[path] = routeDocument(value);
  input.world.documents.push(...(value.kind === 'collection' ? value.records : [value]).map(r => ({ kind: r.kind, id: r.id, path })));
}
const result = validateContent(input);
if (!result.ok || !result.registry) throw new Error(JSON.stringify(result.issues));
const registry = result.registry;
describe('T078 route notebook presentation over actual authored definitions', () => {
  it('accepts explicit display metadata but rejects unknown sources, ambiguous mappings and raw authority', () => {
    expect(validateNotebookPresentation(registry, metadata).objectives).toHaveLength(12);
    for (const change of [
      (copy: typeof metadata) => { copy.measurementGroups[0]!.subjectId = 'spec001:O99'; },
      (copy: typeof metadata) => { copy.measurementGroups[0]!.ruleId = 'spec001:UNKNOWN'; },
      (copy: typeof metadata) => { copy.measurementGroups.push(copy.measurementGroups[0]!); },
      (copy: typeof metadata) => { copy.measurementGroups[0]!.conclusions.push(copy.measurementGroups[0]!.conclusions[0]!); },
      (copy: typeof metadata) => { copy.measurementGroups[0]!.conclusions[0]!.explanation = ''; },
      (copy: typeof metadata) => { Object.assign(copy.measurementGroups[0]!, { effects: ['complete-objective'] }); },
    ]) { const copy = structuredClone(metadata); change(copy); expect(() => validateNotebookPresentation(registry, copy)).toThrow(); }
  });
  it('shows recorded route evidence in plain language with current/stale provenance, without creating progress', () => {
    const f = setup(), before = f.store.getState(), game = before.runtime.game!;
    const measurement: Measurement = { id: '00000000-0000-4000-8000-000000000078' as Measurement['id'], ruleId: q<'rule'>('PHY04'),
      roomId: q<'room'>('R03'), subjectIds: [q('O03'), q('PROFILE-COPPER-100')], configurationRevision: game.world.configurationRevision, attemptId: game.world.attemptId,
      stale: false, readings: [{ name: 'Total channel length', value: 95 as Metres, unit: 'm' }], conclusionCode: 'O03:ACTION-O03-section-replacement:correct' };
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, notebook: { ...game.notebook,
      mapRoomIds: [q<'room'>('R01'), q<'room'>('R03')], measurements: [measurement], factIds: [q<'fact'>('FACT-O03-compatibility')] } } } });
    const notebook = createNotebookController({ ...f, registry, presentation: metadata });
    const original = f.store.getState(), view = notebook.project().view;
    expect(f.store.getState()).toBe(original);
    expect(view.maps.map(room => room.label)).toEqual(['The Arrival Lift', 'The Copper Warrens']);
    expect(view.objectives.find(o => o.id === q('O03'))).toMatchObject({ label: 'Prepare copper in R03', completed: false });
    const reading = view.evidence.find(e => e.id === measurement.id)!;
    expect(reading).toMatchObject({ heading: 'Copper preparation reading', sourceRoom: 'The Copper Warrens', freshness: 'current' });
    expect(reading.text).toContain('Total channel length: 95 m');
    expect(reading.text).toContain('The supplied checks pass for this recorded configuration.');
    expect(reading.text).not.toContain('length only'); expect(reading.text).not.toContain(measurement.conclusionCode); expect(reading.text).not.toContain(game.world.attemptId);
    const state = f.store.getState();
    f.replace({ ...state, runtime: { ...state.runtime, game: { ...state.runtime.game!, notebook: { ...state.runtime.game!.notebook,
      measurements: [{ ...measurement, stale: true }] } } } });
    expect(notebook.project().view.evidence.find(e => e.id === measurement.id)?.freshness).toBe('stale'); notebook.dispose();
  });
  it('does not relabel an unknown conclusion or foreign rule as a known copper reading', () => {
    const f = setup(), before = f.store.getState(), game = before.runtime.game!;
    const records = ['unrecognized', 'O03:ACTION-O03-section-replacement:correct', 'O03:ACTION-O03-section-replacement:correct'].map((conclusionCode, index) => ({
      id: `00000000-0000-4000-8000-00000000007${index}` as Measurement['id'], ruleId: q<'rule'>(index === 1 ? 'PHY08' : 'PHY04'),
      roomId: q<'room'>(index === 2 ? 'R01' : 'R03'), subjectIds: [q('O03'), q('PROFILE-COPPER-100')], configurationRevision: game.world.configurationRevision,
      attemptId: game.world.attemptId, stale: false, readings: [{ name: 'Total channel length', value: 95 as Metres, unit: 'm' as const }], conclusionCode,
    }));
    f.replace({ ...before, runtime: { ...before.runtime, game: { ...game, notebook: { ...game.notebook, measurements: records } } } });
    const notebook = createNotebookController({ ...f, registry, presentation: metadata }); expect(notebook.project().view.evidence).toEqual([]); notebook.dispose();
  });
});
