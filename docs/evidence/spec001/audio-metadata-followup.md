# T065 audio metadata follow-up — loop 075

Date: 2026-11-26. Worker: `/root/loop075_t065_metadata`. Scope: C5/C11/C13,
FR-018 and AC10 source provenance, following the already accepted T065 audition.
This is an additive metadata correction ready for coordinator review. It adds no
task completion, accepted quota, audible review, production run or gate approval.
The coordinator owns the canonical manifest, task tracking and publication.

## Exact correction

The [candidate fragment](../../../assets-src/audio/auditions/metadata-followup/manifest-candidates.json)
copies the current canonical twelve audio entries, including their five integrated
and seven exported statuses, `usedBy`, false quota flags, file hashes, rights and
verification records. Its SHA-256 is
`752eb9ea9b10b79f5ca70379c0236d5d1972b99de752db84b969b80d84f36e81`.
The [change list](../../../assets-src/audio/auditions/metadata-followup/changes.json)
contains exactly 60 changed leaf fields:

- 36 `sources[].file.format` values become `wav`: twelve raw files, twelve
  prepared mix inputs and twelve native masters. RIFF/WAVE headers confirm the
  container. The [format observations](../../../assets-src/audio/auditions/metadata-followup/source-formats.json)
  preserve each former label and actual subtype: 24 FLOAT and 12 PCM_24 files,
  with original sample rates, channels, bit depths and file hashes. No samples
  were changed, decoded into new files or re-encoded.
- Eight `audio.voiceRecordPath` values now point to exact per-line JSON records
  under `metadata-followup/voices/`, replacing the aggregate run path. Each
  preserves the exact text, speaker, voice ID/recorded embedding hash, script
  path/hash, raw path/hash, original event ID, model/revision, tool/version,
  pronunciation overrides, phonemes, speed and language. Each also identifies
  the preserved aggregate run and request row with a JSON pointer and file hash.
- Eight TTS production `eventId` values append `-metadata-v2`, and eight `notes`
  fields explicitly identify a metadata-record revision of the same generation.
  The model, tool, inputs, output hashes and actual generation remain unchanged.

The current schema has no production `evidencePath`. The revised IDs instead
identify eight discoverable [supplemental production records](assets/t075-audio-meta/).
These records bind `voiceRecordPath` and `voiceRecordSha256` and retain the exact
original generation ID, run hash and superseded evidence path/hash. Their agent
PASS concerns the verified metadata projection, not a new generation or human
review. The original per-line production evidence remains intact. The
[binding index](../../../assets-src/audio/auditions/metadata-followup/production-binding-followup.json)
lists every old and supplemental record and hash.

All eight lines use the actual recorded Kokoro 0.9.4 run, model
`hexgrad/Kokoro-82M`, revision
`f3ff3571791e39611d31c381e3a41a3af07b4987`. Narrator lines 001/005 retain `af_heart`;
Titan 019/025 retain `am_michael`; Photon 035/042 retain `af_bella`; Hermit 051/057
retain `am_fenrir`. No provider, voice, model or speaker-consent claim was added.

## Verification performed

The existing commands below both exited 0 with `valid: true`, no issues and every
quota count zero. Exact outputs are in
[inventory-audits.json](../../../assets-src/audio/auditions/metadata-followup/inventory-audits.json).
The CLI performs the existing manifest schema, evidence shape, file and semantic
inventory checks. It does not exercise accepted-only requirements for these
nonaccepted candidates.

```sh
.runtime/node-v26.13.1-darwin-arm64/bin/node tools/validate-assets.ts --manifest assets-src/audio/auditions/metadata-followup/manifest-candidates.json --mode inventory
.runtime/node-v26.13.1-darwin-arm64/bin/node tools/validate-assets.ts --mode inventory
```

An independent read-only Node 26.13.1 audit compared actual SHA-256/UTF-8 bytes
and recursively compared the candidate with the canonical entries. It verified:

- Exactly the 60 allowed leaf changes; all other fields and shapes unchanged.
- Eight request rows equal their corresponding preserved run inputs; exact text
  and speakers also match the selected production plan. All eight script/raw
  hashes match actual files. No trailing newline or pronunciation rewrite was
  inserted into a script.
