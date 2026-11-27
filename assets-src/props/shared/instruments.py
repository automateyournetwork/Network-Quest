# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""The apprentice's bench kit, meters and hand tools."""
from parts import *


def notebook():
    # Both sewn signatures curve down into the gutter. Individual visible leaf
    # edges follow the same bend as the page the apprentice has drawn on.
    for side in [-1,1]:
        cover=panel('rounded goatskin board',side*.47,0,.063,.96,1.16,.12,'teal')
        for j in range(5):
            xvals=[.035,.13,.34,.66,.86,.90-j*.004]
            heights=[.11,.17,.20,.19,.16,.15]
            pts=[(side*x,y,z+.010*j) for y in [-.53,.53] for x,z in zip(xvals,heights)]
            n=len(xvals)
            faces=[(i,i+1,i+n+1,i+n) for i in range(n-1)]
            page=mesh('sewn page signature',pts,[face if side==1 else tuple(reversed(face)) for face in faces],'paper' if j%2==0 else 'amber')
            mod=page.modifiers.new('Leaf edges','SOLIDIFY');mod.thickness=.008
        for y in [-.34,-.19,-.04]:
            path('ruled field note',[(side*.22,y,.238),(side*.39,y+.012,.248),(side*.67,y,.234)],.009,'slate')
    for x,y in [(-.69,.27),(-.42,.36),(-.26,.18)]:
        pin('charted station',x,y,.234,.035,.022,'copper')
    path('charted link',[(-.69,.27,.24),(-.42,.36,.255),(-.26,.18,.251)],.012,'teal')
    for i in range(3):
        path('sketched wave',[(.19+j*.035,.25+i*.063+.035*math.sin(j*.76),.248-.025*abs(.45-(.19+j*.035))) for j in range(18)],.008,'blue')
    path('bookmark ribbon',[(-.01,.36,.194),(-.015,-.43,.19),(-.09,-.65,.10),(-.19,-.69,.058)],.027,'clay')
    for y in [-.4,.4]:
        path('spine stitching',[(-.064,y,.155),(0,y,.162),(.064,y,.155)],.011,'brass')
    path('spine leather piping',[(0,-.57,.06),(0,.57,.06)],.058,'copper')
    for x in [-.91,.91]:
        for y in [-.53,.53]: pin('corner nail',x,y,.115,.024,.016)


def continuity():
    # The two probe tips park independently; the instrument has no asserted reading.
    slab('waisted tester body',[(-.44,.1),(-.51,.22),(-.43,.76),(-.28,.91),(.28,.91),(.43,.76),(.51,.22),(.44,.1)],.0,.38,'teal')
    sign('unpowered dial legend',['LEAD','TEST'],0,-.209,.68,.52,.24,'paper','ink')
    lens('selector surround',0,-.21,.37,.16,.08,'ink')
    lens('selector cap',0,-.265,.37,.11,.07,'brass',10)
    panel('rotary index',.018,-.31,.405,.035,.02,.09,'ink')
    for s,color in [(-1,'clay'),(1,'slate')]:
        lens('probe socket',s*.30,-.217,.24,.069,.075,color)
        pts=[(s*.3,-.24,.23),(s*.47,-.38,.09),(s*.68,-.40,.06),(s*.80,-.32,.08),(s*.85,-.14,.22),(s*.78,0,.38)]
        path('parked flexible lead',pts,.025,color)
        path('probe handle',[(s*.78,0,.33),(s*.68,.02,.54),(s*.61,.03,.70)],[.05,.057,.038],color,14)
        path('finger guard',[(s*.627,.028,.663),(s*.61,.03,.70)],.077,'ink',16)
        path('exposed separate tip',[(s*.61,.03,.70),(s*.53,.04,.89)],[.029,.006],'brass')


