#!/usr/bin/env python3
"""Verify canonical planning promotion without changing sealed preparation.
Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0.
"""
import collections
import hashlib
import json
import re
import subprocess
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
PREP=HERE.parent
def load(path):return json.loads(path.read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
failures=[]
def check(value,message):
    if not value:failures.append(message)
def differences(a,b,path=''):
    if type(a)!=type(b):return [path]
    if isinstance(a,dict):
        found=[]
        for key in sorted(set(a)|set(b)):
            child=path+'/'+key
            found.extend([child] if key not in a or key not in b else differences(a[key],b[key],child))
        return found
    if isinstance(a,list):
        if len(a)!=len(b):return [path]
        return [change for i,(x,y) in enumerate(zip(a,b)) for change in differences(x,y,path+'/'+str(i))]
    return [] if a==b else [path]

candidate=load(PREP/'scene-layouts.candidate.json')
layout=load(ROOT/'assets-src/rooms/scene-layouts.json')
fragment=load(PREP/'production-fragments.candidate.json')
allocation=load(ROOT/'assets-src/production-allocation.json')
original=load(PREP/'artifact-seal.json')
check(all(sha(ROOT/r['path'])==r['sha256'] for r in original['files']),'All16 original sealed preparation artifacts preserved')
check(sha(PREP/'artifact-seal.json')=='8ac84a20fd4fc0ade5a9c401f7888d6f5271652e364fc69c9ddaeed12cfc90b7','Original artifact seal unchanged')
check(layout['rooms'][0]['status']=='frozen layout retains existing native/runtime R01 benchmark; final episode reconciliation pending','R01 retained benchmark status is explicit')
check(layout['layoutFreeze']['preparedCandidateSha256']==sha(PREP/'scene-layouts.candidate.json'),'Canonical plan binds exact reviewed candidate')
check(layout['layoutFreeze']['productionBaseline']=='8b66902618564462ac9cb15ba677ea66fc12980b','AcceptedT105 production baseline')
check(layout['productionFragments']=='assets-src/production-allocation.json' and allocation['layoutPath']=='assets-src/rooms/scene-layouts.json','Canonical plans cross-reference each other')

allowed_top={'/status','/sourceCheckpoint','/preparedAgainstCheckpoint','/authorizationBoundary','/productionFragments','/layoutFreeze','/satisfiedFreezePrerequisites','/freezePrerequisites'}
allowed_patterns=[
 r'/rooms/\d+/status',r'/rooms/\d+/camera/status',
 r'/rooms/\d+/visualWalkGuide/(?:candidateApproachesFile|status)',
 r'/rooms/\d+/occlusion/status',r'/rooms/\d+/hotspots/\d+/status',
 r'/rooms/\d+/propPlacements/\d+/status',r'/rooms/\d+/access/pending',
 r'/allocationConflicts/\d+/freezeResolution',
 r'/nonmodelAllocations/illustrations/17/(?:additionalProvisionalUse|additionalUseAllocation)']
layout_changes=differences(candidate,layout)
unexpected=[p for p in layout_changes if p not in allowed_top and not any(re.fullmatch(pattern,p) for pattern in allowed_patterns)]
check(not unexpected,'Only reviewed metadata/path/status deltas from sealed candidate: '+str(unexpected))
allocation_changes=differences(fragment,allocation)
allowed_allocation={'/schemaVersion','/episodeId','/status','/layoutPath','/freeze','/reuseAllocations'}
unexpected_allocation=[p for p in allocation_changes if p not in allowed_allocation and not re.fullmatch(r'/uncountedSupportReservations/\d+/status',p)]
check(not unexpected_allocation,'Exact disjoint production fragments retained: '+str(unexpected_allocation))

world=load(ROOT/'content/spec001/world.json')
props={p['id']:p for p in world['props']}
placements=[];interactive=set();hotspot_count=0;exit_count=0
for r in layout['rooms']:
    short=r['roomId'].split(':')[1]
    actual=load(ROOT/f'content/spec001/rooms/{short}.json')
    check(r['authoritativeWalkRegions']==actual['walkRegions'],short+' exact walk regions')
    check(r['authoritativeSafePositions']==actual['safePositions'],short+' exact safe IDs/coordinates')
    check(len(r['hotspots'])==len(actual['hotspots']),short+' hotspot count')
    for h,a in zip(r['hotspots'],actual['hotspots']):
        for field in ['id','subjectId','label','verbs','actionIds','evidenceIds']:
            check(h[field]==a[field],h['id']+' current '+field)
    check([e['toRoomId'] for e in r['exits']]==[e['toRoomId'] for e in actual['exits']],short+' exact exit destinations/order')
    check(len(r['plannedSceneLayerIds'])==3,short+' exact three layer identities')
    for p in r['propPlacements']:
        check(p['sourceName']==props[p['semanticId']]['name'],p['semanticId']+' original source name')
        check(p['countsTowardAcceptedQuota'] is False,p['semanticId']+' no accepted quota claim')
        placements.append(p)
        if p['interactiveCandidate']:interactive.add(p['semanticId'])
    hotspot_count+=len(r['hotspots']);exit_count+=len(r['exits'])
check(len(layout['rooms'])==12,'twelve rooms')
check(len(placements)==150 and {p['semanticId'] for p in placements}==set(props),'150 exact distinct source placements')
check(len(interactive)==109,'109 distinct existing prop hotspot subjects')
check(hotspot_count==136 and exit_count==28,'136 hotspots and28 exits')
check(layout['sourcePropRoster']==candidate['sourcePropRoster'],'Unchanged exact source-prop roster')
check(layout['sourceCharacterRoster']==candidate['sourceCharacterRoster'] and len(layout['sourceCharacterRoster'])==25,'Unchanged25 character identities/clip obligations')
owned=[i for b in allocation['batches'] for i in b['assetIds']]
manifest=load(ROOT/'assets-src/manifest.json')['assets']
quota={a['assetId'] for a in manifest if a['kind'] not in ['room-model','sprite-sheet']}
check(len(owned)==380 and set(owned)==quota and len(set(owned))==380,'380 exact singly owned quota identities')
check(all(not a['countsTowardQuota'] for a in manifest),'Canonical manifest accepted counts unchanged at zero')
check(all(not s['countsTowardQuota'] for s in allocation['uncountedSupportReservations']) and len(allocation['uncountedSupportReservations'])==14,'Fourteen support identities count zero')
check(allocation['freeze']['manifestSha256AtFreeze']==sha(ROOT/'assets-src/manifest.json'),'Manifest not changed by freeze')
reuse=allocation['reuseAllocations'][0]
check(reuse['assetId']=='spec001:ASSET-ILLUSTRATION-18' and reuse['quotaIdentities']==1 and reuse['acceptedMediaCount']==0 and {u['roomId'] for u in reuse['uses']}=={'spec001:R02','spec001:R09'},'One illustration18, two required uses, zero accepted count')

source=load(PREP/'source-seal.json')
deltas=[r['path'] for r in source['files'] if sha(ROOT/r['path'])!=r['sha256']]
check(set(deltas)=={'specs/001-physical-layer-underworld/tasks.md','assets-src/art-direction.md'},'Only approved task checkbox and contained-frame wording source deltas')
patch=subprocess.run(['git','apply','--reverse','--check',str(PREP/'art-direction-containment.patch')],cwd=ROOT,text=True,capture_output=True)
check(patch.returncode==0,'Reviewed narrow art-direction patch is applied exactly')
art=(ROOT/'assets-src/art-direction.md').read_text()
check('semantic HTML in contextual' in art and 'panels inside the approved 286 monitor frame' in art,'Contained semantic UI direction applied')
check('semantic HTML alongside or\nbelow the stage' not in art,'Obsolete below-stage menu direction removed')

result={'status':'PASS' if not failures else 'FAIL','scope':'Canonical authoring-data and allocation freeze consistency; not runtime/native/media acceptance',
 'failures':failures,'originalPreparationArtifactsUnchanged':len(original['files']),
 'reviewedLayoutMetadataChanges':layout_changes,'reviewedAllocationMetadataChanges':allocation_changes,
 'authoritativeRooms':12,'namedPropPlacements':150,'distinctInteractivePropSubjects':len(interactive),
 'preservedHotspots':hotspot_count,'preservedExitBindings':exit_count,'characterIdentities':25,
 'singlyOwnedQuotaIdentities':len(owned),'uncountedSupportReservations':14,'acceptedMediaAdded':0,
 'sourceDeltasAfterAuthorizedFreeze':deltas,
 'sourceInputComparisonAfterFreeze':{'originalInputs':len(source['files']),'exactCurrentMatches':len(source['files'])-len(deltas),'authorizedDeltas':deltas,'boundary':'Pre-patch reconciliation had62 exact matches plus tasks.md. Applying the approved containment patch leaves61 exact current matches plus tasks.md and art-direction.md. Original63-input seal is preserved, not refreshed.'},
 'authorizedArtDirectionChange':{'path':'assets-src/art-direction.md','sealedBeforeSha256':next(r['sha256'] for r in source['files'] if r['path']=='assets-src/art-direction.md'),'afterSha256':sha(ROOT/'assets-src/art-direction.md'),'patchSha256':sha(PREP/'art-direction-containment.patch'),'reversePatchCheck':'PASS' if patch.returncode==0 else 'FAIL'},
 'geometryAndSemanticChangesFromCandidate':0,
 'canonicalArtifacts':[{'path':p,'sha256':sha(ROOT/p),'bytes':(ROOT/p).stat().st_size} for p in ['assets-src/rooms/scene-layouts.json','assets-src/production-allocation.json','assets-src/art-direction.md']],
 'verificationBoundary':'Original validator was run unchanged in an isolated copy; original source seal/result bytes preserved. No npm/application test or native route rerun was needed: runtime code/content/bindings and canonical asset manifest are unchanged. T105 accepted scoped native/focused/check/build evidence remains the actual gameplay baseline.'}
(HERE/'canonical-validation.json').write_text(json.dumps(result,indent=2)+'\n')
print(json.dumps({k:result[k] for k in ['status','failures','originalPreparationArtifactsUnchanged','authoritativeRooms','namedPropPlacements','preservedHotspots','preservedExitBindings','singlyOwnedQuotaIdentities','geometryAndSemanticChangesFromCandidate','acceptedMediaAdded']},indent=2))
raise SystemExit(bool(failures))
