# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Distinct original machines in the Titan's Workshop; dimensions are in metres."""
import math
import sys

# Blender's --python entry owns the current asset root and shared material library.
m = sys.modules['__main__']
block, bar, line = m.block, m.bar, m.line
panel, disc, lathe = m.panel, m.disc, m.lathe
ring, tau = m.front_ring, math.tau


def workbench():
    # A massive forge bench with a working screw vise and a graduation inset.
    for x in [-.92,.92]:
        for y in [-.34,.34]:
            block('Anvil-leg sole',(x,y,.045),(.27,.21,.09),'ink',.025)
            bar('Raked iron support',(x,y,.085),(x*.84,y*.77,.64),.087,'slate',8)
            disc('Brass foot collar',(x,y,.09),(x,y,.155),.096,'brass',8)
        block('Top bearer',(x*.86,0,.596),(.17,.93,.12),'copper')
    block('Tie shelf',(0,0,.245),(1.81,.55,.075),'sea',.026)
    for y in [-.37,.37]:
        bar('Apron tension rod',(-.88,y,.52),(.88,y,.52),.045,'brass')
    block('Forged edge apron',(0,0,.703),(2.34,1.08,.15),'ink',.065)
    for y in [-.34,0,.34]:
        block('Oiled laminated bench timber',(0,y,.791),(2.29,.328,.085),'walnut',.019)
    block('Scribed measurement rail',(-.14,-.441,.837),(1.46,.061,.012),'brass',.005)
    for i in range(15):
        block('Length division',(-.82+i*.097,-.444,.845),(.009,.042 if i%5==0 else .023,.008),'ink',.001)
    # Saddle, dovetail slide, two parallel jaws, thread and transversal handle.
    block('Vise swivel shoe',(-.72,-.12,.858),(.40,.37,.055),'copper')
    for y in [-.18,-.38]:
        block('Vise jaw casting',(-.72,y,.919),(.36,.095,.128),'sea',.022)
        block('Steel jaw liner',(-.72,y+(.055 if y<-.2 else -.055),.956),(.36,.021,.058),'stone',.005)
    bar('Vise lead screw',(-.72,-.52,.902),(-.72,-.18,.902),.031,'ink')
    disc('Handle barrel',(-.72,-.56,.9),(-.72,-.518,.9),.047,'brass')
    bar('Sliding tommy bar',(-.84,-.54,.82),(-.6,-.54,.98),.013,'stone')
    for x,z in [(-.84,.82),(-.60,.98)]:
        disc('Handle ball stop',(x,-.55,z),(x,-.53,z),.022,'brass')
    # Length exercise guides can retain a cable while leaving the ruler exposed.
    for x in [.2,.84]:
        block('Cable comb foot',(x,.13,.858),(.19,.19,.048),'copper')
        for y in [.06,.20]:
            bar('Cable saddle tine',(x,y,.875),(x,y,.982),.033,'slate')
    line('Loose bench specimen',[(.02,.11,.912),(.30,.10,.910),(.60,.146,.897),(.86,.13,.911),(1.08,.20,.856)],.023,'mint',3)


def cabinet():
    # Open-backed crown and a recessed peg well over three separate drawers.
    block('Arched cabinet toe',(0,0,.09),(.75,.63,.18),'ink',.045)
    block('Cabinet back',(0,.21,1.05),(.72,.16,1.9),'sea',.035)
    for x in [-.338,.338]:
        block('Rounded cabinet stile',(x,0,1.07),(.085,.56,1.94),'slate',.033)
        block('Brass stile inlay',(x,-.278,1.08),(.034,.018,1.81),'brass',.005)
    panel('Stepped toolhouse pediment',[(-.375,1.96),(-.375,2.03),(-.21,2.04),(-.12,2.14),(.12,2.14),(.21,2.04),(.375,2.03),(.375,1.96)],.01,.55,'copper',.012)
    block('Tool well dark back',(0,.106,1.46),(.57,.048,.84),'ink')
    for z in [.23,.45,.67,.89]:
        block('Drawer box and fascia',(0,-.022,z),(.59,.50,.195),'sea' if z<.8 else 'slate',.021)
        block('Label slot frame',(-.18,-.277,z+.018),(.13,.026,.071),'brass',.009)
        block('Drawer label slip',(-.18,-.293,z+.018),(.102,.011,.044),'cream',.002)
        line('Raised drawer pull',[(.03,-.279,z),(.036,-.318,z),(.15,-.318,z),(.16,-.279,z)],.012,'brass',2)
    block('Peg well shelf',(0,-.018,1.014),(.61,.50,.053),'brass')
    for x in [-.17,.005,.16]:
        disc('Tool hanger stud',(x,.09,1.87),(x,.027,1.87),.024,'brass')
    # Flat open-jaw wrench, small jaw pliers and flat-bladed driver.
    panel('Shadow-board open end spanner',[(-.203,1.23),(-.151,1.23),(-.145,1.69),(-.092,1.75),(-.096,1.83),(-.115,1.85),(-.147,1.78),(-.186,1.78),(-.218,1.84),(-.243,1.81),(-.238,1.735),(-.198,1.692)],.006,.032,'stone',.006)
    for sign in [-1,1]:
        line('Pliers moving arm',[(sign*.06,-.005,1.25),(sign*.045,-.005,1.45),(-sign*.026,-.005,1.66),(-sign*.02,-.005,1.75)],.022,'copper',2)
    disc('Pliers hinge',(0,-.04,1.55),(0,-.012,1.55),.032,'brass')
    bar('Driver shank',(.17,.015,1.27),(.17,.015,1.65),.013,'stone')
    lathe('Fluted driver handle',.17,.015,[(1.62,.027),(1.65,.041),(1.76,.043),(1.81,.03)],'amber',8)


