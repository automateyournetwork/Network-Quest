# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Bind verified native, browser and geometry results to the frozen T111 inventory fragment."""
from pathlib import Path
import hashlib,json

here=Path(__file__).resolve().parent
root=here.parents[2]
raw=root/'docs/evidence/spec001/prop-production/T111'
typed=root/'docs/evidence/spec001/assets/t111'
def load(p):return json.loads(p.read_text())
def save(p,obj):p.write_text(json.dumps(obj,indent=2)+'\n')
def path(p):return p.relative_to(root).as_posix()
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def file_info(p):return {'path':path(p),'format':p.suffix[1:],'sha256':sha(p),'bytes':p.stat().st_size}
def files(paths):return {path(p):sha(p) for p in paths}
reviewer='/root/loop128_t111';date='2026-11-27'
env='Mac16,7 arm64; Blender 5.2.1 LTS 9e2066aef7ef; strict local HTTPS, Firefox 159.0, Node 26.13.1, Three.js 0.187.0.'
# The other eighteen native files still carry their original production revision.
baseline_settings=here/'production-settings.json'
metre_settings=here/'production-settings-metres.json'
settings_revision=load(baseline_settings)
settings_revision['modelingInputs']=files(here/x for x in ['workshop.py','copper.py','echo.py','build.py'])
settings_revision['supersedesCommit']='a1c766ce57f98fa7865ad4b8dd934780cf02efe1'
settings_revision['revisedAssets']=['PR024','PR030']
settings_revision['engraving']='The stock and route-length plates retain an original lowercase m with two shoulders, shorter than the neighboring digits.'
save(metre_settings,settings_revision)
allocation=next(b for b in load(root/'assets-src/production-allocation.json')['batches'] if b['task']=='T111')
assert path(here/'manifest.json')==allocation['plannedFragmentPath']
layout=load(root/'assets-src/rooms/scene-layouts.json')
placements={p['semanticId'].split(':')[-1]:p for room in layout['rooms'][2:4] for p in room['propPlacements']}
intent={p['propId'].split(':')[-1]:p['description'] for n in [3,4] for p in load(root/f'content/spec001/rooms/R0{n}.json')['propInstances']}
findings=load(here/'review-findings.json')
metrics=load(raw/'projection-comparison.json');decoded=load(raw/'glb-structure.json')
assets=[]
for aid in allocation['assetIds']:
    id=aid.split('-')[-1];n=int(id[2:]); report=load(raw/f'{id}-native.json');browser=load(raw/f'{id}-browser.json')
    src=here/f'{id}.blend';glb=root/f'public/assets/models/R03-R04/{id}.glb'
    hashes=[sha(src),sha(glb)];assert hashes==[report['sourceSha256'],report['glbSha256']]
    assert hashes[0]==metrics[id]['comparedSourceSha256'] and hashes[1]==browser['glbSha256']==metrics[id]['comparedGLBSha256']==decoded[id]['glbSha256']
    assert metrics[id]['silhouetteIoU']>.97 and browser['errors']==[] and browser['strictTLS']
    placement=placements[id]
    script=here/('copper.py' if n<31 else 'echo.py')
    revised=id in {'PR024','PR030'}
    settings=metre_settings if revised else baseline_settings
    event_suffix='-metres' if revised else ''
    event={'method':'modeled','tool':'Blender','version':report['blender'],'modelRevision':report['build'],'eventId':f'T111-{id}-20261127{event_suffix}',
           'settingsPath':path(settings),'promptOrScriptPath':path(script),'referenceHashes':[],'outputHashes':[hashes[0]],
           'notes':'Original geometry and geometric lettering authored for this roster entry. Project visual guides informed modeling without imported image pixels. The settings bind the consulted guides and shared construction script.'}
    checks=[]
    def record(name,kind,actor,details,check=None):
        output=typed/f'{id}-{name}.json'
        r={'type':kind,'assetId':aid,'hashes':hashes,'status':'passed','actor':actor,'reviewer':reviewer,'date':date,'environment':env,'details':details}
        if check:r['check']=check
        save(output,r);return path(output)
    record('production','production','tool',{**event,'settingsSha256':sha(settings),'promptSha256':sha(script),'plannedPurpose':intent[id],
                                              'frozenCandidate':placement['instanceId'],'frozenHotspotIds':placement['hotspotIds'],
                                              'futureInteractiveCandidate':placement['interactiveCandidate'],'futureRoomJoin':'T136'})
    def add_check(name,actor,message,details,kind='review'):
        ep=record(name,kind,actor,{'findings':message,**details},name)
        checks.append({'check':name,'status':'passed','reviewer':reviewer,'date':date,'hashes':hashes,'environment':env,'evidencePath':ep,'findings':message})
        return ep
    native_path=add_check('source-reopen','tool','Fresh Blender process opened the saved native at its ground root. Measured named meshes and material factors, rendered the source, and exported the selected static model.',
                          {'methods':['native-source-reopen'],'tool':'Blender 5.2.1 LTS','observedPaths':[path(src),path(raw/f'{id}-source.png')],
                           'report':path(raw/f'{id}-native.json'),'reportSha256':sha(raw/f'{id}-native.json')})
    add_check('structure','tool','Decoded embedded GLB positions and triangle indices. The export fits the native bounds after the Y-up axis conversion and fits the frozen candidate envelope.',
              {'methods':['binary-inspection','native-browser-decode'],'tool':'Python struct, Firefox 159.0, Three.js 0.187.0',
               'observedPaths':[path(src),path(glb)],'binaryReport':path(raw/'glb-structure.json'),'measurement':decoded[id]})
    sheet=raw/f'PR{21+(n-21)//5*5:03}-PR{25+(n-21)//5*5:03}.jpg'
    observed=[path(src),path(glb),path(raw/f'{id}-source.png'),path(raw/f'{id}-browser.png'),path(sheet)]
    add_check('visual','agent',findings[id],{'methods':['image-inspection'],'tool':'Native Blender Cycles and Firefox/Three.js contact-sheet inspection',
                                              'observedPaths':observed,'comparisonSheetSha256':sha(sheet)})
    web_path=add_check('browser-comparison','agent',findings[id]+' The two studio lighting rigs yield different highlight intensity.',
                       {'methods':['browser-inspection','image-inspection'],'tool':'Firefox 159.0, Three.js GLTFLoader r187; Blender 5.2.1 LTS native reference',
                        'observedPaths':observed,'browserMeasurement':path(raw/f'{id}-browser.json'),'browserRenderSha256':browser['browserRenderSha256'],
                        'nativeRenderSha256':report['sourceRenderSha256'],'projection':metrics[id]})
    rights={'reviewStatus':'pending','creators':['John Capobianco and Network Quest contributors','OpenAI Codex (assisted original Blender modeling code)'],
            'licenseIds':['CC-BY-4.0'],'noticePaths':['NOTICE',path(here/'NOTICE.md')],'sourceUrls':[],'termsSnapshotPaths':['LICENSE-ASSETS'],'inputPermissionPaths':[path(here/'NOTICE.md')],
            'aiDisclosure':'Agent-assisted original Blender code constructed the meshes, materials and geometric lettering. All creative references are internal design guides. Owner release review remains pending.'}
    add_check('rights','agent','The source and export contain original geometry and material factors. Credit, modification, redistribution and commercial use terms are recorded under the project CC BY 4.0 license.',
              {'methods':['model-input-review','license-inspection'],'tool':'Repository input/license review','licenseIds':rights['licenseIds'],
               'noticeHashes':[sha(root/p) for p in rights['noticePaths']],'termsHashes':[sha(root/'LICENSE-ASSETS')],
               'permissionHashes':[sha(here/'NOTICE.md')],'referenceHashes':[],'permitsModification':True,'permitsCommercialReuse':True,'permitsRedistribution':True,
               'observedPaths':[path(src),path(glb),path(here/'NOTICE.md'),'LICENSE-ASSETS','NOTICE']},'rights')
    assets.append({'assetId':aid,'semanticIdentity':'spec001:'+id,'kind':'prop-model','status':'exported','countsTowardQuota':False,'interactiveOrEvidence':False,
                   'variantOf':None,'derivedFrom':[],'sources':[{'file':file_info(src),'role':'native','application':'Blender','version':report['blender'],'reopenEvidencePath':native_path}],
                   'exports':[{'file':file_info(glb),'mimeType':'model/gltf-binary','sourceHashes':[hashes[0]],'tool':'Blender glTF exporter',
                               'preset':'Y-up GLB, static identity root, joined geometry, embedded PBR materials, no lights/cameras/images.','integrationEvidencePath':web_path}],
                   'production':[event],'rights':rights,'usedBy':[],'verification':checks,'model':{'blendSourcePath':path(src),'objectIds':sorted(report['editableMeshes']),
                   'units':'metres','axes':'Z-up/-Y to Y-up/+Z (x,z,-y)','pivot':'Identity centre of footprint on native and exported support plane.',
                   'collisionProxy':'Presentation only. Room navigation owns walk regions and hotspot reach.','animationClips':[],'triangles':report['triangles'],'textureBytes':0}})
save(here/'manifest.json',{'schemaVersion':1,'episodeId':'spec001','assets':assets})
