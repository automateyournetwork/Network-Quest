# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Original geometry tools for the copper and echo workshops (metres, +Z up, -Y front)."""
from math import cos, sin, tau, pi
from pathlib import Path
from mathutils import Vector, Matrix
import bpy

ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
RAW = ROOT / 'docs/evidence/spec001/prop-production/T111'
GLBS = ROOT / 'public/assets/models/R03-R04'
PALETTE = {
    'iron': ('263b48', .45, .45), 'slate': ('495a69', .24, .55),
    'teal': ('3c837c', .30, .42), 'patina': ('295b5b', .34, .48),
    'copper': ('bf8051', .57, .38), 'brass': ('e3ba74', .48, .36),
    'linen': ('eee3c5', .04, .65), 'clay': ('c6664e', .22, .45),
    'blue': ('6095b3', .17, .46), 'plum': ('806b93', .24, .45),
    'rubber': ('30343b', .05, .73), 'oak': ('81513d', .07, .56),
    'pearl': ('add7c7', .14, .34), 'mica': ('a1d0c5', .10, .24),
}
MATS = {}

def linear(v):
    v = int(v, 16)/255
    return v/12.92 if v <= .04045 else ((v+.055)/1.055)**2.4

def material(name):
    if name not in MATS:
        hx, metallic, rough = PALETTE[name]
        rgb = [linear(hx[i:i+2]) for i in (0,2,4)]
        alpha = .23 if name == 'mica' else 1.
        mat = bpy.data.materials.new(name)
        mat.use_nodes = True
        shader = mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value = [*rgb, 1]
        shader.inputs['Roughness'].default_value = rough
        shader.inputs['Metallic'].default_value = metallic
        shader.inputs['Alpha'].default_value = alpha
        mat.diffuse_color = [*rgb, alpha]
        MATS[name] = mat
    return MATS[name]

def mesh(name, vertices, faces, mat, smooth=False):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material(mat))
    if smooth:
        for face in data.polygons: face.use_smooth = True
    return obj

def box(name, center, size, mat, bevel=.018, tilt=0):
    x,y,z = [v/2 for v in size]
    verts=[(-x,-y,-z),(x,-y,-z),(x,y,-z),(-x,y,-z),(-x,-y,z),(x,-y,z),(x,y,z),(-x,y,z)]
    obj=mesh(name,verts,[(3,2,1,0),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)],mat)
    obj.location=center
    obj.rotation_euler.x=tilt
    if bevel:
        beveler=obj.modifiers.new('Rounded cast edge','BEVEL')
        beveler.width=min(bevel,min(size)*.40); beveler.segments=2
        normal=obj.modifiers.new('Weighted broad faces','WEIGHTED_NORMAL')
        normal.keep_sharp=True
    return obj

def axis_frame(axis):
    direction=Vector(axis).normalized()
    radial=Vector((0,0,1)) if abs(direction.z)<.82 else Vector((1,0,0))
    first=(radial-direction*radial.dot(direction)).normalized()
    return direction,first,direction.cross(first)

