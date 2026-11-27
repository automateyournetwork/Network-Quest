# Photon's connector inspection

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The T106 allocation retains Photon as CH03 and requires an additional recruit
ability clip. On 2026-11-27 the coordinator used Blender 5.2.1 LTS to animate
the existing four joints in a copy of the T063 native source. Photon hovers
forward, dips both antennae toward a connector and sweeps across its face.
The two-second gesture reaches its lowest point at frame 24. Its animation
affects presentation only. Room placement and triggering the clip from the
optical checklist belong to finished-room integration.

## Source and export

The [authoring script](../../../../../assets-src/characters/photon-inspection/build.py)
checks the original source SHA-256, then writes a new native file. A second
Blender process reopened the derivative and exported the GLB. This uses the
original geometry, materials and [T063 attribution](../../../../../assets-src/rooms/T063-NOTICE.md).
John Capobianco's original creative materials and this modification use CC BY 4.0
to the extent controlled by the project. Codex assisted with the original
local Blender animation script, licensed Apache-2.0. Inputs were the original
project model and the authored optical checklist.

The exporter kept all 29 meshes, 9 materials and 10,508 triangles. All mesh
attribute/index bytes and the retained idle, fly and reaction sampler values
match the existing GLB. Five tracks move in the new ability clip. The
[comparison](comparison.json) binds the two exports and the native derivative
to the actual file hashes.

The [exported asset fragment](../../../../../assets-src/characters/photon-inspection/manifest.json)
passed the repository inventory validator with zero issues against the isolated
T106 content and retained source. It records CH03 once and adds zero accepted
quota identities. T132 can consume the fragment when the new game binding is ready.

## Inspection

The coordinator compared the Blender render dependency graph with Three.js
animation playback in Firefox 159 over local HTTPS. Each of five sample times
matched all 29 mesh world matrices, including rest, approach, contact and
return. The largest matrix-component error was 0.000000204. An earlier
sampler read Blender's viewport graph, which retained the rest transforms;
the comparison rejected frame 12. Sampling the actual render graph resolved
the discrepancy using the same native source and export.

In the [native rest view](native-0.png) and [browser rest view](browser-0.png),
the wings are nearly level and both antennae rise above the eyes. At contact
the antennae point forward and the near wing tilts above the abdomen in both
renders. The browser light gives the far wing a darker edge; the head dip and
bright belly remain visible in the [native frame](native-24.png) and the
[exported frame](browser-24.png).

To repeat the comparison, open the derivative with Blender in background
factory-startup mode and run `sample.py` with a fresh output directory after
`--`. Run `compare.mjs` with the same directory using the pinned Node, PHP
and browser-test tools. The existing T063 model, its audited game binding
and earlier reports remain available for comparison.
