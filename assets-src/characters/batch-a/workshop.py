# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from model import *


def titan(base):
    body=joint('breath',(0,0,.84),base)
    head=joint('guardian_nod',(0,0,1.68),body)
    for s in (-1,1):
        x=.31*s
        egg('column_legging',(x,.02,.50),(.235,.22,.44),'basalt',base,.65,tilt=.08*s)
        egg('knee_arch',(x,-.16,.56),(.20,.11,.23),'slate',base,.78)
        egg('boot_last',(x,-.09,.18),(.275,.33,.19),'umber',base,.60)
        egg('boot_tread',(x,-.09,.073),(.28,.34,.062),'night',base,.47)
        stalk('copper_toecap',[(x-.18,-.35,.14),(x,-.405,.19),(x+.18,-.35,.14)],.018,'brass',base)
    egg('mason_coat',(0,.02,1.23),(.58,.33,.62),'teal',body,.72)
    egg('apron_bib',(0,-.265,1.22),(.405,.095,.52),'umber',body,.58)
    egg('apron_stitched_pocket',(0,-.355,1.05),(.272,.044,.16),'copper',body,.52)
    for s in (-1,1):
        stalk('bib_suspender',[(s*.33,-.31,1.43),(s*.39,-.22,1.70),(s*.36,-.04,1.76)],.045,'copper',body)
        egg('strap_stud',(s*.33,-.34,1.52),(.043,.024,.043),'brass',body)
        arm=joint('arm_'+str(s),(s*.56,0,1.58),body)
        egg('capstone_shoulder',(s*.59,0,1.59),(.29,.29,.22),'slate',arm,.68,-s*.22)
        egg('stone_sleeve',(s*.70,0,1.34),(.193,.208,.295),'basalt',arm,.66,-s*.20)
        egg('bellows_cuff',(s*.75,-.04,1.16),(.204,.195,.11),'brass',arm,.60)
        egg('mason_hand',(s*.78,-.11,1.00),(.205,.197,.22),'slate',arm,.67)
        for i in range(3):
            egg('knuckle',(s*(.67+i*.093),-.244,.98),(.057,.080,.13),'basalt',arm,.7)
        egg('thumb',(s*.63,-.16,1.055),(.095,.11,.098),'slate',arm)
        for i in range(3):
            egg('shoulder_stratum',(s*(.48+.11*i),-.186,1.68-.035*i),(.079,.065,.084),'lichen' if i==0 else 'basalt',arm,.63)
    # A real hollow-rimmed vessel carried low in the right fist.
    arm=RIG['arm_1']
    egg('enamel_mug',(.91,-.31,1.07),(.127,.117,.145),'cream',arm,.50)
    ring('rolled_mug_rim',(.91,-.31,1.206),.115,.013,arm,'brass',plane='XY')
    egg('tea_surface',(.91,-.31,1.201),(.101,.101,.009),'umber',arm)
    ring('mug_handle',(1.034,-.305,1.082),.070,.019,arm,'copper')
    egg('head',(0,0,2.01),(.397,.294,.37),'slate',head,.71)
    for s in (-1,1):
        egg('ear_outcrop',(s*.402,.008,2.03),(.088,.12,.15),'basalt',head,.70)
        eye('patient_eye',(s*.137,-.265,2.046),.100,head,-.11)
        tube('heavy_brow',[(s*.036,-.29,2.16),(s*.15,-.31,2.187),(s*.266,-.245,2.16)],[.043,.056,.02],'basalt',head)
    egg('blunt_nose',(0,-.306,1.982),(.116,.104,.097),'lichen',head,.71)
    for s in (-1,1):
        tube('swept_moustache',[(s*.014,-.313,1.924),(s*.11,-.325,1.926),(s*.26,-.258,1.965)],[.051,.060,.009],'cream',head)
    for i in range(-3,4):
        x=i*.080; top=1.897+.045*abs(i)
        tube('braided_ore_beard',[(x,-.234,top),(x*.95,-.292,top-.10),(x*.77,-.22,1.57+.050*abs(i))],
             [.075,.067,.012],'lichen' if i%2 else 'sage',head,bands={5:'copper',6:'brass'} if i%2==0 else None)
    egg('basalt_hardhat',(0,.012,2.255),(.407,.295,.168),'teal',head,.70)
    egg('hat_brim',(0,-.026,2.235),(.465,.37,.049),'copper',head,.68)
    for x in (-.19,0,.19):
        tube('hat_rib',[(x,-.255,2.272),(x*.86,-.17,2.39),(x*.68,.10,2.414),(x,.246,2.30)],
            [.015,.027,.024,.012],'brass',head)
    egg('headlamp_case',(0,-.282,2.345),(.102,.061,.097),'copper',head,.7)
    egg('lamp_lens',(0,-.326,2.344),(.071,.033,.067),'flame',head)
    animate('idle',72,[swivel('guardian_nod',2,.074,wave),shift('breath',2,.019,wave)])
    animate('reaction',36,[swivel('arm_1',0,-.64),swivel('guardian_nod',0,.16),swivel('guardian_nod',1,-.11)])