def turned(name, center, axis, profile, mat, sides=24, smooth=True):
    """Surface of revolution. Profile runs from the low axial end to the high end."""
    d,u,v=axis_frame(axis); c=Vector(center)
    vv=[c+d*h+r*(u*cos(tau*j/sides)+v*sin(tau*j/sides)) for h,r in profile for j in range(sides)]
    ff=[tuple(reversed(range(sides)))]
    for i in range(len(profile)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            ff.append((a,b,b+sides,a+sides))
    ff.append(tuple(range(len(vv)-sides,len(vv))))
    obj=mesh(name,vv,ff,mat,smooth)
    obj.data.polygons[0].use_smooth=False;obj.data.polygons[-1].use_smooth=False
    return obj

def rod(name,a,b,r,mat,sides=14):
    av,bv=Vector(a),Vector(b); length=(bv-av).length
    return turned(name,(av+bv)/2,bv-av,[(-length/2,r),(length/2,r)],mat,sides)

def tube_data(paths,r,sides):
    verts=[]; faces=[]
    for path in paths:
        path=[Vector(p) for p in path]
        start=len(verts);last=None
        for j,point in enumerate(path):
            tangent=(path[min(j+1,len(path)-1)]-path[max(0,j-1)]).normalized()
            if all(abs(q.y-path[0].y)<1e-7 for q in path):
                u=Vector((0,1,0));v=tangent.cross(u)
            elif last is None or abs(last.dot(tangent))>.999: _,u,v=axis_frame(tangent)
            else:
                u=(last-tangent*tangent.dot(last)).normalized();v=tangent.cross(u)
            verts.extend(point+r*(u*cos(tau*k/sides)+v*sin(tau*k/sides)) for k in range(sides));last=u
        faces.append(tuple(start+k for k in reversed(range(sides))))
        for i in range(len(path)-1):
            for k in range(sides):
                a=start+i*sides+k; b=start+i*sides+(k+1)%sides
                faces.append((a,b,b+sides,a+sides))
        end=start+(len(path)-1)*sides
        faces.append(tuple(end+k for k in range(sides)))
    return verts,faces

def tubing(name, paths, r, mat, sides=8):
    return mesh(name,*tube_data(paths,r,sides),mat,True)

def tube(name,path,r,mat,sides=8):
    return tubing(name,[path],r,mat,sides)

def hoop(name,center,axis,radius,gauge,mat,n=32,sides=8):
    _,u,v=axis_frame(axis);c=Vector(center)
    return tube(name,[c+radius*(u*cos(tau*j/n)+v*sin(tau*j/n)) for j in range(n+1)], gauge,mat,sides)

def profile_xz(name,points,y,thickness,mat):
    """Extruded outline with counterclockwise coordinates in the X/Z face."""
    n=len(points); vv=[(x,y+o,z) for o in (-thickness/2,thickness/2) for x,z in points]
    return mesh(name,vv,[tuple(range(n)),tuple(reversed(range(n,2*n)))]+[((i+1)%n,i,i+n,(i+1)%n+n) for i in range(n)],mat)

def bolt(name,x,y,z,r=.021):
    rod(name,(x,y,z),(x,y-.015,z),r,'brass',6)

# An original straight-stroke engraver. Characters are traced on a 3 by 5 point grid.
GLYPHS = {
'A':['c31be','68'],'B':['c01576','67bedc'],'C':['5139db'],'D':['c015bdc'],'E':['20ce','67'],
'F':['c02','68'],'G':['5139dbe87'],'H':['0c','2e','68'],'I':['02','1d','ce'],'J':['2ed9'],
'K':['0c','26e'],'L':['0ce'],'M':['c072e'],'N':['c0e2'],'O':['02ec0'],'P':['c0286'],
'Q':['02ec0','ae'],'R':['c015876','7e'],'S':['2068ec'],'T':['02','1d'],'U':['0ce2'],
'V':['0d2'],'W':['0c7e2'],'X':['0e','2c'],'Y':['072','7d'],'Z':['02ce'],
'0':['02ec0'],'1':['31d','ce'],'2':['0286ce'],'3':['02ec','68'],'4':['068','2e'],
'5':['2068ec'],'6':['20ce86'],'7':['02d'],'8':['02ec0','68'],'9':['ec0286'],
'/':['c2'],'-':['68'],'<':['27e'],'>':['07c'],'.':['de']}
def lettering(name,words,center,height,mat='iron'):
    x,y,z=center; width=height*.54; step=height*.76; start=x-(len(words)-1)*step/2
    paths=[]
    for i,char in enumerate(words.upper()):
        for stroke in GLYPHS.get(char,[]):
            pts=[]
            for vertex in stroke:
                a=int(vertex,16);pts.append((start+i*step+(a%3-1)*width/2,y,z+(.5-a//3/4)*height))
            paths.append(pts)
    if paths: return tubing(name,paths,height*.066,mat,5)

def card(name,x,y,z,words,w=.40,h=.15):
    box(name+' enamel face',(x,y,z),(w,.023,h),'linen',.008)
    for dx in [-1,1]: bolt(name+' stud',x+dx*w*.43,y-.013,z+h*.31,min(.011,h*.055))
    lettering(name+' engraving',words,(x,y-.016,z),min(h*.58,w*.86/(max(len(words),1)*.79)),'iron')

def feet(xs,y=.0,depth=.40):
    for x in xs: box('Broad anchored shoe',(x,y,.045),(.19,depth,.09),'iron',.028)
