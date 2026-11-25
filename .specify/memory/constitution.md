<!--
Sync Impact Report
Version change: 0.1 (kickoff; normalized 0.1.0) → 0.2.0
Previous Spec Kit constitution: unfilled template; imported from CONSTITUTION.md.
Bump rationale: MINOR; governance and delivery guidance expanded, without removing
or redefining the owner's product commitments.
Modified principles:
- C1. Purpose and audience → same title; binding requirements made explicit.
- C2. Fixed project boundaries → same title; original kickoff separated from Spec Kit setup.
- C3. Scope grows by tested episodes → same title; release scope made explicit.
- C4. Experience commitments → same title; interaction requirements made explicit.
- C5. Authentic media → same title; production requirements made explicit.
- C6. Accounts and persistence → same title; host and save requirements made explicit.
- C7. Interview decisions → same title; 25 decisions retained with traceability rules.
- C8. One connected world, seven realm contracts → same title; continuity made explicit.
- C9. Learning, agency, and fair consequences → same title; requirements made explicit.
- C10. Technical truth and declared models → same title; evidence requirements made explicit.
- C11. Asset quality, source, and provenance → same title; source requirements made explicit.
- C12. One save means one trustworthy save → same title; ownership and stage boundaries clarified.
- C13. Permissive open-source policy → same title; existing license policy retained.
- C14. Access, responsiveness, and honest completion → same title; requirements made explicit.
- C15. Spec-driven execution and changes → same title; traceability made explicit.
Added sections:
- Core Principles (groups the imported C1–C15 rules).
- Project Boundaries and Delivery.
- Development Workflow and Quality Gates.
- Governance (authority, amendment procedure, semantic versioning, compliance).
Removed sections: None of the source principles. Historical refinement records remain
in CONSTITUTION.md; generic template examples and placeholders were replaced.
Templates and guidance:
- ✅ updated: .specify/templates/plan-template.md
- ✅ updated: .specify/templates/spec-template.md
- ✅ updated: .specify/templates/tasks-template.md
- ✅ updated: .specify/templates/agent-file-template.md
- ✅ updated: .agents/skills/speckit-tasks/SKILL.md (constitution-required verification)
- ✅ updated: CONSTITUTION.md (historical-source/current-authority link)
- ✅ updated: SPEC.md (current constitution reference and kickoff context)
- ✅ updated: PLAN.md (current constitution reference and kickoff context)
- ✅ reviewed: .specify/templates/checklist-template.md; no change needed.
- ✅ reviewed: .specify/templates/constitution-template.md; generic scaffold retained.
- Command templates: .specify/templates/commands/ absent; active task guidance checked
  in .agents/skills and installed Git commands checked for applicable references.
- Runtime docs: README.md, docs/quickstart.md, and AGENTS.md absent.
Follow-up TODOs: None for constitution adoption. Host/provider/media/browser checks
remain future implementation gates in PLAN.md, not completed evidence.
-->
# Network Quest Constitution

Copyright 2026 John Capobianco.
Licensed under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).
SPDX-License-Identifier: CC-BY-4.0.

This is the governing constitution for Network Quest, an original educational browser adventure
through the seven OSI realms. It adopts the owner's [kickoff constitution](../../CONSTITUTION.md),
including its 25 interview decisions. Owner: John Capobianco. MUST, MUST NOT, and imperative
requirements are binding. Narrative descriptions explain the intended experience; they do not
waive acceptance evidence.

## Core Principles

### C1. Purpose and audience

Network Quest MUST help teenage and adult beginners learn networking by observing evidence, making
decisions, seeing consequences, and validating repairs. It MUST provide optional technical depth
for practicing engineers. The player is an apprentice network engineer, with playable packet
journeys that make encapsulation visible. The long-term reward is the fictional title of Network
Engineer; it is not professional certification.

The world combines magical wonder and science-fiction absurdity: warm, witty, strange, and
occasionally dangerous. King's Quest and Space Quest inform adventure pacing, exploration,
narration, and inventory interaction. Network Quest has original characters, writing, art, music,
and implementation.

