# Feature Specification: Spec001 — The Underworld (Physical Layer)

**Feature Branch**: `001-physical-layer-underworld`
**Created**: 2026-11-25
**Status**: Draft — specification prepared for planning; game not implemented
**Input**: User description: "now use the SPEC.md to start the project with the first spec"

**Authority**: [Network Quest constitution v0.2.0](../../.specify/memory/constitution.md).
**Source contract**: [Root SPEC.md](../../SPEC.md), with the [existing build direction](../../PLAN.md).

This is the Spec Kit working view of the complete first episode, derived from the root Spec001
contract. It preserves that contract's IDs, content inventory, behavior and acceptance scope;
it does not replace the root contract or create a smaller episode. Future changes MUST keep
both views consistent. Product rules come from the constitution and root specification;
implementation decisions belong in the plan. Completing a story increment does not complete
Spec001 or authorize publication or work on the next realm.

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
SPDX-License-Identifier: CC-BY-4.0.

## Clarifications

### Session 2026-11-25

- Q: When a signed-in player logs out, what should happen to the currently open adventure? → A: Warn about unsaved progress and allow cancellation. Confirmed logout clears the current adventure from memory and returns to the title screen; the saved account adventure remains intact.

- Q: When retrying a failed encounter or continuing after a safe shutdown, should new notebook entries survive? → A: Restore the encounter and inventory to preparation, but retain new clues, personal notes and hint-use history. Mark measurements from the previous attempt stale.

## User Scenarios & Testing *(mandatory)*

The primary player is a teenage or adult networking beginner acting as an apprentice engineer.
Experienced engineers can inspect optional technical depth. A signed-in player adds durable
progress; a guest can play within the current session. Contributors and the owner review the
finished episode and its reusable source materials. Priorities describe delivery order, not
permission to omit lower-priority release requirements.

### User Story 1 - Begin investigating as a guest (Priority: P1)

A new player enters the Arrival Lift, meets Photon, learns Walk, Look, Talk and Use, and takes
observations to the Titan's Workshop without creating an account.

**Why this priority**: The first interaction must make the adventure and diagnostic method
understandable to a beginner before asking for an identity or prior networking knowledge.

**Independent Test**: In R01/R02, a fresh guest inspects power and link indicators separately,
uses all four verbs, records evidence and pins a hypothesis. This proves a useful tutorial
increment even while later rooms remain under development.

**Acceptance Scenarios**:

1. **Given** a fresh unsigned-in visit, **When** the player chooses New Adventure,
   **Then** R01 begins without sign-in, an AI account or an API key (NQ-01, AC01).
2. **Given** the silent link, **When** the player inspects its indicators and talks to Photon,
   **Then** the notebook distinguishes power from communication and retains the observations
   after entering R02 (O01/O02, NQ-04, AC04).
3. **Given** completed introductory guidance, **When** the guest declines sign-in,
   **Then** play can continue in the current session and the game does not claim durable saving.
4. **Given** a clue-bearing conversation, **When** the player skips or replays dialogue,
   **Then** essential evidence and objectives remain obtainable.

### User Story 2 - Diagnose and validate a physical repair (Priority: P1)

A player chooses copper, fiber or radio, inspects evidence, prepares compatible equipment,
repairs the physical defect and repeats the relevant measurements to validate the result.

**Why this priority**: Observable cause and effect are the central learning and adventure loop.

**Independent Test**: Start each media branch from a prepared Workshop state and complete its
objectives through the Rift and Iron Threshold without visiting the other two branches.

**Acceptance Scenarios**:

1. **Given** R02's briefing, **When** the player selects any one media branch,
   **Then** that branch plus O09/O10 provides a complete route to O11/O12 without future content
   or a mandatory reward from an optional activity (AC02).
2. **Given** an inspectable fault, **When** either of two technically valid repairs satisfies
   all declared conditions, **Then** both are accepted and explained (T16, AC03).
3. **Given** a changed path and an older passing reading, **When** the player attempts to use
   that reading as validation, **Then** it is marked stale and a fresh check is required (T13).
4. **Given** a damaged cable, **When** the player adds a repeater without restoring continuity,
   **Then** the game explains why the path is still broken (T03).
5. **Given** a malformed challenge or unsupported profile, **When** it is encountered,
   **Then** the game reports an authoring problem without penalizing or rewarding the player
   (T14). Hints remain available without affecting the quality of a valid ending.

### User Story 3 - Experience a message as physical signals (Priority: P1)

The player enters a packet-perspective activity, follows a known message through a declared toy
encoding and medium, and compares the recovered message before and after a repair.

**Why this priority**: The episode must make sending and receiving interactive, with clear
boundaries between the physical lesson and explanatory upper-layer context.

**Independent Test**: Run the R01 journey and the corresponding repaired R12 journey from
controlled states, using pause, step and replay with both keyboard and pointer.

**Acceptance Scenarios**:

1. **Given** the known NQ payload, **When** the player steps through transmission,
   **Then** the visible message, toy symbols, impairment and recovered bits agree (AC21).
2. **Given** a diagnosed physical failure, **When** the apprentice repairs it and repeats the
   journey, **Then** the displayed result changes consistently with that repair.
3. **Given** the seven-realm overview, **When** the player inspects the upper stages,
   **Then** they are labeled explanatory context, with no claim that seven independent wire
   headers or a complete higher-layer network are simulated (NQ-13).

### User Story 4 - Save and resume one trustworthy adventure (Priority: P1)

A player signs in with Google or GitHub, deliberately saves one adventure, resumes it on another
device, and understands whether progress is saved, pending, conflicting or only in memory.

**Why this priority**: Players must be able to trust the sole durable save across failures and
updates, without giving up their guest adventure during sign-in.

**Independent Test**: Use a prepared adventure with known inventory, notes and objectives to run
SAVE01–13 with each provider, two devices, interrupted operations and an older content version.

**Acceptance Scenarios**:

1. **Given** a guest adventure, **When** sign-in is canceled, fails or its window closes,
   **Then** the same in-memory state remains playable and no success is claimed (SAVE01).
2. **Given** a new account for either provider, **When** the player saves, closes the browser
   and returns using that provider on another device, **Then** the same owned adventure is
   restored with no other account's progress visible (SAVE02).
3. **Given** an existing saved adventure and a different current run, **When** the player signs
   in or starts New Adventure, **Then** load, explicit replacement and cancel choices protect
   both states until a decision is made (SAVE03).
4. **Given** autosave has never been enabled, **When** the player changes rooms or completes
   objectives, **Then** no adventure save occurs; after opt-in, only the same slot is updated at
   safe boundaries (SAVE04/SAVE05).
