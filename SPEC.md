# Network Quest — Spec001: The Underworld

Version 0.1 · Kickoff specification · 2026-11-24 · Status: specified, not implemented

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). SPDX-License-Identifier: CC-BY-4.0.

Governed by the [current constitution](.specify/memory/constitution.md). The original decisions remain in [CONSTITUTION.md](CONSTITUTION.md). Build sequence: [PLAN.md](PLAN.md). This is the first of seven realm specifications, not a commitment to implement every inspirational character or protocol in the first release.

The [Spec Kit feature specification](specs/001-physical-layer-underworld/spec.md) organizes this
same episode into player stories, requirements and success criteria. This file remains the
detailed source contract; both views must preserve the same scope and IDs. Its
[quality checklist](specs/001-physical-layer-underworld/checklists/requirements.md) records
document readiness separately from game acceptance.

## The adventure

The Iron City's beacon has fallen silent. Deep below it, the Titan's transmission works are failing: copper conduits misbehave, the light gardens have darkened, and the wireless relay hears a storm of contradictory signals. An apprentice engineer arrives with a notebook and an inconveniently optimistic firefly named Photon.

The player must investigate, recruit useful allies, restore a physical path, and prove that it works. The Backhoe of Doom is the first manifestation of The Outage, called The Severed. It cannot be defeated by subtracting health points. Evidence, a sound repair, and repeatable validation resolve the encounter.

A successful first episode ends at a functioning connection to the Iron City; a safe-shutdown ending explicitly leaves service unresolved. Each has its own completed story and personalized epilogue even before Spec002 exists. Later episodes can turn that boundary into a traversable route and add consequential return visits.

## Release envelope

| Dimension | Spec001 commitment |
| --- | --- |
| Audience | Teen/adult networking beginners; optional engineer explanations |
| Main playtime | 60–120 minutes on a first unassisted or lightly assisted story run; thinking time is unlimited |
| World | 12 finished connected rooms; several substages and alternative routes |
| Characters | At least 25 distinct finished character models |
| Props | At least 150 distinct reusable authored props, placed meaningfully |
| Media | Blender sources and exports; real OpenAI imagery; mixed 2D/3D room techniques |
| Audio | Original modern AI-assisted score/effects with retro influences; selected auditioned TTS |
| Controls | Walk, Look, Talk, Use; inventory; keyboard equivalents |
| Progress | Guest introduction; Google/GitHub accounts; one save slot; opt-in autosave |
| Hosting | Existing GoDaddy server; listed in the website arcade |
| Endings | Shared main story, alternate repair paths, chapter consequences, personalized epilogue |

## Core play loop

Explore a room → observe a symptom → record evidence → talk or inspect → form a hypothesis → select a tool/ally → make a repair → run the same relevant check again → observe consequences and update the notebook.

The player sometimes becomes the packet's perspective to see a message represented as a transmitted bit stream. A physical link carrying signals does not by itself prove that DNS, routing, authentication, or an application works. The story's higher-layer dependencies are explicitly known-good for a scoped link-validation challenge.

## Initial requirements

| ID | Required behavior |
| --- | --- |
| NQ-01 | A beginner can start the guest introduction and learn the four verbs without an account |
| NQ-02 | The main story has multiple technically valid physical repair routes |
| NQ-03 | Every essential puzzle exposes enough evidence to reason about the solution |
| NQ-04 | Notebook entries, discoveries, inventory, recruits, and objectives travel between rooms |
| NQ-05 | Compendium entries explain a character's actual networking role and limitations |
| NQ-06 | Character abilities alter documented simulation state; combat imagery reflects those effects |
| NQ-07 | Optional side quests and minigames enrich the chapter without preventing completion |
| NQ-08 | Failures explain consequences; retry or restore remains understandable |
| NQ-09 | Delivered art meets the room/model/prop quantities and source-file requirements |
| NQ-10 | Both sign-in providers can own and restore the single account save |
| NQ-11 | Autosave is off initially and never creates a second selectable slot |
| NQ-12 | Later realm releases can extend earlier rooms while preserving existing progress |
| NQ-13 | Playable packet journeys demonstrate sending and receiving transformations without inventing seven mandatory wire headers |

## Rooms and progression

The names and story details below are authored kickoff proposals within the agreed scope. All 12 rooms must be finished, explorable scenes with meaningful interaction, not a menu entry, loading screen, or background counted twice.

| ID | Room | Main activity and teaching purpose | Main allies or opposition |
| --- | --- | --- | --- |
| R01 | The Arrival Lift | Guest introduction; inspect an unlit link and distinguish power from communication | Apprentice, Photon |
| R02 | The Titan's Workshop | Central briefing, notebook, tool bench, recruit/team management, branching route map | Titan, Iron Golem |
| R03 | The Copper Warrens | Inspect continuity, stated cable limits, pairing and interference; choose a repair | Copperhead, Crosstalk Twins |
| R04 | The Echo Cavern | Compare signal before/after regeneration and distinguish regeneration from repairing a broken medium | Echo Bat, Ancient Tortoise |
| R05 | The Photon Gardens | Discover light transmission; inspect dirty/broken connectors and select compatible fiber | Photon, Unicorn, optical Hydra |
| R06 | The Prism Vault | Calculate a supplied optical loss budget; match optics, fiber, and wavelength | Rainbow Serpent, Hermit Crab |
| R07 | The Skywell | Align a wireless link; inspect path, channel and signal/noise evidence | Thunderbird, Blue Dragon |
| R08 | The Storm Observatory | Diagnose interference, compare candidate channels, validate a new observation | Phoenix, Celestial Eagle, Noise Demon |
| R09 | The Shell Market | Choose compatible modules; distinguish media, form factor, PHY and power requirements | Hermit Crab, Chimera, Electric Eel, Mole, Badger |
| R10 | The Clockworks | Decode a scoped toy signal, align timing, compare common link capabilities | Metronome Golem, Chameleon, Red Scorpion |
| R11 | The Backhoe Rift | Gather failure evidence; execute and validate a branch-specific restoration plan | Backhoe of Doom, recruited team |
| R12 | The Iron Threshold | Independently verify link recovery; choose permanent restoration or a documented temporary bridge; epilogue | Titan, Photon, Iron Golem |

