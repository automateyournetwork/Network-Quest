<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use Firebase\JWT\JWT;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use NetworkQuest\Database;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\Identity\Google;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use NetworkQuest\Tests\Support\DirectAccountAccess;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/Support/DirectAccountAccess.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Sessions.php';
require_once __DIR__ . '/../src/Identity/AuthTransactions.php';
require_once __DIR__ . '/../src/Identity/ProviderHttp.php';
require_once __DIR__ . '/../src/Identity/Google.php';

final class GoogleIdentityTest extends TestCase
{
    private const CLIENT = 'synthetic-client.apps.googleusercontent.com';
    private const SECRET = 'synthetic-private-client-secret';
    private const CALLBACK = 'https://game.invalid/arcade/play/network-quest/api/v1/auth/google/callback';
    private const SUBJECT = 'synthetic-google-stable-subject';
    private const ACCOUNT = '60000000-0000-4000-8000-000000000039';
    private static OpenSSLAsymmetricKey $key;
    private static OpenSSLAsymmetricKey $wrongKey;
    private static array $jwk;
    private TestEnvironment $environment;
    private Database $database;
    private Sessions $sessions;
    private AuthTransactions $transactions;
    private Google $google;
    private array $session;
    private array $query = [];
    private array $requests = [];
    private array $claims = [];
    private ?string $tokenOverride = null;
    private mixed $duringExchange = null;
    private ?Response $exchangeResponse = null;
    private ?Response $keysResponse = null;
    private int $now = 1795737600;
    private ?int $oldTimestamp;
    private int $oldLeeway;

    public static function setUpBeforeClass(): void
    {
        // Ephemeral synthetic RSA keys remain in memory; no credential/key fixture is persisted.
        self::$key = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        self::$wrongKey = openssl_pkey_new(['private_key_bits' => 2048, 'private_key_type' => OPENSSL_KEYTYPE_RSA]);
        $details = openssl_pkey_get_details(self::$key);
        self::$jwk = ['kty' => 'RSA', 'kid' => 'synthetic-rsa-1', 'use' => 'sig', 'alg' => 'RS256',
            'n' => JWT::urlsafeB64Encode($details['rsa']['n']), 'e' => JWT::urlsafeB64Encode($details['rsa']['e'])];
    }

    protected function setUp(): void
    {
        $this->oldTimestamp = JWT::$timestamp;
        $this->oldLeeway = JWT::$leeway;
        JWT::$timestamp = $this->now;
        JWT::$leeway = 0;
        $this->environment = TestEnvironment::create();
        $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $this->transactions = new AuthTransactions($this->database, $this->sessions, new DirectAccountAccess(), fn () => $this->now);
        $this->google = new Google($this->transactions, self::CLIENT, self::SECRET, self::CALLBACK, fn () => $this->now,
            function ($request, $options) {
                self::assertFalse($this->database->connection()->inTransaction(), 'Never hold SQLite write lock during provider IO.');
                $this->requests[] = ['method' => $request->getMethod(), 'url' => (string) $request->getUri(),
                    'body' => (string) $request->getBody()];
                if ((string) $request->getUri() === 'https://oauth2.googleapis.com/token') {
                    if ($this->duringExchange !== null) ($this->duringExchange)();
                    return Create::promiseFor($this->exchangeResponse ?? new Response(200, ['Content-Type' => 'application/json'],
                        json_encode(['access_token' => 'synthetic-private-access-token', 'refresh_token' => 'synthetic-private-refresh-token',
                            'id_token' => $this->tokenOverride ?? $this->token($this->claims), 'token_type' => 'Bearer', 'expires_in' => 3600], JSON_THROW_ON_ERROR)));
                }
                self::assertSame('https://www.googleapis.com/oauth2/v3/certs', (string) $request->getUri());
                return Create::promiseFor($this->keysResponse ?? new Response(200, ['Content-Type' => 'application/json'],
                    json_encode(['keys' => [self::$jwk]], JSON_THROW_ON_ERROR)));
            });
        $this->session = $this->sessions->bootstrap(null);
    }

    protected function tearDown(): void
    {
        JWT::$timestamp = $this->oldTimestamp;
        JWT::$leeway = $this->oldLeeway;
        unset($this->google, $this->transactions, $this->sessions, $this->database);
        $this->environment->close();
    }

