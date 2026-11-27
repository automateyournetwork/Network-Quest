// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import baseline from '../fixtures/save-migration-baseline.json' with { type: 'json' };
import currentPolicy from '../../server/content/save-policy.generated.json' with { type: 'json' };
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { createReducerState } from '../../src/state/reducer';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';
import { SaveReader } from '../../src/state/save-migrations';
import type { SaveMigration, SaveReaderOptions } from '../../src/state/save-migrations';

const encode = (text: string) => new TextEncoder().encode(text);
const bytes = (value: unknown) => encode(JSON.stringify(value));
const q = (suffix: string) => `spec001:fixture.${suffix}`;
/** Explicit interpretation of T036's declared artificial registries. Never
 * inferred from either expected output or real episode metadata memberships. */
function fixturePolicy(version: string): SaveContentPolicy {
  const old = version === '0.9.0', probe = q(old ? 'old-probe' : 'probe');
  return { contentVersion: version, members: {
    room: [q('workshop')], objective: [q('inspect')], quest: [q('quest')], achievement: [q('achievement')],
    effect: [q('dialogue-grant')], item: [probe], character: [q('helper')], ability: [q('observe')],
    flag: [q('powered'), q('trained')], compendium: [q('helper')], fact: [q('power-fact')],
    hint: [q('hint-method')], rule: [q('length')], subject: [probe], caveat: [q('shutdown-caveat')],
  }, safePositions: { [q(old ? 'old-bench' : 'safe-bench')]: { roomId: q('workshop'), eligibleStates: ['safe-preparation'] } },
  itemMaxQuantities: { [probe]: 1 }, recruits: { [q('helper')]: { maxLevel: 2, abilityIds: [q('observe')], progressFlagIds: [q('trained')], abilityIdsByLevel: { '1': [], '2': [q('observe')] } } },
  hints: { [q('hint-method')]: { objectiveId: q('inspect'), level: 1 } }, objectivePrerequisites: { [q('inspect')]: { kind: 'always' } },
  measurementRules: { [q('length')]: { readings: { length: 'm' }, conclusionCodes: ['fixture-inspected'] } }, unsafeFlags: {} };
}
function migration(): SaveMigration {
  return { fromVersion: baseline.registryAssumptions.fromVersion, toVersion: baseline.registryAssumptions.toVersion,
    renamedIds: { ...baseline.registryAssumptions.renamedIds }, relocatedPositions: {
      [q('old-bench')]: { roomId: q('workshop'), safePositionId: baseline.registryAssumptions.relocatedPositions[q('old-bench') as keyof typeof baseline.registryAssumptions.relocatedPositions] },
    }, changesConfiguration: true, explanation: baseline.expectedExplanation };
}
function options(): SaveReaderOptions {
  return { currentContentVersion: '1.0.0', readPolicies: [fixturePolicy('0.9.0'), fixturePolicy('1.0.0')], migrations: [migration()] };
}
const reader = () => new SaveReader(options());
const at = (value: unknown, path: string) => path.split('.').reduce<unknown>((node, key) => (node as Record<string, unknown>)[key], value);

