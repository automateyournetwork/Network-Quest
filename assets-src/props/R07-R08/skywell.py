# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Skywell survey equipment and exhibits. The frozen content owns observations and settings."""
from parts import *


def antenna():
    lathe('cradle anchor',0,0,[(.35,0),(.38,.05),(.38,.15),(.30,.18),(.25,.19)],'basalt',16)
    lathe('azimuth turntable',0,0,[(.26,.19),(.29,.21),(.29,.27),(.21,.31)],'brass',20)
    lathe('rotating pedestal',0,0,[(.21,.30),(.19,.48),(.125,.87)],'teal',12)
    fixed=list(bpy.context.scene.objects)
    for y in (-.15,.15):
        slab('elevation cheek',[(-.18,.79),(.13,.79),(.15,1.10),(.08,1.18),(-.08,1.18),(-.15,1.06)],y,.065,'slate')
    pivot('elevation brake',0,-.20,1.056,.11)
    pipe('ratchet handle',[(0,-.25,1.06),(-.23,-.26,.92),(-.30,-.26,.93)],.030,'copper')
    rod('bone handle',(-.30,-.26,.93),(-.39,-.26,1.0),.042,'pearl')
    def height(x): return 1.06+.23*x
    rod('directional boom',(-.79,0,height(-.79)),(.87,0,height(.87)),.042,'brass',14)
    for i,(x,extent) in enumerate([(-.69,.43),(-.36,.39),(-.04,.34),(.25,.30),(.53,.25),(.79,.21)]):
        z=height(x)
        box('ceramic insulated saddle',(x,0,z+.035),(.105,.125,.105),'teal')
        if i==1:
            # A folded driven element, adjacent to the feed without shorting the boom.
            pipe('folded driven dipole',[(x-.04,-.055,z+.11),(x-.04,-extent,z+.11),(x+.04,-extent,z+.11),(x+.04,extent,z+.11),(x-.04,extent,z+.11),(x-.04,.055,z+.11)],.023,'copper',10)
            pipe('coax drip loop',[(x,-.07,z+.085),(x-.06,-.11,z-.10),(x-.09,-.12,z-.28),(x+.11,-.16,z-.36),(-.07,-.12,.68),(-.08,-.09,.31)],.019,'ink')
        else:
            rod('reflector' if i==0 else 'tapered director',(x,-extent,z+.084),(x,extent,z+.084),.024,'pearl')
            for sy in (-1,1): rod('sleeved tip',(x,sy*(extent-.035),z+.084),(x,sy*extent,z+.084),.03,'brass')
    for obj in list(bpy.context.scene.objects):
        if obj not in fixed: obj.location.z+=.47
    lathe('raised swivel sleeve',0,0,[(.127,.85),(.145,.89),(.145,.93),(.114,.96),(.111,1.23),(.14,1.26),(.14,1.31)],'teal',16)
    pipe('lower coax run',[(-.08,-.09,.79),(-.10,-.12,.64),(-.13,-.12,.40),(-.16,-.10,.30)],.020,'ink',8)
    for i in (-2,-1,0,1,2):
        t=i*.25
        box('azimuth index',(.278*math.sin(t),-.273*math.cos(t),.25),(.017,.017,.045),'ink',0)


MODELS={61:antenna}


