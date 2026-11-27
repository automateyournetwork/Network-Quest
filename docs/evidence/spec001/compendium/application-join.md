# T095 application join after T094

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

Preparation instructions only; no application source changes yet. T094 owns the
first application/shared action join. Apply this bounded second join to its final
source, preserving the distinct party planner and all existing source bindings.

1. Import `createCompendiumController` / `createCompendiumPanel` from
   `../ui/compendium` and the existing `content/spec001/sources.json` catalog.
2. After constructing `notebook` and `navigation`, create `compendium` with the
   same `registry`, `store`, `bus`, `metadata: world`, `navigation`, `notebook`,
   `sourceCatalog: sources.sources`, `gameBase: import.meta.env.BASE_URL`, and the
   same closed `allowDuringEncounter` policy. Leave portraits omitted: all
   portrait allocations are planned.
3. In the existing PanelPlanner composition, route only `compendium` to
   `compendium.panels`; retain T094's `party` branch and notebook fallback.
4. Construct `createCompendiumPanel(shell.panelHost, bus)` with the other panels,
   dispose it during shell recreation, and render `const cp = compendium.project();
   panels.compendium.render(cp.view, cp.open, cp.capture)` in the ordinary frame
   prepare/render/sync sequence. No DOM is appended below the frame.
5. Pair `compendium.invalidate()` with notebook/bus invalidation at every existing
   restore/new adventure/title/confirmed logout replacement boundary. Dispose the
   controller during application disposal. Canceled logout must leave it alone.
6. Do not add a new discovery effect, room-visit hook, source-fetch operation,
   image URL, party action or movement path. Discovery is T094's actual authored
   encounter, and evidence selection is the notebook-owned existing intent.
7. Integration checks: actual Look discovers one known character; opening the
   compendium never discovers remaining entries. Select an actually recorded
   cross-room source, confirm notebook selection and visited map highlight, no
   movement/dirty generation/measurement update, and unchanged stale status.
   Verify C key/Tab/Enter/Escape, source links, 200% text and stale captures after
   the actual application's restore/Retry/logout replacement boundaries.

Candidate browser evidence proves only the isolated projection/frame view. It
must not substitute for the final actual-application checks above, T104, or the
later portrait/source media acceptance.
