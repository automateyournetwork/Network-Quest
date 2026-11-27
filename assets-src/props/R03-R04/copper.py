# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Ten original apparatus designs from the Warrens bench."""
from workshop import *

def interference_motor():
    feet([-.35,.35],depth=.75)
    for x in [-.35,.35]:
        profile_xz('Cast motor saddle',[(x-.14,.08),(x+.14,.08),(x+.08,.43),(x-.08,.43)],0,.48,'teal')
    axis=(1,0,0); center=(0,0,.60)
    turned('Ribbed iron stator',center,axis,[(-.43,.22),(-.38,.32),(-.31,.34),(.30,.34),(.39,.31),(.44,.23)],'patina')
    for a in range(12):
        ang=tau*a/12;y=.334*cos(ang);z=.60+.334*sin(ang)
        rod('Stator cooling flute',(-.29,y,z),(.28,y,z),.027,'teal',8)
    for x in [-.35,.34]:
        hoop('Bearing cover bead',(x,0,.60),axis,.326,.022,'copper')
    turned('External shaft bearing',(.46,0,.60),axis,[(-.045,.22),(0,.22),(.035,.12),(.08,.1)],'brass')
    turned('Shaft drive pulley',(.55,0,.60),axis,[(-.04,.12),(-.02,.17),(.005,.13),(.035,.17),(.05,.14)],'iron')
    turned('Motor endplate',(-.44,0,.60),axis,[(-.04,.18),(-.02,.26),(.02,.28)],'slate')
    box('Terminal junction box',(-.08,0,.965),(.39,.31,.19),'teal')
    box('Terminal box lid',(-.08,0,1.08),(.42,.34,.05),'brass')
    tube('Armored cable to terminal',[(-.23,.03,.99),(-.32,.04,1.09),(-.44,.04,1.13),(-.55,.04,1.05),(-.57,.04,.87),(-.52,.04,.80)],.033,'rubber')
    box('Notice bracket',(0,-.32,.28),(.33,.10,.08),'iron')
    card('Unmeasured environment notice',0,-.40,.28,'UNMEASURED',.72,.168)

def twisted_pair_cutaway():
    # Open-front acrylic window protects a magnified set of four separately traceable pairs.
    feet([-.41,.41],depth=.48)
    for x in [-.41,.41]:
        rod('Display riser',(x,0,.08),(x,0,.73),.055,'patina')
        box('Terminal comb',(x,0,.82),(.11,.30,.59),'teal',.021)
    pairmats=['blue','clay','patina','copper']
    for pair,mat in enumerate(pairmats):
        z=.63+.124*pair
        for strand in [0,1]:
            pts=[]
            for i in range(33):
                t=i/32; theta=tau*t*(2+pair*.28)+strand*pi
                pts.append((-.39+.78*t,.019*cos(theta)-.065,z+.038*sin(theta)))
            tube('Pair '+str(pair+1)+' conductor '+str(strand+1),pts,.013,mat if strand==0 else 'linen',6)
            for end in [-1,1]:
                rod('Termination ferrule',(end*.39,-.065+.019*cos((0 if end<0 else 1)*tau*(2+pair*.28)+strand*pi),z+.038*sin((0 if end<0 else 1)*tau*(2+pair*.28)+strand*pi)),(end*.48,-.064,z+.012*(1-strand*2)),.018,'brass',8)
        lettering('Terminal index',str(pair+1),(.418,-.155,z),.055,'linen')
    box('Clear back of cutaway',(0,.10,.82),(.73,.024,.59),'mica')
    rod('Hood upper bead',(-.48,.04,1.13),(.48,.04,1.13),.022,'copper')
    card('Termination card',0,-.10,.41,'BOTH ENDS',.62,.16)

