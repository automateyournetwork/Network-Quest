<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Identity;

use Closure;
use Firebase\JWT\JWT;
use Google\Client;
use InvalidArgumentException;
use LogicException;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\SessionContext;
use Psr\Log\NullLogger;
use Throwable;

/** Google server authorization-code identity only. Does not create accounts, sessions or saves. */
final class Google
{
    private readonly Closure $clock;
    private readonly ?Closure $httpHandler;

    /** Explicit private configuration only; never discover environment credentials or accept request redirects. */
    public function __construct(
        private readonly AuthTransactions $transactions,
        private readonly string $clientId,
        #[\SensitiveParameter] private readonly string $clientSecret,
        private readonly string $callback,
        ?callable $clock = null,
        ?callable $httpHandler = null,
    ) {
        if (!preg_match('/^[A-Za-z0-9._-]{1,255}$/D', $clientId) || $clientSecret === '' || strlen($clientSecret) > 4096
            || preg_match('/[\x00-\x20\x7f]/', $clientSecret)
            || !preg_match('~^https://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::([1-9][0-9]{0,4}))?/(?:[A-Za-z0-9_-]+/)*auth/google/callback$~D', $callback, $match)
            || (isset($match[1]) && (int) $match[1] > 65535) || strlen($callback) > 1024) {
            throw new InvalidArgumentException('Supply private Google credentials and an exact canonical HTTPS Google callback.');
        }
        $this->clock = Closure::fromCallable($clock ?? time(...));
        $this->httpHandler = $httpHandler === null ? null : Closure::fromCallable($httpHandler);
    }

    /** Route must first validate exact body, Origin/CSRF and auth-start rates. No arbitrary return URL port. */
    public function start(SessionContext $session, string $purpose = 'login'): array
    {
        $start = $this->transactions->begin($session, 'google', $purpose);
        $client = $this->client();
        $client->setState($start['state']);
        // An explicit account choice is not proof of freshly entered provider credentials.
        if ($purpose === 'delete-reauth') $client->setPrompt('select_account');
        return ['authorizationUrl' => $client->createAuthUrl(null, ['nonce' => $start['nonce'],
            'code_challenge' => $start['codeChallenge'], 'code_challenge_method' => 'S256']), 'expiresAt' => $start['expiresAt']];
    }

