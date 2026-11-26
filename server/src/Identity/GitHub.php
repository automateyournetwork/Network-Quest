<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Identity;

use Closure;
use InvalidArgumentException;
use League\OAuth2\Client\Provider\Exception\IdentityProviderException;
use League\OAuth2\Client\Provider\GenericProvider;
use LogicException;
use NetworkQuest\RequestRejected;
use NetworkQuest\SessionContext;
use Throwable;

/** GitHub.com OAuth identity only. No accounts, session rotation, saves or token persistence. */
final class GitHub
{
    private readonly Closure $clock;
    private readonly ?Closure $httpHandler;

    /** Explicit private configuration only; no environment discovery, configurable scopes or request URLs. */
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
            || !preg_match('~^https://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::([1-9][0-9]{0,4}))?/(?:[A-Za-z0-9_-]+/)*auth/github/callback$~D', $callback, $match)
            || (isset($match[1]) && (int) $match[1] > 65535) || strlen($callback) > 1024) {
            throw new InvalidArgumentException('Supply private GitHub credentials and an exact canonical HTTPS GitHub callback.');
        }
        $this->clock = Closure::fromCallable($clock ?? time(...));
        $this->httpHandler = $httpHandler === null ? null : Closure::fromCallable($httpHandler);
    }

    /** Route first admits exact request/Origin/CSRF and auth-start rates. No arbitrary return URL. */
    public function start(SessionContext $session, string $purpose = 'login'): array
    {
        $start = $this->transactions->begin($session, 'github', $purpose);
        $provider = $this->provider();
        // AuthTransactions owns the stored verifier/challenge. GenericProvider's pkceMethod
        // option would generate a DIFFERENT verifier at URL creation; pass our S256 pair
        // explicitly instead, then setPkceCode(stored verifier) for its real token exchange.
        $options = ['state' => $start['state'], 'scope' => [], 'approval_prompt' => null,
            'code_challenge' => $start['codeChallenge'], 'code_challenge_method' => 'S256'];
        if ($purpose === 'delete-reauth') $options['prompt'] = 'select_account';
        return ['authorizationUrl' => $provider->getAuthorizationUrl($options), 'expiresAt' => $start['expiresAt']];
    }

    /**
     * Internal identity evidence only; null is validated cancellation. Consume before all IO.
     * T041 must recheck Sessions::within, resolve provider+subject and rotate atomically.
     * Delete reauth requires matching the expected EXISTING account, then purpose-bound
     * completion proof on the rotated session with a five-minute age limit. A selected
     * different account must fail. Neither login nor this result alone authorizes deletion.
     * GitHub's account picker confirms a new roundtrip, not fresh password entry/auth_time.
     */
    public function complete(SessionContext $session, #[\SensitiveParameter] string $state,
        #[\SensitiveParameter] ?string $code, #[\SensitiveParameter] ?string $error = null): ?array
    {
        if (($code === null) === ($error === null)
            || ($code !== null && ($code === '' || strlen($code) > 4096 || preg_match('/[\x00-\x20\x7f]/', $code)))
            || ($error !== null && ($error === '' || strlen($error) > 256 || !preg_match('/^[a-z_]+$/D', $error)))) {
            throw new RequestRejected('invalid-request');
        }
        $attempt = $this->transactions->consume($session, 'github', $state);
        if ($error !== null) {
            if ($error === 'access_denied') return null;
            throw new RequestRejected(in_array($error, ['server_error', 'temporarily_unavailable'], true) ? 'unavailable' : 'invalid-request');
        }
        $provider = $this->provider();
        $token = $values = $user = null;
        try {
            $provider->setPkceCode($attempt['verifier']);
            $token = $provider->getAccessToken('authorization_code', ['code' => $code]);
            $rawToken = $token->getToken();
            $values = $token->getValues();
            // GitHub documents both fields. Fail closed if it grants anything beyond the
            // explicit empty scope; never use an accidentally overprivileged token for /user.
            if (!is_string($rawToken) || strlen($rawToken) > 4096 || !preg_match('~^[A-Za-z0-9._+/-]+={0,2}$~D', $rawToken)
                || ($values['scope'] ?? null) !== '' || !is_string($values['token_type'] ?? null)
                || strcasecmp($values['token_type'], 'bearer') !== 0) {
                throw new RequestRejected('invalid-request');
            }
            // Always identify the freshly authenticated user; never infer it from token
            // metadata, login, email, request input or a public /users/{name} endpoint.
            $user = $provider->getResourceOwner($token)->toArray();
            $now = $this->now();
            if ($now < $attempt['createdAt'] || $now >= $attempt['expiresAt']
                || !is_int($user['id'] ?? null) || $user['id'] <= 0) {
                throw new RequestRejected('invalid-request');
            }
            // PHP's supported 64-bit runtime preserves JSON integer precision. Reject
            // float/overflow/string IDs rather than silently rounding or changing ownership.
            $name = $user['name'] ?? null;
            if (!is_string($name) || !mb_check_encoding($name, 'UTF-8') || mb_strlen($name, 'UTF-8') > 128
                || trim($name) === '' || preg_match('/[\x00-\x1f\x7f]/', $name)) $name = null;
            return ['provider' => 'github', 'subject' => (string) $user['id'], 'displayName' => $name,
                'purpose' => $attempt['purpose'], 'expectedAccountId' => $attempt['expectedAccountId'], 'confirmedAt' => $now];
        } catch (RequestRejected $failure) {
            throw $failure;
        } catch (IdentityProviderException $failure) {
            throw new RequestRejected(in_array($failure->getMessage(), ['bad_verification_code', 'invalid_grant'], true)
                ? 'invalid-request' : 'unavailable');
        } catch (Throwable) {
            throw new RequestRejected('invalid-request');
        } finally {
            // All tokens, refresh tokens and full profile data are temporary only. PHP does
            // not guarantee zeroization of copied strings; no object is kept on this adapter.
            unset($token, $rawToken, $values, $user, $attempt, $provider);
        }
    }

    private function provider(): GenericProvider
    {
        return new class (['clientId' => $this->clientId, 'clientSecret' => $this->clientSecret,
            'redirectUri' => $this->callback, 'scopes' => [], 'scopeSeparator' => ' ',
            'urlAuthorize' => 'https://github.com/login/oauth/authorize',
            'urlAccessToken' => 'https://github.com/login/oauth/access_token',
            'urlResourceOwnerDetails' => 'https://api.github.com/user'],
            ['httpClient' => ProviderHttp::client('github', $this->httpHandler)]) extends GenericProvider {
            protected function getDefaultHeaders()
            {
                // GitHub's token endpoint defaults to form encoding; explicitly request JSON.
                return ['Accept' => 'application/json', 'User-Agent' => 'Network-Quest/1',
                    'X-GitHub-Api-Version' => '2026-03-10'];
            }
        };
    }

    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402300799) throw new LogicException('Identity clock is outside supported UTC bounds.');
        return $now;
    }
}
