# PHP dependency bootstrap — T009

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Date: 2026-11-25. Worker: `/root/loop011_t009`, loop 011/200. Baseline commit:
`d4482767aa3c9c794d1cf28d61b40f8aba2279c7`; existing uncommitted work preserved.
Coverage: W01/G0 preparation, C2/C6/C12/C13/C15, FR-023/024, AC16/17/19.

**T009 scoped result: PASS. G0 remains BLOCKED.** The explicit setup exception
permits this dependency/configuration preparation after T008. No service route,
authentication, save implementation, foundation work, provider contact or deployment
was added. This is local bootstrap evidence, not episode acceptance.

## Files and configuration boundary

- `server/composer.json` pins the four direct dependencies below and requires PHP
  `~8.4.0` plus ctype, curl, filter, hash, json, mbstring, openssl, PDO, pdo_sqlite
  and session. It declares Apache-2.0 for original code, disallows Composer
  plugins, enables extension checks in generated autoloading, and has no scripts
  or platform-version override.
- `server/composer.lock` fixes 20 production and 25 development packages.
- `server/phpunit.xml` loads only `vendor/autoload.php`, discovers `tests/*Test.php`,
  and fails on an empty suite, risky tests, warnings, notices and deprecations.
  `server/tests/README.md` explains that T020 still owns the actual isolated test
  harness. No placeholder test or success script was created.
- `server/config.example.php` is an inert array template. Environment, exact HTTPS
  origin, private paths, provider credentials and callbacks are empty and must be
  supplied. Its comments define the future explicit `NQ_CONFIG_FILE` input outside
  both the repository and every document root. It reads no environment or file,
  starts no session, opens no storage, and provides no test-auth fallback.
- The example separates the dedicated game DB, logs, encrypted backups, recovery
  ledger and protected key locations. Future loading must reject missing values,
  resolve symlinks/parents, check all document roots and permissions, and reject
  website/analytics storage. **That loader and path enforcement are not implemented
  by T009.** Deletion-marker retention remains unset until actual backup retention
  is known; it is not inferred from the seven-day application policy.
- The documented session cookie is Secure, HttpOnly, SameSite=Lax, host-only and
  game-path scoped. Google scopes are exactly `openid profile`; GitHub scopes are
  explicitly empty. These are configuration defaults, not tested OAuth/session
  behavior. `server/public/.gitkeep` preserves an empty isolated docroot for T011;
  it contains no API entry or private configuration.

## Frozen graph and review

| Direct package | Exact installed version |
| --- | --- |
| google/apiclient | 2.20.1 |
| league/oauth2-client | 2.10.0 |
| opis/json-schema | 2.6.3 |
| phpunit/phpunit (development) | 12.5.45 |

Selected transitive versions include google/auth 1.55.3, google/apiclient-services
0.468.0, firebase/php-jwt 7.2.2, Guzzle 8.6.0, PSR-7 3.6.0 and promises 3.2.0.
The actual solver confirms the Google/League HTTP dependency intersection described
in [runtime.md](runtime.md); no version substitution or platform bypass was needed.

All 45 package records use HTTPS `github.com` source and `api.github.com` ZIP
distribution URLs with matching 40-character source/dist revision references.
No private/local repository, Composer plugin or installer package appears. The
lock contains no archive `shasum` values; revision pinning and HTTPS delivery are
not claimed as separately verified publisher archive checksums. T010 owns the
license/notices inventory and was notified when this lock/vendor became stable.

Reviewed installed package manifests. Their scripts are upstream test/static-analysis
commands, with no root install hooks. Composer dependency scripts are not root
installation scripts. The initial solve disabled all scripts/plugins; the isolated
production install used the normal installer and the manifest's plugin denial.
Google compatibility aliases/loaders, Symfony polyfills and test helper function
autoloading remain vendor behavior; actual dependency class loading succeeded.
No vendor cleanup/patch or library authentication call was introduced.

Composer audit returned empty `advisories`, `abandoned`, `filter` and `cooldown`
lists, exit 0. This is the observed registry result on this date, not a security
guarantee or a substitute for later service review.

## Executed checks

All checks used PHP **8.4.28** and Composer **2.11.3** from T002. From repository root,
the Composer command prefix was:

```sh
PATH="/opt/homebrew/opt/php@8.4/bin:$PATH" \
COMPOSER_HOME="$PWD/.runtime/composer-home" \
COMPOSER_CACHE_DIR="$PWD/.runtime/composer-cache" \
/opt/homebrew/opt/php@8.4/bin/php .runtime/composer-2.11.3.phar
```

