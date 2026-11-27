# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
from model import *


def scorpion(base):
    """Eight walking legs, two grasping pedipalps and one articulated exhibit lamp."""
    body=joint('carapace',(0,0,.205),base)
    abdomen=[(.27,.13,.20,.105),(.172,.085,.204,.122),(.063,.026,.210,.141),(-.054,-.027,.212,.152),(-.15,-.077,.206,.151)]
    for i,(x,y,z,r) in enumerate(abdomen):
        egg('overlapping_tergite',(x,y,z),(r*1.09,r*1.29,r*.83),'red' if i%2==0 else 'clay',body,.80)
        tube('dorsal_inlay',[(x-.010,y-r*.66,z+r*.60),(x+.019,y,z+r*.80),(x+.017,y+r*.60,z+r*.65)],
             [.006,.010,.005],'copper',body,sides=8)
    egg('cephalothorax',(-.178,-.104,.232),(.174,.167,.121),'red',body,.78)
    for s in (-1,1):
        eye('scorpion_eye',(-.230+s*.068,-.225,.296),.034,body,-.15)
        for i in range(4):
            x=-.100+.092*i; y=-.024+.046*i
            reach=.23+.021*math.sin(i)
            points=[(x,y+s*.106,.185),(x+.025,y+s*(reach-.060),.178),(x+.063,y+s*reach,.231),
                    (x+.085,y+s*(reach+.093),.111),(x+.108,y+s*(reach+.112),.025)]
            tube('jointed_walking_leg',points,[.028,.032,.031,.016,.006],'umber',base,bands={5:'copper',6:'copper'},sides=9)
        palm=joint('pincer_'+str(s),(-.186,-.106+s*.105,.192),body)
        point=(-.378+s*.04,-.12+s*.213,.207)
        tube('pedipalp',[(-.186,-.106+s*.106,.199),(-.259,-.10+s*.22,.160),point],
             [.048,.042,.053],'clay',palm)
        x,y,z=point
        egg('pincer_palm',(x,y,z),(.086,.062,.064),'red',palm,.80)
        for j in (-1,1):
            tube('pincer_finger',[(x-.03,y+j*.032,z),(x-.085,y+j*.061,z+.01),(x-.143,y+j*.049,z+.027),(x-.168,y+j*.019,z+.031)],
                 [.036,.030,.016,.002],'red',palm,bands={8:'copper',9:'brass',10:'brass',11:'brass'},sides=10)
    arc=joint('lamp_tail',(.28,.14,.237),body)
    points=[(.27,.14,.234),(.384,.161,.288),(.462,.166,.386),(.501,.169,.494),(.478,.130,.582),(.406,.102,.633),(.320,.074,.619)]
    for i,(p,q) in enumerate(zip(points,points[1:])):
        a,b=Vector(p),Vector(q);center=a.lerp(b,.48)
        r=.080-i*.0055
        tube('tail_cuirass',[a,center,b],[r*.75,r,r*.65], 'clay' if i%2 else 'red',arc,
             bands={5:'copper',6:'umber'},sides=12)
    lamp=joint('infrared_exhibit_lamp',points[-1],arc)
    egg('lamp_socket',(.306,.059,.610),(.062,.052,.050),'brass',lamp,.78)
    tube('lectern_lamp_tip',[(.290,.044,.611),(.251,.016,.593),(.235,.009,.546)],[.044,.038,.010],'coral',lamp)
    ring('pointer_collar',(-.327,-.324,.188),.036,.008,RIG['pincer_-1'],'brass')
    animate('idle',72,[swivel('lamp_tail',0,.071,wave),swivel('pincer_-1',2,.092,wave)])
    animate('reaction',40,[swivel('lamp_tail',1,-.35),swivel('infrared_exhibit_lamp',1,-.27),swivel('pincer_-1',2,.23),swivel('pincer_1',2,-.19)])