5. **Given** a conflicting, repeated or interrupted save, **When** saving resumes,
   **Then** the last confirmed save survives and the player sees the actual outcome rather than
   a silent overwrite or duplicate update (SAVE06–10).
6. **Given** a confirmed account deletion after recent sign-in, **When** it completes,
   **Then** live progress and sessions are removed and backup expiry is explained (SAVE12).
7. **Given** a signed-in adventure with unsaved progress, **When** the player selects Logout,
   **Then** a warning allows cancellation without changing the session or adventure. Confirmed
   logout clears the in-memory adventure and returns to the title screen while preserving the
   saved account adventure; signing in again can restore it (SAVE13).

### User Story 5 - Play through accessible controls and recoverable failures (Priority: P1)

A player uses keyboard and text controls, captions, scalable text, reduced motion or quiet mode
to inspect evidence and complete the same lessons, including when scene presentation fails.

**Why this priority**: Perception, precise pointing, audio or reflex timing must not gate the
learning experience.

**Independent Test**: Complete a representative investigation and its ending with keyboard/text
controls, sound muted, reduced motion and 200% zoom; then repeat scene/network failure cases.

**Acceptance Scenarios**:

1. **Given** keyboard-only control, **When** the player navigates verbs, objects, inventory and
   dialogue, **Then** focus and labeled actions expose every mandatory interaction (AC14).
2. **Given** muted audio or reduced motion, **When** a clue, warning or result occurs,
   **Then** equivalent text and usable controls preserve the lesson.
3. **Given** 200% zoom or a 390 px wide layout, **When** controls and dialogue are displayed,
   **Then** no critical action is hidden or becomes unusable (AC14/AC15).
4. **Given** an unavailable scene or corrupt media, **When** loading fails,
   **Then** retry and equivalent descriptions/actions allow continued diagnosis, and restoring
   presentation preserves the same state (AC20).
5. **Given** a note field or hidden browser tab, **When** typing or backgrounding the game,
   **Then** shortcuts do not perform unintended actions and no hidden timer changes a lesson.

### User Story 6 - Reach an honest outcome and recover from failure (Priority: P1)

A player confronts The Severed using evidence and a prepared repair, then sees a personalized
ending that distinguishes permanent restoration, a temporary bridge and a safe shutdown.

**Why this priority**: Consequences must reinforce engineering truth without destroying the only
recoverable adventure or shaming a beginner for using help.

**Independent Test**: Start from safe Rift preparation and exercise E01, E02, E03 and a dramatic
failure, verifying both temporary retry and Restore Save behavior.

**Acceptance Scenarios**:

1. **Given** a route-closing decision, **When** the player is about to commit it,
   **Then** consequences are explained and safe return to preparation is available beforehand.
2. **Given** fresh validation results, **When** the episode ends,
   **Then** E01 labels permanent restoration, E02 records a temporary limitation, and E03 records
   an unresolved defect and recovery plan rather than a successful repair (AC07).
3. **Given** death or E03, **When** the player continues or retries,
   **Then** safe preparation remains available and the last recoverable save is not overwritten
   by that failure (SAVE06).
4. **Given** a technically valid assisted repair, **When** the epilogue is shown,
   **Then** assistance does not produce a punitive ending. Route, allies, optional actions and
   maintenance decisions can personalize the epilogue.
5. **Given** a failed encounter or E03 with new clues, personal notes, measurements and hint
   use since preparation, **When** the player chooses Retry from Encounter Preparation or E03
   Continue, **Then** the encounter and inventory return to preparation while new clues, notes
   and hint-use history remain. Measurements from that attempt become stale and require fresh
   validation (AC07).

### User Story 7 - Recruit companions and explore optional depth (Priority: P2)

A player discovers protocol creatures, learns their real roles and limits, recruits allies,
combines tools, and follows side quests or optional minigames using a persistent notebook.

**Why this priority**: Companions and optional discovery provide adventure depth and replay value
while retaining technically valid alternatives on the main path.

**Independent Test**: Use prepared discovery states to verify every required recruit's ability
and progression, and start/finish/retry/exit each SQ01–04 and MG01–03 independently.

**Acceptance Scenarios**:

1. **Given** a discovered character, **When** its compendium entry is opened,
   **Then** its identity, role, limitation, portrait and relevant source/context are available;
   all nine required allies have meaningful recruitment and progression (AC05).
2. **Given** two active allies at preparation, **When** the player changes the party,
   **Then** it costs nothing, and equivalent conventional tools still solve required puzzles.
3. **Given** a side quest or minigame, **When** the player skips or exits it,
   **Then** no required item, main objective or ending becomes unreachable (AC06).
4. **Given** evidence from a previous room, **When** a later hypothesis or repair uses it,
   **Then** its source and freshness remain visible and observations remain separate from
   personal notes or speculation (AC04).

### User Story 8 - Explore a finished episode and retain progress through expansion (Priority: P2)

A player experiences twelve coherent, finished rooms with reviewed characters, props, imagery
and sound, then can return to the completed chapter after a later content update. A contributor
can obtain the licensed sources and build the game independently of the private website.

**Why this priority**: The agreed richness, durable world and reusable public project define the
finished release; a playable graybox cannot satisfy them.

**Independent Test**: Audit the full inventory against in-game placements and source materials,
complete each route, and load a prior save after a controlled future-door/location change.

**Acceptance Scenarios**:

1. **Given** the release candidate, **When** all rooms and assets are inspected,
   **Then** 12 rooms, at least 25 distinct character models and 150 distinct props meet their
   source, quality and use requirements without padded counts (AC08–10).
2. **Given** a completed Spec001 save, **When** a later door or safe position changes,
   **Then** achievements, clues, recruits and ending history survive; any relocation is explained
   and optional new objectives remain visibly new (SAVE11, AC13).
3. **Given** a new public contributor, **When** the documented build is followed,
   **Then** required sources are retrievable with licenses and no private website or player data
   is needed (AC16).
4. **Given** an arcade release and its recovery trial, **When** versions are deployed or restored,
   **Then** saves remain recoverable and existing arcade entries and analytics remain intact
   (AC19). Exact staging and release operations belong in the plan.

### Edge Cases

- Wrong or repeated actions give useful feedback without duplicating rewards or consuming a
  required item twice; a necessary unique tool stays recoverable.
- Missing units, negative passive loss, unknown profiles and unsupported challenges are authoring
  errors; numeric boundaries use the declared inclusive/exclusive rule rather than guesswork.
