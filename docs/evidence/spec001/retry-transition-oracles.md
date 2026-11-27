# T083 independent retry and Restore Save transition oracles

Date: 2026-11-26. Worker: `/root/loop092_t083`. Scope: C9/C10/C12,
FR-010/013, AC07 and SAVE06/07/09/13.

The [45 semantic transition cases](../../../tests/fixtures/retry-transitions.json)
have **88 passing fixture-integrity checks and 45 explicit runtime TODOs** in
[retry.test.ts](../../../tests/state/retry.test.ts). This is oracle authoring,
not encounter, recovery UI, save, browser or episode acceptance. Root owns task
acceptance and the dependency join.

## Contract and independence

Authority is the [constitution](../../../.specify/memory/constitution.md),
[SPEC retry/one-save rules](../../../SPEC.md), [PLAN](../../../PLAN.md),
[US6 and FR-010](../../../specs/001-physical-layer-underworld/spec.md),
[retry data model](../../../specs/001-physical-layer-underworld/data-model.md),
[gameplay contract](../../../specs/001-physical-layer-underworld/contracts/gameplay.md)
and [unchanged save schema](../../../specs/001-physical-layer-underworld/contracts/save.schema.json).
The accepted [T048 snapshot contract](../../implementation/loops/055-T048.md)
supplies exact dirty-generation bounds and invalidation of pending operations
when replacing a runtime. The accepted [T018 capture-scope contract](../../implementation/loops/026-T018.md)
requires old UI captures to stay invalid even after a same-version restore.

Every expected result was assigned from those contracts. The audit imports only
Node filesystem/hashing and Vitest; it does not import gameplay implementation,
run a local rollback simulator, return fixture expectations from a mock, or
calculate expectations from the reducer. Existing types and the accepted reducer
primitive were inspected only to understand the actual fields and dependency
boundary. The original source, physical, repair-route and T082 outcome fixtures
remain byte-for-byte unchanged and are checked by frozen SHA-256 values.

T082 already defines classification, failure presentation and basic recovery.
Every T083 case links one or more of its existing case IDs, with an explicit
transition-specific reason. T083 does not duplicate the 81-case outcome truth
table or assert a different ending result. Shared bodies in this fixture are
literal expected data, not production objects or a new schema.

## Coverage

| Group | Cases | Distinction made executable for the future adapter |
| --- | ---: | --- |
| Coherent rollback | 5 | Failure/E03 preparation replacement, detached checkpoint, retained facts without objective completion, canceled recovery |
| Freshness | 6 | All old readings remain visible and stale, historical/readout revision floors, matching revision with wrong attempt, explicit stale flag, genuinely new measurement |
| Repeated retry | 1 | Six-step sequence with three retries, two fresh consumption/reward operations and a replay |
| Captured work | 4 | Old gameplay receipt, new delivery ID with old attempt, delayed readout callback, old UI capture after same-version Restore |
| Rejection | 7 | Current/reused readout/hint/outcome attempts, absent/cross-adventure/unsafe preparation |
| Atomicity | 3 | Pending transition, interruption before installation, whole-state observer boundary |
| Generation bounds | 3 | Revision exhaustion, dirty-generation exhaustion, last legal revision |
| Restore Save | 6 | Entire snapshot replacement, cancel, fetch failure, invalid snapshot, waiting response, rebuilding a checkpoint on encounter entry |
| Persistence | 10 | Guest retry/restore distinction, later manual/opt-in save, opt-out, unsafe queued save, conflict, earlier acknowledgement, both logout choices |

All 13 reversible world fields are explicit: room, safe position, flags,
objectives, quests, achievements, dialogue receipts, inventory, recruits and their
progress, party, compendium, route and safe-Continue outcome. The preparation and
attempt bodies differ in every field except their null Continue outcome. Two
consumable inputs become one product and one reward during the attempt. Rollback
returns exactly two inputs and removes both product and reward together with the
attempt's one-time receipts; the earlier reward and earlier receipt survive.
Reapplication consumes again before awarding once, so three retry cycles cannot
accumulate consumables or rewards.

The retained journals explicitly preserve new facts, Unicode personal notes,
changed and newly added hypotheses, map discoveries, all three hint levels and
outcome event provenance/caveats. Failure history contains an **earlier** E03;
the E03 Continue vectors separately contain the **current** shutdown event.
Later safe-save vectors use that E03-specific journal. No failure is mislabeled
as an E03 event, and retained facts do not silently recomplete O11/O12.

Four readouts remain individually visible: preparation, current attempt, an
older stale readout and a higher-revision stale readout. Their IDs, original
attempts, numeric revisions, readings and conclusions stay unchanged. All are
explicitly stale after rollback. Freshness assertions require both attempt and
revision matching plus `stale: false`; they never update old evidence to the new
generation. New revision assertions use a strict lower bound because a correct
allocator may skip numbers; only the last legal boundary forces one exact value.

