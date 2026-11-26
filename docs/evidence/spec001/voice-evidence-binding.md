# T061 voice evidence binding follow-up

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Loop076, 2026-11-26. Scope: offline evidence consistency for declared voice
production, under C5/C11/C14, FR-018/024, AC10 and T061. This is a correction to
already accepted T061, not a second task completion or media acceptance.

## Finding and independent cases

The original accepted-voice block used the first per-asset production observation
whose method was `tts-generated`. It did not use the event IDs declared in the
asset's production list. The separate production audit correctly looked up those
IDs, but did not connect their voice hash to that later check. A historical event
could therefore reject a truthful current metadata revision, or an unrelated
event could make a mismatched current voice record appear valid. Two observations
claiming the same declared event also depended on insertion order.

The additive `tests/content/voice-evidence-binding.test.ts` was authored and run
before changing the validator. Its 47 cases use newly authored synthetic files
and testimony; no production output supplies expected answers. Every expected
validity, issue code and voice count is written explicitly. The frozen T060 JSON,
its test suite, the adapter tests and the manifest schema were not changed.

The cases cover all six permutations of current/historical/unreferenced records;
stale tool/version/model/hash; absence of declared TTS; a declared non-TTS event;
script and optional voice-path disagreement; multiple declared TTS events;
identical and contradictory duplicate declarations/observations in both orders;
missing/changed JSON bytes, wrong asset/event, failed status and missing output
hash; source/raw-byte binding; exact caption/text/speaker/script hashes; and pure
input preservation.

## Resolution

For voice TTS production, resolve observations by the asset identity and the
declared `eventId`. Reuse those observed records in the accepted-voice audit.
Every declared TTS event must bind the current voice record hash, tool, version,
model revision and exact script path. If a production record additionally supplies
`voiceRecordPath`, it must agree with the manifest. Existing hash-only evidence
remains supported, including the frozen T060 fixture.

Distinct unreferenced historical IDs cannot establish or invalidate the current
voice binding merely by appearing first. Normal structural and observed-JSON
integrity checks still apply to all loaded evidence. Historical records are not
deleted, rewritten or promoted into declared production.

The schema has no precedence rule for multiple observations of one declared
asset/event identity. Nonidentical declarations or observations for that identity
therefore fail closed with `PRODUCTION_EVIDENCE_AMBIGUOUS`. Identical duplicates
are permitted only when every copy has its own matching observed JSON bytes.
This conservative equality compares the full declaration/observation, including
testimony metadata; an intentional metadata revision should use an explicit
distinct revision ID rather than depend on filename ordering. With multiple
declared TTS event IDs, all must support the single current voice record; there is
no invented first/latest/winner policy.

Existing production method/model/settings/prompt/output/source checks and current
caption/text/speaker/script-byte checks remain in force. Non-voice production,
rights, retrieval, review, usage, quotas and release minima retain their previous
semantics. No schema or adapter change was necessary.

The original actual generation identity in optional voice metadata is not
required to equal a later declared metadata-revision identity. Loop075 preserves
that original identity and adds distinct `-metadata-v2` observations with the
same original raw output. Its narrator-005 projection was inspected to confirm
the declared script path agrees. That inspection is not a new generation,
listening review, acceptance-mode promotion, or acceptance of the whole packet;
the coordinator owns the real manifest join.

## Executed verification

Pinned `.runtime/node-v26.13.1-darwin-arm64/bin` was prepended to PATH. Commands:

```sh
npm run test:domain -- tests/content/assets.test.ts tests/content/asset-adapter.test.ts tests/content/voice-evidence-binding.test.ts
npm run test:domain -- tests/content/assets.test.ts tests/content/asset-adapter.test.ts tests/content/room-models.test.ts tests/content/voice-evidence-binding.test.ts
npm run typecheck
git diff --check
```

| Run | Actual result |
| --- | --- |
| Initial joined RED, 16:15:28 local | 25 failed / 312 passed / 337 total; all 290 existing checks passed; 3.22 seconds |
| Isolated RED after fixture isolation, 16:15:58 local | Same 25 failed / 22 passed / 47 total; 0.165 seconds |
| Joined GREEN, 16:16:21 local | 337 passed across 3 suites; 3.01 seconds |
| Final joined GREEN with shared room-model audit, 16:18:25 local | 362 passed across 4 suites; 2.99 seconds |
| TypeScript check | PASS, exit 0 |
| Diff whitespace check | PASS, exit 0 |
| Frozen oracle/schema comparison with HEAD | No diff |

The initial absent-declared-event fixture also triggered an unrelated external
reference-rights issue. Before implementation, its synthetic editing reference
was removed and its observation updated to isolate the intended defect. Its
negative expectation was unchanged, and the second RED run then demonstrated
the old validator falsely accepting that case. No frozen fixture was edited.

The 25 RED failures were four stale-record permutation failures, four borrowed
tool/version/model/hash cases, absent declaration, non-TTS declaration, script
and voice-path mismatch, one multiple-declaration ordering case, ten contradictory
observation cases and two contradictory declaration cases. Final GREEN comprises
249 frozen schema/semantic tests, 41 existing adapter/boundary tests, 25 unchanged
room-model cases and 47 new binding tests. The coordinator requested the final
room-model join because that suite shares this validator. The existing adapter
test also runs the actual canonical inventory
and expected release failure with zero accepted counts. No full client/browser,
build, deployment or provider suite ran in this follow-up.

## Seals and limits

| File | SHA-256 |
| --- | --- |
| Pre-change validator from HEAD | `ace87bf1779fd5bbcb76740532301c19137675decda2b4d983d07e6341e489ed` |
| `tools/validate-assets.ts` | `316489192b101c1b17a12f8b43672bcfa30516c308caa7338c0a2e9c1ab4fd47` |
| `tests/content/voice-evidence-binding.test.ts` | `559ffd3c83b10cbb0734cb7ea3edacb6e296f9eabdcd0cf554669fd1699dce5a` |
| `tests/content/assets.test.ts` unchanged | `a2923854b318ca0e80368f6179510d7c1e5da7d3a8d0c131be8a809a7c4724a3` |
| `tests/content/asset-adapter.test.ts` unchanged | `ab8558bf7c90a0dbc925f90e0a914351870de93c2c98331a6ff939732ac14b8c` |
| `tests/content/room-models.test.ts` unchanged | `78bdf02767ea22adc489181c3a163858f8586ba5525468533d94365991c77f55` |
| `tests/fixtures/asset-manifests.json` unchanged | `8cd21b7ea6005f0fc9c7e30724326cf18129d7a9c0308e6438cb9e7a12e82b9a` |
| `contracts/asset-manifest.schema.json` unchanged | `d4722a7dd2cf1ac66dc71196fe3fbcac794e12d3dad123873870259d950d91b9` |

This validates consistency of supplied evidence, not the truth of synthetic
testimony or actual audible quality. No human acceptance was generated. Existing
owner audio approval is preserved; no source/media/runtime/content/manifest or
task-count change was made. Canonical accepted media quotas remain zero. T066,
T067, aggregate gates, real provider/host and release acceptance remain separate.
