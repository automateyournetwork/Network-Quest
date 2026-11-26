<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Routes;

use Closure;
use InvalidArgumentException;
use LogicException;
use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\Identity\Google;
use NetworkQuest\Identity\GitHub;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\SessionContext;
use NetworkQuest\Sessions;
use PDO;
use Throwable;

/** Auth/session routes. Trusted transport supplies raw fields/body, never normalized superglobals. */
final class Auth
{
    private readonly Closure $clock;

    /** Mandatory trusted deletion barrier; no configuration/request can select a bypass. */
    public function __construct(
        private readonly Database $database,
        private readonly Sessions $sessions,
        private readonly Security $security,
        private readonly Google $google,
        private readonly GitHub $github,
        private readonly AccountAccess $accounts,
        private readonly string $origin,
        ?callable $clock = null,
    ) {
        if (!preg_match('~^https://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::([1-9][0-9]{0,4}))?$~D', $origin, $match)
            || (isset($match[1]) && (int) $match[1] > 65535) || strlen($origin) > 300) throw new InvalidArgumentException('Expected exact configured HTTPS origin.');
        $this->clock = Closure::fromCallable($clock ?? time(...));
    }

    /**
     * Called only after TLS/Host/path admission and upstream duplicate/slow-client/bootstrap
     * abuse controls. Raw fields MUST retain multiplicity. PHP $_GET/$_POST/$_COOKIE and a
     * SAPI's collapsed headers cannot prove this property; production adapter remains gated.
     * No network request or environment variable selects providers, identity, clock or barrier.
     */
    public function handle(string $method, string $route, string $rawQuery, array $rawHeaders, mixed $body, string $peerAddress): array
    {
        $callback = preg_match('~^/auth/(google|github)/callback$~D', $route, $parts) === 1;
        try {
            $headers = Security::headers($rawHeaders);
            $peer = Security::peerAddress(['REMOTE_ADDR' => $peerAddress]);
            if (strlen($rawQuery) > 8192 || preg_match('/[\x00-\x20\x7f#]/', $rawQuery)) throw new RequestRejected('invalid-request');
            if ($callback) {
                if ($method !== 'GET') throw new RequestRejected('invalid-request');
                if (Security::readBody($body, $headers, 0) !== '') throw new RequestRejected('invalid-request');
                $query = self::query($rawQuery, $parts[1]);
                return $this->complete($parts[1], $headers, $query);
            }
            if ($route === '/session' && $method === 'GET') {
                if ($rawQuery !== '' || Security::readBody($body, $headers, 0) !== '') throw new RequestRejected('invalid-request');
                // Cross-origin fetches cannot bootstrap/touch a cookie even when CORS hides output.
                if (isset($headers['origin'])) $this->security->exactOrigin($headers);
                return $this->session($headers);
            }
            if ($method !== 'POST' || !preg_match('~^/auth/(google|github)/start$~D', $route, $parts) || $rawQuery !== '') throw new RequestRejected('invalid-request');
            if (!preg_match('~^application/json(?:;\s*charset=utf-8)?$~iD', $headers['content-type'] ?? '')) throw new RequestRejected('invalid-request');
            $raw = Security::readBody($body, $headers, 1024);
            // Exactly one JSON member. Full string tokens preserve escaped values/keys while
            // denying duplicate purpose, aliases and hidden return/account selectors.
            $string = '"(?:[^"\\\\\x00-\x1f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
            if (!preg_match('~^\s*\{\s*' . $string . '\s*:\s*' . $string . '\s*\}\s*$~D', $raw)) throw new RequestRejected('invalid-request');
            try { $input = json_decode($raw, true, 4, JSON_THROW_ON_ERROR); }
            catch (\JsonException) { throw new RequestRejected('invalid-request'); }
            if (array_keys($input) !== ['purpose'] || !in_array($input['purpose'], ['login', 'delete-reauth'], true)) throw new RequestRejected('invalid-request');
            $session = $this->accounts->run(function () use ($headers, $peer): SessionContext {
                $session = $this->security->mutation($headers, $this->sessions, false);
                $this->security->limit('auth-start', $session, $peer);
                return $session;
            });
            $start = $this->provider($parts[1])->start($session, $input['purpose']);
            return self::json(['authorizationUrl' => $start['authorizationUrl'], 'expiresAt' => self::date($start['expiresAt'])]);
        } catch (Throwable $error) {
            if ($callback) return $this->page($error instanceof RequestRejected && $error->status < 500 ? 400 : 503, 'failed', null, $error);
            return self::problem($error);
        }
    }

