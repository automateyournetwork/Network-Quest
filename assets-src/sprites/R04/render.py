# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build the editable staged cast and render its sampled native clips. Run from checkout root."""
from pathlib import Path
import hashlib
import json
import math
import sys

import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

BASE = Path.cwd()
SOURCE = BASE / 'assets-src/sprites/R04'
WORK = BASE / '.local/T134/frames'
WORK.mkdir(parents=True, exist_ok=True)
NATIVE = SOURCE / 'R04-sprite-stage.blend'
room = next(r for r in json.loads((BASE/'assets-src/rooms/scene-layouts.json').read_text())['rooms'] if r['roomId'] == 'spec001:R04')
camera_settings = room['camera']
WIDTH, HEIGHT = 1024, 576
subjects = room['characterPlacements'] + room['propPlacements']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def xyz(position):
    x, y, z = position
    return Vector((x, -z, y))


def identity(item):
    return (item.get('characterId') or item['semanticId']).split(':')[-1]


def build():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene
    sc.name = 'Echo Cavern · sprite stage'
    sc.render.engine = 'CYCLES'
    sc.cycles.samples = 24
    sc.cycles.use_denoising = True
    sc.render.fps = 24
    sc.render.resolution_percentage = 100
    sc.render.resolution_x, sc.render.resolution_y = WIDTH, HEIGHT
    sc.render.film_transparent = True
    sc.render.image_settings.file_format = 'PNG'
    sc.render.image_settings.color_mode = 'RGBA'
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    sc.view_settings.exposure = -.6
    sc.world = bpy.data.worlds.new('Cavern cool ambient')
    sc.world.use_nodes = True
    sc.world.node_tree.nodes['Background'].inputs[0].default_value = (.40, .53, .71, 1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value = .38
    bpy.ops.object.camera_add(location=camera_settings['blenderPosition'])
    cam = bpy.context.object
    cam.name = 'R04 registered orthographic camera'
    cam.rotation_euler = (Vector(camera_settings['blenderTarget']) - cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = 16
    cam.data.clip_start, cam.data.clip_end = camera_settings['near'], camera_settings['far']
    sc.camera = cam
    for name, loc, color, watts, size in [
        ('Warm post-house key', (13,-9,8), (1,.74,.47), 2100, 6),
        ('Blue cavern bounce', (-4,-6,7), (.47,.71,1), 1500, 7),
        ('Rear arch rim', (3,4,7), (.48,.77,1), 1450, 5),
    ]:
        bpy.ops.object.light_add(type='AREA', location=loc)
        light = bpy.context.object
        light.name = name
        light.rotation_euler = (Vector((5,-3,.7))-light.location).to_track_quat('-Z','Y').to_euler()
        light.data.color, light.data.energy, light.data.shape, light.data.size = color, watts, 'DISK', size
    bpy.ops.mesh.primitive_plane_add(size=35, location=(5,-3,-.002))
    bpy.context.object.name = 'Painted gallery floor · shadow receiver'
    bpy.context.object.is_shadow_catcher = True

    inputs = []
    for item in subjects:
        id = identity(item)
        group = bpy.data.collections.new(id+' stage')
        sc.collection.children.link(group)
        origin = bpy.data.objects.new(id+' placement', None)
        group.objects.link(origin)
        if id.startswith('CH'):
            path = BASE/'assets-src/characters'/f'{id}.blend'
            with bpy.data.libraries.load(str(path), link=False) as (lib, loaded):
                loaded.objects = [name for name in lib.objects if name.startswith(id) and 'collision' not in name.lower()]
            nodes = list(loaded.objects)
            for obj in nodes:
                group.objects.link(obj)
            assert any(o.animation_data and o.animation_data.nla_tracks for o in nodes)
        else:
            path, = (BASE/'public/assets/models').rglob(id+'.glb')
            bpy.ops.import_scene.gltf(filepath=str(path))
            nodes = list(bpy.context.selected_objects)
            for obj in nodes:
                for collection in list(obj.users_collection):
                    collection.objects.unlink(obj)
                group.objects.link(obj)
        for obj in nodes:
            if obj.parent is None:
                obj.parent = origin
            if obj.animation_data:
                for track in obj.animation_data.nla_tracks:
                    track.mute = track.name != 'idle'
        origin.location = xyz(item['position'])
        inputs.append({'assetId': 'spec001:ASSET-'+id, 'source': str(path.relative_to(BASE)), 'sha256':sha(path)})
    # The ceramic feed hangs from a narrow conduit driven into the overhead rock.
    insulator = bpy.data.collections['PR135 stage']
    mount = bpy.data.objects['PR135 placement']
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=.038, depth=.72)
    stem = bpy.context.object
    stem.name = 'Ceiling feed · continuation into rib'
    stem.parent = mount
    stem.location = (0,0,.31)
    bronze = bpy.data.materials.new('Oxidised bronze conduit')
    bronze.use_nodes = True
    shader = bronze.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = (.075,.043,.019,1)
    shader.inputs['Metallic'].default_value = .65
    shader.inputs['Roughness'].default_value = .54
    stem.data.materials.append(bronze)
    for c in list(stem.users_collection):
        c.objects.unlink(stem)
    insulator.objects.link(stem)

    sc.frame_set(0)
    sc['rights'] = 'Network Quest original media • CC BY 4.0'
    sc['sourceInputs'] = json.dumps(inputs)
    sc['stagePixels'] = [WIDTH, HEIGHT]
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(NATIVE), compress=True)


