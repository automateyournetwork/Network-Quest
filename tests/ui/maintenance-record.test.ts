// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { copySemanticAction } from '../../src/ui/action-bus';
import { evaluateMaintenanceAnswer, maintenanceHistoryUnlocked, type MaintenanceFactId } from '../../src/state/optional-maintenance';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { SaveValidator } from '../../src/services/save-validator';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { createReducerState } from '../../src/state/reducer';
import type { ClientGeneration } from '../../src/state/types';
import { maintenanceFixture, activity, definition, mid, q, registry, world } from './maintenance-fixture';
const all = activity.delivery.factIds;
const submit = (f: ReturnType<typeof maintenanceFixture>, selectedFactIds: readonly MaintenanceFactId[] = all) => f.send({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds } });
const validator = new SaveValidator([introductionSavePolicy(registry, world)]);
const oracle = JSON.parse(readFileSync('tests/fixtures/optional-activities.json', 'utf8'));
describe('SQ04 actual shared notebook controller', () => {
  it('preserves the frozen oracle bytes, empty physics expectations and historical rejected projection', () => {
    const original = JSON.parse(readFileSync('docs/evidence/spec001/optional/SQ04/source-seal.json', 'utf8'));
    const hash = createHash('sha256').update(readFileSync('tests/fixtures/optional-activities.json')).digest('hex');
    expect(JSON.stringify(original)).toContain(hash);
    expect(oracle.activities.find((a: any) => a.activityId === q('SQ04')).ruleIds).toEqual([]);
    expect(definition.ruleIds).toEqual([]); expect(definition.alternatives[0]?.ruleIds).toEqual([]);
  });
  it.each(['R03','R05','R09'] as const)('opens and exits at captured %s with no objective, ally, item or fact gate', room => {
    const f = maintenanceFixture(false, room), s = f.state(), game = f.game();
    f.replace({ ...s, runtime: { ...s.runtime, game: { ...game, world: { ...game.world, completedObjectiveIds: [], inventory: [] } } } });
    const before = structuredClone(f.game()); expect(f.start().status).toBe('handled'); expect(f.controller.project().view?.title).toBe('Lost Maintenance Record');
    expect(f.state().control.optionalActivity).toMatchObject({ timingEnabled: false, entry: { roomId: q(room), safePositionId: q(`${room}.entry`) } });
    expect(f.simple('exit-optional').status).toBe('handled'); expect(f.game()).toEqual(before); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
  it('supplies exactly one practice card, records actual worked help and never earns a source fact', () => {
    const f = maintenanceFixture(), before = structuredClone(f.game()); f.start(); f.mode('practice');
    expect(f.controller.project().view?.maintenance?.cards).toMatchObject([{ factId: all[0], recorded: false, use: 'supplied-practice-only' }]);
    expect(f.controller.project().view?.maintenance?.cards).toHaveLength(1); expect(f.game().assistance).toMatchObject([{ objectiveId: q('SQ04'), hintId: q('HINT-SQ04-step'), level: 2 }]);
    submit(f, [all[0]!]); expect(f.state().control.optionalActivity?.result).toBe('correct'); expect(f.game().world).toEqual(before.world); expect(f.game().notebook).toEqual(before.notebook);
    f.simple('explain-optional'); expect(f.game().assistance).toHaveLength(1);
  });
  it('collects actual sources and awards the exact full history once with no main progress or physical change', () => {
    const f = maintenanceFixture(true); for (const id of all) expect(f.game().notebook.factIds).toContain(id);
    const before = structuredClone(f.game()); f.start(); f.mode('delivery'); expect(submit(f, [...all].reverse()).status).toBe('handled');
    expect(f.game().world.completedQuestIds).toEqual([q('SQ04')]); expect(maintenanceHistoryUnlocked(f.game())).toBe(true);
    expect(f.controller.project().view?.rewardText).toBe(activity.reward.epilogueText); expect(f.game().assistance).toEqual(before.assistance);
    for (const key of ['inventory','activeAllyIds','recruits','completedObjectiveIds','flags','route'] as const) expect(f.game().world[key]).toEqual(before.world[key]);
    expect(f.game().notebook.measurements).toEqual(before.notebook.measurements);
    const complete = f.game(); submit(f); expect(f.game().world).toEqual(complete.world); expect(f.game().notebook.factIds.filter(id => id === q('FACT-SQ04-history'))).toHaveLength(1);
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(false); f.simple('exit-optional'); expect(captureSafeSnapshot(f.state(), validator).ok).toBe(true);
  });
  it('retains notes without treating a missing inspection, room visit or flag as evidence', () => {
    const f = maintenanceFixture(); f.acquire('copper'); f.arrive('R09'); f.acquire('market'); f.arrive('R05');
    const old = f.state(), game = f.game(); f.replace({ ...old, runtime: { ...old.runtime, game: { ...game, world: { ...game.world, flags: { [q<'flag'>('FLAG-fiber-connection')]: 'inspected' } }, notebook: { ...game.notebook, hypotheses: [{ id: mid(9), text: 'The fiber was repaired', attemptId: game.world.attemptId, configurationRevision: game.world.configurationRevision }] as never } } } });
    const before = structuredClone(f.game().notebook); f.start(); f.mode('delivery'); submit(f);
    expect(f.state().control.optionalActivity?.result).toBe('incorrect'); expect(f.game().world.completedQuestIds).toEqual([]); expect(f.game().notebook).toEqual(before);
    expect(f.game().assistance).toMatchObject([{ objectiveId: q('SQ04'), level: 3 }]); expect(f.controller.project().view?.maintenance?.cards.find(c => c.factId === all[1])?.recorded).toBe(false);
    expect(f.controller.project().view?.maintenance?.cards.find(c => c.factId === all[1])?.acquisitionLabel).toBe('Inspect the original connection at the dock before any intervention');
  });
  it('keeps a blank choice distinct from wrong collected choices and never scores prose', () => {
    const f = maintenanceFixture(true); f.start(); f.mode('delivery'); submit(f, []); expect(f.state().control.optionalActivity?.result).toBe('invalid-input'); expect(f.game().assistance).toEqual([]);
    submit(f, [all[0]!]); expect(f.state().control.optionalActivity?.result).toBe('incorrect'); expect(f.game().assistance).toHaveLength(1);
  });
  it('uses real ordinary R05 inspection with its recoverable kit; optional start itself needs no kit', () => {
    const f = maintenanceFixture(false, 'R05'), s = f.state(), game = f.game(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...game, world: { ...game.world, inventory: [] } } } });
    f.acquire('fiber'); expect(f.game().notebook.factIds).not.toContain(all[1]); expect(f.start().status).toBe('handled'); f.simple('exit-optional');
    const changed = f.state(); f.replace({ ...changed, runtime: { ...changed.runtime, game: { ...f.game(), world: { ...f.game().world, inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }] } } } });
    expect(f.acquire('fiber').status).toBe('applied'); expect(f.game().notebook.factIds).toContain(all[1]);
  });
  it('Retry stales a real copper reading but preserves historical learning, notes, help and its own completion', () => {
    const f = maintenanceFixture(true); f.acquire('copper'); f.raw({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'no-op', observations: [], acceptedEffects: [] } });
    expect(f.measure().status).not.toBe('rejected'); expect(f.game().notebook.measurements).toHaveLength(1);
    f.start(); f.mode('practice'); f.mode('delivery'); submit(f); const before = structuredClone(f.game()); f.simple('retry-optional');
    expect(f.game().world.attemptId).not.toBe(before.world.attemptId); expect(f.game().world.configurationRevision).toBeGreaterThan(before.world.configurationRevision);
    expect(f.game().notebook.measurements.every(m => m.stale)).toBe(true); expect(f.game().notebook.factIds).toEqual(before.notebook.factIds); expect(f.game().notebook.personalNotes).toBe(before.notebook.personalNotes);
    expect(f.game().assistance).toEqual(before.assistance); expect(maintenanceHistoryUnlocked(f.game())).toBe(true); f.mode('delivery'); submit(f); expect(f.state().control.optionalActivity?.result).toBe('correct');
  });
  it.each(['mode','account','restore','same-version-replacement'] as const)('rejects captured selections after %s', boundary => {
    const f = maintenanceFixture(true); f.start(); f.mode('delivery'); const command = f.controller.project().capture({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: all } });
    if (boundary === 'mode') f.mode('practice');
    else { const s = f.state(); f.replace(boundary === 'restore' ? createReducerState({ ...s.runtime, game: structuredClone(s.runtime.game), activity: { kind: 'stable-exploration' } })
      : { ...s, runtime: { ...s.runtime, ...(boundary === 'account' ? { auth: { ...s.runtime.auth, clientGeneration: (s.runtime.auth.clientGeneration + 1) as ClientGeneration } } : { game: structuredClone(s.runtime.game) }) } }); }
    const before = f.state(); expect(f.bus.dispatch(command).status).toBe('rejected'); expect(f.state()).toBe(before);
  });
  it.each(['start','practice','submit','hint','retry','exit'] as const)('failed %s CAS installs no partial state', step => {
    const f = maintenanceFixture(true); if (step !== 'start') { f.start(); f.mode('delivery'); } const before = f.state(); f.block(true);
    const result = step === 'start' ? f.start() : step === 'practice' ? f.mode('practice') : step === 'submit' ? submit(f) : f.simple(step === 'retry' ? 'retry-optional' : step === 'hint' ? 'hint-optional' : 'exit-optional');
    expect(result.status).toBe('rejected'); expect(f.state()).toBe(before);
  });
  it('copies closed nested selections and rejects duplicate, unknown, sparse and authority-carrying inputs', () => {
    const mutable = [...all], command = copySemanticAction({ kind: 'submit-optional-maintenance', sessionId: mid(7), answer: { selectedFactIds: mutable } }); mutable.pop(); expect(command).toMatchObject({ answer: { selectedFactIds: all } });
    for (const selectedFactIds of [[all[0],all[0]],['spec001:FACT-other'],new Array(3),[...all,all[0]]]) expect(() => copySemanticAction({ kind: 'submit-optional-maintenance', sessionId: mid(7), answer: { selectedFactIds } } as never)).toThrow();
    for (const key of ['correct','effects','freshVersion','observedFactIds','mode','sourceRoomIds']) expect(() => copySemanticAction({ kind: 'submit-optional-maintenance', sessionId: mid(7), answer: { selectedFactIds: all, [key]: true } } as never)).toThrow();
  });
  it('rejects raw bus captures and generic effect injection without the owning optional transition', () => {
    const f = maintenanceFixture(true); f.start(); f.mode('delivery'); const before = f.state();
    expect(f.bus.dispatch(f.bus.capture({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: all } })).status).toBe('rejected');
    expect(f.raw({ kind: 'apply', evaluation: { status: 'correct', reasonCode: 'forged-award', observations: [], acceptedEffects: definition.effects as never } }).status).toBe('rejected'); expect(f.state()).toBe(before);
  });
  it('retained history alone never exposes completion or epilogue reward', () => {
    const f = maintenanceFixture(true), s = f.state(); f.replace({ ...s, runtime: { ...s.runtime, game: { ...f.game(), notebook: { ...f.game().notebook, factIds: [...f.game().notebook.factIds,q('FACT-SQ04-history')] } } } });
    f.start(); expect(f.controller.project().view?.rewardText).toBeNull(); expect(maintenanceHistoryUnlocked(f.game())).toBe(false); f.mode('delivery'); submit(f); expect(maintenanceHistoryUnlocked(f.game())).toBe(true);
    expect(f.game().notebook.factIds.filter(id => id === q('FACT-SQ04-history'))).toHaveLength(1);
  });
  it('pure predicate executes immutable T092 missing and duplicate cases without any award authority', () => {
    const f = maintenanceFixture(true); for (const value of [all,[all[0]!,all[2]!],[all[0]!,all[0]!,all[2]!]]) {
      const result = evaluateMaintenanceAnswer(activity, registry, 'delivery', { actionId: 'check' as never, expectedVersion: f.game().world, input: { selectedFactIds: value } }, f.game());
      expect(result.status).toBe(value === all ? 'correct' : 'incorrect'); expect(result.acceptedEffects).toEqual([]); expect(result.observations[0]).toMatchObject({ currentRepairProven: false, endToEndServiceProven: false, chronologyProven: false, requiredObjectiveAward: 0 });
    }
  });
});
