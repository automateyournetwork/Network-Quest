<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\DeletionReceiptConflict;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Database.php';
if (is_file(__DIR__ . '/../src/DeletionLedger.php')) { require_once __DIR__ . '/../src/DeletionLedger.php'; }

final class DeletionLedgerTest extends TestCase
{
    private TestEnvironment $storage;
    private TestEnvironment $game;
    private string $file;
    private const ACCOUNT = '80000000-0000-4000-8000-000000000001';
    private const OTHER = '80000000-0000-4000-8000-000000000002';
    private const NOW = 1795737600;

    protected function setUp(): void
    {
        $this->storage = TestEnvironment::create();
        $this->game = TestEnvironment::create();
        $this->storage->connect();
        $this->storage->writeFile('synthetic.sqlite.lock', '');
        $this->file = $this->storage->directory() . '/synthetic.sqlite';
    }

    protected function tearDown(): void { $this->storage->close(); $this->game->close(); }

    private function ledger(bool $initialize = true): DeletionLedger
    {
        $method = $initialize ? 'initialize' : 'open';
        return DeletionLedger::$method($this->file, [realpath(__DIR__ . '/../..')], [$this->game->directory()],
            new DeletionRetentionPolicy(30 * 86400, 7 * 86400, 'synthetic-test-policy-not-host-evidence'));
    }

    public function testIntentAndReceiptCommitTogetherAndCompletionSurvivesReopen(): void
    {
        $ledger = $this->ledger();
        $hash = hash('sha256', 'synthetic-receipt-one');
        $ledger->exclusive(function () use ($ledger, $hash): void {
            $ledger->accept(self::ACCOUNT, $hash, self::NOW);
            self::assertSame([['accountId' => self::ACCOUNT, 'intentAt' => self::NOW, 'completedAt' => null]], $ledger->markers());
            self::assertSame(['state' => 'pending', 'expiresAt' => self::NOW + 86400], $ledger->receipt($hash, self::NOW));
            $ledger->complete(self::ACCOUNT, self::NOW + 1);
        });
        unset($ledger);
        $reopened = $this->ledger(false);
        $reopened->exclusive(function () use ($reopened, $hash): void {
            self::assertSame(self::NOW + 1, $reopened->markers()[0]['completedAt']);
            self::assertSame('completed', $reopened->receipt($hash, self::NOW + 1)['state']);
        });
    }

