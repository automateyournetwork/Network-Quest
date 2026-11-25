# Local HTTPS/PHP startup — T011

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Date: 2026-11-25. Worker: `/root/loop013_t011`, loop 013/200. Baseline commit:
`d4482767aa3c9c794d1cf28d61b40f8aba2279c7`; existing uncommitted work preserved.
Coverage: W01/G0 preparation, C2/C6/C12/C13/C15, FR-023/024, AC16/17/19.

**T011 scoped result: PASS. G0 remains BLOCKED; T012/foundation is barred.**
The setup exception permits T011 after accepted T008/T009/T010. This evidence
proves local transport/startup, not application or episode acceptance.

## Implementation and isolation

[`README.md`](../../../README.md) documents exact versions, certificate generation
and operator-supplied TLS inputs, explicit trust verification, available commands,
portable path/port overrides, future development callbacks and remaining limits.
The default entry is `https://127.0.0.1:8443/arcade/play/network-quest/`, with
same-origin `/arcade/play/network-quest/api/v1`.

[`tools/dev.mjs`](../../../tools/dev.mjs) owns a loopback HTTPS listener, Vite
middleware in its own process, and a PHP 8.4.28 child on an ephemeral loopback port.
The public port is reserved before spawning PHP; no automatic origin fallback.
The launcher validates exact Node/PHP versions, explicit absolute certificate/key
paths, certificate validity/IP SAN and owner-only key permissions. Repository TLS
files must resolve inside ignored `.local/`; the actual certificate smoke files
were mode0600 beneath `.local/t011-tls/`. No global trust/security settings changed.

The PHP child retains the installed module configuration but receives only a small
explicit environment, a random per-run proxy token and a private disposable temp
directory. It receives Secure/HttpOnly/SameSite session settings and disabled
prepend/append files and error output. No `.env`, `NQ_CONFIG_FILE`, private OAuth
file, production credential, website source or data store is loaded. PHP access
output is suppressed because the built-in server can include request queries.
Vite's logger is also quiet; startup diagnostics omit raw queries/environment.

The proxy replaces Host and forwarding fields, strips alternative/untrusted
forwarding and hop-by-hop fields, preserves request bodies/cookies, and forces
API `no-store`. It rejects foreign HTTP Host/Origin and uses only the fixed API
prefix. PHP cannot be reached successfully without the per-run token. This is a
development boundary, not the future production reverse-proxy/auth implementation.

[`tools/dev-router.php`](../../../tools/dev-router.php) sits outside the empty
`server/public/` artifact and never falls through to static file serving. Every
real API route returns 503 JSON `service_not_implemented`/`local_bootstrap` without
a cookie. It starts no session and represents no guest or account identity.

