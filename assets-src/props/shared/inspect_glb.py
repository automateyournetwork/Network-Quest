# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Read the exported GLB bytes independently and compare the native / browser measurements."""
from pathlib import Path
import hashlib
import json
import math
import struct

ROOT=Path(__file__).resolve().parents[3]
RAW=ROOT/'docs/evidence/spec001/prop-production/T116'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
layouts=read(ROOT/'assets-src/rooms/scene-layouts.json')['rooms']
allocation=next(b for b in read(ROOT/'assets-src/production-allocation.json')['batches'] if b['task']=='T116')
import ast
# Read these numeric modeling settings without importing the Blender modeling modules.
authored={}
tree=ast.parse((ROOT/'assets-src/props/shared/roster.py').read_text())
for expr in ast.walk(tree):
    if isinstance(expr,ast.Dict):
        for key,val in zip(expr.keys,expr.values):
            if isinstance(key,ast.Constant) and isinstance(key.value,int):
                authored[f'PR{key.value}']=ast.literal_eval(val.elts[1])
rows=[];seen=set();verified_ids=set()
for room in layouts:
    for p in (p for p in room['propPlacements'] if p['sourceAllocation']=='Shared'):
        code=p['semanticId'][-5:]
        if code in verified_ids:continue
        verified_ids.add(code)
        native=read(RAW/(code+'-native.json')); browser=read(RAW/(code+'-browser.json'))
        data=(ROOT/native['export']).read_bytes()
        magic,version,size,length,chunk_type=struct.unpack_from('<4sIIII',data)
        assert (magic,version,size,chunk_type)==(b'glTF',2,len(data),0x4e4f534a)
        doc=json.loads(data[20:20+length])
        binary_size,kind=struct.unpack_from('<II',data,20+length)
        assert kind==0x004e4942 and len(data)==28+length+binary_size
        buf=doc['buffers'];assert len(buf)==1 and 'uri' not in buf[0] and binary_size-buf[0]['byteLength'] in range(4)
        assert not any(doc.get(k) for k in ('images','textures','animations','skins','cameras'))
        assert len(doc['meshes'])==1 and doc['scene']==0
        assert doc['nodes'][doc['scenes'][0]['nodes'][0]]['extras']['assetId']==p['assetId']
        total=0
        for primitive in doc['meshes'][0]['primitives']:
            assert primitive.get('mode',4)==4
            ix=doc['accessors'][primitive['indices']]; assert ix['count']%3==0 and ix['type']=='SCALAR'
            total+=ix['count']//3
        native_tris=sum(native['editableMeshes'].values())
        assert total==native_tris==browser['geometryTriangles'] and total>0
        assert native['sourceSha256']==sha(ROOT/native['source'])
        assert native['exportSha256']==browser['exportSha256']==sha(ROOT/native['export'])
        assert native['exportSha256'] not in seen
        seen.add(native['exportSha256'])
        assert native['imageDependencies']==[]
        boundaries=native['nativeBounds']; actual=[b-a for a,b in zip(*boundaries)]
        assert p['candidateEnvelope'] is None and all(0<obs<=2.37 for obs in actual)
        assert native['anchorKind'] in ['base','center','top']
        assert native['origin']==[0,0,0] and native['nativeQuaternionWXYZ']==[1,0,0,0]
        # Compare the requested maximum physical extent in the production roster.
        size=authored[code]
        assert abs(max(actual)-size)<1e-5
        length_claim=buf[0]['byteLength']
        glb_geometry=hashlib.sha256(data[28+length:28+length+length_claim]).hexdigest()
        center=room['authoritativeSafePositions'][0]['point']
        lo,hi=browser['bounds'];x,_,z=p['position']
        dx=max(x+lo[0]-center['x'],center['x']-(x+hi[0]),0)
        dz=max(z+lo[2]-center['y'],center['y']-(z+hi[2]),0)
        distance=math.hypot(dx,dz)
        assert distance>=room['visualWalkGuide']['safeArrivalRadiusMetres'] or lo[1]+p['position'][1]>2.5
        rows.append(dict(assetId=p['assetId'],semanticId=p['semanticId'],specName=p['sourceName'],
                         room=room['roomId'],layout=p['position'],actualNativeSize=actual,authoredMaximumExtentMetres=size,anchorKind=native['anchorKind'],
                         binaryGeometrySha256=glb_geometry,mountedToInstance=p['mountedToInstanceId'],use=p['placementPurpose'],
                         preservedArrivalClearanceMetres=distance,editableMeshCount=len(native['editableMeshes']),
                         triangles=total,renderedTriangles=browser['renderedTriangles'],draws=browser['draws'],
                         nativeBytes=native['sourceBytes'],glbBytes=len(data),nodes=len(doc['nodes']),meshes=len(doc['meshes']),
                         materials=len(doc['materials']),bufferCount=1,textureBytes=0,sourceSha256=native['sourceSha256'],
                         exportSha256=native['exportSha256'],boundsError=browser['maxBoundsErrorMetres']))
rows.sort(key=lambda r:r['assetId'])
assert [r['assetId'] for r in rows]==allocation['assetIds']
# Compare the embedded geometry buffer against every available commissioned prop
# in the 150-ID roster. This supplements the manual shape and purpose comparison.
all_hashes={}
for glb in (ROOT/'public/assets/models').rglob('*.glb'):
    import re
    match=re.search(r'(PR\d{3})$',glb.stem)
    if not match or not 1<=int(match[1][-3:])<=150:continue
    code=match[1];data=glb.read_bytes();length=struct.unpack_from('<I',data,12)[0]
    doc=json.loads(data[20:20+length])
    binary=data[28+length:28+length+doc['buffers'][0]['byteLength']]
    key=hashlib.sha256(binary).hexdigest()
    assert code not in all_hashes,code
    all_hashes[code]=key
assert len(all_hashes)==150
for r in rows:
    code=r['semanticId'][-5:]
    assert r['binaryGeometrySha256']==all_hashes[code]
    assert list(all_hashes.values()).count(all_hashes[code])==1
(RAW/'geometry-fingerprints.json').write_text(json.dumps(dict(sorted(all_hashes.items())),indent=2)+'\n')
(RAW/'geometry.json').write_text(json.dumps(rows,indent=2)+'\n')