    private function session(array $headers): array
    {
        return $this->accounts->run(function () use ($headers): array {
            $issued = $this->sessions->bootstrap($headers['cookie'] ?? null);
            $projection = $this->database->immediate(fn (PDO $pdo): array => $this->sessions->within($pdo, $issued['context'], function (SessionContext $current) use ($pdo, $issued): array {
                if ($current->accountId === null) return ['state' => 'guest', 'csrfToken' => $issued['csrfToken']];
                $query = $pdo->prepare('SELECT i.provider,i.display_name,p.* FROM identities i JOIN preferences p ON p.account_id=i.account_id WHERE i.account_id=?');
                $query->execute([$current->accountId]); $row = $query->fetch();
                if ($row === false) throw new RequestRejected('unavailable');
                $save = $pdo->prepare('SELECT revision,saved_at,schema_version,content_version,adventure_id,summary_json FROM saves WHERE account_id=?');
                $save->execute([$current->accountId]); $slot = $save->fetch();
                return ['state' => 'authenticated', 'csrfToken' => $issued['csrfToken'], 'provider' => $row['provider'],
                    'displayName' => $row['display_name'] ?? 'Network Quest player', 'expiresAt' => self::date($current->expiresAt),
                    'preferences' => ['revision' => $row['revision'], 'etag' => '"prefs-' . $row['revision'] . '"', 'values' => [
                        'autosaveEnabled' => (bool) $row['autosave_enabled'], 'musicVolume' => $row['music_volume'],
                        'effectsVolume' => $row['effects_volume'], 'voiceVolume' => $row['voice_volume'], 'captions' => (bool) $row['captions'],
                        'reducedMotion' => $row['reduced_motion'], 'textScale' => $row['text_scale']]],
                    'saveSummary' => $slot === false ? null : self::summary($slot)];
            }, false));
            $response = self::json($projection);
            if ($issued['setCookie'] !== null) $response['headers']['Set-Cookie'] = $issued['setCookie'];
            return $response;
        });
    }

