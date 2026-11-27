# T086 isolated outcome classification and safe Continue state

Worker `/root/loop099_t086`, loop099, 2026-11-26. **Prepared for coordinator
review; T086 and G4 are not accepted.** The explicit T085/T086 scheduling
exception permits disjoint modules while T081 joins the world. No shared
application, reducer, policy, content, original oracle or task tracking file was
changed by this worker.

The [outcome module](../../../src/state/outcomes.ts) and
[53 focused tests](../../../tests/state/outcome-classification.test.ts) execute
the existing repair validator and reducer. The final targeted join is **381
PASS / 126 TODO** across five suites. The TODOs are the unchanged 81 T082 outcome
and 45 T083 retry obligations; this report does not relabel them as executed
composite acceptance. The module has no DOM, audio, account, save, storage or
network operation.

## Authority and behavior

This work follows C9/C10/C12, FR-009/010/013, AC07 and SAVE06 in the
[constitution](../../../.specify/memory/constitution.md), [SPEC](../../../SPEC.md),
[PLAN](../../../PLAN.md), [gameplay contract](../../../specs/001-physical-layer-underworld/contracts/gameplay.md),
[data model](../../../specs/001-physical-layer-underworld/data-model.md) and
[save schema](../../../specs/001-physical-layer-underworld/contracts/save.schema.json).
T082's [independent outcomes](../../../tests/fixtures/outcomes.json), T083's
[independent transitions](../../../tests/fixtures/retry-transitions.json), the
[retry review](retry-transition-oracles.md), accepted T077 repair implementation
and reviewed T084 checkpoint implementation are inputs, not generated expectations.

`createOutcomeController` closes over a trusted content registry and raw repair
scenario resolver. `captureOutcomeContext` binds the original context object to
one exact immutable reducer state. Displayable adventure/version fields and
structurally identical copies do not grant authority. Classification accepts only
an action ID, event UUID and the player's existing classify operation (selection,
link measurement UUID, endpoint measurement UUID). It accepts no verdict, result,
scenario, effect batch, safe location or arbitrary outcome event from a caller.

The trusted scenario is sampled once from a frozen detached game. Both existing
repair preparation and canonical reducer execution use that same detached sample.
The module does not implement copper, optics, radio, power, capability, symbol or
packet predicates. T077 still verifies actual deployment facts, prerequisites and
exact provenance of fresh measurements against the current scenario. E01 requires
defect removal without a temporary dependency. E02 requires an actual temporary
dependency, its authored maintenance record and the same fresh physical and
endpoint checks. E03 requires known unresolved damage, deliberate isolation and
the recovery record; it never reports restored service.

History, O12 completion, classification effects, dirty generation and activity
are installed by one opaque prepared transition and one exact-state CAS. The
reducer's once-effect receipts remain authoritative. The wrapper appends one event
per attempt, bounds history to 256, rejects reused event UUIDs case-insensitively,
and does not increment dirty generation a second time for the same acceptance.
Dropping a prepared token changes nothing. A consumed/forged token, changed state,
equal-version replacement, pending transition or failed CAS cannot partly award
history or effects. No save write is issued and the confirmed slot is untouched.

The final checks are current **before** classification applies its world effect.
That effect advances configuration revision and marks the previous measurements
stale. History preserves the accepted outcome; notebook records preserve each
measurement's original UUID, attempt, revision, readings and conclusion. Later
feedback dismissal does not regrade historical proof as if it were current.
Assistance survives unchanged and never downgrades a valid outcome.

E01/E02 acceptance enters `cutscene` with no safe Continue outcome. Only the
controller's opaque receipt for that exact accepted state can dismiss successful
feedback. It checks the actual authored `spec001:R12.entry`, room/content version,
anchor membership and `safe-continue` eligibility, then sets `continueOutcome`
and `safe-continue` together. The successful world, inventory and history remain.
It does not rewind preparation or open Iron City. E03 enters `shutdown`, cannot
use this dismissal and never becomes a saveable shutdown world. T088 owns its
separate preparation rewind and Restore Save.

