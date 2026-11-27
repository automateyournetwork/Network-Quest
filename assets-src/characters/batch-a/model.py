# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Editable rigid articulation and hand-shaped profile meshes for character batch A."""
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
SCRIPTS = Path(__file__).resolve().parent
OUT = ROOT / 'docs/evidence/spec001/assets/t107'
LOCAL = ROOT / '.local/t107'
LOCAL.mkdir(parents=True, exist_ok=True)
OUT.mkdir(parents=True, exist_ok=True)
TAU = math.tau

# Display sRGB swatches. Blender's material node accepts scene-linear values.
SWATCHES = {
    'basalt':'304754', 'slate':'547282', 'night':'192932', 'ink':'182026',
    'iron':'435861', 'cream':'f3dfb3', 'pearl':'e2f3e5', 'ivory':'f8e8cd',
    'copper':'ba744b', 'brass':'eaba77','clay':'c4644a','umber':'6c4034',
    'teal':'318b83','glass':'79c8bd','spruce':'246561','violet':'817499',
    'plum':'614c66','blue':'507e9e','azure':'69a7bd','paper':'e5ce9c',
    'olive':'76744b','black':'121c25','coral':'eb8e6d','red':'a84440',
    'sage':'98ae91','lichen':'6d9380','sand':'c9a77e','flame':'ffd184'
}
METAL = {'copper', 'brass', 'iron'}
MATS = {}
REST = {}
RIG = {}


def reset(asset):
    global ID, ORIGIN
    ID = asset
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    MATS.clear()
    REST.clear()
    RIG.clear()
    for key, hexcolor in SWATCHES.items():
        mat = bpy.data.materials.new(key.title())
        rgb = [int(hexcolor[i:i+2],16) / 255 for i in (0,2,4)]
        linear = [v / 12.92 if v <= .04045 else ((v + .055) / 1.055)**2.4 for v in rgb]
        mat.diffuse_color = (*linear,1)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = (*linear,1)
        shader.inputs['Metallic'].default_value = .48 if key in METAL else .035
        shader.inputs['Roughness'].default_value = .35 if key in METAL or key == 'glass' else .58
        MATS[key] = mat
    ORIGIN = joint('floor_root', (0,0,0), None)
    ORIGIN['assetId'] = 'spec001:ASSET-' + asset
    ORIGIN['units'] = 'metres; Blender +Z up, faces principally -Y'
    ORIGIN['collision'] = 'presentation-only; no navigation collision'


def joint(name, point, parent):
    obj = bpy.data.objects.new(ID+'_'+name, None)
    bpy.context.scene.collection.objects.link(obj)
    REST[obj.name] = Vector(point)
    obj.parent = parent
    obj.location = Vector(point) - (REST[parent.name] if parent else Vector((0,0,0)))
    obj.empty_display_type = 'PLAIN_AXES'
    obj.empty_display_size = .055
    RIG[name] = obj
    return obj


def mesh(name, vertices, faces, materials, parent, indices=None, smooth=True):
    data = bpy.data.meshes.new(ID+'_'+name)
    origin = REST[parent.name]
    data.from_pydata([Vector(v)-origin for v in vertices], [], faces)
    data.update()
    obj = bpy.data.objects.new(ID+'_'+name, data)
    bpy.context.scene.collection.objects.link(obj)
    obj.parent = parent
    for material in materials:
        data.materials.append(MATS[material])
    for i, face in enumerate(data.polygons):
        face.use_smooth = smooth
        if indices:
            face.material_index = indices[i]
    return obj


def signed_pow(v, exponent):
    return math.copysign(abs(v)**exponent,v)


def egg(name, center, size, mat, parent, exponent=1, tilt=0, sides=16, rings=10):
    """Rounded, boxy or tapered facial forms; tilt about Y in world authoring coordinates."""
    cx,cy,cz = center
    rx,ry,rz = size
    co,si = math.cos(tilt),math.sin(tilt)
    def point(x,y,z):
        return (cx+co*x+si*z, cy+y, cz-si*x+co*z)
    vs = [point(0,0,-rz)]
    for j in range(1,rings):
        a = -math.pi/2 + j*math.pi/rings
        ca,sa = signed_pow(math.cos(a),exponent),signed_pow(math.sin(a),exponent)
        for i in range(sides):
            b = i*TAU/sides
            vs.append(point(rx*ca*signed_pow(math.cos(b),exponent),ry*ca*signed_pow(math.sin(b),exponent),rz*sa))
    vs.append(point(0,0,rz))
    fs = [(0,1+(i+1)%sides,1+i) for i in range(sides)]
    for j in range(rings-2):
        start=1+j*sides
        fs.extend((start+i,start+(i+1)%sides,start+sides+(i+1)%sides,start+sides+i) for i in range(sides))
    start=1+(rings-2)*sides
    fs.extend((start+i,start+(i+1)%sides,len(vs)-1) for i in range(sides))
    return mesh(name,vs,fs,[mat],parent)


