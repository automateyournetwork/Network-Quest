# T082 independent outcome and failure oracle preparation

Date: 2026-11-26. Worker: `/root/loop091_t082`. Scope: C9/C10/C12,
FR-003–005/009/010/012/013, AC03/07 and SAVE06.

The [81 semantic cases](../../../tests/fixtures/outcomes.json) and
[fixture audit](../../../tests/state/outcomes.test.ts) prepare independent
expectations before the complete outcome implementation. **129 fixture checks
pass; all 81 application cases remain TODO.** This does not execute or accept
an ending, encounter, recovery control, save, browser journey or gate. Root owns
task acceptance and scheduling; T079–T081 still precede dependent outcome work.

## Authority and independence

The [constitution](../../../.specify/memory/constitution.md),
[root SPEC](../../../SPEC.md), [PLAN](../../../PLAN.md),
[US6 and functional requirements](../../../specs/001-physical-layer-underworld/spec.md),
[data model](../../../specs/001-physical-layer-underworld/data-model.md) and
[gameplay contract](../../../specs/001-physical-layer-underworld/contracts/gameplay.md)
govern these expected results. The accepted [T006 source review](rule-source-review.md),
[T014 cases](../../../tests/fixtures/physical-cases.json),
[T068 route cases](../../../tests/fixtures/repair-routes.json) and
[T069 authoring review](repair-definitions.md) provide the frozen rule/model and
classification inputs. T069's `FACT-O12-classification` explicitly requires the
temporary dependency, limitation and follow-up independently of passing service.

Expected classifications were assigned from those contracts, before invoking any
outcome implementation. The audit imports only filesystem, hashing and Vitest
facilities. It has no runtime import, local classification implementation, mock
returning expected answers, or adapter pretending to execute the cases. Its pass
count is **fixture integrity evidence only**. The explicit application TODO for
each case must later invoke the real interface and compare observed behavior
with the fixed independent expected result.

State and ending rules come from project contracts, not networking standards.
No new physical threshold, profile, regeneration topology or external source
claim is introduced. Existing arithmetic and compatibility cases stay unchanged.
This task did not retrieve new external sources or perform human technical review.

## Coverage

| Group | Cases | Independent obligation |
| --- | ---: | --- |
| Classification | 54 | 18 correct, 32 incorrect, three content-error and one invalid-input expectation |
| Epilogue | 3 | Each outcome may reflect route, helped characters, optional work and maintenance without hint-based punishment |
| Recovery | 7 | Retry, E03 Continue, precommit return, confirmed/canceled Restore Save and E01/E02 Continue |
| Failure presentation | 3 | Specific failed-guess evidence; short skippable cause/recovery for guest and authenticated failure |
| Save boundary | 12 | E01/E02 safe Continue requirement, seven prohibited save activities and later safe persistence of E03 history |
| Atomic application | 2 | Replayed acceptance adds no event/reward/consumption; interrupted acceptance adds no partial state |

The three positive classifications each cover copper, fiber and radio with only
the chosen branch and common preparation complete. Other branches, optional
rewards, a recruited ally and future realms are not prerequisites. Separate hint
variants retain method, worked-step and solution history while keeping the same
technical classification.

- **E01:** current scoped physical checks and a separate endpoint service check
  pass, the defect is removed, and no temporary dependency remains.
- **E02:** the same current service checks pass. A named temporary dependency,
  limitation and follow-up remain visible; any one omitted record withholds that
  ending. Selecting permanent for a valid temporary repair is incorrect and does
  not silently award E02; the explanation identifies E02 as the eligible class.
- **E03:** an unresolved fault is named, isolation is deliberate and recovery is
  recorded. It awards no restored-service claim and requires no fabricated passing
  endpoint result. An unintended outage does not qualify.

Permanent and temporary cases separately withhold success for failed physical
checks, absent physical proof, failed endpoint checks, absent endpoint proof, and
balcony arrival/link-up alone. For **each** success class, physical and endpoint
observations separately test revision mismatch, attempt mismatch and an explicit
stale flag. Only that freshness field differs in each of the twelve vectors.
Passing old observations stay visible without certifying the current state.

The three T14 content-error vectors retain missing unit, negative passive loss
and unknown authored profile. Each pairs malformed authored data with an absent
learner selection to preserve content-error precedence. Valid content with no
selection is separately invalid-input. Neither grants progress, consumes an item
or records a learner attempt penalty. Semantic reason labels in this oracle
describe required feedback; they are not a mandate for new production enum names.

