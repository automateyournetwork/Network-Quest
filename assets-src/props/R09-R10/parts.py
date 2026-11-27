# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Metalwork shared by the Shell Market and Clockworks, using the optical shop's primitive library."""
import sys
from pathlib import Path

SOURCE=Path(__file__).resolve().parent
sys.path.append(str(SOURCE.parent/'R05-R06'))
from workshop import *
DIR=SOURCE
RAW=ROOT/'docs/evidence/spec001/prop-production/T114'


def wheel(name,x,y,z,outer,inner,depth,material,teeth=0,sides=48):
    """Annular gear or plain rim with a real open bore and chamfered tooth shoulders."""
    samples=teeth*4 if teeth else sides
    verts=[]; faces=[]
    for j in range(samples):
        a=TAU*j/samples
        radius=outer*(.93 if teeth and j%4 in (0,3) else 1)
        for r,offset in [(inner,-depth/2),(radius,-depth/2),(radius,depth/2),(inner,depth/2)]:
            verts.append((x+r*math.sin(a),y+offset,z+r*math.cos(a)))
    for j in range(samples):
        k=(j+1)%samples
        for s in range(4):
            t=(s+1)%4
            faces.append((4*j+s,4*k+s,4*k+t,4*j+t))
    return mesh(name,verts,faces,material)


def stud(name,x,y,z,r=.028):
    lens(name,x,y,z,r,.035,'brass',8)


def boltfeet(name,width,depth):
    for x in [-width/2,width/2]:
        for y in [-depth/2,depth/2]:
            lathe(name,x,y,[(.09,0),(.11,.028),(.08,.07)],'basalt',8,True)


def jack(name,x,y,z,w=.20):
    """Modular-style data socket with a physically stepped key and recessed contact comb."""
    h=w*.73
    box(name+' surround',(x,y,z),(w,.08,h),'slate')
    slab(name+' keyed well',[(x-w*.39,z+h*.27),(x+w*.39,z+h*.27),
         (x+w*.39,z-h*.12),(x+w*.18,z-h*.12),(x+w*.18,z-h*.35),
         (x-w*.18,z-h*.35),(x-w*.18,z-h*.12),(x-w*.39,z-h*.12)],y-.043,.012,'ink')
    for i in range(8):
        box(name+' detached contact',(x+(i-3.5)*w*.085,y-.052,z+h*.13),(w*.033,.008,h*.18),'brass',0)


def braces(name,x,y,z):
    pipe(name,[(x*.48,y,.12),(x,y,z)], [.078,.045],'copper',8)
    lens(name+' axle cap',x,y-.045,z,.075,.075,'brass',12)


def sign(name,lines,x,y,z,w,h,back='paper',ink='ink'):
    """Proportional embossed mosaic lettering. Give diagonal letters room at inspection scale."""
    wide={
        'M':('10001','11011','10101','10001','10001'),
        'N':('10001','11001','10101','10011','10001'),
        'W':('10001','10001','10101','10101','01010'),
    }
    box(name+' plate',(x,y,z),(w,.026,h),back,.012)
    layouts=[]
    for line in lines:
        masks=[wide[ch] if ch in wide else tuple(format(int(row),'03b') for row in GLYPHS[ch].split())
               for ch in line]
        layouts.append((masks,sum(len(rows[0])+1 for rows in masks)-1))
    row_count=7*len(lines)-2
    step=min(w*.90/max(width for _,width in layouts),h*.82/row_count)
    vertices=[];faces=[]
    for index,(letters,width) in enumerate(layouts):
        left=x-width*step/2; top=z+row_count*step/2-7*step*index
        for rows in letters:
            for i,row in enumerate(rows):
                for j,cell in enumerate(row):
                    if cell=='1':
                        a=left+j*step;b=top-i*step;k=len(vertices)
                        vertices.extend([(a,y-.014,b-step),(a+step,y-.014,b-step),(a+step,y-.014,b),(a,y-.014,b)])
                        faces.append((k,k+1,k+2,k+3))
            left+=(len(rows[0])+1)*step
    return mesh(name+' lettering',vertices,faces,ink)
