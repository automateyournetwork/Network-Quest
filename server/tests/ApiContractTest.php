<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Application;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Router;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Assert;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__.'/../src/Application.php';
require_once __DIR__.'/Support/TestEnvironment.php';

/** T053-only fixture: actual configured application; newly owned game/recovery files only. */
final class T053ApiFixture
{
    public TestEnvironment $environment;
    public TestEnvironment $recovery;
    public Database $database;
    public Sessions $sessions;
    public DeletionLedger $ledger;
    public array $roots;
    public array $config;
    public string $configFile;
    public string $origin = 'https://game.invalid';
    private ?Application $application = null;

    public function __construct()
    {
        $this->environment = TestEnvironment::create(); $this->environment->connect();
        $this->recovery = TestEnvironment::create(); $this->recovery->connect();
        $this->recovery->writeFile('synthetic.sqlite.lock', '');
        $this->roots = [realpath(__DIR__.'/../..'), realpath(__DIR__.'/../public')];
        $this->database = Database::open($this->environment->directory().'/synthetic.sqlite', $this->roots);
        $this->database->migrate(); $this->sessions = new Sessions($this->database);
        $this->ledger = DeletionLedger::initialize($this->recovery->directory().'/synthetic.sqlite', $this->roots,
            [$this->environment->directory()], new DeletionRetentionPolicy(2592000, 604800, 'synthetic-T053-only'));
        $this->config = ['origin'=>$this->origin, 'gamePath'=>Router::GAME_BASE,
            'databasePath'=>$this->environment->directory().'/synthetic.sqlite',
            'ledgerFile'=>$this->recovery->directory().'/synthetic.sqlite', 'rollbackRoots'=>[$this->environment->directory()],
            'backupSeconds'=>2592000, 'restorationSeconds'=>604800, 'retentionEvidence'=>'synthetic-T053-only',
            'rateKey'=>Security::token(), 'googleClientId'=>'synthetic-T053-google-client',
            'googleClientSecret'=>'synthetic-T053-google-private', 'githubClientId'=>'synthetic-T053-github-client',
            'githubClientSecret'=>'synthetic-T053-github-private',
            'googleCallback'=>$this->origin.Router::API_BASE.'/auth/google/callback',
            'githubCallback'=>$this->origin.Router::API_BASE.'/auth/github/callback'];
        $this->configFile = $this->environment->writeFile('configuration.json', json_encode($this->config, JSON_THROW_ON_ERROR));
    }

    public function startWire(): void
    {
        $this->origin = $this->environment->startConfiguredApi($this->configFile);
        $this->config['origin'] = $this->origin;
        foreach (['google', 'github'] as $provider) $this->config[$provider.'Callback'] = $this->origin.Router::API_BASE.'/auth/'.$provider.'/callback';
        file_put_contents($this->configFile, json_encode($this->config, JSON_THROW_ON_ERROR));
    }

