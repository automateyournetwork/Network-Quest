# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Fresh-process native inspection, studio render and static material batching for GLB."""
import hashlib
import json
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from parts import *

src=Path(bpy.data.filepath)
code=src.stem
assert src==DIR/(code+'.blend') and 81<=int(code[2:])<=100
sc=bpy.context.scene
assert sc.unit_settings.system=='METRIC' and sc.unit_settings.scale_length==1
rig=bpy.data.objects[code+' floor origin']
assert tuple(rig.location)==(0,0,0)
meshes=sorted((o for o in sc.objects if o.type=='MESH'),key=lambda o:o.name)
lo,hi=bounds(meshes)
assert abs(lo.z)<1e-5
deps=bpy.context.evaluated_depsgraph_get()
def triangles(o):
    m=o.evaluated_get(deps).data
    m.calc_loop_triangles()
    return len(m.loop_triangles)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def rel(p): return str(p.relative_to(ROOT))
materials_used=sorted({s.material.name for o in meshes for s in o.material_slots})
info=dict(id=code,version=bpy.app.version_string,build=bpy.app.build_hash.decode(),source=rel(src),
          sourceSha256=sha(src),sourceBytes=src.stat().st_size,editableMeshes={o.name:triangles(o) for o in meshes},
          materials=materials_used,units='metres',origin=list(rig.location),nativeQuaternionWXYZ=list(rig.rotation_euler.to_quaternion()),
          nativeBounds=[list(lo),list(hi)],camera=list(sc.camera.location),focus=list(sc['focus']),span=sc.camera.data.ortho_scale,
          axes='Blender Z-up, front -Y; GLB Y-up, front +Z',imageDependencies=[i.name for i in bpy.data.images if i.filepath],
          rig=rig.name,fixtureScale=sc['fixtureScale'])
image_path=RAW/(code+'-native.png')
sc.render.filepath=str(image_path)
bpy.ops.render.render(write_still=True)
info['nativeRenderSha256']=sha(image_path)
# Apply modifiers and combine decorative parts in memory. Preserve the authored native file.
bpy.ops.object.select_all(action='DESELECT')
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
joined=bpy.context.view_layer.objects.active
joined.name=code+' enamel and hardware'
joined['assetId']='spec001:ASSET-'+code
for o in sc.objects:
    o.select_set(o.type in ('MESH','EMPTY'))
dest=ROOT/('public/assets/models/'+code+'.glb')
bpy.ops.export_scene.gltf(filepath=str(dest),export_format='GLB',use_selection=True,export_animations=False,
                          export_yup=True,export_apply=True,export_cameras=False,export_lights=False,
                          export_extras=True,export_materials='EXPORT',export_texcoords=False,export_tangents=False)
info.update(export=rel(dest),exportSha256=sha(dest),exportBytes=dest.stat().st_size)
assert sha(src)==info['sourceSha256']
(RAW/(code+'-native.json')).write_text(json.dumps(info,indent=2)+'\n')
