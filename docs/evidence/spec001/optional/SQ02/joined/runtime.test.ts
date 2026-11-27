// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Same-loop T097 integration. Only the safe guest starting location is scaffolded;
// answers/effects/captures/receipt/CAS/save validation use actual production code.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import Ajv from 'ajv/dist/2020.js';
import formats from 'ajv-formats';
import { afterAll, describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../../../../../src/app/content';
import { createIntroductionRuntime, startIntroduction } from '../../../../../../src/app/adventure';
import { introductionSavePolicy } from '../../../../../../src/app/save-policy';
import { validateContent } from '../../../../../../src/content/registry';
import { evaluateOptionalAnswer, optionalActivityDefinition, optionalEffectBindings } from '../../../../../../src/state/optional-activities';
import { evaluateAuditAnswer, type PowerAuditAnswer } from '../../../../../../src/state/optional-power-audit';
import { createReducer, createReducerState, type ReducerState, type StateEffect } from '../../../../../../src/state/reducer';
import { createOptionalActivitiesController, type OptionalActivityIntent, projectOptionalActivity } from '../../../../../../src/ui/optional-activities';
import { createActionBus, contextFromRuntime, copySemanticAction } from '../../../../../../src/ui/action-bus';
import { captureSafeSnapshot } from '../../../../../../src/state/snapshot';
import { SaveValidator } from '../../../../../../src/services/save-validator';
import type { ActionId, QualifiedId } from '../../../../../../src/domain/types';
import type { ClientGeneration, SaveSnapshotV1 } from '../../../../../../src/state/types';

const read = (path: string) => readFileSync(new URL(`../../../../../../${path}`, import.meta.url), 'utf8');
const json = (path: string): any => JSON.parse(read(path));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const { registry, world } = loadIntroductionContent();
const definition = optionalActivityDefinition(registry, q('SQ02'))!;
const policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]);
const candidate = json('docs/evidence/spec001/optional/SQ02/SQ02.candidate.json');
const projection = json('docs/evidence/spec001/optional/SQ02/SQ02.current-schema.json');
const originalSeal = json('docs/evidence/spec001/optional/SQ02/source-seal.json');
const oracle = json('tests/fixtures/optional-activities.json');
const receipts: Record<string, unknown> = {};
function fixture() {
  const runtime = startIntroduction(createIntroductionRuntime(), registry), original = runtime.game!;
  let state = createReducerState({ ...runtime, game: { ...original, world: { ...original.world,
    roomId: q('R09'), position: { safePositionId: q('R09.entry') }, completedObjectiveIds: [q('O01'), q('O02')],
    inventory: [{ itemId: q('ITEM-inspection-kit'), quantity: 1 }],
  }, notebook: { ...original.notebook, personalNotes: 'Keep this independent audit note.' } } });
  let blocked = false, commits = 0;
  const reduce = createReducer({ registry, bindings: optionalEffectBindings(definition) });
  const store = { getState: () => state, reduce, compareAndSet(before: ReducerState, next: ReducerState) {
    if (blocked || state !== before) return false; state = next; commits++; return true;
  } };
  const bus = createActionBus({ getContext: () => contextFromRuntime(state.runtime) });
  const controller = createOptionalActivitiesController({ registry, store, bus, activityIds: [q('SQ02')] });
  const send = (intent: OptionalActivityIntent) => bus.dispatch(controller.project().capture(intent));
  const sessionId = () => state.control.optionalActivity!.sessionId;
  const start = () => send({ kind: 'start-optional', activityId: q('SQ02'), hotspotId: q('HOTSPOT-market-eel') });
  const mode = (mode: 'practice' | 'delivery') => send({ kind: 'choose-optional-mode', sessionId: sessionId(), mode });
  const power = (assessment: 'within-budget' | 'over-budget', value: number) => send({ kind: 'submit-optional-power', sessionId: sessionId(), answer: { assessment, difference: { value, unit: 'W' } } });
  const simple = (kind: 'hint-optional' | 'explain-optional' | 'boundary-optional' | 'retry-optional' | 'exit-optional') => send({ kind, sessionId: sessionId() });
  return { state: () => state, store, bus, controller, send, start, mode, power, simple, sessionId,
    commits: () => commits, block: (value: boolean) => { blocked = value; }, replace: (value: ReducerState) => { state = value; } };
}
const answer = (assessment: 'within-budget' | 'over-budget', value: number): PowerAuditAnswer => ({ assessment, difference: { value, unit: 'W' } });
const action = (input: unknown, game = fixture().state().runtime.game!) => ({ actionId: 'sq02-joined-answer' as ActionId, expectedVersion: game.world, input });
const safeCapture = (f: ReturnType<typeof fixture>) => {
  const captured = captureSafeSnapshot(f.state(), validator); expect(captured.ok, JSON.stringify(captured)).toBe(true);
  if (!captured.ok) throw new Error('Expected a valid real snapshot'); return captured.capture.snapshot;
};
afterAll(() => writeFileSync(new URL('./runtime-receipts.json', import.meta.url), JSON.stringify({
  scope: 'Actual production SQ02 rule/controller/bus/reducer/CAS/snapshot and isolated JS/PHP validator observations. Safe R09 starting state is scaffolded; no browser or provider execution in this test.', receipts,
}, null, 2) + '\n'));

