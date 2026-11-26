<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use Firebase\JWT\JWT;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\Identity\Google;
use NetworkQuest\Identity\GitHub;
use NetworkQuest\RequestRejected;
use NetworkQuest\Routes\Auth;
use NetworkQuest\Router;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

foreach (['Database', 'Security', 'Sessions', 'Router', 'AccountAccess', 'Identity/AuthTransactions', 'Identity/ProviderHttp', 'Identity/Google', 'Identity/GitHub', 'Routes/Auth'] as $source) require_once __DIR__ . '/../src/' . $source . '.php';
require_once __DIR__ . '/Support/TestEnvironment.php';

/** Explicit isolated test gate; there is no runtime bypass or configurable permissive gate. */
final class AuthTestGate implements AccountAccess
{
    public bool $held = false;
    public bool $deny = false;
    public mixed $before = null;
    public function run(callable $operation): mixed
    {
        if ($this->held) throw new LogicException('Nonreentrant test barrier.');
        $this->held = true;
        try {
            if ($this->deny) throw new RequestRejected('unavailable');
            if ($this->before !== null) ($this->before)();
            return $operation();
        } finally { $this->held = false; }
    }
}

final class AuthRoutesTest extends TestCase
{
    private const ORIGIN = 'https://game.invalid';
    private TestEnvironment $environment;
    private Database $database;
    private Sessions $sessions;
    private Auth $auth;
    private AuthTestGate $gate;
    private array $guest;
    private array $queries = [];
    private array $requests = [];
    private int $now = 1795737600;
    private string $googleSubject = 'synthetic-google-subject';
    private int $githubSubject = 1234567;
    private mixed $duringExchange = null;
    private ?int $oldTimestamp;
    private static OpenSSLAsymmetricKey $key;
    private static array $jwk;

