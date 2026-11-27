// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// T100 actual JS/PHP policy join; historical initial RED is retained separately.
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../../../../src/app/content';
import { createSaveContentPolicy, SaveValidator, type SaveContentPolicy } from '../../../../../src/services/save-validator';
import { createIntroductionRuntime, startIntroduction } from '../../../../../src/app/adventure';
import type { SaveSnapshotV1 } from '../../../../../src/state/types';
import type { QualifiedId } from '../../../../../src/domain/types';
const q = <T extends string = string>(id: string) => `spec001:${id}` as QualifiedId<T>;
function setup() {
  const { world, registry } = loadIntroductionContent();
  const policy = createSaveContentPolicy(registry, world, { itemMaxQuantities: {}, measurementRules: {}, unsafeFlags: {} });
  const game = startIntroduction(createIntroductionRuntime(), registry).game!;
  const candidate: SaveSnapshotV1 = { ...game, saveSchemaVersion: 1, safeState: 'stable-exploration',
    world: { ...game.world, roomId: q('R04'), position: { safePositionId: q('R04.entry') }, completedQuestIds: [q('SQ01')] },
    notebook: { ...game.notebook, factIds: [q('FACT-SQ01-delivery')] },
    assistance: [{ objectiveId: q('SQ01') as SaveSnapshotV1['assistance'][number]['objectiveId'], hintId: q('HINT-SQ01-step'), level: 2, attemptId: game.world.attemptId }] };
  return { policy, candidate };
}
function php(policy: SaveContentPolicy, candidates: readonly unknown[]) {
  const executable = process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php';
  const code = `require 'server/vendor/autoload.php'; require 'server/src/SaveValidator.php';
    $input=json_decode(stream_get_contents(STDIN)); $v=new NetworkQuest\\SaveValidator([$input->policy]); $out=[];
    foreach($input->candidates as $candidate) { $r=$v->validateNewWrite(json_encode($candidate,JSON_THROW_ON_ERROR)); $out[]=['ok'=>$r->ok,'code'=>$r->code]; }
    echo json_encode(['version'=>PHP_VERSION,'results'=>$out],JSON_THROW_ON_ERROR);`;
  const result = spawnSync(executable, ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', code], { encoding: 'utf8',
    env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' }, input: JSON.stringify({ policy, candidates }), timeout: 10000 });
  expect(result.status, result.stderr).toBe(0); const out = JSON.parse(result.stdout); expect(out.version).toBe('8.4.28'); return out.results as { ok: boolean; code: string | null }[];
}
describe('T100 real optional lesson policy in JS and PHP', () => {
  it('registers real lesson sources without broadening completed-objective membership', () => {
    const { policy } = setup(), expanded = policy as SaveContentPolicy & { lessonSources?: string[] };
    expect(expanded.lessonSources).toContain(q('SQ01'));
    expect(policy.members.objective).toEqual(Array.from({ length: 12 }, (_, i) => q(`O${String(i + 1).padStart(2, '0')}`)));
    expect(policy.hints[q('HINT-SQ01-step')]).toEqual({ objectiveId: q('SQ01'), level: 2 });
  });
  it('round-trips SQ01 progress and assistance, rejecting forged source, hint and main progress', () => {
    const { policy, candidate } = setup(), inputs = [candidate,
      { ...candidate, assistance: [{ ...candidate.assistance[0], objectiveId: q('O10') }] },
      { ...candidate, assistance: [{ ...candidate.assistance[0], hintId: q('HINT-SQ01-solution') }] },
      { ...candidate, assistance: [{ ...candidate.assistance[0], objectiveId: q('SQ02') }] },
      { ...candidate, world: { ...candidate.world, completedObjectiveIds: [q('SQ01')] } },
      { ...candidate, assistance: [], world: { ...candidate.world, completedQuestIds: [] } },
    ];
    const validator = new SaveValidator([policy]);
    const results = inputs.map(value => { const result = validator.validateNewWrite(new TextEncoder().encode(JSON.stringify(value))); return { ok: result.ok, code: result.ok ? null : result.code }; });
    expect(php(policy, inputs)).toEqual(results);
    expect(results.map(result => result.ok)).toEqual([true, false, false, false, false, true]);
    expect(candidate.assistance[0]?.objectiveId).toBe(q('SQ01'));
  });
});
