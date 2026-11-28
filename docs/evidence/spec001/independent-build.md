# AC16 · Independent contributor build

On November 28, 2026, a fresh anonymous checkout of `ae8472469b5f7d98e939ccb5471b03893630993a` produced **442 files totaling 72,384,699 bytes**. Every relative path and SHA-256 matched the published production ledger. Starting the static preview from that build, a fresh Chromium session opened the credits and entered **The Arrival Lift** through **New Adventure**. This verifies T157 for the public Spec001 source candidate. The packaged release, live arcade entry, real providers and host recovery have separate gates. [Public candidate](https://github.com/automateyournetwork/Network-Quest/tree/ae8472469b5f7d98e939ccb5471b03893630993a) · [Production ledger](performance/t155/production.json) · [Contributor instructions](../../../README.md#build-and-play-from-a-public-checkout)


## Public rebuild after the diagnostic and touch corrections

On November 28 a new detached working directory at `ff3f3eb50045c883803ab9196bcd456c17b96f2b` reproduced the corrected client. The coordinator fetched this revision anonymously into the prior public checkout, installed the locked npm dependencies from its verified public package cache with `npm ci --offline`, then ran the normal build. All 442 relative paths and SHA-256 values matched the published distribution, totaling 72,386,013 bytes. Its component-sorted SHA-256 is `354fd20c49a2bceff3b0da7f2b864de9b68e9e6d46a203e87897c1d596a4e831`. Of the earlier build's 442 files, 438 retained identical names and bytes. A fresh Chromium guest opened The Arrival Lift and a retail Firefox guest reached the permanent ending on this revised client. The editable source index continues to identify the same 2,067 previously retrieved files. [Corrected public code](https://github.com/automateyournetwork/Network-Quest/tree/ff3f3eb50045c883803ab9196bcd456c17b96f2b) · [Distribution ledger](refinements/production.json) · [Verified changes](refinements.md)

## Environment and inputs

The verifier used a new directory on macOS 26.6.2 (25G83), arm64 Mac16,7, with an empty home, package caches and working tree. Git used public HTTPS with credential helpers, system/user Git configuration and prompting disabled. The verifier shallow-cloned the Spec001 branch without an initial checkout, fetched the published update, and checked out the exact candidate detached. Its Git tree was `432b8e70865ae300c5104212a42c68f738e1ccf5`. There was no preinstalled dependencies, generated distribution, project-local runtime, private website checkout or production configuration. Each tool ran with an explicit environment. The runtime started with fresh public downloads of Node and Composer and the machine's pinned Homebrew PHP CLI and normal system libraries.

| Input | Verified version or SHA-256 |
| --- | --- |
| Official Node arm64 tarball with bundled npm | 26.13.1 / 11.20.0, 58,340,590 bytes, `aec2514ea1ceb2ba52455e9ec65986f6749a06dd759e5db2a72e6889668c9735` |
| Official Composer PHAR, executed with PHP CLI 8.4.28 | 2.11.3, 3,820,169 bytes, `04f8b003da4e3a2459056591fbfebd02b4dc3e5adeb158616b90cf55a65113ec` |
| npm package lock | `e7c525a1ac0381f293414b950261cb4814491f9563dd30dda9d3946b3127c9cd`. All 109 resolved URLs use registry.npmjs.org. npm installed 59 packages on this platform. |
| Composer lock | `0fa6d980d1b29a859a425e0d863268e71d082b0694423d6213f7a4dfdf503007`. Composer installed all 20 production and 25 development packages from the public lock. Platform checks passed. |

Both tool downloads matched the publishers' checksums and the previously recorded project pins before execution. Composer ran with an isolated home/cache. npm used separate empty user and global configuration files. The checkout used neither existing node_modules/vendor nor symlinks to another checkout. Guest play requires the exported media already in the checkout. Editable media were retrieved into a separate empty directory. [Toolchain sources](runtime.md#artifact-verification) · [Source retrieval guide](../../source-retrieval.md)

## Build, credits and local service

From the candidate root the documented `npm ci`, `composer install --working-dir=server`, `npm run check` and `npm run build` all exited successfully. The build used its checked-in TypeScript and Vite configurations. Vite reported its chunk-size advisory for the main JS file. The browser-matrix identity for the resulting 442 files was `b2837859285e3f00adea34342ffeee2606de5383ca3295c8e689f26dec2f3361`. That identity hashes compact JSON pairs of relative POSIX path and lowercase SHA-256 in path-component order. The per-file comparison included the hidden Vite manifest. Two separately maintained local reference distributions were compared only after the public build and matched all 442 hashes.

| Check | Observed result |
| --- | --- |
| `npm run preview:client` | On loopback at the production-shaped nested path, the HTML and two credits files returned 200 and matched the build bytes. Freshly downloaded Chromium 159.0.8154.6 opened the title credits, found both public documents, closed the panel and entered the guest room. |
| Output identities | Entry `index-Bgxkwj9F.js` was 3,466,129 bytes, SHA-256 `6f330cb9adf6dd8b436cdb565fe5c4fc574323cb86cb933a07d1519d0229f833`. The media register was 896,244 bytes (`5ee629d450df36ac6b69cd02669e73e63bc454267d01b709de7e62692d5de29e`). The software notice was 260,031 bytes (`5197c8e28b29760a9177f0525ec3c887a97d7c29614b440aecf57cdf88c8eb7d`). |
| `python3 tools/credit-register.py --public` and `node tools/verify-credit-bundle.mjs` | Verified 398 renditions, all 424 public media files, both registers, 203 license copies and both locks. The anonymous check matched 1,390 linked source/notice/rights blobs and the availability of the historical guide. The in-memory production build verified the four bundled browser modules, Vite/Rolldown helpers and absence of bundled font files. |
| `npm run dev:verify` and `npm run test:api` | All 12 disposable HTTPS transport groups and 910 PHP tests / 19,175 assertions passed. The seven measurement-harness cases separately passed 359 assertions with the pinned Node executable outside the repository. All account/service inputs in these tests were synthetic. |
| Full domain suite | A default-worker run overlapped source checks and recorded five 5-second timeouts, with 4,385 passes and 360 TODOs. The timed cases covered roster validation, R01 media admission, autosave, packet teardown and policy generation. A complete repeat with `npm run test:domain -- --maxWorkers=3` kept the original test deadline and passed **4,390 tests across all 121 suites** in 115.69 seconds. The 360 historical TODOs remain separately reported. |
| `npm run assets:verify` | Inventory mode reported zero issues. The current release-mode listening findings and registered review evidence are documented separately. [Media audit](media-audit.md) |

To repeat the distribution comparison after `npm run build`, run this from the project root. It checks both the path set and the bytes of each file at the pinned candidate.

```sh
python3 - <<'PY'
import hashlib, json
from pathlib import Path
dist = Path('dist')
files = [[file.relative_to(dist).as_posix(), hashlib.sha256(file.read_bytes()).hexdigest()]
         for file in sorted(dist.rglob('*')) if file.is_file()]
ledger = json.loads(Path('docs/evidence/spec001/performance/t155/production.json').read_text())
assert dict(files) == ledger['distribution']
print(len(files), hashlib.sha256(json.dumps(files, separators=(',', ':')).encode()).hexdigest())
PY
```

## Editable media and public Git objects

The editable snapshot is pinned to `33db08b7ba26cdcbcac5460229f8cf484c7db5e8`, the integrated media revision that also anchors the player credits. The published candidate adds the new index afterward so that the index can name an existing immutable source revision. Running the checked-in generator against that commit reproduced `assets-src/source-index.json` byte-for-byte, SHA-256 `b1db19b13f2c05dec4ae13e01d5736de2d2b7acfb3c0badaf3f816569f2245c6`. [Source pin](https://github.com/automateyournetwork/Network-Quest/tree/33db08b7ba26cdcbcac5460229f8cf484c7db5e8) · [Candidate index](https://github.com/automateyournetwork/Network-Quest/blob/ae8472469b5f7d98e939ccb5471b03893630993a/assets-src/source-index.json)

Between 13:06:29 and 13:08:27 UTC the candidate's `node tools/fetch-sources.mjs --dir ../editable` downloaded **all 2,067 files, 2,024,142,069 bytes**, from public raw GitHub to a new directory. It reused zero files. The immediate offline `--verify --dir ../editable` run rehashed all 2,067. An independent Python 3.14.6 verifier enumerated the exact recovered file set, compared sizes and SHA-256 with the published index, then calculated each file's Git blob ID and matched it to both commits' public Git trees. There were zero extra, missing or mismatched files.

| Public source or check | Observed result |
| --- | --- |
| Editable tree and manifest | The media pin's `assets-src/` tree is `fd4855d0c421313d62049fc113e6c47729c94ed3`. The candidate's tree is `c4349a381699cb844d3481096c01f8401d921de9`. The index is the only path that changed. The manifest blob at both commits is `a4e1e059a28e867666cfd548ff31038f2b8eb4d5`, SHA-256 `657792c999e3f4b6878e852b7534a0bf39d4abe44e089a307cbcb53212175d85`. |
| Media exports and credits | Both commits have the same `public/assets/` tree, `ae38bc61a3064d0718cbe906fa9ebbd629aecda7`. The candidate's `public/credits/` tree is `9c8030e6e53e22888a8fa164a34526e0e777e5a2`. The shared `docs/evidence/spec001/media-audit/records/` tree is `605df83cceb91fedcb2b1b70f4cda4097fdbebd0`. The credits check also resolved rights records in the historical assets evidence directory. |
| Canonical inputs | The 396 primary records plus two additional renditions declare 929 unique source paths totaling 1,970,143,484 bytes. The other 1,138 supporting files total 53,998,585 bytes. Raw generation accounts for 98 PNGs, 69 WAVs and 24 FLACs. |
| Native formats | All 179 declared Blender files had Blender headers after decompressing where needed. Each of the 110 Audacity 4 projects opened in read-only immutable SQLite mode, passed `quick_check`, had application ID `AUDY` and contained the project and sampleblocks tables. The verifier also checked the binary signatures of all 190 declared PNGs, 331 WAVs and 24 FLACs. The remaining declared sources were 60 text files, 29 JSON files and six Python scripts. |
| Earlier snapshot | The historical guide, tool and index still address `59768bf788f9c8609b8687235ca21a2b7942f871`. Using the published historical tool and index, an anonymous audit of the four documented R12 examples re-read all 42,519,131 bytes. T145 records the earlier complete 2,063-file retrieval. [Earlier verification](source-retrieval.md) |
| Retrieval CLI | All 19 focused source-retrieval tests passed from the clean public checkout. The binary format checks establish material availability and structure. Visual, listening and owner judgments retain their recorded scope. |

## Contributor issues corrected

The measurement harness formerly chose a fixed repository-local Node path even when the contributor supplied an external pinned binary. The main fixture and measurement server now share executable selection. The interrupted-run test forwards the validated path to its otherwise isolated child process. A preliminary subset archive omitted test fixtures and produced errors. The full published checkout passed the focused and complete suites above. [Shared test environment](../../../server/tests/Support/TestEnvironment.php) · [Measurement server](../../../tools/NativeMeasurementServer.php)

At `ec8c33becbcb52ba6560fcf10cbbf3b50663dbe1`, 202 of 203 dependency notices matched the public Git inventory. A broad `vendor/` ignore rule hid the TypeScript copy of the vscode-jsonrpc license. The 365,612-byte official TypeScript 7.0.2 archive matched the lock's SHA-512 integrity value. Its 1,095-byte `package/vendor/vscode-jsonrpc/License.txt` matched the recorded SHA-256 `ec9ee83580841e8eb687aca9867f221503809ba6426c7f876ede17d91b9fcfd0`. The candidate tracks that one notice. A disposable Git probe confirmed that arbitrary sibling files and dependency vendor directories continue to be ignored. The complete credits check then verified all 203 notice copies. [Preserved notice](../../../licenses/npm/typescript@7.0.2/vendor/vscode-jsonrpc/License.txt) · [Public TypeScript archive](https://registry.npmjs.org/typescript/-/typescript-7.0.2.tgz)

The earlier guide described only R01/R02, the first copper test slice and pending browser integration. The contributor README and quickstart now describe the twelve-room guest game, actual public commands, configured synthetic-account tests, editable retrieval and remaining release evidence. [Quickstart](../../../specs/001-physical-layer-underworld/quickstart.md) · [Gate ledger](gates.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