def patch_panel():
    feet([-.51,.51],depth=.42)
    for x in [-.51,.51]:
        box('Rack upright',(x,0,.68),(.1,.18,1.22),'patina')
        box('Rack tip',(x,0,1.34),(.13,.20,.06),'copper')
    box('Rack backplane',(0,.012,.85),(1.15,.27,.66),'slate',.034)
    for z in [.86,1.06]:
        box('Replaceable port strip',(0,-.145,z),(1.06,.054,.15),'copper')
        for i in range(4):
            x=-.35+.233*i
            box('Keyed socket shadow',(x,-.184,z),(.164,.035,.088),'iron',.006)
            box('Socket latch recess',(x,-.199,z-.043),(.075,.018,.027),'rubber',.003)
            for n in range(8): box('Socket contact',(x-.05425+n*.0155,-.207,z+.024),(.007,.009,.023),'brass',0)
    card('Endpoint compatibility card',-.27,-.164,.64,'ENDS',.47,.13)
    card('Medium compatibility card',.27,-.164,.64,'MEDIA',.47,.13)
    for x in [-.39,.39]:
        tube('Rear strain relief loop',[(x,.1,.74),(x+.035,.18,.60),(x,.19,.51),(x-.04,.11,.50)],.026,'teal')

def cracked_spool():
    # A spoke flange with a real open wedge occupies the near end of a cable drum.
    axis=(0,1,0); z=.52
    turned('Timber drum barrel',(0,0,z),axis,[(-.28,.27),(.28,.27)],'oak')
    turned('Rear flange',(0,.28,z),axis,[(-.028,.42),(.023,.43),(.043,.40)],'copper')
    steps=74
    path=[(.31*cos(tau*5*i/steps),-.23+.46*i/steps,z+.31*sin(tau*5*i/steps)) for i in range(steps+1)]
    tube('Spiral winding',path,.050,'teal')
    arc=[(.42*cos(-.32+(tau-.44)*i/42),-.31,z+.42*sin(-.32+(tau-.44)*i/42)) for i in range(43)]
    tube('Fractured near flange rim',arc,.048,'copper',8)
    for i in range(5):
        a=tau*(i+.2)/5;rod('Spoke web',(0,-.31,z),(.40*cos(a),-.31,z+.40*sin(a)),.048,'oak',8)
    turned('Near axle socket',(0,-.33,z),axis,[(-.04,.10),(0,.13),(.03,.12)],'brass',16)
    for x in [-.27,.27]: box('Chock',(x,0,.065),(.30,.64,.13),'slate')
    tube('Archive tag clamp stem',[(-.308,-.31,.806),(-.312,-.31,.864),(-.309,-.235,.923),(-.303,-.171,.934)],.015,'slate')
    box('Evidence tag mounting clip',(-.303,-.171,.936),(.10,.058,.021),'brass',.006)
    p=[(.31,0,z),(.44,-.14,.48),(.47,-.27,.36),(.48,-.38,.23)]
    tube('Broken feed jacket',p,.046,'teal')
    for i in range(3):
        tube('Frayed open copper',[(.48+.009*i,-.38,.23),(.49+.014*i,-.397,.20),(.51+.017*i,-.406,.16+i*.012)],.007,'copper',6)

