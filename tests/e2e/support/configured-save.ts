// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import type { SaveSnapshotV1 } from '../../../src/state/types';
import type { Request } from '@playwright/test';
import { localTls } from './local-tls';

// The CLI owns fresh TestEnvironment storage and seeds actual Sessions. Nothing
// in the public application accepts a test identity or configuration selector.
// All identity/configuration values below are deliberately synthetic.
const program = String.raw`
declare(strict_types=1);
require $argv[1] . '/server/vendor/autoload.php';
require $argv[1] . '/server/tests/Support/TestEnvironment.php';
require $argv[1] . '/server/src/Application.php';
use NetworkQuest\Tests\Support\TestEnvironment;
use NetworkQuest\Database;
use NetworkQuest\Sessions;
use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Router;
$game = TestEnvironment::create(); $external = TestEnvironment::create();
try {
  $game->connect(); $external->connect(); $external->writeFile('synthetic.sqlite.lock', '');
  $roots = [realpath($argv[1]), realpath($argv[1] . '/server/public')];
  $database = Database::open($game->directory() . '/synthetic.sqlite', $roots); $database->migrate();
  $ledger = DeletionLedger::initialize($external->directory() . '/synthetic.sqlite', $roots, [$game->directory()], new DeletionRetentionPolicy(2592000,604800,'T050-synthetic-only'));
  $pdo = $database->connection(); $id = '60000000-0000-4000-8000-000000000001';
  $pdo->prepare('INSERT INTO accounts(id,created_at) VALUES(?,?)')->execute([$id,time()]);
  $pdo->prepare('INSERT INTO identities(account_id,provider,subject,display_name) VALUES(?,?,?,?)')->execute([$id,'github','60001','Synthetic T050 player']);
  $pdo->prepare('INSERT INTO preferences(account_id) VALUES(?)')->execute([$id]);
  $sessions = new Sessions($database); $cookies = [];
  for ($i=0;$i<2;$i++) { $guest=$sessions->bootstrap(null); $auth=$database->immediate(fn(PDO $p)=>$sessions->rotateWithin($p,$guest['context'],$id)); $cookies[]=explode(';',$auth['setCookie'],2)[0]; }
  $config=['origin'=>'https://127.0.0.1:9999','gamePath'=>Router::GAME_BASE,'databasePath'=>$game->directory().'/synthetic.sqlite',
    'ledgerFile'=>$external->directory().'/synthetic.sqlite','rollbackRoots'=>[$game->directory()],'backupSeconds'=>2592000,'restorationSeconds'=>604800,'retentionEvidence'=>'T050-synthetic-only',
    'rateKey'=>rtrim(strtr(base64_encode(str_repeat('s',32)),'+/','-_'),'='),'googleClientId'=>'T050-synthetic-google','googleClientSecret'=>'T050-synthetic-google-private',
    'googleCallback'=>'https://127.0.0.1:9999'.Router::API_BASE.'/auth/google/callback','githubClientId'=>'T050-synthetic-github','githubClientSecret'=>'T050-synthetic-github-private',
    'githubCallback'=>'https://127.0.0.1:9999'.Router::API_BASE.'/auth/github/callback'];
  $configuration=$game->writeFile('configuration.json',json_encode($config,JSON_THROW_ON_ERROR));
  $router=$game->writeFile('browser-router.php','<?php declare(strict_types=1); $token=getenv("NQ_DEV_PROXY_TOKEN"); if(!is_string($token)||$token===""||!hash_equals($token,$_SERVER["HTTP_X_NQ_DEV_PROXY"]??"")){http_response_code(404);return;} header("Cache-Control: no-store"); header("X-Content-Type-Options: nosniff"); if($_SERVER["REQUEST_URI"]==="/__nq_dev_ready"){header("X-NQ-Dev-Ready: ".$token);http_response_code(204);return;} putenv('.var_export('NQ_CONFIG_FILE='.$configuration,true).'); putenv('.var_export('NQ_DOCUMENT_ROOTS_JSON='.json_encode($roots,JSON_THROW_ON_ERROR),true).'); require '.var_export($argv[1].'/server/public/index.php',true).';');
  echo json_encode(['router'=>$router,'cookies'=>$cookies],JSON_THROW_ON_ERROR)."\n"; fflush(STDOUT);
  while(($line=fgets(STDIN))!==false){
    $command=json_decode($line,true,512,JSON_THROW_ON_ERROR);
    if($command['kind']==='stop')break;
    if($command['kind']==='origin'){
      if(!preg_match('~^https://127\\.0\\.0\\.1:[1-9][0-9]{0,4}$~D',$command['origin']))throw new RuntimeException('Invalid test origin');
      $config['origin']=$command['origin']; foreach(['google','github'] as $provider)$config[$provider.'Callback']=$command['origin'].Router::API_BASE.'/auth/'.$provider.'/callback';
      file_put_contents($configuration,json_encode($config,JSON_THROW_ON_ERROR)); echo "{}\n";
    }elseif($command['kind']==='inspect'){
      $row=$pdo->query('SELECT revision,payload_json FROM saves')->fetch(); echo json_encode($row===false?null:['revision'=>$row['revision'],'snapshot'=>json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR)],JSON_THROW_ON_ERROR)."\n";
    }elseif($command['kind']==='unsupported'){
      $raw='{"saveSchemaVersion":99,"opaque":9007199254740993}';
      $pdo->prepare('UPDATE saves SET schema_version=99,payload_json=?,payload_hash=?')->execute([$raw,hash('sha256',$raw)]); echo "{}\n";
    }elseif($command['kind']==='inspect-account'){
      $counts=[];foreach(['accounts','identities','sessions','preferences','saves'] as $table)$counts[$table]=(int)$pdo->query('SELECT COUNT(*) FROM '.$table)->fetchColumn();
      $preference=$pdo->query('SELECT revision,autosave_enabled FROM preferences')->fetch();$counts['preference']=$preference===false?null:$preference;
      echo json_encode($counts,JSON_THROW_ON_ERROR)."\n";
    }elseif($command['kind']==='deletion-reauth'){
      // Private fixture-only same-account rotation/proof. This is NOT an OAuth
      // callback/provider test and creates no public request bypass or identity selector.
      $prior=$sessions->require($command['cookie']);if($prior->accountId!==$id)throw new RuntimeException('Wrong isolated account');
      $issued=$database->immediate(function(PDO $p)use($sessions,$prior,$id){
        $issued=$sessions->rotateWithin($p,$prior,$id);$now=time();
        $p->prepare('INSERT INTO delete_reauth_proofs(session_hash,account_id,confirmed_at,expires_at) VALUES(?,?,?,?)')->execute([$issued['context']->idHash,$id,$now,$now+300]);
        return $issued;
      });echo json_encode(['cookie'=>explode(';',$issued['setCookie'],2)[0]],JSON_THROW_ON_ERROR)."\n";
    }elseif($command['kind']==='synthetic-session'){
      // T056 private CLI setup only. Provider identity is never accepted by a route.
      $provider=$command['provider'];if(!in_array($provider,['github','google'],true))throw new RuntimeException('Invalid synthetic provider');
      $account=$provider==='github'?$id:'60000000-0000-4000-8000-000000000002';
      $database->immediate(function(PDO $p)use($account,$provider){
        $p->prepare('INSERT OR IGNORE INTO accounts(id,created_at) VALUES(?,?)')->execute([$account,time()]);
        $p->prepare('INSERT OR IGNORE INTO identities(account_id,provider,subject,display_name) VALUES(?,?,?,?)')->execute([$account,$provider,$provider==='github'?'60001':'60002',$provider==='github'?'Synthetic T050 player':'Synthetic T056 Google player']);
        $p->prepare('INSERT OR IGNORE INTO preferences(account_id) VALUES(?)')->execute([$account]);
      });
      $guest=$sessions->bootstrap(null);$auth=$database->immediate(fn(PDO $p)=>$sessions->rotateWithin($p,$guest['context'],$account));
      echo json_encode(['cookie'=>explode(';',$auth['setCookie'],2)[0]],JSON_THROW_ON_ERROR)."\n";
    }elseif($command['kind']==='expire-session'){
      $prior=$sessions->require($command['cookie']);
      $database->immediate(function(PDO $p)use($prior){
        $p->prepare('UPDATE sessions SET created_at=created_at-86401,last_activity=last_activity-86401,expires_at=expires_at-86401,auth_time=auth_time-86401 WHERE id_hash=?')->execute([$prior->idHash]);
      });echo "{}\n";
    }elseif($command['kind']==='stored-content'){
      // Unsupported historical input is written privately; GET must preserve exact bytes.
      $row=$pdo->query('SELECT payload_json,summary_json FROM saves WHERE account_id="60000000-0000-4000-8000-000000000001"')->fetch();
      if($row===false)throw new RuntimeException('Create the actual slot before changing stored content');
      $snapshot=json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR);$summary=json_decode($row['summary_json'],true,512,JSON_THROW_ON_ERROR);
      $snapshot['contentVersion']=$command['version'];$summary['contentVersion']=$command['version'];
      $raw=" ".json_encode($snapshot,JSON_THROW_ON_ERROR)."\n";
      $pdo->prepare('UPDATE saves SET content_version=?,payload_json=?,payload_hash=?,summary_json=? WHERE account_id=?')->execute([$command['version'],$raw,hash('sha256',$raw),json_encode($summary,JSON_THROW_ON_ERROR),$id]);echo "{}\n";
    }elseif($command['kind']==='inspect-slot'){
      $account=$command['provider']==='google'?'60000000-0000-4000-8000-000000000002':$id;
      $query=$pdo->prepare('SELECT revision,payload_json FROM saves WHERE account_id=?');$query->execute([$account]);$row=$query->fetch();$query->closeCursor();unset($query);
      echo json_encode($row===false?null:['revision'=>$row['revision'],'raw'=>$row['payload_json'],'snapshot'=>json_decode($row['payload_json'],true,512,JSON_THROW_ON_ERROR)],JSON_THROW_ON_ERROR)."\n";
    }elseif($command['kind']==='prepared-deletion'){
      // Simulate a crash after durable intent, or an old expired completed receipt.
      // This is prepared ledger evidence, not a live DELETE/crash-recovery acceptance.
      $expired=$command['expired'];$now=time()-($expired?86401:0);$hash=hash('sha256',$command['receipt']);
      $ledger->exclusive(function()use($ledger,$database,$id,$hash,$now,$expired){
        $ledger->accept($id,$hash,$now);
        if($expired){$database->immediate(fn(PDO $p)=>$p->prepare('DELETE FROM accounts WHERE id=?')->execute([$id]));$ledger->complete($id,$now);}
      });echo "{}\n";
    }else throw new RuntimeException('Unknown test command');
    fflush(STDOUT);
  }
} finally { unset($sessions,$pdo,$database,$ledger); $external->close(); $game->close(); }
`;

