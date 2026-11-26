-- Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
-- Purpose-bound completion survives rotation only when explicitly transferred by callback.
-- Ordinary session auth_time is never deletion authorization. No provider identity duplicated.
CREATE UNIQUE INDEX sessions_identity ON sessions(id_hash, account_id);
CREATE TABLE delete_reauth_proofs (
    session_hash TEXT PRIMARY KEY NOT NULL,
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    confirmed_at INTEGER NOT NULL CHECK (confirmed_at BETWEEN 0 AND 253402300499),
    expires_at INTEGER NOT NULL CHECK (expires_at = confirmed_at + 300),
    FOREIGN KEY (session_hash, account_id) REFERENCES sessions(id_hash, account_id) ON DELETE CASCADE
) STRICT;
CREATE INDEX delete_reauth_expiry ON delete_reauth_proofs(expires_at);