- A viable optical budget cannot override incompatible optics; a powered device is not proof of
  a data link, and a link is not proof of end-to-end application health.
- Skipped dialogue, changed allies, an unvisited route, absent optional rewards and future realm
  doors cannot make the released main story unwinnable.
- A blocked sign-in popup offers a separate-tab action; canceling never discards guest state.
- Switching identity providers does not merge accounts by matching email; another player's
  identity, notes or save cannot be selected by altering submitted data.
- New Adventure, losing, E03, a cutscene, a half-completed transition, expired sign-in, connection
  loss, simultaneous devices and lost confirmations cannot silently replace a confirmed save.
- Unsupported newer saves remain intact; supported older saves preserve achievements and move
  obsolete positions only to an explained safe location.
- Missing/corrupt imagery, unavailable audio, lost scene rendering, muted playback, touch without
  hover, enlarged text, reduced motion and background tabs preserve essential information.
- Canceling the logout warning leaves the session and current adventure unchanged; confirmed
  logout does not continue that adventure as a guest or automatically save unsaved progress.
- Retrying cannot turn retained measurements into current validation or erase hint-use history;
  encounter and inventory rollback must not duplicate rewards or retain consumed-item changes.
- An operational backup is never exposed as a second player-selectable save slot.

## Requirements *(mandatory)*

### Functional Requirements

The original NQ identifiers and their meanings are retained. Each row is a MUST requirement;
the subsequent FR requirements make the same source contract's detailed behavior explicit.

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

| ID | Required observable behavior | Acceptance |
| --- | --- | --- |
| FR-001 | The game MUST provide four verbs, inventory combinations, keyboard equivalents, skippable/replayable dialogue and persistent clue access. | US1; AC01/AC04/AC14 |
| FR-002 | All 12 rooms MUST be meaningful explorable scenes; each copper/fiber/radio path MUST reach the finale without another route or unavailable realm. | US2; AC02/AC08 |
| FR-003 | The notebook MUST distinguish evidence, hypotheses and personal notes; retain source/freshness and mark affected readings stale after a change. | US1/US7; T13; AC04 |
| FR-004 | Each mandatory objective MUST expose inspectable evidence, a networking outcome, valid alternatives and a method-to-worked-step-to-solution hint ladder. Assistance MUST be recorded separately. | US2; T16; AC03/AC18 |
| FR-005 | Scored rules MUST use declared models and independently checked correct/incorrect/boundary cases. Invalid content MUST never be graded as learner failure. | US2; T01–T16; AC03 |
| FR-006 | R01/R12 MUST provide interactive, pausable, replayable physical send/receive journeys with truthful upper-layer context. | US3; AC21 |
| FR-007 | All 25 characters MUST have accurate compendium roles/limits; nine required recruits MUST have demonstrated recruitment, progression and state-changing abilities. Two active allies and equivalent tools MUST support safe preparation. | US7; AC05 |
| FR-008 | SQ01–04 and MG01–03 MUST support instructions, completion or retry, and exit. Optional timing MUST start disabled; no reflex skill or score may gate the main lesson. | US5/US7; AC06 |
| FR-009 | Consequential decisions MUST warn before commitment; E01/E02/E03 MUST distinguish permanent repair, temporary restoration and unresolved safe shutdown with personalized epilogues. | US6; AC07 |
| FR-010 | Failure MUST explain cause and offer safe temporary retry or Restore Save as appropriate; it MUST NOT silently overwrite the sole recoverable save. In-session retry and E03 Continue MUST restore encounter/inventory preparation state while retaining new clues, personal notes and hint-use history; measurements from the previous attempt MUST become stale. | US6; SAVE06; AC07/AC12 |
| FR-011 | Guest play MUST survive sign-in cancellation/failure. Both Google and GitHub MUST support return to the same account; provider switching MUST NOT silently merge identities. | US4; SAVE01–03; AC11 |
| FR-012 | One logical account slot MUST preserve progress across reload, logout, deployment and devices; starting a new run MUST require a deliberate decision before replacing a prior save. | US4; SAVE02/03/11; AC11–13 |
| FR-013 | Autosave MUST default off, explain replacement of the same slot, apply across devices and operate only at safe boundaries; terminal failure, E03 and incomplete transitions MUST never be autosaved. | US4/US6; SAVE04–06; AC12 |
| FR-014 | Save status MUST distinguish unsaved, saving, confirmed and failure/conflict states. Conflicts or repeated/interrupted saves MUST protect confirmed progress and require an explicit replacement decision. | US4; SAVE07–09; AC12 |
| FR-015 | Identity and progress MUST be isolated by account. Sign-in, save and deletion actions MUST reject forged, replayed, unauthorized or malformed requests without changing another account. | US4; SAVE10/12; AC17 |
| FR-016 | Settings MUST provide logout, confirmed account deletion, an explanation of saved data and the backup expiry policy. Logout MUST warn about unsaved progress and allow cancellation; confirmed logout MUST clear the current adventure from memory and return to the title screen without replacing or deleting the saved adventure. Deletion MUST remove live progress and active sessions after recent sign-in. Lost-response deletion MUST remain unconfirmed until operation-specific completion is verified; guest session status alone is insufficient. | US4; SAVE12/13 |
| FR-017 | Every counted model/prop MUST have stable identity, editable Blender source, usable export, attribution/license and observed in-game placement; recolors and duplicate instances MUST NOT inflate counts. | US8; AC08 |
| FR-018 | The episode MUST deliver the complete image, portrait, illustration, music, ambience, effect and selected-voice inventory below with honest production records and actual visual/listening review. | US8; AC09/AC10 |
| FR-019 | All mandatory actions and evidence MUST be available through labeled keyboard controls and text; color, sound, hover, motion and precise pointing MUST NOT be the only channel. | US5; AC14 |
| FR-020 | Text scaling, captions, focus, reduced motion, separate audio controls and responsive/touch actions MUST preserve the lesson, including at 200% zoom and specified narrow widths. | US5; AC14/AC15 |
| FR-021 | Missing media, scene or network services MUST expose recoverable actions and honest state; quiet and low-detail modes MUST retain required observations. | US5; AC20 |
| FR-022 | Supported desktop browsers, including Mac Safari, MUST meet recorded load, play and save targets; full phone/tablet performance MUST NOT be advertised without real-device evidence. | US5/US8; AC15 |
| FR-023 | The game MUST build from public sources independently of the private website and integrate through a versioned boundary on the existing GoDaddy host, without using the analytics store for game data. | US8; AC16/AC19 |
| FR-024 | Credits MUST identify creators, licenses, reused sources and media provenance. Public source/releases MUST exclude credentials, player records, backups and private website material. | US8; AC16/AC17 |
| FR-025 | Content updates MUST preserve stable episode-qualified identities, achievements and recoverable saves; removed locations and renamed content MUST have explicit migration behavior. | US8; SAVE11; AC13 |
| FR-026 | Release MUST satisfy AC01–21 with content review, human play, inspected/auditioned media and owner satisfaction; later episodes MUST wait for current-episode acceptance. | US1–US8; AC18 and full release matrix |

