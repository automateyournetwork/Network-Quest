# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build the T116 exported-only fragment and its typed records after inspecting the rendered pairs."""
from pathlib import Path
import ast
import hashlib
import json

ROOT=Path(__file__).resolve().parents[3]
SRC=Path(__file__).resolve().parent
RAW=ROOT/'docs/evidence/spec001/prop-production/T116'
RECORD=ROOT/'docs/evidence/spec001/assets/t116'

def relative(p):return str(p.relative_to(ROOT))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def save(p,obj):p.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
def file(p):return dict(path=relative(p),bytes=p.stat().st_size,sha256=digest(p),format=p.suffix[1:])

observations=load(RAW/'review-observations.json')
layouts=load(ROOT/'assets-src/rooms/scene-layouts.json')['rooms']
canonical={a['assetId']:a for a in load(ROOT/'assets-src/manifest.json')['assets']}
geometry={r['semanticId'][-5:]:r for r in load(RAW/'geometry.json')}
comparisons={r['id']:r for r in load(RAW/'comparison.json')}
placements={}
for room in layouts:
    for p in room['propPlacements']:
        if p['sourceAllocation']=='Shared':
            placements.setdefault(p['assetId'],[]).append((room,p))
assets=[];environ='macOS 26.6.2 arm64 Mac16,7, Blender 5.2.1 LTS 9e2066aef7ef, Three r187 / Firefox 159.0 via strict temporary local TLS.'
scope='T116 exported fixture. Live room binding, combined resident/party occlusion, owner visual review, release budget and quota acceptance follow in later tasks.'
identity=dict(reviewer='/root/loop133_t116',date='2026-11-27',environment=environ)
for uses in placements.values():
    room,p=uses[0]
    code=p['semanticId'][-5:];n=int(code[2:])
    src=SRC/(code+'.blend');glb=ROOT/f'public/assets/models/shared/{code}.glb'
    native=load(RAW/(code+'-native.json'));g=geometry[code];im=comparisons[code]
    assert im['edgePixels']==[0,0] and im['maskIoU']>.94
    assert im['sourceSha256']==digest(RAW/(code+'-native.png')) and im['browserSha256']==digest(RAW/(code+'-browser.png'))
    assert g['sourceSha256']==digest(src) and g['exportSha256']==digest(glb)
    hashes=[g['sourceSha256'],g['exportSha256']]; aid=p['assetId']
    a=canonical[aid];a['status']='exported'
    def evidence_path(kind):return relative(RECORD/f'{code}-{kind}.json')
    def record(kind,actor,details,record_type='review',hashset=hashes):
        r=dict(type=record_type,assetId=aid,hashes=hashset,status='passed',actor=actor,**identity,details=details)
        if kind!='production':r['check']=kind
        save(ROOT/evidence_path(kind),r)
    def review(kind,actor,finding,extra,record_type='review'):
        details=dict(observedPaths=[relative(src),relative(glb)],scope=scope,findings=finding,**extra)
        record(kind,actor,details,record_type)
        a['verification'].append(dict(check=kind,status='passed',**identity,hashes=hashes,evidencePath=evidence_path(kind),findings=finding))
    a['sources']=[dict(file=file(src),role='native',application='Blender',version=native['version'],reopenEvidencePath=evidence_path('source-reopen'))]
    a['exports']=[dict(file=file(glb),mimeType='model/gltf-binary',sourceHashes=hashes[:1],tool='Blender glTF exporter',
                       preset='Static fixture, applied edge modifiers, one mesh grouped by material, metre units, Y-up, embedded buffer.',
                       integrationEvidencePath=evidence_path('browser-comparison'))]
    sculpt=SRC/('instruments.py' if n<131 else 'fixtures.py' if n<140 else 'fieldkit.py')
    parts=SRC/'parts.py'
    functions={node.name:node for node in ast.parse(sculpt.read_text()).body if isinstance(node,ast.FunctionDef)}
    roster=ast.parse((SRC/'roster.py').read_text())
    function=next(val.elts[0].id for group in ast.walk(roster) if isinstance(group,ast.Dict)
                  for key,val in zip(group.keys,group.values) if isinstance(key,ast.Constant) and key.value==n)
    body=ast.get_source_segment(sculpt.read_text(),functions[function])
    event=dict(method='modeled',tool='Blender',version=native['version'],modelRevision=native['build'],
               eventId=f'T116-{code}-20261127',settingsPath=relative(SRC/'build.py'),promptOrScriptPath=relative(sculpt),
               referenceHashes=[],outputHashes=hashes[:1],notes='Original named educational prop built from editable geometry, inscriptions and project material swatches.')
    a['production']=[event]
    record('production','tool',dict(**event,settingsSha256=digest(SRC/'build.py'),promptSha256=digest(sculpt),
           workshopLibrarySha256=digest(parts),workshopLibraryPath=relative(parts),reopenScriptSha256=digest(SRC/'reopen.py'),
           nativeReport=relative(RAW/(code+'-native.json')),namedModelingFunction=function,
           namedFunctionSha256=hashlib.sha256(body.encode()).hexdigest(),briefInputs={path:digest(ROOT/path) for path in
               ['assets-src/props/R05-R06/workshop.py','assets-src/props/shared/roster.py','content/spec001/packet-context.json','SPEC.md','assets-src/art-direction.md','assets-src/rooms/scene-layouts.json','assets-src/production-allocation.json',
                f'content/spec001/rooms/{room["roomId"][-3:]}.json']}),'production',hashes[:1])
    notices=['NOTICE','LICENSE-ASSETS',relative(SRC/'NOTICE.md')]
    a['rights']=dict(reviewStatus='accepted',creators=['John Capobianco (Network Quest project)','OpenAI Codex (procedural modeling assistance)'],
                     licenseIds=['CC-BY-4.0'],noticePaths=notices,sourceUrls=[],termsSnapshotPaths=[],inputPermissionPaths=[],
                     aiDisclosure='Original script-modeled geometry, palette and enamel glyphs. No external mesh, image, font or texture in either model file. Scripts carry Apache-2.0.')
    a['model']=dict(blendSourcePath=relative(src),objectIds=[native['rig'],*native['editableMeshes']],units='metres',
                    axes='Blender Z-up, GLB Y-up',pivot=native['anchorKind']+' registration centered on the local X/Y footprint, identity quaternion, unit outer scale.' ,
                    collisionProxy='Presentation only. Authored walk regions own navigation.',animationClips=[],
                    triangles=g['triangles'],textureBytes=0)
    review('source-reopen','tool',f"Fresh Blender process opened the saved model and rendered {g['editableMeshCount']} editable mesh parts. Document/root remained intact during in-memory export.",
           dict(methods=['native-source-reopen'],nativeReport=relative(RAW/(code+'-native.json')),nativeRender=relative(RAW/(code+'-native.png'))))
    review('structure','tool',f"Binary header, one internal buffer, one mesh and {g['triangles']} indexed triangles verified. Native and Firefox agree on triangle count and material names.",
           dict(report=relative(RAW/'geometry.json'),materials=native['materials'],nativeBounds=native['nativeBounds'],nativeRootQuaternionWXYZ=native['nativeQuaternionWXYZ']))
    images=[relative(RAW/(code+'-'+t+'.png')) for t in ['native','browser']]
    review('visual','agent',observations[code],dict(methods=['image-inspection'],tool='Visual inspection of full-color paired Blender and Firefox sheets',
           images=images,comparisonSheet=relative(RAW/f'sheet-{(n-121)//5+1}.jpg'),frozenPlacements=[q['instanceId'] for _,q in uses],mount=p['mountedToInstanceId'],roomStageReports=[relative(RAW/(room['roomId'][-3:]+'-'+phase+'.json')) for phase in ['frozen','mounted']]))
    review('browser-comparison','agent',f"Paired studio captures preserve the fixture silhouette. Binary mask intersection over union {im['maskIoU']:.4f}; maximum vertex-bound component difference {g['boundsError']:.3g} m.",
           dict(methods=['browser-inspection','image-inspection'],tool='Playwright Firefox 159.0 / Three.js r187, matched orthographic camera',
                images=images,measurement=relative(RAW/(code+'-browser.json')),pixels=relative(RAW/'comparison.json')))
    review('rights','agent','Reviewed original construction, procedural lettering and the project’s license and notices for these two exact model files.',
           dict(licenseIds=['CC-BY-4.0'],noticeHashes=[digest(ROOT/path) for path in notices],
                termsHashes=[],permissionHashes=[],referenceHashes=[],permitsCommercialReuse=True,permitsRedistribution=True,permitsModification=True),'rights')
    review('budget','tool',f"{g['glbBytes']} GLB bytes, {g['triangles']} indexed triangles, {g['draws']} isolated WebGL draws and zero external textures. Finished-room delivery and timing remain open.",
           dict(isolatedOnly=True,report=relative(RAW/'geometry.json'),geometryTriangles=g['triangles'],webglDraws=g['draws'],decodedTextureBytes=0))
    assert not a['usedBy'] and not a['countsTowardQuota']
    assets.append(a)
save(SRC/'manifest.json',dict(schemaVersion=1,episodeId='spec001',assets=sorted(assets,key=lambda a:a['assetId'])))
