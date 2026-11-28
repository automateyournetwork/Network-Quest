<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Operations;

final class Archive
{
    private const MAGIC = "NQBACK\x01";
    private const CHUNK = 65536;

    public static function timestamp(string $name, string $kind): int
    {
        PrivatePaths::check((bool)preg_match('/^nq-' . $kind . '-([0-9]{10})-[0-9a-f]{24}\.nqb$/D', $name, $match));
        return (int)$match[1];
    }

    public static function write($stream, string $bytes): void
    {
        PrivatePaths::check(fwrite($stream, $bytes) === strlen($bytes));
    }

    /** Authenticated associated data binds every frame to kind, capture time and unique filename. */
    public static function seal(string $source, string $cipher, string $name, string $key): void
    {
        $in = fopen($source, 'rb');
        try {
            $out = fopen($cipher, 'xb');
            try {
                [$state, $header] = sodium_crypto_secretstream_xchacha20poly1305_init_push($key);
                self::write($out, self::MAGIC . $header);
                while (!feof($in)) {
                    $chunk = fread($in, self::CHUNK);
                    PrivatePaths::check($chunk !== false);
                    if ($chunk === '') break;
                    $frame = sodium_crypto_secretstream_xchacha20poly1305_push($state, $chunk, $name);
                    self::write($out, pack('N', strlen($frame)) . $frame);
                }
                $final = sodium_crypto_secretstream_xchacha20poly1305_push($state, '', $name, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL);
                self::write($out, pack('N', strlen($final)) . $final);
                PrivatePaths::check(fflush($out) && fsync($out));
            } finally { fclose($out); }
        } finally { fclose($in); }
    }

    /** Read-back verification and restore share the same framed, bounded-memory decoder. */
    public static function unseal(string $cipher, string $name, string $key, ?string $output = null): string
    {
        PrivatePaths::file($cipher);
        $in = fopen($cipher, 'rb');
        $hash = hash_init('sha256');
        try {
            $out = $output === null ? null : fopen($output, 'xb');
            try {
                PrivatePaths::check(fread($in, strlen(self::MAGIC)) === self::MAGIC);
                $header = fread($in, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES);
                $state = sodium_crypto_secretstream_xchacha20poly1305_init_pull($header, $key);
                while (true) {
                    $lengthBytes = fread($in, 4);
                    PrivatePaths::check(strlen($lengthBytes) === 4);
                    $length = unpack('Nlen', $lengthBytes)['len'];
                    $overhead = SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_ABYTES;
                    PrivatePaths::check($length >= $overhead && $length <= self::CHUNK + $overhead);
                    $frame = fread($in, $length);
                    PrivatePaths::check(strlen($frame) === $length);
                    $decoded = sodium_crypto_secretstream_xchacha20poly1305_pull($state, $frame, $name);
                    PrivatePaths::check($decoded !== false);
                    [$chunk, $tag] = $decoded;
                    if ($tag === SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL) {
                        PrivatePaths::check($chunk === '' && fread($in, 1) === '' && feof($in));
                        break;
                    }
                    PrivatePaths::check($tag === SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE && $chunk !== '');
                    hash_update($hash, $chunk);
                    if ($out !== null) self::write($out, $chunk);
                }
                if ($out !== null) PrivatePaths::check(fflush($out) && fsync($out));
            } finally { if (is_resource($out)) fclose($out); }
        } finally { fclose($in); }
        return hash_final($hash);
    }
}
