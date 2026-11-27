# MG02 Prism Budget Bench candidate

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T102 prepares an optional optics lesson and a closed `optical-budget-bench`
variant. `MG02.current-schema.json` passes the real registry in a cloned document
join. `MG02.candidate.json` adds the separately validated proposed payload. The
full variant is not an active schema, loaded activity or controller. After
coordinator review, `content/spec001/minigames/MG02.json` is byte-equal to the
current-schema projection, unregistered and unloaded. Actual integration and
task acceptance remain pending. This work owns no shared source or manifest.

## Identity and supported cases

| Binding | MG02 value |
| --- | --- |
| Room / safe origin | `spec001:R06` / `spec001:R06.entry` |
| Existing entry hotspot | `spec001:HOTSPOT-fiber-r06-pr059`, the link budget abacus |
| Speaker | `spec001:CH16`, SFP Hermit Crab; recruitment is not required |
| Real prerequisite | `objective-complete: spec001:O06` |
| Reviewed rules / profile | `PHY03`, `PHY06` / `PROFILE-OPTICAL` |
| Practice | `T04`, supplied compatible profiles and 8 dB total passive loss |
| Full diagnosis | `T05`, supplied compatible profiles and 10 dB total passive loss |
| Boundary comparison | `T15`, supplied compatible profiles and 9 dB total passive loss |
| Compatibility cards | `C-COMPAT`, `T07`, `B-COMPAT`, exact supplied premises |
| Full action | `spec001:ACTION-MG02-diagnose` |
| Completion | `spec001:ACHIEVEMENT-MG02-complete` |
| Notebook depth | `spec001:FACT-MG02-completion` |
| Benefit | `optional-optical-depth`, exactly as T092 specifies |

O06 unlocks the optional bench; the prerequisite arrow cannot be reversed.
The actual isolated fiber preparation, measurement and objective reducer paths
are exercised for both passive paths before the bench is eligible, without an
MG02 achievement, fact, recruited ally or score. These checks use prepared
opening states and the real reducer; they are not a new browser walkthrough.

The six T092 case IDs are unchanged. `evaluateOptics` supplies all arithmetic
and technical verdicts. The adapter compares a learner's numeric predictions
with its observations; it does not implement another loss-budget calculation.

| Case | Receive | Margin | Required reserve | Overload | Physical verdict |
| --- | --- | --- | --- | --- | --- |
| T04 | −11 dBm | 3 dB | Met | False | Correct |
| T05 | −13 dBm | 1 dB | Not met | False | Incorrect |
| T15 | −12 dBm | 2 dB | Met, inclusive boundary | False | Correct |

The full answer is a correct **diagnosis of a failing plan**. Its underlying
physical status stays `incorrect`. Sensitivity is met while the 2 dB reserve is
not; this is distinct from overload. No equipment flag, component, measurement,
route, main objective or service state is repaired by the exercise.

The loss totals already include every modeled component. This contained stage
uses only 8/10/9 dB and invents no per-connector, splice or fiber loss, amplifier,
real product or universal limit. The −3 dBm transmitter through nonnegative
passive loss cannot produce the separate 0 dBm receive observation. T06 is
tested only as existing domain context for overload, with its own observed
receive-only challenge; it is not an added scored MG02 card or passive path.

Compatibility cards are read-only explanations, not reward triggers:

- C-COMPAT supplies known profiles, every required compatibility check true,
  and required inspection complete. `optical-inspection` proves the scoped
  inspection result, not intervention, receive budget or service.
- T07 supplies known incompatible profiles despite a sufficient nominal budget.
  `optical-compatibility` returns the actual incompatibility observation, without
  numeric receive or margin evidence. It supplies no inspection result.
- B-COMPAT explicitly supplies matching connector shape, a failed required
  wavelength direction and sufficient arithmetic. That failed required
  predicate rejects compatibility. Other check values and inspection are
  unspecified; the adapter must not manufacture them.

The labels name media, wavelength direction, supported rate, connector/polarity
and host support as distinct required checks. A connector is never a complete
compatibility verdict. The exact source claims are retained. S06/S07 support the
optical equations and module-specific compatibility context. The current whole
PHY03 registry contract also requires S03/S08/S10; their source limitations and
additional MG02 limitations explicitly state that they supply no optical
threshold, module, component loss or diagnosis. The first run exposed this source
coverage omission; its genuine failure remains in `02-authoring.log`.

## Closed input and trusted authority

The learner submits only:

```ts
{
  receive: { value: number, unit: 'dBm' },
  margin: { value: number, unit: 'dB' },
  reserve: 'met' | 'shortfall',
  overload: 'not-overloaded' | 'overloaded'
}
```

Both numbers must be finite and within −128 through 128, inclusive. This is a
bounded answer-entry policy for these supplied cards, not a physical receiver
range. Negative receive and margin predictions are allowed; incorrect values
are learner answers, not malformed content. Decimal predictions are accepted
without coercion, rounding or epsilon comparison. UI should retain explicit
unit labels, use decimal-capable inputs, and distinguish a blank value from zero.

