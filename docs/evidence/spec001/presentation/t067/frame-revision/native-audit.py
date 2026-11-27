# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Offline audit of the two completed native Safari runs; never operates a browser."""
import collections
import hashlib
import json
from pathlib import Path

BASE = Path('docs/evidence/spec001/presentation/t067/frame-revision')
RUNS = ['safari-2026-11-26T23-44-24-725Z', 'safari-2026-11-26T23-48-50-781Z']
def read(path):
    return json.loads(Path(path).read_text())
def digest(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()
def extent(values):
    values = list(values)
    return [min(values), max(values)]

samples, pairs, calibrations, controls = [], [], [], []
for run_index, run in enumerate(RUNS):
    directory = BASE / run
    raw = read(directory / 'samples.json')
    summaries = read(directory / 'summary.json')['summaries']
    calibration = read(directory / 'calibration.json')
    assert calibration['valid']
    calibrations.append({'run': run, 'sha256': digest(directory / 'calibration.json'), **calibration})
    for row, summary in zip(raw, summaries, strict=True):
        assert row['status'] == 'completed' and all(summary['numericBudgets'].values())
        assert row['hidden'] is False and row['visibilityState'] == 'visible' and row['hasFocus']
        assert all(row['nativeState'][key] for key in ['frontmost', 'windowVisible', 'tabVisible'])
        assert row['viewport'] in [[1280, 720], [1440, 900]] and row['dpr'] == 2
        assert row['initial']['frameLayout']['pageOverflow'] == [0, 0]
        assert row['initial']['frameLayout']['activeDialogs'] == []
        assert row['reset']['frameLayout']['activeDialogs'] == []
        pair = 1 if run_index == 0 else int(row['id'].split('pair')[1]) + 2
        samples.append({
            'run': run, 'id': row['id'], 'pair': pair, 'cache': row['cache'],
            'viewport': row['viewport'], 'nativeState': row['nativeState'],
            'shellReadyMs': summary['shellReadyMs'], 'roomReadyMs': summary['firstRoomReadyMs'],
            'completedShellBodyBytes': summary['shellCompressedBytesIncludingProbe'],
            'completedFirstRoomBodyBytes': summary['firstRoomCompressedBytesIncludingProbe'],
            'completedFirstRoomTransferBytes': summary['firstRoomTransferredBytes'],
            'idleFPS': summary['idle']['actualFramesPerSecond'],
            'explorationFPS': summary['exploration']['actualFramesPerSecond'],
            'numericBudgets': summary['numericBudgets'],
            'triangles': summary['triangles'], 'estimatedTextureBytes': summary['textureEstimate']['estimatedCombinedBytes'],
            'errors': summary['errors'], 'sceneFailures': summary['sceneFailures'],
            'lostTextPredicate': row['lost']['text'], 'lostCanvas': row['lost']['scene']['canvas'],
            'recoveredRoom': row['recovered']['dataset']['roomId'],
            'r01RoundTripOwnership': [r['gl']['live'] for r in row['disposal'] if r['room'] == 'R01'],
            'textOwnership': row['text']['gl']['live'],
            'recoveredOwnership': row['recovered']['gl']['live'],
            'resetOwnership': row['reset']['gl']['live'],
            'completedWarmAssetTimings': [r for r in row['firstRoomResources'] if '/assets/' in r['path']] if row['cache'] == 'warm' else [],
        })
    for log in sorted(directory.glob('*-measured.ndjson')):
        records = [json.loads(line) for line in log.read_text().splitlines()]
        fixture = records[0]
        responses = [r for r in records if r['type'] == 'response']
        assets = [r for r in responses if '/assets/' in r['path']]
        counts = collections.Counter(r['path'] for r in assets)
        assert len(counts) == 18 and set(counts.values()) == {1}
        assert records[-1] == {'type': 'cleanup', 'serverStopped': True, 'pendingRequests': 0}
        pairs.append({
            'run': run, 'log': str(log), 'sha256': digest(log), 'origin': fixture['origin'],
            'probeSha256': fixture['probeSha256'],
            'assetRequests': [{'path': path, 'count': count} for path, count in sorted(counts.items())],
            'audioResponses': [r for r in responses if '/audio/' in r['path']],
            'apiResponses': [r for r in responses if '/api/' in r['path']],
            'HTTPFailures': [r for r in responses if r['status'] >= 400],
            'abortedResponses': [r for r in responses if r['aborted']],
            'serverErrors': [r for r in records if r['type'] == 'server-error'],
            'fullPairAdvertisedBodyBytes': sum(r['bodyBytes'] for r in responses),
            'entireDistBodyBound': sum(r['bytes'] if r['path'].endswith('.mp3') else r['gzipBytes'] for r in fixture['manifest']),
            'manifestFiles': len(fixture['manifest']), 'manifestSourceHashesMatch': all(digest(Path('dist') / r['path']) == r['sha256'] for r in fixture['manifest']),
        })
    for row in read(directory / 'native-controls.json'):
        if row.get('check') == 'native-tab-background-return':
            controls.append({'run': run, 'check': row['check'], 'reports': [
                {key: item[key] for key in ['ms', 'delay', 'hidden', 'visibilityState', 'hasFocus']} |
                {'viewport': item['scene']['viewport'], 'paused': item['scene']['dataset']['paused'], 'renderCount': item['scene']['dataset']['renderCount']}
                for item in row['reports']]})
        elif row.get('check') == 'task-window-cleanup':
            controls.append({'run': run, **row})

assert len(samples) == 12 and len(pairs) == 6 and len({r['origin'] for r in pairs}) == 6
assert collections.Counter((tuple(r['viewport']), r['cache']) for r in samples) == {(v, c): 3 for v in [(1280, 720), (1440, 900)] for c in ['cold', 'warm']}
authorities = []
for file in [BASE / 'freeze-2026-11-26T22-11-48-122Z.json', BASE / 'revision-artifact-seal.json', BASE.parent / 'partial-artifact-seal.json']:
    authority = read(file)
    mismatches = [r['path'] for r in authority['records'] if not Path(r['path']).exists() or digest(r['path']) != r['sha256']]
    assert not mismatches, mismatches
    authorities.append({'path': str(file), 'sha256': digest(file), 'recordsVerified': len(authority['records']), 'mismatches': mismatches})
freeze = read(BASE / 'freeze-2026-11-26T22-11-48-122Z.json')
assert all(digest(r['exportPath']) == digest(r['distPath']) == r['sha256'] for r in freeze['bindings'])
result = {
    'scope': 'Actual installed Safari native guest-only HTTP evidence; no HTTPS/provider/service or aggregate gate acceptance inferred.',
    'runSources': [{'run': run, 'sampleSha256': digest(BASE / run / 'samples.json'), 'summarySha256': digest(BASE / run / 'summary.json'), 'harness': read(BASE / run / 'harness.json')} for run in RUNS],
    'sampleCount': len(samples), 'pairs': pairs, 'samples': samples,
    'ranges': {
        'coldRoomReadyMs': extent(r['roomReadyMs'] for r in samples if r['cache'] == 'cold'),
        'warmRoomReadyMs': extent(r['roomReadyMs'] for r in samples if r['cache'] == 'warm'),
        'actualIdleAndExplorationFPS': extent(r[k] for r in samples for k in ['idleFPS', 'explorationFPS']),
        'fullPairAdvertisedBodyBytes': extent(r['fullPairAdvertisedBodyBytes'] for r in pairs),
    },
    'calibrations': calibrations, 'nativeControls': controls,
    'authorities': authorities, 'runtimeBindingsVerified': len(freeze['bindings']),
    'cacheLimit': 'Warm Safari completed Resource Timing entries report cached encodedBodySize zero. No audio/API responses were observed; audio playback/reuse and service readiness are not established. Full pair body counts are advertised-body totals, not wire byte measurements.',
}
destination = BASE / 'native-safari-summary.json'
destination.write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'output': str(destination), 'sha256': digest(destination), 'samples': len(samples), 'ranges': result['ranges'], 'authorities': authorities, 'distBodyBound': pairs[0]['entireDistBodyBound']}))
