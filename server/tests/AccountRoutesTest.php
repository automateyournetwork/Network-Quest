<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountDeletion;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Routes\Account;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['Database', 'Security', 'Sessions', 'AccountAccess', 'DeletionLedger', 'RecoveryAccountAccess', 'AccountDeletion', 'Routes/Account'] as $file) {
    if (is_file(__DIR__ . '/../src/' . $file . '.php')) require_once __DIR__ . '/../src/' . $file . '.php';
}

/** Real private services at handler ports, plus one explicitly configured native HTTPS join. */
final class AccountRoutesTest extends TestCase
{
    private TestEnvironment $game;
    private TestEnvironment $external;
    private Database $database;
    private DeletionLedger $ledger;
    private RecoveryAccountAccess $access;
    private Security $security;
    private Sessions $sessions;
    private Account $route;
    private array $auth;
    private array $other;
    private string $token;
    private int $now = 1795737600;
    private const ACCOUNT = '85000000-0000-4000-8000-000000000001';
    private const OTHER = '85000000-0000-4000-8000-000000000002';
    private const ORIGIN = 'https://network-quest.invalid';
    private const COOKIE_PATH = '/scoped/game/';
    private const TABLES = ['accounts', 'identities', 'preferences', 'saves', 'write_receipts', 'sessions', 'auth_transactions', 'delete_reauth_proofs'];