The rejection/atomicity cases are bounded by existing contracts:

- Checkpoints are adventure-scoped preparation copies and safe positions must be
  authored. Missing or cross-adventure checkpoints cannot be invented or merged.
- Interrupted transitions cannot be saved, and rollback must restore its world
  together. The observer vector forbids either mixed world/journal pair. It does
  not prescribe an asynchronous production architecture; a synchronous reducer
  can satisfy the same all-or-nothing boundary.
- Configuration revision has schema maximum `2147483647`; no larger legal value
  exists at exhaustion. Dirty generation uses exact safe integers under T048.
  Neither failure may reserve an attempt ID, partially install a candidate or wrap.
- Fresh attempt identity is checked independently against a readout, hint and
  outcome reference; a test that supplies all three at once could miss one source.

## Restore, save receipts and integration boundary

Restore replaces the world **and** journal from one validated/migrated snapshot,
after the discard warning. It does not merge unsaved facts, notes, hypotheses,
discoveries, hints or outcomes. Canceled/failed/pending reads preserve the current
adventure. Its old checkpoint is cleared; entering preparation later reconstructs
one from the restored adventure. Saved versions may be numerically older than the
discarded runtime, so captured UI context must be invalidated independently of
version equality.

Retry/E03 Continue are memory operations with zero implicit save writes and no
second slot. A separately dispatched ordinary safe manual or opted-in autosave
may later persist preparation plus retained learning and E03 history. That payload
contains neither checkpoint nor shutdown world. Opt-out, conflict and unsafe
queued operations still preserve the confirmed slot and honest unsaved status.
Canceled logout preserves all memory/session state; confirmed server logout
cancels queued writes, clears adventure/checkpoint/notebook and returns to title
without implicitly saving retained learning.

Gameplay action receipts and durable save receipts have different contracts.
Old captured gameplay commands are rejected after retry. An exact retained save
receipt still acknowledges its earlier write, including when another device has
advanced the slot; it cannot mark the newer dirty retry generation saved. T083
preserves receipt-first semantics rather than treating all old receipts as invalid.

`src/state/encounter.ts` and `src/ui/recovery.ts` were absent at verification.
The current reducer's rewind primitive is not the T084 checkpoint lifecycle and
does not establish T088 UI behavior. T079–T081/T086 must supply genuine full-world
preparation/item/reward/companion/safe-position bindings; semantic fixture labels
must not be registered as production content. T084/T088/T089 adapters must invoke
real capture, mutation, cancellation and persistence interfaces and compare their
results with these literal vectors. Preserve the 45 TODOs until that execution
exists. Browser, autosave/logout races, provider/owner acceptance and aggregate
gates remain separate obligations.

## Actual verification

Pinned Node runtime `.runtime/node-v26.13.1-darwin-arm64/bin` was first in PATH:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/state/retry.test.ts --maxWorkers=1
```

| Local tool start | Actual result | Scope |
| --- | --- | --- |
| 19:53:29 | Exit 0; 82 PASS / 43 TODO; 102 ms | Initial fixture audit |
| 19:54:47 | Exit 0; 83 PASS / 43 TODO; 97 ms | Separate failure/current-E03 journals and preserved readout provenance |
| 19:55:34 | Exit 0; 88 PASS / 45 TODO; 95 ms | Isolated hint-only and outcome-only attempt reuse |

There was no test failure in these runs and no claimed application RED→GREEN.
The actual missing-implementation evidence is the two absent module paths; no
stub or intentionally broken assertion was introduced to manufacture a RED.
Runtime checks remain TODO. The focused strict TypeScript check inherited every
repository compiler option through a temporary `.local/t083-typecheck-*.json`
containing `{"extends":"../tsconfig.json","include":["../tests/state/retry.test.ts"]}`.
Pinned `node node_modules/typescript/bin/tsc --project` exited 0 with no diagnostics;
the temporary file was removed. No broad build/typecheck, browser, host/provider,
credential, Git publication or deployment work was performed.

| Artifact | SHA-256 |
| --- | --- |
| `tests/fixtures/retry-transitions.json` | `8be2657298b75106b6a55e51e74364e5446c376a85939297e43d91fdd47a6bee` |
| `tests/state/retry.test.ts` | `bd0a6b530675ee00d8217411b02eb0749f768e22c7ed645025e0482046493d51` |
| Protected `tests/fixtures/outcomes.json` | `1d9c734a783211bb4e02ecf43aa1c196d8cc5c05466f32da757730896ada0ad7` |

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
