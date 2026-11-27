# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Run in Blender background with -- PRnnn [PRnnn ...]. Save editable, grounded objects."""
import sys
from pathlib import Path
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from workshop import *
import copper
import json

roster = json.loads((ROOT/'assets-src/rooms/scene-layouts.json').read_text())
placements = {p['semanticId'].split(':')[1]:p for room in roster['rooms'][2:4] for p in room['propPlacements']}
builders = [copper.twisted_pair_cutaway,copper.patch_panel,copper.cracked_spool,copper.tray_elbow,copper.pair_separator,
            copper.interference_motor,copper.shielding_section,copper.damaged_plug,copper.continuity_pedestal,copper.route_wheel]
ids=sys.argv[sys.argv.index('--')+1:]
if any(int(i[2:])>=31 for i in ids):
    import echo
    builders.extend(echo.designs)
for asset in ids:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATS.clear()
    bpy.context.preferences.filepaths.save_version=0
    place=placements[asset]
    builders[int(asset[2:])-21]()
    scene=bpy.context.scene
    scene.unit_settings.system='METRIC'
    scene.unit_settings.scale_length=1
    bpy.context.view_layer.update()
    objects=list(scene.objects)
    # Apply the individual bevels/normals before measuring or optimizing.
    for obj in objects:
        bpy.context.view_layer.objects.active=obj
        for mod in list(obj.modifiers): bpy.ops.object.modifier_apply(modifier=mod.name)
    pts=[obj.matrix_world@v.co for obj in objects for v in obj.data.vertices]
    low=Vector([min(p[i] for p in pts) for i in range(3)]);hi=Vector([max(p[i] for p in pts) for i in range(3)])
    dims=hi-low
    envelope=place['candidateEnvelope']
    scale=min(envelope[k]/dims[i] for i,k in enumerate(['width','depth','height']))
    center=Vector(((hi.x+low.x)/2,(hi.y+low.y)/2,low.z))
    root=bpy.data.objects.new(asset,None);bpy.context.collection.objects.link(root)
    root['identity']=place['semanticId'];root['title']=place['sourceName'];root['authoringOrigin']='centre of footprint at support plane'
    transform=Matrix.Scale(scale,4)@Matrix.Translation(-center)
    for obj in objects:
        # Local meshes stay separately editable. Their local origins follow their finished positions.
        world=transform@obj.matrix_world
        offset=world.translation.copy()
        obj.data.transform(Matrix.Translation(-offset)@world)
        obj.parent=root;obj.matrix_basis=Matrix.Translation(offset)
    scene.world=bpy.data.worlds.new('Studio atmosphere')
    scene.world.use_nodes=True
    scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.48,.52,.55,1)
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.55
    scene.render.engine='CYCLES'
    scene.cycles.samples=12;scene.cycles.use_denoising=True;scene.cycles.device='CPU'
    scene.render.threads_mode='FIXED';scene.render.threads=2
    scene.render.resolution_x=scene.render.resolution_y=540
    scene.render.resolution_percentage=100;scene.render.film_transparent=True
    scene.view_settings.view_transform='Standard';scene.view_settings.look='None';scene.view_settings.exposure=-.55
    target=Vector((0,0,dims.z*scale/2))
    direction=Vector((.67,-1.66,.79)).normalized()
    if asset=='PR028':direction=Vector((.57,-1.28,1.23)).normalized()
    quat=(-direction).to_track_quat('-Z','Y')
    # Project actual vertices on screen to centre a slender/tall or asymmetric tool without clipping.
    vp=[quat.inverted()@(transform@p-target) for p in pts]
    xmin,xmax=min(p.x for p in vp),max(p.x for p in vp)
    ymin,ymax=min(p.y for p in vp),max(p.y for p in vp)
    span=max(xmax-xmin,ymax-ymin)*1.20
    target+=quat@Vector(((xmax+xmin)/2,(ymax+ymin)/2,0))
    camdata=bpy.data.cameras.new('Inventory lens'); cam=bpy.data.objects.new('Inventory lens',camdata);scene.collection.objects.link(cam)
    cam.location=target+direction*4;cam.rotation_euler=quat.to_euler();camdata.type='ORTHO';camdata.ortho_scale=span;scene.camera=cam
    scene['comparisonTarget']=list(target)
    for name,pos,color,power,size in [('Hearth key',(-3,-4,5),(1,.83,.65),330,3.5),('Cool fill',(3,-2,3),(.68,.85,1),230,3),('Pearl rim',(1,2,4),(.79,1,.91),330,2.5)]:
        data=bpy.data.lights.new(name,'AREA'); lamp=bpy.data.objects.new(name,data);scene.collection.objects.link(lamp)
        lamp.location=Vector(pos)+target;lamp.rotation_euler=(target-lamp.location).to_track_quat('-Z','Y').to_euler();data.energy=power;data.shape='DISK';data.size=size;data.color=color
    bpy.context.view_layer.update()
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                space=area.spaces.active;space.region_3d.view_rotation=quat;space.region_3d.view_location=target;space.region_3d.view_distance=span*1.8;space.region_3d.view_perspective='ORTHO';space.shading.color_type='MATERIAL'
    bpy.ops.object.select_all(action='DESELECT')
    root.select_set(True);bpy.context.view_layer.objects.active=root
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/(asset+'.blend')),compress=True)
    print('SAVED',asset,place['sourceName'],flush=True)
