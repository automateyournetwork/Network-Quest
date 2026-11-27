# T100 bounded common join

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The coordinator released the shared source window after freezing accepted T094.
This join loads the reviewed SQ01 toy-message and SQ02 delivered-power-audit
candidates. SQ03/SQ04 and minigame variants remain unavailable pending their
ordered authoring joins. The original T092 fixtures and schema hash are unchanged.
`content-schema-before-T100.json` retains the complete accepted T093 schema;
T093 preservation tests now explicitly distinguish those two historical baselines
from the new quest/minigame/effect extension.

The schema admits two closed reviewed payloads. Registry semantics bind their
actual source samples/demands, profiles, entry rooms/hotspots/anchors and exact
reward batches. Content loading checks the real planned illustration allocation,
without treating allocation as produced or accepted imagery. Malformed payloads
produce content errors before evaluating learner answers. No UART, new scored
physics rule or fake main-objective identity was introduced.

The save-v1 JSON shape remains unchanged. The legacy `assistance[].objectiveId`
field is typed as a lesson source: objective, quest or minigame. Generated
`lessonSources` lists only actual authored sources; every hint is bound to its
source and level. Main-objective membership remains O01–O12. JavaScript and PHP
agree. Receipt-first replay and the one-slot transaction are unchanged. Explicit
trusted projections adapt old test policies; their raw fixture bytes are retained.

Minigames declare one unique `completionAchievementId`, registered as an actual
achievement. The closed `complete-minigame` effect resolves that declaration into
existing `world.achievementIds`. Its receipt and `minigame-complete` condition
resolve through the validated registry. Missing/mismatched records, unknown
achievements and omitted registries fail closed, including recursive conditions.
A synthetic schema-valid mapping fixture tests this infrastructure through the
real registry, reducer and JS/PHP policy. It does not implement or expose MG01.

The reducer owns a transient optional session; it is not saved. Captured bus
intents carry session identity and the existing adventure/attempt/configuration
context. The controller also guards the exact game/session/account references,
including same-version mode changes and replaced runtimes. Start requires the
actual authored safe entry. Submit invokes `evaluateSymbolAnswer` or the reviewed
`evaluatePower` adapter. UI callers provide intent, never evaluations or effects.
Correct full delivery selects the exact once-only quest/fact batch. Practice,
malformed content, wrong answers and missing input select none. Reading practice
answers or corrective/solution help records assistance, bounded at 2048 before
showing new help. Pre-completion explanation cannot claim an earned reward.

Retry copies the captured preparation world, allocates a new attempt, advances
revision beyond retained provenance and stales previous readings while retaining
journal facts, notes and hint use. Accepted delivery advances this session's
replay baseline only after the reducer accepts the completion batch. Replay does
not revoke or duplicate earned rewards. Genuine encounter Retry/E03 retains its
separate whole-world checkpoint. Exit closes the matching session at its actual
entry without navigation, refreshing measurements or saving.

The panel stays inside the existing adventure frame. It has explicit practice,
full answer, hint, explanation, retry and exit controls; timing is off with no
timed capability exposed. Power displays its budget from the validated profile.
Sources open in separate tabs; technical detail is optional. Keyboard focus opens
on the heading and returns to the mounted entry control. Detached callbacks are
aborted, source summaries join focus traversal, and Game/Close stay in flow at
200% text size. Both quest receipt and journal fact are required for truthful
reward descriptions. SQ02's earned wallprint description appears in R02.

Verification: `24-focused-seal.log` records 62 focused tests; joined controller,
policy, schema and mapping tests also have normal test-discovery wrappers. The
initial full client run recorded 3296 PASS/360 TODO and two suite import failures
from old T094 fixture policies. After explicit projections, the affected six
suites passed 456 tests (`15-affected-join.log`); the additional minigame mechanism
run passed six tests (`17-minigame-mapping.log`). PHP passed 908 tests/19138
assertions. Strict framework TypeScript and the production build pass. Final
native guest testing (`27-native-input-review.json`) passed ten groups with zero axe
violations, API requests or page errors and unchanged tested source hashes.
Native tests use an ephemeral development server, not deployment acceptance.
Root owns final aggregate verification, review and publication.

The source seal distinguishes owned production/evidence files from dependencies.
Retained failures and their resolution are described in `review.md`. These checks
do not certify media production, human learning, later activities or episode
completion.

The final sealed-source rerun is `24-focused-seal.log` (62 PASS);
`25-check-seal.log` passes typecheck, content validation and generated-policy check.

Final visual review found the power number input retained browser-default font.
The original screenshots and pre-correction seal remain as history (18-prefixed
screenshots and 26-before-input-review-seal.json). Input now inherits text size
with padding; the generic completed message is activity-neutral. Receipt 27
passes all ten native groups and asserts 32px input font, 69.6px height and
contained width at both sizes. Logs 28/29 pass the 15 affected controller tests
and production build. Source hashes were stable throughout native run 27.
