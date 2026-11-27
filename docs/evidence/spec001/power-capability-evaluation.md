# Delivered power and common capabilities — T073

Date: 2026-11-26 (America/Toronto); final checks 2026-11-27 UTC. Worker:
`/root/loop084_t073`. Scoped implementation evidence for C9/C10/C15, US2,
O09/O10, PHY08/PHY09 and SPEC T10/T11/T14/T16. Coordinator acceptance is separate.

The pure evaluators now execute the reviewed delivered-power and advertised-mode
predicates. Final focused validation passes **114 tests across three suites**;
TypeScript typechecking passes. This does not complete O09/O10, a repair route,
browser integration, an aggregate gate or a release.

## Authority and independently supplied expected answers

Read the [constitution](../../../.specify/memory/constitution.md), root
[SPEC](../../../SPEC.md) and [PLAN](../../../PLAN.md), current task schedule,
[gameplay contract](../../../specs/001-physical-layer-underworld/contracts/gameplay.md),
accepted [source review](rule-source-review.md),
[T068 repair oracle](repair-route-fixtures.md) and
[T069 authored definitions](repair-definitions.md). The source facts already had
independent review; no new networking standards or threshold claims are introduced.

- T006/T014 inputs: [source records](../../../content/spec001/sources.json) and
  [frozen physical cases](../../../tests/fixtures/physical-cases.json).
- T068 inputs: [frozen repair cases](../../../tests/fixtures/repair-routes.json).
- T069 inputs: [profiles](../../../content/spec001/profiles.json) and
  [objectives](../../../content/spec001/objectives.json).

Those source/oracle/content files were not edited. The fixed historical source
and physical-fixture seals still match
`a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116` and
`de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1`.
Full final artifact hashes and actual command outputs are in
[the evidence seal](power-capability-evaluation-seal.json).

| Independent case | Executed predicate and result |
| --- | --- |
| T10 | 12 + 11 + 10 = 33 W; 3 W exceeds the 30 W delivered budget. |
| C-POWER | 12 + 11 = 23 W; 7 W headroom. |
| B-POWER-30 | 12 + 11 + 7 = 30 W; inclusive maximum passes with 0 W headroom. |
| B-POWER-OVER | 30.01 W fails with exactly 0.01 W excess. |
| B-POWER-COMPAT | A supplied failed required port remains incorrect despite aggregate headroom. |
| I-PHY08 / I-PHY09 | Missing learner input is invalid input with no effects. |
| T11 | The reviewed sets intersect only at 100/full. |
| C-NEG-WRONG | 1000/full is unsupported by B; selection cannot grant it that capability. |
| B-NEG-NONE | The supplied disjoint reviewed subsets yield no common mode and no fallback. |
| RR-O09-ALTERNATIVES | Both supplied kits meet power constraints and select 100/full. These scoped successes award nothing. |
| RR-O09-FORM-FACTOR-ONLY | Shell fit and available watts do not override the explicit PHY/media mismatch. |
| RR-O09-PER-PORT | Explicit per-port failure is retained; omitted form-factor, PHY/media and host facts remain absent. |
| RR-O09-POWER-BOUNDARY | PSE output versus delivered demand is incomparable under this model: author error. |

The repair tests execute the available predicates only. They do not change the
independent shared repair suite's TODOs or claim full objective acceptance. The
accounting-boundary adapter uses the reviewed profile's delivered-after-losses
meaning; it never fills missing equipment compatibility facts.

## Interfaces and scope

[`evaluatePower`](../../../src/domain/power.ts) uses the existing four-status
`createEvaluator` boundary. The challenge requires the reviewed `PROFILE-POWER`,
explicit delivered-after-losses labels for both budget and demands, and exactly
one of individual `demands` or supplied `totalDemand`. This allows partial
independent fixtures to retain their actual aggregate fact without inventing
devices or per-device loads. The command is `check-allocation`.

The optional compatibility facts have six fixed names: `otherConstraints`,
`formFactorMatch`, `phyAndMediaMatch`, `hostSupport`, `portPowerCompatible`, and
`perPortConstraintsMet`. Every supplied value must be boolean. Missing checks
are omitted from the result; their absence never establishes equipment readiness.
A blanket `otherConstraints: true` contradicting an explicit failed check is
author error. A known failed check is incorrect and is reported before budget
arithmetic can establish adequacy. A successful budget result has neither
`equipmentReady: true` nor an objective/service verdict.

