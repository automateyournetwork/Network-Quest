# T067 actual Safari follow-up

2026-11-26, same loop073. **All twelve actual Safari samples pass the recorded
numerical budgets, with a visibly painted native room at both required viewports.**
This additive evidence resolves the earlier native foreground/capture blocker.
The sealed earlier reports describe their historical observations and remain unchanged.
Root owns T067 and aggregate gate acceptance.

## Candidate, owner review and native capability

The unchanged [131-file runtime freeze](freeze-2026-11-26T22-11-48-122Z.json)
is `b5744cb6a893d5ae612546627f83d8c8564c7285d7bf74b1c95b863014716e3d`;
the [077 source/build authority](../../t077/final-source-build.json) is
`9f5d21c956b312a12884ea48eeb61a374cdeee50e2628f58987c385cfa8e3af7`.
All131 records,21 export/build bindings and both historical artifact sets
(95 and67 files) still match. No application, content, media, native source or
build change was made. Prior actual Blender/Audacity source reopening and accepted
unchanged audio auditions carry forward; this run does not repeat listening approval.

The owner's corrected-screen response, “yeaht thats MUCH Better can you drive
spec001 to completion”, is recorded separately in the
[owner approval](../../owner-frame-approval-2026-11-26.md). It approves the corrected
contained-screen direction, not the full episode, providers or production release.
Both owner previews remain available: old54594 and corrected63366. Owner window7338
was never navigated or closed by these checks. No duplicate overnight question was sent.

Read-only diagnosis found an on-console execution session, Safari PID40139, and
matching AppleScript/CGWindow capture ID7338. Its native window existed on screen,
but Safari was not frontmost. The first CoreGraphics bridge attempt failed and is
retained; the corrected read-only probe used the proper CF-to-ObjC conversion.
Root then authorized one newly identified normal
`NSRunningApplication.activateWithOptions:` attempt (options2). It returned true.
AX and Safari immediately reported foreground; a fresh process independently
confirmed Safari active/frontmost. The activation process's earlier NSWorkspace
observation still reported Code; this discordant observation is preserved, with no
unproven causal explanation. See [diagnosis](native-diagnosis-2026-11-26T23-38-15Z/metadata-02.json),
[activation](native-diagnosis-2026-11-26T23-38-15Z/normal-activation.json) and
[fresh-process verification](native-diagnosis-2026-11-26T23-38-15Z/post-activation-fresh-process.json).

Actual native captures then showed the old owner title, followed by a fresh,
task-owned [corrected title](native-observe-2026-11-26T23-43-54Z/native-revised-title.png)
with direct DOM visible/focused state. No security, trust, remote automation,
JavaScript-from-AppleEvents or display settings changed. The sealed native runner
itself is unchanged, SHA-256
`8a7e149518fd4a4d6401fa709893ccea28dbe120ab4e3f3caebaac5692caced8`.
The served probe is
`236f6e9b03fe5d498091d5b248169190ce871f0ea76233efebff03e50dbbfde8`.
Each run records all actual helper hashes; additive diagnosis scripts are sealed here.

## Measured profile and results

Actual installed Safari27.2 (21625.2.8.18.4), not Playwright WebKit, ran on the
same Mac16,7/Apple M4 Pro laptop,14 logical CPUs,48GiB RAM, macOS26.6.2 build25G83.
The compatibility UA says Macintosh10_15_7; it is not OS-version evidence. Native
content viewports were exactly1280×720 and1440×900 at DPR2, visible, focused and
frontmost. Entry/reset had no active modal or page overflow. Heavy tests, builds
and compression were paused throughout timing; existing previews, OS caches and
thermal state were not reset or controlled.

The authorized fixture is **guest-only loopback HTTP**. Firefox's earlier results
used strictly verified local HTTPS; neither establishes production-host performance,
and these Safari results do not establish Safari HTTPS/provider/service acceptance.
Each cold pair used a new origin, followed by a warm navigation on the same origin.
Safari's process and system caches were retained. All six cold origins transferred
their code/model/image bodies. Response pacing targeted aggregate20Mb/s and50ms
response delay. The two calibrations measured single-stream19.9998/19.9936Mb/s,
concurrent19.9982/19.9915Mb/s and initial header delays54.25/55.50ms. This is local
application response scheduling, not physical WAN RTT; DNS, upload and handshake
latency are not emulated.

The [four-sample smoke](safari-2026-11-26T23-44-24-725Z/samples.json) was retained;
[eight further samples](safari-2026-11-26T23-48-50-781Z/samples.json) completed the
prescribed three cold/warm pairs per viewport without repeating valid smoke.
The [offline audit](native-safari-summary.json) identifies every run/pair/origin,
calibration, cache observation, ownership count and source hash.

| Viewport | Pair | Cold shell / room ms | Warm shell / room ms |
| --- | ---: | ---: | ---: |
| 1280×720 | 1 | 609 /1985 | 425 /489 |
| 1280×720 | 2 | 644 /1911 | 473 /524 |
| 1280×720 | 3 | 631 /1915 | 459 /514 |
| 1440×900 | 1 | 618 /1889 | 425 /502 |
| 1440×900 | 2 | 632 /1906 | 444 /500 |
| 1440×900 | 3 | 637 /1907 | 448 /499 |

