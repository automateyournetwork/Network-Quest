# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from model import *


def unicorn(base):
    body=joint('equine_chest',(0,0,.86),base)
    neck=joint('arched_neck',(-.36,0,1.11),body)
    head=joint('ledger_gaze',(-.60,-.02,1.53),neck)
    tail=joint('tail_fan',(.50,.03,1.08),body)
    egg('barrel',(.01,.018,.956),(.57,.22,.32),'ivory',body,tilt=-.04)
    egg('hindquarter',(.37,.02,.971),(.31,.245,.32),'ivory',body)
    for x in (-.32,.37):
        for s in (-1,1):
            y=s*.144
            offset=.055 if s==1 else -.045
            xx=x+offset
            points=[(x,y,.99),(xx,y,.73),(xx+(.13 if x>0 else -.025),y,.51),(xx+.022,y,.18),(xx-.025,y,.095)]
            tube('hindleg' if x>0 else 'foreleg',points,[.106,.084,.067,.046,.051],'ivory',body,
                 bands={11:'sage',12:'teal',13:'brass'},sides=12)
            egg('split_pearl_hoof',(xx-.041,y,.072),(.083,.065,.069),'spruce',body,.64,tilt=-.16)
    egg('chest_flews',(-.342,.01,1.07),(.228,.207,.244),'ivory',neck,tilt=-.24)
    tube('neck',[(-.32,.01,1.035),(-.43,.02,1.28),(-.47,.02,1.48),(-.60,-.02,1.57)],
         [.192,.193,.146,.156],'ivory',neck,sides=18)
    for i in range(6):
        t=i/5; x=-.53+.33*t; z=1.64-.51*t
        tube('combed_fibre_mane',[(x,.035,z),(x+.11,.04,z+.034),(x+.18,-.01,z-.105),(x+.20,-.033,z-.18)],
             [.044,.074,.046,.006],['sage','glass','teal'][i%3],neck)
    egg('poll',(-.635,-.03,1.57),(.212,.16,.188),'ivory',head,tilt=-.19)
    tube('tapered_face',[(-.67,-.04,1.58),(-.77,-.073,1.54),(-.88,-.091,1.465)],[.151,.126,.093],'ivory',head,sides=16)
    egg('soft_muzzle',(-.895,-.09,1.449),(.111,.105,.078),'sand',head,.85,tilt=-.27)
    for s in (-1,1):
        y=-.025+s*.102
        tube('ear',[(-.605,y,1.666),(-.58,y+s*.021,1.747),(-.55,y+s*.036,1.837)],[.055,.048,.004],'ivory',head)
        tube('inner_ear',[(-.606,y-.029,1.697),(-.584,y-.022,1.757),(-.561,y-.011,1.803)],[.020,.026,.002],'clay',head)
    eye('visible_eye',(-.724,-.166,1.59),.059,head,-.23)
    egg('far_eye',(-.723,.088,1.59),(.056,.036,.061),'ink',head)
    stalk('eyelid',[(-.785,-.153,1.635),(-.741,-.181,1.664),(-.675,-.152,1.653)],.010,'umber',head)
    egg('nostril',(-.943,-.165,1.474),(.024,.013,.015),'umber',head)
    start=Vector((-.707,-.03,1.71));end=Vector((-.935,-.055,2.10))
    tube('single_tapered_horn',[start,start.lerp(end,.44),end],[.071,.046,.003],'pearl',head,sides=16)
    pts=[]
    for i in range(32):
        t=i/32;a=t*TAU*3.8;r=.067*(1-t)
        pts.append(start.lerp(end,t)+Vector((math.cos(a)*r,math.sin(a)*r,math.cos(a)*r*.56)))
    tube('horn_spiral',pts,[.010*(1-i/33) for i in range(len(pts))],'brass',head,steps=2,sides=7)
    for i in range(4):
        y=(i-1.5)*.043
        tube('tail_lock',[(.52,y,1.09),(.70,y,1.10),(.755,y,.95),(.77,y-.02,.73),(.90,y-.06,.66+.047*i)],
             [.048,.068,.074,.060,.006],['teal','glass','sage','teal'][i],tail)
    stalk('ledger_strap',[(-.31,-.11,1.24),(-.14,-.213,1.12),(.08,-.218,.94),(.21,-.185,.88)],.032,'copper',body)
    egg('ledger_pages',(.14,-.225,.882),(.143,.051,.117),'paper',body,.30,tilt=-.13)
    egg('ledger_cover',(.14,-.262,.882),(.154,.024,.126),'spruce',body,.37,tilt=-.13)
    egg('ledger_clasp',(.235,-.290,.879),(.032,.014,.035),'brass',body,.41)
    animate('idle',72,[swivel('arched_neck',1,.034,wave),swivel('tail_fan',0,.16,wave)])
    animate('reaction',36,[swivel('ledger_gaze',1,.30),swivel('arched_neck',2,-.17)])
    animate('ability',54,[swivel('arched_neck',1,-.34),swivel('ledger_gaze',2,.29),swivel('tail_fan',1,-.17)])


