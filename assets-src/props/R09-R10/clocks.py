# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Clockworks installations. The numbered labels refer to the room's declared teaching profiles."""
from parts import *


def master_wheel():
    # Janus escapement: a still wheel is a legitimate state in the untimed workshop.
    footplate('Cast clock bed',1.64,.64,.18)
    for x in [-.61,.61]:
        for y in [-.18,.16]:
            braces('Raked A-frame',x,y,1.21)
        pipe('Bearing bracket',[(x,0,1.20),(0,0,1.25)],.075,'slate',12)
    z=1.24
    wheel('Escapement teeth',0,-.11,z,1.02,.83,.12,'brass',24)
    wheel('Minute track',0,-.19,z,.84,.75,.05,'teal')
    for i in range(8):
        a=TAU*i/8
        def radial(r,shift=0):
            return (r*math.sin(a+shift),-.13,z+r*math.cos(a+shift))
        pipe('Curved wheel spoke',[radial(.14),radial(.45,.24),radial(.80)], [.068,.046,.053],'copper',10)
        x,y,h=radial(.79)
        stud('Studded outer rim',x,-.23,h,.033)
    lens('Axle bearing',0,-.14,z,.22,.22,'slate',24)
    lens('Octagonal center nut',0,-.28,z,.132,.075,'brass',8)
    arc('Resting pallet anchor',(0,-.23,2.24),.42,.19,3.25,6.13,.045,'copper')
    for x in [-.40,.40]:
        slab('Pallet stone',[(x-.055,2.2),(x+.06,2.20),(x,2.08)],-.22,.1,'pearl')
    sign('Permanent pause flag',['PAUSE AT WILL'],0,-.35,.34,.93,.14,'teal','pearl')
    sign('Permanent score flag',['NO TIMING SCORE'],0,-.36,.17,1.24,.14)


MODELS={91:master_wheel}


def loom():
    # Broad low floor loom, with an open shed and a shuttle laid across the front beam.
    for x in [-.82,.82]:
        slab('Loom trestle',[(x-.08,0),(x+.08,0),(x+.06,.85),(x-.06,.85)],.05,.62,'copper')
        pipe('Heddle tower',[(x,.25,.58),(x,.25,1.30)],.055,'teal')
    for z,y,r in [(.25,-.19,.050),(.53,-.26,.105),(.79,.15,.065),(1.27,.25,.055)]:
        rail('Warp beam',0,z,1.77,'slate' if r>.09 else 'brass',y,r)
    for i in range(18):
        x=(i-8.5)*.078
        pipe('Individual warp thread',[(x,-.29,.53),(x,-.15,.64),(x,.045,.72+(i%2)*.07),(x,.23,.82)],.009,'paper' if i%2 else 'blue',5)
    for i,(x,value) in enumerate(zip([-.56,-.19,.19,.56],['-3','+1','+3','-1'])):
        pipe('Heddle drop',[(x,.225,1.27),(x,.225,.94)],.015,'copper')
        sign('Ordered heddle sample',[f'{i}',value],x,.153,1.118,.238,.225,'ink','pearl')
    slab('Boat shuttle',[(-.53,.655),(-.39,.615),(.05,.615),(.24,.665),(.06,.71),(-.37,.705)],-.19,.10,'plum')
    rail('Shuttle bobbin',-.14,.671,.31,'amber',-.244,.022)
    sign('Loom controls',['STEP / PAUSE / REPLAY'],0,-.318,.345,1.28,.125)


def level_plinth():
    footplate('Teaching plinth sole',1.42,.60,.12)
    for i,(x,level,bits,height) in enumerate(zip([-.50,-.17,.17,.50],['-3','-1','+1','+3'],['00','01','10','11'],[.37,.50,.63,.76])):
        # Each step has its own face, with a level value above its represented pair.
        slab('Level step '+level,[(x-.162,.12),(x+.162,.12),(x+.162,height),(x+.12,height+.03),(x-.12,height+.03),(x-.162,height)],0,.46,'teal' if i%2==0 else 'slate')
        box('Metal cap',(x,.01,height+.048),(.322,.48,.046),'brass')
        sign('Declared level '+level,[level],x,-.238,height-.068,.265,.104,'ink','pearl')
        sign('Represented bits '+bits,[bits],x,-.238,height-.195,.248,.106)
    sign('Teaching model title',['TOY LEVEL / BITS'],0,-.312,.095,1.17,.106,'ink','pearl')


