# Same loop099 / T086 — additive shutdown-duration correction

2026-11-27. Root-authorized follow-up to T089's actual no-duration E03 browser
dead end. Earlier T086 notes/seals remain historical and unchanged; no counter,
tracking or acceptance update is made here.

Added tests first in `tests/state/shutdown-duration.test.ts`: 13 genuine failures
and 12 passes exposed the review/UI/active-guard/save-policy gap. Corrected the
existing repair adapter, shared Rift guard, repair UI projection and save-policy
codes with one canonical measurement-duration helper. Shutdown needs no fabricated
installation choice. Its absent/prior valid flag remains unchanged, invalid flags
are rejected, checkpoint presence/value stays exact and temporary dependency is
false. Six restoration plans retain their strict duration requirements.

Updated only the two repair/outcome fixture defaults and three targeted existing
test helpers/expectations, leaving original independent oracles intact. Generated
the actual policy after source freeze; no schema or PHP validator changes.

Final focused verification: **569 PASS / 126 original TODO in 15 suites**;
`npm run check` PASS. All three routes execute no-duration isolation, classify
honest unsafe E03, confirm the actual recovery controller, retain historical
proof and validate the resulting safe snapshot in JS/PHP8.4.28. One supplemental
policy test run omitted `NQ_PHP_BIN`; its genuine failure is preserved and the
corrected pinned-PHP rerun passed. No full build or native browser was run here.

Source frozen and handed to root/T089 for reviewed native rerun. Root's separate
application retry-render fix was not touched. T090's future packet export remains
outside this correction. No tracking, Git, provider, host or protected-preview
mutation occurred.

See [additive evidence](../../evidence/spec001/outcomes/t086/shutdown-duration/review.md)
and [source seal](../../evidence/spec001/outcomes/t086/shutdown-duration/source-seal.json).

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
