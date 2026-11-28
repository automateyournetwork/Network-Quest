# Spec001 technical review · reviewer packet

**Independent human findings pending.** This packet covers the playable candidate `ae8472469b5f7d98e939ccb5471b03893630993a`, its fictional physical profiles and its on-screen teaching. T160 supplies technical-review evidence for AC03 and AC18. AC11 has its own real-provider tests. Reviewers can do this entire exercise as a guest. [Candidate](https://github.com/automateyournetwork/Network-Quest/tree/ae8472469b5f7d98e939ccb5471b03893630993a) · [Acceptance criteria](../../../SPEC.md#release-acceptance-matrix) · [Human review plan](../../../PLAN.md)

## Open the game

Use the public checkout instructions with Node 26.13.1 and npm 11.20.0. For a fresh copy of this exact revision, run the following in a terminal. The browser adventure needs no sign-in or provider configuration. [Contributor setup and runtime downloads](../../../README.md#build-and-play-from-a-public-checkout) · [Verified public build](independent-build.md)

```sh
git init Network-Quest-technical-review
cd Network-Quest-technical-review
git fetch --depth=1 https://github.com/automateyournetwork/Network-Quest.git ae8472469b5f7d98e939ccb5471b03893630993a
git checkout --detach FETCH_HEAD
npm ci
npm run build
npm run preview:client
```

Open the printed loopback address at `/arcade/play/network-quest/`. Choose **New Adventure**. Keep the tab open to retain guest progress. **Scene** lists the objects and exits for the selected verb. **Evidence** shows feedback. **Diagnostics → Take measurement → Submit this reading** records and evaluates the selected configuration. **Notebook** keeps observations and hypotheses. Use another tab for another guest run.

## Follow the evidence

Record what you see and your own expected result before opening the reference cases below. Include the control, reading, unit and scope of any misleading wording. Mark which rows you actually played and which you inspected from source.

| Stop | What to inspect |
| --- | --- |
| **R01 Arrival Lift · power, link and packet** | **Look** at the power and link indications separately. **Look at message capsule**, then **Step journey** through payload, encode, transmit, decode and compare. Which bits changed, and what supplied the change? What conclusions about the cable, Ethernet frame or higher layers would exceed the evidence? **Return to investigation**, use **Change physical path**, then compare again. |
| **R02 Titan’s Workshop · choose a branch** | In R01 **Talk to Photon the Firefly**, then **Use → Inspect physical path**. Walk to the workshop, talk to the Titan, identify the known-good endpoints and path under test with **Look**, then pin your hypothesis in **Notebook**. Choose **Continue as guest** when offered. The three branches below are reachable from the workshop. |
| **R03–R04 copper · T01–03, T16** | Read the compatibility and diagnosed-defect cards. Measure the original open 105 m path before changing it. Compare replacement (85 + 10 m) and intact alternate (90 + 10 m) against this profile. In Echo Cavern compare the repeater proposal with the observed break. What does each measurement establish, and would a product with a different profile necessarily behave the same way? [Cisco cable specifications](https://www.cisco.com/c/en/us/td/docs/routers/access/800/hardware/installation/guide/800HIG/appendix.html) · [Fluke wiremap failures](https://www.flukenetworks.com/blog/cabling-chronicles/whats-wrong-my-cable) |
| **R05–R06 fiber · T04–07, T15–16** | At the dock compare media, wavelength direction, rate, connector/polarity and host support. Inspect, choose a compatible intervention, reinspect and submit. In Prism Vault compare 10, 8 and 9 dB passive loss. Read the current card and proposed solution, receive power, sensitivity reserve and upper bound. In **Diagnostics** reveal each hint in order. Which facts does the method prompt elicit? When does it supply the answer? After O06, **Open Prism Budget Bench → Diagnose the 10 dB card**. What happens when a learner correctly diagnoses a failing plan? [Juniper budget and margin equations](https://networkingdocs.hpe.com/documentation/us/en/hardware/qfx5130/topics/topic-map/qfx5130-network-cable-transceiver.html) · [Cisco optical specifications, tables 3–4](https://www.cisco.com/c/en/us/products/collateral/interfaces-modules/transceiver-modules/data_sheet_c78-455693.html) |
| **R07–R08 radio · T08–09, T13** | Keep the survey and endpoint settings cards, align or select a viable path, match both endpoints and measure. In Storm Observatory change the emitter conditions and try the supplied −84.99 dBm noise card. Compare the units for the two received levels and their difference. Which readings became stale? What service or throughput claim, if any, does the current evidence support? [Cisco site survey FAQ, SNR section](https://www.cisco.com/c/en/us/support/docs/wireless-mobility/wireless-lan-wlan/68666-wireless-site-survey-faq.html) |
| **R09 Shell Market · T10–11** | Read the separate equipment checks. Select 100/full, then compare the original three-demand proposal with kits A and B. Separately try the 23 W mismatched module and the 23 W failed-port allocation. Can the panel identify what was tested and why it failed? Name the endpoints’ common mode, where the power budget is specified and the evidence still needed for service. [NETGEAR PSE/PD definitions](https://kb.netgear.com/12902/Power-over-Ethernet-PoE-standards-and-compatibility) · [Cisco negotiation guidance](https://www.cisco.com/c/en/us/support/docs/lan-switching/ethernet/10561-3.html) |
| **Character and hint language** | In R05 choose **Look → Multimode Hydra**, open **Compendium** and expand its entry. Compare the creature’s depicted heads, technology, ability, limitations and fictional RPG attributes. What does the text allow you to infer about channels, rate and compatibility? Check a second character, such as the Electric Eel in R09 or the Metronome in R10. Quote any sentence or hint that could teach a different mechanism. [Character entries](../../../content/spec001/characters.json) · [Corning optical glossary](https://www.corning.com/optical-communications/worldwide/en/home/products/fiber/optical-fiber-resource-center/glossary-of-terms.html) |
| **R10–R12 Clockworks, Rift and Iron Threshold · T12–13** | Decode the four ordered samples in R10 and explain the physical role. At R11 review and execute your route’s repair plan. At the validation balcony **Look → Follow the test message through the current route**. Compare the recovered highlighted bytes to R01, including frame context, sample order and the six future realms. In **Validate repair**, try classifying before taking a new link measurement, after that reading, and after **Run endpoint test**. What evidence changes the conclusion? [ITU-T X.200 §7.7](https://www.itu.int/rec/T-REC-X.200/en) · [RFC 1122 §1.1.3](https://www.rfc-editor.org/rfc/rfc1122.html#section-1.1.3) |

The test helper lists the exact button sequence from **New Adventure** to each branch and the final balcony if navigation stalls. Record the step that required help. [Route controls](../../../tests/e2e/support/outcome-journey.ts) · [Packet controls and expected screens](../../../tests/e2e/packet-journey.spec.ts)

## Transfer and source checks

Use these as desk exercises. Indicate whether the game presents enough information to reason about them. The source register gives each publisher, section, supported claim and limitation. The project's seven profiles supply the exercise-specific thresholds. [Registered claims and T01–T16](../../../content/spec001/sources.json) · [Playable profiles](../../../content/spec001/profiles.json) · [Source worksheet](rule-source-review.md)

- A compatible optical path is changed from 9 to 9.01 dB loss. With −3 dBm transmit, −14 dBm sensitivity, −1 dBm maximum receive and 2 dB required reserve, which boundary decides the result? Separately consider a receiver directly observed at 0 dBm. Which check decides that case?
- Suppose signal stays at −65 dBm while comparable noise moves from −85 to −84.99 dBm. Does the comparison survive a display rounded to whole dB? Explain how changed settings or an obstructed path affect the inference.
- A repaired link carries the known NQ pattern, but an independent endpoint request fails. What could the apprentice report? How would that differ from deliberate isolation? Which layer could investigate address resolution or routing?
- For T14, inspect the missing unit, negative passive loss and unknown authored profile in the fixture. What feedback, progress and attempt consequences should an authoring error produce? This is a fixture inspection. The guest game offers predefined cards. [Independent cases](../../../tests/fixtures/physical-cases.json) · [Executable optical error checks](../../../tests/domain/optics.test.ts)

## Return the review

Please return one account in your own words through the coordinator. Include the name or reviewer handle you authorize for attribution, your relevant networking experience, the revision, date, browser, rooms or sources inspected, and any unexamined areas. For each finding give **where → action → what appeared → what you expected and why → correction or disposition**. Include a scoped confirmation where a claim held up. If a concern came from a particular phrase, quote it. A reviewer name and date attribute the actual observations.

**Human review record.** Awaiting an attributed response from an independent technical reviewer. Previously documented owner listening and Codex source/browser reviews have their own scopes. [Owner listening evidence](audio-coordinator-review.md) · [Prior agent packet review](US3.md) · [Agent preparation, observed ambiguity and baseline results](../../implementation/loops/177-T160.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
