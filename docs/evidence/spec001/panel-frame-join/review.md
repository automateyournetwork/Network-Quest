# Contextual panel and adventure-frame join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator follow-up during T078, 2026-11-26. The actual first-route browser run
found that Close diagnostics did nothing. The adventure frame intentionally moves
a live Close button beside its own dialog heading; both diagnostics and repair
panels checked membership only in their body container and rejected that button.

The correction checks membership in the owning dialog. The active render scope,
AbortController lifetime, connected/visible/non-inert dialog and disabled-button
checks remain. No state/evaluator, schema or physical expectation changed.

Each isolated production-panel Firefox159.0 test now includes three integration
regressions: the current header Close works and restores opener focus, an old
Close reattached in a new projection remains inert, and a current Close moved
outside its owning dialog remains inert. Existing hidden, disposed, detached,
acknowledgement, keyboard and semantic-focus tests remain.

Actual results using pinned Node26.13.1 and the scripts below:

| Panel | Before correction | After correction | Page errors |
| --- | --- | --- | --- |
| Diagnostics | 14 PASS / 1 FAIL | 15 PASS / 0 FAIL | 0 |
| Repair plan | 14 PASS / 1 FAIL | 15 PASS / 0 FAIL | 0 |

Only the current-header-close case failed before the correction. Both failures
were reproduced before changing production code. JSON reports preserve exact
source hashes, browser versions, timestamps and assertions. The repair script
now accepts output/screenshot paths so later runs preserve historical sealed
T077 artifacts. Existing T074/T077 seals remain valid historical snapshots, not
claims that their old hashes describe the corrected source.

```sh
.runtime/node-v26.13.1-darwin-arm64/bin/node tests/ui/diagnostics-panel.browser.mjs docs/evidence/spec001/panel-frame-join/diagnostics-green.json
.runtime/node-v26.13.1-darwin-arm64/bin/node tests/ui/repair-plan-panel.browser.mjs docs/evidence/spec001/panel-frame-join/repair-green.json docs/evidence/spec001/panel-frame-join/repair-green.png
```

These are actual isolated DOM checks. The unstyled screenshots are retained as
harness artifacts, not finished-room/200% accessibility acceptance. T078 still
owns the complete application route, actual frame interaction and Save/Continue;
full browser, human, provider and episode gates remain separate. No protected
owner preview or production server was changed.