export async function configuredSave() {
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const child = spawn(process.env['NQ_PHP_BIN'] ?? 'php', ['-d', 'display_errors=stderr', '-d', 'auto_prepend_file=', '-d', 'auto_append_file=', '-r', program, root], {
    env: { PATH: process.env['PATH'] ?? '', LANG: 'C', LC_ALL: 'C' }, stdio: ['pipe', 'pipe', 'pipe'],
  });
  let diagnostic = '';
  child.stderr.on('data', (chunk: Buffer) => { diagnostic += chunk.toString(); });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  const receive = async () => {
    const result = await lines.next();
    if (result.done) throw new Error(`Isolated save fixture stopped: ${diagnostic.slice(0, 600)}`);
    return JSON.parse(result.value) as unknown;
  };
  let local: Awaited<ReturnType<typeof localTls>> | undefined;
  const stop = async () => {
    await local?.stop();
    if (child.exitCode === null) {
      const exited = once(child, 'exit'); child.stdin.end('{"kind":"stop"}\n');
      const timer = setTimeout(() => child.kill('SIGKILL'), 5000);
      try { await exited; } finally { clearTimeout(timer); }
    }
    if (child.exitCode !== 0 || diagnostic) throw new Error(`Isolated save fixture cleanup failed: ${diagnostic.slice(0, 600)}`);
  };
  const command = async (value: object) => { child.stdin.write(JSON.stringify(value) + '\n'); return receive(); };
  try {
    const ready = await receive() as { router: string; cookies: string[] };
    local = await localTls({ probeRouter: ready.router }); await command({ kind: 'origin', origin: local.origin });
    const fixture = { ...local, stop, cookies: ready.cookies,
      /** Send the intercepted native request to the real service, trusting only
       * this fixture's disposable CA, then let the test drop its response. */
      forwardNative: async (native: Request): Promise<{ status: number; body: string; headers: Record<string, string> }> => {
        const path = native.url().slice(local!.origin.length);
        if (!native.url().startsWith(local!.origin + '/') || ![
          ['PUT', '/arcade/play/network-quest/api/v1/save'], ['DELETE', '/arcade/play/network-quest/api/v1/account'], ['POST', '/arcade/play/network-quest/api/v1/logout'], ['POST', '/arcade/play/network-quest/api/v1/account/deletion-status'],
        ].some(([method, route]) => native.method() === method && path === route)) throw new Error('Expected this fixture save/account mutation');
        const ca = await readFile(local!.directory + '/ca.pem'), headers = await native.allHeaders();
        return new Promise((resolve, reject) => {
          const upstream = request(native.url(), { method: native.method(), headers, ca, rejectUnauthorized: true }, reply => {
            const chunks: Buffer[] = []; let received = 0; reply.on('data', chunk => {
              received += chunk.length; if (received > 65536) { upstream.destroy(new Error('Isolated mutation response exceeded its bound')); return; } chunks.push(Buffer.from(chunk));
            });
            reply.once('end', () => resolve({ status: reply.statusCode!, body: Buffer.concat(chunks).toString('utf8'), headers: Object.fromEntries(Object.entries(reply.headers).filter((entry): entry is [string, string] => typeof entry[1] === 'string')) })); reply.once('error', reject);
          });
          upstream.setTimeout(5000, () => upstream.destroy(new Error('Isolated committed-write check timed out')));
          upstream.once('error', reject); upstream.end(native.postDataBuffer());
        });
      },
      inspect: () => command({ kind: 'inspect' }) as Promise<null | { revision: number; snapshot: { adventureId: string; notebook: { personalNotes: string } } }>,
      unsupported: () => command({ kind: 'unsupported' }),
      inspectAccount: () => command({ kind: 'inspect-account' }) as Promise<{ accounts: number; identities: number; sessions: number; preferences: number; saves: number;
        preference: null | { revision: number; autosave_enabled: number } }>,
      syntheticSession: (provider: 'github' | 'google') => command({ kind: 'synthetic-session', provider }) as Promise<{ cookie: string }>,
      expireSession: (cookie: string) => command({ kind: 'expire-session', cookie }),
      storedContent: (version: string) => command({ kind: 'stored-content', version }),
      inspectSlot: (provider: 'github' | 'google' = 'github') => command({ kind: 'inspect-slot', provider }) as Promise<null | { revision: number; raw: string; snapshot: SaveSnapshotV1 }>,
      prepareDeletion: (receipt: string, expired = false) => command({ kind: 'prepared-deletion', receipt, expired }),
      completeDeletionReauth: (cookie: string) => command({ kind: 'deletion-reauth', cookie }) as Promise<{ cookie: string }>,
    };
    return { ...fixture, commitAndLoseResponse: async (native: Request) => (await fixture.forwardNative(native)).status };
  } catch (error) { await stop(); throw error; }
}
