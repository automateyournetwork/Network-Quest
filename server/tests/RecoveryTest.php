<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountDeletion;
use NetworkQuest\Application;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionReceipts;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Router;
use NetworkQuest\Routes\DeletionStatus;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/Application.php';
require_once __DIR__ . '/Support/TestEnvironment.php';

/** Operational recovery only on newly owned synthetic files. No ambient account or service configuration. */
final class RecoveryTest extends TestCase
{
    private const A = '16600000-0000-4000-8000-000000000001';
    private const B = '16600000-0000-4000-8000-000000000002';
    private const ORIGIN = 'https://network-quest.invalid';
    private const PRIOR = 'ae8472469b5f7d98e939ccb5471b03893630993a';
    private string $root;
    private int $mask;
    private array $ops;
    private array $web;
    private DeletionLedger $ledger;
    private Database $game;
    private array $children = [];

    protected function setUp(): void
    {
        $this->mask = umask(0077);
        $this->root = realpath(sys_get_temp_dir()) . '/nq-drill-' . bin2hex(random_bytes(16));
        self::assertTrue(mkdir($this->root, 0700));
        foreach (['web', 'game', 'ledger', 'archive', 'ledger-archive', 'isolated', 'config', 'keys'] as $name) {
            mkdir($this->root . '/' . $name, 0700);
        }
        $this->ops = [
            'databasePath' => $this->root . '/game/synthetic.sqlite', 'ledgerFile' => $this->root . '/ledger/synthetic.sqlite',
            'rollbackRoots' => [$this->root . '/game', $this->root . '/archive'],
            // Shared with the independent T054 process harness. Exclusively synthetic retention.
            'backupSeconds' => 2592000, 'restorationSeconds' => 604800, 'retentionEvidence' => 'T054-disposable-only',
            'archiveDir' => $this->root . '/archive', 'ledgerArchiveDir' => $this->root . '/ledger-archive',
            'keyFile' => $this->root . '/keys/game', 'ledgerKeyFile' => $this->root . '/keys/ledger',
            'restoreDir' => $this->root . '/isolated',
        ];
        $this->web = array_intersect_key($this->ops, array_flip(['databasePath', 'ledgerFile', 'rollbackRoots',
            'backupSeconds', 'restorationSeconds', 'retentionEvidence']));
        $this->web += ['origin' => self::ORIGIN, 'gamePath' => Router::GAME_BASE, 'rateKey' => Security::token()];
        foreach (['google','github'] as $provider) {
            $this->web[$provider . 'ClientId'] = 'synthetic';
            $this->web[$provider . 'ClientSecret'] = bin2hex(random_bytes(32));
            $this->web[$provider . 'Callback'] = self::ORIGIN . Router::API_BASE . "/auth/$provider/callback";
        }
        file_put_contents($this->root . '/config/jobs.json', json_encode($this->ops, JSON_THROW_ON_ERROR));
        file_put_contents($this->ops['keyFile'], random_bytes(32));
        file_put_contents($this->ops['ledgerKeyFile'], random_bytes(32));
        touch($this->ops['ledgerFile']);
        touch($this->ops['ledgerFile'] . '.lock');
        $this->ledger = DeletionLedger::initialize($this->ops['ledgerFile'], $this->docs(), $this->ops['rollbackRoots'],
            new DeletionRetentionPolicy($this->ops['backupSeconds'], $this->ops['restorationSeconds'], $this->ops['retentionEvidence']));
        $this->game = Database::open($this->ops['databasePath'], $this->docs());
        $this->game->migrate();
    }

