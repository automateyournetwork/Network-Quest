# T067 contained-frame revision preparation

Current status, 2026-11-26: [the executed revision report](measurement-results.md)
records twelve valid Firefox samples and a failed native Safari preflight before
timing. Final owner approval and T066/T067/G3 remain pending. All historical
candidate evidence is preserved; the preparation record below describes its
earlier point in time.

## Historical preparation record

2026-11-26, same loop073. This directory is additive to the sealed historical
candidate. At preparation time, no revised measurement or owner acceptance had happened.
Root retains scheduling, gate acceptance and publication. Loop077 owns the changing
application/build/browser work; loop078 independently verifies its corrected frame
before root can release an exclusive T067 timing slot.

The earlier 95-file seal remains byte-for-byte unchanged. Its Firefox samples and
native Safari failures describe the earlier interface, not this revision. The
owner's positive visual feedback included a required contained-game correction;
the prior audio approval continues for unchanged clips. Preview54594 and Safari
window7338 remain untouched.

## Prepared semantic route

Loop077 confirmed these names against its current frame and
`tests/e2e/support/adventure-controls.ts`. The new probe follows visible controls
and rejects hidden, inert or disabled buttons. It never changes gameplay state or
removes modal attributes. DOM activation is scripted and does not prove trusted
user gestures or audio playback.

Root's preparation review caught the revised close control: its visible text is
now `Close`, with its descriptive name retained in `aria-label`. Both lookup and
activation now use the same aria-label-first name. The initial preparation hash
record remains unchanged; the correction and refreshed hashes are additive.

| Measurement action | Actual interface route |
| --- | --- |
| Begin guest adventure | Visible title New Adventure |
| Inspect power | Look in toolbar → Scene → Power indication → Close Scene objects and exits |
| Change room | Walk in toolbar → Scene → unchanged named R01/R02 exit → close Scene |
| Text / low detail / retry | Scene → original named presentation control; close Scene before rendering intervals |
| Reset adventure | Game → New Adventure → Start new adventure |

Initial entry and reset must leave no modal covering the room. The probe fails if
a stale modal persists; it does not dismiss that application error. Idle and
inspection windows require an uncovered scene. Existing render-count, decode,
texture, recovery and five-round-trip observations are preserved. Added layout,
direct DOM visibility/focus and bounded phase reports make a stopped run diagnosable.
The instrumentation and scripted navigation overhead remain part of the observed
navigation-to-ready interval; frame cadence remains a separate measurement.

## Additive tools

- `tools/measurement/t067-frame-probe.mjs` and `.d.mts`: visible route and progress
  instrumentation, derived from the sealed original probe.
- `tools/measurement/t067-frame-server.ts`: same calibrated aggregate response
  scheduler and strict guest-only boundary, with the revision probe and a small
  task-owned native tab-visibility page. Original versus served bytes stay distinct.
- `tools/measurement/t067-frame-firefox.ts`: strict local HTTPS, exact viewports,
  fresh cold origins/profiles and warm reuse. Every run now records helper hashes.
- `tools/measurement/t067-frame-safari.mjs`: actual installed Safari through its
  normal window/tab dictionary, with protected owner-window and origin checks.
- `tools/measurement/t067-frame-freeze.mjs`: future root-reviewed runtime/source
  freeze, written beneath this directory.
- `tools/measurement/t067-frame-review.mjs`: future separate persistent guest
  preview, serving original HTML with no measurement probe.

Each derived helper identifies its original source hash. The historical summary
helper already accepts nested T067 sample paths and can summarize revision runs
without being changed. The revision source is still changing; no freeze command,
server, browser runner or preview helper has been executed in this preparation.

## Native Safari boundary

The earlier actual Safari27.2 checks fetched the room and sized both required
viewports, but failed to obtain a usable painted/foreground surface. Native window
and tab visibility properties did not prove DOM visibility or rendering. The
JavaScript-from-AppleEvents setting denied the earlier read-only call; it remains
unchanged. No new browser operation, activation attempt or setting change occurred
during this preparation.

The prepared runner uses a new task window and refuses navigation or cleanup of
the preserved owner window7338. It performs at most one ordinary activation per
future reserved run, records native properties alongside the latest page-reported
visibility, and stops before timing if the DOM is hidden or Safari remains outside
the foreground. The actual native-preflight image must still be inspected; a
DOM-visible report or completed sample cannot establish a usable painted native
surface. Samples carry an explicit unaccepted surface-review field until that
inspection, with further failures/limits recorded separately. It never enables remote
automation, JavaScript from Apple Events, trust exceptions or display changes.
Phase/heartbeat reports retain the point where an otherwise visible run stops.
Only the verified task window can be closed at cleanup. If normal control still
fails, preserve the observation and ask root to coordinate the smallest actual
owner foreground action; do not substitute WebKit results or invent Safari FPS.

Safari remains the explicitly authorized HTTP loopback guest-only measurement.
Firefox uses verified local HTTPS. Neither is production-host/service acceptance;
Safari HTTPS remains a separate unverified transport capability.

## Checks and next execution boundary

`preparation-checks.json` preserves the first six successful pinned Node syntax
checks and all95 historical artifact hashes unchanged. The additive
`preparation-checks-02.json` records the Close-name correction, tightened native
surface boundary and refreshed helper hashes. Both record exact source inputs read
during active loop077 editing, explicitly not a frozen build. No app build, shared
test, browser or performance workload ran. Root must review the finished loop077
and loop078 handoffs, grant the exclusive slot, and freeze the corrected bundle
before the first smoke pairs. Required desktop cold/warm measurements and the
revised concrete owner packet follow that handoff; final G3 remains pending.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
