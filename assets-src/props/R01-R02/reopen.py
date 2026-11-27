# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run in a fresh Blender process with a .blend as input. Export the reopened geometry."""
import hashlib
import json
import sys
from pathlib import Path
import bpy

ROOT=Path(__file__).resolve().parents[3]
sys.path.insert(0,str(ROOT/'assets-src/characters/t109'))
import sculpt

source=Path(bpy.data.filepath)
asset=source.stem
out=ROOT/'docs/evidence/spec001/prop-production/T110'/asset
out.mkdir(parents=True,exist_ok=True)
assert asset in {'PR%03d'%i for i in range(11,21)}
root=bpy.data.objects[asset+'_pivot']
meshes=[o for o in root.children_recursive if o.type=='MESH']
scene=bpy.context.scene
scene.render.filepath=str(out/'native.png')
bpy.ops.render.render(write_still=True)

def triangles(mesh):
    mesh.calc_loop_triangles()
    return len(mesh.loop_triangles)

def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

dg=bpy.context.evaluated_depsgraph_get()
report={'asset':asset,'blender':bpy.app.version_string,'build':bpy.app.build_hash.decode(),
        'sourcePath':str(source.relative_to(ROOT)),'sourceSha256':sha(source),'sourceBytes':source.stat().st_size,
        'meshObjects':sorted(o.name for o in meshes),
        'materials':sorted({mat.name for o in meshes for mat in o.data.materials}),
        'triangles':sum(triangles(o.evaluated_get(dg).data) for o in meshes),'bounds':sculpt.bounds(meshes),
        'nativeCaptureSha256':sha(out/'native.png'),'camera':list(scene.camera.location),
        'center':list(scene['studioCenter']),'span':scene['studioSpan'],'units':'metres',
        'nativeQuaternionWXYZ':list(root.matrix_world.to_quaternion()),
        'rootLocation':list(root.location),'rootScale':list(root.scale),'axes':'Blender -Y forward, Z up',
        'frozenEnvelopeWidthDepthHeight':list(scene['candidateEnvelopeMetres'])}
# Bake modifiers only in this export process. All working pieces remain editable on disk.
bpy.ops.object.select_all(action='DESELECT')
for obj in meshes:
    obj.select_set(True)
bpy.context.view_layer.objects.active=meshes[0]
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
joined=bpy.context.object
joined.name=asset+' workshop assembly'
root.select_set(True)
glb=ROOT/'public/assets/models/R02'/(asset+'.glb')
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,
                          export_apply=True,export_extras=True,export_animations=False,
                          export_lights=False,export_cameras=False,export_texcoords=False,export_tangents=False)
report.update(exportPath=str(glb.relative_to(ROOT)),exportSha256=sha(glb),exportBytes=glb.stat().st_size)
(out/'native.json').write_text(json.dumps(report,indent=2)+'\n')
