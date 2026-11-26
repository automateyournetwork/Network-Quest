<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\HttpRequest;
use NetworkQuest\RequestRejected;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../src/Security.php';
require_once __DIR__ . '/../src/HttpRequest.php';

final class HttpRequestTest extends TestCase
{
    private function server(): array { return ['HTTPS'=>'on','HTTP_HOST'=>'game.invalid','REMOTE_ADDR'=>'192.0.2.41','SERVER_PROTOCOL'=>'HTTP/1.1','REQUEST_METHOD'=>'GET']; }
    public static function singletonFields(): iterable
    {
        foreach (['Host','Origin','Cookie','X-CSRF-Token','Content-Type','Content-Length','Transfer-Encoding','Content-Encoding',
            'Idempotency-Key','If-Match','If-None-Match','X-Save-Mode','X-Confirm-Adventure-Replacement','X-Confirm-Account-Deletion','X-Deletion-Receipt'] as $name) yield [$name];
    }
    #[DataProvider('singletonFields')]
    public function testCoalescedSecuritySingletonCannotChooseFirstOrLast(string $name): void
    {
        $this->expectException(RequestRejected::class);
        (new HttpRequest('https://game.invalid'))->fields($this->server(),array_replace(['Host'=>'game.invalid'],[$name=>'synthetic, synthetic']),'litespeed');
    }
    public function testUnusedMultivalueFieldsHaveNoAuthorityAndRawCaseDuplicatesStillFail(): void
    {
        $adapter=new HttpRequest('https://game.invalid');
        self::assertSame([['Host','game.invalid'],['Accept','text/html, application/json']],$adapter->fields($this->server(),['Host'=>'game.invalid','Accept'=>'text/html, application/json'],'litespeed'));
        $this->expectException(RequestRejected::class);
        $adapter->fields($this->server(),['Host'=>'game.invalid','Origin'=>'https://game.invalid','origin'=>'https://game.invalid'],'litespeed');
    }
    public function testServerAliasesNeverSupplySecurityFields(): void
    {
        $fields=(new HttpRequest('https://game.invalid'))->fields($this->server()+['HTTP_X_CSRF_TOKEN'=>'forged'],['Host'=>'game.invalid','X_CSRF_TOKEN'=>'forged'],'litespeed');
        self::assertSame([['Host','game.invalid'],['X_CSRF_TOKEN','forged']],$fields);
    }
    #[DataProvider('badAdapters')]
    public function testUnverifiedSapiMissingTlsWrongHostAndUntrustedProxyFail(string $sapi, array $server, ?string $token): void
    {
        $this->expectException(RequestRejected::class);
        (new HttpRequest('https://game.invalid',$token))->fields($server,['Host'=>'game.invalid'],$sapi);
    }
    public static function badAdapters(): array
    {
        $base=['HTTPS'=>'on','HTTP_HOST'=>'game.invalid','REMOTE_ADDR'=>'192.0.2.41','SERVER_PROTOCOL'=>'HTTP/1.1','REQUEST_METHOD'=>'GET'];
        return [['apache2handler',$base,null],['cli',$base,null],['litespeed',array_replace($base,['HTTPS'=>'off']),null],
            ['litespeed',array_replace($base,['HTTP_HOST'=>'evil.invalid']),null],['cli-server',$base,null],
            ['cli-server',$base,str_repeat('a',64)],['litespeed',$base,str_repeat('a',64)]];
    }

    public function testNativeHttpOneMutationRequiresFramingEvenForEmptyBody(): void
    {
        $adapter=new HttpRequest('https://game.invalid');
        foreach (['POST','PUT','PATCH','DELETE'] as $method) {
            $server=array_replace($this->server(),['REQUEST_METHOD'=>$method]);
            try { $adapter->fields($server,['Host'=>'game.invalid'],'litespeed'); self::fail('Lost CL/TE framing cannot authorize mutation.'); }
            catch (RequestRejected $error) { self::assertSame(400,$error->status); }
            self::assertCount(2,$adapter->fields($server,['Host'=>'game.invalid','Content-Length'=>'0'],'litespeed'));
            self::assertCount(1,$adapter->fields(array_replace($server,['SERVER_PROTOCOL'=>'HTTP/2.0']),['Host'=>'game.invalid'],'litespeed'));
        }
    }
    public function testHttpTwoCookieConcatenationCannotReplaceExistingSessionWithGuest(): void
    {
        $adapter=new HttpRequest('https://game.invalid'); $server=array_replace($this->server(),['SERVER_PROTOCOL'=>'HTTP/2.0']);
        self::assertCount(2,$adapter->fields($server,['Host'=>'game.invalid','Cookie'=>'other=one; __Secure-nq_session=synthetic'],'litespeed'));
        $this->expectException(RequestRejected::class);
        $adapter->fields($server,['Host'=>'game.invalid','Cookie'=>'__Secure-nq_session=first; __Secure-nq_session=second'],'litespeed');
    }
    public function testUnverifiedProtocolFailsClosed(): void
    {
        $this->expectException(RequestRejected::class);
        (new HttpRequest('https://game.invalid'))->fields(array_replace($this->server(),['SERVER_PROTOCOL'=>'HTTP/3']),['Host'=>'game.invalid'],'litespeed');
    }

    public function testAuthenticatedLocalProxyAndUnambiguousChunkedInput(): void
    {
        $token=str_repeat('a',64); $server=['REMOTE_ADDR'=>'127.0.0.1','HTTP_X_NQ_DEV_PROXY'=>$token,'HTTP_X_FORWARDED_PROTO'=>'https','HTTP_HOST'=>'game.invalid','SERVER_PROTOCOL'=>'HTTP/1.1','REQUEST_METHOD'=>'GET'];
        self::assertSame([['Host','game.invalid'],['Transfer-Encoding','chunked']],(new HttpRequest('https://game.invalid',$token))->fields($server,['Host'=>'game.invalid','Transfer-Encoding'=>'chunked'],'cli-server'));
        $this->expectException(RequestRejected::class);
        (new HttpRequest('https://game.invalid',$token))->fields($server,['Host'=>'game.invalid','Transfer-Encoding'=>'chunked','Content-Length'=>'2'],'cli-server');
    }
}