    public function testIntentAndReceiptRollBackTogetherOnReceiptStorageFailure(): void
    {
        $ledger = $this->ledger();
        $raw = $this->storage->connect();
        $raw->exec("CREATE TRIGGER synthetic_reject BEFORE INSERT ON deletion_receipts BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
        try { $ledger->exclusive(fn () => $ledger->accept(self::ACCOUNT, str_repeat('a', 64), self::NOW)); self::fail('Expected storage failure.'); }
        catch (PDOException) { self::assertSame(0, (int) $raw->query('SELECT count(*) FROM deletion_markers')->fetchColumn()); }
        $raw->exec('DROP TRIGGER synthetic_reject');
        $ledger->exclusive(function () use ($ledger): void { $ledger->accept(self::ACCOUNT, str_repeat('a', 64), self::NOW); self::assertCount(1, $ledger->markers()); });
    }

    public function testReceiptExpiryDoesNotRemoveMarkersAndOtherBindingIsRejected(): void
    {
        $ledger = $this->ledger();
        $ledger->exclusive(function () use ($ledger): void {
            $hash = str_repeat('b', 64);
            $ledger->accept(self::ACCOUNT, $hash, self::NOW);
            try { $ledger->accept(self::OTHER, $hash, self::NOW + 1); self::fail('Expected conflicting binding.'); }
            catch (DeletionReceiptConflict) { self::assertCount(1, $ledger->markers()); }
            self::assertNotNull($ledger->receipt($hash, self::NOW + 86399));
            self::assertNull($ledger->receipt($hash, self::NOW + 86400));
            $ledger->expireReceipts(self::NOW + 86400);
            self::assertCount(1, $ledger->markers());
            self::assertNull($ledger->receipt($hash, self::NOW + 86401));
        });
    }

    public function testSpentHashPreventsRebindingAfterExpiryAndBindingCleanup(): void
    {
        $ledger = $this->ledger();
        $hash = str_repeat('c', 64);
        $ledger->exclusive(function () use ($ledger, $hash): void {
            $ledger->accept(self::ACCOUNT, $hash, self::NOW);
            foreach ([self::NOW + 86400, self::NOW + 86401] as $index => $now) {
                if ($index === 1) { self::assertSame(1, $ledger->expireReceipts($now)); }
                try { $ledger->accept(self::OTHER, $hash, $now); self::fail('Spent token cannot be rebound.'); }
                catch (DeletionReceiptConflict) { self::assertNull($ledger->receipt($hash, $now)); }
                self::assertCount(1, $ledger->markers());
            }
        });
        $raw = $this->storage->connect();
        self::assertSame([], $raw->query('SELECT * FROM deletion_receipts')->fetchAll());
        self::assertSame([['receipt_hash' => $hash]], $raw->query('SELECT * FROM spent_receipts')->fetchAll());
    }

    public function testPolicyMismatchAndPublicLockFailBeforeProtectedWork(): void
    {
        $ledger = $this->ledger();
        try {
            DeletionLedger::open($this->file, [realpath(__DIR__ . '/../..')], [$this->game->directory()],
                new DeletionRetentionPolicy(86400, 86400, 'different-unreviewed-policy'));
            self::fail('Expected policy mismatch.');
        } catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertTrue(true); }
        chmod($this->file . '.lock', 0644);
        try { $ledger->exclusive(fn () => self::fail('Unsafe lock cannot protect work.')); self::fail('Expected lock denial.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertTrue(true); }
        finally { chmod($this->file . '.lock', 0600); }
    }

    public function testUnknownCompletionCannotInventSuccessAndClockCannotBackdate(): void
    {
        $ledger = $this->ledger();
        $ledger->exclusive(function () use ($ledger): void {
            try { $ledger->complete(self::ACCOUNT, self::NOW); self::fail('No intent exists.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertSame([], $ledger->markers()); }
            $ledger->accept(self::ACCOUNT, str_repeat('d', 64), self::NOW);
            try { $ledger->complete(self::ACCOUNT, self::NOW - 1); self::fail('Cannot backdate completion.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertNull($ledger->markers()[0]['completedAt']); }
        });
    }

    public function testRealHeldFlockTimesOutWithoutRunningAnotherOperation(): void
    {
        $first = $this->ledger(); $second = $this->ledger(false); $ran = false;
        $first->exclusive(function () use ($second, &$ran): void {
            $started = hrtime(true);
            try { $second->exclusive(function () use (&$ran): void { $ran = true; }); self::fail('Expected actual lock contention.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) {
                $elapsed = hrtime(true) - $started;
                self::assertGreaterThanOrEqual(750_000_000, $elapsed);
                self::assertLessThan(2_000_000_000, $elapsed);
            }
        });
        self::assertFalse($ran);
        self::assertSame('released', $second->exclusive(fn () => 'released'));
    }

    public function testExceptionalExitReleasesLockAndNestedUseFails(): void
    {
        $ledger = $this->ledger();
        try { $ledger->exclusive(fn () => $ledger->exclusive(fn () => null)); self::fail('Expected nesting denial.'); }
        catch (LogicException) { self::assertSame(7, $ledger->exclusive(fn () => 7)); }
        $this->expectException(LogicException::class); $ledger->markers();
    }

    public function testOpenNeverInitializesAnEmptyArtifact(): void
    {
        $before = file_get_contents($this->file);
        try { $this->ledger(false); self::fail('Expected fail closed.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertSame($before, file_get_contents($this->file)); }
    }

    public function testExplicitRetentionAndRollbackSeparationAreRequired(): void
    {
        try { new DeletionRetentionPolicy(0, 0, ''); self::fail('Expected explicit policy.'); }
        catch (InvalidArgumentException) { self::assertSame(0, filesize($this->file)); }
        $this->expectException(RuntimeException::class);
        DeletionLedger::initialize($this->file, [realpath(__DIR__ . '/../..')], [$this->storage->directory()],
            new DeletionRetentionPolicy(86400, 86400, 'synthetic-policy'));
    }

    public function testLockSymlinkAndHardlinkCannotBeAdopted(): void
    {
        $ledger = $this->ledger(); $lock = $this->file . '.lock'; $moved = $this->file . '.held-lock';
        // Restore original owned inode before the strict TestEnvironment cleanup.
        self::assertTrue(rename($lock, $moved));
        try {
            self::assertTrue(symlink($moved, $lock));
            try { $ledger->exclusive(fn () => self::fail('Symlink cannot carry the barrier.')); self::fail('Expected symlink rejection.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertTrue(true); }
            self::assertTrue(unlink($lock)); self::assertTrue(link($moved, $lock));
            try { $ledger->exclusive(fn () => self::fail('Hardlink cannot carry the barrier.')); self::fail('Expected hardlink rejection.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertTrue(true); }
        } finally { if (is_link($lock) || file_exists($lock)) { unlink($lock); } rename($moved, $lock); }
        self::assertSame(1, $ledger->exclusive(fn () => 1));
    }

    public function testMissingArtifactOrLockNeverGetsCreatedByOpen(): void
    {
        $absent = $this->storage->directory() . '/not-provisioned.sqlite';
        try { DeletionLedger::open($absent, [realpath(__DIR__ . '/../..')], [$this->game->directory()],
            new DeletionRetentionPolicy(86400, 86400, 'synthetic')); self::fail('Missing artifact must not initialize.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertFileDoesNotExist($absent); }
        $lock = $this->file . '.lock'; $moved = $this->file . '.held-lock'; self::assertTrue(rename($lock, $moved));
        try {
            try { $this->ledger(); self::fail('Missing lock must not initialize.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertFileDoesNotExist($lock); self::assertSame(0, filesize($this->file)); }
        } finally { rename($moved, $lock); }
    }

    public function testCorruptSchemaCannotOpenAndCompletedMarkersOutliveMinimumRetention(): void
    {
        $ledger = $this->ledger();
        $ledger->exclusive(function () use ($ledger): void {
            $ledger->accept(self::ACCOUNT, str_repeat('e', 64), self::NOW); $ledger->complete(self::ACCOUNT, self::NOW);
            $ledger->expireReceipts(self::NOW + 400 * 86400); self::assertCount(1, $ledger->markers());
        });
        $raw = $this->storage->connect(); $raw->exec("UPDATE schema_migrations SET checksum='" . str_repeat('0', 64) . "'");
        $this->expectException(RuntimeException::class); $this->ledger(false);
    }

    public function testPublicOrChangedFilePermissionsFailClosed(): void
    {
        $ledger = $this->ledger(); chmod($this->file, 0644);
        try { $ledger->exclusive(fn () => self::fail('Must not run.')); self::fail('Expected private file denial.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertTrue(true); }
        finally { chmod($this->file, 0600); }
    }
}
