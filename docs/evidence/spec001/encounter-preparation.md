# T085 encounter preparation — isolated implementation

Date: 2026-11-26 (America/Toronto). Worker: `/root/loop098_t085`.
Scope: C9/C12, FR-009/010, NQ-08, AC07/12 and the explicit T085 preparation
exception. **57 focused checks PASS; earlier joined 210 PASS / 45 existing TODO;
16 isolated native Firefox DOM cases PASS.** These are isolated evidence, not
T085 acceptance, actual application composition, T089 recovery acceptance or G4.
T081/T084 review and root-authorized shared lifecycle integration remain pending.

## Implemented and reviewed boundaries

[UI adapter](../../../src/ui/encounter.ts) supplies two independent pieces:

- `createEncounterExecutionPlan({registry,store,action,before,message})` accepts
  only captured execution intent with explicit acknowledgement and matching
  adventure/attempt/revision. It prepares T084's opaque checkpoint and commits
  that checkpoint to a private local cell. The canonical T077 reducer executes
  against the staged state. Only a real O11/executed transition can reach the
  single real application compare-and-set, which also installs
  `active-encounter`. No observer can see a checkpoint-only or transiently safe
  committed state. Preparing/discarding a plan, canceled delivery, stale proof,
  failed validation, or failed final CAS leaves the original state unchanged.
- `createEncounterPreparationControls(host,options)` creates one fragment for
  the existing repair dialog. It replaces the existing warning/acknowledgement/
  execute block when integrated; it is not a second menu or dialog. Native
  checkbox and buttons expose untimed decisions, conventional-tool validity
  without an ally, permanent/temporary/isolation consequences, and an explicit
  Return to preparation control. Return closes the decision UI without a
  gameplay dispatch, checkpoint capture, rollback or save. Abort, stale owner
  scope, hidden/inert/detached DOM and retired controls are inert. A new review
  must construct a new fragment and acknowledgement.

The successful execution notice explains that validation is at the Iron
Threshold, other exits remain temporarily closed, the notebook remains
available, and saving is paused. The corresponding live navigation/notebook
hooks are still pending and this isolated notice is not claimed as working
application behavior.

[Shared domain policy](../../../src/state/rift-encounter.ts), explicitly
authorized by root as a disjoint additional source file, exports:

```ts
riftPreparationBoundary(world: WorldState): boolean
isActiveRiftEncounter(state: ReducerState): boolean
allowRiftEncounterInput(state: ReducerState, input: ReducerInput): boolean
isRiftValidationContext(state: ReducerState): boolean
```

Preparation requires exact `R11.preparation`, no Continue outcome, no own
executed/classification marker and incomplete O11. T084 separately verifies
actual activity and the authored registry anchor. Raw T077 execution can leave
the activity labelled safe-preparation; the predicate still rejects it.

The active predicate binds exact R11 preparation or R12 entry to its matching
same-adventure/attempt checkpoint with an earlier revision. That checkpoint
must pass the preparation predicate. Current O11 and execution fact/plan are
required; O12, classification and Continue outcome must remain absent. Selected
plan/duration must match the checkpoint, and the route must match the executed
plan (isolation has no media route). Pending transitions, missing/cross-run
checkpoints, other rooms/anchors, unknown plans and completed phases fail closed.

The closed input policy permits actual `notes` mutations at those anchors,
hint-only requests for exact authored `spec001:O01` through `spec001:O12`, and,
only at R12, `measure-link`, `test-endpoint`, `classify`, and the exact authored
`ACTION-repair-read-classification` choice. It grants no result/effect and does
not bypass the canonical reducer's own validation. Objective measure/submit, plan
edits, review/reexecution, item recovery, arbitrary apply requests and unrelated
notebook mutations are denied. In particular, the existing pin-hypothesis
operation is authored at R02 and is not invented as an R11/R12 operation.
Malformed or throwing policy inputs fail closed. No generic playable/safe-state
gate was expanded.

`allowRiftEncounterAction(state,input)` in the UI module is the matching closed
semantic admission port for later controller composition. It permits selecting
Walk, exact item-free R11→R12 Walk, notebook opening, and its actual
notes/pin-objective/highlight-map/close controls only while that notebook is open.
It admits real hint requests and exact R12 validation controls using the shared
domain policy/context. Evidence is already rendered passively in the notebook;
the unused `inspect-evidence` semantic kind is not invented as an active handler.
Other verbs/exits/panels/plan edits/unknown objectives and completed phases deny.
Default controller behavior remains unchanged until this optional port is wired.

