// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// The canonical content is read only. Corruption tests are explicit generator
// defense inputs, not player-earned state or acceptance of malformed content.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { loadIntroductionContent } from '../../../../src/app/content';
import type { ContentRegistry } from '../../../../src/content/registry';
import type * as S from '../../../../src/content/schema-types.generated';
import { createSaveContentPolicy, SaveValidator } from './candidate/save-validator';
import type { SaveContentPolicy } from './candidate/save-validator';

const { registry, world } = loadIntroductionContent();
const rules = { itemMaxQuantities: { 'spec001:ITEM-inspection-kit': 1 }, measurementRules: {}, unsafeFlags: {} };
const generated = createSaveContentPolicy(registry, world, rules);
const input = JSON.parse(readFileSync(new URL('./level-policy-cases.json', import.meta.url), 'utf8')) as {
  policies: SaveContentPolicy[]; cases: { id: string; body: string; expectedCode: string | null; policies?: SaveContentPolicy[] }[];
};
const canonicalInput = { ...input, policies: [generated] };
writeFileSync(new URL('./candidate/level-policy-canonical-generated.json', import.meta.url), JSON.stringify(generated, null, 2) + '\n');
const php = spawnSync('/opt/homebrew/opt/php@8.4/bin/php', ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=',
  fileURLToPath(new URL('./level-policy-php.php', import.meta.url)), 'candidate'], {
  encoding: 'utf8', input: JSON.stringify(canonicalInput), maxBuffer: 8 * 1024 * 1024,
  env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' },
});
if (php.status !== 0 || php.stderr) throw new Error(`Candidate PHP failed (${php.status}): ${php.stderr}`);
const phpOutput = JSON.parse(php.stdout) as { phpVersion: string; results: { id: string; ok: boolean; code: string | null; exactBytesPreserved: boolean }[] };
const ids = ['CH03', 'CH04', 'CH05', 'CH06', 'CH07', 'CH16', 'CH19', 'CH20', 'CH22'].map(id => `spec001:${id}`);
const mutations: { name: string; mutate: (record: S.character) => void }[] = [
  { name: 'missing level one', mutate: r => { r.progression = r.progression.filter(p => p.level !== 1); } },
  { name: 'duplicate authored level', mutate: r => { r.progression[1]!.level = 1; } },
  { name: 'gap to unauthored level three', mutate: r => { r.progression[1]!.level = 3; } },
  { name: 'empty unlock', mutate: r => { r.progression[1]!.abilityIds = []; } },
  { name: 'duplicate unlock identity', mutate: r => { r.progression[1]!.abilityIds.push(r.progression[1]!.abilityIds[0]!); } },
  { name: 'foreign character ability', mutate: r => { r.progression[1]!.abilityIds = ['spec001:ABILITY-CH04-explain']; } },
  { name: 'repeated old ability without meaningful unlock', mutate: r => { r.progression[1]!.abilityIds = [...r.progression[0]!.abilityIds]; } },
  { name: 'empty progression', mutate: r => { r.progression = []; } },
];
function changingRecord(mutate: (record: S.character) => void): ContentRegistry {
  const original = registry.record('spec001:CH03');
  if (original?.kind !== 'character') throw new Error('Canonical character not loaded');
  const changed = structuredClone(original); mutate(changed);
  return { ...registry, record: id => id === changed.id ? changed : registry.record(id) };
}

describe('T094 isolated level-policy generator over frozen canonical T093 records', () => {
  it('generates exactly nine cumulative level maps without authorizing the nonrecruit roster', () => {
    expect(Object.keys(generated.recruits)).toEqual(ids);
    expect(generated.recruits).toEqual(input.policies[0]!.recruits);
    for (const policy of Object.values(generated.recruits)) {
      expect(Object.keys(policy.abilityIdsByLevel)).toEqual(['1', '2']);
      expect(policy.abilityIdsByLevel['1']).toHaveLength(1);
      expect(policy.abilityIdsByLevel['2']).toHaveLength(2);
      expect(Object.isFrozen(policy.abilityIdsByLevel['2'])).toBe(true);
    }
    expect(phpOutput.phpVersion).toBe('8.4.28');
  });
  it.each(input.cases)('$id: canonical generated metadata gives identical JS/PHP validation', row => {
    const checked = new SaveValidator(row.policies ?? [generated]).validateNewWrite(new TextEncoder().encode(row.body));
    const result = phpOutput.results.find(r => r.id === row.id)!;
    expect(checked.ok ? null : checked.code).toBe(row.expectedCode);
    expect(result.code).toBe(row.expectedCode);
    expect(result.ok).toBe(checked.ok);
    expect(result.exactBytesPreserved).toBe(true);
    if (checked.ok) expect(checked.json).toBe(row.body);
  });
  it.each(mutations)('rejects $name before producing authorizations', ({ mutate }) => {
    expect(() => createSaveContentPolicy(changingRecord(mutate), world, rules)).toThrow(/Recruit/);
  });
  it('canonicalizes row order without changing exact cumulative membership or the input', () => {
    const changed = changingRecord(record => { record.progression.reverse(); });
    const before = JSON.stringify(changed.record('spec001:CH03'));
    expect(createSaveContentPolicy(changed, world, rules).recruits['spec001:CH03']).toEqual(generated.recruits['spec001:CH03']);
    expect(JSON.stringify(changed.record('spec001:CH03'))).toBe(before);
  });
});
