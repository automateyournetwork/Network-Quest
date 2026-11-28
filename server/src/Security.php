<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use Closure;
use InvalidArgumentException;
use LogicException;
use PDO;
use RuntimeException;
use Throwable;

/** Fixed public failures only; never embed request bytes, tokens or underlying exceptions. */
final class RequestRejected extends RuntimeException
{
    public readonly int $status;
    public readonly ?int $retryAfter;
    private const PROBLEMS = [
        'invalid-request' => [400, 'The request is malformed.'],
        'unauthorized' => [401, 'The session is missing or expired. Sign in before saving.'],
        'forbidden' => [403, 'The request could not be authorized.'],
        'body-too-large' => [413, 'The request exceeds the supported size.'],
        'rate-limited' => [429, 'Too many requests. Retry after the indicated delay.'],
        'unavailable' => [503, 'The service is temporarily unavailable.'],
    ];

    public function __construct(public readonly string $reason, ?int $retryAfter = null)
    {
        $problem = self::PROBLEMS[$reason] ?? null;
        if ($problem === null || ($retryAfter !== null && ($retryAfter < 1 || $retryAfter > 3600))) {
            throw new InvalidArgumentException('Unsupported public problem.');
        }
        $this->status = $problem[0];
        $this->retryAfter = in_array($this->status, [429, 503], true) ? ($retryAfter ?? 1) : null;
        parent::__construct($problem[1]);
    }

    public static function knownReason(string $reason): bool
    {
        return isset(self::PROBLEMS[$reason]);
    }
}

/** Request admission primitives. Trusted transport/route adapters compose these explicitly. */
final class Security
{
    private readonly Closure $clock;
    private const ROUTES = ['getSession', 'startAuth', 'authCallback', 'logout', 'getSave', 'putSave',
        'patchPreferences', 'deleteAccount', 'getDeletionStatus'];

    /** Key is operator-supplied private >=256-bit random bytes, stable across workers; no discovery. */
    public function __construct(
        private readonly Database $database,
        private readonly string $origin,
        private readonly string $rateKey,
        ?callable $clock = null,
    ) {
        if (!preg_match('~^https://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::([1-9][0-9]{0,4}))?$~D', $origin, $match)
            || (isset($match[1]) && (int) $match[1] > 65535) || strlen($origin) > 300 || strlen($rateKey) < 32) {
            throw new InvalidArgumentException('Supply an exact HTTPS origin and private rate key.');
        }
        $this->clock = Closure::fromCallable($clock ?? time(...));
    }

    /**
     * List of [name,value] pairs, retaining duplicate fields from the trusted HTTP adapter.
     * Bound before parsing. Reject ALL duplicate names case-insensitively; never first/last wins.
     * PHP/web servers may coalesce/discard duplicates before PHP: production proxy/SAPI must
     * enforce the same rule upstream. This function cannot recover already-discarded fields.
     */
    public static function headers(array $fields): array
    {
        if (!array_is_list($fields) || count($fields) > 64) {
            throw new RequestRejected('invalid-request');
        }
        $headers = [];
        $total = 0;
        foreach ($fields as $pair) {
            if (!is_array($pair) || !array_is_list($pair) || count($pair) !== 2
                || !is_string($pair[0]) || !is_string($pair[1]) || strlen($pair[0]) > 128 || strlen($pair[1]) > 8192) {
                throw new RequestRejected('invalid-request');
            }
            [$name, $value] = $pair;
            $total += strlen($name) + strlen($value) + 4;
            if ($total > 16384 || !preg_match('/^[!#$%&\x27*+.^_`|~0-9A-Za-z-]+$/D', $name)
                || preg_match('/[\x00-\x1f\x7f]/', $value)) {
                throw new RequestRejected('invalid-request');
            }
            $name = strtolower($name);
            if (array_key_exists($name, $headers)) {
                throw new RequestRejected('invalid-request');
            }
            $headers[$name] = $value;
        }
        return $headers;
    }

    /** All ordinary mutations, including guest auth-start, require exact Origin AND CSRF. */
    public function mutation(array $headers, Sessions $sessions, bool $accountRequired = true): SessionContext
    {
        $this->exactOrigin($headers);
        $csrf = $headers['x-csrf-token'] ?? '';
        $cookie = $headers['cookie'] ?? null;
        if (!is_string($csrf) || ($cookie !== null && !is_string($cookie))) {
            throw new RequestRejected('invalid-request');
        }
        return $sessions->require($cookie, $accountRequired, $csrf);
    }