def hydra(base):
    """Three reading positions around one shared optical ferrule and bound ledger."""
    body=joint('common_shell',(0,0,.36),base)
    egg('riverstone_belly',(0,.04,.527),(.49,.32,.38),'spruce',body)
    egg('opal_plastron',(0,-.172,.53),(.39,.181,.33),'sage',body,.75)
    for s in (-1,1):
        for row in (0,1):
            x=s*(.30+.07*row);y=-.18+row*.40
            tube('webbed_leg',[(x*.80,y,.47),(x*1.30,y,.31),(x*1.24,y-.05,.16)],[.10,.096,.055],'teal',base)
            egg('paddle_foot',(x*1.26,y-.085,.118),(.122,.126,.075),'spruce',base)
            for toe in (-1,0,1):
                egg('web_toe',(x*1.26+.045*toe,y-.162,.08),(.029,.060,.033),'sand',base)
    tube('single_swimming_tail',[(.10,.23,.48),(.32,.40,.36),(.49,.53,.27),(.47,.72,.18),(.39,.81,.22)],[.168,.140,.095,.054,.007],'spruce',body,
         bands={8:'glass',12:'glass'},sides=14)
    for i,(x,height) in enumerate([(-.54,1.57),(0,1.96),(.56,1.68)]):
        s=-1 if i==0 else 1
        anchor=(x*.35,.03,.72)
        root=joint('reading_neck_'+str(i),anchor,body)
        h=joint('reading_head_'+str(i),(x,-.055,height),root)
        points=[anchor,(x*.48,.04,.95),(x*.91,.095,height-.39),(x-.03*s,.035,height-.19),(x,-.055,height)]
        tube('flowing_neck',points,[.165,.145,.121,.111,.119],['teal','spruce','teal'][i],root,
             bands={4:'glass',8:'glass',12:'sage'},sides=14)
        egg('reader_cheek',(x,-.08,height+.045),(.159,.151,.163),'teal',h,.90,tilt=-.13*s)
        egg('padded_snout',(x+.016*s,-.178,height+.01),(.148,.115,.081),'sage',h,.85)
        for side in (-1,1):
            egg('nostril',(x+side*.046,-.278,height+.033),(.012,.009,.008),'spruce',h)
            eye('reader_eye',(x+side*.075,-.191,height+.095),.047,h,-.10*s)
            tube('gill_plume',[(x+side*.095,-.025,height+.14),(x+side*.155,-.006,height+.205),(x+side*.177,.034,height+.238)],
                 [.037,.032,.003],'violet' if i==1 else 'glass',h)
        if i==1:
            # One pair of spectacles for the middle reader.
            for side in (-1,1):
                ring('optician_frame',(x+side*.075,-.228,height+.095),.061,.007,h,'brass')
            stalk('spectacle_bridge',[(x-.015,-.230,height+.103),(x,-.242,height+.113),(x+.014,-.230,height+.103)],.007,'brass',h)
    egg('single_gauge_mount',(0,-.337,.63),(.148,.044,.135),'brass',body,.75)
    egg('single_shared_gauge',(0,-.374,.634),(.111,.029,.100),'paper',body)
    stalk('unlabelled_dial_hand',[(0,-.406,.621),(-.045,-.407,.675)],.009,'ink',body)
    animate('idle',72,[swivel('reading_neck_0',2,.095,wave),swivel('reading_neck_1',0,.05,wave),swivel('reading_neck_2',2,-.08,wave)])
    animate('reaction',36,[swivel('reading_neck_0',1,-.21),swivel('reading_neck_2',1,.19),swivel('reading_head_1',2,.32)])
    animate('ability',60,[swivel('reading_neck_0',1,.12),swivel('reading_neck_2',1,-.13),swivel('reading_neck_1',0,.33),swivel('reading_head_0',2,-.23),swivel('reading_head_2',2,.23)])
