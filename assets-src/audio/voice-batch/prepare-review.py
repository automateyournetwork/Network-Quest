# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify actual native project, PCM and web lineage and produce an offline listening packet."""
import html
import importlib.util
import os
from pathlib import Path
import sqlite3
import sys

import numpy as np
import soundfile as sf
from generate import AUDIO, ROOT, bindings, digest, pathref, read, write

spec = importlib.util.spec_from_file_location('export_checks', AUDIO/'T127/verify-exports.py')
fx = importlib.util.module_from_spec(spec)
spec.loader.exec_module(fx)


def inspect(task, brief, known):
    aid = brief['assetId']
    slug = 'voice-'+aid[-3:]
    out = AUDIO/task
    old = known[aid]
    prior = aid in {r['canonical']['assetId'] for r in read(AUDIO/'auditions/provenance/voice-run.json')['records']}
    if prior:
        sources = {s['role']:ROOT/s['file']['path'] for s in old['sources']}
        for item in old['sources'] + old['exports']:
            observed = fx.reference(ROOT/item['file']['path'])
            assert all(item['file'][k] == v for k,v in observed.items())
        native,raw,source = sources['native'],sources['raw-generation'],sources['script']
        generation = ROOT/old['audio']['voiceRecordPath']
        prepared = next(ROOT/s['file']['path'] for s in old['sources'] if s['application']=='FFmpeg')
        master,web = ROOT/old['audio']['masterPath'],ROOT/old['exports'][0]['file']['path']
        listening = next(r['evidencePath'] for r in old['verification'] if r['check']=='listening')
        human = read(ROOT/listening)
        assert human['actor']=='human' and human['status']=='passed' and set(human['details']['methods'])=={'headphones','ordinary-speakers'}
        assert human['details']['frozenWebSha256']==digest(web)
        native_receipt = next(s['reopenEvidencePath'] for s in old['sources'] if s['role']=='native')
    else:
        native,raw,source,prepared,master = [out/role/(slug+suffix) for role,suffix in
            [('projects','.aup4'),('raw','.wav'),('scripts','.txt'),('prepared','.wav'),('masters','.wav')]]
        generation = out/'records'/(slug+'-generation.json')
        native_receipt = pathref(out/'records'/(slug+'-native.json'))
        receipt = read(ROOT/native_receipt)
        assert receipt['slug'] == slug and receipt['creationPid']!=receipt['reopenPid']
        assert receipt['observedAtReopen'].startswith('Track 1: '+slug+', audio track')
        assert receipt['integrityBeforeReopen']==receipt['integrityAfterReopen']=='ok'
        assert receipt['sha256BeforeReopen']==receipt['sha256AfterReopen']==digest(native)
        assert receipt['nativeMasterSha256']==digest(master) and receipt['preparedSha256']==digest(prepared)
        web = ROOT/'public/assets/audio/voices'/(slug+'.mp3')
        web.parent.mkdir(exist_ok=True,parents=True)
        fx.encode(master,web,1,'128k')
        listening = None
    gen = read(generation)
    assert gen['speakerId']==brief['speakerId'] and gen['text']==source.read_text()==brief['text']
    assert gen['scriptSha256']==brief['textSha256']==digest(source) and gen['rawSha256']==digest(raw)
    assert gen['lineId']==brief['lineId']==brief['captionId']
    with sqlite3.connect(native.as_uri()+'?immutable=1',uri=True) as db:
        assert db.execute('PRAGMA integrity_check').fetchone()==('ok',)
    intended,sr=sf.read(prepared); pcm,mr=sf.read(master); encoded,wsr=sf.read(web)
    assert sr==mr==wsr==48000 and intended.ndim==pcm.ndim==encoded.ndim==1
    assert sf.info(raw).subtype=='FLOAT' and sf.info(raw).samplerate==24000 and sf.info(master).subtype=='PCM_24'
    assert len(intended)-len(pcm) in (0,1) and len(encoded) in (len(pcm),len(intended))
    residual = float(np.max(np.abs(intended[:len(pcm)]-pcm)))
    correlation = float(np.corrcoef(encoded[:len(pcm)],pcm)[0,1])
    assert residual < 2e-6 and correlation > .97 and np.isfinite(encoded).all()
    levels = fx.loudness(web)
    assert levels['input_tp'] <= -1 and -21 <= levels['input_i'] <= -15, (slug,levels)
    return dict(assetId=aid,lineId=brief['lineId'],captionId=brief['captionId'],speakerId=brief['speakerId'],
        speaker=brief['name'].split(' — ')[0],voiceId=gen['voiceId'],number=aid[-3:],roomId=brief['roomId'],
        caption=brief['text'],captionSha256=brief['textSha256'],learningIntent=brief['learningIntent'],
        scope='Actual existing game use documented' if old['usedBy'] and prior else 'Planned dialogue placement; review page is an isolated fixture',
        actualUses=old['usedBy'] if prior else [],script=fx.reference(source), generation=fx.reference(generation),raw=fx.reference(raw),
        prepared=fx.reference(prepared),project=fx.reference(native),master=fx.reference(master),web=fx.reference(web),
        nativeReceipt=fx.reference(ROOT/native_receipt),priorListeningEvidencePath=listening,
        scriptWordsPerMinute=round(len(brief['text'].split())*60*48000/len(encoded),2),nativeResidual=residual,
        webMasterCorrelation=correlation,masterFrames=len(pcm),webFrames=len(encoded),webLufs=levels['input_i'],
        webSamplePeakDbfs=fx.db(np.max(np.abs(encoded))),webTruePeakDbtp=levels['input_tp'])


