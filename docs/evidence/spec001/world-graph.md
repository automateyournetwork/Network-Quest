# T081 — authored world graph and application join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Status on 2026-11-26: the twelve-room application/world/save integration is
implemented and its 40 independent graph tests and two complete native branch
journeys pass. Final stable-suite evidence and file seals appear below. T081 is
ready for coordinator review; no aggregate gate, finished media, real-provider,
human learning or release acceptance is inferred.

The expectations in `tests/content/world-graph.test.ts` are transcribed from
SPEC.md “Walk graph and unlocks” and “Objectives and branching quest contract”.
The test harness uses the actual application content loader, action bus, verb
controller, navigation planner and reducer. Its prepared objective receipts
isolate walk permissions; they do not substitute for earned learning progress or
the separate branch gameplay checks.

| Contract | Independent expectation |
| --- | --- |
| Exact connected graph | Fourteen bidirectional pairs: R01–R02, R02–R03/R05/R07/R09/R10, R03–R04, R05–R06, R07–R08, R04/R06/R08/R10–R11, R11–R12 |
| Introduction | R01↔R02 does not require O01; guest travel preserves memory without creating a save |
| Branch/shared access | O02 opens the three branch entrances and R09/R10; the foundational-to-applied room walk is ungated |
| Rift inspection | Any of O04/O06/O08 plus O10; O09 is not a walk prerequisite |
| Intervention | Selected branch plus both O09 and O10; the actual repair evaluator rejects review without equipment |
| Balcony | O11 opens R12; arrival alone awards neither O12 nor restored service |
| Return/preparation | Real Walk commands return through the selected branch, workshop, ordinary kit, market and Clockworks |
| Optional exploration | Unvisited branches remain explorable after completed copper progress; walking awards no branch objective or quest |
| Future boundary | Iron City remains labeled future, absent from exits, untraversable and unnecessary |
| Actual authored rooms | Every room must have a selected record, matching allocation identities, explicit clear-floor safe anchor and exact exits |

The Rift truth table contains 32 combinations of O04/O06/O08/O09/O10 at each
of four approaches. Expected permission is computed independently as
`(any branch proof) AND Clockworks`, not read from the production prerequisite.
The RED run stops individual tests at their first failing assertion; it does not
claim all 128 combinations completed before the missing rooms are joined.

## Preparation results

Pinned Node26.13.1 and Vitest5.1.2 executed the suite. The first run produced
24 PASS / 16 FAIL. Review then corrected TypeScript narrowing, the schema's
`futureDoorId` field, and the actual-room assertion: `registry.has('room', id)`
also recognizes metadata reservations and therefore cannot prove a room was
authored. The final preparation run requires `registry.record(id)?.kind ===
'room'` and produced **23 PASS / 17 FAIL / 0 skipped** across40 tests.

The17 final failures are expected missing integration evidence: two canonical
selection assertions, four missing authored application room records, two new
branch entrances, two branch exploration paths, two new Rift approaches, two
independent branch journeys, two preparation-return journeys and the optional
post-completion exploration journey. The existing14 walk pairs and tested copper,
market, Clockworks, Rift/balcony and future-boundary behavior pass locally.

