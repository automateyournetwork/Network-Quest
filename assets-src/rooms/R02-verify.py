# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run inside reopened R02.blend to compare the actual editable composition and render it."""
import hashlib
import json
from pathlib import Path
import bpy
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

root = Path(__file__).resolve().parents[2]
data = json.loads((root / 'content/spec001/presentation/R02.json').read_text())
out = root / 'docs/evidence/spec001/final-rooms/T135'
scene = bpy.context.scene
def digest(p):
    b = p.read_bytes()
    return {'path': str(p.relative_to(root)), 'bytes': len(b), 'sha256': hashlib.sha256(b).hexdigest()}
native = lambda xyz: Vector((xyz[0], -xyz[2], xyz[1]))
assert bpy.data.filepath.endswith('/R02.blend')
assert (scene.camera.location-native(data['camera']['position'])).length < .0001
assert abs(scene.camera.data.ortho_scale - data['camera']['plateSpan'][0]) < .0001
inputs = []
for row in data['models'][1:]:
    obj = bpy.data.objects['Instance • ' + row['semanticId'].split(':')[1]]
    assert obj['assetId'] == row['assetId'] and len(obj.children_recursive) > 0
    assert (obj.location-native(row['position'])).length < .0001
    assert max(abs(axis-row.get('scale',1)) for axis in obj.scale) < .0001
    inputs.append({**digest(root / obj['exportPath']), 'assetId': obj['assetId'], 'position':row['position'],
                   'meshCount':sum(x.type=='MESH' for x in obj.children_recursive)})
for layer in data['layers']:
    obj = bpy.data.objects['Plate • ' + layer['plane']]
    image = next(n.image for n in obj.active_material.node_tree.nodes if n.type == 'TEX_IMAGE')
    assert image.packed_file and tuple(image.size) == (1600, 900)
for anchor in data['anchors']:
    assert (bpy.data.objects[anchor['objectId']].location-native(anchor['position'])).length < .0001
camera_record = {
    'roomId': data['roomId'], 'source': digest(root/'assets-src/rooms/R02.blend'),
    'camera': data['camera'], 'nativeCamera': scene.camera.name,
    'nativePosition': list(scene.camera.location), 'orthoScale': scene.camera.data.ortho_scale,
    'upstreamCameraRegistration': 'assets-src/images/R02/camera.json',
}
(root/'assets-src/rooms/R02-camera.json').write_text(json.dumps(camera_record,indent=2)+'\n')
registered = []
for anchor in data['anchors']:
    obj = bpy.data.objects[anchor['objectId']]
    uv = world_to_camera_view(scene,scene.camera,obj.matrix_world.translation)
    registered.append({'objectId':anchor['objectId'], 'position':anchor['position'], 'uv':[uv.x,1-uv.y]})
(root/'assets-src/rooms/R02-registration.json').write_text(json.dumps({
    'roomId':data['roomId'], 'nativeCamera':'assets-src/rooms/R02-camera.json',
    'plateMasks':'assets-src/images/R02/registration.json',
    'projection':'Frozen 16:9 camera, top-left normalized UV, no crop or camera pan',
    'anchors':registered,
},indent=2)+'\n')
report = {'blender':bpy.app.version_string, 'camera':data['camera'], 'source':digest(root / 'assets-src/rooms/R02.blend'),
          'architecture':digest(root/'public/assets/models/R02-architecture.glb'), 'architectureObjects':[o.name for o in bpy.data.collections['01 • Forge masonry and hanging fixtures'].objects],
          'packedPlates':3, 'anchors':len(data['anchors']), 'placements':inputs}
(out / 'source-reopen.json').write_text(json.dumps(report,indent=2)+'\n')
scene.render.filepath = str(out / 'native-camera.png')
bpy.ops.render.render(write_still=True)
