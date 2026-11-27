# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Independently decode the actual embedded vertex/index data and native-to-glTF ground transform."""
from pathlib import Path
import json,struct,math,hashlib
root=Path(__file__).resolve().parents[3]
raw=root/'docs/evidence/spec001/prop-production/T111'
def read(p):return json.loads(p.read_text())
placements={p['semanticId'].split(':')[-1]:p for room in read(root/'assets-src/rooms/scene-layouts.json')['rooms'][2:4] for p in room['propPlacements']}
results={}
for n in range(21,41):
    id=f'PR{n:03}';b=(root/'public/assets/models/R03-R04'/(id+'.glb')).read_bytes()
    magic,version,total=struct.unpack_from('<4sII',b);assert (magic,version,total)==(b'glTF',2,len(b))
    size,tag=struct.unpack_from('<I4s',b,12);assert tag==b'JSON'
    doc=json.loads(b[20:20+size]);binsize,bintag=struct.unpack_from('<I4s',b,20+size);assert bintag==b'BIN\0'
    body=b[28+size:];assert len(body)==binsize and len(doc['buffers'])==1 and 'uri' not in doc['buffers'][0]
    assert not any(doc.get(k) for k in ['images','textures','animations','skins','cameras'])
    roots=doc['scenes'][doc['scene']]['nodes'];assert len(roots)==1
    base=doc['nodes'][roots[0]]
    assert base['name']==id and base['extras']['identity']=='spec001:'+id and base['extras']['title']==placements[id]['sourceName']
    assert not {'rotation','scale','translation','matrix'}.intersection(base)
    assert len(base['children'])==1 and len(doc['meshes'])==1
    node=doc['nodes'][base['children'][0]];assert not {'rotation','scale','matrix'}.intersection(node)
    offset=node.get('translation',[0,0,0])
    def values(index):
        a=doc['accessors'][index];view=doc['bufferViews'][a['bufferView']]
        assert view['buffer']==0 and 'sparse' not in a
        fmt='<'+{'SCALAR':'','VEC3':'3'}[a['type']]+{5126:'f',5125:'I',5123:'H',5121:'B'}[a['componentType']]
        start=view.get('byteOffset',0)+a.get('byteOffset',0);stride=view.get('byteStride',struct.calcsize(fmt))
        return [struct.unpack_from(fmt,body,start+i*stride) for i in range(a['count'])]
    points=[]; tris=0
    native=read(raw/f'{id}-native.json'); web=read(raw/f'{id}-browser.json')
    for p in doc['meshes'][node['mesh']]['primitives']:
        vs=values(p['attributes']['POSITION']); indices=values(p['indices'])
        assert p.get('mode',4)==4 and len(indices)%3==0 and all(0<=i[0]<len(vs) for i in indices)
        assert all(math.isfinite(x) for vertex in vs for x in vertex)
        points.extend([[v[i]+offset[i] for i in range(3)] for v in vs]);tris+=len(indices)//3
    for mat in doc['materials']:
        name=mat['name']; alpha=mat['pbrMetallicRoughness']['baseColorFactor'][3]
        assert abs(alpha-native['materials'][name]['alpha'])<1e-6
        assert (mat.get('alphaMode','OPAQUE')=='BLEND')==(alpha<1)
    assert tris==native['triangles']==web['triangles']
    assert hashlib.sha256(b).hexdigest()==native['glbSha256']==web['glbSha256']
    bounds=[[fn(v[i] for v in points) for i in range(3)] for fn in [min,max]]
    lo,hi=native['boundsXYZ'];expected=[[lo[0],lo[2],-hi[1]],[hi[0],hi[2],-lo[1]]]
    delta=max(abs(bounds[i][j]-expected[i][j]) for i in range(2) for j in range(3))
    assert delta<1e-5 and abs(bounds[0][1])<1e-5
    envelope=placements[id]['candidateEnvelope']
    assert all(native['dimensionsXYZ'][i]<=envelope[key]+1e-5 for i,key in enumerate(['width','depth','height']))
    results[id]={'glbSha256':native['glbSha256'],'rootIdentity':base['name'],'glbBoundsYUp':bounds,'nativeAxisConversionMaxErrorMetres':delta,'embeddedImages':0,
                 'drawPrimitives':len(doc['meshes'][0]['primitives']),'trianglesAcrossIndexedPrimitives':tris,
                 'positionAndIndexDecoded':True,'withinCandidateEnvelope':True,'materialAlphaModeVerified':True}
(raw/'glb-structure.json').write_text(json.dumps(results,indent=2)+'\n')
print('Validated',len(results),'embedded GLB files')
