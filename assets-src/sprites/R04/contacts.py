# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Reopen the complete saved stage and switch off the floor to distinguish mesh feet from shadows."""
import bpy
import json
from pathlib import Path

root = Path.cwd()
source = root/'assets-src/sprites/R04'
work = root/'.local/T134/contacts'
work.mkdir(exist_ok=True,parents=True)
native = json.loads((source/'native-frames.json').read_text())
bpy.ops.wm.open_mainfile(filepath=str(source/'R04-sprite-stage.blend'))
sc=bpy.context.scene
floor=bpy.data.objects['Painted gallery floor · shadow receiver']
floor.hide_render=True
sc.render.use_border=sc.render.use_crop_to_border=True
for id in ['CH01','PR031','PR035','CH13','CH20']:
    for obj in native['subjects']:
        bpy.data.collections[obj+' stage'].hide_render=(obj!=id)
    l,t,r,b=native['subjects'][id]['renderCrop']
    w,h=native['stageSize']
    sc.render.border_min_x,sc.render.border_max_x=l/w,r/w
    sc.render.border_min_y,sc.render.border_max_y=(h-b)/h,(h-t)/h
    sc.frame_set(0)
    sc.render.filepath=str(work/(id+'.png'))
    bpy.ops.render.render(write_still=True)
