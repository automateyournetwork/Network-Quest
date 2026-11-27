# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify all native lineage, encode and produce short listening excerpts."""
import importlib
import json
from pathlib import Path
import sqlite3
import tempfile
import numpy as np
import soundfile as sf
from edit_cues import OUT, ROOT, analysis

encode = importlib.import_module('encode-check').mp3
SLUGS = ['radio','clockworks','rift','epilogue']
RATE = 48000
VOICE = 'titan-019'

def read_record(name):
    return json.loads((OUT/'records'/(name+'.json')).read_text())

def record(name, data):
    (OUT/'records'/(name+'.json')).write_text(json.dumps(data,indent=2)+'\n')

def summarize(path):
    return {'path':str(path.relative_to(ROOT)),'bytes':path.stat().st_size,'sha256':analysis.digest(path)}

def render_example(signal, dest):
    with tempfile.TemporaryDirectory() as folder:
        pcm = Path(folder)/'preview.wav'
        sf.write(pcm,signal,RATE,subtype='PCM_24')
        encode(pcm,dest)

def check(slug):
    edit = read_record(slug+'-edit')
    native = read_record(slug+'-native')
    generation = read_record(slug+'-generation')
    raw = OUT/'sources'/(slug+'.wav')
    prepared = ROOT/'.local/T125/prepared'/('t125-'+slug+'.wav')
    project = OUT/'projects'/(slug+'.aup4')
    master = OUT/'masters'/(slug+'.wav')
    web = ROOT/'public/assets/audio/music'/(slug+'.mp3')
    assert analysis.digest(raw)==generation['rawSha256']==edit['sourceSha256']
    assert analysis.digest(prepared)==native['preparedSha256']==edit['preparedSha256']
    assert analysis.digest(master)==native['nativeMasterSha256']
    assert analysis.digest(project)==native['sha256AfterReopen']==native['sha256BeforeReopen']
    assert native['creationPid']!=native['reopenPid']
    with sqlite3.connect(project.resolve().as_uri()+'?immutable=1',uri=True) as db:
        assert db.execute('pragma integrity_check').fetchone()[0]=='ok'
    source, s = sf.read(prepared,always_2d=True)
    final, r = sf.read(master,always_2d=True)
    assert r==s==RATE and source.shape==(edit['frameCount'],2) and final.shape[1]==2
    assert len(source)-len(final) in (0,1)
    assert sf.info(master).subtype=='PCM_24'
    error = float(np.max(np.abs(source[:len(final)]-final)))
    assert error<.000002 and np.isfinite(final).all()
    args = encode(master,web)
    decoded, wr = sf.read(web,always_2d=True)
    assert wr==RATE and decoded.shape==final.shape and np.isfinite(decoded).all()
    n=len(final)
    if slug=='epilogue':
        sample=decoded[-RATE*10:].copy()
        example=OUT/'listening/epilogue-final-decay.mp3'
    else:
        window=np.vstack((decoded[-2*RATE:],decoded[:2*RATE]))
        edges=np.linspace(0,1,RATE//20)[:,None]
        window[:len(edges)]*=edges
        window[-len(edges):]*=edges[::-1]
        pause=np.zeros((round(.15*RATE),2))
        sample=np.vstack((window,pause,window,pause,window))
        example=OUT/'listening'/(slug+'-three-joins.mp3')
    render_example(sample,example)
    # Pick an energetic 20 ms segment at the start for decoder offset comparison,
    # including the quiet entrance of the epilogue.
    a=max(range(4096, RATE, 1024),key=lambda i: np.var(final[i:i+1024:8,0]))
    data={'slug':slug,'sampleRate':r,'channels':2,'frames':n,'source':summarize(raw),'project':summarize(project),
        'master':summarize(master),'web':summarize(web),'listenExcerpt':summarize(example),
        'nativeVsPreparedMaxAbsError':error, 'encodeCommand':args,'loopStartSample':edit['loopStartSample'],
        'loopEndSample':n if edit['loopEndSample'] is not None else None,
        'nativeTrailingFramesOmitted':len(source)-n,'masterLevels':analysis.levels(master),'webLevels':analysis.levels(web),
        'webSamplePeakDbfs':float(20*np.log10(np.max(np.abs(decoded)))),
        'lateRmsDbfs':float(20*np.log10(max(1e-15,np.sqrt(np.square(decoded[-RATE//8:]).mean())))),
        'monoFoldVsStereoRmsDb':float(10*np.log10(np.mean(decoded.mean(axis=1)**2)/np.mean(decoded**2))),
        'anchor':{'frame':a,'stride':8,'channel':0,'samples':final[a:a+1024:8,0].round(8).tolist()}}
    assert float(data['webLevels']['input_tp']) <= -1 and abs(float(data['webLevels']['input_i'])+23)<.6
    if slug=='epilogue':
        assert data['lateRmsDbfs'] < -90
    record(slug+'-export',data)
    print(slug, data['webLevels']['input_i'], data['webLevels']['input_tp'], flush=True)

def review_mix():
    # One unchanged dialogue excerpt isolates intelligibility differences across beds.
    path=ROOT/'public/assets/audio/auditions'/(VOICE+'.mp3')
    voice, r=sf.read(path,always_2d=True)
    assert r==RATE and voice.shape[1]==1
    span=14*RATE
    cross=RATE//4
    reel=np.zeros((len(SLUGS)*span-(len(SLUGS)-1)*cross,2))
    line_start=2*RATE
    line_end=line_start+len(voice)
    attack,release=round(.12*RATE),round(.35*RATE)
    floor=10**(-6/20)
    fader=np.ones(span)
    fader[line_start-attack:line_start]=np.linspace(1,floor,attack,endpoint=False)
    fader[line_start:line_end]=floor
    fader[line_end:line_end+release]=np.linspace(floor,1,release,endpoint=False)
    for i,slug in enumerate(SLUGS):
        music,_=sf.read(ROOT/'public/assets/audio/music'/(slug+'.mp3'),always_2d=True)
        start=len(music)//3
        section=music[start:start+span]*fader[:,None]
        section[line_start:line_end]+=voice
        section[:cross]*=np.linspace(0,1,cross)[:,None]
        section[-cross:]*=np.linspace(1,0,cross)[:,None]
        offset=i*(span-cross)
        reel[offset:offset+span]+=section
    assert np.isfinite(reel).all() and np.max(np.abs(reel))<1
    dest=OUT/'listening/conversation-and-transitions.mp3'
    render_example(reel,dest)
    record('listening-mix',{'web':summarize(dest),'order':SLUGS,'voice':summarize(path),
        'transcript':(OUT.parent/'auditions/scripts'/(VOICE+'.txt')).read_text().strip(),
        'cueDurationSeconds':14,'crossfadeSeconds':.25,'voiceStartsWithinCueSeconds':2,
        'reductionDb':6,'attackSeconds':.12,'releaseSeconds':.35,'peak':float(np.max(np.abs(reel))),
        'purpose':'Isolated mix for comparing the same Titan phrase against four candidate music beds.'})

if __name__=='__main__':
    for slug in SLUGS:
        check(slug)
    review_mix()
