// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { introductionSavePolicy } from '../../src/app/save-policy';
import { SaveValidator } from '../../src/services/save-validator';
import { captureSafeSnapshot } from '../../src/state/snapshot';
import { maintenanceFixture, registry, world, q, activity } from '../ui/maintenance-fixture';
describe('SQ04 honest assistance and completion in unchanged save-v1', () => {
  it('round-trips actual controller progress through JavaScript and PHP with the same bounded policy', () => {
    const f = maintenanceFixture(true); f.start(); f.mode('practice'); f.mode('delivery'); f.send({ kind: 'submit-optional-maintenance', sessionId: f.session(), answer: { selectedFactIds: activity.delivery.factIds } }); f.simple('exit-optional');
    const policy = introductionSavePolicy(registry, world), validator = new SaveValidator([policy]), capture = captureSafeSnapshot(f.state(), validator);
    expect(capture.ok).toBe(true); if (!capture.ok) throw new Error('Actual maintenance snapshot unavailable');
    const good = capture.capture.snapshot;
    const values = [good, { ...good, assistance: [{ ...good.assistance[0], objectiveId: q('O08') }] },
      { ...good, assistance: [{ ...good.assistance[0], hintId: q('HINT-SQ04-solution') }] },
      { ...good, world: { ...good.world, completedObjectiveIds: [...good.world.completedObjectiveIds, q('SQ04')] } },
      { ...good, world: { ...good.world, completedQuestIds: [q('SQ99')] } },
      { ...good, optionalActivity: f.state().control.optionalActivity },
      { ...good, world: { ...good.world, completedQuestIds: [] } }];
    const js = values.map(value => validator.validateNewWrite(new TextEncoder().encode(JSON.stringify(value))).ok);
    expect(js).toEqual([true, false, false, false, false, false, true]);
    const code = `require 'server/vendor/autoload.php'; require 'server/src/SaveValidator.php'; $i=json_decode(stream_get_contents(STDIN)); $v=new NetworkQuest\\SaveValidator([$i->policy]); $r=[]; foreach($i->values as $x) {$r[]=$v->validateNewWrite(json_encode($x,JSON_THROW_ON_ERROR))->ok;} echo json_encode($r,JSON_THROW_ON_ERROR);`;
    const result = spawnSync(process.env['NQ_PHP_BIN'] ?? '/opt/homebrew/opt/php@8.4/bin/php', ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', code], {
      encoding: 'utf8', env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' }, input: JSON.stringify({ policy, values }), timeout: 10000,
    });
    expect(result.status, result.stderr).toBe(0); expect(JSON.parse(result.stdout)).toEqual(js);
    expect(policy.lessonSources).toContain(q('SQ04')); expect(good.saveSchemaVersion).toBe(1); expect(policy.members.objective).not.toContain(q('SQ04'));
    expect(policy.hints[q('HINT-SQ04-step')]).toEqual({ objectiveId: q('SQ04'), level: 2 });
  });
});
