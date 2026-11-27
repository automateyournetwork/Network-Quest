# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Storm Observatory instruments and comparative exhibits."""
from parts import *
MODELS={}


def dish():
    lathe('radar anchor',0,0,[(.35,0),(.40,.08),(.37,.17),(.27,.22)],'basalt',12)
    lathe('bearing drum',0,0,[(.24,.19),(.25,.27),(.22,.31),(.18,.67),(.24,.73)],'teal',16)
    for x in (-.30,.30):
        slab('azimuth yoke',[(x-.065,.58),(x+.07,.58),(x+.08,1.23),(x,1.32),(x-.07,1.26)],0,.11,'copper')
    # A shallow paraboloid with individually removable sectors. Face it toward the survey walkway.
    center=Vector((0,.02,1.34));n=Vector((0,-.87,.49)).normalized()
    u=Vector((1,0,0));v=n.cross(u)
    def surface(r,a,back=0):return center+r*(u*math.cos(a)+v*math.sin(a))+n*(.32*r*r+back)
    for i in range(12):
        a=TAU*i/12
        vertices=[];faces=[]
        for j,r in enumerate((.065,.28,.53,.76)):
            for k in range(5):vertices.append(surface(r,a+.006+(TAU/12-.012)*k/4))
            if j:
                for k in range(4):
                    b=(j-1)*5+k;faces.append((b,b+5,b+6,b+1))
        sector=mesh('curved segmented reflector',vertices,faces,'pearl' if i%3 else 'glass')
        mod=sector.modifiers.new('Stamped metal wall','SOLIDIFY');mod.thickness=.014
        pipe('radial standing seam',[surface(r,a,.006) for r in (.06,.22,.43,.60,.76)],.010,'slate',6)
    pipe('rolled outer lip',[surface(.767,TAU*j/64) for j in range(65)],.026,'brass')
    hub=center+n*.45
    for j in (1,5,9):
        rod('feed support',surface(.67,TAU*j/12),hub,.018,'copper')
    pipe('weather receiver horn',[hub-n*.09,hub,hub+n*.07],[.085,.046,.039],'teal',14)
    for x in (-.30,.30):
        rod('elevation spindle',(x,0,1.22),(x,.14,1.22),.081,'brass')
    sign('weather chart header',['WEATHER'],0,-.218,.43,.36,.11)
    slab('illustrated winds',[(-.13,.30),(.06,.36),(.05,.39),(.14,.37),(.08,.30),(.08,.33),(-.13,.275)],-.222,.013,'pearl')


def emitter():
    footplate('isolation skid',1.06,.68,.15)
    box('oscillator case',(-.12,.018,.39),(.67,.48,.47),'teal')
    for i in range(6):
        box('vented cooling fin',(-.38+i*.092,.025,.674),(.032,.38,.115),'slate',.012)
    box('antenna insulator',(-.22,.08,.73),(.25,.18,.16),'paper')
    x,y=-.22,.08
    helix=[(x+.101*math.cos(t),y+.101*math.sin(t),.79+.34*i/84)
           for i,t in [(j,TAU*3.5*j/84) for j in range(85)]]
    pipe('helical test radiator',helix,.023,'copper',8)
    rod('feed core',(x,y,.77),(x,y,1.11),.019,'brass')
    for xx in (-.26,-.03):lens('insulated binding post',xx,-.255,.42,.061,.08,'pearl',14)
    pipe('removable jumper',[(-.26,-.30,.42),(-.27,-.35,.30),(-.20,-.37,.23),(-.10,-.37,.25),(-.03,-.30,.42)],.024,'amber')
    box('disconnect body',(.30,.06,.52),(.22,.30,.74),'basalt')
    slab('disconnect lever',[(.256,.52),(.30,.48),(.45,.86),(.40,.89)],-.13,.09,'brass')
    box('isolation handle',(.42,-.126,.875),(.18,.15,.095),'clay')
    sign('disconnect card',['ISOLATE'],.247,-.324,.181,.38,.096)


