# Copper Warrens and Echo Cavern prop review

On November 27, 2026, loop 128 produced the twenty T111 identities from PR021 through PR040. Each prop has its own editable Blender source and game-ready GLB. All twenty retain the SPEC roster identity, metre scale, grounded origin, orientation and candidate envelope. The two rooms use 540 editable component meshes across these props. The 20 exported GLBs contain 53,444 indexed triangles and total 1,819,556 bytes. [Fragment](../../../../../assets-src/props/R03-R04/manifest.json)

The Copper Warrens display the copper pairs and their terminations, an open conductor on the original spool, two candidate paths and a conventional place to test continuity. The nearby motor carries an UNMEASURED plate. The Echo Cavern apparatus distinguishes a connected repeater from the open broken span, an acoustic analogy from a test, and an optional ringing gong from evidence of service recovery. Short physical markings complement the room's existing semantic descriptions. [Copper Warrens comparison sheets](PR021-PR025.jpg) · [Copper equipment](PR026-PR030.jpg) · [Echo Cavern comparison sheets](PR031-PR035.jpg) · [Echo exhibits](PR036-PR040.jpg)

## Inspection

Each final source opened in a separate Blender 5.2.1 LTS process with factory settings on the project Mac. That process rendered the source, measured the component meshes, bounds and Principled materials, and optimized the static pieces into one mesh divided by material for export. The game files contain no studio lights, cameras, external geometry or texture images. Each prop uses 5–11 draw primitives. The original per-part meshes remain independently editable in the native files.

A clean, locally trusted HTTPS session loaded the actual twenty GLBs with Firefox 159.0 and Three.js 0.187.0. The pinned browser rendered each from its corresponding Blender camera at 540 × 540. Geometry, material names and linear base color, roughness and metallic factors matched the reopened source. Independent binary decoding checked every position and index, alpha mode, ground root, triangle count and projected axis conversion. The largest difference between native and GLB bounds was below 0.000000079 m. Silhouette intersection over union ranged from 0.982450 to 0.999407 at alpha 128. The clear backing on the pair exhibit produced the largest edge difference. Highlights and cast shading differ between the Cycles and WebGL studios. All images stayed inside the inspection frame. [Binary comparison](glb-structure.json) · [Projection measurements](projection-comparison.json) · [Individual observations](../../../../../assets-src/props/R03-R04/review-findings.json)

The coordinator inspected the initial motor render, requested clearer lettering and confirmed UNMEASURED in the revised Firefox capture. Worker inspection also found that the initial port bank showed too few contacts, the telegraph label was partly hidden, and a reflector pivot protruded inside the cup. The patch panel now has eight conductors per port. Squaring the narrow contacts reduced its intermediate 10,512 triangles to 4,368. The telegraph plate faces the reader, and the reflector's trunnions attach to a rear plate with a small copper centre fixing. The gong gained a legible OPTIONAL plate and the paper follows the printer platen. A subsequent same-loop review corrected the metre symbols and the wheel’s 9. [Metre correction and exact path list](metre-correction.json) Earlier captures and measurements are preserved. [Earlier inspections](earlier/) · [Final motor](PR026-browser.png)

## Shared tool mounts

Five secondary props have frozen anchor points on these parents. A downward ray through each anchor measured the uppermost surface in the reopened source at its exact horizontal coordinates. The signed difference below is the anchor height minus the support height.

| Shared prop | Parent support | Difference |
| --- | --- | ---: |
| PR122 continuity tester | PR029 central tester saddle | +5.80 cm |
| PR125 cable probe | PR023 cable winding | +1.02 cm |
| PR128 crimp tool | PR024 shelf | +7.46 cm |
| PR133 cable tie bundle | PR024 hanging hook | +6.81 cm |
| PR148 evidence tag | PR023 tag clamp stem | −0.51 cm |

This inspection led to the raised tester saddle, crimp shelf, tie hook and tag clip. T136 needs to seat the actual secondary models against those supports, clear the exposed conductor and inspect room-camera legibility. The results assume the source's identity ground orientation. Evaluate any final staging rotation with the child models present. [Support coordinates](shared-mounts.json)

## Reproduction and scope

Run Blender in background mode with factory settings, two threads, Python exit code 1 and the batch's build.py followed by the relevant PR identities after `--`. For each saved source, start a fresh Blender process, open its .blend and execute reopen.py. In a further background invocation, mounts.py reads the three parent sources. The pinned Node runs browser.mjs from the batch directory, using ephemeral localhost TLS and a disposable Firefox trust profile. The existing project Pillow environment runs sheets.py. Python runs verify_glb.py followed by records.py. Supply the batch manifest to the repository's inventory command. [Production scripts](../../../../../assets-src/props/R03-R04/) · [Settings and input hashes](../../../../../assets-src/props/R03-R04/production-settings.json)

The fragment inventory passed with zero issues and zero accepted quota additions. All 20 declared entries are exported and have empty runtime usage. The typed records bind the individual asset, source and export hashes, native reopen, GLB structure, agent visual and browser reviews, production and rights checks. Finished-room usage, the final lighting and occlusion, runtime budgets, human/owner review and episode release remain open. T132 owns canonical inventory reconciliation and T136 owns these finished room placements. [Inventory result](fragment-inventory.json) · [Rights notice](../../../../../assets-src/props/R03-R04/NOTICE.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
