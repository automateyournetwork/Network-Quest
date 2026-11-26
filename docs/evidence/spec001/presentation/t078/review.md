# Loop 078 — independent T066 frame review

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Loop078/200 reviews the owner-requested T066 interface correction. Loop077 owns
implementation, existing tests, build and browser execution until an explicit
handoff. This review does not accept T066, T067, G3, native Safari, human learning,
media quality, or the episode. It does not change content, controllers, saves,
assets, tracking, publication, or historical evidence.

**Final scoped result:** PASS on the sealed final candidate. All five direct
native scenarios passed again after the control-ownership render change;
isolated narrow Scene/stage checks and the packet/stale-control continuation
also passed. Earlier failures remain below. This is a bounded interface review,
not acceptance of T066/T067/G3 or the episode.

## Authority and method

Read AGENTS.md, `.specify/memory/constitution.md`, root SPEC.md and PLAN.md,
feature spec/plan/tasks and gameplay contract, HANDOFF/state, and the actual
frame/application/controller source. Relevant requirements: C4/C12/C14,
NQ-01/03/04/10/11, FR-019–021, AC14/15, SAVE01/03/04/05/09/12/13, and the
2026-11-26 owner interface refinement.

The first phase is an independent source review of active work in progress.
`initial-source-observation.json` seals the exact observed sources; lines below
refer to that observation and may move as loop077 corrects them. No browser,
build, or runtime result is claimed by this phase. Findings were sent directly
to the coordinator and implementer before documentation.

## Initial findings and independent verification

On the loop077 stable candidate sealed in
`candidate-source-observation.json`, the direct native run passed F078-01,
F078-02 and F078-03. The original findings below are retained as historical
review evidence. Five of six direct scenarios passed; the narrow scenario and
subsequent independent checks are recorded separately below.

### F078-01 — save status and failure explanations disappear outside Game

**Correction verified in run1.** The actual status is readable in ordinary play
and inside Game; the specific 503 explanation is readable/non-inert inside the
owned recovery dialog, while the previous slot is unchanged. See
`run1/save-specific-failure.png` and the driver assertions.

Source-confirmed layout/ownership conflict; initial implementation needs a
correction and native verification.

`src/ui/adventure-frame.ts:38,84–103,112–118` places the save controller under the
Game window, hides that window during ordinary play, and inerts siblings of an
active owned save dialog. `src/ui/save-dialogs.ts:216–219,239–244` puts the live
status and specific explanation outside that owned dialog. CSS
`src/app/application.css:100–103` additionally hides the inactive Game ancestor
while restoring visibility only for its active owned dialog.

Reproduction to execute: make a confirmed first save, close Game, change notes
or complete an opted-in safe autosave boundary, and inspect the live
Unsaved/Saving/Saved status. It must remain visible and accessible in the frame.
Then cause a 503 or interrupted write. The controller's specific explanation
must remain visible/accessibly associated with the recovery decision, rather
than only showing a generic retry choice. The relevant failure text originates
at `save-dialogs.ts:13–17,76–84`.

Expected: a compact honest save status in ordinary play and all specific
controller feedback in the active save decision, without duplicate save
authority or an extra slot. SPEC.md303 and SAVE09 apply.

### F078-02 — owned gameplay panels exclude shared action feedback

**Correction verified in run1.** Inventory selection feedback is inside the
owned active modal and non-inert. Typed shortcut letters remain in the notes
field; Escape returns to the Notebook opener. No save writes occurred.

Source-confirmed layout/ownership conflict; initial implementation needs a
correction and native verification.

`src/ui/adventure-frame.ts:99–104` moves shared `.nq-shell-status` into only
manual Scene/Evidence windows. Inventory, Notebook, Dialogue and Packet leave
it in the stage, which the modal branch logic at112–118 makes inert. The shell
announces all controller results through this status at
`src/ui/app-shell.ts:135–137,151–152`.

Reproduction to execute: open Inventory and select/deselect the inspection kit.
The result explanation from `src/ui/inventory.ts:43–44` must be readable and
available to assistive technology while the panel remains open. Also pin/unpin
a notebook objective or highlight its source room and inspect the shared
feedback inside the active Notebook. A changed button label alone is not the
complete action explanation. C14 and the complete semantic-interface contract
apply.

### F078-03 — successful lifecycle installation retains the Game modal

**Correction verified in run1.** Canceled New preserved edited notes; three
successive confirmed New operations and a confirmed Restore each entered the
room with no active modal, usable toolbar and focused room heading. Restored
notes match the confirmed slot. One intended first save remained revision1;
the New/Restore operations issued no additional save writes.

Source-confirmed control flow; native reproduction still required.

