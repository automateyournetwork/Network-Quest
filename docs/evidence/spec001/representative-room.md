# T067 — representative Arrival Lift review

Date: 2026-11-26. Worker: loop073/T067. Scope: C5/C11/C14/C15,
FR-017–022, W04/G3 and representative AC08–10/14/15/20 evidence.

**Partial historical candidate evidence; T067 and G3 remain pending.** Firefox's
twelve samples meet the numerical room budgets for the frozen interface below.
The owner reviewed that candidate positively for its visuals and requested a
substantial interface correction: one contained adventure screen with contextual
controls, instead of text buttons below the playable window. Root owns that T066
revision. These measurements do not certify the forthcoming interface. Actual
Safari timing and final owner acceptance remain pending. Earlier G0/G1/G2
limitations remain visible; this task cannot waive them or certify the episode.

## Stable inputs and review boundary

The accepted production tasks supply three real Blender sources (R01, CH01 and
CH03), thirteen component GLBs (architecture, ten props and two characters), three
actual OpenAI PNG layers and the unchanged Audacity 4 audition bank. The finished
room uses five audio exports. The full reference R01 GLB is not also loaded.
Source/export hashes are sealed against the frozen runtime manifest.

T065's twelve sealed audio candidates already have actual owner listening approval
on built-in Mac speakers and earbuds. That approval carries forward for unchanged
bytes. The integrated room's composition, controls and audio behavior still need
review. No repeated audition approval is requested for the same clips.

## Preparation observations

Read-only discovery found actual Safari **27.2 (21625.2.8.18.4)** and the matching
system safaridriver on macOS **26.6.2 (25G83)**. Hardware is **Mac16,7**, Apple
M4 Pro, 14 logical CPUs and 48 GiB RAM. System Events reports accessibility access
enabled and Safari not running. Reading `AllowRemoteAutomation` returned an absent
preference; this does not establish whether a WebDriver session will work. No
Safari setting, trust store, browser session or application process was changed.

T059 is reused for its distribution/resource accounting and WebGL handle probe.
Its original graybox samples remain unmodified. That tool explicitly used an
unshaped loopback network, so its timings cannot pass the finished-room target.

## Measurement protocol prepared for the frozen handoff

- Record exact build, source/media and tool hashes, real OS/browser version,
  viewport and device pixel ratio. Keep every failed attempt and HTTP failure.
- Run three independent cold/warm pairs at both 1280×720 and 1440×900. Cold uses
  a new owned origin/profile; warm revisits the same origin/cache. Verify actual
  cache reuse from resource timing and server requests. OS/shader caches stay warm.
- Use a calibrated local response scheduler with aggregate downstream 20 Mb/s and
  50 ms response latency. Record what is emulated and measured; no host/WAN/TCP
  performance is inferred. Retain an unshaped comparison when needed to diagnose
  harness overhead. Do not change global network shaping or browser settings.
- Title/shell compressed bytes must be ≤5 MiB. First playable room total compressed
  bytes must be ≤15 MiB, and readiness from navigation must be ≤12 seconds. Record
  scripted interaction overhead and separately identify optional audio requests.
- Measure actual rendered frames during ordinary exploration, animation and
  interaction, with raw intervals, median/p95, visibility and submission counts.
  Display rAF cadence alone is insufficient to establish ≥30 FPS gameplay.
- Record ≤500,000 visible triangles, draw calls, geometry and texture counts. Sum
  reviewed GL storage estimates and decoded DOM image residency, with a clear
  explanation of mip levels/copies. Compare ≤128 MiB as an estimate, never measured
  GPU memory. Image-decode timing and request waterfall remain separate observations.
- Repeat room changes, text/low-detail modes, context loss/retry and new adventure;
  inspect resource-release counts and semantic-state preservation. Native Safari
  hidden-tab observation is separate from synthetic `document.hidden` tests.
- Reopen unchanged native sources, compare source/browser visuals and preserve
  exact hashes before/after. Reuse accepted T065 native reopen evidence if source
  seals match; do not repeat source editing or human auditions unnecessarily.

## Results and owner review

Actual source reopen preparation passed: real Blender5.2.1 factory/background,
one thread, reopened R01/CH01/CH03 without rendering or saving. All three exit0
and before/after hashes match the accepted source seals. Unique native outputs
and logs are in `presentation/t067/*-source-reopen.*`. T066 may have been running
headless Firefox concurrently; these checks are not performance samples.

The unchanged Audacity bank has SHA-256
`3d17afa984c7ef855b7cd9bee434502c433f5a4ad28099a1b7e61043c6358d35`,
read-only SQLite integrity `ok`, and no WAL/SHM. All33 sealed audition files match.
`presentation/t067/audio-source-seal-check.json` carries forward the accepted
actual Audacity4.0.2 native reopen and owner speaker/earbud listening evidence.

### Frozen runtime and source observations

