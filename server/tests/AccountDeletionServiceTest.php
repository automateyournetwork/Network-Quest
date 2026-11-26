<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountDeletion;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['Database', 'Security', 'Sessions', 'AccountAccess', 'DeletionLedger', 'RecoveryAccountAccess', 'AccountDeletion'] as $file) {
    if (is_file(__DIR__ . '/../src/' . $file . '.php')) { require_once __DIR__ . '/../src/' . $file . '.php'; }
}

final class AccountDeletionServiceTest extends TestCase
{
    private TestEnvironment $game;
    private TestEnvironment $external;
    private Database $database;
    private DeletionLedger $ledger;
    private RecoveryAccountAccess $access;
    private Security $security;
    private Sessions $sessions;
    private array $auth;
    private string $token;
    private int $now = 1795737600;
    private const ACCOUNT = '82000000-0000-4000-8000-000000000001';
    private const OTHER = '82000000-0000-4000-8000-000000000002';
    private const ORIGIN = 'https://network-quest.invalid';

    protected function setUp(): void
    {
        $this->game = TestEnvironment::create(); $this->external = TestEnvironment::create();
        $this->game->connect(); $this->external->connect(); $this->external->writeFile('synthetic.sqlite.lock', '');
        $roots = [realpath(__DIR__ . '/../..')];
        $this->database = Database::open($this->game->directory() . '/synthetic.sqlite', $roots);
        $this->database->migrate([1 => file_get_contents(__DIR__ . '/../migrations/001_game.sql'), 2 => file_get_contents(__DIR__ . '/../migrations/002_delete_reauth.sql')]);
        $this->ledger = DeletionLedger::initialize($this->external->directory() . '/synthetic.sqlite', $roots, [$this->game->directory()],
            new DeletionRetentionPolicy(2592000, 604800, 'synthetic-only'));
        $this->access = new RecoveryAccountAccess($this->database, $this->ledger, fn () => $this->now);
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $this->security = new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn () => $this->now);
        $this->account(self::ACCOUNT); $this->account(self::OTHER);
        $guest = $this->sessions->bootstrap(null);
        $this->auth = $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $guest['context'], self::ACCOUNT));
        $this->token = Security::token();
    }
    protected function tearDown(): void
    { unset($this->access, $this->ledger, $this->sessions, $this->security, $this->database); $this->external->close(); $this->game->close(); }
    private function account(string $account): void
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$account, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$account, 'google', 'synthetic-' . $account]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$account]);
    }
    private function proof(int $age = 0): void
    {
        $this->database->connection()->prepare('INSERT INTO delete_reauth_proofs VALUES(?,?,?,?)')
            ->execute([$this->auth['context']->idHash, self::ACCOUNT, $this->now - $age, $this->now - $age + 300]);
    }
    private function service(?callable $observer = null): AccountDeletion
    { return new AccountDeletion($this->database, $this->sessions, $this->security, $this->access, $this->ledger, fn () => $this->now, $observer); }
    private function fields(array $changes = []): array
    {
        $headers = array_replace(['Origin' => self::ORIGIN, 'Cookie' => explode(';', $this->auth['setCookie'], 2)[0],
            'X-CSRF-Token' => $this->auth['csrfToken'], 'X-Confirm-Account-Deletion' => 'delete-my-account', 'X-Deletion-Receipt' => $this->token], $changes);
        return array_map(fn ($key) => [$key, $headers[$key]], array_keys($headers));
    }
    private function accountIds(): array { return $this->database->connection()->query('SELECT id FROM accounts ORDER BY id')->fetchAll(PDO::FETCH_COLUMN); }
    private function receiptStatus(): ?array { return $this->ledger->exclusive(fn () => $this->ledger->receipt(hash('sha256', $this->token), $this->now)); }

    public function testFreshPurposeProofDeletesOnlyAccountAndCommitsBeforeCompletion(): void
    {
        $this->proof(); $phases = [];
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO saves VALUES(?,?,?,?,?,?,?,?,?)')->execute([self::ACCOUNT, 1, $this->now, 1, 'synthetic',
            '83000000-0000-4000-8000-000000000001', '{"synthetic":"private-progress"}', hash('sha256', 'synthetic'), '{}']);
        $pdo->prepare('INSERT INTO write_receipts(account_id,request_id,fingerprint,committed_revision,committed_at,expires_at) VALUES(?,?,?,?,?,?)')
            ->execute([self::ACCOUNT, '84000000-0000-4000-8000-000000000001', str_repeat('a', 64), 1, $this->now, $this->now + 604800]);
        $secondGuest = $this->sessions->bootstrap(null);
        $secondSession = $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $secondGuest['context'], self::ACCOUNT));
        $pdo->prepare('INSERT INTO auth_transactions(state_hash,session_hash,provider,purpose,expected_account_id,nonce_hash,pkce_verifier,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
            ->execute([str_repeat('b', 64), $secondSession['context']->idHash, 'google', 'delete-reauth', self::ACCOUNT,
                str_repeat('c', 64), str_repeat('x', 43), $this->now, $this->now + 600]);
        self::assertSame(2, (int) $pdo->query('SELECT count(*) FROM sessions')->fetchColumn());
        self::assertSame(1, (int) $pdo->query('SELECT count(*) FROM saves')->fetchColumn());
        self::assertSame(1, (int) $pdo->query('SELECT count(*) FROM write_receipts')->fetchColumn());
        self::assertSame(1, (int) $pdo->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        $result = $this->service(function (string $phase) use (&$phases): void {
            self::assertFalse($this->database->connection()->inTransaction()); $phases[] = $phase;
            if ($phase === 'intent-durable') { self::assertContains(self::ACCOUNT, $this->accountIds()); }
            if ($phase === 'live-committed') { self::assertSame([self::OTHER], $this->accountIds()); }
        })->delete('127.0.0.1', $this->fields());
        self::assertSame(204, $result->status); self::assertSame(['intent-durable', 'live-committed', 'completed'], $phases);
        self::assertSame('completed', $this->receiptStatus()['state']);
        foreach (['sessions', 'auth_transactions', 'delete_reauth_proofs', 'saves', 'write_receipts'] as $table) {
            self::assertSame(0, (int) $this->database->connection()->query('SELECT count(*) FROM ' . $table)->fetchColumn());
        }
        self::assertSame([self::OTHER], $this->accountIds());
        self::assertSame([self::OTHER], $pdo->query('SELECT account_id FROM identities')->fetchAll(PDO::FETCH_COLUMN));
        self::assertSame([self::OTHER], $pdo->query('SELECT account_id FROM preferences')->fetchAll(PDO::FETCH_COLUMN));
        $externalBytes = file_get_contents($this->external->directory() . '/synthetic.sqlite');
        self::assertStringNotContainsString('private-progress', $externalBytes);
        self::assertStringNotContainsString('synthetic-' . self::ACCOUNT, $externalBytes);
        self::assertStringNotContainsString($this->token, $externalBytes);
    }

    public function testOrdinaryLoginAndExpiredProofNeverCreateIntent(): void
    {
        foreach ([false, true] as $expired) {
            if ($expired) { $this->proof(301); }
            try { $this->service()->delete('127.0.0.1', $this->fields()); self::fail('Expected purpose proof denial.'); }
            catch (RequestRejected $error) { self::assertSame(403, $error->status); }
            self::assertNull($this->receiptStatus()); self::assertSame([self::ACCOUNT, self::OTHER], $this->accountIds());
        }
    }

    #[\PHPUnit\Framework\Attributes\DataProvider('freshProofAges')]
    public function testFiveMinuteProofBoundary(int $age, int $status): void
    {
        $this->proof($age);
        try { self::assertSame($status, $this->service()->delete('127.0.0.1', $this->fields())->status); }
        catch (RequestRejected $error) { self::assertSame($status, $error->status); self::assertNull($this->receiptStatus()); }
    }
    public static function freshProofAges(): array { return [[299, 204], [300, 204], [301, 403], [-1, 403]]; }

    public function testAdmissionRejectsOriginCsrfConsentAndReceiptBeforeIntent(): void
    {
        $this->proof();
        foreach ([['Origin' => 'https://wrong.invalid'], ['X-CSRF-Token' => Security::token()],
            ['X-Confirm-Account-Deletion' => 'true'], ['X-Deletion-Receipt' => str_repeat('A', 42) . 'B']] as $changes) {
            try { $this->service()->delete('127.0.0.1', $this->fields($changes)); self::fail('Expected rejected admission.'); }
            catch (RequestRejected $error) { self::assertContains($error->status, [400, 403]); }
            self::assertSame([], $this->ledger->exclusive(fn () => $this->ledger->markers()));
        }
    }

    public function testBothDurableCrashWindowsReconcileBeforeAnyProtectedOperation(): void
    {
        $this->proof();
        try { $this->service(function ($phase): void { if ($phase === 'intent-durable') { throw new RuntimeException('synthetic interruption'); } })
            ->delete('127.0.0.1', $this->fields()); self::fail('Expected interrupted response.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertSame('pending', $this->receiptStatus()['state']); }
        self::assertContains(self::ACCOUNT, $this->accountIds());
        $this->access->run(function (): void { self::assertSame([self::OTHER], $this->accountIds()); });
        self::assertSame('completed', $this->receiptStatus()['state']);
        // Emulate an older game DB restore: the recovery artifact is deliberately unchanged.
        $this->account(self::ACCOUNT);
        $this->access->run(function (): void { self::assertSame([self::OTHER], $this->accountIds()); });
        self::assertSame('completed', $this->receiptStatus()['state']);
    }

    public function testCommitBeforeCompletionInterruptionLeavesPendingUntilRecovery(): void
    {
        $this->proof();
        try { $this->service(function ($phase): void { if ($phase === 'live-committed') { throw new RuntimeException('synthetic interruption'); } })
            ->delete('127.0.0.1', $this->fields()); self::fail('Expected interrupted response.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertSame('pending', $this->receiptStatus()['state']); }
        self::assertSame([self::OTHER], $this->accountIds());
        $this->access->run(fn () => self::assertSame([self::OTHER], $this->accountIds()));
        self::assertSame('completed', $this->receiptStatus()['state']);
    }

    public function testGameCommitFailureLeavesDurableIntentAndNoFalseSuccess(): void
    {
        $this->proof();
        $this->database->connection()->exec("CREATE TRIGGER synthetic_reject BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
        try { $this->service()->delete('127.0.0.1', $this->fields()); self::fail('Expected failed commit.'); }
        catch (PDOException) { self::assertSame('pending', $this->receiptStatus()['state']); }
        self::assertSame([self::ACCOUNT, self::OTHER], $this->accountIds());
        $ran = false;
        try { $this->access->run(function () use (&$ran): void { $ran = true; }); self::fail('Expected recovery denial.'); }
        catch (PDOException) { self::assertFalse($ran); }
        $this->database->connection()->exec('DROP TRIGGER synthetic_reject');
        $this->access->run(fn () => self::assertSame([self::OTHER], $this->accountIds()));
    }

    public function testExternalCompletionFailureDoesNotInventSuccess(): void
    {
        $this->proof();
        $raw = $this->external->connect();
        $raw->exec("CREATE TRIGGER synthetic_completion BEFORE UPDATE ON deletion_markers BEGIN SELECT RAISE(ABORT, 'synthetic failure'); END");
        try { $this->service()->delete('127.0.0.1', $this->fields()); self::fail('Expected failed completion.'); }
        catch (PDOException) { self::assertSame('pending', $this->receiptStatus()['state']); }
        self::assertSame([self::OTHER], $this->accountIds());
        try { $this->access->run(fn () => self::fail('Recovery failed; operation must not run.')); self::fail('Expected failed recovery.'); }
        catch (PDOException) { self::assertSame('pending', $this->receiptStatus()['state']); }
        $raw->exec('DROP TRIGGER synthetic_completion');
        $this->access->run(fn () => self::assertSame([self::OTHER], $this->accountIds()));
        self::assertSame('completed', $this->receiptStatus()['state']);
    }

    public function testWrongAccountReceiptIsConflictBeforeAnyNewIntent(): void
    {
        $this->proof();
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::OTHER, hash('sha256', $this->token), $this->now));
        $result = $this->service()->delete('127.0.0.1', $this->fields());
        self::assertSame(409, $result->status);
        self::assertSame([self::ACCOUNT], $this->accountIds()); // prior OTHER intent reconciles first
        self::assertSame([self::OTHER], array_column($this->ledger->exclusive(fn () => $this->ledger->markers()), 'accountId'));
        self::assertCount(1, $this->database->connection()->query('SELECT * FROM sessions')->fetchAll());
    }

    public function testKilledProcessesAtBothDurableBoundariesReopenAndReconcile(): void
    {
        $this->proof();
        $script = $this->external->writeFile('crash-worker.php', <<<'WORKER'
<?php
declare(strict_types=1);
$input = json_decode(fgets(STDIN), true, 16, JSON_THROW_ON_ERROR);
foreach (['Database', 'Security', 'Sessions', 'AccountAccess', 'DeletionLedger', 'RecoveryAccountAccess', 'AccountDeletion'] as $file) {
    require_once $input['root'] . '/server/src/' . $file . '.php';
}
$db = NetworkQuest\Database::open($input['game'] . '/synthetic.sqlite', [$input['root']]);
$ledger = NetworkQuest\DeletionLedger::open($input['external'] . '/synthetic.sqlite', [$input['root']], [$input['game']],
    new NetworkQuest\DeletionRetentionPolicy(2592000, 604800, 'synthetic-only'));
$clock = fn () => $input['now'];
$access = new NetworkQuest\RecoveryAccountAccess($db, $ledger, $clock);
$service = new NetworkQuest\AccountDeletion($db, new NetworkQuest\Sessions($db, $clock),
    new NetworkQuest\Security($db, 'https://network-quest.invalid', str_repeat('synthetic-rate-key', 3), $clock), $access, $ledger, $clock,
    function ($phase) use ($input): void {
        if ($phase === $input['phase']) { fwrite(STDOUT, "boundary\n"); fflush(STDOUT); fread(STDIN, 1); }
    });
$service->delete('127.0.0.1', $input['fields']);
WORKER);
        foreach (['intent-durable', 'live-committed'] as $index => $phase) {
            if ($index === 1) {
                // New independent synthetic account operation for the second kill window.
                $this->token = Security::token();
                $this->database->connection()->exec("DELETE FROM accounts WHERE id='" . self::OTHER . "'");
                $guest = $this->sessions->bootstrap(null);
                $newAccount = '82000000-0000-4000-8000-000000000003';
                $this->account($newAccount);
                $this->auth = $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $guest['context'], $newAccount));
                $this->database->connection()->prepare('INSERT INTO delete_reauth_proofs VALUES(?,?,?,?)')
                    ->execute([$this->auth['context']->idHash, $newAccount, $this->now, $this->now + 300]);
            }
            $process = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', 'log_errors=0', $script],
                [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes,
                $this->external->directory(), ['LANG' => 'C', 'LC_ALL' => 'C']);
            self::assertIsResource($process);
            try {
                $input = ['root' => realpath(__DIR__ . '/../..'), 'game' => $this->game->directory(),
                    'external' => $this->external->directory(), 'now' => $this->now, 'phase' => $phase, 'fields' => $this->fields()];
                fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR) . "\n"); fflush($pipes[0]);
                stream_set_timeout($pipes[1], 5);
                self::assertSame("boundary\n", fgets($pipes[1]));
                // Parent independently observes the kernel-held barrier while child is paused.
                try { $this->access->run(fn () => self::fail('Child still owns barrier.')); self::fail('Expected held lock.'); }
                catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException) { self::assertTrue(true); }
                self::assertTrue(proc_terminate($process, 9));
            } finally {
                fclose($pipes[0]); fclose($pipes[1]);
                if (proc_get_status($process)['running']) { proc_terminate($process, 9); }
                proc_close($process);
            }
            self::assertSame('pending', $this->receiptStatus()['state']);
            $reopened = DeletionLedger::open($this->external->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')],
                [$this->game->directory()], new DeletionRetentionPolicy(2592000, 604800, 'synthetic-only'));
            $recovery = new RecoveryAccountAccess($this->database, $reopened, fn () => $this->now);
            $recovery->run(fn () => self::assertNotContains($index === 0 ? self::ACCOUNT : $newAccount, $this->accountIds()));
            self::assertSame('completed', $this->receiptStatus()['state']);
            unset($recovery, $reopened);
        }
    }

    public function testBarrierCannotBeAcquiredInsideDatabaseTransaction(): void
    {
        $this->expectException(LogicException::class);
        $this->database->immediate(fn () => $this->access->run(fn () => self::fail('Lock order violated.')));
    }
}