| Budget | Actual observation | Target |
| --- | --- | --- |
| Cold compressed shell bodies, including probe | 453,919bytes | ≤5MiB |
| Cold completed first-room bodies, including probe | 3,109,545bytes | ≤15MiB |
| Cold navigation to ready | 1.889–1.985s | ≤12s |
| Warm navigation to ready | 0.489–0.524s | Recorded separately |
| Actual idle/inspection render-count cadence | 59.91–60.47FPS | ≥30FPS |
| Visible triangles / draws / geometries | 70,716 /275 /275 | ≤500,000triangles |
| Estimated combined texture data | 25,305,756bytes, about24.13MiB | ≤128MiB estimated |

Readiness includes scripted New Adventure and probe overhead. Render counts measure
renderer submissions, not GPU completion. Inspection rAF p95 was18ms; decode medians
7–10ms, per-sample p95 20–28ms, maximum39ms. Texture estimates combine132,124bytes
of known-format WebGL allocation with25,173,632bytes of DOM-layer RGBA/mip allowance.
Physical GPU residency, driver copies and framebuffer storage are not measured.

Agent inspection of actual [1280 native room](safari-2026-11-26T23-44-24-725Z/1280x720-pair0-cold.png)
and [1440 native room](safari-2026-11-26T23-44-24-725Z/1440x900-pair0-cold.png)
shows Safari chrome, composed R01 artwork, both actors, props, readable caption and
contained compact controls. No blank surface or overlay corruption was observed.
The stage is1268×578.796875 and1428×766 respectively. Raw sample fields
`surfaceReviewRequired:true`/`nativeSurfaceAccepted:false` are capture-time flags;
they remain unchanged. This separate actual inspection supplies the visual review.

## Cache, bytes and failures

Every pair's response log contains18 distinct code/model/image asset URLs, each
requested once across cold and warm workloads. All completed warm asset timings
have zero transfer. Safari also reports their cached encodedBodySize as zero:
the warm19,143-byte completed-body figure is therefore not the entity size of the
whole room. Cold completed transferSize was3,115,845bytes; warm was19,743bytes.
Full cold/warm logged advertised bodies total3,128,688–3,128,784bytes, including
the96-byte background-test page when used. Advertised body counts are not wire-byte
measurements. All33 frozen dist manifest hashes match in all six origins.

No audio or API response record appears in these Safari workloads. Scripted DOM
activation does not establish trusted audio playback, audio cache reuse or service
availability. No cause is inferred from the missing requests. As an independent
size bound, the entire frozen33-file dist is4,991,027 advertised bytes with gzip
for compressible files and all12 MP3s counted at original size; adding probe and
HTML injection gives5,009,675bytes, still below the15MiB room budget. This bound
does not claim those audio files were loaded or heard in Safari.

Each measured origin retains one favicon404. There were no aborted response records,
scene-asset HTTP errors, page errors or server errors in these native runs. Earlier
Firefox session503/range cancellations and all failed native attempts remain in
their original sealed evidence; none are erased or transferred to this run. The
first offline native aggregation failed because min consumed a generator before
max; its [failure record](native-audit-first-attempt.json) is retained. Materializing
the values fixed aggregation without a browser rerun or raw-data change.

## Disposal, background return and acceptance scope

Sixty R01/R02 round trips return to940 buffers,275 vertex arrays and one program
in R01. Reusable renderers retain12 textures/six framebuffers after both rooms.
Text mode releases buffers/arrays/programs to zero. Actual WebGL context loss
removes the canvas; the visible Retry control restores R01 rendering and the same
ownership counts. New Adventure resets to940 buffers,275 arrays, one program,
seven textures and three framebuffers. These bounded API counts do not establish
whole-episode leak freedom or physical GPU-memory use.

The inherited case-sensitive whole-body `lost.text` predicate remains false in
all12 samples. It checks lowercase `power` and `link`, not actionable control
access; no semantic-fallback PASS is inferred. Actual semantic context-loss access
is covered separately by final077's joined66/66 test,
`real WebGL loss preserves text actions and retry restores the same state`, which
uses actual context loss, keyboard Link indication, retained Power/Link observations
and Retry/Text/Low recovery. See the [earlier detailed scope](measurement-results.md).

Two actual native tab switches, without a document.hidden override, paused rendering:
hidden render counts stayed61→61 and60→60 from250ms to1500ms. Returning resumed
counts75→150 and74→149. Safari's tab bar temporarily changed the hidden viewport
to1440×862; it returned to1440×900. This happened after the timed samples and is
recorded separately, not substituted for the required viewport. Task windows7747
and7759 closed successfully with zero pending fixture requests. Owner previews stayed open.

Proposed coordinator disposition: accept this scoped native benchmark/inspection
evidence together with the existing twelve Firefox samples, genuine source reopening,
accepted unchanged media and corrected-screen owner approval for T067 review.
Aggregate G0–G7 decisions, real provider/HTTPS-host acceptance, full media quantities,
whole-episode play and release remain separate. No deployment or final episode
acceptance is claimed.
