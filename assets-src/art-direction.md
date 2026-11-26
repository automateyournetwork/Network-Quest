# Network Quest — Underworld art and audio direction

T062 · 2026-11-26 · **Production plan; no finished media accepted**

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The Underworld is a place built by patient engineers and inhabited by improbable
creatures. Warm work lights reveal rounded, worn tools against immense cool rock.
Machines have understandable joints, useful handles and a little dignity. Humor
comes from their scale and personality: a firefly offers excellent advice beside
a cable taller than the apprentice; a guardian who could move a mountain carefully
labels two separate indicators. The scene should invite a player to look around
before it asks them to calculate.

This plan implements direction for C3/C5/C9–11/C13–15, NQ-09, FR-017/018/019/020/021/024,
and AC08–10/14/15/16/20. It preserves [SPEC.md](../SPEC.md),
[PLAN.md](../PLAN.md), the [delivery contract](../specs/001-physical-layer-underworld/contracts/delivery.md)
and [manifest schema](../specs/001-physical-layer-underworld/contracts/asset-manifest.schema.json).
The [production plan](audio/production-plan.json) contains the exact 205 nonmodel
allocations, individual purposes, captions and 60 authored selected speech lines.
The T061 manifest owns production status; this document cannot advance it.
The exact CH01–25 and PR001–150 identities remain those in SPEC, with at least
50 meaningful interactive/evidence props. Recolors, views and multiple instances
do not increase model counts. Finished media remains zero at this planning step.

## A composed adventure stage

Use original silhouettes, tactile 3D forms and rich painted atmosphere. Classic
adventure influence means deliberate room composition, a visible path, discoverable
objects, conversational pauses and a memorable entrance. Do not reproduce another
game's characters, screenshots, UI skins or music. OpenAI imagery supplies strange
rock, distant industry, organic forms and illustrated discoveries; Blender supplies
spatially credible characters, props and focal sets. Their shared lighting and
camera make them one place. Small painterly surface variation is welcome; blurry
geometry, shiny plastic everywhere and a wall of equally bright objects are not.

The finished visual stage is intentionally designed. The current R01/R02 graybox
and its long text lists prove functional access, not approved finished art or layout.
At desktop sizes, give the room a stable composed frame, a legible protagonist,
readable interactive silhouettes and a quiet verb/inventory area. Keep full labeled
scene objects, evidence and actions available through semantic HTML alongside or
below the stage. On narrow screens, rearrange panels and preserve the full scene
through fit/letterboxing; do not crop a necessary exit or depend on hovering.
Exact stage proportions and panel arrangement are reviewed in T066/T067, not
assumed approved here. At 200% text scaling, controls may occupy more space without
covering essential art or becoming inaccessible.

Use three visual distances: calm far silhouettes; a readable middle band of
characters, diagnostic objects and exits; sparse foreground edges that frame the
room. Reserve small bright accents for the current observable object, without
making brightness or color a grading signal. A deliberately selected hotspot can
receive an outline and a real-text label. The art must remain understandable with
that outline off. No secret pixel hunt, baked-in essential text, mandatory camera
pan or foreground curtain may conceal required evidence.

## Palette, materials and light

These are starting swatches and production conventions, not measured accessibility
or color-management results. Text/background combinations require actual contrast
and browser checks; an attractive swatch is not a contrast certificate.

| Role | Starting color | Treatment |
| --- | --- | --- |
| Basalt shadow | `#182532` | Cool, blue-black forms; preserve separation between silhouette and background |
| Rock midtone | `#435565` | Broad planes, modest roughness variation, limited small-scale noise |
| Worn copper | `#B9784B` | Warm edges and contact wear; no mirror-finish walls |
| Work light | `#F0C47A` | Local amber pools, soft falloff, believable practical sources |
| Pearl optical light | `#D8EFE6` | Narrow luminous accents; bloom cannot obscure connectors or readings |
| Garden teal | `#398D87` | Cool living glass; separate material from electricity metaphors |
| Prism violet | `#8A77B0` | Secondary optical atmosphere, never the only wavelength label |
| Signal blue | `#82AFC8` | Quiet cool rim/fill against warm focal planes |
| Warning clay | `#D67B62` | Small contextual accent paired with a label, shape and stated consequence |
| Notebook cream | `#EEE1BE` | Untextured support for real readable UI, never tiny lettering in a texture |

