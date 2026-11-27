# T104 canonical entrypoint correction

Both canonical journeys now run against the current working directory and write only to fresh ignored `.local/test-results` directories by default. They no longer select hidden historical source roots or sealed evidence paths. The optional-activity canonical spec contains the current all-seven journey, with correct support imports and actual working-tree hashes; it does not claim an immutable execution commit. Companions uses the current built output and records both source and built-file hashes.

Playwright explicitly assigns companions to `firefox-owned-static` (owned ephemeral guest preview and Firefox) and optional activities to `firefox-local-https` (owned trusted TLS/PHP identity fixture and Firefox, certificate errors not ignored). The unassigned-spec guard is retained. Playwright's own output directory is also unique and ignored. No global application source was changed.

Normal `playwright test --list` passed with146 tests in26 files. The targeted list found exactly the two intended tests. Build/strict TypeScript passed, retaining the ordinary bundle-size warning. The actual main-config targeted command exited0 with **2 passed (3.1m)**:

```
NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php playwright test \
  tests/e2e/companions.spec.ts tests/e2e/optional-activities.spec.ts \
  --project=firefox-owned-static --project=firefox-local-https --workers=1
```

The proof used an isolated published55b9bfcd7ca1f0aef0b4add6f6d86790e34e7cad archive with zero production changes and exactly four test/config changes. The actual default directories are recorded in verification.json; these public report/image copies were exported explicitly after the run. Runtime defaults never pointed here.

The companion canonical run passed53 grouped checks: all25 real discoveries, all9 earned level2 progressions,18 nonempty ability/conventional comparisons, party capacity/stale controls, 200% text at three widths, two scoped axe scans and actual R12 copper restoration. Its291 recorded source/build hashes stayed unchanged. The optional canonical run passed56 lifecycle rows,28 unfinished exits,7 explicitly simulated logical-hour/visibility checks and3 exact earned-progress recovery cases. Its258 source hashes stayed unchanged. Forty manual saves used one slot with autosave off. Both reports have zero browser/network violations. These overlapping groups are not140 distinct oracle passes or a performance/aggregate accessibility/media claim.

Across both runs,255 production/support inputs match published55b9bfc,33 are observed generated build files, and4 are the explicit test-only changes. Q05's separately reviewed/published fa2740cd3ac8ad22dd86feeef87c6802aa0fc4a8 diagnostics/policy-hash delta is disclosed; this run does not claim to execute its later bytes. The coordinator explicitly required no additional full native rerun for that bounded delta.

Both old canonical files were first archived byte-for-byte. source-supersession.json links their historical seal entries to the exact archived sources and records the replacement hashes. The five historical seal files were not edited:147 other referenced paths still match, and2 superseded canonical source references resolve to exact archives. Historical verification statements retain their original point-in-time meaning; we do not falsely claim the two replaced locations are unchanged now.

Both test cleanup blocks and the complete Playwright runner finished. Owned preview/browser/TLS/PHP and the managed web server closed. Owner previews were untouched. There were no failed test runs in this canonical correction stage. Prior genuine failures remain in their original sealed packets. The original140 reconciliation, six absent timing modes, four T105 whole-route rows and media-dependent literal animation limit remain explicit. Root owns task acceptance and publication.
