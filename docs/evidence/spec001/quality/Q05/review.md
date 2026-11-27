# Q05 outcome and recovery regression review

Reviewed published commit `9484507f977d930fd64db9fd0a65003836a0e66e`. The exact 81 T082 and 45 T083 rows are indexed in [mapping.json](mapping.json), with original input and answer objects, upstream case IDs, source anchors, supported keys and keys still unresolved or requiring semantic adaptation. The T083 context, world and journal references resolve against the unchanged dictionaries in its original fixture. Entries apply to the named interface and case setup. Existing browser references identify earlier integration evidence. Q05 ran the reducer, controller and controlled-transport suites locally.

| Accounting | Count | Interpretation |
| --- | ---: | --- |
| Mapped | 21 | Referenced assertions support the expected behavior at the stated interface. |
| Partial | 83 | Input, observation, exact state, or integration remains open. |
| Adaptation | 22 | An interface, authored fact, error category or diagnostic differs from the independent oracle. Root review is required. |

Each key appears exactly once in the supported or unresolved/adapted list for its row. Supported keys can be shared across named tests. Inference from immutable-state equality is counted for absence of rewards or mutation. A controlled failed PUT counts as one request and zero committed writes. An in-memory test with no transport is insufficient by itself to certify an independent durable slot invariant. These are review dispositions, independent of the original runtime TODO count. All 126 original TODOs remain in place.

## Independent expectations and observed differences

* T082 `OUT-{PERMANENT,TEMPORARY}-{PHYSICAL,ENDPOINT}-MISSING` requests a distinct explanation for the one absent observation. Four exact baseline assertions failed. Each used an actual completed and measured copper repair, removed the selected observation, omitted its ID, kept the other measurement and invoked the real classifier. All four returned `final-proof-missing`. Physical B-ENDPOINT explicitly expects that coarse reason with a passing link and an unrun endpoint test. RR-O12-ARRIVAL-ONLY also expects it. The physical contract and both outcome inputs remain valid evidence. [Baseline RED](reason-probe-final.txt) · [Reproducible probe](original-reason-probe.ts.txt)
* The optional diagnostic patch preserves the repair reason and attaches an outcome diagnostic naming the missing check. The primary interface still returns `incorrect` with no outcome or service award. The real encounter action uses the diagnostic to tell the player which balcony control to use. If the other ID is stale, foreign, unknown or records a failed test, feedback remains specific to the available evidence. A second absent proof keeps the generic reason. Reviewed shutdown bypasses link and endpoint requirements. Content validation precedes evaluation. The receipt, portable save, PHP and network contracts have no consumer for these transient diagnostics. Literal `reasonCode` equivalence remains unresolved even with this patch. [Diagnostic proposal](diagnostic.patch) · [Passing scoped run](diagnostic-final.txt)
* The first direct reason-replacement trial failed five assertions in the four-suite experiment, including existing UI wording. The final diagnostic preserves the aggregate reason and the phrase “separate endpoint test”. The raw literal reason probe is deliberately red when run against the final aggregate reason. The adaptation tests independently check the additional diagnostic and both durations. [First trial](reason-candidate.txt) · [Literal reason retained](diagnostic-probe.txt)
* Remaining distinctions include learner omission of individual temporary limitation/follow-up clauses versus one authored maintenance fact, the common authored conduit versus route-specific shutdown defects, and dropping an uncommitted prepared action versus returning an `invalid-input` response. No single substitution closes these rows. Nonempty personalization across all three requested collections and the exact seven-way unsafe-save/slot/message matrix are still partial. See the individual row key lists.

## QA-only proposal

[proposed.patch](proposed.patch) adds both durations of arrival-before-measurement and failed physical/endpoint observations, extends missing/wrong safe-anchor checks to temporary restoration, and tests four controlled account recovery boundaries. The actual PHP receipt and provider paths were not invoked by these new tests.

1. An older replayed acknowledgement arrives after E03 Continue with a later current slot. Actual client services retry the frozen body/key and preserve the newer dirty game, notes and E03 history. An automatic overwrite requires reconciliation.
2. Following failure Retry, a manual PUT presents `If-Match: "save-12"`. HTTP 412 reports revision 13. Memory and notes survive, no write commits and automatic overwrite is refused.
3. Network failure during Restore after E03 Continue and a subsequent fatal Retry leaves nonempty notes, hint history, E03 history, checkpoint and the confirmed revision-12 slot intact. No PUT occurs.
4. Invalid stored data on the same path fails before discard confirmation. The original retried memory and recoverable slot survive. The real dialog validates before displaying the destructive consent step.

## Verification and review inputs

Used the repository-pinned Node 26.13.1 and Vitest 5.1.2 in `.local/Q05-audit`, with `NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php`. All commands ran locally. The QA-only candidate ran against published source. The optional diagnostics used a separate copy of that source and the QA candidate. Neither patch was applied to the shared source or tests.

```sh
node node_modules/vitest/vitest.mjs run tests/ui/recovery-save.test.ts tests/state/outcome-classification.test.ts tests/state/encounter.test.ts
node node_modules/vitest/vitest.mjs run tests/state/q05-reason-probe.test.ts
node node_modules/vitest/vitest.mjs run tests/state/outcome-classification.test.ts tests/state/repair-plan.test.ts tests/ui/encounter-integration.test.ts tests/ui/recovery-save.test.ts
node node_modules/typescript/bin/tsc -p tsconfig.q05.json
```

QA-only 141/141 across three suites. Original-reason baseline probe 0/4. Final optional diagnostic and QA candidate 161/161 across four suites. Scoped strict TypeScript passed. The two green totals overlap. The diagnostic patch is prepared on top of the QA patch. Q05 did not repeat full browser, server or aggregate checks. Owner human review, live account/provider acceptance and release gates remain open. [QA run](baseline-9484507.txt) · [Diagnostic run](diagnostic-final.txt)

| Input | SHA-256 |
| --- | --- |
| tests/fixtures/outcomes.json | `1d9c734a783211bb4e02ecf43aa1c196d8cc5c05466f32da757730896ada0ad7` |
| tests/fixtures/retry-transitions.json | `8be2657298b75106b6a55e51e74364e5446c376a85939297e43d91fdd47a6bee` |
| proposed.patch | `b2b66197254461d1731b16c64969b4263883d355536f064c22f564b63e7c24a2` |
| diagnostic.patch | `ff6a3929f324002f0d75cb188ec1e31eea2851f8f9f1976b1aa1daad1070d7c4` |
