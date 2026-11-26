<?php
declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
require_once __DIR__.'/../server/src/Application.php';
require_once __DIR__.'/NativeMeasurementServer.php';
use NetworkQuest\Database;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Sessions;
use NetworkQuest\Router;
use NetworkQuest\Tests\Support\TestEnvironment;

function measurementOptions(array $args): array
{
    $options=['rounds'=>12,'intervalMs'=>1000];
    foreach($args as $arg) {
        if(!preg_match('/^--(rounds|interval-ms)=([0-9]+)$/D',$arg,$match)) throw new InvalidArgumentException('Only --rounds=1..100 and --interval-ms=0..5000 are accepted. Storage and targets are always newly isolated.');
        $value=(int)$match[2];
        if(($match[1]==='rounds'&&($value<1||$value>100))||($match[1]==='interval-ms'&&$value>5000)) throw new InvalidArgumentException('Measurement profile outside bounds.');
        $options[$match[1]==='rounds'?'rounds':'intervalMs']=$value;
    }
    return $options;
}

function measurementSummary(array $rows): array
{
    foreach($rows as $row) if(!is_numeric($row['milliseconds'])||!is_finite((float)$row['milliseconds'])||$row['milliseconds']<0) throw new InvalidArgumentException('Invalid duration.');
    $stats=static function(array $values): array {
        sort($values,SORT_NUMERIC); $n=count($values);
        return ['count'=>$n,'p95Milliseconds'=>$n?$values[(int)ceil($n*0.95)-1]:null,'maxMilliseconds'=>$n?$values[$n-1]:null];
    };
    $failed=array_values(array_filter($rows,static fn(array $r): bool=>!measurementSuccessful($r)));
    $save=$stats(array_column(array_filter($rows,static fn(array $r): bool=>$r['operation']==='save'),'milliseconds'));
    return ['all'=>$stats(array_column($rows,'milliseconds')),'save'=>$save,'failures'=>count($failed),
        'statusCounts'=>array_count_values(array_map(static fn(array $r): string=>(string)$r['status'],$rows)),
        'localSaveTargetSatisfied'=>$save['count']>0&&$save['p95Milliseconds']<2000&&count($failed)===0];
}

function measurementSuccessful(array $sample): bool
{
    return $sample['curlCode']===0 && in_array($sample['status'],$sample['operation']==='save'?[200,201]:[200],true)
        && !($sample['invalidResponse']??false);
}

function measurementSourceHashes(): array
{
    $root=dirname(__DIR__); $paths=[];
    foreach(['server/src','server/migrations','server/content'] as $directory) {
        foreach(new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root.'/'.$directory,FilesystemIterator::SKIP_DOTS)) as $file) {
            if($file->isFile()&&!$file->isLink()) $paths[]=substr($file->getPathname(),strlen($root)+1);
        }
    }
    $paths=array_merge($paths,['server/composer.lock','tools/measure-save-load.php','tools/NativeMeasurementServer.php','server/tests/Support/https-proxy.mjs','server/tests/Support/TestEnvironment.php']);
    sort($paths); $hashes=[]; foreach($paths as $path) $hashes[$path]=hash_file('sha256',$root.'/'.$path); return $hashes;
}

