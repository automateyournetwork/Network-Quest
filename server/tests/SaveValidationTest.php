<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

use NetworkQuest\Security;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

require_once __DIR__.'/ApiContractTest.php';

final class SaveValidationTest extends TestCase
{
    private T053ApiFixture $fixture;
    private array $a;
    private array $b;
    private array $before;
    protected function setUp(): void
    {
        $this->fixture = new T053ApiFixture();
        $this->a = $this->fixture->account('11'); $this->b = $this->fixture->account('12', 'github');
        foreach ([$this->a,$this->b] as $index=>$account) {
            $response = $this->fixture->request('PUT', '/save', $this->fixture->fields($account)+['If-None-Match'=>'*',
                'X-Save-Mode'=>'manual','Idempotency-Key'=>'53000000-0000-4000-8000-00000000011'.$index],
                T053ApiFixture::payload('synthetic-T053-private-note-'.$index));
            self::assertSame(201, $response['status'], $response['body']);
        }
        $this->before = $this->fixture->graph();
    }
    protected function tearDown(): void { $this->fixture->close(); }
    private function fields(): array
    {
        return $this->fixture->fields($this->a)+['If-Match'=>'"save-1"','X-Save-Mode'=>'manual','Idempotency-Key'=>'53000000-0000-4000-8000-000000000120'];
    }
    private function denied(string $raw, int $status, ?array $fields = null, string $path = '/save'): array
    {
        $response = $this->fixture->request('PUT', $path, $fields ?? $this->fields(), $raw);
        T053Contract::problem($response, $status, $status === 412);
        T053Contract::noPrivate($response, [$this->a['id'],$this->b['id'],$this->a['csrf'],$this->b['csrf'],
            'synthetic-T053-private-note-0','synthetic-T053-private-note-1','synthetic-T053-untrusted-detail',
            $this->fixture->environment->directory(),$this->fixture->config['googleClientSecret']]);
        self::assertSame($this->before, $this->fixture->graph(), 'Rejected request must preserve both full account graphs and retained receipts.');
        return $response;
    }
    public static function malformedBodies(): iterable
    {
        yield 'empty' => ['',400]; yield 'truncated object' => ['{"synthetic-T053-untrusted-detail":',400];
        yield 'array root' => ['[]',422]; yield 'scalar root' => ['null',422];
        yield 'UTF8 overlong sequence' => ["{\"notebook\":\"\xc0\xaf\"}",400];
        yield 'UTF8 surrogate codepoint' => ["{\"notebook\":\"\xed\xa0\x80\"}",400];
        yield 'UTF8 past Unicode range' => ["{\"notebook\":\"\xf4\x90\x80\x80\"}",400];
        yield 'lone escaped high surrogate' => ['{"notebook":"\ud800"}',400];
        yield 'lone escaped low surrogate' => ['{"notebook":"\udfff"}',400];
        yield 'UTF8 BOM' => ["\xef\xbb\xbf".T053ApiFixture::payload(),400];
        yield 'second document' => [T053ApiFixture::payload().'{}',400];
        yield 'depth bound' => [str_repeat('[',40).'0'.str_repeat(']',40),400];
        yield 'raw byte bound' => [str_repeat(' ',262145),413];
    }
    #[DataProvider('malformedBodies')]
    public function testMalformedBodyCannotChangeEitherOwnedSlot(string $raw, int $status): void { $this->denied($raw,$status); }

