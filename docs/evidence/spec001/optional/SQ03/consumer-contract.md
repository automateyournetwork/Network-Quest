# SQ03 Weather Diary: T100 consumer contract

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T098 authors an optional comparison of actual radio observations at the R08
diary shelf. `SQ03.current-schema.json` passes a cloned join through the actual
registry; `SQ03.candidate.json` adds the closed proposed `radio-weather-diary`
payload. Its structural schema and proposed adapter are local to this directory,
outside global test discovery. Root reviewed the revised candidate and approved
`content/spec001/quests/SQ03.json` as a byte-equal current-schema projection.
It remains unregistered and unloaded; T100 owns all
shared schema, registry, loader, reducer, action-bus, application, generated
policy and UI edits. This increment does not complete T098.

## Evidence and source boundary

Reuse actual PROFILE-RADIO, PHY07, STATE01, the existing S08/S09 source claims,
`evaluateRadio`, and R07/R08's reviewed resolver. The immutable T092 oracle
remains byte-identical. No weather model, invented observation, timer, propagation
formula, regulatory recommendation or throughput guarantee is added.

The full diary selects two **existing actual** R08/O08 notebook measurement IDs.
The selection must preserve each original room, subject IDs, attempt, revision,
readings, units and conclusion. Both records contain the actual viable-path and
compatible-settings observations. Allowed comparison samples include every
existing reviewed O08 resolver observation: T08 (25 dB), T09 (13 dB),
B-RADIO-20 (20 dB) and B-RADIO-BELOW (19.99 dB). All chronological pairs can be
compared, including rising or unchanged SNR; the player does not have to guess
an author's preferred direction. The independent fixture examples are
verification cases, not an exhaustive restriction on valid actual observations.

The original earlier revision must be lower than the later one, and its original
notebook position must precede the later record. This is recorded sequence, not
an invented wall-clock timestamp or elapsed interval. Earlier readings may be
retained across attempts as history. They never count as current proof. The
selected later record must be the latest nonstale O08 measurement, have the
actual current attempt/revision, and agree with the current real radio resolver.
A fresh flag alone cannot prove those facts. Missing, stale, reversed or repeated
evidence remains unavailable rather than an incorrect answer.

`radio-diary-proposal.ts` reuses `isHistoricalObjectiveMeasurement` to check
canonical history with its actual accepted conclusion. It also checks the
accepted O08 source/scenario bounds and uses the existing radio evaluator at
the record's **original** version to obtain the original scoped observation.
This does not produce or install a measurement and does not refresh the record.
It compares only the existing evaluator's SNR, threshold, path and settings
outcomes. No `sourceCaseId` is invented on an earned measurement: its actual
room, objective subjects and conclusion remain the original provenance. Source
case IDs in the authored delivery describe the reviewed input coverage only.
Original provenance or derived-value corruption is a content error with no penalty.

| Independent case | Actual bounded observation | Diary result |
| --- | --- | --- |
| OPT-SQ03-COMPARE | T08 then T09: 25 dB then 13 dB | SNR decreased by 12 dB; current physical link fails; a correct diagnosis can complete the diary |
| OPT-SQ03-BOUNDARY | B-RADIO-20: exactly 20 dB | Meets the inclusive fictional minimum; proves no throughput |
| OPT-SQ03-STALE-PREDICTION | Mitigation selected with no subsequent reading | Request an actual current reading; no diary completion |
| Existing B-RADIO-BELOW regression | Actual20 dB then19.99 dB | SNR decreased by0.01 dB; current threshold fails even if a display would round it |

Display-only delta subtraction uses integer hundredths because the actual
accepted O08 inputs have at most two decimal places. It neither rounds nor
replaces the radio evaluator's SNR/threshold decision, and introduces no new
physical criterion. The comparison choices use that actual bounded result.

The tested records are earned through actual radio actions, O07 measurement/
submission and O08 measurement reducer operations in a prepared local test
session. Initial guest discovery and a room-arrival transition are test
scaffolding, not a full player/browser journey. O08 need not be completed; the
25→13 case deliberately leaves O08 incomplete and the latest physical result
incorrect. An optional diary reward never repairs that result.

## Compact answer and missing-evidence view

Keep quantities, units, source room, record order, attempt/revision and freshness
read-only and visible beside the comparison. Do not ask the player to retype
the numeric readings. Use two labeled actual-record selections and these three
closed choices:

```ts
interface RadioDiaryAnswer {
  earlierMeasurementId: string;
  laterMeasurementId: string;
  comparison: 'increased' | 'unchanged' | 'decreased';
  currentAssessment: 'meets-threshold' | 'below-threshold';
  evidenceClaim: 'current-reading-only-no-cause' | 'earlier-proves-current'
    | 'weather-proven' | 'throughput-proven';
}
```

