// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ContentRegistry } from '../../src/content/registry';
import type { OutcomeEventId } from '../../src/domain/types';
import { introductionSavePolicy, introductionSaveRules } from '../../src/app/save-policy';
import { createSaveContentPolicy, SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy, SavePolicyRules } from '../../src/services/save-validator';
import { captureEncounterContext, commitEncounterChange, prepareEncounterRollback } from '../../src/state/encounter';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { riftPreparationBoundary } from '../../src/state/rift-encounter';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { fixture, q, registry, uuid, world } from './outcome-fixture';

/** Real PHP validator, bounded local stdin only; no HTTP, database or account. */
function php(policy: SaveContentPolicy, candidates: readonly unknown[]): { ok: boolean; code: string | null }[] {
  const binary = process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php';
  const program = `require 'server/vendor/autoload.php'; require 'server/src/SaveValidator.php';
    if(PHP_VERSION!=='8.4.28')throw new RuntimeException('Expected pinned PHP8.4.28');
    $input=json_decode(stream_get_contents(STDIN),flags:JSON_THROW_ON_ERROR);
    $validator=new NetworkQuest\\SaveValidator([$input->policy]); $results=[];
    foreach($input->candidates as $candidate){$result=$validator->validateNewWrite(json_encode($candidate,JSON_THROW_ON_ERROR));
      $results[]=['ok'=>$result->ok,'code'=>$result->code];} echo json_encode($results,JSON_THROW_ON_ERROR);`;
  const result = spawnSync(binary, ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', program], {
    cwd: new URL('../../', import.meta.url), input: JSON.stringify({ policy, candidates }), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' } });
  expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout);
}
function classified(selection: 'permanent' | 'temporary' | 'shutdown', route: 'copper' | 'fiber' | 'radio' = 'copper') {
  const f = fixture(route); f.prepare(selection === 'shutdown' ? 'shutdown' : `${route}-${route === 'copper' ? 'section' : 'A'}`,
    selection === 'shutdown' ? null : selection);
  if (selection === 'temporary') f.choose('record-maintenance');
  if (selection === 'shutdown') f.choose('record-isolation');
  expect(f.execute().result.status).toBe('handled'); expect(f.move('R12').status).toBe('handled'); f.choose('read-classification');
  if (selection !== 'shutdown') { f.act({ kind: 'measure-link', id: uuid(2) }); f.act({ kind: 'test-endpoint', id: uuid(3) }); }
  const controller = createOutcomeController({ registry, repairScenario: f.resolver });
  const prepared = controller.prepareClassification(f.state(), captureOutcomeContext(f.state())!, {
    actionId: 'classify-final' as never, eventId: uuid(90) as unknown as OutcomeEventId,
    operation: { kind: 'classify', selection, linkId: selection === 'shutdown' ? null : uuid(2), endpointId: selection === 'shutdown' ? null : uuid(3) } });
  expect(prepared.ok).toBe(true); if (!prepared.ok) throw new Error(JSON.stringify(prepared));
  expect(controller.commit(f.store, prepared.change).ok).toBe(true);
  const dismiss = () => {
    const p = controller.prepareDismissal(f.state(), captureOutcomeContext(f.state())!);
    expect(p.ok).toBe(true); if (!p.ok) throw new Error(JSON.stringify(p)); expect(controller.commit(f.store, p.change).ok).toBe(true);
  };
  return { ...f, controller, dismiss };
}
function capture(f: ReturnType<typeof fixture>, policy: SaveContentPolicy) {
  const checked = captureSafeSnapshot(f.state(), new SaveValidator([policy]));
  expect(checked.ok, JSON.stringify(checked)).toBe(true);
  if (!checked.ok) throw new Error(JSON.stringify(checked)); return checked.capture.snapshot;
}

