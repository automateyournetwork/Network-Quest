<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Local proxy/readiness adapter outside server/public. The shared entry owns API routing.
// Never returns false: the PHP built-in server must not serve arbitrary files.
$token = getenv('NQ_DEV_PROXY_TOKEN');
if (!is_string($token) || $token === ''
    || !hash_equals($token, $_SERVER['HTTP_X_NQ_DEV_PROXY'] ?? '')) {
    http_response_code(404);
    return;
}

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
if ($_SERVER['REQUEST_URI'] === '/__nq_dev_ready') {
    header('X-NQ-Dev-Ready: ' . $token);
    http_response_code(204);
    return;
}

require dirname(__DIR__) . '/server/public/index.php';