def tube(name, knots, radii, mat, parent, *, bands=None, sides=12, steps=4):
    """Catmull-Rom centreline with transported, tapered rings and optional inlaid material bands."""
    pts=list(map(Vector,knots)); vs=[]; fs=[]; mi=[]
    materials=[mat]+list(dict.fromkeys((bands or {}).values()))
    expanded=[]
    for i in range(len(pts)-1):
        p0,p1,p2,p3 = pts[max(0,i-1)],pts[i],pts[i+1],pts[min(len(pts)-1,i+2)]
        for k in range(steps):
            t=k/steps
            point=.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t**3)
            expanded.append((point,radii[i]*(1-t)+radii[i+1]*t,i+k/steps))
    expanded.append((pts[-1],radii[-1],len(pts)-1))
    normal=None
    for n,(point,radius,pos) in enumerate(expanded):
        tangent=(expanded[min(n+1,len(expanded)-1)][0]-expanded[max(0,n-1)][0]).normalized()
        if normal is None:
            normal=tangent.cross(Vector((0,0,1)) if abs(tangent.z)<.85 else Vector((0,1,0))).normalized()
        normal=(normal-tangent*tangent.dot(normal)).normalized()
        binormal=tangent.cross(normal)
        for i in range(sides):
            a=TAU*i/sides
            vs.append(point+radius*(math.cos(a)*normal+math.sin(a)*binormal))
        if n:
            index=materials.index((bands or {}).get(n-1,mat))
            q=(n-1)*sides
            for i in range(sides):
                k=(i+1)%sides
                fs.append((q+i,q+k,q+sides+k,q+sides+i));mi.append(index)
    fs.extend([tuple(reversed(range(sides))), tuple(range(len(vs)-sides,len(vs)))]);mi.extend([0,0])
    return mesh(name,vs,fs,materials,parent,mi)


def stalk(name, points, radius, mat, parent):
    return tube(name,points,[radius]*len(points),mat,parent,sides=8)


def blade(name, outline, center, thick, mat, parent, back=None):
    """Domed plate/feather/scale, with intentional raised keel."""
    vs=[Vector(p) for p in outline]+[Vector(center)+Vector((0,-thick,0)),Vector(center)+Vector((0,thick,0))]
    l=len(outline); fs=[]
    for i in range(l):
        fs.extend([(i,(i+1)%l,l),((i+1)%l,i,l+1)])
    # Orient radial facets consistently towards their exterior.
    middle=Vector(center)
    for i,f in enumerate(fs):
        p,q,r=[vs[k] for k in f]
        if (q-p).cross(r-p).dot((p+q+r)/3-middle)<0: fs[i]=f[::-1]
    return mesh(name,vs,fs,[mat,back or mat],parent,[i%2 for i in range(len(fs))],smooth=False)


def eye(name, center, r, parent, glance=0):
    x,y,z=center
    egg(name+'_sclera',(x,y,z),(r*.92,r*.67,r*1.10),'cream',parent)
    egg(name+'_iris',(x+glance*r,y-r*.52,z),(r*.52,r*.29,r*.73),'spruce',parent)
    egg(name+'_pupil',(x+glance*r,y-r*.72,z),(r*.33,r*.16,r*.56),'ink',parent)
    egg(name+'_catchlight',(x+glance*r-r*.12,y-r*.84,z+r*.25),(r*.12,r*.08,r*.15),'pearl',parent,sides=10,rings=6)


def ring(name, center, radius, wire, parent, mat, *, plane='XZ'):
    x,y,z=center
    points=[]
    for i in range(17):
        a=i*TAU/16
        points.append((x+radius*math.cos(a),y if plane=='XZ' else y+radius*math.sin(a),z+radius*math.sin(a) if plane=='XZ' else z))
    return tube(name,points,[wire]*len(points),mat,parent,sides=8,steps=2)


def bounds():
    graph=bpy.context.evaluated_depsgraph_get()
    vertices=[obj.matrix_world @ v.co for obj in bpy.context.scene.objects if obj.type=='MESH' for v in obj.evaluated_get(graph).data.vertices]
    return [Vector([fn(v[i] for v in vertices) for i in range(3)]) for fn in (min,max)]


