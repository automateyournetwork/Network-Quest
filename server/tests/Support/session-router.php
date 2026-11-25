<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Test-only native PHP session fixture. Never loaded by public/index.php.

header_remove('X-Powered-By');
header('Cache-Control: no-store');
header('Content-Type: application/json; charset=utf-8');
$token = getenv('NQ_DEV_PROXY_TOKEN');
$session = getenv('NQ_HARNESS_SESSION');
$directory = getenv('NQ_HARNESS_DIRECTORY');
if (PHP_SAPI !== 'cli-server' || getenv('NQ_ENVIRONMENT') !== 'local'
    || !is_string($token) || !hash_equals($token, $_SERVER['HTTP_X_NQ_DEV_PROXY'] ?? '')
    || ($_SERVER['REMOTE_ADDR'] ?? '') !== '127.0.0.1' || ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') !== 'https'
    || !is_string($session) || !preg_match('/^[a-f0-9]{64}$/D', $session)
    || !is_string($directory) || realpath($directory) !== $directory
    || !preg_match('~/network-quest-tests-[a-f0-9]{48}$~D', $directory)
    || is_link($directory) || (fileperms($directory) & 0777) !== 0700
    || !is_file($directory . '/sess_' . $session) || is_link($directory . '/sess_' . $session)) {
    http_response_code(404);
    return;
}
$base = '/arcade/play/network-quest/';
$path = $_SERVER['REQUEST_URI'];
$issue = $path === $base . '__fixture/issue' && $_SERVER['REQUEST_METHOD'] === 'POST';
$inspect = $path === $base . '__fixture/session' && $_SERVER['REQUEST_METHOD'] === 'GET';
if (!$issue && !$inspect) {
    http_response_code(404);
    return;
}
if ($inspect && !hash_equals($session, $_COOKIE['__Secure-nq_session'] ?? '')) {
    http_response_code(401);
    return;
}
session_name('__Secure-nq_session');
session_id($session);
session_set_cookie_params(['lifetime' => 0, 'path' => $base, 'secure' => true,
    'httponly' => true, 'samesite' => 'Lax']);
if (!session_start(['save_path' => $directory, 'use_strict_mode' => 1, 'use_only_cookies' => 1,
    'use_trans_sid' => 0, 'gc_probability' => 0, 'serialize_handler' => 'php'])) {
    http_response_code(503);
    return;
}
$identity = $_SESSION['identity'] ?? null;
session_write_close();
if (!is_string($identity) || !str_starts_with($identity, 'fixture-')) {
    http_response_code(503);
    return;
}
echo json_encode(['synthetic' => true, 'identity' => $identity], JSON_THROW_ON_ERROR);
