# Spec001 requirement and evidence index

Created 2026-11-25 for T001; updated after loop 014/T007. **Episode runtime acceptance: PENDING. G0: BLOCKED.** Local runtime, dependency/build, licensing and HTTPS preparation have scoped passing evidence below. They do not establish a playable game, accepted production media, real provider flows, verified host or completed gate.

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). SPDX-License-Identifier: CC-BY-4.0.

## Authority and use

Read the [constitution](../../../.specify/memory/constitution.md), [root behavior contract](../../../SPEC.md), [root build contract](../../../PLAN.md), [feature specification](../../../specs/001-physical-layer-underworld/spec.md), [feature plan](../../../specs/001-physical-layer-underworld/plan.md) and [task execution sequence](../../../specs/001-physical-layer-underworld/tasks.md). The original interview is retained in [CONSTITUTION.md](../../../CONSTITUTION.md). These remain authoritative; the summaries below do not replace or narrow any requirement.

The owner initiated implementation as recorded in the [handoff](../../implementation/HANDOFF.md). T001 creates this index and the [G0–G7 ledger](gates.md). It does not authorize publication, provider registration or another episode. Task completion is reviewed separately from acceptance. The [T001 loop record](../../implementation/loops/001-T001.md) contains document checks only.

Trace each constitutional rule and interview decision through the FR/NQ IDs below, then through the acceptance register to tasks, work packages, gates and evidence destinations. All runtime rows start **PENDING — not executed**. Existing design PASS statements establish design conformity only.

## Evidence status and record contract

| Status | Meaning |
| --- | --- |
| PENDING | Required check not yet executed or its required observations are incomplete. Future evidence destinations are not evidence. |
| OBSERVED | A concrete observation is recorded, without claiming that the full criterion passed. |
| PASS | The named, scoped criterion was executed and met; procedure, artifacts and reviewer support the result. |
| FAIL | An executed check did not meet the criterion; retain the failure and link corrective work and retest. |
| BLOCKED | An attempted check cannot proceed because of a named unavailable prerequisite; record the attempt and required resolution. |

No constitutional or release requirement becomes N/A merely because its capability is unavailable. A partial automated pass does not pass a human, provider, media or release criterion. Record narrower subchecks separately and retain the parent as PENDING, FAIL or BLOCKED as appropriate.

Each evidence record must identify: requirement/AC and case IDs; task/package/gate; date and executor/reviewer identity; exact code revision **and dirty changes or source hashes**, content/asset/schema/API versions and hashes; actual hardware, OS, browser/runtime/tool versions and network/cache conditions; isolated fixture/session/database setup; command or manual procedure; independent expected result; observed result and supporting log/image/trace/source/listening notes; status; defects, limitations, untested combinations and next action. Use public-safe artifacts and redacted configuration references; never include secrets, player records or backups. A command's exit code alone does not prove its assertions or human quality.

## Constitutional trace

The decision numbers refer to C7's recorded interview, not engineering defaults. Acceptance rows below provide the implementation/evidence destinations.

