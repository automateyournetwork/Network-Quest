# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run on a saved .blend in a fresh Blender. Render poses, join rigid parts only in memory, export."""
from pathlib import Path
from mathutils import Matrix, Vector
import bpy
import hashlib
import json
import sys

sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from model import ROOT, OUT, LOCAL, bounds

RAW=ROOT/'docs/evidence/spec001/character-production/T107'
RAW.mkdir(parents=True,exist_ok=True)
source=Path(bpy.data.filepath)
asset=source.stem
assert asset in {'CH02','CH04','CH05','CH06','CH07','CH08','CH09'}
assert source == ROOT/f'assets-src/characters/{asset}.blend'
sc=bpy.context.scene
joints=[o for o in sc.objects if o.type=='EMPTY']
meshes=[o for o in sc.objects if o.type=='MESH']
baseline={o:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in joints}
geometry={}
for obj in meshes:
    obj.data.calc_loop_triangles()
    geometry[obj.name]=len(obj.data.loop_triangles)
def sha(p): return hashlib.sha256(p.read_bytes()).hexdigest()
def relative(path): return str(path.relative_to(ROOT))
def frame(when):
    sc.frame_set(int(when),subframe=when-int(when))
def render(path):
    sc.render.filepath=str(path)
    bpy.ops.render.render(write_still=True)
def measure():
    return [list(v) for v in bounds()]
def muted():
    for o,(loc,rot,scale) in baseline.items():
        if o.animation_data:
            for track in o.animation_data.nla_tracks: track.mute=True
        o.location=loc.copy();o.rotation_euler=rot.copy();o.scale=scale.copy()
    frame(0)

# Blender Z-up, -Y forward -> glTF Y-up, +Z forward.
C=Matrix(((1,0,0,0),(0,0,1,0),(0,-1,0,0),(0,0,0,1)))
def runtime_matrix(matrix):
    return list(v for column in (C @ matrix @ C.transposed()).transposed() for v in column)
tracks={track.name:int(track.strips[0].frame_end) for o in joints if o.animation_data for track in o.animation_data.nla_tracks}
muted()
restbounds=measure()
render(OUT/f'{asset}-source.png')
camera=sc.camera
camera_report={'runtimePosition':list((C @ camera.matrix_world).translation),'span':camera.data.ortho_scale,
               'runtimeTarget':[(restbounds[0][i]+restbounds[1][i])/2*sign for i,sign in [(0,1),(2,1),(1,-1)]]}
report={'asset':asset,'blender':bpy.app.version_string,'build':bpy.app.build_hash.decode(),'source':relative(source),'sourceSha256':sha(source),'editableMeshes':geometry,
        'unitScaleMetres':sc.unit_settings.scale_length,'fps':sc.render.fps,'blenderRestBounds':restbounds,'runtimeCamera':camera_report,'clips':{}}
reference={}
capture={}
def record_render_graph(scene,graph):
    if graph.mode!='RENDER' or not capture: return
    capture['matrices']={o.name:runtime_matrix(o.evaluated_get(graph).matrix_world) for o in joints}
    evaluated=[o.evaluated_get(graph) for o in meshes]
    points=[o.matrix_world@v.co for o in evaluated for v in o.data.vertices]
    capture['bounds']=[[fn(p[i] for p in points) for i in range(3)] for fn in (min,max)]
bpy.app.handlers.frame_change_post.append(record_render_graph)
report['nativeMaterials']={slot.material.name:{'linearBaseColor':list(slot.material.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value)[:3],
    'metallic':slot.material.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value,'roughness':slot.material.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value}
    for obj in meshes for slot in obj.material_slots}
for name,end in tracks.items():
    muted()
    for o in joints:
        if o.animation_data:
            for track in o.animation_data.nla_tracks: track.mute=track.name!=name
    ref={};envelope=[]
    for fraction in [0,.25,.5,.75,1]:
        frame(end*fraction)
        selected=fraction==(.25 if name=='idle' else .5)
        capture.clear();capture['active']=True
        sc.render.resolution_percentage=100 if selected else 6
        render(LOCAL/(f'{asset}-{name}-source.png' if selected else 'matrix-sample.png'))
        assert 'matrices' in capture
        ref[str(fraction)]=capture['matrices']
        envelope.append(capture['bounds'])
        capture.clear()
    reference[name]=ref
    sc.render.resolution_percentage=100
    report['clips'][name]={'frames':end,'seconds':end/sc.render.fps,'sampleFractions':[0,.25,.5,.75,1],'blenderSampledBounds':envelope}
bpy.app.handlers.frame_change_post.remove(record_render_graph)
muted()
# Keep individual plates, fingers and feathers editable in the file. Only merge
# orthogonally static meshes sharing the very same rigid parent in this export.
for parent in joints:
    children=[o for o in parent.children if o.type=='MESH']
    if not children: continue
    bpy.ops.object.select_all(action='DESELECT')
    for child in children: child.select_set(True)
    bpy.context.view_layer.objects.active=children[0]
    if len(children)>1: bpy.ops.object.join()
    obj=bpy.context.view_layer.objects.active
    obj.name=parent.name+'_surface'

bpy.ops.object.select_all(action='DESELECT')
for obj in sc.objects:
    if obj.type in ('MESH','EMPTY'): obj.select_set(True)
glb=ROOT/f'public/assets/models/{asset}.glb'
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,
                          export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT')
report['export']=relative(glb);report['exportSha256']=sha(glb);report['exportBytes']=glb.stat().st_size
(RAW/f'{asset}-native.json').write_text(json.dumps(report,indent=2)+'\n')
(LOCAL/f'{asset}-matrices.json').write_text(json.dumps(reference)+'\n')
print('T107 REOPEN',asset,sum(geometry.values()),len(geometry),tracks,report['exportBytes'])
