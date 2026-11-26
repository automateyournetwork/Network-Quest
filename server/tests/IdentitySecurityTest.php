<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use Firebase\JWT\JWT;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\Identity\Google;
use NetworkQuest\Identity\GitHub;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Routes\Auth;
use NetworkQuest\Router;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__.'/ApiContractTest.php';

final class IdentitySecurityTest extends TestCase
{
    private T053ApiFixture $fixture;
    private Auth $auth;
    private Sessions $sessions;
    private array $guest;
    private array $query = [];
    private array $requests = [];
    private string $scenario = 'valid';
    private int $now = 1795737600;
    private ?int $oldTimestamp;
    private string $errorLog;
    private string|false $oldErrorLog;
    private string|false $oldLogErrors;
    private static OpenSSLAsymmetricKey $key;
    private static OpenSSLAsymmetricKey $forgedKey;
    private static array $jwk;

    public static function setUpBeforeClass(): void
    {
        self::$key = openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
        self::$forgedKey = openssl_pkey_new(['private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA]);
        $rsa = openssl_pkey_get_details(self::$key)['rsa'];
        self::$jwk = ['kty'=>'RSA','kid'=>'T053-synthetic','alg'=>'RS256','use'=>'sig',
            'n'=>JWT::urlsafeB64Encode($rsa['n']),'e'=>JWT::urlsafeB64Encode($rsa['e'])];
    }
    protected function setUp(): void
    {
        $this->fixture = new T053ApiFixture(); $this->oldTimestamp = JWT::$timestamp; JWT::$timestamp = $this->now;
        $this->errorLog = $this->fixture->environment->writeFile('identity-errors.log','');
        $this->oldErrorLog = ini_set('error_log',$this->errorLog); $this->oldLogErrors = ini_set('log_errors','1');
        $this->sessions = new Sessions($this->fixture->database,fn ()=>$this->now);
        $access = new RecoveryAccountAccess($this->fixture->database,$this->fixture->ledger);
        $transactions = new AuthTransactions($this->fixture->database,$this->sessions,$access,fn ()=>$this->now);
        $handler = function ($request, $options) {
            $url = (string)$request->getUri(); $this->requests[] = $url;
            if ($this->scenario === 'transport-exception') throw new RuntimeException('synthetic-T053-private-transport-detail');
            $body = match ($url) {
                'https://oauth2.googleapis.com/token'=>['access_token'=>'synthetic-T053-private-access',
                    'refresh_token'=>'synthetic-T053-private-refresh','id_token'=>$this->googleToken()],
                'https://www.googleapis.com/oauth2/v3/certs'=>['keys'=>[self::$jwk]],
                'https://github.com/login/oauth/access_token'=>['access_token'=>'synthetic-T053-private-access',
                    'refresh_token'=>'synthetic-T053-private-refresh','token_type'=>'bearer',
                    'scope'=>$this->scenario === 'github-repository-scope' ? 'repo' : ''],
                'https://api.github.com/user'=>['id'=>match ($this->scenario) {
                    'github-string-id'=>'53053','github-float-id'=>53053.5,'github-zero-id'=>0,
                    'github-negative-id'=>-1,'github-missing-id'=>null,default=>53053},
                    'email'=>'synthetic-T053-private-email@example.invalid','name'=>'Synthetic player'],
                default=>throw new LogicException('Unexpected synthetic identity endpoint.'),
            };
            if ($this->scenario === 'provider-unavailable') return Create::promiseFor(new Response(503,[], 'synthetic-T053-private-upstream-detail'));
            return Create::promiseFor(new Response(200,['Content-Type'=>'application/json'],json_encode($body,JSON_THROW_ON_ERROR)));
        };
        $google = new Google($transactions,'synthetic-T053-google-client','synthetic-T053-google-private',
            $this->fixture->origin.Router::API_BASE.'/auth/google/callback',fn ()=>$this->now,$handler);
        $github = new GitHub($transactions,'synthetic-T053-github-client','synthetic-T053-github-private',
            $this->fixture->origin.Router::API_BASE.'/auth/github/callback',fn ()=>$this->now,$handler);
        $this->auth = new Auth($this->fixture->database,$this->sessions,new Security($this->fixture->database,
            $this->fixture->origin,str_repeat('s',32),fn ()=>$this->now),$google,$github,$access,$this->fixture->origin,fn ()=>$this->now);
        $response = $this->call('GET','/session'); self::assertSame(200,$response['status']);
        $this->guest = ['cookie'=>explode(';',$response['headers']['set-cookie'])[0],'csrf'=>json_decode($response['body'],true)['csrfToken']];
    }
    protected function tearDown(): void
    {
        JWT::$timestamp = $this->oldTimestamp;
        if ($this->oldErrorLog !== false) ini_set('error_log',$this->oldErrorLog);
        if ($this->oldLogErrors !== false) ini_set('log_errors',$this->oldLogErrors);
        unset($this->auth,$this->sessions); $this->fixture->close();
    }
    private function call(string $method,string $path,string $query='',array $headers=[],string $body=''): array
    {
        $stream=fopen('php://memory','r+'); fwrite($stream,$body); rewind($stream);
        try {
            $r=$this->auth->handle($method,$path,$query,$headers,$stream,'192.0.2.53');
            $r['headers']=array_change_key_case($r['headers'],CASE_LOWER); return $r;
        } finally { fclose($stream); }
    }
    private function start(string $provider): void
    {
        $response = $this->call('POST','/auth/'.$provider.'/start','',[
            ['Cookie',$this->guest['cookie']],['Origin',$this->fixture->origin],['X-CSRF-Token',$this->guest['csrf']],['Content-Type','application/json']],'{"purpose":"login"}');
        self::assertSame(200,$response['status']);
        parse_str(parse_url(json_decode($response['body'],true)['authorizationUrl'],PHP_URL_QUERY),$this->query);
    }
    private function finishCallback(string $provider, ?string $state=null, ?string $cookie=null): array
    {
        return $this->call('GET','/auth/'.$provider.'/callback','state='.($state ?? $this->query['state']).'&code=synthetic-T053-private-code',
            [['Cookie',$cookie ?? $this->guest['cookie']]]);
    }
    private function googleToken(): string
    {
        $claims=['iss'=>'https://accounts.google.com','aud'=>'synthetic-T053-google-client','sub'=>'synthetic-T053-private-subject',
            'iat'=>$this->now,'exp'=>$this->now+3600,'nonce'=>$this->query['nonce'],'name'=>'Synthetic player'];
        switch ($this->scenario) {
            case 'audience-other': $claims['aud']='synthetic-T053-attacker-client'; break;
            case 'audience-array': $claims['aud']=['synthetic-T053-google-client','synthetic-T053-attacker-client']; break;
            case 'issuer-forged': $claims['iss']='https://accounts.google.com.attacker.invalid'; break;
            case 'nonce-forged': $claims['nonce']=Security::token(); break;
            case 'nonce-missing': unset($claims['nonce']); break;
            case 'nonce-replayed': $claims['nonce']=$this->replayedNonce; break;
            case 'expired-token': $claims['exp']=$this->now; $claims['iat']=$this->now-3600; break;
            case 'future-iat': $claims['iat']=$this->now+1; break;
            case 'future-nbf': $claims['nbf']=$this->now+1; break;
            case 'wrong-authorized-party': $claims['azp']='synthetic-T053-attacker-client'; break;
            case 'missing-subject': unset($claims['sub']); break;
        }
        if ($this->scenario === 'symmetric-algorithm') return JWT::encode($claims,str_repeat('synthetic-T053-private-hmac',2),'HS256','T053-synthetic');
        if ($this->scenario === 'unsigned-token') return JWT::urlsafeB64Encode('{"alg":"none","kid":"T053-synthetic"}').'.'.JWT::urlsafeB64Encode(json_encode($claims)).'.';
        return JWT::encode($claims,$this->scenario === 'forged-signature' ? self::$forgedKey : self::$key,'RS256',
            $this->scenario === 'unknown-key' ? 'T053-attacker-key' : 'T053-synthetic');
    }
    private string $replayedNonce = '';

    private function assertRejected(array $response,int $status): void
    {
        self::assertSame($status,$response['status']); T053Contract::headers($response,true);
        self::assertArrayNotHasKey('set-cookie',$response['headers']);
        self::assertStringContainsString('<main>',$response['body']); self::assertStringContainsString('<h1>',$response['body']);
        T053Contract::noPrivate($response,[$this->query['state'],$this->guest['csrf'],explode('=',$this->guest['cookie'],2)[1],
            'synthetic-T053-private','synthetic-T053-google-private','synthetic-T053-github-private']);
        foreach (['accounts','identities','preferences','saves','write_receipts','delete_reauth_proofs'] as $table) {
            self::assertSame(0,$this->fixture->database->connection()->query('SELECT count(*) FROM '.$table)->fetchColumn());
        }
        $session=$this->call('GET','/session','',[['Cookie',$this->guest['cookie']]]);
        self::assertSame(['state'=>'guest','csrfToken'=>$this->guest['csrf']],json_decode($session['body'],true));
        self::assertSame('',file_get_contents($this->errorLog),'PHP error sink stays empty even when provider exceptions contain synthetic private data.');
        $persistent=json_encode($this->fixture->database->connection()->query('SELECT * FROM auth_transactions')->fetchAll());
        foreach (['synthetic-T053-private',$this->query['state'],$this->query['nonce'] ?? 'synthetic-T053-absent-nonce'] as $secret) self::assertStringNotContainsString($secret,$persistent);
    }
    public static function invalidIdentityEvidence(): iterable
    {
        foreach (['forged-signature','unsigned-token','symmetric-algorithm','unknown-key','audience-other','audience-array','issuer-forged',
            'nonce-forged','nonce-missing','expired-token','future-iat','future-nbf','wrong-authorized-party','missing-subject'] as $case) yield $case=>['google',$case,400];
        foreach (['github-string-id','github-float-id','github-zero-id','github-negative-id','github-missing-id','github-repository-scope'] as $case) yield $case=>['github',$case,400];
        foreach (['google','github'] as $provider) {
            yield $provider.' unavailable'=>[$provider,'provider-unavailable',503];
            yield $provider.' exception'=>[$provider,'transport-exception',503];
        }
    }
    #[DataProvider('invalidIdentityEvidence')]
    public function testRealSdkRejectionsConsumeAttemptAndNeverAuthenticateOrDisclose(string $provider,string $scenario,int $status): void
    {
        $this->start($provider); $this->scenario=$scenario;
        $this->assertRejected($this->finishCallback($provider),$status);
        self::assertNotEmpty($this->requests);
        self::assertSame(1,$this->fixture->database->connection()->query('SELECT count(*) FROM auth_transactions WHERE consumed_at IS NOT NULL')->fetchColumn());
        $count=count($this->requests); $this->assertRejected($this->finishCallback($provider),400);
        self::assertCount($count,$this->requests,'Replayed rejected evidence must not call the provider again.');
    }
    public static function stateAttacks(): iterable
    {
        foreach (['google','github'] as $provider) foreach (['forged','expired','other-session','other-provider','revoked-session'] as $case) yield $provider.' '.$case=>[$provider,$case];
    }
    #[DataProvider('stateAttacks')]
    public function testForgedExpiredAndMisboundStateFailsBeforeProviderIo(string $provider,string $attack): void
    {
        $this->start($provider); $state=$this->query['state']; $cookie=$this->guest['cookie'];
        if ($attack==='forged') $state=Security::token();
        if ($attack==='expired') { $this->now+=600; JWT::$timestamp=$this->now; }
        if ($attack==='other-session') {
            $other=$this->sessions->bootstrap(null); $cookie=explode(';',$other['setCookie'])[0];
        }
        if ($attack==='other-provider') $provider=$provider==='google' ? 'github' : 'google';
        if ($attack==='revoked-session') {
            $prior=$this->sessions->require($cookie,false);
            $this->fixture->database->immediate(fn (PDO $db)=>$this->sessions->revokeWithin($db,$prior));
        }
        $response=$this->finishCallback($provider,$state,$cookie);
        if ($attack==='revoked-session') {
            self::assertSame(400,$response['status']); T053Contract::headers($response,true);
            self::assertSame(0,$this->fixture->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
            T053Contract::noPrivate($response,[$state,$this->guest['csrf'],'synthetic-T053-private']);
            self::assertSame('',file_get_contents($this->errorLog));
        } else $this->assertRejected($response,400);
        self::assertSame([],$this->requests);
    }
    public function testNonceFromCanceledAttemptCannotAuthorizeFreshState(): void
    {
        $this->start('google'); $this->replayedNonce=$this->query['nonce'];
        $canceled=$this->call('GET','/auth/google/callback','state='.$this->query['state'].'&error=access_denied',[['Cookie',$this->guest['cookie']]]);
        self::assertSame(200,$canceled['status']);
        $this->start('google'); self::assertNotSame($this->replayedNonce,$this->query['nonce']);
        $this->scenario='nonce-replayed'; $this->assertRejected($this->finishCallback('google'),400);
    }
    public static function providers(): array { return [['google'],['github']]; }
    #[DataProvider('providers')]
    public function testSuccessfulSyntheticSdkControlRotatesThenReplayCannotCreateOrRotateAgain(string $provider): void
    {
        $this->start($provider); $response=$this->finishCallback($provider); self::assertSame(200,$response['status']); T053Contract::headers($response,true);
        $cookie=explode(';',$response['headers']['set-cookie'])[0]; self::assertNotSame($this->guest['cookie'],$cookie);
        $session=$this->call('GET','/session','',[['Cookie',$cookie]]); $data=json_decode($session['body'],true);
        self::assertSame('authenticated',$data['state']); self::assertSame($provider,$data['provider']); self::assertNotSame($this->guest['csrf'],$data['csrfToken']);
        $before=$this->fixture->graph(); $count=count($this->requests); $replay=$this->finishCallback($provider,null,$cookie);
        self::assertSame(400,$replay['status']); self::assertSame($before,$this->fixture->graph()); self::assertCount($count,$this->requests);
        self::assertArrayNotHasKey('set-cookie',$replay['headers']);
        T053Contract::noPrivate($replay,[$data['csrfToken'],'synthetic-T053-private',$this->query['state']]);
        self::assertSame('',file_get_contents($this->errorLog));
        $stored=json_encode($this->fixture->graph());
        foreach (['synthetic-T053-private-access','synthetic-T053-private-refresh','synthetic-T053-private-code','synthetic-T053-private-email'] as $secret) self::assertStringNotContainsString($secret,$stored);
    }
    public function testOnlyAllowlistedMetadataCanEnterTheApplicationLogProjection(): void
    {
        $requestId='53000000-0000-4000-8000-000000000053';
        foreach (array_keys(ApiContractTest::operations()) as $route) {
            $record=Security::logRecord($route,403,12,$requestId,'forbidden');
            self::assertSame(['route'=>$route,'status'=>403,'durationMs'=>12,'requestId'=>$requestId,'reason'=>'forbidden'],$record);
        }
        foreach ([['authCallback?code=synthetic-T053-private-code','forbidden'],['getDeletionStatus','synthetic-T053-private-receipt']] as [$route,$reason]) {
            $rejected=false;
            try { Security::logRecord($route,403,12,$requestId,$reason); }
            catch (InvalidArgumentException) { $rejected=true; }
            self::assertTrue($rejected,'Private request text must not become a route or reason log field.');
        }
        self::assertSame('',file_get_contents($this->errorLog));
    }
}
