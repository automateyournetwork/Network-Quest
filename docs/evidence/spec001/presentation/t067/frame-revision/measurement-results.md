# T067 revised contained-frame benchmark

2026-11-26, same loop073. **Twelve Firefox samples meet the numerical room
budgets. Native Safari preflight failed before timing; final owner review and
T066/T067/G3 acceptance remain pending.** This additive report preserves the
historical candidate and every failed attempt. Root owns acceptance and publication.

## Exact candidate and environment

The [runtime freeze](freeze-2026-11-26T22-11-48-122Z.json), SHA-256
`b5744cb6a893d5ae612546627f83d8c8564c7285d7bf74b1c95b863014716e3d`,
seals131 source/content/build/tool/native-source files and21 exact room bindings.
All131 records still matched after the run. All95 historical artifact seals also
remain unchanged. Genuine Blender/Audacity source reopen evidence carries forward
for the unchanged native bytes; no source, media, content or domain edit occurred.

This is the loop077 build identified by its [source/build seal](../../t077/final-source-build.json)
`9f5d21c956b312a12884ea48eeb61a374cdeee50e2628f58987c385cfa8e3af7`.
Root reviewed check/287 focused unit checks/build and the final66/66 joined browser
cases (5.4 minutes). Loop078's final five direct cases, narrow Scene/stage axe,
keyboard scrolling, text recovery and packet lifecycle checks passed separately.
See [077 joined results](../../t077/joined-results.txt) and [078 review](../../t078/review.md).
Their functional scope and retained limitations are not converted into performance
or human approval.

Actual reference laptop: Mac16,7, Apple M4 Pro,14 logical CPUs,48GiB RAM,
macOS26.6.2 build25G83. Firefox159.0 ran headless on that Mac at DPR1,
1280×720 and1440×900, reduced-motion no-preference. Its Macintosh compatibility UA
is preserved; that string is not proof of the actual host OS version. The Mac was on AC power; starting
load averages were5.49/7.93/7.01. Root paused heavy tests/build/compression during
measurements. Two persistent guest previews remained available; possible owner
activity and thermal/OS/shader caches were not controlled or inferred.

Each cold pair uses a fresh isolated Firefox profile/process and origin; warm
revisits the same origin/cache. The strictly verified local HTTPS fixture uses an
explicit disposable CA for Node calibration and Firefox NSS trust, with no TLS
bypass or OS trust-store change. Its shared downstream response scheduler targets
20Mb/s and50ms response delay. The two executed calibrations measured single-stream
19.9999/20.0076Mb/s and concurrent19.9914/19.9956Mb/s; initial header delay
63.94/54.26ms includes fixture overhead. DNS, upload, TCP/TLS handshake latency,
physical WAN RTT and production-host capacity are not emulated.

Each run records exact helper hashes. The served probe hash is
`236f6e9b03fe5d498091d5b248169190ce871f0ea76233efebff03e50dbbfde8`.
Original build HTML and instrumented/encoded response hashes remain distinct.
The probe opens the actual Scene/Game windows, rejects hidden/inert controls,
closes reading windows before frame sampling, and fails on a stale entry/reset
modal. Scripted DOM activation does not establish a trusted audio gesture.

## Executed results

One successful smoke pair per viewport was followed by two additional pairs per
viewport. No valid smoke was repeated. Pair1 is [run22:12:27](firefox-2026-11-26T22-12-27-799Z/summary.json);
pairs2/3 are [run22:13:57](firefox-2026-11-26T22-13-57-156Z/summary.json).
The [combined audit](executed-summary.json) preserves exact run/source/hash/cache
mappings; raw samples, response logs, calibrations and screenshots remain beside it.

