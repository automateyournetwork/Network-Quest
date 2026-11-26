# R01 / Apprentice / Photon source package

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

These are produced/exported benchmark candidates. No item contributes to accepted
media totals yet. The canonical manifest remains coordinator-owned.

`R01-build.py` creates the native room and two character sources in real Blender
5.2.1. The final command inputs and exporter options are in
`R01-production-settings.json`. Start Blender with `--factory-startup` to avoid
unrelated installed UI add-ons. The saved scenes remain fully editable: separate
named objects, material slots, UV islands, simple collision bounds and articulated
transform hierarchies. No external texture, linked library, or downloaded geometry
is needed. Models use original material colors, metallic/roughness and emission;
no unsupported shader effect is being represented as a successful bake.

From the repository root, run the script once with `-- room`, once with `-- CH01`
and once with `-- CH03`. Reopen each resulting `.blend` in a **fresh process**, then
run `R01-verify.py -- reopen`. It renders the source and exports GLBs. To reproduce
an independent import, start another empty process and run
`R01-verify.py -- import R01` (or another export stem). `--python-exit-code 1`
turns a Python verification failure into a nonzero Blender exit. `-- inspect-details`
adds observed collision/root metadata without changing source or exports.

The native source-only collision proxies are not renderer occluders or game
navigation authority. The existing logical walk polygon and saved safe points
remain authoritative. The source contains a floor proxy, one proxy for each
PR001–PR010, and separate CH01/CH03 proxies in their sources.

For runtime composition use `R01-architecture.glb`, the ten independent prop GLBs
and `R01-placements.json`, then add the two character exports. Each prop export is
local to its named parent. The lift's source parent Z scale is already converted
and retained **inside** its GLB; the outer placement uses scale one. Loading
`R01.glb` together with those individual props would duplicate geometry. The full
room GLB is retained solely as an assembled source/reference export.

CH01 and CH03 use rigid transform rigs, not skinned armatures. Each body part is
editable and attached to a named joint; the source NLA tracks group `idle`,
`reaction`, and `walk` or `fly`. All NLA tracks are muted in the stored rest view;
unmute one named track per animated node to preview it. Root translation stays
stationary. CH01's measured rest height is 1.775 m (the direction's 1.65 m was a
proposal). Photon has a 1.15 m hover child; its root remains at ground zero. Flight
and walk speed/foot planting still need the actual movement adapter in T066.

`T063-poses.py` captures actual render dependency-graph transforms and native
pose renders. Capturing only a stale viewport graph gave incorrect idle matrices
while renders correctly moved; the render-graph capture fixes that instrumentation
error. `R01-browser-check.mjs` opens a disposable strict-TLS Firefox session and
loads all fourteen GLBs. It never calls the game's state or account services.
`R01-compare.py` checks the resulting geometry, axis labels, clip seams and actual
source/browser pose matrices. The HTML harness is inspection tooling, not a game
UI or a substitute for T066/T067.

`R01-candidates.py` writes the twelve disjoint candidate entries and actual
per-asset evidence records. It does not write `assets-src/manifest.json`.
Review findings live in `docs/evidence/spec001/assets/t063-benchmark.md` and the
loop 068 note. Attribution is in `T063-NOTICE.md`; image/audio assets have separate
production histories.
