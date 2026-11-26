<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Application;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Router;
use NetworkQuest\Sessions;
use NetworkQuest\Security;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__.'/../src/Application.php';
require_once __DIR__.'/Support/TestEnvironment.php';

final class ApplicationTest extends TestCase
{
    private TestEnvironment $environment;
    private TestEnvironment $recovery;
    private Database $database;
    private array $data;
    private array $roots;
    private string $config;
    protected function setUp(): void
    {
        $this->environment=TestEnvironment::create(); $this->environment->connect();
        $this->recovery=TestEnvironment::create(); $this->recovery->connect(); $this->recovery->writeFile('synthetic.sqlite.lock','');
        $this->roots=[realpath(__DIR__.'/../..'),realpath(__DIR__.'/../public')];
        $this->database=Database::open($this->environment->directory().'/synthetic.sqlite',$this->roots); $this->database->migrate();
        $ledger=DeletionLedger::initialize($this->recovery->directory().'/synthetic.sqlite',$this->roots,[$this->environment->directory()],new DeletionRetentionPolicy(2592000,604800,'synthetic-application-test')); unset($ledger);
        $this->data=['origin'=>'https://game.invalid','gamePath'=>Router::GAME_BASE,'databasePath'=>$this->environment->directory().'/synthetic.sqlite',
            'ledgerFile'=>$this->recovery->directory().'/synthetic.sqlite','rollbackRoots'=>[$this->environment->directory()],
            'backupSeconds'=>2592000,'restorationSeconds'=>604800,'retentionEvidence'=>'synthetic-application-test',
            'rateKey'=>rtrim(strtr(base64_encode(str_repeat('s',32)),'+/','-_'),'='),'googleClientId'=>'synthetic-google-client',
            'googleClientSecret'=>'synthetic-google-secret','googleCallback'=>'https://game.invalid'.Router::API_BASE.'/auth/google/callback',
            'githubClientId'=>'synthetic-github-client','githubClientSecret'=>'synthetic-github-secret','githubCallback'=>'https://game.invalid'.Router::API_BASE.'/auth/github/callback'];
        $this->config=$this->environment->writeFile('configuration.json',json_encode($this->data,JSON_THROW_ON_ERROR));
    }
    protected function tearDown(): void { unset($this->database); $this->environment->close(); $this->recovery->close(); }
    private function environment(): array { return ['NQ_CONFIG_FILE'=>$this->config,'NQ_DOCUMENT_ROOTS_JSON'=>json_encode($this->roots)]; }
    private function request(Application $app,string $method,string $path,array $fields=[],string $body='',string $sapi='litespeed'): array
    {
        $stream=fopen('php://memory','r+'); fwrite($stream,$body); rewind($stream);
        try { return $app->handleSapi(['REQUEST_METHOD'=>$method,'REQUEST_URI'=>Router::API_BASE.$path,'HTTPS'=>'on','HTTP_HOST'=>'game.invalid','REMOTE_ADDR'=>'192.0.2.41','SERVER_PROTOCOL'=>'HTTP/1.1'],['Host'=>'game.invalid']+$fields+['Content-Length'=>(string)strlen($body)],$stream,$sapi); }
        finally { fclose($stream); }
    }
    public function testFactoryUsesActualRecoveryAndAdaptersForGuestStartCancelWithoutNetwork(): void
    {
        $app=Application::fromEnvironment($this->environment());
        $guest=$this->request($app,'GET','/session'); self::assertSame(200,$guest['status']);
        $cookie=explode(';',$guest['headers']['Set-Cookie'])[0]; $csrf=json_decode($guest['body'],true)['csrfToken'];
        foreach (['google','github'] as $provider) {
            $start=$this->request($app,'POST','/auth/'.$provider.'/start',['Cookie'=>$cookie,'Origin'=>'https://game.invalid','X-CSRF-Token'=>$csrf,'Content-Type'=>'application/json'],'{"purpose":"login"}');
            self::assertSame(200,$start['status']); parse_str(parse_url(json_decode($start['body'],true)['authorizationUrl'],PHP_URL_QUERY),$query);
            self::assertSame($this->data[$provider.'Callback'],$query['redirect_uri']);
            $cancel=$this->request($app,'GET','/auth/'.$provider.'/callback?state='.$query['state'].'&error=access_denied',['Cookie'=>$cookie]);
            self::assertSame(200,$cancel['status']); self::assertStringContainsString('canceled',$cancel['body']);
            self::assertSame(400,$this->request($app,'GET','/auth/'.$provider.'/callback?state='.$query['state'].'&error=access_denied',['Cookie'=>$cookie])['status']);
        }
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(2,$this->database->connection()->query('SELECT count(*) FROM schema_migrations')->fetchColumn());
    }
    public function testActualSaveAndPreferencesHandlersAreJoinedWithServerOwnedAccount(): void
    {
        $pdo=$this->database->connection(); $id='60000000-0000-4000-8000-000000000041';
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id,time()]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$id,'google','synthetic-subject']);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
        $sessions=new Sessions($this->database); $guest=$sessions->bootstrap(null);
        $auth=$this->database->immediate(fn(PDO $p)=>$sessions->rotateWithin($p,$guest['context'],$id));
        $fields=['Cookie'=>explode(';',$auth['setCookie'])[0],'Origin'=>'https://game.invalid','X-CSRF-Token'=>$auth['csrfToken'],'Content-Type'=>'application/json'];
        $app=Application::fromEnvironment($this->environment());
        self::assertSame(404,$this->request($app,'GET','/save',$fields)['status']);
        $saved=$this->request($app,'PUT','/save',$fields+['If-None-Match'=>'*','Idempotency-Key'=>'70000000-0000-4000-8000-000000000041','X-Save-Mode'=>'manual'],file_get_contents(__DIR__.'/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json'));
        self::assertSame(201,$saved['status'],$saved['body']);
        self::assertSame(200,$this->request($app,'GET','/save',$fields)['status']);
        self::assertSame(200,$this->request($app,'PATCH','/preferences',$fields+['If-Match'=>'"prefs-1"'],'{"textScale":2}')['status']);
        $session=json_decode($this->request($app,'GET','/session',$fields)['body'],true);
        self::assertSame(2,$session['preferences']['revision']); self::assertSame(1,$session['saveSummary']['revision']);
        self::assertSame(403,$this->request($app,'DELETE','/account',$fields+['X-Confirm-Account-Deletion'=>'delete-my-account','X-Deletion-Receipt'=>Security::token()])['status']);
        // Simulate durable intent followed by process loss before live commit.
        $ledger=DeletionLedger::open($this->data['ledgerFile'],$this->roots,$this->data['rollbackRoots'],
            new DeletionRetentionPolicy(2592000,604800,'synthetic-application-test'));
        $receiptHash=hash('sha256','synthetic-factory-deletion-receipt');
        $ledger->exclusive(fn ()=>$ledger->accept($id,$receiptHash,time()));
        $after=json_decode($this->request($app,'GET','/session',$fields)['body'],true);
        self::assertSame('guest',$after['state']);
        self::assertSame(0,$pdo->query('SELECT count(*) FROM accounts')->fetchColumn());
        // Completion is proven by the operation receipt, never by the guest projection.
        self::assertSame('completed',$ledger->exclusive(fn ()=>$ledger->receipt($receiptHash,time()))['state']);
        unset($ledger);

    }
    public function testNoProvisioningMissingStoragePolicyMismatchAndUnknownSchemaFailClosed(): void
    {
        foreach (['databasePath'=>$this->environment->directory().'/missing.sqlite','ledgerFile'=>$this->recovery->directory().'/missing.sqlite','retentionEvidence'=>'different-unreviewed-policy'] as $key=>$value) {
            $data=array_replace($this->data,[$key=>$value]); file_put_contents($this->config,json_encode($data));
            self::assertSame(503,$this->request(Application::fromEnvironment($this->environment()),'GET','/session')['status']);
            if ($key!=='retentionEvidence') self::assertFileDoesNotExist($value);
        }
        file_put_contents($this->config,json_encode($this->data));
        $this->database->connection()->exec("UPDATE schema_migrations SET checksum='".str_repeat('0',64)."' WHERE version=2");
        self::assertSame(503,$this->request(Application::fromEnvironment($this->environment()),'GET','/session')['status']);
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM sessions')->fetchColumn());
    }
    public function testEnvironmentCannotChooseTestIdentityOrDiscoverCredentials(): void
    {
        foreach ([['NQ_TEST_AUTH'=>'0'],['NQ_TEST_IDENTITY'=>'synthetic'],['NQ_DOCUMENT_ROOTS_JSON'=>'[]'],['NQ_GAME_BASE'=>'/elsewhere/']] as $changes) {
            try { Application::fromEnvironment(array_replace($this->environment(),$changes)); self::fail('Unsafe service configuration must fail.'); }
            catch (InvalidArgumentException) { self::assertTrue(true); }
        }
        self::assertSame(503,$this->request(Application::fromEnvironment($this->environment()),'GET','/session',[], '', 'apache2handler')['status']);
        $response=$this->request(Application::fromEnvironment($this->environment()),'GET','/auth/google/callback?state='.str_repeat('x',8200));
        self::assertSame(400,$response['status']); self::assertSame('text/html; charset=utf-8',$response['headers']['Content-Type']);
        self::assertStringContainsString('<h1>',$response['body']); self::assertStringNotContainsString(str_repeat('x',10),$response['body']);
        $configurationFailure=Router::unavailableConfiguration('GET',Router::API_BASE.'/auth/github/callback?code=synthetic-private');
        self::assertSame('text/html; charset=utf-8',$configurationFailure['headers']['Content-Type']);
        self::assertStringNotContainsString('synthetic-private',$configurationFailure['body']);

    }

    public function testReceiptStatusCompositionNeverRunsRecoveryAndLogoutExpiresGuest(): void
    {
        $id='60000000-0000-4000-8000-000000000046';
        $this->database->connection()->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id,time()]);
        $ledger=DeletionLedger::open($this->data['ledgerFile'],$this->roots,$this->data['rollbackRoots'],
            new DeletionRetentionPolicy(2592000,604800,'synthetic-application-test'));
        $receipt=Security::token(); $ledger->exclusive(fn ()=>$ledger->accept($id,hash('sha256',$receipt),time()));
        $app=Application::fromEnvironment($this->environment());
        $status=$this->request($app,'POST','/account/deletion-status',['Origin'=>'https://game.invalid','X-Deletion-Receipt'=>$receipt]);
        self::assertSame(200,$status['status']); self::assertSame('noindex, nofollow',$status['headers']['X-Robots-Tag']); self::assertSame('pending',json_decode($status['body'],true)['state']);
        self::assertSame(1,$this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn(),'Status must not reconcile a pending deletion.');
        $guest=$this->request($app,'GET','/session'); self::assertSame(200,$guest['status']);
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        $logout=$this->request($app,'POST','/logout',['Origin'=>'https://game.invalid','Cookie'=>explode(';',$guest['headers']['Set-Cookie'])[0],
            'X-CSRF-Token'=>json_decode($guest['body'],true)['csrfToken']]);
        self::assertSame(204,$logout['status']); self::assertSame('',$logout['body']); self::assertStringContainsString('Max-Age=0',$logout['headers']['Set-Cookie']);
        $confirmed=$this->request($app,'POST','/account/deletion-status',['Origin'=>'https://game.invalid','X-Deletion-Receipt'=>$receipt]);
        self::assertSame('completed',json_decode($confirmed['body'],true)['state']); unset($ledger);
    }

    public function testProductionEntryThroughTrustedLocalTlsUsesOnlyExplicitPrivateJson(): void
    {
        $origin=$this->environment->startConfiguredApi($this->config);
        $this->data['origin']=$origin;
        foreach (['google','github'] as $provider) $this->data[$provider.'Callback']=$origin.Router::API_BASE.'/auth/'.$provider.'/callback';
        file_put_contents($this->config,json_encode($this->data));
        $client=$this->environment->newClient();
        $guest=$this->environment->request('GET',Router::API_BASE.'/session',client:$client); self::assertSame(200,$guest['status'],$guest['body']);
        $csrf=json_decode($guest['body'],true)['csrfToken'];
        $start=$this->environment->request('POST',Router::API_BASE.'/auth/github/start',['Origin: '.$origin,'X-CSRF-Token: '.$csrf,'Content-Type: application/json'],'{"purpose":"login"}',$client);
        self::assertSame(200,$start['status'],$start['body']); parse_str(parse_url(json_decode($start['body'],true)['authorizationUrl'],PHP_URL_QUERY),$query);
        $cancel=$this->environment->request('GET',Router::API_BASE.'/auth/github/callback?state='.$query['state'].'&error=access_denied',client:$client);
        self::assertSame(200,$cancel['status']); self::assertStringContainsString('canceled',$cancel['body']);
        self::assertSame(400,$this->environment->request('POST',Router::API_BASE.'/auth/github/start',['Origin: '.$origin,'X-CSRF-Token: '.$csrf,'Content-Type: application/json'],'{"purpose":"login","purpose":"login"}',$client)['status']);
        self::assertSame(403,$this->environment->request('POST',Router::API_BASE.'/auth/github/start',['Origin: '.$origin,'X-CSRF-Token: bad','Content-Type: application/json'],'{"purpose":"login"}',$client)['status']);
        self::assertSame(404,$this->environment->directPhpRequest(Router::API_BASE.'/session')['status']);
        self::assertSame('',$this->environment->diagnostics());
    }
}
