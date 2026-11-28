<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

use Throwable;

require_once dirname(__DIR__) . '/Database.php';
require_once dirname(__DIR__) . '/DeletionLedger.php';
require_once dirname(__DIR__, 2) . '/vendor/autoload.php';
require_once dirname(__DIR__) . '/SaveValidator.php';
foreach (['PrivatePaths','Settings','Archive','Snapshot','RequestLog','Jobs'] as $source) require_once __DIR__ . '/' . $source . '.php';

final class Command
{
    public static function main(bool $restore, array $args): int
    {
        umask(0077);
        ini_set('display_errors', '0');
        ini_set('log_errors', '0');
        $start = hrtime(true);
        $operation = 'unknown';
        try {
            // Suppressed probes remain probes; every other warning is fatal and redacted.
            set_error_handler(static function (int $severity): bool {
                if (error_reporting() & $severity) throw new \RuntimeException('Operational I/O failed.');
                return true;
            });
            $commands = $restore ? ['disaster','rollback','ledger-inspect'] : ['game','ledger','status','cleanup','drain','resume'];
            PrivatePaths::check(count($args) === ($restore ? 5 : 3) && in_array($args[2], $commands, true));
            $operation = $args[2];
            $settings = Settings::load($args[1], getenv('NQ_DOCUMENT_ROOTS_JSON'), $operation);
            $jobs = new Jobs($settings);
            $fields = $jobs->run(fn () => match ($operation) {
                'game','ledger' => $jobs->backup($operation),
                'status' => $jobs->status(), 'cleanup' => $jobs->cleanup(),
                'drain','resume' => $jobs->drain($operation === 'drain'),
                default => $jobs->restore($operation, $args[3], $args[4])
            }, $operation);
            echo json_encode(['ok'=>true, 'operation'=>$operation, 'durationMs'=>intdiv(hrtime(true)-$start, 1000000)] + $fields, JSON_THROW_ON_ERROR) . "\n";
            return 0;
        } catch (Throwable) {
            fwrite(STDERR, json_encode(['ok'=>false,'operation'=>$operation,'reason'=>'operational-check-failed'], JSON_THROW_ON_ERROR) . "\n");
            return 1;
        } finally { restore_error_handler(); }
    }
}
