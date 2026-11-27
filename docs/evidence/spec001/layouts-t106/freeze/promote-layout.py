#!/usr/bin/env python3
"""Promote the coordinator-reviewed T106 authoring layout without producing media.

Only the two explicitly owned canonical planning JSON files are written. Existing
sealed preparation and all runtime/manifest/tracking files remain unchanged.
Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0.
"""
import hashlib
import json
from pathlib import Path

HERE=Path(__file__).resolve().parent
ROOT=HERE.parents[4]
PREP=HERE.parent

def load(path):return json.loads(path.read_text())
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
def write(path,value):
    data=json.dumps(value,indent=2,ensure_ascii=False)+'\n'
    if path.exists() and path.read_text()!=data:
        raise RuntimeError(f'Refusing to replace an existing different canonical plan: {path}')
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(data)

sealed=load(PREP/'artifact-seal.json')
for row in sealed['files']:
    assert sha(ROOT/row['path'])==row['sha256'],row['path']
reconciliation=load(HERE/'source-reconciliation.json')
assert reconciliation['originalOwnedArtifactsMatched']==16
assert reconciliation['currentInputsExactlyMatched']==62
assert reconciliation['changes'][0]['path']=='specs/001-physical-layer-underworld/tasks.md'
assert reconciliation['status']=='PASS with explicitly approved tracking-only delta'
assert '- [X] T105 ' in (ROOT/'specs/001-physical-layer-underworld/tasks.md').read_text()

production='8b66902618564462ac9cb15ba677ea66fc12980b'
publication='e6362f6b27ef3daa0166468d2e56733fa08c9aa6'
layout=load(PREP/'scene-layouts.candidate.json')
allocation=load(PREP/'production-fragments.candidate.json')
prepared=layout['sourceCheckpoint']
layout['status']='frozen authoring layout; media production and finished presentation acceptance pending'
layout['sourceCheckpoint']=production
layout['preparedAgainstCheckpoint']=prepared
layout['authorizationBoundary']='Coordinator explicitly authorized same-loop122 canonical freeze after accepted local T105 and reviewed unchanged preparation. This freezes authoring geometry/identity/allocation only; it does not produce assets, modify runtime room bindings, accept media quotas, pass aggregate gates or authorize deployment.'
layout['productionFragments']='assets-src/production-allocation.json'
layout['layoutFreeze']={
    'date':'2026-11-27','revision':1,'task':'T106','loop':122,
    'authority':'Root coordinator explicit GO after T105 local-gameplay acceptance and reviewed preparation',
    'productionBaseline':production,'acceptedEvidencePublication':publication,
    'preparedCandidate':'docs/evidence/spec001/layouts-t106/scene-layouts.candidate.json',
    'preparedCandidateSha256':sha(PREP/'scene-layouts.candidate.json'),
    'originalArtifactSealSha256':sha(PREP/'artifact-seal.json'),
    'originalSourceSealSha256':sha(PREP/'source-seal.json'),
    'coordinatorPreparationReview':'docs/evidence/spec001/layouts-t106/root-preparation-review.md',
    't105Acceptance':'docs/evidence/spec001/routes-t105/root-review.md',
    't105AcceptanceSha256':sha(ROOT/'docs/evidence/spec001/routes-t105/root-review.md'),
    't105PacketSealSha256':sha(ROOT/'docs/evidence/spec001/routes-t105/packet-seal.json'),
    'sourceReconciliation':'docs/evidence/spec001/layouts-t106/freeze/source-reconciliation.json',
    'reviewedSourceDelta':'Only T104 and T105 task checkboxes; all62 room/content/presentation/media source inputs unchanged from the63-input preparation seal before the authorized art-direction wording correction',
    'runtimeConsumer':None,
    'fieldTerminology':'candidateEnvelope/candidateSelectRegion/interactiveCandidate and planned statuses distinguish authoring data from observed produced/exported/integrated/accepted media. Their numerical layout values are frozen; the field names do not claim native evidence.',
    'revisionRule':'A later keyframe or native review that requires a camera/placement change must record a reviewed layout revision and update camera/plate/masks/anchors together. Never silently alter authoritative safe IDs, coordinates or semantic bindings.',
    'mediaManifestChanged':False,'acceptedMediaAdded':0,
    'pendingEvidence':['actual native source dimensions/clip production','source/plate/mesh/sprite alignment and alpha/depth comparison','shared-tool and character/party footprint/occlusion','finished-room movement and12x7 late-room geometry','native keyboard/touch/200%/muted/reduced-motion access','full library human listening and observed runtime use','providers, external/aggregate gates and owner episode acceptance']}
layout['satisfiedFreezePrerequisites']=[
    {'requirement':'Accepted independent T105 routes/all twelve rooms','evidence':'docs/evidence/spec001/routes-t105/root-review.md','scope':'Local gameplay on unchanged production8b66902 with disclosed test overlays; aggregate G4 remains pending'},
    {'requirement':'Reviewed unchanged room/content/layout inputs','evidence':'docs/evidence/spec001/layouts-t106/freeze/source-reconciliation.json','scope':'62 exact hashes plus two explicitly accepted task checkbox changes; original seals preserved'},
    {'requirement':'Coordinator visual/candidate/roster review','evidence':'docs/evidence/spec001/layouts-t106/root-preparation-review.md','scope':'Diagram and authoring plan review, not native finished scenes'},
    {'requirement':'Preserved R01 approved frame/media direction','evidence':'docs/evidence/spec001/presentation/owner-frame-approval-2026-11-26.md','scope':'Original R01 transforms and unchanged audition approvals retained; no new media acceptance'},
    {'requirement':'Explicit canonical freeze GO','evidence':'docs/evidence/spec001/layouts-t106/freeze/review.md','scope':'Root same-loop122 instruction after T105; no new loop or media production'}]
