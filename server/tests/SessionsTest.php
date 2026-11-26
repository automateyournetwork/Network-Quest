<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\RequestRejected;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Sessions.php';

final class SessionsTest extends TestCase
{
    private TestEnvironment $environment;
    private Database $database;
    private Sessions $sessions;
    private int $now = 1795737600;
    private const ACCOUNT = '60000000-0000-4000-8000-000000000001';
    private const OTHER = '60000000-0000-4000-8000-000000000002';

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn (): int => $this->now);
    }

    protected function tearDown(): void
    {
        unset($this->sessions, $this->database);
        $this->environment->close();
    }

    private function cookie(array $issued): string
    {
        return explode(';', $issued['setCookie'], 2)[0];
    }

    private function account(string $id = self::ACCOUNT): void
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)')->execute([$id, $this->now]);
        $pdo->prepare('INSERT INTO identities (account_id, provider, subject, display_name) VALUES (?, ?, ?, ?)')
            ->execute([$id, 'google', 'synthetic-' . $id, 'Synthetic player']);
        $pdo->prepare('INSERT INTO preferences (account_id) VALUES (?)')->execute([$id]);
    }

    private function authenticate(?array $guest = null, string $account = self::ACCOUNT): array
    {
        $guest ??= $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo): array =>
            $this->sessions->rotateWithin($pdo, $guest['context'], $account));
    }

    private function rejected(callable $operation, int $status): void
    {
        try {
            $operation();
        } catch (RequestRejected $error) {
            self::assertSame($status, $error->status);
            return;
        }
        self::fail('Expected a rejected session operation.');
    }

    public function testGuestBootstrapStoresHashesAndNoAccountOrSave(): void
    {
        $issued = $this->sessions->bootstrap(null);
        self::assertNull($issued['context']->accountId);
        self::assertSame(1, $issued['context']->generation);
        self::assertMatchesRegularExpression('~^__Secure-nq_session=[A-Za-z0-9_-]{43}; Path=/arcade/play/network-quest/; Secure; HttpOnly; SameSite=Lax$~D', $issued['setCookie']);
        $token = substr($this->cookie($issued), strlen('__Secure-nq_session='));
        self::assertNotSame($token, $issued['csrfToken']);
        $row = $this->database->connection()->query('SELECT * FROM sessions')->fetch();
        self::assertSame(hash('sha256', $token), $row['id_hash']);
        self::assertSame(hash('sha256', $issued['csrfToken']), $row['csrf_hash']);
        self::assertStringNotContainsString($token, json_encode($row));
        self::assertStringNotContainsString($issued['csrfToken'], json_encode($row));
        self::assertSame($this->now + 86400, $row['expires_at']);
        foreach (['accounts', 'identities', 'preferences', 'saves'] as $table) {
            self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM ' . $table)->fetchColumn());
        }
        $this->rejected(fn () => $this->sessions->require($this->cookie($issued)), 401);
    }

    public function testRepeatedGetAndOtherServiceInstanceKeepCsrfAndAbsoluteExpiryStable(): void
    {
        $first = $this->sessions->bootstrap(null);
        $this->now += 7000;
        $second = (new Sessions($this->database, fn (): int => $this->now))->bootstrap($this->cookie($first));
        self::assertSame($first['csrfToken'], $second['csrfToken']);
        self::assertSame($first['context']->idHash, $second['context']->idHash);
        self::assertSame($first['context']->expiresAt, $second['context']->expiresAt);
        self::assertNull($second['setCookie']);
        self::assertSame($this->now, $this->database->connection()->query('SELECT last_activity FROM sessions')->fetchColumn());
        self::assertSame($first['context']->idHash, $this->sessions->require($this->cookie($first), false, $first['csrfToken'])->idHash);
    }

    public function testRandomSessionsHaveIndependentCookiesAndCsrf(): void
    {
        $cookies = $csrf = [];
        for ($i = 0; $i < 20; ++$i) {
            $issued = $this->sessions->bootstrap(null);
            $cookies[] = $this->cookie($issued);
            $csrf[] = $issued['csrfToken'];
        }
        self::assertCount(20, array_unique($cookies));
        self::assertCount(20, array_unique($csrf));
        $this->rejected(fn () => $this->sessions->require($cookies[0], false, $csrf[1]), 403);
    }

    public function testIdleExpiryAtExactBoundaryDoesNotDependOnCleanupAndPreservesRows(): void
    {
        $issued = $this->sessions->bootstrap(null);
        $this->now += 7200;
        $this->rejected(fn () => $this->sessions->require($this->cookie($issued), false), 401);
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM sessions')->fetchColumn());
        $replacement = $this->sessions->bootstrap($this->cookie($issued));
        self::assertNull($replacement['context']->accountId);
        self::assertNotSame($issued['context']->idHash, $replacement['context']->idHash);
    }

    public function testActivityCannotExtendAbsoluteExpiry(): void
    {
        $issued = $this->sessions->bootstrap(null);
        $created = $this->now;
        for ($i = 1; $i <= 12; ++$i) {
            $this->now = $created + $i * 7000;
            $this->sessions->require($this->cookie($issued), false);
        }
        $this->now = $created + 86399;
        self::assertSame($created + 86400, $this->sessions->require($this->cookie($issued), false)->expiresAt);
        $this->now = $created + 86400;
        $this->rejected(fn () => $this->sessions->require($this->cookie($issued), false), 401);
    }

    public function testFailedCsrfDoesNotExtendIdleLife(): void
    {
        $issued = $this->sessions->bootstrap(null);
        $created = $this->now;
        $this->now += 7199;
        $this->rejected(fn () => $this->sessions->require($this->cookie($issued), false, str_repeat('A', 43)), 403);
        self::assertSame($created, $this->database->connection()->query('SELECT last_activity FROM sessions')->fetchColumn());
        ++$this->now;
        $this->rejected(fn () => $this->sessions->require($this->cookie($issued), false, $issued['csrfToken']), 401);
    }

    public function testMalformedAmbiguousAndUnknownCookieNeverSelectsAnIdentity(): void
    {
        $this->account();
        $auth = $this->authenticate();
        $valid = $this->cookie($auth);
        $token = substr($valid, strlen('__Secure-nq_session='));
        $bad = [null, '', '__Secure-nq_session=' . str_repeat('A', 43), $valid . '; ' . $valid,
            $valid . ', ' . $valid, '__Secure-nq_session="' . $token . '"',
            '__Secure-nq_session=' . rawurlencode($token . '='),
            '__Secure-nq_session[]=' . $token, '__Secure.nq.session=' . $token,
            $valid . "\r\nX-Injected: yes", str_repeat('x', 8193), '__Secure-nq_session=' . str_repeat('B', 43)];
        foreach ($bad as $header) {
            $this->rejected(fn () => $this->sessions->require($header), 401);
            self::assertNull($this->sessions->bootstrap($header)['context']->accountId);
        }
        self::assertSame(self::ACCOUNT, $this->sessions->require('other=ok; ' . $valid . '; theme=dark')->accountId);
        self::assertSame(self::ACCOUNT, $this->sessions->require('other="quoted-value"; ' . $valid)->accountId);
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testAuthenticationRotationRevokesOldCredentialAndAttemptsAtomically(): void
    {
        $this->account();
        $guest = $this->sessions->bootstrap(null);
        $this->attempt($guest['context']->idHash);
        $auth = $this->authenticate($guest);
        self::assertSame(self::ACCOUNT, $auth['context']->accountId);
        self::assertSame(2, $auth['context']->generation);
        self::assertSame($this->now, $auth['context']->authTime);
        self::assertNotSame($guest['csrfToken'], $auth['csrfToken']);
        $this->rejected(fn () => $this->sessions->require($this->cookie($guest), false), 401);
        $this->rejected(fn () => $this->sessions->require($this->cookie($auth), true, $guest['csrfToken']), 403);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM sessions')->fetchColumn());
        self::assertSame(self::ACCOUNT, $this->sessions->require($this->cookie($auth), true, $auth['csrfToken'])->accountId);
    }

    public function testRotationRollbackRestoresOldSessionAndPendingAttempt(): void
    {
        $this->account();
        $guest = $this->sessions->bootstrap(null);
        $this->attempt($guest['context']->idHash);
        try {
            $this->database->immediate(function (PDO $pdo) use ($guest): void {
                $this->sessions->rotateWithin($pdo, $guest['context'], self::ACCOUNT);
                throw new RuntimeException('Synthetic commit preparation failure');
            });
            self::fail('Expected failure.');
        } catch (RuntimeException $error) {
            self::assertSame('Synthetic commit preparation failure', $error->getMessage());
        }
        self::assertSame($guest['context']->idHash, $this->sessions->require($this->cookie($guest), false)->idHash);
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM sessions')->fetchColumn());
    }

    public function testRotationRequiresLiveInitiatorAndActiveCompleteServerAccount(): void
    {
        $guest = $this->sessions->bootstrap(null);
        $this->rejected(fn () => $this->authenticate($guest), 401);
        $this->account();
        $this->database->connection()->exec("UPDATE accounts SET status='deleting'");
        $this->rejected(fn () => $this->authenticate($guest), 401);
        $this->database->connection()->exec("UPDATE accounts SET status='active'");
        $this->now += 7200;
        $this->rejected(fn () => $this->authenticate($guest), 401);
    }

    public function testFinalTransactionRechecksRevocationAccountStatusGenerationAndExpiry(): void
    {
        foreach (['revoked', 'deleting', 'generation', 'rebound', 'expired'] as $change) {
            if ($change === 'revoked') {
                $this->account();
                $this->account(self::OTHER);
            }
            $auth = $this->authenticate();
            $context = $this->sessions->require($this->cookie($auth), true, $auth['csrfToken']);
            // Independent connection mutates after request admission, before final write lock.
            $other = Database::open($this->environment->directory() . '/synthetic.sqlite',
                [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
            $other->immediate(function (PDO $pdo) use ($change, $context): void {
                match ($change) {
                    'revoked' => $pdo->prepare('DELETE FROM sessions WHERE id_hash=?')->execute([$context->idHash]),
                    'deleting' => $pdo->exec("UPDATE accounts SET status='deleting'"),
                    'generation' => $pdo->prepare('UPDATE sessions SET generation=generation+1 WHERE id_hash=?')->execute([$context->idHash]),
                    'rebound' => $pdo->prepare('UPDATE sessions SET account_id=? WHERE id_hash=?')->execute([self::OTHER, $context->idHash]),
                    'expired' => $this->now += 7200,
                };
            });
            $called = false;
            $this->rejected(fn () => $this->database->immediate(function (PDO $pdo) use ($context, &$called): void {
                $this->sessions->within($pdo, $context, function () use (&$called): void { $called = true; });
            }), 401);
            self::assertFalse($called, 'Do not inspect a receipt or return provisional content results after revocation.');
            $this->database->connection()->exec("UPDATE accounts SET status='active'");
            unset($other);
        }
    }

    public function testRevokePreservesOtherDeviceAndSaveAndCascadesAttempts(): void
    {
        $this->account();
        $first = $this->authenticate();
        $second = $this->authenticate();
        $this->attempt($first['context']->idHash);
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO saves(account_id,revision,saved_at,schema_version,content_version,adventure_id,payload_json,payload_hash,summary_json) VALUES(?,8,?,1,?,?,?, ?,?)')
            ->execute([self::ACCOUNT, $this->now, '1.0.0', self::OTHER, '{}', hash('sha256', '{}'), '{}']);
        $before = $pdo->query('SELECT * FROM saves')->fetchAll();
        $cookie = $this->database->immediate(fn (PDO $db): string => $this->sessions->revokeWithin($db, $first['context']));
        self::assertSame('__Secure-nq_session=; Path=/arcade/play/network-quest/; Secure; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', $cookie);
        $this->rejected(fn () => $this->sessions->require($this->cookie($first)), 401);
        self::assertSame(self::ACCOUNT, $this->sessions->require($this->cookie($second))->accountId);
        self::assertSame($before, $pdo->query('SELECT * FROM saves')->fetchAll());
        self::assertSame(0, $pdo->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
    }

    public function testDeletedAndDeletingAccountsCannotInspectOrAuthorize(): void
    {
        $this->account();
        $auth = $this->authenticate();
        $this->database->connection()->exec("UPDATE accounts SET status='deleting'");
        $this->rejected(fn () => $this->sessions->require($this->cookie($auth)), 401);
        self::assertNull($this->sessions->bootstrap($this->cookie($auth))['context']->accountId);
        $this->database->connection()->exec('DELETE FROM accounts');
        $this->rejected(fn () => $this->sessions->require($this->cookie($auth)), 401);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testTransactionalEntryPointsRejectWrongConnectionAndOutsideTransaction(): void
    {
        $this->account();
        $guest = $this->sessions->bootstrap(null);
        try {
            $this->sessions->rotateWithin($this->database->connection(), $guest['context'], self::ACCOUNT);
            self::fail('Expected transaction precondition.');
        } catch (LogicException) {
            self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM sessions')->fetchColumn());
        }
        $other = $this->environment->connect();
        $other->beginTransaction();
        try {
            $this->sessions->within($other, $guest['context'], fn () => null, false);
            self::fail('Expected own-connection precondition.');
        } catch (LogicException) {
            self::assertTrue($other->inTransaction());
        } finally {
            $other->rollBack();
        }
    }

    public function testClockRollbackAndUnsafeCookiePathFailClosed(): void
    {
        $guest = $this->sessions->bootstrap(null);
        --$this->now;
        $this->rejected(fn () => $this->sessions->require($this->cookie($guest), false), 401);
        $this->expectException(InvalidArgumentException::class);
        new Sessions($this->database, null, '/; Domain=other.invalid');
    }

    private function attempt(string $sessionHash): void
    {
        $this->database->connection()->prepare('INSERT INTO auth_transactions(state_hash,session_hash,provider,purpose,nonce_hash,pkce_verifier,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)')
            ->execute([hash('sha256', 'synthetic pending ' . $sessionHash), $sessionHash, 'google', 'login', hash('sha256', 'nonce'), str_repeat('v', 43), $this->now, $this->now + 600]);
    }
}
