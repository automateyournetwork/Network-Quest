<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\DeletionReceipts;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['Database', 'Security', 'DeletionLedger', 'DeletionReceipts'] as $file) {
    if (is_file(__DIR__ . '/../src/' . $file . '.php')) { require_once __DIR__ . '/../src/' . $file . '.php'; }
}

final class DeletionReceiptsTest extends TestCase
{
    private TestEnvironment $game;
    private TestEnvironment $external;
    private Database $database;
    private DeletionLedger $ledger;
    private DeletionReceipts $receipts;
    private int $now = 1795737600;
    private string $token;
    private const ACCOUNT = '81000000-0000-4000-8000-000000000001';
    private const ORIGIN = 'https://network-quest.invalid';

    protected function setUp(): void
    {
        $this->game = TestEnvironment::create(); $this->external = TestEnvironment::create();
        $this->game->connect(); $this->external->connect(); $this->external->writeFile('synthetic.sqlite.lock', '');
        $roots = [realpath(__DIR__ . '/../..')];
        $this->database = Database::open($this->game->directory() . '/synthetic.sqlite', $roots); $this->database->migrate();
        $this->ledger = DeletionLedger::initialize($this->external->directory() . '/synthetic.sqlite', $roots, [$this->game->directory()],
            new DeletionRetentionPolicy(2592000, 604800, 'synthetic-only'));
        $this->receipts = new DeletionReceipts($this->ledger,
            new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn () => $this->now), fn () => $this->now);
        $this->token = Security::token();
    }
    protected function tearDown(): void { unset($this->receipts, $this->ledger, $this->database); $this->external->close(); $this->game->close(); }
    private function headers(?string $token = null, string $origin = self::ORIGIN): array
    { return [['Origin', $origin], ['X-Deletion-Receipt', $token ?? $this->token]]; }

    public function testStatusIsReceiptOnlyReadOnlyAndHasNarrowProjection(): void
    {
        $this->database->connection()->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([self::ACCOUNT, $this->now]);
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, hash('sha256', $this->token), $this->now));
        self::assertSame(['state' => 'pending', 'expiresAt' => '2026-11-28T00:00:00Z'], $this->receipts->status('127.0.0.1', $this->headers()));
        self::assertSame(1, (int) $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(0, (int) $this->database->connection()->query('SELECT count(*) FROM sessions')->fetchColumn());
        $this->ledger->exclusive(fn () => $this->ledger->complete(self::ACCOUNT, $this->now));
        self::assertSame('completed', $this->receipts->status('127.0.0.1', $this->headers())['state']);
        $bytes = file_get_contents($this->external->directory() . '/synthetic.sqlite');
        self::assertStringNotContainsString($this->token, $bytes);
    }

    public function testUnknownAndExpiryAreIndistinguishableEvenWithoutCleanup(): void
    {
        self::assertNull($this->receipts->status('127.0.0.1', $this->headers()));
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, hash('sha256', $this->token), $this->now));
        $this->now += 86400;
        self::assertNull($this->receipts->status('127.0.0.1', $this->headers()));
        self::assertNull($this->receipts->status('127.0.0.1', $this->headers(Security::token())));
        self::assertCount(1, $this->ledger->exclusive(fn () => $this->ledger->markers()));
    }

    public function testOriginAndCanonicalTokenRejectWithoutDisclosure(): void
    {
        foreach ([[$this->token, 'https://wrong.invalid', 403], [str_repeat('A', 42) . 'B', self::ORIGIN, 400]] as [$token, $origin, $status]) {
            try { $this->receipts->status('127.0.0.1', $this->headers($token, $origin)); self::fail('Expected rejection.'); }
            catch (RequestRejected $error) { self::assertSame($status, $error->status); self::assertStringNotContainsString($token, $error->getMessage()); }
        }
    }

    public function testStatusRateLimitIncludesUnknownReceipts(): void
    {
        for ($count = 0; $count < 30; $count++) { self::assertNull($this->receipts->status('127.0.0.1', $this->headers())); }
        try { $this->receipts->status('127.0.0.1', $this->headers()); self::fail('Expected bounded polling.'); }
        catch (RequestRejected $error) { self::assertSame(429, $error->status); }
        self::assertSame([], $this->ledger->exclusive(fn () => $this->ledger->markers()));
    }
}
