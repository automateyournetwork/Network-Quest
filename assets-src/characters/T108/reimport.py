# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Freshly import the final GLBs and cross-check the offline and Firefox mesh totals."""
import json,sys,struct,hashlib
from pathlib import Path
import bpy
base=Path(__file__).resolve().parents[3]
reports=base/'docs/evidence/spec001/character-production/T108'
for asset in sys.argv[sys.argv.index('--')+1:]:
    path=base/'public/assets/models'/f'{asset}.glb'
    data=path.read_bytes()
    magic,version,total=struct.unpack_from('<4sII',data)
    assert (magic,version,total)==(b'glTF',2,len(data))
    jl,jt=struct.unpack_from('<I4s',data,12)
    bl,bt=struct.unpack_from('<I4s',data,20+jl)
    doc=json.loads(data[20:20+jl])
    assert jt==b'JSON' and bt==b'BIN\0' and 28+jl+bl==len(data)
    assert len(doc['buffers'])==1 and 'uri' not in doc['buffers'][0] and not doc.get('images')
    for view in doc['bufferViews']:
        assert view['buffer']==0 and view.get('byteOffset',0)+view['byteLength']<=bl
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(path))
    meshes=[o for o in bpy.context.scene.objects if o.type=='MESH']
    triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons) for o in meshes)
    native=json.loads((reports/f'{asset}-native.json').read_text())
    browser=json.loads((reports/f'{asset}-browser.json').read_text())
    assert triangles==browser['triangles']
    colors={m['name']:m['pbrMetallicRoughness'] for m in doc['materials']}
    assert set(colors)==set(native['materials'])
    assert {x['name'] for x in doc['animations']}==set(native['clips'])
    stats={'glbSha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'blender':bpy.app.version_string,
           'blenderImportedMeshes':len(meshes),'triangles':triangles,'materials':colors,'embeddedBufferBytes':bl,
           'textures':0,'drawPrimitives':sum(len(m['primitives']) for m in doc['meshes']),
           'editableShapeCount':sum(map(len,native['rigidPartSources'].values())),'exportRigidMeshes':len(doc['meshes']),
           'actionNames':sorted(a.name for a in bpy.data.actions),'gltfClipNames':sorted(native['clips']),
           'exportObjectIds':[n['name'] for n in doc['nodes']],
           'nonModelNodes':sum(1 for n in doc['nodes'] if 'camera' in n or 'KHR_lights_punctual' in n.get('extensions',{}))}
    assert stats['nonModelNodes']==0 and stats['drawPrimitives']==browser['draws']
    (reports/f'{asset}-import.json').write_text(json.dumps(stats,indent=2)+'\n')
