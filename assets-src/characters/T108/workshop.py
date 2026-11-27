# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""A walking fitter's cabinet and the keeper of the Antique Serial Post."""
from math import cos,sin,tau,pi,sqrt
from sculpt import orb,block,tube,line,eyes,joint,motion

def golem():
    chest=joint('cabinet',(0,0,.89))
    head=joint('inspector',(0,-.01,1.72),'cabinet')
    for s in (-1,1):
        x=s*.28
        block('broad forge boot',(x,-.064,.136),(.39,.48,.23),'coal',bevel=.075)
        block('toe plate',(x,-.19,.195),(.36,.22,.13),'iron',bevel=.055)
        tube('piston shin',[(x,0,.23),(x,0,.39),(x,.014,.5)],[.104,.122,.106],'copper')
        block('knee casting',(x,-.02,.56),(.27,.30,.27),'iron',bevel=.075)
        orb('knee rivet',(x,-.17,.57),(.066,.029,.066),'brass')
        block('thigh link',(x,0,.75),(.24,.22,.33),'pewter',bevel=.035)
    block('pelvic brace',(0,0,.86),(.77,.4,.19),'coal',bevel=.07)
    block('main drawer chest',(0,.006,1.26),(.9,.46,.84),'iron',chest,.12)
    block('cabinet face frame',(0,-.20,1.28),(.76,.16,.63),'coal',chest,.055)
    for j in range(3):
        drawer=joint('drawer'+str(j),(0,-.21,1.07+.194*j),'cabinet')
        block('drawer box',(0,-.19,1.065+.194*j),(.64,.26,.16),'copper' if j==1 else 'iron',drawer,.026)
        block('index slip',(-.204,-.328,1.063+.194*j),(.115,.015,.054),'cream',drawer,.007)
        line('arched drawer pull',[(.015,-.331,1.07+.194*j),(.035,-.38,1.07+.194*j),(.196,-.38,1.07+.194*j),(.215,-.331,1.07+.194*j)],.016,'brass',drawer)
    block('neck gasket',(0,0,1.7),(.35,.31,.15),'copper',head,.045)
    block('forged head',(0,-.019,1.88),(.61,.45,.37),'iron',head,.10)
    block('faceplate',(0,-.227,1.89),(.52,.069,.268),'teal',head,.043)
    eyes(head,0,-.267,1.91,.077,.138)
    for s in (-1,1):
        tube('sympathetic brow',[(s*.065,-.273,2.003),(s*.153,-.273,2.023),(s*.216,-.253,1.992)],[.012,.022,.014],'copper',head)
        arm=joint('shoulder'+str(s),(s*.455,0,1.50),'cabinet')
        orb('pauldron',(s*.5,0,1.48),(.195,.228,.193),'pewter',arm)
        tube('upper arm',[(s*.52,0,1.43),(s*.62,.01,1.22),(s*.65,-.005,1.13)],[.116,.102,.093],'coal',arm)
        orb('elbow bearing',(s*.65,0,1.12),(.123,.12,.12),'copper',arm)
        block('cast forearm',(s*.678,-.02,.987),(.24,.245,.29),'iron',arm,.052,(0,-s*.13,0))
        block('palm',(s*.68,-.049,.805),(.216,.19,.17),'teal',arm,.044)
        for j in range(3):
            tube('three curved digits',[(s*(.61+.068*j),-.078,.80),(s*(.61+.068*j),-.099,.707),(s*(.61+.068*j),-.14,.69)],[.036,.034,.022],'pewter',arm)
        for z in (1.03,1.54):
            orb('case rivet',(s*.395,-.195,z),(.025,)*3,'brass',chest)
    line('shallow smile',[(-.085,-.267,1.815),(-.03,-.271,1.802),(.053,-.269,1.807),(.089,-.264,1.823)],.012,'ink',head)
    motion('idle',{'inspector':((.035,.03,-.095),(0,0,0)),'shoulder1':((.05,0,.03),(0,0,0))},64)
    motion('reaction',{'inspector':((.18,0,.20),(0,0,0)),'drawer1':((0,0,0),(0,-.225,0)),'shoulder1':((-.48,.14,-.12),(0,0,0))},36)