### Walk graph and unlocks

Bidirectional walk edges: `R01–R02`; `R02–R03`; `R02–R05`; `R02–R07`; `R02–R09`; `R02–R10`; `R03–R04`; `R05–R06`; `R07–R08`; `R04–R11`; `R06–R11`; `R08–R11`; `R10–R11`; `R11–R12`. Returning through earlier rooms stays possible unless an explicitly narrated, reversible encounter temporarily blocks an edge.

R01 and the introductory part of R02 comprise the guest introduction. After the tutorial, guests may continue playing the episode in the current session; signing in is required to retain account progress. Never imply that guest progress is already saved.

After R02's briefing, the three media branches and R09/R10 are available. Each branch contains foundational and applied puzzles. Inspecting R11 requires a validated branch plan and the Clockworks safety/timing briefing. R12's validation balcony opens after the Rift is safely repaired or deliberately isolated. Success outcomes still require fresh scenario checks to pass; reaching the balcony does not prove restored service. A player can complete the main story through copper, fiber, or wireless; no route demands mastery of an unvisited route.

The 60–120 minute target covers introduction, one media route, shared workshop/market/Clockworks activities, the Rift, and epilogue. Full exploration of all rooms, remaining routes, and side quests takes longer. Side routes remain accessible after a successful ending through Continue.

### Connections to later episodes

The Iron Threshold has a clearly labeled story boundary until Spec002 is released. A distant application beacon illustrates purpose, without pretending its services are currently simulated. Later episode updates may activate the Iron City door, add a repair request to the Workshop, or revisit the restored link as a dependency in a larger outage. Spec001's own ending and all existing valid repair options remain completable.

## Objectives and branching quest contract

| ID | Objective | Completion evidence |
| --- | --- | --- |
| O01 | Read the silent link in R01 | Record power indication and link indication separately; perform a valid inspection |
| O02 | Open the investigation in R02 | Identify the known-good endpoints and the physical path under test; pin a hypothesis |
| O03 | Prepare copper in R03 | Choose a compatible, within-limit cable path and remove the diagnosed physical defect |
| O04 | Prove copper in R04 | Compare before/after measurements and reject a repeater as a cure for a severed cable |
| O05 | Prepare fiber in R05 | Match the supplied optic/fiber profiles and inspect the connection before changing it |
| O06 | Prove fiber in R06 | Show the optical receive level is inside the stated receiver range with the required margin |
| O07 | Prepare radio in R07 | Establish a viable path and compatible radio settings in the supplied scenario |
| O08 | Prove radio in R08 | Select a channel/path meeting the scenario threshold and confirm a fresh measurement |
| O09 | Equip the repair in R09 | Select the route's required compatible module/tools and verify its supplied power constraints |
| O10 | Calibrate in R10 | Decode a toy bit pattern and distinguish timing/physical compatibility from address discovery |
| O11 | Resolve the intervention in R11 | Execute a reviewed copper, fiber or radio plan, or deliberately isolate an unresolved defect; record the result and any temporary dependency |
| O12 | Validate at R12 | Repeat link measurements and endpoint test; classify permanent repair, temporary restoration, or unresolved fault |

Main prerequisite graph: `O01 → O02 → ((O03 → O04) OR (O05 → O06) OR (O07 → O08))`; the selected branch plus `O09` and `O10` enables `O11`; `O11 → O12`. O09/O10 can be prepared before the branch is finished. Completing other branches remains optional. A tool needed for a valid main route is always obtainable without a side-quest reward or permanently consumed item.

### Inventory, notebook, and companion interactions

Each hotspot offers meaningful supported verbs and a helpful response for unsupported ones. Look returns persistent evidence, not just flavor text. Talk supports skippable, replayable conversation topics; evidence and objectives cannot disappear because a line was skipped. Use supports item-to-hotspot, item-to-item, and selected ally-to-target actions. Valid combinations consume items only when their documented transformation requires it; plot-critical tools remain recoverable.

The notebook has Objectives, Evidence, Hypotheses, Maps and Personal Notes. Entries name their source room, observed condition and freshness. Distinguish observations from player hypotheses and character speculation. Pin objectives across rooms; selecting a reference can highlight a visited location. User notes are plain text. A changed link marks related readings stale until measured again. Hints and worked examples stay available after leaving their room.

The compendium records discovered identity, actual technology, ability, limitation, realm/cross-realm note, recruitment condition, progression, and evidence/source references. Nine required recruitable allies are Photon, Copperhead, Unicorn, optical Hydra, Thunderbird, Hermit Crab, Electric Eel, Echo Bat and Chameleon. Others are NPCs, mentors or opponents. The player takes up to two active allies into an encounter and can change the party at safe locations without cost. If a necessary ally is absent, preparation remains reachable. Equivalent conventional tools can solve required puzzles; collecting everything is not mandatory.

Recruitment follows a demonstrated interaction; progression unlocks more precise inspection, explanations, or an additional valid use. It does not make fiber carry electrical power or give a repeater routing knowledge. Variants represent different technical roles, not a universal ladder from an inferior protocol to a superior one. Record assisted completion honestly.

