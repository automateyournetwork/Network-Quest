# Spec001 character production

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.

The coordinator reviewed the character batches resumed under loops 124–126
on November 27, 2026. The twenty-three identities complete the modeled roster
alongside the existing Apprentice and Photon. Each new identity has an editable
Blender source and a separate GLB export. The Crosstalk Twins share one model
and one roster entry.

| Task | Identities | Moving clips | GLB bytes | Rendered triangles across the batch |
| --- | ---: | ---: | ---: | ---: |
| T107 | 7 | 18 | 1,765,540 | 92,738 |
| T108 | 8 | 17 | 2,705,268 | 83,496 |
| T109 | 8 | 19 | 2,487,744 | 101,558 |

The coordinator compared the roster and required clip names against the
frozen room allocation, checked current source and export hashes and sizes,
and decoded the GLB animation samples. All 54 clips have finite, changing
channels. The indexed triangle count across mesh instances matched each
manifest. The [per-model results](models.json) retain the fragment hashes.

The early art review covered Titan, Copperhead, the Unicorn, the Hermit Crab
and Echo Bat. The final Copperhead pose shows both contact tips clear of its
jaw; the Unicorn's wingless profile keeps the ledger and single horn legible.
The crab's extraction bail and catalog tag distinguish its pluggable shell.
Echo Bat's outer wing edge is visible against the slate background in the
final frame. The coordinator also viewed the remaining batch-A browser renders
and the [batch B](../../assets/T108/batch-b-browser.jpg) and
[batch C](../T109/cast.jpg) cast sheets. See the
[Copperhead pose comparison](../../assets/t107/CH04-poses.png).

The repository inventory check passed for each fragment. A separate
[joined inventory check](inventory.json) replaced the 23 planned entries in
a private copy of all 381 manifest rows and passed with zero issues. The
canonical manifest stays at T106 pending T132. The audit also passed on the
original manifest. The scoped asset suites passed all 291 tests, including a
regression for the project's published LICENSE-ASSETS file. Type/content/save
checks and the client build passed. Vite retained its large-chunk advisory.

Finished rooms still need actual placement, camera, occlusion, accessible
interaction and budget checks before G5 quota acceptance. Use the
[R03/R07 geometry review](../T107/resident-clearance.json),
[two-party projection](../T108/party-staging.json) and
[R11 clearance check](../T109/R11-clearance.json) when integrating the
respective rooms. Keep the [versioned Photon inspection clip](../photon-inspection/review.md)
on its existing identity.
