# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Prism Vault. Static evidence exhibits and fixtures; stateful readings belong to the room."""
from workshop import *

GLYPHS.update({'d':'1 1 3 5 3','m':'0 0 7 7 5','(':'1 2 2 2 1',')':'4 2 2 2 4'})


def pane(name,outline,y,mat='glass',alpha=.27):
    o=slab(name,outline,y,.009,mat)
    clear=materials[mat].copy()
    clear.name=name+' translucent glass'
    clear.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=alpha
    clear.diffuse_color=(*clear.diffuse_color[:3],alpha)
    clear.surface_render_method='BLENDED'
    o.data.materials[0]=clear
    return o


def engine():
    footplate('stepped engine foundation',1.48,.73)
    for s in (-1,1):
        slab('buttressed trunnion pier',[(s*.72,.10),(s*.42,.10),(s*.42,.31),(s*.50,.46),(s*.50,1.43),(s*.60,1.56),(s*.69,1.39)],.07,.48,'slate')
        box('trunnion bracket',(s*.56,.05,1.22),(.16,.48,.27),'copper')
        lens('bearing cover',s*.57,-.215,1.22,.10,.08,'brass')
    rail('prism axle',0,1.22,1.14,'copper',.02,.061)
    # Octagonal cage encloses a banded, triangular optical rotor.
    arc('outer trunnion ring',(0,.10,1.22),.52,.60,0,TAU,.057,'plum',10,32)
    arc('front sight window',(0,-.17,1.22),.48,.55,0,TAU,.028,'brass',8,32)
    for j in range(8):
        a=TAU*j/8
        pipe('window spacer',[(.5*math.cos(a),.10,1.22+.59*math.sin(a)),(.48*math.cos(a),-.17,1.22+.55*math.sin(a))],.023,'copper',8)
    # A solid triangular prism spans the two bearings; broad individual
    # faces stay identifiable without transmission or a bloom effect.
    outline=[(-.275,1.07),(.245,1.135),(-.070,1.475)]
    front=[(x,-.135,z) for x,z in outline]
    rear=[(x+.072,.145,z+.041) for x,z in outline]
    prism=mesh('solid triangular optical rotor',front+rear,
               [(0,1,2),(5,4,3),(0,3,4,1),(1,4,5,2),(2,5,3,0)],'glass')
    prism.data.materials.append(materials['violet'])
    prism.data.materials.append(materials['pearl'])
    for face,material_index in zip(prism.data.polygons,(0,0,1,1,2)):
        face.material_index=material_index
    pipe('polished prism arris',[front[0],front[2],front[1]],.009,'pearl',6)
    for x in (-.31,.31):
        pipe('prism keeper',[(x-.021,.01,1.22),(x+.021,.01,1.22)],.155,'copper',12)
    lathe('transmitter coil',0,0,[(.23,.12),(.27,.18),(.21,.22),(.20,.47),(.14,.53)],'teal',12,True)
    for z in (.26,.34,.42):lathe('coil band',0,0,[(.21,z),(.215,z+.028)],'brass',16)
    box('line projector',(0,.03,1.86),(.44,.34,.17),'slate')
    box('projector slit',(0,-.15,1.86),(.25,.02,.026),'pearl',.002)
    sign('transmitter label',['TX -3 dBm'],0,-.377,.14,.68,.145,'ink','pearl')


def combiner():
    footplate('slotted optical bench',1.04,.54)
    for x in (-.34,.34): slab('splayed frame',[(x-.09,.10),(x+.09,.10),(x+.055,.69),(x-.045,.76)],.045,.27,'plum')
    box('optical rail',(0,0,.74),(1.06,.46,.10),'slate')
    for i,(x,z,m) in enumerate([(-.36,.85,'violet'),(-.39,.99,'glass'),(-.35,1.13,'amber')]):
        pipe('input sleeve',[(x-.10,0,z),(x,0,z)],.055,'ink',12)
        pipe('colored input guide',[(x,.0,z),(-.18,.0,z),(-.04,0,.98)],.034,m,8)
        for k in range(i+1):
            pipe('input identity band',[(x+.009*k,0,z),(x+.009*k+.004,0,z)],.037,'paper',8)
    box('combiner coupling foot',(.025,.037,.815),(.115,.13,.10),'copper')
    slab('combining block',[(-.09,.86),(.08,.83),(.18,.97),(.065,1.11),(-.09,1.07)],.015,.19,'teal')
    pipe('single combined guide',[(.16,.015,.98),(.43,.015,.98)],.047,'pearl',12)
    pipe('output socket',[(.38,.015,.98),(.51,.015,.98)],[.075,.066],'brass',12)
    lens('inspection port',.043,-.104,.978,.066,.045,'brass')
    sign('compatibility prompt',['MATCH PAIR'],0,-.249,.74,.64,.105,'ink','pearl')


