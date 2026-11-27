# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Iron Threshold civic ironwork and independent validation instruments."""
from parts import *

MODELS={}


def gate():
    for side in [-1,1]:
        x=side*1.24
        box('gate pier plinth',(x,0,.125),(.53,.60,.25),'basalt')
        box('pier foot molding',(x,0,.295),(.46,.53,.11),'copper')
        box('splayed stone pier',(x,0,1.28),(.34,.4,1.91),'slate')
        slab('buttress stepped fin',[(x-.20,.36),(x+.20,.36),(x+.14,.78),(x+.12,2.40),
             (x+.035,2.56),(x-.09,2.38),(x-.13,.79)],-.205,.09,'basalt')
        box('pier pilaster',(x,-.252,1.47),(.065,.029,1.68),'copper')
        lathe('pier top cap',x,0,[(.27,2.24),(.27,2.31),(.17,2.43),(.045,2.65)],'copper',4,True)
        # Closed leaves share a center seam. The lintel stands apart from the chamber door behind it.
        x0,x1=sorted([side*.02,side*1.08])
        out=[(x0,.08),(x1,.08),(x1,2.15 if side==1 else 2.55),(x0,2.55 if side==1 else 2.15)]
        slab('closed iron leaf',out,.055,.16,'ink')
        for i in range(4):
            cx=side*(.16+i*.249); top=2.48-abs(cx)*.36
            slab('stepped door flute',[(cx-.086,.23),(cx+.086,.23),(cx+.086,top-.17),
                 (cx,top),(cx-.086,top-.17)],-.047,.065,'slate' if i%2 else 'basalt')
        for z in [.40,1.10,1.86]:
            box('leaf strap',(side*.55,-.121,z),(1.015,.082,.073),'copper')
            for cx in [.14,.91]:
                stud('strap rivet',side*cx,-.173,z,.026)
        beam('pitched lintel',(0,0,2.70),(side*1.16,0,2.18),.19,.39,'copper')
        beam('stepped copper crown',(0,0,2.81),(side*1.19,0,2.27),.065,.42,'brass')
    # A stacked Iron City skyline crowns the door, visually separated from the return marker.
    for x,h in [(-.49,.20),(-.26,.38),(0,.62),(.26,.38),(.49,.20)]:
        bottom=2.73-abs(x)*.44
        slab('city tower relief',[(x-.09,bottom-.06),(x+.09,bottom-.06),(x+.09,bottom+h-.08),
             (x+.046,bottom+h-.08),(x,bottom+h),(x-.046,bottom+h-.08),(x-.09,bottom+h-.08)],.04,.18,'basalt')
        box('tower window',(x,-.058,bottom+h*.42),(.033,.015,.077),'amber',.004)
    sign('future content cartouche',['IRON CITY','FUTURE REALM'],0,-.201,1.57,1.13,.35,'paper','ink')


def beacon():
    lathe('foot register',0,0,[(.32,0),(.34,.06),(.31,.12),(.22,.16)],'basalt',12,True)
    lathe('beacon stem',0,0,[(.21,.13),(.19,.23),(.11,.45),(.09,.83),(.16,1.1),(.21,1.15)],'slate',12,True)
    for z,r in [(.25,.195),(.94,.135),(1.16,.255)]:
        lathe('stem trim',0,0,[(r,z),(r,z+.045)],'copper',12,True)
    lathe('louver cup',0,0,[(.15,1.23),(.29,1.27),(.29,1.32),(.23,1.35)],'basalt')
    lathe('fresnel mantle',0,0,[(.15,1.32),(.17,1.4),(.16,1.64),(.12,1.71)],'amber')
    for z,r in [(1.39,.173),(1.47,.175),(1.55,.17),(1.63,.16)]:
        lathe('lens prism band',0,0,[(r,z-.015),(r+.024,z),(r,z+.037)],'paper',24)
    for i in range(4):
        a=i*TAU/4+.6
        pipe('lantern cage',[(.23*math.cos(a),.23*math.sin(a),1.30),(.21*math.cos(a),.21*math.sin(a),1.72)],.017,'copper',8)
    lathe('vented canopy',0,0,[(.31,1.72),(.31,1.75),(.21,1.80),(.08,1.89),(.028,2.01)],'slate',12,True)
    sign('beacon collar',['LINK'],0,-.151,.85,.27,.12)


