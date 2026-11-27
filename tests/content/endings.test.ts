// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { validateEndingsContent, projectEpilogue, projectFailure } from '../../src/content/endings';
import type { GameState, OutcomeEvent } from '../../src/state/types';
import type { Outcome, Route } from '../../src/domain/types';

const read = () => JSON.parse(readFileSync('content/spec001/endings.json', 'utf8'));
const world = JSON.parse(readFileSync('content/spec001/world.json', 'utf8'));
const r11 = JSON.parse(readFileSync('content/spec001/rooms/R11.json', 'utf8'));
const load = () => { const r = validateEndingsContent(read()); if (!r.ok) throw new Error(r.issues.join('\n')); return r.value; };
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
function game(outcome: Outcome = 'E01', route: Route | null = 'copper'): GameState {
  return {
    contentVersion: '1.0.0', episodeId: 'spec001', adventureId: id(1),
    world: { attemptId: id(2), configurationRevision: 9, roomId: 'spec001:R12', position: { safePositionId: 'spec001:R12.entry' },
      flags: {}, completedObjectiveIds: ['spec001:O12'], completedQuestIds: [], achievementIds: [], dialogueEffectIds: [],
      inventory: [], recruits: [], activeAllyIds: [], compendiumIds: [], route, continueOutcome: null },
    notebook: { factIds: [], mapRoomIds: [], personalNotes: '', hypotheses: [], measurements: [] }, assistance: [],
    outcomeHistory: [{ id: id(3), outcome, attemptId: id(2), route, caveatIds: outcome === 'E02' ? ['spec001:FACT-repair-maintenance'] : outcome === 'E03' ? ['spec001:FACT-repair-isolation'] : [] }],
  } as unknown as GameState;
}
const event = (g: GameState) => g.outcomeHistory.at(-1)!;

