# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Photon Gardens. Each object has its own working silhouette and legible observation locus."""
from workshop import *


def inspection_dock():
    footplate('inspection plinth',1.34,.78)
    # Cast trestles and apron meet at the optical carriage.
    for x in (-.48,.48):
        slab('splayed trestle',[(x-.14,.1),(x+.14,.1),(x+.085,.52),(x-.085,.52)],0,.56,'teal')
        box('brass boot',(x,0,.13),(.27,.6,.05),'brass')
    box('inspection worktop',(0,0,.54),(1.4,.84,.11),'slate',.045)
    box('copper edge band',(0,0,.515),(1.39,.835,.028),'copper')
    rail('carriage runners',-.16,.62,.83,'brass',-.12)
    rail('carriage runners',-.16,.62,.83,'brass',.11)
    box('ferrule carriage',(-.32,0,.66),(.38,.37,.095),'teal')
    for x in (-.43,-.18):
        box('sample seat',(x,0,.72),(.065,.2,.15),'copper')
    pipe('sample barrel',[(-.52,0,.81),(-.19,0,.81)],.076,'ink',16)
    pipe('ceramic ferrule',[(-.19,0,.81),(-.085,0,.81)],.038,'pearl',16)
    pipe('looped patch tail',[(-.53,0,.81),(-.59,.035,.79),(-.61,.14,.73),(-.57,.23,.68),(-.36,.25,.66)],.024,'teal')
    box('scope pedestal',(.31,.055,.72),(.23,.31,.26),'ink')
    pipe('angled optical housing',[(.14,.04,.79),(.22,.05,.85),(.31,.08,.91),(.44,.12,1.01)],[.08,.11,.12,.09],'teal',16)
    pipe('objective collar',[(.065,.015,.78),(.15,.04,.8)],[.066,.089],'brass',16)
    pipe('recessed objective',[(.063,.014,.78),(.059,.013,.779)],[.045,.043],'ink',16)
    pipe('objective glass',[(.059,.013,.779),(.055,.012,.778)],[.028,.026],'blue',16)
    pipe('rubber ocular',[(.41,.11,.98),(.49,.14,1.04),(.52,.15,1.06)],[.082,.098,.09],'ink',16)
    lens('focus wheel',.32,-.118,.85,.072,.088,'brass',16)
    sign('dock enamel',['INSPECT'],0,-.429,.53,.46,.083,'ink','pearl')


MODELS={43:inspection_dock}


def grove():
    # Four root buttresses rise from a shared fluted cable-trunk and then diverge.
    for i in range(6):
        a=i*TAU/6
        pipe('root buttress',[(.48*math.cos(a),.32*math.sin(a),.03),(.32*math.cos(a),.19*math.sin(a),.14),
             (.17*math.cos(a+.2),.12*math.sin(a+.2),.43),(.09*math.cos(a+.3),.08*math.sin(a+.3),.79)],
             [.055,.098,.11,.064],'teal' if i%2 else 'slate',8)
    trail=[(0,0,.08),(.015,.015,.48),(-.10,.03,.91),(-.04,.025,1.34),(.085,.05,1.65),(.10,0,2.0)]
    pipe('glass bark',trail,[.22,.21,.16,.145,.12,.075],'teal',10,False)
    for i in range(6):
        a=i*TAU/6
        pts=[(x+r*math.cos(a+j*.2),y+r*math.sin(a+j*.2),z) for j,((x,y,z),r) in enumerate(zip(trail,[.2,.18,.145,.13,.10,.062]))]
        pipe('cladding flute',pts,[.039,.032,.031,.028,.024,.016],'glass' if i%2 else 'slate',6,False)
    for i,(side,y,base,tipx,tipz) in enumerate([(-1,-.02,1.13,-.63,2.23),(1,.11,1.37,.59,2.49),(-1,.12,1.62,-.32,2.67),(1,-.10,1.78,.16,2.88)]):
        a=(.02,y,base); b=(side*.14,y+.04,base+.22); c=(tipx*.9,y-.05,tipz-.42); d=(tipx,y,tipz)
        pipe('branch sheath',[a,b,c,d],[.10,.095,.062,.023],'teal',8)
        pipe('pearl optical vein',[(x,y-.051,z) for x,y,z in (a,b,c,d)],[.021,.021,.017,.013],'pearl',6)
        pipe('fork twig',[c,(tipx-.16*side,y+.06,tipz-.24),(tipx-.19*side,y+.04,tipz-.10)],[.037,.024,.016],'glass',7)
        leaf('furled branch tip',d,(d[0]+side*.057,d[1],d[2]+.12),(.034,0,0),'glass')
    sign('maintenance direction',['< SHOP'],.035,-.205,.96,.32,.15,'paper','ink')
    pipe('ribbon binding',[(-.18,-.08,.99),(-.1,-.14,.97),(.08,-.17,1.0),(.12,-.09,1.03)],.029,'copper')


