# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Validate reopened two-stem mixes and encode deployment and audition media."""
import argparse
import json
from pathlib import Path
import sqlite3
import subprocess
import tempfile

import numpy as np
import soundfile as sf
from synthesize import OUT, ROOT, RATE, LAYERS, digest, levels

def read(name):
    return json.loads((OUT/'records'/(name+'.json')).read_text())

def record(name, data):
    (OUT/'records'/(name+'.json')).write_text(json.dumps(data,indent=2)+'\n')

def file(path):
    return {'path':str(path.relative_to(ROOT)), 'sha256':digest(path),'bytes':path.stat().st_size}

def mp3(source, destination):
    with tempfile.TemporaryDirectory() as scratch:
        tmp=Path(scratch)/'candidate.mp3'
        subprocess.run(['ffmpeg','-nostdin','-loglevel','error','-i',str(source),'-map_metadata','-1',
                        '-c:a','libmp3lame','-ar','48000','-ac','2','-b:a','128k',str(tmp)],check=True)
        if destination.exists():
            assert digest(tmp)==digest(destination)
        else:
            destination.write_bytes(tmp.read_bytes())

def native_and_web(key):
    score=read(key+'-score')
    native=read(key+'-native')
    project=OUT/'projects'/(key+'.aup4')
    master=OUT/'masters'/(key+'.wav')
    web=ROOT/'public/assets/audio/ambience'/(key+'.mp3')
    assert digest(project)==native['sha256BeforeReopen']==native['sha256AfterReopen']
    assert digest(master)==native['nativeMasterSha256'] and native['creationPid']!=native['reopenPid']
    assert native['tracksAtCreation']==native['tracksAfterReopen']
    assert len(native['tracksAtCreation'])==2
    with sqlite3.connect(project.resolve().as_uri()+'?immutable=1',uri=True) as db:
        assert db.execute('pragma integrity_check').fetchone()[0]=='ok'
    mixed=np.zeros((score['frames'],2))
    for i,layer in enumerate(score['layers']):
        path=ROOT/layer['path']
        assert digest(path)==layer['sha256'] and layer['track'] in native['tracksAfterReopen'][i]
        assert sf.info(path).subtype=='PCM_24'
        signal,r=sf.read(path,always_2d=True)
        assert r==RATE and signal.shape==mixed.shape
        mixed+=signal
    assert native['secondSourceSha256']==score['layers'][1]['sha256']
    result,r=sf.read(master,always_2d=True)
    n=len(result)
    assert r==RATE and mixed.shape==result.shape and sf.info(master).subtype=='PCM_24'
    error=float(np.max(np.abs(result-mixed)))
    assert error<.000002
    mp3(master,web)
    decoded,r=sf.read(web,always_2d=True)
    assert r==RATE and decoded.shape==result.shape and np.isfinite(decoded).all()
    web_levels=levels(web)
    assert abs(float(web_levels['input_i'])+30)<.65 and float(web_levels['input_tp']) < -1
    # Use FLAC to preserve each decoded seam in the playable excerpt. Only the
    # outer edges of each four-second window are faded for transport.
    clip=np.vstack((decoded[-2*RATE:],decoded[:2*RATE]))
    fade=np.linspace(0,1,RATE//20)[:,None]
    clip[:len(fade)]*=fade
    clip[-len(fade):]*=fade[::-1]
    gap=np.zeros((round(.15*RATE),2))
    sample=np.vstack((clip,gap,clip,gap,clip))
    joins=OUT/'listening'/(key+'-joins.flac')
    sf.write(joins,sample,RATE,subtype='PCM_24')
    excerpt,_=sf.read(joins,always_2d=True)
    preview_error=float(np.max(np.abs(excerpt-sample)))
    assert preview_error<.00000012
    anchor=max(range(4096,RATE,1024),key=lambda pos:np.var(result[pos:pos+1024:8,0]))
    data={'slug':key,'web':file(web),'nativeProject':file(project),'master':file(master),'excerpt':file(joins),
          'frames':n,'sampleRate':r,'channels':2,'loopStartSample':0,'loopEndSample':n,
          'nativeVsTwoStemSumMaxAbsError':error,'excerptVsWebWindowsMaxAbsError':preview_error,
          'masterLevels':levels(master),'webLevels':web_levels,'webSamplePeakDbfs':float(20*np.log10(np.max(np.abs(decoded)))),
          'monoFoldVsStereoRmsDb':float(10*np.log10(np.mean(decoded.mean(axis=1)**2)/np.mean(decoded**2))),
          'webBoundaryStepMaxAbs':float(np.max(np.abs(decoded[-1]-decoded[0]))),
          'decodedStereoFloat32Bytes':n*2*4,
          'anchor':{'frame':anchor,'samples':result[anchor:anchor+1024:8,0].round(8).tolist(),'stride':8}}
    record(key+'-export',data)
    print(key,error,web_levels['input_i'],flush=True)

def speech_examples():
    ref=ROOT/'public/assets/audio/auditions/titan-019.mp3'
    speech,r=sf.read(ref,always_2d=True)
    text=(OUT.parent/'auditions/scripts/titan-019.txt').read_text().strip()
    assert r==RATE and speech.shape[1]==1
    span=14*RATE
    start=2*RATE
    stop=start+len(speech)
    fader=np.ones(span)
    duck=10**(-6/20)
    attack=round(.12*RATE)
    release=round(.35*RATE)
    fader[start-attack:start]=np.linspace(1,duck,attack,endpoint=False)
    fader[start:stop]=duck
    fader[stop:stop+release]=np.linspace(duck,1,release,endpoint=False)
    reels=[]
    for offset in (0,4,8):
        batch=list(LAYERS)[offset:offset+4]
        sections=[]
        for key in batch:
            audio,_=sf.read(ROOT/read(key+'-export')['web']['path'],always_2d=True)
            cue=audio[len(audio)//3:len(audio)//3+span]*fader[:,None]
            cue[start:stop]+=speech
            ramp=np.linspace(0,1,RATE//8)[:,None]
            cue[:len(ramp)]*=ramp
            cue[-len(ramp):]*=ramp[::-1]
            sections.append(cue)
        reel=np.vstack(sections)
        assert np.max(np.abs(reel))<1
        path=OUT/'listening'/(batch[0]+'-'+batch[-1]+'-speech.mp3')
        with tempfile.TemporaryDirectory() as scratch:
            pcm=Path(scratch)/'reel.wav'
            sf.write(pcm,reel,RATE,subtype='PCM_24')
            mp3(pcm,path)
        reels.append({'file':file(path),'rooms':batch,'excerptStartsSeconds':[0,14,28,42]})
    record('listening-mix',{'reels':reels,'voice':file(ref),'transcript':text,'voiceStartsWithinSectionSeconds':2,
                            'duckDb':-6,'attackSeconds':.12,'releaseSeconds':.35,'purpose':'Compare the same auditioned voice versus each room.'})

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('rooms',nargs='*')
    parser.add_argument('--speech',action='store_true')
    args=parser.parse_args()
    for key in args.rooms:
        native_and_web(key)
    if args.speech:
        speech_examples()
