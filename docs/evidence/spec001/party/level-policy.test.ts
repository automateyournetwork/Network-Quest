// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Explicit isolated differential tests. Synthetic snapshots test validation only.
import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { SaveContentPolicy as ProposedPolicy } from './candidate/save-validator';

const target = process.env['NQ_T094_POLICY_TARGET'] ?? 'baseline';
if (!['baseline', 'candidate'].includes(target)) throw new Error('Unknown isolated target');
const module = target === 'candidate' ? await import('./candidate/save-validator') : await import('../../../../src/services/save-validator');
type Result = { id: string; ok: boolean; code: string | null; provisional: boolean; exactBytesPreserved: boolean };
const input = JSON.parse(readFileSync(new URL('./level-policy-cases.json', import.meta.url), 'utf8')) as {
  policies: ProposedPolicy[]; cases: { id: string; body: string; expectedCode: string | null; policies?: ProposedPolicy[] }[];
};
const originalInput = JSON.stringify(input);
const php = spawnSync('/opt/homebrew/opt/php@8.4/bin/php', ['-d', 'auto_prepend_file=', '-d', 'auto_append_file=',
  fileURLToPath(new URL('./level-policy-php.php', import.meta.url)), target], {
  encoding: 'utf8', input: JSON.stringify(input), maxBuffer: 8 * 1024 * 1024,
  env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' },
});
if (php.status !== 0) throw new Error(`Isolated PHP failed (${php.status}): ${php.stderr}`);
if (php.stderr) throw new Error(`Isolated PHP emitted a diagnostic: ${php.stderr}`);
const phpOutput = JSON.parse(php.stdout) as { phpVersion: string; results: Result[] };
const jsResults: Result[] = input.cases.map(row => {
  const result = new module.SaveValidator(row.policies ?? input.policies).validateNewWrite(new TextEncoder().encode(row.body));
  return { id: row.id, ok: result.ok, code: result.ok ? null : result.code, provisional: result.provisional,
    exactBytesPreserved: !result.ok || result.json === row.body };
});
writeFileSync(new URL(`./level-policy-${target}-matrix.json`, import.meta.url), JSON.stringify({ target,
  node: process.version, php: phpOutput.phpVersion, scope: input.cases.length + ' synthetic new-write candidates, not party gameplay',
  cases: input.cases.map((row, i) => ({ id: row.id, expectedCode: row.expectedCode, js: jsResults[i], php: phpOutput.results[i] })),
}, null, 2) + '\n');

describe(`T094 ${target} level policy, unchanged save-v1 bytes`, () => {
  it('uses pinned real runtimes and does not mutate test policy or candidate bytes', () => {
    expect(process.version).toBe('v26.13.1'); expect(phpOutput.phpVersion).toBe('8.4.28');
    expect(JSON.stringify(input)).toBe(originalInput);
    expect(input.cases).toHaveLength(139);
  });
  it.each(input.cases)('$id agrees between JS and PHP and preserves accepted exact bytes', row => {
    const js = jsResults.find(r => r.id === row.id)!, phpResult = phpOutput.results.find(r => r.id === row.id)!;
    expect(js).toEqual(phpResult); expect(js.provisional).toBe(true); expect(js.exactBytesPreserved).toBe(true);
  });
  it.each(input.cases)('$id obeys the independently authored level relationship', row => {
    for (const result of [jsResults.find(r => r.id === row.id)!, phpOutput.results.find(r => r.id === row.id)!]) {
      expect(result.code).toBe(row.expectedCode); expect(result.ok).toBe(row.expectedCode === null);
    }
  });
});