| Rule | Interview decisions | Observable FR / NQ trace | Acceptance |
| --- | --- | --- | --- |
| C1 Purpose and audience | 01, 04, 05, 06 | FR-001, FR-004, FR-006, FR-026; NQ-01, NQ-03, NQ-13; beginner apprentice, optional depth, original warm/witty world | AC01, AC03, AC18, AC21 |
| C2 Fixed boundaries | 20, 23, 25 | FR-023, FR-024, FR-026; independent public browser project, existing GoDaddy/arcade and owner-initiated stages | AC16, AC19, AC18 |
| C3 Tested episodes | 02, 03, 08, 16 | FR-002, FR-017, FR-025, FR-026; NQ-02, NQ-09, NQ-12; Physical first, 60–120 minutes, full asset scope | AC02, AC08, AC13, AC18 |
| C4 Experience | 07, 09, 10, 11, 12 | FR-001, FR-003, FR-007, FR-008, FR-009, FR-010; NQ-01, NQ-04, NQ-05, NQ-06, NQ-07, NQ-08 | AC01, AC04, AC05, AC06, AC07 |
| C5 Authentic media | 14, 15, 17, 18, 19 | FR-017, FR-018, FR-021; NQ-09; real Blender/OpenAI/audio sources and coherent mixed presentation | AC08, AC09, AC10, AC20 |
| C6 Accounts/persistence | 21, 22, 23 | FR-011, FR-012, FR-013, FR-014, FR-023; NQ-10, NQ-11; guest play, both providers, dedicated game data | AC11, AC12, AC19 |
| C7 Interview preservation | 01–25 | FR-026; complete decision table below and FR/NQ register; distinguish authored defaults | AC18 and AC01–21 coverage |
| C8 Connected realms | 02, 08 | FR-002, FR-025; NQ-02, NQ-12; stable IDs, revisits, future boundaries without future dependencies | AC02, AC13; SAVE11 |
| C9 Learning/agency | 09, 10, 12, 13 | FR-004, FR-008, FR-009, FR-010; NQ-03, NQ-07, NQ-08; equivalent repairs, graduated hints, untimed core and fair recovery | AC03, AC06, AC07; T13–T16 |
| C10 Technical truth | 04, 10, 11 | FR-004, FR-005, FR-006, FR-007; NQ-03, NQ-05, NQ-06, NQ-13; independent scoped rules and truthful packet view | AC03, AC05, AC21; T01–T16 |
| C11 Sources/provenance | 14–19 | FR-017, FR-018, FR-024; NQ-09; genuine editable sources, distinct identities, exports, rights, observed use/review | AC08, AC09, AC10, AC16 |
| C12 Trustworthy save | 21, 22 | FR-010, FR-011, FR-012, FR-013, FR-014, FR-015, FR-016, FR-025; NQ-08, NQ-10, NQ-11, NQ-12 | AC07, AC11, AC12, AC13, AC17, AC19; SAVE01–13 |
| C13 Permissive reuse | 24 | FR-023, FR-024; original code Apache-2.0, original documents/media CC BY 4.0 where rights permit; retain third-party terms | AC16, AC17 |
| C14 Access/honest completion | 07, 13, 20 | FR-019, FR-020, FR-021, FR-022, FR-026; measured desktop/Safari baseline, text/keyboard recovery and real human review | AC14, AC15, AC18, AC20 |
| C15 Spec-driven execution | 02, 25 | FR-026 and every FR/NQ row; preserve source IDs, change control, explicit gates and stage boundaries | AC01–21; this index and gate ledger |

## All 25 interview decisions

These are the owner's recorded choices. The exact twelve-room roster, extra image/audio quotas, nine recruits/two active allies, story, toy profiles, desktop device baseline and implementation technologies are reviewable authored/engineering defaults; they are not additional interview answers. Defaults remain binding through the current contracts until changed through their change process.

