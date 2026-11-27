# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""blender -b -t 2 -P assets-src/props/R07-R08/build.py -- 61 ..."""
import json
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from parts import *
import skywell
import observatory

layout=json.loads((ROOT/'assets-src/rooms/scene-layouts.json').read_text())
placements={int(p['semanticId'][-3:]):p for room in layout['rooms'][6:8] for p in room['propPlacements'][:10]}
models={**skywell.MODELS,**observatory.MODELS}
for n in map(int,sys.argv[sys.argv.index('--')+1:]):
    p=placements[n]; code=f'PR{n:03}'
    start(code)
    models[n]()
    meshes=list(bpy.context.scene.objects)
    bpy.context.view_layer.update()
    lo,hi=bounds(meshes)
    # Preserve circles / lens shapes. Fit the frozen authoring envelope uniformly.
    e=p['candidateEnvelope']
    scale=min(e[k]/(hi-lo)[j] for j,k in enumerate(('width','depth','height')))
    midpoint=(lo+hi)/2
    rig=bpy.data.objects.new(code+' floor origin',None)
    bpy.context.collection.objects.link(rig)
    fit=bpy.data.objects.new(code+' fixture scale',None)
    bpy.context.collection.objects.link(fit)
    fit.parent=rig
    for o in meshes: o.parent=fit
    fit.scale=(scale,)*3
    fit.location=(-midpoint.x*scale,-midpoint.y*scale,-lo.z*scale)
    rig['assetId']=p['assetId'];rig['displayName']=p['sourceName']
    rig['originDescription']='Ground plane centered under the fixture; faces Blender negative Y.'
    bpy.context.view_layer.update()
    lo,hi=bounds(meshes); focus=(lo+hi)/2; size=max(hi-lo)
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'
    scene.render.engine='CYCLES';scene.cycles.samples=10;scene.cycles.use_denoising=True
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.film_transparent=True
    scene.render.resolution_x=448;scene.render.resolution_y=448;scene.render.resolution_percentage=100
    scene.render.image_settings.color_mode='RGBA'
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.45
    world=bpy.data.worlds.new('Studio ambient');scene.world=world;world.use_nodes=True
    bg=world.node_tree.nodes.get('Background')
    bg.inputs['Color'].default_value=(.52,.6,.65,1);bg.inputs['Strength'].default_value=.45
    cam=bpy.data.cameras.new('Orthographic inspection');camera=bpy.data.objects.new('Inspection camera',cam)
    scene.collection.objects.link(camera);scene.camera=camera
    angle={61:(.62,-1,.47),64:(.31,-1,.76),66:(.32,-1,.45),71:(.38,-1,.4),77:(.39,-1,.32),80:(.35,-1,.58)}.get(n,(.43,-1,.38))
    camera.location=focus+Vector(angle).normalized()*size*4
    camera.rotation_euler=(focus-camera.location).to_track_quat('-Z','Y').to_euler()
    cam.type='ORTHO'
    # Project actual model vertices before framing. A deep base can be wider in
    # this oblique view than its largest world-axis extent.
    camera_basis=camera.rotation_euler.to_matrix()
    right=camera_basis @ Vector((1,0,0)); up=camera_basis @ Vector((0,1,0))
    deps=bpy.context.evaluated_depsgraph_get()
    extent=0
    for obj in meshes:
        ev=obj.evaluated_get(deps)
        for vertex in ev.data.vertices:
            delta=ev.matrix_world @ vertex.co-focus
            extent=max(extent,abs(delta.dot(right)),abs(delta.dot(up)))
    cam.ortho_scale=max(size*1.20,extent*2.19)
    for name,offset,power,color in [('Amber key',(-2.4,-3,4),212,(1,.88,.75)),('Cool fill',(2,-1.7,2),115,(.71,.87,1)),('Pearl rim',(1,2,3.2),235,(.84,1,.94))]:
        data=bpy.data.lights.new(name,'AREA'); obj=bpy.data.objects.new(name,data);scene.collection.objects.link(obj)
        obj.location=focus+Vector(offset)*size
        obj.rotation_euler=(focus-obj.location).to_track_quat('-Z','Y').to_euler()
        data.energy=power*size**2;data.shape='DISK';data.size=2.6*size;data.color=color
    scene['attribution']='Original Network Quest model, 2026 John Capobianco. CC BY 4.0 to the extent project-controlled.'
    scene['plannedRoom']=p['sourceAllocation']
    scene['fixtureScale']=scale
    scene['focus']=list(focus)
    bpy.ops.object.select_all(action='DESELECT')
    rig.select_set(True);bpy.context.view_layer.objects.active=rig
    # Give editors the same initial angle used in the review.
    for area in bpy.context.screen.areas:
        if area.type=='VIEW_3D':
            area.spaces.active.region_3d.view_rotation=camera.rotation_euler.to_quaternion()
            area.spaces.active.region_3d.view_distance=size*2.2
            area.spaces.active.region_3d.view_location=focus
            area.spaces.active.shading.color_type='MATERIAL'
    bpy.ops.wm.save_as_mainfile(filepath=str(DIR/(code+'.blend')),compress=True)
