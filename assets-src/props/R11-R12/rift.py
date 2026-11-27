# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Site equipment and exposed earth for the Backhoe Rift."""
from parts import *


def broken_conduit():
    # The left half sits lower. Broken wires project variably from the jagged inner sleeves.
    teeth=[.014,.036,-.026,.052,.020,-.049,.053,-.024,.025,.041,-.017,.049,-.032,.022,.055,-.015]
    for side,cy,cz in [(-1,-.045,.30),(1,.09,.39)]:
        fixed,cut=side*.78,side*.32
        shell('ripped steel casing',fixed,cut,cy,cz,.19,teeth,-side)
        for x in [side*.57,side*.72]:
            shell('swaged collar',x,x-side*.040,cy,cz,.209,[0]*16,-side)
        box('stone support',(side*.64,cy,.065),(.25,.45,.13),'basalt')
        box('channel riser',(side*.64,cy,(cz-.10)/2),(.14,.28,cz-.10),'copper')
        # Four insulated pairs terminate at distinct cut faces inside the open gap.
        for i in range(8):
            angle=i*TAU/8
            y=cy+.096*math.cos(angle)
            z=cz+.096*math.sin(angle)
            length=[.10,.134,.166,.19,.143,.18,.12,.154][i]
            end=(cut-side*length,y+.036*math.cos(angle),z+.052*math.sin(angle))
            pipe('broken conductor insulation',[(cut+side*.09,y,z),(cut,y,z),end],.017,
                 ['blue','paper','copper','paper','teal','paper','clay','paper'][i],8)
            pipe('exposed copper strand',[end,(end[0]-side*.032,end[1],end[2]+.007)],.010,'copper',7)

MODELS={102:broken_conduit}


def trench():
    # Vary the bank line in plan. Each layer has its own footprint and irregular fracture faces.
    xs=[-2,-1.69,-1.35,-1.08,-.76,-.47,-.15,.2,.52,.86,1.15,1.48,1.77,2]
    shifts=[0,.04,-.12,-.08,.03,-.02,.14,.08,-.01,-.09,-.04,.11,.05,-.015]
    heights=[.36,.4,.365,.39,.35,.4,.37,.385,.345,.39,.375,.40,.36,.35]
    for side in [-1,1]:
        for level,(z0,z1,mat) in enumerate([(.0,.21,'basalt'),(.21,.25,'copper'),(.25,.66,'slate'),(.66,.74,'brass'),(.74,1,'slate')]):
            verts=[];faces=[]
            for i,x in enumerate(xs):
                inner=.20+shifts[i]*side
                h=heights[i if side<0 else len(xs)-i-1]
                for t,outer in [(z0,False),(z1,False),(z1,True),(z0,True)]:
                    y=.67+.026*math.cos(i*1.7) if outer else inner+.135*t
                    verts.append((x,side*y,t*h if not outer else t*(h+.018)))
                if i:
                    for j in range(4):
                        a=4*(i-1)
                        faces.append((a+j,a+(j+1)%4,a+4+(j+1)%4,a+4+j))
            faces += [(3,2,1,0),tuple(range(len(verts)-4,len(verts)))]
            mesh('fractured bank stratum '+str(level),verts,faces if side==-1 else [tuple(reversed(f)) for f in faces],mat)
    bed=[]; floorfaces=[]
    for i,x in enumerate(xs):
        for y in [-.37,shifts[i]+.019*math.sin(i),.37]:
            bed.append((x,y,.03+.016*math.cos(x*1.7+y*4)))
        if i:
            a=(i-1)*3
            floorfaces.extend([(a,a+3,a+4),(a,a+4,a+1),(a+1,a+4,a+5),(a+1,a+5,a+2)])
    mesh('rough trench floor',bed,floorfaces,'basalt')
    # Fracture veins follow face-to-face along the cut surface.
    for i in [1,4,7,10]:
        x=xs[i];y=shifts[i]
        pipe('floor fracture',[(x-.08,y-.12,.055),(x+.015,y-.04,.058),(x-.005,y+.031,.057),(x+.09,y+.12,.058)],.009,'ink',6)
    for i,(x,y) in enumerate([(-1.64,-.08),(-1.23,.08),(-.88,-.15),(-.3,.12),(.12,-.08),(.85,.06),(1.37,-.08)]):
        chip=lathe('fallen shale fragment',x,y,[(.065,0),(.11,.028),(.07,.068)],'basalt' if i%2 else 'slate',5,True)
        for vertex in chip.data.vertices:
            vertex.co.x=x+1.4*(vertex.co.x-x)
    for x in [-1.72,1.68]:
        for y in [-.52,.52]:
            lathe('survey pin',x,y,[(.029,.33),(.029,.415),(.047,.427)],'brass',8,True)


