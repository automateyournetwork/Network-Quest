<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;

/** Verified SAPI bridge. Normalized fields are NOT proof of arbitrary raw multiplicity. */
final readonly class HttpRequest
{
    private const SINGLETONS = ['host','origin','cookie','x-csrf-token','content-type','content-length','transfer-encoding',
        'content-encoding','idempotency-key','if-match','if-none-match','x-save-mode','x-confirm-adventure-replacement',
        'x-confirm-account-deletion','x-deletion-receipt'];

    public function __construct(private string $origin, private ?string $proxyToken = null)
    {
        if (!str_starts_with($origin,'https://') || ($proxyToken !== null && !preg_match('/^[a-f0-9]{64}$/D',$proxyToken))) {
            throw new InvalidArgumentException('Expected trusted configured origin and optional local proxy token.');
        }
    }

    /**
     * Call with actual getallheaders(), actual $_SERVER and PHP_SAPI. Do not synthesize
     * fields from HTTP_* aliases or parse $_GET/POST/COOKIE. LiteSpeed HTTP/1.1 singleton
     * duplication was probed: coalesced values contain commas, Host/Length duplicates
     * fail upstream. HTTP/2 Cookie uses semicolon concatenation; game-cookie repeats fail. Unused legitimate multivalue headers confer no authority.
     * Local CLI-server is accepted only behind our token-authenticated rawHeaders proxy.
     * Other SAPIs fail closed until their field/framing behavior is independently verified.
     */
    public function fields(array $server, array $normalized, string $sapi = PHP_SAPI): array
    {
        if ($sapi === 'cli-server' && $this->proxyToken !== null) {
            if (($server['REMOTE_ADDR'] ?? null) !== '127.0.0.1' || ($server['HTTP_X_FORWARDED_PROTO'] ?? null) !== 'https'
                || !is_string($server['HTTP_X_NQ_DEV_PROXY'] ?? null) || !hash_equals($this->proxyToken,$server['HTTP_X_NQ_DEV_PROXY'])) throw new RequestRejected('invalid-request');
        } elseif ($sapi !== 'litespeed' || $this->proxyToken !== null) {
            throw new RequestRejected('unavailable');
        } elseif (!in_array($server['HTTPS'] ?? '',['on','1'],true)) throw new RequestRejected('invalid-request');
        $protocol=$server['SERVER_PROTOCOL'] ?? null;
        if (!in_array($protocol,['HTTP/1.1','HTTP/2.0'],true)) throw new RequestRejected('unavailable');
        $pairs=[];
        foreach ($normalized as $name=>$value) $pairs[]=[$name,$value];
        $headers=Security::headers($pairs);
        foreach (self::SINGLETONS as $name) {
            if (isset($headers[$name]) && str_contains($headers[$name],',')) throw new RequestRejected('invalid-request');
        }
        $host=substr($this->origin,strlen('https://'));
        if (($headers['host'] ?? null) !== $host || ($server['HTTP_HOST'] ?? null) !== $host) throw new RequestRejected('invalid-request');
        $length=$headers['content-length'] ?? null; $transfer=$headers['transfer-encoding'] ?? null;
        if (isset($headers['content-encoding']) || ($length !== null && !preg_match('/^(?:0|[1-9][0-9]*)$/D',$length))
            || ($transfer !== null && ($transfer !== 'chunked' || $length !== null))) throw new RequestRejected('invalid-request');
        if ($length !== null && (strlen($length)>6 || (int)$length>262144)) throw new RequestRejected('body-too-large');
        // LiteSpeed strips both TE and CL from some HTTP/1.1 CL+TE requests.
        // Require explicit CL on mutations (including0); never infer a lost framing field.
        if ($sapi==='litespeed' && $protocol==='HTTP/1.1' && $length===null
            && in_array($server['REQUEST_METHOD'] ?? '', ['POST','PUT','PATCH','DELETE'],true)) throw new RequestRejected('invalid-request');
        // HTTP/2 legitimately concatenates Cookie fields using semicolons. Distinct cookies
        // are allowed, but duplicate game credentials are ambiguity, never a guest bootstrap.
        $gameCookies=0;
        foreach (explode(';',$headers['cookie'] ?? '') as $part) {
            if (explode('=',trim($part,' '),2)[0]==='__Secure-nq_session' && ++$gameCookies>1) throw new RequestRejected('invalid-request');
        }
        Security::peerAddress($server);
        return $pairs;
    }
}
