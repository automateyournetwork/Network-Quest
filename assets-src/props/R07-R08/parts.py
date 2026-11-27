# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Shared enamel and metalworking methods, plus radio-instrument fabrication."""
from pathlib import Path
import sys
DIR = Path(__file__).resolve().parent
sys.path.insert(0,str(DIR.parent/'R05-R06'))
from workshop import *
DIR = Path(__file__).resolve().parent
# The meter and chart cards retain the case of the engineering unit symbols.
GLYPHS.update({'d':'1 1 3 5 3','m':'0 0 7 7 5'})
RAW = ROOT/'docs/evidence/spec001/prop-production/T113'


def spindle(name, x,y,z,r,h,mat):
    return pipe(name,[(x,y,z),(x,y,z+h)],r,mat,16)


def rod(name,start,end,r,mat,sides=10):
    return pipe(name,[start,end],r,mat,sides)


def pivot(name,x,y,z,r):
    lens(name+' black iron bearing',x,y,z,r,.12,'ink')
    lens(name+' bronze bush',x,y-.07,z,r*.72,.04,'brass')


def tripod(name,height,spread):
    for i in range(3):
        t=TAU*i/3-math.pi/2
        x,y=spread*math.cos(t),spread*math.sin(t)
        rod(name+' splayed leg',(x,y,.04),(x*.20,y*.20,height),.049,'copper')
        box(name+' shoe',(x,y,.04),(.15,.14,.075),'basalt')
    lathe(name+' column',0,0,[(.15,height-.11),(.17,height-.07),(.17,height+.03),(.11,height+.065)],'teal')


def oval(name,x,y,z,rx,rz,mat,r=.018,lean=0):
    return pipe(name,[(x+rx*math.cos(t),y+lean*math.sin(t),z+rz*math.sin(t))
                      for t in [TAU*i/48 for i in range(49)]],r,mat,8)


def enamel_ribbon(name,x,y,z,w,h,mat,swag=.05,tail=.11):
    # Creased, double-sided swallowtail. Segments run across the hanging cloth.
    top=[];bottom=[]
    for i in range(7):
        t=i/6
        yy=y+swag*math.sin(t*math.tau)
        top.append((x+w*(t-.5),yy,z-.035*math.sin(t*math.pi)))
        notch=tail*(1-abs(2*t-1))
        bottom.append((x+w*(t-.5),yy-.04*math.sin(t*math.pi),z-h+notch))
    v=top+bottom
    f=[(i,7+i,8+i,i+1) for i in range(6)]
    ob=mesh(name,v,f,mat)
    mod=ob.modifiers.new('Woven cloth thickness','SOLIDIFY');mod.thickness=.012
    return ob


def knob(name,x,y,z,r,mat='brass'):
    lens(name+' trim',x,y+.025,z,r*1.22,.06,'ink')
    lens(name+' grip',x,y-.012,z,r,.075,mat,12)
    box(name+' index',(x,y-.055,z+r*.25),(.025,.016,r*.68),'pearl',.002)