`vite.config.ts` retains all Vite standard deny patterns and adds project private
paths. Its early middleware protects public assets as well as source files, blocks
encoded/private paths and `/@fs`, and checks real symlink targets. The same boundary
is installed for standalone development/preview. Vite documents that custom
`fs.deny` replaces its default list and does not cover `public/`, motivating both
controls. [Vite server options](https://vite.dev/config/server-options#server-fs-deny)

## Executed verification

Runtime: macOS arm64; Node **26.13.1**, npm **11.20.0**, PHP **8.4.28**, Vite **8.3.8**,
OpenSSL **4.1.0**. Command-scoped PATH used the T002 `.runtime/node-.../bin`;
`NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php` selected PHP.

| Check | Observed result |
| --- | --- |
| `npm run dev` with explicit private certificate/key, default 8443 | Started and printed the exact nested HTTPS entry; curl with `--cacert` returned 200 HTML and 200 transformed TS |
| curl without explicit trust | Exit 60, self-signed certificate rejected; no `-k` used |
| Actual API request containing synthetic `code`/`state` | 503, bootstrap JSON, no-store, no Set-Cookie; query absent from launcher output |
| `npm run dev:verify` | Exit 0; all **10 verification groups** below passed |
| `npm run build` | Exit 0; strict TS plus Vite compilation passed; 5 modules, unchanged JS/CSS artifact names |
| `php -l tools/dev-router.php` | Exit 0, no syntax error |
| `git diff --check` | Exit 0 |

[`tools/verify-dev.mjs`](../../../tools/verify-dev.mjs) is reproducible local transport
verification, separate from the unimplemented T020 application harness. It creates
a new external mode0700 directory/certificate and synthetic fixtures, then removes
them in cleanup. It uses no existing credential values or production fixtures.

1. Trusted TLS and nested HTML/TypeScript/CSS routing pass.
2. No-CA TLS, plaintext HTTP to TLS, foreign Host and foreign Origin reject. The
   forged Host test explicitly validates the actual destination IP with Node's
   standard `checkServerIdentity`; it does not bypass certificate verification.
3. Session, Google/GitHub callback and save API paths return 503/no-store/no cookie;
   direct PHP requests without the token return 404.
4. **29 denial checks** cover server/private/env/runtime/cache/git paths, root
   metadata, `/@fs`, single/double encoding, traversal/backslash, private extensions,
   public private-file fixtures, external/private-target symlinks, API lookalikes,
   off-base paths and malformed encoding. Responses are 404 (malformed 400), without
   fixture bytes. An ordinary synthetic public asset still returns its exact body.
5. Occupied HTTPS port fails with EADDRINUSE and missing TLS inputs fail closed.
6. Normal shutdown closes the listener, reaps the PHP PID and deletes run data.
7. An external temporary synthetic PHP router verifies forwarded host/proto/source,
   stripped spoofed headers, exact POST body and cookie round-trip, no inherited
   synthetic provider secret, and actual loaded curl/mbstring/OpenSSL/PDO/pdo_sqlite/
   session extensions. Its response cookie is Secure, HttpOnly, SameSite=Lax,
   game-path scoped and host-only. It represents **no identity** and is inaccessible
   in normal startup. Browser cookie acceptance is not inferred from HTTP headers.
8. Unexpected PHP exit closes HTTPS, reaps PHP and deletes run data.
9. CLI SIGINT exits 0 and closes HTTPS; synthetic OAuth query absent from stdout/stderr.
10. CLI SIGTERM does the same. Both use ordinary `node tools/dev.mjs` execution.

Observed fixes during verification: normalized the Vite root's trailing slash to
avoid falsely rejecting the shell; preserved PHP module configuration instead of
`-n`; adjusted the test's spoofed-Host TLS identity check and created public fixtures
before Vite's initial scan. A test initially expected 404 for a not-yet-created README,
which triggered SPA fallback; after the actual README was created its request was
correctly denied. These failed attempts are not counted as passing evidence.

Dependency versions/locks were not changed:

- `package-lock.json`: `e7c525a1ac0381f293414b950261cb4814491f9563dd30dda9d3946b3127c9cd`
- `server/composer.lock`: `0fa6d980d1b29a859a425e0d863268e71d082b0694423d6213f7a4dfdf503007`

## Remaining limits and provider boundary

CUA was already unavailable and was not retried. No browser installation, screenshot,
trust-store change, browser bypass flag, human interaction, cookie-jar acceptance,
Safari/WebGL/accessibility or HMR acceptance was claimed. HMR/file watching are
disabled in the combined launcher; README requires restart after source/public edits.
`Sites` portable local-preview guidance was read; no registration/deployment used.
All owned servers and temporary synthetic routers were stopped/removed.

The default future dev callbacks are the origin above plus
`api/v1/auth/google/callback` and `api/v1/auth/github/callback`. Google's official
[Web OAuth URI validation](https://developers.google.com/identity/protocols/oauth2/web-server#uri-validation)
permits loopback IP hosts. No registration/flow was attempted. The owner's existing
production pairs remain private and unused; separate dev apps, browser trust and
actual authentication are later prerequisites. This task does not implement the
private configuration loader, API/auth, session ownership, save/storage, gameplay,
deployment, backup/recovery, or any remaining G0 host/provider/media evidence.
G0 stays BLOCKED and subsequent foundation work remains prohibited.