    protected function tearDown(): void
    {
        // A failed assertion must also release workers blocked on a test pipe or HTTP accept.
        foreach ($this->children as $child) {
            if (is_resource($child)) { proc_terminate($child); proc_close($child); }
        }
        unset($this->game, $this->ledger);
        $entries = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($this->root,
            FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
        foreach ($entries as $entry) {
            if ($entry->isDir() && !$entry->isLink()) rmdir($entry->getPathname());
            else unlink($entry->getPathname());
        }
        rmdir($this->root);
        umask($this->mask);
    }

    private function docs(): array { return [$this->root . '/web']; }

    private function environment(?string $database = null): array
    {
        $config = $this->web;
        if ($database !== null) {
            $config['databasePath'] = $database;
            $config['rollbackRoots'][] = dirname($database);
        }
        $path = $this->root . '/config/' . ($database === null ? 'live' : 'isolated') . '.json';
        file_put_contents($path, json_encode($config, JSON_THROW_ON_ERROR));
        return ['NQ_CONFIG_FILE' => $path, 'NQ_DOCUMENT_ROOTS_JSON' => json_encode($this->docs(), JSON_THROW_ON_ERROR)];
    }

    /** Keep stdout/stderr separate. Failed operational commands may return only three fixed redacted fields. */
    private function cli(string $action, array $args = [], bool $ok = true): array
    {
        $script = in_array($action, ['disaster','rollback','ledger-inspect'], true) ? 'restore' : 'backup';
        [$exit, $out, $err] = $this->command([PHP_BINARY, __DIR__ . '/../bin/' . $script . '.php',
            $this->root . '/config/jobs.json', $action, ...$args],
            ['NQ_DOCUMENT_ROOTS_JSON' => json_encode($this->docs(), JSON_THROW_ON_ERROR)]);
        self::assertSame($ok ? 0 : 1, $exit, $action);
        self::assertSame('', $ok ? $err : $out);
        $result = json_decode($ok ? $out : $err, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($action, $result['operation']);
        self::assertSame($ok, $result['ok']);
        if (!$ok) self::assertSame(['ok'=>false,'operation'=>$action,'reason'=>'operational-check-failed'], $result);
        return $result;
    }

    private function command(array $args, array $env = [], string $input = ''): array
    {
        $process = proc_open($args, [0=>['pipe','r'], 1=>['pipe','w'], 2=>['pipe','w']], $pipes, dirname(__DIR__, 2),
            $env + ['PATH' => '/usr/bin:/bin', 'LANG' => 'C']);
        self::assertIsResource($process);
        fwrite($pipes[0], $input);
        fclose($pipes[0]);
        $out = stream_get_contents($pipes[1]);
        $err = stream_get_contents($pipes[2]);
        fclose($pipes[1]);
        fclose($pipes[2]);
        return [proc_close($process), $out, $err];
    }

    private function createAccount(string $account, ?Database $database = null): void
    {
        ($database ?? $this->game)->immediate(function (PDO $pdo) use ($account): void {
            $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$account,time()-172800]);
            $pdo->prepare("INSERT INTO identities(account_id,provider,subject) VALUES(?,'github',?)")
                ->execute([$account, $account === self::A ? '166001' : '166002']);
            $pdo->prepare('INSERT INTO preferences(account_id,text_scale) VALUES(?,1.5)')->execute([$account]);
        });
    }

    private function login(string $account, ?Database $db = null, ?int $now = null): array
    {
        $db ??= $this->game;
        $sessions = new Sessions($db, $now === null ? null : fn () => $now);
        $guest = $sessions->bootstrap(null);
        $session = $db->immediate(fn (PDO $pdo) => $sessions->rotateWithin($pdo, $guest['context'], $account));
        return ['Origin'=>self::ORIGIN, 'Cookie'=>explode(';', $session['setCookie'], 2)[0], 'X-CSRF-Token'=>$session['csrfToken']];
    }

    private function api(string $method, string $route, array $headers = [], string $raw = '', ?string $database = null): array
    {
        $body = fopen('php://memory', 'w+b');
        try {
            fwrite($body, $raw);
            rewind($body);
            $headers += ['Host'=>'network-quest.invalid', 'Content-Length'=>(string) strlen($raw)];
            $response = Application::fromEnvironment($this->environment($database))->handleSapi([
                'HTTPS'=>'on', 'REMOTE_ADDR'=>'127.0.0.1', 'SERVER_PROTOCOL'=>'HTTP/1.1', 'HTTP_HOST'=>'network-quest.invalid',
                'REQUEST_METHOD'=>$method,'REQUEST_URI'=>Router::API_BASE . $route
            ], $headers, $body, 'litespeed');
            self::assertSame('no-store', $response['headers']['Cache-Control']);
            return $response;
        } finally { fclose($body); }
    }

    private function writeFields(array $auth, int $key, int $revision): array
    {
        $fields = $auth + ['Idempotency-Key'=>sprintf('16600000-1111-4000-8000-%012d', $key),
            'X-Save-Mode'=>'manual','Content-Type'=>'application/json'];
        if ($revision === 0) $fields['If-None-Match'] = '*';
        else $fields['If-Match'] = '"save-' . $revision . '"';
        return $fields;
    }

    private function body(string $note): string
    {
        $fixture = json_decode(file_get_contents(dirname(__DIR__, 2) .
            '/specs/001-physical-layer-underworld/contracts/examples/save-v1.json'), false, flags: JSON_THROW_ON_ERROR);
        $fixture->notebook->personalNotes = $note;
        return json_encode($fixture, JSON_THROW_ON_ERROR);
    }

