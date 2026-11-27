# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Original hand-positioned rigid-part characters for the Spec001 Underworld."""
import math
from pathlib import Path
import bpy
from mathutils import Vector, Matrix

BASE = Path(__file__).resolve().parents[3]
V = Vector
PALETTE = {
    'coal':'26323c', 'iron':'536a75', 'pewter':'a6b9b6', 'brass':'d7a655',
    'copper':'ae6846', 'cream':'f0dfb3', 'ink':'192730', 'teal':'347f7d',
    'sea':'73b2a4', 'clay':'c5684d', 'russet':'814740', 'aubergine':'513c56',
    'honey':'eeba66', 'plum':'795473', 'blue':'537b99', 'bark':'59473f',
    'moss':'597866', 'ivory':'d5c9a6', 'rose':'c88778', 'white':'f5ebd3',
}
MATERIALS = {}
JOINTS = {}
REST = {}
ASSET = ''
MODEL = None
RIG = None

def srgb(n):
    return n / 12.92 if n <= 0.04045 else ((n + 0.055) / 1.055) ** 2.4

def material(key):
    if key not in MATERIALS:
        rgb = tuple(srgb(int(PALETTE[key][i:i+2],16)/255) for i in (0,2,4))
        m = bpy.data.materials.new('Underworld.'+key)
        p = m.node_tree.nodes.get('Principled BSDF') if m.node_tree else None
        if p is None:
            m.use_nodes = True
            p = m.node_tree.nodes['Principled BSDF']
        p.inputs['Base Color'].default_value = (*rgb,1)
        metal = key in ('brass','copper','iron','pewter')
        p.inputs['Roughness'].default_value = .38 if metal else .57
        p.inputs['Metallic'].default_value = .38 if metal else .03
        m.diffuse_color = (*rgb,1)
        MATERIALS[key] = m
    return MATERIALS[key]

def empty(name):
    obj=bpy.data.objects.new(ASSET+'.'+name,None)
    MODEL.objects.link(obj)
    obj.empty_display_type='PLAIN_AXES'
    obj.empty_display_size=.08
    return obj

def joint(name, origin=(0,0,0), parent='base'):
    obj=empty(name)
    obj.parent=JOINTS[parent]
    obj.location=V(origin)-REST[parent]
    JOINTS[name]=obj
    REST[name]=V(origin)
    return name

def finish(obj, name, key, position, parent, smooth=True):
    obj.name=ASSET+'.'+name
    if obj.name not in MODEL.objects:
        for col in list(obj.users_collection):
            col.objects.unlink(obj)
        MODEL.objects.link(obj)
    obj.parent=JOINTS[parent]
    obj.location=V(position)-REST[parent]
    obj.data.materials.append(material(key))
    for face in obj.data.polygons:
        face.use_smooth=smooth
    return obj

def orb(name, p, radius, key, parent='base', tilt=(0,0,0)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10)
    obj=bpy.context.object
    obj.data.transform(Matrix.Diagonal((*radius,1)))
    obj.rotation_euler=tilt
    return finish(obj,name,key,p,parent)

def block(name,p,size,key,parent='base',bevel=.05,tilt=(0,0,0)):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj=bpy.context.object
    obj.data.transform(Matrix.Diagonal((*size,1)))
    mod=obj.modifiers.new('Rounded cast edges','BEVEL')
    mod.width=min(bevel,min(size)*.45)
    mod.segments=3
    bpy.ops.object.modifier_apply(modifier=mod.name)
    obj.rotation_euler=tilt
    return finish(obj,name,key,p,parent,False)

def tube(name, points, widths, key, parent='base', section=10, guide=(0,1,0)):
    """Continuous tapered rings along an authored spine. Widths are transverse radii."""
    points=[V(p) for p in points]
    vertices=[]
    faces=[]
    for i,p in enumerate(points):
        tangent=(points[min(len(points)-1,i+1)]-points[max(0,i-1)]).normalized()
        u=V(guide).cross(tangent)
        if u.length<.015:
            u=V((1,0,0)).cross(tangent)
        u.normalize()
        v=tangent.cross(u).normalized()
        w=widths[i]
        a,b=(w,w) if isinstance(w,(int,float)) else w
        for j in range(section):
            t=math.tau*j/section
            vertices.append(p+u*a*math.cos(t)+v*b*math.sin(t)-points[0])
    for i in range(len(points)-1):
        for j in range(section):
            a=i*section+j
            b=i*section+(j+1)%section
            faces.append((a,b,b+section,a+section))
    faces.extend([tuple(reversed(range(section))),tuple(range(len(vertices)-section,len(vertices)))])
    mesh=bpy.data.meshes.new(ASSET+'.'+name)
    mesh.from_pydata(vertices,[],faces)
    mesh.update()
    return finish(bpy.data.objects.new(name,mesh),name,key,points[0],parent)

