# MG01 Bit Loom candidate and later common join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T101 authors the optional Clockworks Bit Loom. `MG01.current-schema.json` is a
minigame that passes the actual current registry in a cloned document join.
`MG01.candidate.json` adds the proposed closed `toy-symbol-loom` payload.
`optional-activity.schema.json` validates that payload separately. After
coordinator review, `content/spec001/minigames/MG01.json` is byte-equal to the
current-schema projection. It is unregistered and unloaded. The full candidate
and common runtime join remain pending separate review. No task or aggregate
gate is accepted here.

This proposal reuses the reviewed SQ01 common field names and the actual
`evaluateSymbolAnswer` decoder. It does not make the SQ01 quest identity guard
accept a minigame. T100's current controller is quest-only. The later join must
explicitly recognize this variant, minigame receipt and input contract.

## Authored identity and teaching

| Field | MG01 binding |
| --- | --- |
| Speaker | `spec001:CH21`, the existing Metronome Golem |
| Entry | `R10`, `R10.entry`, `HOTSPOT-clockworks-loom` |
| Prerequisite | `always`; no O10, recruit, item or other optional completion |
| Rule/profile | Existing `PHY10` / `PROFILE-SYMBOLS` |
| Full strip | `T12`: positions 0–3, toy levels −3, +1, +3, −1 |
| Practice | `B-SYMBOL`: position 0, toy level +3 |
| Full answer | 00101101: eight represented bits in four symbols |
| Practice answer | 11: two represented bits in one symbol |
| Full action | `spec001:ACTION-MG01-decode` |
| Completion | `spec001:ACHIEVEMENT-MG01-complete` |
| Notebook fact | `spec001:FACT-MG01-completion` |
| Benefit | `optional-practice-only`, exactly as T092 specifies |

The source claims are copied unchanged from the actual reviewed symbol profile:
S01 gives physical bit-transfer context, S12 distinguishes four-level coding,
and S13 supplies timing-recovery context. The exact linear toy mapping remains
−3→00, −1→01, +1→10, +3→11. No new numeric rule or decoder is introduced.
Toy levels are not volts; supplied sample positions do not implement analog
clock recovery, UART, RS-232, NTP or a complete PAM4 PHY. Symbol count supplies no
elapsed transmission time or useful throughput. Neither this exercise nor its
completion proves physical repair, address discovery, routing or application
health. A completion record is not proof of independent understanding.

The existing O10 loom actions remain intact and independently reachable. Its
actual step-and-decode and notebook-and-replay methods both pass the isolated
real reducer check without starting MG01, awarding its fact or storing a score.
Do not replace O10's common-mode, physical-role, fresh-measurement and submit
checks with this optional exercise.

## Closed answers and completion

Use the existing captured optional action-bus family for start, choose-mode,
submit, hint, explanation, retry and exit. The learner answer is only
`{ bits: string }`; the active session supplies practice/full mode. UI callbacks
cannot supply a verdict, effects, samples, profile, completion identity, return
position or new world version. Preserve the original captured session,
adventure/account generation and attempt/configuration identity. A stale callback
must fail; do not recapture it against newer state.

Select samples from the actual registered definition and call the existing
`evaluateSymbolAnswer` with `PROFILE-SYMBOLS`. It returns observations and no
effects. Validate exact profile, source cases and sample positions before scoring.
An undefined authored level, missing position, wrong unit or changed map is
`content-error`, even when the learner answer is absent. A missing/malformed
learner answer is `invalid-input`. Both leave completion unchanged and permit
safe exit. Bit answers with the wrong order receive explanatory feedback and
retry; they do not earn completion.

| Mode/result | Full completion batch |
| --- | --- |
| Practice/correct or incorrect | None; explain the single +3 sample only |
| Practice/missing input | None; request a practice answer |
| Full/correct, first accepted completion | Own fact plus own minigame completion |
| Full/incorrect or missing input | None; feedback and retry remain available |
| Either/content-error or stale action | None; no learner penalty |
| Replayed completed full answer | None; explanation remains available |