def tray_elbow():
    # A quarter-turn ladder tray guides a continuous stocked cable around the elbow.
    for y in [-.18,.18]:
        path=[(-.75,y,.25),(-.15,y,.25)]
        rad=.37-y
        path += [(-.15+rad*sin(pi*i/24),.37-rad*cos(pi*i/24),.25) for i in range(1,13)]
        path.append((-.15+rad,.62,.25));tube('Tray side rail',path,.041,'teal')
    for x in [-.68,-.48,-.28]:rod('Tray cross rung',(x,-.19,.23),(x,.19,.23),.024,'brass',8)
    for i in [1,4,7,10,12]:
        a=i*pi/24;rod('Radial cross rung',(-.15+.18*sin(a),.37-.18*cos(a),.23),(-.15+.55*sin(a),.37-.55*cos(a),.23),.024,'brass',8)
    path=[(-.76,0,.30),(-.15,0,.30)]+[(-.15+.37*sin(pi*i/24),.37-.37*cos(pi*i/24),.30) for i in range(1,13)]+[(.22,.65,.30)]
    tube('Continuous replacement stock',path,.045,'copper')
    for x,y in [(-.59,0),(.22,.42)]:box('Tray standoff',(x,y,.10),(.14,.26,.20),'slate')
    card('Replacement stock tab',-.47,-.225,.31,'85 M',.22,.11)
    # Lift the tray onto its two brackets. The frozen room also hangs a tie bundle
    # from the left support and rests a separate crimp tool on the right shelf.
    bpy.context.view_layer.update()
    for obj in list(bpy.context.scene.objects):
        obj.location.y*=.69
        obj.scale.y=.69
        obj.location.z+=.31
    for x in [-.59,.22]:
        box('Bracket floor shoe',(x,.07,.035),(.22,.29,.07),'iron')
        box('Bracket pillar',(x,.07,.20),(.080,.080,.31),'patina')
        tube('Angled shelf brace',[(x-.066,.08,.074),(x+.077,.08,.34),(x+.077,.08,.39)],.022,'brass')
    box('Crimp tool shelf',(.07,.12,.638),(.41,.22,.023),'slate',.01)
    for x in [-.087,.228]:rod('Shelf pin',(x,.12,.35),(x,.12,.63),.017,'copper')
    tube('Open hook for tie bundle',[(-.63,.16,.37),(-.63,.16,.61),(-.63,.15,.644),(-.63,.106,.648),(-.63,.087,.613)],.014,'brass')

def pair_separator():
    turned('Vise screw foot',(0,0,.10),(0,0,1),[(-.10,.26),(-.07,.28),(-.02,.26),(.005,.16),(.10,.13)],'iron')
    box('Bench vise throat',(0,0,.31),(.32,.32,.26),'patina',.045)
    for x in [-.10,.10]:
        tube('Splayed clamp arm',[(x,0,.32),(x*1.55,0,.44),(x*1.60,0,.53)],.044,'copper')
    box('Pair comb stock',(0,0,.54),(.53,.20,.13),'brass',.018)
    for i in range(5):
        x=-.212+i*.106
        profile_xz('Rounded separation tooth',[(x-.029,.57),(x+.029,.57),(x+.020,.72),(x,.75),(x-.020,.72)],0,.13,'linen')
    for i in range(4):
        x=-.16+.107*i
        tube('Conductor in comb groove',[(x*.35,.21,.40),(x*.60,.14,.53),(x,.04,.626),(x,-.09,.626),(x*1.15,-.18,.55)],.017,['clay','teal','blue','copper'][i])
    rod('Vise tommy bar',(-.29,-.145,.33),(.29,-.145,.33),.023,'iron')
    for x in [-.28,.28]:rod('Captive bar knob',(x-.02,-.145,.33),(x+.02,-.145,.33),.037,'copper')

def shielding_section():
    feet([0],depth=.36)
    rod('Mount post',(0,0,.09),(0,0,.92),.055,'patina')
    # Telescoping stepped sections expose an outer jacket, counterwound braid and inner bedding.
    axis=(.70,-.32,.52);d,u,v=axis_frame(axis);c=Vector((0,0,.71))
    def point(t):return c+d*t
    turned('Sliced outer rubber jacket',point(-.20),d,[(-.17,.17),(.16,.17)],'rubber')
    turned('Foil and braid bedding',point(.03),d,[(-.12,.14),(.11,.14)],'slate')
    for hand in [-1,1]:
        paths=[]
        for j in range(7):
            paths.append([point(-.05+.21*i/12)+.145*(u*cos(tau*j/7+hand*i*.13)+v*sin(tau*j/7+hand*i*.13)) for i in range(13)])
        tubing('Crosswoven screen '+str(hand),paths,.007,'brass',5)
    turned('Inner dielectric',point(.20),d,[(-.05,.115),(.075,.115)],'linen')
    for i in range(4):
        off=.052*(u*cos(i*pi/2)+v*sin(i*pi/2))
        rod('Inner insulated strand',point(.26)+off,point(.36)+off,.031,['teal','blue','clay','plum'][i],10)
        rod('Exposed strand tip',point(.35)+off,point(.40)+off,.013,'copper',8)
    card('Section caption',0,-.10,.28,'SHIELD',.42,.13)

