-- Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
-- Dedicated game schema. Unix seconds are UTC; API formatting happens at the boundary.
-- Schema constraints supplement, never replace, service authorization/content validation.
-- Deletion intents/receipts deliberately live OUTSIDE this DB and its rollback sets.

CREATE TABLE schema_migrations (
    version INTEGER PRIMARY KEY CHECK (version > 0),
    applied_at INTEGER NOT NULL CHECK (applied_at BETWEEN 0 AND 253402300799),
    checksum TEXT NOT NULL CHECK (length(checksum) = 64 AND checksum NOT GLOB '*[^0-9a-f]*')
) STRICT;

CREATE TABLE accounts (
    id TEXT PRIMARY KEY NOT NULL COLLATE BINARY
        CHECK (length(id) = 36 AND id GLOB '????????-????-????-????-????????????'
            AND length(replace(id, '-', '')) = 32 AND replace(id, '-', '') NOT GLOB '*[^0-9a-f]*'),
    created_at INTEGER NOT NULL CHECK (created_at BETWEEN 0 AND 253402300799),
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'deleting'))
) STRICT;

CREATE TABLE identities (
    account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    subject TEXT NOT NULL COLLATE BINARY CHECK (length(subject) BETWEEN 1 AND 255 AND instr(subject, char(0)) = 0),
    display_name TEXT CHECK (display_name IS NULL OR (length(display_name) <= 128 AND instr(display_name, char(0)) = 0)),
    UNIQUE (provider, subject),
    CHECK (provider <> 'github' OR (subject NOT GLOB '*[^0-9]*' AND substr(subject, 1, 1) BETWEEN '1' AND '9'))
) STRICT;

CREATE TABLE sessions (
    id_hash TEXT PRIMARY KEY NOT NULL CHECK (length(id_hash) = 64 AND id_hash NOT GLOB '*[^0-9a-f]*'),
    account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    csrf_hash TEXT NOT NULL CHECK (length(csrf_hash) = 64 AND csrf_hash NOT GLOB '*[^0-9a-f]*'),
    created_at INTEGER NOT NULL CHECK (created_at BETWEEN 0 AND 253402214399),
    last_activity INTEGER NOT NULL CHECK (last_activity >= created_at AND last_activity <= expires_at),
    expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + 86400),
    auth_time INTEGER CHECK (auth_time IS NULL OR (auth_time >= created_at AND auth_time <= expires_at)),
    generation INTEGER NOT NULL CHECK (generation BETWEEN 1 AND 9007199254740991),
    CHECK ((account_id IS NULL AND auth_time IS NULL) OR (account_id IS NOT NULL AND auth_time IS NOT NULL))
) STRICT;
CREATE INDEX sessions_account ON sessions(account_id);
CREATE INDEX sessions_expiry ON sessions(expires_at);
CREATE INDEX sessions_activity ON sessions(last_activity);

CREATE TABLE auth_transactions (
    state_hash TEXT PRIMARY KEY NOT NULL CHECK (length(state_hash) = 64 AND state_hash NOT GLOB '*[^0-9a-f]*'),
    session_hash TEXT NOT NULL REFERENCES sessions(id_hash) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('google', 'github')),
    purpose TEXT NOT NULL CHECK (purpose IN ('login', 'delete-reauth')),
    expected_account_id TEXT REFERENCES accounts(id) ON DELETE CASCADE,
    nonce_hash TEXT CHECK (nonce_hash IS NULL OR (length(nonce_hash) = 64 AND nonce_hash NOT GLOB '*[^0-9a-f]*')),
    pkce_verifier TEXT NOT NULL CHECK (length(pkce_verifier) BETWEEN 43 AND 128 AND pkce_verifier NOT GLOB '*[^A-Za-z0-9._~-]*'),
    created_at INTEGER NOT NULL CHECK (created_at BETWEEN 0 AND 253402300199),
    expires_at INTEGER NOT NULL CHECK (expires_at > created_at AND expires_at <= created_at + 600),
    consumed_at INTEGER CHECK (consumed_at IS NULL OR (consumed_at >= created_at AND consumed_at <= 253402300799)),
    CHECK ((purpose = 'login' AND expected_account_id IS NULL) OR (purpose = 'delete-reauth' AND expected_account_id IS NOT NULL)),
    CHECK (provider <> 'google' OR nonce_hash IS NOT NULL)
) STRICT;
CREATE INDEX auth_transactions_session ON auth_transactions(session_hash);
CREATE INDEX auth_transactions_account ON auth_transactions(expected_account_id);
CREATE INDEX auth_transactions_expiry ON auth_transactions(expires_at);

