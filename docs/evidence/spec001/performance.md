# Spec001 performance on the reference Mac

On November 28, 2026, three measurements failed the episode budgets. Two of twelve startup attempts stayed on the title screen past 15 seconds. The moving apprentice in the Echo Cavern (R04) reached 16.93–18.66 distinct floor positions per second against a 30 FPS target. Eleven of twenty simultaneous initial saves returned HTTP 503. The Shell Market (R09) with the Single-Mode Unicorn and Multimode Hydra was the heaviest measured scene by triangle count. Its 143,324 visible triangles and 120.0 FPS met the geometric and rendering targets. T155 owns the corrections and their retests. [Acceptance targets](../../../SPEC.md#compatibility-and-provisional-performance-budgets) · [Full measurement profile](measurement-profile.md)

| Measure | Observed on the candidate | Result |
| --- | --- | --- |
| Cold title/shell ≤5 MiB compressed | 699,646 bytes of HTML, JavaScript and CSS. Including the 93-byte session response gives 699,739 bytes. | Pass |
| Cold first room ≤15 MiB total compressed | 4,100,073 bytes through settled R01, including 744,708 bytes of ambience, effect and voice after the player's gesture. The joined build used 4,100,094 bytes. | Pass on completed cold starts |
| First room ready ≤12 s at 20 Mb/s, 50 ms | Five of six cold attempts rendered R01 in 3.432–3.554 s. One cold and one warm attempt stayed on the title. | Fail |
| Ordinary exploration ≥30 FPS | Eleven solo rooms averaged 120.0–122.0 actual renders/s in the two reference viewports. R04 displayed 12.0 compositions/s solo and 9.67 with two optical allies. Separate tests isolated movement below. | Fail in R04 |
| ≤500,000 visible triangles | 116,362 in the solo Workshop (R02). Two earned allies raised R09 to 143,324, the highest configuration sampled. | Pass |
| ≤128 MiB estimated scene textures | R04 reached 23,917,392 bytes (22.81 MiB) across its three image planes, four sprite atlases and observed live WebGL texture allocations. | Pass on the recorded configurations |
| Dispose old room assets and bound loading | Every one of 24 solo room-to-text transitions released all measured room image URLs, buffers, programs and vertex arrays. Seven texture and three framebuffer handles remained with a reusable renderer. | Bounded across 12 rooms and revisits |
| Save response p95 <2 s at 20 mixed sessions | Local p95 453.059 ms across all 80 saves, including errors. Of 260 requests, 11 initial saves failed and four subsequent reads returned 404. | Latency below target. Local reliability failed. Staging trial pending. |

## Build and reference conditions

The primary build used public commit `96aebe4701944f02b27f06434d529ddf1a4fb746` plus the six reviewed T151 runtime files and the T152 epilogue group role. The input manifest binds 631 source/export inputs by SHA-256. A separate manifest binds the 440 Vite distribution files. The supplementary party run used the joined T152 stylesheet and application changes, including the two accessible instrument names. It reused the hashed room media. Native Firefox 159.0, Playwright revision 1572, ran headless on Mac16,7, Apple M4 Pro, 14 logical CPUs, 48 GiB RAM, macOS 26.6.2 (25G83), on AC power. Firefox reported WebGL 2.0 and the renderer string “Apple M1, or similar”. Both CSS viewports used DPR 1, default detail and no reduced-motion preference. [Candidate inputs](performance/t154/candidate.json) · [Distribution](performance/t154/distribution.json) · [Joined changes](performance/t154/joined-delta.json) · [Runtime and harness digests](performance/t154/profile.json)

The two definitive room sweeps ran 12:22–12:25 UTC, followed by the six cold/warm pairs and the joined worst-party run through 12:27 UTC. The coordinator paused other native suites and VM decompression for this interval. The one-minute system load reported during the room sweeps ranged from 2.62 to 6.31. Ordinary macOS activity continued, with no CPU, GPU or thermal isolation. The earlier shared-machine trial and the isolated PHP load trial used the same Mac with background workers active. [Shared trial](performance/t154/shared-trial.ndjson) · [Definitive room samples](performance/t154/all-rooms.ndjson)

The loopback HTTPS fixture served the original production HTML, JS and media. Playwright installed the measurement probe before page code in a disposable Firefox profile. Its FIFO writer shared 2,500,000 bytes/s across all streams and delayed headers by 50 ms. The single-stream/four-stream aggregate calibration was 19.996/20.003 Mb/s for the room sweeps, 20.002/20.006 for cold/warm and 19.963/19.857 for the party run. Observed calibration header delays ranged from 51.71 to 63.01 ms. The fixture used real TLS with isolated NSS trust and HTTP/1.1. DNS, upload and TCP/TLS handshake latency on a physical WAN, production caching and host capacity remain unmeasured. [Paced response server](../../../tools/measurement/t067-frame-server.ts) · [Cold/warm control rows](performance/t154/cold-warm.ndjson)

## Startup and caching

Each pair used a fresh Firefox process/profile. Within the pair a second real navigation reused the same origin and cache. All pairs shared the frozen fixture origin, with separate trust-only profiles and empty browser caches. OS files and shader caches stayed warm. Time starts at navigation, includes locating and clicking New Adventure, and ends at the first rendered R01 canvas. A subsequent network-idle observation includes remaining room requests. Server body counts measure transmitted encoded entities. A completed resource retained in the browser cache can still have an encoded body size in Resource Timing. [Per-attempt timings and waterfall](performance/t154/cold-warm.ndjson) · [Timeout request lists](performance/t154/title-timeouts.json)

| Viewport | Pair | Cold ready | Warm ready | Cold / warm body bytes served through settled R01 |
| --- | ---: | ---: | ---: | ---: |
| 1280 × 720 | 1 | 3.545 s | 1.407 s | 4,100,073 / 586 |
| 1280 × 720 | 2 | >15 s, stayed on title | 3.599 s | Title only 699,739 / 3,400,920 |
| 1280 × 720 | 3 | 3.554 s | 1.390 s | 4,100,073 / 586 |
| 1440 × 900 | 1 | 3.432 s | 1.440 s | 4,100,073 / 586 |
| 1440 × 900 | 2 | 3.549 s | 1.350 s | 4,100,073 / 586 |
| 1440 × 900 | 3 | 3.552 s | >15 s, stayed on title | 4,100,073 / title only 586 |

The second 1280 warm attempt already had the shell cached. Its failed cold predecessor had fetched no room assets. The other completed warm loads needed only HTML and the session response. Each completed cold start had 24 server requests including an empty favicon 404 and the static fixture's HTTP 503 guest-session check. The joined T152 cold spot check reached the title at 1.594 s and R01 at 3.559 s. [Joined native party and startup run](performance/t154/party.ndjson)

An untimed pointer control reproduced a title layout shift. At 1280 × 720, the player pressed at the center of New Adventure, y=401. When the pending guest-session request returned 503, the button moved 31.2 CSS px upward, from y=379.68–423.68 to y=348.48–392.48. The browser delivered pointerup and click to the enclosing menu. The title remained until a second click at y=370 launched R01. A click completed before the response launched R01 on its first attempt. This demonstrates a mechanism consistent with the two natural timeouts. Those timed samples did not instrument the real pointer target. Two earlier diagnostic attempts timed out while waiting on a cancelled session response and a hidden button's bounds. The corrected control retains all event targets and rectangles. [Pointer events and geometry](performance/t154/title-control.json) · [Initial control](performance/t154/title-control-initial.json) · [Intermediate control](performance/t154/title-control-intermediate.json) · [Diagnostic driver](../../../tools/measurement/t154-title.mjs)

## Ordinary exploration, frame intervals and room ownership

One continuous guest journey per viewport visited every room, solved all three branches with actual measurements, finished the permanent repair and returned to free exploration in R12. In each room the guest used Walk to the registered safe floor, closed the scene panel and exposed the active stage for a three-second observation. A mutation observer measured actual renderer/compositor updates. A separate rAF/GL probe counted display callbacks and draw submissions. Full rows retain interval arrays, texture allocations in bytes, scene state, decode intervals and GL create/delete/context-loss counters. All measured stages were visible with zero active dialogues or dropped instrumentation samples. [Native route](../../../tools/measurement/t154-route.mjs) · [Measurement driver](../../../tools/measurement/t154-browser.mjs) · [All-room observations](performance/t154/all-rooms.ndjson)

| Room | Solo triangles / draw calls | Actual FPS 1280 / 1440 | Actual render interval p95, ms 1280 / 1440 | Estimated textures, MiB |
| --- | ---: | ---: | ---: | ---: |
| R01 Arrival Lift | 70,716 / 275 | 120.0 / 120.0 | 9 / 10 | 18.13 |
| R02 Titan's Workshop | 116,362 / 323 | 120.0 / 121.3 | 9 / 9 | 16.73 |
| R03 Copper Warrens | 78,954 / 272 | 120.0 / 122.0 | 9 / 9 | 16.73 |
| R04 Echo Cavern | 512 / 40 to bake the static architecture | 12.0 / 12.0 | 235 / 187 | 22.81 |
| R05 Photon Gardens | 88,688 / 313 | 120.3 / 120.4 | 9 / 9 | 16.73 |
| R06 Prism Vault | 62,148 / 264 | 120.3 / 120.0 | 9 / 9 | 16.73 |
| R07 Skywell | 67,492 / 245 | 120.3 / 120.3 | 9 / 10 | 16.73 |
| R08 Storm Observatory | 81,951 / 280 | 120.3 / 120.3 | 9 / 10 | 16.73 |
| R09 Shell Market | 109,870 / 340 | 120.3 / 120.3 | 10 / 9 | 16.73 |
| R10 Clockworks | 80,520 / 284 | 120.4 / 120.0 | 9 / 9 | 16.73 |
| R11 Backhoe Rift | 80,290 / 259 | 120.3 / 120.3 | 10 / 9 | 16.73 |
| R12 Iron Threshold | 89,094 / 300 | 120.0 / 120.4 | 9 / 9 | 16.73 |

R04's authored cells can remain still between changes. To test the moving apprentice separately, each viewport made four alternating trips between the registered floor coordinates (4.7, 0, 4.4) and (5, 0, 3). The driver recorded the foot position, cell and elapsed time from each trusted click through arrival. At 1280 the four trips each displayed 15 position changes in 804–841 ms (17.84–18.66/s). At 1440 they displayed 14–15 changes in 818–843 ms (16.93–18.32/s). Each trip displayed 10–12 different clip cells, with the largest gap between position updates measuring 91 ms. The solo scene's display callbacks continued at 118.7–119.7/s. The sparse position updates make traversal the T155 target. The other rooms' definitive solo windows had no render interval longer than 33 ms. Their shared-machine preflight included isolated stalls, including an R01 interval of 141 ms. [Floor-position and cell traces](performance/t154/all-rooms.ndjson) · [Shared-machine samples](performance/t154/shared-trial.ndjson)

The earlier media ledger identified the optical party as R09's highest observed geometry configuration. The joined guest earned the two recruits through the normal fiber investigation, invited and activated both, then used the Market and Cavern floors. R09 drew 143,324 triangles in 405 calls at 120.0 FPS. The two allies added 538,764 decoded model bytes. R04 with both allies composed 29 times in three seconds. Its architecture plate is baked once. The two optional actors are submitted to the offscreen renderer during sprite composition. The retained independent asset audit gives up to 33,962 staged triangles for previously exercised R04 party sets. [Prior room ledger](media-audit/room-budgets.json) · [Joined candidate party samples](performance/t154/party.ndjson) · [Party driver](../../../tools/measurement/t154-party.mjs)

Texture estimates combine decoded plane/atlas dimensions at four bytes/pixel, additional room images and observed WebGL level allocations. Model vertex/index buffers, browser-owned compositor surfaces, audio and physical GPU memory are separate. The visible, offscreen and baked R04 color surfaces are each 1024 × 576; three RGBA color planes at that size would add 6.75 MiB before any driver depth/stencil, multisampling or double buffering. Per-room image release was observed through object-URL revocation, scene detachment and live GL handles. All 24 text transitions reached zero live image URLs, buffers, vertex arrays, programs, shaders and renderbuffers, and every room rendered again. Seven reusable WebGL textures and three framebuffers remained bounded across this sweep. Driver reclamation and browser cache eviction were outside the probes. Both routes also retained 115 image-decode results each. [Room resources and resets](performance/t154/all-rooms.ndjson)

Firefox recorded five media transport events at 1280 and seven at 1440 across the complete route, with `NS_BINDING_ABORTED` or `NS_ERROR_PARSED_DATA_CACHED` on audio paths. Both journeys completed, with the fixture session 503 and favicon 404 recorded separately. The earlier shared trial also captured two instrumentation errors when the historical reporting probe ran in a blank document. Installing that probe only on the owned HTTPS document removed those two page errors from the definitive runs. [Full route requests and failures](performance/t154/all-rooms.ndjson) · [Earlier shared trial](performance/t154/shared-trial.ndjson)

## Twenty simultaneous sessions

The unchanged `tools/measure-save-load.php` ran against the actual PHP 8.4.28 public entry and SQLite 3.54.1 with 20 synthetic accounts, twenty forked CLI workers plus their request-serving master and a single verified HTTPS loopback proxy. There were 20 simultaneous first saves followed by twelve rounds of five each of saves, reads, session checks and preference updates, one second between completed rounds. The database used DELETE journaling, FULL synchronization and a 250 ms busy timeout. It checked payloads, acknowledgements and revisions without retrying failures. All 260 measurements and cleanup survived, including connection, TLS, first-byte and total times. [Service observations and source hashes](performance/t154/save-mixed.ndjson) · [Load driver](../../../tools/measure-save-load.php)

| Phase | Requests / saves | All-request p95 | Save p95 | Failures |
| --- | ---: | ---: | ---: | --- |
| Initial and mixed | 260 / 80 | 299.409 ms | 453.059 ms | 11 initial 503 and 4 read 404 |
| Mixed only | 240 / 60 | 116.559 ms | 114.177 ms | 4 read 404 |

Nine of the initial saves succeeded. Eleven returned `unavailable`. Four of those sessions' first mixed operations were reads and returned `save-not-found` before those accounts had any successful save. Those eleven sessions eventually received 201 on a later write; 49 other mixed writes replaced an existing slot with 200. The slowest save took 564.806 ms. Each p95 includes fast failures and slow successes. The local run supplies no direct lock-wait breakdown, host-worker limit or staging acceptance. [Every response and the twenty-way summary](performance/t154/save-mixed.ndjson)

## Reproduction

Use the pinned paths in the runtime record. Build the candidate in a fresh directory from the source manifest, then point the harness at that Vite output. Run each command with a new output directory under ignored local storage. Set `NQ_PHP_BIN` to the pinned PHP executable for the disposable TLS fixture. Browser drivers provision their own trust, servers, guests and profiles and close them on exit. The save driver creates a separate synthetic database and deletion ledger. [Runtime setup](runtime.md) · [Original measurement protocol](measurement-profile.md)

```sh
node tools/measurement/t154-browser.mjs path/to/dist .local/cold-new cold
node tools/measurement/t154-browser.mjs path/to/dist .local/rooms-new rooms
node tools/measurement/t154-party.mjs path/to/joined-dist .local/party-new
node tools/measurement/t154-title.mjs path/to/dist .local/title-new
"$NQ_PHP_BIN" -d auto_prepend_file= -d auto_append_file= tools/measure-save-load.php
```

## T155 retest on the reference Mac

The title and Echo Cavern fixes were tested first on the joined T151/T152 client and then on the normal production build with T156 credits. The title menu has a fixed vertical anchor while status text grows below its native controls. A resolved account name also appears below those controls. The save and identity controllers still evaluate the current account state when the browser dispatches the click. Echo Cavern now requests display frames while the apprentice moves or a recruited ally has a playing idle animation. Its native sprite cells still follow the authored 24 Hz timeline. A stationary solo room sleeps until the next authored cell. Hiding or disposing the room cancels both the outstanding animation frame and the cell timer. The same room geometry, atlases and textures appear in both measurements. [Frozen source and distribution hashes](performance/t155/candidate.json)

The second T155 freeze includes the repository tsconfig.json and the joined T156 credits. The pinned npm run build completed typechecking, the save-policy comparison and Vite production packaging. All 442 output hashes matched T156's independently built distribution. The browser loaded index-Bgxkwj9F.js, index-Cm-uP8ui.css and sprite-room-MmC28I2s.js. The probes used native Firefox 159.0 on the same M4 Pro Mac with DPR 1, default detail, true loopback TLS, 20 Mb/s shared bandwidth and 50 ms header delay. The twelve-room one-minute load averages ranged from 6.62 to 7.94 while other scheduled native suites and VM work were paused. The rooms, startup and party runs all passed their own single- and four-stream calibration. [Normal production inputs and all 442 output hashes](performance/t155/production.json) · [Calibrations and summary](performance/t155/production-summary.json)

| Measured production path | Result on the reference Mac |
| --- | --- |
| Startup at 1280 × 720 and 1440 × 900 | All six cold and six warm attempts reached the first rendered R01 on the first native activation. Cold 3.608–3.750 s, warm 1.512–1.626 s. Shell HTML/JS/CSS transferred 700,578 compressed body bytes. Settled cold R01 used 4,101,005 bytes including triggered audio. |
| Active solo R04 walking | Eight trips changed the apprentice's world position 95–100 times in 798–809 ms, or 119.05–124.69 positions/s. Each trip retained 11 distinct authored cells through arrival. |
| Ordinary exploration | R04's three-second samples including settled cel holds averaged 37.67 / 39.00 compositions/s at 1280 / 1440. R04 with two animated optical allies averaged 120.33/s. The other eleven solo rooms ranged from 119.96 to 124.67 rendered frames/s. |
| Geometry and textures | R09 plus the two earned optical allies submitted 143,324 triangles in 405 draws at 120.00 FPS. Maximum estimated room texture residency was 23,917,392 bytes (22.81 MiB) in R04. |
| Disposal and recovery | All 24 solo room-to-text transitions released their image object URLs, buffers, programs and vertex arrays. Seven reusable textures and three framebuffers remained. Every room rendered again after Retry visual scene. Both complete guest journeys reached R12. |

The startup rows retain both the static fixture's unavailable account check and the empty favicon response. The continuing journeys also recorded four audio requests at 1280 and five at 1440 reported as NS_BINDING_ABORTED or NS_ERROR_PARSED_DATA_CACHED. The raw rows retain every event. Each room measurement distinguishes observed drawing from display callbacks. The world-coordinate counts above describe motion in the authored projection. A second native pixel-level check appears below. [Cold and warm rows](performance/t155/production-cold.ndjson) · [All-room and stride traces](performance/t155/production-rooms.ndjson) · [Earned party traces](performance/t155/production-party.ndjson)

### Input, movement and recovery controls

At 1280 × 720, New Adventure occupied y=297.37–341.37 CSS pixels before and after the held guest check returned HTTP 503. The same trusted pointerdown, pointerup and click reached the button. Both the pre-settlement and the straddling first actions reached R01. A separate 390-pixel Firefox test released the pointer after a synthetic authenticated session with a wrapping display name arrived. Continue became available and the first release opened the account confirmation. Cancel returned to the title. [Production title geometry and native events](performance/t155/production-title.json) · [Account confirmation test](../../../tests/e2e/title.spec.ts)

A separate native Chrome 159.0.8154.6 control recorded actual canvas drawImage destinations for the apprentice's atlas. Integer destination pixels changed 51.03 and 49.75 times per second on opposite walks. A real background tab froze the in-flight walk for one second and resumed it on returning to the game. Reduced motion moved the apprentice directly to either registered stop, kept the cell at idle@0 and scheduled no further draws during the 900 ms observation. Switching to text detached the old canvas, whose draw count and foot position stayed fixed for a further 900 ms. Retry rebuilt the stage with reduced motion still active. The native control observed zero JavaScript errors and zero writes. [Actual pixel and tab observations](performance/t155/production-motion.json) · [Measurement driver](../../../tools/measurement/t155-motion.mjs)


### Simultaneous first saves and private storage

Two independent service failures appeared in disposable PHP copies. The first occurred in the rollback-journal check. Four ordinary 260-request profiling runs retained five HTTP 503 responses. All five originated in the private sidecar metadata check. For the three captured with detailed metadata, APFS returned an inode for a regular mode-0600 rollback journal with the expected owner and zero directory links. SQLite was deleting the journal at commit. In the corrected instrumented copy, two observations of this exact state were both followed by an absent pathname on a fresh lookup. The production service now rechecks the name once in that case and applies its existing type, owner, mode and single-link checks to anything it finds. The database, WAL, SHM, persistent hard links and symbolic links still take the ordinary validation path. Native filesystem tests exercised hard-linked, symbolic, directory and world-readable names. The ownership comparison was tested with an intentionally different expected UID on an owned test file. [Recorded exceptions](performance/t155/errors.ndjson) · [Original inode observations](performance/t155/sidecars.ndjson) · [Corrected lookups](performance/t155/service/observed-rechecks.ndjson)

The second failure occurred at the external deletion-recovery lock. The first four ordinary diagnostic runs all admitted twenty initial saves. In three of those runs, 2,037 measured successful barrier acquisitions had a maximum wait of 96.590 ms. Separate shared-machine controls increased contention across independently provisioned fixtures. Each fixture retained its own database, ledger and twenty simultaneous native HTTPS clients. With six fixtures starting their first saves together, four initial saves in two fixtures timed out at the 250 ms exclusive flock deadline. The fixed-location traces identify three save repository calls and one ledger-open check. A later read for one of those same synthetic sessions returned 404 before its first successful write. The original T154 responses exposed only the public error code, so the exact exception for each historical row remains unknown. [Original 20-way load](performance/t154/save-mixed.ndjson) · [Pressure control events and waits](performance/t155/service/pressure-observations.json) · [Pre-fix responses](performance/t155/service/crowd.ndjson)

The exclusive lock now allows a bounded 750 ms wait. Acquisition order, storage validation during each wait, deletion reconciliation, non-reentrancy, transaction authorization, receipt ordering and one-slot conditional writes follow the existing paths. SQLite retains DELETE journaling, FULL synchronization and its 250 ms busy timeout. Repeating the synchronized six-fixture profile produced 360 valid responses. One successful barrier acquisition waited 286.275 ms. The six save p95 values ranged from 494.543 to 640.907 ms. A separate held-lock test verified expiration between 750 ms and two seconds, no protected callback execution during contention, and operation after release. [Fixed pressure responses](performance/t155/service/crowd-fixed.ndjson) · [Private file checks](../../../server/tests/DatabaseTest.php) · [Held-lock tests](../../../server/tests/DeletionLedgerTest.php)

| Final uninstrumented local profile | All requests | Save responses | All-request p95 | Save p95 | Slowest save | Invalid or failed operations |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 260 | 80 | 120.613 ms | 148.971 ms | 181.527 ms | 0 |
| 2 | 260 | 80 | 130.734 ms | 172.177 ms | 502.359 ms | 0 |
| 3 | 260 | 80 | 108.658 ms | 139.963 ms | 163.754 ms | 0 |

Each profile used twenty fresh synthetic accounts, twenty simultaneous initial saves, then twelve mixed rounds through the actual local PHP public entry. The unchanged driver verified all 60 initial revision-one acknowledgements and all 720 mixed responses, including snapshot/metadata values. There were no client retries. Twenty-way negative controls retained the expected HTTP 403 on a missing CSRF token and curl error 60 on an untrusted certificate. Positive and negative fixtures removed their private storage. The full PHP suite passed 910 cases and 19,175 assertions. Staging latency, worker limits and real provider acceptance require their separate evidence. [Trial 1](performance/t155/service/save-1.ndjson) · [Trial 2](performance/t155/service/save-2.ndjson) · [Trial 3](performance/t155/service/save-3.ndjson) · [Negative controls](performance/t155/service/save-negative.ndjson)

### Earlier T155 measurements

The first 440-file browser build used the T151/T152 source with the T155 changes and the default TypeScript transform in Vite. Its source snapshot omitted tsconfig.json. A first attempt at the full build command also lacked its policy generator. The Vite-only build supplied native evidence on those exact bytes. All 12 startup attempts succeeded, eight ordinary R04 traversals reached roughly 120 distinct world positions/s, and R04 with both animated optical allies reached 120.67 compositions/s. All 24 text transitions released the measured room-owned objects. The production run above uses the repository compiler options and the joined credits. [Earlier input hashes](performance/t155/candidate.json) · [Earlier cold/warm rows](performance/t155/cold-warm.ndjson) · [Earlier all-room rows](performance/t155/all-rooms.ndjson) · [Earlier party](performance/t155/party.ndjson) · [Earlier title](performance/t155/title-control.json) · [Earlier pixel observations](performance/t155/pixel-motion.json)

Three preliminary diagnostic fixture setup attempts stopped before serving a request. One required the bundled ledger migration, and two recorded the missing loopback proxy import. Four subsequent baseline profiles retained all responses, including the five sidecar exceptions. Three unsynchronized and four synchronized independent fixtures further characterized ordinary contention before the six-fixture reproduction. Three full profiles against the journal-only correction passed on this Mac before the separate cold-lock correction. All synthetic controls used disposable local data and the public entry kept its fixed external error responses. [Setup and trial ledger](performance/t155/service/setup-and-initial-trials.json) · [Four baseline trials](performance/t155/) · [Unsynchronized pressure samples](performance/t155/service/pressure.ndjson) · [Four simultaneous fixtures](performance/t155/service/synced.ndjson) · [Intermediate save and negative-control trials](performance/t155/service/)

To repeat the production browser results, use the recorded pinned Node/PHP/NSS paths, run the normal build, then supply a fresh output directory to each existing driver. The Chrome control builds from the current directory and writes a new result file. The canonical save timing command under T154 reproduction uses the same local, twenty-way protocol. [Pinned tools](runtime.md)

```sh
npm run build
node tools/measurement/t154-browser.mjs dist .local/t155-rerun-rooms rooms
node tools/measurement/t154-browser.mjs dist .local/t155-rerun-cold cold
node tools/measurement/t154-party.mjs dist .local/t155-rerun-party
node tools/measurement/t154-title.mjs dist .local/t155-rerun-title
node tools/measurement/t155-motion.mjs .local/t155-rerun-motion.json
```
