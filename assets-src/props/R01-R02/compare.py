# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compare evaluated native geometry to independently imported GLB geometry by material region."""
from collections import Counter
import hashlib
import json
import math
from pathlib import Path
import sys

import bpy

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'assets-src/characters/t109'))
import sculpt


def inspect(objects):
    graph=bpy.context.evaluated_depsgraph_get()
    areas=Counter()
    triangles=Counter()
    materials={}
    points=[]
    for obj in objects:
        e=obj.evaluated_get(graph)
        mesh=e.data
        mesh.calc_loop_triangles()
        verts=[e.matrix_world @ v.co for v in mesh.vertices]
        assert all(math.isfinite(x) for pt in verts for x in pt)
        points.extend(verts)
        for tri in mesh.loop_triangles:
            mat=mesh.materials[tri.material_index]
            shader=next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
            materials[mat.name]=list(shader.inputs['Base Color'].default_value)
            a,b,c=[verts[i] for i in tri.vertices]
            areas[mat.name]+=(b-a).cross(c-a).length/2
            triangles[mat.name]+=1
    return dict(trianglesByMaterial=dict(sorted(triangles.items())),areaByMaterialM2=dict(sorted(areas.items())),
                baseColorByMaterial=dict(sorted(materials.items())),bounds=sculpt.bounds(objects))


for number in range(11,21):
    asset=f'PR{number:03}'
    folder=ROOT/'docs/evidence/spec001/prop-production/T110'/asset
    known=json.loads((folder/'native.json').read_text())
    source=ROOT/known['sourcePath']
    glb=ROOT/known['exportPath']
    assert hashlib.sha256(source.read_bytes()).hexdigest()==known['sourceSha256']
    assert hashlib.sha256(glb.read_bytes()).hexdigest()==known['exportSha256']
    bpy.ops.wm.open_mainfile(filepath=str(source))
    source_model=inspect([o for o in bpy.data.objects[asset+'_pivot'].children_recursive if o.type=='MESH'])
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(glb))
    actual=inspect([o for o in bpy.context.scene.objects if o.type=='MESH'])
    assert actual['trianglesByMaterial']==source_model['trianglesByMaterial'],asset
    assert actual['baseColorByMaterial']==source_model['baseColorByMaterial'],asset
    area_error=max(abs(v-actual['areaByMaterialM2'][k]) for k,v in source_model['areaByMaterialM2'].items())
    bound_error=max(abs(a-b) for loop_a,loop_b in zip(actual['bounds'],source_model['bounds']) for a,b in zip(loop_a,loop_b))
    assert area_error<.0001 and bound_error<.00002,(asset,area_error,bound_error)
    result={'asset':asset,'sourceSha256':known['sourceSha256'],'exportSha256':known['exportSha256'],
            'blender':bpy.app.version_string,'build':bpy.app.build_hash.decode(),
            'inspections':['Reopened current .blend','Cleared Blender to factory empty scene','Imported GLB from disk'],
            'native':source_model,'imported':actual,'maximumMaterialRegionAreaErrorM2':area_error,'maximumBoundsErrorMetres':bound_error}
    (folder/'reimport.json').write_text(json.dumps(result,indent=2)+'\n')
