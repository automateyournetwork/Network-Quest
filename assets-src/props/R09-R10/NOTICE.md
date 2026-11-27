# Shell Market and Clockworks models

Credit John Capobianco and Network Quest for PR081–PR100. The original models,
GLB exports, mosaic lettering, renders and review material are available under
CC BY 4.0 to the extent of project-controlled rights. Link the license and
identify adaptations. The project includes the complete terms and attribution
in LICENSE-ASSETS and NOTICE. The authoring and verification scripts carry
Apache-2.0.

OpenAI Codex assisted with original procedural modeling and inspection. Blender
5.2.1 LTS built editable geometry and rendered native sources with Cycles. The
project's R05–R06 modeling library supplies sweep, mesh and palette primitives.
The Market and Clockworks have original assemblies, lettering refinements and
inscriptions. All models use material factors and authored geometry. There are
no imported vendor models, fonts, photographs or textures. The browser captures
use Three.js r187 and Firefox 159. The sheet annotations use Pillow's default
font outside the models.

The frozen layouts, approved T063 staging, original character art, art direction
and authored room evidence informed the designs. Finite dimensions are
illustrative. Market accounting applies to the fictional endpoint-delivered
budget. Clockworks inscriptions use its supplied dimensionless teaching map.
Player interaction supplies current readings and validation.

## Reproduction

From the repository root, run Blender with two threads and
`-P assets-src/props/R09-R10/build.py -- 81 ... 100` with each desired integer
as a separate argument. For each saved model, start a fresh background Blender
process with that file and `-P assets-src/props/R09-R10/reopen.py` to render the
native model and produce its GLB. The scripts write the corresponding material
and geometry measurements. Run `browser.mjs` with the pinned Node and all 20
PR identifiers to capture both isolated models and staged rooms. The harness
creates a disposable local CA, profile and HTTPS listener on loopback. It
requires OpenSSL, certutil and the project's pinned Playwright Firefox.

Run `inspect_glb.py` for geometry, `compare.py` with Pillow and NumPy for
paired sheets, and `records.py` after inspecting each result and recording the
findings in `visual-review.json`. Output paths match the frozen allocation.
Reproduction writes to these same paths. Use a separate checkout to preserve
the dated evidence.
