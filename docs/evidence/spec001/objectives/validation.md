# T074 objective evidence and diagnostic boundary

2026-11-26, loop085. Local deterministic implementation and controller tests;
no whole-route browser, human learning, provider, media or aggregate gate claim.

## Implemented behavior

`src/state/objectives.ts` resolves immutable objective/profile definitions from
the real validated content registry. A trusted room adapter supplies the actual
current selected alternative and raw physical facts from `GameState`. It cannot
supply a verdict, effects, a replacement measurement or an evaluator callback.
The objective module invokes the accepted copper, optics, radio, power,
capabilities and toy-symbol evaluators. Profiles come from the registry, including
the optical `{id, parameters}` projection. Extra nested `kind`/`profile` overrides
are author errors rather than silently discarded metadata.

O03–O10 have bounded scenario variants that require all their scoped predicates:
passive copper path; historical open/current intact comparison and repeater role;
inspected optical preparation; optical receive/reserve and inspection; radio
path/settings; fresh radio path/SNR; compatible delivered-power allocation plus
an actually common selected mode; and sampled-symbol decoding, common mode and
physical-role distinction. Every authored valid ordinary alternative remains
eligible under the same rules. Optional allies are not prerequisites. Existing
O01/O02 tutorial completion stays with its original adapter.

Source validation precedes missing or stale learner input. A stale captured
action is `invalid-input`; submitting an old measurement from a current action is
`incorrect` stale evidence with no effects or penalty. Measurements retain their
original configuration revision, attempt, room, rule, objective/profile/prop
subjects, readings and conclusion. Submission uses an explicitly captured existing
UUID; it never measures, refreshes or substitutes a newer reading. Current
physical recalculation must match the submitted record exactly, and explicit
`stale`, revision and attempt checks each independently prevent validation.
A changed channel alone cannot prove a fresh SNR.

Historical copper comparison uses the exported pure
`isHistoricalCopperBaseline(registry, game, measurement)` predicate. It accepts a
real recorded stale open baseline and rejects missing/wrong provenance, invented
conclusions, incomplete readings and future revisions. The room resolver must
select using this same predicate so an invalid earlier row cannot hide a later
valid baseline. No prose/fact flag manufactures the before measurement. Missing
baseline is an unmet evidence condition; an unchosen repeater claim is missing
input. R03's reversible original-bench path in T075 supports recovery after an
early repair selection. Proposed solution identity does not alter the measured
current path, and the panel labels it as a proposal.

Only the reducer applies the canonical objective-plus-alternative effect batch
using its existing once-only receipt. Measurement and hint finalization occur in
the same atomic reducer transaction, then the existing GameplayStore CAS. Failed
binding, exhausted generation, canceled actions, stale captures and interrupted
CAS cannot leave partial observations or progress. No new save keys or receipt
ledger were added.

Hints reveal method, worked step and solution in that order. The existing
`assistance` journal records objective, hint, level and attempt separately from
completion. Repeated final hints do not duplicate history. Hints remain readable
after travel; actual Retry/E03 rewind tests retain assistance, facts, personal
notes and visibly stale prior measurements. Assistance never changes a valid
solution into an incorrect result. No implicit save is issued.

`src/ui/diagnostics.ts` registers three closed semantic intents and projects
recorded measurements and hints. Its reusable semantic dialog is mounted in the
application's contextual overlay host inside the adventure frame. It provides
native buttons, text, ordered reading history, current/stale labels, Escape and
focus return; it creates no timer, animation dependency or controls below the
frame. It is not yet mounted in the application. The scoped correction below verifies
its actual Firefox DOM and keyboard lifecycle in isolation. Whole-room visual,
keyboard and accessibility acceptance remains with the actual room integration.

O11/O12 deliberately return `objective-lifecycle-unavailable`. T077 must add the
first route's reviewed intervention and fresh final validation before T078;
T084/T086 retain their later checkpoint and complete ending responsibilities.
This module does not create a circular requirement to finish T084 before T077.

## Stable integration API

- `ObjectiveScenarioResolver(game, objectiveId)` returns one discriminated raw
  scenario or `null` when the current room/selection cannot supply it. It must
  read actual canonical world flags/answers, not choose a passing default.
- `objectiveEffectBindings(registry)` supplies canonical O03–O10 receipts; compose
  these with the existing room/dialogue bindings.
- `createReducer({registry, bindings, objectiveScenario: resolver})` accepts
  `{kind:'objective', operation}`. Operations are
  `{kind:'measure', objectiveId, alternativeId, id}`,
  `{kind:'submit', objectiveId, alternativeId, measurementId}` and
  `{kind:'hint', objectiveId}`. Only measurement allocates a new UUID.
- `evaluateObjective(registry, resolver, game, objectiveId, action)` is pure;
  `prepareObjectiveChange` is the reducer's prepare/finalize bridge.
- `createDiagnosticsController({registry, store, bus, resolveScenario})` uses the
  same resolver as the reducer. `project(objectiveId)` returns an immutable view
  and captured action scope. Pair `invalidate()` with bus invalidation on restore,
  logout and new adventure. `dispose()` releases registrations.
- UI intents are `measure-objective`, `submit-objective` with an existing UUID,
  and `request-objective-hint`. No renderer result/effect field is accepted.