del layout['freezePrerequisites']
for room in layout['rooms']:
    room['status']='frozen layout retains existing native/runtime R01 benchmark; final episode reconciliation pending' if room['roomId']=='spec001:R01' else 'frozen authoring layout; native source and runtime integration pending'
    room['camera']['status']='preserved actual R01 registration' if room['roomId']=='spec001:R01' else 'frozen authoring camera; native keyframe/source/plate registration pending'
    room['visualWalkGuide']['candidateApproachesFile']='docs/evidence/spec001/layouts-t106/source-and-walk-review.json'
    room['visualWalkGuide']['status']='frozen visual clearance plan; non-authoritative planning paths, not a new movement rule'
    room['occlusion']['status']='frozen conservative occlusion regions; actual alpha/depth masks pending except retained R01 sources'
    for hotspot in room['hotspots']:
        hotspot['status']='semantic target preserved in frozen layout; numerical projection is not native pixel/target-size evidence'
    for prop in room['propPlacements']:
        if room['roomId']!='spec001:R01':
            prop['status']='frozen named placement; actual source/export/runtime use pending'
    room['access']['pending']+='; T105 observed Compendium label wrapping within the word remains for T147–T152, with no source correction in this freeze'

reuse=layout['nonmodelAllocations']['illustrations'][17].pop('additionalProvisionalUse')
reuse['approval']='Coordinator reviewed and accepted the one-source/two-use allocation for T106 freeze2026-11-27; actual image and both observed runtime uses still pending'
layout['nonmodelAllocations']['illustrations'][17]['additionalUseAllocation']=reuse
resolutions={
 'LAYOUT-01':'Frozen authoritative12x7 late-room regions and exact saved positions; smaller current graybox remains disclosed by T105 and pending T133–T140/T147 finished integration.',
 'LAYOUT-02':'Exact source identities frozen. Contextual notices remain attached uses; no generic replacement model identities.',
 'LAYOUT-03':'One illustration18 with R09 journal and R02 earned decoration allocation accepted at freeze; actual image and both observed uses remain required, counted once.',
 'LAYOUT-04':'08 and16 allocations retained; absent pictures and their text alternatives remain honest. No image production occurred.',
 'LAYOUT-05':'Thirty named shared placements frozen; actual source geometry, room propInstances and meaningful observed uses remain pending.',
 'LAYOUT-06':'Existing character identities and safe arrivals frozen; world/party duplicate suppression and real large-creature/active-party occlusion remain runtime integration checks.',
 'LAYOUT-07':'Apply the reviewed narrow containment correction to art-direction.md with this freeze; original dated preparation and unchanged audio approval preserved.',
 'LAYOUT-08':'T105 is accepted and root authorized the layout freeze. Workshop/Titan and copper/fiber keyframes still require review before multiplying designs; any geometry correction requires an explicit layout revision.',
 'LAYOUT-09':'Fourteen nonquota support reservations are frozen in production-allocation.json; canonical media manifest remains unchanged until actual source/export records exist.',
 'LAYOUT-10':'Existing measured source bounds and authored Photon hover retained without rescaling or double translation.'}
for conflict in layout['allocationConflicts']:
    conflict['freezeResolution']=resolutions[conflict['id']]

allocation['schemaVersion']=1
allocation['episodeId']='spec001'
allocation['status']='frozen production allocation; sources/exports/use/review remain pending per canonical media manifest'
allocation['layoutPath']='assets-src/rooms/scene-layouts.json'
allocation['freeze']={'date':'2026-11-27','task':'T106','loop':122,'revision':1,
    'productionBaseline':production,'acceptedEvidencePublication':publication,
    'preparedSource':'docs/evidence/spec001/layouts-t106/production-fragments.candidate.json',
    'preparedSourceSha256':sha(PREP/'production-fragments.candidate.json'),
    'authority':'Coordinator approved same-loop freeze after accepted local T105 and preparation review',
    'canonicalManifest':'assets-src/manifest.json','manifestSha256AtFreeze':sha(ROOT/'assets-src/manifest.json'),
    'acceptedMediaAdded':0,'productionEvents':[],
    'recordContract':'Future fragment paths below are task-owned destinations, not claims that those files or productions exist. T132 consolidates genuine source/export/rights/review/use records. Support assets, repeated uses and sprite frames never inflate quota identities.'}
for support in allocation['uncountedSupportReservations']:
    support['status']='frozen support reservation; actual source/export/manifest integration pending; counts zero'
allocation['reuseAllocations']=[{'assetId':'spec001:ASSET-ILLUSTRATION-18',
   'uses':[{'roomId':'spec001:R09','use':'delivered-power journal illustration'},
           {'roomId':'spec001:R02','use':'earned SQ02 framed workshop decoration'}],
   'quotaIdentities':1,'acceptedMediaCount':0,'requiredBeforeAcceptance':'Produce actual source and observe both current runtime bindings; retain exact audit text/units and unavailable-image text until integrated'}]
write(ROOT/'assets-src/rooms/scene-layouts.json',layout)
write(ROOT/'assets-src/production-allocation.json',allocation)
print(json.dumps({'status':'promoted frozen authoring plans only','layoutSha256':sha(ROOT/'assets-src/rooms/scene-layouts.json'),
                  'allocationSha256':sha(ROOT/'assets-src/production-allocation.json'),'acceptedMediaAdded':0}))
