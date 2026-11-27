# R12 accessibility audit with the isolated Firefox correction

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator follow-up, 2026-11-26. The real guest copper journey reached R12
and completed full-page axe audits at 768 and 390 pixels with 200% text:
**1 browser case passed in 15.6 seconds; zero automatic violations at both
sizes.** Each audit passed 35 rules and left one color-contrast result incomplete
because a paragraph was partially clipped by the scrollable dialog. This is not
a claim that manual contrast review or the complete episode audit is finished.

The preserved diagnostic copies the actual T078 browser journey and keeps its
gameplay, keyboard/focus, geometry, save restrictions and error assertions. Only
support import paths, the explicitly selected diagnostic browser executable and
the added full-page axe collection differ. No state, objective or measurement is
injected; the journey starts with New Adventure and uses the real local service.
No audit rule or page region is excluded. The run made no production request.

The driver remains pinned Playwright1.65.1 with Node26.13.1. Firefox revision1575
is an explicitly selected, separately downloaded diagnostic candidate. Its
official archive and executable hashes are recorded in
[candidate provenance](firefox-1575-provenance.json). The project's package and
lock files, cached Firefox1572, owner previews and Safari were unchanged. Earlier
crashes remain in their original evidence. The minimal cross-context reproduction
and upstream references are in [the original diagnosis](firefox-reflection-diagnosis.md).

This application result supports that diagnosis and establishes an executable
audit path. T152 still owns the final reproducible browser decision, current full
episode/dialog checks, manual checks and any resulting corrections. The initial
candidate provenance's `applicationAuditPassed: false` records its earlier state;
this later report supplies the actual new result without rewriting that history.

Artifacts:

- [Raw run log](r12-candidate-audit.log).
- [390-pixel complete audit result](R12-390-axe.json).
- [768-pixel complete audit result](R12-768-axe.json).
- [Actual source/build hashes](r12-candidate-source-build.json).
- [Preserved diagnostic journey](r12-browser-diagnostic.spec.ts) and
  [isolated configuration](application-diagnostic.config.ts).

Run from the repository root with the recorded candidate installed separately:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php node node_modules/playwright/cli.js test --config=docs/evidence/spec001/accessibility/application-diagnostic.config.ts --grep 'guest replacement route'
```
