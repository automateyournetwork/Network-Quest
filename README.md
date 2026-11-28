# Network Quest

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Network Quest is an original browser adventure through the OSI realms. The
Physical Layer Underworld candidate has twelve connected rooms, copper, fiber
and radio investigations, recruitable companions, packet journeys and three
endings. Choose **New Adventure** to play as a guest. Guest progress lives in
the current tab. The browser also supports one-slot account saves, Continue,
settings, logout and deletion with the configured PHP service. The public
development tests use disposable synthetic accounts. Real provider sign-in,
human review and live release have their own acceptance records.
[Implementation status](docs/implementation/HANDOFF.md) · [Constitution](.specify/memory/constitution.md) · [Spec001](SPEC.md) · [Plan](PLAN.md)

## Build and play from a public checkout

Clone the Spec001 branch into a new directory. The checkout contains the game,
its exported media and the two dependency locks. Editable media account for
about 2 GB before Git objects, dependencies and build output.

```sh
git clone --depth 1 --branch 001-physical-layer-underworld \
  https://github.com/automateyournetwork/Network-Quest.git
cd Network-Quest
```

Use Node **26.13.1** with bundled npm **11.20.0**, PHP CLI **8.4.28** with the
extensions in `server/composer.json`, and Composer **2.11.3**. Put the pinned
executables on PATH. The runtime record includes the official Node and Composer
download URLs and the verified SHA-256 values for macOS arm64. If using the
Composer PHAR, substitute `php /path/to/composer-2.11.3.phar` for `composer`.
[Runtime downloads and checksums](docs/evidence/spec001/runtime.md#artifact-verification)

```sh
node --version
npm --version
php --version
composer --version
npm ci
composer install --working-dir=server
npm run check
npm run build
npm run preview:client
```

Open the printed loopback address at `/arcade/play/network-quest/` (default
`http://127.0.0.1:4173/arcade/play/network-quest/`). The static preview serves
the guest adventure and the offline media and software credits. Stop it with
Ctrl+C. The build writes the deployable static files to `dist/`, including
`.vite/manifest.json`. It runs on the public game sources, without access to
the owner's website or provider accounts. The separate media download is useful
for contributors who want an independently verified editable copy.
[Editable source instructions](docs/source-retrieval.md) · [Credits and licenses](docs/licenses.md)

On the original development Mac the pinned Node installation lives under
`.runtime/node-v26.13.1-darwin-arm64/bin`, PHP under
`/opt/homebrew/opt/php@8.4/bin`, and Composer at
`.runtime/composer-2.11.3.phar`. Supply your own tool paths on a new machine.
The test harness accepts `NQ_PHP_BIN` and `NQ_TEST_NODE_BIN` as absolute paths.
[Client bootstrap](docs/evidence/spec001/client-bootstrap.md) · [PHP bootstrap](docs/evidence/spec001/php-bootstrap.md)

## Local HTTPS and PHP

The fixed default entry is **https://127.0.0.1:8443/arcade/play/network-quest/**.
The API shares that origin at `/arcade/play/network-quest/api/v1`.
`npm run dev` starts HTTPS and Vite in one Node process, then an isolated PHP CLI
worker on a dynamically chosen loopback port. It requires an explicit certificate
and owner-readable private key valid for IP `127.0.0.1`. It binds only `127.0.0.1`,
fails if the HTTPS port is occupied, and stops PHP/removes disposable run data on
Ctrl+C, SIGTERM, startup failure or unexpected PHP exit. No root privileges needed.

Supply a certificate already trusted by your development client, or explicitly
generate a short-lived self-signed certificate for command-line verification:

```sh
mkdir -p .local/tls
chmod 700 .local/tls
(
  umask 077
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 30 \
    -subj '/CN=Network Quest local development' \
    -addext 'subjectAltName=IP:127.0.0.1,DNS:localhost' \
    -keyout .local/tls/key.pem -out .local/tls/cert.pem
)
NQ_TLS_CERT="$PWD/.local/tls/cert.pem" \
NQ_TLS_KEY="$PWD/.local/tls/key.pem" \
NQ_PHP_BIN="${NQ_PHP_BIN:-php}" npm run dev
```

Run generation only for new disposable development files: it replaces those paths.
This procedure requires OpenSSL with `req -addext` (verified OpenSSL 4.1.0); set
`NQ_OPENSSL_BIN` to a suitable executable for `dev:verify`. TLS files in this
repository are accepted only beneath ignored `.local/`, after symlink resolution;
external operator-supplied absolute paths also work. Never put keys in `src/`,
`public/`, `server/public/`, or a build artifact. The launcher requires owner-only
key permissions on Unix. It does not read project `.env`, production credentials,
`NQ_CONFIG_FILE`, databases or website material.

In another terminal, explicitly trust only this certificate for the request:

```sh
curl --cacert .local/tls/cert.pem --fail \
  https://127.0.0.1:8443/arcade/play/network-quest/
curl --cacert .local/tls/cert.pem --include \
  https://127.0.0.1:8443/arcade/play/network-quest/api/v1/session
```

The shell returns 200. This unconfigured development launcher returns **503** with
`service_not_implemented`, no account/session cookie, and `Cache-Control: no-store`.
Callbacks return an inert HTML explanation that sign-in is unavailable. Unknown
routes return 404; unsupported methods return 405. The shared
`server/public/index.php` entry can compose the implemented account/save service
when explicitly configured. The launcher above deliberately supplies no private
configuration. `tools/dev-router.php`
adapts local readiness and delegates to that shared entry; neither router serves
arbitrary static files. PHP receives canonical HTTPS forwarding
headers from the proxy, while forged forwarding fields are removed. A per-run
random token restricts direct worker access. It is not a production proxy design.

Configured service integration tests use an owned private JSON file shaped like
`server/config.example.json`, supplied through `NQ_CONFIG_FILE`, plus an explicit
`NQ_DOCUMENT_ROOTS_JSON` list. The entry requires already initialized, separate
game and recovery stores outside every document root and reviewed retention
inputs. Requests never provision or migrate storage. The historical PHP template
is not executed. See [service harness instructions](server/tests/README.md) and
[hosting observations](docs/implementation/hosting-header-admission.md) for the
verified scope and remaining production requirements.

No system trust store is modified. The self-signed certificate above remains
untrusted in a normal browser. Use an operator-managed, browser-trusted development
certificate for interactive development. The automated Firefox HTTPS check below
uses a separate disposable CA, signed SAN leaf and private test profile; its trust
does not extend to your normal browser or prove provider readiness.
Do not bypass certificate errors, add insecure browser flags, use `curl -k`, or set
`NODE_TLS_REJECT_UNAUTHORIZED=0`. The launcher does not open a browser. HMR and file
watching are disabled in the combined bootstrap; restart after source or public-file
edits, then reload. Vite's development connection shares the verified TLS port and
requires the exact Host, Origin, game path and its connection token. See the [browser matrix](docs/evidence/spec001/browser-matrix.md) for actual Safari runs and outstanding coverage.

`NQ_DEV_PORT` may explicitly select another unprivileged port; the printed origin
and any future provider registration must then match it exactly. Local HTTPS
rejects `VITE_GAME_BASE`/`VITE_API_BASE` overrides that change the production-shaped
paths. Static builds still support the validated public route variables.

## Development OAuth registrations

No credentials are needed for this bootstrap. The privately stored owner-confirmed
production Google/GitHub applications are production-only and are never loaded by
these tools. When real local provider flows begin, use separate development
applications and private configuration, with these exact default callbacks:

- Google: `https://127.0.0.1:8443/arcade/play/network-quest/api/v1/auth/google/callback`
- GitHub: `https://127.0.0.1:8443/arcade/play/network-quest/api/v1/auth/github/callback`

Google's [Web application redirect validation](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)
permits loopback IP hosts. These are planned development callback values, not
registered or tested provider flows. Keep the server-side minimal scope and
validation contract in [provider setup](docs/setup/oauth.md). Separate staging
origin/registration and browser trust remain future inputs. Do not reuse production
secrets, fake a login, or weaken Secure cookies to make a callback appear to work.

## Available commands and limits

| Command | Implemented behavior |
| --- | --- |
| `npm run dev` | Loopback HTTPS guest game with the shared, unconfigured PHP router |
| `npm run dev:verify` | Disposable TLS/HTTP/PHP transport checks; generates and removes private synthetic fixtures and a temporary certificate; no real login/data/browser |
| `npm run dev:client` | HTTP Vite client only at the printed nested URL; no PHP/auth support |
| `npm run typecheck` | Strict TypeScript check of client, TS tools/tests and runner configurations |
| `npm run check` | Typecheck, content/reference validation and generated save-policy drift check |
| `npm run test:domain` | Vitest physical rules, authored content, state, presentation, UI and contributor tooling. Earlier TODO cases are reported separately |
| `npm run test:api` | Actual PHP auth/save/recovery/account services and local HTTPS entry using isolated synthetic accounts; no real providers or production data |
| `npm run test:e2e` | Build and run registered browser projects covering the title, guest episode, trusted local HTTPS, synthetic accounts, accessibility and media recovery |
| `npm run build` | Typecheck and save-policy drift check, then static Vite build in ignored `dist/` |
| `npm run preview:client` | HTTP static build preview on loopback; no PHP/auth support |
| `npm run save-policy:generate` | Regenerate the PHP new-write policy from the authored Spec001 content |
| `npm run save-policy:check` | Fail if the checked-in policy differs from its actual source inputs |

`dev:verify` needs the same pinned Node/PHP and OpenSSL. It verifies trust rejection,
private-path/symlink denial, same-origin routing, header replacement, a **synthetic**
Secure/HttpOnly/SameSite=Lax host-only cookie, port conflicts and shutdown. That
cookie exists only in an external temporary probe router and represents no identity.
The shared PHP entry selects its configured account service only when its private configuration and initialized stores are available.

Vite retains its standard private-file deny patterns and adds project private paths.
An early boundary also covers `public/`, symlinks, encoded paths and `/@fs`.
The TLS proxy rejects foreign Host/Origin and never logs callback queries, tokens or
bodies; PHP access output is suppressed. These local guards do not replace the later
release exclusion and production-host security checks.

`test:api` requires pinned PHP through `NQ_PHP_BIN` (or a matching `php` on PATH)
and runs with a restricted environment. Production provider/configuration values
are not inherited. Its harness defaults to the repository's verified Node path;
on another platform provide an absolute `NQ_TEST_NODE_BIN` for Node 26.13.1.
See [service harness instructions](server/tests/README.md).

`test:e2e` needs the pinned Playwright Chromium/Firefox binaries, PHP, OpenSSL
with `req -addext`, and Mozilla NSS `certutil` (already available on the verified
Mac). `NQ_OPENSSL_BIN` and `NQ_CERTUTIL_BIN` can select those tools explicitly.
Missing tools or browsers fail the command with an error; no checks silently skip.
Install just the matching browser binaries when needed:

```sh
PLAYWRIGHT_SKIP_BROWSER_GC=1 node node_modules/playwright/cli.js install chromium firefox
NQ_PHP_BIN="$(command -v php)" NQ_TEST_NODE_BIN="$(command -v node)" npm run test:e2e
```

Static smoke starts a loopback HTTP preview of `dist/` on port 4173 and checks
the nested route, scripts, styles, private-file denial and narrow layout.
The Firefox HTTPS projects use disposable certificate authorities, private
profiles and local PHP. The unconfigured service returns 503/404/405 for the
corresponding routes. Configured tests use isolated synthetic accounts to
exercise saving, Continue, settings, logout and deletion. Close any preview
using the test port before running the suite. Vitest discovers
`tests/**/*.test.ts`. Playwright checks that every file under `tests/e2e/` is
assigned to a project. [Browser projects](playwright.config.ts) · [Service test harness](server/tests/README.md)

`npm run assets:verify` audits the inventory against source, export, use,
rights and review records. Add `-- --mode release` to enforce media counts and
distribution. The current media audit records six outstanding release-mode
findings tied to audio listening and distribution. Use the audit and listening
packets for the exact reviewed files. [Media audit](docs/evidence/spec001/media-audit.md)

Release packaging, host recovery, provider validation and the live arcade
entry have separate gates. The implementation handoff records their current
status. [Gate ledger](docs/evidence/spec001/gates.md) · [Implementation handoff](docs/implementation/HANDOFF.md)

## Reuse and contributions

Original controlled code/build scripts use [Apache-2.0](LICENSE); controlled
documentation/creative work uses [CC BY 4.0](LICENSE-ASSETS). Third-party material
retains its licenses: [notices](THIRD-PARTY-NOTICES.md), [contributing](CONTRIBUTING.md),
and [media source retrieval](docs/source-retrieval.md). Production credentials, player
records and the closed website stay outside this public checkout. The owner has authorized reviewed source checkpoints on the feature branch. A
finished live game release still requires all applicable acceptance and owner reviews.
