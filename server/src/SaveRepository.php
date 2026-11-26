<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use Closure;
use InvalidArgumentException;
use LogicException;
use PDO;

/** Internal service result. T044 adds a server correlation UUID and no-store HTTP headers. */
final readonly class SaveWriteResult
{
    private function __construct(
        public int $status,
        public ?string $code,
        public ?string $message,
        public ?array $acknowledgement,
        public ?array $currentSummary,
        public ?string $etag,
    ) {
    }

    public static function acknowledged(int $status, array $metadata, bool $replayed, array $summary): self
    {
        return new self($status, null, null, $metadata + ['replayed' => $replayed, 'currentSummary' => $summary], $summary, $summary['etag']);
    }

    /** Fixed messages only. No validation path, SQL, snapshot, credential or request echo. */
    public static function problem(string $code, ?array $summary = null): self
    {
        [$status, $message] = match ($code) {
            'precondition-required' => [428, 'Review the save slot before saving.'],
            'idempotency-conflict' => [409, 'This request key already belongs to a different save operation.'],
            'autosave-disabled' => [409, 'Autosave is disabled for this account.'],
            'manual-adoption-required' => [409, 'Save this adventure manually after reviewing the existing slot.'],
            'replacement-confirmation-required' => [409, 'Confirm replacement of the existing adventure before saving.'],
            'save-conflict' => [412, 'The save slot changed. Review its current summary before replacing it.'],
            'invalid-json' => [400, 'The save request is not valid UTF-8 JSON.'],
            'invalid-save' => [422, 'The save is invalid, unsupported or outside a safe state.'],
            'stored-version-unsupported' => [422, 'The existing save requires a compatible version before replacement.'],
            default => throw new InvalidArgumentException('Unsupported save problem.'),
        };
        return new self($status, $code, $message, null, $code === 'save-conflict' ? $summary : null,
            $code === 'save-conflict' ? ($summary['etag'] ?? null) : null);
    }
}

/**
 * Authenticated conditional writes to one account slot. No routes, provider IO, config
 * discovery, account creation or migration. T044 must supply reviewed policy/config and
 * bounded transport; no production policy is implied by the synthetic service tests.
 * T045 MUST additionally honor/reconcile external deletion markers under its shared
 * write barrier before account access, including both receipt paths. Active DB status
 * and FKs alone cannot protect a restored DB against an outstanding external intent.
 */
final class SaveRepository
{
    private const MAX_REVISION = 9007199254740991;
    private const RECEIPT_SECONDS = 604800;
    private readonly Closure $clock;
    private readonly ?Closure $phaseObserver;

    /**
     * replaceableVersions is a reviewed list of ['saveSchemaVersion'=>int,
     * 'contentVersion'=>string] pairs. It describes stored reader/migration support,
     * separately from the validator's CURRENT new-write policy. [] fails closed for
     * replacement, never blocks retained acknowledgements. Never infer from payloads.
     * Clock and optional observer are trusted constructor dependencies only. Observer
     * receives fixed phase names outside transactions, no request data and no authority;
     * its return is ignored. Never wire it to HTTP input, config or a test-auth flag.
     */
    public function __construct(
        private readonly Database $database,
        private readonly Sessions $sessions,
        private readonly Security $security,
        private readonly SaveValidator $validator,
        private readonly array $replaceableVersions,
        ?callable $clock = null,
        ?callable $phaseObserver = null,
        private readonly string $route = '/arcade/play/network-quest/api/v1/save',
    ) {
        if (!array_is_list($replaceableVersions)) { throw new InvalidArgumentException('Expected explicit stored-version policy.'); }
        foreach ($replaceableVersions as $version) {
            if (!is_array($version) || count($version) !== 2 || !is_int($version['saveSchemaVersion'] ?? null)
                || $version['saveSchemaVersion'] < 1 || $version['saveSchemaVersion'] > self::MAX_REVISION
                || !is_string($version['contentVersion'] ?? null) || strlen($version['contentVersion']) < 1
                || strlen($version['contentVersion']) > 32 || preg_match('/[\x00-\x1f\x7f]/', $version['contentVersion'])) {
                throw new InvalidArgumentException('Invalid stored-version policy.');
            }
        }
        if (!preg_match('~^/(?:[a-zA-Z0-9_-]+/)*api/v1/save$~D', $route) || strlen($route) > 256) {
            throw new InvalidArgumentException('Expected an explicit save route.');
        }
        $this->clock = Closure::fromCallable($clock ?? time(...));
        $this->phaseObserver = $phaseObserver === null ? null : Closure::fromCallable($phaseObserver);
    }

