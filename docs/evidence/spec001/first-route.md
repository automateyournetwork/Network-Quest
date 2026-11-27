# First complete route — W05 checkpoint

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Status: **local W05 complete-route checkpoint PASS; coordinator acceptance pending**. Loop090/T078
began on 2026-11-26. Independent preparation preceded the coordinator's explicit
integration GO after acceptance of T074–T077. No episode or aggregate gate is
accepted here. The final scoped source and artifact hashes are in
[`first-route/source-seal.json`](first-route/source-seal.json).

The route under test is R01 → R02 → R03 → R04 → R03 → R02 → R09 → R02 → R10
→ R11 → R12. It completes O01/O02, the copper O03/O04 pair, shared O09/O10,
reviewed intervention O11 and separately measured validation O12. It requires no
fiber/radio objective, future realm, optional reward or recruit.

## Independent behavioral expectations

The executable browser check is
[`tests/e2e/first-repair-route.spec.ts`](../../../tests/e2e/first-repair-route.spec.ts).
Both cases start the real browser application using New Adventure. Browser code
does not import an evaluator, inject a state, award a completion, or replace an
application module. The isolated PHP fixture supplies a synthetic identity only
for the saved-route variant; no provider flow or production credential is used.

| Source | Required observation |
| --- | --- |
| SPEC O01/O02, AC01 | Actual introductory observations, kit inspection, briefing and pinned hypothesis precede the route. Declining sign-in permits session play. |
| SPEC T01/T02, O03 | Original 105 m path reports an open required conductor. The 95 m compatible replacement passes after an actual new measurement. |
| SPEC T16, inclusive copper profile | The exactly 100 m passive alternative also completes the route. |
| SPEC T13 | Changing the selected path retains the older reading as stale and prevents its submission as current evidence. |
| SPEC O04, C10 | A powered repeater does not bridge the unchanged break; retained before evidence and a fresh after reading support the corrected conclusion. |
| SPEC T10, O09 | The original 33 W allocation exceeds the fictional delivered 30 W budget by 3 W; compatible 23 W and 30 W kits remain valid alternatives. |
| SPEC T11/T12, O10 | The shared 100/full mode and explicit toy sequence decode to 00101101, eight represented bits in four symbols; no address discovery is inferred. |
| SPEC C9 hint contract | Method, worked-step and solution hints are recorded separately and do not prevent the valid copper result. |
| SPEC O11/O12 | Executing a reviewed plan opens R12. Arrival alone leaves O12 incomplete; new link and independent endpoint observations are required before classification. |
| SPEC one-save contract | Explicit local Save followed by reload/Continue preserves the actual route, notes, assistance and stale history without another write. Guest play writes no slot. |

## Composition and observable behavior

The application loads eight actually authored rooms, their accepted dialogue,
objectives, profiles and interactions through a validated content projection.
Canonical `world.json`, schemas, teaching source oracles and the other four room
reservations are unchanged. R01 retains its accepted real media. R02 and the six
new route rooms use explicit temporary layouts through the common renderer.

Diagnostics and repair controls open inside the existing adventure frame. The
accepted controllers remain the only authority for measurements, review,
execution and classification. Plan and installation duration are explicit
choices; no passing default is supplied. The notebook uses validated display
metadata to present plain explanations, units and current/stale provenance.
It does not expose internal conclusion codes or attempt identifiers as the
explanation. Clockworks sample inspection exposes the actual declared toy map
through Evidence; it makes no address-discovery claim.

Both browser cases actually complete O01/O02/O03/O04/O09/O10/O11/O12. They retain
the original 105 m/open reading, reject the false repeater conclusion and 33 W
allocation, inspect the toy samples, use untimed explicit decoding and replay,
and choose either the 95 m/23 W or 100 m/30 W valid path. All three copper hint
levels remain compatible with completion. A changed path makes the older
reading stale and disables its submission. R12 arrival and link-only evidence
both leave O12 incomplete; the separately obtained endpoint acknowledgement
is required before permanent classification succeeds.

The keyboard variant also attempts a fiber review without the required branch
completion. The real prerequisite guard creates no measurement. It then chooses
the explicit copper alternate and continues normally. This confirms why the
save policy retains exact reachable copper/shutdown review formats rather than
granting future branch permissions.

The guest dismisses the actual sign-in invitation and never writes a slot. The
authenticated variant uses only the harness's local synthetic identity. It
performs one real manual PHP save, reloads and selects Continue. The restored
snapshot contains the eight completed objectives, personal notes, level-three
assistance and stale history; O05–O08 remain incomplete. Continue does not write
again or alter the stored payload. Both immediate executed shutdown and final
shutdown classification remain unsafe to save.

## Verification and failure history

- Strict Playwright discovery assigns this file to `firefox-local-https`.
- `--list` discovers both intended cases.
- Initial preparation run exposed a test binding issue: the guest-session
  explanation belongs to the contained Game window. The test now opens that
  window before asserting the visible explanation; it does not move controls
  outside the accepted frame.
- The next actual guest run reached O02, dismissed the invitation and opened the
  scene list, then timed out waiting to activate `Walk to The Copper Warrens`.
  Trace inspection confirms that unavailable transition is the first integration
  gap: the current loader still supplies only R01/R02. This is an expected RED,
  not route completion. The original run exhausted its 180-second case bound;
  subsequent control operations now have a 10-second bound for clearer failures.
