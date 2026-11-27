# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Check distinct complete waveforms and identify planned versus observed room uses."""
import numpy as np
from scipy.signal import correlate
from importlib import import_module

audio = import_module('export')
root = audio.ROOT
manifest = audio.load(root/'assets-src/audio/effects-01-20.json')
first = {a['assetId']:a['exports'][0]['file'] for a in manifest['assets']}
rows = audio.load(audio.REC/'exports.json')['effects']
second = {r['brief']['assetId']:r['web'] for r in rows}
files = first | second
assert len(files)==40 and len({f['sha256'] for f in files.values()})==40
signals = {key:audio.decode(audio.check(value),1).ravel().astype('float64') for key,value in files.items()}
norms = {key:float(np.sqrt(np.sum(s*s))) for key,s in signals.items()}
pairs = []
for r in rows:
    aid = r['brief']['assetId']
    nearest = (0,None,None)
    for other in signals:
        if other==aid: continue
        correlation = np.abs(correlate(signals[aid],signals[other],method='fft',mode='full'))
        sample = int(np.argmax(correlation))
        value = float(correlation[sample]/(norms[aid]*norms[other]))
        if value>nearest[0]: nearest = value,other,sample-len(signals[other])+1
    assert nearest[0]<.975, (aid,nearest)
    pairs.append(dict(assetId=aid,closestByWholeWaveform=nearest[1],correlation=nearest[0],
                      relativeLagSamples=nearest[2],design=r['design']))

def walk(x):
    if isinstance(x,list):
        for v in x: yield from walk(v)
    if isinstance(x,dict):
        if {'assetId','contentId','exportPath','use'} <= x.keys(): yield x
        for v in x.values(): yield from walk(v)
bindings = [{'roomFile':str(path.relative_to(root)),**b}
    for path in sorted((root/'content/spec001/rooms').glob('R*.json'))
    for b in walk(audio.load(path)) if b['assetId'] in second]
audio.write(audio.REC/'identity-and-reuse.json', dict(
    method='Full-wave cross correlation over every temporal lag, absolute and normalized by the energies of both entire decoded files. Invariant to gain, global phase inversion and delay. Asset purpose, source score and room-event identity remain independently inspectable.',
    corpus=[dict(assetId=key,web=value) for key,value in files.items()],
    distinctWebHashes=40, uniqueComparedPairs=190+20*20, correlationEvaluations=20*39,
    methodLimits='Does not establish perceptual distinctness. Human listening is pending for new files.',
    t128Rows=pairs, observedRoomBindingDeclarations=bindings,
    placementAccounting=[dict(assetId=r['brief']['assetId'],plannedRoom=r['brief']['roomId'],
        committedPresentationTrigger=r['brief']['purpose'],frozenCaption=r['brief']['caption'],
        currentBindings=[b for b in bindings if b['assetId']==r['brief']['assetId']],
        uniqueIdentityCredits=1,additionalIdentitiesFromRepeatPlaybackOrRoomReuse=0) for r in rows],
    historicalPhoton='T066 observed the approved T065 glimmer on R01 Talk to Photon. T062/T106 allocate its optical inspection use to R05. This is a single reusable identity. The T128 listening fixture and its room-mix excerpt do not create an in-game binding.'))