Watt calculations align decimal coefficients with BigInt, compare the exact
finite number representations, then convert display readings to ordinary typed
JSON-compatible numbers. There is no epsilon/clamping. Three hundred 0.1 W
demands total exactly 30 W; 30 W plus `Number.MIN_VALUE` is over budget even when
the displayed rounded total is 30. The positive excess remains available.
Nonfinite inputs and totals/differences that cannot be represented as finite
numeric readings are author errors. No PSE loss subtraction, PoE class,
priority, voltage, inrush or source-power conversion is invented.

[`evaluateCapabilities`](../../../src/domain/capabilities.ts) requires the
reviewed `PROFILE-CAPABILITIES` and explicit `bothNegotiate: true`. Its commands
are `inspect-common` and `select-capability`. Inspection reports the intersection
without pretending the learner selected a mode. Selection checks the rate/duplex
pair independently against both advertisements and reports which endpoint lacks
support. Author-supplied paired current advertisement overrides can only be
nonempty subsets of each endpoint's own reviewed modes. Unknown rates, duplicate
modes, one-sided overrides and changed profile advertisements are author errors.
The profile sets may be reordered without changing support.

The exact reviewed `Mb/s` spelling and runtime `Mbps` refer to the same numeric
quantity; this mapping does not rescale rates. All returned rates use `Mbps`.
Other unit labels are rejected. Missing/false negotiation premises and unreviewed
ranking, forced-mode or fallback fields are author errors. A well-formed learner
selection unsupported by one or both endpoints is incorrect, not an author error.
This is set intersection, not an implementation of Ethernet negotiation timing,
parallel detection, PAUSE or master/slave selection.

Both modules validate authored numeric/structural/model facts before checking the
command. They accept a narrow profile projection or the existing reviewed source
and content records. Scoring parameters and profile identity are checked locally;
the content registry remains responsible for cross-record source/reference and
prose review. If supplied, model metadata must retain the fictional/toy label and
the declared prose shape; additional scoring fields are rejected.

Results are deterministic and detached, contain no accepted effects, and capture
only `configurationRevision` and `attemptId`. Extra caller world fields are not
copied. Stale command revisions or attempts remain invalid input. These captures
do not replace T074's submitted-evidence freshness checks or reducer rechecks.
All evaluated observations explicitly retain `wholeRouteProven: false`.

## Executed RED/GREEN record

All commands ran in the repository using the verified runtime:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/domain/power.test.ts tests/domain/capabilities.test.ts tests/domain/power-capability-repair.test.ts --maxWorkers=1
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run typecheck
```

| Local start time | Actual result | Assessment and correction |
| --- | --- | --- |
| 19:02:46 | RED, exit 1: three failed suites, zero tests collected | Tests were written first; both implementation modules were absent. This is an import-stage RED, not 104 executed failed assertions. |
| 19:04:51 | GREEN, exit 0: 104 tests; typecheck exit 0 | Initial scoped implementation passes the independent expectations and adversarial cases. |
| 19:05:59 | RED, exit 1: 8 failed / 104 passed | New model-metadata regressions expose ignored null/mislabeled models, hidden scoring fields and sparse assumptions. Actual result was invalid-input instead of content-error for a missing command. |
| 19:06:26 | GREEN, exit 0: 112 tests; typecheck exit 0 | Both modules now validate supplied fictional/toy metadata before the command. |
| 19:06:44 | RED, exit 1: 2 failed / 112 passed | Coordinator review found `version: { ...world }` copied unrelated caller fields; two new independent regressions expose the leak. |
| 19:06:58 | Final GREEN, exit 0: 114 tests; typecheck exit 0 | Explicit revision/attempt capture removes unrelated fields. Final suite duration 276 ms. |

Final breakdown: power 58 PASS; capabilities 52 PASS; repair subset 4 PASS.
No browser/build/API/deployment command was run by this worker. No broad test run
is represented as this worker's evidence. Coordinator joins are recorded separately.

## Remaining acceptance

T074 still owns objective prerequisites, submitted-evidence freshness, hints,
alternatives and effects. T076 and later route work still own actual room actions,
equipment completeness and full objective/browser integration. Higher-layer
endpoint service validation remains separate. Human technical review, full
playthrough, real provider/host acceptance, other episode gates, packaging and
publication are not established by these predicates or their tests.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
