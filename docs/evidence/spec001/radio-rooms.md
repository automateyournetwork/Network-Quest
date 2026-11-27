# T080 Skywell and Storm Observatory

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

2026-11-26, fresh loop096. Local room authoring and shared-controller adapter
verification are ready for coordinator review. This report does not accept T080,
W05/G4, a complete radio ending, media quotas, human teaching quality or release.
The canonical world/application/save-policy join belongs to T081 after both room
pairs are reviewed. No browser, host, provider, Git or deployment action ran here.

## Source contract and scope

Read the governing constitution, AGENTS, SPEC/PLAN, active plan/task sequence,
HANDOFF/state, the implementation skill and accepted T069 definitions. T078/W05's
accepted first copper route permits this disjoint authoring. Prerequisite/checklist
setup already passed; no unchanged setup or external feasibility probes repeated.
The coordinator explicitly approved the closed configuration API and separate
boundary exercise. Shared files and tracking remain untouched.

Technical authority is the accepted [radio evaluation review](radio-evaluation.md),
[rule-source review](rule-source-review.md), frozen T014 physical cases, T068 repair
cases and T069 profiles/objectives. S08 supports separate physical/settings/noise
observations; S09 supports comparable power-ratio arithmetic. Neither source sets
a universal 20 dB wireless threshold. That inclusive value is explicitly fictional.
The pre-edit source seals are in [input-hashes.json](radio-rooms/input-hashes.json);
all seven still match, including the real T072 evaluator and T074 controller.
No oracle, source model, profile or objective was changed.

| Accepted independent input | Room use and independently expected behavior |
| --- | --- |
| RR-O07-ALTERNATIVES | Existing aligned and alternate surveyed paths are equally viable when settings match; no SNR follows from preparation |
| RR-O07-BLOCKED-PATH / B-RADIO-PATH | Unaligned path or explicitly mismatched endpoint settings fails even with nominally favorable power levels |
| T08 / RR-O08-ALTERNATIVES | Surveyed channel A: −65 − (−90) = 25 dB, passes supplied inclusive 20 dB minimum |
| B-RADIO-20 / RR-O08-ALTERNATIVES | Surveyed channel B: −65 − (−85) = 20 dB, equally valid inclusive boundary |
| T09 | Connected local emitter: −65 − (−78) = 13 dB, fails |
| B-RADIO-BELOW / RR-O08-BELOW | Explicit supplied boundary exercise: −65 − (−84.99) = 19.99 dB, fails without rounding to a pass |
| T13 / RR-O08-MITIGATION-NOT-MEASUREMENT | Changing channel/path/settings/emitter conditions retains old readings as stale; only a new explicit measure operation creates current evidence |

The local emitter affects both fictional channel labels in the authored exercise.
Its isolation switch changes the configuration to surveyed conditions; changing a
channel alone leaves it connected. Reconnecting it permits a repeatable failed
observation. The separate boundary exercise supplies alternative observation
conditions and is labeled as such, including that it is not a production-path
measurement. Selecting it cannot create a test result or automatic success.
Returning to surveyed conditions is reversible and still requires measurement.
The A/B names carry no real frequency, regulatory advice or permanent ranking.

## Authored surface and integration API

R07/R08 contain **25 inspectable hotspots**, covering every allocated **20 props
and five characters**. They retain the accepted O07/O08 evidence byte-for-structure,
stable anchors and exact exits R07↔R02/R08 and R08↔R07/R11. Existing world walk gates
are unchanged, including the ungated R07↔R08 exploration edge. No market shortcut
was invented. Ordinary kit recovery through the Workshop/Arrival Lift is visible;
the kit is always obtainable and never consumed. No ally or optional reward is
required. There are no unimplemented Talk, recruit, diary or minigame handlers.
All assets remain explicitly temporary `DEV-` references with no finished-media
bindings or audio; this work adds **zero** accepted media quota.

`radio-actions.json` has narrator menus `DIALOGUE-radio-skywell` and
`DIALOGUE-radio-observatory`: 15 choices, 13 effectful. Every effect is a reviewed
reversible flag or context fact. No action records `FACT-O08-snr`, grants items,
consumes tools, produces measurements or completes objectives.

Public API in `src/state/radio-scenario.ts`:

- `radioEffectBindings(registry)` binds only the 13 expected effects, repeatably.
- `prepareRadioAction(registry, game, actionId)` validates the full closed action
  contract, room, briefing and ordinary tool before returning canonical effects.
- `createRadioScenarioResolver(registry)` returns the existing T074
  `radio-preparation`/`radio-proof` union, with exact accepted alternative IDs.

All IDs below have the `spec001:` prefix.

| Configuration flag | Accepted values | Explicit arrival value |
| --- | --- | --- |
| `FLAG-radio-path` | `unaligned`, `aligned-existing`, `alternate-path` | `unaligned` |
| `FLAG-radio-settings` | `matched`, `mismatched` | `mismatched` |
| `FLAG-radio-channel` | `A`, `B` | `A` |
| `FLAG-radio-conditions` | `raised-noise`, `surveyed`, `near-boundary` | `raised-noise` |

Unknown values, including explicit null from a malformed state, return no scenario. Only absent (undefined) flags select the authored arrival defaults. Channel selection moves both endpoint channel
selectors while preserving the separate matched/mismatched band/PHY condition.
The source supplies explicit path/compatibility facts and comparable dBm inputs;
it never computes propagation or fabricates a saved observation. Scenarios are
returned detached from game state.

