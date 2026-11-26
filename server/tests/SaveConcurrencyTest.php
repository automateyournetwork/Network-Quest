<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\AccountDeletion;
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\Routes\Account;
use NetworkQuest\Routes\Preferences;
use NetworkQuest\Routes\Save;
use NetworkQuest\SaveRepository;
use NetworkQuest\SaveValidator;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
foreach (['AccountAccess', 'Database', 'Security', 'Sessions', 'SaveValidator', 'SaveRepository',
    'DeletionLedger', 'RecoveryAccountAccess', 'AccountDeletion', 'Routes/Save', 'Routes/Account', 'Routes/Preferences'] as $file) {
    require_once __DIR__ . '/../src/' . $file . '.php';
}

/** Test-only process protocol. It is never loaded by the application or selected by HTTP. */
final class SaveConcurrencyWorker
{
    public const ORIGIN = 'https://network-quest.invalid';
    public const VERSIONS = [['saveSchemaVersion' => 1, 'contentVersion' => '1.0.0']];

    public static function policies(string $policy): array
    {
        $policies = json_decode(file_get_contents(__DIR__ . '/../content/save-policy.generated.json'), false, 64, JSON_THROW_ON_ERROR)->policies;
        // A hypothetical compatible reader retires this content from NEW writes only.
        // This is a constructor input, never a change to fixtures, shipped schema or policy.
        if ($policy === 'retired') return [];
        if ($policy === 'next-content') $policies[0]->contentVersion = '2.0.0';
        if ($policy === 'closed-anchor') unset($policies[0]->safePositions->{'spec001:R01.entry'});
        return $policies;
    }

    public static function services(array $input, ?callable $observer = null, ?callable $clock = null): array
    {
        $db = Database::open($input['game'] . '/synthetic.sqlite', [$input['root']]);
        $ledger = DeletionLedger::open($input['recovery'] . '/synthetic.sqlite', [$input['root']], [$input['game']],
            new DeletionRetentionPolicy(2592000, 604800, 'T054-disposable-only'));
        $clock ??= fn (): int => $input['now'];
        $sessions = new Sessions($db, $clock);
        $security = new Security($db, self::ORIGIN, str_repeat('T054-synthetic-rate-key-', 2), $clock);
        $access = new RecoveryAccountAccess($db, $ledger, $clock);
        $repository = new SaveRepository($db, $sessions, $security,
            new SaveValidator(self::policies($input['policy'] ?? 'current')),
            self::VERSIONS, $access, $clock, $observer);
        return ['db' => $db, 'ledger' => $ledger, 'sessions' => $sessions, 'access' => $access,
            'save' => new Save($db, $sessions, $security, $repository, $access),
            'account' => new Account($db, $sessions, $security, $access,
                new AccountDeletion($db, $sessions, $security, $access, $ledger, $clock)),
            'preferences' => new Preferences($db, $sessions, $security, $access)];
    }

    public static function request(array $services, array $input): array
    {
        [$handler, $method, $route] = match ($input['action'] ?? 'save') {
            'save' => ['save', 'PUT', '/save'], 'read' => ['save', 'GET', '/save'],
            'logout' => ['account', 'POST', '/logout'], 'delete' => ['account', 'DELETE', '/account'],
            'preferences' => ['preferences', 'PATCH', '/preferences'],
        };
        $body = fopen('php://memory', 'w+b');
        try {
            fwrite($body, $input['body'] ?? ''); rewind($body);
            return $services[$handler]->handle($method, $route, '', $input['fields'], $body, '127.0.0.1');
        } finally { fclose($body); }
    }

    private static function emit(array $event): void
    {
        if (fwrite(STDOUT, json_encode($event + ['pid' => getmypid()], JSON_THROW_ON_ERROR) . "\n") === false || !fflush(STDOUT)) {
            throw new RuntimeException('Test control output failed.');
        }
    }

    private static function resume(): void
    {
        stream_set_timeout(STDIN, 8);
        if (fgets(STDIN) !== "GO\n") throw new RuntimeException('Test control barrier timed out or closed.');
    }

