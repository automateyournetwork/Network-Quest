# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Market furniture, sectioned physical exhibits and fictional route-kit hardware."""
from parts import *


def display_case():
    # A glass-backed jeweller's case with its front lifted for inspection.
    footplate('Display plinth',2.1,.80,.19)
    box('Blue velvet tray deck',(0,0,.29),(2.00,.72,.20),'slate',.07)
    for i,(x,label) in enumerate([(-.665,'KIT A'),(0,'KIT B'),(.665,'MISMATCH')]):
        box('Fitted tray '+label,(x,-.04,.415),(.59,.50,.08),'copper')
        box('Velvet insert',(x,-.04,.463),(.53,.45,.035),'ink')
        sign('Tray ticket '+label,[label],x,-.377,.27,.55,.14)
        if i<2:
            # Exchangeable equipment and two / three endpoint demand chips.
            box('Module body',(x-.11,-.015,.54),(.16,.27,.11),'pearl')
            box('Module receptacle',(x-.11,-.16,.54),(.11,.02,.055),'ink')
            pipe('Extraction bail',[(x-.18,-.15,.53),(x-.18,-.21,.56),(x-.04,-.21,.56),(x-.04,-.15,.53)],.013,'brass')
            for j in range(i+2):
                box('Separate endpoint chip',(x+.12,-.17+j*.13,.512),(.135,.086,.058),'teal')
        else:
            slab('Unmatched outer shell',[(x-.18,.48),(x+.18,.48),(x+.18,.62),(x+.04,.74),(x-.18,.65)],-.02,.26,'plum')
            lens('Different keyed cavity',x,-.16,.575,.066,.018,'ink',6)
    # Cast shell fan decorates the center of the rear frame above the open trays.
    cx,cy,cz=0,.295,.75
    for i in range(9):
        a=math.radians(22+i*17)
        leaf('Cast shell fluting',(cx,cy,cz),(.28*math.cos(a),cy,cz+.20*math.sin(a)),(.029*math.sin(a),0,-.029*math.cos(a)),'brass')
    rail('Display rear crosspiece',0,.751,1.96,'copper',cy,.017)
    for x in [-.99,.99]:
        pipe('Side pillar',[(x,.30,.35),(x,.30,1.01),(x,-.23,1.17)],.033,'brass',10)
    rail('Hinged front trim',0,1.17,2.01,'brass',-.23,.025)
    rail('Rear glazing hinge',0,1.01,2.01,'copper',.30,.033)
    cover=box('Lifted display glazing',(0,.035,1.09),(1.96,.55,.024),'glass',.005)
    cover.rotation_euler.x=-.29
    clear=materials['glass'].copy();clear.name='Lifted glass'
    clear.node_tree.nodes['Principled BSDF'].inputs['Alpha'].default_value=.21
    clear.diffuse_color=(*clear.diffuse_color[:3],.21);clear.surface_render_method='BLENDED'
    cover.data.materials[0]=clear


def sfp_cage():
    # Narrow, open cage on the end of a host board. A viewer can see through to the card-edge connector.
    boltfeet('Host board standoff',.74,.53)
    box('Host board',(0,0,.105),(.98,.68,.075),'teal')
    box('Cage floor',(-.17,-.025,.23),(.37,.51,.07),'slate')
    for x in [-.35,.01]:
        box('Stamped guide cheek',(x,-.025,.34),(.028,.51,.24),'pearl')
        for y in [-.17,-.03,.11]:
            pipe('Folded spring finger',[(x,y,.395),(x-.023,y+.03,.462),(x,y+.076,.442)],.012,'brass',6)
    box('Folded upper sheet',(-.17,.046,.461),(.39,.345,.032),'slate')
    box('Rear host contact block',(-.17,.025,.287),(.31,.045,.083),'ink')
    for i in range(9):
        box('Exposed edge contact',(-.30+i*.033,-.003,.291),(.013,.042,.055),'brass',0)
    for i in range(4):
        box('Cage ventilation slot',(-.308+i*.079,.05,.48),(.030,.17,.005),'ink',0)
    for i in range(3):
        y=-.15+i*.085
        pipe('Etched board run',[(.06,y,.148),(.13,y,.148),(.18,y+.047,.148),(.27,y+.047,.148)],.008,'brass',6)
        box('Rounded pad',(.28,y+.047,.150),(.035,.029,.007),'brass',.003)
    pipe('Raised ticket holder',[(.31,.17,.14),(.31,.17,.67)],.024,'copper')
    sign('Separate host profile',['HOST','PROFILE'],.30,.143,.58,.30,.215)
    sign('Mechanical gauge',['SFP','FIT ONLY'],-.17,-.355,.17,.47,.13,'ink','pearl')


