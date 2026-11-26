# Authored JSON development boundary

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Coordinator integration correction, 2026-11-25, during loops036–039. T027
found that Vite blocked its real notebook content module before browser assertions.
The same boundary would block T029 authored-world imports. Root added an actual
JSON-module transport expectation first: HTTP404 instead of200 was observed.

Development now permits only .json requests under content/spec001 whose resolved
real path stays in that directory and also ends in .json. Existing private-name,
encoded-path, symlink and filesystem checks still apply. Production preview
retains its dist-only boundary; no private or production configuration was read.

Executed pinned Node26.13.1/PHP8.4.28:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php node tools/verify-dev.mjs
```

Final result:11 transport groups PASS, including raw/JavaScript-module JSON
requests, four new non-JSON/private-name/escaping-symlink denials and29 existing
private/encoded/symlink/path denials. TLS rejection, shared inert API, forwarded
headers/cookies/body, child environment, port conflict, crash and signal cleanup
remain verified. Synthetic content fixtures and temporary resources were removed
by finally cleanup. This is development transport evidence, not auth, browser
journey or release acceptance. T027 repeats its actual native cases separately.

| File | SHA-256 |
| --- | --- |
| `vite.config.ts` | `09b637e4e28ecb78a536cf931d39350737fb9f852e575da8c0c0d96c932db68a` |
| `tools/verify-dev.mjs` | `1645861b2b3e9882ea285fb023eae79c295ece1b41571e29c6bb5aa53435f987` |

## Native browser transport follow-up

T029's actual title flows exposed an unhandled Vite client WebSocket error even
with server.hmr:false. The installed Vite8.3.8 client and its documented
server.ws:false setting were checked; an actual native rerun still failed.
No browser error exemption was retained. See the [Vite server options](https://vite.dev/config/server-options#server-ws)
for the separate HMR/WebSocket configuration.

The development server now forwards only exact game-path upgrades with the exact
TLS Host and Origin to an unbound internal HTTP server used by Vite. That internal
surface never listens on a port. The Vite connection token remains required;
file watching, HMR behavior and console forwarding stay disabled. This change
has no production runtime or provider configuration effect.

A real handshake expectation first failed with200 instead of101. The final
`node tools/verify-dev.mjs` run under the pinned Node/PHP passed12 groups, including
same-origin101, foreign Host/Origin403, API-path404, invalid-token400, all earlier
private-file/TLS/API checks and normal/crash/signal cleanup. T029's separate
final native run then passed3/3 with every pageerror asserted absent.

Root also replaced obsolete setup-only foundation browser assertions with actual
New Adventure and explicitly unavailable Continue controls. TLS, private-path,
resource and accessibility checks remain. Their next joined run is pending;
source edits alone are not acceptance. HTML fallback now says the introduction
is loading, with an honest no-JavaScript notice.

Final transport file seals (supersede earlier hashes only where files changed):

| File | SHA-256 |
| --- | --- |
| `tools/dev.mjs` | `0afc384de986e9772648182a7849e25fcd8ff5c639866fce02ea31506fc4298a` |
| `tools/verify-dev.mjs` | `758b6ede8921bb6338ec9d0ea2d2a3f20353efe5672ec77853de011665326c0a` |
| `vite.config.ts` | `09b637e4e28ecb78a536cf931d39350737fb9f852e575da8c0c0d96c932db68a` |