Command:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node node_modules/vitest/vitest.mjs run tests/content/world-graph.test.ts --reporter=json --outputFile=/tmp/network-quest-T081-preparation-red.json
```

The temporary JSON report is local output, not a public artifact. Its aggregate
counts were read back. Preparation test SHA-256:
`a905538b755bc46000983d7860118ba5cdccf3ee16ee1f068fa2b990a4e48073`.

## Ordered integration design — approved and executed after branch review

The explicit T079–T081 ordering required reviewed branches before this join.
The coordinator approved this scope in principle, held shared mutation during
preparation, then issued full GO after T079/T080 source, tests and seals passed.

1. Keep the canonical14 edges, allocations and reviewed objectives/profiles.
   Replace the historical two-room document selection with all12 actual authored
   rooms and the complete accepted action/definition collections. Have the
   application validate this exact selection rather than replacing it silently.
2. Export an explicit production entry factory that selects only validated
   authored safe anchors. Use it in the application and this suite. Keep
   R11.preparation safe-preparation and other established arrival activities.
3. Join the fiber/radio scenario and action adapters to O05–O08 diagnostics and
   real hotspot controls. Add readable notebook records and four honest temporary
   graybox layouts within the existing contained adventure frame. R01 keeps its
   actual media; no asset inventory or acceptance counts change.
4. Extend the exact save-policy reading/conclusion allowlists for optics/radio
   and corresponding repair records. Regenerate with updated provenance and
   match the PHP loader's exact scope. Admit all12 real anchors; preserve unknown
   and unavailable anchor rejection. No save-v1 schema change.
5. Keep historical two-room test fixtures explicitly scoped. Earlier authoring
   projections must replace a newly canonical path before appending its records;
   correct only observed duplicate-selection regressions. Do not weaken frozen
   physical, outcome, retry or companion expectations.
6. Run the scoped graph/adapter/policy joins, then coordinate the complete checks,
   build and native browser verification. Keep separate media, human, provider,
   host, packaging and episode acceptance evidence pending.

## Preparation boundary — historical

No new room is made playable by this preparation. The initial independent entry
list remains a test fixture until the production factory is authorized. No
T084 encounter module, canonical world, application binding, save policy,
teaching source, profile, objective, manifest, tracking file, Git operation or
deployment was changed by preparation.

## Narrow prerequisite correction — conditional diagnostic proof state

Before the canonical/application join, the authored fiber controls exposed a
separate structural-proof bound failure. Their connection-stage flag is read by
other diagnostic choices, so the previous projection retained every setter
receipt and exceeded the unchanged4096-state budget on all three routes.

The coordinator authorized only `src/content/registry.ts`'s proof projection and
owned independent tests in `tests/content/registry.test.ts`. Five new cases were
run by the coordinator against the original projection: **5 FAIL** from
graph-bounds (60 other tests excluded). The preserved coordinator log is
`docs/evidence/spec001/registry-proof-join/conditional-red.log`.

The correction finds single-node terminal action collections, conservatively
excluding character-referenced conversations. Flags read anywhere outside those
collections remain structural. A monotone backward dependency closure retains
entry and choice conditions whenever their atomic effects grant/consume items,
affect other structural state or write an already relevant flag. Two-hop
flag-to-flag-to-goal dependencies therefore remain concrete. Only closed
diagnostic flag components and fact receipts are omitted from the memo key.

The search bound, effect execution, objective transitions, inventory, recovery,
real dialogue sequencing and exhaustive loss-state checking are unchanged. The
proof does not stop on the first successful ending.

The worker ran the five new tests: **5 PASS**, with60 excluded by the focused
filter. The next complete registry/fiber join produced **101 PASS / 1 FAIL**:
all65 registry tests and14 fiber room tests passed;22 of23 fiber adapter tests
passed. The remaining corruption test adds a direct objective award to a
conditional diagnostic action. That is correctly structural and exceeded the
budget; its fixture had assumed semantic validation must first succeed before
the adapter rejects corruption. The failure was reported to its owner without
editing the test or weakening the guard.

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node node_modules/vitest/vitest.mjs run tests/content/registry.test.ts -t 'projects closed conditional|retains both levels|does not combine an overwritten|retains a flag used only|keeps conditional continuation'
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node node_modules/vitest/vitest.mjs run tests/content/registry.test.ts tests/content/fiber-rooms.test.ts tests/state/fiber-scenario.test.ts
```

At this prerequisite checkpoint, canonical world, application, save-policy and
notebook/presentation integration remained held until the separate branch review GO.

After the T079 owner retained guarded direct-award corruption as a semantic
rejection and added a separate unconditionally reachable direct-award corruption
to prove adapter rejection, the same complete registry/fiber command was rerun
at20:35:25: **103 PASS / 0 FAIL / 0 skipped**, three files,5.74s. This supersedes
the intermediate101/1 result while preserving it above. The registry source is
sealed at `bd8a5b2988b48f88b9c1cebb41540db33a95be9b2e3d86d93c43a0050b604c17`.


## Final authorized join and verification

The final production loader validates the canonical selection of 50 authored
records, including all twelve rooms. `episodeNavigationEntries` selects actual
validated room records and their safe anchors, preserving R11 preparation.
Fiber/radio hotspots dispatch the reviewed action adapters; their captured
contexts and domain resolvers retain verdict authority. The exact notebook,
temporary room geometry and save allowlists now cover O05–O08 and the matching
repair measurements. The PHP loader requires the exact generated scope
`authored-spec001-twelve-room-gameplay`; unknown rooms and unavailable anchors
still fail in both validators. Source provenance includes S09 and optical T04/T15.

Observed fixture failures were corrected narrowly: the original introduction
fixture and repair-definition projection explicitly select their historical
records; equipment fixtures replace newly canonical paths before appending;
notebook/graybox membership expects the newly authored rooms; persistence
negatives use R99 and an unavailable R05 anchor. Independent physical, retry,
outcome and companion expectations were not changed. One real notebook defect,
O07 path evidence classified as context instead of observation, was corrected.