| Decision | Recorded choice | Constitution | FR / NQ trace | Acceptance |
| --- | --- | --- | --- | --- |
| 01 | Teen/adult beginners; optional engineer depth | C1, C7 | FR-001, FR-004, FR-026; NQ-01, NQ-03 | AC01, AC03, AC18 |
| 02 | Physical first; seven connected specifications; revisit/improve earlier content | C3, C8, C15 | FR-002, FR-025, FR-026; NQ-02, NQ-12 | AC02, AC13, AC18 |
| 03 | 1–2 hour first main playthrough | C3 | FR-026; 60–120 minute release envelope | AC18 |
| 04 | Apprentice engineer plus playable packet journeys | C1, C10 | FR-001, FR-006; NQ-01, NQ-13 | AC01, AC21 |
| 05 | Warm, witty, strange; danger/networking humor | C1 | FR-009, FR-026; NQ-08; original narrative review | AC07, AC18 |
| 06 | King's Quest wonder with Space Quest science/absurdity | C1, C13 | FR-001, FR-017, FR-024, FR-026; NQ-09; original work, licensed reuse only | AC08, AC16, AC18 |
| 07 | Walk/Look/Talk/Use, inventory, keyboard equivalents | C4, C14 | FR-001, FR-019, FR-020; NQ-01 | AC01, AC14 |
| 08 | Connected areas and gated progress as in 02 | C3, C8 | FR-002, FR-025; NQ-02, NQ-12 | AC02, AC13 |
| 09 | Exploration, investigation, creature encounters, optional activities | C4, C9 | FR-004, FR-007, FR-008; NQ-03, NQ-06, NQ-07 | AC03, AC05, AC06 |
| 10 | Balanced discovery/instruction/diagnostics; persistent notebook | C4, C9, C10 | FR-003, FR-004, FR-005; NQ-03, NQ-04 | AC03, AC04, AC18 |
| 11 | Compendium discovery, recruitment and progression | C4, C10 | FR-007; NQ-05, NQ-06 | AC05 |
| 12 | Shared story, alternatives, chapter outcomes, personalized epilogue | C4, C9 | FR-002, FR-004, FR-009; NQ-02, NQ-08 | AC02, AC03, AC07 |
| 13 | Mixed failure styles; explain closed routes and different retry | C9, C14 | FR-009, FR-010, FR-019; NQ-08 | AC07, AC12, AC14 |
| 14 | Real-time 3D, rendered rooms, sprites, OpenAI imagery | C5, C11 | FR-017, FR-018; NQ-09 | AC08, AC09 |
| 15 | Modern detailed 3D/AI with classic composition/UI | C5, C11 | FR-017, FR-018, FR-020; NQ-09 | AC08, AC09, AC14 |
| 16 | 10–12 rooms, 25 character models, 150 distinct reusable props | C3, C11 | FR-002, FR-017; NQ-09; current contract fixes 12 rooms | AC08 |
| 17 | Generated scenery/illustrated assets alongside Blender | C5, C11 | FR-017, FR-018; NQ-09 | AC08, AC09 |
| 18 | Retro musical influence; modern AI-assisted production | C5, C11 | FR-018; NQ-09 | AC10 |
| 19 | Selected narrator/key-character free/local TTS subject to audition | C5, C11 | FR-018, FR-020; NQ-09 | AC10, AC14 |
| 20 | Browser game at automateyournetwork.com/arcade; no selected device guarantee | C2, C14 | FR-020, FR-022, FR-023; measured device claims only | AC15, AC16, AC19 |
| 21 | Guest introduction; Google/GitHub sign-in to save | C6, C12 | FR-011, FR-012, FR-015, FR-016; NQ-01, NQ-10 | AC01, AC11, AC12, AC17 |
| 22 | One manual slot; optional autosave opt-in | C6, C12 | FR-012, FR-013, FR-014; NQ-11 | AC12 |
| 23 | Existing GoDaddy host and server access | C2, C6 | FR-023; dedicated game database, separate analytics | AC16, AC19 |
| 24 | Permissive modification/redistribution/commercial reuse with credit | C13 | FR-024; source/component/output rights and notices | AC16, AC17 |
| 25 | Original CONSTITUTION.md, SPEC.md, PLAN.md deliverables | C2, C7, C15 | FR-026; original kickoff retained, later owner-initiated stages explicit | AC18 and gate/stage review |

## FR and NQ requirement register

