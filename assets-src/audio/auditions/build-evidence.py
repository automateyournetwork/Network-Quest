# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Materialize this actual sealed audition's records; never fabricates listening."""
from pathlib import Path
import json,hashlib,copy
P=Path(__file__).resolve().parent;ROOT=P.parents[2]
D=ROOT/'docs/evidence/spec001/assets';D.mkdir(exist_ok=True)
rel=lambda p:str(p.relative_to(ROOT))
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
def load(name):return json.loads((P/name).read_text())
def write(p,r):p.write_text(json.dumps(r,indent=2,ensure_ascii=False)+'\n')
rows=load('provenance/candidate-index.json');signals={r['slug']:r for r in load('provenance/signal-checks.json')['records']}
voices={r['slug']:r for r in load('provenance/voice-run.json')['records']}
base={r['assetId']:r for r in json.loads((ROOT/'assets-src/manifest.json').read_text())['assets']}
seal=load('provenance/review-packet-seal.json');bank=P/'projects/audition-bank.aup4'
env='macOS26.6.2 arm64 / Mac16,7; local Kokoro0.9.4, ACE-Step1.5.0, FFmpeg9.0.1 and native Audacity4.0.2'
human_env='User-reported listening: built-in Mac speakers and earbuds/headphones; brand/model and playback volume not provided.'
quotes=['it all sounds good to me yes','built in mac speakers','headphones were good too earbuds']
summary={'date':'2026-11-26','reviewer':'John Capobianco (owner)','packetId':seal['packetId'],'packetSealSha256':sha(P/'provenance/review-packet-seal.json'),'source':'Actual owner messages delivered by coordinator /root in this conversation','exactQuotesInOrder':quotes,'methods':['ordinary-speakers','headphones'],'equipment':{'ordinary-speakers':'built-in Mac speakers','headphones':'earbuds; brand/model not supplied'},'decision':'Accept all twelve frozen audition candidates; four cast voice candidates selected for subsequent scoped work.','scope':'Audio quality acceptance of sealed MP3 previews. Not G3, full loops, in-game mix, final library, source-project listening or release acceptance.','nativeLineage':'Native bank preserves the prepared candidate signals. Its creation and export occurred separately; owner is not claimed to have opened Audacity or listened to a combined bank.'}
write(P/'provenance/owner-listening.json',summary)
assets=[]
for row in rows:
 slug=row['slug'];a=copy.deepcopy(base[row['assetId']]);s=signals[slug];kind=row['kind']
 def evidence(suffix,type,hashes,details,check=None,actor='tool',reviewer='Codex loop070/T065',environment=env,status='passed'):
  p=D/f't065-{slug}-{suffix}.json';r={'type':type,'assetId':a['assetId'],'hashes':list(dict.fromkeys(hashes)),'status':status,'actor':actor,'reviewer':reviewer,'date':'2026-11-26','environment':environment,'details':details}
  if check:r['check']=check
  write(p,r);return rel(p),r
 def source(path,role,app,version,format):
  f=ROOT/path if isinstance(path,str) else path
  return {'file':{'path':rel(f),'sha256':sha(f),'bytes':f.stat().st_size,'format':format},'role':role,'application':app,'version':version}
 raw=ROOT/row['rawPath'];mix=P/'mix-inputs'/f'{slug}.wav';master=P/'masters'/f'{slug}.wav';web=ROOT/'public/assets/audio/auditions'/f'{slug}.mp3'
 if kind=='voice':
  v=voices[slug];script=ROOT/v['scriptPath'];settings=P/'provenance/voice-requests.json';method='tts-generated';tool='Kokoro';version='0.9.4';revision=load('provenance/voice-run.json')['revision'];event=v['eventId'];terms=['rights/kokoro-model-card.md','rights/kokoro-voices.md','rights/kokoro-code-license.txt'];licenses=['CC-BY-4.0','Apache-2.0'];urls=['https://huggingface.co/hexgrad/Kokoro-82M/tree/'+revision,'https://github.com/hexgrad/kokoro'];caption=v['canonical']['captionId']
 elif kind=='music':
  script=P/'provenance/ace-request.json';settings=script;method='music-generated';tool='ACE-Step';version='1.5.0';revision='19671f406d603126926c1b7e2adc169acbcade22';event='t065-title-ace-20261126-a';terms=['rights/ace-model-card.md','rights/ace-license.txt'];licenses=['CC-BY-4.0','MIT'];urls=['https://huggingface.co/ACE-Step/Ace-Step1.5/tree/'+revision,'https://github.com/ace-step/ACE-Step-1.5/tree/ca1e85fe9430179831e6bc6be790c332190a3866'];caption=None
 else:
  script=P/'synthesize-effects.py';settings=P/'provenance/effects-run.json';method='synthesized';tool='NumPy/SoundFile';version=load('provenance/effects-run.json')['numpyVersion']+' / '+load('provenance/effects-run.json')['soundfileVersion'];revision='not-applicable-original-synthesis';event=f't065-{slug}-synthesis-20261126-a';terms=['rights/NOTICE.md'];licenses=['CC-BY-4.0','Apache-2.0'];urls=[];caption=None
 a['status']='exported';a['countsTowardQuota']=False;a['usedBy']=[]
 a['sources']=[source(raw,'raw-generation' if kind!='effect' else 'archive',tool,version,'WAV FLOAT'),source(script,'script' if kind!='music' else 'prompt','Original Network Quest','2026-11-26','text/plain' if script.suffix=='.txt' else 'json' if script.suffix=='.json' else 'python'),source(mix,'master','FFmpeg','9.0.1','WAV FLOAT'),source(bank,'native','Audacity','4.0.2','aup4'),source(master,'master','Audacity','4.0.2','WAV PCM24')]
 a['exports']=[{'file':{'path':rel(web),'sha256':sha(web),'bytes':web.stat().st_size,'format':'MP3'},'mimeType':'audio/mpeg','sourceHashes':[sha(mix)],'tool':'FFmpeg9.0.1/libmp3lame','preset':'192kbps stereo' if kind=='music' else '128kbps mono','integrationEvidencePath':''}]
 a['production']=[]
 stages=[dict(method=method,tool=tool,version=version,modelRevision=revision,eventId=event,settingsPath=rel(settings),promptOrScriptPath=rel(script),referenceHashes=[],outputHashes=[sha(raw)],notes='Actual local production; original project input, no reference audio or impersonation.'),dict(method='mixed',tool='FFmpeg',version='9.0.1',modelRevision='not-applicable-local-audio-processing',eventId=f't065-{slug}-mix-preparation-20261126-a',settingsPath=rel(P/'provenance/mix-preparation.json'),promptOrScriptPath=rel(P/'prepare-mix.py'),referenceHashes=[sha(raw)],outputHashes=[sha(mix)],notes='Exact two-pass level normalization/resampling; title also has0.2s/0.8s fades. Frozen MP3 derives from this actual prepared input.'),dict(method='mixed',tool='Audacity',version='4.0.2',modelRevision='not-applicable-native-editor',eventId='t065-native-bank-roundtrip-20261126-a',settingsPath=rel(P/'provenance/native-roundtrip.json'),promptOrScriptPath=rel(P/'native-bank.py'),referenceHashes=[sha(mix)],outputHashes=[sha(bank),sha(master)],notes='One shared actual twelve-track native bank event, with this asset track; separate-track fresh-session export, no combined mix. All twelve input hashes in settings. Sample comparison preserved.')]
 for n,p in enumerate(stages):
  a['production'].append(p);evidence('production-'+str(n+1),'production',p['outputHashes'],{**p,'settingsSha256':sha(ROOT/p['settingsPath']),'promptSha256':sha(ROOT/p['promptOrScriptPath']),'actualRunRecordPath':rel(P/('provenance/voice-run.json' if kind=='voice' else 'provenance/ace-run.json' if kind=='music' else 'provenance/effects-run.json'))})
 a['rights']={'reviewStatus':'accepted','creators':['John Capobianco / Network Quest; Codex-assisted original production'],'licenseIds':licenses,'noticePaths':[rel(P/'rights/NOTICE.md'),rel(P/'rights/CC-BY-4.0.txt'),'LICENSE'],'sourceUrls':urls,'termsSnapshotPaths':[rel(P/x) for x in terms],'inputPermissionPaths':[rel(P/'rights/input-permission.md')],'aiDisclosure':'Actual local '+method+'; original project text/direction and inputs. Publisher model/training representations retained; no exclusive copyright or individual speaker-consent claim. Native bank and edits are separately identified.'}
 allhash=[x['file']['sha256'] for x in a['sources']+a['exports']]
 checks=[]
 def check(suffix,kind,details,actor='tool',reviewer='Codex loop070/T065',environment=env):
  path,r=evidence(suffix,'rights' if kind=='rights' else 'review',allhash,details,kind,actor,reviewer,environment)
  checks.append({'check':kind,'status':'passed','reviewer':reviewer,'date':'2026-11-26','hashes':list(dict.fromkeys(allhash)),'environment':environment,'evidencePath':path,'findings':details['findings']});return path
 right=a['rights']
 check('rights','rights',{'permitsCommercialReuse':True,'permitsRedistribution':True,'permitsModification':True,'licenseIds':licenses,'noticeHashes':[sha(ROOT/x) for x in right['noticePaths']],'termsHashes':[sha(ROOT/x) for x in right['termsSnapshotPaths']],'permissionHashes':[sha(ROOT/x) for x in right['inputPermissionPaths']],'referenceHashes':[],'findings':'Inspected primary model/code/voice terms and original-input basis permit the scoped reuse; preserve publisher representations, attribution and voice-rights/copyright limitations in NOTICE.md.'},actor='agent')
 reopen=check('source-reopen','source-reopen',{'nativeProjectPath':rel(bank),'nativeProjectSha256':sha(bank),'freshProcess':True,'track':slug,'trackCount':12,'sqliteIntegrity':'ok','sourceUnchangedAfterRoundtrip':True,'roundtripRecordPath':rel(P/'provenance/native-roundtrip.json'),'sampleComparison':s['roundtrip'],'findings':'Actual native Audacity4.0.2 save/close/fresh-process reopen/export. This exact track retained; decoded master samples match the correct prepared candidate within2e-6 and at most one trailing sample difference.'})
 a['sources'][3]['reopenEvidencePath']=reopen
 check('structure','structure',{'signalRecordPath':rel(P/'provenance/signal-checks.json'),'findings':'Raw/prepared/native master/web all decode finite, nonzero and below full scale. Native master48kPCM24, intended channel count; exact frozen preview hash preserved. File checks are not listening.'})
 check('listening','listening',{**summary,'listenedPaths':[rel(web)],'frozenWebSha256':sha(web),'sourceAndMasterHashesBindLineageOnly':True,'findings':'Owner accepted all12 sealed candidates, then confirmed built-inMacspeakers andearbuds/headphones. No per-item defect was reported. These exact MP3bytes remain unchanged; native source/master lineage checks are separate.'},actor='human',reviewer=summary['reviewer'],environment=human_env)
 # Browser codec evidence is distinct from scene integration/visual comparison.
 evidence('browser-decode','review',[sha(web)],{'browserRecordPath':rel(P/'provenance/browser-decode.json'),'methods':['WebAudio decodeAudioData','HTMLMediaElement loadedmetadata'],'findings':'Firefox159 strict trusted localHTTPS fetched exact sealed MP3bytes and decoded them. No Safari/Chrome or in-game lifecycle acceptance.'},'browser-decode')
 integrationPath,_=evidence('integration-pending','review',[sha(web)],{'findings':'Audition export only; final in-game binding, native-browser lifecycle/skip/replay and G3 benchmark acceptance belong to subsequent tasks.'},'browser-comparison',actor='agent',status='pending')
 a['exports'][0]['integrationEvidencePath']=integrationPath
 a['verification']=checks
 a['audio']={'nativeProjectPath':rel(bank),'masterPath':rel(master),'codec':'MP3','sampleRate':s['files']['web']['sampleRate'],'channels':s['files']['web']['channels'],'durationSeconds':s['files']['web']['durationSeconds'],'loopStartSample':None,'loopEndSample':None,'loudnessLufs':s['webLoudness']['integratedLufs'],'peakDbfs':s['files']['web']['peakDbfs'],'captionId':caption}
 if kind=='voice':a['audio']['voiceRecordPath']=rel(P/'provenance/voice-run.json')
 assets.append(a)
write(P/'manifest-candidates.json',{'schemaVersion':1,'episodeId':'spec001','assets':assets})
print('12 exported nonquota candidates; actual production/rights/native/listening records written.')