    public function exactOrigin(array $headers): void
    {
        if (!is_string($headers['origin'] ?? null) || !hash_equals($this->origin, $headers['origin'])) {
            throw new RequestRejected('forbidden');
        }
    }

    /**
     * Receipt-only admission for read-only POST; deliberately no Sessions dependency, account
     * selection, deletion or completion claim. T046 looks up this hash in external receipts.
     * Route also forbids query/body account selectors and applies bounded polling responses.
     */
    public function deletionStatus(array $headers, string $peerAddress): string
    {
        $this->exactOrigin($headers);
        $token = $headers['x-deletion-receipt'] ?? null;
        if (!is_string($token) || !self::isToken($token)) {
            throw new RequestRejected('invalid-request');
        }
        $hash = hash('sha256', $token);
        $this->limit('deletion-status', null, $peerAddress, $hash);
        return $hash;
    }

    /** Canonical unpadded base64url of EXACTLY 32 bytes, including unused trailing bits. */
    public static function isToken(string $token): bool
    {
        if (strlen($token) !== 43 || !preg_match('/^[A-Za-z0-9_-]{43}$/D', $token)) {
            return false;
        }
        $bytes = base64_decode(strtr($token, '-_', '+/') . '=', true);
        return $bytes !== false && strlen($bytes) === 32
            && hash_equals(rtrim(strtr(base64_encode($bytes), '+/', '-_'), '='), $token);
    }

    public static function token(): string
    {
        return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
    }

    /**
     * Read at most limit+1 actual bytes; never trust Content-Length for allocation or read size.
     * Preserve exact bytes for save fingerprinting before current schema/UTF-8/content policy.
     * Transport must impose request/header/time/slow-client bounds before PHP buffering too.
     */
    public static function readBody(mixed $stream, array $headers, int $limit = 262144): string
    {
        if (!is_resource($stream) || get_resource_type($stream) !== 'stream' || $limit < 0 || $limit > 262144) {
            throw new InvalidArgumentException('Expected a bounded input stream.');
        }
        $length = $headers['content-length'] ?? null;
        $transfer = $headers['transfer-encoding'] ?? null;
        if (($length !== null && (!is_string($length) || !preg_match('/^(?:0|[1-9][0-9]*)$/D', $length)))
            || isset($headers['content-encoding']) || ($transfer !== null && ($transfer !== 'chunked' || $length !== null))) {
            throw new RequestRejected('invalid-request');
        }
        if ($length !== null && (strlen($length) > strlen((string) $limit)
            || (strlen($length) === strlen((string) $limit) && strcmp($length, (string) $limit) > 0))) {
            throw new RequestRejected('body-too-large');
        }
        $body = '';
        while (!feof($stream) && strlen($body) <= $limit) {
            $chunk = fread($stream, min(8192, $limit + 1 - strlen($body)));
            if ($chunk === false || ($chunk === '' && !feof($stream))) {
                throw new RequestRejected('unavailable');
            }
            $body .= $chunk;
        }
        if (strlen($body) > $limit) {
            throw new RequestRejected('body-too-large');
        }
        if ($length !== null && (int) $length !== strlen($body)) {
            throw new RequestRejected('invalid-request');
        }
        return $body;
    }

    /** Socket address only. Never use arbitrary X-Forwarded-For/Forwarded/X-Real-IP. */
    public static function peerAddress(array $server): string
    {
        $address = $server['REMOTE_ADDR'] ?? null;
        if (!is_string($address) || strlen($address) > 45 || filter_var($address, FILTER_VALIDATE_IP) === false) {
            throw new RequestRejected('invalid-request');
        }
        $packed = inet_pton($address);
        if (strlen($packed) === 16 && substr($packed, 0, 12) === str_repeat("\0", 10) . "\xff\xff") {
            $packed = substr($packed, 12);
        }
        return inet_ntop($packed);
    }