    private function begin(string $purpose = 'login'): array
    {
        $start = $this->google->start($this->session['context'], $purpose);
        parse_str(parse_url($start['authorizationUrl'], PHP_URL_QUERY), $this->query);
        $this->claims = ['iss' => 'https://accounts.google.com', 'aud' => self::CLIENT, 'sub' => self::SUBJECT,
            'exp' => $this->now + 3600, 'iat' => $this->now, 'nonce' => $this->query['nonce'],
            'name' => 'Synthetic player <b>literal</b>', 'email' => 'synthetic-private-email@example.invalid'];
        return $start;
    }

    private function token(array $claims, ?OpenSSLAsymmetricKey $key = null, string $kid = 'synthetic-rsa-1'): string
    {
        // Deliberately sign malformed claim types too; SDK encode() refuses some negative
        // vectors before they reach verification. Production still uses the real SDK verifier.
        $input = JWT::urlsafeB64Encode(json_encode(['typ' => 'JWT', 'alg' => 'RS256', 'kid' => $kid], JSON_THROW_ON_ERROR))
            . '.' . JWT::urlsafeB64Encode(json_encode($claims, JSON_THROW_ON_ERROR));
        if (!openssl_sign($input, $signature, $key ?? self::$key, OPENSSL_ALGO_SHA256)) throw new RuntimeException('Synthetic signing failed.');
        return $input . '.' . JWT::urlsafeB64Encode($signature);
    }

    private function complete(): ?array
    {
        return $this->google->complete($this->session['context'], $this->query['state'], 'synthetic-private-auth-code');
    }

    private function rejected(callable $operation, int $status = 400): void
    {
        try { $operation(); } catch (RequestRejected $error) {
            self::assertSame($status, $error->status);
            self::assertNull($error->getPrevious());
            self::assertStringNotContainsString('synthetic-private', $error->getMessage());
            self::assertStringNotContainsString('synthetic-private', Security::problem($error)['body']);
            return;
        }
        self::fail('Expected rejected Google confirmation.');
    }

    public function testStartUsesFixedHttpsCodeS256AndExactlyOpenidProfile(): void
    {
        $start = $this->begin();
        self::assertSame(['authorizationUrl', 'expiresAt'], array_keys($start));
        self::assertSame('https://accounts.google.com/o/oauth2/v2/auth', strtok($start['authorizationUrl'], '?'));
        self::assertSame(self::CALLBACK, $this->query['redirect_uri']);
        self::assertSame(self::CLIENT, $this->query['client_id']);
        self::assertSame('openid profile', $this->query['scope']);
        self::assertSame('code', $this->query['response_type']);
        self::assertSame('S256', $this->query['code_challenge_method']);
        self::assertSame('online', $this->query['access_type']);
        self::assertSame('false', $this->query['include_granted_scopes']);
        foreach (['client_secret', 'code_verifier', 'login_hint', 'email', 'prompt', 'returnUrl'] as $absent) self::assertArrayNotHasKey($absent, $this->query);
        self::assertSame($this->now + 600, $start['expiresAt']);
        self::assertSame([], $this->requests);
    }

    public function testRealSdkExchangeAndRsaVerificationReturnsOnlyMinimalPrivateConfirmation(): void
    {
        $this->begin();
        $verifier = $this->database->connection()->query('SELECT pkce_verifier FROM auth_transactions')->fetchColumn();
        $identity = $this->complete();
        self::assertSame(['provider' => 'google', 'subject' => self::SUBJECT, 'displayName' => 'Synthetic player <b>literal</b>',
            'purpose' => 'login', 'expectedAccountId' => null, 'confirmedAt' => $this->now], $identity);
        self::assertCount(2, $this->requests);
        self::assertSame('POST', $this->requests[0]['method']);
        parse_str($this->requests[0]['body'], $body);
        self::assertSame(self::CLIENT, $body['client_id']);
        self::assertSame(self::SECRET, $body['client_secret']);
        self::assertSame(self::CALLBACK, $body['redirect_uri']);
        self::assertSame('authorization_code', $body['grant_type']);
        self::assertSame('synthetic-private-auth-code', $body['code']);
        self::assertSame($verifier, $body['code_verifier']);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertStringNotContainsString('synthetic-private', json_encode($identity));
        foreach (['sessions', 'auth_transactions', 'accounts', 'identities', 'preferences', 'saves', 'write_receipts'] as $table) {
            self::assertStringNotContainsString('synthetic-private', json_encode($this->database->connection()->query('SELECT * FROM ' . $table)->fetchAll()));
        }
        $this->rejected(fn () => $this->complete());
        self::assertCount(2, $this->requests);
    }