def qsfp_cage():
    # Broad bench sleeve contains a different sled, four relief marks and a deep rear connector.
    slab('Polygonal foot',[(-.65,0),(.65,0),(.56,.21),(.39,.29),(-.40,.29),(-.55,.20)],0,.57,'basalt')
    box('Gauge bed',(0,-.005,.31),(1.13,.64,.09),'copper')
    for x in [-.465,.465]:
        box('Wide flanged guide',(x,0,.51),(.066,.55,.34),'slate')
        box('Side mounting ear',(x*1.13,.02,.408),(.12,.24,.065),'brass')
    box('Upper shroud',(0,-.005,.69),(1,.57,.064),'pearl')
    box('Channel floor',(0,0,.372),(.90,.55,.048),'slate')
    box('Shielded connector bar',(0,.22,.49),(.78,.063,.14),'ink')
    for x in [-.31,-.23,-.15,-.07,.01,.09,.17,.25,.33]:
        box('Rear edge finger',(x,.18,.49),(.035,.02,.062),'brass',0)
    for x in [-.48,.48]:
        pipe('Wall spring return',[(x,-.19,.41),(x*1.045,-.16,.49),(x*1.045,.08,.49),(x,.13,.41)],.025,'copper',8)
    for i in range(4):
        x=-.30+i*.20
        pipe('Diagram trace only',[(x,-.23,.731),(x,-.07,.731),(x*.73,.02,.731),(x*.73,.21,.731)],.013,'teal')
    sign('Advisory',['QSFP','CHECK HOST'],0,-.326,.184,.78,.20)


def injector():
    box('Isolated lower chassis',(0,0,.25),(1.06,.71,.5),'teal',.09)
    box('Cast lid',(0,0,.515),(1.1,.73,.09),'slate',.04)
    for i in range(7):
        box('Cooling fin',(-.43+i*.144,.08,.60),(.047,.37,.11),'copper')
    for x,label in [(-.26,'DATA IN'),(.26,'DATA + PWR')]:
        jack(label,x,-.361,.28,.34)
        sign('Port label '+label,[label],x,-.364,.115,.46,.077)
    # Isolated supply with strain relief going to the back, not a fiber path.
    pipe('Supply flex',[(.52,.16,.31),(.65,.16,.30),(.66,.27,.13),(.54,.37,.085),(.39,.37,.09)],.032,'ink')
    lens('Power-only round lamp',-.42,-.408,.442,.040,.033,'amber',16)
    sign('Power lamp identity',['PWR'],-.28,-.412,.442,.17,.07,'ink','pearl')
    for x in [-.41,.41]:
        pipe('Label pole',[(x,.21,.55),(x,.21,.88)],.021,'brass')
    sign('Fictional accounting boundary',['TOY SUPPLY 30 W','DELIVERED TO ENDPOINTS','AFTER LOSSES'],0,.185,.86,.99,.31)


