// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile, mkdtemp, mkdir, writeFile, symlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { build } from 'vite';
import { describe, it, expect } from 'vitest';
import { validateContent, reviewedRateToMbps } from '../../src/content/registry';
import { loadDocument, schemaArtifacts } from '../../tools/validate-content';

const world = JSON.parse(await readFile(new URL('../../content/spec001/world.json', import.meta.url), 'utf8'));
const sources = JSON.parse(await readFile(new URL('../../content/spec001/sources.json', import.meta.url), 'utf8'));
const q = (id: string) => `spec001:${id}`;
const always = () => ({ kind: 'always' });
const complete = (id: string) => ({ kind: 'objective-complete', objectiveId: q(id) });
const base = (kind: string, id: string) => ({ kind, id: q(id), schemaVersion: 1, episodeId: 'spec001', contentVersion: '1.0.0' });
const claim = (id: string) => {
  const source = sources.sources.find((s: any) => s.id === id);
  return { sourceId: q(id), section: source.section, supportedClaim: source.supportedClaim, limitations: [source.limits] };
};
const evidence = () => ({ id: q('FACT-power'), roomId: q('R01'), subjectIds: [q('PR001')], kind: 'observation', text: 'Power and data link are separate observations.', ruleIds: [q('PHY01')], requiresFreshMeasurement: false });
const alternative = (id: string) => ({ id: q(id), label: 'Inspect and compare', method: 'direct-action', itemIds: [], abilityIds: [], condition: always(), ruleIds: [q('PHY01')], evidenceIds: [q('FACT-power')], effects: [], explanation: 'Compare the separate observations.' });
function objective(): any {
  const meta = world.objectives[0];
  return { ...base('objective', 'O01'), prerequisite: always(), evidence: [evidence()], alternatives: [alternative('ACTION-inspect')], ruleIds: meta.ruleIds, profileIds: meta.profileIds,
    sourceClaims: ['S01', 'S02', 'S08', 'S12'].map(claim),
    model: { label: 'scoped-technical-predicate', scope: 'Power versus link observation.', assumptions: ['Inspect both indicators.'], limitations: ['No service inference.'] },
    effects: [{ kind: 'complete-objective', effectId: q('EFFECT-O01'), objectiveId: q('O01') }],
    hints: { method: { id: q('HINT-O01-method'), text: 'Inspect the indicators.' }, workedStep: { id: q('HINT-O01-step'), text: 'Read power and link independently.' }, solution: { id: q('HINT-O01-solution'), text: 'Power does not establish data link.' } },
    observableOutcome: 'Separate observations appear.', completionExplanation: 'Inspection is recorded.', requiresReflexTiming: false };
}
function objectiveFor(shortId: string): any {
  const o = objective();
  const meta = world.objectives.find((entry: any) => entry.shortId === shortId);
  const rules = sources.rules.filter((rule: any) => meta.ruleIds.includes(q(rule.id)));
  const ruleId = meta.ruleIds[0];
  return { ...o, id: meta.id, prerequisite: meta.prerequisite, ruleIds: meta.ruleIds, profileIds: meta.profileIds,
    sourceClaims: [...new Set<string>(rules.flatMap((rule: any) => rule.sources))].map(claim),
    evidence: [{ ...evidence(), id: q(`FACT-${shortId}`), roomId: meta.roomId, ruleIds: [ruleId] }],
    alternatives: [{ ...alternative(`ACTION-${shortId}`), ruleIds: [ruleId], evidenceIds: [q(`FACT-${shortId}`)] }],
    effects: [{ kind: 'complete-objective', effectId: q(`EFFECT-${shortId}`), objectiveId: meta.id }],
    hints: Object.fromEntries(Object.entries(o.hints).map(([key, hint]) => [key, { ...(hint as object), id: q(`HINT-${shortId}-${key}`) }])) };
}
const flag = (id: string, value: boolean | string) => ({ kind: 'flag-equals', flagId: q(`FLAG-${id}`), value });
const setFlag = (effect: string, id: string, value: boolean | string) => ({ kind: 'set-flag', effectId: q(`EFFECT-${effect}`), flagId: q(`FLAG-${id}`), value });
function room(): any {
  return { ...base('room', 'R01'), presentationMode: 'rendered-room', description: 'Arrival lift.',
    walkRegions: [{ id: q('WALK-R01'), label: 'Floor', vertices: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }],
    exits: [{ toRoomId: q('R02'), label: 'Workshop', walkRegionId: q('WALK-R01') }],
    hotspots: [{ id: q('HOTSPOT-lift'), subjectId: q('PR001'), label: 'Lift', description: 'Separate indicators.', verbs: ['look'], unsupportedVerbText: 'Inspect it.', evidenceIds: [q('FACT-power')], actionIds: [] }],
    characterIds: world.rooms[0].characterIds, propInstances: [], safePositions: [{ id: q('R01.entry'), walkRegionId: q('WALK-R01'), point: { x: 5, y: 5 } }],
    evidence: [evidence()], ambience: { text: 'A quiet lift.', assetIds: [] }, futureDoorIds: [] };
}
function dialogue(): any {
  return { ...base('dialogue', 'DIALOGUE-intro'), entryNodeId: q('DIALOGUE-hello'), nodes: [
    { id: q('DIALOGUE-hello'), speakerId: q('CH01'), text: 'Inspect the link.', condition: always(), choices: [{ id: q('CHOICE-next'), text: 'Continue', condition: always(), nextNodeId: q('DIALOGUE-bye'), effects: [] }], effects: [], evidenceIds: [] },
    { id: q('DIALOGUE-bye'), speakerId: 'narrator', text: 'Back to the lift.', condition: always(), choices: [], effects: [], evidenceIds: [] },
  ], evidence: [], skipPolicy: 'retain-required-evidence', replayPolicy: 'no-duplicate-effects' };
}
function item(id = 'ITEM-probe'): any {
  return { ...base('item', id), name: 'Probe', description: 'A conventional inspection tool.', propId: q('PR121'), assetId: q('ASSET-probe'), verbs: ['look', 'use'], evidence: [], essentialForRoutes: ['copper'],
    acquisition: { roomId: q('R02'), condition: always(), explanation: 'Collect from the workshop.' }, consumption: 'never', recovery: { policy: 'not-consumed', roomId: q('R02'), condition: always(), explanation: 'The probe is never consumed.' }, combinations: [] };
}
function character(): any {
  const meta = world.characters.find((c: any) => c.recruitable);
  return { ...base('character', meta.shortId), description: 'Reviewed helper.', dialogueIds: [q('DIALOGUE-intro')],
    compendium: { id: q('COMPENDIUM-helper'), technology: 'Physical observation', abilitySummary: 'Inspection', limitations: ['No service guarantee'], realmNote: 'Physical layer', sourceClaims: [claim('S08')], rpgAttributesLabel: 'fictional-balancing-values' }, recruitable: true,
    recruitment: { condition: always(), demonstratedInteraction: 'Explain the inspection.', effects: [{ kind: 'recruit-character', effectId: q('EFFECT-recruit'), characterId: meta.id }] },
    abilities: [{ id: q('ABILITY-inspect'), name: 'Inspection', description: 'Inspect the physical indication.', limitations: ['No service guarantee'], ruleIds: [q('PHY01')], conventionalEquivalentItemIds: [q('ITEM-probe')], effects: [] }],
    progression: [{ level: 1, condition: always(), abilityIds: [q('ABILITY-inspect')], explanation: 'Inspection available.' }], assetIds: [q('ASSET-helper')] };
}
function profile(index = 0): any {
  const p = structuredClone(sources.profiles[index]);
  const rules = sources.rules.filter((r: any) => r.profiles.includes(p.id));
  return { ...base('profile', p.id.slice(8)), reviewedProfileId: p.id, ruleIds: rules.map((r: any) => q(r.id)), sourceClaims: p.sources.map(claim),
    model: { label: p.kind, scope: 'Reviewed teaching fixture.', assumptions: p.assumptions, limitations: p.limits }, parameters: p.parameters,
    reviewedCaseIds: [...new Set(rules.flatMap((r: any) => [...r.correctCases, ...r.incorrectCases, ...r.boundaryCases, ...r.invalidInputCases]))],
    alternatives: [{ ...alternative(`ACTION-profile-${index}`), ruleIds: [q(rules[0].id)] }] };
}
function input(records: any[] = []): any {
  const w = structuredClone(world);
  // These are independent metadata/negative fixtures, not the live authored slice.
  w.documents = [];
  const documents: Record<string, unknown> = {};
  if (records.length) {
    const path = 'content/spec001/test-authored.json';
    w.documents = records.map(r => ({ kind: r.kind, id: r.id, path }));
    documents[path] = { kind: 'collection', schemaVersion: 1, episodeId: 'spec001', contentVersion: '1.0.0', records };
  }
  return JSON.parse(JSON.stringify({ world: w, sources, documents }));
}
function rejects(data: any, code: string) {
  const result = validateContent(data);
  expect(result.ok, JSON.stringify(result)).toBe(false);
  expect(result.issues.some(issue => issue.code === code), JSON.stringify(result.issues)).toBe(true);
}