### Constitutional Scope and Traceability *(mandatory)*

This feature is the complete Physical Layer / Underworld episode. It includes a guest opening,
three alternative physical repair routes, shared Workshop/Market/Clockworks activities, the Rift,
three outcome classes, optional activities and a returnable ending. It teaches selected physical
models rather than simulating all networking or granting a professional certification.

| Rule / interview decisions | Observable requirements | Acceptance evidence |
| --- | --- | --- |
| C1 / 01, 04, 05, 06 | Beginner-first apprentice adventure, optional depth, original warm/witty world; NQ-01/NQ-13 | US1/US3; AC01/AC18/AC21 |
| C2 / 20, 23, 25 | Public browser project, arcade distribution, same host and explicit stage boundaries; FR-023/026 | AC16/AC19; specification-only status |
| C3 / 02, 03, 08, 16 | Physical first, 60–120 minute main run, 12 rooms, 25 models, 150 props; FR-002/017/026 | AC02/AC08/AC18 |
| C4 / 07, 09, 10, 11, 12 | Four verbs, notebook, compendium, allies, side activities and personalized ending; FR-001/003/007–009 | AC01/AC04–07 |
| C5 / 14, 15, 17, 18, 19 | Coherent mixed media, real generated images and selected auditioned voice; FR-017/018 | AC08–10/AC20 |
| C6 / 21, 22, 23 | Guests, both providers, one slot, opt-in autosave, dedicated game service; FR-011–014/023 | AC11/AC12/AC19 |
| C7 / 01–25 | All interview decisions retained and authored defaults distinguished; this table and assumptions | Coverage review; AC18 |
| C8 / 02, 08 | Stable world identities, revisits and future boundaries; NQ-12/FR-025 | SAVE11; AC13 |
| C9 / 09, 10, 12, 13 | Evidence, equivalent solutions, graduated hints, untimed core and recoverable consequences; FR-004/008–010 | T13–T16; AC03/AC06/AC07 |
| C10 / 04, 10, 11 | Declared accurate models and interactive packet journeys; FR-005/006 | T01–T16; AC03/AC21 |
| C11 / 14–19 | Honest quantities, editable sources, actual production, use and review; FR-017/018 | AC08–10 |
| C12 / 21, 22 | Account ownership, safe single save, isolation, deletion and continuity; FR-011–016/025 | SAVE01–13; AC11–13/AC17 |
| C13 / 24 | Permissive original work, retained third-party terms and private-data exclusion; FR-024 | AC16/AC17 |
| C14 / 07, 13, 20 | Accessible actions, measured browser quality and evidence-based completion; FR-019–022/026 | AC14/AC15/AC18/AC20 |
| C15 / 02, 25 | Source IDs → stories/requirements → acceptance; implementation decisions deferred to plan | All matrices; quality checklist |

#### Adventure and release envelope

The Iron City's beacon has fallen silent. Deep below it, the Titan's transmission works are failing: copper conduits misbehave, the light gardens have darkened, and the wireless relay hears a storm of contradictory signals. An apprentice engineer arrives with a notebook and an inconveniently optimistic firefly named Photon.

The player must investigate, recruit useful allies, restore a physical path, and prove that it works. The Backhoe of Doom is the first manifestation of The Outage, called The Severed. It cannot be defeated by subtracting health points. Evidence, a sound repair, and repeatable validation resolve the encounter.

A successful first episode ends at a functioning connection to the Iron City; a safe-shutdown ending explicitly leaves service unresolved. Each has its own completed story and personalized epilogue even before Spec002 exists. Later episodes can turn that boundary into a traversable route and add consequential return visits.

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

#### Core play loop

Explore a room → observe a symptom → record evidence → talk or inspect → form a hypothesis → select a tool/ally → make a repair → run the same relevant check again → observe consequences and update the notebook.

The player sometimes becomes the packet's perspective to see a message represented as a transmitted bit stream. A physical link carrying signals does not by itself prove that DNS, routing, authentication, or an application works. The story's higher-layer dependencies are explicitly known-good for a scoped link-validation challenge.

#### Rooms and progression

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

##### Walk graph and unlocks

Bidirectional walk edges: `R01–R02`; `R02–R03`; `R02–R05`; `R02–R07`; `R02–R09`; `R02–R10`; `R03–R04`; `R05–R06`; `R07–R08`; `R04–R11`; `R06–R11`; `R08–R11`; `R10–R11`; `R11–R12`. Returning through earlier rooms stays possible unless an explicitly narrated, reversible encounter temporarily blocks an edge.

R01 and the introductory part of R02 comprise the guest introduction. After the tutorial, guests may continue playing the episode in the current session; signing in is required to retain account progress. Never imply that guest progress is already saved.

After R02's briefing, the three media branches and R09/R10 are available. Each branch contains foundational and applied puzzles. Inspecting R11 requires a validated branch plan and the Clockworks safety/timing briefing. R12's validation balcony opens after the Rift is safely repaired or deliberately isolated. Success outcomes still require fresh scenario checks to pass; reaching the balcony does not prove restored service. A player can complete the main story through copper, fiber, or wireless; no route demands mastery of an unvisited route.

The 60–120 minute target covers introduction, one media route, shared workshop/market/Clockworks activities, the Rift, and epilogue. Full exploration of all rooms, remaining routes, and side quests takes longer. Side routes remain accessible after a successful ending through Continue.

##### Connections to later episodes

The Iron Threshold has a clearly labeled story boundary until Spec002 is released. A distant application beacon illustrates purpose, without pretending its services are currently simulated. Later episode updates may activate the Iron City door, add a repair request to the Workshop, or revisit the restored link as a dependency in a larger outage. Spec001's own ending and all existing valid repair options remain completable.

#### Objectives and branching quest contract

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

##### Inventory, notebook, and companion interactions

Each hotspot offers meaningful supported verbs and a helpful response for unsupported ones. Look returns persistent evidence, not just flavor text. Talk supports skippable, replayable conversation topics; evidence and objectives cannot disappear because a line was skipped. Use supports item-to-hotspot, item-to-item, and selected ally-to-target actions. Valid combinations consume items only when their documented transformation requires it; plot-critical tools remain recoverable.