def deck():
    for y in [-.26,.26]:
        box('load beam',(0,y,.21),(1.62,.1,.1),'basalt')
        for x in [-.65,.65]:
            foot('abutment',x,y,.22,.21)
            box('bearing block',(x,y,.135),(.18,.15,.13),'slate')
        # Lower girder has an actual open zig-zag web.
        for i in range(6):
            x=-.72+i*.24
            beam('girder diagonal',(x,y,.205 if i%2 else .1),(x+.24,y,.1 if i%2 else .205),.035,.028,'copper')
        box('lower flange',(0,y,.095),(1.5,.066,.039),'slate')
    for i in range(10):
        x=-.72+i*.16
        box('replaceable tread',(x,0,.286),(.147,.73,.052),'slate' if i%3 else 'copper')
    for x in [-.73,0,.73]:
        pipe('inspection rail stanchion',[(x,.326,.28),(x,.326,.57)],.024,'basalt',8)
    pipe('one-sided handrail',[(-.78,.326,.57),(.78,.326,.57)],.029,'brass')
    sign('plan tray', ['PLAN'],0,-.375,.226,.33,.105,'paper','ink')


def radio():
    for x,y in [(-.49,-.34),(.49,-.32),(.02,.48)]:
        foot('spreader',x,y,.16,.16)
        pipe('splayed tripod leg',[(x,y,.08),(x*.60,y*.60,.54),(0,0,.91)],[.046,.047,.04],'slate',10)
        pipe('folding stay',[(x*.59,y*.59,.48),(0,0,.36)],.017,'copper',8)
    lathe('azimuth mast',0,0,[(.055,.31),(.055,.82),(.104,.86),(.104,.94),(.06,.98),(.06,1.02)],'basalt',16)
    pipe('raked mast head',[(0,.0,.98),(0,.16,1.18),(0,.26,1.25)],[.052,.057,.06],'slate',12)
    pipe('elevation axle',[(-.13,.26,1.26),(.13,.26,1.26)],.063,'brass',12)
    for x in [-.091,.091]:
        beam('rear tilt yoke',(x,.26,1.26),(x,.10,1.44),.04,.048,'copper')
    # Offset dish points toward the approach and slightly upward; the horn sits at its focus.
    center=Vector((0,0,1.43)); normal=Vector((-.18,-.93,.32)).normalized()
    u=normal.cross(Vector((0,0,1))).normalized(); v=normal.cross(u).normalized()
    V=[];F=[];sides=32
    profile=[(.012,-.07),(.22,-.041),(.39,.034),(.48,.10),(.48,.123),(.39,.054),(.22,-.019),(.012,-.042)]
    for i,(r,d) in enumerate(profile):
        for j in range(sides):
            a=TAU*j/sides
            V.append(center+normal*d+(u*math.cos(a)+v*math.sin(a))*r)
            if i:
                k=(j+1)%sides
                F.append((i*sides+j,(i-1)*sides+j,(i-1)*sides+k,i*sides+k))
    dish=mesh('formed parabolic reflector',V,F,'paper',True)
    for j in range(3):
        a=(j+.25)*TAU/3
        start=center+normal*.115+(u*math.cos(a)+v*math.sin(a))*.46
        pipe('feed support',[start,center+normal*.365],.012,'copper',8)
    pipe('feed horn',[center+normal*.31,center+normal*.395],[.047,.021],'basalt',12)
    pipe('downlead',[(.075,.12,1.46),(.13,.27,1.23),(.11,.08,.81),(.17,-.09,.56)],.02,'ink',8)
    box('portable transceiver',(.18,-.1,.47),(.26,.16,.19),'teal')
    sign('set marking',['RF'],.18,-.192,.47,.19,.102)


