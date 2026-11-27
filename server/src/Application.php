<?php

declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;
use NetworkQuest\Identity\AuthTransactions;
use NetworkQuest\Identity\Google;
use NetworkQuest\Identity\GitHub;
use NetworkQuest\Routes\Auth;
use NetworkQuest\Routes\Save;
use NetworkQuest\Routes\Preferences;
use NetworkQuest\Routes\Account;
use NetworkQuest\Routes\DeletionStatus;
use Throwable;

require_once __DIR__.'/../vendor/autoload.php';
foreach (['Router','Configuration','HttpRequest','Database','Security','Sessions','AccountAccess','DeletionLedger','RecoveryAccountAccess','AccountDeletion','DeletionReceipts',
    'Identity/AuthTransactions','Identity/ProviderHttp','Identity/Google','Identity/GitHub','SaveValidator','SaveRepository',
    'Routes/Auth','Routes/Save','Routes/Preferences','Routes/Account','Routes/DeletionStatus'] as $source) require_once __DIR__.'/'.$source.'.php';

/** Explicit production composition. No migrations, provisioners, fake identities or HTTP test handlers. */
final class Application
{
    private ?Router $router = null;
    private function __construct(private readonly Configuration $configuration, private readonly array $documentRoots,
        private readonly array $routing, private readonly ?string $proxyToken) {}

    public static function fromEnvironment(array $environment): self
    {
        // Existing environment guard denies even false/empty test/fixture/bypass toggles.
        $routeEnvironment=$environment;
        unset($routeEnvironment['NQ_CONFIG_FILE'],$routeEnvironment['NQ_DOCUMENT_ROOTS_JSON']);
        Router::fromEnvironment($routeEnvironment);
        $file=$environment['NQ_CONFIG_FILE'] ?? null; $rawRoots=$environment['NQ_DOCUMENT_ROOTS_JSON'] ?? null;
        if (!is_string($file) || !is_string($rawRoots) || strlen($rawRoots)>16384) throw new InvalidArgumentException('Explicit private configuration and document roots are required.');
        try { $roots=json_decode($rawRoots,true,4,JSON_THROW_ON_ERROR); }
        catch (\JsonException) { throw new InvalidArgumentException('Explicit private document roots are invalid.'); }
        if (!is_array($roots) || count($roots)>32) throw new InvalidArgumentException('Explicit private document roots are invalid.');
        $config=Configuration::load($file,$roots);
        if ((isset($environment['NQ_GAME_BASE']) && $environment['NQ_GAME_BASE']!==$config->gamePath)
            || (isset($environment['NQ_API_BASE']) && $environment['NQ_API_BASE']!==$config->apiPath)) throw new InvalidArgumentException('Routing and private configuration disagree.');
        $routing=['environment'=>$environment['NQ_ENVIRONMENT'] ?? 'production','game_base'=>$config->gamePath,'api_base'=>$config->apiPath];
        $proxy=$environment['NQ_DEV_PROXY_TOKEN'] ?? null;
        if ($proxy!==null) $routing['proxy_token']=$proxy;
        new Router($routing);
        return new self($config,$roots,$routing,$proxy);
    }

    /** The entry supplies PHP_SAPI/getallheaders/$_SERVER directly; caller cannot choose these over HTTP. */
    public function handleSapi(array $server,array $headers,mixed $body,string $sapi=PHP_SAPI): array
    {
        try {
            // Early TLS/token/known-path/method admission can answer without opening storage.
            $preflight=(new Router($this->routing))->handleServer($server);
            if ($preflight['status']!==503) return $this->response($preflight,$server);
            $fields=(new HttpRequest($this->configuration->origin,$this->proxyToken))->fields($server,$headers,$sapi);
            return $this->response($this->services()->handleServer($server,$fields,$body),$server);
        } catch (Throwable $error) {
            return $this->response(Security::problem($error),$server);
        }
    }

    private function response(array $response,array $server): array
    {
        $response['headers']['X-Robots-Tag']='noindex, nofollow';
        $path=explode('?',is_string($server['REQUEST_URI'] ?? null) ? $server['REQUEST_URI'] : '',2)[0];
        if (($server['REQUEST_METHOD'] ?? null)==='GET' && in_array($path,[$this->configuration->apiPath.'/auth/google/callback',
            $this->configuration->apiPath.'/auth/github/callback'],true)
            && !str_starts_with($response['headers']['Content-Type'] ?? '', 'text/html')) {
            $response['headers']['Content-Type']='text/html; charset=utf-8';
            $response['body']='<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sign-in unavailable — Network Quest</title><main><h1>Sign-in could not be completed</h1><p>Return to your game tab to check your account status.</p></main></html>';
        }
        return $response;
    }

    private function services(): Router
    {
        if ($this->router!==null) return $this->router;
        $config=$this->configuration;
        // Database::open can create empty files for explicit setup callers. Requests cannot.
        clearstatcache(true,$config->databasePath); $metadata=@lstat($config->databasePath);
        if ($metadata===false || $metadata['size']===0) throw new RequestRejected('unavailable');
        $database=Database::open($config->databasePath,$this->documentRoots);
        $expected=[];
        foreach ([1=>'001_game.sql',2=>'002_delete_reauth.sql'] as $version=>$file) $expected[]=['version'=>$version,'checksum'=>hash_file('sha256',__DIR__.'/../migrations/'.$file)];
        if ($database->connection()->query('SELECT version,checksum FROM schema_migrations ORDER BY version')->fetchAll()!==$expected) throw new RequestRejected('unavailable');
        $ledger=DeletionLedger::open($config->ledgerFile,$this->documentRoots,$config->rollbackRoots,
            new DeletionRetentionPolicy($config->backupSeconds,$config->restorationSeconds,$config->retentionEvidence));
        $access=new RecoveryAccountAccess($database,$ledger);
        $sessions=new Sessions($database,null,$config->gamePath);
        $security=new Security($database,$config->origin,$config->rateKey);
        $transactions=new AuthTransactions($database,$sessions,$access);
        $google=new Google($transactions,$config->googleClientId,$config->googleClientSecret,$config->googleCallback);
        $github=new GitHub($transactions,$config->githubClientId,$config->githubClientSecret,$config->githubCallback);
        $auth=new Auth($database,$sessions,$security,$google,$github,$access,$config->origin);
        // Packaged authored policy only; no operator/request/test fixture selects content.
        $policy=json_decode(file_get_contents(__DIR__.'/../content/save-policy.generated.json'),false,64,JSON_THROW_ON_ERROR);
        if (($policy->formatVersion ?? null)!==1 || ($policy->scope ?? null)!=='authored-first-copper-route' || !is_array($policy->policies ?? null)) throw new RequestRejected('unavailable');
        $repository=new SaveRepository($database,$sessions,$security,new SaveValidator($policy->policies),
            [['saveSchemaVersion'=>1,'contentVersion'=>'1.0.0']],$access,route:$config->apiPath.'/save');
        return $this->router=new Router($this->routing,$auth,new Save($database,$sessions,$security,$repository,$access),
            new Preferences($database,$sessions,$security,$access),
            new Account($database,$sessions,$security,$access,new AccountDeletion($database,$sessions,$security,$access,$ledger)),
            new DeletionStatus(new DeletionReceipts($ledger,$security)));
    }
}
