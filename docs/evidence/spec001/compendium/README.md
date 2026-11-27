# T095 compendium implementation and evidence

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The actual implementation is `src/ui/compendium.ts` / `compendium.css`, a bounded
notebook change, and the application composition preserved in
`application-join.patch`. `tests/ui/compendium.test.ts` contains 32 actual module
checks. This directory retains the earlier candidates outside normal discovery.
The coordinator authorized the actual join after accepting T093. T095 is ready
for coordinator review; no task checkbox, global count, manifest, provider, save
service, deployment or owner preview was changed by this worker.

## Final actual source and application checks

- `join-focused-final.txt`: 44 pass (31 T095 plus 13 existing notebook checks)
  after the real source-reference handler joined. The prior
  `integrated-notebook-red.txt` retained 25 pass / six expected failures before
  that handler existed.
- `join-check-final.txt` / `join-build-final.txt`: global check/build passed at
  the coherent T094/T095 snapshot before the final attempt-label copy change.
  Existing large-chunk advisory remains.
- `actual-panel-initial.json`: 17 actual-module native Firefox cases passed.
  Compendium-only CSS puts frame Game/Close controls in normal flow. At both
  1280/390 and 200% text, 116 first/last text glyphs were scrolled and checked by
  hit-testing with no obstruction. Initial headings and focused controls were
  also checked; selected screenshots were visually inspected. Discovery in this
  isolated module host is explicitly injected, not a player discovery result.
- `application-third.json`: eight actual guest application checks passed with
  no injected adventure state, no API writes, no page errors and no source hash
  changes during the run. New Adventure, real Look evidence, C/Enter source
  selection, real physical inspection, actual Walk to R02, retained stale R01
  evidence, real return directions/Walk, and 1280/390 at 200% all ran.
- The first application attempt picked the frame status paragraph instead of
  the count: the corrected harness uses the actual discovered-count text.
  `application-second.json` exposed a real focus defect: notebook tried to focus
  the selected heading while the previous panel still made it inert. The fix
  waits one microtask for frame synchronization and checks capture, draft scope,
  selected evidence, open/connected/visible state before focusing. Its selected
  heading is centered and visually unobscured. Both failures are retained.
- `provenance-focused-final.txt`: 45 pass, including a new exact same/earlier
  attempt test. The notebook now displays “this attempt” or “an earlier attempt”
  using exact ID equality, retains stored provenance and current/stale status,
  and does not print an opaque UUID in ordinary evidence copy.
- `provenance-scoped-typecheck-final.txt`: final T095 strict check passed.
  `provenance-application-final.json` and the final narrow screenshots verify
  the attempt-label change using an actual fresh guest measurement followed by
  real Walk to R02, at 390px/200%. The source selection remains stale and does
  not move the player. No source changed during that targeted run.
- `provenance-build-final.txt`: the final global build attempt failed on another
  worker's newly in-progress `src/state/optional-activities.ts` union narrowing.
  Do not label the final global build passed. Coordinator will run the complete
  joined check after those inputs stabilize; T095's focused/scoped checks pass.

### Coherent dependency snapshot, not standalone discovery acceptance

The actual application runs shared T094's initial New Adventure CH01 discovery
and exact-level save-policy work. Those were not accepted T094 completion at
this checkpoint. Browser source hashes include the initial `adventure.ts`,
`reducer.ts` and relevant party source; the earlier build seal preserves the
coherent worktree build. A T095-only patch omitting these dependencies is not
claimed to reproduce that exact checkpoint. The discovery count is asserted to
stay unchanged when opening/reading; there is no assertion that Look discovers
Photon, that all 25 encounters work, or that recruitment/progression is accepted.
Those joins remain T094/T104. The compendium remains a reader of the existing
state, including a correctly labeled planned portrait fallback.

`source-seal-before-provenance.json` preserves the earlier coherent source and
build. `source-seal.json` records the final T095 source and evidence; any earlier
build entry remains explicitly associated with the pre-copy-change checkpoint.

The authority is C4/C9/C10/C14, NQ-04/05/06, the T095 task and AC04/05/14.
The source register and T093 character draft supply exact technical claims and
scope. No new scored teaching rule is introduced. T094 owns actual encounter
discovery and all party/recruitment/progression effects. This view only reads
`world.compendiumIds` and current recruit state.

