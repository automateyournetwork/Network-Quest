# T145 · Public source retrieval

Spec001 · US8 · C2/C5/C11/C13 · FR-023/024 · AC16 source availability

On 2026-11-27 from 23:56:13 to 23:59:20 UTC, an anonymous client fetched and SHA-256 verified all 2,063 indexed files, totaling 2,022,916,002 bytes, from the public repository at commit `59768bf788f9c8609b8687235ca21a2b7942f871`. The destination started empty. All 2,063 files came from public HTTPS responses. The run used Node.js 26.13.1 on macOS arm64 with its environment cleared except for `LANG=C`. The tool used the default TLS trust store, the fixed raw GitHub origin, omitted credentials and refused redirects. [Pinned repository](https://github.com/automateyournetwork/Network-Quest/tree/59768bf788f9c8609b8687235ca21a2b7942f871) · [Index](../../../assets-src/source-index.json)

A separate anonymous `git ls-remote` read of `refs/heads/001-physical-layer-underworld` returned that exact commit. This read disabled system and user Git configuration, credential helpers and prompting. A separate anonymous GET of the branch's canonical manifest yielded SHA-256 `f0f2c36fe9d730d0257ae43879e2c19be0bcfed9fadb9cacb3d367f2b76f1893`. The immutable copy had the same hash. Two deterministic index generations from committed Git objects produced identical bytes with SHA-256 `b34bba627105bfedce8e284fd247de30148ea27f43cf2bf386a69327f25f6705`. [Pinned manifest](https://github.com/automateyournetwork/Network-Quest/blob/59768bf788f9c8609b8687235ca21a2b7942f871/assets-src/manifest.json)

## Results

| Check | Observed result |
| --- | --- |
| Clean retrieval with `--dir` | 2,063 downloaded, 0 reused, 2,022,916,002 bytes |
| Offline repeat with `--verify` | 2,063 existing files rehashed successfully |
| Independent Python 3.14.6 verification | Compared the exact destination path set, every file size and every SHA-256 against the index. Zero missing or extra files. Rechecked all 929 declared source files directly against the recovered canonical manifest. |
| Canonical coverage | 396 primary asset records and two additional renditions reference 929 distinct source paths totaling 1,970,143,484 bytes. Shared source paths occur once in the retrieval index. |
| Supporting files | 1,134 additional files totaling 52,772,518 bytes include production settings, prompts, tool receipts, scripts, auxiliary media, historical samples and notices. |
| Native Blender sources | All 179 distinct declared `.blend` files had Blender headers after decoding compression where present. |
| Native Audacity 4 projects | All 110 distinct declared `.aup4` files passed SQLite `quick_check` opened read-only and immutable. Each had application ID `AUDY` and the project and sampleblocks tables. |
| Raw and edited media | Checked file signatures for the 190 declared PNGs, 331 WAVs and 24 FLACs. The manifest identifies 98 PNG, 69 WAV and 24 FLAC paths as raw generation. The remaining declared source formats comprise 60 text files, 29 JSON files and six Python scripts. |
| Documented four-file example | A separate public `--audit` streamed and verified 42,519,131 bytes for the R12 room, Audacity ambience project, original foreground and registered foreground. |

For a repeat on any public checkout containing the tool and index, use the contributor commands and select a fresh destination. The complete transfer returns the following receipt. [Contributor guide](../../source-retrieval.md)

```json
{"revision":"59768bf788f9c8609b8687235ca21a2b7942f871","mode":"fetch","files":2063,"bytes":2022916002,"downloaded":2063,"reused":0,"audited":0}
```

The targeted Vitest suite passed all 19 cases on Node 26.13.1. Cases included independent public URL and request-option checks with a controlled transport, offline repeat, simultaneous clients, truncation, excess bytes, same-size corruption, interrupted response, process termination/retry, redirects, preexisting data, symlinks, unsafe/private paths, case and file/directory aliases, mutable revisions and unknown selections. TypeScript checking passed. The clean public transfer used the real HTTPS client. [Regression tests](../../../tests/tools/source-retrieval.test.ts)

These results cover public retrieval for the named twelve-room snapshot. Human media and rights review, the clean release-candidate build under T157 and final release verification under T169 retain their own acceptance evidence.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
