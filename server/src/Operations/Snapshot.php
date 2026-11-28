<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

use NetworkQuest\Database;
use NetworkQuest\SaveValidator;
use PDO;

final class Snapshot
{
    private static function migrations(string $kind): array
    {
        $server = dirname(__DIR__, 2);
        $files = $kind === 'game' ? ['migrations/001_game.sql', 'migrations/002_delete_reauth.sql'] : ['recovery/001_ledger.sql'];
        return array_map(fn ($file) => file_get_contents($server . '/' . $file), $files);
    }

    public static function checkSchema(Database $db, string $kind): void
    {
        $pdo = $db->connection();
        $empty = new PDO('sqlite::memory:');
        $versions = [];
        foreach (self::migrations($kind) as $i => $sql) {
            $empty->exec($sql);
            $versions[] = ['version' => $i + 1, 'checksum' => hash('sha256', $sql)];
        }
        $schema = "SELECT type,name,tbl_name,sql FROM sqlite_master WHERE name NOT GLOB 'sqlite_*' ORDER BY type,name";
        PrivatePaths::check($pdo->query($schema)->fetchAll(PDO::FETCH_ASSOC) === $empty->query($schema)->fetchAll(PDO::FETCH_ASSOC)
            && $pdo->query('SELECT version,checksum FROM schema_migrations ORDER BY version')->fetchAll() === $versions);
    }

    public static function checkStructure(Database $db, string $kind): void
    {
        self::checkSchema($db, $kind);
        $pdo = $db->connection();
        PrivatePaths::check($pdo->query('PRAGMA integrity_check')->fetchAll(PDO::FETCH_COLUMN) === ['ok']
            && $pdo->query('PRAGMA foreign_key_check')->fetch() === false);
    }

    public static function validate(Database $db, string $kind, Settings $settings): void
    {
        self::checkStructure($db, $kind);
        $pdo = $db->connection();
        if ($kind === 'ledger') {
            $policy = $settings->policy;
            PrivatePaths::check($pdo->query('SELECT * FROM retention_policy')->fetchAll() === [[
                'singleton'=>1, 'backup_seconds'=>$policy->backupSeconds,'restoration_seconds'=>$policy->restorationSeconds,
                'evidence_reference'=>$policy->evidenceReference
            ]]);
            $min = $pdo->prepare('SELECT 1 FROM deletion_markers WHERE retain_until < intent_at + ? LIMIT 1');
            $min->execute([$policy->backupSeconds + $policy->restorationSeconds]);
            PrivatePaths::check($min->fetch() === false);
            return;
        }
        PrivatePaths::check($pdo->query('SELECT 1 FROM accounts a LEFT JOIN preferences p ON p.account_id=a.id
            LEFT JOIN identities i ON i.account_id=a.id WHERE p.account_id IS NULL OR i.account_id IS NULL LIMIT 1')->fetch() === false);
        PrivatePaths::check($pdo->query('SELECT 1 FROM write_receipts r LEFT JOIN saves s USING(account_id)
            WHERE s.account_id IS NULL OR r.committed_revision>s.revision LIMIT 1')->fetch() === false);
        $validator = null;
        foreach ($pdo->query('SELECT * FROM saves') as $slot) {
            $summary = json_decode($slot['summary_json'], true, 8, JSON_THROW_ON_ERROR);
            PrivatePaths::check(hash_equals($slot['payload_hash'], hash('sha256', $slot['payload_json']))
                && is_string($summary['episodeId'] ?? null) && is_string($summary['roomId'] ?? null)
                && array_key_exists('outcome', $summary) && in_array($summary['outcome'], [null, 'E01','E02'], true));
            // Only known readers interpret fields inside the snapshot. Preserve unfamiliar versions byte-for-byte.
            if ($slot['schema_version'] === 1 && in_array($slot['content_version'], ['0.9.1','1.0.0'], true)) {
                $validator ??= new SaveValidator([]);
                PrivatePaths::check($validator->validateStructure($slot['payload_json'])->ok);
                $body = json_decode($slot['payload_json'], true, SaveValidator::MAX_JSON_DEPTH, JSON_THROW_ON_ERROR);
                PrivatePaths::check(($body['saveSchemaVersion'] ?? null) === 1 && ($body['contentVersion'] ?? null) === $slot['content_version']
                    && ($body['adventureId'] ?? null) === $slot['adventure_id'] && ($body['episodeId'] ?? null) === $summary['episodeId']
                    && ($body['world']['roomId'] ?? null) === $summary['roomId']
                    && ($body['world']['continueOutcome'] ?? null) === $summary['outcome']);
            }
        }
    }

    /** Compare complete rows for all durable acknowledged state under the account barrier. */
    public static function matchesCurrent(Database $current, Database $candidate, array $markers, int $now): void
    {
        $deleted = array_fill_keys(array_column($markers, 'accountId'), true);
        foreach (['accounts' => 'id', 'identities' => 'account_id', 'preferences' => 'account_id',
            'saves' => 'account_id', 'write_receipts' => 'account_id,request_id'] as $table => $order) {
            $where = $table === 'write_receipts' ? ' WHERE expires_at > ' . $now : '';
            $sql = 'SELECT * FROM ' . $table . $where . ' ORDER BY ' . $order;
            $old = $candidate->connection()->query($sql);
            foreach ($current->connection()->query($sql) as $live) {
                $account = $table === 'accounts' ? $live['id'] : $live['account_id'];
                if (isset($deleted[$account])) continue;
                PrivatePaths::check($old->fetch() === $live);
            }
            PrivatePaths::check($old->fetch() === false);
        }
    }
}