- Eight projections match their declared supplemental production records and
  all referenced original metadata hashes. The two already integrated dialogue
  entities, VOICE-001 and VOICE-035, match their text and speaker exactly.
- All 207 historical source/evidence files and all 33 approved packet files
  remain byte-identical. The canonical manifest also remains unchanged by this
  worker. Detailed results and tool/schema hashes are in
  [projection-audit.json](../../../assets-src/audio/auditions/metadata-followup/projection-audit.json).

No new tests were added for these data edits, no accepted statuses were created
to exercise the validator, and no build, browser, native UI, generation or provider
operation was run. Loop 076 owns the separate validator correction and its
independent tests.

## Preservation and interruption

[Before](../../../assets-src/audio/auditions/metadata-followup/preservation-before.json)
and [after](../../../assets-src/audio/auditions/metadata-followup/preservation-after.json)
contain every actual original source/packet hash and byte count. Their SHA-256s
are respectively `003abafcfe3e2392dafb9c98d6cd0d821eca4dabbcb213a87f387a31c1b3b3cf`
and `bb1d2feed1b60c2e4bcec677ffbc6118d0d1d7fdac4a679845971102bda9b82f`.

| Preserved item | SHA-256 before and after |
| --- | --- |
| Original 207-file seal | `d57a0db5b15f1cab21c404246400e42c4793e7af673db6a404fd35b277d97823` |
| Approved 33-file packet seal | `89e98ccf375c685164ba63b046a9c8daf17286cb8e0fa171d3a74e7900e6f3e0` |
| Native Audacity bank | `3d17afa984c7ef855b7cd9bee434502c433f5a4ad28099a1b7e61043c6358d35` |
| Actual aggregate voice run | `1d265266571ea30b81f127ac959515f5142b457e0ff386803c2806d623f86bfe` |
| Exact voice requests | `c0ec772baf0da9536fe8d9880117c230a56abed7f47b806104e06b844c8f1a1d` |
| Original candidate manifest | `6b056ece4ec2177e98b7a4280ba60a4f4a06fa474fe62e4af2870c0c595cec60` |
| Canonical manifest at this handoff | `94c60c7711040dff422a7145f0b630a6fe0a997d22d39db972c9a74ce34dcae5` |

Before the initial capture, the coordinator moved its later acceptance appendix
out of loop 070 into [audio-coordinator-review.md](audio-coordinator-review.md),
restoring loop 070 to its original sealed bytes. All 207 seals then matched.
That documented coordinator correction is distinct from this worker's additions.

Workspace credits interrupted the work after 24 new JSON files existed. The same
loop resumed without a new counter, retained those artifacts and the original
audit results, and inspected the coordinator's interruption note. Final
[resumption verification](../../../assets-src/audio/auditions/metadata-followup/resumption-verification.json)
rechecks their files and original seals. The
[follow-up checksum manifest](../../../assets-src/audio/auditions/metadata-followup/sha256-manifest.json)
seals this follow-up's files, report and loop note; it does not replace the original
T065 seal or the approved packet seal.

## Remaining boundaries

The current accepted voice check selects the first per-asset TTS evidence record
instead of the manifest's declared production event. Preserved historical evidence
can therefore shadow this supplemental binding. The separate loop 076/T061 work
must resolve declared-event association and contradictory duplicate evidence before
any accepted-mode promotion. This report does not certify that fix.

Six selected voice lines still lack current dialogue entities/runtime `usedBy`
bindings, as their exported statuses already disclose. Browser comparison,
budget and all other acceptance requirements remain applicable. A format label
and exact provenance record do not complete those checks or the media quotas.

The existing [rights notice](../../../assets-src/audio/auditions/rights/NOTICE.md)
remains controlling: model training statements are publisher representations;
individual speaker-consent evidence and exclusive copyright are not established
by these records. No new rights review, output-ownership claim or bulk-production
selection was made. The original run's pending selection/listening wording remains
historical. Later actual owner listening approval for the unchanged twelve clips
on built-in Mac speakers and earbuds remains valid and was not requested again.
G0 and representative-room/episode gates remain separately tracked.
