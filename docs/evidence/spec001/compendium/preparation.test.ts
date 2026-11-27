// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Preparation only. Actual T093 data below is still a draft until coordinator acceptance.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type * as S from '../../../../src/content/schema-types.generated';
import type { ContentRegistry } from '../../../../src/content/registry';
import type { GameState, SaveSnapshotV1 } from '../../../../src/state/types';
import { createNavigation } from '../../../../src/state/navigation';
import { episodeNavigationEntries } from '../../../../src/app/content';
import type { NotebookEvidenceView } from '../../../../src/ui/notebook';
import type { QualifiedId } from '../../../../src/domain/types';
import { projectCompendium, resolveCompendiumPortrait, describeEvidenceRoute } from './candidate';
import type { CompendiumPortraitBinding } from './candidate';

const read = (file: string) => JSON.parse(readFileSync(file, 'utf8'));
const metadata = read('content/spec001/world.json') as S.world;
const characters = (read('docs/evidence/spec001/characters/characters.json.draft') as S.collection).records as S.character[];
const rooms = metadata.rooms.map(room => read(`content/spec001/rooms/${room.shortId}.json`) as S.room);
const records = [...rooms, ...characters];
const registry: ContentRegistry = { record: id => records.find(record => record.id === id), has: (kind, id) => records.some(record => record.kind === kind && record.id === id),
  safePosition: id => metadata.safePositions.find(position => position.id === id) };
const navigation = createNavigation({ registry, world: metadata, entries: episodeNavigationEntries(registry, metadata) });
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
type FixtureGame = { -readonly [K in keyof GameState]: GameState[K] };
function game(): FixtureGame {
  const { saveSchemaVersion: _version, safeState: _safe, ...state } = read('specs/001-physical-layer-underworld/contracts/examples/save-v1.json') as SaveSnapshotV1;
  return { ...state, world: { ...state.world, compendiumIds: [], recruits: [], activeAllyIds: [], completedObjectiveIds: [], flags: {} },
    notebook: { ...state.notebook, factIds: [], measurements: [], hypotheses: [], personalNotes: '', mapRoomIds: [q<'room'>('R01')] } };
}
const clue: NotebookEvidenceView = { id: q('FACT-power'), heading: 'Power indication', sourceRoomId: q<'room'>('R01'), sourceRoom: 'The Arrival Lift', kind: 'Observation',
  text: 'Power indication does not prove a data link.', freshness: 'observation' };
const measured: NotebookEvidenceView = { id: 'measurement-one', heading: 'Optical compatibility', sourceRoomId: q<'room'>('R05'), sourceRoom: 'Fiber Gardens', kind: 'Measurement',
  text: 'Observed match from configuration 4; attempt one.', freshness: 'stale' };
const project = (state: GameState, evidence: readonly NotebookEvidenceView[] = []) => projectCompendium({ registry, metadata, game: state, evidence, navigation, activity: 'stable-exploration' });

