# T091 independent packet review — preparation

Reviewer: Codex worker `/root/loop104_t091`, separate from T090 implementation
worker `/root/loop103_t090`. Review date: 2026-11-27. This is an identified agent
technical review, not an owner review, a human networking review, or beginner
playtesting. T091 and AC21 remain pending until the integrated source and actual
browser evidence are reviewed. No shared application was executed for this
preparation.

The reviewed authorities are constitution C1/C10/C14, SPEC.md NQ-13/AC21 and
“Packet perspective and encapsulation”, FR-006, the gameplay contract, the
accepted T031 fixture and the unchanged T032–T034 R01 implementation. The T090
draft is a proposal, not integrated behavior. Original fixtures are read-only.

## Independent arithmetic

| Quantity | Independent derivation | Required visible value |
| --- | --- | --- |
| N | `4 × 16 + 14 = 78 = 64 + 8 + 4 + 2` | `0x4E`, `01001110` |
| Q | `5 × 16 + 1 = 81 = 64 + 16 + 1` | `0x51`, `01010001` |
| Highlighted NQ | Concatenate those bytes in the declared display order | `0100111001010001` |
| NQ toy pairs | Split the independently derived string into two-bit groups | `01,00,11,10,01,01,00,01` |
| NQ toy levels | Apply authored `00→−3,01→−1,10→+1,11→+3` | `−1,−3,+3,+1,−1,−1,−3,−1` |
| T12 | Supplied `−3,+1,+3,−1` maps to `00,10,11,01` | `00101101`; four symbols, eight represented bits |
| Final-bit mismatch | `0100111001010000` differs only at zero-based bit 15 | `0x4E 0x50`; one differing bit |

These are literal expectations, not values obtained from encoder output. The
display is most-significant-bit first inside each byte. It makes no Ethernet
serialization assertion. Two highlighted bytes are neither a complete Ethernet
frame nor the whole transmitted traffic. Four discrete toy levels convey two
represented bits per symbol in this declared map; no time quantity, useful
bitrate, modulation voltage, full PAM4 PHY or actual clock recovery follows.

## Primary-source inspection

The source register was read before reopening these sources on 2026-11-27.
No new numeric physical profile or scored rule is introduced.

- [ITU-T X.200, sections 7.7.2–7.7.4.4](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-X.200-199407-I!!PDF-E&lang=e&type=items): the physical layer supplies bit transmission across physical media; the text also includes fault notification and optional recognition. Therefore the UI correctly rejects **universal** error detection/FCS claims without asserting that real PHYs never detect errors. This architectural source does not validate the fictional cable or toy-symbol thresholds.
- [RFC 1122, section 1.1.3](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3): the Internet architecture distinguishes application, transport, Internet and link functions. Seven fantasy realms are explanatory structure, not seven mandatory independent wire headers. This historical architecture reference is not modern deployment advice.
- [Altera AN 835, section 4.2.3](https://docs.altera.com/r/docs/683852/current/an-835-pam4-signaling-fundamentals/clock-and-data-recovery-cdr?contentId=nXMAcJhwUb~wUsi5ZroOUw): actual high-speed serial receivers need clock/data recovery. Explicit ordered samples in this activity do not implement CDR. The exact toy map comes from the project's declared profile, not this vendor note.

## Review findings and required runtime distinctions

1. The accepted R01 controlled copper bench checks the current selected conduit's
   length. Its continuity, compatibility, power and other conditions are separately
   supplied premises. Initial `105 m > 100 m` fails; actual conduit change gives
   `95 m ≤ 100 m`. The final-symbol substitution is a separately authored toy
   trace. Cable length cannot predict a specific damaged bit. Current R01 prose
   preserves that distinction.
2. R12 must evaluate the actual executed route and shared equipment, power,
   capability and calibration conditions. The proposed separate repair source
   preserves this boundary; reusing a pretend passing copper result for fiber or
   radio would fail review. Every phase must reread the trusted current scenario.
3. A usable route with a separately supplied mismatch may expose the mismatching
   trace. Failed physical/common prerequisites must suppress reception entirely,
   even if the supplied trace happens to match. Deliberate isolation must expose
   no recovered trace or delivered success.
4. Matching NQ is a scoped comparison only. It must neither complete O12 nor
   create a link measurement, endpoint test, outcome or save. The supplied endpoint
   response is independent; `service-unavailable` and matching NQ can coexist.
5. R01's bench premises and length/substitution explanation cannot describe the
   R12 fiber/radio display. R12 needs explicit current-route context and a separate
   endpoint caveat. The generic six future-realm rows and opaque-frame limitations
   remain applicable to both.
6. Close must restore the prior active encounter; replay must restart paused.
   E03 narrative and preparation rewind must revoke the old packet activity.
   Packet viewing after a new execution must reflect the new execution. Optional
   preview timing may never become a learning or progress requirement.

No source/content correction was requested by the preparation review.

## Integrated source review, before browser execution

Worker103 subsequently integrated the reviewed design. Worker104 independently
read `src/state/repair-packet.ts`, the added `inspectExecutedRepair` helper,
`src/state/packet-activity.ts`, the UI/controller branch, exact encounter admission,
the application resolver composition, R12 authored action/dialogue and both
context documents. This is a source review; browser execution is still pending.

- The application passes the same `repairScenario` closure to repair, outcomes
  and packet controllers. R12 invokes the actual medium/common checks; it does
  not manufacture a copper evaluation for fiber or radio.
- The opaque repair source preserves captured immutable game/version identity,
  calls the trusted resolver at each inspection and invokes the original
  encoder/decoder/comparator. No received trace survives a failed path/common
  predicate or deliberate isolation. Authoring errors remain distinct from
  learner errors.
- Inspection returns empty accepted effects and zero progress/penalty. Opening
  acquires the existing pending-effect lock; closing cancels the exact owned lock
  and restores its prior active-encounter state. New source/attempt ownership
  prevents old callbacks from affecting replacement state.
- The new authored action has no effects, requires actual O11 completion, and
  admits only the precise R12 terminal Look. E01/E02 viewing requires explicit
  Continue; E03 narrative is excluded. Broader generic gameplay admission is
  unchanged.
- The final isolation prose explicitly says no transmission is attempted. It
  avoids displaying the domain's failed-transmission status as an incorrect
  safety choice. The separate endpoint sentence and unchanged upper-realm caveats
  maintain their scoped claims.

No technical correction was found in that integrated source review. Final
runtime findings and exact run seals will be added to `docs/evidence/spec001/US3.md`.
Whole-episode technical review, human evidence, real providers, media acceptance
and release gates remain separate.

## Completed scoped runtime review

The [US3 report](../US3.md) now records ten actual native application journeys,
nine isolated domain/controller scenarios, and the genuine failed initial
isolated loader attempt. The retained native captures and test assertions agree
with the arithmetic and teaching boundaries above. Worker104 inspected desktop
copper, radio isolation, supplied fiber mismatch and narrow 200% fiber comparison.
Root's duplicate-status presentation finding was corrected and four affected
actual cases passed again, including unique visible status and restored feedback.
No technical teaching/oracle change was needed. Coordinator task acceptance and
all separately required human/episode/release evidence remain outside this review.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