def splicetable():
    for x in [-.72,.72]:
        for y in [-.36,.36]:
            foot('bench',x,y,.2,.18)
            box('table leg',(x,y,.46),(.087,.087,.79),'slate')
        beam('end brace',(x,-.32,.17),(x,.32,.70),.055,.04,'copper')
    box('bench edge',(0,0,.815),(1.68,.93,.104),'copper',.038)
    box('clean mat',(0,0,.885),(1.62,.89,.05),'teal',.025)
    box('fusion splicer base',(.16,-.04,.965),(.60,.41,.12),'basalt')
    for x in [-.08,.39]:
        box('ceramic V-block',(x,-.043,1.043),(.125,.19,.082),'paper')
        box('fiber jaw slot',(x,-.044,1.085),(.12,.025,.005),'ink',0)
    box('electrode assembly',(.155,.04,1.038),(.09,.14,.06),'slate')
    pipe('left jacket',[(-.67,.19,.923),(-.55,-.05,.941),(-.32,-.10,1.02),(-.15,-.045,1.086)],.016,'blue')
    pipe('aligned glass',[(-.16,-.045,1.086),(.48,-.045,1.086)],.006,'pearl',8)
    pipe('right jacket',[(.48,-.045,1.086),(.62,.07,.962),(.72,.18,.924)],.016,'blue')
    for i in range(2):
        arcpts=[(-.55+(.14-i*.028)*math.cos(a),.19+(.12-i*.02)*math.sin(a),.927+i*.015) for a in [k*TAU/28 for k in range(29)]]
        pipe('slack guide',arcpts,.012,'pearl',8)
    box('raised splicer lid',(.16,.164,1.137),(.45,.07,.29),'slate')
    box('lid lining',(.16,.122,1.14),(.37,.018,.19),'ink')
    sign('apron card',['SPLICE'],0,-.484,.81,.44,.092)


def copper_frame():
    for x in [-.79,.79]:
        foot('rack foot',x,0,.26,.52)
        box('perforated upright',(x,0,.55),(.097,.13,.985),'slate')
        for z in [.3,.57,.86]:
            lens('mount bolt',x,-.077,z,.025,.02,'brass',8)
    box('rack lintel',(0,0,1.028),(1.66,.13,.083),'copper')
    for i,(z,tag) in enumerate([(.68,'95 METRES'),(.32,'100 METRES')]):
        box('removable bypass panel',(0,0,z),(1.49,.16,.235),'basalt')
        for x in [-.57,.57]:
            box('socket shoulder',(x,-.092,z),(.18,.07,.15),'paper')
            box('recessed jack',(x,-.14,z),(.125,.06,.098),'ink')
            box('plug ferrule',(x,-.19,z),(.08,.09,.075),'blue')
        pts=[(-.57,-.227,z),(-.57,-.28,z-.064),(-.49,-.29,z-.114),(-.16,-.29,z-.116),
             (.20,-.29,z-.116),(.50,-.29,z-.109),(.57,-.26,z-.06),(.57,-.223,z)]
        pipe('protected patch lead',pts,.028,'teal' if i else 'copper')
        sign('candidate length card',[tag],0,-.101,z+.025,.82,.136)
    for x in [-.52,.52]:
        beam('rear stabilizer',(x,0,.16),(x*.46,.24,.04),.06,.05,'slate')


def barrier():
    for x in [-.47,.47]:
        foot('weighted barrier',x,0,.31,.34)
        beam('leaning leg',(x+.052,0,.11),(x-.04,0,.74),.079,.083,'slate')
    box('signal board',(0,0,.59),(1.23,.12,.30),'paper')
    for x in [-.49,-.19,.11,.41]:
        slab('diagonal warning stripe',[(x-.095,.451),(x+.02,.451),(x+.19,.73),(x+.075,.73)],-.068,.012,'clay')
    slab('warning diamond',[(-.205,.80),(0,.60),(.205,.80),(0,1)],-.11,.034,'brass')
    slab('warning diamond face',[(-.159,.80),(0,.647),(.159,.80),(0,.955)],-.132,.012,'ink')
    box('warning stroke',(0,-.147,.841),(.031,.01,.105),'paper',.004)
    lens('warning dot',0,-.151,.747,.021,.01,'paper')
    sign('warning instruction',['WARNING'],0,-.079,.523,.48,.108)


