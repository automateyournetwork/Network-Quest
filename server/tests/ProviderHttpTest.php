<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\Response;
use NetworkQuest\Identity\ProviderHttp;
use NetworkQuest\RequestRejected;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/Identity/ProviderHttp.php';

final class ProviderHttpTest extends TestCase
{
    private const URL = 'https://oauth2.googleapis.com/token';

    private function rejected(callable $operation): void
    {
        try { $operation(); } catch (RequestRejected $error) {
            self::assertSame(503, $error->status);
            self::assertNull($error->getPrevious());
            self::assertStringNotContainsString('synthetic-private', (string) $error);
            return;
        }
        self::fail('Expected provider transport rejection.');
    }

    public function testTransportForcesTlsTimeoutNoRedirectNoLoggingAndPrivateBoundedSink(): void
    {
        $calls = 0;
        $client = ProviderHttp::client('google', function ($request, $options) use (&$calls) {
            $calls++;
            self::assertSame(self::URL, (string) $request->getUri());
            self::assertTrue($options['verify']);
            self::assertSame(3.0, $options['connect_timeout']);
            self::assertSame(10.0, $options['timeout']);
            self::assertFalse($options['allow_redirects']);
            self::assertFalse($options['http_errors']);
            self::assertFalse($options['debug']);
            self::assertFalse($options['cookies']);
            self::assertFalse($options['decode_content']);
            self::assertSame('', $options['proxy']);
            self::assertSame(CURLPROTO_HTTPS, $options['curl'][CURLOPT_PROTOCOLS]);
            $response = new Response(200, ['Content-Type' => 'application/json'], '{"ok":true}');
            ($options['on_headers'])($response);
            $options['sink']->write('{"ok":true}');
            return Create::promiseFor($response);
        });
        $response = $client->post(self::URL, ['verify' => false, 'debug' => true, 'allow_redirects' => true,
            'proxy' => 'http://synthetic-private.invalid', 'timeout' => 0]);
        self::assertSame('{"ok":true}', (string) $response->getBody());
        self::assertSame(1, $calls);
    }

    public function testArbitraryUrlQueryFragmentMethodAndProviderCrossUseNeverReachHandler(): void
    {
        $calls = 0;
        $client = ProviderHttp::client('google', function () use (&$calls) { $calls++; throw new RuntimeException('must not run'); });
        foreach ([['POST', 'http://oauth2.googleapis.com/token'], ['POST', 'https://other.invalid/token'],
            ['POST', self::URL . '?secret=synthetic-private'], ['GET', self::URL], ['POST', 'https://github.com/login/oauth/access_token'],
            ['POST', self::URL . '#synthetic-private']] as [$method, $url]) {
            $this->rejected(fn () => $client->request($method, $url));
        }
        self::assertSame(0, $calls);
    }

    public function testHeaderLimitsEncodingAndRedirectsAreRejectedBeforeBody(): void
    {
        foreach ([new Response(302, ['Location' => 'https://other.invalid/synthetic-private']),
            new Response(200, ['Content-Length' => '65537']), new Response(200, ['Content-Length' => 'invalid']),
            new Response(200, ['Content-Encoding' => 'gzip']), new Response(200, ['X-Padding' => str_repeat('x', 16385)])] as $response) {
            $client = ProviderHttp::client('google', function ($request, $options) use ($response) {
                ($options['on_headers'])($response);
                self::fail('Body must not be read.');
            });
            $this->rejected(fn () => $client->post(self::URL));
        }
    }

    public function testSinkLimitsActualBytesEvenWithoutContentLengthAndDoesNotPartlyWriteOverflow(): void
    {
        $client = ProviderHttp::client('google', function ($request, $options) {
            $sink = $options['sink'];
            $sink->write(str_repeat('x', 65536));
            try { $sink->write('x'); } finally { self::assertSame(65536, $sink->getSize()); }
        });
        $this->rejected(fn () => $client->post(self::URL));
    }

    public function testResponseValidationAlsoBoundsSyntheticHandlerResponsesAndJsonDepth(): void
    {
        foreach ([str_repeat('x', 65537), 'not json synthetic-private', '[]', str_repeat('{"x":', 40) . 'null' . str_repeat('}', 40)] as $body) {
            $client = ProviderHttp::client('google', fn () => Create::promiseFor(new Response(200, ['Content-Type' => 'application/json'], $body)));
            $this->rejected(fn () => $client->post(self::URL));
        }
        $body = '{"x":"' . str_repeat('x', 65528) . '"}';
        self::assertSame(65536, strlen($body));
        $client = ProviderHttp::client('google', fn () => Create::promiseFor(new Response(200, [], $body)));
        self::assertSame(65536, $client->post(self::URL)->getBody()->getSize());
    }

    public function testProviderErrorsRemainAvailableToAdapterButTransportExceptionsAreRedacted(): void
    {
        $client = ProviderHttp::client('google', fn () => Create::promiseFor(new Response(400, [], '{"error":"invalid_grant"}')));
        self::assertSame(400, $client->post(self::URL)->getStatusCode());
        $client = ProviderHttp::client('google', fn () => Create::rejectionFor(new RuntimeException('synthetic-private-secret-body')));
        $this->rejected(fn () => $client->post(self::URL));
    }

    public function testUnsuccessfulHttpStatusCannotCarryAnAcceptedTokenOrKeySet(): void
    {
        foreach ([201, 204, 401, 403, 429, 500, 503] as $status) {
            $client = ProviderHttp::client('google', fn () => Create::promiseFor(new Response($status, [], '{"id_token":"synthetic-private"}')));
            $this->rejected(fn () => $client->post(self::URL));
        }
        $client = ProviderHttp::client('google', fn () => Create::promiseFor(new Response(400, [], '{"keys":[]}')));
        $this->rejected(fn () => $client->get('https://www.googleapis.com/oauth2/v3/certs'));
    }
}