    private function complete(string $provider, array $headers, array $query): array
    {
        try {
            $session = $this->accounts->run(fn (): SessionContext => $this->sessions->require($headers['cookie'] ?? null, false));
            // The adapter atomically consumes one-use state BEFORE provider I/O. Never wrap
            // complete in a SQLite transaction or external barrier: it calls the network.
            $identity = $this->provider($provider)->complete($session, $query['state'], $query['code'] ?? null, $query['error'] ?? null);
            if ($identity === null) return $this->page(200, 'canceled');
            $issued = $this->accounts->run(fn (): array => $this->database->immediate(fn (PDO $pdo): array =>
                $this->sessions->within($pdo, $session, function (SessionContext $current) use ($pdo, $identity): array {
                    $now = $this->now();
                    if ($identity['confirmedAt'] > $now || $now - $identity['confirmedAt'] > 300) throw new RequestRejected('invalid-request');
                    $query = $pdo->prepare('SELECT i.account_id,a.status FROM identities i JOIN accounts a ON a.id=i.account_id WHERE i.provider=? AND i.subject=?');
                    $query->execute([$identity['provider'], $identity['subject']]); $existing = $query->fetch();
                    if ($identity['purpose'] === 'delete-reauth') {
                        if ($current->accountId === null || $identity['expectedAccountId'] !== $current->accountId
                            || $existing === false || $existing['account_id'] !== $current->accountId || $existing['status'] !== 'active') throw new RequestRejected('invalid-request');
                        $account = $current->accountId;
                    } elseif ($existing !== false) {
                        if ($existing['status'] !== 'active') throw new RequestRejected('invalid-request');
                        $account = $existing['account_id'];
                    } else {
                        $account = self::uuid();
                        $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$account, $now]);
                        $pdo->prepare('INSERT INTO identities(account_id,provider,subject,display_name) VALUES(?,?,?,?)')
                            ->execute([$account, $identity['provider'], $identity['subject'], $identity['displayName']]);
                        $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$account]);
                    }
                    $pdo->prepare('UPDATE identities SET display_name=? WHERE account_id=?')->execute([$identity['displayName'], $account]);
                    $issued = $this->sessions->rotateWithin($pdo, $current, $account);
                    if ($identity['purpose'] === 'delete-reauth') {
                        $pdo->prepare('INSERT INTO delete_reauth_proofs(session_hash,account_id,confirmed_at,expires_at) VALUES(?,?,?,?)')
                            ->execute([$issued['context']->idHash, $account, $identity['confirmedAt'], $identity['confirmedAt'] + 300]);
                    }
                    return $issued;
                }, false)));
            return $this->page(200, 'completed', $issued['setCookie']);
        } catch (RequestRejected $error) {
            if ($error->status === 401 || $error->status === 403) throw new RequestRejected('invalid-request');
            throw $error;
        }
    }

    public function origin(): string { return $this->origin; }

    private function provider(string $provider): Google|GitHub { return $provider === 'google' ? $this->google : $this->github; }

    private static function query(string $raw, string $provider): array
    {
        $values = [];
        $pairs = explode('&', $raw);
        if (count($pairs) > 10) throw new RequestRejected('invalid-request');
        // Provider UI/error metadata is bounded and discarded, never identity or a redirect.
        $allowed = $provider === 'google' ? ['state','code','error','scope','authuser','prompt','hd','error_description','error_uri'] : ['state','code','error','error_description','error_uri'];
        foreach ($pairs as $pair) {
            if (!str_contains($pair, '=') || str_contains($pair, ';') || preg_match('/%(?![0-9a-fA-F]{2})/', $pair)) throw new RequestRejected('invalid-request');
            [$key, $value] = explode('=', $pair, 2); $key = urldecode($key); $value = urldecode($value);
            if (!in_array($key, $allowed, true) || array_key_exists($key, $values) || strlen($value) > 4096
                || !mb_check_encoding($value, 'UTF-8') || preg_match('/[\x00-\x1f\x7f]/', $value)) throw new RequestRejected('invalid-request');
            $values[$key] = $value;
        }
        if (!is_string($values['state'] ?? null) || !Security::isToken($values['state'])
            || (array_key_exists('code', $values) === array_key_exists('error', $values))) throw new RequestRejected('invalid-request');
        return array_intersect_key($values, array_flip(['state','code','error']));
    }

    private static function summary(array $slot): array
    {
        $summary = json_decode($slot['summary_json'], true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($summary) || !is_string($summary['episodeId'] ?? null) || mb_strlen($summary['episodeId']) > 32
            || !is_string($summary['roomId'] ?? null) || mb_strlen($summary['roomId']) > 64
            || !array_key_exists('outcome', $summary) || !in_array($summary['outcome'], [null,'E01','E02'], true)) throw new RequestRejected('unavailable');
        return ['revision' => $slot['revision'], 'etag' => '"save-' . $slot['revision'] . '"', 'savedAt' => self::date($slot['saved_at']),
            'adventureId' => $slot['adventure_id'], 'episodeId' => $summary['episodeId'], 'roomId' => $summary['roomId'],
            'outcome' => $summary['outcome'], 'saveSchemaVersion' => $slot['schema_version'], 'contentVersion' => $slot['content_version']];
    }

    private function page(int $status, string $result, ?string $cookie = null, ?Throwable $error = null): array
    {
        $response = self::problem($error ?? new RequestRejected('invalid-request'));
        $response['status'] = $status; $response['headers']['Content-Type'] = 'text/html; charset=utf-8';
        // Only a completion hint. The retained game tab must validate event origin/source
        // then GET /session; even a completed page is never an identity assertion to JS.
        $script = 'if(window.opener){window.opener.postMessage({type:"network-quest-auth-complete"},' . json_encode($this->origin, JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_THROW_ON_ERROR) . ');}';
        $response['headers']['Content-Security-Policy'] .= "; script-src 'sha256-" . base64_encode(hash('sha256', $script, true)) . "'";
        if ($cookie !== null) $response['headers']['Set-Cookie'] = $cookie;
        $title = match ($result) { 'completed' => 'Sign-in completed', 'canceled' => 'Sign-in canceled', default => 'Sign-in could not be completed' };
        $response['body'] = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
            . '<title>' . $title . ' — Network Quest</title></head><body><main><h1>' . $title . '</h1>'
            . '<p>Return to your game tab to check your account status. You can close this window.</p></main><script>' . $script . '</script></body></html>';
        return $response;
    }


    private static function problem(Throwable $error): array
    {
        $response = Security::problem($error);
        $response['headers']['X-Robots-Tag'] = 'noindex, nofollow';
        return $response;
    }

    private static function json(array $data): array
    {
        $response = self::problem(new RequestRejected('invalid-request'));
        $response['status'] = 200; $response['body'] = json_encode($data, JSON_THROW_ON_ERROR);
        return $response;
    }
    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402214399) throw new LogicException('Auth route clock is outside supported UTC bounds.');
        return $now;
    }
    private static function date(int $seconds): string { return gmdate('Y-m-d\TH:i:s\Z', $seconds); }
    private static function uuid(): string
    {
        $bytes = random_bytes(16); $bytes[6] = chr((ord($bytes[6]) & 15) | 64); $bytes[8] = chr((ord($bytes[8]) & 63) | 128);
        $hex = bin2hex($bytes); return substr($hex,0,8) . '-' . substr($hex,8,4) . '-' . substr($hex,12,4) . '-' . substr($hex,16,4) . '-' . substr($hex,20);
    }
}
