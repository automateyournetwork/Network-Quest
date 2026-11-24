# Network Quest — Project Constitution

Version 0.1 · Kickoff · 2026-11-24 · Owner: John Capobianco

Copyright 2026 John Capobianco. This document is licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). SPDX-License-Identifier: CC-BY-4.0.

This document governs Network Quest, an original educational browser adventure through the seven OSI realms. Read it before [SPEC.md](SPEC.md), which defines Spec001, and [PLAN.md](PLAN.md), which defines the build sequence. These are planning contracts; no playable game, assets, account service, or deployment is delivered by this kickoff.

## C1. Purpose and audience

Help teenage and adult beginners learn networking by observing evidence, making decisions, seeing consequences, and validating repairs. Provide optional technical depth for practicing engineers. The player is an apprentice network engineer, with playable packet journeys that make encapsulation visible. The long-term reward is the fictional title of Network Engineer; it is not professional certification.

The world combines magical wonder and science-fiction absurdity: warm, witty, strange, and occasionally dangerous. King's Quest and Space Quest inform adventure pacing, exploration, narration, and inventory interaction. Network Quest has original characters, writing, art, music, and implementation.

## C2. Fixed project boundaries

- Public project: [automateyournetwork/Network-Quest](https://github.com/automateyournetwork/Network-Quest).
- Distribution: a browser game discoverable at [automateyournetwork.com/arcade/](https://automateyournetwork.com/arcade/), hosted on the owner's existing GoDaddy server.
- The public game must build independently of the closed-source website. Website integration consumes a versioned game build through a documented boundary.
- This kickoff creates exactly `CONSTITUTION.md`, `SPEC.md`, and `PLAN.md`. Build scripts, source, media, license files, and later episode documents are future implementation work.
- No game implementation or website publication follows automatically from completing these documents. The owner will initiate the build/specification work next.

## C3. Scope grows by tested episodes

Spec001 delivers the Physical Layer / Underworld first, with many finished substages. Specs002–007 subsequently develop Layers 2–7. They share a world, protagonist, notebook, inventory, compendium, and save contract. Later episodes may add doors, quests, and return visits to earlier areas.

Do not advance to another episode merely because a schedule or iteration count expires. Complete, test, refine, and obtain the owner's satisfaction with the current episode. Later-layer previews must distinguish a future-content boundary from a puzzle the player can solve now.

Spec001 targets a 1–2 hour first main-story playthrough, 12 detailed rooms within the requested 10–12 range, at least 25 distinct character models, and at least 150 distinct reusable props. Side quests, investigation, team experiments, and alternate outcomes add replay time. Counts describe finished in-game assets, not files, recolors, duplicate instances, or invisible filler.

## C4. Experience commitments

Use Walk, Look, Talk, and Use verbs, inventory combinations, keyboard equivalents, readable dialogue, and classic composed adventure rooms. Mix exploration and conversation, evidence-based diagnostics, and encounters using recruited protocol creatures. Include optional minigames and side quests.

Blend discovery, guided instruction, and realistic diagnostic practice. The owner's approximate 30/30/30 expresses balance, not a rigid quota. A persistent notebook carries observations, objectives, hypotheses, hints, and unresolved leads between rooms. The compendium supports illustrated discovery, recruitment, and meaningful ability progression.

Use a shared main story with alternative solutions, chapter consequences, and a personalized epilogue. Failure can be funny, dramatic, or consequential; explain why a route closes and how to retry differently. Do not quietly trap the only saved game in an unwinnable state.

## C5. Authentic media

Combine detailed Blender models and scenes, real-time 3D, rendered room plates, sprite animation, and actual OpenAI-generated images. Preserve the classic room composition and interface while allowing modern, surreal imagery. Maintain one coherent art direction across these techniques.

Music and effects are modern and AI-assisted, with Sound Blaster/MIDI influences. Use free/local TTS for selected narrator and key-character lines only after an audition establishes quality. Every spoken line remains available as text. Generation is a production activity; players need no model account or API key.

## C6. Accounts and persistence

Allow a guest introduction. Offer both Google and GitHub sign-in to save. Maintain one logical account save slot, manually replaceable at safe moments, with optional autosave disabled by default. Autosave updates the same slot. Account progress must survive reload, logout, deployment, and changing devices.

Use the existing GoDaddy host with a dedicated game backend and database. Never reuse the website analytics store as the game database. Authentication secrets, access tokens, sessions, player records, and backups are not public source assets.

## C7. Interview decisions

| Question | Recorded decision |
| --- | --- |
| 01 | Teen/adult beginners, optional depth for engineers |
| 02 | Physical Layer first as Spec001; seven dedicated realm specifications; connected episodes; revisit and improve earlier content |
| 03 | 1–2 hour first main playthrough |
| 04 | Apprentice engineer plus playable packet journeys |
| 05 | Warm, witty, strange; danger and networking humor |
| 06 | King's Quest wonder mixed with Space Quest science and absurdity |
| 07 | Point-and-click Walk/Look/Talk/Use, inventory, keyboard equivalents |
| 08 | Connected areas and gated progress as described in answer 02 |
| 09 | Exploration, investigation, creature encounters, optional minigames/side quests |
| 10 | Balanced discovery/instruction/diagnostic practice; persistent notebook |
| 11 | Compendium discovery, recruitment, and progression |
| 12 | Shared story, alternate routes, chapter outcomes, personalized epilogue |
| 13 | Mixed failure styles; explain closed paths and how to retry differently |
| 14 | Mix real-time 3D, rendered rooms, sprites, and OpenAI imagery |
| 15 | Modern 3D/AI detail with classic adventure composition and UI |
| 16 | 10–12 rooms, 25 character models, 150 distinct reusable props |
| 17 | Generated scenery and illustrated assets alongside Blender |
| 18 | Retro musical influence, modern AI-assisted production |
| 19 | Narrator/key-character TTS, free/local subject to audition |
| 20 | Browser game in automateyournetwork.com/arcade; specific device guarantees were not selected |
| 21 | Guest introduction; Google/GitHub sign-in for saving |
| 22 | One manual save slot; optional autosave opt-in |
| 23 | Existing GoDaddy website host and server access |
| 24 | Permissive remixing and redistribution, including commercial use, with credit |
| 25 | CONSTITUTION.md, SPEC.md, PLAN.md |

## C8. One connected world, seven realm contracts

| Specification | Realm | Educational responsibility |
| --- | --- | --- |
| Spec001 | The Underworld / Physical | Signals, media, physical compatibility, impairment, restoration |
| Spec002 | The Iron City / Data Link | Local frames, switching, addressing boundaries, loops, segmentation |
| Spec003 | The Endless Wilderness / Network | Logical addressing, forwarding, routing, reachability |
| Spec004 | The Great Crossing / Transport | Delivery, ordering, reliability, ports, flow and congestion |
| Spec005 | The Gateway Realm / Session | Conversation state, establishment, continuity, recovery |
| Spec006 | The Mirror Realm / Presentation | Representation, encoding, compression, cryptographic trust |
| Spec007 | The Citadel / Application | End-user services and interdependent service diagnosis |

These are teaching homes, not assertions that every modern technology belongs exclusively to one OSI layer. Cross-realm characters must name their actual dependencies and behavior. The Shadow Highways and automation/agent guild remain expansion directions until separately specified. A completed realm can be revisited; new dependencies must never require unavailable future content to finish a released episode.

The long-term cast pairs realm guardians with legendary helpers: Titan/Photon, Switchmaster/ARP Seal, Pathfinder/BGP Border Guardian Phoenix, Quartermaster/TCP Courier Pigeon, Gatekeeper/Nexus, Alchemist/TLS Locksmith Sovereign, and Archmage/DNS Naming Sage. The Outage manifests as The Severed, The Recursive, The Lost, The Unreachable, The Forgotten, The Corrupted and The Fallen. These are narrative foundations for later specifications; each manifestation is resolved through diagnosis, remediation and validation. Reconcile alternate animal designs in the source inspiration through explicit variants rather than inconsistent character identity.

Give rooms, characters, objectives, inventory items, abilities, and notebook facts stable IDs. Adding an episode must preserve prior achievements and explain changes to the world. An extended room must not move a player's saved position into a wall, remove a required unique item, or silently reinterpret a completed objective.

## C9. Learning, agency, and fair consequences

Every mandatory objective must connect a player action to an observable networking outcome. A technically wrong action may advance a failure story, but must never be labeled a correct engineering solution. Permit equivalent valid solutions. Make the relevant evidence inspectable without guessing an author's preferred wording.

Hints progress from method to worked step to solution. Record assistance separately from completion; do not punish asking for help or shame beginners in an ending. A guessed correct action is not evidence of independent understanding. Optional transfer problems can provide stronger learning evidence.

Do not require reflex timing, combat dexterity, a countdown, or a minigame score to complete the main lesson. Pause tactical encounters for decisions. Dramatic danger remains possible through narrated choices and consequences.

Warn before a consequential route-closing action; explain its result and recovery path. A safe return to preparation must remain possible before the encounter is committed. Losing never silently overwrites the sole recoverable save. A technical success, temporary workaround, deliberate safe shutdown, and unresolved fault must be distinguishable outcomes.

## C10. Technical truth and declared models

Every scored networking rule needs an authoritative reference, a precise scoped model, and independently checked correct, incorrect and boundary cases before implementation. A malformed or unsupported challenge is an authoring error, not a learner failure. Fictional numeric profiles must be labeled as such; do not attribute invented thresholds to a standard or a vendor.

The OSI realms are a conceptual teaching device. Encapsulation does not mean that all seven layers always add independent wire headers. Modern protocol stacks and cross-layer technologies require explicit caveats. Layer 1 transmits signals representing bits; it does not resolve an IP address, learn a MAC address, select an IP route, or verify an application login.

The playable packet perspective is a required teaching mechanic. Spec001 makes the physical send/receive transformation interactive and provides clearly labeled context for the upper stack. Later episodes extend that same journey through their actual mechanisms; the first episode must not present unimplemented higher layers as a working network simulation.

Do not equate link-up with end-to-end service health, signal strength with guaranteed throughput, two bits per symbol with two useful bits per second, or optical propagation modes with independent guaranteed data channels. Hardware compatibility and media limits depend on the declared physical profile. A power indicator and a data link are different observations.

Charisma, defense and other RPG attributes are fictional balancing values and must be labeled accordingly. No character description or upgrade may teach false technical behavior merely to make a puzzle easier. A correction to educational content is a release-quality issue, with affected saved progress handled explicitly.

## C11. Asset quality, source, and provenance

Every counted 3D character and prop must have editable Blender source, a stable asset ID, an optimized usable export, attribution/license information, and an observed placement in the game. Original modeling scripts may accompany the `.blend` source; scripts or screenshots alone do not substitute for an actual saved and reopened model. Shared rigs are welcome; recolors and duplicate instances do not inflate the count.

Generate promised AI imagery through an actual image-generation tool. Record the prompt, references, output, and known generation metadata. Label Blender renders, procedural graphics, hand edits and AI outputs truthfully. Store accepted source images and layered derivatives with the project; never ship a reference to a private temporary asset location.

Produce audio as reviewed files on the Mac. Distinguish model-generated audio, AI-assisted composition, synthesis, recording, and editing. A model's name in a filename is not evidence that generation occurred. Keep editable projects, source recordings or MIDI where applicable, rendered masters and web exports. Audition music, effects and voices; do not claim an audible quality check from waveform inspection alone.

The asset inventory is a quality contract as well as a quantity contract. It must reject missing sources, unlicensed imports, broken exports, absent runtime references, padded counts and repeated placeholder forms. Complete the agreed abundance through staged production; do not silently reduce it to fit a convenient demo.

## C12. One save means one trustworthy save

The server owns account identity and save revision. A client-supplied account identifier cannot choose whose progress is read or written. Concurrent tabs/devices must not silently overwrite each other. Failed, interrupted or conflicting writes leave the last confirmed save intact and show an honest status.

Autosave requires explicit opt-in, displays that it replaces the same slot, and runs only at safe state boundaries. Never autosave a terminal failure, an incomplete transition or a half-applied migration. Keep Restore Save distinct from temporary in-memory encounter retry. Operational backups protect the service; they are not extra player-selectable save slots.

Authenticate through reviewed provider flows and server-side validation. Request only identity information needed to sign in; do not request a player's repositories, contacts or unrelated account access. Do not merge identities because their email addresses match. Provide logout and deletion controls and a plain explanation of saved data.

The kickoff authorizes a plan for the existing host. Credentials, provider registration and live configuration remain deployment inputs; do not pretend a provider or game database is configured because the server exists.

## C13. Permissive open-source policy

The owner's policy permits modification, redistribution and commercial reuse with appropriate credit. Apply [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) to original game code and build scripts, and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) to these documents and original game writing, Blender sources, imagery and audio to the extent the project controls those rights. Retain required notices, identify changes where applicable, and preserve third-party licenses rather than relabeling their work. Add complete license texts and attribution manifests when implementation begins; this three-file kickoff carries its documentation license in each file.

A generated asset's provenance, applicable tool/output terms and any incorporated reference material must be recorded. Do not claim exclusive copyright over material where it is not established. Contribution acceptance must permit the declared downstream reuse. Do not introduce a noncommercial-only asset into the permissive release by accident.

The 28 arcade games are references with individual owners and licenses. Inspect the actual license and asset provenance at the chosen revision before reusing a component. A catalog label is a lead, not a completed rights review. The closed website, private hosting inputs, user databases and credential files are not source material for the public repository.

Publicly viewable historical Sierra and PC Globe materials inform research into interaction, state and presentation. Public availability alone does not establish a reuse license. Network Quest must not bundle original game scripts, extracted media, characters or binaries without a verified basis for that specific material. Implement the desired adventure behavior originally and record any properly licensed dependencies.

## C14. Access, responsiveness, and honest completion

All essential information and actions must remain available through labeled keyboard-accessible controls and text. Color, animation, sound, hover and precise pointing cannot be the only way to solve a mandatory objective. Respect reduced motion, offer text scaling, captions, volume controls and skip/replay for narration. A quiet or low-detail mode must still teach the same rule.

The user selected browser delivery but did not choose a specific device matrix. The initial engineering baseline is desktop/laptop browsers, including Mac Safari; responsive layout and touch affordances are required, while full phone/tablet performance remains to be demonstrated before advertised. Do not invent a requirement for a native app.

Performance targets belong in the specification and are measured on recorded hardware, browser and network conditions. Load assets by room and make failures recoverable. Never trade away readable evidence or the agreed source-asset requirements to conceal a budget failure.

An episode is done when its acceptance evidence passes, learning content is checked, assets are inspected/listened to, and the owner is satisfied with the experience. Tests, visual review, listening and human play each answer different questions. Report failures and untested areas plainly; a checked box or iteration total is not release evidence.

## C15. Spec-driven execution and changes

Trace each interview decision through a constitutional rule, observable specification requirement, build package and verification evidence. Keep product behavior in SPEC.md and implementation choices in PLAN.md. Resolve contradictions in that order; do not quietly weaken the constitution to fit an implementation.

For a material change, record its motivation, affected requirement IDs, effects on rooms/assets/teaching/save data, implementation work and acceptance checks. User changes supersede earlier assumptions; propagate them through the affected documents. Identify engineering defaults as defaults, not answers the owner gave.

The initial 30 refinement passes consist of 10 documented assessments and improvements per file. Their completion ends the documentation task; it does not start implementation or certify the game. Future build loops assess evidence, make a concrete improvement, verify it and record the result. Restating a goal or increasing a counter is not useful progress.

## Refinement record

Each row records one actual assessment, improvement, and document check. These are document reviews, not claims that gameplay tests have run.

| Pass | Assessment and improvement | Verification |
| --- | --- | --- |
| C01 | Replaced workshop-sized defaults with the 25 interview decisions and independent public-project boundary | All 25 answers mapped; selected filenames and scope agree |
| C02 | Defined seven realm contracts and cross-episode continuity rules | Every layer has one specification; future content cannot block Spec001 completion |
| C03 | Added learning evidence, accepted alternatives, assistance handling, and recoverable failure rules | Failure may change the story but cannot be graded as technical success or destroy the only recovery point |
| C04 | Added source-backed technical models and OSI/physical-layer boundaries | Explicitly rejects false layer mappings, fabricated thresholds, and grading authoring errors as mistakes |
| C05 | Defined genuine Blender/image/audio production and counting rules | Source/export/placement evidence required; placeholders, recolors and fabricated generation receipts cannot satisfy quantities |
| C06 | Added account ownership, conflict safety, explicit autosave and identity minimization | One recoverable server slot is preserved across failure, migration and concurrent-device cases |
| C07 | Applied a permissive documentation license and defined code/media/reuse policy | Public project can be reused with credit; private website and unverified historical/game assets remain outside the release |
| C08 | Added browser/accessibility and evidence-based completion rules; preserved the seven-hero/Outage narrative | Device baseline is labeled an engineering assumption; future lore does not expand Spec001 delivery |
| C09 | Added requirement traceability, change control and document/build-loop boundaries | Interview decisions govern defaults; 30 reviews cannot trigger implementation or certify gameplay |
| C10 | Final consistency review strengthened the required packet-perspective mechanic and checked scope against the interview | 25 answers retained; 10 reviews recorded; document-only boundary, permissive licensing and seven-spec continuity agree across all three files |
