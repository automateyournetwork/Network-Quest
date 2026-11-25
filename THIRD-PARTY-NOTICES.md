# Third-party notices and source retrieval

The original-work license split in [NOTICE](NOTICE) does not relicense third-party
software, media, templates, model weights or reference material. Their authors
retain their rights. This register covers the npm and Composer locks and the
local Spec Kit scaffold reviewed on 2026-11-25, and points to the separate
feasibility-media record. It is not a claim
that every dependency is Apache-2.0 or that a production release has passed review.

## Spec Kit development scaffold

The `.agents/skills/speckit-*` skills and upstream portions of `.specify/` come
from [GitHub Spec Kit](https://github.com/github/spec-kit/tree/2f5417f0addba343b07c8f805b6b30159cab1dad),
installed as `0.7.1.dev0` from commit `2f5417f0addba343b07c8f805b6b30159cab1dad`.
This includes the bundled Git Branching Workflow extension `1.0.0`, its five
migrated skills, Codex integration scripts and Full SDD Cycle workflow `1.0.0`.
They retain the MIT license and **Copyright GitHub, Inc.** Preserve the complete
[upstream license](licenses/scaffold/spec-kit/LICENSE) with copies or substantial
portions, including modified templates and generated command wrappers.

[The scaffold provenance manifest](licenses/scaffold-provenance.json) records
the immutable source, archive/license hashes and all 54 local scaffold files.
It distinguishes unchanged upstream files, generated installation records,
skill wrappers, the original project constitution and project modifications.
Network Quest modified `speckit-implement`, `speckit-tasks` and the agent, plan,
spec and task templates for its governance, evidence and execution rules.
Original project prose additions remain under the project's CC BY 4.0 offer;
that does not relicense the underlying MIT material. The exact tool/version
that migrated the five Git skill wrappers is unknown; their command bodies
match the pinned upstream commands after removing frontmatter and outer whitespace.

This is development/governance source, not a game runtime dependency. Keep the
linked constitution and supporting scaffold in a source checkout; game release
packaging need not ship agent commands. The [scaffold review](docs/evidence/spec001/scaffold-licensing.md)
records the scope and separate publication review limits. This register does not
cover unrelated user-installed skills or plugins.

## Locked software

[The readable package index](licenses/DEPENDENCIES.md) identifies every package,
version, declared license and copied notices. [The machine-readable inventory](licenses/dependency-inventory.json)
also records lock hashes, exact public archives/source revisions, npm integrity,
installed/optional/development status and SHA-256 of each notice. The 203 preserved
files in `licenses/npm/` and `licenses/composer/` retain the upstream text, including
copyright holders and bundled-component notices; do not replace them with this summary.

| Lock | Packages | Declared package licenses |
| --- | ---: | --- |
| npm | 109: 7 production, 102 development; 59 installed here | 64 MIT; 27 Apache-2.0; 14 MPL-2.0; 2 BSD-3-Clause; 1 ISC; 1 0BSD |
| Composer | 45: 20 production, 25 development | 24 BSD-3-Clause; 15 MIT; 6 Apache-2.0 |

These are lock metadata counts, not a bundle-composition analysis. Native binaries
and upstream bundles can include additional components; retain the full supplied
third-party notices. In particular, Playwright's `ThirdPartyNotices.txt`, Vite's
bundled license register, axe-core's `LICENSE-3RD-PARTY.txt`, Rolldown's
`THIRD-PARTY-LICENSE`, TypeScript's `NOTICE.txt`, Google Auth's `COPYING`, and Opis's
`NOTICE` files are preserved. Installed browsers and local Node/PHP/Composer/media
tools are not distributed by this source checkout.

No dependency was modified by this review. Rolldown native binding archives omit
their own notices; the corresponding same-version wrapper's license and bundled
notices accompany every binding in this register. `@napi-rs/wasm-runtime@1.2.6`
omits a license file; the MIT text is preserved from its exact upstream gitHead,
also confirmed by the peeled release tag, in
[supplemental-notices.json](licenses/supplemental-notices.json).

## MPL-2.0 components

`@axe-core/playwright@4.14.1`, `axe-core@4.14.1`, `lightningcss@1.33.0`, and the
eleven locked platform-specific Lightning CSS packages use
[MPL-2.0](licenses/MPL-2.0.txt). They are development/build tools in the current lock.
Using a tool to build independent project code does not make that code MPL.

If distributing covered code, preserve its notices and MPL terms. Covered source
files and modifications remain available under MPL; combining separate original
files in a larger work does not change their Apache-2.0 license. For executable
or minified distribution, tell recipients how to obtain the corresponding preferred
source form, including any modifications, without restricting their MPL rights.
A link only to minified JavaScript or a native binary is not source delivery.
These obligations follow [MPL sections 3.1–3.4](https://www.mozilla.org/en-US/MPL/2.0/)
and Mozilla's [distribution FAQ](https://www.mozilla.org/en-US/MPL/2.0/FAQ/).

The following exact upstream sources were anonymously downloaded, hashed and
inspected for editable source files and their license on 2026-11-25:

| Component | Public source at reviewed revision |
| --- | --- |
| axe Playwright integration | [axe-core-npm `722c21c1`](https://github.com/dequelabs/axe-core-npm/tree/722c21c130c574ad0aa52b27dc8eef12f03c89cd) — TypeScript in `packages/playwright/src/` |
| axe-core | [axe-core `c3f48c63`](https://github.com/dequelabs/axe-core/tree/c3f48c6357ceafa6677492091adbf89a72cad527) — JavaScript in `lib/`; resolved tag `v4.14.1` |
| Lightning CSS, including native variants | [Lightning CSS `1d680fa1`](https://github.com/parcel-bundler/lightningcss/tree/1d680fa14e9a089c92dc0929f869d6757ae91c30) — Rust/JavaScript sources and build files |

[mpl-source-retrieval.json](licenses/mpl-source-retrieval.json) contains complete
commit IDs, downloadable archive URLs, SHA-256, sizes, sample source paths and
license-copy hashes. No modified MPL files exist in this change. Recheck these
URLs when packaging; preserve an accessible matching source mirror if needed.
Release recipients must receive this notice/source pointer with any covered code
that actually ships. T010 does not certify a future binary distribution.

## Reproducing this register

Install the exact locked dependencies using the documented local toolchain and
reviewed install settings. Then, from the repository root:

```sh
python3 tools/license-inventory.py --refresh
python3 tools/license-inventory.py
```

Refresh copies installed legal files and downloads only absent npm packages to
read their notices. It verifies each downloaded archive's lockfile SRI, never
executes archive contents and retains no binaries. It reads Composer packages
already installed under `server/vendor/`; it does not install or run them. The
default invocation is offline and checks exact lock coverage plus all copied-file
hashes. Inspect the refreshed differences; metadata is not a substitute for review.

Every npm record has its exact tarball URL and integrity value. Every Composer
record has its public source URL and immutable reference plus distribution URL.
`npm ci --ignore-scripts` and `composer install --no-plugins --no-scripts` reproduce
the locked upstream files using the selected runtimes; do not treat those commands
as review of newly changed lifecycle hooks or dependencies. For MPL preferred source,
use the source archives above rather than only the npm executable package.

## Media, models and external references

The existing [feasibility source record](assets-src/feasibility/README.md),
[model provenance](assets-src/feasibility/model-provenance.json), preserved
[tool/model licenses](assets-src/feasibility/licenses/), and
[bounded rights findings](docs/evidence/spec001/media-feasibility.md) remain intact.
They distinguish Apache/MIT model and wrapper components from GPL production tools
and separately credited data. The MIT eSpeak wrapper does not relicense its GPL
library. Those local tools/weights are not bundled into the game or this register;
roughly 14 GiB of local environments remain ignored. Their output is not approved
by tool availability or license metadata, and listening remains a separate review.

OpenAI production imagery follows the
[dated output-terms review](docs/evidence/spec001/licensing.md#openai-production-image-terms)
and individual source acceptance. Reference inputs, historical games and third-party
media retain separate rights. Original authored media and project-controlled edits
use CC BY 4.0; uncertain output copyright is not presented as exclusive ownership.
Public large-source delivery must follow [CONTRIBUTING.md](CONTRIBUTING.md#public-sources-and-large-files).

Before publishing a release, match the actual delivered files to these notices,
add any newly bundled components/assets, provide source/credit where required and
verify anonymous retrieval. Do not ship development dependencies, tools, models,
private data or unrelated research files merely because they appear in a lock or
local environment. Source-checkout notices are a starting inventory, not G7 evidence.

Copyright 2026 John Capobianco. Original explanatory text: CC BY 4.0.
Copied third-party notices retain their respective terms.
