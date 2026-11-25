# Network Quest

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

An original browser adventure through the OSI realms, beginning with the Physical
Layer Underworld. **Current state: local setup and shared foundation in progress. Play, authentication and saves
are not implemented. External G0 evidence is pending; independent local foundation work is continuing under the owner-directed execution order.**
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

The shell returns 200. Every actual API route currently returns **503** with
`service_not_implemented`, `scope: local_bootstrap`, no account/session cookie,
and `Cache-Control: no-store`. This is deliberate startup plumbing, not an
authentication implementation. `tools/dev-router.php` is outside the public PHP
artifact and cannot serve static files; it will need replacement by the real
reviewed API after its implementation tasks. PHP receives canonical HTTPS forwarding
headers from the proxy, while forged forwarding fields are removed. A per-run
random token restricts direct worker access. It is not a production proxy design.

No trust store is modified. A self-signed certificate remains untrusted in a normal
browser; browser trust/interaction are **unverified**. Use an operator-managed,
browser-trusted development certificate before browser or future provider testing.
Do not bypass certificate errors, add insecure browser flags, use `curl -k`, or set
`NODE_TLS_REJECT_UNAUTHORIZED=0`. The launcher does not open a browser. HMR and file
watching are disabled in the combined bootstrap; restart after source or public-file
edits, then reload. Browser rendering/accessibility acceptance is later work.

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
| `npm run dev` | Loopback HTTPS frontend plus PHP bootstrap above; no working API |
| `npm run dev:verify` | Disposable TLS/HTTP/PHP transport checks; generates and removes private synthetic fixtures and a temporary certificate; no real login/data/browser |
| `npm run dev:client` | HTTP Vite client only at the printed nested URL; no PHP/auth support |
| `npm run typecheck` | Strict TypeScript check |
| `npm run build` | Typecheck plus static Vite build in ignored `dist/` |
| `npm run preview:client` | HTTP static build preview on loopback; no PHP/auth support |

`dev:verify` needs the same pinned Node/PHP and OpenSSL. It verifies trust rejection,
private-path/symlink denial, same-origin routing, header replacement, a **synthetic**
Secure/HttpOnly/SameSite=Lax host-only cookie, port conflicts and shutdown. That
cookie exists only in an external temporary probe router and represents no identity.
No fixture is derived from production data. The public PHP directory remains empty.

Vite retains its standard private-file deny patterns and adds project private paths.
An early boundary also covers `public/`, symlinks, encoded paths and `/@fs`.
The TLS proxy rejects foreign Host/Origin and never logs callback queries, tokens or
bodies; PHP access output is suppressed. These local guards do not replace the later
release exclusion and production-host security checks.

`check`, `test:domain`, `test:api`, `test:e2e`, `assets:verify`, `package:release`
and deployment commands are **not implemented**. The empty PHPUnit suite correctly
fails; it is not application test coverage. Do not infer completed gameplay, media,
provider flows or episode acceptance from a successful build or transport test.
See [T011 evidence](docs/evidence/spec001/local-development.md).

## Reuse and contributions

Original controlled code/build scripts use [Apache-2.0](LICENSE); controlled
documentation/creative work uses [CC BY 4.0](LICENSE-ASSETS). Third-party material
retains its licenses: [notices](THIRD-PARTY-NOTICES.md), [contributing](CONTRIBUTING.md),
and [source retrieval](THIRD-PARTY-NOTICES.md). Production credentials, player
records, and the closed website are not public source assets. The owner has authorized reviewed source checkpoints on the feature branch. A
finished live game release still requires all applicable acceptance and owner reviews.