### Optional activities

| ID | Activity | Benefit and independence |
| --- | --- | --- |
| SQ01 | The Antique Serial Post in R04 | Help the Tortoise deliver a short message; discover serial concepts and a journal illustration |
| SQ02 | The Eel's Energy Audit in R09 | Diagnose an over-budget power plan; gain a cosmetic workshop decoration |
| SQ03 | The Skywell Weather Diary in R08 | Compare two time-separated observations; unlock a deeper radio explanation |
| SQ04 | The Lost Maintenance Record across R03/R05/R09 | Combine clues in the notebook; change the epilogue's maintenance report |
| MG01 | Clockworks Bit Loom | Decode toy symbols with optional untimed practice; no score blocks O10 |
| MG02 | Prism Budget Bench | Experiment with loss components and margins after O06 |
| MG03 | Channel Scout | Predict, measure, and compare interference scenarios after O08 |

Each minigame has instructions, practice, explanation, retry and exit, and can be skipped without losing a required item. Optional challenge timing may exist only after an untimed mode is complete and remains off by default.

### Outcomes and failure

- **E01 — The Steady Light:** a permanent route passes every scoped validation; the final scene celebrates restored service and records route/allies/observations.
- **E02 — The Borrowed Dawn:** a clearly temporary route passes its declared service checks, with its limitation and follow-up recorded. This is successful temporary restoration, not a claim of permanent repair.
- **E03 — The Honest Shutdown:** an unresolved defect is identified; the player intentionally isolates the unsafe path. The episode closes with a recovery plan rather than calling the outage repaired. Continue returns to a safe pre-commit preparation state.

Each outcome has a personalized epilogue based on the chosen route, side quests, characters helped, and maintenance decisions. Assistance does not turn an otherwise valid repair into a bad ending. A failed guess at the Rift gives a specific observation and a route back to diagnosis. Dramatic deaths use a short skippable scene, explain the cause, and offer Restore Save or a clearly labeled in-memory Retry from Encounter Preparation. The latter is temporary session recovery, not a second persistent save slot. Guests can retry in memory but cannot restore an account save until signed in.

Retry from Encounter Preparation and Continue after E03 MUST restore the encounter and inventory to their safe preparation state while retaining new notebook clues, personal notes and hint-use history from the attempt. Measurements obtained during that attempt MUST remain visible as stale and MUST NOT count as current validation until measured again. This rule applies to in-session retry, not Restore Save, which loads the confirmed saved adventure. Retained information becomes durable only through the existing safe manual-save or opt-in autosave rules; retry does not create another persistent slot.

## Learning model and independent cases

| ID | Observable learning outcome | Evidence in the episode |
| --- | --- | --- |
| LO1 | Distinguish physical transmission from addressing, routing and applications | O01/O02/O10 explanations and a transfer example |
| LO2 | Choose compatible media and endpoints for stated constraints | Copper/fiber/radio branch and O09 |
| LO3 | Separate observation from hypothesis and isolate a physical defect | Notebook investigation and O11 |
| LO4 | Compare a supplied measurement with a stated operating range | Optical margin, radio SNR, cable or power example |
| LO5 | Explain how symbols can represent bits and why timing matters | O10 toy-symbol demonstration |
| LO6 | Validate recovery without overstating what a successful test proves | O12 and the epilogue's restoration classification |

Spec001 simulates selected physical scenarios, not analog electronics, electromagnetic propagation, a complete Ethernet PHY, or a certification instrument. Values below define fictional teaching fixtures; real product profiles require their own cited datasheets. The minimum-complexity lesson remains visible, with optional notebook detail for engineers.

| Case | Explicit inputs and action | Independent expected result |
| --- | --- | --- |
| T01 | Fictional copper profile: 100 m maximum channel; compatible intact path 85 m + 10 m | 95 m is within this profile; length check passes, other checks still required |
| T02 | Same profile, 95 m + 10 m | 105 m exceeds the limit; explain the 5 m excess rather than reporting a random failure |
| T03 | A continuity test identifies an open circuit; player adds a repeater without restoring continuity | No connected path; amplification/regeneration cannot bridge this stated physical break |
| T04 | Fictional matched optical pair: transmit −3 dBm, total loss 8 dB, sensitivity −14 dBm, maximum receive −1 dBm, required margin 2 dB | Receive −11 dBm; sensitivity margin 3 dB; within overload bound; optical power checks pass |
| T05 | T04 but loss is 10 dB | Receive −13 dBm; margin 1 dB; fails the specified 2 dB reserve even though above sensitivity |
| T06 | Matched receiver with maximum −1 dBm; receive power 0 dBm | Fails overload bound; more received power is not always better |
| T07 | A numerically sufficient budget but incompatible fiber/optic profiles | Reject compatibility before declaring the link usable |
| T08 | Fictional radio scenario: signal −65 dBm, noise −90 dBm, required SNR 20 dB, other path checks satisfied | SNR 25 dB meets this scenario's threshold; does not establish a universal Wi-Fi throughput |
| T09 | T08 but noise rises to −78 dBm | SNR 13 dB fails; measure again after mitigation |
| T10 | Fictional delivered-power budget 30 W; endpoint demands 12 W + 11 W + 10 W, all other constraints satisfied | 33 W exceeds the available delivered-power budget by 3 W; do not hide line losses in a PSE/PD ambiguity |
| T11 | Both toy endpoints negotiate; A advertises 1000/full and 100/full, B advertises 100/full and 10/half | Common supported option is 100/full; neither endpoint acquires unsupported capability |
| T12 | Toy four-symbol mapping: −3→00, −1→01, +1→10, +3→11; sequence −3,+1,+3,−1 | Decode 00101101: 8 represented bits in 4 symbols; this is a teaching mapping, not a complete PAM4 PHY |
| T13 | A repair changes a path, but player presents the old passing measurement | Mark evidence stale; require a fresh validation |
| T14 | Authored fixture has a missing unit, negative passive loss, or unrecognized profile | Report content error; no attempt penalty or progress award |
| T15 | T04 with loss 9 dB | Receive −12 dBm; margin exactly 2 dB passes this fixture's inclusive boundary |
| T16 | Two candidate repairs both satisfy every declared compatibility, safety and validation rule | Accept both; choice position, animation or author preference cannot determine correctness |

