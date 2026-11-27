# T094 party preparation and integration boundary

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Status: preparation only, loop 106. T094 remains incomplete. This subtree is
outside the application, the root TypeScript include, and normal Vitest discovery.
The explicit preparation runner executes existing behavior; it does not certify
recruitment, party effects, progression, accessibility, or the eventual panel.

## Inputs and authority

Read the constitution, root SPEC/PLAN, active feature tasks/data model/contracts,
HANDOFF/state, implementation skill, and the accepted T092 fixture. Preserve the
fixture's semantic expectations; it explicitly does not prescribe production
item or ability IDs. The task exception permits isolated interface/tests only
until accepted T093 content and the coordinator's integration GO.

The nine identities remain CH03/04/05/06/07/16/19/20/22. Conventional routes remain
available with no recruits, optional quest or minigame rewards. Ability definitions
must refer to an actual conventional action or genuinely authored item; the
inspection kit is not a universal repair, power supply, or equipment substitute.

## Historical demonstrations and current physics

The coordinator selected historical accepted demonstrations as learning evidence.
An invitation must follow the actual encounter/discovery and occur at an authored
home/recruitment room. Looking, a room visit, an objective flag, a named fact, or a
`correct` response alone is insufficient. The saved measurement must have the
canonical objective, source profile/subjects, measurement room, accepted
conclusion, and appropriate checked readings/units. Preserve the original attempt,
configuration and stale marker when displaying it as historical learning. It can
never validate the current repair or become current by being selected for an
invitation.

This is necessary for real navigation: Unicorn and Hydra are encountered in R05
while O06 measures in R06; Thunderbird is in R07 while O08 measures in R08;
Copperhead is in R03 while O04 compares in R04; Chameleon is in R10 while O09
measures in R09. Returning home advances configuration and stales the measurement.
No extra remote NPC placement is implied.

The private `physical`/`canonicalMeasurement` machinery in objectives owns current
measurements. If a small shared validation helper is required, expose its existing
canonical projection deliberately rather than independently recreating a scoring
engine. A historical record validator must inspect that record; synthesizing a
current world from remembered facts and calling it historical proof is prohibited.

Existing canonical measurement labels are composite: O05 saves PHY06 (Photon's
scoped ability is PHY03), O04 saves PHY04 (Echo is PHY05), O09 saves PHY08
(Chameleon is PHY09). Hermit's full optical compatibility checklist uses O05/PHY06,
not the market's partial O09 equipment checks. A flat `ability.ruleIds.includes(ruleId)` check
would reject legitimate demonstrations. T093 now proposes explicit objective IDs.

The preparation tests also demonstrate that the completed-objective submit path
returns `objective-already-complete` even for an absent measurement. Recruitment
cannot use that acknowledgement as a measurement receipt. Fresh measurement remains
reachable after completion, which makes later practice possible without grinding
objective rewards.

## Proposed operation and lifecycle ownership

`party-interface.ts` contains intent-only UI shapes, not an implemented API.
The eventual reducer must own exact atomic game changes; the controller cannot
patch levels, abilities, inventory or party arrays directly. Preserve the existing
action-bus capture, epoch and exact-store compare-and-set checks.

An explicit post-recruit practice session should live in reducer/controller
runtime state only. Bind it to the adventure, attempt, world-install generation,
the recruited level, and the measurement IDs already present when practice starts.
Actual new bench measurements and a distinct authored comparison/explanation are
required before the explicit progression action. No XP, countdown, repeated button
count, quest reward or arbitrary repetition can substitute. A public UUID alone
is not proof; only its private session owner can resolve it. Do not accept a
renderer-provided baseline, accepted status, selected result, rule parameters,
effects or arbitrary state patch.

Restore, Retry/E03 Continue, title and confirmed logout discard incomplete
practice. A fresh session after reload can resume through the ordinary reachable
bench, while completed levels and abilities persist in existing RecruitProgress.
Retry restores recruits, levels and the active pair from the whole-world checkpoint;
retained measurements are historical and cannot silently re-award the reverted
level. Canceled logout changes nothing, including incomplete practice.

Recruiting, progression and actual party swaps change reversible WorldState.
Use the ordinary revision/dirty-generation boundary and mark prior measurements
stale once. Repeated identical actions/receipts must not grant duplicate recruits,
unlock abilities again or increment state unnecessarily. Maximum active size is
two unique recruited identities. Reject invalid requests atomically without
silently evicting anyone. Free preparation swaps do not consume inventory or write
a save. Never broaden generic `playable()` or active-encounter admission.