def telescope():
    tripod('observer tripod',.73,.44)
    lathe('mount head',0,0,[(.12,.71),(.15,.78),(.09,.89),(.085,.97)],'brass',16)
    slab('fork casting',[(-.13,.88),(.14,.88),(.17,1.12),(.07,1.2),(-.09,1.18)],0,.17,'slate')
    pivot('inclination tangent',0,-.12,1.07,.115)
    t=Vector((.94,.05,.33)).normalized();c=Vector((0,0,1.12))
    def axis(d):return c+t*d
    pipe('stepped telescope barrel',[axis(d) for d in (-.49,-.42,-.34,.18,.43,.54)],
         [.074,.095,.134,.145,.16,.18],'teal',24)
    for pos,rad in [(-.37,.14),(.13,.155),(.41,.17)]:
        rod('brass drawtube band',axis(pos-.020),axis(pos+.020),rad,'brass',24)
    pipe('objective hood',[axis(.51),axis(.60),axis(.63)],[.185,.206,.206],'copper',28)
    pipe('objective bezel',[axis(.621),axis(.634)],[.196,.190],'ink',28)
    pipe('pale objective glass',[axis(.635),axis(.639)],[.152,.146],'glass',28)
    rod('drawtube',axis(-.64),axis(-.48),.062,'brass')
    pipe('eyecup',[axis(-.67),axis(-.645),axis(-.62)],[.086,.086,.056],'ink',14)
    for d in (-.23,.03):
        a=axis(d);rod('finder shoe',a+Vector((0,.018,.09)),a+Vector((0,.018,.19)),.024,'copper')
    off=Vector((0,.018,.19))
    rod('finder telescope',axis(-.34)+off,axis(.14)+off,.041,'basalt',14)
    rod('finder hood',axis(.12)+off,axis(.17)+off,.06,'brass',14)
    rod('focus shaft',axis(-.25),axis(-.25)+Vector((0,-.17,0)),.026,'copper')
    a=axis(-.25);lens('knurled focus wheel',a.x,a.y-.18,a.z,.071,.05,'brass',12)


def meter():
    footplate('meter shoe',1.02,.51,.12)
    slab('meter casting',[(-.44,.10),(.44,.10),(.50,.23),(.49,.94),(.38,1.11),(-.38,1.11),(-.49,.94),(-.50,.23)],.022,.35,'teal')
    for x,txt,mat in [(-.24,'SIG','blue'),(.24,'NOISE','clay')]:
        box('power scale frame',(x,-.18,.77),(.42,.068,.51),'brass')
        box('power scale enamel',(x,-.224,.77),(.378,.024,.465),'paper')
        arc('dial graduation arc',(x,-.245,.705),.146,.155,.22,2.92,.011,'ink')
        for j in range(5):
            t=.23+j*.66
            rod('power scale notch',(x+.126*math.cos(t),-.248,.705+.133*math.sin(t)),(x+.150*math.cos(t),-.248,.705+.16*math.sin(t)),.007,'ink',6)
        # Parked at the stop; tick positions do not encode any scored reading.
        rod('parked pointer',(x,-.255,.695),(x-.123,-.255,.759),.012,mat,8)
        lens('needle bearing',x,-.254,.695,.033,.02,'copper')
        sign('power unit',[txt,'dBm'],x,-.246,.606,.33,.125,back='paper')
    sign('difference legend',['SNR / dB'],0,-.181,.417,.68,.156,back='ink',ink='paper')
    knob('sample selector',-.26,-.189,.246,.067)
    box('new sample button',(.24,-.186,.243),(.19,.076,.093),'clay')
    rod('protective bail',(-.32,0,1.12),(.32,0,1.12),.024,'brass')