def console():
    lathe('Receiving console pedestal',0,0,[(0,.276),(.05,.30),(.09,.29),(.16,.18),(.56,.135),(.64,.22)],'slate',12,.75)
    disc('Pedestal band',(0,0,.12),(0,0,.15),.208,'copper',12)
    block('Receiver chassis',(0,0,.765),(.73,.47,.32),'sea',.058)
    block('Front fascia surround',(0,-.227,.79),(.64,.063,.204),'brass',.026)
    block('Ebony inset control plate',(0,-.266,.79),(.595,.028,.157),'ink',.02)
    for i in range(3):
        x=-.13+i*.096
        disc('Receiver key bezel',(x,-.28,.79),(x,-.297,.79),.034,'stone',12)
        disc('Separate raised key',(x,-.297,.79),(x,-.318,.79),.027,['amber','mint','cream'][i],12)
    block('Receiver B card',(.213,-.288,.79),(.121,.02,.125),'cream')
    m.glyph('Receiver B','B',.214,-.303,.747,.086)
    # A split teleprinter arm supports a narrow strip flowing over its output roller.
    for x in [-.23,.23]:
        panel('Paper feed cheek',[(x-.047,.91),(x-.048,1.063),(x,1.11),(x+.048,1.065),(x+.046,.91)],.09,.16,'copper')
    disc('Paper feed drum',(-.234,.08,1.056),(.234,.08,1.056),.073,'ink')
    block('Raised signed dispatch slip',(0,.011,1.049),(.35,.022,.235),'cream',.01)
    for x,width in [(-.058,.19),(-.080,.146),(-.072,.16)]:
        z=1.129 if width>.18 else (1.102 if width<.15 else 1.076)
        block('Printed message rule',(x,-.005,z),(width,.009,.009),'slate',.001)
    for x in [-.31,-.269,-.229]:
        block('Speaker slot',(x,-.28,.787),(.015,.01,.096),'brass',.003)
    # External terminated lead comes from the workshop patch lead.
    disc('Physical patch socket',(.34,.01,.72),(.389,.01,.72),.072,'brass')
    disc('Insulated inset',(.383,.01,.72),(.397,.01,.72),.044,'ink')


def perch():
    lathe('Three-stepped rookery foot',0,0,[(0,.24),(.026,.26),(.055,.25),(.074,.18),(.15,.13),(.20,.08)],'slate',10)
    lathe('Turned perch column',0,0,[(.16,.087),(.22,.11),(.28,.071),(.65,.052),(.72,.083),(.77,.072)],'copper',12)
    for z in [.245,.675]:
        disc('Column ferrule',(0,0,z),(0,0,z+.023),.085,'brass',12)
    for sign in [-1,1]:
        line('Fork beneath landing rail',[(0,0,.74),(sign*.03,0,.86),(sign*.14,0,.95),(sign*.214,0,.99)],.037,'sea',4)
    bar('Soft wrapped landing rail',(-.27,0,1.015),(.27,0,1.015),.054,'walnut',16)
    for x in [-.25,-.187,-.116,.116,.187,.25]:
        disc('Raised foot-grip wrap',(x-.009,0,1.015),(x+.009,0,1.015),.058,'brass',16)
    # Suspended feeding bell, separate from the landing line.
    line('Bell bracket',[(.028,.01,.56),(.12,.014,.55),(.175,.008,.63),(.173,.008,.68)],.015,'ink',3)
    lathe('Recruit call bell',.173,.008,[(.54,.054),(.56,.054),(.59,.036),(.63,.018)],'brass',16)
    disc('Bell tether',(.173,.008,.63),(.173,.008,.684),.009,'copper',8)


