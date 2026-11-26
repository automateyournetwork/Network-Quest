// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { SAVE_MAX_BYTES, SaveValidator } from '../services/save-validator';
import type { SaveContentPolicy, SaveValidationCode } from '../services/save-validator';
import type { ConfigurationRevision, ContentVersion, RoomId, SafePositionId } from '../domain/types';
import type { SaveSnapshotV1 } from './types';

/** Trusted release declaration. Never derive permissions or mappings from saves. */
export interface SaveMigration {
  fromVersion: string;
  toVersion: string;
  /** Qualified identity references only; prose/UUIDs/opaque values stay untouched. */
  renamedIds: Record<string, string>;
  relocatedPositions: Record<string, { roomId: string; safePositionId: string }>;
  changesConfiguration: boolean;
  explanation: string;
}
export interface SaveReaderOptions {
  currentContentVersion: string;
  /** Explicit historical read policies, distinct from current new-write policy. */
  readPolicies: readonly SaveContentPolicy[];
  migrations: readonly SaveMigration[];
}
interface PreservedBytes { readonly originalBytes: readonly number[] }
interface BlockedRead extends PreservedBytes {
  readonly canReplace: false;
  readonly canAutosave: false;
}
export type SaveReadResult =
  | (PreservedBytes & { readonly status: 'ready'; readonly snapshot: SaveSnapshotV1; readonly migrated: boolean; readonly explanations: readonly string[] })
  | (BlockedRead & { readonly status: 'unsupported'; readonly reason: 'schema-version' | 'content-version' | 'migration-unavailable'; readonly updateNeeded: true })
  | (BlockedRead & { readonly status: 'invalid'; readonly code: SaveValidationCode; readonly path: string })
  | (BlockedRead & { readonly status: 'migration-failed'; readonly code: SaveValidationCode | 'generation-exhausted' | 'mapping-collision'; readonly path: string })
  | (BlockedRead & { readonly status: 'interrupted' });

const qualified = /^spec[0-9]{3}:[A-Za-z0-9][A-Za-z0-9._-]{0,55}$/;
const contentVersion = /^[0-9]+\.[0-9]+\.[0-9]+$/;
const maxRevision = 2_147_483_647;
const own = <T>(map: Readonly<Record<string, T>>, key: string): T | undefined => Object.hasOwn(map, key) ? map[key] : undefined;
function freeze<T>(value: T): T {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function boundedDepth(text: string): boolean {
  let depth = 0, quoted = false, escaped = false;
  for (const char of text) {
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
    } else if (char === '"') quoted = true;
    else if (char === '{' || char === '[') { if (++depth >= 32) return false; }
    else if (char === '}' || char === ']') depth--;
  }
  return true;
}

/**
 * Pure, synchronous, all-or-nothing reader. Call with the exact UTF-8 snapshot
 * slice from GET (T047 snapshotJson), never reserialize its unknown parsed object.
 * No storage/default reset/fallback to empty game and no production migrations
 * are implied: release composition must explicitly supply reviewed definitions.
 * Supported historical policies validate their own version before a migration;
 * each target is validated before it can feed another step or leave this reader.
 */
export class SaveReader {
  private readonly currentVersion: string;
  private readonly validators = new Map<string, SaveValidator>();
  private readonly migrations = new Map<string, Readonly<SaveMigration>>();

