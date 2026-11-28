<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

use NetworkQuest\Security;

final class RequestLog
{
    public static function append(string $dir, string $api, array $server, array $response, int $start): void
    {
        $path = explode('?', $server['REQUEST_URI'] ?? '', 2)[0];
        $route = match ([$server['REQUEST_METHOD'] ?? '', $path]) {
            ['GET', $api . '/session'] => 'getSession',
            ['POST', $api . '/auth/google/start'], ['POST', $api . '/auth/github/start'] => 'startAuth',
            ['GET', $api . '/auth/google/callback'], ['GET', $api . '/auth/github/callback'] => 'authCallback',
            ['POST', $api . '/logout'] => 'logout', ['GET', $api . '/save'] => 'getSave',
            ['PUT', $api . '/save'] => 'putSave', ['PATCH', $api . '/preferences'] => 'patchPreferences',
            ['DELETE', $api . '/account'] => 'deleteAccount', ['POST', $api . '/account/deletion-status'] => 'getDeletionStatus',
            default => null
        };
        if ($route === null) return;
        $status = $response['status'];
        $reason = match ($status) {
            400 => 'invalid-request', 401 => 'unauthorized', 403 => 'forbidden', 413 => 'body-too-large',
            429 => 'rate-limited', 503 => 'unavailable', default => $status < 400 ? 'ok' : 'request-rejected'
        };
        $record = Security::logRecord($route, $status, min(600000, intdiv(hrtime(true) - $start, 1000000)),
            $response['headers']['X-Request-Id'], $reason);
        PrivatePaths::directory($dir);
        $file = $dir . '/nq-requests-' . gmdate('YmdH') . '.jsonl';
        $mask = umask(0077);
        try {
            if (@lstat($file) === false) {
                $created = @fopen($file, 'xb');
                if ($created !== false) fclose($created);
            }
            PrivatePaths::file($file);
            $fd = fopen($file, 'ab');
            try {
                PrivatePaths::check(flock($fd, LOCK_EX));
                $line = json_encode($record, JSON_THROW_ON_ERROR) . "\n";
                PrivatePaths::check(fwrite($fd, $line) === strlen($line) && fflush($fd));
            } finally { fclose($fd); }
        } finally { umask($mask); }
    }

    public static function expire(string $dir, int $now): void
    {
        // Hourly UTC buckets expire when the bucket start is seven days old.
        $cutoff = gmdate('YmdH', $now - 604800);
        foreach (scandir($dir) as $name) {
            if (preg_match('/^nq-requests-([0-9]{10})\.jsonl$/D', $name, $m) && strcmp($m[1], $cutoff) <= 0) {
                PrivatePaths::file($dir . '/' . $name);
                PrivatePaths::check(unlink($dir . '/' . $name));
            }
        }
    }
}