The full successful batch is exactly `EFFECT-MG01-notebook` (`record-fact`) and
`EFFECT-MG01-complete` (`complete-minigame`, `minigameId: spec001:MG01`). Bind both
with `mode: once` and the same `{ kind: minigame, id: spec001:MG01 }` receipt.
The actual reducer resolves the registered `completionAchievementId` into the
existing `achievementIds` field. There is no objective/quest alias or new save
field. The isolated reducer checks reject partial batches, deduplicate new action
IDs and reconstructed reducer state, and require the registry for completion
conditions. A fact retained as learning alone does not prove completion.

Tests using an explicit trusted reducer evaluation prove this receipt boundary
only. They are not a production controller authorization check. The later
controller must select this entire authored batch only from an accepted full
answer, never from a caller's `correct` string or a successful practice result.

## Help, retry, exit and one-save behavior

Keep the map visible without treating ordinary inspection as independent
understanding. The method/worked-step/solution ladder belongs to MG01's explicit
`LessonSourceId`. Worked practice and the full answer shown as corrective
feedback must record assistance through the common mechanism. Assisted correct
completion earns the same optional record; it does not create a punitive ending.
Keep practice feedback separate so its one-symbol explanation does not claim to
have taught or finished the full strip.

This variant offers no timed capability. Both timing defaults are off; the
required schema's `timingUnlock: after-untimed-completion` is a constraint on any
future optional timing, not a declaration that a timer exists. No score or timer
is stored or checked. T092 explicitly permits omitting timed mode.

Retry uses the common captured preparation recovery, retains clues/notes/help,
allocates a fresh attempt and marks retained old readings stale. MG01 itself
does not alter physical configuration or consume items. Do not invent a physical
mutation simply to exercise T092's general retry oracle. The common retry path
must still handle the independently prepared changed-configuration case, restore
required tools and advance revision beyond that changed attempt. A previously
accepted completion belongs in the same-session replay baseline. Encounter
Retry/E03 Continue and Restore Save retain their distinct existing contracts.

Expose exit during instructions, practice, solving, feedback and completed
feedback. A matching exit closes the matching session at its captured R10 origin;
it cannot release a different session, navigate, refresh a reading or save.
Skipping never starts the activity. Required inventory, main progress, party,
route and ending remain intact. Save eligibility resumes through the existing
safe-state coordinator after closure, with no implicit save on retry or exit.

The later JS/PHP policy join must derive the achievement, fact and three hints
from actual registered content. Preserve receipt-first save replay, one-slot
semantics and existing save-v1 shape. Transient answers, activity sessions and
timing state are not persisted. Account change, new adventure and restore must
invalidate old activity callbacks. Actual save/account round trips remain open.

## Contained presentation and media

Use the existing contained adventure overlay, labeled keyboard controls,
visible focus and Escape exit. The complete map, sample order and input must
remain available at 200% text size and narrow width. No timing, color, audio,
animation or precise pointing may be required. Keep compact instructions in the
panel and place the extended model/source explanation in its contextual details;
do not append another webpage of buttons below the scene.

No image, item or decoration is an MG01 reward. The production plan already
allocates ILLUSTRATION-19, “Toy four-symbol key,” to R10/O10 diagnostics, and
PR092/PR093/PR096 to the loom/map/sampling gate. Those references are not proof
of produced, reopened, optimized or reviewed media. This worker changes no
manifest, URL, artwork, asset source or quota. Later media joins remain separate.

Original writing is CC BY 4.0; original tests/schema/interface code are
Apache-2.0. Reviewed primary-source claims retain their source identities and
limitations. No external images, game scripts or new third-party assets are used.

## Evidence and pending acceptance

The three immutable learning cases execute the real decoder, and two malformed
input/content cases have real status/zero-award receipts. Their runtime retry or
safe-exit clauses remain pending. O10 independence executes both real mandatory
calibration routes. Schema and isolated receipt checks supplement those results;
they do not implement the lifecycle.

All eight MG01 lifecycle cases remain pending actual common binding and native
execution: START, PRACTICE, FINISH, RETRY, EXIT, SKIP, REPLAY and UNTIMED. Timing
guard/opt-in acceptance also remains scoped to the actual no-timer UI. Final
integration needs shared variant/schema/registry/loader/session/controller/UI and
JS/PHP content-policy review, actual closed-intent and stale-callback checks,
native keyboard/focus/zoom/exit checks, save/restore/encounter recovery, and
T104/T105 broader regressions. Human technical/learning/owner review, finished
media and aggregate gates are not claimed. Resume this same worker after the
coordinator releases the common join.