def easel():
    for sign in [-1,1]:
        x=sign*.43
        bar('Splayed easel leg',(x,-.10,.028),(sign*.19,.115,1.59),.044,'walnut',8)
        disc('Easel shoe',(x,-.10,.003),(x,-.10,.074),.054,'copper',8)
    bar('Adjustable rear leg',(0,.25,.025),(0,.025,1.43),.042,'walnut',8)
    line('Rear leg restraint',[(-.28,-.11,.48),(0,.16,.51),(.28,-.11,.48)],.016,'copper',1)
    block('Repair plan carrier',(0,-.055,1.003),(.93,.074,.93),'sea',.025)
    block('Sheet of repair vellum',(0,-.103,1.009),(.841,.024,.84),'cream',.015)
    block('Sheet ledge',(0,-.12,.553),(.97,.17,.058),'brass',.012)
    block('Top clamp',(0,-.10,1.48),(.21,.091,.077),'slate',.012)
    disc('Clamp screw',(0,-.14,1.485),(0,-.163,1.485),.037,'brass',8)
    # Three equally sized emblems, with the same route line weight and pin height.
    for x in [-.267,0,.267]:
        line('Equal repair branch',[(0,-.129,.74),(0,-.129,.89),(x,-.129,1.0),(x,-.129,1.07)],.009,'slate',1)
        ring('Equal option bezel',x,-.139,1.16,.092,.012,'copper')
    for d in [-.014,.014]:
        pts=[(-.321+i*.014,-.147,1.16+d*math.sin(i*math.pi/2)) for i in range(9)]
        line('Copper twisted strand',pts,.007,'sea',2)
    line('Optical ray', [(-.061,-.147,1.128),(-.018,-.147,1.182),(.022,-.147,1.128),(.061,-.147,1.182)],.008,'sea',1)
    for r in [.034,.06]:
        line('Radio arc',[(.267+r*math.cos(i*math.pi/8),-.147,1.14+r*math.sin(i*math.pi/8)) for i in range(9)],.006,'sea',1)
    disc('Route junction pin',(0,-.145,.75),(0,-.167,.75),.036,'slate',12)


def media_rack():
    # Three actual specimen carriers in upper, middle and lower bays.
    for x in [-.43,.43]:
        block('Sled foot',(x,0,.045),(.132,.56,.09),'ink',.025)
        block('Open test frame upright',(x,.10,.831),(.095,.11,1.55),'slate',.025)
        block('Brass upright seam',(x,.036,.83),(.029,.017,1.45),'brass')
    block('Crest rail',(0,.10,1.59),(.94,.13,.082),'sea',.03)
    for z in [.40,.87,1.34]:
        block('Isolated bay cross-rail',(0,.10,z-.13),(.87,.105,.059),'sea',.014)
        for x in [-.31,.31]:
            block('Specimen grip',(x,.031,z),(.067,.117,.22),'copper',.014)
    for dx,col in [(0,'copper'),(math.pi,'mint')]:
        pts=[(-.326+i*.0345,.011+.035*math.sin(i*.85+dx),1.34+.048*math.cos(i*.85+dx)) for i in range(20)]
        line('Exposed twisted conductor',pts,.015,col,2)
    for x in [-.21,.22]:
        disc('Fiber strain-relief boot',(x-.064,.012,.87),(x+.064,.012,.87),.040,'cream',12)
    line('Guided fiber sample',[(-.324,.012,.87),(-.13,.012,.86),(0,.012,.80),(.15,.012,.835),(.324,.012,.87)],.019,'mint',3)
    # The radio bay visibly contains two opposed apertures with air between them.
    for sign in [-1,1]:
        x=sign*.25
        for i in range(3):
            a=x-sign*i*.028
            disc('Horn flare step',(a,.01,.40),(a-sign*.03,.01,.4),.035+i*.024,'brass',12)
        end=x-sign*.087
        disc('Dark horn aperture',(end,.01,.4),(end-sign*.008,.01,.4),.060,'ink',12)