Keep one warm principal key, cool fill and restrained rim for character readability.
Bake complex Blender-only materials when necessary, record the bake, and compare
the actual GLB to the reopened source. Base-color maps use sRGB; normal/roughness/
metalness/occlusion maps carry their appropriate non-color interpretation. Document
actual export settings and browser color-space/tone-mapping configuration. A Blender
AgX screenshot and a browser render must not be claimed equivalent without checking
exposure and color conversion. Texture palette, model material and plate grade
share a neutral reference patch in the production contact sheet.

Power and data link remain separate named observations. Fiber carries light in the
declared model, not electrical power. Hydra heads illustrate propagation modes,
not promised payload lanes. Radio waves are an explanatory overlay, not a measured
throughput graph. Timed lighting and music do not impose a response deadline.
No animation or attractive lighting can turn an unsupported action into a correct
repair. All numeric diagrams and status labels are semantic UI, sourced from the
same authoritative state as the text view.

## Camera, coordinates and registration

Keep the accepted shared room/action interfaces in
`src/presentation/room-adapter.ts` and `src/presentation/introduction-graybox.ts`.
Room art is a projection of state. It never grants inventory, resolves a check,
changes a saved position or releases another activity's lock. The adapter owns
prepare/attach/pause/dispose; immutable captured actions remain owned by the shared
action bus. Models, layers, sprites and text must select the same object and action.

The current logical room coordinate `(x, y)` maps to Three.js `(x, height, z=y)`.
R01 and R02 currently have a 10 by 6 logical walk rectangle. Preserve these saved
safe positions and navigation regions while replacing geometry; do not silently
move a safe point into a new prop. One authoring unit is proposed as one metre for
these rooms. This is a visual engineering convention, not a conversion of fictional
cable-length measurements into the room's physical scale.

| Camera reference | Current position | Current target | Current span |
| --- | --- | --- | --- |
| R01 benchmark | `[12, 13, 16]` | `[5, 1, 3]` | `13` |
| R02 foundation | `[12, 14, 17]` | `[5, 1, 3]` | `13` |

These are actual orthographic graybox inputs in
`content/spec001/presentation/introduction-graybox.json`, with near/far `0.1/80`.
The current resize calculation uses `heightSpan = max(9, span / aspect)`, vertical
extents `±heightSpan/2` and horizontal extents `±heightSpan*aspect/2`. Record the
actual viewport/aspect and resulting projection for any benchmark render. These
are reference coordinates, not a fabricated final camera approval. If T066 changes
the composition, update the single camera record, all registered exports, masks,
anchor projections and browser evidence together; preserve navigation semantics.
For later rooms, design and freeze their own camera records before producing plates.
Do not copy R01's numeric camera into a differently sized room without inspection.

Blender source uses metres and Z-up, with character local forward `-Y`; export to
the project's Y-up GLB convention. The intended axis conversion is
`(Blender x,y,z) → (runtime x,z,-y)`, so Blender negative Y matches positive
logical floor Y/runtime Z. Verify the actual exporter result with a labeled axis
fixture and a reopened/imported export; do not apply a second conversion blindly.
Feet/base pivots lie at ground zero; Photon uses a base/root with a separately
documented hover offset. Apply and document mesh transforms without breaking rigs.
Collision proxies are simple, named and separate from visual detail; logical
walk-region/navigation rules remain authoritative.

Each produced room needs a hashed `camera.json` and `registration.json` beside its
image sources. These are future files, not claims of current existence. Capture:

1. Room ID; projection type; position/target/up; near/far; orthographic bounds or
   span/viewport rule; Blender camera transform; render dimensions, crop and safe
   framing; color-management settings; source and export hashes.
2. At least four noncollinear reference anchors with world coordinates and projected
   normalized UV: floor corners plus doorway/diagnostic anchor. Add each hotspot's
   object pivot, selectable bounds and linked semantic ID. For R01 specifically
   register POWER, LINK, training path, Photon, satchel, capsule and workshop exit.
3. Background/midground/foreground roles, plane/depth placement, draw order,
   transparent export interpretation, alpha edge treatment, depth masks and
   occluder polygons. Record which actual raw generation and later mask/render
   produced each independently usable output.
4. Walk polygon, safe arrival positions and clear interactive regions projected
   through the same camera. Keep an initial eight-CSS-pixel clear margin around
   diagnostic silhouettes at 1280×720 as a **proposal to inspect**, not a passed test.
   Pointer target sizing comes from actual accessible controls, not painted pixels.
