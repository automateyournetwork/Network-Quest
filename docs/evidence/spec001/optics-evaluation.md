# T071 — Optical evaluation

Date: 2026-11-26. Worker: `/root/loop082_t071`. Scope: C9/C10, FR-004/005,
NQ-03, PHY03/PHY06 and optical portions of O05/O06. This is local deterministic
rule evidence, **not objective completion, a playable route, human technical
review or a G0–G7 decision**. Root owns task acceptance and shared TODO tracking.

[The evaluator](../../../src/domain/optics.ts) preserves the existing
`createEvaluator` four-status boundary. It validates authored content before
malformed/stale actions, returns detached JSON-compatible observations, captures
configuration revision and attempt identity, and emits no accepted effects.
No DOM, state mutation, save, browser, provider or host operation is performed.

## Reviewed authority and inputs

The [constitution](../../../.specify/memory/constitution.md),
[SPEC T04–T07/T15](../../../SPEC.md), [PLAN](../../../PLAN.md),
[T006 review](rule-source-review.md), [T014 literals](../../../tests/fixtures/physical-cases.json),
[T068 review](repair-route-fixtures.md) and [T069 definitions](repair-definitions.md)
were read before implementation. Source S06 supports budget/margin arithmetic;
S07 separately supports minimum/maximum receive and profile compatibility.
Their reviewed claims and limitations are retained in
[the unchanged source register](../../../content/spec001/sources.json).
No new source retrieval or independent human sign-off is claimed here.

The −3 dBm transmit, −14 dBm sensitivity, −1 dBm maximum, 2 dB reserve and
inclusive comparisons remain **fictional reviewed teaching parameters**. Only
these supported parameters are accepted. Levels use signed finite `dBm`; passive
loss and required reserve use finite nonnegative `dB`; a measured margin can be
negative. Branded output values keep the two dimensions distinct.

Callers supply a validated `{ id, parameters }` projection of the T069 optical
profile. Passing the entire content record is deliberately rejected: source/model
metadata is validated upstream, while this narrow evaluator must reject extra
unmodeled fields. This differs from copper's existing wider metadata adapter.
Changed thresholds, unknown profiles, unsupported fields, wrong/missing units,
nonfinite numbers, negative passive loss and missing explicit premises are
nonpunitive `content-error`, never incorrect learner answers.

## API and scope

| Challenge kind | Input action | Exact fact established |
| --- | --- | --- |
| `optical-compatibility` | `check-compatibility` | Supplied known-profile compatibility only. T07's summary does not fabricate missing detailed profile facts. |
| `optical-inspection` | `check-inspection` | Supplied aggregate compatibility and required inspection only. Even success has `preparationComplete: false`; it cannot establish an intervention. |
| `optical-preparation` | `verify-preparation` | All five explicit media/wavelength-direction/rate/connector-polarity/host checks, inspection before change and removal of the supplied connection defect. No power-budget proof follows. |
| `optical-passive` | `measure-optics` | Reviewed transmitter minus total passive loss, sensitivity, required reserve and independent upper receive bound. An optional `authoredReceive` assertion must agree exactly with that same model. |
| `optical-receive-range` | `measure-optics` | Independently supplied receive level against reviewed sensitivity, reserve and maximum; no transmitter/loss is inherited. |
| `optical-overload` | `measure-optics` | Independently supplied receive level against the reviewed maximum only; no sensitivity/reserve conclusion is invented. |

Every valid observation states its scope, rule ID, fictional-model label and
`wholeRouteProven: false` / `serviceProven: false`. Profile-based observations
also retain their profile ID. Captures copy only the two freshness fields; extra
world data cannot leak into a measurement. Returned values and captures are
independent of input objects and earlier returned observations.

Compatibility is checked before producing numerical grading or power readings.
Malformed passive author assertions are checked before compatibility and before
stale/malformed commands, so an incompatible selection cannot conceal author
errors. T06's valid independent 0 dBm observation fails overload by 1 dB; a
simultaneous claim that −3 dBm transmit through 0 dB passive loss produces 0 dBm
is instead `inconsistent-passive-model` in the content-error issue.

Arithmetic uses exact integer coefficients and decimal exponents from finite
input number spellings. Comparisons occur before conversion to displayed numeric
readings; no epsilon or rounding can turn 1.99 dB into the 2 dB boundary. This is
a deterministic teaching computation, not a dispersion, uncertainty, temperature,
aging, optical amplifier or real equipment simulation.

## Executed independent cases

[The physical suite](../../../tests/domain/optics.test.ts) executes exactly these
10 original IDs against production code: **T04, T05, T06, T07, T15, B-OPT-MAX,
B-OPT-OVER, B-OPT-RESERVE, I-PHY06, C-ERROR-INCONSISTENT**. Inputs and expected
observations come directly from the unchanged T014 oracle. Expected values are
never generated by the evaluator.

