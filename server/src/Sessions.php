<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use Closure;
use InvalidArgumentException;
use LogicException;
use PDO;

/** Internal admission snapshot, never a wire response or standalone authorization proof. */
final readonly class SessionContext
{
    public function __construct(
        public string $idHash,
        public ?string $accountId,
        public string $csrfHash,
        public int $generation,
        public int $expiresAt,
        public ?int $authTime,
    ) {
    }
}

/** Opaque game sessions; no native PHP sessions, provider calls, configuration or account creation. */
final class Sessions
{
    public const COOKIE_NAME = '__Secure-nq_session';
    private readonly Closure $clock;

    /** Trusted clock injection only; production uses server time. Path is never request input. */
    public function __construct(
        private readonly Database $database,
        ?callable $clock = null,
        private readonly string $gamePath = '/arcade/play/network-quest/',
    ) {
        if (!preg_match('~^/(?:[a-zA-Z0-9_-]+/)+$~D', $gamePath)) {
            throw new InvalidArgumentException('Expected an explicit game cookie path.');
        }
        $this->clock = Closure::fromCallable($clock ?? time(...));
    }

    /**
     * GET session service port. Route must enforce transport/header bounds and source abuse
     * limits BEFORE insertion. Returns internal context + CSRF + optional Set-Cookie, NOT
     * the full public Session schema: T041 owns provider/preferences/save-summary projection.
     * Malformed/ambiguous/unknown/expired cookies become new guests, never adopted credentials.
     * Guest state never proves account deletion. No identity or save is created/read here.
     */
    public function bootstrap(?string $cookieHeader): array
    {
        $token = self::cookieToken($cookieHeader);
        return $this->database->immediate(function (PDO $pdo) use ($token): array {
            $now = $this->now();
            if ($token !== null) {
                $row = $this->lookup($pdo, hash('sha256', $token), $now);
                if ($row !== null && hash_equals($row['csrf_hash'], hash('sha256', self::csrf($token)))) {
                    $this->touch($pdo, $row['id_hash'], $now);
                    return ['context' => self::context($row), 'csrfToken' => self::csrf($token), 'setCookie' => null];
                }
            }
            return $this->issue($pdo, null, 1, $now);
        });
    }

    /**
     * Admission on EVERY request. Null CSRF means a read; mutations MUST pass a value (even
     * empty for missing), normally through Security::mutation. Failed checks do not touch idle.
     * Account identity comes only from storage, never the caller's body/account selector.
     */
    public function require(?string $cookieHeader, bool $accountRequired = true, ?string $csrfToken = null): SessionContext
    {
        $token = self::cookieToken($cookieHeader);
        if ($token === null) {
            throw new RequestRejected('unauthorized');
        }
        return $this->database->immediate(function (PDO $pdo) use ($token, $accountRequired, $csrfToken): SessionContext {
            $now = $this->now();
            $row = $this->lookup($pdo, hash('sha256', $token), $now);
            if ($row === null || ($accountRequired && $row['account_id'] === null)) {
                throw new RequestRejected('unauthorized');
            }
            if ($csrfToken !== null && (!Security::isToken($csrfToken)
                || !hash_equals($row['csrf_hash'], hash('sha256', $csrfToken)))) {
                throw new RequestRejected('forbidden');
            }
            $this->touch($pdo, $row['id_hash'], $now);
            return self::context($row);
        });
    }

    /**
     * Final authorization inside THIS database's caller-owned immediate callback. Call before
     * any receipt lookup, provisional error, preference check or write. Prior context is only
     * a bound identity snapshot; re-read account status, generation, CSRF and both expiries.
     * Callback is trusted synchronous code: no provider IO or transaction control. T045 must
     * additionally honor/reconcile the external deletion ledger before account access.
     */
    public function within(PDO $pdo, SessionContext $prior, callable $operation, bool $accountRequired = true): mixed
    {
        $this->assertTransaction($pdo);
        $now = $this->now();
        $row = $this->lookup($pdo, $prior->idHash, $now);
        if ($row === null || $row['account_id'] !== $prior->accountId || $row['generation'] !== $prior->generation
            || !hash_equals($row['csrf_hash'], $prior->csrfHash) || $row['expires_at'] !== $prior->expiresAt
            || $row['auth_time'] !== $prior->authTime || ($accountRequired && $row['account_id'] === null)) {
            throw new RequestRejected('unauthorized');
        }
        $this->touch($pdo, $row['id_hash'], $now);
        return $operation(self::context($row));
    }

