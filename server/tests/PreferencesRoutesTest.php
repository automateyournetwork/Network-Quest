<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Routes\Preferences;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['AccountAccess','Database','Security','Sessions','DeletionLedger','RecoveryAccountAccess','Routes/Preferences'] as $file) require_once __DIR__ . '/../src/' . $file . '.php';

final class PreferencesRouteAccessProbe implements AccountAccess
{
    public int $calls = 0;
    public ?Closure $before = null;
    public function __construct(private Database $database, private ?AccountAccess $delegate = null) {}
    public function run(callable $operation): mixed
    {
        TestCase::assertFalse($this->database->connection()->inTransaction());
        ++$this->calls; if ($this->before !== null) ($this->before)($this->calls);
        return $this->delegate === null ? $operation() : $this->delegate->run($operation);
    }
}

final class PreferencesRoutesTest extends TestCase
{
    private TestEnvironment $environment;
    private TestEnvironment $recovery;
    private DeletionLedger $ledger;
    private Database $database;
    private Sessions $sessions;
    private Security $security;
    private PreferencesRouteAccessProbe $access;
    private array $auth;
    private int $now = 1795737600;
    private const ACCOUNT = '60000000-0000-4000-8000-000000000001';
    private const ORIGIN = 'https://network-quest.invalid';
    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create(); $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')]); $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn (): int => $this->now);
        $this->security = new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key',3), fn (): int => $this->now);
        $this->recovery=TestEnvironment::create(); $this->recovery->connect(); $this->recovery->writeFile('synthetic.sqlite.lock','');
        $this->ledger=DeletionLedger::initialize($this->recovery->directory() . '/synthetic.sqlite',[realpath(__DIR__ . '/../..')],[$this->environment->directory()],
            new DeletionRetentionPolicy(30*86400,7*86400,'synthetic-route-test-not-host-retention'));
        $this->access = new PreferencesRouteAccessProbe($this->database,new RecoveryAccountAccess($this->database,$this->ledger,fn (): int=>$this->now));
        $this->auth = $this->account(self::ACCOUNT);
    }
    protected function tearDown(): void { unset($this->access,$this->ledger,$this->security,$this->sessions,$this->database); $this->environment->close(); $this->recovery->close(); }
    private function account(string $id): array
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id,$this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$id,'google','synthetic-' . $id]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo): array => $this->sessions->rotateWithin($pdo,$guest['context'],$id));
    }
    private function fields(array $changes = [], ?array $auth = null): array
    {
        $auth ??= $this->auth;
        $fields = ['Origin'=>self::ORIGIN,'Cookie'=>explode(';',$auth['setCookie'],2)[0],'X-CSRF-Token'=>$auth['csrfToken'],'Content-Type'=>'application/json','If-Match'=>'"prefs-1"'];
        foreach ($changes as $name=>$value) { if ($value === null) unset($fields[$name]); else $fields[$name]=$value; }
        return array_map(fn ($name)=>[$name,$fields[$name]],array_keys($fields));
    }
    private function request(string $raw = '{"autosaveEnabled":true}', ?array $fields = null, string $method = 'PATCH', string $query = ''): array
    {
        $stream=fopen('php://memory','w+b'); fwrite($stream,$raw); rewind($stream);
        try { return (new Preferences($this->database,$this->sessions,$this->security,$this->access))->handle($method,'/preferences',$query,$fields ?? $this->fields(),$stream,'127.0.0.1'); }
        finally { fclose($stream); }
    }
    private function response(array $response,int $status): array
    {
        self::assertSame($status,$response['status']); self::assertSame('no-store',$response['headers']['Cache-Control']);
        self::assertSame('application/json; charset=utf-8',$response['headers']['Content-Type']);
        $data=json_decode($response['body'],true,512,JSON_THROW_ON_ERROR);
        if ($status >= 400) { self::assertSame(['code','message','requestId'],array_keys($data)); self::assertSame($response['headers']['X-Request-Id'],$data['requestId']); }
        else self::assertSame(['revision','etag','values'],array_keys($data));
        return $data;
    }
    private function rows(): array { return $this->database->connection()->query('SELECT * FROM preferences ORDER BY account_id')->fetchAll(); }

    public function testPatchPreservesUnmentionedValuesAndNeverWritesAdventure(): void
    {
        $pdo=$this->database->connection(); $pdo->exec("UPDATE preferences SET music_volume=0.25,effects_volume=0.5,voice_volume=0.75,captions=0,reduced_motion='on',text_scale=1.5");
        $data=$this->response($response=$this->request(),200);
        self::assertSame(2,$data['revision']); self::assertSame('"prefs-2"',$data['etag']); self::assertSame($data['etag'],$response['headers']['ETag']);
        self::assertSame(['autosaveEnabled'=>true,'musicVolume'=>0.25,'effectsVolume'=>0.5,'voiceVolume'=>0.75,'captions'=>false,'reducedMotion'=>'on','textScale'=>1.5],$data['values']);
        self::assertSame(0,$pdo->query('SELECT count(*) FROM saves')->fetchColumn()); self::assertSame(0,$pdo->query('SELECT count(*) FROM write_receipts')->fetchColumn());
        $before=$this->rows(); $this->response($this->request(),412); self::assertSame($before,$this->rows());
    }

    public static function invalidPatches(): iterable
    {
        foreach (['{}','[]','null','{"unknown":true}','{"accountId":"other"}','{"revision":2}','{"autosaveEnabled":1}','{"captions":"true"}',
            '{"musicVolume":-0.01}','{"effectsVolume":1.01}','{"voiceVolume":null}','{"textScale":0.99}','{"textScale":2.01}',
            '{"textScale":1e999}','{"reducedMotion":"auto"}','{"autosaveEnabled":true,"autosaveEnabled":false}',
            '{"captions":true,"\\u0063aptions":false}','{"musicVolume":[]}','{"musicVolume":{}}','{',"\xff"] as $raw) yield $raw=>[$raw];
    }
    #[DataProvider('invalidPatches')]
    public function testStrictFlatKnownBoundedPatch(string $raw): void
    {
        $before=$this->rows(); $this->response($this->request($raw),400); self::assertSame($before,$this->rows());
    }

    public function testKnownBoundaryValuesAndEscapedKeysAreAccepted(): void
    {
        $data=$this->response($this->request('{"autosaveEnabled":false,"musicVolume":0,"effectsVolume":1,"voiceVolume":0.5,"\\u0063aptions":true,"reducedMotion":"off","textScale":2}'),200);
        self::assertFalse($data['values']['autosaveEnabled']); self::assertSame(0,$data['values']['musicVolume']); self::assertSame(2,$data['values']['textScale']);
        $data=$this->response($this->request('{"textScale":1,"reducedMotion":"system"}',$this->fields(['If-Match'=>'"prefs-2"'])),200);
        self::assertSame(1,$data['values']['textScale']);
    }

    public static function headerCases(): iterable
    {
        yield 'missing' => [['If-Match'=>null],428];
        yield 'both' => [['If-None-Match'=>'*'],400];
        yield 'weak' => [['If-Match'=>'W/"prefs-1"'],400];
        yield 'wildcard' => [['If-Match'=>'*'],400];
        yield 'zero' => [['If-Match'=>'"prefs-0"'],400];
        yield 'leading-zero' => [['If-Match'=>'"prefs-01"'],400];
        yield 'list' => [['If-Match'=>'"prefs-1", "prefs-2"'],400];
        yield 'overflow' => [['If-Match'=>'"prefs-9007199254740992"'],400];
        yield 'wrong-resource' => [['If-Match'=>'"save-1"'],400];
        yield 'csrf' => [['X-CSRF-Token'=>null],403];
        yield 'origin' => [['Origin'=>self::ORIGIN . '/'],403];
        yield 'session' => [['Cookie'=>null],401];
        yield 'media' => [['Content-Type'=>'application/json; charset=latin1'],400];
        yield 'compressed' => [['Content-Encoding'=>'gzip'],400];
        yield 'length' => [['Content-Length'=>'2'],400];
    }
    #[DataProvider('headerCases')]
    public function testConditionalAndAdmissionFailuresLeaveValuesUnchanged(array $changes,int $status): void
    {
        $before=$this->rows(); $this->response($this->request(fields:$this->fields($changes)),$status); self::assertSame($before,$this->rows());
    }

    public function testDuplicateHeadersQueryMethodsAndBodyBounds(): void
    {
        $fields=$this->fields(); $fields[]=['if-match','"prefs-1"']; $this->response($this->request(fields:$fields),400);
        $this->response($this->request(query:'accountId=other'),400); $this->response($this->request(method:'POST'),400);
        $this->response($this->request(str_repeat(' ',4097)),413); self::assertSame(1,$this->rows()[0]['revision']);
    }

    public function testAccountIsolationAndMissingRowNeverRecreatesDefaults(): void
    {
        $other=$this->account('60000000-0000-4000-8000-000000000002'); $this->response($this->request(fields:$this->fields([],$other)),200);
        self::assertSame(0,$this->rows()[0]['autosave_enabled']); self::assertSame(1,$this->rows()[1]['autosave_enabled']);
        $this->database->connection()->prepare('DELETE FROM preferences WHERE account_id=?')->execute([self::ACCOUNT]);
        $this->response($this->request(),503); self::assertCount(1,$this->rows());
    }

    public function testRateLimitAndRevisionExhaustionFailWithoutMutation(): void
    {
        for ($i=1;$i<=60;++$i) $this->response($this->request(fields:$this->fields(['If-Match'=>'"prefs-' . $i . '"'])),200);
        $this->response($response=$this->request(),429); self::assertGreaterThanOrEqual(1,(int)$response['headers']['Retry-After']);
        $this->now+=60; $this->database->connection()->exec('UPDATE preferences SET revision=9007199254740991'); $before=$this->rows();
        $this->response($this->request(fields:$this->fields(['If-Match'=>'"prefs-9007199254740991"'])),503); self::assertSame($before,$this->rows());
    }

    public function testRecoveryMarkerPreventsPreferenceWriteAndNoDefaultsReappear(): void
    {
        $this->ledger->exclusive(fn ()=>$this->ledger->accept(self::ACCOUNT,str_repeat('f',64),$this->now));
        $this->response($this->request(),401); self::assertSame([],$this->rows());
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testSessionExpiryAtFinalTransactionAndFailurePreservePreferences(): void
    {
        $before=$this->rows(); $calls=0;
        $sessions=new Sessions($this->database,function () use (&$calls): int { return $this->now+(++$calls===1?0:7201); });
        $stream=fopen('php://memory','w+b'); fwrite($stream,'{"autosaveEnabled":true}'); rewind($stream);
        try { $response=(new Preferences($this->database,$sessions,$this->security,$this->access))->handle('PATCH','/preferences','',$this->fields(),$stream,'127.0.0.1'); }
        finally { fclose($stream); }
        $this->response($response,401); self::assertSame(2,$calls); self::assertSame($before,$this->rows());
        $pdo=$this->database->connection();
        $pdo->exec("CREATE TRIGGER synthetic_preferences_failure BEFORE UPDATE ON preferences BEGIN SELECT RAISE(ABORT,'private synthetic SQL error'); END");
        $this->response($failure=$this->request(),503); self::assertStringNotContainsString('private synthetic',$failure['body']); self::assertSame($before,$this->rows());
    }

    public function testFractionRoundTripMatchesTheCommittedPreferenceValue(): void
    {
        $number=0.12345678901234567;
        $data=$this->response($this->request(json_encode(['musicVolume'=>$number],JSON_THROW_ON_ERROR)),200);
        self::assertSame($number,$data['values']['musicVolume']);
        self::assertSame($number,$this->rows()[0]['music_volume']);
    }

    public function testIndependentOverlappingProcessesHaveOnePreferenceWinner(): void
    {
        // Two independent processes wait at a common release point; both reviewed revision1.
        // This executes actual route/recovery/storage classes, not a live HTTP adapter.
        $guest=$this->sessions->bootstrap(null);
        $second=$this->database->immediate(fn (PDO $pdo): array=>$this->sessions->rotateWithin($pdo,$guest['context'],self::ACCOUNT));
        $program= <<<'PHP'
            $input=json_decode(fgets(STDIN),true,32,JSON_THROW_ON_ERROR);
            foreach (['AccountAccess','Database','Security','Sessions','DeletionLedger','RecoveryAccountAccess','Routes/Preferences'] as $file) require $input['root'].'/server/src/'.$file.'.php';
            $db=NetworkQuest\Database::open($input['game'].'/synthetic.sqlite',[$input['root']]);
            $ledger=NetworkQuest\DeletionLedger::open($input['recovery'].'/synthetic.sqlite',[$input['root']],[$input['game']],new NetworkQuest\DeletionRetentionPolicy(30*86400,7*86400,'synthetic-route-test-not-host-retention'));
            $clock=fn()=>$input['now']; $sessions=new NetworkQuest\Sessions($db,$clock);
            $security=new NetworkQuest\Security($db,'https://network-quest.invalid',str_repeat('synthetic-rate-key',3),$clock);
            $access=new NetworkQuest\RecoveryAccountAccess($db,$ledger,$clock);
            $route=new NetworkQuest\Routes\Preferences($db,$sessions,$security,$access);
            echo "READY\n"; fflush(STDOUT); if(fgets(STDIN)!=="GO\n") exit(2);
            $body=fopen('php://memory','w+b'); fwrite($body,$input['body']); rewind($body);
            echo json_encode($route->handle('PATCH','/preferences','',$input['fields'],$body,'127.0.0.1'),JSON_THROW_ON_ERROR);
            PHP;
        $workers=[]; $responses=[];
        try {
            foreach ([$this->auth,$second] as $index=>$auth) {
                $process=proc_open([PHP_BINARY,'-d','display_errors=0','-d','log_errors=0','-d','auto_prepend_file=','-d','auto_append_file=','-r',$program],
                    [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,null,['LANG'=>'C','LC_ALL'=>'C']);
                self::assertIsResource($process); stream_set_timeout($pipes[1],5); stream_set_timeout($pipes[2],5);
                $workers[]=['process'=>$process,'pipes'=>$pipes];
                $input=['root'=>realpath(__DIR__.'/../..'),'game'=>$this->environment->directory(),'recovery'=>$this->recovery->directory(),
                    'now'=>$this->now,'fields'=>$this->fields([],$auth),'body'=>json_encode(['musicVolume'=>$index===0?0.25:0.75,'voiceVolume'=>$index===0?0.3:0.7])];
                fwrite($pipes[0],json_encode($input,JSON_THROW_ON_ERROR)."\n"); fflush($pipes[0]);
                self::assertSame("READY\n",fgets($pipes[1]));
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
        $statuses=array_column($responses,'status'); sort($statuses); self::assertSame([200,412],$statuses);
        $winner=$responses[0]['status']===200?0:1;
        $this->response($responses[$winner],200); $this->response($responses[1-$winner],412);
        $row=$this->rows()[0]; self::assertSame(2,$row['revision']);
        self::assertSame($winner===0?0.25:0.75,$row['music_volume']); self::assertSame($winner===0?0.3:0.7,$row['voice_volume']);
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM saves')->fetchColumn());
    }
}
