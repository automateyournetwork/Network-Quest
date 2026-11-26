<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use Closure;
use LogicException;
use PDO;

/** T046 supplies HTTP correlation/no-store headers, empty204 or fixed409 Problem. */
final readonly class AccountDeletionResult
{
    private function __construct(public int $status, public ?string $code, public ?string $message) {}
    public static function deleted(): self { return new self(204, null, null); }
    public static function conflict(): self
    { return new self(409, 'deletion-receipt-conflict', 'This deletion receipt was already used.'); }
}

/** Account identity is exclusively derived from current session+purpose-specific server proof. */
final class AccountDeletion
{
    private readonly Closure $clock;
    private readonly ?Closure $phaseObserver;

    /**
     * Observer is trusted fixed-phase failure injection/observability, absent in production;
     * no HTTP/config binding. It sees neither credentials nor identity and cannot authorize.
     */
    public function __construct(private readonly Database $database, private readonly Sessions $sessions,
        private readonly Security $security, private readonly RecoveryAccountAccess $access,
        private readonly DeletionLedger $ledger, ?callable $clock = null, ?callable $phaseObserver = null)
    {
        $access->assertScope($database, $ledger);
        $this->clock = Closure::fromCallable($clock ?? time(...));
        $this->phaseObserver = $phaseObserver === null ? null : Closure::fromCallable($phaseObserver);
    }

    /** Called outside any AccountAccess::run. All short phases share ONE held external barrier. */
    public function delete(string $peerAddress, array $fields): AccountDeletionResult
    {
        $headers = Security::headers($fields);
        return $this->access->run(function () use ($headers, $peerAddress): AccountDeletionResult {
            $prior = $this->security->mutation($headers, $this->sessions);
            if (($headers['x-confirm-account-deletion'] ?? '') !== 'delete-my-account') { throw new RequestRejected('forbidden'); }
            $token = $headers['x-deletion-receipt'] ?? '';
            if (!Security::isToken($token)) { throw new RequestRejected('invalid-request'); }
            $this->security->limit('deletion', $prior, $peerAddress);
            [$account, $now] = $this->database->immediate(fn (PDO $pdo): array =>
                $this->sessions->within($pdo, $prior, function (SessionContext $current) use ($pdo): array {
                    // auth_time, ordinary login, client timestamps or fresh guest sessions are
                    // NOT this proof. T041 issues it only after new same-identity delete-reauth.
                    // Obtain time after lock acquisition and the final session recheck: a
                    // proof can expire between request admission and this authorization.
                    $now = $this->now();
                    $proof = $pdo->prepare('SELECT confirmed_at,expires_at FROM delete_reauth_proofs WHERE session_hash=? AND account_id=?');
                    $proof->execute([$current->idHash, $current->accountId]); $row = $proof->fetch();
                    if ($row === false || $now < $row['confirmed_at'] || $now > $row['expires_at']
                        || $row['expires_at'] !== $row['confirmed_at'] + 300) { throw new RequestRejected('forbidden'); }
                    return [$current->accountId, $now];
                }));
            // No game transaction is active while external intent + binding commit together.
            // The shared barrier prevents protected logout/save/auth from changing authority.
            // Once this intent commits, completion/recovery is mandatory even after expiry.
            try { $this->ledger->accept($account, hash('sha256', $token), $now); }
            catch (DeletionReceiptConflict) { return AccountDeletionResult::conflict(); }
            unset($token);
            $this->observe('intent-durable');
            $this->database->immediate(fn (PDO $pdo) => $pdo->prepare('DELETE FROM accounts WHERE id=?')->execute([$account]));
            $this->observe('live-committed');
            $this->ledger->complete($account, max($now, $this->now()));
            $this->observe('completed');
            return AccountDeletionResult::deleted();
        });
    }

    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 252771580799) { throw new LogicException('Deletion clock is outside supported UTC bounds.'); }
        return $now;
    }
    private function observe(string $phase): void
    {
        if ($this->database->connection()->inTransaction()) { throw new LogicException('Deletion phase must follow its transaction.'); }
        if ($this->phaseObserver !== null) { ($this->phaseObserver)($phase); }
    }
}
