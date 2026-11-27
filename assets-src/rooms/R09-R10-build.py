# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Blender -b -P R09-R10-build.py -- R09 (or R10). Edits/export use the same world coordinates as the live room."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

base = Path(__file__).resolve().parents[2]
code = sys.argv[sys.argv.index('--') + 1]
assert code in ('R09', 'R10')
def read(path):
    return json.loads((base / path).read_bytes())
data = read(f'content/spec001/presentation/{code}.json')
room = read(f'content/spec001/rooms/{code}.json')
bindings = {b['assetId']: b['exportPath'] for b in room['mediaBindings']}
market = code == 'R09'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = 'The Shell Market' if market else 'The Clockworks'
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1024, 576, 100
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.fps = 24
scene.view_settings.view_transform = 'Standard'
scene.world = bpy.data.worlds.new('Reflected shell and sailcloth' if market else 'Amber gallery bounce')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (.61,.49,.40,1) if market else (.46,.44,.38,1)
bg.inputs['Strength'].default_value = .65

def native(p):
    return Vector((p[0],-p[2],p[1]))

def group(name):
    c = bpy.data.collections.new(name)
    scene.collection.children.link(c)
    return c

def move(obj, collection):
    for old in list(obj.users_collection):
        old.objects.unlink(obj)
    collection.objects.link(obj)

def material(name, color, metal, rough):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color,1)
    mat.use_nodes = True
    node = mat.node_tree.nodes['Principled BSDF']
    node.inputs['Base Color'].default_value = (*color,1)
    node.inputs['Metallic'].default_value = metal
    node.inputs['Roughness'].default_value = rough
    return mat

arch = group('Built fabric and local practicals')
studio = group('Registered camera, plates and cinema lights')
survey = group('Interaction anchors and companion marks')
stone = material('Shell terrazzo' if market else 'Oiled granite',
                 (.41,.282,.205) if market else (.117,.126,.136),.09,.8)
inset = material('Burgundy mortar' if market else 'Cast-iron grout',
                 (.18,.075,.053) if market else (.048,.052,.050),.07,.81)
bronze = material('Oxidized bronze' if market else 'Buffed copper inlay',
                  (.25,.19,.085) if market else (.36,.183,.08),.63,.43)
