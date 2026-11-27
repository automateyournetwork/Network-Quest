# T084 isolated encounter checkpoints

Date: 2026-11-26. Worker: `/root/loop094_t084`. Scope: C9/C12, FR-010/013,
AC07, SAVE06 and the explicit isolated-preparation scheduling exception.

**59 encounter checks PASS; scoped four-suite join 237 PASS / 45 TODO.** This
implements a real isolated checkpoint/rollback module. Full T084 acceptance,
T085/T088 recovery integration and T089 browser/save races remain pending behind
T079–T081 and root review. No aggregate gate, full-world recovery, human review,
provider behavior or publication is certified.

The same-loop continuation below adds the authorized canonical-world join:
**10 additional checks PASS; six-suite join 287 PASS / 45 TODO.** The original
isolated evidence is preserved. Module acceptance now awaits root review of that
join; application recovery and browser acceptance still remain separate.

## Implemented boundary

[encounter.ts](../../../src/state/encounter.ts) uses the existing
[reducer rewind primitive](../../../src/state/reducer.ts) without changing it.
Its inputs are immutable, trusted reducer state and validated authored content;
it is not a validator for arbitrary saved/network JSON.

- `captureEncounterContext(state)` issues an owned handle bound to the exact
  reducer-state object, adventure and copied attempt/revision. A copied handle,
  delayed version or equal-version replacement state is insufficient.
- `prepareEncounterCheckpoint(state, context, registry, isPreparation)` requires
  no pending transition, `safe-preparation` activity, a matching authored room
  and anchor that permits preparation, null Continue outcome, and a required
  trusted encounter-specific precommit predicate. It detaches and freezes the
  entire world checkpoint, preserving the current game, journal, activity,
  persistence and dirty generation. There is no write or second slot.
- `prepareEncounterRollback(state, context, registry, command, isPreparation)`
  requires terminal failure/shutdown and that adventure's valid preparation.
  It revalidates the checkpoint against the same precommit policy, resamples
  current/checkpoint/readout revisions and readout/hint/outcome attempt IDs, and
  merges those with transient high-water/used-attempt history. It rejects invalid
  or exhausted counters and reused UUIDs, including different letter casing.
  The accepted reducer then restores the entire checkpoint world, advances one
  dirty generation and a revision beyond every recorded prior value, retains
  the current journal and marks every measurement stale without rewriting its
  original provenance. Only the successful candidate reserves the next attempt.
- `commitEncounterChange(store, change)` performs one synchronous exact-state
  compare-and-set through a port compatible with `SaveCoordinatorStore`. A
  discarded plan performs no work; a failed CAS does not reserve an attempt or
  mutate memory. Only the complete new world/journal pair becomes observable.
  The store swaps state only; external notification/rendering follows the swap.

The required `EncounterPreparationBoundary` is a pure version-specific policy,
not a UI boolean or a permissive default. It receives a detached frozen world;
exceptions, attempted mutation, missing policy or nonboolean results fail closed.
No content ID is invented or hardcoded in the module. T085 must supply the
reviewed real encounter policy at both capture and rollback.

Root review exposed a real initial gap: T077's immediate execution can remain
at an R11 safe-preparation activity and anchor after committing the repair or
isolation. The independent new negative cases **failed three times** against the
initial module. The required predicate now excludes accepted
`repairFlags.executed`, `repairFlags.classification` and completed O11. Tests run
actual T077 permanent, temporary and shutdown execution, preserve the earlier
checkpoint and reject recapture afterward. The shutdown case additionally
rejects capture after actual final classification and rolls back to its original
precommit world. A saveable repaired world is not automatically precommit
preparation. Existing immediate/final shutdown save restrictions stay intact.

## Independent oracle coverage