The [freeze record](presentation/t067/freeze-2026-11-26T20-33-59-170Z.json) seals
123 source/content/dist/tool/native-source files and all21 exact runtime bindings.
Its SHA-256 is `7601efd2f9192e21b7417c9f2e13bad676561520bea13284a8e285e0ce7d7e41`.
It is the authority for the measured working build; later source publication does
not rewrite what was measured. Safari's subsequent control-only helper change is
separately sealed in each new native run's `harness.json`.

The independent13-component GLB inspection totals70,716 triangles and2,773,292
raw bytes; all glTF2 binary headers/lengths and triangle-accessor counts are valid,
with no embedded/external images. Runtime observations independently match70,716
visible triangles. All three OpenAI originals decode at1672×941 and remain exact
copies of their public exports. No generation, native source or audio byte changed.

Root and T067 identified the initially hidden-below-fold artwork. T066 corrected
the shell's DOM/layout before the final freeze and reran relevant browser/access
checks. Final entry artwork begins near301CSSpx, with88.5% of the stage visible at
1280×720 and all of it at1440×900; verbs remain visible. Historical captures remain
in T066 evidence. T067 inspected the frozen actual Firefox room capture: the
platform, characters, diagnostic props and generated depth layers are coherent,
and the power and dark link objects remain distinct. This is agent inspection,
not human artistic acceptance.

### Executed Firefox benchmark — historical interface candidate

Actual Playwright Firefox159.0, headless on the recorded Mac, DPR1, no-preference
reduced motion. The browser's reported Windows UA is retained; it is not evidence
of the host OS. Native Safari is a separate required result.

One smoke pair per viewport and two further pairs per viewport produce12 valid
samples without repeating the successful smoke. All run over strictly verified
local HTTPS with the calibrated shared20Mb/s response scheduler and50ms response
delay. The Mac was on AC power at100% battery; no thermal/OS-cache pinning. Other
build/test/browser workloads were paused during these samples.

| Viewport | Pair | Cache | Shell ready ms | Room ready ms | First-room transfer bytes |
| --- | ---: | --- | ---: | ---: | ---: |
| 1280×720 | 1 | Cold | 837 | 2126 | 3,107,025 |
| 1280×720 | 1 | Warm | 584 | 665 | 16,270 |
| 1280×720 | 2 | Cold | 833 | 2125 | 3,107,025 |
| 1280×720 | 2 | Warm | 595 | 680 | 16,270 |
| 1280×720 | 3 | Cold | 810 | 2113 | 3,107,025 |
| 1280×720 | 3 | Warm | 593 | 678 | 16,270 |
| 1440×900 | 1 | Cold | 799 | 2102 | 3,107,025 |
| 1440×900 | 1 | Warm | 581 | 661 | 16,270 |
| 1440×900 | 2 | Cold | 805 | 2099 | 3,107,025 |
| 1440×900 | 2 | Warm | 588 | 667 | 16,270 |
| 1440×900 | 3 | Cold | 812 | 2112 | 3,107,025 |
| 1440×900 | 3 | Warm | 598 | 679 | 16,270 |

Pair1 is [run20:34:31](presentation/t067/firefox-2026-11-26T20-34-31-663Z/summary.json);
pairs2/3 are [run20:36:05](presentation/t067/firefox-2026-11-26T20-36-05-820Z/summary.json).
Each directory retains full `samples.json`, per-pair NDJSON, calibration and actual
full-page/room screenshots. Every cold pair uses a fresh Firefox process/trust
profile and origin. Warm revisits the same origin/profile. Across each pair the
server observes each of20 requested asset URLs only once; warm asset transfer is
zero. Encoded-body sizes repeat from cache and are not mistaken for wire transfer.

| Observed metric | Result | Representative target |
| --- | --- | --- |
| Compressed shell entity bodies | 445,099bytes including probe | ≤5MiB |
| Compressed first-room entity bodies | 3,100,725bytes including probe | ≤15MiB |
| Cold navigation to first actual room render | 2.099–2.126s | ≤12s |
| Actual render-count delta over ordinary idle/inspection windows | 119.75–120.25FPS | ≥30FPS |
| Visible triangles / draw calls / geometries | 70,716 /275 /275 | ≤500,000triangles |
| Estimated texture storage | 25,305,756bytes, approximately24.13MiB | ≤128MiB estimated |

Readiness includes the scripted New Adventure action and local probe overhead.
Frame counts come from actual renderer submissions/counters; raw rAF intervals,
submission intervals, median/p95 and visibility/dropped-sample fields are retained
separately. Exploration rAF p95 is8.98–9.62ms. Image `decode()` observations across
initial loading/recovery/cycles have per-sample medians4–5ms, p95 17–24ms and maxima
18–33ms. These do not isolate GLTF parse time or GPU execution time.

The texture estimate combines132,124bytes observed from known-format WebGL texture
allocation calls with25,173,632bytes allowed for one full mip chain of the three DOM
PNG compositor layers (RGBA base18,880,224bytes). DOM layers are not in Three's
three-texture counter. Driver copies/tiling, framebuffer storage and actual GPU
resident memory are not measured. Unknown formats would remain null; none occurred
in these samples. This is the specification's estimated-texture comparison only.

