# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Fixture components using the shared studio material system and mesh primitives."""
import sys
from pathlib import Path

SOURCE = Path(__file__).resolve().parent
sys.path.append(str(SOURCE.parent/'R05-R06'))
from workshop import *
DIR = SOURCE
RAW = ROOT/'docs/evidence/spec001/prop-production/T115'


def beam(name, a, b, width, depth, material):
    a, b = Vector(a), Vector(b)
    obj = box(name,(a+b)/2,(width,depth,(b-a).length),material,.016)
    obj.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return obj


def foot(name,x,y,w=.24,d=.24):
    box(name+' shoe',(x,y,.045),(w,d,.09),'basalt')
    box(name+' ferrule',(x,y,.109),(w*.69,d*.69,.055),'copper')


def stud(name,x,y,z,r=.031):
    return lens(name,x,y,z,r,.03,'brass',8)


def shell(name,x0,x1,cy,cz,r,teeth,side):
    """A hollow sleeve running along X, with a hand-torn inner lip and a visible wall."""
    vertices=[];faces=[]
    for i,t in enumerate(teeth):
        a=i*TAU/len(teeth)
        for x,rad in [(x0,r),(x1+side*t,r),(x1+side*t,r*.79),(x0,r*.79)]:
            vertices.append((x,cy+rad*math.cos(a),cz+rad*math.sin(a)))
    for i in range(len(teeth)):
        j=(i+1)%len(teeth)
        for k in range(4):
            f=(4*i+k,4*i+(k+1)%4,4*j+(k+1)%4,4*j+k)
            faces.append(f if side==-1 else tuple(reversed(f)))
    return mesh(name,vertices,faces,'slate')


def arrow(name,x,y,z,direction,material='brass',scale=1):
    shape=[(-.22,-.047),(.04,-.047),(.04,-.13),(.24,0),(.04,.13),(.04,.047),(-.22,.047)]
    return slab(name,[(x+direction*u*scale,z+v*scale) for u,v in shape],y,.025,material)
