# Service test directory

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

T019 supplies router and disposable harness tests. From the repository root:

```sh
/opt/homebrew/opt/php@8.4/bin/php server/vendor/bin/phpunit --configuration server/phpunit.xml
```

Use PHP 8.4.28 and the existing locked PHPUnit 12.5.45 installation. The TLS
transport uses repository Node 26.13.1; an alternative pinned binary may be supplied
as an explicit absolute `NQ_TEST_NODE_BIN`. No dependency installation is performed.
The existing PHPUnit bootstrap loads Composer only; the tests explicitly load their
own source/support files and never load private application configuration. T020 owns
the npm command wrapper and joined browser/domain configuration.

`Support/TestEnvironment.php` allocates a new random mode0700 directory under the
canonical POSIX `/tmp`, outside the repository and document root. It ignores TMPDIR,
accepts no storage path, and creates exclusive mode0600 files. `connect()` accepts
no database path and gives each caller a separate PDO connection to the owned
synthetic database. Tables created by tests are synthetic; no application schema,
migration, account, save, deletion or recovery service is implemented.

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
keys and cannot select a different router or database.

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

The real router returns 503 for every unimplemented contracted operation, 404 for
unknown paths and 405/Allow for unsupported methods. Callback 503 responses are
minimal accessible HTML; other errors follow the API Problem shape. It never
returns a successful session/login/save/deletion or sets an account cookie.
`NQ_CONFIG_FILE` and every recognized test/fixture/auth-bypass input fail closed,
without reading a file. The private configuration template remains inert; its
future absolute-path/document-root/storage checks are still required.

T036 onward owns real sessions, schema/auth/storage, transaction policy, providers,
save/deletion and associated acceptance. Passing this suite does not establish
SAVE01–13, real providers, human review, a gate pass or a deployable release.
