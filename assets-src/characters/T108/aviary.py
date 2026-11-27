# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""A relay-survey phoenix and a travelling ground-to-space lecturer."""
from sculpt import orb, tube, line, feather, joint, eyes, motion, block
from math import cos, sin, tau

def bird_foot(x,y,key):
    tube('hock',[(x,y,.48),(x,y+.08,.28),(x,y,.10)],[.08,.052,.045],key)
    for i in (-1,0,1):
        tube('talon',[(x,y,.11),(x+.065*i,y-.09,.07),(x+.11*i,y-.19+.035*abs(i),.044),(x+.12*i,y-.21+.035*abs(i),.012)],[.04,.031,.022,.006],'brass')
    tube('rear talon',[(x,y,.10),(x,y+.1,.05),(x,y+.13,.02)],[.039,.023,.007],'brass')

def phoenix():
    body=joint('thorax',(0,.06,.62))
    head=joint('surveyor',(0,-.09,1.24),'thorax')
    orb('tapered flight breast',(0,0,.90),(.34,.31,.57),'russet',body,(-.23,0,0))
    tube('arching orange neck',[(0,.01,.95),(0,-.035,1.21),(0,-.115,1.4),(0,-.19,1.52)],[(.24,.20),(.18,.18),(.145,.145),(.17,.17)],'clay',head)
    orb('phoenix face',(0,-.20,1.55),(.221,.222,.214),'clay',head)
    eyes(head,0,-.37,1.58,.085,.108)
    tube('needle beak',[(0,-.365,1.53),(0,-.444,1.51),(0,-.57,1.468),(0,-.59,1.45)],[(.078,.058),(.075,.056),(.029,.026),(.006,.006)],'honey',head,12,(0,0,1))
    for s in (-1,0,1):
        feather('flame crown',(s*.057,-.11,1.68),(s*.18,.12+.06*abs(s),1.92-.07*abs(s)),.069,'honey' if s==0 else 'clay',head)
    for s in (-1,1):
        bird_foot(s*.16,.01,'copper')
        wing=joint('wing'+str(s),(s*.24,0,1.08),'thorax')
        tube('swept leading edge',[(s*.2,.02,1.02),(s*.48,.015,1.16),(s*.80,.045,1.38),(s*.99,.09,1.63)],[(.099,.086),(.095,.083),(.065,.055),(.012,.014)],'clay',wing)
        # Rigid outer relay vanes, step up and back in an unmistakable open fan.
        for j in range(6):
            t=j/5
            a=(s*(.30+.49*t),-.045+.010*j,1.045+.33*t)
            b=(s*(.49+.83*t),-.006+.013*j,.64+.90*t)
            feather('primary signal vane',a,b,.085 if j<5 else .067,'copper' if j%2==0 else 'honey',wing)
            p=tuple(a[k]*.70+b[k]*.30 for k in range(3))
            q=tuple(a[k]*.25+b[k]*.75 for k in range(3))
            line('vane spine',[(p[0],p[1]-.026,p[2]),(q[0],q[1]-.026,q[2])],.01,'russet',wing)
        for j in range(3):
            feather('mantle flame',(s*(.22+.095*j),-.06,1.12+.04*j),(s*(.37+.12*j),-.09,.91+.12*j),.075,'clay',wing)
        for j in range(2):
            feather('breast gorget',(s*(.073+.073*j),-.225,1.13),(s*(.106+.07*j),-.30,.90+.045*j),.075,'honey' if j==0 else 'copper',body)
    train=joint('split train',(0,.17,.72),'thorax')
    for j in range(-2,3):
        s=j/2
        tube('streaming pennant',[(s*.07,.2,.75),(s*.13,.46,.65),(s*.26,.66,.41),(s*.30,.76,.22+.065*abs(s)),(s*.37,.85,.25+.085*abs(s))],
             [(.03,.028),(.076,.045),(.075,.045),(.049,.028),(.004,.006)],'honey' if j%2==0 else 'clay',train)
    # The brooch is the surveyor's sighting instrument: a rim, crosshair, and pointer.
    orb('azimuth brooch',(0,-.31,.99),(.098,.040,.098),'teal',body)
    rim=[(.09*cos(tau*i/24),-.348,.99+.09*sin(tau*i/24)) for i in range(25)]
    line('brass sighting rim',rim,.012,'brass',body)
    line('bearing pointer',[(-.045,-.355,.959),(.048,-.356,1.025)],.013,'cream',body)
    motion('idle',{'surveyor':((.035,0,.19),(0,0,0)),'split train':((.13,.09,0),(0,0,0)),'wing1':((0,-.055,0),(0,0,0)),'wing-1':((0,.055,0),(0,0,0))},60)
    motion('reaction',{'surveyor':((-.13,-.13,-.30),(0,0,.018)),'wing1':((-.08,-.42,.12),(0,0,0)),'wing-1':((-.08,.42,-.12),(0,0,0)),'split train':((-.26,0,0),(0,0,0))},32)

