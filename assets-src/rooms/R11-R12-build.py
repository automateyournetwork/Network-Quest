# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Blender -b -P R11-R12-build.py -- R11 (or R12). Edits/export use the same world coordinates as the live room."""
import json
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

base = Path(__file__).resolve().parents[2]
code = sys.argv[sys.argv.index('--') + 1]
assert code in ('R11', 'R12')
def read(path):
    return json.loads((base / path).read_bytes())
data = read(f'content/spec001/presentation/{code}.json')
room = read(f'content/spec001/rooms/{code}.json')
bindings = {b['assetId']: b['exportPath'] for b in room['mediaBindings']}
rift = code == 'R11'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.name = 'Backhoe Rift' if rift else 'Iron Threshold'
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1024, 576, 100
scene.render.engine = 'CYCLES'
scene.cycles.samples = 12
scene.cycles.use_denoising = True
scene.render.film_transparent = True
scene.render.fps = 24
scene.view_settings.view_transform = 'Standard'
scene.world = bpy.data.worlds.new('Ochre quarry bounce' if rift else 'Evening ashlar bounce')
scene.world.use_nodes = True
bg = scene.world.node_tree.nodes['Background']
bg.inputs['Color'].default_value = (.46,.36,.29,1) if rift else (.47,.45,.55,1)
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
stone = material('Laminated quarry limestone' if rift else 'Worn threshold basalt',
                 (.252,.163,.103) if rift else (.187,.18,.205),.09,.8)
inset = material('Ironstone scree' if rift else 'Blued mortar',
                 (.128,.088,.064) if rift else (.093,.083,.102),.07,.81)
bronze = material('Oxidized bronze' if rift else 'Buffed copper inlay',
                  (.25,.19,.085) if rift else (.36,.183,.08),.63,.43)
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
if rift:
    # Thin runners carry the real equipment. Broken excavation strata stay along
    # the cut face, clear of the route deck and all five prepared approaches.
    for args in [('PR105','Splice table footing',1.70,.89),('PR106','Bypass footing',1.82,.84),
                 ('PR108','Permit stand anchor',1.00,.68),('PR109','Control post anchor',.88,.73),
                 ('PR110','Notice stem ground plate',.72,.57),('PR104','Survey tripod pad',1.17,1.09)]:
        collar(*args)
    x,_,z=positions['PR101']
    for i,(length,angle) in enumerate(((.94,.10),(.67,-.07),(.89,.04),(.54,-.03))):
        slab('Cut bank • broken shale '+str(i+1),(x-1.31+i*.78,-.02,z-.54),
             (length,.12+.035*(i%2),.29),stone,.045).rotation_euler.z=angle
    for x,z,length in ((3.82,.67,.72),(5.43,.80,.80)):
        slab('Deck rail • tie',(x,-.025,z),(length,.045,1.21),inset,.024)
else:
    # Mortared sills and copper channels follow the final evidence stations.
    # The gate and the open return arch remain single upstream meshes.
    for args in [('PR111','Iron gate foundation',3.48,.92),('PR112','Beacon footing',.95,.92),
                 ('PR113','Validation desk plinth',1.49,.82),('PR115','Mural stand base',1.33,.72),
                 ('PR117','Link totem footing',.84,.81),('PR118','Seal pedestal flag',1.06,1.04),
                 ('PR119','Return arch cross-sill',1.13,.64),('PR120','Threshold tablet base',1.16,.70)]:
        collar(*args)
    x,_,z=positions['PR119']
    for index in range(4):
        slab('Return aisle • recessed brass stud',(x+.10,-.002,z+.55+index*.20),
             (.12,.014,.045),bronze,.008)
    # Three cast-brass folios rest behind the blank PR115 recess. Each is a
    # single reusable native group. Only an earned classification raises one.
    x,_,z=positions['PR115']
    gold=material('Folio • pale electrum',(.84,.59,.23),.36,.34)
    pearl=material('Folio • warm enamel',(.79,.72,.54),.09,.45)
    def relief(code, segments):
        carrier=bpy.data.objects.new('Mural'+code,None)
        arch.objects.link(carrier)
        carrier.location=native([x,1.05,z-.18])
        carrier['outcome']=code
        carrier['displayOffsetZ']=.315
        for a,b in segments:
            vx,vy=b[0]-a[0],b[1]-a[1]
            bar=slab(code+' • engraved stroke',[(a[0]+b[0])/2,(a[1]+b[1])/2,0],
                     ((vx*vx+vy*vy)**.5,.040,.022),gold,.011)
            bar.rotation_euler.y=-math.atan2(vy,vx)
            bar.parent=carrier
        for edge in (-1,1):
            rivet=slab(code+' • field rivet',[edge*.38,-.27,0],(.040,.04,.024),pearl,.01)
            rivet.parent=carrier
    # Complete permanent span, stepped bypass with a service pier, isolated ends.
    relief('E01',[((-.36,-.10),(.36,-.10)),((-.30,-.10),(-.15,.10)),((-.15,.10),(.15,.10)),((.15,.10),(.30,-.10)),((0,-.10),(0,.10))])
    relief('E02',[((-.36,-.10),(-.17,-.10)),((-.17,-.10),(-.08,.13)),((-.08,.13),(.15,.13)),((.15,.13),(.24,-.10)),((.24,-.10),(.36,-.10)),((.04,-.18),(.04,.13))])
    relief('E03',[((-.36,-.06),(-.13,-.06)),((.13,-.06),(.36,-.06)),((-.13,-.15),(-.13,.02)),((.13,-.15),(.13,.02)),((-.05,.18),(.05,.05)),((.05,.18),(-.05,.05))])
# Ground-level approach marks follow each registered walking endpoint.
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
if rift:
    lamp('Western canyon • ochre skylight','AREA',[-3,8,2],(1,.72,.41),1420,6,optics,[5,.7,2])
    lamp('Rift wall • cool rebound','AREA',[10,6,-2],(.55,.72,1),850,5,optics,[5,.7,2])
    lamp('Inspection terrace • warm practical','POINT',[1.6,3,3],(1,.66,.36),1.35,.67,arch)
    lamp('Rift cut • mineral bounce','POINT',[9.7,4,-1],(.52,.73,1),1.1,.66,arch)
else:
    lamp('Arcade • sun through the western bay','AREA',[-3,6,1],(1,.69,.40),980,5,optics,[4,.7,2])
    lamp('Threshold clerestory • dusk','AREA',[10,8,2],(.70,.80,1),1100,7,optics,[6,.7,2])
    lamp('Return arch • amber reflected light','POINT',[.2,3.2,5.7],(1,.72,.43),1.4,.65,arch)
    lamp('City wall • cool rebound','POINT',[8,3.9,.4],(.58,.72,1),1.0,.66,arch)
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
catcher=bpy.context.object;move(catcher,optics);catcher.name='Survey floor • contact receiver';catcher.is_shadow_catcher=True
bpy.ops.object.select_all(action='DESELECT')
for obj in arch.objects:obj.select_set(True)
bpy.context.view_layer.objects.active=arch.objects[0]
bpy.ops.export_scene.gltf(filepath=str(base/f'public/assets/models/{code}-architecture.glb'),export_format='GLB',use_selection=True,export_lights=True,export_extras=True,export_animations=False)
tree=bpy.data.node_groups.new('Canyon cut, focal cast and front wall' if rift else 'City wall, witnesses and balcony','CompositorNodeTree')
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
