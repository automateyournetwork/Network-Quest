// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { saveContentPolicyArtifact } from '../../tools/generate-save-content-policy';
import { loadIntroductionContent } from '../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../src/app/adventure';
import { introductionBindings } from '../../src/app/introduction';
import { createReducer, createReducerState } from '../../src/state/reducer';
import type { ReducerInput, StateEffect } from '../../src/state/reducer';
import type { ActionId, MeasurementId } from '../../src/domain/types';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';

const root = fileURLToPath(new URL('../../', import.meta.url));
const path = new URL('../../server/content/save-policy.generated.json', import.meta.url);
const encode = (value: unknown) => new TextEncoder().encode(JSON.stringify(value));
async function policy(): Promise<SaveContentPolicy> { return JSON.parse(await readFile(path, 'utf8')).policies[0]; }
function phpValidate(candidates: unknown[]): { ok: boolean; code: string | null }[] {
  const php = process.env['NQ_PHP_BIN'] ?? 'php';
  const env = { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' };
  const version = spawnSync(php, ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', 'echo PHP_VERSION;'], { env, encoding: 'utf8', timeout: 10000 });
  expect(version.status, 'NQ_PHP_BIN must select PHP 8.4.28 (README.md).').toBe(0);
  expect(version.stdout, 'NQ_PHP_BIN must select PHP 8.4.28 (README.md).').toBe('8.4.28');
  const program = `require 'server/vendor/autoload.php'; require 'server/src/SaveValidator.php';
    $artifact=json_decode(file_get_contents('server/content/save-policy.generated.json'));
    $validator=new NetworkQuest\\SaveValidator($artifact->policies); $results=[];
    foreach(json_decode(stream_get_contents(STDIN)) as $candidate) {
      $result=$validator->validateNewWrite(json_encode($candidate,JSON_THROW_ON_ERROR));
      $results[]=['ok'=>$result->ok,'code'=>$result->code];
    } echo json_encode($results,JSON_THROW_ON_ERROR);`;
  const result = spawnSync(php, ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', program], {
    cwd: root, input: JSON.stringify(candidates), encoding: 'utf8', timeout: 10000, env });
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe('actual authored save content policy artifact', () => {
  it('regenerates deterministically without a listener, project config or ambient env files', async () => {
    const first = await saveContentPolicyArtifact();
    expect(first).toBe(await readFile(path, 'utf8'));
    expect(await saveContentPolicyArtifact()).toBe(first);
    const artifact = JSON.parse(first);
    expect(artifact.scope).toBe('authored-introduction');
    expect(artifact.provenance.ruleIds).toEqual(['PHY04']);
    expect(artifact.provenance.sourceIds).toEqual(['S03']);
    expect(artifact.policies).toHaveLength(1);
    expect(artifact.policies[0].members.room).toEqual(['spec001:R01', 'spec001:R02']);
    expect(Object.keys(artifact.policies[0].safePositions)).toEqual(['spec001:R01.entry', 'spec001:R02.entry']);
    expect(artifact.policies[0].members.character).toEqual([]);
    expect(artifact.policies[0].itemMaxQuantities).toEqual({ 'spec001:ITEM-inspection-kit': 1 });
    expect(first).not.toContain('fixture.');
    expect(first).not.toContain('save-validator-policy.json');
  });

  it('validates real initial state and real kit/105 m/95 m reducer observations in TypeScript and PHP', async () => {
    const { registry } = loadIntroductionContent();
    const validator = new SaveValidator([await policy()]);
    const reducer = createReducer({ registry, bindings: introductionBindings(registry).effects });
    let state = createReducerState(startIntroduction(createIntroductionRuntime(), registry));
    const capture = () => {
      const result = validator.validateRuntime(state.runtime);
      expect(result.ok).toBe(true);
      if (!result.ok) throw new Error('Actual safe runtime rejected');
      return result.candidate;
    };
    const send = (input: ReducerInput) => {
      const game = state.runtime.game!;
      const result = reducer(state, { actionId: crypto.randomUUID() as ActionId, adventureId: game.adventureId, expectedVersion: game.world, input });
      expect(result.status).toBe('applied'); state = result.state;
    };
    const action = (id: string) => {
      const record = registry.record('spec001:DIALOGUE-arrival-actions');
      if (record?.kind !== 'dialogue') throw new Error('Missing current authored action');
      const choice = record.nodes.flatMap(node => node.choices).find(choice => choice.id === `spec001:${id}`);
      if (!choice) throw new Error('Missing current authored choice');
      send({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'authored-action', observations: [], acceptedEffects: choice.effects as StateEffect[] } });
    };
    const initial = capture(); action('ACTION-take-kit');
    send({ kind: 'notebook', operation: { kind: 'inspect-path', id: crypto.randomUUID() as MeasurementId } });
    const long = capture();
    expect(long.notebook.measurements[0]?.readings).toEqual([{ name: 'Channel length', value: 105, unit: 'm' }, { name: 'Inclusive maximum', value: 100, unit: 'm' }, { name: 'Excess', value: 5, unit: 'm' }]);
    action('ACTION-path-short');
    send({ kind: 'notebook', operation: { kind: 'inspect-path', id: crypto.randomUUID() as MeasurementId } });
    const short = capture();
    expect(short.notebook.measurements[0]?.stale).toBe(true);
    expect(short.notebook.measurements[1]?.readings).toEqual([{ name: 'Channel length', value: 95, unit: 'm' }, { name: 'Inclusive maximum', value: 100, unit: 'm' }, { name: 'Headroom', value: 5, unit: 'm' }]);
    const wrongUnit = { ...short, notebook: { ...short.notebook, measurements: short.notebook.measurements.map((measurement, index) => index !== 1 ? measurement :
      { ...measurement, readings: measurement.readings.map((reading, i) => i !== 0 ? reading : { ...reading, unit: 'dBm' }) }) } };
    expect(validator.validateNewWrite(encode(wrongUnit))).toMatchObject({ ok: false, code: 'measurement' });
    expect(phpValidate([initial, long, short, wrongUnit])).toEqual([{ ok: true, code: null }, { ok: true, code: null }, { ok: true, code: null }, { ok: false, code: 'measurement' }]);
  });

  it('does not turn metadata reservations, future progression or unsupported safety into write permissions', async () => {
    const { registry } = loadIntroductionContent();
    const validator = new SaveValidator([await policy()]);
    const base = validator.validateRuntime(startIntroduction(createIntroductionRuntime(), registry));
    if (!base.ok) throw new Error('Expected initial snapshot');
    const futureRoom = { ...base.candidate, world: { ...base.candidate.world, roomId: 'spec001:R03', position: { safePositionId: 'spec001:R03.entry' } } };
    const futureObjective = { ...base.candidate, world: { ...base.candidate.world, completedObjectiveIds: ['spec001:O03'] } };
    const unsafe = { ...base.candidate, safeState: 'safe-continue' };
    const extraKit = { ...base.candidate, world: { ...base.candidate.world, inventory: [{ itemId: 'spec001:ITEM-inspection-kit', quantity: 2 }] } };
    const candidates = [futureRoom, futureObjective, unsafe, extraKit];
    for (const candidate of candidates) expect(validator.validateNewWrite(encode(candidate)).ok).toBe(false);
    expect(phpValidate(candidates).map(result => result.ok)).toEqual([false, false, false, false]);
  });
});
