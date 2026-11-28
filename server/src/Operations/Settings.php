<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

use NetworkQuest\DeletionLedger;
use NetworkQuest\DeletionRetentionPolicy;
use NetworkQuest\Database;

final readonly class Settings
{
    private function __construct(public array $v, public array $docs, public DeletionRetentionPolicy $policy) {}

    public static function load(string $path, mixed $rootJson, string $operation): self
    {
        PrivatePaths::check(is_string($rootJson) && strlen($rootJson) <= 16384);
        $docs = json_decode($rootJson, true, 4, JSON_THROW_ON_ERROR);
        PrivatePaths::check(is_array($docs) && array_is_list($docs) && count($docs) >= 1 && count($docs) <= 32);
        foreach ($docs as $dir) PrivatePaths::directory($dir, false);
        PrivatePaths::outside($path, $docs);
        $raw = PrivatePaths::readSmall($path, 16384);
        $v = json_decode($raw, true, 4, JSON_THROW_ON_ERROR);
        // This flat object admits only scalar values and one list of paths. Count
        // member tokens on valid JSON to reject repeated keys, including escaped ones.
        preg_match_all('/"(?:[^"\\\\]|\\\\.)*"/s', $raw, $tokens, PREG_OFFSET_CAPTURE);
        $members = 0;
        foreach ($tokens[0] as [$token, $offset]) {
            if (str_starts_with(ltrim(substr($raw, $offset + strlen($token))), ':')) ++$members;
        }
        PrivatePaths::check(is_array($v) && $members === count($v));
        $keys = ['databasePath','ledgerFile','rollbackRoots','backupSeconds','restorationSeconds','retentionEvidence',
            'archiveDir','ledgerArchiveDir','keyFile','ledgerKeyFile','restoreDir'];
        PrivatePaths::check(is_array($v) && array_diff($keys, array_keys($v)) === []
            && array_diff(array_keys($v), $keys, ['logDir']) === []);
        $roots = $v['rollbackRoots'];
        PrivatePaths::check(is_array($roots) && array_is_list($roots) && count($roots) >= 1 && count($roots) <= 32);
        $isolated = in_array($operation, ['disaster','ledger-inspect'], true);
        foreach ($roots as $dir) {
            PrivatePaths::canonical($dir);
            if (!$isolated || is_dir($dir)) PrivatePaths::directory($dir, false);
        }
        $dirs = [dirname($v['databasePath']), dirname($v['ledgerFile']), $v['archiveDir'], $v['ledgerArchiveDir'], $v['restoreDir']];
        if (isset($v['logDir'])) $dirs[] = $v['logDir'];
        $required = match ($operation) {
            'ledger-inspect' => [$v['ledgerArchiveDir'], $v['restoreDir']],
            'disaster' => [$v['archiveDir'], dirname($v['ledgerFile']), $v['restoreDir']],
            default => $dirs
        };
        foreach ($dirs as $i => $dir) {
            PrivatePaths::canonical($dir);
            if (in_array($dir, $required, true)) PrivatePaths::directory($dir);
            PrivatePaths::outside($dir, $docs);
            foreach ($dirs as $j => $other) if ($i !== $j) PrivatePaths::outside($dir, [$other]);
        }
        foreach (['databasePath','ledgerFile','keyFile','ledgerKeyFile'] as $field) PrivatePaths::canonical($v[$field]);
        foreach (['databasePath','ledgerFile'] as $field) PrivatePaths::check(!str_starts_with(basename($v[$field]), '.nq-'));
        foreach ([$v['databasePath'], $v['archiveDir']] as $gamePath)
            PrivatePaths::check(array_any($roots, fn ($root) => PrivatePaths::within($gamePath, $root)));
        foreach ([$path, $v['ledgerFile'], $v['ledgerArchiveDir'], $v['restoreDir'], $v['keyFile'], $v['ledgerKeyFile']] as $file)
            PrivatePaths::outside($file, array_merge($roots, $docs));
        foreach ([$path, $v['keyFile'], $v['ledgerKeyFile']] as $file) PrivatePaths::outside($file, $dirs);
        PrivatePaths::check(count(array_unique([$path, $v['keyFile'], $v['ledgerKeyFile']])) === 3);
        PrivatePaths::check($v['backupSeconds'] >= 604800);
        $policy = new DeletionRetentionPolicy($v['backupSeconds'], $v['restorationSeconds'], $v['retentionEvidence']);
        return new self($v, $docs, $policy);
    }

    public function ledger(): DeletionLedger
    {
        // All declared roots were excluded lexically at configuration admission. A
        // lost game volume need not be recreated to consult the independent ledger.
        $existing = array_values(array_filter($this->v['rollbackRoots'], is_dir(...)));
        return DeletionLedger::open($this->v['ledgerFile'], $this->docs, $existing, $this->policy);
    }

    public function game(): Database
    {
        PrivatePaths::check(PrivatePaths::file($this->v['databasePath'])['size'] > 0);
        return Database::open($this->v['databasePath'], $this->docs);
    }

    public function archiveDir(string $kind): string
    {
        return $kind === 'game' ? $this->v['archiveDir'] : $this->v['ledgerArchiveDir'];
    }

    public function key(string $kind): string
    {
        $key = PrivatePaths::readSmall($this->v[$kind === 'game' ? 'keyFile' : 'ledgerKeyFile'], 32);
        PrivatePaths::check(strlen($key) === 32);
        return $key;
    }

    public function verifySeparateKeys(): void
    {
        PrivatePaths::check(!hash_equals($this->key('game'), $this->key('ledger')));
    }
}