## Interfaces

`projectCompendium` receives the validated registry/world metadata, the current
game, the existing notebook's evidence projection, and actual navigation policy.
Only discovered character records enter the detailed view. The remaining count
does not expose undiscovered character names or imply completion. Abilities are
listed as unlocked only when present in the existing recruited record.

`describeEvidenceRoute` performs a bounded directed search by calling the actual
`Navigation.resolve` at each authored exit, limited to the visited map. It never
uses round-trip recovery as a substitute for ordinary forward reachability. The
result names actual exits and explicitly tells the player to use Walk and repeat
measurements when appropriate. It changes no state.

`resolveCompendiumPortrait` requires an exact trusted character/compendium/asset
binding and a local raster export. The default binding list is empty. All 25
current portraits remain planned: no generated URL, broken request or false
asset acceptance. Production bindings require later source/export/review evidence;
the synthetic positive resolver test does not provide that evidence. Failed
image decode retains its exact text caption. Portrait-dependent AC05 remains
open for T104/final media.

Technical source titles and HTTPS links resolve from exact existing source IDs;
entry-specific claims/limitations remain intact. Context-only sources retain that
label. Links use a separate tab with `noopener noreferrer`, preserving an unsaved
guest adventure. Text is inserted as DOM text, including player notes.

`createCompendiumController` opens the existing compendium panel through the
actual action bus and UI plan. It reads the existing notebook controller and
does not register a competing discovery or evidence handler. T094 has reserved
a distinct `party` panel. Application composition remains ordered.

The notebook owns `inspect-evidence`: it validates an actually projected entry
with a visited source, atomically opens the notebook, and highlights that
evidence/source. T095's view sends only that existing captured intent. There is
no new teleport or measurement action.

## Retained preparation history

Pinned Node 26.13.1 was used throughout.

- Initial `preparation-red.txt`: missing candidate module, expected before view
  implementation.
- Initial `preparation-first.txt`: 19 pass / 1 failed own fixture abbreviation;
  corrected “Photon” to canonical “Photon the Firefly.” Original accepted T092
  oracle untouched.
- `preparation-controller.txt`: 25 pass across two explicitly discovered suites
  (21 projection/navigation/media checks and four real controller/adaptor checks).
- `preparation-controller-typecheck.txt`: strict candidate TypeScript PASS. The
  first retained check includes own readonly fixture errors and temporary T093
  graph-inference errors; the latter were fixed by their owning worker.
- `panel-candidate-first.txt`: harness setup failed because TypeScript 7 has no
  old `transpileModule` API. Harness now uses Node's built-in type stripping.
- `panel-candidate-initial.json`: nine native cases passed, seven failed. Four
  failures exposed stale controls in the candidate (reinserted old control,
  detached panel, hidden host, inert host); active control/capture/host guards
  now reject them. One exposed native `summary` elements omitted from the
  existing frame's explicit focus selector; candidate summaries now declare
  `tabindex=0`. Two text-scaling failures came from the harness omitting the
  actual `nq-adventure-host` class; the fixture now matches that composition.
- `panel-candidate-final.json`: 17 native Firefox 159 cases pass, no page errors.
  Sources are hashed in the report. Actual frame/CSS were used, but discovery
  and notebook rows are injected fixtures; this does not accept application
  encounters, real evidence navigation or source-link network retrieval.

The final 1280×900 and 390×900 screenshots were visually inspected at actual
32px (200%) text. Dialogs stay inside the single game frame, wrap text, scroll
vertically and retain the source control and closing controls. These are
candidate-only screenshots; phone support, Safari, full application access and
human learning/episode review remain separate.

The browser harness starts one ephemeral localhost server with only four exact
public resources; every other request returns 404. It closes its own browser
and server and does not touch the owner previews at 63366/54594.

Reproduce preparation only:

```sh
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node_modules/.bin/vitest run --config docs/evidence/spec001/compendium/preparation.vitest.config.ts
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node_modules/.bin/tsc -p docs/evidence/spec001/compendium/tsconfig.json
PATH="$PWD/.runtime/node-v26.13.1-darwin-arm64/bin:$PATH" node docs/evidence/spec001/compendium/panel.browser.mjs docs/evidence/spec001/compendium/panel-candidate-rerun.json
```
