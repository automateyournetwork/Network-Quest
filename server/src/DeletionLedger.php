<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;
use LogicException;
use PDO;
use RuntimeException;

/** Required reviewed input, never an inferred host retention or production readiness claim. */
final readonly class DeletionRetentionPolicy
{
    public function __construct(public int $backupSeconds, public int $restorationSeconds, public string $evidenceReference)
    {
        if ($backupSeconds < 1 || $backupSeconds > 315360000 || $restorationSeconds < 1 || $restorationSeconds > 315360000
            || $backupSeconds + $restorationSeconds <= 86400 || strlen($evidenceReference) < 1 || strlen($evidenceReference) > 200
            || preg_match('/[^\x20-\x7e]/', $evidenceReference) || trim($evidenceReference) === '') {
            throw new InvalidArgumentException('Supply reviewed backup lifetime, restoration window and evidence reference.');
        }
    }
}

/** Fixed internal conflict; T046 maps to the documented409 without disclosing a binding. */
final class DeletionReceiptConflict extends RuntimeException
{
    public function __construct() { parent::__construct('This deletion receipt was already used.'); }
}

/**
 * Separate private SQLite recovery artifact: FULL sync / DELETE journal through Database.
 * NEVER restore/roll back this file with game storage. All supplied rollbackRoots must cover
 * every game DB backup/rollback path; filesystem checks cannot discover operator backup jobs.
 * A separately provisioned stable .lock inode carries flock (macOS may conflict with
 * SQLite locks when flock targets the database itself).
 * Ancestors must be operator-controlled; malicious same-UID/root replacement is out of scope.
 */
final class DeletionLedger
{
    public const MAX_MARKERS = 4096;
    public const MAX_SPENT_RECEIPTS = 65536;
    private bool $held = false;
    private bool $usable = true;
    private mixed $lock;
    private readonly array $identity;

    private function __construct(private readonly Database $storage, private readonly string $file,
        private readonly DeletionRetentionPolicy $policy)
    {
        $this->identity = self::lockMetadata($file . '.lock', lstat($file)['uid']);
        $this->lock = @fopen($file . '.lock', 'r+b');
        if ($this->lock === false) { throw new RuntimeException('Recovery lock is unavailable.'); }
        $this->assertStorage();
    }

    /**
     * Explicit operator setup ONLY on an existing private empty regular file. It is never
     * invoked by open, AccountAccess, status or a route. Provision paths separately; no chmod,
     * path discovery, adopted schema, migrations or defaults in request processing.
     */
    public static function initialize(string $file, array $documentRoots, array $rollbackRoots, DeletionRetentionPolicy $policy): self
    {
        self::existing($file, true);
        self::lockMetadata($file . '.lock', lstat($file)['uid']);
        $ledger = new self(Database::open($file, self::excludedRoots($documentRoots, $rollbackRoots)), $file, $policy);
        $ledger->exclusive(function () use ($ledger): void {
            if ($ledger->storage->connection()->query("SELECT count(*) FROM sqlite_master")->fetchColumn() !== 0) {
                throw new RuntimeException('Recovery initialization requires empty storage.');
            }
            $ledger->storage->migrate([1 => self::schema()]);
            $ledger->storage->immediate(fn (PDO $pdo) => $pdo->prepare('INSERT INTO retention_policy VALUES(1,?,?,?)')
                ->execute([$ledger->policy->backupSeconds, $ledger->policy->restorationSeconds, $ledger->policy->evidenceReference]));
            // SQLite synchronizes commits and rollback-journal directory operations. Also
            // seal initial provisioning's file and directory entry before returning it usable.
            $directory = @fopen(dirname($ledger->file), 'r');
            if ($directory === false) { throw new RuntimeException('Recovery directory synchronization unavailable.'); }
            try {
                if (!fsync($ledger->lock) || !fsync($directory)) { throw new RuntimeException('Recovery initialization synchronization failed.'); }
            } finally { fclose($directory); }
        });
        return $ledger;
    }

