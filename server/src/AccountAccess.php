<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

/**
 * Trusted external deletion barrier. No permissive production implementation/default.
 *
 * run acquires the external barrier BEFORE any Database transaction, reconciles durable
 * deletion intents against live storage, and holds the barrier through the synchronous
 * operation's completion/rollback. Reconciliation failure throws and never runs operation.
 * The operation owns its short Database transactions; it must not perform provider/network
 * IO or call run recursively. The implementation releases the barrier on every exit.
 * All account reads/creation/writes/deletion must share this same lock order and barrier.
 * This port is constructed by trusted deployment composition, never HTTP/config-selected.
 */
interface AccountAccess
{
    public function run(callable $operation): mixed;
}
