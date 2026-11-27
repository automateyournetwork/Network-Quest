# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Music and auditioned dialogue at proposed levels for an isolated listening review."""
from pathlib import Path
import json
import tempfile
import numpy as np
import soundfile as sf
from prepare import DESIGN, OUT, ROOT, digest
import importlib
encode = importlib.import_module('encode-check')
rate=48000
window=14
overlap=rate//4
slugs=list(DESIGN)
speech=('narrator-001','titan-019','narrator-005','photon-035')
reel=np.zeros((window*rate*4-overlap*3,2))
records=[]
for index,(slug,line) in enumerate(zip(slugs,speech)):
    music=ROOT/'public/assets/audio/music'/(slug+'.mp3')
    voice=ROOT/'public/assets/audio/auditions'/(line+'.mp3')
    bed,r=sf.read(music,always_2d=True);words,v=sf.read(voice,always_2d=True)
    assert r==v==rate and words.shape[1]==1 and len(words)<11*rate
    sample=bed[round(len(bed)*.36):round(len(bed)*.36)+window*rate].copy()
    onset=2*rate
    attack=round(rate*.12);release=round(rate*.35)
    gain=10**(-6/20)
    sample[onset-attack:onset]*=np.linspace(1,gain,attack)[:,None]
    sample[onset:onset+len(words)]*=gain
    sample[onset+len(words):onset+len(words)+release]*=np.linspace(gain,1,release)[:,None]
    sample[onset:onset+len(words)]+=words
    sample[:overlap]*=np.linspace(0,1,overlap)[:,None]
    sample[-overlap:]*=np.linspace(1,0,overlap)[:,None]
    start=index*(window*rate-overlap)
    reel[start:start+len(sample)]+=sample
    records.append({'slug':slug,'musicSha256':digest(music),'speechPreviewSha256':digest(voice),
        'speechPreviewPath':str(voice.relative_to(ROOT)),'cueStartSeconds':start/rate,
        'speechStartSeconds':(start+onset)/rate,'text':(ROOT/'assets-src/audio/auditions/scripts'/(line+'.txt')).read_text().strip()})
assert np.max(np.abs(reel)) < .95
with tempfile.TemporaryDirectory() as tmp:
    path=Path(tmp)/'room-dialogue.wav'
    sf.write(path,reel,rate,subtype='PCM_24')
    output=OUT/'listening/conversation-and-transitions.mp3'
    encode.mp3(path,output)
record={'mixPath':str(output.relative_to(ROOT)),'sha256':digest(output),'sampleRate':rate,
        'sampleCount':len(reel),'duckDb':-6,'attackMs':120,'releaseMs':350,'transitionMs':250,
        'description':'Isolated developer mix with approved audition voices. Actual room mix remains a later integration review.',
        'segments':records}
(OUT/'records/listening-mix.json').write_text(json.dumps(record,indent=2)+'\n')