## Verification and retained failures

The independent expectations derive from the existing C9/C12, T077, T082/T083
contracts. Tests use real authored content and actual canonical reducer
execution for copper, fiber and radio, each with no active ally. Expected
checkpoint world is captured independently before execution and compared to the
entire final checkpoint; no expected-result simulator was introduced.

Final scoped command, 2026-11-26 20:49:29 local:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/ui/encounter.test.ts tests/ui/repair-plan.test.ts tests/state/encounter.test.ts tests/state/retry.test.ts --maxWorkers=1
```

**210 PASS / 45 TODO, four suites, 10.75 s.** T085 has54PASS; unchanged T077 UI
has9PASS; T084 has59PASS; T083 audit has88PASS/45TODO. The actual save validator
with current authored policy accepts prepared state and rejects the atomic
active result as `safe-state` at `/activity`. No network save or queued-autosave
integration claim follows from that local validator result.

Root then required available hints/evidence to remain usable. Three tests first
failed at20:53:20 against the notes-only policy/missing UI export. After the
closed additions, final focused `tests/ui/encounter.test.ts` at20:54:37 reports
**57PASS,8.26s**. This actually calls `prepareObjectiveChange` for all12 authored
objectives, four successive requests each: levels1/2/3 then no duplicate, empty
accepted effects, and unchanged world/notebook/outcome references. No objective
reward or speculative expected-answer adapter participates. Shared active
reducer/controller execution is still held; direct canonical hint finalization
does not claim that integration. Final scoped TypeScript remains0.

Scoped strict TypeScript, using a temporary config extending root tsconfig and
including the two sources and unit test, exits0. The temporary `.local` config
was removed. The initial `tsc` command mistakenly looked under the Node runtime
bin; using installed `node_modules/.bin/tsc` with pinned Node fixed command
resolution. No dependencies were installed.

Native command:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node tests/ui/encounter-panel.browser.mjs
```

Final [DOM report](encounter-preparation/panel-dom.json), observed
2026-11-27T01:49:40.828Z: **16 PASS,0FAIL,0pageerrors**, Firefox159.0 at the pinned
`firefox-1572` executable. It uses its own ephemeral loopback Vite listener and
closes its browser/server. It did not use owner previews, root's4173, Safari or
production. Native keyboard Space/Enter, implicit label association, captured
review ID, safe return, stale acknowledgement, reattached retired controls,
missing review, bus invalidation and hidden/inert/detached lifecycle were checked.
The 390px/200%-text case asserts no page/frame horizontal overflow and reachable
Return. The [screenshot](encounter-preparation/panel-200-percent.png) was visually
inspected: wrapped readable text and the controls remain inside the frame; it is
the scrolled lower portion of the isolated dialog, not a full application shot.
This does not resolve root's separate cross-world ARIA browser crash or certify
assistive technology/human review.
The native report seals the earlier54-test source revision; subsequent edits
add only pure hint/UI admission helpers. The tested DOM fragment is unchanged.
Root reserved browsers for097 afterward, so no uncoordinated rerun followed.

Retained failures:

1. Initial missing UI module RED (20:41:35) before implementation.
2. Initial three failures used test-only field `activeParty`; corrected to the
   existing `activeAllyIds` contract. No production behavior was changed for it.
3. Six genuine active-state assertions failed against safe-preparation execution
   (20:43:52); the atomic final result now sets active-encounter. The raw T077
   postexecution safety regression remains as a separate negative.
4. Missing shared policy module RED (20:46:43) before its implementation.
5. [Initial native report](encounter-preparation/panel-initial-failed.json)
   retains7PASS/9FAIL. The test that deliberately reattached retired controls
   left them in the shared fixture host, so later strict locators saw duplicates.
   Reset now clears that host; production guards were not weakened.
6. One validator assertion incorrectly used `reason` instead of the existing
   `code` field. The positive prepared-save assertion already passed. The final
   check requires exact `code:'safe-state',path:'/activity'` after execution.
