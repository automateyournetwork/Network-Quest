# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Build individually editable R02 workshop equipment, in Blender metres."""
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
sys.path.insert(0, str(ROOT / 'assets-src/characters/t109'))
import sculpt

TAU = math.tau
parent = None


def block(name, at, size, color, edge=.012):
    obj = sculpt.block(name, parent, at, size, color, edge)
    obj.modifiers[0].segments = 2
    return obj


def bar(name, a, b, radius, color, sides=10):
    return sculpt.tube(name, parent, [a, b], [radius, radius], color, sides, 1)


def line(name, pts, radius, color, steps=2):
    return sculpt.tube(name, parent, pts, [radius]*len(pts), color, 8, steps)


def panel(name, outline, y, thick, color, edge=.009):
    return sculpt.plate(name, parent, outline, y, thick, color, edge)


def disc(name, a, b, radius, color, sides=20):
    """Turned solid along an axle; explicit caps and a single bevel on its shoulders."""
    a, b = Vector(a), Vector(b)
    bpy.ops.mesh.primitive_cylinder_add(vertices=sides, radius=radius, depth=(b-a).length, location=(a+b)/2)
    obj = bpy.context.object
    obj.rotation_euler = (b-a).to_track_quat('Z','Y').to_euler()
    obj = sculpt.finish(obj, name, parent, color, False)
    bevel = obj.modifiers.new('Turned shoulders', 'BEVEL')
    bevel.width = min(radius*.08, (a-b).length*.095)
    bevel.segments = 1
    obj.modifiers.new('Machined face normals', 'WEIGHTED_NORMAL')
    return obj


def lathe(name, x, y, rings, color, sides=24, ratio=1):
    """Revolve a radial profile with stepped or swept transitions."""
    verts = [(x+r*math.cos(i*TAU/sides),y+ratio*r*math.sin(i*TAU/sides),z)
             for z,r in rings for i in range(sides)]
    faces = [(j*sides+i,j*sides+(i+1)%sides,(j+1)*sides+(i+1)%sides,(j+1)*sides+i)
             for j in range(len(rings)-1) for i in range(sides)]
    faces += [tuple(reversed(range(sides))), tuple(range(len(verts)-sides,len(verts)))]
    return sculpt.mesh(name,parent,verts,faces,color,False)


def front_ring(name,x,y,z,r,t,color):
    return sculpt.ring(name,parent,(x,y,z),r,r,t,color)


def feet(x,y):
    for px in [-x,x]:
        for py in [-y,y]:
            block('Bolted foot',(px,py,.035),(.15,.14,.07),'ink')
            disc('Washer bolt',(px,py,.07),(px,py,.083),.032,'brass',6)


def glyph(name, letter, x, y, z, size, color='ink'):
    marks = {'A': [[(-.4,0),(0,1),(.4,0)],[(-.23,.4),(.23,.4)]],
             'B': [[(-.4,0),(-.4,1),(.03,1),(.32,.86),(.32,.63),(.03,.5),(-.4,.5)],
                   [(.03,.5),(.34,.37),(.34,.14),(.03,0),(-.4,0)]]}
    for pts in marks[letter]:
        line(name,[(x+u*size,y,z+v*size) for u,v in pts],size*.068,color,1)