def line(name, points, r, key, parent='base'):
    return tube(name,points,[r]*len(points),key,parent,8)

def feather(name,a,b,width,key,parent):
    a,b=V(a),V(b)
    points=[a.lerp(b,t)+V((0,-width*.27*math.sin(t*math.pi),width*.18*math.sin(t*math.pi))) for t in (0,.2,.48,.78,.999)]
    return tube(name,points,[(width*f,width*d) for f,d in ((.16,.12),(.75,.29),(1,.36),(.63,.22),(.025,.025))],key,parent,10)

def eyes(parent, x, y, z, size, spread=.24):
    for side in (-1,1):
        orb('eye', (x+side*spread,y,z), (size*.85,size*.66,size), 'cream',parent)
        orb('pupil',(x+side*spread+.012,y-size*.54,z+.007),(size*.44,size*.25,size*.62),'ink',parent)
        orb('glint',(x+side*spread+.012-size*.12,y-size*.77,z+size*.28),(size*.14,)*3,'white',parent)

def motion(clip, parts, duration):
    # Every participating joint has its own action and shared NLA track name.
    for name,(rotation,shift) in parts.items():
        obj=JOINTS[name]
        initial=obj.location.copy()
        for fraction,amplitude in ((0,0),(.25,.65),(.5,1),(.75,.35),(1,0)):
            if clip=='idle' and fraction==.75:
                amplitude=-.35
            obj.rotation_euler=[v*amplitude for v in rotation]
            obj.location=initial+V(shift)*amplitude
            frame=1+round(duration*fraction)
            obj.keyframe_insert('rotation_euler',frame=frame)
            obj.keyframe_insert('location',frame=frame)
        action=obj.animation_data.action
        action.name=ASSET+'.'+name+'.'+clip
        action.use_fake_user=True
        track=obj.animation_data.nla_tracks.new()
        track.name=clip
        track.strips.new(clip,0,action)
        obj.animation_data.action=None
        track.mute=True
        obj.rotation_euler=(0,0,0)
        obj.location=initial

def crab():
    shell=joint('shell',(0,.07,.45))
    gaze=joint('eyestalks',(0,-.28,.4))
    orb('carapace',(0,-.12,.37),(.44,.42,.27),'clay')
    block('pluggable cast housing',(0,.23,.64),(.67,.95,.48),'pewter',shell,.08,(-.16,0,0))
    block('black insulator',(0,.70,.60),(.57,.12,.29),'coal',shell,.035)
    block('contact tongue',(0,.76,.57),(.49,.17,.06),'teal',shell,.012)
    for x in range(-3,4):
        block('contact finger',(x*.061,.81,.608),(.035,.085,.016),'brass',shell,.005)
    for y in range(5):
        block('raised cooling fin',(0,-.01+y*.12,.921-y*.020),(.54,.035,.053),'iron',shell,.018)
    for s in (-1,1):
        line('folded extraction bail',[(.34*s,-.13,.74),(.38*s,-.36,.74),(.31*s,-.44,.77),(0,-.44,.77)],.021,'brass',shell)
        for j in range(3):
            y=-.13+j*.21
            dx=.60+.095*math.sin((j+1)*math.pi/4)
            tube('jointed walking leg',[(s*.32,y,.38),(s*dx,y+.03,.32),(s*(dx+.09),y-.07,.07),(s*(dx+.11),y-.12,.012)],[.075,.055,.026,.008],'russet')
            orb('leg knuckle',(s*dx,y+.03,.32),(.065,)*3,'copper')
        line('eye stalk',[(s*.14,-.30,.43),(s*.19,-.34,.59),(s*.21,-.40,.68)],.043,'clay',gaze)
        orb('eye socket',(s*.21,-.41,.68),(.111,.10,.12),'russet',gaze)
        orb('eye',(s*.21,-.475,.69),(.078,.047,.085),'cream',gaze)
        orb('pupil',(s*.21+.01,-.514,.695),(.040,.019,.052),'ink',gaze)
        orb('spark',(s*.21,-.531,.713),(.012,)*3,'white',gaze)
        claw=joint('arm'+str(s),(s*.27,-.24,.33))
        scale=1 if s==1 else .72
        tube('forearm',[(s*.27,-.24,.33),(s*.44,-.35,.27),(s*.52,-.46,.33)],[.09,.075,.085],'clay',claw)
        orb('pincer palm',(s*.53,-.48,.36),(.155*scale,.155*scale,.14*scale),'clay',claw)
        for j in (-1,1):
            tube('curved pincer',[(s*.54+j*.067*scale,-.54,.37),(s*.54+j*.087*scale,-.61,.44),(s*.54+j*.068*scale,-.62,.52),(s*.54+j*.035*scale,-.61,.55)],[.065*scale,.055*scale,.034*scale,.008],'honey',claw)
    line('smile',[(-.10,-.491,.36),(-.045,-.531,.332),(.035,-.54,.331),(.098,-.505,.35)],.013,'ink')
    # A small brass filing tag gives the module librarian its own identifying prop.
    line('tag hinge',[(.35,.08,.77),(.409,.07,.76),(.43,.07,.69)],.017,'brass',shell)
    block('catalog tag',(.427,.07,.64),(.035,.17,.19),'teal',shell,.018,(.1,0,0))
    for z in (.61,.655):
        block('catalog rules',(.45,.066,z),(.012,.10,.012),'cream',shell,.003)
    motion('idle',{'eyestalks':((.09,0,.11),(0,0,.018)), 'arm-1':((.08,.1,0),(0,0,0))},48)
    motion('reaction',{'shell':((-.18,.09,0),(0,0,.03)), 'eyestalks':((-.17,0,-.23),(0,0,-.045)), 'arm1':((-.38,0,.13),(0,0,0))},28)
    motion('ability',{'arm1':((-.88,.12,-.35),(0,0,.05)), 'shell':((.12,-.15,.21),(0,0,.045)), 'eyestalks':((.15,0,.24),(0,0,.035))},40)

