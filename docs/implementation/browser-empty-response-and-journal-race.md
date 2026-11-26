# Native response and journal observation corrections

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator review, 2026-11-26. These corrections join loops 062/063 without
creating additional task loops. No host files or production data were changed.

## Empty HTTP 204 in native Firefox

Actual Firefox 159 fetch metadata for logout and account deletion was
`{status:204,bodyNull:false,bytes:0}`. Requiring a null Response.body left both
successful operations unconfirmed. The API now consumes an exposed stream with
a zero-byte bound, the existing deadline/abort guards and a final generation
check. Any received byte or nonzero advertised Content-Length is rejected.
An empty stream that never completes times out without clearing identity.

Five added cases cover logout/deletion, unexpected bytes, contradictory length
and a hanging stream. The genuine regression run had four failures; the corrected
API suite passes 86 cases. The final joined native T052/T050/T029 run passes 15 cases,
including direct 204 and lost-response receipt confirmation. See
[loop 062](loops/062-T052.md) for screenshots, exact hashes and browser details.
[MDN Response.body](https://developer.mozilla.org/en-US/docs/Web/API/Response/body)
also documents the difference between specified null bodies and browser behavior.

## Disappearing SQLite rollback journal

The twenty-session tool initially observed intermittent unavailable 503 replies.
Review found a separate reproducible race in Database::sidecars: another valid
connection can remove its DELETE journal after metadata is read but before a
second path/readability check. Normal commit then looked like a permissions error.

Sidecar admission now validates one lstat metadata snapshot: private regular 0600,
one link and the expected owner. An absent journal is allowed; an observed public
journal is rejected even if it subsequently disappears. Observed WAL/SHM files
remain rejected. Stable main database files retain their original identity,
permissions and access checks; parent path checks are unchanged.

The regression uses a fresh subprocess to interpose the one namespaced lstat
call, observe a real owned empty sidecar and remove it immediately afterward.
This deterministically models the syscall race; it is not represented as an
actual concurrent transaction. The private 0600 case failed before the fix; the
public 0644 negative control remains rejected. The focused database join passes
20 tests / 171 assertions. The first two test-authoring attempts incorrectly tracked
the transient sidecar as a permanent fixture and left four synthetic directories
when strict cleanup refused. After verifying exact contents, empty migrated
tables, private modes, owner/inodes and no open descriptors, root removed only
those four owned directories. Failure logs and the exact cleanup manifest remain
in ignored local evidence.

## Joined verification and limits

- Full PHP: 908 tests / 19,138 assertions PASS, 35.975 seconds, 34 MiB.
- Full client: 1,402 PASS / 191 explicit TODO, 39 suites, 17.70 seconds. Pending cases are
  68 physical evaluator cases and123 asset semantic cases, not episode acceptance.
- One subsequent default native HTTPS baseline:20 sessions, 260 requests,
  20 initial 201 and 240 later 200, zero transport/service/body-validation errors.
  Save p95 including initial writes: 134.020 ms across 80 saves; all-request
  p95: 119.670 ms. Cleanup verified. See the
  [measurement profile](../evidence/spec001/measurement-profile.md).

That later run does not prove every earlier 503 had the same cause or establish
GoDaddy capacity. Earlier failures remain in the measurement record. No actual
provider login, production release, owner review or finished-media acceptance
is claimed by these corrections.
