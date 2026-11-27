# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from model import *


def feather(name,start,end,width,color,rib,parent):
    p,q=Vector(start),Vector(end)
    d=q-p
    side=Vector((d.z,0,-d.x)).normalized()*width
    mid=p.lerp(q,.52)
    blade(name,[p,p.lerp(q,.28)+side*.79,mid+side,q,p.lerp(q,.65)-side*.78,p.lerp(q,.24)-side*.55],mid,.020,color,parent)
    stalk('feather_shaft',[p,p.lerp(q,.47)+Vector((0,-.033,0)),p.lerp(q,.86)],.007,rib,parent)


def thunderbird(base):
    breast=joint('surveyor_chest',(0,0,.53),base)
    head=joint('surveyor_watch',(0,-.04,1.22),breast)
    egg('keel',(0,.015,.90),(.258,.235,.415),'basalt',breast,tilt=.035)
    egg('buff_breast',(0,-.155,.93),(.212,.108,.30),'sand',breast)
    for row in range(3):
        for i in range(3-row):
            x=(i-(2-row)*.5)*.108
            feather('bib_lancet',(x,-.248,1.135-row*.073),(x,-.284,1.025-row*.073),.051,'cream' if row<2 else 'copper','sand',breast)
    for s in (-1,1):
        tube('perching_shank',[(s*.11,.012,.68),(s*.14,.024,.41),(s*.13,-.003,.198)],[.073,.050,.033],'brass',base,bands={3:'copper',5:'copper'},sides=12)
        for t in (-1,0,1):
            tube('hooked_talon',[(s*.13,-.003,.20),(s*.13+t*.039,-.082,.134),(s*.13+t*.063,-.142,.132),(s*.13+t*.070,-.169,.078)],
                 [.028,.023,.016,.003],'umber',base,sides=9)
        w=joint('wing_'+str(s),(s*.16,.015,1.11),breast)
        # Folded upper wing bones lead to individual long, upward-curved primary feathers.
        tube('arched_wing_bone',[(s*.14,.045,1.06),(s*.30,.035,1.13),(s*.44,.075,1.36),(s*.54,.13,1.52)],
             [.137,.119,.092,.041],'blue',w,sides=14)
        for i,(tip_x,tip_z) in enumerate([(.36,1.60),(.44,1.84),(.54,2.04),(.66,2.045),(.76,1.90),(.82,1.69)]):
            x=.21+.056*i
            start=(s*x,.115+i*.010,1.14+i*.049)
            end=(s*tip_x,.15+i*.011,tip_z)
            feather('flight_primary',start,end,.076,'azure' if i%3 else 'blue','glass',w)
        for i in range(5):
            feather('wing_covert',(s*(.23+.048*i),-.055,1.06+.060*i),(s*(.36+.084*i),-.013,1.30+.083*i),
                    .069,'teal' if i%2 else 'spruce','brass',w)
        for i in range(2):
            feather('forked_tail',(s*.07,.12,.74),(s*(.17+.06*i),.34+i*.08,.25-.07*i),.065,'blue','glass',breast)
    egg('forehead',(0,-.03,1.37),(.208,.181,.200),'cream',head)
    for s in (-1,1):
        egg('dark_eye_mask',(s*.091,-.155,1.402),(.097,.062,.084),'basalt',head,tilt=-s*.26)
        eye('eagle_eye',(s*.098,-.201,1.407),.049,head,-.12)
        feather('temple_crest',(s*.078,.036,1.51),(s*.21,.115,1.68),.047,'copper','brass',head)
    tube('hooked_beak',[(0,-.175,1.358),(0,-.285,1.362),(0,-.324,1.316),(0,-.31,1.27)],[.086,.062,.034,.004],'brass',head,sides=14)
    ring('survey_monocular',(.115,-.198,1.401),.076,.013,head,'copper')
    stalk('monocular_chain',[(.185,-.164,1.402),(.207,-.098,1.33),(.190,-.07,1.28)],.007,'brass',head)
    animate('idle',72,[swivel('surveyor_watch',2,.11,wave),swivel('wing_-1',1,.040,wave),swivel('wing_1',1,-.040,wave)])
    animate('reaction',36,[swivel('wing_-1',1,.13),swivel('wing_1',1,-.13),swivel('surveyor_watch',0,-.19)])
    animate('ability',56,[swivel('surveyor_watch',2,-.58),swivel('surveyor_chest',2,-.12),swivel('wing_1',0,-.18)])


