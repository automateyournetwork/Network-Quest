# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""The Echo Cavern's ten instruments, exhibits and mail-reading apparatus."""
from workshop import *

def repeater_station():
    # Split bay console with left/right segment sockets and a distinct kit dock below.
    for x in [-.54,.54]:
        profile_xz('Splayed console trestle',[(x-.12,.02),(x+.13,.02),(x+.074,.51),(x-.058,.51)],0,.55,'patina')
        box('Trestle sole',(x,0,.04),(.29,.64,.08),'iron')
    base=[(-.70,.45),(.70,.45),(.77,.54),(.72,.86),(.58,1.00),(-.58,1.00),(-.72,.86),(-.77,.54)]
    profile_xz('Cast message console',base,0,.51,'teal')
    for x,tag in [(-.45,'IN'),(.45,'OUT')]:
        turned('Insulated cable port',(x,-.263,.77),(0,1,0),[(-.045,.083),(-.025,.118),(.015,.124)],'brass')
        rod('Deep keyed port',(x,-.32,.77),(x,-.31,.77),.069,'rubber')
        card('Segment legend',x,-.27,.57,tag,.27,.13)
    box('Service jack strip',(0,-.275,.72),(.47,.034,.28),'slate')
    for x in [-.095,.095]:
        turned('Inspection jack',(x,-.30,.76),(0,1,0),[(-.022,.032),(-.012,.047),(.012,.046)],'linen',12)
        rod('Jack recess',(x,-.331,.76),(x,-.317,.76),.018,'iron',10)
    lettering('Kit socket marking','TEST',(0,-.296,.63),.063,'linen')
    for x in [-.33,.33]:
        box('Vent bank',(x,0,1.012),(.41,.29,.05),'iron')
        for i in range(4):box('Cooler fin',(x-.135+i*.09,0,1.07),(.031,.24,.10),'copper')
    tube('Service guard',[(-.59,-.19,1.03),(-.59,-.19,1.13),(-.51,-.19,1.16),(.51,-.19,1.16),(.59,-.19,1.13),(.59,-.19,1.03)],.025,'brass')

def echo_reflector():
    turned('Weighted acoustic foot',(0,0,.11),(0,0,1),[(-.11,.25),(-.08,.29),(-.03,.28),(.025,.19),(.1,.11)],'slate')
    turned('Turning column',(0,0,.44),(0,0,1),[(-.23,.097),(-.16,.082),(.17,.061),(.23,.085)],'teal')
    tube('Dish pivot yoke',[(-.27,.19,.94),(-.26,.18,.72),(-.15,.07,.61),(.16,.07,.61),(.26,.18,.72),(.27,.19,.94)],.039,'copper')
    d=Vector((-.17,-1,.21)).normalized();u,v=axis_frame(d)[1:];center=Vector((0,-.015,.96))
    # Revolve a shallow concave inner wall and its rear shell without a cap across the mouth.
    prof=[(-.15,.010),(-.134,.095),(-.09,.19),(-.014,.28),(.088,.36),(.112,.38),(.096,.389),(.068,.377),(-.032,.30),(-.112,.20),(-.155,.10),(-.164,.010)]
    turned('Concave acoustic bell',center,d,prof,'brass',40)
    hoop('Rolled bell lip',center+d*.106,d,.382,.019,'copper',40)
    turned('Rear bell mounting pad',center-d*.170,d,[(-.049,.07),(-.027,.115),(.022,.107)],'copper',24)
    for x in [-.27,.27]:
        rod('Rear trunnion block',(x,.183,.94),(x*.38,.194,.924),.035,'teal',12)
        rod('Pivot bolt',(x-.024,.19,.94),(x+.024,.19,.94),.044,'copper',12)
    card('Analogy inscription',0,-.125,.37,'ANALOGY',.38,.13)

