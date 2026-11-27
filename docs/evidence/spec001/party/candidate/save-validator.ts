// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import validateSchema from '../../../../../src/services/save-schema.generated.js';
import type { ContentRegistry } from '../../../../../src/content/registry';
import type * as S from '../../../../../src/content/schema-types.generated';
import type { RuntimeState, SaveSnapshotV1, SafeState, FlagValue } from '../../../../../src/state/types';

export const SAVE_MAX_BYTES = 262144;
export const SAVE_MAX_NOTE_CODEPOINTS = 4096;
const MAX_JSON_DEPTH = 32;
const safeStates: readonly string[] = ['stable-exploration', 'safe-preparation', 'safe-continue'];
export type SaveMemberKind = 'room' | 'objective' | 'quest' | 'achievement' | 'effect' | 'item' | 'character'
  | 'ability' | 'flag' | 'compendium' | 'fact' | 'hint' | 'rule' | 'subject' | 'caveat';
const kinds: readonly SaveMemberKind[] = ['room', 'objective', 'quest', 'achievement', 'effect', 'item', 'character', 'ability', 'flag', 'compendium', 'fact', 'hint', 'rule', 'subject', 'caveat'];
/** Monotonic completion dependencies only. Never re-evaluate consumed-item or transient prerequisites. */
export type CompletionDependency = { kind: 'always' } | { kind: 'objective-complete'; objectiveId: string }
  | { kind: 'all' | 'any'; conditions: readonly CompletionDependency[] };
export interface MeasurementRulePolicy {
  readings: Record<string, string>;
  conclusionCodes: readonly string[];
}
/** Trusted version-specific policy, passed explicitly, never read from a save body. */
export interface SaveContentPolicy {
  contentVersion: string;
  members: Record<SaveMemberKind, readonly string[]>;
  safePositions: Record<string, { roomId: string; eligibleStates: readonly SafeState[] }>;
  itemMaxQuantities: Record<string, number>;
  recruits: Record<string, { maxLevel: number; abilityIds: readonly string[]; progressFlagIds: readonly string[]; abilityIdsByLevel: Readonly<Record<string, readonly string[]>> }>;
  hints: Record<string, { objectiveId: string; level: number }>;
  objectivePrerequisites: Record<string, CompletionDependency>;
  measurementRules: Record<string, MeasurementRulePolicy>;
  unsafeFlags: Record<string, readonly FlagValue[]>;
}
export type SaveValidationCode = 'body-too-large' | 'json' | 'schema' | 'content-version' | 'reference'
  | 'safe-state' | 'relationship' | 'objective' | 'measurement';
export type SaveValidationResult =
  | { readonly ok: false; readonly provisional: true; readonly code: SaveValidationCode; readonly path: string }
  | { readonly ok: true; readonly provisional: true; readonly candidate: SaveSnapshotV1; readonly json: string };
const fail = (code: SaveValidationCode, path = ''): SaveValidationResult => ({ ok: false, provisional: true, code, path });
const own = <T>(map: Readonly<Record<string, T>>, key: string): T | undefined => Object.hasOwn(map, key) ? map[key] : undefined;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function wellFormed(value: string): boolean {
  return !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(value);
}
/** Matches PHP's bounded decode; inspect lexical nesting before parsing untrusted JSON. */
function boundedDepth(text: string): boolean {
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') { if (++depth >= MAX_JSON_DEPTH) return false; }
    else if (char === '}' || char === ']') depth--;
  }
  return true;
}
function scalars(value: unknown): 'json' | 'schema' | null {
  if (typeof value === 'number') return Number.isFinite(value) ? null : 'schema';
  if (typeof value === 'string') return wellFormed(value) ? null : 'json';
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      // PHP's stdClass decoder rejects a property beginning with NUL.
      if (!wellFormed(key) || key.startsWith('\0')) return 'json';
      const issue = scalars(child); if (issue) return issue;
    }
  }
  return null;
}
function complete(condition: CompletionDependency, ids: readonly string[]): boolean {
  switch (condition.kind) {
    case 'always': return true;
    case 'objective-complete': return ids.includes(condition.objectiveId);
    case 'all': return condition.conditions.every(c => complete(c, ids));
    case 'any': return condition.conditions.some(c => complete(c, ids));
    default: return false;
  }
}