def globe():
    lathe('globe base',0,0,[(.29,0),(.31,.047),(.28,.10),(.15,.13),(.115,.29),(.145,.35)],'basalt',16)
    cx,cy,cz=0,0,.75;r=.345
    lathe('survey globe',cx,cy,[(max(.010,r*math.cos(a)),cz+r*math.sin(a)) for a in [-math.pi/2+i*math.pi/18 for i in range(19)]],'blue',32)
    def pt(lon,lat,stand=.004):
        lon,lat=math.radians(lon),math.radians(lat)
        q=r+stand
        return (q*math.cos(lat)*math.sin(lon),-q*math.cos(lat)*math.cos(lon),cz+q*math.sin(lat))
    # Each continent is a triangulated, deliberately imaginary survey island.
    for name,outline in [('basin',[(-61,40),(-38,48),(-16,37),(-19,18),(-38,8),(-33,-13),(-49,-8),(-60,12)]),
                         ('cape',[(4,9),(21,22),(37,21),(53,33),(64,18),(59,-4),(39,-9),(27,-32),(18,-45),(13,-23)]),
                         ('isle',[(81,-14),(99,-10),(107,-24),(96,-39),(83,-33)])]:
        a=sum(s[0] for s in outline)/len(outline);b=sum(s[1] for s in outline)/len(outline)
        # Subdivide the patch radially so every facet sits on the globe.
        verts=[pt(a,b,.010)];faces=[]
        for j in range(1,5):
            for lon,lat in outline:verts.append(pt(a+(lon-a)*j/4,b+(lat-b)*j/4,.011))
        k=len(outline)
        for i in range(k):
            faces.append((0,1+i,1+(i+1)%k))
            for j in range(3):
                h=1+j*k
                faces.append((h+i,h+k+i,h+k+(i+1)%k,h+(i+1)%k))
        mesh(name+' island relief',verts,faces,'teal')
    for i,(la,delta,mat) in enumerate([(-28,28,'amber'),(7,29,'pearl')]):
        pipe('illustrated path '+str(i),[pt(-105+j*5,la+delta*math.sin(j/32*math.pi),.022) for j in range(37)],.011,mat,8)
    arc('brass globe meridian',(0,.032,cz),.393,.396,-2.03,1.5,.029,'brass')
    for x,z in [(-.17,.39),(.03,1.145)]:spindle('axis collar',x,.032,z,.052,.055,'copper')
    sign('concept legend',['CONCEPT'],0,-.18,.188,.42,.11)


def vane():
    lathe('roof flashing',0,0,[(.182,0),(.207,.046),(.123,.13),(.082,.28),(.067,.31)],'slate',10,True)
    spindle('vane shaft',0,0,.23,.028,1.90,'brass')
    fixed=list(bpy.context.scene.objects)
    for z in (1.50,1.85,2.06):
        lathe('shaft collar',0,0,[(.032,z),(.052,z+.025),(.05,z+.060),(.032,z+.07)],'copper',12)
    rail('compass crossarm',0,1.77,.49,r=.016)
    rod('fore and aft compass arm',(0,-.22,1.69),(0,.22,1.69),.016,'copper')
    for x,letter in [(-.197,'W'),(.197,'E')]:
        sign('compass letter',[letter],x,-.023,1.80,.093,.12,back='basalt',ink='pearl')
    rail('bearing arrow shaft',0,2.085,.60,r=.019)
    slab('storm arrowhead',[(.27,2.015),(.39,2.087),(.27,2.145),(.29,2.10)],0,.027,'pearl')
    slab('swallowtail fletching',[(-.13,2.075),(-.32,2.208),(-.296,2.12),(-.385,2.135),(-.313,2.06),(-.36,2.026),(-.16,2.045)],0,.035,'clay')
    slab('cloud lightning crest',[(-.09,2.116),(-.012,2.215),(-.044,2.215),(.084,2.38),(.057,2.26),(.103,2.27),(.018,2.108)],0,.037,'brass')
    for obj in list(bpy.context.scene.objects):
        if obj not in fixed: obj.location.z+=.64
    spindle('upper bearing extension',0,0,1.95,.028,.76,'brass')
    lathe('sleeved pole joint',0,0,[(.033,1.84),(.050,1.88),(.050,1.95),(.032,1.98)],'copper',12)
    box('diary rest',(0,-.070,.44),(.33,.17,.054),'copper')
    sign('weather diary',['WEATHER','DIARY'],0,-.091,.55,.30,.18)


