# T076 — Shell Market and Clockworks authoring and controller join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Date: 2026-11-26. Worker: loop088. Local authoring and isolated controller evidence;
final task acceptance belongs to the coordinator after the T074/T075 join. No full
episode, browser, media-production, release-gate or publication acceptance follows.

## Delivered scope

- `content/spec001/rooms/R09.json`: the Shell Market, its five characters, ten
  allocated prop identities, return exit, walk region, safe anchor, fifteen
  semantic hotspots and readable equipment/power evidence.
- `content/spec001/rooms/R10.json`: the Clockworks, its three characters, ten
  allocated prop identities, workshop/Rift exits, walk region, safe anchor,
  thirteen semantic hotspots and readable timing/capability/scope evidence.
- `content/spec001/dialogue/equipment-actions.json`: five existing-schema dialogue
  records containing 39 preparation/context choices. They set explicit choices or
  record context facts; none completes an objective, grants a recruit, consumes a
  tool or manufactures a measurement. Every choice is exposed by a room hotspot.
- `src/state/equipment-scenarios.ts`: the current-world O09/O10 resolver, a closed
  action/effect/hotspot binding projection for the shared verb controller, and the
  untimed sample view using the existing `decodeToySamples` implementation.
- Focused content and state suites join the actual schema/registry, domain rules,
  reducer, verb bus and T074 objective/diagnostics controller.

Room descriptions, evidence and labels use natural room names. All eight NPCs have
readable Look descriptions and explicit Talk choices. Reading remains available
without recruitment. These authored placements claim no finished Blender models,
generated images, audio, exports or media quota contribution: neither room supplies
a media binding or an ambience file. The intended presentation remains the accepted
contained adventure frame, with contextual controls inside the game.

## Preserved lesson and source contracts

O09 and O10's accepted evidence is copied exactly into its corresponding room,
while additional room facts explain the exhibits. Existing objective definitions,
source claims, profiles, oracle fixtures and shared schemas were not changed.
Source claims remain those reviewed by T006/T014/T068/T069, principally PHY03,
PHY08–PHY11, STATE01–03 and S07/S10/S11/S12/S13, with the existing physical/upper-stack
scope rules. No new product-specific rule or numeric port rating was introduced.

| Activity | Before/after evidence and acceptance boundary |
| --- | --- |
| Equipment | Original 12 + 11 + 10 = 33 W exceeds the fictional 30 W delivered-after-losses budget by 3 W. Kit A uses 23 W with 7 W headroom; kit B uses exactly 30 W with 0 W headroom and passes the inclusive maximum. |
| Compatibility | Form factor, PHY/medium, supported rate, host support, power method and each port are distinct checks. An isolated same-shell mismatch or failed per-port check remains incorrect despite 7 W aggregate headroom. The complete kits explicitly supply the other compatible conditions. |
| Common mode | Both endpoints negotiate; A advertises 1000/full and 100/full, B advertises 100/full and 10/half. The only common mode is 100/full. The other two selections remain real incorrect answers. Runtime readings use the explicit Mb/s-to-Mbps spelling alias with unchanged value. |
| Sampling | Ordered positions 0,1,2,3 carry toy levels −3,+1,+3,−1. The exact map yields 00\|10\|11\|01 = 00101101: eight represented bits in four symbols. These are not voltages, useful bitrate, a full PAM4 PHY or implemented analog clock recovery. |
| Physical role | Correct bits with the claim that a physical repeater resolves an IP address fail. NTP, MAC/IP discovery, routing and application login remain outside this physical exercise. The separate highlighted NQ payload belongs inside an opaque upper-interface frame and is not the four-symbol answer or a complete two-byte frame. |

Kit selection is reversible and requires no payment, recruit, optional quest or
consumable. O09 uses the existing never-consumed inspection kit; its Arrival Lift
acquisition remains reachable. O10 has no required tool. Both accepted O09 kits and
both O10 methods retain the existing method/worked-step/solution hint ladders. Help
is recorded independently and does not downgrade a technically valid completion.

## Actual state and controller boundary