| Command/check after that prefix where applicable | Observed result |
| --- | --- |
| `update --working-dir=server --no-plugins --no-scripts --prefer-dist --no-interaction --no-progress` | Exit 0; 45 locked/installed, autoloader generated, no advisories |
| `validate --working-dir=server --strict` | Exit 1 solely for three exact-production-version constraint style warnings; intentional pins retained |
| `validate --working-dir=server --strict --no-check-all` | Exit 0; JSON/lock valid; only overly strict/loose constraint style checking excluded |
| `check-platform-reqs --working-dir=server` | Exit 0; actual PHP plus all 16 required extensions pass, including development requirements |
| `audit --working-dir=server --format=json` | Exit 0; all four result lists empty |
| PHP syntax check of `server/config.example.php` | Exit 0; no syntax errors |
| PHP DOM `schemaValidate` against installed PHPUnit's local `phpunit.xsd` | Pass; no remote XSD fetch |
| `php vendor/bin/phpunit --configuration phpunit.xml` from `server/` | **Exit 1: No tests executed!** Config loads without warnings; the empty suite cannot be reported as passing |
| Ignore/whitespace checks | `vendor/` and `.phpunit.cache/` ignored; `git diff --check` clean |

An inline PHP probe used explicit exceptions on failed conditions (not disabled
PHP assertions). It loaded Google Client, League GenericProvider, Opis Validator
and PHPUnit TestCase classes. An inline Draft 2020-12 array schema used
`prefixItems`, integer minimum 1, `items: false` and `minItems: 2`: accepted
`["network-quest", 1]`, rejected 0, a numeric string and an extra tail item.
A UUID format schema accepted a valid UUID and rejected `invalid`. An unregistered
HTTPS URI returned null from a fresh Opis resolver; no remote protocol fetcher was
registered. These six primitive cases do not establish shared Ajv/Opis save-schema
conformance or semantic validation.

The same probe checked that all required template inputs remain empty, minimal
scopes and cookie policies match the contract, cookie path matches game base,
deletion-ledger retention is null, and loading the template starts no PHP session.
It did not read a private configuration or environment file.

### Independent production-only install

A Python `TemporaryDirectory(prefix='network-quest-t009-')` outside the repository
received only `server/composer.json` and `server/composer.lock`. Subprocesses used
an empty temporary HOME, fresh Composer home/cache and the explicit PHP/system
PATH. No inherited provider environment, credential/config file, website source,
installed vendor directory or player data was copied.

1. `composer install --no-dev --prefer-dist --optimize-autoloader --no-interaction
   --no-progress` exited 0 and downloaded/installed exactly 20 production packages.
2. `composer check-platform-reqs --no-dev` exited 0: PHP and all 11 production
   extension requirements passed (iconv is a transitive requirement).
3. A separate PHP process autoloaded the three production classes and verified
   PHPUnit TestCase was absent. No `vendor/phpunit` directory existed.
4. Lock bytes were unchanged. The temporary copy/cache was removed by its context
   manager. This proves local public-input dependency installation, not full
   independent game packaging or remote-host capability.

### Artifact SHA-256

| File | SHA-256 |
| --- | --- |
| `server/composer.json` | `5bfb5de6638420cbdd0f41404ef8c18d92e6e3a9ac8525b8a52f0a7771c67929` |
| `server/composer.lock` | `0fa6d980d1b29a859a425e0d863268e71d082b0694423d6213f7a4dfdf503007` |
| `server/phpunit.xml` | `13bef06d8262a22804ecbd0539e98d85db3cc267972276ab1f5a757aac768458` |
| `server/config.example.php` | `5e560a9655cbb25932a6d383b3196d50d22a0c2506e29b190930461efa3bcee9` |

Official references consulted on 2026-11-25: [Composer configuration](https://getcomposer.org/doc/06-config.md)
for plugin/platform controls; [PHPUnit 12.5 configuration](https://docs.phpunit.de/en/12.5/configuration.html)
for empty-suite and issue behavior; [Opis Validator](https://opis.io/json-schema/2.x/php-validator.html)
for primitive validation and explicit remote-fetcher registration. Installed source
was also inspected for the actual default resolver behavior.

T011 HTTPS/PHP startup and T020 test harness remain future tasks. Configuration
validation, secure sessions, real providers, SQLite disk/concurrency/recovery,
backup encryption selection, host readiness and all application acceptance are
unverified. No task checkbox, gate, tracking file, secret, remote host or provider
registration was changed by this worker. T012/foundation still requires G0 PASS.