[encounter.test.ts](../../../tests/state/encounter.test.ts) consumes the unchanged
[T083 literal vectors](../../../tests/fixtures/retry-transitions.json). Test-only
binding maps semantic labels to qualified IDs/UUIDs; those labels are never
registered in production content or persisted. Expected world/journal bodies
come from the accepted literals, not reducer output. The six-step three-retry
case executes actual reducer consumption/reward/receipt effects in explicitly
test-only content. No local rollback simulator or expected-value-returning
implementation stub is used.

`I` means the isolated module executes the relevant whole transition/assertions
with synthetic fixture content. `P` means only a named sub-boundary is executed.
`D` means no execution of that UI/service operation is claimed. **22 I, 8 P,
15 D** account for all 45 vectors; the test checks that accounting and the frozen
oracle hash. All 45 original runtime TODOs remain unchanged because the genuine
full-world/UI/persistence join is still absent.

| T083 vector | Scope | Actual observation or remaining obligation |
| --- | --- | --- |
| RETRY-FAILURE-WHOLE-WORLD | I | All reversible fields restored; current journal retained; slot metadata unchanged |
| RETRY-E03-WHOLE-WORLD | I | Shutdown history retained separately from shutdown world |
| RETRY-CHECKPOINT-DETACHED | I | Capture and rollback share no mutable world children; editing retry cannot alter checkpoint |
| RETRY-ALL-READINGS-STALE | I | All four exact readings/provenance remain visible and stale |
| RETRY-HISTORICAL-REVISION-FLOOR | I | Previously issued revision 40 remains a strict lower bound |
| RETRY-MEASUREMENT-REVISION-FLOOR | I | Retained readout revision 70 remains a strict lower bound |
| RETRY-SAME-REVISION-WRONG-ATTEMPT | P | Real current-reading predicate rejects; actual objective/classification adapter pending |
| RETRY-EXPLICIT-STALE-MATCHING-VERSION | P | Real current-reading predicate rejects; actual objective/classification adapter pending |
| RETRY-FRESH-MEASUREMENT | P | Predicate accepts fresh supplied measurement; no new readout dispatch claimed |
| RETRY-FACT-NOT-COMPLETION | I | Retained facts do not recomplete O11/O12 |
| RETRY-THREE-CYCLES-NO-FREE-ITEMS | I | Three real rollbacks, two real debit/reward reductions and replay; no accumulated reward |
| RETRY-OLD-ACTION-RECEIPT | P | Real reducer rejects stale note intent before duplicate handling; actual reward UI delivery pending |
| RETRY-OLD-COMMAND-NEW-ID | P | Real reducer rejects old attempt despite current revision/new delivery ID |
| RETRY-DELAYED-MEASUREMENT | P | Real reducer rejects stale captured note intent; delayed measurement callback delivery pending |
| RETRY-REUSED-CURRENT-ATTEMPT | I | Current attempt rejected even with incomplete transient ledger |
| RETRY-REUSED-HISTORICAL-ATTEMPT | I | Readout-only attempt rejected |
| RETRY-REUSED-HINT-ATTEMPT | I | Hint-only attempt rejected |
| RETRY-REUSED-OUTCOME-ATTEMPT | I | Outcome-only attempt rejected |
| RETRY-NO-CHECKPOINT | I | Reject; no invented preparation |
| RETRY-CROSS-ADVENTURE-CHECKPOINT | I | Reject; no cross-run merge |
| RETRY-UNSAFE-CHECKPOINT | I | Reject absent/incorrect authored anchor and precommit policy |
| RETRY-PENDING-TRANSITION | I | Capture/rollback reject unresolved transition |
| RETRY-INTERRUPTED-BEFORE-COMMIT | I | Prepared candidate remains invisible; no attempt reserved |
| RETRY-ATOMIC-OBSERVER | I | CAS observer sees only coherent before/after pairs; failed/replayed install unchanged |
| RETRY-REVISION-EXHAUSTED | I | 2147483647 cannot increment; no wrap/reservation |
| RETRY-DIRTY-GENERATION-EXHAUSTED | I | MAX_SAFE_INTEGER cannot increment; no reservation |
| RETRY-LAST-LEGAL-REVISION | I | 2147483647 accepted from prior value; next increment rejects |
| RESTORE-REPLACES-WORLD-AND-JOURNAL | D | Full validated snapshot replacement/confirmation is T088/T089 |
| RESTORE-CANCEL-UNCHANGED | D | Restore cancellation UI is T088/T089 |
| RESTORE-FETCH-FAILURE | D | Service read error and recovery UI are T088/T089 |
| RESTORE-INVALID-SNAPSHOT | D | Reader rejection/recovery UI are T088/T089 |
| RESTORE-DEFERRED-RESPONSE | D | Pending read and UI are T088/T089 |
| RESTORE-OLD-CALLBACK-SAME-VERSION | P | Exact-state/owned-handle rejection verified; actual Restore/action-bus lifecycle pending |
| RESTORE-REBUILD-PREPARATION-ON-ENTRY | P | Capture supplied already-restored world on later preparation; actual Restore/navigation pending |
| RETRY-GUEST-IN-MEMORY | I | Same rollback without auth/storage port; guest and known slot unchanged |
| RESTORE-GUEST-REQUIRES-SIGNIN | D | Restore/sign-in availability UI is T088/T089 |
| RETRY-LATER-MANUAL-SAVE | D | Ordinary confirmed conditional write after recovery is T088/T089 |
| RETRY-LATER-OPTIN-AUTOSAVE | D | Separate eligible safe event/write is T088/T089 |
| RETRY-AUTOSAVE-OFF | D | Actual autosave controller/UI event after recovery is T088/T089 |
| RETRY-UNSAFE-AUTOSAVE-RACE | D | Real queued save event/rollback race is T088/T089 |
| RETRY-SAFE-SAVE-CONFLICT | D | Actual conditional-write conflict after retry is T088/T089 |
| RETRY-EARLIER-SAVE-ACK | D | Exact earlier save receipt reconciliation after retry is T088/T089 |
| RETRY-LOGOUT-CANCEL | D | Actual logout choice preserves all memory/session; T088/T089 join pending |
| RETRY-LOGOUT-CONFIRMED | D | Confirmed logout clears memory/title without save; T088/T089 join pending |
| RETRY-CHOICE-CANCEL | D | Discarding a plan is inert here; actual recovery choice UI remains T088/T089 |

