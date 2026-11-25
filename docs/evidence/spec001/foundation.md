# Spec001 foundation checkpoint — T021

Date: 2026-11-25. Reviewer: `/root/loop027_t021`, fresh loop 27/200.
**Scoped result: PASS; ready for T022's prepared guest expectations.** No unresolved
shared foundation failure was found in the reviewed interfaces or joined checks.
This is local implementation readiness, not G0/G1 acceptance, playable-story
acceptance or a release. G0 remains blocked by its named external evidence;
G1–G7 remain pending.

## Inputs and environment

Reviewed the governing constitution, root SPEC/PLAN, current feature plan, relevant
gameplay/save/delivery contracts, execution direction and accepted T012–T020 work.
The [execution table](../../../specs/001-physical-layer-underworld/tasks.md)
permits independent local guest work on these verified inputs. The coordinator
confirmed no source changes after T018's final checks, and no concurrent worker
was editing source during this checkpoint. T021 changed only this report and its
[loop note](../../implementation/loops/027-T021.md).

Actual local versions: macOS 26.6.2 arm64; Node 26.13.1; npm 11.20.0;
TypeScript 7.0.2; Vite 8.3.8; Three.js 0.187.0; Vitest 5.1.2;
Playwright 1.65.1; `@axe-core/playwright` 4.14.1; Ajv 8.20.0 with
ajv-formats 3.0.1; PHP 8.4.28; SQLite 3.54.1; PHPUnit 12.5.45.
Existing browser binaries reported Chromium 159.0.8154.6 and Firefox 159.0.
Composer lock retains google/apiclient 2.20.1, league/oauth2-client 2.10.0 and
opis/json-schema 2.6.3. No installation, browser-cache change or global
configuration/trust change was made.

## Executed and reused evidence

Commands ran from the repository root. Every JavaScript invocation used
`PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH"`; the two joined checks
also used `NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php`.

| Command | Evidence | Result |
| --- | --- | --- |
| `npm run check` | Reused unchanged final [T018 run](../../implementation/loops/026-T018.md) | Strict source/test/tool/config typecheck and content validation PASS: 12 room identities, 0 authored records, 3 independent routes |
| `npm run test:domain` | Reused unchanged final T018 run | 306 PASS / 83 TODO across 7 files: 165 source-fixture, 51 content, 38 reducer, 25 action-bus and 27 presentation checks |
| `npm run build` | Reused unchanged final T018 run | Strict compilation and Vite PASS; 5 shell modules transformed |
| `npm run test:api` | Executed T021 | Exit 0; 57 tests / 279 assertions; 0.941 s |
| `node node_modules/@playwright/test/cli.js test` | Executed T021 against the unchanged built shell and current source modules | Exit 0; 19 PASS in 12.7 s, 2 workers, no skips or retries |

The direct Playwright invocation intentionally reused the already verified build;
`npm run test:e2e` would rebuild it. The complete configured suite ran: 3 static
checks in each of Chromium and Firefox, 1 trusted-HTTPS boundary check, 10 semantic
UI checks and 2 presentation/native-audio checks. Browser tests cover actual
module loading, native pointer/keyboard/touch-emulated intent parity, shortcuts,
typing suppression, focus/edit retention, unavailable feedback, stale scopes,
literal text, captions, disposal, 390/768px layouts with doubled text and zero
axe violations on the tested fixtures. These remain synthetic foundation
fixtures, not authored rooms or a four-verb gameplay journey.

The 83 TODOs are unimplemented evaluator checks against independent reviewed
cases. They are not 83 passes. No physical-rule evaluator or human learning
acceptance is claimed. Reused results were not silently rerun or relabeled as
new observations.

Raw stdout/stderr is retained locally in ignored `.local/evidence/t021/api.log`
and `browser.log`. Their SHA-256 values are, respectively,
`a8e134704e7009116cff042d50d237b9e66bc2959c6be21d92832ed74f8c233a` and
`bd3e8b971b97d8b00797ea6d345a44f9c5e6adcafd6309c85600bbc8c1bd02ab`.
The only browser-run warnings concerned `NO_COLOR`/`FORCE_COLOR` output formatting.

## Verified boundaries

- **Types/content:** qualified identities and typed units distinguish world
  configuration/attempt generations from server slot metadata. Types do not
  replace runtime validation. The registry validates bounded decoded JSON,
  schemas, typed references, reviewed source mappings, authored conditions and
  route/recovery proofs; it owns cloned, recursively frozen records and exposes
  lookup methods only. Metadata for twelve rooms is not twelve playable rooms.
  The bounded 4,096-state route proof remains a fail-closed authoring limit.
- **Reducer:** accepted effects must match immutable authored definitions and
  canonical receipt ownership. Alternatives commit their complete selected batch;
  debits are affordable before rewards. Versions, cancellation, safe destinations,
  recovery and one-time receipts reject stale/partial/duplicate effects. Physical
  changes conservatively stale measurements. Rewind restores preparation world
  and inventory, retains learning, advances attempt/configuration identity and
  performs no save. Canceled logout is an exact no-op.