Each row is **PENDING**. The [full functional requirements](../../../specs/001-physical-layer-underworld/spec.md#functional-requirements) and [original NQ definitions](../../../SPEC.md#initial-requirements) supply the complete mandatory behavior. A dash means no direct NQ ID was assigned, not an exemption.

| FR | Required behavior summary | NQ | Acceptance / cases |
| --- | --- | --- | --- |
| FR-001 | Four verbs, combinations, keyboard, skip/replay and persistent clues | NQ-01, NQ-04 | AC01, AC04, AC14 |
| FR-002 | Twelve meaningful rooms; three independent routes | NQ-02, NQ-09 | AC02, AC08 |
| FR-003 | Notebook distinctions, sources and freshness | NQ-04 | AC04; T13 |
| FR-004 | Inspectable outcome/evidence, alternatives and nonpunitive graduated hints | NQ-03 | AC03, AC18; T16 |
| FR-005 | Independent correct/incorrect/boundary cases; invalid content is not learner failure | NQ-03 | AC03; T01–T16 |
| FR-006 | Interactive R01/R12 physical send/receive with truthful upper-layer context | NQ-13 | AC21 |
| FR-007 | 25 accurate entries; nine recruits/progression; two active allies; equivalent tools | NQ-05, NQ-06 | AC05 |
| FR-008 | SQ01–04/MG01–03 instructions/retry/exit; untimed main lesson | NQ-07 | AC06 |
| FR-009 | Warn before commitment; E01/E02/E03 and personalized epilogues | NQ-08 | AC07 |
| FR-010 | Safe retry/Restore Save; preparation rollback with retained learning and stale readings | NQ-08, NQ-11 | AC07, AC12; SAVE06 |
| FR-011 | Guest state survives sign-in cancel/failure; real separate Google/GitHub identities | NQ-10 | AC11; SAVE01–03 |
| FR-012 | One durable slot across devices/logout/deployment; deliberate replacement | NQ-10, NQ-11 | AC11, AC12, AC13; SAVE02/03/11 |
| FR-013 | Autosave default off, same slot, safe boundaries and protected terminal states | NQ-11 | AC12; SAVE04–06 |
| FR-014 | Honest save status, conditional writes, idempotent retries and explicit conflicts | NQ-11 | AC12; SAVE07–09 |
| FR-015 | Account isolation and forged/replay/malformed request rejection | NQ-10 | AC17; SAVE10/12 |
| FR-016 | Data/backup explanation, cancel/confirm logout, deletion and operation-specific confirmation | NQ-10, NQ-11 | AC12, AC17; SAVE12/13 |
| FR-017 | Stable distinct modeled identities, reopened Blender sources, usable exports, rights and placement | NQ-09 | AC08 |
| FR-018 | Complete image/audio quotas, authentic provenance and actual visual/listening review | NQ-09 | AC09, AC10 |
| FR-019 | Every mandatory action/evidence through labeled keyboard and text | — | AC14 |
| FR-020 | Zoom/captions/focus/reduced motion/separate audio/responsive touch | — | AC14, AC15 |
| FR-021 | Recoverable missing media/scene/network and equivalent quiet/low-detail observations | — | AC20 |
| FR-022 | Measured supported desktops including actual Mac Safari; honest mobile claims | — | AC15 |
| FR-023 | Independent public build, versioned GoDaddy integration, dedicated game data | — | AC16, AC19 |
| FR-024 | Creators/licenses/provenance credits and exclusion of private inputs | — | AC16, AC17 |
| FR-025 | Stable qualified IDs, explicit migrations and preserved achievements/saves | NQ-12 | AC13; SAVE11 |
| FR-026 | Full AC01–21, technical/human/media/owner evidence before episode completion | NQ-01–13 | AC18 and AC01–21 |

## Acceptance and evidence register

Every row is **PENDING — not executed**. Exact acceptance definitions remain in the [root release matrix](../../../SPEC.md#release-acceptance-matrix). Task IDs refer to the [authoritative task list](../../../specs/001-physical-layer-underworld/tasks.md#constitutional-and-acceptance-coverage). Paths in code below are planned destinations relative to `docs/evidence/spec001/`; they are **not existing evidence links**. Convert them to links when actual reports are created, preserving failures and historical scope.

| Acceptance | Required observation | Work / gate | Principal tasks | Planned evidence destinations |
| --- | --- | --- | --- | --- |
| AC01 | Fresh guest reaches R02 using four verbs without account/API key | W02/G1; W08/G6 | T030, T035, T159 | `US1.md`, `acceptance-matrix.md` |
| AC02 | Copper, fiber and radio independently reach valid success | W05–06/G4; W08/G6 | T078, T105, T159 | `first-route.md`, `US2.md`, `acceptance-matrix.md` |
| AC03 | Mandatory evidence/actions/explanations; T01–T16 and independent cases | W01/G0, W02/G1, W05/G4, W08/G6 | T006, T014, T068, T105, T160 | `rule-source-review.md`, `US2.md`, `technical-review.md` |
| AC04 | Cross-room clues and visible stale measurements | W02/G1, W06/G4, W08/G6 | T027, T030, T104, T159 | `US1.md`, `US7.md`, `acceptance-matrix.md` |
| AC05 | 25 accurate illustrated entries and nine allies with progression/abilities | W03/G2, W06/G4, W07/G5, W08/G6 | T093, T094, T104, T141, T159 | `US7.md`, `media-audit.md`, `acceptance-matrix.md` |
| AC06 | All four side quests/three minigames teach, finish/retry/exit and remain optional | W06/G4; W08/G6 | T092, T100, T104, T159 | `US7.md`, `acceptance-matrix.md` |
| AC07 | Three outcomes, fair failure and exact retained-learning retry behavior | W06/G4; W08/G6 | T083, T084, T086, T089, T159 | `US6.md`, `acceptance-matrix.md` |
| AC08 | 12 finished rooms, 25 distinct models, 150 named props, sources reopen | W04/G3, W07/G5, W08/G6 | T067, T106, T132, T141 | `representative-room.md`, `media-audit.md` |
| AC09 | 36 layers, 25 portraits, 24 illustrations; real lineage and use | W04/G3, W07/G5, W08/G6 | T064, T117–T123, T141 | `representative-room.md`, `media-audit.md` |
| AC10 | 8 cues, 12 ambiences, 40 effects, 60 selected lines; integrated and listened to | W04/G3, W07/G5, W08/G6 | T065, T124–T131, T141 | `audio-auditions.md`, `media-audit.md` |
| AC11 | Both real providers save/close/restore across devices with isolation and cancel | W03/G2; W08/G6; W09/G7 smoke | T041, T056, T057, T167, T169 | `US4.md`, `real-providers.md`, `staging.md`, `release.md` |
| AC12 | Manual/opt-in autosave share one slot; SAVE01–13 including concurrency/replay | W03/G2, W06/G4, W08/G6; W09/G7 recovery | T036, T043, T051, T054, T056, T089, T159, T166, T170 | `US4.md`, `US6.md`, `recovery-drill.md`, `acceptance-matrix.md` |
| AC13 | Prior state survives hypothetical future door and safe-position migration | W03/G2; W08/G6; W09/G7 recovery | T048, T142–T144, T166 | `migrations.md`, `recovery-drill.md` |
| AC14 | Complete keyboard/text/reduced-motion/200% zoom play | W02/G1, W04/G3, W08/G6 | T147–T149, T152 | `US5.md` |
| AC15 | Exact browser/viewports/performance results and no unproved mobile claims | W04/G3; W08/G6 | T059, T067, T153–T155 | `measurement-profile.md`, `representative-room.md`, `browser-matrix.md`, `performance.md` |
| AC16 | Fresh public checkout, retrievable licensed sources and independent build | W01/G0, W07/G5, W08/G6 candidate, W09/G7 public proof | T010, T145, T156, T157, T164, T169 | `independent-build.md`, `release-readiness.md`, `release.md` |
| AC17 | Ownership/OAuth replay/CSRF/malformed/oversized rejection and privacy | W03/G2, W08/G6, W09/G7 recovery/package | T053–T055, T156, T159, T164, T166 | `US4.md`, `acceptance-matrix.md`, `recovery-drill.md`, `release-readiness.md` |
| AC18 | Actual beginner/technical/owner reviews and 60–120 minute target assessment | W04/G3 owner sample; W08/G6 episode | T160–T163 | `technical-review.md`, `beginner-playthrough.md`, `refinements.md`, `owner-review.md` |
| AC19 | Same-host staging/release/rollback preserve saves and other arcade/analytics | W09/G7 | T165–T167, T169, T170 | `recovery-drill.md`, `staging.md`, `release.md`, `acceptance-matrix.md` |
| AC20 | Missing assets/audio/WebGL/network give usable recovery without false progress | W02/G1, W04/G3, W08/G6 | T150–T152, T155 | `US5.md`, `performance.md` |
| AC21 | R01/R12 known payload, toy encoding, impairment/repair and accurate upper context | W02/G1, W06/G4, W08/G6 | T031, T034, T090, T091, T105, T160 | `US3-introduction.md`, `US3.md`, `US2.md`, `technical-review.md` |

All AC rows will also be reconciled in `acceptance-matrix.md` by T159/T170. G6 leaves packaging, public availability, operational recovery, staging and production observations pending until T164–T170. Candidate reproducibility is not proof of public source retrieval; prepared-state tests are not full-story integration; WebKit automation is not actual Safari; mocks are not real providers.

## Case-level invariants that evidence must preserve

| Required check | Trace and destination (all PENDING) |
| --- | --- |
| Canceled logout changes neither session nor adventure. Confirmed logout revokes the session, clears adventure/journal/checkpoint memory, returns to title, performs no implicit save and leaves the account slot intact; it does not continue as guest. | Accepted clarification; FR-016, SAVE13, AC12/AC17; T054/T056/T089; `US4.md`, `US6.md` |
| Retry/E03 Continue rewind encounter and inventory to preparation, retain new clues, personal notes and hint-use history, and mark prior-attempt measurements stale. They neither duplicate rewards nor create a persistent slot. Restore Save loads the confirmed snapshot; retained learning becomes durable only through eligible saves. | Accepted clarification; FR-003/010/013, T13, SAVE06, AC04/AC07/AC12; T083/T084/T086/T089; `US6.md` |
| Retained matching save acknowledgements precede current semantic policy and stale revisions. Recheck authorization/receipt inside the final transaction before any provisional validation error. Replay can acknowledge an older revision than the current slot, with no second write or rollback. | FR-014/015, SAVE07/08/10, AC12/AC17; T043/T051/T053/T056; `US4.md` |
| Lost deletion response stays unconfirmed until that operation's completed receipt is verified. Guest session status and unknown/expired receipts never prove deletion. Status checks cannot delete, sign in or affect a later account; restore cannot resurrect deleted progress. | FR-016, SAVE12, AC12/AC17/AC19; T054–T056/T165/T166; `US4.md`, `recovery-drill.md` |
| T01–T16 are source fixture IDs, distinct from task IDs T001 onward. Every proposed scored rule needs authoritative source/section/date, scoped model, fictional-value labels and independently checked correct/incorrect/boundary cases before evaluator work. | FR-004/005, C10, AC03; T006/T014/T068/T105/T160; `rule-source-review.md`, `US2.md`, `technical-review.md` |
| Packet payload is 0x4E 0x51, highlighted bits 01001110 01010001 inside an opaque upper-supplied frame. Toy mapping/known-pattern comparison do not simulate all PHY behavior, FCS or seven independent wire headers. | FR-006, NQ-13, AC21; T034/T091/T160; `US3-introduction.md`, `US3.md`, `technical-review.md` |

The full [SAVE01–13 cases](../../../SPEC.md#persistence-acceptance-cases) remain required: cancellation, two real providers, adoption, default-off/same-slot autosave, terminal safety, concurrent writes, lost acknowledgements, failure/expiry, hostile requests, migration, deletion and logout. T036 authors them; T056 runs prepared-state flows; T057 proves providers; T089 integrates actual outcomes; T144 expands migration; T159 regresses executable cases; T166/T170 finish recovery/release-dependent coverage. No individual case is reported executed here.

## Quantity, source and quality baseline

| Required inventory | Acceptance evidence still needed |
| --- | --- |
| 12 finished rooms; CH01–CH25 distinct modeled characters; PR001–PR150 distinct props, at least 50 interactive/evidence-bearing | Reopened native `.blend`, usable exports, stable identities, rights, meaningful placement and visual review; scripts/screenshots/recolors/instances alone do not count |
| 36 usable room layers (background plus two per room), 25 portraits, at least 24 illustrations | Actual OpenAI requests/outputs/known metadata, accepted sources and honest edit lineage; derivatives are not extra generation calls |
| At least 8 original music cues, 12 room ambiences, 40 purposeful effects, 60 selected voice lines | Actual raw production, component/output rights, native Audacity 4 `.aup4`, appropriate recording/MIDI sources, lossless masters/web exports and human headphone/speaker listening |
| R01 real-time 3D; R05 layers with real-time assets; R04 Blender sprites | Shared interaction/state and coherent camera/lighting/animation; quiet/low-detail/text modes preserve teaching |
| Nine recruits, maximum two active allies, SQ01–04, MG01–03, E01–E03 | Meaningful progression, equivalent tools, optionality, safe retry and truthful outcomes; no reflex/timing gate |

All quantities are **PENDING — no accepted assets counted by T001**. The [source inventory](../../../SPEC.md#media-production-inventory) and [delivery contract](../../../specs/001-physical-layer-underworld/contracts/delivery.md) govern counting and review. Smoke assets and grayboxes never prove episode completion.

## Supporting evidence destinations

These paths supplement the acceptance register and are relative to `docs/evidence/spec001/`. Links identify reports that now exist; code-formatted paths remain planned. Each report records its own scoped result and does not pass a gate by existing.

| Task | Planned path | Purpose |
| --- | --- | --- |
| T002 | [runtime.md](runtime.md) | Local runtimes/extensions verified; subsequent locks/builds are recorded under T008/T009. Remote host remains unverified. |
| T003 | [host.md](host.md) | Partial: SFTP/public routes observed; host execution, private path/locking, quotas/cron and retention remain blocked/unverified. |
| T004 | [provider-preflight.md](provider-preflight.md) | Both private pairs present; owner confirms dedicated production registrations and exact [guide callbacks](../../setup/oauth.md). Remaining basic provider controls are uninspected; test registrations and real flows precede G2 testing. |
| T005 | [media-feasibility.md](media-feasibility.md) | Native tool and local model checks passed; human listening remains pending and no production assets are counted. |
| T006 | [rule-source-review.md](rule-source-review.md) | Agent source/arithmetic review complete: 13 primary sources, 83 independent cases and 387 worksheet checks; human/application verification remains pending. |
| T007 | [gates.md](gates.md), [loop 014 reassessment](../../implementation/loops/014-T007.md) | G0 BLOCKED on host, remaining basic provider controls and listening; external checks await changed input; independent local foundation continues under the owner-directed execution clarification. |
| T008 | [client-bootstrap.md](client-bootstrap.md) | Exact npm lock, native dependencies, strict independent build and secret-exclusion checks passed; no gameplay/browser acceptance. |
| T009 | [php-bootstrap.md](php-bootstrap.md) | Composer lock/platform and isolated production-only install passed; no service/auth/save implementation. |
| T010 | [licensing.md](licensing.md) | Actual dependency inventory/notices/source retrieval and bounded OpenAI public terms review passed; per-asset acceptance/release delivery remain later. |
| T011 | [local-development.md](local-development.md) | Loopback HTTPS/PHP startup and 10 transport verification groups passed; API returns 503, real providers/sessions and browser acceptance remain unverified. |
| T021 | `foundation.md` | Available shared schema/type/state/harness readiness |
| T158 | `US8.md` | Finished world, media/source and migration integration, without release permission |
| T168 | `release-readiness.md` | Concrete artifact, prior evidence, rollback and unresolved post-publication checks |

The current gate decisions live only in [gates.md](gates.md). Future records must link their underlying artifacts and update this index without erasing failed or superseded observations.
