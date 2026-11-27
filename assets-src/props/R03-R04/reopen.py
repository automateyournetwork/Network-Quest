# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Fresh process opens one native asset, measures and renders it, then flattens static surfaces for GLB."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from workshop import *
import json, hashlib
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def runtime(v):return [v[0],v[2],-v[1]]
src=Path(bpy.data.filepath);asset=src.stem;scene=bpy.context.scene
assert src==HERE/(asset+'.blend')
root=scene.objects[asset]
assert all(abs(root.matrix_world[r][c] - (1 if r == c else 0)) < 1e-6 for r in range(4) for c in range(4))
objects=list(root.children)
assert all(o.type=='MESH' and not o.modifiers for o in objects)
pts=[obj.matrix_world@v.co for obj in objects for v in obj.data.vertices]
bounds=[[round(f(p[i] for p in pts),7) for i in range(3)] for f in [min,max]]
assert abs(bounds[0][2])<1e-6
tri={}
for obj in objects:
    obj.data.calc_loop_triangles();tri[obj.name]=len(obj.data.loop_triangles)
materials={}
for obj in objects:
    for mat in obj.data.materials:
        inputs=mat.node_tree.nodes['Principled BSDF'].inputs
        materials[mat.name]={'linearBaseColor':list(inputs['Base Color'].default_value)[:3],
                             'metallic':inputs['Metallic'].default_value,'roughness':inputs['Roughness'].default_value,'alpha':inputs['Alpha'].default_value}
shot=RAW/(asset+'-source.png')
scene.render.filepath=str(shot);bpy.ops.render.render(write_still=True)
# The native contains individual modeled pieces; flatten only in the export process.
bpy.ops.object.select_all(action='DESELECT')
for o in objects:o.select_set(True)
bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join()
joined=bpy.context.view_layer.objects.active;joined.name=asset+' workshop surfaces';root.select_set(True)
out=GLBS/(asset+'.glb')
bpy.ops.export_scene.gltf(filepath=str(out),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,
                          export_apply=True,export_animations=False,export_cameras=False,export_lights=False,export_materials='EXPORT')
native={'id':asset,'title':root['title'],'blender':bpy.app.version_string,'build':bpy.app.build_hash.decode(),'sourceSha256':sha(src),'glbSha256':sha(out),
        'sourceBytes':src.stat().st_size,'glbBytes':out.stat().st_size,'sourceRenderSha256':sha(shot),'projectUnits':scene.unit_settings.system,
        'unitScale':scene.unit_settings.scale_length,'localForward':'-Y','rootTransform':list(v for row in root.matrix_world for v in row),
        'boundsXYZ':bounds,'dimensionsXYZ':[round(bounds[1][i]-bounds[0][i],6) for i in range(3)],'triangles':sum(tri.values()),'editableMeshes':tri,'materials':materials,
        'runtimeCamera':{'runtimeTarget':runtime(scene['comparisonTarget']),'runtimePosition':runtime(scene.camera.location),'span':scene.camera.data.ortho_scale}}
(RAW/(asset+'-native.json')).write_text(json.dumps(native,indent=2)+'\n')
print('REOPENED',asset,native['triangles'],len(objects),flush=True)
