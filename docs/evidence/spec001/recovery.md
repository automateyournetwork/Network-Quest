# T088 — confirmed in-session recovery and separate Restore Save

Loop101 delivers the mounted recovery controller and native confirmation panel
for coordinator review. **34 focused controller/service checks, 299 checks in
the eight-suite regression, 18 native Firefox panel cases, and strict TypeScript
pass.** The unchanged independent fixture audits separately pass 217 checks with
their original 126 TODOs. These quantities overlap; they are not additive episode
acceptance counts. T089 owns the full real-application outcome/recovery/race matrix.

## Runtime boundary

[`src/ui/recovery.ts`](../../../src/ui/recovery.ts) accepts only the actual
T085 hazard receipt or T086 E03 classification receipt. An arbitrary activity
label, copied state, renderer verdict, missing preparation, successful E01/E02,
or mismatched intent cannot authorize a rewind. The controller prepares the
accepted T084 change against an opaque context and the exact current reducer
state. Its fresh UUIDs are committed only with the accepted change; creating or
cancelling a confirmation does not install anything.

The player first sees explicit consequences: encounter world and inventory
rewind, retained clues/notes/hints/outcome history, stale prior measurements,
temporary session recovery, and the separate Restore semantics. Cancel leaves
the exact reducer-state object unchanged. Confirm uses one synchronous CAS,
clearing transient selected item, focused object, verb, panel and feedback in
that same replacement. It advances the attempt/revision/dirty generation through
T084 while preserving the original account slot and pending save request.
Replayed, stale, copied, invalidated or disposed commands cannot act; losing the
final CAS installs nothing and does not run application cleanup.

Loop100 owns the ordered [`application.ts`](../../../src/app/application.ts)
mount. It composes the actual outcome/hazard singleton receipts, forwards E03
Continue and fatal Retry, mounts the recovery panel before the ending panel,
and clears obsolete gameplay controllers/action captures after the accepted
swap. Successful E01/E02 Continue still belongs to the outcome controller.
Retry/E03 never dispatch `objectiveFeedbackDismissed`; the ordinary autosave
observer rejects the terminal predecessor/changed attempt. The frame alone
owns `aria-modal` for its selected visible dialog.

## One save and Restore

Recovery's Restore port delegates to existing `SaveDialogs.continue()`. An
authenticated player receives the actual API read, SaveReader validation,
review and explicit discard/load confirmation. Loading replaces the saved
world/journal exactly; it does not merge retained attempt learning. Guests open
the actual Google/GitHub choice without a read, write or provider selection.
The service test then runs the real AccountService with controlled remote
responses: verified sign-in reaches the ordinary account-slot choice, and
alone neither loads nor saves.

The narrowly authorized addition
[`SaveDialogs.retireAdventureReview()`](../../../src/ui/save-dialogs.ts) retires
the old review, confirmation and UI epoch after Retry. It does not invalidate the
API, account or coordinator, drop an unknown write, or call `keepPlaying()`.
This avoids pausing later eligible autosaves. A still-active explicit provider
flow remains visibly pending, retaining its identity state and normal explicit
session check; retirement neither cancels nor declares its success.

Actual service tests establish:

- A real pending manual save with a non-null known slot survives both fatal
  Retry and E03 Continue by identity. No extra HTTP request is issued. Its later
  acknowledgement updates only the captured earlier generation; the retried
  adventure remains unsaved. An ordinary later manual save can persist it.
- An unknown earlier write survives recovery and its explicit retry sends the
  same bytes and idempotency key. Its receipt does not mark the new attempt saved.
- Real R11↔R10 safe walking queues an opted-in autosave. Actual failure/shutdown
  cancels it; recovery and repeated observations do not reschedule it. A later
  independent safe walk can save the retained learning to the same slot.
- A Restore GET held across Retry cannot revive an obsolete review/message or
  load confirmation after it resolves. An already displayed confirmation is
  cleared; its old confirm action is inert. The coordinator binding and ordinary
  autosave permission survive, proven by a later successful automatic save.
- Restore cancellation retains current memory. Confirmed Restore loads exact
  saved notes, inventory, history and world, clears the checkpoint, sends no
  write, and provides no retained-learning merge.

Only the transport/server account responses are controlled in these tests.
Production GameApi, SaveCoordinator, SaveReader, SaveValidator, AutosaveController,
SaveDialogs and AccountService execute normally with the actual twelve-room
registry and production content policy. The encounter fixture seeds training
prerequisites, then uses real action-bus execution, T084 checkpoint capture,
authored navigation, T086 classification and T085 warned hazard. This is not a
full playthrough, real OAuth registration, remote account or PHP service claim.

