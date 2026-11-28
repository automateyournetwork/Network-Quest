# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify the retained November 28 matrix, optionally against a built game directory."""
import argparse
import hashlib
import json
from datetime import datetime
from pathlib import Path, PurePosixPath

HERE = Path(__file__).resolve().parent
EVIDENCE = HERE.parents[2] / 'docs/evidence/spec001/browser-matrix'
SIZES = {'1280x720', '1440x900', '768x900', '390x844'}
VERSIONS = {
    'chromium-157': '157.0.8103.78', 'chromium-158': '158.0.8127.88',
    'chromium-159': '159.0.8154.33', 'chrome-installed': '158.0.8127.38',
    'firefox-160': '160.0.1', 'firefox-161': '161.0',
    'safari-26': '26.6.1', 'safari-27': '27.2',
}
ROOMS = {f'spec001:R{number:02}' for number in range(1, 13)}
NATIVE_BUILDS = {
    'firefox-160': '20261116130455',
    'firefox-161': '20261118180411',
    'safari-26': '19624.5.1.18.3',
    'safari-27': '21625.2.8.18.4',
}
NOTICES = {'credits/media.html': 896244, 'credits/notices.txt': 260031}


def check(condition, detail):
    if not condition:
        raise ValueError(detail)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def verify_cell(record, group, seal):
    row = record['sample']
    name = f'{group} {row["size"]}'
    check(sha((json.dumps(row, ensure_ascii=False, indent=2) + '\n').encode()) == record['sourceRecordSHA256'], name + ' source receipt')
    check(row['status'] == 'passed' and row['candidate'] == {'files': 442, 'sha256': seal}, name + ' status or candidate')
    check(row['engine']['browserVersion'] == VERSIONS[group], name + ' browser version')
    if group in NATIVE_BUILDS:
        actual_build = row['engine'].get('CFBundleVersion') or row['engine'].get('moz:buildID')
        check(actual_build == NATIVE_BUILDS[group], name + ' release build')
    started, finished = (datetime.fromisoformat(row[key].replace('Z', '+00:00')) for key in ('started', 'finished'))
    check(started < finished and started.date().isoformat() == '2026-11-28', name + ' test interval')
    check(row['viewport'] == [int(n) for n in row['size'].split('x')], name + ' actual CSS viewport')
    if row['size'] in {'1280x720', '1440x900'}:
        check(row['input'] == 'keyboard' and row['hostViewport'] == row['viewport'], name + ' desktop keyboard or native top-level size')
    check({r['id'] for r in row['rooms']} == ROOMS, name + ' rooms reached')
    check(all(min(r['canvas']) > 0 and max(r['overflow']) <= 1 for r in row['rooms']), name + ' canvas or overflow')
    check(row['ending'] == 'The Steady Light' and row['actions'][-1] == 'Continue ending', name + ' ending and Continue')
    check(len(row['readings']) == 9 and not row['errors'] and not row['missingFiles'], name + ' readings or errors')
    check(row['trusted'].get('clickTrusted', 0) >= 250, name + ' native activation')
    changes = row['refinements']
    check(changes[0]['initial'] == changes[0]['settled'], name + ' title position')
    resources = {item['path']: item['bytes'] for item in changes[1]['resources']}
    check(resources == NOTICES, name + ' Credits resources')
    check(changes[2]['check'] == 'Game menu Credits returned to the Arrival Lift', name + ' Credits return')
    floors = [(step['room'], step['party']) for step in changes[3:]]
    party = 'spec001:CH05 spec001:CH06'
    check(floors == [('R04', ''), ('R09', party), ('R04', party)], name + ' floor and party routes')
    check(all(step['before'] != step['after'] for step in changes[3:]), name + ' floor motion')
    for file, digest in row['harness'].items():
        check(sha((HERE / file).read_bytes()) == digest, name + ' harness ' + file)
    if row['capture']:
        capture = row['capture']
        check(sha((EVIDENCE / 'release-captures' / capture['file']).read_bytes()) == capture['sha256'], name + ' capture')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--dist', type=Path, help='Compare every distribution file against the tested release candidate')
    args = parser.parse_args()
    manifest = json.loads((EVIDENCE / 'credits-candidate.json').read_text())
    outputs = manifest['outputs']
    ordered = sorted(outputs.items(), key=lambda pair: PurePosixPath(pair[0]).parts)
    seal = sha(json.dumps(ordered, separators=(',', ':')).encode())
    check(len(ordered) == 442 and seal == manifest['sha256'], 'candidate ledger')
    public = manifest['publicSource']
    check(public['commit'] == 'ae8472469b5f7d98e939ccb5471b03893630993a', 'published candidate commit')
    published_ledger = (HERE.parents[2] / public['productionLedger']).read_bytes()
    check(sha(published_ledger) == public['productionLedgerSHA256'], 'published ledger digest')
    check(json.loads(published_ledger)['distribution'] == outputs, 'published and tested output files')
    if args.dist:
        actual = {p.relative_to(args.dist).as_posix(): sha(p.read_bytes()) for p in args.dist.rglob('*') if p.is_file()}
        check(actual == outputs, 'Release distribution differs from the tested 442 files.')
        check(all((args.dist / path).stat().st_size == count for path, count in NOTICES.items()), 'Credits resource lengths')
    summary = json.loads((EVIDENCE / 'release-summary.json').read_text())
    check(summary['seal'] == seal and summary['verified'] == summary['planned'] == 32, 'release summary')
    summary_cells = {(r['group'], r['viewport']): r for r in summary['cells']}
    check(len(summary_cells) == len(summary['cells']) == 32, 'release summary contains duplicate or missing cells')
    for group in VERSIONS:
        records = json.loads((EVIDENCE / 'release-records' / (group + '.json')).read_text())
        check(len(records) == 4 and {r['sample']['size'] for r in records} == SIZES, group + ' incomplete or duplicate viewports')
        for record in records:
            verify_cell(record, group, seal)
            row = record['sample']
            reported = summary_cells[(group, row['size'])]
            check(reported['utc'] == [row['started'], row['finished']] and reported['input'] == row['input']
                  and reported['version'] == row['engine']['browserVersion'] and reported['distinctRooms'] == 12
                  and reported['trustedEvents'] == row['trusted'] and reported['actions'] == len(row['actions']),
                  group + ' summary disagrees with source receipt')
    print(f'32 complete browser cells across 8 distributions; {len(ordered)} candidate files; SHA-256 {seal}')


if __name__ == '__main__':
    main()