5. Source/plate/GLB/browser comparison captures at 1280×720 and 1440×900 and narrow
   768/390 layouts, including changed aspect. Record anchor pixel deltas, actual
   viewpoint and any correction. Initial goal: no perceptible slide, with ≤2 CSS px
   anchor error at the benchmark viewport; freeze a measured tolerance at G3.

Use a fixed view for the composed room. Do not let independent layer parallax
shift a displayed hotspot from its raycast/HTML control. Optional atmosphere motion
is confined to noninteractive regions. Foreground depth masks may occlude bodies
as they walk behind geometry, but essential evidence and selected targets must stay
identifiable; provide a selected silhouette/outline or fade the obstructing edge.
That technique still needs actual implementation and review. Transparent fringes,
depth sorting and light leaking need inspection on both dark and light backgrounds.
Depth masks are production helpers, not extra counted image layers.

R01 proves a real-time 3D focal set: apprentice, Photon, diagnostic props and landing.
Its three generated layers provide distant structure and framing. R05 later proves
layered generated/rendered scenery with real-time characters and props. R04 later
proves Blender-rendered sprites over a composed room. All three modes retain the
same semantic actions and source-backed physical state. Other rooms may choose a
mode after their keyframe review; a planned mode is not an implemented scene.

## Character scale and animation language

The apprentice's proposed standing height is 1.65 m. Titan is 2.6 m, Iron Golem
1.9 m, and Photon's luminous body 0.45 m with a hovering root. These values preserve
the introductory focal hierarchy while remaining subject to camera inspection.
Do not resize a character between rooms to fit a plate. Large creature bodies can
coil or fold: Copperhead, Hydra, Serpent and Eel use approved bounding dimensions
on their sheets. Backhoe is large through framing and a future room-specific set,
not through blocking every path. Record exact measured bounding boxes per export.
Portrait perspective can emphasize a face without redefining world scale.

The 25 portrait briefs in `production-plan.json` are also silhouette directions
for the corresponding models. Each CH identity needs front/side/three-quarter
reference, material swatches, scale reference, pivot and distinct readable anatomy.
Shared rigs/materials are encouraged, but 25 recolored copies do not meet the roster.
CH24's paired Twins share one bespoke identity and count once. Portraits show the
actual approved model traits, not an unrelated generated redesign. The compendium
retains the character's role, limitation and real textual name.

Proposed clip conventions are engineering defaults to be measured and reviewed at
G3. Author at 24 fps; GLB stores continuous time in seconds. Preserve the Blender
action/NLA names, exported clip names, frame range, duration, sample policy and
object/rig binding in source/export records. Each character's required clips are:

| Clip | Required coverage and proposed form | Review |
| --- | --- | --- |
| `idle` | All CH01–25; 3–6 s loop, breathing or a single restrained habitual gesture, stationary root | Seamless pose/velocity join, stable silhouette, no false diagnostic status |
| `reaction` | All CH01–25; 0.6–1.5 s authored one-shot returning cleanly to idle; appropriate surprise/attention | Clearly distinct anatomy/personality, no forced delay before text feedback |
| `walk` | CH01 locomotion; 0.75–1.0 s in-place loop, documented nominal stride and forward axis | Feet plant at actual travel rate, no skating; movement respects logical path |
| `fly` | CH03 benchmark locomotion; 1.0–1.5 s in-place wing/hover-flight loop with documented hover height and travel speed | Stable luminous body, readable wing movement, no root drift or dependence on camera motion |
| `ability` | CH03/04/05/06/07/16/19/20/22 (nine recruits); 1.0–2.5 s one-shot with marked presentation contact frame | Distinct stated inspection/repair use, source/browser parity; cannot commit gameplay at clip end |

Additional `turn`, `talk`, `hover` or creature movement clips may be produced for
actual uses; they are not new characters. The T063 Photon benchmark owes actual
`idle`, `reaction` and `fly` locomotion; its recruit `ability` follows when that
production/integration task is reached. CH01 owes actual `idle`, `reaction` and
`walk` locomotion in the same benchmark. Record explicit mapping if an internal named
action exports under these shared clip names. Exported clips must actually contain
movement; an empty action bearing the right name fails review. Shared skeletons
need per-character deformation checks. Protect elbows, folded wings, Hydra necks
and Hermit eyestalks from mesh penetration at extrema.