describe('SQ02 exact promotion and source preservation', () => {
  it('preserves original authoring bytes and explicitly promotes the full candidate once', () => {
    expect(createHash('sha256').update(read('docs/evidence/spec001/optional/SQ02/source-seal.json')).digest('hex')).toBe('9fc019673fd486ba53848f706d83f8574c200b7f33935011c7d32180e4220772');
    for (const artifact of originalSeal.owned.filter((row: any) => row.path.startsWith('docs/evidence/spec001/optional/SQ02/'))) {
      expect(createHash('sha256').update(read(artifact.path)).digest('hex'), artifact.path).toBe(artifact.sha256);
    }
    for (const path of ['tests/fixtures/optional-activities.json', 'tests/fixtures/physical-cases.json', 'tests/fixtures/companions.json', 'content/spec001/sources.json']) {
      expect(createHash('sha256').update(read(path)).digest('hex')).toBe(originalSeal.dependencies.find((row: any) => row.path === path).sha256);
    }
    expect(read('content/spec001/quests/SQ02.json')).toBe(read('docs/evidence/spec001/optional/SQ02/SQ02.candidate.json'));
    expect(definition).toEqual(candidate); const { optionalActivity: _payload, ...base } = definition; expect(base).toEqual(projection);
    expect(world.documents.filter(d => d.id === q('SQ02'))).toEqual([{ kind: 'quest', id: q('SQ02'), path: 'content/spec001/quests/SQ02.json' }]);
    const ajv = new Ajv({ strict: true, allErrors: true }); formats(ajv);
    const oldSchema = ajv.compile(json('docs/evidence/spec001/optional/framework/content-schema-before-T100.json'));
    expect(oldSchema(projection)).toBe(true); expect(oldSchema(candidate)).toBe(false);
  });
  it('rejects aliased source demands, reward identity, receipt and main-objective effects in the real current registry', () => {
    const badCases: [string, (record: any) => void][] = [
      ['demand', r => r.optionalActivity.delivery.demands[2].value = 9], ['source', r => r.optionalActivity.delivery.sourceCaseId = 'B-POWER-30'],
      ['boundary', r => r.optionalActivity.practice.budgetBoundary = 'source-output'], ['reward', r => r.optionalActivity.reward.assetId = q('ASSET-PR140')],
      ['receipt', r => r.effects[1].questId = q('SQ01')], ['main', r => r.effects.push({ kind: 'complete-objective', effectId: q('EFFECT-SQ02-forged'), objectiveId: q('O09') })],
    ];
    for (const [label, mutate] of badCases) {
      const documents = Object.fromEntries([...new Set(world.documents.map(d => d.path))].map(path => [path, json(path)]));
      mutate(documents['content/spec001/quests/SQ02.json']);
      const result = validateContent({ world, sources: json('content/spec001/sources.json'), documents });
      expect(result.ok, label).toBe(false);
    }
  });
});