def orbit():
    lathe('orrery foot',0,0,[(.23,0),(.28,.043),(.26,.095),(.16,.14),(.10,.22),(.085,.42)],'basalt',14)
    slab('forked orrery frame',[(-.09,.15),(.095,.15),(.19,.45),(.28,.62),(.24,.68),(.12,.60),(-.04,.38)],.055,.105,'brass')
    rod('planet bearing',(.248,.06,.644),(.121,.026,.688),.038,'brass',12)
    cz=.75
    lathe('painted planet',0,0,[(max(.006,.213*math.cos(t)),cz+.218*math.sin(t)) for t in [-math.pi/2+j*math.pi/14 for j in range(15)]],'violet',24)
    for z,r in [(cz-.067,.207),(cz+.043,.214)]:
        pipe('painted latitude',[(r*math.cos(TAU*i/36),r*math.sin(TAU*i/36),z) for i in range(37)],.010,'paper',6)
    # A tilted orbital hoop and a separate carrier with two solar-panel wings.
    pts=[];ang=-.53
    for j in range(65):
        t=TAU*j/64;xx=.485*math.cos(t);zz=.36*math.sin(t)
        pts.append((xx*math.cos(ang)-zz*math.sin(ang),-.02+.12*math.sin(t),cz+xx*math.sin(ang)+zz*math.cos(ang)))
    pipe('tilted orbital guide',pts,.019,'brass',8)
    sx,sy,sz=pts[19]
    sy-=.035
    box('satellite bus',(sx,sy,sz),(.115,.11,.115),'brass')
    for side in (-1,1):
        x=sx+side*.132
        rod('array spar',(sx,sy,sz),(x,sy,sz),.012,'copper')
        box('photovoltaic wing',(x,sy-.004,sz),(.121,.025,.110),'blue',.005)
        for k in (-1,0,1):box('array cell line',(x+k*.034,sy-.021,sz),(.006,.007,.100),'pearl',0)
    rod('spacecraft aerial',(sx,sy,sz+.05),(sx+.03,sy,sz+.12),.007,'pearl',6)
    sign('exhibit plate',['ORBIT'],0,-.108,.23,.30,.125)


def reflector():
    footplate('maintenance foundation',.66,.57,.12)
    spindle('vertical reflector support',0,.04,.10,.064,.78,'teal')
    for y in (-.19,.2):
        rod('triangular ground brace',(0,y,.13),(0,.04,.64),.027,'copper')
    rod('yaw spindle',(-.19,.04,.70),(.19,.04,.70),.051,'brass')
    # Passive folded plane reflector. Broad triangular faces and their angle differ from the radar bowl.
    points=[(-.39,-.12,.83),(0,.105,.81),(.39,-.12,.83),(-.36,-.11,1.24),(0,.107,1.39),(.36,-.11,1.24)]
    for i,mat in [(0,'pearl'),(1,'glass')]:
        o=mesh('folded reflector face',[points[k] for k in [i,i+1,i+4,i+3]],[(0,1,2,3)],mat)
        mod=o.modifiers.new('Sheet thickness','SOLIDIFY');mod.thickness=.017
    for i,j in [(0,1),(1,2),(2,5),(5,4),(4,3),(3,0),(1,4)]:
        rod('hemmed panel edge',points[i],points[j],.014,'copper',8)
    for p in [points[0],points[2],points[4]]:
        rod('reflector back stay',(0,.09,.68),p,.025,'slate')
    pipe('tag chain',[(-.22,-.02,.84),(-.24,-.07,.74),(-.22,-.09,.67)],.010,'brass',7)
    sign('maintenance tag',['PATH','SURVEY'],-.21,-.11,.587,.24,.166)


