# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify editable source, export mono MP3s from the native masters, preserve evidence."""
from hashlib import sha256
import json
import math
from pathlib import Path
import sqlite3
import subprocess
import tempfile

import numpy as np
import soundfile as sf

OUT = Path(__file__).resolve().parent
ROOT = OUT.parents[2]
AUDITIONS = OUT.parent/'auditions'


def digest(path):
    return sha256(path.read_bytes()).hexdigest()


def reference(path):
    return {'path': str(path.relative_to(ROOT)), 'bytes': path.stat().st_size, 'sha256': digest(path)}


def read(path):
    return json.loads(path.read_text())


def write(path, data):
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False)+'\n')


def db(value):
    return 20*math.log10(value)


def encode(source, out, channels, bitrate):
    with tempfile.TemporaryDirectory() as scratch:
        candidate = Path(scratch)/'candidate.mp3'
        command = ['ffmpeg','-hide_banner','-nostdin','-loglevel','error','-i',str(source),
                   '-map_metadata','-1','-c:a','libmp3lame','-ar','48000','-ac',str(channels),
                   '-b:a',bitrate,str(candidate)]
        subprocess.run(command, check=True)
        if out.exists():
            assert digest(candidate) == digest(out), 'Existing sealed web export differs'
        else:
            out.write_bytes(candidate.read_bytes())


def loudness(path):
    cmd = ['ffmpeg','-nostdin','-hide_banner','-i',str(path),'-af',
           'loudnorm=I=-23:TP=-1:LRA=11:print_format=json','-f','null','-']
    log = subprocess.run(cmd, text=True, capture_output=True, check=True).stderr
    values, _ = json.JSONDecoder().raw_decode(log[log.rfind('{'):])
    return {k: float(v) if math.isfinite(float(v)) else None for k,v in values.items() if k in ['input_i','input_tp']}


def preserve():
    seal = AUDITIONS/'provenance/review-packet-seal.json'
    original = read(seal)
    assert digest(seal) == '89e98ccf375c685164ba63b046a9c8daf17286cb8e0fa171d3a74e7900e6f3e0'
    frozen = [original['html']] + [f for c in original['candidates'] for f in c['files']]
    for entry in frozen:
        assert reference(ROOT/entry['path']) == entry
    bank = AUDITIONS/'projects/audition-bank.aup4'
    assert digest(bank) == '3d17afa984c7ef855b7cd9bee434502c433f5a4ad28099a1b7e61043c6358d35'
    collections = []
    for manifest in (AUDITIONS/'sha256-manifest.json', AUDITIONS/'metadata-followup/sha256-manifest.json'):
        entries = read(manifest)['files']
        for entry in entries:
            observed = reference(ROOT/entry['path'])
            assert all(observed[k] == entry[k] for k in observed)
        collections.append({'seal':reference(manifest),'entriesVerified':len(entries)})
    return {'packet':reference(seal), 'verifiedEntries':len(frozen), 'bank':reference(bank),
            'historicalSourceAndMetadataCollections':collections}


def main():
    proof = preserve()
    rows = []
    known = {a['assetId']:a for a in read(ROOT/'assets-src/manifest.json')['assets']}
    plan = read(OUT.parent/'production-plan.json')['effects'][:20]
    encoder = subprocess.check_output(['ffmpeg','-version'], text=True).splitlines()[0]
    for number, brief in enumerate(plan, 1):
        aid = brief['assetId']
        assert aid.endswith(f'-{number:03}')
        slug = f'fx-{number:03}'
        prior = number in (1, 13)
        if prior:
            asset = known[aid]
            for part in asset['sources'] + asset['exports']:
                record = part['file']
                actual = reference(ROOT/record['path'])
                assert all(record[k] == actual[k] for k in actual)
            master = ROOT/asset['audio']['masterPath']
            project = ROOT/asset['audio']['nativeProjectPath']
            source, _, prepared = [ROOT/s['file']['path'] for s in asset['sources'][:3]]
            web = ROOT/asset['exports'][0]['file']['path']
            review = next(r for r in asset['verification'] if r['check']=='listening')
            owner = read(ROOT/review['evidencePath'])
            assert owner['status']=='passed' and owner['actor']=='human'
            assert set(owner['details']['methods'])=={'ordinary-speakers','headphones'}
            assert digest(web)==owner['details']['frozenWebSha256']
        else:
            source = OUT/'raw'/(slug+'.wav')
            prepared = OUT/'prepared'/(slug+'.wav')
            master = OUT/'masters'/(slug+'.wav')
            project = OUT/'projects'/(slug+'.aup4')
            native = read(OUT/'records'/(slug+'-native.json'))
            design = read(OUT/'records'/(slug+'-design.json'))
            assert native['creationPid'] != native['reopenPid']
            assert native['sha256BeforeReopen'] == native['sha256AfterReopen'] == digest(project)
            assert native['preparedSha256'] == design['preparedSha256'] == digest(prepared)
            assert design['rawSha256'] == digest(source) and native['nativeMasterSha256'] == digest(master)
            assert slug in native['observedAtReopen'] and native['integrityAfterReopen']=='ok'
            web = ROOT/'public/assets/audio/effects'/(slug+'.mp3')
            encode(master, web, 1, '128k')
        with sqlite3.connect(project.as_uri()+'?immutable=1', uri=True) as connection:
            assert connection.execute('PRAGMA integrity_check').fetchone()==('ok',)
        native_audio, sr = sf.read(master)
        intended, rate = sf.read(prepared)
        decoded, web_rate = sf.read(web)
        assert sr == rate == web_rate == 48000 and native_audio.ndim == decoded.ndim == intended.ndim == 1
        assert sf.info(master).subtype=='PCM_24' and len(intended)-len(native_audio) in (0,1)
        assert len(decoded) in (len(native_audio),len(intended))
        assert np.isfinite(decoded).all() and .004 < np.max(np.abs(decoded)) < .76
        error = float(np.max(np.abs(intended[:len(native_audio)] - native_audio)))
        assert error < 2e-6
        # Compare the complete emitted waveform to the intended native source (lossy encode).
        corr = float(np.corrcoef(decoded[:len(native_audio)], native_audio)[0,1])
        assert corr > .91, (slug,corr)
        measure = loudness(web)
        assert measure['input_tp'] <= -1
        rows.append(dict(assetId=aid, name=brief['name'],roomId=brief['roomId'],purpose=brief['purpose'],
            caption=brief['caption'],playback=brief['playback'],reviewPlan=brief['reviewPlan'],
            originalAudition=prior, priorListeningEvidencePath=review['evidencePath'] if prior else None,
            raw=reference(source), prepared=reference(prepared), project=reference(project),
            master=reference(master), web=reference(web), encoder='Frozen T065 export' if prior else encoder,
            masterFrames=len(native_audio),webFrames=len(decoded),nativeFramesLost=len(intended)-len(native_audio),
            nativeMaxAbsError=error,
            nativeVsWebCorrelation=corr,webSamplePeakDbfs=db(np.max(np.abs(decoded))),
            webTruePeakDbtp=measure['input_tp'],webIntegratedLufs=measure['input_i'],
            rate=sr,channels=1,loopStartSample=None,loopEndSample=None))
    for key in ('raw','master','web'):
        assert len({r[key]['sha256'] for r in rows})==20
    write(OUT/'records/exports.json', {'historicalPreservation':proof,'cues':rows})


if __name__=='__main__':
    main()
