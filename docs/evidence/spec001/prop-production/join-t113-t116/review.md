# Spec001 prop roster production review

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

On November 27 the coordinator verified all 150 allocated prop identities. Each
has an editable native Blender source and its own distinct GLB export. The first
ten occupy the retained Arrival Lift source scene. Each of the other 140 has a
separate native file. The GLBs total 14,741,728 bytes and 367,103 triangles across
the entire roster. Each room uses a subset. These figures describe the exports
and do not measure frame rate or load time. [Model measurements](models.json)

| Allocation | Identities | GLB bytes | Triangles |
| --- | ---: | ---: | ---: |
| Arrival Lift and Workshop | 20 | 2,316,980 | 67,428 |
| Copper Warrens and Echo Cavern | 20 | 1,819,556 | 53,444 |
| Photon Gardens and Prism Vault | 20 | 1,618,252 | 34,484 |
| Skywell and Storm Observatory | 20 | 1,934,852 | 47,545 |
| Shell Market and Clockworks | 20 | 2,437,660 | 49,472 |
| Rift and Iron Threshold | 20 | 2,429,320 | 48,136 |
| Shared tools and fixtures | 30 | 2,185,108 | 66,594 |

The coordinator matched the frozen roster, checked native/export hashes and sizes,
parsed the actual rendered triangle counts from every GLB, and ran all seven
fragment inventory checks. Across all 150 props, the source hashes identify 141
distinct Blender files and every GLB has a unique hash. A separate private
projection reconciled the seven prop batches and three character batches to the
381-row manifest and passed with zero inventory issues. T132 owns the canonical
consolidation. [Joined inventory](inventory.json)

The native and Firefox contact sheets show working parts, units and equipment
appropriate to each room. The radio selector and separate signal/noise meters
read distinctly. The power and link indicators on the Market endpoint carry
separate labels. The final Rift bypass plates spell out 95 METRES and 100 METRES.
During this review loop 128 corrected the two earlier Copper Warrens metre labels
and a mirrored numeral. The coordinator inspected the current 85 m and 95/100 m
renders and verified all 315 entries in the revised batch seal. [Copper correction](../T111/metre-correction.json) · [Rift bypass](../T115/PR106-browser.png)

The prop renders and frozen-camera trials identified specific finished-room work.
In the Market the Apprentice and Chimera partly obscure the QSFP cage. In the
Clockworks the Apprentice can cover the timing wheel's untimed reminder. The Rift
deck and trench and the Threshold gate and beacon also lose visible area once the
residents are present. The shared prop trials corrected a hidden furnace valve,
but eight small objects occupy only 14–29 pixels at room scale. T135–T140 must
integrate their mounts, contextual access and close views into the playable rooms.
Those rooms and G5 still require actual use, human review, accessibility and
performance evidence. [Shared placements](../T116/mounted-rooms.jpg) · [Rift staging](../T115/R11-residents.png) · [Threshold staging](../T115/R12-residents.png)
