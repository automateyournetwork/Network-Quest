# T059 local measurement harness and profile

Date: 2026-11-26. Worker: loop063/T059. Scope: C14/C15, FR-022,
AC15, W04/W08 preparation. This implements measurement tools on the current
graybox and isolated synthetic service. **It does not freeze G3 hardware,
accept finished media, establish host capacity, or pass G2/G3/AC15/T154.**

## Reproduce

From the repository root, with the existing dependencies and a coordinator-held
browser/build slot:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" \
NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php \
node tools/measure-browser.ts

/opt/homebrew/opt/php@8.4/bin/php -d auto_prepend_file= -d auto_append_file= \
tools/measure-save-load.php
```

The browser tool requires an existing `dist/`; it never builds, installs or
deploys. It records every file's size/hash in a dist manifest. The currently
served build may differ from working source; the manifest is the authority for
what was measured. No npm script or shared application instrumentation was added.
The save tool writes NDJSON to stdout and independently retains every row in a
new `.local/measurements/save-*.ndjson`. The browser writes a new
`.local/measurements/browser-*/samples.ndjson`. Keep all rows, including failures.
Neither CLI accepts a URL, existing database, production configuration or output
path. All accounts, sessions, SQLite and TLS material are synthetic and owned.

The narrow verification commands are `node node_modules/vitest/vitest.mjs run
tests/tools/measurement.test.ts` with pinned PATH and the pinned PHP PHPUnit
runner with `server/tests/MeasurementHarnessTest.php`. No new Playwright spec
discovery entry is needed; the browser tool uses Playwright directly.

## Recorded device and conditions

| Field | Observed profile |
| --- | --- |
| Device | Mac16,7, Apple M4 Pro; 14 logical CPUs; 51,539,607,552 bytes RAM (48 GiB) |
| OS | macOS 26.6.2, build 25G83; Darwin 25.6.0; arm64 |
| Disk observation | 926 GiB volume; 705 GiB used; 199 GiB available (`df -h`, rounded) |
| Runtime | Node 26.13.1; PHP 8.4.28; SQLite 3.54.1; curl 8.23.0 / OpenSSL 4.1.0 |
| Browser | Installed Playwright Firefox, headless; actual version/UA in each completed sample. UA is not evidence of host OS. Actual Safari/Chromium/mobile acceptance remains unrun. |
| Viewports | 1280×720 and 1440×900, device scale factor 1, no-preference reduced motion |
| Network | Loopback 127.0.0.1; verified disposable certificate/hostname; HTTP/1.1; **no network shaping** or claim of 20 Mb/s/50 ms |
| Machine load | Shared development Mac; no CPU isolation, power/thermal pinning or background-process suppression. Native browser and build ownership is serialized. |

## Browser procedure and interpretation

Default: three independent cold/warm pairs at each viewport (12 sample rows).
Each cold sample launches a fresh Firefox process and a copied trust-only NSS
profile. Warm uses normal same-origin navigation in that same process/profile;
the measured resource entries establish actual cache reuse. The fixture serves
the exact `dist/` with generated gzip, immutable hashed assets, no-cache HTML
and no-store unavailable account responses. This is a declared test cache policy,
not the production host policy. HTTPS trust is never bypassed.
Cold means a fresh browser cache; OS file caches and driver shader caches are
not reset. Resource timing cannot isolate future image/GLTF decode cost; this
graybox has no authored image/GLTF downloads.

The first-room readiness interval starts at navigation, includes the scripted
New Adventure click, and ends when R01 reports its first actual render. The
shell interval ends when New Adventure is available. Resource Timing retains
the navigation/request waterfall, protocol, encoded body, decoded body and
transfer sizes. Encoded bytes describe compressed entity bodies; transfer bytes
also include browser-reported overhead. Cached-body and transfer bytes are
separate. Page errors, request failures and every HTTP failure remain explicit.
The static fixture's session 503 is recorded even though guest play remains usable.

Each room has a three-second rAF sampling window. **Display rAF cadence is not
game FPS.** The current graybox renders on changes, with no continuous animation;
the report separately counts intervals containing WebGL draw submissions. It
records all interval values and nearest-rank median/p95, visibility changes and
dropped instrumentation samples. This cannot establish 30 FPS for final scenes
or GPU execution time.

Five R01/R02 cycles retain per-cycle triangle/draw-call/renderer counts and WebGL
create/delete/live-handle counts, followed by text mode, low detail and a new
adventure. Context-loss releases are distinct from explicit delete calls.
Instrumentation observes API ownership and adds overhead; it does not prove
driver memory reclamation. **Texture residency bytes and GPU bytes remain null**
because the renderer exposes counts, not byte accounting. G3 must add reviewed
texture estimates before comparing its 128 MiB target; null is never zero.

## Native twenty-session procedure

Twenty distinct accounts and actual authenticated sessions share newly allocated
SQLite and the actual deletion barrier. One disposable verified HTTPS origin
proxies to the real public PHP entry. PHP's CLI server has twenty forked workers
plus its request-serving master. This is a local transport/concurrency fixture,
not GoDaddy's web-server process model or provider authentication.

Twenty simultaneous initial saves record cold connections and 201 responses.
Then twelve rounds each offer twenty concurrent requests: five saves, five
loads, five session reads and five preference updates, rotating so each session
performs every operation. The tool waits for all responses then one second
before the next round. There are 260 measured requests, including 80 saves.
Every save acknowledgement and revision, loaded snapshot, session state and
preference revision is checked against the synthetic workload. Initial 201 and
replacement 200 statuses are distinguished. No automatic retry hides failures.

Total HTTPS response latency includes connection/TLS establishment where needed,
proxy/admission/validation/database/lock work and response transfer. Per-request
connect, TLS-ready, first-byte, total, offered/completed timestamps and byte
counts are retained. Clients have a ten-second timeout; the existing proxy's
upstream timeout is two seconds. SQLite uses DELETE journal, FULL synchronous
and a 250 ms busy timeout. Success waits are not isolated lock-wait measurements;
an unavailable 503 alone does not identify its cause.

All-request and save-only p95 use nearest rank over **all** observed durations,
including fast errors and timeouts. Error counts must also be zero before the
local threshold flag can be true; staging acceptance is always false. Serialized
twenty-session protocol controls are explicitly `maxInFlight:1` and cannot pass
the twenty-way flag. Default CLI remains `maxInFlight:20`.

## Preserved failures and corrections

| Attempt | Observed result and disposition |
| --- | --- |
| Test-first import checks | Vitest module missing; PHPUnit required tool missing. Preserved RED before implementation. |
| First native fixture | GitHub subject CHECK rejected a nonnumeric synthetic subject; changed to numeric synthetic IDs. No provider request. |
| TLS negative control | Undefined PHP constant corrected; null CA produced curl77 because its default file was unusable. Explicit installed public CA now yields curl60 against the disposable certificate, with peer/hostname verification still enabled. |
| First browser smoke | Four samples (both viewports, cold/warm) timed out on the invented “The Crimping Workshop” label. Correct label is “The Titan's Workshop”. All four timeout rows, response503 rows and cleanup are retained in the first browser NDJSON. |
| Coordinator status review | Initial save201 was incorrectly counted as failure and its revision was not tracked. Corrected operation-specific statuses and added exact revision/body checks plus a complete positive protocol control. Earlier broad negative assertions were insufficient. |
| Concurrent positive control | One run reported one failure before durable per-run logging existed; its status/timing cannot be reconstructed and is not invented. A subsequent persisted run retained four503s; another run had zero. The no-error concurrency assertion was replaced by explicit outcome accounting, while the default load stayed twenty-way. |
| Interrupted run | Supervisor select was interrupted by TERM, emitting a warning into stdout; the test aborted before cleanup. Three identified synthetic directories remained. After exact filename/config linkage, owner/mode/inode and no-open-descriptor checks, only those directories were removed. The private cleanup manifest records hashes and absence. Suppression is limited to that known supervisor EINTR; subsequent interrupt control records failure and verified cleanup. |

The persisted four503 rows are all `problemCode: unavailable`: initial save
session17, 65.000 ms; round0 save session9, 20.736 ms; round0 preferences
session20, 34.252 ms; round1 read session9, 67.547 ms. These remain failed samples
even if a later service correction removes the cause. No attribution is made
from response duration alone.

## Executed browser baseline

Final default run began at 18:46:26 UTC. **12 completed samples, zero harness
exceptions; all twelve retain two HTTP failures**: session503 at
`/arcade/play/network-quest/api/v1/session` and favicon404 at `/favicon.ico`.
No page error or failed transport request was observed. Those HTTP errors are
not removed to call the sample a performance pass. The three-second room
windows and interaction work total 91.539 seconds of measured sample duration,
excluding browser startup/teardown.

All samples used Firefox **159.0** on the frozen T052 build supplied by loop062:
`assets/index-BCDQD43P.js`, SHA-256
`57ac7b456eafc56b23bf7e331c5d071bfdc9fb1ca9e48aa974eeee1f2eb0071c`.
Its raw size is 1,479,219 bytes; locally generated gzip body is 285,533 bytes.
The complete four-file dist manifest is in the raw artifact, including HTML/CSS
and the build manifest. This is the T052 working build, not a claim that an old
published T050 source commit produced these bytes.

| Viewport | Pair | Cache | Shell ready (ms) | First room ready (ms) | First-room transfer bytes | Retained HTTP failures |
| --- | --- | --- | --- | --- | --- | --- |
| 1280×720 | 0 | Cold | 624 | 701 | 288,975 | 503, 404 |
| 1280×720 | 0 | Warm | 484 | 538 | 1,181 | 503, 404 |
| 1280×720 | 1 | Cold | 540 | 610 | 288,975 | 503, 404 |
| 1280×720 | 1 | Warm | 490 | 548 | 1,181 | 503, 404 |
| 1280×720 | 2 | Cold | 550 | 617 | 288,975 | 503, 404 |
| 1280×720 | 2 | Warm | 488 | 540 | 1,181 | 503, 404 |
| 1440×900 | 0 | Cold | 546 | 618 | 288,975 | 503, 404 |
| 1440×900 | 0 | Warm | 487 | 540 | 1,181 | 503, 404 |
| 1440×900 | 1 | Cold | 542 | 607 | 288,975 | 503, 404 |
| 1440×900 | 1 | Warm | 496 | 548 | 1,181 | 503, 404 |
| 1440×900 | 2 | Cold | 542 | 613 | 288,975 | 503, 404 |
| 1440×900 | 2 | Warm | 486 | 538 | 1,181 | 503, 404 |

Every first-room sample reports 287,475 encoded body bytes and 1,484,465 decoded
body bytes including the 85-byte unavailable API body. Warm JS/CSS transfer is
zero while their encoded-body sizes remain populated from cache. Readiness is
well below 12 s locally, but **no 20 Mb/s/50 ms target was tested**.

The 24 rAF windows have median intervals 8.32–8.34 ms, p95 10.14–10.32 ms and maximum
10.40 ms, with 359–361 intervals per window. Twenty-three windows contain no GL
submission interval; one contains one delayed redraw. All visibility-change
and dropped-sample counters are zero. This is a display-cadence observation,
not a claim of 120 FPS gameplay.

R01 reports 492 triangles/26 draw calls; R02 reports 720/45. Both show two
renderer geometries and one renderer texture; canvas pixels are 820×480 at
1280×720 and 930×480 at 1440×900. Across all 60 recorded room cycles, instrumented
live counts remain eight buffers, five textures, one program, three framebuffers
and two vertex arrays. Text mode leaves zero buffers/programs/vertex arrays,
while five textures/three framebuffers remain with the reusable renderer. New
adventure context loss/disposal returns to the same live counts after the new
scene is rendered. These are distinct renderer/API bookkeeping observations,
not a measured GPU-memory total or full-episode leak guarantee.

## Executed native baseline and verification

The coordinator's full service regression passed **908 tests/19,138 assertions**
in 35.975 seconds/34 MiB before the final baseline. That includes all seven
measurement harness tests (359 assertions), the actual response/body controls,
twenty-way outcome accounting and interruption cleanup. The four focused JS
tests and final typecheck passed. The subsequent browser profile metadata-only
correction interpolates the requested cycle count: earlier smoke text said five
despite its explicit options/one recorded cycle; the default full baseline
actually used five and needs no rerun.

The one final native default trial started at **18:51:14 UTC**, after that
regression and with browser/build/CPU ownership reserved. Database.php was
`a2975a16845635a7f4e2e50d8b8f2386a281cd8b0815b3100e94884153b9caf7`.
All 260 requests returned independently validated responses: twenty initial 201,
then 240 responses 200. No 503, rate-limit, conflict, malformed response or curl
error occurred; all owned storage/process cleanup completed. Sampling duration
was **13.554101209 seconds**, excluding service setup and cleanup.

| Population | Requests | Save requests | All-response p95 / maximum | Save p95 / maximum | Failed samples |
| --- | --- | --- | --- | --- | --- |
| Initial plus mixed | 260 | 80 | 119.670 / 152.046 ms | 134.020 / 152.046 ms | 0 |
| Mixed rounds only | 240 | 60 | 110.093 / 126.678 ms | 108.349 / 122.286 ms | 0 |

This one local profile satisfies its response/latency threshold. It cannot
establish the staging target or the host's process limits. Earlier retained 503s
and the coordinator's independently reproduced journal-stat race remain separate
evidence; a later zero-error run is **not causal proof** that every earlier 503
came from that race. No default concurrency or workload was reduced to obtain
this result. Full media, texture estimates, shaped-network, real Safari, host
staging and owner reviews remain pending.

All persisted native failed request samples, including intended negative
controls, are listed here. Run IDs identify the filenames in the artifact table;
round −1 is the initial save wave. Interrupted runs with zero submitted samples
are listed separately in that table and are never treated as successful trials.

| Run UTC/id suffix | Round | Session | Operation | HTTP / curl code | Duration ms | Meaning |
| --- | --- | --- | --- | --- | --- | --- |
| 18:39:28 / abb791d4ab7e | 0 | 2 | Read | 0 / 60 | 8.840 | Intended untrusted-certificate control |
| 18:39:28 / abb791d4ab7e | 0 | 1 | Save | 403 / 0 | 57.675 | Intended missing-CSRF control |
| 18:39:29 / adde3d607efa | −1 | 17 | Save | 503 / 0 | 65.000 | Unavailable; retained failure |
| 18:39:29 / adde3d607efa | 0 | 9 | Save | 503 / 0 | 20.736 | Unavailable; retained failure |
| 18:39:29 / adde3d607efa | 0 | 20 | Preferences | 503 / 0 | 34.252 | Unavailable; retained failure |
| 18:39:29 / adde3d607efa | 1 | 9 | Read | 503 / 0 | 67.547 | Unavailable; retained failure |
| 18:40:49 / eba469a2f50c | 0 | 1 | Save | 403 / 0 | 3.412 | Intended missing-CSRF control |
| 18:40:49 / eba469a2f50c | 0 | 2 | Read | 0 / 60 | 4.128 | Intended untrusted-certificate control |
| 18:49:54 / 8e7abbd33cbb | 0 | 1 | Save | 403 / 0 | 3.534 | Coordinator regression negative control |
| 18:49:54 / 8e7abbd33cbb | 0 | 2 | Read | 0 / 60 | 4.043 | Coordinator regression negative control |

## Artifact seals

All raw artifacts below are local synthetic development evidence. They retain
the samples and complete metadata; no private production configuration was read.
The public tools reproduce the protocol. Interrupted output remains preserved.

| Artifact | Recorded content | SHA-256 |
| --- | --- | --- |
| `.local/measurements/browser-2026-11-26T18-36-34-817Z-6a7aa491/samples.ndjson` | 4 browser samples; cleanup recorded | `e0532893450c4a70a708d9a723a753d0f9e4569d51603d91d483cadb4d578ff4` |
| `.local/measurements/browser-2026-11-26T18-45-29-420Z-d524dffa/samples.ndjson` | 4 browser samples; cleanup recorded | `7f18c61c934369b41f502d52b183fe80970026d82dd61dcbdec7d1e84575c149` |
| `.local/measurements/browser-2026-11-26T18-46-25-915Z-6236d4da/samples.ndjson` | 12 browser samples; cleanup recorded | `baff478dd3d2b4178614ecd6af53bf5ce0ada7e964069e71348925a7dc87b4ae` |
| `.local/measurements/save-20261126-183928-abb791d4ab7e.ndjson` | 40 native samples; cleanup recorded | `ab5b6d31620e1acc837d02599b2277e04e32ecb1a49432a44837db2b0d2cb89a` |
| `.local/measurements/save-20261126-183929-adde3d607efa.ndjson` | 100 native samples; cleanup recorded | `63f63f2299bd8e9b9927fc568c575f6cdb7ab5c4cab735703e44e3f3fd5c377b` |
| `.local/measurements/save-20261126-184049-096ccd4b9805.ndjson` | 100 native samples; cleanup recorded | `cb784a6d1d993c6e63105975d59235bf65025202f4e80c456ace726610d8c71f` |
| `.local/measurements/save-20261126-184049-eba469a2f50c.ndjson` | 40 native samples; cleanup recorded | `8035971ea8bd2dfc8eaf89754e606a00bc053c5daef0117577a00975e310371d` |
| `.local/measurements/save-20261126-184051-4007e9d5ccf0.ndjson` | 40 native samples; cleanup recorded | `025b71959340ddd55d095d31d8227e66576d8ce96935a59bb95cc9153445f0d4` |
| `.local/measurements/save-20261126-184151-670a696a1899.ndjson` | 0 native samples; interrupted before cleanup; see separate manifest | `6f38985852223b7a068be7d1f0d852dd27fd52e6bf2080e8d825d52fdbcee5ec` |
| `.local/measurements/save-20261126-184217-5144bdface8e.ndjson` | 0 native samples; cleanup recorded | `3c602c30b96dd615054b1c541a4b8bd99113828b2e3014f70dec68d7b1fc57f5` |
| `.local/measurements/save-20261126-184240-bba37b358589.ndjson` | 0 native samples; cleanup recorded | `38a54caf1694076b4dfc04c79ca2f9f1cdd79980f69d0953459810b17058cc0d` |
| `.local/measurements/save-20261126-184954-8e7abbd33cbb.ndjson` | 40 native samples; cleanup recorded | `9f3e6ee78a05736b329d5e7c7a2274dd195b81237a61db7c120c3a0ae63039e7` |
| `.local/measurements/save-20261126-184955-e138546c9ef4.ndjson` | 100 native samples; cleanup recorded | `e9853204da9feda9d8ea51511e4a41689974a8a7d9b1dc812ea9e1af4fc15f94` |
| `.local/measurements/save-20261126-184956-747690795d92.ndjson` | 0 native samples; cleanup recorded | `f231037a4e7df8982f2d219b5517802a885ae7471c78942a49d2d4ef9d665f0d` |
| `.local/measurements/save-20261126-184956-bb223720e9ba.ndjson` | 40 native samples; cleanup recorded | `46e98d30ec4011b404b9ab17f42fae5112bf8531cb2adf5e2214322c5285f9e9` |
| `.local/measurements/save-20261126-185114-bd04c4cdb3d9.ndjson` | 260 native samples; cleanup recorded | `1e115b6e419d6ccca2553231fc48f07dce1579c19c16705ec95387854caddc76` |
| `.local/measurements/interruption-cleanup-184151.json` | Exact orphan-fixture validation/removal record | `62e28f4db11824930d337dc9bdbdf86db7d2bd91f48528d002d0990012e1b106` |
| `.local/full-php-post-journal-fix.log` | Coordinator full PHP regression: 908 / 19,138 PASS | `b29c0d55314c0e97ad43cf05a4e174f9c9749efb0e5f9f43a00737e825371a16` |

The final native stdout copy, `.local/measurements/loop063-native-baseline.stdout.ndjson`,
is byte-identical to `save-20261126-185114-bd04c4cdb3d9.ndjson` (same hash).
The final browser raw profile records tool hash `84fee8ded001254c6abf0b9238df288cd15b3f553427eb9895008506f2754449`;
the later cycle-label-only correction changes the final tool hash, sealed in loop063.
The recorded options and default five-cycle sample arrays remain authoritative.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
