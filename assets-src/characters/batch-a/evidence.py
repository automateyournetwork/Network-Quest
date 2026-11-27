# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Write the scoped batch fragment from verified files and the identified agent visual review."""
import hashlib
import json
from pathlib import Path

root=Path(__file__).resolve().parents[3]
scripts=Path(__file__).resolve().parent
raw=root/'docs/evidence/spec001/character-production/T107'
proof=root/'docs/evidence/spec001/assets/t107'
def path(p): return str(p.relative_to(root))
def read(p): return json.loads(p.read_text())
def write(p,obj): p.write_text(json.dumps(obj,indent=2)+'\n')
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def assetfile(p): return {'path':path(p),'sha256':sha(p),'bytes':p.stat().st_size,'format':p.suffix[1:]}
reviewer='/root/loop124_t107'
date='2026-11-27'
environment='Mac16,7 arm64; Blender 5.2.1 LTS 9e2066aef7ef; Node 26.13.1; Three.js 0.187.0; native headless Firefox with isolated trusted TLS.'
ids=['CH02','CH04','CH05','CH06','CH07','CH08','CH09']
author={'CH02':'workshop.py','CH04':'workshop.py','CH05':'optics.py','CH06':'optics.py','CH07':'skywell.py','CH08':'skywell.py','CH09':'clockworks.py'}
observed={
    'CH02':'The helmet lamp, braided stone beard, thick apron and handled mug separate at both sizes. The reaction brings the mug forward while the head dips and both boots stay planted.',
    'CH04':'The tapered banded coil and paired contact probes read against the dark background. The ability lowers the head and swings the two distinct probe tips outside the jaw contour.',
    'CH05':'The horn is single and tapered, with a spiralled inlay. The teal ledger remains attached to the flank through the downward inspection gesture. The reduced exposure retains the chest and pale mane edges.',
    'CH06':'Three necks share one belly and one gauge. The middle reader wears spectacles. The revised inward turn keeps three faces visible in the ability sample. Heads and material bands are present in the web export.',
    'CH07':'The layered fan of tapered primary feathers has a distinct stepped outer silhouette on both wings. The warm monocular and hooked beak turn together in the observation gesture.',
    'CH08':'A squat seated dragon displays a cream receipt, framed by scalloped membrane wings. The near arm turns the receipt and the second forearm rests on the belly. The curled tail and two horns stay distinct.',
    'CH09':'Both pincers remain visible in the elevated front view. Four walking-leg pairs fan out from the segmented body and the curved lamp-tipped tail rocks without translating the floor pivot.'
}
staging=read(raw/'staging.json')
metrics=read(raw/'projection-comparison.json')
settings=scripts/'production-settings.json'
write(settings,{'task':'T107','loop':124,'game':'Network Quest, Spec001','method':'Original editable parametric meshes in native Blender; separate rigid joints with named NLA tracks.',
                'modelInputs':{p.name:sha(p) for p in (scripts/file for file in ['build.py','model.py','workshop.py','optics.py','skywell.py','clockworks.py'])},
                'units':'One scene metre per Blender unit, native Z-up to GLB Y-up, floor root at zero. Height and optical horizontal fit baked into the source hierarchy.',
                'clips':'24 fps. Each joint has only its authored location or Euler channels. Track names bind related joint actions into one exported idle, reaction or ability.',
                'export':'Binary GLB, selected character hierarchy; no camera, lights, textures or external references. Merge only rigid surfaces belonging to the same movable joint in memory after the native renders.',
                'nativeStudio':'Orthographic, Standard sRGB, no look, exposure -0.50, transparent background, Cycles six samples with denoise, three CPU threads. Each native inspection records camera projection.',
                'browserStudio':'Native Firefox, pinned Three.js GLTFLoader and WebGLRenderer, sRGB output, NoToneMapping, hemisphere plus warm key, cool fill and pearl rim. The two lighting models differ; linear PBR parity and projected silhouettes are checked directly.',
                'styleReferences':['assets-src/art-direction.md','docs/evidence/spec001/assets/t063-CH01-source.png','docs/evidence/spec001/assets/t063-CH03-source.png',
                                   'docs/evidence/spec001/presentation/t067/frame-revision/firefox-2026-11-26T22-13-57-156Z/1280x720-pair0-warm-room.png'],
                'externalMediaInputs':[]})
