# SQ01 consumer contract for T100

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T096 authors the Antique Serial Post. `SQ01.current-schema.json` is a quest that
passes the existing schema and registry in an isolated, cloned document join.
`SQ01.candidate.json` adds the proposed `optionalActivity` payload;
`optional-activity.schema.json` validates only that proposed payload. The canonical `content/spec001/quests/SQ01.json` equals the current-schema
projection byte for byte; a regression check prevents drift. It is not yet listed
in world metadata or loaded by the application. T100 owns the common schema, semantic validation,
controller, captured action-bus integration, save-policy join and contained UI.
Do not parse challenge samples or reward identity out of prose.

The proposed shared fields are `entryContexts[]`, `returnPolicy`, `instructions`,
`timingDefault`, `controls`, `recovery` and `reward`. Existing quest `ruleIds`,
`profileIds`, `sourceClaims`, `model`, `hints`, `effects` and `prerequisite` remain
canonical. The closed `toy-symbol-message` variant supplies `profileId`, separate
`practice`/`delivery` samples and mode-specific feedback. Other activities need
separately reviewed variants; this proposal does not invent their behavior.
Multiple entry contexts permit SQ04's later multi-room activity without implying
that an exit can choose another room. No timed capability is offered.

## Intent and evaluator result

T100 should register a closed intent family on the existing captured action bus:
start(activityId), choose-mode(sessionId, practice|delivery), submit(sessionId,
bits), request-hint(sessionId), retry(sessionId), replay-explanation(sessionId),
exit(sessionId). These are proposed operation names, not currently exported APIs.
Mode belongs to the matching live activity session; submit cannot replace the
challenge, effects, accepted status, reward, return position or mode. Capture the
adventure/account generation, world version and activity-session identity; never
recapture a stale callback against newer state.

At start, validate the actual authored room/hotspot/safe position, prerequisite and
safe activity state. Capture the actual entry context. Keep the displayed map and
text instructions accessible throughout the activity. A matching exit closes the
activity at that captured context; it does not navigate, refresh measurements,
restore an unrelated old world, or release another session's lock. Restore,
new adventure and account change invalidate the session and all its callbacks.

Derive `SymbolChallenge` from the actual registered `PROFILE-SYMBOLS` and the
selected authored samples. Call existing
`evaluateSymbolAnswer(challenge, DomainAction<{ bits }>, currentWorldVersion)`.
It checks the supplied mapping, units, sample order and action version, returning
`correct | incorrect | invalid-input | content-error`, an actual observation,
and **no effects**. Do not create another decoder. Validate authoring/source-case
agreement before learner scoring; malformed content takes precedence over a bad
answer and grants no penalty or completion.

| Mode/result | Feedback source | Allowed durable completion effects |
| --- | --- | --- |
| practice/correct | `feedback.practice.correct` | None; +3→11 is two bits in one symbol, never delivery |
| practice/incorrect | `feedback.practice.incorrect` | None; explain +3→11, not the full message |
| practice/invalid-input | `feedback.practice.invalidInput` | None |
| delivery/correct | `feedback.delivery.correct` | Full canonical SQ01 batch once |
| delivery/incorrect | `feedback.delivery.incorrect` | None; expected full strip is 00101101 |
| delivery/invalid-input | `feedback.delivery.invalidInput` | None |
| either/content-error | `feedback.contentError` | None; safe exit stays available |
| completed delivery/replay | `feedback.alreadyCompleted` and explanation | None; existing journal reward remains one |

Correct full delivery selects the actual authored common effects plus the actual
`ACTION-SQ01-deliver` alternative effects (currently empty). Bind both
`EFFECT-SQ01-journal` and `EFFECT-SQ01-complete` with `mode: once` and the same
`{kind: quest, id: spec001:SQ01}` receipt. The existing reducer requires the whole
batch atomically and deduplicates new action IDs and restored completion state.
T100 must select this batch only for the correct full delivery mode. The pure
reducer cannot infer that mode from a caller-supplied `correct` status. A wrong,
missing, malformed, stale or practice result never selects it.

Hints/worked examples reveal help without modifying completion. Record use of
method/worked/solution help separately through the existing assistance contract;
showing the full answer as corrective feedback must not later be reported as an
unassisted demonstration. The reward is equal for assisted valid completion.
Ordinary map inspection alone is not proof of independent understanding.

## Retry, exit and durable state

SQ01 never mutates the physical setup or consumes inventory. Retry resets its
transient message answer/mode state while retaining facts, personal notes and
hint history. If the shared activity mechanism advances attempt/configuration
identity, previous measurements must remain visible as stale and cannot become
current again. For any activity that changes configuration, T092 additionally
requires actual preparation restoration, a fresh attempt and revision advancing
beyond the changed attempt. The common controller must enforce that general
case; this quest must not fabricate a physical mutation merely to exercise it.

Every unfinished phase (instructions, practice, solving, feedback) and completed
feedback exposes exit. Skip does not start the activity. Neither operation
changes required inventory, route, main objective progress, party, ending or save
slot. Retry and exit issue no save. Later ordinary manual/opted-in safe-save
eligibility remains the existing coordinator's responsibility.

Persist only existing canonical fields: `completedQuestIds`, the journal fact,
and honest assistance records when used. Do not store transient form answers,
activity sessions or media availability in a new save slot. T100 must extend the
actual JS/PHP content policy from the joined registered quest, keeping receipt-first
save replay intact. T104/T105 must check optional progress across actual encounter
retry, restored saves and account changes; these tests do not exist in T096.

## Reward and media

Unlock the journal illustration by the quest completion receipt together with
`FACT-SQ01-delivery`; a fact retained as learning during rollback alone must not
regrant a reward or prove completion. Resolve the declared
`spec001:ASSET-ILLUSTRATION-08` against the asset manifest. Its existing production
allocation is “Antique serial message strip”, R04, journal use, Tortoise telegraph
and sequential marks. No image URL is invented. Use `alternativeText` when an
accepted image exists and `unavailableText` while it is unavailable. This leaves
the actual image production, provenance, integration and visual review open.
Text fallback preserves access but does not satisfy the image delivery gate.

## Required join validation

T100 must add structural and semantic negatives for unknown/mismatched profile,
source case, room/hotspot/anchor, reward fact and manifest identity; missing
practice/exit controls; an optional action that awards a main objective; mutable
or repeated reward aliases; and partial receipt batches. The source-case symbols
must match immutable T12/B-SYMBOL, with positioned samples matching the existing
evaluator. Schema shape alone cannot establish these semantic guarantees.

T104 must execute the eleven immutable SQ01 cases: START, PRACTICE, FINISH, RETRY,
EXIT, SKIP, REPLAY, UNTIMED, DECODE, WRONG-ORDER and ONE-SYMBOL. In T096 only the
last three have actual decoder receipts; the first eight remain controller/browser
pending. Existing reducer checks establish receipt mechanics only. Full activity,
keyboard/focus/contained layout, media, PHP save and human learning acceptance
remain open.
