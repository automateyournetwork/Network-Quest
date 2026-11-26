<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use NetworkQuest\Database;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\Identity\GitHub;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Sessions.php';
require_once __DIR__ . '/../src/Identity/AuthTransactions.php';
require_once __DIR__ . '/../src/Identity/ProviderHttp.php';
require_once __DIR__ . '/../src/Identity/GitHub.php';

final class GitHubIdentityTest extends TestCase
{
    private const CLIENT = 'synthetic-github-client';
    private const SECRET = 'synthetic-private-client-secret';
    private const TOKEN = 'synthetic-private-access-token';
    private const CODE = 'synthetic-private-authorization-code';
    private const CALLBACK = 'https://game.invalid/arcade/play/network-quest/api/v1/auth/github/callback';
    private const SUBJECT = 600000040;
    private const ACCOUNT = '60000000-0000-4000-8000-000000000040';
    private TestEnvironment $environment;
    private Database $database;
    private Sessions $sessions;
    private AuthTransactions $transactions;
    private GitHub $github;
    private array $session;
    private array $query = [];
    private array $requests = [];
    private array $tokens;
    private array $user;
    private ?Response $exchangeResponse = null;
    private ?Response $userResponse = null;
    private mixed $duringExchange = null;
    private mixed $duringUser = null;
    private int $now = 1795737600;

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $this->transactions = new AuthTransactions($this->database, $this->sessions, fn () => $this->now);
        $this->tokens = ['access_token' => self::TOKEN, 'scope' => '', 'token_type' => 'bearer'];
        $this->user = ['id' => self::SUBJECT, 'name' => 'Synthetic player <b>literal</b>', 'login' => 'synthetic-login',
            'email' => 'synthetic-private-email@example.invalid', 'repos_url' => 'https://other.invalid/repos'];
        $this->github = new GitHub($this->transactions, self::CLIENT, self::SECRET, self::CALLBACK, fn () => $this->now,
            function ($request, $options) {
                self::assertFalse($this->database->connection()->inTransaction(), 'Provider IO must not hold the SQLite transaction.');
                $query = $this->database->connection()->prepare('SELECT consumed_at FROM auth_transactions WHERE state_hash=?');
                $query->execute([hash('sha256', $this->query['state'])]);
                $row = $query->fetch();
                self::assertIsInt($row['consumed_at'], 'Consume state before even the first provider request.');
                self::assertTrue($options['verify']);
                self::assertFalse($options['allow_redirects']);
                self::assertFalse($options['debug']);
                self::assertFalse($options['cookies']);
                self::assertSame('', $options['proxy']);
                self::assertSame(10.0, $options['timeout']);
                self::assertSame(3.0, $options['connect_timeout']);
                $this->requests[] = ['method' => $request->getMethod(), 'url' => (string) $request->getUri(),
                    'body' => (string) $request->getBody(), 'accept' => $request->getHeaderLine('Accept'),
                    'authorization' => $request->getHeaderLine('Authorization'), 'userAgent' => $request->getHeaderLine('User-Agent')];
                if ((string) $request->getUri() === 'https://github.com/login/oauth/access_token') {
                    if ($this->duringExchange !== null) ($this->duringExchange)($request);
                    return Create::promiseFor($this->exchangeResponse ?? self::json($this->tokens));
                }
                self::assertSame('https://api.github.com/user', (string) $request->getUri());
                if ($this->duringUser !== null) ($this->duringUser)();
                return Create::promiseFor($this->userResponse ?? self::json($this->user));
            });
        $this->session = $this->sessions->bootstrap(null);
    }

    protected function tearDown(): void
    {
        unset($this->github, $this->transactions, $this->sessions, $this->database);
        if (isset($this->environment)) $this->environment->close();
    }

    private static function json(array $body, int $status = 200): Response
    {
        return new Response($status, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR | JSON_PRESERVE_ZERO_FRACTION));
    }

    private function begin(string $purpose = 'login'): array
    {
        $start = $this->github->start($this->session['context'], $purpose);
        parse_str(parse_url($start['authorizationUrl'], PHP_URL_QUERY), $this->query);
        return $start;
    }

    private function complete(): ?array
    {
        return $this->github->complete($this->session['context'], $this->query['state'], self::CODE);
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
        self::fail('Expected rejected GitHub identity confirmation.');
    }

    public function testAuthorizationUrlUsesExplicitEmptyScopeFixedCallbackAndStoredS256(): void
    {
        $start = $this->begin();
        self::assertSame(['authorizationUrl', 'expiresAt'], array_keys($start));
        self::assertSame('https://github.com/login/oauth/authorize', strtok($start['authorizationUrl'], '?'));
        self::assertSame(self::CLIENT, $this->query['client_id']);
        self::assertSame(self::CALLBACK, $this->query['redirect_uri']);
        self::assertArrayHasKey('scope', $this->query, 'Omitting scope can inherit earlier grants.');
        self::assertSame('', $this->query['scope']);
        self::assertSame('code', $this->query['response_type']);
        self::assertSame('S256', $this->query['code_challenge_method']);
        $row = $this->database->connection()->query('SELECT * FROM auth_transactions')->fetch();
        self::assertSame(hash('sha256', $this->query['state']), $row['state_hash']);
        self::assertSame($this->session['context']->idHash, $row['session_hash']);
        self::assertNull($row['nonce_hash']);
        self::assertSame(rtrim(strtr(base64_encode(hash('sha256', $row['pkce_verifier'], true)), '+/', '-_'), '='), $this->query['code_challenge']);
        foreach (['client_secret', 'code_verifier', 'email', 'login', 'returnUrl', 'nonce', 'prompt', 'max_age', 'approval_prompt'] as $absent) {
            self::assertArrayNotHasKey($absent, $this->query);
        }
        self::assertSame($this->now + 600, $start['expiresAt']);
        self::assertSame([], $this->requests);
    }

    public function testRealGenericProviderExchangesThenFetchesOnlyAuthenticatedUserAndDiscardsTokens(): void
    {
        $this->tokens += ['refresh_token' => 'synthetic-private-refresh-token', 'expires_in' => 28800, 'refresh_token_expires_in' => 15897600];
        $this->begin();
        $verifier = $this->database->connection()->query('SELECT pkce_verifier FROM auth_transactions')->fetchColumn();
        $identity = $this->complete();
        self::assertSame(['provider' => 'github', 'subject' => (string) self::SUBJECT, 'displayName' => 'Synthetic player <b>literal</b>',
            'purpose' => 'login', 'expectedAccountId' => null, 'confirmedAt' => $this->now], $identity);
        self::assertCount(2, $this->requests);
        self::assertSame('POST', $this->requests[0]['method']);
        self::assertSame('https://github.com/login/oauth/access_token', $this->requests[0]['url']);
        self::assertSame('application/json', $this->requests[0]['accept']);
        self::assertSame('', $this->requests[0]['authorization']);
        parse_str($this->requests[0]['body'], $body);
        self::assertSame(['client_id' => self::CLIENT, 'client_secret' => self::SECRET, 'redirect_uri' => self::CALLBACK,
            'code_verifier' => $verifier, 'grant_type' => 'authorization_code', 'code' => self::CODE], $body);
        self::assertSame('GET', $this->requests[1]['method']);
        self::assertSame('https://api.github.com/user', $this->requests[1]['url']);
        self::assertSame('', $this->requests[1]['body']);
        self::assertSame('Bearer ' . self::TOKEN, $this->requests[1]['authorization']);
        self::assertSame('Network-Quest/1', $this->requests[1]['userAgent']);
        self::assertStringNotContainsString('synthetic-private', json_encode($identity));
        foreach (['accounts', 'identities', 'preferences', 'saves', 'write_receipts'] as $table) {
            self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM ' . $table)->fetchColumn());
        }
        foreach (['sessions', 'auth_transactions'] as $table) {
            self::assertStringNotContainsString('synthetic-private', json_encode($this->database->connection()->query('SELECT * FROM ' . $table)->fetchAll()));
        }
        $this->rejected(fn () => $this->complete());
        self::assertCount(2, $this->requests);
    }

    public static function invalidIds(): iterable
    {
        foreach ([null, '', '600000040', '00600000040', '1e3', 'not-an-id', 0, -1, 1.0, 1.5, true, [], ['id' => 1], 9.223372036854776e18] as $id) yield [$id];
    }

    #[DataProvider('invalidIds')]
    public function testOnlyPositiveJsonIntegerIdCanEstablishIdentity(mixed $id): void
    {
        $this->begin();
        $this->user['id'] = $id;
        $this->rejected(fn () => $this->complete());
        self::assertCount(2, $this->requests);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM identities')->fetchColumn());
    }

    public function testIdentityIgnoresEmailLoginAndTokenResourceOwnerAndPreservesIntegerPrecision(): void
    {
        $this->tokens['resource_owner_id'] = 'synthetic-private-wrong-id';
        $this->begin();
        $this->user['id'] = PHP_INT_MAX;
        $identity = $this->complete();
        self::assertSame((string) PHP_INT_MAX, $identity['subject']);
        $this->begin();
        $this->user['name'] = 'Changed presentation name';
        $this->user['login'] = 'different-login';
        $this->user['email'] = 'different@example.invalid';
        self::assertSame($identity['subject'], $this->complete()['subject']);
        $this->begin();
        unset($this->user['id']);
        $this->rejected(fn () => $this->complete());
    }

    public function testParallelAttemptsKeepIndependentVerifiersWhenCompletedOutOfOrder(): void
    {
        $this->begin();
        $first = $this->query;
        $this->begin();
        $second = $this->query;
        self::assertNotSame($first['state'], $second['state']);
        self::assertNotSame($first['code_challenge'], $second['code_challenge']);
        $this->duringExchange = function ($request) {
            parse_str((string) $request->getBody(), $body);
            self::assertSame($this->query['code_challenge'], rtrim(strtr(base64_encode(hash('sha256', $body['code_verifier'], true)), '+/', '-_'), '='));
            // A replay during the outstanding HTTP exchange is already consumed, too.
            $this->rejected(fn () => $this->complete());
        };
        foreach ([$second, $first] as $query) {
            $this->query = $query;
            self::assertSame((string) self::SUBJECT, $this->complete()['subject']);
        }
        self::assertCount(4, $this->requests);
    }

    public static function invalidTokens(): iterable
    {
        foreach (['', ' ', "synthetic-private\ntoken", [], true, 123, str_repeat('a', 4097)] as $value) yield ['access_token', $value];
        foreach ([null, [], 1, 'mac'] as $value) yield ['token_type', $value];
        foreach ([null, [], 'repo', 'user:email', 'read:user', 'offline_access', ' '] as $value) yield ['scope', $value];
    }

    #[DataProvider('invalidTokens')]
    public function testMalformedOrOverprivilegedTokenCannotReachUserEndpoint(string $field, mixed $value): void
    {
        $this->begin();
        $this->tokens[$field] = $value;
        $this->rejected(fn () => $this->complete());
        self::assertCount(1, $this->requests);
        $this->rejected(fn () => $this->complete());
        self::assertCount(1, $this->requests);
    }

    public function testMissingRequiredTokenFieldsAreRejectedAndBearerCaseIsInsensitive(): void
    {
        foreach (['scope', 'token_type', 'access_token'] as $field) {
            $this->begin();
            $tokens = $this->tokens;
            unset($this->tokens[$field]);
            $this->rejected(fn () => $this->complete());
            $this->tokens = $tokens;
        }
        $this->tokens['token_type'] = 'Bearer';
        $this->begin();
        self::assertSame((string) self::SUBJECT, $this->complete()['subject']);
    }

    public function testOptionalNameIsBoundedUtf8PresentationTextOnly(): void
    {
        foreach ([null, [], '', '  ', str_repeat('é', 129), "bad\nname"] as $name) {
            $this->begin();
            $this->user['name'] = $name;
            self::assertNull($this->complete()['displayName']);
        }
        $this->begin();
        $this->user['name'] = str_repeat('é', 128);
        self::assertSame($this->user['name'], $this->complete()['displayName']);
    }

    public function testWrongStateSessionProviderExpiryAndLogoutAreRejectedBeforeProviderIo(): void
    {
        $this->begin();
        $other = $this->sessions->bootstrap(null);
        $this->rejected(fn () => $this->github->complete($other['context'], $this->query['state'], self::CODE));
        foreach (['', 'malformed', Security::token()] as $state) {
            $this->rejected(fn () => $this->github->complete($this->session['context'], $state, self::CODE));
        }
        $google = $this->transactions->begin($this->session['context'], 'google');
        $this->rejected(fn () => $this->github->complete($this->session['context'], $google['state'], self::CODE));
        $this->now += 600;
        $this->rejected(fn () => $this->complete());
        $this->begin();
        $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $this->session['context']));
        $this->rejected(fn () => $this->complete());
        self::assertSame([], $this->requests);
    }

    public function testCancelConsumesStateWithNoSessionAccountOrProviderChange(): void
    {
        $this->begin();
        $before = $this->database->connection()->query('SELECT * FROM sessions')->fetchAll();
        self::assertNull($this->github->complete($this->session['context'], $this->query['state'], null, 'access_denied'));
        self::assertSame($before, $this->database->connection()->query('SELECT * FROM sessions')->fetchAll());
        self::assertSame([], $this->requests);
        $this->rejected(fn () => $this->github->complete($this->session['context'], $this->query['state'], null, 'access_denied'));
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testAmbiguousMissingOrMalformedCallbackDoesNotConsumeValidState(): void
    {
        $this->begin();
        foreach ([[self::CODE, 'access_denied'], [null, null], ['', null], ["bad\ncode", null], [str_repeat('x', 4097), null],
            [null, ''], [null, '<script>'], [null, str_repeat('a', 257)]] as [$code, $error]) {
            $this->rejected(fn () => $this->github->complete($this->session['context'], $this->query['state'], $code, $error));
        }
        self::assertNull($this->database->connection()->query('SELECT consumed_at FROM auth_transactions')->fetchColumn());
        self::assertSame([], $this->requests);
    }

    public function testProviderCallbackErrorsConsumeAndReturnOnlySanitizedProblems(): void
    {
        foreach (['server_error' => 503, 'temporarily_unavailable' => 503, 'invalid_scope' => 400] as $error => $status) {
            $this->begin();
            $this->rejected(fn () => $this->github->complete($this->session['context'], $this->query['state'], null, $error), $status);
            $this->rejected(fn () => $this->complete());
        }
        self::assertSame([], $this->requests);
    }

    public function testPkceMismatchIsSentToProviderAndRejectedWithoutUserFetch(): void
    {
        $this->begin();
        $this->database->connection()->prepare('UPDATE auth_transactions SET pkce_verifier=?')->execute([Security::token()]);
        $this->duringExchange = function ($request) {
            parse_str((string) $request->getBody(), $body);
            self::assertNotSame($this->query['code_challenge'], rtrim(strtr(base64_encode(hash('sha256', $body['code_verifier'], true)), '+/', '-_'), '='));
            $this->exchangeResponse = self::json(['error' => 'bad_verification_code', 'error_description' => 'synthetic-private-details'], 400);
        };
        $this->rejected(fn () => $this->complete());
        self::assertCount(1, $this->requests);
    }

    public function testProviderFailuresNeverLeakResponsesRetryOrLeaveStateReusable(): void
    {
        foreach ([self::json(['error' => 'incorrect_client_credentials']), self::json(['error' => 'server_error'], 400),
            self::json($this->tokens, 302), new Response(200, [], 'not-json'), new Response(200, [], '[]'),
            new Response(200, [], str_repeat('x', 65537))] as $response) {
            $this->begin();
            $this->exchangeResponse = $response;
            $before = count($this->requests);
            $this->rejected(fn () => $this->complete(), 503);
            self::assertCount($before + 1, $this->requests);
            $this->rejected(fn () => $this->complete());
            self::assertCount($before + 1, $this->requests);
        }
        $this->begin();
        $this->duringExchange = static fn () => throw new RuntimeException('synthetic-private-network-details');
        $this->rejected(fn () => $this->complete(), 503);
    }

    public function testUnauthorizedRedirectedMalformedAndOversizedUserResponsesNeverIdentify(): void
    {
        foreach ([self::json($this->user, 401), self::json($this->user, 302), new Response(200, [], 'null'),
            new Response(200, [], '[]'), new Response(200, [], '{'), new Response(200, [], str_repeat('x', 65537))] as $response) {
            $this->begin();
            $this->userResponse = $response;
            $this->rejected(fn () => $this->complete(), 503);
        }
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testExpiryDuringProviderRoundtripCannotConfirm(): void
    {
        $this->begin();
        $this->duringExchange = function () { $this->now += 600; };
        $this->rejected(fn () => $this->complete());
        $this->duringExchange = null;
        $this->begin();
        $this->duringUser = function () { $this->now += 600; };
        $this->rejected(fn () => $this->complete());
    }

    public function testLastUnexpiredSecondWorksAndBackwardsClockFails(): void
    {
        $this->begin();
        $this->now += 599;
        self::assertSame($this->now, $this->complete()['confirmedAt']);
        $this->begin();
        $this->duringUser = function () { $this->now--; };
        $this->rejected(fn () => $this->complete());
    }

    public function testFinalSessionRecheckMustRejectRevocationDuringProviderIo(): void
    {
        $this->begin();
        $this->duringUser = function () {
            $this->database->immediate(fn (PDO $pdo) => $this->sessions->revokeWithin($pdo, $this->session['context']));
        };
        self::assertSame((string) self::SUBJECT, $this->complete()['subject'], 'Identity evidence alone does not authorize account mutation.');
        $this->rejected(fn () => $this->database->immediate(fn (PDO $pdo) => $this->sessions->within($pdo,
            $this->session['context'], fn () => self::fail('Revoked callback must not commit'), false)), 401);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM accounts')->fetchColumn());
    }

    public function testDeleteReauthRequiresNewPurposeBoundRoundtripAndStillNeedsAccountComparison(): void
    {
        $this->rejected(fn () => $this->begin('delete-reauth'), 401);
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES (?,?)')->execute([self::ACCOUNT, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES (?,?,?)')->execute([self::ACCOUNT, 'github', (string) self::SUBJECT]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES (?)')->execute([self::ACCOUNT]);
        $this->session = $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $this->session['context'], self::ACCOUNT));
        $this->begin('delete-reauth');
        self::assertSame('select_account', $this->query['prompt']);
        self::assertArrayNotHasKey('max_age', $this->query);
        $identity = $this->complete();
        self::assertSame('delete-reauth', $identity['purpose']);
        self::assertSame(self::ACCOUNT, $identity['expectedAccountId']);
        self::assertSame($this->now, $identity['confirmedAt']);
        self::assertArrayNotHasKey('auth_time', $identity);
        $this->begin('delete-reauth');
        $this->user['id'] = self::SUBJECT + 1;
        $identity = $this->complete();
        self::assertSame(self::ACCOUNT, $identity['expectedAccountId']);
        self::assertNotSame((string) self::SUBJECT, $identity['subject'], 'T041 must reject mismatched existing identity before issuing deletion proof.');
        self::assertSame(1, $pdo->query('SELECT count(*) FROM accounts')->fetchColumn());
        self::assertSame(1, $pdo->query('SELECT count(*) FROM identities')->fetchColumn());
    }

    public function testConstructorRejectsNoncanonicalCallbackAndMalformedCredentials(): void
    {
        foreach (['http://game.invalid/auth/github/callback', self::CALLBACK . '?next=other', self::CALLBACK . '#x',
            'https://user:pass@game.invalid/auth/github/callback', 'https://game.invalid/auth/google/callback',
            'https://game.invalid/../auth/github/callback', 'https://game.invalid:65536/auth/github/callback'] as $callback) {
            try { new GitHub($this->transactions, self::CLIENT, self::SECRET, $callback); }
            catch (InvalidArgumentException) { self::assertTrue(true); continue; }
            self::fail('Expected invalid callback configuration.');
        }
        foreach ([['', self::SECRET], ['bad id', self::SECRET], [self::CLIENT, ''], [self::CLIENT, "secret\n"]] as [$id, $secret]) {
            try { new GitHub($this->transactions, $id, $secret, self::CALLBACK); }
            catch (InvalidArgumentException) { self::assertTrue(true); continue; }
            self::fail('Expected invalid private credentials.');
        }
    }
}