    /** Existing initialized artifact only. Missing/empty/unrecognized storage fails closed. */
    public static function open(string $file, array $documentRoots, array $rollbackRoots, DeletionRetentionPolicy $policy): self
    {
        self::existing($file, false);
        self::lockMetadata($file . '.lock', lstat($file)['uid']);
        $ledger = new self(Database::open($file, self::excludedRoots($documentRoots, $rollbackRoots)), $file, $policy);
        $ledger->exclusive(function () use ($ledger): void {
            $pdo = $ledger->storage->connection();
            $versions = $pdo->query('SELECT version,checksum FROM schema_migrations ORDER BY version')->fetchAll();
            $retention = $pdo->query('SELECT * FROM retention_policy')->fetchAll();
            if ($versions !== [['version' => 1, 'checksum' => hash('sha256', self::schema())]]
                || $retention !== [['singleton' => 1, 'backup_seconds' => $ledger->policy->backupSeconds,
                    'restoration_seconds' => $ledger->policy->restorationSeconds, 'evidence_reference' => $ledger->policy->evidenceReference]]
                || $pdo->query('PRAGMA quick_check')->fetchColumn() !== 'ok'
                || $pdo->query('PRAGMA foreign_key_check')->fetchAll() !== []) {
                throw new RuntimeException('Recovery schema or reviewed retention policy does not match.');
            }
        });
        return $ledger;
    }

    /** Bounded EX flock before any game transaction. Concurrent cold requests share this barrier. */
    public function exclusive(callable $operation): mixed
    {
        if ($this->held || $this->storage->connection()->inTransaction()) { throw new LogicException('Recovery barrier cannot be nested.'); }
        $this->assertStorage();
        // Allow a burst to pass the external barrier within the two-second
        // service target. Individual SQLite transactions retain their 250 ms bound.
        $until = hrtime(true) + 750_000_000;
        while (!flock($this->lock, LOCK_EX | LOCK_NB, $wouldBlock)) {
            if (!$wouldBlock || hrtime(true) >= $until) { throw new RuntimeException('Recovery barrier is unavailable.'); }
            usleep(5000);
            $this->assertStorage();
        }
        $this->held = true;
        try {
            $this->assertStorage();
            return $operation();
        } finally {
            $this->held = false;
            if (!flock($this->lock, LOCK_UN)) { $this->usable = false; throw new RuntimeException('Recovery barrier release failed.'); }
        }
    }

    /** Trusted deletion service only, after fresh same-account authorization while held. */
    public function accept(string $account, string $receiptHash, int $now): void
    {
        $this->assertHeld(); self::account($account); self::hash($receiptHash); self::time($now, 252771580799);
        $this->storage->immediate(function (PDO $pdo) use ($account, $receiptHash, $now): void {
            $query = $pdo->prepare('SELECT account_id,expires_at FROM deletion_receipts WHERE receipt_hash=?');
            $query->execute([$receiptHash]); $bound = $query->fetch();
            if ($bound !== false && $bound['account_id'] === $account && $now < $bound['expires_at']) { return; }
            $spent = $pdo->prepare('SELECT 1 FROM spent_receipts WHERE receipt_hash=?'); $spent->execute([$receiptHash]);
            $marker = $pdo->prepare('SELECT 1 FROM deletion_markers WHERE account_id=?'); $marker->execute([$account]);
            if ($spent->fetchColumn() !== false || $marker->fetchColumn() !== false) { throw new DeletionReceiptConflict(); }
            if ((int) $pdo->query('SELECT count(*) FROM deletion_markers')->fetchColumn() >= self::MAX_MARKERS
                || (int) $pdo->query('SELECT count(*) FROM spent_receipts')->fetchColumn() >= self::MAX_SPENT_RECEIPTS) {
                throw new RuntimeException('Recovery capacity requires operator review.');
            }
            $pdo->prepare('INSERT INTO deletion_markers(account_id,intent_at,retain_until) VALUES(?,?,?)')
                ->execute([$account, $now, $now + $this->policy->backupSeconds + $this->policy->restorationSeconds]);
            $pdo->prepare('INSERT INTO spent_receipts VALUES(?)')->execute([$receiptHash]);
            $pdo->prepare('INSERT INTO deletion_receipts VALUES(?,?,?,?)')->execute([$receiptHash, $account, $now, $now + 86400]);
        });
    }