- The first integrated browser run exposed Close controls reparented by the
  frame: each panel guarded the original body instead of its own dialog. The
  coordinator fixed both owners without removing scope/lifetime checks. Its
  isolated DOM results are [recorded separately](panel-frame-join/review.md).
- A route test initially guessed the Clockworks exit label. It now binds the
  authored `Walk toward The Backhoe Rift` and `Walk to the validation balcony`.
  No authored text was changed to satisfy the test.
- The authenticated factory initially returned 503 because its strict scope
  guard still expected the introduction-only policy. The coordinator approved
  changing that exact expected scope to `authored-first-copper-route`, matching
  the generated artifact; no fallback or permissive list was added. The real
  ApplicationTest and actual browser save/read flow subsequently pass.
- The first complete pair passed in 30.3 seconds. Extended frame checks then
  found a real nested-window focus fault: Diagnostics → Game → Escape → Escape
  returned focus to Walk. The coordinator preserved the parent's original
  opener when resuming it from Game. Both diagnostics and final-validation
  windows now pass this actual sequence and enforce exactly one active modal.
  The [RED screenshot](first-route/focus-red/diagnostics-game-escape.png) and
  [failure context](first-route/focus-red/error-context.md) remain available.
- Both full-page and active-dialog-only AxeBuilder scans crashed the Firefox
  renderer at `runPartialRecursive`. Their
  [full-page](first-route/axe-crash/error-context.md) and
  [scoped](first-route/axe-crash/active-dialog-error-context.md) contexts are kept.
  Neither audit passed. A related accessible-name crash exists in earlier guest
  harness documentation, but the cause here is not established. This automated
  R12 accessibility audit remains open for T152; no axe rule was disabled or
  violation result relabeled as a pass. The route test retains actual keyboard,
  focus, modal, scroll and containment assertions without the crashing optional
  scan.
- At 768/390 pixels and 200% text, initial bounds assertions passed but visual
  inspection showed Game overlapping Close after scrolling. A new non-overlap
  assertion reproduced the fault. A narrow CSS correction lets Game scroll
  normally while Close stays sticky. Before images:
  [768](first-route/768-200percent-validation-before.png),
  [390](first-route/390-200percent-validation-before.png).

The coordinator subsequently authorized independent presentation helpers on the
already accepted R03/R04/R09/R10 inputs. New focused tests first failed against
the old implementations, then **26 checks passed across four suites** including
the existing introductory notebook and graybox regressions. The notebook accepts
validated route display metadata, identifies readings by exact objective/rule/
source/conclusion, shows plain explanations and original numeric units, and
preserves current/stale status without exposing raw conclusion codes or attempt
identifiers. Unknown records are not relabeled as introductory length tests.
Graybox layout injection requires an explicit bounded room list and rejects
missing/duplicate/foreign or authority-bearing data. The default helper behavior
remains unchanged for callers that do not select route metadata/layouts.

Commands use the pinned Node 26.13.1 directory and
`NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php`:

| Check | Observed result |
| --- | --- |
| First-route notebook/graybox, existing notebook/graybox, generated TS/PHP save policy | 29 tests passed across five suites |
| PHP `server/tests/ApplicationTest.php` | 6 tests, 59 assertions passed; actual packaged application factory and save/preferences/session handlers |
| `npm run check` | TypeScript, canonical content validation and deterministic packaged policy passed |
| `npm run build` | Passed; Vite reported its large-bundle warning (about 2.2 MB minified / 504 kB gzip), with no release-performance claim |
| Actual Firefox HTTPS route | Final 2 passed in 30.6 seconds: guest 95 m in 16.7 s; keyboard 100 m/save/restore in 13.5 s; zero page errors and cross-origin requests |
| Existing introduction/frame browser regressions on final sources | 10 passed in 1.0 minute: all nine independent T030 guest journeys plus the existing R01 keyboard/focus/390/768/200% frame and axe case; no test/fixture edits |

The final browser cases use a disposable trusted HTTPS origin/profile and
synthetic fixture storage. They invoke New Adventure, real interaction controls,
measurements, submission, review/execution, final tests and classification.
They do not inject runtime state, import evaluators into browser tests, fabricate
physical results, award completions, or use real provider credentials. The
keyboard route activates mandatory controls using Enter/Space; text entries use
the normal editors. Page errors and cross-origin HTTP requests must both be zero.

Desktop completion images: [95 m guest](first-route/95m-complete.png),
[100 m keyboard](first-route/100m-complete.png). The route toolbar, scene and all
controls remain inside the approved frame. Temporary geometry is visibly simple;
these images are implementation evidence, not finished-art acceptance.

Current final validation images: [95 m](first-route/95m-validation.png),
[100 m](first-route/100m-validation.png). Recorded observations become historical
after classification changes the world version; the panel explicitly explains
that the accepted classification used fresh proof at submission. The fresh link
and independent endpoint readings are asserted before that transition.

The final narrow captures show the non-overlapping Close control and scrollable
validation panel: [768 pixels / 200%](first-route/768-200percent-validation.png),
[390 pixels / 200%](first-route/390-200percent-validation.png). Toolbar bounds and
absence of document overflow are checked at both widths; these measurements are
not a phone performance guarantee.

## Acceptance boundaries

Only R01 has the accepted representative media. The remaining route may use
explicit temporary geometry through the common room renderer. Such geometry
counts as zero finished assets and does not establish finished-room, media,
human-learning or whole-episode acceptance. Native Safari, real provider behavior,
other branches and eventual ending/playthrough matrices retain their own gates.