    public function account(string $suffix, string $provider = 'google'): array
    {
        $id = '53000000-0000-4000-8000-'.str_pad($suffix, 12, '0', STR_PAD_LEFT);
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id, time()]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject,display_name) VALUES(?,?,?,?)')
            ->execute([$id, $provider, $provider === 'github' ? '53000'.$suffix : 'synthetic-T053-subject-'.$suffix, 'Synthetic player '.$suffix]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
        $guest = $this->sessions->bootstrap(null);
        $auth = $this->database->immediate(fn (PDO $db) => $this->sessions->rotateWithin($db, $guest['context'], $id));
        return ['id'=>$id, 'context'=>$auth['context'], 'cookie'=>explode(';', $auth['setCookie'])[0], 'csrf'=>$auth['csrfToken']];
    }

    public function fields(array $account): array
    {
        return ['Cookie'=>$account['cookie'], 'Origin'=>$this->origin, 'X-CSRF-Token'=>$account['csrf'], 'Content-Type'=>'application/json'];
    }

    public function request(string $method, string $path, array $fields = [], string $body = '', bool $wire = false): array
    {
        if ($wire) {
            $headers = []; foreach ($fields as $name=>$value) $headers[] = $name.': '.$value;
            return $this->environment->request($method, Router::API_BASE.$path, $headers, $body);
        }
        $this->application ??= Application::fromEnvironment(['NQ_CONFIG_FILE'=>$this->configFile,
            'NQ_DOCUMENT_ROOTS_JSON'=>json_encode($this->roots, JSON_THROW_ON_ERROR)]);
        $stream = fopen('php://memory', 'r+'); fwrite($stream, $body); rewind($stream);
        try {
            $response = $this->application->handleSapi(['REQUEST_METHOD'=>$method, 'REQUEST_URI'=>Router::API_BASE.$path,
                'HTTPS'=>'on', 'HTTP_HOST'=>'game.invalid', 'REMOTE_ADDR'=>'192.0.2.53', 'SERVER_PROTOCOL'=>'HTTP/1.1'],
                ['Host'=>'game.invalid']+$fields+['Content-Length'=>(string)strlen($body)], $stream, 'litespeed');
            $response['headers'] = array_change_key_case($response['headers'], CASE_LOWER);
            return $response;
        } finally { fclose($stream); }
    }

    public static function payload(string $notes = ''): string
    {
        $data = json_decode(file_get_contents(__DIR__.'/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json'));
        $data->notebook->personalNotes = $notes;
        return json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    }

    public function graph(): array
    {
        $snapshot = [];
        foreach (['accounts','identities','preferences','saves','write_receipts','delete_reauth_proofs'] as $table) {
            $snapshot[$table] = $this->database->connection()->query('SELECT * FROM '.$table.' ORDER BY rowid')->fetchAll();
        }
        return $snapshot;
    }

    public function close(): void
    {
        $this->application = null; unset($this->ledger, $this->sessions, $this->database);
        $this->environment->close(); $this->recovery->close();
    }
}

/** Independent response assertions, intentionally not generated from server response builders. */
final class T053Contract
{
    public static function headers(array $response, bool $html = false): void
    {
        $h = $response['headers'];
        Assert::assertSame('no-store', $h['cache-control']);
        Assert::assertSame('no-referrer', $h['referrer-policy']);
        Assert::assertSame('nosniff', $h['x-content-type-options']);
        Assert::assertSame('DENY', $h['x-frame-options']);
        Assert::assertSame('noindex, nofollow', $h['x-robots-tag']);
        Assert::assertStringContainsString("default-src 'none'", $h['content-security-policy']);
        Assert::assertArrayNotHasKey('access-control-allow-origin', $h);
        Assert::assertArrayNotHasKey('location', $h);
        Assert::assertSame($html ? 'text/html; charset=utf-8' : 'application/json; charset=utf-8', $h['content-type']);
        self::uuid($h['x-request-id']);
    }
    public static function keys(array $data, array $expected): void
    {
        $actual = array_keys($data); sort($actual); sort($expected); Assert::assertSame($expected, $actual);
    }
    public static function uuid(mixed $value): void
    {
        Assert::assertIsString($value);
        Assert::assertMatchesRegularExpression('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $value);
    }
    public static function date(mixed $value): void
    {
        Assert::assertIsString($value);
        Assert::assertMatchesRegularExpression('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/D', $value);
        Assert::assertNotFalse(DateTimeImmutable::createFromFormat('!Y-m-d\TH:i:s\Z', $value));
    }
    public static function problem(array $response, int $status, bool $conflict = false): array
    {
        Assert::assertSame($status, $response['status'], $response['body']); self::headers($response);
        $data = json_decode($response['body'], true, 32, JSON_THROW_ON_ERROR);
        self::keys($data, $conflict ? ['code','message','requestId','currentSummary'] : ['code','message','requestId']);
        Assert::assertIsString($data['code']); Assert::assertLessThanOrEqual(96, strlen($data['code']));
        Assert::assertIsString($data['message']); Assert::assertLessThanOrEqual(512, mb_strlen($data['message']));
        Assert::assertSame($response['headers']['x-request-id'], $data['requestId']); self::uuid($data['requestId']);
        if (in_array($status, [429,503], true)) Assert::assertMatchesRegularExpression('/^[1-9][0-9]*$/D', $response['headers']['retry-after']);
        Assert::assertArrayNotHasKey('set-cookie', $response['headers']);
        return $data;
    }
    public static function summary(array $summary): void
    {
        self::keys($summary, ['revision','etag','savedAt','adventureId','episodeId','roomId','outcome','saveSchemaVersion','contentVersion']);
        Assert::assertIsInt($summary['revision']); Assert::assertGreaterThanOrEqual(1, $summary['revision']);
        Assert::assertSame('"save-'.$summary['revision'].'"', $summary['etag']); self::date($summary['savedAt']); self::uuid($summary['adventureId']);
        Assert::assertSame('spec001', $summary['episodeId']); Assert::assertSame('spec001:R01', $summary['roomId']);
        Assert::assertNull($summary['outcome']); Assert::assertSame(1, $summary['saveSchemaVersion']); Assert::assertSame('1.0.0', $summary['contentVersion']);
    }
    public static function noPrivate(array $response, array $secrets): void
    {
        $visible = $response['body'].json_encode($response['headers']);
        foreach ($secrets as $secret) Assert::assertStringNotContainsString($secret, $visible);
        foreach (['SQLSTATE','Stack trace','/private/','client_secret','access_token','refresh_token','id_token'] as $value) Assert::assertStringNotContainsString($value, $visible);
    }
}

final class ApiContractTest extends TestCase
{
    private T053ApiFixture $fixture;
    protected function setUp(): void { $this->fixture = new T053ApiFixture(); }
    protected function tearDown(): void { $this->fixture->close(); }

