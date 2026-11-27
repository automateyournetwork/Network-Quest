# T093 character authoring evidence

Copyright 2026 John Capobianco. Licensed under CC BY 4.0.
SPDX-License-Identifier: CC-BY-4.0.

Date: 2026-11-27. Worker: `/root/loop105_t093`.
Status: **joined and locally verified; coordinator acceptance pending**.

The [live collection](../../../content/spec001/characters.json) authors the exact CH01–CH25 roster,
including the nine recruits and sixteen other roles. It contains original
descriptions, technologies, ability summaries, limitations, realm dependencies,
discovery and recruitment/progression explanations, reviewed source claims,
model/portrait references, and explicit conventional action equivalents. This
began as isolated preparation under the exception in tasks.md and joined after explicit root GO following T090/T091 acceptance. It implements no party,
compendium, quest, minigame, encounter or display behavior.

The [schema proposal](characters/schema-proposal.patch.json) is restricted to
the existing `character` and `ability` definitions plus one
`characterDemonstration` definition. The
[full candidate schema](characters/content-schema-T093.json.draft) and
[original schema](characters/content-schema-before-T093.json) retain the proposal and exact authoring baseline. The candidate now matches the active schema. Loaded content, generated validator/types, world document references, application loader and generated save policy changed only after GO. The canonical asset manifest was never modified.

## Authored contracts

| Character | Recruit contract / usable progression |
| --- | --- |
| CH01 Apprentice | Playable engineer; no recruit levels or certification claim |
| CH02 Titan | Physical diagnosis mentor; no automatic repair |
| CH03 Photon | Inspect connection/profile; reveal the unmet inspection/compatibility predicate |
| CH04 Copperhead | Compare actual open-before/intact-after; reveal remaining continuity/length checks |
| CH05 Single-Mode Unicorn | Read compatible optical budget; separate sensitivity, overload and reserve |
| CH06 Multimode Hydra | Read compatible optical budget; explain modes versus guaranteed payload channels |
| CH07 Thunderbird | Observe signal/noise/path/settings; compare attributable earlier/later samples |
| CH08 Blue Dragon | Short-range radio exhibit; no Bluetooth simulation or range promise |
| CH09 Red Scorpion | Infrared exhibit with physical/link distinction; no IrDA simulation |
| CH10 Microwave Phoenix | Directional relay context; distinct from the future BGP Phoenix |
| CH11 Celestial Eagle | Ground/space communication perspective; no orbital simulator |
| CH12 Iron Golem | PHY/host/interface mentor; fit does not establish compatibility |
| CH13 Ancient Tortoise | Optional toy serial story; no UART/RS-232 implementation |
| CH14 DSL Mole | Telephone-medium context; identifies actual customer/operator dependencies |
| CH15 DOCSIS Badger | HFC/coax context; explicitly distinguishes PHY and MAC |
| CH16 SFP Hermit Crab | Compare every module/host requirement; explain the unmatched field |
| CH17 QSFP Chimera | Module/host/lane context; no silhouette-based breakout promise |
| CH18 Rainbow Serpent | Wavelength multiplexing context, distinct from propagation modes |
| CH19 Electric Eel | Compare delivered demands/budget; explain headroom/excess separately |
| CH20 Echo Bat | Compare continuity/repeater limits; explain why an unchanged break persists |
| CH21 Metronome Golem | Untimed toy decoding; physical timing is not NTP |
| CH22 Chameleon | Find common advertised modes; explain unsupported/no-common boundaries |
| CH23 Noise Demon | Impairment depiction; not proof of cause or a measured result |
| CH24 Crosstalk Twins | One paired identity; continuity and correct pairing are separate concerns |
| CH25 Backhoe of Doom | Physical-disconnection finale; no health-point solution or false shutdown success |

Recruitable IDs are exactly CH03/04/05/06/07/16/19/20/22. Every recruit has a
basic usable inspection and a distinct level-2 explanation. No attribute number,
new physical capability, changed threshold or source-derived score is invented.
All three main routes retain conventional controls and can run without recruits
or optional rewards. Party capacity remains two; swaps remain free at safe
preparation. These invariants are inherited by T094, not implemented here.

