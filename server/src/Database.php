<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;
use LogicException;
use PDO;
use RuntimeException;
use Throwable;

/** Dedicated private SQLite boundary. No configuration discovery, routes, credentials or auth. */
final class Database
{
    private bool $transaction = false;
    private bool $usable = true;

    private function __construct(
        private readonly PDO $pdo,
        private readonly string $file,
        private readonly array $documentRoots,
        private readonly array $directoryIdentity,
        private readonly array $fileIdentity,
    ) {
    }

    /**
     * Operator supplies an absolute canonical file and ALL applicable canonical docroots.
     * Existing mode0700 parent is required; never chmod/adopt/create directories or load config.
     * Ancestors must be operator-controlled. PHP path checks cannot defeat malicious same-UID
     * processes/root swapping paths between syscalls. Permissions are not proof against them.
     */
    public static function open(string $file, array $documentRoots): self
    {
        self::canonicalSyntax($file);
        if ($documentRoots === [] || !array_is_list($documentRoots)) {
            throw new InvalidArgumentException('Supply every document root explicitly.');
        }
        foreach ($documentRoots as $root) {
            if (!is_string($root)) {
                throw new InvalidArgumentException('Document roots must be absolute paths.');
            }
            self::canonicalSyntax($root);
            self::directoryPath($root);
            if ($root === '/' || $file === $root || str_starts_with($file, $root . '/')) {
                throw new RuntimeException('Game storage must be outside every document root.');
            }
        }
        $directory = dirname($file);
        self::directoryPath($directory);
        $parent = lstat($directory);
        if (($parent['mode'] & 0177777) !== 0040700 || !is_readable($directory) || !is_writable($directory)) {
            throw new RuntimeException('Game storage requires an accessible private directory.');
        }
        self::sidecars($file, $parent['uid']);
        clearstatcache(true, $file);
        if (!file_exists($file) && !is_link($file)) {
            $mask = umask(0077);
            try {
                $handle = @fopen($file, 'x+b');
                if ($handle === false) {
                    throw new RuntimeException('Could not exclusively create private game storage.');
                }
                fclose($handle);
            } finally {
                umask($mask);
            }
        }
        $identity = self::privateFile($file, $parent['uid']);
        if ($identity['size'] !== 0) {
            // A WAL-mode file can have no sidecars after its last connection closes. Do not
            // silently convert/recover a differently configured database while opening it.
            $handle = @fopen($file, 'rb');
            if ($handle === false) {
                throw new RuntimeException('Could not inspect private game storage.');
            }
            try {
                $header = fread($handle, 100);
            } finally {
                fclose($handle);
            }
            if ($header === false || strlen($header) !== 100 || substr($header, 0, 16) !== "SQLite format 3\0"
                || $header[18] !== "\x01" || $header[19] !== "\x01") {
                throw new RuntimeException('Expected a rollback-journal SQLite database.');
            }
        }
        // Validate before PDO can read, recover, or create any journal.
        $mask = umask(0077);
        try {
            $pdo = new PDO('sqlite:' . $file, null, null, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_STRINGIFY_FETCHES => false,
                PDO::ATTR_PERSISTENT => false,
            ]);
            $database = new self($pdo, $file, $documentRoots, $parent, $identity);
            $database->assertStorage();
            // Read back every setting: SQLite silently ignores unknown pragmas.
            $pdo->exec('PRAGMA busy_timeout = 250');
            $pdo->exec('PRAGMA foreign_keys = ON');
            $pdo->exec('PRAGMA journal_mode = DELETE');
            $pdo->exec('PRAGMA synchronous = FULL');
            $pdo->exec('PRAGMA trusted_schema = OFF');
            $pdo->exec('PRAGMA temp_store = MEMORY');
            foreach (['foreign_keys' => 1, 'journal_mode' => 'delete', 'synchronous' => 2,
                'busy_timeout' => 250, 'trusted_schema' => 0, 'temp_store' => 2] as $pragma => $expected) {
                if ($pdo->query('PRAGMA ' . $pragma)->fetchColumn() !== $expected) {
                    throw new RuntimeException('Required SQLite policy is unavailable.');
                }
            }
            $database->assertStorage();
            return $database;
        } finally {
            umask($mask);
        }
    }

    /** Trusted repositories only; use prepared SQL and immediate() for atomic mutations. */
    public function connection(): PDO
    {
        $this->assertStorage();
        return $this->pdo;
    }

    /**
     * Short synchronous callback. No external calls, BEGIN/COMMIT/ROLLBACK or nested calls.
     * Reauthorization and receipt recheck belong inside the caller's callback (T043 onward).
     * PDOException SQLITE_BUSY is preserved for the route's retryable503 mapping.
     */
    public function immediate(callable $operation): mixed
    {
        $this->assertStorage();
        if ($this->transaction || $this->pdo->inTransaction()) {
            throw new LogicException('Nested database transactions are not allowed.');
        }
        // Begin is outside catch: a failed BEGIN must never roll back somebody else's work.
        $this->pdo->exec('BEGIN IMMEDIATE');
        $this->transaction = true;
        try {
            $result = $operation($this->pdo);
            if (!$this->pdo->inTransaction()) {
                $this->usable = false;
                throw new LogicException('Transaction control belongs to Database.');
            }
            $this->assertStorage();
            $this->pdo->exec('COMMIT');
            return $result;
        } catch (Throwable $error) {
            try {
                if ($this->pdo->inTransaction()) {
                    $this->pdo->exec('ROLLBACK');
                }
            } catch (Throwable) {
                $this->usable = false;
                throw new RuntimeException('Rollback failed; discard this database connection.', 0, $error);
            }
            throw $error;
        } finally {
            $this->transaction = false;
        }
    }

    /**
     * Explicit deployment operation, never run by open()/GET. Override is trusted SQL keyed
     * by consecutive integer versions, useful for isolated migration tests/future packages.
     * One transaction covers the entire unapplied batch and its checksum records.
     * Conservative subset forbids transaction/attachment/pragma/trigger control. Expand only
     * with reviewed migration support, not by accepting SQL that can escape the transaction.
     */
    public function migrate(?array $migrations = null): void
    {
        if ($migrations === null) {
            $migrations = [];
            foreach ([1 => '001_game.sql', 2 => '002_delete_reauth.sql'] as $version => $name) {
                $sql = file_get_contents(__DIR__ . '/../migrations/' . $name);
                if ($sql === false) {
                    throw new RuntimeException('Packaged game migration is unavailable.');
                }
                $migrations[$version] = $sql;
            }
        }
        if ($migrations === [] || array_keys($migrations) !== range(1, count($migrations))) {
            throw new InvalidArgumentException('Migrations must be a consecutive ordered sequence.');
        }
        foreach ($migrations as $sql) {
            if (!is_string($sql) || $sql === '' || str_contains($sql, "\0")) {
                throw new InvalidArgumentException('A migration must contain SQL.');
            }
            // Lex away SQLite quoted strings/identifiers and comments before checking tokens.
            $tokens = preg_replace('/\x27(?:\x27\x27|[^\x27])*\x27|"(?:""|[^"])*"|`(?:``|[^`])*`|\[[^\]]*\]|--[^\r\n]*|\/\*[\s\S]*?\*\//', ' ', $sql);
            if (preg_match('/\b(BEGIN|END|COMMIT|ROLLBACK|SAVEPOINT|RELEASE|ATTACH|DETACH|PRAGMA|VACUUM|TRIGGER)\b/i', $tokens)) {
                throw new InvalidArgumentException('Migration cannot control transactions or external storage.');
            }
        }
        $this->immediate(function (PDO $pdo) use ($migrations): void {
            $hasLedger = (int) $pdo->query("SELECT count(*) FROM sqlite_master WHERE type='table' AND name='schema_migrations'")->fetchColumn() === 1;
            if (!$hasLedger && (int) $pdo->query("SELECT count(*) FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'")->fetchColumn() !== 0) {
                throw new RuntimeException('Refusing to adopt an unrecognized database.');
            }
            $applied = $hasLedger ? $pdo->query('SELECT version, checksum FROM schema_migrations ORDER BY version')->fetchAll() : [];
            foreach ($applied as $index => $row) {
                if ($row['version'] !== $index + 1 || !isset($migrations[$row['version']])
                    || !hash_equals(hash('sha256', $migrations[$row['version']]), $row['checksum'])) {
                    throw new RuntimeException('Unknown, missing or changed database migration.');
                }
            }
            foreach ($migrations as $version => $sql) {
                if ($version <= count($applied)) {
                    continue;
                }
                $pdo->exec($sql);
                $pdo->prepare('INSERT INTO schema_migrations(version, applied_at, checksum) VALUES(?, ?, ?)')
                    ->execute([$version, time(), hash('sha256', $sql)]);
            }
            if ($pdo->query('PRAGMA foreign_key_check')->fetchAll() !== []) {
                throw new RuntimeException('Migration leaves invalid foreign keys.');
            }
        });
    }

    private static function canonicalSyntax(string $path): void
    {
        if (!str_starts_with($path, '/') || preg_match('~[\x00-\x1f\x7f\\\\?:#]|//|(?:^|/)\.{1,2}(?:/|$)~', $path)
            || ($path !== '/' && str_ends_with($path, '/'))) {
            throw new InvalidArgumentException('Expected a canonical absolute filesystem path.');
        }
    }

    private static function directoryPath(string $path): void
    {
        clearstatcache();
        $current = '';
        foreach (explode('/', ltrim($path, '/')) as $segment) {
            if ($segment === '') {
                continue;
            }
            $current .= '/' . $segment;
            $metadata = @lstat($current);
            if ($metadata === false || ($metadata['mode'] & 0170000) !== 0040000) {
                throw new RuntimeException('Storage and document roots require existing non-symlink directories.');
            }
        }
        if (realpath($path) !== $path) {
            throw new RuntimeException('Filesystem path is not canonical.');
        }
    }

    private static function privateFile(string $file, int $owner): array
    {
        clearstatcache(true, $file);
        $metadata = @lstat($file);
        if ($metadata === false || ($metadata['mode'] & 0177777) !== 0100600 || $metadata['nlink'] !== 1
            || $metadata['uid'] !== $owner || !is_readable($file) || !is_writable($file)) {
            throw new RuntimeException('Game files must be private regular files with consistent ownership.');
        }
        return $metadata;
    }

    private static function sidecars(string $file, int $owner): void
    {
        foreach (['-journal', '-wal', '-shm'] as $suffix) {
            $path = $file . $suffix;
            clearstatcache(true, $path);
            if (file_exists($path) || is_link($path)) {
                self::privateFile($path, $owner);
                if ($suffix !== '-journal') {
                    throw new RuntimeException('WAL storage requires a separately reviewed migration.');
                }
            }
        }
    }

    private function assertStorage(): void
    {
        if (!$this->usable) {
            throw new LogicException('Discard the unusable database connection.');
        }
        self::directoryPath(dirname($this->file));
        foreach ($this->documentRoots as $root) {
            self::directoryPath($root);
        }
        $parent = lstat(dirname($this->file));
        $file = self::privateFile($this->file, $parent['uid']);
        foreach (['dev', 'ino', 'uid'] as $key) {
            if ($parent[$key] !== $this->directoryIdentity[$key] || $file[$key] !== $this->fileIdentity[$key]) {
                throw new RuntimeException('Private game storage identity changed.');
            }
        }
        if (($parent['mode'] & 0177777) !== 0040700) {
            throw new RuntimeException('Private game directory permissions changed.');
        }
        self::sidecars($this->file, $parent['uid']);
    }
}