def damaged_plug():
    box('Keyed plug shell',(0,0,.13),(.31,.28,.18),'pearl',.028)
    box('Contact carrier',(0,-.09,.223),(.28,.15,.035),'slate',.012)
    for i in range(8):
        x=-.114+i*.0325
        if i==5:
            tube('Bent contact tine',[(x,-.052,.25),(x,-.11,.264),(x+.008,-.156,.288)],.009,'copper',6)
        else:
            box('Flat contact land',(x,-.096,.248),(.017,.11,.012),'brass',.003)
    for x in [-.128,.128]:box('Shell side rail',(x,-.016,.246),(.024,.22,.035),'pearl',.006)
    box('Separated latch stub',(0,.065,.255),(.08,.05,.04),'rubber',.008)
    tube('Torn strain boot',[(0,.10,.14),(0,.17,.13),(.025,.235,.106)],.085,'patina')
    for i in range(3):
        tube('Escape strand',[(.022+i*.012,.22,.11),(.032+i*.019,.269,.1),(.038+i*.024,.285,.072+i*.006)],.009,'copper',6)
    card('Tool recovery card',-.02,-.173,.059,'RETURN',.24,.089)

def continuity_pedestal():
    turned('Pedestal plinth',(0,0,.13),(0,0,1),[(-.13,.34),(-.10,.39),(-.05,.40),(.02,.32),(.12,.23)],'slate',12)
    turned('Octagonal stand',(0,0,.53),(0,0,1),[(-.30,.22),(-.25,.25),(-.21,.22),(.18,.17),(.23,.22),(.27,.24)],'teal',8,False)
    box('Flat inspection table',(0,0,.91),(1.12,.69,.14),'copper',.045)
    box('Insulated tester seat',(0,0,1.006),(.98,.61,.065),'iron',.023)
    box('Central tester saddle',(0,.035,1.061),(.55,.36,.062),'slate',.020)
    for x in [-.38,.38]:
        rod('Binding post foot',(x,-.19,1.03),(x,-.19,1.055),.05,'brass',12)
        rod('Binding post',(x,-.19,1.055),(x,-.19,1.09),.035,'linen',12)
    card('Pedestal review tag',0,-.355,.89,'TEST',.31,.09)
    # Central saddle remains flat and free for the separately allocated PR122 tester.

def route_wheel():
    axis=(0,1,0); c=(0,0,.39)
    hoop('Rolling tire',c,axis,.36,.044,'rubber',36)
    hoop('Enamel wheel rim',c,axis,.319,.020,'copper',36)
    for i in range(7):
        a=tau*i/7;rod('Tensioned spoke',c,(.32*cos(a),0,.39+.32*sin(a)),.012,'brass',8)
    turned('Counter drive axle',c,axis,[(-.11,.07),(-.06,.10),(.04,.10),(.11,.06)],'teal',16)
    for y in [-.091,.091]:
        tube('Fork and handle strut',[(0,y,.40),(-.07,y,.58),(-.21,y,.80),(-.35,y,1.18)],.029,'teal')
    rod('Handle grip',(-.39,-.16,1.20),(-.39,.16,1.20),.044,'rubber')
    rod('Handle neck',(-.35,0,1.15),(-.39,0,1.20),.035,'brass')
    box('Mechanical counter housing',(-.23,0,.88),(.43,.24,.18),'patina',.038)
    card('Passive path lengths',-.23,-.135,.88,'95/100 M',.41,.13)
    tube('Parking kickstand',[(.01,.08,.39),(.14,.14,.21),(.20,.16,.018)],.021,'iron')
