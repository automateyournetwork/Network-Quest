# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Reopen one native file in a fresh Blender process, inspect poses and export its optimized GLB.
The join below affects a transient copy in memory. The source retains all named components.
"""
import hashlib
import json
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import bpy
from mathutils import Vector
import sculpt as s

source=Path(bpy.data.filepath)
asset=source.stem
assert asset in ['CH'+str(i) for i in range(18,26)]
out=s.ROOT/'docs/evidence/spec001/character-production/T109'/asset
out.mkdir(exist_ok=True,parents=True)
scratch=s.ROOT/'.local/t109/render'/asset
scratch.mkdir(exist_ok=True,parents=True)
sc=bpy.context.scene
root=bpy.data.objects[asset+'_pivot']
nodes=[root,*root.children_recursive]
meshes=[o for o in nodes if o.type=='MESH']
joints=[o for o in nodes if o.animation_data]
rest={o:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in joints}
clips={t.name:int(t.strips[0].frame_end) for o in joints for t in o.animation_data.nla_tracks}
assert set(clips)==({'idle','reaction','ability'} if asset in ('CH19','CH20','CH22') else {'idle','reaction'})

def pose(name=None,f=0):
    for o in joints:
        for tr in o.animation_data.nla_tracks: tr.mute=True
        o.location,o.rotation_euler,o.scale=rest[o]
    for o in joints:
        for tr in o.animation_data.nla_tracks: tr.mute=tr.name!=name
    sc.frame_set(int(f),subframe=f%1)
    bpy.context.view_layer.update()


def capture(label):
    sc.render.filepath=str(scratch/(label+'.png'))
    bpy.ops.render.render(write_still=True)


def stats():
    dg=bpy.context.evaluated_depsgraph_get()
    count=0
    for obj in meshes:
        m=obj.evaluated_get(dg).data
        m.calc_loop_triangles()
        count+=len(m.loop_triangles)
    return count


def matrix(o):
    return [round(v,8) for row in o.matrix_world for v in row]

pose()
center=Vector(sc['studioCenter'])
cam=sc.camera
original=cam.location.copy(),cam.rotation_euler.copy()
capture('source')
for label,direction in [('front',(0,-1,0)),('side',(1,0,0))]:
    cam.location=center+Vector(direction)*sc['studioSpan']*3
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler()
    capture(label)
cam.location,cam.rotation_euler=original
report={
 'assetId':'spec001:ASSET-'+asset,'nativeSource':str(source.relative_to(s.ROOT)),
 'nativeSourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),
 'blender':bpy.app.version_string,'build':bpy.app.build_hash.decode(),
 'inspection':'Fresh background Blender process; current file opened from disk, evaluated and rendered.',
 'units':'metres','axis':'Blender (x,y,z) → glTF (x,z,-y); forward -Y / +Z.',
 'root':root.name,'restRootMatrix':matrix(root),'dimensionsBasis':'World positions of evaluated mesh vertices.',
 'restBoundsBlender':s.bounds(meshes),'studioCenter':list(center),'studioSpan':sc['studioSpan'],
 'studioCameraBlender':list(cam.location),'authorObjects':sorted(o.name for o in meshes),
 'materials':sorted({m.name for o in meshes for m in o.data.materials if m}),
 'triangles':stats(),'fps':sc.render.fps,'clips':{},
}
# The background viewport can keep stale matrices for hidden rig dependencies.
# Capture the graph actually consumed by Cycles, including fractional frames.
current=None
def render_pose(scene,dg):
    if current is None or dg.mode!='RENDER': return
    pts=[]
    for obj in meshes:
        m=obj.evaluated_get(dg)
        pts.extend(m.matrix_world@v.co for v in m.data.vertices)
    current.update({
        'frame':scene.frame_current+scene.frame_subframe,
        'joints':{o.name:matrix(o.evaluated_get(dg)) for o in joints},
        'boundsBlender':[[min(v[i] for v in pts) for i in range(3)],[max(v[i] for v in pts) for i in range(3)]],
        'root':matrix(root.evaluated_get(dg)),
    })
bpy.app.handlers.frame_change_post.append(render_pose)
for clip,frames in clips.items():
    data={'lastFrame':frames,'contactFrame':frames//2 if clip=='ability' else None,
          'seconds':frames/24,'poses':{}}
    for frac in [0,.25,.5,.75,1]:
        f=frames*frac
        pose(clip,f)
        current={}
        illustrated=frac==(.25 if clip=='idle' else .5)
        sc.render.resolution_percentage=100 if illustrated else 8
        sc.cycles.samples=12 if illustrated else 1
        if illustrated:capture(clip)
        else:bpy.ops.render.render()
        assert current and abs(current['frame']-f)<.001,(asset,clip,frac,current)
        data['poses'][str(frac)]=current
        current=None
    report['clips'][clip]=data
bpy.app.handlers.frame_change_post.remove(render_pose)
sc.render.resolution_percentage=100
sc.cycles.samples=12
pose()
# Bake evaluated bevel/normal modifiers, then join geometry by rigid parent to reduce draw overhead.
parents=sorted({o.parent for o in meshes},key=lambda o:o.name)
for parent in parents:
    children=[o for o in parent.children if o.type=='MESH']
    bpy.ops.object.select_all(action='DESELECT')
    for o in children:o.select_set(True)
    bpy.context.view_layer.objects.active=children[0]
    bpy.ops.object.convert(target='MESH')
    active=bpy.context.view_layer.objects.active
    if len(children)>1: bpy.ops.object.join()
    active.name=parent.name+' shell'
bpy.ops.object.select_all(action='DESELECT')
for o in [root,*root.children_recursive]:o.select_set(True)
bpy.context.view_layer.objects.active=root
glb=s.MODELS/(asset+'.glb')
bpy.ops.export_scene.gltf(filepath=str(glb),export_format='GLB',use_selection=True,export_yup=True,
    export_extras=True,export_cameras=False,export_lights=False,export_apply=True,
    export_texcoords=False,export_tangents=False,export_materials='EXPORT',
    export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,
    export_frame_range=False,export_optimize_animation_size=True)
report['exportPath']=str(glb.relative_to(s.ROOT))
report['exportSha256']=hashlib.sha256(glb.read_bytes()).hexdigest()
report['exportMeshesAfterRigidJoin']=len([o for o in root.children_recursive if o.type=='MESH'])
(out/'native.json').write_text(json.dumps(report,indent=2)+'\n')
print('T109 REOPENED',asset,report['triangles'],report['exportMeshesAfterRigidJoin'],flush=True)