The resolver reads `FLAG-market-kit`, `FLAG-equipment-capability`,
`FLAG-clock-method`, `FLAG-clock-role`, and four independent
`FLAG-clock-bits-0` through `FLAG-clock-bits-3` values. Missing or unrecognized
selections return no scenario; no right answer is silently supplied. Wrong but
supported choices return their actual incorrect scenario so the evaluator can
explain it. There is no whole-answer button: each position offers 00, 01, 10 or 11.

`FLAG-clock-sample` selects a visible prefix of the exact supplied sample sequence.
Inspecting any prefix and replaying position zero call the existing decoder.
These operations never write the player's four pairs, create a measurement or
complete calibration. The controls are untimed and remain still until selected.

`equipmentInteractionBindings(registry)` checks the closed source/entry-node,
choice, prerequisite, effect, room, hotspot and verb mappings. An unexpected effect,
unrelated flag, modified value, weakened condition, changed entry or missing target
throws before exposure. `createEquipmentScenarioResolver(registry)` fails closed
on a malformed binding definition. Shared verb-controller checks additionally
enforce current-room ownership, current captured action context and prerequisites.

The actual T074 controller injects the canonical profiles and evaluates power,
capabilities and symbols. An explicit measure operation captures the canonical
aggregate; it does not complete an objective. Submit uses the already-selected
measurement ID. Equipment/answer changes invalidate old readings, and a stale
submission never creates or refreshes evidence. Tests also submit a captured
command after a change through the real action bus and observe rejection. Existing
context facts are required independently of the numerical result.

Runtime integration must load the complete objective/profile documents, both room
documents and the equipment action collection, combine the new effect/hotspot
bindings with existing bindings, and compose the resolver with the other route
resolvers. T081/root owns world loading; the first complete copper route is T078.
No application or production world loader was changed by this task.

## Verification and honest failures

Pinned executable:
`.runtime/node-v26.13.1-darwin-arm64/bin/node`.

Final focused command on this source candidate:

```sh
.runtime/node-v26.13.1-darwin-arm64/bin/node node_modules/vitest/vitest.mjs run tests/content/equipment-rooms.test.ts tests/state/equipment-scenarios.test.ts
```

Result: **41 passed** (19 content, 22 state), 2026-11-26 at 19:26 local, 3.39 s.
Coverage includes both valid kits/methods, wrong power/profile/port/mode/bits/role,
separate hints/context, fresh canonical evidence, before/after history, stale
captured submission, immutable scenario/sample behavior, actual shared controllers
and six closed-binding tamper cases. There is no TODO disguised as a pass.

Earlier authoring-only 18 tests passed. Adding all actual preparation choices
exposed a real registry limitation: the first 35-choice projection produced
`graph-bounds` for all three branches at the unchanged 4096-state cap. The test was
left failing and all choices remained visible. The coordinator separately fixed
route memoization to omit diagnostic-only dimensions never read by any condition,
with independent regression coverage and the original cap intact. This task did
not modify the registry or hide controls. The subsequent 33-test and final 41-test
joins passed against that shared fix.

An intermediate global typecheck caught an unused test import and an intentional
readonly-mutation test cast; both were fixed. The 19:22 local typecheck passed
before the final binding additions. The coordinator owns the final joined
typecheck; this document does not claim a later typecheck until that result arrives.
No broad build, browser, production service or credential command was run.

## Frozen input hashes

| Input | SHA-256 |
| --- | --- |
| `content/spec001/sources.json` | `a46ec103c9ec5e5103fd85543d2c9965b22e4204b98d40df2629303917527116` |
| `tests/fixtures/repair-routes.json` | `ed3a083828188a34fd6f5f345cbd4c69fe8ebb140ea903dbafd9b3f464639877` |
| `content/spec001/profiles.json` | `93c0dfe3d40c74e68b2e4e025518e2efe1c3e82abb5438d233fddeb9b0834cc3` |
| `content/spec001/objectives.json` | `b5e2212d581caebc4419f683dc47e337dabba157dc569369f5413e13511f9b98` |

The room/schema tests also freeze the actual power, capability and symbol parameter
values against the accepted source register. These hashes identify the input
snapshot; they are not media, human-review or release seals.