  constructor(options: SaveReaderOptions) {
    const config = structuredClone(options);
    this.currentVersion = config.currentContentVersion;
    for (const policy of config.readPolicies) {
      if (policy.contentVersion.length > 32 || !contentVersion.test(policy.contentVersion) || this.validators.has(policy.contentVersion)) throw new TypeError('Duplicate or invalid read policy version');
      this.validators.set(policy.contentVersion, new SaveValidator([policy]));
    }
    if (!this.validators.has(this.currentVersion)) throw new TypeError('Current version needs an explicit read policy');
    for (const step of config.migrations) {
      if (this.migrations.has(step.fromVersion) || step.fromVersion === step.toVersion || !this.validators.has(step.fromVersion)
        || !this.validators.has(step.toVersion) || !step.explanation.trim()
        || typeof step.changesConfiguration !== 'boolean' || (Object.keys(step.relocatedPositions).length > 0 && !step.changesConfiguration)
        || Object.entries(step.renamedIds).some(([from, to]) => !qualified.test(from) || !qualified.test(to))
        || Object.entries(step.relocatedPositions).some(([from, to]) => !qualified.test(from) || !qualified.test(to.roomId) || !qualified.test(to.safePositionId))) {
        throw new TypeError('Invalid or ambiguous save migration');
      }
      this.migrations.set(step.fromVersion, freeze(step));
    }
    // Validate every declared path, including paths not used by this read.
    for (const start of this.migrations.keys()) {
      const seen = new Set<string>();
      let cursor = start;
      while (this.migrations.has(cursor)) {
        if (seen.has(cursor)) throw new TypeError('Cyclic save migration');
        seen.add(cursor); cursor = this.migrations.get(cursor)!.toVersion;
      }
    }
  }

  read(input: Uint8Array, signal?: AbortSignal): SaveReadResult {
    // A readonly number array is owned and truly freezable (unlike Uint8Array).
    const originalBytes = Object.freeze(Array.from(input));
    const blocked = { originalBytes, canReplace: false, canAutosave: false } as const;
    const invalid = (code: SaveValidationCode, path = ''): SaveReadResult => Object.freeze({ ...blocked, status: 'invalid', code, path });
    const unsupported = (reason: 'schema-version' | 'content-version' | 'migration-unavailable'): SaveReadResult => Object.freeze({ ...blocked, status: 'unsupported', reason, updateNeeded: true });
    const interrupted = (): SaveReadResult => Object.freeze({ ...blocked, status: 'interrupted' });
    if (signal?.aborted) return interrupted();
    if (originalBytes.length > SAVE_MAX_BYTES) return invalid('body-too-large');
    const bytes = new Uint8Array(originalBytes);
    let header: unknown;
    try {
      const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
      if (!boundedDepth(json)) return invalid('json');
      header = JSON.parse(json);
    } catch { return invalid('json'); }
    if (!header || typeof header !== 'object' || Array.isArray(header)) return invalid('schema');
    const version = header as Record<string, unknown>;
    if (!Number.isSafeInteger(version['saveSchemaVersion']) || (version['saveSchemaVersion'] as number) < 1) return invalid('schema');
    // Do not submit newer shapes to v1 structural validation or interpret fields.
    if (version['saveSchemaVersion'] !== 1) return unsupported('schema-version');
    if (typeof version['contentVersion'] !== 'string' || version['contentVersion'].length > 32 || !contentVersion.test(version['contentVersion'])) return invalid('schema');
    const validator = this.validators.get(version['contentVersion']);
    if (!validator) return unsupported('content-version');
    const initial = validator.validateNewWrite(bytes);
    if (!initial.ok) return invalid(initial.code, initial.path);
    let snapshot = initial.candidate;
    const steps: Readonly<SaveMigration>[] = [];
    let cursor: string = snapshot.contentVersion;
    while (cursor !== this.currentVersion) {
      const step = this.migrations.get(cursor);
      if (!step) return unsupported('migration-unavailable');
      steps.push(step); cursor = step.toVersion;
    }
    for (const step of steps) {
      if (signal?.aborted) return interrupted();
      const migrated = migrate(snapshot, step);
      if (!migrated.ok) return Object.freeze({ ...blocked, status: 'migration-failed', code: migrated.code, path: '/world' });
      const target = this.validators.get(step.toVersion)!.validateNewWrite(new TextEncoder().encode(JSON.stringify(migrated.snapshot)));
      if (!target.ok) return Object.freeze({ ...blocked, status: 'migration-failed', code: target.code, path: target.path });
      snapshot = target.candidate;
    }
    if (signal?.aborted) return interrupted();
    return Object.freeze({ status: 'ready', originalBytes, snapshot, migrated: steps.length > 0, explanations: Object.freeze(steps.map(step => step.explanation)) });
  }
}

