# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Reopen real sources, render, export, or import GLB in separate Blender processes."""
import bpy,json,sys,math,hashlib
from pathlib import Path
from mathutils import Vector
from bpy_extras.object_utils import world_to_camera_view
ROOT=Path(__file__).resolve().parents[2]; E=ROOT/'docs/evidence/spec001/assets'; O=ROOT/'public/assets/models'
mode=sys.argv[sys.argv.index('--')+1];sc=bpy.context.scene

def bounds(obs):
 pts=[o.matrix_world@Vector(c) for o in obs if o.type=='MESH' for c in o.bound_box]
 return {'min':[min(p[i] for p in pts) for i in range(3)],'max':[max(p[i] for p in pts) for i in range(3)]} if pts else None

def stats(obs):
 meshes=[o for o in obs if o.type=='MESH' and not o.name.startswith('COLLISION')];tris=0
 for o in meshes:o.data.calc_loop_triangles();tris+=len(o.data.loop_triangles)
 return {'meshes':len(meshes),'vertices':sum(len(o.data.vertices) for o in meshes),'triangles':tris,'boundsBlender':bounds(meshes),'uvMeshes':sum(bool(o.data.uv_layers) for o in meshes),'objectIds':[o.name for o in meshes]}

def export(name,obs):
 bpy.ops.object.select_all(action='DESELECT')
 for o in obs:
  if o.type in ('MESH','EMPTY') and not o.name.startswith('COLLISION'):o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(O/(name+'.glb')),export_format='GLB',use_selection=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False,export_apply=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_materials='EXPORT')

if mode=='reopen':
 source=Path(bpy.data.filepath);kind=source.stem;assert kind in ('R01','CH01','CH03');assert source.stat().st_size>100000
 obs=list(sc.objects);report={'source':str(source.relative_to(ROOT)),'sourceSha256':hashlib.sha256(source.read_bytes()).hexdigest(),'blender':bpy.app.version_string,'build':bpy.app.build_hash.decode(),'nativeReopen':True,'geometry':stats(obs),'clips':[]}
 for o in obs:
  if o.animation_data:
   for t in o.animation_data.nla_tracks:
    report['clips'].append({'node':o.name,'clip':t.name,'frames':[[s.frame_start,s.frame_end] for s in t.strips]})
 export(kind,obs)
 if kind=='R01':
  architecture=bpy.data.objects['R01_Arrival_Lift'];export('R01-architecture',[architecture,*architecture.children_recursive])
  placements=[]
  for root in [o for o in obs if o.name.startswith('PR') and o.parent is None]:
   old=root.location.copy();placements.append({'assetId':'spec001:ASSET-'+root.name[:5],'semanticId':'spec001:'+root.name[:5],'exportPath':'public/assets/models/R01-'+root.name[:5]+'.glb','sourceParent':root.name,'sourceBlenderLocation':list(old),'sourceBlenderScale':list(root.scale),'runtimePosition':[old.x,old.z,-old.y],'runtimeOuterScale':[1,1,1],'runtimeOuterQuaternion':[0,0,0,1],'scalePolicy':'Source parent scale is already preserved inside GLB; outer placement applies translation only'});root.location=(0,0,0);bpy.context.view_layer.update();export('R01-'+root.name[:5],[root,*root.children_recursive]);root.location=old
  bpy.context.view_layer.update()
  (ROOT/'assets-src/rooms/R01-placements.json').write_text(json.dumps({'roomId':'spec001:R01','sourceSha256':report['sourceSha256'],'architectureExportPath':'public/assets/models/R01-architecture.glb','architectureRoot':'R01_Arrival_Lift','props':placements,'characters':[{'assetId':'spec001:ASSET-CH01','exportPath':'public/assets/models/CH01.glb','runtimePosition':[5,0,3]},{'assetId':'spec001:ASSET-CH03','exportPath':'public/assets/models/CH03.glb','runtimePosition':[1.2,0,3.3]}],'fullSceneReferenceExportPath':'public/assets/models/R01.glb','quota':'No room or architecture quota; prop and character asset identities count only after actual game integration and acceptance'},indent=2)+'\n')
  raw=json.load(open(ROOT/'content/spec001/presentation/introduction-graybox.json'))['rooms'][0]
  anchors=[]
  for o in raw['objects']:
   x,y=o['point'];h=1.4 if 'power' in o['id'] or 'link' in o['id'] else (1.15 if 'photon' in o['id'] else (1.4 if 'plaque' in o['id'] else (.7 if 'path' in o['id'] else (.5 if 'satchel' in o['id'] or 'capsule' in o['id'] else 0))))
   v=world_to_camera_view(sc,sc.camera,Vector((x,-y,h)));anchors.append({'semanticId':o['id'],'runtimeWorld':[x,h,y],'uvTopLeft':[v.x,1-v.y],'pixel1280x720':[v.x*1280,(1-v.y)*720],'logicalPoint':o['point']})
  for x,y in [(0,0),(10,0),(0,6),(10,6)]:
   v=world_to_camera_view(sc,sc.camera,Vector((x,-y,0)));anchors.append({'semanticId':f'floor-{x}-{y}','runtimeWorld':[x,0,y],'uvTopLeft':[v.x,1-v.y],'pixel1280x720':[v.x*1280,(1-v.y)*720]})
  camera={'roomId':'spec001:R01','projection':'orthographic','runtimePosition':[12,13,16],'runtimeTarget':[5,1,3],'runtimeUp':[0,1,0],'near':.1,'far':80,'span':13,'heightSpanRule':'max(9,13/aspect)','blenderPosition':[12,-16,13],'blenderTarget':[5,-3,1],'blenderOrthoScaleAt1280x720':16,'dimensions':[1280,720],'colorManagement':{'view':'Standard','look':'None','exposure':0,'gamma':1,'output':'sRGB PNG with straight alpha'},'sourceSha256':report['sourceSha256'],'background':'transparent','scope':'source asset registration, not finished game acceptance'}
  (ROOT/'assets-src/rooms/R01-camera.json').write_text(json.dumps(camera,indent=2)+'\n');(ROOT/'assets-src/rooms/R01-registration.json').write_text(json.dumps({'roomId':'spec001:R01','anchors':anchors,'walkPolygon':[[0,0],[10,0],[10,6],[0,6]],'safeArrival':[5,3],'sourceSha256':report['sourceSha256']},indent=2)+'\n')
 sc.render.filepath=str(E/f't063-{kind}-source.png');bpy.ops.render.render(write_still=True)
 (ROOT/f'assets-src/rooms/{kind}-source-inspection.json').write_text(json.dumps(report,indent=2)+'\n')
 print('T063_REOPENED',kind,report['geometry']['triangles'])