def mast():
    foundation=[(-.29,-.21),(.29,-.21),(0,.26)]
    def corner(i,z):
        x,y=foundation[i]; taper=1-.70*z/3.05
        return (x*taper,y*taper,z)
    for i,(x,y) in enumerate(foundation):
        box('concrete foot',(x,y,.07),(.12,.15,.14),'slate')
        rod('tapered tower angle',corner(i,.10),corner(i,2.98),.032,'pearl')
        for level in range(6):
            z=.12+.46*level; a=(i+1)%3
            rod('triangular side web',corner(i,z),corner(a,z+.46),.019,'teal',8)
            rod('horizontal girt',corner(i,z+.46),corner(a,z+.46),.017,'brass',8)
    for x in (-.082,.082):
        rod('external ladder stile',(x,-.235,.13),(x,-.13,2.48),.016,'copper')
    for i in range(12):
        z=.24+.19*i; y=-.235+.105*(z-.13)/2.35
        rod('ladder rung',(-.087,y,z),(.087,y,z),.013,'brass',8)
    for i,x in enumerate((.14,.19)):
        pipe('endpoint cable',[(x,-.20,.12),(x*.93,-.18,1),(x*.68,-.13,2),(x*.43,-.08,2.82)],.018,'ink',8)
        sign('cable tag',['AB'[i]],x,-.226,.45+.25*i,.11,.13)
    spindle('mast head ferrule',0,0,2.85,.092,.16,'copper')
    spindle('mast whip',0,0,3,.027,.33,'brass')
    lathe('lightning finial',0,0,[(.027,3.28),(.041,3.31),(.012,3.38)],'pearl',12)


def scope():
    # Open sight instrument: two opposed sights deliberately leave the line of aim visible.
    tripod('survey stand',.65,.32)
    spindle('survey azimuth axis',0,0,.66,.076,.20,'brass')
    slab('elevation quadrant',[(-.22,.83),(.20,.83),(.15,1.12),(.01,1.20),(-.12,1.09)],0,.12,'teal')
    pivot('sight trunnion',0,-.085,1.04,.103)
    rod('open sight beam',(-.45,0,1.04),(.46,0,1.17),.044,'copper')
    for x,z,r in [(-.37,1.18,.105),(.36,1.30,.120)]:
        ring=[]
        for i in range(33):
            t=TAU*i/32;ring.append((x,r*math.cos(t),z+r*math.sin(t)))
        pipe('hoop sight',ring,.024,'brass')
        rod('vertical crosshair',(x,0,z-r),(x,0,z+r),.010,'ink',6)
        rod('horizontal crosshair',(x,-r,z),(x,r,z),.010,'ink',6)
    rod('card post',(.28,-.19,.02),(.28,-.19,.63),.032,'slate')
    box('card shoe',(.28,-.19,.04),(.23,.18,.08),'basalt')
    sign('survey slip',['PATH','SURVEY'],.255,-.246,.58,.39,.28)
    box('survey clip',(.255,-.27,.715),(.10,.044,.055),'copper')


def clearance():
    footplate('surveyor diorama',2.0,.76,.17)
    # Two broad benches support a deck and the hinged second survey wing.
    box('terrain block',(0,.085,.21),(1.90,.51,.17),'teal')
    box('hinged alternative corridor',(0,-.244,.19),(1.82,.19,.12),'slate')
    for x in (-.52,.52):
        rod('model hinge barrel',(x-.08,-.135,.27),(x+.08,-.135,.27),.04,'brass')
    slab('irregular buttress',[(-.31,.29),(-.24,.65),(-.115,.72),(-.038,.92),(.052,.84),(.18,.74),(.27,.30)],.12,.30,'slate')
    slab('exposed cliff facet',[(-.24,.31),(-.13,.67),(-.04,.87),(-.06,.55),(-.09,.32)],-.036,.018,'pearl')
    for x in (-.82,.82):
        lathe('miniature survey station',x,.13,[(.12,.28),(.1,.33),(.058,.35),(.045,.77),(.07,.80)],'brass',12)
        box('mini relay head',(x,.13,.84),(.16,.10,.1),'teal')
        rod('alternate marker post',(x,-.24,.24),(x,-.24,.49),.038,'copper')
    for x1,x2 in [(-.77,-.11),(.11,.77)]:
        rod('interrupted original sightline',(x1,.12,.79),(x2,.12,.79),.023,'pearl')
    pipe('continuous alternate corridor',[(-.82,.12,.77),(-.82,-.24,.52),(.82,-.24,.52),(.82,.12,.77)],.026,'brass')
    sign('hinged survey card',['ALT PATH'],0,-.345,.19,.68,.14)


