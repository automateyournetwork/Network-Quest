# T086 additive correction — deliberate isolation without installation duration

Date: 2026-11-27. Same worker `/root/loop099_t086`; no new loop or task acceptance.
This record supplements the historical T086 seals without replacing them.

T089's actual New Adventure browser route exposed a dead end: selecting deliberate
isolation, reading its requirements, recording the unresolved fault/recovery plan,
and reviewing the plan left the warning control disabled. The canonical repair
adapter required an installation duration for every plan, while earlier test
fixtures silently supplied `permanent` to shutdown. Selecting an unrelated
duration is not an acceptable player workaround. T089's original evidence is
`docs/evidence/spec001/US6/t089/02-native-initial.log`.

The root-authorized correction introduces `repairMeasurementDuration` in the
existing repair adapter. Restoration plans still require a real permanent or
temporary flag. Shutdown accepts an absent duration or a prior valid duration,
but its canonical measurement token is `not-applicable`. Present invalid values
are rejected, including a fabricated `not-applicable` flag. The helper never
changes world flags. Canonical proof comparison and UI review lookup use this
same token; no parallel physics or outcome classifier was added. A prior
temporary choice cannot label the shutdown intervention as a temporary dependency.

The active encounter guard still compares the authentic precommit checkpoint:
duration property presence and raw value must both match the current world.
Allowing shutdown's absent duration does not permit missing duration for another
plan, stale reviews, changed checkpoint flags, or synthetic active state. UI text
now says installation type is not applicable to deliberate isolation.

The save policy adds exactly two conclusion codes, for correct/incorrect shutdown
review with `not-applicable`. Original permanent/temporary shutdown codes remain
valid historical save representations. No save-v1 schema or PHP validator change
was needed. The generated policy was regenerated after the source correction;
its provenance hashes were checked against actual inputs. New reviews and
execution proof use the canonical token; old saved review records are retained.

Both repair fixtures now omit duration by default for shutdown. The outcome
classification and save-policy helpers also exercise this absent-duration path.
Only the existing repair unit test's scoped policy was extended to accept the new
canonical proof alongside its original legacy proof code. Original independent
outcome81/retry45 fixtures and audits remain unchanged.

| Evidence | Result |
| --- | --- |
| `01-red.log` | Genuine tests-first failure: 13 failed / 12 passed in 25 new tests. |
| `02-before-policy-generation.log` | Source correction: 24 passed; generated production policy correctly remained stale/rejected the new proof. |
| `03-policy-generation.log` | Generated artifact rebuilt successfully. |
| `04-focused-green.log` | 450 passed / 126 unchanged TODO across 12 suites, including all 25 new tests. |
| `05-check.log` | Project strict TypeScript, content validation and generated policy check passed. |
| `06-checkpoint-policy-missing-phpenv.log` | 116 checkpoint/admission tests passed; deterministic artifact test passed. Two PHP invocations failed because this worker omitted `NQ_PHP_BIN`. |
| `07-policy-green.log` | With pinned PHP8.4.28, all 3 artifact/JS/PHP tests passed. |

Final distinct focused coverage is **569 passed / 126 unchanged TODO across 15
files**. The new tests exercise real canonical review, T085 atomic execution with
T084 checkpoint, exact active navigation, T086 E03 classification, and T088
confirmed Continue rollback on copper, fiber and radio. E03 itself remains
unsaveable; retained E03 history after actual rollback validates in JavaScript
and PHP. They also cover safe precommit isolation without a duration flag,
prior valid durations, invalid flags for shutdown and all six restoration plans,
review freshness, exact checkpoint presence/value, invented proof rejection,
legacy proof-code compatibility and the generated production policy.

The new fixture begins with trusted training prerequisites, not an asserted full
New Adventure playthrough. T089 owns that native rerun and root owns review and
acceptance. No browser, provider, publication, preview-process or Git action was
performed by this correction worker. Root's separate retry-render application
fix and T089's CA helper remain separately owned. T090's future packet inspection
export is expressly excluded from this source freeze.

`source-seal.json` records the exact modified source/tests, generated artifact,
evidence, relevant unchanged dependencies, original oracle comparisons, and
actual policy-input hash verification. It is not an acceptance claim.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
