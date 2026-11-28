<?php
declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
require_once __DIR__.'/../server/tests/Support/TestEnvironment.php';
use NetworkQuest\Tests\Support\TestEnvironment;

/** Tool-only native HTTPS to the real public entry. No caller-selected remote target. */
final class NativeMeasurementServer
{
    private TestEnvironment $transport;
    private ?int $leader = null;
    private mixed $control = null;
    private mixed $proxy = null;
    private array $proxyPipes = [];
    public string $origin;
    public string $ca;
    public int $phpWorkers = 20;

    public function __construct(TestEnvironment $game, array $config, array $roots)
    {
        if(PHP_VERSION!=='8.4.28'||!extension_loaded('pcntl')||!extension_loaded('posix')) throw new RuntimeException('Pinned PHP with pcntl/posix is required.');
        $node = TestEnvironment::nodeBinary();
        $this->transport=TestEnvironment::create();
        try {
            $openssl=$this->transport->writeFile('openssl.cnf',"[req]\ndistinguished_name=dn\nx509_extensions=server\nprompt=no\n[dn]\nCN=127.0.0.1\n[server]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n");
            $options=['config'=>$openssl,'digest_alg'=>'sha256','private_key_bits'=>2048,'private_key_type'=>OPENSSL_KEYTYPE_RSA,'x509_extensions'=>'server'];
            $key=openssl_pkey_new($options); $csr=openssl_csr_new(['commonName'=>'127.0.0.1'],$key,$options);
            $certificate=openssl_csr_sign($csr,null,$key,1,$options,random_int(1,PHP_INT_MAX));
            if($certificate===false||!openssl_pkey_export($key,$keyPem,null,$options)||!openssl_x509_export($certificate,$certPem)) throw new RuntimeException('Certificate creation failed.');
            $this->ca=$this->transport->writeFile('certificate.pem',$certPem);
            $keyFile=$this->transport->writeFile('key.pem',$keyPem);
            $configuration=$game->writeFile('measurement-configuration.json',json_encode($config,JSON_THROW_ON_ERROR));
            $listener=stream_socket_server('tcp://127.0.0.1:0',$errno,$error);
            if($listener===false) throw new RuntimeException('Port reservation failed.');
            $address=stream_socket_get_name($listener,false); fclose($listener);
            $port=(int)substr($address,strrpos($address,':')+1); $token=bin2hex(random_bytes(32));
            $pair=stream_socket_pair(STREAM_PF_UNIX,STREAM_SOCK_STREAM,STREAM_IPPROTO_IP);
            if($pair===false) throw new RuntimeException('Supervisor channel failed.');
            $pid=pcntl_fork();
            if($pid<0) { fclose($pair[0]); fclose($pair[1]); throw new RuntimeException('Supervisor fork failed.'); }
            if($pid===0) {
                // The supervisor deliberately remains the group leader until killed
                // and reaped by its parent. A recycled/stale PGID is never signaled.
                fclose($pair[0]);
                if(posix_setsid()===-1) { fwrite($pair[1],"FAILED\n"); exit(1); }
                pcntl_async_signals(true); pcntl_signal(SIGTERM,static function(): void {});
                $env=['LANG'=>'C','LC_ALL'=>'C','TMPDIR'=>$this->transport->directory(),
                    'PHP_CLI_SERVER_WORKERS'=>(string)$this->phpWorkers,'NQ_ENVIRONMENT'=>'local','NQ_DEV_PROXY_TOKEN'=>$token,
                    'NQ_CONFIG_FILE'=>$configuration,'NQ_DOCUMENT_ROOTS_JSON'=>json_encode($roots,JSON_THROW_ON_ERROR)];
                $process=proc_open([PHP_BINARY,'-d','auto_prepend_file=','-d','auto_append_file=','-d','display_errors=0','-d','log_errors=0',
                    '-d','expose_php=0','-d','session.auto_start=0','-S','127.0.0.1:'.$port,'-t',dirname(__DIR__).'/server/public',dirname(__DIR__).'/server/public/index.php'],
                    [0=>['file','/dev/null','r'],1=>['file','/dev/null','w'],2=>['file','/dev/null','w']],$unused,$this->transport->directory(),$env);
                fwrite($pair[1],is_resource($process)?"READY\n":"FAILED\n"); fflush($pair[1]);
                while(true) {
                    // Parent death closes the socket: stop our owned group too.
                    $read=[$pair[1]]; $write=$except=[];
                    // TERM intentionally interrupts select during group cleanup.
                    // Suppress that known EINTR warning in this quiet supervisor.
                    if(@stream_select($read,$write,$except,1)>0 && fread($pair[1],1)==='') {
                        posix_kill(-posix_getpid(),SIGTERM); usleep(250000); posix_kill(-posix_getpid(),SIGKILL);
                    }
                }
            }
            fclose($pair[1]); $this->leader=$pid; $this->control=$pair[0]; stream_set_timeout($this->control,5);
            if(fgets($this->control)!=="READY\n" || posix_getpgid($pid)!==$pid) throw new RuntimeException('Owned worker group did not start.');
            $ready=false;
            for($attempt=0;$attempt<100;$attempt++) {
                $socket=@stream_socket_client('tcp://127.0.0.1:'.$port,$errno,$error,0.05);
                if($socket!==false) { fclose($socket); $ready=true; break; } usleep(20000);
            }
            if(!$ready) throw new RuntimeException('PHP listener startup timed out.');
            $this->proxy=proc_open([$node,dirname(__DIR__).'/server/tests/Support/https-proxy.mjs',$this->ca,$keyFile,(string)$port],
                [0=>['file','/dev/null','r'],1=>['pipe','w'],2=>['file','/dev/null','w']],$this->proxyPipes,$this->transport->directory(),['LANG'=>'C','LC_ALL'=>'C','NQ_PROXY_TOKEN'=>$token]);
            if(!is_resource($this->proxy)) throw new RuntimeException('TLS proxy failed.');
            stream_set_timeout($this->proxyPipes[1],5);
            $line=fgets($this->proxyPipes[1]); $origin=is_string($line)?json_decode($line,true):null;
            if(!preg_match('~^https://127\.0\.0\.1:[1-9][0-9]{0,4}$~D',$origin['origin']??'')) throw new RuntimeException('TLS startup timed out.');
            $this->origin=$origin['origin']; $config['origin']=$this->origin;
            foreach(['google','github'] as $provider) $config[$provider.'Callback']=$this->origin.NetworkQuest\Router::API_BASE.'/auth/'.$provider.'/callback';
            // Existing private owned inode; never replace/adopt a path from input.
            if(file_put_contents($configuration,json_encode($config,JSON_THROW_ON_ERROR))===false) throw new RuntimeException('Configuration update failed.');
        } catch(Throwable $error) { $this->stop(); throw $error; }
    }

