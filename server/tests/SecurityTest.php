<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Database;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Database.php';
require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Sessions.php';

final class SecurityTest extends TestCase
{
    private TestEnvironment $environment;
    private Database $database;
    private Security $security;
    private Sessions $sessions;
    private int $now = 1795737600;
    private const ORIGIN = 'https://game.example.test:8443';
    private const KEY = 'synthetic-rate-secret-32-bytes-long';
    private const ACCOUNT = '60000000-0000-4000-8000-000000000001';

    protected function setUp(): void
    {
        $this->environment = TestEnvironment::create();
        $this->environment->connect();
        $this->database = Database::open($this->environment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $this->database->migrate();
        $this->security = new Security($this->database, self::ORIGIN, self::KEY, fn (): int => $this->now);
        $this->sessions = new Sessions($this->database, fn (): int => $this->now);
    }

    protected function tearDown(): void
    {
        unset($this->sessions, $this->security, $this->database);
        $this->environment->close();
    }

    private function rejected(callable $operation, int $status): RequestRejected
    {
        try {
            $operation();
        } catch (RequestRejected $error) {
            self::assertSame($status, $error->status);
            return $error;
        }
        self::fail('Expected security rejection.');
    }

    private function guestHeaders(): array
    {
        $guest = $this->sessions->bootstrap(null);
        return [['Cookie', explode(';', $guest['setCookie'], 2)[0]], ['Origin', self::ORIGIN], ['X-CSRF-Token', $guest['csrfToken']]];
    }

    private function authenticated(): array
    {
        $pdo = $this->database->connection();
        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([self::ACCOUNT, $this->now]);
        $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([self::ACCOUNT, 'github', '123456']);
        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([self::ACCOUNT]);
        $guest = $this->sessions->bootstrap(null);
        return $this->database->immediate(fn (PDO $db): array => $this->sessions->rotateWithin($db, $guest['context'], self::ACCOUNT));
    }

    public function testHeadersRejectDuplicatesMalformedFieldsAndBoundsBeforeUse(): void
    {
        self::assertSame(['origin' => self::ORIGIN, 'x-csrf-token' => 'value'], Security::headers([['Origin', self::ORIGIN], ['X-CSRF-Token', 'value']]));
        $bad = [[['Origin', self::ORIGIN], ['origin', self::ORIGIN]], [['Cookie', 'a=1'], ['cookie', 'b=2']],
            [['Origin', self::ORIGIN . "\r\nX-Evil: 1"]], [['Bad Name', 'a']], [['X', str_repeat('a', 8193)]],
            array_fill(0, 65, ['X', 'a']), [['X', 'a', 'b']], ['Origin' => self::ORIGIN],
            [['Origin', [self::ORIGIN]]], [['X', "a\0b"]], [[' Origin', self::ORIGIN]],
            [['X-A', str_repeat('a', 8190)], ['X-B', str_repeat('a', 8190)], ['X-C', 'a']]];
        foreach ($bad as $headers) {
            $this->rejected(fn () => Security::headers($headers), 400);
        }
    }

    public function testMutationRequiresExactOriginAndSessionBoundCsrf(): void
    {
        $pairs = $this->guestHeaders();
        $headers = Security::headers($pairs);
        $context = $this->security->mutation($headers, $this->sessions, false);
        self::assertNull($context->accountId);
        foreach ([null, '', 'null', 'http://game.example.test:8443', 'https://game.example.test', self::ORIGIN . '/',
            self::ORIGIN . '.evil.invalid', strtoupper(self::ORIGIN), self::ORIGIN . ', https://other.invalid'] as $origin) {
            $attempt = $headers;
            $attempt['origin'] = $origin;
            $this->rejected(fn () => $this->security->mutation($attempt, $this->sessions, false), 403);
        }
        unset($headers['x-csrf-token']);
        $this->rejected(fn () => $this->security->mutation($headers, $this->sessions, false), 403);
        $headers['x-csrf-token'] = Security::headers($this->guestHeaders())['x-csrf-token'];
        $this->rejected(fn () => $this->security->mutation($headers, $this->sessions, false), 403);
    }

    public function testBoundedStreamUsesActualBytesAndDoesNotConsumeUnboundedInput(): void
    {
        foreach ([str_repeat('x', 262144), str_repeat('é', 131072)] as $body) {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, $body);
            rewind($stream);
            self::assertSame($body, Security::readBody($stream, ['content-length' => '262144']));
            fclose($stream);
        }
        foreach ([null, '1', '262145', '99999999999999999999999'] as $length) {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, str_repeat('x', 300000));
            rewind($stream);
            $this->rejected(fn () => Security::readBody($stream, $length === null ? [] : ['content-length' => $length]), 413);
            self::assertLessThanOrEqual(262145, ftell($stream));
            fclose($stream);
        }
        foreach ([['content-length' => '2, 2'], ['content-length' => '+2'], ['content-length' => '02'], ['content-encoding' => 'gzip']] as $headers) {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, '{}');
            rewind($stream);
            $this->rejected(fn () => Security::readBody($stream, $headers), 400);
            fclose($stream);
        }
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, '{}');
        rewind($stream);
        $this->rejected(fn () => Security::readBody($stream, ['content-length' => '3']), 400);
        fclose($stream);
    }

    public function testAmbiguousRequestFramingIsRejectedBeforeBodyRead(): void
    {
        foreach ([['content-length' => '2', 'transfer-encoding' => 'chunked'],
            ['transfer-encoding' => 'gzip, chunked'], ['transfer-encoding' => 'chunked, chunked']] as $headers) {
            $stream = fopen('php://temp', 'w+b');
            fwrite($stream, '{}');
            rewind($stream);
            $this->rejected(fn () => Security::readBody($stream, $headers), 400);
            self::assertSame(0, ftell($stream));
            fclose($stream);
        }
        // SAPI supplies decoded bytes; application never decodes HTTP chunks itself.
        $stream = fopen('php://temp', 'w+b');
        fwrite($stream, '{}');
        rewind($stream);
        self::assertSame('{}', Security::readBody($stream, ['transfer-encoding' => 'chunked']));
        fclose($stream);
    }

    public function testSocketPeerIgnoresForwardingAndCanonicalizesMappedIpv4(): void
    {
        self::assertSame('192.0.2.1', Security::peerAddress(['REMOTE_ADDR' => '192.0.2.1', 'HTTP_X_FORWARDED_FOR' => '203.0.113.2', 'HTTP_FORWARDED' => 'for=203.0.113.3']));
        self::assertSame('192.0.2.1', Security::peerAddress(['REMOTE_ADDR' => '::ffff:192.0.2.1']));
        self::assertSame('2001:db8::1', Security::peerAddress(['REMOTE_ADDR' => '2001:0db8:0:0:0:0:0:1']));
        foreach ([[], ['REMOTE_ADDR' => '192.0.2.1, 203.0.113.1'], ['REMOTE_ADDR' => 'localhost'], ['REMOTE_ADDR' => 'fe80::1%en0']] as $server) {
            $this->rejected(fn () => Security::peerAddress($server), 400);
        }
    }

    public function testAccountLimitsAndOperationIsolationUseDeliveryPolicies(): void
    {
        $auth = $this->authenticated();
        foreach (['save' => 60, 'preferences' => 60, 'deletion' => 3] as $operation => $limit) {
            for ($i = 0; $i < $limit; ++$i) {
                $this->security->limit($operation, $auth['context'], '192.0.2.1');
            }
            $error = $this->rejected(fn () => $this->security->limit($operation, $auth['context'], '192.0.2.9'), 429);
            self::assertGreaterThanOrEqual(1, $error->retryAfter);
            self::assertLessThanOrEqual($operation === 'deletion' ? 3600 : 60, $error->retryAfter);
        }
        self::assertSame(3, $this->database->connection()->query('SELECT count(*) FROM operational_counters')->fetchColumn());
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM saves')->fetchColumn());
    }

    public function testAuthStartLimitsBothSessionAndSourceAtomically(): void
    {
        $first = $this->sessions->bootstrap(null);
        for ($i = 0; $i < 5; ++$i) {
            $this->security->limit('auth-start', $first['context'], '192.0.2.1');
        }
        $this->rejected(fn () => $this->security->limit('auth-start', $first['context'], '192.0.2.2'), 429);
        for ($session = 0; $session < 5; ++$session) {
            $guest = $this->sessions->bootstrap(null);
            for ($i = 0; $i < 5; ++$i) {
                $this->security->limit('auth-start', $guest['context'], '192.0.2.1');
            }
        }
        $fresh = $this->sessions->bootstrap(null);
        $this->rejected(fn () => $this->security->limit('auth-start', $fresh['context'], '192.0.2.1'), 429);
        // Rejected two-dimensional attempts cannot partially consume a fresh dimension.
        for ($i = 0; $i < 5; ++$i) {
            $this->security->limit('auth-start', $fresh['context'], '192.0.2.2');
        }
        $this->rejected(fn () => $this->security->limit('auth-start', $fresh['context'], '192.0.2.2'), 429);
    }

    public function testReceiptStatusNeedsOnlyOriginCanonicalReceiptAndDistinctRateLimits(): void
    {
        $token = rtrim(strtr(base64_encode(str_repeat("\x01", 32)), '+/', '-_'), '=');
        $headers = Security::headers([['Origin', self::ORIGIN], ['X-Deletion-Receipt', $token]]);
        $hash = $this->security->deletionStatus($headers, '192.0.2.1');
        self::assertSame(hash('sha256', $token), $hash);
        for ($i = 1; $i < 30; ++$i) {
            $this->security->deletionStatus($headers, '192.0.2.1');
        }
        $this->rejected(fn () => $this->security->deletionStatus($headers, '192.0.2.2'), 429);
        $headers['x-deletion-receipt'] = rtrim(strtr(base64_encode(str_repeat("\x02", 32)), '+/', '-_'), '=');
        for ($i = 0; $i < 30; ++$i) {
            $this->security->deletionStatus($headers, '192.0.2.1');
        }
        $headers['x-deletion-receipt'] = str_repeat('A', 43);
        $this->rejected(fn () => $this->security->deletionStatus($headers, '192.0.2.1'), 429);
        foreach (['sessions', 'accounts', 'saves', 'identities'] as $table) {
            self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM ' . $table)->fetchColumn());
        }
        // This is admission only; there is deliberately no fabricated completion result.
    }

    public function testInvalidReceiptAndOriginCannotRevealOrCreateAnything(): void
    {
        foreach ([null, '', str_repeat('A', 42), str_repeat('B', 43), str_repeat('A', 43) . '=', str_repeat('A', 42) . '+'] as $token) {
            $this->rejected(fn () => $this->security->deletionStatus(['origin' => self::ORIGIN, 'x-deletion-receipt' => $token], '192.0.2.1'), 400);
        }
        $this->rejected(fn () => $this->security->deletionStatus(['origin' => 'null', 'x-deletion-receipt' => str_repeat('A', 43)], '192.0.2.1'), 403);
        self::assertSame(0, $this->database->connection()->query('SELECT count(*) FROM operational_counters')->fetchColumn());
    }

    public function testBucketsExpireAtWindowBoundaryAndStoreOnlyKeyedOpaqueValues(): void
    {
        $guest = $this->sessions->bootstrap(null);
        for ($i = 0; $i < 5; ++$i) {
            $this->security->limit('auth-start', $guest['context'], '192.0.2.123');
        }
        $before = $this->database->connection()->query('SELECT * FROM operational_counters')->fetchAll();
        foreach ($before as $row) {
            self::assertMatchesRegularExpression('/^[a-f0-9]{64}$/D', $row['bucket_key']);
            self::assertSame($row['period'] + 600, $row['expires_at']);
        }
        $json = json_encode($before);
        foreach (['192.0.2.123', self::KEY, $guest['context']->idHash, $guest['csrfToken'], 'auth-start'] as $secret) {
            self::assertStringNotContainsString($secret, $json);
        }
        $this->now = intdiv($this->now, 600) * 600 + 600;
        $this->security->limit('auth-start', $guest['context'], '192.0.2.123');
        $after = $this->database->connection()->query('SELECT * FROM operational_counters')->fetchAll();
        self::assertCount(2, $after);
        self::assertSame([], array_intersect(array_column($before, 'bucket_key'), array_column($after, 'bucket_key')));
        self::assertSame([1, 1], array_column($after, 'count'));
    }

    public function testIndependentInstancesShareRateCountsAndBusyNeverReturnsSuccess(): void
    {
        $guest = $this->sessions->bootstrap(null);
        $other = Database::open($this->environment->directory() . '/synthetic.sqlite',
            [realpath(__DIR__ . '/../..'), realpath(__DIR__ . '/../public')]);
        $security = new Security($other, self::ORIGIN, self::KEY, fn (): int => $this->now);
        for ($i = 0; $i < 5; ++$i) {
            ($i % 2 === 0 ? $security : $this->security)->limit('auth-start', $guest['context'], '192.0.2.1');
        }
        $this->rejected(fn () => $security->limit('auth-start', $guest['context'], '192.0.2.1'), 429);
        $this->database->immediate(function () use ($security, $guest): void {
            try {
                $security->limit('auth-start', $guest['context'], '192.0.2.2');
                self::fail('A competing writer must not be admitted without its atomic counter.');
            } catch (PDOException $error) {
                self::assertSame(5, $error->errorInfo[1]);
                $problem = Security::problem($error);
                self::assertSame(503, $problem['status']);
                self::assertSame('1', $problem['headers']['Retry-After']);
            }
        });
        unset($security, $other);
    }

    public function testSafeProblemsAndLogAllowlistExcludeAllRawInputs(): void
    {
        $secret = 'code=synthetic-secret; session=synthetic-secret; notes=private; ip=192.0.2.1';
        $response = Security::problem(new RuntimeException($secret));
        self::assertSame(503, $response['status']);
        self::assertSame('no-store', $response['headers']['Cache-Control']);
        self::assertStringNotContainsString($secret, json_encode($response));
        $body = json_decode($response['body'], true, 512, JSON_THROW_ON_ERROR);
        self::assertSame(['code', 'message', 'requestId'], array_keys($body));
        self::assertMatchesRegularExpression('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $body['requestId']);
        $log = Security::logRecord('authCallback', 503, 12, $body['requestId'], 'unavailable');
        self::assertSame(['route', 'status', 'durationMs', 'requestId', 'reason'], array_keys($log));
        self::assertSame('authCallback', $log['route']);
        self::assertStringNotContainsString($secret, json_encode($log));
        foreach ([[$secret, 'unavailable'], ['authCallback', $secret]] as [$route, $reason]) {
            try {
                Security::logRecord($route, 503, 12, $body['requestId'], $reason);
                self::fail('Raw request text was accepted as log metadata.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
        $rate = Security::problem(new RequestRejected('rate-limited', 29));
        self::assertSame(429, $rate['status']);
        self::assertSame('29', $rate['headers']['Retry-After']);
    }

    public function testInvalidConfigurationCannotWeakenOriginOrSourcePrivacy(): void
    {
        foreach (['http://game.example.test', 'https://game.example.test/', 'https://user@game.example.test', 'https://game.example.test?x', 'https://game.example.test#x'] as $origin) {
            try {
                new Security($this->database, $origin, self::KEY);
                self::fail('Expected explicit origin configuration failure.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
        $this->expectException(InvalidArgumentException::class);
        new Security($this->database, self::ORIGIN, 'short');
    }
}
