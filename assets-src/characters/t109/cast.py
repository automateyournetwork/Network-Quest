# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Eight bespoke Network Quest maquettes, including a single intertwined CH24."""
from sculpt import *


def bat(root):
    """Echo Bat folds velvet ray membranes beneath oversized dished reception ears."""
    chest=group('breathing chest',(0,0,.48),root)
    oval('velvet keel',chest,(0,0,-.02),(.255,.22,.37),'charcoal')
    oval('warm bib',chest,(0,-.126,.04),(.20,.13,.24),'walnut')
    head=group('listening mask',(0,-.025,.25),chest)
    oval('cheeks',head,(0,0,0),(.315,.22,.23),'charcoal')
    for s in [-1,1]:
        ear=group('dish pinna '+str(s),(.21*s,-.012,.13),head)
        ear.rotation_euler.y=.35*s
        # Hollow inner dish recessed inside a turned rim; the eyes sit clear of both.
        oval('velvet ear lobe',ear,(0,0,.16),(.147,.085,.245),'charcoal')
        oval('ear interior',ear,(0,-.064,.16),(.112,.036,.19),'plum')
        ring('copper auricle rim',ear,(0,-.070,.16),.122,.205,.013,'copper')
        tube('inner ear fold',ear,[(0,-.098,.04),(-.035*s,-.102,.11),(.018*s,-.096,.245)],[.013,.019,.005],'rust')
        eye('keen eye '+str(s),head,(s*.125,-.171,.026),.088,-.12*s)
        tube('listening brow',head,[(s*.055,-.205,.123),(s*.128,-.204,.139),(s*.206,-.144,.108)],[.019,.024,.009],'slate')
        tube('cheek whisker',head,[(s*.185,-.106,-.08),(s*.288,-.054,-.12),(s*.34,0,-.08)],[.036,.030,.002],'slate')
        for i in range(2):
            tube('perching claw',chest,[(s*(.085+i*.035),-.02,-.29),(s*(.10+i*.045),-.054,-.35),(s*(.12+i*.036),-.11,-.33)],[.027,.019,.003],'copper')
    oval('short snout',head,(0,-.209,-.057),(.116,.081,.076),'walnut')
    oval('nose leaf',head,(0,-.275,-.025),(.055,.034,.041),'coal')
    tube('smile',head,[(-.068,-.266,-.078),(0,-.281,-.099),(.071,-.259,-.066)],[.007,.008,.004],'coal')
    wings=[]
    for s in (-1,1):
        wing=group('wing hinge '+str(s),(.18*s,.04,.13),chest)
        wings.append(wing)
        # Polygon uses the thumb, two offset trailing scallops, and hooked outer point.
        outline=[(0,0),(.20,.15),(.38,.30),(.62,.28),(.82,.17),(.95,.10),(.86,.08),(.74,-.014),(.67,-.115),(.59,-.072),(.51,-.070),(.44,-.14),(.38,-.235),(.32,-.193),(.25,-.19),(.17,-.254),(.13,-.32),(.065,-.22)]
        plate('scalloped wing membrane',wing,[(s*x,z) for x,z in outline],.065,.050,'charcoal',.012)
        for j,(endx,endz) in enumerate([(.95,.1),(.67,-.115),(.38,-.235),(.13,-.32)]):
            tube('wing finger '+str(j),wing,[(0,0,0),(s*.36,-.003,.275),(s*(.36+endx)/2,-.004,(.275+endz)/2+.025),(s*endx,.024,endz)],[.047,.027,.017,.005],'slate' if j else 'copper')
        tube('cool hem welt',wing,[(s*.947,.032,.103),(s*.813,.032,.052),(s*.738,.032,-.014),(s*.672,.032,-.114)],[.007,.009,.009,.006],'blue',8,3)
        tube('thumb hook',wing,[(s*.32,0,.26),(s*.36,-.025,.326),(s*.396,-.031,.313)],[.023,.019,.003],'brass')
    tube('pendant lanyard',chest,[(-.145,-.133,.15),(0,-.24,-.095),(.145,-.133,.15)],[.018]*3,'copper')
    tag=group('pendant',(0,-.232,-.087),chest)
    ring('repeater pendant bezel',tag,(0,0,-.065),.072,.09,.017,'brass')
    oval('amber pendant',tag,(0,0,-.065),(.064,.026,.080),'amber')
    for i in (-1,0,1):
        block('pendant fluting',tag,(i*.023,-.026,-.065),(.008,.007,.053-.01*abs(i)),'copper',.002)
    animate('idle',4,[(head,'rotation_euler',2,[0,.045,0,-.045,0]),(chest,'location',2,[0,.018,.024,.015,0])])
    animate('reaction',1,[(head,'rotation_euler',1,[0,-.22,-.13,.035,0])]+[(w,'rotation_euler',1,[0,-s*.28,-s*.16,.025*s,0]) for s,w in zip((-1,1),wings)])
    animate('ability',2,[(head,'rotation_euler',0,[0,-.12,.07,.04,0]),(tag,'rotation_euler',1,[0,.14,-.24,.06,0])]+[(w,'rotation_euler',1,[0,.17*s,-.22*s,.07*s,0]) for s,w in zip((-1,1),wings)])