def serial_telegraph():
    # The key is the lever and gap; the two solenoids drive a separate historical sounder.
    feet([-.39,.39],depth=.60)
    box('Lacquered telegraph board',(0,0,.15),(1.08,.64,.14),'oak',.043)
    box('Brass board lip',(0,0,.226),(1.02,.59,.035),'copper')
    for x in [-.30,-.11]:
        turned('Sounder winding shoe',(x,.12,.36),(0,0,1),[(-.11,.075),(-.09,.087),(-.067,.07),(.065,.07),(.079,.087),(.10,.078)],'iron',16)
        for j in range(4):hoop('Sounder winding',(x,.12,.317+j*.023),(0,0,1),.070,.010,'copper',16,6)
    tube('Sounder bridge',[(-.42,.12,.26),(-.42,.12,.48),(-.36,.12,.52),(-.02,.12,.52),(.008,.12,.48)],.026,'brass')
    rod('Sounder armature',(-.35,.12,.475),(-.057,.12,.475),.025,'slate',8)
    for y in [-.135,.05]:
        profile_xz('Key fulcrum cheek',[(.05,.25),(.20,.25),(.16,.42),(.11,.43)],y,.036,'teal')
    rod('Key pivot shaft',(.137,-.163,.395),(.137,.08,.395),.032,'brass')
    tube('Rocking key lever',[(.013,-.046,.36),(.14,-.046,.4),(.34,-.046,.43),(.40,-.046,.44)],.026,'copper')
    turned('Finger key',(.39,-.05,.47),(0,0,1),[(-.039,.060),(-.018,.105),(.016,.10),(.027,.078)],'rubber',20)
    for x in [.02,.34]:
        turned('Fixed key contact',(x,-.046,.282),(0,0,1),[(-.04,.04),(.023,.035),(.045,.022)],'brass',12)
    card('Serial post index',-.17,-.341,.16,'POST',.38,.102)
    for x in [-.43,.43]:rod('Cable binding terminal',(x,.23,.24),(x,.23,.34),.034,'linen',12)

def connector_display():
    feet([-.29,.29],depth=.42)
    for x in [-.29,.29]:box('Exhibit support',(x,.04,.64),(.075,.115,1.15),'patina')
    profile_xz('Connector board',[(-.42,.49),(.42,.49),(.45,.54),(.45,1.19),(.36,1.29),(-.36,1.29),(-.45,1.19),(-.45,.54)],0,.11,'oak')
    # Nine pins in staggered rows, in a trapezoidal D-sub shell with side screw bosses.
    profile_xz('D shell flange',[(-.317,.91),(.317,.91),(.34,1.08),(-.34,1.08)],-.08,.045,'brass')
    profile_xz('Trapezoidal connector shroud',[(-.191,.921),(.191,.921),(.23,1.065),(-.23,1.065)],-.118,.055,'slate')
    profile_xz('Pin insert',[(-.166,.936),(.166,.936),(.201,1.049),(-.201,1.049)],-.150,.020,'iron')
    for z,n in [(.970,4),(1.018,5)]:
        for j in range(n):
            x=(j-(n-1)/2)*.064
            rod('Display contact pin',(x,-.159,z),(x,-.186,z),.010,'brass',8)
    for x in [-.276,.276]:bolt('D shell locking stud',x,-.111,1.0,.030)
    card('Return direction plate',0,-.075,.78,'< WARRENS',.70,.14)
    card('Onward direction plate',0,-.075,.595,'RIFT >',.70,.14)

def signal_gong():
    # Two hanging slings leave air between the rolled disc and the gate.
    feet([-.44,.44],depth=.48)
    for x in [-.44,.44]:
        turned('Gong gantry pillar',(x,.03,.75),(0,0,1),[(-.68,.064),(-.62,.085),(-.58,.059),(.49,.048),(.54,.077),(.59,.061),(.68,.058)],'patina',12)
    tube('Arched suspension beam',[(-.46,.03,1.36),(-.46,.03,1.46),(-.36,.03,1.53),(-.13,.03,1.57),(0,.03,1.60),(.13,.03,1.57),(.36,.03,1.53),(.46,.03,1.46),(.46,.03,1.36)],.040,'copper')
    for x in [-.21,.21]:
        tube('Leather gong sling',[(x,.03,1.54),(x*.93,0,1.40),(x*.71,-.02,1.23)],.012,'rubber')
    d=(0,-1,0);c=(0,-.02,.906)
    turned('Hammered sounding disc',c,d,[(-.045,.015),(-.033,.16),(-.02,.29),(.016,.36),(.045,.347),(.012,.28),(.002,.178),(.024,.102),(.065,.064),(.072,.02)],'brass',40)
    hoop('Struck centre ring',(0,-.052,.906),d,.098,.010,'copper',32)
    rod('Tethered gong mallet',(.36,-.14,.21),(.34,-.14,.72),.023,'oak',12)
    turned('Felt mallet head',(.34,-.14,.72),(0,0,1),[(-.06,.044),(-.028,.073),(.028,.073),(.062,.042)],'clay',16)
    card('Gong notice',0,-.060,.31,'OPTIONAL',.59,.14)
    rod('Notice tie rod',(-.44,.033,.31),(.44,.033,.31),.015,'copper',8)

