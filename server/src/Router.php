<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;
use NetworkQuest\Routes\Auth;
use NetworkQuest\Routes\Save;
use NetworkQuest\Routes\Preferences;
use NetworkQuest\Routes\Account;
use NetworkQuest\Routes\DeletionStatus;

/** Transport/routing boundary. Unconfigured deployments stay unavailable; handlers are trusted injection. */
final class Router
{
    public const GAME_BASE = '/arcade/play/network-quest/';
    public const API_BASE = '/arcade/play/network-quest/api/v1';

    private const ROUTES = [
        '/session' => ['GET'],
        '/auth/google/start' => ['POST'],
        '/auth/github/start' => ['POST'],
        '/auth/google/callback' => ['GET'],
        '/auth/github/callback' => ['GET'],
        '/logout' => ['POST'],
        '/save' => ['GET', 'PUT'],
        '/preferences' => ['PATCH'],
        '/account' => ['DELETE'],
        '/account/deletion-status' => ['POST'],
    ];

    private readonly string $apiBase;
    private readonly ?string $proxyToken;

    /** Narrow public routing options, NOT the future private service configuration. */
    public function __construct(array $options = [], private readonly ?Auth $auth = null, private readonly ?Save $save = null,
        private readonly ?Preferences $preferences = null, private readonly ?Account $account = null,
        private readonly ?DeletionStatus $deletionStatus = null)
    {
        if (array_diff(array_keys($options), ['environment', 'game_base', 'api_base', 'proxy_token']) !== []) {
            throw new InvalidArgumentException('Unsupported routing configuration.');
        }
        $environment = $options['environment'] ?? 'production';
        $gameBase = $options['game_base'] ?? self::GAME_BASE;
        $apiBase = $options['api_base'] ?? self::API_BASE;
        if (!in_array($environment, ['local', 'staging', 'production'], true)
            || !is_string($gameBase) || !preg_match('~^/(?:[a-zA-Z0-9_-]+/)+$~D', $gameBase)
            || $apiBase !== $gameBase . 'api/v1') {
            throw new InvalidArgumentException('Invalid routing configuration.');
        }
        $token = $options['proxy_token'] ?? null;
        if (array_key_exists('proxy_token', $options)
            && ($environment !== 'local' || !is_string($token) || !preg_match('/^[a-f0-9]{64}$/D', $token))) {
            throw new InvalidArgumentException('Invalid local proxy configuration.');
        }
        $this->apiBase = $apiBase;
        $this->proxyToken = $token;
    }

    public static function fromEnvironment(array $environment): self
    {
        foreach (array_keys($environment) as $name) {
            if (preg_match('/^NQ_(TEST|FIXTURE|HARNESS|SYNTHETIC|AUTH_BYPASS)(?:_|$)/', (string) $name)
                || $name === 'NQ_CONFIG_FILE') {
                // Even a false/empty toggle is forbidden. Do not read a supplied file.
                throw new InvalidArgumentException('Unsupported service configuration.');
            }
        }
        $options = [];
        foreach (['NQ_ENVIRONMENT' => 'environment', 'NQ_GAME_BASE' => 'game_base',
            'NQ_API_BASE' => 'api_base', 'NQ_DEV_PROXY_TOKEN' => 'proxy_token'] as $key => $option) {
            if (array_key_exists($key, $environment)) {
                $options[$option] = $environment[$key];
            }
        }
        return new self($options);
    }

    /** Incoming forwarding headers are trusted ONLY behind the explicit local token. */
    public function handleServer(array $server, ?array $rawHeaders = null, mixed $body = null): array
    {
        $method = is_string($server['REQUEST_METHOD'] ?? null) ? $server['REQUEST_METHOD'] : '';
        $target = is_string($server['REQUEST_URI'] ?? null) ? $server['REQUEST_URI'] : '';
        if ($this->proxyToken !== null) {
            if (($server['REMOTE_ADDR'] ?? '') !== '127.0.0.1'
                || !is_string($server['HTTP_X_NQ_DEV_PROXY'] ?? null)
                || !hash_equals($this->proxyToken, $server['HTTP_X_NQ_DEV_PROXY'])
                || ($server['HTTP_X_FORWARDED_PROTO'] ?? '') !== 'https') {
                return self::problem(404, 'not_found', 'No API route matches this request.', $method);
            }
            if ($target === '/__nq_dev_ready' && $method === 'GET') {
                return ['status' => 204, 'headers' => self::headers() + ['X-NQ-Dev-Ready' => $this->proxyToken], 'body' => ''];
            }
        } elseif (!in_array($server['HTTPS'] ?? '', ['on', '1'], true)) {
            return self::problem(400, 'https_required', 'The game API requires HTTPS.', $method);
        }
        if ($this->auth !== null) {
            if ($rawHeaders === null || !is_resource($body)) return self::unavailableConfiguration($method);
            try {
                $headers = Security::headers($rawHeaders);
                $expectedHost = substr($this->auth->origin(), strlen('https://'));
                if (($headers['host'] ?? null) !== $expectedHost || ($server['HTTP_HOST'] ?? null) !== $expectedHost) {
                    return Security::problem(new RequestRejected('invalid-request'));
                }
                $peer = Security::peerAddress($server);
            } catch (\Throwable $error) { return Security::problem($error); }
        }
        return $this->dispatch($method, $target, $rawHeaders, $body, $peer ?? null);
    }

