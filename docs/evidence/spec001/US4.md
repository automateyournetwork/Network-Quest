# US4 — independent prepared browser persistence evidence

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

**Final local result:22 independent T056 cases and15 prior cases PASS (37/37,2.7m),
including the normal typecheck/save-policy/build wrapper.**

T056 / loop065, 2026-11-26. Worker `/root/loop065_t056`; coordinator acceptance
pending. Governing sources: C6/C12/C14/C15, NQ-10/11/12, FR-010–016, AC11/12/13/17,
`tests/fixtures/save-conformance.json` (T036), and the save/API/gameplay contracts.
The independently authored fixture expectations remain unchanged.

## Scope and method

The three T056 suites use the actual composed application in Firefox on disposable
strict HTTPS, real PHP8.4.28, private dedicated SQLite storage and the actual route
factory. No application state, identity selector, authentication bypass or fixture
content IDs are injected into the public application. The shared private CLI fixture
creates synthetic sessions and purpose-specific reauthentication proofs, expires a
session, reads isolated storage, prepares an unsupported stored version, or prepares
a pending/expired deletion ledger state. These are explicit setup operations, not
provider authentication or real crash recovery.

Provider authorization URLs are intercepted before reaching Google/GitHub. Native
auth-start and session checking still execute; synthetic cookie installation is
never reported as an OAuth callback. `forwardNative` forwards only four allowlisted
mutation/status routes to this fixture's exact local origin, trusts only its CA,
limits response bytes and lets tests hold or drop the response. This distinguishes
a committed write from a failure before service admission. Browser mutations carry
actual Origin/Referer and cookies, without `ignoreHTTPSErrors` or global TLS changes.

The tests observe native DOM, requests, exact private stored bytes and server
revisions. No expected puzzle answer is generated from implementation output.
Full-story encounters, real providers, separate physical devices, actual Safari,
finished-media review and owner acceptance are outside this prepared local result.

## SAVE traceability

| Case | Prepared native evidence | Remaining scope |
| --- | --- | --- |
| SAVE01 | Actual guest room, kit, clues and literal notes survive explicit cancellation of both provider windows; no save or persistent browser draft. | Real-provider denial and actual blocked-popup environments remain T057/browser acceptance. |
| SAVE02 | Distinct synthetic Google/GitHub accounts write independent slots; Firefox actually closes and reopens before each provider returns to its own room/notes/kit. | Real provider login and physical cross-device acceptance remain T057. |
| SAVE03 | Empty-slot manual adoption, existing-slot cancel, explicit load replacing unsaved inventory/notes, and explicit replacement. | Full episode inventory/recruit restoration joins later story work. |
| SAVE04 | Initial account opt-out produces no PUT on actual safe room changes. | Complete objective/encounter boundary integration later. Server opt-out races are covered separately by T054. |
| SAVE05 | Explicit conditional opt-in explains same-slot behavior; notes join next safe arrival; one slot advances once. New Adventure cannot auto-adopt/replace. | Full-story safe preparation acceptance later. |
| SAVE06 | Actual packet activity blocks manual save and automatic writes; prior slot survives. | Fatal/E03/transition and Retry retained-learning integration are still T089. Their pure prepared-state contracts remain separate evidence. |
| SAVE07 | Two native tabs read one revision; stale writer gets conflict, Keep Playing retains local notes and explicit Restore replaces them. | Real overlapping process transaction schedule is T054; separate real devices T057. |
| SAVE08 | Actual committed response is dropped; another tab advances the slot; exact original bytes/key retry acknowledges old operation and requires current-slot reconciliation. | Changed write-policy/process races remain T054's separate independently checked service evidence. |
| SAVE09 | Offline read/write failure, reconnect frozen retry with newer notes dirty, actual expiry at PUT admission, and both save/logout ordering outcomes. | Real network/provider reauthentication journeys remain T057. |
| SAVE10 | Native PUTs with a client accountId, unsupported contentVersion and262145-byte body are rejected422/422/413 with both account slots intact; unsupported stored versions remain protected. | Broader structural/semantic/reference/Unicode vectors remain separate T042/T053/T054 evidence; these three variants do not replace them. |
| SAVE11 | Native unsupported older `0.9.0` and newer `99.0.0` keep exact stored bytes and revision. | T036's migration baseline explicitly uses hypothetical fixture-only registries. Its exact expected migration is checked by T048, not installed as production content. The actual app has current `1.0.0` policy and no historical migration chain; future door/position migration remains T144. |
| SAVE12 | Actual lost DELETE/completed receipt, prepared pending/expired ledger states, unknown receipt with expired session, network failure/reload and late completed response after a later account is active. Status never repeats DELETE/sign-in; guest session never proves deletion. | Actual provider recent-authentication, host retention, live crash/recovery and backup-erasure acceptance remain T057/T166 and host gates. |
| SAVE13 | Cancel preserves request count and notes; confirmed logout clears title/editor without a save; later synthetic same-account session restores durable notes. Delayed save before/after logout preserves correct commit order and cannot resurrect UI. | Real-provider return remains T057. |

This table deliberately records partial case scope. It does not mark all SAVE01–13,
US4, AC11/12/13/17 or G2 accepted from local prepared tests.

## Environment and retained evidence

Pinned Node26.13.1/npm11.20.0, PHP8.4.28, Playwright1.65.1; native Firefox159 with
per-test NSS CA/profile. macOS26.6.2/Darwin arm64, Mac16,7. Runtime setup is detailed
in [runtime.md](runtime.md). All tests use a synthetic ledger retention policy;
the actual account UI correctly says production backup policy is unverified.
No real credentials, provider sessions, player records or host configuration were
read. Private traces/screenshots/logs remain ignored under `.local/T056-*` and may
contain synthetic session/receipt headers; they are not publication artifacts.

Initial run01: 19 fixture-setup failures because the new helper explicitly started
tracing already managed by Playwright. No product assertion ran. Removed the
redundant tracing calls; retain run01 and its original failure traces.

Run02:6 PASS/13 FAIL; run04 after fixture correction:15 PASS/4 FAIL.
Run03 stopped before browsers on an unrelated concurrent missing T061 module.
Three run04 failures were test action/race setup mistakes. The fourth exposed an
early deletion-status timer that root reproduced deterministically and fixed.
Run05:37 PASS, including all22 final T056 cases and15 prior native cases. The test fixture's retained `PDOStatement`
from `inspect-slot` left a SQLite read cursor open across browser requests. A
separate disposable two-connection probe demonstrated blocked writes with that
cursor and successful writes after `closeCursor`. Native503 samples are preserved;
this is a fixture correction, not a production service change. Exact outcome counts
and final frozen-source seals are recorded in [loop065](../../implementation/loops/065-T056.md).

The later-account native test holds a genuine completed receipt result, closes the
old settings operation, signs into a separate synthetic account through the normal
UI/session read, saves its new adventure, and then offers the held response. Browser
request cancellation is an allowed part of this protection; this does not claim an
already-disposed fetch body reached the new controller. Root's separate lifecycle
unit suite covers the late callback/generation boundary.

Nine final T056 screenshots are retained under `.local/T056-native-05`. The worker
visually inspected the pending/unknown status, later-account preservation, confirmed
logout/title, actual412 conflict and reopened-browser scenes. Native assertions
verify the stored state and controls; these views are development grayboxes, not
finished-media or human-play acceptance.
