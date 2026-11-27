# SQ02 delivered-power audit: T100 consumer contract

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T097 authors the Eel's Energy Audit. `SQ02.current-schema.json` is the ordinary
quest projection, validated through a cloned join into the actual registry.
`SQ02.candidate.json` adds the proposed closed `delivered-power-audit` payload.
The coordinator reviewed the candidate and approved creation of
`content/spec001/quests/SQ02.json` as a byte-identical current-schema projection.
It remains absent from world metadata and the application loader.
The payload's isolated schema and TypeScript interfaces are in
`optional-activity.schema.json` and `power-audit-proposal.ts`. This directory is
outside global test discovery. No world metadata, schema, loader, application,
save policy or asset manifest has been changed by T097. T100 owns the common
runtime join and full-payload promotion after review. This work alone does not
complete T097 or any optional-activity acceptance gate.

## Reviewed inputs and observable result

Use the actual `PROFILE-POWER`, `PHY08`, `S10` claims and `evaluatePower` from
`src/domain/power.ts`. Budget and demands are delivered watts after losses.
The fictional 30 W ceiling includes equality. Each supplied port and other
compatibility requirement is independently satisfied in the three audit cases.
Do not add losses, PoE classes, a per-port wattage threshold, electrical delivery
over fiber or a new physical rule.

| Authored mode | Source case | Demands | Actual plan result | Diagnosis |
| --- | --- | --- | --- | --- |
| Practice | C-POWER | 12 W + 11 W | correct; 23 W total, 7 W headroom | within-budget, 7 W |
| Full audit (`delivery`) | T10 | 12 W + 11 W + 10 W | incorrect; 33 W total, 3 W excess | over-budget, 3 W |
| Worked boundary detail | B-POWER-30 | 12 W + 11 W + 7 W | correct; 30 W total, 0 W headroom | within-budget, 0 W |

A correct learner diagnosis of T10 leaves the physical plan **incorrect**. The
completion text names a successful diagnosis and an unrepaired, over-budget
proposal. No result proves data connectivity. The optional activity does not
select a replacement kit or complete O09. The practice and boundary detail are
worked assistance, not completion or proof of independent understanding.

The three oracle cases in immutable `tests/fixtures/optional-activities.json`
remain unchanged. `OPT-SQ02-DIAGNOSE` and `OPT-SQ02-WRONG-DIAGNOSIS` are exercised
through the isolated proposal using actual power observations; both boundary
results use the real evaluator. The eight lifecycle cases require the common
controller and browser join before they are executable acceptance evidence.

## Typed submission and scoring boundary

Keep the common fields and modes proposed by SQ01: `instructions`, `controls`,
`recovery`, `entryContexts`, `returnPolicy: captured-entry`, `timingDefault: off`,
separate `practice` and `delivery` feedback, and canonical quest rules, effects,
source claims and hints. The SQ02 additions are `boundaryExample` and
`answerControls`. Each numeric case has an exact `sourceCaseId`, explicit
`demands: {value, unit: W}[]`, two delivered-after-losses boundary labels, and
`otherConstraints: true`. Display the budget, demands, units and assumption
beside the answer throughout solving.

The proposed answer has this closed shape:

```ts
interface PowerAuditAnswer {
  assessment: 'within-budget' | 'over-budget';
  difference: { value: number; unit: 'W' };
}
```

Use a labeled choice and numeric watt field. Blank text must remain missing,
not become zero through numeric coercion. The value must be finite and
nonnegative; reject strings, missing/wrong units and unknown properties before
learner scoring. Zero is a legitimate boundary answer when deliberately entered.
The full audit requires both the over-budget assessment and the exact 3 W excess.
A well-formed wrong number or assessment is `incorrect`; an empty/malformed
answer is `invalid-input`. Unsupported authored data wins over either result.

The isolated `evaluateAuditAnswer` proposal demonstrates the narrow adapter:
verify source-case quantities, pass the existing captured version to actual
`evaluatePower` with its `check-allocation` input, then compare the learner's
assessment and difference to that evaluator's `budgetFits`, `headroom` or `excess`.
It does no second sum or power-budget calculation. It preserves physical
`planStatus` separately from `learnerStatus`, returns no effects, and cannot
repair or award anything. Preserve the four-status envelope and stale-action
result when integrating it. Do not import this evidence-directory proposal
directly into production; T100 may promote reviewed logic to its owned module.