    public function dispatch(string $method, string $target, ?array $rawHeaders = null, mixed $body = null, ?string $peerAddress = null): array
    {
        $path = explode('?', $target, 2)[0];
        if (!preg_match('/^[A-Z]{1,16}$/D', $method) || strlen($target) > 8192
            || preg_match('/[\x00-\x20\x7f#\\\\]/', $target)
            || !str_starts_with($path, '/') || str_contains($path, '//')
            || str_contains($path, '%') || preg_match('~(?:^|/)\.{1,2}(?:/|$)~', $path)) {
            return self::problem(400, 'invalid_request_target', 'The API request target is invalid.', $method);
        }
        $route = str_starts_with($path, $this->apiBase . '/') ? substr($path, strlen($this->apiBase)) : '';
        $allowed = self::ROUTES[$route] ?? null;
        if ($allowed === null) {
            return self::problem(404, 'not_found', 'No API route matches this request.', $method);
        }
        if (!in_array($method, $allowed, true)) {
            $response = self::problem(405, 'method_not_allowed', 'This method is not available for the API route.', $method);
            $response['headers']['Allow'] = implode(', ', $allowed);
            return $response;
        }
        if ($this->auth !== null && ($route === '/session' || str_starts_with($route, '/auth/'))) {
            if ($rawHeaders === null || !is_resource($body) || $peerAddress === null) return self::unavailableConfiguration($method);
            return $this->auth->handle($method, $route, explode('?', $target, 2)[1] ?? '', $rawHeaders, $body, $peerAddress);
        }
        $handler = match ($route) {
            '/save' => $this->save,
            '/preferences' => $this->preferences,
            '/logout', '/account' => $this->account,
            '/account/deletion-status' => $this->deletionStatus,
            default => null,
        };
        if ($handler !== null) {
            if ($rawHeaders === null || !is_resource($body) || $peerAddress === null) return self::unavailableConfiguration($method);
            return $handler->handle($method, $route, explode('?', $target, 2)[1] ?? '', $rawHeaders, $body, $peerAddress);
        }
        if (str_ends_with($route, '/callback')) {
            return ['status' => 503, 'headers' => self::headers() + ['Content-Type' => 'text/html; charset=utf-8'],
                'body' => '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width">'
                    . '<title>Sign-in unavailable — Network Quest</title><main><h1>Sign-in is not available</h1>'
                    . '<p>The account service has not been implemented. No sign-in was completed.</p>'
                    . '<p>You can close this window and return to the game.</p></main></html>'];
        }
        return self::problem(503, 'service_not_implemented', 'This game service has not been implemented.', $method);
    }

    /** Safe fixed messages only; never accept exception, request, callback or body text here. */
    public static function unavailableConfiguration(string $method, string $target = ''): array
    {
        $response = self::problem(503, 'configuration_unavailable', 'The game API configuration is unavailable.', $method);
        if ($method === 'GET' && preg_match('~/auth/(google|github)/callback$~D', explode('?', $target, 2)[0])) {
            $response['headers']['Content-Type'] = 'text/html; charset=utf-8';
            $response['body'] = '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in unavailable — Network Quest</title><main><h1>Sign-in could not be completed</h1><p>Return to your game tab to check your account status.</p></main></html>';
        }
        return $response;
    }

    private static function headers(): array
    {
        return ['Cache-Control' => 'no-store', 'X-Content-Type-Options' => 'nosniff',
            'Referrer-Policy' => 'no-referrer', 'X-Frame-Options' => 'DENY',
            'X-Robots-Tag' => 'noindex, nofollow',
            'Content-Security-Policy' => "default-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"];
    }

    private static function problem(int $status, string $code, string $message, string $method): array
    {
        $id = random_bytes(16);
        $id[6] = chr((ord($id[6]) & 0x0f) | 0x40);
        $id[8] = chr((ord($id[8]) & 0x3f) | 0x80);
        $hex = bin2hex($id);
        $requestId = substr($hex, 0, 8) . '-' . substr($hex, 8, 4) . '-' . substr($hex, 12, 4)
            . '-' . substr($hex, 16, 4) . '-' . substr($hex, 20);
        return ['status' => $status, 'headers' => self::headers() + [
            'Content-Type' => 'application/json; charset=utf-8', 'X-Request-Id' => $requestId],
            'body' => $method === 'HEAD' ? '' : json_encode(compact('code', 'message', 'requestId'), JSON_THROW_ON_ERROR)];
    }
}