def beacon():
    lathe('stone jar socket',0,0,[(.27,0),(.32,.04),(.32,.10),(.24,.15),(.18,.28)],'basalt',16)
    lathe('ceramic shoulder',0,0,[(.18,.23),(.24,.30),(.25,.40),(.205,.44)],'teal',16)
    lathe('carved beacon lens',0,0,[(.18,.43),(.25,.48),(.26,.52),(.24,.57),(.265,.61),(.24,.65),(.265,.69),(.24,.73),(.26,.77),(.23,.82),(.18,.85)],'amber',18)
    for a in [0,2.09,4.19]:
        x,y=.26*math.cos(a),.26*math.sin(a)
        pipe('lens guard',[(x*.82,y*.82,.43),(x,y,.51),(x,y,.78),(x*.82,y*.82,.86)],.019,'copper')
    lathe('screw cap',0,0,[(.18,.83),(.24,.86),(.24,.89),(.19,.92),(.19,.95),(.11,.98)],'brass',20)
    arc('swing wire bail',(0,0,.94),.16,.23,0,math.pi,.018,'copper')
    sign('small exhibit card',['LOCAL'],0,-.232,.34,.26,.11)


def selector():
    footplate('dual selector',1.34,.58,.13)
    slab('twin card die casting',[(-.63,.12),(.63,.12),(.61,.60),(.54,.91),(-.54,.91),(-.61,.60)],.035,.37,'teal')
    for x,side in [(-.31,'NEAR'),(.31,'FAR')]:
        box('card frame',(x,-.17,.69),(.51,.065,.40),'brass')
        sign('capability card',[side,'BAND','CH / PHY'],x,-.217,.69,.46,.34)
        knob('endpoint selector',x,-.22,.29,.103,'copper')
        for k in (-1,0,1):
            box('mode detent',(x+.15*k,-.177,.445-.034*abs(k)),(.034,.027,.045),'pearl')
    rod('channel linkage',(-.28,-.25,.28),(.28,-.25,.28),.025,'brass')
    box('control bridge',(0,-.25,.31),(.095,.08,.16),'ink')
    box('spine foot',(0,-.19,.63),(.032,.06,.47),'slate')


def polarization():
    lathe('exhibit foot',0,0,[(.24,0),(.27,.04),(.26,.1),(.16,.14),(.13,.25)],'basalt',14)
    spindle('exhibit mast',0,0,.13,.055,1.05,'brass')
    rod('ribbon crossbar',(-.36,0,1.16),(.36,0,1.16),.035,'copper')
    for x in (-.21,.21):
        rod('swivel strap',(x,0,1.17),(x,0,1.08),.028,'brass')
    enamel_ribbon('long vertical pennon',-.22,0,1.09,.17,.48,'blue',.017,.04)
    # Loose angled ribbon is fabricated in its own local plane before mounting.
    tilted=enamel_ribbon('turned horizontal pennon',0,0,0,.15,.37,'amber',.018,.04)
    tilted.rotation_euler.y=-math.pi/2;tilted.location=(.066,0,.94)
    rod('turned swivel',(.22,0,1.08),(.066,0,.94),.018,'copper')
    rod('dipole demonstrator',(-.11,-.15,.44),(.11,-.15,.61),.024,'pearl')
    rod('antenna strut',(0,0,.49),(0,-.15,.53),.022,'teal')
    sign('orientation sign',['TURN'],0,-.10,.32,.30,.12)


