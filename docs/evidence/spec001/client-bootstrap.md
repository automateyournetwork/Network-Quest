# Client bootstrap evidence — T008

Date: 2026-11-25. Worker: `/root/loop010_t008`. Baseline commit:
`d4482767aa3c9c794d1cf28d61b40f8aba2279c7` with existing uncommitted work preserved.
Coverage: W01/G0 preparation, C2/C12/C13/C14/C15, FR-023/024, AC16/17/19.

**T008 scoped result: PASS. G0 remains BLOCKED.** This proves the local dependency,
compiler and static-build bootstrap. It does not prove gameplay, the service,
browser compatibility, accessibility acceptance, provider readiness or release.
The explicit first-batch exception in `tasks.md` permits this work before G0;
T012 and later foundation work still require G0 PASS.

## Implemented boundary

- `package.json` and lockfile version 3 pin every direct selection from
  [runtime.md](runtime.md); 109 dependency entries include other-platform optional
  binaries. On this Mac npm installs 59 packages. All dependency records have
  integrity hashes and HTTPS `registry.npmjs.org` URLs; no Git/local/private inputs.
- `tsconfig.json` enables strict checking, unchecked-index and exact-optional
  checks, side-effect import checking and unused-code checks. Library checking is
  enabled. `npm run build` first typechecks, then produces `dist/index.html`, hashed
  JS/CSS and `dist/.vite/manifest.json` using Vite.
- Default game base: `/arcade/play/network-quest/`. Default API base:
  `/arcade/play/network-quest/api/v1`. `src/config.ts` exports typed public paths
  for later consumers; this bootstrap makes no API request.
- Optional **command-environment** inputs `VITE_GAME_BASE` and `VITE_API_BASE`
  accept only same-origin absolute paths with plain alphanumeric/underscore/hyphen
  segments. The game base requires a trailing slash; the API base forbids one.
  If only the game base changes, the API default follows it.