    public static function invalidSnapshots(): array
    {
        return [
            'ownership selector'=>['accountId','synthetic-T053-untrusted-detail'],
            'server revision'=>['revision',999], 'server saved time'=>['savedAt','2026-11-26T00:00:00Z'],
            'future schema'=>['saveSchemaVersion',2], 'unknown content'=>['contentVersion','99.0.0'],
            'wrong episode'=>['episodeId','spec002'], 'bad adventure UUID'=>['adventureId','synthetic-T053-untrusted-detail'],
            'active encounter'=>['safeState','active-encounter'], 'terminal failure'=>['safeState','failure'],
            'unsafe E03'=>['world.continueOutcome','E03'], 'unknown room'=>['world.roomId','spec001:R99'],
            'unowned position'=>['world.position.safePositionId','spec001:R02.entry'],
            'unrecruited ally'=>['world.activeAllyIds',['spec001:CH03']],
            'unsupported objective'=>['world.completedObjectiveIds',['spec001:O12']],
            'unknown fact'=>['notebook.factIds',['spec001:synthetic-T053-untrusted-detail']],
            'array instead of flags'=>['world.flags',[]], 'too many Unicode codepoints'=>['notebook.personalNotes',str_repeat('🦉',4097)],
            'negative configuration'=>['world.configurationRevision',-1],
            'too many party members'=>['world.activeAllyIds',['spec001:CH03','spec001:CH04','spec001:CH05']],
        ];
    }
    #[DataProvider('invalidSnapshots')]
    public function testSchemaRegistryAndSafeStateRejectBeforeChangingAnyPlayerData(string $path, mixed $value): void
    {
        $data = json_decode(T053ApiFixture::payload()); $target = $data;
        $parts = explode('.', $path); $last = array_pop($parts); foreach ($parts as $part) $target = $target->$part;
        $target->$last = $value;
        $this->denied(json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE),422);
    }
    public static function hostileHeaders(): array
    {
        return [
            'missing Origin'=>['Origin',null,403], 'opaque Origin'=>['Origin','null',403],
            'Origin slash'=>['Origin','https://game.invalid/',403], 'Origin suffix'=>['Origin','https://game.invalid.attacker.invalid',403],
            'missing CSRF'=>['X-CSRF-Token',null,403], 'foreign CSRF'=>['X-CSRF-Token','foreign-csrf',403],
            'no cookie'=>['Cookie',null,401], 'forged cookie'=>['Cookie','__Secure-nq_session=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',401],
            'missing precondition'=>['If-Match',null,428], 'weak ETag'=>['If-Match','W/"save-1"',400],
            'ETag list'=>['If-Match','"save-1", "save-2"',400], 'stale ETag'=>['If-Match','"save-8"',412],
            'missing mode'=>['X-Save-Mode',null,400], 'unknown mode'=>['X-Save-Mode','background',400],
            'automatic disabled'=>['X-Save-Mode','automatic',409], 'invalid key'=>['Idempotency-Key','synthetic-T053-untrusted-detail',400],
            'missing key'=>['Idempotency-Key',null,400], 'wrong media type'=>['Content-Type','text/plain',400],
            'bad replacement consent'=>['X-Confirm-Adventure-Replacement','false',400],
        ];
    }
    #[DataProvider('hostileHeaders')]
    public function testAdmissionHeadersCannotUseForeignAuthorityOrClobberTheSlot(string $name, ?string $value, int $status): void
    {
        $fields = $this->fields();
        if ($value === null) unset($fields[$name]); else $fields[$name] = $value === 'foreign-csrf' ? $this->b['csrf'] : $value;
        $this->denied(T053ApiFixture::payload(),$status,$fields);
    }
    public function testSelectorsAndMixedCredentialsNeverReadOrReplaceAnotherAccount(): void
    {
        $raw = json_decode(T053ApiFixture::payload()); $raw->accountId = $this->b['id'];
        $this->denied(json_encode($raw),422);
        $this->denied(T053ApiFixture::payload(),400,path:'/save?accountId='.$this->b['id']);
        $this->denied(T053ApiFixture::payload(),400,$this->fields()+['If-None-Match'=>'*']);
        $this->denied(T053ApiFixture::payload(),400,$this->fields()+['oRiGiN'=>$this->fixture->origin]);
        $this->denied(T053ApiFixture::payload(),403,array_replace($this->fields(),['Cookie'=>$this->b['cookie']]));
        $read = $this->fixture->request('GET','/save',$this->fixture->fields($this->a)+['X-Account-Id'=>$this->b['id']]);
        self::assertSame(200,$read['status']);
        self::assertSame('synthetic-T053-private-note-0',json_decode($read['body'],true)['snapshot']['notebook']['personalNotes']);
        self::assertStringNotContainsString('synthetic-T053-private-note-1',$read['body']);
        self::assertSame($this->before,$this->fixture->graph());
    }

    public static function unicodeBoundaries(): iterable
    {
        yield 'astral codepoints 4096' => [str_repeat('🦉',4096),false,200];
        yield 'escaped surrogate pairs 4096' => [str_repeat('🦉',4096),true,200];
        yield 'combining codepoints 4096' => [str_repeat("e\u{0301}",2048),false,200];
        yield 'combining codepoints 4098' => [str_repeat("e\u{0301}",2049),false,422];
        yield 'plain text script and SQL' => ["<script>alert('synthetic-T053-untrusted-detail')</script>'; DROP TABLE accounts; --\n雪\u{0000}",false,200];
    }
    #[DataProvider('unicodeBoundaries')]
    public function testUnicodeUsesCodepointsAndPreservesExactAuthorizedText(string $notes, bool $escaped, int $status): void
    {
        $raw = T053ApiFixture::payload($notes);
        if ($escaped) $raw = json_encode(json_decode($raw),JSON_THROW_ON_ERROR);
        if ($status !== 200) { $this->denied($raw,$status); return; }
        $response = $this->fixture->request('PUT','/save',$this->fields(),$raw);
        self::assertSame(200,$response['status']); T053Contract::headers($response);
        $read = $this->fixture->request('GET','/save',$this->fixture->fields($this->a));
        self::assertSame($notes,json_decode($read['body'],true)['snapshot']['notebook']['personalNotes']);
        $query = $this->fixture->database->connection()->prepare('SELECT payload_json,payload_hash FROM saves WHERE account_id=?');
        $query->execute([$this->a['id']]); $slot = $query->fetch();
        self::assertSame($raw,$slot['payload_json']); self::assertSame(hash('sha256',$raw),$slot['payload_hash']);
        $after = $this->fixture->graph(); self::assertSame($this->before['accounts'],$after['accounts']);
        self::assertSame($this->before['saves'][1],$after['saves'][1]); self::assertSame($this->before['preferences'],$after['preferences']);
    }

    public function testExactRawByteBoundaryOnActualTlsPreservesSlotWhenOneByteTooLarge(): void
    {
        $this->fixture->startWire(); $headers = $this->fields(); $headers['Origin'] = $this->fixture->origin;
        $raw = T053ApiFixture::payload('🦉 synthetic-T053-private-note-boundary');
        $raw .= str_repeat(' ',262144-strlen($raw)); self::assertSame(262144,strlen($raw));
        $accepted = $this->fixture->request('PUT','/save',$headers,$raw,true); self::assertSame(200,$accepted['status']); T053Contract::headers($accepted);
        $before = $this->fixture->graph();
        $headers['If-Match'] = '"save-2"'; $headers['Idempotency-Key'] = '53000000-0000-4000-8000-000000000121';
        $rejected = $this->fixture->request('PUT','/save',$headers,$raw.' ',true); T053Contract::problem($rejected,413);
        self::assertSame($before,$this->fixture->graph());
        T053Contract::noPrivate($rejected,[$this->a['id'],$this->a['csrf'],'synthetic-T053-private-note-boundary']);
        self::assertSame('',$this->fixture->environment->diagnostics());
    }
}