## Caveat references and the pending save-policy join

One existing authored fact contains each complete caveat set:

| Outcome | Existing R11 evidence reference | Required meaning |
| --- | --- | --- |
| E01 | none | Validated permanent restoration |
| E02 | `spec001:FACT-repair-maintenance` | Borrowed protected-corridor installation, nonpermanent limit, install and validate the permanent route before returning it |
| E03 | `spec001:FACT-repair-isolation` | Named severed conduit, deliberate loss of service, return to preparation and repair/retest |

`outcomeCaveats` verifies the exact reviewed evidence text and metadata. Missing
or modified teaching text is an authoring error; a substring does not authorize
altered caveats. The one record per outcome covers several semantic caveat roles;
fixture role names are not additional production content IDs. These qualified
fact IDs appear in `OutcomeEvent.caveatIds` and remain after future rollback.

Root approved this design in-session. The current portable save policy has empty
caveat membership, so E02 and retained E03 history cannot pass positive save
validation yet. The required shared join is a trusted `SavePolicyRules`
`caveatFactIds` mapping that checks actual authored fact membership, binds these
reviewed descriptors and includes the module in generator provenance. This worker
did not modify policy/schema/generator or claim a positive E02 save. The existing
snapshot validator actually rejects cutscene/shutdown/failure activity in the
focused tests; an empty policy list is used only for this pre-policy unsafe-state
rejection, never to claim positive eligibility or a real account write.

## Lifecycle integration and explicit limits

The test setup enters authored R11 safe preparation through the actual reducer,
captures T084's detached checkpoint using `riftPreparationBoundary`, commits it
through `commitEncounterChange` CAS, then executes the real reviewed intervention
and obtains real link/endpoint measurements. It does not fabricate a checkpoint.
Training prerequisites remain the accepted isolated repair fixture; these tests
are not twelve-room browser playthroughs.

The current isolated module retains the existing reducer's safe-activity
admission. It denies `active-encounter` until the ordered shared join. Root,
T085 and T086 agreed that actual successful commitment must enter
`active-encounter` immediately and retain the genuine same-adventure checkpoint.
An unresolved committed encounter cannot be saved because reload would lose its
temporary retry checkpoint. T085 owns the new shared
[`rift-encounter.ts`](../../../src/state/rift-encounter.ts) predicates; no duplicate
permission policy is added here. The pending reducer hook must default deny and
accept only the exact trusted permission result. Its narrow capabilities are
actual R11→R12 movement, notes and the R12 classification-context, measurement and
classification operations. Generic effects, broad room movement, preparation
changes and arbitrary state relabeling are not permitted by this proposal.

No authored deliberate fatal trigger currently exists. An incorrect repair claim
returns its actual observations and remains diagnostic, rather than becoming a
death or E03. Unsupported fatal events fail input validation. Root assigned T087
an explicitly warned optional fictional hazard action with a specific original
cause; T085 later stages that exact authored failure action/checkpoint and T088
recovers. The module does not invent a new network scoring rule or accept a caller
supplied fatal verdict. Fatal presentation and account recovery are unverified.

## Independent oracle mapping

All original fixtures and audit suites remain byte-for-byte unchanged. Focused
tests read literal independent expected fields where the actual interface maps
directly, and separately test the implementation's provenance/atomicity boundary.
No fixture expected result is returned by a mock or supplied as a scenario.