def bounds(objects):
    bpy.context.view_layer.update()
    pts=[o.matrix_world @ V(point) for o in objects if o.type=='MESH' for point in o.bound_box]
    return [V(tuple(f(p[i] for p in pts) for i in range(3))) for f in (min,max)]

def studio(focus, span):
    sc=bpy.context.scene
    sc.render.engine='CYCLES'
    sc.cycles.samples=8
    sc.cycles.use_denoising=True
    sc.world=bpy.data.worlds.new('Warm basalt specimen studio')
    sc.world.use_nodes=True
    sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.30,.33,.38,1)
    sc.world.node_tree.nodes['Background'].inputs[1].default_value=.5
    sc.render.film_transparent=True
    sc.render.resolution_x=sc.render.resolution_y=448
    sc.render.resolution_percentage=100
    sc.view_settings.view_transform='Standard'
    sc.view_settings.look='None'
    camera_offset=V((3.15,-6.4,2.65)).normalized()*6*span
    bpy.ops.object.camera_add(location=focus+camera_offset)
    sc.camera=bpy.context.object
    sc.camera.rotation_euler=(-camera_offset).to_track_quat('-Z','Y').to_euler()
    sc.camera.data.type='ORTHO'
    sc.camera.data.ortho_scale=span
    for tag,offset,color,power in [('key',(2,-3,4),(1,.86,.69),330),('fill',(-3,-2,1.8),(.69,.84,1),170),('rim',(1,3,3),(1,.79,.57),325)]:
        bpy.ops.object.light_add(type='AREA', location=focus+V(offset)*span)
        obj=bpy.context.object
        obj.name='Studio.'+tag
        obj.data.energy=power*span*span
        obj.data.shape='DISK'
        obj.data.size=2.5*span
        obj.data.color=color
        obj.rotation_euler=(focus-obj.location).to_track_quat('-Z','Y').to_euler()

def build(asset, modeler, height):
    global ASSET,MODEL,RIG
    bpy.ops.wm.read_factory_settings(use_empty=True)
    MATERIALS.clear(); JOINTS.clear(); REST.clear()
    ASSET=asset
    sc=bpy.context.scene
    sc.render.fps=24
    sc.unit_settings.system='METRIC'
    sc.unit_settings.scale_length=1
    MODEL=bpy.data.collections.new(asset+'.editable parts')
    sc.collection.children.link(MODEL)
    RIG=empty('ground')
    JOINTS['base']=empty('base')
    JOINTS['base'].parent=RIG
    REST['base']=V((0,0,0))
    modeler()
    low,high=bounds(MODEL.objects)
    scale=height/(high.z-low.z)
    JOINTS['base'].scale=(scale,)*3
    JOINTS['base'].location.z=-low.z*scale
    low,high=bounds(MODEL.objects)
    focus=(low+high)*.5
    span=max(high-low)*1.32
    studio(focus,span)
    RIG['semanticId']='spec001:'+asset
    RIG['nqPivotDescription']='ground at local origin; forward -Y'
    sc['focus']=list(focus)
    sc['span']=span
    proxy=empty('collision-envelope')
    proxy.parent=RIG
    proxy.empty_display_type='CUBE'
    proxy.empty_display_size=1
    proxy.location=focus
    proxy.scale=(high-low)*.5
    proxy.hide_render=True
    proxy['purpose']='Authoring-only bounding box; gameplay walk regions own movement.'
    bpy.context.preferences.filepaths.save_version=0
    bpy.ops.wm.save_as_mainfile(filepath=str(BASE/'assets-src/characters'/f'{asset}.blend'),compress=True)
