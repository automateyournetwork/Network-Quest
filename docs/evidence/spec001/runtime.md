# Spec001 runtime and dependency audit — T002

Date: 2026-11-25. Worker: `/root/loop002_t002`. Baseline commit:
`d4482767aa3c9c794d1cf28d61b40f8aba2279c7`; working tree contains uncommitted planning
and implementation evidence. Coverage: W01/G0, C2/C12/C13/C14/C15, FR-023/024,
AC16/17/19. This is local runtime feasibility and published-constraint evidence.
It does **not** pass G0, application builds, dependency resolution, host readiness,
provider flows or any episode acceptance check.

## Result and selected runtimes

The planned Node 26/PHP 8.4 lines exist and remain supported. Their exact selected
patches now execute on this Mac. Application manifests and locks belong to T008/T009;
the versions below are their verified selection inputs, not an installed application
dependency graph. All external sources in this report were retrieved on 2026-11-25.

| Component | Selected version | Evidence and status |
| --- | --- | --- |
| Node.js | **26.13.1**, Lithium LTS | Official arm64 archive downloaded, SHA-256 matched and executable started. The [release index](https://nodejs.org/dist/index.json) identifies the 2026-11-10 security release; the [support table](https://nodejs.org/en/about/previous-releases) lists Node 26 as LTS and Node 25 as EOL. |
| npm | **11.20.0** | Bundled in the verified Node archive; actual CLI output matches the release index. |
| PHP CLI | **8.4.28**, NTS, 64-bit arm64 | Homebrew core bottle installed and executed. [PHP release announcement](https://www.php.net/releases/8_4_28.php) identifies a security release; [PHP support policy](https://www.php.net/supported-versions.php) supports 8.4 actively through 2026-12-31 and for security through 2028-12-31. |
| Composer | **2.11.3** | Official PHAR downloaded, SHA-256 matched, and CLI started using PHP 8.4.28. [Composer downloads](https://getcomposer.org/download/) and [version feed](https://getcomposer.org/versions) identify the supported 2.11 line and PHP minimum 7.2.5. |
| GoDaddy PHP web/CLI and extensions | **Unverified** | Local PHP cannot establish production capabilities. T003 must inspect both actual host SAPIs and the dedicated game environment. |

PHP 8.4 remains the service language baseline; a newer local PHP minor is not being
silently substituted. No fallback to Node 24 was needed. Installed default Node 25.3.0
is excluded from subsequent project checks, both because it is EOL and because
Vitest 5.1.2's engine range excludes Node 25.

## Observed Mac and local setup

Read-only inventory used `uname -ms`, `sw_vers`,
`sysctl -n hw.model hw.memsize hw.ncpu`, `df -h .`, `command -v`, and version commands.

| Observation | Actual result |
| --- | --- |
| OS and architecture | Darwin arm64; macOS 26.6.2, build 25G83 |
| Hardware | Mac16,7; 51,539,607,552 bytes RAM (48 GiB); 14 logical CPUs |
| Workspace volume before setup | 926 GiB total, 688 GiB used, 218 GiB available (`df` rounded values) |
| Initial shell toolchain | `/opt/homebrew/bin/node` 25.3.0; `/opt/homebrew/bin/npm` 11.7.0; Homebrew, Python 3 and curl available |
| Initial PHP/Composer | Neither command resolved on PATH |
| Selected Node location | `.runtime/node-v26.13.1-darwin-arm64/bin/node` |
| Selected PHP location | `/opt/homebrew/opt/php@8.4/bin/php`, resolving into `/opt/homebrew/Cellar/php@8.4/8.4.28/` |
| Selected Composer location | `.runtime/composer-2.11.3.phar` |
| Final default PATH check | Node/npm remain 25.3.0/11.7.0; `php` and `composer` do not resolve without an explicit path |

The official Node archive and Composer PHAR are local development tools in the ignored
`.runtime/` directory. `git check-ignore` confirmed both tool paths are excluded.
No shell profile was edited. Use explicit paths or a command-scoped PATH so npm scripts
and their child processes use Node 26. These commands are executable now from the
repository root; they do not install application packages:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm --version
/opt/homebrew/opt/php@8.4/bin/php --version
COMPOSER_HOME="$PWD/.runtime/composer-home" COMPOSER_CACHE_DIR="$PWD/.runtime/composer-cache" \
  /opt/homebrew/opt/php@8.4/bin/php .runtime/composer-2.11.3.phar --no-plugins --no-scripts --version
```

For commands that spawn `php`, prepend `/opt/homebrew/opt/php@8.4/bin` to that command's
PATH too. These Mac paths are local conveniences, not dependencies of the public build.
Other contributors must install the selected runtime for their own platform.

### Artifact verification

| Artifact | Source/checksum | Observed SHA-256 and size |
| --- | --- | --- |
| `node-v26.13.1-darwin-arm64.tar.gz` | [Official archive](https://nodejs.org/dist/v26.13.1/node-v26.13.1-darwin-arm64.tar.gz), [SHASUMS256](https://nodejs.org/dist/v26.13.1/SHASUMS256.txt) | `aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735`; 58,340,590 bytes; matched before extraction/execution |
| `composer-2.11.3.phar` | [Official PHAR](https://getcomposer.org/download/2.11.3/composer.phar), [SHA-256](https://getcomposer.org/download/2.11.3/composer.phar.sha256sum) | `04f8b003da4e3a2459056591fbfebd02b4dc3e5adeb158616b90cf55a65113ec`; 3,820,169 bytes; matched before execution |
| PHP 8.4.28 arm64 Tahoe bottle | [Homebrew core formula](https://formulae.brew.sh/formula/php@8.4), [formula JSON](https://formulae.brew.sh/api/formula/php@8.4.json) | Formula advertises bottle digest `25b725388712e0fa450e5fc3d6a2b21ff30eb1151d017539cbd046b3fae33e3e`; Homebrew fetched/poured successfully. This digest is package-manager metadata, not a separately recomputed source-archive hash. |

SHA checks used Python `hashlib` against checksums obtained over HTTPS from the same
official publisher; no separate release-signing-key verification is claimed.
`file` identified both selected Node and PHP executables as Mach-O 64-bit arm64.
Node reported `darwin`, `arm64`, OpenSSL 3.5.9 and module ABI 147.

### Homebrew installation footprint

With coordinator confirmation that ordinary development-tool setup was authorized,
ran `HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_UPGRADE=1 brew install php@8.4`
(exit 0). The [formula](https://formulae.brew.sh/formula/php@8.4) describes PHP as
keg-only. The observed installation nevertheless created 25 prefix symlinks;
`brew unlink php@8.4` removed them, and explicit-path PHP still runs. No PHP service,
Apache configuration change, shell-profile change or application dependency install
was requested or performed.

The installation is **not** entirely workspace-local: Homebrew installed PHP and
its dependencies under `/opt/homebrew`, including PHP configuration under
`/opt/homebrew/etc/php/8.4/`. The no-upgrade environment option did not prevent upgrades
of required shared dependencies. Record this footprint rather than claiming all
system-wide libraries were unchanged:

- Newly installed dependencies: apr 1.7.6, apr-util 1.6.6, argon2 20190702_1,
  libtool 2.6.2, unixodbc 2.3.14, freetds 1.5.22, aom 3.15.3, libavif 1.4.2,
  gd 2.3.3_6, icu4c@79 79.1, krb5 1.22.3, libpq 19.0, libsodium 1.0.22,
  libzip 1.12.1, net-snmp 5.9.5.2_2, oniguruma 6.9.10, openldap 2.7.2,
  tidy-html5 5.8.0.
- Required upgrades: ca-certificates 2026-10-20 → 2026-11-05;
  libnghttp2 1.70.0 → 1.71.0; libnghttp3 1.18.0 → 1.19.0;
  libngtcp2 1.25.0_1 → 1.26.0; lz4 1.10.0 → 1.11.1;
  freetype 2.14.3 → 2.15.0; fontconfig 2.18.3 → 2.18.4;
  jpeg-turbo 3.2.0 → 3.2.1; libvmaf 3.2.0 → 3.2.1;
  dav1d 1.5.4 → 1.5.5; sqlite 3.53.4 → 3.54.1.

Homebrew warned about an unrelated untrusted `ngrok/ngrok` tap. It remained ignored;
no trust or tap configuration was changed.

## Selected client and test dependencies

Direct HTTPS requests to the official npm registry returned each exact selected
version. Some registry URLs failed through the browser reader; Python HTTPS requests
to those same URLs succeeded. These are registry observations, not install/build
results. The inferred compatibility below is limited to declared engines/peers.

| Package | Exact input for T008 | Published constraint or relevant observation |
| --- | --- | --- |
| [typescript](https://registry.npmjs.org/typescript/7.0.2) | 7.0.2 | Node `>=16.20.0`; [darwin-arm64 native compiler package](https://registry.npmjs.org/@typescript%2Ftypescript-darwin-arm64/7.0.2) exists with OS `darwin`, CPU `arm64` |
| [vite](https://registry.npmjs.org/vite/8.3.8) | 8.3.8 | Node `^20.19.0 || >=22.12.0`; Rolldown `~1.2.18`, Lightning CSS `^1.33.0` |
| [three](https://registry.npmjs.org/three/0.187.0) | 0.187.0 | No Node engine field; browser/rendering acceptance still required |
| [@types/three](https://registry.npmjs.org/@types%2Fthree/0.187.0) | 0.187.0 | Matched Three revision; transitive types must be frozen in the lock |
| [vitest](https://registry.npmjs.org/vitest/5.1.2) | 5.1.2 | Node `^22.12.0 || ^24.0.0 || >=26.0.0`; Vite peer `^6.4.0 || ^7.0.0 || ^8.0.0` |
| [@playwright/test](https://registry.npmjs.org/@playwright%2Ftest/1.65.1) | 1.65.1 | Node `>=20`; exact dependency `playwright` 1.65.1 |
| [@axe-core/playwright](https://registry.npmjs.org/@axe-core%2Fplaywright/4.14.1) | 4.14.1 | Node `>=22.12.0`; `playwright-core >=1.0.0`; axe-core `~4.14.1` |
| [ajv](https://registry.npmjs.org/ajv/8.20.0) | 8.20.0 | Selected current Ajv 8 patch; use its 2020-12 entry point |
| [ajv-formats](https://registry.npmjs.org/ajv-formats/3.0.1) | 3.0.1 | Ajv peer/dependency `^8.0.0` |
| [@types/node](https://registry.npmjs.org/@types%2Fnode/26.6.10) | 26.6.10 | Selected Node 26 type definitions for tooling; satisfies Vite/Vitest type-package peers |

Registry metadata confirms Darwin arm64 optional bindings in
[Rolldown 1.2.18](https://registry.npmjs.org/rolldown/1.2.18) and
[Lightning CSS 1.33.0](https://registry.npmjs.org/lightningcss/1.33.0).
T008 must preserve platform-appropriate optional packages and verify actual native
module loading; existence of metadata does not prove those binaries execute.
The [Playwright platform requirements](https://playwright.dev/docs/intro#system-requirements)
list Node 22/24/26 and macOS 14 or later, which this environment meets. Browser downloads,
launches and actual Safari testing remain pending. Do not advertise mobile support from
this Mac inspection.

## Selected Composer dependencies and PHP constraints

The Packagist v2 metadata was read directly; inherited `composer/2.0` metadata was
expanded before selecting PHPUnit's older 12.5 line. Exact direct selections:

| Package | Exact input for T009 | Published requirement |
| --- | --- | --- |
| [google/apiclient](https://repo.packagist.org/p2/google/apiclient.json) | 2.20.1 | PHP `^8.1`; google/auth `^1.53`; Guzzle `^7.8.2 || ^8.0`; PSR-7 `^2.6.3 || ^3.0` |
| [league/oauth2-client](https://repo.packagist.org/p2/league/oauth2-client.json) | 2.10.0 | PHP `~8.2.0 || ~8.3.0 || ~8.4.0 || ~8.5.0 || ~8.6.0`; ext-json; Guzzle `^8.5.2`; PSR-7 `^3.5.1` |
| [opis/json-schema](https://repo.packagist.org/p2/opis/json-schema.json) | 2.6.3 | PHP `^7.4 || ^8.0`; ext-json; opis/string `^2.1`, opis/uri `^1.0` |
| [phpunit/phpunit](https://repo.packagist.org/p2/phpunit/phpunit.json) (development only) | 12.5.45 | PHP `>=8.3`; ext-dom, ext-filter, ext-json, ext-libxml, ext-mbstring, ext-xmlwriter |

Opis 2.6.3 advances the research observation of 2.6.2 within the planned `^2.6` line.
PHPUnit 12.5 remains in [bugfix support](https://phpunit.de/supported-versions.html)
through 2027-02-05, so a major-version change to 13 is unnecessary for this task.
This is a patch selection, not a product, teaching, persistence or media-scope change.

The Google and League HTTP-client constraints have a nonempty intersection:
Guzzle `^8.5.2` and PSR-7 `^3.5.1`. Published
[Guzzle 8.6.0](https://repo.packagist.org/p2/guzzlehttp/guzzle.json),
[PSR-7 3.6.0](https://repo.packagist.org/p2/guzzlehttp/psr7.json) and
[google/auth 1.55.3](https://repo.packagist.org/p2/google/auth.json) provide compatible
candidates on paper. This is an inference from their requirements; no Composer
solver ran and no transitive lock is certified. T009 must resolve without
`--ignore-platform-reqs`, run `composer check-platform-reqs`, review advisory results
and verify the service/tests against the resulting lock. Runtime application
extensions must be explicit manifest requirements, beyond library minima.

### Actual local PHP extension and primitive checks

`php --version` returned PHP 8.4.28 CLI, NTS, Zend Engine/OPcache 4.4.28/8.4.28.
`php --ini` identified `/opt/homebrew/etc/php/8.4/php.ini` and
`conf.d/ext-opcache.ini`. A PHP probe checked `extension_loaded`, 64-bit integer size,
PDO drivers and only public library-version fields; it did not dump phpinfo,
environment variables, account data or secrets.

| Capability | Actual local observation |
| --- | --- |
| Game identity/data primitives | json, mbstring, openssl, curl, PDO, pdo_sqlite, sqlite3, session, filter, hash, ctype and iconv all loaded |
| PHPUnit/compiler/PHAR support | dom, libxml, xml, xmlwriter, Phar and tokenizer all loaded |
| Archive handling | zip loaded |
| Runtime libraries | OpenSSL 4.1.0 (2026-10-23); curl 8.23.0; SQLite 3.54.1 |
| Integer/platform | `PHP_INT_SIZE = 8`; CLI arm64 |
| PDO | Drivers dblib/mysql/odbc/pgsql/sqlite; isolated `sqlite::memory:` table, prepared insert, commit and read-back passed |
| JSON/Unicode/randomness smoke | JSON_THROW_ON_ERROR decoding, UTF-8 `mb_strlen('é') = 1`, and `random_bytes(32)` length passed |
| Extension check | Zero missing among the 19 explicitly checked extensions listed above |
| Coverage extensions | PCOV and Xdebug absent; basic PHPUnit execution does not require coverage collection |
| Composer startup | `Composer version 2.11.3 2026-11-24 10:14:18`, using PHP 8.4.28; isolated Composer home/cache paths supplied |

These probes establish usable local primitives, not the save algorithm, disk locking,
session security, TLS configuration, remote provider access or host database behavior.
In-memory SQLite cannot prove host filesystem concurrency or recovery. Keep the
planned rollback-journal policy until the relevant storage tests justify a change.
The [PHPUnit installation guide](https://docs.phpunit.de/en/12.5/installation.html)
distinguishes ordinary tests from coverage requiring PCOV or Xdebug.

## Remaining work and limits

- **No local runtime blocker remains for T008/T009.** Node/PHP/Composer startup and
  the required local extension presence passed. Their application install/build/test
  checks remain **NOT RUN**, with no `package.json`, `package-lock.json`,
  `server/composer.json` or `server/composer.lock` created here.
- **Host capability remains UNVERIFIED**, including web/CLI versions, PHP extensions,
  TLS/provider egress, private disk/locking, quota, session configuration and recovery.
  T003 owns those observations. Local PHP is not host evidence.
- **G0 remains PENDING** until T007 evaluates runtime, host, provider, media and source
  evidence together. Nothing in this audit waives its blocked-capability rules.
- **Dependency and license acceptance remains pending.** Registry metadata identifies
  `@axe-core/playwright` and Lightning CSS as MPL-2.0, unlike the project's own code
  license. T010 must preserve third-party notices and assess distribution boundaries;
  this audit does not relabel them or grant a blanket permissive-license clearance.
- Install locks, security/advisory checks, actual compilation, browser native bindings,
  PHPUnit/API runs and shared Ajv/Opis conformance are later executable evidence.
  Source publication, provider registration and deployment were not performed.

This report and [loop 002](../../implementation/loops/002-T002.md) are the only
versionable files authored by this worker. The coordinator owns task/state updates.