def console():
    slab('Operator console', [(-.77,0),(.77,0),(.73,.32),(.62,.46),(-.62,.46),(-.73,.32)],0,.65,'teal')
    box('Worktop alloy',(0,.023,.46),(1.49,.64,.07),'copper')
    for x,card in [(-.41,['A / ADVERTISES','1000/FULL','100/FULL']),(.41,['B / ADVERTISES','100/FULL','10/HALF'])]:
        box('Card slot',(x,.12,.545),(.67,.16,.12),'slate')
        box('Bakelite card frame',(x,.105,.755),(.69,.10,.45),'ink')
        sign('Independent endpoint offering',card,x,.044,.756,.632,.364)
    for x in [-.22,.22]:
        pipe('Selector pivot arm',[(x,-.16,.385),(x,-.23,.565)],.036,'brass')
    rail('Selector handle',0,.565,.44,'teal',-.23,.045)
    sign('Selection legend',['COMMON MODE'],0,-.337,.282,.76,.115)
    sign('Console foot legend',['MATCH BOTH ENDS'],0,-.336,.113,.92,.096,'ink','pearl')


def aperture():
    # A directional optical head carried in a U-shaped yoke, with an iris and a hood.
    lathe('Octagonal mounting foot',0,.015,[(.34,0),(.35,.065),(.28,.13),(.14,.17)],'slate',8,True)
    lathe('Signaling exhibit mast',0,.015,[(.115,.15),(.125,.19),(.09,.52),(.14,.57)],'teal',12)
    for x in [-.29,.29]:
        pipe('Yoke cheek',[(x*.36,.05,.52),(x,.05,.63),(x,.05,.92)],.055,'copper',10)
        lens('Pivot pin',x,.015,.92,.08,.11,'brass',8)
    lens('Barrel body',0,.04,.94,.275,.37,'slate',24)
    wheel('Lens hood lip',0,-.191,.94,.306,.225,.18,'basalt',sides=24)
    lens('IR window',0,-.154,.94,.20,.052,'plum')
    for i in range(7):
        a=TAU*i/7
        corners=[(.209,a),(.209,a+.76),(.103,a+1.10),(.103,a+.32)]
        slab('Iris blade',[(r*math.cos(t),.94+r*math.sin(t)) for r,t in corners],-.194,.013,'slate')
        pipe('Iris blade seam',[(r*math.cos(t),-.207,.94+r*math.sin(t)) for r,t in [corners[1],corners[2]]],.009,'copper',6)
    sign('Exhibit material',['IR APERTURE'],0,-.16,.375,.47,.102)


def sampling_gate():
    footplate('Four-window test stand',1.19,.53,.13)
    for x in [-.52,.52]:
        box('Sampling rack post',(x,.06,.68),(.115,.19,1.15),'copper')
    box('Backplane',(0,.12,.71),(1.03,.10,.83),'slate')
    sign('Rack identification',['SAMPLE POSITION'],0,-.065,1.13,.982,.132,'ink','paper')
    rail('Hood edge',0,1.25,1.2,'brass',.04,.043)
    for i,(x,val) in enumerate(zip([-.382,-.127,.127,.382],['-3','+1','+3','-1'])):
        # Four windows, complete values legible independently of the piece height.
        box('Deep window surround',(x,.032,.79),(.228,.085,.44),'teal')
        sign('Position header',[str(i)],x,-.03,.926,.17,.105)
        sign('Sample value',[val],x,-.03,.739,.183,.158,'ink','pearl')
        pipe('Lever stalk',[(x,-.016,.495),(x,-.13,.437)],.021,'brass')
        lens('Step key',x,-.139,.432,.047,.044,'plum',12)
    sign('Read-order plate',['READ 0 TO 3'],0,-.11,.225,.73,.121)


def recovery():
    footplate('Reconstruction bench',1.20,.48,.115)
    # A timing edge train enters a phase comparison disk; a divided-off dial only tells time.
    for x,h in [(-.35,.93),(.40,.65)]:
        pipe('Demonstration mast',[(x,.03,.10),(x,.03,h)],.072,'copper',10)
    z=.89
    wheel('Sampling phase ring',-.30,-.018,z,.338,.24,.095,'teal',sides=36)
    for i in range(8):
        a=TAU*i/8
        x=-.30+.297*math.sin(a);h=z+.297*math.cos(a)
        stud('Phase mark',x,-.075,h,.023)
    lens('Phase hub',-.30,-.06,z,.085,.09,'brass')
    pipe('Phase pointer',[(-.30,-.121,z),(-.13,-.12,z+.19)],[.034,.016],'pearl')
    pts=[(-.76,-.14,.45),(-.68,-.14,.45),(-.68,-.14,.55),(-.57,-.14,.55),(-.57,-.14,.45),(-.45,-.14,.45),(-.45,-.14,.59),(-.31,-.14,.59)]
    pipe('Incoming edge train',pts,.016,'glass',6)
    lens('Separate wall clock case',.375,.025,.77,.215,.13,'slate')
    lens('Wall clock dial',.375,-.052,.77,.183,.027,'paper')
    for i in range(4):
        a=i*math.pi/2
        stud('Wall clock quarter',.375+.139*math.sin(a),-.077,.77+.139*math.cos(a),.014)
    pipe('Wall clock hands',[(.303,-.08,.82),(.375,-.08,.77),(.375,-.08,.891)],.012,'ink')
    box('Divider',(.093,.02,.55),(.024,.13,.86),'brass')
    sign('Sampling purpose',['WHEN TO','SAMPLE'],-.30,-.122,.276,.47,.175)
    sign('Clock purpose',['WALL TIME'],.373,-.122,.347,.39,.095,'ink','paper')


