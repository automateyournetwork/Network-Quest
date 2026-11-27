# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Independently reimport each exported binary, compare geometry and inspect GLB containers."""
import hashlib
import json
import math
import struct
from pathlib import Path
import bpy

root=Path(__file__).resolve().parents[3]
raw=root/'docs/evidence/spec001/character-production/T107'
for asset in ('CH02','CH04','CH05','CH06','CH07','CH08','CH09'):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    p=root/f'public/assets/models/{asset}.glb'
    b=p.read_bytes()
    magic,version,length,jlen,jtype=struct.unpack_from('<5I',b)
    assert magic==0x46546c67 and version==2 and length==len(b) and jtype==0x4e4f534a
    g=json.loads(b[20:20+jlen]);blen,btype=struct.unpack_from('<II',b,20+jlen)
    assert btype==0x004e4942 and 28+jlen+blen==len(b)
    assert len(g['buffers'])==1 and 'uri' not in g['buffers'][0]
    assert not any(g.get(k) for k in ('images','textures','cameras','skins'))
    native=json.loads((raw/f'{asset}-native.json').read_text())
    browser=json.loads((raw/f'{asset}-browser.json').read_text())
    bpy.ops.import_scene.gltf(filepath=str(p))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    triangles=0
    for obj in meshes:
        obj.data.calc_loop_triangles()
        triangles+=len(obj.data.loop_triangles)
    assert triangles==sum(native['editableMeshes'].values())==browser['triangles']
    assert hashlib.sha256(b).hexdigest()==native['exportSha256']==browser['exportSha256']
    glb_root=g['nodes'][g['scenes'][g.get('scene',0)]['nodes'][0]]
    assert glb_root['name']==asset+'_floor_root' and glb_root['extras']['assetId']=='spec001:ASSET-'+asset
    assert not any(k in glb_root for k in ['scale','matrix','translation','rotation'])
    binary=b[28+jlen:]
    clips={}
    for anim in g['animations']:
        varying=[];seams=[]
        for ch in anim['channels']:
            sampler=anim['samplers'][ch['sampler']]
            a=g['accessors'][sampler['output']]; v=g['bufferViews'][a['bufferView']]
            assert 'byteStride' not in v and a['componentType']==5126
            size={'VEC3':3,'VEC4':4}[a['type']]
            arr=struct.unpack_from('<'+'f'*a['count']*size,binary,v.get('byteOffset',0)+a.get('byteOffset',0))
            assert all(math.isfinite(x) for x in arr)
            node=g['nodes'][ch['target']['node']]['name']
            assert node!=glb_root['name']
            amplitude=max(abs(x-arr[i%size]) for i,x in enumerate(arr))
            seams.append(max(abs(arr[i]-arr[-size+i]) for i in range(size)))
            if amplitude>1e-5: varying.append({'node':node,'path':ch['target']['path'],'amplitude':amplitude})
        assert varying and max(seams)<1e-5
        clips[anim['name']]={'varyingChannels':varying,'maximumFirstLastComponentDifference':max(seams)}
    assert set(clips)==set(native['clips'])
    r={'asset':asset,'glbSha256':native['exportSha256'],'blenderImportVersion':bpy.app.version_string,'build':bpy.app.build_hash.decode(),
       'glbBytes':len(b),'editableNativeMeshCount':len(native['editableMeshes']),'packedRigidMeshes':len(meshes),
       'runtimeMaterialPrimitives':browser['draws'],'triangles':triangles,'textureBytes':0,'externalResources':[],'clips':clips,
       'stableFloorRoot':glb_root['name'],'sourceAndGlbTriangleParity':True,'reimportedMaterials':[m['name'] for m in g['materials']]}
    (raw/f'{asset}-import.json').write_text(json.dumps(r,indent=2)+'\n')
    print('T107 import',asset,triangles,len(meshes),len(clips))