- **Action/UI/presentation join:** one authoritative projection creates
  `captureScope`. RoomAdapter forwards it via `onView(view, capture)` to
  `AppShell.render(view, capture)`. Loading, ready, failure, retry and mode changes
  retain that original scope; they cannot revive an invalidated equal-version
  view. The combined browser suite exercises this join. Application handlers
  resolve intent through the reducer adapter with an atomic compare-and-set;
  renderers receive control-ID intent dispatch, never effect or reward authority.
- **Media ownership:** bounded leases, pending work and disposal preserve semantic
  controls/evidence during missing visuals and failures. The `three`, `layered`,
  `sprite` and `text` modes are adapter interfaces, not finished scenes. Native
  audio requests require activation, keeps transcripts on corrupt-media failure,
  and cannot advance domain state. Canceled work remains accounted for until it
  settles; late completions cannot reattach or replay revoked media.
- **PHP/harness:** actual application routes remain deliberately inert 503s,
  with 404/405 and restrictive response headers. No real auth/save/session/DB
  implementation or private configuration load exists. Production rejects test
  configuration. The isolated harness proves synthetic session/TLS/storage
  behavior, competing SQLite writers and rollback, ownership safeguards and
  cleanup; it does not prove provider login or SAVE01–13.
- **Independent build:** source/config/entry review found no closed website import,
  runtime AI client, player key requirement or production configuration dependency.
  All 110 npm lock entries have no local/link dependency; resolved tarballs use
  the npm registry. Reviewed inputs contain no symlinks. Vite disables `.env`
  loading and general environment exposure, allowing only public route paths;
  PHP test children use explicit small environments. The production title
  truthfully reports: “This build contains setup only. Play is not available yet.”

TLS used the existing helper's disposable private CA, separate SAN leaf and
isolated Firefox NSS profile. Untrusted navigation was rejected before trusted
navigation passed; `ignoreHTTPSErrors` stayed false. No production credentials or
provider configuration were read. Afterward, no matching temporary browser/test
directory, scoped test/server process or port-4173 listener remained. An unrelated
older `/tmp/network-quest-browser-research.md` regular file was left untouched.

## Fingerprints

Each aggregate uses SHA-256 over sorted relative pathname + NUL + raw bytes + NUL.
Both T018 seals independently matched the published loop026 values. The 66-input
and built-output seals matched before and after the joined runs.

| Set | Files | SHA-256 |
| --- | ---: | --- |
| T018's three presentation modules, their three unit suites, `presentation.spec.ts`, `playwright.config.ts` | 8 | `cf69c045e6e9e749f2fbae871d31be940605d9624298ec2a1c719431dd5593a5` |
| `src/ui/action-bus.ts`, `src/ui/app-shell.ts` | 2 | `043d09175db7f168780a09905ca932a4778ed54d0f0400666c514b338fec598f` |
| Foundation inputs defined below | 66 | `f4c843556c646049470130ceff6554155dbf7ce12a498f30ab02cac4d653db80` |
| Foundation inputs plus `content/schemas/content.schema.json` | 67 | `545baef706f5f61180370e8ef19c176ca053db3e8f08b33b81dd9ece47a2793b` |
| Built files under `dist/` | 4 | `0a5a3a2c22551e854a8e893d112df19025b530e300add175925f6e80c15d4679` |

The 66-input set comprises all regular files beneath `src/`, `tests/`, `tools/`,
`content/spec001/`, the feature `contracts/`, `server/src/`, `server/public/` and
`server/tests/`, plus `package.json`, `package-lock.json`, `tsconfig.json`,
`vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `index.html`,
`server/composer.json`, `server/composer.lock` and `server/phpunit.xml`.
Dependencies, credentials, operator files, runtime data and this report are excluded.

## Remaining dependencies and next step

Start T022 with independently prepared O01/O02 expectations, dialogue skip/replay
and evidence travel before wiring the guest story. Explicitly assign its new
browser spec in Playwright configuration; discovery rejects unassigned specs.
Guest/title/content/evaluator integration is still future work.

T028 must supply navigation/unlocked-exit policy and pure reachability for remote
item recovery. T084 owns checkpoint capture and the complete Retry/E03 flow.
T100 must map authored minigame completion into supported runtime predicates;
current unsupported predicates fail closed, including under negation. Later
rendering/audio work must supply reviewed scenes/media, resource budgets and
visibility/settings wiring. Later account work must implement validated snapshot
installation, real providers, server identity, receipt ordering, one-slot saves,
confirmed logout and operation-specific deletion status.

External retention/provider/listening evidence, actual Safari, real-device and
manual assistive review, finished-media provenance/counts, measured performance,
human learning/owner reviews, packaging/recovery and publication remain open.
None is certified by this foundation checkpoint. No task counter, gate, source
commit, deployment or later episode was advanced by this worker.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