    /** Called only after live deletion COMMIT. Never infer completion from missing session. */
    public function complete(string $account, int $now): void { $this->completeMany([$account], $now); }

    /** One external commit for a bounded reconciliation batch, after its game DB commit. */
    public function completeMany(array $accounts, int $now): void
    {
        $this->assertHeld(); self::time($now);
        if (!array_is_list($accounts) || count($accounts) > self::MAX_MARKERS) { throw new InvalidArgumentException('Expected a bounded completion batch.'); }
        foreach ($accounts as $account) { if (!is_string($account)) { throw new InvalidArgumentException('Expected account UUIDs.'); } self::account($account); }
        if ($accounts === []) { return; }
        $this->storage->immediate(function (PDO $pdo) use ($accounts, $now): void {
            $query = $pdo->prepare('SELECT intent_at,completed_at FROM deletion_markers WHERE account_id=?');
            $update = $pdo->prepare('UPDATE deletion_markers SET completed_at=? WHERE account_id=?');
            foreach ($accounts as $account) {
                $query->execute([$account]); $marker = $query->fetch();
                if ($marker === false || $now < $marker['intent_at']) { throw new RuntimeException('Invalid recovery completion transition.'); }
                if ($marker['completed_at'] === null) { $update->execute([$now, $account]); }
            }
        });
    }

