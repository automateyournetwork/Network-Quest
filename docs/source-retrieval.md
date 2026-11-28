# Retrieve the Spec001 media sources

The twelve-room source snapshot contains 2,063 files totaling 2,022,916,002 bytes. It is pinned to commit `59768bf788f9c8609b8687235ca21a2b7942f871` in the public Network-Quest repository. The game plays the exported media under `public/assets/`. Contributors can download the editable media independently with Node.js 26.13.1. Anonymous retrieval needs only Node, the fetch tool and its adjacent project index. [Public source commit](https://github.com/automateyournetwork/Network-Quest/tree/59768bf788f9c8609b8687235ca21a2b7942f871) · [Source index](../assets-src/source-index.json) · [Fetch tool](../tools/fetch-sources.mjs)

## Fetch or verify

From a checkout containing the tool and index, choose an existing destination directory that you control. An empty directory lets you reproduce the snapshot beside a working checkout. Allow about 2.1 GB of free space for the complete library.

```sh
mkdir -p ../nq-spec001-sources
node tools/fetch-sources.mjs --dir ../nq-spec001-sources
node tools/fetch-sources.mjs --verify --dir ../nq-spec001-sources
```

For one file, specify its exact repository-relative path. Repeat `--path` for several files. This example retrieves a native room, an editable Audacity project and the original and registered images for a room layer.

```sh
node tools/fetch-sources.mjs --dir ../nq-spec001-sources \
  --path assets-src/rooms/R12.blend \
  --path assets-src/audio/T126/projects/r12.aup4 \
  --path assets-src/images/R12/originals/foreground.png \
  --path assets-src/images/R12/registered/foreground.png
```

Use `node tools/fetch-sources.mjs --list` to see every SHA-256, byte count and path. Use `--audit` for a fresh anonymous GET and hash of each selected file without saving it. Use `--verify` for an entirely offline check. Omitting `--dir` selects the current directory. Every successful fetch, audit or verify ends with a JSON summary and exit code 0. A failed check names the affected path and exits nonzero.

The fetcher streams up to six files at once. It checks size and SHA-256 before publishing a complete file with an atomic hard link. Use a destination filesystem that supports hard links. A repeat run verifies and reuses existing files. If a file differs, move your copy aside or choose a fresh directory, then rerun the command. A terminated transfer preserves completed files. A forced process kill can leave a hidden `.nq-source-*.partial` file beside the intended file. It has no role in verification and may be removed after fetches in that directory finish. Avoid moving or replacing destination directories during retrieval.

## Find a source and its credit

Each index row describes one actual path. Append that path to `https://raw.githubusercontent.com/automateyournetwork/Network-Quest/59768bf788f9c8609b8687235ca21a2b7942f871/` for the exact HTTPS retrieval URL. The CLI constructs these URLs from the pinned revision and rejects redirects. To retrieve manually, compare both the received byte count and SHA-256 to the same row. [Example room source](https://raw.githubusercontent.com/automateyournetwork/Network-Quest/59768bf788f9c8609b8687235ca21a2b7942f871/assets-src/rooms/R12.blend)

The canonical media manifest has 396 primary asset records and two additional renditions. They declare 929 distinct source paths. The index includes the complete committed `assets-src/` production tree at that revision plus the exact public references, scripts, settings and notices those records name elsewhere. This preserves image prompts and tool receipts, editable sources, raw generations, masks, layered derivatives, audio mix inputs and masters, and their production records. Historical feasibility samples have their original provenance and do not add to the media quotas. [Pinned canonical manifest](https://github.com/automateyournetwork/Network-Quest/blob/59768bf788f9c8609b8687235ca21a2b7942f871/assets-src/manifest.json)

Where present, `assetIds` lists the asset records that directly name a path as a source, production input or rights record. Look up those IDs in both `assets` and `additionalRenditions` in the pinned manifest. Each rendition records source roles, applications and versions, export lineage, creators, license IDs, permission and notice paths, and its current review status. Additional files retained with their production batch may have no direct asset ID. Native Audacity 4 projects use `.aup4`. Consult the batch instructions and preserved notices before editing or redistributing material. [Contribution terms](../CONTRIBUTING.md) · [Third-party notices](../THIRD-PARTY-NOTICES.md)

## Update the pin

After a reviewed public checkpoint changes the production tree, generate a candidate index from that full commit ID. The generator reads committed objects, checks every declared source against the canonical manifest and emits rows in path order. The index itself is excluded from its own inventory. Use a temporary output, inspect the diff, then test the new index with the fetcher and a clean destination before publishing it. Preserve old commits for earlier consumers.

```sh
python3 tools/index-sources.py 59768bf788f9c8609b8687235ca21a2b7942f871 > candidate-source-index.json
cmp candidate-source-index.json assets-src/source-index.json
```

The retrieval audit covers source availability and integrity. Independent release-candidate builds, media acceptance and deployment have separate evidence records. [T145 verification](evidence/spec001/source-retrieval.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
