# T079 — Photon Gardens and Prism Vault

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

2026-11-26. Worker `/root/loop095_t079`. Scope: authored R05/R06 and their
actual T074 objective adapter; C9/C10/C14, FR-002/004/005, NQ-02/03, AC02/03.
Coordinator owns review, task acceptance and the ordered T081 application join.

## Authority and independent expectations

Read the governing constitution, root SPEC/PLAN, active specification/task
sequence, gameplay/data model contracts, implementation handoff/state and
`speckit-implement`. Existing prerequisite/checklist setup remains accepted;
optional Git hooks are disabled by the active coordinator instruction. No setup,
provider/host access, production credentials, Git operation or deployment was run.

The unchanged [source register](../../../content/spec001/sources.json),
[T014 literals](../../../tests/fixtures/physical-cases.json),
[T068 route literals](../../../tests/fixtures/repair-routes.json),
[T069 definitions](repair-definitions.md) and [T071 proof](optics-evaluation.md)
are the teaching authority. S06 supplies the budget/reserve arithmetic; S07
separates profile compatibility and minimum/maximum receive. Their established
limits remain in force. No new technical threshold or hardware claim is invented.

The authored state/content tests were written and executed before the adapter
and rooms. Their expectations explicitly preserve:

- T04: −3 dBm transmit minus 8 dB total loss is −11 dBm receive; reserve above
  −14 dBm sensitivity is 3 dB; maximum receive −1 dBm is checked separately.
- T15: 9 dB loss yields −12 dBm and exactly 2 dB reserve, an equally valid
  inclusive-boundary solution.
- T05: 10 dB loss yields −13 dBm and only 1 dB reserve, failing despite being
  above sensitivity.
- T07/RR-O05-WAVELENGTH: each named required compatibility mismatch rejects
  the candidate before a favorable nominal power budget can establish a link.
- RR-O05 alternatives: both suitable supplied interventions require inspection
  before change and confirmation by reinspection. Ordinary tools suffice.
- T13/T14/T16: new configuration/attempts need new explicit measurements;
  assistance does not penalize correct alternatives and repeated effects do not
  duplicate progress.

All numeric profile levels, reserve and inclusive comparisons are explicitly
fictional exercise parameters, not a real product datasheet. T06's independent
0 dBm receive observation is a labeled comparison exhibit only: the passive
−3 dBm transmitter with nonnegative loss cannot generate it. T074's exact
`fiber-proof` union stays passive. Actual overload grading remains in T071's
unchanged domain tests; this room does not fabricate a gain path to claim it.

## Authored behavior and APIs

`R05.json` and `R06.json` preserve the exact accepted O05/O06 evidence, registered
walk neighbors, safe anchors, all twenty prop allocations and five room character
placements. Each allocated subject has a Look hotspot and useful text. The garden
explains light versus power, required compatibility fields, inspection order,
recovery and mode/propagation caveats. The vault explains both receiver bounds,
reserve, units, path alternatives and fresh evidence. No clue depends on sound,
color, animation, a character conversation or a side reward.

The separate `fiber-actions.json` has two narrator menus, nineteen choices and
only reversible flags plus context/inspection facts. No action grants items,
recruits allies, consumes the kit, writes a measurement, awards an objective or
claims service recovery. Cleaning/replacement stock belongs to the dock; the kit
is diagnostic and remains obtainable at the Arrival Lift. The broken-fiber stump
is labeled a separate exhibit: cleaning does not repair a severed strand.

`src/state/fiber-scenario.ts` exports:

- `fiberEffectBindings(registry)`: repeatable bindings for exactly reviewed
  effects, or none if the action collection deviates from its closed contract.
- `prepareFiberAction(registry, game, actionId)`: room/briefing/tool/chronology
  guards and canonical effects for the captured action bus/reducer.
- `createFiberScenarioResolver(registry)`: the exact T074 `fiber-preparation`
  and `fiber-proof` variants using the actual current flags. Profiles are supplied
  by the shared controller from the accepted registry, never by a caller.

| Flag | Values and interpretation |
| --- | --- |
| `FLAG-fiber-connection` | Missing/`original` is the uninspected original; `inspected` records actual dock inspection; `cleaned`/`replaced` await reinspection; `verified-cleaned`/`verified-replaced` confirm removal. |
| `FLAG-fiber-profiles` | Missing means initial `wrong-wavelength`; `matched`, `wrong-fiber`, `wrong-wavelength`, `wrong-rate`, `wrong-polarity`, `unsupported-host` are the six declared candidates. Only the named field fails on each mismatch card. |
| `FLAG-fiber-path` | Missing/`high-loss` is the initial 10 dB test path; `passive-path-A` is 8 dB; `passive-path-B` is 9 dB. |

