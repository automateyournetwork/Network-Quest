# R01 input permissions and production lineage

This set uses only project-owned creative inputs under the owner's authorized
Network Quest implementation. There are no third-party photographs, historical
game images, logos, real-person likenesses or extracted game assets.

`reference-inputs/blender-staging-v1.png` is an exact copied snapshot of T063's
original Blender render before its floor/cage correction. It was the actual
background generation reference and remains preserved. The corresponding camera
and registration snapshots identify the actual `.blend` hash at that time.
`blender-staging-v2.png` is the corrected T063 source render used for the two alpha
generation calls and the standalone composition review. Both camera/registration
versions preserve identical camera transforms and semantic anchor coordinates;
only the model source hash changes. The later camera-v3/registration-v3 snapshots
bind T063's final native rebuild fingerprint. Its final v3 PNG file hash differs
from v2; fresh pixel comparison found at most one RGB level difference and exactly
equal alpha arrays. All anchor arrays remain identical. V1/v2 remain the actual
invocation references; final registration uses v3. T063 owns the native source and its
separate verification; this image task does not count the reference render as an
OpenAI output or a new room asset.

`originals/background-v1.png` is this project's own actual OpenAI output. It is a
reference input for `midground-v1.png` and `foreground-v1.png`. Each of those is a
separate genuine built-in image-generation invocation, not a hand-made mask
reported as another generation. The exact copied reference and output hashes are
bound in the candidate manifest and production records. The owner's project
authorization and original-work CC BY 4.0 policy cover the supplied project
reference; the applicable own-output terms are summarized with links in the dated
terms review. Only project-controlled rights are offered onward.

No pixel cleanup, painting, masking, cropping, resampling or format conversion was
applied to the generated source or public exports. Export is a byte-for-byte copy.
The browser review composites separate image elements; it does not rewrite the
source pixels. Inspection scripts use in-memory decoded channels/crops only to
measure alpha and produce JSON measurements. Browser screenshots are labeled
review evidence, not additional generated assets. The normalized canvas display
mapping is documented in `registration.json` and does not claim the requested
2048×1152 size was returned.
