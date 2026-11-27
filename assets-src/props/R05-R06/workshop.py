# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Parts for the optical workshop. Distances use Blender metres, with -Y toward the visitor."""
from pathlib import Path
import math
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[3]
DIR = Path(__file__).resolve().parent
RAW = ROOT / "docs/evidence/spec001/prop-production/T112"
TAU = math.tau
# The glass is opaque carved enamel so its silhouette survives the small room view.
PALETTE = {
    'basalt':('283a48',.12,.64), 'slate':('506677',.16,.54),
    'ink':('162a32',.06,.56), 'copper':('ad714f',.45,.34),
    'brass':('e5b46f',.42,.32), 'teal':('3e8981',.16,.38),
    'glass':('86bfb6',.12,.28), 'pearl':('d9e9d7',.08,.32),
    'violet':('8a79a6',.18,.37), 'plum':('624f70',.22,.42),
    'amber':('f2c27c',.09,.4), 'paper':('e8d9ae',.03,.64),
    'clay':('d47d63',.1,.53), 'blue':('6b9bb2',.15,.4),
}
materials = {}


def start(code):
    global prefix
    prefix = code
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.preferences.filepaths.save_version = 0
    materials.clear()
    for name, (hexval,metal,rough) in PALETTE.items():
        m = bpy.data.materials.new(name)
        c = [int(hexval[i:i+2],16)/255 for i in (0,2,4)]
        linear = tuple(v/12.92 if v < .04045 else ((v+.055)/1.055)**2.4 for v in c)
        m.diffuse_color = (*linear,1)
        m.use_nodes=True
        p=m.node_tree.nodes.get("Principled BSDF")
        p.inputs['Base Color'].default_value=(*linear,1)
        p.inputs['Metallic'].default_value=metal
        p.inputs['Roughness'].default_value=rough
        materials[name]=m


def mesh(name, vertices, faces, mat, smooth=False):
    data=bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    o=bpy.data.objects.new(prefix+' '+name,data)
    bpy.context.collection.objects.link(o)
    data.materials.append(materials[mat])
    if smooth:
        for face in data.polygons: face.use_smooth=True
    return o


