<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use NetworkQuest\AccountDeletion;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionReceipts;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\Identity\GitHub;
use NetworkQuest\Identity\Google;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Router;
use NetworkQuest\Routes\Account;
use NetworkQuest\Routes\Auth;
use NetworkQuest\Routes\DeletionStatus;
use NetworkQuest\Routes\Preferences;
use NetworkQuest\Routes\Save;
use NetworkQuest\SaveRepository;
use NetworkQuest\SaveValidator;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\AssertionFailedError;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Application.php';

/** Independent SAVE12 acceptance schedules; no fixture changes or real provider credentials. */
final class AccountDeletionTest extends TestCase
{
    private TestEnvironment $game;
    private TestEnvironment $external;
    private TestEnvironment $backup;
    private TestEnvironment $restored;
    private Database $database;
    private DeletionLedger $ledger;
    private Router $router;
    private Sessions $sessions;
    private array $auth;
    private array $other;
    private string $token;
    private int $now = 1795737600;
    private int $providerSubject = 55001;
    private int $providerCalls = 0;
    private const A = '55000000-0000-4000-8000-000000000001';
    private const B = '55000000-0000-4000-8000-000000000002';
    private const ORIGIN = 'https://t055.network-quest.invalid';
    private const TABLES = ['accounts', 'identities', 'preferences', 'sessions', 'auth_transactions',
        'delete_reauth_proofs', 'saves', 'write_receipts'];

