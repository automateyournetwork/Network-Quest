-- Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
-- External recovery artifact. Never include in game DB backups/rollback/restore sets.
CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    applied_at INTEGER NOT NULL CHECK (applied_at BETWEEN 0 AND 253402300799),
    checksum TEXT NOT NULL CHECK (length(checksum) = 64 AND checksum NOT GLOB '*[^0-9a-f]*')
) STRICT;
CREATE TABLE retention_policy (
    singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
    backup_seconds INTEGER NOT NULL CHECK (backup_seconds BETWEEN 1 AND 315360000),
    restoration_seconds INTEGER NOT NULL CHECK (restoration_seconds BETWEEN 1 AND 315360000),
    evidence_reference TEXT NOT NULL CHECK (length(evidence_reference) BETWEEN 1 AND 200)
) STRICT;
CREATE TABLE deletion_markers (
    account_id TEXT PRIMARY KEY NOT NULL CHECK (length(account_id) = 36
        AND account_id GLOB '????????-????-????-????-????????????'
        AND length(replace(account_id, '-', '')) = 32 AND replace(account_id, '-', '') NOT GLOB '*[^0-9a-f]*'),
    intent_at INTEGER NOT NULL CHECK (intent_at BETWEEN 0 AND 252771580799),
    completed_at INTEGER CHECK (completed_at BETWEEN intent_at AND 253402300799),
    retain_until INTEGER NOT NULL CHECK (retain_until > intent_at AND retain_until <= 253402300799)
) STRICT;
-- No account reference: this set prevents a once-used token being rebound after binding expiry.
CREATE TABLE spent_receipts (
    receipt_hash TEXT PRIMARY KEY NOT NULL CHECK (length(receipt_hash) = 64 AND receipt_hash NOT GLOB '*[^0-9a-f]*')
) STRICT;
CREATE TABLE deletion_receipts (
    receipt_hash TEXT PRIMARY KEY NOT NULL REFERENCES spent_receipts(receipt_hash),
    account_id TEXT NOT NULL UNIQUE REFERENCES deletion_markers(account_id),
    accepted_at INTEGER NOT NULL CHECK (accepted_at BETWEEN 0 AND 253402214399),
    expires_at INTEGER NOT NULL CHECK (expires_at = accepted_at + 86400)
) STRICT;
CREATE INDEX deletion_receipts_expiry ON deletion_receipts(expires_at);
