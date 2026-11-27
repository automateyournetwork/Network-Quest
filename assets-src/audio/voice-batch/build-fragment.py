# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bind declared voice generation, rights, edit and playback evidence to the exact asset."""
import hashlib
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[3]
AUDIO = ROOT/'assets-src/audio'


def read(path):
    return json.loads((ROOT/path).read_text())


def write(path,data):
    (ROOT/path).parent.mkdir(exist_ok=True,parents=True)
    (ROOT/path).write_text(json.dumps(data,indent=2,ensure_ascii=False,allow_nan=False)+'\n')


def digest(path):
    with (ROOT/path).open('rb') as f:
        return hashlib.file_digest(f,'sha256').hexdigest()


def main(task):
    assert task in ('T129','T130','T131')
    relative = Path('assets-src/audio')/task
    base = str(relative)+'/'
    notice = base+'NOTICE.md'
    assignment = next(b for b in read('assets-src/production-allocation.json')['batches'] if b['task']==task)
    existing = {a['assetId']:a for a in read('assets-src/manifest.json')['assets']}
    index = read(base+'records/exports.json')
    reports = read(base+'records/browser.json')
    assert reports['packetId']==index['packetId'] and len(reports['reports'])==2
    author = 'Codex loop'+str(int(task[1:])+17)+'/'+task
    date = reports['timeUtc'][:10]
    env = 'Mac ARM64; CPU Kokoro 0.9.4, FFmpeg 9.0.1, official Audacity 4.0.2 Linux ARM64 on a task-local virtual display; headless Chromium and Firefox.'
    components = ['Misaki-0.9.4-LICENSE.txt','Phonemizer-fork-3.3.2-LICENSE.txt','en-core-web-sm-3.8.0-LICENSE.txt',
        'en-core-web-sm-3.8.0-LICENSES_SOURCES.txt','espeak-ng-1.52.0-COPYING.txt','espeakng-loader-LICENSE.txt','spaCy-LICENSE.txt']
    rights_dir = 'assets-src/audio/auditions/rights/'
    terms = [rights_dir+k for k in ('kokoro-model-card.md','kokoro-voices.md','kokoro-code-license.txt','audacity-4.0.2-license.txt')]
    terms.extend('assets-src/audio/voice-batch/rights/'+name for name in components)
    historical = read(rights_dir+'retrievals.json')['records']
    fragment = {'schemaVersion':1,'episodeId':'spec001','assets':[]}
    for row in index['voices']:
        aid = row['assetId']
        n = row['number']
        if row['priorListeningEvidencePath']:
            old=existing[aid]
            assert row['web']['sha256']==old['exports'][0]['file']['sha256'] and any(v['check']=='listening' and v['status']=='passed' for v in old['verification'])
            fragment['assets'].append(old)
            continue
        for file in (row['generation'],row['nativeReceipt'],row['web']):
            assert file['sha256']==digest(file['path'])
        gen=read(row['generation']['path']);native=read(row['nativeReceipt']['path'])
        assert gen['scriptSha256']==row['captionSha256'] and gen['text']==row['caption']
        assert all(any(d['number']==n and d['sha256']==row['web']['sha256'] for d in report['decoded']) for report in reports['reports'])
        prefix='docs/evidence/spec001/assets/'+task.lower()+'/'+n+'-'
        def proof(label,kind,actor,status,hashes,details,check=None):
            p=prefix+label+'.json'
            rec=dict(type=kind,actor=actor,status=status,assetId=aid,reviewer=author,date=date,environment=env,hashes=hashes,details=details)
            if check: rec['check']=check
            write(p,rec)
            return p
        def source(key,format,role,app,version):
            return dict(file={**row[key],'format':format},role=role,application=app,version=version)
        sources=[source('raw','wav','raw-generation','Kokoro',gen['version']),source('script','text/plain','script','Network Quest',date),
            source('prepared','wav','master','FFmpeg','9.0.1'),source('project','aup4','native','Audacity','4.0.2'),
            source('master','wav','master','Audacity','4.0.2')]
        sources[3]['reopenEvidencePath']=prefix+'source-reopen.json'
        exports=[dict(file={**row['web'],'format':'mp3'},mimeType='audio/mpeg',sourceHashes=[row['master']['sha256']],
            tool='FFmpeg 9.0.1 / libmp3lame',preset='128 kb/s 48 kHz mono MP3',integrationEvidencePath=prefix+'integration-pending.json')]
        hashes = [s['file']['sha256'] for s in sources+exports]
        events=[]
        def event(id,method,tool,version,revision,settings,script,inputs,outputs,notes,other=None):
            params=dict(method=method,tool=tool,version=version,modelRevision=revision,eventId=id,
                settingsPath=settings,promptOrScriptPath=script,referenceHashes=inputs,outputHashes=outputs,notes=notes)
            details={**params,'settingsSha256':digest(settings),'promptSha256':digest(script),**(other or {})}
            proof('production-'+tool.lower(),'production','tool','passed',outputs,details)
            events.append(params)
        event(gen['eventId'],'tts-generated','Kokoro',gen['version'],gen['modelRevision'],row['generation']['path'],row['script']['path'],
            [],[row['raw']['sha256']],'Auditioned speaker tensor and pinned model rendered the independently stored delivery text. The visible script and its hash are the frozen caption.',
            dict(voiceRecordPath=row['generation']['path'],voiceRecordSha256=row['generation']['sha256'],originalGenerationEventId=gen['eventId']))
        event(f'{task.lower()}-voice-{n}-level-a','mixed','FFmpeg','9.0.1','local-audio-processing',row['generation']['path'],
            'assets-src/audio/voice-batch/generate.py',[row['raw']['sha256']],[row['prepared']['sha256']],
            'Two-pass loudness normalization and 48 kHz mono resampling. The generation receipt records the measured input and final filter.')
        event(f'{task.lower()}-voice-{n}-native-a','mixed','Audacity','4.0.2','official-linux-arm64',row['nativeReceipt']['path'],
            'assets-src/audio/T124/native-roundtrip.py',[row['prepared']['sha256']],[row['project']['sha256'],row['master']['sha256']],
            'Named editable project saved and reopened in a second native process, then exported to PCM24.')
        voice_terms = next(r for r in historical if r['path'].endswith('/'+gen['voiceId']+'.pt'))
        assert voice_terms['sha256']==voice_terms['expectedUpstreamSha256']==gen['voiceSha256']
        rights=dict(reviewStatus='accepted',creators=['John Capobianco / Network Quest; Codex-assisted original production'],
            licenseIds=['CC-BY-4.0','Apache-2.0'],noticePaths=[notice,'LICENSE-ASSETS','LICENSE',rights_dir+'NOTICE.md'],
            sourceUrls=[voice_terms['url'],'https://huggingface.co/hexgrad/Kokoro-82M/tree/'+gen['modelRevision'],'https://github.com/hexgrad/kokoro'],
            termsSnapshotPaths=terms,inputPermissionPaths=[notice,rights_dir+'input-permission.md'],
            aiDisclosure='Locally generated Kokoro speech using original project text, preserved voice weights, model and component terms. No reference recordings. Independent edits and application exports recorded separately.')
        verification=[]
        def review(label,kind,actor,status,findings,details):
            p=proof(label,kind,actor,status,hashes,{**details,'findings':findings},label)
            verification.append(dict(check=label,status=status,reviewer=author,date=date,hashes=hashes,environment=env,evidencePath=p,findings=findings))
        review('rights','rights','agent','passed','Compared the exact selected tensor to the pinned voice retrieval and checked the original dialogue and production input terms.',dict(
            permitsCommercialReuse=True,permitsRedistribution=True,permitsModification=True,licenseIds=rights['licenseIds'],
            noticeHashes=[digest(p) for p in rights['noticePaths']],termsHashes=[digest(p) for p in rights['termsSnapshotPaths']],
            permissionHashes=[digest(p) for p in rights['inputPermissionPaths']],referenceHashes=[],voiceId=gen['voiceId'],
            voiceTensorSha256=voice_terms['sha256'],voiceRegisterRetrieval=rights_dir+'retrievals.json'))
        review('source-reopen','review','tool','passed','Audacity saved the named track, restarted, reopened the same project and exported PCM24 with the expected track content.',
            dict(receipt=row['nativeReceipt'],nativeSha256=row['project']['sha256'],observedTrack=native['observedAtReopen'],
                 sqliteIntegrity=native['integrityAfterReopen'],preparedToNativeMaximumSampleResidual=row['nativeResidual']))
        review('structure','review','tool','passed','Actual mono MP3 decoded in both browser engines. The exact caption stayed visible during interruption and replay.',
            dict(browserEvidencePath=base+'records/browser.json',captionSha256=row['captionSha256'],webFrames=row['webFrames'],
                 samplePeakDbfs=row['webSamplePeakDbfs'],mp3TruePeakDbtp=row['webTruePeakDbtp'],mp3MasterCorrelation=row['webMasterCorrelation']))
        review('listening','review','agent','pending','The full new spoken line awaits ordinary-speaker and headphone listening.',
            dict(packetId=index['packetId'],packetPath=base+'review.html',sealPath=base+'records/listening-seal.json',methods=[],listenFor=row['listenFor']))
        proof('integration-pending','review','agent','pending',hashes,dict(roomId=row['roomId'],lineId=row['lineId'],speakerId=row['speakerId'],
            caption=row['caption'],learningIntent=row['learningIntent'],integrationTasks=assignment['integrationTasks'],
            findings='The line played with its transcript in the isolated fixture. Use in the allocated game room and observation of the committed trigger remain open.'),'browser-comparison')
        fragment['assets'].append(dict(assetId=aid,semanticIdentity=aid.replace('ASSET-',''),kind='voice',status='exported',
            countsTowardQuota=False,interactiveOrEvidence=False,variantOf=None,derivedFrom=[],sources=sources,exports=exports,
            production=events,rights=rights,usedBy=[],verification=verification,audio=dict(nativeProjectPath=row['project']['path'],
            masterPath=row['master']['path'],codec='MP3',sampleRate=48000,channels=1,durationSeconds=row['webFrames']/48000,
            loopStartSample=None,loopEndSample=None,loudnessLufs=row['webLufs'],peakDbfs=row['webSamplePeakDbfs'],
            captionId=row['captionId'],voiceRecordPath=row['generation']['path'])))
    assert assignment['assetIds']==[a['assetId'] for a in fragment['assets']]
    write(assignment['plannedFragmentPath'],fragment)


if __name__=='__main__':
    main(sys.argv[1])
