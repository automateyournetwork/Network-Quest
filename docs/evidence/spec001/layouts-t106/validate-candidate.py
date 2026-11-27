#!/usr/bin/env python3
"""Read-only semantic/source checks plus a proposed walk-envelope study.

Only this evidence directory receives output. No native/runtime acceptance.
Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0.
"""
import collections
import hashlib
import json
import math
from pathlib import Path

OUT=Path(__file__).resolve().parent
ROOT=OUT.parents[3]
candidate=json.loads((OUT/'scene-layouts.candidate.json').read_text())
seal=json.loads((OUT/'source-seal.json').read_text())
failures=[]
changed=[]
for row in seal['files']:
    path=ROOT/row['path']
    actual=hashlib.sha256(path.read_bytes()).hexdigest() if path.is_file() else None
    if actual!=row['sha256']:changed.append({'path':row['path'],'expected':row['sha256'],'actual':actual})
if changed:failures.append('Source seal changed; reconcile explicit deltas before any freeze')

footprint_review=[]
for room in candidate['rooms']:
    source=json.loads((ROOT/f'content/spec001/rooms/{room["roomId"].split(":")[1]}.json').read_text())
    if room['authoritativeSafePositions']!=source['safePositions'] or room['authoritativeWalkRegions']!=source['walkRegions']:
        failures.append(room['roomId']+' changed authoritative navigation contract')
    if len(room['hotspots'])!=len(source['hotspots']):failures.append(room['roomId']+' hotspot length changed')
    for a,b in zip(room['hotspots'],source['hotspots']):
        for key in ['id','subjectId','label','verbs','actionIds','evidenceIds']:
            if a[key]!=b[key]:failures.append(room['roomId']+' changed '+key)
    # R01 is already preserved against real registrations. Derive only its native
    # local source bounds, with correct Blender axis conversion. Later bounds are
    # explicitly candidate envelopes. Thin handrails and open cages are not a solid
    # box in reality, so this check remains conservative even for R01.
    obstacles=[]
    for prop in room['propPlacements']:
        envelope=prop['candidateEnvelope']
        x,base,z=prop['position']
        if envelope and base<.5:
            w,d=envelope['width'],envelope['depth']
            obstacles.append((prop['semanticId'],x-w/2,z-d/2,x+w/2,z+d/2))
        elif room['roomId']=='spec001:R01':
            num=prop['semanticId'].split(':')[1]
            native=ROOT/f'assets-src/rooms/R01-{num}-import-inspection.json'
            if native.exists():
                bounds=json.loads(native.read_text())['geometry']['boundsBlender']
                lo,hi=bounds['min'],bounds['max']
                obstacles.append((prop['semanticId'],x+lo[0],z-hi[1],x+hi[0],z-lo[1]))
    safe=source['safePositions'][0]['point']
    sx,sy=safe['x'],safe['y']
    clearance=[]
    for ident,x0,z0,x1,z1 in obstacles:
        dx=max(x0-sx,0,sx-x1);dy=max(z0-sy,0,sy-z1)
        clearance.append((math.hypot(dx,dy),ident))
    minimum,nearest=min(clearance)
    if minimum<.6:failures.append(room['roomId']+' arrival within .6m of candidate/native prop bounds')
    width=max(v['x'] for v in source['walkRegions'][0]['vertices'])
    depth=max(v['y'] for v in source['walkRegions'][0]['vertices'])
    # Non-authoritative planning routes on 0.2 m cells, with 0.4 m clearance from
    # each solid prop envelope. They do not add a new proximity gate or a navmesh.
    step=.2
    def point(node):return [round(node[0]*step,4),round(node[1]*step,4)]
    def blocked(node):
        x,z=point(node)
        if not (.4<=x<=width-.4 and .4<=z<=depth-.4):return True
        return any(x0-.4<=x<=x1+.4 and z0-.4<=z<=z1+.4 for _,x0,z0,x1,z1 in obstacles)
    start=(round(sx/step),round(sy/step))
    parent={start:None};queue=collections.deque([start])
    while queue:
        node=queue.popleft()
        for dx,dy in [(1,0),(-1,0),(0,1),(0,-1)]:
            nxt=(node[0]+dx,node[1]+dy)
            if nxt not in parent and not blocked(nxt):parent[nxt]=node;queue.append(nxt)
    paths=[]
    for target in room['hotspots']+room['exits']:
        x,_,z=target['anchorWorld']
        goal=min(parent,key=lambda p:(point(p)[0]-x)**2+(point(p)[1]-z)**2)
        nodes=[];cur=goal
        while cur is not None:nodes.append(point(cur));cur=parent[cur]
        nodes.reverse()
        # Collapse collinear steps for a reviewable path record.
        reduced=[]
        for node in nodes:
            if len(reduced)>1:
                a,b=reduced[-2],reduced[-1]
                if (b[0]-a[0])*(node[1]-b[1])==(b[1]-a[1])*(node[0]-b[0]):reduced.pop()
            reduced.append(node)
        paths.append({'targetId':target['id'],'approachPoint':point(goal),'polyline':reduced,
                      'distanceFromSubjectFloorPoint':round(math.hypot(point(goal)[0]-x,point(goal)[1]-z),3),
                      'use':'visible approach study only; current action reachability stays semantic and has no new proximity requirement'})
        if target['id'].startswith('exit:') and paths[-1]['distanceFromSubjectFloorPoint']>.5:
            failures.append(target['id']+' lacks candidate .5m approach under prop envelopes')
    footprint_review.append({'roomId':room['roomId'],'sourceSafeId':source['safePositions'][0]['id'],
        'sourceSafePoint':safe,'nearestPropEnvelope':nearest,'minimumSafeToPropEnvelopeMetres':round(minimum,4),
        'safeRadiusMetres':.6,'reachablePlanningCells':len(parent),'stepMetres':step,
        'candidatePaths':paths,
        'unverified':'Not a collision, character-footprint or free-walking runtime test. Shared tool dimensions, moving/party creatures, true open cages and source-specific geometry require actual keyframe/native inspection.'})

# Check R01 independently against retained source transforms, not regenerated
# candidate data. The candidate intentionally adds no shared prop to R01.
r01=next(r for r in candidate['rooms'] if r['roomId']=='spec001:R01')
actual=json.loads((ROOT/'content/spec001/presentation/R01.json').read_text())
for key,value in actual['camera'].items():
    if r01['camera'][key]!=value:failures.append('R01 camera changed: '+key)
for prop in r01['propPlacements']:
    model=next(m for m in actual['models'] if m['semanticId']==prop['semanticId'])
    if prop['position']!=model['position']:failures.append(prop['semanticId']+' R01 position changed')

result={'status':'PASS' if not failures else 'FAIL','scope':'Independent read-only source/semantic/retained-R01 comparison and candidate prop-envelope walk study',
        'failures':failures,'sourceFilesChecked':len(seal['files']),'sourceChanges':changed,
        'footprintReview':footprint_review,'canonicalSceneLayoutsWritten':False,
        'acceptedMediaAdded':0,'productionEvents':[],
        'limitations':'Candidate paths establish no player/controller behavior, finished mesh clearance, accessibility or asset acceptance. All authoritative world safe IDs/coordinates remain unchanged.'}
(OUT/'source-and-walk-review.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({'status':result['status'],'sourceFilesChecked':len(seal['files']),'failures':failures,
                  'roomsWithSafeClearanceStudy':len(footprint_review),'candidateTargetApproaches':sum(len(r['candidatePaths']) for r in footprint_review)},indent=2))
raise SystemExit(bool(failures))