| T082 cases / family | Actual scoped execution | Remaining composite work |
| --- | --- | --- |
| E01/E02/E03 × copper/fiber/radio | Real plan, fresh proof, outcome/status/restoration and once-only history; only chosen branch prerequisites | Actual world/browser route traversal; E03 fixture-specific fiber/radio defect prose differs from the common authored severed conduit |
| E01/E02/E03 × hint levels 1–3 | Outcome unchanged, full hint history retained | Personalized prose and human review in T087 |
| `PERMANENT-DEFECT-REMAINS`, `TEMP-AS-PERMANENT` | Literal independent reason/outcome checks; no automatic downgrade | Application controls |
| 12 permanent/temporary × link/endpoint × revision/attempt/stale-flag cases | Literal `stale-evidence`, retained observation, no mutation | Live browser generation/race join |
| 4 missing physical/endpoint proof cases | Literal incorrect/null-outcome assertions | Distinct oracle reason wording is not claimed: T077 currently reports `final-proof-missing` |
| Failed physical/pattern/endpoint, no temporary dependency/maintenance, missing unresolved/deliberate/isolation record | Real predicates reject; no event, service award or mutation | Full oracle-specific input/reason mapping; temporary failed-proof variants remain separately pending |
| Missing limitation/follow-up/recovery clauses | Exact reviewed authored record rejects altered content | Oracle missing learner fields are not equivalent to changed authored text; do not count them as closed |
| `CONTENT-*` plus absent action | Valid-action malformed scenario returns content-error | **Pending precedence:** existing operation validation precedes raw scenario validation for malformed content plus missing selection; all three combined oracles remain open |
| E01/E02 Continue / missing safe anchor | Real opaque successful-feedback dismissal; same world/history; wrong/missing anchor remains cutscene | Actual positive save-policy/account roundtrip and side-route navigation |
| Unsafe activity save families | Actual snapshot boundary rejects cutscene/shutdown/failure/active/dialogue | Queued autosave/write-in-progress, account slot races, UI restriction explanations |
| Event replay/interrupted acceptance | Opaque token/CAS, action/event/attempt bounds, no partial world/history | Browser delayed callback races |
| Failure Retry/E03 Continue/Restore/fatal/personalized/after-Continue-save | No T086 implementation claim | T084/T087/T088/T089 and shared policy/application joins |

Additional focused checks cover actual measurement-field corruption, a throwing
adapter, exact one-sample behavior, malformed input/extra verdict fields, revision
maximum and exhaustion, dirty exhaustion, full history, same-version replacement,
and an altered authored caveat. These do not increase the 81-oracle acceptance
count. Iron City's unavailable contract and all media quotas remain unchanged.

## Verification record

All commands use pinned `.runtime/node-v26.13.1-darwin-arm64/bin` first in PATH.
No browser, host/provider, Git publication, preview process or deployment command
was run. Scoped strict TypeScript inherits every project compiler option through
`.local/t086/tsconfig.json` and includes only this module/test and their imports.
Root/T081 own the full check/build window.

| Log | Result | Meaning |
| --- | --- | --- |
| [01-red.log](outcomes/t086/01-red.log) | 1 suite failed, no tests: missing `src/state/outcomes` | Genuine tests-before-implementation RED; no artificial failing stub |
| [02-first-implementation.log](outcomes/t086/02-first-implementation.log) | 33 PASS | Initial actual module execution |
| [03-strict-typecheck.log](outcomes/t086/03-strict-typecheck.log) | Exit 0, no diagnostics | Initial scoped strict compile |
| [04-expanded-tests.log](outcomes/t086/04-expanded-tests.log) | 53 PASS | Added independent negative/provenance/boundary cases |
| [05-strict-typecheck.log](outcomes/t086/05-strict-typecheck.log) | Exit 0, no diagnostics | Expanded suite compile |
| [06-checkpoint-joined-tests.log](outcomes/t086/06-checkpoint-joined-tests.log) | 381 PASS / 126 TODO | Outcome53, repair52, checkpoint59, outcome-audit129+81TODO, retry-audit88+45TODO |
| [07-checkpoint-strict-typecheck.log](outcomes/t086/07-checkpoint-strict-typecheck.log) | Exit 0, no diagnostics | Authentic T084 checkpoint + T085 predicate import |

The [source seal](outcomes/t086/source-seal.json) records exact owned files,
verification logs and dependency/oracle hashes. Evidence proves this isolated
increment only. Required active-phase, positive caveat/save, full-world/browser,
failure, recovery and content-preflight joins remain before final T086/AC07
acceptance. Coordinator review alone owns the task checkbox and next stage.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
