# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run from the repository with blender -b -P to render the frozen GLBs at each camera."""
from pathlib import Path
import hashlib
import json
import sys
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

root = Path(__file__).resolve().parents[3]
rooms = json.loads((root / 'assets-src/rooms/scene-layouts.json').read_text())['rooms']
def vector(world):
    x, height, z = world
    return Vector((x, -z, height))
def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()
# Saved guides identify the exact input pixels supplied to the image generator.
# A subsequent source revision gets a separate review render.
review_room = sys.argv[sys.argv.index('--review-room')+1] if '--review-room' in sys.argv else None
for room in rooms[4:8]:
    room_id = room['roomId'].split(':')[-1]
    base = root / 'assets-src/images' / room_id / 'reference'
    if review_room and room_id != review_room:
        continue
    if review_room:
        base = root / 'docs/evidence/spec001/image-production/T118' / room_id / 'current-cast'
    elif (base/'inputs.json').exists():
        raise RuntimeError('The original invocation guide is retained. Use --review-room '+room_id+' to render a review snapshot.')
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
        group.location = vector(item['position'])
        group.scale = tuple(item.get('outerScale',[1, 1, 1]))
        present.append({'id':aid,'path':str(path.relative_to(root)),'sha256':sha(path),'world':item['position']})
    scene.frame_set(1)
    bpy.context.view_layer.update()
    diffs = []
    for mark in room['registration']['coordinateAnchors']:
        p = world_to_camera_view(scene, camera, vector(mark['world']))
        diffs.append(max(abs(p.x-mark['uvAt16by9'][0])*1280, abs(1-p.y-mark['uvAt16by9'][1])*720))
    assert max(diffs)<0.01, diffs
    scene.render.filepath = str(base/'cast.png')
    bpy.ops.render.render(write_still=True)
    (base/'inputs.json').write_text(json.dumps({'roomId':room_id,'projection':settings,'blenderVersion':bpy.app.version_string,
        'glbs':present,'unavailableAtRender':missing,'maximumAnchorPixelError':max(diffs),
        'layoutSha256':sha(root/'assets-src/rooms/scene-layouts.json'),'castSha256':sha(base/'cast.png'),
        'method':'Actual exported GLBs imported at the frozen transforms, frame 1, orthographic workbench render with transparent world. RGB uses studio material shadings. No accepted room composition or cast visibility claim.'},indent=2)+'\n')