def drum():
    footplate('recorder feet',.96,.62,.12)
    for x in (-.38,.38):
        slab('extended cast trestle',[(x-.083,.11),(x+.085,.11),(x+.058,.43),(x-.056,.43)],0,.27,'teal')
    box('archive label rail',(0,-.19,.155),(.80,.14,.11),'teal')
    for x,txt in [(-.205,'BEFORE'),(.205,'AFTER')]:
        sign('archive heading',[txt],x,-.274,.168,.38,.103,back='teal',ink='paper')
    fixed=list(bpy.context.scene.objects)
    for x in (-.38,.38):
        slab('drum bearing frame',[(x-.06,.095),(x+.07,.095),(x+.075,.47),(x+.042,.66),(x-.047,.66),(x-.08,.47)],0,.25,'teal')
    rod('drum axle',(-.48,0,.57),(.48,0,.57),.055,'brass')
    def roll(name,left,right,r,mat):
        return rod(name,(left,0,.57),(right,0,.57),r,mat,36)
    for x in (-.30,0,.30):roll('chart retaining ring',x-.015,x+.015,.244,'copper')
    for x in (-.149,.149):
        roll('separate paper chart channel',x-.127,x+.127,.23,'paper')
        for j in range(3):
            # Faint ruled time bands deliberately have no pre-plotted values.
            a=-1.13+j*.68
            y,z=-.232*math.cos(a),.57+.232*math.sin(a)
            rod('ruled chart division',(x-.117,y,z),(x+.117,y,z),.004,'slate',6)
    for x in (-.14,.14):
        pipe('pen arm',[(x,-.23,.26),(x,-.33,.32),(x+.025,-.34,.51),(x+.015,-.235,.595)],.014,'brass')
        lens('pen hinge',x,-.26,.27,.036,.042,'ink',12)
    pipe('winding crank',[(.44,0,.57),(.48,0,.57),(.48,-.01,.72),(.53,-.01,.73)],.022,'copper')
    rod('winding grip',(.50,-.01,.73),(.58,-.01,.73),.034,'basalt')
    for obj in list(bpy.context.scene.objects):
        if obj not in fixed: obj.location.z+=.32
    rod('pen-hinge crossbar',(-.38,-.23,.58),(.38,-.23,.58),.025,'brass')


def desk():
    for x in (-.53,.53):
        foot=box('desk foot',(x,0,.055),(.22,.55,.11),'basalt')
        slab('tapered desk trestle',[(x-.085,.09),(x+.085,.09),(x+.115,.59),(x-.12,.59)],0,.30,'teal')
    rod('cross stretcher',(-.54,.07,.23),(.54,.07,.23),.043,'brass')
    box('survey counter',(0,0,.64),(1.51,.65,.14),'copper')
    box('dark work surface',(0,0,.712),(1.49,.64,.034),'basalt')
    for x,channel,noise,snr in [(-.38,'A','-90','25'),(.38,'B','-85','20')]:
        box('card holder',(x,.145,.89),(.61,.082,.36),'brass')
        sign('surveyed observation',[channel+' SURVEY','-65 / '+noise,snr+' dB SNR'],x,.092,.90,.56,.30)
        # Identical controls give both channel choices equal visual weight.
        box('test bus',(x,-.16,.75),(.49,.21,.069),'teal')
        for j in (-1,1):
            spindle('relay test contact',x+j*.11,-.165,.78,.041,.046,'pearl')
    sign('power pair units',['SIGNAL / NOISE  dBm'],0,-.343,.64,1.07,.11)
    for x in (-.58,0,.58):
        box('paper clip',(x,.103,1.06),(.07,.048,.046),'copper')


MODELS.update({71:dish,72:emitter,73:telescope,74:meter,75:globe,76:vane,77:orbit,78:reflector,79:drum,80:desk})