def terminal():
    for x in [-.48,.48]:
        foot('terminal shoe',x,0,.30,.55)
        slab('raked terminal cheek',[(x-.083,.12),(x+.083,.12),(x+.12,.56),(x+.06,.70),
             (x-.065,.70),(x-.09,.46)],.035,.25,'slate')
    box('console case',(0,.02,.61),(1.34,.76,.17),'copper',.046)
    box('keyboard well',(0,-.14,.710),(.98,.25,.041),'ink')
    for j in range(3):
        for i in range(9):
            box('command key',((i-4)*.088,-.206+j*.072,.746),(.070,.053,.031),'slate' if i<8 else 'brass',.009)
    box('upright instrument bank',(0,.175,.936),(1.34,.24,.57),'basalt',.050)
    for x,name in [(-.32,'LINK'),(.32,'ENDPOINT')]:
        box('individual readout bezel '+name,(x,.044,.98),(.594,.044,.385),'copper')
        box('blank instrument glass '+name,(x,.012,1.022),(.518,.028,.216),'ink')
        for i in range(4):
            box('baseline graduation',(x-.19+i*.124,-.005,.948),(.044,.007,.009),'blue',0)
        sign('instrument legend '+name,[name],x,.004,.858,.468,.080)
    pipe('separate bank divider',[(0,.014,.785),(0,.014,1.15)],.014,'brass',8)
    for x in [-.60,.60]:
        lens('panel screw',x,.034,1.173,.018,.025,'brass',8)


def balcony():
    # Balcony runs along the room depth. Leave the near end clear for entry.
    for x in [-.286,.286]:
        beam('under-deck diagonal',(x,-.60,.08),(x,.38,.32),.073,.07,'copper')
        box('deck stringer',(x,0,.28),(.072,1.75,.10),'basalt')
    for i in range(13):
        y=-.79+i*.132
        box('balcony tread',(0,y,.363),(.72,.12,.06),'slate' if i%4 else 'basalt')
    for x in [-.343,.343]:
        for y in [-.72,-.04,.73]:
            box('rail post foot',(x,y,.408),(.09,.09,.06),'copper')
            pipe('rail post',[(x,y,.39),(x,y,.78)],.021,'slate',8)
        for z,mat in [(.625,'slate'),(.79,'brass')]:
            pipe('side guard',[(x,-.78,z),(x,.81,z)],.018 if z<.7 else .025,mat,10)
    for z in [.625,.79]:
        pipe('far railing',[(-.34,.8,z),(.34,.8,z)],.022,'copper')
    lathe('viewer stand',0,.51,[(.12,.39),(.13,.43),(.055,.48),(.045,.69),(.072,.72)],'basalt',12)
    pipe('lookout scope',[(0,.40,.72),(0,.57,.77),(0,.69,.807)],[.037,.054,.073],'teal',12)
    pipe('lookout eyecup',[(0,.37,.71),(0,.415,.726)],[.057,.044],'ink',12)


