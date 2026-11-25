<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Sole API entry. In CLI-server router mode, NEVER return false/static-file fallback.

use NetworkQuest\Router;

ini_set('display_errors', '0');
ini_set('log_errors', '0');
header_remove('X-Powered-By');
require_once dirname(__DIR__) . '/src/Router.php';

try {
    // No .env, private config, provider credential, body, DB or session is loaded.
    $response = Router::fromEnvironment(getenv())->handleServer($_SERVER);
} catch (Throwable) {
    // Exception details and raw request data never enter a response or application log.
    $response = Router::unavailableConfiguration($_SERVER['REQUEST_METHOD'] ?? '');
}
http_response_code($response['status']);
foreach ($response['headers'] as $name => $value) {
    header($name . ': ' . $value);
}
echo $response['body'];
