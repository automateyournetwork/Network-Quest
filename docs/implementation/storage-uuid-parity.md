# Save UUID storage parity correction

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator integration review, 2026-11-26, after accepted T037/T038 and during
T042 parity verification. The shared save schema's UUID format accepts uppercase
hex. T042 independently verifies uppercase UUID acceptance in JavaScript/PHP and
preserves exact JSON bytes. T037's storage CHECK had required lowercase hex for
external adventure and request UUIDs, which would turn a valid candidate into a
storage error.

A new DatabaseTest case first failed with the actual adventure_id CHECK error
(one error, zero assertions). The two external UUID CHECKs now permit upper/lower
hex while retaining exact36-character, hyphen-position and hex-only restrictions.
Internal account UUID generation/storage is unchanged. No snapshot is reserialized
or case-normalized to satisfy storage, and acknowledgement requestId preserves the
supplied representation. Non-hex, newline-suffixed and URN forms remain rejected.

Final pinned PHP8.4.28 run of DatabaseTest, SessionsTest and SecurityTest passed
**46 tests / 378 assertions**:18 database tests and28 session/security tests.
This joins the narrow storage correction with the new session services; it does
not pass HTTP save behavior, idempotency-key lookup semantics or real providers.
T043 must document any UUID comparison/key canonicalization consistently while
preserving exact request fingerprints, snapshot bytes and public summary identity.

The initial SQL is still unreleased: this run has deployed no production game DB
or migration. This changes migration1's checksum. A database initialized from an
older development snapshot continues to fail closed on checksum drift; do not
reset it or discard data. Such an instance requires a separately reviewed forward
migration before adoption. No existing private/player/host database was opened,
rewritten or reset here; tests used disposable synthetic storage only.

| Current file | SHA-256 |
| --- | --- |
| `server/migrations/001_game.sql` | `c4f4839089beea8d54273d1ccadfd123dd4caeb789901bdf70fecdbd9235ce6e` |
| `server/tests/DatabaseTest.php` | `64b4ccb3e5c92ea8dda3724fc620fbdfa2ad3af7e9262389c5a915cf3ee1a8d5` |

Loop042's original hashes and tests remain historical evidence. This correction
records the newer inputs rather than rewriting its prior attempt.
