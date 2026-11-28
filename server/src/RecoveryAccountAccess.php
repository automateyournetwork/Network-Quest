<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use Closure;
use LogicException;
use PDO;
use RuntimeException;

/** Mandatory production barrier. No fallback that permits unreconciled account access. */
final class RecoveryAccountAccess implements AccountAccess
{
    private readonly Closure $clock;

    public function __construct(private readonly Database $database, private readonly DeletionLedger $ledger, ?callable $clock = null)
    { $this->clock = Closure::fromCallable($clock ?? time(...)); }

    /**
     * One global external barrier precedes game transactions and remains held through their
     * commit/rollback. No network/provider work or recursive run in the trusted callback.
     * Both pending and completed markers are replayed: an older restored DB can contain an
     * account whose marker completed earlier. Status lookup deliberately never calls run.
     */
    public function run(callable $operation): mixed
    {
        if ($this->database->connection()->inTransaction()) { throw new LogicException('Acquire account recovery before the game transaction.'); }
        return $this->ledger->exclusive(function () use ($operation): mixed {
            if ($this->ledger->drained()) throw new RuntimeException('Account operations are drained for maintenance.');
            $markers = $this->ledger->markers();
            if ($markers !== []) {
                $now = ($this->clock)();
                if (!is_int($now) || $now < 0 || $now > 253402300799) { throw new LogicException('Recovery clock is outside supported UTC bounds.'); }
                foreach ($markers as $marker) {
                    if ($marker['intentAt'] > $now) { throw new RuntimeException('Recovery clock precedes an authorized intent.'); }
                }
                // External DB has NO active transaction here. Cascades remove all identities,
                // sessions, pending auth/reauth, preferences, saves and save receipts atomically.
                $this->database->immediate(function (PDO $pdo) use ($markers): void {
                    $delete = $pdo->prepare('DELETE FROM accounts WHERE id=?');
                    foreach ($markers as $marker) { $delete->execute([$marker['accountId']]); }
                });
                // Live COMMIT has returned before ANY durable external completion write.
                $pending = array_column(array_filter($markers, fn (array $marker): bool => $marker['completedAt'] === null), 'accountId');
                $this->ledger->completeMany($pending, $now);
            }
            return $operation();
        });
    }

    /** Prevent accidentally composing deletion with a different game's DB/ledger/barrier. */
    public function assertScope(Database $database, DeletionLedger $ledger): void
    {
        if ($database !== $this->database || $ledger !== $this->ledger) { throw new LogicException('Deletion requires the same recovery scope.'); }
    }
}