/**
 * New writes only. No HTTP, storage, receipt, authorization, migration or reset.
 * T043 must check authorized receipts BEFORE calling this and again inside its
 * final transaction BEFORE acting on any provisional failure. Keep raw bytes
 * for fingerprints/retries; candidate JSON is never reserialized here.
 */
export class SaveValidator {
  private readonly policies: readonly SaveContentPolicy[];
  constructor(policies: readonly SaveContentPolicy[]) {
    if (new Set(policies.map(p => p.contentVersion)).size !== policies.length) throw new Error('Duplicate save policy version');
    for (const policy of policies) for (const expression of Object.values(policy.objectivePrerequisites)) checkDependency(expression);
    this.policies = freeze(structuredClone(policies));
  }

  validateStructure(bytes: Uint8Array): SaveValidationResult {
    if (bytes.byteLength > SAVE_MAX_BYTES) return fail('body-too-large');
    let json: string, candidate: unknown;
    try {
      json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if (!boundedDepth(json)) return fail('json');
      candidate = JSON.parse(json);
    } catch { return fail('json'); }
    const invalidScalar = scalars(candidate);
    if (invalidScalar) return fail(invalidScalar);
    if (!validateSchema(candidate)) return fail('schema');
    return { ok: true, provisional: true, candidate: freeze(candidate as SaveSnapshotV1), json };
  }

