# R01 integration inspection packet — T066

2026-11-26. Actual application captures from native Firefox159.0, Playwright1.65.1,
strict isolated local HTTPS on Mac16,7/macOS26.6.2. This packet supports coordinator
and owner room inspection. It does not record owner approval, G3, Safari acceptance,
shaped-network performance or asset-quota acceptance.

Open the initial [1280×720 viewport](../../assets/t066/t066-entry-1280x720.png) and
[1440×900 viewport](../../assets/t066/t066-entry-1440x900.png),
[the composed room](../../assets/t066/t066-composed-room-1440.png),
[the full desktop page](../../assets/t066/t066-page-1440.png), and
[expanded transcripts/controls](../../assets/t066/t066-audio-transcripts.png).
Compare the accepted [Blender source room](../../assets/t063-R01-source.png).
The source and runtime retain the lift, separate power/link indicators, physical
path, plaque, satchel, message capsule, workshop gate and actors. Runtime images
frame the source arrangement; they do not add duplicate gameplay objects.

Root's first inspection found artwork below the initial desktop viewport. The
[earlier candidate](review-before-layout/README.md) is retained with its exact
seal and screenshots. The final compact layout begins the stage at y300.6 with
all four verbs visible and scrollY0. At 1280×720, 88.5% of the scene is visible;
at 1440×900, the whole scene is visible. The [layout measurements](t066-entry-layout.json)
come from the actual final application. No automatic scroll or hidden text/action
was used to achieve those values.

The [390px capture](../../assets/t066/t066-390px.png),
[200% text page](../../assets/t066/t066-200percent.png) and
[200% scene](../../assets/t066/t066-200percent-stage.png) show the same room/actions
at narrow width. Semantic controls below the image expose the four verbs and all
actions. W/L/T/U selects a verb; keyboard controls and scene pointer/raycast inputs
share the same action bus and evidence. Text scene and Low detail scene remain
available; reduced motion is static. Final axe report has no incomplete checks.

For the later live owner review, inspect the lift scene after New Adventure, Look
at power and link, Talk to Photon, take/use the introduction items, then Walk to
the Workshop and back. Open Sound and reading to review permanent text, narrator
and Photon replay/skip, the nonlooping 20-second title excerpt, separate volume
settings, captions, text size and motion. Power inspection uses effect001 and
Photon Talk uses effect023. The previously approved lift-latch audition is not
triggered because that authored action is not currently exposed. Every mandatory
action/evidence remains usable muted and in Text scene.

## Exact final evidence

- [Source/export/evidence seal](source-seal.json), [loop report](../../../../implementation/loops/071-T066.md).
- [Native room/media 12 results](room-media-regressions.txt), [guest/save/logout 25 results](native-regressions.txt), [title/confirmation 3 results](title-layout-results.txt), [focused UI 26 results](layout-unit-results.txt).
- [Full accessibility report](t066-accessibility.json), [resource/response hashes](t066-runtime-budget.json), [audio playback/response hashes](t066-audio-runtime.json).
- [Content/typecheck](check.txt), [build](build.txt), [21-binding integration audit](integration-audit.txt).
- `assets-src/integration/R01-T066.json` is a candidate fragment; root alone joins the canonical manifest. All counts remain zero.

`runtime-budget.json` is an earlier exploratory capture preserved separately;
`t066-runtime-budget.json` is the final regression capture. Byte totals are response
bodies, not total TLS transfer or full browser memory. The final timing is local
and unthrottled. The Windows UA is a Playwright desktop preset; physical hardware
is the recorded Mac. Visibility events are synthetic application-wiring tests.

## Native axe runner failure and bounded isolation

The original failing case was
`tests/e2e/introduction-graybox.spec.ts` → “390 px, touch, 200% text and reduced
motion retain readable controls without a render loop,” with direct in-process
`new AxeBuilder({page}).analyze()` after those actions. The browser crashed rather
than reporting an accessibility violation. The surfaced call sites were
`@axe-core/playwright/dist/index.mjs:303:34` (`runPartialRecursive`) and, during a
legacy-mode diagnostic, `index.mjs:276:40` (`runLegacy`). Original failure traces
were overwritten by later Playwright runs; no complete original JS trace is claimed.

The native report remains locally at
`~/Library/Logs/DiagnosticReports/plugin-container-2026-11-26-150124.ips`.
[Sanitized exact exception and first 14 native frames](axe-runner-crash-excerpt.json)
record its SHA-256, EXC_BAD_ACCESS/SIGSEGV null address, XUL arm64 frame offsets and
MainThread identity without publishing private diagnostic identifiers/environment.
This is native failure evidence; the internal cause is unproven.

Trace disabled, legacy axe, focus reset and a diagnostic removal of the rendered
scene still crashed inside the runner. A standalone native process running the
same full scene/UI/viewport/touch/200% sequence passed. The original successful
diagnostic source is preserved [verbatim](axe-isolation-original-probe.ts.txt);
its `.local/` screenshots and debug variants are historical, not final acceptance.
The promoted check is `tools/verify-room-accessibility.ts`, executed by the same
pinned Node from the enclosing test with only PATH, NQ_PHP_BIN, LANG and LC_ALL
inherited. It owns its Firefox context, isolated TLS fixture and cleanup; a 20s
timeout, crash, missing valid JSON, assertion failure or axe violation fails the
parent test. It uses the same full default axe rules with no filters/exclusions,
retains the real visual scene, and additionally expands the media controls.
Original in-runner gesture/zoom/reduced-motion/no-API/no-external checks remain.

The final isolated result is 34 passed rules before expansion, 38 afterward, zero
violations/incomplete items/page errors/API mutations/external requests. This
distinguishes a reproducible runner/process differential from a proved engine bug;
it does not waive actual browser accessibility or later human review.