def board():
    for x in [-.56,.56]:
        block('Board foot',(x,0,.038),(.20,.29,.076),'ink',.023)
        block('Board upright',(x,.042,.79),(.084,.11,1.48),'slate',.018)
    block('Rounded pinboard frame',(0,.014,1.135),(1.45,.127,1.13),'copper',.045)
    block('Pinning felt field',(0,-.061,1.137),(1.364,.04,1.033),'sea',.028)
    block('Separate chalk trough',(0,-.066,.575),(1.36,.151,.058),'brass',.018)
    # A question pinned separately from two evidence slips; thread ends never imply proof.
    for x,z,w,h,col in [(-.32,1.23,.39,.49,'cream'),(.325,1.39,.38,.25,'mint'),(.325,.976,.38,.25,'cream')]:
        block('Paper note',(x,-.091,z),(w,.021,h),col,.011)
        disc('Drawing pin',(x,-.102,z+h*.43),(x,-.127,z+h*.43),.021,'brass',12)
    line('Raised question mark',[(-.39,-.108,1.29),(-.36,-.108,1.34),(-.28,-.108,1.35),(-.25,-.108,1.29),(-.30,-.108,1.25),(-.32,-.108,1.20)],.015,'slate',2)
    disc('Question dot',(-.32,-.109,1.14),(-.32,-.123,1.14),.017,'slate',10)
    for z in [.976,1.39]:
        for i in range(2):
            block('Written observation line',(.31,-.108,z+.014-i*.041),(.21-i*.055,.009,.009),'sea',.002)
        line('Uncommitted thread', [(-.12,-.101,1.23),(.007,-.112,1.21),(.116,-.106,z)],.007,'cream',2)
        disc('Thread tack',(.116,-.099,z),(.116,-.120,z),.014,'copper',8)
    block('Chalk stub',(.42,-.096,.61),(.13,.029,.024),'cream',.006)


def carousel():
    lathe('Counterweighted swivel foot',0,0,[(0,.25),(.033,.28),(.072,.28),(.109,.19),(.156,.132)],'slate',16)
    lathe('Turned axle',0,0,[(.094,.081),(.155,.097),(.21,.057),(.88,.057),(.92,.092),(.97,.055)],'brass',16)
    for radius,z in [(.435,.355),(.337,.735)]:
        lathe('Shallow carousel pan',0,0,[(z-.071,radius*.25),(z-.056,radius*.76),(z-.016,radius),(z+.014,radius),(z+.018,radius*.985)],'sea',24)
        for j in range(6):
            a=j*tau/6
            def pol(r,h,angle=a):
                return (r*math.cos(angle),r*math.sin(angle),h)
            bar('Radial parts divider',pol(.09,z+.029),pol(radius*.94,z+.029),.021,'brass',8)
            # A low curved rim with open access from above. Samples held in separate bins.
            line('Curved bin lip',[pol(radius*.958,z+.040,a+i*tau/36) for i in range(7)],.018,'copper',1)
            bx,by,_=pol(radius*.64,z,a+tau/12)
            if j%2==0:
                for dx in [-.026,.026]:
                    disc('Stored hex ferrule',(bx+dx,by,z+.019),(bx+dx,by,z+.066),.030,'cream',6)
            else:
                bar('Stored brass contact',pol(radius*.52,z+.046,a+.46),pol(radius*.79,z+.05,a+.53),.019,'amber',8)
    lathe('Index-wheel crown',0,0,[(.92,.077),(.955,.103),(.989,.102),(1.014,.064)],'copper',12)
    bar('Spinning handle',(-.131,0,1.013),(.131,0,1.013),.026,'brass')


