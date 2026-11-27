// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import conformance from '../fixtures/save-conformance.json' with { type: 'json' };
import service from '../../server/tests/Fixtures/save-cases.json' with { type: 'json' };
import fixture from './save-validator-policy.json' with { type: 'json' };
import { SaveValidator, createSaveContentPolicy } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ActionId, MeasurementId } from '../../src/domain/types';
import type { RuntimeState } from '../../src/state/types';
import { saveSchemaArtifacts } from '../../tools/generate-save-validator';

const root = new URL('../../', import.meta.url);
const base = readFileSync(new URL(conformance.schemaBase, root), 'utf8');
const bytes = (text: string) => new TextEncoder().encode(text);
// Explicit projection of the synthetic helper, preserving original fixture bytes.
const policy = { ...structuredClone(fixture.policy), recruits: {
  'spec001:fixture.helper': { ...fixture.policy.recruits['spec001:fixture.helper'], abilityIdsByLevel: {
    '1': [], '2': ['spec001:fixture.measure'],
  } },
} } as SaveContentPolicy;
const validator = new SaveValidator([policy]);
type Patch = { op: string; path: string; value?: unknown; text?: string; count?: number };
function patched(patches: readonly Patch[]): string {
  const candidate = JSON.parse(base);
  for (const patch of patches) {
    const keys = patch.path.slice(1).split('/');
    let parent = candidate;
    for (const key of keys.slice(0, -1)) parent = parent[key];
    const key = keys.at(-1)!;
    if (patch.op === 'remove') delete parent[key];
    else parent[key] = patch.op === 'repeat' ? patch.text!.repeat(patch.count!) : structuredClone(patch.value);
  }
  return JSON.stringify(candidate);
}
const set = (path: string, value: unknown): Patch => ({ op: 'set', path, value });
function code(raw: string | Uint8Array): string | null {
  const result = validator.validateNewWrite(typeof raw === 'string' ? bytes(raw) : raw);
  expect(result.provisional).toBe(true);
  return result.ok ? null : result.code;
}
const schemaCase = (id: string) => conformance.schemaCases.find(row => row.id === id)!;