  validateNewWrite(bytes: Uint8Array): SaveValidationResult {
    const structural = this.validateStructure(bytes);
    if (!structural.ok) return structural;
    const s = structural.candidate, w = s.world, n = s.notebook;
    const p = this.policies.find(policy => policy.contentVersion === s.contentVersion);
    if (!p) return fail('content-version', '/contentVersion');
    const has = (kind: SaveMemberKind, id: string) => p.members[kind].includes(id);
    const refs: [SaveMemberKind, readonly string[], string][] = [
      ['room', [w.roomId], '/world/roomId'], ['objective', w.completedObjectiveIds, '/world/completedObjectiveIds'],
      ['quest', w.completedQuestIds, '/world/completedQuestIds'], ['achievement', w.achievementIds, '/world/achievementIds'],
      ['effect', w.dialogueEffectIds, '/world/dialogueEffectIds'], ['flag', Object.keys(w.flags), '/world/flags'],
      ['item', w.inventory.map(r => r.itemId), '/world/inventory'], ['character', w.recruits.map(r => r.characterId), '/world/recruits'],
      ['character', w.activeAllyIds, '/world/activeAllyIds'], ['compendium', w.compendiumIds, '/world/compendiumIds'],
      ['fact', n.factIds, '/notebook/factIds'], ['room', n.mapRoomIds, '/notebook/mapRoomIds'],
    ];
    w.recruits.forEach((r, i) => refs.push(['ability', r.abilityIds, `/world/recruits/${i}/abilityIds`], ['flag', r.progressFlags, `/world/recruits/${i}/progressFlags`]));
    n.hypotheses.forEach((r, i) => refs.push(['subject', r.subjectIds, `/notebook/hypotheses/${i}/subjectIds`]));
    n.measurements.forEach((r, i) => refs.push(['rule', [r.ruleId], `/notebook/measurements/${i}/ruleId`], ['room', [r.roomId], `/notebook/measurements/${i}/roomId`], ['subject', r.subjectIds, `/notebook/measurements/${i}/subjectIds`]));
    s.assistance.forEach((r, i) => refs.push(['objective', [r.objectiveId], `/assistance/${i}/objectiveId`], ['hint', [r.hintId], `/assistance/${i}/hintId`]));
    s.outcomeHistory.forEach((r, i) => refs.push(['caveat', r.caveatIds, `/outcomeHistory/${i}/caveatIds`]));
    for (const [kind, ids, path] of refs) if (ids.some(id => !has(kind, id))) return fail('reference', path);
    const anchor = own(p.safePositions, w.position.safePositionId);
    if (!anchor || anchor.roomId !== w.roomId || !anchor.eligibleStates.includes(s.safeState)
      || (w.continueOutcome !== null && s.safeState !== 'safe-continue')) return fail('safe-state', '/world/position');
    for (const [id, value] of Object.entries(w.flags)) if (own(p.unsafeFlags, id)?.includes(value)) return fail('safe-state', '/world/flags');
    const unique: [readonly string[], string][] = [
      [w.inventory.map(r => r.itemId), '/world/inventory'], [w.recruits.map(r => r.characterId), '/world/recruits'],
      [n.hypotheses.map(r => r.id.toLowerCase()), '/notebook/hypotheses'], [n.measurements.map(r => r.id.toLowerCase()), '/notebook/measurements'],
      [s.outcomeHistory.map(r => r.id.toLowerCase()), '/outcomeHistory'],
    ];
    for (const [ids, path] of unique) if (new Set(ids).size !== ids.length) return fail('relationship', path);
    for (const item of w.inventory) {
      const max = own(p.itemMaxQuantities, item.itemId);
      if (max === undefined || item.quantity > max) return fail('relationship', '/world/inventory');
    }
    for (const recruit of w.recruits) {
      const allowed = own(p.recruits, recruit.characterId);
      const levelAbilities = allowed?.abilityIdsByLevel && own(allowed.abilityIdsByLevel, String(recruit.level));
      if (!allowed || recruit.level > allowed.maxLevel || !Array.isArray(levelAbilities)
        || recruit.abilityIds.length !== levelAbilities.length || recruit.abilityIds.some(id => !levelAbilities.includes(id))
        || recruit.abilityIds.some(id => !allowed.abilityIds.includes(id))
        || recruit.progressFlags.some(id => !allowed.progressFlagIds.includes(id))) return fail('relationship', '/world/recruits');
    }
    if (w.activeAllyIds.some(id => !w.recruits.some(r => r.characterId === id))) return fail('relationship', '/world/activeAllyIds');
    for (const hint of s.assistance) {
      const allowed = own(p.hints, hint.hintId);
      if (!allowed || hint.objectiveId !== allowed.objectiveId || hint.level !== allowed.level) return fail('relationship', '/assistance');
    }
    for (const id of w.completedObjectiveIds) {
      const dependency = own(p.objectivePrerequisites, id);
      if (!dependency || !complete(dependency, w.completedObjectiveIds)) return fail('objective', '/world/completedObjectiveIds');
    }
    for (const measurement of n.measurements) {
      const rule = own(p.measurementRules, measurement.ruleId);
      if (!rule || !rule.conclusionCodes.includes(measurement.conclusionCode)
        || measurement.readings.some(reading => own(rule.readings, reading.name) !== reading.unit)
        || new Set(measurement.readings.map(r => r.name)).size !== measurement.readings.length
        || (!measurement.stale && (measurement.configurationRevision !== w.configurationRevision || measurement.attemptId.toLowerCase() !== w.attemptId.toLowerCase()))) {
        return fail('measurement', '/notebook/measurements');
      }
    }
    return structural;
  }

  /** Uses actual caller runtime activity, never an invented server observation. */
  validateRuntime(runtime: Pick<RuntimeState, 'game' | 'activity'>): SaveValidationResult {
    if (!runtime.game || !runtime.activity || !safeStates.includes(runtime.activity.kind)) return fail('safe-state', '/activity');
    try {
      const game = runtime.game;
      const snapshot = { saveSchemaVersion: 1, safeState: runtime.activity.kind, contentVersion: game.contentVersion,
        episodeId: game.episodeId, adventureId: game.adventureId, world: game.world, notebook: game.notebook,
        assistance: game.assistance, outcomeHistory: game.outcomeHistory };
      // JSON.stringify replaces nonfinite numbers and drops undefined. Reject
      // those non-JSON runtime inputs before serialization instead of normalizing.
      if (!runtimeJSON(snapshot)) return fail('json');
      return this.validateNewWrite(new TextEncoder().encode(JSON.stringify(snapshot)));
    } catch { return fail('json'); }
  }
}