## Continue, failure and one-slot boundaries

Failure Retry and E03 Continue restore preparation world/inventory/party/effect
flags together, keeping newly learned facts, notes, hypotheses, map discoveries
and all hint-use history. The examples restore revision-4 preparation after a
revision-8 attempt, requiring a fresh attempt and a revision **greater than 8**.
The prior passing measurement stays visible as stale. These are narrow outcome
obligations; T083 still owns exhaustive rollback, repeated-retry, consumption and
reward-transition vectors.

Restore Save warns about unsaved progress and replaces world **and journal** with
the confirmed stored snapshot. It does not merge new attempt learning. Cancel
changes neither memory nor the slot. A guest can retry in memory; an account save
cannot be restored before sign-in. Retry is explicitly temporary session recovery,
not a second player-selectable slot.

E01/E02 Continue preserves the successful world/history at an authored safe
location and leaves side routes available. E03 Continue instead restores safe
precommit preparation. No Continue operation implicitly saves. An E03 history
record and retained learning may enter a later ordinary safe snapshot, but the
shutdown world itself remains prohibited. A validated E01/E02 with no authored
safe Continue location is not snapshot-eligible.

Manual or queued automatic new writes cannot capture terminal failure, shutdown,
an unresolved transition, active encounter, dialogue transaction, cutscene or a
write already in progress. The last confirmed slot stays protected. These vectors
do not cancel or undo an earlier committed write; exact pending-request receipts,
concurrency and autosave integration remain governed by the existing save contracts
and require the actual T089 join.

## Input gaps and coordination

Fixture attempt/item/helper labels and `authored-safe-location` are local semantic
labels, not invented registry IDs. Later adapters must bind real authored data,
actual observation provenance, accepted effects and safe positions, while leaving
expected answers independent. Unsupported data must not be made valid by silently
manufacturing those bindings.

| Dependency | Evidence still needed |
| --- | --- |
| T079–T081 | All authored routes and full world join before dependent outcome acceptance |
| T083–T085 | Detailed rollback vectors, real preparation snapshots, commitment/warning/return controls and fresh generations |
| T086 | Full outcome event/history interface, classification, exact safe Continue bindings and unsafe-world exclusion |
| T087 | Actual personalized epilogues and skippable dramatic failure causes/recovery prose |
| T088–T089 | Actual Retry/Continue/Restore UI, one-slot autosave/logout races and browser outcome matrix |
| Human/owner review | Learning, complete episode experience and aggregate acceptance remain separate |

Loop089/T077 reported its scoped `classify` operation and separate fresh R12
link/endpoint observations. Its deliberate shutdown activity does not yet supply
the full Continue/outcome-history implementation. This oracle therefore does not
promote T077 evidence to T086 or invoke a partial adapter. T077's existing
`R11.preparation`/`R12.entry` anchors are acknowledged without inventing the later
Continue mapping. T078's title Continue after saved restoration is also distinct
from E03 Continue and does not prove this recovery contract.

## Executed checks and retained failure

Pinned Node **26.13.1** and Vitest **5.1.2**:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/state/outcomes.test.ts --maxWorkers=1
```

First run, local 19:41:39: **128 passed, one failed, 81 TODO**, exit 1, 107 ms.
The failing audit expected an omitted `permanentRepair` field to exist with value
`undefined` via `toMatchObject`. Vitest correctly distinguished those shapes.
The correction asserts the outcome/eligible class and separately asserts that the
field is absent; **no expected outcome or input was changed**. This is an actual
fixture-audit RED, not a runtime implementation RED.

Rerun, local 19:41:54: **129 passed, 81 TODO**, one suite, exit 0, 96 ms.
A focused strict typecheck of `tests/state/outcomes.test.ts` also exited 0 without
diagnostics, using the project's strict indexed-access/optional-property/unused
flags. A second scoped check used a temporary `.local` configuration extending
`../tsconfig.json` and including only `../tests/state/outcomes.test.ts`; it also
exited 0 without diagnostics under all repository compiler settings. The temporary
configuration was removed. No full repository typecheck, build, browser, host/API run, Git publication
or deployment was performed by this worker. Protected source/fixture seals match;
owned text files have no trailing whitespace. Commands and artifact seals are
recorded in [loop091](../../implementation/loops/091-T082.md).

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