## Native confirmation checks

[`recovery-panel.browser.mjs`](../../../tests/ui/recovery-panel.browser.mjs)
loads the production panel on its own ephemeral Vite port. Pinned Playwright
Firefox build1572 / Firefox159.0 passed 18 cases with zero page errors: native
Enter/Space/Escape, one-time delivery, modified/composing Escape, stale and
retired controls, whole-panel/control reparenting, hidden/inert/detached states,
focus restoration, plain-text rendering, and Tab traversal including the
frame-owned Game button. At 390px and 200% text, both controls remain reachable
inside the scrollable frame without horizontal document overflow.

The final [report](recovery/t088/panel-final-dom.json) and
[inspected screenshot](recovery/t088/panel-200-percent.png) record that scope.
The first run also passed 18 cases, but its screenshot retained a control moved
to the harness's external test area by an earlier case. Its report/image remain
historical. Reset now removes those external test nodes; the final image shows
only the intended confirmation. No owner preview or browser installation changed.

## Verification and preserved failures

All Node commands used `.runtime/node-v26.13.1-darwin-arm64/bin` first in PATH.
The scoped compiler configuration extends the complete root strict configuration
and includes recovery.ts plus the two new test files and their imports.

| Evidence | Actual result |
| --- | --- |
| [01-controller-red.log](recovery/t088/01-controller-red.log) | Tests first: module absent |
| [02-controller-first.log](recovery/t088/02-controller-first.log) | Initial 17 checks pass |
| [03-port-red.log](recovery/t088/03-port-red.log) | Three failures: nonboolean/throwing availability |
| [04-controller-green.log](recovery/t088/04-controller-green.log) | 23 pass after exact-true/exception guard |
| [05-strict-typecheck.log](recovery/t088/05-strict-typecheck.log), [06](recovery/t088/06-strict-typecheck.log) | Test-only hostile boolean cast corrected; strict compile passes |
| [07-save-integration-first.log](recovery/t088/07-save-integration-first.log), [08](recovery/t088/08-save-integration-green.log) | Initial 6 pass/2 fail: held transport reused an already consumed Response for a later new save; reset the test transport for that distinct operation, then all 8 pass |
| [09-integrated-typecheck.log](recovery/t088/09-integrated-typecheck.log), [10](recovery/t088/10-integrated-typecheck.log) | Test summary's nominal type cast corrected; strict compile passes |
| [11-review-retirement-red.log](recovery/t088/11-review-retirement-red.log) | Required new cleanup method absent |
| [12-old-composition-red.log](recovery/t088/12-old-composition-red.log) | Actual previous composition: delayed read emits stale review message; displayed confirm-load remains after Retry. Existing load guard already prevented an actual stale load |
| [13-review-retirement-green.log](recovery/t088/13-review-retirement-green.log) | 11 recovery/service + 24 unchanged save-dialog checks pass |
| [14-panel-native.log](recovery/t088/14-panel-native.log), [16-panel-final-native.log](recovery/t088/16-panel-final-native.log) | Both native runs: 18 pass, zero page errors; final harness cleanup above |
| [17-joined-regression.log](recovery/t088/17-joined-regression.log) | Eight suites: 299 pass, including actual coordinator/autosave/outcome/hazard/checkpoint regression |
| [18-final-strict-typecheck.log](recovery/t088/18-final-strict-typecheck.log) | Final strict compile exit 0 |
| [19-independent-fixture-audits.log](recovery/t088/19-independent-fixture-audits.log) | Original audits: 217 pass, 126 unchanged TODO |

The [final seal](recovery/t088/source-seal.json) records exact worker-owned
source/tests/evidence, the ordered shared application mount, accepted dependency
sources, contracts and protected oracle hashes. Nothing modifies the independent
`outcomes.json` / `retry-transitions.json` vectors or their audit TODOs. These
checks provide scoped evidence for FR-010/013, NQ-08, AC07/12 and SAVE06; they do
not automatically close the composite 45 retry vectors. All-world-field and
revision-floor coverage remains accepted T084 evidence. The T089 real-UI
outcome/retry/restore, item/reward/fresh-proof and autosave/logout matrix remains
the next integration acceptance. Real provider/host/human/media/release evidence
and aggregate gates remain pending with their existing owners.

No tracking/task/gate files were changed by loop101. No commit, push, deployment,
new episode, provider registration, owner-preview change or source-oracle rewrite
was performed.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
