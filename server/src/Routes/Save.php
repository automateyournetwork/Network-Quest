<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Routes;

use NetworkQuest\AccountAccess;
use NetworkQuest\Database;
use NetworkQuest\RequestRejected;
use NetworkQuest\SaveRepository;
use NetworkQuest\SaveValidator;
use NetworkQuest\SaveWriteResult;
use NetworkQuest\Security;
use NetworkQuest\SessionContext;
use NetworkQuest\Sessions;
use PDO;
use Throwable;

/** Raw request handler; trusted transport owns TLS/Host/path/duplicate-field admission. */
final class Save
{
    public function __construct(
        private readonly Database $database,
        private readonly Sessions $sessions,
        private readonly Security $security,
        private readonly SaveRepository $repository,
        private readonly AccountAccess $accounts,
    ) {}

    /** Same port as Auth. Never pass normalized SAPI fields as proof of no duplicates. */
    public function handle(string $method, string $route, string $rawQuery, array $rawHeaders, mixed $body, string $peerAddress): array
    {
        try {
            $headers = Security::headers($rawHeaders);
            $peer = Security::peerAddress(['REMOTE_ADDR' => $peerAddress]);
            if ($route !== '/save' || $rawQuery !== '' || !in_array($method, ['GET', 'PUT'], true)) throw new RequestRejected('invalid-request');
            if ($method === 'GET') {
                Security::readBody($body, $headers, 0);
                if (isset($headers['origin'])) $this->security->exactOrigin($headers);
                return $this->read($headers);
            }
            if (!preg_match('~^application/json(?:;\s*charset=utf-8)?$~iD', $headers['content-type'] ?? '')) throw new RequestRejected('invalid-request');
            $raw = Security::readBody($body, $headers, SaveValidator::MAX_BYTES);
            // Repository owns admission/rate, initial receipt and final transaction barriers.
            // An outer barrier would nest run and hold it across semantic validation.
            return self::written($this->repository->write($peer, $rawHeaders, $raw));
        } catch (Throwable $error) { return Security::problem($error); }
    }

    private function read(array $headers): array
    {
        return $this->accounts->run(function () use ($headers): array {
            $prior = $this->sessions->require($headers['cookie'] ?? null);
            return $this->database->immediate(fn (PDO $pdo): array => $this->sessions->within($pdo, $prior, function (SessionContext $current) use ($pdo): array {
                $query = $pdo->prepare('SELECT revision,saved_at,schema_version,content_version,adventure_id,payload_json,payload_hash,summary_json FROM saves WHERE account_id=?');
                $query->execute([$current->accountId]); $slot = $query->fetch();
                $response = Security::problem(new RequestRejected('invalid-request'));
                if ($slot === false) {
                    $response['status'] = 404;
                    $response['body'] = json_encode(['code' => 'save-not-found', 'message' => 'This account has no saved adventure.',
                        'requestId' => $response['headers']['X-Request-Id']], JSON_THROW_ON_ERROR);
                    return $response;
                }
                $summary = json_decode($slot['summary_json'], true, 8, JSON_THROW_ON_ERROR);
                if (!is_array($summary) || !is_string($summary['episodeId'] ?? null) || mb_strlen($summary['episodeId']) > 32
                    || !is_string($summary['roomId'] ?? null) || mb_strlen($summary['roomId']) > 64
                    || !array_key_exists('outcome', $summary) || !in_array($summary['outcome'], [null, 'E01', 'E02'], true)
                    || !mb_check_encoding($slot['payload_json'], 'UTF-8')
                    || !hash_equals($slot['payload_hash'], hash('sha256', $slot['payload_json']))) throw new RequestRejected('unavailable');
                $public = ['revision' => $slot['revision'], 'etag' => '"save-' . $slot['revision'] . '"',
                    'savedAt' => gmdate('Y-m-d\TH:i:s\Z', $slot['saved_at']), 'adventureId' => $slot['adventure_id'],
                    'episodeId' => $summary['episodeId'], 'roomId' => $summary['roomId'], 'outcome' => $summary['outcome'],
                    'saveSchemaVersion' => $slot['schema_version'], 'contentVersion' => $slot['content_version']];
                $response['status'] = 200; $response['headers']['ETag'] = $public['etag'];
                // Storage CHECK requires bounded valid JSON object. Embed those exact bytes:
                // decoding/re-encoding could lose unknown future fields, objects or numbers.
                // Today's new-write policy is intentionally absent from this read path.
                $response['body'] = '{"summary":' . json_encode($public, JSON_THROW_ON_ERROR) . ',"snapshot":' . $slot['payload_json'] . '}';
                return $response;
            }));
        });
    }

    private static function written(SaveWriteResult $result): array
    {
        $response = Security::problem(new RequestRejected('invalid-request'));
        $response['status'] = $result->status;
        if ($result->etag !== null) $response['headers']['ETag'] = $result->etag;
        $data = $result->acknowledgement ?? ['code' => $result->code, 'message' => $result->message,
            'requestId' => $response['headers']['X-Request-Id']];
        if ($result->status === 412) $data['currentSummary'] = $result->currentSummary;
        $response['body'] = json_encode($data, JSON_THROW_ON_ERROR);
        return $response;
    }
}
