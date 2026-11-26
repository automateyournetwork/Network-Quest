# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Original authored R01/CH01/CH03 construction. Run with Blender 5.2.1 --background --python.
Rigid articulated character rigs deliberately retain editable individual hard-surface meshes.
No imported geometry, textures or generative image inputs. All dimensions in metres.
"""
import bpy, math, json, sys
from mathutils import Vector
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/assets/models'; E=ROOT/'docs/evidence/spec001/assets'
mode=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'room'
M={}; active=None

def mat(name,hex,metal=0,rough=.55,emission=0):
 c=tuple(int(hex[i:i+2],16)/255 for i in (0,2,4)); lin=tuple(x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4 for x in c)
 m=bpy.data.materials.new(name); m.diffuse_color=(*lin,1); m.use_nodes=True
 b=m.node_tree.nodes.get('Principled BSDF'); b.inputs['Base Color'].default_value=(*lin,1); b.inputs['Metallic'].default_value=metal; b.inputs['Roughness'].default_value=rough
 if emission: b.inputs['Emission Color'].default_value=(*lin,1); b.inputs['Emission Strength'].default_value=emission
 M[name]=m; return m

def reset():
 bpy.ops.wm.read_factory_settings(use_empty=True)
 for args in [('basalt','435565',.1),('dark','182532',.2),('copper','B9784B',.65),('edge','E0AE73',.55),('cream','EEE1BE',0),('teal','398D87',.15),('blue','82AFC8',.25),('clay','D67B62',.05),('leather','705446',0),('skin','BA886D',0),('hair','382E30',.1),('black','121D29',.1),('glass','D8EFE6',.1,.25),('lamp','F0C47A',.1,.35,2.5),('pearl','D8EFE6',0,.6,.65)]:mat(*args)
 sc=bpy.context.scene; sc.unit_settings.system='METRIC'; sc.unit_settings.scale_length=1; sc.render.fps=24; sc.render.engine='CYCLES'; sc.cycles.samples=16; sc.cycles.use_denoising=True; sc.render.resolution_x=1280; sc.render.resolution_y=720; sc.render.resolution_percentage=100; sc.render.image_settings.file_format='PNG'; sc.render.film_transparent=True
 sc.world=bpy.data.worlds.new('Underworld neutral studio'); sc.world.use_nodes=True; sc.world.node_tree.nodes['Background'].inputs[0].default_value=(.12,.17,.22,1); sc.world.node_tree.nodes['Background'].inputs[1].default_value=.45
 sc.view_settings.view_transform='Standard'; sc.view_settings.look='None'; sc.view_settings.exposure=0; sc.view_settings.gamma=1
 sc['copyright']='Copyright 2026 John Capobianco; CC-BY-4.0'; sc['axis_contract']='Blender(x,y,z) -> runtime(x,z,-y); metres; local forward -Y'

def empty(name,loc=(0,0,0),parent=None):
 o=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(o); o.location=loc; o.parent=parent; return o

def finish(o,name,ma,parent=None,smooth=False,bevel=0):
 o.name=name; o.parent=parent; o.data.materials.append(M[ma])
 bpy.context.view_layer.objects.active=o; o.select_set(True); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('hand softened edges','BEVEL'); mod.width=bevel; mod.segments=2
  bpy.ops.object.modifier_apply(modifier=mod.name)
 if smooth:
  for p in o.data.polygons:p.use_smooth=True
 return o

def box(n,loc,size,ma,parent=None,b=.025):
 bpy.ops.mesh.primitive_cube_add(size=1, location=loc); o=bpy.context.object; o.scale=size; return finish(o,n,ma,parent,False,b)
def sphere(n,loc,scale,ma,parent=None,seg=20):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=12,radius=1,location=loc); o=bpy.context.object; o.scale=scale; return finish(o,n,ma,parent,True)
def cyl(n,loc,r,depth,ma,parent=None,rot=(0,0,0),verts=24):
 bpy.ops.mesh.primitive_cylinder_add(vertices=verts,radius=r,depth=depth,location=loc,rotation=rot); return finish(bpy.context.object,n,ma,parent,True,.008)
def torus(n,loc,r,t,ma,parent=None,rot=(0,0,0)):
 bpy.ops.mesh.primitive_torus_add(major_segments=32,minor_segments=8,major_radius=r,minor_radius=t,location=loc,rotation=rot); return finish(bpy.context.object,n,ma,parent,True)
def line(n,pts,r,ma,parent=None):
 cu=bpy.data.curves.new(n,'CURVE'); cu.dimensions='3D'; cu.resolution_u=12; cu.bevel_depth=r; cu.bevel_resolution=2
 sp=cu.splines.new('BEZIER'); sp.bezier_points.add(len(pts)-1)
 for b,p in zip(sp.bezier_points,pts): b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(n,cu);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');return finish(o,n,ma,parent,True)
def lathe(n,profile,ma,parent=None,loc=(0,0,0),sides=24):
 vs=[(r*math.cos(i*math.tau/sides),r*math.sin(i*math.tau/sides),z) for z,r in profile for i in range(sides)]
 fs=[]
 for j in range(len(profile)-1):
  for i in range(sides):a=j*sides+i;b=j*sides+(i+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs += [tuple(reversed(range(sides))),tuple((len(profile)-1)*sides+i for i in range(sides))]
 me=bpy.data.meshes.new(n);me.from_pydata(vs,[],fs);me.update();o=bpy.data.objects.new(n,me);bpy.context.collection.objects.link(o);o.location=loc;return finish(o,n,ma,parent,True)
def bolt(n,loc,parent):
 return cyl(n,loc,.035,.025,'edge',parent,(math.pi/2,0,0),6)
def light(n,loc,power,color,size,target):
 bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.name=n;o.data.energy=power;o.data.color=color;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
def camera(pos,target,span=16):
 bpy.ops.object.camera_add(location=pos);c=bpy.context.object;c.name='R01_registered_camera';c.rotation_euler=(Vector(target)-c.location).to_track_quat('-Z','Y').to_euler();c.data.type='ORTHO';c.data.ortho_scale=span;c.data.clip_start=.1;c.data.clip_end=80;bpy.context.scene.camera=c;return c
def studio(char=False):
 if char:camera((3,-5,2.7),(0,0,.89),3.8);light('warm_key',(2,-4,5),450,(1,.78,.54),4,(0,0,1));light('cool_fill',(-3,-1,3),300,(.5,.76,1),3,(0,0,1));light('rim',(2,3,4),550,(.8,1,.9),3,(0,0,1))
 else:camera((12,-16,13),(5,-3,1));light('warm_key',(1,-3,9),1800,(1,.78,.54),7,(4,-3,0));light('cool_fill',(10,-1,8),1400,(.50,.76,1),6,(5,-3,1));light('rim',(5,4,7),2000,(.8,1,.9),5,(5,-3,1))
def uv_all():
 for o in list(bpy.context.scene.objects):
  if o.type!='MESH' or o.name.startswith('COLLISION'):continue
  bpy.ops.object.select_all(action='DESELECT');o.select_set(True);bpy.context.view_layer.objects.active=o;bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.025);bpy.ops.object.mode_set(mode='OBJECT')
def collision(name,loc,size):
 o=box('COLLISION_'+name,loc,size,'clay',b=0);o.hide_render=True;o.display_type='WIRE';o['export']=False;return o

def room():
 reset(); r=empty('R01_Arrival_Lift');r['semanticId']='spec001:R01'
 box('R01_landing_foundation',(5,-3,-.33),(10.5,6.6,.5),'dark',r,.15)
 for x in range(10):
  for y in range(6):
   box('R01_floor_%02d_%02d'%(x,y),(x+.5,-y-.5,-.035),(.98,.98,.07),'basalt' if (x+y)%4 else 'dark',r,.025)
 # narrow copper floor inlays and screws retain generous clear central path
 for x in (.15,9.85):box('R01_floor_edge',(x,-3,.012),(.055,6,.025),'copper',r,.006)
 for y in (.15,5.85):box('R01_floor_edge',(5,-y,.012),(9.7,.055,.025),'copper',r,.006)
 # Lift cage PR001: recessed back-left. Curved industrial crown, lift shoes, ribbed cage.
 p=empty('PR001_Lift_cage',(.1,-.35,0));p['semanticId']='spec001:PR001';p.scale.z=.80
 box('PR001_base',(.7,0,.12),(1.8,1.2,.24),'dark',p,.12)
 for x in (-.15,1.55):
  box('PR001_upright',(x,0,1.5),(.16,.24,3),'copper',p,.06)
  for z in (.4,1.1,1.8,2.5):box('PR001_brace',(x,-.03,z),(.26,.3,.12),'edge',p)
 for x in (.1,.4,.7,1,1.3):cyl('PR001_gate_bar',(x,.35,1.5),.035,2.65,'basalt',p)
 line('PR001_crown',[(-.15,0,2.8),(.1,0,3.2),(.7,0,3.35),(1.3,0,3.2),(1.55,0,2.8)],.13,'copper',p)
 box('PR001_header',(.7,-.13,2.7),(1.4,.25,.25),'dark',p)
 for x in (.35,.7,1.05):sphere('PR001_header_rivet',(x,-.27,2.7),(.045,.025,.045),'edge',p)
 # PR002 call panel aligns POWER hotspot, separate from PR006 LINK diagnostic.
 p=empty('PR002_Lift_call_panel',(1.4,-.6,0));p['semanticId']='spec001:PR002'
 cyl('PR002_flanged_foot',(0,0,.1),.36,.2,'dark',p);box('PR002_stem',(0,0,.65),(.18,.18,1.1),'copper',p)
 box('PR002_cabinet',(0,0,1.3),(.75,.32,.7),'teal',p,.07);box('PR002_face',(0,-.185,1.3),(.64,.06,.58),'dark',p)
 torus('PR002_power_bezel',(0,-.245,1.42),.145,.035,'edge',p,(math.pi/2,0,0));sphere('PR002_power_lens',(0,-.25,1.42),(.118,.05,.118),'lamp',p)
 cyl('PR002_call_button',(0,-.24,1.15),.07,.06,'clay',p,(math.pi/2,0,0))
 for x in (-.26,.26):
  for z in (1.09,1.52):bolt('PR002_face_bolt',(x,-.24,z),p)
 line('PR002_power_feed',[(0,.14,1.3),(.15,.25,.5),(.45,.3,.05)],.035,'black',p)
 # PR006 broken link lamp: opaque unlit slotted lens. No lit-link teaching ambiguity.
 p=empty('PR006_Broken_link_lamp',(3.2,-.6,0));p['semanticId']='spec001:PR006'
 cyl('PR006_base',(0,0,.11),.4,.22,'dark',p);cyl('PR006_column',(0,0,.66),.13,1,'copper',p)
 box('PR006_body',(0,0,1.35),(.72,.42,.65),'basalt',p,.08)
 torus('PR006_bezel',(0,-.25,1.4),.20,.045,'copper',p,(math.pi/2,0,0));sphere('PR006_unlit_lens',(0,-.24,1.4),(.16,.055,.16),'black',p)
 for x in (-.09,0,.09):box('PR006_lens_grille',(x,-.31,1.4),(.015,.02,.23),'basalt',p,.005)
 box('PR006_lower_slot',(0,-.225,1.12),(.30,.03,.09),'black',p,.01)
 for x in (-.27,.27):bolt('PR006_bolt',(x,-.24,1.58),p)
 # PR003 signal arrival tube: bent tube with visible open socket and two retained clamps.
 p=empty('PR003_Signal_arrival_tube',(7.4,-.8,0));p['semanticId']='spec001:PR003'
 for x in (-.9,.9):box('PR003_foot',(x,0,.12),(.5,.7,.24),'dark',p);box('PR003_stanchion',(x,0,.43),(.15,.25,.55),'copper',p)
 cyl('PR003_tube',(0,0,.7),.25,2.35,'teal',p,(0,math.pi/2,0))
 for x in (-1.17,-.8,.8,1.17):torus('PR003_clamp',(x,0,.7),.26,.055,'copper',p,(0,math.pi/2,0))
 cyl('PR003_socket',(.0,-.29,.7),.17,.12,'dark',p,(math.pi/2,0,0));torus('PR003_socket_lip',(0,-.36,.7),.15,.025,'edge',p,(math.pi/2,0,0))
 line('PR003_cable',[(-1,-.1,.55),(-1.2,-.45,.22),(-.8,-.7,.09),(-.4,-.6,.09)],.035,'black',p)
 # PR004 orientation plaque retains icon-like embossed verbs, no essential baked text.
 p=empty('PR004_Orientation_plaque',(5.3,-.5,0));p['semanticId']='spec001:PR004'
 box('PR004_plinth',(0,0,.10),(.65,.5,.2),'dark',p);box('PR004_stem',(0,0,.65),(.12,.12,1),'copper',p)
 box('PR004_frame',(0,0,1.45),(1.0,.18,.65),'copper',p,.06);box('PR004_inset',(0,-.105,1.45),(.87,.04,.51),'cream',p)
 for x in (-.3,-.1,.1,.3):torus('PR004_verb_icon',(x,-.14,1.49),.06,.014,'teal',p,(math.pi/2,0,0))
 for x,w in [(-.22,.16),(.15,.32)]:box('PR004_decorative_rule',(x,-.14,1.31),(w,.015,.018),'copper',p,.003)
 # PR005 satchel is a reusable ground prop distinct from character's attached costume bag.
 p=empty('PR005_Apprentice_satchel',(2.2,-5.2,0));p['semanticId']='spec001:PR005'
 box('PR005_bag',(0,0,.28),(.65,.3,.5),'leather',p,.095);box('PR005_fold',(0,-.17,.43),(.67,.07,.23),'copper',p,.04)
 for x in (-.22,.22):box('PR005_strap',(x,-.21,.30),(.06,.045,.38),'dark',p,.015);torus('PR005_buckle',(x,-.24,.32),.05,.012,'edge',p,(math.pi/2,0,0))
 line('PR005_handle',[(-.20,0,.49),(-.15,0,.69),(.15,0,.69),(.20,0,.49)],.027,'leather',p)
 box('PR005_notebook',(.07,.04,.58),(.3,.18,.22),'cream',p,.025)
 # PR007 handrail kept on far left perimeter, away from valid floor rectangle.
 p=empty('PR007_Insulated_handrail',(-.35,-3,0));p['semanticId']='spec001:PR007'
 for y in (-.85,.85):cyl('PR007_post',(0,y,.55),.07,1.1,'copper',p);cyl('PR007_foot',(0,y,.05),.15,.1,'dark',p)
 cyl('PR007_grip',(0,0,1.1),.08,2.0,'dark',p,(math.pi/2,0,0))
 for y in (-.6,0,.6):torus('PR007_insulation',(0,y,1.1),.08,.025,'teal',p,(math.pi/2,0,0))
 # PR008 Entry turnstile outside lift landing at left perimeter, not across safe path.
 p=empty('PR008_Entry_turnstile',(-.15,-1.0,0));p['semanticId']='spec001:PR008'
 lathe('PR008_pillar',[(0,.24),(.15,.24),(.25,.14),(.85,.14),(.95,.22)],'teal',p)
 sphere('PR008_hub',(0,0,1),(.18,.18,.18),'copper',p)
 for a in (0,math.tau/3,math.tau*2/3):line('PR008_arm',[(0,0,1),(.52*math.cos(a),.52*math.sin(a),1)],.035,'edge',p)
 # PR009 message capsule on low tripod cradle at authored floor anchor.
 p=empty('PR009_Message_capsule',(7.7,-4.8,0));p['semanticId']='spec001:PR009'
 for a in (0,math.tau/3,2*math.tau/3):line('PR009_cradle_leg',[(.29*math.cos(a),.29*math.sin(a),.05),(0,0,.38)],.035,'copper',p)
 lathe('PR009_vessel',[(.32,.10),(.38,.21),(.65,.21),(.74,.15),(.78,.07)],'blue',p)
 for z in (.4,.66):torus('PR009_ring',(0,0,z),.21,.027,'edge',p)
 box('PR009_handle',(0,0,.82),(.18,.08,.09),'dark',p,.03);box('PR009_seal',(0,-.22,.54),(.13,.035,.13),'cream',p,.02)
 # PR010 welcome automaton pedestal: articulated decorative brass reader on footing.
 p=empty('PR010_Welcome_automaton_pedestal',(9.4,-5.4,0));p['semanticId']='spec001:PR010'
 lathe('PR010_stone',[(0,.4),(.15,.45),(.23,.32),(.65,.28),(.76,.40)],'basalt',p)
 box('PR010_reader',(0,0,1),(.55,.28,.35),'copper',p,.06)
 for x in (-.15,.15):torus('PR010_eye_rim',(x,-.18,1.03),.075,.015,'edge',p,(math.pi/2,0,0));sphere('PR010_eye',(x,-.18,1.03),(.052,.025,.052),'teal',p)
 line('PR010_neck',[(0,0,.76),(0,0,.85),(0,0,.95)],.06,'dark',p)
 # Room architecture: exit arch fits anchor and opens toward camera; no door across walk route.
 for x in (8.6,10):
  box('R01_workshop_jamb',(x,-2.5,1.25),(.22,.30,2.5),'copper',r,.08)
  for z in (.3,1,1.7,2.4):box('R01_arch_band',(x,-2.5,z),(.32,.38,.10),'edge',r,.02)
 line('R01_workshop_crown',[(8.6,-2.5,2.4),(8.8,-2.5,2.85),(9.3,-2.5,3.1),(9.8,-2.5,2.85),(10,-2.5,2.4)],.16,'copper',r)
 box('R01_workshop_threshold',(9.3,-2.5,.04),(1.3,.65,.08),'edge',r,.04)
 for x in (8.6,10):sphere('R01_exit_practical',(x,-2.68,2.2),(.07,.06,.15),'lamp',r)
 bpy.context.view_layer.update()
 for prop in [o for o in list(bpy.context.scene.objects) if o.name.startswith('PR') and o.parent is None]:
  pts=[child.matrix_world@Vector(c) for child in prop.children_recursive if child.type=='MESH' for c in child.bound_box]
  lo=Vector(tuple(min(v[i] for v in pts) for i in range(3)));hi=Vector(tuple(max(v[i] for v in pts) for i in range(3)))
  proxy=collision(prop.name[:5],(lo+hi)/2,hi-lo);proxy['semanticId']=prop['semanticId'];proxy['role']='authoring selection/collision bounds only; logical navigation authoritative'
 collision('R01_floor',(5,-3,-.2),(10,6,.4));studio();uv_all();save('room')

def joint(name,pos,parent):return empty(name,pos,parent)
def character(kind):
 reset();ph=kind=='CH03';root=empty(kind+'_ROOT');root['semanticId']='spec001:'+kind;root['nominalStrideMetres']=.9 if not ph else .65
 if not ph:
  body=joint('CH01_torso',(0,0,.87),root)
  lathe('CH01_coat',[(0,.20),(.13,.24),(.38,.19),(.48,.16)],'teal',body)
  box('CH01_coat_placket',(0,-.205,.24),(.055,.025,.43),'cream',body,.01)
  for z in (.12,.22,.32,.42):sphere('CH01_button',(.045,-.215,z),(.017,.012,.017),'edge',body,12)
  torus('CH01_belt',(0,0,.07),.22,.035,'leather',body);box('CH01_buckle',(0,-.255,.07),(.10,.03,.07),'edge',body,.012)
  # scarf, collar, and shoulder epaulettes
  torus('CH01_collar',(0,0,.46),.13,.04,'cream',body);box('CH01_scarf_tail',(.12,-.18,.31),(.085,.06,.30),'clay',body,.025)
  head=joint('CH01_head',(0,0,.52),body)
  sphere('CH01_neck',(0,0,-.01),(.075,.075,.10),'skin',head)
  sphere('CH01_face',(0,-.01,.14),(.16,.135,.19),'skin',head)
  # deliberately sculpted swept hair volumes, uncovered face, dark eyebrows
  sphere('CH01_hair_cap',(0,.015,.26),(.17,.135,.10),'hair',head)
  for x,z in [(-.12,.23),(-.07,.30),(0,.32),(.07,.29),(.12,.23)]:sphere('CH01_swept_lock',(x,-.035,z),(.065,.10,.065),'hair',head)
  for x in (-.064,.064):
   sphere('CH01_eye_white',(x,-.132,.16),(.047,.019,.034),'cream',head)
   sphere('CH01_pupil',(x,-.151,.16),(.018,.009,.022),'black',head,12)
   line('CH01_brow',[(x-.035,-.14,.211),(x,-.15,.22),(x+.03,-.14,.21)],.009,'hair',head)
   sphere('CH01_ear',(x*2.55,0,.14),(.035,.035,.055),'skin',head)
  sphere('CH01_nose',(0,-.153,.12),(.025,.028,.035),'skin',head)
  line('CH01_mouth',[(-.045,-.13,.055),(0,-.142,.047),(.043,-.13,.06)],.007,'hair',head)
  # small field goggles parked above hairline with separate copper lenses
  for x in (-.07,.07):torus('CH01_goggle_rim',(x,-.12,.29),.05,.013,'copper',head,(math.pi/2,0,0));sphere('CH01_goggle_lens',(x,-.12,.29),(.038,.009,.038),'blue',head)
  sphere('CH01_hip_joint',(0,0,.83),(.22,.14,.13),'basalt',root)
  arms=[];legs=[];knees=[]
  for s,tag in [(-1,'L'),(1,'R')]:
   a=joint('CH01_arm_'+tag,(s*.24,0,.39),body);arms.append(a)
   sphere('CH01_shoulder_'+tag,(0,0,-.04),(.095,.10,.13),'teal',a)
   cyl('CH01_sleeve_'+tag,(s*.018,0,-.18),.072,.26,'teal',a)
   torus('CH01_cuff_'+tag,(s*.018,0,-.31),.073,.025,'cream',a)
   sphere('CH01_glove_'+tag,(s*.018,-.005,-.38),(.067,.065,.09),'leather',a)
   sphere('CH01_thumb_'+tag,(-s*.04,-.04,-.36),(.025,.035,.045),'leather',a)
   leg=joint('CH01_leg_'+tag,(s*.11,0,.87),root);legs.append(leg)
   cyl('CH01_trouser_'+tag,(0,0,-.21),.086,.38,'basalt',leg)
   knee=joint('CH01_knee_'+tag,(0,0,-.39),leg);knees.append(knee)
   sphere('CH01_knee_joint_'+tag,(0,0,0),(.082,.082,.082),'basalt',knee)
   cyl('CH01_shin_'+tag,(0,0,-.17),.077,.32,'basalt',knee)
   sphere('CH01_boot_'+tag,(0,-.065,-.39),(.105,.17,.09),'leather',knee)
   box('CH01_boot_sole_'+tag,(0,-.065,-.445),(.21,.32,.035),'dark',knee,.025)
   torus('CH01_boot_cuff_'+tag,(0,0,-.30),.084,.023,'copper',knee)
   for z in (-.32,-.37):box('CH01_boot_lace_'+tag,(0,-.145,z),(.11,.015,.015),'cream',knee,.005)
  # asymmetric costume satchel and hand tools attach to torso, not additional prop identities
  box('CH01_costume_bag',(.26,.035,.04),(.20,.17,.23),'leather',body,.035);box('CH01_bag_flap',(.26,-.06,.11),(.21,.035,.11),'copper',body)
  line('CH01_shoulder_strap',[(-.15,-.15,.42),(.02,-.22,.23),(.26,-.07,.07)],.025,'leather',body)
  box('CH01_notebook',(.28,.03,.19),(.10,.12,.15),'cream',body,.015)
  for i in range(2):cyl('CH01_tool_handle',(-.25,.03+i*.065,.13),.022,.20,'clay' if i else 'edge',body)
  animate_apprentice(root,body,head,arms,legs,knees)
  collision('CH01',(0,0,.82),(.6,.55,1.64))
 else:
  body=joint('CH03_hover',(0,0,1.15),root);head=joint('CH03_head',(0,-.12,.12),body)
  # Pear abdomen handcrafted radial profile, bent expressive thorax and separate elytra.
  a=lathe('CH03_luminous_abdomen',[(-.22,.02),(-.19,.09),(-.12,.15),(-.02,.165),(.08,.125),(.14,.065)],'pearl',body);a.location.y=.08
  for z,r in [(-.12,.15),(-.02,.166),(.08,.125)]:torus('CH03_abdomen_band',(0,.08,z),r,.012,'teal',body)
  sphere('CH03_thorax',(0,-.065,.10),(.105,.12,.12),'copper',body)
  sphere('CH03_dark_face',(0,-.035,.06),(.12,.09,.115),'dark',head)
  for s in (-1,1):
   sphere('CH03_eye',(s*.055,-.115,.08),(.041,.023,.05),'cream',head)
   sphere('CH03_pupil',(s*.055,-.137,.083),(.015,.009,.025),'black',head,12)
   line('CH03_antenna',[(s*.055,-.025,.15),(s*.08,-.055,.25),(s*.14,-.06,.28)],.009,'copper',head)
   sphere('CH03_antenna_tip',(s*.14,-.06,.28),(.022,.02,.022),'lamp',head,12)
  line('CH03_smile',[(-.04,-.12,.025),(0,-.13,.013),(.04,-.12,.025)],.006,'copper',head)
  wings=[]
  for s,tag in [(-1,'L'),(1,'R')]:
   w=joint('CH03_wing_'+tag,(s*.07,0,.13),body);wings.append(w)
   # Solid low-roughness wing membrane avoids alpha ordering artifacts in GLB.
   sphere('CH03_wing_membrane_'+tag,(s*.19,.07,.025),(.25,.11,.012),'blue',w)
   line('CH03_wing_leading_vein_'+tag,[(0,0,0),(s*.15,-.035,.025),(s*.39,.04,.025)],.008,'edge',w)
   for frac in (.4,.7):line('CH03_wing_vein_'+tag,[(s*.07,0,.028),(s*.33*frac,.12,.028)],.005,'teal',w)
   for j in range(3):line('CH03_leg_'+tag+str(j),[(s*.07,-.04+j*.055,.06),(s*.15,-.11+j*.06,-.015),(s*.14,-.16+j*.07,-.06)],.008,'copper',body)
  animate_photon(root,body,head,wings)
  collision('CH03',(0,0,1.17),(.9,.55,.65))
 studio(True)
 if ph:bpy.context.scene.camera.location=(2,-3,2);bpy.context.scene.camera.rotation_euler=(Vector((0,0,1.3))-bpy.context.scene.camera.location).to_track_quat('-Z','Y').to_euler();bpy.context.scene.camera.data.ortho_scale=2.3
 uv_all();save(kind)

def animate_clip(name,frames,objects,pose):
 base={o: (o.location.copy(),o.rotation_euler.copy(),o.scale.copy()) for o in objects}
 for frame in range(1,frames+1):
  t=(frame-1)/(frames-1)
  for o,(loc,rot,scale) in base.items():o.location=loc;o.rotation_euler=rot;o.scale=scale
  pose(t)
  for o in objects:
   o.keyframe_insert('location',frame=frame);o.keyframe_insert('rotation_euler',frame=frame);o.keyframe_insert('scale',frame=frame)
 for o in objects:
  action=o.animation_data.action;action.name=o.name+'_'+name;action.use_fake_user=True
  track=o.animation_data.nla_tracks.new();track.name=name;track.strips.new(name,0,action);o.animation_data.action=None
  for loc,rot,scale in [base[o]]:o.location=loc;o.rotation_euler=rot;o.scale=scale
  track.mute=True
 # Exporter temporarily unmutes NLA tracks itself; rest pose remains stable.

def animate_apprentice(root,body,head,arms,legs,knees):
 obs=[body,head,*arms,*legs,*knees]
 def idle(t):
  a=math.sin(t*math.tau);body.scale.z=1+.012*a;head.rotation_euler.z=.035*a;arms[0].rotation_euler.x=.03*a;arms[1].rotation_euler.x=-.03*a
 animate_clip('idle',97,obs,idle)
 def walk(t):
  a=math.sin(t*math.tau);body.location.z+=.025*(1-math.cos(t*math.tau*2));body.rotation_euler.z=.035*a
  for i in range(2):legs[i].rotation_euler.x=.38*a*(-1 if i else 1);knees[i].rotation_euler.x=max(0,.48*a*(-1 if i else 1));arms[i].rotation_euler.x=-.32*a*(-1 if i else 1)
 animate_clip('walk',25,obs,walk)
 def reaction(t):
  a=math.sin(math.pi*t)**2;body.rotation_euler.x=-.09*a;head.rotation_euler.x=.16*a;head.rotation_euler.z=-.12*a;arms[1].rotation_euler.x=-1.15*a;arms[1].rotation_euler.y=-.35*a;arms[0].rotation_euler.x=-.2*a
 animate_clip('reaction',25,obs,reaction)

def animate_photon(root,body,head,wings):
 obs=[body,head,*wings]
 def pose(t,fast=False):
  a=math.sin(t*math.tau);body.location.z+=.035*a;body.rotation_euler.x=(.10 if fast else .025)*a;head.rotation_euler.z=.1*a
  for i,w in enumerate(wings):w.rotation_euler.y=(.55 if fast else .28)*math.sin(t*math.tau*(6 if fast else 8))*(-1 if i else 1)
 animate_clip('idle',97,obs,lambda t:pose(t))
 animate_clip('fly',31,obs,lambda t:pose(t,True))
 def react(t):
  a=math.sin(t*math.pi)**2;body.location.z+=.12*a;head.rotation_euler.z=-.3*a
  for i,w in enumerate(wings):w.rotation_euler.y=.9*a*(-1 if i else 1)
 animate_clip('reaction',25,obs,react)

def save(kind):
 sc=bpy.context.scene;sc.frame_set(1);sc.frame_start=1;sc.frame_end=97
 sc['production_status']='produced; owner review and game integration pending'
 path=ROOT/'assets-src/rooms/R01.blend' if kind=='room' else ROOT/f'assets-src/characters/{kind}.blend'
 bpy.ops.wm.save_as_mainfile(filepath=str(path))
 print('T063_SAVED',path)

if mode=='room':room()
elif mode in ('CH01','CH03'):character(mode)
else:raise ValueError(mode)