def slab(name, position, size, mat, bevel=.02):
    bpy.ops.mesh.primitive_cube_add(size=1,location=native(position))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = (size[0],size[2],size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    m = obj.modifiers.new('Hewn edges','BEVEL');m.width=bevel;m.segments=2
    obj.modifiers.new('Face shading','WEIGHTED_NORMAL')
    obj.data.materials.append(mat)
    move(obj,arch)
    return obj
def collar(id, name, width, depth, split=True):
    x,_,z = positions[id]
    slab(name+' • bedding',(x,-.073,z),(width+.11,.115,depth+.10),inset,.04)
    # Flagstone upper faces meet object ground origins. Split laid blocks leave a fine mortar seam.
    count = 2 if split else 1
    for i in range(count):
        slab(name+' • seat '+str(i+1),(x+(i-(count-1)/2)*width/count,-.027,z),(width/count-.018,.054,depth),stone,.023)
    for edge in (-1,1):
        slab(name+' • rim pin',(x+edge*(width/2-.075),.001,z+depth/2-.07),(.065,.005,.065),bronze,.009)

positions = {}
for model in data['models'][1:]:
    short = model['semanticId'].split(':')[1]
    stage = group(short+' • authored placement')
    before = set(bpy.data.objects)
    source_path = bindings[model['assetId']]
    bpy.ops.import_scene.gltf(filepath=str(base/source_path))
    items = set(bpy.data.objects)-before
    root = bpy.data.objects.new(short+' placement',None)
    stage.objects.link(root)
    for obj in items:
        if not obj.parent:
            obj.parent = root
        move(obj,stage)
    root.location = native(model['position'])
    root['sourcePath'] = source_path
    positions[short] = model['position']
if market:
    for args in [('PR081','Nacre display plinth',2.10,1.04),('PR082','Narrow cage sill',1.24,.92),
                 ('PR083','Broad cage sill',1.43,.98),('PR084','Injector service pad',1.44,1.02),
                 ('PR085','Endpoint card dais',1.48,1.08),('PR086','Demarcation sill',1.22,.88),
                 ('PR089','Ledger curb',1.13,.90),('PR090','Loan counter footing',2.28,1.10)]:
        collar(*args)
    # The shell market uses inset fan-shaped brass motifs in its wares aisle.
    import math
    for x,z in [(1.98,2.12),(5.23,4.58),(9.54,5.78)]:
        for index in range(-2,3):
            angle=index*.24
            rib=slab('Scallop • flush brass flute',(x+.22*math.sin(angle),.001,z+.22*math.cos(angle)),
                     (.019,.008,.47),bronze,.004)
            rib.rotation_euler.z=angle
else:
    for args in [('PR091','Timing-wheel machine bed',2.02,1.23),('PR092','Loom bedplate',1.55,1.08),
                 ('PR093','Symbol plinth footing',1.10,.84),('PR094','Capability desk sill',1.58,1.04),
                 ('PR096','Sampler mounting bed',1.34,.99),('PR097','Recovery model feet',1.36,.87),
                 ('PR098','Guard plate track',1.51,.91),('PR099','Decoder bench sill',1.32,.90)]:
        collar(*args)
    # Machine footings pick up the flywheel's brass bearing language.
    for key in ('PR091','PR096','PR097'):
        x,_,z=positions[key]
        for side in (-1,1):
            slab('Bearing shoe • longitudinal strip',(x+side*.43,.003,z),(.046,.012,.72),bronze,.008)
# Route inlays follow the actual walking endpoints.
for exit in (a for a in data['anchors'] if a['objectId'].startswith('exit:')):
    x,_,z=exit['position']
    for i in range(3):
        dx=(1 if x<5 else -1)*i*.16
        rib=slab('Exit • three flush threshold ribs',(x+dx,.001,z),(.068,.013,.50-i*.07),bronze,.006)
        rib['objectId']=exit['objectId']
def lamp(name, type, pos, color, power, size, collection, aim=None):
    light=bpy.data.lights.new(name,type)
    obj=bpy.data.objects.new(name,light);collection.objects.link(obj)
    obj.location=native(pos);light.color=color;light.energy=power
    if type=='AREA':
        light.shape='DISK';light.size=size
    else:light.shadow_soft_size=size
    if aim:obj.rotation_euler=(native(aim)-obj.location).to_track_quat('-Z','Y').to_euler()
if market:
    lamp('Awning • bounced linen','AREA',[.75,8,3],(1,.82,.65),1150,6,studio,[4,.6,2])
    lamp('Shell arch • window fill','AREA',[11,7,6],(.70,.82,1),820,6,studio,[6,.7,3])
    lamp('Shell counter • reflected amber','POINT',[4.0,3.9,4.6],(1,.69,.38),1.25,.72,arch)
    lamp('Endpoint desk • patina fill','POINT',[10.6,3.3,3.3],(.62,.84,.94),.8,.69,arch)
else:
    lamp('Upper clockface • afternoon','AREA',[2,8,-.6],(1,.79,.46),1150,6,studio,[5,.7,2])
    lamp('Gallery • north window','AREA',[10,7,6],(.66,.85,1),930,5,studio,[5,.8,3])
    lamp('Escapement • brass reflection','POINT',[4.4,4.1,.1],(1,.73,.41),1.45,.75,arch)
    lamp('Capability station • window bounce','POINT',[9.4,3.9,4.4],(.72,.86,1),.81,.65,arch)
for name, pos in [(a['objectId'],a['position']) for a in data['anchors']]+[
    ('Companion berth '+str(i+1),p) for i,p in enumerate(data['partyPositions'])]:
    e=bpy.data.objects.new(name,None);survey.objects.link(e);e.empty_display_type='CIRCLE';e.empty_display_size=.10;e.location=native(pos)
cam=data['camera']
bpy.ops.object.camera_add(location=native(cam['position']))
camera=bpy.context.object;move(camera,studio)
camera.name=scene.name+' • fixed camera'
camera.rotation_euler=(native(cam['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=cam['plateSpan'][0]
camera.data.clip_start,camera.data.clip_end=cam['near'],cam['far'];scene.camera=camera
bpy.ops.mesh.primitive_plane_add(size=36,location=native([5,-.006,3]))
catcher=bpy.context.object;move(catcher,studio);catcher.name='Surveyed floor • contact receiver';catcher.is_shadow_catcher=True
bpy.ops.object.select_all(action='DESELECT')
for obj in arch.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=arch.objects[0]
bpy.ops.export_scene.gltf(filepath=str(base/f'public/assets/models/{code}-architecture.glb'),export_format='GLB',use_selection=True,export_lights=True,export_extras=True,export_animations=False)
tree=bpy.data.node_groups.new('Market aisle, residents and awning' if market else 'Clockwork floor, residents and near brass','CompositorNodeTree')
tree.interface.new_socket(name='Image',in_out='OUTPUT',socket_type='NodeSocketColor')
scene.compositing_node_group=tree
camera.data.show_background_images=True
result=None
for name in ('background','midground','focal','foreground'):
    if name=='focal':node=tree.nodes.new('CompositorNodeRLayers')
    else:
        path=bindings[next(l['assetId'] for l in data['layers'] if l['plane']==name)]
        image=bpy.data.images.load(str(base/path));image.pack();image.filepath='//../../'+path
        plate=camera.data.background_images.new();plate.image=image;plate.alpha=1;plate.frame_method='FIT'
        plate.display_depth='FRONT' if name=='foreground' else 'BACK'
        src=tree.nodes.new('CompositorNodeImage');src.image=image
        node=tree.nodes.new('CompositorNodeScale');node.inputs['Type'].default_value='Render Size'
        tree.links.new(src.outputs['Image'],node.inputs['Image'])
    node.label=name
    if result is None:result=node.outputs['Image']
    else:
        blend=tree.nodes.new('CompositorNodeAlphaOver')
        tree.links.new(result,blend.inputs['Background']);tree.links.new(node.outputs['Image'],blend.inputs['Foreground']);result=blend.outputs[0]
out=tree.nodes.new('NodeGroupOutput');tree.links.new(result,out.inputs[0])
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type=='VIEW_3D':area.spaces.active.region_3d.view_perspective='CAMERA'
scene.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(base/f'assets-src/rooms/{code}.blend'),compress=True)