def power_meter():
    slab('rubber instrument boot',[(-.31,.06),(-.37,.14),(-.37,.92),(-.27,1.02),(.28,1.02),(.37,.92),(.37,.14),(.31,.06)],0,.26,'teal')
    panel('screen pocket',0,-.144,.70,.57,.045,.40,'ink')
    panel('optical display glass',0,-.172,.70,.51,.026,.32,'glass')
    # Wider glyphs distinguish the three stems of the lowercase m at the
    # inspection camera. Lowercase d and m retain the engineering unit dBm.
    patterns={
        'R':['11110','10001','10001','11110','10100','10010','10001'],
        'X':['10001','01010','01010','00100','01010','01010','10001'],
        '-':['00000','00000','00000','01110','00000','00000','00000'],
        ' ':['00000']*7,
        'd':['00001','00001','00001','01111','10001','10001','01111'],
        'B':['11110','10001','10001','11110','10001','10001','11110'],
        'm':['00000','00000','00000','11010','10101','10101','10101'],
    }
    for line,top in [('RX',.835),('-- dBm',.708)]:
        step=.013
        left=-(6*len(line)-1)*step/2
        vertices=[];faces=[]
        for k,char in enumerate(line):
            for i,row in enumerate(patterns[char]):
                for j,v in enumerate(row):
                    if v=='0':continue
                    x=left+(6*k+j)*step;z=top-i*step;q=len(vertices)
                    vertices.extend([(x,-.186,z-step),(x+step,-.186,z-step),(x+step,-.186,z),(x,-.186,z)])
                    faces.append(tuple(range(q,q+4)))
        mesh('display '+line,vertices,faces,'ink')
    for s in [-1,1]:
        lens('membrane key',s*.13,-.152,.335,.084,.048,'amber' if s<0 else 'blue',12)
        for z in [.25,.41,.56]:panel('protective side grip',s*.355,0,z,.065,.25,.055,'basalt')
    sign('flat name band',['POWER'],0,-.15,.145,.35,.067,'paper','ink')
    pin('optic socket ferrule',0,0,1.01,.115,.12,'brass',12)
    ring('adapter rim',(0,0,1.145),.079,.079,.024,'slate',steps=20)
    pin('unoccupied optical input',0,0,1.131,.059,.01,'ink')


def channel_analyzer():
    slab('analyzer trapezoidal case',[(-.62,.07),(-.73,.21),(-.66,.87),(-.52,.98),(.52,.98),(.66,.87),(.73,.21),(.62,.07)],0,.38,'slate')
    panel('inset graticule',-.12,-.209,.62,.86,.046,.48,'ink')
    for x in [-.45,-.24,-.03,.18]:
        panel('vertical graticule',x,-.239,.61,.009,.007,.36,'slate',)
    for z in [.48,.58,.68,.78]:panel('horizontal graticule',-.12,-.239,z,.73,.007,.008,'slate')
    path('survey trace',[(-.46,-.251,.50),(-.37,-.251,.53),(-.3,-.251,.52),(-.23,-.251,.70),(-.15,-.251,.72),(-.09,-.251,.50),(.0,-.251,.53),(.07,-.251,.62),(.13,-.251,.59),(.21,-.251,.50)],.012,'amber')
    sign('screen caption',['SWEEP'],.49,-.21,.70,.22,.09,'teal','pearl')
    lens('detented control',.47,-.261,.49,.105,.12,'copper',12)
    sign('trace label',['SURVEY'],0,-.205,.235,.48,.108,'paper','ink')
    for s in [-1,1]:
        pin('aerial foot',s*.49,0,.94,.061,.08,'brass')
        end=(s*.72,.03,1.42 if s>0 else 1.23)
        path('raised whip',[(s*.49,0,1.01),end],[.025,.011],'basalt')
        bead('whip end',*end,.023,.023,.026,'copper')