def mural():
    for x in [-.62,.62]:
        foot('frame feet',x,0,.27,.33)
        box('frame pilaster',(x,0,.98),(.12,.14,1.76),'basalt')
    slab('mural back', [(-.62,.22),(.62,.22),(.62,1.64),(.49,1.81),(0,1.96),(-.49,1.81),(-.62,1.64)],.02,.10,'slate')
    for x in [-.60,.60]:
        box('gilded side rail',(x,-.075,.94),(.065,.04,1.42),'brass')
    box('picture sill',(0,-.018,.25),(1.42,.23,.127),'copper')
    for side in [-1,1]:
        beam('stepped crown',(side*.658,-.025,1.65),(side*.46,-.025,1.858),.10,.21,'copper')
        beam('pediment',(side*.46,-.025,1.858),(0,-.025,1.995),.10,.21,'copper')
    # Three unselected sockets sit beneath a blank field for the later state-selected artwork.
    box('recessed folio',(0,-.060,1.12),(1.06,.033,.86),'ink')
    for x in [-.485,.485]:
        for z in [.744,1.496]:
            slab('picture corner',[(x-.052,z-.042),(x+.052,z-.042),(x+.052,z+.042)],-.091,.018,'copper')
    for i,x in enumerate([-.34,0,.34]):
        lens('classification mount',x,-.095,.488,.122,.052,'copper',16)
        lens('neutral inset',x,-.131,.488,.094,.031,'basalt',16)
        if i==0:
            rail('complete link',x,.49,.135,'pearl',-.157,.014)
            for dx in [-.07,.07]: lens('complete endpoint',x+dx,-.16,.49,.022,.013,'pearl',8)
        elif i==1:
            pipe('dogleg detour',[(x-.066,-.158,.466),(x-.03,-.158,.526),(x+.04,-.158,.526),(x+.062,-.158,.466)],.015,'paper',8)
        else:
            for dx in [-.05,.05]:box('isolated stubs',(x+dx,-.158,.49),(.045,.013,.027),'paper',.005)
    sign('mural title',['CHAPTER I'],0,-.077,1.684,.79,.136,'paper','ink')


def schedule():
    for x in [-.455,.455]:
        foot('noticeboard',x,0,.21,.31)
        box('easel upright',(x,.018,.77),(.074,.091,1.29),'slate')
    box('schedule case',(0,0,1.01),(1.12,.159,1.01),'copper',.045)
    box('notice lining',(0,-.095,.998),(1.013,.04,.88),'basalt')
    sign('schedule heading',['FOLLOW UP'],0,-.137,1.355,.83,.164)
    for i,(z,word) in enumerate([(1.14,'INSTALL'),(.916,'VALIDATE'),(.694,'RETURN')]):
        box('work ticket pocket',(0,-.133,z),(.93,.045,.191),'slate')
        sign('maintenance ticket '+word,[word],.07,-.171,z,.60,.146,'paper','ink')
        lens('number clip',-.318,-.178,z,.065,.055,'brass',12)
        sign('ticket order',[str(i+1)],-.318,-.22,z,.073,.084,'ink','paper')


def status_totem():
    lathe('totem socket',0,0,[(.29,0),(.34,.055),(.31,.12),(.22,.15)],'basalt',8,True)
    lathe('faceted meter column',0,0,[(.2,.12),(.154,.30),(.15,.56),(.22,.68),(.22,1.18),(.17,1.27)],'slate',8,True)
    for z in [.30,.48,1.25]:
        lathe('column ring',0,0,[(.165 if z<.6 else .2,z),(.178 if z<.6 else .23,z+.035)],'copper',8,True)
    # A split horseshoe and a removable sample strip identify the instrument without pretending to hold a live reading.
    lens('gauge bezel',0,-.184,.98,.258,.085,'copper',24)
    lens('unread gauge',0,-.241,.98,.218,.048,'ink',24)
    for i in range(7):
        a=.12*math.pi+i*math.pi*.76/6
        beam('raised scale',(.14*math.cos(a),-.273,.966+.14*math.sin(a)),(.185*math.cos(a),-.273,.966+.185*math.sin(a)),.011,.011,'paper')
    sign('link gauge',['LINK'],0,-.276,.933,.22,.087)
    box('sample drawer',(0,-.206,.695),(.30,.141,.16),'basalt')
    box('empty sample slot',(0,-.284,.71),(.214,.015,.049),'ink')
    lathe('raised instrument cap',0,0,[(.16,1.286),(.12,1.338),(.07,1.365)],'brass',8,True)
    for x in [-.066,.066]:
        pipe('split link finial',[(x,0,1.35),(x,0,1.48),(x*.45,0,1.51)],.028,'teal',8)