describe('T095 independent compendium projection expectations (not integrated)', () => {
  it('does not discover by viewing, visiting every room, writing a name, or pinning a hypothesis', () => {
    const original = game();
    const state: GameState = { ...original, notebook: { ...original.notebook, mapRoomIds: rooms.map(room => room.id as QualifiedId<'room'>),
      personalNotes: 'Photon recruited; all done', hypotheses: [{ id: 'idea' as never, text: 'Copperhead mastered', status: 'supported', subjectIds: [q('CH04')] }] } };
    const before = structuredClone(state), view = project(state);
    expect(view.entries).toEqual([]); expect(view.undiscoveredCount).toBe(25); expect(state).toEqual(before);
    expect(view.personalNotes).toBe('Photon recruited; all done'); expect(view.hypotheses[0]?.text).toBe('Copperhead mastered');
    expect(view.evidence).toEqual([]);
  });
  it('renders the exact discovered identity and authored teaching fields without revealing remaining names', () => {
    const state = game(); state.world = { ...state.world, compendiumIds: [q<'compendium'>('COMPENDIUM-CH03')] };
    const before = structuredClone(state), view = project(state), entry = view.entries[0]!;
    expect(view.entries).toHaveLength(1); expect(view.undiscoveredCount).toBe(24); expect(entry.name).toBe('Photon the Firefly');
    expect(entry.technology).toBe(characters[2]!.compendium.technology); expect(entry.limitations).toEqual(characters[2]!.compendium.limitations);
    expect(entry.sources[0]).toEqual(characters[2]!.compendium.sourceClaims[0]); expect(entry.recruitment).toBe(characters[2]!.compendium.recruitmentSummary);
    expect(entry.progression).toBe(characters[2]!.compendium.progressionSummary); expect(entry.status).toBe('Discovered; not recruited');
    expect(JSON.stringify(view)).not.toContain('Copperhead'); expect(state).toEqual(before);
  });
  it('ignores unknown/duplicate saved IDs and counts remaining known identities correctly', () => {
    const state = game(); state.world = { ...state.world, compendiumIds: [q<'compendium'>('COMPENDIUM-CH03'), q<'compendium'>('COMPENDIUM-CH03'), q<'compendium'>('unknown')] };
    const view = project(state); expect(view.entries).toHaveLength(1); expect(view.undiscoveredCount).toBe(24);
  });
  it('keeps discovery distinct from recruitment and unlocked progression', () => {
    const state = game(); state.world = { ...state.world, compendiumIds: [q<'compendium'>('COMPENDIUM-CH03')],
      recruits: [{ characterId: q<'character'>('CH03'), level: 1, abilityIds: [q<'ability'>('ABILITY-CH03-optical-checklist')], progressFlags: [] }], activeAllyIds: [] };
    const view = project(state); expect(view.entries[0]?.status).toBe('Recruited · level 1 · not active');
    expect(view.entries[0]?.abilities.map(ability => ability.unlocked)).toEqual([true, false]);
    expect(project({ ...state, world: { ...state.world, compendiumIds: [] } }).entries).toEqual([]);
  });
  it('preserves canonical notebook evidence text, source and freshness; notes cannot become evidence', () => {
    const state = game(); state.notebook = { ...state.notebook, mapRoomIds: [q<'room'>('R01'), q<'room'>('R05')], personalNotes: 'Fresh match' };
    const view = project(state, [clue, measured]);
    expect(view.evidence.map(row => row.evidence)).toEqual([clue, measured]);
    expect(view.evidence[1]?.evidence.freshness).toBe('stale'); expect(view.evidence[1]?.route.status).toBe('unavailable');
    expect(state.notebook.measurements).toEqual([]);
  });
  it('detaches all nested view arrays from authored content and world journals', () => {
    const state = game(); state.world = { ...state.world, compendiumIds: [q<'compendium'>('COMPENDIUM-CH03')] };
    const before = structuredClone({ state, character: characters[2] }), view = project(state, [clue]);
    (view.entries[0]!.limitations as string[]).push('forged'); (view.entries[0]!.sources[0]!.limitations as string[]).push('forged');
    (view.evidence[0]!.evidence as { text: string }).text = 'forged';
    expect(state).toEqual(before.state); expect(characters[2]).toEqual(before.character); expect(clue.text).not.toBe('forged');
  });
  it('resolves source titles and HTTPS references only from an exact existing catalog record', () => {
    const state = game(); state.world = { ...state.world, compendiumIds: [q<'compendium'>('COMPENDIUM-CH03')] };
    const sourceCatalog = read('content/spec001/sources.json').sources;
    const view = projectCompendium({ registry, metadata, game: state, evidence: [], navigation, activity: 'stable-exploration', sourceCatalog });
    expect(view.entries[0]?.sources[0]?.title).toBe(sourceCatalog[0].title); expect(view.entries[0]?.sources[0]?.url).toBe(sourceCatalog[0].url);
    expect(view.entries[0]?.sources[0]?.limitations).toEqual(characters[2]!.compendium.sourceClaims[0]!.limitations);
    const unsafe = projectCompendium({ registry, metadata, game: state, evidence: [], navigation, activity: 'stable-exploration', sourceCatalog: [{ id: 'S01', title: 'Text stays text', url: 'javascript:alert(1)' }] });
    expect(unsafe.entries[0]?.sources[0]).not.toHaveProperty('url'); expect(unsafe.entries[0]?.sources[1]).not.toHaveProperty('title');
  });
});