def box(name, pos, dims, mat, bevel=.025):
    x,y,z=[v/2 for v in dims]
    pts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    o=mesh(name,pts,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    o.location=pos
    if bevel:
        mod=o.modifiers.new('Edge fillet','BEVEL')
        mod.width=min(bevel,min(dims)*.21)
        mod.segments=2
        mod.harden_normals=True
        normals=o.modifiers.new('Broad flat faces','WEIGHTED_NORMAL')
        normals.keep_sharp=True
    return o


def pipe(name, pts, radii, mat, sides=10, smooth=True):
    """Closed tapered sweep along the supplied centerline with a transported ring frame."""
    pts=list(map(Vector,pts))
    if isinstance(radii,(int,float)): radii=[radii]*len(pts)
    rings=[];faces=[];normal=None
    for i,(pt,r) in enumerate(zip(pts,radii)):
        direction=(pts[min(i+1,len(pts)-1)]-pts[max(i-1,0)]).normalized()
        if normal is None:
            normal=direction.cross(Vector((0,0,1)) if abs(direction.z)<.9 else Vector((0,1,0))).normalized()
        normal=(normal-direction*normal.dot(direction)).normalized()
        side=direction.cross(normal)
        rings += [pt+(normal*math.cos(TAU*j/sides)+side*math.sin(TAU*j/sides))*r for j in range(sides)]
        if i:
            first=(i-1)*sides
            for j in range(sides):
                k=(j+1)%sides
                faces.append((first+j,first+k,first+sides+k,first+sides+j))
    faces.extend([tuple(reversed(range(sides))), tuple(range(len(rings)-sides,len(rings)))])
    o=mesh(name,rings,faces,mat,smooth)
    for p in list(o.data.polygons)[-2:]: p.use_smooth=False
    return o


def lathe(name,x,y,profile,mat,sides=20,faceted=False):
    pts=[]; faces=[]
    for i,(r,z) in enumerate(profile):
        pts += [(x+r*math.cos(TAU*j/sides),y+r*math.sin(TAU*j/sides),z) for j in range(sides)]
        if i:
            for j in range(sides):
                a=(i-1)*sides+j; b=(i-1)*sides+(j+1)%sides
                faces.append((a,b,b+sides,a+sides))
    faces.extend([tuple(reversed(range(sides))),tuple(range(len(pts)-sides,len(pts)))])
    o=mesh(name,pts,faces,mat,not faceted)
    for p in list(o.data.polygons)[-2:]: p.use_smooth=False
    return o


def arc(name,c,rx,rz,angle1,angle2,radius,mat,sides=8,steps=24):
    x,y,z=c
    return pipe(name,[(x+rx*math.cos(t),y,z+rz*math.sin(t))
                      for t in [angle1+(angle2-angle1)*i/steps for i in range(steps+1)]],radius,mat,sides)


def lens(name,x,y,z,r,d,mat,sides=24):
    return pipe(name,[(x,y+d*.5,z),(x,y-d*.16,z),(x,y-d*.5,z)], [r*.94,r,r*.91],mat,sides)


def slab(name,outline,y,depth,mat):
    a=[(x,y-depth*.5,z) for x,z in outline]; b=[(x,y+depth*.5,z) for x,z in outline]
    n=len(a)
    area=sum(outline[i][0]*outline[(i+1)%n][1]-outline[(i+1)%n][0]*outline[i][1] for i in range(n))
    faces=[tuple(range(n)),tuple(reversed(range(n,2*n)))]
    faces += [(i,i+n,(i+1)%n+n,(i+1)%n) for i in range(n)]
    return mesh(name,a+b,[f if area>0 else tuple(reversed(f)) for f in faces],mat)


def leaf(name,base,tip,spread,mat):
    a,b=Vector(base),Vector(tip)
    side=Vector(spread)
    center=a.lerp(b,.47)
    pts=[a,center+side,b,center-side,center+Vector((0,-side.length*.58,side.length*.4)),
         center+Vector((0,side.length*.33,-side.length*.2))]
    return mesh(name,pts,[(0,1,4),(1,2,4),(2,3,4),(3,0,4),(1,0,5),(2,1,5),(3,2,5),(0,3,5)],mat)


# Original three-column enamel mosaic alphabet. Each run is an actual face.
GLYPHS = {
'A':'2 5 7 5 5','B':'6 5 6 5 6','C':'3 4 4 4 3','D':'6 5 5 5 6',
'E':'7 4 6 4 7','F':'7 4 6 4 4','G':'3 4 5 5 3','H':'5 5 7 5 5',
'I':'7 2 2 2 7','J':'1 1 1 5 2','K':'5 5 6 5 5','L':'4 4 4 4 7',
'M':'5 7 7 5 5','N':'5 7 7 7 5','O':'2 5 5 5 2','P':'6 5 6 4 4',
'Q':'2 5 5 3 1','R':'6 5 6 5 5','S':'3 4 2 1 6','T':'7 2 2 2 2',
'U':'5 5 5 5 7','V':'5 5 5 5 2','W':'5 5 7 7 5','X':'5 5 2 5 5',
'Y':'5 5 2 2 2','Z':'7 1 2 4 7','1':'2 6 2 2 7','2':'6 1 2 4 7',
'3':'6 1 2 1 6','4':'5 5 7 1 1','5':'7 4 6 1 6','6':'3 4 7 5 7',
'7':'7 1 2 2 2','8':'7 5 7 5 7','9':'7 5 7 1 6','0':'7 5 5 5 7',
'-':'0 0 7 0 0','+':'0 2 7 2 0',' ':'0 0 0 0 0','/':'1 1 2 4 4',
'>':'4 2 1 2 4','<':'1 2 4 2 1','=':'0 7 0 7 0',
}


def sign(name,lines,x,y,z,w,h,back='paper',ink='ink'):
    """Raised face plaque with authored matrix glyphs. Keep all essential facts in the room text."""
    box(name+' plate',(x,y,z),(w,.026,h),back,.012)
    step=min(w*.88/(max(map(len,lines))*4-1), h*.82/(len(lines)*7-2))
    verts=[]; faces=[]
    for line_idx,line in enumerate(lines):
        left=x-(len(line)*4-1)*step/2
        top=z+(len(lines)*7-2)*step/2-line_idx*7*step
        for k,char in enumerate(line):
            for i,row in enumerate(GLYPHS[char].split()):
                for j in range(3):
                    if int(row) & (4>>j):
                        a,b=left+(k*4+j)*step,top-i*step
                        idx=len(verts)
                        verts.extend([(a,y-.014,b-step),(a+step,y-.014,b-step),(a+step,y-.014,b),(a,y-.014,b)])
                        faces.append(tuple(range(idx,idx+4)))
    mesh(name+' lettering',verts,faces,ink)


def footplate(name,w,d,h=.11):
    box(name+' shadow foot',(0,0,h*.35),(w,d,h*.7),'basalt',.045)
    box(name+' worn lip',(0,0,h*.82),(w*.98,d*.98,h*.30),'copper',.03)


def rail(name,x,z,length,mat='brass',y=0,r=.027):
    pipe(name,[(x-length/2,y,z),(x+length/2,y,z)],r,mat,12)


def bounds(meshes):
    deps=bpy.context.evaluated_depsgraph_get()
    points=[]
    for obj in meshes:
        ev=obj.evaluated_get(deps)
        points.extend(ev.matrix_world @ v.co for v in ev.data.vertices)
    return [Vector([fn(p[i] for p in points) for i in range(3)]) for fn in (min,max)]
