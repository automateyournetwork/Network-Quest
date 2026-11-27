<?php
declare(strict_types=1);
// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
// Isolated CLI-only differential runner. No session, HTTP, account or DB access.
$root = dirname(__DIR__, 4);
require $root . '/server/vendor/autoload.php';
if (!in_array($argv[1] ?? '', ['baseline', 'candidate'], true)) {
    throw new InvalidArgumentException('Choose the fixed baseline or isolated candidate.');
}
require ($argv[1] === 'candidate' ? __DIR__ . '/candidate/SaveValidator.php' : $root . '/server/src/SaveValidator.php');
$input = json_decode(stream_get_contents(STDIN), false, 64, JSON_THROW_ON_ERROR);
$validator = new NetworkQuest\SaveValidator($input->policies);
$results = [];
foreach ($input->cases as $case) {
    $selected = isset($case->policies) ? new NetworkQuest\SaveValidator($case->policies) : $validator;
    $result = $selected->validateNewWrite($case->body);
    $results[] = ['id' => $case->id, 'ok' => $result->ok, 'code' => $result->code,
        'provisional' => $result->provisional, 'exactBytesPreserved' => !$result->ok || $result->candidateJson === $case->body];
}
echo json_encode(['phpVersion' => PHP_VERSION, 'results' => $results], JSON_THROW_ON_ERROR);