describe('content registry foundation and independent quest graph', () => {
  it('accepts the actual metadata registry without pretending it contains scenes', () => {
    const result = validateContent(input());
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (!result.ok) return;
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
    expect(result.roomCount).toBe(12); expect(result.authoredRecordCount).toBe(0);
    expect(result.registry?.has('room', q('R01'))).toBe(true);
    expect(result.registry?.record(q('R01'))).toBeUndefined();
  });
  it('accepts reordered metadata and logically equivalent prerequisites', () => {
    const data = input(); data.world.objectives.reverse();
    data.world.objectives.find((o: any) => o.shortId === 'O02').prerequisite = { kind: 'all', conditions: [always(), complete('O01')] };
    expect(validateContent(data).ok).toBe(true);
  });
  it.each(['O04', 'O06', 'O08'])('rejects a cross-branch dependency on %s', id => {
    const data = input(); data.world.objectives[8].prerequisite = complete(id); rejects(data, 'quest-graph');
  });
  it.each(['O09', 'O10'])('requires the common %s before O11', id => {
    const data = input(); data.world.objectives[10].prerequisite.conditions = data.world.objectives[10].prerequisite.conditions.filter((c: any) => c.objectiveId !== q(id)); rejects(data, 'quest-graph');
  });
  it.each([
    ['self cycle', complete('O03')],
    ['optional quest', { kind: 'quest-complete', questId: q('SQ01') }],
    ['optional minigame', { kind: 'minigame-complete', minigameId: q('MG01') }],
    ['future door', { kind: 'future-door-open', futureDoorId: q('FD-IRON-CITY') }],
  ])('rejects %s gating a mandatory objective', (_name, condition) => {
    const data = input(); data.world.objectives[2].prerequisite = condition; rejects(data, _name === 'future door' ? 'impossible-condition' : 'quest-graph');
  });
  it('detects unreachable walk prerequisites independently of objective metadata', () => {
    const data = input(); data.world.walkEdges[0].forwardPrerequisite = complete('O12'); rejects(data, 'route-unreachable');
  });
  it('rejects early walk access and cross-objective completion effects', () => {
    const data = input(); data.world.walkEdges[1].forwardPrerequisite = always(); rejects(data, 'walk-prerequisite');
    const o = objective(); o.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-bypass'), objectiveId: q('O12') }); rejects(input([o]), 'objective-effect');
  });
  it('rejects altered edge, branch allocation and optional cycles', () => {
    let data = input(); data.world.walkEdges[0].to = q('R03'); rejects(data, 'walk-graph');
    data = input(); data.world.branches[0].objectiveIds[0] = q('O05'); rejects(data, 'branches');
    data = input(); data.world.optionalActivities[0].prerequisite = { kind: 'quest-complete', questId: q('SQ01') }; rejects(data, 'optional-cycle');
  });
  it('rejects ID duplicates, suffix mismatch, mismapped source and unknown profiles', () => {
    let data = input(); data.world.rooms[1].id = q('R01'); rejects(data, 'duplicate-id');
    data = input(); data.world.rooms[0].shortId = 'R02'; rejects(data, 'identity');
    data = input(); data.world.reviewedRegistry.sources[0].reviewedId = 'S02'; rejects(data, 'review-mapping');
    data = input(); data.world.objectives[0].profileIds = [q('PROFILE-UNKNOWN')]; rejects(data, 'unknown-reference');
  });
  it('rejects deep or cyclic input before schema recursion', () => {
    let data = input(); let condition: any = always(); for (let n = 0; n < 45; n++) condition = { kind: 'not', condition };
    data.world.objectives[0].prerequisite = condition; rejects(data, 'json-bounds');
    data = input(); data.world.self = data.world; rejects(data, 'json-bounds');
  });
});