def banner():
    footplate('banner shoe',.40,.26,.10)
    spindle('standard',-.175,0,.1,.028,1.93,'brass')
    rod('banner arm',(-.207,0,1.93),(.33,0,1.93),.026,'brass')
    lathe('spear finial',-.175,0,[(.023,1.96),(.061,2.026),(.018,2.11),(.006,2.16)],'pearl',8,True)
    for x in (-.10,.08,.263):
        pipe('tab loop',[(x,.016,1.82),(x,.036,1.93),(x,-.026,1.95),(x,-.046,1.83)],.017,'copper')
    enamel_ribbon('forked signal standard',.081,-.010,1.86,.432,1.13,'plum',.012,.18)
    for i,(txt,z) in enumerate([('STRONG',1.69),('IS NOT',1.50),('THE SAME',1.31),('AS CLEAR',1.12)]):
        sign('embroidered motto strip',[txt],.081,-.067,z,.39,.13,back='plum',ink='paper')
    for x in (-.135,.296):
        rod('gold binding',(x,-.018,1.82),(x,-.018,.745),.010,'brass',8)


def cabinet():
    footplate('rooftop plinth',.97,.59,.14)
    box('weather enclosure',(0,.03,.69),(.78,.49,1.08),'slate')
    box('opening rim',(0,-.234,.69),(.73,.055,.99),'brass')
    box('dark recessed tool well',(0,-.273,.69),(.657,.042,.905),'ink')
    for i,x in enumerate((-.14,.10)):
        z=.74+.08*i
        rod('retained alignment handle',(x,-.317,z-.19),(x,-.317,z+.16),.027,'copper')
        rod('T grip',(x-.08,-.317,z+.15),(x+.08,-.317,z+.15),.032,'pearl')
        box('spring retaining clip',(x,-.34,z-.12),(.11,.047,.046),'brass')
    sign('tool return card',['TOOL','RETURN'],0,-.308,.40,.40,.18)
    # Open steel door to the side without screening the two tools.
    door=box('open rain door',(-.506,-.22,.67),(.31,.054,.95),'teal');door.rotation_euler.z=.46
    for z in (.35,.95):
        spindle('hinge pin',-.367,-.23,z,.033,.115,'copper')
    for i in range(5):
        louver=box('door ventilation slat',(-.516,-.26,.72+i*.053),(.19,.033,.028),'basalt');louver.rotation_euler.z=.46
    slab('pitched rain hood',[(-.46,1.22),(.46,1.22),(.44,1.29),(0,1.39),(-.44,1.29)],.015,.58,'teal')
    for x in (-.20,.22):spindle('bottom cable gland',x,-.04,.14,.058,.1,'copper')


def terminal():
    footplate('terminal footing',1.12,.63,.12)
    for x in (-.44,.44):
        slab('cantilever cheek',[(x-.075,.10),(x+.075,.10),(x+.10,.65),(x+.06,.74),(x-.10,.72)],0,.36,'slate')
    box('wireless console',(0,0,.70),(1.10,.48,.20),'teal')
    slab('arched instrument hood',[(-.53,.75),(.53,.75),(.49,1.02),(.38,1.11),(-.38,1.11),(-.49,1.02)],.068,.22,'teal')
    for x,txt in [(-.25,'PATH'),(.25,'SETUP')]:
        box('separate register',(x,-.065,.91),(.425,.045,.235),'ink')
        sign('register legend',[txt],x,-.098,.945,.36,.105,back='ink',ink='pearl')
        for j in (-1,0,1):
            box('unlatched mechanical flag',(x+.092*j,-.094,.845),(.065,.023,.044),'slate')
    for i in range(4):
        box('field key',(-.39+.115*i,-.197,.805),(.087,.088,.044),'paper')
    box('record key',(.27,-.18,.804),(.27,.098,.052),'brass')
    sign('record legend',['CHECK'],0,-.26,.68,.43,.105)
    for x in (-.38,.38):
        spindle('terminal ferrule',x,.17,1.05,.044,.10,'brass')
        rod('wireless stummel',(x,.17,1.14),(x+.06*(1 if x>0 else -1),.17,1.28),.022,'ink')


MODELS.update({62:mast,63:scope,64:clearance,65:beacon,66:selector,67:polarization,68:banner,69:cabinet,70:terminal})
