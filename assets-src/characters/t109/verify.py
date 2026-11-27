# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Verify exact delivered binary buffers, real pose comparisons, and frozen layout clearances."""
import hashlib
import itertools
import json
import math
from pathlib import Path
import struct

ROOT=Path(__file__).resolve().parents[3]
RAW=ROOT/'docs/evidence/spec001/character-production/T109'
def load(p):return json.loads(p.read_text())
def save(p,data):p.write_text(json.dumps(data,indent=2)+'\n')
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def envelope(boxes):
    return [min(b[k] for b in boxes) if k<3 else max(b[k] for b in boxes) for k in range(6)]
def xz_distance(bounds,x,z):
    return math.hypot(max(bounds[0]-x,x-bounds[3],0),max(bounds[2]-z,z-bounds[5],0))

def verify(asset):
    raw=RAW/asset
    n,b,imported=(load(raw/f) for f in ['native.json','browser.json','import.json'])
    glb=ROOT/n['exportPath'];data=glb.read_bytes()
    assert sha(ROOT/n['nativeSource'])==n['nativeSourceSha256']==b['sourceSha256']
    assert sha(glb)==n['exportSha256']==b['exportSha256']==imported['sourceExportSha256']
    magic,version,length,jlen,jtype=struct.unpack_from('<4s4I',data)
    assert (magic,version,length,jtype)==(b'glTF',2,len(data),0x4e4f534a)
    g=json.loads(data[20:20+jlen]);blen,btype=struct.unpack_from('<II',data,20+jlen)
    buf=data[28+jlen:]
    assert len(buf)==blen and btype==0x004e4942 and not g.get('images') and len(g['buffers'])==1 and 'uri' not in g['buffers'][0]
    triangles=sum(g['accessors'][p['indices']]['count']//3 for m in g['meshes'] for p in m['primitives'])
    assert triangles==n['triangles']==b['triangles']==imported['triangles']
    assert sorted(b['materials'])==n['materials']==imported['materials']
    assert not b['pageErrors']
    assert set(n['clips'])=={a['name'] for a in g['animations']}=={c['name'] for c in b['clips']}
    def floats(index):
        acc=g['accessors'][index];view=g['bufferViews'][acc['bufferView']]
        dims={'SCALAR':1,'VEC3':3,'VEC4':4}[acc['type']]
        assert acc['componentType']==5126
        off=view.get('byteOffset',0)+acc.get('byteOffset',0)
        assert view.get('byteStride',4*dims)==4*dims
        return list(struct.iter_unpack('<'+'f'*dims,buf[off:off+acc['count']*dims*4]))
    motion=[]
    for anim in g['animations']:
        name=anim['name'];changed=0;seam=0;nodes=[]
        for channel in anim['channels']:
            sampler=anim['samplers'][channel['sampler']]
            node=g['nodes'][channel['target']['node']]['name'];nodes.append(node)
            assert node!=n['root']
            t=[v[0] for v in floats(sampler['input'])];v=floats(sampler['output'])
            assert len(v)==len(t)>1 and all(math.isfinite(x) for row in v for x in row)
            assert all(y>x for x,y in zip(t,t[1:]))
            assert abs(t[0])<1e-6 and abs(t[-1]-n['clips'][name]['seconds'])<1e-6
            changed+=int(any(max(abs(x-y) for x,y in zip(row,v[0]))>1e-5 for row in v[1:]))
            seam=max(seam,max(abs(a-b) for a,b in zip(v[0],v[-1])))
        br=next(c for c in b['clips'] if c['name']==name)
        assert changed==br['varying']>0 and seam<1e-5
        poses=br['comparison']
        assert len(poses)==5
        boundsError=max(p['maxBoundsErrorMetres'] for p in poses)
        jointError=max(p['maxJointComponentError'] for p in poses)
        assert boundsError<.001 and jointError<.01
        integer=[p for p in poses if (p['fraction']*n['clips'][name]['lastFrame']).is_integer()]
        assert max(p['maxJointComponentError'] for p in integer)<1e-5
        assert min(p['boundsRuntime'][1] for p in poses)>-.00001
        motion.append({'clip':name,'varyingChannels':changed,'totalChannels':len(anim['channels']),
          'targets':nodes,'durationSeconds':br['duration'],'endpointComponentDifference':seam,
          'maxJointComponentDifference':jointError,'maxBoundsDifferenceMetres':boundsError,
          'maxIntegerFrameJointComponentDifference':max(p['maxJointComponentError'] for p in integer)})
    poses=[p for c in b['clips'] for p in c['comparison']]
    result={'source':n['nativeSource'],'sourceSha256':n['nativeSourceSha256'],'export':n['exportPath'],'exportSha256':sha(glb),
        'bytes':len(data),'triangles':triangles,'editableMeshObjects':len(n['authorObjects']),
        'rigidExportMeshes':len(g['meshes']),'materialPrimitives':b['draws'],'materials':b['materials'],
        'textureBytes':0,'embeddedBuffers':1,'externalImagesOrBuffers':0,'motion':motion,
        'sampledRuntimeEnvelope':envelope([p['boundsRuntime'] for p in poses])}
    if 'partyBounds' in poses[0]:
        result['partyYawDegrees']=poses[0]['partyYawDegrees']
        result['sampledPartyEnvelope']=envelope([p['partyBounds'] for p in poses])
    return result

if __name__=='__main__':
    result={f'CH{i}':verify(f'CH{i}') for i in range(18,26)}
    layouts=load(ROOT/'assets-src/rooms/scene-layouts.json')
    parties=['CH19','CH20','CH22'];gap=[];dist=[];resident=[]
    for room in layouts['rooms']:
        positions=room['partyStaging']['positions']
        for left,right in itertools.permutations(parties,2):
            # Conservatively combine all sampled per-character poses across both slots.
            a=result[left]['sampledPartyEnvelope'];b=result[right]['sampledPartyEnvelope']
            spacing=positions[1][0]+b[0]-(positions[0][0]+a[3])
            assert spacing>0
            gap.append({'room':room['roomId'],'pair':[left,right],'horizontalGapMetres':spacing})
        for p in room['authoritativeSafePositions']:
            for c in room['characterPlacements']:
                id=c['characterId'].split(':')[1]
                if id not in result: continue
                x,_,z=c['position'];clear=xz_distance(result[id]['sampledRuntimeEnvelope'],p['point']['x']-x,p['point']['y']-z)
                assert clear>0,(room['roomId'],id)
                resident.append({'room':room['roomId'],'resident':id,'safePosition':p['id'],'clearanceMetres':clear})
            for id in parties:
                for pos in positions:
                    d=xz_distance(result[id]['sampledPartyEnvelope'],p['point']['x']-pos[0],p['point']['y']-pos[2])
                    assert d>0
                    dist.append(d)
    assert len(gap)==72
    stage=load(RAW/'R11-clearance.json')
    assert [x['id'] for x in stage['observed']]==['CH25','CH20','CH19']
    save(RAW/'verification.json',{'result':'passed','sampling':'Five actual times per clip through native render dependency graph and Firefox AnimationMixer. GLB keyframes sampled at 24 fps. Fractional-frame reference renders use the Blender action curve; browser matrices interpolate the exported samples.',
         'models':result,'orderedPartyPairRooms':len(gap),'minimumHorizontalPartyGap':min(gap,key=lambda g:g['horizontalGapMetres']),
         'minimumPartySafePointClearanceMetres':min(dist),'residentSafePointClearances':resident,
         'placementScope':'Frozen candidate coordinates and finished mesh samples. R11 layout-only rendered separately; full room occlusion, interaction/placements and cross-batch teams remain integration work.'})
    print('T109 PASS',len(result),'models,',sum(len(v['motion']) for v in result.values()),'clips,',len(gap),'ordered pair/room checks')
