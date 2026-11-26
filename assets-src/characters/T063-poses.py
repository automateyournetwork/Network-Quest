# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Additional native-source pose samples. Does not resave or mutate source artifacts."""
import bpy,json,math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2];E=ROOT/'docs/evidence/spec001/assets';sc=bpy.context.scene;kind=Path(bpy.data.filepath).stem;result={};rest={o:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in sc.objects}
active=None
def capture(scene,dg):
 if active and dg.mode=='RENDER':
  result[active]={'frame':scene.frame_current+scene.frame_subframe,'worldMatrices':{o.name:[v for row in o.evaluated_get(dg).matrix_world for v in row] for o in scene.objects if o.type=='MESH' and not o.name.startswith('COLLISION')}}
bpy.app.handlers.frame_change_post.append(capture)
clips=['idle','walk','reaction'] if kind=='CH01' else ['idle','fly','reaction']
for name in clips:
 for o in sc.objects:
  if o.animation_data:
   for track in o.animation_data.nla_tracks:track.mute=track.name!=name
 end=96 if name=='idle' else 30 if name=='fly' else 24
 for fraction in (.25,.5):
  sc.frame_set(int(end*fraction),subframe=end*fraction%1)
  key=name+('-quarter' if fraction==.25 else '-half')
  active=key
  sc.render.filepath=str(E/f't063-{kind}-source-{key}.png');bpy.ops.render.render(write_still=True)
active=None
for o in sc.objects:
 if o.animation_data:
  for t in o.animation_data.nla_tracks:t.mute=True
for o,(loc,rot,scale) in rest.items():o.location=loc;o.rotation_euler=rot;o.scale=scale
sc.frame_set(1);sc.render.resolution_x=640;sc.render.resolution_y=640
height=.89 if kind=='CH01' else 1.2;sc.camera.data.ortho_scale=2.2 if kind=='CH01' else 1.4
for label,pos in [('front',(0,-5,height)),('side',(5,0,height))]:
 sc.camera.location=pos;sc.camera.rotation_euler=(Vector((0,0,height))-sc.camera.location).to_track_quat('-Z','Y').to_euler();sc.render.filepath=str(E/f't063-{kind}-source-{label}.png');bpy.ops.render.render(write_still=True)
(ROOT/f'assets-src/characters/{kind}-native-poses.json').write_text(json.dumps(result,indent=2)+'\n')