| Viewport | Pair | Cache | Shell ready ms | Room ready ms | Completed first-room transferSize bytes |
| --- | ---: | --- | ---: | ---: | ---: |
| 1280×720 | 1 | Cold | 832 | 2108 | 3,115,845 |
| 1280×720 | 1 | Warm | 572 | 661 | 19,743 |
| 1280×720 | 2 | Cold | 844 | 2155 | 3,115,845 |
| 1280×720 | 2 | Warm | 576 | 663 | 19,743 |
| 1280×720 | 3 | Cold | 841 | 2136 | 3,228,317 |
| 1280×720 | 3 | Warm | 579 | 667 | 19,743 |
| 1440×900 | 1 | Cold | 829 | 2131 | 3,228,317 |
| 1440×900 | 1 | Warm | 584 | 667 | 19,743 |
| 1440×900 | 2 | Cold | 823 | 2129 | 3,115,845 |
| 1440×900 | 2 | Warm | 589 | 694 | 19,743 |
| 1440×900 | 3 | Cold | 827 | 2135 | 3,115,845 |
| 1440×900 | 3 | Warm | 575 | 664 | 19,743 |

| Numerical comparison | Observed | Target |
| --- | --- | --- |
| Compressed shell bodies, including probe | 453,919bytes | ≤5MiB |
| Completed first-room bodies, including probe | 3,109,545–3,221,717bytes | ≤15MiB |
| Conservative full cold+warm workload advertised-body bound | 3,244,546–3,693,234bytes | Entire pair remains below15MiB |
| Cold navigation to first room | 2.108–2.155s | ≤12s |
| Warm navigation to first room | 0.661–0.694s | Recorded separately |
| Actual render-count deltas during idle/inspection | 113.75–120.25FPS | ≥30FPS |
| Visible triangles / draws / geometries | 70,716 /275 /275 | ≤500,000triangles |
| Estimated texture data | 25,305,756bytes, about24.13MiB | ≤128MiB estimated |

Readiness includes scripted New Adventure and instrumentation overhead. Actual
render counters count renderer submissions, not GPU execution completion. Raw rAF
and submission intervals remain separate; exploration rAF p95 is9.62–10.18ms.
Image-decode medians are3–5ms, per-sample p95 is18–20ms, maximum34ms. These values
do not isolate GLTF parse time or GPU execution time.

The texture estimate is132,124bytes of known-format WebGL API allocation plus
25,173,632bytes for a full-mip allowance on three decoded DOM image layers
(RGBA base18,880,224bytes). Unknown formats would remain unknown; none were
observed. Driver copies, tiling, framebuffer storage and actual GPU residency
are not measured. No physical GPU-memory claim follows.

Entry snapshots have no active modal or document overflow. The stage is
1268×578.8 at1280×720 (80.4% of viewport height) and1428×766 at1440×900
(85.1%). Actual [1280 entry](firefox-2026-11-26T22-12-27-799Z/1280x720-pair0-cold.png)
and [1440 entry](firefox-2026-11-26T22-12-27-799Z/1440x900-pair0-cold.png)
were visually inspected: one bounded room, compact labeled controls, no numbered
pins by default and no document-style action stack below it. This is agent visual
inspection, not the owner's acceptance.

## Cache, cancellations and retained HTTP failures

All six origins serve the exact frozen dist manifest. Each pair requests20 asset
URLs. The eighteen code/image/model URLs and the short effect clip each appear
once across the full cold/warm workload, establishing reuse for those19 URLs.
All completed warm first-room asset Resource Timing entries report zero transfer.
Those entries do not include every in-flight request and are not blanket proof of
complete audio reuse.

Three pairs contain five requests for `narrator-001.mp3`: four aborted HTTP206
range responses followed by one completed response. These are1280 pair1,
1280 pair2 and1440 pair3. The other three pairs contain one narrator206 response.
Exact rows remain, with no cause inferred. The variable first-room byte total
reflects whether the112,172-byte narrator entry had completed at that observation.
The server's bodyBytes field is the intended response length, not bytes actually
transmitted before an abort. The conservative full-pair bound above counts every
advertised body in full, including aborted bodies, and excludes calibration data;
it avoids undercounting pending/cancelled audio as zero. It is not a wire-byte
measurement.

Every pair also retains two intentional static-fixture session503 responses
(with aborted-body flags) and one `/favicon.ico`404. These are not erased or
reclassified as successful requests. There are no page errors, scene-asset HTTP
errors or server-error records. The numeric budget booleans do not certify audio
playback, service availability or the absence of cancellations.

