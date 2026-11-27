# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from parts import *


def warning_cone():
    # Heavy octagonal base and raised light bands keep the silhouette distinct.
    deck('weighted octagonal foot',[(-.49,-.35),(-.34,-.47),(.34,-.47),(.49,-.35),(.49,.35),(.34,.47),(-.34,.47),(-.49,.35)],0,.105,'basalt')
    lathe('moulded cone',0,0,[(.37,.09),(.385,.12),(.35,.17),(.09,.99),(.07,1.04)],'clay',24)
    for z,r in [(.41,.28),(.70,.19)]:
        lathe('reflective encircling band',0,0,[(r,z),(r-.037,z+.12)],'paper',24)
    ring('open moulded neck',(0,0,1.04),.065,.065,.023,'copper',steps=24)
    pin('dark neck cavity',0,0,1.04,.043,.005,'ink')


def repair_clamp():
    # An open C frame leaves room for the actual bypass member.
    slab('cast C clamp',[(-.47,.14),(-.34,.045),(.28,.045),(.34,.12),(.34,.27),(.19,.31),(.14,.23),(-.24,.23),(-.30,.30),(-.30,.72),(-.24,.81),(.17,.81),(.20,.72),(.40,.72),(.41,.91),(.32,1.0),(-.32,1.0),(-.46,.88)],0,.23,'teal')
    path('reinforcing spine',[(-.35,-.128,.22),(-.38,-.128,.76),(-.28,-.128,.90),(.12,-.128,.90)],.028,'copper')
    panel('fixed jaw shoe',.245,0,.721,.23,.26,.061,'slate')
    pin('threaded boss',.251,0,.14,.122,.13,'copper',14)
    pin('screw shank',.251,0,-.04,.053,.58,'brass')
    path('exposed thread',[(.251+.058*math.cos(i*.27),.058*math.sin(i*.27),.278+i*.0021) for i in range(101)],.011,'copper',6)
    lathe('swivel pressure pad',.251,0,[(.05,.48),(.063,.52),(.123,.55),(.123,.593)],'slate')
    path('sliding tommy bar',[(-.027,0,-.045),(.54,0,-.045)],.029,'slate')
    for x in [-.04,.55]:bead('captive stop',x,0,-.045,.051,.051,.051,'brass')


def cable_ties():
    # A keeper strap with a clear hanging eye holds six individual ties.
    for i in range(6):
        x=(i-2.5)*.075
        path('ribbed tie tail',[(x*.56,.018*i,.74),(x*.78,.023*i,.54),(x*1.12,-.011*i,.26),(x*1.45,-.021*i,.044+(i%3)*.035)],[.027,.026,.024,.010],'teal' if i%2 else 'slate',5)
        panel('ratchet eye',x*.56,.018*i,.765,.079,.07,.086,'copper')
        panel('ratchet opening',x*.56,.018*i-.043,.769,.041,.016,.040,'ink')
        for j in range(3):
            panel('moulded transverse tooth',x*.8,.023*i-.028,.55-.040*j,.049,.010,.012,'copper')
    ring('keeper strip',(0,.035,.64),.155,.085,.026,'brass')
    ring('hanger loop',(0,.055,.88),.098,.13,.023,'brass',True)
    path('keeper neck',[(-.055,.05,.73),(-.062,.05,.68),(0,.06,.62)],.026,'brass')


def junction_box():
    shape=[(-.49,-.21),(-.39,-.32),(.39,-.32),(.49,-.21),(.49,.21),(.39,.32),(-.39,.32),(-.49,.21)]
    deck('closed iron pocket',shape,.02,.19,'basalt')
    deck('gasket outline',[(x*.98,y*.98) for x,y in shape],.19,.212,'ink')
    deck('lid casting',[(x*.96,y*.96) for x,y in shape],.211,.257,'slate')
    top_label('junction cover designation',['J BOX'],0,0,.270,.42,.17,'teal','pearl')
    for x in [-.36,.36]:
        for y in [-.22,.22]:
            pin('lid screw',x,y,.253,.030,.018,'brass')
            panel('driver slot',x,y,.273,.034,.006,.005,'ink')
    for x in [-.46,.46]:
        direction=1 if x>0 else -1
        path('capped conduit gland',[(x,0,.109),(x+direction*.11,0,.109),(x+direction*.17,0,.109)],[.096,.105,.07],'copper',8)


def ceiling_insulator():
    pin('upper bracket bolt',0,0,1.14,.10,.14,'brass',8)
    panel('ceiling shoe',0,0,1.24,.51,.37,.09,'slate')
    pin('suspended metal pin',0,0,.16,.071,1.02,'slate')
    lathe('single ribbed ceramic body',0,0,[(.080,.20),(.12,.23),(.14,.30),(.092,.35),(.092,.43),(.265,.48),(.27,.515),(.18,.57),(.108,.60),(.10,.67),(.245,.71),(.25,.746),(.16,.795),(.104,.83),(.098,.91),(.212,.946),(.218,.98),(.14,1.035),(.087,1.072)],'paper',32)
    pin('terminal ferrule',0,0,.12,.109,.17,'copper',12)
    ring('empty feed eye',(0,0,.081),.085,.08,.024,'copper',True,sides=10)
    for x in [-.19,.19]: pin('mounting hex nut',x,0,1.16,.051,.07,'brass',6)


