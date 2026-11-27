# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Read the exported GLB bytes independently and compare the native / browser measurements."""
from pathlib import Path
import hashlib
import json
import math
import struct

ROOT=Path(__file__).resolve().parents[3]
RAW=ROOT/'docs/evidence/spec001/prop-production/T113'
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def read(path):return json.loads(path.read_text())
layouts=read(ROOT/'assets-src/rooms/scene-layouts.json')['rooms'][6:8]
allocation=next(b for b in read(ROOT/'assets-src/production-allocation.json')['batches'] if b['task']=='T113')
rows=[];seen=set()
for room in layouts:
    for p in room['propPlacements'][:10]:
        code=p['semanticId'][-5:]
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
        envelope=p['candidateEnvelope']
        assert all(0<obs<=envelope[dim]+1e-5 for obs,dim in zip(actual,('width','depth','height')))
        center=room['authoritativeSafePositions'][0]['point']
        lo,hi=browser['bounds'];x,_,z=p['position']
        dx=max(x+lo[0]-center['x'],center['x']-(x+hi[0]),0)
        dz=max(z+lo[2]-center['y'],center['y']-(z+hi[2]),0)
        distance=math.hypot(dx,dz)
        assert distance>=room['visualWalkGuide']['safeArrivalRadiusMetres']
        rows.append(dict(assetId=p['assetId'],semanticId=p['semanticId'],specName=p['sourceName'],
                         layout=p['position'],actualNativeSize=actual,envelope=envelope,
                         preservedArrivalClearanceMetres=distance,editableMeshCount=len(native['editableMeshes']),
                         triangles=total,renderedTriangles=browser['renderedTriangles'],draws=browser['draws'],
                         nativeBytes=native['sourceBytes'],glbBytes=len(data),nodes=len(doc['nodes']),meshes=len(doc['meshes']),
                         materials=len(doc['materials']),bufferCount=1,textureBytes=0,sourceSha256=native['sourceSha256'],
                         exportSha256=native['exportSha256'],boundsError=browser['maxBoundsErrorMetres']))
assert [r['assetId'] for r in rows]==allocation['assetIds']
(RAW/'geometry.json').write_text(json.dumps(rows,indent=2)+'\n')