describe('authored records resolve by kind and id, including collections', () => {
  it('accepts actual schema-shaped room, objective, dialogue, item and recruit records', () => {
    const result = validateContent(input([room(), objective(), dialogue(), item(), character()]));
    expect(result.ok, JSON.stringify(result)).toBe(true);
    if (result.ok) expect(result.authoredRecordCount).toBe(5);
  });
  it('owns an immutable snapshot after validation', () => {
    const data = input([room()]); const result = validateContent(data);
    expect(result.ok).toBe(true);
    data.world.rooms[0].id = q('R12');
    if (result.ok) { expect(result.registry?.has('room', q('R01'))).toBe(true); expect(Object.isFrozen(result.registry?.record(q('R01')))).toBe(true); }
  });
  it('rejects missing, unlisted, wrong-kind and version-mismatched collection records', () => {
    let data = input([room()]); data.documents = {}; rejects(data, 'missing-document');
    data = input([room()]); data.world.documents = []; rejects(data, 'unlisted-document');
    data = input([room()]); data.world.documents[0].kind = 'objective'; rejects(data, 'unlisted-record');
    data = input([room()]); data.documents['content/spec001/test-authored.json'].records[0].contentVersion = '2.0.0'; rejects(data, 'version');
  });
  it('accepts one record files and rejects metadata masquerading as authored records', () => {
    let data = input([room()]); data.documents['content/spec001/test-authored.json'] = room(); expect(validateContent(data).ok).toBe(true);
    data = input([room()]); data.documents['content/spec001/test-authored.json'] = { ...world.rooms[0], ...base('room', 'R01') }; rejects(data, 'schema');
  });
  it('rejects paths outside content and unknown generic subject/action IDs', () => {
    let data = input([room()]); data.world.documents[0].path = '../private.json'; rejects(data, 'schema');
    let r = room(); r.hotspots[0].subjectId = q('UNKNOWN'); rejects(input([r]), 'subject-reference');
    r = room(); r.hotspots[0].actionIds = [q('ACTION-missing')]; rejects(input([r]), 'unknown-reference');
  });
  it('rejects a generic dialogue ID colliding with an objective namespace', () => {
    const d = dialogue(); d.id = q('O01'); rejects(input([d]), 'id-namespace');
  });
});