The nine ability poses communicate these bounds: Photon reveals a connector;
Copperhead traces continuity; Unicorn compares a single-mode profile; Hydra
demonstrates modes; Thunderbird surveys a declared path; Hermit compares modules;
Eel audits delivered power; Echo Bat regenerates an intact section; Chameleon
identifies common support. A conditional repair version may play only after its
actual modeled effect commits. Do not animate a missing cable knitting itself
together during an inspection or give a profile-comparison pose a victory burst.

Locomotion uses an in-place clip driven by presentation movement between valid
positions. If later movement interpolation is added, cancellation/room change must
finish at the authoritative safe position; root motion must not write saved state.
Reduced motion shows stable poses or short fades, removes camera movement and
nonessential pulses, and returns feedback immediately. Skip cancels presentation,
not evidence. Hidden-tab pause stops mixers/particles/audio. Reentering a room
cannot leak mixers, frame callbacks or resources.

R04 sprite production saves actual `.blend` models, camera and render settings.
Propose 8 facing directions for a moving sprite where used, 24 fps source render
and 12 fps idle/24 fps reaction export only after motion review. Record exact atlas
rectangles, frame durations, padding, alpha mode, ground pivots and direction/action
mapping. Use one camera-matched lighting setup, no hand-mirrored asymmetric body
unless recorded and correct. Atlas frames do not add model/image quota. A static
dummy row is not a finished sprite animation.

## Exact visual allocations

Every row below reserves three asset identities:
`spec001:ASSET-LAYER-Rnn-background`, `-midground` and `-foreground`.
The JSON expands all 36 IDs and independently usable layer purposes. A set may
derive from one genuine generated scene, with honest masks/edits and shared raw
parent; three delivered layers do not imply three generation calls.

| Room | Composed focus | Background / midground / foreground allocation |
| --- | --- | --- |
| R01 Arrival Lift | Apprentice and separate power/link observations | Deep lift shaft / signal-tube arches / rail ends |
| R02 Titan's Workshop | Guardian, topology bench and branch doors | Furnace cathedral / hanging tool and pipe ribs / worn bench corners |
| R03 Copper Warrens | Intact versus broken copper path | Copper-root rock / cable trays and motor recess / spool rim and wire ends |
| R04 Echo Cavern | Repeater, broken span and serial post | Receding blue arches / stone ribs behind sprite acting area / echo stones |
| R05 Photon Gardens | Connector dock and living light | Glass-root grotto / blossom canopy / root-and-leaf corners |
| R06 Prism Vault | Loss budget and receiver window | Violet vault / suspended prisms / cut-crystal frame edges |
| R07 Skywell | Visible antenna path | Indigo sky chimney / distant relays / worn masonry corners |
| R08 Storm Observatory | Comparative observations | Cloud-facing dome / window struts / rain-dark sill |
| R09 Shell Market | Module and delivered-power comparison | Warm shell alcoves / canopies / counter and empty shell edges |
| R10 Clockworks | Untimed symbol and capability stations | Brass monument / slow distant gears / stationary outer gear teeth |
| R11 Backhoe Rift | Break, repair alternatives and preparation exit | Vast trench / cut conduit and stable scaffolds / work-zone rail ends |
| R12 Iron Threshold | Validation balcony and future boundary | Closed city gate / balcony columns / worn threshold stones |

Portrait identities are exactly `spec001:ASSET-PORTRAIT-CH01` through `CH25`.
The JSON binds each to the corresponding named SPEC character, encounter room and
individual silhouette brief. Propose 1024-square editable image masters, face and
recognizable silhouette within a 10% safe inset, and 512/256 web variants after
readability review. Variants count once. Use a consistent three-quarter camera,
soft warm key and quiet basalt/teal backdrop. Creature scale is communicated in
compendium context; do not make the giant Titan and small Photon appear to be the
same world size because their portrait boxes are equal.

Illustration identities are exactly `spec001:ASSET-ILLUSTRATION-01` through `24`.
They are two purposeful uses per room, specified independently of model counts:

| IDs | Room | Illustrated inventory / diagnostic / journal use |
| --- | --- | --- |
| 01–02 | R01 | Separate power/link observations; known payload within the supplied frame |
| 03–04 | R02 | Notebook evidence card; three equivalent physical routes |
| 05–06 | R03 | Continuity tester and open path; fictional cable-length comparison |
| 07–08 | R04 | Regeneration versus reconnection; antique serial message strip |
| 09–10 | R05 | Connector inspection lens; matched fiber/optic profile cards |
| 11–12 | R06 | Optical budget balance; receiver operating window |
| 13–14 | R07 | Alignment scope; separate signal/noise comparison |
| 15–16 | R08 | Channel analyzer observation sheet; weather diary comparison |
| 17–18 | R09 | Module compatibility checklist; delivered-power ledger |
| 19–20 | R10 | Toy four-symbol key; common-capability intersection |
| 21–22 | R11 | Repair clamp and preparation; route/isolation record |
| 23–24 | R12 | Fresh validation beside stale evidence; maintenance epilogue folio |

Use actual OpenAI base imagery and retain requested originals. For diagnostic
geometry and labels, preserve any manual vector/diagram work as a separately named
edit rather than calling it generation. Explanations, values, source attribution
and accessible alternative descriptions stay in real UI. Each illustration must
be observed in the corresponding inventory/notebook/diagnostic use, not left as
an unused gallery filling the quota. Color vision differences must not make the
two cards or symbols indistinguishable.

## Audio that belongs to this place

The score combines simple memorable FM-style melodic shapes, modern space and
careful restraint. The common proposed motif is a tentative rising fourth with a
warm three-note answer. It is an original compositional brief, not a completed
melody or a claim that ACE generated it. Workshop sounds are tactile, garden sounds
glassy, and Rift sounds low and deliberate. Avoid continuous alarm, jump scares,
wall-to-wall percussion and caricatured retro noise. Silence makes the next
observation easier to hear.

The JSON names all eight cues (`title`, `workshop`, `copper`, `fiber`, `radio`,
`clockworks`, `rift`, `epilogue`), with musical structure, timbres, duration target,
loop/ending, scene use, caption and review plan. Required initial destinations are
TITLE/R02/R03/R05/R07/R10/R11/R12 respectively; reuse in adjacent rooms does not add
cues. The common epilogue music is reflective across E01/E02/E03; explicit text
and fresh checks classify the outcome, so an unresolved shutdown is never made a
false success by a fanfare.

All twelve room ambience beds have distinct sound direction and educational limits.
All forty effects have an actual trigger purpose, caption and individual review
concern. Variations of one footstep are one asset. There are nine distinct recruit
ability effects and separate cues for taking a measurement, passing a declared
check, being outside bounds and marking earlier evidence stale. A save sound is
reserved for a real server acknowledgement. Failure is gentle explanatory feedback,
not a punitive buzzer. None of these planned triggers is claimed integrated now.

The sixty selected voice rows contain authored text, stable planned line/caption
IDs `spec001:DIALOGUE-VOICE-001` through `060`, speaker, scene, category, learning
intent and a hash of the exact UTF-8 text. They select 18 narrator, 16 Titan, 14 Photon
and 12 Hermit lines. These text hashes identify the script version only; they are
not production audio hashes. Later dialogue work must reconcile them with actual
content entities and triggers; this JSON is not loaded into the game. Existing
introduction dialogue cannot silently acquire a different meaning or speaker.
All exact speech remains available as text when muted, skipped or unavailable.

The narrator is warm and dry; Titan is grounded and patient; Photon is bright and
curious; Hermit is practical and mildly skeptical. Four characters need audible
distinction without imitation of real people. Pace ranges and pronunciation review
are in the JSON. These are performance briefs, not selected model voices. Audition
the same technical sample across candidates, then project-specific representative
lines: VOICE-003/012 (narrator), 020/025 (Titan), 041/042 (Photon), and 051/057
(Hermit). Check acronym, unit, hexadecimal and negative-value pronunciation along
with emotion and clarity; retain rejected takes and findings.

The existing [media feasibility evidence](../docs/evidence/spec001/media-feasibility.md)
observed only Kokoro 0.9.4/Kokoro-82M v1.0 `af_heart` for one local test, and one
ten-second ACE-Step 1.5 instrumental. It does not approve a production voice or
complete cue, establish any other voice's feasibility, or provide listener feedback.
Use these dated findings; do not repeat unchanged generation for this planning task.
The pending headphone/ordinary-speaker response remains pending. No cloud audio,
new model installation, external key or performer imitation is implied.