Skywell action suffixes after `ACTION-radio-`: `read-path`, `read-settings`,
`align-existing`, `alternate-path`, `unalign-path`, `match-settings`,
`mismatch-settings`, `leave-skywell`. Observatory suffixes: `read-survey`,
`channel-A`, `channel-B`, `mitigate-emitter`, `raise-noise`, `boundary-exercise`,
`leave-observatory`. Leave choices have no effects.

Diagnostic IDs stay `ACTION-O07-align-existing-path`,
`ACTION-O07-choose-alternate-path`, `ACTION-O08-scenario-channel-A` and
`ACTION-O08-scenario-channel-B`. Required inventory is only `ITEM-inspection-kit`.
Context facts are `FACT-O07-path`, `FACT-O07-settings`, `FACT-O08-survey`; the fresh
SNR evidence is exclusively generated by the real T074 measure lifecycle.

## Executed verification

Tests were written before the new rooms, actions and adapter. Their expected
numeric results and failure boundaries came from the frozen independent fixtures,
not from running a new implementation to generate expected answers. Authoring-only
projections replace selected documents idempotently through the real content
registry; no test-only answer function or alternate objective evaluator exists.
State tests use the real reducer, action preparation and T074 measure/submit.
Their synthetic room moves isolate this task; actual Walk/application/browser
integration remains T081/T105.

| Attempt | Observed result |
| --- | --- |
| [Initial RED](radio-rooms/red.txt) | 14 failed, 1 passed content tests; missing adapter caused a separate import-failed suite with zero state bodies executed |
| [First implementation](radio-rooms/first-green-attempt.txt) | 2 failed/13 passed content tests plus adapter suite setup failure; node IDs used an unsupported prefix; corrected to the existing dialogue ID schema |
| [Second attempt](radio-rooms/second-green-attempt.txt) | 40 passed/4 failed; corrected test assumptions about measure-versus-submit observations, historical completion receipt, and prerequisite no-op semantics |
| [Initial GREEN](radio-rooms/green.txt) | 46 passed; expanded from two to all four path/channel combinations |
| [Pre-review run](radio-rooms/final-tests.txt) | 47 passed, two suites, 6.33 s; 15 content and 32 state cases; exit 0 |
| [Coordinator null regression RED](radio-rooms/null-red.txt) | 4 failed / 32 skipped; explicit null selected an arrival default rather than rejecting malformed configuration; exit 1 |
| [Review-final run](radio-rooms/review-final-tests.txt) | **51 passed**, two suites; 15 content and 36 state cases; exit 0 |
| Scoped strict TypeScript | **PASS**, exit 0; owned files plus their imports, inherited full project strict options |

The four corrected behavioral expectations did not change domain source or
independent fixtures. T074 exposes `throughputProven:false` and
`wholeRouteProven:false` on **measure** observations, while successful **submit**
returns the objective explanation. Unmet prerequisites return an incorrect verdict
and reducer no-op, with no reading or award. Earned objective completion is a
historical once-only receipt: replay returns `objective-already-complete`, without
new observations or effects. An added regression verifies that later interference
still makes old passing evidence stale and produces a new failed 13 dB reading.
This distinction must remain intact in later repair/final-validation integration.

Both complete path/channel combinations, preparation-only scope, incompatible
settings, unaligned path, noise change with unchanged signal, emitter isolation,
channel change without isolation, 19.99 boundary, return-to-old-configuration
freshness, missing tool/prerequisites, unknown values, idempotent choices, retained
history, nonpunitive hints and detached scenarios execute through the controller.
Tampered room/profile/attempt/readings are rejected. Schema-valid unreviewed flag
values, direct completion, measurement-fact fabrication and unguarded menu nodes
bind no effects and yield no scenario. Content tests reject unknown actions,
contradictory evidence, invalid exits and unsafe anchors.

Exact final commands from repository root:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/content/radio-rooms.test.ts tests/state/radio-scenario.test.ts --maxWorkers=1
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node_modules/.bin/tsc --project docs/evidence/spec001/radio-rooms/tsconfig.scoped.json
```

The initial `tsgo` command did not exist; that failure is retained in
[typecheck-unavailable-command.txt](radio-rooms/typecheck-unavailable-command.txt).
The first actual tsc pass found owned test union-narrowing errors; those were fixed
with explicit successful-result guards and a dBm discriminant, preserved in
[typecheck-first.txt](radio-rooms/typecheck-first.txt). The final
[typecheck.txt](radio-rooms/typecheck.txt) is empty because tsc emitted no diagnostics.
Coordinator review identified that nullish defaults admitted explicit null even though ordinary game-state validation rejects it. Four malformed-state regressions reproduced the issue before fixing the adapter: defaults now apply only to undefined. The unchanged source fixtures and shared controller required no edits. The post-review strict check in [review-typecheck.txt](radio-rooms/review-typecheck.txt) also passed with no diagnostics.

Root requested that global typecheck/check/build wait for the ordered branch join;
none was claimed by this worker.

## Remaining boundary

Coordinator source review and task acceptance remain pending. T081 owns actual
canonical selection, captured action bus/app and policy integration; T105 owns the
complete independent radio ending and browser evidence. Final art, voices,
recruitment, optional Weather Diary/Channel Scout, human visual/listening/learning
reviews and all aggregate gates remain in their respective later work. No
production environment or protected owner preview was touched.
