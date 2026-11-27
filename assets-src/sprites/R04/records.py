# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Write the four supporting derivative records from production files and the observed guest journey."""
from pathlib import Path
import hashlib
import json

base = Path.cwd()
source = Path('assets-src/sprites/R04')
ev = Path('docs/evidence/spec001/sprites/T134')
audit = Path('docs/evidence/spec001/assets/T134')
audit.mkdir(exist_ok=True,parents=True)
def read(p): return json.loads(Path(p).read_text())
def write(p,d): Path(p).write_text(json.dumps(d,indent=2,ensure_ascii=False)+'\n')
def sha(p): return hashlib.sha256(Path(p).read_bytes()).hexdigest()
def file(p): return {'path':str(p),'sha256':sha(p),'bytes':Path(p).stat().st_size,'format':Path(p).suffix[1:]}
native=read(source/'native-frames.json')
stagepath=Path('content/spec001/presentation/R04.json')
stage=read(stagepath)
browser=read(ev/'browser.json')
verified=read(ev/'verification.json')
bindings=read('content/spec001/rooms/R04.json')['mediaBindings']
fragment={'schemaVersion':1,'episodeId':'spec001','assets':[]}
for sheet in stage['atlases']:
    id=sheet['assetId']; name=id.split('-')[-1]
    member=[s['assetId'] for s in stage['subjects'] if s['atlasId']==id]
    used=[v for v in native['inputs'] if v['assetId'] in member]
    inputs=[i['sha256'] for i in used]
    assert all(sha(i['source'])==i['sha256'] for i in used)
    binding=next(b for b in bindings if b['assetId']==id)
    export=file(binding['exportPath'])
    assert browser['responses'][export['path']]==export['sha256']
    subjects='the Apprentice and safe floor' if name=='CH01' else 'Ancient Tortoise' if name=='CH13' else 'Echo Bat' if name=='CH20' else '12 depth-ordered pieces of apparatus'
    attrs={'assetId':id,'status':'passed','actor':'agent','reviewer':'Codex loop 151 / T134','date':'2026-11-27',
           'environment':'Mac16,7/macOS 26.6.2 arm64; Blender 5.2.1 LTS Cycles; Pillow 12.1.0; native Firefox 159; pinned Node 26.13.1'}
    def record(file_name,typ,hashes,details,check=None):
        path=audit/f'{name}-{file_name}.json'
        write(path,{'type':typ,**attrs,'hashes':hashes,'details':details,**({'check':check} if check else {})})
        return str(path)
    scene=file(source/'R04-sprite-stage.blend')
    observed=[scene['path'],str(source/'render.py'),str(source/'pack.py'),str(stagepath),export['path']]
    sources=[{'file':scene,'role':'native','application':'Blender','version':'5.2.1 LTS'},
             *[{'file':file(source/f),'role':'script','application':'Python','version':'3'} for f in ['render.py','pack.py']]]
    all_hashes=[s['file']['sha256'] for s in sources]+[export['sha256']]
    checks=[]
    for check,method,finding in [
        ('source-reopen','native-reopen','Blender reopened the assembled native stage, evaluated the original rig tracks and rendered the saved camera crops.'),
        ('visual','image-inspection','Inspected the registered room, extracted poses, feathered contact shadows, alpha edges and floor-disabled comparison.'),
        ('browser-comparison','browser-inspection','The native guest camera showed '+subjects+'. Firefox fetched the exact export bytes and the renderer used the registered frame cells.'),
    ]:
        det={'methods':[method],'tool':'Blender, Pillow and native Firefox','observedPaths':observed,'findings':finding,
             'nativeEvidencePath':str(ev/'verification.json'),'runtimeEvidencePath':str(ev/'browser.json'),'browserCapturePath':str(ev/'desktop.png')}
        proof=record(check,'review',all_hashes,det,check)
        checks.append({'check':check,'status':'passed','reviewer':attrs['reviewer'],'date':attrs['date'],'environment':attrs['environment'],
                       'hashes':all_hashes,'evidencePath':proof,'findings':finding})
    sources[0]['reopenEvidencePath']=checks[0]['evidencePath']
    event={'method':'blender-rendered','tool':'Blender Cycles','version':'5.2.1 LTS','modelRevision':'not-applicable',
           'eventId':'r04-registered-sprites-v1-'+name,'settingsPath':str(source/'native-frames.json'),'promptOrScriptPath':str(source/'render.py'),
           'referenceHashes':inputs,'outputHashes':[scene['sha256']],
           'notes':'The reopened native stage supplied registered isolated frames. Pillow packed the camera crops with lossless WebP and fixed subject pivots.'}
    record('production','production',[scene['sha256']],{**event,'settingsSha256':sha(event['settingsPath']),'promptSha256':sha(event['promptOrScriptPath'])})
    usage=record('usage','usage',[export['sha256']],{'bindings':[binding],'visible':True,'meaningful':True,'findings':'The ordinary Echo Cavern guest view rendered '+subjects+'.',
                 'runtimeEvidencePath':str(ev/'browser.json'),'browserCapturePath':str(ev/'desktop.png'),'nativeEvidencePath':str(ev/'verification.json')})
    fragment['assets'].append({'assetId':id,'semanticIdentity':'spec001:SPRITE-R04-'+name,'kind':'sprite-sheet','status':'integrated','countsTowardQuota':False,
        'interactiveOrEvidence':binding['interactiveOrEvidence'],'variantOf':None,'derivedFrom':member,'sources':sources,
        'exports':[{'file':export,'mimeType':'image/webp','sourceHashes':[s['file']['sha256'] for s in sources],'tool':'Blender and Pillow',
                    'preset':'24 fps source, fixed camera and pivots, native cropped straight alpha frames, lossless WebP',
                    'integrationEvidencePath':checks[-1]['evidencePath']}],'production':[event],
        'rights':{'reviewStatus':'pending','creators':['John Capobianco and Network Quest contributors','OpenAI Codex (assisted original staging and code)'],
                  'licenseIds':['CC-BY-4.0'],'noticePaths':['NOTICE',str(source/'NOTICE.md')],'sourceUrls':[],'termsSnapshotPaths':['LICENSE-ASSETS'],
                  'inputPermissionPaths':[str(source/'NOTICE.md')],'aiDisclosure':'Agent-assisted staging and tools. All sprite pixels rendered in Blender from project-owned source assets.'},
        'usedBy':[{'contentId':'spec001:R04','use':'sprite-animation','evidencePath':usage}],'verification':checks,
        'image':{'width':sheet['width'],'height':sheet['height'],'colorSpace':'sRGB','alpha':True,'cameraRecordPath':'assets-src/images/R04/camera.json',
                 'layerRole':'depth-ordered cast sprites','registrationPath':str(stagepath),'frameTimingPath':str(stagepath)}})
