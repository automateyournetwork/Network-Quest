<?php

declare(strict_types=1);

// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0

namespace NetworkQuest\Routes;

use NetworkQuest\AccountDeletion;
use NetworkQuest\Database;
use NetworkQuest\RecoveryAccountAccess;
use NetworkQuest\RequestRejected;
use NetworkQuest\Security;
use NetworkQuest\Sessions;
use PDO;
use Throwable;

/** Confirmed account actions. No request account selector, save, or implicit login. */
final class Account
{
    public function __construct(
        private readonly Database $database,
        private readonly Sessions $sessions,
        private readonly Security $security,
        private readonly RecoveryAccountAccess $accounts,
        private readonly AccountDeletion $deletion,
    ) {}

    /** Trusted transport owns TLS/Host/path/raw-field multiplicity and slow-client bounds. */
    public function handle(string $method, string $route, string $rawQuery, array $rawHeaders, mixed $body, string $peerAddress): array
    {
        try {
            $headers = Security::headers($rawHeaders);
            $peer = Security::peerAddress(['REMOTE_ADDR' => $peerAddress]);
            if ($rawQuery !== '' || !(($method === 'POST' && $route === '/logout')
                || ($method === 'DELETE' && $route === '/account'))) throw new RequestRejected('invalid-request');
            Security::readBody($body, $headers, 0);
            if ($route === '/logout') return $this->logout($headers);

            // Deletion owns its recovery barrier, final purpose-proof check, durable intent,
            // live commit and completion marker. An outer AccountAccess::run would recurse.
            $result = $this->deletion->delete($peer, $rawHeaders);
            $response = Security::problem(new RequestRejected('invalid-request'));
            $response['status'] = $result->status;
            $response['body'] = $result->status === 204 ? '' : json_encode(['code' => $result->code,
                'message' => $result->message, 'requestId' => $response['headers']['X-Request-Id']], JSON_THROW_ON_ERROR);
            return $response;
        } catch (Throwable $error) { return Security::problem($error); }
    }

    private function logout(array $headers): array
    {
        return $this->accounts->run(function () use ($headers): array {
            // The client invokes this only after confirmation; cancel sends no request.
            // Existing guests may also revoke pending login attempts. Expiry never bootstraps.
            $prior = $this->security->mutation($headers, $this->sessions, false);
            $cookie = $this->database->immediate(fn (PDO $pdo): string => $this->sessions->revokeWithin($pdo, $prior));
            // revokeWithin rechecks the session inside the final transaction. Cascades remove
            // only its attempts/proof; all account progress and other sessions stay intact.
            // The exact configured cookie is expired only after COMMIT succeeds.
            $response = Security::problem(new RequestRejected('invalid-request'));
            $response['status'] = 204; $response['body'] = ''; $response['headers']['Set-Cookie'] = $cookie;
            return $response;
        });
    }
}
