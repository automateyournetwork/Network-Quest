# Physical case execution reconciliation

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator review, 2026-11-26, after accepted T070–T076. The original T014
transcription suite still listed optics, radio, power and capability cases as
unimplemented even though their actual evaluator suites now execute them.
`tests/domain/physical-case-coverage.ts` records their existing execution locations
without importing test modules or duplicating suites.

The coordinator inspected each named test against its frozen source case and
actual evaluator call: copper15, optics10, radio6, power6, capabilities4. Inputs
retain their scope; isolated overload/compatibility/port observations do not
silently become a complete path or service proof. Missing-action tests assert
invalid input and zero effects. The Mb/s spelling alias retains its exact value.

The 26 newly accounted-for cases were removed only from the obsolete pending list;
no fixture was changed, no test was replaced with a stub and no new pass was
invented. The 41 source cases execute in their listed suites. The other 42 T014
entries remain explicitly pending for later reconciliation/integration, including
composite outcome requirements. All 52 T068 route TODOs remain pending; scoped
numerical checks alone do not accept a complete route case.

Actual focused command used pinned Node26.13.1 and Vitest5.1.2:

```sh
.runtime/node-v26.13.1-darwin-arm64/bin/node node_modules/vitest/vitest.mjs run tests/domain/physical-cases.test.ts tests/domain/copper.test.ts tests/domain/optics.test.ts tests/domain/radio.test.ts tests/domain/power.test.ts tests/domain/capabilities.test.ts --maxWorkers=1
```

Result: **455 passed / 42 TODO**, six suites, 492 ms. The 455 include 165
fixture/transcription checks and 290 actual evaluator tests; neither the TODOs
nor fixture-only checks are counted as additional runtime case acceptance.
Final whole-tree `npm run typecheck` passed in the stable T077 join at local
19:51, after these coverage records and the final repair-plan correction.
