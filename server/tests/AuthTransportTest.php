<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Router;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/Support/TestEnvironment.php';
require_once __DIR__ . '/../src/Router.php';

/** Actual raw TLS requests through the local proxy BEFORE PHP normalizes headers. */
final class AuthTransportTest extends TestCase
{
    private function wire(TestEnvironment $environment, string $origin, string $request): array
    {
        $context=stream_context_create(['ssl'=>['cafile'=>$environment->directory().'/certificate.pem',
            'verify_peer'=>true,'verify_peer_name'=>true,'peer_name'=>'127.0.0.1']]);
        $socket=stream_socket_client('tls://127.0.0.1:'.parse_url($origin,PHP_URL_PORT),$number,$error,2,STREAM_CLIENT_CONNECT,$context);
        self::assertIsResource($socket); stream_set_timeout($socket,7);
        $start=microtime(true); fwrite($socket,$request); $raw=stream_get_contents($socket); $info=stream_get_meta_data($socket); fclose($socket);
        return [$raw,microtime(true)-$start,$info['timed_out']];
    }
    public function testRawDuplicatesFramingAndHeaderBoundsAreRejectedBeforeSapi(): void
    {
        $environment=TestEnvironment::create();
        try {
            $origin=$environment->startApi(); $host=parse_url($origin,PHP_URL_HOST).':'.parse_url($origin,PHP_URL_PORT);
            foreach (['Host'=>$host,'Content-Type'=>'application/json','Cookie'=>'__Secure-nq_session=synthetic',
                'Origin'=>$origin,'X-CSRF-Token'=>'synthetic','Authorization'=>'Bearer synthetic','X-Deletion-Receipt'=>'synthetic'] as $name=>$value) {
                $fields=$name==='Host'?[]:['Host: '.$host];
                $fields[]=$name.': '.$value; $fields[]=strtolower($name).': '.$value; $fields[]='Connection: close';
                [$raw]=$this->wire($environment,$origin,'GET '.Router::API_BASE.'/session HTTP/1.1' . "\r\n" . implode("\r\n",$fields)."\r\n\r\n");
                self::assertStringStartsWith('HTTP/1.1 400',$raw,$name.' duplicates cannot disappear in Node/SAPI.');
            }
            foreach ([['Content-Length: 0','Content-Length: 0'],['Content-Length: 0','Transfer-Encoding: chunked'],
                ['Content-Encoding: gzip'],['X-Oversized: '.str_repeat('a',8193)],array_map(fn($i)=>'X-Field-'.$i.': x',range(1,65))] as $fields) {
                [$raw]=$this->wire($environment,$origin,'GET '.Router::API_BASE.'/session HTTP/1.1' . "\r\nHost: ".$host."\r\nConnection: close\r\n".implode("\r\n",$fields)."\r\n\r\n");
                self::assertMatchesRegularExpression('/^HTTP\/1\.1 (?:400|431)/',$raw);
            }
            foreach ([[['Content-Length: 262145'],''],[['Transfer-Encoding: chunked'],dechex(262145)."\r\n".str_repeat('x',262145)."\r\n0\r\n\r\n"]] as [$fields,$body]) {
                [$raw]=$this->wire($environment,$origin,'POST '.Router::API_BASE.'/auth/google/start HTTP/1.1'."\r\nHost: ".$host."\r\nConnection: close\r\n".implode("\r\n",$fields)."\r\n\r\n".$body);
                self::assertStringStartsWith('HTTP/1.1 413',$raw);
            }
            self::assertSame(503,$environment->request('GET',Router::API_BASE.'/session')['status'],'Unconfigured production entry remains unavailable.');
            self::assertSame('',$environment->diagnostics());
        } finally { $environment->close(); }
    }
    public function testActualSlowHeaderAndIncompleteBodyDeadline(): void
    {
        $environment=TestEnvironment::create();
        try {
            $origin=$environment->startApi(); $host=parse_url($origin,PHP_URL_HOST).':'.parse_url($origin,PHP_URL_PORT);
            foreach (['GET '.Router::API_BASE.'/session HTTP/1.1'."\r\nHost: ",
                'POST '.Router::API_BASE.'/auth/google/start HTTP/1.1'."\r\nHost: ".$host."\r\nContent-Length: 10\r\nConnection: close\r\n\r\nx"] as $partial) {
                [$raw,$elapsed,$timedOut]=$this->wire($environment,$origin,$partial);
                self::assertFalse($timedOut,'Server must expire request before test timeout.');
                self::assertStringStartsWith('HTTP/1.1 408',$raw);
                self::assertStringContainsString('Cache-Control: no-store',$raw);
                self::assertGreaterThanOrEqual(4.5,$elapsed); self::assertLessThan(6.5,$elapsed);
            }
        } finally { $environment->close(); }
    }
}