    /**
     * Internal identity evidence ONLY. Null means validated cancellation; no account change.
     * Consume state before provider IO. Failures remain consumed and require a new start.
     * T041 must finally recheck Sessions::within, resolve provider+subject and rotate atomically.
     * For delete-reauth it must match expected EXISTING identity, preserve a purpose-bound proof
     * across rotation and enforce the five-minute completion age. Login/authTime never substitutes.
     * This confirms a new provider roundtrip, NOT a newly typed password or Google auth_time.
     */
    public function complete(SessionContext $session, #[\SensitiveParameter] string $state,
        #[\SensitiveParameter] ?string $code, #[\SensitiveParameter] ?string $error = null): ?array
    {
        if (($code === null) === ($error === null)
            || ($code !== null && ($code === '' || strlen($code) > 4096 || preg_match('/[\x00-\x20\x7f]/', $code)))
            || ($error !== null && ($error === '' || strlen($error) > 256 || !preg_match('/^[a-z_]+$/D', $error)))) {
            throw new RequestRejected('invalid-request');
        }
        $attempt = $this->transactions->consume($session, 'google', $state);
        if ($error !== null) {
            if ($error === 'access_denied') return null;
            throw new RequestRejected(in_array($error, ['server_error', 'temporarily_unavailable'], true) ? 'unavailable' : 'invalid-request');
        }
        $client = $this->client();
        $tokens = $claims = null;
        try {
            $tokens = $client->fetchAccessTokenWithAuthCode($code, $attempt['verifier']);
            if (isset($tokens['error'])) {
                throw new RequestRejected($tokens['error'] === 'invalid_grant' ? 'invalid-request' : 'unavailable');
            }
            $idToken = $tokens['id_token'] ?? null;
            if (!is_string($idToken) || strlen($idToken) > 16384) throw new RequestRejected('invalid-request');
            self::header($idToken);
            // The actual pinned SDK fetches Google's fixed JWK endpoint and verifies the RSA
            // signature via Firebase JWT. Never substitute decoded caller-supplied claims.
            $claims = $client->verifyIdToken($idToken);
            $now = $this->now();
            if ($now < $attempt['createdAt'] || $now >= $attempt['expiresAt']) throw new RequestRejected('invalid-request');
            if (!is_array($claims) || !is_string($claims['iss'] ?? null)
                || !in_array($claims['iss'], ['https://accounts.google.com', 'accounts.google.com'], true)
                || !is_string($claims['aud'] ?? null) || !hash_equals($this->clientId, $claims['aud'])
                || !is_string($claims['sub'] ?? null) || !preg_match('/^[\x21-\x7e]{1,255}$/D', $claims['sub'])
                || !is_int($claims['exp'] ?? null) || $claims['exp'] <= $now || $claims['exp'] > 253402300799
                || !is_int($claims['iat'] ?? null) || $claims['iat'] < 0 || $claims['iat'] > $now || $claims['iat'] >= $claims['exp']
                || !is_string($claims['nonce'] ?? null) || !Security::isToken($claims['nonce'])
                || !hash_equals($attempt['nonceHash'], hash('sha256', $claims['nonce']))
                || (array_key_exists('azp', $claims) && (!is_string($claims['azp']) || !hash_equals($this->clientId, $claims['azp'])))
                || (array_key_exists('nbf', $claims) && (!is_int($claims['nbf']) || $claims['nbf'] < 0 || $claims['nbf'] > $now))) {
                throw new RequestRejected('invalid-request');
            }
            $name = $claims['name'] ?? null;
            // Optional presentation text only, never an identity key. Render as text in T041/client.
            if (!is_string($name) || !mb_check_encoding($name, 'UTF-8') || mb_strlen($name, 'UTF-8') > 128
                || trim($name) === '' || preg_match('/[\x00-\x1f\x7f]/', $name)) $name = null;
            return ['provider' => 'google', 'subject' => $claims['sub'], 'displayName' => $name,
                'purpose' => $attempt['purpose'], 'expectedAccountId' => $attempt['expectedAccountId'], 'confirmedAt' => $now];
        } catch (RequestRejected $failure) {
            throw $failure;
        } catch (Throwable) {
            throw new RequestRejected('invalid-request');
        } finally {
            // No tokens/SDK object retained on this adapter, in DB, responses or logs. PHP offers
            // no guaranteed zeroization of all copied strings; this is lifetime minimization.
            unset($tokens, $claims, $idToken, $attempt, $client);
        }
    }

    private function client(): Client
    {
        $client = new Client(['client_id' => $this->clientId, 'client_secret' => $this->clientSecret,
            'redirect_uri' => $this->callback, 'scopes' => ['openid', 'profile'], 'access_type' => 'online',
            'include_granted_scopes' => false, 'approval_prompt' => '', 'universe_domain' => 'googleapis.com',
            'use_application_default_credentials' => false, 'logger' => new NullLogger(),
            // Avoid Verify's implicit mutation of Firebase's global leeway. Explicit checks above
            // enforce zero-skew exp/iat boundaries even if other code changed library globals.
            'jwt' => new JWT()]);
        $client->setHttpClient(ProviderHttp::client('google', $this->httpHandler));
        return $client;
    }

    /** Untrusted header restriction only; it does not establish signature or claims validity. */
    private static function header(#[\SensitiveParameter] string $token): void
    {
        if (!preg_match('/^([A-Za-z0-9_-]{1,2048})\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/D', $token, $parts)) throw new RequestRejected('invalid-request');
        $header = json_decode(JWT::urlsafeB64Decode($parts[1]), true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($header) || ($header['alg'] ?? null) !== 'RS256' || !is_string($header['kid'] ?? null)
            || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $header['kid']) || isset($header['crit']) || isset($header['jku'])
            || isset($header['x5u']) || isset($header['b64']) || (isset($header['typ']) && $header['typ'] !== 'JWT')) {
            throw new RequestRejected('invalid-request');
        }
    }

    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402300799) throw new LogicException('Identity clock is outside supported UTC bounds.');
        return $now;
    }
}
