# Network Quest

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

An original browser adventure through the OSI realms, beginning with the Physical
Layer Underworld. **Current state: the R01/R02 guest introduction is playable in
memory, with four verbs, dialogue, inventory, a notebook, physical measurements
and the initial packet journey. The PHP account/save service passes isolated
integration tests; browser integration, real providers, finished media and the
complete episode remain in development. No release has been deployed.**
See [implementation status](docs/implementation/HANDOFF.md),
[governing constitution](.specify/memory/constitution.md), [SPEC.md](SPEC.md) and
[PLAN.md](PLAN.md). The public project builds independently of the owner's website.

## Toolchain

Use Node **26.13.1**, npm **11.20.0**, PHP **8.4.28**, and Composer **2.11.3**.
[Runtime evidence](docs/evidence/spec001/runtime.md) documents the verified Mac
installation. Other machines supply the same versions on their own paths; the
launcher defaults to `php` on PATH. Do not load a credential `.env` as shell code.

On the verified Mac, apply these overrides to each command (or a dedicated terminal):

```sh
export PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH"
export NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php
node --version
npm --version
"$NQ_PHP_BIN" --version
npm ci
"$NQ_PHP_BIN" .runtime/composer-2.11.3.phar install --working-dir=server
```

On another machine use its own pinned Node/PHP/Composer paths; there is no runtime
download or global configuration change in the development launcher. PHP uses its
normal installed module configuration, with local session/error overrides and no
inherited provider/configuration environment. Dependencies are pinned in the two
lock files. [Client](docs/evidence/spec001/client-bootstrap.md) and
[PHP](docs/evidence/spec001/php-bootstrap.md) evidence describe their scope.

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
requires the exact Host, Origin, game path and its connection token. Human
accessibility, actual Safari and complete-episode acceptance remain separate checks.

`NQ_DEV_PORT` may explicitly select another unprivileged port; the printed origin
and any future provider registration must then match it exactly. Local HTTPS
rejects `VITE_GAME_BASE`/`VITE_API_BASE` overrides that change the production-shaped
paths. Static builds still support the validated public route variables.

## Future development OAuth registrations

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
| `npm run dev` | Loopback HTTPS frontend plus shared PHP router; contracted operations are explicitly unavailable |
| `npm run dev:verify` | Disposable TLS/HTTP/PHP transport checks; generates and removes private synthetic fixtures and a temporary certificate; no real login/data/browser |
| `npm run dev:client` | HTTP Vite client only at the printed nested URL; no PHP/auth support |
| `npm run typecheck` | Strict TypeScript check of client, TS tools/tests and runner configurations |
| `npm run check` | Typecheck, content/reference validation and generated save-policy drift check |
| `npm run test:domain` | Vitest content/state/UI/presentation and source-fixture checks; 15 reviewed copper/content-error cases execute, 68 evaluator cases remain pending |
| `npm run test:api` | Actual PHP auth/save/recovery/account services and local HTTPS entry using isolated synthetic accounts; no real providers or production data |
| `npm run test:e2e` | Build plus Chromium/Firefox title checks and isolated Firefox HTTPS router, controllers, guest and packet journeys; see the implementation handoff for actual passing and pending evidence |
| `npm run build` | Typecheck and save-policy drift check, then static Vite build in ignored `dist/` |
| `npm run preview:client` | HTTP static build preview on loopback; no PHP/auth support |
| `npm run save-policy:generate` | Regenerate the PHP new-write policy from actual authored introduction content |
| `npm run save-policy:check` | Fail if the checked-in policy differs from its actual source inputs |

`dev:verify` needs the same pinned Node/PHP and OpenSSL. It verifies trust rejection,
private-path/symlink denial, same-origin routing, header replacement, a **synthetic**
Secure/HttpOnly/SameSite=Lax host-only cookie, port conflicts and shutdown. That
cookie exists only in an external temporary probe router and represents no identity.
No fixture is derived from production data. The shared public entry implements
the route/security boundary only.

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
NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php npm run test:e2e
```

Static smoke uses a freshly started loopback HTTP preview of `dist/` on port 4173;
an occupied port fails instead of reusing an unknown server. It verifies shell
JavaScript/CSS, nested routing, private-file denial and automated text-shell
accessibility at 390px. It is not API/session evidence. The separate Firefox test
uses a disposable HTTPS/PHP server, one-day CA/SAN leaf and unique NSS profile,
proves an untrusted profile rejects that certificate, then verifies the trusted
shell and actual 503/404/405 router behavior. Certificate errors are never ignored.
CA/key/profile/server files and processes are removed after each check. No browser
cookie is created by the real foundation API; synthetic Secure session checks
belong to the isolated PHP/transport harnesses.

Vitest discovers `tests/**/*.test.ts`, including future UI and other foundation
suites. Playwright currently assigns the foundation static/TLS specs under
`tests/e2e/`; its discovery guard fails if any new browser test has no project.
T022/T030 and later story work must register each new suite in the applicable
browser project and use trusted HTTPS for any API/session journey.
Both runners exclude runtime/dependency/build trees,
fail empty runs, and report real failures. Traces/screenshots from failed local
browser checks remain in ignored `test-results/` for diagnosis.

`assets:verify`, `package:release` and deployment commands remain **unimplemented**.
No script returns false success for those future tasks. A passing foundation run
does not certify evaluator coverage, gameplay, real sign-in/saves, actual Safari,
manual assistive/zoom review, media, human learning or episode acceptance.
See [T011 evidence](docs/evidence/spec001/local-development.md) and
[T020 command evidence](docs/implementation/loops/024-T020.md).

## Reuse and contributions

Original controlled code/build scripts use [Apache-2.0](LICENSE); controlled
documentation/creative work uses [CC BY 4.0](LICENSE-ASSETS). Third-party material
retains its licenses: [notices](THIRD-PARTY-NOTICES.md), [contributing](CONTRIBUTING.md),
and [source retrieval](THIRD-PARTY-NOTICES.md). Production credentials, player
records, and the closed website are not public source assets. The owner has authorized reviewed source checkpoints on the feature branch. A
finished live game release still requires all applicable acceptance and owner reviews.
