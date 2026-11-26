<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest;

use Closure;
use LogicException;

/** Read-only operation status; no account/session/identity/deletion/recovery dependencies. */
final class DeletionReceipts
{
    private readonly Closure $clock;
    public function __construct(private readonly DeletionLedger $ledger, private readonly Security $security, ?callable $clock = null)
    { $this->clock = Closure::fromCallable($clock ?? time(...)); }

    /**
     * T046 rejects body/query selectors and maps null to indistinguishable unknown/expired404.
     * Requires exact Origin and only canonical operation token. Applies existing receipt/source
     * rate bounds under the external lock, with no overlapping ledger/game transaction. Never runs reconciliation.
     * A narrow result cannot authorize, sign in, delete, expose account/progress, or prove guest
     * status. Route returns no-store; raw headers/tokens never belong in logs or error text.
     */
    public function status(string $peerAddress, array $fields): ?array
    {
        $headers = Security::headers($fields);
        $now = ($this->clock)();
        if (!is_int($now) || $now < 0 || $now > 253402300799) { throw new LogicException('Receipt clock is outside supported UTC bounds.'); }
        return $this->ledger->exclusive(function () use ($headers, $peerAddress, $now): ?array {
            $hash = $this->security->deletionStatus($headers, $peerAddress);
            $receipt = $this->ledger->receipt($hash, $now);
            return $receipt === null ? null : ['state' => $receipt['state'], 'expiresAt' => gmdate('Y-m-d\TH:i:s\Z', $receipt['expiresAt'])];
        });
    }
}