In an existing adventure, Game → New Adventure → Start new adventure leaves
`manual === 'game'`: `adventure-frame.ts:85` clears it only for owned dialogs
outside Game; `attach()` at136–170 replaces shell windows without clearing
manual. On successful application reset at
`src/app/application.ts:149–155`, sync therefore restores Game as the active
modal and inerts the new room; the subsequent h1 focus at295 cannot reach the
inert room. Restore Save entered through Game uses the same installation path
at139–146. Initial title startup has no manual Game selection, so that path
does not demonstrate this condition.

Expected: successful New/Restore enters the new/confirmed adventure with usable
room focus; cancellation preserves the current adventure and the review/menu.
Existing helper navigation may conceal the extra Game window by closing it
before the next control, and a clipped h1 passing `toBeVisible` does not prove
the room is interactive or focused.

## Additional review targets

- Scene → owned Dialogue/Notebook → close: owner controller focus restoration
  may target an action now inside hidden Scene because manual was cleared.
  Verify actual focus and a usable continuation before classifying a failure.
- Repeated New/Restore/logout: per-attach window buttons and shell click
  listeners use the frame-lifetime AbortSignal. Inspect cleanup/retention and
  stale references; source alone does not establish a native GC leak.
- The frame initially tags already-inert siblings as its own and later sets
  them to `inert=false`. This can override `application.ts:292`'s busy-account
  saveHost state. The save callback separately rejects while busy, title buttons
  are disabled, and Settings close explicitly forgets the operation; no
  persistence bypass is established. Preserving the pre-frame inert boolean is
  the appropriate ownership cleanup, not evidence of a server/save failure.
- Verify Tab/Shift+Tab boundaries, Escape ownership, composing/typing-safe
  shortcuts, captured pointer actions across redraws, text/WebGL recovery,
  scrollable 200% panels, save/replacement/cancel, canceled and confirmed logout,
  explicit autosave off, and absence of unsolicited writes.

## Scope limits

Vitest uses the Node environment and the existing UI unit suites test
controllers, not a DOM harness. No implementation-mirroring unit test or new
DOM dependency was introduced. Independent actual-browser results are recorded
below; the narrow correction awaits an affected rerun. Existing real-provider, Safari,
assistive-technology, human review, media and release limitations remain open.

An isolated six-scenario browser reproducer was prepared under `.local/t078`.
It uses the existing strict-TLS/private synthetic-account fixture and direct
visible UI steps. It intentionally does not use the adaptive navigation helper
that closes an unexpected frame window. The separate execution records establish
the results. Controller inspection found no new save authority, storage
slot, implicit save or account identity mutation introduced by the frame itself.

## Actual narrow-view failure F078-04

**Observed failure on the earlier candidate; correction verified in run6.** After opening
Power indication, choosing Text scene, and scrolling to the last Scene action
at390×844 with in-app200%text, the sticky window heading occludes the shared
feedback. The heading and status intersect by325.6×152.6 CSS pixels: heading
bottom184.8, status top32.2/height295.4. The actual screenshot also shows the
feedback floating over underlying scene prose. The document has no overflow,
but that does not establish readable panel content.

The independent process's full default axe scan completed and returned a
**serious `scrollable-region-focusable` violation** on `.nq-shell-status`.
The CSS makes the paragraph internally scrollable without keyboard focus.
Relevant candidate rules are `src/app/application.css:154,160` (sticky status
top0/max-height35vh versus the sticky header top−1em/z-index9). See
[`run3/narrow-with-feedback.png`](run3/narrow-with-feedback.png),
[`run3/narrow-layout.json`](run3/narrow-layout.json) and
[`run3/axe.json`](run3/axe.json). No axe rules were disabled or filtered.

Reported immediately to root/077; runtime token returned for correction.
Normal panel feedback flow, or a properly separated/readable keyboard-accessible
status region, is required before the affected review can pass. The run3
assertion correctly failed, so the later text-to-visual recovery steps in that
driver remain unexecuted.

The final candidate changes owned-panel feedback to normal document flow and
gives nonempty stage feedback, audio captions and save status keyboard access.
Run6 measured zero header/status intersection at the last Scene action and
zero document overflow at390×844/in-app200%text. The first feedback text and
last scene action screenshots show the corrected separation. The complete
default axe checks passed for Scene (36 rules) and ordinary stage (33 rules),
both with zero violations. See [`run6/narrow-feedback-start.png`](run6/narrow-feedback-start.png),
[`run6/narrow-last-action.png`](run6/narrow-last-action.png),
[`run6/scene-axe.json`](run6/scene-axe.json) and
[`run6/stage-axe.json`](run6/stage-axe.json).

