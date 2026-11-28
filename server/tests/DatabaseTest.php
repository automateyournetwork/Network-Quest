<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Database.php';

final class DatabaseTest extends TestCase
{
    private TestEnvironment $environment;
    private ?Database $database = null;
    private const A = '60000000-0000-4000-8000-000000000001';
    private const B = '60000000-0000-4000-8000-000000000002';
    private const KEY = '70000000-0000-4000-8000-000000000001';
    private const NOW = 1795737600;

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->environment->connect(); // Allocate and track the harness's synthetic file only.
    }

    protected function tearDown(): void
    {
        $this->database = null;
        $this->environment->close();
    }

    private function path(): string
    {
        return $this->environment->directory() . '/synthetic.sqlite';
    }

    private function roots(): array
    {
        // Vite serves the project root locally; PHP has its narrower public root.
        return [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')];
    }

    private function open(): Database
    {
        return Database::open($this->path(), $this->roots());
    }

    private function ready(): PDO
    {
        $this->database = $this->open();
        $this->database->migrate();
        return $this->database->connection();
    }

    private function account(PDO $pdo, string $id = self::A): void
    {
        $pdo->prepare('INSERT INTO accounts (id, created_at) VALUES (?, ?)')->execute([$id, self::NOW]);
    }

    private function save(PDO $pdo, string $account = self::A, int $revision = 8, ?string $payload = null): void
    {
        $payload ??= file_get_contents(__DIR__ . '/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json');
        $pdo->prepare('INSERT INTO saves (account_id, revision, saved_at, schema_version, content_version, adventure_id, payload_json, payload_hash, summary_json) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
            ->execute([$account, $revision, self::NOW, 1, '1.0.0', self::KEY, $payload, hash('sha256', $payload), '{}']);
    }

    private function receipt(PDO $pdo, string $account = self::A, string $key = self::KEY, int $revision = 8): void
    {
        $pdo->prepare('INSERT INTO write_receipts (account_id, request_id, fingerprint, committed_revision, committed_at, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
            ->execute([$account, $key, hash('sha256', 'synthetic exact request'), $revision, self::NOW, self::NOW + 604800]);
    }

    private function rejected(callable $operation, string $class = PDOException::class): Throwable
    {
        try {
            $operation();
        } catch (Throwable $error) {
            self::assertInstanceOf($class, $error);
            return $error;
        }
        self::fail('Invalid storage operation was accepted.');
    }

    public function testPrivateConnectionAndRepeatMigrationPreserveStoredBytes(): void
    {
        $pdo = $this->ready();
        self::assertSame('delete', $pdo->query('PRAGMA journal_mode')->fetchColumn());
        foreach (['foreign_keys' => 1, 'synchronous' => 2, 'busy_timeout' => 250] as $name => $expected) {
            self::assertSame($expected, (int) $pdo->query('PRAGMA ' . $name)->fetchColumn());
        }
        self::assertSame(0700, fileperms($this->environment->directory()) & 0777);
        self::assertSame(0600, fileperms($this->path()) & 0777);
        $tables = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")->fetchAll(PDO::FETCH_COLUMN);
        self::assertSame(['accounts', 'auth_transactions', 'delete_reauth_proofs', 'identities', 'operational_counters', 'preferences', 'saves', 'schema_migrations', 'sessions', 'write_receipts'], $tables);
        $this->account($pdo);
        $this->save($pdo);
        $before = $pdo->query('SELECT * FROM saves')->fetch();
        $migrations = $pdo->query('SELECT * FROM schema_migrations ORDER BY version')->fetchAll();
        $this->database->migrate();
        self::assertSame($before, $pdo->query('SELECT * FROM saves')->fetch());
        self::assertSame($migrations, $pdo->query('SELECT * FROM schema_migrations ORDER BY version')->fetchAll());
        self::assertCount(2, $migrations);
        self::assertSame(hash_file('sha256', __DIR__ . '/../migrations/001_game.sql'), $migrations[0]['checksum']);
        self::assertSame(hash_file('sha256', __DIR__ . '/../migrations/002_delete_reauth.sql'), $migrations[1]['checksum']);
        self::assertSame('ok', $pdo->query('PRAGMA integrity_check')->fetchColumn());
        self::assertSame([], $pdo->query('PRAGMA foreign_key_check')->fetchAll());
    }

    public function testIdentityUniquenessCaseSensitivityAndNoEmailMergeStorage(): void
    {
        $pdo = $this->ready();
        $this->account($pdo);
        $this->account($pdo, self::B);
        $insert = $pdo->prepare('INSERT INTO identities (account_id, provider, subject, display_name) VALUES (?, ?, ?, ?)');
        $insert->execute([self::A, 'google', 'CaseSensitiveSubject', 'Same display']);
        $insert->execute([self::B, 'google', 'casesensitivesubject', 'Same display']);
        $this->rejected(fn () => $insert->execute([self::B, 'github', '12345', 'Second identity']));
        $this->rejected(fn () => $insert->execute([self::B, 'google', 'CaseSensitiveSubject', 'Duplicate']));
        $pdo->prepare('UPDATE identities SET provider=?, subject=? WHERE account_id=?')->execute(['github', '900000000001', self::B]);
        self::assertSame(2, (int) $pdo->query('SELECT count(*) FROM identities')->fetchColumn());
        $columns = $pdo->query('PRAGMA table_info(identities)')->fetchAll(PDO::FETCH_COLUMN, 1);
        self::assertSame(['account_id', 'provider', 'subject', 'display_name'], $columns);
        $this->rejected(fn () => $pdo->exec("UPDATE identities SET subject='not-a-number' WHERE provider='github'"));
        $this->rejected(fn () => $pdo->exec("UPDATE identities SET provider='unreviewed'"));
    }

    public function testOneSlotAndIndependentPreferencesDefaultsAndBounds(): void
    {
        $pdo = $this->ready();
        $this->account($pdo);
        $this->save($pdo);
        $this->rejected(fn () => $this->save($pdo));
        $pdo->prepare('INSERT INTO preferences (account_id) VALUES (?)')->execute([self::A]);
        self::assertSame(0, $pdo->query('SELECT autosave_enabled FROM preferences')->fetchColumn());
        self::assertSame(1, $pdo->query('SELECT revision FROM preferences')->fetchColumn());
        $pdo->exec('UPDATE preferences SET revision=2, autosave_enabled=1, text_scale=2');
        self::assertSame(8, $pdo->query('SELECT revision FROM saves')->fetchColumn());
        foreach (['revision=0', 'autosave_enabled=2', 'music_volume=1.1', 'effects_volume=-0.1', 'voice_volume=2', "reduced_motion='maybe'", 'text_scale=0.99', 'captions=2'] as $assignment) {
            $this->rejected(fn () => $pdo->exec('UPDATE preferences SET ' . $assignment));
        }
        $this->rejected(fn () => $pdo->exec('UPDATE saves SET revision=0'));
        $this->rejected(fn () => $this->save($pdo, self::B));
    }

    public function testExactBytesFutureVersionsAndAccountScopedMetadataOnlyReceipts(): void
    {
        $pdo = $this->ready();
        $this->account($pdo);
        $this->account($pdo, self::B);
        $future = "{\"future\":\"🧭\", \"saveSchemaVersion\":99}\n ";
        $this->save($pdo, self::A, 9, $future);
        $pdo->exec("UPDATE saves SET schema_version=99, content_version='99.0.0'");
        $this->receipt($pdo); // Prior revision8 remains meaningful when the current slot is9.
        $this->receipt($pdo, self::B); // Same key is independent for B.
        $this->rejected(fn () => $this->receipt($pdo));
        self::assertSame($future, $pdo->query('SELECT payload_json FROM saves')->fetchColumn());
        self::assertSame(hash('sha256', $future), $pdo->query('SELECT payload_hash FROM saves')->fetchColumn());
        $ack = json_decode($pdo->query('SELECT acknowledgement_json FROM write_receipts LIMIT 1')->fetchColumn(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(['requestId' => self::KEY, 'committedRevision' => 8, 'committedAt' => '2026-11-27T00:00:00Z'], $ack);
        $this->rejected(fn () => $pdo->exec("UPDATE write_receipts SET acknowledgement_json='{}'"));
        $this->rejected(fn () => $pdo->exec("UPDATE write_receipts SET fingerprint='not-a-hash'"));
        $this->rejected(fn () => $pdo->exec('UPDATE write_receipts SET expires_at=committed_at'));
        $this->rejected(fn () => $pdo->exec("UPDATE saves SET payload_json='['"));
        $statement = $pdo->prepare('UPDATE saves SET payload_json=?');
        $this->rejected(fn () => $statement->execute(['{"x":"' . str_repeat('a', 262144) . '"}']));
    }

    public function testExternalUuidCasePreservesExactPayloadAndAcknowledgement(): void
    {
        // Shared format:uuid accepts uppercase. Storage must not turn a valid
        // validator candidate into an internal error or rewrite snapshot bytes.
        $pdo = $this->ready();
        $this->account($pdo);
        $this->save($pdo);
        $uuid = 'ABCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF';
        $payload = "{\"adventureId\":\"" . $uuid . "\", \"future\":true}\n";
        $pdo->prepare('UPDATE saves SET adventure_id=?, payload_json=?, payload_hash=?')
            ->execute([$uuid, $payload, hash('sha256', $payload)]);
        $this->receipt($pdo, self::A, $uuid);
        self::assertSame($uuid, $pdo->query('SELECT adventure_id FROM saves')->fetchColumn());
        self::assertSame($payload, $pdo->query('SELECT payload_json FROM saves')->fetchColumn());
        $ack = json_decode($pdo->query('SELECT acknowledgement_json FROM write_receipts')->fetchColumn(), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($uuid, $ack['requestId']);
        foreach (['GBCDEFAB-CDEF-4ABC-8DEF-ABCDEFABCDEF', $uuid . "\n", 'urn:uuid:' . $uuid] as $invalid) {
            $this->rejected(fn () => $pdo->prepare('UPDATE saves SET adventure_id=?')->execute([$invalid]));
            $this->rejected(fn () => $this->receipt($pdo, self::A, $invalid));
        }
    }

    public function testSessionsAttemptsAndAccountRemovalHaveRealForeignKeys(): void
    {
        $pdo = $this->ready();
        $this->account($pdo);
        $this->account($pdo, self::B);
        $this->save($pdo);
        $this->receipt($pdo);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([self::A]);
        $session = $pdo->prepare('INSERT INTO sessions(id_hash, account_id, csrf_hash, created_at, last_activity, expires_at, auth_time, generation) VALUES(?,?,?,?,?,?,?,?)');
        $session->execute([str_repeat('a', 64), self::A, str_repeat('b', 64), self::NOW, self::NOW, self::NOW + 86400, self::NOW, 1]);
        $session->execute([str_repeat('c', 64), null, str_repeat('d', 64), self::NOW, self::NOW, self::NOW + 86400, null, 1]);
        $attempt = $pdo->prepare('INSERT INTO auth_transactions(state_hash, session_hash, provider, purpose, expected_account_id, nonce_hash, pkce_verifier, created_at, expires_at) VALUES(?,?,?,?,?,?,?,?,?)');
        $attempt->execute([str_repeat('e', 64), str_repeat('a', 64), 'google', 'delete-reauth', self::A, str_repeat('f', 64), str_repeat('a', 43), self::NOW, self::NOW + 600]);
        $attempt->execute([str_repeat('1', 64), str_repeat('c', 64), 'github', 'login', null, null, str_repeat('b', 43), self::NOW, self::NOW + 600]);
        $this->rejected(fn () => $pdo->exec('UPDATE auth_transactions SET expires_at=created_at+601'));
        $this->rejected(fn () => $pdo->exec("UPDATE auth_transactions SET expected_account_id=NULL WHERE purpose='delete-reauth'"));
        $this->rejected(fn () => $pdo->exec("UPDATE sessions SET account_id=NULL WHERE auth_time IS NOT NULL"));
        $pdo->prepare('DELETE FROM accounts WHERE id=?')->execute([self::A]);
        foreach (['saves', 'write_receipts', 'preferences'] as $table) {
            self::assertSame(0, $pdo->query('SELECT count(*) FROM ' . $table)->fetchColumn());
        }
        self::assertSame(1, $pdo->query('SELECT count(*) FROM sessions')->fetchColumn());
        self::assertSame(1, $pdo->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        $pdo->exec('DELETE FROM sessions');
        self::assertSame(0, $pdo->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        self::assertSame(self::B, $pdo->query('SELECT id FROM accounts')->fetchColumn());
        // Cascade storage support does not execute the external deletion ledger protocol.
    }

    public function testSlotAndReceiptRollbackOnAnyThrowableAndNestedCallDoesNotCommitOuterWork(): void
    {
        $pdo = $this->ready();
        $this->account($pdo);
        $this->rejected(function () use ($pdo): void {
            $this->database->immediate(function (PDO $connection) use ($pdo): void {
                self::assertSame($pdo, $connection);
                $this->save($connection);
                $this->receipt($connection);
                throw new Error('Injected failure before commit.');
            });
        }, Error::class);
        self::assertSame(0, $pdo->query('SELECT count(*) FROM saves')->fetchColumn());
        self::assertSame(0, $pdo->query('SELECT count(*) FROM write_receipts')->fetchColumn());
        $result = $this->database->immediate(function (PDO $connection): string {
            $this->save($connection);
            $this->rejected(fn () => $this->database->immediate(fn () => null), LogicException::class);
            self::assertTrue($connection->inTransaction());
            $this->receipt($connection);
            return 'committed';
        });
        self::assertSame('committed', $result);
        $pdo->exec('BEGIN IMMEDIATE');
        $this->rejected(fn () => $this->database->immediate(fn () => null), LogicException::class);
        self::assertTrue($pdo->inTransaction());
        $pdo->exec('ROLLBACK');
        self::assertSame(1, $pdo->query('SELECT count(*) FROM saves')->fetchColumn());
    }

    public function testTwoIndependentConnectionsObserveIsolationBoundedBusyAndCommitFailureRollback(): void
    {
        $writer = $this->ready();
        $this->account($writer);
        $other = $this->open();
        $reader = $other->connection();
        self::assertNotSame($writer, $reader);
        $this->database->immediate(function (PDO $connection) use ($other, $reader): void {
            $this->save($connection);
            self::assertSame(0, $reader->query('SELECT count(*) FROM saves')->fetchColumn());
            $error = $this->rejected(fn () => $other->immediate(fn () => null));
            self::assertSame(5, $error->errorInfo[1]);
            self::assertTrue($connection->inTransaction());
            self::assertSame(0600, fileperms($this->path() . '-journal') & 0777);
        });
        self::assertSame(1, $reader->query('SELECT count(*) FROM saves')->fetchColumn());
        $reader->exec('BEGIN');
        $reader->query('SELECT * FROM saves')->fetchAll(); // Hold a SHARED lock through writer COMMIT.
        try {
            $error = $this->rejected(fn () => $this->database->immediate(fn (PDO $pdo) => $pdo->exec('UPDATE saves SET revision=9')));
            self::assertSame(5, $error->errorInfo[1]);
            self::assertFalse($writer->inTransaction());
        } finally {
            $reader->exec('ROLLBACK');
        }
        self::assertSame(8, $reader->query('SELECT revision FROM saves')->fetchColumn());
        $other->immediate(fn (PDO $pdo) => $pdo->exec('UPDATE saves SET revision=9'));
        self::assertSame(9, $writer->query('SELECT revision FROM saves')->fetchColumn());
    }

    public function testStartupMigrationReadSurvivesABriefExclusiveLockAndFailsOnASustainedLock(): void
    {
        $this->ready();
        $expected = $this->database->readMigrationChecksums();
        self::assertCount(2, $expected);
        $holder = <<<'PHP'
            $database = new PDO('sqlite:' . $argv[1]);
            $database->exec('BEGIN EXCLUSIVE');
            fwrite(STDOUT, "locked\n");
            stream_set_timeout(STDIN, 3);
            fgets(STDIN);
            if ($argv[2] === 'brief') { usleep(360000); } else { fgets(STDIN); }
            $database->exec('ROLLBACK');
            PHP;
        foreach (['brief', 'sustained'] as $duration) {
            $process = proc_open([PHP_BINARY, '-d', 'auto_prepend_file=', '-d', 'auto_append_file=',
                '-r', $holder, $this->path(), $duration],
                [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['file', '/dev/null', 'w']], $pipes);
            self::assertIsResource($process);
            try {
                stream_set_timeout($pipes[1], 3);
                self::assertSame("locked\n", fgets($pipes[1]));
                fwrite($pipes[0], "start\n");
                if ($duration === 'brief') {
                    self::assertSame($expected, $this->database->readMigrationChecksums());
                } else {
                    $error = $this->rejected(fn () => $this->database->readMigrationChecksums());
                    self::assertSame(5, $error->errorInfo[1]);
                }
            } finally {
                fclose($pipes[0]);
                fclose($pipes[1]);
                proc_close($process);
            }
        }
        self::assertSame($expected, $this->database->readMigrationChecksums());
    }

    public function testMigrationFailureIsAtomicAndChecksumUnknownVersionAndTransactionControlFailClosed(): void
    {
        // Explicit alternate migration history; independent of packaged forward additions.
        $this->database = $this->open();
        $pdo = $this->database->connection();
        $base = file_get_contents(__DIR__ . '/../migrations/001_game.sql');
        $this->database->migrate([1 => $base]);
        $this->account($pdo);
        $this->save($pdo);
        $this->rejected(fn () => $this->database->migrate([1 => $base, 2 => 'CREATE TABLE candidate(value INTEGER); INSERT INTO missing_table VALUES(1);']));
        self::assertSame(0, $pdo->query("SELECT count(*) FROM sqlite_master WHERE name='candidate'")->fetchColumn());
        self::assertSame(1, $pdo->query('SELECT count(*) FROM schema_migrations')->fetchColumn());
        self::assertSame(8, $pdo->query('SELECT revision FROM saves')->fetchColumn());
        $this->rejected(fn () => $this->database->migrate([1 => $base . "\n"]), RuntimeException::class);
        $this->rejected(fn () => $this->database->migrate([1 => $base, 3 => 'CREATE TABLE gap(value INTEGER);']), InvalidArgumentException::class);
        foreach (['COMMIT;', 'END TRANSACTION;', 'BEGIN;', "ATTACH DATABASE ':memory:' AS extra;", 'PRAGMA foreign_keys=OFF;', 'VACUUM;'] as $unsafe) {
            $this->rejected(fn () => $this->database->migrate([1 => $base, 2 => 'CREATE TABLE partial(value INTEGER); ' . $unsafe]), InvalidArgumentException::class);
        }
        self::assertSame(0, $pdo->query("SELECT count(*) FROM sqlite_master WHERE name='partial'")->fetchColumn());
        $this->database->migrate([1 => $base, 2 => file_get_contents(__DIR__ . '/../migrations/002_delete_reauth.sql'),
            3 => 'CREATE TABLE future(value INTEGER);']);
        $this->rejected(fn () => $this->database->migrate(), RuntimeException::class);
        self::assertSame(3, $pdo->query('SELECT count(*) FROM schema_migrations')->fetchColumn());
    }

    public function testFreshMigrationFailureLeavesNoPartialTablesAndForeignDatabaseIsNeverAdopted(): void
    {
        $this->database = $this->open();
        $pdo = $this->database->connection();
        $base = file_get_contents(__DIR__ . '/../migrations/001_game.sql');
        $this->rejected(fn () => $this->database->migrate([1 => $base . "\nINVALID SQL;"]));
        self::assertSame(0, $pdo->query('SELECT count(*) FROM sqlite_master')->fetchColumn());
        $pdo->exec('CREATE TABLE unrelated (value TEXT)');
        $pdo->exec("INSERT INTO unrelated VALUES ('preserve')");
        $this->rejected(fn () => $this->database->migrate(), RuntimeException::class);
        self::assertSame('preserve', $pdo->query('SELECT value FROM unrelated')->fetchColumn());
    }

    public function testFailureInLaterMigrationRollsBackEntireUnappliedBatch(): void
    {
        // Explicit alternate migration history; independent of packaged forward additions.
        $this->database = $this->open();
        $pdo = $this->database->connection();
        $base = file_get_contents(__DIR__ . '/../migrations/001_game.sql');
        $this->database->migrate([1 => $base]);
        $this->rejected(fn () => $this->database->migrate([1 => $base,
            2 => 'CREATE TABLE second(value INTEGER); INSERT INTO second VALUES(1);',
            3 => 'INSERT INTO does_not_exist VALUES(2);']));
        self::assertSame(1, $pdo->query('SELECT count(*) FROM schema_migrations')->fetchColumn());
        self::assertSame(0, $pdo->query("SELECT count(*) FROM sqlite_master WHERE name='second'")->fetchColumn());
        self::assertFalse($pdo->inTransaction());
    }

    public function testRevocationCascadesDoNotTouchAnotherAccountsSlot(): void
    {
        $pdo = $this->ready();
        foreach ([self::A, self::B] as $account) {
            $this->account($pdo, $account);
            $this->save($pdo, $account);
            $this->receipt($pdo, $account);
        }
        $before = $pdo->query('SELECT * FROM saves ORDER BY account_id')->fetchAll();
        $session = $pdo->prepare('INSERT INTO sessions(id_hash, account_id, csrf_hash, created_at, last_activity, expires_at, auth_time, generation) VALUES(?,?,?,?,?,?,?,?)');
        $session->execute([str_repeat('a', 64), self::A, str_repeat('b', 64), self::NOW, self::NOW, self::NOW + 86400, self::NOW, 1]);
        $pdo->exec('DELETE FROM sessions');
        self::assertSame($before, $pdo->query('SELECT * FROM saves ORDER BY account_id')->fetchAll());
        $pdo->prepare('DELETE FROM accounts WHERE id=?')->execute([self::A]);
        self::assertSame([$before[1]], $pdo->query('SELECT * FROM saves')->fetchAll());
        self::assertSame(self::B, $pdo->query('SELECT account_id FROM write_receipts')->fetchColumn());
    }

    public function testSessionAuthAndCounterBoundsAreConstraintsNotExpiryAcceptance(): void
    {
        $pdo = $this->ready();
        $insert = $pdo->prepare('INSERT INTO sessions(id_hash, csrf_hash, created_at, last_activity, expires_at, generation) VALUES(?,?,?,?,?,?)');
        $valid = [str_repeat('a', 64), str_repeat('b', 64), self::NOW, self::NOW, self::NOW + 86400, 1];
        foreach ([[0, 'raw-session-cookie'], [1, 'raw-csrf'], [3, self::NOW - 1], [4, self::NOW + 86401], [5, 0]] as [$field, $value]) {
            $row = $valid;
            $row[$field] = $value;
            $this->rejected(fn () => $insert->execute($row));
        }
        $insert->execute($valid);
        $attempt = $pdo->prepare('INSERT INTO auth_transactions(state_hash, session_hash, provider, purpose, nonce_hash, pkce_verifier, created_at, expires_at) VALUES(?,?,?,?,?,?,?,?)');
        $validAttempt = [str_repeat('c', 64), str_repeat('a', 64), 'google', 'login', str_repeat('d', 64), str_repeat('a', 43), self::NOW, self::NOW + 600];
        foreach ([[1, str_repeat('e', 64)], [4, null], [5, 'short'], [7, self::NOW + 601]] as [$field, $value]) {
            $row = $validAttempt;
            $row[$field] = $value;
            $this->rejected(fn () => $attempt->execute($row));
        }
        $attempt->execute($validAttempt);
        $counter = $pdo->prepare('INSERT INTO operational_counters(bucket_key, period, count, expires_at) VALUES(?,?,?,?)');
        $counter->execute([str_repeat('1', 64), self::NOW, 1, self::NOW + 60]);
        $this->rejected(fn () => $counter->execute([str_repeat('1', 64), self::NOW, 1, self::NOW + 60]));
        $this->rejected(fn () => $pdo->exec('UPDATE operational_counters SET count=-1'));
        $this->rejected(fn () => $pdo->exec("UPDATE operational_counters SET bucket_key='raw-address'"));
        // Time-based expiry, one-use consumption and rate policy require T038/T041 services.
    }

    public function testMigrationWhileAnotherConnectionWritesLeavesExistingSchemaUntouched(): void
    {
        $pdo = $this->ready();
        $other = $this->open();
        $this->database->immediate(function (PDO $pdo) use ($other): void {
            $this->account($pdo);
            $error = $this->rejected(fn () => $other->migrate());
            self::assertSame(5, $error->errorInfo[1]);
            self::assertTrue($pdo->inTransaction());
        });
        $other->migrate();
        self::assertSame(1, $pdo->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(2, $pdo->query('SELECT count(*) FROM schema_migrations')->fetchColumn());
    }

    public function testPrivatePathsPermissionsLinksAndUnexpectedSidecarsFailBeforeOpening(): void
    {
        foreach (['relative.sqlite', 'sqlite::memory:', $this->environment->directory() . '/../escape.sqlite', $this->environment->directory() . '//bad.sqlite'] as $path) {
            $this->rejected(fn () => Database::open($path, $this->roots()), InvalidArgumentException::class);
        }
        $this->rejected(fn () => Database::open($this->path(), []), InvalidArgumentException::class);
        $this->rejected(fn () => Database::open($this->path(), [$this->environment->directory()]), RuntimeException::class);
        $this->rejected(fn () => Database::open($this->path(), ['/missing-document-root']), RuntimeException::class);
        foreach ([$this->environment->directory() => 0755, $this->path() => 0644] as $path => $mode) {
            $original = fileperms($path) & 0777;
            chmod($path, $mode);
            try {
                $this->rejected(fn () => $this->open(), RuntimeException::class);
            } finally {
                chmod($path, $original);
            }
        }
        $link = $this->environment->directory() . '/linked.sqlite';
        symlink($this->path(), $link);
        try {
            $this->rejected(fn () => Database::open($link, $this->roots()), RuntimeException::class);
        } finally {
            unlink($link);
        }
        link($this->path(), $link);
        try {
            $this->rejected(fn () => $this->open(), RuntimeException::class);
        } finally {
            unlink($link);
        }
        foreach (['-journal', '-wal', '-shm'] as $suffix) {
            $sidecar = $this->path() . $suffix;
            symlink($this->path(), $sidecar);
            try {
                $this->rejected(fn () => $this->open(), RuntimeException::class);
            } finally {
                unlink($sidecar);
            }
        }
        $sidecar = $this->path() . '-journal';
        file_put_contents($sidecar, 'unread public journal');
        chmod($sidecar, 0644);
        try {
            $this->rejected(fn () => $this->open(), RuntimeException::class);
            self::assertSame('unread public journal', file_get_contents($sidecar));
        } finally {
            unlink($sidecar);
        }
        self::assertSame('', file_get_contents($this->path()));
    }

    public function testLiveJournalMustBeAPrivateSingleLinkFileOfTheStorageOwner(): void
    {
        $journal = $this->path() . '-journal';
        $other = $this->environment->writeFile('synthetic-journal', 'original bytes');
        self::assertTrue(link($other, $journal));
        try {
            $this->rejected(fn () => $this->open(), RuntimeException::class);
            self::assertSame('original bytes', file_get_contents($other));
        } finally { unlink($journal); }
        self::assertTrue(mkdir($journal, 0700));
        try { $this->rejected(fn () => $this->open(), RuntimeException::class); }
        finally { rmdir($journal); }

        // Exercise ownership without privileges or changing another user's files.
        file_put_contents($journal, 'untouched');
        chmod($journal, 0600);
        try {
            $sidecars = new ReflectionMethod(Database::class, 'sidecars');
            $this->rejected(fn () => $sidecars->invoke(null, $this->path(), fileowner($journal) + 1), RuntimeException::class);
            self::assertSame('untouched', file_get_contents($journal));
        } finally { unlink($journal); }
    }

    public function testSymlinkAncestorsAndReplacementOfOpenStorageAreRejected(): void
    {
        $pdo = $this->ready();
        $this->account($pdo);
        $root = $this->environment->directory();
        $alias = $root . '-alias';
        symlink($root, $alias);
        try {
            $this->rejected(fn () => Database::open($alias . '/synthetic.sqlite', $this->roots()), RuntimeException::class);
            $this->rejected(fn () => Database::open($this->path(), [$alias]), RuntimeException::class);
        } finally {
            unlink($alias);
        }
        $original = $this->path() . '.held';
        rename($this->path(), $original);
        file_put_contents($this->path(), 'replacement');
        chmod($this->path(), 0600);
        try {
            $this->rejected(fn () => $this->database->connection(), RuntimeException::class);
            self::assertSame('replacement', file_get_contents($this->path()));
        } finally {
            unlink($this->path());
            rename($original, $this->path());
        }
        self::assertSame(self::A, $this->database->connection()->query('SELECT id FROM accounts')->fetchColumn());
    }

    public function testMalformedAndDormantWalHeadersCannotBeOpenedOrConverted(): void
    {
        $this->ready();
        $this->database = null;
        $bytes = file_get_contents($this->path());
        foreach (['not sqlite', substr_replace($bytes, "\x02\x02", 18, 2)] as $invalid) {
            file_put_contents($this->path(), $invalid);
            try {
                $this->rejected(fn () => $this->open(), RuntimeException::class);
                self::assertSame($invalid, file_get_contents($this->path()));
            } finally {
                file_put_contents($this->path(), $bytes);
            }
        }
    }

    public function testExclusiveCreationAndLaterPermissionChangeFailClosed(): void
    {
        $path = $this->environment->directory() . '/created.sqlite';
        $created = null;
        try {
            $created = Database::open($path, $this->roots());
            self::assertSame(0600, fileperms($path) & 0777);
            $created->migrate();
            chmod($path, 0644);
            $this->rejected(fn () => $created->immediate(fn () => null), RuntimeException::class);
        } finally {
            $created = null;
            // Exactly the new file from this test; harness never adopts an arbitrary path.
            if (is_file($path)) {
                chmod($path, 0600);
                unlink($path);
            }
        }
    }
}