def window():
    footplate('lancet sill',1.08,.32)
    opening=[(-.50,.13),(-.50,1.40),(-.36,1.65),(0,1.93),(.36,1.65),(.50,1.4),(.50,.13)]
    pipe('worn lancet surround',[(x,0,z) for x,z in opening],.057,'copper',8)
    pipe('inner arch',[(x*.92,-.006,.13+(z-.13)*.96) for x,z in opening],.028,'brass',7)
    for i,(x,m) in enumerate([(-.34,'violet'),(-.115,'glass'),(.115,'amber'),(.34,'blue')]):
        top=1.77-abs(x)*.86
        coords=[(x-.083,.28),(x+.083,.28),(x+.083,top-.12),(x,top),(x-.083,top-.12)]
        slab('spectral enamel stripe',coords,.027,.045,m)
        for z in (.53,1.17):
            y=-.015
            slab('direction chevron',[(x-.058,z+.025),(x,z+.069),(x+.058,z+.025),(x+.058,z-.012),(x,z+.035),(x-.058,z-.012)] if i%2==0 else
                 [(x-.058,z-.025),(x,z-.069),(x+.058,z-.025),(x+.058,z+.012),(x,z-.035),(x-.058,z+.012)],y,.012,'ink')
    box('transom',(0,-.06,.81),(.94,.065,.079),'copper')
    sign('direction inscription',['TX>RX   RX<TX'],0,-.086,.24,.89,.153,'paper','ink')


def dial():
    footplate('selector plinth',.90,.5)
    slab('arched control body',[(-.36,.11),(.36,.11),(.39,.48),(.39,.79),(.31,1.00),(0,1.12),(-.31,1.00),(-.39,.79)],.03,.39,'slate')
    lens('selector bezel',0,-.19,.69,.335,.085,'copper',32)
    lens('ivory index face',0,-.25,.69,.29,.045,'paper',32)
    for a,label in [(math.radians(151),'A'),(math.radians(90),'B'),(math.radians(29),'H')]:
        x,z=.209*math.cos(a),.69+.209*math.sin(a)
        sign('path detent '+label,[label],x,-.288,z,.079,.082,'teal','pearl')
    lens('rotary knurled wheel',0,-.324,.66,.146,.102,'teal',12)
    for j in range(6):
        a=j*TAU/6
        lens('grip stud',.11*math.cos(a),-.385,.66+.11*math.sin(a),.021,.016,'brass',8)
    sign('dial is a selector',['PATH SELECT'],0,-.18,.255,.55,.14,'plum','pearl')


def enclosure():
    footplate('splice casket',1.12,.65)
    box('rounded cable tub',(0,.005,.25),(1.03,.60,.31),'plum',.08)
    box('gasket rim',(0,.005,.41),(1.06,.62,.076),'copper',.06)
    box('inner routing tray',(0,0,.448),(.91,.48,.052),'ink',.04)
    for s in (-1,1):
        pipe('compression gland',[(s*.49,0,.28),(s*.61,0,.28),(s*.67,0,.28)],[.089,.092,.059],'teal',10)
        for i in range(3):
            x=s*(.52+i*.034)
            pipe('gland band',[(x-.007,0,.28),(x+.007,0,.28)],.095,'brass',10)
        pts=[(s*.44,-.045,.49),(s*.408,-.102,.49),(s*.361,-.13,.49)]
        for k in range(23):
            a=-math.pi/2-TAU*.87*k/22
            pts.append((s*(.255+.144*math.cos(a)),.009+.146*math.sin(a),.49))
        pts.extend([(s*.285,-.072,.49),(s*.195,-.031,.49),(s*.11,-.009,.49),(s*.04,0,.49)])
        pipe('stored fiber loop',pts,.017,'glass' if s<0 else 'violet',8)
    box('splice sleeve',(0,0,.51),(.196,.065,.062),'pearl')
    # Open lid leaves the actual join visible, with a clear inset and two hinge knuckles.
    for s in (-1,1):
        rail('lid hinge',s*.31,.47,.17,'brass',.24,.040)
        pipe('lid stile',[(s*.49,.24,.47),(s*.46,.29,.83)],.026,'copper',8)
    rail('lid top frame',0,.83,.92,'copper',.29,.026)
    pane('lid viewing pane',[(-.465,.49),(.465,.49),(.445,.81),(-.445,.81)],.269)
    sign('splice tag',['JOIN'],0,-.313,.28,.30,.13,'paper','ink')


def attenuator():
    footplate('comparison saddle',.83,.51)
    slab('display saddle',[(-.32,.1),(.32,.1),(.28,.32),(.19,.39),(-.19,.39),(-.28,.32)],.015,.36,'slate')
    # Two matched ports on a cylindrical inline passive element.
    for s in (-1,1):
        pipe('inline adapter',[(s*.18,0,.45),(s*.30,0,.45),(s*.38,0,.45)],[.115,.09,.068],'copper',10)
        pipe('ceramic nose',[(s*.36,0,.45),(s*.42,0,.45)],.043,'pearl',12)
    pipe('attenuating element',[(-.19,0,.45),(-.14,0,.45),(.14,0,.45),(.19,0,.45)],[.12,.15,.15,.12],'teal',12)
    for x in (-.11,-.05,.01,.07):pipe('knurl',[(x,0,.45),(x+.015,0,.45)],.153,'slate',12)
    pipe('comparison card stand',[(.11,.20,.12),(.11,.20,.82)],.028,'brass')
    sign('independent comparison',['SEPARATE CASE','0 dBm'],.06,.165,.78,.68,.20,'paper','ink')