def corridor_gate():
    # A narrow recessed, double-leaf pulse door. Inspections can follow each condition individually.
    for x in [-.31,.31]:
        slab('Chamfered door jamb',[(x-.065,0),(x+.065,0),(x+.055,1.93),(x-.055,1.93)],0,.42,'slate')
        box('Bright jamb edge',(x,-.21,1.01),(.034,.035,1.69),'copper')
    for x in [-.145,.145]:
        inner=.016 if x>0 else -.016
        outer=.27 if x>0 else -.27
        slab('Pulse door leaf',[(inner,.14),(outer,.14),(outer,1.72),(x,1.81),(inner,1.72)],.03,.12,'teal')
        for z in [.53,.72,.91]:
            pipe('Chevron relief',[(outer,-.047,z+.06),(inner,-.047,z-.05)],.019,'brass',8)
    slab('Vaulted pulse lintel',[(-.38,1.72),(-.38,1.91),(0,2.08),(.38,1.91),(.38,1.72),(0,1.87)],-.034,.442,'copper')
    sign('Preparation guard plate',['ONE ROUTE','MARKET','CALIBRATE'],0,-.176,1.39,.466,.313)
    sign('Gate destination',['RIFT'],0,-.267,1.89,.34,.113,'ink','pearl')


def dial():
    # Heavy handwheel with an indexed detent plate and four numbered positions.
    lathe('Tripod pedestal',0,0,[(.33,0),(.35,.055),(.27,.105),(.14,.19),(.105,.48)],'slate',6,True)
    box('Forward spindle bearing',(0,0,.535),(.23,.28,.28),'copper')
    z=.75
    lens('Index plate',0,-.02,z,.35,.17,'teal',32)
    wheel('Fixed scale bezel',0,-.119,z,.35,.295,.043,'brass',sides=36)
    for i,a in enumerate([2.72,1.95,1.18,.42]):
        x=.255*math.cos(a);h=z+.255*math.sin(a)
        sign('Detent position '+str(i),[str(i)],x,-.136,h,.088,.111)
    lens('Manual knob flange',0,-.149,z,.155,.068,'ink',16)
    wheel('Knurled knob edge',0,-.212,z,.151,.059,.086,'copper',12)
    lens('Knob shaft crown',0,-.241,z,.082,.071,'brass',8)
    slab('Raised index mark',[(-.09,z+.033),(-.165,z+.09),(-.118,z+.006)],-.264,.027,'pearl')
    sign('Manual operation',['UNTIMED','SELECT'],0,-.148,.244,.37,.171)


def projector():
    # The teaching decoder has four empty fields. The second transparency carries the distinct NQ frame.
    footplate('Common projector sled',1.17,.73,.095)
    box('Projector chassis',(-.125,-.09,.255),(.86,.50,.38),'slate',.07)
    for x in [-.40,-.29,-.18,-.07]:
        box('Vent rib',(x,-.11,.466),(.047,.30,.065),'teal')
    lens('Projection barrel',.10,-.355,.30,.137,.14,'ink')
    wheel('Focus ring',.10,-.439,.30,.148,.098,.073,'brass',12)
    lens('Glass front element',.10,-.445,.30,.086,.026,'glass')
    for x in [-.49,.49]:
        pipe('Transparency stand pin',[(x,.14,.08),(x,.14,1.18)],.036,'copper',10)
    box('Twin slide carrier',(0,.14,.88),(1.03,.07,.63),'basalt',.04)
    sign('Four-symbol exercise pane',['DECODE / 4 SYMBOLS'],0,.086,1.116,.91,.099,'ink','paper')
    for i in range(4):
        x=-.32+i*.212
        box('Unfilled pair field',(x,.087,.964),(.174,.025,.111),'paper')
        box('Entry underscore',(x,.068,.927),(.12,.009,.012),'ink',0)
    sign('Opaque frame header',['UPPER FRAME'],0,.085,.819,.90,.096,'teal','pearl')
    box('Opaque frame sleeve',(0,.079,.68),(.93,.056,.12),'plum')
    sign('Highlighted payload bytes',['NQ / 4E 51'],0,.042,.683,.55,.093)
    sign('Instrument name',['BIT PROJECTOR'],0,-.373,.076,.81,.077)


MODELS.update({92:loom,93:level_plinth,94:console,95:aperture,96:sampling_gate,97:recovery,
               98:corridor_gate,99:dial,100:projector})