All12 samples complete with no page or scene-asset error. Each pair retains two
session503 responses in server records and one favicon404; warm Resource Timing
also retains a cached favicon failure. These fixture failures are not erased or
reclassified as success. The static origin deliberately has no account service.
No provider, production service or host-capacity acceptance follows.

Sixty recorded R01/R02 round trips retain stable R01 API handles:940buffers,
275vertex arrays and one program. Text mode releases buffers/arrays/programs to
zero; twelve textures and six framebuffers remain with reusable renderers after
visiting both rooms. Actual context loss/retry restores the same counts. New
Adventure disposes the former renderer and returns to940buffers/275arrays,
seven textures and three framebuffers for the new R01-only run. Context-loss
release and explicit deletion remain distinct counters. This is bounded ownership
evidence, not proof of physical GPU-memory reclamation or an episode-long leak test.

### Native Safari observations and retained failures

Actual Safari27.2 was used, not Playwright WebKit. The first run at20:38:09UTC
retains an AX window-index failure and a native-navigation timeout, with no valid
timing sample. System Events reports zero Safari windows despite the application
having a visible window; the keystroke navigation path was discontinued.

Normal Safari AppleScript window/tab commands work without enabling JavaScript
from Apple Events. The second run at20:43:09UTC reaches exact1280×720 and1440×900
content viewports and fetches all16 scene resources. It retains two cold-sample
timeouts, with no completed timing result or warm measurement. Safari reports
`frontmost=false` despite bounded activation attempts; its documented tab property
reports `visible=true`. Read-only tab text contains the real room/actions and
“Visual presentation ready”, while actual window captures show a flat background
without the page pixels. These observations do not establish DOM visibility,
painted rendering or FPS. Read-only `do JavaScript` is explicitly denied by the
existing setting; that setting was left unchanged.

The exact native failure rows, viewport observations and helper hashes are retained
under `presentation/t067/safari-*`. No browser security, certificate trust, global
display resolution or network setting was changed. CPU ownership was released
once there was no valid timing sample in progress. Actual Safari readiness/FPS,
native hidden-tab behavior and visual comparison remain pending a usable surface.

### Concrete owner review

The persistent [Arrival Lift preview](http://127.0.0.1:54594/arcade/play/network-quest/?t067=review)
was independently verified HTTP200 with exact unmodified built HTML (SHA-256
`c162936668773b59bf6e1dee19085ffb070ff4cf1a2e6cff78e0f0f60c9087d4`). It loads the
same frozen JS/media and contains no measurement script. This is a guest-only local
HTTP review, not public deployment or Safari HTTPS/account acceptance. Safari task
window7338 points to it. The review server remains available while the owner reads
and plays; no automation should navigate that window during the review.

The owner responded on 2026-11-26:

> review looks good but there is a LOT OF TEXT BUTTONS below the main playable window this is no really great this needs to be EXACTLY Like Sierra Quest games imagine the window as an old 286 Monitor those games had no additional menus and such right

This is positive visual feedback with a requested substantial interface correction,
not final R01/G3 acceptance. Root is preparing one contained adventure screen with
compact in-frame controls and contextual text, inventory and menu overlays, while
retaining keyboard/text access and the existing real media. The exact response and
disposition are recorded in [owner-review.json](presentation/t067/owner-review.json).
No native Safari timing or foreground success is inferred from the owner's review.
The existing speaker/earbud approval remains valid for unchanged audio clips.

The live preview keeps the historical bundle in memory even if a later build is
written. It remains available without automated navigation while the owner uses
it. T067 will measure and prepare a revised owner packet only after root reviews
and freezes the changed interface. The earlier samples and failures remain intact.

Proposed G3 disposition for root: **PENDING** until the requested interface revision,
its required representative checks, actual Safari evidence and final owner
acceptance are recorded. Root owns gates.md and task acceptance.

### Historical checkpoint verification

[Offline verification](presentation/t067/checkpoint-validation.json) passes syntax
checks for nine JavaScript/TypeScript helpers and a Python AST parse, parses 49
structured evidence files (320 NDJSON records), and resolves the review packet's
local links. It confirms all six Firefox pairs served the exact historical dist
manifest, each of their 20 requested asset URLs was fetched once, and all warm
first-room asset timing rows report zero transferred bytes. Raw summary hashes,
calibrations and recorded cleanup match. This is evidence validation, not another
runtime or browser sample.

The first offline assertion incorrectly required HTTP200 for all assets; valid
MP3 byte-range HTTP206 responses exposed that checker error. Its failed attempt is
preserved in `checkpoint-validation-first-attempt.json`; the corrected check keeps
the exact response statuses. No raw browser observation changed. A separate
[resume HTTP check](presentation/t067/preview-resume-check.json) confirms the live
historical preview still serves the original HTML without a probe; no owner browser
navigation occurred.

The [partial artifact seal](presentation/t067/partial-artifact-seal.json) lists exact
stable evidence/helper/document hashes. Its historical runtime freeze and per-run
instrumentation hashes remain the authority for those samples. The live preview
request log is explicitly excluded until the server is stopped. These seals do not
accept the revised interface or any aggregate gate.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
