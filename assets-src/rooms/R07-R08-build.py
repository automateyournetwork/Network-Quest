# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Construct the Skywell survey ledge or the Storm Observatory at the registered camera."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

base = Path(__file__).resolve().parents[2]
code = sys.argv[sys.argv.index('--') + 1]
assert code in ('R07', 'R08')
sky = code == 'R07'
def read(path):
    return json.loads((base / path).read_bytes())
def native(xyz):
    return Vector((xyz[0], -xyz[2], xyz[1]))

room = read(f'content/spec001/rooms/{code}.json')
stage = read(f'content/spec001/presentation/{code}.json')
bindings = {b['assetId']: b['exportPath'] for b in room['mediaBindings']}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = 'Skywell survey ledge' if sky else 'Storm Observatory'
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1024, 576, 100
scene.render.engine = 'CYCLES'
scene.cycles.samples = 16
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.view_settings.view_transform = 'Standard'
scene.world = bpy.data.worlds.new('Cliff bounce' if sky else 'Rain under glass')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (.57,.49,.42,1) if sky else (.43,.53,.61,1)
bg.inputs['Strength'].default_value = .65

def collection(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

def move(obj, dest):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    dest.objects.link(obj)

fabric = collection('Built fabric and local practicals')
optics = collection('Camera, light and registered image layers')
survey = collection('Semantic targets and party berths')

def material(name, color, metal, rough):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes['Principled BSDF']
    shader.inputs['Base Color'].default_value = (*color,1)
    shader.inputs['Metallic'].default_value = metal
    shader.inputs['Roughness'].default_value = rough
    return mat

rock = material('Cliff-cut warm basalt' if sky else 'Rain-washed blue slate', (.24,.147,.092) if sky else (.054,.080,.092), .13, .83 if sky else .31)
edge = material('Oxidized steel' if sky else 'Verdigris channel metal', (.16,.126,.088) if sky else (.082,.168,.165), .54,.48)
brass = material('Brushed brass fasteners',(.42,.264,.107),.69,.41)
wet = material('Wet glazed inset',(.073,.109,.127),.42,.18)
def finish(obj, name, mat, bevel):
    obj.name = name
    obj.data.materials.append(mat)
    move(obj, fabric)
    if bevel:
        m = obj.modifiers.new('Edge finish','BEVEL')
        m.width, m.segments = bevel, 2
        obj.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
    return obj

def slab(name, pos, size, mat, bevel=.015):
    bpy.ops.mesh.primitive_cube_add(size=1,location=native(pos))
    o = bpy.context.object
    o.dimensions = (size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(o,name,mat,bevel)

def disc(name, pos, radius, height, mat, count=24):
    bpy.ops.mesh.primitive_cylinder_add(vertices=count,radius=radius,depth=height,location=native(pos))
    return finish(bpy.context.object,name,mat,min(.012,height*.18))

placement = {}
for m in stage['models'][1:]:
    short = m['semanticId'].split(':')[1]
    dest = collection(short+' • placement')
    original = set(bpy.data.objects)
    path = bindings[m['assetId']]
    bpy.ops.import_scene.gltf(filepath=str(base / path))
    loaded = set(bpy.data.objects) - original
    root = bpy.data.objects.new(short+' placement',None)
    dest.objects.link(root)
    for o in loaded:
        if not o.parent:
            o.parent = root
        move(o,dest)
    root.location = native(m['position'])
    root.rotation_euler.z = m.get('rotation',[0,0,0])[1]
    root['sourcePath'] = path
    placement[short] = m['position']

if sky:
    # Individual corbelled seats follow the lip under the actual back-row equipment.
    for id,w,d in [('PR061',2.05,1.24),('PR062',2.02,1.21),('PR064',1.47,1.10),
                   ('PR065',1.14,.94),('PR068',1.52,.92)]:
        x,_,z = placement[id]
        slab(id+' • foundation shoulder',(x,-.16,z),(w-.16,.29,d-.07),rock,.068)
        slab(id+' • bolted equipment sill',(x,-.035,z),(w,.068,d),edge,.029)
        for sign in (-1,1):
            disc('Seat anchor',(x+sign*(w*.5-.12),.003,z+d*.5-.10),.051,.012,brass,8)
    for x,z,length in [(1.17,-.20,.98),(3.45,.04,1.18),(8.11,-.51,1.60)]:
        slab('Cliff ledge • masonry return',(x,-.24,z),(length,.47,.20),rock,.042)
else:
    # The stone insets follow the equipment and reflect window light on their damp surfaces.
    for id,r in [('PR071',.77),('PR072',.72),('PR073',.68),('PR075',.70),('PR077',.74),('PR079',.64),('PR080',.91)]:
        x,_,z = placement[id]
        disc(id+' • verdigris surround',(x,-.047,z),r+.07,.082,edge)
        disc(id+' • wet instrument plinth',(x,-.012,z),r,.024,rock)
    for i in range(7):
        slab('Perimeter slot drain',(1.70+i*.32,-.005,5.85),(.26,.015,.083),wet,.010)
    # A real rain shutter in the half-round vent behind the instruments.
    x,y,z = 10.49,1.76,-1.25
    slab('Rain vent • sill',(x,y-.56,z),(1.69,.10,.29),edge)
    slab('Rain vent • lintel',(x,y+.56,z),(1.69,.10,.29),edge)
    for sign in (-1,1):
        slab('Rain vent • jamb',(x+sign*.78,y,z),(.10,1.06,.28),edge)
        panel = slab('RainShutterLeft' if sign<0 else 'RainShutterRight',
             (x+sign*.55,y,z),(.42,.96,.074),edge,.018)
        for row in range(4):
            louvre = slab('Vent louvre',(x+sign*.55,y-.31+row*.21,z+.05),(.32,.034,.075),brass,.008)
            louvre.parent = panel
            louvre.matrix_parent_inverse = panel.matrix_world.inverted()
        slab('Rain vent • footing',(x+sign*.75,.58,z),(.11,1.15,.12),edge)
    # An index travels along the two equally sized desk positions; it reproduces the selected label.
    x,y,z=placement['PR080']
    slab('Channel selector • track',(x,.614,z+.332),(.80,.039,.073),edge,.009)
    slab('ChannelPointer',(x-.28,.659,z+.332),(.072,.065,.073),brass,.009)
    x,y,z=placement['PR072']
    slab('Emitter switch witness • hinge',(x+.507,.40,z+.16),(.085,.048,.081),edge,.009)
    slab('IsolationPointer',(x+.507,.47,z+.16),(.067,.127,.065),brass,.010)
for target in [a for a in stage['anchors'] if a['objectId'].startswith('exit:')]:
    x,_,z = target['position']
    for i in range(3):
        strip = slab('Exit • flush tread',(x+(1 if x<5 else -1)*i*.15,.002,z),(.062,.012,.56-i*.09),brass,.005)
        strip['objectId'] = target['objectId']

def lamp(name, kind, position, color, energy, size, aim=None):
    light = bpy.data.lights.new(name,kind)
    o = bpy.data.objects.new(name,light)
    (optics if aim else fabric).objects.link(o)
    o.location=native(position)
    light.color,light.energy=color,energy
    if aim:
        light.shape,light.size='DISK',size
        o.rotation_euler=(native(aim)-o.location).to_track_quat('-Z','Y').to_euler()
    else:
        light.shadow_soft_size=size

if sky:
    lamp('Late sun across the rim','AREA',[-1,8,-3],(1,.71,.47),1450,5,[5,.8,2])
    lamp('Open sky fill','AREA',[10,7,5],(.71,.86,1),830,6,[5,.8,2])
    lamp('Cliff • reflected ochre','POINT',[3,4,-1.5],(1,.66,.39),2.1,.65)
    lamp('Mast • high sky bounce','POINT',[8.5,3,.5],(.64,.83,1),1.0,.62)
else:
    lamp('North rain window','AREA',[1,7,-2],(.61,.83,1),1400,5,[5,.5,3])
    lamp('Copper dome bounce','AREA',[9,6,5],(1,.85,.70),880,5,[5,.7,3])
    lamp('Rain window • cool practical','POINT',[3.9,3,-.8],(.56,.84,1),1.8,.8)
    lamp('Wet brass • warm practical','POINT',[8.5,3,4],(1,.78,.56),.87,.6)

for name,p in [(a['objectId'],a['position']) for a in stage['anchors']]+[
        ('Companion berth '+str(i+1),p) for i,p in enumerate(stage['partyPositions'])]:
    o=bpy.data.objects.new(name,None)
    survey.objects.link(o)
    o.empty_display_type,o.empty_display_size,o.location='CIRCLE',.10,native(p)

cam=stage['camera']
bpy.ops.object.camera_add(location=native(cam['position']))
camera=bpy.context.object
move(camera,optics)
camera.name=scene.name+' • registered'
camera.rotation_euler=(native(cam['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type,camera.data.ortho_scale='ORTHO',cam['plateSpan'][0]
camera.data.clip_start,camera.data.clip_end=cam['near'],cam['far']
scene.camera=camera
bpy.ops.mesh.primitive_plane_add(size=36,location=native([5,-.006,3]))
catcher=bpy.context.object
move(catcher,optics)
catcher.name='Ground • contact receiver'
catcher.is_shadow_catcher=True
bpy.ops.object.select_all(action='DESELECT')
for o in fabric.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active=fabric.objects[0]
bpy.ops.export_scene.gltf(filepath=str(base/f'public/assets/models/{code}-architecture.glb'),export_format='GLB',use_selection=True,export_lights=True,export_extras=True,export_animations=False)
tree=bpy.data.node_groups.new('Near edges over live cast over registered scenery','CompositorNodeTree')
tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
scene.compositing_node_group=tree
camera.data.show_background_images=True
result=None
for name in ('background','midground','focal','foreground'):
    if name=='focal':
        node=tree.nodes.new('CompositorNodeRLayers')
    else:
        path=bindings[next(l['assetId'] for l in stage['layers'] if l['plane']==name)]
        image=bpy.data.images.load(str(base/path))
        image.pack()
        image.filepath='//../../'+path
        plate=camera.data.background_images.new()
        plate.image,plate.alpha,plate.frame_method=image,1,'FIT'
        plate.display_depth='FRONT' if name=='foreground' else 'BACK'
        src=tree.nodes.new('CompositorNodeImage')
        src.image=image
        node=tree.nodes.new('CompositorNodeScale')
        node.inputs['Type'].default_value='Render Size'
        tree.links.new(src.outputs['Image'],node.inputs['Image'])
    node.label=name
    if result is None:
        result=node.outputs['Image']
    else:
        mix=tree.nodes.new('CompositorNodeAlphaOver')
        tree.links.new(result,mix.inputs['Background'])
        tree.links.new(node.outputs['Image'],mix.inputs['Foreground'])
        result=mix.outputs[0]
output=tree.nodes.new('NodeGroupOutput')
tree.links.new(result,output.inputs[0])
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_perspective='CAMERA'
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(base/f'assets-src/rooms/{code}.blend'),compress=True)
