# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Offline checks over the actual reopened-source and native-browser captures."""
import json,math,struct,hashlib
from pathlib import Path
R=Path(__file__).resolve().parents[2]
b=json.loads((R/'assets-src/rooms/R01-browser-inspection.json').read_text())
C=[[1,0,0,0],[0,0,1,0],[0,-1,0,0],[0,0,0,1]];Ci=list(map(list,zip(*C)))
def mul(a,b):return [[sum(a[i][k]*b[k][q] for k in range(4)) for q in range(4)] for i in range(4)]
r={'sourceBrowserPoseParity':{},'exportStructure':{},'scope':'actual source/export checks; no owner or game integration acceptance'}
for ch in ['CH01','CH03']:
 s=json.loads((R/f'assets-src/characters/{ch}-native-poses.json').read_text());r['sourceBrowserPoseParity'][ch]={}
 expected={'idle','walk','reaction'} if ch=='CH01' else {'idle','fly','reaction'}
 assert {c['name'] for c in b['assets'][ch]['clips']}==expected, ch+' clip coverage'
 for c in b['assets'][ch]['clips']:
  for ix,part in [(2,'quarter'),(3,'half')]:
   key=c['name']+'-'+part;errs=[]
   for node,ar in s[key]['worldMatrices'].items():
    a=[ar[k*4:k*4+4] for k in range(4)];exp=mul(mul(C,a),Ci);bv=c['worldSamples'][ix][node.replace('.','')]
    errs.append((max(abs(exp[row][col]-bv[col*4+row]) for row in range(4) for col in range(4)),node))
   r['sourceBrowserPoseParity'][ch][key]={'maxWorldMatrixComponentError':max(errs)[0],'worstNode':max(errs)[1],'comparedMeshes':len(errs),'sourceFrame':s[key]['frame']}
   assert len(errs)==b['assets'][ch]['mesh'], ch+' '+key+' mesh coverage'
   assert max(errs)[0]<1e-5, ch+' '+key+' source/browser pose mismatch'
for p in sorted((R/'public/assets/models').glob('*.glb')):
 if p.stem not in ['R01','CH01','CH03','R01-architecture'] and not p.stem.startswith('R01-PR'):continue
 data=p.read_bytes();magic,ver,length=struct.unpack_from('<III',data);assert magic==0x46546c67 and ver==2 and length==len(data)
 jlen,jtype=struct.unpack_from('<II',data,12);g=json.loads(data[20:20+jlen]);blen,btype=struct.unpack_from('<II',data,20+jlen);buf=data[28+jlen:28+jlen+blen]
 assert all('uri' not in x for x in g.get('buffers',[]));assert not g.get('images',[]);assert all(n.get('name','')[:9]!='COLLISION' for n in g['nodes'])
 record={'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'meshes':len(g['meshes']),'triangles':sum(g['accessors'][pr['indices']]['count']//3 for m in g['meshes'] for pr in m['primitives']),'materials':len(g['materials']),'textureBytes':0,'externalReferences':0,'clips':[]}
 for a in g.get('animations',[]):
  maxseam=0
  for channel in a['channels']:
   assert not g['nodes'][channel['target']['node']].get('name','').endswith('_ROOT')
   sampler=a['samplers'][channel['sampler']];acc=g['accessors'][sampler['output']];view=g['bufferViews'][acc['bufferView']];offset=view.get('byteOffset',0)+acc.get('byteOffset',0);n={'VEC3':3,'VEC4':4}[acc['type']];vals=struct.unpack_from('<'+'f'*(acc['count']*n),buf,offset);assert all(math.isfinite(x) for x in vals);maxseam=max(maxseam,max(abs(vals[i]-vals[-n+i]) for i in range(n)))
  record['clips'].append({'name':a['name'],'channels':len(a['channels']),'firstLastValueMaxDifference':maxseam});assert maxseam<1e-5
 r['exportStructure'][p.name]=record
assert len(r['exportStructure'])==14;assert not b['errors'];assert b['maxAnchorError1280']<.002
for k in ['R01','CH01','CH03']:
 src=json.loads((R/f'assets-src/rooms/{k}-source-inspection.json').read_text());imp=json.loads((R/f'assets-src/rooms/{k}-import-inspection.json').read_text());assert src['geometry']['triangles']==imp['geometry']['triangles']==r['exportStructure'][k+'.glb']['triangles']
def gltf(name):
 data=(R/'public/assets/models'/name).read_bytes();n=struct.unpack_from('<I',data,12)[0];return json.loads(data[20:20+n])
r['labeledAxisChecks']=[]
for file,node,wanted in [('R01.glb','PR002_Lift_call_panel',[1.4,0,.6]),('R01.glb','PR003_Signal_arrival_tube',[7.4,0,.8]),('R01.glb','PR005_Apprentice_satchel',[2.2,0,5.2]),('CH03.glb','CH03_hover',[0,1.15,0])]:
 actual=next(n for n in gltf(file)['nodes'] if n.get('name')==node).get('translation',[0,0,0]);error=max(abs(x-y) for x,y in zip(actual,wanted));assert error<1e-6;r['labeledAxisChecks'].append({'export':file,'sourceLabel':node,'expectedRuntimeTranslation':wanted,'observedRuntimeTranslation':actual,'maxError':error})
assert r['exportStructure']['R01-architecture.glb']['triangles']+sum(r['exportStructure'][f'R01-PR{i:03}.glb']['triangles'] for i in range(1,11))==r['exportStructure']['R01.glb']['triangles']
r['anchorErrorPixels1280x720']=b['maxAnchorError1280'];r['browser']=b['browser'];r['allStructureAssertionsPassed']=True
(R/'assets-src/rooms/R01-animation-parity.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r,indent=2))
