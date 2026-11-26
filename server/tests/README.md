# Service test directory

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The suite covers routing, sessions, actual provider adapters with synthetic HTTP,
conditional saves, preferences, durable deletion and configured entry integration.
From the repository root:

```sh
/opt/homebrew/opt/php@8.4/bin/php server/vendor/bin/phpunit --configuration server/phpunit.xml
```

Use PHP 8.4.28 and the existing locked PHPUnit 12.5.45 installation. The TLS
transport uses repository Node 26.13.1; an alternative pinned binary may be supplied
as an explicit absolute `NQ_TEST_NODE_BIN`. No dependency installation is performed.
The existing PHPUnit bootstrap loads Composer only; the tests explicitly load their
own source/support files. Configured-entry tests load only explicitly owned
synthetic JSON, never production application configuration or OAuth files.
The npm wrapper is `npm run test:api` with `NQ_PHP_BIN` set to the pinned PHP.

`Support/TestEnvironment.php` allocates a new random mode0700 directory under the
canonical POSIX `/tmp`, outside the repository and document root. It ignores TMPDIR,
accepts no storage path, and creates exclusive mode0600 files. `connect()` accepts
no database path and gives each caller a separate PDO connection to the owned
synthetic database. Tests explicitly apply the actual game migrations to these
disposable stores. Recovery tests use a separate owned environment and stable
private lock file outside the game rollback roots, with explicitly synthetic
retention values that establish no hosting policy.

Wrap each environment in `try/finally` and call `close()`. Cleanup stops/reaps its
processes and rolls back its own pending transactions before removing only tracked
files. It verifies directory/file ownership and inode identity, refuses symlinks,
hardlinks, public permissions and unowned entries, and never recursively deletes
or adopts an existing directory. If an ownership check fails, cleanup leaves the
files for explicit review. SQLite's temporary rollback journal is permitted only
while owned connections exist; it must disappear after rollback before removal.

`startApi()` runs the real entry at the production-shaped nested prefix behind an
isolated loopback HTTPS proxy. The proxy has an unpredictable token, strips spoofed
forwarding fields and rejects foreign Host/Origin. PHP and Node receive small
explicit environments, with no inherited credentials. The native PHP access log is
discarded because it contains raw query strings; the application emits no request
logs. Negative configuration tests can supply only the allowlisted environment
keys and cannot select a different router or an HTTP authentication bypass.
`startConfiguredApi($file)` accepts only an already tracked private JSON file in
that environment and exercises the actual public entry, application factory and
services. Synthetic account rows may be prepared directly in the isolated store;
real Sessions issues their credentials. This is not provider login evidence.

TLS certificates/keys are generated with the PHP OpenSSL extension into owned
storage. Clients verify both the certificate chain and destination host, with the
test certificate explicitly trusted only on that cURL handle. No validation is
disabled and no machine/browser trust store is changed. Tests also reject a missing
trust anchor and a mismatched hostname. The TLS listener is closed during cleanup.

`createSessionFixture('fixture-player')` plus `startFixtureServer()` runs a separate
test-only native PHP session router. Its one session is precreated and tracked;
the fixture requires the private loopback token and cannot load in the production
entry. It proves transport of a synthetic cookie with Secure, HttpOnly, SameSite=Lax,
host-only and game-path attributes, including a cURL cookie-jar round trip. It is
not authentication, production session ownership or browser cookie acceptance.

The unconfigured entry remains503; unknown paths return404 and unsupported methods
405/Allow. Explicitly configured tests exercise successful guest sessions, auth
start/cancellation, account actions and save/preferences behavior. Provider-success
tests use real adapters/SDK signature checks with synthetic HTTP and ephemeral
keys, without a production runtime handler switch. Recognized test/fixture/auth-
bypass environment inputs remain forbidden. Missing initialized storage, private
path violations or schema/retention mismatch fail closed without provisioning.

Raw TLS tests reject duplicate fields before Node/PHP normalization and verify
body/header limits and actual incomplete-request deadlines. Direct handler calls
are identified separately from native wire tests. Isolated process races and
SIGKILL recovery checks do not claim hardware power-loss or full backup restores.
Passing this suite does not establish SAVE01–13 browser journeys, real providers,
host retention/transport readiness, human review, a gate pass or a deployable release.
