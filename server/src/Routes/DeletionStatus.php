<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Routes;

use NetworkQuest\DeletionReceipts;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use Throwable;

/** Narrow receipt-only status. Deliberately no session, account, deletion or recovery port. */
final class DeletionStatus
{
    public function __construct(private readonly DeletionReceipts $receipts) {}

    /** Transport retains raw fields and enforces TLS/Host/path and bounded request buffering. */
    public function handle(string $method, string $route, string $rawQuery, array $rawHeaders, mixed $body, string $peerAddress): array
    {
        try {
            $headers = Security::headers($rawHeaders);
            $peer = Security::peerAddress(['REMOTE_ADDR' => $peerAddress]);
            if ($method !== 'POST' || $route !== '/account/deletion-status' || $rawQuery !== '') throw new RequestRejected('invalid-request');
            Security::readBody($body, $headers, 0);
            // This service owns only the external ledger lock and rate admission. Never wrap
            // it in account recovery: a status read cannot finish a pending deletion.
            // Incidental browser Cookie/CSRF fields confer no authority and are never used.
            $status = $this->receipts->status($peer, $rawHeaders);
            $response = Security::problem(new RequestRejected('invalid-request'));
            if ($status === null) {
                $response['status'] = 404;
                $response['body'] = json_encode(['code' => 'deletion-unconfirmed',
                    'message' => 'Deletion could not be confirmed with this receipt.',
                    'requestId' => $response['headers']['X-Request-Id']], JSON_THROW_ON_ERROR);
            } else {
                $response['status'] = 200; $response['body'] = json_encode($status, JSON_THROW_ON_ERROR);
                if ($status['state'] === 'pending') $response['headers']['Retry-After'] = '2';
            }
            return $response;
        } catch (Throwable $error) { return Security::problem($error); }
    }
}
