# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Make isolated review candidates only. Never writes src/, server/ or fixtures."""
from pathlib import Path
import difflib
import hashlib
import json

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent / 'candidate'
OUT.mkdir(exist_ok=True)


def replace_once(text, before, after):
    if text.count(before) != 1:
        raise RuntimeError('Candidate patch anchor is absent or ambiguous: ' + before[:80])
    return text.replace(before, after, 1)


js_path = 'src/services/save-validator.ts'
js_original = (ROOT / js_path).read_text()
js = replace_once(js_original,
    'recruits: Record<string, { maxLevel: number; abilityIds: readonly string[]; progressFlagIds: readonly string[] }>;',
    'recruits: Record<string, { maxLevel: number; abilityIds: readonly string[]; progressFlagIds: readonly string[]; abilityIdsByLevel: Readonly<Record<string, readonly string[]>> }>;')
js = replace_once(js,
    "      if (!allowed || recruit.level > allowed.maxLevel || recruit.abilityIds.some(id => !allowed.abilityIds.includes(id))\n        || recruit.progressFlags.some(id => !allowed.progressFlagIds.includes(id))) return fail('relationship', '/world/recruits');",
    "      const levelAbilities = allowed?.abilityIdsByLevel && own(allowed.abilityIdsByLevel, String(recruit.level));\n      if (!allowed || recruit.level > allowed.maxLevel || !Array.isArray(levelAbilities)\n        || recruit.abilityIds.length !== levelAbilities.length || recruit.abilityIds.some(id => !levelAbilities.includes(id))\n        || recruit.abilityIds.some(id => !allowed.abilityIds.includes(id))\n        || recruit.progressFlags.some(id => !allowed.progressFlagIds.includes(id))) return fail('relationship', '/world/recruits');")
js = replace_once(js,
    '        p.recruits[record.id] = { maxLevel: Math.max(1, ...record.progression.map(entry => entry.level)), abilityIds: record.abilities.map(a => a.id), progressFlagIds: [] };',
    '''        // A level is an explicit authored cumulative unlock set, not permission
        // to carry every ability that this character may eventually learn.
        const levels = [...record.progression].sort((a, b) => a.level - b.level);
        if (!levels.length || levels.some((entry, index) => entry.level !== index + 1
          || !entry.abilityIds.length || new Set(entry.abilityIds).size !== entry.abilityIds.length
          || entry.abilityIds.some(id => !record.abilities.some(ability => ability.id === id)))) {
          throw new Error('Recruit save policy requires consecutive explicit levels and owned ability unlocks');
        }
        const abilityIdsByLevel: Record<string, readonly string[]> = {}, unlocked: string[] = [];
        for (const entry of levels) {
          if (entry.abilityIds.every(id => unlocked.includes(id))) throw new Error('Recruit progression must unlock a new authored ability');
          for (const id of entry.abilityIds) if (!unlocked.includes(id)) unlocked.push(id);
          abilityIdsByLevel[String(entry.level)] = [...unlocked];
        }
        if (record.abilities.some(ability => !unlocked.includes(ability.id))) throw new Error('Recruit save policy cannot authorize an ability without an authored level');
        p.recruits[record.id] = { maxLevel: levels.at(-1)!.level, abilityIds: record.abilities.map(a => a.id), progressFlagIds: [], abilityIdsByLevel };''')

php_path = 'server/src/SaveValidator.php'
php_original = (ROOT / php_path).read_text()
php = replace_once(php_original,
    '''            if ($allowed === null || $recruit->level > $allowed->maxLevel
                || array_diff($recruit->abilityIds, $allowed->abilityIds) !== []
                || array_diff($recruit->progressFlags, $allowed->progressFlagIds) !== []) {''',
    '''            $levelAbilities = $allowed?->abilityIdsByLevel->{(string) $recruit->level} ?? null;
            if ($allowed === null || $recruit->level > $allowed->maxLevel || !is_array($levelAbilities)
                || count($recruit->abilityIds) !== count($levelAbilities)
                || array_diff($recruit->abilityIds, $levelAbilities) !== []
                || array_diff($recruit->abilityIds, $allowed->abilityIds) !== []
                || array_diff($recruit->progressFlags, $allowed->progressFlagIds) !== []) {''')

patch = ''.join(difflib.unified_diff(js_original.splitlines(True), js.splitlines(True), 'a/' + js_path, 'b/' + js_path))
patch += ''.join(difflib.unified_diff(php_original.splitlines(True), php.splitlines(True), 'a/' + php_path, 'b/' + php_path))
(OUT / 'level-policy.proposed.patch').write_text(patch)
(OUT / 'save-validator.original.txt').write_text(js_original)
(OUT / 'SaveValidator.original.txt').write_text(php_original)

# Only the isolated copies need path adaptation. The proposed production patch
# above contains no candidate path, alternate schema or runtime environment hook.
js = js.replace("from './save-schema.generated.js'", "from '../../../../../src/services/save-schema.generated.js'")
js = js.replace("from '../content/", "from '../../../../../src/content/")
js = js.replace("from '../state/", "from '../../../../../src/state/")
php = php.replace("__DIR__ . '/../../specs/", "__DIR__ . '/../../../../../specs/")
(OUT / 'save-validator.ts').write_text(js)
(OUT / 'SaveValidator.php').write_text(php)

sha = lambda data: hashlib.sha256(data).hexdigest()
(OUT / 'source-provenance.json').write_text(json.dumps({
    'status': 'isolated draft only; no production source changed',
    'inputs': {js_path: sha(js_original.encode()), php_path: sha(php_original.encode())},
    'patch': sha(patch.encode()),
    'pathAdaptation': 'candidate copies point to the exact unchanged production save-v1 schema/type modules',
}, indent=2) + '\n')
