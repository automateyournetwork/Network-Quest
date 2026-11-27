# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""Check captured GLB clip envelopes against frozen positions, without modifying any room."""
import json
from itertools import permutations
from pathlib import Path

root=Path(__file__).resolve().parents[3]
raw=root/'docs/evidence/spec001/character-production/T107'
layout=json.loads((root/'assets-src/rooms/scene-layouts.json').read_text())
ids=['CH02','CH04','CH05','CH06','CH07','CH08','CH09']
recruits=['CH04','CH05','CH06','CH07']
envelopes={}
for asset in ids:
    browser=json.loads((raw/f'{asset}-browser.json').read_text())
    bounds=[clip['runtimeSweptBounds'] for clip in browser['clips']]
    envelopes[asset]={'min':[min(b['min'][i] for b in bounds) for i in range(3)],'max':[max(b['max'][i] for b in bounds) for i in range(3)],
                      'sampledClipFrames':sum(b['sampledFrames'] for b in bounds)}
def footprint(asset,position):
    env=envelopes[asset]
    return [position[0]+env['min'][0],position[2]+env['min'][2],position[0]+env['max'][0],position[2]+env['max'][2]]
def overlaps(a,b): return max(a[0],b[0])<=min(a[2],b[2]) and max(a[1],b[1])<=min(a[3],b[3])
native=[];possible=[];checked=0;min_gap=99
for room in layout['rooms']:
    room_id=room['roomId']
    corners=room['authoritativeWalkRegions'][0]['vertices']
    boundary=[min(v['x'] for v in corners),min(v['y'] for v in corners),max(v['x'] for v in corners),max(v['y'] for v in corners)]
    safe=room['authoritativeSafePositions'][0]['point']
    point=[safe['x'],safe['y'],safe['x'],safe['y']]
    candidates=[]
    for placement in room['characterPlacements']:
        asset=placement['characterId'].split(':')[-1]
        if asset not in ids: continue
        box=footprint(asset,placement['position'])
        record={'asset':asset,'room':room_id,'position':placement['position'],'outerScale':[1,1,1],'heightTarget':placement['heightMetres'],
                'sweptXZBounds':box,'insideWalkRectangle':box[0]>=boundary[0] and box[1]>=boundary[1] and box[2]<=boundary[2] and box[3]<=boundary[3],
                'protectsSavedPoint':not overlaps(point,box)}
        assert record['insideWalkRectangle'] and record['protectsSavedPoint'],record
        native.append(record);candidates.append(record)
    slots=room['partyStaging']['positions']
    for a,b in permutations(recruits,2):
        left,right=footprint(a,slots[0]),footprint(b,slots[1])
        gap=right[0]-left[2];min_gap=min(gap,min_gap)
        assert gap>0 and not overlaps(left,point) and not overlaps(right,point)
        checked+=1
    for resident in candidates:
        for i,slot in enumerate(slots):
            for visitor in recruits:
                if visitor!=resident['asset'] and overlaps(resident['sweptXZBounds'],footprint(visitor,slot)):
                    possible.append({'room':room_id,'resident':resident['asset'],'partyCharacter':visitor,'partySlot':i+1})
result={'layout':'assets-src/rooms/scene-layouts.json','freezeCommit':'d7dc4a1','geometry':'Exact GLB vertices transformed in Three.js at each whole exported clip frame; conservative union of all clip AABBs. Source height is the unchanged unit-scale rest height.',
        'sweptMetresYUp':envelopes,'plannedResidentPlacements':native,'orderedWithinBatchRecruitPairsCheckedAcrossRooms':checked,'minimumSideBySideHorizontalGapMetres':min_gap,
        'potentialResidentPartyAabbIntersections':possible,
        'roomIntegration':'T135–140 must inspect actual room geometry, depth, overlapping hotspot access, duplicate resident/party collapse and all nine recruits. A possible AABB intersection does not demonstrate mesh contact. No room placement, saved point or authored navigation was changed.'}
(raw/'staging.json').write_text(json.dumps(result,indent=2)+'\n')
print('Swept envelopes:',len(native),'residents,',checked,'ordered party arrangements, minimum gap',min_gap,'potential resident/party bounds intersections',len(possible))
