# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Compare frozen shared-tool anchors against the physical mounts of their new parent assets."""
from pathlib import Path
import sys, json, hashlib
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent))
from workshop import *
from mathutils.bvhtree import BVHTree
s=json.loads((ROOT/'assets-src/rooms/scene-layouts.json').read_text())
room=s['rooms'][2]; parents={p['instanceId']:p for p in room['propPlacements']}
results=[]
fixtures={'PR122':'Central tester saddle','PR125':'Spiral winding','PR128':'Crimp tool shelf','PR133':'Open hook for tie bundle','PR148':'Evidence tag mounting clip'}
for child in room['propPlacements']:
    if not child.get('mountedToInstanceId'): continue
    parent=parents[child['mountedToInstanceId']]
    aid=parent['semanticId'].split(':')[-1];cid=child['semanticId'].split(':')[-1]
    src=HERE/(aid+'.blend');bpy.ops.wm.open_mainfile(filepath=str(src))
    scene=bpy.context.scene;tree=[]
    for obj in scene.objects[aid].children:
        vs=[obj.matrix_world@v.co for v in obj.data.vertices]
        faces=[p.vertices[:] for p in obj.data.polygons]
        tree.append((obj,BVHTree.FromPolygons(vs,faces),vs))
    px,ph,pz=parent['position'];cx,ch,cz=child['position'];rx,ry=cx-px,pz-cz
    hits=[]
    for obj,bvh,vs in tree:
        point,normal,index,distance=bvh.ray_cast((rx,ry,10),(0,0,-1))
        if point is not None:hits.append((point.z,obj.name))
    best=max(hits,default=None)
    target=next(row for row in tree if row[0].name==fixtures[cid])
    bounds=[[round(f(v[i] for v in target[2]),5) for i in range(3)] for f in (min,max)]
    results.append({'parent':aid,'childPlanned':cid,'sourceSha256':hashlib.sha256(src.read_bytes()).hexdigest(),
                    'roomAnchorRuntime':child['position'],'parentRelativeBlenderXYZ':[round(rx,5),round(ry,5),ch-ph],
                    'topAtAnchor':None if not best else {'height':round(best[0],5),'object':best[1],'anchorMinusSurfaceMetres':round(ch-ph-best[0],5)},
                    'nearbySupport':target[0].name,'supportBoundsBlenderXYZ':bounds,'futureJoin':'T136 must align actual tool geometry and protect observability at the room camera.'})
(RAW/'shared-mounts.json').write_text(json.dumps(results,indent=2)+'\n')