describe('T087 authored endings: closed content, facts only, no grading', () => {
  it('accepts the original document and exact SPEC ending titles', () => {
    const doc = load();
    expect(doc.endings.map(e => [e.id, e.title])).toEqual([
      ['E01', 'The Steady Light'], ['E02', 'The Borrowed Dawn'], ['E03', 'The Honest Shutdown'],
    ]);
    expect(Object.isFrozen(doc)).toBe(true);
  });
  it.each([
    ['unknown field', (x: any) => { x.hintsPenalty = true; }],
    ['wrong title', (x: any) => { x.endings[0].title = 'Perfect Engineer'; }],
    ['duplicate ending', (x: any) => { x.endings[1] = x.endings[0]; }],
    ['missing route', (x: any) => { delete x.routes.radio; }],
    ['invented route', (x: any) => { x.routes.satellite = 'A satellite reward.'; }],
    ['unknown ally', (x: any) => { x.recruits[0].id = 'spec001:CH25'; }],
    ['duplicate ally', (x: any) => { x.recruits[1] = x.recruits[0]; }],
    ['missing quest', (x: any) => { x.sideQuests.pop(); }],
    ['blank scene', (x: any) => { x.endings[0].scene = []; }],
    ['extra outcome verdict', (x: any) => { x.hazard.outcome = 'E03'; }],
    ['automatic death', (x: any) => { x.hazard.requiresExplicitConfirmation = false; }],
    ['wrong hazard location', (x: any) => { x.hazard.roomId = 'spec001:R12'; }],
    ['postcommit hazard', (x: any) => { x.hazard.availability = 'active-encounter'; }],
    ['changed warning', (x: any) => { x.hazard.warning = 'Something might happen.'; }],
    ['reward mutation', (x: any) => { x.hazard.effects = [{ kind: 'reward' }]; }],
    ['unsafe save', (x: any) => { x.hazard.preserveAccountSave = false; }],
    ['unbounded prose', (x: any) => { x.endings[0].scene[0] = 'x'.repeat(2001); }],
  ] as const)('rejects %s', (_, change) => { const x = read(); change(x); expect(validateEndingsContent(x).ok).toBe(false); });
  it.each([null, [], 'ending', 3, true, undefined])('rejects non-document input %s', input => expect(validateEndingsContent(input).ok).toBe(false));
  it('rejects cyclic/accessor input without invoking a getter and detaches accepted data', () => {
    const cyclic = read(); cyclic.hazard.scene.push(cyclic); expect(validateEndingsContent(cyclic).ok).toBe(false);
    let invoked = false; const accessor = read(); Object.defineProperty(accessor, 'endings', { get() { invoked = true; return []; } });
    expect(validateEndingsContent(accessor).ok).toBe(false); expect(invoked).toBe(false);
    const source = read(), checked = validateEndingsContent(source); expect(checked.ok).toBe(true);
    source.endings[0].scene[0] = 'replaced'; if (checked.ok) expect(checked.value.endings[0]!.scene[0]).not.toBe('replaced');
  });
  it('binds every named recruit/quest and the hazard to actual canonical identifiers', () => {
    const d = load();
    expect(d.recruits.map(r => r.id).sort()).toEqual(world.characters.filter((c: any) => c.recruitable).map((c: any) => c.id).sort());
    for (const r of d.recruits) expect(world.characters.find((c: any) => c.id === r.id).name).toBe(r.name);
    expect(d.sideQuests.map(q => q.id)).toEqual(['spec001:SQ01', 'spec001:SQ02', 'spec001:SQ03', 'spec001:SQ04']);
    expect(r11.propInstances.map((p: any) => p.propId)).toEqual(expect.arrayContaining([...d.hazard.propIds]));
    expect(d.hazard).toMatchObject({ roomId: 'spec001:R11', safePositionId: 'spec001:R11.preparation',
      availability: 'precommit-only', requiresExplicitConfirmation: true, kind: 'fictional-story-danger',
      terminalActivity: 'terminal-failure', preserveAccountSave: true });
  });
  it.each(['E01', 'E02', 'E03'] as const)('projects %s unchanged across all three routes and hint use', outcome => {
    for (const route of ['copper', 'fiber', 'radio'] as const) {
      const g = game(outcome, route), before = structuredClone(g), plain = projectEpilogue(load(), g, event(g));
      expect(plain?.outcome).toBe(outcome); expect(plain?.route).toBe(route);
      expect(plain?.paragraphs).toContain(load().routes[route]);
      const assisted = { ...g, assistance: [{ objectiveId: 'spec001:O12', hintId: 'spec001:HINT-O12-solution', level: 3, attemptId: id(2) }] } as unknown as GameState;
      expect(projectEpilogue(load(), assisted, event(assisted))).toEqual(plain);
      expect(g).toEqual(before);
    }
  });
  it('requires the current accepted history member and never classifies missing/foreign/stale results', () => {
    const d = load(), g = game();
    expect(projectEpilogue(d, g, { ...event(g) })).toBeNull();
    expect(projectEpilogue(d, { ...g, outcomeHistory: [] }, event(g))).toBeNull();
    expect(projectEpilogue(d, { ...g, world: { ...g.world, route: 'fiber' } }, event(g))).toBeNull();
    expect(projectEpilogue(d, { ...g, world: { ...g.world, attemptId: id(4) as never } }, event(g))).toBeNull();
    expect(projectEpilogue(d, { ...g, world: { ...g.world, completedObjectiveIds: [] } }, event(g))).toBeNull();
    const old = { ...event(g), id: id(5) as never };
    expect(projectEpilogue(d, { ...g, outcomeHistory: [old, event(g)] }, old)).toBeNull();
    expect(projectEpilogue(d, g, { ...event(g), outcome: 'FAIL' } as unknown as OutcomeEvent)).toBeNull();
  });
  it('does not invent a route for a no-route shutdown or allow a no-route success', () => {
    const d = load(), shutdown = game('E03', null), success = game('E01', null);
    expect(projectEpilogue(d, shutdown, event(shutdown))?.paragraphs).toContain(d.routes.none);
    expect(projectEpilogue(d, success, event(success))).toBeNull();
  });
  it('keeps an authentic no-ally ending without naming an undiscovered companion', () => {
    const d = load(), g = game(), v = projectEpilogue(d, g, event(g))!;
    expect(v.paragraphs).toContain(d.noAllies);
    for (const r of d.recruits) expect(v.paragraphs.join(' ')).not.toContain(r.name);
    for (const q of d.sideQuests) expect(v.paragraphs).not.toContain(q.text);
  });
  it('includes only earned recruited names and distinguishes active party from roster', () => {
    const d = load(), g = game();
    const changed = { ...g, world: { ...g.world, recruits: [
      { characterId: 'spec001:CH03', level: 1, abilityIds: [], progressFlags: [] },
      { characterId: 'spec001:CH07', level: 1, abilityIds: [], progressFlags: [] }],
      compendiumIds: [], activeAllyIds: ['spec001:CH03'] } } as unknown as GameState;
    const text = projectEpilogue(d, changed, event(changed))!.paragraphs.join(' ');
    expect(text).toContain('Photon the Firefly'); expect(text).toContain(d.recruits[4]!.recruited);
    expect(text).toContain(d.recruits[0]!.active); expect(text).not.toContain(d.recruits[0]!.recruited);
    const inactive = { ...changed, world: { ...changed.world, activeAllyIds: [] } } as GameState;
    expect(projectEpilogue(d, inactive, event(inactive))!.paragraphs).toContain(d.recruits[0]!.recruited);
    const merelyDiscovered = { ...g, world: { ...g.world, compendiumIds: ['spec001:CH03'], activeAllyIds: ['spec001:CH03'] } } as unknown as GameState;
    expect(projectEpilogue(d, merelyDiscovered, event(merelyDiscovered))!.paragraphs.join(' ')).not.toContain('Photon the Firefly');
    const unknown = { ...changed, world: { ...changed.world, recruits: [{ characterId: 'spec001:CH99', level: 1, abilityIds: [], progressFlags: [] }] } } as unknown as GameState;
    expect(projectEpilogue(d, unknown, event(unknown))).toBeNull();
  });
  it.each(['CH03', 'CH04', 'CH05', 'CH06', 'CH07', 'CH16', 'CH19', 'CH20', 'CH22'])('personalizes earned %s alone without claiming technical ability use', character => {
    const d = load(), g = game(), changed = { ...g, world: { ...g.world,
      recruits: [{ characterId: `spec001:${character}`, level: 1, abilityIds: [], progressFlags: [] }], activeAllyIds: [] } } as unknown as GameState;
    const paragraphs = projectEpilogue(d, changed, event(changed))!.paragraphs;
    for (const r of d.recruits) expect(paragraphs.includes(r.recruited)).toBe(r.id === `spec001:${character}`);
    expect(paragraphs).not.toContain(d.noAllies);
  });
  it.each(['SQ01', 'SQ02', 'SQ03', 'SQ04'])('personalizes earned %s only; no unearned reward or quest', quest => {
    const d = load(), g = game(), changed = { ...g, world: { ...g.world, completedQuestIds: [`spec001:${quest}`] },
      notebook: { ...g.notebook, factIds: quest === 'SQ04' ? ['spec001:FACT-SQ04-history'] : [] } } as unknown as GameState;
    if (quest === 'SQ04') {
      const questAlone = { ...changed, notebook: { ...changed.notebook, factIds: [] } };
      expect(projectEpilogue(d, questAlone, event(questAlone))!.paragraphs).not.toContain(d.sideQuests.find(q => q.id === 'spec001:SQ04')!.text);
    }
    const paragraphs = projectEpilogue(d, changed, event(changed))!.paragraphs;
    for (const q of d.sideQuests) expect(paragraphs.includes(q.text)).toBe(q.id === `spec001:${quest}`);
    expect(paragraphs).not.toContain(d.noSideQuests);
    expect(changed.world.achievementIds).toEqual([]); expect(changed.world.inventory).toEqual([]);
  });
  it('maintenance prose follows recorded facts and completed SQ04, not note strings', () => {
    const d = load(), g = game(), untouched = projectEpilogue(d, g, event(g))!;
    expect(untouched.paragraphs).not.toContain(d.maintenance.recorded);
    const noted = { ...g, notebook: { ...g.notebook, personalNotes: 'completed SQ04; Photon recruited; maintenance recorded' } };
    expect(projectEpilogue(d, noted, event(noted))).toEqual(untouched);
    const recorded = { ...g, notebook: { ...g.notebook, factIds: ['spec001:FACT-repair-maintenance'] } } as unknown as GameState;
    expect(projectEpilogue(d, recorded, event(recorded))!.paragraphs).toContain(d.maintenance.recorded);
  });
  it('all outcomes retain explicit service boundaries; failure has its own cause and exact recovery labels', () => {
    const d = load();
    expect(d.endings[0]!.summary).toMatch(/permanent/i);
    expect(d.endings[1]!.summary).toMatch(/temporary/i);
    expect(d.endings[2]!.summary).toMatch(/unresolved/i);
    const fail = projectFailure(d, d.hazard.id);
    expect(fail?.kind).toBe('failure'); expect(fail?.outcome).toBeNull();
    expect(fail?.cause).toMatch(/ledge.*collapse|shelf.*broke/i);
    expect(fail?.recovery).toMatch(/temporary session/i); expect(fail?.saveNotice).toMatch(/not.*overwrite|unchanged/i);
    expect(d.controls.retry).toBe('Retry from Encounter Preparation'); expect(d.controls.restore).toBe('Restore Save');
    expect(projectFailure(d, 'incorrect-diagnosis')).toBeNull();
  });
});