def historical_case():
    for x in [-.56,.56]:
        box('Case foot',(x,0,.05),(.16,.44,.10),'iron')
        box('Case leg',(x,0,.27),(.094,.14,.40),'oak')
    box('Cabinet deck',(0,0,.48),(1.38,.51,.11),'oak',.030)
    box('Lined rear wall',(0,.17,.82),(1.32,.08,.64),'patina')
    for x in [-.64,.64]:box('Case stile',(x,-.018,.83),(.056,.40,.69),'copper')
    box('Case cornice',(0,0,1.19),(1.40,.53,.074),'oak',.025)
    # Open-front museum cabinet with one transverse coax sample and a separate hub relic.
    rod('Old coax outer jacket',(-.55,-.10,.72),(-.25,-.10,.72),.079,'rubber')
    rod('Coax exposed screen',(-.25,-.10,.72),(-.14,-.10,.72),.062,'copper')
    rod('Coax inner insulation',(-.14,-.10,.72),(-.055,-.10,.72),.044,'linen')
    rod('Coax center wire',(-.055,-.10,.72),(.010,-.10,.72),.018,'brass')
    for x in [-.46,-.20]:rod('Specimen mount',(x,-.10,.54),(x,-.10,.69),.022,'brass')
    box('Wired hub relic',(.34,-.012,.76),(.43,.22,.18),'slate')
    for j in range(4):box('Relic socket',(.197+j*.087,-.129,.76),(.061,.02,.065),'rubber',.003)
    for x in [.20,.48]:rod('Relic shelf stand',(x,.001,.54),(x,.001,.68),.022,'copper')
    card('Wired repeating exhibit',0,-.264,.47,'WIRED REPEATER',.93,.13)
    for x in [-.42,.42]:bolt('Case back rivet',x,.12,1.047,.022)

def regenerator_core():
    # Serviceable clock module in an open protective cage with two wired feedthroughs.
    turned('Socketed foot',(0,0,.16),(0,0,1),[(-.16,.23),(-.12,.26),(-.08,.25),(-.04,.18),(.12,.18)],'iron',12)
    box('Feedthrough deck',(0,0,.36),(.81,.47,.17),'patina',.035)
    for x,mark in [(-.29,'IN'),(.29,'OUT')]:
        rod('Cable gland',(x,-.235,.37),(x,-.276,.37),.066,'brass',12)
        rod('Insulated gland throat',(x,-.268,.37),(x,-.290,.37),.038,'rubber',12)
        card('Feedthrough index',x,-.244,.49,mark,.17,.087)
    for x in [-.27,.27]:
        tube('Open core guard',[(x,0,.45),(x,0,1.06),(x*.73,0,1.26),(x*.50,0,1.30)],.030,'copper')
    turned('Timing capsule',(0,0,.84),(0,0,1),[(-.37,.095),(-.32,.145),(-.26,.127),(.24,.127),(.29,.145),(.33,.096)],'pearl')
    for i in range(5):hoop('Clock core lamination',(0,0,.63+i*.095),(0,0,1),.132,.015,'teal',24)
    turned('Timing reference cap',(0,0,1.24),(0,0,1),[(-.075,.087),(-.020,.114),(.005,.108),(.033,.056),(.074,.044)],'brass')
    card('Retiming lesson plate',0,-.245,.27,'RETIME',.39,.10)