def blossoms():
    lathe('scalloped stone bed',0,0,[(.32,.015),(.36,.08),(.31,.17),(.26,.23)],'slate',9,True)
    for i,(x,y,z) in enumerate([(-.34,.03,1.20),(.28,.08,1.53),(-.09,-.09,1.84)]):
        pts=[(x*.28,y,.19),(x*.36-.05,y,.52),(x*.88+.04,y+.04,z*.67),(x,y,z)]
        pipe('arched blossom stem',pts,[.075,.062,.045,.035],'teal')
        for j in range(2):
            h=.44+.3*j+.07*i
            leaf('blade leaf',(x*.52,y,h),(x*.52+(-1)**(j+i)*.24,y+.09,h+.27),(.035,-.065,.01),'glass' if j else 'teal')
        lathe('flower throat',x,y,[(.058,z-.035),(.095,z),(.06,z+.08)],'amber',9,True)
        for j in range(6):
            a=TAU*j/6+i*.27; dx,dy=math.cos(a),math.sin(a)
            tip=(x+.23*dx,y+.14*dy,z+.18+(.02 if j%2 else 0))
            leaf('optical sepal',(x,y,z-.02),tip,(-.078*dy,.066*dx,.012),'pearl' if j%2==0 else 'glass')
    pipe('hanging card hook',[(.02,-.06,1.17),(.09,-.12,1.07),(.15,-.14,1.01)],.016,'copper',7)
    sign('garden rule',['PRETTY IS NOT','A MEASUREMENT'],.14,-.18,.91,.54,.20)


def cleaning():
    footplate('washstand',.88,.52)
    for x in (-.32,.32):
        pipe('angled leg',[(x,-.17,.09),(x*.81,-.13,.47)],.046,'copper')
        pipe('back leg',[(x,.17,.09),(x*.81,.13,.47)],.042,'teal')
    box('enamel tool deck',(0,0,.49),(.92,.55,.09),'teal')
    box('spare parts tray',(.20,-.035,.56),(.39,.36,.05),'brass')
    box('velvet tray lining',(.20,-.04,.585),(.34,.30,.02),'ink')
    for y in (-.13,.025):
        pipe('replacement housing',[(.09,y,.64),(.26,y,.64)],[.04,.048],'glass',8)
        pipe('protected ferrule',[(.26,y,.64),(.32,y,.64)],.025,'pearl',8)
    lathe('fluted brush pot',-.27,-.02,[(.095,.535),(.074,.57),(.085,.67),(.103,.71),(.088,.73)],'copper',10,True)
    pipe('brush handle',[(-.27,-.02,.68),(-.28,-.045,.82),(-.315,-.05,.88)],.024,'paper')
    pipe('brush ferrule',[(-.315,-.05,.86),(-.324,-.05,.90)],.032,'brass')
    for i in range(7):
        a=TAU*i/7
        pipe('brush tuft',[(-.324,-.05,.90),(-.33+.03*math.cos(a),-.05+.022*math.sin(a),.946)], [.018,.008],'pearl',5)
    for x in (-.37,.37): pipe('sign post',[(x,.21,.53),(x,.21,.92)],.022,'brass')
    sign('washstand motto',['PATIENCE','IS A TOOL'],0,.178,.96,.85,.19,'slate','pearl')


