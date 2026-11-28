# Spec001 G0–G7 evidence ledger

Updated November 28, 2026. **G0 is blocked, G5 is partial, and G1–G4 and G6–G7 are pending.** The table records current decisions. The dated entries below preserve earlier findings and their later resolutions.

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). SPDX-License-Identifier: CC-BY-4.0.

Authority: [constitution](../../../.specify/memory/constitution.md#development-workflow-and-quality-gates), [root build order](../../../PLAN.md#build-order), [feature plan](../../../specs/001-physical-layer-underworld/plan.md), [task execution table](../../../specs/001-physical-layer-underworld/tasks.md#execution-sequence-and-gate-dependencies). Requirement/interview/acceptance mappings and the evidence record format are in the [index](index.md). Paths in code below are planned repository-relative destinations, not claims that files or results exist.

## Gate decisions

| Gate | Work package / decision task | Required preceding work | Current status | Observed result / reviewer / evidence |
| --- | --- | --- | --- | --- |
| G0 | W01 / T007 | T001–T006 evidence and T008–T011 local preparation | BLOCKED | Local runtime, source and representative listening checks passed. GoDaddy backup coverage and retention, remaining host limits, and outstanding provider controls still block feasibility. The owner confirmed the production registrations and callback settings. [Host evidence](host.md) · [Provider preflight](provider-preflight.md) |
| G1 | W02 / T035 | T001–T011, T012–T021, T022–T030, T031–T034; G0 | PENDING | T035 passed the local guest introduction, physical evidence, packet and visual checks. Aggregate acceptance awaits G0. [Joined review](../../implementation/loops/086-T035.md) · [US1](US1.md) |
| G2 | W03 / T058 | T036–T057 after G1 | PENDING | All twelve rooms, fourteen reversible connections and three endings were verified locally. A fresh Firefox run passed 41 single-slot, migration and full-encounter cases. T057 has 0/28 real Google/GitHub observations, and G0/G1 remain outstanding. [World and save evidence](US4.md) · [Two-device record](real-providers.md#execution-record) |
| G3 | W04 / T067 | T059 measurement harness, T060–T066 after G2 | PENDING | The owner accepted the corrected representative room. The source, listening, Firefox and native Safari evidence passed T067. Aggregate acceptance awaits the preceding gates. [Representative-room acceptance](presentation/representative-room-acceptance-2026-11-26.md) |
| G4 | W05/W06 / T105 | T068–T104 after G3, including first route, outcomes, R12 and optional activities | PENDING (upstream aggregate gates) | Local T105 gameplay accepted: three independent native routes,734focused checks,98original-case dispositions; US2/US6/US3/US7 evidence. Finished media/human/provider scope remains separate. |
| G5 | W07 / T141 | T106–T140 after G4 | PARTIAL | AC08/09 inventory verified. AC10 awaits listening for 109 active audio renditions and their in-game mixes. [T141 audit](media-audit.md) |
| G6 | W08 / T163 | T142–T158 then T159–T162; G0–G5 | PENDING | The playable candidate and integrated regression findings are available. Whole-episode owner satisfaction, independent technical findings, the timed beginner run, disposition of remaining findings and preceding gate evidence are outstanding. [Owner review](owner-review.md) · [Acceptance matrix](acceptance-matrix.md) |
| G7 | W09 / T170 | T164–T169 after G6; owner initiation required for T169 live publication | PENDING | Nine isolated T166 recovery and rollback drills passed. T165 implemented encrypted recovery locally. Actual host retention and recovery, standalone packaging, same-host staging, provider smoke and public launch remain open. [Recovery drills](recovery-drill.md) · [Operating procedure](../../operations.md) |

The coordinator adopted the [T007 sequencing correction](../../implementation/loops/009-T007.md#proposed-sequencing-correction-not-adopted) on 2026-11-25 in the root plan, feature plan and [authoritative task schedule](../../../specs/001-physical-layer-underworld/tasks.md#execution-sequence-and-gate-dependencies): T008 → T009/T010 → T011 supplies local G0 evidence before final T007 reassessment. The owner-directed [continuation clarification](../../implementation/execution-direction.md) now permits independent local foundation and guest implementation on verified local prerequisites; aggregate G0/G1 acceptance remains pending. Missing observations remain PENDING; historical host execution failure is superseded by loops016/019. Remaining retention/provider controls/listening keep aggregate G0 unaccepted. A completed assessment is not a readiness pass.

## G0 — feasibility

**Status: BLOCKED.** Executor/reviewer: Codex `/root/loop014_t007`, 2026-11-25; agent evidence review, not human acceptance. Coverage: C2/C5/C10/C12/C13; FR-005/011/015/017/018/022/023/024; AC03/08–11/15–17/19 prerequisites. The post-bootstrap T007 assessment is complete; critical feasibility remains unresolved. Reassess when new evidence resolves the named gaps, not on an unchanged timer. Input revision/fingerprint and bounded verification are in the [loop note](../../implementation/loops/014-T007.md); the [initial assessment](../../implementation/loops/009-T007.md) is retained.

| Capability | Reviewed observation and scoped result | Outstanding G0 evidence |
| --- | --- | --- |
| Local runtime/preparation — T002, T008–T011 | **PASS for local scope.** [Runtime primitives](runtime.md); [client lock/native dependencies/strict independent build](client-bootstrap.md); [Composer lock/platform/production-only install](php-bootstrap.md); [154-package license inventory/notices/source retrieval](licensing.md); [same-origin loopback HTTPS/PHP startup](local-development.md), including 10 transport verification groups and 29 path denials. | No remaining local bootstrap prerequisite identified. T011's real API routes honestly return 503; synthetic cookie/header checks do not establish browser sessions, authentication or gameplay. Application tests, actual browser acceptance and remote runtime remain later or separately named evidence. |
| Host — T003 | **PASS for isolated runtime/storage/scheduler/TLS checks.** Loops016/019 verified actual CLI/web PHP8.4.28, PDO SQLite3.54.1, private 0700/0600 writes, two-process locking/rollback/interruption, consistent snapshot, outbound provider TLS and actual cron. All temporary resources were removed and original crontab/modes independently verified. [Probe evidence](host-probes.md) | **PARTIAL:** actual provider/manual-copy coverage and longest retention; current adjusted quota/package CPU/process/I/O limits. Dated disk/inode cache is documented. Full encryption/ledger/key recovery, load, real login and restore belong to later implementation acceptance. No credential or SSH-activation input is needed. |
| Providers — T004 | **PARTIAL, with production inputs resolved.** Both pairs are privately present; the owner confirms dedicated Network Quest production registrations and exact guide callbacks. This closes registration existence, production environment labels and callback inputs; do not request them again. It is owner-reported evidence, not console inspection. [Provider preflight/follow-up](provider-preflight.md#owner-follow-up-after-loop-004) | **PENDING P01/P02 controls:** non-secret evidence of Google Web-client/External audience and identity-only Data Access (`openid profile`, no email/offline/unrelated access; no browser origins needed), plus GitHub OAuth App callback wildcard disabled, device flow disabled and token-expiry setting. The scoped request/grant checks require implemented G2 flows. P04 host TLS/private-path feasibility passed in loop019; real flows remain later. P03's production private readiness is established; separate development/test registrations and mapping are required before real provider testing, not before this credential-free bootstrap. No secret was reopened. |
| Blender/audio technical feasibility — T005 | **PASS for recorded smoke scope.** Actual Blender 5.2.1 `.blend` reopen/render/GLB roundtrip; isolated Audacity 3.7.9 `.aup3` reopen/export under the R11 fallback; real Kokoro and ACE-Step 1.5 generation with resources, hashes and bounded rights review. [Media audit](media-feasibility.md), [native fixtures](../../../assets-src/feasibility/README.md) | **PENDING listening:** a real listener must audition the narration/music, record equipment and specific accept/reject observations. Signal checks do not close this requirement. The owner question is already pending; no duplicate request or inferred approval. |
| Other pipeline/rights evidence | **PASS for G0 terms/inventory scope.** T005 records Blender/audio component and output terms; T010 supplies the [OpenAI public tool/output terms review and actual dependency inventory](licensing.md), preserving separate MPL notices and source retrieval. | Unknown account-specific terms are documented applicability limits, not a new registration blocker. Recheck actual tool/reference/output terms and accept each generated asset in production; full delivered notices/source retrieval remain later release work. No imagery, exclusive copyright or final asset acceptance is claimed. |
| Teaching sources — T006 | **PASS for pre-implementation review.** 13 inspected primary sources, seven declared fictional/toy profiles, 15 rule groups and 83 independently authored cases; recorded worksheet result 387 checks passed. [Rule review](rule-source-review.md), [register](../../../content/spec001/sources.json) | No missing source/model/case prerequisite identified for the reviewed rules. New scored claims require new review. T014 implementation fixtures, evaluator execution and T160 human technical review remain later work. |

### Feasibility versus later acceptance

- Host execution, private storage, locking, scheduling and public provider TLS feasibility are now observed in loop019. G0 still needs backup/retention policy evidence, remaining basic provider controls and listening. Undeployed game/callback 404s are not a failed final backend; actual application routing/login retain later integration tests.
- G0 does not require published Google consent, completed brand verification or an already deployed public homepage/privacy page. The [existing primary-document preflight](provider-preflight.md#google-settings-to-verify-with-the-owner-controlled-project) distinguishes basic OIDC settings from publication requirements; no sensitive/restricted scope review is introduced for `openid profile`. Applicable branding/domain/homepage/privacy readiness must be checked before public provider use/release. A separate test project/app and exact test callbacks must be configured before G2 real flows; the current production pairs stay out of local bootstrap.
- G2/T056–T057 must prove implemented Google/GitHub login/cancel, real callbacks, account isolation, save/close/restore and concurrency. G0 registration/egress evidence cannot substitute for those flows; missing final flows are not additional G0 defects.
- G0's audio listening remains required. Supported Audacity 4 native `.aup4` acceptance, full character auditions, actual OpenAI imagery, coherent final art and owner review remain production/G3 prerequisites. The explicitly permitted 3.x feasibility fallback does not waive `.aup4` production sources or count as a finished asset.
- G0 must establish real backup/retention facilities and policies, including any manual/downloaded copies that could include game data. Existing historical website backups do not prove game inclusion or a finite expiry. Full game load tests, automated backup/deletion-ledger recovery, measured RPO/RTO, restore/rollback, staging and publication remain their G2/G6/G7 tasks. Nothing here certifies those operations or authorizes deleting existing archives.

### Required resolution and lawful next work

T008–T011 are accepted. Independent local foundation work proceeds under the [continuation rule](../../implementation/execution-direction.md); these external inputs remain needed for their dependent checks:

1. H01/H02 isolated runtime/storage tests and H03 scheduler execution pass. Resolve H04 provider/manual/downloaded/replicated coverage and finite expiry; retain quota-cache freshness and package-resource limits. Full encrypted backup/ledger/key implementation and restore drills remain later tasks. No production backup deletion is authorized.
2. A sanitized owner/console record of the remaining P01/P02 controls above. Do not request the already confirmed production registrations, callbacks or secret pairs again. No provider setting change is performed by this reassessment.
3. Real headphone/speaker listening, equipment and specific accept/reject observations for the existing [voice/music samples](../../../assets-src/feasibility/README.md#reviewable-outputs). The owner's listening question is already pending.

Do not repeat unchanged SSH/CUA attempts, passed bootstrap tests or paperwork loops. Resume the relevant partial audit only when its input changes, then reassess G0. Continue local tasks with verified inputs instead of repeating these blocked audits. Complete G0 evidence remains mandatory for aggregate gate acceptance; host/provider/media checks must pass before their respective dependent integrations or acceptance.

## G1 — playable diagnostic

**Status: PENDING.** Decision task T035; evidence destinations `docs/evidence/spec001/US1.md`, `docs/evidence/spec001/US3-introduction.md` and this ledger. Coverage: C1/C4/C9/C10/C14; FR-001/003/004/005/006/019/021; NQ-01/03/04/13; AC01/03/04/14/20/21 within the opening only.

Exit: actual browser R01/R02 graybox with Walk/Look/Talk/Use, keyboard/text equivalents, meaningful dialogue/inventory, persistent notebook/hypothesis and power-versus-link evidence; independent T01/T02/T14 plus correct/incorrect/boundary checks; initial packet payload/toy mapping and pause/step/replay driven by shared state. T021 foundation checks and T030/T034 observations must be recorded before review. A playable opening does not pass later routes, final media, full accessibility or the episode.

T021 prerequisite accepted by the coordinator on 2026-11-25: [foundation evidence](foundation.md)
records 306 passing JavaScript checks with 83 pending evaluator cases, 57 PHP tests,
19 combined browser checks and an independently matched 66-file input seal. No shared
foundation failure remains. T022 guest expectations and independent T024 rule work
now proceed; authored gameplay, packet interaction and G1 acceptance remain pending.

### T035 review, loop 043 — 2026-11-26

Reviewer: Codex `/root/loop043_t035`; agent code/browser/visual review, not human
learning, assistive-technology or owner acceptance. Reviewed source checkpoint
`a252a092b442465c2e94562bb6ec5a454c7a7e6b`, with the separately registered T035
test-only browser bench. The prior foundation statement above is retained as
history; T025–T030 and T031–T034 are now accepted within their task scopes.

| G1 criterion | Observed evidence | Review result |
| --- | --- | --- |
| Actual unsigned-in R01/R02 four-verb investigation, meaningful dialogue/inventory, notebook and hypothesis | T030's nine real guest cases and four joined state cases pass. Independent T035 fresh guest completed O01/O02, skipped both clue dialogues, retained literal notes and traveled back to R01 using actual main/content/controllers. | PASS for the semantic text investigation; not full FR-001/003/AC04 across the episode. |
| Independent correct/incorrect/boundary and T14 rules | T024's reviewed evaluator evidence; actual guest/packet 95 m and 105 m outcomes. T035 adds one trusted-HTTPS browser test containing seven real evaluator checks: T01, T02, B-COPPER-100, B-COPPER-OVER and all three T14 variants. | PASS for this rule slice. The 100 m case is a labeled test-only bench, not an invented player path. |
| Initial packet payload, mapping, pause/step/replay and shared physical state | T034's five actual-app cases; T035 independently observed 105 m / recovered 4E50 / bit 15 mismatch, then actual path change to 95 m / 4E51 match. Older notebook measurement stayed stale until explicit reinspection. | PASS for R01. R12/full AC21 remain T090/T091. |
| Visual playable graybox | PLAN.md's G1 build-order row requires “Playable graybox”; W02 requires “one R01/R02 graybox”. Actual application mounts the semantic shell only, leaves `presentationHost` empty and never creates a RoomAdapter. Fresh screenshots show a text scene. | **NOT MET — G1-LOCAL-01.** Text controls do not waive the visual graybox criterion. |
| G0 prerequisite | Existing host coverage/retention/resource-limit evidence, remaining provider controls and genuine listening remain outstanding as listed above. | **BLOCKED externally.** No new credential request or unchanged audit retry. |

Smallest local correction: use one original temporary renderer and explicit R01/R02
presentation layouts for simple floor/object/character/exit geometry and a safe
position marker. Join `createRoomAdapter`, `createResourcePool` and the existing
shell `presentationHost`; reuse `verbs.objects()` / `createSceneObjectProjection`
and `RoomRenderRequest.capture(controlId)` for visual actions. Forward the original
adapter capture to the shell. No renderer may mutate game state or award progress.
Existing walk regions/safe positions give the logical floor; camera/hotspot
placement belongs in a narrow presentation-only mapping because it is not yet
authored. Verify real visual/semantic parity, room changes, old-input invalidation,
fallback/recovery, resizing and disposal in a fresh corrective T035 loop. Temporary
DEV geometry counts as **zero finished assets**.

The missing graybox and external G0 inputs keep T035 incomplete and aggregate G1
PENDING. Full hint controls/assistance tracking (T074), later rooms/routes,
finished media, real OAuth/save, actual Safari/full browser and access matrices,
human technical/beginner/assistive review and owner acceptance remain separate
unaccepted scope. Existing objective hint data is not an implemented hint UI.
See [US1 review](US1.md#t035-independent-review--2026-11-26) and the
[sealed loop note](../../implementation/loops/043-T035.md) for exact results,
failure history and artifacts. No deployment or complete-episode claim follows.

## G2 — identity, one save and world structure

**PENDING, November 28, 2026.** T058 covers C6/C8/C12, FR-003/010–016/025, NQ-04/08/10/11/12, AC11–13/17 and the authored world. The independent graph expectations passed for all twelve authored rooms and fourteen reversible connections. Native journeys earned permanent restoration, temporary restoration and deliberate safe shutdown. Each earned route used its own branch plus shared requirements. [Graph verification](world-graph-coordinator-acceptance.md) · [Three route receipts](routes-t105/root-review.md) · [Ending and recovery evidence](US6.md)

On checkpoint `b1d3c4bc`, 22 prepared browser cases exercised the account and its single slot, seven exercised hypothetical prior/newer saves in real local storage, and twelve played encounters from New Adventure. All 41 passed in Firefox. The separate PHP checks covered ownership, preferences, competing writers, retained receipts, logout and deletion. After an uncertain write, the server can replay the older acknowledgement while preserving the newer slot. Confirmed logout clears memory without a save. The status of the specific deletion operation determines whether deletion completed. [T058 rerun](../../implementation/loops/187-T058.md) · [SAVE01–13 scope](acceptance-matrix.md#one-slot-regression)

T057 still needs both real providers, two physical devices and a configured test service to observe consent, cancellation/blocked-window recovery, saved progress after closing the browser, cross-device restore and account isolation. The owner has confirmed the production registrations and callbacks. The remaining test registration, host and provider-control inputs, plus upstream G0/G1 acceptance, keep aggregate G2 open. [Real-provider session](real-providers.md) · [Local and outstanding account evidence](US4.md)

## G3 — representative finished room

**Status: PENDING.** Decision task T067; destinations `docs/evidence/spec001/measurement-profile.md`, `docs/evidence/spec001/audio-auditions.md`, `docs/evidence/spec001/representative-room.md` and this ledger. Coverage: C5/C11/C14; FR-017–022/026; NQ-09; AC08–10/14/15/18/20 representative scope.

Exit: finished R01 uses real reopened Blender scene/character sources, usable exports/animations, genuine OpenAI images/layers and preserved production lineage; voice/music/effect auditions have actual listening and rights evidence. Inspect browser/source appearance and coherent art direction. The owner reviews this actual room before scaling production. A placeholder or successful export alone cannot pass.

Freeze recorded reference laptop/OS, exact browsers including actual Mac Safari, 1280×720/1440×900 viewports, cold/warm cache and 20 Mb/s/50 ms profile. Measure shell ≤5 MiB compressed, first room ≤15 MiB, readiness ≤12 s, ordinary exploration ≥30 FPS, provisional ≤500,000 visible triangles and ≤128 MiB estimated texture residency, plus disposal/recovery. Distinguish estimated texture data from GPU measurement and baseline sample results from final-episode performance. Preserve every failed sample; do not silently reduce asset/teaching commitments to meet a budget.

## G4 — complete gameplay

**Status: PENDING.** Decision task T105; destinations `docs/evidence/spec001/first-route.md`, `docs/evidence/spec001/US2.md`, `docs/evidence/spec001/US3.md`, `docs/evidence/spec001/US6.md`, `docs/evidence/spec001/US7.md` and this ledger. Coverage: C1/C3/C4/C8/C9/C10/C12; FR-001–010/013; NQ-01–08/13; AC01–07/12/21 gameplay scope.

Exit: T078 proves one complete copper route with temporary geometry before broader production. Then each copper/fiber/radio route independently completes its valid ending through all required common objectives, without an unvisited route, optional reward or future realm dependency. All twelve rooms are playable. All T01–T16 and per-objective independent cases, wrong/valid alternatives, invalid content and staleness checks pass.

T089 proves E01 permanent restoration, E02 temporary restoration, E03 unresolved safe shutdown, personalized epilogues, warned commitment, fair failure and exact rollback/retained-learning/save/logout behavior in the real UI. T091 proves repaired R12 alongside R01 packet truth. T104 proves 25 accurate entries, nine recruits/progression/abilities, two active allies/equivalent tools, SQ01–04 and MG01–03 instructions/start/finish/retry/exit without mandatory timing. Portrait-dependent AC05 and all finished-media requirements remain pending through G5/final regression; temporary art is never counted as finished.

## G5 — complete integrated media

**Partial on November 27, 2026.** T141 verified all twelve finished rooms, the real-time, layered and rendered sprite modes, 25 modeled characters, 150 distinct placed props, 103 interactive or evidence props, 36 layers, 25 portraits and 24 illustrations. Blender reopened all native projects. Sixty-nine distinct prop interactions were exercised through normal game controls. The release validator credits AC08 and AC09 quantities and the unchanged eight voices and three effects with applicable listening records. [Media audit](media-audit.md) · [Inventory](media-audit/inventory-audit.json)

AC10 and G5 await listening findings for eight full music cues, twelve beds, 37 effects and 52 voices, including the integrated mix. All 120 primary sounds have observed uses. T065’s twelfth reviewed item remains the archived title excerpt. The root checkpoint keeps the original benchmark and listening decisions. The existing packet also supports owner visual feedback across the twelve scenes. C3/C5/C11/C13, FR-002/017/018/024 and NQ-09 are traced in the audit. [Release findings](media-audit/release-audit.json) · [Review packet](media-audit/review.html)

## G6 — whole-episode validation and refinement

The owner reported that the revised direct verb indicators are “MUCH better”. The corrected package includes the tested change. The technical reviewer, beginner and whole-episode owner decision remain outstanding. [Owner review](owner-review.md) · [Verified fixes](refinements.md)

**Pending on November 28, 2026.** T163 verified the owner’s guest preview against all 442 files of client `ff3f3eb50045c883803ab9196bcd456c17b96f2b` and exercised the opening through entry to the Copper Warrens. The revised build includes the touch and diagnostic corrections. Previous owner decisions cover the twelve sealed auditions and the corrected Arrival Lift screen. The owner’s decision on the complete adventure, the twelve integrated room presentations and the 109 outstanding active recordings and their mixes is open. [Playable candidate and decision record](owner-review.md) · [Build verification and retests](refinements.md) · [Integrated AC01–21 findings](acceptance-matrix.md)

G0–G5 remain as recorded above, including actual host retention and limits, provider controls and journeys, and production listening. T160 awaits an attributed technical review and T161 an observed first run by a networking beginner. T162 remains open for findings and retests from integrated or human review. T163 and AC18 remain open. Coverage includes W08, C1–C15, FR-001–026, NQ-01–13 and the G6-executable parts of AC01–21. [Technical review](technical-review.md) · [Beginner playthrough](beginner-playthrough.md) · [Guest continuity](US8.md) · [Accessibility](US5.md) · [Browser matrix](browser-matrix.md) · [Performance](performance.md)

Exit: T159 executes integrated gameplay/content/media/access/security and eligible SAVE01–13 regressions. Check hypothetical future door/renamed ID/removed position migrations without implementing Spec002; preserve unsupported newer saves. Prove complete keyboard/text/muted/reduced-motion/200% zoom/focus/assistive and recovery behavior, exact current/previous supported Safari/Chromium/Firefox releases including actual Safari, 1280×720/1440×900 and 768/390 px responsive controls. Record untested combinations; touch layout is not mobile performance certification. Measure final worst scenes, resource disposal, cold/warm loads and save p95 <2 s at 20 mixed sessions, with failures/host limits retained.

T157 verified clean candidate setup, build and public source retrieval. T160 requires technical findings about sources, models, hints, characters, the packet journey and transfer cases. T161 requires at least one beginner’s unassisted or lightly assisted main run with timing against 60–120 minutes, reasoning, hints and confusion. T162 tracks corrections and retests. The owner’s words and the scope of the episode reviewed belong in the T163 decision record.

Keep every AC01–21 row visible. G6 passes only its executable criteria and actual reviews; it is not full release acceptance. Packaging/public retrieval, operational backup/restore/rollback, same-host staging and production smoke remain PENDING with T164–T170 dependencies. No task/loop count or unavailable reviewer closes a requirement.

## G7 — independent package, recovery and release

The revised archive is 67,775,959 bytes and all 39,163 payload entries verified. The local HTTPS rehearsal passed 92 checks and a direct click on the Workshop label. Actual host recovery, provider sessions, same-host staging, publication and final reconciliation remain outstanding. [Current package and decisions](release-readiness.md) · [Staging evidence](staging.md)

The owner's subsequent continuation/release instruction explicitly authorizes
reviewed GitHub publication and deployment of the finished accepted release with
its arcade listing. The initiation condition below is satisfied subject to all
specified acceptance and owner-review prerequisites; it is not another pending
generic permission request. GitHub push and GoDaddy activation remain separate.
This authorization does not pass a gate or permit calling a scaffold complete.

**Status: PENDING.** Decision task T170; destinations `docs/evidence/spec001/recovery-drill.md`, `docs/evidence/spec001/staging.md`, `docs/evidence/spec001/release-readiness.md`, `docs/evidence/spec001/release.md`, `docs/evidence/spec001/acceptance-matrix.md` and this ledger. Coverage: W09, C2/C6/C12/C13/C14/C15; FR-012/015/016/023–026; NQ-10/11/12; final AC01–21 reconciliation, especially AC11–13/16/17/19.

- T164: Produce checksummed standalone client/PHP/vendor/schema/credits/source-index package with code/content/API/save/DB compatibility metadata; verify no private website, credentials, records or backups are included.
- T165/T166: Establish consistent encrypted backups, actual retention/RPO/RTO, separate receipt expiry and deletion markers protected across rollback. Run isolated restore/migration/rollback drills for post-backup deletion, pending/completed markers, expired receipt status, failed backup/commit, competing saves and compatible code recovery. Never restore deleted accounts or expose backups as player slots.
- T167: Verify same-host staging game-only nested routes, private data, no-store APIs, exact provider callbacks/save cycles and versioned website handoff, preserving other arcade entries, analytics and unrelated routing.
- T168: Assemble the concrete reviewed artifact, rollback procedure and evidence index. All pre-publication checks must pass; name the remaining post-publication smoke checks explicitly.
- T169: Publish only after separate owner initiation. Record exact deployed version and public source retrieval, real provider/save/Continue checks, unaffected arcade/analytics and any rollback. T001 and implementation authorization do not initiate this stage.
- T170: Execute/reconcile all previously pending G7 rows and the complete AC01–21 matrix. Destructive tests remain isolated; public smoke must preserve player data. Record G7 PASS only with every required result and earlier gate/review satisfied.

If publication is not initiated, retain prepared artifacts and PENDING publication/G7 status. Spec002–007 still require separate owner initiation after the current episode is completed, tested, refined and accepted.

## Decision history

| Date | Task | Recorded change | Evidence scope |
| --- | --- | --- | --- |
| 2026-11-25 | T001 | Created eight PENDING gate entries and required evidence/dependency descriptions | [Loop note](../../implementation/loops/001-T001.md); document verification only, no executed runtime gate |
| 2026-11-25 | T002 | Verified selected local Node/PHP/Composer runtimes and PHP extension primitives; G0 remains PENDING | [Runtime audit](runtime.md), [loop note](../../implementation/loops/002-T002.md); local tool checks do not establish host or application readiness |
| 2026-11-25 | T007 | Codex `/root/loop009_t007` reviewed actual feasibility evidence and recorded G0 BLOCKED; G1–G7 remain PENDING | [Loop note](../../implementation/loops/009-T007.md); local runtime/source and technical media subchecks accepted within scope; host/provider/listening/dependency/terms work remains open. Local setup reorder proposed, not adopted by this task. |
| 2026-11-25 | T007 reassessment | Codex `/root/loop014_t007` accepted T008–T011 evidence and owner-confirmed production registration inputs; G0 remains BLOCKED, G1–G7 PENDING | [Loop note](../../implementation/loops/014-T007.md); host H01–H04, remaining basic P01/P02 controls/P04 and human listening remain open. No independent G0 work is ready without changed input. Later provider testing, production media and publication requirements retain their own gates. |
| 2026-11-26 | T035 review | Codex `/root/loop043_t035` reviewed actual guest/packet play and closed the browser exact-limit evidence gap; G1 remains PENDING and T035 incomplete | [Loop note](../../implementation/loops/043-T035.md); local visual graybox missing, external G0 prerequisite blocked. Existing scoped passes remain valid; no media/human/episode acceptance. |

T006 source/arithmetic evidence was accepted after loop008: [technical review](rule-source-review.md), 13 primary sources and 387 worksheet checks. This satisfies the scoped pre-implementation review task; it does not close G0 or human/application acceptance.

Future gate updates append the executor/reviewer, dated decision, observed evidence links, exact scoped criteria, unresolved defects and next action. Retain failed/blocked attempts and link retests rather than overwriting them. Design PASS, task completion and evidence-file existence are insufficient to advance a gate.

Coordinator execution clarification, 2026-11-25: the owner reiterated concern about
stopping after instructing “proceed only stop if its urgent.” The conservative
blanket halt in loop014 is superseded for independent local implementation by
[execution-direction.md](../../implementation/execution-direction.md). Gate statuses
and missing evidence are unchanged; local continuation is not a gate waiver.

Coordinator update, 2026-11-25: loop016 direct execution and owner corroboration
supersede the earlier SSH-access blocker. Loop019 now verifies remaining host
capabilities with scoped temporary probes. The owner also expressly authorizes
reviewed GitHub commits/pushes and accepted-release deployment; required reviews
and acceptance evidence remain unchanged.

## T035 corrective follow-up, loop 046 — 2026-11-26

Executor/reviewer: Codex `/root/loop046_t035_graybox`. This appends to, and does
not replace, the loop043 finding above. **G1-LOCAL-01 is corrected within its
local graybox scope. G0 remains BLOCKED, G1–G7 remain PENDING, and T035 remains
unchecked.** External retention/provider-control/listening prerequisites are
unchanged; root retains final review and tracking ownership.

The actual application now mounts original Three.js R01/R02 grayboxes through
the existing RoomAdapter/resource pool/shell boundary. Authored presentation-only
placements cover the actual objects, exits, floor and safe-position marker.
Mesh/number/label pointer input captures the canonical controller control at
pointerdown and dispatches that exact intent. Keyboard controls, notebook,
dialogue, O01/O02 and packet evaluation remain the same actual application.

- Six new real-app browser cases PASS; one case's visibility input is explicitly
  simulated, while scene rendering, raycasting and WebGL context loss are real.
  Visual/keyboard evidence agrees across fresh adventures, excluding their
  separately verified distinct attempt UUIDs. O01/O02 and the 105/95 m packet
  results pass. Detached/canceled input, New Adventure disposal, room swaps,
  text fallback/retry, 390 px touch layout, 200% text and automated axe pass.
- All nine prior guest and five prior packet browser cases PASS in the joined
  regression run. That run was 18/20, followed by the corrected six-case PASS;
  it is not reported as a single all-20 pass. A strengthened zero-evidence-row
  stale/cancel assertion also passes separately. Unit suite: 943 PASS, 68 TODO,
  including concurrent local T042 work; new graybox unit cases: 11 PASS.
- Agent visual inspection confirms distinct lift/workshop compositions and
  legible numbered objects/full labels. Measured graybox samples: R01 492
  triangles/26 draw calls; R02 720/45; each two geometries and one renderer
  texture. No authored images load. This is not the full AC15 benchmark.

Native background-tab visibility remains **UNVERIFIED**: installed automated
Firefox kept `document.hidden` false in both headless and headed probes. The
explicit simulated visibility test verifies application pause/resume wiring,
not native browser behavior. Actual Safari/browser matrix, human access/learning
review, finished Blender/OpenAI/audio assets and owner satisfaction remain later
requirements. These original DEV shapes count as **zero finished assets**.
See [loop046](../../implementation/loops/046-T035.md) for failures, final commands,
screenshots, exact hashes and remaining limits; [US1 follow-up](US1.md#t035-graybox-correction--2026-11-26)
records the joined investigation scope. No installation, provider action,
credential access, commit, push, deployment or publication occurred.

## Media feasibility follow-up — 2026-11-26

T005 and T065 are accepted after root verification of genuine Audacity4.0.2 native
reopen/export, preserved actual Kokoro/ACE/effect sources and the owner's sealed
speaker/headphone audition approval. See [dated feasibility reassessment](media-feasibility.md#coordinator-reassessment--2026-11-26)
and [auditions](audio-auditions.md). Historical table entries above describe their
original review dates; their media-listening blocker is now superseded. No listening
to old smoke files is invented. G0 still needs T003/T004 retention/package/provider
evidence; G1–G7 remain pending. T063/T064 production is accepted for bounded source
scope, while T066/T067 runtime/performance/owner room review remains in progress.

## Representative room candidate follow-up — 2026-11-26

Root reviewed loop 073's partial evidence: all 95 stable artifact seals match.
Independent raw-data checks confirm 12 completed Firefox samples on six distinct
cold/warm origins, 2.099–2.126 second cold readiness and 119.75–120.25 submitted
frames/second in the measured windows. Exact limits, shaped-response calibration,
cache behavior, retained failures and source/tool hashes are in the representative
review. No Safari timing sample completed; foreground/painted-surface limitations
remain explicit. Native source checks carry forward unchanged audio approval.

The owner liked the visuals and requested one contained Sierra Quest-style game
screen with contextual controls. Loop 077 implements that correction. The old
measurements are historical candidate evidence, not acceptance of the revised
interface. Revised browser/accessibility evidence, actual Safari and final owner
review remain pending, alongside earlier aggregate prerequisites. T066/T067 stay
unchecked and G3 stays PENDING. No full episode or release is accepted.

## Contained-screen correction verified — 2026-11-26

Loop077 replaces the page of controls with one contained adventure frame, compact
icons/verbs and contextual accessible windows. Final joined browser verification
passes66/66, focused units287/287, check and production build pass. Source/build
hashes stayed fixed. The [implementation packet](presentation/t077/review.md)
preserves all failed development runs and corrected input/focus/control ownership
defects. The [independent review](presentation/t078/review.md) passes five direct
scenarios plus narrow Scene/stage full-default axe, keyboard scrolling, text/visual
recovery and packet lifecycle checks. Original contrast-incomplete entries remain;
[source-color review](presentation/frame-contrast-review.md) is supplemental.

The corrected [owner review packet](presentation/t067/frame-revision/review.md)
serves the exact built candidate at the revised local preview. Owner review has
been requested; no answer is inferred. Loop073 is measuring this revision separately
from the preserved historical candidate. T066/T067 remain unchecked and G3 remains
PENDING for the required review/evidence and earlier aggregate prerequisites.
No complete episode, real-provider verification, release or deployment is claimed.

### Revised R01 measured; native/owner evidence remains pending — 2026-11-26

The frozen contained-screen candidate completed12 Firefox159 samples on six
independent origins, three cold/warm pairs per required desktop viewport. Root
recomputed readiness2.108–2.155s cold/0.661–0.694s warm, actual render cadence
113.75–120.25FPS, byte/triangle/estimated-texture bounds and source integrity.
All numeric budgets pass under the recorded calibrated local-response profile.
No page/scene-asset errors occurred. Preserve intentional guest-session503s,
favicon404s and canceled narrator range requests; warm completed entries do not
prove full audio-cache reuse. All12 inherited context-loss text predicates are
false; separate final077 keyboard context-loss/recovery evidence is distinct.

Actual Safari27.2 preflight remained hidden and outside the foreground after the
one allowed activation. No Safari timing sample, painted-surface success or
required-viewport result is claimed. Corrected-screen owner approval and usable
native Safari evidence remain pending. See the [revised owner packet](presentation/t067/frame-revision/review.md).
T066/T067 remain unchecked; G3 and earlier aggregate gates do not pass from these
scoped Firefox results. No episode release or deployment is accepted.

### Corrected-screen owner approval — 2026-11-26

The owner accepted the corrected R01 screen: “yeaht thats MUCH Better can you
drive spec001 to completion”. See [exact approval and scope](presentation/owner-frame-approval-2026-11-26.md).
T066's implementation is accepted from its verified join and this review. T067
nativeSafari evidence and earlier aggregate prerequisites remain open; G3 is not
passed by the owner's interface approval alone. Overnight continuation authorizes
ready independent implementation, without inventing login, browser, listening,
human learning or final episode results.

### Native representative benchmark accepted — 2026-11-26

T067 scoped acceptance joins12 actual Safari and12 revised Firefox samples,
source reopening, approved unchanged audio, final077/078 checks and corrected-screen
owner approval. Root independently recomputed native budgets/pause/cache/source
evidence and viewed both native viewports. See [acceptance/readiness record](presentation/representative-room-acceptance-2026-11-26.md).
The native foreground blocker is superseded; all historical failures remain.
G0 is still blocked by named host/provider checks; G1–G3 aggregate acceptance
remains pending. Local route work may continue on the verified actual inputs.
No whole episode, live provider, production deployment or G3 PASS is inferred.

### Guest checkpoint reassessed — 2026-11-26

T035 local review/US1 opening accepted following independent086 evidence review;
no remaining local guest/initialpacket defect identified. [Reassessment](guest-checkpoint-reassessment-2026-11-26.md)
checks final077/078/native and later copper evidence without rerunning unchanged
browsers. Aggregate G1 remains PENDING because G0 is not accepted. No finalepisode
or provider acceptance is inferred.

### Local complete-gameplay checkpoint accepted — 2026-11-27

Root accepted T105 after three independent no-recruit copper/fiber/radio journeys
and exact original-case reconciliation. See [US2](US2.md) and
[coordinator review](routes-t105/root-review.md).45packet files/429current inputs/
704original field groups match.734focused tests, overlapping30affected tests and
check/build pass. Four T092 whole-route deferrals are now resolved; original sealed
ledgers/fixtures/TODOs remain intact, with73explicit adaptations among98newmappedrows.

The actual-input readiness assessment permits T106 layout freeze and subsequent
media source batches under the existing tasks.md independent-work rule. T067's
accepted representative source/native/listening/owner frame evidence remains the
reference. This is scoped production readiness, not aggregate G4/G5 or release PASS.
G0–G3 external dependencies remain open; full media, literal precommit animation,
provider/human/owner episode evidence and final acceptance remain required.