def broken_span():
    for x in [-.39,.39]:
        box('Isolated case shoe',(x,0,.045),(.19,.50,.09),'slate')
        box('Isolator carriage',(x,0,.28),(.11,.18,.39),'patina')
        turned('Porcelain standoff',(x,0,.52),(0,0,1),[(-.116,.064),(-.080,.083),(-.052,.055),(-.011,.080),(.015,.053),(.059,.077),(.102,.065)],'linen',16)
    box('Archival record shelf',(0,-.035,.19),(.91,.34,.085),'oak')
    for side in [-1,1]:
        path=[(side*.46,.015,.65),(side*.34,.008,.655),(side*.245,0,.64),(side*.155,-.012,.595)]
        tube('Isolated severed cable',path,.054,'teal')
        for k in range(3):
            tube('Exposed broken wire',[(side*.16,-.012+k*.012,.596),(side*(.127-k*.004),-.01+k*.014,.57+.008*k),
                                        (side*(.105-k*.009),-.031+k*.013,.536+.017*k)],.009,'copper',6)
    card('Retained earlier test pocket',0,-.225,.22,'BEFORE',.50,.15)
    for x in [-.32,.32]:bolt('Record clip',x,-.21,.24)

def amplitude_ladder():
    feet([-.32,.32],depth=.44)
    for x in [-.35,.35]:
        turned('Comparison ladder rail',(x,0,.62),(0,0,1),[(-.54,.039),(.43,.039),(.49,.052),(.54,.038)],'copper',12)
    for z in [.23,.56,.89]:rod('Ladder cross rung',(-.35,0,z),(.35,0,z),.024,'brass')
    for z in [.47,.89]:
        box('Qualitative trace slate',(0,-.006,z),(.68,.061,.33),'iron')
    # Deliberately qualitative traces. No units or numerical ticks pretend to score actual readings.
    points=[(-.25,.022),(-.19,.028),(-.135,.085),(-.076,.052),(-.028,-.044),(.032,-.056),(.072,.028),(.12,.081),(.16,.064),(.23,-.028),(.26,.002)]
    tube('Received illustrative trace',[(x,-.045,.89+y) for x,y in points],.010,'brass')
    points=[(-.25,-.05),(-.18,-.05),(-.18,.067),(-.066,.067),(-.066,-.05),(.053,-.05),(.053,.067),(.171,.067),(.171,-.05),(.26,-.05)]
    tube('Retimed illustrative trace',[(x,-.045,.47+y) for x,y in points],.010,'pearl')
    card('Incoming trace key',0,-.056,.756,'INPUT',.31,.080)
    card('Outgoing trace key',0,-.056,.332,'OUTPUT',.35,.080)

def antique_printer():
    for x in [-.47,.47]:box('Printer foot',(x,0,.052),(.20,.55,.105),'iron')
    case=[(-.63,.09),(.63,.09),(.63,.38),(.52,.54),(-.51,.54),(-.63,.39)]
    profile_xz('Iron printer chest',case,0,.49,'patina')
    for x in [-.47,.47]:
        profile_xz('Platen cheek',[(x-.07,.49),(x+.07,.49),(x+.08,.82),(x+.04,.89),(x-.04,.89),(x-.08,.82)],.01,.15,'copper')
    rod('Rubber platen',(-.50,.014,.78),(.50,.014,.78),.089,'rubber',24)
    for x in [-.55,.55]:turned('Paper advance wheel',(x,.015,.78),(1,0,0),[(-.036,.107),(-.015,.122),(.028,.118)],'brass',14,False)
    # A continuous profiled sheet bends over the platen and down through the printer outlet.
    path=[(.135,.945),(.090,.897),(.032,.878)]+[(.014-.097*sin(t*pi/12),.78+.097*cos(t*pi/12)) for t in range(7)]+[(-.088,.69),(-.11,.59),(-.204,.53),(-.242,.495)]
    vv=[(x,y,z) for y,z in path for x in [-.285,.285]]
    mesh('Curved paper web',vv,[(2*i+1,2*i,2*i+2,2*i+3) for i in range(len(path)-1)],'linen')
    rod('Print head rail',(-.43,-.152,.637),(.43,-.152,.637),.019,'brass')
    box('Traveling print head',(.12,-.146,.635),(.14,.095,.115),'slate',.014)
    for i in range(3):box('Ink line',(-.06,-.097-i*.005,.723-i*.029),(.29-i*.062,.009,.008),'slate',.001)
    for i in range(3):box('Front vent',(-.44+i*.085,-.251,.24),(.043,.013,.12),'iron',.004)
    card('Comparison hint slate',.18,-.257,.26,'HINTS',.52,.18)

designs=[repeater_station,echo_reflector,serial_telegraph,connector_display,signal_gong,historical_case,regenerator_core,broken_span,amplitude_ladder,antique_printer]