describe('T086 actual outcome portable save policy', () => {
  it('maps only the two reviewed actual authored caveat facts', () => {
    const policy = introductionSavePolicy(registry, world);
    expect(policy.members.caveat).toEqual([q('FACT-repair-maintenance'), q('FACT-repair-isolation')]);
    const empty = createSaveContentPolicy(registry, world, introductionSaveRules);
    expect(empty.members.caveat).toEqual([]);
  });
  it.each(['missing', 'unloaded', 'duplicate'] as const)('rejects %s caveat fact policy instead of creating membership', fault => {
    const ids = fault === 'missing' ? [q('FACT-invented')] : fault === 'unloaded' ? [q('FACT-reserved-only')] : [q('FACT-repair-maintenance'), q('FACT-repair-maintenance')];
    const content = fault === 'unloaded' ? { ...registry, has: (kind: string, id: string) => id === q('FACT-reserved-only') ? true : registry.has(kind, id) } : registry;
    expect(() => createSaveContentPolicy(content, world, { ...introductionSaveRules, caveatFactIds: ids } as SavePolicyRules)).toThrow();
  });
  it.each(['text', 'room', 'subjects', 'rules', 'freshness'] as const)('rejects changed reviewed caveat %s in actual application policy', field => {
    const content: ContentRegistry = { ...registry, record: id => {
      const room = registry.record(id); if (id !== q('R11') || room?.kind !== 'room') return room;
      return { ...room, evidence: room.evidence.map(f => f.id !== q('FACT-repair-maintenance') ? f : { ...f,
        ...(field === 'text' ? { text: 'Permanent now.' } : field === 'room' ? { roomId: q('R12') } : field === 'subjects' ? { subjectIds: [q('PR102')] }
          : field === 'rules' ? { ruleIds: [q('PHY11')] } : { requiresFreshMeasurement: true }) }) };
    } };
    expect(() => introductionSavePolicy(content, world)).toThrow();
  });
  it.each(['copper', 'fiber', 'radio'] as const)('%s E01 and E02 save only after dismissal, then preserve history after ordinary authored walking', route => {
    const policy = introductionSavePolicy(registry, world), candidates = [];
    for (const selection of ['permanent', 'temporary'] as const) {
      const f = classified(selection, route), accepted = f.state();
      expect(captureSafeSnapshot(accepted, new SaveValidator([policy]))).toMatchObject({ ok: false, code: 'safe-state' });
      f.dismiss(); expect(f.state().runtime.ui?.feedback).toBeNull(); candidates.push(capture(f, policy));
      const event = f.game().outcomeHistory, objectives = f.game().world.completedObjectiveIds;
      expect(f.move('R11').status).toBe('handled'); expect(f.game().world.continueOutcome).toBeNull();
      expect(f.game().outcomeHistory).toEqual(event); expect(f.game().world.completedObjectiveIds).toEqual(objectives);
      candidates.push(capture(f, policy)); expect(f.move('R12').status).toBe('handled');
      expect(f.game().outcomeHistory).toEqual(event); expect(f.game().world.completedObjectiveIds).toEqual(objectives); candidates.push(capture(f, policy));
      expect(f.controller.prepareClassification(f.state(), captureOutcomeContext(f.state())!, {
        actionId: 'never-regrade' as never, eventId: uuid(91) as unknown as OutcomeEventId,
        operation: { kind: 'classify', selection, linkId: uuid(2), endpointId: uuid(3) } })).toMatchObject({ ok: false, reason: 'already-classified' });
    }
    expect(php(policy, candidates)).toEqual(Array.from({ length: 6 }, () => ({ ok: true, code: null })));
  });
  it('E03 world stays unsafe while its history survives actual T084 preparation rollback and validates in JS/PHP', () => {
    const policy = introductionSavePolicy(registry, world), f = classified('shutdown'), before = f.state();
    expect(captureSafeSnapshot(before, new SaveValidator([policy]))).toMatchObject({ ok: false, code: 'safe-state' });
    const rollback = prepareEncounterRollback(before, captureEncounterContext(before)!, registry,
      { actionId: 'continue-isolation' as never, nextAttemptId: uuid(99) as never }, riftPreparationBoundary);
    expect(rollback.ok).toBe(true); if (!rollback.ok) throw new Error(JSON.stringify(rollback));
    expect(commitEncounterChange(f.store, rollback.change).ok).toBe(true);
    expect(f.game().outcomeHistory).toEqual(before.runtime.game!.outcomeHistory);
    expect(f.game().world.completedObjectiveIds).not.toContain(q('O11')); expect(f.game().world.completedObjectiveIds).not.toContain(q('O12'));
    expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true);
    const snapshot = capture(f, policy);
    const invalid = { ...snapshot, outcomeHistory: snapshot.outcomeHistory.map(e => ({ ...e, caveatIds: [q('FACT-O11-plan')] })) };
    expect(new SaveValidator([policy]).validateNewWrite(new TextEncoder().encode(JSON.stringify(invalid)))).toMatchObject({ ok: false, code: 'reference' });
    expect(php(policy, [snapshot, invalid])).toEqual([{ ok: true, code: null }, { ok: false, code: 'reference' }]);
  });
  it('generated production policy also accepts actual E02 and retained E03 history in JS/PHP', () => {
    const policy = JSON.parse(readFileSync(new URL('../../server/content/save-policy.generated.json', import.meta.url), 'utf8')).policies[0] as SaveContentPolicy;
    const temporary = classified('temporary'); temporary.dismiss(); const a = capture(temporary, policy);
    const isolated = classified('shutdown'), before = isolated.state();
    const p = prepareEncounterRollback(before, captureEncounterContext(before)!, registry, { actionId: 'continue' as never, nextAttemptId: uuid(98) as never }, riftPreparationBoundary);
    if (!p.ok) throw new Error(JSON.stringify(p)); expect(commitEncounterChange(isolated.store, p.change).ok).toBe(true);
    const b = capture(isolated, policy); expect(php(policy, [a, b])).toEqual([{ ok: true, code: null }, { ok: true, code: null }]);
  });
});
