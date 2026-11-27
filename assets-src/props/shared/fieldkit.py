# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from parts import *


def crystal_battery():
    # The fiction label separates this world power source from actual PoE hardware.
    lathe('weighted cell base',0,0,[(.23,.02),(.30,.07),(.29,.18),(.23,.22)],'basalt',8,True)
    for i,(x,y,z,h,r) in enumerate([(-.042,.025,.19,.79,.192),(.138,-.032,.19,.48,.093),(-.155,-.016,.22,.42,.087)]):
        pts=[(x+r*k*math.cos(j*TAU/6+.3),y+r*k*math.sin(j*TAU/6+.3),z+dz*h) for k,dz in [(.60,0),(1,.15),(.87,.78)] for j in range(6)]
        pts += [(x+r*.22,y-.03,z+h)]
        faces=[tuple(reversed(range(6)))]+[(j+n,(j+1)%6+n,(j+1)%6+n+6,j+n+6) for n in [0,6] for j in range(6)]+[(12+j,12+(j+1)%6,18) for j in range(6)]
        mesh('faceted fictional energy crystal',pts,faces,'violet' if i==0 else 'glass')
    ring('terminal guard',(0,0,.35),.242,.242,.026,'brass')
    for s in [-1,1]:
        pin('separate terminal',s*.245,-.1,.16,.06,.14,'clay' if s<0 else 'slate',10)
        path('cage brace',[(s*.17,.13,.17),(s*.20,.12,.38),(s*.14,.06,.69)],.025,'copper')
    sign('fictional supply plaque',['FICTION','CELL'],0,-.279,.146,.34,.163,'paper','ink')


def fuse_cartridge():
    # Open ceramic inspection window reveals the thin fusible link between ferrules.
    for s in [-1,1]:
        path('conducting end cap',[(s*.38,0,.169),(s*.57,0,.169)],[.165,.151],'brass',24)
        path('knurled cap shoulder',[(s*.36,0,.169),(s*.402,0,.169)],.174,'copper',16)
    # The front/top quadrant is intentionally cut away as a single window.
    pts=[]
    for x in [-.389,.389]:
        for i in range(25):
            a=math.radians(204+205*i/24);pts.append((x,.157*math.cos(a),.169+.157*math.sin(a)))
    faces=[(i,25+i,26+i,i+1) for i in range(24)]
    body=mesh('ceramic cartridge cutaway',pts,faces,'paper')
    m=body.modifiers.new('ceramic wall','SOLIDIFY');m.thickness=.018
    path('fusible link',[(-.405,0,.169),(-.25,-.025,.172),(-.075,-.032,.199),(.06,-.052,.147),(.19,-.024,.181),(.41,0,.169)],[.026,.023,.014,.014,.022,.026],'copper',10)

    # A dedicated low return tray protects the cartridge at the loan counter.
    # Keep its front lip low enough to expose the fusible link from the room camera.
    panel('single fuse return tray',0,0,-.032,1.32,.51,.065,'teal')
    for y in [-.249,.249]:
        panel('folded tray lip',0,y,.012,1.32,.035,.10 if y>0 else .056,'copper')
    for x in [-.638,.638]:panel('tray end stop',x,0,.028,.045,.47,.12,'teal')
    for x in [-.47,.47]:
        for y in [-.082,.082]:
            panel('ferrule chock',x,y,.023,.10,.055,.048,'slate')


def grounding_braid():
    # Two open ring lugs and interlaced flat copper strands lie on a shallow S.
    points=[(-.61,.03),(.63,-.065)]
    for x,y in points:
        ring('bolted ring lug',(x,y,.060),.109,.085,.040,'brass',sides=8,steps=24)
        panel('crimp throat',x*.81,y,.056,.13,.118,.07,'copper')
    for side in [-1,1]:
        for i in range(5):
            strand=[]
            for j in range(46):
                t=j/45
                wave=TAU*(t*3+i/5)
                strand.append((-.49+.99*t,.03-.095*t+.075*math.sin(TAU*t)+side*.085*math.cos(wave),.059+.019*math.sin(wave)*side))
            path('interwoven flat strand',strand,.012,'copper' if (i+side)%2 else 'brass',5)
    for s in [-1,1]:
        for j in range(2):panel('crimp impression',s*(.48+j*.045),.03 if s<0 else -.065,.099,.010,.090,.009,'slate')


def equipment_case():
    panel('ribbed road case shell',0,0,.36,1.34,.75,.70,'teal')
    panel('lid seal line',0,0,.54,1.36,.77,.064,'ink')
    panel('lid',0,0,.628,1.36,.77,.145,'slate')
    for x in [-.59,.59]:
        for y in [-.31,.31]:
            panel('impact corner',x,y,.095,.19,.17,.17,'copper')
            panel('lid corner',x,y,.66,.19,.17,.104,'copper')
    for x in [-.49,-.32,.32,.49]:
        panel('reinforced shell rib',x,-.373,.30,.044,.045,.39,'glass')
    for x in [-.36,.36]:
        panel('toggle latch seat',x,-.402,.53,.122,.062,.21,'slate')
        panel('toggle latch lever',x,-.44,.52,.086,.034,.126,'brass')
    for x in [-.154,.154]:panel('handle mount',x,-.27,.72,.10,.15,.066,'copper')
    path('raised carrying handle',[(-.156,-.27,.732),(-.15,-.27,.81),(-.10,-.27,.85),(.10,-.27,.85),(.15,-.27,.81),(.156,-.27,.732)],.030,'basalt',10)
    for y in [-.08,.11,.24]:panel('lid stacking runner',0,y,.713,.86,.028,.026,'basalt')