elif mode=='inspect-details':
 kind=Path(bpy.data.filepath).stem;p=ROOT/f'assets-src/rooms/{kind}-source-inspection.json';r=json.loads(p.read_text());assert r['sourceSha256']==hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()
 r['collisionProxies']=[{'name':o.name,'hiddenInRender':o.hide_render,'boundsBlender':bounds([o])} for o in sc.objects if o.name.startswith('COLLISION')]
 r['units']={'system':sc.unit_settings.system,'scale':sc.unit_settings.scale_length};r['frameRate']=sc.render.fps
 r['rootTransforms']=[{'name':o.name,'location':list(o.location),'rotationEuler':list(o.rotation_euler),'scale':list(o.scale)} for o in sc.objects if o.type=='EMPTY' and o.parent is None]
 p.write_text(json.dumps(r,indent=2)+'\n');print('T063_DETAILS',kind,len(r['collisionProxies']))
elif mode=='import':
 kind=sys.argv[sys.argv.index('--')+2];bpy.ops.wm.read_factory_settings(use_empty=True);bpy.ops.import_scene.gltf(filepath=str(O/(kind+'.glb')))
 result={'glb':kind+'.glb','importedInFreshBlender':True,'blender':bpy.app.version_string,'geometry':stats(bpy.context.scene.objects),'actions':[a.name for a in bpy.data.actions]}
 (ROOT/f'assets-src/rooms/{kind}-import-inspection.json').write_text(json.dumps(result,indent=2)+'\n');print('T063_IMPORTED',kind,result['geometry']['triangles'])
else:raise ValueError(mode)
