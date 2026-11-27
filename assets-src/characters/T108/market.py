# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Three distinct educators for the Shell Market."""
from math import sin,cos,tau,pi
from sculpt import orb,block,tube,line,eyes,joint,motion,feather

def mole():
    torso=joint('digger',(0,.04,.43))
    head=joint('listener',(0,-.09,.77),'digger')
    orb('soft pear coat',(0,.04,.64),(.32,.30,.46),'aubergine',torso,(-.13,0,0))
    orb('velvet face',(0,-.128,.91),(.28,.275,.225),'aubergine',head)
    tube('long snout',[(0,-.22,.904),(0,-.34,.89),(0,-.46,.865),(0,-.50,.876)],[(.17,.125),(.118,.083),(.065,.061),(.037,.045)],'plum',head,12,(0,0,1))
    orb('wet shovel nose',(0,-.50,.886),(.075,.057,.052),'rose',head)
    eyes(head,0,-.327,.964,.060,.135)
    for s in (-1,1):
        orb('burrow ear',(s*.237,-.03,1.018),(.062,.040,.068),'plum',head)
        for j in (0,1):
            line('whisker',[(s*.067,-.44,.879+j*.018),(s*.15,-.433,.888+j*.035),(s*.232,-.42,.875+j*.064)],.007,'ivory',head)
        arm=joint('spade'+str(s),(s*.235,-.04,.673),'digger')
        tube('sleeved burrowing arm',[(s*.216,-.02,.70),(s*.295,-.07,.61),(s*.347,-.17,.55)],[.105,.107,.072],'plum',arm)
        orb('spade palm',(s*.35,-.19,.54),(.139,.132,.088),'rose',arm,(0,-s*.28,0))
        for j in range(4):
            dx=(j-1.5)*.052
            tube('ivory digging nail',[(s*(.353+dx),-.239,.55),(s*(.36+dx),-.303,.52),(s*(.37+dx),-.349+.02*abs(j-1.5),.496)],[.033,.029,.006],'ivory',arm)
        tube('short boot',[ (s*.158,.025,.288),(s*.163,.014,.221),(s*.173,-.013,.161) ],[.081,.076,.071],'plum')
        orb('broad foot',(s*.172,-.006,.158),(.14,.191,.081),'plum')
        for j in (-1,0,1):
            orb('toe',(s*.17+j*.047,-.155,.133),(.032,.06,.026),'ivory')
    # Paired insulated leads wind around the shoulder yoke to a telephone receiver.
    for j,key in enumerate(('brass','sea')):
        pts=[]
        for i in range(25):
            t=i/24
            pts.append((-.257+.54*t,-.197-.055*sin(pi*t)+.012*cos(t*tau*3+j*pi),.748-.113*sin(t*pi)+.012*sin(t*tau*3+j*pi)))
        line('two insulated conductors',pts,.015,key,torso)
    line('receiver spine',[(-.22,.105,.83),(-.18,.128,.974),(.045,.143,1.074),(.158,.12,1.022)],.035,'teal',head)
    for x,y,z in ((-.215,.102,.83),(.168,.111,1.01)):
        orb('receiver cap',(x,y,z),(.079,.068,.069),'teal',head)
        orb('earcap trim',(x,y-.037,z),(.071,.043,.057),'cream',head)
    block('loop service pouch',(.18,-.203,.50),(.175,.08,.151),'teal',torso,.032,(.06,-.14,0))
    motion('idle',{'listener':((-.035,.10,.15),(0,-.012,0)),'spade-1':((.12,.04,0),(0,0,0))},55)
    motion('reaction',{'listener':((-.27,.16,-.25),(0,0,.035)),'spade1':((-.75,.16,-.18),(0,0,0)),'spade-1':((-.24,-.12,0),(0,0,0))},29)