The controller selects the actual registered practice/full case and projects
its existing validated optical profile to `{ id, parameters }`. The adapter
checks exact case IDs, compatibility and loss quantities against reviewed
sources before grading. Missing/altered author values or profile parameters
are `content-error`, even with an absent answer. Malformed/extra answer fields
are `invalid-input`. Caller verdicts, effects, profiles, samples, context,
mode, rewards and return positions are not answer fields. The read-only card
intent is only `{ kind: 'inspect-card' }` for an internally selected card.

Preserve the existing captured optional action-bus envelope. Never recapture a
stale callback against the latest attempt/configuration, session, adventure or
account. The prototype adapter preserves version captures and the real evaluator
rejects stale/malformed envelopes. Full runtime session ownership, mode-change
checks and account invalidation remain the later common controller's job.

## Completion, help and persistence

The only successful full completion batch is:

1. `EFFECT-MG02-notebook`: `record-fact` for `FACT-MG02-completion`.
2. `EFFECT-MG02-complete`: `complete-minigame` for `spec001:MG02`.

Bind both effects `once` with the same `{ kind: 'minigame', id: 'spec001:MG02' }`
receipt. The registered `completionAchievementId` resolves into the existing
`world.achievementIds`. No objective/quest alias or new save field is introduced.
The actual reducer tests reject partial batches, deduplicate new action IDs
and reconstructed state, and resolve completion conditions only through the
registry. A retained fact by itself is not a completion receipt.

Practice, boundary comparisons, compatibility cards, incorrect diagnoses,
invalid input, content errors and stale actions never select this batch. The
pure adapter always returns no accepted effects, even for a correct full
diagnosis. The trusted reducer tests inject a clearly identified evaluation
only to inspect atomic receipt behavior; they do not prove the runtime
controller's authorization. The common join must select the complete batch
solely from its own accepted full-mode diagnosis.

Showing the worked practice, boundary answer, corrective full answer, method,
worked step or solution must use the existing assistance mechanism, bounded
before the help is displayed. Keep ordinary supplied inputs distinct from
worked answers. Each explicit hint uses MG02's own lesson source and hint IDs.
Full-answer feedback must not silently bypass assistance tracking. Correct
assisted completion earns the same optional benefit with no punitive ending;
neither a correct answer nor an achievement proves independent understanding.

There is no timing capability, timer or score. Both required timing defaults
are off; `timingUnlock: after-untimed-completion` constrains any future timing
capability and does not declare one. T092's timing-guard and opt-in cases are
conditional; omitting timing is valid.

Retry restores captured preparation, allocates a new attempt and advances
revision beyond any changed attempt. It keeps clues, notes and assistance while
making retained old readings stale. The bench itself does not alter equipment;
do not invent a mutation to satisfy the general retry oracle. The common retry
path still needs the T092 independently prepared changed-configuration case,
including required tools and previously earned same-session completion in its
replay baseline. Encounter Retry/E03 and Restore Save remain distinct.

Exit must be available during instructions, practice, solving, feedback and
completed feedback. It closes only the matching session at the captured R06
origin; it cannot navigate, refresh a measurement, release another session or
save. Skipping leaves the activity unopened. Main objectives, inventory, party,
route and ending remain intact. The ordinary safe-save coordinator resumes
eligibility after closure, with no implicit retry/exit save.

The later JS/PHP policy join must derive achievement, fact and three hints from
registered content. Save-v1 shape, receipt-first replay and the one-slot policy
remain unchanged. Transient answers and activity sessions are not persistent
save fields. Actual account/save/restore and encounter recovery remain pending.

## Contained presentation and acceptance boundary

Use the contained adventure overlay with readable supplied numbers, labeled
unit inputs, separately labeled reserve/overload choices, visible keyboard
focus and Escape exit. Offer practice/full controls and place boundary,
compatibility and source detail inside contextual disclosure, keeping Game/Close
and exit reachable at narrow width and 200% text. Avoid color-only evidence,
audio dependencies, animation timing and precise pointing. No new item, media
reward, artwork, asset URL, manifest change or production quota is claimed.

`evaluator-receipts.json` distinguishes actual optics observations, isolated
diagnosis results, synthetic trusted receipt checks and prepared O06 paths.
Final independent verification uses accepted commit
`9a93bf7815cda8b7055a8177bd61d5c468dc8f52` in `.local/mg02-review-9a93bf7`
plus the exact owned candidate/projection sources: 72 focused tests and strict
TypeScript pass, with 78 archived dependency hashes and eight executed owned
source hashes unchanged. The current shared SQ03 join was not interrupted;
its observed drift from the earlier baseline is retained separately. Dependency
hashes in the final seal refer to the archived commit, not later working-tree
edits. `verification.json` lists commands, scope and genuine prior failures.
All eight actual MG02 lifecycle/native scenarios remain pending: START,
PRACTICE, FINISH, RETRY, EXIT, SKIP, REPLAY and UNTIMED. The prerequisite test is
currently a real condition/reducer check, not a native start test. Final shared
schema/registry/loader/controller/UI and JS/PHP policy joins, actual captured
intent/help/exit/recovery behavior, keyboard/focus/zoom, T104/T105 integration,
human learning/technical/owner reviews, media, providers and aggregate gates
remain open. Resume this same worker for the reviewed common integration.

Original writing is CC BY 4.0; proposal/schema/tests are Apache-2.0. No external
images, game scripts or third-party media were imported.