## Actual conventional effects

Resolve every ability through a closed character/ability/action mapping checked
against accepted content. An action ID can be a real authored preparation choice
or an objective alternative; these are different control types, not interchangeable
click targets. Dynamic values come from the canonical current scenario. Delegate
to the existing copper/fiber/radio preparation, equipment controls or objective
measurement operations, preserving conditions, required actual equipment, room,
version, observed result and the exact effect batch. No ability may award a route,
objective or service verdict from animation or presentation. Unsupported profiles
and Echo's unreviewed regenerative topology remain content errors without penalty.

The two levels must expose useful differences: base inspection and the specific
precision/explanation promised by the fixed T092 oracle. Reuse current observations
and show the limitation alongside the actual explanation. A renamed identical
button or level number is not meaningful progression.

## Shared integration edits pending GO

Expected bounded shared touches are the reducer operation/runtime practice boundary,
semantic action shapes and shape guard, application controller composition and
cleanup, and a Party panel within the accepted frame. Any content schema evolution
belongs to T093/root. The save-v1 payload already has the necessary recruit/level/
ability/active-party fields; prefer no payload change. The JS/PHP policy generator
must bind exact per-level abilities rather than accept level-one possession of
every future ability merely because the character owns it. Coordinate that bounded
policy strengthening with the coordinator before implementation.

The panel must use semantic buttons and the accepted internal frame/overlay system,
with keyboard access, readable limitations, focus return and stale projection
rejection. No extra menu below the adventure frame. The illustrated compendium and
sidequests/minigames remain T095–T103.

The coordinator assigned discovery mutation solely to T094 and read-only
compendium presentation to T095. Existing R01–R10 actor hotspots already expose
their exact `subjectId`; combine this with `room.characterIds` and the accepted
character discovery allocation. Do not infer identity from labels or add duplicate
Photon/Titan dialogue handlers. CH01 has its explicit playable-start encounter.
CH25 still needs an actual authored R11 actor hotspot during the ordered join;
R12's returning companions have earlier discovery sources. A room visit by itself
does not discover the room's characters.

## Independent verification still required

`runtime-contract.ts` defines 45 proposed runtime tests for a real adapter; it has
not been executed. They cover nine invitations, no automatic discovery awards,
meaningful progression, max-two, free swaps, stale controls, unsafe phases and
save/restore practice retirement. Implement the adapter using the actual controls
and reducer; a fake party implementation would not satisfy the contract.

Additional integration checks must cover every T092 ability vector with the actual
ally and conventional paths, malformed/forged historical records, interrupted
animation, unknown content, exact atomic commits, and future recovery of nonempty
party values. T104/T105 must bind real recruited/progressed/active values through
fatal Retry, E03 Continue and Restore Save plus real optional quest values when
available. Empty-array equality or directly injected party fixtures cannot accept
that gameplay obligation. The current T089 inspection-kit/O11 evidence stays intact.

## Preparation results

The first isolated run produced 23 failures/1 pass because the test harness read
nonexistent `world.evidence`; the unchanged log is `preparation-initial.txt`.
The harness was corrected to inspect actual loaded record evidence. The second
run passed 24 existing-boundary tests in 724 ms, recorded in
`preparation-rerun.txt`. These are preparation checks only; original T092 runtime
case execution remains pending and T094 is not marked complete.

The first 24 passing boundary checks included a proposed CH16-to-O09 map. Subsequent
source review found that O09 does not check wavelength direction or connector/polarity,
which the frozen Hermit oracle requires. The coordinator therefore changed CH16's
canonical demonstration to O05/OPTICAL with the actual optical mismatch controls;
R06/R09 remain its invitation rooms, and no extra O09 completion gate is required.
The proposal/tests were corrected; the initial result is preserved and must not be
cited as evidence that O09 satisfies the Hermit demonstration.

Scoped strict TypeScript also passes after correcting a test-only branded FactId
projection; both its initial diagnostic and successful output are retained.
`runtime.json` records the actually observed pinned Node/Vitest/TypeScript versions
and Mac architecture. The proposed per-level JS/PHP policy is detailed separately
in `save-policy-proposal.md`; it is not yet implemented.