The shared submit intent must be discriminated from toy-symbol `bits`, carry the
matching session ID and original adventure/version capture, and contain only
the learner answer. The current session chooses the authored mode/challenge.
The caller cannot supply a case, profile, status, effect, reward, return room,
completion or fresh capture. `ACTION-SQ02-audit` must not be executable through
a generic content-action path that bypasses this live-session evaluation.

## Completion, help, retry and exit

Only a correct full-audit diagnosis selects the exact canonical two-effect
batch: `EFFECT-SQ02-audit` records `FACT-SQ02-audit`, then
`EFFECT-SQ02-complete` completes `SQ02`. Bind both `once` to the same
`{kind: quest, id: spec001:SQ02}` receipt. The alternative's effects are empty.
Partial batches, different reward aliases and main-objective effects must fail
closed. Repeated delivery/new action IDs must not duplicate the reward.
Practice, boundary detail, wrong answers, invalid input and content errors
select no completion effects. The domain/proposal status alone never selects
the batch without a matching full-audit session.

Record actual SQ02 hint IDs with the approved lesson-source assistance policy.
Opening worked practice/boundary detail or showing corrective answers records
assistance. The full worked solution does not reduce a valid reward. An already
completed replay may explain or practice but does not reaward. Facts retained
through encounter Retry do not constitute quest completion.

Start at the actual `HOTSPOT-market-eel` in R09, `R09.entry`; the Eel can host
without being recruited or active. Validate the actual safe entry and capture
the player's location, preparation and prior safe state. All unfinished phases
and completed feedback have an exit. Exit closes only that matching session at
its captured origin; it cannot teleport to R02 for the decoration. Skip starts
nothing. Neither consumes inventory, changes main objectives/route/party,
refreshes measurements, touches an account save or initiates a save operation.

The common Retry restores its captured preparation, uses a fresh attempt,
advances revision, retains clues/notes/help, and leaves retained measurements
stale. Preserve accepted same-session completion in the common replay baseline.
Actual encounter Retry/E03 Continue still obey the existing whole-world
checkpoint semantics: if the earned quest rewinds, its retained audit fact alone
must not reveal the decoration. The isolated tests execute this existing reducer
boundary, not a complete optional/encounter browser journey. Restore/new
adventure/account changes invalidate all old optional callbacks and sessions.

## Existing reward allocation and production obligation

`ASSET-ILLUSTRATION-18` is the existing **Delivered-power ledger** allocation in
`assets-src/audio/production-plan.json`: R09, journal, one supplied delivered-
budget tray with three endpoint demand tiles; its learning intent explicitly
names T10/SQ02. Its manifest record is planned, with no exports or quota credit.

The coordinator reviewed this allocation in loop110 and approved a second use
of that same image as a cosmetic R02 Workshop wall print. This adds usage, not
a new image, 3D prop, inventory item, physical tool or media quota. It is a small
commemorative ledger decoration. Root/T106 must reconcile the production plan's
secondary R02 placement before producing/integrating the media. Do not set
manifest `usedBy` to an unobserved runtime use; it remains root-owned.

Presentation unlocks the decoration only when both `completedQuestIds` contains
SQ02 and `notebook.factIds` contains FACT-SQ02-audit. Resolve the existing asset
through actual reviewed manifest/export availability; no guessed URL is in the
candidate. Use the authored description/fallback when the picture is unavailable.
The completion record alone does not certify finished artwork, Blender prop
production, actual wall placement or visual review. Media integration must retain
the original journal allocation and observe the approved Workshop placement.

## Remaining coherent join

T100/root must review and integrate the typed union/schema, semantic source-case
bindings, loader/world document entry, reducer/action-bus dispatch, contained UI,
reward predicate and generated JS/PHP lesson policy. Negative coverage must
include wrong mode/case/profile, forged action/reward/effects, missing/invalid
answers, stale callback, retained fact without completion, account/restore
invalidation and precise once-only receipt selection. Preserve original frozen
T092 artifacts and independent expectations.

T104 must execute START, PRACTICE, FINISH, RETRY, EXIT, SKIP, REPLAY and UNTIMED
through the actual shared interfaces, plus the three learning cases. Required
keyboard/focus/Escape, contained 200%/narrow presentation, account-save round trip,
measurement freshness and all-party-independent paths remain open. T097 resumes
in the same loop110 worker after common integration; no authoring-only result
certifies runtime, human learning, media or episode acceptance.