| Case | Preserved result |
| --- | --- |
| T04 | −11 dBm receive, 3 dB margin; pass |
| T05 | −13 dBm receive, 1 dB margin; reserve fails |
| T15 | −12 dBm receive, exactly 2 dB margin; inclusive pass |
| T06 / B-OPT-OVER | Independent 0/−0.99 dBm receive overloads by 1/0.01 dB |
| B-OPT-MAX | Independent −1 dBm receive is included; 13 dB margin |
| B-OPT-RESERVE | −12.01 dBm receive, 1.99 dB margin; fails |
| T07 | Known incompatible profiles remain incorrect despite a sufficient nominal budget |
| I-PHY06 | Missing action remains invalid-input with zero progress |
| C-ERROR-INCONSISTENT | Contradictory passive transmit/loss/receive remains nonpunitive content-error |

[The repair suite](../../../tests/domain/optics-repair.test.ts) executes the
physical/predicate portions of **RR-O05-ALTERNATIVES, RR-O05-NO-INSPECTION,
RR-O05-WAVELENGTH, RR-O06-ALTERNATIVES, RR-O06-RESERVE-NEIGHBOR,
RR-O06-SENSITIVITY, RR-O06-OBSERVED-MAX, RR-OPTICAL-IMPOSSIBLE**. Each candidate
is sent through the real evaluator and compared with its independent literal.
For RR-O05-WAVELENGTH the supplied false necessary predicate proves
incompatibility; the adapter does not invent an omitted positive polarity check.
The malformed passive fixture's reason is compared with `issue.code`, preserving
the shared boundary's top-level `malformed-authored-challenge` reason.

Additional adversarial cases exercise each detailed compatibility check separately,
missing inspection, an unremoved defect, zero loss, just-outside decimal boundaries,
negative margin, all three dBm parameter dimensions, finite values, unsupported
metadata, wrong/missing commands, stale revision/attempt, contradiction precedence,
detached results and bounded capture data.

Stored-measurement freshness, objective prerequisites/effects, actual intervention
state transitions, alternative selection and room integration remain T074/T079.
In particular, asserting fixture `fresh: true` and capturing a current command is
not execution of the separate RR-FRESH-* cases. The alternatives tests prove the
constituent physical predicates, not completed O05/O06. T074 must consume the
explicit scope and revalidate stored measurement versions before progression.

## Verification, retained failures and seals

All runs used the pinned Node 26.13.1/Vitest 5.1.2 installation:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/domain/optics.test.ts tests/domain/optics-repair.test.ts --maxWorkers=1
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run typecheck
```

1. First RED: one suite failed to import the absent `src/domain/optics.ts`; zero
   tests executed. Second RED, after adding repair expectations: both suites
   failed for that same absent module; zero tests executed. These are genuine
   missing-implementation failures, not claimed failed assertion counts.
2. Initial implementation GREEN: **85 tests passed**, 58 physical/adversarial and
   27 repair checks, 157 ms. Repository typecheck passed with no diagnostics.
3. Review added regression assertions before corrections: **2 failed / 88 passed**,
   193 ms. Inspection-only success incorrectly said preparation complete; capture
   copied unrelated world data and omitted rule/profile identity. The failing
   expectations were retained, and the implementation was corrected.
4. Final focused GREEN: **90 tests passed**, 62 physical/adversarial and 28 repair,
   170 ms. No test TODOs in these two suites.
5. Final repository typecheck attempt encountered the concurrently active T072
   RED phase: four TS2307 missing-module diagnostics from
   `tests/domain/radio.test.ts` and `tests/domain/radio-repair.test.ts`, both
   importing not-yet-created `src/domain/radio`. No T071 diagnostic appeared.
   Root will run the joined typecheck after that independent task reaches GREEN;
   this failed attempt is retained rather than relabeled a pass.

No browser/build/full-client run was necessary for this pure scoped evaluator.
Original source/fixtures and T069 authored records were not edited. Shared
physical/repair TODO accounting, task checkboxes and loop counters remain root-owned.

| Artifact | SHA-256 at handoff |
| --- | --- |
| `src/domain/optics.ts` | `3d4622cba1cb724837322bdd7499e60607b852f1f289b306116d19b84f766c92` |
| `tests/domain/optics.test.ts` | `f66e7e4e8a26046b62bf66a44a17250eb3faa8c0dfd8ecd1ce2c2ff68784aa32` |
| `tests/domain/optics-repair.test.ts` | `2d88e592d2708e14ce2ff66acd7e9f56563823b9066ddfb232dcd00ec71812a3` |
| `content/spec001/sources.json` | `a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116` |
| `tests/fixtures/physical-cases.json` | `de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1` |
| `tests/fixtures/repair-routes.json` | `ed3a083828188a34fd6f5f345cbd4c69fe8ebb140ea903dbafd9b3f464639877` |
| `content/spec001/profiles.json` | `93c0dfe3d40c74e68b2e4e025518e2efe1c3e82abb5438d233fddeb9b0834cc3` |
| `content/spec001/objectives.json` | `b5e2212d581caebc4419f683dc47e337dabba157dc569369f5413e13511f9b98` |
