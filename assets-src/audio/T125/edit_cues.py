# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Prepare circular musical phrases and a single reflective closing cadence."""
import argparse
import json
from pathlib import Path
import sys
import tempfile
import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
sys.path.append(str(OUT.parent/'T124'))
import prepare as analysis

# BPM, approximate full loop duration, duration over which to match textures.
LOOPS = {'radio': (98, 78, .65), 'clockworks': (84, 68, .48), 'rift': (72, 88, 1.32)}

def circular_edit(raw, rate, bpm, duration, seconds):
    fp = analysis.fingerprint(raw, rate)
    count = round(seconds*25)
    # Inspect the onset envelope over the full take; estimate pulse near the commissioned
    # tempo rather than assuming the generation hit the requested value exactly.
    onsets = np.maximum(np.diff(fp[:, :8], axis=0), 0).sum(axis=1)
    centered = onsets - onsets.mean()
    pulse = 25*60/bpm
    scores = np.correlate(centered, centered, mode='full')[len(centered)-1:]
    low, high = round(pulse*.9), round(pulse*1.1)
    lag = low + np.argmax(scores[low:high+1])
    # Half-wave onset periodicity is advisory: coarse 25 Hz analysis cannot establish
    # the precise beat grid. Include the nearby commissioned bar periods in the search.
    bars = round(duration*bpm/240)
    period = bars*4*pulse
    candidates = []
    for start in range(25,150):
        for length in range(round(period)-35,round(period)+36):
            end = start+length
            if end+count+25>=len(fp):
                continue
            error = np.square(fp[start:start+count]-fp[end:end+count]).mean()
            candidates.append((float(error), start, end))
    error, head, tail = min(candidates)
    hop = rate//25
    a,b,n = head*hop,tail*hop,count*hop
    weights = (.5-.5*np.cos(np.linspace(0,np.pi,n)))[:,None]
    seam = raw[b:b+n]*(1-weights) + raw[a:a+n]*weights
    cycle = np.vstack((raw[a+n:b],seam)).astype('float32')
    return cycle, {'loopStartSample':0,'loopEndSample':len(cycle),'method':'Complementary raised-cosine return to consecutive opening frames',
        'rawHeadSample':a,'rawTailSample':b,'crossfadeFrames':n,'spectralDistance':error,
        'designBpm':bpm,'targetBars':bars,'advisoryOnsetPeriodSeconds':float(lag)/25}

def ending(raw, rate):
    # Preserve the complete performance. Smooth its very last release and retain a
    # quarter-second of room to breathe before the player reports natural completion.
    n = len(raw)
    tail = min(round(1.8*rate), n)
    out = raw.copy()
    out[-tail:] *= (.5+.5*np.cos(np.linspace(0,np.pi,tail)))[:,None]
    pad = rate//4
    out = np.pad(out, ((0,pad),(0,0)))
    return out, {'loopStartSample':None,'loopEndSample':None, 'method':'One-shot whole generated closing performance with raised-cosine final release and silent hold',
        'fadeStartSample':n-tail,'fadeEndSample':n,'postRollFrames':pad}

def prepare(slug, target_dir, record_dir):
    source = OUT/'sources'/(slug+'.wav')
    target = target_dir/('t125-'+slug+'.wav')
    target_dir.mkdir(parents=True,exist_ok=True)
    record_dir.mkdir(parents=True,exist_ok=True)
    assert not target.exists(), 'Preserve prepared takes.'
    raw,rate = sf.read(source,dtype='float32',always_2d=True)
    assert rate==48000 and raw.shape[1]==2 and np.isfinite(raw).all()
    if slug in LOOPS:
        body, record = circular_edit(raw,rate,*LOOPS[slug])
    else:
        body, record = ending(raw,rate)
    with tempfile.NamedTemporaryFile(suffix='.wav') as interim:
        sf.write(interim.name,body,rate,subtype='FLOAT')
        before = analysis.levels(interim.name)
    gain = min(-23-float(before['input_i']),-1.5-float(before['input_tp']))
    body *= 10**(gain/20)
    # A FLOAT WAV carries the writer time in its RIFF PEAK chunk. Retain that
    # header so rerendering the original take restores the exact native input file.
    canonical = OUT/'records'/(slug+'-edit.json')
    if canonical.exists():
        original = json.loads(canonical.read_text())
        header = bytes.fromhex(original['preparedWaveHeaderHex'])
        assert analysis.digest(source)==original['sourceSha256']
        payload = np.asarray(body,dtype='<f4').tobytes()
        assert header[-8:-4]==b'data' and int.from_bytes(header[-4:],'little')==len(payload)
        with target.open('xb') as f:
            f.write(header)
            f.write(payload)
        assert analysis.digest(target)==original['preparedSha256']
    else:
        sf.write(target,body,rate,subtype='FLOAT')
        with target.open('rb') as f:
            header=f.read(target.stat().st_size-body.size*4)
    record['preparedWaveHeaderHex']=header.hex()
    record.update(slug=slug,sourceSha256=analysis.digest(source),preparedSha256=analysis.digest(target),
        sampleRate=rate,channels=2,rawFrames=len(raw),frameCount=len(body),gainDb=gain,
        preGain=before,postGain=analysis.levels(target),firstFrame=body[0].tolist(),lastFrame=body[-1].tolist())
    with (record_dir/(slug+'-edit.json')).open('x') as f:
        json.dump(record,f,indent=2); f.write('\n')
    print(slug, len(body)/rate, flush=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('slug',choices=[*LOOPS,'epilogue'])
    parser.add_argument('--scratch',type=Path,help='Separate empty directory for regenerated audio and edit records')
    args=parser.parse_args()
    prepare(args.slug,args.scratch or ROOT/'.local/T125/prepared',args.scratch or OUT/'records')