- Vite uses `envDir: false`, `envPrefix: []` and a single explicit public API-path
  definition. No `.env` file is loaded, no general prefix exposes process variables,
  and no OAuth credential is read. This follows Vite's documented
  [environment controls](https://vite.dev/config/shared-options) and
  [static build options](https://vite.dev/config/build-options), checked on this date.
- The semantic HTML entry says the adventure is in development and play is not
  available. Its tiny TS module and CSS exercise real compilation. No game state,
  room, score, art substitute, default Vite demo or faux working game was added.

Available scripts are `typecheck`, `build`, `dev:client`, and `preview:client`.
The last two are loopback-only static tooling; they were not launched in this task.
The production-shaped HTTPS/PHP `dev` command belongs to T011. The full `check`,
domain/API/e2e and asset-validation commands remain unimplemented; no placeholder
success scripts were added. Test harnesses remain T020 work.

## Frozen dependencies and lifecycle review

| Package | Exact version |
| --- | --- |
| three / @types/three | 0.187.0 / 0.187.0 |
| typescript | 7.0.2 |
| vite | 8.3.8 |
| vitest | 5.1.2 |
| @playwright/test | 1.65.1 |
| @axe-core/playwright | 4.14.1 |
| ajv / ajv-formats | 8.20.0 / 3.0.1 |
| @types/node | 26.6.10 |

The selected Node **26.13.1** and npm **11.20.0** are recorded in package engines
and `packageManager`; all commands used the command-scoped runtime PATH from T002.
No shell profile changed. Rolldown resolved **1.2.19**, within Vite's `~1.2.18`
range, with its darwin-arm64 binding. Lightning CSS and its native binding are
**1.33.0**. The TypeScript native darwin-arm64 compiler is **7.0.2**. No candidate
version substitution or engine bypass was necessary.

The first install disabled lifecycle scripts for inspection. Reviewed all installed
package manifests against lock metadata. Registry-package `prepare` scripts exist
in axe/Playwright, tween.js, Lightning CSS and tinyexec; they are not registry
dependency install hooks. `fsevents@2.3.3` alone has lock `hasInstallScript` metadata,
but its published installed files have no preinstall/install/postinstall hook or
`binding.gyp`, and include `fsevents.node`.

A normal reinstall succeeded but npm 11.20 reported that metadata as unreviewed.
After its native module loaded successfully, ran `npm install-scripts deny fsevents`.
The resulting `allowScripts: { "fsevents": false }` records that no build hook is
needed for this prebuilt dependency. A fresh isolated normal `npm ci` then succeeded.
No lifecycle script was approved and no browser download was needed.

`npm audit --json` exited 0: **0 informational, low, moderate, high or critical
findings**. This is the registry audit result on this date, not a guarantee of
absence of vulnerabilities. Dependency/license acceptance and third-party notices
remain T010 work, including the previously identified MPL components.

Lock SHA-256: `e7c525a1ac0381f293414b950261cb4814491f9563dd30dda9d3946b3127c9cd`.

## Executed commands and results

Commands ran from the repository root unless the isolated-copy procedure below
states otherwise. Every npm command and child process used Node26, for example:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run build
```

The exact installer invocation initially was:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" \
  npm_config_ignore_scripts=true npm_config_fund=false \
  node /Users/john.capobianco/.codex/plugins/cache/openai-curated-remote/sites/1.1.7/scripts/install-dependencies.mjs
```

The Sites helper selected portable npm, ran `npm install`, and exited 0: 59 packages,
zero audit findings. With the lock present the same helper invocation, omitting
`npm_config_ignore_scripts=true`, ran `npm ci`, exited 0 and produced the reviewed
fsevents warning described above. The helper is not a public-build dependency:
ordinary `npm ci` was independently verified in the clean copy.

| Command (Node26 PATH applied) | Observed result |
| --- | --- |
| `npm ls --depth=0` | Exit 0; all ten direct dependencies match the exact versions above |
| `npm install-scripts ls` | Identified only fsevents metadata as unreviewed |
| `npm install-scripts deny fsevents` | Exit 0; added explicit denial to package.json |
| `npm run build` | Exit 0; strict `tsc --noEmit` then Vite8.3.8, 5 transformed modules, four output files |
| `npm exec -- vitest --version` | Exit 0; `vitest/5.1.2 darwin-arm64 node-v26.13.1` |
| `npm exec -- playwright --version` | Exit 0; `Version 1.65.1`; no browser launched |
| `npm audit --json` | Exit 0; total vulnerabilities 0 |

A `node --input-type=module` probe imported Rolldown, Lightning CSS, Three,
Ajv2020, ajv-formats and axe/Playwright; `createRequire` loaded fsevents. Assertions
passed: Rolldown export is callable; Lightning CSS transforms `a { color: #ffffff; }`
to `a{color:#fff}`; fsevents exports a native-backed `watch`; Three revision is 187
and Vector3(3,4,0) has length 5; Ajv2020 with formats accepts a valid UUID and rejects
`invalid`; AxeBuilder is callable. These checks exercise actual installed modules,
not game rules or browser/WebGL behavior.

### Isolated-copy checks

A `python3` here-document used `tempfile.TemporaryDirectory(prefix='network-quest-t008-')`
outside the repository. It copied **only** `package.json`, `package-lock.json`,
`tsconfig.json`, `vite.config.ts`, `index.html`, and `src/`. Its subprocess environment
contained the Node26 bin plus system PATH, a new empty temporary HOME, and
`npm_config_fund=false`. No original environment values, `.env`, site source,
credentials, server code, npm config, build output or node_modules were copied.
The temporary directory was removed after verification.

1. Ran `npm ci` (exit 0; zero audit findings); compared lock bytes before/after:
   unchanged. Ran `npm run build` twice (both exit 0). Every SHA-256 matched both
   the other isolated build and the workspace build. This proves repeatability
   on this recorded runtime/platform, not an untested cross-platform claim.
2. Parsed the Vite manifest; JS and CSS files exist, and HTML references each under
   `/arcade/play/network-quest/` rather than the origin root.
3. Only in the temporary copy, wrote synthetic `.env` values for `VITE_GAME_BASE`,
   `VITE_API_BASE`, `VITE_CANARY` and `NQ_GOOGLE_CLIENT_SECRET`; passed synthetic
   inherited `VITE_UNRELATED` and `NQ_GITHUB_CLIENT_SECRET`. Added a probe consumer
   of `publicPaths`, the whole `import.meta.env`, and a typed Three Vector3 to the
   temporary TS entry. Ran `npm run build` (exit 0). The default API path is in the
   output; all synthetic secret/canary strings and `.env` path overrides are absent.
   No real credential value was read for this check.
4. Ran `npm run build` with explicit `VITE_GAME_BASE=/local/network-quest/` and
   `VITE_API_BASE=/local/network-quest/api/v2` (exit 0); checked the configured API
   path and nested HTML asset references in the resulting output.
5. Ran `npm exec -- vite build` once per invalid setting below. All twelve returned
   nonzero with the expected `VITE_GAME_BASE` or `VITE_API_BASE` path diagnostic:

   | Variable | Rejected values |
   | --- | --- |
   | VITE_GAME_BASE | `https://example.invalid/game/`, `//example.invalid/game/`, `/game/../private/`, `/game/%2e%2e/`, `/game/?query=1`, `/game/#fragment`, `/game` |
   | VITE_API_BASE | `https://example.invalid/api`, `//example.invalid/api`, `/game/../api`, `/game\api`, `/game/api/` |

6. Added `const deliberateTypeError: number = 'not a number';` and used it only in
   the temporary TS entry. `npm run typecheck` failed with TS2322 as expected.
   No probe/error code was copied back to the repository.

### Repeated static output hashes

| File under dist/ | SHA-256 |
| --- | --- |
| `.vite/manifest.json` | `2bb373933b1dca4bbb4efbe39eaf4b490f9e3e467ff81bd571945fb28a5a9dcc` |
| `assets/index-BMl5BtuJ.js` | `c5c52f036e02c71fdb79dc54487687deaf0ba29311ee4ddd9e6146adc800aed7` |
| `assets/index-BlcbJzV3.css` | `76d1075dd6cdd7b997cfb4fc5d9357a40b10575f3fe81c3dd23c8aa8cb06ee7b` |
| `index.html` | `e408476ee7009a5feb2a8477081ee3a8b469f5bbd6d72b790cfc4f460b20c978` |

## Remaining limits

No browser preview/screenshot was required for this compilation bootstrap. CUA was
already recorded unavailable; it was not retried. No local TLS/PHP proxy, service,
OAuth flow, domain/state/content test, WebGL rendering, browser installation,
human accessibility/visual review or clean public checkout was claimed. The Vite
manifest is build metadata, not the G7 compatibility/release package. Generated
`node_modules/` and `dist/` stay ignored. No secret, website file, remote host,
provider registration, publication, task checkbox or gate record was changed.

Next eligible work is T009/T010, then T011. Reassess T007/G0 after all prerequisite
evidence exists; do not expand this entry into a playable client before G0 PASS.
