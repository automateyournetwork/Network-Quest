# US6 outcome and recovery integration

T089, loop102, 2026-11-27. **Final native matrix: 12 passed in 2.6 minutes,
exit 0. Strict TypeScript passed. Submitted for coordinator review; this worker
has not changed task or gate acceptance.**
This record concerns the local application and an isolated PHP account service
with synthetic fixture identity. It does not establish actual Google/GitHub
authentication, production acceptance, media quality, or a complete episode gate.

The tests start the actual New Adventure UI and use authored training routes,
repair warnings, classification, outcome scenes, recovery confirmations, and
ordinary account-save controls. No adventure snapshot, objective completion,
physical verdict, measurement, recruit, or reward is injected into the game.
The fixture supplies only isolated local identity and request/slot observation.

## Executed AC07 and SAVE06/13 coverage

| Contract | Native binding | Status |
| --- | --- | --- |
| E01 copper/fiber; E02 radio | Existing T078/T081 full New Adventure journeys, warning, endpoint proof, explicit Continue, manual save/reload | T087 records four passing journeys; reused evidence, not counted among the new twelve |
| E02 copper/fiber; E01 radio | Three complementary journeys, initially unchecked warning, safe return, no ally, missing proof denied, precise caveats, unsafe Save barrier, explicit Continue, opted-in same-slot autosave/reload | 3 PASS |
| E03 after copper/fiber/radio preparation | Deliberate authored isolation without an unrelated installation duration; unresolved caveats; new notes, three O12 hints and classification clue; cancel then confirmed rewind; exact preparation world apart from new attempt/revision; stale readings; later manual save and fresh E01 proof | 3 PASS |
| Fatal account Retry/Restore | Authored PR101/PR107 ledge warning, skippable cause, Retry cancel, detached and reinserted retired control, Restore discard review/cancel/confirm, whole snapshot replacement | 1 PASS |
| Fatal guest Retry | Native keyboard route, sign-in choices without load/write, temporary retry, 390px/200% contained confirmation, declined invitation remains declined after ordinary walking | 1 PASS |
| SAVE06 late acknowledgement | Hold actual committed safe PUT response, Retry, acknowledge old generation, current unsaved status, later manual save and an ordinary arrival autosave | 1 PASS |
| SAVE06 unknown response | Commit actual PUT then lose response, Retry, exact frozen bytes receipt retry, current notes/new attempt preserved | 1 PASS |
| Restore response race | Hold actual saved-slot GET, Retry, release old response; obsolete discard dialog cannot reappear or load | 1 PASS |
| SAVE13 cancel/confirm | Opted-in account after Retry, cancelled logout preserves notes/usable checkpoint, confirmed logout clears title/editor memory without write | 1 PASS |

The [final native log](US6/t089/public/08-full-matrix.log),
[TypeScript log](US6/t089/public/07-final-typecheck.log), and
[runtime/test hashes](US6/t089/08-runtime-and-tests.json) identify the executed
result. Every run uses the pinned Node 26.13.1/Playwright 1.65.1/installed Firefox
and PHP 8.4.28, `ignoreHTTPSErrors:false`, reduced motion and disposable local
CA trust. No page errors or external HTTP(S) requests were observed by the
fixture. The suite explicitly requires the real room renderer after recovery
and the honest returned-to-preparation status.

Freshness is checked at its applicable boundary: both native link and endpoint
observations are current immediately before classification. Classification
advances the world revision; retained proof may therefore be stale afterward.
The final saved history retains the new measurement IDs/current attempt and
the E03→E01 outcomes, while all earlier measurements remain stale. Neither
knowledge nor old readings automatically re-award O11/O12.

Original [outcome](../../../tests/fixtures/outcomes.json) and
[retry](../../../tests/fixtures/retry-transitions.json) semantic oracles are
unchanged. Their original TODO markers are not blanket acceptance. The new
[native suite](../../../tests/e2e/outcomes.spec.ts) binds specific observable
contracts; [before-execution hashes](US6/t089/01-before-execution-tests.json)
preserve the independently authored expectations before running them.

## Explicit remaining limits