def copperhead(base):
    body=joint('coiled_body',(0,0,.10),base)
    neck=joint('raised_neck',(-.23,.03,.41),body)
    head=joint('inspection_head',(-.22,-.02,.83),neck)
    points=[(.78,.02,.055),(.60,-.12,.088),(.32,-.27,.12),(-.12,-.30,.138),(-.40,-.12,.15),(-.42,.17,.16),(-.12,.31,.18),(.29,.25,.20),(.42,.02,.26),(.23,-.11,.31),(-.05,-.10,.34),(-.23,.03,.41)]
    bands={n:('brass' if n%6==0 else 'umber') for n in range(4,43) if n%6 in (0,1)}
    tube('tapering_copper_coil',points,[.009,.050,.095,.123,.14,.147,.15,.15,.147,.144,.138,.13],'copper',body,bands=bands,sides=18)
    tube('viper_neck',[(-.23,.03,.41),(-.315,.05,.54),(-.30,.075,.67),(-.22,-.02,.83)],[.131,.125,.113,.125],
         'copper',neck,bands={2:'umber',3:'brass',8:'umber',9:'brass'},sides=18)
    egg('arrowhead',(-.21,-.078,.857),(.234,.225,.151),'copper',head,.80)
    egg('pale_mandible',(-.21,-.159,.804),(.178,.170,.075),'sand',head,.78)
    egg('snout',(-.21,-.238,.853),(.177,.130,.088),'copper',head,.74)
    for s in (-1,1):
        x=-.21+s*.134
        eye('viper_eye',(x,-.217,.925),.063,head,.10)
        tube('brow_scale',[(x-s*.052,-.206,.980),(x,-.196,1.002),(x+s*.081,-.124,.971)],[.013,.023,.008],'umber',head)
        egg('nostril',(-.21+s*.084,-.342,.891),(.017,.009,.012),'ink',head)
        blade('temple_diamond',[(x,-.109,1.004),(x+s*.05,-.07,.978),(x+s*.06,-.02,.956),(x,-.05,.980)],(x+s*.030,-.08,.978),.006,'brass',head)
    # Forked physical probes share the snake's jeweller-like collar, separate from its tongue.
    stalk('collar_bridge',[(-.39,-.11,.81),(-.37,-.15,.755),(-.27,-.179,.735)],.017,'teal',head)
    meter=joint('contact_fan',(-.365,-.12,.765),head)
    egg('meter_housing',(-.402,-.112,.736),(.071,.037,.074),'spruce',meter,.57)
    for s in (-1,1):
        tube('contact_probe',[(-.41+s*.026,-.117,.70),(-.44+s*.04,-.13,.64),(-.49+s*.068,-.181,.551)],
             [.016,.014,.009],'brass',meter,bands={0:'teal'},sides=8)
    stalk('tongue',[(-.21,-.31,.799),(-.204,-.381,.801),(-.20,-.429,.812)],.009,'clay',head)
    for s in (-1,1):
        tube('tongue_tip',[(-.20,-.423,.81),(-.20+s*.028,-.456,.822)],[.009,.0015],'clay',head,sides=8)
    animate('idle',72,[swivel('raised_neck',1,.065,wave),swivel('inspection_head',2,.10,wave)])
    animate('reaction',32,[swivel('raised_neck',0,-.25),swivel('inspection_head',2,-.44)])
    animate('ability',48,[swivel('raised_neck',0,.34),swivel('inspection_head',1,-.23),swivel('contact_fan',1,.92),swivel('contact_fan',0,.20)])