def tortoise():
    body=joint('plastron',(0,.06,.33))
    head=joint('postmaster',(0,-.37,.46),'plastron')
    flag=joint('postal flag',(.355,.18,.68),'plastron')
    orb('wide plastron',(0,.025,.35),(.488,.586,.167),'ivory',body)
    orb('domed shell',(0,.085,.51),(.506,.606,.34),'moss',body)
    # Raised polygonal scutes follow the dome slope, while the broad rim stays continuous.
    for i in range(9):
        angle=tau*i/9
        x,y=.365*cos(angle),.43*sin(angle)
        orb('shell scute',(x,.085+y,.648),(.155,.160,.061),'teal' if i%3==0 else 'moss',body,(.54*sin(angle),-.54*cos(angle),angle))
    for i in range(5):
        a=tau*i/5
        orb('crown scute',(.197*cos(a),.085+.235*sin(a),.783),(.15,.165,.049),'sea' if i==2 else 'moss',body,(.28*sin(a),-.28*cos(a),a))
    orb('central rosette',(0,.085,.838),(.139,.157,.04),'moss',body)
    pts=[(.493*cos(tau*i/32),.085+.593*sin(tau*i/32),.425) for i in range(33)]
    line('rolled shell rim',pts,.032,'brass',body)
    for s in (-1,1):
        for y in (-.29,.38):
            tube('column foot',[(s*.34,y,.37),(s*.381,y,.245),(s*.402,y-.035,.082),(s*.39,y-.084,.061)],[.113,.105,.108,.068],'moss')
            for j in (-1,0,1):
                orb('blunt nail',(s*.396+.044*j,y-.117,.061),(.024,.042,.032),'ivory')
    tube('telescoping neck',[(0,-.29,.43),(0,-.44,.46),(0,-.55,.57),(0,-.635,.66)],[.124,.115,.109,.12],'sea',head)
    orb('postmaster face',(0,-.681,.682),(.20,.194,.172),'sea',head)
    orb('lower jaw',(0,-.76,.627),(.15,.135,.079),'ivory',head)
    eyes(head,0,-.813,.715,.068,.108)
    for s in (-1,1):
        pts=[(s*.108+.081*cos(tau*i/20),-.855,.717+.08*sin(tau*i/20)) for i in range(21)]
        line('spectacle rim',pts,.008,'brass',head)
    line('spectacle bridge',[(-.028,-.855,.718),(0,-.868,.726),(.028,-.855,.718)],.007,'brass',head)
    orb('station cap',(0,-.665,.837),(.203,.17,.081),'teal',head,(0,-.12,0))
    orb('cap peak',(0,-.795,.818),(.189,.123,.023),'bark',head)
    orb('cap brass button',(0,-.822,.859),(.031,.012,.029),'brass',head)
    # Side-mailbag with a folded flap, strap, and an actual pivoting postal semaphore.
    block('dispatch satchel',(.449,-.025,.523),(.131,.304,.20),'bark',body,.038)
    block('envelope showing',(.49,-.02,.624),(.042,.24,.11),'cream',body,.016,(-.07,0,0))
    line('mailbag flap stitching',[(.52,-.151,.55),(.525,-.022,.50),(.522,.107,.55)],.009,'honey',body)
    line('semaphore mast',[(.355,.18,.66),(.41,.19,.82),(.41,.19,.94)],.018,'brass',flag)
    block('post pennant',(.411,.25,.914),(.031,.16,.075),'clay',flag,.012)
    motion('idle',{'postmaster':((-.038,.06,.18),(0,-.025,.012))},72)
    motion('reaction',{'postmaster':((-.19,-.06,-.20),(0,-.078,.03)),'postal flag':((-.70,0,0),(0,0,0))},40)
