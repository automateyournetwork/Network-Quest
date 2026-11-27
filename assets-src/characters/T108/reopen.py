# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Open each saved character from disk, export the model and render poses."""
import json
import sys
from pathlib import Path
import bpy
from mathutils import Vector
BASE=Path(__file__).resolve().parents[3]
OUT=BASE/'docs/evidence/spec001/assets/T108'
REPORTS=BASE/'docs/evidence/spec001/character-production/T108'
REPORTS.mkdir(parents=True,exist_ok=True)
def reopen(asset):
    source=BASE/'assets-src/characters'/f'{asset}.blend'
    def native_scene():
        bpy.ops.wm.open_mainfile(filepath=str(source))
        scene=bpy.context.scene
        collection=bpy.data.collections[asset+'.editable parts']
        nodes=[o for o in collection.objects if o.name!=asset+'.collision-envelope']
        return scene,collection,nodes
    sc,model,exportable=native_scene()
    target=BASE/'public/assets/models'/f'{asset}.glb'
    info={'blender':bpy.app.version_string,'buildHash':bpy.app.build_hash.decode(),
          'opened':str(source.relative_to(BASE)),'collection':model.name,
          'objects':[o.name for o in exportable],'focus':list(sc['focus']),'span':sc['span'],
          'camera':list(sc.camera.location),'clips':{},
          'materials':sorted(m.name for m in bpy.data.materials if m.users),
          'metersPerUnit':sc.unit_settings.scale_length,'fps':sc.render.fps}
    evaluation={}
    def measure(scene,graph):
        if graph.mode!='RENDER': return
        points=[]
        for obj in exportable:
            if obj.type!='MESH': continue
            evaluated=obj.evaluated_get(graph)
            points.extend(evaluated.matrix_world@vertex.co for vertex in evaluated.data.vertices)
        evaluation['bounds']=[[fn(p[i] for p in points) for i in range(3)] for fn in (min,max)]
        evaluation['frame']=scene.frame_current
    def capture(frame,label=None):
        evaluation.clear()
        sc.frame_set(frame)
        sc.render.resolution_percentage=100 if label else 3
        if label: sc.render.filepath=str(OUT/f'{asset}-source-{label}.png')
        bpy.ops.render.render(write_still=bool(label))
        assert evaluation['frame']==frame, 'No render-depsgraph measurement'
        return evaluation['bounds']
    bpy.app.handlers.frame_change_post.append(measure)
    animated=[o for o in exportable if o.animation_data and o.animation_data.nla_tracks]
    initial={o:(o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in animated}
    try:
        info['nativeBounds']=capture(0,'rest')
        for clip in sorted({t.name for o in animated for t in o.animation_data.nla_tracks}):
            for o in animated:
                for t in o.animation_data.nla_tracks: t.mute=True
                o.location,o.rotation_euler,o.scale=initial[o]
            tracks=[t for o in animated for t in o.animation_data.nla_tracks if t.name==clip]
            for t in tracks: t.mute=False
            strip=tracks[0].strips[0]
            assert strip.frame_start==0
            duration=strip.frame_end-strip.frame_start
            samples=[]
            for fraction in (0,.25,.5,.75,1):
                frame=round(duration*fraction)
                sample=capture(frame,clip if fraction==.5 else None)
                samples.append({'seconds':frame/sc.render.fps,'bounds':sample})
            info['clips'][clip]={'frames':duration,'sampledFrame':round(duration/2),'samples':samples,
                                'nativeBounds':samples[2]['bounds'],
                                'joints':[o.name for o in animated if clip in o.animation_data.nla_tracks]}
    finally:
        bpy.app.handlers.frame_change_post.remove(measure)
    # Reopen once more for export so the last sampled pose cannot become the default.
    sc,model,exportable=native_scene()
    sc.frame_set(0)
    # Consolidate rigid shapes on the in-memory export copy. The saved source
    # retains each handle, feather, fitting and expression as an editable object.
    groups={}
    for mesh in exportable:
        if mesh.type=='MESH':
            groups.setdefault(mesh.parent,[]).append(mesh)
    info['rigidPartSources']={}
    for parent, shapes in groups.items():
        names=[o.name for o in shapes]
        bpy.ops.object.select_all(action='DESELECT')
        for o in shapes: o.select_set(True)
        bpy.context.view_layer.objects.active=shapes[0]
        if len(shapes)>1: bpy.ops.object.join()
        merged=bpy.context.view_layer.objects.active
        merged.name=parent.name+'.sculpt'
        info['rigidPartSources'][merged.name]=names
    bpy.ops.object.select_all(action='DESELECT')
    for o in model.objects:
        if o.name!=asset+'.collision-envelope': o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=str(target),export_format='GLB',use_selection=True,
        export_yup=True,export_extras=True,export_cameras=False,export_lights=False,
        export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',
        export_force_sampling=True,export_frame_range=False,export_materials='EXPORT')
    (REPORTS/f'{asset}-native.json').write_text(json.dumps(info,indent=2)+'\n')
for identification in sys.argv[sys.argv.index('--')+1:]: reopen(identification)