def relief():
    # Twin trestles leave the footprint visually open for the two endpoint cards.
    for x in [-.88,.88]:
        for y in [-.38,.38]:
            disc('Table shoe',(x,y,.015),(x,y,.12),.13,'ink',8)
            bar('Splayed bronze leg',(x,y,.11),(x*.85,y*.6,.48),.076,'copper',8)
        block('Trestle saddle',(x*.85,0,.47),(.24,.78,.09),'brass',.02)
    bar('Longitudinal stretcher',(-.83,0,.25),(.83,0,.25),.045,'sea',8)
    block('Map rim casting',(0,0,.535),(2.55,1.23,.13),'slate',.065)
    block('Warm inlaid border',(0,0,.607),(2.46,1.15,.035),'brass',.017)
    block('Inset plan field',(0,0,.63),(2.40,1.09,.045),'sea',.018)
    p = [(-.94,0,.669),(-.65,0,.669),(-.44,.26,.669),(-.1,.30,.669),
         (.12,.04,.669),(.37,.03,.669)]
    line('Curved service conduit on the plan',p,.038,'copper',3)
    line('Alternative direct conduit',[(-.65,-.034,.679),(-.48,-.18,.679),
         (.10,-.18,.679),(.36,-.005,.679)],.026,'mint',2)
    block('Interchange socket',(.39,.02,.685),(.15,.16,.075),'ink')
    line('Short final patch lead',[(.45,.03,.688),(.58,.13,.69),(.73,.11,.693),(.92,.0,.69)],.031,'cream',3)
    for sign, letter, lamp in [(-1,'A','amber'),(1,'B','mint')]:
        x = sign*.98
        disc('Endpoint monument base',(x,0,.65),(x,0,.72),.157,'brass',12)
        block('Raised endpoint block',(x,0,.761),(.26,.22,.098),'slate')
        disc('Endpoint collar',(x,0,.81),(x,0,.845),.084,'ink',16)
        sculpt.oval('Endpoint beacon',parent,(x,0,.846),(.065,.065,.055),lamp,detail=12)
        block('Signed bench card',(x,-.36,.747),(.32,.05,.19),'cream',.017)
        glyph('Embossed endpoint '+letter,letter,x,-.393,.69,.13)
        for dx in [-.133,.133]:
            disc('Card fastening',(x+dx,-.384,.744),(x+dx,-.394,.744),.013,'brass',8)
    for x in [-1.13,-.72,-.36,0,.36,.72,1.13]:
        block('Engraved survey graduation',(x,.48,.656),(.015,.064,.011),'brass',.002)


def build(asset, fn, envelope):
    global parent
    parent = sculpt.reset(asset)
    parent['semanticIdentity'] = 'spec001:'+asset
    parent['originDescription'] = 'Centre of support footprint at floor height'
    parent['frontDirection'] = 'Blender -Y'
    fn()
    bpy.context.view_layer.update()
    lo,hi = sculpt.bounds(parent.children_recursive)
    size = [hi[i]-lo[i] for i in range(3)]
    # Fit within frozen candidate size without distorting any working part.
    scale = min(1., *(envelope[k]/size[i] for i,k in enumerate(['width','depth','height'])))
    parent.scale = (scale,)*3
    bpy.context.view_layer.update()
    lo,hi = sculpt.bounds(parent.children_recursive)
    # Recenter child geometry, leaving the identity root at the floor and unit scale.
    offset = Vector((-(hi[0]+lo[0])/2,-(hi[1]+lo[1])/2,-lo[2]))
    for obj in list(parent.children):
        obj.location = obj.location * scale + offset
        obj.scale *= scale
    parent.scale = (1,1,1)
    bpy.context.view_layer.update()
    lo,hi = sculpt.bounds(parent.children_recursive)
    center = [(a+b)/2 for a,b in zip(lo,hi)]
    native_view = (.43,-1,.56) if asset in ('PR011','PR012','PR019') else (.40,-1,.27)
    span = max(hi[0]-lo[0]+.25*(hi[1]-lo[1]),hi[2]-lo[2]+.25*(hi[1]-lo[1]))*1.22
    sculpt.studio(center,span,native_view)
    scene = bpy.context.scene
    scene['studioCenter'] = center
    scene['studioSpan'] = span
    scene['candidateEnvelopeMetres'] = [envelope[k] for k in ('width','depth','height')]
    scene.render.film_transparent = False
    scene.cycles.samples = 12
    scene.render.threads = 2
    # Open the source in material color with the complete asset framed.
    for screen in bpy.data.screens:
        for area in screen.areas:
            if area.type=='VIEW_3D':
                area.spaces.active.shading.color_type='MATERIAL'
                region=area.spaces.active.region_3d
                region.view_distance=span*1.7
                region.view_location=center
                region.view_rotation=scene.camera.rotation_euler.to_quaternion()
    bpy.ops.object.select_all(action='DESELECT')
    parent.select_set(True)
    bpy.context.view_layer.objects.active=parent
    bpy.ops.wm.save_as_mainfile(filepath=str(HERE/(asset+'.blend')),compress=True)

if __name__=='__main__':
    sys.path.insert(0,str(HERE))
    import workshop
    layout=json.loads((ROOT/'assets-src/rooms/scene-layouts.json').read_text())
    placements={p['semanticId'].split(':')[-1]:p for p in layout['rooms'][1]['propPlacements']}
    for asset in sys.argv[sys.argv.index('--')+1:]:
        build(asset,workshop.RECIPES[asset],placements[asset]['candidateEnvelope'])