    public function stop(): void
    {
        if(is_resource($this->proxy)) {
            if(proc_get_status($this->proxy)['running']) proc_terminate($this->proxy);
            for($i=0;$i<100&&proc_get_status($this->proxy)['running'];$i++) usleep(10000);
            if(proc_get_status($this->proxy)['running']) proc_terminate($this->proxy,9);
            proc_close($this->proxy); $this->proxy=null;
        }
        foreach($this->proxyPipes as $pipe) if(is_resource($pipe)) fclose($pipe); $this->proxyPipes=[];
        if($this->leader!==null) {
            $pid=$this->leader; $wait=pcntl_waitpid($pid,$status,WNOHANG);
            if($wait===0) {
                if(posix_getpgid($pid)!==$pid) { posix_kill($pid,SIGKILL); pcntl_waitpid($pid,$status); throw new RuntimeException('Supervisor group identity changed.'); }
                posix_kill(-$pid,SIGTERM); usleep(250000);
                // Supervisor ignores TERM and remains alive; this cannot target a
                // later process group. SIGKILL also covers any stuck PHP children.
                if(pcntl_waitpid($pid,$status,WNOHANG)===0 && posix_getpgid($pid)===$pid) { posix_kill(-$pid,SIGKILL); pcntl_waitpid($pid,$status); }
            }
            $this->leader=null;
        }
        if(is_resource($this->control)) fclose($this->control); $this->control=null;
        $this->transport->close();
    }

    public function __destruct()
    {
        // Normal exception/unwind cleanup; signal handling is installed by the
        // owning harness. The supervisor's EOF path covers owner process death.
        if($this->leader!==null || is_resource($this->proxy)) $this->stop();
    }
}
