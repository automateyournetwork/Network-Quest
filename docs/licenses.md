# Reusing Network Quest

Credit **Network Quest — John Capobianco and contributors** and the creators named on the files you reuse. Include the project URL, the applicable license and a description of your changes. The project licenses its original code and build scripts under Apache-2.0 and offers its original writing, documentation, Blender scenes, images, audio and other creative contributions under CC BY 4.0 to the extent it controls those rights. Attribution grants no endorsement or trademark permission. [Project](https://github.com/automateyournetwork/Network-Quest) · [Attribution notice](../NOTICE) · [Apache-2.0](../LICENSE) · [CC BY 4.0](../LICENSE-ASSETS)

## Find the credit for a particular file

1. Open **Credits** on the title screen or **Game → Credits** in a room. Choose **Media credits and editable sources**. Use the family links or your browser’s Find command to locate an asset ID or export filename.
2. Expand the entry. It lists the supplied creator strings, production disclosure, applicable license IDs, editable inputs and the source/export-bound rights record. Follow the batch notice for attribution, modifications and which terms apply to tools and project-controlled output. Consult the original production record to distinguish generated pixels, Blender renders, mathematical synthesis, model-generated music, TTS and later edits.
3. To obtain a native project, master or original image, use its public source link or the independently verifiable download index. The manifest includes alternate and archived renditions. The standalone full-room Arrival Lift reference model has a separate entry. [Media register](../public/credits/media.html) · [Contributor download instructions](source-retrieval.md) · [Per-asset manifest](../assets-src/manifest.json)

All 398 manifest renditions have documentary rights checks linked to their exact source and export hashes. Media approval and human listening have separate evidence. The game credits describe how the works were produced without attributing a human performance to a synthetic voice. Model- and tool-specific terms and input rights remain attached to each lineage. [Current media audit](evidence/spec001/media-audit.md) · [Distribution notices](../THIRD_PARTY_NOTICES.md)

## Verify the registers

From a public checkout with its locked npm and Composer dependencies installed, run the following commands using the documented Node 26.13.1 toolchain and Python 3.11 or later.

```sh
python3 tools/credit-register.py
node tools/verify-credit-bundle.mjs
```

The Python check verifies the two locks and preserved legal files, compares production notices with the installed bytes, joins every asset to its rights review, and hashes every actual public media export. It reproduces and compares both files under `public/credits/`. A new public asset, stale notice, broken attribution record or uncredited export fails the check. The bundle check performs a production build in memory, verifies which npm modules and emitted helpers enter JavaScript, and checks the build for additional fonts. The browser loads the large reference files only when requested.

Run `python3 tools/credit-register.py --public` to compare every linked project source, permission, notice and rights record with the immutable anonymous GitHub media tree and check that its historical retrieval guide is available. To update a reviewed inventory, use `--write`, inspect the resulting changes and rerun both checks. Preserve previous source revisions and their retrieval paths. Refresh instructions for changes to dependency locks and upstream notices remain in the historical register. Source links use the integrated media checkpoint. The earlier editable-file retrieval snapshot remains publicly available. [Integrated media revision](https://github.com/automateyournetwork/Network-Quest/tree/33db08b7ba26cdcbcac5460229f8cf484c7db5e8) · [Prior retrieval snapshot](https://github.com/automateyournetwork/Network-Quest/tree/59768bf788f9c8609b8687235ca21a2b7942f871) · [Lock and notice refresh](../THIRD-PARTY-NOTICES.md#reproducing-this-register)

Distribute both static files from `public/credits/` with the browser code. Keep production PHP dependency notices with the service, including the Composer autoloader license. Source distributors also retain the complete development/scaffold notices, MPL source pointers and original-work license texts. The generator selects existing public rights records and license files. Account records, backups, local configuration, credentials and the private website have no role in generating credits. [Software and original-work texts](../public/credits/notices.txt) · [Source-checkout obligations](../THIRD-PARTY-NOTICES.md) · [Contribution policy](../CONTRIBUTING.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
