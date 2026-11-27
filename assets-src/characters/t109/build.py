# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run with Blender --background --threads 2 --python build.py -- CH20."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import cast
import sculpt as s
import bpy
from mathutils import Vector

CHARACTERS={'CH18':('serpent',1.65),'CH19':('eel',1.1),'CH20':('bat',1.5),'CH21':('golem',2),'CH22':('chameleon',.8),'CH23':('demon',1.4),'CH24':('twins',1.4),'CH25':('backhoe',3.2)}

def build(asset):
    name,height=CHARACTERS[asset]
    root=s.reset(asset)
    shape=s.group('metre calibration',parent=root)
    getattr(cast,name)(shape)
    bpy.context.view_layer.update()
    lo,hi=s.bounds(shape.children_recursive)
    scale=height/(hi[2]-lo[2])
    shape.scale=(scale,)*3
    shape.location=((-.5*(hi[0]+lo[0]))*scale,(-.5*(hi[1]+lo[1]))*scale,-lo[2]*scale)
    bpy.context.view_layer.update()
    lo,hi=s.bounds(shape.children_recursive)
    middle=(Vector(lo)+Vector(hi))*.5
    span=max(hi[0]-lo[0],hi[1]-lo[1],height)*1.25
    views={'CH22':(-.65,-1,.30),'CH19':(.08,-1,.36),'CH18':(.25,-1,.24)}
    s.studio(middle,span,views.get(asset,(.42,-1,.26)))
    sc=bpy.context.scene
    sc['studioCenter']=list(middle);sc['studioSpan']=span
    sc['axis']='Local -Y forward, Z up. glTF Y up; stationary ground-centred root.'
    sc.frame_start=0;sc.frame_end=96
    root['assetId']='spec001:ASSET-'+asset
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_distance=span*1.6
            area.spaces.active.region_3d.view_location=middle
            area.spaces.active.region_3d.view_rotation=sc.camera.rotation_euler.to_quaternion()
            area.spaces.active.shading.color_type='MATERIAL'
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True);bpy.context.view_layer.objects.active=root
    bpy.ops.wm.save_as_mainfile(filepath=str(s.SOURCE/(asset+'.blend')),compress=True)
    sc.render.filepath=str(s.ROOT/'.local/t109/render'/(asset+'-first.png'))
    bpy.ops.render.render(write_still=True)
    print('T109 native saved and first render',asset,flush=True)

for asset in sys.argv[sys.argv.index('--')+1:]: build(asset)
