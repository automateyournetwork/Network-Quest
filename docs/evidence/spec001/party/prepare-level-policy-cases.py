# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bind explicit independent level expectations to T093 draft IDs, never verdicts."""
from pathlib import Path
import copy
import hashlib
import json

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
draft_path = ROOT / 'docs/evidence/spec001/characters/characters.json.draft'
draft_bytes = draft_path.read_bytes()
recruits = [r for r in json.loads(draft_bytes)['records'] if r['recruitable']]
expected_ids = ['CH03', 'CH04', 'CH05', 'CH06', 'CH07', 'CH16', 'CH19', 'CH20', 'CH22']
assert [r['id'] for r in recruits] == ['spec001:' + x for x in expected_ids]
fixture = json.loads((ROOT / 'tests/services/save-validator-policy.json').read_text())
policy = copy.deepcopy(fixture['policy'])
policy['members']['character'] = [r['id'] for r in recruits]
policy['members']['ability'] = [a['id'] for r in recruits for a in r['abilities']]
policy['recruits'] = {}
for r in recruits:
    first = next(p for p in r['progression'] if p['level'] == 1)['abilityIds']
    second = next(p for p in r['progression'] if p['level'] == 2)['abilityIds']
    assert len(first) == 1 and len(second) == 1 and first[0] != second[0]
    policy['recruits'][r['id']] = {'maxLevel': 2, 'abilityIds': first + second, 'progressFlagIds': [],
        'abilityIdsByLevel': {'1': first, '2': first + second}}

base = json.loads((ROOT / 'specs/001-physical-layer-underworld/contracts/examples/save-v1.json').read_text())
cases = []
def add(case_id, character, level, abilities, expected, change=None, policy_change=None):
    snapshot = copy.deepcopy(base)
    snapshot['world']['recruits'] = [{'characterId': character, 'level': level, 'abilityIds': abilities, 'progressFlags': []}]
    if change:
        change(snapshot)
    row = {'id': case_id, 'body': ' \n' + json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')) + '\n ',
        'expectedCode': expected}
    if policy_change:
        p = copy.deepcopy(policy); policy_change(p); row['policies'] = [p]
    cases.append(row)

for i, r in enumerate(recruits):
    id = r['id']; short = id.split(':')[1]
    first, second = policy['recruits'][id]['abilityIds']
    foreign = policy['recruits'][recruits[(i + 1) % len(recruits)]['id']]['abilityIds'][0]
    add(short + '-level1-base', id, 1, [first], None)
    add(short + '-level1-premature-explanation', id, 1, [first, second], 'relationship')
    add(short + '-level1-only-future', id, 1, [second], 'relationship')
    add(short + '-level1-missing-base', id, 1, [], 'relationship')
    add(short + '-level2-complete', id, 2, [first, second], None)
    add(short + '-level2-order-independent', id, 2, [second, first], None)
    add(short + '-level2-only-base', id, 2, [first], 'relationship')
    add(short + '-level2-only-explanation', id, 2, [second], 'relationship')
    add(short + '-level2-foreign-ability', id, 2, [first, foreign], 'relationship')
    add(short + '-level3-unauthored', id, 3, [first, second], 'relationship')
    add(short + '-level0-schema', id, 0, [first], 'schema')
    add(short + '-duplicate-ability-schema', id, 2, [first, second, second], 'schema')
    add(short + '-payload-cannot-supply-policy', id, 1, [first, second], 'schema',
        lambda s: s['world']['recruits'][0].update({'abilityIdsByLevel': {'1': [first, second]}}))
    add(short + '-missing-trusted-level', id, 1, [first], 'relationship',
        policy_change=lambda p: p['recruits'][id]['abilityIdsByLevel'].pop('1'))
    add(short + '-missing-trusted-level-map', id, 1, [first], 'relationship',
        policy_change=lambda p: p['recruits'][id].pop('abilityIdsByLevel'))

# These are semantic-validation candidates, deliberately not evidence of gameplay.
first_id = recruits[0]['id']; base_ability = policy['recruits'][first_id]['abilityIds'][0]
add('party-active-owned', first_id, 1, [base_ability], None,
    lambda s: s['world'].update({'activeAllyIds': [first_id]}))
add('party-unrecruited-active', first_id, 1, [base_ability], 'relationship',
    lambda s: s['world'].update({'activeAllyIds': [recruits[1]['id']]}))
add('party-duplicate-active', first_id, 1, [base_ability], 'schema',
    lambda s: s['world'].update({'activeAllyIds': [first_id, first_id]}))
add('party-three-active', first_id, 1, [base_ability], 'schema',
    lambda s: s['world'].update({'activeAllyIds': [r['id'] for r in recruits[:3]]}))
result = {'scope': 'T094 independently specified new-write level semantics; synthetic snapshots only, not gameplay acceptance',
    'sourceDraftSha256': hashlib.sha256(draft_bytes).hexdigest(), 'policies': [policy], 'cases': cases}
(HERE / 'level-policy-cases.json').write_text(json.dumps(result, indent=2, ensure_ascii=False) + '\n')
