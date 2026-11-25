<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Router;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/Router.php';
require_once __DIR__ . '/Support/TestEnvironment.php';

final class ApiEntryTest extends TestCase
{
    public function testRealHttpsEntryDeniesStaticFilesAndDoesNotTrustInjectedIdentity(): void
    {
        $environment = TestEnvironment::create();
        try {
            $origin = $environment->startApi();
            $response = $environment->request('GET', Router::API_BASE . '/session?accountId=fixture-admin&test_auth=true', [
                'X-Test-Identity: fixture-admin', 'Authorization: Bearer synthetic-secret',
                'Cookie: __Secure-nq_session=synthetic-session',
            ]);
            self::assertSame(503, $response['status']);
            self::assertSame('service_not_implemented', json_decode($response['body'], true)['code']);
            self::assertArrayNotHasKey('set-cookie', $response['headers']);
            self::assertArrayNotHasKey('x-powered-by', $response['headers']);
            self::assertSame('no-store', $response['headers']['cache-control']);
            foreach (['/index.php', '/server/src/Router.php', '/server/config.example.php', '/.env', '/composer.lock', Router::API_BASE . '/test-auth'] as $path) {
                self::assertSame(404, $environment->request('GET', $path)['status'], $path);
            }
            self::assertSame(400, $environment->request('GET', Router::API_BASE . '/%2e%2e/session')['status']);
            $response = $environment->request('PUT', Router::API_BASE . '/save', [], '{"accountId":"fixture-admin","notes":"private-test-notes"}');
            self::assertSame(503, $response['status']);
            $callback = $environment->request('GET', Router::API_BASE . '/auth/google/callback?code=synthetic-callback-secret&state=private-test-state');
            self::assertSame(503, $callback['status']);
            self::assertStringNotContainsString('synthetic-callback-secret', $callback['body']);
            self::assertSame('', $environment->diagnostics());
            self::assertSame(404, $environment->directPhpRequest(Router::API_BASE . '/session')['status']);
            self::assertSame(403, $environment->request('GET', Router::API_BASE . '/session', ['Origin: https://foreign.invalid'])['status']);
            try {
                $environment->request('GET', Router::API_BASE . '/session', client: $environment->newClient(false));
                self::fail('An untrusted TLS certificate was accepted.');
            } catch (RuntimeException $error) {
                self::assertSame('TLS request failed (60).', $error->getMessage());
            }
            $wrongHost = $environment->newClient();
            curl_setopt_array($wrongHost, [CURLOPT_URL => str_replace('127.0.0.1', 'localhost', $origin) . Router::API_BASE . '/session',
                CURLOPT_RESOLVE => ['localhost:' . parse_url($origin, PHP_URL_PORT) . ':127.0.0.1']]);
            self::assertFalse(curl_exec($wrongHost));
            self::assertSame(60, curl_errno($wrongHost), 'A trusted certificate for a different host must still fail.');
        } finally {
            $environment->close();
        }
        self::assertDirectoryDoesNotExist($environment->directory());
        $listener = @stream_socket_client('tcp://127.0.0.1:' . parse_url($origin, PHP_URL_PORT), $errno, $error, 0.1);
        self::assertFalse($listener, 'Cleanup must close the HTTPS listener.');
    }

    public function testProductionTestConfigurationFailsClosedWithoutLoadingPrivatePhp(): void
    {
        $environment = TestEnvironment::create();
        try {
            $trap = $environment->writeFile('configuration.php', '<?php echo "MUST-NOT-EXECUTE"; throw new RuntimeException("secret");');
            $environment->startApi(['NQ_ENVIRONMENT' => 'production', 'NQ_TEST_AUTH' => '1', 'NQ_CONFIG_FILE' => $trap]);
            $response = $environment->request('GET', Router::API_BASE . '/session');
            self::assertSame(503, $response['status']);
            self::assertSame('configuration_unavailable', json_decode($response['body'], true)['code']);
            self::assertStringNotContainsString('MUST-NOT-EXECUTE', $response['body']);
            self::assertArrayNotHasKey('set-cookie', $response['headers']);
            self::assertSame('', $environment->diagnostics());
        } finally {
            $environment->close();
        }
    }

    public function testSyntheticSessionUsesTrustedTlsAndProductionCookieAttributes(): void
    {
        $environment = TestEnvironment::create();
        try {
            $environment->createSessionFixture('fixture-player');
            $environment->startFixtureServer();
            $client = $environment->newClient();
            $issued = $environment->request('POST', Router::GAME_BASE . '__fixture/issue', client: $client);
            self::assertSame(200, $issued['status']);
            $cookie = $issued['headers']['set-cookie'];
            foreach (['__Secure-nq_session=', 'path=' . Router::GAME_BASE, 'secure', 'HttpOnly', 'SameSite=Lax'] as $attribute) {
                self::assertStringContainsString($attribute, $cookie);
            }
            self::assertStringNotContainsString('domain=', strtolower($cookie));
            $read = $environment->request('GET', Router::GAME_BASE . '__fixture/session', client: $client);
            self::assertSame(['synthetic' => true, 'identity' => 'fixture-player'], json_decode($read['body'], true));
            $jar = curl_getinfo($client, CURLINFO_COOKIELIST);
            self::assertCount(1, $jar);
            $fields = explode("\t", $jar[0]);
            // libcurl normalizes its internal matching path by trimming the final slash.
            // The actual Set-Cookie path is checked exactly above.
            self::assertSame(['FALSE', rtrim(Router::GAME_BASE, '/'), 'TRUE'], array_slice($fields, 1, 3));
            self::assertSame(401, $environment->request('GET', Router::GAME_BASE . '__fixture/session')['status']);
            self::assertSame(404, $environment->request('GET', '/__fixture/session', client: $client)['status']);
            self::assertSame('', $environment->diagnostics());
        } finally {
            $environment->close();
        }
    }
}