    /** All markers, including completed and beyond retain_until, prevent restored resurrection. */
    public function markers(): array
    {
        $this->assertHeld();
        $rows = $this->storage->connection()->query('SELECT account_id AS accountId,intent_at AS intentAt,completed_at AS completedAt
            FROM deletion_markers ORDER BY account_id LIMIT ' . (self::MAX_MARKERS + 1))->fetchAll();
        if (count($rows) > self::MAX_MARKERS) { throw new RuntimeException('Recovery capacity requires operator review.'); }
        return $rows;
    }

    /** Read-only narrow projection. Never reconciles, authorizes deletion or selects account. */
    public function receipt(string $hash, int $now): ?array
    {
        $this->assertHeld(); self::hash($hash); self::time($now);
        $query = $this->storage->connection()->prepare('SELECT r.accepted_at,r.expires_at,m.completed_at FROM deletion_receipts r
            JOIN deletion_markers m ON m.account_id=r.account_id WHERE r.receipt_hash=?');
        $query->execute([$hash]); $row = $query->fetch();
        if ($row === false || $now < $row['accepted_at'] || $now >= $row['expires_at']) { return null; }
        return ['state' => $row['completed_at'] === null ? 'pending' : 'completed', 'expiresAt' => $row['expires_at']];
    }

    /** Explicit maintenance, never status. Markers and unbound spent hashes are untouched. */
    public function expireReceipts(int $now): int
    {
        $this->assertHeld(); self::time($now);
        return $this->storage->immediate(function (PDO $pdo) use ($now): int {
            $query = $pdo->prepare('DELETE FROM deletion_receipts WHERE expires_at<=?'); $query->execute([$now]); return $query->rowCount();
        });
    }

    /** A durable release drain shares the account barrier, so all admitted writes finish first. */
    public function drained(): bool
    {
        $this->assertHeld();
        $path = $this->file . '.write-drain';
        clearstatcache(true, $path);
        if (@lstat($path) === false) return false;
        self::lockMetadata($path, $this->identity['uid']);
        return true;
    }

    /** Aggregate capacity only; the operator can plan retention review before intake closes. */
    public function remainingCapacity(): array
    {
        $this->assertHeld();
        $pdo = $this->storage->connection();
        return ['markers' => self::MAX_MARKERS - (int)$pdo->query('SELECT count(*) FROM deletion_markers')->fetchColumn(),
            'spentReceipts' => self::MAX_SPENT_RECEIPTS - (int)$pdo->query('SELECT count(*) FROM spent_receipts')->fetchColumn()];
    }

    public function setDrained(bool $enabled): void
    {
        if ($this->drained() === $enabled) return;
        $path = $this->file . '.write-drain';
        if ($enabled) {
            $mask = umask(0077);
            try {
                $handle = fopen($path, 'xb');
                try {
                    if (!fsync($handle)) throw new RuntimeException('Release drain synchronization failed.');
                } finally { fclose($handle); }
            } finally { umask($mask); }
        } elseif (!unlink($path)) {
            throw new RuntimeException('Release drain removal failed.');
        }
        $dir = fopen(dirname($path), 'rb');
        try {
            if (!fsync($dir)) throw new RuntimeException('Release drain directory synchronization failed.');
        } finally { fclose($dir); }
    }

    public function assertHeld(): void
    {
        if (!$this->held) { throw new LogicException('Acquire the external recovery barrier first.'); }
        $this->assertStorage();
    }

    private function assertStorage(): void
    {
        if (!$this->usable || !is_resource($this->lock)) { throw new RuntimeException('Discard unusable recovery storage.'); }
        $this->storage->connection(); // accepted strict directory/file/sidecar checks
        $opened = fstat($this->lock); $current = self::lockMetadata($this->file . '.lock', $this->identity['uid']);
        foreach (['dev', 'ino', 'uid'] as $key) {
            if ($opened[$key] !== $this->identity[$key] || $current[$key] !== $this->identity[$key]) {
                throw new RuntimeException('Recovery lock identity changed.');
            }
        }
    }

    private static function lockMetadata(string $file, int $owner): array
    {
        clearstatcache(true, $file); $metadata = @lstat($file);
        if ($metadata === false || ($metadata['mode'] & 0177777) !== 0100600 || $metadata['nlink'] !== 1
            || $metadata['uid'] !== $owner || !is_readable($file) || !is_writable($file) || $metadata['size'] !== 0) {
            throw new RuntimeException('Expected an existing empty private recovery lock file.');
        }
        return $metadata;
    }

    private static function existing(string $file, bool $empty): void
    {
        clearstatcache(true, $file); $metadata = @lstat($file);
        if ($metadata === false || ($metadata['mode'] & 0177777) !== 0100600 || $metadata['nlink'] !== 1
            || ($empty ? $metadata['size'] !== 0 : $metadata['size'] === 0)) {
            throw new RuntimeException('Expected an existing private recovery artifact with the required initialization state.');
        }
    }

    private static function excludedRoots(array $documentRoots, array $rollbackRoots): array
    {
        if ($documentRoots === [] || $rollbackRoots === [] || !array_is_list($documentRoots) || !array_is_list($rollbackRoots)) {
            throw new InvalidArgumentException('Supply all document and game backup/rollback roots explicitly.');
        }
        return array_values(array_unique(array_merge($documentRoots, $rollbackRoots), SORT_REGULAR));
    }

    private static function schema(): string
    {
        $schema = file_get_contents(__DIR__ . '/../recovery/001_ledger.sql');
        if ($schema === false) { throw new RuntimeException('Recovery schema is unavailable.'); }
        return $schema;
    }
    private static function account(string $account): void
    {
        if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/D', $account)) { throw new InvalidArgumentException('Expected an internal account UUID.'); }
    }
    private static function hash(string $hash): void
    {
        if (!preg_match('/^[a-f0-9]{64}$/D', $hash)) { throw new InvalidArgumentException('Expected a receipt hash.'); }
    }
    private static function time(int $now, int $maximum = 253402300799): void
    {
        if ($now < 0 || $now > $maximum) { throw new InvalidArgumentException('Recovery clock is outside supported UTC bounds.'); }
    }
    public function __destruct() { if (is_resource($this->lock)) { fclose($this->lock); } }
}