    public static function setUpBeforeClass(): void
    {
        self::$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $rsa = openssl_pkey_get_details(self::$key)['rsa'];
        self::$jwk = ['kty' => 'RSA', 'kid' => 'auth-route-synthetic', 'alg' => 'RS256', 'use' => 'sig',
            'n' => JWT::urlsafeB64Encode($rsa['n']), 'e' => JWT::urlsafeB64Encode($rsa['e'])];
    }
    protected function setUp(): void
    {
        $this->oldTimestamp = JWT::$timestamp; JWT::$timestamp = $this->now;
        $this->environment = TestEnvironment::create(); $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $this->gate = new AuthTestGate();
        $transactions = new AuthTransactions($this->database, $this->sessions, $this->gate, fn () => $this->now);
        $handler = function ($request, $options) {
            self::assertFalse($this->database->connection()->inTransaction());
            self::assertFalse($this->gate->held, 'Release external deletion barrier before provider IO.');
            $url = (string) $request->getUri(); $this->requests[] = $url;
            if (str_ends_with($url, '/token') || str_ends_with($url, '/access_token')) {
                self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM auth_transactions WHERE consumed_at IS NOT NULL')->fetchColumn());
                if ($this->duringExchange !== null) ($this->duringExchange)();
            }
            $body = match ($url) {
                'https://oauth2.googleapis.com/token' => ['access_token' => 'synthetic-private-access', 'id_token' => JWT::encode([
                    'iss' => 'https://accounts.google.com', 'aud' => 'synthetic-google-client', 'sub' => $this->googleSubject,
                    'iat' => $this->now, 'exp' => $this->now + 3600, 'nonce' => $this->queries['google']['nonce'],
                    'name' => 'Synthetic <b>Player</b>', 'email' => 'same@example.invalid'], self::$key, 'RS256', 'auth-route-synthetic')],
                'https://www.googleapis.com/oauth2/v3/certs' => ['keys' => [self::$jwk]],
                'https://github.com/login/oauth/access_token' => ['access_token' => 'synthetic-private-access', 'token_type' => 'bearer', 'scope' => ''],
                'https://api.github.com/user' => ['id' => $this->githubSubject, 'name' => 'Synthetic <b>Player</b>', 'email' => 'same@example.invalid'],
                default => throw new LogicException('Unexpected synthetic endpoint.'),
            };
            return Create::promiseFor(new Response(200, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR)));
        };
        $google = new Google($transactions, 'synthetic-google-client', 'synthetic-google-secret', self::ORIGIN . '/arcade/play/network-quest/api/v1/auth/google/callback', fn () => $this->now, $handler);
        $github = new GitHub($transactions, 'synthetic-github-client', 'synthetic-github-secret', self::ORIGIN . '/arcade/play/network-quest/api/v1/auth/github/callback', fn () => $this->now, $handler);
        $this->auth = new Auth($this->database, $this->sessions, new Security($this->database, self::ORIGIN, str_repeat('s', 32), fn () => $this->now), $google, $github, $this->gate, self::ORIGIN, fn () => $this->now);
        $response = $this->call('GET', '/session');
        self::assertSame(200, $response['status']);
        $this->guest = ['cookie' => explode(';', $response['headers']['Set-Cookie'])[0], 'csrf' => json_decode($response['body'], true)['csrfToken']];
    }
    protected function tearDown(): void
    {
        JWT::$timestamp = $this->oldTimestamp;
        unset($this->auth, $this->sessions, $this->database);
        $this->environment->close();
    }
    private function call(string $method, string $route, string $query = '', string $body = '', ?array $headers = null): array
    {
        $stream = fopen('php://memory', 'r+'); fwrite($stream, $body); rewind($stream);
        try { return $this->auth->handle($method, $route, $query, $headers ?? [], $stream, '192.0.2.41'); }
        finally { fclose($stream); }
    }
    private function headers(?array $credentials = null): array
    {
        $c = $credentials ?? $this->guest;
        return [['Cookie', $c['cookie']], ['Origin', self::ORIGIN], ['X-CSRF-Token', $c['csrf']], ['Content-Type', 'application/json']];
    }
    private function start(string $provider, string $purpose = 'login', ?array $credentials = null): array
    {
        $response = $this->call('POST', '/auth/' . $provider . '/start', '', json_encode(['purpose' => $purpose]), $this->headers($credentials));
        self::assertSame(200, $response['status'], $response['body']);
        $data = json_decode($response['body'], true);
        self::assertSame(['authorizationUrl', 'expiresAt'], array_keys($data));
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->now + 600), $data['expiresAt']);
        parse_str(parse_url($data['authorizationUrl'], PHP_URL_QUERY), $this->queries[$provider]);
        return $data;
    }
    private function finishAuth(string $provider, ?array $credentials = null, string $tail = 'code=synthetic-private-code'): array
    {
        return $this->call('GET', '/auth/' . $provider . '/callback', 'state=' . $this->queries[$provider]['state'] . '&' . $tail, '', [['Cookie', ($credentials ?? $this->guest)['cookie']]]);
    }
    private function login(string $provider): array
    {
        $this->start($provider); $response = $this->finishAuth($provider);
        self::assertSame(200, $response['status']);
        $cookie = explode(';', $response['headers']['Set-Cookie'])[0];
        $session = $this->call('GET', '/session', '', '', [['Cookie', $cookie]]);
        self::assertSame(200, $session['status']);
        $data = json_decode($session['body'], true);
        return ['cookie' => $cookie, 'csrf' => $data['csrfToken'], 'data' => $data, 'callback' => $response];
    }
    public static function providers(): array { return [['google'], ['github']]; }

    public function testGuestStableCsrfExactMinimalNoStoreProjection(): void
    {
        $response = $this->call('GET', '/session', '', '', [['Cookie', $this->guest['cookie']]]);
        self::assertSame(['state' => 'guest', 'csrfToken' => $this->guest['csrf']], json_decode($response['body'], true));
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']);
        self::assertSame('no-store', $response['headers']['Cache-Control']);
        self::assertSame('noindex, nofollow', $response['headers']['X-Robots-Tag']);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }
    #[DataProvider('providers')]
    public function testActualProviderLoginCreatesPreferencesRotatesAndRendersHintOnly(string $provider): void
    {
        $signed = $this->login($provider); $data = $signed['data'];
        self::assertSame('authenticated', $data['state']); self::assertSame($provider, $data['provider']);
        self::assertSame('Synthetic <b>Player</b>', $data['displayName']);
        self::assertSame(['state','csrfToken','provider','displayName','expiresAt','preferences','saveSummary'], array_keys($data));
        self::assertSame(['revision' => 1, 'etag' => '"prefs-1"', 'values' => ['autosaveEnabled' => false, 'musicVolume' => 1,
            'effectsVolume' => 1, 'voiceVolume' => 1, 'captions' => true, 'reducedMotion' => 'system', 'textScale' => 1]], $data['preferences']);
        self::assertNull($data['saveSummary']); self::assertNotSame($this->guest['csrf'], $signed['csrf']);
        self::assertNotSame($this->guest['cookie'], $signed['cookie']);
        $html = $signed['callback']['body'];
        foreach (['synthetic-private', 'synthetic-google-subject', '<b>Player</b>', $signed['csrf'], $this->queries[$provider]['state']] as $secret) self::assertStringNotContainsString($secret, $html);
        self::assertStringContainsString('<main>', $html); self::assertStringContainsString('<h1>', $html);
        self::assertStringContainsString('postMessage', $html); self::assertStringContainsString('https://game.invalid', $html);
        self::assertStringContainsString("script-src 'sha256-", $signed['callback']['headers']['Content-Security-Policy']);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM delete_reauth_proofs')->fetchColumn());
        self::assertSame(400, $this->finishAuth($provider)['status']);
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }
    #[DataProvider('providers')]
    public function testCanceledCallbackConsumesButPreservesSessionAndNoAccount(string $provider): void
    {
        $this->start($provider); $response = $this->finishAuth($provider, null, 'error=access_denied');
        self::assertSame(200, $response['status']); self::assertStringContainsString('canceled', $response['body']);
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']); self::assertSame([], $this->requests);
        self::assertSame(400, $this->finishAuth($provider, null, 'error=access_denied')['status']);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }
    #[DataProvider('providers')]
    public function testLogoutDuringExchangeCannotCommitIdentity(string $provider): void
    {
        $this->start($provider);
        $this->duringExchange = function () { $prior = $this->sessions->require($this->guest['cookie'], false); $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $prior)); };
        self::assertSame(400, $this->finishAuth($provider)['status']);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }
    #[DataProvider('providers')]
    public function testDeletePurposeMatchesExistingIdentityAndTransfersProofOnlyToNewSession(string $provider): void
    {
        $signed = $this->login($provider); $prior = $this->sessions->require($signed['cookie']);
        $this->start($provider, 'delete-reauth', $signed); $this->now += 2; JWT::$timestamp = $this->now;
        $response = $this->finishAuth($provider, $signed); self::assertSame(200, $response['status']);
        $current = $this->sessions->require(explode(';', $response['headers']['Set-Cookie'])[0]);
        self::assertSame($prior->accountId, $current->accountId); self::assertNotSame($prior->idHash, $current->idHash);
        $proof = $this->database->connection()->query('SELECT * FROM delete_reauth_proofs')->fetch();
        self::assertSame(['session_hash' => $current->idHash, 'account_id' => $current->accountId, 'confirmed_at' => $this->now, 'expires_at' => $this->now + 300], $proof);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
        $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $current));
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM delete_reauth_proofs')->fetchColumn());
    }
    #[DataProvider('providers')]
    public function testWrongDeleteIdentityCreatesNothingAndDoesNotLogout(string $provider): void
    {
        $signed = $this->login($provider); $old = $this->sessions->require($signed['cookie']);
        $this->start($provider, 'delete-reauth', $signed); $this->googleSubject = 'other-subject'; $this->githubSubject = 7654321;
        $response = $this->finishAuth($provider, $signed); self::assertSame(400, $response['status']);
        self::assertSame($old->idHash, $this->sessions->require($signed['cookie'])->idHash);
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM delete_reauth_proofs')->fetchColumn());
    }
    public function testDifferentProvidersNeverMergeMatchingEmailAndExistingSubjectDoesNotCreateAgain(): void
    {
        $a = $this->login('google'); $aId = $this->sessions->require($a['cookie'])->accountId;
        $fresh = $this->call('GET', '/session'); $this->guest = ['cookie' => explode(';', $fresh['headers']['Set-Cookie'])[0], 'csrf' => json_decode($fresh['body'], true)['csrfToken']];
        $b = $this->login('github'); self::assertNotSame($aId, $this->sessions->require($b['cookie'])->accountId);
        $this->start('google', 'login', $b); $response = $this->finishAuth('google', $b);
        self::assertSame(200, $response['status']); self::assertSame($aId, $this->sessions->require(explode(';', $response['headers']['Set-Cookie'])[0])->accountId);
        self::assertSame(2, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }
    public function testExternalBarrierDeniesAllSessionAccountWorkAndFinalExchangeCommit(): void
    {
        $this->gate->deny = true;
        self::assertSame(503, $this->call('GET', '/session')['status']);
        self::assertSame(503, $this->call('POST', '/auth/google/start', '', '{"purpose":"login"}', $this->headers())['status']);
        $this->gate->deny = false; $this->start('google'); $this->duringExchange = function () { $this->gate->deny = true; };
        self::assertSame(503, $this->finishAuth('google')['status']);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(1, $this->database->connection()->query('SELECT count(*) FROM auth_transactions WHERE consumed_at IS NOT NULL')->fetchColumn());
    }
    #[DataProvider('invalidStarts')]
    public function testStrictStartBoundsOriginCsrfAndDuplicateAdmission(string $body, string $mutation, int $expected): void
    {
        $headers = $this->headers();
        if ($mutation === 'origin') $headers[1][1] = 'https://evil.invalid';
        if ($mutation === 'csrf') $headers[2][1] = Security::token();
        if ($mutation === 'duplicate') $headers[] = ['origin', self::ORIGIN];
        if ($mutation === 'type') $headers[3][1] = 'text/plain';
        if ($mutation === 'length') $headers[] = ['Content-Length', '999999999'];
        $response = $this->call('POST', '/auth/google/start', '', $body, $headers);
        self::assertSame($expected, $response['status']); self::assertSame([], $this->requests);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM auth_transactions')->fetchColumn());
    }
    public static function invalidStarts(): iterable
    {
        foreach (['{}','[]','{"purpose":"login","purpose":"login"}','{"purpose":"login","returnUrl":"https://evil.invalid"}','{"purpose":"delete"}','{"purpose":1}','{"purpose":"login"} trailing'] as $body) yield [$body, '', 400];
        yield [str_repeat(' ', 1025), '', 413];
        yield ['{"purpose":"\\uD800"}', '', 400];
        foreach (['origin'=>403,'csrf'=>403,'duplicate'=>400,'type'=>400,'length'=>413] as $mutation=>$expected) yield ['{"purpose":"login"}', $mutation, $expected];
    }
    #[DataProvider('invalidQueries')]
    public function testStrictRawQueryRejectsDuplicatesAliasesAndWrongShapes(string $tail): void
    {
        $this->start('google'); $response = $this->finishAuth('google', null, $tail);
        self::assertSame(400, $response['status']); self::assertStringContainsString('<h1>', $response['body']);
        self::assertSame([], $this->requests);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM auth_transactions WHERE consumed_at IS NOT NULL')->fetchColumn());
    }
    public static function invalidQueries(): iterable
    {
        foreach (['code=a&code=b','co%64e=a&code=a','state=other&code=a','code[]=a','co.de=a','code=a&error=access_denied','code=','other=a','code=%ZZ','code=a%00','code=a;error=b','code=a&accountId=other', 'code=' . str_repeat('a',4097)] as $tail) yield [$tail];
    }
    public function testRateLimitAcrossCancellationAndCounterFailureNoIdentity(): void
    {
        for ($i=0; $i<5; $i++) { $this->start('google'); self::assertSame(200, $this->finishAuth('google', null, 'error=access_denied')['status']); }
        $response = $this->call('POST','/auth/google/start','','{"purpose":"login"}',$this->headers());
        self::assertSame(429, $response['status']); self::assertGreaterThan(0,(int)$response['headers']['Retry-After']);
    }
    public function testProjectionReadsCurrentPrefsAndWhitelistedSummaryWithoutPayload(): void
    {
        $signed = $this->login('github'); $account = $this->sessions->require($signed['cookie'])->accountId;
        $pdo=$this->database->connection(); $pdo->exec('UPDATE preferences SET revision=2,autosave_enabled=1,text_scale=2');
        $pdo->prepare('INSERT INTO saves(account_id,revision,saved_at,schema_version,content_version,adventure_id,payload_json,payload_hash,summary_json) VALUES(?,9,?,99,?, ?, ?, ?, ?)')->execute([$account,$this->now,'future','10000000-0000-4000-8000-000000000041','{"private":"secret-note"}',hash('sha256','payload'),json_encode(['episodeId'=>'spec001','roomId'=>'spec001:R01','outcome'=>null,'private'=>'secret-note','revision'=>99])]);
        $response=$this->call('GET','/session','','',[['Cookie',$signed['cookie']]]); $data=json_decode($response['body'],true);
        self::assertSame(2,$data['preferences']['revision']); self::assertTrue($data['preferences']['values']['autosaveEnabled']);
        self::assertSame(9,$data['saveSummary']['revision']); self::assertSame(99,$data['saveSummary']['saveSchemaVersion']);
        self::assertSame('"save-9"',$data['saveSummary']['etag']); self::assertStringNotContainsString('secret-note',$response['body']);
        self::assertStringNotContainsString($account,$response['body']);
    }

    public function testConfiguredRouterRequiresExplicitRawTransportAndPreservesUnconfiguredRoutes(): void
    {
        $router = new Router([], $this->auth);
        self::assertSame(503, $router->dispatch('GET', Router::API_BASE . '/session')['status']);
        $stream = fopen('php://memory', 'r+');
        try {
            $server = ['REQUEST_METHOD'=>'GET','REQUEST_URI'=>Router::API_BASE . '/session','REMOTE_ADDR'=>'192.0.2.41','HTTPS'=>'on','HTTP_HOST'=>'game.invalid'];
            self::assertSame(200,$router->handleServer($server,[['Host','game.invalid']],$stream)['status']);
            self::assertSame(400,$router->handleServer($server,[['Host','evil.invalid']],$stream)['status']);
            self::assertSame(400,$router->handleServer($server,[['Host','game.invalid'],['host','game.invalid']],$stream)['status']);
            self::assertSame(400,$router->handleServer(array_replace($server,['HTTPS'=>'off']),[['Host','game.invalid']],$stream)['status']);
            self::assertSame(503,$router->dispatch('GET',Router::API_BASE . '/save',[],$stream,'192.0.2.41')['status']);
            self::assertSame(404,$router->dispatch('GET','/unrelated',[],$stream,'192.0.2.41')['status']);
            self::assertSame(405,$router->dispatch('POST',Router::API_BASE . '/session',[],$stream,'192.0.2.41')['status']);
        } finally { fclose($stream); }
    }

    public function testSchemaFailureRollsBackNewIdentityAndCookieRotation(): void
    {
        $this->start('github'); $this->database->connection()->exec('DROP TABLE preferences');
        $response=$this->finishAuth('github'); self::assertSame(503,$response['status']);
        self::assertArrayNotHasKey('Set-Cookie',$response['headers']);
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(0,$this->database->connection()->query('SELECT count(*) FROM identities')->fetchColumn());
        self::assertNull($this->sessions->require($this->guest['cookie'],false)->accountId);
        self::assertSame(1,$this->database->connection()->query('SELECT count(*) FROM auth_transactions WHERE consumed_at IS NOT NULL')->fetchColumn());
    }

    public function testExpiredWrongSessionAndMalformedCookieNeverExchange(): void
    {
        $this->start('google');
        $foreign=$this->call('GET','/session'); $foreignCookie=explode(';',$foreign['headers']['Set-Cookie'])[0];
        self::assertSame(400,$this->finishAuth('google',['cookie'=>$foreignCookie])['status']);
        self::assertSame(400,$this->finishAuth('google',['cookie'=>$this->guest['cookie'] . '; ' . $this->guest['cookie']])['status']);
        $this->now += 600; JWT::$timestamp=$this->now;
        self::assertSame(400,$this->finishAuth('google')['status']); self::assertSame([],$this->requests);
    }

    public function testProviderUiMetadataIsDiscardedAndNeverRendered(): void
    {
        $this->start('google');
        $response=$this->finishAuth('google',null,'code=synthetic-private-code&scope=openid+profile&authuser=0&prompt=consent');
        self::assertSame(200,$response['status']); self::assertStringNotContainsString('consent',$response['body']);
    }


    #[DataProvider('proofAges')]
    public function testFinalConfirmationAgeBoundaryIsPurposeBound(int $age, int $expected): void
    {
        $signed=$this->login('github'); $this->start('github','delete-reauth',$signed);
        $confirmed=$this->now;
        $this->duringExchange=function () use ($age) { $this->gate->before=function () use ($age) { $this->now += $age; $this->gate->before=null; }; };
        $response=$this->finishAuth('github',$signed); self::assertSame($expected,$response['status']);
        $proof=$this->database->connection()->query('SELECT confirmed_at,expires_at FROM delete_reauth_proofs')->fetch();
        if ($expected===200) self::assertSame(['confirmed_at'=>$confirmed,'expires_at'=>$confirmed+300],$proof);
        else { self::assertFalse($proof); self::assertNotNull($this->sessions->require($signed['cookie'])->accountId); }
    }
    public static function proofAges(): array { return [[299,200],[300,200],[301,400]]; }

    public function testForwardProofMigrationBindsAccountAndCascadesWithoutChangingMigrationOne(): void
    {
        $signed=$this->login('google'); $current=$this->sessions->require($signed['cookie']);
        $pdo=$this->database->connection(); self::assertSame(2,$pdo->query('SELECT count(*) FROM schema_migrations')->fetchColumn());
        $other='00000000-0000-4000-8000-000000000041'; $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$other,$this->now]);
        try { $pdo->prepare('INSERT INTO delete_reauth_proofs VALUES(?,?,?,?)')->execute([$current->idHash,$other,$this->now,$this->now+300]); self::fail('Proof must bind actual session account.'); }
        catch (PDOException) { self::assertSame(0,$pdo->query('SELECT count(*) FROM delete_reauth_proofs')->fetchColumn()); }
    }
}