def pedestal():
    lathe('octagonal plinth',0,0,[(.345,0),(.36,.05),(.36,.10),(.28,.15),(.27,.20)],'basalt',8,True)
    lathe('seal column',0,0,[(.25,.2),(.23,.25),(.16,.36),(.16,.63),(.24,.72),(.28,.75)],'slate',8,True)
    for i in range(8):
        a=(i+.5)*TAU/8
        pipe('fluting',[(.156*math.cos(a),.156*math.sin(a),.35),(.156*math.cos(a),.156*math.sin(a),.63)],.012,'copper',8)
    lathe('presentation tray',0,0,[(.27,.73),(.328,.77),(.328,.806),(.272,.84)],'copper',12,True)
    lathe('unmarked impression pad',0,0,[(.212,.838),(.216,.855)],'ink',24)
    # Raised press yoke leaves a real gap between the die and unused page area.
    for x in [-.244,.244]:
        pipe('seal yoke',[(x,.077,.8),(x,.077,1.035),(x*.77,.077,1.11),(0,.077,1.11)],.032,'basalt',10)
    lathe('press spindle',0,.075,[(.024,.984),(.024,1.17),(.045,1.185)],'brass',12)
    lathe('raised seal die',0,.075,[(.080,.951),(.083,.982),(.034,.999)],'copper',12)
    pipe('manual cross handle',[(-.106,.075,1.184),(.106,.075,1.184)],.024,'teal',10)
    sign('seal legend',['SEAL'],0,-.265,.72,.24,.115)


def return_arch():
    # Slim pilasters and an open arch are a wayfinding marker on the path back to the Rift.
    for x in [-.236,.236]:
        foot('arch shoe',x,0,.17,.34)
        box('stile',(x,0,.78),(.080,.15,1.35),'basalt')
        box('stile bead',(x,-.088,.90),(.026,.022,1.13),'copper')
        for z in [.34,1.39]:
            box('impost collar',(x,0,z),(.133,.20,.064),'copper')
    for i in range(9):
        a0=math.pi*i/9+.009;a1=math.pi*(i+1)/9-.009
        contour=[(r*math.cos(a),1.45+1.51*r*math.sin(a)) for r,a in [(.19,a0),(.29,a0),(.29,a1),(.19,a1)]]
        slab('arch voussoir',contour,0,.185,'brass' if i==4 else 'slate')
    box('fingerboard',(0,0,1.995),(.46,.13,.248),'basalt')
    sign('return destination',['RIFT'],.052,-.082,1.99,.27,.103)
    arrow('return direction',-.135,-.092,1.985,-1,'brass',.36)
    for x in [-.113,.113]:
        beam('cap brace',(x,0,1.80),(x,0,1.882),.037,.06,'copper')


def threshold_plaque():
    footplate('marker shoe',1.04,.37,.11)
    slab('civic plaque stone',[(-.53,.10),(.53,.10),(.46,.22),(.46,.79),(.34,.97),
         (.16,.97),(0,1.11),(-.16,.97),(-.34,.97),(-.46,.79),(-.46,.22)],0,.19,'slate')
    slab('tablet surround',[(-.424,.22),(.424,.22),(.424,.76),(.31,.90),(-.31,.90),(-.424,.76)],-.113,.052,'copper')
    slab('tablet face',[(-.386,.26),(.386,.26),(.386,.74),(.284,.856),(-.284,.856),(-.386,.74)],-.148,.028,'basalt')
    # Broken-line crest and an engraved three-step recovery sequence, conditional on shutdown.
    for side in [-1,1]:
        slab('broken link fragment',[(side*.245,.739),(side*.104,.739),
             (side*.090,.758),(side*.060,.758),(side*.079,.791),(side*.118,.783),
             (side*.139,.782),(side*.245,.782)],-.179,.016,'pearl')
    pipe('offset fracture mark',[(-.004,-.182,.803),(-.021,-.182,.775),(.002,-.182,.772),(-.008,-.182,.735)],.007,'clay',6)
    sign('recovery terms',['IF ISOLATED','REPAIR','RETEST'],0,-.180,.515,.68,.335,'paper','ink')
    for x in [-.358,.358]:
        for z in [.29,.72]:
            stud('tablet key',x,-.179,z,.018)

MODELS.update({111:gate,112:beacon,113:terminal,114:balcony,115:mural,116:schedule,117:status_totem,118:pedestal,119:return_arch,120:threshold_plaque})
