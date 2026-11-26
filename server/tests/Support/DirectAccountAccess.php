<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Tests\Support;

use LogicException;
use NetworkQuest\AccountAccess;

require_once __DIR__ . '/../../src/AccountAccess.php';

/** Test-only isolated service adapter, never production composition or a runtime auth flag. */
final class DirectAccountAccess implements AccountAccess
{
    public bool $held = false;

    public function run(callable $operation): mixed
    {
        if ($this->held) throw new LogicException('Test account gate is not reentrant.');
        $this->held = true;
        try { return $operation(); }
        finally { $this->held = false; }
    }
}
