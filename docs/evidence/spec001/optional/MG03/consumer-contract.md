# MG03 Channel Scout candidate and later common join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T103 authors optional radio practice after O08 in R08. The current-schema
projection validates through the actual registry in an isolated cloned document
join. The full candidate adds the proposed `radio-channel-scout` payload and
passes only its local structural schema: the production schema/controller do
**not** support this minigame variant yet. Coordinator approval covers the design
and corrected unloaded canonical projection, not gameplay acceptance. The corrected `content/spec001/minigames/MG03.json` is byte-equal to the current-schema
projection, unregistered and unloaded. No shared schema, registry, controller,
loader, save policy, UI or manifest is changed here.

## Binding and model

| Contract | Binding |
| --- | --- |
| Entry | R08 / R08.entry / HOTSPOT-radio-channels |
| Speaker | Existing CH10 Microwave Phoenix |
| Prerequisite | Completed O08; no reverse optional prerequisite for O08 |
| Rules/profile | Existing PHY07 / STATE01 / PROFILE-RADIO |
| Benefit | `optional-radio-practice` only |
| Full action | ACTION-MG03-compare |
| Completion | ACHIEVEMENT-MG03-complete in existing `achievementIds` |
| Fact | FACT-MG03-completion |
| Main reward, score, timing | None; timing off and no timed capability offered |

The S08/S09 source claims are copied exactly from the reviewed radio profile.
Use `evaluateRadio`, the real R07/R08 scenario resolver, canonical O08 measurement
operations, `isHistoricalObjectiveMeasurement` and `isMeasurementCurrent`. There
is no new SNR or propagation formula. Fixed signal/noise states have already
been reviewed; a channel label never implies a universal ranking, channel
legality, weather cause, throughput, routing or end-to-end health. A known viable
path and compatible settings remain separate prerequisites.

This is an actual bounded adventure exercise, not a separate hypothetical
world. Player instructions explicitly say that channel/emitter controls change
this adventure's radio configuration. They use only the exact existing A/B and
emitter restoration/raise actions. The existing ordinary near-boundary action
is exercised by an isolated regression; it is not a new MG03 control. The
underlying path and radio settings are left to ordinary preparation.

Start requires actual O08 completion. With no suitable baseline, explain the
missing evidence and retain instructions, worked practice and exit. Never invent
an observation, borrow the worked card or mark a reading fresh. A player can
exit, prepare/measure through normal room controls, and return.

## Closed intent and transaction plan

`closed-intents.schema.json` defines the four proposed payloads. Each has an
exact UUID `sessionId`, closed keys and scalar enums:

- `scout-select`: `choice` is channel-A, channel-B, mitigate-emitter or raise-noise.
- `scout-predict`: actual `baselineMeasurementId`, and `assessment` is
  meets-threshold or below-threshold.
- `scout-measure`: no caller-supplied reading or measurement ID.
- `scout-compare`: actual `laterMeasurementId`; increased/unchanged/decreased;
  meets-threshold/below-threshold; supported/not-supported prediction assessment;
  and the limited-inference choice.

Existing start/mode/help/explanation/retry/exit commands remain captured by the
common action bus. The active session supplies definition, mode, room, profile,
return position, adventure ID, account generation and original action/version
capture. UI callbacks supply no verdict, effect, scenario, measurements, profile,
source case, return destination or current context. Do not recapture a stale
callback against a later world.

Trusted `scoutSelections` maps each selection enum to one existing radio action.
The later controller must compose that existing action and the actual objective
measurement operation **inside the optional reducer transaction**. It must never
temporarily switch out of `active-optional` to bypass guards or expose generic
raw room actions while a minigame is active. The same action-bus CAS must check
session/adventure/account/version, select the closed operation, apply its actual
configuration or measurement result and update transient exercise state.

The three steps are distinct:

1. Select/prepare the current configuration. Any actual configuration or attempt
   change invalidates a previous prediction, even if values later return to the
   same settings. Selecting a channel creates no measurement.
2. Record a prediction. The controller captures the baseline's original record,
   current adventure/attempt/revision, exact scenario signature, and the IDs of
   all notebook measurements already present. The capture is copied, transient
   and controller-owned. The pure prediction adapter returns no radio readout,
   measurement, effects or truth verdict about the prediction.
3. Explicitly Measure allocates its ID internally and uses the existing O08
   measurement path. Only then can Compare use the new actual record. It must
   not already be in the prediction's ID set, and must occur later in notebook
   sequence at the captured attempt/revision. No wall-clock timestamp or elapsed
   duration is claimed.

The earlier record must have an older configuration revision; this proves
ordering, **not that a physical intervention occurred**. Travel can also advance
revision. A valid older-attempt record is history, never current validation.
Unchanged SNR is a valid comparison. The later record must be canonical, latest,
not explicitly stale, match the current attempt/revision and agree with the
actual resolver. A stale flag alone is insufficient. Unsupported or corrupted
provenance is a content error; missing evidence or expired prediction is invalid
input, not a wrong learner answer. Original source room, objective subjects,
readings, units, version and conclusion remain intact. Source-case labels are
not invented as provenance on earned measurements.

The adapter uses the evaluator's SNR and threshold result. Its only additional
arithmetic is a display delta over integer hundredths for the already bounded
source values; this does not change threshold comparison or round 19.99 to 20.