The notebook has Objectives, Evidence, Hypotheses, Maps and Personal Notes. Entries name their source room, observed condition and freshness. Distinguish observations from player hypotheses and character speculation. Pin objectives across rooms; selecting a reference can highlight a visited location. User notes are plain text. A changed link marks related readings stale until measured again. Hints and worked examples stay available after leaving their room.

The compendium records discovered identity, actual technology, ability, limitation, realm/cross-realm note, recruitment condition, progression, and evidence/source references. Nine required recruitable allies are Photon, Copperhead, Unicorn, optical Hydra, Thunderbird, Hermit Crab, Electric Eel, Echo Bat and Chameleon. Others are NPCs, mentors or opponents. The player takes up to two active allies into an encounter and can change the party at safe locations without cost. If a necessary ally is absent, preparation remains reachable. Equivalent conventional tools can solve required puzzles; collecting everything is not mandatory.

Recruitment follows a demonstrated interaction; progression unlocks more precise inspection, explanations, or an additional valid use. It does not make fiber carry electrical power or give a repeater routing knowledge. Variants represent different technical roles, not a universal ladder from an inferior protocol to a superior one. Record assisted completion honestly.

##### Optional activities

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

##### Outcomes and failure

- **E01 — The Steady Light:** a permanent route passes every scoped validation; the final scene celebrates restored service and records route/allies/observations.
- **E02 — The Borrowed Dawn:** a clearly temporary route passes its declared service checks, with its limitation and follow-up recorded. This is successful temporary restoration, not a claim of permanent repair.
- **E03 — The Honest Shutdown:** an unresolved defect is identified; the player intentionally isolates the unsafe path. The episode closes with a recovery plan rather than calling the outage repaired. Continue returns to a safe pre-commit preparation state.

Each outcome has a personalized epilogue based on the chosen route, side quests, characters helped, and maintenance decisions. Assistance does not turn an otherwise valid repair into a bad ending. A failed guess at the Rift gives a specific observation and a route back to diagnosis. Dramatic deaths use a short skippable scene, explain the cause, and offer Restore Save or a clearly labeled in-memory Retry from Encounter Preparation. The latter is temporary session recovery, not a second persistent save slot. Guests can retry in memory but cannot restore an account save until signed in.

Retry from Encounter Preparation and Continue after E03 MUST restore the encounter and inventory to their safe preparation state while retaining new notebook clues, personal notes and hint-use history from the attempt. Measurements obtained during that attempt MUST remain visible as stale and MUST NOT count as current validation until measured again. This rule applies to in-session retry, not Restore Save, which loads the confirmed saved adventure. Retained information becomes durable only through the existing safe manual-save or opt-in autosave rules; retry does not create another persistent slot.

### Teaching Model and Evidence *(mandatory for scored networking content)*

LO1–LO6 and T01–T16 retain their original identifiers and expected results. These are
specified cases, not claims that implementation tests have run. Each production rule MUST add
reviewed source/profile detail and independent boundary coverage before it grades a player.

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

#### Technical guardrails for characters

Copperhead carries electrical signaling; Photon carries light. Single-mode and multimode characters describe optical propagation, not one versus several guaranteed payload lanes. An SFP shell or QSFP-shaped Chimera is a form-factor metaphor; supported rates, lanes, optics and breakouts belong to a specified module profile. The Eel illustrates supplied power as well as data, without implying that power proves connectivity. The Metronome illustrates signal timing, not NTP. Chameleon can choose common capabilities, not invent compatibility.

An Echo Bat or hub-style exhibit regenerates/repeats a signal and does not learn addresses or route traffic. Wireless signal strength is only part of a usable link. The narrator identifies a full application test as a cross-layer observation, even when the current puzzle isolates a physical fault. Optional advanced descriptions name assumptions rather than overwhelming the first lesson.

#### Source register

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

#### Packet perspective and encapsulation

At R01, the apprentice can step into a controlled test message's journey; at R12, repeat it over the repaired route. The lab highlights a known two-byte payload, `0x4E 0x51` (the letters NQ), within an opaque frame supplied by the upper interface. Its highlighted bits are `01001110 01010001`. The whole Ethernet frame is not represented as only those two bytes.

The player inspects the handed-down data, selects the compatible medium, steps through a declared toy symbol mapping, observes transmission/impairment, and compares recovered bits with the known test pattern. Pause, step and replay controls work by keyboard and pointer. A failure names the modeled defect and returns to the apprentice's investigation; a repair changes the displayed transmission result. Comparison against a known laboratory pattern must not be described as universal Layer 1 error detection or Ethernet FCS validation.

A seven-realm overview shows where the current activity sits: application meaning above, representations and conversations, transport, network, link framing, then physical signals. In Spec001 these upper stages are explanatory context; only the scoped physical path is simulated. Receiving reverses the applicable transformations. Later episode specs extend the shared journey with actual framing/addressing/routing/transport/service decisions and documented cross-realm caveats. Do not insert a fictional independent header for every OSI layer.

### Persistence, Media, Access and Distribution *(mandatory; justify non-applicable areas)*

All four areas apply to the complete episode. Blender source, actual OpenAI imagery, the two
identity providers and the existing host are inherited owner/constitutional constraints, not
new implementation selections. No language, framework, database product or service interface
is selected by this feature specification.

#### Required media inventory

##### Required character roster

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

##### Prop allocation: 150 distinct assets

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

##### Imagery and room presentation

Require a generated-image set for every room: at least one accepted background plate and two independently usable foreground/midground/atmosphere layers, for at least 36 delivered layers. These may derive from carefully separated elements of a generated scene; do not misreport derivatives as separate generation calls. Add 25 character portraits and at least 24 inventory/diagnostic illustrations. Record actual generation requests, accepted outputs and edits. Layer depth, transparency, perspective and lighting must align with the scene.

Prove all three presentation modes: R01 uses a real-time 3D focal set; R05 uses layered generated/rendered scenery with real-time characters and props; R04 includes Blender-rendered sprite animation in a composed room. Use the same interface and interaction model everywhere. Primary directions: luminous underground industry, tactile machinery, organic protocol creatures, unexpected changes of scale and impossible-but-readable spaces. Keep textual controls as real accessible UI, never baked into artwork.

##### Audio and voice

