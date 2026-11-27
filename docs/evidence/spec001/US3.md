# US3 packet journeys — T091 / AC21

2026-11-27. Worker and independent technical reviewer: Codex
`/root/loop104_t091`, separate from T090 implementation worker
`/root/loop103_t090`. All 19 planned scenarios have passing execution evidence:
10 actual application journeys and 9 explicitly isolated fault scenarios.
The narrow duplicate-status correction also passed its four affected view
reruns and visual review. T091 evidence is complete and submitted for coordinator
task acceptance. No aggregate gate, human playtest or release acceptance is claimed.

## Observed behavior

The actual application starts through New Adventure and native semantic controls;
no game state is injected. R01 pointer and keyboard checks confirm pause, manual
step, replay and the independently authored eight-symbol NQ sequence. The actual
105 m conduit shows the separately declared toy final-bit substitution, producing
`0x4E 0x50` with one mismatch at zero-based bit 15. Changing the real conduit to
95 m produces `0x4E 0x51`, `01001110 01010001`, and no mismatch. Length does not
predict the particular damaged bit.

Actual copper, fiber and radio adventures reach R12 independently. Their current
packet checks show 95 m channel length, 2 dB sensitivity reserve and 20 dB SNR,
respectively. Fiber and radio do not inherit R01's controlled copper premises.
Inspection/replay leaves existing repair observations unchanged, O12 incomplete,
and Save blocked during the activity and restored active encounter. Final
classification still requires actual fresh measurements and the separate endpoint
test.

Actual temporary restoration permits inspection after explicit E02 Continue and
a real R11→R12 revisit. Each branch's deliberate isolation displays no reception
or delivery. E03 narrative and confirmed preparation rewind retire old controls;
a new real execution supplies the next valid journey. The actual warned fatal
hazard and Retry path likewise return to preparation before new fiber validation.
No guest save writes occur and the local slot remains empty.

The nine isolated cases use a separate, explicitly labeled blank document. The
Node test harness seeds accepted training prerequisites and calls real plan
preparation, execution and navigation. The browser then loads production
registry, resolver, packet source, controller and panel. A controlled supplied
receiver produces the one-bit mismatch on usable fiber; changing that supplied
trace and replaying resamples the current data. Matching radio bits coexist with
an independently unavailable endpoint service. Four failed common prerequisites
(power/per-port constraint, supported capability, toy decoding and physical-role
claim) and three failed medium conditions suppress all recovery even when the
supplied bits match. These are genuine domain/controller runs, not full application
playthroughs or real hardware measurements. None changes the prepared state.

## Native results and genuine failure history

All runs use pinned Node 26.13.1, PHP 8.4.28, Playwright 1.65.1 with its bundled
Firefox (manifest 159.0, revision 1572), one worker, a disposable CA/NSS profile,
strict HTTPS verification and
isolated PHP storage. Production credentials/providers and owner preview processes
are not used. The command is in [loop104](../../implementation/loops/104-T091.md).

| Run | Scope | Result |
| --- | --- | --- |
| [Native1](packet-review/native1-summary.json) | Initial complete 19-case run | 10 actual journeys PASS; 9 isolated fixtures FAIL before assertions; 131.310 s |
| [Native2](packet-review/native2-summary.json) | Corrected isolated fixture loader | 9 PASS; 31.696 s |
| [Native3](packet-review/native3-summary.json) | Actual copper/fiber/radio plus scrolled result capture | 3 PASS; 41.593 s |
| [Native4](packet-review/native4-summary.json) | R01 pointer and all three actual media after status deduplication | 4 PASS; 48.591 s |

The initial isolated failures came from attempting to import a test helper through
the public development server. That boundary correctly returned 404. The corrected
Node preparation keeps it intact; no public serving exception or application
injection hook was introduced. Initial logs/traces are retained under ignored
`.local/t091/`. Public summaries include only test status, duration and first-line
failure text, with hashes of the original raw reports. Network traces and session
headers remain private local evidence.

Strict TypeScript passed against both the isolated candidate and integrated
tests. The first isolated typecheck exposed a nominal room-ID comparison, fixed
with the existing qualified-ID helper; its genuine failure is retained. The
original eight protected source/oracle inputs remain unchanged.

## Independent technical and visual review

The [identified independent review](packet-review/independent-review.md) derives
NQ and T12 directly: `0x4E = 78 = 01001110`, `0x51 = 81 = 01010001`; the authored
`−3,+1,+3,−1` maps to `00,10,11,01`, or `00101101`. Original T031 expectations
were not generated from the implementation or rewritten to pass these checks.

The source review reopened the registered primary authorities: [ITU-T X.200,
7.7](https://www.itu.int/rec/dologin_pub.asp?id=T-REC-X.200-199407-I!!PDF-E&lang=e&type=items),
[RFC 1122, 1.1.3](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3), and
[Altera AN 835, 4.2.3](https://docs.altera.com/r/docs/683852/current/an-835-pam4-signaling-fundamentals/clock-and-data-recovery-cdr?contentId=nXMAcJhwUb~wUsi5ZroOUw).
They support physical bit transmission, the distinction between Internet and
OSI architectural groupings, and actual receiver timing recovery. The numerical
toy map is project-authored. The integrated source, visible text and tests preserve
opaque-frame, declared display order, non-PAM4/non-throughput, non-FCS/non-universal
error-detection and future upper-realm caveats. Matching bits never prove a whole
route or higher-layer service. No technical teaching correction was required.

Worker104 inspected actual desktop current-copper, radio-isolation, isolated fiber
mismatch, and 390 px / 200% fiber result captures. The complete recovered-byte
comparison remains readable after scrolling. Root visual review found duplicate
identical status text from the frame and packet panel, visible in the preserved
initial captures. Root implemented the narrow presentation correction: it hides
shell feedback only when the active Packet journey's own nonempty status exactly
matches it. Native4 verifies a single visible paused status, retains different
Save errors, and confirms normal shell feedback is visible after Return. Worker104
inspected the corrected [390 px / 200% view](packet-review/captures/native4/R12-fiber-compare.png)
and [scrolled result](packet-review/captures/native4/R12-fiber-result-scrolled.png).
The exact recovered-byte/mismatch paragraph is readable; the close control remains
available. Earlier duplicate-status captures remain as genuine history.

The [pre-native4 seal](packet-review/06-pre-native4-source-seal.json) records all
127 final source/input hashes and the only three changes since the first native
run: the isolated test loader, added test capture/status assertions, and root's
presentation fix. No domain rule, authored model or original oracle changed.
The [final artifact seal](packet-review/final-artifacts.json) covers owned tests,
public summaries/captures, this review and the loop note. Source hashes and all
eight protected inputs were checked again after the last native run.

This review is agent technical/visual evidence. It is not owner satisfaction,
human networking review, beginner learning evidence, a full accessibility audit,
Safari/phone certification, full-episode media acceptance, real-provider testing,
or publication. Those requirements remain separately tracked. Temporary geometry
outside the accepted representative room earns no finished-asset credit.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
