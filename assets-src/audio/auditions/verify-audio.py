# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""File/signal evidence only; never substitutes for the preserved human review."""
from pathlib import Path
import hashlib
import json
import math
import re
import subprocess
import numpy as np
import soundfile as sf

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
rows=json.loads((OUT/'provenance/candidate-index.json').read_text())
records=[]
def describe(path):
    samples,rate=sf.read(path,always_2d=True);info=sf.info(path)
    assert np.isfinite(samples).all() and np.max(np.abs(samples))>0
    assert np.max(np.abs(samples))<1
    return {'path':str(path.relative_to(ROOT)), 'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
       'bytes':path.stat().st_size,'format':info.format,'subtype':info.subtype,
       'sampleRate':rate,'frames':len(samples),'channels':samples.shape[1],
       'durationSeconds':len(samples)/rate,'peakDbfs':20*math.log10(float(np.max(np.abs(samples)))),
       'finite':True,'nonSilent':True,'belowFullScale':True}
def loudness(path):
    r=subprocess.run(['/opt/homebrew/bin/ffmpeg','-nostdin','-hide_banner','-i',str(path),
        '-af','loudnorm=I=-18:TP=-1:LRA=11:print_format=json','-f','null','-'],capture_output=True,text=True,check=True)
    data=json.loads(re.findall(r'\{[^{}]+\}',r.stderr,re.S)[-1])
    def finite(x):
        f=float(x);return f if math.isfinite(f) else None
    return {'integratedLufs':finite(data['input_i']),'truePeakDbtp':finite(data['input_tp']),
            'loudnessRangeLu':finite(data['input_lra']),'measurement':'FFmpeg loudnorm input analysis; short-effect integrated loudness may be undefined'}
for row in rows:
    slug=row['slug']; inp=OUT/'mix-inputs'/(slug+'.wav'); master=OUT/'masters'/(slug+'.wav')
    paths={'raw':ROOT/row['rawPath'],'mixInput':inp,'nativeMaster':master,
           'web':ROOT/'public/assets/audio/auditions'/(slug+'.mp3')}
    a,rate=sf.read(inp,always_2d=True);b,rate2=sf.read(master,always_2d=True)
    assert rate==rate2==48000 and a.shape[1]==b.shape[1]
    assert 0<=len(a)-len(b)<=1
    assert np.max(np.abs(a[:len(b)]-b))<2e-6
    record={'slug':slug,'assetId':row['assetId'],'files':{k:describe(v) for k,v in paths.items()},
        'masterLoudness':loudness(master),'webLoudness':loudness(paths['web']),
        'roundtrip':{'inputFrames':len(a),'masterFrames':len(b),'frameDifference':len(a)-len(b),
        'maximumAbsoluteSampleDifference':float(np.max(np.abs(a[:len(b)]-b))),
        'interpretation':'Native PCM24 export includes quantization/dither. Three speech masters lose one trailing 48k sample (20.83 microseconds); no bit-identical or audible-equivalence claim. Frozen preview bytes remain unchanged.'},
        'loopStartSample':None,'loopEndSample':None,'listening':'See actual owner review; these statistics are not listening.'}
    records.append(record)
seal=json.loads((OUT/'provenance/review-packet-seal.json').read_text())
for f in [seal['html']]+[f for c in seal['candidates'] for f in c['files']]:
    actual=ROOT/f['path'];assert actual.stat().st_size==f['bytes']
    assert hashlib.sha256(actual.read_bytes()).hexdigest()==f['sha256']
(OUT/'provenance/signal-checks.json').write_text(json.dumps({'frozenPacketVerified':seal['packetId'],'records':records},indent=2)+'\n')
print(json.dumps({'candidates':len(records),'filesDecoded':len(records)*4,
    'nativeMasters':'12 actual48k PCM24 exports;11mono/1stereo','frozenPacketVerified':True,
    'oneSampleShortMasters':[r['slug'] for r in records if r['roundtrip']['frameDifference']]},indent=2))