    /**
     * peerAddress is trusted socket REMOTE_ADDR, never arbitrary forwarded headers.
     * fields retains raw duplicate header pairs for Security::headers; transport must
     * bound input before buffering, use Security::readBody, enforce JSON media type and
     * reject queries/alternate methods/routes. This port is exclusively PUT to $route.
     * Account identity is always server-derived. Limits include authorized replays.
     * RequestRejected and storage exceptions propagate to Security::problem at T044;
     * do not serialize exceptions or log raw SQL/request/body/credential values.
     */
    public function write(string $peerAddress, array $fields, string $rawBody): SaveWriteResult
    {
        $headers = Security::headers($fields);
        $prior = $this->security->mutation($headers, $this->sessions);
        if (strlen($rawBody) > SaveValidator::MAX_BYTES) { throw new RequestRejected('body-too-large'); }
        $key = $headers['idempotency-key'] ?? '';
        $mode = $headers['x-save-mode'] ?? '';
        $confirmation = $headers['x-confirm-adventure-replacement'] ?? null;
        if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iD', $key)
            || !in_array($mode, ['manual', 'automatic'], true) || ($confirmation !== null && $confirmation !== 'true')) {
            throw new RequestRejected('invalid-request');
        }
        $match = $headers['if-match'] ?? null;
        $none = $headers['if-none-match'] ?? null;
        if ($match !== null && $none !== null) { throw new RequestRejected('invalid-request'); }
        if ($match === null && $none === null) { return SaveWriteResult::problem('precondition-required'); }
        $reviewedRevision = null;
        if ($none !== null) {
            if ($none !== '*') { throw new RequestRejected('invalid-request'); }
        } else {
            if (!preg_match('/^"save-([1-9][0-9]{0,15})"$/D', $match, $capture)
                || strlen($capture[1]) > 16 || (strlen($capture[1]) === 16 && strcmp($capture[1], (string) self::MAX_REVISION) > 0)) {
                throw new RequestRejected('invalid-request');
            }
            $reviewedRevision = (int) $capture[1];
        }
        $this->security->limit('save', $prior, $peerAddress);
        $fingerprint = self::fingerprint('PUT', $this->route, $mode, $confirmation,
            $none === null ? 'if-match' : 'if-none-match', $match ?? $none, $rawBody);
        $this->observe('admitted');
        // Initial lookup is itself under CURRENT authorization, not just the admission snapshot.
        $replay = $this->database->immediate(fn (PDO $pdo): ?SaveWriteResult =>
            $this->sessions->within($pdo, $prior, fn (SessionContext $current): ?SaveWriteResult =>
                $this->receipt($pdo, $current->accountId, $key, $fingerprint, $this->now())));
        if ($replay !== null) { return $replay; }