def endpoint():
    footplate('Endpoint base',1.21,.60,.14)
    # A small powered camera with a lens barrel on a horizontal gimbal.
    lathe('Swivel foot',-.20,.04,[(.18,.14),(.15,.20),(.06,.22),(.065,.39)],'copper',16)
    for x in [-.42,.02]:
        box('Camera cheek',(x,.05,.45),(.07,.17,.22),'teal')
        lens('Gimbal cap',x,.0,.52,.052,.06,'brass',10)
    box('Endpoint enclosure',(-.20,.04,.60),(.40,.37,.29),'slate',.065)
    lens('Lens barrel',-.20,-.173,.62,.129,.13,'ink',24)
    lens('Recessed objective',-.20,-.244,.62,.089,.022,'glass',24)
    box('Indicator tower',(.322,.08,.445),(.36,.25,.59),'teal',.048)
    lens('Power lamp',.223,-.067,.59,.039,.045,'amber')
    box('Separate dark link window',(.223,-.067,.406),(.071,.025,.049),'ink',.013)
    sign('Power inscription',['PWR'],.375,-.061,.594,.17,.074)
    sign('Data inspection inscription',['LINK'],.368,-.061,.404,.19,.075)
    for i,(x,s) in enumerate([(-.448,'12 W'),(-.156,'11 W'),(.136,'10 W'),(.448,'7 W')]):
        box('Detachable demand card seat',(x,-.22,.164),(.26,.13,.074),'basalt')
        sign('Demand card '+s,[s],x,-.281,.263,.25,.137,'paper' if i<3 else 'glass')


def coax():
    # Longitudinally staggered jacket, braided shield, insulator and core sample.
    box('Exhibit sled',(0,.02,.09),(1.37,.52,.16),'slate',.065)
    for x in [-.50,-.13]:
        box('Sample cradle',(x,.03,.246),(.09,.28,.22),'copper')
    z=.54
    def rod(name,x1,x2,r,mat):
        return pipe(name,[(x1,0,z),(x2,0,z)],r,mat,32)
    rod('Black polymer jacket',-.65,-.24,.225,'ink')
    rod('Outer conductor',-.25,.13,.19,'slate')
    for i in range(12):
        for handed in (-1,1):
            points=[]
            for j in range(10):
                t=j/9
                a=TAU*(i/12+handed*t*.135)
                points.append((-.24+.37*t,.192*math.cos(a),z+.192*math.sin(a)))
            pipe('Crossed shield strand',points,.009,'copper',5)
    rod('Dielectric sleeve',.125,.447,.137,'paper')
    rod('Center conductor',.443,.67,.048,'copper')
    sign('Media specimen card',['COAX / SECTION'],0,-.253,.11,.85,.116)


def telephone():
    # Unplugged customer test jack alongside the line-side binding posts.
    box('Weatherproof back',(-.16,.025,.59),(.70,.29,1.10),'teal',.065)
    box('Terminal recess',(-.16,-.135,.61),(.61,.045,.91),'ink')
    sign('Line side label',['LINE'], -.29,-.166,.943,.32,.087)
    for x,mat in [(-.37,'clay'),(-.18,'glass')]:
        lens('Threaded binding nut',x,-.178,.78,.069,.089,'brass',6)
        pipe('Pair wire',[(x,-.231,.78),(x-.04,-.239,.68),(x,-.235,.54),(x+.09,-.22,.47)],.015,mat)
    jack('Unoccupied test jack',-.21,-.20,.35,.22)
    pipe('Disconnected pair tail',[(-.14,-.17,.47),(.008,-.226,.51),(.04,-.247,.42),(.016,-.262,.325)],.018,'paper')
    box('Free plug',(.016,-.265,.295),(.065,.055,.068),'glass')
    # Door is partly open to the right with a rolled hinge and embossed identity.
    for z in [.29,.57,.85]:
        lathe('Hinge barrel',.21,-.115,[(.034,z-.083),(.033,z+.083)],'brass',12)
    box('Open cover return',(.43,-.108,.62),(.42,.063,1.01),'slate',.055)
    sign('Exhibit identity',['TEL PAIR','UNPLUGGED'],.429,-.145,.70,.38,.185)
    for x in [-.34,-.04]:
        lathe('Bottom gland',x,.02,[(.07,0),(.079,.045),(.063,.11)],'basalt',8,True)