def cable_probe():
    center=[(-.78,0,.14),(-.59,0,.14),(-.38,.02,.15),(-.16,.05,.18),(.03,.07,.20)]
    path('insulating grip',center,[.086,.13,.125,.088,.085],'teal',16)
    for x in [-.62,-.52,-.42]:
        path('finger rib',[(x,0,.147),(x+.029,0,.147)],.136,'basalt',16)
    path('finger guard',[(.014,.07,.195),(.053,.07,.206)],.141,'brass',16)
    path('insulating shank',[(.05,.07,.201),(.38,.11,.213),(.54,.115,.225)],[.069,.05,.04],'paper',12)
    path('single tracing point',[(.54,.115,.225),(.72,.12,.235),(.82,.12,.246)],[.042,.022,.005],'copper',12)
    path('lanyard loop',[(-.76,0,.16),(-.83,-.10,.09),(-1,-.13,.05),(-1.06,-.01,.05),(-.97,.085,.06),(-.77,.035,.13)],.018,'slate')


def inspection_lens():
    ring('open inspection bezel',(0,0,.60),.42,.42,.052,'brass',True)
    lens('polished pale lens',0,.008,.60,.37,.065,'glass',40)
    arc('glass glint',(-.01,-.034,.61),.30,.29,.68,1.61,.014,'pearl')
    path('bezel arm',[(.29,0,.31),(.46,.01,.16),(.69,.02,.13)],.053,'copper')
    lens('swivel pin',.46,-.006,.17,.078,.12,'ink',12)
    path('rail clamp neck',[(.68,0,.13),(.72,.02,.21),(.82,.03,.22)],.047,'slate')
    slab('U mounting jaw',[(.73,.03),(.99,.03),(1.01,.26),(.93,.26),(.92,.14),(.75,.14)],.03,.19,'teal')
    pin('thumbscrew',.84,.035,.035,.062,.12,'brass',10)


def cleaning_wand():
    # The captive holder and dust cap support the wand as one tool identity.
    lathe('weighted cup',-.57,0,[(.17,.02),(.20,.045),(.16,.11),(.10,.15)],'slate',16)
    path('brush shaft',[(-.61,.02,.11),(-.36,.015,.23),(.05,0,.42)],[.065,.080,.07],'teal',16)
    path('fluted grip sleeve',[(-.42,.015,.20),(-.12,.004,.34)],.093,'copper',12)
    for j in range(4):
        path('sleeve rib',[(-.40+j*.07,.015,.214+j*.033),(-.387+j*.07,.015,.221+j*.033)],.097,'brass',12)
    path('narrowing applicator',[(.04,0,.42),(.53,0,.64)],[.068,.032],'paper',14)
    for i in range(7):
        t=i*math.tau/7
        a=(.50,.03*math.cos(t),.63+.03*math.sin(t))
        path('lint-free swab tuft',[a,(.65,.042*math.cos(t),.69+.04*math.sin(t)),(.72,.028*math.cos(t),.715+.028*math.sin(t))],[.025,.035,.015],'pearl')
    path('dust cap tether',[(-.62,0,.14),(-.72,-.06,.035),(-.85,-.13,.025),(-.91,-.17,.085)],.013,'ink')
    path('protective sleeve',[(-.94,-.18,.075),(-.74,-.20,.095)],.064,'teal',16)


def crimper():
    # Horizontal pliers with opposed, notched dies; two handles share one pivot.
    for s in [-1,1]:
        deck('forged lever',[(-.82,s*.24),(-.80,s*.38),(-.31,s*.27),(.09,s*.10),(.36,-s*.095),(.38,-s*.19),(.03,-s*.10),(-.37,s*.12)],.08+(s+1)*.014,.146+(s+1)*.014,'slate')
        path('insulated plier grip',[(-.90,s*.35,.14),(-.69,s*.30,.14),(-.42,s*.22,.14),(-.29,s*.18,.14)],[.078,.10,.092,.062],'teal' if s>0 else 'clay',14)
        deck('stepped crimp die',[(.22,s*.04),(.31,s*.18),(.63,s*.17),(.67,s*.052),(.59,s*.040),(.56,s*.105),(.49,s*.105),(.45,s*.047),(.41,s*.047),(.39,s*.097),(.34,s*.097),(.32,s*.038)],.098,.203,'basalt')
    pin('working pivot',.035,0,.10,.114,.126,'brass',16)
    panel('rivet slot',.035,0,.229,.078,.014,.008,'ink')
    path('return spring',[(-.42+.19*i/24,.10-.20*i/24,.15+.029*math.sin(i*1.65)) for i in range(25)],.014,'copper')