def render():
    bpy.ops.wm.open_mainfile(filepath=str(NATIVE))
    sc = bpy.context.scene
    cam = sc.camera
    inputs = json.loads(sc['sourceInputs'])
    sc.render.use_border = True
    sc.render.use_crop_to_border = True
    groups = {identity(i):bpy.data.collections[identity(i)+' stage'] for i in subjects}
    def projected(v):
        uv = world_to_camera_view(sc,cam,v)
        return [round(uv.x*WIDTH,3),round((1-uv.y)*HEIGHT,3)]
    saved = {}
    for item in subjects:
        id = identity(item)
        for other, collection in groups.items():
            collection.hide_render = other != id
        group = groups[id]
        at = xyz(item['position'])
        pivot = projected(at)
        # Fixed integer crop for the entire clip, including soft floor contacts and mount.
        cx, cy = (round(v) for v in pivot)
        l, r = max(0,cx-148), min(WIDTH,cx+148)
        t, b = max(0,cy-(210 if id=='PR135' else 155)), min(HEIGHT,cy+60)
        sc.render.border_min_x, sc.render.border_max_x = l/WIDTH,r/WIDTH
        sc.render.border_min_y, sc.render.border_max_y = (HEIGHT-b)/HEIGHT,(HEIGHT-t)/HEIGHT
        joints = [o for o in group.objects if o.animation_data and o.animation_data.nla_tracks]
        for joint in joints:
            for tr in joint.animation_data.nla_tracks:
                tr.mute=True
        sc.frame_set(0)
        # All source clips return to bind pose at time zero.
        rest = {o:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in joints}
        clips = {}
        names = ['idle','walk','reaction'] if id=='CH01' else ['idle','reaction'] if joints else ['rest']
        for name in names:
            for o in joints:
                for tr in o.animation_data.nla_tracks:
                    tr.mute = True
                o.location,o.rotation_euler,o.scale = rest[o]
            tracks = [tr for o in joints for tr in o.animation_data.nla_tracks if tr.name==name]
            for tr in tracks:
                tr.mute=False
            duration = int(tracks[0].strips[0].frame_end) if tracks else 1
            assert not joints or all(tr.strips[0].frame_start==0 and tr.strips[0].frame_end==duration for tr in tracks)
            frames = list(range(0,duration,max(1,round(duration/12)))) if tracks else [0]
            for frame in frames:
                sc.frame_set(frame)
                sc.render.filepath=str(WORK/f'{id}-{name}-{frame}.png')
                bpy.ops.render.render(write_still=True)
            clips[name]={'sourceFrames':frames,'endFrameExclusive':duration}
        depth = (at - cam.location).dot(cam.rotation_euler.to_quaternion() @ Vector((0,0,-1)))
        saved[id]={'stagePivot':pivot,'renderCrop':[l,t,r,b],'cameraDepth':round(depth,5),'clips':clips}
    anchors = [{'objectId':hot['id'],'point':projected(xyz(hot['anchorWorld']))} for hot in room['hotspots']+room['exits']]
    for key, pos in [('spec001:WALK-R04',[4.7,0,4.4]),('spec001:R04.entry',[5,0,3])]:
        anchors.append({'objectId':key,'point':projected(xyz(pos))})
    record={'blender':bpy.app.version_string,'engine':sc.render.engine,'samples':sc.cycles.samples,'fps':sc.render.fps,
            'stageSize':[WIDTH,HEIGHT],'camera':camera_settings,'inputs':inputs,'subjects':saved,'anchors':anchors}
    (SOURCE/'native-frames.json').write_text(json.dumps(record,indent=2)+'\n')


if '--render-only' not in sys.argv:
    build()
render()
