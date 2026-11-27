# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build the complete Workshop from its exact public placements, then export only new architecture."""
import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
COMPOSITION = json.loads((ROOT / 'content/spec001/presentation/R02.json').read_text())
ROOM = json.loads((ROOT / 'content/spec001/rooms/R02.json').read_text())
BINDINGS = {row['assetId']: row for row in ROOM['mediaBindings']}
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene


def collection(name):
    group = bpy.data.collections.new(name)
    scene.collection.children.link(group)
    return group


def move(obj, group):
    for current in list(obj.users_collection):
        current.objects.unlink(obj)
    group.objects.link(obj)


def native(point):
    x, height, depth = point
    return Vector((x, -depth, height))


def material(name, color, metallic, roughness):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get('Principled BSDF')
    for key, value in [('Base Color', (*color, 1)), ('Metallic', metallic), ('Roughness', roughness)]:
        shader.inputs[key].default_value = value
    return mat


architecture = collection('01 • Forge masonry and hanging fixtures')
ironstone = material('Blued firebrick', (.061, .069, .074), .12, .88)
copper = material('Hammered copper nosing', (.34, .144, .055), .68, .39)
basalt = material('Basalt joint course', (.10, .085, .072), .08, .9)
brass = material('Patinated hanging brass', (.22, .158, .071), .57, .48)


def block(name, center, size, mat, radius=.015):
    bpy.ops.mesh.primitive_cube_add(size=1, location=native(center))
    mesh = bpy.context.object
    mesh.name = name
    mesh.dimensions = (size[0], size[2], size[1])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius:
        bevel = mesh.modifiers.new('Eased edges', 'BEVEL')
        bevel.width = radius
        bevel.segments = 2
        mesh.modifiers.new('Face normals', 'WEIGHTED_NORMAL')
    mesh.data.materials.append(mat)
    move(mesh, architecture)
    return mesh


# Three brick courses visibly transfer the small forge's weight onto a broad
# service apron. The vane and return valve keep the furnace's own proportion.
block('Hearth • basalt service apron', (1.48, .029, -.02), (2.97, .058, 1.99), ironstone)
for row in range(3):
    for column in range(5):
        for depth in range(2):
            block(f'Hearth • brick {row+1}-{column+1}-{depth+1}',
                  (.48 + column * .50, .114 + row*.113, -.51 + depth*.77),
                  (.487, .106, .753), basalt if (row+column)%3 else ironstone, .009)
block('Hearth • copper front nosing', (1.48, .393, .669), (2.55, .052, .067), copper)
block('Hearth • fitted upper stone', (1.48, .394, -.12), (2.55, .052, 1.54), ironstone)
# A bolted wall rail physically supports both the lamp and the earned ledger.
block('Gallery • horizontal hanging rail', (6.36, 3.65, -1.14), (3.98, .10, .13), ironstone)
for x in (4.49, 6.37, 8.22):
    block('Gallery • wall cleat', (x, 3.62, -1.34), (.17, .25, .50), basalt)
for x in (6.76, 8.12):
    block('Ledger • brass hanging rod', (x, 3.37, -1.09), (.045, .55, .045), brass)
    block('Ledger • hanging clasp', (x, 3.105, -1.02), (.10, .09, .16), copper)
# PR136 upper loop is at 3.5 m. The arm reaches out from the rail.
block('Lamp • suspension arm', (5, 3.65, -.67), (.062, .08, 1.04), brass)
block('Lamp • suspension pin', (5, 3.564, -.25), (.044, .14, .044), copper)
for x in (3.96, 5.03):
    block('Board • dark basalt setting stone', (x, -.018, .10), (.38, .035, .43), basalt)

