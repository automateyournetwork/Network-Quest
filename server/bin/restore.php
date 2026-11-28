<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
ini_set('display_errors', '0');
ini_set('log_errors', '0');
try {
    require_once dirname(__DIR__) . '/src/Operations/Command.php';
    exit(\NetworkQuest\Operations\Command::main(true, $argv));
} catch (Throwable) {
    fwrite(STDERR, '{"ok":false,"operation":"startup","reason":"operational-check-failed"}' . "\n");
    exit(1);
}
