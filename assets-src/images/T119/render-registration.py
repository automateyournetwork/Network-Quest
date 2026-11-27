# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run from the repository with blender -b -P to render the frozen GLBs at each camera."""
from pathlib import Path
import hashlib
import json
import sys
import bpy
from mathutils import Vector, Matrix, Euler
from bpy_extras.object_utils import world_to_camera_view

root = Path(__file__).resolve().parents[3]
rooms = json.loads((root / 'assets-src/rooms/scene-layouts.json').read_text())['rooms']
def vector(world):
    x, height, z = world
    return Vector((x, -z, height))
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
for room in rooms[8:12]:
    room_id = room['roomId'].split(':')[-1]
    base = root / 'assets-src/images' / room_id / 'reference'
    base.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    settings = room['camera']
    bpy.ops.object.camera_add(location=settings['blenderPosition'])
    camera = bpy.context.object
    camera.rotation_euler = (Vector(settings['blenderTarget']) - camera.location).to_track_quat('-Z','Y').to_euler()
    camera.data.type = 'ORTHO'
    camera.data.ortho_scale = settings['plateSpan'][0]
    camera.data.clip_start = settings['near']
    camera.data.clip_end = settings['far']
    scene.camera = camera
    scene.render.resolution_x, scene.render.resolution_y = settings['basePlatePixels']
    scene.render.resolution_percentage = 100
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'MATERIAL'
    scene.display.shading.show_shadows = True
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'WORLD'
    scene.render.film_transparent = True
    scene.render.image_settings.color_mode = 'RGBA'
    mount_path = root / 'docs/evidence/spec001/prop-production/T116' / (room_id + '-mounted.json')
    transforms = {p['id']:p for p in json.loads(mount_path.read_text())['transforms']}
    present, missing = [], []
    for item in room['characterPlacements'] + room['propPlacements']:
        aid = (item.get('characterId') or item['semanticId']).split(':')[-1]
        files = list((root/'public/assets/models').rglob(aid+'.glb'))
        if not files:
            missing.append(aid)
            continue
        assert len(files)==1
        path, = files
        bpy.ops.import_scene.gltf(filepath=str(path))
        subjects = list(bpy.context.selected_objects)
        group = bpy.data.objects.new(aid+' frozen placement',None)
        scene.collection.objects.link(group)
        for ob in subjects:
            if ob.parent is None: ob.parent = group
        mounted = transforms.get(item.get('semanticId'), {})
        position = mounted.get('position', item['position'])
        angles = mounted.get('euler', [0,0,0])
        group.location = vector(position)
        # Three.js intrinsic XYZ equals Blender extrinsic ZYX, in runtime axes.
        basis = Matrix(((1,0,0),(0,0,-1),(0,1,0)))
        group.rotation_euler = (basis @ Euler(angles,'ZYX').to_matrix() @ basis.transposed()).to_euler()
        group.scale = tuple(item.get('outerScale',[1, 1, 1]))
        present.append({'id':aid,'path':str(path.relative_to(root)),'sha256':sha(path),'world':position,'frozenWorld':item['position'],'runtimeEuler':angles})
    scene.frame_set(1)
    bpy.context.view_layer.update()
    diffs = []
    for mark in room['registration']['coordinateAnchors']:
        p = world_to_camera_view(scene, camera, vector(mark['world']))
        diffs.append(max(abs(p.x-mark['uvAt16by9'][0])*1280, abs(1-p.y-mark['uvAt16by9'][1])*720))
    assert max(diffs)<0.01, diffs
    if '--shadows' in sys.argv:
        # Review-only shadows. Keep movable props, cast and their shadows out of public art.
        out = root/'docs/evidence/spec001/image-production/T119'/room_id
        out.mkdir(parents=True,exist_ok=True)
        scene.render.engine = 'CYCLES'
        scene.cycles.samples = 16
        scene.cycles.use_denoising = True
        for obj in scene.objects:
            if obj.type == 'MESH':
                obj.visible_camera = False
        bpy.ops.mesh.primitive_plane_add(size=120,location=(6,-3.5,-0.004))
        bpy.context.object.is_shadow_catcher = True
        world = bpy.data.worlds.new('Soft sky fill')
        scene.world = world
        world.use_nodes = True
        world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.68,.71,.77,1)
        world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .6
        bpy.ops.object.light_add(type='AREA',location=(-1,-1,12))
        lamp = bpy.context.object
        lamp.rotation_euler = (Vector((6,-3.5,0))-lamp.location).to_track_quat('-Z','Y').to_euler()
        lamp.data.energy = 1800
        lamp.data.shape = 'DISK'
        lamp.data.size = 5
        scene.render.filepath = str(out/'ground-shadows.png')
        bpy.ops.render.render(write_still=True)
        (out/'shadow-pass.json').write_text(json.dumps({'room':room_id,'castInputPath':str((base/'inputs.json').relative_to(root)),
            'castInputSha256':sha(base/'inputs.json'),'sha256':sha(out/'ground-shadows.png'),'renderer':'Blender '+bpy.app.version_string+' / Cycles',
            'samples':16,'lampNative':[-1,-1,12],'targetNative':[6,-3.5,0],'energyWatts':1800,'sizeMetres':5,
            'receiverHeight':-.004,'scope':'Diagnostic contact-shadow receiver for the exact frame-1 cast in the isolated visual inspection.'},indent=2)+'\n')
        continue
    scene.render.filepath = str(base/'cast.png')
    bpy.ops.render.render(write_still=True)
    (base/'inputs.json').write_text(json.dumps({'roomId':room_id,'projection':settings,'blenderVersion':bpy.app.version_string,
        'glbs':present,'unavailableAtRender':missing,'maximumAnchorPixelError':max(diffs),
        'layoutSha256':sha(root/'assets-src/rooms/scene-layouts.json'),'castSha256':sha(base/'cast.png'),
        'mountReportSha256':sha(mount_path),'method':'Actual exported GLBs imported at the frozen camera with T116 proposed mounted positions, frame 1, orthographic workbench render with transparent world. RGB uses studio material shadings. No accepted room composition or cast visibility claim.'},indent=2)+'\n')