def bench_stool():
    for i in range(3):
        t=TAU*i/3-.40
        ax,ay=.37*math.cos(t),.37*math.sin(t)
        path('splayed bent steel leg',[(ax,ay,.041),(ax*.89,ay*.89,.22),(ax*.52,ay*.52,.49),(ax*.16,ay*.16,.57)],.034,'copper',12)
        pin('foot plug',ax,ay,0,.055,.065,'basalt')
    ring('footrest hoop',(0,0,.244),.32,.32,.024,'brass')
    lathe('seat screw socket',0,0,[(.12,.46),(.15,.50),(.125,.57),(.078,.60),(.078,.69)],'teal')
    pin('height screw',0,0,.67,.043,.19,'brass')
    path('adjustment thread',[(.045*math.cos(i*.25),.045*math.sin(i*.25),.685+i*.00156) for i in range(95)],.009,'copper',6)
    lathe('dished seat',0,0,[(.11,.79),(.26,.82),(.32,.87),(.315,.906),(.24,.92),(.17,.899),(.08,.88)],'teal',32)
    ring('rolled seat edge',(0,0,.884),.315,.315,.017,'brass')


def connector_tray():
    # Real annular cutouts in the insert, each with a visible recessed floor.
    panel('tray bottom',0,0,.035,1.17,.62,.065,'slate')
    for x in [-.565,.565]:panel('raised end lip',x,0,.123,.065,.65,.19,'copper')
    for y in [-.286,.286]:panel('long tray rim',0,y,.125,1.14,.065,.19,'teal')
    for i,(x,profile) in enumerate([
        (-.36,[(-.108,-.08),(.108,-.08),(.108,.05),(.046,.05),(.046,.105),(-.045,.105),(-.045,.05),(-.108,.05)]),
        (0,[(.102*math.cos(TAU*j/12),.102*math.sin(TAU*j/12)) for j in range(12)]),
        (.36,[(-.094,-.115),(.093,-.115),(.093,.06),(.045,.111),(-.094,.111)])]):
        n=len(profile);inner=[(x+a,b) for a,b in profile]
        outer=[]
        for a,b in profile:
            k=min(.161/abs(a) if a else 1e5,.225/abs(b) if b else 1e5)
            outer.append((x+a*k,b*k))
        verts=[(a,b,z) for loop,z in [(outer,.15),(inner,.15),(inner,.061),(outer,.061)] for a,b in loop]
        faces=[]
        for j in range(n):
            k=(j+1)%n
            faces += [(j,k,n+k,n+j),(n+j,n+k,2*n+k,2*n+j),(j,3*n+j,3*n+k,k)]
        mesh('keyed insert aperture',verts,faces,'paper' if i!=1 else 'glass')
    for x in [-.18,.18]:panel('insert divider',x,0,.13,.025,.47,.17,'basalt')


def map_scroll():
    # The rolls run across the two ends of a bent sheet. Both route branches
    # are illustrative marks. The authored room text supplies actual routes.
    xs=[-.6,-.44,-.22,0,.22,.44,.6]
    zs=[.18,.112,.085,.09,.11,.13,.18]
    v=[(x,y,z) for y in [-.39,.39] for x,z in zip(xs,zs)]
    ob=mesh('unrolled parchment',v,[(j,j+1,j+8,j+7) for j in range(6)],'paper')
    mod=ob.modifiers.new('page thickness','SOLIDIFY');mod.thickness=.016
    for s in [-1,1]:
        x=s*.618
        path('rolled parchment',[(x,-.424,.19),(x,.424,.19)],.118,'paper',24)
        path('wood roller',[(x,-.47,.19),(x,.47,.19)],.058,'copper',16)
        for y in [-.48,.48]:bead('turned spindle finial',x,y,.19,.071,.063,.071,'brass')
        pts=[]
        for j in range(38):
            a=j*.242; r=.104-.064*j/37
            pts.append((x+r*math.cos(a),-.426,.19+r*math.sin(a)))
        path('rolled edge spiral',pts,.008,'copper',6)
    def surf(x):
        for j in range(6):
            if x<=xs[j+1]:return zs[j]+(zs[j+1]-zs[j])*(x-xs[j])/(xs[j+1]-xs[j])+.012
        return zs[-1]+.012
    route=[(-.45,-.20),(-.29,-.1),(-.1,-.13),(.01,.014),(.22,.08),(.42,.229)]
    for coords,col in [(route,'teal'),([(-.10,-.13),(.01,.06),(.12,.23),(.26,.24)],'copper')]:
        path('inked route',[(x,y,surf(x)) for x,y in coords],.012,col)
    for x,y in [route[0],route[-1],(.26,.24)]:
        pin('map station',x,y,surf(x),.032,.009,'slate')
    for i in range(4):
        x=-.39+i*.065;y=.22+.025*(i%2)
        path('ridge sketch',[(x,y,surf(x)),(x+.028,y+.059,surf(x+.028)),(x+.057,y,surf(x+.057))],.007,'slate')