describe('SQ02 actual power diagnostics and captured lifecycle', () => {
  it('preserves physical incorrect/learner correct for T10 and executes both reviewed fit boundaries', () => {
    const game = fixture().state().runtime.game!, expected = oracle.cases.find((row: any) => row.id === 'OPT-SQ02-DIAGNOSE').expected;
    const full = evaluateOptionalAnswer(registry, definition, 'delivery', action(answer('over-budget', 3), game), game);
    expect(full.evaluation.status).toBe(expected.learnerStatus);
    expect(full.evaluation.observations[0]).toMatchObject({ planStatus: expected.planStatus, learnerStatus: expected.learnerStatus,
      plan: { total: expected.total, excess: expected.excess }, dataLinkProven: false, repaired: false });
    expect(full.evaluation.acceptedEffects).toEqual(definition.effects); receipts['OPT-SQ02-DIAGNOSE'] = full;
    const practice = evaluateOptionalAnswer(registry, definition, 'practice', action(answer('within-budget', 7), game), game);
    expect(practice.evaluation.observations[0]).toMatchObject({ planStatus: 'correct', plan: { total: { value: 23, unit: 'W' }, headroom: { value: 7, unit: 'W' } }, dataLinkProven: false });
    expect(practice.evaluation.acceptedEffects).toEqual([]); receipts['C-POWER-practice'] = practice;
    if (definition.optionalActivity.kind !== 'delivered-power-audit') throw new Error('Expected actual power variant');
    const { explanation: _text, ...boundary } = definition.optionalActivity.boundaryExample;
    const profile = registry.record(definition.optionalActivity.profileId);
    const exact = evaluateAuditAnswer(boundary, profile, action(answer('within-budget', 0), game), game.world);
    expect(exact.status).toBe('correct'); expect(exact.observations[0]).toMatchObject({ planStatus: 'correct', plan: { total: { value: 30, unit: 'W' }, headroom: { value: 0, unit: 'W' } }, dataLinkProven: false });
    expect(exact.acceptedEffects).toEqual([]); receipts['B-POWER-30'] = exact;
  });
  it('handles blank, wrong, practice and boundary help before one full diagnosis, preserving inventory/main/party and save state', () => {
    const f = fixture(), original = f.state().runtime.game!, slot = f.state().runtime.persistence;
    expect(f.start().status).toBe('handled'); expect(f.state().control.optionalActivity?.timingEnabled).toBe(false);
    expect(f.controller.project().view?.rewardText).toBeNull(); f.mode('practice');
    expect(f.power('within-budget', 7).status).toBe('handled'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([]);
    expect(f.simple('boundary-optional').status).toBe('handled'); expect(f.controller.project().view?.hintText).toContain('0 W headroom');
    expect(f.state().runtime.game!.assistance).toMatchObject([{ objectiveId: q('SQ02'), hintId: q('HINT-SQ02-step'), level: 2 }]);
    f.mode('delivery'); f.send({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: { assessment: null, difference: null } });
    expect(f.state().control.optionalActivity?.result).toBe('invalid-input'); expect(f.controller.project().view?.feedback).toContain('No answer has been judged');
    f.power('within-budget', 0); expect(f.state().control.optionalActivity?.result).toBe('incorrect'); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([]);
    expect(f.state().runtime.game!.assistance.at(-1)).toMatchObject({ objectiveId: q('SQ02'), hintId: q('HINT-SQ02-solution'), level: 3 });
    expect(f.power('over-budget', 3).status).toBe('handled'); expect(f.state().control.optionalActivity?.result).toBe('correct');
    const completed = f.state().runtime.game!; expect(completed.world.completedQuestIds).toEqual([q('SQ02')]); expect(completed.notebook.factIds).toContain(q('FACT-SQ02-audit'));
    expect(f.controller.project().view?.feedback).toContain('proposal remains over budget'); expect(f.controller.project().view?.rewardText).toContain('picture cannot be displayed');
    for (const key of ['inventory', 'completedObjectiveIds', 'recruits', 'activeAllyIds', 'route', 'flags'] as const) expect(completed.world[key]).toEqual(original.world[key]);
    expect(f.state().runtime.persistence.pendingRequest).toBe(slot.pendingRequest);
    expect(captureSafeSnapshot(f.state(), validator).ok).toBe(false); const gameBeforeExit = f.state().runtime.game;
    expect(f.simple('exit-optional').status).toBe('handled'); expect(f.state().runtime.game).toBe(gameBeforeExit);
    expect(f.state().runtime.game!.world.roomId).toBe(q('R09')); expect(f.state().runtime.game!.world.position.safePositionId).toBe(q('R09.entry'));
    receipts['full-captured-flow-snapshot'] = safeCapture(f);
  });
  it('rejects failed answer CAS atomically, copied-answer mutation and stale mode captures; repeated receipts grant once', () => {
    const f = fixture(); f.start(); f.mode('delivery');
    const mutable = answer('over-budget', 3) as { assessment: 'over-budget'; difference: { value: number; unit: 'W' } };
    const captured = f.controller.project().capture({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: mutable });
    mutable.difference.value = 99; expect(captured.input).toMatchObject({ answer: { difference: { value: 3 } } }); const before = f.state(); f.block(true);
    expect(f.bus.dispatch(captured).status).toBe('rejected'); expect(f.state()).toBe(before); expect(f.controller.project().view?.rewardText).toBeNull();
    f.block(false); const stale = f.controller.project().capture({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: answer('over-budget', 3) });
    f.mode('practice'); expect(f.bus.dispatch(stale).status).toBe('rejected'); f.mode('delivery');
    const fresh = f.controller.project().capture({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: answer('over-budget', 3) });
    const count = f.commits(); expect(f.bus.dispatch(fresh).status).toBe('handled'); const accepted = f.state();
    expect(f.bus.dispatch(fresh).status).toBe('handled'); expect(f.state()).toBe(accepted); expect(f.commits()).toBe(count + 1);
    f.power('over-budget', 3); expect(f.state().runtime.game!.world.completedQuestIds).toEqual([q('SQ02')]);
    expect(f.state().runtime.game!.notebook.factIds.filter(id => id === q('FACT-SQ02-audit'))).toHaveLength(1);
    expect(copySemanticAction({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: answer('over-budget', 3) })).toMatchObject({ answer: { difference: { value: 3 } } });
    expect(() => copySemanticAction({ kind: 'submit-optional-power', sessionId: f.sessionId(), answer: answer('over-budget', 3), acceptedEffects: definition.effects } as never)).toThrow();
  });
  it('selects the full receipt only in the correct power mode and refuses forged raw effects', () => {
    const f = fixture(); f.start(); f.mode('delivery');
    const before = f.state(), game = before.runtime.game!;
    expect(f.send({ kind: 'submit-optional', sessionId: f.sessionId(), bits: '3' }).status).toBe('rejected');
    const raw = f.store.reduce(before, { actionId: 'forged-audit' as ActionId, adventureId: game.adventureId, expectedVersion: game.world,
      input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'forged', observations: [], acceptedEffects: definition.effects as StateEffect[] } } });
    expect(raw.status).toBe('rejected'); expect(raw.state).toBe(before);
    const broken = structuredClone(definition); (broken.effects as StateEffect[]).pop();
    const result = evaluateOptionalAnswer(registry, broken, 'delivery', action(answer('over-budget', 3), game), game);
    expect(result.evaluation.status).toBe('content-error'); expect(result.evaluation.acceptedEffects).toEqual([]);
  });
  it('retries with fresh attempt/revision, retains clues/notes/help and accepted completion, then exits and replays once', () => {
    const f = fixture(); f.start(); f.mode('delivery'); f.simple('hint-optional'); f.power('over-budget', 3);
    const accepted = f.state().runtime.game!, oldCapture = f.controller.project().capture({ kind: 'exit-optional', sessionId: f.sessionId() });
    expect(f.simple('retry-optional').status).toBe('handled'); const retried = f.state().runtime.game!;
    expect(retried.world.attemptId).not.toBe(accepted.world.attemptId); expect(retried.world.configurationRevision).toBeGreaterThan(accepted.world.configurationRevision);
    expect(retried.world.completedQuestIds).toEqual([q('SQ02')]); expect(retried.notebook).toEqual(accepted.notebook); expect(retried.assistance).toEqual(accepted.assistance);
    expect(f.bus.dispatch(oldCapture).status).toBe('rejected'); expect(f.controller.project().view?.rewardText).toBeTruthy();
    f.simple('exit-optional'); const safe = safeCapture(f); f.start(); f.mode('delivery'); f.power('over-budget', 3);
    expect(f.controller.project().view?.feedback).toContain('already recorded'); f.simple('exit-optional');
    expect(safeCapture(f).world.completedQuestIds).toEqual(safe.world.completedQuestIds);
  });
  it('requires both fact and quest for the actual reward projection and retires account/replacement callbacks', () => {
    const f = fixture(); f.start(); const session = f.state().control.optionalActivity!, game = f.state().runtime.game!;
    const factOnly = { ...game, notebook: { ...game.notebook, factIds: [q<'fact'>('FACT-SQ02-audit')] } };
    const questOnly = { ...game, world: { ...game.world, completedQuestIds: [q<'quest'>('SQ02')] } };
    expect(projectOptionalActivity(registry, factOnly, session)?.rewardText).toBeNull(); expect(projectOptionalActivity(registry, questOnly, session)?.rewardText).toBeNull();
    const captured = f.controller.project().capture({ kind: 'choose-optional-mode', sessionId: session.sessionId, mode: 'delivery' });
    const previous = f.state(); f.replace({ ...previous, runtime: { ...previous.runtime, auth: { ...previous.runtime.auth, clientGeneration: (previous.runtime.auth.clientGeneration + 1) as ClientGeneration } } });
    expect(f.bus.dispatch(captured).status).toBe('rejected'); expect(f.controller.project().view).toBeNull();
    const replaced = f.state(); f.controller.invalidate(); expect(f.state()).toBe(replaced);
  });
});

