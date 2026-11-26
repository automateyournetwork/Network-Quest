# T063 — genuine Blender benchmark and browser export comparison

2026-11-26 · `/root/loop068_t063` · **Source/export task complete for coordinator
review; game integration, owner media review and G3 remain pending.**

Three genuine editable sources were created and reopened in fresh Blender5.2.1
LTS processes: R01, the Apprentice and Photon. R01 contains the exact ten named
PR001–PR010 props from SPEC, each with its own hierarchy, meaningful construction,
source-only collision bounds and local GLB export. The separate scene architecture
has no prop quota identity. Twelve candidate asset entries remain `exported`,
`countsTowardQuota:false`, with no claimed gameplay `usedBy` binding.

The visual design uses copper framing, basalt floor tiles, cream details and teal
machinery. The apprentice has asymmetric tools/notebook/satchel, cuffed coat,
boots, swept hair and parked field goggles. Photon has a pear-shaped luminous
abdomen, dark face mask, two antennae, six legs and independently moving veined
wings. The attached apprentice costume bag is not counted as another prop. No
feasibility asset, external model, texture or generated image was incorporated.

## Actual checks

| Check | Observed result |
| --- | --- |
| Native sources | Three sources saved, then reopened in fresh Blender5.2.1 build9e2066aef7ef; source renders, editable materials, UVs, named joints and collision bounds inspected |
| Export import | Fourteen actual GLBs imported in fresh Blender processes; no external texture/buffer references; no collision proxy rendered/exported |
| Composition boundary | `R01-architecture.glb` is9,856 triangles; ten distinct prop GLBs total27,940; together exactly match the37,796-triangle full-room reference |
| Character geometry | Apprentice65 meshes/22,412 triangles; Photon29 meshes/10,508 triangles; combined room+characters70,716 triangles |
| Actual clips | CH01 `idle`4s / `walk`1s / `reaction`1s; CH03 `idle`4s / `fly`1.25s / `reaction`1s; changing bound-node tracks move actual mesh descendants |
| Clip continuity | First/last exported sampled values differ by less than1e-5; stationary root is not animated. This is pose continuity, not a human locomotion/foot-plant approval |
| Pose parity | Twelve native-render/browser pose pairs compare all65/29 meshes; largest world-matrix component error2.858284e-7 after explicit Z-up to Y-up conversion |
| Axis checks | Actual labeled power panel, training tube, satchel and Photon hover nodes have expected exported runtime translations; largest error below1e-6 |
| Native browser | Firefox159.0 / Three0.187.0 / Playwright1.65.1, isolated CA+SAN leaf and NSS profile, `ignoreHTTPSErrors:false`; all14GLBs loaded/rendered; zero page errors |
| Room registration | Frozen camera(12,13,16), target(5,1,3), span13; fourteen anchors compared at1280×720, maximum error0.000174652CSS px |
| Viewports | Actual isolated composed-stage captures1280×720,1440×900,768×720 and390×720. The whole room fits at390; details are small, so real semantic controls remain necessary |
| Candidate audit | `assets:verify -- --manifest assets-src/rooms/R01-manifest-candidates.json`: validtrue, zero issues, every accepted quota0 |

Source renders use Cycles CPU16samples with denoising, Standard view, exposure0,
gamma1 and sRGB PNG. Browser uses NoToneMapping/sRGB output with rectangular area
lights and hemisphere fill. I inspected actual source and browser images and the
native/browser quarter/half animation poses. Silhouettes, individual details and
poses agree. Browser shading lacks Cycles indirect light and contact shadows; it
is not claimed photometrically identical. The emitted abdomen remains luminous;
the separate link lens remains dark while power is visibly lit.

The browser assembled stage uses architecture + **ten actual prop files** + the
two characters. It hides the full reference GLB, preventing duplicated geometry.
The authored placement table preserves source coordinates and avoids applying the
lift's baked parent scale twice. Individual prop exports were also rendered in a
gallery for inspection.

## Corrections made from observed failures

- The first room source had coplanar tiles/foundation producing dark patches. The
  foundation was lowered; source/browser renders now show distinct floor tiles.
- The lift crown initially clipped the top of the fixed frame. Its height and
  position were adjusted without changing camera or registered hotspot anchors.
- The first apprentice studio framing clipped head/feet; final framing includes
  the complete body. Hip and knee joint forms were added after inspecting the
  quarter-walk pose to remove exposed articulation gaps.
- Photon's raised reaction wings clipped an initial close-up; final inspection
  camera includes the complete reaction silhouette. The room camera did not change.
- NLA strips initially began atframe1 and exported a one-frame hold before motion.
  Final strips begin at0 and export exact4/1/1.25second durations.
- The first TLS harness served a self-signed CA directly and Firefox rejected it
  with `SSL_ERROR_UNKNOWN`. A proper separate CA/SAN leaf and isolated trust passed;
  certificate bypass was never enabled.
- A first screenshot captured the previous WebGL frame after its label updated.
  Two animation-frame waits now precede captures; corrected Photon captures show
  Photon. The stale capture was not treated as visual evidence.
- A first numeric pose probe read stale viewport matrices. Native render-graph
  callbacks now capture the actual rendered transforms; all meshes match browser
  samples within the measured error above.
- The first candidate schema audit rejected overlong `model.axes` strings. The
  concise field now fits32characters; full mapping remains in source settings.

## Limits and next integration work

This is an asset harness, not the T066 game. It does not establish keyboard/touch
interaction, action/state agreement, media acceptance, final lighting, actual
Safari, FPS/load budgets, traversal foot planting, reduced-motion/hidden-tab
behavior, or owner satisfaction. No source rendered text is essential evidence;
real labels/state-driven power/link materials and semantic controls remain the
presentation task. No accepted asset quantity or gate is inferred from these checks.

Sources, scripts/settings, camera/registration, placements, native/import/browser
observations and disjoint manifest candidates are under `assets-src/rooms/` and
`assets-src/characters/`. Every JSON below this evidence directory is one actual
AssetEvidenceRecord. Raw process logs, failed attempts and displaced `.blend1`
autosaves stay under ignored `.local/T063/`.