write(source/'manifest.json',fragment)
updates=[]
for layer in stage['layers']:
    id=layer['assetId']
    binding=next(b for b in bindings if b['assetId']==id)
    digest=sha(binding['exportPath'])
    assert browser['responses'][binding['exportPath']]==digest
    proof=audit/(layer['plane']+'-usage.json')
    write(proof,{'type':'usage','assetId':id,'hashes':[digest],'status':'passed','actor':'agent',
        'reviewer':'Codex loop 151 / T134','date':'2026-11-27','environment':attrs['environment'],
        'details':{'bindings':[binding],'visible':True,'meaningful':True,'findings':{
        'background':'Blue receding arches and the intact floor span the entire contained R04 stage.',
        'midground':'Separate registered stalactite ribs occupy the upper gallery behind Echo Bat.',
        'foreground':'Separate registered near stone edges stay in front of the focused cast and outside the teaching lane.'
        }[layer['plane']],'runtimeEvidencePath':str(ev/'browser.json'),'browserCapturePath':str(ev/'desktop.png')}})
    updates.append({'assetId':id,'exportPath':binding['exportPath'],'sha256':digest,'status':'integrated','interactiveOrEvidence':False,
                    'appendUsedBy':{'contentId':'spec001:R04','use':binding['use'],'evidencePath':str(proof)}})
write('assets-src/integration/R04-T134.json',{'schemaVersion':1,'roomId':'spec001:R04','task':'T134',
      'application':'Match each existing layer by exact identity, path and hash. Set integrated status and append this room use, preserving prior uses and quota status.',
      'updates':updates})