def serpent(root):
    """Prism Vault keykeeper. A continuous belly spirals around the coffer-sized footprint."""
    pts=[]; radii=[]
    for i in range(24):
        t=i/23
        angle=-.15+t*math.tau*1.31
        r=.44-.16*t
        pts.append((math.cos(angle)*r,math.sin(angle)*r*.76,.090+t*.39))
        radii.append(.012+.138*math.sin(min(t*3,1)*math.pi/2))
    pts.extend([(-.24,-.05,.60),(-.17,.035,.79),(-.085,.02,.95),(0,-.045,1.04)])
    radii.extend([.17,.15,.145,.13])
    body=tube('single coiled spectrum mantle',root,pts,radii,'teal',18,4,.91)
    # Separate inlaid bands follow the actual changing circumference, in the same mesh.
    chroma=['blue','iris','mint','brass','rust']
    for m in chroma: body.data.materials.append(M[m])
    for face in list(body.data.polygons)[:-2]:
        row,col=divmod(face.index,18)
        if row%9 in (0,1):
            face.material_index=1+(row//9)%len(chroma)
        elif col in (3,4) and row>18:face.material_index=3
    head=group('prism keeper head',(0,-.04,1.02),root)
    oval('broad hood',head,(0,.02,.12),(.30,.12,.255),'sea')
    for s in (-1,1):
        for j,(mat,height) in enumerate([('iris',.30),('blue',.25),('mint',.19)]):
            x=s*(.181+j*.052)
            tube('separate ribbon '+mat,head,[(x*.44,-.105,.009),(x,-.132,.086),(x*1.06,-.085,height),(x*1.03,-.025,height+.039)],[.020,.038,.030,.002],mat,8,3,.51)
    oval('brow scales',head,(0,-.076,.20),(.21,.157,.14),'teal')
    oval('broad smiling muzzle',head,(0,-.183,.132),(.177,.132,.087),'mint')
    for s in (-1,1):
        eye('watchful eye '+str(s),head,(s*.116,-.188,.23),.065,-.07)
        oval('nostril',head,(s*.077,-.292,.157),(.014,.008,.011),'sea',detail=10)
    tube('vault keeper smile',head,[(-.135,-.258,.114),(0,-.302,.089),(.14,-.255,.119)],[.005,.007,.004],'sea')
    crown=[(-.073,-.005,.296),(-.062,-.008,.366),(0,-.014,.409),(.058,-.007,.367),(.072,0,.296)]
    plate('prism crest',head,[(x,z) for x,_,z in crown],-.041,.08,'brass')
    plate('crest facet',head,[(-.037,.325),(0,.38),(.035,.326),(0,.307)],-.086,.013,'iris',.003)
    keys=group('vault key ribbons',(-.14,-.14,-.025),head)
    for j,(x,z,mat) in enumerate([(-.05,-.18,'brass'),(.028,-.13,'copper')]):
        tube('key ribbon',keys,[(0,0,.06),(x*.65,-.014,-.025),(x,-.019,z+.039)],[.011,.011,.008],['iris','rust'][j])
        ring('key bow',keys,(x,-.019,z+.028),.018,.019,.006,mat)
        rod('key shank',keys,(x,-.02,z+.013),(x,-.02,z-.04),.008,mat)
        block('key ward',keys,(x+.012,-.019,z-.034),(.031,.013,.013),mat,.003)
    animate('idle',4,[(head,'rotation_euler',2,[0,.045,0,-.045,0]),(keys,'rotation_euler',1,[0,.06,0,-.06,0])])
    animate('reaction',1.25,[(head,'rotation_euler',1,[0,-.17,-.12,.025,0]),(keys,'rotation_euler',1,[0,.20,-.25,.06,0])])


def eel(root):
    """A compact eel loop, broad blunt market-accountant face and waterproof ledger."""
    pts=[(.64,.021,.45),(.57,.089,.34),(.53,.12,.15),(.47,.020,.12),(.39,-.125,.24),(.08,-.16,.30),(-.24,-.12,.28),(-.41,-.01,.32),(-.39,.10,.46),(-.23,.10,.58),(-.13,.01,.61)]
    body=tube('folded muscular body',root,pts,[.009,.049,.075,.089,.102,.112,.132,.139,.139,.127,.12],'sea',18,5,.84)
    body.data.materials.append(M['mint'])
    for face in list(body.data.polygons)[:-2]:
        if face.index%18 in (6,7):face.material_index=1
    plate('bronze tail fan',root,[(.63,.44),(.682,.466),(.655,.398),(.673,.349),(.606,.357),(.577,.389)],.038,.042,'copper',.008)
    fin=[(-.37,.53),(-.43,.61),(-.39,.60),(-.38,.65),(-.33,.62),(-.28,.69),(-.26,.64),(-.19,.70),(-.16,.61),(-.11,.59)]
    plate('insulated dorsal comb',root,fin,.10,.074,'copper')
    for j in range(7):
        x=-.22+j*.079
        oval('lateral sensory pore',root,(x,-.214,.318-.030*j/6),(.013,.009,.014),'brass',detail=10)
    head=group('audit snout',(-.15,-.005,.60),root)
    oval('spatulate skull',head,(0,-.007,.02),(.202,.146,.143),'teal')
    oval('blunt snout',head,(.09,-.10,-.009),(.198,.131,.094),'sea')
    oval('cream jaw',head,(.105,-.103,-.058),(.171,.116,.059),'mint')
    for s in (-1,1):
        eye('accountant eye '+str(s),head,(s*.10+.008,-.148,.103),.051,.21)
        oval('smelling pit',head,(.155+s*.036,-.209,.024),(.010,.006,.007),'coal',detail=10)
    tube('ledger cord',head,[(-.083,-.068,-.047),(-.112,-.18,-.120),(-.087,-.304,-.125)],[.013]*3,'walnut')
    ledger=group('waterproof accounts',(-.087,-.305,-.124),head)
    block('waterproof book binding',ledger,(0,0,-.072),(.165,.041,.161),'walnut',.014,-.13)
    block('tallied cover',ledger,(0,-.018,-.066),(.145,.020,.145),'copper',.009,-.13)
    block('ledger inset',ledger,(0,-.032,-.066),(.111,.012,.105),'sea',.006,-.13)
    for i in range(3):rod('embossed tally',ledger,(-.033+i*.025,-.041,-.088),(-.026+i*.025,-.041,-.043),.004,'brass')
    fins=[]
    for s in (-1,1):
        f=group('pectoral fin '+str(s),(.15*s,-.018,-.038),head);fins.append(f)
        plate('bronze flipper',f,[(0,.024),(s*.104,.034),(s*.181,-.055),(s*.155,-.09),(s*.074,-.09),(s*.015,-.047)],.008,.068,'copper')
        tube('insulated fin edge',f,[(0,-.024,.016),(s*.10,-.021,.018),(s*.17,-.019,-.058)],[.017,.012,.006],'brass')
    animate('idle',3.5,[(head,'rotation_euler',2,[0,.05,0,-.05,0]),(ledger,'rotation_euler',1,[0,.065,0,-.065,0])])
    animate('reaction',1,[(head,'rotation_euler',0,[0,-.185,-.12,.016,0]),(fins[1],'rotation_euler',1,[0,-.42,-.19,.06,0])])
    animate('ability',2,[(head,'rotation_euler',0,[0,.09,.13,.05,0]),(ledger,'rotation_euler',0,[0,-.10,-.21,-.08,0]),(fins[0],'rotation_euler',1,[0,-.38,-.68,-.34,0])])


def golem(root):
    """A winding-key clockmaker built around the familiar taper of a metronome."""
    for s in (-1,1):
        block('iron shoe',root,(s*.22,-.09,.118),(.28,.40,.19),'ink',.052,-.03*s)
        block('welt',root,(s*.22,-.085,.057),(.29,.406,.062),'copper',.025)
        tube('stone ankle',root,[(s*.22,0,.15),(s*.20,0,.34)],[.10,.12],'slate',12,2)
    housing=group('resonator case',(0,0,.29),root)
    shell=[(-.37,0),(.37,0),(.39,.10),(.26,.61),(.17,1.0),(-.16,1.0),(-.27,.61),(-.39,.10)]
    plate('cast metronome case',housing,shell,0,.43,'sea',.043)
    plate('pendulum recess rim',housing,[(-.29,.12),(.29,.12),(.14,.81),(-.14,.81)],-.225,.045,'brass')
    plate('dial bed',housing,[(-.245,.15),(.245,.15),(.115,.755),(-.115,.755)],-.249,.021,'ink')
    for i in range(8):
        z=.19+i*.07
        for s in (-1,1):
            x=s*(.22-i*.014)
            rod('dial graduation',housing,(x,-.266,z),(x-s*(.029 if i%2==0 else .018),-.266,z+.004),.005,'cream')
    pend=group('pendulum pivot',(0,-.286,.18),housing)
    rod('pendulum staff',pend,(0,0,0),(0,0,.54),.019,'brass')
    plate('sliding weight',pend,[(-.063,.27),(.063,.27),(.043,.389),(-.043,.389)],0,.073,'copper')
    rivet('pivot screw',pend,(0,-.02,0),.048)
    head=group('kind dial head',(0,-.059,1.071),housing)
    block('face casting',head,(0,-.025,.025),(.46,.35,.24),'slate',.069)
    block('brow cornice',head,(0,-.012,.145),(.51,.38,.073),'brass',.026)
    for s in (-1,1):eye('clockmaker eye '+str(s),head,(s*.109,-.19,.042),.061,-.13*s)
    tube('mouth',head,[(-.085,-.195,-.04),(0,-.208,-.063),(.093,-.192,-.033)],[.006,.009,.006],'cream')
    arms=[]
    for s in (-1,1):
        arm=group('sleeve bearing '+str(s),(s*.266,0,.708),housing);arms.append(arm)
        oval('bearing boss',arm,(0,0,0),(.094,.113,.098),'copper')
        z=-.13 if s==1 else -.36
        tube('offset arm',arm,[(s*.036,0,-.044),(s*.14,0,-.215),(s*.22,-.12,z)],[.071,.056,.056],'slate',12,3)
        hand=group('brass hand',(s*.22,-.12,z),arm)
        oval('palm',hand,(0,0,-.018),(.075,.063,.071),'brass')
        for j in (-1,0,1):
            tube('rounded finger',hand,[(j*.04,-.015,-.038),(j*.045,-.042,-.092),(j*.04,-.063,-.103)],[.021,.020,.013],'brass')
    rod('winder shaft',housing,(.15,.12,.90),(.35,.12,.90),.035,'copper')
    for j in (-1,1):ring('winder loop',housing,(.35,.115,.90+j*.063),.045,.062,.016,'brass')
    animate('idle',4,[(pend,'rotation_euler',1,[0,.225,0,-.225,0]),(head,'rotation_euler',2,[0,.027,0,-.027,0])])
    animate('reaction',1.25,[(arms[1],'rotation_euler',1,[0,-.18,-.55,-.22,0]),(head,'rotation_euler',1,[0,-.09,-.12,.03,0])])


def chameleon(root):
    """Clockworks colleague with two rotating turret eyes, scale tiles and grasping feet."""
    tailpoints=[(.17,.018,.32),(.34,.036,.30),(.46,.022,.31)]
    radii=[.084,.07,.062]
    for i in range(26):
        t=i/25; a=math.pi*.72-t*math.tau*1.35;r=.171-.15*t
        tailpoints.append((.53+r*math.cos(a),.034,.22+r*math.sin(a)))
        radii.append(.054-.042*t)
    tube('single coiled prehensile tail',root,tailpoints,radii,'pine',12,3)
    oval('high arched body',root,(0,0,.33),(.315,.13,.206),'olive',-.09)
    for s in (-1,1):
        for j in range(6):
            x=-.225+j*.085; z=.35+(.027 if j%2 else 0)
            for k in range(2):
                target=z+k*.068
                yy=.125*math.sqrt(max(.05,1-(x/.315)**2-((target-.33)/.206)**2))
                block('raised checker scale',root,(x,s*yy,target),(.055,.023,.046),'mint' if (k+j)%2 else 'teal',.012,-.20)
    for i in range(7):
        x=-.21+i*.067;z=.33+.184*math.sqrt(max(0,1-(x/.316)**2))
        plate('dorsal ridge',root,[(x-.023,z-.025),(x-.006,z+.034),(x+.029,z-.015)],0,.035,'pine',.006)
    for x,s in [(-.18,-1),(.158,-1),(-.20,1),(.18,1)]:
        dx=-.043 if x<0 else .057
        tube('folded gripping leg',root,[(x,s*.053,.28),(x+dx,s*.128,.203),(x+dx*.6,s*.14,.075)],[.062,.049,.027],'pine',10,4)
        for toe in (-1,1):
            tube('opposed curling toe',root,[(x+dx*.6,s*.14,.084),(x+dx*.6+toe*.037,s*.159,.053),(x+dx*.6+toe*.051,s*.185,.056)],[.023,.018,.006],'ochre',8,3)
    head=group('tilting casque',(-.245,-.009,.397),root)
    plate('tall head casque',head,[(-.149,.07),(-.092,.117),(.035,.18),(.078,.012),(.036,-.083),(-.116,-.096),(-.205,-.03)],0,.214,'olive',.038)
    oval('muzzle',head,(-.113,-.10,-.025),(.15,.114,.076),'olive')
    eyes=[]
    oval('broad lower jaw',head,(-.111,-.101,-.060),(.132,.102,.051),'mint')
    head.rotation_euler.z=.35
    for s in (-1,1):
        e=group('independent turret '+str(s),(-.094+s*.079,-.145+s*.006,.071+s*.020),head);eyes.append(e)
        oval('turret cone',e,(0,0,0),(.079,.07,.083),'teal')
        eye('aperture',e,(-.019,-.054,.008),.042,-.30 if s==-1 else .24)
    tube('knowing smile',head,[(-.220,-.169,-.040),(-.16,-.201,-.050),(-.096,-.206,-.035)],[.005,.007,.004],'pine')
    animate('idle',4,[(eyes[0],'rotation_euler',2,[0,.22,0,-.14,0]),(eyes[1],'rotation_euler',2,[0,-.13,0,.20,0])])
    animate('reaction',1,[(head,'rotation_euler',1,[0,.19,.12,-.02,0]),(eyes[0],'rotation_euler',2,[0,.32,.15,-.05,0])])
    animate('ability',2,[(eyes[0],'rotation_euler',2,[0,-.46,.26,.16,0]),(eyes[1],'rotation_euler',2,[0,.48,-.24,-.16,0]),(head,'rotation_euler',0,[0,-.07,.16,.11,0])])


def demon(root):
    """An offended thunderhead, borne by two short basalt hooves and a ragged vapor ruff."""
    for s in (-1,1):
        oval('slipper hoof',root,(s*.16,-.056,.076),(.12,.161,.072),'ink')
        tube('wisp shin',root,[(s*.15,.02,.09),(s*.137,0,.21),(s*.186,.018,.33)],[.060,.070,.095],'slate')
    mane=group('eddying mane',(0,.024,.50),root)
    oval('swirling cloud core',mane,(0,.022,-.033),(.30,.17,.26),'slate')
    for i in range(14):
        a=i*math.tau/14
        cx,sz=math.cos(a),math.sin(a)
        length=.14+(.065 if i%3==0 else .017)
        pts=[(.20*cx,0,.18*sz),(.30*cx,.01,.255*sz),
             ((.28+length*.65)*cx-.045*sz,.03,(.25+length*.50)*sz+.055*cx),
             ((.28+length)*cx-.092*sz,.035,(.24+length)*sz+.070*cx)]
        tube('rolling vapor lick '+str(i),mane,pts,[.088,.086,.044,.003],['slate','stone','sea','slate','plum'][i%5],12,4,.84)
    face=group('indignant face',(0,-.126,.008),mane)
    oval('solid coal mask',face,(0,0,0),(.273,.13,.234),'charcoal')
    for s in (-1,1):
        eye('incredulous eye '+str(s),face,(s*.104,-.113,.039),.071,.19)
        brow=oval('asymmetric arch',face,(s*.107,-.132,.137),(.084,.024,.028),'ink',s*.32 if s<0 else .26)
        tube('swept horn',face,[(s*.151,.023,.150),(s*.205,.022,.245),(s*.213,.003,.315),(s*.175,-.01,.34)],[.054,.045,.029,.003],'brass',12,4)
    oval('stubborn nose',face,(.012,-.141,-.023),(.051,.04,.041),'rust')
    oval('complaining mouth',face,(.036,-.116,-.102),(.066,.024,.040),'ink',-.22)
    tube('crooked lip',face,[(-.04,-.129,-.093),(.036,-.142,-.078),(.096,-.115,-.105)],[.010,.014,.004],'stone')
    arms=[]
    for s in (-1,1):
        a=group('shrugging forelimb '+str(s),(s*.21,-.036,-.112),mane);arms.append(a)
        pts=[(0,0,0),(s*.115,0,-.071),(s*.199,-.038,-.048),(s*.237,-.050,.014)]
        tube('curling smoke wrist',a,pts,[.064,.066,.046,.028],'slate')
        for j in (-1,1):
            tube('vapor claw',a,[(s*.218,-.047,-.006),(s*(.24+j*.022),-.066,.028),(s*(.249+j*.031),-.070,.059+j*.008)],[.025,.016,.002],'stone')
    animate('idle',4,[(mane,'rotation_euler',2,[0,.055,0,-.055,0]),(arms[1],'rotation_euler',1,[0,-.08,0,.08,0])])
    animate('reaction',1.25,[(face,'rotation_euler',1,[0,-.18,-.14,.03,0])]+[(a,'rotation_euler',1,[0,-s*.42,-s*.36,-s*.09,0]) for s,a in zip((-1,1),arms)])


def twins(root):
    """Two talking cable ends share a twisted lower body and one persistent character root."""
    heads=[]
    for s in (-1,1):
        a0=0 if s==1 else math.pi
        pts=[];rr=[]
        for i in range(26):
            t=i/25
            a=a0+math.tau*1.12*t
            spread=.124+.12*t**2
            pts.append((spread*math.cos(a),.093*math.sin(a),.103+.675*t))
            rr.append(.080+.016*math.sin(t*math.pi))
        pts += [(s*.249,.030*s,.83 if s<0 else .90),(s*.275,-.004,.86 if s<0 else .934)]
        rr += [.083,.081]
        wire=tube('braided insulated throat '+str(s),root,pts,rr,'rust' if s<0 else 'teal',14,3)
        wire.data.materials.append(M['cream' if s==-1 else 'mint'])
        for f in list(wire.data.polygons)[:-2]:
            row,col=divmod(f.index,14)
            if col in (3,4): f.material_index=1
        head=group('interjecting twin '+str(s),pts[-1],root);heads.append(head)
        if s<0:
            oval('round cheek housing',head,(0,0,.041),(.167,.14,.139),'copper')
            ring('round strain relief',head,(0,-.080,.064),.139,.117,.023,'rust',-.06)
            oval('round face insert',head,(0,-.102,.067),(.127,.066,.109),'rust')
            for j in (-1,1):
                tube('springy tuft',head,[(j*.051,.009,.138),(j*.059,.02,.203),(j*.092,.006,.227)],[.021,.015,.006],'brass')
        else:
            block('square line head',head,(0,0,.047),(.279,.222,.243),'sea',.060,-.09)
            block('crimp jaw',head,(0,-.095,.036),(.248,.073,.171),'mint',.033,-.09)
            for j in (-1,1):
                tube('folded connector ear',head,[(j*.119,0,.074),(j*.177,.025,.147),(j*.161,.039,.179)],[.023,.023,.007],'copper')
        for j in (-1,1):
            eye('twin gaze '+str(s)+' '+str(j),head,(j*.055,-.15,.084),.044,-s*.28)
        sign=-1 if s<0 else 1
        tube('interrupted mouth',head,[(-.056,-.151,.019),(.006,-.169,.011*sign),(.064,-.148,.019*sign)],[.005,.007,.004],'ink')
        for j in (-1,1):
            tube('splayed cable foot',root,[(s*.113,.009,.109),(s*.16,j*.064,.067),(s*.207,j*.108,.049)],[.061,.052,.033],'rust' if s<0 else 'teal')
    animate('idle',4,[(heads[0],'rotation_euler',1,[0,-.07,0,.035,0]),(heads[1],'rotation_euler',1,[0,.04,0,-.07,0])])
    animate('reaction',1.25,[(heads[0],'rotation_euler',1,[0,.25,.12,-.045,0]),(heads[1],'rotation_euler',1,[0,.055,-.29,-.11,0])])


def backhoe(root):
    """Heavy squat crawler above the Rift. Boom, dipper and scooped bucket have separate pins."""
    for s in (-1,1):
        track=group('crawler '+str(s),(0,.31*s,.22),root)
        ringPts=[(-.54,0,-.15),(.51,0,-.15),(.67,0,-.08),(.69,0,.075),(.55,0,.153),(-.53,0,.153),(-.68,0,.084),(-.69,0,-.069),(-.54,0,-.15)]
        outline=[(x,z) for x,_,z in ringPts[:-1]]
        plate('endless track sidewall',track,outline,0,.174,'ink',.044)
        for i in range(5):
            x=-.50+i*.25
            oval('bogie outer rim',track,(x,s*.081,-.012),(.124,.037,.113),'slate')
            oval('bogie hub',track,(x,s*.111,-.012),(.066,.023,.066),'copper')
            rivet('axle head',track,(x,s*.130,-.012),.026)
        for i in range(10):
            for z in [-.146,.146]:
                block('track shoe',track,(-.54+i*.117,0,z),(.078,.20,.043),'charcoal',.013)
    block('padded turntable',root,(0,0,.433),(.91,.62,.15),'slate',.085)
    upper=group('slewing house',(0,0,.48),root)
    block('engine counterweight',upper,(-.186,0,.177),(.91,.66,.34),'ochre',.083)
    block('rub rail',upper,(-.20,0,.063),(.93,.674,.073),'copper',.028)
    for j in range(5):
        block('recessed radiator slat',upper,(-.46+j*.068,-.333,.194),(.034,.014,.132),'walnut',.009,-.10)
    cab=group('cab',(-.23,-.025,.33),upper)
    plate('raked cab frame',cab,[(-.24,0),(.24,0),(.18,.32),(-.13,.362),(-.242,.28)],0,.456,'ochre',.033)
    for s in (-1,1):
        plate('deep glazed windscreen',cab,[(-.192,.072),(.185,.072),(.138,.272),(-.10,.302),(-.181,.249)],s*.230,.012,'sea',.009)
        rod('glazing post',cab,(-.041,s*.240,.062),(-.019,s*.24,.304),.016,'brass')
    block('cab canopy',cab,(-.02,0,.346),(.50,.493,.074),'slate',.030)
    tube('crooked exhaust',upper,[(-.51,.204,.24),(-.51,.204,.59),(-.58,.204,.64)],[.038,.034,.034],'ink',12,3)
    for x in (-.56,.20):
        for s in (-1,1):
            block('hand rubbed panel corner',upper,(x,s*.331,.288),(.057,.014,.050),'brass',.009)
    arm=group('boom pivot',(.239,-.073,.248),upper)
    plate('cast rising boom',arm,[(-.085,-.054),(.09,-.064),(.371,.548),(.499,.646),(.461,.735),(.278,.651),(.082,.347)],0,.157,'ochre',.029)
    rod('lift cylinder',arm,(.055,-.095,.063),(.228,-.095,.34),.044,'slate')
    rod('lift piston',arm,(.225,-.095,.335),(.383,-.095,.573),.025,'pearl')
    dipper=group('dipper pivot',(.447,0,.676),arm)
    plate('curved dipper',dipper,[(-.063,.041),(.038,.067),(.287,-.195),(.397,-.498),(.307,-.531),(.177,-.254)],0,.137,'ochre',.021)
    rod('crowd cylinder',dipper,(.035,-.086,-.019),(.197,-.086,-.171),.036,'slate')
    rod('crowd piston',dipper,(.193,-.086,-.171),(.318,-.086,-.392),.019,'pearl')
    bucket=group('expressive bucket pivot',(.345,0,-.488),dipper)
    side=[(-.07,.043),(.097,.059),(.181,-.076),(.199,-.169),(.102,-.23),(-.16,-.229),(-.214,-.167),(-.057,-.115)]
    for s in (-1,1):
        plate('bucket cheek',bucket,side,s*.14,.031,'copper',.014)
    for a,b in [(0,1),(1,2),(2,3),(3,4),(4,5)]:
        x1,z1=side[a];x2,z2=side[b]
        mesh('formed scoop band',bucket,[(x1,-.14,z1),(x2,-.14,z2),(x2,.14,z2),(x1,.14,z1)],[(0,1,2,3)],'slate',False)
    for i in (-1,0,1):
        y=i*.101
        plate('rounded digging tooth',bucket,[(-.145,-.19),(-.127,-.222),(-.245,-.243),(-.266,-.219)],y,.046,'brass',.008)
    for x in (-.047,.056):
        eye('bucket eye '+str(x),bucket,(x,-.169,-.061),.041,-.24)
    for j,(x,y,z) in enumerate([(-.085,-.015,-.092),(.039,.03,-.055),(-.051,.053,-.028)]):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(x,y,z))
        o=bpy.context.object;o.scale=(.097,.080,.068);o.rotation_euler=(.2*j,.6*j,.27)
        finish(o,'inconvenient geology',bucket,'stone',False)
    for p in (arm,dipper,bucket):
        for s in (-1,1):
            oval('serviceable pin',p,(0,.1*s,0),(.054,.029,.054),'slate')
            rivet('pin cap',p,(0,.123*s,0),.032)
    animate('idle',4,[(bucket,'rotation_euler',1,[0,-.045,0,.045,0]),(upper,'rotation_euler',2,[0,.014,0,-.014,0])])
    animate('reaction',1.5,[(arm,'rotation_euler',1,[0,-.10,-.15,-.06,0]),(dipper,'rotation_euler',1,[0,.066,.164,.082,0]),(bucket,'rotation_euler',1,[0,-.14,-.25,-.09,0])])
