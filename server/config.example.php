<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

/*
 * INERT TEMPLATE: there is no application configuration loader yet.
 * Copy to a private, owner-readable file outside the repository and every web
 * document root. The future launcher supplies that absolute file path explicitly
 * as NQ_CONFIG_FILE; it must never fall back to this example or a repository .env.
 * Empty required values mean unconfigured and MUST prevent service startup.
 *
 * All paths below must be operator-supplied absolute paths. The future loader
 * must resolve symlinks/parents, reject paths inside ANY public document root,
 * reject shared website/analytics stores, and check file/directory permissions.
 * No path is derived from __DIR__, the working directory, or the public URL.
 * Local tests use separate disposable storage and separate provider apps.
 * This file reads no environment, loads no secret, opens no DB, starts no session,
 * and offers no test-auth mode. Runtime validation belongs to later tasks.
 */
return [
    'environment' => '', // Explicitly choose local, staging, or production.
    'origin' => '', // Exact HTTPS scheme + host (+ port), without a trailing slash.
    'game_base' => '/arcade/play/network-quest/',
    'api_base' => '/arcade/play/network-quest/api/v1',
    'paths' => [
        // Include every applicable web-server document root in the future check.
        'document_roots' => [],
        // Dedicated game SQLite file; never website/analytics or production test data.
        'game_database_file' => '',
        'log_directory' => '',
        // Encrypted consistent backups, separate from active game storage.
        'backup_directory' => '',
        // Durable deletion ledger + receipt hashes: OUTSIDE DB backup/rollback sets.
        'recovery_directory' => '',
        // Keep encryption keys separate from backups and recovery copies.
        'backup_key_file' => '',
        'rate_bucket_key_file' => '',
    ],
    'session' => [
        // Opaque server-owned sessions live in the private game store.
        'cookie_name' => '__Secure-nq_session',
        'cookie_path' => '/arcade/play/network-quest/', // Must match game_base.
        'cookie_secure' => true, // Local HTTPS too; never weaken this for development.
        'cookie_http_only' => true,
        'cookie_same_site' => 'Lax',
        // Omit the Domain attribute: host-only. Never use a parent-domain cookie.
        'idle_timeout_seconds' => 7200,
        'absolute_timeout_seconds' => 86400,
    ],
    'oauth' => [
        // Server-side authorization code, S256 PKCE, one-use state; Google nonce.
        // No tokens in browser storage or logs; discard after identity verification.
        'transaction_timeout_seconds' => 600,
        'google' => [
            'client_id' => '',
            'client_secret' => '',
            // Exact registered HTTPS origin + api_base + /auth/google/callback.
            'redirect_uri' => '',
            'scopes' => ['openid', 'profile'], // No email, offline access, or API scopes.
        ],
        'github' => [
            'client_id' => '',
            'client_secret' => '',
            // Exact registered HTTPS origin + api_base + /auth/github/callback.
            'redirect_uri' => '',
            'scopes' => [], // Explicit empty scope; GenericProvider and /user only.
        ],
    ],
    'sqlite' => [
        'foreign_keys' => true,
        'journal_mode' => 'DELETE',
        'synchronous' => 'FULL',
        'busy_timeout_ms' => 250,
    ],
    // Application policy only: actual host/provider retention is still unverified.
    'retention' => [
        'write_receipt_seconds' => 604800,
        'deletion_receipt_seconds' => 86400,
        'log_seconds' => 604800,
        'backup_seconds' => 604800,
        // Required later: longest real backup lifetime plus restoration handling.
        // Do not default deletion markers to the shorter application backup window.
        'deletion_ledger_seconds' => null,
    ],
];