type MigrationResult = { ok: true; snapshot: SaveSnapshotV1 } | { ok: false; code: 'generation-exhausted' | 'mapping-collision' };
function migrate(source: SaveSnapshotV1, step: Readonly<SaveMigration>): MigrationResult {
  const id = <T extends string>(value: T): T => (own(step.renamedIds, value) ?? value) as T;
  const ids = <T extends string>(values: readonly T[]): T[] => values.map(id);
  const w = source.world, n = source.notebook;
  const relocation = own(step.relocatedPositions, w.position.safePositionId);
  const flags = Object.entries(w.flags).map(([key, value]) => [id(key), value] as const);
  if (new Set(flags.map(([key]) => key)).size !== flags.length) return { ok: false, code: 'mapping-collision' };
  let revision = w.configurationRevision;
  if (step.changesConfiguration) {
    const highest = Math.max(w.configurationRevision, ...n.measurements.map(m => m.configurationRevision));
    if (highest >= maxRevision) return { ok: false, code: 'generation-exhausted' };
    revision = (highest + 1) as ConfigurationRevision;
  }
  // Explicit schema projection: no recursive text replacement, completion grants,
  // reset, inferred future-door objective, or discarded historical observations.
  return { ok: true, snapshot: {
    saveSchemaVersion: 1, contentVersion: step.toVersion as ContentVersion, episodeId: source.episodeId,
    adventureId: source.adventureId, safeState: source.safeState,
    world: { roomId: relocation ? relocation.roomId as RoomId : id(w.roomId),
      position: { safePositionId: relocation ? relocation.safePositionId as SafePositionId : w.position.safePositionId },
      configurationRevision: revision, attemptId: w.attemptId, flags: Object.fromEntries(flags),
      completedObjectiveIds: ids(w.completedObjectiveIds), completedQuestIds: ids(w.completedQuestIds),
      achievementIds: ids(w.achievementIds), dialogueEffectIds: ids(w.dialogueEffectIds),
      inventory: w.inventory.map(row => ({ itemId: id(row.itemId), quantity: row.quantity })),
      recruits: w.recruits.map(row => ({ characterId: id(row.characterId), level: row.level, abilityIds: ids(row.abilityIds), progressFlags: ids(row.progressFlags) })),
      activeAllyIds: w.activeAllyIds.length === 0 ? [] : w.activeAllyIds.length === 1 ? [id(w.activeAllyIds[0])] : [id(w.activeAllyIds[0]), id(w.activeAllyIds[1])],
      compendiumIds: ids(w.compendiumIds), route: w.route, continueOutcome: w.continueOutcome },
    notebook: { factIds: ids(n.factIds), mapRoomIds: ids(n.mapRoomIds), personalNotes: n.personalNotes,
      hypotheses: n.hypotheses.map(row => ({ id: row.id, text: row.text, subjectIds: ids(row.subjectIds), status: row.status })),
      measurements: n.measurements.map(row => ({ id: row.id, ruleId: id(row.ruleId), subjectIds: ids(row.subjectIds), roomId: id(row.roomId),
        configurationRevision: row.configurationRevision, attemptId: row.attemptId, stale: row.stale || step.changesConfiguration,
        readings: row.readings.map(reading => ({ ...reading })), conclusionCode: row.conclusionCode })) },
    assistance: source.assistance.map(row => ({ objectiveId: id(row.objectiveId), hintId: id(row.hintId), level: row.level, attemptId: row.attemptId })),
    outcomeHistory: source.outcomeHistory.map(row => ({ id: row.id, outcome: row.outcome, attemptId: row.attemptId, route: row.route, caveatIds: ids(row.caveatIds) })),
  } };
}