function runtimeJSON(value: unknown, seen = new Set<object>(), depth = 0): boolean {
  if (depth >= MAX_JSON_DEPTH) return false;
  if (value === null || typeof value === 'boolean') return true;
  if (typeof value === 'string') return wellFormed(value);
  if (typeof value === 'number') return Number.isFinite(value);
  if (typeof value !== 'object' || seen.has(value)) return false;
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return false;
  seen.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Object.getOwnPropertySymbols(value).length) return false;
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!wellFormed(key) || !('value' in descriptor) || (!descriptor.enumerable && !(Array.isArray(value) && key === 'length'))
      || !runtimeJSON(descriptor.value, seen, depth + 1)) return false;
  }
  seen.delete(value);
  return true;
}

function checkDependency(value: CompletionDependency, depth = 0): void {
  if (depth > 16 || !value || typeof value !== 'object') throw new Error('Invalid save completion policy');
  if (value.kind === 'always') return;
  if (value.kind === 'objective-complete' && typeof value.objectiveId === 'string') return;
  if ((value.kind === 'all' || value.kind === 'any') && Array.isArray(value.conditions) && value.conditions.length > 0 && value.conditions.length <= 64) {
    value.conditions.forEach(c => checkDependency(c, depth + 1)); return;
  }
  throw new Error('Unsupported save completion policy');
}

export interface SavePolicyRules {
  /** Quantities and measurement semantics are reviewed inputs, not inferred prose. */
  itemMaxQuantities: SaveContentPolicy['itemMaxQuantities'];
  measurementRules: SaveContentPolicy['measurementRules'];
  unsafeFlags: SaveContentPolicy['unsafeFlags'];
  /** Explicit reviewed caveats must resolve to loaded authored evidence facts. */
  caveatFactIds?: readonly string[];
}

/**
 * Bridge an already validated ContentRegistry into portable JSON for either runtime.
 * Metadata reserves identities; only authored rooms/anchors/objectives/items can be
 * current progress. Missing definitions never become permissions. Achievement
 * membership stays empty; caveats require an explicit reviewed authored-fact map.
 */
