<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use InvalidArgumentException;
use JsonException;

/** Explicit private JSON configuration; never executable PHP/.env or credential discovery. */
final readonly class Configuration
{
    public string $origin;
    public string $gamePath;
    public string $apiPath;
    public string $databasePath;
    public string $rateKey;
    public string $ledgerFile;
    public array $rollbackRoots;
    public int $backupSeconds;
    public int $restorationSeconds;
    public string $retentionEvidence;
    public string $googleClientId;
    public string $googleClientSecret;
    public string $googleCallback;
    public string $githubClientId;
    public string $githubClientSecret;
    public string $githubCallback;

    private function __construct(array $values)
    {
        foreach ($values as $key => $value) $this->$key = $value;
        $this->apiPath = $this->gamePath . 'api/v1';
    }

    /** ALL deployment docroots are trusted required inputs; loading never opens/migrates DB. */
    public static function load(string $file, array $documentRoots): self
    {
        self::path($file);
        if ($documentRoots === [] || !array_is_list($documentRoots)) self::invalid();
        foreach ($documentRoots as $root) {
            if (!is_string($root)) self::invalid();
            self::directory($root);
            if ($root === '/' || self::under($file, $root)) self::invalid();
        }
        self::directory(dirname($file));
        clearstatcache();
        $parent = lstat(dirname($file));
        $before = @lstat($file);
        if ($before === false || realpath($file) !== $file || ($parent['mode'] & 0177777) !== 0040700
            || ($before['mode'] & 0177777) !== 0100600 || $before['nlink'] !== 1 || $before['uid'] !== $parent['uid']
            || $before['size'] > 16384 || !is_readable($file)) self::invalid();
        $handle = @fopen($file, 'rb');
        if ($handle === false) self::invalid();
        try {
            $opened = fstat($handle);
            if ($opened['dev'] !== $before['dev'] || $opened['ino'] !== $before['ino']) self::invalid();
            $raw = stream_get_contents($handle, 16385);
            if ($raw === false || strlen($raw) > 16384) self::invalid();
        } finally { fclose($handle); }
        try { $object = json_decode($raw, false, 4, JSON_THROW_ON_ERROR); }
        catch (JsonException) { self::invalid(); }
        if (!$object instanceof \stdClass) self::invalid();
        $values = get_object_vars($object);
        $keys = ['origin', 'gamePath', 'databasePath', 'rateKey', 'googleClientId', 'googleClientSecret',
            'googleCallback', 'githubClientId', 'githubClientSecret', 'githubCallback',
            'ledgerFile', 'rollbackRoots', 'backupSeconds', 'restorationSeconds', 'retentionEvidence'];
        if (count($values) !== count($keys) || array_diff(array_keys($values), $keys) !== []) self::invalid();
        foreach (array_diff($keys, ['rollbackRoots', 'backupSeconds', 'restorationSeconds']) as $key) {
            if (!is_string($values[$key]) || $values[$key] === '' || preg_match('/[\x00-\x1f\x7f]/', $values[$key])) self::invalid();
        }
        // Tokenize complete JSON strings after grammar validation; count object keys by
        // their following colon. Lists of string paths do not hide duplicate/escaped keys.
        preg_match_all('/"(?:[^"\\\\]|\\\\.)*"/s', $raw, $strings, PREG_OFFSET_CAPTURE);
        $members = 0;
        foreach ($strings[0] as [$token, $offset]) {
            if (str_starts_with(ltrim(substr($raw, $offset + strlen($token))), ':')) ++$members;
        }
        if ($members !== count($keys)) self::invalid();
        if (!is_int($values['backupSeconds']) || !is_int($values['restorationSeconds'])
            || $values['backupSeconds'] < 1 || $values['backupSeconds'] > 315360000
            || $values['restorationSeconds'] < 1 || $values['restorationSeconds'] > 315360000
            || $values['backupSeconds'] + $values['restorationSeconds'] <= 86400
            || strlen($values['retentionEvidence']) > 200 || trim($values['retentionEvidence']) === ''
            || preg_match('/[^\x20-\x7e]/', $values['retentionEvidence'])) self::invalid();
        if (!is_array($values['rollbackRoots']) || !array_is_list($values['rollbackRoots'])
            || count($values['rollbackRoots']) < 1 || count($values['rollbackRoots']) > 32) self::invalid();
        foreach ($values['rollbackRoots'] as $root) { if (!is_string($root)) self::invalid(); self::directory($root); }
        if (strlen($values['origin']) > 300
            || !preg_match('~^https://(?:[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?|\[[0-9a-f:]+\])(?::([1-9][0-9]{0,4}))?$~D', $values['origin'], $match)
            || (isset($match[1]) && (int) $match[1] > 65535)
            || !preg_match('~^/(?:[A-Za-z0-9_-]+/)+$~D', $values['gamePath']) || strlen($values['gamePath']) > 512) self::invalid();
        foreach (['google', 'github'] as $provider) {
            if (!preg_match('/^[A-Za-z0-9._-]{1,255}$/D', $values[$provider . 'ClientId'])
                || strlen($values[$provider . 'ClientSecret']) > 4096 || preg_match('/[\x00-\x20\x7f]/', $values[$provider . 'ClientSecret'])
                || $values[$provider . 'Callback'] !== $values['origin'] . $values['gamePath'] . 'api/v1/auth/' . $provider . '/callback') self::invalid();
        }
        $encoded = $values['rateKey'];
        $bytes = base64_decode(strtr($encoded, '-_', '+/') . '=', true);
        if (strlen($encoded) !== 43 || $bytes === false || strlen($bytes) !== 32
            || rtrim(strtr(base64_encode($bytes), '+/', '-_'), '=') !== $encoded) self::invalid();
        $values['rateKey'] = $bytes;
        self::path($values['databasePath']);
        self::directory(dirname($values['databasePath']));
        if ((lstat(dirname($values['databasePath']))['mode'] & 0177777) !== 0040700) self::invalid();
        foreach ($documentRoots as $root) if (self::under($values['databasePath'], $root)) self::invalid();
        if (is_link($values['databasePath']) || $values['databasePath'] === $file) self::invalid();
        self::path($values['ledgerFile']);
        self::directory(dirname($values['ledgerFile']));
        if ((lstat(dirname($values['ledgerFile']))['mode'] & 0177777) !== 0040700
            || is_link($values['ledgerFile']) || $values['ledgerFile'] === $file) self::invalid();
        foreach (array_merge($documentRoots, $values['rollbackRoots']) as $root) {
            if ($root === '/' || self::under($values['ledgerFile'], $root)) self::invalid();
        }
        $covered = false;
        foreach ($values['rollbackRoots'] as $root) if (self::under($values['databasePath'], $root)) $covered = true;
        if (!$covered) self::invalid();
        return new self($values);
    }

    private static function under(string $file, string $root): bool { return $file === $root || str_starts_with($file, $root . '/'); }
    private static function path(string $path): void
    {
        if (!str_starts_with($path, '/') || preg_match('~[\x00-\x1f\x7f\\\\?:#]|//|(?:^|/)\.{1,2}(?:/|$)~', $path)
            || ($path !== '/' && str_ends_with($path, '/'))) self::invalid();
    }
    private static function directory(string $directory): void
    {
        self::path($directory);
        if (realpath($directory) !== $directory || !is_dir($directory)) self::invalid();
    }
    private static function invalid(): never { throw new InvalidArgumentException('Private game configuration is unavailable or invalid.'); }
}
