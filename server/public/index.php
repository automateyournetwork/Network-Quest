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
    $environment = getenv();
    if (!array_key_exists('NQ_CONFIG_FILE', $environment)) {
        // Public checkout remains inert until an operator supplies explicit private inputs.
        $response = Router::fromEnvironment($environment)->handleServer($_SERVER);
    } else {
        require_once dirname(__DIR__) . '/src/Application.php';
        $application = \NetworkQuest\Application::fromEnvironment($environment);
        $input = fopen('php://input', 'rb');
        try { $response = $application->handleSapi($_SERVER, getallheaders(), $input, PHP_SAPI); }
        finally { if (is_resource($input)) fclose($input); }
    }
} catch (Throwable) {
    // Exception details and raw request data never enter a response or application log.
    $response = Router::unavailableConfiguration($_SERVER['REQUEST_METHOD'] ?? '', $_SERVER['REQUEST_URI'] ?? '');
}
http_response_code($response['status']);
foreach ($response['headers'] as $name => $value) {
    header($name . ': ' . $value);
}
echo $response['body'];
