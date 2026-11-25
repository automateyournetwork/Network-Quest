# Contributing to Network Quest

Read [the constitution](.specify/memory/constitution.md), [AGENTS.md](AGENTS.md)
and the current feature contracts before changing behavior. Follow the active
implementation handoff and task order. Describe the requirement addressed, the
change and actual verification. Preserve other work and report untested gates.
Contributing does not authorize publication, a new episode or external messages.

## Contribution licenses and credit

By intentionally submitting original code or build scripts for inclusion, you
offer your contribution under [Apache-2.0](LICENSE). By intentionally submitting
original documentation, writing, Blender sources, imagery, audio or other media
for inclusion, you offer the rights you control under [CC BY 4.0](LICENSE-ASSETS).
You retain your ownership; no assignment of copyright is required. These licenses
permit modification, redistribution and commercial reuse under their terms.

Identify yourself as you wish to be credited and identify what you authored.
Only contribute material you have authority to license, including any necessary
employer permission. State any exclusions before acceptance; maintainers cannot
accept an incompatible restriction into the permissive release. Preserve existing
copyright, patent, attribution and license notices, indicate changes as the
applicable license requires, and retain original authors' credit. Do not add a
noncommercial, no-derivatives or field-of-use restriction to project-owned work.

Third-party contributions need their actual license and source at the chosen
revision, attribution, any modifications and a documented distribution decision.
A dependency's license metadata alone is not its complete notice set. Preserve
bundled third-party notices. MPL files and their modifications remain MPL; they
are not relicensed under Apache-2.0. See [dependency notices](THIRD-PARTY-NOTICES.md).

Arcade catalogs, historical Sierra/PC Globe materials, websites, search results
and reference images are research sources unless a specific reuse basis is
verified. Do not submit extracted scripts, media, characters or binaries merely
because they can be viewed or downloaded. Do not copy the closed website.

## Media and generated contributions

Include the stable asset ID, creator/contributor credit, source files, optimized
exports, checksums, intended placement and license/attribution record. Editable
Blender scenes and audio projects must really reopen. Retain accepted source
images, layered edits, masters, MIDI/recordings where applicable and export lineage.
Per-file exceptions take precedence over a folder's general license description.

For generated material, record the actual tool, generation date, exact prompt,
reference inputs and their separate rights, original output, known settings and
model metadata, human edits and applicable output-terms URL/version. Say unknown
when a seed or model identifier is unavailable. Record rights to submit references
to the service as well as rights for downstream redistribution; neither is
established by a reference's public URL. Retain AI-origin disclosure and distinguish
generated output from a Blender render, synthesis, recording or human edit.

The CC BY offer covers only project-controlled rights. AI output may be similar
to others' output and may lack protectable copyright; the project does not claim
exclusivity or a blanket non-infringement warranty. Do not impose copyright-license
conditions on portions for which no licensable rights exist. Copyright licensing
does not clear another person's likeness, privacy, trademark or other rights.
Keep uncertain material out of the accepted release until the issue is resolved.

Review each image for source/rights issues, originality, technical accuracy and
visual quality; listen to audio and record real review evidence. A terms review,
hash check or waveform inspection cannot replace asset acceptance. The current
[OpenAI review](docs/evidence/spec001/licensing.md#openai-production-image-terms)
supports the production workflow conditionally; it is not per-image clearance.
Players receive reviewed media and need no generation account or API key.

## Public sources and large files

Authored sources remain public and retrievable. Small sources belong in the
repository. Before accepting a source too large for ordinary Git, arrange either
public Git LFS storage or a versioned public source archive attached to the same
release, with anonymous access and no expiring/private URLs. No such archive is
published by this setup task. A local ignored file is not public source delivery.

Commit a source manifest beside the asset record containing its stable ID,
repository-relative destination, original filename/format, byte size, SHA-256,
license/credit, immutable revision/release and exact public retrieval URL. Include
all linked textures, rigs, fonts, layers, stems and other editable dependencies
whose redistribution is authorized. Record tool versions and how to reopen/export.
Document any separately licensed inputs without promising rights the project lacks.

Before release, download each external source anonymously in a clean directory,
verify its size/hash, reopen it with the recorded tool and prove the export/build
without the closed website or the author's machine. Keep a public mirror if an
upstream source becomes unavailable. Broken, private or missing sources block
acceptance. Do not count files solely because a manifest exists.

Models and installed production tools are separate upstream dependencies. Retain
pinned repository revisions, hashes, licenses and retrieval instructions rather
than committing local runtimes, virtual environments or multi-gigabyte caches.
See [media feasibility provenance](assets-src/feasibility/README.md) and
[dependency retrieval](THIRD-PARTY-NOTICES.md). If distributing a tool/model itself,
audit that distribution separately and satisfy its complete license obligations.

## Private data and verification

Never contribute credentials, OAuth secrets/tokens, private configuration, account
or player data, sessions, database dumps, backups, logs containing private data,
or private website code. Use synthetic fixtures and public example configuration.
Keep real configuration/data outside the document root and source tree. Ignore
rules are a safeguard, not proof: review the actual staged files and final release
contents, including tracked files that ignore rules cannot exclude.

For dependency updates, refresh `licenses/dependency-inventory.json` and preserved
notices from the actual locks/installations, review new terms and recheck source
retrieval. Include only the checks relevant to the change and name remaining human
reviews. Release packaging must deliver the notices for what it actually ships;
the current inventory is not a release acceptance certificate.

Copyright 2026 John Capobianco. Original text: CC BY 4.0.
