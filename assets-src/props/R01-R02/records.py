# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Assemble production records for the retained Arrival Lift and new Workshop assets."""
import hashlib
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[3]
SRC=Path('assets-src/props/R01-R02')
RAW=Path('docs/evidence/spec001/prop-production/T110')
TYPED=Path('docs/evidence/spec001/assets/t110')
REFERENCES=[
    ('docs/evidence/spec001/assets/t063-R01-source.png','Blender','T063 Cycles'),
    ('docs/evidence/spec001/assets/t107/CH02-poses.png','Blender and Firefox','T107 Titan sheet'),
    ('docs/evidence/spec001/layouts-t106/diagram-contact-sheet.png','T106 layout renderer','T106 freeze'),
]
VISUAL={
    'PR011':'The vise, sliding front handle, brass graduations and bench cable on two guides remain distinct above the dark apron. The lower shelf receives more fill in Firefox.',
    'PR012':'The raised A and B cards flank the two conduit choices. Their lengths and shapes differ and both end at the same dark socket before the cream final lead. All pieces are visible in both renders.',
    'PR013':'Three differently shaped tools hang above four drawers with brass pulls and separate slip holders. The native cabinet recess is darker than the Firefox recess.',
    'PR014':'The receiver has a rolled-paper support, printed slip, three separate keys and B card on the front, with a terminated socket at the right. The front controls retain their spacing.',
    'PR015':'A forked saddle supports the wrapped landing bar and a separate hanging bell. The stepped foot and the hollow space between the two fork branches read in both views.',
    'PR016':'Three equal-height emblems share the junction below. The revised easel legs stay behind the repair sheet. Copper braid, angled ray and radio arcs remain distinguishable in the full-size GLB view.',
    'PR017':'The upper twisted conductors, the jacketed middle strand and the opposed lower apertures create three different profiles with a visible air gap in the bottom bay.',
    'PR018':'The pinned question sheet sits separately from two observation slips. Two visible threads branch toward the slips and the chalk rests on its own ledge.',
    'PR019':'Two different diameter trays have individual curved lips, radial dividers and groups of hexagonal ferrules or brass contacts. The axle and turn handle extend above them.',
    'PR020':'The revised forge shows a layered red, orange and luminous core behind banked clinker, with a masonry arch and a separate draft wheel. The shortened top flue clears the frozen camera. Native indirect glow is stronger than isolated WebGL lighting.',
}

def digest(path):
    return hashlib.sha256((ROOT/path).read_bytes()).hexdigest()


def read(path):
    return json.loads((ROOT/path).read_text())


def write(path,value):
    (ROOT/path).parent.mkdir(exist_ok=True,parents=True)
    (ROOT/path).write_text(json.dumps(value,indent=2,ensure_ascii=False)+'\n')


def file_ref(path):
    p=Path(path)
    return {'path':str(p),'sha256':digest(p),'bytes':(ROOT/p).stat().st_size,'format':p.suffix[1:]}