Select profile candidates before intervention. Cleaning and replacement are
available only from the inspected connection; each has its own reinspection
choice. To change profiles or try the other intervention afterward, restore the
original diagnostic connection and inspect again. The historical inspection fact
and an old O05 completion remain visible, but neither substitutes for current
verified preparation. `connectionDefectRemoved` is the confirmed-removal premise:
it remains false until reinspection establishes removal. Unrecognized flag values
fail closed without a fabricated matching/default scenario.

O05 defaults to the proposed cleaning alternative while the uninspected defect
still fails. Replaced/verified-replaced selects the replacement alternative. O06
selects the matching A/B alternative; the high-loss comparison uses A as a proposal
while its actual 10 dB reading fails. This preserves the controller's distinction
between a proposed alternative and a passing measured result.

The shared controller owns the canonical measurement rule/profile/subject/room
provenance, current revision and attempt. O05 emits Inspection complete and
Preparation complete counts. O06 emits Receive power (dBm), Sensitivity reserve
(dB), Sensitivity (dBm), Maximum receive (dBm), Required reserve (dB), Inspection
complete (count), Transmit power (dBm) and Total passive loss (dB). Both objective
awards remain the shared once-only effects; the adapter emits none.

## Execution record

All runtime test commands use the pinned Node26.13.1 installation.

| Attempt | Actual result |
| --- | --- |
| `01-red.log` | Both suites failed to import missing action data/module; zero test bodies executed. |
| `02-first-implementation.log` | 13 content checks passed, 1 failed; state suite could not initialize. All three concrete route analyses exceeded the existing 4096-state bound after the inspection-state guards were added. |
| `03-scoped-types.log` | Command setup error: `tsc` was incorrectly addressed inside the Node runtime directory. No compilation ran. |
| `04-scoped-types.log` | TypeScript7 required `--ignoreConfig` for an explicit file list. No source check ran. |
| `05-scoped-types.log` | Owned tests reported union-narrowing and branded attempt-ID errors. No adapter error; corrected without changing behavioral expectations. |
| `06-scoped-types.log` | Strict scoped compilation passed. |
| Coordinator/T081 joined correction, 20:33:52 | 101 passed / 1 failed across shared registry and fiber suites, 5.33 s. The guarded direct-award mutation correctly made inspection flags relevant to progress and exceeded the unchanged proof bound; our negative test had incorrectly required that registry to succeed. See the retained [world-graph record](world-graph.md). |
| `07-controller-join.log` | Final own content + actual controller suites: **38 passed** (14 content, 24 state), 6.39 s at 20:34:57. |
| `08-final-scoped-types.log` | Final strict scoped compilation passed, exit 0. |

The original graph-bound failure is retained and was sent to root/T081. The
worker did not raise the cap, remove action choices, weaken inspection guards or
edit the shared registry. The coordinator/T081 correction projects away condition dependencies that cannot
affect structural progress; a flag leading to an objective/reward/navigation effect
remains relevant. The 4096 cap is unchanged. The guarded direct-award mutation is
retained as an exact conservative semantic rejection; an additional unconditional
read-matching award mutation independently reaches a valid registry and proves
closed adapter rejection. No wrong answer or action guard was relaxed.

Scoped behavioral command:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" npm run test:domain -- tests/content/fiber-rooms.test.ts tests/state/fiber-scenario.test.ts --maxWorkers=1
```

Strict scoped command (project strict flags retained):

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node_modules/.bin/tsc --ignoreConfig --noEmit --target ES2022 --module ESNext --moduleResolution Bundler --lib ES2022,DOM,DOM.Iterable --types vite/client,node --strict --noUncheckedIndexedAccess --exactOptionalPropertyTypes --noPropertyAccessFromIndexSignature --noUnusedLocals --noUnusedParameters --noFallthroughCasesInSwitch --noImplicitOverride --noUncheckedSideEffectImports --verbatimModuleSyntax --isolatedModules --forceConsistentCasingInFileNames src/state/fiber-scenario.ts tests/content/fiber-rooms.test.ts tests/state/fiber-scenario.test.ts
```

## Scope remaining

These are authored temporary rooms and a local adapter. T081/root own the actual
world/application/action-loader and save-policy join; T105 owns independent full
browser routes and endings. No browser, native Safari, human learning/technical,
performance, asset, audio or episode acceptance follows from these scoped tests.
Twenty temporary prop references contribute **zero** finished media quota; native
R05 layered scenery, R06 scene, characters/props, audio and optional interactions
remain their assigned later tasks. No fake Talk/recruit/minigame/side-quest handler
is exposed. No aggregate gate or release is accepted here.

Protected inputs are sealed in [protected-inputs.json](fiber-rooms/protected-inputs.json).
All seven matched before and after the final scoped execution. Final owned-file
and exact shared-input hashes are in [seals.json](fiber-rooms/seals.json). The
38 passing checks and scoped typing make this local authoring/controller work
reviewable; this worker has not checked off T079 or accepted any aggregate gate.
