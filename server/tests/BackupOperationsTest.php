<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Application;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Operations\Archive;
use NetworkQuest\Router;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/Application.php';
require_once __DIR__ . '/../src/Operations/Command.php';

/** Exercises the CLI in child processes, with independently generated private keys and two synthetic stores. */
final class BackupOperationsTest extends TestCase
{
    private string $root;
    private int $mask;
    private array $v;
    private Database $game;
    private DeletionLedger $ledger;
    private const DIRS = ['web','config','game','ledger','archive','ledgerarchive','keys','isolated','logs'];
    private string $account = '66000000-0000-4000-8000-000000000165';
    private string $body;

    protected function setUp(): void
    {
        $this->mask = umask(0077);
        $this->root = realpath('/tmp') . '/network-quest-ops-' . bin2hex(random_bytes(20));
        self::assertTrue(mkdir($this->root, 0700));
        foreach (self::DIRS as $dir) mkdir($this->dir($dir), 0700);
        $this->v = ['databasePath'=>$this->dir('game/save.sqlite'), 'ledgerFile'=>$this->dir('ledger/marks.sqlite'),
            'rollbackRoots'=>[$this->dir('game'), $this->dir('archive')], 'backupSeconds'=>2592000,
            'restorationSeconds'=>86400, 'retentionEvidence'=>'synthetic test fixture only', 'archiveDir'=>$this->dir('archive'),
            'ledgerArchiveDir'=>$this->dir('ledgerarchive'), 'keyFile'=>$this->dir('keys/game'), 'ledgerKeyFile'=>$this->dir('keys/ledger'),
            'restoreDir'=>$this->dir('isolated'), 'logDir'=>$this->dir('logs')];
        foreach (['keyFile','ledgerKeyFile'] as $key) file_put_contents($this->v[$key], random_bytes(32));
        file_put_contents($this->dir('config/jobs.json'), json_encode($this->v, JSON_THROW_ON_ERROR));
        touch($this->v['ledgerFile']);
        touch($this->v['ledgerFile'] . '.lock');
        $this->ledger = DeletionLedger::initialize($this->v['ledgerFile'], [$this->dir('web')], $this->v['rollbackRoots'],
            new DeletionRetentionPolicy(2592000, 86400, $this->v['retentionEvidence']));
        $this->game = Database::open($this->v['databasePath'], [$this->dir('web')]);
        $this->game->migrate();
        $this->body = file_get_contents(__DIR__ . '/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json');
        $slot = json_decode($this->body, true, flags: JSON_THROW_ON_ERROR);
        $this->game->immediate(function (PDO $pdo) use ($slot): void {
            $now = time() - 3;
            $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$this->account,$now]);
            $pdo->prepare("INSERT INTO identities(account_id,provider,subject) VALUES(?,'google',?)")->execute([$this->account, bin2hex(random_bytes(16))]);
            $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$this->account]);
            $summary = ['episodeId'=>$slot['episodeId'], 'roomId'=>$slot['world']['roomId'], 'outcome'=>$slot['world']['continueOutcome']];
            $pdo->prepare('INSERT INTO saves VALUES(?,?,?,?,?,?,?,?,?)')->execute([$this->account,12,$now,1,$slot['contentVersion'],
                $slot['adventureId'],$this->body,hash('sha256',$this->body),json_encode($summary, JSON_THROW_ON_ERROR)]);
        });
    }

    protected function tearDown(): void
    {
        unset($this->game, $this->ledger);
        foreach (self::DIRS as $dir) {
            foreach (new DirectoryIterator($this->dir($dir)) as $entry) {
                if ($entry->isDot()) continue;
                self::assertFalse($entry->isDir());
                unlink($entry->getPathname());
            }
            rmdir($this->dir($dir));
        }
        rmdir($this->root);
        umask($this->mask);
    }

    private function dir(string $path): string { return $this->root . '/' . $path; }

    private function cli(string $action, array $args = [], bool $ok = true): array
    {
        $bin = in_array($action, ['disaster','rollback','ledger-inspect'], true) ? 'restore' : 'backup';
        $process = proc_open([PHP_BINARY, __DIR__ . '/../bin/' . $bin . '.php', $this->dir('config/jobs.json'), $action, ...$args],
            [1=>['pipe','w'],2=>['pipe','w']], $pipes, null, ['NQ_DOCUMENT_ROOTS_JSON'=>json_encode([$this->dir('web')])]);
        $out = stream_get_contents($pipes[1]); $err = stream_get_contents($pipes[2]);
        foreach ($pipes as $pipe) fclose($pipe);
        $exit = proc_close($process);
        self::assertSame($ok ? 0 : 1, $exit, $action . ': ' . $out . $err);
        self::assertSame('', $ok ? $err : $out);
        $result = json_decode($ok ? $out : $err, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame($ok, $result['ok']);
        if (!$ok) self::assertSame(['ok'=>false, 'operation'=>$action, 'reason'=>'operational-check-failed'], $result);
        return $result;
    }

    public function testValidatedRotationIsIndependentAndDisasterRestoreWorksWithoutLiveGame(): void
    {
        $game = $this->cli('game');
        $ledger = $this->cli('ledger');
        $this->cli('status');
        $bytes = file_get_contents($this->dir('archive/' . $game['archive']));
        self::assertStringNotContainsString('SQLite format', $bytes);
        self::assertStringNotContainsString($this->account, $bytes);
        self::assertStringNotContainsString('schema_migrations', $bytes);
        $old = 'nq-game-' . (time() - 604802) . '-' . bin2hex(random_bytes(12)) . '.nqb';
        $key = file_get_contents($this->v['keyFile']);
        $snapshot = $this->dir('isolated/dated-fixture.sqlite');
        Archive::unseal($this->dir('archive/' . $game['archive']), $game['archive'], $key, $snapshot);
        Archive::seal($snapshot, $this->dir('archive/' . $old), $old, $key);
        $original = $this->dir('archive/' . $game['archive']);
        rename($original, $this->dir('config/held-archive'));
        try { $this->cli('status', ok: false); }
        finally { rename($this->dir('config/held-archive'), $original); }
        $this->cli('game');
        self::assertFileDoesNotExist($this->dir('archive/' . $old));
        self::assertFileExists($this->dir('archive/' . $game['archive']));
        self::assertFileExists($this->dir('ledgerarchive/' . $ledger['archive']));
        unset($this->game);
        unlink($this->v['databasePath']);
        rename($this->dir('game'), $this->dir('offline-game'));
        rename($this->dir('ledgerarchive'), $this->dir('offline-ledgerarchive'));
        try {
            $this->cli('disaster', [$game['archive'], $this->dir('isolated/disaster.sqlite')]);
        } finally {
            rename($this->dir('offline-ledgerarchive'), $this->dir('ledgerarchive'));
            rename($this->dir('offline-game'), $this->dir('game'));
        }
        $db = Database::open($this->dir('isolated/disaster.sqlite'), [$this->dir('web')]);
        self::assertSame([$this->account,12,$this->body], $db->connection()->query('SELECT account_id,revision,payload_json FROM saves')->fetch(PDO::FETCH_NUM));
        self::assertFileDoesNotExist($this->v['databasePath']);
        unlink($this->v['keyFile']);
        rename($this->dir('ledger'), $this->dir('offline-ledger'));
        rename($this->dir('archive'), $this->dir('offline-archive'));
        try {
            $this->cli('ledger-inspect', [$ledger['archive'], $this->dir('isolated/ledger.sqlite')]);
        } finally {
            rename($this->dir('offline-archive'), $this->dir('archive'));
            rename($this->dir('offline-ledger'), $this->dir('ledger'));
        }
    }

    public function testCorruptionFailureAndInterruptionLeavePreviousVerifiedCopy(): void
    {
        $saved = $this->cli('game')['archive'];
        $path = $this->dir('archive/' . $saved);
        $original = file_get_contents($path);
        file_put_contents($this->dir('isolated/.nq-work-' . bin2hex(random_bytes(12))), 'interrupted snapshot');
        $this->game->connection()->exec("UPDATE saves SET payload_hash=lower(hex(randomblob(32)))");
        $this->cli('game', ok:false);
        self::assertSame([$path], glob($this->dir('archive/*')));
        self::assertSame([], glob($this->dir('isolated/.nq-work-*')));
        self::assertSame($original, file_get_contents($path));
        foreach ([substr($original,0,-1), $original . 'extra', str_repeat('x',52) . substr($original,52)] as $bad) {
            file_put_contents($path, $bad);
            $this->cli('disaster', [$saved, $this->dir('isolated/rejected.sqlite')], false);
            self::assertFileDoesNotExist($this->dir('isolated/rejected.sqlite'));
        }
        file_put_contents($path, $original);
        $this->cli('disaster', [$saved, $this->dir('isolated/rejected.sqlite')]);
        $this->cli('disaster', [$saved, $this->dir('isolated/rejected.sqlite')], false);
        $this->cli('disaster', [$saved, $this->v['databasePath']], false);
        $this->cli('disaster', ['../' . $saved, $this->dir('isolated/other.sqlite')], false);
        chmod($this->v['keyFile'], 0644);
        $this->cli('disaster', [$saved, $this->dir('isolated/other.sqlite')], false);
    }

    public function testEqualKeyMaterialCannotPromoteEitherKindAndPreservesPriorCopies(): void
    {
        $game = $this->cli('game')['archive'];
        $ledger = $this->cli('ledger')['archive'];
        $gameFile = $this->dir('archive/' . $game);
        $ledgerFile = $this->dir('ledgerarchive/' . $ledger);
        $before = [hash_file('sha256', $gameFile), hash_file('sha256', $ledgerFile)];
        file_put_contents($this->v['ledgerKeyFile'], file_get_contents($this->v['keyFile']));
        $this->cli('game', ok: false);
        $this->cli('ledger', ok: false);
        $this->cli('status', ok: false);
        self::assertSame([$gameFile], glob($this->dir('archive/*')));
        self::assertSame([$ledgerFile], glob($this->dir('ledgerarchive/*')));
        self::assertSame($before, [hash_file('sha256',$gameFile),hash_file('sha256',$ledgerFile)]);
        unlink($this->v['ledgerKeyFile']);
        $this->cli('disaster', [$game, $this->dir('isolated/only-game-key.sqlite')]);
    }

    public function testSeparateExpiryAndScopedRedactedRequestLog(): void
    {
        $ids = ['66000000-0000-4000-8000-000000000001', '66000000-0000-4000-8000-000000000002'];
        $now = time();
        $pdo = $this->game->connection();
        $receipt = $pdo->prepare('INSERT INTO write_receipts(account_id,request_id,fingerprint,committed_revision,committed_at,expires_at)
            VALUES(?,?,?,?,?,?)');
        foreach ([$now-604801, $now-604700] as $i => $at) $receipt->execute([$this->account,$ids[$i],hash('sha256',$ids[$i]),10+$i,$at,$at+604800]);
        $this->ledger->exclusive(function () use ($now, $ids): void {
            foreach ([$now-86401, $now-86300] as $i => $at) $this->ledger->accept($ids[$i], hash('sha256',$ids[$i]), $at);
        });
        $api = Router::API_BASE;
        $web = ['origin'=>'https://example.invalid', 'gamePath'=>Router::GAME_BASE,
            'rateKey'=>rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=')];
        foreach (['google','github'] as $provider) {
            $web[$provider.'ClientId'] = 'synthetic-id';
            $web[$provider.'ClientSecret'] = bin2hex(random_bytes(32));
            $web[$provider.'Callback'] = $web['origin'] . $api . '/auth/' . $provider . '/callback';
        }
        $web += array_intersect_key($this->v, array_flip(['databasePath','ledgerFile','rollbackRoots','backupSeconds','restorationSeconds','retentionEvidence']));
        $cfg = $this->dir('config/web.json');
        file_put_contents($cfg, json_encode($web, JSON_THROW_ON_ERROR));
        $app = Application::fromEnvironment(['NQ_CONFIG_FILE'=>$cfg, 'NQ_DOCUMENT_ROOTS_JSON'=>json_encode([$this->dir('web')]),
            'NQ_REQUEST_LOG_DIR'=>$this->dir('logs')]);
        $private = bin2hex(random_bytes(20));
        $body = fopen('php://memory', 'rb');
        $res = $app->handleSapi(['REQUEST_URI'=>$api . '/auth/google/callback?code=' . $private,
            'REQUEST_METHOD'=>'GET','HTTPS'=>'on', 'HTTP_HOST'=>'example.invalid', 'REMOTE_ADDR'=>'192.0.2.1', 'SERVER_PROTOCOL'=>'HTTP/1.1'],
            ['Host'=>'example.invalid', 'X-Deletion-Receipt'=>$private], $body,'litespeed');
        fclose($body);
        $log = glob($this->dir('logs/nq-requests-*.jsonl'))[0];
        $line = file_get_contents($log);
        self::assertStringNotContainsString($private, $line);
        self::assertStringNotContainsString('192.0.2.1', $line);
        $row = json_decode($line, true, flags: JSON_THROW_ON_ERROR);
        self::assertSame(['route','status','durationMs','requestId','reason'], array_keys($row));
        self::assertSame('authCallback',$row['route']);
        self::assertSame($res['status'],$row['status']);
        $old = $this->dir('logs/nq-requests-' . gmdate('YmdH', $now-604801) . '.jsonl');
        file_put_contents($old, $line);
        $this->cli('cleanup');
        $this->cli('cleanup');
        self::assertFileDoesNotExist($old);
        self::assertFileExists($log);
        self::assertSame([$ids[1]], $pdo->query('SELECT request_id FROM write_receipts')->fetchAll(PDO::FETCH_COLUMN));
        $ledgerDb = Database::open($this->v['ledgerFile'], [$this->dir('web')]);
        self::assertSame([hash('sha256',$ids[1])], $ledgerDb->connection()->query('SELECT receipt_hash FROM deletion_receipts')->fetchAll(PDO::FETCH_COLUMN));
        self::assertSame(2, $ledgerDb->connection()->query('SELECT count(*) FROM deletion_markers')->fetchColumn());
        self::assertSame(2, $ledgerDb->connection()->query('SELECT count(*) FROM spent_receipts')->fetchColumn());
    }

    public function testReleaseDrainRejectsStaleOrUndrainedRollbackAndRehearsalPreservesPendingStatus(): void
    {
        $old = $this->cli('game')['archive'];
        $target = $this->dir('isolated/guarded.sqlite');
        $this->cli('rollback', [$old,$target], false);
        $this->game->connection()->exec('UPDATE saves SET revision=revision+1');
        $this->cli('drain');
        $access = new NetworkQuest\RecoveryAccountAccess($this->game, $this->ledger);
        $called = false;
        try {
            $access->run(function () use (&$called): void { $called = true; });
            self::fail('Drained operation unexpectedly ran.');
        } catch (RuntimeException) { self::assertFalse($called); }
        $this->cli('rollback', [$old,$target], false);
        self::assertFileDoesNotExist($target);
        $fresh = $this->cli('game')['archive'];
        $this->cli('rollback', [$fresh,$target]);
        $candidate = Database::open($target, [$this->dir('web')]);
        self::assertSame(13, $candidate->connection()->query('SELECT revision FROM saves')->fetchColumn());
        $this->cli('resume');
        self::assertTrue($access->run(fn () => true));
        $receipt = hash('sha256', random_bytes(32));
        $this->ledger->exclusive(fn () => $this->ledger->accept($this->account, $receipt, time()));
        $target2 = $this->dir('isolated/deletion.sqlite');
        $this->cli('disaster', [$old,$target2]);
        $replayed = Database::open($target2, [$this->dir('web')]);
        self::assertSame(0, $replayed->connection()->query('SELECT count(*) FROM saves')->fetchColumn());
        self::assertSame(1, $this->game->connection()->query('SELECT count(*) FROM saves')->fetchColumn());
        self::assertSame('pending', $this->ledger->exclusive(fn () => $this->ledger->receipt($receipt, time()))['state']);
    }

    public function testEarlierContentAndOpaqueFuturePayloadSurviveRecoveryByteForByte(): void
    {
        $fixtures = json_decode(file_get_contents(__DIR__ . '/../../tests/fixtures/migrations/spec001.json'), true, flags: JSON_THROW_ON_ERROR);
        $earlier = $fixtures['input'];
        $summary = json_encode(['episodeId'=>$earlier['episodeId'],'roomId'=>$earlier['world']['roomId'],
            'outcome'=>$earlier['world']['continueOutcome']], JSON_THROW_ON_ERROR);
        $rows = [[1, '0.9.1', json_encode($earlier, JSON_THROW_ON_ERROR)],
            [2, 'future', $fixtures['unknownNewer'][0]['rawUtf8']]];
        foreach ($rows as [$schema, $content, $raw]) {
            $put = $this->game->connection()->prepare('UPDATE saves SET schema_version=?,content_version=?,adventure_id=?,payload_json=?,payload_hash=?,summary_json=?');
            $put->execute([$schema,$content,$earlier['adventureId'],$raw,hash('sha256',$raw),$summary]);
            $archive = $this->cli('game')['archive'];
            $target = $this->dir('isolated/' . $schema . '.sqlite');
            $this->cli('disaster', [$archive,$target]);
            $db = Database::open($target, [$this->dir('web')]);
            self::assertSame([$schema,$content,$raw], $db->connection()
                ->query('SELECT schema_version,content_version,payload_json FROM saves')->fetch(PDO::FETCH_NUM));
        }
    }
}