assets=[]
for asset in ids:
    native=read(raw/f'{asset}-native.json'); imported=read(raw/f'{asset}-import.json'); browser=read(raw/f'{asset}-browser.json')
    source=root/native['source']; export=root/native['export']; hashes=[sha(source),sha(export)]
    assert hashes==[native['sourceSha256'],native['exportSha256']] and browser['exportSha256']==hashes[1] and imported['glbSha256']==hashes[1]
    id_='spec001:ASSET-'+asset
    def evidence(name,recordtype,status,actor,details,check=None,bind=None):
        p=proof/f'{asset}-{name}.json'
        rec={'type':recordtype,'assetId':id_,'status':status,'actor':actor,'reviewer':reviewer,'date':date,'environment':environment,
             'hashes':bind or hashes,'details':details}
        if check: rec['check']=check
        write(p,rec)
        return path(p)
    script=scripts/author[asset]
    production={'method':'modeled','tool':'Blender','version':native['blender'],'modelRevision':native['build'],'eventId':'T107-original-'+asset+'-20261127',
                'settingsPath':path(settings),'promptOrScriptPath':path(script),'referenceHashes':[],'outputHashes':[hashes[0]],
                'notes':'Original modeled character using own editable geometry and authored joint animation. Roster, art direction and project benchmark images were consulted. No external mesh, texture or reference pixels were imported.'}
    planned=[c for c in staging['plannedResidentPlacements'] if c['asset']==asset]
    evidence('production','production','passed','tool',{**production,'settingsSha256':sha(settings),'promptSha256':sha(script),'sharedConstructorsSha256':sha(scripts/'model.py'),
                'intendedUses':planned,'runtimeUseStatus':'Planned placements only. Fresh finished-room binding and human review remain outstanding.'},bind=[hashes[0]])
    rights={'reviewStatus':'pending','creators':['John Capobianco (project owner)','OpenAI Codex (assisted original Blender modeling and animation code)'],'licenseIds':['CC-BY-4.0'],
            'noticePaths':['NOTICE',path(scripts/'NOTICE.md')],'sourceUrls':[],'termsSnapshotPaths':[],'inputPermissionPaths':[],
            'aiDisclosure':'Original project geometry/materials modeled in Blender using agent-authored code. No imported third-party creative inputs. Commissioned character portraits are separate assets. CC BY 4.0 to the extent controlled by the project; formal owner review pending.'}
    evidence('rights','rights','pending','agent',{'findings':'Original geometry. Project notice and CC BY 4.0 source terms are linked. Owner acceptance remains pending.',
            'licenseIds':rights['licenseIds'],'repositoryLicense':{'path':'LICENSE-ASSETS','sha256':sha(root/'LICENSE-ASSETS')},'noticeHashes':[sha(root/n) for n in rights['noticePaths']],'termsHashes':[],'permissionHashes':[],'referenceHashes':[],
            'permitsCommercialReuse':True,'permitsModification':True,'permitsRedistribution':True},'rights')
    checks=[]
    def check(name,actor,findings,methods,extra):
        details={'findings':findings,'methods':methods,'observedPaths':[path(source),path(export)],'tool':'Blender 5.2.1, Firefox '+browser['browser']+', Three.js 0.187.0 and agent visual inspection',**extra}
        ep=evidence(name,'review','passed',actor,details,name)
        checks.append({'check':name,'status':'passed','reviewer':reviewer,'date':date,'hashes':hashes,'environment':environment,'evidencePath':ep,'findings':findings})
        return ep
    re=check('source-reopen','tool','Fresh native Blender process reopened the saved file, rendered rest and active NLA tracks, and exported the selected model hierarchy. Native render graph and hashes were read from this revision.',
             ['native-source-reopen'],{'report':path(raw/f'{asset}-native.json'),'reopenedSourceCapture':path(proof/f'{asset}-source.png')})
    check('structure','tool','GLB reimported into a clean scene. Source and export triangle counts agree. Embedded binary and all moving samplers, loop seams, numeric ranges and stationary floor root passed.',
          ['native-glb-reimport','binary-inspection'],{'report':path(raw/f'{asset}-import.json')})
    check('visual','agent',observed[asset],['image-inspection'],{'comparedPoseSheet':path(proof/f'{asset}-poses.png'),'silhouettes':metrics[asset]})
    web=check('browser-comparison','agent','Compared actual native Firefox renders against reopened Blender panels at rest and the authored clip samples. Materials match in scene-linear space, silhouette masks align, and joint matrices agree at five fractions of every clip.',
              ['browser-inspection','image-inspection'],{'capture':path(proof/f'{asset}-browser.png'),'poseSheet':path(proof/f'{asset}-poses.png'),'report':path(raw/f'{asset}-browser.json'),
                                                       'purpose':'Isolated inspection; no finished-room usage assertion.'})
    clips=[n for n in ('idle','reaction','ability') if n in native['clips']]
    assets.append({'assetId':id_,'semanticIdentity':'spec001:'+asset,'kind':'character-model','status':'exported','countsTowardQuota':False,'interactiveOrEvidence':False,
            'variantOf':None,'derivedFrom':[],'sources':[{'file':assetfile(source),'role':'native','application':'Blender','version':native['blender'],'reopenEvidencePath':re}],
            'exports':[{'file':assetfile(export),'mimeType':'model/gltf-binary','sourceHashes':[hashes[0]],'tool':'Blender glTF exporter','preset':'Y-up GLB, rigid parts packed per joint, named NLA tracks sampled at 24 fps, embedded PBR.','integrationEvidencePath':web}],
            'production':[production],'rights':rights,'usedBy':[],'verification':checks,'model':{'blendSourcePath':path(source),'objectIds':list(native['editableMeshes']),
            'units':'metres','axes':'Z-up/-Y to Y-up/+Z (x,z,-y)','pivot':'Identity floor root at origin; calibrated native model rests at ground zero.',
            'collisionProxy':'Presentation only. No solid mesh; frozen room navigation and saved points remain authoritative.','animationClips':clips,'triangles':imported['triangles'],'textureBytes':0}})
write(scripts.parent/'batch-a.json',{'schemaVersion':1,'episodeId':'spec001','assets':assets})