    /**
     * Delivery fixed-window policies. All dimensions admitted/incremented atomically; attempts
     * rejected by one dimension cannot partly consume another. Context is trusted admission
     * output, NOT sufficient final authorization. Call before work; Sessions::within still
     * precedes any final receipt/error/write. No provider work inside the short rate lock.
     * Guest GET bootstrap needs separate upstream abuse bounds before inserting a session;
     * no undocumented public bootstrap quota is invented here.
     */
    public function limit(string $operation, ?SessionContext $session, string $peerAddress, ?string $receiptHash = null): void
    {
        $source = self::peerAddress(['REMOTE_ADDR' => $peerAddress]);
        $dimensions = match ($operation) {
            'save', 'preferences' => [['account', $session?->accountId, 60, 60]],
            'deletion' => [['account', $session?->accountId, 3, 3600]],
            'auth-start' => [['session', $session?->idHash, 5, 600], ['source', $source, 30, 600]],
            'deletion-status' => [['receipt', $receiptHash, 30, 60], ['source', $source, 60, 60]],
            default => throw new InvalidArgumentException('Unsupported rate-limit operation.'),
        };
        foreach ($dimensions as [$kind, $identity]) {
            if ($identity === null || ($kind === 'receipt' && !preg_match('/^[a-f0-9]{64}$/D', $identity))) {
                throw new InvalidArgumentException('Rate-limit identity must come from validated admission.');
            }
        }
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402297199) {
            throw new LogicException('Rate clock is outside supported UTC bounds.');
        }
        $this->database->immediate(function (PDO $pdo) use ($dimensions, $operation, $now): void {
            $buckets = [];
            $retry = 0;
            foreach ($dimensions as [$kind, $identity, $limit, $window]) {
                $period = intdiv($now, $window) * $window;
                // Window-derived keys do not link source addresses across periods or operations.
                $key = hash_hmac('sha256', "NetworkQuest/rate/v1\0" . $operation . "\0" . $kind . "\0" . $period . "\0" . $identity, $this->rateKey);
                $query = $pdo->prepare('SELECT count FROM operational_counters WHERE bucket_key=? AND period=?');
                $query->execute([$key, $period]);
                $count = $query->fetchColumn();
                if ($count !== false && $count >= $limit) {
                    $retry = max($retry, $period + $window - $now);
                }
                $buckets[] = [$key, $period, $period + $window];
            }
            if ($retry > 0) {
                throw new RequestRejected('rate-limited', $retry);
            }
            // Bounded eager pruning complements T165 scheduled cleanup when there is no traffic.
            $pdo->prepare('DELETE FROM operational_counters WHERE rowid IN
                (SELECT rowid FROM operational_counters WHERE expires_at<=? ORDER BY expires_at LIMIT 128)')->execute([$now]);
            foreach ($buckets as [$key, $period, $expires]) {
                $pdo->prepare('INSERT INTO operational_counters(bucket_key,period,count,expires_at) VALUES(?,?,1,?)
                    ON CONFLICT(bucket_key,period) DO UPDATE SET count=count+1')->execute([$key, $period, $expires]);
            }
        });
    }

    /** All error responses are no-store; unexpected exceptions collapse to one fixed 503. */
    public static function problem(Throwable $error): array
    {
        $problem = $error instanceof RequestRejected ? $error : new RequestRejected('unavailable');
        $bytes = random_bytes(16);
        $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
        $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
        $hex = bin2hex($bytes);
        $requestId = substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
            . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
        $headers = ['Cache-Control' => 'no-store', 'Content-Type' => 'application/json; charset=utf-8',
            'X-Content-Type-Options' => 'nosniff', 'Referrer-Policy' => 'no-referrer', 'X-Frame-Options' => 'DENY',
            'Content-Security-Policy' => "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'",
            'X-Request-Id' => $requestId];
        if ($problem->retryAfter !== null) {
            $headers['Retry-After'] = (string) $problem->retryAfter;
        }
        return ['status' => $problem->status, 'headers' => $headers,
            'body' => json_encode(['code' => $problem->reason, 'message' => $problem->getMessage(), 'requestId' => $requestId], JSON_THROW_ON_ERROR)];
    }

    /** Allowlisted metadata for the private, time-bucketed operational log. */
    public static function logRecord(string $route, int $status, int $durationMs, string $requestId, string $reason): array
    {
        if (!in_array($route, self::ROUTES, true) || $status < 100 || $status > 599 || $durationMs < 0 || $durationMs > 600000
            || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $requestId)
            || (!in_array($reason, ['ok', 'request-rejected'], true) && !RequestRejected::knownReason($reason))) {
            throw new InvalidArgumentException('Only bounded allowlisted operational metadata may be logged.');
        }
        return compact('route', 'status', 'durationMs', 'requestId', 'reason');
    }
}
