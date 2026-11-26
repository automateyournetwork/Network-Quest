<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Identity;

use Closure;
use InvalidArgumentException;
use LogicException;
use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\SessionContext;
use NetworkQuest\Sessions;
use PDO;

/** Shared private OAuth state storage. Mandatory external barrier precedes each short DB transaction. */
final class AuthTransactions
{
    private readonly Closure $clock;

    public function __construct(private readonly Database $database, private readonly Sessions $sessions, private readonly AccountAccess $accounts, ?callable $clock = null)
    {
        $this->clock = Closure::fromCallable($clock ?? time(...));
    }

    /** Internal start material: expose only the constructed provider URL and expiry to the browser. */
    public function begin(SessionContext $session, string $provider, string $purpose = 'login'): array
    {
        self::provider($provider);
        if (!in_array($purpose, ['login', 'delete-reauth'], true)) {
            throw new RequestRejected('invalid-request');
        }
        return $this->accounts->run(fn (): array => $this->database->immediate(fn (PDO $pdo): array => $this->sessions->within($pdo, $session,
            function (SessionContext $current) use ($pdo, $provider, $purpose): array {
                $now = $this->now();
                $expected = null;
                if ($purpose === 'delete-reauth') {
                    if ($current->accountId === null) throw new RequestRejected('unauthorized');
                    $query = $pdo->prepare('SELECT provider FROM identities WHERE account_id=?');
                    $query->execute([$current->accountId]);
                    if ($query->fetchColumn() !== $provider) throw new RequestRejected('invalid-request');
                    $expected = $current->accountId;
                }
                // Bound outstanding attempts across providers. Never evict another live window.
                $query = $pdo->prepare('SELECT count(*) FROM auth_transactions WHERE session_hash=? AND consumed_at IS NULL AND expires_at>?');
                $query->execute([$current->idHash, $now]);
                if ($query->fetchColumn() >= 5) throw new RequestRejected('rate-limited', 600);
                $pdo->prepare('DELETE FROM auth_transactions WHERE rowid IN
                    (SELECT rowid FROM auth_transactions WHERE expires_at<=? ORDER BY expires_at LIMIT 128)')->execute([$now]);
                $state = Security::token();
                $nonce = $provider === 'google' ? Security::token() : null;
                $verifier = Security::token();
                $pdo->prepare('INSERT INTO auth_transactions
                    (state_hash,session_hash,provider,purpose,expected_account_id,nonce_hash,pkce_verifier,created_at,expires_at)
                    VALUES (?,?,?,?,?,?,?,?,?)')->execute([hash('sha256', $state), $current->idHash, $provider, $purpose,
                    $expected, $nonce === null ? null : hash('sha256', $nonce), $verifier, $now, $now + 600]);
                return ['state' => $state, 'nonce' => $nonce,
                    'codeChallenge' => rtrim(strtr(base64_encode(hash('sha256', $verifier, true)), '+/', '-_'), '='),
                    'expiresAt' => $now + 600];
            }, false)));
    }

    /**
     * Atomically consume before exchange, including cancellation. Commit survives provider error.
     * Result is private transient verification material, never a response/log/deletion proof.
     * T041 MUST recheck session and expected identity inside its final account/rotation transaction.
     */
    public function consume(SessionContext $session, string $provider, string $state): array
    {
        self::provider($provider);
        if (!Security::isToken($state)) throw new RequestRejected('invalid-request');
        try {
            return $this->accounts->run(fn (): array => $this->database->immediate(fn (PDO $pdo): array => $this->sessions->within($pdo, $session,
                function (SessionContext $current) use ($pdo, $provider, $state): array {
                    $now = $this->now();
                    $query = $pdo->prepare('SELECT * FROM auth_transactions WHERE state_hash=? AND session_hash=? AND provider=?');
                    $query->execute([hash('sha256', $state), $current->idHash, $provider]);
                    $row = $query->fetch();
                    if ($row === false || $row['consumed_at'] !== null || $now < $row['created_at'] || $now >= $row['expires_at']
                        || ($row['purpose'] === 'delete-reauth' && ($current->accountId === null || $row['expected_account_id'] !== $current->accountId))) {
                        throw new RequestRejected('invalid-request');
                    }
                    $pdo->prepare('UPDATE auth_transactions SET consumed_at=? WHERE state_hash=? AND consumed_at IS NULL')
                        ->execute([$now, $row['state_hash']]);
                    return ['purpose' => $row['purpose'], 'expectedAccountId' => $row['expected_account_id'],
                        'nonceHash' => $row['nonce_hash'], 'verifier' => $row['pkce_verifier'],
                        'createdAt' => $row['created_at'], 'expiresAt' => $row['expires_at']];
                }, false)));
        } catch (RequestRejected $error) {
            // Callback contract is400 for missing/expired initiating session as well as state.
            if ($error->status === 401) throw new RequestRejected('invalid-request');
            throw $error;
        }
    }

    private static function provider(string $provider): void
    {
        if (!in_array($provider, ['google', 'github'], true)) throw new InvalidArgumentException('Unsupported identity provider.');
    }

    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402300199) throw new LogicException('Auth clock is outside supported UTC bounds.');
        return $now;
    }
}
