# T068 — Independent repair-route expectations

Date: 2026-11-26. Worker: `/root/loop074_t068`. Scope: C9/C10/C12,
FR-002–006/009/010, NQ-02/03/08, O03–O12, T03–T16 and preparation for AC02/03/07/21.
This is agent technical review of an independent oracle, **not human technical
sign-off, evaluator acceptance, a completed route, or a gate decision**.

The [additive fixture](../../../tests/fixtures/repair-routes.json) contains 52 new
cases: 21 correct, 23 incorrect, two invalid-input and six content-error records.
It references the unchanged [83 frozen cases](../../../tests/fixtures/physical-cases.json)
and [T006 source register](../../../content/spec001/sources.json), preserving all
original IDs, seven reviewed profiles, thirteen primary sources and original
copper assertions. Numeric expected answers were written by hand from SPEC and
reviewed operands before any new evaluator. No application-generated answer is
used. All 52 added application executions remain explicit TODOs in the
[test file](../../../tests/domain/repair-routes.test.ts); the existing 68 pending
physical evaluator cases remain unchanged.

## Authority, sources and model boundaries

The [constitution](../../../.specify/memory/constitution.md), [root SPEC](../../../SPEC.md),
[gameplay contract](../../../specs/001-physical-layer-underworld/contracts/gameplay.md),
[data model](../../../specs/001-physical-layer-underworld/data-model.md) and
[T006 review](rule-source-review.md) govern the new cases. The task schedule
expressly permits this oracle preparation while T066/T067 review finishes;
implementation from T069 onward retains its representative-room review prerequisite.

Three primary sources were reopened on 2026-11-26 to recheck the narrow physical
claims. Other references remain the established T006 review, not a claimed new
retrieval of all thirteen documents:

| Source | Rechecked section and bounded claim |
| --- | --- |
| S06 — [Juniper QFX5130 planning](https://networkingdocs.hpe.com/documentation/us/en/hardware/qfx5130/topics/topic-map/qfx5130-network-cable-transceiver.html) | “Calculate Power Budget” and “How to Calculate Power Margin”: transmitter minus sensitivity is the power budget; subtracting link loss gives remaining margin. The corresponding receive-minus-sensitivity expression is algebraically equivalent. |
| S07 — [Cisco 10GBASE SFP+ data sheet](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html) | Table 4 and optical module descriptions provide distinct minimum/maximum receive specifications, media and wavelength directions. Connector/form-factor resemblance does not establish all required compatibility. This does not make the fiction a Cisco product simulation. |
| S09 — [Cisco Wireless Site Survey FAQ](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/68666-wireless-site-survey-faq.html) | “What is Signal-to-Noise Ratio?” supplies the power-ratio/logarithmic definition. Subtracting comparable signal/noise powers in dBm is the mathematical conversion to SNR in dB. |

The 100 m copper maximum, −3/−14/−1 dBm optical parameters, 2 dB reserve,
20 dB SNR minimum, 30 W delivered budget, capability sets and toy symbol map
remain **fictional teaching inputs**. No vendor recommendation supplies those
thresholds. Compatibility, viable path, inspected defect removal and per-port
constraints are explicit supplied premises; the oracle does not infer them from
power, a connector drawing, channel number, ally choice or arithmetic alone.

State rules, fair alternatives, hint history, branch independence and outcomes
come from the project contracts, not networking standards. Fixture candidate names
are local test labels, not new content IDs or new hardware profiles. Every result
has a limited scope: preparing a route, proving one predicate, resolving an
intervention and validating service are separate decisions.

## Independently checked arithmetic

The executable worksheet compares hand-authored literals with arithmetic on
integer hundredths. This avoids display rounding near the supplied 0.01 boundaries.
It is a test-only calculation check, not a scoring function or a production
precision policy. It imports no application module.

| Cases | Independent calculation and conclusion |
| --- | --- |
| T04 | −3 dBm − 8 dB = **−11 dBm**; −11 − (−14) = **3 dB**. Reserve ≥2 dB and receive ≤−1 dBm both hold. |
| T05 | −3 − 10 = **−13 dBm**; −13 − (−14) = **1 dB**. Above sensitivity, but below the separate 2 dB reserve. |
| T15 | −3 − 9 = **−12 dBm**; −12 − (−14) = **2 dB**. The inclusive reserve boundary passes. |
| Optical neighboring/sensitivity limits | Loss 9.01 dB gives −12.01 dBm and 1.99 dB: fail reserve. Loss 11 dB gives exactly −14 dBm sensitivity and zero reserve: fail reserve. Zero loss gives −3 dBm and 11 dB margin. |
| T06 / upper receive bound | Independently supplied 0 dBm exceeds −1 dBm by 1 dB. Supplied −1 dBm is included and has 13 dB margin; −0.99 dBm exceeds the maximum by 0.01 dB. These receive-only cases do **not** inherit a −3 dBm transmitter. |
| Inconsistent passive author data | −3 dBm transmit minus 0 dB passive loss is −3 dBm. A simultaneous authored claim of 0 dBm receive is content-error, distinct from T06's valid supplied observation. |
| T08 / T09 | −65 − (−90) = **25 dB**, passing the declared minimum; −65 − (−78) = **13 dB**, failing by 7 dB. No throughput conclusion follows. |
| Radio boundary | Noise −85 dBm gives 20 dB, included; −84.99 dBm gives 19.99 dB, excluded. A channel change without a new observation establishes neither result. |
| Copper alternatives | 85+10=95 m with 5 m headroom; 90+10=100 m with zero headroom. Both compatible, intact passive alternatives meet the inclusive length maximum; an open required conductor still defeats continuity. |
| T10 / power alternatives | 12+11+10=33 W, exceeding 30 W by 3 W. Alternative totals 12+11=23 W and 12+11+7=30 W leave 7/0 W. All quantities use the delivered-after-losses boundary. |
| T11 | {1000/full,100/full} ∩ {100/full,10/half} is only **100/full**. No fallback or ranking rule is added. |
| T12 | −3,+1,+3,−1 maps to 00\|10\|11\|01 = **00101101**, eight represented bits in four symbols. Both untimed methods accept that same answer; no bits-per-second conclusion is possible. |

`dBm` is an absolute logarithmic power unit; `dB` is used for loss, margin and SNR.
Negative dBm is valid; negative passive dB loss is invalid author data in this
model. Wrong/missing units, unknown authored profiles and unreviewed regeneration
remain content errors. The frozen `Mb/s` and `toy-level` labels remain untouched:
save-v1 uses `Mbps` and has no `toy-level` reading. Future adapters must explicitly
validate the representation without expanding the save schema or changing the oracle.

## Objective coverage and alternatives

The fixture's `objectiveCoverage` records exact original and added case IDs. This
table summarizes the finite alternatives and boundaries specified by current
contracts. Future authored routes or profiles need additional independent cases
before scoring; this review is not blanket approval of unknown future alternatives.

| Objective | Added alternatives and decisive boundaries; frozen cases retained by reference |
| --- | --- |
| O03 | Replace the diagnosed section or choose an intact compatible alternate passive path at 95/100 m. One remaining conductor or incompatible termination blocks preparation; T01/T02 and 100/100.01 m edges remain fixed. |
| O04 | Conventional tool or equivalent ally reveals the same open-before/intact-after evidence. A powered repeater with an unchanged break fails. A two-segment regeneration topology without separately reviewed segment limits is content-error. |
| O05 | Inspect then clean or replace the defective connection with all compatibility predicates true. Missing inspection or one wavelength-direction mismatch fails despite connector resemblance/numeric budget. |
| O06 | Distinct 8/9 dB paths both pass, including exact reserve equality. 9.01/11 dB loss, overload, zero loss, incompatibility and malformed units/profile/passive-model claims are covered. |
| O07 | Supplied viable existing alignment or alternate path can prepare radio with compatible settings. Explicit failed path is incorrect; omitted authored path is content-error. |
| O08 | Two scenario channel/path observations at 25/20 dB pass. 13/19.99 dB fail; changing a channel without remeasurement cannot certify mitigation. No real channel number or ranking is implied. |
| O09 | Two compatible kits totaling 23/30 W pass alongside the common 100/full option. Same form factor, aggregate headroom or power cannot override PHY/media/port constraints. A PSE-output budget cannot substitute for a delivered budget without a model. T10 and 30/30.01 W edges remain fixed. |
| O10 | Step-and-decode or notebook-and-replay yields the same ordered toy pattern and common capability without timing scores. Correct bits cannot excuse a false address-discovery claim. Missing authored sample positions is content-error; frozen wrong-order/unsupported-symbol/no-common-mode cases remain. |
| O11 | Three explicit cases contain only O01/O02, the chosen branch pair and O09/O10, with no other branches, optional rewards or future realm. Mixed branches or missing O10 fail. Intentional isolation is distinct from restoration; safe precommit return preserves inventory. |
| O12 | Fresh physical and endpoint proof supports E01 or documented E02; identified unresolved defect plus deliberate isolation/recovery plan supports E03 without restored service. Arrival/link-up alone, failed endpoint, temporary-as-permanent, missing follow-up and unintended outage cannot receive the corresponding ending. Hints never downgrade technical success. |

Freshness is checked in separate cases for configuration revision, attempt identity
and explicit stale flag; any one failure makes submitted proof unusable. The
measurement remains visible. Matching all freshness fields does not itself prove
the physical result passed. Revision 8 in a different attempt is a deliberate
adversarial fixture, not a claim that normal retry should reuse that revision.

Both Retry and E03 Continue restore the preparation inventory and completed
objectives, preserve newly learned facts, personal notes and hint history, advance
the attempt identity and revision beyond the attempt's highest revision, and make
all prior readings stale. Neither writes an implicit save nor creates another
persistent slot. Restore Save remains a different operation. Replayed effects have
zero additional rewards/consumption; interrupted unaccepted transitions have no
partial rewards/consumption and are not graded as physical mistakes.

## Exact implementation dependencies

Only copper length/continuity/content-boundary primitives and the toy packet
decoder currently exist. Their individual successes cannot execute these full
route scenarios. No adapter has been fabricated to return expected results.

| Dependency | Missing execution needed before an application TODO can become a real pass |
| --- | --- |
| T069–T073 | Authored profiles/alternatives and full copper compatibility, `src/domain/optics.ts`, `radio.ts`, `power.ts`, `capabilities.ts`. The latter four modules do not exist at review time. Regeneration still needs a separately reviewed model before any supported topology can be added. |
| T074–T080 | `src/state/objectives.ts`, `src/state/repair-plan.ts`, objective/content/controller integration, inspectable before/after evidence, fresh measurements and route-specific R03–R12 actions. |
| T084–T088 | Encounter preparation integration, commitment/return controls, `src/state/outcomes.ts` classification and Retry/E03 Continue recovery UI. Generic earlier state tests do not certify these authored encounters. |
| T078/T081/T089/T105/T160 | Actual independent browser routes, integrated world/outcomes, comprehensive gameplay and human technical review. None is established by fixture integrity. |

`src/domain/types.ts` defines conceptual four-status results and world versions,
but there is no complete repair-route interface to invoke. Test input/observation
fields are semantic expectations, not a preemptive production API design. Later
adapters must bind them to actual challenge/action/world interfaces while preserving
typed units, supplied premises, stable case IDs and the expected scope.

## Verification and seals

After loop073 explicitly released the CPU reservation, ran these commands with
the pinned Node 26.13.1 runtime and installed Vitest 5.1.2:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/domain/repair-routes.test.ts tests/domain/physical-cases.test.ts tests/domain/copper.test.ts --maxWorkers=1
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run typecheck
```

Both exited 0. The focused run passed **316 checks with 120 TODOs across three
suites**, duration 603 ms: new route fixtures **98 passed / 52 TODO**, unchanged
physical fixtures **165 passed / 68 TODO**, existing copper behavior **53 passed**.
Typechecking emitted no diagnostics. There were no failed test attempts in this
task. No new route/evaluator behavior or RED run is claimed: the 52 new application
executions remain TODO. Full-client/build/browser/API runs remain outside this
isolated test/evidence scope. Original seals, local document links and whitespace
are checked separately in the loop note.

| Protected original | SHA-256 |
| --- | --- |
| `content/spec001/sources.json` | `a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116` |
| `tests/fixtures/physical-cases.json` | `de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1` |
| `tests/domain/physical-cases.test.ts` at task start | `3f4cbf1ad84141028bd7e81b71a06cdb73ae7984e4857bb22a19b4586217d252` |
| `tests/domain/copper-case-ids.ts` at task start | `e62715c273f39e6ab8df706b5e45c51cbad3d43140d5ed2c745be6974aef7b36` |

The first two seals are enforced by the new fixture suite. The test-code seals
record unchanged historical assertions for this task; they do not forbid later
activation of real evaluator tests under their owning tasks. New artifact seals
and executed commands are recorded in [loop 074](../../implementation/loops/074-T068.md).

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