def splice_tool():
    # A portable, mechanical splice jig. No arc electrode or fusion lid.
    deck('chamfered palm base',[(-.72,-.22),(-.61,-.30),(.59,-.30),(.72,-.20),(.72,.22),(.60,.30),(-.60,.30),(-.72,.22)],.03,.13,'teal')
    for s in [-1,1]:
        panel('opposed sliding clamp carriage',s*.40,-.02,.173,.36,.34,.083,'copper')
        for y in [-.102,.041]:
            jaw=panel('V-block rail',s*.40,y,.236,.31,.066,.075,'slate')
            jaw.rotation_euler.x=(-1 if y<0 else 1)*.35
        path('fiber stub',[(s*.69,-.028,.25),(s*.35,-.028,.25),(s*.14,-.028,.245)],.012,'glass')
        pin('rail adjuster',s*.50,-.135,.20,.037,.06,'brass',10)
    panel('splice sleeve seat',0,-.028,.172,.34,.13,.087,'basalt')
    path('mechanical splice sleeve',[(-.138,-.028,.236),(.138,-.028,.236)],.048,'paper',8)
    for x in [-.138,.138]:path('sleeve collet',[(x-.022,-.028,.236),(x+.022,-.028,.236)],.057,'brass',8)
    for x in [-.115,.115]:panel('lever bearing lug',x,.19,.227,.069,.105,.17,'slate')
    path('lever hinge pin',[(-.18,.19,.293),(.18,.19,.293)],.045,'brass',12)
    strut('raised cam lever',(0,.185,.29),(0,.48,.61),.16,.069,'copper')
    path('cam lever grip',[(-.22,.48,.61),(.22,.48,.61)],.056,'teal',12)
    path('pressure foot',[(0,.19,.31),(0,.085,.365),(0,-.055,.385)],[.054,.046,.04],'slate',10)
    top_label('mechanical sleeve indication',['SLEEVE'],0,-.221,.146,.40,.107,'paper','ink')


def gloves():
    # Sewn glove shells have four articulated fingers plus a separate thumb.
    for k,(x,y,z,direction) in enumerate([(-.24,.10,.095,-.20),(.24,-.13,.15,.22)]):
        def pt(a,b,c):
            a=a if k==0 else -a
            return (x+a*math.cos(direction)-b*math.sin(direction),y+a*math.sin(direction)+b*math.cos(direction),z+c)
        points=[(-.18,-.20),(.16,-.20),(.205,-.11),(.215,.12),(.12,.21),(-.12,.21),(-.19,.12)]
        verts=[pt(a,b,0) for a,b in points]+[pt(a,b,.105) for a,b in points]
        n=len(points);faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)]
        mesh('padded palm',verts,faces if k==0 else [tuple(reversed(f)) for f in faces],'clay')
        for i,l in enumerate([.20,.30,.335,.26]):
            a=-.143+.088*i
            path('individual folded finger',[pt(a,.10,.04),pt(a,.19,.077),pt(a*1.12,.19+l*.59,.092),pt(a*1.18,.19+l,.010)],[.055,.059,.052,.042],'clay',12)
        path('opposable glove thumb',[pt(-.15,-.075,.04),pt(-.235,-.004,.093),pt(-.31,.11,.073)],[.081,.074,.045],'clay',12)
        aft=panel('deep gauntlet cuff',*pt(0,-.27,.032),.40,.22,.142,'teal');aft.rotation_euler.z=direction
        band=panel('gauntlet welt',*pt(0,-.345,.039),.407,.039,.15,'brass');band.rotation_euler.z=direction
        for a in [-.09,.0,.09]:path('raised palm crease',[pt(a,-.12,.109),pt(a*.8,.01,.113),pt(a,.07,.113)],.008,'copper')