def shelf():
    # Flared corbels frame the matching cards and the corresponding sample stock.
    footplate('archival rack',1.64,.51)
    for x in (-.74,.74):
        slab('pierced shelf upright',[(x-.07,.1),(x+.07,.1),(x+.055,1.36),(x,1.46),(x-.055,1.36)],.12,.27,'teal')
    for z in (.4,.91):
        box('shelf slab',(0,.01,z),(1.67,.48,.09),'slate')
        box('shelf edge pull',(0,-.237,z),(1.63,.022,.033),'brass')
    for i in range(6):
        x=-.53+(i%3)*.53
        z=.47+(i//3)*.51
        box('profile sample',(x,.035,z+.10),(.37,.22,.17),'teal' if i%2 else 'glass')
        for k in (-1,1):
            box('paired optical receptacle',(x+k*.068,-.082,z+.10),(.097,.025,.077),'ink',.012)
            lens('socket core',x+k*.068,-.10,z+.10,.021,.014,'pearl',10)
        sign('candidate index',[str(i+1)],x,-.17,z+.015,.125,.083)
    sign('shelf heading',['PROFILE ARCHIVE'],0,.11,1.38,1.35,.16,'plum','pearl')


def bend():
    footplate('exhibit',1.12,.38)
    for x in (-.42,.42): pipe('exhibit post',[(x,.13,.085),(x,.13,1.12)],.035,'teal')
    box('display panel',(0,.13,.65),(1.06,.06,.95),'slate',.035)
    # The broad and pinched loops are qualitative, without a universal radius.
    for i,(x,rx,rz) in enumerate([(-.25,.19,.31),(.25,.144,.31)]):
        pts=[]
        for j in range(29):
            a=TAU*j/28
            r=rx if i==0 else rx*(.19+.81*abs(math.sin(a)))
            pts.append((x+r*math.sin(a),.05,.69+rz*math.cos(a)))
        pipe('broad demonstration loop' if i==0 else 'pinched loop example',pts,.029,'glass' if i==0 else 'copper')
        lens('retainer pin',x,.037,.96,.04,.035,'brass',12)
    sign('qualitative label',['BEND EXHIBIT'],0,.059,.274,.75,.13,'paper','ink')


def coupler():
    lathe('fork stand foot',0,0,[(.27,.015),(.30,.055),(.25,.11),(.15,.13)],'slate',10,True)
    lathe('fork handle',0,0,[(.13,.12),(.16,.2),(.105,.27),(.080,.57),(.13,.64)],'teal',14)
    for z in (.27,.31,.35): lathe('handgrip rib',0,0,[(.105,z),(.11,z+.013)],'copper',14)
    slab('splitter yoke',[(-.13,.51),(-.13,.66),(-.34,.84),(-.27,.94),(0,.76),(.27,.94),(.34,.84),(.13,.65),(.13,.51)],0,.19,'copper')
    for s in (-1,1):
        pipe('branch collar',[(s*.27,0,.84),(s*.32,0,.93),(s*.34,0,1.02)],[.083,.077,.060],'teal',12)
        pipe('branch ferrule',[(s*.34,0,1.015),(s*.355,0,1.11)],[.042,.033],'pearl',12)
    lens('service fastener',0,-.112,.65,.048,.035,'brass')


def stump():
    # Sleeve and separated fracture faces, intentionally distinguished from a dirty ferrule.
    footplate('fracture specimen',.85,.68)
    for i,(x,z) in enumerate([(-.185,.51),(.16,.69)]):
        profile=[(.17,.11),(.18,.18),(.145,z-.07),(.145,z)] if i==0 else [(.11,.11),(.12,.17),(.103,z-.07),(.102,z)]
        lathe('severed jacket',x,.04,profile,'teal' if i==0 else 'slate',9,True)
        for j in range(6):
            a=TAU*j/6
            dx,dy=.078*math.cos(a),.078*math.sin(a)
            endz=z+.055+((j*3+i)%5)*.026
            # Open a jagged oblique fracture across the core, leaving a visible stepped face.
            cx,cy=x+dx*1.22,.04+dy*1.12
            nodes=[(x+dx*.85+.029*math.cos(a+q*TAU/5),.04+dy*.85+.029*math.sin(a+q*TAU/5),z-.012) for q in range(5)]
            nodes += [(cx+.020*math.cos(a+q*TAU/5),cy+.020*math.sin(a+q*TAU/5),
                       endz+[.034,-.018,-.022,.015,.042][q]) for q in range(5)]
            nodes.append((cx,cy,endz-.011))
            faces=[(q,(q+1)%5,(q+1)%5+5,q+5) for q in range(5)]
            faces.extend([(q+5,(q+1)%5+5,10) for q in range(5)])
            faces.append((4,3,2,1,0))
            mesh('fractured glass filament',nodes,faces,'glass' if j%2 else 'pearl')
        for k in range(3):
            a=(k*2+1)*TAU/6
            tipx,tipy=x+.14*math.cos(a),.04+.14*math.sin(a)
            leaf('torn jacket lip',(x+.11*math.cos(a),.04+.11*math.sin(a),z-.033),
                 (tipx,tipy,z+.065+(.034 if k==1 else 0)),(-.037*math.sin(a),.037*math.cos(a),0),'teal' if i==0 else 'slate')
    sign('fracture warning',['EXHIBIT ONLY'],0,-.23,.225,.66,.15,'clay','ink')
    for x in (-.21,.21):pipe('warning bracket',[(x,-.15,.095),(x,-.22,.22)],.021,'brass')


def altar():
    footplate('receiver dais',1.13,.77)
    slab('stepped lectern pedestal',[(-.44,.12),(.44,.12),(.32,.25),(.22,.40),(.27,.71),(.45,.78),(-.45,.78),(-.27,.71),(-.22,.40),(-.32,.25)],0,.48,'teal')
    box('slate reading deck',(0,0,.80),(1.14,.74,.12),'slate')
    for x in (-.48,.48):box('deck corner',(x,0,.865),(.14,.65,.026),'brass')
    lathe('lantern recess',-.32,.12,[(.15,.867),(.16,.89),(.132,.912)],'copper',16)
    lathe('empty insert',-.32,.12,[(.121,.907),(.12,.915)],'ink',16)
    for x in (-.045,.19):
        book=box('open observation ledger',(x,-.06,.905),(.24,.31,.056),'paper')
        book.rotation_euler.y=-.065 if x<0 else .065
        for k in range(3): box('ledger ruled line',(x,-.14+k*.051,.939),(.13,.008,.006),'copper',0)
    box('photodiode headboard',(0,.27,1.045),(.62,.12,.32),'teal')
    lens('receiver aperture bevel',0,.188,1.065,.125,.072,'brass')
    lens('receiver dark aperture',0,.14,1.065,.086,.04,'ink')


def lantern():
    lathe('tapered anchoring foot',0,0,[(.25,.01),(.29,.06),(.23,.14),(.15,.17),(.13,.33)],'teal',12,True)
    lathe('lantern standard',0,0,[(.095,.28),(.123,.34),(.071,.42),(.056,.94),(.106,1.0)],'copper',14)
    lathe('cup',0,0,[(.1,.94),(.245,1.0),(.254,1.05),(.204,1.10)],'teal',8,True)
    lathe('pearl lamp',0,0,[(.10,1.07),(.15,1.17),(.15,1.35),(.09,1.43)],'amber',8,True)
    for j in range(4):
        a=TAU*(j+.5)/4
        pipe('guard strut',[(r*math.cos(a),r*math.sin(a),z) for r,z in [(.19,1.055),(.22,1.18),(.20,1.33),(.17,1.44)]],.021,'brass',8)
    lathe('pagoda hood',0,0,[(.19,1.4),(.26,1.44),(.25,1.47),(.08,1.53),(.04,1.57)],'teal',8,True)
    arc('carrying loop',(0,0,1.57),.085,.075,0,math.pi,.017,'brass',8,12)
    slab('old ribbon',[(-.05,.73),(.12,.77),(.23,.70),(.36,.68),(.31,.62),(.36,.57),(.20,.60),(.10,.66),(-.04,.64)],-.08,.015,'clay')
    sign('ribbon tally',['II'],.15,-.099,.674,.095,.066,'clay','ink')


MODELS.update({41:grove,42:blossoms,44:cleaning,45:shelf,46:bend,47:coupler,48:stump,49:altar,50:lantern})
