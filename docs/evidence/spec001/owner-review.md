# Play the Underworld · owner review

**Whole-episode decision pending · November 28, 2026.** This guest build runs from the Arrival Lift to the Iron Threshold. Select a verb to reveal the objects or destinations you can use directly in the picture. The Copper Warrens touch controls and the configuration labels in the Prism Vault and Shell Market include the earlier corrections. The public client revision is `15abb7bed50b80807215cd2f2e046e49fe9a9dd5`. [Public candidate](https://github.com/automateyournetwork/Network-Quest/tree/15abb7bed50b80807215cd2f2e046e49fe9a9dd5) · [Verified changes and build digest](refinements.md)

## Play

1. Open the guest preview and choose **New Adventure**. Keep this tab open during your run. Reloading or closing it clears guest progress.
2. In **The Arrival Lift**, choose **Look** and inspect the highlighted power and link indications. The **Scene** menu also lists these targets. **Talk** to Photon, then **Use → Inspect physical path**. **Walk** to the Titan’s Workshop.
3. Talk to the Titan and look at the known-good endpoints and the physical path under test. In the **Notebook**, write a hypothesis, choose **Pin hypothesis** and close the notebook. Choose **Continue as guest**. Pick the copper, fiber or radio investigation. **Scene** lists objects and exits. **Diagnostics** lets you take and submit readings.
4. Follow the investigation through the Rift. At the Iron Threshold, compare the repaired link and the endpoint test before classifying the result. Note which ending you reached, or where you stopped. Did the clues give you enough to make that choice, and did its consequence feel earned?

To reopen this exact candidate on another machine, use Node 26.13.1 with npm 11.20.0 and run the following in a new directory. Open the printed address at `/arcade/play/network-quest/`. [Runtime and preview setup](../../../README.md#build-and-play-from-a-public-checkout)

```sh
git init Network-Quest-owner-review
cd Network-Quest-owner-review
git fetch --depth=1 https://github.com/automateyournetwork/Network-Quest.git 15abb7bed50b80807215cd2f2e046e49fe9a9dd5
git checkout --detach FETCH_HEAD
npm ci
npm run build
npm run preview:client
```

The 442-file distribution has SHA-256 `a6b70a1d5e7496950ef728f5bf4ead62083ecc7a2dbc737e3234e121cd0fca38`. The file ledger identifies the exact bytes behind the reviewed game. [Distribution ledger](refinements/verb-targets-production.json)

## Look and listen

Open the room packet’s HTML file from the checkout in a browser. Select a room and open its frame at full size. In play, try picking the same objects and exits. Record any scene where the art hides a clue, the controls obscure the action, or the dialogue loses the playful, lightly dark networking tone you requested. [Twelve room frames and sound cues](media-audit/review.html) · [All twelve frames at a glance](media-audit/twelve-rooms.jpg)

The eight listening packets include full cues, repeat boundaries and spoken comparisons. Open their HTML files locally. In the game, **Sound and reading** lets you replay a cue against the room bed. The outstanding recordings are eight music cues, twelve room beds, 37 effects and 52 voices, **109 of 120 active sounds**, plus their in-game mixes. Record what you heard on ordinary speakers and on headphones or earbuds, including any words lost under music or any distracting transition. A partial pass can name just the packets, rooms and devices you covered. [Listening index and eight playable packets](audio-production/listening.md)

John’s November 26 listening approval covers twelve sealed audition files on Mac speakers and earbuds. Eight voices and three effects still use those bytes. The twelfth audition was a 20-second title excerpt. The game now uses a 72.4-second title cue. John also accepted the revised Arrival Lift screen after the controls moved inside the adventure frame. Both decisions stand. [Recorded listening](audio-auditions.md) · [Corrected Arrival Lift approval](presentation/owner-frame-approval-2026-11-26.md)

## First-run feedback, November 28

In the Arrival Lift, pressing **W** or selecting **Walk** left the owner unsure where to click or whether to use the arrow keys. The owner reached the Workshop by opening **Scene** and selecting its exit. They requested visible targets directly on the scene when selecting **Walk**, **Look**, **Talk** or **Use**. After playing the revised game, the owner said the indicators were “MUCH better” and asked the team to continue to 100%. The separate whole-episode, audio and beginner decisions remain open. [Refinement record](refinements.md)

## Record the owner’s decision

| Field | Owner finding |
| --- | --- |
| Date, client revision and browser | |
| Route played and ending or last room reached | |
| Room, action or cue reviewed, output device for sound, and what worked or needs changing | |
| Overall satisfaction with Spec001 in your own words, and any changes needed before acceptance | |

The project records contain no whole-episode decision for this build. Actual independent technical findings and a timed beginner first playthrough are also outstanding. The contributor and browser checks cover playable routes, endings, local one-slot saves, media and access. Host retention and limits, outstanding provider settings, real sign-in and cross-device restoration still affect the earlier gates. The integrated matrix identifies findings for refinement and the operations reserved for G7. [Technical reviewer packet](technical-review.md) · [Beginner session sheet](beginner-playthrough.md) · [Acceptance matrix](acceptance-matrix.md) · [Gate decisions](gates.md)

Copyright 2026 John Capobianco. SPDX-License-Identifier: CC-BY-4.0.
