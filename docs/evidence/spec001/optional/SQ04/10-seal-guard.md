# Point-in-time dependency seal

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The final 51-test run and strict typecheck passed. A comparison immediately
before/after those commands reported 132 dependency files and zero changes.
While the evidence files were being assembled, the active common-framework
worker subsequently changed `src/app/application.ts`, `src/state/reducer.ts`
and `src/ui/optional-activities.ts`. The sealing script's second, later guard
therefore stopped with:

```text
AssertionError: ['src/app/application.ts', 'src/state/reducer.ts', 'src/ui/optional-activities.ts']
```

Those shared edits were left intact. The source seal records the hashes at the
completed verification point and separately lists later dependency changes.
It does not imply that current or future common-framework edits have passed the
SQ04 tests. The same worker's required final coherent join remains pending.