The real O11 objective and authored effect receipt provide an actual reward
rollback binding. The whole preparation world comparison includes inventory,
recruits, active allies, quest/achievement/dialogue flags, route and completion
flags. Current gameplay does not provide a real consumable conversion or
nonempty recruited-party/side-quest mutation inside the encounter. Empty arrays
remaining empty cannot prove those mutations. T084's isolated primitive cases
cover such shapes; actual authored UI bindings remain for T094/T104/T105 after
the optional T096–T104 content exists. The coordinator explicitly agreed to
this scope distinction on 2026-11-27. The actual inventory contains one reusable
inspection kit before and after rollback. No invented consumable, recruit, or
reward handler was added to manufacture evidence.

## Preserved initial execution

The [first native run](US6/t089/public/02-native-initial.log) executed all twelve cases
with pinned Playwright/Firefox, strict local TLS, and the actual isolated PHP
account service. Four passed: E02 copper, E02 fiber, E01 radio, and fatal-account
Retry-cancel/Restore-cancel/confirmed whole-snapshot replacement. The
[runtime/build hashes](US6/t089/02-native-runtime.json) identify its frozen inputs.

Three E03 cases failed because the review path incorrectly demanded a permanent
or temporary installation duration even for deliberate isolation. Four Retry
cases failed because the new attempt lost its rendered room and entered the
visual-unavailable fallback. Both are runtime findings, not relaxed assertions.
The coordinator corrected synchronous intermediate rendering during rollback
cleanup and announced the actual recovery result. Same-loop099 corrected
isolation duration and its proof/policy handling without inventing a duration
flag. The tests continued to require actual rendered rooms.

One delayed-Restore test failed in the test harness before exercising its race:
Playwright's Node-side `route.fetch` did not trust the temporary Firefox NSS CA.
The corrected helper forwards only the isolated saved-slot GET with that
fixture's explicit CA and `rejectUnauthorized: true`, matching the existing
strict native write-forwarding approach. No certificate bypass was added.
The next run exposed four indistinguishable Rift return buttons. The coordinator
gave them their real destination names without changing destinations or gates.
Two test expectations were corrected openly: the actual caveat label is
“Named unresolved fault,” and measurement freshness must be asserted before
classification advances the revision. No runtime freshness workaround was made.

| Preserved run | Result | Meaning |
| --- | --- | --- |
| [Initial twelve](US6/t089/public/02-native-initial.log) | 4 PASS / 8 FAIL, 3.2m | Runtime shutdown/render findings plus a harness CA failure |
| [Affected eight](US6/t089/public/04-affected-rerun.log) | 3 PASS / 5 FAIL, 2.1m | Fixed rendering/races; caveat assertion and ambiguous return-label findings |
| [Remaining five](US6/t089/public/06-remaining-five.log) | 2 PASS / 3 FAIL, 1.2m | Guest/late acknowledgement pass; final-proof freshness assertion was too late |
| [Final twelve](US6/t089/public/08-full-matrix.log) | 12 PASS, 2.6m | Complete current native matrix on the corrected frozen build |

## Review artifacts and local raw evidence

The [sanitized failure excerpts](US6/t089/public/preserved-failure-summary.json)
preserve the causal errors. [Screenshot provenance](US6/t089/public/screenshot-provenance.json)
maps nine unmodified final screenshots to their original output paths. The
desktop [E03 confirmation](US6/t089/public/screenshots/E03-copper-confirmation.png)
and narrow [200% Retry confirmation](US6/t089/public/screenshots/guest-retry-390-200.png)
were visually inspected: text wraps and the explicit confirm/cancel controls
remain readable inside the contained frame.

All original logs, traces, error contexts and screenshots are retained locally.
Raw traces and contexts can contain disposable synthetic authentication values;
they are excluded from the public review seal. Sanitized public logs redact
those header values. A separate local-only hash manifest lives at
`.local/t089-raw-evidence/local-only-sha256.json`. The
[public source/evidence seal](US6/t089/source-seal.json) includes only sources,
unchanged oracles, bounded public metadata, sanitized logs and screenshots.

Native automated controls, DOM bounds and screenshots supplement visual and
human accessibility review. The installed Firefox/axe crash remains recorded
elsewhere; this task does not change browser pins, suppress page errors or
claim a successful axe/Safari audit.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
