# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build the T112 exported-only fragment and its typed records after inspecting the rendered pairs."""
from pathlib import Path
import hashlib
import json

ROOT=Path(__file__).resolve().parents[3]
SRC=Path(__file__).resolve().parent
RAW=ROOT/'docs/evidence/spec001/prop-production/T112'
RECORD=ROOT/'docs/evidence/spec001/assets/T112'

def relative(p):return str(p.relative_to(ROOT))
def digest(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def load(p):return json.loads(p.read_text())
def save(p,obj):p.write_text(json.dumps(obj,indent=2,ensure_ascii=False)+'\n')
def file(p):return dict(path=relative(p),bytes=p.stat().st_size,sha256=digest(p),format=p.suffix[1:])

observations={
41:'Tapered roots spread into a fluted trunk with pearl branch veins and a pale workshop direction ribbon. The distant prongs read as one tree.',
42:'Three heights and open pearl sepals distinguish the blossoms from the grove trunk. The cream card hangs visibly in front of the stems.',
43:'Rail-mounted sample ferrule faces the dark recessed scope objective across an open gap. The focus knob and INSPECT apron remain visible in both views.',
44:'The brush pot and paired replacement parts occupy separate sides of the counter. A tall motto frames the whole station without covering either intervention.',
45:'Six numbered profile samples sit on two shelves. Each sample shows paired dark receptacles and the corresponding index card. The room text supplies the five compatibility fields.',
46:'The wide rounded loop contrasts with a narrow, pinched tip. Both profiles read without color; the exhibit plaque specifies no universal radius.',
47:'A brass fork on a fluted handle ends in two ceramic ferrules. It illustrates a passive split; its branches carry no payload or gain marking.',
48:'Two jacket heights expose angular, broken glass tips. The EXHIBIT ONLY sign separates the fracture specimen from the repairable dock connection.',
49:'A dark receiver aperture sits behind two separate places on the lectern, an empty lantern cup and an open ruled ledger. No reading is painted on the aperture.',
50:'A guarded amber chamber and octagonal hood crown the slender standard. A forked maintenance ribbon hangs below the chamber.',
51:'A faceted triangular rotor sits between copper axle keepers within concentric sight rings. The engraved transmitter level belongs to the fictional exercise.',
52:'Three sleeved inputs meet a hexagonal combining block with one outgoing guide. Distinct band positions and the MATCH PAIR sign supplement hue.',
53:'Four lancet panes have opposing raised chevrons and a direction plate. Direction remains visible in the shapes.',
54:'The round selector has three raised detents and a scalloped manual wheel. It has no fixed measurement needle; the room supplies current configuration and readings.',
55:'The hinged, translucent lid exposes the paired fiber coils, compression glands and central splice sleeve. The native and browser lid tint differ while the join remains visible.',
56:'The inline attenuator sits in its own saddle below a separate 0 dBm comparison card. It is visually distinct from the path selector.',
57:'Two level marks flank the vertical receiver slot. Its separate brass interval bracket and reserve plaque distinguish 2 dB of margin from the dBm endpoints.',
58:'Two translucent filter leaves stand apart between jambs. A central gap remains visible beneath the FILTER crown.',
59:'Two rods separate eight path-loss beads from three reserve beads. The fixed EXAMPLE A heading and the distinct dBm and dB equations make the worked case explicit.',
60:'The tilted dark cavity, copper retaining jaws, toe rests and separate lead leave room for the ordinary meter. The empty cradle displays no fresh reading.',
}
layouts=load(ROOT/'assets-src/rooms/scene-layouts.json')['rooms'][4:6]
canonical={a['assetId']:a for a in load(ROOT/'assets-src/manifest.json')['assets']}
geometry={r['semanticId'][-5:]:r for r in load(RAW/'geometry.json')}
comparisons={r['id']:r for r in load(RAW/'comparison.json')}
assets=[];environ='macOS 26.6.2 arm64 Mac16,7, Blender 5.2.1 LTS 9e2066aef7ef, Three r187 / Firefox 159.0 via strict temporary local TLS.'
scope='T112 exported fixture. Live room binding, combined resident/party occlusion, owner visual review, release budget and quota acceptance follow in later tasks.'
identity=dict(reviewer='/root/loop129_t112',date='2026-11-27',environment=environ)
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
        sculpt=SRC/('gardens.py' if n<51 else 'vault.py')
        event=dict(method='modeled',tool='Blender',version=native['version'],modelRevision=native['build'],
                   eventId=f'T112-{code}-20261127',settingsPath=relative(SRC/'build.py'),promptOrScriptPath=relative(sculpt),
                   referenceHashes=[],outputHashes=hashes[:1],notes='Original named educational prop built from editable geometry, inscriptions and project material swatches.')
        a['production']=[event]
        record('production','tool',dict(**event,settingsSha256=digest(SRC/'build.py'),promptSha256=digest(sculpt),
               workshopLibrarySha256=digest(SRC/'workshop.py'),reopenScriptSha256=digest(SRC/'reopen.py'),
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
               images=images,comparisonSheet=relative(RAW/f'sheet-{(n-41)//5+1}.jpg'),frozenHotspotIds=p['hotspotIds']))
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