def furnace():
    # Octagonal firebox plus polygonal masonry arch with a real open hearth cavity.
    block('Flagstone hearth',(0,.01,.105),(2.93,1.45,.21),'slate',.09)
    block('Hearth apron',(0,-.46,.24),(2.63,.48,.13),'copper',.033)
    for x in [-1.0,1.0]:
        block('Masonry pier plinth',(x,.08,.34),(.69,1.12,.21),'ink',.045)
        for i in range(3):
            block('Individual refractory pier stone',(x,.08,.575+i*.255),(.59,1.03,.247),'slate' if i%2==0 else 'charcoal',.031)
    # Ring of voussoirs, evenly arranged around the hearth mouth.
    cx,cz=0,1.20
    for i in range(9):
        a=i*math.pi/9+.012
        b=(i+1)*math.pi/9-.012
        pts=[(cx+r*math.cos(t),cz+r*math.sin(t)) for r,t in [(.705,a),(1.27,a),(1.27,b),(.705,b)]]
        panel('Individually cut arch stone',pts,.095,1.015,'copper' if i==4 else ('slate' if i%2==0 else 'charcoal'),.022)
    block('Rear soot lining',(0,.535,.988),(2.12,.14,1.48),'ink',.044)
    for x in [-.42,0,.42]:
        block('Grate bearer',(x,-.023,.338),(.06,.73,.061),'ink')
    for y in [-.33,-.17,0,.17,.33]:
        block('Iron hearth grate',(0,y,.371),(1.47,.043,.045),'stone')
    # Continuous glowing tongues bend away from the flue draw. Dark clinker is visible
    # between the brightest seams; the front lip of the grate is left accessible.
    for name,color,emission,strength in [
        ('ember',(.48,.042,.014,1),(.64,.019,.003,1),.83),
        ('fire',(.95,.22,.018,1),(1,.125,.012,1),.72),
        ('heart',(1,.70,.20,1),(1,.49,.077,1),.66)]:
        mat=m.bpy.data.materials.new(name)
        mat.use_nodes=True
        mat.diffuse_color=color
        shader=mat.node_tree.nodes.get('Principled BSDF')
        shader.inputs['Base Color'].default_value=color
        shader.inputs['Emission Color'].default_value=emission
        shader.inputs['Emission Strength'].default_value=strength
        m.sculpt.M[name]=mat
    back=[(-.66,.39),(-.59,.67),(-.64,.95),(-.51,.83),(-.43,.73),(-.37,.84),(-.31,1.15),
          (-.37,1.38),(-.22,1.23),(-.13,1.01),(-.06,1.04),(.045,1.37),(.038,1.68),(.16,1.48),
          (.19,1.29),(.14,1.10),(.18,.98),(.28,1.06),(.4,1.35),(.42,1.21),(.37,.99),(.42,.86),
          (.57,1.02),(.59,.82),(.55,.71),(.66,.81),(.64,.57),(.54,.39)]
    panel('Dark outer flame',back,.21,.12,'ember',.012)
    panel('Molten rising flame',[(-.57,.39),(-.55,.70),(-.45,.63),(-.36,.69),(-.32,.97),
          (-.29,1.12),(-.22,.94),(-.23,.82),(-.13,.76),(-.03,.88),(.08,1.16),(.09,1.33),
          (.145,1.19),(.11,.93),(.16,.82),(.24,.86),(.33,1.05),(.33,.91),(.28,.76),(.37,.69),
          (.51,.88),(.5,.69),(.59,.71),(.55,.39)],.108,.07,'fire',.008)
    panel('Luminous flame heart',[(-.42,.39),(-.45,.59),(-.34,.52),(-.28,.63),(-.27,.77),
          (-.18,.59),(-.09,.61),(.015,.76),(.07,.89),(.059,.69),(.11,.62),(.19,.66),
          (.23,.74),(.24,.60),(.33,.55),(.40,.65),(.41,.51),(.46,.39)],.04,.065,'heart',.007)
    for j in range(7):
        x=-.54+j*.177
        m.sculpt.oval('Banked clinker',m.parent,(x,-.04,.413+(.011 if j%2 else 0)),
                      (.12,.10,.059 if j%2 else .073),'ink' if j%3 else 'ember',detail=8)
    for x in [-.7,.69]:
        line('Copper flue elbow',[(x,.186,2.14),(x,.21,2.43),(x*.70,.21,2.50),(x*.62,.2,2.64)],.14,'copper',3)
    block('Smoke hood saddle',(0,.145,2.34),(1.62,.84,.31),'slate',.10)
    lathe('Flared extraction hood',0,.14,[(2.38,.71),(2.42,.71),(2.63,.33),(2.70,.31),(2.74,.39),(2.80,.39)],'sea',12,.8)
    for z,r in [(2.42,.69),(2.63,.327),(2.72,.354)]:
        lathe('Flue strap',0,.14,[(z,r),(z+.044,r)],'brass',12,.8)
    ring('Ash-damper wheel',1.044,-.474,.87,.148,.022,'brass')
    for a in [0,tau/3,2*tau/3]:
        bar('Damper spoke',(1.044,-.475,.87),(1.044+.134*math.cos(a),-.475,.87+.134*math.sin(a)),.012,'copper')
    disc('Damper hub',(1.044,-.487,.87),(1.044,-.417,.87),.04,'slate')


RECIPES = {'PR011':workbench,'PR012':m.relief,'PR013':cabinet,'PR014':console,
           'PR015':perch,'PR016':easel,'PR017':media_rack,'PR018':board,'PR019':carousel,'PR020':furnace}