def hanging_lamp():
    lathe('ceiling boss',0,0,[(.093,1.60),(.16,1.66),(.18,1.72)],'basalt',20)
    for i in range(5):
        r=ring('suspension chain link',(0,0,0),.047,.089,.016,'copper',True,steps=20)
        r.rotation_euler.z=.2 if i%2 else 1.25;r.location=(0,0,1.10+i*.113)
    lathe('vented canopy',0,0,[(.16,.79),(.18,.85),(.12,.94),(.08,.97),(.075,1.05),(.062,1.10)],'slate',24)
    # Outer and inner surfaces form a real hollow reflector with a rolled rim.
    rings=[(.46,.57),(.47,.605),(.37,.69),(.20,.84),(.14,.85),(.17,.80),(.34,.67),(.438,.57)]
    pts=[(r*math.cos(i*TAU/32),r*math.sin(i*TAU/32),z) for r,z in rings for i in range(32)]
    faces=[(j*32+i,j*32+(i+1)%32,(j+1)*32+(i+1)%32,(j+1)*32+i) for j in range(len(rings)-1) for i in range(32)]
    mesh('spun reflector bell',pts,faces,'teal',True)
    ring('rolled shade edge',(0,0,.58),.46,.46,.023,'brass')
    bead('amber working bulb',0,0,.52,.139,.139,.195,'amber')
    for i in range(6):
        a=i*TAU/6
        path('wire bulb cage',[(r*math.cos(a),r*math.sin(a),z) for r,z in [(.27,.64),(.24,.39),(.15,.29),(.06,.27)]],.015,'copper')
    ring('lower cage hoop',(0,0,.36),.22,.22,.016,'copper')


def maintenance_ladder():
    for s in [-1,1]:
        path('stile with curved return',[(s*.39,-.15,.04),(s*.39,.01,1.79),(s*.39,.06,2.33),(s*.39,.09,2.42),(s*.39,.16,2.44),(s*.39,.24,2.39)],.043,'copper',12)
        panel('rubber foot',s*.39,-.15,.07,.123,.13,.14,'basalt')
        for z in [.45,1.92]:
            y=-.15+z*.09
            path('stand off',[ (s*.39,y,z),(s*.39,.30,z)],.039,'slate')
            panel('wall shoe',s*.39,.32,z,.15,.065,.14,'teal')
    for i in range(8):
        z=.24+i*.26;y=-.15+z*.09
        path('fluted rung',[(-.39,y,z),(.39,y,z)],.032,'brass',12)
        for x in [-.18,0,.18]:
            path('anti-slip sleeve',[(x-.072,y,z),(x+.072,y,z)],.037,'basalt',10)


def service_hatch():
    outline=[(-.54,.065),(-.67,.21),(-.67,.96),(-.54,1.13),(.53,1.13),(.66,.99),(.66,.22),(.50,.065)]
    slab('wall flange',outline,.04,.13,'copper')
    slab('gasket reveal',[(x*.91,.58+(z-.58)*.90) for x,z in outline],-.042,.06,'ink')
    slab('pressed steel hatch',[(x*.86,.58+(z-.58)*.85) for x,z in outline],-.085,.064,'teal')
    for z in [.32,.86]:
        path('barrel hinge',[(-.51,-.15,z-.08),(-.51,-.15,z+.08)],.056,'brass',16)
        panel('hinge strap',-.39,-.143,z,.25,.032,.10,'slate')
    for x in [-.36,-.20,-.04,.12]:
        path('pressed stiffening rib',[(x,-.133,.33),(x,-.15,.43),(x,-.15,.80),(x,-.133,.89)],.024,'glass')
    lens('dog bearing',.36,-.146,.56,.103,.08,'brass',12)
    path('locking lever',[(.36,-.21,.56),(.43,-.24,.55),(.46,-.24,.40)],.038,'ink')
    for x in [-.58,.58]:
        for z in [.26,.95]:lens('mount fastener',x,-.054,z,.030,.035,'brass',8)


def pipe_valve():
    # Opposite flanges share one bore; the lifted handwheel drives a packing gland.
    for s in [-1,1]:
        path('short horizontal tail',[(s*.18,0,.29),(s*.53,0,.29)],.137,'teal',20)
        path('pipe flange',[(s*.45,0,.29),(s*.55,0,.29)],.22,'copper',20)
        path('bore seat',[(s*.54,0,.29),(s*.559,0,.29)],.108,'ink',16)
        for j in range(4):
            t=TAU*(j+.5)/4;y=.163*math.cos(t);z=.29+.163*math.sin(t)
            path('flange stud',[(s*.54,y,z),(s*.575,y,z)],.031,'brass',6)
    bead('gate valve body',0,0,.29,.25,.22,.23,'teal')
    lathe('bonnet',0,0,[(.19,.38),(.17,.49),(.19,.52),(.135,.58),(.087,.61)],'copper',12)
    pin('stem',0,0,.59,.044,.26,'brass')
    pin('packing nut',0,0,.61,.092,.09,'slate',8)
    ring('handwheel',(0,0,.87),.28,.28,.038,'clay',steps=36)
    for i in range(4):
        t=i*TAU/4
        path('wheel spoke',[(0,0,.84),(.27*math.cos(t),.27*math.sin(t),.87)],.022,'copper')
    pin('stem nut',0,0,.83,.066,.08,'brass',6)