    public static function operations(): array
    {
        return [
            'getSession'=>['GET','/session',''], 'startAuth'=>['POST','/auth/google/start','{"purpose":"login"}'],
            'authCallback'=>['GET','/auth/google/callback?state=invalid&code=synthetic-T053-private-code',''],
            'logout'=>['POST','/logout',''], 'getSave'=>['GET','/save',''], 'putSave'=>['PUT','/save','{}'],
            'patchPreferences'=>['PATCH','/preferences','{}'], 'deleteAccount'=>['DELETE','/account',''],
            'getDeletionStatus'=>['POST','/account/deletion-status',''],
        ];
    }
    public function testNineOperationInventoryMatchesTheAuthoredContract(): void
    {
        preg_match_all('/^      operationId: (\w+)$/m', file_get_contents(__DIR__.'/../../specs/001-physical-layer-underworld/contracts/game-api.openapi.yaml'), $matches);
        $expected = array_keys(self::operations()); sort($expected); sort($matches[1]);
        self::assertCount(9, $matches[1]); self::assertSame($expected, $matches[1]);
    }

    #[DataProvider('operations')]
    public function testEveryOperationHasAnHonestUnavailableContractWithoutProvisioning(string $method, string $path, string $body): void
    {
        // Break only this owned initialized store. Application must not migrate/repair it on a request.
        $this->fixture->database->connection()->exec("UPDATE schema_migrations SET checksum='".str_repeat('0',64)."' WHERE version=2");
        $before = $this->fixture->graph();
        $response = $this->fixture->request($method, $path, ['Content-Type'=>'application/json'], $body);
        if (str_contains($path, '/callback')) {
            self::assertSame(503, $response['status']); T053Contract::headers($response, true);
            self::assertStringContainsString('<main>', $response['body']); self::assertStringContainsString('<h1>', $response['body']);
        } else T053Contract::problem($response, 503);
        T053Contract::noPrivate($response, [$this->fixture->environment->directory(), 'synthetic-T053-private-code', $this->fixture->config['googleClientSecret']]);
        self::assertSame($before, $this->fixture->graph());
    }

