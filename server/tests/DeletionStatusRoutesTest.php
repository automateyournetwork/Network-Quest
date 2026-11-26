<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountDeletion;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionReceipts;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Routes\DeletionStatus;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['Database', 'Security', 'Sessions', 'AccountAccess', 'DeletionLedger', 'RecoveryAccountAccess', 'AccountDeletion', 'DeletionReceipts', 'Routes/DeletionStatus'] as $file) {
    if (is_file(__DIR__ . '/../src/' . $file . '.php')) require_once __DIR__ . '/../src/' . $file . '.php';
}

/** Receipt-only HTTP port exercised against actual ledger/rate storage, without provider/transport claims. */
final class DeletionStatusRoutesTest extends TestCase
{
    private TestEnvironment $game;
    private TestEnvironment $external;
    private Database $database;
    private DeletionLedger $ledger;
    private Security $security;
    private Sessions $sessions;
    private DeletionStatus $route;
    private string $token;
    private array $auth;
    private int $now = 1795737600;
    private const ACCOUNT = '86000000-0000-4000-8000-000000000001';
    private const LATER = '86000000-0000-4000-8000-000000000002';
    private const ORIGIN = 'https://network-quest.invalid';

    protected function setUp(): void
    {
        $this->game = TestEnvironment::create(); $this->external = TestEnvironment::create();
        $this->game->connect(); $this->external->connect(); $this->external->writeFile('synthetic.sqlite.lock', '');
        $roots = [realpath(__DIR__ . '/../..')];
        $this->database = Database::open($this->game->directory() . '/synthetic.sqlite', $roots); $this->database->migrate();
        $this->ledger = DeletionLedger::initialize($this->external->directory() . '/synthetic.sqlite', $roots, [$this->game->directory()],
            new DeletionRetentionPolicy(2592000, 604800, 'T046-synthetic-only'));
        $this->security = new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn () => $this->now);
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $this->route = new DeletionStatus(new DeletionReceipts($this->ledger, $this->security, fn () => $this->now));
        $this->token = Security::token(); $this->auth = $this->account(self::ACCOUNT);
    }
    protected function tearDown(): void
    { unset($this->route, $this->ledger, $this->security, $this->sessions, $this->database); $this->external->close(); $this->game->close(); }
    private function account(string $account): array
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$account, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$account, 'google', 'private-subject-' . $account]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$account]);
        $raw = '{"notes":"private-progress"}';
        $pdo->prepare('INSERT INTO saves VALUES(?,?,?,?,?,?,?,?,?)')->execute([$account, 1, $this->now, 1, 'synthetic', $account, $raw, hash('sha256', $raw), '{}']);
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $guest['context'], $account));
    }
    private function headers(array $changes = []): array
    {
        $values = ['Origin' => self::ORIGIN, 'X-Deletion-Receipt' => $this->token];
        foreach ($changes as $key => $value) { if ($value === null) unset($values[$key]); else $values[$key] = $value; }
        return array_map(fn ($key) => [$key, $values[$key]], array_keys($values));
    }
    private function request(?array $headers = null, string $method = 'POST', string $path = '/account/deletion-status', string $body = '', string $query = '', string $peer = '127.0.0.1'): array
    {
        $stream = fopen('php://temp', 'w+b'); fwrite($stream, $body); rewind($stream);
        try { return $this->route->handle($method, $path, $query, $headers ?? $this->headers(), $stream, $peer); }
        finally { fclose($stream); }
    }
    private function pending(): void { $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, hash('sha256', $this->token), $this->now)); }
    private function graph(): array
    {
        $result = [];
        foreach (['accounts', 'identities', 'preferences', 'sessions', 'auth_transactions', 'delete_reauth_proofs', 'saves', 'write_receipts'] as $table)
            $result[$table] = $this->database->connection()->query('SELECT * FROM ' . $table . ' ORDER BY rowid')->fetchAll();
        return $result;
    }
    private function privacy(array $response): void
    {
        self::assertSame('no-store', $response['headers']['Cache-Control']); self::assertSame('no-referrer', $response['headers']['Referrer-Policy']);
        self::assertSame('nosniff', $response['headers']['X-Content-Type-Options']); self::assertArrayNotHasKey('Set-Cookie', $response['headers']);
        self::assertArrayNotHasKey('Location', $response['headers']); self::assertArrayNotHasKey('ETag', $response['headers']);
        $public = json_encode($response, JSON_THROW_ON_ERROR);
        foreach ([$this->token, self::ACCOUNT, self::LATER, 'private-subject', 'private-progress', $this->auth['csrfToken']] as $secret) self::assertStringNotContainsString($secret, $public);
        if ($response['status'] !== 200) self::assertSame($response['headers']['X-Request-Id'], json_decode($response['body'], true)['requestId']);
    }

    public function testPendingStatusReadsOnlyReceiptWithoutRecoveringDeletingOrTouchingSession(): void
    {
        $this->pending(); $before = $this->graph(); $markers = $this->ledger->exclusive(fn () => $this->ledger->markers());
        $this->now += 10; $response = $this->request();
        self::assertSame(200, $response['status']); self::assertSame(['state' => 'pending', 'expiresAt' => '2026-11-28T00:00:00Z'], json_decode($response['body'], true));
        self::assertSame('2', $response['headers']['Retry-After']); self::assertSame($before, $this->graph());
        self::assertSame($markers, $this->ledger->exclusive(fn () => $this->ledger->markers())); $this->privacy($response);
    }

    public function testCompletedStatusSurvivesDeletedSessionAndCannotAffectLaterAccount(): void
    {
        $this->database->connection()->prepare('INSERT INTO delete_reauth_proofs VALUES(?,?,?,?)')
            ->execute([$this->auth['context']->idHash, self::ACCOUNT, $this->now, $this->now + 300]);
        $access = new RecoveryAccountAccess($this->database, $this->ledger, fn () => $this->now);
        $deletion = new AccountDeletion($this->database, $this->sessions, $this->security, $access, $this->ledger, fn () => $this->now);
        // Discard the successful operation result to simulate a lost application response.
        $deletion->delete('127.0.0.1', array_merge($this->headers(), [['Cookie', explode(';', $this->auth['setCookie'], 2)[0]],
            ['X-CSRF-Token', $this->auth['csrfToken']], ['X-Confirm-Account-Deletion', 'delete-my-account']]));
        $later = $this->account(self::LATER); $before = $this->graph(); $this->now += 10;
        foreach ([[], ['Cookie' => explode(';', $this->auth['setCookie'], 2)[0]], ['Cookie' => explode(';', $later['setCookie'], 2)[0]],
            ['Cookie' => '__Secure-nq_session=malformed', 'X-CSRF-Token' => 'irrelevant']] as $changes) {
            $response = $this->request($this->headers($changes)); self::assertSame(200, $response['status']);
            self::assertSame(['state' => 'completed', 'expiresAt' => '2026-11-28T00:00:00Z'], json_decode($response['body'], true));
            self::assertArrayNotHasKey('Retry-After', $response['headers']); self::assertSame($before, $this->graph()); $this->privacy($response);
        }
    }

    public function testUnknownAndExpiredResponsesAreIdenticalExceptIndependentRequestIds(): void
    {
        $unknown = $this->request(); $this->pending(); $this->now += 86399;
        self::assertSame(200, $this->request()['status']); $this->now++;
        $expired = $this->request(); self::assertSame(404, $unknown['status']); self::assertSame(404, $expired['status']);
        $one = json_decode($unknown['body'], true); $two = json_decode($expired['body'], true);
        self::assertNotSame($one['requestId'], $two['requestId']); unset($one['requestId'], $two['requestId']); self::assertSame($one, $two);
        $headersOne = $unknown['headers']; $headersTwo = $expired['headers']; unset($headersOne['X-Request-Id'], $headersTwo['X-Request-Id']); self::assertSame($headersOne, $headersTwo);
        self::assertSame('deletion-unconfirmed', $one['code']); self::assertCount(1, $this->ledger->exclusive(fn () => $this->ledger->markers()));
        $this->privacy($unknown); $this->privacy($expired);
    }

    public function testGuestOrExpiredSessionNeverConvertsUnknownReceiptIntoDeletionSuccess(): void
    {
        $guest = $this->sessions->bootstrap(null); $this->now += 86400; $before = $this->graph();
        foreach ([$guest, $this->auth] as $auth) {
            $response = $this->request($this->headers(['Cookie' => explode(';', $auth['setCookie'], 2)[0]]));
            self::assertSame(404, $response['status']); self::assertSame($before, $this->graph()); $this->privacy($response);
        }
    }

    #[DataProvider('admissionFailures')]
    public function testStatusRequiresOnlyExactOriginAndCanonicalNarrowReceipt(array $changes, int $expected): void
    {
        $this->pending(); $before = $this->graph(); $response = $this->request($this->headers($changes));
        self::assertSame($expected, $response['status']); self::assertSame($before, $this->graph()); $this->privacy($response);
    }
    public static function admissionFailures(): array
    { return [[['Origin' => null], 403], [['Origin' => 'null'], 403], [['Origin' => 'https://network-quest.invalid/'], 403],
        [['Origin' => 'https://network-quest.invalid.evil.invalid'], 403], [['Origin' => 'https://NETWORK-QUEST.invalid'], 403],
        [['X-Deletion-Receipt' => null], 400], [['X-Deletion-Receipt' => ''], 400], [['X-Deletion-Receipt' => str_repeat('A', 42) . 'B'], 400],
        [['X-Deletion-Receipt' => str_repeat('A', 43) . '='], 400]]; }

    #[DataProvider('invalidEnvelopes')]
    public function testStatusRejectsSelectorsBodiesAndAlternateMethods(string $method, string $path, string $body, string $query, int $expected): void
    {
        $this->pending(); $before = $this->graph(); $response = $this->request(method: $method, path: $path, body: $body, query: $query);
        self::assertSame($expected, $response['status']); self::assertSame($before, $this->graph()); $this->privacy($response);
    }
    public static function invalidEnvelopes(): array
    { return [['GET', '/account/deletion-status', '', '', 400], ['DELETE', '/account/deletion-status', '', '', 400],
        ['POST', '/account', '', '', 400], ['POST', '/account/deletion-status/', '', '', 400],
        ['POST', '/account/deletion-status', '', 'accountId=other', 400], ['POST', '/account/deletion-status', '', 'receipt=secret', 400],
        ['POST', '/account/deletion-status', '{}', '', 413], ['POST', '/account/deletion-status', '{"accountId":"other"}', '', 413]]; }

    public function testDuplicateReceiptOriginAndFramingAreRejectedWithoutEcho(): void
    {
        $this->pending();
        foreach ([[['x-deletion-receipt', $this->token]], [['origin', self::ORIGIN]], [['Content-Length', '0'], ['Transfer-Encoding', 'chunked']]] as $extra) {
            $response = $this->request(array_merge($this->headers(), $extra)); self::assertSame(400, $response['status']); $this->privacy($response);
        }
    }

    public function testReceiptQuotaAndSharedSourceQuotaBoundPollingWithRetryAfter(): void
    {
        for ($i = 0; $i < 30; $i++) self::assertSame(404, $this->request()['status']);
        $limited = $this->request(); self::assertSame(429, $limited['status']); self::assertSame('60', $limited['headers']['Retry-After']); $this->privacy($limited);
        // A failed receipt dimension consumes no source admission; another 30 requests fit.
        for ($i = 0; $i < 30; $i++) self::assertSame(404, $this->request($this->headers(['X-Deletion-Receipt' => Security::token()]))['status']);
        $sourceLimited = $this->request($this->headers(['X-Deletion-Receipt' => Security::token()]));
        self::assertSame(429, $sourceLimited['status']); $this->privacy($sourceLimited); $this->now += 60;
        self::assertSame(404, $this->request()['status']); self::assertSame([], $this->ledger->exclusive(fn () => $this->ledger->markers()));
    }

    public function testLedgerFailureReturnsPrivate503AndDoesNotCreateSessionOrAClaim(): void
    {
        $this->pending(); $before = $this->graph(); $this->external->connect()->exec('DROP TABLE deletion_receipts');
        $response = $this->request(); self::assertSame(503, $response['status']); self::assertSame($before, $this->graph());
        self::assertSame('unavailable', json_decode($response['body'], true)['code']); $this->privacy($response);
        self::assertStringNotContainsString('deletion_receipts', $response['body']);
    }

    public function testOperationalMetadataCannotIncludeReceiptOrRequestBytes(): void
    {
        $response = $this->request();
        $record = Security::logRecord('getDeletionStatus', $response['status'], 1, $response['headers']['X-Request-Id'], 'ok');
        self::assertSame(['route', 'status', 'durationMs', 'requestId', 'reason'], array_keys($record));
        self::assertStringNotContainsString($this->token, json_encode($record, JSON_THROW_ON_ERROR));
        self::assertStringNotContainsString($this->token, file_get_contents($this->external->directory() . '/synthetic.sqlite'));
    }
}