    public static function main(): void
    {
        stream_set_timeout(STDIN, 8);
        $input = json_decode(fgets(STDIN), true, 64, JSON_THROW_ON_ERROR);
        $services = null;
        $now = $input['now'];
        $observer = function (string $phase) use ($input, &$services, &$now): void {
            if (($input['pause'] ?? null) !== $phase) return;
            self::emit(['event' => $phase, 'transaction' => $services['db']->connection()->inTransaction()]);
            self::resume();
            $now = $input['afterPauseNow'] ?? $now;
        };
        $services = self::services($input, $observer, function () use (&$now): int { return $now; });
        if (($input['pause'] ?? null) === 'inside-write') {
            // SQLite invokes this test function after slot UPDATE, before receipt INSERT.
            // The real repository's transaction and external barrier remain held.
            $services['db']->connection()->sqliteCreateFunction('t054_pause', function () use (&$services): int {
                self::emit(['event' => 'inside-write', 'transaction' => $services['db']->connection()->inTransaction()]);
                self::resume();
                return 1;
            }, 0);
            // TEMP belongs only to this synthetic connection and is allowed without
            // weakening the production connection's trusted_schema=OFF protection.
            $services['db']->connection()->exec('CREATE TEMP TRIGGER t054_hold_receipt BEFORE INSERT ON main.write_receipts BEGIN SELECT t054_pause(); END');
        }
        $review = null;
        if ($input['review'] ?? false) {
            $read = self::request($services, ['action' => 'read', 'fields' => $input['fields']]);
            $review = ['status' => $read['status'], 'etag' => $read['headers']['ETag'] ?? null];
        }
        self::emit(['event' => 'ready', 'review' => $review]);
        self::resume();
        if ($input['proveContention'] ?? false) {
            $lock = fopen($input['recovery'] . '/synthetic.sqlite.lock', 'rb');
            if ($lock === false) throw new RuntimeException('Cannot probe owned lock.');
            try {
                $acquired = flock($lock, LOCK_EX | LOCK_NB, $blocked);
                if ($acquired) flock($lock, LOCK_UN);
                self::emit(['event' => 'contention', 'blocked' => !$acquired && $blocked === 1]);
            } finally { fclose($lock); }
            // Immediately enter the actual route, which must acquire the same barrier.
        }
        $result = self::request($services, $input);
        if ($input['loseResponse'] ?? false) {
            if ($result['status'] !== 200 || ($input['lostRevision'] ?? null) !== json_decode($result['body'], true, 64, JSON_THROW_ON_ERROR)['committedRevision']) {
                throw new RuntimeException('Response-loss control requires the independently expected committed result.');
            }
            // The response is deliberately discarded at this process boundary. A test
            // control marker proves completion, but supplies no acknowledgement to retry.
            unset($result);
            self::emit(['event' => 'response-lost']);
        } else self::emit(['event' => 'result', 'response' => $result]);
    }
}

/** Independent T054 expectations; no production expected-result generator or HTTP auth bypass. */
final class SaveConcurrencyTest extends TestCase
{
    private const ACCOUNT = '54000000-0000-4000-8000-000000000001';
    private const OTHER = '54000000-0000-4000-8000-000000000002';
    private const KEY = '54000000-1000-4000-8000-000000000009';
    private const KEY2 = '54000000-1000-4000-8000-000000000010';
    private TestEnvironment $game;
    private TestEnvironment $recovery;
    private Database $database;
    private Sessions $sessions;
    private ?DeletionLedger $ledger = null;
    private int $now = 1795737600;
    private array $a;
    private array $b;
    private array $children = [];