The approved R06 exit-label correction names The Backhoe Rift. Replacing only
that new label with the old label reproduces the T079 sealed R06 bytes and hash
`9efa2ba3d84df7bb657107275f7bfc2b627870cabf6f16dc796d3bf7d1506a0f`.
T079's historical seal is preserved. The final UTF-8-preserving serialization is
semantically identical to the built/browser-tested JSON; generated provenance
was refreshed and the full check passed afterward.

| Executed check | Actual result |
| --- | --- |
| First affected nine-suite join | 197 PASS / 15 FAIL, plus two duplicate-selection collection errors |
| Second affected join | 234 PASS / 3 FAIL; all three exposed the O07 notebook kind error; corrected notebook suite then 3 PASS |
| First broad client run | 2792 PASS / 3 FAIL / 360 TODO, plus active T086 missing-module collection error; two repair-definition fixture assumptions and one six-room graybox assumption corrected |
| Narrow corrected fixture suites | 16 PASS |
| Final graph suite with production entry factory | 40 PASS; actual Walk execution and independent unlock expectations |
| Final stable client selection | 2765 PASS / 0 FAIL / 360 TODO / 0 skipped, 73 files; active T085/T086 suites excluded by coordinator instruction |
| Full `npm run check` after parallel source stabilized | PASS, exit 0; global TypeScript, 12 identities / 50 records / three routes, generated policy freshness |
| Full `npm run build` | PASS; 106 modules; `index-RmU1l_ft.js`, 2302.14 kB / gzip 520.62 kB; existing large-chunk warning retained |
| First native two-journey run | 2 FAIL: test used a straight apostrophe instead of authored Titan’s, and omitted reacknowledgement after radio maintenance review reset |
| Corrected native run | 2 PASS, 31.1 seconds |
| Final native run after approved R06 label fix | 2 PASS, 30.1 seconds; actual PHP save/read and reload/Continue |

During concurrent implementation, global checks also observed missing/renamed
T085 exports; these transient failures were reported, not treated as T081
acceptance. The final global check succeeded after those exports stabilized.
The stable client selection excludes only `tests/ui/encounter.test.ts` and
`tests/state/outcome-classification.test.ts`, which their owners were actively
writing. It retains the existing encounter suite. The 360 existing TODO tests
remain unexecuted; this is not a whole-episode test acceptance claim.

Commands used the pinned runtime and local PHP:

```sh
export PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH"
export NQ_PHP_BIN=/opt/homebrew/opt/php@8.4/bin/php
node node_modules/vitest/vitest.mjs run tests/content/world-graph.test.ts
node node_modules/vitest/vitest.mjs run --exclude tests/ui/encounter.test.ts --exclude tests/state/outcome-classification.test.ts --reporter=json --outputFile=/tmp/network-quest-T081-final-stable-client.json
npm run check
npm run build
node node_modules/@playwright/test/cli.js test tests/e2e/independent-repair-routes.spec.ts --project=firefox-local-https --workers=1
```

Both native journeys begin with New Adventure and use only actual controls. The
fiber route proves inspection before replacement, required reinspection, stale
path-A proof after choosing path B, and the 9 dB path's −12 dBm receive power /
2 dB reserve. The radio route separates viable-path O07 from SNR O08, observes
13 dB failure, mitigates to 25 dB, then changes channel and requires fresh 20 dB
proof. Both earn O09/O10 normally and reach R12 through O11. Fiber is permanent;
radio is temporary and requires its maintenance plan and acknowledged warning.
Link-only validation remains incomplete until the separate endpoint check.

Each journey makes exactly one manual PUT to the real local PHP service, verifies
its slot, reloads and continues with exact new readings preserved. Only identity
is synthetic; no progress, evaluator result or objective receipt is injected.
Completed objectives contain only the selected branch and shared path. There
are no invented recruits, rewards, other-branch mastery or provider claims.

Durable artifacts are in `docs/evidence/spec001/world-graph/`: the final native
log, stable-client summary, extracted actual regression failures, four final
screenshots, and both first-run browser failure screenshots/contexts. The final
screenshots were visually inspected for the contained 1280×900 scene and readable
current/stale evidence and classification. This does not accept finished media,
all viewport/accessibility cases, human learning, or the full endings matrix.
`seals.json` lists final owned source/test/document/artifact hashes; its dependency
section identifies the coordinator-owned registry tests without claiming ownership.

The runtime source is frozen for coordinator acceptance. R01's real media is
preserved; the remaining rooms retain honest temporary geometry with zero new
media quota. T084/T085/T086 joins, broader ending variants, optional recruitment,
finished media, human review, provider/host/release acceptance remain separate.
No task/gate tracking, asset manifest, teaching source/profile/objective,
save-v1 schema, credentials, Git operation or deployment was changed by T081.
