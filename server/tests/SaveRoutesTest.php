<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Routes\Save;
use NetworkQuest\SaveRepository;
use NetworkQuest\SaveValidator;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['AccountAccess', 'Database', 'Security', 'Sessions', 'SaveValidator', 'SaveRepository', 'DeletionLedger', 'RecoveryAccountAccess', 'Routes/Save'] as $file) {
    require_once __DIR__ . '/../src/' . $file . '.php';
}

/** Test-only barrier spy: no production implementation or configuration bypass. */
final class SaveRouteAccessProbe implements AccountAccess
{
    public int $calls = 0;
    public bool $active = false;
    public ?Closure $before = null;
    public function __construct(private Database $database, private ?AccountAccess $delegate = null) {}
    public function run(callable $operation): mixed
    {
        TestCase::assertFalse($this->active, 'No nested account barrier.');
        TestCase::assertFalse($this->database->connection()->inTransaction(), 'Barrier precedes transactions.');
        ++$this->calls; $this->active = true;
        try {
            if ($this->before !== null) ($this->before)($this->calls);
            return $this->delegate === null ? $operation() : $this->delegate->run($operation);
        } finally { $this->active = false; }
    }
}

final class SaveRoutesTest extends TestCase
{
    private TestEnvironment $environment;
    private TestEnvironment $recovery;
    private DeletionLedger $ledger;
    private Database $database;
    private Sessions $sessions;
    private Security $security;
    private SaveRouteAccessProbe $access;
    private array $auth;
    private int $now = 1795737600;
    private const ACCOUNT = '60000000-0000-4000-8000-000000000001';
    private const OTHER = '60000000-0000-4000-8000-000000000002';
    private const KEY = '70000000-0000-4000-8000-000000000001';
    private const ORIGIN = 'https://network-quest.invalid';

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create(); $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')]);
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn (): int => $this->now);
        $this->security = new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn (): int => $this->now);
        $this->recovery = TestEnvironment::create(); $this->recovery->connect(); $this->recovery->writeFile('synthetic.sqlite.lock', '');
        $this->ledger = DeletionLedger::initialize($this->recovery->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')], [$this->environment->directory()],
            new DeletionRetentionPolicy(30 * 86400, 7 * 86400, 'synthetic-route-test-not-host-retention'));
        $this->access = new SaveRouteAccessProbe($this->database, new RecoveryAccountAccess($this->database, $this->ledger, fn (): int => $this->now));
        $this->auth = $this->account(self::ACCOUNT);
    }
    protected function tearDown(): void
    {
        unset($this->access, $this->ledger, $this->security, $this->sessions, $this->database); $this->environment->close(); $this->recovery->close();
    }
    private function account(string $id): array
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$id, 'google', 'synthetic-' . $id]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo): array => $this->sessions->rotateWithin($pdo, $guest['context'], $id));
    }
    private static function payload(): string { return file_get_contents(__DIR__ . '/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json'); }
    private function handler(?array $policies = null, ?callable $observer = null): Save
    {
        $current = json_decode(file_get_contents(__DIR__ . '/../content/save-policy.generated.json'))->policies;
        $repository = new SaveRepository($this->database, $this->sessions, $this->security, new SaveValidator($policies ?? $current),
            [['saveSchemaVersion' => 1, 'contentVersion' => '1.0.0']], $this->access, fn (): int => $this->now, $observer);
        return new Save($this->database, $this->sessions, $this->security, $repository, $this->access);
    }
    private function fields(array $changes = [], ?array $auth = null): array
    {
        $auth ??= $this->auth;
        $fields = ['Origin' => self::ORIGIN, 'Cookie' => explode(';', $auth['setCookie'], 2)[0], 'X-CSRF-Token' => $auth['csrfToken'],
            'Content-Type' => 'application/json', 'Idempotency-Key' => self::KEY, 'X-Save-Mode' => 'manual', 'If-None-Match' => '*'];
        foreach ($changes as $name => $value) { if ($value === null) unset($fields[$name]); else $fields[$name] = $value; }
        return array_map(fn ($name) => [$name, $fields[$name]], array_keys($fields));
    }
    private function request(string $method = 'PUT', ?string $raw = null, ?array $fields = null, string $query = '', ?Save $handler = null, string $route = '/save'): array
    {
        $stream = fopen('php://memory', 'w+b'); fwrite($stream, $raw ?? ($method === 'GET' ? '' : self::payload())); rewind($stream);
        try { return ($handler ?? $this->handler())->handle($method, $route, $query, $fields ?? $this->fields(), $stream, '127.0.0.1'); }
        finally { fclose($stream); }
    }
    private function response(array $response, int $status): array
    {
        self::assertSame($status, $response['status']);
        self::assertSame('no-store', $response['headers']['Cache-Control']);
        self::assertSame('application/json; charset=utf-8', $response['headers']['Content-Type']);
        self::assertSame('nosniff', $response['headers']['X-Content-Type-Options']);
        self::assertMatchesRegularExpression('/^[0-9a-f-]{36}$/D', $response['headers']['X-Request-Id']);
        $data = json_decode($response['body'], true, 512, JSON_THROW_ON_ERROR);
        if ($status >= 400) {
            self::assertSame($response['headers']['X-Request-Id'], $data['requestId']);
            self::assertSame($status === 412 ? ['code','message','requestId','currentSummary'] : ['code','message','requestId'], array_keys($data));
        }
        return $data;
    }
    private function slot(): array { return $this->database->connection()->query('SELECT * FROM saves')->fetchAll(); }

    public function testGetEmptyCreateGetAndReplayUseOnlyPublicResponseShapes(): void
    {
        $this->response($this->request('GET'), 404);
        $first = $this->response($created = $this->request(), 201);
        self::assertSame(['requestId','committedRevision','committedAt','replayed','currentSummary'], array_keys($first));
        self::assertSame(self::KEY, $first['requestId']); self::assertFalse($first['replayed']);
        self::assertSame('"save-1"', $created['headers']['ETag']);
        $get = $this->response($read = $this->request('GET'), 200);
        self::assertSame(['summary','snapshot'], array_keys($get));
        self::assertSame($first['currentSummary'], $get['summary']);
        self::assertSame(json_decode(self::payload(), true), $get['snapshot']);
        self::assertSame('"save-1"', $read['headers']['ETag']);
        $again = $this->response($this->request(handler: $this->handler([])), 200);
        self::assertTrue($again['replayed']); self::assertSame(1, $again['committedRevision']);
        self::assertCount(1, $this->slot());
    }

    public function testReplayAcknowledgementMayBeOlderThanCurrentSlot(): void
    {
        $this->response($this->request(), 201);
        $fields = $this->fields(['If-None-Match' => null, 'If-Match' => '"save-1"', 'Idempotency-Key' => '70000000-0000-4000-8000-000000000002']);
        $this->response($this->request(raw: self::payload() . ' ', fields: $fields), 200);
        $data = $this->response($response = $this->request(handler: $this->handler([])), 200);
        self::assertSame(1, $data['committedRevision']); self::assertSame(2, $data['currentSummary']['revision']);
        self::assertSame('"save-2"', $response['headers']['ETag']);
        $this->response($this->request(raw: self::payload() . '  '), 409);
        $data = $this->response($this->request(raw: self::payload() . ' ', fields: $this->fields(['Idempotency-Key' => '70000000-0000-4000-8000-000000000003'])), 412);
        self::assertSame(2, $data['currentSummary']['revision']);
    }

    public function testGetPreservesUnknownVersionAndExactUnknownNumericJsonWithoutCurrentPolicy(): void
    {
        $this->response($this->request(), 201);
        $future = '{"saveSchemaVersion":999,"contentVersion":"future","unknown":9007199254740993123456789,"nested":{}}';
        $this->database->connection()->prepare('UPDATE saves SET schema_version=999,content_version=?,payload_json=?,payload_hash=?')->execute(['future', $future, hash('sha256', $future)]);
        $before = $this->slot();
        $data = $this->response($response = $this->request('GET', handler: $this->handler([])), 200);
        self::assertSame(999, $data['summary']['saveSchemaVersion']); self::assertSame('future', $data['summary']['contentVersion']);
        self::assertStringContainsString('"snapshot":' . $future, $response['body']); self::assertSame($before, $this->slot());
    }

    public static function transportCases(): iterable
    {
        yield 'wrong-media' => ['PUT', '{}', ['Content-Type' => 'text/plain'], '', 400];
        yield 'missing-media' => ['PUT', '{}', ['Content-Type' => null], '', 400];
        yield 'selector-query' => ['PUT', '{}', [], 'accountId=other', 400];
        yield 'get-selector' => ['GET', '', [], 'accountId=other', 400];
        yield 'method' => ['POST', '{}', [], '', 400];
        yield 'get-body' => ['GET', '{}', [], '', 413];
        yield 'compressed' => ['PUT', '{}', ['Content-Encoding' => 'gzip'], '', 400];
        yield 'framing-mismatch' => ['PUT', '{}', ['Content-Length' => '1'], '', 400];
        yield 'framing-ambiguity' => ['PUT', '{}', ['Content-Length' => '2','Transfer-Encoding' => 'chunked'], '', 400];
        yield 'oversize' => ['PUT', str_repeat(' ', 262145), [], '', 413];
        yield 'origin' => ['PUT', '{}', ['Origin' => 'https://elsewhere.invalid'], '', 403];
        yield 'csrf' => ['PUT', '{}', ['X-CSRF-Token' => str_repeat('A',43)], '', 403];
        yield 'missing-session' => ['PUT', '{}', ['Cookie' => null], '', 401];
        yield 'missing-precondition' => ['PUT', '{}', ['If-None-Match' => null], '', 428];
        yield 'weak-precondition' => ['PUT', '{}', ['If-None-Match' => null, 'If-Match' => 'W/"save-1"'], '', 400];
        yield 'invalid-json' => ['PUT', '{', [], '', 400];
        yield 'invalid-save' => ['PUT', '{"accountId":"other"}', [], '', 422];
    }
    #[DataProvider('transportCases')]
    public function testRawPortRejectsMalformedRequests(string $method, string $raw, array $changes, string $query, int $status): void
    {
        $this->response($this->request($method, $raw, $this->fields($changes), $query), $status);
        self::assertSame([], $this->slot());
    }

    public function testDuplicateRawHeadersAndWrongAccountCannotReadOrWriteOwner(): void
    {
        $this->response($this->request(), 201); $before = $this->slot();
        $fields = $this->fields(); $fields[] = ['if-none-match', '*'];
        $this->response($this->request(fields: $fields), 400);
        $other = $this->account(self::OTHER);
        $this->response($this->request('GET', fields: $this->fields([], $other)), 404);
        $data = $this->response($this->request(fields: $this->fields(['If-None-Match'=>null, 'If-Match'=>'"save-1"'], $other)), 412);
        self::assertNull($data['currentSummary']); self::assertSame($before, $this->slot());
    }

    public function testOnlyOneSaveRateChargeAndNoUnexpectedErrorLeak(): void
    {
        for ($i = 0; $i < 60; ++$i) $this->response($this->request(), $i === 0 ? 201 : 200);
        $this->response($limited = $this->request(), 429); self::assertGreaterThanOrEqual(1, (int) $limited['headers']['Retry-After']);
        $this->access->before = static fn () => throw new RuntimeException('private SQL and token never emitted');
        $this->response($failure = $this->request('GET'), 503); self::assertArrayHasKey('Retry-After', $failure['headers']);
        self::assertStringNotContainsString('private SQL', $failure['body']); self::assertSame(1, $this->slot()[0]['revision']);
    }

    public function testActualRecoveryMarkerPreventsReadAndReceiptReplay(): void
    {
        $this->response($this->request(), 201);
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, str_repeat('d',64), $this->now));
        $this->response($this->request('GET'), 401);
        $this->response($this->request(), 401);
        self::assertSame([], $this->slot());
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM write_receipts')->fetchColumn());
        $this->ledger->exclusive(fn () => self::assertSame('completed', $this->ledger->receipt(str_repeat('d',64), $this->now)['state']));
    }

    public function testDeletionAppearingAfterValidationWinsOverProvisionalError(): void
    {
        $this->response($this->request(), 201);
        $handler = $this->handler([], function (string $phase): void {
            if ($phase === 'validated') $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, str_repeat('e',64), $this->now));
        });
        $fields = $this->fields(['If-None-Match'=>null,'If-Match'=>'"save-1"','Idempotency-Key'=>'70000000-0000-4000-8000-000000000002']);
        $this->response($this->request(fields:$fields, handler:$handler),401);
        self::assertSame([], $this->slot());
    }

    public function testSessionIsRecheckedInsideReadTransactionAndStorageFailureIsBounded(): void
    {
        $this->response($this->request(),201); $before=$this->slot(); $calls=0;
        $expiring=new Sessions($this->database, function () use (&$calls): int { return $this->now + (++$calls === 1 ? 0 : 7201); });
        $policies=json_decode(file_get_contents(__DIR__ . '/../content/save-policy.generated.json'))->policies;
        $repo=new SaveRepository($this->database,$expiring,$this->security,new SaveValidator($policies),[],$this->access);
        $handler=new Save($this->database,$expiring,$this->security,$repo,$this->access);
        $this->response($this->request('GET',handler:$handler),401); self::assertSame(2,$calls); self::assertSame($before,$this->slot());
        $other=$this->environment->connect(); $other->exec('BEGIN IMMEDIATE'); $started=hrtime(true);
        try { $this->response($failure=$this->request('GET'),503); }
        finally { $other->exec('ROLLBACK'); }
        self::assertLessThan(2.0,(hrtime(true)-$started)/1e9); self::assertArrayHasKey('Retry-After',$failure['headers']); self::assertSame($before,$this->slot());
    }

    public function testRoutePreservesAutomaticOptInAndExplicitDifferentAdventureAdoption(): void
    {
        $this->response($this->request(),201);
        $replace=['If-None-Match'=>null,'If-Match'=>'"save-1"','Idempotency-Key'=>'70000000-0000-4000-8000-000000000002'];
        $data=$this->response($this->request(fields:$this->fields($replace+['X-Save-Mode'=>'automatic'])),409);
        self::assertSame('autosave-disabled',$data['code']);
        $this->database->connection()->exec('UPDATE preferences SET autosave_enabled=1');
        $different=str_replace('8d189c08-9d3e-41ba-b044-b6c9e2c0d409','8d189c08-9d3e-41ba-b044-b6c9e2c0d410',self::payload());
        $data=$this->response($this->request(raw:$different,fields:$this->fields($replace+['X-Save-Mode'=>'automatic'])),409);
        self::assertSame('manual-adoption-required',$data['code']);
        $data=$this->response($this->request(raw:$different,fields:$this->fields($replace)),409);
        self::assertSame('replacement-confirmation-required',$data['code']); self::assertSame(1,$this->slot()[0]['revision']);
        $this->response($this->request(raw:$different,fields:$this->fields($replace+['X-Confirm-Adventure-Replacement'=>'true'])),200);
        $this->response($this->request(raw:$different,fields:$this->fields(['If-None-Match'=>null,'If-Match'=>'"save-2"',
            'Idempotency-Key'=>'70000000-0000-4000-8000-000000000003','X-Save-Mode'=>'automatic'])),200);
        self::assertCount(1,$this->slot()); self::assertSame(3,$this->slot()[0]['revision']);
    }

    public static function competingRequests(): iterable
    {
        yield 'same-operation' => [false,false,[200,201]];
        yield 'different-keys' => [true,false,[201,412]];
        yield 'same-key-different-bytes' => [false,true,[201,409]];
    }
    #[DataProvider('competingRequests')]
    public function testIndependentOverlappingRouteWritersPreserveOneSlotAndOneReceipt(bool $differentKey,bool $differentBytes,array $expected): void
    {
        $guest=$this->sessions->bootstrap(null);
        $second=$this->database->immediate(fn (PDO $pdo): array=>$this->sessions->rotateWithin($pdo,$guest['context'],self::ACCOUNT));
        $program= <<<'PHP'
            $input=json_decode(fgets(STDIN),true,32,JSON_THROW_ON_ERROR);
            require $input['root'].'/server/vendor/autoload.php';
            foreach (['AccountAccess','Database','Security','Sessions','SaveValidator','SaveRepository','DeletionLedger','RecoveryAccountAccess','Routes/Save'] as $file) require $input['root'].'/server/src/'.$file.'.php';
            $db=NetworkQuest\Database::open($input['game'].'/synthetic.sqlite',[$input['root']]);
            $ledger=NetworkQuest\DeletionLedger::open($input['recovery'].'/synthetic.sqlite',[$input['root']],[$input['game']],new NetworkQuest\DeletionRetentionPolicy(30*86400,7*86400,'synthetic-route-test-not-host-retention'));
            $clock=fn()=>$input['now']; $sessions=new NetworkQuest\Sessions($db,$clock);
            $security=new NetworkQuest\Security($db,'https://network-quest.invalid',str_repeat('synthetic-rate-key',3),$clock);
            $access=new NetworkQuest\RecoveryAccountAccess($db,$ledger,$clock);
            $policies=json_decode(file_get_contents($input['root'].'/server/content/save-policy.generated.json'))->policies;
            $repository=new NetworkQuest\SaveRepository($db,$sessions,$security,new NetworkQuest\SaveValidator($policies),[['saveSchemaVersion'=>1,'contentVersion'=>'1.0.0']],$access,$clock);
            $route=new NetworkQuest\Routes\Save($db,$sessions,$security,$repository,$access);
            echo "READY\n"; fflush(STDOUT); if(fgets(STDIN)!=="GO\n") exit(2);
            $body=fopen('php://memory','w+b'); fwrite($body,$input['body']); rewind($body);
            echo json_encode($route->handle('PUT','/save','',$input['fields'],$body,'127.0.0.1'),JSON_THROW_ON_ERROR);
            PHP;
        $workers=[]; $responses=[];
        try {
            foreach ([$this->auth,$second] as $index=>$auth) {
                $process=proc_open([PHP_BINARY,'-d','display_errors=0','-d','log_errors=0','-d','auto_prepend_file=','-d','auto_append_file=','-r',$program],
                    [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,['LANG'=>'C','LC_ALL'=>'C']);
                self::assertIsResource($process); stream_set_timeout($pipes[1],5); stream_set_timeout($pipes[2],5);
                $workers[]=['process'=>$process,'pipes'=>$pipes];
                $changes=$index===1&&$differentKey?['Idempotency-Key'=>'70000000-0000-4000-8000-000000000002']:[];
                $input=['root'=>realpath(__DIR__.'/../..'),'game'=>$this->environment->directory(),'recovery'=>$this->recovery->directory(),
                    'now'=>$this->now,'fields'=>$this->fields($changes,$auth),'body'=>self::payload().($index===1&&$differentBytes?' ':'')];
                fwrite($pipes[0],json_encode($input,JSON_THROW_ON_ERROR)."\n"); fflush($pipes[0]); self::assertSame("READY\n",fgets($pipes[1]));
            }
            foreach ($workers as $worker) { fwrite($worker['pipes'][0],"GO\n"); fflush($worker['pipes'][0]); }
            foreach ($workers as $worker) {
                $responses[]=json_decode(stream_get_contents($worker['pipes'][1]),true,32,JSON_THROW_ON_ERROR);
                self::assertSame('',stream_get_contents($worker['pipes'][2]));
            }
        } finally {
            foreach ($workers as $worker) {
                foreach ($worker['pipes'] as $pipe) fclose($pipe);
                if (proc_get_status($worker['process'])['running']) proc_terminate($worker['process']);
                proc_close($worker['process']);
            }
        }
        $statuses=array_column($responses,'status'); sort($statuses); self::assertSame($expected,$statuses);
        foreach ($responses as $response) $this->response($response,$response['status']);
        self::assertCount(1,$this->slot()); self::assertSame(1,$this->slot()[0]['revision']);
        self::assertSame(1,$this->database->connection()->query('SELECT count(*) FROM write_receipts')->fetchColumn());
        if (!$differentKey&&!$differentBytes) {
            foreach ($responses as $response) self::assertSame(1,json_decode($response['body'],true)['committedRevision']);
            self::assertSame(self::payload(),$this->slot()[0]['payload_json']);
        }
    }
}