Photon is discoverable in R01, but the optical recruitment demonstration occurs
in the Gardens. Copper and Echo demonstrations span their actual Warrens/Cavern
evidence. Unicorn and Hydra review the existing generic fictional optical
profile; neither silently instantiates a real single-mode or multimode product.
The optical crew can return from R06 to R05 to discuss that evidence. Their
recruitment is optional, so these trips do not gate the main path.

## Why a bounded schema extension is needed

The original character schema required at least one dialogue for every record.
Only Photon and Titan currently have authored character conversations. Assigning
narrator action collections to all other characters would invent conversations
and alter the graph proof’s character-conversation classification. Empty dialogue
lists are used for the other roles; future authored conversations can
be added normally.

The original ability schema required an inventory item equivalent. The only
current authored item is `ITEM-inspection-kit`, whose description explicitly
excludes physical repair, power delivery and service proof. The implemented
conventional equivalents are bench controls and diagnostic actions. The bounded extension
allows an authored usable item **or** authored conventional action, with a
nonempty alternative required. It does not reinterpret the inspection kit.

`profileIds` on abilities, recruitment encounter `roomIds`, and an optional
demonstration record make the intended consumer contract inspectable. Compendium additions supply portrait identity,
equivalent text, discovery and recruitment/progression summaries, and separate
descriptive references. New fields remain optional at the generic schema level
to preserve original authored-record compatibility; the dedicated canonical-roster validator requires them across the complete roster.

The original schema is sealed at
`712297ffb45b2d1fa9abf75ff042ca1c50a58610d077a61cc1dc13688afbb27b`.
T092’s eleven original fixture hashes remain untouched. After coordinator review,
its audit now resolves **only this evolving schema input** to the exact versioned
authoring baseline, checking that baseline’s original hash. Every other input
continues to check current bytes. A separate additive compatibility and actual
content audit checks the new schema. Changing the fixture hash or skipping
its check would erase provenance and is not proposed.

## T094 consumer handoff

`condition` is an eligibility gate, never proof that a demonstration happened.
`demonstration.actionIds` lists relevant implemented steps/alternatives, not an
unconditional instruction to execute every action and not a persistent action
history. The referenced facts include context, observations and measurements;
mere fact membership cannot prove current measurement freshness.

Root resolved the movement/freshness issue explicitly: an accepted historical
demonstration may establish **learning**, never a current repair. The evidence
must have come from a trusted actual canonical evaluation with the appropriate
accepted conclusion and readings, valid for that configuration/attempt when
observed. Moving home or the recruit transition can make its measurement stale
without erasing what the player demonstrated. A copied note, fact membership,
room visit, caller-supplied history or compendium discovery is not such a receipt.

The invitation requires actual discovery/encounter, an explicit choice and an
authored recruitment room from the existing character allocation. No remote
character placement is invented. The draft tells the player that the reviewed
observation is learning evidence, not a current repair reading. An explicit
invitation/review applies a stable once-only transition; no automatic third
active ally appears. Level 2 requires its own distinct post-recruit comparison
or explanation through the party context at the actual bench. Current ability
application always performs fresh canonical checks.

`demonstration.objectiveIds` names canonical measurement provenance. For example,
O05's composite reading uses PHY06 while Photon's scoped ability concerns PHY03;
O04 uses PHY04 while Echo's teaching is PHY05; O09 uses PHY08 while Chameleon addresses its checked capability subset. Hermit now uses O05/OPTICAL because only the optical evaluator checks all five fields required by the frozen T092 oracle. Flat equality with an ability's
rule list would reject genuine demonstrations. The consumer must inspect the
canonical objective and appropriate checked conclusion/readings instead.

Before implementation acceptance, T094 must seal an exact proof lifecycle:
trusted capture only after real validated interaction; acceptance and once-only
review bound to character and content; no manufactured history or reclassification
of an incorrect repair as correct; level-2 sequence strictly after recruitment;
unsafe mutations rejected; Retry/E03 restoring preparation recruitment and levels;
retained learning not silently regranting a rolled-back reward; Restore Save
replacing state atomically; and no second persistent save or hidden checkpoint.
Whether an unreviewed learning receipt is retained across reload must be explicit
and verified. Re-demonstration is preferable to accepting an unprovable receipt.
These lifecycle details are T094 implementation obligations, not passed tests.