def animate(name, frames, motions):
    # Each authored channel specifies a joint, property, axis, amplitude and phase function.
    animated={RIG[m[0]] for m in motions}
    initial={o:(o.location.copy(),o.rotation_euler.copy()) for o in animated}
    for frame in range(frames+1):
        t=frame/frames
        for o,(loc,rot) in initial.items():
            o.location=loc.copy();o.rotation_euler=rot.copy()
        for target,property_name,axis,amplitude,wave in motions:
            getattr(RIG[target],property_name)[axis] += amplitude*wave(t)
        for target,property_name in set((m[0],m[1]) for m in motions):
            RIG[target].keyframe_insert(property_name,frame=frame)
    for obj in animated:
        action=obj.animation_data.action
        action.name=obj.name+'_'+name
        action.use_fake_user=True
        track=obj.animation_data.nla_tracks.new();track.name=name
        track.strips.new(name,0,action);track.mute=True
        obj.animation_data.action=None
        obj.location,obj.rotation_euler=initial[obj]


def wave(t): return math.sin(TAU*t)
def gesture(t): return math.sin(math.pi*t)**2
def swivel(j,axis,value,fn=gesture): return (j,'rotation_euler',axis,value,fn)
def shift(j,axis,value,fn=gesture): return (j,'location',axis,value,fn)


def stage(low, high):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'
    sc.cycles.samples=6;sc.cycles.use_denoising=True
    sc.render.threads_mode='FIXED';sc.render.threads=3
    sc.view_settings.view_transform='Standard';sc.view_settings.look='None';sc.view_settings.exposure=-.50
    sc.render.film_transparent=True
    sc.render.resolution_x=540;sc.render.resolution_y=540;sc.render.resolution_percentage=100
    sc.render.image_settings.color_mode='RGBA'
    sc.world=bpy.data.worlds.new('Studio neutral ambient')
    sc.world.use_nodes=True;sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.45,.52,.60,1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value=.45
    center=(high+low)/2
    size=max(high-low)
    angles={'CH05':(-.22,-1,.27),'CH08':(-.52,-1,.29),'CH09':(-.74,-1,.82)}
    direction=Vector(angles.get(ID,(.40,-1,.35))).normalized()
    camdata=bpy.data.cameras.new('Inspection orthographic')
    cam=bpy.data.objects.new('Inspection camera',camdata);sc.collection.objects.link(cam)
    cam.location=center+direction*size*4;cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
    camdata.type='ORTHO'
    camdata.ortho_scale=size*1.33
    sc.camera=cam
    for name,offset,power,color in [('Warm key',(-2.6,-3.2,4),205,(1,.84,.70)),('Cool fill',(2,-2.2,2),125,(.72,.87,1)),('Pearl rim',(1,2,3),240,(.82,1,.94))]:
        data=bpy.data.lights.new(name,'AREA');obj=bpy.data.objects.new(name,data);sc.collection.objects.link(obj)
        obj.location=center+Vector(offset)*size
        obj.rotation_euler=(center-obj.location).to_track_quat('-Z','Y').to_euler()
        data.energy=power*size**2;data.shape='DISK';data.size=2.7*size;data.color=color


def build(asset, height, draw):
    reset(asset)
    model=joint('height_calibration',(0,0,0),ORIGIN)
    draw(model)
    bpy.context.view_layer.update()
    low,high=bounds()
    scale=height/(high.z-low.z)
    # Keep opposing party silhouettes inside the two 1.9 m-spaced slots even through the optical gestures.
    width,offset={'CH05':(.865,.10),'CH06':(.92,0)}.get(asset,(1,0))
    model.scale=(scale*width,scale,scale);model.location.x=offset;model.location.z=-low.z*scale
    bpy.context.view_layer.update()
    low,high=bounds()
    stage(low,high)
    sc=bpy.context.scene;sc.unit_settings.system='METRIC';sc.unit_settings.scale_length=1
    sc.render.fps=24;sc.frame_start=0;sc.frame_end=72;sc.frame_set(0)
    sc['rights']='Original Network Quest geometry, John Capobianco, CC BY 4.0 to the extent controlled.'
    path=ROOT/f'assets-src/characters/{asset}.blend'
    bpy.ops.wm.save_as_mainfile(filepath=str(path),compress=True)
    sc.render.filepath=str(OUT/f'{asset}-source.png')
    bpy.ops.render.render(write_still=True)
    print('T107 authored',asset,low[:],high[:],flush=True)
