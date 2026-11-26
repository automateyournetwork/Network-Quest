<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Identity;

use GuzzleHttp\Client;
use GuzzleHttp\Handler\CurlHandler;
use GuzzleHttp\Promise\Create;
use GuzzleHttp\Psr7\FnStream;
use GuzzleHttp\Psr7\Utils;
use InvalidArgumentException;
use NetworkQuest\RequestRejected;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;
use Throwable;

/** Bounded identity-only HTTP. Fixed endpoints, no ambient proxy/cookies/logger/redirects/retries. */
final class ProviderHttp
{
    private const LIMIT = 65536;

    /**
     * The optional low-level handler is a trusted PHP test seam, never configuration/request data.
     * Tests supply it explicitly and intercept every call. Production omits it for real TLS cURL.
     * Library/client options cannot override the fixed transport restrictions below.
     */
    public static function client(string $provider, ?callable $handler = null): Client
    {
        $endpoints = match ($provider) {
            'google' => ['POST https://oauth2.googleapis.com/token', 'GET https://www.googleapis.com/oauth2/v3/certs'],
            'github' => ['POST https://github.com/login/oauth/access_token', 'GET https://api.github.com/user'],
            default => throw new InvalidArgumentException('Unsupported identity provider.'),
        };
        $transport = $handler ?? new CurlHandler(['max_idle_handles' => 0]);
        // No default middleware stack: in particular no redirect, retry, cookie or history stack.
        return new Client(['handler' => static function (#[\SensitiveParameter] RequestInterface $request, #[\SensitiveParameter] array $options) use ($endpoints, $transport) {
            try {
                if (!in_array($request->getMethod() . ' ' . (string) $request->getUri(), $endpoints, true)) {
                    throw new RequestRejected('unavailable');
                }
                $memory = Utils::streamFor('');
                $sink = FnStream::decorate($memory, ['write' => static function (string $bytes) use ($memory): int {
                    if (strlen($bytes) > self::LIMIT - $memory->tell()) throw new RequestRejected('unavailable');
                    return $memory->write($bytes);
                }]);
                // Deliberately replace ALL per-request options after Guzzle built the PSR request.
                $safe = ['verify' => true, 'connect_timeout' => 3.0, 'timeout' => 10.0,
                    'allow_redirects' => false, 'http_errors' => false, 'debug' => false, 'cookies' => false,
                    'decode_content' => false, 'proxy' => '', 'sink' => $sink,
                    'curl' => [CURLOPT_PROTOCOLS => CURLPROTO_HTTPS, CURLOPT_REDIR_PROTOCOLS => CURLPROTO_HTTPS],
                    'on_headers' => static fn (ResponseInterface $response) => self::checkHeaders($response, $request->getMethod())];
                return $transport($request, $safe)->then(static function (ResponseInterface $response) use ($request): ResponseInterface {
                    self::checkHeaders($response, $request->getMethod());
                    $stream = $response->getBody();
                    if ($stream->isSeekable()) $stream->rewind();
                    $body = '';
                    while (!$stream->eof() && strlen($body) <= self::LIMIT) {
                        $chunk = $stream->read(min(8192, self::LIMIT + 1 - strlen($body)));
                        if ($chunk === '' && !$stream->eof()) throw new RequestRejected('unavailable');
                        $body .= $chunk;
                    }
                    $stream->close();
                    if (strlen($body) > self::LIMIT) throw new RequestRejected('unavailable');
                    $length = $response->getHeaderLine('Content-Length');
                    if ($length !== '' && (int) $length !== strlen($body)) throw new RequestRejected('unavailable');
                    // Bound parsing too; OAuth/JWK/user responses must be JSON objects.
                    $decoded = json_decode($body, false, 32, JSON_THROW_ON_ERROR);
                    if (!is_object($decoded) || ($response->getStatusCode() === 400
                        && (!is_string($decoded->error ?? null) || $decoded->error === ''))) throw new RequestRejected('unavailable');
                    if ((string) $request->getUri() === 'https://www.googleapis.com/oauth2/v3/certs') self::googleKeys($decoded);
                    return $response->withBody(Utils::streamFor($body));
                })->otherwise(static function (): never { throw new RequestRejected('unavailable'); });
            } catch (Throwable) {
                // Never retain exception chains containing HTTP requests, response bytes or secrets.
                return Create::rejectionFor(new RequestRejected('unavailable'));
            }
        }]);
    }

    private static function checkHeaders(ResponseInterface $response, string $method): void
    {
        $headers = $response->getHeaders();
        $bytes = 0;
        foreach ($headers as $name => $values) {
            foreach ($values as $value) $bytes += strlen($name) + strlen($value) + 4;
        }
        $length = $response->getHeaderLine('Content-Length');
        if (!in_array($response->getStatusCode(), $method === 'POST' ? [200, 400] : [200], true)
            || count($headers) > 64 || $bytes > 16384 || $response->hasHeader('Content-Encoding')
            || ($length !== '' && (!preg_match('/^(?:0|[1-9][0-9]{0,4})$/D', $length) || (int) $length > self::LIMIT))) {
            throw new RequestRejected('unavailable');
        }
    }

    /** Structure/size only; Google/Firebase still performs key parsing and RSA verification. */
    private static function googleKeys(object $document): void
    {
        if (!is_array($document->keys ?? null) || !array_is_list($document->keys)
            || count($document->keys) < 1 || count($document->keys) > 16) throw new RequestRejected('unavailable');
        $seen = [];
        foreach ($document->keys as $key) {
            if (!is_object($key) || ($key->kty ?? null) !== 'RSA' || ($key->alg ?? null) !== 'RS256'
                || ($key->use ?? null) !== 'sig' || !is_string($key->kid ?? null)
                || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $key->kid) || isset($seen[$key->kid])) throw new RequestRejected('unavailable');
            $seen[$key->kid] = true;
            foreach (['n' => [256, 1024], 'e' => [1, 8]] as $field => [$min, $max]) {
                $value = $key->$field ?? null;
                if (!is_string($value) || strlen($value) > 1366 || !preg_match('/^[A-Za-z0-9_-]+$/D', $value)) throw new RequestRejected('unavailable');
                $bytes = base64_decode(strtr($value, '-_', '+/'), true);
                if ($bytes === false || strlen($bytes) < $min || strlen($bytes) > $max
                    || rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=') !== $value) throw new RequestRejected('unavailable');
            }
        }
    }
}
