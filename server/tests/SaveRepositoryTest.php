<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\AccountAccess;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\RequestRejected;
use NetworkQuest\SaveRepository;
use NetworkQuest\SaveValidator;
use NetworkQuest\SaveWriteResult;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use NetworkQuest\Tests\Support\DirectAccountAccess;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/Support/DirectAccountAccess.php';
foreach (['Database', 'Security', 'Sessions', 'SaveValidator', 'DeletionLedger', 'RecoveryAccountAccess'] as $file) {
    require_once __DIR__ . '/../src/' . $file . '.php';
}
require_once __DIR__ . '/../src/SaveRepository.php';

final class SaveRepositoryTest extends TestCase
{
    private TestEnvironment $environment;
    private ?TestEnvironment $recoveryEnvironment = null;
    private ?DeletionLedger $ledger = null;
    private Database $database;
    private Sessions $sessions;
    private Security $security;
    private array $auth;
    private int $now = 1795737600;
    private const ACCOUNT = '60000000-0000-4000-8000-000000000001';
    private const OTHER = '60000000-0000-4000-8000-000000000002';
    private const KEY = '70000000-0000-4000-8000-000000000001';
    private const KEY2 = '70000000-0000-4000-8000-000000000002';
    private const ORIGIN = 'https://network-quest.invalid';
    private const ROUTE = '/arcade/play/network-quest/api/v1/save';
    private const VERSIONS = [['saveSchemaVersion' => 1, 'contentVersion' => '1.0.0']];

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->environment->connect();
        $this->database = $this->open();
        $this->database->migrate();
        $this->sessions = new Sessions($this->database, fn (): int => $this->now);
        $this->security = new Security($this->database, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn (): int => $this->now);
        $this->account(self::ACCOUNT);
        $this->auth = $this->authenticate();
    }

    protected function tearDown(): void
    {
        unset($this->security, $this->sessions, $this->database);
        unset($this->ledger);
        $this->recoveryEnvironment?->close();
        $this->environment->close();
    }

    private function open(): Database
    {
        return Database::open($this->environment->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')]);
    }

    private function account(string $id): void
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$id, 'google', 'synthetic-' . $id]);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
    }

    private function authenticate(string $id = self::ACCOUNT): array
    {
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $pdo): array => $this->sessions->rotateWithin($pdo, $guest['context'], $id));
    }

    private static function body(): string
    {
        return file_get_contents(__DIR__ . '/../../specs/001-physical-layer-underworld/contracts/examples/save-v1.json');
    }

    private static function policy(): object
    {
        $policy = json_decode(file_get_contents(__DIR__ . '/../../tests/services/save-validator-policy.json'))->policy;
        $policy->recruits->{'spec001:fixture.helper'}->abilityIdsByLevel = (object) [
            '1' => [], '2' => ['spec001:fixture.measure'],
        ];
        return $policy;
    }

    private function repository(?callable $observer = null, ?array $policies = null, ?array $versions = null, ?AccountAccess $access = null): SaveRepository
    {
        return new SaveRepository($this->database, $this->sessions, $this->security,
            new SaveValidator($policies ?? [self::policy()]), $versions ?? self::VERSIONS, $access ?? new DirectAccountAccess(),
            fn (): int => $this->now, $observer);
    }

    private function actualAccess(): RecoveryAccountAccess
    {
        $this->recoveryEnvironment = TestEnvironment::create();
        $this->recoveryEnvironment->connect();
        $this->recoveryEnvironment->writeFile('synthetic.sqlite.lock', '');
        $this->ledger = DeletionLedger::initialize($this->recoveryEnvironment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..')], [$this->environment->directory()],
            new DeletionRetentionPolicy(2592000, 604800, 'synthetic-save-join'));
        return new RecoveryAccountAccess($this->database, $this->ledger, fn () => $this->now);
    }

    private function headers(array $changes = [], ?array $auth = null): array
    {
        $auth ??= $this->auth;
        $headers = ['Origin' => self::ORIGIN, 'Cookie' => explode(';', $auth['setCookie'], 2)[0],
            'X-CSRF-Token' => $auth['csrfToken'], 'Idempotency-Key' => self::KEY, 'X-Save-Mode' => 'manual', 'If-None-Match' => '*'];
        foreach ($changes as $name => $value) {
            if ($value === null) { unset($headers[$name]); } else { $headers[$name] = $value; }
        }
        return array_map(fn ($key) => [$key, $headers[$key]], array_keys($headers));
    }

    private function replacement(array $changes = [], int $revision = 1, ?array $auth = null): array
    {
        return $this->headers(array_replace(['If-None-Match' => null, 'If-Match' => '"save-' . $revision . '"', 'Idempotency-Key' => self::KEY2], $changes), $auth);
    }

    private function rows(string $table): array { return $this->database->connection()->query('SELECT * FROM ' . $table)->fetchAll(); }
    private function slot(): array { return $this->rows('saves')[0]; }
    private function receipts(): array { return $this->rows('write_receipts'); }
    private function optIn(bool $enabled = true): void { $this->database->connection()->prepare('UPDATE preferences SET autosave_enabled=?')->execute([(int) $enabled]); }

    private function case(string $id, SaveWriteResult $result): void
    {
        $cases = json_decode(file_get_contents(__DIR__ . '/Fixtures/save-cases.json'))->cases;
        $case = array_values(array_filter($cases, fn ($case) => $case->id === $id))[0];
        self::assertSame($case->expected->status, $result->status, $id);
    }

    private function rejected(callable $operation, int $status): void
    {
        try { $operation(); } catch (RequestRejected $error) { self::assertSame($status, $error->status); return; }
        self::fail('Expected fixed request rejection.');
    }

    public function testCreateExactSnapshotMetadataOnlyReceiptAndDefaultOff(): void
    {
        $raw = self::body() . " \n";
        $result = $this->repository()->write('127.0.0.1', $this->headers(), $raw);
        $this->case('SV-CREATE', $result);
        $summary = ['revision' => 1, 'etag' => '"save-1"', 'savedAt' => '2026-11-27T00:00:00Z',
            'adventureId' => '8d189c08-9d3e-41ba-b044-b6c9e2c0d409', 'episodeId' => 'spec001',
            'roomId' => 'spec001:R01', 'outcome' => null, 'saveSchemaVersion' => 1, 'contentVersion' => '1.0.0'];
        self::assertSame($summary, $result->currentSummary);
        self::assertSame(['requestId' => self::KEY, 'committedRevision' => 1, 'committedAt' => '2026-11-27T00:00:00Z',
            'replayed' => false, 'currentSummary' => $summary], $result->acknowledgement);
        self::assertSame('"save-1"', $result->etag);
        self::assertCount(1, $this->rows('saves'));
        self::assertSame($raw, $this->slot()['payload_json']);
        self::assertSame(hash('sha256', $raw), $this->slot()['payload_hash']);
        self::assertSame($summary, json_decode($this->slot()['summary_json'], true));
        $receipt = $this->receipts()[0];
        self::assertSame($this->now + 604800, $receipt['expires_at']);
        self::assertSame(['requestId', 'committedRevision', 'committedAt'], array_keys(json_decode($receipt['acknowledgement_json'], true)));
        self::assertSame(0, $this->rows('preferences')[0]['autosave_enabled']);
        self::assertSame(1, $this->rows('preferences')[0]['revision']);
    }

    public function testReplacementAndOlderReceiptReturnCurrentEtagWithoutDuplicateWrite(): void
    {
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        for ($revision = 1; $revision < 9; ++$revision) {
            $headers = $this->replacement(['Idempotency-Key' => sprintf('70000000-0000-4000-8000-%012d', $revision + 1)], $revision);
            $this->case('SV-REPLACE', $repo->write('127.0.0.1', $headers, self::body() . str_repeat(' ', $revision)));
            if ($revision === 7) { $eighth = [$headers, self::body() . str_repeat(' ', $revision)]; }
        }
        $before = $this->slot();
        $replay = $repo->write('127.0.0.1', ...$eighth);
        $this->case('SV-REPLAY-OLDER', $replay);
        self::assertSame(8, $replay->acknowledgement['committedRevision']);
        self::assertTrue($replay->acknowledgement['replayed']);
        self::assertSame(9, $replay->currentSummary['revision']);
        self::assertSame('"save-9"', $replay->etag);
        self::assertSame($before, $this->slot());
        self::assertCount(9, $this->receipts());
    }

    public function testPreconditionsAndConsentNeverBecomeUnconditionalUpserts(): void
    {
        $repo = $this->repository();
        $empty = $repo->write('127.0.0.1', $this->replacement(), self::body());
        $this->case('SV-REPLACE-EMPTY', $empty);
        self::assertNull($empty->currentSummary);
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $before = $this->slot();
        $this->case('SV-CREATE-OCCUPIED', $repo->write('127.0.0.1', $this->headers(['Idempotency-Key' => self::KEY2]), self::body()));
        $conflict = $repo->write('127.0.0.1', $this->replacement([], 8), self::body());
        $this->case('SV-STALE', $conflict);
        self::assertSame('save-conflict', $conflict->code);
        self::assertSame(1, $conflict->currentSummary['revision']);
        $different = str_replace('8d189c08-9d3e-41ba-b044-b6c9e2c0d409', 'aaaaaaaa-0000-4000-8000-000000000001', self::body());
        $this->case('SV-DIFFERENT-MANUAL', $repo->write('127.0.0.1', $this->replacement(), $different));
        self::assertSame($before, $this->slot());
        $this->case('SV-RECONSENT', $repo->write('127.0.0.1', $this->replacement(['X-Confirm-Adventure-Replacement' => 'true'], 8), $different));
        $this->case('SV-CONFIRMED-REPLACE', $repo->write('127.0.0.1', $this->replacement(['X-Confirm-Adventure-Replacement' => 'true']), $different));
        self::assertSame(2, $this->slot()['revision']);
        self::assertCount(1, $this->rows('saves'));
    }

    public function testAutosaveRequiresCurrentOptInExistingSameAdventureAndDoesNotCreatePreferences(): void
    {
        $repo = $this->repository();
        $this->optIn();
        $this->case('SV-ADOPT-AUTO', $repo->write('127.0.0.1', $this->headers(['X-Save-Mode' => 'automatic']), self::body()));
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $different = str_replace('8d189c08-9d3e-41ba-b044-b6c9e2c0d409', 'aaaaaaaa-0000-4000-8000-000000000001', self::body());
        $auto = $this->replacement(['X-Save-Mode' => 'automatic', 'X-Confirm-Adventure-Replacement' => 'true']);
        $this->case('SV-DIFFERENT-AUTO', $repo->write('127.0.0.1', $auto, $different));
        $this->optIn(false);
        $this->case('SV-AUTO-OPTOUT', $repo->write('127.0.0.1', $auto, self::body()));
        $this->optIn();
        $this->case('SV-AUTO-OPTIN', $repo->write('127.0.0.1', $auto, self::body()));
        $this->optIn(false);
        $this->case('SV-REPLAY-AUTO-OPTOUT', $repo->write('127.0.0.1', $auto, self::body()));
        self::assertSame(2, $this->slot()['revision']);
        $this->database->connection()->exec('DELETE FROM preferences');
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->replacement(['Idempotency-Key' => '70000000-0000-4000-8000-000000000003'], 2), self::body()), 503);
        self::assertSame([], $this->rows('preferences'));
        self::assertSame(2, $this->slot()['revision']);
    }

    public static function changedOperation(): iterable
    {
        yield 'body' => [[], ' ', 'SV-KEY-BODY'];
        yield 'mode' => [['X-Save-Mode' => 'automatic'], '', 'SV-KEY-MODE'];
        yield 'confirmation' => [['X-Confirm-Adventure-Replacement' => 'true'], '', 'SV-KEY-CONFIRM'];
        yield 'precondition' => [['If-None-Match' => null, 'If-Match' => '"save-1"'], '', 'SV-KEY-PRECONDITION'];
    }

    #[DataProvider('changedOperation')]
    public function testRetainedKeyRejectsAnyChangedOperationWithoutDisclosingAcknowledgement(array $changes, string $suffix, string $id): void
    {
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $before = [$this->slot(), $this->receipts()];
        $result = $repo->write('127.0.0.1', $this->headers($changes), self::body() . $suffix);
        $this->case($id, $result);
        self::assertNull($result->acknowledgement);
        self::assertNull($result->currentSummary);
        self::assertSame($before, [$this->slot(), $this->receipts()]);
    }

    public function testRetainedReceiptBeforeChangedPolicyAndReauthentication(): void
    {
        $first = $this->repository()->write('127.0.0.1', $this->headers(), self::body());
        $newSession = $this->authenticate();
        $phases = [];
        $repo = $this->repository(function (string $phase) use (&$phases): void { $phases[] = $phase; }, [], []);
        $replay = $repo->write('127.0.0.1', $this->headers([], $newSession), self::body());
        $this->case('SV-OLD-POLICY', $replay);
        self::assertSame($first->acknowledgement['committedAt'], $replay->acknowledgement['committedAt']);
        self::assertSame(['admitted'], $phases);
        $this->case('SV-OLD-POLICY-NEW-KEY', $repo->write('127.0.0.1', $this->headers(['Idempotency-Key' => self::KEY2]), self::body()));
        self::assertSame(1, $this->slot()['revision']);
    }

    public function testReceiptLifetimeBeforeAtAndAfterSevenDaysDoesNotRequireCleanup(): void
    {
        $start = $this->now;
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $repo->write('127.0.0.1', $this->replacement(), self::body() . ' ');
        $receipt = $this->receipts();
        foreach ([604799 => 200, 604800 => 412, 604801 => 412] as $age => $status) {
            $this->now = $start + $age;
            $this->auth = $this->authenticate();
            $result = $repo->write('127.0.0.1', $this->replacement(), self::body() . ' ');
            self::assertSame($status, $result->status);
            self::assertSame(2, $this->slot()['revision']);
            self::assertSame($receipt, $this->receipts());
        }
        // An expired key may name a new reviewed operation, never bypass a stale condition.
        self::assertSame(200, $repo->write('127.0.0.1', $this->replacement([], 2), self::body() . '  ')->status);
        self::assertSame(3, $this->slot()['revision']);
        self::assertCount(2, $this->receipts());
        self::assertSame($this->now, $this->receipts()[1]['committed_at']);
    }

    public static function guardCases(): iterable
    {
        yield 'missing-condition' => [['If-None-Match' => null], 428];
        yield 'two-conditions' => [['If-Match' => '"save-1"'], 400];
        yield 'weak' => [['If-None-Match' => null, 'If-Match' => 'W/"save-1"'], 400];
        yield 'leading-zero' => [['If-None-Match' => null, 'If-Match' => '"save-01"'], 400];
        yield 'overflow' => [['If-None-Match' => null, 'If-Match' => '"save-9007199254740992"'], 400];
        yield 'wildcard-match' => [['If-None-Match' => null, 'If-Match' => '*'], 400];
        yield 'list' => [['If-None-Match' => null, 'If-Match' => '"save-1", "save-2"'], 400];
        yield 'non-star-create' => [['If-None-Match' => '"save-1"'], 400];
        yield 'mode' => [['X-Save-Mode' => 'background'], 400];
        yield 'missing-mode' => [['X-Save-Mode' => null], 400];
        yield 'consent' => [['X-Confirm-Adventure-Replacement' => 'false'], 400];
        yield 'key' => [['Idempotency-Key' => 'not-a-uuid'], 400];
        yield 'key-newline' => [['Idempotency-Key' => self::KEY . "\n"], 400];
        yield 'origin' => [['Origin' => 'https://other.invalid'], 403];
        yield 'csrf' => [['X-CSRF-Token' => str_repeat('A', 43)], 403];
        yield 'missing-session' => [['Cookie' => null], 401];
    }

    #[DataProvider('guardCases')]
    public function testFixedGuardsApplyToMatchingReplays(array $changes, int $status): void
    {
        $this->repository()->write('127.0.0.1', $this->headers(), self::body());
        $before = [$this->slot(), $this->receipts()];
        $repo = $this->repository(fn () => self::fail('No receipt phase may run before guards.'), []);
        if ($status === 428) { self::assertSame($status, $repo->write('127.0.0.1', $this->headers($changes), self::body())->status); }
        else { $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers($changes), self::body()), $status); }
        self::assertSame($before, [$this->slot(), $this->receipts()]);
    }

    public function testBoundedExactBytesAndMalformedJsonOnlyAfterFinalRecheck(): void
    {
        $repo = $this->repository();
        $body = self::body() . str_repeat(' ', 262144 - strlen(self::body()));
        self::assertSame(201, $repo->write('127.0.0.1', $this->headers(), $body)->status);
        self::assertSame($body, $this->slot()['payload_json']);
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers(), $body . ' '), 413);
        foreach (["{", "\xff", '{"saveSchemaVersion":99}'] as $raw) {
            $result = $repo->write('127.0.0.1', $this->replacement(), $raw);
            self::assertSame($raw === '{"saveSchemaVersion":99}' ? 422 : 400, $result->status);
            self::assertNull($result->acknowledgement);
            self::assertNull($result->currentSummary);
        }
        self::assertCount(1, $this->receipts());
    }

    public function testWrongAccountCannotReadAnotherReceiptAndClientAccountSelectorFailsValidation(): void
    {
        $this->repository()->write('127.0.0.1', $this->headers(), self::body());
        $this->account(self::OTHER);
        $other = $this->authenticate(self::OTHER);
        $result = $this->repository()->write('127.0.0.1', $this->replacement(['Idempotency-Key' => self::KEY], 1, $other), self::body());
        $this->case('SV-WRONG-OWNER', $result);
        self::assertNull($result->currentSummary);
        self::assertNull($result->acknowledgement);
        $value = json_decode(self::body());
        $value->accountId = self::ACCOUNT;
        self::assertSame(422, $this->repository()->write('127.0.0.1', $this->headers([], $other), json_encode($value))->status);
        self::assertCount(1, $this->rows('saves'));
        self::assertCount(1, $this->receipts());
    }

    public function testAuthorizationRecheckedBeforeInitialReceiptReturn(): void
    {
        $this->repository()->write('127.0.0.1', $this->headers(), self::body());
        $other = $this->open();
        $repo = $this->repository(function (string $phase) use ($other): void {
            self::assertSame('admitted', $phase);
            self::assertFalse($this->database->connection()->inTransaction());
            $other->immediate(fn (PDO $pdo) => $pdo->exec('DELETE FROM sessions'));
        });
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers(), self::body()), 401);
        self::assertSame(1, $this->slot()['revision']);
        self::assertCount(1, $this->receipts());
    }

    public function testReceiptAppearingAfterValidationWinsEvenOverNewPolicyError(): void
    {
        $other = $this->open();
        $sessions = new Sessions($other, fn (): int => $this->now);
        $security = new Security($other, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn (): int => $this->now);
        $writer = new SaveRepository($other, $sessions, $security, new SaveValidator([self::policy()]), self::VERSIONS, new DirectAccountAccess(), fn (): int => $this->now);
        $repo = $this->repository(function (string $phase) use ($writer): void {
            if ($phase !== 'validated') { return; }
            self::assertFalse($this->database->connection()->inTransaction());
            self::assertSame(201, $writer->write('127.0.0.1', $this->headers(), self::body())->status);
        }, []);
        $result = $repo->write('127.0.0.1', $this->headers(), self::body());
        self::assertSame(200, $result->status);
        self::assertTrue($result->acknowledgement['replayed']);
        self::assertSame(1, $result->acknowledgement['committedRevision']);
        self::assertCount(1, $this->receipts());
    }

    public function testFinalReceiptMismatchWinsOverProvisionalError(): void
    {
        $other = $this->open();
        $writer = new SaveRepository($other, new Sessions($other, fn (): int => $this->now),
            new Security($other, self::ORIGIN, str_repeat('synthetic-rate-key', 3)), new SaveValidator([self::policy()]), self::VERSIONS, new DirectAccountAccess(), fn (): int => $this->now);
        $repo = $this->repository(function (string $phase) use ($writer): void {
            if ($phase === 'validated') { $writer->write('127.0.0.1', $this->headers(), self::body() . ' '); }
        }, []);
        $result = $repo->write('127.0.0.1', $this->headers(), self::body());
        self::assertSame(409, $result->status);
        self::assertNull($result->acknowledgement);
        self::assertCount(1, $this->receipts());
    }

    public function testRevocationBeforeProvisionalErrorAndOptOutBeforeFinalWrite(): void
    {
        $other = $this->open();
        $repo = $this->repository(function (string $phase) use ($other): void {
            if ($phase === 'validated') { $other->immediate(fn (PDO $pdo) => $pdo->exec('DELETE FROM sessions')); }
        }, []);
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers(), self::body()), 401);
        self::assertSame([], $this->rows('saves'));
        $this->auth = $this->authenticate();
        $this->repository()->write('127.0.0.1', $this->headers(), self::body());
        $this->optIn();
        $repo = $this->repository(function (string $phase) use ($other): void {
            if ($phase === 'validated') { $other->immediate(fn (PDO $pdo) => $pdo->exec('UPDATE preferences SET autosave_enabled=0')); }
        });
        $this->case('SV-AUTO-OPTOUT', $repo->write('127.0.0.1', $this->replacement(['X-Save-Mode' => 'automatic']), self::body()));
        self::assertSame(1, $this->slot()['revision']);
    }

    public function testHeldIndependentWriterFailsBoundedlyAndReceiptFailureRollsBackSlot(): void
    {
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $before = [$this->slot(), $this->receipts()];
        $other = $this->environment->connect();
        $other->exec('BEGIN IMMEDIATE');
        $started = hrtime(true);
        try { $repo->write('127.0.0.1', $this->replacement(), self::body()); self::fail('Expected SQLITE_BUSY.'); }
        catch (PDOException $error) { self::assertSame(5, $error->errorInfo[1]); }
        finally { $other->exec('ROLLBACK'); }
        self::assertLessThan(2.0, (hrtime(true) - $started) / 1e9);
        self::assertSame($before, [$this->slot(), $this->receipts()]);
        // Test-only trigger is an actual storage failure after the slot mutation, before commit.
        $other->exec("CREATE TRIGGER synthetic_receipt_failure BEFORE INSERT ON write_receipts BEGIN SELECT RAISE(ABORT, 'synthetic storage failure'); END");
        try { $repo->write('127.0.0.1', $this->replacement(), self::body() . ' '); self::fail('Expected receipt insert failure.'); }
        catch (PDOException $error) { self::assertSame(19, $error->errorInfo[1]); }
        self::assertSame($before, [$this->slot(), $this->receipts()]);
        $other->exec('DROP TRIGGER synthetic_receipt_failure');
        self::assertSame(200, $repo->write('127.0.0.1', $this->replacement(), self::body() . ' ')->status);
    }

    public function testFutureStoredVersionAndRevisionLimitRemainUntouched(): void
    {
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $pdo = $this->database->connection();
        $pdo->exec('UPDATE saves SET schema_version=99');
        $before = $this->slot();
        self::assertSame(422, $repo->write('127.0.0.1', $this->replacement(), self::body())->status);
        self::assertSame($before, $this->slot());
        self::assertSame(200, $repo->write('127.0.0.1', $this->headers(), self::body())->status);
        $pdo->exec('UPDATE saves SET schema_version=1, revision=9007199254740991');
        $before = $this->slot();
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->replacement([], 9007199254740991), self::body()), 503);
        self::assertSame($before, $this->slot());
        self::assertCount(1, $this->receipts());
    }

    public function testUppercaseAdventureEqualityAndExactCaseSensitiveRequestKeys(): void
    {
        $repo = $this->repository();
        $key = 'AAAAAAAA-0000-4000-8000-000000000001';
        $raw = str_replace('8d189c08-9d3e-41ba-b044-b6c9e2c0d409', '8D189C08-9D3E-41BA-B044-B6C9E2C0D409', self::body());
        $result = $repo->write('127.0.0.1', $this->headers(['Idempotency-Key' => $key]), $raw);
        self::assertSame($key, $result->acknowledgement['requestId']);
        self::assertSame('8D189C08-9D3E-41BA-B044-B6C9E2C0D409', $result->currentSummary['adventureId']);
        self::assertSame($raw, $this->slot()['payload_json']);
        self::assertSame(412, $repo->write('127.0.0.1', $this->headers(['Idempotency-Key' => strtolower($key)]), $raw)->status);
        $this->optIn();
        self::assertSame(200, $repo->write('127.0.0.1', $this->replacement(['X-Save-Mode' => 'automatic']), self::body())->status);
        self::assertSame('8d189c08-9d3e-41ba-b044-b6c9e2c0d409', $this->slot()['adventure_id']);
    }

    public function testIndependentFingerprintVectorAndAllOperationFields(): void
    {
        $parts = ['PUT', self::ROUTE, 'manual', null, 'if-none-match', '*', "{\"a\":1}\n"];
        // Independent Python hashlib + network-order uint32 lengths, recorded before this assertion.
        $expected = '3601ae662a1817b12c72529a5e85921ce7ea9ecc294ea97b44e7df1e04ebae95';
        self::assertSame($expected, SaveRepository::fingerprint(...$parts));
        foreach (['POST', self::ROUTE . '/other', 'automatic', 'true', 'if-match', '"save-1"', '{"a":1}'] as $index => $changed) {
            $variant = $parts;
            $variant[$index] = $changed;
            self::assertNotSame($expected, SaveRepository::fingerprint(...$variant));
        }
        self::assertNotSame(SaveRepository::fingerprint('a', 'bc', 'manual', null, 'if-match', '1', ''),
            SaveRepository::fingerprint('ab', 'c', 'manual', null, 'if-match', '1', ''));
        $raw = self::body() . ' ';
        $this->repository()->write('127.0.0.1', $this->headers(), $raw);
        self::assertSame(SaveRepository::fingerprint('PUT', self::ROUTE, 'manual', null, 'if-none-match', '*', $raw), $this->receipts()[0]['fingerprint']);
    }

    public function testFinalHeldLockAndCompetingRevisionPreserveTheWinner(): void
    {
        $this->repository()->write('127.0.0.1', $this->headers(), self::body());
        $other = $this->environment->connect();
        $before = [$this->slot(), $this->receipts()];
        $repo = $this->repository(function (string $phase) use ($other): void {
            if ($phase === 'validated') { $other->exec('BEGIN IMMEDIATE'); }
        });
        try { $repo->write('127.0.0.1', $this->replacement(), self::body()); self::fail('Expected final write lock timeout.'); }
        catch (PDOException $error) { self::assertSame(5, $error->errorInfo[1]); }
        finally { $other->exec('ROLLBACK'); }
        self::assertSame($before, [$this->slot(), $this->receipts()]);
        $otherDb = $this->open();
        $secondSession = $this->authenticate();
        $writer = new SaveRepository($otherDb, new Sessions($otherDb, fn (): int => $this->now),
            new Security($otherDb, self::ORIGIN, str_repeat('synthetic-rate-key', 3), fn (): int => $this->now),
            new SaveValidator([self::policy()]), self::VERSIONS, new DirectAccountAccess(), fn (): int => $this->now);
        $repo = $this->repository(function (string $phase) use ($writer, $secondSession): void {
            if ($phase === 'validated') {
                self::assertSame(200, $writer->write('127.0.0.1', $this->replacement(['Idempotency-Key' => '70000000-0000-4000-8000-000000000003'], 1, $secondSession), self::body() . ' ')->status);
            }
        });
        $result = $repo->write('127.0.0.1', $this->replacement(), self::body());
        self::assertSame(412, $result->status);
        self::assertSame(2, $result->currentSummary['revision']);
        self::assertSame(self::body() . ' ', $this->slot()['payload_json']);
        self::assertCount(2, $this->receipts());
    }

    public function testAdmittedAccountRateLimitIncludesReplaysAndDoesNotExposeRawErrors(): void
    {
        $repo = $this->repository();
        for ($i = 0; $i < 60; ++$i) {
            self::assertSame($i === 0 ? 201 : 200, $repo->write('127.0.0.1', $this->headers(), self::body())->status);
        }
        try { $repo->write('127.0.0.1', $this->headers(), self::body()); self::fail('Expected rate rejection.'); }
        catch (RequestRejected $error) {
            self::assertSame(429, $error->status);
            self::assertGreaterThanOrEqual(1, $error->retryAfter);
        }
        self::assertCount(1, $this->receipts());
        self::assertSame(1, $this->slot()['revision']);
        $this->now += 60;
        self::assertSame(200, $repo->write('127.0.0.1', $this->headers(), self::body())->status);
        $this->rejected(fn () => $repo->write('untrusted.invalid', $this->headers(), self::body()), 400);
        $duplicate = $this->headers();
        $duplicate[] = ['IDEMPOTENCY-KEY', self::KEY];
        $this->rejected(fn () => $repo->write('127.0.0.1', $duplicate, self::body()), 400);
        $result = $repo->write('127.0.0.1', $this->replacement(), '{"private-note-value": true}');
        self::assertStringNotContainsString('private-note-value', json_encode($result));
        self::assertSame(422, $result->status);
    }

    public function testGuestAndDeletingAccountsCannotReplayAndObserverFailureIsNotASuccess(): void
    {
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $guest = $this->sessions->bootstrap(null);
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers([], $guest), self::body()), 401);
        $this->database->connection()->exec("UPDATE accounts SET status='deleting'");
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers(), self::body()), 401);
        $this->database->connection()->exec("UPDATE accounts SET status='active'");
        $before = [$this->slot(), $this->receipts()];
        $failing = $this->repository(function (string $phase): void {
            if ($phase === 'validated') { throw new RuntimeException('Synthetic observer failure.'); }
        });
        try { $failing->write('127.0.0.1', $this->replacement(), self::body()); self::fail('Expected observer exception.'); }
        catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException $error) { self::assertSame('Synthetic observer failure.', $error->getMessage()); }
        self::assertSame($before, [$this->slot(), $this->receipts()]);
    }

    public function testSummaryProjectionDoesNotExposeAdditionalStorageFields(): void
    {
        $repo = $this->repository();
        $first = $repo->write('127.0.0.1', $this->headers(), self::body());
        $summary = $first->currentSummary + ['private' => 'never-return-this'];
        $this->database->connection()->prepare('UPDATE saves SET summary_json=?')->execute([json_encode($summary)]);
        $replay = $repo->write('127.0.0.1', $this->headers(), self::body());
        self::assertSame($first->currentSummary, $replay->currentSummary);
        self::assertStringNotContainsString('never-return-this', json_encode($replay));
        $summary['roomId'] = ['invalid'];
        $this->database->connection()->prepare('UPDATE saves SET summary_json=?')->execute([json_encode($summary)]);
        $this->rejected(fn () => $repo->write('127.0.0.1', $this->headers(), self::body()), 503);
    }

    public static function independentlyUnsafeCandidates(): iterable
    {
        $fixtures = json_decode(file_get_contents(__DIR__ . '/Fixtures/save-cases.json'));
        foreach ($fixtures->cases as $case) {
            if (str_starts_with($case->id, 'SV-UNSAFE-')) { yield $case->id => [$case]; }
        }
    }

    #[DataProvider('independentlyUnsafeCandidates')]
    public function testIndependentUnsafeCasesPreserveRecoverableSlot(object $case): void
    {
        $repo = $this->repository();
        $repo->write('127.0.0.1', $this->headers(), self::body());
        $before = [$this->slot(), $this->receipts()];
        $value = json_decode(self::body());
        foreach ($case->requestChanges->bodyPatch as $patch) {
            $parts = explode('/', substr($patch->path, 1));
            $last = array_pop($parts);
            $parent = $value;
            foreach ($parts as $part) { $parent = $parent->{$part}; }
            $parent->{$last} = $patch->value;
        }
        $result = $repo->write('127.0.0.1', $this->replacement(), json_encode($value));
        self::assertSame($case->expected->status, $result->status);
        self::assertSame($before, [$this->slot(), $this->receipts()]);
        self::assertNull($result->acknowledgement);
    }

    public function testActualRecoveryBarrierReconcilesBeforeSaveAdmission(): void
    {
        $access = $this->actualAccess();
        self::assertSame(201, $this->repository(access: $access)->write('127.0.0.1', $this->headers(), self::body())->status);
        $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, str_repeat('e', 64), $this->now));
        $this->rejected(fn () => $this->repository(access: $access)->write('127.0.0.1', $this->headers(), self::body()), 401);
        self::assertSame([], $this->rows('accounts')); self::assertSame([], $this->rows('saves')); self::assertSame([], $this->rows('write_receipts'));
        self::assertSame('completed', $this->ledger->exclusive(fn () => $this->ledger->receipt(str_repeat('e', 64), $this->now))['state']);
    }

    public function testActualBarrierRechecksIntentBeforeInitialReceiptReplay(): void
    {
        $access = $this->actualAccess();
        self::assertSame(201, $this->repository(access: $access)->write('127.0.0.1', $this->headers(), self::body())->status);
        $repository = $this->repository(function (string $phase): void {
            if ($phase === 'admitted') {
                // Real second acquisition proves the observer is outside the external barrier.
                $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, str_repeat('f', 64), $this->now));
            }
        }, access: $access);
        $this->rejected(fn () => $repository->write('127.0.0.1', $this->headers(), self::body()), 401);
        self::assertSame([], $this->receipts()); self::assertSame([], $this->rows('saves'));
    }

    public function testActualBarrierRechecksIntentBeforeFinalProvisionalError(): void
    {
        $access = $this->actualAccess();
        $repository = $this->repository(function (string $phase): void {
            if ($phase === 'validated') { $this->ledger->exclusive(fn () => $this->ledger->accept(self::ACCOUNT, str_repeat('a', 64), $this->now)); }
        }, [], access: $access);
        $this->rejected(fn () => $repository->write('127.0.0.1', $this->headers(), self::body()), 401);
        self::assertSame([], $this->rows('accounts')); self::assertSame([], $this->receipts());
    }

    public function testActualHeldBarrierBlocksAdmissionWithoutTouchingSession(): void
    {
        $access = $this->actualAccess();
        $other = DeletionLedger::open($this->recoveryEnvironment->directory() . '/synthetic.sqlite', [realpath(__DIR__ . '/../..')],
            [$this->environment->directory()], new DeletionRetentionPolicy(2592000, 604800, 'synthetic-save-join'));
        $before = $this->rows('sessions'); $this->now++;
        $other->exclusive(function () use ($access): void {
            try { $this->repository(access: $access)->write('127.0.0.1', $this->headers(), self::body()); self::fail('Expected held barrier.'); }
            catch (\PHPUnit\Framework\AssertionFailedError $failure) { throw $failure; } catch (RuntimeException $error) { self::assertSame(503, Security::problem($error)['status']); }
        });
        self::assertSame($before, $this->rows('sessions')); self::assertSame([], $this->receipts());
        self::assertSame(201, $this->repository(access: $access)->write('127.0.0.1', $this->headers(), self::body())->status);
    }
}