describe('SQ02 real safe snapshot and differential PHP policy', () => {
  it('accepts SQ02 hints/reward membership, rejects forged owners/levels/aliases, and preserves ordinary snapshots', () => {
    const f = fixture(), baseline = safeCapture(f); f.start(); f.simple('hint-optional'); f.mode('practice'); f.power('within-budget', 7); f.mode('delivery'); f.simple('explain-optional'); f.power('over-budget', 3); f.simple('exit-optional');
    const snapshot = safeCapture(f), generated = json('server/content/save-policy.generated.json');
    expect(generated.policies).toContainEqual(policy); expect(policy.lessonSources).toContain(q('SQ02'));
    expect(policy.members.quest).toContain(q('SQ02')); expect(policy.members.fact).toContain(q('FACT-SQ02-audit'));
    expect(policy.members.objective).not.toContain(q('SQ02'));
    expect(policy.hints[q('HINT-SQ02-method')]).toEqual({ objectiveId: q('SQ02'), level: 1 });
    expect(policy.hints[q('HINT-SQ02-step')]).toEqual({ objectiveId: q('SQ02'), level: 2 });
    expect(policy.hints[q('HINT-SQ02-solution')]).toEqual({ objectiveId: q('SQ02'), level: 3 });
    const inputs: [string, SaveSnapshotV1 | unknown][] = [
      ['ordinary-before-audit', baseline], ['earned-audit', snapshot],
      ['wrong-hint-owner', { ...snapshot, assistance: [{ ...snapshot.assistance[0], objectiveId: q('O09') }] }],
      ['wrong-hint-level', { ...snapshot, assistance: [{ ...snapshot.assistance[0], level: 3 }] }],
      ['other-quest-hint', { ...snapshot, assistance: [{ ...snapshot.assistance[0], hintId: q('HINT-SQ01-method') }] }],
      ['quest-as-main-objective', { ...snapshot, world: { ...snapshot.world, completedObjectiveIds: [...snapshot.world.completedObjectiveIds, q('SQ02')] } }],
      ['invented-reward-fact', { ...snapshot, notebook: { ...snapshot.notebook, factIds: [...snapshot.notebook.factIds, q('FACT-SQ02-invented')] } }],
      ['retained-fact-only-valid-no-reward', { ...snapshot, world: { ...snapshot.world, completedQuestIds: [] } }],
    ];
    const js = inputs.map(([name, value]) => { const result = validator.validateNewWrite(new TextEncoder().encode(JSON.stringify(value))); return { name, ok: result.ok, code: result.ok ? null : result.code }; });
    const code = `require 'server/vendor/autoload.php'; require 'server/src/SaveValidator.php';
      $in=json_decode(stream_get_contents(STDIN)); $v=new NetworkQuest\\SaveValidator([$in->policy]); $rows=[];
      foreach($in->inputs as $row) { $r=$v->validateNewWrite(json_encode($row[1],JSON_THROW_ON_ERROR)); $rows[]=['name'=>$row[0],'ok'=>$r->ok,'code'=>$r->code]; }
      echo json_encode(['php'=>PHP_VERSION,'rows'=>$rows],JSON_THROW_ON_ERROR);`;
    const process = spawnSync('/opt/homebrew/opt/php@8.4/bin/php', ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', code], {
      encoding: 'utf8', input: JSON.stringify({ policy, inputs }), env: { PATH: '/usr/bin:/bin', LANG: 'C', LC_ALL: 'C' }, timeout: 10000,
    });
    expect(process.status, process.stderr).toBe(0); const php = JSON.parse(process.stdout); expect(php.php).toBe('8.4.28'); expect(php.rows).toEqual(js);
    expect(js.map(r => r.ok)).toEqual([true, true, false, false, false, false, false, true]); receipts['JS-PHP-policy'] = { php: php.php, rows: js };
    expect(snapshot).not.toHaveProperty('optionalActivity'); expect(snapshot).not.toHaveProperty('control'); expect(f.state().runtime.persistence.pendingRequest).toBeNull();
  });
});