def badger():
    body=joint('coax keeper',(0,.075,.46))
    head=joint('mask',(0,-.16,.76),'coax keeper')
    orb('stocky coat',(0,.054,.61),(.292,.385,.321),'iron',body)
    orb('pale bib',(0,-.177,.64),(.202,.183,.208),'ivory',body)
    for s in (-1,1):
        for y in (-.132,.264):
            tube('plantigrade leg',[(s*.174,y,.55),(s*.191,y+.022,.334),(s*.206,y-.053,.17)],[.101,.093,.073],'coal')
            orb('black foot',(s*.206,y-.087,.147),(.096,.129,.065),'coal')
            for j in (-1,0,1):
                orb('short nail',(s*.203+j*.035,y-.18,.134),(.017,.028,.014),'brass')
    # Longitudinal markings follow a single sculpted triangular forehead and cheek profile.
    centers=[(0,-.084,.874),(0,-.176,.924),(0,-.284,.918),(0,-.402,.859),(0,-.489,.820),(0,-.55,.804)]
    widths=[(.132,.116),(.218,.162),(.215,.149),(.160,.116),(.104,.077),(.063,.047)]
    tube('broad ivory blaze',centers,widths,'ivory',head,20,(0,0,1))
    for s in (-1,1):
        pts=[(s*.102,-.112,1.012),(s*.147,-.205,1.044),(s*.153,-.288,1.005),(s*.13,-.386,.926),(s*.077,-.485,.852),(s*.05,-.535,.825)]
        tube('dark longitudinal badger mask',pts,[(.040,.024),(.061,.035),(.058,.034),(.05,.03),(.031,.024),(.011,.009)],'coal',head,12,(0,0,1))
        orb('rounded ear',(s*.164,-.105,1.033),(.077,.052,.074),'coal',head)
        orb('ear rim',(s*.17,-.137,1.056),(.054,.027,.047),'ivory',head)
        orb('alert eye',(s*.143,-.366,.961),(.042,.039,.044),'honey',head)
        orb('iris',(s*.147,-.396,.966),(.022,.013,.027),'ink',head)
        orb('eye glint',(s*.147-.007,-.408,.976),(.007,)*3,'white',head)
    orb('button nose',(0,-.553,.806),(.067,.056,.05),'ink',head)
    tube('brush tail',[(0,.26,.59),(.047,.40,.53),(.118,.51,.49),(.17,.575,.54)],[.084,.113,.087,.026],'iron',body)
    # A cutaway coax sample is held in a separate articulated demonstration yoke.
    sample=joint('sample yoke',(.18,-.105,.68),'coax keeper')
    line('leather sling',[(-.20,-.158,.76),(-.104,-.287,.65),(.09,-.315,.56),(.263,-.19,.52)],.031,'copper',body)
    line('sling side',[(.263,-.19,.52),(.28,.09,.49),(.206,.30,.71)],.028,'copper',body)
    tube('sample outer jacket',[(.245,-.09,.61),(.251,-.243,.652),(.263,-.339,.677)],[(.085,.085),(.085,.085),(.084,.084)],'teal',sample,20,(0,0,1))
    tube('sample braid',[(.263,-.333,.678),(.268,-.381,.689)],[.074,.074],'pewter',sample,20,(0,0,1))
    tube('sample dielectric',[(.268,-.379,.689),(.269,-.424,.702)],[.055,.055],'cream',sample,20,(0,0,1))
    tube('central conductor',[(.269,-.42,.701),(.272,-.476,.718)],[.019,.017],'copper',sample,12,(0,0,1))
    motion('idle',{'mask':((.035,-.05,-.17),(0,0,.01)),'sample yoke':((-.07,0,0),(0,0,0))},60)
    motion('reaction',{'mask':((.13,-.10,.26),(0,-.018,0)),'sample yoke':((-.66,-.15,.08),(0,0,.025))},32)