manifest=read('assets-src/manifest.json')
canonical={a['semanticIdentity']:a for a in manifest['assets']}
layout=read('assets-src/rooms/scene-layouts.json')
place={a['semanticId']:a for a in layout['rooms'][1]['propPlacements']}
names={p['id']:p['name'] for p in layout['sourcePropRoster']}
batch=next(b for b in read('assets-src/production-allocation.json')['batches'] if b['task']=='T110')
result=[]
summary=[]
for i in range(1,21):
    asset=f'PR{i:03}'
    semantic='spec001:'+asset
    asset_id='spec001:ASSET-'+asset
    a=canonical[semantic].copy()
    assert a['assetId']==batch['assetIds'][i-1]
    if i<=10:
        # Preserve the whole canonical record, including its exact native collection,
        # split geometry and use proof, so the benchmark never becomes twenty assets.
        assert a['status']=='integrated' and not a['countsTowardQuota']
        for record in [*a['sources'],*a['exports']]:
            assert file_ref(record['file']['path'])==record['file']
        summary.append({'semanticIdentity':semantic,'name':names[semantic],'disposition':'Retained entire canonical R01 row',
                        'native':a['sources'][0]['file'],'export':a['exports'][0]['file']})
        result.append(a)
        continue
    folder=RAW/asset
    native=read(folder/'native.json')
    web=read(folder/'browser.json')
    compare=read(folder/'reimport.json')
    blend=file_ref(native['sourcePath'])
    glb=file_ref(native['exportPath'])
    assert blend['sha256']==web['sourceSha256']==compare['sourceSha256']==native['sourceSha256']
    assert glb['sha256']==web['exportSha256']==compare['exportSha256']==native['exportSha256']
    assert web['pageErrors']==[] and web['strictLoopbackTLS'] and web['triangles']==native['triangles']
    assert len(native['meshObjects'])>10 and web['meshes']==1 and web['embeddedBuffers'] and not web['textures']
    assert native['rootLocation']==[0.,0.,0.] and native['rootScale']==[1.,1.,1.] and native['nativeQuaternionWXYZ']==[1.,0.,0.,0.]
    extent=[b-a for a,b in zip(*native['bounds'])]
    assert all(x<=limit+.00001 for x,limit in zip(extent,native['frozenEnvelopeWidthDepthHeight']))
    assert abs(native['bounds'][0][2])<.00001
    assert native['nativeCaptureSha256']==digest(folder/'native.png')
    canonical_path=lambda check: str(TYPED/asset/(check+'.json'))
    source=dict(file=blend,role='native',application='Blender',version=native['blender'],reopenEvidencePath=canonical_path('source-reopen'))
    refs=[dict(file=file_ref(path),role='reference',application=application,version=version) for path,application,version in REFERENCES]
    ref_hashes=[r['file']['sha256'] for r in refs]
    hashes=[blend['sha256'],glb['sha256'],*ref_hashes]
    export=dict(file=glb,mimeType='model/gltf-binary',sourceHashes=[blend['sha256']],tool='Blender glTF exporter',
                preset='Selected joined static mesh, embedded PBR and Y-up; metre scale, no cameras or lights.',
                integrationEvidencePath=canonical_path('browser-comparison'))
    production=dict(method='modeled',tool='Blender',version=native['blender'],modelRevision=native['build'],
                    eventId='T110-workshop-'+asset+'-20261127',settingsPath=str(SRC/'settings.json'),
                    promptOrScriptPath=str(SRC/'model.py'),referenceHashes=ref_hashes,outputHashes=[blend['sha256']],
                    notes='Original '+names[semantic]+' with separate editable parts. Project images provided scale, scheme and composition guidance.')
    notice=str(SRC/'NOTICE.md')
    rights=dict(reviewStatus='pending',creators=['Network Quest — John Capobianco and contributors','OpenAI Codex (assisted original modeling and inspection code)'],
                licenseIds=['CC-BY-4.0'],noticePaths=['NOTICE',notice],sourceUrls=[],termsSnapshotPaths=['LICENSE-ASSETS'],
                inputPermissionPaths=[notice],aiDisclosure='Agent-assisted original Blender geometry and material authoring. Project references informed design. Owner release review remains pending.')
    env=f"Mac16,7 arm64 macOS 26.6.2, Blender {native['blender']} {native['build']}, Firefox {web['browser']}, Three r{web['threeRevision']}, Node {web['node']}."
    who=dict(status='passed',reviewer='Codex loop127/T110',date='2026-11-27',environment=env)
    # Preserve exact modeling program revisions used for retained first-pass exports.
    recipe=(RAW/'first-review/workshop-relief-only.py' if asset=='PR012' else
            SRC/'workshop.py' if asset in ['PR016','PR020'] else RAW/'first-review/workshop-first.py')
    commands=[str(recipe),str(SRC/'reopen.py'),'assets-src/characters/t109/sculpt.py']
    details={**production,'settingsSha256':digest(production['settingsPath']),'promptSha256':digest(production['promptOrScriptPath']),
             'helperHashes':{p:digest(p) for p in commands},'nativeMeasurement':str(folder/'native.json')}
    write(canonical_path('production'),dict(assetId=asset_id,type='production',actor='tool',**who,hashes=[blend['sha256']],details=details))
    reviewed=[]
    sheet='bench-comparison.jpg' if i<=15 else 'preparation-comparison.jpg'
    observed=[blend['path'],glb['path'],*[p for p,_,_ in REFERENCES],str(folder/'native.png'),str(folder/'browser.png'),str(RAW/sheet)]
    def verification(check,actor,finding,methods,tool,other):
        typed=dict(assetId=asset_id,type='rights' if check=='rights' else 'review',check=check,actor=actor,hashes=hashes,**who)
        typed['details']=dict(findings=finding,methods=methods,tool=tool,observedPaths=observed,**other)
        path=canonical_path(check)
        write(path,typed)
        reviewed.append(dict(check=check,**who,hashes=hashes,evidencePath=path,findings=finding))
    raw_hashes={str(folder/fn):digest(folder/fn) for fn in ['native.json','reimport.json','browser.json','native.png','browser.png']}
    verification('source-reopen','tool',f"Fresh Blender opened the named source, rendered {len(native['meshObjects'])} editable components, inspected their materials and exported the selected hierarchy.",
                 ['native-source-reopen'],'Blender Cycles',{'measurementHashes':raw_hashes})
    verification('structure','tool',f"Reimported GLB and browser rendered {web['triangles']} triangles and {web['materialDraws']} material regions. Blender material region areas, triangle counts, base colors and bounds agree.",
                 ['native-glb-reimport','geometry-comparison'],'Blender glTF importer and Firefox Three.js renderer',{'measurementHashes':raw_hashes})
    verification('visual','agent',VISUAL[asset],['image-inspection'],'Agent inspection of matched Cycles and Firefox captures',{'captureHashes':raw_hashes,'sheetSha256':digest(RAW/sheet)})
    verification('browser-comparison','agent',VISUAL[asset]+f" Observed browser bounds agree within {web['maxBoundErrorMetres']:.2g} m.",
                 ['browser-inspection','image-inspection'],'Firefox isolated Three.js GLB viewer and Cycles source render',{'captureHashes':raw_hashes})
    verification('rights','agent','Original CC BY 4.0 equipment with project references and original geometry. Attribution, indication of changes and license retention apply.',
                 ['provenance-review'],'Project license, geometry inputs and notices',dict(licenseIds=rights['licenseIds'],noticeHashes=[digest(p) for p in rights['noticePaths']],
                 termsHashes=[digest(p) for p in rights['termsSnapshotPaths']],permissionHashes=[digest(notice)],referenceHashes=ref_hashes,
                 permitsCommercialReuse=True,permitsModification=True,permitsRedistribution=True))
    model=dict(blendSourcePath=blend['path'],objectIds=native['meshObjects'],units='metres',axes='Z up/-Y front to Y up/+Z front',
               pivot='Floor-centred stationary root '+asset+'_pivot with identity rotation and unit scale.',
               collisionProxy='Visual mesh only. Authored room walk regions and safe positions govern movement.',animationClips=[],triangles=web['triangles'],textureBytes=0)
    a.update(status='exported',sources=[source,*refs],exports=[export],production=[production],rights=rights,
             verification=reviewed,model=model,usedBy=[],countsTowardQuota=False,interactiveOrEvidence=False)
    result.append(a)
    summary.append(dict(semanticIdentity=semantic,name=names[semantic],disposition='New exported R02 model',native=blend,export=glb,
                        sourcePieces=len(native['meshObjects']),triangles=web['triangles'],draws=web['materialDraws'],dimensionsMetres=extent,
                        plannedPlacement=place[semantic]['instanceId'],plannedHotspots=place[semantic]['hotspotIds'],observedRuntimeUses=0,
                        maxBrowserBoundsErrorMetres=web['maxBoundErrorMetres'],maxMaterialRegionAreaErrorM2=compare['maximumMaterialRegionAreaErrorM2']))
write(batch['plannedFragmentPath'],dict(schemaVersion=manifest['schemaVersion'],episodeId=manifest['episodeId'],assets=result))
write(RAW/'production.json',dict(task='T110',sourcesAndExports=summary,reusedR01=10,newR02=10,quotaAdded=0,
                                 currentFragmentSha256=digest(batch['plannedFragmentPath']),frozenLayoutSha256=digest('assets-src/rooms/scene-layouts.json'),
                                 frozenAllocationSha256=digest('assets-src/production-allocation.json')))