### Technical guardrails for characters

Copperhead carries electrical signaling; Photon carries light. Single-mode and multimode characters describe optical propagation, not one versus several guaranteed payload lanes. An SFP shell or QSFP-shaped Chimera is a form-factor metaphor; supported rates, lanes, optics and breakouts belong to a specified module profile. The Eel illustrates supplied power as well as data, without implying that power proves connectivity. The Metronome illustrates signal timing, not NTP. Chameleon can choose common capabilities, not invent compatibility.

An Echo Bat or hub-style exhibit regenerates/repeats a signal and does not learn addresses or route traffic. Wireless signal strength is only part of a usable link. The narrator identifies a full application test as a cross-layer observation, even when the current puzzle isolates a physical fault. Optional advanced descriptions name assumptions rather than overwhelming the first lesson.

### Source register

These sources ground model boundaries and future case authoring. An overview link is not a claim that a particular clause or product has been verified. G0 must attach the exact section/datasheet to each production profile before that profile can grade a player.

| ID | Primary reference | Supported use |
| --- | --- | --- |
| REF01 | [ITU-T X.200](https://www.itu.int/rec/T-REC-X.200/en) | OSI basic reference model; retain conceptual-model caveat |
| REF02 | [IEEE 802.3 working group](https://www.ieee802.org/3/) | Locate the applicable Ethernet standard/profile; not a universal cable or optic limit |
| REF03 | [IEEE 802.11 working group](https://www.ieee802.org/11/) | Locate relevant WLAN PHY/MAC material; avoid treating the whole technology as Layer 1 |
| REF04 | [Cisco Ethernet negotiation guidance](https://www.cisco.com/c/en/us/support/docs/lan-switching/ethernet/10561-3.html) | Profile-dependent speed/duplex behavior and troubleshooting; do not generalize legacy 10/100 behavior to all PHYs |
| REF05 | [Juniper optical budget and margin example](https://www.juniper.net/documentation/us/en/hardware/ptx10002-36qdd/ptx10002-36qdd.pdf) | Power budget/margin arithmetic; device-specific values are separate from our fictional fixtures |
| REF06 | [Cisco wireless troubleshooting](https://www.cisco.com/c/en/us/support/docs/smb/wireless/CB-Wireless-Mesh/1902-tz-Troubleshooting-Traditional-Cisco-Wireless-Network.html) | Signal, noise and SNR as distinct observations |
| REF07 | [RFC 1122, Internet host layers](https://www.rfc-editor.org/rfc/rfc1122) | Contrast Internet architecture with the fantasy's seven realms; consult updates for modern protocol detail |

## Packet perspective and encapsulation

At R01, the apprentice can step into a controlled test message's journey; at R12, repeat it over the repaired route. The lab highlights a known two-byte payload, `0x4E 0x51` (the letters NQ), within an opaque frame supplied by the upper interface. Its highlighted bits are `01001110 01010001`. The whole Ethernet frame is not represented as only those two bytes.

The player inspects the handed-down data, selects the compatible medium, steps through a declared toy symbol mapping, observes transmission/impairment, and compares recovered bits with the known test pattern. Pause, step and replay controls work by keyboard and pointer. A failure names the modeled defect and returns to the apprentice's investigation; a repair changes the displayed transmission result. Comparison against a known laboratory pattern must not be described as universal Layer 1 error detection or Ethernet FCS validation.

A seven-realm overview shows where the current activity sits: application meaning above, representations and conversations, transport, network, link framing, then physical signals. In Spec001 these upper stages are explanatory context; only the scoped physical path is simulated. Receiving reverses the applicable transformations. Later episode specs extend the shared journey with actual framing/addressing/routing/transport/service decisions and documented cross-realm caveats. Do not insert a fictional independent header for every OSI layer.

## Media production inventory

### Required character roster

The following 25 IDs define the minimum model roster. Each has an original silhouette, materials, idle/reaction animation, compendium portrait and in-game encounter. Player locomotion and each recruited ally's ability animation are additional requirements. The Crosstalk Twins are one bespoke paired character asset, counted once.

| ID | Character | Role / primary room |
| --- | --- | --- |
| CH01 | The Apprentice | Playable engineer; R01 onward |
| CH02 | The Titan | Mentor and Underworld guardian; R02 |
| CH03 | Photon the Firefly | Light-transmission companion; R01/R05 |
| CH04 | Copperhead Snake | Copper signaling companion; R03 |
| CH05 | Single-Mode Unicorn | Compatible long-path optical profile; R05 |
| CH06 | Multimode Hydra | Multiple optical propagation modes; R05 |
| CH07 | Thunderbird | Radio link companion; R07 |
| CH08 | Blue Dragon | Short-range radio exhibit and dialogue; R07 |
| CH09 | Red Scorpion | Infrared signaling exhibit; R10 |
| CH10 | Microwave Phoenix | Directional wireless relay specialist; R08 |
| CH11 | Celestial Eagle | Satellite-distance perspective, not a required satellite simulator; R08 |
| CH12 | Iron Golem | PHY and interface compatibility mentor; R02/R12 |
| CH13 | Ancient Tortoise | Legacy serial side quest; R04 |
| CH14 | DSL Mole | Existing telephone-medium context; R09 |
| CH15 | DOCSIS Badger | Coaxial-medium context; R09 |
| CH16 | SFP Hermit Crab | Compatible module-selection companion; R06/R09 |
| CH17 | QSFP Chimera | Multi-lane/form-factor explanation with profile caveats; R09 |
| CH18 | Rainbow Serpent | Wavelength multiplexing exhibit; R06 |
| CH19 | Electric Eel | Delivered-power budget companion; R09 |
| CH20 | Echo Bat | Signal-regeneration companion; R04 |
| CH21 | Metronome Golem | Signal timing and toy decoding; R10 |
| CH22 | Chameleon | Common-capability companion; R10 |
| CH23 | Noise Demon | Visible consequence of impaired radio evidence; R08 |
| CH24 | Crosstalk Twins | Interference story encounter; R03 |
| CH25 | Backhoe of Doom | Physical-disconnection finale; R11 |

Remaining inspirational Physical Layer characters may appear as later additions or clearly labeled notebook illustrations; they do not silently enlarge the committed roster. The rest of the user's multi-layer character universe is a design reservoir for Specs002–007, not a requirement to put every creature in the Underworld.

### Prop allocation: 150 distinct assets

Assign IDs `PR001` through `PR150` in the order below. Each semicolon-separated item is one distinct modeled asset. Reusing it in several rooms is encouraged and counts only once. The row allocations are production proposals; replacements preserve the total and interaction purpose.

| Allocation | Count | Distinct props |
| --- | --- | --- |
| R01 | 10 | Lift cage; lift call panel; signal arrival tube; orientation plaque; apprentice satchel; broken link lamp; insulated handrail; entry turnstile; message capsule; welcome automaton pedestal |
| R02 | 10 | Titan workbench; topology relief table; tool cabinet; dispatch console; recruit perch; repair-plan easel; media comparison rack; hypothesis board; parts carousel; workshop furnace |
| R03 | 10 | Twisted-pair cutaway; copper patch panel; cracked cable spool; cable tray elbow; pair separator; interference motor; shielding cross-section; damaged plug; continuity pedestal; route-length wheel |
| R04 | 10 | Repeater station; echo reflector; serial telegraph; serial connector display; cavern signal gong; historical cable case; regenerator core; isolated broken span; amplitude ladder; antique message printer |
| R05 | 10 | Fiber grove trunk; light blossom cluster; connector inspection dock; cleaning station; optical patch shelf; fiber bend exhibit; split fiber coupler; broken fiber stump; optical receiver altar; photon lantern |
| R06 | 10 | Prism engine; wavelength combiner; spectrum window; attenuation dial; splice enclosure; optical attenuator; receiver threshold gauge; wavelength-filter door; link budget abacus; power meter cradle |
| R07 | 10 | Directional antenna; radio mast; alignment scope; path-clearance model; short-range beacon; radio-channel selector; polarization exhibit; signal banner; rooftop relay cabinet; wireless bridge terminal |
| R08 | 10 | Storm radar dish; interference emitter; observation telescope; noise-floor meter; propagation globe; weather vane; satellite orbital model; microwave reflector; signal history drum; channel survey desk |
| R09 | 10 | Module display case; SFP test cage; QSFP test cage; power injector; powered endpoint model; coaxial cross-section; telephone demarcation box; module compatibility chart; power ledger stand; merchant counter |
| R10 | 10 | Master timing wheel; symbol loom; four-level signal plinth; capability negotiation console; infrared aperture; sampling gate; clock recovery model; pulse corridor gate; calibration dial; bit-pattern projector |
| R11 | 10 | Excavation trench segment; severed conduit cross-section; repair bridge deck; emergency radio tripod; fiber splice worktable; copper bypass frame; work-zone barrier; excavation permit lectern; restoration control post; temporary-route sign |
| R12 | 10 | Iron City boundary gate; restored beacon; validation terminal; observation balcony; ending mural frame; maintenance schedule board; link-status totem; chapter seal pedestal; return-path arch; gateway threshold plaque |
| Shared | 30 | Notebook; continuity tester; optical power meter; channel analyzer; cable probe; inspection lens; cleaning wand; crimp tool; splice tool; insulated gloves; warning cone; repair clamp; cable tie bundle; floor junction box; ceiling insulator; hanging lamp; maintenance ladder; service hatch; pipe valve; crystal battery; fuse cartridge; grounding braid; equipment case; bench stool; spare connector tray; map scroll; maintenance key; evidence tag; magnifying visor; message test token |

At least 50 of the 150 props support a direct Look/Use/Talk-related interaction or expose readable evidence; the remainder establish the environment and visual storytelling. A flat generated picture of a prop does not count as its Blender model.

### Imagery and room presentation

Require a generated-image set for every room: at least one accepted background plate and two independently usable foreground/midground/atmosphere layers, for at least 36 delivered layers. These may derive from carefully separated elements of a generated scene; do not misreport derivatives as separate generation calls. Add 25 character portraits and at least 24 inventory/diagnostic illustrations. Record actual generation requests, accepted outputs and edits. Layer depth, transparency, perspective and lighting must align with the scene.

Prove all three presentation modes: R01 uses a real-time 3D focal set; R05 uses layered generated/rendered scenery with real-time characters and props; R04 includes Blender-rendered sprite animation in a composed room. Use the same interface and interaction model everywhere. Primary directions: luminous underground industry, tactile machinery, organic protocol creatures, unexpected changes of scale and impossible-but-readable spaces. Keep textual controls as real accessible UI, never baked into artwork.

### Audio and voice

Deliver at least eight original music cues: title, workshop, copper, fiber, radio, Clockworks, Rift and epilogue. Each needs a usable loop or authored ending as appropriate. Provide 12 room ambience profiles and at least 40 purposeful effects covering interfaces, footsteps, machinery, character abilities, measurements, repairs and failures. Shared effects need not be duplicated to count.

Use modern AI-assisted production with retro melodic/timbral references. Selected voice coverage includes the narrator, Titan, Photon and Hermit Crab: at least 60 reviewed lines across tutorial, key clues, reactions and endings. This is selective voice-over, not every NPC line. Audition networking pronunciations and emotional readability before scaling production. Music, effects and voice have separate controls; important sounds also have text/visual equivalents. Playback starts only after player interaction.

## Account and single-save behavior

### Sign-in experience

The title screen offers New Adventure, Continue, Settings and Credits. A first-time unsigned-in player begins as a guest. An already signed-in player keeps that identity when starting a new in-memory adventure, subject to the existing-save replacement rules. Sign-in is offered at the end of the introduction and whenever a guest selects Save. Both Google and GitHub are real provider choices. Canceling or failing sign-in returns to the existing in-memory adventure; it never restarts the game or claims a save succeeded.

Open provider authentication in a user-initiated separate window or tab so the gameplay tab retains guest state. If a popup is blocked, offer an explicit Open Sign-in Tab action. Do not navigate the only game tab away and then claim its in-memory progress survives. After the callback, the original tab verifies its session with the backend before offering save adoption. Closing the sign-in window is a cancel, not a game restart.

If the account has no save, offer to save the current guest adventure. If it already has a save, show its chapter, room, timestamp and outcome summary, then offer Load Existing Save or Replace With This Adventure with a clear replacement confirmation. Do not merge inventories or silently favor the newer client clock. Cancel preserves both the server save and current guest state.

V1 associates an account with a provider and that provider's stable subject/user ID. Google and GitHub logins are supported independently; switching providers does not silently merge accounts. Show the signed-in provider so players know how to return to their save. Explicit linking of providers can be specified later; matching email alone never links them.

Logout MUST warn when the current adventure has unsaved progress and allow cancellation. Canceling leaves the signed-in session and current adventure unchanged. Confirmed logout ends the signed-in session, clears the current adventure from memory and returns to the title screen. It MUST NOT automatically save, replace or delete the saved account adventure, or continue that adventure as a guest. Signing in again allows the existing save to be restored.

After an account-deletion request loses its response, show deletion as unconfirmed until that specific operation is confirmed by the server. Being signed out does not prove deletion. A status check must not repeat deletion or silently create/sign in to an account. If confirmation is unavailable or expired, keep the outcome unconfirmed and explain that a new destructive attempt requires a fresh explicit choice.

### Slot contract

There is exactly one logical slot per account. It records the episode/content version, safe room and position, quest and world flags, inventory, recruits/party, compendium, notebook/evidence/notes, assistance, selected route/outcomes and a server revision/timestamp. Account preferences are stored separately from the adventure snapshot; they are not another slot.

Manual Save is available during stable exploration after an action completes. During a cutscene, dialogue transaction, transition, fatal outcome or write in progress, explain the temporary restriction and preserve the prior save. Loading or starting a new adventure warns when current progress is unsaved. A new in-memory adventure does not destroy the saved adventure until the player explicitly replaces it.

Autosave is off for a new account. Its opt-in explains that it overwrites the same slot and applies to the account across devices. When enabled, it may save after a safe room arrival, a completed objective with feedback dismissed, or a safe encounter preparation point. Debounce repeated triggers; personal notes may join the next safe snapshot. Never auto-replace a prior adventure immediately after New Adventure: first obtain the replacement decision. Autosave never writes terminal failure, E03's shutdown state, or an unresolved transition. Successful E01/E02 outcomes may be saved with a safe Continue location.

Show `Unsaved changes`, `Saving…`, `Saved at <server time>`, or a specific failure/conflict message. On a connection failure, continue the in-memory session and retain the confirmed server save. On authentication expiry, preserve the current in-memory state and request sign-in before saving again. Do not call browser memory a durable save or promise that closing an offline tab is safe.

### Conflict and update behavior

Writes include the last known server revision. A stale revision produces a visible conflict with Load Server Save, Keep Playing Without Saving, and an explicit Replace Server Save action after reviewing the current server summary. The latter re-reads the revision and still uses a conditional write. Automatic conflict merging is out of scope.

Unsupported newer saves are preserved and explained. Supported older saves migrate through a tested version chain before play resumes. Removed positions move to an authored safe point with an explanation; renamed IDs use explicit mappings. New future doors and notebook entries do not erase old accomplishments or pretend unplayed content was completed.

### Persistence acceptance cases

| ID | Scenario | Required observable result |
| --- | --- | --- |
| SAVE01 | Guest cancels sign-in | Same room, inventory and notes remain in memory; no saved claim |
| SAVE02 | Sign in with each provider on separate test accounts, save, close browser, return | Each restores its own state using the same provider; no cross-account access |
| SAVE03 | Existing account save meets a different guest run | Explicit load/replace/cancel choice; cancel changes neither |
| SAVE04 | Autosave is never enabled | Room changes and objectives issue no adventure-save writes |
| SAVE05 | Enable autosave, reach a safe boundary | Same slot revision advances; no second slot appears |
| SAVE06 | Die, choose E03, or interrupt a transition with autosave on | Last valid recoverable save survives |
| SAVE07 | Two devices load revision 8; A saves revision 9; B attempts revision 8 | B sees a conflict; revision 9 is unchanged |
| SAVE08 | Response is lost after a committed write; client retries the same request, including after changed content/schema write policy | A retained matching acknowledgement is returned without another write; revision is not advanced twice and current slot state remains intact |
| SAVE09 | Network failure or session expiry during saving | Honest unsaved status; confirmed save preserved; retry/sign-in available |
| SAVE10 | Tamper with account ID, fields, payload size, or content version | Server rejects inappropriate data/access without changing another account |
| SAVE11 | Upgrade a Spec001 save after a new episode adds a door or changes a safe position | Progress is preserved; migration explanation and valid position provided |
| SAVE12 | Delete after explicit confirmation/recent authentication; also lose the response, expire the session and check an unknown/expired confirmation | Active sessions/live progress removed; backup retention explained. Only operation-specific completion confirms deletion; session absence, unknown confirmation or network failure remains unconfirmed and checking status never repeats deletion |
| SAVE13 | Log out with unsaved progress, first canceling and then confirming; sign in again | Cancel preserves the session and current adventure; confirmed logout clears the in-memory adventure and returns to title without changing the server save; sign-in can restore that save |

## Distribution and release boundary

Players discover the game in `https://automateyournetwork.com/arcade/`. Proposed catalog/detail route: `/arcade/network-quest/`; proposed playable route: `/arcade/play/network-quest/`. The final paths are verified against the existing arcade conventions before integration. Launch supports a full-page game experience; an iframe is not required for authentication. The source repository remains independent of the website implementation.

A fresh public checkout must contain the instructions, source and versioned asset retrieval needed to build and run the game. Development with test identities is permitted locally, but production cannot claim authenticated saving until real Google and GitHub callbacks and cross-session restores pass. No player supplies an AI key or installs Blender to play.

Credits identify original creators, source repositories for reused components, licenses, and generated/edited media provenance in an understandable way. Detailed production metadata belongs in contributor documentation; it does not interrupt the adventure. The game settings explain account data and offer logout and confirmed deletion. Account pages and saves must never be exposed in search indexes or public static assets.

The original three-document kickoff and subsequent Spec Kit governance setup do not implement, deploy or claim a functioning game. Backend credentials, actual host capacity, art/audio quality and playability remain implementation evidence to produce. The owner initiates the build stage separately.

## Browser interaction and quality targets

### Input and accessible presentation

Proposed keyboard defaults: W/L/T/U select Walk/Look/Talk/Use; I opens inventory; N opens notebook; C opens compendium; Tab moves among visible controls/hotspots; Enter activates; Escape closes the top panel; arrow keys navigate grouped choices. Shortcuts must not fire while typing notes or using a text field. All shortcuts also have visible labeled controls. Touch selects the same verbs and hotspots without relying on hover.

Provide a selectable list of named scene objects/exits, text descriptions of important visual states, accessible diagnostic tables and announced feedback. The player can perform the core adventure through this semantic interface even when the scene is unavailable. Restoring WebGL returns to the same state. Do not put essential text only into a texture or a flashing effect.

Use readable default text, scalable dialogue and captions, visible focus, and redundant labels for status colors. At 200% zoom controls must remain usable. Reduced motion suppresses nonessential camera motion/flashes and shortens transitions without delaying feedback. Pause simulation presentation when the tab is hidden; no invisible timer changes a mandatory puzzle. Music/effects/voice controls are independent and persist as account preferences when signed in.

### Compatibility and provisional performance budgets

| Item | Acceptance target / interpretation |
| --- | --- |
| Desktop browsers | Current and previous supported major Safari, Chromium and Firefox versions at release; freeze exact tested versions in evidence |
| Viewports | Full keyboard play at 1280×720 and 1440×900; responsive controls at 768 px and 390 px widths, no hidden critical actions |
| Phones/tablets | Touch layout checked; full mobile performance/support claimed only after real-device playthroughs |
| Initial transfer | Title/shell at most 5 MiB compressed; first playable room at most 15 MiB total compressed from a cold cache |
| Initial readiness | First room interactive within 12 seconds at a declared 20 Mb/s, 50 ms latency test profile on the recorded reference laptop |
| Active rendering | At least 30 FPS during ordinary exploration on that laptop with default settings; record sustained dips and worst scenes |
| Scene budget | Initial target at most 500,000 visible triangles and 128 MiB estimated resident texture data; instrument estimates and distinguish them from measured GPU memory |
| Asset residency | Load the current room and bounded adjacent prefetch; dispose unused scene resources; never load the entire library at startup |
| Service behavior | Save response target p95 under 2 seconds in a controlled 20-session mixed-load staging trial; report errors, lock contention and host limits |

These are initial engineering targets, not measured results. G0/G3 benchmark them on named hardware and refine budgets openly if evidence requires it; retain the 12-room/25-character/150-prop release scope. A low-detail mode may reduce effects and resolution, not remove a required observation. Audio must not autoplay before user interaction. Missing or corrupt assets show retry and an equivalent scene/action description rather than a blank unrecoverable game.

### Expansion and content updates

Save references qualify local IDs with their episode, such as `spec001:R12`, so later realms can reuse readable local numbering without collision. A new episode can add an exit from R12 while preserving O12 and its ending history. If a saved location no longer exists, its migration maps to a specified safe location and explains the relocation. Optional new objectives are shown as new; old completion is not revoked without a documented educational correction.

Regressions for every expansion include: all three Spec001 media routes; its three outcome classes; safe in-memory retry; one-slot manual/autosave behavior; and an older save containing notebook clues, recruits and a personalized epilogue. Save an unaffected baseline fixture before developing the new realm and test it through the migration chain.

## Release acceptance matrix

Every row requires recorded evidence before Spec001 is called complete. These checks are specified, not run by this documentation kickoff.

| Acceptance | Requirements / outcomes | Observable acceptance |
| --- | --- | --- |
| AC01 | NQ-01; LO1 | Fresh guest reaches R02 using tutorial controls, without an account or API key |
| AC02 | NQ-02; O03–O12 | Copper, fiber and radio each independently reach a valid successful ending |
| AC03 | NQ-03; LO2–LO6 | Every mandatory objective exposes evidence, an accepted action and an explanation; T01–T16 pass |
| AC04 | NQ-04 | A clue from one room remains usable in another; stale readings are identified |
| AC05 | NQ-05, NQ-06 | All 25 entries have role/limitation/art; all nine required recruits have progression and abilities |
| AC06 | NQ-07 | Four side quests and three minigames each start, teach, finish/retry and exit; none gates the main route |
| AC07 | NQ-08 | All three outcome classes are reachable; failure explains recovery and cannot silently destroy the save. Failure retry and E03 Continue restore encounter/inventory preparation state, retain clues/notes/hint-use history and mark prior-attempt measurements stale |
| AC08 | NQ-09 | Inventory proves 12 finished rooms, 25 distinct modeled characters and 150 named modeled props; sources reopen |
| AC09 | NQ-09 | 36 scene image layers, 25 portraits and 24 illustrations have honest generation/edit records and in-game use |
| AC10 | NQ-09 | Eight music cues, 12 ambience profiles, 40 effects and 60 selected voice lines are integrated and auditioned |
| AC11 | NQ-10 | Real Google and GitHub sign-in each pass save/close/restore with isolation; cancel preserves guest play |
| AC12 | NQ-11 | Manual saves and opt-in autosave share one slot; SAVE01–13 pass, including concurrent and retried writes |
| AC13 | NQ-12 | A prior save survives an added future door and safe-position migration without lost notebook/recruit state |
| AC14 | C14 | Core adventure works with keyboard/text controls, reduced motion and 200% text zoom |
| AC15 | C14 | Browser/viewports and performance targets have recorded results; unsupported mobile claims are absent |
| AC16 | C2/C13 | Fresh public checkout builds independently with retrievable sources and license/credit notices |
| AC17 | C12 | Invalid ownership, OAuth state/replay, CSRF, oversized and malformed payloads are rejected safely |
| AC18 | C3/C14 | Beginner playthrough, technical content review and owner's episode review have documented outcomes |
| AC19 | C2/C12 | Staging release and rollback preserve saves and leave analytics/other arcade entries intact |
| AC20 | C5/C14 | Missing assets/audio/WebGL/network produce usable recovery and honest status without false progress |
| AC21 | NQ-13; LO1/LO5/LO6 | Interactive send/receive journeys at R01/R12 display the known payload, toy encoding, impairment and repaired result; upper-layer context is accurately labeled |

### Explicit assumptions and exclusions

Desktop/laptop acceptance is an engineering baseline, not a selected answer to question 20. The additional image/audio quotas, room/prop roster, two-active-ally limit, fictional numeric fixtures and story are authored proposals implementing the owner's direction. They are concrete reviewable defaults and may be changed through the constitution's change process; the user's asset minimums and episode scope remain controlling.

No multiplayer, live network access, real-device credential collection, runtime AI grading/dialogue, professional certification, native app, marketplace or leaderboard is committed. This release does not implement full physical wave simulation or all seven realms. No paid tool, cloud GPU or recurring service is assumed purchased. Resolve unsupported creative-tool/host capabilities at their build gates.

## Refinement record

Each pass assesses and improves this specification; runtime acceptance tests remain future work.

| Pass | Assessment and improvement | Verification |
| --- | --- | --- |
| S01 | Converted the interview into a Physical Layer episode with explicit release quantities and observable requirements | Scope excludes implementation and later-realm delivery; NQ-01–12 are uniquely identified |
| S02 | Authored 12 rooms, an explicit connected graph, three media branches, guest boundaries, and future doors | R01–R12 are unique; each branch reaches the shared finale without an unavailable episode |
| S03 | Defined objectives, party/inventory/notebook behavior, four side quests, three minigames and three outcome classes | Main prerequisite graph has an OR between media routes; optional rewards cannot softlock completion |
| S04 | Added six learning outcomes, 16 independent technical fixtures, character caveats, and primary-source register | Optical/SNR/power/symbol arithmetic checked separately; fictional thresholds are explicitly labeled |
| S05 | Authored 25-character roster, 150-prop allocation and concrete image/audio/voice deliverables | Distinct counts checked; three rendering modes and editable source requirements remain mandatory |
| S06 | Specified guest promotion, one-slot/autosave semantics, failure recovery, conflicts and migrations | SAVE01–12 cover both providers, lost responses, stale writes, failed runs and cross-episode continuity |
| S07 | Defined arcade launch paths, independent contributor build, credits and public/private data boundary | Proposed routes are explicit; real sign-in and playable media are not falsely reported as delivered |
| S08 | Added keyboard/text paths, responsive browser baseline, measurable provisional budgets and episode-qualified migrations | Essential actions have alternatives; mobile support and performance remain evidence claims rather than promises |
| S09 | Added 20 acceptance checks and explicit assumptions; corrected E03 access and login-state preservation | Safe shutdown reaches review without false success; provider windows preserve guest memory; every NQ requirement maps to acceptance |
| S10 | Final review added concrete packet journeys/AC21 and clarified New Adventure for existing accounts | 13 requirements and 21 acceptance IDs checked; 12-room graph, 25 characters, 150 props, 16 technical cases and 12 save cases reconciled |
