# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build the T115 exported-only fragment and its typed records after inspecting the rendered pairs."""
from pathlib import Path
import hashlib
import json

ROOT=Path(__file__).resolve().parents[3]
SRC=Path(__file__).resolve().parent
RAW=ROOT/'docs/evidence/spec001/prop-production/T115'
RECORD=ROOT/'docs/evidence/spec001/assets/T115'

def relative(p):return str(p.relative_to(ROOT))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def save(p,obj):p.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
def file(p):return dict(path=relative(p),bytes=p.stat().st_size,sha256=digest(p),format=p.suffix[1:])

observations={
101:'Two irregular banks expose continuous strata down to a cracked, rubble-strewn floor. Their broken courses follow the excavation. The pins mark the work edges.',
102:'The torn sleeves terminate at different heights. A visible air gap separates their eight splayed conductors on either side. The jagged wall and ferrules survive export.',
103:'Independent treads span two bearing blocks beneath a one-sided rail. The PLAN tag identifies the deck as a plan-selection station.',
104:'Three feet support a raked elevation yoke and a dished reflector with a three-strut feed. The transceiver stays low on the tripod. No reading appears on it.',
105:'The teal clean mat carries an open splicer. Two pale jaws flank the bare fiber and the spare fiber loop sits clear of the working area.',
106:'The two separately socketed patch leads form independent candidate paths. Their measured-length cards read 95 METRES and 100 METRES. Color is supplementary.',
107:'A raised diamond with an exclamation point clears the WARNING label and striped barricade. Its two weighted feet reinforce the work-zone boundary.',
108:'The ruled permit unwinds from a roller between two spindle caps. A stamp stands on its right; the PERMIT label identifies the review stand.',
109:'A manual lever pivots above a chest between a pair of protective hoops. The EXECUTE plate marks the separate intervention control.',
110:'An arrow marked TEMP carries a separate hanging BORROWED tag, making its dependency explicit independent of hue.',
111:'Closed iron leaves meet at a seam below the stepped city skyline. The central plaque identifies the Iron City as a future realm.',
112:'A louvered Fresnel mantle sits inside a guarded lantern with a cupped foot and a LINK collar. Its emission reads as a lamp indication.',
113:'Separate bezels and blank displays appear over the keyboard, labeled LINK and ENDPOINT. Neither carries a baked measurement or service verdict.',
114:'The balcony has an open entry, two full side rails, an end rail and a mounted viewer. The elevated slats and supporting braces read in the matched oblique views.',
115:'An empty picture field lies above three distinct, unselected classification mounts. Side rails, corner keepers and the CHAPTER I title surround the area for state-driven artwork.',
116:'Three separate clipped tickets show the order INSTALL, VALIDATE, RETURN. The FOLLOW UP heading makes their role legible.',
117:'An unfilled measurement scale and an empty strip reader sit on a faceted column marked LINK. The paired crown prongs distinguish it from the beacon.',
118:'The raised seal die hangs above a blank circular impression pad on an octagonal press. It carries no pre-awarded stamp.',
119:'A slim open arch carries a left-pointing RIFT marker. Its opening and direction visibly distinguish it from the closed Iron City gate.',
120:'The broken-line crest separates two jagged ends. IF ISOLATED, REPAIR, RETEST is a conditional recovery instruction on a civic tablet.',
}
layouts=load(ROOT/'assets-src/rooms/scene-layouts.json')['rooms'][10:12]
canonical={a['assetId']:a for a in load(ROOT/'assets-src/manifest.json')['assets']}
geometry={r['semanticId'][-5:]:r for r in load(RAW/'geometry.json')}
comparisons={r['id']:r for r in load(RAW/'comparison.json')}
assets=[];environ='macOS 26.6.2 arm64 Mac16,7, Blender 5.2.1 LTS 9e2066aef7ef, Three r187 / Firefox 159.0 via strict temporary local TLS.'
scope='T115 exported fixture. Static default-pose residents are staged separately. Final room binding, party occlusion, owner review, release budget and quota acceptance follow in later tasks.'
identity=dict(reviewer='/root/loop132_t115',date='2026-11-27',environment=environ)
for room in layouts:
    for p in room['propPlacements'][:10]:
        code=p['semanticId'][-5:];n=int(code[2:])
        src=SRC/(code+'.blend');glb=ROOT/f'public/assets/models/{code}.glb'
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
        sculpt=SRC/('rift.py' if n<111 else 'threshold.py')
        event=dict(method='modeled',tool='Blender',version=native['version'],modelRevision=native['build'],
                   eventId=f'T115-{code}-20261127',settingsPath=relative(SRC/'build.py'),promptOrScriptPath=relative(sculpt),
                   referenceHashes=[],outputHashes=hashes[:1],notes='Original named educational prop built from editable geometry, inscriptions and project material swatches.')
        a['production']=[event]
        record('production','tool',dict(**event,settingsSha256=digest(SRC/'build.py'),promptSha256=digest(sculpt),
               componentLibrarySha256=digest(SRC/'parts.py'),workshopLibrarySha256=digest(SRC.parent/'R05-R06/workshop.py'),reopenScriptSha256=digest(SRC/'reopen.py'),
               nativeReport=relative(RAW/(code+'-native.json')),briefInputs={path:digest(ROOT/path) for path in
                   ['SPEC.md','assets-src/art-direction.md','assets-src/rooms/scene-layouts.json','assets-src/production-allocation.json',
                    f'content/spec001/rooms/{p["sourceAllocation"]}.json']}),'production',hashes[:1])
        notices=['NOTICE','LICENSE-ASSETS',relative(SRC/'NOTICE.md')]
        a['rights']=dict(reviewStatus='accepted',creators=['John Capobianco (Network Quest project)','OpenAI Codex (procedural modeling assistance)'],
                         licenseIds=['CC-BY-4.0'],noticePaths=notices,sourceUrls=[],termsSnapshotPaths=[],inputPermissionPaths=[],
                         aiDisclosure='Original script-modeled geometry, palette and enamel glyphs. No external mesh, image, font or texture in either model file. Scripts carry Apache-2.0.')
        a['model']=dict(blendSourcePath=relative(src),objectIds=[native['rig'],*native['editableMeshes']],units='metres',
                        axes='Blender Z-up, GLB Y-up',pivot='Floor origin centered beneath fixture, identity quaternion, unit outer scale.',
                        collisionProxy='Presentation only. Authored walk regions own navigation.',animationClips=[],
                        triangles=g['triangles'],textureBytes=0)
        review('source-reopen','tool',f"Fresh Blender process opened the saved model and rendered {g['editableMeshCount']} editable mesh parts. Document/root remained intact during in-memory export.",
               dict(methods=['native-source-reopen'],nativeReport=relative(RAW/(code+'-native.json')),nativeRender=relative(RAW/(code+'-native.png'))))
        review('structure','tool',f"Binary header, one internal buffer, one mesh and {g['triangles']} indexed triangles verified. Native and Firefox agree on triangle count and material names.",
               dict(report=relative(RAW/'geometry.json'),materials=native['materials'],nativeBounds=native['nativeBounds'],nativeRootQuaternionWXYZ=native['nativeQuaternionWXYZ']))
        images=[relative(RAW/(code+'-'+t+'.png')) for t in ['native','browser']]
        review('visual','agent',observations[n],dict(methods=['image-inspection'],tool='Visual inspection of full-color paired Blender and Firefox sheets',
               images=images,staging=relative(RAW/(p['sourceAllocation']+'-frozen.json')),comparisonSheet=relative(RAW/f'sheet-{(n-101)//5+1}.jpg'),frozenHotspotIds=p['hotspotIds']))
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
save(SRC/'manifest.json',dict(schemaVersion=1,episodeId='spec001',assets=assets))