describe('reviewed profiles and dimensional content', () => {
  it.each([0, 1, 2, 3, 4, 5, 6])('preserves reviewed profile %i and its source unit labels', index => {
    const result = validateContent(input([room(), profile(index)])); expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it('rejects numeric, dimension, model, case and source-claim drift', () => {
    let p = profile(); p.parameters.maximumChannelLength.value = 101; rejects(input([room(), p]), 'profile-review');
    p = structuredClone(profile(1)); p.parameters.transmit.unit = 'dB'; rejects(input([room(), p]), 'profile-review');
    p = structuredClone(profile(1)); p.model.limitations = ['No limits']; rejects(input([room(), p]), 'profile-review');
    p = profile(1); p.reviewedCaseIds.pop(); rejects(input([room(), p]), 'profile-cases');
    p = profile(1); p.sourceClaims[0].supportedClaim = 'All positive margins prove no overload.'; rejects(input([room(), p]), 'source-claim');
  });
  it('requires known runtime dimensions and explicit Mb/s conversion; toy-level stays source-only', () => {
    for (const unit of ['Mb/s', 'toy-level', 'volts']) {
      const r = room(); r.evidence[0].readings = [{ name: 'sample', unit }]; rejects(input([r]), 'schema');
    }
    const r = room(); r.evidence[0].ruleIds = [q('PHY04')]; r.evidence[0].readings = [{ name: 'length', unit: 'dBm' }]; rejects(input([r]), 'reading-unit');
    expect(reviewedRateToMbps({ value: 100, unit: 'Mb/s' })).toEqual({ value: 100, unit: 'Mbps' });
    expect(() => reviewedRateToMbps({ value: -1, unit: 'Mb/s' })).toThrow();
  });
});

describe('authored reachability, equivalents, recovery and safe positions', () => {
  it('accepts a viable second alternative when the first leads to a dead end', () => {
    const first = objectiveFor('O01'), next = objectiveFor('O02');
    first.alternatives[0].effects = [setFlag('dead', 'path', 'dead')];
    first.alternatives.push({ ...structuredClone(first.alternatives[0]), id: q('ACTION-second'), effects: [setFlag('live', 'path', 'live')] });
    next.prerequisite = flag('path', 'live');
    const result = validateContent(input([first, next])); expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it('resolves a main-story flag produced by an accessible dialogue', () => {
    const o = objectiveFor('O01'), d = dialogue(); o.prerequisite = flag('intro', true);
    d.nodes[1].effects = [setFlag('intro-complete', 'intro', true)];
    const result = validateContent(input([o, d, character(), item()])); expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it('rejects an authored optional self-cycle independently of the metadata graph', () => {
    const quest = objectiveFor('O02'); quest.kind = 'quest'; quest.id = q('SQ01'); quest.requiredForMainStory = false; quest.skippable = true;
    quest.prerequisite = { kind: 'quest-complete', questId: q('SQ01') };
    quest.effects = [{ kind: 'complete-quest', effectId: q('EFFECT-SQ01'), questId: q('SQ01') }];
    rejects(input([quest]), 'optional-cycle');
  });
  it('never merges mutually exclusive alternative histories or retains overwritten flags', () => {
    let first = objectiveFor('O01'), next = objectiveFor('O02');
    first.alternatives[0].effects = [setFlag('left-A', 'A', true), setFlag('left-B', 'B', false)];
    first.alternatives.push({ ...structuredClone(first.alternatives[0]), id: q('ACTION-right'), effects: [setFlag('right-A', 'A', false), setFlag('right-B', 'B', true)] });
    next.prerequisite = { kind: 'all', conditions: [flag('A', true), flag('B', true)] };
    rejects(input([first, next]), 'route-unreachable');
    first = objectiveFor('O01'); next = objectiveFor('O02'); const copper = objectiveFor('O03');
    first.effects.push(setFlag('start', 'A', true));
    next.effects.push(setFlag('overwrite', 'A', false));
    copper.prerequisite = flag('A', true);
    rejects(input([first, next, copper]), 'route-unreachable');
  });
  it('finds a valid common-objective ordering despite the catalog order', () => {
    const common = objectiveFor('O09'); common.prerequisite = { kind: 'not', condition: complete('O03') };
    const result = validateContent(input([common])); expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it('reacquires consumed inventory only through a currently available recovery', () => {
    const i = item(); i.acquisition.roomId = q('R01'); i.recovery.roomId = q('R01'); i.consumption = 'on-documented-transformation'; i.recovery.policy = 'return-to-source';
    const first = objectiveFor('O01'), next = objectiveFor('O02');
    first.effects.push({ kind: 'consume-item', effectId: q('EFFECT-use-probe'), itemId: i.id, quantity: 1 }); next.alternatives[0].itemIds = [i.id];
    let result = validateContent(input([i, first, next])); expect(result.ok, JSON.stringify(result)).toBe(true);
    i.recovery.condition = complete('O12');
    result = validateContent(input([i, first, next])); expect(result.ok).toBe(false);
    expect(result.issues.some(issue => issue.code === 'route-unreachable')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'item-recovery')).toBe(true);
  });
  it('reports an explicit proof bound rather than passing or claiming unreachable', () => {
    const records = Array.from({ length: 13 }, (_, n) => { const i = item(`ITEM-many-${n}`); i.acquisition.roomId = q('R01'); return i; });
    rejects(input(records), 'graph-bounds');
  });
  function diagnosticPanel() {
    const r = room(), d = dialogue();
    d.nodes = [{ ...d.nodes[0], choices: Array.from({ length: 13 }, (_, index) => ({
      id: q(`CHOICE-answer-${index}`), text: `Set diagnostic answer ${index}`, condition: always(), nextNodeId: null,
      effects: [setFlag(`answer-${index}`, `answer-${index}`, true), { kind: 'record-fact', effectId: q(`EFFECT-answer-fact-${index}`), factId: q('FACT-power') }],
    })) }];
    r.hotspots[0].actionIds = d.nodes[0].choices.map((choice: any) => choice.id);
    return { r, d };
  }
  it('proves routes without enumerating diagnostic flags or fact receipts that no condition reads', () => {
    // Thirteen independent controls previously exhausted the 4096-state cap.
    // They stay exposed; this is no suppression of player choices or larger cap.
    const { r, d } = diagnosticPanel();
    const result = validateContent(input([r, d]));
    expect(result.ok, JSON.stringify(result.issues)).toBe(true);
    if (!result.ok) return;
    expect(result.routes).toEqual(['copper', 'fiber', 'radio']);
  });
  it('still keeps overwritten prerequisite flags distinct beside independent diagnostic controls', () => {
    const { r, d } = diagnosticPanel();
    const first = objectiveFor('O01'), next = objectiveFor('O02'), copper = objectiveFor('O03');
    first.effects.push(setFlag('gate-start', 'gate', true));
    next.effects.push(setFlag('gate-overwrite', 'gate', false));
    copper.prerequisite = flag('gate', true);
    const result = validateContent(input([r, d, first, next, copper]));
    expect(result.ok).toBe(false);
    expect(result.issues.some(issue => issue.code === 'route-unreachable')).toBe(true);
    expect(result.issues.some(issue => issue.code === 'graph-bounds')).toBe(false);
  });
  it('accepts an optional extra solution while retaining an ordinary independent route', () => {
    const o = objective(); const alternate = alternative('ACTION-optional'); alternate.condition = { kind: 'quest-complete', questId: q('SQ01') } as any;
    o.alternatives.push(alternate); expect(validateContent(input([o])).ok).toBe(true);
  });
  it('rejects self/circular, contradictory and optional-only authored prerequisites', () => {
    let o = objective(); o.prerequisite = complete('O01'); rejects(input([o]), 'route-unreachable');
    o = objective(); o.prerequisite = { kind: 'all', conditions: [complete('O01'), { kind: 'not', condition: complete('O01') }] }; rejects(input([o]), 'impossible-condition');
    o = objective(); o.alternatives[0].condition = { kind: 'quest-complete', questId: q('SQ01') }; rejects(input([o]), 'route-unreachable');
  });
  it('rejects absent alternatives, absent conventional tools and ally-only solutions', () => {
    let o = objective(); o.alternatives = []; rejects(input([o]), 'schema');
    let c = character(); c.abilities[0].conventionalEquivalentItemIds = []; rejects(input([dialogue(), c, item()]), 'schema');
    c = character(); c.abilities[0].conventionalEquivalentItemIds = [q('ITEM-missing')]; rejects(input([dialogue(), c]), 'unknown-reference');
    o = objective(); o.alternatives[0].method = 'ally-ability'; o.alternatives[0].abilityIds = [q('ABILITY-inspect')]; rejects(input([o, dialogue(), character(), item()]), 'equivalent');
  });
  it('accepts a named ally alternative with an equivalent ordinary action', () => {
    const o = objective(); const alt = alternative('ACTION-ally'); alt.method = 'ally-ability'; alt.abilityIds = [q('ABILITY-inspect')] as never[]; o.alternatives.push(alt);
    const result = validateContent(input([o, dialogue(), character(), item()])); expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it('rejects essential item self-acquisition and recovery requiring the lost item', () => {
    let i = item(); i.acquisition.condition = { kind: 'item-available', itemId: i.id, quantity: 1 }; rejects(input([i]), 'item-recovery');
    i = item(); i.recovery.condition = { kind: 'item-available', itemId: i.id, quantity: 1 }; rejects(input([i]), 'item-recovery');
    i = item(); i.consumption = 'on-documented-transformation'; rejects(input([i]), 'item-recovery');
  });
  it('rejects contradictory effects and consumption of a never-consumed item', () => {
    const o = objective(); o.effects.push({ kind: 'consume-item', effectId: q('EFFECT-consume'), itemId: q('ITEM-probe'), quantity: 1 }); rejects(input([o, item()]), 'item-recovery');
    const d = dialogue(); d.nodes[0].effects = [{ kind: 'set-flag', effectId: q('EFFECT-reused'), flagId: q('FLAG-demo'), value: true }]; d.nodes[1].effects = [{ kind: 'set-flag', effectId: q('EFFECT-reused'), flagId: q('FLAG-demo'), value: false }]; rejects(input([d]), 'duplicate-id');
  });
  it('does not invent inventory quantities or postpone essential recovery until the ending', () => {
    let i = item(); i.acquisition.roomId = q('R01');
    let o = objective(); o.alternatives[0].condition = { kind: 'item-available', itemId: i.id, quantity: 2 };
    rejects(input([i, o]), 'route-unreachable');
    i = item(); i.acquisition.roomId = q('R01'); i.consumption = 'on-documented-transformation'; i.recovery.policy = 'return-to-source'; i.recovery.condition = complete('O12');
    o = objective(); o.effects.push({ kind: 'consume-item', effectId: q('EFFECT-consume'), itemId: i.id, quantity: 1 });
    rejects(input([i, o]), 'item-recovery');
  });
  it('rejects unknown nodes, isolated nodes and an inescapable dialogue loop', () => {
    let d = dialogue(); d.nodes[0].choices[0].nextNodeId = q('DIALOGUE-missing'); rejects(input([d]), 'unknown-reference');
    d = dialogue(); d.nodes[0].choices = []; rejects(input([d]), 'dialogue-reachability');
    d = dialogue(); d.nodes[1].choices = [{ ...d.nodes[0].choices[0], id: q('CHOICE-loop'), nextNodeId: q('DIALOGUE-hello') }]; rejects(input([d]), 'dialogue-cycle');
  });
  it('rejects wrong-room anchors, outside safe positions and degenerate polygons', () => {
    let r = room(); r.safePositions[0].id = q('R02.entry'); rejects(input([r]), 'safe-position');
    r = room(); r.safePositions[0].point.x = 11; rejects(input([r]), 'safe-geometry');
    r = room(); r.walkRegions[0].vertices = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 }]; rejects(input([r]), 'walk-region');
  });
  it('accepts a safe anchor exactly on the walk boundary', () => {
    const r = room(); r.safePositions[0].point = { x: 0, y: 5 }; expect(validateContent(input([r])).ok).toBe(true);
  });
});

describe('room hotspot dialogue-choice reachability', () => {
  function scene() {
    const r = room(), d = dialogue(), o = objective();
    d.nodes[0].effects = [setFlag('entry-ready', 'entry-ready', true)];
    d.nodes[0].choices[0].effects = [setFlag('choice-ready', 'choice-ready', true)];
    d.nodes[0].choices[0].condition = flag('entry-ready', true);
    r.hotspots[0].actionIds = [d.nodes[0].choices[0].id];
    o.alternatives[0].condition = { kind: 'all', conditions: [flag('entry-ready', true), flag('choice-ready', true)] };
    return { r, d, o };
  }
  it('follows the exposed entry choice with entry effects before choice conditions', () => {
    const { r, d, o } = scene();
    const result = validateContent(input([r, d, o]));
    expect(result.ok, JSON.stringify(result)).toBe(true);
  });
  it('cannot obtain unexposed sibling choice effects', () => {
    const { r, d, o } = scene();
    d.nodes[0].choices.push({ id: q('CHOICE-hidden'), text: 'Unexposed choice', condition: always(), nextNodeId: null, effects: [setFlag('hidden', 'hidden', true)] });
    o.alternatives[0].condition = flag('hidden', true);
    rejects(input([r, d, o]), 'route-unreachable');
  });
  it('does not jump from a hotspot directly into a non-entry node choice', () => {
    const { r, d, o } = scene();
    d.nodes[1].choices = [{ id: q('CHOICE-later'), text: 'Later choice', condition: always(), nextNodeId: null, effects: [setFlag('later', 'later', true)] }];
    r.hotspots[0].actionIds = [q('CHOICE-later')];
    o.alternatives[0].condition = flag('later', true);
    rejects(input([r, d, o]), 'hotspot-dialogue-entry');
  });
  it('reports a corrupt cross-dialogue entry without throwing during route analysis', () => {
    const { r, d, o } = scene();
    const other = dialogue(); other.id = q('DIALOGUE-other');
    other.nodes = [{ ...other.nodes[1], id: q('DIALOGUE-other-entry') }];
    other.entryNodeId = q('DIALOGUE-other-entry');
    d.entryNodeId = other.entryNodeId;
    rejects(input([r, d, other, o]), 'dialogue-reference');
  });
  it('preserves the entry condition and checks next-node conditions after selected effects', () => {
    let { r, d, o } = scene();
    d.nodes[0].condition = flag('entry-ready', true);
    rejects(input([r, d, o]), 'route-unreachable');
    ({ r, d, o } = scene());
    d.nodes[1].condition = flag('choice-ready', false);
    rejects(input([r, d, o]), 'route-unreachable');
  });
  it('follows actual subsequent choices but cannot retain an overwritten flag', () => {
    const { r, d, o } = scene();
    d.nodes[1].choices = [{ id: q('CHOICE-finish'), text: 'Finish', condition: flag('choice-ready', true), nextNodeId: null, effects: [setFlag('overwrite-ready', 'choice-ready', false)] }];
    rejects(input([r, d, o]), 'route-unreachable');
  });
  it('cannot replay a one-time hotspot grant into a required second item', () => {
    const { r, d, o } = scene();
    const i = item(); i.acquisition.condition = complete('O12');
    d.nodes[0].choices[0].effects.push({ kind: 'grant-item', effectId: q('EFFECT-give-probe'), itemId: i.id, quantity: 1 });
    o.alternatives[0].condition = { kind: 'item-available', itemId: i.id, quantity: 2 };
    rejects(input([r, d, o, i]), 'route-unreachable');
  });
});

describe('tool boundary and schema provenance', () => {
  it('bundles the runtime without Node APIs and executes with dynamic code generation disabled', async () => {
    const built = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false, lib: { entry: new URL('../../src/content/registry.ts', import.meta.url).pathname, name: 'NQContent', formats: ['iife'] } } });
    const outputs = Array.isArray(built) ? built : [built];
    const code = outputs.flatMap(output => 'output' in output ? output.output : []).filter(chunk => chunk.type === 'chunk').map(chunk => chunk.code).join('\n');
    expect(code).not.toMatch(/node:fs|node:path|new Function\(|\beval\(/);
    const value = runInNewContext(`${code}\nNQContent.validateContent(JSON.parse(payload))`, { payload: JSON.stringify(input()), structuredClone }, { timeout: 3000, contextCodeGeneration: { strings: false, wasm: false } });
    expect(value.ok, JSON.stringify(value)).toBe(true);
  });
  it('keeps generated validators/types exactly synchronized with the schema', async () => {
    for (const [path, expected] of await schemaArtifacts()) expect(await readFile(new URL(`../../${path}`, import.meta.url), 'utf8')).toBe(expected);
  });
  it('loads UTF-8 JSON under content/spec001 and rejects traversal/symlink escapes', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nq-content-'));
    try {
      await mkdir(join(root, 'content/spec001'), { recursive: true });
      await writeFile(join(root, 'content/spec001/good.json'), '{"ok":true}');
      await writeFile(join(root, 'outside.json'), '{}');
      await symlink(join(root, 'outside.json'), join(root, 'content/spec001/escape.json'));
      expect(await loadDocument(root, 'content/spec001/good.json')).toEqual({ ok: true });
      await expect(loadDocument(root, '../outside.json')).rejects.toThrow();
      await expect(loadDocument(root, 'content/spec001/escape.json')).rejects.toThrow('escapes');
      await writeFile(join(root, 'content/spec001/invalid.json'), Buffer.from([0xff]));
      await expect(loadDocument(root, 'content/spec001/invalid.json')).rejects.toThrow();
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