The caller supplies no measurements, versions, profile, source case, mode,
verdict, effect, reward or return destination. T100's closed radio-diary submit
intent must use the existing original action/adventure/account/session capture.
The adapter preserves `stale-action` instead of recapturing a callback against
the new world. Only the matching live delivery mode can select any reward.

Starting at `HOTSPOT-radio-vane` / `R08.entry` has no objective, recruitment,
active-party, inventory or other-activity prerequisite. With no eligible pair,
show `feedback.missingEvidence`, keep the instructions/practice/exit available,
and leave full delivery unavailable. Do not fabricate a pair or borrow the
worked card as an earned observation. A player closes the diary, uses ordinary
Skywell/Observatory controls to prepare and measure the actual path, then
reopens it. This preserves the common framework's active-activity exclusion.

The existing R08 shelf description still says “later optional activity.” T100's
common authoring join must replace that reservation with the actual loaded
availability text; T098 leaves R08 unchanged for the current evidence baseline.

## Practice, help, completion and recovery

`practice` is a worked B-RADIO-20 card using the real evaluator and the literal
reviewed source values. Opening it records SQ03 worked assistance. It is read
only, supplies no notebook measurement and requires no numeric quiz; its
explanation, retry and exit remain available. Its shared mode must never run the
full diary reward path. Showing hints or corrective/solution feedback records
honest lesson-source assistance separately from completion. Assistance never
reduces the valid reward or changes an ending.

Only a correct, current, complete delivery selects these two canonical effects:
`EFFECT-SQ03-comparison` records `FACT-SQ03-comparison`, and
`EFFECT-SQ03-complete` completes SQ03. Bind the whole atomic batch once to the
same `{kind: quest, id: spec001:SQ03}` receipt. The alternative has no effects.
Practice, missing/invalid input, wrong conclusions, content errors, stale
callbacks and already-completed replay select no completion effects. The raw
proposal result returns no effects, even when correct. The generic content
action path must not bypass the matching live session.

Presentation unlocks optional depth only with **both** completed SQ03 and its
comparison fact. Actual reducer tests cover partial-batch rejection, once-only
replay, unchanged required inventory/main progress/party/flags, and encounter
Retry that retains the comparison fact but rewinds the quest completion. That
retained fact alone does not unlock or reaward the optional depth.

Common Retry restores captured preparation, starts a fresh attempt, advances
revision and keeps clues, notes and help while marking all retained readings
stale. The next current comparison requires leaving and remeasuring. Once the
common session accepts a full completion, its same-session replay baseline
retains that earned completion, as in SQ01/SQ02. Genuine encounter Retry/E03
Continue retains its separate whole-world rewind contract.

Exit closes only the matching session at the captured safe R08 origin. Every
unfinished phase and completed feedback has an exit. Skip starts no session.
Neither consumes a required item, changes main progress/party, navigates,
refreshes a reading or writes a save. Restore/new adventure/account change
invalidates old sessions and callbacks. Keep save-v1 shape and the single-slot
receipt-first policy; persist only existing quest/fact/help fields.

## Radio depth and existing media allocation

The optional reward is the authored four-paragraph radio explanation. It makes
the power-level/ratio distinction, inclusive fictional threshold, independent
path/settings prerequisites, limited inference and historical freshness readable.
It does not claim that the reward itself is evidence of independent learning.

The existing `ASSET-ILLUSTRATION-16` allocation is “Weather diary comparison,”
R08 journal use: the same antenna view under two pictured conditions, with an
empty caption band for observed evidence. Its learning intent explicitly covers
SQ03/MG03 and forbids an uncited weather scoring rule. The candidate preserves
that identity and purpose. It supplies descriptive/unavailable text with no
invented URL. Manifest status remains planned, with no exports or quota credit.
Root owns the manifest; T106/full media production, actual generation provenance,
placement, visual review and final exact-value semantic labels remain pending.

## Remaining join and verification

T100 must promote the reviewed full payload and integrate its semantic source/entry/reward
constraints, actual selection eligibility, closed submit intent, common
controller, contained view, optional depth presentation and generated JS/PHP
lesson policy. Its UI should filter eligible actual observations while keeping
other observations readable with honest reasons. Reuse the adapter's checked
record logic when promoting it instead of trusting arbitrary form data.

T104 must execute START/PRACTICE/FINISH/RETRY/EXIT/SKIP/REPLAY/UNTIMED and the
three learning cases through actual shared interfaces. Keyboard/focus/Escape,
contained narrow/200% presentation, provider/save/account/restore behavior,
full-route independence and human learning remain unverified here. Same-worker
T098 final join follows common integration; source preparation alone is not
task, media or episode acceptance.
