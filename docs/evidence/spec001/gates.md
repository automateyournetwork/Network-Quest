# Spec001 G0–G7 evidence ledger

Created 2026-11-25 for T001; reassessed 2026-11-25 at T007, loop 014. **G0 BLOCKED; G1–G7 PENDING.** T008–T011 local preparation has passed; no gate has passed.

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). SPDX-License-Identifier: CC-BY-4.0.

Authority: [constitution](../../../.specify/memory/constitution.md#development-workflow-and-quality-gates), [root build order](../../../PLAN.md#build-order), [feature plan](../../../specs/001-physical-layer-underworld/plan.md), [task execution table](../../../specs/001-physical-layer-underworld/tasks.md#execution-sequence-and-gate-dependencies). Requirement/interview/acceptance mappings and the evidence record format are in the [index](index.md). Paths in code below are planned repository-relative destinations, not claims that files or results exist.

## Gate decisions

| Gate | Work package / decision task | Required preceding work | Current status | Observed result / reviewer / evidence |
| --- | --- | --- | --- | --- |
| G0 | W01 / T007 | T001–T006 evidence and T008–T011 local preparation | BLOCKED | Codex `/root/loop014_t007`, 2026-11-25: local preparation accepted; host capabilities, remaining provider controls and listening remain open. Production registration existence/environment/callback inputs are owner-confirmed. [Reassessment](../../implementation/loops/014-T007.md) |
| G1 | W02 / T035 | T001–T011, T012–T021, T022–T030, T031–T034; G0 | PENDING | Not executed; reviewer not assigned; no runtime evidence |
| G2 | W03 / T058 | T036–T057 after G1 | PENDING | Not executed; reviewer not assigned; no runtime evidence |
| G3 | W04 / T067 | T059 measurement harness, T060–T066 after G2 | PENDING | Not executed; owner review pending; no runtime/media evidence |
| G4 | W05/W06 / T105 | T068–T104 after G3, including first route, outcomes, R12 and optional activities | PENDING | Not executed; reviewer not assigned; no runtime evidence |
| G5 | W07 / T141 | T106–T140 after G4 | PENDING | Not executed; visual/listening review pending; no accepted inventory |
| G6 | W08 / T163 | T142–T158 then T159–T162; G0–G5 | PENDING | Not executed; beginner/technical/owner reviews pending |
| G7 | W09 / T170 | T164–T169 after G6; owner initiation required for T169 live publication | PENDING | Not executed; packaging/recovery/staging/publication evidence pending |

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

## G2 — identity, one save and world structure

**Status: PENDING.** Decision task T058; destinations `docs/evidence/spec001/US4.md`, `docs/evidence/spec001/real-providers.md` and this ledger. Coverage: C6/C8/C12; FR-003/010–016/025; NQ-04/08/10/11/12; AC11–13/17 and authored world structure.

Exit: validated complete room/objective graph and stable IDs; content/state/inventory/notebook/compendium contracts; server-owned identity/revision; guest adoption and explicit replacement; one conditional/idempotent slot; default-off safe autosave; separate preferences; honest failures/conflicts. T056 executes SAVE01–13 against controlled states, real competing connections, lost responses, schema/content policy changes and authorization/receipt races. T057 must separately demonstrate actual Google and GitHub sign-in/save/close/restore/cross-device isolation; mocks cannot satisfy it.

Preserve canceled/confirmed logout and retained-learning preparation retry exactly as the [case invariants](index.md#case-level-invariants-that-evidence-must-preserve) specify. Resolve retained save receipts before semantic/revision rejection, recheck in the final transaction, and reconcile older acknowledgements with the current slot. Lost deletion response requires operation-specific status, never session absence; unknown/expired remains unconfirmed and later-account responses are isolated. Prepared encounter/migration checks stay labeled as such; T089/T144 and operational T166 evidence remain later dependencies.

## G3 — representative finished room

**Status: PENDING.** Decision task T067; destinations `docs/evidence/spec001/measurement-profile.md`, `docs/evidence/spec001/audio-auditions.md`, `docs/evidence/spec001/representative-room.md` and this ledger. Coverage: C5/C11/C14; FR-017–022/026; NQ-09; AC08–10/14/15/18/20 representative scope.

Exit: finished R01 uses real reopened Blender scene/character sources, usable exports/animations, genuine OpenAI images/layers and preserved production lineage; voice/music/effect auditions have actual listening and rights evidence. Inspect browser/source appearance and coherent art direction. The owner reviews this actual room before scaling production. A placeholder or successful export alone cannot pass.

Freeze recorded reference laptop/OS, exact browsers including actual Mac Safari, 1280×720/1440×900 viewports, cold/warm cache and 20 Mb/s/50 ms profile. Measure shell ≤5 MiB compressed, first room ≤15 MiB, readiness ≤12 s, ordinary exploration ≥30 FPS, provisional ≤500,000 visible triangles and ≤128 MiB estimated texture residency, plus disposal/recovery. Distinguish estimated texture data from GPU measurement and baseline sample results from final-episode performance. Preserve every failed sample; do not silently reduce asset/teaching commitments to meet a budget.

## G4 — complete gameplay

**Status: PENDING.** Decision task T105; destinations `docs/evidence/spec001/first-route.md`, `docs/evidence/spec001/US2.md`, `docs/evidence/spec001/US3.md`, `docs/evidence/spec001/US6.md`, `docs/evidence/spec001/US7.md` and this ledger. Coverage: C1/C3/C4/C8/C9/C10/C12; FR-001–010/013; NQ-01–08/13; AC01–07/12/21 gameplay scope.

Exit: T078 proves one complete copper route with temporary geometry before broader production. Then each copper/fiber/radio route independently completes its valid ending through all required common objectives, without an unvisited route, optional reward or future realm dependency. All twelve rooms are playable. All T01–T16 and per-objective independent cases, wrong/valid alternatives, invalid content and staleness checks pass.

T089 proves E01 permanent restoration, E02 temporary restoration, E03 unresolved safe shutdown, personalized epilogues, warned commitment, fair failure and exact rollback/retained-learning/save/logout behavior in the real UI. T091 proves repaired R12 alongside R01 packet truth. T104 proves 25 accurate entries, nine recruits/progression/abilities, two active allies/equivalent tools, SQ01–04 and MG01–03 instructions/start/finish/retry/exit without mandatory timing. Portrait-dependent AC05 and all finished-media requirements remain pending through G5/final regression; temporary art is never counted as finished.

## G5 — complete integrated media

**Status: PENDING.** Decision task T141; destination `docs/evidence/spec001/media-audit.md` and this ledger, supported by `assets-src/manifest.json` and per-batch/source/export records. Coverage: C3/C5/C11/C13; FR-002/017/018/024; NQ-09; AC08–10 and final illustrated AC05 dependency.

Exit: inspect all twelve finished rooms; reopen actual `.blend` sources for at least 25 distinct character models and 150 named reusable props, with at least 50 interactive/evidence props, required animations, usable exports, rights and observed placements. Recolors, duplicate instances, invisible filler and pictures of models do not satisfy counts. Benchmark assets count once.

Prove at least 36 usable room layers, 25 portraits, 24 illustrations, eight music cues, twelve ambiences, forty effects and sixty selected voice lines, with actual generation/edit lineage and native sources. Retain `.aup4`, raw generation/recording/MIDI where applicable, lossless masters and web exports; Audacity 4 has no legacy scripting pipe. Record visual inspection and genuine listening, not waveform-only assertions. Demonstrate R01 3D, R05 layered/real-time and R04 Blender sprites with shared state and accessible text. T132 inventory consolidation alone is not runtime integration or quality acceptance.

## G6 — whole-episode validation and refinement

**Status: PENDING.** Decision task T163; destinations `docs/evidence/spec001/acceptance-matrix.md`, `docs/evidence/spec001/technical-review.md`, `docs/evidence/spec001/beginner-playthrough.md`, `docs/evidence/spec001/refinements.md`, `docs/evidence/spec001/owner-review.md` and this ledger. Supporting records: `migrations.md`, `US5.md`, `browser-matrix.md`, `performance.md`, `independent-build.md`, `US8.md` under the same evidence directory. Coverage: W08, C1–C15, FR-001–026, NQ-01–13, all AC01–21 with explicitly scoped later operations.

Exit: T159 executes integrated gameplay/content/media/access/security and eligible SAVE01–13 regressions. Check hypothetical future door/renamed ID/removed position migrations without implementing Spec002; preserve unsupported newer saves. Prove complete keyboard/text/muted/reduced-motion/200% zoom/focus/assistive and recovery behavior, exact current/previous supported Safari/Chromium/Firefox releases including actual Safari, 1280×720/1440×900 and 768/390 px responsive controls. Record untested combinations; touch layout is not mobile performance certification. Measure final worst scenes, resource disposal, cold/warm loads and save p95 <2 s at 20 mixed sessions, with failures/host limits retained.

T157 proves clean isolated candidate setup/build/public-input source retrieval; later public availability remains pending. T160 records an actual technical review of sources, models, hints, characters, packet and transfer cases. T161 observes at least one networking beginner's unassisted/lightly assisted main run, timing against 60–120 minutes, reasoning/hints/misconceptions. T162 corrects concrete findings and retests. T163 records actual owner's episode satisfaction. Automated agents/tests cannot certify human learning, audible quality or owner approval.

Keep every AC01–21 row visible. G6 passes only its executable criteria and actual reviews; it is not full release acceptance. Packaging/public retrieval, operational backup/restore/rollback, same-host staging and production smoke remain PENDING with T164–T170 dependencies. No task/loop count or unavailable reviewer closes a requirement.

## G7 — independent package, recovery and release

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