describe('T042 new-write validation, without account/HTTP/transaction claims', () => {
  it.each(conformance.schemaCases)('$id preserves independent schema and semantic expectations', entry => {
    const wire = bytes(patched(entry.patches));
    expect(validator.validateStructure(wire).ok).toBe(entry.schemaValid);
    expect(validator.validateNewWrite(wire).ok).toBe(entry.schemaValid && !entry.id.startsWith('SEM-'));
  });

  it.each(conformance.wireCases)('$id enforces actual wire limits', entry => {
    let wire: Uint8Array;
    if (entry.recipe === 'exact-minimal-file-plus-ascii-space-padding' && 'targetBytes' in entry) {
      wire = bytes(base + ' '.repeat(entry.targetBytes - bytes(base).length));
    } else if (entry.recipe === 'replace-note-string-with-hex' && 'hex' in entry) {
      const at = base.indexOf('"personalNotes": "') + '"personalNotes": "'.length;
      wire = new Uint8Array([...bytes(base.slice(0, at)), ...Buffer.from(entry.hex, 'hex'), ...bytes(base.slice(at))]);
    } else wire = bytes(base.trimEnd().slice(0, -1));
    expect(code(wire)).toBe(entry.id === 'WIRE-BOUNDARY' ? null : entry.id === 'WIRE-OVER' ? 'body-too-large' : 'json');
  });

  it.each(fixture.semanticCases)('$id checks the independently declared relationship', entry => {
    const raw = patched(entry.patches);
    expect(code(raw)).toBe(entry.code);
    if (entry.code === null) {
      const result = validator.validateNewWrite(bytes(raw));
      if (!result.ok) throw new Error('Expected candidate');
      expect(result.json).toBe(raw);
      expect(result.candidate).toEqual(JSON.parse(raw));
    }
  });
  it.each(fixture.rawCases)('$id preserves strict JSON/Unicode semantics', entry => {
    const raw = 'raw' in entry ? entry.raw : base.replace('"personalNotes": ""', `"personalNotes": ${entry.notesJson}`);
    expect(code(raw)).toBe(entry.code);
  });
  it.each(service.cases.filter(row => row.id.startsWith('SV-UNSAFE-')))('$id rejects only representable unsafe markers', entry => {
    if (!('bodyPatch' in entry.requestChanges)) throw new Error('Missing independently authored marker');
    expect(code(patched(entry.requestChanges.bodyPatch))).toBe('safe-state');
  });

  it('retains stale evidence but rejects falsely fresh evidence for another attempt', () => {
    const row = JSON.parse(patched(schemaCase('SEM-FRESHNESS').patches));
    row.notebook.measurements[0].stale = true;
    expect(code(JSON.stringify(row))).toBeNull();
    row.notebook.measurements[0].stale = false;
    row.notebook.measurements[0].configurationRevision = 0;
    row.notebook.measurements[0].attemptId = '20000000-0000-4000-8000-000000000001';
    expect(code(JSON.stringify(row))).toBe('measurement');
  });
  it('rejects unknown reading names, conclusions and duplicate measurement identities', () => {
    const row = JSON.parse(patched(schemaCase('SEM-FRESHNESS').patches));
    const reading = row.notebook.measurements[0];
    reading.configurationRevision = 0;
    expect(code(JSON.stringify(row))).toBeNull();
    reading.attemptId = reading.attemptId.toUpperCase();
    expect(code(JSON.stringify(row))).toBeNull();
    reading.readings[0].name = 'unsupported';
    expect(code(JSON.stringify(row))).toBe('measurement');
    reading.readings[0].name = 'length';
    reading.conclusionCode = 'unsupported';
    expect(code(JSON.stringify(row))).toBe('measurement');
    reading.conclusionCode = 'fixture-inspected';
    row.notebook.measurements.push(structuredClone(reading));
    expect(code(JSON.stringify(row))).toBe('relationship');
  });
  it('rejects duplicate hypothesis/event IDs, and foreign ability ownership', () => {
    const hypothesis = { id: '30000000-0000-4000-8000-000000000001', text: 'Test', subjectIds: [], status: 'open' };
    expect(code(patched([set('/notebook/hypotheses', [hypothesis, hypothesis])]))).toBe('relationship');
    const event = { id: '50000000-0000-4000-8000-000000000001', outcome: 'E03', attemptId: '20000000-0000-4000-8000-000000000001', route: null, caveatIds: [] };
    expect(code(patched([set('/outcomeHistory', [event, event])]))).toBe('relationship');
    const restricted = structuredClone(policy);
    restricted.recruits['spec001:fixture.helper']!.abilityIds = [];
    const raw = patched(fixture.semanticCases.find(row => row.id === 'valid-party')!.patches);
    expect(new SaveValidator([restricted]).validateNewWrite(bytes(raw))).toMatchObject({ ok: false, code: 'relationship' });
  });
  it('is byte based, rejects nonfinite numbers/deep JSON/BOM, and never truncates', () => {
    expect(code(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes(base)]))).toBe('json');
    expect(code(base.replace('"configurationRevision": 0', '"configurationRevision": 1e999'))).toBe('schema');
    expect(code('['.repeat(1000) + '0' + ']'.repeat(1000))).toBe('json');
    const raw = patched([set('/notebook/personalNotes', '🧭'.repeat(4096))]);
    expect(code(raw + ' '.repeat(262144 - bytes(raw).length))).toBeNull();
    expect(code(raw + ' '.repeat(262145 - bytes(raw).length))).toBe('body-too-large');
  });
  it('owns its policy and successful candidate; diagnostics never echo player text', () => {
    const mutable = structuredClone(policy);
    const own = new SaveValidator([mutable]);
    mutable.members.room = [];
    const result = own.validateNewWrite(bytes(base));
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected candidate');
    expect(Object.isFrozen(result.candidate.notebook)).toBe(true);
    const invalid = patched([set('/notebook/personalNotes', 'secret'.repeat(4096))]);
    expect(JSON.stringify(own.validateNewWrite(bytes(invalid)))).not.toContain('secret');
    expect(new SaveValidator([]).validateNewWrite(bytes(base))).toMatchObject({ ok: false, code: 'content-version', provisional: true });
  });
  it('rejects unsupported policy branches instead of dropping them from an alternative', () => {
    const unsupported = structuredClone(policy);
    unsupported.objectivePrerequisites['spec001:O01'] = { kind: 'any', conditions: [{ kind: 'always' }, { kind: 'item-available' }] } as unknown as SaveContentPolicy['objectivePrerequisites'][string];
    expect(() => new SaveValidator([unsupported])).toThrow('Unsupported');
  });
  it('uses JSON number equality for configured unsafe flags, without coercing booleans or strings', () => {
    const numeric = structuredClone(policy);
    numeric.unsafeFlags['spec001:fixture.progress'] = [1];
    const check = new SaveValidator([numeric]);
    for (const value of ['1', '1.0', '1e0']) {
      const raw = base.replace('"flags": {}', `"flags": {"spec001:fixture.progress": ${value}}`);
      expect(check.validateNewWrite(bytes(raw))).toMatchObject({ ok: false, code: 'safe-state' });
    }
    for (const value of ['true', '"1"']) {
      const raw = base.replace('"flags": {}', `"flags": {"spec001:fixture.progress": ${value}}`);
      expect(check.validateNewWrite(bytes(raw)).ok).toBe(true);
    }
  });
  it('keeps unknown stored data unchanged; this API is exclusively for new writes', () => {
    const future = patched([set('/saveSchemaVersion', 99), set('/contentVersion', '99.0.0')]);
    const wire = bytes(future);
    expect(validator.validateNewWrite(wire).ok).toBe(false);
    expect(new TextDecoder().decode(wire)).toBe(future);
  });

  it('bridges all authored rooms and rejects unavailable rooms/anchors, out-of-order objectives and unauthored recruits', () => {
    const { registry, world } = loadIntroductionContent();
    const actual = createSaveContentPolicy(registry, world, { itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 }, measurementRules: {}, unsafeFlags: {} });
    const current = new SaveValidator([actual]);
    expect(world.rooms).toHaveLength(12);
    expect(Object.keys(actual.safePositions)).toEqual(['spec001:R01.entry', 'spec001:R02.entry', 'spec001:R03.entry',
      'spec001:R04.entry', 'spec001:R05.entry', 'spec001:R06.entry', 'spec001:R07.entry', 'spec001:R08.entry', 'spec001:R09.entry', 'spec001:R10.entry', 'spec001:R11.preparation', 'spec001:R12.entry']);
    expect(current.validateNewWrite(bytes(base)).ok).toBe(true);
    for (const patches of [
      [set('/world/roomId', 'spec001:R99'), set('/world/position/safePositionId', 'spec001:R99.entry')],
      [set('/world/roomId', 'spec001:R05'), set('/world/position/safePositionId', 'spec001:R05.unavailable')],
      [set('/world/completedObjectiveIds', ['spec001:O03'])],
      [set('/world/recruits', [{ characterId: 'spec001:CH01', level: 1, abilityIds: [], progressFlags: [] }])],
      [set('/safeState', 'safe-preparation')],
    ]) expect(current.validateNewWrite(bytes(patched(patches))).ok).toBe(false);
    expect(actual.members.fact).toContain('spec001:FACT-power');
    expect(actual.hints['spec001:HINT-O01-method']).toEqual({ objectiveId: 'spec001:O01', level: 1 });
    expect(() => createSaveContentPolicy(registry, world, { itemMaxQuantities: { 'spec001:fixture.probe': 1 }, measurementRules: {}, unsafeFlags: {} })).toThrow();
  });
  it('accepts an actual reducer inspection with explicit reviewed measurement policy and rejects wrong units', () => {
    const { registry, world } = loadIntroductionContent();
    const p = createSaveContentPolicy(registry, world, { itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 }, unsafeFlags: {},
      measurementRules: { 'spec001:PHY04': { readings: { 'Channel length': 'm', 'Inclusive maximum': 'm', Excess: 'm', Headroom: 'm' }, conclusionCodes: ['length-exceeded', 'length-within-profile'] } } });
    const reducer = createReducer({ registry, bindings: introductionBindings(registry).effects });
    let state = createReducerState(startIntroduction(createIntroductionRuntime(), registry));
    const game = state.runtime.game!;
    state = createReducerState({ ...state.runtime, game: { ...game, world: { ...game.world,
      inventory: [{ itemId: 'spec001:ITEM-inspection-kit' as typeof game.world.inventory[number]['itemId'], quantity: 1 }] } } });
    const result = reducer(state, { actionId: '80000000-0000-4000-8000-000000000001' as ActionId,
      adventureId: game.adventureId, expectedVersion: game.world,
      input: { kind: 'notebook', operation: { kind: 'inspect-path', id: '40000000-0000-4000-8000-000000000001' as MeasurementId } } });
    expect(result.status).toBe('applied');
    const checked = new SaveValidator([p]).validateRuntime(result.state.runtime);
    expect(checked.ok).toBe(true);
    if (!checked.ok) throw new Error('Expected actual measurement candidate');
    expect(checked.candidate.notebook.measurements[0]?.readings[0]).toEqual({ name: 'Channel length', value: 105, unit: 'm' });
    const changed = JSON.parse(checked.json);
    changed.notebook.measurements[0].readings[0].unit = 'dBm';
    expect(new SaveValidator([p]).validateNewWrite(bytes(JSON.stringify(changed)))).toMatchObject({ ok: false, code: 'measurement' });
  });
  it.each(['dialogue-transaction', 'pending-effect', 'room-transition', 'cutscene', 'active-encounter', 'terminal-failure', 'shutdown', null])('runtime %s cannot produce a new candidate', kind => {
    const snapshot = JSON.parse(base);
    const { saveSchemaVersion: _schema, safeState: _safe, ...game } = snapshot;
    const runtime = { game, activity: kind === null ? null : { kind } } as RuntimeState;
    expect(validator.validateRuntime(runtime)).toMatchObject({ ok: false, code: 'safe-state' });
  });
  it('validates actual runtime game/activity while never serializing auth or checkpoint', () => {
    const snapshot = JSON.parse(base);
    const { saveSchemaVersion: _schema, safeState: _safe, ...game } = snapshot;
    const runtime = { game, activity: { kind: 'stable-exploration' }, checkpoint: { private: true }, auth: { private: true } } as unknown as RuntimeState;
    const result = validator.validateRuntime(runtime);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('Expected candidate');
    expect(result.candidate).toEqual(snapshot);
    expect(result.json).not.toContain('private');
  });
  it('checks deterministic generated CSP-safe schema code against the exact contract', async () => {
    for (const [path, source] of await saveSchemaArtifacts()) {
      expect(readFileSync(new URL(path, root), 'utf8')).toBe(source);
      expect(source).not.toMatch(/\beval\s*\(|new Function\s*\(|require\(/);
    }
  });
});
