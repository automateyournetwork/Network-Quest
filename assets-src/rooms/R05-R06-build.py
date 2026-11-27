# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Blender -b -P R05-R06-build.py -- R05 (or R06). Edits/export use the same world coordinates as the live room."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector

base = Path(__file__).resolve().parents[2]
code = sys.argv[sys.argv.index('--') + 1]
assert code in ('R05', 'R06')
def read(path):
    return json.loads((base / path).read_bytes())
data = read(f'content/spec001/presentation/{code}.json')
room = read(f'content/spec001/rooms/{code}.json')
bindings = {b['assetId']: b['exportPath'] for b in room['mediaBindings']}
garden = code == 'R05'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = 'Photon Gardens' if garden else 'Prism Vault'
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1024, 576, 100
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.fps = 24
scene.view_settings.view_transform = 'Standard'
scene.world = bpy.data.worlds.new('Reflected canopy light' if garden else 'Violet vault bounce')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (.40,.49,.40,1) if garden else (.54,.46,.61,1)
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
optics = group('Registered camera, plates and cinema lights')
survey = group('Interaction anchors and companion marks')
stone = material('River sandstone' if garden else 'Violet porphyry',
                 (.23,.215,.133) if garden else (.165,.117,.185),.09,.8)
inset = material('Wet garden moss' if garden else 'Aubergine grout',
                 (.083,.13,.047) if garden else (.063,.043,.074),.07,.81)
bronze = material('Oxidized bronze' if garden else 'Buffed copper inlay',
                  (.25,.19,.085) if garden else (.36,.183,.08),.63,.43)
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
if garden:
    for args in [('PR041','Grove planting curb',1.25,1.02),('PR042','Flower bed',1.10,.92),
                 ('PR043','Inspection terrace',1.66,1.02),('PR044','Wash station terrace',1.52,1.08),
                 ('PR045','Archive footing',1.84,.83),('PR049','Receiver footstone',1.35,.94)]:
        collar(*args)
    # Ceramic channels lead out to the edges of the planted beds, away from the inspection equipment.
    for x,z,length in ((.36,-.41,1.4),(2.02,-.36,.92),(8.62,-1.08,1.55)):
        slab('Runoff • channel bed',(x,-.008,z),(length,.045,.16),inset)
        for side in (-1,1):
            slab('Runoff • glazed lip',(x,.004,z+side*.085),(length,.068,.035),stone,.01)
else:
    for args in [('PR051','Prism machinery bed',2.05,1.12),('PR052','Combiner sill',1.29,1.03),
                 ('PR053','Spectrum window bed',1.47,.95),('PR057','Threshold gauge sill',1.28,.96),
                 ('PR058','Shutter runner',1.52,.9),('PR059','Counting table seat',1.56,.90),
                 ('PR060','Instrument cradle seat',1.23,.92)]:
        collar(*args)
    x,_,z=positions['PR058']
    for dz in (-.29,.29):
        slab('Shutter • guide rail',(x,.002,z+dz),(1.49,.015,.026),bronze,.006)
# Both route markers remain independent of exhibits and follow the frozen walking endpoints.
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
if garden:
    lamp('Canopy • high apricot sun','AREA',[-2,9,-2],(1,.83,.53),1250,6,optics,[4,.8,2])
    lamp('Glasshouse • cool leaf fill','AREA',[8,5,6],(.66,.86,.93),750,6,optics,[4,1,2])
    lamp('Canopy opening • shaft','POINT',[3.5,5,-1],(1,.84,.53),2.0,.75,arch)
    lamp('Water garden • cool bounce','POINT',[8,3,1],(.49,.83,.82),.65,.62,arch)
else:
    lamp('Vault oculus • violet silk','AREA',[1,8,0],(.87,.66,1),1220,6,optics,[5,.7,3])
    lamp('Vault aisle • clerestory','AREA',[9,7,5],(1,.82,.66),920,6,optics,[5,.7,3])
    lamp('Prism caustic • mauve','POINT',[5.7,4.6,-.9],(.83,.61,1),1.35,.7,arch)
    lamp('Instrument aisle • warm reflected light','POINT',[9.3,3.5,3.7],(1,.75,.51),.70,.6,arch)
for name, pos in [(a['objectId'],a['position']) for a in data['anchors']]+[
    ('Companion berth '+str(i+1),p) for i,p in enumerate(data['partyPositions'])]:
    e=bpy.data.objects.new(name,None);survey.objects.link(e);e.empty_display_type='CIRCLE';e.empty_display_size=.10;e.location=native(pos)
cam=data['camera']
bpy.ops.object.camera_add(location=native(cam['position']))
camera=bpy.context.object;move(camera,optics)
camera.name=scene.name+' • fixed camera'
camera.rotation_euler=(native(cam['target'])-camera.location).to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=cam['plateSpan'][0]
camera.data.clip_start,camera.data.clip_end=cam['near'],cam['far'];scene.camera=camera
bpy.ops.mesh.primitive_plane_add(size=36,location=native([5,-.006,3]))
catcher=bpy.context.object;move(catcher,optics);catcher.name='Optical floor • contact receiver';catcher.is_shadow_catcher=True
bpy.ops.object.select_all(action='DESELECT')
for obj in arch.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=arch.objects[0]
bpy.ops.export_scene.gltf(filepath=str(base/f'public/assets/models/{code}-architecture.glb'),export_format='GLB',use_selection=True,export_lights=True,export_extras=True,export_animations=False)
tree=bpy.data.node_groups.new('Registered floor, focal cast and garden edges' if garden else 'Registered masonry, focal cast and near brass','CompositorNodeTree')
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