    private function ack(array $response, int $status, int $revision, bool $replayed = false): void
    {
        self::assertSame($status, $response['status']);
        $ack = json_decode($response['body'], true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($revision, $ack['committedRevision']);
        self::assertSame($replayed, $ack['replayed']);
    }

    private function rows(Database $database, string $table, string $owner = self::B): array
    {
        $key = $table === 'accounts' ? 'id' : 'account_id';
        $stmt = $database->connection()->prepare("SELECT * FROM $table WHERE $key=? ORDER BY 1,2");
        $stmt->execute([$owner]);
        return $stmt->fetchAll();
    }

    private function durable(Database $database, string $owner = self::B): array
    {
        $result = [];
        foreach (['accounts','identities','preferences','saves','write_receipts'] as $table) {
            $result[$table] = $this->rows($database, $table, $owner);
        }
        return $result;
    }

    private function confirmation(string $token, int $status, string $state, ?string $db = null): void
    {
        $response = $this->api('POST', '/account/deletion-status',
            ['Origin'=>self::ORIGIN,'X-Deletion-Receipt'=>$token], database: $db);
        self::assertSame($status, $response['status']);
        $data = json_decode($response['body'], true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($state, $data[$status === 200 ? 'state' : 'code']);
        self::assertSame($status === 200 ? ['state','expiresAt'] : ['code','message','requestId'], array_keys($data));
    }

    private function deletionFields(array $auth, string $token, int $now): array
    {
        $statement = $this->game->connection()->prepare('INSERT INTO delete_reauth_proofs
            SELECT id_hash,account_id,?,? FROM sessions WHERE account_id=?');
        $statement->execute([$now, $now+300, self::A]);
        self::assertSame(1, $statement->rowCount());
        return $auth + ['X-Confirm-Account-Deletion'=>'delete-my-account','X-Deletion-Receipt'=>$token];
    }

    public static function deletionPhases(): array
    {
        return ['completed'=>[null], 'failed game COMMIT after intent'=>['intent-durable'],
            'interrupted after game COMMIT'=>['live-committed']];
    }

    #[DataProvider('deletionPhases')]
    public function testOlderBackupReplaysBothMarkerStatesBeforeRestoredAccountAccess(?string $interrupt): void
    {
        $this->createAccount(self::A);
        $this->createAccount(self::B);
        $a = $this->login(self::A);
        $b = $this->login(self::B);
        $this->ack($this->api('PUT','/save',$this->writeFields($a, 1, 0), $this->body('later deleted')), 201, 1);
        $survivor = $this->body('separate acknowledged apprentice');
        $this->ack($this->api('PUT','/save',$this->writeFields($b, 2, 0), $survivor), 201, 1);
        $expected = $this->durable($this->game);
        $token = Security::token();
        $fields = $this->deletionFields($a, $token, time());
        $this->game->connection()->prepare("INSERT INTO auth_transactions
            (state_hash,session_hash,provider,purpose,expected_account_id,pkce_verifier,created_at,expires_at)
            SELECT ?,id_hash,'github','delete-reauth',account_id,?,?,? FROM sessions WHERE account_id=?")
            ->execute([hash('sha256', random_bytes(32)), str_repeat('a',43), time(), time()+590, self::A]);
        $backup = $this->cli('game')['archive'];
        $staleLedger = $this->cli('ledger')['archive'];
        if ($interrupt === null) {
            self::assertSame(204, $this->api('DELETE','/account',$fields)['status']);
        } else {
            $db = $this->game;
            $reader = Database::open($this->ops['databasePath'], $this->docs())->connection();
            $access = new RecoveryAccountAccess($db, $this->ledger);
            $service = new AccountDeletion($db, new Sessions($db), new Security($db,self::ORIGIN,random_bytes(32)),
                $access, $this->ledger, phaseObserver: function (string $phase) use ($reader, $interrupt): void {
                    if ($phase !== $interrupt) return;
                    if ($phase === 'live-committed') throw new RuntimeException('drill interruption');
                    // A reader permits BEGIN IMMEDIATE and DELETE but holds the SHARED lock across COMMIT.
                    $reader->beginTransaction();
                    $reader->query('SELECT count(*) FROM accounts')->fetchColumn();
                });
            try {
                $service->delete('127.0.0.1', array_map(null, array_keys($fields), array_values($fields)));
                self::fail('The interrupted deletion must not acknowledge.');
            } catch (PDOException $e) {
                self::assertSame('intent-durable', $interrupt);
                self::assertSame(5, $e->errorInfo[1]); // SQLITE_BUSY at COMMIT
            } catch (RuntimeException $e) {
                self::assertSame('live-committed', $interrupt);
                self::assertSame('drill interruption', $e->getMessage());
            } finally {
                if ($reader->inTransaction()) $reader->rollBack();
            }
        }
        $state = $interrupt === null ? 'completed' : 'pending';
        $this->confirmation($token, 200, $state);
        self::assertCount($interrupt === 'intent-durable' ? 1 : 0, $this->rows($this->game,'accounts',self::A));
        $markers = $this->ledger->exclusive(fn () => $this->ledger->markers());

        $inspected = $this->root . '/isolated/stale-ledger.sqlite';
        $this->cli('ledger-inspect', [$staleLedger, $inspected]);
        self::assertSame(0, Database::open($inspected, $this->docs())->connection()->query('SELECT count(*) FROM deletion_markers')->fetchColumn());
        $target = $this->root . '/isolated/restored.sqlite';
        $this->cli('disaster', [$backup, $target]);
        $copy = Database::open($target, $this->docs());
        self::assertSame($markers, $this->ledger->exclusive(fn () => $this->ledger->markers()));
        self::assertSame($expected, $this->durable($copy));
        foreach ($this->durable($copy, self::A) as $rows) self::assertSame([], $rows);
        foreach (['sessions','auth_transactions','delete_reauth_proofs'] as $table) {
            self::assertSame(0, $copy->connection()->query("SELECT count(*) FROM $table")->fetchColumn());
        }
        $this->confirmation($token, 200, $state, $target);
        $this->confirmation(Security::token(), 404, 'deletion-unconfirmed', $target);
        // Select the restored copy as the only active game before any protected access can complete an intent.
        unset($this->game);
        rename($this->ops['databasePath'], $this->root . '/game/offline.sqlite');
        self::assertSame(401, $this->api('GET','/save',$a, database:$target)['status']);
        $this->confirmation($token, 200, 'completed', $target);
        $loaded = $this->api('GET','/save',$this->login(self::B,$copy), database:$target);
        self::assertSame(200, $loaded['status']);
        self::assertStringEndsWith('"snapshot":' . $survivor . '}', $loaded['body']);
        self::assertSame($expected, $this->durable($copy));
    }

    public function testTwentyFourHourConfirmationExpiresWhileTheMarkerStillProtectsARecoverableCopy(): void
    {
        $this->createAccount(self::A);
        $this->createAccount(self::B);
        $b = $this->login(self::B);
        $this->ack($this->api('PUT','/save',$this->writeFields($b, 3, 0), $this->body('retained receipt')), 201, 1);
        $kept = $this->durable($this->game);
        $acceptedAt = time()-86410;
        $clock = static fn () => $acceptedAt;
        $a = $this->login(self::A, now: $acceptedAt);
        $token = Security::token();
        $fields = $this->deletionFields($a, $token, $acceptedAt);
        $archive = $this->cli('game')['archive'];
        $security = new Security($this->game, self::ORIGIN, random_bytes(32), $clock);
        $service = new AccountDeletion($this->game, new Sessions($this->game, $clock), $security,
            new RecoveryAccountAccess($this->game, $this->ledger, $clock), $this->ledger, $clock);
        self::assertSame(204, $service->delete('127.0.0.1', array_map(null, array_keys($fields), array_values($fields)))->status);

        foreach ([86399 => 200, 86400 => 404] as $offset => $expected) {
            $route = new DeletionStatus(new DeletionReceipts($this->ledger, $security, fn () => $acceptedAt + $offset));
            $body = fopen('php://memory', 'rb');
            try {
                $status = $route->handle('POST','/account/deletion-status','',
                    [['Origin', self::ORIGIN],['X-Deletion-Receipt',$token]], $body, '127.0.0.1');
                self::assertSame($expected, $status['status']);
                $result = json_decode($status['body'], true, flags: JSON_THROW_ON_ERROR);
                self::assertSame($expected === 200 ? 'completed' : 'deletion-unconfirmed', $result['state'] ?? $result['code']);
            } finally { fclose($body); }
        }
        $this->cli('cleanup');
        $external = Database::open($this->ops['ledgerFile'], $this->docs())->connection();
        self::assertSame(0, $external->query('SELECT count(*) FROM deletion_receipts')->fetchColumn());
        self::assertSame(1, $external->query('SELECT count(*) FROM spent_receipts')->fetchColumn());
        self::assertGreaterThan(time()+604800, $external->query('SELECT retain_until FROM deletion_markers')->fetchColumn());
        self::assertSame($kept, $this->durable($this->game));
        $target = $this->root . '/isolated/expired.sqlite';
        $this->cli('disaster', [$archive, $target]);
        $copy = Database::open($target, $this->docs());
        self::assertSame([], $this->rows($copy,'accounts',self::A));
        self::assertSame($kept, $this->durable($copy));
        $this->confirmation($token, 404, 'deletion-unconfirmed', $target);
    }

    public function testFailedBackupDoesNotDisplaceKnownGoodCopyAndDisasterNeedsNoLivePrimary(): void
    {
        $this->createAccount(self::B);
        $auth = $this->login(self::B);
        $this->ack($this->api('PUT','/save',$this->writeFields($auth, 4, 0), $this->body('before backup')), 201, 1);
        $expected = $this->durable($this->game);
        $archive = $this->cli('game')['archive'];
        $file = $this->ops['archiveDir'] . '/' . $archive;
        $sha = hash_file('sha256', $file);
        $blocker = Database::open($this->ops['databasePath'], $this->docs())->connection();
        $blocker->exec('BEGIN EXCLUSIVE');
        try { $this->cli('game', ok: false); }
        finally { $blocker->exec('ROLLBACK'); }
        self::assertSame([$file], glob($this->ops['archiveDir'] . '/*.nqb'));
        self::assertSame($sha, hash_file('sha256', $file));
        $this->ack($this->api('PUT','/save',$this->writeFields($auth, 5, 1), $this->body('after captured point')), 200, 2);
        unset($blocker, $this->game);
        rename($this->ops['databasePath'], $this->root . '/game/unavailable.sqlite');
        $target = $this->root . '/isolated/disaster.sqlite';
        $this->cli('disaster', [$archive, $target]);
        self::assertFileDoesNotExist($this->ops['databasePath']);
        self::assertSame($expected, $this->durable(Database::open($target, $this->docs())));
        $this->cli('rollback', [$archive, $this->root . '/isolated/planned.sqlite'], false);
        self::assertFileDoesNotExist($this->root . '/isolated/planned.sqlite');
    }

    /** Launch T054's independent real save-route process; both workers stop after policy validation, outside the DB lock. */
    private function writer(array $fields, string $body): array
    {
        $code = 'require $argv[1]; require $argv[2]; SaveConcurrencyWorker::main();';
        $process = proc_open([PHP_BINARY,'-r',$code,__DIR__ . '/../vendor/autoload.php',__DIR__ . '/SaveConcurrencyTest.php'],
            [0=>['pipe','r'],1=>['pipe','w'],2=>['file','/dev/null','w']], $pipes, $this->root, ['LANG'=>'C']);
        self::assertIsResource($process);
        $this->children[] = $process;
        stream_set_timeout($pipes[1], 8);
        $input = ['root'=>$this->docs()[0], 'game'=>$this->root . '/game', 'recovery'=>$this->root . '/ledger',
            'now'=>time(), 'action'=>'save','policy'=>'current','review'=>true,'pause'=>'validated',
            'fields'=>array_map(null, array_keys($fields), array_values($fields)), 'body'=>$body];
        fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR) . "\n");
        $ready = json_decode((string) fgets($pipes[1]), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('ready', $ready['event']);
        self::assertSame(['status'=>200,'etag'=>'"save-1"'], $ready['review']);
        fwrite($pipes[0], "GO\n");
        $paused = json_decode((string) fgets($pipes[1]), true, flags: JSON_THROW_ON_ERROR);
        self::assertSame('validated', $paused['event']);
        self::assertFalse($paused['transaction']);
        return [$process, $pipes, $ready['pid']];
    }

    public function testTwoConcurrentSavesDrainAndFreshRollbackPreserveTheAcknowledgedWinner(): void
    {
        $this->createAccount(self::B);
        $one = $this->login(self::B);
        $two = $this->login(self::B);
        $this->ack($this->api('PUT','/save',$this->writeFields($one, 6, 0), $this->body('first')), 201, 1);
        $writes = [[$this->writeFields($one,7,1),$this->body('one')], [$this->writeFields($two,8,1),$this->body('two')]];
        $children = [$this->writer(...$writes[0]), $this->writer(...$writes[1])];
        self::assertNotSame($children[0][2], $children[1][2]);
        $stale = $this->cli('game')['archive'];
        foreach ($children as [, $pipes]) fwrite($pipes[0], "GO\n");
        $results = [];
        foreach ($children as [$process, $pipes]) {
            $result = json_decode((string) fgets($pipes[1]), true, flags: JSON_THROW_ON_ERROR);
            self::assertSame('result', $result['event']);
            $results[] = $result['response'];
            fclose($pipes[0]); fclose($pipes[1]);
            self::assertSame(0, proc_close($process));
        }
        $statuses = array_column($results, 'status');
        self::assertEqualsCanonicalizing([200,412], $statuses);
        $winner = array_search(200, $statuses, true);
        $this->ack($results[$winner], 200, 2);
        self::assertSame(2, json_decode($results[1-$winner]['body'], true)['currentSummary']['revision']);
        $this->ack($this->api('PUT','/save', ...$writes[$winner]), 200, 2, true);
        $expected = $this->durable($this->game);
        self::assertSame($writes[$winner][1], $expected['saves'][0]['payload_json']);
        self::assertCount(2, $expected['write_receipts']);

        $fresh = $this->cli('game')['archive'];
        $target = $this->root . '/isolated/rollback.sqlite';
        $this->cli('rollback', [$fresh, $target], false);
        self::assertTrue($this->cli('drain')['drained']);
        $late = $this->writeFields($two, 9, 2);
        self::assertSame(503, $this->api('PUT','/save',$late,$this->body('late'))['status']);
        $this->cli('rollback', [$stale,$target], false);
        self::assertFileDoesNotExist($target);
        self::assertSame($expected, $this->durable($this->game));
        $this->cli('rollback', [$fresh, $target]);
        $copy = Database::open($target, $this->docs());
        self::assertSame($expected, $this->durable($copy));
        self::assertFalse($this->cli('resume')['drained']);
        $restored = $this->login(self::B, $copy);
        $retry = $this->writeFields($restored, 7+$winner, 1);
        $this->ack($this->api('PUT','/save',$retry,$writes[$winner][1],$target), 200, 2, true);
        self::assertSame($expected, $this->durable($copy));
    }

    public function testFailedAndSuccessfulDatabaseMigrationThenRestoredContentMigration(): void
    {
        $legacyPath = $this->root . '/game/old.sqlite';
        $legacy = Database::open($legacyPath, $this->docs());
        $v1 = file_get_contents(__DIR__ . '/../migrations/001_game.sql');
        $v2 = file_get_contents(__DIR__ . '/../migrations/002_delete_reauth.sql');
        $legacy->migrate([1=>$v1]);
        $this->createAccount(self::B, $legacy);
        $fixture = json_decode(file_get_contents(dirname(__DIR__,2) . '/tests/fixtures/migrations/spec001.json'), false, flags: JSON_THROW_ON_ERROR);
        $prior = $fixture->input;
        $raw = json_encode($prior, JSON_THROW_ON_ERROR);
        $summary = json_encode(['episodeId'=>$prior->episodeId,'roomId'=>$prior->world->roomId,
            'outcome'=>$prior->world->continueOutcome], JSON_THROW_ON_ERROR);
        $legacy->connection()->prepare('INSERT INTO saves VALUES(?,?,?,?,?,?,?,?,?)')
            ->execute([self::B,7,time(),1,'0.9.1',$prior->adventureId,$raw,hash('sha256',$raw),$summary]);
        $before = $this->durable($legacy);
        try {
            // The second migration has already executed when the unresolvable third migration fails.
            $legacy->migrate([1=>$v1, 2=>$v2, 3=>'INSERT INTO absent_table VALUES(1)']);
            self::fail('A failed migration must roll back the batch.');
        } catch (PDOException $e) { self::assertSame(1, $e->errorInfo[1]); }
        self::assertSame([1], $legacy->connection()->query('SELECT version FROM schema_migrations')->fetchAll(PDO::FETCH_COLUMN));
        self::assertSame(0, $legacy->connection()->query("SELECT count(*) FROM sqlite_master WHERE name='delete_reauth_proofs'")->fetchColumn());
        self::assertSame($before, $this->durable($legacy));
        $legacy->migrate();
        $legacy->migrate();
        self::assertSame([1,2], $legacy->connection()->query('SELECT version FROM schema_migrations ORDER BY version')->fetchAll(PDO::FETCH_COLUMN));
        self::assertSame($before, $this->durable($legacy));
        file_put_contents($this->root . '/config/jobs.json',
            json_encode(array_replace($this->ops, ['databasePath'=>$legacyPath]), JSON_THROW_ON_ERROR));
        $archive = $this->cli('game')['archive'];
        $target = $this->root . '/isolated/migrated.sqlite';
        $this->cli('disaster', [$archive,$target]);
        $copy = Database::open($target, $this->docs());
        $auth = $this->login(self::B, $copy);
        $read = $this->api('GET','/save',$auth, database:$target);
        self::assertSame(200, $read['status']);
        self::assertStringEndsWith('"snapshot":' . $raw . '}', $read['body']);
        $recoveredBytes = substr($read['body'], strpos($read['body'], ',"snapshot":') + strlen(',"snapshot":'), -1);
        $script = <<<'JS'
            import { createServer } from 'vite';
            import { readFileSync } from 'node:fs';
            const server = await createServer({ configFile:false, envDir:false, appType:'custom', logLevel:'silent',
                server:{ middlewareMode:true, watch:null, hmr:false, ws:false }, optimizeDeps:{ noDiscovery:true, include:[] } });
            try {
                const {loadIntroductionContent} = await server.ssrLoadModule('/src/app/content.ts');
                const {introductionSavePolicy} = await server.ssrLoadModule('/src/app/save-policy.ts');
                const {createSpec001SaveReader} = await server.ssrLoadModule('/src/state/migrations/spec001.ts');
                const {registry, world} = loadIntroductionContent();
                const result = createSpec001SaveReader(introductionSavePolicy(registry,world)).read(readFileSync(0));
                if (result.status !== 'ready' || !result.migrated) throw Error('Expected compatible prior version');
                process.stdout.write(JSON.stringify(result.snapshot));
            } finally { await server.close(); }
            JS;
        [$code, $current] = $this->command([TestEnvironment::nodeBinary(),'--input-type=module','-e',$script], input: $recoveredBytes);
        self::assertSame(0, $code, 'Production content migration executes from the recovered prior bytes.');
        self::assertEquals($fixture->expected, json_decode($current, flags: JSON_THROW_ON_ERROR));
        self::assertSame($before, $this->durable($copy));
        $this->ack($this->api('PUT','/save',$this->writeFields($auth,10,7),$current,$target), 200, 8);
        self::assertSame($current, $this->rows($copy,'saves')[0]['payload_json']);
        self::assertCount(1, $this->rows($copy,'write_receipts'));
    }

    public function testSaveCommitFailureCreatesNeitherANewSlotRevisionNorAnAcknowledgement(): void
    {
        $this->createAccount(self::B);
        $auth = $this->login(self::B);
        $this->ack($this->api('PUT','/save',$this->writeFields($auth, 11, 0),$this->body('acknowledged')), 201, 1);
        $fields = $this->writeFields($auth, 12, 1);
        $raw = $this->body('retry after commit failure');
        $before = $this->durable($this->game);
        // Reuse the actual route and independent test-only observer used by the contention suite.
        require_once __DIR__ . '/SaveConcurrencyTest.php';
        $input = ['root'=>$this->docs()[0], 'game'=>$this->root . '/game', 'recovery'=>$this->root . '/ledger',
            'now'=>time(), 'fields'=>array_map(null, array_keys($fields), array_values($fields)), 'body'=>$raw];
        $reader = Database::open($this->ops['databasePath'], $this->docs())->connection();
        $services = SaveConcurrencyWorker::services($input, function (string $phase) use ($reader): void {
            if ($phase === 'validated') {
                $reader->beginTransaction();
                $reader->query('SELECT revision FROM saves')->fetchColumn();
            }
        });
        try {
            $response = SaveConcurrencyWorker::request($services, $input);
            self::assertTrue($reader->inTransaction());
            self::assertSame(503, $response['status']);
            self::assertSame('unavailable', json_decode($response['body'], true)['code']);
        } finally {
            if ($reader->inTransaction()) $reader->rollBack();
        }
        self::assertSame($before, $this->durable($this->game));
        $archive = $this->cli('game')['archive'];
        $target = $this->root . '/isolated/failed-commit.sqlite';
        $this->cli('disaster', [$archive, $target]);
        self::assertSame($before, $this->durable(Database::open($target, $this->docs())));
        $this->ack($this->api('PUT','/save',$fields,$raw), 200, 2);
        $this->ack($this->api('PUT','/save',$fields,$raw), 200, 2, true);
        self::assertCount(2, $this->rows($this->game,'write_receipts'));
    }

    private function composerCommand(): array
    {
        $phar = getenv('NQ_TEST_COMPOSER_PHAR');
        if ($phar === false || $phar === '') {
            foreach (explode(PATH_SEPARATOR, getenv('PATH') ?: '') as $dir) {
                if (str_starts_with($dir, '/') && is_file($dir . '/composer') && is_executable($dir . '/composer')) {
                    return [$dir . '/composer'];
                }
            }
            $phar = dirname(__DIR__, 2) . '/.runtime/composer-2.11.3.phar';
        }
        if (!is_file($phar) || hash_file('sha256', $phar) !== '04f8b003da4e3a2459056591fbfebd02b4dc3e5adeb158616b90cf55a65113ec') {
            throw new RuntimeException('Install Composer 2.11.3 on PATH or supply its verified PHAR through NQ_TEST_COMPOSER_PHAR.');
        }
        return [PHP_BINARY, $phar];
    }

    /** Extract only public application inputs at the pinned revision. The working tree/index are never switched. */
    private function previousRelease(): string
    {
        $prior = $this->root . '/prior';
        mkdir($prior, 0700);
        $tar = $this->root . '/prior.tar';
        [$result] = $this->command(['git','archive','--format=tar','--output=' . $tar,self::PRIOR,
            'server/public','server/src','server/migrations','server/recovery','server/content','server/composer.json',
            'server/composer.lock','specs/001-physical-layer-underworld/contracts/save.schema.json']);
        self::assertSame(0, $result, 'The public prior revision must be available in local git history.');
        [$result] = $this->command(['tar','-xf',$tar,'-C',$prior]);
        self::assertSame(0, $result);
        $app = $prior . '/server/src/Application.php';
        self::assertSame('37e936a47f7bd6be47659a248a47071cedaa5beb5a44e44251e0af47cf47ba62', hash_file('sha256', $app));
        self::assertNotSame(hash_file('sha256', __DIR__ . '/../src/Application.php'), hash_file('sha256', $app));
        self::assertSame('0fa6d980d1b29a859a425e0d863268e71d082b0694423d6213f7a4dfdf503007',
            hash_file('sha256', $prior . '/server/composer.lock'));

        $composer = $this->composerCommand();
        $env = ['PATH'=>dirname(PHP_BINARY) . PATH_SEPARATOR . (getenv('PATH') ?: '/usr/bin:/bin')];
        [$result, $version] = $this->command([...$composer, '--version','--no-ansi'], $env);
        self::assertSame(0, $result);
        self::assertStringContainsString('Composer version 2.11.3 ', $version);
        $cache = getenv('COMPOSER_CACHE_DIR');
        if ($cache !== false && $cache !== '') {
            // An explicitly supplied cache makes this run strictly offline.
            $env += ['COMPOSER_CACHE_DIR'=>$cache, 'COMPOSER_DISABLE_NETWORK'=>'1'];
        } else {
            // The parent test runner excludes service credentials and HOME. Ask Composer for its
            // native cache location before isolating the install's configuration in the fixture.
            $home = getenv('HOME') ?: (function_exists('posix_getpwuid') ? posix_getpwuid(posix_geteuid())['dir'] : false);
            self::assertIsString($home, 'Supply COMPOSER_CACHE_DIR if this platform has no home-directory lookup.');
            [$result, $cache] = $this->command([...$composer,'--no-plugins','--no-scripts','--working-dir=' . $prior . '/server',
                'config','--absolute','cache-dir'], $env + ['HOME'=>$home]);
            self::assertSame(0, $result);
            $env['COMPOSER_CACHE_DIR'] = trim($cache);
        }
        $env += ['COMPOSER_HOME'=>$this->root . '/composer-home','HOME'=>$this->root];
        [$result] = $this->command([...$composer,'install','--working-dir=' . $prior . '/server',
            '--no-dev','--no-scripts','--no-plugins','--no-interaction','--no-progress','--quiet'], $env);
        self::assertSame(0, $result, 'Use the public locked packages. An explicit cache must contain their distributions.');
        $lock = json_decode(file_get_contents($prior . '/server/composer.lock'), true, flags: JSON_THROW_ON_ERROR);
        $installed = json_decode(file_get_contents($prior . '/server/vendor/composer/installed.json'), true, flags: JSON_THROW_ON_ERROR);
        self::assertFalse($installed['dev']);
        $references = static fn (array $packages): array => array_column(array_map(static fn ($p) =>
            ['name'=>$p['name'],'ref'=>$p['dist']['reference']], $packages), 'ref','name');
        self::assertEquals($references($lock['packages']), $references($installed['packages']));
        return $prior . '/server';
    }

    public function testCodeOnlyRollbackRunsPinnedPublicEntryOnTheLiveAcknowledgedDatabase(): void
    {
        $this->createAccount(self::A);
        $this->createAccount(self::B);
        $a = $this->login(self::A);
        $b = $this->login(self::B);
        $fixture = json_decode(file_get_contents(dirname(__DIR__, 2) . '/tests/fixtures/migrations/spec001.json'), false, flags: JSON_THROW_ON_ERROR);
        $enriched = json_encode($fixture->expected, JSON_THROW_ON_ERROR);
        self::assertNotEmpty($fixture->expected->world->inventory);
        $this->ack($this->api('PUT','/save',$this->writeFields($b,13,0),$enriched), 201, 1);
        $stale = $this->cli('game')['archive'];
        $fixture->expected->notebook->personalNotes .= ' Additional synthetic observation.';
        $latest = json_encode($fixture->expected, JSON_THROW_ON_ERROR);
        $latestFields = $this->writeFields($b,14,1);
        $this->ack($this->api('PUT','/save',$latestFields,$latest), 200, 2);
        $before = $this->durable($this->game);
        $inode = fileinode($this->ops['databasePath']);
        $this->cli('drain');
        $target = $this->root . '/isolated/verified-current.sqlite';
        $this->cli('rollback', [$stale,$target], false);
        self::assertFileDoesNotExist($target);
        $fresh = $this->cli('game')['archive'];
        $this->cli('rollback', [$fresh,$target]);
        self::assertSame($before, $this->durable(Database::open($target,$this->docs())));
        $server = $this->previousRelease();

        // No earlier application processes run during the switch. This older code predates the drain.
        $this->cli('resume');
        $token = bin2hex(random_bytes(32));
        $socket = stream_socket_server('tcp://127.0.0.1:0');
        self::assertIsResource($socket);
        $address = stream_socket_get_name($socket, false);
        fclose($socket);
        $process = proc_open([PHP_BINARY, '-d','display_errors=0','-d','log_errors=0','-S',$address,'-t',$server . '/public',
            $server . '/public/index.php'], [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']],
            $pipes, $server, $this->environment() + ['NQ_ENVIRONMENT'=>'local','NQ_DEV_PROXY_TOKEN'=>$token]);
        self::assertIsResource($process);
        $this->children[] = $process;
        $ready = false;
        for ($i = 0; $i < 100; $i++) {
            $connection = @stream_socket_client('tcp://' . $address, $errno, $error, 0.05);
            if ($connection !== false) { fclose($connection); $ready = true; break; }
            usleep(20000);
        }
        self::assertTrue($ready);
        $request = static function (string $method, array $headers, string $body = '') use ($address, $token): array {
            $client = curl_init('http://' . $address . Router::API_BASE . '/save');
            $headers += ['Host'=>'network-quest.invalid','X-Forwarded-Proto'=>'https','X-NQ-Dev-Proxy'=>$token];
            $pairs = [];
            foreach ($headers as $key => $value) $pairs[] = "$key: $value";
            $responseHeaders = [];
            curl_setopt_array($client, [CURLOPT_PROXY=>'',CURLOPT_RETURNTRANSFER=>true, CURLOPT_TIMEOUT=>5,
                CURLOPT_HTTPHEADER=>$pairs,CURLOPT_POSTFIELDS=>$body,CURLOPT_CUSTOMREQUEST=>$method,
                CURLOPT_HEADERFUNCTION=>static function ($client, string $line) use (&$responseHeaders): int {
                    if (str_contains($line, ':')) {
                        [$key,$value] = explode(':', $line, 2); $responseHeaders[strtolower($key)] = trim($value);
                    }
                    return strlen($line);
                }]);
            $result = curl_exec($client);
            self::assertIsString($result);
            self::assertSame('no-store',$responseHeaders['cache-control']);
            return ['status'=>curl_getinfo($client, CURLINFO_RESPONSE_CODE), 'body'=>$result,'headers'=>$responseHeaders];
        };
        $loaded = $request('GET', $b);
        self::assertSame(200, $loaded['status']);
        self::assertSame('"save-2"', $loaded['headers']['etag']);
        self::assertStringEndsWith('"snapshot":' . $latest . '}', $loaded['body']);
        self::assertSame(404, $request('GET', $a)['status']);
        self::assertSame(401, $request('GET', [])['status']);
        $this->ack($request('PUT',$latestFields,$latest), 200, 2, true);
        self::assertSame($before, $this->durable($this->game));
        $next = $latest . "\n";
        $this->ack($request('PUT',$this->writeFields($b,15,2),$next), 200, 3);
        proc_terminate($process);
        proc_close($process);
        self::assertSame($inode, fileinode($this->ops['databasePath']));
        $forward = $this->api('GET','/save',$b);
        self::assertSame(200, $forward['status']);
        self::assertSame('"save-3"', $forward['headers']['ETag']);
        self::assertStringEndsWith('"snapshot":' . $next . '}', $forward['body']);
        self::assertCount(3, $this->rows($this->game,'write_receipts'));
        self::assertSame([], $this->rows($this->game,'saves',self::A));
    }
}