The level-2 action lists were refined with the T094 worker: Photon now names
the actual mismatch controls, Copper the original/repaired/boundary paths,
Unicorn the supplied optical loss choices, Thunderbird the actual channel/noise
controls, Hermit the actual optical mismatch fields, Eel the over-budget proposal, Echo the
wrong/correct repeater claims, and Chameleon the unsupported/common selections.
Hydra’s modes explanation is descriptive learning alongside the actual optical
result, not a newly scored modes quiz.

Overload and empty-common-set cases already exist in the reviewed physical
oracle, but are not automatically new selectable production scenarios. The
explanation may describe those limits; no authored character claims a live
scenario has been executed. T094 must not silently add a scored scenario or
fabricate a receipt to satisfy a progression request.

Ability `effects` arrays are empty intentionally. They contain no fixed passing
result, invented configuration change or objective award. Actual ally commands
must delegate to the same evaluated action/result path as conventional tools,
with the same preconditions, observations, freshness and accepted physical
effects. The draft’s recruitment effect is only the already specified
`recruit-character` intent; writing this data does not execute it.

## Source and media boundaries

Existing S01–S13 claims are copied with their exact reviewed sections and
limitations. `sources.json`, original physical cases and T092 fixtures are
read-only. The source register’s human-review limitation remains in force.

Eight additional primary references support **descriptive context only**:

- [Corning optical glossary](https://www.corning.com/optical-communications/worldwide/en/home/products/fiber/optical-fiber-resource-center/glossary-of-terms.html): optical mode terminology for CH05/06.
- [Vishay IrDA protocol note](https://www.vishay.com/docs/82504/protocol.pdf): physical versus link functions for CH09.
- [NASA communications chapter](https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/): ground/space equipment and radio/optical alternatives for CH11.
- [ITU-T G.992.1 summary](https://www.itu.int/itu-t/recommendations/rec.aspx?lang=en&rec=4718): ADSL metallic-loop context for CH14.
- [CableLabs architecture and glossary](https://www.cablelabs.com/tech-vision/tech-policy/informed-insights-whitepapers/driving-gigabit-speeds-from-lab-to-consumer): HFC, DOCSIS PHY/MAC distinction for CH15.
- [Cisco QSFP module data sheet](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-660083.html): module-specific interfaces and host support for CH17.
- [Cisco DWDM overview](https://www.cisco.com/en/US/docs/switches/datacenter/mds9000/sw/nx-os/configuration/guides/fabric/fabric_cli_4_2_published/dwdm_ps5989_TSD_Products_Configuration_Guide_Chapter.html): wavelength multiplexing for CH18.
- [Fluke split-pair explanation](https://www.flukenetworks.com/support/knowledge-base/linkiq/split-pair-identification): continuity versus pairing context for CH24.

These publisher pages were opened on 2026-11-27 and the named sections inspected.
The [context record](characters/context-sources.json) includes narrow original
summaries and explicit limits. No vendor table wattage, range, bitrate, channel
grid, threshold or configuration recommendation enters the physical evaluators.
The references are deliberately outside the scored source-ID namespace.

All 50 model/portrait IDs already exist in the canonical asset manifest. Every
portrait remains **planned**; CH01 and CH03 model entries are integrated but
uncounted, and the other models remain planned. Descriptive text is not a
portrait export, source file, visual review or quota acceptance. The manifest
remains authoritative and was not modified.

## Actual checks and pending work

The prerequisite script returned the absolute spec001 feature directory. The
requirements checklist remains 16/16 complete. No setup or install was repeated;
optional Git hooks remain skipped under coordinator ownership.

The isolated initial schema check used pinned Node 26.13.1, Ajv 8.20.0 and
ajv-formats. It accepted the candidate collection: 25 characters, nine recruits,
zero schema diagnostics. A separate static reference scan found no unknown
draft action or evidence reference. These checks do not execute recruitment or
establish semantic eligibility, a browser result, human learning, media or a gate.

The expanded [preparation check](characters/preparation-checks.json) confirms all
24 current documents validate under both the preserved old schema and candidate
schema; only `ability`, `character` and the added demonstration definition differ.
All 50 asset references exist and all portraits remain planned. The
[source/reference check](characters/reference-source-checks.json) resolves the
draft against 156 existing actions, 43 facts, seven profiles, fifteen rules, twelve objectives and twelve rooms, with zero errors. It also verifies each
recruit’s demonstration, progression expectation and rules against unchanged
T092, exact copied S01–S13 claims, and all seven protected preparation input hashes.

Root reviewed the schema design and roster prose, then caught a product-copy
leak in CH24: the initial joke mentioned accepted model counts. The corrected
Twins now share one introduction and dispute who says it first. Production
counting remains external evidence only. This prose review does not replace
runtime, source-backed human technical or media acceptance.

## Ordered join and actual validation

Root approved the bounded schema and T092 provenance mapping, then authorized the
actual join after T090/T091 acceptance. All 25 character document references and
the explicit loader import are present; the original world character allocations
are unchanged. The standard schema and save-policy generators produced the live
artifacts. Generic minimal character fixtures still validate, while the canonical
production collection requires all 25 complete contracts and exactly nine recruits.

The first joined proof exhausted the unchanged 4096-state bound only when both
actual Photon and Titan conversations were present. The preserved
[counterexample](characters/graph-counterexample.json) compares no conversations,
each alone, and both. Root reviewed a narrow normalization: only an entirely
single-choice, unconditional, terminating fact-only remainder may close in the
structural proof, applying real once-only effects in order. All authored dialogue
is retained. Branches, conditional nodes/choices, cycles, item grants, consumption,
flags and recovery histories remain concrete. Targeted regressions retain the
entry grant, reject locked conditional exits, reject consumption before a later
grant, and reject an inert cycle. Existing history and inventory negatives pass.
All three routes now prove within the original bound.

The semantic provenance audit also found a substantive draft mismatch: Hermit's
frozen five-field requirement names host, medium, wavelength, rate and
connector/polarity. O09's market evaluator does not check wavelength/polarity.
Root approved O05/OPTICAL and actual fiber controls instead, with no additional
O09 invitation gate. Discovery and explicit invitation remain in the existing
R06/R09 homes. The S10 power limitation is context, never proof of optical fields.
This correction is reflected in the live collection, retained authoring script,
consumer handoff and negative contract test. T092 itself remains unchanged.

Production checks derive teaching evidence from the canonical objective and its
actual prerequisite closure. Demonstration rules must occur in the specifically
referenced scoped evidence; profiles must belong to that objective context.
Tests reject existing-but-unrelated radio evidence/rules/profiles as well as
unknown IDs. Portrait/model identity ownership, optional/future recruitment gates,
conventional equivalents, nonrecruit abilities, complete roster membership and
exact reviewed claims/source coverage are checked independently.

The save policy's changed semantic membership is **25 compendium IDs, nine
recruit-eligible character IDs, 18 owned ability IDs and max level 2 per recruit**.
The original save-validator algorithm is unchanged. `members.character` means
party/recruit eligibility, not every described character. The initial new test
mistakenly expected 25 there; the corrected test enumerates all 25 compendium
IDs separately and the exact nine recruit IDs. This does not prove demonstrated
recruitment, per-level ability admission or runtime lifecycle behavior; T094 owns
those implementations and checks.

Local results under Node 26.13.1 and PHP 8.4.28:

- Seven scoped suites: **309 PASS, 140 existing T092 runtime TODOs** across roster,
  generic registry, frozen oracles, world graph, save validator, outcome/save policy
  and generated-policy TypeScript/PHP parity. The broad run had 308 PASS/one
  mistaken membership expectation; its affected suite then passed all three.
- `npm run check`: PASS, including strict TypeScript, actual content validation
  (12 rooms, 76 authored records, all three routes), and generated policy freshness.
- `npm run build`: PASS, 122 modules; existing large-chunk advisory retained.
- Original T092 eleven hashes: ten still checked against current bytes; only the
  evolved schema is mapped to its exact preserved baseline. Sources, all original
  fixture bytes and canonical asset manifest remain unchanged.

Logs retain earlier failures rather than replacing them: the first unextended
validator run; accidental shared-array JSON-bound fixture; a temporary early
return suppressing an existing second route diagnostic; strict loop narrowing;
Hermit's caught context mismatch; and the save-membership correction. The final
[seal](characters/join-seal.json) records exact reviewed file hashes and result
scope. No native browser, player action, recruitment, artwork production, human
technical review or gate acceptance is claimed. Root owns independent joined
review, tracking, publication and T093 acceptance.