The module does not call a save service or schedule a save event. Slot and pending
request metadata are preserved. This establishes no-write behavior of the module,
not absence of writes from an as-yet-unintegrated application subscriber. Preserve
the existing distinction: an earlier exact durable save receipt can remain valid
while it cannot mark this newer dirty retry generation saved. Do not use gameplay
attempt freshness to invalidate that receipt.

## Verification history

Commands used Node **26.13.1** and npm **11.20.0** from
`.runtime/node-v26.13.1-darwin-arm64/bin`, verified again locally.

| Local tool start | Actual result |
| --- | --- |
| 20:03:57 | Initial tests-first import fails because `src/state/encounter.ts` is absent; no tests executed |
| 20:05:51 | Newly added test syntax error: missing closing brace; no tests executed |
| 20:05:59 | 52 PASS / 1 FAIL; test reused retry action ID, so duplicate no-op masked the intended second exhaustion probe |
| 20:06:07 | 53 PASS after giving each retry probe its own action ID; expected oracle unchanged |
| 20:07:07 | 54 PASS with actual six-step debit/reward/retry sequence |
| 20:08:28 | Encounter/reducer/retry join: 181 PASS / 45 TODO |
| 20:09:52 | 55 PASS / 3 FAIL; real capture defect after T077 shutdown/permanent/temporary execution |
| 20:10:43 | 59 PASS after required precommit boundary and fail-closed policy tests |
| 20:11:07 | Final encounter/retry/reducer/repair-plan join: 237 PASS / 45 TODO, 4 suites, 9.83 s |