    protected function setUp(): void
    {
        $this->game = TestEnvironment::create(); $this->game->connect();
        $this->database = Database::open($this->game->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')]);
        $this->database->migrate();
        $this->recovery = TestEnvironment::create(); $this->recovery->connect();
        $this->recovery->writeFile('synthetic.sqlite.lock', '');
        $this->ledger = DeletionLedger::initialize($this->recovery->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..')], [$this->game->directory()],
            new DeletionRetentionPolicy(2592000, 604800, 'T054-disposable-only'));
        $this->sessions = new Sessions($this->database, fn (): int => $this->now);
        $this->createAccount(self::ACCOUNT);
        $this->a = $this->authenticate(); $this->b = $this->authenticate();
        self::assertNotSame($this->a['context']->idHash, $this->b['context']->idHash);
    }

    protected function tearDown(): void
    {
        foreach (array_keys($this->children) as $id) $this->stop($id);
        unset($this->sessions, $this->database, $this->ledger);
        $game = $this->game->directory(); $recovery = $this->recovery->directory();
        $this->game->close(); $this->recovery->close();
        self::assertDirectoryDoesNotExist($game); self::assertDirectoryDoesNotExist($recovery);
    }

    private function createAccount(string $id): void
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$id, 'google', 'T054-synthetic-' . $id]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
    }

    private function authenticate(string $id = self::ACCOUNT): array
    {
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo): array => $this->sessions->rotateWithin($pdo, $guest['context'], $id));
    }

    private static function payload(): string
    { return file_get_contents(__DIR__ . '/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json'); }

    private function fields(array $auth, ?int $revision = null, string $key = self::KEY, array $changes = []): array
    {
        $headers = ['Origin' => SaveConcurrencyWorker::ORIGIN, 'Cookie' => explode(';', $auth['setCookie'], 2)[0],
            'X-CSRF-Token' => $auth['csrfToken'], 'Content-Type' => 'application/json', 'Idempotency-Key' => $key,
            'X-Save-Mode' => 'manual'];
        $headers[$revision === null ? 'If-None-Match' : 'If-Match'] = $revision === null ? '*' : '"save-' . $revision . '"';
        foreach ($changes as $name => $value) { if ($value === null) unset($headers[$name]); else $headers[$name] = $value; }
        return array_map(fn (string $name): array => [$name, $headers[$name]], array_keys($headers));
    }

    private function input(array $overrides = []): array
    {
        return array_replace(['root' => realpath(__DIR__ . '/../..'), 'game' => $this->game->directory(),
            'recovery' => $this->recovery->directory(), 'now' => $this->now, 'fields' => $this->fields($this->a),
            'body' => self::payload(), 'action' => 'save', 'policy' => 'current'], $overrides);
    }

    private function local(array $overrides = []): array
    {
        $input = $this->input($overrides);
        return SaveConcurrencyWorker::request(SaveConcurrencyWorker::services($input), $input);
    }

    private function seed(int $revision = 8): void
    {
        for ($i = 1; $i <= $revision; ++$i) {
            $fields = $this->fields($this->a, $i === 1 ? null : $i - 1, sprintf('54000000-2000-4000-8000-%012d', $i));
            $this->response($this->local(['fields' => $fields]), $i === 1 ? 201 : 200);
        }
    }

    /** Every start execs a fresh pinned PHP process and opens its own game and ledger PDO. */
    private function start(array $overrides = []): int
    {
        $code = 'require ' . var_export(__DIR__ . '/../vendor/autoload.php', true) . '; require '
            . var_export(__FILE__, true) . '; SaveConcurrencyWorker::main();';
        $process = proc_open([PHP_BINARY, '-d', 'display_errors=0', '-d', 'log_errors=0', '-d', 'auto_prepend_file=',
            '-d', 'auto_append_file=', '-r', $code], [0 => ['pipe', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes, $this->game->directory(), ['LANG' => 'C', 'LC_ALL' => 'C']);
        self::assertIsResource($process);
        foreach ($pipes as $pipe) stream_set_timeout($pipe, 8);
        $id = count($this->children) === 0 ? 0 : max(array_keys($this->children)) + 1;
        $this->children[$id] = ['process' => $process, 'pipes' => $pipes];
        $input = $this->input($overrides);
        $line = json_encode($input, JSON_THROW_ON_ERROR) . "\n";
        self::assertSame(strlen($line), fwrite($pipes[0], $line)); self::assertTrue(fflush($pipes[0]));
        $ready = $this->event($id, 'ready');
        self::assertNotSame(getmypid(), $ready['pid']);
        foreach ($this->children as $otherId => $child) {
            if ($otherId !== $id && isset($child['pid'])) self::assertNotSame($child['pid'], $ready['pid']);
        }
        $this->children[$id]['pid'] = $ready['pid'];
        $this->children[$id]['review'] = $ready['review'];
        return $id;
    }

    private function event(int $id, string $expected): array
    {
        $line = fgets($this->children[$id]['pipes'][1]);
        self::assertIsString($line, 'Child must report ' . $expected . ' before its bounded timeout.');
        $event = json_decode($line, true, 64, JSON_THROW_ON_ERROR);
        self::assertSame($expected, $event['event']);
        return $event;
    }

    private function go(int $id): void
    {
        self::assertSame(3, fwrite($this->children[$id]['pipes'][0], "GO\n"));
        self::assertTrue(fflush($this->children[$id]['pipes'][0]));
    }

    private function pause(int $id, string $phase = 'validated'): void
    {
        $this->go($id); $event = $this->event($id, $phase);
        self::assertSame($phase === 'inside-write', $event['transaction']);
    }

    private function finish(int $id, bool $lost = false): ?array
    {
        $event = $this->event($id, $lost ? 'response-lost' : 'result');
        $pipes = $this->children[$id]['pipes'];
        fclose($pipes[0]);
        self::assertSame('', stream_get_contents($pipes[1]));
        self::assertFalse(stream_get_meta_data($pipes[1])['timed_out']);
        self::assertSame('', stream_get_contents($pipes[2]));
        fclose($pipes[1]); fclose($pipes[2]);
        $exit = proc_close($this->children[$id]['process']); unset($this->children[$id]);
        self::assertSame(0, $exit, 'Independent worker exits cleanly.');
        return $event['response'] ?? null;
    }

    private function stop(int $id): void
    {
        $child = $this->children[$id];
        foreach ($child['pipes'] as $pipe) if (is_resource($pipe)) fclose($pipe);
        if (is_resource($child['process'])) {
            if (proc_get_status($child['process'])['running']) {
                proc_terminate($child['process']);
                $deadline = hrtime(true) + 200000000;
                while (proc_get_status($child['process'])['running'] && hrtime(true) < $deadline) usleep(1000);
                if (proc_get_status($child['process'])['running']) proc_terminate($child['process'], 9);
            }
            proc_close($child['process']);
        }
        unset($this->children[$id]);
    }

    private function response(array $response, int $expected, ?string $code = null): array
    {
        self::assertSame($expected, $response['status']); self::assertSame('no-store', $response['headers']['Cache-Control']);
        if ($expected === 204) { self::assertSame('', $response['body']); return []; }
        $data = json_decode($response['body'], true, 64, JSON_THROW_ON_ERROR);
        if ($code !== null) self::assertSame($code, $data['code']);
        if ($expected >= 400) {
            self::assertArrayNotHasKey('committedRevision', $data); self::assertArrayNotHasKey('replayed', $data);
            self::assertSame($expected === 412 ? ['code', 'message', 'requestId', 'currentSummary'] : ['code', 'message', 'requestId'], array_keys($data));
            self::assertSame($response['headers']['X-Request-Id'], $data['requestId']);
        }
        return $data;
    }

    private function rows(string $table): array
    { return $this->database->connection()->query('SELECT * FROM ' . $table . ' ORDER BY 1,2')->fetchAll(); }
    private function graph(): array { return [$this->rows('saves'), $this->rows('write_receipts')]; }
    private function slot(): array { $rows = $this->rows('saves'); self::assertCount(1, $rows); return $rows[0]; }

    public static function conditionalOrders(): iterable
    {
        foreach ([0, 8] as $revision) foreach ([0, 1] as $winner) yield "revision-$revision-winner-$winner" => [$revision, $winner];
    }

    #[DataProvider('conditionalOrders')]
    public function testBothConditionalWinnerOrdersUseOverlappingSessions(int $revision, int $winner): void
    {
        $this->seed($revision);
        $children = [];
        foreach ([$this->a, $this->b] as $index => $auth) {
            $children[] = $this->start(['fields' => $this->fields($auth, $revision ?: null, $index === 0 ? self::KEY : self::KEY2),
                'body' => self::payload() . str_repeat(' ', $index + 1), 'pause' => 'validated', 'review' => true]);
        }
        foreach ($children as $id) {
            self::assertSame(['status' => $revision === 0 ? 404 : 200, 'etag' => $revision === 0 ? null : '"save-8"'], $this->children[$id]['review']);
            $this->pause($id);
        }
        $this->go($children[$winner]); $success = $this->response($this->finish($children[$winner]), $revision === 0 ? 201 : 200);
        $this->go($children[1 - $winner]); $conflict = $this->response($this->finish($children[1 - $winner]), 412, 'save-conflict');
        self::assertSame($revision + 1, $success['committedRevision']); self::assertFalse($success['replayed']);
        self::assertSame($success['currentSummary'], $conflict['currentSummary']);
        self::assertSame($revision + 1, $this->slot()['revision']);
        self::assertSame(self::payload() . str_repeat(' ', $winner + 1), $this->slot()['payload_json']);
        self::assertCount($revision + 1, $this->rows('write_receipts'));
    }

    public static function operationVariants(): iterable
    {
        yield 'identical-lost-response' => [[], '', 200];
        yield 'exact-byte-whitespace' => [[], ' ', 409];
        yield 'save-mode' => [['X-Save-Mode' => 'automatic'], '', 409];
        yield 'replacement-confirmation' => [['X-Confirm-Adventure-Replacement' => 'true'], '', 409];
        yield 'precondition' => [['If-Match' => '"save-7"'], '', 409];
    }

    #[DataProvider('operationVariants')]
    public function testOverlappingSameKeyFingerprintsCommitOnlyOnce(array $changes, string $suffix, int $status): void
    {
        $this->seed();
        $a = $this->start(['fields' => $this->fields($this->a, 8), 'pause' => 'validated', 'loseResponse' => true, 'lostRevision' => 9]);
        $b = $this->start(['fields' => $this->fields($this->b, 8, self::KEY, $changes), 'body' => self::payload() . $suffix, 'pause' => 'validated']);
        $this->pause($a); $this->pause($b);
        $this->go($a); self::assertNull($this->finish($a, true));
        $before = $this->graph(); self::assertSame(9, $this->slot()['revision']);
        $this->go($b); $result = $this->response($this->finish($b), $status, $status === 409 ? 'idempotency-conflict' : null);
        if ($status === 200) { self::assertTrue($result['replayed']); self::assertSame(9, $result['committedRevision']); }
        self::assertSame($before, $this->graph()); self::assertCount(9, $this->rows('write_receipts'));
    }

    public static function changedPolicies(): iterable
    {
        yield 'retire-supported-write-pair' => ['retired'];
        yield 'new-content-only' => ['next-content'];
        yield 'retire-safe-anchor' => ['closed-anchor'];
    }

    #[DataProvider('changedPolicies')]
    public function testLostResponseReplaysBeforeChangedPolicyAndLaterRevision(string $policy): void
    {
        $this->seed(7);
        $fields = $this->fields($this->a, 7);
        $child = $this->start(['fields' => $fields, 'loseResponse' => true, 'lostRevision' => 8]);
        $this->go($child); self::assertNull($this->finish($child, true));
        self::assertSame(8, $this->slot()['revision']);
        $this->response($this->local(['fields' => $this->fields($this->b, 8, self::KEY2), 'body' => self::payload() . ' ']), 200);
        $before = $this->graph();
        self::assertFalse((new SaveValidator(SaveConcurrencyWorker::policies($policy)))->validateNewWrite(self::payload())->ok);
        $retry = $this->start(['fields' => $this->fields($this->b, 7), 'policy' => $policy]);
        $this->go($retry); $response = $this->finish($retry); $data = $this->response($response, 200);
        self::assertSame(8, $data['committedRevision']); self::assertTrue($data['replayed']);
        self::assertSame(9, $data['currentSummary']['revision']); self::assertSame('"save-9"', $response['headers']['ETag']);
        self::assertSame(gmdate('Y-m-d\TH:i:s\Z', $this->now), $data['committedAt']);
        $newKey = '54000000-1000-4000-8000-000000000011';
        $this->response($this->local(['fields' => $this->fields($this->b, 9, $newKey), 'policy' => $policy]), 422, 'invalid-save');
        self::assertSame($before, $this->graph());
        if ($policy === 'next-content') {
            $next = str_replace('"contentVersion": "1.0.0"', '"contentVersion": "2.0.0"', self::payload());
            self::assertTrue((new SaveValidator(SaveConcurrencyWorker::policies($policy)))->validateNewWrite($next)->ok);
        }
    }

    public static function provisionalRaces(): iterable
    {
        yield 'matching-receipt' => ['', false, 200];
        yield 'fingerprint-mismatch' => [' ', false, 409];
        yield 'revoked-after-other-device-commit' => ['', true, 401];
    }

    #[DataProvider('provisionalRaces')]
    public function testReceiptAndAuthorizationAreRecheckedBeforeProvisionalError(string $suffix, bool $revoke, int $status): void
    {
        $this->seed();
        $writer = $this->start(['fields' => $this->fields($this->a, 8), 'pause' => 'validated', 'loseResponse' => true, 'lostRevision' => 9]);
        $retry = $this->start(['fields' => $this->fields($this->b, 8), 'body' => self::payload() . $suffix,
            'pause' => 'validated', 'policy' => 'next-content']);
        $this->pause($writer); $this->pause($retry);
        $this->go($writer); $this->finish($writer, true);
        $before = $this->graph();
        if ($revoke) {
            $logout = $this->start(['action' => 'logout', 'body' => '', 'fields' => $this->fields($this->b)]);
            $this->go($logout); $this->response($this->finish($logout), 204);
        }
        $this->go($retry); $data = $this->response($this->finish($retry), $status,
            $status === 409 ? 'idempotency-conflict' : ($status === 401 ? 'unauthorized' : null));
        if ($status === 200) { self::assertSame(9, $data['committedRevision']); self::assertTrue($data['replayed']); }
        self::assertSame($before, $this->graph());
    }

    public function testWrongAccountCannotReadReceiptAppearingDuringItsValidation(): void
    {
        $this->seed(); $this->createAccount(self::OTHER); $other = $this->authenticate(self::OTHER);
        $foreign = $this->start(['fields' => $this->fields($other, 8), 'pause' => 'validated', 'policy' => 'next-content']);
        $writer = $this->start(['fields' => $this->fields($this->a, 8), 'pause' => 'validated']);
        $this->pause($foreign); $this->pause($writer);
        $this->go($writer); $this->response($this->finish($writer), 200);
        $before = $this->graph(); $this->go($foreign);
        $data = $this->response($this->finish($foreign), 422, 'invalid-save');
        self::assertArrayNotHasKey('currentSummary', $data); self::assertSame($before, $this->graph());
        $fresh = $this->start(['fields' => $this->fields($other), 'policy' => 'next-content']);
        $this->go($fresh); $this->response($this->finish($fresh), 422, 'invalid-save');
        self::assertSame($before, $this->graph());
    }

    public static function sessionInvalidations(): iterable
    {
        yield 'logout-before-initial-receipt' => ['admitted', 'logout', 'current'];
        yield 'logout-before-valid-write' => ['validated', 'logout', 'current'];
        yield 'logout-before-provisional-error' => ['validated', 'logout', 'retired'];
        yield 'delete-before-initial-receipt' => ['admitted', 'delete', 'current'];
        yield 'delete-before-valid-write' => ['validated', 'delete', 'current'];
        yield 'delete-before-provisional-error' => ['validated', 'delete', 'retired'];
    }

    private function deletionFields(array $auth): array
    {
        $this->database->connection()->prepare('INSERT INTO delete_reauth_proofs(session_hash,account_id,confirmed_at,expires_at) VALUES(?,?,?,?)')
            ->execute([$auth['context']->idHash, self::ACCOUNT, $this->now, $this->now + 300]);
        return $this->fields($auth, changes: ['X-Confirm-Account-Deletion' => 'delete-my-account',
            'X-Deletion-Receipt' => rtrim(strtr(base64_encode(str_repeat('T', 32)), '+/', '-_'), '=')]);
    }

    #[DataProvider('sessionInvalidations')]
    public function testAccountActionWinsBeforeReceiptOrFinalWrite(string $phase, string $action, string $policy): void
    {
        $this->seed();
        // Initial-lookup cases target a genuinely retained operation; final cases miss it.
        $fields = $phase === 'admitted'
            ? $this->fields($this->a, 7, '54000000-2000-4000-8000-000000000008')
            : $this->fields($this->a, 8);
        $before = $this->graph();
        $actionFields = $action === 'delete' ? $this->deletionFields($this->b) : $this->fields($this->a);
        $save = $this->start(['fields' => $fields, 'pause' => $phase, 'policy' => $policy]);
        $this->pause($save, $phase);
        $account = $this->start(['action' => $action, 'body' => '', 'fields' => $actionFields]);
        $this->go($account); $this->response($this->finish($account), 204);
        $this->go($save); $this->response($this->finish($save), 401, 'unauthorized');
        if ($action === 'logout') {
            self::assertSame($before, $this->graph());
            self::assertSame(1, count($this->rows('sessions')));
            $this->response($this->local(['action' => 'read', 'body' => '', 'fields' => $this->fields($this->b)]), 200);
        } else $this->assertDeleted();
    }

    private function assertDeleted(): void
    {
        foreach (['accounts', 'identities', 'sessions', 'preferences', 'saves', 'write_receipts', 'delete_reauth_proofs'] as $table) {
            self::assertSame([], $this->rows($table), $table);
        }
        $token = rtrim(strtr(base64_encode(str_repeat('T', 32)), '+/', '-_'), '=');
        $status = $this->ledger->exclusive(fn () => $this->ledger->receipt(hash('sha256', $token), $this->now));
        self::assertSame('completed', $status['state']);
    }

    public static function accountActions(): iterable
    { yield 'logout' => ['logout']; yield 'deletion' => ['delete']; }

    #[DataProvider('accountActions')]
    public function testSaveCommitsBeforeContendingAccountAction(string $action): void
    {
        $this->seed();
        $actionFields = $action === 'delete' ? $this->deletionFields($this->b) : $this->fields($this->a);
        $save = $this->start(['fields' => $this->fields($this->a, 8), 'body' => self::payload() . ' ',
            'pause' => 'inside-write', 'loseResponse' => true, 'lostRevision' => 9]);
        // Start both workers while setup can still open storage; then hold the real write.
        $account = $this->start(['action' => $action, 'body' => '', 'fields' => $actionFields, 'proveContention' => true]);
        $this->pause($save, 'inside-write');
        // An independent reader sees only the prior committed revision, never the half-write.
        self::assertSame(8, $this->slot()['revision']); self::assertCount(8, $this->rows('write_receipts'));
        $this->go($account); self::assertTrue($this->event($account, 'contention')['blocked']);
        $this->go($save); $this->finish($save, true);
        $this->response($this->finish($account), 204);
        if ($action === 'logout') {
            self::assertSame(9, $this->slot()['revision']); self::assertSame(self::payload() . ' ', $this->slot()['payload_json']);
            self::assertCount(9, $this->rows('write_receipts'));
            $this->response($this->local(['fields' => $this->fields($this->a, 8)]), 401, 'unauthorized');
            $replay = $this->response($this->local(['fields' => $this->fields($this->b, 8), 'body' => self::payload() . ' ']), 200);
            self::assertSame(9, $replay['committedRevision']); self::assertTrue($replay['replayed']);
        } else {
            $this->assertDeleted();
            $this->response($this->local(['fields' => $this->fields($this->a, 8)]), 401, 'unauthorized');
        }
    }

    public function testConcurrentOptOutRejectsNewAutomaticSaveButPreservesRetainedAutomaticReceipt(): void
    {
        $this->seed();
        $preferences = $this->fields($this->b, changes: ['If-None-Match' => null, 'If-Match' => '"prefs-1"']);
        $this->response($this->local(['action' => 'preferences', 'fields' => $preferences, 'body' => '{"autosaveEnabled":true}']), 200);
        $automatic = ['X-Save-Mode' => 'automatic'];
        $this->response($this->local(['fields' => $this->fields($this->a, 8, self::KEY, $automatic)]), 200);
        $before = $this->graph();
        $save = $this->start(['fields' => $this->fields($this->a, 9, self::KEY2, $automatic), 'pause' => 'validated']);
        $this->pause($save);
        $optOut = $this->start(['action' => 'preferences', 'body' => '{"autosaveEnabled":false}',
            'fields' => $this->fields($this->b, changes: ['If-None-Match' => null, 'If-Match' => '"prefs-2"'])]);
        $this->go($optOut); $this->response($this->finish($optOut), 200);
        $this->go($save); $this->response($this->finish($save), 409, 'autosave-disabled');
        self::assertSame($before, $this->graph()); self::assertSame(3, $this->rows('preferences')[0]['revision']);
        $replay = $this->response($this->local(['fields' => $this->fields($this->b, 8, self::KEY, $automatic)]), 200);
        self::assertTrue($replay['replayed']); self::assertSame(9, $replay['committedRevision']);
        self::assertSame($before, $this->graph());
    }

    public function testReceiptExpiryBoundaryCannotTurnStaleRetryIntoOverwrite(): void
    {
        $this->seed();
        $this->response($this->local(['fields' => $this->fields($this->a, 8)]), 200);
        $before = $this->graph(); $createdAt = $this->now;
        foreach ([604799 => 200, 604800 => 412, 604801 => 412] as $elapsed => $status) {
            $this->now = $createdAt + $elapsed;
            // Session lifetime is shorter than receipt lifetime: obtain fresh same-account credentials.
            $auth = $this->authenticate();
            $child = $this->start(['fields' => $this->fields($auth, 8)]);
            $this->go($child); $data = $this->response($this->finish($child), $status, $status === 412 ? 'save-conflict' : null);
            if ($status === 200) { self::assertTrue($data['replayed']); self::assertSame(9, $data['committedRevision']); }
            else self::assertSame(9, $data['currentSummary']['revision']);
            self::assertSame($before, $this->graph());
        }
        $fresh = $this->authenticate();
        $reuse = $this->response($this->local(['fields' => $this->fields($fresh, 9), 'body' => self::payload() . ' ']), 200);
        self::assertFalse($reuse['replayed']); self::assertSame(10, $reuse['committedRevision']);
        self::assertCount(9, $this->rows('write_receipts'));
        $receipt = array_values(array_filter($this->rows('write_receipts'), fn (array $row): bool => $row['request_id'] === self::KEY))[0];
        self::assertSame($this->now + 604800, $receipt['expires_at']); self::assertSame(10, $receipt['committed_revision']);
        $this->response($this->local(['fields' => $this->fields($fresh, 8)]), 409, 'idempotency-conflict');
        self::assertSame(10, $this->slot()['revision']);
    }

    public static function expiryRaces(): iterable
    { yield 'identical-new-operation' => ['', 200]; yield 'changed-operation' => [' ', 409]; }

    #[DataProvider('expiryRaces')]
    public function testTwoReusersOfExpiredKeyStillCommitOneNewOperation(string $suffix, int $status): void
    {
        $this->seed();
        $this->response($this->local(['fields' => $this->fields($this->a, 8)]), 200);
        $oldReceipts = $this->rows('write_receipts');
        $this->now += 604800;
        $a = $this->authenticate(); $b = $this->authenticate();
        $first = $this->start(['fields' => $this->fields($a, 9), 'pause' => 'validated']);
        $second = $this->start(['fields' => $this->fields($b, 9), 'body' => self::payload() . $suffix, 'pause' => 'validated']);
        $this->pause($first); $this->pause($second);
        $this->go($first); $success = $this->response($this->finish($first), 200);
        self::assertFalse($success['replayed']); self::assertSame(10, $success['committedRevision']);
        $before = $this->graph(); $this->go($second);
        $retry = $this->response($this->finish($second), $status, $status === 409 ? 'idempotency-conflict' : null);
        if ($status === 200) { self::assertTrue($retry['replayed']); self::assertSame(10, $retry['committedRevision']); }
        self::assertSame($before, $this->graph()); self::assertCount(9, $this->rows('write_receipts'));
        $others = fn (array $rows): array => array_values(array_filter($rows, fn (array $row): bool => $row['request_id'] !== self::KEY));
        self::assertSame($others($oldReceipts), $others($this->rows('write_receipts')), 'No opportunistic cleanup of other expired receipts.');
    }

    public function testSameKeyOnTwoAccountsRemainsIndependentlyScoped(): void
    {
        $this->createAccount(self::OTHER); $other = $this->authenticate(self::OTHER);
        $first = $this->start(['pause' => 'validated']);
        $second = $this->start(['fields' => $this->fields($other), 'body' => self::payload() . ' ', 'pause' => 'validated']);
        $this->pause($first); $this->pause($second);
        $this->go($first); $this->response($this->finish($first), 201);
        $this->go($second); $this->response($this->finish($second), 201);
        self::assertCount(2, $this->rows('saves')); self::assertCount(2, $this->rows('write_receipts'));
        foreach ($this->rows('saves') as $row) {
            self::assertSame(1, $row['revision']);
            self::assertSame(self::payload() . ($row['account_id'] === self::OTHER ? ' ' : ''), $row['payload_json']);
        }
    }

    public static function finalAuthorityChanges(): iterable
    {
        yield 'account-rebound' => ['account'];
        yield 'generation-changed' => ['generation'];
        yield 'csrf-rotated' => ['csrf'];
        yield 'idle-expiry' => ['idle'];
        yield 'absolute-expiry' => ['absolute'];
    }

    #[DataProvider('finalAuthorityChanges')]
    public function testFinalAuthorizationRejectsChangedContextBeforeCachedValidation(string $change): void
    {
        $this->seed(); $this->createAccount(self::OTHER);
        $before = $this->graph();
        $elapsed = $change === 'idle' ? 7200 : ($change === 'absolute' ? 86400 : 0);
        $save = $this->start(['fields' => $this->fields($this->a, 8), 'policy' => 'retired',
            'pause' => 'validated', 'afterPauseNow' => $this->now + $elapsed]);
        $this->pause($save);
        // Synthetic invalidation on a distinct connection, never caller-supplied authority.
        // These deliberately exercise the full bound context, beyond ordinary logout.
        $sql = match ($change) {
            'account' => 'UPDATE sessions SET account_id=? WHERE id_hash=?',
            'generation' => 'UPDATE sessions SET generation=generation+1 WHERE id_hash=?',
            'csrf' => 'UPDATE sessions SET csrf_hash=? WHERE id_hash=?',
            'absolute' => 'UPDATE sessions SET last_activity=? WHERE id_hash=?',
            'idle' => null,
        };
        $values = match ($change) {
            'account' => [self::OTHER, $this->a['context']->idHash],
            'csrf' => [str_repeat('a', 64), $this->a['context']->idHash],
            'absolute' => [$this->now + 86399, $this->a['context']->idHash],
            default => [$this->a['context']->idHash],
        };
        if ($sql !== null) $this->database->immediate(fn (PDO $pdo) => $pdo->prepare($sql)->execute($values));
        $this->go($save); $this->response($this->finish($save), 401, 'unauthorized');
        self::assertSame($before, $this->graph());
    }

    public function testActualCompetingProcessTimesOutWithoutOverwritingHeldWriter(): void
    {
        $this->seed();
        $holder = $this->start(['fields' => $this->fields($this->a, 8), 'pause' => 'inside-write']);
        $contender = $this->start(['fields' => $this->fields($this->b, 8, self::KEY2), 'proveContention' => true]);
        $this->pause($holder, 'inside-write'); $before = $this->graph();
        $start = hrtime(true); $this->go($contender); self::assertTrue($this->event($contender, 'contention')['blocked']);
        $failure = $this->finish($contender); $this->response($failure, 503, 'unavailable');
        self::assertArrayHasKey('Retry-After', $failure['headers']);
        self::assertLessThan(2.0, (hrtime(true) - $start) / 1e9);
        self::assertSame($before, $this->graph());
        $this->go($holder); $this->response($this->finish($holder), 200);
        self::assertSame(9, $this->slot()['revision']); self::assertCount(9, $this->rows('write_receipts'));
        $this->response($this->local(['fields' => $this->fields($this->b, 8, self::KEY2)]), 412, 'save-conflict');
    }

    public function testKilledWriterRollsBackSnapshotAndReceiptThenExactRetryCommitsOnce(): void
    {
        $this->seed(); $before = $this->graph();
        $fields = $this->fields($this->a, 8);
        $writer = $this->start(['fields' => $fields, 'body' => self::payload() . ' ', 'pause' => 'inside-write']);
        $this->pause($writer, 'inside-write');
        self::assertSame($before, $this->graph());
        // Kill before receipt/COMMIT, while SQLite and the shared external lock are held.
        self::assertTrue(proc_terminate($this->children[$writer]['process'], 9));
        $this->stop($writer);
        self::assertSame($before, $this->graph());
        $retry = $this->start(['fields' => $fields, 'body' => self::payload() . ' ']);
        $this->go($retry); $result = $this->response($this->finish($retry), 200);
        self::assertFalse($result['replayed']); self::assertSame(9, $result['committedRevision']);
        self::assertCount(9, $this->rows('write_receipts')); self::assertSame(self::payload() . ' ', $this->slot()['payload_json']);
        $before = $this->graph();
        $replay = $this->response($this->local(['fields' => $fields, 'body' => self::payload() . ' ']), 200);
        self::assertTrue($replay['replayed']); self::assertSame($before, $this->graph());
    }
}
