# Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
"""T093 isolated authoring preparation. Never writes to loaded content or source."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
read = lambda path: json.loads((ROOT / path).read_text())
world = read('content/spec001/world.json')
sources = {x['id']: x for x in read('content/spec001/sources.json')['sources']}
oracle = read('tests/fixtures/companions.json')
recruits = {x['characterId']: x for x in oracle['recruits']}
q = lambda value: 'spec001:' + value

# These are short original summaries of inspected primary publications, not new
# scored rules or amendments to the immutable T006 source/model/case register.
context = {
 'modes': ('Corning Optical Fiber Glossary of Terms', 'https://www.corning.com/optical-communications/worldwide/en/home/products/fiber/optical-fiber-resource-center/glossary-of-terms.html', 'Basic Optical Fiber Concepts: Multimode vs. Single-mode', 'Single-mode and multimode name optical propagation behavior in the fiber.', 'This simplified terminology supplies no lane count, rate, distance, compatibility result or new game profile.'),
 'infrared': ('Vishay IRDC, Part 2: Protocol, document 82504, revision 1.4', 'https://www.vishay.com/docs/82504/protocol.pdf', 'Page 1: IrDA Protocol Stack and IrDA Link Access Protocol (IrLAP)', 'IrDA has a physical layer and separate link-access and link-management functions.', 'Historical descriptive context only; no IrDA framing, discovery, timing, range or compliance test is implemented.'),
 'satellite': ('NASA Small Spacecraft Technology State of the Art: 9.0 Communications', 'https://www.nasa.gov/smallsat-institute/sst-soa/soa-communications/', '9.1 Introduction', 'Space communications use ground and space equipment; radio and optical links are both possible.', 'No orbital, propagation-delay, antenna-gain or satellite-service model is introduced.'),
 'dsl': ('ITU-T G.992.1 (07/1999): Asymmetric digital subscriber line transceivers', 'https://www.itu.int/itu-t/recommendations/rec.aspx?lang=en&rec=4718', 'Recommendation summary', 'The specified ADSL interface uses a metallic twisted pair between customer and operator equipment.', 'An ADSL example is not a universal DSL profile; no rate, reach, framing or provisioning rule is imported.'),
 'docsis': ('CableLabs: Driving Gigabit Speeds, From Lab to Consumer', 'https://www.cablelabs.com/tech-vision/tech-policy/informed-insights-whitepapers/driving-gigabit-speeds-from-lab-to-consumer', 'Distributed Access Architectures; Appendix A: DOCSIS, HFC, MAC, PHY', 'DOCSIS includes physical and media-access functions; hybrid fiber-coax networks combine optical and coaxial portions.', 'Architecture context only; no DOCSIS capacity, scheduling, registration or service outcome is scored.'),
 'qsfp': ('Cisco 40GBASE QSFP Modules Data Sheet', 'https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-660083.html', 'Product overview; module descriptions; Table 1: module types; Table 2: QSFP port cabling specifications; Platform support', 'The QSFP module portfolio has module-specific media, connector and lane arrangements.', 'Examples are product-specific. A shell or head count does not establish breakout support, host support or a universal optical lane mapping.'),
 'wdm': ('Cisco MDS 9000 Family NX-OS Fabric Configuration Guide: Dense Wavelength Division Multiplexing', 'https://www.cisco.com/en/US/docs/switches/datacenter/mds9000/sw/nx-os/configuration/guides/fabric/fabric_cli_4_2_published/dwdm_ps5989_TSD_Products_Configuration_Guide_Chapter.html', 'About DWDM', 'Wavelength division multiplexing carries distinct optical carriers at different wavelengths on a fiber.', 'Only the concept is used. No channel grid, channel count, amplified span or WDM configuration is scored.'),
 'pairs': ('Fluke Networks: Split Pair Identification', 'https://www.flukenetworks.com/support/knowledge-base/linkiq/split-pair-identification', 'Split Pair Identification, 2021-07-23', 'A split pair can have end-to-end conductor continuity while incorrect pairing causes crosstalk trouble.', 'This explains a separate concern; the current copper exercise scores only its reviewed continuity, length and compatibility model, not crosstalk certification.'),
}

# Description, technology, role/ability, limitations, realm note, source IDs,
# optional descriptive references. Identity and encounter rooms come from SPEC.
copy = {
 'CH01': (
  'Your boots are new, your notebook is empty, and your title is longer than your practical experience. The Underworld has kindly arranged to correct two of these things. You learn by looking, asking, testing and returning to a stubborn problem with a better question.',
  'An apprentice practices observation, controlled physical changes and repeatable validation.',
  'Walk, Look, Talk and Use ordinary tools or invited allies. Keep observations separate from guesses, and repeat the relevant check after a change.',
  ['A confident answer is not a measurement. A lit link does not prove every service works.', 'The adventure title is fictional; finishing it is not professional certification.'],
  'Your notebook travels through all seven teaching realms. Here the investigation concerns signals and physical paths; addressing, routing and applications remain distinct dependencies.', ['S01','S02','S08'], []),
 'CH02': (
  'The Titan keeps a workbench big enough to shelter a village and a mug labeled Probably Still Warm. For all that size, the guardian waits quietly while an apprentice thinks. A useful question earns more approval than a dramatic swing of a wrench.',
  'A mentor for scoped physical-layer diagnosis.',
  'Helps identify the endpoints and path under test, compare alternatives, and distinguish a repair from a documented temporary bridge or deliberate isolation.',
  ['Advice cannot replace an observation or complete a repair for you.', 'An unresolved shutdown is an honest outcome, not restored service.'],
  'Guardian of the Underworld. The Iron City can wait behind its marked future boundary; no later realm is needed to finish this episode.', ['S01','S02','S08'], []),
 'CH03': (
  'Photon carries a tiny inspection visor and an optimism reserve that apparently exceeds the local power budget. The firefly will illuminate a connector, a clue or an awkward silence. Only one of those belongs on the optical worksheet.',
  'Light transmission and inspection of a declared optical connection.',
  'Shows the connection inspection and compatibility checklist; with practice, points out the particular predicate still needing attention.',
  ['Light transmission is not delivery of electrical power.', 'Inspection and compatibility are preparation; optical reserve and endpoint service still need their own checks.'],
  'An Underworld light companion. A physical signal carries a representation of data; Photon neither routes an IP packet nor verifies a login.', ['S01','S07','S08'], []),
 'CH04': (
  'Copperhead coils beside the Warrens tester with the air of a tailor examining a very bad hem. The snake is patient with beginners and deeply offended by the phrase close enough when a required conductor is still open.',
  'Electrical signaling over a declared copper path.',
  'Compares continuity before and after a physical replacement; later identifies the remaining conductor or length check.',
  ['Cannot span a severed conductor by posing across it.', 'The fictional passive-channel limit remains in force; continuity alone does not certify cabling or prove service.'],
  'Copper is the medium in this Underworld lesson. Ethernet also has data-link behavior; the snake does not learn MAC addresses or choose an IP route.', ['S01','S03','S04','S05'], []),
 'CH05': (
  'The Unicorn wears a small ledger beneath a very elegant mane. It prefers long views, careful figures and introductions that include the module profile. When praised as universally superior, it politely asks, Superior for which link?',
  'Single-mode optical propagation, with module and fiber compatibility specified separately.',
  'Inspects the supplied compatible optical exercise and its received power; later explains sensitivity, overload and reserve as separate checks.',
  ['Single-mode is not one guaranteed payload lane or one universal distance.', 'The shared fictional optical budget is not a newly invented single-mode product. A matching profile and all receiver bounds still matter.'],
  'An optical Underworld ally, not an upgrade that makes every medium obsolete. Upper-layer framing and service checks depend on the equipment using the physical link.', ['S01','S06','S07'], ['modes']),
 'CH06': (
  'The Hydra has several heads, one appointment book and a remarkably orderly tea service. Each head wants to explain a mode of propagation. None is allowed to promise an extra free data channel merely for being in the portrait.',
  'Multimode optical propagation in a declared compatible installation.',
  'Examines the same supplied optical budget and profile checks as an ordinary meter; later explains why optical modes are not independent guaranteed payload channels.',
  ['Extra heads do not grant a rate bonus or automatic compatibility.', 'The fictional optical profile supplies the actual checks. No separate multimode reach or dispersion model is being simulated.'],
  'This is the optical Hydra of the Underworld. Modes describe light propagation; framing, switching and application behavior are separate dependencies.', ['S01','S06','S07'], ['modes']),
 'CH07': (
  'Thunderbird has the wingspan of a small weather system and the manners of a careful surveyor. Before any grand flourish, it checks the path, the settings and the notebook date. Thunder is optional. A fresh observation is not.',
  'Radio path, compatible settings, and separate signal and noise observations.',
  'Helps obtain a scoped radio observation; later compares samples with their source and freshness visible.',
  ['Signal strength alone cannot guarantee throughput.', 'A chosen mitigation is not a measurement; there is no universal best channel or regulatory recommendation here.'],
  'Radio is the Underworld teaching home. A working radio path still depends on appropriate link behavior and higher-layer services beyond this scoped exercise.', ['S01','S08','S09'], []),
 'CH08': (
  'Blue Dragon has established a very small kingdom around the Skywell exhibit and issues visitors very small ceremonial receipts. The dragon is happy to discuss nearby radio links, provided nobody mistakes proximity for a promise that everything will connect.',
  'An exhibit introducing short-range radio communication.',
  'Offers context about inspecting the intended path and compatible endpoints. This character is a guide, not a recruit or an extra radio repair route.',
  ['Short-range is a narrative exhibit description, not a measured range guarantee.', 'No Bluetooth pairing, discovery, security or protocol simulation is implemented by this exhibit.'],
  'The exhibit concerns physical radio signals. Real wireless systems also depend on link access and service protocols; this creature is not proof those functions succeeded.', ['S01','S02','S08'], []),
 'CH09': (
  'Red Scorpion taps a lacquered pointer beside the infrared exhibit. The tail is an excellent lectern lamp and an appalling substitute for reading the instrument label. The scorpion takes this distinction personally.',
  'Infrared is an optical signaling medium; complete infrared systems also have protocol layers.',
  'Explains the exhibit while the Clockworks supplies the separately labeled toy signal exercise. The scorpion is not recruitable.',
  ['The Clockworks toy mapping is not an IrDA implementation.', 'No real infrared range, framing, data rate or discovery behavior is scored here.'],
  'The light signal belongs to the Underworld lesson. In IrDA, physical signaling, link access and link management are distinct dependencies; none is secretly completed by a glowing tail.', ['S01','S02','S12'], ['infrared']),
 'CH10': (
  'Microwave Phoenix returns from each inspection with brighter feathers and a revised survey. It considers rising from the ashes a poor maintenance plan when an alignment check would have sufficed.',
  'A directional wireless relay exhibit and path-survey mentor.',
  'Draws attention to the declared viable path, compatible settings and fresh radio readings at the Observatory. It is an NPC, not an additional recruit.',
  ['A dramatic flight does not remove an obstruction or measure noise.', 'No real microwave frequency, antenna gain, spectrum permission or range is prescribed.'],
  'This Phoenix discusses physical radio dependencies. It is distinct from the future Network realm BGP Border Guardian Phoenix; it makes no route-selection decisions.', ['S01','S08','S09'], []),
 'CH11': (
  'Celestial Eagle folds a star chart into a pocket that should be much too small. It has traveled far enough to distrust the word instantaneous and is delighted when somebody asks what equipment is at the other end.',
  'A perspective on communication between ground and space equipment.',
  'Introduces the idea of a distant physical link without requiring a satellite simulator or another main-story route.',
  ['The Observatory radio fixture is not a satellite link budget or orbital model.', 'Distance alone does not establish delay, throughput or service health in this game.'],
  'Ground and spacecraft terminals and a suitable radio or optical link are physical dependencies. End-to-end services also need their own protocols; an orbital silhouette supplies none of them.', ['S01','S02'], ['satellite']),
 'CH12': (
  'Iron Golem has a drawer for every connector and a solemn expression for anyone who judges one by its outline. Its favorite phrase is Let us check the other four fields. It says this with enormous kindness and an audible drawer mechanism.',
  'PHY, host and interface compatibility.',
  'Helps separate physical fit from the medium, supported rate, wavelength direction and connection requirements, then asks for the final independent validation.',
  ['A matching shell is not a complete compatibility result.', 'Passing compatibility cannot override a failed power, signal or endpoint-service check.'],
  'The golem teaches at the Underworld boundary. Data-link framing and Network realm routing remain distinct from a usable physical interface.', ['S01','S02','S07','S10','S11'], []),
 'CH13': (
  'Ancient Tortoise runs the Antique Serial Post with a blotter, a brass bell and no sense of hurry. The oldest undelivered message is waiting for someone who will read each symbol instead of racing the clock.',
  'Historical serial communication context and the explicitly declared toy ordered-bit exercise.',
  'Hosts the optional Antique Serial Post. The reward is a journal illustration; neither its delivery nor a score opens the main route.',
  ['The toy does not simulate UART, RS-232 framing, baud rates or a real serial interface.', 'Old equipment is not automatically faulty, and slow animation is not a measured link rate.'],
  'The Underworld can show physical sampling and ordered symbols. Message framing and applications remain separate; the postal metaphor does not add real protocol behavior.', ['S01','S12','S13'], []),
 'CH14': (
  'DSL Mole is cataloguing the Shell Market tunnels by the cables already inside them. The mole regards reusing a sound installation as a fine adventure, provided someone checks what the endpoints actually support.',
  'DSL context, illustrated by ADSL transmission on a metallic twisted pair between customer and operator equipment.',
  'Explains why a familiar telephone medium and a particular access technology are not interchangeable names. This is an exhibit, not a recruit or simulated DSL service.',
  ['No ADSL rate, reach, noise threshold or provisioning promise is imported.', 'A copper pair alone cannot prove the customer and operator equipment are compatible or that Internet service is available.'],
  'The Underworld discusses the physical loop. Link framing, provider service setup and higher-layer connectivity are additional dependencies; the mole cannot complete them by tunnelling.', ['S01','S02'], ['dsl']),
 'CH15': (
  'DOCSIS Badger maintains an impeccable coax display and a queue of customers who all want to speak at once. Its answer is to point at two different diagrams, one for the medium and one for access to it.',
  'DOCSIS context over hybrid fiber-coax infrastructure, with physical and media-access functions distinguished.',
  'Introduces the coaxial portion of an access network. The badger is a market guide, not a recruit or a fourth repair route.',
  ['No DOCSIS scheduler, registration, channel bonding or capacity model runs here.', 'Neither a cable connector nor a physical link alone proves provider or application service.'],
  'DOCSIS crosses the Underworld and data-link teaching homes: it has PHY and MAC behavior. HFC also includes fiber and coax portions. Calling the badger physical-only would omit actual dependencies.', ['S01','S02'], ['docsis']),
 'CH16': (
  'Hermit Crab changes shells with the seriousness of a librarian changing catalog systems. Each rejected shell receives a neat label explaining why. The market has asked the crab to stop filing hats under unsupported hosts.',
  'Module selection using the declared host, medium, wavelength direction, rate and connector/polarity requirements.',
  'Compares the complete compatibility checklist; later identifies the particular unmet field instead of trusting a matching shell.',
  ['SFP is a form factor, not universal rate, PHY or host compatibility.', 'A comfortable shell and a generous power budget cannot repair a profile mismatch.'],
  'An Underworld module companion. A module serves a supported host interface; the host and upper-layer protocols remain responsible for their own behavior.', ['S01','S07','S10'], []),
 'CH17': (
  'QSFP Chimera has several heads and one carefully maintained inventory card. The heads disagree about lunch but agree that a head count is a poor substitute for a module data sheet.',
  'A QSFP form-factor exhibit with module-specific lane, media and host requirements.',
  'Explains why lane arrangements and breakout support must be read from the selected module and host information. It is not a recruit.',
  ['The silhouette does not promise four independent usable links.', 'No universal lane-to-fiber mapping, supported rate, breakout or compatibility result follows from the shell.'],
  'Physical interfaces have specific electrical and optical dependencies. The host configuration and higher-layer link behavior are separate; the Chimera does not multiply routes by growing a head.', ['S01','S07'], ['qsfp']),
 'CH18': (
  'Rainbow Serpent keeps the Prism Vault keys on ribbons of carefully labeled colors. It is delighted by rainbows and mildly exasperated when visitors assume that anything colorful must already be multiplexed.',
  'Wavelength division multiplexing: distinct optical carriers using different wavelengths on a fiber.',
  'Offers a descriptive exhibit beside the optical budget bench. No recruit, WDM repair or extra scored channel is added.',
  ['Wavelengths are not the Hydra’s propagation modes.', 'The current optical exercise has one declared profile; no channel grid, amplifier or extra capacity is inferred.'],
  'The Underworld explains the optical carriers and required optics. Their carried traffic still depends on its own framing and service protocols.', ['S01','S06','S07'], ['wdm']),
 'CH19': (
  'Electric Eel keeps accounts in a waterproof ledger and refuses to balance them with enthusiasm. It can explain an overspend without accusing the apprentice of moral failure, which makes it unusually popular in the Shell Market.',
  'Supplied electrical power and delivered endpoint demand, with the accounting boundary declared.',
  'Adds the stated demands and compares the delivered budget; later displays headroom or excess separately from per-port and power-method checks.',
  ['Adequate power does not prove a data link.', 'The exercise already specifies delivered values; do not subtract invented losses or make optical fiber supply electrical power.'],
  'Power supports physical equipment but is distinct from communication. PSE output and delivered PD power are different accounting boundaries; routing and applications require separate validation.', ['S08','S10'], []),
 'CH20': (
  'Echo Bat repeats useful statements with impressive clarity and unhelpful statements with regrettable fidelity. The bat therefore prefers to inspect the path before offering an encore.',
  'Physical signal regeneration and its limits in the declared continuity exercise.',
  'Compares before/after continuity and the repeater exhibit; later explains why regeneration cannot mend an unchanged break.',
  ['Cannot learn addresses, select routes or bridge a missing conductor.', 'No graded regenerative topology exists without separately reviewed segment profiles and limits.'],
  'The historical repeater analogy belongs to the Underworld. Address learning is data-link behavior and IP route selection is Network realm behavior, not an echo’s secret talent.', ['S01','S04','S05'], []),
 'CH21': (
  'Metronome Golem offers a comfortable chair before presenting the next sample. Its pendulum is theatrical; the apprentice may take as long as needed. Hurrying, it says, is an excellent way to misplace a bit.',
  'Signal timing, sample order and the declared toy symbol-to-bit map.',
  'Guides the untimed Clockworks exercise and optional Bit Loom. Pausing, stepping and replaying preserve the same physical explanation.',
  ['Physical sampling timing is not NTP or a wall-clock service.', 'The four-level toy is not a real PHY implementation; bits per symbol do not by themselves establish useful throughput.'],
  'Clock and data recovery is physical receiver context. Session timing, application clocks and higher-layer delivery belong to other mechanisms and are not simulated by the pendulum.', ['S01','S12','S13'], []),
 'CH22': (
  'Chameleon can match the workshop wallpaper, the Titan’s teacup and almost any sensible mood. The one thing it cannot imitate is a capability absent from an endpoint’s advertised list.',
  'Common supported speed/duplex capabilities in the supplied negotiation exercise.',
  'Finds the intersection of the declared endpoint sets; later explains an unsupported choice or an empty intersection.',
  ['Cannot invent support, fallback modes or forced-mode behavior.', 'Choosing a common mode does not prove address discovery, routing or an application login.'],
  'Physical capability negotiation needs coherent endpoint behavior. Its speed/duplex exercise does not perform the data-link, Network or Application realm jobs.', ['S01','S02','S11'], []),
 'CH23': (
  'Noise Demon has a large voice, an unreliable autobiography and a talent for appearing whenever the Observatory’s evidence gets worse. It would like full credit for every bad reading. The notebook politely declines.',
  'A story representation of impaired radio evidence in the declared scenario.',
  'Makes the consequence of raised noise visible while the instrument supplies the actual dated signal/noise readings. It is opposition, not a recruit.',
  ['The demon’s appearance is not a measured diagnosis or proof of cause.', 'A louder-looking signal or a defeated animation cannot establish throughput or current validation.'],
  'The impairment is represented in the physical radio exercise. Service failure can have other-layer causes; this character does not explain every outage.', ['S08','S09'], []),
 'CH24': (
  'The Crosstalk Twins finish one another’s sentences, then dispute which sentence belonged to whom. They insist on sharing one introduction in the Warrens. Nobody has yet persuaded them to agree on who says it first.',
  'Interference and pairing context alongside the copper continuity lesson.',
  'Prompt a useful distinction: conductor continuity is one check, while correct pairing and interference are separate concerns. They are a paired NPC encounter, not recruits.',
  ['The present copper fixture does not grade a crosstalk value or certify a cable.', 'An observed open does not locate every defect or prove the Twins caused it.'],
  'The story concerns physical coupling and pairing. It does not teach a packet collision algorithm, MAC learning or IP routing through an argument between twins.', ['S01','S04'], ['pairs']),
 'CH25': (
  'Backhoe of Doom stands over the Rift with a bucket full of exceptionally inconvenient geology. The Severed is not impressed by damage numbers. It is, however, vulnerable to a well-supported repair plan and the awkward persistence of someone who tests afterwards.',
  'A diagnosed physical disconnection and the consequences of restoration or safe isolation.',
  'The finale requires evidence, an eligible branch repair or deliberate isolation, and honest validation. Permanent restoration, a documented temporary bridge and unresolved shutdown remain distinct.',
  ['A victory animation or a powered repeater cannot mend the unchanged severed path.', 'Link-up alone does not prove endpoint service; safe shutdown leaves service unresolved.'],
  'The Severed is the Underworld manifestation of The Outage. Later realms have different faults; this episode neither repairs their protocols nor requires their unreleased content.', ['S01','S04','S05','S08'], []),
}

# Exact existing action/evidence references; no fake inventory object or new PHY.
bindings = {
 'CH03': ('optical-checklist', ['PROFILE-OPTICAL'], ['fiber-inspect-before','fiber-read-matching','fiber-profile-matched'], ['FACT-O05-inspection','FACT-O05-matching'], ['O05'], 'Predicate lantern', 'At the Gardens, inspect the connection and all supplied compatibility fields before applying an intervention. Ask Photon to join after reviewing that demonstration.', 'After recruitment, ask Photon to compare the five fields of a supplied mismatch with the recorded matching pair. The new view identifies the failed field without changing it.'),
 'CH04': ('continuity-comparison', ['PROFILE-COPPER-100'], ['copper-replace-section','O04-conventional-continuity-tool'], ['FACT-O03-path','FACT-O04-after'], ['O03','O04'], 'Remaining checks', 'At the Warrens and Cavern, retain the actual open-before reading, replace the diagnosed section, then obtain the intact-after reading before inviting Copperhead.', 'After recruitment, review a fresh remaining-open or overlength example with Copperhead. The new view names the unsatisfied conductor or length check; it cannot repair it.'),
 'CH05': ('optical-budget', ['PROFILE-OPTICAL'], ['fiber-profile-matched','O06-passive-path-A'], ['FACT-O05-matching','FACT-O06-budget'], ['O05','O06'], 'Three receiver bounds', 'Inspect the supplied compatible pair and compare its fresh received power and reserve at the Vault. Return to the Unicorn to review the demonstration and invite it.', 'After recruitment, use the same declared profile to compare the sensitivity, maximum receive bound and reserve. The new view keeps all three checks distinct, including exact boundaries.'),
 'CH06': ('optical-budget', ['PROFILE-OPTICAL'], ['fiber-profile-matched','O06-passive-path-B'], ['FACT-O05-matching','FACT-O06-budget'], ['O05','O06'], 'Modes, not payload lanes', 'Inspect a supplied compatible pair and compare its fresh received power and reserve. The Hydra can review either accepted passive path; its identity does not silently change the generic toy profile to multimode.', 'After recruitment, review the mode explanation beside the same optical result. The new view distinguishes propagation modes from guaranteed payload channels and leaves every physical result unchanged.'),
 'CH07': ('radio-observation', ['PROFILE-RADIO'], ['radio-read-path','radio-match-settings','O08-scenario-channel-A','O08-scenario-channel-B'], ['FACT-O07-path','FACT-O07-settings','FACT-O08-snr'], ['O07','O08'], 'Sample comparison', 'Record compatible settings and the viable path, then measure signal and noise separately. Review the fresh sample with Thunderbird before inviting it.', 'After recruitment, obtain a later sample and compare it with the earlier attributed reading. The new view labels which is current and explains the changed SNR without inferring throughput or weather causation.'),
 'CH16': ('module-checklist', ['PROFILE-OPTICAL'], ['fiber-inspect-before','fiber-read-matching','fiber-profile-matched'], ['FACT-O05-inspection','FACT-O05-matching'], ['O05'], 'First unmatched field', 'At the Gardens, compare host support, medium, wavelength direction, rate and connector/polarity using the supplied optical pair. Review that accepted demonstration with Hermit Crab at the Vault or Shell Market before inviting it.', 'After recruitment, compare an actual supplied optical mismatch with the recorded compatible pair. The new view names the unmet profile field; a matching shell or adequate power budget cannot waive it.'),
 'CH19': ('delivered-power', ['PROFILE-POWER'], ['market-read-power','O09-compatible-kit-A','O09-compatible-kit-B'], ['FACT-O09-power'], ['O09'], 'Headroom ledger', 'Sum the declared endpoint demands and compare them with the delivered budget. Review the actual result with Eel before inviting it; the optional Energy Audit is not required.', 'After recruitment, compare the original over-budget proposal and an accepted kit at the same delivered boundary. The new view shows headroom or excess and keeps per-port and power-method checks separate.'),
 'CH20': ('regeneration-limit', ['PROFILE-COPPER-100'], ['copper-read-repeater','copper-repeater-requires-continuity','O04-conventional-continuity-tool'], ['FACT-O04-before','FACT-O04-after','FACT-O04-repeater-limit'], ['O04'], 'What an echo cannot fix', 'Retain a measured open-before record, physically replace the section and obtain a fresh intact-after reading. Explain why a powered repeater alone cannot bridge the unchanged break before inviting Echo Bat.', 'After recruitment, compare the unchanged open case with the restored continuity record. The new view separates receive-and-repeat behavior from repairing the medium; it grants no unreviewed regenerative route.'),
 'CH22': ('capability-intersection', ['PROFILE-CAPABILITIES'], ['equipment-read-capabilities','equipment-mode-100-full'], ['FACT-O09-capability'], ['O09'], 'Unsupported-mode explanation', 'Read both endpoint lists, identify their common 100/full member and inspect the current capability result. Invite Chameleon after explaining why the absent 1000/full choice is unsupported.', 'After recruitment, compare an unsupported candidate and the reviewed empty-intersection boundary. The new view explains the missing shared mode without inventing a fallback.'),
}

# Progression has an explicit post-recruit interaction of its own. These are
# relevant controls/alternatives, not a demand to execute every listed action.
progression_actions = {
 'CH03': ['fiber-inspect-before','fiber-profile-matched','fiber-profile-wrong-fiber','fiber-profile-wrong-wavelength','fiber-profile-wrong-rate','fiber-profile-wrong-polarity','fiber-profile-unsupported-host'],
 'CH04': ['copper-restore-original','copper-replace-section','copper-alternate-path','O04-conventional-continuity-tool'],
 'CH05': ['fiber-path-A','fiber-path-high-loss','fiber-path-B','O06-passive-path-A','O06-passive-path-B'],
 'CH06': ['fiber-read-matching','read-PROFILE-OPTICAL','O06-passive-path-A','O06-passive-path-B'],
 'CH07': ['radio-channel-A','radio-channel-B','radio-raise-noise','radio-mitigate-emitter','O08-scenario-channel-A','O08-scenario-channel-B'],
 'CH16': ['fiber-read-matching','fiber-profile-matched','fiber-profile-wrong-fiber','fiber-profile-wrong-wavelength','fiber-profile-wrong-rate','fiber-profile-wrong-polarity','fiber-profile-unsupported-host'],
 'CH19': ['market-original-over-budget','market-read-power','O09-compatible-kit-A','O09-compatible-kit-B'],
 'CH20': ['copper-read-repeater','copper-repeater-bridges-open','copper-repeater-requires-continuity','O04-conventional-continuity-tool'],
 'CH22': ['equipment-read-capabilities','equipment-mode-1000-full','equipment-mode-100-full'],
}
demonstration_objectives = {'CH03':'O05','CH04':'O04','CH05':'O06','CH06':'O06','CH07':'O08','CH16':'O05','CH19':'O09','CH20':'O04','CH22':'O09'}

records = []
for meta in world['characters']:
    short = meta['shortId']
    description, technology, ability, limits, realm, source_ids, context_keys = copy[short]
    if meta['recruitable']:
        source_ids = list(dict.fromkeys(source_ids + recruits[meta['id']]['sourceIds']))
    claims = [{ 'sourceId': q(sid), 'section': sources[sid]['section'], 'supportedClaim': sources[sid]['supportedClaim'], 'limitations': [sources[sid]['limits']] } for sid in source_ids]
    contextual = [{'title': context[key][0], 'url': context[key][1], 'section': context[key][2], 'supportedClaim': context[key][3], 'limitations': [context[key][4]], 'retrievedDate': '2026-11-27', 'scope': 'descriptive-only-not-scored'} for key in context_keys]
    r = {'kind':'character','schemaVersion':1,'episodeId':'spec001','contentVersion':'1.0.0','id':meta['id'],'description':description,
      'dialogueIds': [q('DIALOGUE-photon-intro')] if short == 'CH03' else [q('DIALOGUE-titan-intro')] if short == 'CH02' else [],
      'compendium': {'id':q('COMPENDIUM-'+short), 'technology':technology,'abilitySummary':ability,'limitations':limits,'realmNote':realm,'sourceClaims':claims,'rpgAttributesLabel':'fictional-balancing-values',
       'portraitAssetId':q('ASSET-PORTRAIT-'+short), 'portraitText':meta['name']+'. '+meta['role']+'.',
       'discovery':{'roomIds':meta['roomIds'],'explanation': 'Start the adventure as the Apprentice.' if short=='CH01' else 'Look at or talk to '+meta['name']+' in an encounter room to discover this entry. A room visit alone does not recruit anyone.'},
       'recruitmentSummary':'Not recruitable. This role remains playable character, mentor, exhibit or opposition; there is no hidden ally unlock.' if not meta['recruitable'] else bindings[short][6],
       'progressionSummary':'No recruit levels or usable ally abilities. Discovering and reading this entry adds context without granting main-story progress.' if not meta['recruitable'] else bindings[short][7],
       'contextSources':contextual},
      'recruitable':meta['recruitable'],'abilities':[],'progression':[], 'assetIds':[q('ASSET-'+short),q('ASSET-PORTRAIT-'+short)]}
    if meta['recruitable']:
        o = recruits[meta['id']]
        key, profiles, actions, evidence, objectives, upgrade, demonstration, progression = bindings[short]
        aids = [q('ABILITY-'+short+'-'+key), q('ABILITY-'+short+'-explain')]
        demonstration_record = {'objectiveIds':[q(demonstration_objectives[short])], 'actionIds':[q('ACTION-'+a) for a in actions], 'evidenceIds':[q(e) for e in evidence], 'ruleIds':[q(x) for x in o['ruleIds']], 'profileIds':[q(x) for x in profiles], 'evidencePolicy':'accepted-demonstration-is-learning-only', 'explanation':demonstration+' The accepted observation shows what you demonstrated then. It is learning evidence, not a current repair measurement.'}
        r['recruitment']={'roomIds':meta['roomIds'], 'condition':{'kind':'all','conditions':[{'kind':'objective-complete','objectiveId':q(x)} for x in objectives]}, 'demonstratedInteraction':o['demonstratedInteraction'], 'demonstration':demonstration_record, 'effects':[{'kind':'recruit-character','effectId':q('EFFECT-recruit-'+short),'characterId':meta['id']}]}
        for index,aid in enumerate(aids):
            r['abilities'].append({'id':aid,'name':o['abilityExpectation'] if index==0 else upgrade,'description':o['abilityExpectation'] if index==0 else o['progressionExpectation'], 'limitations':list(dict.fromkeys(limits+o['limitations'])), 'ruleIds':[q(x) for x in o['ruleIds']], 'profileIds':[q(x) for x in profiles], 'conventionalEquivalentItemIds':[], 'conventionalEquivalentActionIds':[q('ACTION-'+a) for a in (actions if index==0 else progression_actions[short])], 'effects':[]})
        r['progression']=[{'level':1,'condition':{'kind':'character-recruited','characterId':meta['id']},'abilityIds':[aids[0]],'explanation':'After the demonstrated interaction and explicit invitation, unlock the basic inspection. Recruitment does not automatically put this ally into the active party.'},
         {'level':2,'condition':{'kind':'character-recruited','characterId':meta['id']},'abilityIds':[aids[1]],'demonstration':{**demonstration_record,'actionIds':[q('ACTION-'+a) for a in progression_actions[short]],'explanation':progression+' Review this distinct post-recruit demonstration as learning evidence; it never certifies the current repair.'},'explanation':progression}]
    records.append(r)

payload={'$schema':'../schemas/content.schema.json','kind':'collection','schemaVersion':1,'episodeId':'spec001','contentVersion':'1.0.0','records':records}
(HERE/'characters.json.draft').write_text(json.dumps(payload,ensure_ascii=False,indent=2)+'\n')
(HERE/'context-sources.json').write_text(json.dumps({'scope':'T093 descriptive primary-source preparation; not a scored-rule register','retrievedDate':'2026-11-27','sources':[{ 'key':k,'title':v[0],'url':v[1],'section':v[2],'supportedClaim':v[3],'limitations':[v[4]]} for k,v in context.items()]},ensure_ascii=False,indent=2)+'\n')
print(f'Prepared {len(records)} isolated character records; {sum(r["recruitable"] for r in records)} recruit contracts. No loaded file changed.')