def chimera():
    core=joint('module chassis',(0,.02,.65))
    orb('lion haunch',(0,.126,.68),(.32,.455,.263),'plum',core)
    block('QSFP pack',(0,.115,.83),(.59,.70,.264),'pewter',core,.064)
    for lane in range(4):
        x=(lane-1.5)*.123
        block('separate engraved guide',(x,.13,.972),(.058,.475,.018),'iron',core,.007)
    for s in (-1,1):
        line('pack release bail',[(s*.30,.28,.80),(s*.345,.49,.80),(s*.276,.57,.841),(0,.57,.841)],.018,'brass',core)
        for y in (-.19,.30):
            tube('lion leg',[(s*.20,y,.64),(s*.26,y+.047,.425),(s*.271,y-.029,.188),(s*.268,y-.055,.11)],[.108,.079,.051,.057],'plum')
            orb('padded paw',(s*.265,y-.10,.104),(.085,.108,.061),'ivory')
    tube('forked tail',[(0,.37,.71),(.14,.52,.64),(.28,.60,.73),(.35,.59,.88),(.30,.57,.98)],[.076,.066,.047,.03,.009],'clay',core)
    # Lion, ram, and serpent consult one inventory card. Three heads are a metaphor;
    # the four grooves belong to the housing and make no independent-link promise.
    lion=joint('lion',(0,-.14,.83),'module chassis')
    tube('lion neck',[(0,-.13,.81),(0,-.17,.99),(0,-.164,1.17)],[.15,.147,.116],'plum',lion)
    for j in range(9):
        a=tau*j/9
        orb('scalloped copper mane',(.165*cos(a),-.19,1.266+.159*sin(a)),(.076,.082,.084),'copper' if j%3==0 else 'clay',lion)
    orb('lion face',(0,-.227,1.27),(.162,.147,.154),'honey',lion)
    eyes(lion,0,-.336,1.307,.049,.075)
    for s in (-1,1):
        orb('lion muzzle',(s*.048,-.342,1.228),(.059,.048,.05),'cream',lion)
    orb('lion nose',(0,-.387,1.261),(.038,.023,.027),'ink',lion)
    serpent=joint('serpent',(.155,-.14,.81),'module chassis')
    tube('s curved serpent neck',[(.15,-.15,.79),(.30,-.20,.98),(.40,-.18,1.11),(.416,-.16,1.26),(.50,-.18,1.33)],[.106,.085,.071,.065,.076],'teal',serpent)
    orb('serpent head',(.50,-.21,1.34),(.111,.145,.081),'sea',serpent)
    eyes(serpent,.50,-.32,1.368,.034,.057)
    line('serpent grin',[(.455,-.325,1.327),(.482,-.349,1.315),(.518,-.349,1.315),(.55,-.324,1.33)],.006,'ink',serpent)
    for j in range(3):
        feather('serpent crest',(.48+j*.029,-.155,1.39),(.46+j*.052,-.10,1.478-.023*j),.026,'teal',serpent)
    ram=joint('ram',(-.15,-.15,.82),'module chassis')
    tube('ram neck',[(-.15,-.14,.81),(-.26,-.20,.98),(-.38,-.23,1.10)],[.126,.113,.099],'cream',ram)
    orb('ram face',(-.393,-.254,1.131),(.13,.147,.124),'ivory',ram)
    eyes(ram,-.393,-.356,1.165,.040,.064)
    orb('ram muzzle',(-.393,-.377,1.098),(.079,.069,.052),'cream',ram)
    for s in (-1,1):
        orb('ram nostril',(-.393+s*.034,-.432,1.111),(.013,.008,.009),'bark',ram)
        feather('ram ear',(-.393+s*.087,-.22,1.16),(-.393+s*.176,-.204,1.104),.043,'ivory',ram)
    for s in (-1,1):
        pts=[]
        for i in range(13):
            t=i/12
            a=t*1.64*pi
            pts.append((-.393+s*(.076+.101*sin(a)*(.99-.40*t)),-.235+.017*cos(a),1.14+.086*cos(a)*(.99-.40*t)))
        tube('curled horn',pts,[.039-.021*i/12 for i in range(13)],'brass',ram,10)
    line('inventory ledger cord',[(.28,-.10,.88),(.34,-.083,.75),(.37,-.10,.72)],.012,'copper',core)
    block('ledger card',(.354,-.111,.653),(.032,.151,.167),'cream',core,.012,(.14,0,0))
    motion('idle',{'lion':((.045,.035,.10),(0,0,0)),'serpent':((0,-.14,-.12),(0,0,0)),'ram':((.055,.06,-.13),(0,0,0))},66)
    motion('reaction',{'lion':((.13,-.12,.15),(0,0,0)),'serpent':((.23,.34,.31),(0,0,0)),'ram':((.16,-.20,-.25),(0,0,0))},36)
