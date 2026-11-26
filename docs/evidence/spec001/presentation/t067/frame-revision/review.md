# Arrival Lift — revised contained-screen review

Prepared 2026-11-26 by loop073/T067; updated after the released measurement slot.
**Twelve revised Firefox samples meet numerical budgets; final joined66/66 passed.
Owner review and usable native Safari evidence remain pending.** This is
the corrected interface candidate for review, not G3 or episode acceptance.

## Open the actual revised room

[Open the revised guest preview](http://127.0.0.1:63366/arcade/play/network-quest/?t067=review)
and choose **New Adventure**. The server must remain running on this Mac. It keeps
the reviewed bundle in memory, so later disk changes cannot silently replace this
candidate. It serves the original built HTML, JavaScript, styles and media without
measurement instrumentation. This local guest preview has no account service.

[The revised measurement report](measurement-results.md) records exact timings,
cache/range-request caveats, recovery scope and the unsuccessful Safari preflight.

The room now occupies one bounded adventure screen with a compact command bar.
The descriptive lists and menus appear inside the frame when needed. Numbered
markers are off by default; Scene → Show hotspots makes them available explicitly.
The original Blender, generated image and approved audio media are retained.

Try Look on the power/link indications, then open Scene for the complete named
object list. Open Inventory or Notebook and close it with Close or Escape. Game
and Sound and reading also stay inside the frame. The review concerns whether
this revised screen, controls and contextual reading match the requested adventure
experience. The unchanged audio clips already have speaker/earbud approval.

The earlier feedback was positive about the artwork but requested a substantial
interface correction. It is not final acceptance of this revision. Root will
record the owner's actual response; no approval follows from opening the link.

## Verified candidate and current checks

The [loop077 source/build seal](../../t077/final-source-build.json), SHA-256
`9f5d21c956b312a12884ea48eeb61a374cdeee50e2628f58987c385cfa8e3af7`,
identifies the reviewed candidate. T067 independently matched all20 source files,
four build inputs and33 dist files, then fetched all33 dist files through HTTP.
Every decoded response matched its exact sealed hash, including HTML, JS, CSS
and media. The live fixture's in-memory manifest also matches the entire sealed
dist. See [HTTP integrity results](review-2026-11-26T22-05-16-631Z/http-integrity.json).
These are integrity reads, not browser or performance measurements.

| Built file | SHA-256 |
| --- | --- |
| `index.html` | `9d1966af4f883192648540b147861cdbfc181d9404b3c05e0640b2bb28e10b13` |
| `assets/index-Dl_jRh0f.js` | `05c124f1fb0589a6d63eadcc4b5e6be8cb0eb5899905a5816ad4b6c66ee8bfec` |
| `assets/index-BVwJZmm0.css` | `bd32d6dbcf5d1d6fffa91c4bcdc811f5c5bf721267e8bf84a080315b0a11db61` |

Root reports loop077 check,287 focused unit checks and build passed; its final66
joined browser cases were still running when this packet was prepared. Earlier
failures and corrections remain in the [loop077 review](../../t077/review.md).

The [independent loop078 review](../../t078/review.md) reports all five final direct
cases passed, including save feedback, inventory feedback, lifecycle installation,
dialogue focus and logout behavior. Its isolated narrow Scene/stage scans have
zero default axe violations, with contrast-incomplete results explicitly retained.
Keyboard scrolling of long feedback/captions, text-to-visual recovery, all five
packet phases, replay/reopen and stale-control rejection passed. These scoped
checks do not certify every accessibility or account/provider path, native zoom,
Safari, performance or owner preference.

## Pending evidence and preserved history

- Root reviewed the final66/66 joined result and released the exclusive runtime
  slot. All twelve revised Firefox samples completed; native Safari preflight
  stopped because the page remained hidden and Safari was not frontmost.
- The earlier12 Firefox measurements describe the earlier interface. They are
  preserved and are not used as performance acceptance for this revised build.
- Actual Safari's prior foreground/painted-surface finding remains unresolved.
  Direct DOM visibility alone cannot close it. Native images and foreground state
  must be inspected alongside any eventual measurements. Safari HTTPS/account
  acceptance also remains unverified by this guest-only HTTP preview.
- Final owner approval of the corrected room, T067/G3 and earlier aggregate gates
  remain pending. No deployment or episode acceptance is claimed.

Preview process session80711 and its [start record](review-2026-11-26T22-05-16-631Z/session.json)
identify this persistent server. Its growing request log is live evidence, not a
final seal. The older preview54594 and owner Safari window7338 remain untouched;
all95 historical sealed files are preserved. At the initial preview handoff,
T067 had performed only HTTP integrity reads. Subsequent measurement operations
are recorded in the separate additive report; the owner's preview was not navigated.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
