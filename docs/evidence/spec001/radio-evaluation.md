# T072 radio evaluation evidence

2026-11-26, loop083. Local deterministic domain implementation and tests only;
root review/task acceptance is separate. No playable radio room, objective grant,
whole route, human learning, browser, media or aggregate gate acceptance is claimed.

## Reviewed model and interface

`src/domain/radio.ts` implements `evaluateRadio(challenge, action, world)` through
the existing pure `createEvaluator` boundary. Source authority remains T006
[rule-source-review.md](rule-source-review.md), the unchanged T014
`tests/fixtures/physical-cases.json`, T068 `tests/fixtures/repair-routes.json` and
T069 `content/spec001/profiles.json`/`objectives.json`. S08 supports separate path,
settings and connectivity observations; S09 supports the power-ratio arithmetic.
The exact inclusive **20 dB** threshold belongs to the fictional teaching profile.

The known profile must retain its reviewed identity, threshold, unit and inclusive
minimum. Unknown profiles, altered thresholds, reversed comparators, extra scoring
fields and malformed/nonfinite quantities are author errors. Source/content record
metadata is accepted as a projection; the established content boundary owns its
schema/source validation. The adapter may pass either the full validated T069
profile record (or T006 source record) or the minimal `id`/`parameters` projection;
it must not strip or change required parameters. Only the declared parameters
score here. Unknown additional scoring fields are rejected, not silently ignored.

| Challenge / input | Facts supplied | What a correct result establishes |
| --- | --- | --- |
| `radio-settings` / `check-settings` | Explicit `settingsCompatible` | Settings compatibility only; no path or SNR invented |
| `radio-path` / `check-path` | Explicit `viablePath` and `settingsCompatible` | Prepared scenario path only; no SNR or usable-link success inferred |
| `radio-snr` / `measure-snr` | Comparable signed `signal`/`noise` dBm, explicit combined `otherPathChecks` | Supplied path prerequisites and this scenario's SNR |
| `radio-link` / `measure-link` | Comparable signed readings, explicit path and settings facts | Supplied radio path and SNR only |

The caller selects a supplied path/channel scenario and passes its facts. No real
channel number, invented ranking, regulation, propagation model, signal-strength
rule or throughput value is inferred. The narrow B-RADIO-PATH settings fixture is
checked at its actual scope; its absent viable-path fact is not fabricated.

Signal and noise levels permit negative, zero and positive finite **dBm** values.
Their difference carries the existing branded **dB** quantity type, including a
negative SNR when noise is stronger. Finite decimal inputs are subtracted and
compared exactly with integer coefficients before conversion for display. A
19.99 dB result cannot pass by display rounding. Unrepresentable differences are
content errors. An explicit failed path or compatibility prerequisite is incorrect
before any SNR success; all authored values are nevertheless validated first.

Broken authored data takes precedence over missing/stale actions and known failing
choices. Absent/malformed learner input, wrong predicate actions and stale captures
return `invalid-input`. Both configuration revision and attempt must match. A
`change-channel` action cannot create a new observation. Every domain result has
empty effects; reducers/objective integration own progress. Observations copy
current freshness fields, carry `throughputProven:false`/`wholeRouteProven:false`,
and are detached from challenge, action, world and other returned results.

## Executed independent cases

| Source case | Actual evaluator evidence |
| --- | --- |
| T08 | −65 − (−90) = **25 dB**, correct under supplied checks; throughput not proven |
| T09 | −65 − (−78) = **13 dB**, incorrect |
| B-RADIO-20 | −65 − (−85) = **20 dB**, inclusive pass |
| B-RADIO-BELOW | −65 − (−84.99) = **19.99 dB**, fail |
| B-RADIO-PATH | Explicit incompatible settings prevent usable-link acceptance without inventing a path fact |
| I-PHY07 | Missing action is invalid input with no progress |
| RR-O07-ALTERNATIVES | Both supplied viable, compatible paths pass preparation; SNR remains unproven |
| RR-O07-BLOCKED-PATH | Supplied false path prevents success despite nominal 25 dB readings |
| RR-O07-MISSING-PATH | Missing fact is content error with zero penalty/progress; original reason maps to issue code |
| RR-O08-ALTERNATIVES | Both supplied channel scenarios pass at 25 dB and 20 dB; no ranking or throughput promise |
| RR-O08-BELOW | Actual link predicate rejects 19.99 dB |

Expected values are read from the frozen independent fixture files. Additional
implementation boundary tests cover near-20 decimal comparisons, scientific
notation, negative/zero/positive powers and SNR, overflow, missing/wrong units,
nonfinite/coerced values, unsupported fields, reversed/altered profile parameters,
content-error precedence, stale attempt/revision, malformed envelopes, incorrect
action kinds, deterministic replay, no effects and detached output.

RR-O07/O08 alternatives here prove domain predicates only; current objective
prerequisites/evidence, once-only effects and actual UI availability remain T074/
T080. By coordinator agreement **RR-O08-MITIGATION-NOT-MEASUREMENT remains pending
for T074's evidence/freshness integration**. Its prior revision7 measurement must
not be presented as a revision8 measurement. No radio lifecycle API was invented
to claim that state fixture passed. Existing shared TODO activation is root-owned.

## RED → GREEN and checks

Pinned Node 26.13.1/npm 11.20.0 and Vitest 5.1.2, from repository root:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/domain/radio.test.ts tests/domain/radio-repair.test.ts --maxWorkers=1
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run typecheck
```

1. **RED**, before creating `src/domain/radio.ts`: exit 1, **2 failed suites,
   zero tests collected**, 162 ms, local start 19:00:05. Both suites reported
   `Cannot find module '../../src/domain/radio'`. This was an import failure,
   not a claim that behavioral assertions had executed and failed.
2. Implemented the evaluator. **GREEN**: exit 0, **77 passed, 2 suites**, 166 ms,
   local start 19:01:36; `radio.test.ts` 65 and `radio-repair.test.ts` 12. No TODOs
   in these owned suites and no failing assertion was suppressed.
3. `npm run typecheck`: exit 0, no diagnostics.
4. Original source/fixture hash matches preserved. No shared evaluator/types,
   fixture/oracle, tracking, task checkbox or runtime integration file edited.

No broad build, browser or live service run was needed for this pure module. No
installation, Git publication, deployment or additional agent was started.

## Artifact hashes at worker handoff

| Artifact | SHA-256 |
| --- | --- |
| `src/domain/radio.ts` | `55f49a9e3b416d129d4ceac9a302636dff043475041d3d8e9a0125f0815e4f74` |
| `tests/domain/radio.test.ts` | `001ef82ffad474d4a61ef8171a7c2eb9847d97f7de4dc9843a33a20dacb0cd7c` |
| `tests/domain/radio-repair.test.ts` | `bb0978b55cfa22bd28dd6ad631a47c829b6c42a4dcff52cef8639858fb1c91bf` |
| `content/spec001/sources.json` | `a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116` |
| `tests/fixtures/physical-cases.json` | `de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1` |
| `tests/fixtures/repair-routes.json` | `ed3a083828188a34fd6f5f345cbd4c69fe8ebb140ea903dbafd9b3f464639877` |
| `content/spec001/profiles.json` | `93c0dfe3d40c74e68b2e4e025518e2efe1c3e82abb5438d233fddeb9b0834cc3` |
| `content/spec001/objectives.json` | `b5e2212d581caebc4419f683dc47e337dabba157dc569369f5413e13511f9b98` |

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