Deliver at least eight original music cues: title, workshop, copper, fiber, radio, Clockworks, Rift and epilogue. Each needs a usable loop or authored ending as appropriate. Provide 12 room ambience profiles and at least 40 purposeful effects covering interfaces, footsteps, machinery, character abilities, measurements, repairs and failures. Shared effects need not be duplicated to count.

Use modern AI-assisted production with retro melodic/timbral references. Selected voice coverage includes the narrator, Titan, Photon and Hermit Crab: at least 60 reviewed lines across tutorial, key clues, reactions and endings. This is selective voice-over, not every NPC line. Audition networking pronunciations and emotional readability before scaling production. Music, effects and voice have separate controls; important sounds also have text/visual equivalents. Playback starts only after player interaction.

#### Account and single-save behavior

##### Sign-in experience

The title screen offers New Adventure, Continue, Settings and Credits. A first-time unsigned-in player begins as a guest. An already signed-in player keeps that identity when starting a new in-memory adventure, subject to the existing-save replacement rules. Sign-in is offered at the end of the introduction and whenever a guest selects Save. Both Google and GitHub are real provider choices. Canceling or failing sign-in returns to the existing in-memory adventure; it never restarts the game or claims a save succeeded.

Open provider authentication in a user-initiated separate window or tab so the gameplay tab retains guest state. If a popup is blocked, offer an explicit Open Sign-in Tab action. Do not navigate the only game tab away and then claim its in-memory progress survives. After sign-in completes, the game confirms the signed-in identity before offering save adoption. Closing the sign-in window is a cancel, not a game restart.

If the account has no save, offer to save the current guest adventure. If it already has a save, show its chapter, room, timestamp and outcome summary, then offer Load Existing Save or Replace With This Adventure with a clear replacement confirmation. Do not merge inventories or silently favor the newer client clock. Cancel preserves both the server save and current guest state.

An account is associated with its sign-in provider and a stable identity from that provider. Google and GitHub logins are supported independently; switching providers does not silently merge accounts. Show the signed-in provider so players know how to return to their save. Explicit linking of providers can be specified later; matching email alone never links them.

Logout MUST warn when the current adventure has unsaved progress and allow cancellation. Canceling leaves the signed-in session and current adventure unchanged. Confirmed logout ends the signed-in session, clears the current adventure from memory and returns to the title screen. It MUST NOT automatically save, replace or delete the saved account adventure, or continue that adventure as a guest. Signing in again allows the existing save to be restored.

After an account-deletion request loses its response, show deletion as unconfirmed until that specific operation is confirmed by the server. Being signed out does not prove deletion. A status check must not repeat deletion or silently create/sign in to an account. If confirmation is unavailable or expired, keep the outcome unconfirmed and explain that a new destructive attempt requires a fresh explicit choice.

##### Slot contract

There is exactly one logical slot per account. It records the episode/content version, safe room and position, quest and world flags, inventory, recruits/party, compendium, notebook/evidence/notes, assistance, selected route/outcomes and a server revision/timestamp. Account preferences are stored separately from the adventure snapshot; they are not another slot.

Manual Save is available during stable exploration after an action completes. During a cutscene, dialogue transaction, transition, fatal outcome or write in progress, explain the temporary restriction and preserve the prior save. Loading or starting a new adventure warns when current progress is unsaved. A new in-memory adventure does not destroy the saved adventure until the player explicitly replaces it.

Autosave is off for a new account. Its opt-in explains that it overwrites the same slot and applies to the account across devices. When enabled, it may save after a safe room arrival, a completed objective with feedback dismissed, or a safe encounter preparation point. Debounce repeated triggers; personal notes may join the next safe snapshot. Never auto-replace a prior adventure immediately after New Adventure: first obtain the replacement decision. Autosave never writes terminal failure, E03's shutdown state, or an unresolved transition. Successful E01/E02 outcomes may be saved with a safe Continue location.

Show `Unsaved changes`, `Saving…`, `Saved at <server time>`, or a specific failure/conflict message. On a connection failure, continue the in-memory session and retain the confirmed server save. On authentication expiry, preserve the current in-memory state and request sign-in before saving again. Do not call browser memory a durable save or promise that closing an offline tab is safe.

##### Conflict and update behavior

When another device has changed the saved adventure since the player last loaded it, saving MUST report a conflict. Offer Load Server Save, Keep Playing Without Saving, and an explicit Replace Server Save action after showing the current server summary. Replacement MUST check that the reviewed save has not changed again; a further change produces another conflict. Automatic conflict merging is out of scope.

Unsupported newer saves are preserved and explained. Supported older saves migrate through a tested version chain before play resumes. Removed positions move to an authored safe point with an explanation; renamed IDs use explicit mappings. New future doors and notebook entries do not erase old accomplishments or pretend unplayed content was completed.

##### Persistence acceptance cases

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

#### Input and accessible presentation

Proposed keyboard defaults: W/L/T/U select Walk/Look/Talk/Use; I opens inventory; N opens notebook; C opens compendium; Tab moves among visible controls/hotspots; Enter activates; Escape closes the top panel; arrow keys navigate grouped choices. Shortcuts must not fire while typing notes or using a text field. All shortcuts also have visible labeled controls. Touch selects the same verbs and hotspots without relying on hover.

Provide a selectable list of named scene objects/exits, text descriptions of important visual states, accessible diagnostic tables and announced feedback. The player can perform the core adventure through this semantic interface even when the scene is unavailable. Restoring scene rendering returns to the same state. Do not put essential text only into a texture or a flashing effect.

Use readable default text, scalable dialogue and captions, visible focus, and redundant labels for status colors. At 200% zoom controls must remain usable. Reduced motion suppresses nonessential camera motion/flashes and shortens transitions without delaying feedback. Pause simulation presentation when the tab is hidden; no invisible timer changes a mandatory puzzle. Music/effects/voice controls are independent and persist as account preferences when signed in.

