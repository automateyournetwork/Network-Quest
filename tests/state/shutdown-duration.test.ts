// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { introductionSavePolicy } from '../../src/app/save-policy';
import type { OutcomeEventId } from '../../src/domain/types';
import { SaveValidator } from '../../src/services/save-validator';
import type { SaveContentPolicy } from '../../src/services/save-validator';
import { captureOutcomeContext, createOutcomeController } from '../../src/state/outcomes';
import { prepareRepairPlanChange, repairFlags } from '../../src/state/repair-plan';
import { isActiveRiftEncounter } from '../../src/state/rift-encounter';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { contextFromRuntime, createActionBus } from '../../src/ui/action-bus';
import { createRepairPlanController } from '../../src/ui/repair-plan';
import { createRecoveryController } from '../../src/ui/recovery';
import { fixture, q, registry, uuid, world } from './outcome-fixture';

const noDurationReview = 'repair:review:shutdown:not-applicable:correct';
function prepare(route: 'copper' | 'fiber' | 'radio' = 'copper', prior?: 'permanent' | 'temporary') {
  const f = fixture(route);
  if (prior) f.choose(`duration-${prior}`);
  f.choose('plan-shutdown'); f.choose('read-plan'); f.choose('record-isolation');
  return f; // Deliberately do not call fixture.prepare: its old default hid this bug.
}
function phpValidate(policy: SaveContentPolicy, candidates: readonly unknown[]) {
  const code = `require 'server/vendor/autoload.php'; require 'server/src/SaveValidator.php';
    if(PHP_VERSION!=='8.4.28')throw new RuntimeException('Expected pinned PHP');
    $in=json_decode(stream_get_contents(STDIN),flags:JSON_THROW_ON_ERROR); $v=new NetworkQuest\\SaveValidator([$in->policy]);
    $out=[];foreach($in->candidates as $candidate){$r=$v->validateNewWrite(json_encode($candidate,JSON_THROW_ON_ERROR));$out[]=['ok'=>$r->ok,'code'=>$r->code];}echo json_encode($out,JSON_THROW_ON_ERROR);`;
  const result = spawnSync('/opt/homebrew/opt/php@8.4/bin/php', ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', code], {
    cwd: new URL('../../', import.meta.url), input: JSON.stringify({ policy, candidates }), encoding: 'utf8', timeout: 10000,
    env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' } });
  expect(result.status, result.stderr).toBe(0); return JSON.parse(result.stdout);
}

describe('T086 actual E03 isolation has no installation duration', () => {
  it('projects a current review with duration null after the actual no-duration UI action sequence', () => {
    const f = fixture(), bus = createActionBus({ getContext: () => contextFromRuntime(f.state().runtime) });
    const controller = createRepairPlanController({ registry, store: f.store, bus, resolveScenario: f.resolver });
    for (const name of ['plan-shutdown', 'read-plan', 'record-isolation']) expect(bus.dispatch(bus.capture({ kind: 'choose-repair-plan', choiceId: q(`ACTION-repair-${name}`) })).status).toBe('handled');
    expect(bus.dispatch(bus.capture({ kind: 'review-repair-plan' })).status).toBe('handled');
    const projection = controller.project();
    expect(projection.view.duration).toBeNull(); expect(projection.view.reviewId).not.toBeNull();
    expect(f.game().notebook.measurements.at(-1)?.conclusionCode).toBe(noDurationReview);
    expect(Object.hasOwn(f.game().world.flags, repairFlags.duration)).toBe(false);
    controller.dispose(); bus.dispose();
  });
  it.each(['copper', 'fiber', 'radio'] as const)('%s no-duration isolation executes, classifies E03, confirms real recovery and saves its retained history in JS/PHP', route => {
    const f = prepare(route); expect(f.review().evaluation?.status).toBe('correct');
    const preparation = f.game().world; expect(f.execute().result.status).toBe('handled');
    expect(isActiveRiftEncounter(f.state())).toBe(true);
    expect(f.state().runtime.checkpoint!.world).toEqual(preparation);
    expect(Object.hasOwn(f.game().world.flags, repairFlags.duration)).toBe(false);
    expect(f.move('R12').status).toBe('handled'); f.choose('read-classification');
    const outcomes = createOutcomeController({ registry, repairScenario: f.resolver });
    const p = outcomes.prepareClassification(f.state(), captureOutcomeContext(f.state())!, { actionId: 'isolate' as never,
      eventId: uuid(90) as unknown as OutcomeEventId, operation: { kind: 'classify', selection: 'shutdown', linkId: null, endpointId: null } });
    expect(p.ok).toBe(true); if (!p.ok) throw new Error(JSON.stringify(p)); expect(outcomes.commit(f.store, p.change).ok).toBe(true);
    expect(outcomes.feedback(f.state())).toMatchObject({ outcome: 'E03', restoredService: false });
    const policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
    expect(captureSafeSnapshot(f.state(), validator)).toMatchObject({ ok: false, code: 'safe-state' });
    let changed = 0, after = 0;
    const recovery = createRecoveryController({ registry, store: f.store, outcomes, hazards: { failure: () => null },
      restore: { available: () => false, continue: () => { throw new Error('No restore'); }, signIn: () => { throw new Error('No sign-in'); } },
      changed: () => { changed++; }, afterRollback: () => { after++; } });
    const command = recovery.capture('continue'); expect(command).not.toBeNull();
    expect(recovery.request(command!)).toMatchObject({ ok: true, action: 'confirmation' });
    expect(recovery.confirm(recovery.project()!)).toMatchObject({ ok: true, action: 'rollback' });
    expect(changed).toBe(2); expect(after).toBe(1);
    expect(f.game().outcomeHistory).toMatchObject([{ outcome: 'E03', caveatIds: [q('FACT-repair-isolation')] }]);
    expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true);
    expect(Object.hasOwn(f.game().world.flags, repairFlags.duration)).toBe(false);
    const saved = captureSafeSnapshot(f.state(), validator); expect(saved.ok, JSON.stringify(saved)).toBe(true);
    if (!saved.ok) throw new Error(JSON.stringify(saved));
    expect(phpValidate(policy, [saved.capture.snapshot])).toEqual([{ ok: true, code: null }]);
    recovery.dispose();
  });
  it.each(['permanent', 'temporary'] as const)('prior %s selection stays in world/checkpoint but does not give isolation a temporary dependency', prior => {
    const f = prepare('copper', prior); expect(f.review().evaluation?.status).toBe('correct');
    expect(f.game().notebook.measurements.at(-1)?.conclusionCode).toBe(noDurationReview);
    const execution = f.execute(); expect(execution.result.status).toBe('handled');
    expect(execution.evaluation?.observations).toContainEqual({ kind: 'intervention', plan: 'shutdown', temporaryDependency: false,
      restoredService: false, finalValidationRequired: true });
    expect(f.game().world.flags[repairFlags.duration]).toBe(prior);
    expect(f.state().runtime.checkpoint!.world.flags[repairFlags.duration]).toBe(prior); expect(isActiveRiftEncounter(f.state())).toBe(true);
  });
  it.each(['copper-section', 'copper-alternate', 'fiber-A', 'fiber-B', 'radio-A', 'radio-B'])('%s still requires an installation duration', plan => {
    const f = fixture(plan.startsWith('fiber') ? 'fiber' : plan.startsWith('radio') ? 'radio' : 'copper');
    f.choose(`plan-${plan}`); f.choose('read-plan'); const before = f.state();
    expect(f.review().result).toMatchObject({ status: 'rejected', reason: 'invalid-input' }); expect(f.state()).toBe(before);
    for (const value of ['not-applicable', 'unknown', false, null, undefined]) {
      f.replace({ ...before, runtime: { ...before.runtime, game: { ...before.runtime.game!, world: { ...before.runtime.game!.world,
        flags: { ...before.runtime.game!.world.flags, [repairFlags.duration]: value } as never } } } });
      const invalid = f.state(); expect(f.review().result).toMatchObject({ status: 'rejected', reason: 'invalid-input' }); expect(f.state()).toBe(invalid);
    }
  });
  it.each(['not-applicable', 'unknown', false, null, undefined])('rejects a present invalid duration value %s even for shutdown', value => {
    const f = prepare(), s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), world: { ...f.game().world,
      flags: { ...f.game().world.flags, [repairFlags.duration]: value } as never } } } });
    const before = f.state(); expect(f.review().result).toMatchObject({ status: 'rejected', reason: 'invalid-input' }); expect(f.state()).toBe(before);
  });
  it('a prior review does not regain freshness when an unrelated duration choice changes', () => {
    const f = prepare(); expect(f.review().evaluation?.status).toBe('correct'); f.choose('duration-permanent');
    expect(f.execute().evaluation?.reasonCode).toBe('stale-evidence'); expect(f.game().world.completedObjectiveIds).not.toContain(q('O11'));
    expect(f.review(2).evaluation?.status).toBe('correct'); expect(f.execute(2).result.status).toBe('handled');
  });
  it.each(['current-presence', 'checkpoint-presence', 'value', 'undefined-presence'] as const)('requires exact checkpoint duration consistency: %s', mutation => {
    const f = prepare('copper', mutation === 'value' ? 'temporary' : undefined); f.review(); expect(f.execute().result.status).toBe('handled');
    const s = f.state(), checkpoint = s.runtime.checkpoint!, game = f.game();
    f.replace({ ...s, runtime: { ...s.runtime,
      game: mutation === 'current-presence' ? { ...game, world: { ...game.world, flags: { ...game.world.flags, [repairFlags.duration]: 'permanent' } } } : game,
      checkpoint: mutation === 'current-presence' ? checkpoint : { ...checkpoint, world: { ...checkpoint.world,
        flags: { ...checkpoint.world.flags, [repairFlags.duration]: mutation === 'undefined-presence' ? undefined : 'permanent' } as never } } } });
    expect(isActiveRiftEncounter(f.state())).toBe(false);
    expect(f.move('R12').status).not.toBe('handled');
  });
  it('retains original shutdown proof codes for historical saves, while adding not-applicable only to shutdown review', () => {
    const policy = introductionSavePolicy(registry, world), f = prepare(); expect(f.review().evaluation?.status).toBe('correct');
    expect(f.game().notebook.measurements).toHaveLength(1);
    const capture = captureSafeSnapshot(f.state(), new SaveValidator([policy])); expect(capture.ok).toBe(true);
    if (!capture.ok) throw new Error(JSON.stringify(capture)); const snapshot = capture.capture.snapshot;
    const variants = ['not-applicable', 'permanent', 'temporary'].map(duration => ({ ...snapshot, notebook: { ...snapshot.notebook,
      measurements: snapshot.notebook.measurements.map(m => ({ ...m, conclusionCode: `repair:review:shutdown:${duration}:correct` })) } }));
    for (const candidate of variants) expect(new SaveValidator([policy]).validateNewWrite(new TextEncoder().encode(JSON.stringify(candidate))).ok).toBe(true);
    expect(phpValidate(policy, variants)).toEqual(variants.map(() => ({ ok: true, code: null })));
    expect(Object.values(policy.measurementRules).flatMap(p => p.conclusionCodes).filter(code => code.includes(':not-applicable:'))).toEqual([
      'repair:review:shutdown:not-applicable:correct', 'repair:review:shutdown:not-applicable:incorrect']);
  });
  it('generated production policy accepts the new review and retains both legacy durations', () => {
    const artifact = JSON.parse(readFileSync(new URL('../../server/content/save-policy.generated.json', import.meta.url), 'utf8')) as { policies: SaveContentPolicy[] };
    const policy = artifact.policies[0]!, f = prepare();
    expect(f.review().evaluation?.status).toBe('correct');
    const capture = captureSafeSnapshot(f.state(), new SaveValidator([policy])); expect(capture.ok).toBe(true);
    if (!capture.ok) throw new Error(JSON.stringify(capture));
    expect(phpValidate(policy, [capture.capture.snapshot])).toEqual([{ ok: true, code: null }]);
    const codes = policy.measurementRules['spec001:STATE04']!.conclusionCodes;
    for (const duration of ['permanent', 'temporary', 'not-applicable']) expect(codes).toContain(`repair:review:shutdown:${duration}:correct`);
  });
  it('an invented duration token in otherwise-current proof cannot execute isolation', () => {
    const f = prepare(); expect(f.review().evaluation?.status).toBe('correct'); const s = f.state();
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), notebook: { ...f.game().notebook,
      measurements: f.game().notebook.measurements.map(m => ({ ...m, conclusionCode: 'repair:review:shutdown:none:correct' })) } } } });
    expect(prepareRepairPlanChange(registry, f.resolver, f.game(), { kind: 'execute', reviewId: uuid(1), warningAcknowledged: true }))
      .toMatchObject({ ok: true, evaluation: { status: 'incorrect', reasonCode: 'measurement-provenance-mismatch' } });
  });
});