        // Expensive parsing/schema/semantic work occurs only here, outside the write lock.
        $validation = $this->validator->validateNewWrite($rawBody);
        $candidate = $validation->candidate();
        $this->observe('validated');
        return $this->database->immediate(function (PDO $pdo) use ($prior, $key, $mode, $confirmation,
            $reviewedRevision, $fingerprint, $rawBody, $validation, $candidate): SaveWriteResult {
            return $this->sessions->within($pdo, $prior, function (SessionContext $current) use ($pdo,
                $key, $mode, $confirmation, $reviewedRevision, $fingerprint, $rawBody, $validation, $candidate): SaveWriteResult {
                $now = $this->now();
                $account = $current->accountId;
                $replay = $this->receipt($pdo, $account, $key, $fingerprint, $now);
                if ($replay !== null) { return $replay; }
                // No provisional error may escape before the two checks immediately above.
                if (!$validation->ok) { return SaveWriteResult::problem($validation->code === 'json' ? 'invalid-json' : 'invalid-save'); }
                $slot = $this->slot($pdo, $account);
                if ($slot !== null && !$this->replaceable($slot)) { return SaveWriteResult::problem('stored-version-unsupported'); }
                $preference = $pdo->prepare('SELECT autosave_enabled FROM preferences WHERE account_id=?');
                $preference->execute([$account]);
                $autosave = $preference->fetchColumn();
                // A write never creates/defaults an account's missing preference row.
                if ($autosave === false) { throw new RequestRejected('unavailable'); }
                $sameAdventure = $slot !== null && strtolower($slot['adventure_id']) === strtolower($candidate->adventureId);
                if ($mode === 'automatic') {
                    if ($autosave !== 1) { return SaveWriteResult::problem('autosave-disabled'); }
                    if (!$sameAdventure) { return SaveWriteResult::problem('manual-adoption-required'); }
                } elseif ($slot !== null && !$sameAdventure && $confirmation !== 'true') {
                    return SaveWriteResult::problem('replacement-confirmation-required');
                }
                if (($reviewedRevision === null && $slot !== null)
                    || ($reviewedRevision !== null && ($slot === null || $slot['revision'] !== $reviewedRevision))) {
                    return SaveWriteResult::problem('save-conflict', $slot === null ? null : $this->summary($slot));
                }
                if ($slot !== null && $slot['revision'] >= self::MAX_REVISION) { throw new RequestRejected('unavailable'); }
                $revision = $slot === null ? 1 : $slot['revision'] + 1;
                $summary = ['revision' => $revision, 'etag' => '"save-' . $revision . '"', 'savedAt' => self::date($now),
                    'adventureId' => $candidate->adventureId, 'episodeId' => $candidate->episodeId,
                    'roomId' => $candidate->world->roomId, 'outcome' => $candidate->world->continueOutcome,
                    'saveSchemaVersion' => $candidate->saveSchemaVersion, 'contentVersion' => $candidate->contentVersion];
                $values = [$revision, $now, $candidate->saveSchemaVersion, $candidate->contentVersion,
                    $candidate->adventureId, $rawBody, hash('sha256', $rawBody), json_encode($summary, JSON_THROW_ON_ERROR), $account];
                if ($slot === null) {
                    $write = $pdo->prepare('INSERT INTO saves(revision,saved_at,schema_version,content_version,adventure_id,payload_json,payload_hash,summary_json,account_id)
                        VALUES(?,?,?,?,?,?,?,?,?)');
                } else {
                    $write = $pdo->prepare('UPDATE saves SET revision=?,saved_at=?,schema_version=?,content_version=?,adventure_id=?,payload_json=?,payload_hash=?,summary_json=?
                        WHERE account_id=? AND revision=?');
                    $values[] = $reviewedRevision;
                }
                $write->execute($values);
                if ($write->rowCount() !== 1) { throw new RequestRejected('unavailable'); }
                // Delete ONLY this expired key, only as part of a successful new operation.
                $pdo->prepare('DELETE FROM write_receipts WHERE account_id=? AND request_id=? AND expires_at<=?')->execute([$account, $key, $now]);
                // acknowledgement_json is generated metadata by the DB, never supplied payload.
                $pdo->prepare('INSERT INTO write_receipts(account_id,request_id,fingerprint,committed_revision,committed_at,expires_at)
                    VALUES(?,?,?,?,?,?)')->execute([$account, $key, $fingerprint, $revision, $now, $now + self::RECEIPT_SECONDS]);
                return SaveWriteResult::acknowledged($slot === null ? 201 : 200,
                    ['requestId' => $key, 'committedRevision' => $revision, 'committedAt' => self::date($now)], false, $summary);
            });
        }); // Database commits before the result can reach the caller; any failure rolls back both.
    }

    /**
     * Versioned, length-delimited bytes: no separator ambiguity or JSON normalization.
     * Cookie/CSRF, request key and server-generated time are NOT operation semantics.
     * Keys are opaque case-sensitive UUID spellings (SQLite BINARY); no key normalization.
     * Adventure UUID identity compares case-insensitively, with original text stored/returned.
     */
    public static function fingerprint(string $method, string $path, string $mode, ?string $confirmation,
        string $conditionName, string $condition, string $rawBody): string
    {
        $hash = hash_init('sha256');
        foreach (['NetworkQuest/save-fingerprint/v1', $method, $path, $mode, $confirmation ?? '', $conditionName, $condition, $rawBody] as $part) {
            hash_update($hash, pack('N', strlen($part)) . $part);
        }
        return hash_final($hash);
    }

    private function receipt(PDO $pdo, string $account, string $key, string $fingerprint, int $now): ?SaveWriteResult
    {
        $query = $pdo->prepare('SELECT fingerprint,acknowledgement_json FROM write_receipts WHERE account_id=? AND request_id=? AND expires_at>?');
        $query->execute([$account, $key, $now]);
        $receipt = $query->fetch();
        if ($receipt === false) { return null; }
        if (!hash_equals($receipt['fingerprint'], $fingerprint)) { return SaveWriteResult::problem('idempotency-conflict'); }
        $slot = $this->slot($pdo, $account);
        if ($slot === null) { throw new RequestRejected('unavailable'); }
        return SaveWriteResult::acknowledged(200, json_decode($receipt['acknowledgement_json'], true, 8, JSON_THROW_ON_ERROR), true, $this->summary($slot));
    }

    private function slot(PDO $pdo, string $account): ?array
    {
        // No snapshot parsing/copying under the lock, even on a replay of unknown stored content.
        $query = $pdo->prepare('SELECT revision,saved_at,schema_version,content_version,adventure_id,summary_json FROM saves WHERE account_id=?');
        $query->execute([$account]);
        $slot = $query->fetch();
        return $slot === false ? null : $slot;
    }

    private function summary(array $slot): array
    {
        $summary = json_decode($slot['summary_json'], true, 8, JSON_THROW_ON_ERROR);
        if (!is_array($summary) || !is_string($summary['episodeId'] ?? null) || mb_strlen($summary['episodeId']) > 32
            || !is_string($summary['roomId'] ?? null) || mb_strlen($summary['roomId']) > 64
            || !array_key_exists('outcome', $summary) || !in_array($summary['outcome'], [null, 'E01', 'E02'], true)) {
            throw new RequestRejected('unavailable');
        }
        // Fixed public projection; server columns own current revision/version, not old
        // acknowledgement metadata or duplicated fields in the stored display summary.
        return ['revision' => $slot['revision'], 'etag' => '"save-' . $slot['revision'] . '"',
            'savedAt' => self::date($slot['saved_at']), 'adventureId' => $slot['adventure_id'],
            'episodeId' => $summary['episodeId'], 'roomId' => $summary['roomId'], 'outcome' => $summary['outcome'],
            'saveSchemaVersion' => $slot['schema_version'], 'contentVersion' => $slot['content_version']];
    }

    private function replaceable(array $slot): bool
    {
        foreach ($this->replaceableVersions as $version) {
            if ($version['saveSchemaVersion'] === $slot['schema_version'] && $version['contentVersion'] === $slot['content_version']) { return true; }
        }
        return false;
    }

    private function observe(string $phase): void
    {
        if ($this->database->connection()->inTransaction()) { throw new LogicException('Save phases must be outside transactions.'); }
        if ($this->phaseObserver !== null) { ($this->phaseObserver)($phase); }
    }

    private function now(): int
    {
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253401695999) { throw new LogicException('Save clock is outside supported UTC bounds.'); }
        return $now;
    }

    private static function date(int $seconds): string { return gmdate('Y-m-d\TH:i:s\Z', $seconds); }
}
