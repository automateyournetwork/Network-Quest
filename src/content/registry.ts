// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import validateSchema from './schema.generated.js';
import type * as S from './schema-types.generated';

export interface ContentIssue { code: string; path: string; message: string }
export interface ContentInput {
  world: unknown;
  sources: unknown;
  documents: Readonly<Record<string, unknown>>;
  /** Tooling preflight only; never returns a usable registry. */
  allowUnloadedDocuments?: boolean;
}
export interface ContentRegistry {
  has(kind: string, id: string): boolean;
  record(id: string): Readonly<S.authoredRecord> | undefined;
  safePosition(id: string): Readonly<S.safePosition> | undefined;
}
export type ContentResult = {
  ok: false; issues: ContentIssue[];
} | {
  ok: true; issues: []; documentPaths: string[]; roomCount: number;
  authoredRecordCount: number; routes: string[]; registry: ContentRegistry | null;
};

interface Source { id: string; section: string; supportedClaim: string; limits: string }
interface Profile { id: string; kind: string; sources: string[]; parameters: unknown; assumptions: string[]; limits: string[] }
interface Rule {
  id: string; objectives: string[]; sources: string[]; profiles: string[];
  correctCases: string[]; incorrectCases: string[]; boundaryCases: string[]; invalidInputCases: string[];
}
interface Review { sources: Source[]; profiles: Profile[]; rules: Rule[]; referenceCases: { id: string }[]; reviewCases: { id: string }[] }
type Entry = { id: string };
type State = { completed: Set<string>; items: Map<string, number>; flags: Map<string, string | boolean | number>; recruits: Set<string>; optional: Set<string> };
const q = (id: string) => `spec001:${id}`;
const initialState = (): State => ({ completed: new Set(), items: new Map(), flags: new Map(), recruits: new Set(), optional: new Set() });
/** Reviewed decimal megabits/sec spelling alias; no source record is rewritten. */
export function reviewedRateToMbps(rate: { value: number; unit: 'Mb/s' }): { value: number; unit: 'Mbps' } {
  if (rate.unit !== 'Mb/s' || !Number.isFinite(rate.value) || rate.value < 0) throw new Error('Expected finite nonnegative reviewed Mb/s');
  return { value: rate.value, unit: 'Mbps' };
}
const same = (a: unknown, b: unknown): boolean => canonical(a) === canonical(b);
const schemaErrors = () => {
  const errors = validateSchema.errors;
  return JSON.stringify(Array.isArray(errors) ? errors.slice(0, 12) : errors ?? 'Expected world');
};
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`;
  return JSON.stringify(value);
}
function sameSet(a: readonly string[], b: readonly string[]): boolean { return same([...a].sort(), [...b].sort()); }

/** Bounds run before recursive schema validation. Accept decoded JSON only. */
function boundedJSON(input: unknown): boolean {
  const stack: [unknown, number][] = [[input, 0]];
  const seen = new WeakSet<object>();
  let count = 0;
  while (stack.length) {
    const [value, depth] = stack.pop()!;
    if (++count > 150_000 || depth > 40) return false;
    if (value === null || typeof value === 'boolean') continue;
    if (typeof value === 'number') { if (!Number.isFinite(value)) return false; continue; }
    if (typeof value === 'string') { if (value.length > 65_536) return false; continue; }
    if (typeof value !== 'object' || seen.has(value)) return false;
    seen.add(value);
    if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
    for (const descriptor of Object.values(Object.getOwnPropertyDescriptors(value))) {
      if (!('value' in descriptor)) return false;
      stack.push([descriptor.value, depth + 1]);
    }
  }
  return true;
}
function visit(value: unknown, callback: (node: Record<string, unknown>, path: string) => void, path = ''): void {
  if (Array.isArray(value)) value.forEach((child, i) => visit(child, callback, `${path}/${i}`));
  else if (value && typeof value === 'object') {
    callback(value as Record<string, unknown>, path);
    Object.entries(value).forEach(([key, child]) => visit(child, callback, `${path}/${key}`));
  }
}
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function reviewShape(value: unknown): value is Review {
  if (!value || typeof value !== 'object') return false;
  const o = value as Record<string, unknown>;
  const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
  const rows = (key: string, test: (v: Record<string, unknown>) => boolean) => Array.isArray(o[key]) && o[key].every((v: unknown) => !!v && typeof v === 'object' && typeof (v as Entry).id === 'string' && test(v as Record<string, unknown>));
  return rows('sources', v => ['section', 'supportedClaim', 'limits'].every(k => typeof v[k] === 'string'))
    && rows('profiles', v => typeof v['kind'] === 'string' && !!v['parameters'] && typeof v['parameters'] === 'object' && ['sources', 'assumptions', 'limits'].every(k => strings(v[k])))
    && rows('rules', v => ['objectives', 'sources', 'profiles', 'correctCases', 'incorrectCases', 'boundaryCases', 'invalidInputCases'].every(k => strings(v[k])))
    && rows('referenceCases', () => true) && rows('reviewCases', () => true);
}
function evaluate(c: S.condition, s: State): boolean {
  switch (c.kind) {
    case 'always': return true;
    case 'all': return c.conditions.every(x => evaluate(x, s));
    case 'any': return c.conditions.some(x => evaluate(x, s));
    case 'not': return !evaluate(c.condition, s);
    case 'objective-complete': return s.completed.has(c.objectiveId);
    case 'quest-complete': return s.optional.has(c.questId);
    case 'minigame-complete': return s.optional.has(c.minigameId);
    case 'future-door-open': return false;
    case 'item-available': return (s.items.get(c.itemId) ?? 0) >= c.quantity;
    case 'character-recruited': return s.recruits.has(c.characterId);
    case 'flag-equals': return s.flags.has(c.flagId) && s.flags.get(c.flagId) === c.value;
  }
}
// DNF contradiction detection, with an explicit authoring complexity ceiling.
function terms(c: S.condition, negate = false): Map<string, boolean>[] {
  if (c.kind === 'not') return terms(c.condition, !negate);
  if (c.kind === 'always') return negate ? [] : [new Map()];
  if (c.kind === 'future-door-open') return negate ? [new Map()] : [];
  if (c.kind === 'all' || c.kind === 'any') {
    const children = c.conditions.map(x => terms(x, negate));
    if ((c.kind === 'any') !== negate) {
      const result = children.flat(); if (result.length > 256) throw new Error('condition exceeds 256 alternatives'); return result;
    }
    let result: Map<string, boolean>[] = [new Map()];
    for (const child of children) {
      const next: Map<string, boolean>[] = [];
      for (const left of result) for (const right of child) {
        const merged = new Map(left); let conflict = false;
        for (const [key, value] of right) {
          if (merged.has(key) && merged.get(key) !== value) conflict = true;
          if (value && key.startsWith('flag:')) for (const [other, enabled] of merged) {
            if (enabled && other.startsWith(key.slice(0, key.lastIndexOf('=')) + '=') && other !== key) conflict = true;
          }
          merged.set(key, value);
        }
        if (!conflict) next.push(merged);
        if (next.length > 256) throw new Error('condition exceeds 256 alternatives');
      }
      result = next;
    }
    return result;
  }
  const key = c.kind === 'flag-equals' ? `flag:${c.flagId}=${JSON.stringify(c.value)}` : canonical(c);
  return [new Map([[key, !negate]])];
}
const conditionKinds = new Set(['always', 'all', 'any', 'not', 'objective-complete', 'quest-complete', 'minigame-complete', 'future-door-open', 'item-available', 'character-recruited', 'flag-equals']);
const expectedEdges = ['01-02', '02-03', '02-05', '02-07', '02-09', '02-10', '03-04', '05-06', '07-08', '04-11', '06-11', '08-11', '10-11', '11-12'];
const branchNumbers = { copper: ['03', '04'], fiber: ['05', '06'], radio: ['07', '08'] } as const;
function expectedPrerequisite(id: string, completed: Set<string>): boolean {
  const has = (n: string) => completed.has(q(`O${n}`));
  switch (id) {
    case 'O01': return true;
    case 'O02': return has('01');
    case 'O03': case 'O05': case 'O07': case 'O09': case 'O10': return has('02');
    case 'O04': return has('03');
    case 'O06': return has('05');
    case 'O08': return has('07');
    case 'O11': return (has('04') || has('06') || has('08')) && has('09') && has('10');
    case 'O12': return has('11');
    default: return false;
  }
}

export function validateContent(input: ContentInput): ContentResult {
  const issues: ContentIssue[] = [];
  const fail = (code: string, path: string, message: string) => { if (issues.length < 100) issues.push({ code, path, message }); };
  for (const [path, data] of [['world', input.world], ['sources', input.sources], ...Object.entries(input.documents)] as const) {
    if (!boundedJSON(data)) fail('json-bounds', path, 'Expected finite, acyclic JSON within depth/node limits');
  }
  if (issues.length) return { ok: false, issues };
  // Own the validated snapshot: subsequent caller mutation cannot change membership.
  const worldData: unknown = structuredClone(input.world);
  const sourceData: unknown = structuredClone(input.sources);
  if (!validateSchema(worldData) || (worldData as { kind?: string }).kind !== 'world') fail('schema', 'world', schemaErrors());
  if (!reviewShape(sourceData)) fail('source-shape', 'sources', 'Expected the reviewed source/rule/profile register');
  if (issues.length) return { ok: false, issues };
  const world = worldData as S.world;
  const review = sourceData as Review;
  if (input.allowUnloadedDocuments) return { ok: true, issues: [], documentPaths: [...new Set(world.documents.map(d => d.path))], roomCount: world.rooms.length, authoredRecordCount: 0, routes: [], registry: null };
  const records: S.authoredRecord[] = [];
  const documents = new Map<string, S.authoredRecord[]>();
  const paths = [...new Set(world.documents.map(d => d.path))];
  for (const [path, raw] of Object.entries(input.documents)) {
    if (!paths.includes(path)) { fail('unlisted-document', path, 'Document is not listed in world.documents'); continue; }
    const data = structuredClone(raw);
    if (!validateSchema(data)) { fail('schema', path, schemaErrors()); continue; }
    const doc = data as S.authoredRecord | S.collection | S.world;
    if (doc.kind === 'world') { fail('document-kind', path, 'World metadata is not an authored record'); continue; }
    if (doc.contentVersion !== world.contentVersion) fail('version', path, 'Collection/document version differs from world');
    const entries = doc.kind === 'collection' ? doc.records : [doc];
    documents.set(path, entries);
    for (const record of entries) {
      if (!world.documents.some(d => d.path === path && d.id === record.id && d.kind === record.kind)) fail('unlisted-record', path, `Unlisted ${record.kind} ${record.id}`);
      if (record.contentVersion !== world.contentVersion) fail('version', record.id, 'Record version differs from world');
      records.push(record);
    }
  }
  for (const ref of world.documents) {
    const loaded = documents.get(ref.path);
    if (!loaded && !input.allowUnloadedDocuments) fail('missing-document', ref.path, 'Listed document was not loaded');
    if (loaded && loaded.filter(r => r.id === ref.id && r.kind === ref.kind).length !== 1) fail('document-reference', ref.path, `Expected exactly one ${ref.kind} ${ref.id}`);
  }
  if (issues.length) return { ok: false, issues };
  const indexes = new Map<string, Map<string, unknown>>();
  function add(kind: string, rows: readonly Entry[], duplicateAllowed = false) {
    const index = indexes.get(kind) ?? new Map<string, unknown>(); indexes.set(kind, index);
    for (const row of rows) {
      if (index.has(row.id) && !(duplicateAllowed && same(index.get(row.id), row))) fail('duplicate-id', row.id, `Duplicate or contradictory ${kind} definition`);
      else index.set(row.id, row);
    }
  }
  const has = (kind: string, id: string) => indexes.get(kind)?.has(id) ?? false;
  const need = (kind: string, id: string, path: string) => { if (!has(kind, id)) fail('unknown-reference', path, `Unknown ${kind}: ${id}`); };
  add('room', world.rooms); add('objective', world.objectives); add('character', world.characters); add('prop', world.props);
  add('quest', world.optionalActivities.filter(x => x.kind === 'side-quest')); add('minigame', world.optionalActivities.filter(x => x.kind === 'minigame'));
  add('safe-position', world.safePositions); add('future-door', world.futureDoors);
  add('source', world.reviewedRegistry.sources); add('rule', world.reviewedRegistry.rules);
  add('profile', world.reviewedRegistry.profileIds.map(id => ({ id })));
  add('authored', records); add('document-reference', world.documents);
  for (const record of records) if (['item', 'dialogue'].includes(record.kind)) add(record.kind, [record]); else need(record.kind, record.id, record.id);
  for (const rows of [world.rooms, world.objectives, world.characters, world.props, world.optionalActivities]) for (const row of rows) {
    if (row.id !== q(row.shortId)) fail('identity', row.id, 'Qualified ID and original short ID disagree');
  }
  for (const [kind, rows] of [['source', review.sources], ['rule', review.rules], ['review-profile', review.profiles]] as const) {
    const unique = new Set(rows.map(x => x.id));
    if (unique.size !== rows.length) fail('review-identity', 'sources', `Duplicate reviewed ${kind}`);
  }
  for (const [mappings, reviewed] of [[world.reviewedRegistry.sources, review.sources], [world.reviewedRegistry.rules, review.rules]] as const) {
    if (!sameSet(mappings.map(x => x.reviewedId), reviewed.map(x => x.id))) fail('review-mapping', 'world/reviewedRegistry', 'Reviewed mapping membership differs');
    for (const entry of mappings) if (entry.id !== q(entry.reviewedId)) fail('review-mapping', entry.id, 'Reviewed qualification changed identity');
  }
  if (!sameSet(world.reviewedRegistry.profileIds, review.profiles.map(x => x.id))) fail('review-mapping', 'world/reviewedRegistry/profileIds', 'Reviewed profiles differ');
  for (const record of records) {
    if ('evidence' in record) add('fact', record.evidence, true);
    if ('hints' in record) add('hint', Object.values(record.hints));
    if ('alternatives' in record) add('action', record.alternatives);
    if (record.kind === 'character') { add('ability', record.abilities); add('compendium', [record.compendium]); }
    if (record.kind === 'dialogue') { add('dialogue-node', record.nodes); for (const node of record.nodes) add('action', node.choices); }
    if (record.kind === 'item') add('action', record.combinations);
    if (record.kind === 'room') { add('walk-region', record.walkRegions); add('hotspot', record.hotspots); }
    visit(record, node => {
      if (typeof node['effectId'] === 'string') add('effect', [{ ...node, id: node['effectId'] }], true);
      if (node['kind'] === 'set-flag') {
        const id = node['flagId'] as string;
        if (!has('flag', id)) add('flag', [{ id }]);
      }
    });
  }
  const owner = new Map<string, string>();
  for (const [kind, index] of indexes) if (!['authored', 'document-reference'].includes(kind)) {
    for (const id of index.keys()) {
      if (owner.has(id) && owner.get(id) !== kind) fail('id-namespace', id, `Identity used as both ${owner.get(id)} and ${kind}`);
      owner.set(id, kind);
    }
  }
  // Generic id syntax is insufficient. Every reference has a specific namespace.
  const referenceKinds: Record<string, string> = {
    roomId: 'room', roomIds: 'room', toRoomId: 'room', from: 'room', to: 'room',
    objectiveId: 'objective', objectiveIds: 'objective', commonObjectiveIds: 'objective',
    characterId: 'character', characterIds: 'character', speakerId: 'character',
    propId: 'prop', propIds: 'prop', questId: 'quest', minigameId: 'minigame',
    safePositionId: 'safe-position', safePositionIds: 'safe-position', futureDoorId: 'future-door', futureDoorIds: 'future-door',
    ruleIds: 'rule', sourceId: 'source', profileIds: 'profile', reviewedProfileId: 'profile',
    itemId: 'item', itemIds: 'item', withItemId: 'item', conventionalEquivalentItemIds: 'item',
    abilityId: 'ability', abilityIds: 'ability', flagId: 'flag', factId: 'fact', evidenceIds: 'fact',
    dialogueIds: 'dialogue', nextNodeId: 'dialogue-node', entryNodeId: 'dialogue-node', walkRegionId: 'walk-region', actionIds: 'action',
  };
  function references(value: unknown, prefix: string) {
    visit(value, (node, path) => {
      for (const [key, raw] of Object.entries(node)) {
        const kind = referenceKinds[key];
        if (kind) for (const id of Array.isArray(raw) ? raw : [raw]) if (typeof id === 'string' && id !== 'narrator') need(kind, id, `${prefix}${path}/${key}`);
        if (key === 'subjectId' || key === 'subjectIds') for (const id of Array.isArray(raw) ? raw : [raw]) {
          if (typeof id === 'string' && !['room', 'character', 'prop', 'item', 'profile', 'objective'].some(k => has(k, id))) fail('subject-reference', `${prefix}${path}`, `Unknown semantic subject: ${id}`);
        }
      }
      if (conditionKinds.has(node['kind'] as string)) {
        try { if (!terms(node as S.condition).length) fail('impossible-condition', `${prefix}${path}`, 'Condition is contradictory'); }
        catch { fail('condition-bounds', `${prefix}${path}`, 'Condition exceeds bounded analysis'); }
      }
    });
  }
  references(world, 'world'); records.forEach(r => references(r, r.id));
  // Later checks dereference validated identities and expand bounded conditions.
  // Report these diagnostics before traversing malformed or missing definitions.
  if (issues.length) return { ok: false, issues };
  checkWorld(world, review, fail);
  for (const record of records) checkRecord(record, world, records, review, fail);
  const routes = checkRoutes(world, records, fail);
  checkOptionalDependencies(world, records, fail);
  if (issues.length) return { ok: false, issues };
  freeze(world); records.forEach(freeze);
  const authored = new Map(records.map(r => [r.id, r]));
  const safe = new Map(world.safePositions.map(p => [p.id, p]));
  return { ok: true, issues: [], documentPaths: paths, roomCount: world.rooms.length, authoredRecordCount: records.length, routes,
    registry: Object.freeze({ has, record: (id: string) => authored.get(id), safePosition: (id: string) => safe.get(id) }) };
}

type Fail = (code: string, path: string, message: string) => void;
function checkWorld(w: S.world, review: Review, fail: Fail): void {
  if (!sameSet(w.walkEdges.map(e => `${e.from.slice(-2)}-${e.to.slice(-2)}`), expectedEdges)) fail('walk-graph', 'world/walkEdges', 'Expected the fourteen specified directed pairs with available return traversal');
  if (!sameSet(w.commonObjectiveIds, [q('O09'), q('O10')])) fail('common-objectives', 'world/commonObjectiveIds', 'O09 and O10 are both common prerequisites');
  if (!sameSet(w.branches.map(b => b.id), Object.keys(branchNumbers))) fail('branches', 'world/branches', 'Expected three distinct branches');
  for (const b of w.branches) {
    if (!same(b.objectiveIds, branchNumbers[b.id].map(n => q(`O${n}`))) || !same(b.roomIds, branchNumbers[b.id].map(n => q(`R${n}`)))) fail('branches', b.id, 'Branch room/objective allocation differs from Spec001');
  }
  if (w.characters.filter(c => c.recruitable).length !== 9) fail('recruit-count', 'world/characters', 'Exactly nine characters are recruitable');
  const caseIds = new Set([...review.referenceCases, ...review.reviewCases].map(c => c.id));
  for (const rule of review.rules) {
    if (rule.sources.some(id => !review.sources.some(s => s.id === id)) || rule.profiles.some(id => !review.profiles.some(p => p.id === id)) || rule.objectives.some(id => !w.objectives.some(o => o.shortId === id))) fail('review-reference', rule.id, 'Reviewed rule references unknown source/profile/objective');
    for (const cases of [rule.correctCases, rule.incorrectCases, rule.boundaryCases, rule.invalidInputCases]) if (!cases.length || cases.some(id => !caseIds.has(id))) fail('review-cases', rule.id, 'Reviewed rule has missing or unknown independent cases');
  }
  for (const activity of w.optionalActivities) if ((activity.kind === 'side-quest') !== activity.shortId.startsWith('SQ')) fail('activity-kind', activity.id, 'Optional identity belongs to a different activity kind');
  for (const room of w.rooms) {
    if (!sameSet(room.propIds, w.props.filter(p => p.allocation === room.shortId).map(p => p.id))) fail('prop-allocation', room.id, 'Room props differ from allocated identities');
    if (!sameSet(room.characterIds, w.characters.filter(c => c.roomIds.includes(room.id)).map(c => c.id))) fail('character-allocation', room.id, 'Character encounter locations disagree');
    if (!sameSet(room.safePositionIds, w.safePositions.filter(p => p.roomId === room.id).map(p => p.id))) fail('safe-position', room.id, 'Safe-position ownership differs');
  }
  for (const p of w.safePositions) if (!p.id.startsWith(`${p.roomId}.`)) fail('safe-position', p.id, 'Safe anchor ID belongs to a different room');
  if (!w.safePositions.some(p => p.id === w.initialLocation.safePositionId && p.roomId === w.initialLocation.roomId && p.eligibleStates.includes('stable-exploration'))) fail('initial-location', 'world/initialLocation', 'Initial location must name an explicit stable safe anchor');
  for (const o of w.objectives) {
    const rules = review.rules.filter(r => r.objectives.includes(o.shortId));
    if (!sameSet(o.ruleIds, rules.map(r => q(r.id))) || !sameSet(o.profileIds, [...new Set(rules.flatMap(r => r.profiles))])) fail('objective-review', o.id, 'Objective rule/profile coverage differs from review');
    const branch = w.branches.find(b => b.objectiveIds.includes(o.id));
    const role = branch ? 'route' : ['O01', 'O02'].includes(o.shortId) ? 'introduction' : ['O09', 'O10'].includes(o.shortId) ? 'common' : 'finale';
    if (o.role !== role || o.route !== (branch?.id ?? null) || o.roomId !== q(o.shortId.replace('O', 'R'))) fail('objective-allocation', o.id, 'Objective role/route/room disagrees');
    // Exhaustive twelve-objective truth table catches cycles, bypasses and altered
    // common prerequisites, independent of ordering or spelling of all/any trees.
    for (let mask = 0; mask < 4096; mask++) {
      const state = initialState();
      w.objectives.forEach((x, i) => { if (mask & (1 << i)) state.completed.add(x.id); });
      if (evaluate(o.prerequisite, state) !== expectedPrerequisite(o.shortId, state.completed)) { fail('quest-graph', o.id, 'Prerequisite changes the independently completable Spec001 graph'); break; }
    }
  }
  for (const edge of w.walkEdges) for (let mask = 0; mask < 4096; mask++) {
    const s = initialState(); w.objectives.forEach((o, i) => { if (mask & (1 << i)) s.completed.add(o.id); });
    const has = (id: string) => s.completed.has(q(id));
    const expected = edge.from === q('R02') ? has('O02') : edge.to === q('R11') ? (has('O04') || has('O06') || has('O08')) && has('O10') : edge.to === q('R12') ? has('O11') : true;
    if (evaluate(edge.forwardPrerequisite, s) !== expected) { fail('walk-prerequisite', `${edge.from}/${edge.to}`, 'Walk access changes the specified preparation/return graph'); break; }
  }
  const optionalState = initialState(); w.objectives.forEach(o => optionalState.completed.add(o.id));
  for (let pass = 0; pass < w.optionalActivities.length; pass++) for (const activity of w.optionalActivities) {
    if (evaluate(activity.prerequisite, optionalState)) optionalState.optional.add(activity.id);
  }
  for (const activity of w.optionalActivities) if (!optionalState.optional.has(activity.id)) fail('optional-cycle', activity.id, 'Optional activity prerequisites cannot be reached');
}

function checkRecord(r: S.authoredRecord, w: S.world, records: S.authoredRecord[], review: Review, fail: Fail): void {
  const sourceMap = new Map(review.sources.map(s => [q(s.id), s]));
  visit(r, (node, path) => {
    if (typeof node['sourceId'] === 'string') {
      const source = sourceMap.get(node['sourceId']);
      if (source && (node['section'] !== source.section || node['supportedClaim'] !== source.supportedClaim || !(node['limitations'] as string[]).includes(source.limits))) fail('source-claim', `${r.id}${path}`, 'Claim/section or retained limitations differ from reviewed source');
    }
    if (node['kind'] === 'unlock-ability' && !records.some(rec => rec.kind === 'character' && rec.id === node['characterId'] && rec.abilities.some(a => a.id === node['abilityId']))) fail('ability-owner', `${r.id}${path}`, 'Unlock effect targets an ability not owned by this character');
    if (node['kind'] === 'recruit-character' && !w.characters.some(c => c.id === node['characterId'] && c.recruitable)) fail('recruit-effect', `${r.id}${path}`, 'Effect recruits a non-recruitable character');
    if (node['kind'] === 'complete-objective' && ((r.kind === 'objective' && node['objectiveId'] !== r.id) || r.kind === 'quest' || r.kind === 'minigame')) fail('objective-effect', `${r.id}${path}`, 'Effect bypasses another mandatory objective');
  });
  if ('evidence' in r) for (const evidence of r.evidence) {
    // Dimensional outputs reviewed by T006. Source toy-level codes are never
    // persisted voltages; source Mb/s is an explicit runtime Mbps alias above.
    const units: Record<string, string[]> = {
      PHY01: ['count'], PHY02: ['count'], PHY03: ['count'], PHY04: ['m'], PHY05: ['count'],
      PHY06: ['dBm', 'dB'], PHY07: ['dBm', 'dB'], PHY08: ['W'], PHY09: ['Mbps'],
      PHY10: ['bit', 'symbol', 'count'], PHY11: ['bit', 'count'],
    };
    const allowed = evidence.ruleIds.flatMap(id => units[id.slice(8)] ?? []);
    if ((evidence.readings ?? []).some(reading => !allowed.includes(reading.unit))) fail('reading-unit', evidence.id, 'Reading unit is not an output dimension of its reviewed physical rule');
    if (evidence.kind === 'measurement' && (!evidence.readings?.length || !evidence.requiresFreshMeasurement)) fail('measurement-definition', evidence.id, 'Measurement must declare dimensions and freshness');
    if (r.kind === 'room' && evidence.roomId !== r.id) fail('evidence-room', evidence.id, 'Room evidence belongs to another room');
  }
  if ('ruleIds' in r && 'sourceClaims' in r) {
    const sourceIds = r.sourceClaims.map(c => c.sourceId);
    const required = review.rules.filter(rule => r.ruleIds.includes(q(rule.id))).flatMap(rule => rule.sources.map(q));
    if (required.some(id => !sourceIds.includes(id))) fail('source-coverage', r.id, 'Rule source coverage is incomplete');
  }
  if (r.kind === 'profile') {
    const p = review.profiles.find(p => p.id === r.reviewedProfileId);
    if (!p || r.id !== r.reviewedProfileId) fail('profile-review', r.id, 'Profile identity differs from review');
    else {
      if (!same(r.parameters, p.parameters) || r.model.label !== p.kind || !sameSet(r.model.assumptions, p.assumptions) || !sameSet(r.model.limitations, p.limits)) fail('profile-review', r.id, 'Parameters, units, model or limitations differ from reviewed profile');
      const rules = review.rules.filter(rule => rule.profiles.includes(p.id));
      if (!sameSet(r.ruleIds, rules.map(rule => q(rule.id))) || !sameSet(r.sourceClaims.map(c => c.sourceId), p.sources.map(q))) fail('profile-coverage', r.id, 'Profile sources/rules differ from review');
      const cases = new Set(rules.flatMap(rule => [...rule.correctCases, ...rule.incorrectCases, ...rule.boundaryCases, ...rule.invalidInputCases]));
      if (!sameSet(r.reviewedCaseIds, [...cases])) fail('profile-cases', r.id, 'Profile must retain independently reviewed correct/incorrect/boundary/invalid cases');
    }
  }
  if ('alternatives' in r) {
    for (const alt of r.alternatives) {
      if (!alt.ruleIds.every(id => r.ruleIds.includes(id)) || !alt.evidenceIds.every(id => records.some(rec => 'evidence' in rec && rec.evidence.some(e => e.id === id)))) fail('alternative-coverage', alt.id, 'Alternative lacks associated rule/evidence coverage');
      if (alt.method === 'ally-ability' && !alt.abilityIds.length) fail('equivalent', alt.id, 'Ally alternative has no ability');
      if (alt.method !== 'ally-ability' && alt.abilityIds.length) fail('equivalent', alt.id, 'Conventional/direct alternative depends on an ability');
      if (alt.method === 'conventional-tool' && !alt.itemIds.length) fail('equivalent', alt.id, 'Tool alternative names no tool');
    }
    for (const alt of r.alternatives.filter(a => a.method === 'ally-ability')) {
      const meaning = (effects: S.effect[]) => effects.map(({ effectId: _effectId, ...effect }) => effect);
      if (!r.alternatives.some(a => a.method !== 'ally-ability' && sameSet(a.ruleIds, alt.ruleIds) && sameSet(a.evidenceIds, alt.evidenceIds) && same(meaning(a.effects), meaning(alt.effects)))) fail('equivalent', alt.id, 'Ally route requires a conventional equivalent with the same checks/evidence/effects');
    }
  }
  if (r.kind === 'objective') {
    const meta = w.objectives.find(o => o.id === r.id)!;
    if (!sameSet(r.ruleIds, meta.ruleIds) || !sameSet(r.profileIds, meta.profileIds)) fail('objective-definition', r.id, 'Authored rule/profile definitions contradict registry');
    if (!r.effects.some(e => e.kind === 'complete-objective' && e.objectiveId === r.id)) fail('objective-effect', r.id, 'Completion must identify this objective');
  }
  if (r.kind === 'character') {
    if (r.recruitable !== w.characters.find(c => c.id === r.id)?.recruitable) fail('character-definition', r.id, 'Recruitability contradicts registry');
    if (new Set(r.progression.map(p => p.level)).size !== r.progression.length) fail('progression', r.id, 'Duplicate progression level');
    for (const p of r.progression) if (p.abilityIds.some(id => !r.abilities.some(a => a.id === id))) fail('ability-owner', r.id, 'Progression unlocks another character ability');
    for (const ability of r.abilities) for (const id of ability.conventionalEquivalentItemIds) {
      if (!records.some(item => item.kind === 'item' && item.id === id && item.verbs.includes('use'))) fail('equivalent', ability.id, 'Conventional equivalent must be an authored usable item');
    }
  }
  if (r.kind === 'room') checkRoom(r, w, fail);
  if (r.kind === 'dialogue') checkDialogue(r, fail);
  if (r.kind === 'item') {
    if ((r.consumption === 'never') !== (r.recovery.policy === 'not-consumed')) fail('item-recovery', r.id, 'Consumption and recovery policy disagree');
    const consumed = records.some(rec => { let found = false; visit(rec, n => { if (n['kind'] === 'consume-item' && n['itemId'] === r.id) found = true; }); return found; });
    if (consumed && r.consumption === 'never') fail('item-recovery', r.id, 'Never-consumed item has a consuming effect');
    for (const c of r.combinations) if (c.consumesInputs && (c.recovery.policy === 'not-consumed' || !c.effects.some(e => e.kind === 'grant-item'))) fail('item-recovery', c.id, 'Consuming transformation requires a result and real recovery policy');
    for (const c of r.combinations) if (c.consumesInputs && (r.consumption === 'never' || records.some(item => item.kind === 'item' && item.id === c.withItemId && item.consumption === 'never'))) fail('item-recovery', c.id, 'Transformation consumes a never-consumed input');
  }
}

function checkRoom(r: S.room, w: S.world, fail: Fail): void {
  const meta = w.rooms.find(x => x.id === r.id)!;
  if (!sameSet(r.safePositions.map(p => p.id), meta.safePositionIds)) fail('safe-position', r.id, 'Scene must map all and only its registered safe anchors');
  const targets = w.walkEdges.flatMap(e => e.from === r.id ? [e.to] : e.to === r.id ? [e.from] : []);
  if (!sameSet(r.exits.map(e => e.toRoomId), targets)) fail('room-exit', r.id, 'Scene exits must agree with walk graph');
  if (!sameSet(r.characterIds, meta.characterIds)) fail('character-allocation', r.id, 'Scene encounters must agree with registry');
  if (new Set(r.propInstances.map(p => p.instanceId)).size !== r.propInstances.length) fail('instance-id', r.id, 'Duplicate prop instance identity');
  for (const exit of r.exits) if (!r.walkRegions.some(region => region.id === exit.walkRegionId)) fail('room-exit', r.id, 'Exit references another room walk region');
  for (const region of r.walkRegions) if (!validPolygon(region.vertices)) fail('walk-region', region.id, 'Walk polygon is degenerate or self-intersecting');
  for (const anchor of r.safePositions) {
    const region = r.walkRegions.find(region => region.id === anchor.walkRegionId);
    if (!region || !inside(anchor.point, region.vertices)) fail('safe-geometry', anchor.id, 'Safe anchor lies outside its own valid walk region');
  }
  if (!sameSet(r.futureDoorIds, w.futureDoors.filter(d => d.roomId === r.id).map(d => d.id))) fail('future-door', r.id, 'Scene future boundaries differ from registry');
}
function cross(a: S.point, b: S.point, p: S.point): number { return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x); }
function onSegment(p: S.point, a: S.point, b: S.point): boolean { return cross(a, b, p) === 0 && p.x >= Math.min(a.x, b.x) && p.x <= Math.max(a.x, b.x) && p.y >= Math.min(a.y, b.y) && p.y <= Math.max(a.y, b.y); }
function validPolygon(v: S.point[]): boolean {
  if (new Set(v.map(p => `${p.x},${p.y}`)).size !== v.length) return false;
  let area = 0;
  for (let i = 0; i < v.length; i++) {
    const a = v[i]!, b = v[(i + 1) % v.length]!; area += a.x * b.y - b.x * a.y;
    for (let j = i + 2; j < v.length; j++) {
      if (i === 0 && j === v.length - 1) continue;
      const c = v[j]!, d = v[(j + 1) % v.length]!;
      if (onSegment(c, a, b) || onSegment(d, a, b) || onSegment(a, c, d) || onSegment(b, c, d) || (cross(a, b, c) * cross(a, b, d) < 0 && cross(c, d, a) * cross(c, d, b) < 0)) return false;
    }
  }
  return Number.isFinite(area) && area !== 0;
}
function inside(p: S.point, v: S.point[]): boolean {
  if (!validPolygon(v)) return false;
  let result = false;
  for (let i = 0, j = v.length - 1; i < v.length; j = i++) {
    const a = v[i]!, b = v[j]!;
    if (onSegment(p, a, b)) return true;
    if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) result = !result;
  }
  return result;
}
function checkDialogue(r: S.dialogue, fail: Fail): void {
  const nodes = new Map(r.nodes.map(n => [n.id, n]));
  const reached = new Set<string>(); const pending = [r.entryNodeId];
  while (pending.length) {
    const id = pending.pop()!; if (reached.has(id)) continue;
    const node = nodes.get(id);
    if (!node) { fail('dialogue-reference', r.id, 'Dialogue edge leaves its own node collection'); continue; }
    if (!terms(node.condition).length) continue;
    reached.add(id);
    for (const choice of node.choices) if (choice.nextNodeId && terms(choice.condition).length) pending.push(choice.nextNodeId);
  }
  if (reached.size !== nodes.size) fail('dialogue-reachability', r.id, 'Dialogue has unreachable nodes');
  const terminating = new Set(r.nodes.filter(n => !n.choices.length || n.choices.some(c => c.nextNodeId === null)).map(n => n.id));
  for (let pass = 0; pass < nodes.size; pass++) for (const n of r.nodes) if (n.choices.some(c => c.nextNodeId && terminating.has(c.nextNodeId))) terminating.add(n.id);
  if (r.nodes.some(n => !terminating.has(n.id))) fail('dialogue-cycle', r.id, 'Dialogue cycle has no exit');
}

/** Reject mandatory optional/item dependency cycles without making them gates
 * of the main story. Other predicates still require their ordinary schema,
 * reference, contradiction and authored runtime checks. */
function checkOptionalDependencies(w: S.world, records: S.authoredRecord[], fail: Fail): void {
  const optional = records.filter(r => r.kind === 'quest' || r.kind === 'minigame');
  const items = records.filter(r => r.kind === 'item');
  const available = new Set<string>();
  const possible = (condition: S.condition) => terms(condition).some(term => [...term].every(([atom, expected]) => {
    if (atom.startsWith('flag:')) return true;
    const c = JSON.parse(atom) as S.condition;
    const id = c.kind === 'quest-complete' ? c.questId : c.kind === 'minigame-complete' ? c.minigameId : c.kind === 'item-available' ? c.itemId : null;
    return id === null || available.has(id) === expected;
  }));
  for (let pass = 0; pass <= items.length + w.optionalActivities.length; pass++) {
    const count = available.size;
    for (const item of items) if (possible(item.acquisition.condition)) available.add(item.id);
    for (const meta of w.optionalActivities) {
      const authored = optional.find(o => o.id === meta.id);
      if (!possible(meta.prerequisite) || (authored && (!possible(authored.prerequisite) || !authored.alternatives.some(a => possible(a.condition) && a.itemIds.every(id => available.has(id)))))) continue;
      available.add(meta.id);
      if (authored) for (const effect of authored.effects) if (effect.kind === 'grant-item') available.add(effect.itemId);
    }
    if (available.size === count) break;
  }
  for (const record of optional) if (!available.has(record.id)) fail('optional-cycle', record.id, 'Authored optional prerequisites have no available dependency path');
}

interface ProofState extends State {
  acquired: Set<string>;
  applied: Set<string>;
  dialogue: { id: string; nodeId: string } | null;
  recoveries: Map<string, S.recovery>;
}
const MAX_PROOF_STATES = 4096;
function proofKey(s: ProofState): string {
  const entries = <T>(map: Map<string, T>) => [...map].sort(([a], [b]) => a.localeCompare(b));
  return canonical([[...s.completed].sort(), entries(s.items), entries(s.flags), [...s.acquired].sort(), [...s.applied].sort(), s.dialogue, entries(s.recoveries)]);
}
function copyProof(s: ProofState): ProofState {
  return { completed: new Set(s.completed), items: new Map(s.items), flags: new Map(s.flags), recruits: new Set(s.recruits), optional: new Set(s.optional), acquired: new Set(s.acquired), applied: new Set(s.applied), dialogue: s.dialogue ? { ...s.dialogue } : null, recoveries: new Map(s.recoveries) };
}
/** Apply one atomic authored choice to a private successor, never a union of histories. */
function effectSuccessor(s: ProofState, effects: S.effect[], route: string): ProofState | null {
  const next = copyProof(s);
  const once = [...new Map(effects.filter(e => !s.applied.has(e.effectId)).map(e => [e.effectId, e])).values()];
  const consumption = new Map<string, number>();
  for (const e of once) {
    if (e.kind === 'set-route' && e.route !== route) return null;
    if (e.kind === 'consume-item') consumption.set(e.itemId, (consumption.get(e.itemId) ?? 0) + e.quantity);
  }
  if ([...consumption].some(([id, quantity]) => (s.items.get(id) ?? 0) < quantity)) return null;
  for (const [id, quantity] of consumption) { next.items.set(id, (s.items.get(id) ?? 0) - quantity); next.recoveries.delete(id); }
  for (const e of once) {
    next.applied.add(e.effectId);
    if (e.kind === 'grant-item') {
      const quantity = (next.items.get(e.itemId) ?? 0) + e.quantity;
      if (quantity > 999) return null;
      next.items.set(e.itemId, quantity); next.acquired.add(e.itemId); next.recoveries.delete(e.itemId);
    }
    if (e.kind === 'set-flag') next.flags.set(e.flagId, e.value);
    // Objective completion is controlled by its verified transition below.
    // Optional rewards/recruitment never enable an independent ordinary route.
  }
  return next;
}
function reachableRooms(w: S.world, s: State): Set<string> {
  const rooms = new Set([w.initialLocation.roomId]);
  for (let pass = 0; pass < w.rooms.length; pass++) for (const edge of w.walkEdges) {
    if (rooms.has(edge.from) && evaluate(edge.forwardPrerequisite, s)) rooms.add(edge.to);
    if (rooms.has(edge.to)) rooms.add(edge.from);
  }
  return rooms;
}
function checkRoutes(w: S.world, records: S.authoredRecord[], fail: Fail): string[] {
  const success: string[] = [];
  const objectives = new Map(records.filter(r => r.kind === 'objective').map(r => [r.id, r]));
  const items = records.filter(r => r.kind === 'item');
  const dialogues = new Map(records.filter(r => r.kind === 'dialogue').map(r => [r.id, r]));
  const characters = records.filter(r => r.kind === 'character');
  for (const branch of w.branches) {
    const allowed = new Set([q('O01'), q('O02'), ...branch.objectiveIds, q('O09'), q('O10'), q('O11'), q('O12')]);
    const relevantItems = new Set(items.filter(i => i.essentialForRoutes.includes(branch.id)).map(i => i.id));
    const collectItems = (data: unknown) => visit(data, node => {
      for (const field of ['itemId', 'itemIds', 'withItemId']) {
        const value = node[field];
        for (const id of Array.isArray(value) ? value : [value]) if (typeof id === 'string') relevantItems.add(id);
      }
    });
    for (const [id, objective] of objectives) if (allowed.has(id)) collectItems(objective);
    for (const dialogue of dialogues.values()) collectItems(dialogue);
    // Include transitive acquisition/recovery/combination prerequisites.
    for (let pass = 0; pass < items.length; pass++) {
      const count = relevantItems.size;
      items.filter(i => relevantItems.has(i.id)).forEach(collectItems);
      if (relevantItems.size === count) break;
    }
    const initial: ProofState = { ...initialState(), acquired: new Set(), applied: new Set(), dialogue: null, recoveries: new Map() };
    const queue: ProofState[] = [initial];
    const visited = new Set([proofKey(initial)]);
    const obtained = new Set<string>();
    let completed = false;
    let bounded = false;
    const enqueue = (state: ProofState | null) => {
      if (!state || bounded) return;
      const key = proofKey(state);
      if (visited.has(key)) return;
      if (visited.size >= MAX_PROOF_STATES) { bounded = true; return; }
      visited.add(key); queue.push(state);
    };
    for (let cursor = 0; cursor < queue.length && !bounded; cursor++) {
      const s = queue[cursor]!;
      const rooms = reachableRooms(w, s);
      for (const [id, quantity] of s.items) if (quantity > 0) obtained.add(id);
      if (s.completed.has(q('O12'))) completed = true;
      // A conversation is an explicit sequence, with its own current node and
      // exactly-once effects. It cannot merge choices from separate histories.
      if (s.dialogue) {
        const dialogue = dialogues.get(s.dialogue.id);
        const node = dialogue?.nodes.find(n => n.id === s.dialogue!.nodeId);
        if (!dialogue || !node) continue; // Reference diagnostics already explain this.
        for (const choice of node.choices) if (evaluate(choice.condition, s)) {
          let next = effectSuccessor(s, choice.effects, branch.id);
          if (!next) continue;
          if (choice.nextNodeId === null) next.dialogue = null;
          else {
            const target = dialogue.nodes.find(n => n.id === choice.nextNodeId);
            if (!target || !evaluate(target.condition, next)) continue;
            next = effectSuccessor(next, target.effects, branch.id);
            if (!next) continue;
            next.dialogue = target.choices.length ? { id: dialogue.id, nodeId: target.id } : null;
          }
          enqueue(next);
        }
        continue;
      }
      for (const item of items.filter(i => relevantItems.has(i.id))) {
        if (!s.acquired.has(item.id) && rooms.has(item.acquisition.roomId) && evaluate(item.acquisition.condition, s)) {
          const next = copyProof(s); next.acquired.add(item.id); next.items.set(item.id, 1); enqueue(next);
        }
        // Pickup is one-time. A consumed item returns only via its explicitly
        // authored recovery policy, room and currently satisfied condition.
        const recovery = s.recoveries.get(item.id) ?? item.recovery;
        if (s.acquired.has(item.id) && (s.items.get(item.id) ?? 0) === 0 && recovery.policy !== 'not-consumed' && rooms.has(recovery.roomId) && evaluate(recovery.condition, s)) {
          const next = copyProof(s); next.items.set(item.id, 1); next.recoveries.delete(item.id); enqueue(next);
        }
        if ((s.items.get(item.id) ?? 0) > 0) for (const combination of item.combinations) {
          const completion = `combination:${combination.id}`;
          if (s.applied.has(completion) || (s.items.get(combination.withItemId) ?? 0) < 1 || !evaluate(combination.condition, s)) continue;
          const next = effectSuccessor(s, combination.effects, branch.id);
          if (!next) continue;
          if (combination.consumesInputs) {
            // consumesInputs is the transformation contract; explicit consume
            // effects for these inputs must agree rather than double-consuming.
            const ids = [item.id, combination.withItemId];
            const needed = new Map<string, number>();
            for (const id of ids) needed.set(id, (needed.get(id) ?? 0) + 1);
            if ([...needed].some(([id, quantity]) => (s.items.get(id) ?? 0) < quantity)) continue;
            for (const [id, quantity] of needed) if (!combination.effects.some(e => e.kind === 'consume-item' && e.itemId === id)) next.items.set(id, (next.items.get(id) ?? 0) - quantity);
            for (const id of needed.keys()) if ((next.items.get(id) ?? 0) === 0) next.recoveries.set(id, combination.recovery);
          }
          next.applied.add(completion);
          enqueue(next);
        }
      }
      for (const character of characters) {
        const meta = w.characters.find(c => c.id === character.id);
        if (!meta?.roomIds.some(id => rooms.has(id))) continue;
        for (const id of character.dialogueIds) {
          const dialogue = dialogues.get(id); const node = dialogue?.nodes.find(n => n.id === dialogue.entryNodeId);
          if (!dialogue || !node || !evaluate(node.condition, s)) continue;
          const next = effectSuccessor(s, node.effects, branch.id);
          if (next) { next.dialogue = node.choices.length ? { id, nodeId: node.id } : null; enqueue(next); }
        }
      }
      // Enumerating every eligible objective preserves valid orderings of the
      // common preparation steps and each concrete conventional alternative.
      for (const meta of w.objectives) {
        if (!allowed.has(meta.id) || s.completed.has(meta.id) || !rooms.has(meta.roomId) || !evaluate(meta.prerequisite, s)) continue;
        const authored = objectives.get(meta.id);
        if (!authored) { const next = copyProof(s); next.completed.add(meta.id); enqueue(next); continue; }
        if (!evaluate(authored.prerequisite, s)) continue;
        for (const alternative of authored.alternatives) {
          if (alternative.method === 'ally-ability' || alternative.abilityIds.length || alternative.itemIds.some(id => (s.items.get(id) ?? 0) < 1) || !evaluate(alternative.condition, s)) continue;
          const next = effectSuccessor(s, [...alternative.effects, ...authored.effects], branch.id);
          if (next) { next.completed.add(meta.id); enqueue(next); }
        }
      }
    }
    if (bounded) { fail('graph-bounds', branch.id, `Concrete-state analysis exceeded ${MAX_PROOF_STATES} states; reachability is unproved`); continue; }
    if (!completed) fail('route-unreachable', branch.id, 'No concrete ordinary path completes this branch without optional rewards, other branch objectives, allies or future content');
    else success.push(branch.id);
    for (const item of items.filter(i => i.essentialForRoutes.includes(branch.id))) {
      if (!obtained.has(item.id)) fail('item-recovery', item.id, `Essential ${branch.id} item cannot be acquired`);
      // Every reachable loss state must have an explicit recovery operation now;
      // a future ending, another lost item, or a declaration alone is insufficient.
      for (const s of queue) if (s.acquired.has(item.id) && (s.items.get(item.id) ?? 0) === 0) {
        const recovery = s.recoveries.get(item.id) ?? item.recovery;
        if (recovery.policy === 'not-consumed' || !reachableRooms(w, s).has(recovery.roomId) || !evaluate(recovery.condition, s)) {
          fail('item-recovery', item.id, 'A reachable loss has no available explicit recovery'); break;
        }
      }
      // Also reject an intrinsically circular authored recovery declaration,
      // even when current content happens never to consume this essential item.
      if (obtained.has(item.id) && !queue.some(s => {
        if (!s.acquired.has(item.id)) return false;
        const lost = copyProof(s); lost.items.set(item.id, 0);
        return reachableRooms(w, lost).has(item.recovery.roomId) && evaluate(item.recovery.condition, lost);
      })) fail('item-recovery', item.id, 'Essential recovery depends on the lost item or unavailable state');
    }
  }
  return success;
}
