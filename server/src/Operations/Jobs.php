<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

use NetworkQuest\Database;
use PDO;

final readonly class Jobs
{
    public function __construct(private Settings $settings) {}

    /** One operational writer covers verification, directory promotion, rotation and orphan cleanup. */
    public function run(callable $job, string $operation): array
    {
        $v = $this->settings->v;
        $dirs = match ($operation) {
            'game' => [$v['restoreDir'], $v['archiveDir']],
            'ledger' => [dirname($v['ledgerFile']), $v['ledgerArchiveDir']],
            'disaster','rollback','ledger-inspect' => [$v['restoreDir']],
            default => []
        };
        sort($dirs);
        $locks = [];
        try {
            foreach ($dirs as $dir) {
                $path = $dir . '/.nq-operations.lock';
                clearstatcache(true, $path);
                if (@lstat($path) === false) {
                    $created = @fopen($path, 'xb');
                    if ($created !== false) fclose($created);
                }
                PrivatePaths::file($path);
                $lock = fopen($path, 'rb');
                $locks[] = $lock;
                PrivatePaths::check(flock($lock, LOCK_EX | LOCK_NB));
            }
            $this->clearInterrupted($dirs);
            try { return $job(); } finally { $this->clearInterrupted($dirs); }
        } finally {
            foreach ($locks as $lock) fclose($lock);
        }
    }

    private function clearInterrupted(array $dirs): void
    {
        foreach ($dirs as $dir) {
            foreach (scandir($dir) as $name) {
                if (!preg_match('/^\.nq-work-[0-9a-f]{24}(?:-journal)?$/D', $name)) continue;
                $path = $dir . '/' . $name;
                $st = lstat($path);
                PrivatePaths::check(($st['mode'] & 0177777) === 0100600 && $st['uid'] === fileowner($dir) && unlink($path));
            }
        }
    }

    private function temporary(string $dir): string
    {
        return $dir . '/.nq-work-' . bin2hex(random_bytes(12));
    }

    public function backup(string $kind): array
    {
        $v = $this->settings->v;
        $this->settings->verifySeparateKeys();
        $ledger = $this->settings->ledger();
        $stage = $this->temporary($kind === 'game' ? $v['restoreDir'] : dirname($v['ledgerFile']));
        $source = $kind === 'game' ? $this->settings->game() : Database::open($v['ledgerFile'], $this->settings->docs);
        $capture = static function () use ($source, $stage): int {
            $now = time();
            $source->connection()->prepare('VACUUM INTO ?')->execute([$stage]);
            return $now;
        };
        // The game snapshot is a single SQLite read point. A concurrent deletion
        // is covered on either side by the separately authoritative live ledger.
        $captured = $kind === 'ledger' ? $ledger->exclusive($capture) : $capture();
        $snapshot = Database::open($stage, $this->settings->docs);
        Snapshot::validate($snapshot, $kind, $this->settings);
        unset($snapshot);
        $dir = $this->settings->archiveDir($kind);
        $name = 'nq-' . $kind . '-' . $captured . '-' . bin2hex(random_bytes(12)) . '.nqb';
        $cipher = $this->temporary($dir);
        $key = $this->settings->key($kind);
        Archive::seal($stage, $cipher, $name, $key);
        PrivatePaths::check(hash_equals(hash_file('sha256', $stage), Archive::unseal($cipher, $name, $key)));
        $this->promote($cipher, $dir . '/' . $name);
        $this->rotate($kind, $captured);
        return ['archive' => $name, 'capturedAt' => $captured];
    }

    private function promote(string $source, string $destination): void
    {
        // link is atomic and refuses an existing destination. Both names are in the same filesystem.
        PrivatePaths::check(link($source, $destination));
        PrivatePaths::check(unlink($source));
        PrivatePaths::syncDirectory(dirname($destination));
    }

    private function inventory(string $kind): array
    {
        $files = [];
        foreach (scandir($this->settings->archiveDir($kind)) as $name) {
            if (!str_starts_with($name, 'nq-' . $kind . '-')) continue;
            $files[$name] = Archive::timestamp($name, $kind);
        }
        arsort($files, SORT_NUMERIC);
        return $files;
    }

    private function rotate(string $kind, int $now): void
    {
        $dir = $this->settings->archiveDir($kind);
        foreach ($this->inventory($kind) as $name => $time) {
            if ($time > $now - 604800) continue;
            PrivatePaths::file($dir . '/' . $name);
            PrivatePaths::check(unlink($dir . '/' . $name));
        }
        PrivatePaths::syncDirectory($dir);
    }

    public function status(): array
    {
        $result = [];
        $this->settings->verifySeparateKeys();
        foreach (['game', 'ledger'] as $kind) {
            $files = $this->inventory($kind);
            $name = array_key_first($files);
            PrivatePaths::check($name !== null);
            $age = time() - $files[$name];
            PrivatePaths::check($age >= 0 && $age <= 86400);
            Archive::unseal($this->settings->archiveDir($kind) . '/' . $name, $name, $this->settings->key($kind));
            $result[$kind . 'AgeSeconds'] = $age;
        }
        $ledger = $this->settings->ledger();
        $health = $ledger->exclusive(fn () => ['drained' => $ledger->drained(), 'ledgerRoomRemaining' => $ledger->remainingCapacity()]);
        PrivatePaths::check(min($health['ledgerRoomRemaining']) > 0);
        return $result + $health;
    }

    public function drain(bool $enabled): array
    {
        $ledger = $this->settings->ledger();
        $ledger->exclusive(fn () => $ledger->setDrained($enabled));
        return ['drained' => $enabled];
    }

    public function cleanup(): array
    {
        $db = $this->settings->game();
        $ledger = $this->settings->ledger();
        $ledger->exclusive(function () use ($db, $ledger): void {
            Snapshot::checkSchema($db, 'game');
            $now = time();
            $db->immediate(function (PDO $pdo) use ($now): void {
                foreach (['write_receipts', 'operational_counters', 'auth_transactions'] as $table) {
                    $pdo->prepare('DELETE FROM ' . $table . ' WHERE expires_at<=?')->execute([$now]);
                }
                // Reauth proof expiry is inclusive in AccountDeletion, unlike receipt expiry.
                $pdo->prepare('DELETE FROM delete_reauth_proofs WHERE expires_at<?')->execute([$now]);
                $pdo->prepare('DELETE FROM sessions WHERE expires_at<=? OR last_activity<=?')->execute([$now, $now - 7200]);
            });
            // Independently committed operations are safe to retry after a partial cleanup.
            $ledger->expireReceipts($now);
        });
        if (isset($this->settings->v['logDir'])) RequestLog::expire($this->settings->v['logDir'], time());
        return ['cleanup' => 'completed'];
    }

    public function restore(string $mode, string $name, string $destination): array
    {
        $v = $this->settings->v;
        $kind = $mode === 'ledger-inspect' ? 'ledger' : 'game';
        $captured = Archive::timestamp($name, $kind);
        $age = time() - $captured;
        PrivatePaths::check($age >= 0);
        if ($kind === 'game') {
            PrivatePaths::check($age <= $this->settings->policy->backupSeconds + $this->settings->policy->restorationSeconds);
        }
        PrivatePaths::canonical($destination);
        PrivatePaths::check(dirname($destination) === $v['restoreDir']
            && preg_match('/^[A-Za-z0-9][A-Za-z0-9._-]{0,100}\.sqlite$/D', basename($destination)));
        foreach (['','-journal','-wal','-shm'] as $suffix) {
            clearstatcache(true, $destination . $suffix);
            PrivatePaths::check(@lstat($destination . $suffix) === false);
        }
        $stage = $this->temporary($v['restoreDir']);
        Archive::unseal($this->settings->archiveDir($kind) . '/' . $name, $name, $this->settings->key($kind), $stage);
        $candidate = Database::open($stage, $this->settings->docs);
        if ($kind === 'ledger') {
            Snapshot::validate($candidate, $kind, $this->settings);
            $this->promote($stage, $destination);
        } else {
            Snapshot::checkStructure($candidate, 'game');
            $ledger = $this->settings->ledger();
            $ledger->exclusive(function () use ($ledger, $candidate, $mode, $stage, $destination): void {
                $now = time();
                $markers = $ledger->markers();
                $candidate->immediate(function (PDO $pdo) use ($now, $markers): void {
                    $delete = $pdo->prepare('DELETE FROM accounts WHERE id=?');
                    foreach ($markers as $marker) {
                        PrivatePaths::check($marker['intentAt'] <= $now);
                        $delete->execute([$marker['accountId']]);
                    }
                    // Revoked cookies and in-flight provider transactions must never revive after recovery.
                    $pdo->exec('DELETE FROM sessions');
                    $pdo->prepare('DELETE FROM write_receipts WHERE expires_at<=?')->execute([$now]);
                });
                Snapshot::validate($candidate, 'game', $this->settings);
                if ($mode === 'rollback') {
                    PrivatePaths::check($ledger->drained());
                    Snapshot::matchesCurrent($this->settings->game(), $candidate, $markers, $now);
                }
                $this->promote($stage, $destination);
            });
        }
        return ['capturedAt' => $captured, 'mode' => $mode];
    }
}
