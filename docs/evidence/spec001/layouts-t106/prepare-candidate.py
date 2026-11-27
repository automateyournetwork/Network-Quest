#!/usr/bin/env python3
"""T106 isolated design preparation. No canonical media or runtime file is written.

Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0.
The projected boxes are layout envelopes, not models or accepted visual evidence.
"""
import collections
import hashlib
import html
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
OUT = Path(__file__).resolve().parent


def read(path):
    return json.loads((ROOT / path).read_text())


def write(name, value):
    (OUT / name).write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n")


def file_record(path):
    data = (ROOT / path).read_bytes()
    return {"path": path, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def sid(value):
    return "spec001:" + value


def normalize(v):
    length = math.sqrt(sum(n * n for n in v))
    return [n / length for n in v]


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def project(point, camera, aspect=16/9):
    # Same orthographic lookAt/up and dynamic span rule as the existing renderer.
    back = normalize([a-b for a, b in zip(camera['position'], camera['target'])])
    right = normalize(cross([0, 1, 0], back))
    up = cross(back, right)
    delta = [a-b for a, b in zip(point, camera['target'])]
    h = max(camera['minimumHeightSpan'], camera['span']/aspect)
    return [round(.5+sum(a*b for a, b in zip(delta, right))/(h*aspect), 6),
            round(.5-sum(a*b for a, b in zip(delta, up))/h, 6)]


world = read('content/spec001/world.json')
manifest = read('assets-src/manifest.json')['assets']
assets = {a['assetId']: a for a in manifest}
plan = read('assets-src/audio/production-plan.json')
rooms = [read(f'content/spec001/rooms/R{i:02}.json') for i in range(1, 13)]
names = {r['id']: r['name'] for r in world['rooms']}
prop_roster = {p['id']: p for p in world['props']}
char_roster = {p['id']: p for p in world['characters']}
grayboxes = {r['roomId']: r for f in ['introduction-graybox', 'first-route-graybox']
             for r in read(f'content/spec001/presentation/{f}.json')['rooms']}
r01 = read('content/spec001/presentation/R01.json')
r01placements = read('assets-src/rooms/R01-placements.json')
r01registration = read('assets-src/rooms/R01-registration.json')

# x, logical floor y, ground/base height, width, depth, height. These are explicit
# composition envelopes, not fabricated measurements of unproduced Blender assets.
# R01's authored transforms are imported unmodified below; its bounds remain sourced
# to existing native inspections rather than these future-production envelopes.
ENVELOPES = {
 'R02': [(2,1.3,0,2.6,1.2,1.05),(7.3,1.55,0,2.6,1.3,.95),(-.45,1.6,0,.8,.7,2.2),
         (9.3,3.5,0,.8,.6,1.2),(1.2,3.5,0,.6,.6,1.2),(7.15,4.7,0,1,.5,1.65),
         (9.25,.5,0,1,.6,1.7),(4.5,.1,0,1.5,.3,1.8),(.5,4.85,0,.9,.9,1.1),
         (1.9,-1.15,0,3.1,1.5,3.3)],
 'R03': [(.8,1,0,1.15,.65,1.3),(3.2,.35,0,1.4,.45,1.65),(1.4,4.6,0,1.3,1.1,1.15),
         (7.6,4.85,0,1.65,.75,.65),(1.15,2.4,0,.75,.65,.9),(8.85,.5,0,1.3,.9,1.35),
         (8.8,1.6,0,.95,.5,1.2),(2.8,4.6,.75,.5,.4,.45),(7.85,2.65,0,1.2,.8,1.1),
         (6.05,.4,0,1.15,.6,1.4)],
 'R04': [(2.4,1.25,0,1.65,.9,1.2),(1,3.65,0,.8,.7,1.4),(8.25,2,0,1.3,.9,1.15),
         (9.3,.6,0,1,.45,1.4),(2.1,5.2,0,1.1,.6,1.8),(6.2,.35,0,1.5,.55,1.3),
         (3.6,.35,0,1,.55,1.6),(1.1,1.1,0,1.1,.75,.95),(4.5,1.4,0,1,.55,1.3),
         (8.5,4.35,0,1.4,.8,1.25)],
 'R05': [(.4,.3,0,1.3,.8,2.9),(2,.4,0,1.2,.6,2.1),(2,4.6,0,1.4,.9,1.1),
         (3.6,4.8,0,1,.65,1),(7.8,.45,0,1.8,.6,1.5),(1.2,2.4,0,1.2,.55,1.2),
         (8.8,2.1,0,.85,.65,1.1),(6.4,4.8,0,.9,.8,.85),(7.9,4.5,0,1.2,.9,1.25),
         (4.4,.45,0,.7,.6,1.65)],
 'R06': [(4.8,.1,0,1.6,.8,2.1),(6.65,.45,0,1.1,.6,1.3),(8.6,.25,0,1.15,.4,2),
         (1.2,2.1,0,1,.65,1.2),(1.2,4.6,0,1.2,.75,.9),(3.1,4.8,0,.85,.6,.95),
         (7.7,2.7,0,1,.6,1.45),(9.5,3.9,0,.7,.4,2.2),(6.1,4.7,0,1.2,.7,1.1),
         (7.7,4.75,0,.9,.6,.95)],
 'R07': [(7.9,.4,0,1.65,1,2.1),(9.5,-.5,0,.65,.65,3.4),(6.2,2.25,0,1,.65,1.35),
         (3.4,.6,0,2.2,.9,1.1),(1,.35,0,.75,.6,1.4),(1.2,4.7,0,1.3,.65,1.2),
         (8.3,4,0,.8,.6,1.4),(4.75,-.1,0,.65,.3,2.2),(.6,2.4,0,1,.75,1.5),
         (6.2,4.8,0,1.3,.7,1.15)],
 'R08': [(1.6,-.2,0,1.8,.9,2.2),(8.7,2,0,1.05,.75,1.3),(7.7,.4,0,1.5,.75,1.5),
         (2.3,4.7,0,1,.65,1.25),(5,.3,0,1,.75,1.4),(.3,.4,0,.6,.5,2.6),
         (9.3,.3,0,1.05,.55,1.65),(8.6,4.3,0,.85,.65,1.35),(1.1,2.4,0,.95,.65,1.25),
         (6.8,4.7,0,1.6,.85,1.15)],
 'R09': [(1.45,.65,0,2,.8,1.5),(4,.6,0,1.15,.8,1.3),(6,.6,0,1.3,.8,1.3),
         (9.8,1.4,0,1.15,.85,1.3),(10.35,3.35,0,1.2,.8,1.1),(1.1,4.9,0,1.1,.75,1.2),
         (3,5.8,0,1.1,.55,1.4),(7.7,.2,0,1.25,.4,1.75),(8.65,5.35,0,1,.65,1.25),
         (4.5,5.6,0,2.5,.95,1.05)],
 'R10': [(5.7,-.1,0,2.4,.85,2.8),(2,4.75,0,1.8,.9,1.25),(1.35,1.5,0,1.35,.8,1.2),
         (8.7,4.6,0,1.6,.9,1.35),(10.45,1,0,.8,.55,1.35),(3.1,1.1,0,1,.65,1.45),
         (8,.45,0,1.35,.65,1.7),(11.3,5.7,0,.7,.45,2.2),(4.4,5.8,0,.85,.6,1.15),
         (6.9,5.65,0,1.25,.75,1.45)],
 'R11': [(5.8,-.75,0,4,1.4,.4),(4.25,.35,0,1.5,.75,1.2),(6.15,.45,0,1.6,.7,.75),
         (10,1,0,1.3,1,2),(9.6,5.1,0,1.8,1,1.1),(2.3,5.1,0,1.8,.9,1.25),
         (1.2,1.3,0,1.25,.4,1.05),(6.3,4.7,0,1.2,.8,1.25),(7.9,3.05,0,.85,.65,1.5),
         (4.35,5.8,0,.8,.4,1.5)],
 'R12': [(6,-.9,0,3.4,.7,3.4),(9.75,1.15,0,.8,.7,2.1),(3.1,4.7,0,1.5,.9,1.2),
         (11.3,3.25,0,.8,2,.8),(7.85,4.9,0,1.65,.35,1.9),(9.9,5.65,0,1.2,.4,1.65),
         (1.1,2.65,0,.8,.7,1.6),(6.1,5.5,0,.85,.7,1.2),(.3,5.6,0,.65,.45,2.3),
         (4,.1,0,1.25,.4,1.15)],
}

# Every room has its own intent and view; these are camera candidates for keyframe
# inspection, not an assertion that absent artwork has already been registered.
DESIGNS = {
 'R01': ('A small landing suspended over an immense, patient machine.', 'Power and link remain separate; Photon introduces the path without hiding either lamp.', [12,13,16],[5,1,3],13,9,
         ['Rear lift and two separate indications','Central apprentice and clear landing','Right conduit and workshop door','Sparse foreground satchel and capsule']),
 'R02': ('A furnace cathedral with a mentor who files his miracles alphabetically.', 'Titan and warm bench left; relief table right; three equal route emblems; six honest doorways.', [11.5,12.5,18],[5,1,3],13.5,9.5,
         ['Furnace and Titan workshop','Two endpoint cards on one topology table','Hypothesis and equal route easels','Shared preparation doors']),
 'R03': ('Copper roots twist through stone; an officious pair of whispers has filed a complaint.', 'Keep the open original spool and both valid repair paths in one glance; motor noise is atmosphere, not an EMI reading.', [11.5,10.5,18.5],[5,1,3],13.5,9,
         ['Broken spool and before record','Replacement elbow and alternate wheel','Continuity pedestal','Twins beside the unmeasured motor']),
 'R04': ('Blue arches carry echoes; the Tortoise runs a post office with admirable lack of urgency.', 'Two evidence stations flank a clear sprite acting lane; telegraph, connector display and printer form a recognizable right-hand post office.', [7.5,8.8,19],[5,1,3],13,9,
         ['Before/after copper comparison','Repeater and ladder exhibit','Tortoise serial post','Bat roost above clear sprite lane']),
 'R05': ('A glass-root garden blooms with borrowed light; no flower promises to carry electricity.', 'Inspection dock in a warm foreground pool, compatible shelf opposite, Unicorn/Hydra folded clear of the path.', [11,11.5,17.5],[5,1,3],13.5,9.5,
         ['Connector dock and cleaning tools','Compatible shelf and receiver','Bent/broken fiber exhibits','Unicorn, Hydra and Photon garden edge']),
 'R06': ('A violet vault weighs light with the solemnity of a very small accountant.', 'Separate path loss, receiver window and budget; prism beauty must not imply a guaranteed data lane.', [8.5,10,19],[5,1,3],13.5,9.5,
         ['Prism and wavelength backdrop','Passive-path controls','Receiver limits and meter','Budget abacus and Hermit counter']),
 'R07': ('An indigo chimney opens to impossible sky; Thunderbird has a surprisingly strict surveying license.', 'Show antenna direction and the actual sight corridor; settings cards and the alignment scope remain distinguishable.', [10.8,9.5,20],[5,1,3],13.5,9.5,
         ['Clear antenna sight corridor','Alignment and clearance model','Endpoint settings and terminal','Thunderbird ledge and short-range exhibit']),
 'R08': ('Rain fingers the observatory glass while the Noise Demon insists it is merely rehearsing.', 'Current meter, historical drum and diary occupy separate stations; clouds are context, never a measured cause.', [8.8,10.3,19.5],[5,1,3],13.5,9.5,
         ['Distant dish and comparative window','Present noise and isolate switch','History drum and weather diary','Channel scout desk and waiting creatures']),
 'R09': ('Shell stalls trade in things that fit, and things that only look as though they ought to.', 'A horseshoe market separates module fit from delivered power; the large party assembles at the front without concealing counters.', [13.5,13,20],[6,1,3.5],15.5,10.5,
         ['Module cages and compatibility wall','Power injector, endpoint tiles and ledger','Telephone/coax history booths','Loan counter and clear central aisle']),
 'R10': ('A brass monument ticks with enormous confidence; nobody requires the apprentice to keep time.', 'Symbol loom and capability console are separate untimed alcoves; clock recovery does not masquerade as NTP.', [12,12.3,20.5],[6,1,3.5],15.5,10.5,
         ['Master wheel behind the sample exhibits','Loom and symbol key','Common-capability console','Quiet infrared alcove and onward door']),
 'R11': ('A spectacular trench, an embarrassed excavator, and a very deliberate chance to think.', 'Three equally legible physical repair stations; warning, review and execute are separate; every permitted preparation return stays visible.', [13,11.7,21],[6,1,3.5],16,11,
         ['Severed conduit beyond safe barrier','Copper, fiber and radio alternatives','Warning then review lectern','Control post and permanent preparation exits']),
 'R12': ('Beyond a restored balcony, the Iron City waits behind a door that is honest about being next chapter.', 'Fresh link and independent endpoint checks are different stations; outcome folio changes only from authoritative evidence.', [11.8,11.5,21.5],[6,1,3.5],15.5,10.5,
         ['Closed future gate and explicit plaque','Fresh validation terminal and link totem','Maintenance folio and seal','Visible return arch and mentor recess']),
}

# Original room character placements; CH01 is independently included at each exact
# saved arrival. Repeated character use counts one identity, including CH24's pair.
CHARACTERS = {
 'R02': {'CH02':(1.1,3,2.6),'CH12':(8.8,3.45,1.9)},
 'R03': {'CH04':(3.3,3.5,1.1),'CH24':(9.2,2.8,1.4)},
 'R04': {'CH13':(7.4,3.3,1.1),'CH20':(4.9,-.5,1.5)},
 'R05': {'CH03':(2.75,3.2,.45),'CH05':(3.5,1.7,2),'CH06':(7.3,1.7,2.2)},
 'R06': {'CH16':(5,4.8,.8),'CH18':(2.7,.6,1.65)},
 'R07': {'CH07':(7.6,1.9,2.1),'CH08':(2.8,4.7,1.45)},
 'R08': {'CH10':(6.1,1.4,1.9),'CH11':(3.1,.55,1.8),'CH23':(7.25,3,1.4)},
 'R09': {'CH14':(2.65,3.9,1.2),'CH15':(1.5,3.6,1.2),'CH16':(3.5,2.2,.8),
         'CH17':(7.3,2.4,1.7),'CH19':(9.3,4.2,1.1)},
 'R10': {'CH09':(9.7,2.5,.65),'CH21':(4.5,1.3,2),'CH22':(7.5,4.3,.8)},
 'R11': {'CH25':(9,-1.8,3.2)},
 'R12': {'CH02':(8,1.5,2.6),'CH03':(3.5,3.2,.45),'CH12':(10,3.6,1.9)},
}

# PR121–150 retain all thirty separate names. Mounting to an existing prop is a
# reusable physical placement, never a second copy of the parent's modeled ID.
# The shared props have no current standalone room hotspot: all count as planned
# visible set dressing/tool use until an actual meaningful placement is observed.
SHARED = [
 ('R02',121,'PR011',(.5,1.1,.0),'Open apprentice notebook on the bench; UI notebook remains authoritative'),
 ('R03',122,'PR029',(0,1.15,0),'Continuity tester with two independently visible lead ends'),
 ('R06',123,'PR060',(0,1,0),'Removable optical meter seated in its separate cradle'),
 ('R08',124,'PR080',(.25,1.2,0),'Channel analyzer on the survey desk; readings supplied by state'),
 ('R03',125,'PR023',(.25,.9,-.2),'Probe rests beside diagnosed cable, never visibly bridges it'),
 ('R05',126,'PR043',(.3,1.15,0),'Inspection lens on dock arm'),
 ('R05',127,'PR044',(0,1.05,.05),'Cleaning wand in a distinct side holder'),
 ('R03',128,'PR024',(.2,.7,0),'Crimp tool with articulated jaws on the supplied-stock shelf'),
 ('R11',129,'PR105',(.35,1.15,0),'Splice tool laid open on fiber worktable'),
 ('R02',130,'PR011',(-.6,1.1,0),'Insulated gloves folded beside tools, not a power/link verdict'),
 ('R11',131,None,(3.05,0,1.2),'Warning cone at safe side of trench inspection area'),
 ('R11',132,'PR106',(.4,1.3,0),'Repair clamp secured to bypass frame'),
 ('R03',133,'PR024',(-.45,.7,0),'Cable tie bundle hangs from tray support'),
 ('R04',134,None,(.35,0,5.75),'Closed floor junction box at the ledge edge, outside the clear acting lane'),
 ('R04',135,None,(5.4,3.25,-.5),'Distinct ceramic ceiling insulator over the repeater feed'),
 ('R02',136,None,(5,3.5,-.25),'Hanging workshop lamp above the board; does not obscure labels'),
 ('R07',137,'PR062',(-.25,0,.1),'Maintenance ladder fixed beside the mast, no required climbing'),
 ('R10',138,None,(.1,0,3.4),'Closed service hatch in the left wall, off the central route'),
 ('R02',139,'PR020',(1.1,.7,.2),'Pipe valve on furnace return; handle distinct from whole furnace'),
 ('R09',140,'PR084',(-.25,1.35,0),'Crystal battery demonstrator beside the injector, labeled fictional power source'),
 ('R09',141,'PR090',(.8,1.1,0),'Fuse cartridge in a small separated tray'),
 ('R09',142,'PR084',(.4,.3,.25),'Grounding braid attached to equipment stand; not a data path'),
 ('R11',143,None,(10.9,0,5.6),'Equipment case against fiber station return wall'),
 ('R02',144,None,(.8,0,1.8),'Bench stool tucked beside rather than across the aisle'),
 ('R09',145,'PR090',(-.75,1.1,0),'Spare connector tray with clearly different shell cutouts'),
 ('R02',146,'PR012',(.65,1.0,.3),'Map scroll beside raised topology, no extra route-authority'),
 ('R02',147,'PR013',(0,1.2,.4),'Maintenance key hangs from cabinet hook; no new required pickup'),
 ('R03',148,'PR023',(-.4,1.1,.15),'Evidence tag on original spool; text is readable in existing Look'),
 ('R05',149,'PR044',(.4,1.1,-.15),'Magnifying visor hangs beside cleaning station'),
 ('R12',150,'PR113',(.4,1.25,0),'Message test token beside terminal; known pattern stays semantic text'),
]

EXIT_POINTS = {
 'R01': [(9.35,2.3)],
 'R02': [(.2,3),(1.15,5.8),(4,5.8),(6.3,5.8),(9.8,2.55),(9.8,4.9)],
 'R03': [(.25,5.8),(9.75,5.8)], 'R04': [(3.5,5.8),(9.75,5.8)],
 'R05': [(.25,5.8),(9.75,5.8)], 'R06': [(.25,5.8),(9.75,5.8)],
 'R07': [(.25,5.8),(9.75,5.8)], 'R08': [(.25,5.8),(9.75,5.8)],
 'R09': [(6,6.8)], 'R10': [(.25,6.7),(11.7,6.7)],
 'R11': [(.25,1.6),(.25,4.2),(11.75,1.6),(11.75,4.2),(6,6.75)],
 'R12': [(.25,6.7)],
}

CONFLICTS = [
 {"id":"LAYOUT-01", "state":"requires finished-room integration", "subjects":["R09","R10","R11","R12"],
  "finding":"Room walk polygons are 12 by 7; shared graybox parser constrains object points to x<=10,y<=6 and draws a 10 by 6 floor. Current camera target [5,1,3] is repeated from smaller rooms.",
  "decision":"Use the authoritative 12 by 7 polygons and preserved [6,2] safe positions for candidate geometry. T105 may verify existing functional actions but cannot certify complete visible movement space from that graybox. T133–140 and T147 must verify actual finished geometry, all exits, protected saved arrivals and navigation. Do not shrink room contracts to match temporary art.",
  "evidence":["src/presentation/introduction-graybox.ts","content/spec001/presentation/first-route-graybox.json"]},
 {"id":"LAYOUT-02", "state":"bounded production instruction", "subjects":["PR034","PR040","PR108"],
  "finding":"Current hotspot labels emphasize a route notice, hint slate and intervention review. The fixed model roster requires serial connector display, antique message printer and excavation permit lectern.",
  "decision":"Model those exact three identities. Mount the route notice on PR034, print the hint/comparison strip from PR040, and place the reviewed intervention/permit sheet on PR108. Keep every hotspot/action/evidence ID and current technical text. No replacement generic sign/slate or extra quota asset.",
  "evidence":["content/spec001/rooms/R04.json","content/spec001/rooms/R11.json","SPEC.md"]},
 {"id":"LAYOUT-03", "state":"root provisionally approved for freeze; runtime uses pending", "subjects":["ASSET-ILLUSTRATION-18","SQ02","R02","R09"],
  "finding":"Production plan allocates delivered-power ledger to R09 journal; authored SQ02 reward is the same stable asset as a workshop decoration in R02. Actual image is absent.",
  "decision":"One original illustration18 with R09 journal use and R02 framed display use, counted once. Reserve space above PR011 beside PR018, without obscuring either. Both observed runtime bindings and real image lineage are required before accepting T097/full quota. Root provisionally approved this bounded reuse on 2026-11-27; freeze still waits T105.",
  "evidence":["assets-src/audio/production-plan.json","content/spec001/quests/SQ02.json","src/state/optional-power-audit.ts"]},
 {"id":"LAYOUT-04", "state":"production and use pending", "subjects":["ASSET-ILLUSTRATION-08","ASSET-ILLUSTRATION-16"],
  "finding":"SQ01 reward08 and SQ03 optional diary16 already have matching allocated identities and text alternatives; pictures remain planned.",
  "decision":"Produce actual08 message-strip and16 diary originals under their existing identity, preserve captions. Reward availability remains honest until files are integrated; no generated-image claim or extra asset identity.",
  "evidence":["content/spec001/quests/SQ01.json","content/spec001/quests/SQ03.json","assets-src/audio/production-plan.json"]},
 {"id":"LAYOUT-05", "state":"candidate allocation only", "subjects":["PR121–PR150"],
  "finding":"All thirty shared IDs exist in the world/manifest but have no current room propInstances or standalone hotspot subjects.",
  "decision":"Give every shared ID one named physical candidate placement, usually on an existing station. Count none as current interactive props or accepted media. T116 creates distinct editable sources; T135–140 adds observed room uses without introducing new required inventory gates.",
  "evidence":["content/spec001/world.json","assets-src/manifest.json"]},
 {"id":"LAYOUT-06", "state":"integration required", "subjects":["CH01","CH24","CH25","party"],
  "finding":"Current room characterIds are encounter registries; CH01 is only explicitly listed in R01, R12 mentor characters have no dedicated hotspot, and recruit presentation follows separate party state.",
  "decision":"Place existing CH01 at each saved arrival; model CH24 as one paired identity. Keep Backhoe beyond the safe platform and its hotspot selectable. Reserve two party positions per room, suppress a duplicate world instance when that recruit is already the active presented subject, and never hide NPC/prop evidence. Verify identity, ability clips and simultaneous party costs at integration.",
  "evidence":["content/spec001/world.json","assets-src/art-direction.md","content/spec001/rooms/R12.json"]},
 {"id":"LAYOUT-07", "state":"historical prose superseded by explicit owner approval", "subjects":["contained frame","audio auditions"],
  "finding":"T062 art direction contains earlier below-stage controls and pending audio audition prose. Later owner record accepts in-frame controls and unchanged twelve audio candidates on speakers and earbuds.",
  "decision":"Use the approved contained 286 frame, Walk/Look/Talk/Use bar and contextual Scene/Evidence/Notebook/Inventory overlays. No new listening approval for unchanged audition packet; new full music/ambience/effects/voice work still needs actual audition/reopen/use evidence.",
  "evidence":["docs/evidence/spec001/presentation/owner-frame-approval-2026-11-26.md","docs/implementation/state.json","assets-src/art-direction.md"]},
 {"id":"LAYOUT-08", "state":"later keyframe/source review required", "subjects":["R02–R12","CH02","CH04–CH25"],
  "finding":"Numerical envelopes and orthographic projections cannot demonstrate finished native silhouettes, source/plate registration or visual occlusion.",
  "decision":"Freeze only after T105 reconciliation/root GO. Then inspect Workshop/Titan and copper/fiber keyframes before multiplying designs; create each room camera/registration and actual Blender/image sources. Inspect overlap, alpha edges, aspect, safe paths and text access in the finished adapters. Preparation figures are explicitly uncounted.",
  "evidence":["assets-src/art-direction.md","specs/001-physical-layer-underworld/tasks.md"]},
 {"id":"LAYOUT-09", "state":"support records required before runtime integration", "subjects":["ASSET-ARCH-R02–R12","R04 sprite sheets"],
  "finding":"All 380 required quota identities are reserved. Only R01 has a separate architecture manifest entry. R04 rendered sprite-sheet artifacts are not reserved yet.",
  "decision":"Reserve eleven candidate room-architecture IDs and three R04 sprite-sheet IDs as uncounted support artifacts. Actual room-source/export choice may consolidate architecture into scenes, but every integrated file needs traceable provenance. R04 sheets derive from existing CH01/CH13/CH20 Blender identities, never three additional characters or scene layers. T132/T133–140 reconcile actual records.",
  "evidence":["assets-src/manifest.json","tools/asset-types.ts","specs/001-physical-layer-underworld/tasks.md"]},
 {"id":"LAYOUT-10", "state":"measured R01 dimensions take precedence over T062 proposal", "subjects":["CH01","CH03"],
  "finding":"T062 proposed Apprentice height 1.65 m. Actual retained CH01 source bounds extend to 1.775000095 m; Photon source geometry includes its authored hover offset and spans z=0.929999948–1.571999907 m.",
  "decision":"Preserve existing unit-scale sources and their measured bounds; do not resize CH01 or apply a second Photon hover translation to satisfy a proposed scale. Character candidate anchors explicitly distinguish root, body scale and visible source extent.",
  "evidence":["assets-src/rooms/CH01-source-inspection.json","assets-src/rooms/CH03-source-inspection.json","assets-src/rooms/R01-production-settings.json"]},
]

candidate_rooms = []
for index, room in enumerate(rooms):
    short = room['id'].split(':')[1]
    mood, aim, position, target, span, minheight, groups = DESIGNS[short]
    camera = {"projection":"orthographic","position":position,"target":target,"up":[0,1,0],
              "near":.1,"far":80,"span":span,"minimumHeightSpan":minheight,
              "resizeRule":"heightSpan=max(minimumHeightSpan,span/aspect); widthSpan=heightSpan*aspect",
              "plateSpan":[round(minheight*16/9,6),minheight],"basePlatePixels":[1280,720],
              "blenderPosition":[position[0],-position[2],position[1]],
              "blenderTarget":[target[0],-target[2],target[1]],
              "status":"preserve actual R01 registration" if short=='R01' else "unfrozen candidate; inspect keyframe before plates"}
    if short=='R01':
        camera.update({k:v for k,v in r01['camera'].items()})
    placements=[]
    for number in range(index*10+1,index*10+11):
        propid=sid(f'PR{number:03}')
        record=prop_roster[propid]
        if short=='R01':
            source=next(p for p in r01placements['props'] if p['semanticId']==propid)
            pos=source['runtimePosition']
            envelope=None
        else:
            x,y,z,w,d,h=ENVELOPES[short][number-index*10-1]
            pos=[x,z,y]
            envelope={"width":w,"depth":d,"height":h,"status":"design envelope; not measured model bounds"}
        bound=[h for h in room['hotspots'] if h['subjectId']==propid]
        placements.append({"instanceId":f"{short.lower()}-pr{number:03}","semanticId":propid,"assetId":sid(f'ASSET-PR{number:03}'),
            "sourceName":record['name'],"sourceAllocation":record['allocation'],"position":pos,"candidateEnvelope":envelope,
            "outerScale":[1,1,1],"orientationPolicy":"Model fronts face camera/evidence approach; R01 preserves exported child transforms; record actual quaternion at source production",
            "hotspotIds":[h['id'] for h in bound],"interactiveCandidate":bool(bound),
            "currentRuntimeAssetId":next(p['assetId'] for p in room['propInstances'] if p['propId']==propid),
            "canonicalAssetStatus":assets[sid(f'ASSET-PR{number:03}')]['status'],"countsTowardAcceptedQuota":False,
            "status":"existing R01 transform retained" if short=='R01' else "planned source/placement; not integrated"})
    for allocation,n,parent,xyz,purpose in SHARED:
        if allocation!=short:continue
        semantic=sid(f'PR{n:03}')
        if parent:
            host=next(p for p in placements if p['semanticId']==sid(parent))
            pos=[round(a+b,4) for a,b in zip(host['position'],xyz)]
        else:pos=list(xyz)
        placements.append({"instanceId":f"{short.lower()}-pr{n:03}","semanticId":semantic,"assetId":sid(f'ASSET-PR{n:03}'),
            "sourceName":prop_roster[semantic]['name'],"sourceAllocation":"Shared","position":pos,
            "mountedToInstanceId":f"{short.lower()}-{parent.lower()}" if parent else None,"placementPurpose":purpose,
            "candidateEnvelope":None,"hotspotIds":[],"interactiveCandidate":False,"currentRuntimeAssetId":None,
            "canonicalAssetStatus":"planned","countsTowardAcceptedQuota":False,"status":"planned visible placement; no current room propInstance"})
    safe=room['safePositions'][0]['point']
    chars=[{"characterId":sid('CH01'),"assetId":sid('ASSET-CH01'),"name":char_roster[sid('CH01')]['name'],
            "position":[safe['x'],0,safe['y']],"role":"player at unchanged authoritative safe arrival","heightMetres":1.7750000953674316,
            "sourceBoundsReference":"assets-src/rooms/CH01-source-inspection.json","outerScale":[1,1,1],
            "status":"retained source identity; additional room use awaits integration"}]
    if short=='R01':
        c=r01placements['characters'][1]
        chars.append({"characterId":sid('CH03'),"assetId":c['assetId'],"name":char_roster[sid('CH03')]['name'],
                      "position":c['runtimePosition'],"heightMetres":1.5719999074935913,"anchorHeightMetres":1.15,
                      "bodyHeightProposalMetres":.45,"sourceHoverAlreadyAuthored":True,"outerScale":[1,1,1],
                      "sourceBoundsReference":"assets-src/rooms/CH03-source-inspection.json","status":"existing source transform retained"})
    else:
        for char,(x,y,h) in CHARACTERS[short].items():
            chars.append({"characterId":sid(char),"assetId":sid('ASSET-'+char),"name":char_roster[sid(char)]['name'],
                "position":[x,0,y],"heightMetres":h,"status":"candidate identity-specific envelope; source dimensions need production review"})
            if char=='CH03':
                chars[-1].update({'heightMetres':1.5719999074935913,'anchorHeightMetres':1.15,'sourceHoverAlreadyAuthored':True,
                                  'sourceBoundsReference':'assets-src/rooms/CH03-source-inspection.json','outerScale':[1,1,1]})
    hotspots=[]
    for order,hotspot in enumerate(room['hotspots']):
        subject=hotspot['subjectId']
        p=next((p for p in placements if p['semanticId']==subject),None)
        character=next((c for c in chars if c['characterId']==subject),None)
        if short=='R01':
            old=next(a for a in r01registration['anchors'] if a['semanticId']==hotspot['id'])
            anchor=old['runtimeWorld']
        elif p:
            h=p['candidateEnvelope']['height']
            anchor=[p['position'][0],p['position'][1]+h*.8,p['position'][2]+.1]
            # One physical table, two semantic targets: separate endpoint and path areas.
            if hotspot['id']==sid('HOTSPOT-endpoints'):anchor[0]-=.7
            if hotspot['id']==sid('HOTSPOT-declared-path'):anchor[0]+=.7
            if subject==sid('PR101'):anchor=[4.5,.2,-1.2]
        else:
            anchor=[character['position'][0],character.get('anchorHeightMetres',character['heightMetres']*.65),character['position'][2]]
        uv=project(anchor,camera)
        hotspots.append({"id":hotspot['id'],"subjectId":subject,"label":hotspot['label'],"verbs":hotspot['verbs'],
            "actionIds":hotspot['actionIds'],"evidenceIds":hotspot['evidenceIds'],"semanticOrder":order+1,
            "anchorWorld":anchor,"uvAt16by9":uv,
            "candidateSelectRegion":{"type":"screen-space semantic target around projected anchor", "minimumCssPixels":[44,44],
                                     "overlapPolicy":"When footprints overlap, select one labeled subject through contained Scene list; never silently choose a different subject"},
            "readableEvidenceSource":f"content/spec001/rooms/{short}.json#hotspots/{order}",
            "textAlternative":hotspot['description'],"occlusionRule":"No opaque foreground or character over this label/target; outline subject or fade edge on selection; full text remains in contained Scene/Evidence panel",
            "status":"semantic target preserved; projected candidate is not native pixel/target-size evidence"})
    exits=[]
    for exit_,(x,y) in zip(room['exits'],EXIT_POINTS[short]):
        ident=f"exit:{room['id']}:{exit_['toRoomId']}"
        if short=='R01':
            old=next(o for o in grayboxes[room['id']]['objects'] if o['id']==ident)
            x,y=old['point']
        exits.append({"id":ident,"toRoomId":exit_['toRoomId'],"label":exit_['label'],"point":[x,y],
                      "anchorWorld":[x,1.4,y],"uvAt16by9":project([x,1.4,y],camera),
                      "walkRegionId":exit_['walkRegionId'],"availability":"unchanged authoritative route/encounter projection; no artwork grants passage"})
    width=max(p['x'] for p in room['walkRegions'][0]['vertices'])
    depth=max(p['y'] for p in room['walkRegions'][0]['vertices'])
    # No collision engine or free-walk change is invented here. The separate
    # envelope study records bent approach paths; authoritative safe positions and
    # region vertices remain exact copies of the current contracts.
    guide={"status":"non-authoritative visual clearance proposal; not a new movement rule",
           "safeArrivalRadiusMetres":.6,
           "candidateApproachesFile":"source-and-walk-review.json",
           "minimumClearWidthMetres":.8,
           "rule":"Keep the saved arrival clear. After source envelopes are final, trace a visibly clear approach to each station/exit; preserve authoritative safe IDs, do not create new blockers or require precision walking."}
    candidate_rooms.append({"roomId":room['id'],"name":names[room['id']],"status":"preparation candidate; not frozen",
        "currentPresentationMode":room['presentationMode'],
        "productionMode":"realtime-3d" if short in ['R01','R02'] else 'rendered-sprites' if short=='R04' else 'layered-with-realtime-focal-assets',
        "composition":{"mood":mood,"focus":aim,"groups":groups,"palette":"warm practical key; cool basalt/room-specific fill; text/value/status never encoded only in hue",
                       "framing":"fixed composed view inside approved 286 monitor; no mandatory pan, zoom, reflex timing or parallax",
                       "quietSpace":"clear central arrival and contextual action strip; no full-screen dashboard of evidence cards"},
        "camera":camera,"authoritativeWalkRegions":room['walkRegions'],"authoritativeSafePositions":room['safePositions'],
        "registration":{"plannedCameraPath":f"assets-src/rooms/{short}-camera.json",
                        "plannedRegistrationPath":f"assets-src/rooms/{short}-registration.json",
                        "coordinateAnchors":[{"name":f"floor-corner-{n+1}","world":[v['x'],0,v['y']],
                                              "uvAt16by9":project([v['x'],0,v['y']],camera)}
                                             for n,v in enumerate(room['walkRegions'][0]['vertices'])],
                        "hotspotAnchors":"Every hotspot below has the same camera-projected world/UV anchor; exits are registered separately",
                        "layerOrder":["background distant plate","midground behind focal actors/evidence","focal realtime meshes or camera-matched R04 sprites","foreground edge-only frame"],
                        "alpha":"Straight alpha exports; inspect fringes over light and dark backgrounds; actual masks/source registration pending for non-R01",
                        "tolerance":"Initial <=2 CSS pixel source/plate/hotspot registration goal from art direction; this candidate supplies no new measured tolerance/visual acceptance"},
        "visualWalkGuide":guide,"exits":exits,"propPlacements":placements,"characterPlacements":chars,
        "partyStaging":{"capacity":2,"positions":[[safe['x']-.95,0,safe['y']+1.05],[safe['x']+.95,0,safe['y']+1.05]],
            "policy":"Presentation only; scale from approved character source, not per-room resize. Collapse duplicate resident/party representation, inspect large Hydra/Eel envelopes, keep all evidence and exits selectable; no party required for the ordinary tool route."},
        "hotspots":hotspots,
        "occlusion":{"status":"conservative proposed masks; actual image alpha/depth masks not yet produced except R01",
           "foregroundOpaqueAllowRegionsUV":[[[0,.78],[.045,.94],[.045,1],[0,1]],[[.955,.94],[1,.78],[1,1],[.955,1]]],
           "unrestrictedEvidenceZoneUV":[[.05,.06],[.95,.06],[.95,.94],[.05,.94]],
           "rule":"Only edge wedges may be opaque in the initial plate. No baked readable text. Midground branches/struts remain behind focal subjects; derived masks count zero. R01 uses current registered layer alpha and preserves its accepted composition.",
           "selectedTarget":"fade obstructing decorative edge or show clear outline and real label; never hide measurement/exit; actual adapter work pending T133/T134",
           "reducedMotion":"stable poses, no camera/parallax/pulsing dependence; immediate semantic feedback; hidden tab pauses presentation only"},
        "plannedSceneLayerIds":[v['assetId'] for v in plan['sceneLayers'] if v['roomId']==room['id']],
        "plannedIllustrationIds":[v['assetId'] for v in plan['illustrations'] if v['roomId']==room['id']],
        "plannedAudioIds":{key:[v['assetId'] for v in plan[key] if v['roomId']==room['id']] for key in ['music','ambience','effects','voices']},
        "access":{"labels":"all existing hotspot/exit labels remain semantic HTML inside contextual Scene panel; W/L/T/U and Tab/Enter parity, keyboard focus visible",
                  "touch":"44 CSS pixel minimum target proposal; when scene targets cannot fit separately use explicit contained object list and one selection before action, never hover-only",
                  "zoom":"200% text/390 and768 widths retain all text/actions via in-frame scrolling panels; full composition fit/letterboxed rather than crop required exits",
                  "muted":"captions/text from exact current lines; separate power/link and signal/noise labels remain readable; audio never advances state",
                  "pending":"native finished-room keyboard/touch/200%/reduced-motion and assistive-technology inspection; these statements are requirements, not passed tests"}})

# Reconcile named source rosters to current contracts. This reports model identities,
# not finished quotas. Root SPEC and active feature tables must agree exactly.
def parse_prop_table(path):
    lines=(ROOT/path).read_text().splitlines()
    start=next(i for i,line in enumerate(lines) if 'Prop allocation: 150 distinct assets' in line)
    result=[]
    for line in lines[start:]:
        if line.startswith('| R') or line.startswith('| Shared'):
            parts=[s.strip() for s in line.split('|')[1:-1]]
            result += [(parts[0],name.strip()) for name in parts[2].split(';')]
        if len(result)==150:break
    return result

for source in ['SPEC.md','specs/001-physical-layer-underworld/spec.md']:
    parsed=parse_prop_table(source)
    assert len(parsed)==150
    for (allocation,name),p in zip(parsed,world['props']):
        assert (allocation,name)==(p['allocation'],p['name']), (source,p,name)

sources=[
 'AGENTS.md','.specify/memory/constitution.md','SPEC.md','PLAN.md',
 'specs/001-physical-layer-underworld/spec.md','specs/001-physical-layer-underworld/plan.md',
 'specs/001-physical-layer-underworld/tasks.md','assets-src/art-direction.md','assets-src/manifest.json',
 'assets-src/audio/production-plan.json','content/spec001/world.json',
 'content/spec001/presentation/introduction-graybox.json','content/spec001/presentation/first-route-graybox.json',
 'content/spec001/presentation/R01.json','src/presentation/introduction-graybox.ts','src/presentation/three-room.ts',
 'src/presentation/room-adapter.ts','assets-src/rooms/R01-production-settings.json','assets-src/rooms/R01-camera.json',
 'assets-src/rooms/R01-registration.json','assets-src/rooms/R01-placements.json','assets-src/rooms/R01.blend',
 'assets-src/rooms/R01-source-inspection.json','assets-src/images/R01/camera.json','assets-src/images/R01/registration.json',
 'assets-src/rooms/CH01-source-inspection.json','assets-src/rooms/CH03-source-inspection.json',
 *[f'assets-src/images/R01/{layer}-v1.{suffix}' for layer in ['background','midground','foreground']
   for suffix in ['prompt.txt','settings.json','tool-return.json']],
 'assets-src/images/R01/source-export-reopen.json','assets-src/images/R01/native-review-observations.json',
 'docs/evidence/spec001/presentation/owner-frame-approval-2026-11-26.md',
 'docs/evidence/spec001/presentation/t077/final-source-build.json',
 'docs/evidence/spec001/presentation/t077/t077-entry-1280x720.png',
 'docs/evidence/spec001/presentation/t077/t077-entry-layout.json',
 'docs/evidence/spec001/presentation/t067/R01-source-reopen.json',
 'assets-src/audio/auditions/provenance/review-packet-seal.json',
 *[f'content/spec001/rooms/R{i:02}.json' for i in range(1,13)],
 *[f'content/spec001/quests/SQ{i:02}.json' for i in range(1,5)],
 *[f'content/spec001/minigames/MG{i:02}.json' for i in range(1,4)],
]
sources=[p for p in sources if (ROOT/p).exists()]
write('source-seal.json',{'checkpoint':'55b9bfcd7ca1f0aef0b4add6f6d86790e34e7cad',
     'scope':'Current actual source bytes read for isolated preparation. Concurrent root task/state tracking excluded; recheck room/gameplay sources after T105 before freeze.',
     'files':[file_record(p) for p in sources]})

placements=[p for r in candidate_rooms for p in r['propPlacements']]
props=[{'id':p['id'],'name':p['name'],'allocation':p['allocation'],
        'candidatePlacementIds':[q['instanceId'] for q in placements if q['semanticId']==p['id']],
        'currentHotspotIds':[h['id'] for r in rooms for h in r['hotspots'] if h['subjectId']==p['id']],
        'canonicalStatus':assets[sid('ASSET-'+p['shortId'])]['status'],'acceptedQuotaCount':0}
       for p in world['props']]
characters=[{'id':c['id'],'name':c['name'],'primaryRegisteredRoomIds':c['roomIds'],
             'candidateRoomIds':[r['roomId'] for r in candidate_rooms if any(v['characterId']==c['id'] for v in r['characterPlacements'])],
             'portraitId':sid('ASSET-PORTRAIT-'+c['shortId']),
             'requiredClips':['idle','reaction']+(['walk'] if c['shortId']=='CH01' else ['fly','ability'] if c['shortId']=='CH03' else ['ability'] if c['recruitable'] else []),
             'canonicalStatus':assets[sid('ASSET-'+c['shortId'])]['status'],'acceptedQuotaCount':0}
            for c in world['characters']]
allocations={key:[{'assetId':v['assetId'],'name':v['name'],
                  'roomId':v.get('roomId',v.get('plannedEncounterRoomId')),
                  'purpose':v.get('purpose',v.get('learningIntent')),
                  'canonicalStatus':assets[v['assetId']]['status'],'acceptedQuotaCount':0}
                 for v in plan[key]] for key in ['sceneLayers','portraits','illustrations','music','ambience','effects','voices']}
allocations['illustrations'][17]['additionalProvisionalUse']={'roomId':sid('R02'),'use':'SQ02 earned framed workshop decoration beside PR018; same image as R09 journal; count once','approval':'root provisional reuse approval 2026-11-27; freeze/runtime observation pending'}

# Disjoint ownership covers each and every required identity once. Native source
# grouping and multiple actual uses do not create extra character/prop/image IDs.
batches=[]
def batch(task, path, ids, kind, integration, notes):
    batches.append({'task':task,'plannedFragmentPath':path,'assetIds':ids,'kind':kind,
                    'integrationTasks':integration,'sourceStatus':'planned fragment; file creation not implied',
                    'notes':notes,'acceptedMediaAdded':0})

def numbered(prefix,start,end):
    return [sid(f'ASSET-{prefix}{n:02}' if prefix in ['CH','PORTRAIT-CH','ILLUSTRATION-'] else f'ASSET-{prefix}{n:03}') for n in range(start,end+1)]

batch('T107','assets-src/characters/batch-a.json',[sid('ASSET-CH02')]+numbered('CH',4,9),'character-model',['T135','T136','T137','T138','T139'],
      'Seven new distinct identities. CH01 and CH03 remain separately retained sources; CH03 still needs its actual recruited ability clip without becoming a new identity.')
batch('T108','assets-src/characters/batch-b.json',numbered('CH',10,17),'character-model',['T135','T136','T137','T138','T139','T140'],'Eight distinct identities; preserve module/legacy and satellite role limits.')
batch('T109','assets-src/characters/batch-c.json',numbered('CH',18,25),'character-model',['T136','T137','T138','T139','T140'],'Eight distinct identities; paired CH24 counts once; Backhoe never blocks safe preparation.')
batch('T063-retained','assets-src/rooms/R01-placements.json',[sid('ASSET-CH01'),sid('ASSET-CH03')],'character-model',['T107','T133','T135'],
      'Retained real sources, not new production. Current manifest integrated/count=false. Preserve measured dimensions and real clips; record CH03 ability completion as new clip evidence for the same source identity.')
for task,start,end,group in [(110,1,20,'R01-R02'),(111,21,40,'R03-R04'),(112,41,60,'R05-R06'),(113,61,80,'R07-R08'),(114,81,100,'R09-R10'),(115,101,120,'R11-R12'),(116,121,150,'shared')]:
    batch(f'T{task}',f'assets-src/props/{group}/manifest.json',numbered('PR',start,end),'prop-model',
          ['T135','T136','T137','T138','T139','T140'] if group=='shared' else [f'T{135+(start-1)//20}'],
          'Exact SPEC names; distinct native models and usable exports, observed meaningful placements. R01 existing PR001–010 sources are reused, never recounted.' if start==1 else 'Exact SPEC names; no duplicate/recolor placeholders. Multiple placements count one asset.')
for task,start,end in [(117,1,4),(118,5,8),(119,9,12)]:
    ids=[sid(f'ASSET-LAYER-R{n:02}-{layer}') for n in range(start,end+1) for layer in ['background','midground','foreground']]
    batch(f'T{task}',f'assets-src/images/rooms-{start:02}-{end:02}.json',ids,'scene-layer',['T133','T134']+[f'T{135+(n-1)//2}' for n in range(start,end+1,2)],
          'Twelve independently usable layers, three per room. Retain actual R01 three OpenAI calls and originals for T117. Later layers may share a genuine generated parent with truthful masks/edits; layer count is not generation-call count.')
for task,start,end,kind,prefix,path in [(120,1,13,'portrait','PORTRAIT-CH','portraits'),(121,14,25,'portrait','PORTRAIT-CH','portraits'),(122,1,12,'illustration','ILLUSTRATION-','illustrations'),(123,13,24,'illustration','ILLUSTRATION-','illustrations')]:
    batch(f'T{task}',f'assets-src/images/{path}-{start:02}-{end:02}.json',numbered(prefix,start,end),kind,['T133','T135','T136','T137','T138','T139','T140'],
          'Actual OpenAI originals, prompt/reference/output/edit lineage; exact real text remains semantic. Portraits do not count as models. Illustration18 has two actual uses but one identity; 08/18 pending rewards retain honest unavailable text.')
for task,keys,path in [(124,['title','workshop','copper','fiber'],'music-a'),(125,['radio','clockworks','rift','epilogue'],'music-b')]:
    batch(f'T{task}',f'assets-src/audio/{path}.json',[sid('ASSET-MUSIC-'+k) for k in keys],'music',['T135','T136','T137','T138','T139','T140'],
          'Full usable cue/loop or authored ending; actual method disclosure, .aup4 reopen, lossless master/web export and human listening. Existing title audition is retained evidence only for unchanged bytes, not automatic full-cue acceptance.')
batch('T126','assets-src/audio/ambiences.json',[sid(f'ASSET-AMBIENCE-R{n:02}') for n in range(1,13)],'ambience',['T135','T136','T137','T138','T139','T140'],'Twelve distinct room sound designs; pause/duck/caption text; no repeated file counted as another room.')
for task,start,end,kind,prefix,path in [(127,1,20,'effect','EFFECT-','effects'),(128,21,40,'effect','EFFECT-','effects'),(129,1,20,'voice','VOICE-','voices'),(130,21,40,'voice','VOICE-','voices'),(131,41,60,'voice','VOICE-','voices')]:
    batch(f'T{task}',f'assets-src/audio/{path}-{start:02}-{end:02}.json',numbered(prefix,start,end),kind,['T135','T136','T137','T138','T139','T140'],
          'Preserve exact allocated purpose, caption and actual trigger. Auditioned unchanged files retain their approval; new or changed rendered audio requires actual source/reopen/export and human headphone/speaker listening. Voices bind exact speaker/script/hash.')
support=[{'assetId':sid(f'ASSET-ARCH-R{n:02}'),'kind':'room-model','owner':f'T{135+(n-1)//2}',
          'sourcePath':f'assets-src/rooms/R{n:02}.blend','status':'candidate support reservation; not canonical manifest entry',
          'countsTowardQuota':False} for n in range(2,13)]
support += [{'assetId':sid('ASSET-SPRITE-R04-'+ch),'kind':'sprite-sheet','owner':'T134/T136',
             'derivedCharacterId':sid(ch),'sourcePath':f'assets-src/characters/{ch}.blend',
             'status':'candidate support reservation; actual atlas directions/frames pending source production',
             'countsTowardQuota':False} for ch in ['CH01','CH13','CH20']]
expected_quota={a['assetId'] for a in manifest if a['kind'] not in ['room-model','sprite-sheet']}
allocated=[i for b in batches for i in b['assetIds']]
allocation_audit={'quotaIdentityCount':len(expected_quota),'batchOwnedIdentityCount':len(allocated),
    'missingIds':sorted(expected_quota-set(allocated)),'extraQuotaIds':sorted(set(allocated)-expected_quota),
    'multiplyOwnedIds':sorted(i for i,n in collections.Counter(allocated).items() if n!=1),
    'categoryCounts':dict(collections.Counter(a['kind'] for a in manifest if a['assetId'] in expected_quota)),
    'voiceSpeakerCounts':dict(collections.Counter(v['speakerId'] for v in plan['voices'])),
    'existingUncountedArchitectureIds':[a['assetId'] for a in manifest if a['kind']=='room-model'],
    'missingCanonicalSupportReservations':[p['assetId'] for p in support if p['assetId'] not in assets],
    'interpretation':'Required quota IDs all allocated; uncounted architecture/sprite support reservations need actual source/export records before integration. T132 consolidates actual fragments; this preparation cannot accept any media.'}
write('production-fragments.candidate.json',{'status':'isolated allocation candidate; no production events',
     'requiredQuotaIdentityCount':380,'batches':batches,'uncountedSupportReservations':support,'audit':allocation_audit})

candidate={'schemaVersion':1,'episodeId':'spec001','task':'T106','loop':122,
 'status':'isolated preparation candidate; NOT frozen or runtime-loaded',
 'sourceCheckpoint':'55b9bfcd7ca1f0aef0b4add6f6d86790e34e7cad',
 'copyright':'Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.',
 'authorizationBoundary':'tasks.md T106 preparation exception only. T104/Q05/T105 results and root GO required before canonical assets-src/rooms/scene-layouts.json freeze. No source image/audio generation, bulk modeling, task acceptance or release.',
 'coordinateContract':{'logical':'x, floor-y map to runtime x,height,z=floor-y','native':'Blender metres/Z-up; (x,y,z)->runtime(x,z,-y); character forward -Y','camera':'Fixed orthographic; per-room registered exports share camera; aspect fit expansion never crop essential objects','sourceStatus':'All non-R01 numerical dimensions are proposed composition envelopes; they are not model inspections or quota evidence'},
 'experienceContract':{'influence':'Original Sierra Kings Quest/Space Quest adventure inside approved 286 monitor; composed places, Walk/Look/Talk/Use, contextual readable panels and inventory puzzles','tone':'Networking/OSI fantasy, playful, witty, mysterious and lightly dark; teaching through inspectable experiments and consequences','scope':'Spec001 Layer1; future Iron City clearly contextual. No implementation jargon introduced into player-facing room writing.','media':'Retain genuine Blender/OpenAI/audio provenance and all exact allocations; no duplicate/recolor/placeholder counts'},
 'rooms':candidate_rooms,'sourcePropRoster':props,'sourceCharacterRoster':characters,'nonmodelAllocations':allocations,
 'productionFragments':'production-fragments.candidate.json','allocationAudit':allocation_audit,
 'presentationModeProofRequired':{'R01':'Retain real-time focal set and actual generated layer lineage','R04':'T134/T136 real Blender-rendered CH01/CH13/CH20 sprites, matching pivots/directions/clip timings and semantic targets; proposed 24fps source, 8 facing directions where used; no atlas frames count as models/images','R05':'T133/T137 actual layered generated/rendered scenery with real-time characters/props, source-matched occlusion and identical actions'},
 'allocationConflicts':CONFLICTS,
 'freezePrerequisites':['Root accepts reconciled T105 routes/all twelve rooms after T104/Q05 closure','Rehash this source seal; explicitly resolve gameplay/content changes','Review candidate camera/arrival/exit/occlusion placement risks and original source identities','Preserve R01 registered source/approved frame and existing audition approval','Root authorizes canonical layout freeze; source/keyframe/bulk production follows task sequence'],
 'acceptedMediaAdded':0,'productionEvents':[],'humanReviewClaims':[]}
write('scene-layouts.candidate.json',candidate)

# Metadata checks deliberately do not manufacture source reopening, rendering,
# native browser, listening, accessibility or complete-route evidence.
failures=[]
def check(condition,message):
    if not condition:failures.append(message)

check(len(candidate_rooms)==12,'twelve rooms')
check(len(placements)==150 and len({p['semanticId'] for p in placements})==150,'150 distinct named placements')
check({p['semanticId'] for p in placements}==set(prop_roster),'exact prop roster')
check(len(characters)==25 and {c['id'] for c in characters}==set(char_roster),'exact character roster')
check(len(expected_quota)==380 and len(allocated)==380 and not allocation_audit['missingIds'] and not allocation_audit['extraQuotaIds'] and not allocation_audit['multiplyOwnedIds'],'disjoint complete batch ownership')
interactive={p['semanticId'] for p in placements if p['interactiveCandidate']}
check(len(interactive)>=50,'at least fifty distinct current prop subjects')
for r,source in zip(candidate_rooms,rooms):
    check(r['authoritativeWalkRegions']==source['walkRegions'],r['roomId']+' walk preservation')
    check(r['authoritativeSafePositions']==source['safePositions'],r['roomId']+' safe position preservation')
    check([h['id'] for h in r['hotspots']]==[h['id'] for h in source['hotspots']],r['roomId']+' exact hotspots')
    for a,b in zip(r['hotspots'],source['hotspots']):
        for k in ['subjectId','label','verbs','actionIds','evidenceIds']:
            check(a[k]==b[k],a['id']+' semantic '+k)
        check(all(.045<n<.955 for n in a['uvAt16by9']),a['id']+' baseline anchor inset')
    check([v['toRoomId'] for v in r['exits']]==[v['toRoomId'] for v in source['exits']],r['roomId']+' exits preserved')
    for v in r['exits']:
        check(all(0<n<1 for n in v['uvAt16by9']),v['id']+' exit in camera frame')
    check(len(r['plannedSceneLayerIds'])==3,r['roomId']+' three layers')
for k,expected in [('sceneLayers',36),('portraits',25),('illustrations',24),('music',8),('ambience',12),('effects',40),('voices',60)]:
    check(len(allocations[k])==expected and len({v['assetId'] for v in allocations[k]})==expected,k+' exact allocation')
check(all(not a['countsTowardQuota'] for a in manifest),'canonical source manifest has no accepted quota counts')
projection_review=[]
for r in candidate_rooms:
    anchors=r['hotspots']+r['exits']
    historical_stages=[[v['stage']['width'],v['stage']['height']] for v in read('docs/evidence/spec001/presentation/t077/t077-entry-layout.json')]
    for dims in [[1280,720],[1440,900],[768,720],[390,720]]+historical_stages:
        points=[(h['id'],project(h['anchorWorld'],r['camera'],dims[0]/dims[1])) for h in anchors]
        inbounds=all(0<uv[0]<1 and 0<uv[1]<1 for _,uv in points)
        pairs=[]
        for i,(id1,uv1) in enumerate(points):
            for id2,uv2 in points[i+1:]:
                dx,dy=abs(uv1[0]-uv2[0])*dims[0],abs(uv1[1]-uv2[1])*dims[1]
                if dx<44 and dy<44:pairs.append([id1,id2])
        projection_review.append({'roomId':r['roomId'],'canvasPixels':dims,'allAnchorsInside':inbounds,
                                 'pairsWhose44pxTargetsMayOverlap':pairs,
                                 'canvasBasis':'Historical owner-approved T077 actual stage bounds; current/final browser measurement still pending' if dims in historical_stages else 'standalone candidate canvas, not viewport-to-stage measurement',
                                 'interpretation':'Mathematical projection only; actual contained stage dimensions and finished mesh occlusion pending. Narrow overlaps require semantic selection list, not tiny/cropped targets.'})
        check(inbounds,r['roomId']+' anchor bounds '+str(dims))
status_counts=collections.Counter((a['kind'],a['status']) for a in manifest)
write('candidate-validation.json',{'status':'PASS' if not failures else 'FAIL','failures':failures,
 'scope':'Static roster/semantic/projection preparation checks only; no release/browser/visual/accessibility acceptance',
 'rooms':len(candidate_rooms),'sourcePropIdentities':len(props),'namedCandidatePlacements':len(placements),
 'distinctCurrentInteractivePropSubjects':len(interactive),'currentHotspots':sum(len(r['hotspots']) for r in rooms),
 'currentExitBindings':sum(len(r['exits']) for r in rooms),'characterIdentities':len(characters),
 'allocatedNonmodelCounts':{k:len(v) for k,v in allocations.items()},
 'canonicalManifestStatusCounts':[{'kind':k,'status':s,'count':n} for (k,s),n in sorted(status_counts.items())],
 'acceptedMediaAdded':0,'sourceRosterMatches':['SPEC.md','specs/001-physical-layer-underworld/spec.md','content/spec001/world.json','assets-src/manifest.json'],
 'projectionReview':projection_review,
 'pending':['T105 source reconciliation and freeze','actual source dimensions/footprint/character party envelope checks','native finished-room camera/layer/hotspot/occlusion comparison','actual keyboard/touch/muted/reduced-motion/200% tests','full sources, actual generations, human audio and all final use evidence']})
print(json.dumps({'status':'PASS' if not failures else 'FAIL','failures':failures,'rooms':12,'placements':len(placements),'interactivePropSubjects':len(interactive),'hotspots':sum(len(r['hotspots']) for r in rooms),'acceptedMediaAdded':0},indent=2))

# A purposefully plain planning contact sheet, not a generated illustration or
# claimed game screenshot. View projection dots plus exact named source roster.
e=html.escape
parts=['<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T106 layout preparation</title><style>body{background:#17232f;color:#eee1be;font:16px system-ui;margin:24px;line-height:1.5}h1,h2{color:#f0c47a}a{color:#bde4ed}section{border-top:1px solid #546772;padding:24px 0;max-width:1280px}.study{width:100%;background:#243846;border:1px solid #c39d60}svg{width:100%;height:auto}.key{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:6px 24px}.key p{margin:0}small{color:#b8c6cc}.warn{border-left:4px solid #d67b62;padding:12px;background:#253441}table{border-collapse:collapse;width:100%}td,th{border:1px solid #546772;text-align:left;padding:6px}details{margin:1em 0}nav{display:flex;gap:12px;flex-wrap:wrap}.dot{stroke:#17232f;stroke-width:2}</style><h1>T106 — twelve room layout candidates</h1><p class="warn">Preparation only. These are mathematical composition diagrams, not game screenshots, 3D models, generated art, native camera reviews or accepted media. T105 and root freeze are pending. Source checkpoint 55b9bfc.</p><p>Original Sierra-inspired networking fantasy within the approved 286 frame. Twelve composed places, every current semantic hotspot/exit preserved; 150 named planned prop placements; 25 character identities; no added accepted media.</p><nav>'+''.join(f'<a href="#{r["roomId"].split(":")[1]}">{e(r["roomId"].split(":")[1])}</a>' for r in candidate_rooms)+'</nav>']
for r in candidate_rooms:
    short=r['roomId'].split(':')[1]
    parts.append(f'<section id="{short}"><h2>{short} — {e(r["name"])}</h2><p>{e(r["composition"]["mood"])}</p><p>{e(r["composition"]["focus"])}</p>')
    parts.append('<div class="study"><svg viewBox="0 0 1280 820" role="img" aria-label="'+e(r['name'])+' proposed camera projection of targets and walk boundary"><rect width="1280" height="820" fill="#1c2d3b"/><rect x="4" y="4" width="1272" height="42" fill="#2b3b3d" stroke="#bd995e"/><text x="20" y="32" fill="#f0c47a" font-size="20">LAYOUT STUDY · NOT FINISHED ART</text><text x="1245" y="32" text-anchor="end" fill="#eee1be" font-size="18">'+short+'</text><g transform="translate(0 48)">')
    floor=[project([p['x'],0,p['y']],r['camera']) for p in r['authoritativeWalkRegions'][0]['vertices']]
    parts.append('<polygon points="'+' '.join(f'{u*1280:.1f},{v*720:.1f}' for u,v in floor)+'" fill="#435565" stroke="#b5c7c8" stroke-width="2"/>')
    for p in r['propPlacements']:
        if not p['candidateEnvelope']:continue
        x,h,z=p['position'];w,d=p['candidateEnvelope']['width'],p['candidateEnvelope']['depth']
        footprint=[project([x+dx,h,z+dz],r['camera']) for dx,dz in [(-w/2,-d/2),(w/2,-d/2),(w/2,d/2),(-w/2,d/2)]]
        parts.append('<polygon points="'+' '.join(f'{u*1280:.1f},{v*720:.1f}' for u,v in footprint)+'" fill="#b9784b" fill-opacity=".24" stroke="#b9784b"/>')
    for c in r['characterPlacements']:
        uv=project([c['position'][0],c.get('anchorHeightMetres',c['heightMetres']*.65),c['position'][2]],r['camera'])
        parts.append(f'<circle cx="{uv[0]*1280:.1f}" cy="{uv[1]*720:.1f}" r="16" fill="none" stroke="#b09bd6" stroke-width="3"/>')
    for n,h in enumerate(r['hotspots'],1):
        u,v=h['uvAt16by9'];label=str(n)
        parts.append(f'<circle class="dot" cx="{u*1280:.1f}" cy="{v*720:.1f}" r="15" fill="#f0c47a"/><text x="{u*1280:.1f}" y="{v*720+6:.1f}" text-anchor="middle" fill="#17232f" font-size="16" font-weight="bold">{label}</text>')
    for x in r['exits']:
        u,v=x['uvAt16by9']; label=x['toRoomId'].split(':')[1]
        parts.append(f'<rect x="{u*1280-27:.1f}" y="{v*720-15:.1f}" width="54" height="30" rx="4" fill="#afd6c8"/><text x="{u*1280:.1f}" y="{v*720+6:.1f}" text-anchor="middle" fill="#17232f" font-size="16">{label}</text>')
    sp=r['authoritativeSafePositions'][0]['point'];u,v=project([sp['x'],.8,sp['y']],r['camera'])
    parts.append(f'<path d="M{u*1280:.1f},{v*720-18:.1f} l15,18 -15,18 -15,-18Z" fill="#82afc8"/><text x="{u*1280+22:.1f}" y="{v*720+6:.1f}" fill="#fff" font-size="16">saved arrival</text>')
    parts.append('</g><rect x="4" y="764" width="1272" height="52" fill="#2b3b3d" stroke="#bd995e"/><text x="22" y="798" fill="#eee1be" font-size="22">Walk · Look · Talk · Use     |     Inventory · Notebook · Compendium · Scene · Evidence</text></svg></div>')
    parts.append('<p><small>Gold: preserved hotspot · green: exit · violet: character anchor · copper polygons: proposed source footprints · blue: unchanged saved arrival. Marker sizes are diagram conventions, not verified browser targets.</small></p><div class="key">')
    for n,h in enumerate(r['hotspots'],1):parts.append(f'<p>{n}. {e(h["label"])} <small>({e(h["subjectId"].split(":")[1])})</small></p>')
    parts.append('</div><details><summary>Exact named prop placements and source status</summary><table><thead><tr><th>ID</th><th>Original source identity</th><th>Position x,height,z</th><th>Current status</th></tr></thead><tbody>')
    for p in r['propPlacements']:parts.append(f'<tr><td>{p["semanticId"].split(":")[1]}</td><td>{e(p["sourceName"])}</td><td>{e(str(p["position"]))}</td><td>{e(p["canonicalAssetStatus"])}</td></tr>')
    parts.append('</tbody></table></details><p><small>Camera '+e(str(r['camera']['position']))+' → '+e(str(r['camera']['target']))+'; authoritative '+str(max(v['x'] for v in r['authoritativeWalkRegions'][0]['vertices']))+' × '+str(max(v['y'] for v in r['authoritativeWalkRegions'][0]['vertices']))+' walk area. All actual source/plate comparison, collision/occlusion and responsive input checks remain pending.</small></p></section>')
parts.append('<section><h2>Bounded reconciliation</h2>'+''.join('<p><strong>'+e(c['id'])+':</strong> '+e(c['finding'])+' '+e(c['decision'])+'</p>' for c in CONFLICTS)+'</section></html>')
(OUT/'review.html').write_text('\n'.join(parts)+'\n')
