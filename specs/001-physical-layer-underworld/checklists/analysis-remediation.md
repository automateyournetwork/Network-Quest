# Analysis remediation: Spec001

**Date:** 2026-11-25

**Scope:** User-authorized resolution of all four findings from the specification analysis. This record covers document and contract corrections; implementation tasks and G0–G7 runtime evidence remain pending.

| Finding | Resolution | Contract and task coverage |
| --- | --- | --- |
| I1 — HIGH: validation could reject an already committed save retry | Authenticate and bound the request, resolve a retained receipt before current semantic policy, and recheck authorization/receipt inside the final transaction before returning provisional validation errors. New requests still require current validation. | [Data model](../data-model.md), [API](../contracts/game-api.openapi.yaml), [gameplay](../contracts/gameplay.md); SAVE08 and T036/T042/T043/T049/T054 cover changed write policy, concurrent receipt creation and unauthorized replay. |
| I2 — HIGH: G6 required release evidence before its prerequisites existed | T159 runs G6-executable checks; T163 accepts only that scope. G7 packaging, recovery and staging precede T168 readiness; owner-initiated publication precedes final matrix reconciliation in T170. | [Plan](../plan.md), [tasks](../tasks.md), [delivery](../contracts/delivery.md), [quickstart](../quickstart.md); T159/T163/T164–T170 retain every AC01–21 row and name pending dependencies. |
| A1 — MEDIUM: a guest session could not confirm account deletion | Add a read-only, exact-origin receipt status operation. A random receipt remains in browser memory; its hash expires after 24 hours independently of recovery tombstones. Only DELETE 204 or completed status confirms deletion. Unknown/expired status remains unconfirmed; checking cannot delete, sign in or affect a later account. | [API](../contracts/game-api.openapi.yaml), [data model](../data-model.md), [delivery](../contracts/delivery.md); SAVE12 and T036/T045/T046/T052–T056/T165/T166 cover lost responses, crash recovery, expiry and isolation. |
| I3 — MEDIUM: implementation workflow contradicted the execution table | Make the explicit task execution table authoritative across story sections; phase order is only a fallback when no table exists. Respect dependencies, scoped gates and publication boundaries. | [Implementation workflow](../../../.agents/skills/speckit-implement/SKILL.md), [agent guidance](../../../AGENTS.md), [tasks](../tasks.md). |

Root [SPEC.md](../../../SPEC.md) and [PLAN.md](../../../PLAN.md) are synchronized with the feature contracts. The API now specifies nine operations across eight paths. Existing task IDs, scope, parallel markers and both accepted clarifications are retained.

## Verification

Document validation passed on 2026-11-25:

| Check | Result |
| --- | --- |
| Schema and contract baseline | 26 checks passed: save/asset metaschemas, valid and invalid examples, API structure/references, planning traceability and scope. |
| API | Nine unique operations, eight paths and 71 resolved references; duplicate YAML keys rejected. Component schemas pass Draft 2020-12 metaschema checks. |
| Deletion confirmation | Twelve positive/negative fixtures passed for pending/completed responses, prohibited identity fields, missing/invalid expiry and receipt header shape. Ordinary date-time fixtures used an explicit standard-library parser. Session, CSRF and fresh-auth requirements remain on DELETE; status uses only the narrow receipt and exact Origin. |
| Remediation consistency | 89 focused assertions passed, including documented save ordering, regression assignments, G6/G7 dependencies, workflow precedence and unchanged clarification answers. These verify contracts, not executing services. |
| Task integrity | 170 unique unchecked tasks; 20 ordered batches with earlier dependencies; 66 parallel tasks in 15 waves with no duplicate explicit file targets. Eight story-test criteria retained. |
| Coverage | All 26 functional requirements and 15 success criteria retain task mappings: 41/41, with no unmapped task. AC01–21 and SAVE01–13 remain represented. |
| Links and whitespace | All 71 local Markdown links in root guidance and feature documents resolve; `git diff --check` passes. |

These are structural, example and document checks, not a full OpenAPI conformance certification. No application tests, provider checks, media reviews, host tests or deployment have been performed by this remediation. Changes remain uncommitted.

## Implementation handoff

All four analysis findings are resolved at the design level. Execute the existing 170 tasks in their 20 dependency-ordered batches when implementation is initiated. Save replay and deletion confirmation still require their specified runtime regression evidence; no planning check substitutes for it. G0–G7 remain unverified, and live publication remains owner-initiated.
