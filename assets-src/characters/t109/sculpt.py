# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Blender construction vocabulary for the eight original T109 character maquettes.
Material transfer and neutral studio conventions follow the original R01 benchmark.
All primitive dimensions and articulation points are in local Blender coordinates.
"""
import math
from pathlib import Path

import bpy
from mathutils import Vector, geometry

ROOT = Path(__file__).resolve().parents[3]
OUT = ROOT / 'docs/evidence/spec001/assets/t109'
MODELS = ROOT / 'public/assets/models'
SOURCE = ROOT / 'assets-src/characters'
PALETTE = {
    'slate': ('364E61', .18), 'ink': ('182A36', .12), 'charcoal': ('40515C', .03),
    'teal': ('368B86', .12), 'sea': ('205A60', .14), 'mint': ('A5D6BF', .14),
    'brass': ('DCAB66', .58), 'copper': ('B76F49', .55), 'cream': ('F0DDB8', .02),
    'coal': ('15232B', .03), 'rust': ('BD6850', .17), 'plum': ('765668', .03),
    'iris': ('8E79AD', .12), 'blue': ('689CB7', .12), 'ochre': ('D7A454', .35),
    'pearl': ('CEE7DA', .12), 'amber': ('EFB15F', .15), 'olive': ('65956D', .06),
    'pine': ('385E50', .12), 'stone': ('657581', .05), 'walnut': ('664D43', .03),
}
M = {}
ID = ''


def reset(asset):
    global ID
    ID = asset
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    M.clear()
    for n, (hexcolor, metal) in PALETTE.items():
        srgb = [int(hexcolor[i:i+2], 16)/255 for i in (0, 2, 4)]
        linear = [v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4 for v in srgb]
        mat = bpy.data.materials.new(n)
        mat.diffuse_color = (*linear, 1)
        mat.use_nodes = True
        bsdf = mat.node_tree.nodes.get('Principled BSDF')
        bsdf.inputs['Base Color'].default_value = mat.diffuse_color
        bsdf.inputs['Metallic'].default_value = metal
        bsdf.inputs['Roughness'].default_value = .36 if metal > .3 else .54
        M[n] = mat
    sc = bpy.context.scene
    sc.unit_settings.system = 'METRIC'
    sc.render.fps = 24
    sc['rights'] = 'Copyright 2026 John Capobianco. Creative materials CC BY 4.0 to the extent controlled.'
    sc['assetId'] = 'spec001:ASSET-'+asset
    return group('pivot')


def group(n, loc=(0,0,0), parent=None):
    obj = bpy.data.objects.new(ID+'_'+n, None)
    bpy.context.collection.objects.link(obj)
    obj.parent = parent
    obj.location = loc
    obj.empty_display_size = .06
    return obj


def finish(obj, n, p, mat, smooth=True):
    obj.name = ID+'_'+n
    obj.data.name = obj.name
    obj.parent = p
    obj.data.materials.append(M[mat])
    for face in obj.data.polygons:
        face.use_smooth = smooth
    return obj


def mesh(n, p, points, faces, mat, smooth=True):
    data = bpy.data.meshes.new(n)
    data.from_pydata(points, [], faces)
    data.update()
    obj = bpy.data.objects.new(n, data)
    bpy.context.collection.objects.link(obj)
    return finish(obj, n, p, mat, smooth)


def oval(n, p, loc, radii, mat, tilt=0, detail=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=detail, ring_count=10, location=loc)
    obj = bpy.context.object
    obj.scale = radii
    obj.rotation_euler.y = tilt
    return finish(obj,n,p,mat)


def block(n,p,loc,size,mat,edge=.04,tilt=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj=bpy.context.object
    for v in obj.data.vertices:
        v.co.x *= size[0]
        v.co.y *= size[1]
        v.co.z *= size[2]
    obj.rotation_euler.y = tilt
    mod=obj.modifiers.new('Cast rounded edges','BEVEL')
    mod.width=edge
    mod.segments=3
    mod=obj.modifiers.new('Planar face normals','WEIGHTED_NORMAL')
    return finish(obj,n,p,mat,False)


def tube(n,p,points,radii,mat,sides=10,steps=4,depth=1):
    """Variable-radius Catmull–Rom sweep with a parallel-transport cross section."""
    knots = [Vector((*xyz,r)) for xyz,r in zip(points,radii,strict=True)]
    samples = []
    for k in range(len(knots)-1):
        a,b,c,d = (knots[max(0,min(len(knots)-1,k+j))] for j in (-1,0,1,2))
        for i in range(steps):
            t = i/steps
            samples.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t**3))
    samples.append(knots[-1])
    centers = [v.to_3d() for v in samples]
    verts=[]; faces=[]; axis=None
    for i,center in enumerate(centers):
        tangent=(centers[min(i+1,len(centers)-1)]-centers[max(i-1,0)]).normalized()
        if axis is None:
            axis=Vector((0,1,0)) if abs(tangent.y)<.9 else Vector((1,0,0))
        axis=(axis-tangent*axis.dot(tangent)).normalized()
        cross=tangent.cross(axis)
        r=max(samples[i].w,.0009)
        for j in range(sides):
            ang=j*math.tau/sides
            verts.append(center+r*(math.cos(ang)*axis*depth+math.sin(ang)*cross))
        if i:
            for j in range(sides):
                a=(i-1)*sides+j; b=(i-1)*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
    faces += [tuple(reversed(range(sides))),tuple(range(len(verts)-sides,len(verts)))]
    return mesh(n,p,verts,faces,mat)


def plate(n,p,outline,y,thick,mat,edge=.014):
    """Extruded x/z silhouette with robust triangulation for concave panels."""
    area=sum(x1*z2-x2*z1 for (x1,z1),(x2,z2) in zip(outline,outline[1:]+outline[:1]))
    if area<0:
        outline=list(reversed(outline))
    verts=[Vector((x,y+dy,z)) for dy in (-thick/2,thick/2) for x,z in outline]
    count=len(outline)
    tris=geometry.tessellate_polygon([verts[:count]])
    faces=[tuple(t) for t in tris]+[tuple(i+count for i in reversed(t)) for t in tris]
    faces += [((i+1)%count,i,i+count,(i+1)%count+count) for i in range(count)]
    o=mesh(n,p,verts,faces,mat,False)
    if edge:
        mod=o.modifiers.new('Rounded silhouette','BEVEL');mod.width=edge;mod.segments=2
        o.modifiers.new('Planar face normals','WEIGHTED_NORMAL')
    return o


def ring(n,p,loc,rx,rz,thickness,mat,tilt=0):
    pts=[(rx*math.cos(j*math.tau/32),0,rz*math.sin(j*math.tau/32)) for j in range(33)]
    o=tube(n,p,pts,[thickness]*len(pts),mat,8,1)
    o.location=loc; o.rotation_euler.y=tilt
    return o


def eye(n,p,loc,s,look=0):
    x,y,z=loc
    oval(n+' socket',p,(x,y+.10*s,z),(s*1.12,s*.62,s*1.12),'ink')
    oval(n+' ivory',p,loc,(s,.58*s,s*1.02),'cream')
    oval(n+' pupil',p,(x+s*look,y-.46*s,z+.04*s),(s*.49,s*.27,s*.62),'coal')
    oval(n+' catchlight',p,(x+s*(look-.16),y-.66*s,z+.34*s),(s*.14,s*.09,s*.15),'pearl',detail=12)


def rod(n,p,a,b,r,mat):
    return tube(n,p,[a,b],[r,r],mat,12,1)


def rivet(n,p,loc,r=.027):
    return oval(n,p,loc,(r,.43*r,r),'brass',detail=12)


def animate(name,seconds,movements):
    """Per-joint rest and gesture poses. A stationary asset root is never keyed.
    movements gives a local component and a five-point cyclic or one-shot phrase.
    """
    length=round(seconds*24)
    for obj, path, axis, values in movements:
        assert len(values)==5
        vector=getattr(obj,path)
        base=vector[axis]
        for f,delta in zip([0,round(length*.25),round(length*.5),round(length*.75),length],values):
            vector[axis]=base+delta
            obj.keyframe_insert(data_path=path,index=axis,frame=f)
        action=obj.animation_data.action
        action.name=f'{obj.name} {name}'
        track=obj.animation_data.nla_tracks.new();track.name=name
        track.strips.new(name,0,action)
        obj.animation_data.action=None;track.mute=True
        vector[axis]=base
    bpy.context.scene.frame_set(0)


def bounds(objects):
    dg=bpy.context.evaluated_depsgraph_get()
    pts=[]
    for obj in objects:
        if obj.type=='MESH':
            e=obj.evaluated_get(dg)
            pts.extend(e.matrix_world@v.co for v in e.data.vertices)
    return [[min(p[i] for p in pts) for i in range(3)],[max(p[i] for p in pts) for i in range(3)]]


def studio(center,span,view=(.42,-1,.26)):
    """Consistent, warm-key / cool-fill Cycles setup; camera aims at measured asset."""
    sc=bpy.context.scene
    center=Vector(center)
    sc.render.engine='CYCLES'; sc.cycles.samples=12;sc.cycles.use_denoising=True
    sc.render.threads_mode='FIXED';sc.render.threads=2
    sc.render.resolution_x=480;sc.render.resolution_y=480;sc.render.resolution_percentage=100
    sc.view_settings.view_transform='Standard';sc.view_settings.look='None'
    sc.world=bpy.data.worlds.new('Basalt studio');sc.world.use_nodes=True
    bg=sc.world.node_tree.nodes.get('Background');bg.inputs[0].default_value=(.085,.133,.17,1);bg.inputs[1].default_value=.5
    bpy.ops.object.camera_add(location=center+Vector(view).normalized()*span*3)
    cam=bpy.context.object;cam.name='Review camera';cam.data.type='ORTHO';cam.data.ortho_scale=span
    cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();sc.camera=cam
    for n,offset,power,col,size in [('Warm softbox',(-2,-3,4),210,(1,.83,.68),2),('Blue bounce',(3,-2,2),160,(.61,.82,1),2.2),('Rim',(1,2.5,3),330,(.88,1,.93),1.6)]:
        bpy.ops.object.light_add(type='AREA',location=center+Vector(offset)*span)
        o=bpy.context.object;o.name=n;o.data.energy=power*span**2;o.data.color=col;o.data.size=size*span
        o.rotation_euler=(center-o.location).to_track_quat('-Z','Y').to_euler()
