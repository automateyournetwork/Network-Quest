# Q01 deterministic recovery review

The generic recovery reducer accepted a previously used attempt UUID when the same identifier appeared with different capitalization. The test seeds this UUID solely in retained hint history, reconstructs reducer control from the runtime, and submits the lowercase spelling on both terminal failure and shutdown. Both transitions should reject with the original state object. A separate fresh UUID in uppercase should advance recovery and enter the world and volatile history in lowercase.

The ordinary encounter controller already canonicalizes attempt identities. Optional activity Retry also compares case-insensitively against world, preparation, measurement, hint and outcome history. The discrepancy affects the exported generic reducer, including direct callers. No player-facing failure was demonstrated.

The isolated fix normalizes IDs when constructing volatile history and when applying generic rewind. It preserves saved history, the original independent fixtures and the retry/Continue retention contract in SPEC.md and PLAN.md (AC07). See [candidate diff](recovery.patch), [baseline failure](red.txt) and [affected tests](green.txt).

## Review inputs

- Baseline Git commit `8ddb998c5250a95420f4b12dd1f162aa25ec80d7`, reducer SHA-256 `665ece27bfac77aedb11faa2eaf29780285f8c8a4525521271f308986666753a`.
- Proposed MG03 join reducer SHA-256 `0d9ed76c62e87448fad8e7c64ee05f8f1ae0b78c106ab44895dc0032d908f3a9`. Candidate patch applies cleanly in a dry run there. The join retains the optional case-insensitive history check.
- Node 26.13.1, Vitest 5.1.2. Baseline focused regression failed in both terminal states. Candidate passed all 38 reducer and 59 encounter tests. Coherent seven-activity and T104 adapter verification is pending the coordinator freeze.

## Other reviewed boundaries

Optional activity entry clones the world into an owned session. Retry reads this preparation, advances beyond retained revisions and marks notebook measurements stale in the same reducer operation. Exit restores the previous activity. Neither path assigns the encounter checkpoint. The controller checks game, session and auth object identity at dispatch and uses a compare-and-set against the exact reducer state at commit. Restore and New Adventure invalidate gameplay captures and save views before installing replacement state.

For interrupted saves, tests exercised explicit retry of frozen bytes, late callbacks after replacement (including the same adventure ID), older receipts and invalidated consent. The four focused action-bus, optional-controller, save-dialog and save-coordinator suites passed 117 tests on the isolated baseline with the recovery fix. No additional defect was demonstrated in these boundaries. [Focused run](boundaries.txt)
