<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Router;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/Router.php';

final class RouterTest extends TestCase
{
    public static function operations(): iterable
    {
        yield ['GET', '/session'];
        yield ['POST', '/auth/google/start'];
        yield ['POST', '/auth/github/start'];
        yield ['GET', '/auth/google/callback'];
        yield ['GET', '/auth/github/callback'];
        yield ['POST', '/logout'];
        yield ['GET', '/save'];
        yield ['PUT', '/save'];
        yield ['PATCH', '/preferences'];
        yield ['DELETE', '/account'];
        yield ['POST', '/account/deletion-status'];
    }

    #[DataProvider('operations')]
    public function testContractedOperationsRemainUnavailable(string $method, string $path): void
    {
        $response = (new Router())->dispatch($method, Router::API_BASE . $path . '?code=secret-code&state=secret-state');
        self::assertSame(503, $response['status']);
        self::assertSame('no-store', $response['headers']['Cache-Control']);
        self::assertSame('nosniff', $response['headers']['X-Content-Type-Options']);
        self::assertSame('no-referrer', $response['headers']['Referrer-Policy']);
        self::assertStringContainsString("default-src 'none'", $response['headers']['Content-Security-Policy']);
        self::assertArrayNotHasKey('Set-Cookie', $response['headers']);
        self::assertArrayNotHasKey('Location', $response['headers']);
        self::assertStringNotContainsString('secret-', $response['body']);
        if (str_ends_with($path, '/callback')) {
            self::assertSame('text/html; charset=utf-8', $response['headers']['Content-Type']);
            self::assertStringContainsString('<html lang="en">', $response['body']);
            self::assertStringContainsString('Sign-in is not available', $response['body']);
        } else {
            $problem = json_decode($response['body'], true, flags: JSON_THROW_ON_ERROR);
            self::assertSame(['code', 'message', 'requestId'], array_keys($problem));
            self::assertSame('service_not_implemented', $problem['code']);
            self::assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $problem['requestId']);
        }
    }

    public static function unknownPaths(): iterable
    {
        foreach (['/session', '/api/v1/session', Router::API_BASE, Router::API_BASE . '/',
            Router::API_BASE . '/session/', Router::API_BASE . '/session/extra',
            Router::API_BASE . '/Session', Router::API_BASE . '/auth/other/start',
            Router::API_BASE . '/test-auth', Router::API_BASE . '/fixtures/session',
            Router::API_BASE . 'extra/session', '/server/config.example.php',
            '/server/vendor/autoload.php', '/.env', '/index.php', '/composer.json'] as $path) {
            yield $path => [$path];
        }
    }

    #[DataProvider('unknownPaths')]
    public function testOnlyExactApiPathsAreRouted(string $path): void
    {
        $response = (new Router())->dispatch('GET', $path);
        self::assertSame(404, $response['status']);
        self::assertSame('not_found', json_decode($response['body'], true)['code']);
    }

    public static function malformedTargets(): iterable
    {
        foreach (['//arcade/play/network-quest/api/v1/session', '/a/../server/config.php',
            '/a/./session', '/a\\session', '/%2e%2e/server', '/%252e%252e/server', '/%zz',
            Router::API_BASE . '/%73ession', Router::API_BASE . '/session#fragment',
            Router::API_BASE . "/session\r\nInjected: value", 'https://example.test/session', ''] as $path) {
            yield [$path];
        }
    }

    #[DataProvider('malformedTargets')]
    public function testAmbiguousTargetsFailWithoutDecoding(string $path): void
    {
        self::assertSame(400, (new Router())->dispatch('GET', $path)['status']);
    }

    public function testMethodsAreExplicitAndHeadHasNoBody(): void
    {
        $router = new Router();
        foreach (['POST', 'DELETE', 'OPTIONS', 'TRACE', 'HEAD'] as $method) {
            $response = $router->dispatch($method, Router::API_BASE . '/save');
            self::assertSame(405, $response['status']);
            self::assertSame('GET, PUT', $response['headers']['Allow']);
            if ($method === 'HEAD') {
                self::assertSame('', $response['body']);
            }
        }
        self::assertSame(400, $router->dispatch("GET\r\n", Router::API_BASE . '/session')['status']);
    }

    public function testIndependentDeploymentPrefixMustStayConsistent(): void
    {
        $router = new Router(['game_base' => '/games/nq/', 'api_base' => '/games/nq/api/v1']);
        self::assertSame(503, $router->dispatch('GET', '/games/nq/api/v1/session')['status']);
        self::assertSame(404, $router->dispatch('GET', Router::API_BASE . '/session')['status']);
        $this->expectException(InvalidArgumentException::class);
        new Router(['game_base' => '/games/nq/', 'api_base' => '/api/v1']);
    }

    public static function forbiddenConfiguration(): iterable
    {
        yield [['environment' => 'production', 'test_auth' => false]];
        yield [['environment' => 'production', 'fixtures' => []]];
        yield [['environment' => 'local', 'test_identity' => 'fixture-user']];
        yield [['environment' => 'test']];
        yield [['environment' => 'production', 'proxy_token' => str_repeat('a', 64)]];
        yield [['game_base' => '/../', 'api_base' => '/../api/v1']];
        yield [['game_base' => '/a//', 'api_base' => '/a//api/v1']];
    }

    #[DataProvider('forbiddenConfiguration')]
    public function testTestAuthAndAmbiguousConfigurationAreRejected(array $configuration): void
    {
        $this->expectException(InvalidArgumentException::class);
        new Router($configuration);
    }

    public function testProxyCannotEnableProductionOrClaimTlsWithoutItsToken(): void
    {
        $token = str_repeat('a', 64);
        $server = ['REQUEST_METHOD' => 'GET', 'REQUEST_URI' => Router::API_BASE . '/session',
            'REMOTE_ADDR' => '127.0.0.1', 'HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_X_NQ_DEV_PROXY' => $token];
        self::assertSame(400, (new Router())->handleServer($server)['status']);
        $router = new Router(['environment' => 'local', 'proxy_token' => $token]);
        self::assertSame(503, $router->handleServer($server)['status']);
        $server['HTTP_X_NQ_DEV_PROXY'] = str_repeat('b', 64);
        self::assertSame(404, $router->handleServer($server)['status']);
        $server['HTTPS'] = 'on';
        self::assertSame(404, $router->handleServer($server)['status']);
        $server['HTTP_X_NQ_DEV_PROXY'] = $token;
        $server['REMOTE_ADDR'] = '192.0.2.1';
        self::assertSame(404, $router->handleServer($server)['status']);
    }

    public function testProductionRejectsEvenDisabledTestEnvironmentFlags(): void
    {
        foreach (['NQ_TEST_AUTH', 'NQ_TEST_IDENTITY', 'NQ_FIXTURE_FILE', 'NQ_HARNESS_DIRECTORY',
            'NQ_SYNTHETIC_SESSION', 'NQ_AUTH_BYPASS', 'NQ_CONFIG_FILE'] as $name) {
            try {
                Router::fromEnvironment(['NQ_ENVIRONMENT' => 'production', $name => '']);
                self::fail('Production accepted a test/configuration input.');
            } catch (InvalidArgumentException) {
                self::assertTrue(true);
            }
        }
        $router = Router::fromEnvironment(['NQ_ENVIRONMENT' => 'production']);
        self::assertSame(503, $router->handleServer(['HTTPS' => 'on', 'REQUEST_METHOD' => 'GET',
            'REQUEST_URI' => Router::API_BASE . '/session'])['status']);
    }
}