    /**
     * Only a reviewed provider callback may supply verifiedAccountId. It must resolve/create
     * identity and preferences server-side and validate one-use state/purpose first. This is
     * an internal service port, not a request/test-auth bypass. Does not itself verify OAuth.
     * Old session and its pending auth attempts disappear atomically with new credentials.
     */
    public function rotateWithin(PDO $pdo, SessionContext $prior, string $verifiedAccountId): array
    {
        return $this->within($pdo, $prior, function (SessionContext $current) use ($pdo, $verifiedAccountId): array {
            $account = $pdo->prepare("SELECT a.id FROM accounts a JOIN identities i ON i.account_id=a.id
                JOIN preferences p ON p.account_id=a.id WHERE a.id=? AND a.status='active'");
            $account->execute([$verifiedAccountId]);
            if ($account->fetchColumn() === false) {
                throw new RequestRejected('unauthorized');
            }
            if ($current->generation >= 9007199254740991) {
                throw new RequestRejected('unavailable');
            }
            $issued = $this->issue($pdo, $verifiedAccountId, $current->generation + 1, $this->now());
            $pdo->prepare('DELETE FROM sessions WHERE id_hash=?')->execute([$current->idHash]);
            return $issued;
        }, false);
    }

    /** Confirmed logout only. No implicit save, account removal or other-device revocation. */
    public function revokeWithin(PDO $pdo, SessionContext $prior): string
    {
        return $this->within($pdo, $prior, function (SessionContext $current) use ($pdo): string {
            $pdo->prepare('DELETE FROM sessions WHERE id_hash=?')->execute([$current->idHash]);
            return $this->cookie('') . '; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT';
        }, false);
    }

    private function issue(PDO $pdo, ?string $accountId, int $generation, int $now): array
    {
        // Only cryptographic randomness issues cookies. Supplied unknown IDs are never reused.
        $token = Security::token();
        $csrf = self::csrf($token);
        $row = ['id_hash' => hash('sha256', $token), 'account_id' => $accountId, 'csrf_hash' => hash('sha256', $csrf),
            'created_at' => $now, 'last_activity' => $now, 'expires_at' => $now + 86400,
            'auth_time' => $accountId === null ? null : $now, 'generation' => $generation];
        $pdo->prepare('INSERT INTO sessions (id_hash,account_id,csrf_hash,created_at,last_activity,expires_at,auth_time,generation)
            VALUES (:id_hash,:account_id,:csrf_hash,:created_at,:last_activity,:expires_at,:auth_time,:generation)')->execute($row);
        return ['context' => self::context($row), 'csrfToken' => $csrf, 'setCookie' => $this->cookie($token)];
    }

    private function lookup(PDO $pdo, string $hash, int $now): ?array
    {
        $query = $pdo->prepare('SELECT s.*, a.status AS account_status FROM sessions s
            LEFT JOIN accounts a ON a.id=s.account_id WHERE s.id_hash=?');
        $query->execute([$hash]);
        $row = $query->fetch();
        if ($row === false || $now < $row['created_at'] || $now < $row['last_activity']
            || $now >= $row['expires_at'] || $now - $row['last_activity'] >= 7200
            || ($row['account_id'] !== null && $row['account_status'] !== 'active')) {
            return null;
        }
        return $row;
    }

    private function touch(PDO $pdo, string $hash, int $now): void
    {
        $pdo->prepare('UPDATE sessions SET last_activity=? WHERE id_hash=?')->execute([$now, $hash]);
    }

    private static function context(array $row): SessionContext
    {
        return new SessionContext($row['id_hash'], $row['account_id'], $row['csrf_hash'],
            $row['generation'], $row['expires_at'], $row['auth_time']);
    }

    private function cookie(string $token): string
    {
        // No Domain: host-only. Deliberately no persistent lifetime beyond browser session.
        // Path organizes routing; it does not isolate other same-origin website scripts.
        return self::COOKIE_NAME . '=' . $token . '; Path=' . $this->gamePath . '; Secure; HttpOnly; SameSite=Lax';
    }

    private static function csrf(string $token): string
    {
        // The cookie holds 256 random bits. Domain-separated HMAC recovers stable CSRF for
        // multiple tabs without raw CSRF at rest. Knowing this output cannot derive cookie.
        $secret = base64_decode(strtr($token, '-_', '+/') . '=', true);
        return rtrim(strtr(base64_encode(hash_hmac('sha256', 'NetworkQuest/session-csrf/v1', $secret, true)), '+/', '-_'), '=');
    }

    private static function cookieToken(?string $header): ?string
    {
        // Parse the raw Cookie field, not PHP's normalized $_COOKIE (dot/space/array aliases).
        // Never choose the first/last duplicate, even if their values are identical.
        if ($header === null || $header === '' || strlen($header) > 8192 || preg_match('/[\x00-\x1f\x7f,]/', $header)) {
            return null;
        }
        $found = null;
        foreach (explode(';', $header) as $part) {
            $octets = '[\x21\x23-\x2b\x2d-\x3a\x3c-\x5b\x5d-\x7e]*';
            if (!preg_match('/^([!#$%&\x27*+.^_`|~0-9A-Za-z-]+)=(' . $octets . '|"' . $octets . '")$/D', trim($part, ' '), $match)) {
                return null;
            }
            if ($match[1] === self::COOKIE_NAME) {
                if ($found !== null || !Security::isToken($match[2])) {
                    return null;
                }
                $found = $match[2];
            }
        }
        return $found;
    }

    private function assertTransaction(PDO $pdo): void
    {
        if ($pdo !== $this->database->connection() || !$pdo->inTransaction()) {
            throw new LogicException('Use the owning Database immediate transaction.');
        }
    }

    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402214399) {
            throw new LogicException('Session clock is outside supported UTC bounds.');
        }
        return $now;
    }
}