    public static function invalidClaims(): iterable
    {
        foreach (['iss', 'aud', 'sub', 'exp', 'iat', 'nonce'] as $claim) {
            yield $claim . '-missing' => [$claim, null, true];
            yield $claim . '-wrong-type' => [$claim, ['wrong-type'], false];
        }
        foreach (['iss' => 'https://other.invalid', 'aud' => 'other-client', 'sub' => '', 'nonce' => 'wrong-nonce',
            'exp' => 1795737600, 'iat' => 1795737601] as $claim => $value) yield $claim . '-invalid' => [$claim, $value, false];
        yield 'aud-own-array' => ['aud', [self::CLIENT], false];
        yield 'aud-multiple' => ['aud', [self::CLIENT, 'other'], false];
        yield 'aud-number' => ['aud', 0, false];
        yield 'sub-number' => ['sub', 123, false];
        yield 'sub-unicode' => ['sub', 'subjecté', false];
        yield 'sub-control' => ['sub', "subject\n", false];
        yield 'sub-overlength' => ['sub', str_repeat('s', 256), false];
        yield 'exp-string' => ['exp', '1795741200', false];
        yield 'exp-float' => ['exp', 1795741200.5, false];
        yield 'iat-negative' => ['iat', -1, false];
        yield 'iat-string' => ['iat', '1795737600', false];
        yield 'azp-wrong' => ['azp', 'other-client', false];
        yield 'azp-wrong-type' => ['azp', [self::CLIENT], false];
    }

    #[DataProvider('invalidClaims')]
    public function testSignedTokensStillRequireEveryTypedBoundClaim(string $claim, mixed $value, bool $remove): void
    {
        $this->begin();
        if ($remove) unset($this->claims[$claim]); else $this->claims[$claim] = $value;
        $this->rejected(fn () => $this->complete());
        self::assertSame($this->now, $this->database->connection()->query('SELECT consumed_at FROM auth_transactions')->fetchColumn());
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM identities')->fetchColumn());
    }

    public function testSignatureAlgorithmKeyIdAndPayloadTamperingAreRejected(): void
    {
        foreach (['wrong-key', 'unknown-kid', 'tampered', 'none', 'hs256', 'malformed'] as $kind) {
            $this->begin();
            $token = $this->token($this->claims);
            $this->tokenOverride = match ($kind) {
                'wrong-key' => $this->token($this->claims, self::$wrongKey),
                'unknown-kid' => $this->token($this->claims, null, 'unknown-key'),
                'tampered' => explode('.', $token)[0] . '.' . JWT::urlsafeB64Encode(json_encode(array_replace($this->claims, ['sub' => 'attacker']))) . '.' . explode('.', $token)[2],
                'none' => JWT::urlsafeB64Encode('{"alg":"none","kid":"synthetic-rsa-1"}') . '.' . JWT::urlsafeB64Encode(json_encode($this->claims)) . '.',
                'hs256' => JWT::encode($this->claims, 'synthetic-private-hmac-secret-32bytes', 'HS256', 'synthetic-rsa-1'),
                'malformed' => 'synthetic-private-invalid-token',
            };
            $this->rejected(fn () => $this->complete());
        }
    }

    public function testLegacyIssuerOptionalDisplayNameAndOwnAzpAreAcceptedWithoutEmailIdentity(): void
    {
        $this->begin();
        $this->claims['iss'] = 'accounts.google.com';
        $this->claims['azp'] = self::CLIENT;
        unset($this->claims['name']);
        $identity = $this->complete();
        self::assertSame(self::SUBJECT, $identity['subject']);
        self::assertNull($identity['displayName']);
        $this->begin();
        $this->claims['name'] = str_repeat('é', 129);
        self::assertNull($this->complete()['displayName']);
        $this->begin();
        $this->claims['name'] = str_repeat('é', 128);
        self::assertSame(str_repeat('é', 128), $this->complete()['displayName']);
    }

    public function testApplicationTimeChecksRejectEvenWithRelaxedLibraryLeeway(): void
    {
        JWT::$leeway = 120;
        $this->begin();
        $this->claims['exp'] = $this->now;
        $this->rejected(fn () => $this->complete());
        $this->begin();
        $this->claims['iat'] = $this->now + 1;
        $this->rejected(fn () => $this->complete());
    }