def eagle():
    chest=joint('mantle',(0,0,.56))
    head=joint('astronomer',(0,-.12,1.27),'mantle')
    orb('greatcoat body',(0,.04,.96),(.37,.34,.59),'aubergine',chest,(-.12,0,0))
    orb('astronomer ruff',(0,-.06,1.35),(.334,.282,.27),'ivory',head)
    orb('bald crown',(0,-.14,1.54),(.268,.244,.238),'cream',head)
    for s in (-1,1):
        for j in range(3):
            feather('ruff quill',(s*(.09+.074*j),-.232+.012*j,1.41),(s*(.1+.089*j),-.264,1.17+.053*j),.085,'ivory' if j!=1 else 'cream',head)
    eyes(head,0,-.319,1.56,.096,.133)
    for s in (-1,1):
        tube('eagle brow',[(s*.062,-.383,1.627),(s*.145,-.37,1.656),(s*.236,-.275,1.626)],[.026,.040,.016],'ivory',head)
    tube('hooked maxilla',[(0,-.315,1.54),(0,-.434,1.508),(0,-.48,1.47),(0,-.483,1.392)],[(.112,.079),(.094,.066),(.055,.047),(.009,.011)],'brass',head,12,(1,0,0))
    tube('lower bill',[(0,-.306,1.465),(0,-.39,1.442),(0,-.451,1.45)],[.076,.048,.015],'copper',head)
    for s in (-1,1):
        bird_foot(s*.192,-.045,'brass')
        folded=joint('cloak'+str(s),(s*.28,.05,1.22),'mantle')
        orb('folded wing shoulder',(s*.291,.04,1.06),(.175,.27,.355),'blue',folded,(-.25,s*.11,0))
        for j in range(5):
            y=.20-.09*j
            feather('night blue folded flight quill',(s*(.34+.01*j),y,1.16-.024*j),(s*(.32+.029*j),y+.21,.265+.056*j),.088,'teal' if j in (1,3) else 'iron',folded)
        for j in range(3):
            orb('constellation stud',(s*.445,-.018+.085*j,1.17-.055*j),(.023,.027,.025),'cream',folded)
    book=joint('star folio',(0,-.26,.81),'mantle')
    block('folded survey chart',(0,-.30,.79),(.34,.093,.28),'teal',book,.031,(0,-.15,-.08))
    block('chart page block',(0,-.305,.91),(.30,.08,.035),'ivory',book,.013,(0,-.15,-.08))
    for j in (-1,1):
        line('map case strap',[(j*.21,-.215,1.15),(j*.14,-.31,.97),(j*.11,-.346,.87)],.021,'copper',book)
    # A brass armillary mounted behind the cap gives the navigator its own profile.
    for j,xrot in enumerate((.04,.63)):
        pts=[]
        for k in range(33):
            a=tau*k/32
            pts.append((.30*cos(a),.03+.24*sin(a)*sin(xrot),1.68+.24*sin(a)*cos(xrot)))
        line('celestial sight hoop',pts,.013,'brass',head)
    orb('pole star',(.25,.02,1.81),(.038,)*3,'honey',head)
    for j in (-1,0,1):
        feather('tail quill',(j*.09,.19,.78),(j*.17,.52,.255),.115,'plum',chest)
    motion('idle',{'astronomer':((-.05,.06,-.18),(0,0,0)),'cloak1':((.04,.06,0),(0,0,0))},64)
    motion('reaction',{'astronomer':((-.29,-.07,.27),(0,0,.016)),'cloak1':((-.23,-.29,0),(0,0,0)),'cloak-1':((-.11,.13,0),(0,0,0)),'star folio':((-.26,0,0),(0,-.021,.021))},34)