-- Explicit insertion creates revision1; account creation must insert this row in its transaction.
-- Initial volume1/captions-on/system motion/scale1 are engineering defaults; autosave is opt-in.
CREATE TABLE preferences (
    account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL DEFAULT 1 CHECK (revision BETWEEN 1 AND 9007199254740991),
    autosave_enabled INTEGER NOT NULL DEFAULT 0 CHECK (autosave_enabled IN (0, 1)),
    music_volume REAL NOT NULL DEFAULT 1 CHECK (music_volume BETWEEN 0 AND 1),
    effects_volume REAL NOT NULL DEFAULT 1 CHECK (effects_volume BETWEEN 0 AND 1),
    voice_volume REAL NOT NULL DEFAULT 1 CHECK (voice_volume BETWEEN 0 AND 1),
    captions INTEGER NOT NULL DEFAULT 1 CHECK (captions IN (0, 1)),
    reduced_motion TEXT NOT NULL DEFAULT 'system' CHECK (reduced_motion IN ('system', 'on', 'off')),
    text_scale REAL NOT NULL DEFAULT 1 CHECK (text_scale BETWEEN 1 AND 2)
) STRICT;

-- One row/account. T043 owns positive monotonic CAS revisions and payload/hash consistency.
-- Preserve exact JSON text. Do not apply today's save-v1 schema to an unknown stored version.
CREATE TABLE saves (
    account_id TEXT PRIMARY KEY NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    revision INTEGER NOT NULL CHECK (revision BETWEEN 1 AND 9007199254740991),
    saved_at INTEGER NOT NULL CHECK (saved_at BETWEEN 0 AND 253402300799),
    schema_version INTEGER NOT NULL CHECK (schema_version BETWEEN 1 AND 9007199254740991),
    content_version TEXT NOT NULL CHECK (length(content_version) BETWEEN 1 AND 32 AND instr(content_version, char(0)) = 0),
    -- External UUID text follows format:uuid, including uppercase hex; payload bytes stay exact.
    adventure_id TEXT NOT NULL CHECK (length(adventure_id) = 36 AND adventure_id GLOB '????????-????-????-????-????????????'
        AND length(replace(adventure_id, '-', '')) = 32 AND replace(adventure_id, '-', '') NOT GLOB '*[^0-9a-fA-F]*'),
    payload_json TEXT NOT NULL CHECK (length(CAST(payload_json AS BLOB)) BETWEEN 2 AND 262144 AND json_valid(payload_json) AND json_type(payload_json) = 'object'),
    payload_hash TEXT NOT NULL CHECK (length(payload_hash) = 64 AND payload_hash NOT GLOB '*[^0-9a-f]*'),
    summary_json TEXT NOT NULL CHECK (length(CAST(summary_json AS BLOB)) BETWEEN 2 AND 4096 AND json_valid(summary_json) AND json_type(summary_json) = 'object')
) STRICT;

CREATE TABLE write_receipts (
    account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
    request_id TEXT NOT NULL COLLATE BINARY CHECK (length(request_id) = 36 AND request_id GLOB '????????-????-????-????-????????????'
        AND length(replace(request_id, '-', '')) = 32 AND replace(request_id, '-', '') NOT GLOB '*[^0-9a-fA-F]*'),
    fingerprint TEXT NOT NULL CHECK (length(fingerprint) = 64 AND fingerprint NOT GLOB '*[^0-9a-f]*'),
    committed_revision INTEGER NOT NULL CHECK (committed_revision BETWEEN 1 AND 9007199254740991),
    committed_at INTEGER NOT NULL CHECK (committed_at BETWEEN 0 AND 253401695999),
    -- Only immutable commit metadata. Service adds replayed/currentSummary at read time.
    acknowledgement_json TEXT GENERATED ALWAYS AS (json_object(
        'requestId', request_id, 'committedRevision', committed_revision,
        'committedAt', strftime('%Y-%m-%dT%H:%M:%SZ', committed_at, 'unixepoch'))) STORED,
    expires_at INTEGER NOT NULL CHECK (expires_at = committed_at + 604800),
    PRIMARY KEY (account_id, request_id)
) STRICT;
CREATE INDEX write_receipts_expiry ON write_receipts(expires_at);

CREATE TABLE operational_counters (
    bucket_key TEXT NOT NULL CHECK (length(bucket_key) = 64 AND bucket_key NOT GLOB '*[^0-9a-f]*'),
    period INTEGER NOT NULL CHECK (period BETWEEN 0 AND 253402300798),
    count INTEGER NOT NULL CHECK (count BETWEEN 0 AND 9007199254740991),
    expires_at INTEGER NOT NULL CHECK (expires_at > period AND expires_at <= 253402300799),
    PRIMARY KEY (bucket_key, period)
) STRICT;
CREATE INDEX operational_counters_expiry ON operational_counters(expires_at);