describe('T095 actual navigation policy projected as read-only guidance', () => {
  it('identifies an already-current source without movement or new measurement', () => {
    const state = game(), before = structuredClone(state);
    expect(describeEvidenceRoute({ registry, metadata, navigation, game: state, activity: 'stable-exploration', sourceRoomId: q<'room'>('R01') }).status).toBe('here');
    expect(state).toEqual(before);
  });
  it('does not expose an unvisited source or invent a path through locked exits', () => {
    const state = game();
    expect(describeEvidenceRoute({ registry, metadata, navigation, game: state, activity: 'stable-exploration', sourceRoomId: q<'room'>('R05') }).status).toBe('unvisited');
    state.notebook = { ...state.notebook, mapRoomIds: [q<'room'>('R01'), q<'room'>('R02'), q<'room'>('R05')] };
    expect(describeEvidenceRoute({ registry, metadata, navigation, game: state, activity: 'stable-exploration', sourceRoomId: q<'room'>('R05') }).status).toBe('unavailable');
  });
  it('shows the two real forward walks with their authored exit labels and preserves stale evidence', () => {
    const state = game(); state.world = { ...state.world, completedObjectiveIds: [q<'objective'>('O01'), q<'objective'>('O02')] };
    state.notebook = { ...state.notebook, mapRoomIds: [q<'room'>('R01'), q<'room'>('R02'), q<'room'>('R05')] };
    const before = structuredClone(state), route = describeEvidenceRoute({ registry, metadata, navigation, game: state, activity: 'stable-exploration', sourceRoomId: q<'room'>('R05') });
    expect(route.status).toBe('walk'); expect(route.steps.map(step => step.toRoomId)).toEqual([q('R02'), q('R05')]);
    expect(route.steps[0]?.exitLabel).toBe(rooms[0]!.exits.find(exit => exit.toRoomId === q('R02'))!.label);
    expect(state).toEqual(before);
  });
  it('does not offer exploration walks during an unsafe activity or from an invalid floor anchor', () => {
    const state = game(); state.world = { ...state.world, completedObjectiveIds: [q<'objective'>('O01')], position: { safePositionId: q<'safe-position'>('unknown') } };
    state.notebook = { ...state.notebook, mapRoomIds: [q<'room'>('R01'), q<'room'>('R02')] };
    expect(describeEvidenceRoute({ registry, metadata, navigation, game: state, activity: 'active-encounter', sourceRoomId: q<'room'>('R02') }).status).toBe('unavailable');
    expect(describeEvidenceRoute({ registry, metadata, navigation, game: state, activity: 'stable-exploration', sourceRoomId: q<'room'>('R02') }).status).toBe('unavailable');
  });
});

describe('T095 portrait boundary, synthetic binding tests only', () => {
  const character = characters[2]!;
  const good: CompendiumPortraitBinding = { characterId: 'spec001:CH03', compendiumId: 'spec001:COMPENDIUM-CH03', assetId: 'spec001:ASSET-PORTRAIT-CH03', exportPath: 'public/assets/portraits/CH03.webp' };
  it('leaves every planned portrait as readable text, without generating an image URL', () => {
    for (const record of characters) {
      const portrait = resolveCompendiumPortrait(record, [], '/arcade/play/network-quest/');
      expect(portrait.status).toBe('unavailable'); expect(portrait.text).toBe(record.compendium.portraitText); expect(portrait).not.toHaveProperty('src');
    }
  });
  it('resolves only an exact explicit production binding under the public game base', () => {
    expect(resolveCompendiumPortrait(character, [good], '/arcade/play/network-quest/')).toEqual({ status: 'available', assetId: good.assetId,
      text: character.compendium.portraitText, src: '/arcade/play/network-quest/assets/portraits/CH03.webp' });
  });
  it.each([
    { ...good, characterId: 'spec001:CH04' }, { ...good, compendiumId: 'spec001:COMPENDIUM-CH04' }, { ...good, assetId: 'spec001:ASSET-CH03' },
    { ...good, exportPath: 'https://example.com/private.png' }, { ...good, exportPath: 'public/assets/../private.png' },
    { ...good, exportPath: 'public/assets/portrait.svg' }, { ...good, exportPath: 'public/assets/portrait.png?tracking=1' },
  ])('rejects a mismatched/nonlocal/nonraster binding: %j', binding => {
    expect(resolveCompendiumPortrait(character, [binding], '/arcade/play/network-quest/').status).toBe('unavailable');
  });
  it('fails closed on ambiguous duplicate bindings and malformed game bases', () => {
    expect(resolveCompendiumPortrait(character, [good, good], '/arcade/play/network-quest/').status).toBe('unavailable');
    expect(resolveCompendiumPortrait(character, [good], '//other.example/').status).toBe('unavailable');
  });
});