def main(task):
    out = AUDIO/task
    alloc, brief = bindings(task)
    known = {a['assetId']:a for a in read(ROOT/'assets-src/manifest.json')['assets']}
    cues = read(out/'cues.json')
    rows = [inspect(task,row,known) for row in brief]
    assert set(cues)=={r['number'] for r in rows}
    assert all(len({r[key]['sha256'] for r in rows})==20 for key in ('web','raw','master','script'))
    packet = f"{task.lower()}-voices-{rows[0]['number']}-{rows[-1]['number']}-a"
    template = (Path(__file__).parent/'review-template.html').read_text()
    groups = []
    for row in rows:
        n = row['number']
        row['listenFor']=cues[n]
        prior = 'Previously heard on speakers and earbuds.' if row['priorListeningEvidencePath'] else 'Awaiting speaker and headphone review.'
        title = f"{n} · {row['speaker']}"
        groups.append(f'<section id="line-{n}"><h2>{html.escape(title)}</h2><p class="caption">{html.escape(row["caption"])}</p>'
            f'<p><b>Listen for</b> · {html.escape(cues[n])}</p><p>{prior}</p>'
            f'<audio id="audio-{n}" controls preload="metadata" aria-label="{html.escape(title)}" src="{html.escape(os.path.relpath(ROOT/row["web"]["path"],out))}"></audio>'
            f'<button type="button" data-play="{n}">Replay line {n}</button></section>')
    for key,value in {'@@ROWS@@':'\n'.join(groups),'@@FIRST@@':rows[0]['number'],'@@LAST@@':rows[-1]['number'],'@@PACKET@@':packet}.items():
        template = template.replace(key,value)
    html_path=out/'review.html'
    html_path.write_text(template)
    write(out/'records/exports.json',dict(packetId=packet,allocation=alloc['task'],voices=rows))
    write(out/'records/listening-seal.json',dict(packetId=packet,html=fx.reference(html_path),humanDecision='pending',
        priorApproval=[r['number'] for r in rows if r['priorListeningEvidencePath']],voices=rows))


if __name__=='__main__':
    main(sys.argv[1])