def gauge():
    footplate('threshold gauge',.82,.46)
    slab('meter housing',[(-.35,.1),(.35,.1),(.36,.90),(.22,1.25),(0,1.37),(-.22,1.25),(-.36,.90)],.04,.28,'plum')
    box('vertical meter escutcheon',(-.20,-.12,.74),(.15,.11,.97),'copper')
    box('unread witness slot',(-.20,-.19,.74),(.042,.03,.78),'ink')
    # Two receiver-level endpoints share a rail, reserve has its own interval bracket.
    for z,val in [(.37,'-14 dBm'),(1.09,'-1 dBm')]:
        box('threshold witness',(-.20,-.212,z),(.14,.022,.031),'pearl')
        sign('receiver endpoint',[val],.082,-.135,z,.38,.119,'paper','ink')
    pipe('reserve interval bracket',[(-.18,-.218,.39),(-.10,-.218,.39),(-.10,-.218,.50),(-.18,-.218,.50)],.011,'amber',7)
    sign('reserve interval',['RESERVE','2 dB'],.084,-.135,.62,.39,.172,'teal','pearl')
    sign('receiver frame',['RX WINDOW'],0,-.14,1.20,.38,.09,'ink','paper')


def door():
    footplate('filter threshold',.67,.35)
    for s in (-1,1):
        slab('reed jamb',[(s*.33,.08),(s*.25,.08),(s*.25,1.87),(s*.29,2.0),(s*.345,2.04)],.015,.20,'plum')
        for z in (.14,.52,1.52,1.88):box('jamb cuff',(s*.285,.015,z),(.105,.23,.045),'copper')
        # Paired demonstration leaves leave a broad, visible center gap.
        outline=[(s*.26,.22),(s*.125,.36),(s*.09,1.48),(s*.215,1.76),(s*.26,1.79)]
        pane('filter leaf',outline,-.013,'glass' if s<0 else 'violet',.50)
        pipe('leaf leading edge',[(x,-.017,z) for x,z in outline[1:4]],.013,'brass',8)
        for z in (.49,1.40):lens('hinge',s*.248,-.114,z,.03,.03,'brass',10)
    slab('crown arch',[(-.34,1.89),(-.34,2.06),(0,2.17),(.34,2.06),(.34,1.89),(0,2.03)],.01,.19,'teal')
    sign('exhibit name',['FILTER'],0,-.112,2.062,.33,.091,'ink','paper')


def abacus():
    footplate('accounting frame',1.14,.50)
    for s in (-1,1):
        slab('accountant cheek',[(s*.53,.11),(s*.45,.11),(s*.45,.97),(s*.50,1.08),(s*.56,.95)],.005,.24,'plum')
    for i,(z,count) in enumerate([(.74,8),(.43,3)]):
        rail('calculation spindle',0,z,.96,'brass',0,.021)
        for j in range(count):
            x=-.37+.068*j
            pipe('loss bead' if i==0 else 'reserve bead',[(x-.029,0,z),(x-.017,0,z),(x+.013,0,z),(x+.03,0,z)],
                 [.055,.078,.078,.055],('glass' if i==0 else 'amber') if j%2==0 else ('teal' if i==0 else 'copper'),12)
        sign('equation enamel', ['-3 -8 = -11 dBm' if i==0 else '-11 -(-14) = 3 dB'],0,-.07,z-.143,.89,.105,'paper','ink')
    sign('worked example header',['EXAMPLE A'],0,-.02,.975,.94,.134,'teal','pearl')


def cradle():
    footplate('meter base',.85,.54)
    slab('instrument stand',[(-.3,.1),(.3,.1),(.23,.25),(.17,.32),(.22,.54),(-.22,.54),(-.17,.32),(-.23,.25)],.06,.31,'teal')
    # Empty instrument cavity with a bevelled lower ledge and two protective side jaws.
    box('docking bed',(0,.10,.65),(.54,.19,.43),'slate')
    box('dark inset',(0,-.015,.64),(.385,.04,.35),'ink')
    for s in (-1,1):
        slab('meter cradle jaw',[(s*.25,.45),(s*.35,.50),(s*.32,.83),(s*.26,.88),(s*.20,.82),(s*.23,.67)],-.045,.25,'copper')
    box('retaining toe',(0,-.14,.47),(.51,.23,.083),'brass')
    for x in (-.11,.11):box('rubber rest',(x,-.135,.52),(.12,.18,.048),'teal')
    pipe('adapter lead',[(.23,.17,.52),(.36,.15,.42),(.39,.07,.24),(.32,-.05,.19),(.27,-.16,.22)],.022,'ink')
    sign('measurement instruction',['MEASURE'],0,-.123,.27,.39,.10,'paper','ink')


MODELS={51:engine,52:combiner,53:window,54:dial,55:enclosure,56:attenuator,57:gauge,58:door,59:abacus,60:cradle}
