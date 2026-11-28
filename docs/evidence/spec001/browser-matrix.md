# Spec001 desktop browser matrix

**All 32 cells passed on the November 28 release candidate.** Eight actual browser distributions completed all twelve rooms, nine diagnostic measurements, a committed repair, a separate endpoint test, the permanent ending and Continue. The candidate includes the title, sprite and party fixes and the complete Credits panel. Each passing journey recorded 262 actions. An independent coordinator build matched all 442 files. The published commit’s production ledger also matched the tested output path by path. [Candidate file hashes](browser-matrix/credits-candidate.json) · [Per-cell UTC times and results](browser-matrix/release-summary.json) · [Published production ledger at ae84724](https://github.com/automateyournetwork/Network-Quest/blob/ae8472469b5f7d98e939ccb5471b03893630993a/docs/evidence/spec001/performance/t155/production.json)

| Browser tested | 1280 × 720 | 1440 × 900 | 768 × 900 | 390 × 844 |
| --- | --- | --- | --- | --- |
| [Safari 27.2 (21625.2.8.18.4), installed Mac](browser-matrix/release-records/safari-27.json) | Keyboard | Keyboard | Keyboard | Keyboard |
| [Safari 26.6.1 (19624.5.1.18.3), Sonoma guest](browser-matrix/release-records/safari-26.json) | Keyboard | Keyboard | Pointer | Pointer |
| [Google Chrome 158.0.8127.38, installed retail](browser-matrix/release-records/chrome-installed.json) | Keyboard | Keyboard | Pointer | Pointer |
| [Chrome for Testing 157.0.8103.78](browser-matrix/release-records/chromium-157.json) | Keyboard | Keyboard | Pointer | Pointer |
| [Chrome for Testing 158.0.8127.88](browser-matrix/release-records/chromium-158.json) | Keyboard | Keyboard | Pointer | Pointer |
| [Chrome for Testing 159.0.8154.33, early stable](browser-matrix/release-records/chromium-159.json) | Keyboard | Keyboard | Pointer | Pointer |
| [Firefox 160.0.1, Mozilla retail](browser-matrix/release-records/firefox-160.json) | Keyboard | Keyboard | Pointer | Pointer |
| [Firefox 161.0, Mozilla retail](browser-matrix/release-records/firefox-161.json) | Keyboard | Keyboard | Pointer | Pointer |

Each table entry names the input used throughout its passing journey. At both desktop sizes the top-level browser content area and the game viewport measured the specified dimensions. Every desktop journey used native Tab and Shift+Tab to reach controls before activation. Narrow runs used verified CSS dimensions in a desktop frame and checked page overflow at every room. They establish responsive control access on these desktop browsers. Phone and tablet hardware performance remains unmeasured by T153. [Native Safari 27 narrow Arrival Lift](browser-matrix/release-captures/final-safari-390x844.jpg) · [Native Safari 26 desktop ending](browser-matrix/release-captures/credits-guest-safari-1280x720.jpg)

## What the player could do

- Open Credits on the title screen and reach both attribution links. The observer retrieved both complete same-origin resources and checked their byte lengths. The player opened Credits again from the Game menu and returned to the Arrival Lift with the guest adventure intact. T156 exercised opening the links in new tabs. [Credits interaction test](../../../tests/e2e/title.spec.ts)
- Inspect and repair copper, optical and radio routes, measure before and after the repair, select the power kit, and decode signals without a timer. Every room produced a nonzero canvas, and the required controls remained within the tested scrolling and focus paths.
- Walk to a distinct floor position in R04 alone, recruit the Single-Mode Unicorn and Multimode Hydra through the Party controls, and see both allies present during floor moves in R09 and R04. T155 separately measures the frame and readiness budgets.
- Commit the reviewed plan at R11, measure the repaired link at R12, run the endpoint service test, classify permanent restoration, and continue the guest adventure. The receipts retain the actual actions, movement coordinates, measured readings, trusted input counts, viewport observations, browser build, harness hashes and UTC timestamps. The private loopback fixture verifies guest play. Live identity and saved account recovery use separate service evidence. [Verified receipts](browser-matrix/release-summary.json)

## Versions and equipment

Google promoted 158 for general desktop release on November 17. On November 24 the Mac arm64 stable rollout also assigned a small active share to 159.0.8154.33. The tests cover general stable 158, its predecessor 157 and the early-stable 159 build. Each Chrome for Testing archive matched its official version-specific Google Storage checksum. These testing distributions use ad-hoc signatures. The installed retail Chrome application independently passed the Google LLC Developer ID requirement and used a new temporary profile. Chrome and Firefox retail executables used their headless desktop rendering mode. [Google stable announcement](https://chromereleases.googleblog.com/2026/11/stable-channel-update-for-desktop_01699533288.html) · [Mac rollout data](https://versionhistory.googleapis.com/v1/chrome/platforms/mac_arm64/channels/stable/versions/all/releases?page_size=30) · [Frozen binary provenance](browser-matrix/distributions.json)

Mozilla identified 161.0 as its November 24 release and 160.0.1 as the November 17 maintenance version of the preceding major. Both unmodified macOS releases matched Mozilla’s published SHA-512 checksums and Developer ID signatures. The project’s separately pinned Playwright builds provide other suites’ evidence. [Firefox 161 release](https://www.firefox.com/en-US/firefox/161.0/releasenotes/) · [Firefox 160.0.1 release](https://www.firefox.com/en-US/firefox/160.0.1/releasenotes/)

The reference host was a Mac16,7 Apple M4 Pro with 48 GiB RAM, running macOS 26.6.2 build 25G83. Installed Safari 27.2 ran in a task-owned private window with native Mac keyboard events. Apple’s Safari 26.6.1 ran on the same Apple hardware in a host-only macOS Sonoma 14.8.7 guest, build 23J520. The guest used a digest-pinned Cirrus Labs image and Apple’s unchanged signed Safari update with its matching distribution manifest. The installed browser and Apple’s driver reported the same build. Apple’s application signature was verified in both environments. [Apple release index](https://support.apple.com/en-us/100100) · [Safari 26.6.1](https://support.apple.com/en-us/148286) · [Guest and installer provenance](browser-matrix/sonoma-guest.json)

## Candidate history

The first joined T151/T152 build passed 28 cells across seven distributions. The initial Safari 1280 px screenshot renderer clipped the ending header in its derivative image. The viewport and native action receipts completed. The release capture uses the corrected top-left crop. An independent 1440 px native capture shows the complete R12 validation panel. [Original 440-file manifest](browser-matrix/candidate.json) · [Baseline cell summary](browser-matrix/summary.json) · [Native R12 screen](browser-matrix/captures/native-safari-1440-R12.jpg) · [Original harness patch](browser-matrix/joined-to-baseline-harness.patch)

All four earlier Safari 26.6.1 journeys also passed on the T155 performance build, alongside one Safari 27.2 and one Chrome 158 journey. Its isolated build omitted the repository TypeScript configuration. That intermediate build had component-sorted SHA-256 `2284d54dce2c4e6d7966fec7d502cf7dc5990fbcdff50109c2f8b25eed582396`. The production configuration and Credits change produced the final component-sorted SHA-256 `b2837859285e3f00adea34342ffeee2606de5383ca3295c8e689f26dec2f3361`. Run the evidence verifier against the packaged client at publication. Recheck the vendors’ supported major releases if the release date changes. [Intermediate journeys](browser-matrix/performance-samples.json) · [T155 production build](performance/t155/production.json) · [Production output comparison](browser-matrix/credits-candidate.json)

## Reproduce a cell on macOS

Supply the verified version-specific application executable and matching ChromeDriver or geckodriver. Use an isolated production output directory with the expected manifest. This example runs the retail Firefox full keyboard journey at 1280 × 720.

```sh
python3 tools/measurement/browser-matrix/run.py \
  --dist "$CANDIDATE_DIST" --engine firefox \
  --browser "$FIREFOX_RELEASE_EXECUTABLE" --driver "$GECKODRIVER" \
  --size 1280x720 --input keyboard --suite credits \
  --out "$RESULT_DIR/firefox-1280.json" --capture "$RESULT_DIR/firefox-1280.jpg"
```

Select `--engine safari` and omit the executable/driver arguments for the private-window host Safari path. Its guarded AppleScript checks the task-owned window and origin before sending keys, and returns focus to the previously active application when it closes. The isolated Sonoma guest uses `--engine safari-webdriver` and the Apple-provided Safari binary and safaridriver. Option+Tab traverses every eligible Safari control. The baseline suite reproduces the original guest route and the performance suite adds the party/floor cases. The Credits suite adds both title and in-game notice paths. Receipt timestamps measure test execution, with no interpretation as player completion time.

To reproduce the previous Safari major on Apple hardware, clone the content-addressed image in the guest provenance record to a temporary Tart home. Configure a 1728 × 1117 point display and start it with host-only networking. Transfer the two hash-verified Apple update files to the guest together, preserving the package filename. Install the distribution inside the guest, check the resulting Safari signature and build, and enable its bundled safaridriver there. Transfer the sealed client and measurement directory, then use the same command with the Safari WebDriver engine and the guest’s native Apple executables. The recorded VM was shut down after its four final cells. [Image, update, resources and checks](browser-matrix/sonoma-guest.json)

Verify all 32 release-candidate receipts and a candidate distribution with `python3 tools/measurement/browser-matrix/verify.py --dist "$CANDIDATE_DIST"`.

Copyright 2026 John Capobianco. Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