export function createSaveContentPolicy(registry: ContentRegistry, world: Readonly<S.world>, rules: SavePolicyRules): SaveContentPolicy {
  const members = Object.fromEntries(kinds.map(kind => [kind, []])) as unknown as SaveContentPolicy['members'];
  const p: SaveContentPolicy = { contentVersion: world.contentVersion, members, safePositions: {}, itemMaxQuantities: {}, recruits: {}, hints: {}, objectivePrerequisites: {}, measurementRules: {}, unsafeFlags: {} };
  const add = (kind: SaveMemberKind, id: string, registryKind: string = kind) => {
    if (!registry.has(registryKind, id)) throw new Error('Save policy references unregistered content');
    const values = p.members[kind] as string[];
    if (!values.includes(id)) values.push(id);
  };
  // Subject identities may legitimately refer to metadata characters/props; a
  // recruit or current room requires a stronger authored definition below.
  for (const [kind, rows] of [['room', world.rooms], ['character', world.characters], ['prop', world.props]] as const) {
    for (const row of rows) add('subject', row.id, kind);
  }
  for (const row of world.reviewedRegistry.rules) add('rule', row.id);
  for (const id of world.reviewedRegistry.profileIds) add('subject', id, 'profile');
  for (const row of world.objectives) add('subject', row.id, 'objective');
  const records = world.documents.map(ref => registry.record(ref.id));
  if (records.some(record => !record || record.contentVersion !== world.contentVersion)) throw new Error('Incomplete save policy registry');
  const dependency = (condition: S.condition): CompletionDependency => {
    if (condition.kind === 'always' || condition.kind === 'objective-complete') return structuredClone(condition);
    if (condition.kind === 'all' || condition.kind === 'any') return { kind: condition.kind, conditions: condition.conditions.map(dependency) };
    throw new Error('Save completion policy requires an explicitly reviewed monotonic dependency');
  };
  const visit = (value: unknown): void => {
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (typeof node['effectId'] === 'string') add('effect', node['effectId']);
    if (node['kind'] === 'set-flag' && typeof node['flagId'] === 'string') add('flag', node['flagId']);
    Object.values(value).forEach(visit);
  };
  for (const record of records) {
    if (!record) throw new Error('Missing save policy record');
    if ('evidence' in record) for (const fact of record.evidence) add('fact', fact.id);
    visit(record);
    if (record.kind === 'room') {
      add('room', record.id);
      for (const anchor of record.safePositions) {
        const meta = registry.safePosition(anchor.id);
        if (!meta || meta.roomId !== record.id) throw new Error('Unregistered authored save position');
        p.safePositions[anchor.id] = { roomId: record.id, eligibleStates: [...meta.eligibleStates] };
      }
    }
    if (record.kind === 'objective') {
      add('objective', record.id);
      const meta = world.objectives.find(o => o.id === record.id);
      if (!meta) throw new Error('Missing objective metadata');
      // Check BOTH declarations; silently dropping a stronger authored prerequisite
      // would grant unsupported completion. Alternative solutions are not regraded.
      p.objectivePrerequisites[record.id] = { kind: 'all', conditions: [dependency(meta.prerequisite), dependency(record.prerequisite)] };
      for (const [index, hint] of [record.hints.method, record.hints.workedStep, record.hints.solution].entries()) {
        add('hint', hint.id); p.hints[hint.id] = { objectiveId: record.id, level: index + 1 };
      }
    }
    if (record.kind === 'quest') add('quest', record.id);
    if (record.kind === 'item') { add('item', record.id); add('subject', record.id, 'item'); }
    if (record.kind === 'character') {
      add('compendium', record.compendium.id);
      if (record.recruitable) {
        add('character', record.id);
        record.abilities.forEach(ability => add('ability', ability.id));
        // A level is an explicit authored cumulative unlock set, not permission
        // to carry every ability that this character may eventually learn.
        const levels = [...record.progression].sort((a, b) => a.level - b.level);
        if (!levels.length || levels.some((entry, index) => entry.level !== index + 1
          || !entry.abilityIds.length || new Set(entry.abilityIds).size !== entry.abilityIds.length
          || entry.abilityIds.some(id => !record.abilities.some(ability => ability.id === id)))) {
          throw new Error('Recruit save policy requires consecutive explicit levels and owned ability unlocks');
        }
        const abilityIdsByLevel: Record<string, readonly string[]> = {}, unlocked: string[] = [];
        for (const entry of levels) {
          if (entry.abilityIds.every(id => unlocked.includes(id))) throw new Error('Recruit progression must unlock a new authored ability');
          for (const id of entry.abilityIds) if (!unlocked.includes(id)) unlocked.push(id);
          abilityIdsByLevel[String(entry.level)] = [...unlocked];
        }
        if (record.abilities.some(ability => !unlocked.includes(ability.id))) throw new Error('Recruit save policy cannot authorize an ability without an authored level');
        p.recruits[record.id] = { maxLevel: levels.at(-1)!.level, abilityIds: record.abilities.map(a => a.id), progressFlagIds: [], abilityIdsByLevel };
      }
    }
  }
  for (const [id, max] of Object.entries(rules.itemMaxQuantities)) {
    if (!p.members.item.includes(id) || !Number.isInteger(max) || max < 1 || max > 99) throw new Error('Invalid reviewed item quantity policy');
    p.itemMaxQuantities[id] = max;
  }
  for (const [id, rule] of Object.entries(rules.measurementRules)) {
    if (!p.members.rule.includes(id)) throw new Error('Unregistered measurement policy');
    p.measurementRules[id] = structuredClone(rule);
  }
  for (const [id, values] of Object.entries(rules.unsafeFlags)) {
    if (!p.members.flag.includes(id)) throw new Error('Unregistered unsafe marker policy');
    p.unsafeFlags[id] = [...values];
  }
  const caveats = rules.caveatFactIds ?? [];
  if (!Array.isArray(caveats) || new Set(caveats).size !== caveats.length) throw new Error('Invalid reviewed caveat fact policy');
  for (const id of caveats) {
    // Registry metadata alone is insufficient: the actual loaded authored
    // evidence must have contributed this fact through the loop above.
    if (typeof id !== 'string' || !p.members.fact.includes(id)) throw new Error('Caveat policy requires a loaded authored fact');
    add('caveat', id, 'fact');
  }
  return freeze(p);
}
