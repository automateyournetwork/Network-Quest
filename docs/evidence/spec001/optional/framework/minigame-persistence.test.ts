// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Synthetic schema-valid mapping fixture. This does not author MG01 gameplay or
// expose it in production: it exercises the shared durable completion contract.
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { expect, it } from 'vitest';
import { validateContent } from '../../../../../src/content/registry';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import { createReducer, createReducerState, type EffectBinding, type StateEffect } from '../../../../../src/state/reducer';
import { conditionSatisfied } from '../../../../../src/state/conditions';
import { createSaveContentPolicy, SaveValidator } from '../../../../../src/services/save-validator';
import { captureSafeSnapshot } from '../../../../../src/state/snapshot';
import type { ActionId, QualifiedId } from '../../../../../src/domain/types';
import type * as S from '../../../../../src/content/schema-types.generated';
const json = (path: string): any => JSON.parse(readFileSync(new URL(`../../../../../${path}`, import.meta.url), 'utf8'));
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
const identity = q('MG01'), achievement = q<'achievement'>('ACHIEVEMENT-test-MG01');
function fixture() {
  const world = json('content/spec001/world.json') as S.world, source = json('content/spec001/sources.json');
  const record = JSON.parse(JSON.stringify(json('docs/evidence/spec001/optional/SQ01/SQ01.current-schema.json')).replaceAll('SQ01', 'MG01'));
  record.kind = 'minigame'; record.completionAchievementId = achievement;
  record.instructions = 'Synthetic mapping fixture only.'; record.practiceExplanation = 'No practice scored by this fixture.';
  record.retryExplanation = 'Synthetic mapping fixture only.'; record.exitExplanation = 'Synthetic mapping fixture only.';
  record.timingDefault = 'off'; record.timingUnlock = 'after-untimed-completion'; record.requiredScoreForMainStory = false;
  record.effects = record.effects.map((effect: any) => effect.kind === 'complete-quest'
    ? { kind: 'complete-minigame', effectId: effect.effectId, minigameId: identity } : effect);
  const path = 'content/spec001/minigames/MG01.json';
  const documents = Object.fromEntries(world.documents.map(ref => [ref.path, json(ref.path)]));
  world.documents.push({ kind: 'minigame', id: identity, path }); documents[path] = record;
  const input = { world, sources: source, documents }, loaded = validateContent(input);
  expect(loaded.ok, JSON.stringify(loaded.issues)).toBe(true); if (!loaded.ok || !loaded.registry) throw Error('Mapping fixture invalid');
  const registry = loaded.registry, runtime = startIntroduction(createIntroductionRuntime(), registry), state = createReducerState(runtime);
  const bindings = record.effects.map((effect: StateEffect) => ({ sourceId: identity, effectId: effect.effectId, mode: 'once', receipt: { kind: 'minigame', id: identity } })) as EffectBinding[];
  const reduce = createReducer({ registry, bindings });
  const apply = (before: typeof state, effects: StateEffect[] = record.effects) => reduce(before, { actionId: crypto.randomUUID() as ActionId,
    adventureId: runtime.game!.adventureId, expectedVersion: before.runtime.game!.world,
    input: { kind: 'apply', evaluation: { status: 'correct', reasonCode: 'trusted-mapping-mechanism-test', observations: [], acceptedEffects: effects } } });
  return { registry, record, input, state, apply, policy: createSaveContentPolicy(registry, world, { itemMaxQuantities: {}, measurementRules: {}, unsafeFlags: {} }) };
}
it('atomically completes only the registered minigame achievement, with exact once-only replay and no main objective', () => {
  const f = fixture(); expect(f.apply(f.state, f.record.effects.slice(0, 1)).status).toBe('rejected');
  const accepted = f.apply(f.state); expect(accepted.status).toBe('applied'); const game = accepted.state.runtime.game!;
  expect(game.world.achievementIds).toEqual([achievement]); expect(game.world.completedObjectiveIds).toEqual([]); expect(game.world.completedQuestIds).toEqual([]);
  expect(game.notebook.factIds).toContain(q('FACT-MG01-delivery')); expect(conditionSatisfied({ kind: 'minigame-complete', minigameId: identity }, game.world, f.registry)).toBe(true);
  expect(f.apply(accepted.state).status).toBe('no-op'); expect(f.apply(accepted.state).state.runtime.game).toEqual(game);
});
it('rejects duplicate achievement allocation and an effect that claims another minigame', () => {
  const f = fixture(); f.record.effects[0].minigameId = q('MG02'); expect(validateContent(f.input).ok).toBe(false);
  const g = fixture(), other = structuredClone(g.record); other.id = q('MG02'); other.effects = other.effects.map((e: any) => e.kind === 'complete-minigame' ? { ...e, minigameId: other.id } : e);
  const path = 'content/spec001/minigames/MG02.json'; g.input.world.documents.push({ kind: 'minigame', id: other.id, path }); g.input.documents[path] = other;
  expect(validateContent(g.input).ok).toBe(false);
});
it('preserves the save-v1 shape and verifies minigame lesson sources and achievements identically in JS/PHP', () => {
  const f = fixture(), completed = f.apply(f.state).state, validator = new SaveValidator([f.policy]);
  const captured = captureSafeSnapshot(completed, validator); expect(captured.ok, JSON.stringify(captured)).toBe(true); if (!captured.ok) return;
  const snapshot = captured.capture.snapshot;
  const valid = { ...snapshot, assistance: [{ objectiveId: identity, hintId: q('HINT-MG01-step'), level: 2, attemptId: snapshot.world.attemptId }] };
  const candidates = [valid, { ...valid, world: { ...valid.world, completedObjectiveIds: [identity] } },
    { ...valid, world: { ...valid.world, achievementIds: [q('ACHIEVEMENT-unknown')] } },
    { ...valid, assistance: [{ ...valid.assistance[0], objectiveId: q('O10') }] }];
  const results = candidates.map(candidate => { const r = validator.validateNewWrite(new TextEncoder().encode(JSON.stringify(candidate))); return { ok: r.ok, code: r.ok ? null : r.code }; });
  const code = "require 'server/vendor/autoload.php';require 'server/src/SaveValidator.php';$i=json_decode(stream_get_contents(STDIN));$v=new NetworkQuest\\SaveValidator([$i->policy]);$o=[];foreach($i->candidates as $c){$r=$v->validateNewWrite(json_encode($c));$o[]=['ok'=>$r->ok,'code'=>$r->code];}echo json_encode($o);";
  const php = spawnSync(process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php', ['-d','auto_prepend_file=','-d','auto_append_file=','-r',code],
    { encoding: 'utf8', input: JSON.stringify({ policy: f.policy, candidates }), env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' }, timeout: 10000 });
  expect(php.status, php.stderr).toBe(0); expect(JSON.parse(php.stdout)).toEqual(results); expect(results.map(r => r.ok)).toEqual([true,false,false,false]);
  expect(f.policy.lessonSources).toContain(identity); expect(f.policy.members.objective).not.toContain(identity);
});
