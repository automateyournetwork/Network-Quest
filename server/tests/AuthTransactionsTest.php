<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Sessions.php';
require_once __DIR__ . '/../src/Identity/AuthTransactions.php';

final class AuthTransactionsTest extends TestCase
{
    private TestEnvironment $environment;
    private Database $database;
    private Sessions $sessions;
    private AuthTransactions $transactions;
    private int $now = 1795737600;

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $this->transactions = new AuthTransactions($this->database, $this->sessions, fn () => $this->now);
    }

    protected function tearDown(): void
    {
        unset($this->transactions, $this->sessions, $this->database);
        $this->environment->close();
    }

    private function rejected(callable $operation, int $status = 400): void
    {
        try { $operation(); } catch (RequestRejected $error) {
            self::assertSame($status, $error->status);
            return;
        }
        self::fail('Expected rejected auth transaction.');
    }

    public function testStartStoresOnlyHashedStateAndNonceAndServerPrivateVerifier(): void
    {
        $session = $this->sessions->bootstrap(null)['context'];
        $start = $this->transactions->begin($session, 'google');
        $row = $this->database->connection()->query('SELECT * FROM auth_transactions')->fetch();
        self::assertSame(['state', 'nonce', 'codeChallenge', 'expiresAt'], array_keys($start));
        self::assertTrue(Security::isToken($start['state']));
        self::assertTrue(Security::isToken($start['nonce']));
        self::assertTrue(Security::isToken($row['pkce_verifier']));
        self::assertSame(hash('sha256', $start['state']), $row['state_hash']);
        self::assertSame(hash('sha256', $start['nonce']), $row['nonce_hash']);
        self::assertSame($session->idHash, $row['session_hash']);
        self::assertSame($this->now + 600, $start['expiresAt']);
        self::assertSame(rtrim(strtr(base64_encode(hash('sha256', $row['pkce_verifier'], true)), '+/', '-_'), '='), $start['codeChallenge']);
        self::assertNull($row['consumed_at']);
        self::assertNull($row['expected_account_id']);
        self::assertNotSame($start['state'], $start['nonce']);
        self::assertNotSame($start['state'], $row['pkce_verifier']);
    }

    public function testConsumeBindsSessionProviderAndStateAndPreventsSecondInstanceReplay(): void
    {
        $session = $this->sessions->bootstrap(null)['context'];
        $other = $this->sessions->bootstrap(null)['context'];
        $start = $this->transactions->begin($session, 'google');
        $this->rejected(fn () => $this->transactions->consume($other, 'google', $start['state']));
        $this->rejected(fn () => $this->transactions->consume($session, 'github', $start['state']));
        $this->rejected(fn () => $this->transactions->consume($session, 'google', Security::token()));
        $this->rejected(fn () => $this->transactions->consume($session, 'google', 'malformed'));
        $attempt = $this->transactions->consume($session, 'google', $start['state']);
        self::assertSame('login', $attempt['purpose']);
        self::assertSame(hash('sha256', $start['nonce']), $attempt['nonceHash']);
        self::assertSame($this->now, $this->database->connection()->query('SELECT consumed_at FROM auth_transactions')->fetchColumn());
        $otherInstance = new AuthTransactions($this->database, $this->sessions, fn () => $this->now);
        $this->rejected(fn () => $otherInstance->consume($session, 'google', $start['state']));
    }

    public function testExactExpiryAndBackwardsClockAreRejectedWithoutConsumption(): void
    {
        foreach ([-1, 600, 601] as $elapsed) {
            $this->now = 1795737600;
            $session = $this->sessions->bootstrap(null)['context'];
            $start = $this->transactions->begin($session, 'google');
            $this->now += $elapsed;
            $this->rejected(fn () => $this->transactions->consume($session, 'google', $start['state']));
        }
        $this->now = 1795737600;
        $session = $this->sessions->bootstrap(null)['context'];
        $start = $this->transactions->begin($session, 'google');
        $this->now += 599;
        self::assertSame('login', $this->transactions->consume($session, 'google', $start['state'])['purpose']);
    }

    public function testRevocationAndStaleAdmissionCannotCreateOrConsumeAttempts(): void
    {
        $session = $this->sessions->bootstrap(null)['context'];
        $start = $this->transactions->begin($session, 'google');
        $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $session));
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        $this->rejected(fn () => $this->transactions->consume($session, 'google', $start['state']));
        $this->rejected(fn () => $this->transactions->begin($session, 'google'), 401);
    }

    public function testParallelAttemptBoundDoesNotEvictOutstandingStateAndExpiryFreesCapacity(): void
    {
        $session = $this->sessions->bootstrap(null)['context'];
        $states = [];
        for ($i = 0; $i < 5; $i++) $states[] = $this->transactions->begin($session, $i % 2 ? 'github' : 'google');
        $this->rejected(fn () => $this->transactions->begin($session, 'google'), 429);
        self::assertSame(5, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        $this->transactions->consume($session, 'google', $states[0]['state']);
        self::assertSame($this->now + 600, $this->transactions->begin($session, 'google')['expiresAt']);
        $this->now += 600;
        self::assertSame($this->now + 600, $this->transactions->begin($session, 'google')['expiresAt']);
    }

    public function testDeletePurposeRequiresMatchingExistingProviderAndRetainsAccountBinding(): void
    {
        $guest = $this->sessions->bootstrap(null)['context'];
        $this->rejected(fn () => $this->transactions->begin($guest, 'google', 'delete-reauth'), 401);
        $id = '60000000-0000-4000-8000-000000000039';
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts (id,created_at) VALUES (?,?)')->execute([$id, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES (?,?,?)')->execute([$id, 'google', 'synthetic-delete-sub']);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES (?)')->execute([$id]);
        $session = $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $guest, $id))['context'];
        $this->rejected(fn () => $this->transactions->begin($session, 'github', 'delete-reauth'));
        $start = $this->transactions->begin($session, 'google', 'delete-reauth');
        $attempt = $this->transactions->consume($session, 'google', $start['state']);
        self::assertSame('delete-reauth', $attempt['purpose']);
        self::assertSame($id, $attempt['expectedAccountId']);
        self::assertSame($id, $session->accountId);
        // Consuming purpose-bound state is NOT completion proof or permission to delete.
        self::assertSame(1, $pdo->query('SELECT count(*) FROM accounts')->fetchColumn());
    }
}