    protected function setUp(): void
    {
        $this->game = TestEnvironment::create(); $this->external = TestEnvironment::create();
        $this->game->connect(); $this->external->connect(); $this->external->writeFile('synthetic.sqlite.lock', '');
        $roots = [realpath(__DIR__ . '/../..')];
        $this->database = Database::open($this->game->directory() . '/synthetic.sqlite', $roots); $this->database->migrate();
        $this->ledger = DeletionLedger::initialize($this->external->directory() . '/synthetic.sqlite', $roots, [$this->game->directory()],
            new DeletionRetentionPolicy(2592000, 604800, 'T046-synthetic-only'));
        $this->access = new RecoveryAccountAccess($this->database, $this->ledger, fn () => $this->now);
        $this->sessions = new Sessions($this->database, fn () => $this->now, self::COOKIE_PATH);
        $this->security = new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn () => $this->now);
        $pdo = $this->database->connection();
        foreach ([self::ACCOUNT, self::OTHER] as $account) {
            $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$account, $this->now]);
            $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$account, 'google', 'synthetic-' . $account]);
            $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$account]);
            $payload = '{"synthetic":"private-progress-' . $account . '"}';
            $pdo->prepare('INSERT INTO saves VALUES(?,?,?,?,?,?,?,?,?)')->execute([$account, 7, $this->now, 1, 'synthetic', $account,
                $payload, hash('sha256', $payload), '{}']);
            $pdo->prepare('INSERT INTO write_receipts(account_id,request_id,fingerprint,committed_revision,committed_at,expires_at) VALUES(?,?,?,?,?,?)')
                ->execute([$account, $account, str_repeat('a', 64), 7, $this->now, $this->now + 604800]);
        }
        $this->auth = $this->login(self::ACCOUNT); $this->other = $this->login(self::OTHER);
        $this->token = Security::token();
        $this->route = new Account($this->database, $this->sessions, $this->security, $this->access,
            new AccountDeletion($this->database, $this->sessions, $this->security, $this->access, $this->ledger, fn () => $this->now));
    }

    protected function tearDown(): void
    { unset($this->route, $this->access, $this->ledger, $this->sessions, $this->security, $this->database); $this->external->close(); $this->game->close(); }

    private function login(string $account): array
    {
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $guest['context'], $account));
    }
    private function proof(?array $auth = null, int $age = 0): void
    {
        $auth ??= $this->auth;
        $this->database->connection()->prepare('INSERT INTO delete_reauth_proofs VALUES(?,?,?,?)')
            ->execute([$auth['context']->idHash, $auth['context']->accountId, $this->now - $age, $this->now - $age + 300]);
    }
    private function attempt(array $auth): void
    {
        $this->database->connection()->prepare('INSERT INTO auth_transactions(state_hash,session_hash,provider,purpose,expected_account_id,nonce_hash,pkce_verifier,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?)')
            ->execute([hash('sha256', Security::token()), $auth['context']->idHash, 'google', 'delete-reauth', $auth['context']->accountId,
                str_repeat('b', 64), str_repeat('x', 43), $this->now, $this->now + 600]);
    }
    private function headers(bool $deletion = false, array $changes = []): array
    {
        $values = ['Origin' => self::ORIGIN, 'Cookie' => explode(';', $this->auth['setCookie'], 2)[0], 'X-CSRF-Token' => $this->auth['csrfToken']];
        if ($deletion) $values += ['X-Confirm-Account-Deletion' => 'delete-my-account', 'X-Deletion-Receipt' => $this->token];
        foreach ($changes as $key => $value) { if ($value === null) unset($values[$key]); else $values[$key] = $value; }
        return array_map(fn ($key) => [$key, $values[$key]], array_keys($values));
    }
    private function request(string $method, string $path, ?array $headers = null, string $body = '', string $query = '', string $peer = '127.0.0.1'): array
    {
        $stream = fopen('php://temp', 'w+b'); fwrite($stream, $body); rewind($stream);
        try { return $this->route->handle($method, $path, $query, $headers ?? $this->headers($method === 'DELETE'), $stream, $peer); }
        finally { fclose($stream); }
    }
    private function rows(string $table): array { return $this->database->connection()->query('SELECT * FROM ' . $table . ' ORDER BY rowid')->fetchAll(); }
    private function graph(): array { return array_combine(self::TABLES, array_map($this->rows(...), self::TABLES)); }
    private function receipt(): ?array { return $this->ledger->exclusive(fn () => $this->ledger->receipt(hash('sha256', $this->token), $this->now)); }
    private function privateResponse(array $response): void
    {
        self::assertSame('no-store', $response['headers']['Cache-Control']);
        self::assertSame('no-referrer', $response['headers']['Referrer-Policy']);
        self::assertSame('nosniff', $response['headers']['X-Content-Type-Options']);
        self::assertMatchesRegularExpression('/^[a-f0-9-]{36}$/D', $response['headers']['X-Request-Id']);
        $public = json_encode($response, JSON_THROW_ON_ERROR);
        foreach ([$this->token, self::ACCOUNT, self::OTHER, 'private-progress', $this->auth['csrfToken']] as $secret) self::assertStringNotContainsString($secret, $public);
        if ($response['body'] !== '') self::assertSame($response['headers']['X-Request-Id'], json_decode($response['body'], true)['requestId']);
    }

    public function testLogoutRevokesOnlyCurrentSessionAndItsAttemptsProofWithoutChangingSlot(): void
    {
        $second = $this->login(self::ACCOUNT);
        foreach ([$this->auth, $second, $this->other] as $auth) { $this->proof($auth); $this->attempt($auth); }
        $before = $this->graph();
        $response = $this->request('POST', '/logout');
        self::assertSame(204, $response['status']); self::assertSame('', $response['body']);
        self::assertSame('__Secure-nq_session=; Path=' . self::COOKIE_PATH . '; Secure; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', $response['headers']['Set-Cookie']);
        foreach (['accounts', 'identities', 'preferences', 'saves', 'write_receipts'] as $table) self::assertSame($before[$table], $this->rows($table));
        foreach (['sessions' => 'id_hash', 'auth_transactions' => 'session_hash', 'delete_reauth_proofs' => 'session_hash'] as $table => $key) {
            self::assertSame(array_values(array_filter($before[$table], fn ($row) => $row[$key] !== $this->auth['context']->idHash)), $this->rows($table));
        }
        self::assertSame([], $this->ledger->exclusive(fn () => $this->ledger->markers())); $this->privateResponse($response);
        $again = $this->request('POST', '/logout'); self::assertSame(401, $again['status']); self::assertArrayNotHasKey('Set-Cookie', $again['headers']);
    }

    public function testGuestLogoutRevokesAnExistingGuestWithoutCreatingAnother(): void
    {
        $this->auth = $this->sessions->bootstrap(null); $before = $this->rows('accounts');
        $response = $this->request('POST', '/logout'); self::assertSame(204, $response['status']);
        self::assertCount(2, $this->rows('sessions')); self::assertSame($before, $this->rows('accounts'));
    }

    #[DataProvider('logoutRejections')]
    public function testLogoutRejectedAdmissionPreservesCurrentSession(array $changes, int $expected): void
    {
        $before = $this->graph(); $response = $this->request('POST', '/logout', $this->headers(false, $changes));
        self::assertSame($expected, $response['status']); self::assertSame($before, $this->graph());
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']); $this->privateResponse($response);
    }
    public static function logoutRejections(): array
    { return [[['Origin' => null], 403], [['Origin' => 'https://network-quest.invalid/'], 403], [['X-CSRF-Token' => null], 403], [['Cookie' => null], 401]]; }

    public function testExpiredLogoutDoesNotRefreshOrCreateASession(): void
    {
        $this->now += 7200; $before = $this->graph(); $response = $this->request('POST', '/logout');
        self::assertSame(401, $response['status']); self::assertSame($before, $this->graph()); self::assertArrayNotHasKey('Set-Cookie', $response['headers']);
    }

    public function testLogoutRechecksSessionAfterAdmissionBeforeRevoking(): void
    {
        $this->database->connection()->exec('CREATE TRIGGER synthetic_revoke AFTER UPDATE OF last_activity ON sessions BEGIN DELETE FROM sessions WHERE id_hash=NEW.id_hash; END');
        $response = $this->request('POST', '/logout'); self::assertSame(401, $response['status']);
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']); self::assertCount(2, $this->rows('saves'));
    }

    public function testLogoutCommitFailureDoesNotExpireCookieOrRemoveAnything(): void
    {
        $this->proof(); $this->attempt($this->auth); $before = $this->graph();
        $this->database->connection()->exec("CREATE TRIGGER synthetic_fail BEFORE DELETE ON sessions BEGIN SELECT RAISE(ABORT, 'private-storage-error'); END");
        $response = $this->request('POST', '/logout'); self::assertSame(503, $response['status']); self::assertSame($before, $this->graph());
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']); self::assertStringNotContainsString('private-storage-error', $response['body']); $this->privateResponse($response);
    }

    public function testLogoutUsesRecoveryBarrierBeforeAnyCurrentAccountAccess(): void
    {
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, hash('sha256', $this->token), $this->now));
        $response = $this->request('POST', '/logout'); self::assertSame(401, $response['status']);
        self::assertSame('completed', $this->receipt()['state']); self::assertSame([self::OTHER], array_column($this->rows('accounts'), 'id'));
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']);
    }

    public function testConfirmedDeleteRemovesFullCurrentAccountGraphOnlyAfterDurableCompletion(): void
    {
        $this->proof(); $this->attempt($this->auth); $second = $this->login(self::ACCOUNT); $this->proof($second); $this->attempt($second);
        $before = $this->graph(); $response = $this->request('DELETE', '/account');
        self::assertSame(204, $response['status']); self::assertSame('', $response['body']); self::assertSame('completed', $this->receipt()['state']);
        foreach (self::TABLES as $table) {
            $key = $table === 'accounts' ? 'id' : 'account_id';
            if ($table === 'auth_transactions') $key = 'expected_account_id';
            self::assertSame(array_values(array_filter($before[$table], fn ($row) => $row[$key] !== self::ACCOUNT)), $this->rows($table));
        }
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']); $this->privateResponse($response);
        self::assertSame(401, $this->request('DELETE', '/account')['status']);
    }

    #[DataProvider('proofAges')]
    public function testDeleteRequiresPurposeProofWithExactFiveMinuteBoundary(?int $age, int $expected): void
    {
        if ($age !== null) $this->proof(age: $age);
        $response = $this->request('DELETE', '/account'); self::assertSame($expected, $response['status']);
        if ($expected !== 204) { self::assertNull($this->receipt()); self::assertCount(2, $this->rows('accounts')); }
        $this->privateResponse($response);
    }
    public static function proofAges(): array { return [[null, 403], [299, 204], [300, 204], [301, 403], [-1, 403]]; }

    public function testAnotherSessionOrAccountProofCannotAuthorizeDeletion(): void
    {
        $this->proof($this->login(self::ACCOUNT)); $this->proof($this->other);
        $response = $this->request('DELETE', '/account'); self::assertSame(403, $response['status']); self::assertNull($this->receipt());
        self::assertCount(2, $this->rows('saves'));
    }

    public function testGuestAndExpiredSessionsCannotDeleteOrBootstrapAnAccount(): void
    {
        $signedIn = $this->auth; $this->proof(); $this->auth = $this->sessions->bootstrap(null);
        $before = $this->graph(); $guest = $this->request('DELETE', '/account');
        self::assertSame(401, $guest['status']); self::assertSame($before, $this->graph()); self::assertNull($this->receipt());
        $this->auth = $signedIn; $this->now += 7200; $expired = $this->request('DELETE', '/account');
        self::assertSame(401, $expired['status']); self::assertSame($before, $this->graph()); self::assertNull($this->receipt());
        $this->privateResponse($guest); $this->privateResponse($expired);
    }

    #[DataProvider('deleteRejections')]
    public function testDeleteRequiresOriginCsrfConfirmationAndCanonicalReceipt(array $changes, int $expected): void
    {
        $this->proof(); $response = $this->request('DELETE', '/account', $this->headers(true, $changes));
        self::assertSame($expected, $response['status']); self::assertNull($this->receipt()); self::assertCount(2, $this->rows('accounts')); $this->privateResponse($response);
    }
    public static function deleteRejections(): array
    { return [[['Origin' => null], 403], [['Origin' => 'null'], 403], [['X-CSRF-Token' => null], 403], [['Cookie' => null], 401],
        [['X-Confirm-Account-Deletion' => null], 403], [['X-Confirm-Account-Deletion' => 'true'], 403], [['X-Deletion-Receipt' => null], 400],
        [['X-Deletion-Receipt' => str_repeat('A', 42) . 'B'], 400], [['X-Deletion-Receipt' => str_repeat('A', 43) . '='], 400]]; }

    #[DataProvider('invalidEnvelopes')]
    public function testNoBodyQuerySelectorOrWrongMethodCanInvokeAnAccountOperation(string $method, string $path, string $body, string $query, int $expected): void
    {
        $this->proof(); $before = $this->graph(); $response = $this->request($method, $path, $this->headers(true), $body, $query);
        self::assertSame($expected, $response['status']); self::assertSame($before, $this->graph()); self::assertNull($this->receipt()); $this->privateResponse($response);
    }
    public static function invalidEnvelopes(): array
    { return [['GET', '/logout', '', '', 400], ['POST', '/account', '', '', 400], ['DELETE', '/logout', '', '', 400],
        ['DELETE', '/account/', '', '', 400], ['POST', '/logout', '', 'accountId=other', 400], ['DELETE', '/account', '', 'accountId=other', 400],
        ['POST', '/logout', '{}', '', 413], ['DELETE', '/account', '{"accountId":"other"}', '', 413]]; }

    public function testDuplicateHeadersFramingAndInvalidPeerAreRejectedBeforeDeletion(): void
    {
        $this->proof(); $before = $this->graph();
        foreach ([array_merge($this->headers(true), [['x-deletion-receipt', $this->token]]),
            array_merge($this->headers(true), [['Content-Length', '0'], ['Transfer-Encoding', 'chunked']])] as $headers) {
            self::assertSame(400, $this->request('DELETE', '/account', $headers)['status']);
        }
        self::assertSame(400, $this->request('DELETE', '/account', peer: 'not-an-address')['status']);
        self::assertSame($before, $this->graph()); self::assertNull($this->receipt());
    }

    public function testReceiptFromAnotherOperationConflictsWithoutDeletingCurrentAccount(): void
    {
        $this->proof(); $this->ledger->exclusive(fn () => $this->ledger->accept(self::OTHER, hash('sha256', $this->token), $this->now));
        $response = $this->request('DELETE', '/account'); self::assertSame(409, $response['status']);
        self::assertSame('deletion-receipt-conflict', json_decode($response['body'], true)['code']);
        self::assertSame([self::ACCOUNT], array_column($this->rows('accounts'), 'id'));
        self::assertSame([self::OTHER], array_column($this->ledger->exclusive(fn () => $this->ledger->markers()), 'accountId')); $this->privateResponse($response);
    }

    public function testCompletedReceiptCannotDeleteALaterAuthenticatedAccount(): void
    {
        $this->proof(); self::assertSame(204, $this->request('DELETE', '/account')['status']);
        $this->auth = $this->other; $this->proof(); $before = $this->graph();
        $response = $this->request('DELETE', '/account'); self::assertSame(409, $response['status']);
        self::assertSame($before, $this->graph()); self::assertSame('completed', $this->receipt()['state']);
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']); $this->privateResponse($response);
    }

    public function testDeletionQuotaReturnsRetryAfterWithoutIntent(): void
    {
        for ($i = 0; $i < 3; $i++) self::assertSame(403, $this->request('DELETE', '/account')['status']);
        $this->proof(); $response = $this->request('DELETE', '/account'); self::assertSame(429, $response['status']);
        self::assertGreaterThan(0, (int) $response['headers']['Retry-After']); self::assertNull($this->receipt()); $this->privateResponse($response);
    }

    public function testLiveDeleteFailureIsUnconfirmedAndNeverReportedAsSuccess(): void
    {
        $this->proof(); $this->database->connection()->exec("CREATE TRIGGER synthetic_fail BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT, 'private-storage-error'); END");
        $response = $this->request('DELETE', '/account'); self::assertSame(503, $response['status']); self::assertSame('pending', $this->receipt()['state']);
        self::assertCount(2, $this->rows('accounts')); self::assertArrayNotHasKey('Set-Cookie', $response['headers']); $this->privateResponse($response);
        self::assertStringNotContainsString('private-storage-error', $response['body']);
    }

    public function testCompletionFailureIsUnconfirmedEvenAfterAccountRowsAreGone(): void
    {
        $this->proof(); $this->external->connect()->exec("CREATE TRIGGER synthetic_fail BEFORE UPDATE ON deletion_markers BEGIN SELECT RAISE(ABORT, 'private-storage-error'); END");
        $response = $this->request('DELETE', '/account'); self::assertSame(503, $response['status']); self::assertSame('pending', $this->receipt()['state']);
        self::assertSame([self::OTHER], array_column($this->rows('accounts'), 'id')); $this->privateResponse($response);
    }

    public function testUnavailableRecoveryArtifactFailsClosedForBothAccountActions(): void
    {
        $this->proof(); $before = $this->graph(); $path = $this->external->directory() . '/synthetic.sqlite.lock'; chmod($path, 0644);
        try {
            foreach ([['POST', '/logout'], ['DELETE', '/account']] as [$method, $path]) {
                $response = $this->request($method, $path); self::assertSame(503, $response['status']);
                self::assertSame($before, $this->graph()); self::assertArrayNotHasKey('Set-Cookie', $response['headers']); $this->privateResponse($response);
            }
        } finally { chmod($this->external->directory() . '/synthetic.sqlite.lock', 0600); }
    }

    public function testActualConfiguredHttpsEntryJoinsLogoutDeleteAndReceiptOnlyStatus(): void
    {
        // Native entry uses wall time. Re-date only this owned synthetic fixture, then issue
        // fresh sessions through the actual Sessions service; no HTTP identity bypass exists.
        $this->now = time(); $pdo = $this->database->connection();
        $pdo->exec('DELETE FROM sessions');
        $pdo->prepare('UPDATE accounts SET created_at=?')->execute([$this->now]);
        $pdo->prepare('UPDATE saves SET saved_at=?')->execute([$this->now]);
        $pdo->prepare('UPDATE write_receipts SET committed_at=?,expires_at=?')->execute([$this->now, $this->now + 604800]);
        $this->auth = $this->login(self::ACCOUNT); $this->other = $this->login(self::OTHER);
        $api = self::COOKIE_PATH . 'api/v1';
        $config = ['origin' => self::ORIGIN, 'gamePath' => self::COOKIE_PATH,
            'databasePath' => $this->game->directory() . '/synthetic.sqlite', 'ledgerFile' => $this->external->directory() . '/synthetic.sqlite',
            'rollbackRoots' => [$this->game->directory()], 'backupSeconds' => 2592000, 'restorationSeconds' => 604800,
            'retentionEvidence' => 'T046-synthetic-only', 'rateKey' => rtrim(strtr(base64_encode(str_repeat('s', 32)), '+/', '-_'), '='),
            'googleClientId' => 'synthetic-google-client', 'googleClientSecret' => 'synthetic-google-secret', 'googleCallback' => self::ORIGIN . $api . '/auth/google/callback',
            'githubClientId' => 'synthetic-github-client', 'githubClientSecret' => 'synthetic-github-secret', 'githubCallback' => self::ORIGIN . $api . '/auth/github/callback'];
        $file = $this->game->writeFile('configuration.json', json_encode($config, JSON_THROW_ON_ERROR));
        $origin = $this->game->startConfiguredApi($file); $config['origin'] = $origin;
        foreach (['google', 'github'] as $provider) $config[$provider . 'Callback'] = $origin . $api . '/auth/' . $provider . '/callback';
        file_put_contents($file, json_encode($config, JSON_THROW_ON_ERROR));
        $client = $this->game->newClient(); $before = $this->graph();
        $logout = $this->game->request('POST', $api . '/logout', ['Origin: ' . $origin,
            'Cookie: ' . explode(';', $this->auth['setCookie'], 2)[0], 'X-CSRF-Token: ' . $this->auth['csrfToken']], client: $client);
        self::assertSame(204, $logout['status'], $logout['body']); self::assertSame('', $logout['body']);
        self::assertSame('__Secure-nq_session=; Path=' . self::COOKIE_PATH . '; Secure; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT', $logout['headers']['set-cookie']);
        foreach (['accounts', 'identities', 'preferences', 'saves', 'write_receipts'] as $table) self::assertSame($before[$table], $this->rows($table));
        self::assertSame([$this->other['context']->idHash], array_column($this->rows('sessions'), 'id_hash'));

        $this->auth = $this->login(self::ACCOUNT);
        $fields = ['Origin: ' . $origin, 'Cookie: ' . explode(';', $this->auth['setCookie'], 2)[0], 'X-CSRF-Token: ' . $this->auth['csrfToken'],
            'X-Confirm-Account-Deletion: delete-my-account', 'X-Deletion-Receipt: ' . $this->token];
        self::assertSame(403, $this->game->request('DELETE', $api . '/account', $fields, client: $client)['status']);
        self::assertNull($this->receipt()); $this->proof(); $this->attempt($this->auth);
        $deleted = $this->game->request('DELETE', $api . '/account', $fields, client: $client);
        self::assertSame(204, $deleted['status'], $deleted['body']); self::assertSame('', $deleted['body']);
        self::assertSame([self::OTHER], array_column($this->rows('accounts'), 'id'));
        self::assertSame('completed', $this->ledger->exclusive(fn () => $this->ledger->receipt(hash('sha256', $this->token), time()))['state']);
        $beforeStatus = $this->graph();
        $statusFields = ['Origin: ' . $origin, 'X-Deletion-Receipt: ' . $this->token];
        $completed = $this->game->request('POST', $api . '/account/deletion-status', $statusFields, client: $client);
        self::assertSame(200, $completed['status'], $completed['body']); self::assertSame('completed', json_decode($completed['body'], true)['state']);
        $later = $this->game->request('POST', $api . '/account/deletion-status', array_merge($statusFields,
            ['Cookie: ' . explode(';', $this->other['setCookie'], 2)[0]]), client: $client);
        self::assertSame($completed['body'], $later['body']); self::assertSame($beforeStatus, $this->graph());

        $pendingToken = Security::token();
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::OTHER, hash('sha256', $pendingToken), time()));
        $pendingFields = ['Origin: ' . $origin, 'X-Deletion-Receipt: ' . $pendingToken];
        $pending = $this->game->request('POST', $api . '/account/deletion-status', $pendingFields, client: $client);
        self::assertSame(200, $pending['status'], $pending['body']); self::assertSame('pending', json_decode($pending['body'], true)['state']);
        self::assertSame('2', $pending['headers']['retry-after']); self::assertSame($beforeStatus, $this->graph());
        self::assertSame('pending', $this->ledger->exclusive(fn () => $this->ledger->receipt(hash('sha256', $pendingToken), time()))['state']);
        $unknown = $this->game->request('POST', $api . '/account/deletion-status', ['Origin: ' . $origin, 'X-Deletion-Receipt: ' . Security::token()], client: $client);
        self::assertSame(404, $unknown['status']);
        self::assertSame(413, $this->game->request('POST', $api . '/account/deletion-status', $pendingFields, '{"accountId":"other"}', $client)['status']);
        self::assertSame(400, $this->game->request('POST', $api . '/account/deletion-status?accountId=other', $pendingFields, client: $client)['status']);
        self::assertSame(400, $this->game->request('POST', $api . '/account/deletion-status', array_merge($pendingFields, ['x-deletion-receipt: ' . $pendingToken]), client: $client)['status']);
        self::assertSame(403, $this->game->request('POST', $api . '/account/deletion-status', ['Origin: https://wrong.invalid', 'X-Deletion-Receipt: ' . $pendingToken], client: $client)['status']);
        self::assertSame($beforeStatus, $this->graph());
        foreach ([$logout, $deleted, $completed, $later, $pending, $unknown] as $response) {
            self::assertSame('no-store', $response['headers']['cache-control']);
            foreach ([$this->token, $pendingToken, self::ACCOUNT, self::OTHER, 'private-progress'] as $secret)
                self::assertStringNotContainsString($secret, json_encode($response, JSON_THROW_ON_ERROR));
        }
        foreach ([$completed, $later, $pending, $unknown] as $response) self::assertArrayNotHasKey('set-cookie', $response['headers']);
        self::assertSame('', $this->game->diagnostics());
    }
}