## Completion, help and recovery

Correctly compare both actual observations, assess the current threshold, state
whether the prediction was supported, and choose the limited-inference claim.
An initially wrong prediction may still complete after an honest correct
comparison. It is not retroactively called correct. A current failed link stays
failed, even when diagnosing it correctly completes optional practice. An earned
O08 objective remains historical progress, not proof that a changed link passes.

The pure proposal always returns zero effects. Only a matching live full-delivery
session with an accepted correct comparison can select the entire two-effect
batch: EFFECT-MG03-notebook records FACT-MG03-completion, and
EFFECT-MG03-complete performs `complete-minigame` for MG03. Bind both once to the
same `{ kind: minigame, id: spec001:MG03 }` receipt. The reducer resolves the
explicit unique achievement into existing `achievementIds`; no quest/objective
alias or save-v1 field is added. Partial batches and repeat actions cannot
award again. Trusted reducer probes in this directory prove this boundary,
not production controller authorization.

The B-RADIO-20 practice is a read-only worked source card, never an earned
observation. Opening it records worked assistance. Common help and corrective
feedback use MG03's method/worked-step/solution lesson source. Record assistance
when those explanations are shown; a wrong prediction alone is not help use.
Keep prediction history explicit in the transient result. Completion is optional
practice, never independent mastery, and assistance carries no reward penalty.

**Retry after successful completion still restores the original entry radio
configuration and inventory.** The common SQ01/SQ02 finalizer currently adopts
the entire completed world as its replay preparation; that behavior is not a
valid MG03 join because this minigame can change physical configuration.
`scoutReplayPreparation` proposes a narrowly bounded post-acceptance merge: copy
the original preparation and add only the exact earned MG03 achievement when
its own achievement and completion fact exist. Do not copy changed flags,
inventory, route, unrelated achievements or other current progress into entry
preparation. Call this only after the reducer accepts the full completion batch.
The function is not an award operation or replacement for trusted receipts.

Then use the existing shared rewind primitive to restore this preparation,
allocate a fresh attempt and increase revision beyond all retained readings.
Keep learned facts, personal notes and assistance; all retained measurements
become stale. Clear the transient prediction and latest comparison. A fact alone
must not preserve or recreate a completion. The separate encounter Retry/E03
Continue still rewinds its whole captured checkpoint and can undo an optional
completion while retaining its learning fact. Restore Save remains distinct.

Exit always closes the matching captured session, including missing evidence or
content-error phases. It keeps the actual current configuration and observations,
without teleporting, refreshing, restoring preparation or saving. A failed link
remains failed. Required inspection tools stay recoverable through normal
preparation. Skip starts no session. New adventure/account change/restore must
invalidate the old session and prediction. Save eligibility resumes through the
existing coordinator; transient exercise state is not persisted. Provider/save
round trips and generated JS/PHP policy support remain a later shared join.

## Presentation and media

Use the contained adventure overlay with clear instructions, named scalar
controls, read-only actual readings and units, original provenance/freshness,
visible prediction, explicit Measure, comparison and exit. Preserve keyboard,
focus, Escape, 200% text and narrow layout. No color, audio, animation, precise
pointing or countdown is needed. Keep source/model depth in contextual details.
Do not hide the distinction between a worked card and actual observations.

There is no new item, decoration or image reward. Existing illustration16's
Weather diary comparison allocation already names SQ03/MG03. It supplies no
uncited weather rule and remains planned media; no URL, asset export, native
source, visual review or quota acceptance is claimed or changed. Original
writing is CC BY 4.0; tests/schema/proposal code are Apache-2.0.

## Evidence and limits

The isolated harness prepares guest discovery, O01/O02, an inspection kit and
R07 arrival. Real radio actions and objective measure/submit operations earn O07
and O08, followed by actual R08 observations. A scoped room-arrival operation is
not a full browser journey. It demonstrates main radio proof before any MG03
completion. Exact immutable optional cases and physical freshness fields supply
expectations; no physics, source case or expected result is rewritten to fit code.

A concurrent SQ03 shared join changed R08/world/schema while the later targeted
run began. The original failed log is retained. Final independent verification
uses accepted commit `9a93bf7815cda8b7055a8177bd61d5c468dc8f52`, archived at the
recorded `.local/mg03-review-9a93bf7` path, with only owned MG03 artifacts overlaid
and existing locked dependency directories symlinked. No private input, browser
or test server is used. The source seal distinguishes frozen executed dependencies
from the concurrently changing working tree. The first 67-check pass and initial
receipts are also retained. The later enum tests were blocked at registry setup
on the changing tree, not observed failing enum assertions; the strict scalar
correction came from source inspection and is verified by the final suite.

Actual MG03 START/PRACTICE/FINISH/RETRY/EXIT/SKIP/REPLAY/UNTIMED acceptance remains
pending the common minigame join. Prepared-session tests of the existing exit
and rewind primitives do not constitute that lifecycle acceptance. T104 must
exercise real dispatch, once-only completion, corrected replay preparation,
assistance, stale detached callbacks, required-tool recovery, account/save/restore,
keyboard/focus/zoom and all exits. Full main-route regression, human technical and
learning review, media, owner acceptance and aggregate gates remain open. Resume
this same worker for its later join; authoring alone does not complete T103.
