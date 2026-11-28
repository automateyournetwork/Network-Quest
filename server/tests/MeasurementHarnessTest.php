<?php
declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
use NetworkQuest\Tests\Support\TestEnvironment;
use PHPUnit\Framework\TestCase;
require_once __DIR__.'/../../tools/measure-save-load.php';

final class MeasurementHarnessTest extends TestCase
{
    public function testAllRequestDurationsIncludingFailuresAffectP95(): void
    {
        $rows=[];
        for($i=0;$i<19;$i++) $rows[]=['operation'=>'save','status'=>200,'curlCode'=>0,'milliseconds'=>1.0];
        $rows[]=['operation'=>'save','status'=>503,'curlCode'=>0,'milliseconds'=>4000.0];
        $rows[]=['operation'=>'save','status'=>0,'curlCode'=>28,'milliseconds'=>10000.0];
        $result=measurementSummary($rows);
        self::assertSame(4000.0,$result['all']['p95Milliseconds']);
        self::assertSame(2,$result['failures']);
        self::assertSame(21,$result['save']['count']);
        self::assertFalse($result['localSaveTargetSatisfied']);
    }
    public function testEmptyOrInvalidEvidenceCannotPass(): void
    {
        self::assertNull(measurementSummary([])['all']['p95Milliseconds']);
        self::assertFalse(measurementSummary([])['localSaveTargetSatisfied']);
        $this->expectException(InvalidArgumentException::class);
        measurementSummary([['operation'=>'save','status'=>200,'curlCode'=>0,'milliseconds'=>-1]]);
    }
    public function testCliCannotSelectExternalStorageOrLoadTargets(): void
    {
        self::assertSame(['rounds'=>12,'intervalMs'=>1000], measurementOptions([]));
        foreach([['--url=https://example.com'],['--database=/tmp/not-owned'],['--rounds=0'],['--rounds=101'],['--interval-ms=-1']] as $args) {
            try { measurementOptions($args); self::fail('Invalid profile accepted'); }
            catch(InvalidArgumentException) { self::assertTrue(true); }
        }
    }
    public function testNativeTwentySessionHarnessKeepsCsrfAndCertificateFailuresAndCleansUp(): void
    {
        $events=[];
        $result=runSaveMeasurement(['rounds'=>1,'intervalMs'=>0],static function(array $row) use (&$events): void { $events[]=$row; },true,1);
        self::assertCount(40,$result['samples']);
        self::assertSame(20,$result['profile']['sessions']);
        self::assertTrue($result['summary']['ownedStorageRemoved']);
        $bad=array_values(array_filter($result['samples'],static fn(array $row): bool=>$row['round']===0&&$row['session']===1));
        self::assertSame(403,$bad[0]['status']);
        $untrusted=array_values(array_filter($result['samples'],static fn(array $row): bool=>$row['round']===0&&$row['session']===2));
        self::assertSame(0,$untrusted[0]['status']); self::assertSame(60,$untrusted[0]['curlCode']); // libcurl peer verification failure
        self::assertSame(2,$result['summary']['allIncludingInitial']['failures']);
        self::assertFalse($result['summary']['allIncludingInitial']['localSaveTargetSatisfied']);
        self::assertSame('cleanup',$events[count($events)-2]['type']);
        self::assertSame('summary',$events[count($events)-1]['type']);
    }
    public function testNativePositiveControlCreatesAndReplacesAllTwentySlotsWithValidatedResponses(): void
    {
        // Protocol control serializes twenty distinct sessions. The separate
        // twenty-way trial retains real contention rather than demanding zero.
        $result=runSaveMeasurement(['rounds'=>4,'intervalMs'=>0],null,false,1);
        self::assertCount(100,$result['samples']);
        self::assertSame(0,$result['summary']['allIncludingInitial']['failures'],json_encode($result['summary']['failedSamples'],JSON_THROW_ON_ERROR));
        $initial=array_values(array_filter($result['samples'],static fn(array $r): bool=>$r['round']===-1));
        self::assertCount(20,$initial);
        foreach($initial as $row) { self::assertSame(201,$row['status']); self::assertSame(1,$row['confirmedRevision']); self::assertFalse($row['invalidResponse']); }
        $replacements=array_values(array_filter($result['samples'],static fn(array $r): bool=>$r['round']>=0&&$r['operation']==='save'));
        self::assertCount(20,$replacements);
        foreach($replacements as $row) { self::assertSame(200,$row['status']); self::assertSame(2,$row['confirmedRevision']); self::assertFalse($row['invalidResponse']); }
        self::assertFalse(measurementSuccessful(['operation'=>'save','status'=>200,'curlCode'=>0,'invalidResponse'=>true]));
        self::assertFalse(measurementSuccessful(['operation'=>'read','status'=>201,'curlCode'=>0]));
    }
    public function testConcurrentTwentySessionTrialRetainsEveryOutcome(): void
    {
        $result=runSaveMeasurement(['rounds'=>1,'intervalMs'=>0]);
        self::assertSame(20,$result['profile']['maxInFlight']); self::assertCount(40,$result['samples']);
        foreach($result['samples'] as $row) {
            self::assertContains($row['status'],[200,201,404,503]); self::assertSame(0,$row['curlCode']);
            self::assertFalse($row['invalidResponse']); self::assertGreaterThanOrEqual(0,$row['milliseconds']);
        }
        $failed=array_values(array_filter($result['samples'],static fn(array $r): bool=>!in_array($r['status'],[200,201],true)));
        self::assertSame(count($failed),$result['summary']['allIncludingInitial']['failures']);
        self::assertSame($failed,$result['summary']['failedSamples']);
        self::assertSame(40,$result['summary']['allIncludingInitial']['all']['count']);
    }
    public function testInterruptedNativeRunEmitsFailureAndVerifiedCleanup(): void
    {
        $process=proc_open([PHP_BINARY,'-d','auto_prepend_file=','-d','auto_append_file=',__DIR__.'/../../tools/measure-save-load.php','--rounds=100','--interval-ms=5000'],
            [0=>['file','/dev/null','r'],1=>['pipe','w'],2=>['file','/dev/null','w']],$pipes,dirname(__DIR__,2),
            ['LANG'=>'C','LC_ALL'=>'C','NQ_TEST_NODE_BIN'=>TestEnvironment::nodeBinary()]);
        self::assertIsResource($process); stream_set_timeout($pipes[1],10);
        try {
            $profile=json_decode(fgets($pipes[1]),true,512,JSON_THROW_ON_ERROR); self::assertSame('profile',$profile['type']);
            proc_terminate($process,SIGTERM);
            $events=[]; while(($line=fgets($pipes[1]))!==false) $events[]=json_decode($line,true,512,JSON_THROW_ON_ERROR);
            $cleanup=array_values(array_filter($events,static fn(array $row): bool=>$row['type']==='cleanup'));
            self::assertCount(1,$cleanup); self::assertTrue($cleanup[0]['ownedStorageRemoved']);
            self::assertCount(1,array_filter($events,static fn(array $row): bool=>$row['type']==='harness-error'&&isset($row['class'])));
        } finally {
            if(proc_get_status($process)['running']) proc_terminate($process,SIGKILL);
            fclose($pipes[1]); proc_close($process);
        }
    }
}