    public function testActualTlsAllNinePathsHaveContractShapesAndIsolatedSideEffects(): void
    {
        $f = $this->fixture; $f->startWire();
        $call = fn (string $method, string $path, array $headers = [], string $body = '') => $f->request($method, $path, $headers, $body, true);
        $guest = $call('GET', '/session'); self::assertSame(200, $guest['status']); T053Contract::headers($guest);
        $g = json_decode($guest['body'], true); T053Contract::keys($g, ['state','csrfToken']); self::assertSame('guest', $g['state']);
        self::assertTrue(Security::isToken($g['csrfToken']));
        $cookie = $guest['headers']['set-cookie'];
        foreach (['; path='.Router::GAME_BASE, '; secure', '; HttpOnly', '; SameSite=Lax'] as $attribute) self::assertStringContainsString(strtolower($attribute), strtolower($cookie));
        self::assertStringNotContainsString('domain=', strtolower($cookie));
        $guestFields = ['Cookie'=>explode(';', $cookie)[0], 'Origin'=>$f->origin, 'X-CSRF-Token'=>$g['csrfToken'], 'Content-Type'=>'application/json'];
        foreach (['google'=>'accounts.google.com','github'=>'github.com'] as $provider=>$host) {
            $start = $call('POST', '/auth/'.$provider.'/start', $guestFields, '{"purpose":"login"}');
            self::assertSame(200, $start['status']); T053Contract::headers($start);
            $data = json_decode($start['body'], true); T053Contract::keys($data, ['authorizationUrl','expiresAt']); T053Contract::date($data['expiresAt']);
            self::assertSame('https', parse_url($data['authorizationUrl'], PHP_URL_SCHEME)); self::assertSame($host, parse_url($data['authorizationUrl'], PHP_URL_HOST));
            parse_str(parse_url($data['authorizationUrl'], PHP_URL_QUERY), $query); self::assertSame('S256', $query['code_challenge_method']);
            self::assertSame($f->config[$provider.'Callback'], $query['redirect_uri']);
            $callbackPath = '/auth/'.$provider.'/callback?state='.$query['state'].'&error=access_denied&error_description=synthetic-T053-private-provider-detail';
            $cancel = $call('GET', $callbackPath, ['Cookie'=>$guestFields['Cookie']]);
            self::assertSame(200, $cancel['status']); T053Contract::headers($cancel, true);
            self::assertStringContainsString('canceled', $cancel['body']); self::assertStringContainsString('network-quest-auth-complete', $cancel['body']);
            self::assertArrayNotHasKey('set-cookie', $cancel['headers']);
            T053Contract::noPrivate($cancel, [$query['state'],$g['csrfToken'],'synthetic-T053-private-provider-detail']);
            $replay = $call('GET', $callbackPath, ['Cookie'=>$guestFields['Cookie']]);
            self::assertSame(400, $replay['status']); T053Contract::headers($replay, true);
        }

        // Identity rows and deletion proof are prepared data. No HTTP test-auth path exists.
        $a = $f->account('1'); $b = $f->account('2', 'github'); $headers = $f->fields($a);
        T053Contract::problem($call('GET', '/save', $headers), 404);
        $writeFields = $headers+['If-None-Match'=>'*','X-Save-Mode'=>'manual','Idempotency-Key'=>'53000000-0000-4000-8000-000000000101'];
        $raw = T053ApiFixture::payload('synthetic-T053-private-player-note');
        $saved = $call('PUT', '/save', $writeFields, $raw); self::assertSame(201, $saved['status']); T053Contract::headers($saved);
        $ack = json_decode($saved['body'], true); T053Contract::keys($ack, ['requestId','committedRevision','committedAt','replayed','currentSummary']);
        self::assertSame($writeFields['Idempotency-Key'], $ack['requestId']); self::assertSame(1, $ack['committedRevision']); self::assertFalse($ack['replayed']);
        T053Contract::date($ack['committedAt']); T053Contract::summary($ack['currentSummary']); self::assertSame('"save-1"', $saved['headers']['etag']);
        T053Contract::noPrivate($saved, [$a['id'], $a['csrf'], 'synthetic-T053-private-player-note']);
        $replayed = $call('PUT', '/save', $writeFields, $raw); self::assertSame(200, $replayed['status']); T053Contract::headers($replayed);
        self::assertTrue(json_decode($replayed['body'], true)['replayed']);
        $read = $call('GET', '/save', $headers); self::assertSame(200, $read['status']); T053Contract::headers($read);
        $slot = json_decode($read['body'], true); T053Contract::keys($slot, ['summary','snapshot']); T053Contract::summary($slot['summary']);
        self::assertSame(json_decode($raw, true), $slot['snapshot']); self::assertSame('"save-1"', $read['headers']['etag']);
        T053Contract::problem($call('GET', '/save', $f->fields($b)), 404);
        $prefs = $call('PATCH', '/preferences', $headers+['If-Match'=>'"prefs-1"'], '{"textScale":1.5,"captions":false}');
        self::assertSame(200, $prefs['status']); T053Contract::headers($prefs);
        $p = json_decode($prefs['body'], true); T053Contract::keys($p, ['revision','etag','values']);
        self::assertSame(2, $p['revision']); self::assertSame('"prefs-2"', $p['etag']); self::assertSame($p['etag'], $prefs['headers']['etag']);
        T053Contract::keys($p['values'], ['autosaveEnabled','musicVolume','effectsVolume','voiceVolume','captions','reducedMotion','textScale']);
        self::assertSame(1.5, $p['values']['textScale']); self::assertFalse($p['values']['captions']); self::assertFalse($p['values']['autosaveEnabled']);
        $session = $call('GET', '/session', $headers); T053Contract::headers($session);
        $s = json_decode($session['body'], true); T053Contract::keys($s, ['state','csrfToken','provider','displayName','expiresAt','preferences','saveSummary']);
        self::assertSame('authenticated', $s['state']); self::assertSame('google', $s['provider']); self::assertSame($a['csrf'], $s['csrfToken']);
        T053Contract::date($s['expiresAt']); T053Contract::summary($s['saveSummary']); self::assertSame($p, $s['preferences']);
        T053Contract::noPrivate($session, [$a['id'],'synthetic-T053-subject-1','synthetic-T053-private-player-note']);

        $beforeLogout = $f->graph(); $logout = $call('POST', '/logout', $headers);
        self::assertSame(204, $logout['status']); T053Contract::headers($logout); self::assertSame('', $logout['body']);
        self::assertStringContainsString('Max-Age=0', $logout['headers']['set-cookie']); self::assertSame($beforeLogout, $f->graph());
        T053Contract::problem($call('GET', '/save', $headers), 401);
        $receipt = Security::token(); $deleteFields = $f->fields($b)+['X-Confirm-Account-Deletion'=>'delete-my-account','X-Deletion-Receipt'=>$receipt];
        T053Contract::problem($call('DELETE', '/account', $deleteFields), 403);
        $f->database->connection()->prepare('INSERT INTO delete_reauth_proofs(session_hash,account_id,confirmed_at,expires_at) VALUES(?,?,?,?)')
            ->execute([$b['context']->idHash,$b['id'],time(),time()+300]);
        $deleted = $call('DELETE', '/account', $deleteFields); self::assertSame(204, $deleted['status']); T053Contract::headers($deleted); self::assertSame('', $deleted['body']);
        self::assertArrayNotHasKey('set-cookie', $deleted['headers']);
        $status = $call('POST', '/account/deletion-status', ['Origin'=>$f->origin,'X-Deletion-Receipt'=>$receipt]);
        self::assertSame(200, $status['status']); T053Contract::headers($status);
        $d = json_decode($status['body'], true); T053Contract::keys($d, ['state','expiresAt']); self::assertSame('completed', $d['state']); T053Contract::date($d['expiresAt']);
        self::assertArrayNotHasKey('retry-after', $status['headers']); T053Contract::noPrivate($status, [$receipt,$a['id'],$b['id'],$b['csrf'],'synthetic-T053-private-player-note']);
        self::assertSame(1, $f->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(1, $f->database->connection()->query('SELECT count(*) FROM saves')->fetchColumn());
        self::assertSame('', $f->environment->diagnostics(), 'Only local proxy diagnostics are asserted; production log retention is separate.');
    }

    public static function ordinaryFailures(): array
    {
        return [
            'start malformed'=>['POST','/auth/google/start','{}','',400],
            'start guest delete purpose'=>['POST','/auth/github/start','{"purpose":"delete-reauth"}','guest',401],
            'start CSRF'=>['POST','/auth/google/start','{"purpose":"login"}','csrf',403],
            'logout expired authority'=>['POST','/logout','','anonymous',401],
            'logout Origin'=>['POST','/logout','','origin',403],
            'preferences malformed'=>['PATCH','/preferences','{"accountId":"synthetic-T053-private-selector"}','',400],
            'preferences anonymous'=>['PATCH','/preferences','{"captions":false}','anonymous',401],
            'preferences CSRF'=>['PATCH','/preferences','{"captions":false}','csrf',403],
            'preferences stale'=>['PATCH','/preferences','{"captions":false}','stale',412],
            'preferences no condition'=>['PATCH','/preferences','{"captions":false}','no-condition',428],
            'delete malformed receipt'=>['DELETE','/account','','receipt',400],
            'delete anonymous'=>['DELETE','/account','','anonymous',401],
            'delete ordinary login'=>['DELETE','/account','','',403],
            'status malformed receipt'=>['POST','/account/deletion-status','','receipt',400],
            'status Origin'=>['POST','/account/deletion-status','','origin',403],
            'status unknown'=>['POST','/account/deletion-status','','',404],
        ];
    }
    #[DataProvider('ordinaryFailures')]
    public function testDocumentedErrorsPreserveAccountGraphsAndUseBoundedProblemShapes(string $method,string $path,string $body,string $change,int $status): void
    {
        $a=$this->fixture->account('21'); $b=$this->fixture->account('22');
        $receipt=Security::token();
        $fields=$this->fixture->fields($a);
        if ($path==='/preferences') $fields['If-Match']='"prefs-1"';
        if ($path==='/account' || $path==='/account/deletion-status') $fields['X-Deletion-Receipt']=$receipt;
        if ($path==='/account') $fields['X-Confirm-Account-Deletion']='delete-my-account';
        if ($change==='anonymous') unset($fields['Cookie']);
        if ($change==='csrf') $fields['X-CSRF-Token']=$b['csrf'];
        if ($change==='origin') $fields['Origin']='https://attacker.invalid';
        if ($change==='receipt') $fields['X-Deletion-Receipt']='synthetic-T053-private-invalid-receipt';
        if ($change==='stale') $fields['If-Match']='"prefs-8"';
        if ($change==='no-condition') unset($fields['If-Match']);
        if ($change==='guest') {
            $guest=$this->fixture->sessions->bootstrap(null);
            $fields['Cookie']=explode(';',$guest['setCookie'])[0]; $fields['X-CSRF-Token']=$guest['csrfToken'];
        }
        $before=$this->fixture->graph(); $response=$this->fixture->request($method,$path,$fields,$body);
        T053Contract::problem($response,$status);
        T053Contract::noPrivate($response,[$receipt,$a['id'],$b['id'],$a['csrf'],$b['csrf'],'synthetic-T053-private']);
        self::assertSame($before,$this->fixture->graph());
    }

    public static function limitedOperations(): array
    {
        return [
            'auth start'=>['POST','/auth/github/start','{"purpose":"login"}',5,200],
            'save'=>['PUT','/save','{',60,400],
            'preferences'=>['PATCH','/preferences','{}',60,400],
            'deletion'=>['DELETE','/account','',3,403],
            'deletion status'=>['POST','/account/deletion-status','',30,404],
        ];
    }
    #[DataProvider('limitedOperations')]
    public function testAllFiveRateLimitedOperationsReturnRetryAfterWithoutPlayerMutation(string $method,string $path,string $body,int $limit,int $priorStatus): void
    {
        $a=$this->fixture->account('31'); $fields=$this->fixture->fields($a);
        $fields+=['If-Match'=>$path==='/preferences' ? '"prefs-1"' : '"save-1"',
            'X-Save-Mode'=>'manual','Idempotency-Key'=>'53000000-0000-4000-8000-000000000131',
            'X-Deletion-Receipt'=>Security::token(),'X-Confirm-Account-Deletion'=>'delete-my-account'];
        $before=$this->fixture->graph();
        // Seed only the already elapsed allowance using the actual Security limiter in this
        // account/source window. One boundary request goes through actual application routing.
        // This avoids wall-clock-window flakes from dozens of slow provider-start requests.
        $security=new Security($this->fixture->database,$this->fixture->origin,
            base64_decode(strtr($this->fixture->config['rateKey'],'-_','+/').'=',true));
        $operation=match ($path) { '/save'=>'save','/preferences'=>'preferences','/account'=>'deletion','/account/deletion-status'=>'deletion-status',default=>'auth-start' };
        for ($i=0;$i<$limit-1;$i++) $security->limit($operation,$a['context'],'192.0.2.53',hash('sha256',$fields['X-Deletion-Receipt']));
        $last=$this->fixture->request($method,$path,$fields,$body); self::assertSame($priorStatus,$last['status'],$last['body']);
        $denied=$this->fixture->request($method,$path,$fields,$body); T053Contract::problem($denied,429);
        self::assertLessThanOrEqual($path==='/account' ? 3600 : (str_contains($path,'/auth/') ? 600 : 60),(int)$denied['headers']['retry-after']);
        self::assertSame($before,$this->fixture->graph());
        T053Contract::noPrivate($denied,[$a['id'],$a['csrf'],$fields['X-Deletion-Receipt']]);
    }

    public function testPendingStatusAndReceiptConflictHaveDistinctNarrowContracts(): void
    {
        $a=$this->fixture->account('41'); $receipt=Security::token();
        $otherId='53000000-0000-4000-8000-000000000999';
        $this->fixture->ledger->exclusive(fn ()=>$this->fixture->ledger->accept($otherId,hash('sha256',$receipt),time()));
        $before=$this->fixture->graph();
        $pending=$this->fixture->request('POST','/account/deletion-status',['Origin'=>$this->fixture->origin,'X-Deletion-Receipt'=>$receipt]);
        self::assertSame(200,$pending['status']); T053Contract::headers($pending);
        $data=json_decode($pending['body'],true); T053Contract::keys($data,['state','expiresAt']); self::assertSame('pending',$data['state']); T053Contract::date($data['expiresAt']);
        self::assertGreaterThanOrEqual(2,(int)$pending['headers']['retry-after']); self::assertSame($before,$this->fixture->graph());
        $this->fixture->database->connection()->prepare('INSERT INTO delete_reauth_proofs(session_hash,account_id,confirmed_at,expires_at) VALUES(?,?,?,?)')
            ->execute([$a['context']->idHash,$a['id'],time(),time()+300]);
        $before=$this->fixture->graph();
        $conflict=$this->fixture->request('DELETE','/account',$this->fixture->fields($a)+[
            'X-Deletion-Receipt'=>$receipt,'X-Confirm-Account-Deletion'=>'delete-my-account']);
        T053Contract::problem($conflict,409); self::assertSame($before,$this->fixture->graph());
        T053Contract::noPrivate($conflict,[$receipt,$a['id'],$otherId,$a['csrf']]);
    }

    public function testParsedWireOriginRejectionsMatchProblemContractAndRevealNoHeaders(): void
    {
        $f=$this->fixture; $f->startWire(); $a=$f->account('51'); $receipt=Security::token(); $before=$f->graph();
        foreach ([['PUT','/save',T053ApiFixture::payload('synthetic-T053-private-note')],['POST','/account/deletion-status','']] as [$method,$path,$body]) {
            $fields=array_replace($f->fields($a),['Origin'=>'https://synthetic-T053-private-attacker.invalid','X-Deletion-Receipt'=>$receipt]);
            $response=$f->request($method,$path,$fields,$body,true); T053Contract::problem($response,403);
            T053Contract::noPrivate($response,[$receipt,$a['id'],$a['csrf'],'synthetic-T053-private']);
        }
        self::assertSame($before,$f->graph()); self::assertSame('',$f->environment->diagnostics());
    }

    public function testDisposableNamespacesNeverAdoptEachOthersSessionOrStorage(): void
    {
        $other=new T053ApiFixture();
        try {
            $a=$this->fixture->account('61'); $before=$this->fixture->graph();
            self::assertNotSame($this->fixture->environment->directory(),$other->environment->directory());
            foreach ([$this->fixture,$other] as $f) {
                self::assertSame(0700,fileperms($f->environment->directory()) & 0777);
                self::assertSame(0600,fileperms($f->config['databasePath']) & 0777);
                self::assertFalse(str_starts_with($f->config['databasePath'],realpath(__DIR__.'/../..').'/'));
                self::assertFalse(str_starts_with($f->config['ledgerFile'],$f->environment->directory().'/'));
            }
            T053Contract::problem($other->request('GET','/save',$this->fixture->fields($a)),401);
            T053Contract::problem($other->request('PUT','/save',$this->fixture->fields($a)+[
                'If-None-Match'=>'*','X-Save-Mode'=>'manual','Idempotency-Key'=>'53000000-0000-4000-8000-000000000161'],T053ApiFixture::payload()),401);
            self::assertSame($before,$this->fixture->graph());
            foreach ($other->graph() as $rows) self::assertSame([],$rows);
        } finally { $other->close(); }
    }
}
