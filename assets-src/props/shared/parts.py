# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Shared workshop methods. Model on a convenient grid; build.py sets the physical size."""
from pathlib import Path
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / 'R05-R06'))
from workshop import *
DIR = Path(__file__).resolve().parent
RAW = ROOT / 'docs/evidence/spec001/prop-production/T116'

# Horizontal plates, open annuli and closed profiles let mounting holes, lenses,
# tool openings and straps remain distinct in both the native model and GLB.
def deck(name, coords, bottom, top, mat):
    outline=[(x,y) for x,y in coords]
    if sum(x*outline[(i+1)%len(outline)][1]-y*outline[(i+1)%len(outline)][0] for i,(x,y) in enumerate(outline))<0:
        outline.reverse()
    n=len(outline)
    verts=[(x,y,z) for z in [bottom,top] for x,y in outline]
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    return mesh(name,verts,faces,mat)


def ring(name, center, a, b, radius, mat, vertical=False, yscale=1, sides=8, steps=40):
    x,y,z=center
    def point(t):
        return (x+a*math.cos(t),y if vertical else y+b*math.sin(t)*yscale,z+b*math.sin(t) if vertical else z)
    return pipe(name,[point(math.tau*i/steps) for i in range(steps+1)],radius,mat,sides)


def pin(name,x,y,z,r,height,mat='brass',sides=16):
    return lathe(name,x,y,[(r*.92,z),(r,z+.15*height),(r,z+.82*height),(r*.9,z+height)],mat,sides)


def bead(name, x,y,z,rx,ry,rz,mat):
    profile=[]
    for i in range(13):
        t=-math.pi/2+.012+(math.pi-.024)*i/12
        profile.append((rx*math.cos(t),rz*math.sin(t)))
    ob=lathe(name,0,0,profile,mat,24)
    ob.location=(x,y,z);ob.scale.y=ry/rx
    return ob


def path(name, points, radius, mat, sides=8):
    return pipe(name,points,radius,mat,sides)


def strut(name, a, b, width, depth, mat, bevel=.02):
    a,b=Vector(a),Vector(b)
    ob=box(name,(a+b)*.5,(width,depth,(b-a).length),mat,bevel)
    ob.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return ob


def panel(name,x,y,z,w,d,h,mat):
    return box(name,(x,y,z),(w,d,h),mat)


def top_label(name,lines,x,y,z,w,h,back='paper',ink='ink'):
    before=set(bpy.context.scene.objects)
    sign(name,lines,0,0,0,w,h,back,ink)
    for ob in set(bpy.context.scene.objects)-before:
        ob.rotation_euler.x=-math.pi/2;ob.location+=(Vector((x,y,z)))

GLYPHS.update({'d':'1 1 3 5 3','m':'0 0 7 7 5'})