Distinguish actual `music-generated` inference from AI-assisted `composed` and
`synthesized` work. Keep original notes, real MIDI or synthesis code when those
exist, plus rendered raw audio. A mixed generator output is not a set of stems and
does not magically contain editable MIDI. Audacity 4 production requires genuine
`.aup4`, saved/closed/reopened on the Mac, lossless masters and browser exports.
It has no legacy scripting pipe or MIDI tracks. The historical 3.7.9 `.aup3` smoke
does not satisfy production `.aup4`. Native UI/operator availability and a real
supported-patch roundtrip must be resolved in T065 before claiming that source gate.

## Exact production and review records

Production records are created after actual actions, not generated by filling in
an acceptance template. The JSON's `actualProductionRecords` and
`actualReviewRecords` are deliberately empty. Proposed source locations are
`assets-src/rooms/Rnn.blend`, `assets-src/characters/CHnn.blend`, meaningful prop
source groups, `assets-src/images/Rnn/`, portrait/illustration source directories,
and `assets-src/audio/{asset-local-id}/`. Runtime exports go under
`public/assets/`. Preserve original generator outputs immediately; temporary
private tool URLs are not public source retrieval.

The T061 adapter reads evidence JSON in
`docs/evidence/spec001/assets/{asset-local-id}/{record-name}.json`, plus explicitly
referenced source-reopen/usage/verification records. Use that discoverable subtree
for production/rights/retrieval records, which lack an explicit production evidence
path in the manifest schema. Each file contains one `AssetEvidenceRecord` matching
`tools/asset-types.ts`: `type`, `assetId`, current `hashes`, `status`, `actor`,
`reviewer`, actual `date`, `environment`, optional `check`, and `details`.
The JSON bytes themselves must exist and be readable by the adapter. Never copy
the synthetic T060 fixture records or substitute an invented reviewer.

| Record | Exact evidence to preserve |
| --- | --- |
| Native source and export | Relative path, actual format, SHA-256 and byte count for every source/export; exact application/version and export preset; source hashes linked to each export; native project and GLB/image/audio decode checks |
| Production event | Actual unique `eventId`, method/tool/version/model revision, exact prompt or script and settings paths/hashes, reference hashes, raw output hashes and substantive notes; the record's `details` must match the manifest event; unknown tool seed/model fields say `unknown/not-exposed` |
| Derived image/edit | Parent asset/raw output and acyclic lineage; actual crop/mask/paint/render settings and resulting hashes; distinguish OpenAI generation, Blender render and manual edit; preserve original and layered editable derivative |
| Blender reopen | New actual session/process opens current `.blend`; named objects/collections, dimensions, pivots, transforms, rigs, clip ranges, materials and dependencies inspected; render paths/hashes and outcome; scripts or screenshots alone do not replace the native source |
| Image registration | Camera and registration files, anchors/masks/alpha/crop/safe regions; actual source/export/browser comparisons and defects; no counting masks as additional generated layers |
| Audio source/voice | Actual raw audio, native `.aup4`, master/web bytes; real MIDI/notes/code where applicable; loop samples, rate/channels/codec/duration and measured LUFS/sample peak/true peak; voice file binds exact lineId/speakerId/text/voiceId/tool/version/modelRevision/scriptPath/scriptSha256/pronunciationOverrides; generation event includes `voiceRecordSha256` |
| Rights | Hash-bound current subjects, original creators, actual notices/license text snapshots, applicable tool/model/output terms and reference/input permissions; `licenseIds`, `noticeHashes`, `termsHashes`, `permissionHashes`, actual modification/redistribution/commercial-use findings and reference hashes |
| Visual review | `type: review`, `check: visual` or `browser-comparison`; actual `image-inspection` or `browser-inspection` methods, inspector/tool, `observedPaths`, current source/export hashes and specific findings; an agent can record real viewed-image/browser inspection, never infer viewing from file existence |
| Listening review | `type: review`, `check: listening`, `actor: human`; headphones **and** ordinary-speakers methods, named listener, actual equipment/date/environment, current source/master/web hashes, full-cue/line findings and accept/reject; file/waveform analysis is separate |
| Use/placement | `type: usage`; independently observed `bindings` of assetId/contentId/use/exportPath/interactiveOrEvidence, visible/meaningful findings and export hash; exact current content entity; no manifest self-attestation or planned placement as proof |
| Budget review | Actual profile/device/browser/build and asset hashes, cold/warm/network conditions, measurements including errors, texture estimate basis, trace paths and findings; no target recorded as result |
| Public retrieval, if needed | Versioned public URL, archive/member hashes, exact archive member, public instructions and actual clean unauthenticated retrieval evidence; materialized bytes checked like local source bytes |