    public function testExchangeCrossingTransactionDeadlineCannotConfirmIdentity(): void
    {
        $this->begin();
        $this->duringExchange = function () { $this->now += 600; };
        $this->rejected(fn () => $this->complete());
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testMissingMalformedOrUnavailablePublicKeysFailClosed(): void
    {
        foreach ([new Response(200, [], '{"keys":[]}'), new Response(200, [], '{"keys":"bad"}'),
            new Response(503, [], '{"error":"synthetic-private-provider"}')] as $response) {
            $this->begin();
            $this->keysResponse = $response;
            // Invalid upstream key documents are service-unavailable, never invalid user identity.
            $this->rejected(fn () => $this->complete(), 503);
        }
    }

    public function testWrongStateSessionProviderExpiredReplayAndLogoutMakeNoExchange(): void
    {
        $this->begin();
        $other = $this->sessions->bootstrap(null)['context'];
        $this->rejected(fn () => $this->google->complete($other, $this->query['state'], 'code'));
        $this->rejected(fn () => $this->google->complete($this->session['context'], Security::token(), 'code'));
        $github = $this->transactions->begin($this->session['context'], 'github');
        $this->rejected(fn () => $this->google->complete($this->session['context'], $github['state'], 'code'));
        $this->now += 600;
        $this->rejected(fn () => $this->complete());
        $this->begin();
        $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $this->session['context']));
        $this->rejected(fn () => $this->complete());
        self::assertSame([], $this->requests);
    }

    public function testCancellationConsumesStateAndAmbiguousOrOversizedCallbackIsRejected(): void
    {
        $this->begin();
        foreach ([['code', 'access_denied'], [null, null], ['', null], [str_repeat('x', 4097), null], [null, str_repeat('x', 257)], ["code\n", null]] as [$code, $error]) {
            $this->rejected(fn () => $this->google->complete($this->session['context'], $this->query['state'], $code, $error));
        }
        self::assertNull($this->google->complete($this->session['context'], $this->query['state'], null, 'access_denied'));
        $this->rejected(fn () => $this->complete());
        self::assertSame([], $this->requests);
    }

    public function testProviderFailureAndPkceRejectionConsumeStateWithoutLeakingErrors(): void
    {
        foreach ([new Response(400, [], '{"error":"invalid_grant","error_description":"synthetic-private-code"}'),
            new Response(500, [], '{"error":"server_error","error_description":"synthetic-private-body"}'),
            new Response(200, [], '{"access_token":"synthetic-private-access-only"}')] as $i => $response) {
            $this->begin();
            $this->exchangeResponse = $response;
            $this->rejected(fn () => $this->complete(), $i === 1 ? 503 : 400);
            $calls = count($this->requests);
            $this->rejected(fn () => $this->complete());
            self::assertCount($calls, $this->requests);
        }
    }

    public function testRevocationDuringProviderIoCannotBeUsedByFinalSessionCommit(): void
    {
        $this->begin();
        $this->duringExchange = function () {
            $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $this->session['context']));
        };
        // Adapter returns identity evidence only. Actual route must make this final check atomically.
        self::assertSame(self::SUBJECT, $this->complete()['subject']);
        $this->rejected(fn () => $this->database->immediate(fn (PDO $pdo) =>
            $this->sessions->within($pdo, $this->session['context'], fn () => self::fail('Old callback cannot commit'), false)), 401);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testDeleteConfirmationIsPurposeBoundAndDoesNotClaimFreshCredentialEntry(): void
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES (?,?)')->execute([self::ACCOUNT, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES (?,?,?)')->execute([self::ACCOUNT, 'google', self::SUBJECT]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES (?)')->execute([self::ACCOUNT]);
        $this->session = $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $this->session['context'], self::ACCOUNT));
        $this->begin('delete-reauth');
        self::assertSame('select_account', $this->query['prompt']);
        self::assertArrayNotHasKey('max_age', $this->query);
        $identity = $this->complete();
        self::assertSame('delete-reauth', $identity['purpose']);
        self::assertSame(self::ACCOUNT, $identity['expectedAccountId']);
        self::assertArrayNotHasKey('auth_time', $identity);
        self::assertSame(1, $pdo->query('SELECT count(*) FROM accounts')->fetchColumn());
        // Wrong selected identity is still identity evidence, never same-account deletion proof.
        $this->begin('delete-reauth');
        $this->claims['sub'] = 'different-synthetic-sub';
        self::assertNotSame(self::SUBJECT, $this->complete()['subject']);
    }

    public function testConstructorRejectsInsecureOrNoncanonicalCallback(): void
    {
        foreach (['http://game.invalid/auth/google/callback', self::CALLBACK . '?next=other', self::CALLBACK . '#x',
            'https://user:pass@game.invalid/auth/google/callback', 'https://game.invalid/auth/github/callback',
            'https://game.invalid/../auth/google/callback'] as $callback) {
            try { new Google($this->transactions, self::CLIENT, self::SECRET, $callback); }
            catch (InvalidArgumentException) { self::assertTrue(true); continue; }
            self::fail('Expected invalid fixed callback configuration.');
        }
    }
}
