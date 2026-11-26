# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Three original AI-assisted synthesized effects; no recordings or model inference."""
from pathlib import Path
import hashlib
import json
import time
import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent
RATE = 48000
rng = np.random.default_rng(20261126)
start = time.perf_counter()

def resonator(duration, frequencies, decays, gains):
    t = np.arange(round(duration * RATE))/RATE
    signal = sum(g*np.sin(2*np.pi*f*t)*np.exp(-t/d)
                 for f,d,g in zip(frequencies,decays,gains))
    signal *= np.minimum(t/.0015, 1)
    signal[-240:] *= np.linspace(1,0,240)
    return signal

tick = resonator(.16, [680, 1435, 2810], [.024,.012,.005], [.6,.18,.08])
tick += rng.normal(0,.07,len(tick))*np.exp(-np.arange(len(tick))/RATE/.004)
latch = np.zeros(round(1.4*RATE))
for offset, gain, freqs, decays in [(.025,.6,[165,391,1087],[.12,.065,.022]),
                                  (.22,.4,[109,277,821],[.21,.13,.05]),
                                  (.56,.22,[82,223,597],[.26,.18,.055])]:
    part = resonator(.75,freqs,decays,[gain,gain*.42,gain*.15])
    at=round(offset*RATE); latch[at:at+len(part)] += part
glimmer = np.zeros(round(1.8*RATE))
for offset, note, gain in [(0,74,.19),(.12,81,.13),(.24,86,.075)]:
    freq=440*2**((note-69)/12)
    part=resonator(1.5,[freq,freq*2.01,freq*3.98],[.37,.18,.09],[gain,gain*.2,gain*.05])
    at=round(offset*RATE); glimmer[at:at+len(part)] += part

settings=[('effect-001',tick,'Brief wooden activation tick',[680,1435,2810],-16),
          ('effect-013',latch,'Latch contact followed by a small weight settle',[165,109,82],-10),
          ('effect-023',glimmer,'Photon inspection glimmer; decorative glass harmonics',[74,81,86],-15)]
records=[]
for slug, signal, description, pitches, peak_db in settings:
    signal *= 10**(peak_db/20)/np.max(np.abs(signal))
    output=OUT/'raw'/(slug+'.wav')
    assert not output.exists(), 'Preserve prior attempt under a new candidate ID.'
    sf.write(output,signal,RATE,subtype='FLOAT')
    records.append({'slug':slug,'assetId':'spec001:ASSET-EFFECT-'+slug[-3:],
        'eventId':'t065-'+slug+'-synthesis-20261126-a','method':'synthesized',
        'description':description,'pitchParameters':pitches,'targetSamplePeakDbfs':peak_db,
        'rawPath':str(output.relative_to(OUT.parents[2])),
        'rawSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
        'sampleRate':RATE,'durationSeconds':len(signal)/RATE,'channels':1,
        'randomSeed':20261126,'source':'synthesize-effects.py',
        'aiDisclosure':'Codex-assisted original synthesis code, rendered locally; not a model-generated recording.',
        'humanListening':'pending; captions/purpose from production-plan remain authoritative'})
(OUT/'provenance/effects-run.json').write_text(json.dumps({'records':records,
    'generationSeconds':time.perf_counter()-start,'numpyVersion':np.__version__,
    'soundfileVersion':sf.__version__},indent=2)+'\n')
print(json.dumps({'count':len(records),'elapsedSeconds':time.perf_counter()-start}))