Use the manifest's allowed statuses accurately: planned → produced → exported →
integrated → accepted, or rejected with findings. Integrated media still counts
zero until required evidence is accepted. `usedBy` names an actual registered use
after integration; a plan's `roomId` is not a substitute. Source/export modification
invalidates old hash-bound checks, including relevant rights/usage/review. Preserve
failed and superseded records and add a new reviewed revision. Validating these
relationships cannot itself reopen Blender, generate imagery, hear audio, establish
rights or approve the owner experience.

Original controlled creative work is intended for CC BY 4.0; original code/scripts
for Apache-2.0. Third-party terms stay intact. Re-check the precise selected voice,
model, input references and tool/output terms when producing assets; dated smoke
evidence is not blanket clearance. Do not promise exclusive copyright or individual
voice consent that has not been established. Public archives/LFS can carry large
sources only when a clean public checkout can obtain the exact licensed files.

## Runtime budgets and benchmark decision

Root SPEC budgets remain controlling: title/shell ≤5 MiB compressed; first room
≤15 MiB total cold compressed transfer; interactive ≤12 s at recorded 20 Mb/s and
50 ms latency; ordinary exploration ≥30 FPS; ≤500,000 visible triangles and
≤128 MiB **estimated** resident texture data. These are targets, not current
finished-art results. T059 development samples do not freeze the G3 laptop or pass
the finished-room gate. Preserve all required asset counts if optimization is needed.

Starting allocations below are engineering proposals, not requirements attributed
to the owner or fabricated measurements. T067 measures, revises and freezes them
with owner review before broad production.

| Cost | Proposed authoring envelope | Measure / adjust at G3 |
| --- | --- | --- |
| Character | Apprentice/Photon each ≤25k visible triangles; larger hero ≤40k; typical NPC ≤20k | Visible simultaneous team/NPC costs, skinning and actual frame time; simplify hidden detail first |
| Prop | Small utility ≤2k; focal machinery ≤12k triangles; shared materials/instances where correct | Total visible triangle/draw-call costs, silhouette at actual camera, no repeated placeholders |
| R01 scene | Aim ≤250k visible triangles and ≤180 draw calls, leaving headroom under SPEC triangle limit | Actual renderer counters and frame traces including speech/ability/transition; no unmeasured draw-call guarantee |
| Textures/layers | Start 2048-class room exports, 1024 character atlas, 512–1024 prop maps; use smaller actual needs | Estimated byte residency including mip chains, alpha/depth helpers and actual decoded data; compression is not the same as resident memory |
| Portrait/illustration | 1024 source minimum proposal; 512/256 display variants; no entire compendium preload | Actual small-size readability, bandwidth and memory; preserve high-quality editable sources |
| R01 transfer planning | Shell up to 5 MiB plus roughly 3 MiB models, 3 MiB plates, 1 MiB selected audio, 3 MiB other/headroom, all within 15 MiB total | Actual request waterfall counts shared/cold bytes once; reduce exports if measured total exceeds target |
| Audio residency | One music, one ambience, one voice, up to four short effects proposed concurrently; room-owned resources | Measured decode/memory/CPU, disposal and actual native browser limits; no whole-library load |

Texture estimate example: a 2048² RGBA8 base is 16 MiB before mipmaps; a full mip
chain is approximately 21.33 MiB. Three such decoded layers can consume about
64 MiB even if web transfer is small. Account for helpers, materials and the
actual texture formats; this calculation is not GPU-memory measurement. Low detail
can lower resolution/effects, but retains diagnostic readability and the same
physical rule. Account for current room plus explicitly bounded adjacent prefetch;
dispose unused geometries, materials, textures, ImageBitmaps, mixers, render targets
and audio buffers through the shared lifetime contracts.

T063–T067 first establish the real R01 sources/exports, actual OpenAI layers,
four-speaker/music/effect audition, visual scene integration and measured owner
benchmark. Review the Apprentice/Photon/Titan sheets and later Workshop/copper/fiber
keyframes before multiplying those designs. Owner art feedback, human headphone/
speaker listening and actual technical review remain explicit evidence. A rejection
produces a concrete correction and new source/export/review hashes. G3 and later
G5/G6 acceptance cannot be inferred from this plan's complete allocation tables.
