// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { describe, expect, it } from 'vitest';
import service from '../../server/tests/Fixtures/save-cases.json' with { type: 'json' };
import conformance from '../fixtures/save-conformance.json' with { type: 'json' };
import migration from '../fixtures/save-migration-baseline.json' with { type: 'json' };

// Fixture integrity only. Deliberately imports no service, state, registry or UI code.
const root = new URL('../../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');
const baseText = read(conformance.schemaBase);
const schema: object = JSON.parse(read(conformance.schemaContract)) as object;
const ajv = new Ajv2020({ strict: true, allowUnionTypes: true, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);
type RecordValue = Record<string, unknown>;
type Patch = { op: string; path: string; value?: unknown; text?: string; count?: number };
type WireCase = { id: string; recipe: string; targetBytes?: number; hex?: string; validUtf8: boolean; validJson: boolean; schemaValid: boolean };

function inputFor(patches: readonly Patch[]): RecordValue {
  const value = JSON.parse(baseText) as RecordValue;
  for (const patch of patches) {
    const parts = patch.path.slice(1).split('/');
    let parent = value;
    for (const part of parts.slice(0, -1)) parent = parent[part] as RecordValue;
    const key = parts.at(-1)!;
    if (patch.op === 'remove') delete parent[key];
    else if (patch.op === 'set') parent[key] = structuredClone(patch.value);
    else if (patch.op === 'repeat') parent[key] = patch.text!.repeat(patch.count!);
    else throw new Error(`Unknown fixture input operation: ${patch.op}`);
  }
  return value;
}

function wireFor(entry: WireCase): Buffer {
  if (entry.recipe === 'exact-minimal-file-plus-ascii-space-padding') {
    const bytes = Buffer.from(baseText, 'utf8');
    return Buffer.concat([bytes, Buffer.alloc(entry.targetBytes! - bytes.byteLength, 0x20)]);
  }
  if (entry.recipe === 'replace-note-string-with-hex') {
    const marker = '"personalNotes": "';
    const at = baseText.indexOf(marker) + marker.length;
    return Buffer.concat([Buffer.from(baseText.slice(0, at)), Buffer.from(entry.hex!, 'hex'), Buffer.from(baseText.slice(at))]);
  }
  if (entry.recipe === 'remove-final-closing-brace') return Buffer.from(baseText.trimEnd().slice(0, -1));
  throw new Error(`Unknown fixture wire recipe: ${entry.recipe}`);
}

function at(value: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((node, key) => (node as RecordValue)[key], value);
}

describe('T036 independently authored fixture integrity (behavioral acceptance pending)', () => {
  it.each(conformance.schemaCases)('$id has the independently declared Draft2020-12 result', entry => {
    const candidate = inputFor(entry.patches);
    expect(validate(candidate), JSON.stringify(validate.errors)).toBe(entry.schemaValid);
    if (entry.id.startsWith('SEM-')) {
      expect(entry.schemaValid).toBe(true);
      expect(entry.semanticExpectation).toMatch(/^reject-new-operation:/);
    }
  });

  it.each(conformance.wireCases)('$id has the declared wire encoding and byte boundary', entry => {
    const bytes = wireFor(entry);
    if ('targetBytes' in entry) expect(bytes.byteLength).toBe(entry.targetBytes);
    let decoded: string;
    try { decoded = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
    catch { expect(entry.validUtf8).toBe(false); expect(entry.validJson).toBe(false); return; }
    expect(entry.validUtf8).toBe(true);
    if (!entry.validJson) { expect(() => JSON.parse(decoded)).toThrow(); return; }
    expect(validate(JSON.parse(decoded)), JSON.stringify(validate.errors)).toBe(entry.schemaValid);
  });

  it('counts Unicode scalars independently of UTF-16 code units and raw UTF-8 bytes', () => {
    const vector = conformance.schemaCases.find(entry => entry.id === 'SC-NOTES-4096')!;
    const text = (inputFor(vector.patches)['notebook'] as RecordValue)['personalNotes'] as string;
    expect(Array.from(text)).toHaveLength(4096);
    expect(text).toHaveLength(8192);
    expect(Buffer.byteLength(text)).toBe(16384);
    expect(service.policy.notesMaxUnicodeCharacters).toBe(4096);
    expect(service.policy.rawBodyMaxBytes).toBe(262144);
  });

  it.each(service.sources)('retains the exact local authority anchor $id', source => {
    expect(source.path).not.toMatch(/(^\/|\.\.|https?:|\.env)/);
    expect(read(source.path)).toContain(source.anchor);
  });

  it('has unique case IDs, resolved references and every SAVE01–13 requirement', () => {
    expect(conformance.cases.map(entry => entry.id)).toEqual(Array.from({ length: 13 }, (_, i) => `SAVE${String(i + 1).padStart(2, '0')}`));
    const ids = new Set(service.cases.map(entry => entry.id));
    const sourceIds = new Set(service.sources.map(entry => entry.id));
    const profiles = new Set(Object.keys(service.requestProfiles));
    expect(ids.size).toBe(service.cases.length);
    for (const entry of [...service.cases, ...conformance.cases]) {
      expect(entry.behavioralAcceptance).toBe('pending');
      expect(entry.sourceIds.length).toBeGreaterThan(0);
      for (const id of entry.sourceIds) expect(sourceIds.has(id), id).toBe(true);
    }
    for (const entry of service.cases) {
      expect(profiles.has(entry.requestProfile), entry.id).toBe(true);
      expect(entry.expected.assertions.length, entry.id).toBeGreaterThan(0);
      expect([200, 201, 204, 400, 401, 403, 404, 409, 412, 413, 422, 428, 429, 503]).toContain(entry.expected.status);
    }
    for (const entry of conformance.cases) for (const id of entry.serviceCaseIds) expect(ids.has(id), id).toBe(true);
    expect(conformance.sources).toEqual(service.sources);
    const requirements = new Set(conformance.cases.map(entry => entry.id));
    for (const requirement of service.cases.flatMap(entry => entry.requirements)) expect(requirements.has(requirement)).toBe(true);
  });

  it('gives every structural and semantic rejection vector a pending service assertion', () => {
    for (const entry of conformance.schemaCases) {
      if (!entry.schemaValid || entry.id.startsWith('SEM-')) {
        const linked = service.cases.find(candidate => candidate.id === `VALIDATE-${entry.id}`);
        expect(linked?.expected.status).toBe(422);
        expect(linked?.expected.assertions.join(' ')).toContain('final BEGIN IMMEDIATE authorization/receipt recheck');
      }
    }
  });

  it('models server-visible unsafe markers separately from omitted client UI', () => {
    const cases = service.cases.filter(entry => entry.id.startsWith('SV-UNSAFE-'));
    expect(cases).toHaveLength(7);
    for (const entry of cases) {
      expect('bodyPatch' in entry.requestChanges).toBe(true);
      if (!('bodyPatch' in entry.requestChanges)) throw new Error('Missing explicit unsafe marker input.');
      expect(validate(inputFor(entry.requestChanges.bodyPatch))).toBe(true);
      expect(entry.expected.status).toBe(422);
      expect(entry.expected.assertions.join(' ')).toContain('server cannot infer omitted transient UI');
    }
  });

  it('uses only response statuses declared for each exact OpenAPI operation', () => {
    const api = read('specs/001-physical-layer-underworld/contracts/game-api.openapi.yaml');
    type Profile = { extends?: string; method?: string; path?: string };
    const profiles: Record<string, Profile> = service.requestProfiles;
    for (const entry of service.cases) {
      let profile = profiles[entry.requestProfile]!;
      while (profile.extends) profile = profiles[profile.extends]!;
      const route = profile.path!.replace('/arcade/play/network-quest/api/v1', '').replace(/\/auth\/(google|github)\//, '/auth/{provider}/');
      const pathBlock = api.split(`\n  ${route}:\n`)[1]?.split(/\n  \/|\ncomponents:/)[0];
      expect(pathBlock, entry.id).toBeDefined();
      const operation = pathBlock!.split(`    ${profile.method!.toLowerCase()}:\n`)[1]?.split(/\n    (?:get|post|put|patch|delete):/)[0];
      expect(operation, entry.id).toBeDefined();
      const statuses = [...operation!.matchAll(/^        '(\d{3})':/gm)].map(match => Number(match[1]));
      expect(statuses, entry.id).toContain(entry.expected.status);
    }
    for (const shape of ['Problem', 'SaveAcknowledgement', 'DeletionStatus'] as const) {
      const block = api.split(`\n    ${shape}:\n`)[1]?.split(/\n    [A-Z]/)[0];
      expect(block).toContain(`required: [${service.responseRules[shape].required.join(', ')}]`);
    }
  });

  it.each(service.overlapSchedules)('$id requires actual overlap, independent actors and paired barriers', schedule => {
    expect(schedule.behavioralAcceptance).toBe('pending');
    expect(new Set(schedule.actors).size).toBe(2);
    const firstFinish = schedule.events.findIndex(event => event.phase === 'finish');
    expect(firstFinish).toBeGreaterThan(0);
    for (const actor of schedule.actors) {
      const start = schedule.events.findIndex(event => event.actor === actor && event.phase === 'start');
      const finish = schedule.events.findIndex(event => event.actor === actor && event.phase === 'finish');
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(firstFinish);
      expect(finish).toBeGreaterThan(start);
    }
    const holds = new Map<string, number>();
    const releases = new Set<string>();
    schedule.events.forEach((event, index) => {
      expect(schedule.actors).toContain(event.actor);
      if (!('barrier' in event)) return;
      if (event.phase === 'release') {
        expect(holds.get(event.barrier)).toBeLessThan(index);
        expect(releases.has(event.barrier)).toBe(false);
        releases.add(event.barrier);
      } else { expect(holds.has(event.barrier)).toBe(false); holds.set(event.barrier, index); }
    });
    expect(holds.size).toBeGreaterThan(0);
    expect(releases).toEqual(new Set(holds.keys()));
    for (const id of schedule.caseIds) expect(service.cases.some(entry => entry.id === id)).toBe(true);
  });

  it('binds retry identity to exact bytes and every specified fingerprint dimension', () => {
    expect(service.policy.fingerprintFields).toEqual(['method', 'path', 'X-Save-Mode', 'X-Confirm-Adventure-Replacement', 'precondition', 'exact-body-bytes']);
    expect(service.fingerprintIsolation.variants.map(entry => entry.field)).toEqual(['method', 'path']);
    expect(JSON.parse(baseText)).toEqual(JSON.parse(`${baseText} `));
    const hash = (text: string): string => createHash('sha256').update(text, 'utf8').digest('hex');
    expect(hash(baseText)).not.toBe(hash(`${baseText} `));
    for (const id of ['SV-KEY-BODY', 'SV-KEY-MODE', 'SV-KEY-CONFIRM', 'SV-KEY-PRECONDITION']) {
      expect(service.cases.find(entry => entry.id === id)?.expected.status).toBe(409);
    }
    expect(service.policy.ordering).toEqual(['authenticate-origin-csrf-byte-bound-header-key-syntax', 'authorized-account-key-receipt', 'bounded-validation-retain-candidate-or-error', 'BEGIN IMMEDIATE', 'reauthorize-account-session', 'receipt-recheck', 'provisional-error-if-still-new', 'current-autosave-and-adoption', 'conditional-revision', 'atomic-slot-and-receipt-commit']);
    expect(service.cases.find(entry => entry.id === 'SV-REPLAY-OLDER')?.expected.assertions.join(' ')).toContain('committedRevision=8; currentSummary.revision=9; ETag="save-9"');
    expect(service.cases.find(entry => entry.id === 'SV-OLD-POLICY')?.expected.status).toBe(200);
    expect(service.cases.find(entry => entry.id === 'SV-OLD-POLICY-NEW-KEY')?.expected.status).toBe(422);
    expect(service.policy.writeReceiptSeconds).toBe(7 * 24 * 60 * 60);
  });

  it('keeps deletion receipts narrow, canonical and independently expiring', () => {
    const token = service.requestProfiles['deletion-status'].headers['X-Deletion-Receipt'];
    const bytes = Buffer.from(token, 'base64url');
    expect(token).toHaveLength(43);
    expect(bytes).toHaveLength(32);
    expect(bytes.toString('base64url')).toBe(token);
    expect(Object.keys(service.requestProfiles['deletion-status'].headers).sort()).toEqual(['Origin', 'X-Deletion-Receipt']);
    expect(service.requestProfiles['deletion-status'].session).toBeNull();
    expect(service.policy.deletionReceiptSeconds).toBe(24 * 60 * 60);
    for (const id of ['STATUS-PENDING', 'STATUS-UNKNOWN', 'STATUS-EXPIRED']) {
      const entry = service.cases.find(candidate => candidate.id === id)!;
      expect('confirmation' in entry.expected && entry.expected.confirmation).toBe('unconfirmed');
    }
    const completed = service.cases.find(entry => entry.id === 'STATUS-COMPLETED')!;
    expect('confirmation' in completed.expected && completed.expected.confirmation).toBe('confirmed');
    expect(service.crashCases.map(entry => entry.id)).toEqual(['CRASH-INTENT', 'CRASH-LIVE-COMMIT', 'CRASH-COMPLETED-RESPONSE', 'RESTORE-DELETED']);
  });

  it('keeps both migration snapshots structurally valid without asserting released registry membership', () => {
    expect(validate(migration.input), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(migration.expected), JSON.stringify(validate.errors)).toBe(true);
    expect(validate(migration.unknownNewerSnapshot)).toBe(false);
    expect(migration.behavioralAcceptance).toBe('pending');
    expect(migration.scope).toContain('Hypothetical fixture-only registries');
    expect(migration.authorship).toContain('neither is application output');
    expect(migration.registryAssumptions.fromVersion).toBe(migration.input.contentVersion);
    expect(migration.registryAssumptions.toVersion).toBe(migration.expected.contentVersion);
    for (const path of migration.preservePaths) expect(at(migration.expected, path), path).toEqual(at(migration.input, path));
    const before = migration.input.world;
    const after = migration.expected.world;
    expect(after.position.safePositionId).toBe(migration.registryAssumptions.relocatedPositions[before.position.safePositionId as keyof typeof migration.registryAssumptions.relocatedPositions]);
    expect(after.inventory[0]!.itemId).toBe(migration.registryAssumptions.renamedIds[before.inventory[0]!.itemId as keyof typeof migration.registryAssumptions.renamedIds]);
    expect(after.configurationRevision).toBeGreaterThan(before.configurationRevision);
    expect(migration.expected.notebook.measurements[0]!.stale).toBe(true);
    expect(migration.expected.notebook.measurements[0]!.configurationRevision).toBe(migration.input.notebook.measurements[0]!.configurationRevision);
    expect(migration.expected.outcomeHistory[0]!.outcome).toBe('E03');
    expect(migration.expected.world.continueOutcome).toBeNull();
    expect(migration.registryAssumptions.futureDoor.grantsProgress).toBe(false);
    expect(migration.registryAssumptions.futureDoor.requiredForCurrentCompletion).toBe(false);
  });

  it('declares every qualified baseline reference within its hypothetical version registry', () => {
    const ids = (value: unknown): string[] => {
      if (typeof value === 'string') return value.startsWith('spec001:') ? [value] : [];
      if (Array.isArray(value)) return value.flatMap(ids);
      if (value && typeof value === 'object') return Object.entries(value).flatMap(([key, child]) => [...ids(key), ...ids(child)]);
      return [];
    };
    for (const [snapshot, versionIds] of [[migration.input, migration.registryAssumptions.fromOnlyIds], [migration.expected, migration.registryAssumptions.toOnlyIds]] as const) {
      const available = new Set([...migration.registryAssumptions.commonIds, ...versionIds]);
      for (const id of ids(snapshot)) expect(available.has(id), id).toBe(true);
    }
  });

  it('limits the independently authored migration output to declared version, rename, relocation and freshness changes', () => {
    const changedPaths = (before: unknown, after: unknown, path = ''): string[] => {
      if (JSON.stringify(before) === JSON.stringify(after)) return [];
      if (before && after && typeof before === 'object' && typeof after === 'object') {
        const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
        return [...keys].flatMap(key => changedPaths((before as RecordValue)[key], (after as RecordValue)[key], path ? `${path}.${key}` : key));
      }
      return [path];
    };
    expect(changedPaths(migration.input, migration.expected)).toEqual([
      'contentVersion', 'world.position.safePositionId', 'world.configurationRevision',
      'world.inventory.0.itemId', 'notebook.hypotheses.0.subjectIds.0',
      'notebook.measurements.0.subjectIds.0', 'notebook.measurements.0.stale',
    ]);
    expect(migration.expected.notebook.hypotheses[0]!.subjectIds).toEqual(['spec001:fixture.probe']);
    expect(migration.expected.notebook.measurements[0]!.subjectIds).toEqual(['spec001:fixture.probe']);
  });
});