def dragon(base):
    body=joint('ceremonial_belly',(0,0,.34),base)
    head=joint('receipt_salute',(-.17,-.03,.81),body)
    tail=joint('curled_tail',(.25,.09,.37),body)
    egg('seated_haunch',(.073,.026,.49),(.307,.219,.370),'blue',body,tilt=-.14)
    egg('velvet_belly',(-.006,-.145,.55),(.217,.095,.255),'sage',body,tilt=-.18)
    for j in range(3):
        stalk('belly_scute',[(-.154,-.205,.61-.073*j),(-.014,-.243,.575-.065*j),(.13,-.174,.60-.070*j)],.010,'glass',body)
    for s in (-1,1):
        x=s*.163
        egg('squat_knee',(x+.05,-.048,.285),(.150,.138,.185),'blue',base,tilt=-s*.19)
        egg('foot',(x+.025,-.117,.128),(.128,.164,.087),'basalt',base,.85)
        for i in range(3):
            tube('toe_claw',[(x-.038+.049*i,-.213,.145),(x-.041+.049*i,-.273,.109)],[.020,.004],'cream',base,sides=8)
        wing=joint('batwing_'+str(s),(s*.117,.099,.78),body)
        r=(s*.117,.115,.73);e=(s*.30,.16,.88);w=(s*.50,.165,1.115)
        for i,(endx,endz) in enumerate([(.69,1.01),(.64,.80),(.53,.69),(.37,.61)]):
            end=(s*endx,.205,endz)
            nxt=[(.64,.80),(.53,.69),(.37,.61),(.19,.68)][i]
            notch=(s*((endx+nxt[0])*.5-.037),.173,(endz+nxt[1])*.5+.047)
            mid=(s*((.50+endx+nxt[0])/3),.160,(1.115+endz+nxt[1])/3)
            blade('scalloped_membrane',[w,end,notch,(s*nxt[0],.21,nxt[1])],mid,.014,'azure' if i%2 else 'blue',wing)
            tube('wing_digit',[w,(s*((.5+endx)*.5),.17,(1.115+endz)*.5+.025),end],[.021,.016,.004],'basalt',wing,sides=9)
        tube('leading_wing_spar',[r,e,w],[.052,.044,.020],'blue',wing)
        tube('wing_claw',[w,(s*.525,.17,1.17)],[.021,.002],'cream',wing,sides=9)
    tube('curling_tail',[(.22,.08,.41),(.41,.11,.27),(.52,.07,.17),(.559,-.07,.15),(.495,-.12,.22),(.479,-.10,.285)],
         [.122,.084,.062,.047,.027,.004],'blue',tail,bands={13:'glass',16:'glass'})
    tube('collared_neck',[(-.025,.008,.63),(-.094,.014,.76),(-.17,-.025,.863)],[.178,.156,.14],'blue',body)
    egg('diplomat_skull',(-.208,-.052,.945),(.215,.165,.201),'blue',head,.84,tilt=-.10)
    egg('dragon_snout',(-.332,-.13,.909),(.177,.116,.094),'azure',head,.78)
    eye('near_eye',(-.281,-.187,1.00),.060,head,-.20)
    egg('far_eye',(-.326,.034,.998),(.058,.040,.063),'cream',head)
    egg('far_pupil',(-.355,.023,.999),(.029,.028,.039),'ink',head)
    egg('nostril',(-.438,-.211,.943),(.021,.015,.011),'ink',head)
    for s in (-1,1):
        tube('crowned_horn',[(-.179,s*.096,1.07),(-.129,s*.133,1.159),(-.087,s*.14,1.239),(-.103,s*.14,1.27)],
             [.045,.039,.018,.003],'cream',head,bands={3:'brass'},sides=12)
    for i in range(4):
        x=-.091+.062*i; z=1.05-.067*i
        blade('dorsal_spine',[(x,.03,z),(x+.029,.026,z+.091),(x+.082,.034,z-.032)],(x+.034,.03,z+.01),.029,'teal',body if i>1 else head)
    tube('resting_forearm',[(.121,-.122,.705),(.193,-.134,.648),(.199,-.173,.565),(.143,-.211,.550)],[.065,.062,.046,.040],'blue',body)
    for k in range(2):
        tube('resting_claw',[(.151+k*.028,-.203,.556),(.125+k*.028,-.224,.530)],[.013,.003],'cream',body,sides=8)
    arm=joint('receipt_clerk_hand',(-.15,-.17,.654),body)
    tube('presenting_arm',[(-.13,-.155,.65),(-.245,-.201,.572),(-.31,-.255,.632)],[.066,.052,.050],'blue',arm)
    egg('receipt_note',(-.34,-.268,.718),(.068,.016,.114),'paper',arm,.37,tilt=-.15)
    for i in range(3):
        stalk('embossed_rule',[(-.371,-.289,.755-i*.025),(-.315,-.289,.759-i*.025)],.004,'umber',arm)
    animate('idle',72,[swivel('curled_tail',2,.12,wave),swivel('receipt_salute',2,.085,wave)])
    animate('reaction',40,[swivel('receipt_clerk_hand',0,-.61),swivel('receipt_salute',1,-.26),swivel('batwing_1',1,.15),swivel('batwing_-1',1,-.15)])