/** Real TLS requests; samples contain route/status/timing only, no identities or payloads. */
function runSaveMeasurement(array $options, ?callable $emit = null, bool $negativeControls = false, int $concurrency = 20): array
{
    if(!in_array($concurrency,[1,20],true)) throw new InvalidArgumentException('Only the serialized protocol control or actual twenty-way profile is supported.');
    $logRoot=dirname(__DIR__).'/.local/measurements';
    if(!is_dir($logRoot)&&!mkdir($logRoot,0700,true)) throw new RuntimeException('Evidence directory unavailable.');
    $logPath=$logRoot.'/save-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(6)).'.ndjson';
    $log=fopen($logPath,'x'); if($log===false) throw new RuntimeException('Evidence creation failed.'); chmod($logPath,0600);
    $observer=$emit;
    $emit=static function(array $row) use ($log,$observer): void {
        $line=json_encode($row,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES)."\n";
        if(fwrite($log,$line)!==strlen($line)||!fflush($log)) throw new RuntimeException('Evidence write failed.');
        if($observer!==null) $observer($row);
    };
    $signals=[];
    if(extension_loaded('pcntl')) {
        $asyncSignals=pcntl_async_signals(true);
        foreach([SIGINT,SIGTERM] as $signal) { $signals[$signal]=pcntl_signal_get_handler($signal); pcntl_signal($signal,static function(): never { throw new RuntimeException('Measurement interrupted.'); }); }
    }
    $game=TestEnvironment::create(); $recovery=TestEnvironment::create(); $server=null; $clients=[]; $rows=[];
    $started=hrtime(true); $cleanup=false;
    try {
        $game->connect(); $recovery->connect(); $recovery->writeFile('synthetic.sqlite.lock','');
        $roots=[realpath(dirname(__DIR__)),realpath(dirname(__DIR__).'/server/public')];
        $database=Database::open($game->directory().'/synthetic.sqlite',$roots); $database->migrate();
        $ledger=DeletionLedger::initialize($recovery->directory().'/synthetic.sqlite',$roots,[$game->directory()],new DeletionRetentionPolicy(2592000,604800,'T059-disposable-only'));
        $sessions=new Sessions($database); $pdo=$database->connection(); $auth=[];
        for($i=0;$i<20;$i++) {
            $id=sprintf('59000000-0000-4000-8000-%012d',$i+1);
            $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id,time()]);
            $pdo->prepare('INSERT INTO identities(account_id,provider,subject) VALUES(?,?,?)')->execute([$id,'github',(string)(59000000+$i)]);
            $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
            $guest=$sessions->bootstrap(null); $value=$database->immediate(fn(PDO $p): array=>$sessions->rotateWithin($p,$guest['context'],$id));
            $auth[]=['cookie'=>explode(';',$value['setCookie'],2)[0],'csrf'=>$value['csrfToken'],'save'=>null,'prefs'=>1];
        }
        $dummy='https://127.0.0.1:9999';
        $config=['origin'=>$dummy,'gamePath'=>Router::GAME_BASE,'databasePath'=>$game->directory().'/synthetic.sqlite',
            'ledgerFile'=>$recovery->directory().'/synthetic.sqlite','rollbackRoots'=>[$game->directory()],
            'backupSeconds'=>2592000,'restorationSeconds'=>604800,'retentionEvidence'=>'T059-disposable-only',
            'rateKey'=>rtrim(strtr(base64_encode(str_repeat('m',32)),'+/','-_'),'='),
            'googleClientId'=>'T059-synthetic-google','googleClientSecret'=>'T059-synthetic-google-secret','googleCallback'=>$dummy.Router::API_BASE.'/auth/google/callback',
            'githubClientId'=>'T059-synthetic-github','githubClientSecret'=>'T059-synthetic-github-secret','githubCallback'=>$dummy.Router::API_BASE.'/auth/github/callback'];
        $server=new NativeMeasurementServer($game,$config,$roots);
        $profile=['type'=>'profile','schema'=>1,'scope'=>'local-native-https-development-baseline','utc'=>gmdate('c'),'evidenceFile'=>basename($logPath),
            'host'=>php_uname('s').' '.php_uname('r').' '.php_uname('m'),'php'=>PHP_VERSION,'curl'=>curl_version()['version'],
            'tls'=>curl_version()['ssl_version'],'sqlite'=>$pdo->query('select sqlite_version()')->fetchColumn(),
            'sessions'=>20,'accounts'=>20,'maxInFlight'=>$concurrency,'phpForkedWorkers'=>$server->phpWorkers,'phpMasterAlsoServes'=>true,
            'transport'=>'curl_multi -> one Node loopback HTTPS proxy -> PHP CLI server pool -> actual public/index.php',
            'network'=>'127.0.0.1 loopback, no shaping; verified disposable CA/hostname; HTTP/1.1; no provider traffic',
            'sqlitePolicy'=>['journalMode'=>$pdo->query('PRAGMA journal_mode')->fetchColumn(),'synchronous'=>$pdo->query('PRAGMA synchronous')->fetchColumn(),'busyTimeoutMs'=>$pdo->query('PRAGMA busy_timeout')->fetchColumn()],
            'rounds'=>$options['rounds'],'intervalMs'=>$options['intervalMs'],'schedule'=>'20 initial saves then 20 requests per round with declared maxInFlight; rotating save/read/session/preferences, five each',
            'retryPolicy'=>'No automatic retry; every failure retained. Each round waits for all responses then interval.',
            'timeoutMs'=>10000,'proxyUpstreamTimeoutMs'=>2000,'negativeControls'=>$negativeControls,'sourceHashes'=>measurementSourceHashes(),
            'fixtureSha256'=>hash_file('sha256',dirname(__DIR__).'/specs/001-physical-layer-underworld/contracts/examples/save-v1.json')];
        $emit($profile);
        $body=file_get_contents(dirname(__DIR__).'/specs/001-physical-layer-underworld/contracts/examples/save-v1.json');
        for($i=0;$i<20;$i++) $clients[$i]=curl_init();
        $measured=hrtime(true);
        // -1 is recorded separately as initial cold connections + initial saves.
        for($round=-1;$round<$options['rounds'];$round++) {
          foreach(array_chunk(array_keys($clients),$concurrency) as $batch) {
            $multi=curl_multi_init(); $active=[];
            try {
                foreach($batch as $i) {
                    $client=$clients[$i];
                    $operation=$round===-1?'save':['save','read','session','preferences'][($i+$round)%4];
                    $method=match($operation){'save'=>'PUT','preferences'=>'PATCH',default=>'GET'};
                    $route=match($operation){'read'=>'save',default=>$operation};
                    $headers=['Origin: '.$server->origin,'Cookie: '.$auth[$i]['cookie'],'X-CSRF-Token: '.$auth[$i]['csrf'],'Content-Type: application/json'];
                    if($operation==='save') { $headers[]='Idempotency-Key: '.sprintf('59000000-%04d-4000-8000-%012d',$round+2,$i+1); $headers[]='X-Save-Mode: manual'; $headers[]=$auth[$i]['save']===null?'If-None-Match: *':'If-Match: "save-'.$auth[$i]['save'].'"'; }
                    if($operation==='preferences') $headers[]='If-Match: "prefs-'.$auth[$i]['prefs'].'"';
                    // Explicit harness negative control, inaccessible over HTTP or CLI.
                    if($negativeControls && $round===0 && $i===0) $headers=array_values(array_filter($headers,static fn(string $h): bool=>!str_starts_with($h,'X-CSRF-Token:')));
                    curl_setopt_array($client,[CURLOPT_URL=>$server->origin.Router::API_BASE.'/'.$route,CURLOPT_RETURNTRANSFER=>true,
                        CURLOPT_FOLLOWLOCATION=>false,CURLOPT_SSL_VERIFYPEER=>true,CURLOPT_SSL_VERIFYHOST=>2,CURLOPT_CAINFO=>$server->ca,
                        CURLOPT_PROTOCOLS=>CURLPROTO_HTTPS,CURLOPT_HTTP_VERSION=>CURL_HTTP_VERSION_1_1,CURLOPT_PROXY=>'',CURLOPT_TIMEOUT_MS=>10000,
                        CURLOPT_CUSTOMREQUEST=>$method,CURLOPT_POSTFIELDS=>$operation==='save'?$body:($operation==='preferences'?'{"captions":true}':''),CURLOPT_HTTPHEADER=>$headers]);
                    if($negativeControls && $round===0 && $i===1) {
                        // A new connection with normal trust cannot accept our
                        // disposable self-signed CA. Never disable verification.
                        $publicCa=openssl_get_cert_locations()['default_cert_file'];
                        if(!is_readable($publicCa)) throw new RuntimeException('Negative TLS control requires the installed public CA bundle.');
                        curl_setopt_array($client,[CURLOPT_CAINFO=>$publicCa,CURLOPT_FRESH_CONNECT=>true]);
                    }
                    curl_multi_add_handle($multi,$client); $active[spl_object_id($client)]=['session'=>$i+1,'round'=>$round,'operation'=>$operation,'startMs'=>(hrtime(true)-$measured)/1e6];
                }
                do {
                    $status=curl_multi_exec($multi,$running);
                    if($status!==CURLM_OK) throw new RuntimeException('curl_multi failed.');
                    while(($message=curl_multi_info_read($multi))!==false) {
                        $client=$message['handle']; $id=spl_object_id($client); $sample=$active[$id]; $i=$sample['session']-1;
                        $raw=curl_multi_getcontent($client); $data=json_decode(is_string($raw)?$raw:'',true);
                        $sample+=['status'=>curl_getinfo($client,CURLINFO_RESPONSE_CODE),'curlCode'=>$message['result'],
                            'milliseconds'=>curl_getinfo($client,CURLINFO_TOTAL_TIME)*1000,'connectMs'=>curl_getinfo($client,CURLINFO_CONNECT_TIME)*1000,
                            'tlsReadyMs'=>curl_getinfo($client,CURLINFO_APPCONNECT_TIME)*1000,'firstByteMs'=>curl_getinfo($client,CURLINFO_STARTTRANSFER_TIME)*1000,
                            'endMs'=>(hrtime(true)-$measured)/1e6,'requestBytes'=>curl_getinfo($client,CURLINFO_REQUEST_SIZE),'responseBytes'=>curl_getinfo($client,CURLINFO_SIZE_DOWNLOAD_T),
                            'problemCode'=>is_array($data)&&isset($data['code'])&&is_string($data['code'])?$data['code']:null];
                        $sample['invalidResponse']=false;
                        if(measurementSuccessful($sample)) {
                            $valid=is_array($data)&&match($sample['operation']) {
                                'save'=>($data['committedRevision']??null)===($auth[$i]['save']??0)+1
                                    &&($data['requestId']??null)===sprintf('59000000-%04d-4000-8000-%012d',$round+2,$i+1)
                                    &&$sample['status']===($auth[$i]['save']===null?201:200),
                                'read'=>($data['summary']['revision']??null)===$auth[$i]['save']&&($data['snapshot']??null)===json_decode($body,true,512,JSON_THROW_ON_ERROR),
                                'session'=>($data['state']??null)==='authenticated'&&($data['preferences']['revision']??null)===$auth[$i]['prefs'],
                                'preferences'=>($data['revision']??null)===$auth[$i]['prefs']+1&&($data['values']['captions']??null)===true,
                            };
                            $sample['invalidResponse']=!$valid;
                            if($valid && $sample['operation']==='save') { $auth[$i]['save']=$data['committedRevision']; $sample['confirmedRevision']=$data['committedRevision']; }
                            if($valid && $sample['operation']==='preferences') $auth[$i]['prefs']=$data['revision'];
                        }
                        $rows[]=$sample; $emit(['type'=>'sample']+$sample); unset($active[$id]); curl_multi_remove_handle($multi,$client);
                    }
                    if($running && curl_multi_select($multi,0.1)===-1) usleep(1000);
                } while($running);
            } finally {
                foreach($clients as $client) if(isset($active[spl_object_id($client)])) {
                    $sample=$active[spl_object_id($client)]+['status'=>0,'curlCode'=>-1,'milliseconds'=>(hrtime(true)-$measured)/1e6-$active[spl_object_id($client)]['startMs'],
                        'endMs'=>(hrtime(true)-$measured)/1e6,'problemCode'=>'harness-aborted'];
                    $rows[]=$sample; $emit(['type'=>'sample']+$sample); curl_multi_remove_handle($multi,$client);
                }
                curl_multi_close($multi);
            }
          }
            if($round+1<$options['rounds']) usleep($options['intervalMs']*1000);
        }
        $result=['type'=>'summary','durationSeconds'=>(hrtime(true)-$measured)/1e9,'allIncludingInitial'=>measurementSummary($rows),
            'mixedRounds'=>measurementSummary(array_values(array_filter($rows,static fn(array $r): bool=>$r['round']>=0))),
            'failedSamples'=>array_values(array_filter($rows,static fn(array $r): bool=>!measurementSuccessful($r))),
            'contention'=>'503/problem codes report observed service unavailability; successful wait times include locks but do not isolate lock wait. No attribution of every 503 to SQLite.',
            'stagingAcceptance'=>false];
        $result['twentyWayProfile']=$concurrency===20;
        foreach(['allIncludingInitial','mixedRounds'] as $scope) $result[$scope]['localSaveTargetSatisfied']=$concurrency===20&&$result[$scope]['localSaveTargetSatisfied'];
    } catch(Throwable $error) {
        $emit(['type'=>'harness-error','class'=>get_class($error),'message'=>'Incomplete measurement; preceding rows retained.']);
        throw $error;
    } finally {
        $clients=[];
        $server?->stop(); unset($sessions,$pdo,$database,$ledger);
        $recovery->close(); $game->close(); $cleanup=true;
        $emit(['type'=>'cleanup','ownedStorageRemoved'=>$cleanup,'totalSeconds'=>(hrtime(true)-$started)/1e9]);
        foreach($signals as $signal=>$handler) pcntl_signal($signal,$handler);
        if(isset($asyncSignals)) pcntl_async_signals($asyncSignals);
    }
    $result['ownedStorageRemoved']=$cleanup; $emit($result); fclose($log); return ['profile'=>$profile,'samples'=>$rows,'summary'=>$result];
}

if(isset($_SERVER['SCRIPT_FILENAME'])&&realpath($_SERVER['SCRIPT_FILENAME'])===__FILE__) {
    $running=false;
    try {
        if(in_array('--help',array_slice($argv,1),true)) { echo "php tools/measure-save-load.php [--rounds=12] [--interval-ms=1000]\nNew private synthetic storage only. NDJSON stdout; retain all rows and failures. Never a host/staging benchmark.\n"; exit(0); }
        $options=measurementOptions(array_slice($argv,1));
        $running=true;
        $result=runSaveMeasurement($options,static function(array $row): void { echo json_encode($row,JSON_THROW_ON_ERROR|JSON_UNESCAPED_SLASHES)."\n"; fflush(STDOUT); });
        exit($result['summary']['allIncludingInitial']['failures']===0?0:1);
    } catch(Throwable $error) { echo json_encode(['type'=>$running?'exit':'harness-error','exitCode'=>2,'class'=>get_class($error),'message'=>'Measurement failed; incomplete samples cannot pass. Inspect the local invocation and retained preceding rows.'])."\n"; exit(2); }
}