### C2. Fixed project boundaries

- The public project MUST remain
  [automateyournetwork/Network-Quest](https://github.com/automateyournetwork/Network-Quest).
- Distribution MUST be a browser game discoverable at
  [automateyournetwork.com/arcade/](https://automateyournetwork.com/arcade/), hosted on the
  owner's existing GoDaddy server.
- The public game MUST build independently of the closed-source website. Website integration
  consumes a versioned game build through a documented boundary.
- The original 2026-11-24 kickoff delivered `CONSTITUTION.md`, `SPEC.md`, and `PLAN.md`. The
  owner-authorized Spec Kit setup adds this constitution and aligned templates. Build scripts,
  game source, media, license files, and later episode documents remain implementation work.
- Completing governance or planning documents MUST NOT automatically initiate game implementation
  or website publication. The owner initiates those stages.

### C3. Scope grows by tested episodes

Spec001 MUST deliver the Physical Layer / Underworld first, with many finished substages.
Specs002–007 subsequently develop Layers 2–7. They share a world, protagonist, notebook,
inventory, compendium, and save contract. Later episodes may add doors, quests, and return visits
to earlier areas.

Do not advance to another episode merely because a schedule or iteration count expires. Complete,
test, refine, and obtain the owner's satisfaction with the current episode. Later-layer previews
MUST distinguish a future-content boundary from a puzzle the player can solve now.

Spec001 MUST target a 1–2 hour first main-story playthrough and deliver 12 detailed rooms within
the requested 10–12 range, at least 25 distinct character models, and at least 150 distinct
reusable props. Side quests, investigation, team experiments, and alternate outcomes add replay
time. Counts describe finished in-game assets, not files, recolors, duplicate instances, or
invisible filler.

### C4. Experience commitments

The game MUST provide Walk, Look, Talk, and Use verbs, inventory combinations, keyboard
equivalents, readable dialogue, and classic composed adventure rooms. Mix exploration and
conversation, evidence-based diagnostics, and encounters using recruited protocol creatures.
Include optional minigames and side quests.

Blend discovery, guided instruction, and realistic diagnostic practice. The owner's approximate
30/30/30 expresses balance, not a rigid quota. A persistent notebook carries observations,
objectives, hypotheses, hints, and unresolved leads between rooms. The compendium supports
illustrated discovery, recruitment, and meaningful ability progression.

Use a shared main story with alternative solutions, chapter consequences, and a personalized
epilogue. Failure can be funny, dramatic, or consequential; explain why a route closes and how to
retry differently. Do not quietly trap the only saved game in an unwinnable state.

### C5. Authentic media

The media pipeline MUST combine detailed Blender models and scenes, real-time 3D, rendered room
plates, sprite animation, and actual OpenAI-generated images. Preserve the classic room
composition and interface while allowing modern, surreal imagery. Maintain one coherent art
direction across these techniques.

Music and effects are modern and AI-assisted, with Sound Blaster/MIDI influences. Use free/local
TTS for selected narrator and key-character lines only after an audition establishes quality.
Every spoken line remains available as text. Generation is a production activity; players need no
model account or API key.

### C6. Accounts and persistence

The game MUST allow a guest introduction and offer both Google and GitHub sign-in to save.
Maintain one logical account save slot, manually replaceable at safe moments, with optional
autosave disabled by default. Autosave updates the same slot. Account progress MUST survive
reload, logout, deployment, and changing devices.

The game MUST use the existing GoDaddy host with a dedicated game backend and database. Never
reuse the website analytics store as the game database. Authentication secrets, access tokens,
sessions, player records, and backups are not public source assets.

### C7. Interview decisions

Specifications and plans MUST preserve these 25 recorded decisions and trace them to requirements
and acceptance evidence. Engineering defaults MUST be identified separately. Decision 25 records
the original kickoff deliverables; it does not prohibit the owner-authorized Spec Kit setup.

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

### C8. One connected world, seven realm contracts

Each episode MUST honor its realm contract and preserve shared-world and saved-progress
continuity.

| Specification | Realm | Educational responsibility |
| --- | --- | --- |
| Spec001 | The Underworld / Physical | Signals, media, physical compatibility, impairment, restoration |
| Spec002 | The Iron City / Data Link | Local frames, switching, addressing boundaries, loops, segmentation |
| Spec003 | The Endless Wilderness / Network | Logical addressing, forwarding, routing, reachability |
| Spec004 | The Great Crossing / Transport | Delivery, ordering, reliability, ports, flow and congestion |
| Spec005 | The Gateway Realm / Session | Conversation state, establishment, continuity, recovery |
| Spec006 | The Mirror Realm / Presentation | Representation, encoding, compression, cryptographic trust |
| Spec007 | The Citadel / Application | End-user services and interdependent service diagnosis |

These are teaching homes, not assertions that every modern technology belongs exclusively to one
OSI layer. Cross-realm characters MUST name their actual dependencies and behavior. The Shadow
Highways and automation/agent guild remain expansion directions until separately specified. A
completed realm can be revisited; new dependencies MUST never require unavailable future content
to finish a released episode.

The long-term cast pairs realm guardians with legendary helpers: Titan/Photon, Switchmaster/ARP
Seal, Pathfinder/BGP Border Guardian Phoenix, Quartermaster/TCP Courier Pigeon, Gatekeeper/Nexus,
Alchemist/TLS Locksmith Sovereign, and Archmage/DNS Naming Sage. The Outage manifests as The
Severed, The Recursive, The Lost, The Unreachable, The Forgotten, The Corrupted and The Fallen.
These are narrative foundations for later specifications; each manifestation is resolved through
diagnosis, remediation and validation. Reconcile alternate animal designs in the source
inspiration through explicit variants rather than inconsistent character identity.

Give rooms, characters, objectives, inventory items, abilities, and notebook facts stable IDs.
Adding an episode MUST preserve prior achievements and explain changes to the world. An extended
room MUST NOT move a player's saved position into a wall, remove a required unique item, or
silently reinterpret a completed objective.

### C9. Learning, agency, and fair consequences

Every mandatory objective MUST connect a player action to an observable networking outcome. A
technically wrong action may advance a failure story, but MUST never be labeled a correct
engineering solution. Permit equivalent valid solutions. Make the relevant evidence inspectable
without guessing an author's preferred wording.

Hints progress from method to worked step to solution. Record assistance separately from
completion; do not punish asking for help or shame beginners in an ending. A guessed correct
action is not evidence of independent understanding. Optional transfer problems can provide
stronger learning evidence.

Do not require reflex timing, combat dexterity, a countdown, or a minigame score to complete the
main lesson. Pause tactical encounters for decisions. Dramatic danger remains possible through
narrated choices and consequences.

Warn before a consequential route-closing action; explain its result and recovery path. A safe
return to preparation MUST remain possible before the encounter is committed. Losing never
silently overwrites the sole recoverable save. A technical success, temporary workaround,
deliberate safe shutdown, and unresolved fault MUST be distinguishable outcomes.

### C10. Technical truth and declared models

Every scored networking rule MUST have an authoritative reference, a precise scoped model, and
independently checked correct, incorrect and boundary cases before implementation. A malformed or
unsupported challenge is an authoring error, not a learner failure. Fictional numeric profiles
MUST be labeled as such; do not attribute invented thresholds to a standard or a vendor.

The OSI realms are a conceptual teaching device. Encapsulation does not mean that all seven layers
always add independent wire headers. Modern protocol stacks and cross-layer technologies require
explicit caveats. Layer 1 transmits signals representing bits; it does not resolve an IP address,
learn a MAC address, select an IP route, or verify an application login.

The playable packet perspective is a required teaching mechanic. Spec001 makes the physical
send/receive transformation interactive and provides clearly labeled context for the upper stack.
Later episodes extend that same journey through their actual mechanisms; the first episode MUST
NOT present unimplemented higher layers as a working network simulation.

Do not equate link-up with end-to-end service health, signal strength with guaranteed throughput,
two bits per symbol with two useful bits per second, or optical propagation modes with independent
guaranteed data channels. Hardware compatibility and media limits depend on the declared physical
profile. A power indicator and a data link are different observations.

Charisma, defense and other RPG attributes are fictional balancing values and MUST be labeled
accordingly. No character description or upgrade may teach false technical behavior merely to make
a puzzle easier. A correction to educational content is a release-quality issue, with affected
saved progress handled explicitly.

### C11. Asset quality, source, and provenance

Every counted 3D character and prop MUST have editable Blender source, a stable asset ID, an
optimized usable export, attribution/license information, and an observed placement in the game.
Original modeling scripts may accompany the `.blend` source; scripts or screenshots alone do not
substitute for an actual saved and reopened model. Shared rigs are welcome; recolors and duplicate
instances do not inflate the count.

Generate promised AI imagery through an actual image-generation tool. Record the prompt,
references, output, and known generation metadata. Label Blender renders, procedural graphics,
hand edits and AI outputs truthfully. Store accepted source images and layered derivatives with
the project; never ship a reference to a private temporary asset location.

Produce audio as reviewed files on the Mac. Distinguish model-generated audio, AI-assisted
composition, synthesis, recording, and editing. A model's name in a filename is not evidence that
generation occurred. Keep editable projects, source recordings or MIDI where applicable, rendered
masters and web exports. Audition music, effects and voices; do not claim an audible quality check
from waveform inspection alone.

The asset inventory is a quality contract as well as a quantity contract. It MUST reject missing
sources, unlicensed imports, broken exports, absent runtime references, padded counts and repeated
placeholder forms. Complete the agreed abundance through staged production; do not silently reduce
it to fit a convenient demo.

### C12. One save means one trustworthy save

The server MUST own account identity and save revision. A client-supplied account identifier
cannot choose whose progress is read or written. Concurrent tabs/devices MUST NOT silently
overwrite each other. Failed, interrupted or conflicting writes leave the last confirmed save
intact and show an honest status.

Autosave requires explicit opt-in, displays that it replaces the same slot, and runs only at safe
state boundaries. Never autosave a terminal failure, an incomplete transition or a half-applied
migration. Keep Restore Save distinct from temporary in-memory encounter retry. Operational
backups protect the service; they are not extra player-selectable save slots.

Authenticate through reviewed provider flows and server-side validation. Request only identity
information needed to sign in; do not request a player's repositories, contacts or unrelated
account access. Do not merge identities because their email addresses match. Provide logout and
deletion controls and a plain explanation of saved data.

Planning authorizes a design for the existing host, not an implicit deployment. Credentials,
provider registration and live configuration remain deployment inputs; do not pretend a provider
or game database is configured because the server exists.

### C13. Permissive open-source policy

Original project materials MUST permit modification, redistribution and commercial reuse with
appropriate credit, to the extent the project controls those rights. Apply
[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0) to original game code and build scripts,
and [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) to these documents and original game
writing, Blender sources, imagery and audio to the extent the project controls those rights.
Retain required notices, identify changes where applicable, and preserve third-party licenses
rather than relabeling their work. Add complete license texts and attribution manifests when
implementation begins; the original kickoff and this constitution carry their documentation
license in each file.

A generated asset's provenance, applicable tool/output terms and any incorporated reference
material MUST be recorded. Do not claim exclusive copyright over material where it is not
established. Contribution acceptance MUST permit the declared downstream reuse. Do not introduce a
noncommercial-only asset into the permissive release by accident.

The 28 arcade games are references with individual owners and licenses. Inspect the actual license
and asset provenance at the chosen revision before reusing a component. A catalog label is a lead,
not a completed rights review. The closed website, private hosting inputs, user databases and
credential files are not source material for the public repository.

Publicly viewable historical Sierra and PC Globe materials inform research into interaction, state
and presentation. Public availability alone does not establish a reuse license. Network Quest MUST
NOT bundle original game scripts, extracted media, characters or binaries without a verified basis
for that specific material. Implement the desired adventure behavior originally and record any
properly licensed dependencies.

### C14. Access, responsiveness, and honest completion

All essential information and actions MUST remain available through labeled keyboard-accessible
controls and text. Color, animation, sound, hover and precise pointing cannot be the only way to
solve a mandatory objective. Respect reduced motion, offer text scaling, captions, volume controls
and skip/replay for narration. A quiet or low-detail mode MUST still teach the same rule.

The user selected browser delivery but did not choose a specific device matrix. The initial
engineering baseline is desktop/laptop browsers, including Mac Safari; responsive layout and touch
affordances are required, while full phone/tablet performance remains to be demonstrated before
advertised. Do not invent a requirement for a native app.

Performance targets belong in the specification and are measured on recorded hardware, browser and
network conditions. Load assets by room and make failures recoverable. Never trade away readable
evidence or the agreed source-asset requirements to conceal a budget failure.

An episode is done when its acceptance evidence passes, learning content is checked, assets are
inspected/listened to, and the owner is satisfied with the experience. Tests, visual review,
listening and human play each answer different questions. Report failures and untested areas
plainly; a checked box or iteration total is not release evidence.

### C15. Spec-driven execution and changes

Every feature MUST trace each relevant interview decision through a constitutional rule,
observable specification requirement, build package and verification evidence. Keep product
behavior in SPEC.md and implementation choices in PLAN.md. Resolve contradictions in that order;
do not quietly weaken the constitution to fit an implementation.

For a material change, record its motivation, affected requirement IDs, effects on
rooms/assets/teaching/save data, implementation work and acceptance checks. User changes supersede
earlier assumptions; propagate them through the affected documents. Identify engineering defaults
as defaults, not answers the owner gave.

The initial 30 refinement passes consist of 10 documented assessments and improvements per file.
Their completion ends the documentation task; it does not start implementation or certify the
game. Future build loops assess evidence, make a concrete improvement, verify it and record the
result. Restating a goal or increasing a counter is not useful progress.

## Project Boundaries and Delivery

- The project MUST retain the public repository `automateyournetwork/Network-Quest` and browser
  distribution through `automateyournetwork.com/arcade/` on the owner's existing GoDaddy host. A
  public checkout MUST build without the closed website; integration MUST consume a versioned game
  build through a documented boundary.
- Spec001 MUST meet the 12-room, 25-character-model, and 150-distinct-prop commitments. A graybox,
  prototype, or independently testable story is an intermediate increment, never evidence that the
  episode is complete. Specifications may add concrete media quotas; plans MUST NOT silently
  reduce them.
- Players MUST NOT need a model account or API key. Image, audio, and voice generation are
  production activities. The runtime MUST consume reviewed media, and essential spoken information
  MUST remain available as text.
- Dedicated game services and storage MUST remain separate from website analytics. Public source
  and release packages MUST exclude private website files, credentials, tokens, sessions, player
  records, and backups.
- Desktop/laptop browsers, including Mac Safari, are the initial engineering baseline. Responsive
  controls and touch affordances are required. Phone/tablet performance MUST be demonstrated
  before support is advertised. Runtime versions, host capacity, authentication configuration, and
  media quality MUST be verified during implementation rather than inferred from kickoff notes.
- The 2026-11-24 three-file kickoff is historical scope. This constitution update authorizes
  governance and template maintenance. Game implementation and publication remain separately
  initiated stages; completing a document or a refinement counter MUST NOT trigger them.

## Development Workflow and Quality Gates

1. **Trace the work.** Every specification MUST map relevant C1–C15 rules and interview decisions
   to observable requirements, build work, and acceptance evidence. Root `SPEC.md` and `PLAN.md`
   remain the current Spec001 contracts. Future Spec Kit feature documents under `specs/` MUST
   reference and preserve their IDs and requirements; a later explicit migration MUST identify the
   authoritative replacement and update links rather than maintain competing specifications.
2. **Check the constitution.** Plans MUST record PASS, FAIL, or justified N/A for each applicable
   constitutional gate before research and again after design. PASS means the proposed design
   satisfies the rule; it MUST NOT imply an unrun runtime check passed. Any conflict MUST be
   resolved in the design or through an explicit owner-directed amendment before dependent
   implementation.
3. **Prove the teaching model.** Before implementing a scored rule, record its authoritative
   source, declared model and limitations, and independently checked correct, incorrect, and
   boundary cases. Task lists MUST include the tests and content reviews needed to prove those
   cases. Implementation-generated expected answers cannot serve as independent evidence.
4. **Prove state and persistence.** Changes affecting accounts, saves, shared content, or episodes
   MUST include ownership, failure, conflict, retry, and migration checks appropriate to their
   impact. Spec001 MUST satisfy the existing SAVE01–12 cases and preserve one recoverable slot.
   Mock identity tests do not prove real Google/GitHub sign-in or cross-device restoration.
5. **Prove assets and access.** Media work MUST include source/export/license/use audits plus
   visual inspection, Blender reopening, and listening as applicable. Interface work MUST include
   keyboard/text, reduced-motion, readable/scalable presentation, and relevant browser checks.
   Performance evidence MUST identify hardware, browser, network conditions, and measured results.
6. **Pass the episode gates.** Work MUST follow the evidence sequence in `PLAN.md`: G0
   feasibility; G1 playable diagnostic; G2 identity/save/world structure; G3 representative
   finished room; G4 complete gameplay; G5 full media library; G6 whole-episode validation and
   refinement; G7 independent packaging and release recovery. Failed gates require rework. Later
   episodes MUST wait for completion, testing, refinement, and the owner's satisfaction with the
   current episode.
7. **Report evidence honestly.** Reviews MUST distinguish planned, executed, passed, failed, and
   unverified checks. Spec001 release requires AC01–21 evidence, technical review, human play,
   reviewed media, and owner satisfaction. Human learning, visual quality, and audible quality
   MUST NOT be certified by automated tests alone. A refinement pass MUST record an assessment,
   concrete improvement, verification result, and remaining issue.

## Governance

This file is the current constitutional authority. `CONSTITUTION.md` preserves the 2026-11-24
kickoff and interview/refinement history; it is not a competing current constitution. Product
behavior belongs in specifications and implementation choices in plans. The precedence is the
owner's current explicit direction, this constitution, the applicable specification, the plan,
then tasks and implementation. A user-directed change MUST be propagated to affected contracts;
contributors MUST NOT silently weaken a higher-level requirement to fit existing code.

Amendments MUST record the motivation, affected C/requirement IDs, changes to
rooms/assets/teaching/save data, implementation or migration work, and acceptance checks. An
explicit owner instruction to amend is authorization for that change; do not invent a second
approval step. A contributor-proposed material change requires the owner's agreement before
adoption. Update the constitution, dependent templates and guidance, and affected
specifications/plans together, with a Sync Impact Report naming updated and pending files.

Versions MUST use MAJOR.MINOR.PATCH. Increment MAJOR for incompatible removals or redefinitions of
principles or governance, MINOR for new principles/sections or materially expanded guidance, and
PATCH for non-semantic clarifications or corrections. The source's `0.1` kickoff is treated as
`0.1.0`; this `0.2.0` adoption expands governance and execution guidance while preserving product
commitments. Preserve the original ratification date, and change Last Amended only when the
constitution changes. Dates MUST use YYYY-MM-DD.

Every feature review and pull request MUST check applicable principles and link the corresponding
acceptance evidence. Review MUST flag unmet requirements and unverified gates instead of marking
them complete. A complexity justification or N/A entry MUST NOT waive a constitutional
requirement; a conflicting change requires an explicit amendment. Before each episode release,
recheck learning accuracy, media provenance and quality, accessibility, persistence/migration
safety, independent builds, and owner satisfaction.

**Version**: 0.2.0 | **Ratified**: 2026-11-24 | **Last Amended**: 2026-11-25