def maintenance_key():
    ring('open key bow',(0,0,.78),.217,.171,.056,'brass',True,sides=12,steps=32)
    ring('bow inner lobe',(0,0,.79),.094,.072,.021,'copper',True)
    path('removable shelf hook',[(0,-.033,.89),(0,-.045,.962),(0,0,1.03),(0,.13,1.065),(0,.245,1.04),(0,.27,.964)],.022,'slate',10)
    for s in [-1,1]:
        path('bow spoke',[(s*.083,0,.79),(s*.165,0,.80)],.020,'brass')
    lathe('warded shank',0,0,[(.049,.12),(.05,.53),(.076,.55),(.075,.59),(.054,.60),(.062,.65)],'brass',12)
    slab('stepped key bit',[(.018,.11),(.21,.11),(.21,.20),(.16,.20),(.16,.153),(.11,.153),(.11,.25),(.057,.25),(.057,.21),(.018,.21)],0,.094,'copper')
    pin('key tip',0,0,.05,.05,.105,'brass')


def evidence_tag():
    slab('clipped archive tag',[(-.32,.04),(.31,.04),(.31,.47),(.20,.59),(-.185,.59),(-.32,.47)],0,.040,'paper')
    ring('brass eyelet',(0,-.031,.505),.043,.043,.012,'brass',True,sides=8,steps=20)
    lens('eyelet shadow',0,-.027,.505,.032,.010,'ink')
    path('hanging cord',[(0,-.047,.507),(-.036,-.057,.63),(-.068,-.02,.72),(0,.0,.79),(.069,.0,.745),(.065,-.03,.686),(.014,-.046,.52)],.015,'copper')
    sign('ledger stamp',['BEFORE'],0,-.024,.369,.50,.127,'teal','pearl')
    for y,width in [(.22,.46),(.16,.35),(.10,.41)]:panel('blank record line',-.022,-.025,y,width,.01,.009,'slate')


def magnifying_visor():
    # Front and side pieces hinge from the open sweatband, with two faceted lenses.
    ring('headband top piping',(0,.075,.485),.45,.39,.023,'copper')
    ring('headband bottom piping',(0,.075,.385),.45,.39,.023,'copper')
    n=40;v=[(.45*math.cos(i*TAU/n),.075+.39*math.sin(i*TAU/n),z) for z in [.385,.485] for i in range(n)]
    strap=mesh('leather headband',v,[(i,(i+1)%n,n+(i+1)%n,n+i) for i in range(n)],'teal',True)
    mod=strap.modifiers.new('strap thickness','SOLIDIFY');mod.thickness=.021
    for s in [-1,1]:
        path('flip up side arm',[(s*.44,.03,.43),(s*.46,-.14,.405),(s*.39,-.35,.28)],.036,'brass')
        lens('pivot disk',s*.434,-.081,.432,.065,.07,'copper',12)
        poly=[(s*.026,.32),(s*.056,.16),(s*.17,.071),(s*.324,.091),(s*.408,.202),(s*.392,.324)]
        slab('eyepiece surround',poly,-.356,.065,'ink')
        cx=s*.205;cz=.217
        slab('ground magnifier',[(cx+(x-cx)*.82,cz+(z-cz)*.73) for x,z in poly],-.395,.032,'glass')
        path('lens highlight',[(s*.097,-.416,.269),(s*.235,-.416,.282)],.010,'pearl')
    path('nose bridge',[(-.092,-.37,.243),(0,-.37,.288),(.092,-.37,.243)],.024,'copper')


def message_token():
    # Engrave the highlighted NQ payload as two actual hexadecimal bytes.
    # Separate edge notches and a grip tab give the cartridge a keyed outline.
    coords=[(-.425,-.30),(.22,-.30),(.22,-.22),(.33,-.22),(.33,-.14),(.42,-.14),(.42,.19),(.31,.30),(-.425,.30),(-.48,.205),(-.48,-.21)]
    deck('keyed test token',coords,.03,.125,'brass')
    deck('enamel inset',[(x*.86,y*.80) for x,y in coords],.125,.147,'teal')
    top_label('pattern mark',['4E 51'],0,0,.171,.56,.194,'ink','pearl')
    for x in [-.28,-.14,0,.14]:
        panel('edge contact',x,-.225,.139,.053,.145,.023,'copper')
    for y in [-.13,.13]:pin('face pin',-.375,y,.13,.023,.019,'paper')