def lectern():
    footplate('permit desk',.79,.62,.13)
    slab('branching stand',[(-.24,.13),(.24,.13),(.13,.31),(.12,.68),(.40,.84),(.32,.93),(-.35,.93),(-.41,.83),(-.14,.68),(-.14,.32)],0,.24,'slate')
    box('writing surface',(0,.0,.915),(1.04,.65,.102),'copper')
    # Upright curled work permit suspended from an actual roll, resting on a sloped board.
    for x in [-.40,.40]:
        beam('page easel',(x,-.232,.96),(x,.24,1.30),.045,.05,'basalt')
    verts=[(-.385,-.23,.989),(.385,-.23,.989),(.385,.25,1.314),(-.385,.25,1.314)]
    mesh('permit sheet',verts,[(0,1,2,3)],'paper')
    pipe('permit roller',[(-.447,.246,1.317),(.447,.246,1.317)],.056,'paper',18)
    for x in [-.46,.46]:
        pipe('roller spindle',[(x-.026,.246,1.317),(x+.026,.246,1.317)],.063,'brass',12)
    for i,length in enumerate([.43,.57,.38,.52]):
        y=.165-i*.08;z=.994+(y+.23)*.677
        pipe('inscribed permit line',[(-.26,y,z),(-.26+length,y,z)],.007,'slate',6)
    pipe('permit stamp handle',[(.422,-.184,.981),(.422,-.185,1.114)],[.035,.021],'basalt')
    lathe('seal handle knob',.422,-.185,[(.033,1.10),(.046,1.13),(.031,1.154)],'clay')
    sign('permit desk label',['PERMIT'],0,-.335,.914,.48,.104)


def control():
    footplate('cast control base',.56,.50,.125)
    lathe('ribbed housing',0,0,[(.215,.12),(.19,.19),(.16,.25),(.16,.71),(.22,.76),(.22,.81)],'slate',8,True)
    for z in [.26,.34,.42]:
        lathe('stand rib',0,0,[(.17,z),(.176,z+.023)],'copper',8,True)
    box('enclosed lever box',(0,0,.94),(.54,.38,.38),'basalt')
    # A physical horizontal axle and guard hoops enclose the neutral handle.
    for x in [-.16,.16]:
        box('bearing cheeks',(x,-.01,1.15),(.065,.22,.176),'copper')
        arcpoints=[(x*1.36,-.164+.19*(1-math.cos(t)),1.13+.26*math.sin(t)) for t in [i*math.pi/15 for i in range(16)]]
        pipe('protective hoop',arcpoints,.016,'slate',8)
    pipe('lever axle',[(-.20,-.035,1.20),(.20,-.035,1.20)],.047,'brass')
    beam('isolator lever',(0,-.04,1.2),(0,-.15,1.43),.042,.051,'copper')
    pipe('lever grip',[(-.115,-.15,1.43),(.115,-.15,1.43)],.043,'teal',12)
    sign('operation label',['EXECUTE'],0,-.205,.95,.44,.125)
    for x in [-.215,.215]:
        for z in [.81,1.075]:
            stud('case screw',x,-.206,z,.015)


def temporary_sign():
    footplate('ballasted sign',.52,.40,.115)
    box('detour stake',(0,0,.77),(.12,.086,1.33),'slate')
    for z in [.27,.39]:
        box('stake stripe',(0,-.046,z),(.12,.011,.056),'clay')
    slab('dogleg route arrow',[(-.41,1.11),(.10,1.11),(.10,1.0),(.43,1.25),(.10,1.50),(.10,1.395),(-.41,1.395)],-.064,.084,'copper')
    sign('temporary arrow name',['TEMP'], -.123,-.125,1.249,.43,.178)
    for x in [-.21,.20]:
        pipe('hanging tag wire',[(x,-.077,1.095),(x,-.077,.94)],.012,'brass',8)
    sign('dependency tag',['BORROWED'],0,-.081,.906,.59,.17,'paper','ink')

MODELS.update({101:trench,103:deck,104:radio,105:splicetable,106:copper_frame,107:barrier,108:lectern,109:control,110:temporary_sign})