## Resource disposal and recovery scope

Across60 R01/R02 round trips, R01 returns to940 live buffers,275 vertex arrays
and one program. After both rooms have been visited, reusable renderers retain
12textures/six framebuffers. Text mode releases buffers/arrays/programs to zero.
Actual WebGL context loss removes the canvas; Retry restores the R01 renderer
and the same ownership counts. New Adventure returns to the R01-only baseline
of940 buffers,275 arrays, one program, seven textures and three framebuffers,
with no stale modal. Context-loss release counters and explicit deletion counters
are separate. This is bounded API ownership evidence, not physical-memory or
whole-episode leak proof.

**The probe's `lost.text` is false in all12 samples.** Its inherited predicate is
`document.body.innerText.includes('power') && document.body.innerText.includes('link')`,
a case-sensitive whole-body substring check. It is not an actionable-control
assertion and does not participate in numeric budgets. The false values remain
unchanged; no exact cause or semantic fallback success is inferred from them.
The narrower executed observation is canvas removal, an active Scene objects and
exits window, activation of the visible non-inert Retry visual scene control,
and restored R01 rendering.

Separate final077 functional evidence does cover semantic access after actual
context loss: [the specific test](../../../../../../tests/e2e/introduction-graybox.spec.ts)
`real WebGL loss preserves text actions and retry restores the same state`
uses WEBGL_lose_context, keyboard Link indication, retained Power+Link evidence,
keyboard Retry and Text/Low detail recovery. It passed inside the final66/66 join.
This separate unshaped functional result does not turn the benchmark's false
substring predicate into a passing assertion. Loop078 also independently verified
text-mode investigation/recovery within its stated scope.

## Native Safari and preserved failed attempts

Actual installed Safari27.2 (21625.2.8.18.4) was used, never Playwright WebKit.
The [native preflight](safari-2026-11-26T22-16-36-094Z/native-controls.json)
created task window7732 and made one ordinary activation attempt. Safari reported
frontmost=false, windowVisible=true and tabVisible=true. The actual loaded page
reported document.hidden=true, visibilityState=hidden and hasFocus=false, at
1324×981 with DPR2. That is not an accepted required viewport.

The runner stopped before timing, sizing or screenshot capture. **No native
painted-surface image or timing result was obtained in this revision.** It safely
closed only task window7732; both owner preview origins and old window7338 were
not navigated. There were no additional unchanged activation attempts and no
security, trust, automation or global display setting changes. The prior native
painted-surface finding remains unresolved. The already-pending owner request is
to activate Safari with revised63366 open and leave it frontmost; no duplicate
question or approval is inferred. Even future visible DOM metadata will require
actual native-image inspection. Safari's authorized HTTP guest-only transport
will not establish Safari HTTPS or provider/service acceptance.

The first revised Firefox launch omitted NQ_PHP_BIN and failed the PHP8.4.28 guard
before any sample; its [zero-sample failure](firefox-2026-11-26T22-11-51-685Z/launch-failure.json)
is retained. The same frozen helper was invoked with the documented pinned PHP.
The first offline cache audit incorrectly assumed the historical once-per-asset
pattern; [that assertion failure](summary-audit-first-attempt.json) is retained,
and the corrected audit reports the real narrator cancellations. No browser
sample was altered or repeated to hide either finding.

## Review and disposition

The [revised owner preview](http://127.0.0.1:63366/arcade/play/network-quest/?t067=review)
remains live, uninstrumented and frozen in memory; [its33-file HTTP integrity audit](review-2026-11-26T22-05-16-631Z/http-integrity.json)
identifies exact HTML/JS/CSS/media bytes. Old preview54594 remains available.
Both growing preview logs are excluded from stable artifact seals and publication.
The [owner packet](review.md) records the current evidence and outstanding review.

Proposed disposition for root: **T066/T067/G3 remain pending usable native Safari
evidence and actual owner approval, with earlier aggregate gates unchanged.**
The owner has not yet responded to the revised candidate. Previous positive
artwork feedback and unchanged audio approval do not approve this new interface.
No deployment, production source change or shared tracking mutation occurred.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
