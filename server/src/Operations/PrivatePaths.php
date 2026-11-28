<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

use RuntimeException;

final class PrivatePaths
{
    public static function check(bool $condition): void
    {
        if (!$condition) throw new RuntimeException('Operational verification failed.');
    }

    public static function canonical(string $path): void
    {
        self::check(str_starts_with($path, '/') && $path !== '/' && !str_ends_with($path, '/')
            && !preg_match('~[\x00-\x1f\x7f\\\\?:#]|//|(?:^|/)\.{1,2}(?:/|$)~', $path));
    }

    public static function directory(string $dir, bool $private = true): void
    {
        self::canonical($dir);
        clearstatcache(true);
        self::check(realpath($dir) === $dir && is_dir($dir));
        if ($private) {
            $stat = lstat($dir);
            self::check(($stat['mode'] & 0177777) === 0040700
                && (!function_exists('posix_geteuid') || $stat['uid'] === posix_geteuid()));
        }
    }

    public static function within(string $path, string $dir): bool
    {
        return $path === $dir || str_starts_with($path, $dir . '/');
    }

    public static function outside(string $path, array $dirs): void
    {
        foreach ($dirs as $dir) self::check(!self::within($path, $dir));
    }

    public static function file(string $path): array
    {
        self::canonical($path);
        self::directory(dirname($path));
        $stat = @lstat($path);
        self::check($stat !== false && ($stat['mode'] & 0177777) === 0100600 && $stat['nlink'] === 1
            && $stat['uid'] === fileowner(dirname($path)) && realpath($path) === $path);
        return $stat;
    }

    public static function readSmall(string $path, int $max): string
    {
        $stat = self::file($path);
        self::check($stat['size'] <= $max);
        $data = file_get_contents($path, false, null, 0, $max + 1);
        self::check(is_string($data) && strlen($data) === $stat['size']);
        return $data;
    }

    public static function syncDirectory(string $directory): void
    {
        $fd = fopen($directory, 'rb');
        try { self::check(fsync($fd)); } finally { fclose($fd); }
    }
}