# Etch the actual destinations beside the six separate T117 paving inserts.
# World geometry stays beneath the player. The Scene controls carry the full names at every scale.
inlay = material('Ivory brass direction lettering', (.72, .49, .25), .27, .59)
labels = {'R01':'LIFT', 'R03':'WARRENS', 'R05':'GARDENS', 'R07':'SKYWELL', 'R09':'MARKET', 'R10':'CLOCKWORKS'}
for anchor in COMPOSITION['anchors']:
    if not anchor['objectId'].startswith('exit:'):
        continue
    code = anchor['objectId'].split(':')[-1]
    x, _, z = anchor['position']
    if code == 'R01': x -= .68
    elif code in ('R09','R10'): x += .51
    else: z += .37
    name = labels[code]
    width = .29 + .094 * len(name)
    block(f'{code} • engraved route footplate', (x, .019, z), (width, .035, .32), ironstone)
    for edge in (-1, 1):
        block(f'{code} • inlay line', (x, .04, z + edge * .13), (width - .04, .009, .014), copper, .002)
    bpy.ops.object.text_add(location=native((x,.043,z)))
    text = bpy.context.object
    text.name = f'{code} • {name.title()} destination'
    text.data.body = name
    text.data.align_x, text.data.align_y = 'CENTER', 'CENTER'
    text.data.size = .170
    text.data.extrude = .002
    text.data.resolution_u = 2
    text.data.materials.append(inlay)
    bpy.ops.object.convert(target='MESH')
    move(text, architecture)

bpy.ops.object.select_all(action='DESELECT')
for obj in architecture.objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = architecture.objects[0]
bpy.ops.export_scene.gltf(filepath=str(ROOT / 'public/assets/models/R02-architecture.glb'),
                          export_format='GLB', use_selection=True, export_animations=False, export_yup=True)
for model in COMPOSITION['models']:
    if model['semanticId'] == ROOM['id']:
        continue
    code = model['semanticId'].split(':')[-1]
    binding = BINDINGS[model['assetId']]
    group = collection(f'{code} • placed source geometry')
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=str(ROOT / binding['exportPath']))
    objects = set(bpy.data.objects) - before
    root = bpy.data.objects.new('Instance • ' + code, None)
    root['assetId'] = model['assetId']
    root['exportPath'] = binding['exportPath']
    root['role'] = 'resident' if model['character'] else 'prop'
    group.objects.link(root)
    for obj in objects:
        if obj.parent is None:
            obj.parent = root
        move(obj, group)
    root.location = native(model['position'])
    root.scale = (model.get('scale',1),)*3
    rx, ry, rz = model.get('rotation', (0, 0, 0))
    root.rotation_euler = (rx, -rz, ry)

# The painted floor is a camera plate. A separate editable radial shadow mesh
# places the same local contact cue beneath each free-standing model as the browser.
contacts = collection('02 • Contact shadows on registered paving')
shadow_mat = bpy.data.materials.new('Contact occlusion • soft radial falloff')
shadow_mat.use_nodes = True
nodes = shadow_mat.node_tree.nodes
nodes.clear()
texture = nodes.new('ShaderNodeTexCoord')
distance = nodes.new('ShaderNodeVectorMath')
distance.operation = 'DISTANCE'
distance.inputs[1].default_value = (.5,.5,0)
ramp = nodes.new('ShaderNodeValToRGB')
ramp.color_ramp.elements[0].color = (.49,.49,.49,1)
ramp.color_ramp.elements[1].position = .5
ramp.color_ramp.elements[1].color = (0,0,0,1)
diffuse = nodes.new('ShaderNodeEmission')
diffuse.inputs['Color'].default_value = (.033,.02,.015,1)
clear = nodes.new('ShaderNodeBsdfTransparent')
mix = nodes.new('ShaderNodeMixShader')
out = nodes.new('ShaderNodeOutputMaterial')
for a,b in [(texture.outputs['UV'], distance.inputs[0]), (distance.outputs['Value'],ramp.inputs[0]),
            (ramp.outputs[0],mix.inputs[0]), (clear.outputs[0],mix.inputs[1]),
            (diffuse.outputs[0],mix.inputs[2]), (mix.outputs[0],out.inputs['Surface'])]:
    shadow_mat.node_tree.links.new(a,b)
bpy.context.view_layer.update()
for row in COMPOSITION['models'][1:]:
    if row['position'][1] > .14:
        continue
    obj = bpy.data.objects['Instance • '+row['semanticId'].split(':')[-1]]
    corners = [o.matrix_world @ Vector(v) for o in obj.children_recursive if o.type == 'MESH' for v in o.bound_box]
    xmin, xmax = min(v.x for v in corners), max(v.x for v in corners)
    ymin, ymax = min(v.y for v in corners), max(v.y for v in corners)
    bpy.ops.mesh.primitive_plane_add(size=1, location=((xmin+xmax)/2,(ymin+ymax)/2,.002))
    pad = bpy.context.object
    pad.name = 'Contact • ' + row['semanticId']
    pad.scale = (max(.44,(xmax-xmin)*1.25),max(.44,(ymax-ymin)*1.32),1)
    pad.data.materials.append(shadow_mat)
    pad.visible_shadow = False
    move(pad, contacts)