    protected function setUp(): void
    {
        $this->game = TestEnvironment::create(); $this->external = TestEnvironment::create();
        $this->backup = TestEnvironment::create(); $this->restored = TestEnvironment::create();
        $this->game->connect(); $this->external->connect(); $this->external->writeFile('synthetic.sqlite.lock', '');
        $this->database = Database::open($this->gameFile(), $this->roots()); $this->database->migrate();
        $this->ledger = DeletionLedger::initialize($this->ledgerFile(), $this->roots(), $this->rollbackRoots(), $this->policy());
        $this->sessions = new Sessions($this->database, fn () => $this->now);
        $pdo = $this->database->connection();
        foreach ([self::A => 55001, self::B => 55002] as $id => $subject) {
            $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id, $this->now]);
            $pdo->prepare('INSERT INTO identities(account_id,provider,subject,display_name) VALUES(?,?,?,?)')
                ->execute([$id, 'github', (string) $subject, 'Synthetic T055 player']);
            $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
            $payload = json_encode(['syntheticPrivateProgress' => 'T055-owned-note-' . $subject], JSON_THROW_ON_ERROR);
            $pdo->prepare('INSERT INTO saves VALUES(?,?,?,?,?,?,?,?,?)')->execute([$id, 7, $this->now, 1, 'synthetic-T055', $id,
                $payload, hash('sha256', $payload), '{"episodeId":"spec001","roomId":"R02","outcome":null}']);
            $pdo->prepare('INSERT INTO write_receipts(account_id,request_id,fingerprint,committed_revision,committed_at,expires_at) VALUES(?,?,?,?,?,?)')
                ->execute([$id, $id, str_repeat('a', 64), 7, $this->now, $this->now + 604800]);
        }
        $this->auth = $this->login(self::A); $this->other = $this->login(self::B);
        $this->token = Security::token(); $this->router = $this->compose($this->database, $this->ledger);
    }

    protected function tearDown(): void
    {
        unset($this->router, $this->sessions, $this->ledger, $this->database);
        $this->restored->close(); $this->backup->close(); $this->external->close(); $this->game->close();
    }

    private function roots(): array { return [realpath(__DIR__ . '/../..')]; }
    private function rollbackRoots(): array { return [$this->game->directory(), $this->backup->directory(), $this->restored->directory()]; }
    private function gameFile(): string { return $this->game->directory() . '/synthetic.sqlite'; }
    private function ledgerFile(): string { return $this->external->directory() . '/synthetic.sqlite'; }
    private function policy(): DeletionRetentionPolicy { return new DeletionRetentionPolicy(2592000, 604800, 'T055-synthetic-only'); }
    private function login(string $account): array
    {
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo) => $this->sessions->rotateWithin($pdo, $guest['context'], $account));
    }
    private function cookie(array $auth): string { return explode(';', $auth['setCookie'], 2)[0]; }
    private function fields(?array $auth = null): array
    {
        $auth ??= $this->auth;
        return [['Origin', self::ORIGIN], ['Cookie', $this->cookie($auth)], ['X-CSRF-Token', $auth['csrfToken']],
            ['X-Confirm-Account-Deletion', 'delete-my-account'], ['X-Deletion-Receipt', $this->token]];
    }
    private function receiptFields(?string $token = null): array
    { return [['Origin', self::ORIGIN], ['X-Deletion-Receipt', $token ?? $this->token]]; }

    private function compose(Database $database, DeletionLedger $ledger): Router
    {
        $clock = fn () => $this->now;
        $sessions = new Sessions($database, $clock);
        $security = new Security($database, self::ORIGIN, str_repeat('T055-synthetic-rate-key', 2), $clock);
        $access = new RecoveryAccountAccess($database, $ledger, $clock);
        $transactions = new AuthTransactions($database, $sessions, $access, $clock);
        // Actual provider adapters/SDK/state/PKCE; only the external HTTP response is synthetic.
        $handler = function ($request) {
            $this->providerCalls++;
            $body = match ((string) $request->getUri()) {
                'https://github.com/login/oauth/access_token' => ['access_token' => 'T055-synthetic-private-access', 'token_type' => 'bearer', 'scope' => ''],
                'https://api.github.com/user' => ['id' => $this->providerSubject, 'name' => 'Synthetic T055 player'],
                default => throw new LogicException('Unexpected T055 provider request.'),
            };
            return Create::promiseFor(new Response(200, ['Content-Type' => 'application/json'], json_encode($body, JSON_THROW_ON_ERROR)));
        };
        $google = new Google($transactions, 'T055-synthetic-google', 'T055-synthetic-google-private',
            self::ORIGIN . Router::API_BASE . '/auth/google/callback', $clock, $handler);
        $github = new GitHub($transactions, 'T055-synthetic-github', 'T055-synthetic-github-private',
            self::ORIGIN . Router::API_BASE . '/auth/github/callback', $clock, $handler);
        $auth = new Auth($database, $sessions, $security, $google, $github, $access, self::ORIGIN, $clock);
        $repository = new SaveRepository($database, $sessions, $security, new SaveValidator([]), [], $access, $clock);
        return new Router([], $auth, new Save($database, $sessions, $security, $repository, $access),
            new Preferences($database, $sessions, $security, $access),
            new Account($database, $sessions, $security, $access, new AccountDeletion($database, $sessions, $security, $access, $ledger, $clock)),
            new DeletionStatus(new DeletionReceipts($ledger, $security, $clock)));
    }

    private function call(string $method, string $path, array $fields = [], string $body = '', ?Router $router = null, string $peer = '192.0.2.55'): array
    {
        $stream = fopen('php://memory', 'w+b'); fwrite($stream, $body); rewind($stream);
        try {
            $r = ($router ?? $this->router)->handleServer(['REQUEST_METHOD' => $method, 'REQUEST_URI' => Router::API_BASE . $path,
                'HTTPS' => 'on', 'HTTP_HOST' => 't055.network-quest.invalid', 'REMOTE_ADDR' => $peer],
                array_merge([['Host', 't055.network-quest.invalid']], $fields), $stream);
            $r['headers'] = array_change_key_case($r['headers'], CASE_LOWER); return $r;
        } finally { fclose($stream); }
    }
    private function checkStatus(?string $token = null, ?Router $router = null, string $peer = '192.0.2.55'): array
    { return $this->call('POST', '/account/deletion-status', $this->receiptFields($token), router: $router, peer: $peer); }
    private function graph(?Database $database = null): array
    {
        $pdo = ($database ?? $this->database)->connection(); $rows = [];
        foreach (self::TABLES as $table) $rows[$table] = $pdo->query('SELECT * FROM ' . $table . ' ORDER BY rowid')->fetchAll();
        return $rows;
    }
    private function markers(): array { return $this->ledger->exclusive(fn () => $this->ledger->markers()); }
    private function assertNarrow(array $r): void
    {
        self::assertSame('no-store', $r['headers']['cache-control']); self::assertSame('no-referrer', $r['headers']['referrer-policy']);
        self::assertArrayNotHasKey('set-cookie', $r['headers']); self::assertArrayNotHasKey('location', $r['headers']);
        $encoded = json_encode($r, JSON_THROW_ON_ERROR);
        foreach ([$this->token, self::A, self::B, 'T055-owned-note', 'T055-synthetic-private', $this->game->directory(), $this->external->directory()] as $private)
            self::assertStringNotContainsString($private, $encoded);
        if ($r['status'] === 200) self::assertSame(['state', 'expiresAt'], array_keys(json_decode($r['body'], true)));
    }

    /** Uses a new actual delete-purpose provider transaction; no hand-inserted proof. */
    private function reauthenticate(bool $sameAccount = true, string $purpose = 'delete-reauth'): array
    {
        $start = $this->call('POST', '/auth/github/start', array_merge($this->fields(), [['Content-Type', 'application/json']]),
            json_encode(['purpose' => $purpose], JSON_THROW_ON_ERROR));
        self::assertSame(200, $start['status'], $start['body']);
        parse_str(parse_url(json_decode($start['body'], true)['authorizationUrl'], PHP_URL_QUERY), $query);
        $beforeCalls = $this->providerCalls;
        $this->providerSubject = $sameAccount ? ($this->auth['context']->accountId === self::A ? 55001 : 55002) : 55999;
        $finish = $this->call('GET', '/auth/github/callback?state=' . $query['state'] . '&code=T055-synthetic-code', [['Cookie', $this->cookie($this->auth)]]);
        self::assertSame($beforeCalls + 2, $this->providerCalls);
        if ($sameAccount) {
            self::assertSame(200, $finish['status']);
            $cookie = explode(';', $finish['headers']['set-cookie'], 2)[0];
            $session = $this->call('GET', '/session', [['Cookie', $cookie]]); $public = json_decode($session['body'], true);
            self::assertSame('authenticated', $public['state']);
            $this->auth = ['setCookie' => $finish['headers']['set-cookie'], 'csrfToken' => $public['csrfToken'], 'context' => $this->sessions->require($cookie)];
        }
        return $finish;
    }

    public static function finalProofAges(): array { return ['cross to valid 300' => [300, 204], 'cross to expired 301' => [301, 403]]; }
    #[DataProvider('finalProofAges')]
    public function testProofExpiringDuringFinalAuthorizationCannotPersistDeletionIntent(int $age, int $expected): void
    {
        $this->reauthenticate(); $this->now += $age - 1;
        $touches = 0;
        $this->database->connection()->sqliteCreateFunction('t055_cross_expiry', function () use (&$touches): int {
            if (++$touches === 2) $this->now++;
            return 0;
        }, 0);
        // Cross the boundary during the real final Sessions::within update, after admission.
        $this->database->connection()->exec('CREATE TEMP TRIGGER t055_expiry AFTER UPDATE OF last_activity ON sessions BEGIN SELECT t055_cross_expiry(); END');
        $r = $this->call('DELETE', '/account', $this->fields());
        self::assertSame(2, $touches); self::assertSame($expected, $r['status'], 'Use proof age at final authorization, with inclusive 300 seconds.');
        if ($expected === 403) { self::assertSame([], $this->markers()); self::assertCount(2, $this->graph()['saves']); }
        else {
            self::assertSame($this->now, $this->markers()[0]['intentAt'], 'Receipt lifetime starts at the current final proof check.');
            self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->now + 86400), json_decode($this->checkStatus()['body'], true)['expiresAt']);
        }
    }

    public static function proofAges(): array { return ['inclusive boundary' => [300, 204], 'expired boundary' => [301, 403]]; }
    #[DataProvider('proofAges')]
    public function testNewSameAccountProviderRoundtripAuthorizesOnlyForFiveMinutes(int $age, int $expected): void
    {
        $old = $this->auth; $this->reauthenticate();
        self::assertNotSame($this->cookie($old), $this->cookie($this->auth));
        self::assertSame(401, $this->call('DELETE', '/account', $this->fields($old))['status']);
        $this->now += $age;
        $r = $this->call('DELETE', '/account', $this->fields()); self::assertSame($expected, $r['status']); $this->assertNarrow($r);
        if ($expected === 204) {
            self::assertSame([self::B], array_column($this->graph()['accounts'], 'id'));
            self::assertSame('completed', json_decode($this->checkStatus()['body'], true)['state']);
        } else { self::assertSame([], $this->markers()); self::assertCount(2, $this->graph()['saves']); }
    }

    public function testOrdinaryLoginAnotherIdentityAndAnotherSessionNeverProvideDeletionAuthority(): void
    {
        $this->reauthenticate(purpose: 'login');
        self::assertSame([], $this->graph()['delete_reauth_proofs']);
        self::assertSame(403, $this->call('DELETE', '/account', $this->fields())['status']);
        $before = $this->graph(); $wrong = $this->reauthenticate(false);
        self::assertSame(400, $wrong['status']); self::assertArrayNotHasKey('set-cookie', $wrong['headers']);
        foreach (['accounts', 'identities', 'preferences', 'saves', 'write_receipts', 'delete_reauth_proofs'] as $table)
            self::assertSame($before[$table], $this->graph()[$table]);
        $withoutProof = $this->auth;
        $this->auth = $this->login(self::A); $this->reauthenticate();
        self::assertSame(403, $this->call('DELETE', '/account', $this->fields($withoutProof))['status']);
        self::assertSame([], $this->markers()); self::assertCount(2, $this->graph()['saves']);
    }

    private function consistentBackup(): string
    {
        $file = $this->backup->writeFile('snapshot.sqlite', '');
        $statement = $this->database->connection()->prepare('VACUUM INTO ?'); $statement->execute([$file]);
        $snapshot = new PDO('sqlite:' . $file, null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
        self::assertSame('ok', $snapshot->query('PRAGMA integrity_check')->fetchColumn());
        self::assertSame([], $snapshot->query('PRAGMA foreign_key_check')->fetchAll());
        self::assertSame(2, (int) $snapshot->query('SELECT count(*) FROM saves')->fetchColumn());
        unset($snapshot); return $file;
    }

    /** Child stops at actual durable phases and is SIGKILLed before returning any response. */
    private function killAt(string $phase): void
    {
        $script = $this->external->writeFile('deletion-worker.php', <<<'PHP'
<?php
declare(strict_types=1);
$input = json_decode(fgets(STDIN), true, 32, JSON_THROW_ON_ERROR);
require_once $input['root'] . '/server/src/Application.php';
$database = NetworkQuest\Database::open($input['game'], [$input['root']]);
$ledger = NetworkQuest\DeletionLedger::open($input['ledger'], [$input['root']], $input['rollback'],
    new NetworkQuest\DeletionRetentionPolicy(2592000, 604800, 'T055-synthetic-only'));
$clock = fn () => $input['now'];
$pause = function (string $phase) use ($input): int {
    if ($phase === $input['phase']) {
        fwrite(STDOUT, $phase . "\n"); fflush(STDOUT);
        fread(STDIN, 1); // Parent owns a bounded watchdog and always kills/cleans up.
        throw new RuntimeException('Parent unexpectedly resumed a crash worker.');
    }
    return 0;
};
if ($input['phase'] === 'before-intent') {
    $database->connection()->sqliteCreateFunction('t055_pause_before_intent', fn () => $pause('before-intent'), 0);
    $database->connection()->exec('CREATE TEMP TRIGGER t055_before AFTER UPDATE OF last_activity ON sessions BEGIN SELECT t055_pause_before_intent(); END');
}
$access = new NetworkQuest\RecoveryAccountAccess($database, $ledger, $clock);
$deletion = new NetworkQuest\AccountDeletion($database, new NetworkQuest\Sessions($database, $clock),
    new NetworkQuest\Security($database, $input['origin'], str_repeat('T055-synthetic-rate-key', 2), $clock),
    $access, $ledger, $clock, $pause);
$deletion->delete('192.0.2.55', $input['fields']);
fwrite(STDOUT, "unexpected-response\n");
PHP);
        $errors = $this->external->writeFile('worker-errors', '');
        $process = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', 'log_errors=1', '-d', 'error_log=' . $errors, $script],
            [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['file', $errors, 'a']], $pipes,
            $this->external->directory(), ['LANG' => 'C', 'LC_ALL' => 'C']);
        self::assertIsResource($process);
        try {
            $input = ['root' => $this->roots()[0], 'game' => $this->gameFile(), 'ledger' => $this->ledgerFile(),
                'rollback' => $this->rollbackRoots(), 'now' => $this->now, 'origin' => self::ORIGIN, 'phase' => $phase, 'fields' => $this->fields()];
            fwrite($pipes[0], json_encode($input, JSON_THROW_ON_ERROR) . "\n"); fflush($pipes[0]); stream_set_timeout($pipes[1], 5);
            self::assertSame($phase . "\n", fgets($pipes[1]), file_get_contents($errors));
            $blocked = false;
            try { $this->ledger->exclusive(static fn () => null); }
            catch (AssertionFailedError $failure) { throw $failure; }
            catch (RuntimeException $error) { self::assertSame('Recovery barrier is unavailable.', $error->getMessage()); $blocked = true; }
            self::assertTrue($blocked, 'Independent connection must observe the child-held stable barrier.');
            if ($phase !== 'before-intent') {
                // The barrier stays held, but both SQLite transactions have ended at every durable boundary.
                foreach ([$this->game->connect(), $this->external->connect()] as $independent) {
                    $independent->exec('BEGIN IMMEDIATE'); self::assertTrue($independent->inTransaction()); $independent->exec('ROLLBACK');
                }
            }
            self::assertTrue(proc_terminate($process, 9));
            $deadline = microtime(true) + 5;
            do { $state = proc_get_status($process); if (!$state['running']) break; usleep(10000); } while (microtime(true) < $deadline);
            self::assertFalse($state['running']); self::assertTrue($state['signaled']); self::assertSame(9, $state['termsig']);
        } finally {
            if (proc_get_status($process)['running']) proc_terminate($process, 9);
            foreach ($pipes as $pipe) if (is_resource($pipe)) fclose($pipe);
            proc_close($process);
        }
        self::assertSame('', file_get_contents($errors));
    }

    public static function crashWindows(): array
    {
        return ['before intent' => ['before-intent', null, true], 'intent only' => ['intent-durable', 'pending', true],
            'live commit without marker' => ['live-committed', 'pending', false], 'marker without response' => ['completed', 'completed', false]];
    }
    #[DataProvider('crashWindows')]
    public function testKilledProcessesRecoverAndConsistentSnapshotsCannotResurrectDeletedAccounts(string $phase, ?string $state, bool $live): void
    {
        $this->reauthenticate(); $snapshot = $this->consistentBackup(); $before = $this->graph();
        $ledgerInode = stat($this->ledgerFile())['ino']; $lockInode = stat($this->ledgerFile() . '.lock')['ino'];
        $this->killAt($phase);
        $afterCrash = $this->graph(); self::assertSame($live, in_array(self::A, array_column($afterCrash['accounts'], 'id'), true));
        $status = $this->checkStatus(); self::assertSame($state === null ? 404 : 200, $status['status']); $this->assertNarrow($status);
        if ($state !== null) self::assertSame($state, json_decode($status['body'], true)['state']);
        self::assertSame($afterCrash, $this->graph(), 'Polling alone must not reconcile pending deletion or touch account/session/progress.');
        if ($state === 'pending') self::assertNull($this->markers()[0]['completedAt']);
        // Fresh service objects and independent real connections perform recovery, not the interrupted worker.
        $reopened = Database::open($this->gameFile(), $this->roots());
        $reopenedLedger = DeletionLedger::open($this->ledgerFile(), $this->roots(), $this->rollbackRoots(), $this->policy());
        $fresh = $this->compose($reopened, $reopenedLedger);
        self::assertSame($state === null ? 200 : 401, $this->call('GET', '/save', [['Cookie', $this->cookie($this->auth)]], router: $fresh)['status']);
        if ($state !== null) {
            self::assertSame('completed', json_decode($this->checkStatus(router: $fresh)['body'], true)['state']);
            foreach (self::TABLES as $table) {
                $key = $table === 'accounts' ? 'id' : ($table === 'auth_transactions' ? 'expected_account_id' : 'account_id');
                self::assertSame(array_values(array_filter($before[$table], fn ($row) => $row[$key] !== self::A)), $this->graph()[$table]);
            }
        } else { self::assertSame([], $this->markers()); self::assertSame($before, $this->graph()); }

        // Only the complete VACUUM INTO image is copied; ledger+stable lock are outside ALL rollback sets.
        $restoredFile = $this->restored->writeFile('synthetic.sqlite', file_get_contents($snapshot));
        $restoredDb = Database::open($restoredFile, $this->roots()); $restoredRouter = $this->compose($restoredDb, $reopenedLedger);
        self::assertSame($before, $this->graph($restoredDb));
        $markerBytes = hash_file('sha256', $this->ledgerFile());
        $status = $this->checkStatus(router: $restoredRouter); $this->assertNarrow($status);
        self::assertSame($before, $this->graph($restoredDb), 'A receipt read cannot delete even resurrected rows.');
        self::assertSame($markerBytes, hash_file('sha256', $this->ledgerFile()));
        $read = $this->call('GET', '/save', [['Cookie', $this->cookie($this->auth)]], router: $restoredRouter);
        self::assertSame($state === null ? 200 : 401, $read['status']);
        if ($state !== null) {
            self::assertStringNotContainsString('T055-owned-note', $read['body']);
            self::assertSame([self::B], array_column($this->graph($restoredDb)['accounts'], 'id'));
            self::assertSame('completed', json_decode($this->checkStatus(router: $restoredRouter)['body'], true)['state']);
        }
        $otherRead = $this->call('GET', '/save', [['Cookie', $this->cookie($this->other)]], router: $restoredRouter);
        self::assertSame(200, $otherRead['status']); self::assertSame('T055-owned-note-55002', json_decode($otherRead['body'], true)['snapshot']['syntheticPrivateProgress']);
        self::assertSame($ledgerInode, stat($this->ledgerFile())['ino']); self::assertSame($lockInode, stat($this->ledgerFile() . '.lock')['ino']);
        unset($restoredRouter, $restoredDb, $fresh, $reopenedLedger, $reopened);
    }

    public function testExpiredSessionAndGuestProjectionCannotProveDeletionOrGrantReceiptAuthority(): void
    {
        $this->reauthenticate(); $this->now += 7200; $before = $this->graph();
        self::assertSame(401, $this->call('DELETE', '/account', $this->fields())['status']);
        self::assertSame($before, $this->graph()); self::assertSame([], $this->markers());
        $guest = $this->call('GET', '/session', [['Cookie', $this->cookie($this->auth)]]);
        self::assertSame('guest', json_decode($guest['body'], true)['state']);
        $afterGuest = $this->graph(); $unknown = $this->checkStatus();
        self::assertSame(404, $unknown['status']); self::assertSame('deletion-unconfirmed', json_decode($unknown['body'], true)['code']);
        self::assertCount(2, $afterGuest['saves']); self::assertSame($afterGuest, $this->graph()); $this->assertNarrow($unknown);
        foreach ([['GET', '/save', '', 401], ['DELETE', '/account', '', 401],
            ['POST', '/auth/github/start', '{"purpose":"delete-reauth"}', 401]] as [$method, $path, $body, $expected]) {
            $r = $this->call($method, $path, array_merge($this->receiptFields(), [['Content-Type', 'application/json']]), $body);
            self::assertSame($expected, $r['status']); $this->assertNarrow($r);
        }
        self::assertSame($afterGuest, $this->graph());
    }

    public function testPendingReceiptPollingWithLaterAccountCookieNeverReconcilesOrChangesThatAccount(): void
    {
        $this->reauthenticate(); $this->killAt('intent-durable'); $before = $this->graph(); $markers = $this->markers();
        foreach ([[], [['Cookie', $this->cookie($this->auth)]], [['Cookie', $this->cookie($this->other)], ['X-CSRF-Token', $this->other['csrfToken']]]] as $incidental) {
            $r = $this->call('POST', '/account/deletion-status', array_merge($this->receiptFields(), $incidental));
            self::assertSame(200, $r['status']); self::assertSame('pending', json_decode($r['body'], true)['state']);
            self::assertSame('2', $r['headers']['retry-after']); $this->assertNarrow($r);
            self::assertSame($before, $this->graph()); self::assertSame($markers, $this->markers());
        }
    }

    public function testExpiredReceiptIsIndistinguishableFromUnknownAndSpentTokenCannotDeleteLaterAccount(): void
    {
        $this->reauthenticate(); $acceptedAt = $this->now;
        self::assertSame(204, $this->call('DELETE', '/account', $this->fields())['status']);
        $completed = $this->checkStatus(); $markers = $this->markers();
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $acceptedAt + 86400), json_decode($completed['body'], true)['expiresAt']);
        $this->now += 86399; self::assertSame('completed', json_decode($this->checkStatus()['body'], true)['state']);
        $this->now++; $expired = $this->checkStatus(); $unknown = $this->checkStatus(Security::token());
        foreach ([$expired, $unknown] as $r) { self::assertSame(404, $r['status']); $this->assertNarrow($r); }
        $projection = static function (array $r): array {
            unset($r['headers']['x-request-id']); $r['body'] = json_decode($r['body'], true); unset($r['body']['requestId']); return $r;
        };
        self::assertSame($projection($unknown), $projection($expired));
        self::assertSame(1, $this->ledger->exclusive(fn () => $this->ledger->expireReceipts($this->now)));
        self::assertSame($markers, $this->markers());
        $this->auth = $this->login(self::B); $this->reauthenticate(); $before = $this->graph();
        $conflict = $this->call('DELETE', '/account', $this->fields());
        self::assertSame(409, $conflict['status']); self::assertSame('deletion-receipt-conflict', json_decode($conflict['body'], true)['code']);
        $this->assertNarrow($conflict); self::assertSame($before, $this->graph()); self::assertSame($markers, $this->markers());
        $status = $this->call('POST', '/account/deletion-status', array_merge($this->receiptFields(), [['Cookie', $this->cookie($this->auth)]]));
        self::assertSame(404, $status['status']); self::assertSame($before, $this->graph()); $this->assertNarrow($status);
        $this->token = Security::token(); self::assertSame(204, $this->call('DELETE', '/account', $this->fields())['status']);
        self::assertSame([], $this->graph()['accounts']); self::assertCount(2, $this->markers());
    }

    public function testCompletedMarkerSuppressesRestoredAccountAfterReceiptAndMinimumMarkerRetentionExpire(): void
    {
        $this->reauthenticate(); $snapshot = $this->consistentBackup(); $before = $this->graph();
        self::assertSame(204, $this->call('DELETE', '/account', $this->fields())['status']); $marker = $this->markers();
        $this->now += 2592000 + 604800 + 1;
        self::assertSame(1, $this->ledger->exclusive(fn () => $this->ledger->expireReceipts($this->now)));
        $file = $this->restored->writeFile('synthetic.sqlite', file_get_contents($snapshot));
        $database = Database::open($file, $this->roots()); $router = $this->compose($database, $this->ledger);
        self::assertSame(404, $this->checkStatus(router: $router)['status']); self::assertSame($before, $this->graph($database));
        $read = $this->call('GET', '/save', [['Cookie', $this->cookie($this->auth)]], router: $router);
        self::assertSame(401, $read['status']); self::assertSame([self::B], array_column($this->graph($database)['accounts'], 'id'));
        self::assertSame($marker, $this->markers());
        self::assertSame(array_values(array_filter($before['saves'], fn ($row) => $row['account_id'] === self::B)), $this->graph($database)['saves']);
        unset($router, $database);
    }

    public function testCompletedOldReceiptCannotActOnLaterAccountOrRevealItsProgress(): void
    {
        $this->reauthenticate(); self::assertSame(204, $this->call('DELETE', '/account', $this->fields())['status']);
        $completed = $this->checkStatus(); $this->auth = $this->other; $this->reauthenticate(); $before = $this->graph();
        $later = $this->call('POST', '/account/deletion-status', array_merge($this->receiptFields(),
            [['Cookie', $this->cookie($this->auth)], ['X-CSRF-Token', $this->auth['csrfToken']]]));
        self::assertSame($completed['body'], $later['body']); $this->assertNarrow($later); self::assertSame($before, $this->graph());
        $conflict = $this->call('DELETE', '/account', $this->fields());
        self::assertSame(409, $conflict['status']); $this->assertNarrow($conflict); self::assertSame($before, $this->graph());
        self::assertSame([self::A], array_column($this->markers(), 'accountId'));
        $save = $this->call('GET', '/save', [['Cookie', $this->cookie($this->auth)]]);
        self::assertSame(200, $save['status']); self::assertSame('T055-owned-note-55002', json_decode($save['body'], true)['snapshot']['syntheticPrivateProgress']);
    }

    public function testCurrentSessionRevokedAfterAdmissionCannotUseItsPreviouslyValidProof(): void
    {
        $this->reauthenticate();
        $this->database->connection()->exec('CREATE TEMP TRIGGER t055_revoke AFTER UPDATE OF last_activity ON sessions BEGIN DELETE FROM sessions WHERE id_hash=NEW.id_hash; END');
        $before = $this->graph(); $r = $this->call('DELETE', '/account', $this->fields());
        self::assertSame(401, $r['status']); self::assertSame([], $this->markers()); $this->assertNarrow($r);
        foreach (['accounts', 'identities', 'preferences', 'saves', 'write_receipts'] as $table) self::assertSame($before[$table], $this->graph()[$table]);
        self::assertSame(404, $this->checkStatus()['status']);
    }

    public function testReceiptStatusRejectsWrongOriginsSelectorsAndMalformedTokensWithoutReconciling(): void
    {
        $this->reauthenticate(); $this->killAt('intent-durable'); $before = $this->graph(); $markers = $this->markers();
        $cases = [
            ['POST', '/account/deletion-status', [['X-Deletion-Receipt', $this->token]], '', 403],
            ['POST', '/account/deletion-status', [['Origin', 'null'], ['X-Deletion-Receipt', $this->token]], '', 403],
            ['POST', '/account/deletion-status', [['Origin', self::ORIGIN . '/'], ['X-Deletion-Receipt', $this->token]], '', 403],
            ['POST', '/account/deletion-status', [['Origin', 'https://attacker.invalid'], ['X-Deletion-Receipt', $this->token]], '', 403],
            ['POST', '/account/deletion-status', [['Origin', self::ORIGIN]], '', 400],
            ['POST', '/account/deletion-status', [['Origin', self::ORIGIN], ['X-Deletion-Receipt', str_repeat('A', 42) . 'B']], '', 400],
            ['POST', '/account/deletion-status', array_merge($this->receiptFields(), [['x-deletion-receipt', $this->token]]), '', 400],
            ['POST', '/account/deletion-status?accountId=' . self::B, $this->receiptFields(), '', 400],
            ['POST', '/account/deletion-status', $this->receiptFields(), '{"accountId":"' . self::B . '"}', 413],
            ['GET', '/account/deletion-status', $this->receiptFields(), '', 405],
            ['POST', '/account/deletion-status', $this->receiptFields(Security::token()), '', 404],
        ];
        foreach ($cases as [$method, $path, $fields, $body, $expected]) {
            $r = $this->call($method, $path, $fields, $body); self::assertSame($expected, $r['status']); $this->assertNarrow($r);
            self::assertSame($before, $this->graph()); self::assertSame($markers, $this->markers());
        }
        self::assertSame('pending', json_decode($this->checkStatus()['body'], true)['state']);
    }

    public function testReceiptRateLimitFollowsTokenAcrossSourcesAndResetsAfterWindow(): void
    {
        $before = $this->graph();
        for ($attempt = 0; $attempt < 30; $attempt++) self::assertSame(404, $this->checkStatus()['status']);
        foreach (['192.0.2.55', '192.0.2.56'] as $peer) {
            $r = $this->checkStatus(peer: $peer); self::assertSame(429, $r['status']);
            self::assertSame('60', $r['headers']['retry-after']); $this->assertNarrow($r);
        }
        $this->now += 60; self::assertSame(404, $this->checkStatus()['status']);
        self::assertSame($before, $this->graph()); self::assertSame([], $this->markers());
    }

    public function testSourceRateLimitCannotBeBypassedByInventingNewReceipts(): void
    {
        $before = $this->graph();
        for ($attempt = 0; $attempt < 60; $attempt++) self::assertSame(404, $this->checkStatus(Security::token())['status']);
        $unseen = Security::token(); $r = $this->checkStatus($unseen);
        self::assertSame(429, $r['status']); self::assertSame('60', $r['headers']['retry-after']); $this->assertNarrow($r);
        self::assertSame(404, $this->checkStatus($unseen, peer: '192.0.2.56')['status']);
        self::assertSame($before, $this->graph()); self::assertSame([], $this->markers());
        $counters = json_encode($this->database->connection()->query('SELECT * FROM operational_counters')->fetchAll(), JSON_THROW_ON_ERROR);
        foreach ([$unseen, $this->token, '192.0.2.55', '192.0.2.56'] as $private) self::assertStringNotContainsString($private, $counters);
    }

    public function testDeletionQuotaSurvivesFreshSessionAndReauthenticationWithoutCreatingAnIntent(): void
    {
        for ($attempt = 0; $attempt < 3; $attempt++) self::assertSame(403, $this->call('DELETE', '/account', $this->fields())['status']);
        $this->reauthenticate(); $before = $this->graph();
        $r = $this->call('DELETE', '/account', $this->fields()); self::assertSame(429, $r['status']);
        self::assertSame('3600', $r['headers']['retry-after']); $this->assertNarrow($r);
        self::assertSame($before, $this->graph()); self::assertSame([], $this->markers()); self::assertSame(404, $this->checkStatus()['status']);
    }

    public function testPendingRecoveryFailureDeniesProtectedAccessUntilLiveRemovalCanCommit(): void
    {
        $this->reauthenticate(); $this->killAt('intent-durable'); $before = $this->graph();
        $this->database->connection()->exec("CREATE TRIGGER t055_disk_fault BEFORE DELETE ON accounts BEGIN SELECT RAISE(ABORT, 'T055-synthetic-private-storage-failure'); END");
        foreach ([['GET', '/save', ''], ['PATCH', '/preferences', '{"captions":false}'], ['POST', '/logout', '']] as [$method, $path, $body]) {
            $r = $this->call($method, $path, array_merge($this->fields(), [['Content-Type', 'application/json'], ['If-Match', '"prefs-1"']]), $body);
            self::assertSame(503, $r['status']); $this->assertNarrow($r); self::assertSame($before, $this->graph());
        }
        self::assertSame('pending', json_decode($this->checkStatus()['body'], true)['state']);
        self::assertNull($this->markers()[0]['completedAt']); self::assertSame($before, $this->graph());
        $this->database->connection()->exec('DROP TRIGGER t055_disk_fault');
        self::assertSame(401, $this->call('GET', '/save', [['Cookie', $this->cookie($this->auth)]])['status']);
        self::assertSame('completed', json_decode($this->checkStatus()['body'], true)['state']);
    }

    public function testExternalCompletionFailureReturnsUnavailableAndReceiptReadCannotRepairIt(): void
    {
        $this->reauthenticate(); $external = $this->external->connect();
        $external->exec("CREATE TRIGGER t055_marker_fault BEFORE UPDATE ON deletion_markers BEGIN SELECT RAISE(ABORT, 'T055-synthetic-private-marker-failure'); END");
        $r = $this->call('DELETE', '/account', $this->fields()); self::assertSame(503, $r['status']); $this->assertNarrow($r);
        self::assertSame([self::B], array_column($this->graph()['accounts'], 'id')); $afterCommit = $this->graph();
        self::assertSame('pending', json_decode($this->checkStatus()['body'], true)['state']); self::assertSame($afterCommit, $this->graph());
        $read = $this->call('GET', '/save', [['Cookie', $this->cookie($this->other)]]);
        self::assertSame(503, $read['status']); $this->assertNarrow($read); self::assertSame($afterCommit, $this->graph());
        $external->exec('DROP TRIGGER t055_marker_fault');
        self::assertSame(200, $this->call('GET', '/save', [['Cookie', $this->cookie($this->other)]])['status']);
        self::assertSame('completed', json_decode($this->checkStatus()['body'], true)['state']);
    }

    public function testReplacedBarrierInodeFailsClosedWithoutAdoptingNewLockOrMutatingAccounts(): void
    {
        $this->reauthenticate(); $before = $this->graph();
        $lock = $this->ledgerFile() . '.lock'; $spare = $this->external->writeFile('spare.lock', ''); $parked = $this->external->directory() . '/parked.lock';
        self::assertTrue(rename($lock, $parked)); self::assertTrue(rename($spare, $lock));
        try {
            foreach ([['DELETE', '/account'], ['GET', '/save'], ['POST', '/account/deletion-status']] as [$method, $path]) {
                $r = $this->call($method, $path, $this->fields()); self::assertSame(503, $r['status']); $this->assertNarrow($r);
                self::assertSame($before, $this->graph());
            }
        } finally { rename($lock, $spare); rename($parked, $lock); }
        self::assertSame([], $this->markers()); self::assertSame(404, $this->checkStatus()['status']);
    }

    public function testLedgerMustRemainOutsideEveryDeclaredRollbackSetAndBarrierCannotNest(): void
    {
        foreach ($this->rollbackRoots() as $root) self::assertFalse(str_starts_with($this->ledgerFile(), $root . '/'));
        $rejected = false;
        try { DeletionLedger::open($this->ledgerFile(), $this->roots(), array_merge($this->rollbackRoots(), [$this->external->directory()]), $this->policy()); }
        catch (AssertionFailedError $failure) { throw $failure; }
        catch (RuntimeException) { $rejected = true; }
        self::assertTrue($rejected, 'Any declared backup/rollback root containing the ledger must fail closed.');
        $access = new RecoveryAccountAccess($this->database, $this->ledger, fn () => $this->now);
        foreach ([fn () => $this->ledger->exclusive(fn () => $access->run(fn () => null)),
            fn () => $this->database->immediate(fn () => $access->run(fn () => null))] as $nested) {
            $rejected = false;
            try { $nested(); } catch (LogicException) { $rejected = true; }
            self::assertTrue($rejected, 'Nested or reversed acquisition must fail before protected access.');
        }
        self::assertFalse($this->database->connection()->inTransaction()); self::assertSame([], $this->markers());
    }

    public static function nativeRestoreStates(): array { return ['pending intent' => [true], 'completed deletion' => [false]]; }
    #[DataProvider('nativeRestoreStates')]
    public function testNativeConfiguredEntryPollsWithoutRecoveryThenSuppressesRestoredIdentityBeforeSessionProjection(bool $pending): void
    {
        // Native entry uses wall time. Only owned synthetic sessions are dated for that clock.
        $this->now = time(); $this->database->connection()->exec('DELETE FROM sessions');
        $this->auth = $this->login(self::A); $this->other = $this->login(self::B); $this->reauthenticate();
        $snapshot = $this->consistentBackup(); $before = $this->graph();
        if ($pending) $this->killAt('intent-durable');
        else self::assertSame(204, $this->call('DELETE', '/account', $this->fields())['status']);
        $file = $this->restored->writeFile('synthetic.sqlite', file_get_contents($snapshot));
        $restoredDb = Database::open($file, $this->roots());
        $config = ['origin' => self::ORIGIN, 'gamePath' => Router::GAME_BASE, 'databasePath' => $file,
            'ledgerFile' => $this->ledgerFile(), 'rollbackRoots' => $this->rollbackRoots(), 'backupSeconds' => 2592000,
            'restorationSeconds' => 604800, 'retentionEvidence' => 'T055-synthetic-only',
            'rateKey' => rtrim(strtr(base64_encode(str_repeat('s', 32)), '+/', '-_'), '='),
            'googleClientId' => 'T055-synthetic-google', 'googleClientSecret' => 'T055-synthetic-google-private',
            'googleCallback' => self::ORIGIN . Router::API_BASE . '/auth/google/callback',
            'githubClientId' => 'T055-synthetic-github', 'githubClientSecret' => 'T055-synthetic-github-private',
            'githubCallback' => self::ORIGIN . Router::API_BASE . '/auth/github/callback'];
        $configuration = $this->restored->writeFile('configuration.json', json_encode($config, JSON_THROW_ON_ERROR));
        $origin = $this->restored->startConfiguredApi($configuration); $config['origin'] = $origin;
        foreach (['google', 'github'] as $provider) $config[$provider . 'Callback'] = $origin . Router::API_BASE . '/auth/' . $provider . '/callback';
        file_put_contents($configuration, json_encode($config, JSON_THROW_ON_ERROR));
        $fields = ['Origin: ' . $origin, 'X-Deletion-Receipt: ' . $this->token];
        $status = $this->restored->request('POST', Router::API_BASE . '/account/deletion-status', $fields);
        self::assertSame(200, $status['status'], $status['body']); $this->assertNarrow($status);
        self::assertSame($pending ? 'pending' : 'completed', json_decode($status['body'], true)['state']);
        self::assertSame($before, $this->graph($restoredDb), 'Actual Application startup/status must not eagerly reconcile or bootstrap.');
        $session = $this->restored->request('GET', Router::API_BASE . '/session', ['Cookie: ' . $this->cookie($this->auth)]);
        self::assertSame(200, $session['status']); self::assertSame(['state', 'csrfToken'], array_keys(json_decode($session['body'], true)));
        self::assertSame('guest', json_decode($session['body'], true)['state']);
        self::assertStringNotContainsString('T055-owned-note', $session['body']);
        self::assertSame([self::B], array_column($this->graph($restoredDb)['accounts'], 'id'));
        $confirmed = $this->restored->request('POST', Router::API_BASE . '/account/deletion-status', $fields);
        self::assertSame(200, $confirmed['status']); self::assertSame('completed', json_decode($confirmed['body'], true)['state']); $this->assertNarrow($confirmed);
        $denied = $this->restored->request('GET', Router::API_BASE . '/save', ['Cookie: ' . $this->cookie($this->auth)]);
        self::assertSame(401, $denied['status']); $this->assertNarrow($denied);
        $other = $this->restored->request('GET', Router::API_BASE . '/save', ['Cookie: ' . $this->cookie($this->other)]);
        self::assertSame(200, $other['status']); self::assertSame('T055-owned-note-55002', json_decode($other['body'], true)['snapshot']['syntheticPrivateProgress']);
        self::assertSame(array_values(array_filter($before['saves'], fn ($row) => $row['account_id'] === self::B)), $this->graph($restoredDb)['saves']);
        self::assertSame('', $this->restored->diagnostics());
        unset($restoredDb);
    }

    public function testExternalRecoveryStoresOnlyHashBindingsAndCompletionMetadata(): void
    {
        $this->reauthenticate(); self::assertSame(204, $this->call('DELETE', '/account', $this->fields())['status']);
        $raw = $this->external->connect();
        self::assertSame([['receipt_hash' => hash('sha256', $this->token), 'account_id' => self::A,
            'accepted_at' => $this->now, 'expires_at' => $this->now + 86400]], $raw->query('SELECT * FROM deletion_receipts')->fetchAll());
        self::assertSame([['receipt_hash' => hash('sha256', $this->token)]], $raw->query('SELECT * FROM spent_receipts')->fetchAll());
        $bytes = file_get_contents($this->ledgerFile());
        foreach ([$this->token, $this->cookie($this->auth), $this->auth['csrfToken'], 'T055-owned-note', 'T055-synthetic-private-access', 'Synthetic T055 player'] as $private)
            self::assertStringNotContainsString($private, $bytes);
    }
}