Scene reported no incomplete rules. Stage reported `color-contrast` incomplete
for five targets: location, save indicator, text-scene fallback, audio caption,
and shared status. Those results require manual contrast review; zero automated
violations does not certify their contrast.

Ordinary Tab reached both the long269-character Power feedback and actual
97-character Narrator caption; ArrowDown changed their scroll offsets. The
stage remains compact at200%text, so these regions scroll rather than showing
every line at once. The in-frame Scene control supplies the expanded reading
view. This check does not claim native browser zoom, a real phone, screen-reader
speech output, or human reading comfort.

## Execution and visual review

- Run1: five direct scenarios PASS in22.6s; the sixth Firefox page crashed
  inside the full default axe invocation. Original trace retained locally.
- Run2: only the affected narrow scenario repeated, adding a pre-axe screenshot
  without changing assertions; Firefox crashed at the same axe invocation.
- Run3: an independent process followed the existing T066 isolation boundary,
  retaining the real app, strict TLS and every default axe rule. It exposed the
  actual F078-04 violation above. A process differential is observed; no engine
  root cause or blanket accessibility pass is claimed.
- Run4: after the new preparePanels hook touched shared control reconciliation,
  all five direct scenarios passed again in19.0s on the final candidate.
- Run5: Scene layout and the default axe audit passed; a synchronous assertion
  checked scrollTop immediately after ArrowDown and failed before native scroll
  motion settled. The exact failure and driver remain preserved.
- Run6: the same runtime passed after the driver used keyboard Home and a bounded
  one-second native-scroll settling condition. The diagnostic records immediate
  scrollTop0 with actual focus, followed by scrollTop4.2167 for status and3.5 for
  caption. No implementation change was made between run5 and run6.

Run1 additionally passed exact Scene→Dialogue→Escape opener restoration,
12 Tab/Shift+Tab focus containment steps, focused Close-dialogue preservation
through a rejected verb/status redraw, canceled logout preserving notes/session,
and confirmed logout clearing memory/title while the single server slot remains
unchanged. Provider accounts are private synthetic fixtures; real OAuth is not
tested. All browser processes and disposable fixtures were cleaned up before
the token returned.

Inspected the five run1 screenshots and run2/run3 narrow screenshots. The default
1280×720 room is one contained frame with in-frame controls. Inventory feedback,
save recovery explanation, exact focused Photon opener, restored room, and guest
title are visible. The narrow feedback occlusion is a visual FAIL independently
of the axe result. This is an agent visual review, not owner/human acceptance.

Also inspected final run4 save/inventory/restored-room screenshots and run6
Scene start/end, ordinary stage, recovered visual room and packet comparison
screenshots. The final Scene header no longer overlaps feedback. At the narrow
200% setting the room surface is small and captions/status scroll; controls and
expanded reading remain available. Further visual preference is the owner's
review, not an inferred acceptance from these automated results.

Run6 completed the previously interrupted text-mode investigation and restored
the actual visual scene without an API mutation. The new packet check passed
payload/encode/transmit/decode/compare, with exactly one Return control and
retained focus after a rejected verb in every phase. Replay and reopen retained
one current Return. Escape restored the exact capsule opener, the prior close
node was disconnected, and deliberately clicking that detached old node did
not close or advance the reopened journey. The current Return still closed it.
These details are in [`run6/packet-controls.json`](run6/packet-controls.json).

`executed-review-summary.json` separates pass/failure history. Source drivers,
safe screenshots, observations and exact logs are preserved in run1/run2/run3.
Trace ZIPs stay under `.local/t078` because they can contain ephemeral synthetic
session/auth headers; their hashes and retention bounds are recorded. No
production credentials or private player data were used or copied.

The final source/harness observations and post-review verification are in
`final-candidate-source-observation.json`, `run6-source-observation.json` and
`post-review-runtime-seal-check.json`. Every reviewed runtime source was
unchanged during final review. The final Firefox was159.0, axe4.14.1, with
strict fixture TLS and reduced motion. No build/deploy or real-provider test
was performed by loop078. The complete independent SAVE matrix, native Safari,
assistive technology, owner review and aggregate gates remain outside this
scoped result. All078 browser/fixture processes were stopped and the serialized
runtime token returned before final evidence work.

The078 native paths used1280×720 default and390×844 with in-app200%text. Other
viewport results belong to077/073, not this review. Pointer capture and renderer
recovery ownership were reviewed in source;078 did not repeat the full stale
pointer/WebGL-loss suite. It verified ordinary manual-save persistence and no
unsolicited writes in its paths, not the whole opt-in autosave/deletion/concurrent
SAVE matrix. No production account, publishing, media generation or performance
measurement was performed.