Final scoped command:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/state/encounter.test.ts tests/state/retry.test.ts tests/state/reducer.test.ts tests/state/repair-plan.test.ts --maxWorkers=1
```

Scoped strict TypeScript inherited all repository options via a temporary
`.local/t084-typecheck-*.json` containing
`{"extends":"../tsconfig.json","include":["../src/state/encounter.ts","../tests/state/encounter.test.ts"]}`.
Pinned `node node_modules/typescript/bin/tsc --project` finally exited 0 without
diagnostics; temporary configs were removed. Earlier checks found test-only
branded-ID/tuple assertions and the synthetic flag index type; these were corrected
without changing expected data. No broad build/typecheck, browser, Safari,
host/provider/credential/player-data operation, Git operation or deployment ran.

## Artifact seals and integration handoff

| Artifact | SHA-256 |
| --- | --- |
| `src/state/encounter.ts` | `f1d4c7e77c15ed9759564a2c0c2c54cac97708d56d7b71e8de1adb2b2092ba01` |
| `tests/state/encounter.test.ts` | `d348401705ad5389339f703db21275266c65e3937d4b17fab7e90adac0dc2a2f` |
| Protected `tests/fixtures/retry-transitions.json` | `8be2657298b75106b6a55e51e74364e5446c376a85939297e43d91fdd47a6bee` |
| Protected `tests/state/retry.test.ts` | `bd0a6b530675ee00d8217411b02eb0749f768e22c7ed645025e0482046493d51` |
| Protected `tests/fixtures/outcomes.json` | `1d9c734a783211bb4e02ecf43aa1c196d8cc5c05466f32da757730896ada0ad7` |
| Protected `content/spec001/sources.json` | `a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116` |
| Protected `tests/fixtures/physical-cases.json` | `de255ec172b43d25fe6bcee84559f974f9ffb1f62d69d69bca16cab50a2697d1` |
| Protected `tests/fixtures/repair-routes.json` | `ed3a083828188a34fd6f5f345cbd4c69fe8ebb140ea903dbafd9b3f464639877` |

After T079–T081 and root GO, bind actual encounter policy/entry, shared captured
actions and notification lifecycle in T085/T088; keep confirmation and Restore
separate. T086 owns outcome history/classification and safe Continue. T089 must
execute the complete frozen matrix through the actual UI/save/logout paths.
Capture context at the real action boundary, never rebuild it for a stale callback.
Do not emit an autosave merely because rollback returned safe-preparation; ordinary
safe manual/opt-in saving is a separate policy event. T084 remains unchecked.

## Same-loop continuation — canonical twelve-room module join

Root resumed loop094 without incrementing the loop after T079/T080 acceptance
and T081's canonical world/application/policy implementation, graph tests and
native route checks. Authorization was limited to the actual-world T084 module
join. No shared runtime/application/policy/oracle file was edited, and no browser
or recovery UI acceptance is inferred from this continuation.

New [encounter-world.test.ts](../../../tests/state/encounter-world.test.ts) imports
the real [application content loader](../../../src/app/content.ts), its canonical
twelve-room registry and `episodeNavigationEntries`, the actual
[application save policy](../../../src/app/save-policy.ts), and the reviewed
[`riftPreparationBoundary`](../../../src/state/rift-encounter.ts). It does not
import the old repair fixture or replace the canonical document selection.
`src/state/encounter.ts` and the original 59-check suite are unchanged.

The ten additional cases execute:

- Exact twelve-room selection and the real R11 preparation anchor/policy.
- Three independent copper/fiber/radio interventions with actual review,
  execution, physical and endpoint readouts; whole-world retry then succeeds
  under the real save policy, preserves new notes, actual facts/hints/map entries,
  prior hypothesis and reading provenance, and removes undone O11 execution.
- Three temporary-route postcommit states that cannot replace preparation.
- Actual immediate shutdown execution and final shutdown classification, both
  rejected by the real save validator; Continue restores the captured world,
  removes O11/O12 and shutdown flags, retains the current journal and produces
  a valid safe-preparation snapshot without checkpoint/control fields.
- A stale pre-retry review that cannot execute, followed by a genuine new review
  and execution; replay is rejected and a second rollback cannot retain execution
  receipts/items or duplicate learned facts.
- Rejection of a different authored safe room and an executed world supplied as
  the checkpoint. The real Rift predicate, rather than a test-local approximation,
  gates capture and rollback.

The starting state **supplies** completed introduction/one-branch/equipment/
Clockworks receipts and equipment flags at R10, a kit and a prior hypothesis.
The actual save validator accepts that starting state. These inputs isolate
checkpoint behavior and do not assert the learner completed those objectives in
this suite. R10→R11 and R11→R12 are **executed** using the real navigation resolver,
canonical edges/anchors and reducer; no direct destination teleport substitutes
for those moves. The three ordinary failure cases explicitly supply the terminal
failure activity after real observations, pending T086/T088 failure delivery.
This exercises T077's raw execution phase; T085's atomic `active-encounter`
lifecycle is not used here. The shutdown classification is actually executed.
Current T077 has no ending
history append; the test expressly expects empty history rather than fabricating
an event. Full outcome provenance retains its isolated T083 coverage until T086
joins. No unimplemented recruits, rewards or content identities are invented.

One exact CAS installs each rollback. Capture preserves game and persistence
identity; rollback advances only its required dirty generation while preserving
the other persistence fields. `fetch` spies observe zero HTTP operations across
the three ordinary retries and shutdown Continue. `captureSafeSnapshot` and
`SaveValidator` are actual pure validation calls, **not server writes**. This
does not certify application subscribers, autosave scheduling, account transport,
Restore, logout or T088/T089 recovery UI behavior. The original 45 TODOs and the
22-isolated/8-partial/15-deferred accounting remain unchanged.

Verification, pinned Node 26.13.1/npm 11.20.0:

| Local tool start | Observed result |
| --- | --- |
| 20:55:12 | 7 PASS / 3 FAIL: test attempted R02-only `pin-hypothesis` in R12 and correctly received `precondition` rejection |
| 20:55:34 | 10 PASS after declaring a prior supplied hypothesis and retaining real note/hint operations; no production or oracle change |
| 20:56:10 | Final six-suite join: 287 PASS / 45 TODO, 11.19 s |

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/state/encounter-world.test.ts tests/state/encounter.test.ts tests/state/retry.test.ts tests/state/reducer.test.ts tests/state/repair-plan.test.ts tests/content/world-graph.test.ts --maxWorkers=1
```