def chart():
    for x in [-.45,.45]:
        lathe('Poster stand foot',x,0,[(.144,0),(.15,.046),(.055,.080)],'basalt',10,True)
        pipe('Scroll spindle upright',[(x,.04,.05),(x,.04,1.49)],.042,'copper')
    slab('Checklist parchment',[(-.44,.24),(-.41,.185),(.43,.216),(.43,1.46),(-.43,1.46)],0,.04,'paper')
    for h in [.25,1.46]:
        rail('Scroll roller',0,h,1.05,'brass',0,.046)
    sign('Checklist header',['MATCH EACH ROW'],0,-.038,1.35,.79,.113,'teal','pearl')
    for j,label in enumerate(['FORM','PHY','MEDIUM','RATE','HOST','POWER METHOD','EACH PORT']):
        z=1.19-j*.13
        box('Blank check recess',(-.31,-.027,z),(.071,.018,.070),'slate',.01)
        box('Blank check center',(-.31,-.04,z),(.043,.014,.042),'paper',0)
        sign('Compatibility row '+label,[label],.063,-.034,z,.58,.086)
    # An unfilled check recess is present for every independent field.


def ledger():
    footplate('Insulated lectern shoe',.77,.56,.105)
    lathe('Fluted insulated pedestal',0,0,[(.23,.11),(.15,.2),(.115,.47),(.185,.58)],'teal',12,True)
    # An open accordion ledger separates the historically proposed total from both examples.
    slab('Spread book backing',[(-.54,.49),(-.49,.91),(-.21,.96),(0,.89),(.21,.96),(.50,.91),(.54,.49),(0,.445)],0,.13,'plum')
    slab('Proposed demand leaf',[(-.5,.52),(-.465,.885),(-.22,.924),(-.025,.87),(-.025,.495)],-.074,.02,'paper')
    slab('Replacement demand leaf',[(.025,.495),(.025,.87),(.22,.924),(.465,.885),(.5,.52)],-.074,.02,'paper')
    sign('Original proposal',['PROPOSED','33 W'], -.246,-.099,.73,.395,.19)
    sign('Example totals',['KIT A 23 W','KIT B 30 W'],.246,-.098,.73,.396,.19)
    rail('Pen holder',.26,.555,.36,'brass',-.11,.023)
    pipe('Fresh reading stylus',[(.14,-.14,.54),(.42,-.14,.604)],[.009,.019],'ink')
    sign('Ledger legend',['EXAMPLES / RETEST'],0,-.15,.467,.73,.086,'teal','pearl')


def counter():
    slab('Scalloped counter apron',[(-1.18,.13),(-1.12,.6),(1.12,.6),(1.18,.13),(.90,.13),(.82,.24),(-.82,.24),(-.9,.13)],0,.70,'teal')
    for x in [-1.0,-.55,.0,.55,1.0]:
        box('Apron pilaster',(x,-.359,.402),(.043,.035,.315),'copper')
    box('Broad loan bench',(0,0,.62),(2.48,.88,.14),'copper',.06)
    box('Desk writing mat',(-.15,-.04,.701),(1.29,.5,.029),'slate',.045)
    for x,label in [(-.46,'KIT A'),(.034,'KIT B')]:
        box('Card stock cubby',(x,.02,.756),(.37,.28,.095),'brass')
        sign('Loan kit ticket',[label],x,-.123,.807,.34,.12)
    lathe('Counter bell body',.87,-.043,[(.15,.69),(.15,.719),(.13,.77),(.079,.812),(.038,.824)],'brass')
    lathe('Bell plunger',.87,-.043,[(.019,.816),(.016,.85),(.038,.855),(.038,.873)],'slate',12)
    box('Returned kit drawer',(.87,-.37,.475),(.43,.055,.18),'slate')
    for x in [.79,.94]:
        pipe('Drawer bail lug',[(x,-.407,.48),(x,-.451,.48)],.018,'brass',8)
    rail('Drawer bail',.865,.48,.16,'brass',-.451,.018)
    sign('Return notice',['< WORKSHOP'], -.65,-.373,.42,.78,.15)
    sign('Loan notice',['LOANS','REUSE KIT'],.31,-.377,.42,.75,.23,'ink','paper')


MODELS={81:display_case,82:sfp_cage,83:qsfp_cage,84:injector,85:endpoint,
        86:coax,87:telephone,88:chart,89:ledger,90:counter}
