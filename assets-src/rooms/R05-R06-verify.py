# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Inspect a reopened native room and render an object-ID pass for exact visible/overlap measurements."""
import bpy
import hashlib
import json
import struct
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view

base = Path(__file__).resolve().parents[2]
code = Path(bpy.data.filepath).stem
assert code in ('R05','R06')
data = json.loads((base/f'content/spec001/presentation/{code}.json').read_bytes())
registration = json.loads((base/f'assets-src/rooms/{code}-registration.json').read_bytes())
out = base/f'docs/evidence/spec001/final-rooms/T137/{code}'
scene = bpy.context.scene
def digest(p):
    b=p.read_bytes()
    return dict(path=str(p.relative_to(base)),bytes=len(b),sha256=hashlib.sha256(b).hexdigest())
def native(p):return Vector((p[0],-p[2],p[1]))
def uv(p):
    v=world_to_camera_view(scene,scene.camera,p)
    return [v.x,1-v.y]
camera=data['camera']
assert scene.camera.data.type=='ORTHO' and abs(scene.camera.data.ortho_scale-camera['plateSpan'][0])<.00001
assert (native(camera['position'])-scene.camera.location).length<.00001
floorError=max(abs(a-b)*px for f in registration['frozenFloorAnchors'] for a,b,px in zip(f['uvAt16by9'],uv(native(f['world'])),(1280,720)))
assert floorError<.002
placements=[]
for m in data['models'][1:]:
    short=m['semanticId'].split(':')[1];root=bpy.data.objects[short+' placement']
    assert (root.location-native(m['position'])).length<.00001
    meshes=[o for o in root.children_recursive if o.type=='MESH']
    bounds=[o.matrix_world@Vector(p) for o in meshes for p in o.bound_box]
    assert meshes
    placements.append(dict(assetId=m['assetId'],input=digest(base/root['sourcePath']),position=m['position'],meshCount=len(meshes),
                           bottom=round(min(v.z for v in bounds),5),top=round(max(v.z for v in bounds),5)))
for i,p in enumerate(data['partyPositions']):
    assert (bpy.data.objects['Companion berth '+str(i+1)].location-native(p)).length<.00001
assert all(p.image.packed_file and tuple(p.image.size)==(1600,900) for p in scene.camera.data.background_images)
assert len(scene.camera.data.background_images)==3
arch=base/f'public/assets/models/{code}-architecture.glb'
raw=arch.read_bytes();g=json.loads(raw[20:20+struct.unpack_from('<I',raw,12)[0]])
assert len(g['extensions']['KHR_lights_punctual']['lights'])==2
anchors=[]
for a in data['anchors']:
    obj=bpy.data.objects[a['objectId']]
    assert (obj.location-native(a['position'])).length<.00001
    anchors.append(dict(objectId=a['objectId'],uv=uv(obj.location)))
report=dict(blender=bpy.app.version_string,source=digest(Path(bpy.data.filepath)),architecture=digest(arch),
            camera=camera,maximumFloorErrorAt1280=floorError,packedPlates=[p.image.name for p in scene.camera.data.background_images],
            positions=placements,anchors=anchors,party=data['partyPositions'],architectureNodes=[n['name'] for n in g['nodes']],
            runtimeLights=g['extensions']['KHR_lights_punctual']['lights'])
scene.render.filepath=str(out/'native-camera.png')
bpy.ops.render.render(write_still=True)
# Visible material-independent ID pass preserves depth and source geometry. Orthographic camera and scene framing are identical.
scene.render.engine='BLENDER_WORKBENCH'
scene.render.use_compositing=False;scene.render.film_transparent=True
sh=scene.display.shading;sh.light='FLAT';sh.color_type='OBJECT'
sh.show_shadows=sh.show_cavity=sh.show_specular_highlight=False
scene.display.render_aa='OFF'
scene.view_settings.view_transform='Standard'
palette={}
for i,m in enumerate(data['models'][1:],1):
    short=m['semanticId'].split(':')[1]; group=bpy.data.objects[short+' placement']
    color=[(i*59)%239+9,(i*91)%239+9,(i*157)%239+9]
    linear=[((x/255+.055)/1.055)**2.4 if x/255>.04045 else x/255/12.92 for x in color]
    for mesh in group.children_recursive:mesh.color=(*linear,1)
    palette[short]=color
for obj in bpy.data.collections['Built fabric and local practicals'].objects:obj.color=(.001,.001,.001,1)
bpy.data.objects['Optical floor • contact receiver'].hide_render=True
scene.render.filepath=str(out/'selection-survey.png');bpy.ops.render.render(write_still=True)
report['surveyPalette']=palette
(out/'source-reopen.json').write_text(json.dumps(report,indent=2,ensure_ascii=False)+'\n')