7. Three later hint/UI admission tests RED before the approved additions, then
   all57 focused tests GREEN. No generic activity permission was introduced.

## Held composition obligations

Root and T086 agreed on active-encounter from successful execution until actual
outcome classification. Proposed integration remains **held**:

- T077 controller execution uses the adapter; its existing warning block is
  replaced by the fragment only at actual precommit preparation. A completed
  R11 view must not offer a misleading Return to preparation. Other existing
  plan/review and R12 validation controls stay in the contained repair panel.
- A narrow trusted reducer option may consult `allowRiftEncounterInput` in the
  current safe-kind check, including only the exact hint operation among
  objective operations. The caller must require exact `true` and catch
  exceptions as denial; absent permission retains existing default denial.
  No generic safe-kind or `playable()` expansion is authorized by this work.
- A narrowly scoped navigation adapter must verify the actual authored
  R11→R12 edge and geometry, then install the destination while preserving
  active-encounter in one CAS. No observable safe intermediate state or broad
  destination-type expansion. Other exits must explain their temporary closure.
- Repair, notebook, diagnostic and verb controllers must expose only the
  accepted active operations through optional trusted admission ports. Notes,
  hints and evidence viewing remain available; mutations use the
  real canonical notebook reducer. Application controls and captured scopes
  must join this policy, not duplicate its predicates.
- T086 owns atomic final evidence/outcome classification, then cutscene for
  E01/E02 or shutdown for E03, with safe-continue only after the corresponding
  owned acknowledgement at the authored R12 entry. T087 owns the separately
  authored fictional failure trigger. T088 owns Retry/E03 Continue/Restore,
  unsaved warnings and retained learning. T089 owns actual full UI/save races.
- Existing bus invalidation remains mandatory on restore/account/new-run;
  UI owner scopes must be retired on close/replacement. Equal-version versions
  alone cannot identify a new account/run. The adapter additionally rejects
  exact-state replacement between preparing and committing its plan.

No shared application, reducer, bus, repair controller, world, manifest, save
policy, task tracking or accepted oracle was edited. No publication, provider,
host, credentials, player-data or deployment operation was performed. Task
acceptance and shared integration remain with root.

## Source and evidence seals

| Artifact | SHA-256 |
| --- | --- |
| `src/ui/encounter.ts` | `173621384bea410dcfbafe606fc47f2fae72db7fa3875b95e6b0db615b8086bc` |
| `src/state/rift-encounter.ts` | `fa2c358831c3827067f49d051b48be13ffc532390c7926d7890245cbb7050e03` |
| `tests/ui/encounter.test.ts` | `b9dd6f7a9cd6d4e01c3e39162dcabc7ed09f23cc1834b1f72d1fdec6e039b8cc` |
| `tests/ui/encounter-panel.browser.mjs` | `0aaa0b7aba307929b3d4ce33e41182254b2112c6c111d756da4f452567f1e18e` |
| `encounter-preparation/panel-dom.json` | `6d5fb271bc8e8bf0a0cbb26ff8ff66df2d383d13bc371bff77f6eb6119b3387b` |
| `encounter-preparation/panel-initial-failed.json` | `e43b4bb2293dfaff6775f61425ee129f85bc914a389e488d6ead00cfeee6cfb4` |
| `encounter-preparation/panel-200-percent.png` | `5882429f7d6f77bc39eda3a914a19d13c21840232b9f9a8bbc681632a0c94324` |
| Protected `src/state/encounter.ts` | `f1d4c7e77c15ed9759564a2c0c2c54cac97708d56d7b71e8de1adb2b2092ba01` |
| Protected `src/state/repair-plan.ts` | `8a88d5f08773b6a4026f78128f49b74a4f89516a89c65c8382ee6d09a04168f6` |
| Protected `src/ui/repair-plan.ts` | `e702523980baa02ef37a96718f81b3df39d8ec84460ba7e5dee585a2a01d5c50` |
| Protected `tests/fixtures/retry-transitions.json` | `8be2657298b75106b6a55e51e74364e5446c376a85939297e43d91fdd47a6bee` |
| Protected `tests/fixtures/outcomes.json` | `1d9c734a783211bb4e02ecf43aa1c196d8cc5c05466f32da757730896ada0ad7` |