describe('T048 supported-version reading and explicit in-memory migration', () => {
  it('matches the independently authored baseline exactly without editing its bytes or expected answer', () => {
    const original = encode(`\n ${JSON.stringify(baseline.input, null, 2)} \n`), before = original.slice();
    const result = reader().read(original);
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected supported baseline');
    expect(result.snapshot).toEqual(baseline.expected);
    expect(result.explanations).toEqual([baseline.expectedExplanation]);
    expect(result.migrated).toBe(true);
    expect(result.originalBytes).toEqual([...before]);
    expect(original).toEqual(before);
    for (const path of baseline.preservePaths) expect(at(result.snapshot, path), path).toEqual(at(baseline.input, path));
    expect(result.snapshot.world.completedObjectiveIds).not.toContain(baseline.registryAssumptions.futureDoor.id);
    expect(result.snapshot.notebook.measurements[0]).toEqual({ ...baseline.input.notebook.measurements[0], stale: true, subjectIds: [q('probe')] });
    expect(Object.isFrozen(result.snapshot.notebook.measurements[0])).toBe(true);
    expect(Object.isFrozen(result.explanations)).toBe(true);
  });

  it('reads actual current content and does not grant fixture IDs or unavailable rooms', () => {
    const policy = currentPolicy.policies as SaveContentPolicy[];
    const actual = new SaveReader({ currentContentVersion: '1.0.0', readPolicies: policy, migrations: [] });
    const { registry } = loadIntroductionContent();
    const captured = captureSafeSnapshot(createReducerState(startIntroduction(createIntroductionRuntime(), registry)), new SaveValidator(policy));
    if (!captured.ok) throw new Error('Expected actual safe introduction');
    const result = actual.read(new Uint8Array(captured.capture.bodyBytes));
    expect(result).toMatchObject({ status: 'ready', migrated: false, explanations: [] });
    if (result.status === 'ready') expect(result.snapshot).toEqual(captured.capture.snapshot);
    expect(actual.read(bytes(baseline.expected))).toMatchObject({ status: 'invalid', code: 'reference' });
    const invalid = structuredClone(captured.capture.snapshot);
    const raw = { ...invalid, world: { ...invalid.world, roomId: 'spec001:R99', position: { safePositionId: 'spec001:R99.entry' } } };
    expect(actual.read(bytes(raw))).toMatchObject({ status: 'invalid', code: 'reference' });
  });

  it('retains unknown newer fields, huge integer lexemes, whitespace and byte ownership without v1 coercion', () => {
    const text = ' {"saveSchemaVersion":99,"contentVersion":"99.0.0","episodeId":"spec099","futureOpaqueField":{"retain":[900719925474099312345,"\\u0061"]}}\n';
    const input = encode(text), result = reader().read(input);
    expect(result).toMatchObject({ status: 'unsupported', reason: 'schema-version', updateNeeded: true, canReplace: false, canAutosave: false });
    input.fill(0);
    expect(new TextDecoder().decode(new Uint8Array(result.originalBytes))).toBe(text);
    expect(Object.isFrozen(result.originalBytes)).toBe(true);
    expect('snapshot' in result).toBe(false);
    expect(reader().read(bytes(baseline.unknownNewerSnapshot)).status).toBe('unsupported');
  });

  it.each(['99.0.0', '0.8.0'])('preserves unsupported content %s even when schema1 is known', version => {
    const raw = { ...baseline.input, contentVersion: version }, input = bytes(raw);
    const result = reader().read(input);
    expect(result).toMatchObject({ status: 'unsupported', reason: 'content-version', canReplace: false, canAutosave: false });
    expect(result.originalBytes).toEqual([...input]);
  });

  it('dispatches an unsupported schema without imposing v1 content-version fields on its opaque shape', () => {
    for (const value of [{ saveSchemaVersion: 99, payload: ['unknown'] }, { saveSchemaVersion: 99, contentVersion: { major: 99 } }]) {
      const raw = bytes(value), result = reader().read(raw);
      expect(result).toMatchObject({ status: 'unsupported', reason: 'schema-version', updateNeeded: true });
      expect(result.originalBytes).toEqual([...raw]);
    }
  });

  it('keeps supported reading separate from changed new-write policy', () => {
    const original = bytes(baseline.input);
    expect(new SaveValidator([fixturePolicy('1.0.0')]).validateNewWrite(original)).toMatchObject({ ok: false, code: 'content-version' });
    expect(reader().read(original).status).toBe('ready');
    const noChain = new SaveReader({ ...options(), migrations: [] }).read(original);
    expect(noChain).toMatchObject({ status: 'unsupported', reason: 'migration-unavailable', canReplace: false, canAutosave: false });
  });

  it.each([
    ['malformed', '{', 'json'], ['array', '[]', 'schema'], ['null', 'null', 'schema'],
    ['string-schema', '{"saveSchemaVersion":"1","contentVersion":"1.0.0"}', 'schema'],
    ['missing-version', '{"saveSchemaVersion":1}', 'schema'],
  ])('preserves invalid %s input without returning a partial snapshot', (_name, text, code) => {
    const input = encode(text!), result = reader().read(input), original = [...input];
    expect(result).toMatchObject({ status: 'invalid', code, canReplace: false, canAutosave: false });
    input.fill(0); expect(result.originalBytes).toEqual(original);
    expect('snapshot' in result).toBe(false);
  });

  it('enforces UTF-8, raw-byte and lexical-depth bounds and retains original rejected bytes', () => {
    for (const [input, code] of [
      [new Uint8Array([0xc3, 0x28]), 'json'],
      [new Uint8Array(262145).fill(32), 'body-too-large'],
      [encode('{"saveSchemaVersion":99,"contentVersion":"99.0.0","x":' + '['.repeat(33) + '0' + ']'.repeat(33) + '}'), 'json'],
    ] as const) {
      const result = reader().read(input);
      expect(result).toMatchObject({ status: 'invalid', code });
      expect(result.originalBytes).toEqual([...input]);
    }
  });

  it('validates old references before mapping and validates the entire target before exposing it', () => {
    const unknown = structuredClone(baseline.input); unknown.world.inventory[0]!.itemId = q('unlisted');
    const input = bytes(unknown), result = reader().read(input);
    expect(result).toMatchObject({ status: 'invalid', code: 'reference' });
    expect(result.originalBytes).toEqual([...input]);
    const bad = options(); bad.migrations = [{ ...migration(), renamedIds: { [q('old-probe')]: q('unlisted') } }];
    const failure = new SaveReader(bad).read(bytes(baseline.input));
    expect(failure).toMatchObject({ status: 'migration-failed', code: 'reference', canReplace: false, canAutosave: false });
    expect('snapshot' in failure).toBe(false);
    expect(failure.originalBytes).toEqual([...bytes(baseline.input)]);
  });

  it('does not expose a half-applied multi-step migration when the final step fails', () => {
    const config = options();
    config.currentContentVersion = '1.1.0';
    config.readPolicies = [...config.readPolicies, fixturePolicy('1.1.0')];
    config.migrations = [...config.migrations, { fromVersion: '1.0.0', toVersion: '1.1.0', renamedIds: { [q('probe')]: q('missing') },
      relocatedPositions: {}, changesConfiguration: false, explanation: 'A deliberately invalid second step.' }];
    const result = new SaveReader(config).read(bytes(baseline.input));
    expect(result).toMatchObject({ status: 'migration-failed', code: 'reference' });
    expect('snapshot' in result).toBe(false);
    expect(result.originalBytes).toEqual([...bytes(baseline.input)]);
  });

  it('validates each step in a successful chain without re-incrementing an unchanged configuration', () => {
    const config = options();
    config.currentContentVersion = '1.1.0'; config.readPolicies = [...config.readPolicies, fixturePolicy('1.1.0')];
    config.migrations = [...config.migrations, { fromVersion: '1.0.0', toVersion: '1.1.0', renamedIds: {}, relocatedPositions: {},
      changesConfiguration: false, explanation: 'An unavailable future door changes no completed progress.' }];
    const result = new SaveReader(config).read(bytes(baseline.input));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected two-step migration');
    expect(result.snapshot).toEqual({ ...baseline.expected, contentVersion: '1.1.0' });
    expect(result.explanations).toEqual([baseline.expectedExplanation, config.migrations[1]!.explanation]);
  });

  it('rejects missing and cross-room relocation targets instead of guessing an initial position', () => {
    for (const relocatedPositions of [{}, { [q('old-bench')]: { roomId: q('wrong-room'), safePositionId: q('safe-bench') } },
      { [q('old-bench')]: { roomId: q('workshop'), safePositionId: q('unlisted') } }]) {
      const config = { ...options(), migrations: [{ ...migration(), relocatedPositions }] };
      const result = new SaveReader(config).read(bytes(baseline.input));
      expect(result.status).toBe('migration-failed');
      expect('snapshot' in result).toBe(false);
      expect(result.originalBytes).toEqual([...bytes(baseline.input)]);
    }
  });

  it('rejects many-to-one flag mapping before any progress can be lost', () => {
    const input = { ...baseline.input, world: { ...baseline.input.world, flags: { [q('powered')]: true, [q('trained')]: false } } };
    const config = options();
    config.migrations = [{ ...migration(), renamedIds: { ...migration().renamedIds, [q('powered')]: q('trained') } }];
    const result = new SaveReader(config).read(bytes(input));
    expect(result).toMatchObject({ status: 'migration-failed', code: 'mapping-collision' });
    expect(result.originalBytes).toEqual([...bytes(input)]);
  });

  it('checks cancellation without exposing a partially interpreted snapshot', () => {
    const controller = new AbortController(); controller.abort();
    const raw = bytes(baseline.input), result = reader().read(raw, controller.signal);
    expect(result).toMatchObject({ status: 'interrupted', canReplace: false, canAutosave: false });
    expect(result.originalBytes).toEqual([...raw]);
    expect('snapshot' in result).toBe(false);
  });

  it('never replaces text, conclusion labels, UUIDs or opaque string values just because they equal an old ID', () => {
    const input = structuredClone(baseline.input);
    input.notebook.personalNotes = q('old-probe'); input.notebook.hypotheses[0]!.text = q('old-probe');
    const result = reader().read(bytes(input));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected mapped baseline');
    expect(result.snapshot.notebook.personalNotes).toBe(q('old-probe'));
    expect(result.snapshot.notebook.hypotheses[0]!.text).toBe(q('old-probe'));
    expect(result.snapshot.world.attemptId).toBe(input.world.attemptId);
  });

  it('increments configuration beyond retained stale observations and fails at the schema ceiling', () => {
    const input = structuredClone(baseline.input);
    input.notebook.measurements[0]!.configurationRevision = 8; input.notebook.measurements[0]!.stale = true;
    const result = reader().read(bytes(input));
    expect(result.status).toBe('ready');
    if (result.status !== 'ready') throw new Error('Expected mapped baseline');
    expect(result.snapshot.world.configurationRevision).toBe(9);
    expect(result.snapshot.notebook.measurements[0]!.configurationRevision).toBe(8);
    input.world.configurationRevision = 2147483647;
    expect(reader().read(bytes(input))).toMatchObject({ status: 'migration-failed', code: 'generation-exhausted' });
  });

  it('owns migration declarations and rejects ambiguous chains, cycles and unexplained relocation', () => {
    const config = options(), instance = new SaveReader(config);
    config.migrations[0]!.renamedIds[q('old-probe')] = q('changed-after-construction');
    expect(instance.read(bytes(baseline.input)).status).toBe('ready');
    for (const migrations of [
      [migration(), migration()],
      [migration(), { ...migration(), fromVersion: '1.0.0', toVersion: '0.9.0' }],
      [{ ...migration(), explanation: ' ' }],
      [{ ...migration(), changesConfiguration: false }],
      [{ ...migration(), toVersion: 'missing-policy' }],
    ]) expect(() => new SaveReader({ ...options(), migrations })).toThrow();
    expect(() => new SaveReader({ ...options(), currentContentVersion: 'missing-policy' })).toThrow();
  });
});
