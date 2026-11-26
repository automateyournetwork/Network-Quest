# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Measured, reversible audition preparation before native Audacity import."""
from pathlib import Path
import hashlib
import json
import re
import subprocess
import time

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[2]
(OUT/'mix-inputs').mkdir(exist_ok=True)
rows=json.loads((OUT/'provenance/candidate-index.json').read_text())
records=[]
def run(args):
    r=subprocess.run(args,capture_output=True,text=True,check=True)
    return r.stderr
def measured(path,target):
    args=['/opt/homebrew/bin/ffmpeg','-nostdin','-hide_banner','-i',str(path),
          '-af',f'loudnorm=I={target}:TP=-1:LRA=11:print_format=json','-f','null','-']
    log=run(args)
    return json.loads(re.findall(r'\{[^{}]+\}',log,re.S)[-1]),args
for row in rows:
    start=time.perf_counter()
    source=ROOT/row['rawPath']; output=OUT/'mix-inputs'/(row['slug']+'.wav')
    assert not output.exists(), 'Do not overwrite a measured candidate.'
    target=row['targetLufs']; filters=[]; stats=None; measurement_args=None
    if target is not None:
        stats,measurement_args=measured(source,target)
        filters.append(f"loudnorm=I={target}:TP=-1:LRA=11:measured_I={stats['input_i']}:measured_TP={stats['input_tp']}:measured_LRA={stats['input_lra']}:measured_thresh={stats['input_thresh']}:offset={stats['target_offset']}:linear=true:print_format=json")
    if row['kind']=='music':
        filters += ['afade=t=in:st=0:d=0.2','afade=t=out:st=19.2:d=0.8']
    args=['/opt/homebrew/bin/ffmpeg','-nostdin','-v','info','-i',str(source)]
    if filters:args+=['-af',','.join(filters)]
    args+=['-ar','48000','-ac','2' if row['kind']=='music' else '1','-c:a','pcm_f32le',str(output)]
    log=run(args)
    record={**row,'rawSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
       'mixInputPath':str(output.relative_to(ROOT)),'mixInputSha256':hashlib.sha256(output.read_bytes()).hexdigest(),
       'measurementArgs':measurement_args,'inputLoudness':stats,'renderArgs':args,
       'elapsedSeconds':time.perf_counter()-start,'sampleRate':48000,
       'channels':2 if row['kind']=='music' else 1,'subtype':'FLOAT',
       'meaning':'Reversible normalization/resampling and stated music edge fades. No loop or listening acceptance.'}
    records.append(record)
(OUT/'provenance/mix-preparation.json').write_text(json.dumps({'ffmpegVersion':subprocess.check_output(['/opt/homebrew/bin/ffmpeg','-version'],text=True).splitlines()[0],'records':records},indent=2)+'\n')
print(json.dumps({'prepared':len(records),'seconds':sum(r['elapsedSeconds'] for r in records)}))