Scoped strict TypeScript inherited all repository compiler options through a
temporary `.local/t084-world-typecheck-*.json`, including only the encounter
module and both encounter suites as roots. Pinned `tsc --project` exited 0 with no
diagnostics before and after the final assertions. Temporary configs were removed.
No broad build, browser, host, provider, credential or Git operation was run.

Continuation seals (dependency seals record the files read in this join; those
shared files remain owned by their workers/root):

| Artifact | SHA-256 |
| --- | --- |
| `tests/state/encounter-world.test.ts` | `4d190e7a7b1ec7b298c1f0eb00680551597a04c6930299360b3c5901f54a9c8f` |
| `src/app/content.ts` | `57339418cde773863b87d01d8f000ebcb10a91649dca75ee69efd63fd6584c42` |
| `src/app/save-policy.ts` | `34c3b4f7d97233afccdd4f041b3c986204679a8e6765fb1b12498a386626b5ab` |
| `src/state/rift-encounter.ts` | `fa2c358831c3827067f49d051b48be13ffc532390c7926d7890245cbb7050e03` |
| `content/spec001/world.json` | `f55d0b082bcbe183600a4ef5053eea3ac6d088f693d2153f1fa1203acdc31701` |

The module is ready for root's actual-world acceptance review and ordered
T085/T086 integration. Root owns task checkboxes and final publication. Production
application composition remains with loops 098/099 and T088; no new authorization
for that integration or T089 acceptance is implied by this report.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