Owner interface refinement (2026-11-26), preserving FR-019–021: the adventure is
one contained Sierra Quest-style game screen. Compact verbs/inventory live inside
the frame; descriptions, named-object actions, evidence, notebook, dialogue and
game/account/sound settings appear on demand within it. No long webpage of text
buttons or menus may extend below the room during ordinary play. Keyboard/text
access, focus restoration, captions, 200% readability and complete text mode remain
required. This follows the owner-reviewed R01 finding and the corresponding
[root presentation requirement](../../SPEC.md#input-and-accessible-presentation);
revised R01 browser/access checks and owner review precede acceptance.

#### Browser compatibility and player-visible performance

The supported desktop baseline includes Mac Safari and current and previous supported major
Safari, Chromium and Firefox versions at release. Record exact tested versions, reference
hardware and network conditions. The desktop promise covers full keyboard play at 1280×720 and
1440×900; responsive controls at 768 px and 390 px widths must retain critical actions. Touch
layout checks do not establish full phone/tablet performance support.

A first room must be interactive within 12 seconds on the declared reference laptop at 20 Mb/s
and 50 ms latency. Ordinary exploration must sustain at least 30 frames per second at default
settings, with worst scenes and sustained dips reported. At least 95% of saves must confirm
within 2 seconds in a controlled staging trial with 20 mixed active sessions; errors and host
limits must be reported rather than omitted from the results.

The source [performance envelope](../../SPEC.md#compatibility-and-provisional-performance-budgets)
also supplies provisional resource budgets for implementation planning. Those constraints remain
in force; this feature view does not waive them or claim measured results. G0/G3 must record
feasibility and any evidence-based budget revision while retaining the release asset quantities.

#### Distribution, privacy and reuse

Players discover Network Quest through `automateyournetwork.com/arcade/` and can open a full-page
browser adventure. The existing GoDaddy host is the selected deployment location. The public
project must be buildable without the closed website, with versioned integration, retrievable
licensed source materials, documented setup and recoverable release changes. Final public game
paths remain subject to the existing arcade conventions recorded in the source contract.

Game identity, saves and operational backups must use dedicated game storage and never the
website analytics store. Request only identity information required to sign in, with no
repository, contacts or unrelated access. Players must need neither a model account/API key nor
creative tools to play. Public source, credits and release packages must exclude credentials,
private website material, account records and backups. Original work and any imported component
must satisfy the constitution's declared permissive reuse and attribution policy.

Credits must identify original creators, reused sources/licenses and generated/edited media
honestly. Detailed production metadata belongs in contributor documentation. Settings must
explain saved data, sign-in provider, logout, deletion and backup expiry without interrupting the
adventure. Account pages and saves must not become public searchable or downloadable content.

#### Expansion and content updates

Save references qualify local IDs with their episode, such as `spec001:R12`, so later realms can reuse readable local numbering without collision. A new episode can add an exit from R12 while preserving O12 and its ending history. If a saved location no longer exists, its migration maps to a specified safe location and explains the relocation. Optional new objectives are shown as new; old completion is not revoked without a documented educational correction.

Regressions for every expansion include: all three Spec001 media routes; its three outcome classes; safe in-memory retry; one-slot manual/autosave behavior; and an older save containing notebook clues, recruits and a personalized epilogue. Save an unaffected baseline fixture before developing the new realm and test it through the migration chain.

### Key Entities *(include if feature involves data)*

| Entity | Meaning and essential information |
| --- | --- |
| Player identity | Guest or signed-in identity, provider, account ownership and current sign-in state; matching email is not account linking |
| Adventure save | One account-owned confirmed snapshot with content version, safe room/location, progress, route/outcome history and save revision/time |
| Account preferences | Autosave choice, audio, text and motion settings; distinct from the adventure snapshot and never an extra slot |
| Room / exit | Stable episode-qualified room identity, named objects, available actions, connected exits and understandable unlock conditions |
| Objective / outcome | Prerequisites, learning purpose, evidence needed, accepted alternatives, hints and completion/repair/shutdown consequences |
| Evidence / notebook entry | Observation source, measurement and freshness; hypotheses and free-text personal notes are distinguishable. New clues and personal notes survive in-session retry; measurements from the prior attempt become stale. |
| Item / tool | Stable identity, allowed combinations/uses and recoverable availability for any required main route |
| Character / recruit | Stable identity, accurate role and limitations, discovery/recruitment conditions, progression and usable abilities |
| Compendium entry | Portrait, role, ability, limitation, cross-realm caveat, recruitment/progression and source references |
| Teaching profile / rule | Declared assumptions and units, authoritative references, correct/incorrect/boundary examples and supported alternatives |
| Media asset | Stable semantic identity, editable source, usable export, license/attribution/provenance, in-game use and review status |
| Temporary encounter retry | Session-only encounter/inventory preparation state restored alongside retained clues, personal notes and hint-use history; prior-attempt measurements become stale. It is distinct from loading the persistent account save. |

## Success Criteria *(mandatory)*

### Measurable Outcomes

These are release targets, not results achieved by creating this specification. Measure novice
playtime separately from optional exploration and record assistance rather than inferring
independent learning from a correct guess.

| ID | Verifiable outcome | Acceptance coverage |
| --- | --- | --- |
| SC-001 | A fresh guest reaches R02, uses all four verbs and carries a recorded observation forward without an account or paid service. | AC01/AC04 |
| SC-002 | Each of the three media routes independently reaches a valid successful ending; all twelve rooms are finished and explorable, and E01/E02/E03 are separately reachable. Both failure retry and E03 Continue restore encounter/inventory preparation state while preserving clues, notes and hint-use history and marking prior-attempt measurements stale. | AC02/AC07/AC08 |
| SC-003 | The first unassisted or lightly assisted main-story run targets 60–120 minutes in recorded beginner play, excluding optional route completion; thinking remains untimed. | AC18 |
| SC-004 | Every mandatory objective exposes inspectable evidence, an accepted action and an explanation; all 16 independent cases have the specified results, and both R01/R12 message journeys agree with the declared message and repair state. | AC03/AC21 |
| SC-005 | All 25 compendium entries describe roles and limits; all nine required recruits have usable progression/abilities; all four side quests and three minigames can be completed/retried and exited without gating the main route. | AC05/AC06 |
| SC-006 | At least 25 distinct character models and 150 distinct props have usable source materials and meaningful in-game placements; at least 50 props expose an interaction or readable evidence, with duplicates excluded from counts. | AC08 |
| SC-007 | The episode contains at least 36 usable scene layers, 25 portraits and 24 diagnostic/inventory illustrations, with reviewed provenance and in-game use. | AC09 |
| SC-008 | At least eight music cues, twelve room ambience profiles, forty effects and sixty selected voice lines are integrated and audibly reviewed, with equivalent essential text. | AC10 |
| SC-009 | Both sign-in choices pass save/close/restore, and all thirteen persistence cases pass, including simultaneous devices, lost confirmations, logout, deletion and preservation of the last recoverable save. | AC11/AC12/AC17 |
| SC-010 | On the recorded reference laptop at 20 Mb/s and 50 ms latency, first-room interaction begins within 12 seconds and ordinary exploration sustains at least 30 frames per second at default settings. | AC15 |
| SC-011 | At least 95% of saves confirm within 2 seconds during a 20-session mixed-load staging trial; failures and conflicts remain visible and preserve confirmed progress. | AC12/AC15 |
| SC-012 | The complete core adventure works through keyboard/text controls, muted audio, reduced motion and 200% zoom in the declared desktop browser/viewports; narrow layouts retain all critical actions. | AC14/AC15/AC20 |
| SC-013 | An older adventure survives a future-door change and safe-location migration with notebook, inventory, recruits, achievements and ending history intact and any relocation explained. | AC13 |
| SC-014 | A fresh public contributor can retrieve licensed sources and build independently; staged release and recovery preserve saves, other arcade games and analytics. | AC16/AC19 |
| SC-015 | A beginner playthrough, technical content review, media inspections/listening and owner episode review have recorded findings; release-blocking findings are resolved and the owner accepts the episode before the next realm begins. | AC18 and full matrix |

### Release Evidence *(mandatory)*

AC01–21 retain the source acceptance identities. Each requires actual recorded results before
the episode is complete. The table records planned checks; specification validation does not
constitute gameplay, identity, source-media, performance or deployment evidence. Detailed
technical security cases remain in the root acceptance contract and must be addressed in the
plan without reducing their coverage.

| Acceptance | Requirements / outcomes | Observable acceptance | Status |
| --- | --- | --- | --- |
| AC01 | NQ-01; LO1 | Fresh guest reaches R02 using tutorial controls, without an account or API key | Planned |
| AC02 | NQ-02; O03–O12 | Copper, fiber and radio each independently reach a valid successful ending | Planned |
| AC03 | NQ-03; LO2–LO6 | Every mandatory objective exposes evidence, an accepted action and an explanation; T01–T16 pass | Planned |
| AC04 | NQ-04 | A clue from one room remains usable in another; stale readings are identified | Planned |
| AC05 | NQ-05, NQ-06 | All 25 entries have role/limitation/art; all nine required recruits have progression and abilities | Planned |
| AC06 | NQ-07 | Four side quests and three minigames each start, teach, finish/retry and exit; none gates the main route | Planned |
| AC07 | NQ-08 | All three outcome classes are reachable; failure explains recovery and cannot silently destroy the save. Failure retry and E03 Continue restore encounter/inventory preparation state, retain clues/notes/hint-use history and mark prior-attempt measurements stale | Planned |
| AC08 | NQ-09 | Inventory proves 12 finished rooms, 25 distinct modeled characters and 150 named modeled props; sources reopen | Planned |
| AC09 | NQ-09 | 36 scene image layers, 25 portraits and 24 illustrations have honest generation/edit records and in-game use | Planned |
| AC10 | NQ-09 | Eight music cues, 12 ambience profiles, 40 effects and 60 selected voice lines are integrated and auditioned | Planned |
| AC11 | NQ-10 | Real Google and GitHub sign-in each pass save/close/restore with isolation; cancel preserves guest play | Planned |
| AC12 | NQ-11 | Manual saves and opt-in autosave share one slot; SAVE01–13 pass, including concurrent and retried writes | Planned |
| AC13 | NQ-12 | A prior save survives an added future door and safe-position migration without lost notebook/recruit state | Planned |
| AC14 | C14 | Core adventure works with keyboard/text controls, reduced motion and 200% text zoom | Planned |
| AC15 | C14 | Browser/viewports and performance targets have recorded results; unsupported mobile claims are absent | Planned |
| AC16 | C2/C13 | Fresh public checkout builds independently with retrievable sources and license/credit notices | Planned |
| AC17 | C12 | Wrong-account access, forged/replayed sign-in, cross-site actions and oversized/malformed submissions are rejected safely | Planned |
| AC18 | C3/C14 | Beginner playthrough, technical content review and owner's episode review have documented outcomes | Planned |
| AC19 | C2/C12 | Staging release and rollback preserve saves and leave analytics/other arcade entries intact | Planned |
| AC20 | C5/C14 | Missing assets, audio, scene rendering or network access produce usable recovery and honest status without false progress | Planned |
| AC21 | NQ-13; LO1/LO5/LO6 | Interactive send/receive journeys at R01/R12 display the known payload, toy encoding, impairment and repaired result; upper-layer context is accurately labeled | Planned |

Evidence must record the tested content version, conditions, result, reviewer and any remaining
failure. A later plan must map every FR and AC to concrete work and an evidence location.
Independent technical cases, actual media inspection/listening, human play and the owner's
review answer different questions and are all required where stated.

## Assumptions

- Root `SPEC.md` remains the detailed Spec001 source contract. This feature organizes that same
  scope for Spec Kit; it is not a competing replacement. `PLAN.md` remains the starting build
  direction until the planning phase refines it.
- Desktop/laptop browsers, including Mac Safari, are an engineering baseline. Responsive controls
  and touch affordances are required; full mobile performance is a claim to verify, not an
  already selected device guarantee.
- The authored story, twelve-room roster, 150-prop allocation, nine recruit choices, limit of
  two active allies, extra image/audio quotas and toy numeric profiles are the source's reviewable
  defaults. Changes must preserve owner commitments and follow constitutional change control.
- Guest play can continue beyond the introduction during the current session. Durable progress
  requires sign-in. In-session retry is not a second save; unsupported offline persistence is
  not promised.
- Google and GitHub identify separate accounts unless an explicit future linking feature is
  specified. Matching emails do not link accounts automatically.
- The existing host is selected, but current capacity, provider registrations, credentials,
  callback behavior and restore capability remain G0/G2 implementation prerequisites.
- Backup duration, operational retention and actual public routes must be recorded in the plan
  before public accounts or release. The player must see the actual deletion/backup policy;
  planning readiness does not claim those operational decisions are configured.
- The original source register supplies research starting points. Exact authoritative sections,
  supported versions and physical profiles still require G0 verification before use in grading;
  no external source was newly verified by this document conversion.
- Creative-tool operation, generation records, editable models, exports and listening/visual
  quality remain G0/G3/G5 evidence to produce. No paid tool, cloud GPU or recurring service is
  assumed purchased.
- At least one beginner playthrough and technical review, plus the owner's episode acceptance,
  must be recorded. If reviewers or creative capabilities are unavailable, the relevant release
  gate stays unverified rather than being certified by automation.
- Out of scope: Specs002–007 implementation, full physical wave simulation, multiplayer, live
  network/device access, real-device credentials, runtime AI grading/dialogue, professional
  certification, native apps, marketplaces and leaderboards. Future content cannot block this
  episode's completion.
- This invocation produces a specification and its quality checklist. It does not produce game
  implementation, assets, an account service, a deployment, or a completed episode.
