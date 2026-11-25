# T006 — Physical rule sources and independent expectations

Date: 2026-11-25. Scope: pre-implementation source and arithmetic review for C9/C10,
FR-003–006, NQ-02/03, LO1–LO6, O01–O12 and AC03/AC21. Author/reviewer: Codex
implementation worker, loop 008. This is an agent-performed technical review, **not human
technical sign-off**. T160 human review, T014 fixture transcription, evaluator execution,
browser evidence and release acceptance remain pending.

The companion [source register](../../../content/spec001/sources.json) contains exact source
sections, retrieval dates, bounded claims, fictional profiles, T01–T16 and additional review
cases. It is evidence data, not the future content schema or an executable rule implementation.
Case expected values were written from the contract and arithmetic before any evaluator exists.
The [calculation worksheet](verify-rule-review.py) checks those literals independently using
Python's standard library; it does not calculate game scores or validate an application.

## Authority and provenance

Three authorities remain separate:

1. **External technical support:** the primary publications below support physical concepts,
   formulas and profile-specific limitations. A working-group home page alone is insufficient.
2. **Authored scenarios:** root [SPEC.md](../../../SPEC.md#learning-model-and-independent-cases)
   supplies the fictional numbers and toy mappings. Additional review cases declare their own
   values; none is an IEEE requirement or a real-product simulation.
3. **Design/state invariants:** freshness, invalid content, fair alternatives, preparation
   rollback and ending classification come from C9/C10, SPEC and the
   [gameplay contract](../../../specs/001-physical-layer-underworld/contracts/gameplay.md).
   They must not be falsely attributed to a networking standard.

All source summaries are paraphrases. No third-party manual or image is redistributed here.
Publication dates are retained only when visible; `null` means not established, not an inferred
publication date. All listed primary documents were opened on 2026-11-25. Where browser
extraction omitted table rows, public publisher HTML/PDF was read directly as noted in JSON.

| ID | Exact primary reference and reviewed location | Supported use |
| --- | --- | --- |
| S01 / REF01 | [ITU-T X.200 (07/1994)](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-X.200-199407-I!!PDF-E&lang=e&type=items), §§7.7.2, 7.7.3.3–4, 7.7.4.4; printed pp49–51 | Bit transmission and relaying; physical-medium and timing context |
| S02 / REF07 | [RFC 1122](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3), §1.1.3 | Internet-stack context; no claim that seven mandatory independent wire headers exist |
| S03 | [Cisco 800 Series hardware guide](https://www.cisco.com/c/en/us/td/docs/routers/access/800/hardware/installation/guide/800HIG/appendix.html), Technical Specifications → Cable Specifications → Maximum Cable Length | A precise product-specific copper length reference |
| S04 | [Fluke, What's Wrong with My Cable?](https://www.flukenetworks.com/blog/cabling-chronicles/whats-wrong-my-cable), Failures of the Five Wiremap Tests | Continuity and open-circuit diagnosis |
| S05 | [IBM LAN, Frame-Relay and ATM Support, SC41-5404-01](https://public.dhe.ibm.com/systems/power/docs/systemi/v5r4/en_US/sc415404.pdf), Chapter 5 → Ethernet topologies → Repeater hubs, PDF p101 | Historical wired repeater behavior; not wireless extender behavior |
| S06 / REF05 | [Juniper QFX5130 cable/transceiver planning](https://networkingdocs.hpe.com/documentation/us/en/hardware/qfx5130/topics/topic-map/qfx5130-network-cable-transceiver.html), Calculate Power Budget and Power Margin for Fiber-Optic Cables, both calculation subsections | Budget and loss arithmetic; not the fixture's thresholds |
| S07 | [Cisco 10GBASE SFP+ modules](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html), Platform support and Tables 3–4 | Media/profile and maximum/minimum receiver bounds |
| S08 / REF06 | [Cisco wireless troubleshooting](https://www.cisco.com/c/en/us/support/docs/smb/wireless/CB-Wireless-Mesh/1902-tz-Troubleshooting-Traditional-Cisco-Wireless-Network.html), physical/environmental checks, connectivity tests and SNR | Separate power, link and endpoint observations; radio prerequisites |
| S09 | [Cisco Wireless Site Survey FAQ](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/68666-wireless-site-survey-faq.html), What is Signal-to-Noise Ratio (SNR)? | Power-ratio definition; dB arithmetic |
| S10 | [NETGEAR PoE standards and compatibility](https://kb.netgear.com/12902/Power-over-Ethernet-PoE-standards-and-compatibility), introductory PSE/PD definition, PoE budget, PoE class table headings | Distinct source and delivered-power accounting; aggregate budget |
| S11 / REF04 | [Cisco Ethernet auto-negotiation](https://www.cisco.com/c/en/us/support/docs/lan-switching/ethernet/10561-3.html), When to Use Ethernet 10/100 Mb Auto-Negotiation | Advertised speed/duplex abilities; explicitly scoped legacy behavior |
| S12 | [Altera AN 835](https://docs.altera.com/r/docs/683852/current/an-835-pam4-signaling-fundamentals/naming-conventions?contentId=3pjo4rivWRA3S_3guTsLHg), §2.1 Naming Conventions and Table 4 | Four levels/two represented bits and coding caveat |
| S13 | [Altera AN 835, CDR](https://docs.altera.com/r/docs/683852/current/an-835-pam4-signaling-fundamentals/clock-and-data-recovery-cdr?contentId=nXMAcJhwUb~wUsi5ZroOUw), §4.2.3 | Physical sampling/timing context; no NTP lesson |

REF02/REF03 remain discovery pointers, not verified IEEE clause citations. This review uses
the precise vendor/ITU references above and does not claim complete IEEE 802.3/802.11 compliance.
REF05's broad PTX PDF pointer is replaced for this narrow claim by the directly inspected QFX
calculation section. The original specification source IDs are preserved in the JSON aliases.

## Findings and model limits

- **Compatibility precedes arithmetic.** A recognized but incompatible choice is `incorrect`;
  an unknown authored profile is `content-error`. Optical media, mode, wavelength direction,
  rate, connector/polarity, host support and applicable power constraints belong to an explicit
  profile. Equal shell shape, connector shape or a sufficient budget cannot establish them.
  Radio also needs a viable declared path and mutually supported settings. There is no
  universal ban on every SMF/MMF combination: S07 includes profile-specific exceptions.
- **Copper:** length and continuity are separate checks. A severed required conductor with no
  alternate path remains disconnected when a repeater is merely added. This is an inference
  from the diagnosed break plus the repeater's receive/relay role, not a quoted standard rule.
  Replacing the broken section and retesting is a different action. A designed regeneration
  path requires individually compatible, intact, powered segments and its own reviewed limits;
  adding a repeater does not silently reset the fictional 100 m profile or authorize unlimited
  hubs. No regenerative repair topology is graded by the current profile.
- **Optics:** `receive = transmit − loss`; `margin = receive − sensitivity`.
  Compare both `margin >= required reserve` **and** `receive <= maximum receive`.
  S06's concluding example wording must not be generalized into “positive margin proves no
  overload”; the upper bound is separately supported by S07. The fiction has no gain, loss
  uncertainty, dispersion model, wavelength conversion or real equipment certification.
- **Radio:** `SNR_dB = signal_dBm − noise_dBm` follows from the logarithmic power ratio.
  The fictional 20 dB minimum and inclusive edge are authored. No channel number is universally
  best; measurements apply to this scenario/configuration. Passing does not guarantee a
  throughput, application, coverage area or regulatory approval.
- **Power:** 30 W is aggregate **delivered** capacity after losses, not a 30 W PSE label.
  All fictional endpoint demands use that same boundary. Each port/device must already be
  compatible. Do not import real PoE classes, voltage negotiation or vendor priority behavior.
- **Negotiation/symbols:** T11 is an intersection of two toy capability sets with both ends
  negotiating. It does not model forced modes, parallel detection, master/slave or PAUSE.
  T12's linear labels are the authored toy map; real PAM4 commonly uses a different Gray map.
  Two represented bits per symbol establish neither useful bits/second nor a complete PHY.
  Sampling is stepped and untimed; no minigame performance gates O10.
- **Packet scope:** NQ is highlighted payload inside an opaque upper-interface frame.
  Known-pattern comparison is a laboratory observation. It is not Ethernet FCS validation or
  a claim that all Layer 1 technologies detect all errors. Upper layers remain explanatory.

## Literal T01–T16 expectations

The complete typed input and expected observation records are in `referenceCases` in JSON.
“Correct” below means the named scoped predicate, not automatic completion of an entire route.

| Case | Independent calculation or reasoning | Expected scoped result |
| --- | --- | --- |
| T01 | 85 m + 10 m = 95 m; 100 − 95 = 5 m headroom | Length correct; other predicates still required |
| T02 | 95 m + 10 m = 105 m; 105 − 100 = 5 m excess | Incorrect, length exceeded |
| T03 | Required path has an open; added repeater does not restore it | Incorrect, no connected path |
| T04 | −3 dBm − 8 dB = −11 dBm; −11 − (−14) = 3 dB; 3 ≥ 2; −11 ≤ −1 | Optical power checks correct |
| T05 | −3 − 10 = −13 dBm; −13 − (−14) = 1 dB; 1 < 2 | Incorrect reserve, despite sensitivity being met |
| T06 | 0 dBm > −1 dBm; 1 dB over the maximum | Incorrect overload |
| T07 | Known incompatible optic/fiber pair, regardless of sufficient budget | Incorrect compatibility before arithmetic |
| T08 | −65 − (−90) = 25 dB; 25 ≥ 20 | Radio check correct when other prerequisites hold |
| T09 | −65 − (−78) = 13 dB; 13 < 20, shortfall 7 dB | Incorrect; fresh reading needed after mitigation |
| T10 | 12 + 11 + 10 = 33 W; 33 − 30 = 3 W excess | Incorrect delivered-power budget |
| T11 | {1000/full,100/full} ∩ {100/full,10/half} = {100/full} | Correct common option 100/full |
| T12 | −3,+1,+3,−1 → 00,10,11,01 → 00101101 | Correct: 8 represented bits in 4 symbols |
| T13 | Measurement configuration revision differs after a repair | Stale; submission cannot count as current validation |
| T14 | Missing unit OR negative passive loss OR unknown authored profile | Content error; zero attempt penalty and zero progress award |
| T15 | −3 − 9 = −12 dBm; −12 − (−14) = 2 dB exactly | Correct inclusive reserve boundary |
| T16 | Two different choices each meet every declared predicate | Both correct; no preferred animation/index/ally |

T06 is a **separate supplied receive observation**, not a negative-loss variation of T04.
With T04's −3 dBm transmitter and passive loss ≥0, receiving 0 dBm would be impossible.
An author asserting both would create `content-error`, not a learner overload mistake.

## Complete rule and objective coverage

Each JSON `rules` entry provides correct, incorrect, boundary and invalid-input examples with
literal outcomes. Categorical boundaries test the last missing condition or the limits of the
claim, rather than inventing numeric thresholds. Supplementary case IDs start with `B-` or
`C-`; they never renumber original T cases.

| Rule | Proposed predicate / model | Objectives | Independent case coverage |
| --- | --- | --- | --- |
| PHY01 | Separate power/link observations | O01 | C-PWR-OBS, C-PWR-INFER, B-PWR-ONLY |
| PHY02 | Name endpoints/path; distinguish fact, hypothesis and layer scope | O02/O10 | C-SCOPE, C-SCOPE-WRONG, B-SCOPE |
| PHY03 | Compatible selected profiles and preparation inspection | O03/O05/O07/O09 | C-COMPAT, T07, B-COMPAT |
| PHY04 | Copper length within declared channel maximum | O03/O04 | T01/T02, B-COPPER-100, B-COPPER-OVER |
| PHY05 | Required continuity and bounded repeater role | O03/O04 | C-CONTINUITY, T03, B-CONTINUITY |
| PHY06 | Optical receive bounds and reserve | O05/O06 | T04/T05/T06/T07/T15, B-OPT-MAX, B-OPT-OVER, B-OPT-RESERVE |
| PHY07 | Radio prerequisites and scenario SNR | O07/O08 | T08/T09, B-RADIO-20, B-RADIO-BELOW, B-RADIO-PATH |
| PHY08 | Compatible equipment and delivered-power allocation | O09 | C-POWER, T10, B-POWER-30, B-POWER-OVER |
| PHY09 | Common advertised capability | O09/O10 | T11, C-NEG-WRONG, B-NEG-NONE |
| PHY10 | Toy-symbol decoding with stated sampling | O10 | T12, C-SYMBOL-WRONG, B-SYMBOL, B-TIMING |
| PHY11 | Known payload comparison within opaque frame | O01/O10/O12 | C-PACKET, C-PACKET-DIFF, B-PACKET |
| STATE01 | Measurement freshness and retry generation | O04/O06/O08/O11/O12 | C-FRESH, T13, B-RETRY |
| STATE02 | Validate source data before grading input | All | C-VALID, C-VALID-WRONG, B-LOSS-ZERO, T14 variants |
| STATE03 | Equivalent solutions and deterministic application | All | T16, C-ALT-INVALID, B-REPLAY, B-INTERRUPT |
| STATE04 | Evidence-based intervention/ending classification | O11/O12 | C-E01, C-E02, C-E03, C-END-WRONG, B-ENDPOINT |

The original story graph remains O01→O02→one of O03/O04, O05/O06 or O07/O08; common
O09/O10 then O11/O12. Other branches, companion collection, optional rewards and future realms
cannot become mandatory. Hypothesis wording is not a secret answer key; recording a hypothesis
does not make it an observed fact. Assistance is recorded separately and never invalidates a
technically valid route. Optional practice reuses reviewed predicates, or requires new review
before introducing a new scored rule.

Freshness requires matching configuration **and attempt**, with no explicit stale flag.
Retry/E03 Continue advances generations while restoring preparation/inventory and retaining
learning; it cannot revive old evidence. `incorrect` for a stale submitted proof describes the
proof's insufficiency, not a false physical measurement or an invented fifth evaluator status.
An empty/malformed learner action is `invalid-input`; broken authored data is `content-error`.
Neither is a technically wrong learner solution. No content error awards progress or penalizes
an attempt. Actual scoring/penalty design must stay within the governing contracts.

## Execution and remaining evidence

Run `python3 docs/evidence/spec001/verify-rule-review.py` from repository root. It checks literal
arithmetic, capability intersection, symbol/payload reconstruction, T01–T16 coverage, all twelve
objectives, source/profile/case references and the review-case categories. Its result is a
worksheet consistency check, never a passed domain test suite. It imports no application code.

The exact result is recorded in [loop 008](../../implementation/loops/008-T006.md). T014 must
transcribe these expectations without replacing them with evaluator-generated answers; T013/T015
must implement the real schemas/semantic checks. Any additional route, module profile, channel
plan, symbol mapping or newly scored teaching claim needs its own source/model/cases before
implementation. Human technical review at T160 and observed complete gameplay remain unverified.
