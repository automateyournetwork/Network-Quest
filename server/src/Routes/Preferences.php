<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Routes;

use JsonException;
use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\SessionContext;
use NetworkQuest\Sessions;
use PDO;
use Throwable;

/** Independent account settings, updated only against the exact reviewed prefs ETag. */
final class Preferences
{
    private const MAX_REVISION = 9007199254740991;
    private const COLUMNS = ['autosaveEnabled' => 'autosave_enabled', 'musicVolume' => 'music_volume',
        'effectsVolume' => 'effects_volume', 'voiceVolume' => 'voice_volume', 'captions' => 'captions',
        'reducedMotion' => 'reduced_motion', 'textScale' => 'text_scale'];

    public function __construct(
        private readonly Database $database,
        private readonly Sessions $sessions,
        private readonly Security $security,
        private readonly AccountAccess $accounts,
    ) {}

    /** Transport must retain raw header multiplicity and bound slow clients before buffering. */
    public function handle(string $method, string $route, string $rawQuery, array $rawHeaders, mixed $body, string $peerAddress): array
    {
        try {
            $headers = Security::headers($rawHeaders);
            $peer = Security::peerAddress(['REMOTE_ADDR' => $peerAddress]);
            if ($method !== 'PATCH' || $route !== '/preferences' || $rawQuery !== '') throw new RequestRejected('invalid-request');
            if (!preg_match('~^application/json(?:;\s*charset=utf-8)?$~iD', $headers['content-type'] ?? '')) throw new RequestRejected('invalid-request');
            // Seven scalar settings need no large snapshot budget. Never truncate a patch.
            $raw = Security::readBody($body, $headers, 4096);
            return $this->accounts->run(function () use ($headers, $peer, $raw): array {
                $prior = $this->security->mutation($headers, $this->sessions);
                $this->security->limit('preferences', $prior, $peer);
                if (isset($headers['if-none-match'])) throw new RequestRejected('invalid-request');
                $etag = $headers['if-match'] ?? null;
                if ($etag === null) return self::problem(428);
                if (!preg_match('/^"prefs-([1-9][0-9]{0,15})"$/D', $etag, $matches)
                    || (strlen($matches[1]) === 16 && strcmp($matches[1], (string) self::MAX_REVISION) > 0)) throw new RequestRejected('invalid-request');
                $revision = (int) $matches[1];
                $patch = self::patch($raw);
                return $this->database->immediate(fn (PDO $pdo): array => $this->sessions->within($pdo, $prior, function (SessionContext $current) use ($pdo, $revision, $patch): array {
                    $query = $pdo->prepare('SELECT * FROM preferences WHERE account_id=?'); $query->execute([$current->accountId]); $row = $query->fetch();
                    if ($row === false) throw new RequestRejected('unavailable');
                    if ($row['revision'] !== $revision) return self::problem(412);
                    if ($revision >= self::MAX_REVISION) throw new RequestRejected('unavailable');
                    $assignments = []; $values = [];
                    foreach ($patch as $key => $value) {
                        $column = self::COLUMNS[$key]; $assignments[] = $column . '=?';
                        $row[$column] = is_bool($value) ? (int) $value : $value;
                        // PDO execute binds floats as strings; PHP's ordinary string cast
                        // uses fewer digits and can differ from the acknowledged JSON value.
                        $values[] = is_float($value) ? json_encode($value, JSON_PRESERVE_ZERO_FRACTION | JSON_THROW_ON_ERROR) : $row[$column];
                    }
                    $values[] = $current->accountId; $values[] = $revision;
                    // Column names come only from the fixed map; submitted values are bound.
                    $write = $pdo->prepare('UPDATE preferences SET ' . implode(',', $assignments) . ',revision=revision+1 WHERE account_id=? AND revision=?');
                    $write->execute($values); if ($write->rowCount() !== 1) throw new RequestRejected('unavailable');
                    $revision++;
                    $response = Security::problem(new RequestRejected('invalid-request')); $response['status'] = 200;
                    $response['headers']['ETag'] = '"prefs-' . $revision . '"';
                    $response['body'] = json_encode(['revision' => $revision, 'etag' => $response['headers']['ETag'], 'values' => [
                        'autosaveEnabled' => (bool) $row['autosave_enabled'], 'musicVolume' => $row['music_volume'],
                        'effectsVolume' => $row['effects_volume'], 'voiceVolume' => $row['voice_volume'], 'captions' => (bool) $row['captions'],
                        'reducedMotion' => $row['reduced_motion'], 'textScale' => $row['text_scale']]], JSON_THROW_ON_ERROR);
                    return $response;
                }));
            });
        } catch (Throwable $error) { return Security::problem($error); }
    }

    /** Flat JSON scalar grammar retains decoded key identity so duplicate aliases fail too. */
    private static function patch(string $raw): array
    {
        $string = '"(?:[^"\\\\\x00-\x1f]|\\\\(?:["\\\\/bfnrt]|u[0-9a-fA-F]{4}))*"';
        $scalar = '(?:' . $string . '|true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)';
        $pair = $string . '\s*:\s*' . $scalar;
        if (!preg_match('~^\s*\{\s*' . $pair . '(?:\s*,\s*' . $pair . '){0,6}\s*\}\s*$~D', $raw)) throw new RequestRejected('invalid-request');
        try {
            // Native parser supplies UTF-8, surrogate, JSON whitespace and numeric syntax checks.
            json_decode($raw, false, 4, JSON_THROW_ON_ERROR);
            preg_match_all('~(' . $string . ')\s*:\s*(' . $scalar . ')~', $raw, $pairs, PREG_SET_ORDER);
            $patch = [];
            foreach ($pairs as $pair) {
                $key = json_decode($pair[1], true, 2, JSON_THROW_ON_ERROR);
                $value = json_decode($pair[2], true, 2, JSON_THROW_ON_ERROR);
                if (!array_key_exists($key, self::COLUMNS) || array_key_exists($key, $patch)) throw new RequestRejected('invalid-request');
                $valid = match ($key) {
                    'autosaveEnabled', 'captions' => is_bool($value),
                    'reducedMotion' => in_array($value, ['system', 'on', 'off'], true),
                    default => (is_int($value) || is_float($value)) && is_finite((float) $value)
                        && $value >= ($key === 'textScale' ? 1 : 0) && $value <= ($key === 'textScale' ? 2 : 1),
                };
                if (!$valid) throw new RequestRejected('invalid-request');
                $patch[$key] = $value;
            }
            return $patch;
        } catch (JsonException) { throw new RequestRejected('invalid-request'); }
    }

    private static function problem(int $status): array
    {
        $response = Security::problem(new RequestRejected('invalid-request')); $response['status'] = $status;
        [$code, $message] = $status === 428 ? ['precondition-required', 'Review account preferences before changing them.']
            : ['preferences-conflict', 'Account preferences changed. Fetch the current session and review them before retrying.'];
        $response['body'] = json_encode(['code' => $code, 'message' => $message, 'requestId' => $response['headers']['X-Request-Id']], JSON_THROW_ON_ERROR);
        return $response;
    }
}
