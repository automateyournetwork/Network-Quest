<?php
declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
use NetworkQuest\Database;
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;
require_once __DIR__.'/Support/TestEnvironment.php';
require_once __DIR__.'/../src/Database.php';

final class DatabaseJournalRaceTest extends TestCase
{
    public static function disappearingJournals(): array
    {
        return ['private journal'=>[0600,true], 'public journal'=>[0644,false]];
    }

    #[DataProvider('disappearingJournals')]
    public function testJournalDisappearanceAfterStatUsesTheObservedMetadata(int $mode, bool $expected): void
    {
        $environment=TestEnvironment::create(); $process=null; $pipes=[]; $journal=null; $journalIdentity=null;
        try {
            $environment->connect(); $root=realpath(__DIR__.'/../..');
            $file=$environment->directory().'/synthetic.sqlite';
            $database=Database::open($file,[$root,$root.'/server/public']); $database->migrate(); unset($database);
            // This ephemeral sidecar is intentionally not a permanent fixture
            // file: the race removes it. Keep its own identity for cleanup.
            $journal=$environment->directory().'/synthetic.sqlite-journal';
            $handle=fopen($journal,'x+b'); self::assertIsResource($handle); fclose($handle); chmod($journal,$mode);
            $journalIdentity=lstat($journal);
            // Interpose one syscall only in a fresh process. A real owned empty
            // journal is removed immediately after its actual lstat snapshot,
            // modeling another connection finishing DELETE-journal commit.
            // No live transaction's journal or external database is modified.
            $program= <<<'PHP'
namespace NetworkQuest {
    function lstat(string $path): array|false {
        $metadata=\lstat($path);
        if($path===($GLOBALS['journalRacePath']??null) && $metadata!==false) {
            $GLOBALS['journalRacePath']=null; $GLOBALS['removed']=\unlink($path);
        }
        return $metadata;
    }
}
namespace {
    require $argv[1].'/server/src/Database.php';
    $GLOBALS['journalRacePath']=$argv[2].'-journal'; $GLOBALS['removed']=false;
    try { $db=\NetworkQuest\Database::open($argv[2],[$argv[1],$argv[1].'/server/public']); $opened=true; }
    catch(\Throwable $error) { $opened=false; }
    echo json_encode(['opened'=>$opened,'removed'=>$GLOBALS['removed']],JSON_THROW_ON_ERROR);
}
PHP;
            $process=proc_open([PHP_BINARY,'-d','auto_prepend_file=','-d','auto_append_file=','-r',$program,$root,$file],
                [0=>['file','/dev/null','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,$environment->directory(),['LANG'=>'C','LC_ALL'=>'C']);
            self::assertIsResource($process); foreach($pipes as $pipe) stream_set_blocking($pipe,false);
            $out=''; $err=''; $deadline=microtime(true)+5;
            do {
                $out.=stream_get_contents($pipes[1]); $err.=stream_get_contents($pipes[2]);
                $status=proc_get_status($process);
                if(!$status['running']) break;
                usleep(1000);
            } while(microtime(true)<$deadline && strlen($out)+strlen($err)<4096);
            self::assertFalse($status['running'],'Isolated journal observation exceeded its bound');
            $out.=stream_get_contents($pipes[1]); $err.=stream_get_contents($pipes[2]);
            self::assertSame(0,$status['exitcode']); self::assertSame('',$err);
            $result=json_decode($out,true,8,JSON_THROW_ON_ERROR);
            self::assertTrue($result['removed']); self::assertSame($expected,$result['opened']);
            self::assertFileDoesNotExist($journal);
        } finally {
            if(is_resource($process)) { if(proc_get_status($process)['running']) proc_terminate($process,9); proc_close($process); }
            foreach($pipes as $pipe) if(is_resource($pipe)) fclose($pipe);
            if($journal!==null) {
                clearstatcache(true,$journal); $remaining=@lstat($journal);
                if($remaining!==false) {
                    self::assertSame($journalIdentity['ino'],$remaining['ino']);
                    self::assertSame($journalIdentity['dev'],$remaining['dev']);
                    self::assertSame($journalIdentity['uid'],$remaining['uid']);
                    self::assertSame(0100000,$remaining['mode']&0170000); unlink($journal);
                }
            }
            unset($database); $environment->close();
        }
    }
}
