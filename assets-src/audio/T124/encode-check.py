# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify native exports, encode web files and prepare exact-web review excerpts."""
import hashlib
import json
import math
from pathlib import Path
import sqlite3
import subprocess
import tempfile
import numpy as np
import soundfile as sf
from prepare import DESIGN, OUT, ROOT, levels

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def save(path, data):
    path.write_text(json.dumps(data,indent=2)+'\n')

def mp3(source, output):
    args=['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-n','-i',str(source),
          '-map_metadata','-1','-c:a','libmp3lame','-b:a','192k','-ar','48000','-ac','2',str(output)]
    if not output.exists():
        subprocess.run(args,check=True)
    else:
        # A sealed web file must still be the exact deterministic encode of this master.
        with tempfile.TemporaryDirectory() as scratch:
            candidate=Path(scratch)/'candidate.mp3'
            subprocess.run(args[:-1]+[str(candidate)],check=True)
            assert digest(candidate)==digest(output)
    return [source.name if arg == str(source) else output.name if arg == str(output) else arg for arg in args]

if __name__=='__main__':
    out_web=ROOT/'public/assets/audio/music'
    out_web.mkdir(parents=True,exist_ok=True)
    listen=OUT/'listening'
    listen.mkdir(exist_ok=True)
    for slug in DESIGN:
        master=OUT/'masters'/(slug+'.wav')
        project=OUT/'projects'/(slug+'.aup4')
        source=OUT/'sources'/(slug+'.wav')
        prepared=ROOT/'.local/T124/prepared'/(slug+'.wav')
        web=out_web/(slug+'.mp3')
        native=json.loads((OUT/'records'/(slug+'-native.json')).read_text())
        edit=json.loads((OUT/'records'/(slug+'-edit.json')).read_text())
        raw=sf.info(source)
        a,sr=sf.read(prepared,always_2d=True)
        b,rate=sf.read(master,always_2d=True)
        assert sr==rate==raw.samplerate==48000 and sf.info(master).subtype=='PCM_24'
        assert 0<=len(a)-len(b)<=1 and a.shape[1]==b.shape[1]==2 and len(a)==edit['frameCount']
        assert digest(master)==native['nativeMasterSha256'] and digest(project)==native['sha256AfterReopen']
        assert digest(prepared)==edit['preparedSha256']==native['preparedSha256'] and digest(source)==edit['sourceSha256']
        error=float(np.max(np.abs(a[:len(b)]-b)))
        assert np.isfinite(b).all() and error<2e-6
        with sqlite3.connect(project.resolve().as_uri()+'?immutable=1',uri=True) as db:
            assert db.execute('pragma integrity_check').fetchone()[0]=='ok'
        command=mp3(master,web)
        decoded,s=sf.read(web,always_2d=True)
        assert s==rate and decoded.shape==b.shape and np.isfinite(decoded).all()
        # Three end-to-start comparisons. Separate excerpts with 150ms silence;
        # give only the *outer* edges a short fade and preserve the actual seam.
        clip=np.vstack((decoded[-2*s:],decoded[:2*s]))
        ramp=np.linspace(0,1,round(s*.05))[:,None]
        clip[:len(ramp)]*=ramp
        clip[-len(ramp):]*=ramp[::-1]
        pause=np.zeros((round(.15*s),2))
        repeated=np.vstack((clip,pause,clip,pause,clip))
        with tempfile.TemporaryDirectory() as scratch:
            pcm=Path(scratch)/'three-joins.wav'
            sf.write(pcm,repeated,s,subtype='PCM_24')
            mp3(pcm,listen/(slug+'-three-joins.mp3'))
        record={'slug':slug,'masterSha256':digest(master),'mp3Sha256':digest(web),
                'sha256ThreeJoinsPreview':digest(listen/(slug+'-three-joins.mp3')),
                'encoder':subprocess.check_output(['ffmpeg','-version'],text=True).splitlines()[0],
                'encodeCommand':command,'rate':rate,'frames':len(b),'channels':2,
                'masterPeakDbfs':20*math.log10(np.max(np.abs(b))),
                'mp3PeakDbfs':20*math.log10(np.max(np.abs(decoded))),
                'masterLoudness':levels(master),'mp3Loudness':levels(web),
                'nativeVsPreparedMaxAbsError':error,'nativeTrailingFramesLost':len(a)-len(b),
                'monoToStereoRmsRatioDb':20*np.log10(np.sqrt(np.mean(np.square(b.mean(axis=1))))/np.sqrt(np.mean(np.square(b)))),
                'loopStartSample':0,'loopEndSample':len(b),'anchor':{'start':4096,'stride':8,
                'channel':0,'samples':[round(v,7) for v in b[4096:4096+1024:8,0]]}}
        save(OUT/'records'/(slug+'-export.json'),record)
        print(slug,len(b),error,record['mp3Loudness']['input_i'],flush=True)