The exact exported scenario types are in the source. T075 owns actual copper
world actions and resolver; T076 owns equipment/Clockworks actions and resolver.
Runtime world loading, application composition and real complete routes remain
separate from these tested adapters.

## Executed verification

All commands used pinned Node26.13.1/npm11.20.0 via
`.runtime/node-v26.13.1-darwin-arm64/bin` and Vitest5.1.2 with one worker.

1. The first objective suite was RED because the module was absent (zero tests
   collected). After implementation, 15 tests passed. Initial typecheck exposed
   one unused parameter and three closure narrowing errors; corrected typecheck
   passed without diagnostics.
2. Additional source/provenance tests gave **33 PASS/13 FAIL**: twelve nested
   model/profile overrides and one future historical revision. Corrected explicit
   validation then passed all **46** tests. The failure evidence is retained here.
3. The first diagnostic controller suite passed **11** cases. A concurrent-tree
   typecheck later reported T075's intentionally absent `copper-scenario` module
   plus five mutable test-cast errors in this task. This task's casts were fixed;
   root owns the final stable-batch typecheck rather than repeated checks against
   concurrent authoring. No final whole-tree typecheck is claimed here.
4. State/controller extensions passed **69** tests. Added actual save-v1 schema
   compatibility for measurements/hints across all eight supported objectives.
   The first nine-suite run passed **189**, failing only because the new test's
   Ajv setup omitted `allowUnionTypes` required by the existing flags schema.
   Corrected the test setup; the schema and data were unchanged.
5. Pre-panel-correction nine-suite regression: **190 PASS**, **9 suites**, **18.67 s**:
   objectives59, diagnostics11, reducer38, state notebook24, UI notebook10,
   tutorial7, state introduction4, action bus26, content introduction11.
6. After exporting the identical strict copper-baseline helper for T075, its nine
   actual before/after cases passed again (**9 PASS/50 filtered**, 2.42 s).

The nine-suite command was:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/state/objectives.test.ts tests/ui/diagnostics.test.ts tests/state/reducer.test.ts tests/state/notebook.test.ts tests/state/tutorial.test.ts tests/state/introduction.test.ts tests/ui/action-bus.test.ts tests/ui/notebook.test.ts tests/content/introduction.test.ts --maxWorkers=1
```

The independent T006 source register, T014 physical oracle, T068 repair-route
oracle, T069 profiles/objectives and save/content schemas were not changed.
Their SHA-256 values and owned implementation/test files are in
[source-seal.json](source-seal.json). Structural test fixtures load full T069
collections through the real registry without editing the live world selection.
No fixture expectation was regenerated from implementation output.

## Scoped panel correction after root review

Root identified that a lifetime event controller kept detached buttons callable
until disposal, hidden/closed panels could retain callbacks at the same world
version, and numeric button-index focus restoration moved focus when a reading
inserted a button. Root also identified a stale radio reason-code mapping.

The correction uses a separate AbortController for each rendered projection,
retiring it on replacement, hide, close and disposal. Every button also checks its
active projection, visible/open/connected panel, connected membership and enabled
state. Close retires synchronously before invoking the owner callback, so an old
control cannot close a newly opened view. Disposed panels cannot be resurrected
by render. Focus follows stable measure, measurement-UUID, hint or close keys;
if that control disappears or becomes disabled, focus falls back to the heading.
Unchanged projections retain their controls and captured scope together. Radio
feedback now handles the evaluator's actual `snr-below-profile` reason.

A reproducible standalone script loads the actual diagnostics module into an
isolated loopback Vite server on an ephemeral port and drives actual headless
Playwright Firefox159 DOM. It does not load the application, authentication or
save services, modify the main Playwright config, use4173, or disturb owner
Safari windows/previews. Browser and ephemeral server close in a finally block.
This is Firefox evidence, not native Safari evidence.

- [Before correction](panel-red.json): **1 PASS/11 FAIL**, zero page errors. The
  failures reproduce detached/hidden/old-close callbacks, wrong focus after row
  insertion/reordering, repeated keyboard close, disabled synthetic activation,
  disposal resurrection and detached-host activation.
- [After correction](panel-final.json): **12 PASS/0 FAIL**, zero page errors.
  Checks include actual keyboard Enter/Escape and focus return; stable hint,
  close and measurement identity; unchanged-projection behavior; and retirement
  across replacement, close, hide, disposal and host detachment.
- The revised controller suite separately passes **12 tests**, including actual
  13dB radio failure feedback. The original **190-test** nine-suite result above
  remains historical evidence; no repeated global suite or typecheck was run.
  Root owns the final stable-batch typecheck.

Reproduce the isolated DOM test with:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node tests/ui/diagnostics-panel.browser.mjs docs/evidence/spec001/objectives/panel-final.json
```

The [prior source seal](source-seal-before-panel-correction.json) preserves the
pre-correction files and original190-test evidence. The current seal includes the
corrected source, updated controller test, standalone script and both DOM reports.
No new application/frame ownership or persistence operation was introduced.

No Git staging/commit/push, production OAuth, provider login, browser build,
release package, deployment, task checkbox or shared tracking was performed by
this worker. Root owns final review, joined typecheck and acceptance. Local
passing checks do not certify the finished episode or waive source/media/human
and owner reviews.

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