composition = collection('00 • Frozen camera, practical lights and packed plates')
cam = bpy.data.cameras.new('Registered Workshop 16 by 9')
camera = bpy.data.objects.new('R02 • orthographic original', cam)
composition.objects.link(camera)
config = COMPOSITION['camera']
camera.location = native(config['position'])
camera.rotation_euler = (native(config['target']) - camera.location).to_track_quat('-Z', 'Y').to_euler()
cam.type = 'ORTHO'
cam.ortho_scale = config['plateSpan'][0]
cam.clip_start, cam.clip_end = config['near'], config['far']
scene.camera = camera
scene.world = bpy.data.worlds.new('Forge reflected light')
scene.world.color = (.22, .20, .18)
for name, pos, target, color, energy, size in [
    ('Furnace softbox', [1, 9, 3], [4, 0, 3], (1, .68, .43), 1260, 7),
    ('Gallery clerestory', [10, 8, 1], [5, 1, 3], (.53, .72, 1), 1080, 6),
    ('Rear rim', [5, 7, -4], [5, 1, 3], (.80, .92, .82), 1050, 5),
]:
    light = bpy.data.lights.new(name, 'AREA')
    obj = bpy.data.objects.new(name, light)
    composition.objects.link(obj)
    obj.location = native(pos)
    obj.rotation_euler = (native(target) - obj.location).to_track_quat('-Z', 'Y').to_euler()
    light.energy, light.shape, light.size, light.color = energy, 'DISK', size, color

# Camera-aligned plates remain separately editable. Foreground uses its real alpha.
quaternion = camera.rotation_euler.to_quaternion()
for layer, distance in zip(COMPOSITION['layers'], (35.0, 34.97, 7.0)):
    path = ROOT / BINDINGS[layer['assetId']]['exportPath']
    bpy.ops.mesh.primitive_plane_add(size=2)
    obj = bpy.context.object
    obj.name = 'Plate • ' + layer['plane']
    obj.location = camera.location + quaternion @ Vector((0, 0, -distance))
    obj.rotation_euler = camera.rotation_euler
    obj.scale = (config['plateSpan'][0] / 2, config['plateSpan'][1] / 2, 1)
    move(obj, composition)
    image = bpy.data.images.load(str(path))
    image.pack()
    image.filepath = '//../../' + str(path.relative_to(ROOT))
    mat = bpy.data.materials.new(obj.name)
    mat.use_nodes = True
    nodes = mat.node_tree.nodes
    nodes.clear()
    texture = nodes.new('ShaderNodeTexImage')
    texture.image = image
    emission = nodes.new('ShaderNodeEmission')
    transparent = nodes.new('ShaderNodeBsdfTransparent')
    mix = nodes.new('ShaderNodeMixShader')
    out = nodes.new('ShaderNodeOutputMaterial')
    for a,b in [(texture.outputs['Color'], emission.inputs['Color']), (texture.outputs['Alpha'], mix.inputs[0]),
                (transparent.outputs[0], mix.inputs[1]), (emission.outputs[0], mix.inputs[2]), (mix.outputs[0], out.inputs['Surface'])]:
        mat.node_tree.links.new(a,b)
    obj.data.materials.append(mat)
    obj.visible_shadow = False

for anchor in COMPOSITION['anchors']:
    obj = bpy.data.objects.new(anchor['objectId'], None)
    obj.empty_display_type = 'CIRCLE'
    obj.empty_display_size = .14
    obj.location = native(anchor['position'])
    composition.objects.link(obj)
scene.render.engine = 'CYCLES'
scene.cycles.samples = 8
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y, scene.render.resolution_percentage = 1280, 720, 100
scene.view_settings.view_transform = 'Standard'
scene.frame_set(1)
for screen in bpy.data.screens:
    for area in screen.areas:
        if area.type == 'VIEW_3D':
            area.spaces.active.region_3d.view_perspective = 'CAMERA'
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT / 'assets-src/rooms/R02.blend'), compress=True)
